import { fetchText } from '../data/fetch-text.js';
import { parseEventsFile, mergeAndDedupeEvents, enrichEvent } from '../data/events.js';
import { t } from '../i18n.js';
import { emptyStateBody } from './empty-state.js';
import { DATA_DIR } from '../config.js';

const DEFAULT_SORT = { column: 'start', direction: 'desc' };
const DEFAULT_FILTERS = { inverter: 'all', day: 'all', status: 'all', error: 'all' };
// research.md R5 / data-model.md: 'desc' (most recent/longest first) is the sensible default
// for start/duration, 'asc' (WR1 before WR2) for inverter, when switching to a different column.
const DEFAULT_DIRECTION_BY_COLUMN = { start: 'desc', inverter: 'asc', duration: 'desc' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {Date} date @returns {string} "DD.MM.YY", matching the source files' own day format. */
function dayKey(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
}

/** @param {Date} date @returns {string} "HH:mm" */
function timeOnly(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** @param {Date} date @returns {string} "DD.MM.YY HH:mm" */
function fullDateTime(date) {
  return `${dayKey(date)} ${timeOnly(date)}`;
}

/**
 * Formats an event's combined Von–Bis cell text (design.md): the end time shows just the
 * time-of-day when it falls on the same calendar day as the start, the full date otherwise. An
 * ongoing event has no end text at all — the caller renders the "aktiv" badge instead.
 * @param {import('../data/events.js').Event} event
 * @returns {{ startText: string, endText: string | null }}
 */
function formatRange(event) {
  const startText = fullDateTime(event.start);
  if (event.isOngoing) return { startText, endText: null };
  const endText =
    dayKey(event.start) === dayKey(event.end) ? timeOnly(event.end) : fullDateTime(event.end);
  return { startText, endText };
}

/**
 * Formats a duration compactly: hours+minutes above an hour, minutes+seconds above a minute,
 * seconds otherwise. `null` (ongoing) is the caller's responsibility to handle separately.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${pad2(m)}m`;
  if (m > 0) return `${m}m ${pad2(s)}s`;
  return `${s}s`;
}

// design.md's status->color bucket mapping: keyword-matched against the resolved label so it
// works across both inverters' own vocabularies (see base_vars.js's StatusCodes[0]/[1]) without
// hard-coding a full label list. "Offline" (FR-010's out-of-range fallback) is deliberately not
// matched here, falling through to the neutral bucket alongside a genuinely unknown label.
const STATUS_BUCKET_KEYWORDS = {
  productive: ['mpp', 'netzueb', 'einspeis'],
  transitional: [
    'riso',
    'offset',
    'zuschalt',
    'warten',
    'stop',
    'calib',
    'such',
    'konst',
    'derat',
    'peak',
  ],
  fault: ['stoer', 'fehler'],
};

/**
 * Buckets a resolved status label into a pill color class (design.md: green/amber/red/neutral).
 * @param {string} statusLabel
 * @returns {'productive' | 'transitional' | 'fault' | 'neutral'}
 */
function statusBucket(statusLabel) {
  const lower = statusLabel.toLowerCase();
  for (const [bucket, keywords] of Object.entries(STATUS_BUCKET_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return bucket;
  }
  return 'neutral';
}

// Maps each raw StatusCodes label (base_vars.js's cryptic device vocabulary, e.g. "Netzueb.",
// "Mpp") to an i18n key under `events.statusNames` for a fuller, more legible display name in
// both languages. A label with no entry here (e.g. "Offline", FR-010's out-of-range fallback, or
// any future/unrecognized label) renders as-is via statusDisplayName's fallback — this map is
// deliberately not exhaustive proof against new device vocabulary, just friendlier for what's
// been observed. Keyed on the raw label rather than run through `t()` directly because several
// raw labels (e.g. "Netzueb.") contain a literal "." that would break t()'s dot-path key lookup.
const STATUS_NAME_KEYS = {
  Offset: 'offset',
  Stop: 'stop',
  'Stop 1': 'stop1',
  'Netzueb.': 'gridMonitoring',
  Warten: 'waiting',
  'Der. T. WR': 'deratingInverterTemp',
  'Der. T. DC': 'deratingDcTemp',
  'Der. Idc': 'deratingDcCurrent',
  Riso: 'insulationTest',
  Mpp: 'mppFeedIn',
  'Mpp-Such': 'mppSearch',
  'Mpp Peak': 'mppPeak',
  'Stoer.': 'fault',
  Fehler: 'error',
  'U-Konst': 'constantVoltage',
  'I-Konst': 'constantCurrent',
  Derating: 'derating',
  R12: 'r12',
  'Zuschalt.': 'gridConnect',
  'Uac / Rel': 'acVoltageRelay',
  Calib: 'calibration',
};

/**
 * Resolves a raw status label (event.statusLabel) to its friendlier display name via
 * STATUS_NAME_KEYS, falling back to the raw label unchanged when there's no mapping.
 * @param {string} rawLabel
 * @returns {string}
 */
function statusDisplayName(rawLabel) {
  const key = STATUS_NAME_KEYS[rawLabel];
  return key ? t(`events.statusNames.${key}`) : rawLabel;
}

/**
 * Renders an event's status cell text as "<code> - <friendly name>" (e.g. "3 - Warten"/
 * "3 - Netzüberwachung") — the numeric code is only meaningful per-event (the same raw label can
 * map to a different code on a different inverter model, see base_vars.js's StatusCodes[0]
 * vs. [1]), so this prefix is applied here, per row, not in the filter dropdown/options where a
 * single label can correspond to more than one code across events.
 * @param {import('../data/events.js').Event} event
 * @returns {string}
 */
function statusCellText(event) {
  return `${event.statusCode} - ${statusDisplayName(event.statusLabel)}`;
}

/**
 * Filters an enriched Event[] by the given FilterState (data-model.md) — pure, DOM-free.
 * @param {import('../data/events.js').Event[]} events
 * @param {{ inverter: number | 'all', day: string | 'all', status: string | 'all', error: string | 'all' }} filters
 * @returns {import('../data/events.js').Event[]}
 */
export function filterEvents(events, filters) {
  return events.filter((event) => {
    if (filters.inverter !== 'all' && event.inverterIdx !== filters.inverter) return false;
    if (filters.day !== 'all') {
      const startDay = dayKey(event.start);
      const endDay = event.end ? dayKey(event.end) : null;
      if (filters.day !== startDay && filters.day !== endDay) return false;
    }
    if (filters.status !== 'all' && event.statusLabel !== filters.status) return false;
    if (filters.error !== 'all' && event.errorLabel !== filters.error) return false;
    return true;
  });
}

/**
 * Derives each filter dropdown's available options from the *currently filtered* event set (User
 * Story 2 acceptance scenario 1).
 * @param {import('../data/events.js').Event[]} events
 * @returns {{ inverters: number[], days: string[], statuses: string[], errors: string[] }}
 *   Each array de-duplicated; `days` sorted most-recent-first; `inverters` ascending.
 */
export function buildFilterOptions(events) {
  const inverters = [...new Set(events.map((e) => e.inverterIdx))].sort((a, b) => a - b);

  const dayDates = new Map();
  for (const event of events) {
    const key = dayKey(event.start);
    if (!dayDates.has(key)) dayDates.set(key, event.start);
  }
  const days = [...dayDates.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);

  const statuses = [...new Set(events.map((e) => e.statusLabel))].sort((a, b) =>
    a.localeCompare(b),
  );
  const errors = [
    ...new Set(events.map((e) => e.errorLabel).filter((label) => label !== null)),
  ].sort((a, b) => a.localeCompare(b));

  return { inverters, days, statuses, errors };
}

/**
 * Derives each filter dropdown's options with faceted narrowing (data-model.md's State
 * transitions): a dimension's own options come from events matching every *other* active
 * filter, never itself, so picking e.g. WR1 keeps WR2 selectable in that same dropdown instead
 * of collapsing it to the one already-chosen value; the *other* dropdowns still narrow to what's
 * reachable given the current selection (User Story 2 acceptance scenario 1).
 * @param {import('../data/events.js').Event[]} allEvents
 * @param {{ inverter: number | 'all', day: string | 'all', status: string | 'all', error: string | 'all' }} filters
 * @returns {{ inverters: number[], days: string[], statuses: string[], errors: string[] }}
 */
export function buildFacetedFilterOptions(allEvents, filters) {
  return {
    inverters: buildFilterOptions(filterEvents(allEvents, { ...filters, inverter: 'all' }))
      .inverters,
    days: buildFilterOptions(filterEvents(allEvents, { ...filters, day: 'all' })).days,
    statuses: buildFilterOptions(filterEvents(allEvents, { ...filters, status: 'all' })).statuses,
    errors: buildFilterOptions(filterEvents(allEvents, { ...filters, error: 'all' })).errors,
  };
}

/**
 * Compares two (possibly `null`, meaning ongoing) durations ascending — `null` sorts last
 * (treated as "longest"/never-ending), so an ongoing event surfaces first under the default
 * descending "Dauer" sort and last when reversed to ascending.
 * @param {number | null} a
 * @param {number | null} b
 * @returns {number}
 */
function compareDuration(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

const COLUMN_COMPARATORS = {
  start: (a, b) => a.start.getTime() - b.start.getTime(),
  inverter: (a, b) => a.inverterIdx - b.inverterIdx,
  duration: (a, b) => compareDuration(a.durationMs, b.durationMs),
};

/**
 * Sorts an Event[] by the given SortState (data-model.md) — pure, stable (equal keys keep their
 * relative order), never mutates the input array.
 * @param {import('../data/events.js').Event[]} events
 * @param {{ column: 'start' | 'inverter' | 'duration', direction: 'asc' | 'desc' }} sort
 * @returns {import('../data/events.js').Event[]} A new sorted array.
 */
export function sortEvents(events, sort) {
  const compare = COLUMN_COMPARATORS[sort.column];
  const dir = sort.direction === 'asc' ? 1 : -1;
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const cmp = compare(a.event, b.event);
      return cmp !== 0 ? cmp * dir : a.index - b.index;
    })
    .map(({ event }) => event);
}

/**
 * Resolves an event's inverter cell label: the plant's own inverter number when known, else a
 * generic "Wechselrichter N" fallback (data-model.md's Validation rules, Edge Case: stale
 * inverter) so an event never crashes the render when it references an inverter no longer
 * present in `base_vars.js`.
 * @param {number} inverterIdx
 * @param {object | null} plant
 * @returns {string}
 */
function inverterLabel(inverterIdx, plant) {
  const known = plant?.inverters?.find((inv) => inv.index === inverterIdx + 1);
  return known ? `WR${known.index}` : `${t('events.inverterFallbackPrefix')} ${inverterIdx + 1}`;
}

function errorCellMarkup(event) {
  if (event.errorLabel === null && event.errorRawCode === null) {
    return `<span class="text-text-muted">${t('events.noError')}</span>`;
  }
  if (event.errorRawCode !== null) {
    return `<span class="events-error-pill">${t('events.unknownCodePrefix')} ${event.errorRawCode} ${t('events.unknownCodeSuffix')}</span>`;
  }
  return `<span class="events-error-pill">${event.errorLabel}</span>`;
}

function rowMarkup(event, plant) {
  const { startText, endText } = formatRange(event);
  const rangeCell = event.isOngoing
    ? `${startText} <span class="events-ongoing-badge">${t('events.ongoing')}</span>`
    : `${startText} &rarr; ${endText}`;
  const durationCell = event.durationMs === null ? '' : formatDuration(event.durationMs);

  // data-inverter-idx/data-ongoing/data-start (ms epoch) expose the row's underlying values
  // directly for Playwright assertions, independent of display text/formatting (tests/e2e/
  // events-view.spec.js).
  return `<tr data-inverter-idx="${event.inverterIdx}" data-ongoing="${event.isOngoing}" data-start="${event.start.getTime()}">
    <td class="whitespace-nowrap">${rangeCell}</td>
    <td class="whitespace-nowrap"><span class="events-inverter-dot events-inverter-dot--${event.inverterIdx % 6}"></span>${inverterLabel(event.inverterIdx, plant)}</td>
    <td class="whitespace-nowrap tabular-nums">${durationCell}</td>
    <td><span class="events-status-pill events-status-pill--${statusBucket(event.statusLabel)}">${statusCellText(event)}</span></td>
    <td>${errorCellMarkup(event)}</td>
  </tr>`;
}

const SORTABLE_COLUMNS = [
  { column: 'start', labelKey: 'events.table.start' },
  { column: 'inverter', labelKey: 'events.table.inverter' },
  { column: 'duration', labelKey: 'events.table.duration' },
];

function optionsMarkup(values, selected, labelFor = (v) => v) {
  const options = [`<option value="all">${t('events.filters.all')}</option>`];
  for (const value of values) {
    options.push(
      `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${labelFor(value)}</option>`,
    );
  }
  return options.join('');
}

// Maps each table column to the FilterState field it lets the user narrow — `null` for
// "Dauer", which has no matching filter dimension and renders an empty header cell instead.
const COLUMN_FILTER_FIELD = {
  start: 'day',
  inverter: 'inverter',
  duration: null,
  status: 'status',
  error: 'error',
};

function filterCellMarkup(column, options, filters, plant) {
  const field = COLUMN_FILTER_FIELD[column];
  if (field === null) return '<th></th>';
  const valuesByField = {
    day: options.days,
    inverter: options.inverters,
    status: options.statuses,
    error: options.errors,
  };
  const LABEL_FOR_FIELD = {
    inverter: (idx) => inverterLabel(idx, plant),
    status: statusDisplayName,
  };
  const labelFor = LABEL_FOR_FIELD[field] ?? ((v) => v);
  const filterLabel = t(`events.filters.${field}`);
  return `<th><select data-filter="${field}" aria-label="${filterLabel}">${optionsMarkup(valuesByField[field], filters[field], labelFor)}</select></th>`;
}

/**
 * Renders the table's two-row header: a filter row on top, with each column's own dropdown, then
 * the sortable column labels directly below it (design.md folds the former standalone filter bar
 * into the table itself — "Dauer" has no matching dimension so its cell stays empty).
 * @param {{ column: string, direction: 'asc' | 'desc' }} sort
 * @param {{ inverters: number[], days: string[], statuses: string[], errors: string[] }} options
 * @param {{ inverter: number | 'all', day: string | 'all', status: string | 'all', error: string | 'all' }} filters
 * @param {object | null} plant
 * @returns {string}
 */
function headerMarkup(sort, options, filters, plant) {
  const sortRow = SORTABLE_COLUMNS.map(({ column, labelKey }) => {
    const isActive = sort.column === column;
    let arrow = '';
    let ariaSort = 'none';
    if (isActive) {
      arrow = sort.direction === 'asc' ? '&uarr;' : '&darr;';
      ariaSort = sort.direction === 'asc' ? 'ascending' : 'descending';
    }
    return `<th><button type="button" class="events-sort-button" data-column="${column}" aria-sort="${ariaSort}">${t(labelKey)} ${arrow}</button></th>`;
  }).join('');
  const filterRow = ['start', 'inverter', 'duration', 'status', 'error']
    .map((column) => filterCellMarkup(column, options, filters, plant))
    .join('');
  return `<thead>
    <tr class="events-filter-row">${filterRow}</tr>
    <tr>${sortRow}<th>${t('events.table.status')}</th><th>${t('events.table.error')}</th></tr>
  </thead>`;
}

/**
 * Renders the count ("414 Ereignisse" / "12 von 414 Ereignisse") and the filter-reset control as
 * the table's own `<caption>`, alongside the column filters folded into its header.
 * @param {number} shownCount
 * @param {number} totalCount
 * @returns {string}
 */
function captionMarkup(shownCount, totalCount) {
  return `<caption class="events-table-caption">
    <div class="flex items-center justify-between gap-sm flex-wrap">
      <span class="text-sm text-text-muted">${countText(shownCount, totalCount)}</span>
      <button type="button" class="events-filter-reset">${t('events.filters.reset')}</button>
    </div>
  </caption>`;
}

function countText(shownCount, totalCount) {
  return shownCount === totalCount
    ? `${totalCount} ${t('events.count.totalSuffix')}`
    : `${shownCount} ${t('events.count.of')} ${totalCount} ${t('events.count.filteredSuffix')}`;
}

/**
 * Mounts the Ereignisse page: fetches events.js + events_day.js + (reuses the already-fetched)
 * plant.statusCodes/errorCodes, renders the filter bar + sortable table, wires filter/sort
 * interaction.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { view: 'events', params: {} } }} ctx
 * @returns {Promise<void>}
 */
export async function render(container, { plant }) {
  container.innerHTML = `<div class="events-page"></div>`;
  const page = container.querySelector('.events-page');

  const [historyResult, todayResult] = await Promise.all([
    fetchText(`${DATA_DIR}/events.js`),
    fetchText(`${DATA_DIR}/events_day.js`),
  ]);

  if (!historyResult.ok && !todayResult.ok) {
    page.innerHTML = emptyStateBody('events.noData');
    return;
  }

  const historyRecords = historyResult.ok ? parseEventsFile(historyResult.text) : [];
  const todayRecords = todayResult.ok ? parseEventsFile(todayResult.text) : [];
  const merged = mergeAndDedupeEvents(historyRecords, todayRecords);
  const codes = { statusCodes: plant?.statusCodes ?? [], errorCodes: plant?.errorCodes ?? [] };
  const allEvents = merged.map((record) => enrichEvent(record, codes));

  if (allEvents.length === 0) {
    page.innerHTML = emptyStateBody('events.noData');
    return;
  }

  let filters = { ...DEFAULT_FILTERS };
  let sort = { ...DEFAULT_SORT };

  function draw() {
    const filtered = filterEvents(allEvents, filters);
    const sorted = sortEvents(filtered, sort);
    const options = buildFacetedFilterOptions(allEvents, filters);

    // Filters/count live in the table's own caption+header now, so an empty result set still
    // renders the table shell (with its filters reachable) rather than swapping it out for a
    // standalone empty-state block — only the tbody content changes.
    const tbodyMarkup =
      sorted.length === 0
        ? `<tr><td colspan="5" class="empty-state p-lg text-center text-text-muted">
            <strong class="block mb-xs">${t('events.emptyFiltered')}</strong>${t('events.emptyFilteredHint')}
          </td></tr>`
        : sorted.map((event) => rowMarkup(event, plant)).join('');

    const tableMarkup = `<div class="events-table-wrap bg-bg-elevated rounded-lg overflow-x-auto">
        <table class="events-table w-full border-collapse">
          ${captionMarkup(filtered.length, allEvents.length)}
          ${headerMarkup(sort, options, filters, plant)}
          <tbody>${tbodyMarkup}</tbody>
        </table>
      </div>`;

    page.innerHTML = tableMarkup;

    page.querySelectorAll('select[data-filter]').forEach((select) => {
      select.addEventListener('change', () => {
        const field = select.dataset.filter;
        const raw = select.value;
        filters = {
          ...filters,
          [field]: field === 'inverter' && raw !== 'all' ? Number.parseInt(raw, 10) : raw,
        };
        draw();
      });
    });

    page.querySelector('.events-filter-reset')?.addEventListener('click', () => {
      filters = { ...DEFAULT_FILTERS };
      draw();
    });

    page.querySelectorAll('.events-sort-button').forEach((button) => {
      button.addEventListener('click', () => {
        const column = button.dataset.column;
        sort =
          sort.column === column
            ? { column, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
            : { column, direction: DEFAULT_DIRECTION_BY_COLUMN[column] };
        draw();
      });
    });
  }

  draw();
}
