# Feature Specification: Tailwind CSS Dashboard Redesign

**Feature Branch**: `005-tailwind-css-dashboard-ui`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "I would like to use Tailwind CSS as frontend framework for displaying all relevant data using a nice app structure (for navigation) and nice presentation." Follow-up: "for the charts, I would like to use the ApexCharts library."

## Constitution Check

This feature is governed by the Photovoltaikanlage Allwang Modernization Constitution.

| Principle                                 | Applicability       | How Satisfied                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | ✅ Core             | No `.js` data file is touched; the redesign is purely presentational and reads existing data exactly as today.                                                                                                                                                                                                              |
| III. No Backend Introduction              | ✅ Core             | Styling is produced by a one-time/CI build step into a static CSS file; nothing new runs server-side or is required at request time.                                                                                                                                                                                        |
| IV. Responsive-First Layout               | ✅ Core             | Navigation and all views MUST remain usable from 320 px to 2560 px.                                                                                                                                                                                                                                                         |
| VI. Preserve All Five Visualization Modes | ✅ Core             | This feature changes presentation and navigation only; all existing view behaviors and data are preserved unchanged.                                                                                                                                                                                                        |
| Technical Standards → Frontend            | ⚠️ Amendment needed | The constitution currently states "no framework... unless explicitly approved" and "no bundler required unless a documented concern exists." Adopting Tailwind's compiled build step is an intentional, user-requested exception this feature introduces; `/speckit-plan` MUST record the resulting constitution amendment. |
| V. Modern Charting — No Custom Pixel Math | ✅ Core             | ApexCharts is an established, maintained charting library within the principle's existing allowance ("e.g., Chart.js, Apache ECharts, or Recharts"); it replaces the current Chart.js instance as the single rendering engine for all five visualization modes — no custom pixel-positioning engine is introduced.          |

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Coherent, Polished Presentation of All Solar Data (Priority: P1)

A visitor opens the site and sees every piece of solar production data — current output, today's trace, monthly and yearly totals, lifetime totals, and the multi-year comparison — presented with one consistent, modern visual style (colors, typography, spacing, card/table treatment), instead of the current mix of minimally styled elements.

**Why this priority**: This is the core of the request — the visual quality of the existing dashboard is the main gap being addressed. Every other improvement (navigation, responsiveness) sits on top of this consistent presentation layer.

**Independent Test**: Load each existing view (overview, day, month, year, comparison, totals) and confirm all of them share the same color palette, typography scale, spacing rhythm, and card/table styling, with no view visibly "unstyled" relative to the others.

**Acceptance Scenarios**:

1. **Given** any of the existing views is open, **When** the page renders, **Then** headings, body text, numeric values, and chart containers use a single consistent visual style shared across all views.
2. **Given** the current production widget, monthly totals, and yearly totals are all visible, **When** the user compares them, **Then** they are presented as clearly distinguishable, visually consistent summary elements (not plain unstyled text).
3. **Given** the site is opened with the operating system set to dark mode, **When** any view loads, **Then** the redesigned presentation adapts to a dark color scheme with sufficient contrast, matching the light-mode design's structure.

---

### User Story 2 - Clear App Navigation Between All Views (Priority: P2)

A user wants to move between the different sections of the site (current status, daily detail, monthly totals, yearly totals, multi-year comparison, lifetime totals) using a visible, always-available navigation menu that shows where they currently are.

**Why this priority**: The current navigation exists but is minimal; without a clear, discoverable structure, users (especially first-time visitors) don't know what views are available. This directly follows the "nice app structure for navigation" request.

**Independent Test**: From any view, open the navigation menu and confirm every other view is listed, is one click/tap away, and the currently active view is visually highlighted.

**Acceptance Scenarios**:

1. **Given** the site is open on any view, **When** the user looks at the navigation, **Then** all available views are listed with clear, human-readable labels.
2. **Given** the user is on a specific view, **When** they look at the navigation, **Then** the entry corresponding to the current view is visually marked as active/selected.
3. **Given** the user selects a different view from the navigation, **When** the new view loads, **Then** the navigation immediately reflects the new active view without a full page reload.

---

### User Story 3 - Usable Navigation and Layout on Any Screen Size (Priority: P3)

A user on a narrow smartphone screen and a user on a large desktop monitor both get a navigation structure and data layout appropriate to their screen, with nothing clipped, overlapping, or requiring horizontal scrolling.

**Why this priority**: The constitution mandates responsive-first layout, and a "nice app structure" is only nice if it holds up across devices; this extends User Story 2 to all viewport sizes.

**Independent Test**: Resize the viewport from 320 px to 2560 px and confirm the navigation adapts (e.g., collapses into a compact menu on narrow screens, expands into a persistent layout on wide screens) while remaining fully usable at every size.

**Acceptance Scenarios**:

1. **Given** a 320 px-wide viewport, **When** the site loads, **Then** the navigation is reachable (e.g., via a menu control) without causing horizontal scrolling or clipped content.
2. **Given** a desktop-width viewport, **When** the site loads, **Then** the navigation is persistently visible alongside the content without needing to be opened.
3. **Given** any viewport width between 320 px and 2560 px, **When** the user views a data-heavy screen (e.g., yearly comparison chart), **Then** the chart and its surrounding summary elements reflow to fit without overlapping or being cut off.

---

### Edge Cases

- What happens when a selected view has no data available yet (e.g., today's data not yet pushed, or a year with only partial data)? The presentation MUST show a clear, styled empty/placeholder state consistent with the overall design, not a broken or blank layout.
- How does the navigation handle the full 20+ year history (2006–present) without becoming an overwhelming, unscannable list?
- How do longer translated labels (the site supports multiple languages) fit within the navigation without truncation or overlap?
- How does the design communicate a "not producing" or error/offline state (e.g., 0 W at night) in a way that remains legible in both light and dark modes and doesn't rely on color alone?
- What happens if a user's browser window is resized while a view is open — does the layout reflow live, or does it require a reload?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST present all existing views (current production, daily trace, monthly totals, yearly totals, multi-year daily comparison, lifetime totals) using one consistent visual design system (shared colors, typography, spacing, and component styling).
- **FR-002**: System MUST provide a navigation menu listing every available view with human-readable labels, reachable from every screen.
- **FR-003**: Navigation MUST visually indicate which view is currently active.
- **FR-004**: Navigation MUST remain fully usable, with no clipped or hidden functionality, across viewports from 320 px to 2560 px wide, adapting its layout to the available space.
- **FR-005**: Key numeric summary values (current power output, daily/monthly/yearly energy totals, lifetime totals) MUST be presented in visually distinct, scannable summary elements separated from chart and table content.
- **FR-006**: The redesigned presentation MUST support both light and dark viewing modes, matching the system's existing automatic light/dark behavior, with sufficient text/background contrast in both.
- **FR-007**: The redesign MUST NOT change the underlying behavior, data, or availability of any of the existing five visualization modes — only their presentation, navigation structure, and chart-rendering engine (per FR-013) change.
- **FR-008**: The system MUST continue to read and display data directly from the existing static SolarLog data files, unchanged in format or location.
- **FR-009**: Views with no data available for the selected period MUST show a clearly styled empty/placeholder state consistent with the overall design, rather than a blank or broken layout.
- **FR-010**: The visual design MUST communicate status information (e.g., "not producing") through more than color alone (e.g., icon or text label), so it remains understandable for color-blind users.
- **FR-011**: Selecting a different view from the navigation MUST update the visible content and active-navigation indicator without a full page reload.
- **FR-012**: The visual styling MUST be produced via a compiled build step (generating an optimized, static CSS file committed to or produced for the deployed site) rather than loaded from an external runtime script at page-view time, per the user's confirmed preference.
- **FR-013**: All charts across all five visualization modes (daily trace, monthly bar, yearly bar, multi-year daily comparison, and any other chart view) MUST be rendered using the ApexCharts library, producing equivalent or better data fidelity, tooltip/hover behavior, and responsiveness than the charts they replace.

### Key Entities

- **View / Section**: A distinct screen of the app (overview/current, day, month, year, comparison, totals); has a label, an active/inactive navigation state, and associated data content.
- **Navigation Menu**: The always-reachable list of all views; adapts its layout by viewport width and tracks which view is currently active.
- **Summary Element (stat/card)**: A visually distinct presentation unit for a single numeric metric (e.g., current power, monthly total).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time visitor can identify and reach any of the site's six existing views (current, day, month, year, comparison, totals) within 10 seconds of landing on the site, without prior instruction.
- **SC-002**: On a 320 px-wide viewport, the site renders every view with zero horizontal scrolling and zero clipped or overlapping content.
- **SC-003**: All views share a single, visually consistent design — a visual audit across all six views finds no view using colors, typography, or spacing inconsistent with the others.
- **SC-004**: Users can distinguish the current active view from the navigation menu in under 2 seconds, in both light and dark mode.
- **SC-005**: No existing data, chart interaction, or functional behavior is lost or altered as a result of the redesign — every acceptance scenario from the prior modernization feature continues to pass unchanged, using the new charting engine.

## Assumptions

- The redesign applies to the entire existing single-page app (all six current views/modes) rather than a subset.
- "Nice app structure for navigation" is interpreted as a persistent, always-reachable navigation menu that adapts responsively (e.g., a sidebar or top bar on desktop, a collapsible menu on mobile) rather than a change to the underlying view/routing model, which is preserved from the prior modernization feature.
- Existing light/dark mode behavior, internationalization (language switcher), and all data-fetching logic are preserved unchanged; this feature is scoped to visual presentation and navigation structure only.
- Per user confirmation, the styling framework is integrated via a compiled build step producing a static, optimized CSS file — not a runtime/CDN script — which requires a corresponding amendment to the project constitution's "no bundler unless documented concern" clause; this amendment will be recorded during `/speckit-plan`.
- No new content or data views are introduced by this feature; scope is limited to how existing data and navigation are presented.
- Per user follow-up, ApexCharts replaces the currently vendored Chart.js as the sole charting engine for all five visualization modes; this is a rendering-engine swap only — chart data, interactions (tooltips, zoom/pan if present), and content remain equivalent, and no constitution amendment is needed since ApexCharts already qualifies under Principle V's "established, maintained charting library" allowance.
