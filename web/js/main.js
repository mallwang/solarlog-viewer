import { fetchText } from './data/fetch-text.js';
import { parseBaseVars } from './data/plant.js';
import { onRouteChange, formatRoute } from './router.js';
import { initI18n, getLanguage, t } from './i18n.js';

const NAV_ITEMS = [
  { view: 'dashboard', labelKey: 'nav.dashboard' },
  { view: 'total', labelKey: 'nav.totalView' },
  { view: 'compare', labelKey: 'nav.compareView' },
];

let plant = null;
let currentRoute = { view: 'dashboard', params: {} };

const viewMain = document.getElementById('app-main');
const viewNav = document.getElementById('app-nav');
const langSwitcher = document.getElementById('lang-switcher');

function renderNav() {
  viewNav.innerHTML = '';
  for (const item of NAV_ITEMS) {
    const link = document.createElement('a');
    link.href = formatRoute({ view: item.view, params: {} });
    link.textContent = t(item.labelKey);
    if (currentRoute.view === item.view) link.setAttribute('aria-current', 'page');
    viewNav.append(link);
  }
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
