**English** · [Deutsch](README.de.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

# SolarLog Viewer

<p align="center">
  <img src="solarlog-viewer.png" alt="Solarlog Viewer Icon" width="120" />
</p>

<p align="center">
  <sub>Cloud sun cloudy weather Icon by Matt Cooper on <a href="https://icon-icons.com/authors/268-matt-cooper">Icon-Icons.com</a></sub>
</p>

SolarLog Viewer is a static dashboard for SolarLog solar-plant data exports. It shows current
production alongside daily, monthly, yearly, lifetime, and year-over-year comparison views, an
event log for inverter status/fault history, a live weather-aware sky backdrop, and a desktop
info panel that keeps the plant's current output and forecast visible from anywhere in the app.
Everything runs as static HTML/JS/CSS with no backend — the whole app is a folder FTP'd to the
hosting device.

- Five hash-routed views (day/month/year/total/compare) plus a dashboard and an events page, all
  sharing one responsive Tailwind design in light and dark mode, usable from 320px phones to
  2560px monitors
- A dynamic sky background that reflects the plant's real current weather and time of day
- A persistent desktop info panel showing live production, weather, and forecast
- A "Statistik" page of records and long-term trends (best/worst month & year, calendar heatmaps,
  production streaks, year-over-year/lifetime/degradation trend charts), computed entirely from
  already-fetched aggregate data
- An "Ereignisse" (events) page listing every inverter status/fault event, filterable and sortable
- Explanatory tooltips on stats-panel figures explaining exactly how each is calculated
- German/English UI language, remembered across reloads

For the full walkthrough of using the deployed dashboard — navigation, charts, events, tooltips —
see the [User Guide](docs/user-guide.md).

## Live Application

https://wolfsbach.synology.me

## Getting started / Dev server

```bash
npm install
npm run start
npm run open
```

Starts the dev server at http://localhost:3000 — entry point is `web/index.html`. `npm start` runs
the Tailwind CLI in `--watch` mode alongside `browser-sync`, so CSS changes hot-reload too.
Run `npm run open` to open the viewer in your default browser.

`bs-config.cjs` proxies every `/data/*` and `/hist/*` request straight through to the live
SolarLog device instead of serving from disk, so the dev server always shows current readings
without any local copy at all — `web/data/` and `web/hist/` no longer exist in this repo's working
tree. See [Validation & aggregation scripts](#validation--aggregation-scripts) below for what that
means for scripts that read those directories from disk.

`npm run build:css` compiles `web/css/tailwind.css` into the committed
`web/css/tailwind.generated.css` static file used in production — no CDN/runtime script.

## Production build & deploy

`npm run build` (`scripts/build.js`) produces `dist/`, the tree that actually gets FTP'd —
`web/` itself is the dev-server-served source, not what ships. The build bundles+minifies the
whole JS import graph and stylesheets into cache-busted, SHA-tagged files and rewrites
`dist/index.html` to reference them, so every deploy gets fresh, never-before-seen asset URLs and
browsers can't serve a stale cached copy after an update. Run `npm run build` before syncing;
`scripts/ftp-sync.js` (and the `sync-ftp` skill) diff/upload `dist/`, not `web/`, and only the
app's own assets.

## Dynamic sky background

The animated cloud backdrop behind the dashboard reflects the installation's real current weather
and local time of day instead of always looking the same — cloud density, a sun/moon arc across
the sky, and occasional flying objects (birds, planes, balloons, a rare rocket) all respond to
live conditions polled every 15 minutes. Any failure (no location, no network) falls back silently
to the original static backdrop, and reduced-motion preferences suppress animation while still
reflecting real conditions through static cues. See `specs/007-dynamic-sky-weather/` for the full
spec/plan.

## Global desktop info panel

A persistent panel in the header, visible at desktop widths, shows the plant's current production,
current weather, and today's remaining forecast from every view — not just the dashboard. It keeps
its production/yield figures in sync with the day chart's own auto-refresh, and weather refreshes
on a separate, slower schedule. See `specs/010-global-info-panel/` for the full spec/plan.

## Ereignisse (events) page

`#/events` lists every inverter status/fault event as one deduplicated, most-recent-first table,
combining the historical archive with the current day's log. Four combinable dropdown filters
narrow the table, and the Von–Bis/WR/Dauer columns sort by click. See
[Ereignisse (events) page](docs/user-guide.md#ereignisse-events-page) in the user guide for the
full walkthrough.

## Explanatory tooltips

Stats-panel rows across the day/month/year/total/welcome views can carry a small, focusable "i"
info button that reveals a short tooltip explaining exactly how that figure is calculated —
omitted entirely on touch-only devices where it wouldn't be useful. See
`specs/020-explanatory-tooltips/` for the full spec/plan/contract.

## Frontend tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test unit tests for web/js/data/* parsers and web/js/**
npm run lint
npm run format:check
```

## Data files

The `min*.js` files (one per day, ~7000+ files) contain the raw solar yield data exported from the
SolarLog device. The `days*.js` and `days_hist*.js` files contain aggregated daily/monthly
summaries. These live on the SolarLog device (`web/data/` current, `web/hist/` frozen historical)
and are no longer mirrored in this repo's working tree — see
[Getting started / Dev server](#getting-started--dev-server) above.

## Validation & aggregation scripts

Scripts for detecting data gaps, validating totals, and repairing aggregated files live in
`scripts/` and are documented in the [Developer Guide](docs/developer-guide.md), including the
manual setup required before they'll run (`web/data`/`web/hist` no longer exist in this repo's
working tree).

## Maintaining the CO2 emission-factor reference table

The day/month/year/total views each show a CO2 avoidance figure, computed by multiplying yield by
the German electricity grid's CO2 emission factor for the calendar year it was produced in. The
per-year factors live in `web/js/data/co2-factors.js` as a plain object
(`CO2_FACTOR_KG_PER_KWH_BY_YEAR`), sourced from the Umweltbundesamt's yearly "Entwicklung der
spezifischen Treibhausgas-Emissionen des deutschen Strommix" publication. Any calendar year not
yet in the table (the current, in-progress year, and any future year) falls back to the constant
`CO2_FALLBACK_FACTOR_KG_PER_KWH` (0.363 kg/kWh).

To add the next published year's factor once UBA releases it: convert the published g CO2/kWh
figure to kg/kWh (divide by 1000) and add it as a single new `year: factor` key to
`CO2_FACTOR_KG_PER_KWH_BY_YEAR` — no other file needs to change; every view picks it up on next
load.

## Releases

Releases follow [Conventional Commits](https://www.conventionalcommits.org/) and
[Semantic Versioning](https://semver.org/). `npm run release` (backed by
[release-it](https://github.com/release-it/release-it) with
`@release-it/conventional-changelog`) bumps `package.json`'s version, regenerates
`CHANGELOG.md` from the commits since the last tag, and creates a `vX.Y.Z` git tag —
it does not publish to npm or push a Docker image, and it does not build or deploy the
site. For maintainers, the guided `release` skill in Claude Code (`/release`) walks
through a dry-run preview, a confirmation gate, the release itself, and formatted
GitHub Release notes to paste in manually. See `.claude/skills/release/SKILL.md` for
the full workflow. After releasing, run `npm run build` and the `sync-ftp` skill to
actually deploy.

## License

MIT — see [LICENSE.md](LICENSE.md).
