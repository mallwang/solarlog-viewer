# Architecture

Photovoltaikanlage Allwang — a static solar-monitoring website running since 2006.
No server-side logic exists at any layer. Everything is plain files served by a web
server (originally Apache); all computation runs in the visitor's browser.

## Top-Level File Inventory

### Entry point

| File           | Purpose                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `index.html`   | HTML frameset splitting the viewport into left nav (170 px) and right content |
| `index.php`    | Thin PHP wrapper that redirects to `index.html` on some server configs        |
| `default.html` | Alternate entry used by some SolarLog firmware versions                       |

### Navigation

| File          | Purpose                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `links.html`  | Left-frame navigation bar with links to all visualization modes and external resources. Originally saved from Microsoft Word 11 (contains `mso-*` CSS and VML XML namespaces). |
| `banner.html` | Top banner (used on some configurations)                                                                                                                                       |

### Page content (loaded into the right frame)

| File               | Purpose                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anlageninfo.html` | Plant info page — shown on first load. Displays owner, location, module type, inverter specs, commissioning date, orientation. All values read dynamically from `base_vars.js`. |
| `visu.html`        | Main visualization page (~1640 lines). Dynamically chains all data scripts, then dispatches to one of five chart-rendering functions based on the `?mode=` URL parameter.       |
| `events.html`      | Fault/event log viewer — lists inverter error and status events.                                                                                                                |
| `expert.html`      | Expert/diagnostic view (advanced inverter parameters).                                                                                                                          |
| `iframe.html`      | Embeddable iframe version of the visualization.                                                                                                                                 |

### Configuration (FTP-pushed by SolarLog device)

| File           | Push frequency   | Purpose                                                                                                                                                                                                                           |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_vars.js` | On config change | Plant configuration: inverter count, rated power, owner info, module/inverter model strings, feed-in tariff, logging interval, language, per-inverter metadata (`WRInfo[]`). Single source of truth for all static configuration. |
| `min_cur.js`   | Every 5 minutes  | Current real-time reading: timestamp, total AC power (`Pac`), per-inverter AC power (`PacArr`), per-string DC power (`PdcArr`), inverter status codes, error codes.                                                               |

### Historical data (FTP-pushed by SolarLog device)

| File / Pattern                        | Push frequency           | Purpose                                                                                             |
| ------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `min{YYMMDD}.js`                      | Daily (one file per day) | 5-minute interval readings for that calendar day. 7,148+ files covering 2006-11-03 through present. |
| `days.js`                             | Every 5 minutes          | Today's running daily totals (yield Wh + peak W per inverter).                                      |
| `days_hist.js`                        | Daily                    | Complete historical daily totals archive (recent years).                                            |
| `days_hist_06.js` … `days_hist_09.js` | Static                   | Historical daily totals for 2006–2009 (split into separate files due to size).                      |
| `daysall.js`                          | Daily                    | All-days cumulative data used for the year-over-year line comparison (mode 4).                      |
| `months.js`                           | Monthly                  | Monthly energy totals per inverter from 2006-03 through present.                                    |
| `years.js`                            | Yearly                   | Yearly energy totals per inverter from 2006 through present.                                        |

### Chart engine (static, shipped once in 2006–2008)

| File             | Purpose                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `diagram.js`     | Core chart engine: `Diagram`, `Bar`, `Line` constructor objects. Draws by computing absolute pixel positions — no canvas or SVG. |
| `diagram_dom.js` | DOM-manipulation helpers for the chart engine.                                                                                   |
| `diagram_nav.js` | Day/week navigation controls rendered below the daily chart.                                                                     |
| `diagram.css`    | Stylesheet for chart container and surrounding UI.                                                                               |

### Utility and i18n

| File                                                             | Purpose                                                                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions.js`                                                   | Shared helpers: `getWRToken()` (parse pipe-delimited inverter block), `enumData()` (iterate data arrays), `fmt00()` / `aw_fmt0()` (number formatting), date arithmetic. |
| `lang_DE.js`                                                     | German UI strings (active by default — `Lang="DE"` in `base_vars.js`).                                                                                                  |
| `lang_EN.js`                                                     | English UI strings.                                                                                                                                                     |
| `lang_FR.js` `lang_IT.js` `lang_ES.js` `lang_NL.js` `lang_DK.js` | Other language packs (French, Italian, Spanish, Dutch, Danish).                                                                                                         |
| `wz_tooltip.js`                                                  | Third-party tooltip library (2006-era).                                                                                                                                 |
| `evalsafe.js`                                                    | Safe `eval` wrapper for loading data scripts in some browser environments.                                                                                              |

### Event log data

| File            | Purpose                              |
| --------------- | ------------------------------------ |
| `events.js`     | Inverter event/fault log entries.    |
| `events_day.js` | Per-day event index.                 |
| `events.css`    | Stylesheet for the event log viewer. |

### Assets

| Pattern                                                | Purpose                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `solaranlage.jpg` (referenced from `anlageninfo.html`) | Plant photo                                                                               |
| `*.gif` (`b_000000.gif`, `h_blue.gif`, `back.gif`, …)  | 1×1 px colored spacer GIFs and navigation arrow icons used by the pixel-math chart engine |
| `background.jpg`, `bg_palm.jpg`, `back_links.jpg`      | Background images                                                                         |
| `favicon-v2.ico`                                       | Browser tab icon                                                                          |

### Hardware/SolarLog artifacts

| File                     | Purpose                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `WR42MS05/`, `WR21TL06/` | Per-inverter directories pushed by the SolarLog (contain inverter-specific config or calibration files) |
| `config_*.dat`           | SolarLog device configuration snapshots                                                                 |
| `ftpstat.csv`            | FTP transfer log from the SolarLog device                                                               |

## Page Layout

```
Browser window
└── index.html  (HTML frameset)
    ├── left frame (170 px fixed)  →  links.html
    │       Navigation links to all views
    └── right frame (remaining width)  →  anlageninfo.html (default)
            Replaced by visu.html?mode=N when user clicks a nav link
            Also: events.html, expert.html
```

## Visualization Modes

`visu.html` is the single page handling all chart views. The `?mode=` query
parameter selects which chart function runs after all data scripts are loaded.

| Mode | URL                           | View                                                      |
| ---- | ----------------------------- | --------------------------------------------------------- |
| 0    | `visu.html?mode=0&tag=YYMMDD` | Daily 5-minute power trace (per inverter, per string DC)  |
| 1    | `visu.html?mode=1&year=YYYY`  | Monthly energy bar chart for a given year                 |
| 2    | `visu.html?mode=2`            | Yearly energy bar chart (all years)                       |
| 3    | `visu.html?mode=3`            | All-years cumulative bar (total lifetime)                 |
| 4    | `visu.html?mode=4`            | Year-over-year daily line comparison (all years overlaid) |

Navigation between days/months uses `backward.gif` / `forward.gif` buttons
that reload `visu.html` with an updated `tag=` or `year=` parameter.
