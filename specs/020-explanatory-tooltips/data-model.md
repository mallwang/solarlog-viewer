# Phase 1 Data Model: Explanatory Tooltips

This feature introduces no new persisted data structure (no `.js` data file, no localStorage key,
no SQLite table — see plan.md's Constitution Check, Principles I/III). Its only "entity" is a
content shape layered onto two already-existing structures: the i18n JSON files and the
stats-panel row-tuple contract.

## Explanation entry

Corresponds to spec.md's Key Entities → "Explanation entry": a single stat's tooltip content.

**Representation**: one string value per language, stored as an i18n key under a new
`explanations` namespace in `web/i18n/de.json` and `web/i18n/en.json` (same shape/nesting
convention already used for every other UI string, resolved via `t()` from `web/js/i18n.js`).

| Field    | Type   | Description                                                                                                       |
| -------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| i18n key | string | Dotted path under `explanations.*`, e.g. `explanations.sollAuflaufend`. Stable identity for reuse across views.   |
| DE text  | string | German explanation, plain-language, specific to the stat's actual calculation (FR-005, FR-010).                   |
| EN text  | string | English explanation, same meaning, for `en.json` (keeps the existing DE/EN parity the rest of the app maintains). |

**Validation rules**:

- Must exist in _both_ `de.json` and `en.json` (the existing i18n loader has no per-key fallback
  between languages — see `i18n.js`), or the tooltip would render literally as the dotted key
  string in whichever language is missing it.
- Text should reference the same terms the stat's own label uses (e.g. explaining "Soll
  (auflaufend)" should say "Soll", not a different term for the same concept) so the explanation
  reads as _this stat's_ explanation, not a generic one (FR-010).

**Initial entries** (FR-005's minimum set — wording is drafted from the actual calculation
functions in `web/js/data/yield-stats.js` / `web/js/data/co2-factors.js`, not invented
independently, per spec Assumptions):

| Key                           | Concept                                                | Backed by (`yield-stats.js` / `co2-factors.js`)                                 |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `explanations.yieldEuro`      | "Tagesertrag/Monatsertrag/... in €"                    | yield (kWh) × `plant.tariffRatePerKwh` (see `plant.js`'s `Verguetung` field)    |
| `explanations.soll`           | "Soll" (day view; month/year/total "full-period" Soll) | `dailySollKwh`/`monthlySollKwh`/`yearlySollKwh`/`lifetimeSollKwh`               |
| `explanations.sollAuflaufend` | "Soll (auflaufend)" (month/year views)                 | `monthSollAuflaufendKwh` / `yearSollAuflaufendKwh` — running target up to today |
| `explanations.ist`            | "Ist"                                                  | `istPercent` — actual yield as % of the Soll figure shown alongside it          |
| `explanations.co2`            | "Vermiedenes CO2"                                      | yield (kWh) × `co2FactorForYear(year)` (grid-mix emission factor for that year) |

Note: `explanations.soll` is intentionally shared by the day view's "Soll" row _and_ by
month/year/total's "Soll" (non-auflaufend) row, since it's the same concept (the period's full
target) at different granularities — this is the concrete instance of spec.md's "Soll" reuse
example.

## Stats row tuple (extended)

Corresponds to the existing, already-implemented contract in `web/js/views/stats-panel.js`
(`statsPanelMarkup(titleKey, rows)`), extended by this feature.

| Position | Name             | Type                | Required | Description                                                                                                                                                                                  |
| -------- | ---------------- | ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0        | `labelKey`       | string              | yes      | i18n key for the stat's own label (unchanged, existing behavior).                                                                                                                            |
| 1        | `value`          | string              | yes      | Pre-formatted display value (unchanged, existing behavior).                                                                                                                                  |
| 2        | `explanationKey` | string \| undefined | no       | **New.** i18n key under `explanations.*`. When present, an info button + tooltip is rendered next to the label; when absent, the row renders exactly as it did before this feature (FR-009). |

**State/behavior implied by presence of `explanationKey`**:

- Present → `<span class="stat-label">` gains a `<button class="info-trigger">` sibling to the
  label text, `aria-describedby` pointing at a `role="tooltip"` element containing `t(explanationKey)`.
- Absent → row markup is byte-identical to pre-feature output (no wrapper, no button) — this is
  what keeps stats with no registered explanation from gaining any layout/markup footprint
  (FR-009, User Story 2's "looks identical to a stat with no explanation registered").

No other entity, state machine, or transition exists for this feature — tooltips are stateless
and re-evaluated on every hover/focus (spec Assumptions).
