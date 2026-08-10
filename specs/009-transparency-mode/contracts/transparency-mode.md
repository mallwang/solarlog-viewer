# Contract: Transparency Mode Preference & CSS Hook

**Feature**: 009-transparency-mode | **Consumers**: `web/js/main.js` (bootstrap + toggle wiring), `web/css/tokens.css` / `web/css/app.css` (opacity rules), all view modules that render nav/chart-container/stats-panel markup, Playwright tests.

This is the UI/data contract between the new preference module and everything that needs to react to it. It is additive: no existing contract (`navigation.md`, `chart-factory.md`) is modified.

## Module contract: `web/js/settings.js`

```js
/** @returns {boolean} Persisted transparency-mode selection (localStorage) or `false` default. */
export function isTransparencyEnabled();

/**
 * Persists the transparency-mode selection and applies it to the document immediately.
 * @param {boolean} enabled
 * @returns {void}
 */
export function setTransparencyEnabled(enabled);

/** Applies the persisted/default transparency-mode selection to the document. Call once on bootstrap. */
export function initTransparencyMode();
```

- Mirrors the existing `getLanguage()` / `setLanguage()` / `initI18n()` shape in `web/js/i18n.js`.
- `localStorage` key: `solarlog-transparency`, values `"true"` / `"false"` (see `data-model.md`).
- `setTransparencyEnabled()` and `initTransparencyMode()` are the only functions that write the `data-transparency` attribute described below — no other module may set it directly, so there is exactly one source of truth for the applied state.

## DOM/CSS contract

```html
<html data-transparency="on">
  <!-- ...existing header/app-nav/period-nav/chart-container/stats-panel markup, unchanged... -->
</html>
```

- `data-transparency` is set on the root `<html>` element: `"on"` when enabled, attribute absent (or `"off"`) when disabled.
- No other markup changes are required in `dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`, `period-nav.js`, or `stats-panel.js` — they keep rendering their existing classes (`app-nav`, `period-nav__link`, chart-container cards, `stats-panel`), and the opacity effect is applied purely via the CSS rules below.

### CSS rules (in `web/css/tokens.css` + `web/css/app.css`)

```css
:root {
  --transparency-nav-opacity: 1;
  --transparency-panel-opacity: 1;
}

html[data-transparency='on'] {
  --transparency-nav-opacity: 0;
  --transparency-panel-opacity: 0.4;
}

/* .period-nav__link (prev/next/today/parent buttons) is deliberately excluded — those stay
   fully opaque at all times so they remain easy to spot/click (user feedback). Only the main
   header nav's background fades. */
.app-nav {
  background-color: color-mix(
    in srgb,
    var(--color-bg) calc(var(--transparency-nav-opacity) * 100%),
    transparent
  );
}

.chart-container,
.stats-panel {
  background-color: color-mix(
    in srgb,
    var(--color-bg-elevated) calc(var(--transparency-panel-opacity) * 100%),
    transparent
  );
}
```

(Exact selectors/property choice — `background-color` vs. `opacity` — is an implementation detail, and for panels it matters: an earlier draft applied `opacity` directly to `.chart-container`/`.stats-panel`, which faded the panel's text/values along with its background and made them hard to read. FR-003 was corrected during implementation to mean the panel's _background card_ renders at 40% opacity, not its content — so `background-color` + `color-mix()` is used here too, mirroring the nav rule, leaving text/chart-content opacity untouched at `1`.)

## Behavioral requirements

- **Immediate effect (FR-007)**: toggling MUST update `data-transparency` synchronously in the same event handler that reads the user's action — no reload, no route change.
- **Global scope (FR-001, FR-005)**: because the attribute lives on `<html>`, every current and future view automatically inherits the effect; no view module needs to opt in individually.
- **Persistence (FR-006)**: `setTransparencyEnabled()` MUST write to `localStorage` before or in the same tick as applying the attribute, so a refresh immediately after toggling reflects the latest choice.
- **Full transparency for nav (FR-002)**: computed `.app-nav` background alpha MUST be `0` when enabled — not a low-but-nonzero value. `.period-nav__link` background alpha MUST stay `1` (unaffected) at all times.
- **40% opacity for panels (FR-003)**: computed panel _background_ alpha MUST be `0.4` when enabled; panel content (text, values, chart lines) MUST stay at opacity `1`.
- **Restore on disable (FR-004)**: both tokens MUST return to `1` when disabled, exactly matching pre-feature appearance (no regression to existing visual baseline).
- **Legibility (FR-008)**: nav text/icons and panel content MUST remain in the DOM and interactive at all times — transparency is a paint-layer effect only, never `display:none`/`visibility:hidden`/`pointer-events:none`.

## Test hooks for Playwright (`tests/e2e/transparency-mode.spec.js`)

- Assert `document.documentElement.getAttribute('data-transparency')` toggles between `null`/`'off'` and `'on'`.
- Assert computed style: `.app-nav` background alpha ≈ 0 when on; `.period-nav__link` background alpha stays ≈ 1 when on; chart-container/stats-panel computed background alpha ≈ `0.4` when on, while their content (`.chart-mount`, `.stats-panel table`) stays at `opacity: 1`.
- Assert `localStorage.getItem('solarlog-transparency')` reflects the last toggle after a `page.reload()`.
- Repeat the assertions across at least two routes (e.g. `#/` dashboard and `#/year`) to cover FR-005.
