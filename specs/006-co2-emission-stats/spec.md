# Feature Specification: CO2 Emission Avoidance Statistics

**Feature Branch**: `006-co2-emission-stats`

**Created**: 2026-08-09

**Status**: Done

**Input**: User description: "I would like to use a historical factor for the reduced co2 emissions, starting with 2006 up to the upcoming years based on the UBA historical values. The values should be stored locally as reference and not requested for each diagram/view. For future years which does not have a statistics yet, a konstant should be used, e.g. the suggested one from 1. (0,363)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See avoided CO2 in the lifetime/total view (Priority: P1)

As a visitor looking at the plant's all-time statistics, I want to see how much CO2 emission has been avoided by the solar energy produced, so that I can understand the environmental impact of the installation in a way that reflects real-world grid conditions rather than a single outdated estimate.

**Why this priority**: The total/lifetime view is the headline summary visitors care about most; it is also where the legacy site already showed a (now outdated) CO2 figure, so it's the most visible regression risk if omitted.

**Independent Test**: Open the total/lifetime statistics view and confirm a CO2-avoidance figure is displayed, computed from year-specific factors rather than one flat rate.

**Acceptance Scenarios**:

1. **Given** the plant has produced solar energy across multiple years since 2006, **When** the visitor opens the total/lifetime statistics view, **Then** a CO2 avoidance figure is shown that sums each year's yield multiplied by that year's own emission factor.
2. **Given** the underlying yearly emission factors differ between years, **When** the total is computed, **Then** the result differs from (and is more accurate than) simply multiplying the whole lifetime yield by a single flat factor.

---

### User Story 2 - See avoided CO2 broken down by day, month, and year (Priority: P2)

As a visitor drilling down into a specific day, month, or year, I want to see the CO2 avoided for that period, so that I can compare environmental impact across different periods of the plant's operation.

**Why this priority**: Extends the same value to the drill-down views used throughout the dashboard; valuable but secondary to the headline total.

**Independent Test**: Navigate to a day view, a month view, and a year view; confirm each displays a CO2 avoidance figure consistent with the yield shown for that period and the emission factor of the year it falls in.

**Acceptance Scenarios**:

1. **Given** a specific year's statistics view, **When** the visitor opens it, **Then** the displayed CO2 avoidance uses that year's specific emission factor.
2. **Given** a month or day view within a given year, **When** the visitor opens it, **Then** the displayed CO2 avoidance uses the emission factor of the year that month/day belongs to.
3. **Given** the current, still-in-progress year, **When** the visitor views its statistics, **Then** the CO2 avoidance is computed using the fallback constant factor (0.363 kg CO2/kWh) because no finalized historical factor exists yet for that year.

---

### User Story 3 - Maintain the emission factor reference data over time (Priority: P3)

As the site maintainer, I want the yearly CO2 emission factors to live in one local, easily updatable place, so that I can add next year's published UBA value each year without touching calculation logic or making the site depend on an external service at view time.

**Why this priority**: Ensures the feature stays accurate and low-maintenance long-term, but the site functions correctly even before this workflow is exercised for the first time.

**Independent Test**: Add or edit a yearly factor entry in the local reference data and confirm all views immediately reflect the change on next load, with no other code changes required.

**Acceptance Scenarios**:

1. **Given** a new calendar year completes and UBA publishes its finalized emission factor, **When** the maintainer adds that year's value to the local reference data, **Then** all statistics views for that year switch from the fallback constant to the newly added specific factor without further code changes.
2. **Given** the reference data is stored locally, **When** any statistics view is loaded, **Then** no network request is made to fetch emission factor data.

### Edge Cases

- What happens for years before 2006 (before the reference data series begins) if such data were ever encountered? The system falls back to the constant factor (0.363 kg CO2/kWh), the same behavior used for years newer than the last published value.
- What happens for the current, in-progress calendar year, which has yield data but no finalized published emission factor yet? The fallback constant factor is used until that year's specific value is added to the reference data.
- What happens when a period's yield spans a year boundary (e.g., a day view for December 31st contributing to the next year's partial total, matching existing legacy behavior)? Each portion of yield is matched to the emission factor of the calendar year it actually occurred in.
- How does the display handle very small vs. very large avoided-CO2 amounts? Existing unit-scaling behavior is preserved: figures below 10,000 kg are shown in kilograms, larger figures are shown in tonnes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an estimated amount of CO2 emissions avoided by solar energy production in every statistics view that currently shows energy yield (day, month, year, and total/lifetime).
- **FR-002**: System MUST calculate avoided CO2 for a given period by multiplying the energy yield (kWh) attributable to each calendar year within that period by that year's specific CO2 emission factor (kg CO2 per kWh), then summing the results.
- **FR-003**: System MUST maintain a local, static reference table of yearly CO2 emission factors covering each calendar year from 2006 onward, populated from published Umweltbundesamt (UBA) values for the German electricity grid mix.
- **FR-004**: System MUST read the yearly emission factors from local reference data only; loading or rendering any statistics view MUST NOT trigger a network request to fetch emission factor data.
- **FR-005**: System MUST apply a fallback constant emission factor of 0.363 kg CO2 per kWh for any calendar year that has no entry in the local reference table (e.g., the current year before its factor is published, or any future year).
- **FR-006**: System MUST allow the local reference data to be extended with a new year's factor (once published) as a self-contained data change, without requiring changes to the calculation logic in any view.
- **FR-007**: Displayed CO2 avoidance figures MUST use the same unit-scaling convention as the legacy site: values under 10,000 kg are shown in kilograms, values at or above that threshold are shown in tonnes.
- **FR-008**: System MUST compute multi-year totals (e.g., the lifetime/total view) by applying each year's own specific factor to that year's yield individually rather than applying one single factor to the combined multi-year yield.

### Key Entities

- **Yearly CO2 Emission Factor**: Represents the CO2 emitted per kWh of the German electricity grid mix for a specific calendar year (kg CO2/kWh). Attributes: calendar year, factor value, and whether the value is a published historical figure or the fallback constant.
- **Energy Yield Period**: The existing solar energy yield data for a given day, month, year, or the full plant lifetime (kWh), already available in the current statistics data. Each yield amount is associated with the calendar year(s) it was produced in.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every statistics view (day, month, year, and total/lifetime) displays a CO2 avoidance figure alongside the existing energy yield figures.
- **SC-002**: For any historical year 2006 or later with a published factor, the displayed CO2 avoidance for that year matches manual calculation using that year's official published factor and yield, within normal rounding.
- **SC-003**: Loading any statistics view produces zero network requests related to emission factor lookup, and the emission-factor calculation adds no perceptible delay to page rendering.
- **SC-004**: Adding a newly published year's emission factor to the local reference data is a single, isolated data edit that immediately takes effect across all views without any other code change.
- **SC-005**: The total/lifetime CO2 avoidance figure, when independently recomputed by summing each year's yield times that year's own factor, matches the displayed figure exactly (not merely the flat-rate legacy approximation).

## Assumptions

- The local reference table will initially be populated with UBA's published yearly specific CO2 emission factors for the German electricity grid mix (average mix, consistent with the legacy site's approach) for each year from 2006 through the most recently finalized year; sourcing and entering that full historical series is treated as part of implementing this feature.
- "No statistics yet" years (current year and any future year) use the fallback constant of 0.363 kg CO2/kWh, as explicitly specified by the feature request; this constant will be revisited whenever the maintainer adds a finalized factor for that year.
- The plant's data series is assumed to begin in 2006; any yield data theoretically predating 2006 (none is expected to exist) would also use the fallback constant.
- Only whole-calendar-year granularity is required for emission factors; no monthly or daily variation within a year is needed.
- The reference data will need periodic manual maintenance (roughly once a year, when UBA publishes its updated figure), which is acceptable given the low frequency of updates.
