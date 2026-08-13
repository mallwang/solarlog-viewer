/**
 * Empty/unrecognized hashes and the brand-logo link resolve to the welcome page (015-welcome-
 * page-dashboard) rather than any specific period view - it has no params of its own, but this
 * stays a function (not a module-level constant) for symmetry with the other route builders.
 * @returns {{ view: 'welcome', params: {} }}
 */
function defaultRoute() {
  return { view: 'welcome', params: {} };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Parses the current location.hash into a Route.
 * @param {string} hash
 * @returns {{ view: string, params: { year?: number, month?: number, day?: number } }}
 *   Defaults to the welcome page (see defaultRoute) for empty/unrecognized hashes.
 */
export function parseRoute(hash) {
  const path = (hash ?? '').replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return defaultRoute();

  const [kind, ...rest] = segments;

  if (kind === 'total' && rest.length === 0) return { view: 'total', params: {} };

  if (kind === 'year' && rest.length === 1) {
    const year = Number.parseInt(rest[0], 10);
    if (Number.isInteger(year) && /^\d{4}$/.test(rest[0]))
      return { view: 'year', params: { year } };
    return defaultRoute();
  }

  if (kind === 'month' && rest.length === 2) {
    const year = Number.parseInt(rest[0], 10);
    const month = Number.parseInt(rest[1], 10);
    if (/^\d{4}$/.test(rest[0]) && /^\d{2}$/.test(rest[1]) && month >= 1 && month <= 12) {
      return { view: 'month', params: { year, month } };
    }
    return defaultRoute();
  }

  if (kind === 'day' && rest.length === 3) {
    const year = Number.parseInt(rest[0], 10);
    const month = Number.parseInt(rest[1], 10);
    const day = Number.parseInt(rest[2], 10);
    if (
      /^\d{4}$/.test(rest[0]) &&
      /^\d{2}$/.test(rest[1]) &&
      /^\d{2}$/.test(rest[2]) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      isValidDate(year, month, day)
    ) {
      return { view: 'day', params: { year, month, day } };
    }
    return defaultRoute();
  }

  return defaultRoute();
}

/**
 * Serializes a Route back into a location.hash-compatible string (for building links).
 * @param {{ view: string, params: { year?: number, month?: number, day?: number } }} route
 * @returns {string} e.g. '#/month/2019/07'
 */
export function formatRoute(route) {
  const { view, params = {} } = route;
  switch (view) {
    case 'day':
      return `#/day/${params.year}/${pad2(params.month)}/${pad2(params.day)}`;
    case 'month':
      return `#/month/${params.year}/${pad2(params.month)}`;
    case 'year':
      return `#/year/${params.year}`;
    case 'total':
      return '#/total';
    case 'welcome':
    default:
      return '#/';
  }
}

/**
 * Subscribes to hash changes and initial load; invokes `onRoute(route)` with the parsed Route
 * both immediately and on every subsequent `hashchange`.
 * @param {(route: { view: string, params: object }) => void} onRoute
 * @returns {() => void} Unsubscribe function.
 */
export function onRouteChange(onRoute) {
  const handler = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handler);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
