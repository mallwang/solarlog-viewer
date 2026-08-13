# Feature Specification: Welcome Page (Default Landing View)

**Feature Branch**: `015-welcome-page-dashboard`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "I would like to add a welcome page as default page (fallback page) when entering the base url. It should consist of a split view with 2/3 left part (should show images from the solar power plant in a carousal, and below the values from the base_vars.js) to give the visitor of the application a fast impression of the power plant. The 1/3 right part should show a diagram of the todays generation (only total value, using same y-axis of the tagesertrag, no WR1/WR2, no efficiency, no UDC). No other diagrams are needed as they are already visible in the header."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - First-time visitor gets a fast plant overview (Priority: P1)

A visitor opens the site's base URL without any specific date or view in mind. Instead of landing on a chart for "today" (whose meaning isn't obvious to a stranger), they see a welcome page that immediately conveys what the plant is, what it looks like, and how it's performing today.

**Why this priority**: This is the entire point of the feature — the base URL is the first (and often only) impression for someone who wasn't handed a deep link. Without it, new visitors land on a bare day-chart with no explanation of what they're looking at.

**Independent Test**: Open the base URL (with an empty or unrecognized hash) in a fresh session and confirm the welcome page renders with plant photos, plant details, and today's generation chart — fully verifiable without any other part of the app.

**Acceptance Scenarios**:

1. **Given** a visitor navigates to the site's base URL with no hash, **When** the page loads, **Then** the welcome page is shown (not a specific day/month/year/total chart).
2. **Given** the welcome page is shown, **When** it finishes loading, **Then** the left two-thirds of the layout shows an image carousel of the plant followed by the plant's key details (from `base_vars.js`), and the right third shows today's total generation as a line chart.
3. **Given** the visitor is on a wide (desktop) screen, **When** the welcome page renders, **Then** the layout is a 2/3-left / 1/3-right split.
4. **Given** the visitor is on a narrow (mobile) screen, **When** the welcome page renders, **Then** the carousel, plant details, and today's chart all remain readable, stacked in a single column (image carousel, then plant details, then today's chart).

---

### User Story 2 - Visitor browses plant photos (Priority: P2)

A visitor on the welcome page wants to see more than one photo of the plant (e.g. the roof array, the inverter room, an overview shot) without leaving the page.

**Why this priority**: A single static image is much less compelling than a small photo set, but the feature still delivers its core value (User Story 1) even with just one image configured — this is an enhancement to that same panel.

**Independent Test**: With two or more images available, load the welcome page and confirm the carousel cycles or can be advanced through more than one image, independent of the chart or plant-details panel.

**Acceptance Scenarios**:

1. **Given** more than one plant image is available, **When** the visitor views the carousel, **Then** they can see more than one image, either through automatic rotation, manual controls, or both.
2. **Given** exactly one plant image is available, **When** the visitor views the carousel, **Then** that single image is shown without broken navigation controls (e.g. no dead "next" arrows).
3. **Given** no plant images are available, **When** the welcome page loads, **Then** the carousel area shows a neutral placeholder instead of a broken image or empty gap, and the rest of the page (plant details, today's chart) still renders normally.

---

### User Story 3 - Visitor checks today's generation at a glance (Priority: P2)

A visitor wants to know, without clicking anywhere, how much the plant has generated today and how that compares to a typical day.

**Why this priority**: This is the "fast impression" of current performance the feature description calls for. It complements the header's existing production summary and today's-yield figure by showing the shape of today's generation curve, not just a running number.

**Independent Test**: Load the welcome page on a day with recorded generation data and confirm the right-hand chart shows today's total feed-in curve on a fixed, day-comparable y-axis, independent of the carousel/plant-details panel.

**Acceptance Scenarios**:

1. **Given** today has recorded generation data, **When** the welcome page loads, **Then** the right-hand chart shows only the combined ("total") feed-in curve for today — no per-inverter (WR1/WR2) breakdown, no efficiency series, no UDC series.
2. **Given** the day chart (Tagesertrag) elsewhere in the app uses a fixed y-axis range so days are visually comparable, **When** the welcome page's today chart renders, **Then** it uses that same fixed y-axis range and scale, not one that rescales to today's own data.
3. **Given** today has no generation data yet (e.g. very early morning, or the device hasn't reported), **When** the welcome page loads, **Then** the chart area shows an empty/neutral state rather than an error.

---

### Edge Cases

- What happens if `base_vars.js` fails to load or is malformed? → The plant-details panel shows a neutral empty/error state; the carousel and today's chart still attempt to render independently.
- What happens if today's generation data fails to load? → The chart panel shows a neutral empty state; the carousel and plant-details panel still render independently.
- What happens if the visitor arrives via a deep link to a specific day/month/year/total view? → That specific view is shown as today; the welcome page only replaces the _default_ (empty/unrecognized hash) case, not explicit routes.
- What happens if the plant has only one inverter, or many? → The plant-details panel lists whatever inverters `base_vars.js` reports (see `parseBaseVars`), without assuming a fixed count.
- What happens on a very narrow (mobile) viewport? → The 2/3 + 1/3 split collapses to a single stacked column (see Acceptance Scenario 4 of User Story 1) rather than compressing side-by-side panels into unreadable widths.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST show the welcome page when the base URL is opened with an empty or unrecognized route, replacing today's day-view as the default fallback.
- **FR-002**: The welcome page MUST NOT be shown for any explicit, valid route (day/month/year/total) — those continue to show their existing views unchanged.
- **FR-003**: The welcome page MUST present a two-region layout: a primary region (image carousel + plant details) and a secondary region (today's generation chart).
- **FR-004**: On wide viewports, the primary region MUST occupy roughly two-thirds of the layout width and the secondary region roughly one-third, arranged side by side.
- **FR-005**: On narrow viewports, the two regions MUST stack into a single readable column instead of compressing side by side.
- **FR-006**: The primary region MUST display an image carousel of plant photos above the plant-details panel.
- **FR-007**: Plant photos MUST be sourced from a dedicated, version-controlled image location that the plant operator can add files to directly (no in-app upload feature).
- **FR-008**: When zero plant photos are present, the carousel area MUST show a neutral placeholder rather than a broken or empty layout.
- **FR-009**: When exactly one plant photo is present, the carousel MUST display it without non-functional multi-image navigation controls.
- **FR-010**: When two or more plant photos are present, the visitor MUST be able to view more than one of them (via automatic rotation, manual controls, or both).
- **FR-011**: The plant-details panel MUST show, sourced from `base_vars.js`: plant title, location, operator, installed capacity (kWp), and commissioning date.
- **FR-012**: The plant-details panel MUST also list per-inverter details (model and string count) for every inverter reported in `base_vars.js`, without assuming a fixed inverter count.
- **FR-013**: If `base_vars.js` fails to load or parse, the plant-details panel MUST show a neutral empty/error state without blocking the rest of the welcome page.
- **FR-014**: The secondary region MUST show a line chart of today's total generation (combined across all inverters) — a single series only.
- **FR-015**: The secondary region's chart MUST NOT show per-inverter (WR1/WR2) series, efficiency series, or UDC (DC voltage) series.
- **FR-016**: The secondary region's chart MUST use the same fixed y-axis range and step used by the existing day chart's ("Tagesertrag") total feed-in axis, so today's chart is visually comparable to any other day's chart in the app.
- **FR-017**: If today's generation data is unavailable or empty, the secondary region MUST show a neutral empty state rather than an error.
- **FR-018**: The welcome page MUST NOT duplicate the current-production/today's-yield summary already shown in the app header — it shows the generation _curve_, not another running total.
- **FR-019**: The welcome page MUST NOT include any other chart types (month/year/total, breakdown, data table) already reachable elsewhere in the app.

### Key Entities

- **Plant Photo**: An image representing the solar power plant (e.g. array, roof, site overview). Attributes: file location, display order. Zero, one, or many may exist at a given time.
- **Plant Details**: The subset of `base_vars.js` fields shown to visitors — title, location, operator, capacity, commissioning date, and the list of inverters (each with model and string count). Already parsed by the existing `parseBaseVars` logic.
- **Today's Generation Series**: The combined (all-inverter) feed-in values for the current day, the same total series already plotted (among others) by the existing day chart.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time visitor to the base URL can identify the plant's name, location, and today's generation trend without clicking anything, in under 5 seconds of page load.
- **SC-002**: 100% of explicit day/month/year/total deep links continue to show their intended view, unaffected by the new default.
- **SC-003**: The welcome page remains fully readable (no overlapping or cut-off content) across desktop and mobile viewport widths.
- **SC-004**: When any one data source (plant photos, `base_vars.js`, or today's generation data) is unavailable, the other two regions still render successfully — no single missing source blanks the whole page.

## Assumptions

- The "images from the solar power plant" are static photo files the plant operator maintains directly in the repository/deployment (a new dedicated folder), not a device-synced camera feed and not an in-app upload flow.
- "The values from base_vars.js" means the plant's core identity/capacity fields plus its inverter list — the same fields the existing `parseBaseVars` parser already extracts — not the full raw file (status/error code tables, firmware metadata, etc. are excluded as not visitor-relevant).
- "Today's generation" reuses the existing day chart's total feed-in series and fixed y-axis definition, so the two stay visually consistent without introducing a second, differently-scaled axis definition.
- The welcome page fully replaces the current default-route behavior (today's day view for empty/unrecognized hashes); the day view remains reachable via explicit navigation/links as it is today.
- No new interactive features (e.g. photo upload, photo captions/metadata editing) are in scope — the carousel only displays whatever images are present.
