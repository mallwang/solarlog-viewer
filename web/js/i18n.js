import { getBuildId } from './build-info.js';

const STORAGE_KEY = 'solarlog-lang';
const DEFAULT_LANG = 'de';

let currentLang = DEFAULT_LANG;
let strings = {};

/**
 * @returns {'de' | 'en'} Persisted selection (localStorage) or 'de' default (FR-018, FR-017).
 *   Guarded for `node:test` environments with no `window` (022-statistics-page's
 *   statistics.js pulls in format.js, which resolves the active language via this function even
 *   though it never touches the DOM itself) — always resolves to DEFAULT_LANG there, same as a
 *   browser session with no persisted preference yet.
 */
export function getLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
}

async function loadStrings(lang) {
  const response = await fetch(`i18n/${lang}.json?v=${getBuildId()}`);
  strings = response.ok ? await response.json() : {};
}

/**
 * Persists the language selection and loads its string table.
 * @param {'de' | 'en'} lang
 * @returns {Promise<void>} Resolves once the string table for `lang` is loaded.
 */
export async function setLanguage(lang) {
  window.localStorage.setItem(STORAGE_KEY, lang);
  currentLang = lang;
  await loadStrings(lang);
}

/** Loads the string table for the persisted/default language. Call once on bootstrap. */
export async function initI18n() {
  currentLang = getLanguage();
  await loadStrings(currentLang);
}

/** @param {string} key - Dot path into the loaded string table, e.g. 'nav.yearView'. @returns {string} */
export function t(key) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], strings);
  return typeof value === 'string' ? value : key;
}
