# Contract: App Navigation (`#app-nav` rendering, `web/js/main.js`)

**Feature**: 005-tailwind-css-dashboard-ui | **Consumers**: `main.js`'s `dispatch()`/router
integration; DOM/CSS contract observed by Playwright tests.

This is the UI contract for the always-reachable navigation menu (FR-002–FR-004, FR-011; User
Stories 2 and 3). It extends the existing `renderNav()`/`NAV_ITEMS` pattern in `main.js`; it does
not replace `router.js`'s route parsing/formatting contract, which is unchanged.

## Markup contract

```html
<header class="app-header">
  <div class="app-header__brand">…</div>
  <div class="app-header__actions">
    <div class="lang-switcher" id="lang-switcher"></div>
    <button
      type="button"
      class="app-nav__toggle"
      id="app-nav-toggle"
      aria-expanded="false"
      aria-controls="app-nav-list"
    >
      <!-- visible only below the md: breakpoint; hamburger icon + accessible label.
           Lives in the header (inline, right of the title) rather than inside <nav>, so it
           opens right where the user's eye already is on mobile. -->
    </button>
  </div>
</header>
<nav class="app-nav" id="app-nav" aria-label="[nav.ariaLabel i18n]">
  <ul id="app-nav-list" class="app-nav__list" data-open="false">
    <li><a href="#/" aria-current="page">…</a></li>
    <li><a href="#/total">…</a></li>
    <li><a href="#/compare">…</a></li>
    <!-- one <li><a> per NavItem, all 6 routes always present in the DOM -->
  </ul>
</nav>
```

The toggle button references the list purely via `aria-controls`/`id` — it does not need to be a
DOM descendant of `<nav>` for that relationship to hold for assistive tech.

## Behavioral requirements

- **Full route coverage (FR-002)**: all six routes (`dashboard`, `day`, `month`, `year`, `total`,
  `compare`) MUST appear as `<a>` elements with `t()`-resolved human-readable text, at all times —
  not conditionally injected based on viewport.
- **Active-state marking (FR-003)**: exactly one `<a>` MUST carry `aria-current="page"` at any
  time, matching `currentRoute.view`; this MUST update synchronously within the same `dispatch()`
  call that changes `currentRoute` — no separate re-render pass, no flash of stale state.
- **No full reload (FR-011)**: selecting a nav item MUST navigate via the existing hash-based
  `router.js`/`onRouteChange` flow; the browser MUST NOT perform a full document navigation
  (verified by an unchanged `document` reference / no `load` event across the click).
- **Responsive layout (FR-004, User Story 3)**:
  - At viewport width `>= 768px` (Tailwind `md:`): `app-nav__toggle` is hidden (Tailwind `md:hidden`
    or equivalent) and `app-nav__list` is always visible/persistent — no `isOpen` state needed.
  - At viewport width `< 768px`: `app-nav__toggle` is visible, sitting inline in the header on the
    title's right side; `app-nav__list`'s visibility is controlled by `aria-expanded` on the
    toggle button (and a matching `data-open`/utility-class toggle on the list) — collapsed by
    default, expanded on toggle click. When expanded, the list is positioned absolutely and opens
    downward starting right below the header/title (`.app-nav`'s `position: relative` is its
    containing block), not at the bottom of the document.
  - At no width in [320px, 2560px] does the nav cause horizontal scrolling or clip any item
    (SC-002).
- **Keyboard/a11y**: the toggle button MUST be a real `<button>` (not a `<div>` with a click
  handler) with `aria-expanded` kept in sync with visible state, and `aria-controls` pointing at
  the list's `id`, so assistive tech can determine expanded/collapsed state without relying on
  color/visual state alone (ties to FR-010's "not color alone" principle applied to UI state, not
  just data status).

## Non-goals of this contract

- Does not change `router.js`'s `parseRoute`/`formatRoute` functions or the URL/hash scheme.
- Does not add, remove, or reorder the six views/routes themselves (Assumptions section of spec).
- Long-tail history navigation (20+ years, per spec's Edge Cases) is handled inside the `year`/
  `compare` views' own content, not by this top-level nav contract, which only ever lists the six
  fixed view categories.
