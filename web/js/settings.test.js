import { test } from 'node:test';
import assert from 'node:assert/strict';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function fakeDocumentElement() {
  const attributes = new Map();
  return {
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
  };
}

/**
 * Stubs the `window`/`document` globals settings.js relies on (mirroring i18n.js's direct-global
 * pattern, so no dependency injection to thread through) and re-imports the module fresh so each
 * test starts from a clean localStorage/attribute state.
 * @param {Record<string, string>} initialStorage
 * @returns {Promise<{ settings: typeof import('./settings.js'), documentElement: ReturnType<typeof fakeDocumentElement> }>}
 */
async function loadSettings(initialStorage = {}) {
  const storage = fakeStorage(initialStorage);
  const documentElement = fakeDocumentElement();
  globalThis.window = { localStorage: storage };
  globalThis.document = { documentElement };
  const settings = await import(`./settings.js?t=${Date.now()}-${Math.random()}`);
  return { settings, documentElement };
}

test('isTransparencyEnabled defaults to false when localStorage is empty', async () => {
  const { settings } = await loadSettings();
  assert.equal(settings.isTransparencyEnabled(), false);
});

test('setTransparencyEnabled(true) persists "true" under the solarlog-transparency key', async () => {
  const { settings } = await loadSettings();
  settings.setTransparencyEnabled(true);
  assert.equal(window.localStorage.getItem('solarlog-transparency'), 'true');
  assert.equal(settings.isTransparencyEnabled(), true);
});

test('setTransparencyEnabled(false) persists "false" under the solarlog-transparency key', async () => {
  const { settings } = await loadSettings({ 'solarlog-transparency': 'true' });
  settings.setTransparencyEnabled(false);
  assert.equal(window.localStorage.getItem('solarlog-transparency'), 'false');
  assert.equal(settings.isTransparencyEnabled(), false);
});

test('initTransparencyMode applies the persisted enabled value to <html>', async () => {
  const { settings, documentElement } = await loadSettings({ 'solarlog-transparency': 'true' });
  settings.initTransparencyMode();
  assert.equal(documentElement.getAttribute('data-transparency'), 'on');
});

test('initTransparencyMode applies the persisted disabled/default value to <html>', async () => {
  const { settings, documentElement } = await loadSettings();
  settings.initTransparencyMode();
  assert.equal(documentElement.getAttribute('data-transparency'), 'off');
});
