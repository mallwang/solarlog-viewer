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
