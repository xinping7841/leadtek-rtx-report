# Leadtek RTX Report

Static web report for comparing Leadtek / NVIDIA RTX professional GPUs across Ampere, Ada, and Blackwell generations. The page covers specifications, market price ranges, HEVC / AV1 video-server selection, model comparison, and mobile-friendly browsing.

The production copy runs on node-121 at `/opt/leadtek-rtx-report` and is served on port `18080`.

## Project Structure

```text
index.html                    # Page skeleton, controls, table header, render containers
assets/
  app.css                     # All page styles
  app.js                      # ES module entry point
  images/                     # Locally cached product images
  js/
    app-controller.js         # State, events, filtering, sorting, comparison
    elements.js               # DOM lookup and required container checks
    renderers.js              # Table, cards, comparison table, and error-state HTML rendering
    schema.js                 # Browser-side JSON validation
    utils.js                  # escapeHtml, loadJson, and shared helpers
    view-model.js             # GPU normalization, derived fields, score, price sort value
data/
  gpu-catalog.json            # GPU catalog data
  market-prices.json          # Market prices keyed by gpuId
scripts/
  validate-static.mjs         # Static structure and data integrity validation
  serve-static.mjs            # Local static preview server
  edit-lock.sh / .ps1         # Multi-agent edit lock
tests/
  smoke.spec.mjs              # Playwright smoke tests
package.json
playwright.config.mjs
```

## Local Preview

Install dependencies once:

```bash
npm install
```

Start the static preview server:

```bash
npm start
```

Default URL:

```text
http://127.0.0.1:18080/
```

Use another port when needed:

```bash
node scripts/serve-static.mjs 18180
```

## Data Maintenance

GPU catalog data lives in `data/gpu-catalog.json`. Each GPU needs a stable unique `id` plus model, level, architecture, local image, compute, memory, bandwidth, power, codec, interface, form-factor, official link, and positioning fields.

Product images are cached locally under `assets/images/` so the report does not depend on Leadtek image hotlinks at runtime. In `data/gpu-catalog.json`, `image.src` must point to the local cached file and `image.sourceUrl` should keep the original Leadtek URL for traceability.

Market prices live in `data/market-prices.json` and are joined by `gpuId`. If public pricing is unavailable, keep `status: "quote"` and set `minCny` / `maxCny` to `null`.

Do not put HTML fragments in JSON. All values coming from JSON are escaped before rendering.

## Validation

Run static validation:

```bash
npm run validate
```

The validator checks:

- `index.html` references `assets/app.css` and module `assets/app.js`
- JSON parses correctly
- GPU ids are unique
- required GPU fields are present
- product images are local files and non-empty
- price `gpuId` values match catalog GPU ids
- `assets/app.js` and `assets/js/*.js` pass syntax checks

Run Playwright smoke tests:

```bash
npm run test:e2e
```

The smoke tests cover homepage load, 24 GPU rows, search filtering, model comparison, and the mobile workflow.

If the environment has system Chrome but no Playwright-managed Chromium, set the executable path first:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

On node-121, install Playwright Chromium once when e2e testing is needed. This does not affect the 18080 static service:

```bash
npx playwright install chromium
```

## node-121 Deployment

Production directory:

```bash
cd /opt/leadtek-rtx-report
```

Acquire the edit lock before changing production files:

```bash
bash scripts/edit-lock.sh acquire "reason"
```

Deploy GitHub `master`:

```bash
git pull --ff-only
npm install
npm run validate
```

The 18080 service is managed by systemd:

```bash
systemctl status leadtek-report.service --no-pager
```

It currently serves static files with:

```bash
python3 -m http.server 18080 --bind 0.0.0.0
```

Static file updates normally do not require a restart. Quick checks:

```bash
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1:18080/data/gpu-catalog.json
curl -I http://127.0.0.1:18080/assets/app.js
curl -I http://127.0.0.1:18080/assets/images/rtx-pro-4000-blackwell.jpg
```

Release the edit lock after finishing:

```bash
bash scripts/edit-lock.sh release
```

## Features

- GPU spec table rendered from `data/gpu-catalog.json`
- market price ranges merged from `data/market-prices.json`
- video-server filtering by power, memory, NVDEC, HEVC 4:2:2, AV1, and compact deployment
- comparison table for two or more selected GPU models
- full and compact views for large displays, smaller windows, and mobile

## Rendering Safety

Runtime validation lives in `assets/js/schema.js`, GPU derived fields live in `assets/js/view-model.js`, and HTML string rendering lives in `assets/js/renderers.js`. All JSON values must pass through `escapeHtml` before they are inserted into rendered HTML.
