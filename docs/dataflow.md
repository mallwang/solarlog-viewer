# Dataflow

How data moves from the SolarLog hardware to a rendered chart in the visitor's
browser. There are two independent flows: the **push flow** (hardware → server)
and the **pull flow** (browser → server → screen).

---

## 1. Push Flow: SolarLog → Web Server

The SolarLog 500 datalogger connects to the internet via an Ethernet interface
and FTP-pushes updated data files to the web server on a fixed schedule.
No human action is required; the device handles all uploads autonomously.

```
SolarLog 500 (on-site hardware)
        │
        │  FTP push (every 5 min or on schedule)
        ▼
Web server (plain file store — Apache/nginx)
        │
        ├── base_vars.js      (on config change)
        ├── min_cur.js        (every 5 min — current reading)
        ├── days.js           (every 5 min — today's running totals)
        ├── min{YYMMDD}.js    (new file per calendar day)
        ├── days_hist*.js     (daily — completed daily totals)
        ├── months.js         (monthly — completed monthly totals)
        ├── years.js          (yearly — completed yearly totals)
        └── daysall.js        (daily — all-days cumulative data)
```

All files are plain text. The server stores them statically; no transformation
or processing happens server-side.

---

## 2. Pull Flow: Browser → Rendered Chart

### Step 1 — Frameset load

The visitor navigates to `index.html`. The browser parses the `<frameset>`
declaration and issues two parallel requests:

- `links.html` → loaded into the left 170 px frame
- `anlageninfo.html` → loaded into the right content frame (default view)

`anlageninfo.html` immediately injects a `<script src="base_vars.js">` tag via
`document.write()`, so the plant configuration is available before the page
renders its table of parameters.

### Step 2 — User selects a visualization

The visitor clicks one of the navigation links in `links.html`. Each link sets
`target="visu"` (the right frame) and points to `visu.html?mode=N` (with an
optional `&tag=YYMMDD` or `&year=YYYY` parameter).

### Step 3 — visu.html initializes

`visu.html` parses the `?mode=` and `?tag=` / `?year=` parameters from
`window.location.search`. It then builds a chain of script load calls using
`document.write("<script src='...'></script>")` — the only way to
synchronously load external scripts in 2006-era browsers.

The load chain always starts with shared infrastructure:

```
document.write(<script src="base_vars.js">)   // plant config + WRInfo[]
document.write(<script src="lang_DE.js">)     // UI strings (Lang from base_vars)
document.write(<script src="functions.js">)   // getWRToken(), enumData(), fmt*()
document.write(<script src="diagram.js">)     // Diagram / Bar / Line constructors
document.write(<script src="diagram_dom.js">) // DOM helpers
document.write(<script src="diagram_nav.js">) // navigation controls
```

Then mode-specific data files are chained:

| Mode               | Additional scripts loaded                                                  |
| ------------------ | -------------------------------------------------------------------------- |
| 0 (daily)          | `min{YYMMDD}.js` for the requested date, then `days.js` for today's totals |
| 1 (monthly)        | `months.js`                                                                |
| 2 (yearly)         | `years.js`                                                                 |
| 3 (all-years bar)  | `years.js`                                                                 |
| 4 (all-years line) | `daysall.js`, then `days_hist.js` + `days_hist_06/07/08/09.js`             |

Each data file appends records to a pre-declared global array (`m[]`, `da[]`,
`mo[]`, `ye[]`) by executing statements like `m[mi++]="..."` at parse time.
The global array and its counter (`mi`, `dx`, `mx`, `yx`) are declared in
`visu.html` before the script chain starts.

### Step 4 — Chart dispatch

After all scripts have loaded (synchronous execution guarantees this because
`document.write` blocks), `visu.html` calls the appropriate rendering function:

```
switch(mode) {
  case 0: drawDailyChart();    break;  // 5-min trace, per inverter/string
  case 1: drawMonthlyChart();  break;  // monthly bar, year selected by ?year=
  case 2: drawYearlyChart();   break;  // yearly bar, all years
  case 3: drawTotalChart();    break;  // all-years cumulative bar
  case 4: drawCompareChart();  break;  // year-over-year line overlay
}
```

Each function:

1. Iterates the global data array using `enumData()` / `getWRToken()` to parse
   the pipe-and-semicolon encoded records into per-inverter numeric values.
2. Instantiates `new Diagram()` (or `new Bar()` / `new Line()`), passing chart
   dimensions in pixels (fixed at 800 px wide).
3. Calls methods on the diagram object to plot each data point. Internally the
   engine translates values to absolute pixel offsets and writes `<div>` or
   `<img>` elements at those positions into the DOM.
4. Renders a summary/statistics table below the chart: peak power, total yield,
   specific yield (kWh/kWp), CO₂ savings, feed-in revenue.

### Step 5 — Navigation between dates

Below the chart, `diagram_nav.js` renders backward/forward buttons. Clicking
them reloads `visu.html` with an updated `?tag=` (daily mode) or `?year=`
(monthly mode) parameter, restarting the flow from Step 3 for the new date.

---

## Complete Sequence Diagram (Mode 0 — Daily View)

```
Visitor                Browser               Web Server
   │                      │                      │
   │── click "Tagesertrag" ──►                   │
   │                      │── GET visu.html?mode=0&tag=260729 ──►│
   │                      │◄── 200 visu.html ────────────────────│
   │                      │                      │
   │                      │── GET base_vars.js ──►              │
   │                      │◄── base_vars.js ─────────────────────│
   │                      │── GET lang_DE.js ───►               │
   │                      │◄── lang_DE.js ───────────────────────│
   │                      │── GET functions.js ─►               │
   │                      │◄── functions.js ─────────────────────│
   │                      │── GET diagram*.js ──►               │
   │                      │◄── diagram*.js ──────────────────────│
   │                      │── GET min260729.js ─►               │
   │                      │◄── min260729.js ─────────────────────│
   │                      │── GET days.js ──────►               │
   │                      │◄── days.js ──────────────────────────│
   │                      │                      │
   │                      │  [all data arrays populated]
   │                      │  drawDailyChart() runs
   │                      │  pixel-math DOM written
   │◄── chart rendered ───│                      │
```

---

## Key Global Variables Set During Load

| Variable     | Set by                                                            | Used by                                          |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| `AnzahlWR`   | `base_vars.js`                                                    | All chart functions (loop over inverters)        |
| `WRInfo[]`   | `base_vars.js`                                                    | `getWRToken()` to know string count per inverter |
| `Lang`       | `base_vars.js`                                                    | Selects which `lang_XX.js` to load               |
| `Verguetung` | `base_vars.js`                                                    | Feed-in revenue calculation in summary table     |
| `AnlagenKWP` | `base_vars.js`                                                    | Specific yield (kWh/kWp) calculation             |
| `m[]`, `mi`  | declared in `visu.html`; populated by `min{YYMMDD}.js`            | `drawDailyChart()`                               |
| `da[]`, `dx` | declared in `visu.html`; populated by `days.js` / `days_hist*.js` | Daily summary                                    |
| `mo[]`, `mx` | declared in `visu.html`; populated by `months.js`                 | `drawMonthlyChart()`                             |
| `ye[]`, `yx` | declared in `visu.html`; populated by `years.js`                  | `drawYearlyChart()`, `drawTotalChart()`          |
| `txt_*`      | `lang_DE.js` (or other lang file)                                 | All UI label strings                             |
