/**
 * <cloud-compute-compare>: embeddable cloud server cost comparison widget.
 *
 * Usage:
 *   <script type="module" src="cloud-compute-compare.js"></script>
 *   <cloud-compute-compare src="pricing.json" region="us"></cloud-compute-compare>
 *
 * Attributes: src (pricing.json URL), region ("us" | "uk" | "eu"), theme ("light" | "dark",
 * optional override), guide-base (URL prefix for the helper "More →" links).
 * Theming: override --ccc-* custom properties on the host page.
 */
import { compare } from "./calc.js";

const LIGHT = `
  --bg: var(--ccc-surface, #fcfcfb); --ink: var(--ccc-ink, #0b0b0b);
  --ink-2: var(--ccc-ink-2, #52514e); --muted: var(--ccc-muted, #898781);
  --line: var(--ccc-line, #e1e0d9); --border: var(--ccc-border, rgba(11,11,11,.10));
  --accent: var(--ccc-accent, #2a78d6); --link: var(--ccc-link, #1c5cab);
  --warn: var(--ccc-warn, #fab219); --warn-ink: var(--ccc-warn-ink, #7a5200);
  --wash: var(--ccc-wash, rgba(11,11,11,.04));`;
const DARK = `
  --bg: var(--ccc-surface, #1a1a19); --ink: var(--ccc-ink, #f0efec);
  --ink-2: var(--ccc-ink-2, #c3c2b7); --muted: var(--ccc-muted, #898781);
  --line: var(--ccc-line, #2c2c2a); --border: var(--ccc-border, rgba(255,255,255,.10));
  --accent: var(--ccc-accent, #3987e5); --link: var(--ccc-link, #86b6ef);
  --warn: var(--ccc-warn, #fab219); --warn-ink: var(--ccc-warn-ink, #fab219);
  --wash: var(--ccc-wash, rgba(255,255,255,.05));`;

// Slider positions map onto the sizes providers actually sell.
const VCPUS = [1, 2, 4, 8, 16, 32, 48, 64];
const MEMORY_GB = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const DISK_GB = [0, 10, 25, 50, 100, 250, 500, 1000, 2000];

const TEMPLATE = `
<style>
:host { display: block; ${LIGHT} }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${DARK} } }
:host([theme="dark"]) { ${DARK} }

.card {
  background: var(--bg); color: var(--ink); border: 1px solid var(--border);
  border-radius: 12px; padding: clamp(18px, 4vw, 28px); min-width: 0;
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.head { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin-bottom: 20px; }
.head h2 { font-size: 1.25rem; margin: 0; letter-spacing: -.01em; }
.sub { color: var(--ink-2); margin: 4px 0 0; font-size: .9rem; }

.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg label { position: relative; }
.seg input { position: absolute; opacity: 0; inset: 0; }
.seg span { display: inline-block; padding: 5px 14px; font-size: .85rem; color: var(--ink-2); cursor: pointer; user-select: none; }
.seg label + label span { border-left: 1px solid var(--line); }
.seg input:checked + span { background: var(--accent); color: #fff; }
.seg input:focus-visible + span { outline: 2px solid var(--link); outline-offset: -2px; }

.controls { display: grid; gap: 16px; }
.ctl { min-width: 0; }
.ctl-top { display: flex; align-items: baseline; gap: 8px; }
.ctl-top label { font-weight: 600; font-size: .9rem; }
.val { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ink-2); font-size: .9rem; }
.info { border: 1px solid var(--line); background: none; color: var(--muted); border-radius: 50%; width: 18px; height: 18px; line-height: 1; font-size: .7rem; cursor: pointer; flex: none; align-self: center; }
.info:focus-visible { outline: 2px solid var(--link); outline-offset: 1px; }
.help { font-size: .85rem; color: var(--ink-2); background: var(--wash); border-radius: 8px; padding: 8px 12px; margin-top: 6px; }
.help a { color: var(--link); }
[hidden] { display: none !important; }
input[type="range"] { width: 100%; accent-color: var(--accent); margin: 6px 0 0; }
input[type="range"]:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; }

.results { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 18px; }
.results h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 12px; font-weight: 600; }
.rows { display: grid; gap: 6px; }
details.row > summary { list-style: none; cursor: pointer; padding: 8px 10px; border-radius: 8px; }
details.row > summary::-webkit-details-marker { display: none; }
details.row > summary:hover { background: var(--wash); }
details.row > summary:focus-visible { outline: 2px solid var(--link); }
.rowtop { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
.pname { font-weight: 600; font-size: .95rem; }
.cost { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; }
.bar { margin-top: 5px; height: 10px; }
.bar b { display: block; height: 100%; background: var(--accent); border-radius: 0 4px 4px 0; min-width: 3px; transition: width .25s ease; }
@media (prefers-reduced-motion: reduce) { .bar b { transition: none; } }
.chk { font-weight: 600; font-size: .9rem; display: inline-flex; gap: 8px; align-items: center; cursor: pointer; }
.chk input { accent-color: var(--accent); margin: 0; }
.chip { font-size: .7rem; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-2); white-space: nowrap; }
.chip.warn { border-color: transparent; background: color-mix(in srgb, var(--warn) 22%, transparent); color: var(--warn-ink); font-weight: 600; }
.chip.cls { border-color: var(--accent); color: var(--link); }
.bd { padding: 6px 10px 12px; font-size: .85rem; color: var(--ink-2); }
.bd table { border-collapse: collapse; }
.bd td { padding: 1px 0; }
.bd td + td { padding-left: 18px; text-align: right; font-variant-numeric: tabular-nums; }
.bd .note { margin: 8px 0 0; }
.bd a { color: var(--link); }
.drop { font-size: .8rem; color: var(--muted); margin: 8px 2px 0; }
.foot { margin-top: 20px; border-top: 1px solid var(--line); padding-top: 12px; font-size: .78rem; color: var(--muted); }
</style>

<div class="card">
  <div class="head">
    <div>
      <h2>What would your server cost?</h2>
      <p class="sub">Monthly estimate for one Linux virtual server, running all month.</p>
    </div>
    <div class="seg" role="radiogroup" aria-label="Region">
      <label><input type="radio" name="region" id="r-us" value="us" checked><span>US</span></label>
      <label><input type="radio" name="region" id="r-uk" value="uk"><span>UK</span></label>
      <label><input type="radio" name="region" id="r-eu" value="eu"><span>EU</span></label>
    </div>
  </div>

  <div class="controls">
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-vcpu">vCPUs</label>
        <button class="info" type="button" data-help="h-vcpu" aria-label="About vCPUs">i</button>
        <output class="val" id="v-vcpu"></output>
      </div>
      <input type="range" id="in-vcpu" min="0" max="${VCPUS.length - 1}" step="1" value="1">
      <div class="help" id="h-vcpu" hidden>The number of virtual processors. On most x86 servers a vCPU is one thread of a core, so two vCPUs are one physical core. On Arm servers a vCPU is a whole core. <a data-g="g-vcpu">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-memory">Memory</label>
        <button class="info" type="button" data-help="h-memory" aria-label="About memory">i</button>
        <output class="val" id="v-memory"></output>
      </div>
      <input type="range" id="in-memory" min="0" max="${MEMORY_GB.length - 1}" step="1" value="3">
      <div class="help" id="h-memory" hidden>RAM in GB. Providers sell fixed shapes, usually 2, 4 or 8 GB per vCPU, so a lot of memory with few vCPUs means a memory-optimised server or a larger one than you asked for. <a data-g="g-memory">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-disk">Disk</label>
        <button class="info" type="button" data-help="h-disk" aria-label="About disk">i</button>
        <output class="val" id="v-disk"></output>
      </div>
      <input type="range" id="in-disk" min="0" max="${DISK_GB.length - 1}" step="1" value="4">
      <div class="help" id="h-disk" hidden>SSD storage attached to the server, priced per GB a month. Some providers include a disk with each plan; that is used first and only the rest is charged. <a data-g="g-disk">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-dedicated"><input type="checkbox" id="in-dedicated"> Dedicated CPU only</label>
        <button class="info" type="button" data-help="h-dedicated" aria-label="About dedicated CPU">i</button>
      </div>
      <div class="help" id="h-dedicated" hidden>Excludes burstable and shared-CPU servers. Those cost less because the processor is shared or rationed by credits, which suits small or occasional workloads but not sustained load. <a data-g="g-shared">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-recent"><input type="checkbox" id="in-recent"> Recent processors only</label>
        <button class="info" type="button" data-help="h-recent" aria-label="About processor generations">i</button>
      </div>
      <div class="help" id="h-recent" hidden><span id="t-recent"></span> <a data-g="g-generation">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-arm"><input type="checkbox" id="in-arm"> Allow Arm processors</label>
        <button class="info" type="button" data-help="h-arm" aria-label="About Arm processors">i</button>
      </div>
      <div class="help" id="h-arm" hidden>Includes servers with Arm processors. They usually cost less for the same size, but your software has to be available for Arm. <a data-g="g-arm">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-fastdisk"><input type="checkbox" id="in-fastdisk"> High-performance disk</label>
        <button class="info" type="button" data-help="h-fastdisk" aria-label="About high-performance disk">i</button>
      </div>
      <div class="help" id="h-fastdisk" hidden><span id="t-fastdisk"></span> <a data-g="g-fastdisk">More →</a></div>
    </div>
  </div>

  <div class="results">
    <h3>Estimated monthly bill, cheapest first</h3>
    <div class="rows" id="rows"><p class="drop">Loading prices…</p></div>
    <p class="foot" id="foot"></p>
  </div>
</div>`;

// What each kind of less-than-dedicated processor means, shown when a row uses one.
const SHARE_NOTES = {
  burstable: "Burstable CPU: the price covers a baseline share of the processor. Sustained use above it is slowed down or billed extra.",
  shared: "Shared CPU: processor time is shared with other customers, so performance can vary.",
  flex: "Flex CPU: AWS delivers full processor performance at least 95% of the time."
};

const money = (n) => n >= 1000 ? "$" + Math.round(n).toLocaleString("en-US") : "$" + n.toFixed(2);
const fmtDisk = (gb) => gb === 0 ? "none" : gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`;
const shape = (i) => `${i.vcpu} vCPU, ${i.memory_gb} GB`;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

class CloudComputeCompare extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pricing = null;
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this.shadowRoot.innerHTML = TEMPLATE;
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._$ = $;

    const reg = this.getAttribute("region");
    if (reg === "uk" || reg === "eu") { $("r-us").checked = false; $("r-" + reg).checked = true; }
    const base = this.getAttribute("guide-base") || "";
    this.shadowRoot.querySelectorAll("a[data-g]").forEach(a => { a.href = base + "#" + a.dataset.g; });

    this.shadowRoot.querySelectorAll("input").forEach(el => el.addEventListener("input", () => this._render()));
    this.shadowRoot.querySelectorAll(".info").forEach(btn => btn.addEventListener("click", () => {
      const panel = $(btn.dataset.help);
      panel.hidden = !panel.hidden;
    }));

    const src = this.getAttribute("src");
    if (src && !this._pricing) {
      fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => { this.pricing = data; })
        .catch(() => { $("rows").innerHTML = `<p class="drop">Couldn’t load pricing data.</p>`; });
    }
    this._render();
  }

  set pricing(data) { this._pricing = data; if (this._wired) this._render(); }
  get pricing() { return this._pricing; }

  _badges(q, spec) {
    const b = [{ t: q.best.instance.name, cls: true }];
    const f = q.best.family;
    if (f.cpu_share) b.push({ t: `${f.cpu_share} CPU` });
    if (f.arch === "arm") b.push({ t: "Arm" });
    if (f.cpu_launch_year) b.push({ t: `${f.cpu_launch_year} processor` });
    if (q.best.instance.vcpu > spec.vcpu || q.best.instance.memory_gb > spec.memory_gb) b.push({ t: shape(q.best.instance) });
    if (q.noFastDisk) b.push({ t: q.provider.disk_limit_note || "no high-performance disk", warn: true });
    return b;
  }

  /** The lines under a row's price table: where, what processor, and what to know about the price. */
  _notes(q, region, opts) {
    const f = q.best.family;
    const notes = [`Location: ${q.provider.regions[region].label}.`];
    notes.push(`Processor: ${f.cpu || "not published by the provider"}${f.cpu_launch_year ? `, launched ${f.cpu_launch_year}` : ""}.`);
    if (f.cpu_share) notes.push(SHARE_NOTES[f.cpu_share]);
    if (f.note) notes.push(f.note);
    if (q.best.diskSized === "tier") notes.push(`This disk is sold in fixed sizes, so ${fmtDisk(q.best.billedGB)} is billed.`);
    if (q.best.diskSized === "performance") notes.push(`A ${fmtDisk(q.best.billedGB)} disk is needed to reach the performance asked for, so that size is billed.`);
    if (opts.fast_disk && !q.noFastDisk && q.provider.fast_disk_caveat) notes.push(q.provider.fast_disk_caveat);
    if (q.provider.price_note) notes.push(q.provider.price_note);
    return notes;
  }

  _render() {
    if (!this._pricing) return;
    const $ = this._$;
    const region = this.shadowRoot.querySelector('input[name="region"]:checked').value;
    const spec = {
      vcpu: VCPUS[+$("in-vcpu").value],
      memory_gb: MEMORY_GB[+$("in-memory").value],
      disk_gb: DISK_GB[+$("in-disk").value]
    };
    $("v-vcpu").textContent = `${spec.vcpu}`;
    $("v-memory").textContent = `${spec.memory_gb} GB`;
    $("v-disk").textContent = fmtDisk(spec.disk_gb);

    const target = this._pricing.performance_target;
    $("t-fastdisk").textContent = `Prices a disk that delivers ${target.iops.toLocaleString("en-US")} IOPS and ${target.throughput_mbps} MB/s, using each provider's cheapest way to reach that. Some sell the performance separately and some need a larger disk. Providers whose disks cannot reach it keep their standard disk and are marked.`;
    $("t-recent").textContent = `Keeps only servers whose processor generation launched in ${this._pricing.recent_cpu_since} or later, according to the provider. Plans whose processor the provider does not name are left out.`;

    const open = new Set([...this.shadowRoot.querySelectorAll("details.row[open]")].map(d => d.dataset.id));
    const opts = {
      dedicated_only: $("in-dedicated").checked, recent_cpu: $("in-recent").checked,
      allow_arm: $("in-arm").checked, fast_disk: $("in-fastdisk").checked
    };
    const { ranked, excluded } = compare(this._pricing, spec, region, opts);
    const max = Math.max(...ranked.map(q => q.total), 0.01);

    $("rows").innerHTML = ranked.map(q => {
      const badges = this._badges(q, spec);
      const best = q.best;
      const diskLine = spec.disk_gb === 0 ? "" : best.extraGB === 0
        ? `<tr><td>Disk (${fmtDisk(best.includedGB)} included with the plan)</td><td>${money(0)}</td></tr>`
        : `<tr><td>Disk (${escapeHtml(best.diskLabel)}, ${fmtDisk(best.extraGB)}${best.includedGB ? `, plus ${fmtDisk(best.includedGB)} included` : ""})</td><td>${money(best.disk)}</td></tr>`;
      return `
      <details class="row" data-id="${q.provider.id}" ${open.has(q.provider.id) ? "open" : ""}>
        <summary>
          <div class="rowtop">
            <span class="pname">${escapeHtml(q.provider.name)}</span>
            ${badges.map(b => `<span class="chip${b.warn ? " warn" : ""}${b.cls ? " cls" : ""}">${escapeHtml(b.t)}</span>`).join("")}
            <span class="cost">${money(q.total)}</span>
          </div>
          <div class="bar"><b style="width:${Math.max(1.5, (q.total / max) * 100)}%"></b></div>
        </summary>
        <div class="bd">
          <table>
            <tr><td>Server (${escapeHtml(best.instance.name)}: ${shape(best.instance)})</td><td>${money(best.compute)}</td></tr>
            ${diskLine}
          </table>
          ${q.others.length ? `<p class="note">Next cheapest: ${q.others.map(o => `${escapeHtml(o.instance.name)} (${shape(o.instance)}) ${money(o.total)}`).join(" · ")}</p>` : ""}
          ${this._notes(q, region, opts).map(n => `<p class="note">${escapeHtml(n)}</p>`).join("")}
          <p class="note"><a href="${q.provider.pricing_url}" target="_blank" rel="noopener">Official pricing ↗</a></p>
        </div>
      </details>`;
    }).join("")
    + excluded.map(q => `<p class="drop">Not shown in ${region.toUpperCase()}: ${escapeHtml(q.provider.name)}, ${escapeHtml(q.reason)}.</p>`).join("");

    $("foot").textContent = `Each provider is shown at its cheapest server with at least the vCPUs and memory asked for, so some rows are larger than requested. Expand a row for the processor and the next cheapest options. List prices verified ${this._pricing.last_verified}. These are estimates, not quotes, so check each provider before committing. Simplified: Linux, pay-as-you-go, one server running all month; data transfer, IP addresses, backups and discounts are not included.`;
  }
}

customElements.define("cloud-compute-compare", CloudComputeCompare);
