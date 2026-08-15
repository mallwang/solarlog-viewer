# Feature Specification: Website Modernization

**Feature Branch**: `001-website-modernization`

**Created**: 2026-07-29

**Status**: Done

**Input**: User description: "I would like to create a modernization plan of the whole website. Its a statically hosted site, therefore no backend or database is required. In the constitution there are some ideas."

## Constitution Check

This feature is governed by the Photovoltaikanlage Allwang Modernization Constitution v1.0.0.

| Principle                                 | Applicability | How Satisfied                                                          |
| ----------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | ✅ Core       | All `.js` data files remain untouched; new frontend fetches them as-is |
| II. Zero Historical Data Loss             | ✅ Core       | All 5 visualization modes preserved; 20 years of data accessible       |
| III. No Backend Introduction              | ✅ Core       | 100% client-side; deployable to any static file host                   |
| IV. Responsive-First Layout               | ✅ Core       | Mobile-first layout from 320 px to 2560 px; frameset removed           |
| V. Modern Charting                        | ✅ Core       | Established charting library replaces custom pixel-math engine         |
| VI. Preserve All Five Visualization Modes | ✅ Core       | All 5 modes implemented with equivalent or better fidelity             |

## User Scenarios & Testing _(mandatory)_

### User Story 1 — View Today's Solar Production on Mobile (Priority: P1)

A family member pulls up the site on a smartphone to check how much the array is producing right now and how the day's power curve looks.

**Why this priority**: The current frameset layout is unusable on mobile. This is the single most impactful gap — people want to check the plant on their phones. A mobile-readable daily trace is the minimum viable modernized product.

**Independent Test**: Load the site on a 375 px-wide phone browser, navigate to today's daily 5-minute power trace, and confirm the chart is legible and not clipped.

**Acceptance Scenarios**:

1. **Given** a phone with a 375 px viewport, **When** the user opens the site, **Then** the page renders without horizontal scrolling and the navigation is accessible.
2. **Given** today's daily trace view, **When** the chart loads, **Then** power values per inverter and per string are visible as a line/area chart over a 24-hour x-axis.
3. **Given** the chart is displayed, **When** the user taps a data point, **Then** a tooltip shows the timestamp and power value in watts.
4. **Given** the data file for today is not yet available (plant offline), **When** the page loads, **Then** the user sees a clear "No data available for today" message rather than a broken chart.

---

### User Story 2 — Browse Historical Monthly and Yearly Totals (Priority: P2)

The plant owner wants to review energy production by month or year to compare performance across seasons and years, including data going back to 2006.

**Why this priority**: Historical analysis is the primary value of having 20 years of logged data. This directly supports financial record-keeping for the EEG feed-in tariff.

**Independent Test**: Navigate to the monthly bar chart, select a month from 2008, and confirm the per-inverter bar chart renders with correct kWh values.

**Acceptance Scenarios**:

1. **Given** the monthly chart view, **When** the user selects any month from 2006-03 to the present, **Then** a bar chart shows daily energy totals per inverter for that month.
2. **Given** the yearly bar chart view, **When** the user opens it, **Then** all available years (2006–present) are shown as bars with total kWh, without any years being silently dropped.
3. **Given** a year with incomplete data (e.g., first month of operation March 2006), **When** the chart renders, **Then** only the available days/months are shown; missing data is not shown as zero unless the data file explicitly records zero.
4. **Given** the all-years cumulative view, **When** the user loads it, **Then** lifetime total production and CO₂ savings are visible alongside the bars.

---

### User Story 3 — Year-over-Year Daily Comparison (Priority: P2)

The plant owner wants to overlay multiple years' daily production curves to identify patterns, degradation, or unusually good/bad periods.

**Why this priority**: This is the most analytically unique view (Mode 4). It is not available in generic monitoring tools and is a differentiator of this custom viewer.

**Independent Test**: Open the all-years line comparison, confirm that at least 3 different years render as distinct lines on a single day-of-year x-axis.

**Acceptance Scenarios**:

1. **Given** the all-years daily line comparison view, **When** it loads, **Then** each available year appears as a distinct colored line over a 365-day x-axis.
2. **Given** multiple years are displayed, **When** the user hovers or taps a point, **Then** a tooltip shows the year, day, and kWh value for that point.
3. **Given** a leap year in the dataset, **When** the comparison renders, **Then** February 29 data is included without distorting the alignment of other years.

---

### User Story 4 — Live Current Production Widget (Priority: P3)

The plant owner wants a live indicator of current power output, refreshing automatically, to confirm the system is producing during daylight hours.

**Why this priority**: The `min_cur.js` file is pushed every 5 minutes by the SolarLog device and already contains live data; surfacing it requires minimal new work and adds real-time value.

**Independent Test**: Open the site during daylight hours and confirm a "current output" value is shown and updates after 5 minutes without a page reload.

**Acceptance Scenarios**:

1. **Given** the page is open during daylight, **When** `min_cur.js` is fetched, **Then** the current power output in watts is displayed prominently.
2. **Given** the widget is visible, **When** 5 minutes pass, **Then** the value refreshes automatically by re-fetching `min_cur.js`.
3. **Given** the plant is not producing (night or fault), **When** `min_cur.js` reports 0 W, **Then** the widget shows "0 W — not producing" rather than a blank or error state.

---

### User Story 5 — Multi-Language Support (Priority: P3)

A German-speaking user and an English-speaking user both visit the site and each sees labels, navigation, and chart axes in their preferred language.

**Why this priority**: The existing site already ships DE/EN/FR/ES/IT/NL language files. Preserving at least DE and EN requires no new translations, only wiring the existing strings into the new UI.

**Independent Test**: Switch the site language to English, reload, and confirm all navigation labels, chart axis labels, and the summary table are in English.

**Acceptance Scenarios**:

1. **Given** the site is opened, **When** no language preference is set, **Then** the site defaults to German (DE) as the primary locale.
2. **Given** the user selects English, **When** the page refreshes or re-renders, **Then** all visible text is sourced from `lang_EN.js` strings.
3. **Given** a language is selected, **When** the user returns to the site later, **Then** the selected language persists (stored in browser local storage or a URL parameter).

---

### Edge Cases

- What happens when a daily minute file for a requested date does not exist on the server? → Show a "Data not available" placeholder; do not crash.
- What happens if `base_vars.js` changes (e.g., a new inverter is added)? → The UI must derive inverter count and string count from `base_vars.js` dynamically, not from hard-coded values.
- What happens when the viewport is between 320 px and 768 px? → Charts must reflow to single-column layout; navigation collapses to a hamburger/accordion.
- What happens if the browser has no JavaScript? → A static message indicates the site requires JavaScript; no broken layout appears.
- What happens when fetching a data file times out or returns a non-200 status? → The affected chart shows an error state; other charts on the page remain functional.

## Requirements _(mandatory)_

### Functional Requirements

**Navigation & Layout**

- **FR-001**: The site MUST render without horizontal scrolling at all viewport widths from 320 px to 2560 px.
- **FR-002**: The frameset-based layout MUST be replaced with standard HTML5 page structure.
- **FR-003**: Navigation MUST be accessible on mobile without requiring zoom or horizontal scroll.
- **FR-004**: The site MUST be deployable to any plain static file host with no server-side runtime.

**Data Loading**

- **FR-005**: All data files (`base_vars.js`, `min_cur.js`, `min{YYMMDD}.js`, `days.js`, `months.js`, `years.js`, `days_hist*.js`, `daysall.js`) MUST be fetched client-side, exactly as produced by the SolarLog device, without modification.
- **FR-006**: The UI MUST derive inverter count, string count, and plant metadata dynamically from `base_vars.js` on every load.
- **FR-007**: Data loading MUST use asynchronous fetch; `document.write()` script chaining MUST be eliminated.
- **FR-008**: All pages MUST use UTF-8 character encoding.

**Visualization**

- **FR-009**: Mode 0 (daily 5-minute power trace) MUST display per-inverter, per-string data as a time-series chart for any selectable date.
- **FR-010**: Mode 1 (monthly energy bar chart) MUST display per-inverter daily energy totals for any selectable month from 2006-03 to the present.
- **FR-011**: Mode 2 (yearly energy bar chart) MUST display all available years with annual totals.
- **FR-012**: Mode 3 (all-years cumulative bar) MUST display lifetime totals and include CO₂ savings and feed-in tariff (Verguetung) summary.
- **FR-013**: Mode 4 (all-years daily line comparison) MUST overlay all available years on a shared day-of-year axis.
- **FR-014**: All charts MUST be implemented using an established, maintained charting library; custom pixel-positioning chart engines MUST NOT be used.
- **FR-015**: Charts MUST be responsive and reflow correctly when the viewport is resized.

**Live Widget**

- **FR-016**: A current-production widget MUST fetch `min_cur.js` on page load and refresh it automatically every 5 minutes.

**Internationalization**

- **FR-017**: The site MUST support at minimum German (DE) and English (EN) language modes, driven by the existing `lang_DE.js` and `lang_EN.js` files.
- **FR-018**: The selected language MUST persist across page navigations within the same browsing session.

**Error Handling**

- **FR-019**: When a requested data file is unavailable, the affected chart MUST display a clear error/empty state without crashing the page.

### Key Entities

- **Plant**: Represented by `base_vars.js`. Attributes: name, operator, installed capacity (kWp), inverter count, tariff rate. Single instance, loaded on startup.
- **Inverter (WR)**: Defined within `base_vars.js` (`WRInfo[]`). Attributes: index, model, string count. Variable count; currently 2.
- **String**: A sub-unit of an inverter. Current plant has WR1 with 2 strings and WR2 with 1 string.
- **Daily Minute File**: `min{YYMMDD}.js` — one file per calendar day, containing 5-minute power readings per string.
- **Aggregated Data Files**: `days.js`, `months.js`, `years.js`, `daysall.js`, `days_hist*.js` — pre-aggregated by the SolarLog device for month/year/lifetime views.
- **Live Data File**: `min_cur.js` — current 5-minute snapshot; refreshed by device every 5 minutes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The site renders correctly and is fully functional on a 375 px-wide smartphone browser without horizontal scrolling.
- **SC-002**: All five visualization modes load and display data for any date/month/year in the 2006–present range, including the first available data point (2006-03-15).
- **SC-003**: A user can navigate from the landing page to any chart view in 2 interactions or fewer.
- **SC-004**: Charts render within 3 seconds on a standard broadband connection for any date, including days with the maximum 288 5-minute data points.
- **SC-005**: The live current-production widget displays a refreshed value within 5 minutes of a new `min_cur.js` push from the SolarLog device.
- **SC-006**: Switching between German and English language modes completes without a full page reload (or with a reload that restores the current view state).
- **SC-007**: All 20+ years of historical data (2006–present) remain accessible without any records being silently omitted or misrendered.
- **SC-008**: The CO₂ savings and feed-in tariff summary values match the values calculated by the original site for the same dataset.

## Assumptions

- The SolarLog 500 device will continue pushing `.js` files to the same directory structure; no changes to the push mechanism or file format are anticipated.
- The two existing inverters (WR1: SB 4200 TL with 2 strings; WR2: SB 2100 TL with 1 string) represent the current plant configuration; `base_vars.js` is the authoritative source and must be re-read on each load.
- The hosting environment supports plain static file serving; no `.htaccess` rewrite rules, server-side includes, or build pipelines are available or required.
- The existing `lang_DE.js`, `lang_EN.js`, and other language files contain all strings needed for the UI; no new translations will be added in this modernization effort.
- Users are expected to have a modern browser (Chrome, Firefox, Safari, Edge — last 2 major versions); IE11 support is not required.
- The CO₂ conversion factor and feed-in tariff calculation method used in the original `functions.js` are correct and should be preserved as-is.
- No authentication or access control is required; the site is publicly accessible.
- The optional multi-language support (FR, ES, IT, NL) is preserved structurally but only DE and EN are actively tested as part of this modernization.
