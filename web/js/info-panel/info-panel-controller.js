/**
 * @file DOM-glue orchestrator for the global info panel. Resolves the installation's location,
 * fetches the live current-production wattage (`live-reading-client.js`, the live status endpoint
 * — see specs/027-navbar-live-panel/) on mount and every `LIVE_REFRESH_INTERVAL_MS`, fully
 * decoupled from today's/this month's yield-so-far (`data/days.js` + `months.js`, same figures
 * the disabled dashboard used to show — see renderYield below), which still polls on
 * `DATA_REFRESH_INTERVAL_MS` (config.js; FR-004) — the same constant `views/day-view.js` uses for
 * its own today-only auto-refresh, so the yield figure and the day chart stay in lockstep. Current
 * weather + today's forecast (Open-Meteo) poll separately on their own, slower
 * `WEATHER_REFRESH_INTERVAL_MS` (weather doesn't change meaningfully minute to minute). Renders
 * all three, drives the production-animation pulse's size/speed tier (`data-intensity`) and its
 * continuous red→orange→yellow→green color (`--pulse-color`, from `productionColor()`), links the
 * production value to today's day view (mirroring `dashboard.js`'s widget), and wires the
 * weather/forecast area's wetteronline.com click-through (FR-007). Each data source's
 * "unavailable" state (FR-008) is fully independent — a production, yield, or weather/location
 * failure never blocks or resets the others. The live reading keeps its last-known-good value on
 * screen through a failed poll (FR-005/FR-006, research.md §3 of specs/027-navbar-live-panel/),
 * guards against out-of-order responses with a request-sequence token (FR-008, research.md §4),
 * and re-polls promptly on tab refocus (FR-009, research.md §5).
 *
 * The panel exists twice in the DOM (see index.html): `.info-panel--desktop` inside
 * `.app-nav__end`, sharing the persistent nav row with the nav links and the desktop
 * transparency toggle (visible from `md:` up), and `.info-panel--mobile` as its own full-width
 * bar below the nav (visible below `md:`) — CSS alone decides which one is actually shown per
 * viewport width, so this module treats them identically and just updates every element
 * matching a given `[data-role]` in both at once. Not unit-tested directly — covered by
 * tests/e2e/info-panel.spec.js, mirroring the sky feature's controller/pure-logic split.
 */

import {
  parseDailyTotalsFile,
  parseMonthsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
  addMissingDays,
} from '../data/aggregates.js';
import { fetchText } from '../data/fetch-text.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { efficiencyPercent } from '../data/efficiency.js';
import { formatKwh, formatNumber } from '../format.js';
import { resolveInstallationLocation } from '../sky/location.js';
import { formatRoute } from '../router.js';
import { fetchLiveReading } from './live-reading-client.js';
import { fetchWeatherAndForecast, weatherCodeToLabelKey } from './weather-forecast-client.js';
import { weatherCodeToCategory } from '../weather/weather-category.js';
import { weatherCategoryToIcon, MOON_ICON } from '../weather/weather-icon.js';
import { isDaytime } from '../weather/daytime.js';
import { buildCurrentWeatherText, buildForecastWeatherText } from '../weather/weather-text.js';
import {
  productionIntensity,
  productionColor,
  PRODUCTION_COLOR_IDLE,
} from './production-animation.js';
import { buildWetteronlineSearchUrl } from './wetteronline-link.js';
import { t } from '../i18n.js';
import {
  DATA_REFRESH_INTERVAL_MS,
  LIVE_REFRESH_INTERVAL_MS,
  WEATHER_REFRESH_INTERVAL_MS,
  FORECAST_DAY_SWITCH_HOUR,
} from '../config.js';

/**
 * @returns {{ year: number, month: number, day: number }} Today's date in Route-param shape
 *   (1-indexed month), matching `dashboard.js`'s own `todayParams()`.
 */
function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * @returns {string} Today's date as ISO 'YYYY-MM-DD', matching parseDailyTotalsFile's date shape.
 */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function sumWh(perInverter) {
  return Object.values(perInverter).reduce((s, v) => s + (v.yieldWh ?? v), 0);
}

/**
 * Fetches today's and this month's yield-so-far, mirroring the (temporarily disabled) dashboard
 * widget's own figures: today's total straight from `days.js`, and the current month's total
 * from `months.js` with every daily total newer than its checkpoint folded in on top (months.js
 * is only written at day rollover, and isn't guaranteed to hit every one — see addMissingDays)
 * so it always agrees with the month detail view.
 * @returns {Promise<{ todayKwh: number, monthKwh: number, available: true } | { available: false }>}
 */
async function fetchYield() {
  const { year, month } = todayParams();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const [daysResult, daysHistResult, { hist, data }] = await Promise.all([
    fetchText('data/days.js'),
    fetchText('data/days_hist.js'),
    fetchFromBothSources('months.js'),
  ]);
  if (!daysResult.ok) return { available: false };

  const todayEntry = parseDailyTotalsFile(daysResult.text).find((d) => d.date === todayIso());
  if (!todayEntry) return { available: false };

  const months = mergeMonthlyTotals(
    hist.ok ? parseMonthsFile(hist.text) : [],
    data.ok ? parseMonthsFile(data.text) : [],
  );
  const monthDailyBreakdown = mergeDailyTotals(
    daysHistResult.ok ? parseDailyTotalsFile(daysHistResult.text) : [],
    [todayEntry],
  ).filter((d) => d.date.startsWith(monthKey));
  const thisMonth = addMissingDays(
    months.find((m) => m.month === monthKey) ?? { month: monthKey, perInverter: {} },
    monthDailyBreakdown,
  );

  return {
    todayKwh: sumWh(todayEntry.perInverter) / 1000,
    monthKwh: sumWh(thisMonth.perInverter) / 1000,
    available: true,
  };
}

/**
 * @param {{ totalPacW: number, perInverter?: object, available: true } | { available: false }}
 *   production
 * @returns {string} Display text for the production value, per the "0 W is real, idle" and
 *   "unavailable" states; appends the rounded efficiency percentage (e.g. "1234 W · 94%") when
 *   `efficiencyPercent` returns a value, per FR-002/FR-003. The live-endpoint-sourced reading
 *   never carries a `perInverter` field, so `efficiencyPercent(undefined)` safely returns `null`
 *   and this suffix drops silently (research.md §6, specs/027-navbar-live-panel/).
 */
function productionValueText(production) {
  if (!production.available) return t('infoPanel.unavailable');
  if (production.totalPacW === 0) return t('widget.notProducing');
  const efficiency = efficiencyPercent(production.perInverter);
  if (efficiency === null) return `${production.totalPacW} W`;
  return `${production.totalPacW} W · ${formatNumber(efficiency, { decimals: 0 })}%`;
}

/**
 * @param {{ timestamp: string, available: true } | { available: false }} production
 * @returns {string} "Stand: HH:MM" (localized label), so the user can tell whether the wattage
 *   above is current or stale (e.g. the live endpoint not refreshed recently); empty when
 *   unavailable, since `productionValueText` already renders that state's own message.
 */
function productionTimestampText(production) {
  if (!production.available) return '';
  return `${t('infoPanel.asOfLabel')}: ${production.timestamp.slice(11, 16)}`;
}

/**
 * Renders the production side of every panel variant, including the animation intensity tier.
 * Keeps whatever was last rendered when the fetch reports unavailable, except for flipping the
 * `data-available` flag and the pulse to idle — a genuinely missing reading should not keep
 * animating at a stale intensity.
 * @param {{ pulseEls: NodeListOf<HTMLElement>, valueEls: NodeListOf<HTMLElement>,
 *   timestampEls: NodeListOf<HTMLElement>, wrapperEls: NodeListOf<HTMLElement> }} elements
 * @param {{ totalPacW: number, available: true } | { available: false }} production
 * @param {number} capacityKwp
 */
function renderProduction(
  { pulseEls, valueEls, timestampEls, wrapperEls },
  production,
  capacityKwp,
) {
  const intensity = production.available
    ? productionIntensity(production.totalPacW, capacityKwp)
    : 'idle';
  const color = production.available
    ? productionColor(production.totalPacW, capacityKwp)
    : PRODUCTION_COLOR_IDLE;
  const valueText = productionValueText(production);
  const timestampText = productionTimestampText(production);

  wrapperEls.forEach((el) => {
    el.dataset.available = String(production.available);
  });
  valueEls.forEach((el) => {
    el.textContent = valueText;
  });
  timestampEls.forEach((el) => {
    el.textContent = timestampText;
  });
  pulseEls.forEach((el) => {
    el.dataset.intensity = intensity;
    el.style.setProperty('--pulse-color', color);
  });
}

/**
 * Renders the yield-so-far side of every panel variant (temporary stand-in for the disabled
 * dashboard — see this file's top comment): plain text, not a link, so it's deliberately not
 * wired up like `.info-panel__production`/`.info-panel__weather` above.
 * @param {{ todayEls: NodeListOf<HTMLElement>, monthEls: NodeListOf<HTMLElement> }} elements
 * @param {{ todayKwh: number, monthKwh: number, available: true } | { available: false }} yield_
 */
function renderYield({ todayEls, monthEls }, yield_) {
  const todayText = yield_.available
    ? `${t('widget.todayYield')}: ${formatKwh(yield_.todayKwh, { decimals: 2 })}`
    : t('infoPanel.unavailable');
  const monthText = yield_.available
    ? `${t('widget.monthYield')}: ${formatKwh(yield_.monthKwh, { decimals: 2 })}`
    : '';

  todayEls.forEach((el) => {
    el.textContent = todayText;
  });
  monthEls.forEach((el) => {
    el.textContent = monthText;
  });
}

/**
 * Renders one compact weather indicator's DOM (025-weather-icon-compact, data-model.md's
 * "Compact Weather Indicator" shape): a decorative icon, a short value beneath it (temperature or
 * range) when available — nothing but the dimmed dash icon otherwise — and a decorative floating
 * tooltip holding the full previous inline text. Sets `data-available` and `aria-label`
 * (unconditionally, not only while hovered/focused — FR-006/research.md §2) on `el` itself, which
 * already carries `tabindex="0"` from index.html so it's keyboard-reachable.
 * @param {HTMLElement} el - A `[data-role="weather-current"]`/`[data-role="weather-forecast"]`
 *   wrapper element.
 * @param {{ icon: string, compactValue: string, fullText: string, available: boolean }} text -
 *   Output of `buildCurrentWeatherText()`/`buildForecastWeatherText()` (weather-text.js).
 * @param {string} valueClass - `info-panel__weather-temp` or `info-panel__weather-range`.
 */
function renderWeatherIndicator(el, text, valueClass) {
  el.textContent = '';
  el.dataset.available = String(text.available);
  el.setAttribute('aria-label', text.fullText);

  const iconEl = document.createElement('span');
  iconEl.className = 'info-panel__weather-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = text.icon;
  el.append(iconEl);

  if (text.available) {
    const valueEl = document.createElement('span');
    valueEl.className = valueClass;
    valueEl.textContent = text.compactValue;
    el.append(valueEl);
  }

  // Decorative only — aria-hidden since `aria-label` above already covers assistive tech
  // regardless of hover/focus/tap state (Constraints, research.md §2).
  const tooltipEl = document.createElement('span');
  tooltipEl.className = 'info-panel__weather-tooltip';
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.textContent = text.fullText;
  el.append(tooltipEl);
}

/**
 * Renders the weather/forecast side of every panel variant as two compact icon-over-value
 * indicators, each independently available/unavailable (FR-007). The current-conditions
 * indicator shows `<icon>` / `<temp>°C`, with a nighttime-only "sunny"→moon/"clear" override
 * (FR-011/FR-012/FR-013, data-model.md's "Nighttime Clear Display") folded into its full text.
 * The forecast indicator shows `<icon>` / `<low>° - <high>°` for whichever day is selected
 * (switching at `FORECAST_DAY_SWITCH_HOUR`, FR-004/FR-014), with its full text keeping the
 * "Heute:"/"Morgen:" prefix; it now renders the same dimmed dash "unavailable" shape as
 * current-conditions when that day's fields don't parse, instead of rendering nothing
 * (data-model.md's "Unavailable" column, research.md §5 — a behavior change from
 * 023-weather-panel-icons). Both indicators' compact/full text come from the single
 * `weather-text.js` source of truth so they can never drift apart (FR-004).
 * @param {{ linkEls: NodeListOf<HTMLAnchorElement>, currentEls: NodeListOf<HTMLElement>,
 *   forecastEls: NodeListOf<HTMLElement> }} elements
 * @param {Awaited<ReturnType<typeof fetchWeatherAndForecast>> | { available: false }} weather
 */
function renderWeather({ linkEls, currentEls, forecastEls }, weather) {
  const available = Boolean(weather?.available);
  const unavailableText = t('infoPanel.unavailable');

  linkEls.forEach((el) => {
    el.hidden = false;
    el.dataset.available = String(available);
  });

  currentEls.forEach((el) => {
    if (!available) {
      renderWeatherIndicator(
        el,
        buildCurrentWeatherText({ available: false, unavailableText }),
        'info-panel__weather-temp',
      );
      return;
    }

    const category = weatherCodeToCategory(weather.weatherCode);
    const isNighttimeSunny =
      category === 'sunny' && isDaytime(new Date(), weather.sunrise, weather.sunset) === false;
    const icon = isNighttimeSunny ? MOON_ICON : weatherCategoryToIcon(category);
    const label = isNighttimeSunny
      ? t('infoPanel.weatherCategory.clear')
      : t(weatherCodeToLabelKey(weather.weatherCode));

    renderWeatherIndicator(
      el,
      buildCurrentWeatherText({ available: true, icon, label, temperatureC: weather.temperatureC }),
      'info-panel__weather-temp',
    );
  });

  forecastEls.forEach((el) => {
    const isToday = new Date().getHours() < FORECAST_DAY_SWITCH_HOUR;
    let weatherCode;
    let maxC;
    let minC;
    if (available) {
      weatherCode = isToday ? weather.todayWeatherCode : weather.tomorrowWeatherCode;
      maxC = isToday ? weather.todayMaxC : weather.tomorrowMaxC;
      minC = isToday ? weather.todayMinC : weather.tomorrowMinC;
    }
    const dayAvailable =
      available && Number.isFinite(weatherCode) && Number.isFinite(maxC) && Number.isFinite(minC);

    if (!dayAvailable) {
      renderWeatherIndicator(
        el,
        buildForecastWeatherText({ available: false, unavailableText }),
        'info-panel__weather-range',
      );
      return;
    }

    const prefixText = isToday ? t('infoPanel.todayLabel') : t('infoPanel.tomorrowLabel');
    const icon = weatherCategoryToIcon(weatherCodeToCategory(weatherCode));
    const label = t(weatherCodeToLabelKey(weatherCode));

    renderWeatherIndicator(
      el,
      buildForecastWeatherText({ available: true, icon, label, prefixText, minC, maxC }),
      'info-panel__weather-range',
    );
  });
}

/**
 * Wires the tap-to-reveal fallback for touch/sighted users whose browser doesn't move focus (and
 * therefore doesn't trigger `:focus-within`) on a bare tap of a non-form focusable element
 * (research.md §3). Toggles `data-open="true"` on the tapped indicator — purely visual, CSS-only
 * (mirrors `:hover`/`:focus-within`); accessibility is already covered by the unconditional
 * `aria-label` set in `renderWeatherIndicator()`, independent of this. Closed by tapping/clicking
 * outside either indicator or pressing Escape. Wired once at mount time, not per render, since
 * `renderWeather()` only replaces each indicator's children, never these wrapper elements.
 * @param {HTMLElement[]} indicatorEls - The current-conditions and forecast wrapper elements
 *   (desktop + mobile panel copies combined).
 */
function wireWeatherTapToggle(indicatorEls) {
  function closeAll() {
    indicatorEls.forEach((el) => delete el.dataset.open);
  }

  function toggle(el) {
    const wasOpen = el.dataset.open === 'true';
    closeAll();
    if (!wasOpen) el.dataset.open = 'true';
  }

  indicatorEls.forEach((el) => {
    el.addEventListener('touchstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle(el);
    });
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      toggle(el);
    });
  });

  document.addEventListener('click', closeAll);
  document.addEventListener('touchstart', closeAll);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

/**
 * Mounts the global info panel: fetches the live production reading + yield + weather/forecast
 * immediately, then re-polls each on its own fully independent timer (config.js) — live
 * production on `LIVE_REFRESH_INTERVAL_MS`, yield on `DATA_REFRESH_INTERVAL_MS`, weather/forecast
 * on the slower `WEATHER_REFRESH_INTERVAL_MS` — so none of the three cycles trigger or block each
 * other (FR-002/SC-002, specs/027-navbar-live-panel/). The live reading keeps the last
 * successfully-fetched value on screen through a failed poll (FR-005/FR-006), only ever applies
 * the most recently *started* poll's result via a request-sequence guard (FR-008), and re-polls
 * immediately when the tab regains visibility (FR-009). Call once, after `bootstrap()`'s initial
 * render, per plan.md's dynamic-import wiring in `main.js`.
 * @param {{ plant: { location?: string, capacityKwp?: number } | null,
 *   locationOverride?: { lat: number, lon: number } | null }} ctx
 * @returns {() => void} Cleanup function that stops all poll intervals and listeners.
 */
export async function initInfoPanelController({ plant, locationOverride } = {}) {
  if (document.querySelectorAll('[data-info-panel]').length === 0) return () => {};

  const elements = {
    pulseEls: document.querySelectorAll('[data-role="pulse"]'),
    valueEls: document.querySelectorAll('[data-role="production-value"]'),
    timestampEls: document.querySelectorAll('[data-role="production-timestamp"]'),
    wrapperEls: document.querySelectorAll('[data-role="production"]'),
    todayYieldEls: document.querySelectorAll('[data-role="yield-today"]'),
    monthYieldEls: document.querySelectorAll('[data-role="yield-month"]'),
    linkEls: document.querySelectorAll('[data-role="weather"]'),
    currentEls: document.querySelectorAll('[data-role="weather-current"]'),
    forecastEls: document.querySelectorAll('[data-role="weather-forecast"]'),
  };

  wireWeatherTapToggle([...elements.currentEls, ...elements.forecastEls]);

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

  // Last-known-good live reading (research.md §3 of specs/027-navbar-live-panel/) — only ever
  // *replaced* on a successful poll, so a failed tick keeps rendering whatever this already
  // holds; starts as "never fetched" (FR-006), which a session can never return to once any poll
  // has succeeded.
  let lastGoodProduction = { available: false };
  // Monotonic request-sequence guard (FR-008, research.md §4): each poll captures its own `seq`
  // before awaiting the fetch and only applies its result if it's still the most recently
  // *started* poll when the fetch resolves — avoids a stale, slow response overwriting a newer
  // one without blocking overlapping requests outright (needed so the visibility-regain repoll
  // below can't be a no-op while a regular poll is still in flight).
  let requestSeq = 0;

  async function pollProduction() {
    const seq = ++requestSeq;
    const reading = await fetchLiveReading();
    if (seq !== requestSeq) return;
    if (reading.available) {
      lastGoodProduction = {
        totalPacW: reading.watt,
        timestamp: reading.timestamp,
        available: true,
      };
    }
    renderProduction(elements, lastGoodProduction, capacityKwp);
  }

  async function pollYield() {
    const yield_ = await fetchYield();
    renderYield({ todayEls: elements.todayYieldEls, monthEls: elements.monthYieldEls }, yield_);
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

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') pollProduction();
  }

  pollProduction();
  pollYield();
  pollWeather();
  const liveIntervalId = setInterval(pollProduction, LIVE_REFRESH_INTERVAL_MS);
  const dataIntervalId = setInterval(pollYield, DATA_REFRESH_INTERVAL_MS);
  const weatherIntervalId = setInterval(pollWeather, WEATHER_REFRESH_INTERVAL_MS);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    clearInterval(liveIntervalId);
    clearInterval(dataIntervalId);
    clearInterval(weatherIntervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
