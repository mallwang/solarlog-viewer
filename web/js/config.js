// The new SolarLog device (installed 2026-07-29) cannot append to the old device's
// days_hist.js/months.js/years.js — it only overwrites them with its own totals since
// installation. Historical data through the day before installation lives in HIST_DIR
// (frozen); everything from INSTALLATION_DATE onward lives in DATA_DIR (live device output).
export const INSTALLATION_DATE = '2026-07-29';
export const DATA_DIR = 'data';
export const HIST_DIR = 'hist';

// Only German is maintained for this plant right now; flip to `true` to bring back the
// DE/EN language switcher in the header without deleting its implementation.
export const SHOW_LANGUAGE_SWITCHER = false;

/**
 * Overrides the nav-bar brand text and the browser tab title (`<title>`). `null` (the default)
 * falls back to the plant's `HPTitel` from `data/base_vars.js` (see `parseBaseVars` in
 * `data/plant.js`), which is why this lives in config.js rather than being hardcoded in
 * index.html: HPTitel is a device-generated string ("Photovoltaikanlage Allwang") that doesn't
 * match the shorter name wanted in the UI chrome.
 * @type {string | null}
 */
export const SITE_TITLE = 'PV Allwang';

/**
 * Manual override for the dynamic sky background's weather/solar-time lookup coordinates
 * (`web/js/sky/location.js`). `HPStandort` addresses in this codebase are often small rural
 * hamlets that general-purpose geocoders resolve poorly, so this lets one person resolve the
 * installation's coordinates once (e.g. from its postal code) instead of relying on automatic
 * geocoding every session. `null` (the default) falls back to automatic geocoding, cached in
 * `localStorage` — see `web/js/sky/location.js` for the full resolution order.
 * @type {{ lat: number, lon: number } | null}
 */
// Set explicitly: the automatic geocoder returns zero results for the full free-text
// `HPStandort` value ("92266 Ensdorf-Wolfsbach") — its "-Wolfsbach" hamlet suffix isn't a
// recognized place name on its own. Resolved instead from the postal code alone (92266 →
// Ensdorf, Landkreis Amberg-Sulzbach, Bavaria), which is coarse enough for weather purposes.
export const SKY_LOCATION_OVERRIDE = { lat: 49.34062, lon: 11.93587 };

/**
 * Controls how the dynamic sky background's weather-driven appearance (`web/js/sky/sky-
 * controller.js`, `data-weather` on `.sky-clouds`) is determined, independently of the global
 * info panel's own weather text (`info-panel/`), which always reads live data regardless of
 * this setting. Matches this file's existing manual-override pattern (`SITE_TITLE`,
 * `SKY_LOCATION_OVERRIDE`) — a static, build-time constant read once at startup, not a
 * runtime-reactive value; changing it takes effect on next load, no other code change needed.
 * - `'auto'` (the default) — the background matches the live polled weather condition.
 * - `'off'` — disables the sky animation entirely: no clouds, no sun/moon, no flying objects.
 *   Distinct from a failed weather lookup, which instead falls back to the plain pre-feature
 *   look (clouds and sun/moon still shown) rather than hiding everything.
 * - one of `WEATHER_CATEGORIES` (`'sunny'`, `'mixed'`, `'cloudy'`, `'rain'`, `'snow'`) — the
 *   background always shows that fixed category, regardless of live conditions.
 * Any other value (a typo, or an unrecognized string) falls back to `'auto'`.
 * @type {'auto' | 'off' | 'sunny' | 'mixed' | 'cloudy' | 'rain' | 'snow'}
 */
export const BACKGROUND_WEATHER = 'auto';

/**
 * Fixed axis ranges for the day chart's (Tagesertrag) three y-axes, each as `{ max, step }` — the
 * axis always runs from 0 to `max` in `step`-sized gridlines, rather than each day scaling its own
 * axis to that day's data. A low-yield day previously stretched to fill the same chart height as a
 * high-yield day, and the scale jumped around while paging between days; fixed ranges keep every
 * day visually comparable. `max` must be evenly divisible by `step` (used as
 * `tickAmount = max / step` — ApexCharts has no direct "step size" option).
 * @type {{
 *   feedInW: { max: number, step: number },
 *   efficiencyPercent: { max: number, step: number },
 *   udcV: { max: number, step: number },
 * }}
 */
export const DAY_CHART_AXES = {
  feedInW: { max: 6000, step: 1000 },
  efficiencyPercent: { max: 100, step: 20 },
  udcV: { max: 500, step: 100 },
};

/**
 * Day chart (Tagesertrag) x-axis time range:
 * - `'data'` (default) — spans only the timestamps actually present in that day's min*.js file
 *   (e.g. 06:15–20:45 on a short-daylight day), so the plotted line fills the chart width.
 * - `'fullDay'` — always spans the full 00:00–24:00 local day, so the sunrise/sunset position is
 *   comparable at a glance across days rather than the axis itself shifting day to day.
 * @type {'data' | 'fullDay'}
 */
export const DAY_CHART_X_AXIS_RANGE = 'data';

/**
 * Minutes of empty margin added before the first and after the last data point when
 * `DAY_CHART_X_AXIS_RANGE` is `'data'` (ignored in `'fullDay'` mode, which already has its own
 * fixed margin down to midnight). Without it the first/last points sit flush against the plot's
 * left/right edge, making the line's actual start/end hard to see and the edge points awkward to
 * hover. `0` disables the padding.
 * @type {number}
 */
export const DAY_CHART_X_AXIS_PADDING_MINUTES = 15;

/**
 * How often every "live PV data" auto-refresh cycle re-polls its data source: the global info
 * panel's production/yield figures (`info-panel/info-panel-controller.js`, reading
 * `data/min_cur.js` + `days.js`/`months.js`), the day detail view's stats panel/chart/table while
 * showing *today* (`views/day-view.js`, reading `min_day.js`), and the welcome page's today-chart
 * + yield-summary stats card (`views/welcome-view.js`, reading the same files as the other two).
 * One shared constant so all three stay in lockstep — the nav bar, the day chart, and the welcome
 * page always reflect the same reading age, rather than independently-tuned timers drifting
 * apart. Defaults to 1 minute; the SolarLog device's own minimum data-file update interval is
 * 10 minutes, so most of the values in that default range of settings just re-confirm the same
 * reading — harmless, and keeps the UI feeling live even between the device's own file writes.
 * The info panel's weather/forecast poll (Open-Meteo) and the sky background's separate weather
 * poll are unrelated to PV data and keep their own longer intervals (see
 * `sky/sky-controller.js`'s own `POLL_INTERVAL_MS`).
 * @type {number}
 */
export const DATA_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * How often the global info panel re-polls the current weather condition + today's forecast
 * (Open-Meteo — see `info-panel/info-panel-controller.js`). Kept separate from
 * `DATA_REFRESH_INTERVAL_MS`: weather doesn't change meaningfully minute to minute, so polling it
 * that often would just waste requests against the free Open-Meteo API for no visible benefit.
 * Defaults to 10 minutes.
 * @type {number}
 */
export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Filenames under `web/img/plant/`, in carousel display order, shown by the welcome page's photo
 * carousel (`web/js/views/photo-carousel.js`). Matches this file's existing manual-override
 * pattern (`SITE_TITLE`, `SKY_LOCATION_OVERRIDE`): the operator drops a file into `web/img/plant/`
 * and adds its filename here — no build/manifest-generation step. Empty (the default) shows the
 * carousel's neutral placeholder state instead of any image.
 * @type {string[]}
 */
export const PLANT_PHOTOS = ['plant-01.jpg', 'plant-02.jpg', 'plant-03.jpg', 'plant-04.jpg'];

/**
 * `[from, to]` ISO ('YYYY-MM-DD') date ranges, inclusive, whose *daily* generated-kWh split isn't
 * reliable per day - even though the month's/year's total is. The old inverter crashed on
 * 2026-05-19 and stayed down until the new device went live on INSTALLATION_DATE (2026-07-29);
 * the gap in days_hist.js was backfilled (scripts/backfill-min-day.js) from a single offline
 * meter reading (read manually on site by an engineer) for the whole outage, spread evenly across
 * its days rather than measured per day. That reading makes the *range's total* trustworthy - see
 * data/statistics.js's computeYoyCumulative/computeLifetimeCumulative, which stay unfiltered - but
 * any statistic that singles out *one day* within it (streaks, best/worst day, max daily
 * €/CO2/Ist %) would be picking among an artificially even split rather than real day-to-day
 * variation, so those exclude it (see data/backfilled-data.js's isUnreliableDailyYield). The
 * calendar heatmap still shows these days, flagged as backfilled (data/backfilled-data.js) - a
 * real, meter-derived estimate beats a blank cell there.
 * Operator-editable: add another `[from, to]` pair here if a future outage gets backfilled the
 * same way (don't add single-day-total dates here - those belong in
 * data/backfilled-data.js's regenerated BACKFILLED_DATES instead).
 * @type {[string, string][]}
 */
export const UNRELIABLE_DAILY_YIELD_RANGES = [['2026-05-19', '2026-07-28']];
