import { t } from '../i18n.js';
import { formatNumber } from '../format.js';

/**
 * Decimal places for a column's unit, matching what the chart's own tooltip already shows for
 * that quantity (research.md/user correction): Leistung (W) rounds to whole watts, same as
 * `feedInTooltipRows`' `decimals: 0` in chart-factory.js; every other unit (kWh/Wh/%/V) rounds to
 * 2 decimals.
 * @param {string} unit
 * @returns {number}
 */
function decimalsForUnit(unit) {
  return unit === 'W' ? 0 : 2;
}

/**
 * Reads one series' plotted value at row index `i` into the table-cell shape
 * `string | number | null | [number, number]`. Bar-chart series (`month`/`year`/`year-months`
 * modes) store plain numbers per category; the day chart's series store `{ x, y }` pairs, where
 * `y` is usually a number (or `null` for a gap) but is a `[min, max]` tuple for the UDC min/max
 * range band — passed through as-is (rather than formatted into a string here) so this function
 * stays pure/DOM-free: `formatCell` (called only from the browser-only `renderChartTable`) is
 * where locale-aware rounding/unit-prefixing happens, for both the plain-number and tuple cases.
 * @param {number | { x: number, y: number | [number, number] | null } | undefined} point
 * @returns {number | null | [number, number]}
 */
function cellValue(point) {
  if (point === undefined || point === null) return null;
  if (typeof point === 'number') return point;
  const { y } = point;
  if (Array.isArray(y)) return y.every((v) => v === null) ? null : y;
  return y ?? null;
}

/**
 * Formats a day chart's datetime x-value into the same `HH:mm` shape buildDayOptions' own xaxis
 * labels use (see chart-factory.js), rather than reinventing date formatting (research.md). Reads
 * local time components (not `toISOString()`, which is always UTC) to match the chart's own axis,
 * which renders with `datetimeUTC: false` — otherwise the table's time is off by the browser's UTC
 * offset (e.g. 04:06 instead of 06:06 CEST) while the chart itself shows the correct time.
 * @param {number} timestamp
 * @returns {string}
 */
function formatTimeLabel(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Finds the x-value at row index `i`, reading whichever series actually has a data point there
 * (series lengths are equal in practice — see chart-factory.js's buildDayOptions — but this
 * degrades gracefully if one were ever shorter).
 * @param {{ data: { x: number }[] }[]} seriesList
 * @param {number} i
 * @returns {number | undefined}
 */
function xAt(seriesList, i) {
  for (const s of seriesList) {
    const point = s.data?.[i];
    if (point && typeof point === 'object' && 'x' in point) return point.x;
  }
  return undefined;
}

/**
 * The series list to read the table from: `options.tableSeries` when chart-factory.js provides
 * one (always Gesamt+WR1+WR2 for the bar charts, always every feed-in segment for the day chart —
 * see `buildBarOptions`/`buildDayOptions`), independent of whichever subset `options.series`
 * itself currently holds for the chart's own breakdown-toggle selection (user correction: the
 * table shouldn't shrink/grow columns just because the diagram's Gesamt/Wechselrichter toggle
 * was flipped). Falls back to `options.series` for callers (tests, `day-yield` mode) that don't
 * set `tableSeries`.
 * @param {import('apexcharts').ApexOptions} options
 * @returns {{ name: string, unit?: string, data: unknown[] }[]}
 */
function resolveSeriesList(options) {
  return options.tableSeries ?? options.series ?? [];
}

/**
 * Extracts condensed table rows from an ApexCharts `options` object as already built by
 * chart-factory.js's buildOptions() for the chart currently on screen — see
 * contracts/chart-data-table.md. Pure, no DOM access (deliberately no locale-aware formatting
 * either — see `formatCell`), so it's unit-testable without a browser.
 * Row labels prefer `options.tableCategories` (chart-factory.js's full "01.07.2008"/"Juli 2008"
 * labels, added alongside the bar chart's own short axis categories — see `buildBarOptions`)
 * over `options.xaxis.categories`, so the table can read out full dates without the chart's own
 * x-axis ticks needing to grow wide enough to show them too (user correction).
 * @param {import('apexcharts').ApexOptions} options
 * @returns {{ columns: string[], rows: { label: string, values: (number|null|[number,number])[] }[] }}
 */
export function extractTableData(options) {
  const seriesList = resolveSeriesList(options);
  const columns = seriesList.map((s) => s.name);
  const rowCount = seriesList.reduce((max, s) => Math.max(max, s.data?.length ?? 0), 0);

  if (rowCount === 0) {
    return { columns, rows: [] };
  }

  const isDatetime = options.xaxis?.type === 'datetime';
  const categories = options.tableCategories ?? options.xaxis?.categories ?? [];

  const rows = [];
  for (let i = 0; i < rowCount; i += 1) {
    const label = isDatetime ? formatTimeLabel(xAt(seriesList, i)) : (categories[i] ?? '');
    const values = seriesList.map((s) => cellValue(s.data?.[i]));
    rows.push({ label, values });
  }
  return { columns, rows };
}

/**
 * Formats a raw cell value (from `extractTableData`) into locale-aware display text with its unit
 * as a suffix (e.g. "12,34 kWh" — user correction: suffix, not prefix, matching how German/
 * English both normally read a unit after its number), rounded to the unit's own precision
 * (`decimalsForUnit`) — the UDC min/max band's `[min, max]` tuple becomes "220,00 - 235,00 V"
 * (a plain hyphen with a space on each side, not an en/em dash — user correction), `null` becomes
 * "-". Only called from the browser-only `renderChartTable`, so it's the one place in this module
 * allowed to touch `formatNumber`/`getLanguage` (via `format.js`).
 * @param {number | null | [number, number]} value
 * @param {string} unit - The owning series' unit (chart-factory.js's `series[].unit`), or `''`
 *   for a series with none (e.g. a hand-built test fixture) — treated as unitless, no suffix.
 * @returns {string}
 */
function formatCell(value, unit) {
  if (value === null) return '-';
  const decimals = decimalsForUnit(unit);
  if (Array.isArray(value)) {
    const range = `${formatNumber(value[0], { decimals })} - ${formatNumber(value[1], { decimals })}`;
    return unit ? `${range} ${unit}` : range;
  }
  const number = formatNumber(value, { decimals });
  return unit ? `${number} ${unit}` : number;
}

/**
 * Renders (or replaces) the condensed data table into `mount` from the given ApexCharts options.
 * Clears any prior content first (mirrors renderChart()'s destroy-before-recreate pattern in
 * chart-factory.js) so repeated calls — e.g. on period navigation — never leave stale rows behind
 * (FR-007). Uses Tailwind's condensed-content table utility classes inline, matching
 * stats-panel.js's `.summary-table` convention; `.chart-table`'s own CSS (app.css) only carries
 * what those utilities don't cover (borders, the `[hidden]` contract, the bigger gap above the
 * caption).
 * @param {HTMLElement} mount - A `.chart-table` element (see stats-panel.js's layout markup).
 * @param {import('apexcharts').ApexOptions} options - Same options passed to chart-factory's
 *   renderChart() for the currently displayed chart.
 * @returns {void}
 */
export function renderChartTable(mount, options) {
  const { columns, rows } = extractTableData(options);

  if (rows.length === 0) {
    mount.innerHTML = `<p class="chart-table-empty text-xs text-text-muted p-sm">${t('chart.tableNoData')}</p>`;
    return;
  }

  const units = resolveSeriesList(options).map((s) => s.unit ?? '');
  const headerCells = columns
    .map((name) => `<th class="text-center py-0.5 px-2 font-medium text-text-muted">${name}</th>`)
    .join('');
  const bodyRows = rows
    .map((row) => {
      const cells = row.values
        .map(
          (value, i) =>
            `<td class="text-center py-0.5 px-2 tabular-nums">${formatCell(value, units[i])}</td>`,
        )
        .join('');
      return `<tr><th class="text-left py-0.5 px-2 font-medium">${row.label}</th>${cells}</tr>`;
    })
    .join('');

  // The day chart's table (Tagesertrag — many columns, many rows) stays `w-full`: it already
  // needs the room, and shrinking it to content width wouldn't help scanning it the way it does
  // for the others. Every other table (month/year/total bar charts) uses `mx-auto` instead — a
  // two/three-column table would otherwise stretch across the whole chart width, spacing values
  // so far apart that scanning them means looking back and forth instead of taking them in at a
  // glance (user correction); letting the table size to its own content and centering it keeps
  // values close together regardless of how wide `.chart-container` is. `.chart-table`'s
  // `overflow-x-auto` wrapper (stats-panel.js) still saves either shape from widening the page if
  // it ever needs more room than that.
  const isDayChart = options.xaxis?.type === 'datetime';
  const widthClass = isDayChart ? 'w-full' : 'mx-auto';
  mount.innerHTML = `<p class="chart-table-caption text-center text-sm font-bold">${t('chart.tableCaption')}</p>
  <table class="${widthClass} border-collapse text-xs">
    <thead><tr><th class="text-left py-0.5 px-2 font-medium text-text-muted"></th>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}
