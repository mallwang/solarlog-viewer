# Data Model: Navigate to Parent Period

No persisted or fetched data entities are introduced by this feature — it is a pure UI/routing addition. The relevant "entity" is the in-memory period-hierarchy relationship already implied by the router's `route.params` shape.

## Period Hierarchy (conceptual, not persisted)

| Level | Params shape           | Parent level | Parent params derivation               |
| ----- | ---------------------- | ------------ | -------------------------------------- |
| Day   | `{ year, month, day }` | Month        | `{ year, month }` (drop `day`)         |
| Month | `{ year, month }`      | Year         | `{ year }` (drop `month`)              |
| Year  | `{ year }`             | Total        | `{}` (drop `year`)                     |
| Total | `{}`                   | _(none)_     | N/A — top of hierarchy, no parent link |

This mirrors the existing `route = { view: string, params: object }` shape produced/consumed by [router.js](../../web/js/router.js)'s `parseRoute`/`formatRoute`, and is a strict subset relationship (no new fields, no computed/derived values beyond dropping keys) — consistent with `research.md`'s decision to avoid new date-arithmetic.

## New helper functions (period-nav.js)

Added for consistency with the existing `addDays`/`addMonths`/`addYears`/`isFutureDay` etc. helpers and to keep the derivation unit-testable in isolation from view rendering:

- `parentOfDay({ year, month, day }) → { year, month }`
- `parentOfMonth({ year, month }) → { year }`
- `parentOfYear({ year }) → {}` _(trivial; documented for symmetry, may be inlined instead — see tasks)_

These are pure functions with no side effects, matching the existing style in `period-nav.js`.

## Markup contract change

`periodNavMarkup(opts)` gains two new optional fields, following the existing `todayHref`/`todayLabel` pattern:

- `parentHref?: string` — target route href; when present, an additional link is rendered in the nav row.
- `parentLabel?: string` — link text; when `parentHref` is absent/falsy, no parent link markup is rendered at all (mirrors how `todayLabel` gates the today-link block).

No disabled state is needed for the parent link (see research.md) — it is either present (always enabled) or entirely absent (total view).
