/**
 * cloud-compute-compare: pricing logic.
 * Pure ES module: no DOM, no fetch. Takes the compute pricing.json object (schema_version 1)
 * and a server spec, returns each provider's cheapest matching server.
 *
 * Documented simplifications (shown in the widget footer):
 * - The server runs all month. Where a provider has a monthly price or cap, the lower of that
 *   and the hourly price for the month is used.
 * - Each provider is shown at its cheapest instance with at least the vCPUs and memory asked
 *   for, so some rows have more capacity than requested.
 * - Disk is priced on the provider's general-purpose SSD. With the high-performance option it
 *   is priced on the cheapest class that reaches pricing.performance_target, which can mean
 *   buying provisioned IOPS or a larger disk. Disk included with a plan is used first.
 * - Data transfer, IP addresses, backups, licences and discounts are not modelled.
 */

/** A price that is either a number or { us, uk, eu } per region. */
export function regionValue(v, region) {
  return v !== null && typeof v === "object" ? v[region] : v;
}

/** Monthly price of an instance in a region, or null if it is not sold there. */
export function instanceMonthly(instance, region, hours) {
  const hourly = instance.hourly ? instance.hourly[region] : null;
  const cap = instance.monthly ? instance.monthly[region] : null;
  if (hourly == null && cap == null) return null;
  if (hourly == null) return cap;
  const metered = hourly * hours;
  return cap == null ? metered : Math.min(metered, cap);
}

/**
 * GB a class without separate provisioning must be to reach a target on one measure
 * (IOPS or MB/s). Returns 0 if any size reaches it and null if no size can.
 */
function capacityFor(target, base = 0, floor = 0, perGB = 0, max = Infinity) {
  if (max < target) return null;
  if (Math.max(base, floor) >= target) return 0;
  if (!perGB) return null;
  return Math.ceil((target - base) / perGB);
}

/**
 * Monthly price of `gb` of block storage on one disk class.
 * target: { iops, throughput_mbps } the disk must deliver, or null for no requirement.
 * Returns { cost, billedGB, sized }, or null if the class cannot do it. billedGB can exceed
 * gb, and sized says why: "tier" (sold in fixed sizes) or "performance" (a larger disk is
 * needed to reach the target).
 */
export function diskOption(cls, gb, region, target) {
  if (gb <= 0) return { cost: 0, billedGB: 0, sized: null };

  if (cls.size_tiers) {
    const fits = (t) => t.gb >= gb && (!target || ((t.iops || 0) >= target.iops && (t.mbps || 0) >= target.throughput_mbps));
    const tier = cls.size_tiers.find(fits);
    if (!tier) return null;
    const plain = cls.size_tiers.find((t) => t.gb >= gb);
    return { cost: regionValue(tier.month, region), billedGB: tier.gb, sized: tier === plain ? "tier" : "performance" };
  }

  const perGB = regionValue(cls.per_gb_month, region);
  if (perGB == null) return null;
  let capacity = gb, extra = 0;
  if (target) {
    if ((cls.max_iops ?? Infinity) < target.iops || (cls.max_mbps ?? Infinity) < target.throughput_mbps) return null;
    if (cls.provision) {
      if (cls.provision.max_iops_per_gb) capacity = Math.max(capacity, Math.ceil(target.iops / cls.provision.max_iops_per_gb));
      extra = Math.max(0, target.iops - (cls.base_iops || 0)) * regionValue(cls.provision.per_iops_month, region)
            + Math.max(0, target.throughput_mbps - (cls.base_mbps || 0)) * regionValue(cls.provision.per_mbps_month, region);
    } else {
      const forIops = capacityFor(target.iops, cls.base_iops, cls.floor_iops, cls.iops_per_gb, cls.max_iops);
      const forMbps = capacityFor(target.throughput_mbps, cls.base_mbps, cls.floor_mbps, cls.mbps_per_gb, cls.max_mbps);
      if (forIops == null || forMbps == null) return null;
      capacity = Math.max(capacity, forIops, forMbps);
    }
  }
  return { cost: capacity * perGB + extra, billedGB: capacity, sized: capacity > gb ? "performance" : null };
}

/** The cheapest of several disk classes for a size and target, or null if none can do it. */
function cheapestDisk(provider, ids, gb, region, target) {
  let best = null;
  for (const id of ids) {
    const option = diskOption(provider.disks[id], gb, region, target);
    if (option && (!best || option.cost < best.cost)) best = { ...option, label: provider.disks[id].label };
  }
  return best;
}

/**
 * One provider: every eligible instance priced, cheapest picked.
 * spec: { vcpu, memory_gb, disk_gb }
 * opts: { dedicated_only, recent_cpu, allow_arm, fast_disk }
 */
export function providerQuote(pricing, provider, spec, region, opts = {}) {
  if (!provider.regions[region]) {
    const reason = (provider.residency_notes && provider.residency_notes[region]) || "no local datacentre";
    return { provider, excluded: true, reason };
  }

  const hours = pricing.hours_per_month;
  const eligible = provider.instances.filter((i) => {
    const f = provider.families[i.family];
    if (i.vcpu < spec.vcpu || i.memory_gb < spec.memory_gb) return false;
    if (opts.dedicated_only && f.shared_cpu) return false;
    if (opts.recent_cpu && !(f.cpu_launch_year >= pricing.recent_cpu_since)) return false;
    if (!opts.allow_arm && f.arch === "arm") return false;
    return instanceMonthly(i, region, hours) != null;
  });
  if (!eligible.length) {
    return { provider, excluded: true, reason: "no server of this size with these options" };
  }

  const target = opts.fast_disk ? pricing.performance_target : null;
  const standardOf = (f) => [f.disk_standard || provider.disk_standard];
  const fastOf = (f) => f.disk_fast || provider.disk_fast || [];
  // A family can use the high-performance option if one of its disk classes reaches the target.
  const canGoFast = (f) => cheapestDisk(provider, fastOf(f), 1, region, target) != null;

  let pool = eligible, noFastDisk = false;
  if (target) {
    const fastPool = eligible.filter((i) => canGoFast(provider.families[i.family]));
    if (fastPool.length) pool = fastPool; else noFastDisk = true;
  }

  const quotes = pool.map((instance) => {
    const family = provider.families[instance.family];
    const compute = instanceMonthly(instance, region, hours);
    const included = instance.included_disk_gb || 0;
    const extraGB = Math.max(0, spec.disk_gb - included);
    const d = target && !noFastDisk
      ? cheapestDisk(provider, fastOf(family), extraGB, region, target)
      : cheapestDisk(provider, standardOf(family), extraGB, region, null);
    return {
      instance, family, compute,
      disk: d.cost, diskLabel: d.label || null, extraGB, billedGB: d.billedGB, diskSized: d.sized,
      includedGB: Math.min(included, spec.disk_gb),
      total: compute + d.cost
    };
  }).sort((a, b) => a.total - b.total || a.instance.vcpu - b.instance.vcpu || a.instance.memory_gb - b.instance.memory_gb);

  return { provider, excluded: false, best: quotes[0], others: quotes.slice(1, 4), total: quotes[0].total, noFastDisk };
}

/** All providers, cheapest first, with the excluded ones listed separately. */
export function compare(pricing, spec, region, opts = {}) {
  const quotes = pricing.providers.map((p) => providerQuote(pricing, p, spec, region, opts));
  return {
    ranked: quotes.filter((q) => !q.excluded).sort((a, b) => a.total - b.total),
    excluded: quotes.filter((q) => q.excluded)
  };
}
