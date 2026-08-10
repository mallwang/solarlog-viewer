const STORAGE_KEY = 'solarlog-transparency';

/** @returns {boolean} Persisted transparency-mode selection (localStorage) or `false` default. */
export function isTransparencyEnabled() {
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Persists the transparency-mode selection and applies it to the document immediately.
 * @param {boolean} enabled
 * @returns {void}
 */
export function setTransparencyEnabled(enabled) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  applyTransparencyMode(enabled);
}

/** Applies the persisted/default transparency-mode selection to the document. Call once on bootstrap. */
export function initTransparencyMode() {
  applyTransparencyMode(isTransparencyEnabled());
}

function applyTransparencyMode(enabled) {
  document.documentElement.setAttribute('data-transparency', enabled ? 'on' : 'off');
}
