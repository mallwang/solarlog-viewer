/**
 * @file DOM-glue orchestrator for the global desktop info panel. Resolves the installation's
 * location, fetches current production (`data/min_cur.js`, same path `dashboard.js`'s widget
 * already uses) and current weather + today's forecast (Open-Meteo) on mount and every ~10
 * minutes (FR-004), renders both into `#info-panel`, drives the production-animation
 * `--intensity`/`data-intensity` tier, and wires the weather/forecast area's wetteronline.com
 * click-through (FR-007). Each data source's "unavailable" state (FR-008) is fully
 * independent — a production or weather/location failure never blocks or resets the other.
 * Visibility below the `md:` breakpoint is CSS-only (index.html's `hidden md:flex`), so this
 * module never needs to know the viewport width. Not unit-tested directly — covered by
 * tests/e2e/info-panel.spec.js, mirroring the sky feature's controller/pure-logic split.
 */

import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { resolveInstallationLocation } from '../sky/location.js';
import { fetchWeatherAndForecast, weatherCodeToLabelKey } from './weather-forecast-client.js';
import { productionIntensity } from './production-animation.js';
import { buildWetteronlineSearchUrl } from './wetteronline-link.js';
import { t } from '../i18n.js';

const POLL_INTERVAL_MS = 10 * 60 * 1000;

/**
 * @returns {string} Today's date as 'DD.MM.YY', matching `parseMinFile`'s expected fallback
 *   format (only used as a fallback for min_cur.js's own embedded date, per min-file.js).
 */
function todayDdMmYy() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`;
}

/**
 * Fetches and parses `data/min_cur.js`, summing all inverters' current AC output.
 * @returns {Promise<{ totalPacW: number, available: true } | { available: false }>}
 */
async function fetchCurrentProduction() {
  const result = await fetchText('data/min_cur.js');
  if (!result.ok) return { available: false };
  const trace = parseMinFile(result.text, todayDdMmYy());
  const [reading] = trace.readings;
  if (!reading) return { available: false };
  const totalPacW = Object.values(reading.perInverter).reduce((s, inv) => s + inv.pacW, 0);
  return { totalPacW, available: true };
}

/**
 * Renders the production side of the panel, including the animation intensity tier. Keeps
 * whatever was last rendered when the fetch reports unavailable, except for flipping the
 * `data-available` flag and the pulse to idle — a genuinely missing reading should not keep
 * animating at a stale intensity.
 * @param {{ pulseEl: HTMLElement, valueEl: HTMLElement, wrapperEl: HTMLElement }} elements
 * @param {{ totalPacW: number, available: true } | { available: false }} production
 * @param {number} capacityKwp
 */
function renderProduction({ pulseEl, valueEl, wrapperEl }, production, capacityKwp) {
  if (!production.available) {
    wrapperEl.dataset.available = 'false';
    valueEl.textContent = t('infoPanel.unavailable');
    pulseEl.dataset.intensity = 'idle';
    return;
  }
  wrapperEl.dataset.available = 'true';
  valueEl.textContent =
    production.totalPacW === 0 ? t('widget.notProducing') : `${production.totalPacW} W`;
  pulseEl.dataset.intensity = productionIntensity(production.totalPacW, capacityKwp);
}

/**
 * Renders the weather/forecast side of the panel.
 * @param {{ linkEl: HTMLAnchorElement, currentEl: HTMLElement, forecastEl: HTMLElement }} elements
 * @param {Awaited<ReturnType<typeof fetchWeatherAndForecast>> | { available: false }} weather
 */
function renderWeather({ linkEl, currentEl, forecastEl }, weather) {
  linkEl.hidden = false;
  if (!weather?.available) {
    linkEl.dataset.available = 'false';
    currentEl.textContent = t('infoPanel.unavailable');
    forecastEl.textContent = '';
    return;
  }
  linkEl.dataset.available = 'true';
  currentEl.textContent = `${t(weatherCodeToLabelKey(weather.weatherCode))} · ${Math.round(weather.temperatureC)}°C`;
  forecastEl.textContent =
    `${t('infoPanel.todayLabel')}: ${t(weatherCodeToLabelKey(weather.todayWeatherCode))} · ` +
    `${Math.round(weather.todayMaxC)}°C / ${Math.round(weather.todayMinC)}°C`;
}

/**
 * Mounts the global desktop info panel: fetches production + weather/forecast immediately,
 * then every `POLL_INTERVAL_MS`. Call once, after `bootstrap()`'s initial render, per
 * plan.md's dynamic-import wiring in `main.js`.
 * @param {{ plant: { location?: string, capacityKwp?: number } | null,
 *   locationOverride?: { lat: number, lon: number } | null }} ctx
 * @returns {() => void} Cleanup function that stops the poll interval.
 */
export async function initInfoPanelController({ plant, locationOverride } = {}) {
  const panel = document.getElementById('info-panel');
  if (!panel) return () => {};

  const elements = {
    pulseEl: document.getElementById('info-panel-pulse'),
    valueEl: document.getElementById('info-panel-production-value'),
    wrapperEl: document.getElementById('info-panel-production'),
    linkEl: document.getElementById('info-panel-weather'),
    currentEl: document.getElementById('info-panel-weather-current'),
    forecastEl: document.getElementById('info-panel-weather-forecast'),
  };

  const wetteronlineUrl = buildWetteronlineSearchUrl(plant?.location);
  if (wetteronlineUrl) {
    elements.linkEl.href = wetteronlineUrl;
  } else {
    elements.linkEl.removeAttribute('href');
  }

  const capacityKwp = plant?.capacityKwp ?? 0;

  async function pollProduction() {
    const production = await fetchCurrentProduction();
    renderProduction(elements, production, capacityKwp);
  }

  async function pollWeather() {
    const location = await resolveInstallationLocation(plant, locationOverride);
    if (!location) {
      renderWeather(elements, { available: false });
      return;
    }
    const weather = await fetchWeatherAndForecast(location);
    renderWeather(elements, weather);
  }

  pollProduction();
  pollWeather();
  const intervalId = setInterval(() => {
    pollProduction();
    pollWeather();
  }, POLL_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
