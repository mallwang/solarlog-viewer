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
