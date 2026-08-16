import { fetchText } from './data/fetch-text.js';
import { parseBaseVars } from './data/plant.js';
import { onRouteChange, formatRoute } from './router.js';
import { initI18n, getLanguage, t } from './i18n.js';
import { initTransparencyMode, isTransparencyEnabled, setTransparencyEnabled } from './settings.js';
import { SHOW_LANGUAGE_SWITCHER, SKY_LOCATION_OVERRIDE, SITE_TITLE } from './config.js';
import { icon } from './icons.js';
import { initInfoTooltips } from './views/stats-panel.js';

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

// The dashboard nav item is temporarily removed (see views/dashboard.js) pending a redesign;
// its "today so far" figures live on in the info panel's yield element instead (see
// info-panel/info-panel-controller.js).
const NAV_ITEMS = [
  { view: 'welcome', labelKey: 'nav.welcomeView', icon: 'homeModern', params: {} },
  { view: 'day', labelKey: 'nav.dayView', icon: 'bolt', params: () => todayParams() },
  {
    view: 'month',
    labelKey: 'nav.monthView',
    icon: 'calendarDateRange',
    params: () => {
      const { year, month } = todayParams();
      return { year, month };
    },
  },
  {
    view: 'year',
    labelKey: 'nav.yearView',
    icon: 'calendar',
    params: () => {
      const { year } = todayParams();
      return { year };
    },
  },
  { view: 'total', labelKey: 'nav.totalView', icon: 'presentationChartBar', params: {} },
  {
    view: 'statistics',
    labelKey: 'nav.statisticsView',
    icon: 'chartBar',
    params: { topic: 'common' },
  },
  { view: 'events', labelKey: 'nav.eventsView', icon: 'listBullet', params: {} },
  // External link, not a routed view: opens the language-specific user guide on GitHub in a
  // new tab. `href` is a function (not a static string) so it re-resolves the language-specific
  // file (docs/user-guide.md vs docs/user-guide.de.md) on every renderNav() call, picking up a
  // language switch without a page reload.
  {
    view: 'userGuide',
    labelKey: 'nav.userGuideView',
    icon: 'documentText',
    external: true,
    href: () =>
      `https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide${
        getLanguage() === 'de' ? '.de' : ''
      }.md`,
  },
];

let plant = null;
let currentRoute = { view: 'day', params: todayParams() };

const viewMain = document.getElementById('app-main');
const viewNav = document.getElementById('app-nav');
const viewNavList = document.getElementById('app-nav-list');
const navToggle = document.getElementById('app-nav-toggle');
const langSwitcher = document.getElementById('lang-switcher');
// A NodeList rather than a single element — currently always exactly one (`.transparency-
// toggle` in `.app-header__actions`), but kept as a NodeList so a future second instance (e.g.
// a mobile-specific one) would need no change here, only in initTransparencyToggle's callers.
const transparencyToggles = document.querySelectorAll('.transparency-toggle');

function applyNavLabels() {
  viewNav.setAttribute('aria-label', t('nav.ariaLabel'));
  navToggle.setAttribute('aria-label', t('nav.toggleLabel'));
  transparencyToggles.forEach((toggle) => {
    toggle.setAttribute('aria-label', t('nav.transparencyToggleLabel'));
  });
}

function closeNav() {
  navToggle.setAttribute('aria-expanded', 'false');
  viewNavList.dataset.open = 'false';
}

function renderNav() {
  applyNavLabels();
  viewNavList.innerHTML = '';
  for (const item of NAV_ITEMS) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    if (item.external) {
      // Not a routed view — an outbound link to the GitHub-hosted user guide, so it gets its
      // own branch here rather than going through formatRoute()/aria-current below. Plain
      // document icon, no visible "opens in new tab" badge (reads more natural alongside the
      // other nav icons) — the sr-only suffix still tells screen-reader users it leaves the app.
      link.href = item.href();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = `${icon(item.icon)}<span>${t(item.labelKey)}<span class="sr-only"> (${t(
        'nav.opensNewTab',
      )})</span></span>`;
    } else {
      const params = typeof item.params === 'function' ? item.params() : item.params;
      link.href = formatRoute({ view: item.view, params });
      link.innerHTML = `${icon(item.icon)}<span>${t(item.labelKey)}</span>`;
      if (currentRoute.view === item.view) link.setAttribute('aria-current', 'page');
    }
    link.addEventListener('click', () => closeNav());
    li.append(link);
    viewNavList.append(li);
  }
}

/**
 * Keeps the `--chrome-height` custom property in sync with the actual rendered top of
 * `#app-main`, so the animated `.sky-clouds` backdrop (fixed, positioned via that variable —
 * see app.css) starts exactly below whatever chrome precedes it — instead of being clipped by
 * it or leaving a gap — regardless of how many bars that chrome is made of (the combined
 * header+nav row alone on desktop; header row + the mobile info sub-nav bar on mobile — see
 * index.html). Also the `top` offset every view's sticky `.view-header` (014-chart-data-table-
 * toggle) sticks to, directly below the now-also-sticky `.app-chrome` — so a stale value here no
 * longer just misplaces the sky's clipping by a few px, it visibly hides the view title/nav
 * behind the header on scroll. Chrome height isn't a fixed constant: it depends on font
 * rendering and can change whenever its own content does — window resize, the nav list filling
 * in (renderNav runs after the first `updateChromeHeight` call in bootstrap(), below), a language
 * switch changing label lengths enough to reflow the wrap — so `initChromeHeightSync` below wires
 * a `ResizeObserver` on `.app-chrome` itself instead of only re-measuring on specific known
 * events, catching every future cause of a size change too.
 */
function updateChromeHeight() {
  const top = Math.max(viewMain.getBoundingClientRect().top, 60);
  document.documentElement.style.setProperty('--chrome-height', `${Math.ceil(top)}px`);
}

/** Wires updateChromeHeight() to fire on load, resize, and every `.app-chrome` size change. */
function initChromeHeightSync() {
  updateChromeHeight();
  window.addEventListener('resize', updateChromeHeight);
  const appChrome = document.querySelector('.app-chrome');
  if (appChrome && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(updateChromeHeight).observe(appChrome);
  }
}

function initNavToggle() {
  navToggle.addEventListener('click', () => {
    const isOpen = viewNavList.dataset.open === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    viewNavList.dataset.open = String(!isOpen);
  });

  document.addEventListener('click', (event) => {
    if (viewNavList.dataset.open !== 'true') return;
    if (event.target === navToggle || navToggle.contains(event.target)) return;
    if (viewNavList.contains(event.target)) return;
    closeNav();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && viewNavList.dataset.open === 'true') {
      closeNav();
      navToggle.focus();
    }
  });
}

function renderTransparencyToggle() {
  // eye-slash once transparency mode has hidden the panels' backgrounds, eye while they're
  // still opaque/"visible" — the icon always names the state currently in effect, not the
  // action a click would perform (matches the pulse/production icons elsewhere, which are
  // likewise state, not affordance).
  const enabled = isTransparencyEnabled();
  transparencyToggles.forEach((toggle) => {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.innerHTML = icon(enabled ? 'eyeSlash' : 'eye', 'size-5');
  });
}

function initTransparencyToggle() {
  renderTransparencyToggle();
  transparencyToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      setTransparencyEnabled(!isTransparencyEnabled());
      renderTransparencyToggle();
    });
  });
}

function renderLangSwitcher() {
  langSwitcher.innerHTML = '';
  if (!SHOW_LANGUAGE_SWITCHER) {
    langSwitcher.hidden = true;
    return;
  }
  for (const lang of ['de', 'en']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = lang.toUpperCase();
    button.setAttribute('aria-pressed', String(getLanguage() === lang));
    button.addEventListener('click', async () => {
      const { setLanguage } = await import('./i18n.js');
      await setLanguage(lang);
      renderNav();
      renderLangSwitcher();
      await dispatch(currentRoute);
    });
    langSwitcher.append(button);
  }
}

const viewModules = {
  welcome: () => import('./views/welcome-view.js'),
  dashboard: () => import('./views/dashboard.js'),
  day: () => import('./views/day-view.js'),
  month: () => import('./views/month-view.js'),
  year: () => import('./views/year-view.js'),
  total: () => import('./views/total-view.js'),
  statistics: () => import('./views/statistics/statistics-view.js'),
  events: () => import('./views/events-view.js'),
};

let currentViewCleanup = null;

async function dispatch(route) {
  currentViewCleanup?.();
  currentViewCleanup = null;

  currentRoute = route;
  renderNav();
  const loadView = viewModules[route.view];
  if (!loadView) {
    viewMain.innerHTML = '';
    return;
  }
  const module = await loadView();
  currentViewCleanup = (await module.render(viewMain, { plant, route })) ?? null;
}

async function bootstrap() {
  initTransparencyMode();
  await initI18n();
  renderLangSwitcher();
  initNavToggle();
  initTransparencyToggle();
  initChromeHeightSync();
  initInfoTooltips();

  const result = await fetchText('data/base_vars.js');
  if (result.ok) {
    plant = parseBaseVars(result.text);
  }
  // SITE_TITLE (config.js) wins over the plant's device-generated HPTitel (e.g.
  // "Photovoltaikanlage Allwang") whenever it's set; both the nav brand and the browser tab
  // get the same name.
  const siteTitle = SITE_TITLE || plant?.title || 'SolarLog Viewer';
  document.getElementById('app-title').textContent = siteTitle;
  document.title = siteTitle;

  // Dynamically imported so the sky background never delays first render of the actual
  // PV-data dashboard; failures inside it are self-contained (FR-005) and don't affect
  // navigation/dispatch below.
  import('./sky/sky-controller.js').then(({ initSkyController }) =>
    initSkyController({ plant, locationOverride: SKY_LOCATION_OVERRIDE }),
  );

  // Same lazy-init pattern as the sky controller above: the global desktop info panel's
  // production/weather polling never delays first render, and mounts once here so it
  // persists across in-app route changes (FR-011) rather than being re-created per view.
  import('./info-panel/info-panel-controller.js').then(({ initInfoPanelController }) =>
    initInfoPanelController({ plant, locationOverride: SKY_LOCATION_OVERRIDE }),
  );

  onRouteChange((route) => {
    dispatch(route);
  });
}

bootstrap();
