# What you actually pay for in cloud storage

Object storage — the S3-style buckets behind most apps, backups and websites — looks like one product with one price. It isn't. Every provider charges the same handful of meters at very different rates, and the "cheap" provider depends entirely on which meter your workload spins.

The six compared here: **AWS S3**, **Azure Blob Storage**, **Google Cloud Storage (GCS)**, **Cloudflare R2**, **Backblaze B2**, **Wasabi**. Full numbers, sources and caveats: [pricing.json](pricing.json). Prices verified 10 Oct 2026.

## 1. Storing data — the rent

You pay per GB per month, like rent on the bytes. Most providers offer several "classes": think of **hot** as your desk, **infrequent** as the cupboard, and **archive** as a self-storage unit across town — the rent drops at each step, but getting things back gets slower and more expensive.

Hot storage runs from **$0.007/GB (B2)** to **$0.024/GB (S3 London)** — a 3× spread for the same job. B2 and Wasabi skip the class system entirely: one flat rate ($6.95 and $7.99 per TB) for everything. Archive tiers drop to around $0.001/GB, which is roughly $1 per TB per month.

## 2. Getting data out (egress) — the one that surprises people

Uploading is free everywhere. *Downloading* your own data back over the internet is where the big three make their money: roughly **$0.09–0.12 per GB** after a free 100 GB each month. That's $90+ to move 1 TB out.

This is the measure where providers genuinely differ in kind, not just degree: **R2 charges nothing, ever**; **B2 is free up to 3× what you store** (and unlimited through partner CDNs like Cloudflare and bunny.net); **Wasabi charges nothing but applies a fair-use rule** — monthly downloads shouldn't exceed what you store, enforced by suspension rather than a bill. If you serve a lot of traffic, this single line usually decides the bill — storing 1 TB and serving 1 TB/month costs about **$7 on B2, $8 on Wasabi, $15 on R2, and $100–130 on AWS/Azure/GCS**.

## 3. API requests — pennies, until they aren't

Every upload, download or list is an API call, and most providers charge per thousand. Writes cost ~10× reads (about $5 vs $0.40 per million on hot tiers). B2 and Wasabi don't charge for API calls at all (Wasabi under fair use); R2 is slightly cheaper than the big three, which are nearly identical.

This rounds to zero for most workloads — but if you have millions of small files (think photo thumbnails or IoT logs), request fees can quietly beat your storage bill.

## 4. Retrieval fees — the cold-storage tax

Cool and archive classes charge a per-GB fee just to *read* your data, **on top of egress**. It's $0.01/GB on infrequent tiers, rising to $0.05/GB on GCS Archive. True archive tiers (S3 Glacier Flexible/Deep Archive, Azure Archive) are also *offline*: you request a restore and wait hours — 3 to 15 hours typically — and pay restore request fees too. GCS Archive is the odd one out: archive-priced but instantly readable.

Rule of thumb: archive tiers are for data you'll probably *never* read. If you'll read it yearly or more, a cold-but-online tier is usually cheaper overall.

## 5. Minimum storage duration — the early-checkout fee

Cheap tiers bill a minimum stay even if you delete early: 30 days (infrequent), 90 days (cold), 180 days (archive), and a full **365 days for GCS Archive**. Delete a file after a week and you still pay the rest. Wasabi applies a 90-day minimum to *everything* (its flat rate is the trade), and also bills at least 1 TB a month however little you store. B2 is the only provider with no minimums anywhere.

This is what makes cold tiers wrong for churning data like rolling backups that rotate monthly.

## 6. Minimum object size — the small-files trap

S3's infrequent and cold classes bill every object as if it were at least **128 KB**, so a million 4 KB files are charged as 32× their real size. Azure has announced a similar 128 KiB minimum for its cool tiers from mid-2026. Lots of tiny files → stay on hot/standard tiers (or bundle files together).

## 7. Region — US vs UK

AWS and GCS charge **more in London** than in their US regions — a few percent on hot storage, but up to ~2× on the coldest tiers (S3 Deep Archive: $0.00099 US vs $0.0018 UK). Azure bucks the trend: UK South Hot and Cool are *cheaper* than East US. GCS quietly gives UK buckets no free egress (its 100 GB/month allowance is US-only, and EU buckets miss out too). **R2, B2 and Wasabi have one global price** — and Wasabi is the only flat-rate provider with actual UK datacentres (two, including London); B2's nearest region is the Netherlands, worth knowing if data residency matters.

The **EU is the friendliest region**: AWS Ireland and GCS Belgium match their US prices exactly, Azure West Europe sits between its US and UK rates, every provider has local datacentres there (B2 included, via Amsterdam), and it's the one place Cloudflare R2 offers a hard residency guarantee (its EU jurisdiction setting).

## 8. Free allowances

R2: 10 GB + generous free requests, and free egress always. B2: 10 GB + free API calls. GCS: 5 GB + some ops, US buckets only. Azure: 100 GB egress always; a 12-month starter bundle. AWS: 100 GB egress; otherwise just signup credits. Wasabi: a time-limited trial only — and remember its 1 TB monthly billing floor cuts the other way.

## 9. Redundancy — how many copies the rent buys

A price per GB means little until you know how many copies it includes. S3 and GCS replicate every object across at least three zones at list price. Azure's cheapest prices (the ones everywhere above) are LRS — one datacentre; zone-redundant ZRS costs roughly 10–30% more and isn't offered for the Archive tier at all. The flat-rate providers don't publish a multi-zone model. So a bare S3-vs-Azure price comparison quietly flatters Azure — worth knowing before you call it cheaper.

---

### The honest summary

- **Serving files to the internet** → R2 or B2 (egress is the killer; Wasabi's fair-use rule caps serving at 1× what you store).
- **Bulk storage with UK residency on a flat rate** → Wasabi (London region, $7.99/TB) — if you can live with the 90-day minimum and 1 TB floor.
- **Deep archive you'll never touch** → S3 Deep Archive or Azure Archive (~$1/TB-month) — in a **US** region if you can; UK archive costs ~2×.
- **Already inside one cloud** → staying with that cloud's storage avoids cross-cloud egress on every read, which usually outweighs the price differences above.
- **Simplest bill** → B2: one class, no request fees, no minimums, no retrieval fees.

*Everything above is list pricing — single region, standard redundancy, no committed-use discounts, excluding VAT. Estimates, not quotes: check the provider's own calculator before committing.*
