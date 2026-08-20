# Phase 0 Research: Compact Weather Display with Hover Detail

No `[NEEDS CLARIFICATION]` markers remained in spec.md (validated during `/speckit-specify`), so
this phase resolves implementation-approach questions raised by the Technical Context rather than
open requirement ambiguities.

## 1. Compact indicator layout (icon over value, divider between indicators)

**Decision**: Reuse the layout approved in the UX-review mockup (`design.md`,
`mockup.html`) verbatim: each indicator is a flex column (icon on top, value beneath), the
forecast indicator gets a `border-left` divider, both indicators share one parent anchor
(`.info-panel__weather`) so the existing hover/click-through/`data-available` link behavior is
unaffected.

**Rationale**: Already reviewed and approved by the user against the real app chrome and both
viewport widths — re-deriving a layout here would risk drifting from what was actually approved.

**Alternatives considered**: None re-evaluated at this stage — layout exploration belongs to the
UX-review step, already completed.

## 2. Making the full text available without a hover (FR-006)

**Decision**: Set `aria-label` on each indicator wrapper (the `tabindex="0"` element) to the
exact full text that used to render inline (e.g. `"Klar, 21°C"` / `"Heute: Regen (15°C -
19°C)"`). This is always present in the accessibility tree regardless of hover/focus/tap state,
so a screen-reader user gets the complete description the moment they reach the element — no
interaction needed. The floating tooltip bubble stays `aria-hidden="true"`; it exists purely for
sighted mouse/touch users and never needs its own accessible wiring since `aria-label` already
covers assistive technology.

**Rationale**: `aria-label` is simpler and more robust than `aria-describedby` here — there's no
other meaningful accessible content on the indicator to combine it with (the icon is already
`aria-hidden`, and the visible short value would otherwise be announced redundantly alongside a
description). One attribute, one source of truth, no per-render unique-ID bookkeeping across the
four DOM copies (2 indicators × desktop/mobile).

**Alternatives considered**:

- **Native `title` attribute**: Rejected — inconsistent cross-browser tooltip styling/delay,
  not reliably reachable by keyboard, poor/inconsistent touch support, and the mockup already
  established a styled custom tooltip that a native `title` couldn't reproduce.
- **`aria-describedby` pointing at a visually-hidden sibling**: Rejected — functionally
  equivalent to `aria-label` for this case but requires generating and matching unique `id`s
  across four repeated DOM copies, extra complexity with no behavioral benefit here.

## 3. Touch/no-hover visual reveal (complementing FR-006 for sighted touch users)

**Decision**: Rely first on native focusability — `tabindex="0"` plus `:focus-within` already
reveals the tooltip for keyboard users and for touch browsers where tapping a non-form focusable
element moves focus to it (Safari/iOS and Chrome/Android both do this today for elements with an
explicit `tabindex`). Add a small `click`/`touchstart` handler as a purely-visual fallback that
toggles a `data-open="true"` attribute (also revealing the tooltip via CSS), closed on an
outside tap or `Escape`. This fallback only affects the tooltip's _visibility to sighted users_
— it changes nothing about accessibility, since `aria-label` (decision 2) already covers
assistive technology independently of tap/focus state.

**Rationale**: Covers the sighted-touch-user edge case (Edge Cases: "What happens on touch
devices where hover doesn't exist?") without duplicating or risking drift from the
already-present accessible text.

**Alternatives considered**:

- **CSS-only `:focus-within`/`:hover`, no JS fallback**: Rejected — a small risk exists that some
  touch browser/gesture combination taps without focusing (e.g. certain accessibility zoom
  modes), and the fallback costs one small, self-contained event listener.
- **Always-visible text below the compact value**: Rejected — reintroduces exactly the visual
  footprint this feature exists to remove (SC-001).

## 4. Reusing existing i18n strings (no new translation keys)

**Decision**: Build both the compact value and the full text purely by recombining strings
already produced by `t('infoPanel.weatherCategory.*')`, `t('infoPanel.todayLabel')`,
`t('infoPanel.tomorrowLabel')`, and `t('infoPanel.unavailable')` — the same keys
`info-panel-controller.js` already calls today. No new `de.json`/`en.json` entries.

**Rationale**: The spec's wording requirement (FR-004: "in the existing wording/format") is
satisfied automatically by reusing the same translated fragments in the same order — there is no
new user-facing phrase to translate.

**Alternatives considered**: A single new combined-format i18n key per indicator (e.g.
`infoPanel.currentTooltip`) — rejected as unnecessary duplication; the existing per-fragment keys
already compose correctly and keep translators from having to maintain two overlapping phrasings
of the same information.

## 5. Per-indicator unavailable state (FR-007)

**Decision**: Give each indicator its own `data-available` attribute and render shape: available
→ icon + compact value; unavailable → a dimmed dash icon (`–`, reduced opacity), matching the
mockup. This replaces the forecast indicator's previous "render nothing" unavailable shape
(from 023-weather-panel-icons) with the same uniform treatment current-conditions already had,
now applied consistently to both.

**Rationale**: The mockup (already approved) renders both indicators' unavailable states
identically; a blank forecast indicator next to a filled-in divider would look like a rendering
bug rather than an intentional "no data" state, which the dash resolves. The `aria-label` for the
unavailable case is `t('infoPanel.unavailable')`, same string already used today.

**Alternatives considered**: Keep the forecast's previous "renders nothing" behavior — rejected;
it predates the divider (023) and reads worse once there's a visible boundary line expecting
something on both sides of it.

## 6. String-building extraction into `weather-text.js`

**Decision**: Extract the label/prefix/temperature string assembly (for both the compact value
and the full `aria-label`/tooltip text, for both indicators, for both available/unavailable
states) into new pure functions in `web/js/weather/weather-text.js`, imported by
`info-panel-controller.js`'s `renderWeather()`. Unit-tested directly (`node --test`).

**Rationale**: `renderWeather()` currently builds one flavor of text (the inline sentence); this
feature needs the _same_ underlying data to produce two flavors (short value, full text) per
indicator without letting them drift apart (Constraints: "MUST be built from the same underlying
label/prefix/temperature source data"). A pure, directly-testable module is cheaper to keep
correct than duplicating string logic inline in the DOM-glue function, and mirrors the existing
precedent of `weather-icon.js`/`daytime.js` living beside `weather-category.js` for the same
kind of reason (023-weather-panel-icons).

**Alternatives considered**: Inline the string-building directly in `renderWeather()` as before —
rejected; `info-panel-controller.js`'s file-level comment already states it is "not unit-tested
directly," so any non-trivial branching (available/unavailable × current/forecast × today/
tomorrow) is better covered by a dedicated, unit-tested pure module than left untested inside the
DOM-glue function.
