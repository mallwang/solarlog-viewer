# Phase 0 Research: Explanatory Tooltips

No `NEEDS CLARIFICATION` markers remain in the Technical Context — `/speckit-clarify` and the
approved `design.md` mockup already resolved the open questions the spec raised (icon element
type, touch-device omission strategy, hover-capability detection method). This document records
the remaining implementation-level decisions the plan needed to make to turn that approved design
into concrete files.

## Decision: Explanation text lives in `web/i18n/*.json`, not a new data module

**Decision**: Add a new top-level `explanations` object to `web/i18n/de.json` and
`web/i18n/en.json` (e.g. `explanations.yieldEuro`, `explanations.soll`,
`explanations.sollAuflaufend`, `explanations.ist`, `explanations.co2`). View code passes the
i18n key (not raw text) as an optional third element of each stats row tuple; `stats-panel.js`
resolves it via the existing `t()` from `i18n.js`.

**Rationale**: FR-006 requires "a single, centrally maintained place (label → explanation) that
view code references, so adding or editing an explanation does not require touching tooltip
rendering/positioning logic." The app already has exactly this mechanism for every other label
(`t(labelKey)` in `statsRow()`) — reusing it for explanations means no second lookup/registry
module is introduced, one less thing to keep in sync, and translators/editors already know where
to find UI strings. Reuse across views (e.g. "Soll" on both month and year views, per spec Key
Entities) falls out for free: both view modules simply reference the same `explanations.soll`
key.

**Alternatives considered**:

- A separate JS registry module (`stat-explanations.js`) mapping a concept id to i18n key —
  rejected as a redundant indirection layer: the i18n key already _is_ the central per-concept
  identifier, so a wrapping map would only add a second place to update when adding a stat.
- Inline explanation strings passed directly from view code (no i18n key) — rejected: bypasses
  the existing translation mechanism (the app ships `en.json` for exactly this reason) and would
  duplicate the same English/German pair anywhere the same stat is explained twice.

## Decision: Row tuples grow an optional third element rather than a parallel structure

**Decision**: `statsPanelMarkup(titleKey, rows)`'s `rows` stay `[labelKey, value]` pairs, now
optionally `[labelKey, value, explanationKey]` triples. `statsRow()` renders the info
button/tooltip only when a third element is present.

**Rationale**: Matches FR-009 ("adding an explanation ... MUST NOT be required") and User Story 3
("without any changes to shared tooltip rendering code") directly — existing two-element rows
across every view keep working unchanged; a view opts a stat into an explanation by appending one
string to its existing row array literal. No new parameter, no second array to keep in sync with
row order.

**Alternatives considered**: A separate `explanations` map passed alongside `rows` keyed by
`labelKey` — rejected: `labelKey` is already reused across views with different meanings in
principle (e.g. both `month.stats.sollTotal` and `year.stats.sollTotal` exist as distinct i18n
keys, so keying by label is already the natural per-row identity); a side map is strictly more
bookkeeping than an inline third tuple element for no behavioural benefit.

## Decision: Touch-device omission and hover/focus disclosure are pure CSS; only edge-flip needs JS

**Decision**:

- The info `<button>` itself is unconditionally present in the rendered HTML (server/client markup
  doesn't know the device's pointer capability), but styled `display: none` by default and
  `display: inline-flex` only inside `@media (hover: hover) and (pointer: fine)`. This matches the
  spec's Assumptions section (hover/pointer-capability detection, not screen width) and the
  approved mockup's documented intent (`mockup.html`'s comment: "Real CSS uses `(hover: none)`").
- Tooltip reveal (`.info-tooltip` visibility) is driven by `.info-trigger:hover .info-tooltip` and
  `.info-trigger:focus-visible .info-tooltip` CSS rules — no JS show/hide logic, satisfying FR-002/
  FR-003/FR-008 with no risk of a stuck-visible tooltip if JS fails to load.
- Edge-flip (FR-007) is the one behavior pure CSS can't express in this codebase's layout (the
  stats panel's width and the icon's position within it vary per view/viewport, so there's no
  fixed breakpoint to hang a media query off). A single delegated `focusin`/`pointerenter`
  listener (attached once, at app startup, via `initInfoTooltips()` called from `main.js` — see
  contracts/info-tooltip.md) measures the about-to-show tooltip's projected right edge against
  `window.innerWidth` and toggles a `.info-trigger--flip` class that switches the tooltip's CSS
  anchor from centered to right-aligned (mirrors `mockup.html`'s `.flip-right` modifier, renamed
  to be BEM-consistent with the rest of the codebase's `__`/`--` naming, e.g. `.info-panel__value`).

**Rationale**: Keeps the feature's core behavior (show/hide) resilient and dependency-free (CSS
alone), reserving JS for the one piece that genuinely needs runtime geometry. A single delegated
listener (rather than one per icon, re-wired on every view render) avoids memory-leak-prone
listener churn across the app's hash-routed view swaps and needs no changes to individual view
modules' render functions.

**Alternatives considered**:

- Per-icon fixed flip classes hardcoded per stat (as the mockup demo did for illustration) —
  rejected for the real implementation: the same explanation key/stat renders at different
  horizontal positions across day/month/year/total views and viewport widths, so a static class
  would be wrong in some contexts and right in others by accident.
- A full popover-positioning library (e.g. Floating UI) — rejected: constitution Technical
  Standards forbids introducing new runtime dependencies without a documented need, and a single
  `getBoundingClientRect` check fully satisfies FR-007's actual requirement (flip when clipped)
  without the library's generality overhead.
- `anchor-positioning` CSS (native `anchor()`/`position-anchor`) — rejected for now: not yet
  supported in enough browsers to be a safe default without a JS fallback anyway, so it would add
  complexity without removing the JS path.

## Decision: One shared markup helper, not per-view duplication

**Decision**: `stats-panel.js` gains one internal helper (e.g. `infoTooltipMarkup(explanationKey)`)
called from `statsRow()`; no view module builds icon/tooltip HTML itself.

**Rationale**: Direct restatement of User Story 3's independent test ("using the same visual style
and hover behavior as the existing five, with no changes needed to the tooltip's
rendering/positioning code") and FR-006. `stats-panel.js` is already the single module every
day/month/year/total/welcome view routes stats rows through (see `plan.md` Project Structure), so
it's the natural (and only) place this lives.

**Alternatives considered**: A standalone `info-tooltip.js` component module, imported separately
by each view — rejected: would require every view module to both build its rows _and_ separately
render tooltip markup inline in its own template string, reintroducing the per-call-site
duplication User Story 3 explicitly guards against. Kept as a plain internal function inside
`stats-panel.js` instead (see contracts/info-tooltip.md for the exact signature this plan commits
to, which is the one piece of new public surface: `initInfoTooltips()`, needed by `main.js`).
