# cloud-compare

Small, embeddable tools for comparing what cloud providers charge. Each tool is a framework-free web component with its pricing data kept alongside it, so the numbers can be checked and corrected in one place.

See one running in [What's the Best Value Cloud Storage?](https://blog.rj.ms/blog/cloud-storage-best-value/) on Robert Johnstone's blog.

## Tools

| Folder | What it compares |
|---|---|
| [`storage/`](storage/) | Object storage costs across AWS S3, Azure Blob Storage, Google Cloud Storage, Cloudflare R2, Backblaze B2 and Wasabi, in US, UK and EU regions |

## Layout

Every tool has its own folder with the same shape:

```text
<tool>/
  README.md       how to use and embed the tool
  pricing.json    the price data, with a link to each provider's pricing page and a last_verified date
  widget/         the web component, its calculation module and a demo page
```

## Trying a tool locally

The demo pages load ES modules and fetch JSON, so they have to be served over HTTP; opening the file directly does not work. Serve the repo root with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/storage/widget/demo.html>.

## Using a tool on your own site

Install a tagged version straight from GitHub:

```bash
npm install github:RobertJo1980/cloud-compare#v0.1.2
```

Each tool's README shows how to embed it.

## Prices and corrections

Prices are public list prices, checked by hand against each provider's own pricing page; `last_verified` in each `pricing.json` records when. They are estimates, not quotes, so confirm a figure with the provider before relying on it.

If a price is wrong or out of date, open an issue or a pull request that links to the provider's pricing page.

This project is not affiliated with or endorsed by any of the providers it compares.

## Licence

- The code is under the [MIT licence](LICENSE).
- The pricing data (the `pricing.json` files) is under [Creative Commons Attribution 4.0](LICENSE-DATA). If you reuse it, credit Robert Johnstone and link to this repository.
