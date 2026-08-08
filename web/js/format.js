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
