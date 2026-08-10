/**
 * @file DOM-glue orchestrator for the global info panel. Resolves the installation's location,
 * fetches current production (`data/min_cur.js`, same path `dashboard.js`'s widget already
 * uses) and current weather + today's forecast (Open-Meteo) on mount and every ~10 minutes
 * (FR-004), renders both, drives the production-animation pulse's size/speed tier
 * (`data-intensity`) and its continuous red→orange→yellow→green color (`--pulse-color`, from
 * `productionColor()`), links the production value to today's day view (mirroring
 * `dashboard.js`'s widget), and
 * wires the weather/forecast area's wetteronline.com click-through (FR-007). Each data
 * source's "unavailable" state (FR-008) is fully independent — a production or weather/location
 * failure never blocks or resets the other.
 *
 * The panel exists twice in the DOM (see index.html): `.info-panel--desktop` inside
 * `.app-nav__end`, sharing the persistent nav row with the nav links and the desktop
 * transparency toggle (visible from `md:` up), and `.info-panel--mobile` as its own full-width
 * bar below the nav (visible below `md:`) — CSS alone decides which one is actually shown per
 * viewport width, so this module treats them identically and just updates every element
 * matching a given `[data-role]` in both at once. Not unit-tested directly — covered by
 * tests/e2e/info-panel.spec.js, mirroring the sky feature's controller/pure-logic split.
 */

import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { resolveInstallationLocation } from '../sky/location.js';
import { formatRoute } from '../router.js';
import { fetchWeatherAndForecast, weatherCodeToLabelKey } from './weather-forecast-client.js';
import {
  productionIntensity,
  productionColor,
  PRODUCTION_COLOR_IDLE,
} from './production-animation.js';
import { buildWetteronlineSearchUrl } from './wetteronline-link.js';
import { t } from '../i18n.js';

const POLL_INTERVAL_MS = 10 * 60 * 1000;

/**
 * @returns {{ year: number, month: number, day: number }} Today's date in Route-param shape
 *   (1-indexed month), matching `dashboard.js`'s own `todayParams()`.
 */
function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

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
 * @param {{ totalPacW: number, available: true } | { available: false }} production
 * @returns {string} Display text for the production value, per the "0 W is real, idle" and
 *   "unavailable" states.
 */
function productionValueText(production) {
  if (!production.available) return t('infoPanel.unavailable');
  return production.totalPacW === 0 ? t('widget.notProducing') : `${production.totalPacW} W`;
}

/**
 * Renders the production side of every panel variant, including the animation intensity tier.
 * Keeps whatever was last rendered when the fetch reports unavailable, except for flipping the
 * `data-available` flag and the pulse to idle — a genuinely missing reading should not keep
 * animating at a stale intensity.
 * @param {{ pulseEls: NodeListOf<HTMLElement>, valueEls: NodeListOf<HTMLElement>,
 *   wrapperEls: NodeListOf<HTMLElement> }} elements
 * @param {{ totalPacW: number, available: true } | { available: false }} production
 * @param {number} capacityKwp
 */
function renderProduction({ pulseEls, valueEls, wrapperEls }, production, capacityKwp) {
  const intensity = production.available
    ? productionIntensity(production.totalPacW, capacityKwp)
    : 'idle';
  const color = production.available
    ? productionColor(production.totalPacW, capacityKwp)
    : PRODUCTION_COLOR_IDLE;
  const valueText = productionValueText(production);

  wrapperEls.forEach((el) => {
    el.dataset.available = String(production.available);
  });
  valueEls.forEach((el) => {
    el.textContent = valueText;
  });
  pulseEls.forEach((el) => {
    el.dataset.intensity = intensity;
    el.style.setProperty('--pulse-color', color);
  });
}

/**
 * Renders the weather/forecast side of every panel variant.
 * @param {{ linkEls: NodeListOf<HTMLAnchorElement>, currentEls: NodeListOf<HTMLElement>,
 *   forecastEls: NodeListOf<HTMLElement> }} elements
 * @param {Awaited<ReturnType<typeof fetchWeatherAndForecast>> | { available: false }} weather
 */
function renderWeather({ linkEls, currentEls, forecastEls }, weather) {
  const available = Boolean(weather?.available);
  const currentText = available
    ? `${t(weatherCodeToLabelKey(weather.weatherCode))} · ${Math.round(weather.temperatureC)}°C`
    : t('infoPanel.unavailable');
  const forecastText = available
    ? `${t('infoPanel.todayLabel')}: ${t(weatherCodeToLabelKey(weather.todayWeatherCode))} · ` +
      `${Math.round(weather.todayMaxC)}°C / ${Math.round(weather.todayMinC)}°C`
    : '';

  linkEls.forEach((el) => {
    el.hidden = false;
    el.dataset.available = String(available);
  });
  currentEls.forEach((el) => {
    el.textContent = currentText;
  });
  forecastEls.forEach((el) => {
    el.textContent = forecastText;
  });
}

/**
 * Mounts the global info panel: fetches production + weather/forecast immediately, then every
 * `POLL_INTERVAL_MS`. Call once, after `bootstrap()`'s initial render, per plan.md's
 * dynamic-import wiring in `main.js`.
 * @param {{ plant: { location?: string, capacityKwp?: number } | null,
 *   locationOverride?: { lat: number, lon: number } | null }} ctx
 * @returns {() => void} Cleanup function that stops the poll interval.
 */
export async function initInfoPanelController({ plant, locationOverride } = {}) {
  if (document.querySelectorAll('[data-info-panel]').length === 0) return () => {};

  const elements = {
    pulseEls: document.querySelectorAll('[data-role="pulse"]'),
    valueEls: document.querySelectorAll('[data-role="production-value"]'),
    wrapperEls: document.querySelectorAll('[data-role="production"]'),
    linkEls: document.querySelectorAll('[data-role="weather"]'),
    currentEls: document.querySelectorAll('[data-role="weather-current"]'),
    forecastEls: document.querySelectorAll('[data-role="weather-forecast"]'),
  };

  const wetteronlineUrl = buildWetteronlineSearchUrl(plant?.location);
  elements.linkEls.forEach((el) => {
    if (wetteronlineUrl) {
      el.href = wetteronlineUrl;
    } else {
      el.removeAttribute('href');
    }
  });

  // Links the production value to today's day view, mirroring the dashboard's own current-
  // production widget (web/js/views/dashboard.js) — set once at mount like the wetteronline
  // link above, since "today" doesn't change within a single page session.
  const dayHref = formatRoute({ view: 'day', params: todayParams() });
  elements.wrapperEls.forEach((el) => {
    el.href = dayHref;
  });

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
