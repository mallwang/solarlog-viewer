# Research: Navigate to Parent Period

No `[NEEDS CLARIFICATION]` markers remained in the spec, and Technical Context above has no open unknowns. This document records the small design decisions made while grounding the plan in the existing codebase.

## Decision: Extend `periodNavMarkup` with an optional `parentHref`/`parentLabel` pair

- **Rationale**: `periodNavMarkup` in [period-nav.js](../../web/js/views/period-nav.js) already renders the prev/next/"jump to current" row and already has the `todayHref`/`todayLabel` optional-pair pattern (rendered disabled when `todayHref` is `null`, omitted entirely when `todayLabel` is falsy). Adding a matching `parentHref`/`parentLabel` pair reuses that exact pattern, keeping the new control visually and structurally consistent with the existing row (FR-006) with minimal new code.
- **Alternatives considered**:
  - A separate breadcrumb-style component above the view title — rejected: heavier UI change than requested, and the user explicitly asked for something "similar like Heute / Dieser Monat".
  - A new standalone `parentNavMarkup()` function — rejected: would duplicate the row-rendering/disabled-link logic already in `periodNavMarkup` for no benefit, since the parent link always sits in the same row.

## Decision: Parent link is never rendered disabled

- **Rationale**: Unlike `todayHref` (which is `null`/disabled when the routed period _is_ already today/this-month/this-year), a parent period always exists and is always distinct from its child for day, month, and year views — there is no "already at parent" state. Per FR-008, the parent link is always actionable. This means the new markup parameter doesn't need the `null`-to-disable branching that `todayHref` uses — it can be `undefined`/absent (omitted, as on `total-view.js`) or a real href (always enabled).
- **Alternatives considered**: Reusing the exact disable-when-null convention for symmetry — rejected as unnecessary complexity: it would require every call site to pass a never-null href, so there's no real branch to guard against.

## Decision: Compute parent params inline in each view via existing param objects

- **Rationale**: `day-view.js` already has `{ year, month, day }` in `route.params`; the parent month route is simply `{ view: 'month', params: { year, month } }` — no new date-arithmetic helper needed (unlike `addDays`/`addMonths`/`addYears`, which handle rollover arithmetic that parent-derivation doesn't need, since the parent period is a direct subset of the child's own params, not an offset). Likewise month→year drops `month`, year→total drops `year` entirely (`{ view: 'total', params: {} }`).
- **Alternatives considered**: Adding `parentOfDay`/`parentOfMonth`/`parentOfYear` helper functions to `period-nav.js` — considered for symmetry with `addDays`/`addMonths`/`addYears`, and adopted for consistency and testability (see data-model.md) even though the logic is trivial, since `period-nav.js` is already the shared home for this kind of period-relationship logic and `period-nav.test.js` already tests it unit-by-unit.

## Decision: New i18n keys under existing `day`/`month`/`year` sections

- **Rationale**: `de.json`/`en.json` already scope labels per view (`day.today`, `month.thisMonth`, `year.thisYear`). Parent-link labels follow the same convention: e.g. `day.parentLink` → "Monat" / "Month" (or a template showing the target month name, resolved at render time same as `month.stats.maxDaily` does today), `month.parentLink` → "Jahr" / "Year", `year.parentLink` → "Gesamt" / "Total" (already the literal string used by `total.total` — can reuse or add a dedicated key).
- **Alternatives considered**: A shared `nav.parent` generic key — rejected: existing convention scopes strings per view, and label text differs enough (day's parent label benefits from showing the month name, per FR-005) that separate keys per view is more natural and consistent with the codebase's existing per-view key style.
