# Contract: `stats-panel.js` info-tooltip extension

This is an internal module contract (day/month/year/total/welcome views → shared
`stats-panel.js` helper, plus one call from `main.js`), not a network/API contract — the project
has no server-side interfaces (constitution Principle III). Documented here because it is the
interface every stats-row-producing view module integrates against, and the one new piece of
public surface (`initInfoTooltips`) that `main.js` must call.

## `statsRow()` (internal, extended signature)

```js
/**
 * @param {string} labelKey - i18n key for the stat's label.
 * @param {string} value - Pre-formatted display value.
 * @param {string} [explanationKey] - i18n key under `explanations.*` (see data-model.md). When
 *   given, renders a focusable info button + tooltip next to the label; when omitted, renders
 *   exactly as before this feature (no markup change, no layout footprint).
 * @returns {string} HTML for one `<tr>`.
 */
function statsRow(labelKey, value, explanationKey) {
  /* ... */
}
```

## `statsPanelMarkup()` (public, extended `rows` element shape)

```js
/**
 * @param {string} titleKey
 * @param {([string, string] | [string, string, string])[]} rows - [labelKey, value] pairs, or
 *   [labelKey, value, explanationKey] triples to opt a row into an info tooltip.
 * @returns {string}
 */
export function statsPanelMarkup(titleKey, rows) {
  /* ... */
}
```

**Behavior contract**:

| Input                                                                                                                   | Output                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row is a 2-element `[labelKey, value]`                                                                                  | Identical markup to pre-feature `statsRow()` — no `.info-trigger`, no extra wrapper (FR-009).                                                                                                                                               |
| Row is a 3-element `[labelKey, value, explanationKey]`, `explanationKey` resolves via `t()`                             | `<th>` contains `<span class="stat-label">` wrapping the label text and a `<button type="button" class="info-trigger" aria-describedby="…">` whose child `<span role="tooltip" id="…">` holds `t(explanationKey)`.                          |
| Same `explanationKey` used in two different `statsPanelMarkup()` calls (e.g. day view's "Soll" and month view's "Soll") | Both render independently but read the same underlying i18n text — editing `explanations.soll` in `de.json`/`en.json` updates both without touching either view module (FR-006, User Story 3 acceptance scenario 2).                        |
| Multiple explained rows within one panel                                                                                | Each button/tooltip pair gets its own generated DOM `id` (monotonic counter) so `aria-describedby` never collides, even though `explanationKey` may repeat within the same page across different views' panels rendered at different times. |

## `initInfoTooltips()` (new public export)

```js
/**
 * Wires the one shared edge-flip behavior for every `.info-trigger` on the page (present or
 * future — delegated at the document level, so it needs no re-wiring when a view's `innerHTML`
 * is replaced on route change). Call once, at app startup.
 *
 * On `focusin`/`pointerenter` of an `.info-trigger`, measures whether its tooltip (about to
 * become visible via CSS) would overflow the viewport's right edge and toggles
 * `.info-trigger--flip` accordingly (FR-007).
 * @returns {void}
 */
export function initInfoTooltips() {
  /* ... */
}
```

**Call-site contract**: `web/js/main.js` calls `initInfoTooltips()` once during startup
initialization (alongside the other one-time `init*` calls already there, e.g.
`initTransparencyMode`) — **not** from each view's `render()`, since the listener is delegated
and survives `container.innerHTML` replacement on route change.

## CSS contract

New rules added to `web/css/app.css` (no new stylesheet, no new design tokens — reuses existing
CSS custom properties for colour/spacing/radius, per constitution Technical Standards):

| Selector                                                                                | Purpose                                                                                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `.stat-label`                                                                           | Flex row wrapping label text + `.info-trigger` (mirrors `mockup.html`).                        |
| `.info-trigger`                                                                         | The circular "i" button; `display: none` by default.                                           |
| `@media (hover: hover) and (pointer: fine) { .info-trigger { display: inline-flex; } }` | Renders the button only on hover-capable, fine-pointer devices (FR-004, Assumptions).          |
| `.info-trigger:hover .info-tooltip`, `.info-trigger:focus-visible .info-tooltip`        | Reveals the tooltip (FR-002, FR-008); no JS show/hide.                                         |
| `.info-tooltip`                                                                         | The floating callout; `visibility: hidden` / `opacity: 0` by default, centered above the icon. |
| `.info-trigger--flip .info-tooltip`                                                     | Right-anchored variant, toggled by `initInfoTooltips()` (FR-007).                              |

No existing selector's behavior changes for rows without an `explanationKey` — `.summary-table
th`/`.summary-table td` rules are untouched.
