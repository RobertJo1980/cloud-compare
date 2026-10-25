/**
 * <cloud-cost-compare>: embeddable cloud storage cost comparison widget.
 *
 * Usage:
 *   <script type="module" src="cloud-cost-compare.js"></script>
 *   <cloud-cost-compare src="pricing.json" region="us"></cloud-cost-compare>
 *
 * Attributes: src (pricing.json URL), region ("us" | "uk"), theme ("light" | "dark",
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
      <h2>What would your storage cost?</h2>
      <p class="sub">Monthly estimate across the major object-storage providers.</p>
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
        <label for="in-stored">Data stored</label>
        <button class="info" type="button" data-help="h-stored" aria-label="About data stored">i</button>
        <output class="val" id="v-stored"></output>
      </div>
      <input type="range" id="in-stored" min="0" max="1000" value="500">
      <div class="help" id="h-stored" hidden>Average data sitting in the bucket over the month: the “rent” meter, priced per GB. <a data-g="g-stored">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-egress">Data downloaded</label>
        <button class="info" type="button" data-help="h-egress" aria-label="About downloads">i</button>
        <output class="val" id="v-egress"></output>
      </div>
      <input type="range" id="in-egress" min="0" max="1000" value="333">
      <div class="help" id="h-egress" hidden>The volume of data going out to the internet (“egress”), in GB. The big three charge ~$0.09–0.12/GB after a free allowance; R2, B2 and Wasabi don’t charge for it. The <em>number</em> of fetches is the “Reads” slider. <a data-g="g-egress">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-writes">Writes</label>
        <button class="info" type="button" data-help="h-writes" aria-label="About writes">i</button>
        <output class="val" id="v-writes"></output>
      </div>
      <input type="range" id="in-writes" min="0" max="1000" value="625">
      <div class="help" id="h-writes" hidden>API calls that put data in: uploads, copies, lists (PUT-type / Class A). Priced per 1,000. <a data-g="g-requests">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label for="in-reads">Reads</label>
        <button class="info" type="button" data-help="h-reads" aria-label="About reads">i</button>
        <output class="val" id="v-reads"></output>
      </div>
      <input type="range" id="in-reads" min="0" max="1000" value="750">
      <div class="help" id="h-reads" hidden>API calls that fetch data: downloads and metadata checks (GET-type / Class B). This is the <em>count</em> of requests, not the bytes (that’s “Data downloaded”). Roughly 10× cheaper than writes. <a data-g="g-requests">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-instant"><input type="checkbox" id="in-instant"> Instant access only</label>
        <button class="info" type="button" data-help="h-instant" aria-label="About instant access">i</button>
      </div>
      <div class="help" id="h-instant" hidden>Excludes offline archive tiers (S3 Glacier Flexible / Deep Archive, Azure Archive) where restores take hours. Leave off if your data can wait. <a data-g="g-retrieval">More →</a></div>
    </div>
    <div class="ctl">
      <div class="ctl-top">
        <label class="chk" for="in-zrs"><input type="checkbox" id="in-zrs"> Zone-redundant</label>
        <button class="info" type="button" data-help="h-zrs" aria-label="About zone redundancy">i</button>
      </div>
      <div class="help" id="h-zrs" hidden>Requires copies in multiple availability zones. AWS and Google include this at list price; Azure switches to its ZRS rates (and loses its Archive tier); R2, B2 and Wasabi publish no multi-zone guarantee, so they keep their price and get a badge. <a data-g="g-redundancy">More →</a></div>
    </div>
  </div>

  <div class="results">
    <h3>Estimated monthly bill, cheapest first</h3>
    <div class="rows" id="rows"><p class="drop">Loading prices…</p></div>
    <p class="foot" id="foot"></p>
  </div>
</div>`;

const sliderGB = (v) => v === 0 ? 0 : Math.pow(10, (v / 1000) * 6);   // 1 GB .. 1 PB
const sliderOps = (v) => v === 0 ? 0 : Math.pow(10, (v / 1000) * 8);  // 1 .. 100M
const round3 = (n) => Number(n.toPrecision(3));
const fmtGB = (gb) => gb === 0 ? "0 GB" : gb < 1000 ? `${round3(gb)} GB` : gb < 1e6 ? `${round3(gb / 1000)} TB` : "1 PB";
const fmtOps = (n) => n === 0 ? "0" : n < 1000 ? `${Math.round(n)}` : n < 1e6 ? `${round3(n / 1000)}k` : `${round3(n / 1e6)}M`;
const money = (n) => n >= 1000 ? "$" + Math.round(n).toLocaleString("en-US") : "$" + n.toFixed(2);

class CloudCostCompare extends HTMLElement {
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

  _badges(q, multiZone) {
    const b = [];
    if (q.provider.classes.length > 1) b.push({ t: q.best.cls.label, cls: true });
    if (q.best.cls.min_duration_days) b.push({ t: `${q.best.cls.min_duration_days}-day min` });
    if (q.best.cls.offline) b.push({ t: `offline · ${q.best.cls.restore}` });
    if (q.best.floored) b.push({ t: `${Math.round(q.provider.monthly_minimum.amount / 1000)} TB minimum applied` });
    if (q.presence === "hint") b.push({ t: "residency not guaranteed" });
    if (multiZone && q.provider.multi_zone && q.provider.multi_zone.status === "unpublished") b.push({ t: "multi-zone not guaranteed" });
    if (q.best.fairUse) b.unshift({ t: "⚠ fair-use exceeded", warn: true });
    return b;
  }

  _render() {
    if (!this._pricing) return;
    const $ = this._$;
    const region = this.shadowRoot.querySelector('input[name="region"]:checked').value;
    const w = {
      stored_gb: sliderGB(+$("in-stored").value),
      egress_gb: sliderGB(+$("in-egress").value),
      writes: sliderOps(+$("in-writes").value),
      reads: sliderOps(+$("in-reads").value)
    };
    $("v-stored").textContent = fmtGB(w.stored_gb);
    $("v-egress").textContent = fmtGB(w.egress_gb) + "/mo";
    $("v-writes").textContent = fmtOps(w.writes) + "/mo";
    $("v-reads").textContent = fmtOps(w.reads) + "/mo";

    const open = new Set([...this.shadowRoot.querySelectorAll("details.row[open]")].map(d => d.dataset.id));
    const opts = { instant_only: $("in-instant").checked, multi_zone: $("in-zrs").checked };
    const { ranked, excluded } = compare(this._pricing, w, region, opts);
    const max = Math.max(...ranked.map(q => q.total), 0.01);

    $("rows").innerHTML = ranked.map(q => {
      const badges = this._badges(q, opts.multi_zone);
      const note = q.presence === "hint" && q.provider.residency_notes && q.provider.residency_notes[region];
      return `
      <details class="row" data-id="${q.provider.id}" ${open.has(q.provider.id) ? "open" : ""}>
        <summary>
          <div class="rowtop">
            <span class="pname">${q.provider.name}</span>
            ${badges.map(b => `<span class="chip${b.warn ? " warn" : ""}${b.cls ? " cls" : ""}">${b.t}</span>`).join("")}
            <span class="cost">${money(q.total)}</span>
          </div>
          <div class="bar"><b style="width:${Math.max(1.5, (q.total / max) * 100)}%"></b></div>
        </summary>
        <div class="bd">
          <table>
            <tr><td>Storage (${q.best.cls.label})</td><td>${money(q.best.storage)}</td></tr>
            <tr><td>Egress</td><td>${money(q.best.egress)}</td></tr>
            <tr><td>Requests</td><td>${money(q.best.requests)}</td></tr>
            ${q.best.retrieval ? `<tr><td>Retrieval</td><td>${money(q.best.retrieval)}</td></tr>` : ""}
          </table>
          ${q.all.length > 1 ? `<p class="note">All classes: ${q.all.map(a =>
            a === q.best ? `<strong>${a.cls.label} ${money(a.total)} ✓</strong>` : `${a.cls.label} ${money(a.total)}`
          ).join(" · ")}</p>` : ""}
          ${q.best.fairUse ? `<p class="note">⚠ ${q.provider.egress.free.note}</p>` : ""}
          ${note ? `<p class="note">${note}</p>` : ""}
          <p class="note"><a href="${q.provider.pricing_url}" target="_blank" rel="noopener">Official pricing ↗</a></p>
        </div>
      </details>`;
    }).join("")
    + excluded.map(q => `<p class="drop">Not shown in ${region.toUpperCase()}: ${q.provider.name}, ${q.reason}.</p>`).join("");

    $("foot").textContent = `Each provider is shown at its cheapest storage class for this workload. Expand a row to see all its classes. List prices verified ${this._pricing.last_verified}. These are estimates, not quotes, so check each provider before committing. Simplified: first-tier egress rates, monthly free tiers not modelled, retrieval assumed equal to downloads, archive restore-request fees ignored.`;
  }
}

customElements.define("cloud-cost-compare", CloudCostCompare);
