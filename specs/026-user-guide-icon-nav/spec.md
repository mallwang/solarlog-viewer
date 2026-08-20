# Feature Specification: User Guide Icon Next to Transparency Toggle

**Feature Branch**: `026-user-guide-icon-nav`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Benutzerhandbuch nur als Icon anzeigen neben dem Transparency icon" (Show the user guide only as an icon next to the Transparency icon)

**Design**: Approved mockup and layout details in [design.md](./design.md)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open the user guide quickly from the header (Priority: P1)

At any screen width, a user sees a standalone document icon directly next to the Transparency
toggle in the header. Clicking/tapping it opens the language-specific user guide on GitHub in a
new tab — without having to open the main navigation.

**Why this priority**: The user guide link is currently only reachable as an entry at the end of
the main navigation list (collapsed into the burger menu on mobile). As a standalone header icon
it's always visible and reachable with a single click, matching the existing Transparency toggle.

**Independent Test**: Load the header, click the document icon next to the Transparency toggle,
and verify that the (language-appropriate) user guide opens in a new tab.

**Acceptance Scenarios**:

1. **Given** the home page is loaded (desktop width), **When** the user looks at the header,
   **Then** they see a user guide icon immediately next to the Transparency toggle icon, with no
   accompanying text.
2. **Given** the header is visible, **When** the user clicks the user guide icon, **Then** the
   user guide (`docs/user-guide.md` or `docs/user-guide.de.md`, depending on the current
   language) opens in a new browser tab.
3. **Given** the user is on a mobile/narrow viewport, **When** they view the header (without
   opening the burger navigation), **Then** the user guide icon is still visible and clickable,
   just like the Transparency toggle.

---

### User Story 2 - Existing behavior stays unchanged (Priority: P2)

The rest of the navigation (day, month, year, statistics, etc.) and the Transparency toggle keep
working unchanged after the switch; only the user guide entry moves from the nav list into the
header actions area.

**Why this priority**: Avoids regressions in the existing navigation while delivering the actual
request (icon-only link next to Transparency).

**Independent Test**: Click through all remaining nav items and verify they still work as before,
and that the user guide entry no longer appears twice (neither in the list nor the header) nor
disappears entirely.

**Acceptance Scenarios**:

1. **Given** the main navigation is open, **When** the user scans the list of nav items, **Then**
   the user guide entry is no longer present there (it now only appears as an icon in the
   header).
2. **Given** the language is switched (DE/EN), **When** the user then clicks the user guide icon,
   **Then** the guide file matching the currently selected language opens, with no page reload
   required.

---

### Edge Cases

- What happens when screen reader users focus the icon? It must still have an accessible name
  (e.g. via `aria-label` or hidden text), even without visible label text.
- How is "opens in a new tab" still communicated to screen reader users once the previous
  visible/sr-only suffix text is gone?
- How does the icon behave on hover/focus compared to the Transparency toggle (consistency of
  interaction states)?
- How do the two icons (user guide, Transparency) order themselves on very narrow viewports
  relative to each other and to the language switcher/burger menu, without overlapping?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST display a standalone, clickable user guide icon in the header
  actions area (`.app-header__actions`), immediately next to the Transparency toggle.
- **FR-002**: The user guide icon MUST be rendered as an icon only, with no accompanying visible
  text label (matching the Transparency toggle).
- **FR-003**: Clicking/tapping the icon MUST open the language-specific user guide
  (`docs/user-guide.md` for English, `docs/user-guide.de.md` for German) on GitHub in a new
  browser tab, as before.
- **FR-004**: The existing user guide entry in the main navigation list (`NAV_ITEMS`) MUST be
  removed, so the link only exists as the header icon (no duplicate way to reach it).
- **FR-005**: The icon MUST have an accessible name (e.g. `aria-label`) that continues to resolve
  per-language via the existing i18n infrastructure (`nav.userGuideView`).
- **FR-006**: The icon MUST continue to communicate that the link opens in a new tab (e.g. via
  the accessible name), even without visible "opens in new tab" hint text.
- **FR-007**: The icon MUST be visible and operable at every supported viewport width (desktop
  and mobile) — not only inside the collapsed burger navigation.
- **FR-008**: The icon MUST match the existing Transparency toggle in size, spacing, and visual
  style, so the two are perceived as a matched icon pair.
- **FR-009**: The icon's link target MUST re-order to place the user guide icon before the
  Transparency toggle (guide, then Transparency, reading left to right), per the approved
  mockup.
- **FR-010**: A language switch MUST update the icon link's target without a page reload
  (existing behavior of the `href()` function is preserved).

### Key Entities

- **User guide link**: External link to the language-specific Markdown file of the user guide in
  the GitHub repository; previously part of the main navigation list, now a standalone icon in
  the header next to the Transparency toggle.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The user guide is reachable from every view and every viewport width with exactly
  one click/tap on a visible header icon, without first having to open the main navigation.
- **SC-002**: A visual inspection of the header shows the Transparency toggle and the user guide
  icon as an immediately adjacent, identically styled icon pair, guide first.
- **SC-003**: The user guide entry no longer appears anywhere else (main navigation list, burger
  menu) — there is exactly one way to reach it.
- **SC-004**: An automated accessibility check (e.g. axe/Playwright) finds no missing accessible
  name for the new icon.

## Assumptions

- The link's target behavior (language-specific user guide on GitHub, new tab,
  `rel="noopener noreferrer"`) stays unchanged — only the placement/presentation changes, from
  "nav entry with icon + text" to "standalone icon in the header".
- The existing `documentText` icon from `icons.js` is reused, unless another icon is explicitly
  requested.
- Placement is inside `.app-header__actions`, directly next to the Transparency toggle button,
  with the user guide icon ordered first (see FR-009 and design.md).
- A hover tooltip (as already used for other icon-only controls in the project, see
  `023-weather-panel-icons`) is desirable but not strictly required by this specification, since
  it was not explicitly requested; a native `title` attribute satisfies the reviewed hover/focus
  affordance (see design.md).
- The mobile sub-nav bar (`.info-panel--mobile`) is unaffected by this change; the icon is added
  only inside `.app-header__actions`, which is visible at every width.
