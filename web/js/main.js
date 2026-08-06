import { fetchText } from './data/fetch-text.js';
import { parseBaseVars } from './data/plant.js';
import { onRouteChange, formatRoute } from './router.js';
import { initI18n, getLanguage, t } from './i18n.js';

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const NAV_ITEMS = [
  { view: 'dashboard', labelKey: 'nav.dashboard', params: {} },
  { view: 'day', labelKey: 'nav.dayView', params: () => todayParams() },
  {
    view: 'month',
    labelKey: 'nav.monthView',
    params: () => {
      const { year, month } = todayParams();
      return { year, month };
    },
  },
  {
    view: 'year',
    labelKey: 'nav.yearView',
    params: () => {
      const { year } = todayParams();
      return { year };
    },
  },
  { view: 'total', labelKey: 'nav.totalView', params: {} },
  { view: 'compare', labelKey: 'nav.compareView', params: {} },
];

let plant = null;
let currentRoute = { view: 'dashboard', params: {} };

const viewMain = document.getElementById('app-main');
const viewNav = document.getElementById('app-nav');
const viewNavList = document.getElementById('app-nav-list');
const navToggle = document.getElementById('app-nav-toggle');
const langSwitcher = document.getElementById('lang-switcher');

function applyNavLabels() {
  viewNav.setAttribute('aria-label', t('nav.ariaLabel'));
  navToggle.setAttribute('aria-label', t('nav.toggleLabel'));
}

function closeNav() {
  navToggle.setAttribute('aria-expanded', 'false');
  viewNavList.dataset.open = 'false';
}

function renderNav() {
  applyNavLabels();
  viewNavList.innerHTML = '';
  for (const item of NAV_ITEMS) {
    const params = typeof item.params === 'function' ? item.params() : item.params;
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = formatRoute({ view: item.view, params });
    link.textContent = t(item.labelKey);
    if (currentRoute.view === item.view) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', () => closeNav());
    li.append(link);
    viewNavList.append(li);
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

function renderLangSwitcher() {
  langSwitcher.innerHTML = '';
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
  dashboard: () => import('./views/dashboard.js'),
  day: () => import('./views/day-view.js'),
  month: () => import('./views/month-view.js'),
  year: () => import('./views/year-view.js'),
  total: () => import('./views/total-view.js'),
  compare: () => import('./views/compare-view.js'),
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
  await initI18n();
  renderLangSwitcher();
  initNavToggle();

  const result = await fetchText('data/base_vars.js');
  if (result.ok) {
    plant = parseBaseVars(result.text);
    document.getElementById('app-title').textContent = plant.title || 'SolarLog Viewer';
  }

  onRouteChange((route) => {
    dispatch(route);
  });
}

bootstrap();
