# Phase 1 Data Model: Chart Data Table Toggle

This feature adds no persistent business data — it operates entirely on data already parsed for
the chart (`chart-factory.js`'s per-mode `data` argument) and one client-side UI preference. The
"entities" below are the in-memory/localStorage shapes the new modules pass between each other.

## Chart Table Preference

A single app-wide boolean, persisted in `localStorage`.

| Field       | Type                                      | Notes                                                                                           |
| ----------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| storage key | `'solarlog-chart-table'`                  | Mirrors `solarlog-transparency` / `solarlog-chart-breakdown` naming.                            |
| value       | `'true' \| 'false'` (stringified boolean) | Read via `isChartTableVisible()`, written via `setChartTableVisible(boolean)` in `settings.js`. |
| default     | `false`                                   | No stored value (or storage unavailable) → table starts hidden (spec FR-005, FR-009).           |

**Validation rules**: none beyond the boolean coercion already used by `isTransparencyEnabled()`
(`localStorage.getItem(key) === 'true'`) — any other stored value is treated as `false`.

**State transitions**: `hidden → shown` and `shown → hidden` only, triggered exclusively by a
toggle-button click (FR-002); no other code path mutates this preference.

## Chart Table Row

Not a stored entity — a value derived per render from the ApexCharts `options` object already
built for the chart currently on screen.

| Field    | Type                                           | Notes                                                                                                                                                                                        |
| -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`  | `string`                                       | The row's category/period label — pulled from `options.xaxis.categories[i]` for bar-chart modes (month/year/year-months) or formatted from the datetime series' `x` value for the day chart. |
| `values` | `Record<seriesName, string \| number \| null>` | One entry per series present in `options.series` at render time; `null` for a period with no data at that point (mirrors chart's own gap handling — spec Edge Cases).                        |

**Relationships**: One `Chart Table Row` per plotted x-axis point on the currently rendered chart;
the row set is always a 1:1 reflection of what's plotted, recomputed whenever the chart itself is
(re)rendered (FR-007) — never cached independently.

**Validation rules**: A chart with zero data points (empty state, spec Edge Cases) produces zero
rows; the table renders a single "no data" row instead of an empty `<tbody>`, matching
`empty-state.js`'s existing empty-state convention.
