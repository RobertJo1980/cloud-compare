# Cloud storage cost comparison

A calculator that estimates the monthly bill for an object storage workload across six providers and ranks them cheapest first. For each provider it prices every storage class and shows the cheapest one for the workload entered.

| File | Purpose |
|---|---|
| `pricing.json` | Price data in USD for AWS S3, Azure Blob Storage, Google Cloud Storage, Cloudflare R2, Backblaze B2 and Wasabi |
| `widget/cloud-cost-compare.js` | The `<cloud-cost-compare>` element |
| `widget/calc.js` | The calculation: a pure module with no DOM access |
| `widget/demo.html` | A demo page that hosts the widget |
| `guide.md` | Plain-language guide to what a cloud storage bill is made of |

## Embedding

With plain HTML, serve the files from your own site and add:

```html
<script type="module" src="widget/cloud-cost-compare.js"></script>
<cloud-cost-compare src="pricing.json" region="uk"></cloud-cost-compare>
```

With a bundler, install the package and import the widget. This example uses Vite's `?url` suffix to get the address of the data file:

```js
import 'cloud-compare/storage';
import pricingUrl from 'cloud-compare/storage/pricing.json?url';
```

| Attribute | Value |
|---|---|
| `src` | URL of `pricing.json` |
| `region` | `us` (the default), `uk` or `eu` |
| `theme` | `light` or `dark`; by default the widget follows the reader's system setting |
| `guide-base` | URL of the page that explains the meters; see below |

The help panels in the widget end in a "More" link. Each one points at `guide-base` plus one of these anchors: `#g-stored`, `#g-egress`, `#g-requests`, `#g-retrieval`, `#g-redundancy`. Leave `guide-base` out when the explanations are on the same page as the widget, as they are in `widget/demo.html`.

## Theming

The widget renders in a shadow root, so page styles do not leak into it. To change its colours, set any of these custom properties on the host page: `--ccc-surface`, `--ccc-ink`, `--ccc-ink-2`, `--ccc-muted`, `--ccc-line`, `--ccc-border`, `--ccc-accent`, `--ccc-link`, `--ccc-warn`, `--ccc-warn-ink`, `--ccc-wash`.

## What the estimate simplifies

- Egress tiers apply to the paid volume after the free allowance.
- Retrieval fees are charged on the full downloaded volume for classes that have them.
- Monthly free tiers are not modelled.
- Minimum storage durations are shown as badges, not costs; objects are assumed to live them out.
