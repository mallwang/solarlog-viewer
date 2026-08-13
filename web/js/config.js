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
 * Filenames under `web/img/plant/`, in carousel display order, shown by the welcome page's photo
 * carousel (`web/js/views/photo-carousel.js`). Matches this file's existing manual-override
 * pattern (`SITE_TITLE`, `SKY_LOCATION_OVERRIDE`): the operator drops a file into `web/img/plant/`
 * and adds its filename here — no build/manifest-generation step. Empty (the default) shows the
 * carousel's neutral placeholder state instead of any image.
 * @type {string[]}
 */
export const PLANT_PHOTOS = ['plant-01.jpg', 'plant-02.jpg', 'plant-03.jpg', 'plant-04.jpg'];
