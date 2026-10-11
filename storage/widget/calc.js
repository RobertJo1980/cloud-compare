/**
 * cloud-cost-compare — pricing logic.
 * Pure ES module: no DOM, no fetch. Takes the pricing.json object (schema_version 1)
 * and a workload, returns ranked monthly estimates.
 *
 * Documented simplifications (shown in the widget footer):
 * - Egress tiers apply to the paid volume after the free allowance.
 * - Retrieval fees are charged on the full downloaded volume for classes that have them.
 * - Monthly free tiers are not modelled.
 * - Minimum storage durations are badges, not costs (objects assumed to live them out).
 */

/** A price that is either a number or { us, uk } per region. */
export function regionValue(v, region) {
  return v !== null && typeof v === "object" ? v[region] : v;
}

function freeEgressGB(provider, workload, region) {
  const free = provider.egress && provider.egress.free;
  if (!free) return 0;
  switch (free.type) {
    case "unlimited":
    case "fair_use":
      return Infinity;
    case "multiple_of_storage":
      return free.factor * workload.stored_gb;
    case "flat_gb":
      return free.amount_by_region ? (free.amount_by_region[region] || 0) : (free.amount || 0);
    default:
      return 0;
  }
}

function egressCost(provider, paidGB, region) {
  const tiers = (provider.egress && provider.egress.tiers) || [];
  let cost = 0, used = 0;
  for (const tier of tiers) {
    const cap = tier.up_to_gb == null ? Infinity : tier.up_to_gb;
    const span = Math.min(paidGB, cap) - used;
    if (span <= 0) break;
    cost += span * regionValue(tier.per_gb, region);
    used += span;
  }
  // volume beyond a bounded last tier bills at that tier's rate
  if (paidGB > used && tiers.length) {
    cost += (paidGB - used) * regionValue(tiers[tiers.length - 1].per_gb, region);
  }
  return cost;
}

/** Monthly cost of one storage class. workload: { stored_gb, egress_gb, writes, reads } */
export function classCost(provider, cls, workload, region) {
  let storedGB = workload.stored_gb, floored = false;
  const floor = provider.monthly_minimum;
  if (floor && floor.type === "storage_floor_gb" && storedGB < floor.amount) {
    storedGB = floor.amount;
    floored = true;
  }
  const storage = storedGB * regionValue(cls.storage_gb_month, region);

  const free = freeEgressGB(provider, workload, region);
  const paidGB = free === Infinity ? 0 : Math.max(0, workload.egress_gb - free);
  const egress = egressCost(provider, paidGB, region);
  const fairUse = !!(provider.egress && provider.egress.free &&
    provider.egress.free.type === "fair_use" && workload.egress_gb > workload.stored_gb);

  const requests = (workload.writes / 1000) * regionValue(cls.write_per_1k, region)
                 + (workload.reads / 1000) * regionValue(cls.read_per_1k, region);
  const retrieval = workload.egress_gb * regionValue(cls.retrieval_per_gb, region);

  return { cls, storage, egress, requests, retrieval, floored, fairUse,
           total: storage + egress + requests + retrieval };
}

/** One provider: every eligible class priced, cheapest picked. opts: { instant_only, multi_zone } */
export function providerQuote(provider, workload, region, opts = {}) {
  const presence = provider.local_presence ? provider.local_presence[region] : "region";
  if (presence === "none") {
    const reason = (provider.residency_notes && provider.residency_notes[region]) || "no local datacentre";
    return { provider, excluded: true, reason };
  }
  let classes = opts.instant_only ? provider.classes.filter(c => !c.offline) : provider.classes;
  // Zone-redundant mode: providers with "priced" multi-zone (Azure) swap to their ZRS
  // price set and lose classes without one (Archive has no ZRS). "included" providers
  // are already multi-zone at list price; "unpublished" ones keep prices and get badged.
  if (opts.multi_zone && provider.multi_zone && provider.multi_zone.status === "priced") {
    classes = classes.filter(c => c.zrs).map(c => ({ ...c, ...c.zrs, label: c.label + " ZRS" }));
  }
  const all = classes.map(c => classCost(provider, c, workload, region));
  const best = all.reduce((a, b) => (b.total < a.total ? b : a));
  return { provider, excluded: false, presence, all, best, total: best.total };
}

/** All providers, cheapest first, with the region-excluded ones listed separately. */
export function compare(pricing, workload, region, opts = {}) {
  const quotes = pricing.providers.map(p => providerQuote(p, workload, region, opts));
  return {
    ranked: quotes.filter(q => !q.excluded).sort((a, b) => a.total - b.total),
    excluded: quotes.filter(q => q.excluded)
  };
}
