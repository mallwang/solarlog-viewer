# Contract: `periodNavMarkup()` parent-link extension

This is an internal module contract (day/month/year views → shared `period-nav.js` helper), not a network/API contract — the project has no server-side interfaces (constitution Principle III). Documented here because it is the interface all three view modules integrate against.

## Function signature (extended)

```js
/**
 * @param {{
 *   prevHref: string, prevLabel: string,
 *   nextHref: string | null, nextLabel: string,
 *   todayHref?: string | null, todayLabel?: string,
 *   parentHref?: string, parentLabel?: string,
 * }} opts
 * @returns {string} HTML markup.
 */
export function periodNavMarkup(opts) {
  /* ... */
}
```

## Behavior contract

| Input                                      | Output                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parentLabel` absent/falsy                 | No parent-link markup rendered (same as omitting `todayLabel` today).                                                                                                                                    |
| `parentLabel` present, `parentHref` set    | An enabled `<a>` link rendered with `parentLabel` text, `parentHref` target.                                                                                                                             |
| `parentLabel` present, `parentHref` absent | Not a supported/expected state for this feature — parent link is only ever passed when a real href exists (day/month/year views always have a parent; total view never calls with parent fields at all). |

## Call-site contract (per view)

| View       | `parentHref` route                                        | `parentLabel` i18n key                                             |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| day-view   | `formatRoute({ view: 'month', params: { year, month } })` | `day.parentLink` (or view-appropriate key resolved in day-view.js) |
| month-view | `formatRoute({ view: 'year', params: { year } })`         | `month.parentLink`                                                 |
| year-view  | `formatRoute({ view: 'total', params: {} })`              | `year.parentLink`                                                  |
| total-view | _(not called — no parent fields passed)_                  | _(n/a)_                                                            |

## CSS contract

Reuses the existing `.period-nav__link` class family (and `.period-nav__link--today`-style modifier, e.g. `.period-nav__link--parent`, if visual distinction from prev/next is desired) — no new stylesheet or design tokens introduced, consistent with constitution Technical Standards/Frontend (CSS custom properties as the single source of design tokens).
