# Cloud compute cost comparison

A calculator that estimates the monthly bill for one Linux virtual server across seven providers and ranks them cheapest first. For each provider it finds the cheapest server with at least the vCPUs and memory asked for, then adds the disk.

| File | Purpose |
|---|---|
| `pricing.json` | Price data in USD for AWS EC2, Azure Virtual Machines, Google Compute Engine, DigitalOcean, Hetzner, OVHcloud and Akamai (Linode) |
| `widget/cloud-compute-compare.js` | The `<cloud-compute-compare>` element |
| `widget/calc.js` | The calculation: a pure module with no DOM access |
| `widget/calc.test.js` | Tests for the calculation, including checks against `pricing.json` |
| `widget/demo.html` | A demo page that hosts the widget and explains its options |

## Embedding

With plain HTML, serve the files from your own site and add:

```html
<script type="module" src="widget/cloud-compute-compare.js"></script>
<cloud-compute-compare src="pricing.json" region="uk"></cloud-compute-compare>
```

With a bundler, install the package and import the widget. This example uses Vite's `?url` suffix to get the address of the data file:

```js
import 'cloud-compare/compute';
import pricingUrl from 'cloud-compare/compute/pricing.json?url';
```

| Attribute | Value |
|---|---|
| `src` | URL of `pricing.json` |
| `region` | `us` (the default), `uk` or `eu` |
| `theme` | `light` or `dark`; by default the widget follows the reader's system setting |
| `guide-base` | URL of the page that explains the options; see below |

The help panels in the widget end in a "More" link. Each one points at `guide-base` plus one of these anchors: `#g-vcpu`, `#g-memory`, `#g-disk`, `#g-shared`, `#g-generation`, `#g-arm`, `#g-fastdisk`. Leave `guide-base` out when the explanations are on the same page as the widget, as they are in `widget/demo.html`.

Colours are themed the same way as the storage widget, through the `--ccc-*` custom properties.

## What is compared

- General-purpose virtual servers from 1 to 64 vCPUs: each provider's shared or burstable line and its general, compute and memory lines, in the newest two generations it sells.
- Three locations per provider: a main US region, a UK region where there is one, and a main EU region. `pricing.json` names the region used for each.
- Linux, pay-as-you-go list prices for a server that runs all month.

## Options

| Option | What it does |
|---|---|
| Dedicated CPU only | Leaves out burstable, shared-CPU and AWS flex servers |
| Recent processors only | Keeps servers whose documented processor generation launched in `recent_cpu_since` or later; plans with no documented processor are left out |
| Allow Arm processors | Adds Arm servers, which are left out by default because software has to be built for them |
| High-performance disk | Prices a disk that delivers `performance_target`, using each provider's cheapest way to reach it |

## What the estimate simplifies

- The cheapest server with at least the vCPUs and memory asked for is chosen, so some providers are shown with more capacity than requested.
- A month is 730 hours. Where a provider has a monthly price or cap, the lower of that and the hourly price for the month is used.
- Disk included with a plan is used first. With the high-performance option it is counted as it is, because providers do not publish guaranteed figures for local disks.
- Data transfer, public IP addresses, backups, licences and discounts are not included. That leaves out Google's automatic sustained use discount on its N2 and N2D series.

## Updating prices

`normalization_notes` in `pricing.json` explains each field. When a price changes, edit the instance or disk entry, update `last_verified`, and run the tests:

```bash
node --test compute/widget/calc.test.js
```
