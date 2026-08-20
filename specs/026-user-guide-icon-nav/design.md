# Design: Benutzerhandbuch-Icon neben Transparency-Toggle

Approved layout for moving the Benutzerhandbuch (user guide) link out of the nav list and into
`.app-header__actions` as an icon-only control, captured from the reviewed mockup (see
**Mockup** link at the bottom). Built from the real `.app-header`/`.transparency-toggle` markup
and `web/css/tokens.css` values, so it reads as the actual app rather than a generic template.

## Header icon pair

The Benutzerhandbuch icon (`documentText`, unchanged from the current nav icon) sits directly to
the **left** of the existing Transparency toggle, both inside `.app-header__actions`, styled as a
matched pair — same size (`2.25rem` square button), same border/background/radius, same gap
between them as the rest of `.app-header__actions`'s children:

```
[ info-panel (desktop only) ]   [📄 Handbuch] [👁 Transparenz]   [☰]
```

- Benutzerhandbuch icon: plain button/link, no `aria-pressed` state (it's a navigation action, not
  a toggle) — visually identical chrome to `.transparency-toggle` (border, background, radius,
  size) but without the pressed-state background swap.
- Transparency icon: unchanged existing toggle, immediately to its right.
- No visible text label on either icon. Accessible name comes from `aria-label`
  (`nav.userGuideView` resolved through i18n, plus the existing "opens new tab" phrasing folded
  into the label rather than a separate visible/sr-only suffix).
- A native `title` attribute mirrors the label for mouse-hover users (matches the mockup's
  tooltip-on-hover treatment); no custom JS tooltip component needed.

Satisfies: FR-001, FR-002, FR-003, FR-005, FR-006, FR-008; Acceptance Scenarios 1–2 of User
Story 1.

## Removal from the nav list

The `userGuide` entry is removed from `NAV_ITEMS` in `main.js` entirely — it no longer renders in
the (desktop or burger-collapsed mobile) navigation list. The header icon pair is the only
remaining way to reach the guide.

Satisfies: FR-004; Acceptance Scenario 1 of User Story 2.

## Responsive behavior

The icon pair lives in `.app-header__actions`, which is already the header row's right-hand
group visible at every viewport width (unlike `.info-panel--desktop`, which collapses below
`md:`). No new breakpoint logic needed — confirmed in the mockup's Desktop/Mobile viewport
toggle: both icons stay inline with the brand and burger button on narrow widths, never move
into the burger dropdown.

Satisfies: FR-007; Acceptance Scenario 3 of User Story 1.

## Language switch behavior

The icon's link target keeps using the existing `href()` function (re-resolves
`docs/user-guide.md` vs `docs/user-guide.de.md` from `getLanguage()`), and its `aria-label`/
`title` re-resolve through `t('nav.userGuideView')` the same way `applyNavLabels()` already
refreshes the transparency toggle's label — no reload required.

Satisfies: FR-009; Acceptance Scenario 2 of User Story 2.

## Out of scope for this mockup (per spec, unaffected by layout)

- Exact GitHub URL construction per language — already implemented, unchanged.
- Language-switcher behavior itself.
- Mobile sub-nav bar (`.info-panel--mobile`, production/weather) — untouched by this feature.
- Whether a JS-driven tooltip component (vs. native `title`) is used — a native `title` attribute
  satisfies the reviewed hover/focus affordance; a richer tooltip is an implementation choice for
  `/speckit-plan`, not a layout requirement.

## Mockup

Local, durable copy: [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/b1042997-fad6-4845-b480-7b33b4cb0cf7
