// Tests for the compute pricing logic. Run with: node --test compute/widget/calc.test.js
// The first group uses invented prices so the expected results are easy to check by hand.
// The second group runs against the real pricing.json and checks figures worked out from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compare, diskOption, instanceMonthly } from "./calc.js";

const all = (n) => ({ us: n, uk: n, eu: n });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.005, `${actual} is not ${expected}`);

const fixture = {
  hours_per_month: 730,
  recent_cpu_since: 2022,
  performance_target: { iops: 10000, throughput_mbps: 250 },
  providers: [
    {
      id: "metered", name: "Metered", pricing_url: "https://example.com",
      regions: { us: { code: "a" }, uk: { code: "b" }, eu: { code: "c" } },
      disks: {
        ssd: {
          label: "ssd", per_gb_month: all(0.1), base_iops: 3000, base_mbps: 125, max_iops: 80000, max_mbps: 2000,
          provision: { per_iops_month: all(0.005), per_mbps_month: all(0.04), max_iops_per_gb: 500 }
        }
      },
      disk_standard: "ssd", disk_fast: ["ssd"],
      families: {
        burst: { arch: "x86", shared_cpu: true, cpu_launch_year: 2024 },
        old: { arch: "x86", shared_cpu: false, cpu_launch_year: 2019 },
        "new": { arch: "x86", shared_cpu: false, cpu_launch_year: 2024 },
        arm: { arch: "arm", shared_cpu: false, cpu_launch_year: 2025 }
      },
      instances: [
        { name: "burst.2x8", family: "burst", vcpu: 2, memory_gb: 8, hourly: all(0.05) },
        { name: "old.2x8", family: "old", vcpu: 2, memory_gb: 8, hourly: all(0.08) },
        { name: "new.2x8", family: "new", vcpu: 2, memory_gb: 8, hourly: { us: 0.1, uk: 0.12, eu: null } },
        { name: "new.4x16", family: "new", vcpu: 4, memory_gb: 16, hourly: all(0.2) },
        { name: "arm.2x8", family: "arm", vcpu: 2, memory_gb: 8, hourly: all(0.06) }
      ]
    },
    {
      id: "flat", name: "Flat", pricing_url: "https://example.com",
      regions: { us: { code: "a" }, uk: null, eu: { code: "c" } },
      residency_notes: { uk: "no UK datacentre" },
      disks: { volume: { label: "volume", per_gb_month: all(0.1), base_iops: 5000, base_mbps: 200, max_iops: 5000, max_mbps: 200 } },
      disk_standard: "volume", disk_fast: ["volume"],
      families: { shared: { arch: "x86", shared_cpu: true, cpu_launch_year: null } },
      instances: [
        { name: "s-2-8", family: "shared", vcpu: 2, memory_gb: 8, included_disk_gb: 80, hourly: all(0.07), monthly: all(40) }
      ]
    }
  ]
};

const spec = { vcpu: 2, memory_gb: 8, disk_gb: 100 };
const byId = (result, id) => result.ranked.find((q) => q.provider.id === id);

test("a monthly cap wins over the metered price", () => {
  assert.equal(instanceMonthly(fixture.providers[1].instances[0], "us", 730), 40);
  assert.equal(instanceMonthly({ hourly: all(0.05) }, "us", 730), 36.5);
  assert.equal(instanceMonthly({ hourly: { us: null } }, "us", 730), null);
});

test("the cheapest matching instance is chosen, and x86 is the default", () => {
  const r = compare(fixture, spec, "us", {});
  assert.equal(byId(r, "metered").best.instance.name, "burst.2x8");
  assert.equal(byId(r, "metered").total, 0.05 * 730 + 100 * 0.1);
});

test("options narrow the choice", () => {
  assert.equal(byId(compare(fixture, spec, "us", { allow_arm: true, dedicated_only: true }), "metered").best.instance.name, "arm.2x8");
  assert.equal(byId(compare(fixture, spec, "us", { dedicated_only: true }), "metered").best.instance.name, "old.2x8");
  assert.equal(byId(compare(fixture, spec, "us", { dedicated_only: true, recent_cpu: true }), "metered").best.instance.name, "new.2x8");
});

test("the recent-processor option drops families with no documented launch year", () => {
  const r = compare(fixture, spec, "us", { recent_cpu: true });
  assert.deepEqual(r.excluded.map((q) => q.provider.id), ["flat"]);
});

test("an instance not sold in a region is skipped", () => {
  const r = compare(fixture, spec, "eu", { dedicated_only: true, recent_cpu: true });
  assert.equal(byId(r, "metered").best.instance.name, "new.4x16");
});

test("included disk is used before paid disk", () => {
  const flat = byId(compare(fixture, spec, "us", {}), "flat");
  assert.equal(flat.best.extraGB, 20);
  assert.equal(flat.total, 40 + 20 * 0.1);
});

test("a provider with no datacentre in the region, or no match, is excluded", () => {
  const uk = compare(fixture, spec, "uk", {});
  assert.deepEqual(uk.excluded.map((q) => [q.provider.id, q.reason]), [["flat", "no UK datacentre"]]);
  const big = compare(fixture, { vcpu: 64, memory_gb: 8, disk_gb: 0 }, "us", {});
  assert.equal(big.ranked.length, 0);
  assert.equal(big.excluded.length, 2);
});

test("the high-performance option buys provisioned IOPS and throughput, or flags the provider", () => {
  const r = compare(fixture, spec, "us", { fast_disk: true });
  const m = byId(r, "metered");
  assert.equal(m.best.disk, 100 * 0.1 + 7000 * 0.005 + 125 * 0.04);
  assert.equal(m.noFastDisk, false);
  const f = byId(r, "flat");
  assert.equal(f.noFastDisk, true);
  assert.equal(f.total, 40 + 20 * 0.1);
});

test("disk classes: fixed sizes, performance that grows with size, and limits", () => {
  const tiers = { size_tiers: [{ gb: 64, month: all(5), iops: 500, mbps: 100 }, { gb: 128, month: all(10), iops: 500, mbps: 100 }, { gb: 8192, month: all(900), iops: 16000, mbps: 500 }] };
  assert.deepEqual(diskOption(tiers, 100, "us", null), { cost: 10, billedGB: 128, sized: "tier" });
  assert.deepEqual(diskOption(tiers, 100, "us", { iops: 10000, throughput_mbps: 250 }), { cost: 900, billedGB: 8192, sized: "performance" });
  assert.deepEqual(diskOption(tiers, 0, "us", null), { cost: 0, billedGB: 0, sized: null });

  const grows = { per_gb_month: all(0.1), floor_iops: 3000, iops_per_gb: 30, max_iops: 20000, floor_mbps: 50, mbps_per_gb: 0.5, max_mbps: 512 };
  assert.deepEqual(diskOption(grows, 100, "us", { iops: 10000, throughput_mbps: 250 }), { cost: 50, billedGB: 500, sized: "performance" });
  assert.equal(diskOption(grows, 100, "us", { iops: 30000, throughput_mbps: 250 }), null);

  const fixed = { per_gb_month: all(0.1), base_iops: 8000, base_mbps: 350, max_iops: 8000, max_mbps: 350 };
  assert.equal(diskOption(fixed, 100, "us", { iops: 10000, throughput_mbps: 250 }), null);
  assert.deepEqual(diskOption(fixed, 100, "us", { iops: 8000, throughput_mbps: 250 }), { cost: 10, billedGB: 100, sized: null });
});

// ---- the real data ----
const pricing = JSON.parse(readFileSync(new URL("../pricing.json", import.meta.url), "utf8"));
const provider = (id) => pricing.providers.find((p) => p.id === id);
const instance = (id, name) => provider(id).instances.find((i) => i.name === name);

test("every instance refers to a known family and every disk class exists", () => {
  for (const p of pricing.providers) {
    for (const i of p.instances) assert.ok(p.families[i.family], `${p.id}: ${i.name} has no family`);
    const classes = [p.disk_standard, ...p.disk_fast, ...Object.values(p.families).flatMap((f) => [f.disk_standard, ...(f.disk_fast || [])])];
    for (const id of classes.filter(Boolean)) assert.ok(p.disks[id], `${p.id}: no disk class ${id}`);
  }
});

test("every provider with a datacentre in a region returns a quote for a small server there", () => {
  for (const region of ["us", "uk", "eu"]) {
    const r = compare(pricing, { vcpu: 2, memory_gb: 4, disk_gb: 50 }, region, {});
    const expected = pricing.providers.filter((p) => p.regions[region]).map((p) => p.id).sort();
    assert.deepEqual(r.ranked.map((q) => q.provider.id).sort(), expected, region);
  }
});

test("a quote is the instance price for the month plus the disk", () => {
  const r = compare(pricing, { vcpu: 2, memory_gb: 8, disk_gb: 100 }, "us", { dedicated_only: true });
  const aws = byId(r, "aws-ec2");
  const gp3 = provider("aws-ec2").disks.gp3;
  close(aws.total, instance("aws-ec2", aws.best.instance.name).hourly.us * 730 + 100 * gp3.per_gb_month.us);
});

test("the high-performance option on AWS adds 7,000 IOPS and 125 MB/s to a gp3 volume", () => {
  const plain = byId(compare(pricing, { vcpu: 2, memory_gb: 8, disk_gb: 100 }, "us", { dedicated_only: true }), "aws-ec2");
  const fast = byId(compare(pricing, { vcpu: 2, memory_gb: 8, disk_gb: 100 }, "us", { dedicated_only: true, fast_disk: true }), "aws-ec2");
  const p = provider("aws-ec2").disks.gp3.provision;
  close(fast.total - plain.total, 7000 * p.per_iops_month.us + 125 * p.per_mbps_month.us);
});

test("Hetzner is left out of the UK, and the recent-processor option leaves out providers that do not name their processors", () => {
  const uk = compare(pricing, { vcpu: 2, memory_gb: 4, disk_gb: 50 }, "uk", {});
  assert.ok(uk.excluded.some((q) => q.provider.id === "hetzner"));
  const recent = compare(pricing, { vcpu: 2, memory_gb: 4, disk_gb: 50 }, "us", { recent_cpu: true });
  for (const q of recent.ranked) assert.ok(q.best.family.cpu_launch_year >= pricing.recent_cpu_since);
  assert.ok(recent.excluded.some((q) => q.provider.id === "ovhcloud"));
});
