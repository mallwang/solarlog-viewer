# Feature Specification: Statistics Page

**Feature Branch**: `022-statistics-page`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "New 'Statistics' page for the SolarLog viewer: split-view layout with a left-nav of topics and stats/diagrams on the right for the selected topic. Topics: a 'Common' page surfacing best/worst overall month & year, max daily power, max Ist %, max daily CO2 saving, max daily € earned (each linking to its source view); full-year calendar heatmaps for generated energy, earned money, and CO2 saving per day; streaks (longest consecutive-day run above a threshold); trends (year-over-year cumulative comparison, cumulative lifetime € and CO2 savings, and a specific-yield degradation trend); and a best-vs-worst paired comparison view. All stats must be derived from existing per-day/month/year aggregate files already fetched today — never by iterating per-day minute files across a multi-day range."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Common overview (Priority: P1)

A plant owner opens the Statistics page and immediately sees a "Common" overview: the best and worst overall month, the best and worst overall year, the highest single-day power output, the highest "Ist %" (actual vs. target yield) day, the highest single-day CO2 saving, and the highest single-day € earned. Each of these figures links directly to the underlying day/month/year view so the owner can inspect the record in context.

**Why this priority**: This is the page's entry point and the user's original starting idea — it delivers immediate value (a single place to see "the best of everything") even if no other topic is ever built, and it's mostly surfacing data the app already computes elsewhere.

**Independent Test**: Can be fully tested by navigating to the Statistics page's default/first topic and verifying each stat tile shows a correct value and links to the correct source view (e.g., best month links to that month's `#/month/YYYY/MM` view).

**Acceptance Scenarios**:

1. **Given** the plant has multiple years of history, **When** the user opens the Statistics page, **Then** the "Common" topic is shown with best/worst month, best/worst year, max daily power, max Ist %, max daily CO2 saving, and max daily € earned, each populated with a value and the date/period it occurred.
2. **Given** the "Common" topic is displayed, **When** the user selects the best-month stat, **Then** the app navigates to that month's existing month view.
3. **Given** the plant's recorded history includes the device-swap boundary (2026-07-29), **When** stats spanning that boundary are computed, **Then** values reflect the already-merged daily/monthly/yearly totals (no double-counting or gaps at the boundary).

---

### User Story 2 - Calendar heatmaps (Priority: P2)

A plant owner selects the "Heatmaps" topic and picks a year to see three full-year calendar heatmaps — one each for daily generated energy (kWh), daily money earned (€), and daily CO2 saved (kg) — giving an at-a-glance view of seasonal and day-to-day patterns across the whole year.

**Why this priority**: Delivers the visually distinctive, high-value feature from the user's original idea, independent of the other topics; it's a self-contained view once a year of daily aggregate data is available.

**Independent Test**: Can be fully tested by selecting the "Heatmaps" topic, picking a year with recorded data, and verifying each of the three heatmaps renders one cell per calendar day with a value-appropriate color, and that switching years re-renders all three heatmaps for the new year.

**Acceptance Scenarios**:

1. **Given** the "Heatmaps" topic is open, **When** the user picks a year that has recorded data, **Then** three calendar heatmaps (energy, money, CO2) render, one cell per day of that year.
2. **Given** a day within the selected year has no recorded data (e.g., before commissioning, or a data gap), **When** the heatmap renders that day's cell, **Then** the cell is visually distinguishable from a day with a real (including zero) recorded value.
3. **Given** the user changes the year selector, **When** the new year is applied, **Then** all three heatmaps update to reflect the newly selected year.

---

### User Story 3 - Streaks and trends (Priority: P3)

A plant owner selects the "Streaks" or "Trends" topic to see longer-horizon patterns: the longest run of consecutive days generating above a threshold, how this year's cumulative yield compares to prior years at the same point in the year, running lifetime totals of money earned and CO2 saved, and a year-by-year specific-yield trend that gives a rough sense of panel output over time.

**Why this priority**: These are narrative/analytical additions on top of the core "Common" and "Heatmaps" topics — valuable but not required for the page to deliver its primary purpose, so they can ship after P1/P2.

**Independent Test**: Can be fully tested by selecting "Streaks" and verifying the longest-streak stat and its date range, then selecting "Trends" and verifying the year-over-year comparison chart, the cumulative lifetime savings chart, and the degradation trend chart each render with plausible values against known history.

**Acceptance Scenarios**:

1. **Given** the "Streaks" topic is open, **When** the streak stat is computed, **Then** it shows the longest consecutive-day run above the configured threshold, along with the start and end dates of that run.
2. **Given** the "Trends" topic is open, **When** the year-over-year comparison renders, **Then** it shows cumulative yield for the current year overlaid against prior years, aligned by day-of-year.
3. **Given** the "Trends" topic is open, **When** the cumulative lifetime savings chart renders, **Then** it shows running totals of € earned and CO2 saved from commissioning to the most recent recorded day.
4. **Given** the "Trends" topic is open, **When** the degradation trend renders, **Then** it shows specific yield (kWh/kWp) per year across the full recorded history, with an in-UI note that the trend assumes constant installed capacity and is not weather-normalized.

---

### User Story 4 - Best vs. worst comparison (Priority: P4)

A plant owner selects the "Best vs. Worst" topic to see each "best" stat already surfaced on the "Common" topic paired directly against its "worst" counterpart, making the spread between the plant's best and worst outcomes easy to compare at a glance.

**Why this priority**: A refinement/reframing of data already present on the "Common" topic — nice-to-have polish rather than new information, so it's the lowest-priority topic to ship.

**Independent Test**: Can be fully tested by selecting the "Best vs. Worst" topic and verifying each paired stat (e.g., best month vs. worst month) displays both values side by side with correct source-view links for each.

**Acceptance Scenarios**:

1. **Given** the "Best vs. Worst" topic is open, **When** it renders, **Then** every stat that has both a best and a worst counterpart (month, year, day yield, etc.) is shown as a paired comparison rather than a single value.
2. **Given** a paired comparison is shown, **When** the user selects either the "best" or "worst" side, **Then** the app navigates to that specific period's source view.

---

### Edge Cases

- What happens when a topic's underlying stat has no qualifying data yet (e.g., a brand-new install with under a year of history, so no full-year heatmap or year-over-year comparison is possible)? The topic MUST show a clear "not enough data yet" state rather than an empty or broken chart.
- How does the "max daily power" stat behave given it is value-only (day it occurred, no time-of-day) per the data-cost constraint? The UI MUST NOT imply a time-of-day is available (e.g., no misleading "at HH:MM" label).
- How does the streak calculation handle a currently-open streak (still ongoing as of the most recent recorded day)? It MUST be included and clearly marked as ongoing/not-yet-ended if it is or ties the record.
- How do heatmaps and trend charts represent days affected by the 2026-07-29 device-swap boundary? They MUST use the already-merged daily/monthly/yearly totals so the boundary is invisible to the user.
- What happens if the plant's nameplate capacity changed at some point in history without being recorded in the data (see degradation trend caveat)? The system cannot detect this; the UI's caveat text MUST cover this possibility rather than the system attempting to detect or correct for it.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a Statistics page with a topic navigation area and a content area that displays stats/diagrams for the currently selected topic.
- **FR-002**: The system MUST provide a "Common" topic showing: best and worst overall month, best and worst overall year, max single-day power (W), max single-day Ist % (actual vs. target yield), max single-day CO2 saving, and max single-day € earned — each with the value and the period/date it occurred.
- **FR-003**: Every stat on the "Common" topic that corresponds to an existing day/month/year view MUST link to that source view.
- **FR-004**: The system MUST provide a "Heatmaps" topic with a year selector and three calendar heatmaps for the selected year: daily generated energy (kWh), daily money earned (€), and daily CO2 saved (kg).
- **FR-005**: Heatmap cells for days with no recorded data MUST be visually distinguishable from cells with a real recorded value (including a real value of zero).
- **FR-006**: The system MUST provide a "Streaks" topic showing the longest consecutive-day run above a threshold, including its start and end dates.
- **FR-007**: The system MUST provide a "Trends" topic showing: a year-over-year cumulative yield comparison aligned by day-of-year, cumulative lifetime € earned and CO2 saved since commissioning, and a per-year specific-yield (kWh/kWp) trend across the full recorded history.
- **FR-008**: The degradation (specific-yield) trend MUST display an in-UI caveat noting it assumes constant installed capacity and does not account for year-to-year weather variability.
- **FR-009**: The system MUST provide a "Best vs. Worst" topic pairing every "Common"-topic stat that has both a best and worst counterpart, displayed side by side, each side linking to its own source view.
- **FR-010**: All stats and diagrams on the Statistics page MUST be computed only from existing per-day/month/year aggregate data already fetched by the app today (`days.js`, `days_hist*.js`, `daysall.js`, `months.js`, `years.js`) — the page MUST NOT trigger fetches of individual per-day minute files across a multi-day range.
- **FR-011**: The max single-day power stat MUST be presented as a value plus the day it occurred, without implying a specific time-of-day.
- **FR-012**: Any topic whose stat(s) cannot be computed due to insufficient history (e.g., less than a full year of data) MUST show an explicit "not enough data yet" state instead of an empty, zeroed, or broken chart.
- **FR-013**: Stats and charts spanning the 2026-07-29 device-swap boundary MUST use the app's existing merged daily/monthly/yearly totals, producing no double-counted or missing values at the boundary.
- **FR-014**: The Statistics page's topics MUST be reachable as distinct, independently linkable routes (e.g., a URL per topic), consistent with the app's existing hash-routed views, so a specific topic can be bookmarked, shared, or opened directly.
- **FR-015**: The "Heatmaps" topic MUST color each day's cell on a scale relative to that year's own minimum and maximum values (a per-year relative scale), so seasonal variation within the selected year remains visible regardless of how that year compares to other years.
- **FR-016**: "Worst"-framed stats (worst month, worst year, and the "worst" side of any best-vs-worst pairing) MUST be shown by default alongside their "best" counterparts, with no separate toggle required to reveal them.

### Key Entities

- **Stat tile**: A single named statistic (e.g., "Best Month") with a computed value, the date/period it occurred, and an optional link to that period's source view.
- **Topic**: A named section of the Statistics page (Common, Heatmaps, Streaks, Trends, Best vs. Worst) containing one or more stat tiles and/or charts.
- **Calendar heatmap**: A full-year grid of daily cells for one metric (energy, money, or CO2), color-scaled to that year's own range of values, with a distinct visual state for days without recorded data.
- **Streak**: A run of consecutive days each meeting or exceeding a yield threshold, with a start date, end date, and length; may be open-ended if still ongoing.
- **Best/worst pair**: Two stat tiles for the same metric (e.g., "best year" / "worst year") displayed together for comparison.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can find the plant's best-ever month, year, and single-day records within 10 seconds of opening the Statistics page.
- **SC-002**: Every "best" or "worst" figure that has a corresponding detail view is one click away from that view.
- **SC-003**: A full year's worth of daily heatmap data (energy, money, and CO2, all three heatmaps) renders without requiring any additional per-day file fetches beyond what the app already loads for existing aggregate views.
- **SC-004**: Users can switch between all five topics (Common, Heatmaps, Streaks, Trends, Best vs. Worst) without a full page reload, and each topic remains directly reachable via its own link.
- **SC-005**: For a plant with under one year of recorded history, every topic that cannot yet produce a meaningful result (e.g., year-over-year trend, full heatmap) shows a clear "not enough data yet" message rather than a misleading or empty chart.

## Assumptions

- The streak threshold is a fixed constant chosen as a reasonable "meaningful generation day" cutoff for this plant, not user-configurable in this first version; making it configurable is a candidate for a future iteration.
- "Ist %" retains its existing meaning from `yield-stats.js` (actual yield ÷ the SolarLog device's own target/"Soll" yield for the period) — this is a performance-vs-target ratio, not a capacity factor, and the Statistics page reuses that definition unchanged.
- The degradation trend is a raw specific-yield (kWh/kWp) trend using the plant's current nameplate capacity applied uniformly across all years; it is not weather-normalized and cannot detect an undocumented change in installed capacity. This limitation is surfaced to the user as an in-UI caveat (FR-008) rather than solved algorithmically.
- The Statistics page is a new top-level view alongside the existing day/month/year/total views, reachable from the app's main navigation.
- "Not enough data yet" thresholds (e.g., what counts as "a full year" for the heatmap or year-over-year trend) follow the same recorded-history boundaries the app already uses elsewhere (commissioning date, device-swap boundary) rather than a new configurable setting.
