# Design: Ereignisse (Events) Datatable

**Feature**: [spec.md](spec.md)
**Status**: Approved 2026-08-14
**Mockup**: https://claude.ai/code/artifact/766a79f0-8e2d-460c-827c-2a43d085d6a4 (non-functional
review artifact — link may not stay live forever; this document is the durable record of what
was approved).

## Approved layout

A single page reached from the existing top nav (alongside Tag/Monat/Jahr/Gesamt), titled
"Ereignisse", laid out top to bottom as:

1. **Title row** — "Ereignisse" heading plus a live count (`401 Ereignisse` unfiltered, or
   `18 von 401 Ereignissen` while filtered).
2. **Filter bar** — four labeled dropdowns in a single row (wraps on narrow viewports):
   Wechselrichter (inverter), Tag (day), Status, Fehler (error) — mirroring the legacy page's
   four filter dimensions — plus a "Filter zurücksetzen" (clear filters) button, right-aligned
   at the end of the row.
3. **Active filter chips** — when one or more filters are applied, a row of removable pill chips
   appears directly under the filter bar (e.g. `WR2 ✕`, `Fehler: NUW-UAC ✕`), each independently
   removable, giving a second at-a-glance way to see and undo what's filtered besides the
   dropdown values themselves.
4. **Table** — columns: **Von – Bis** (start–end, combined into one column with an arrow
   separator; end time shows just the time-of-day when same-day, full date otherwise, per the
   legacy page's own formatting rule), **WR** (inverter, tagged with a colored dot per inverter),
   **Dauer** (duration, derived — not a raw field), **Status**, **Fehler**. Von–Bis, WR, and
   Dauer are sortable (click column header to sort, click again to reverse; an arrow glyph in
   the header shows current sort direction). Status/Fehler are filter targets, not sort targets.
   Default sort: Von–Bis descending (most recent first), matching FR-004.
5. **Empty state** — replaces the table when the active filters match zero events: a centered
   icon + "Keine Ereignisse gefunden" message with a hint to clear filters.

## Status/error cell treatment

- **Status** renders as a colored pill, not plain text, so fault-like states are scannable
  without reading every row: green-tinted for productive states (e.g. "Mpp", "Netzueb."),
  amber-tinted for transitional/startup states (e.g. "Riso", "Offset", "Zuschalt."), red-tinted
  for fault states (e.g. "Stoer.", "Fehler"), and a neutral grey pill for the "Offline" fallback
  (status code beyond the known list) or a genuinely unmatched code. The exact status→color
  bucket mapping is a plan-time/implementation decision (out of scope for this mockup) — the
  mockup fixes only that pills exist and that fault/offline states read as visually distinct
  from healthy ones.
- **Fehler** renders as a dash (`—`) in muted color for the "no error" code, or a red, bold
  label when an actual error is present — so a scan down the column immediately shows which
  rows had a real fault.
- **Ongoing events** (blank end time) show a small pulsing "aktiv" badge next to the start
  timestamp instead of a blank/malformed end value, satisfying spec Edge Case for ongoing
  events. `prefers-reduced-motion` disables the pulse animation.
- **Unmatched codes with no fallback label at all** (rare — code exceeds even the padded/known
  list) show a "Code N (unbekannt)" pill instead of blank, per FR-010's raw-code fallback.

## Responsive behavior

- **Desktop**: filter bar and table both use the full page width; table columns stay in one row
  per event.
- **Mobile**: the mocked top nav collapses (existing app pattern, unchanged by this feature);
  the filter bar's dropdowns wrap onto multiple rows; the table sits inside a horizontally
  scrollable container (`overflow-x: auto`) rather than trying to compress columns, since Von–Bis
  timestamps and status pills don't compress well — consistent with the project's existing wide
  table handling elsewhere in the site.

## Requirement traceability

| Region / state                        | Spec item(s) satisfied                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Title row count                       | SC-002 (user can confirm how narrow a filter got them)                  |
| Filter bar (WR/Tag/Status/Fehler)     | FR-006, FR-007, User Story 2 acceptance scenarios 1–3                   |
| Active filter chips + clear button    | FR-007, User Story 2 acceptance scenario 4                              |
| Table default sort (Von–Bis desc)     | FR-004                                                                  |
| Sortable Von–Bis / WR / Dauer headers | FR-005, User Story 3 acceptance scenarios 1–2                           |
| Ongoing "aktiv" badge                 | FR-003, Edge Case "event still active"                                  |
| Status pill w/ Offline fallback       | FR-003, FR-010, Edge Case "unmatched status code"                       |
| Fehler dash / unknown-code fallback   | FR-003, FR-010, Edge Case "code beyond known list"                      |
| Empty state                           | Edge Case "zero events after filtering"                                 |
| Mobile horizontal scroll              | Constitution Principle IV (responsive-first, no horizontal page scroll) |

## Explicitly out of scope for this mockup

- Real client-side sort/filter implementation and state management.
- Pagination/virtualization strategy for large histories (per spec Assumptions, left to planning).
- The precise status-code → pill-color bucket mapping (illustrative only in the mockup).
- Deduplication logic between `events.js` and `events_day.js` (FR-008) — not a visual concern.
- Malformed-line skipping (FR-009) — not a visual concern.
- Keyboard/screen-reader interaction details beyond visible focus states.
