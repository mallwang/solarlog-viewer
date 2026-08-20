# Phase 0 Research: User Guide Icon Next to Transparency Toggle

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the spec and design.md
already resolved every open question (icon choice, placement, ordering, tooltip approach,
accessible-name source). This document records the concrete implementation decisions made while
turning design.md into code, each with rationale and the alternative considered.

## 1. Markup pattern for the new button

**Decision**: A `<button type="button">` element (not an `<a>`), placed in `index.html` right
before `#transparency-toggle` inside `.app-header__actions`, with `id="user-guide-link"` and a
dedicated class (e.g. `user-guide-link`) for styling, with an inline click handler in `main.js`
that does `window.open(href(), '_blank', 'noopener,noreferrer')` — mirroring how
`transparency-toggle` is already a `<button>`, not an `<a>`.

**Rationale**: FR-008 requires the new icon to match the Transparency toggle "in size, spacing,
and visual style" — copying its element type keeps default browser button chrome (focus ring,
`cursor: pointer` treatment) identical without fighting `<a>` vs `<button>` default style
differences (line-height, inline vs block). `window.open` reproduces `target="_blank"` +
`rel="noopener noreferrer"` semantics.

**Alternatives considered**:

- Keep it as an `<a href>` element restyled to look like a button. Rejected: an anchor needs
  extra CSS resets (`display`, `text-decoration`, `color: inherit`) to visually match a
  `<button>`, adding CSS surface for no benefit, and `.transparency-toggle` is already the proven
  pattern to mirror.
- Reuse the exact `NAV_ITEMS` external-link rendering path (an `<a>` inside `<li>`) but move it
  outside `#app-nav-list`. Rejected: that path is coupled to `renderNav()`'s list-rendering loop
  and its "sr-only opens-new-tab suffix + visible label" markup, which FR-002/FR-006 explicitly
  replace with an icon-only + `aria-label`-carries-everything approach; keeping it there would
  require branching renderNav() for a single non-list item, ugly since it's no longer a list
  member at all (design.md already removes it from `NAV_ITEMS`).

## 2. Accessible name / tooltip wording

**Decision**: Reuse `t('nav.userGuideView')` for the `aria-label` base text, folding the existing
`nav.opensNewTab` phrasing into the same string (e.g.
`` `${t('nav.userGuideView')} (${t('nav.opensNewTab')})` ``) rather than adding a new i18n key.
Set the same computed string on both `aria-label` and `title`.

**Rationale**: FR-005/FR-006 require the accessible name to keep resolving per-language via
existing i18n infra and to keep communicating "opens in new tab" without visible suffix text.
Both existing keys already carry the right meaning; concatenating them avoids adding new
translation strings that would need review in both `de.json` and `en.json`, and keeps the
`aria-label` wording obviously equivalent to what screen-reader users already heard from the old
nav-list sr-only suffix.

**Alternatives considered**: A brand-new combined i18n key (e.g. `nav.userGuideIconLabel`).
Rejected as unnecessary duplication — the two source strings already say exactly what's needed
and concatenation keeps a single source of truth per phrase.

## 3. CSS reuse strategy

**Decision**: Give the new button the existing `.transparency-toggle` class in addition to its
own identifying class/id (e.g. `class="user-guide-link transparency-toggle"`), relying on
`.transparency-toggle`'s existing border/background/radius/padding rule for the shared chrome,
and skip applying `aria-pressed` (so the `[aria-pressed='true']` background-swap rule never
matches it, since it isn't a toggle).

**Rationale**: FR-008 requires matched size/spacing/visual style; sharing the CSS class is the
smallest-diff way to guarantee that without duplicating four property declarations that must stay
in sync forever. Since the new button never gets `aria-pressed="true"`, the existing
`.transparency-toggle[aria-pressed='true']` rule simply never applies — no extra CSS needed to
suppress it.

**Alternatives considered**: A new, separate CSS class with duplicated property values.
Rejected — the two icons drifting out of sync (e.g. a future padding tweak to one but not the
other) is exactly the kind of regression FR-008 exists to prevent; shared class name is
self-enforcing.

## 4. Where the click-open logic lives

**Decision**: A small `renderUserGuideLink()` / `initUserGuideLink()` pair in `main.js`,
structurally mirroring the existing `renderTransparencyToggle()` / `initTransparencyToggle()`
pair immediately below it. `renderUserGuideLink()` sets `href`-derived `aria-label`/`title` (also
callable again from the language-switch handler, same as `renderNav()` already is);
`initUserGuideLink()` wires the one-time click listener.

**Rationale**: Keeps the same call-and-wire shape already established for the Transparency
toggle in the same file, so a future reader scanning `main.js`'s `bootstrap()` sees a
recognizable, consistent pattern rather than one-off logic. Reuses the already-defined
`href()` closure logic from the old `NAV_ITEMS` entry (moved, not rewritten).

**Alternatives considered**: Extracting a shared `initIconButton()` helper now to unify
Transparency-toggle and user-guide-link wiring. Rejected as premature — only two call sites exist
and their state models differ (toggle has a persisted boolean; guide link does not); introducing
an abstraction for two call sites is exactly the kind of complexity the constitution's minimalism
bias discourages without a third concrete use case.

## 5. Test coverage placement

**Decision**: Extend `tests/e2e/transparency-mode.spec.js`'s neighborhood with a new
`tests/e2e/header-actions.spec.js` (or similarly named) file covering the user guide icon
specifically, rather than folding assertions into the existing transparency spec file (which is
scoped to opacity/data-transparency behavior) or into `dashboard-nav.spec.js` (scoped to routed
nav items, not external links). Also update `dashboard-nav.spec.js` if it currently asserts the
full `NAV_ITEMS` list including `userGuide`.

**Rationale**: Keeps each spec file's scope narrow and its name descriptive, matching the
existing one-concern-per-file pattern in `tests/e2e/`.
