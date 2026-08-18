import { getLanguage } from './i18n.js';

const LOCALE_BY_LANG = { de: 'de-DE', en: 'en-US' };

/** @param {'de' | 'en'} [lang] @returns {string} BCP-47 locale tag for `lang`, or the active UI language's. */
function resolveLocale(lang) {
  return LOCALE_BY_LANG[lang ?? getLanguage()] ?? LOCALE_BY_LANG.de;
}

/**
 * Formats a plain number using the active/given language's decimal convention (comma for de,
 * period for en), e.g. formatNumber(1234.5) -> "1.234,5" (de) / "1,234.5" (en).
 * @param {number} value
 * @param {{ decimals?: number, lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatNumber(value, { decimals = 1, lang } = {}) {
  return new Intl.NumberFormat(resolveLocale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a kWh quantity with the active/given language's decimal convention,
 * e.g. "12,3 kWh" (de) / "12.3 kWh" (en).
 * @param {number} valueKwh
 * @param {{ decimals?: number, lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatKwh(valueKwh, opts) {
  return `${formatNumber(valueKwh, opts)} kWh`;
}

/**
 * Formats a EUR amount using the active/given language's currency convention
 * (comma decimal + trailing "€" for de, period decimal + leading "€" for en).
 * @param {number} value
 * @param {{ lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatCurrency(value, { lang } = {}) {
  return new Intl.NumberFormat(resolveLocale(lang), { style: 'currency', currency: 'EUR' }).format(
    value,
  );
}

/**
 * Formats a CO2-avoidance quantity (kg), porting the legacy site's kg/tonne threshold exactly:
 * below 10,000 kg renders in kg with 0 decimals, at/above it renders in tonnes ("t") with 2
 * decimals - both using the active/given language's decimal convention (FR-007/research.md R3).
 * @param {number} valueKg
 * @param {{ lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatCo2(valueKg, { lang } = {}) {
  if (valueKg < 10000) {
    return `${formatNumber(Math.floor(valueKg), { decimals: 0, lang })} kg`;
  }
  return `${formatNumber(Math.floor((valueKg / 1000) * 100) / 100, { decimals: 2, lang })} t`;
}

/**
 * Formats a calendar date using the active/given language's date convention
 * (DD.MM.YYYY for de, MM/DD/YYYY for en).
 * @param {Date} date
 * @param {{ lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatDate(date, { lang } = {}) {
  return new Intl.DateTimeFormat(resolveLocale(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a year+month as a localized "Month YYYY" label (e.g. "August 2026") — used for
 * month-granularity stats (statistics.js's best/worst month) where a full day-level date would be
 * misleading.
 * @param {number} year
 * @param {number} month - 1-12.
 * @param {{ lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatMonthYear(year, month, { lang } = {}) {
  return new Intl.DateTimeFormat(resolveLocale(lang), { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

/**
 * Formats a calendar date's day+month only, no year (DD.MM. for de, MM/DD for en) — used where the
 * year is either implied or, as in the trends topic's year-over-year chart, deliberately varies
 * per series and shouldn't be baked into a shared axis/tooltip label.
 * @param {Date} date
 * @param {{ lang?: 'de' | 'en' }} [opts]
 * @returns {string}
 */
export function formatDayMonth(date, { lang } = {}) {
  return new Intl.DateTimeFormat(resolveLocale(lang), { day: '2-digit', month: '2-digit' }).format(
    date,
  );
}
