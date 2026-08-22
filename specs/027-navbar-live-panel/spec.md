# Feature Specification: Live Navbar Watt Reading

**Feature Branch**: `027-navbar-live-panel`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "I would like to change the navbar live panel with the real live data, which we now get from \"https://wolfsbach.synology.me/live/index.php\" in the following format: `{\"watt\":600,\"timestamp\":\"2026-08-22T09:21:05\",\"sources\":{\"solarlog\":{\"watt\":600,\"ok\":true,\"error\":null,\"inverters\":[{\"index\":0,\"ac_w\":430,\"dc_w\":[678,677],\"status\":7,\"error\":0},{\"index\":1,\"ac_w\":170,\"dc_w\":[186],\"status\":7,\"error\":0}]}}}`. It should be refreshed every minute (should be configurable in the config.js), and being decoupled from the existing 10-minute refresh cycle for the daily data (which is used in the diagrams)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See true current production at a glance (Priority: P1)

A visitor looks at the navbar's live panel and expects the wattage shown to reflect what the plant is producing right now, not a reading that can lag behind reality by up to ten minutes.

**Why this priority**: This is the entire point of the feature — the navbar figure is currently derived from the same 10-minute data file used for the diagrams, so it can be stale exactly when the user most wants an up-to-date number (e.g. watching output change as clouds pass). Sourcing it from the dedicated live endpoint and refreshing it independently is the core value.

**Independent Test**: Load any page with the navbar visible, and separately poll the live endpoint. Confirm the displayed wattage matches the endpoint's `watt` value and updates to match a new endpoint value within one refresh cycle, without requiring any diagram or other data-panel figure to also update.

**Acceptance Scenarios**:

1. **Given** the live endpoint currently reports `watt: 600`, **When** the navbar live panel loads or refreshes, **Then** it displays a value derived from 600 W (formatted per existing conventions).
2. **Given** the navbar panel is showing a previously-fetched wattage, **When** the configured live refresh interval elapses and the endpoint now reports a different `watt` value, **Then** the panel updates to the new value without a full page reload.
3. **Given** the diagrams and other data panels operate on their own 10-minute refresh cycle, **When** the live refresh interval elapses independently of that cycle, **Then** only the navbar live panel updates — the diagrams/data panels are unaffected until their own cycle fires.

---

### User Story 2 - Live panel degrades gracefully when the endpoint is unavailable or reports a fault (Priority: P2)

A visitor should not be shown a misleading or broken figure if the live endpoint cannot be reached, returns malformed data, or reports that its underlying source is unhealthy.

**Why this priority**: Live external calls fail (network hiccups, device offline, upstream errors). Without a defined fallback, a broken fetch could leave a blank panel, a stuck stale number with no indication, or a JS error that breaks navigation. This matters less than the happy path but is necessary for a trustworthy always-on panel.

**Independent Test**: Simulate the endpoint being unreachable (or returning `ok:false`/an error) and confirm the panel shows its defined fallback state rather than crashing or silently freezing on an old value with no signal.

**Acceptance Scenarios**:

1. **Given** the live endpoint request fails (network error, non-2xx response, or unparseable JSON), **When** a scheduled refresh runs, **Then** the panel keeps showing the last successfully fetched wattage and its "as of" indicator continues to reflect the last successful fetch's time, without a page-level error.
2. **Given** the live endpoint responds successfully but the top-level `watt`/`timestamp` are absent or the `solarlog` source reports `ok:false`, **When** the panel processes that response, **Then** it treats the reading as unavailable and shows the same last-known-good fallback behavior as scenario 1, and continues retrying on the next scheduled interval.
3. **Given** no successful fetch has ever occurred yet (e.g. first load fails), **When** the panel has no last-known-good value to fall back to, **Then** it shows a neutral "no data" state distinct from a real zero-watt reading.

---

### User Story 3 - Operator can tune the live refresh cadence (Priority: P3)

An operator maintaining the site wants to adjust how frequently the navbar polls the live endpoint (e.g. to reduce load on the upstream device, or to make the panel feel snappier) without touching panel logic.

**Why this priority**: Explicitly requested and low-risk/high-value for maintainability, but the feature delivers its core value (Story 1) even with a fixed default cadence — this is a refinement of how that cadence is set.

**Independent Test**: Change the configured live-refresh interval value, reload the site, and confirm the panel's actual polling cadence follows the new value.

**Acceptance Scenarios**:

1. **Given** the site configuration defines a live-refresh interval, **When** an operator changes that value and redeploys/reloads, **Then** the navbar panel polls the live endpoint at the new interval instead of the previous one.
2. **Given** the live-refresh interval is left at its default, **When** the site loads, **Then** the panel polls once per minute as specified.

---

### Edge Cases

- What happens when the live endpoint returns a `watt` value of `0`? It must render as a genuine zero reading (e.g. nighttime), not be confused with the "no data" fallback state from User Story 2.
- What happens when the device clock in `timestamp` drifts from, or lags behind, the browser's clock? The "as of" display should be based on the reading's own timestamp rather than assumed to equal fetch time, so a stale reading is still identifiable as stale.
- What happens if a refresh request is still in flight when the next scheduled interval fires (e.g. the endpoint is slow to respond)? The panel must not stack up overlapping requests or show results out of order.
- What happens when the browser tab is backgrounded/inactive for a long period and then refocused? On return, the panel should refresh promptly rather than showing an indefinitely stale value.
- What happens per-inverter (`sources.solarlog.inverters[]`, individual `status`/`error` codes)? Out of scope for the navbar panel itself, which only surfaces the aggregate `watt`; per-inverter detail is not required to be exposed in this feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The navbar live panel MUST display a wattage value sourced from the live status endpoint's top-level `watt` field, rather than the daily/diagram data source it currently reads.
- **FR-002**: The system MUST poll the live status endpoint on its own recurring schedule, independent of the existing 10-minute diagram/daily-data refresh cycle — polling one MUST NOT trigger or block a refresh of the other.
- **FR-003**: The live-poll interval MUST be defined as a dedicated, named configuration constant, distinct from the existing diagram-data refresh interval, and MUST default to 1 minute (60,000 ms) when unset.
- **FR-004**: The system MUST treat a response as a successful reading only when the endpoint is reachable, returns parseable JSON containing a numeric top-level `watt`, and the `sources.solarlog.ok` flag (or equivalent per-source health flag if multiple sources exist) is true; any other case (network failure, malformed JSON, missing `watt`, `ok:false`) MUST be treated as a failed reading.
- **FR-005**: On a failed reading, the panel MUST continue displaying the most recent successful reading rather than clearing itself or crashing, and MUST retry on the next scheduled interval.
- **FR-006**: When no successful reading has ever been obtained, the panel MUST display a distinct "no data yet" state rather than a zero or blank value that could be mistaken for a real reading.
- **FR-007**: The panel's "as of" / last-updated indicator MUST reflect the `timestamp` field of the most recent successful reading, not the time the browser happened to fetch it.
- **FR-008**: The system MUST NOT allow overlapping live-endpoint requests to race — if a scheduled poll fires while a previous one is still pending, the system MUST ensure only the most recently completed valid response is reflected in the displayed value.
- **FR-009**: The system MUST refresh the live reading promptly when the browser tab regains visibility/focus after being backgrounded, rather than waiting for the next full interval to elapse.
- **FR-010**: The wattage display MUST use the same number formatting/units convention as the panel currently uses (e.g. W/kW thresholds), so the visual change is limited to data freshness and source, not presentation style.
- **FR-011**: A wattage of exactly `0` from a successful reading MUST be displayed as a genuine zero-production reading, visually distinguishable from the "no data yet" state of FR-006.

### Key Entities

- **Live Reading**: A single point-in-time snapshot fetched from the live status endpoint — carries the aggregate wattage, the reading's own timestamp, and a health indicator for whether the underlying source(s) reported success. Used only to drive the navbar panel; not persisted or used by the diagrams.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The navbar's displayed wattage reflects a reading no more than one configured live-refresh interval old (1 minute by default) under normal network conditions, compared to up to 10 minutes previously.
- **SC-002**: Diagram and daily-data views continue refreshing on their existing 10-minute cycle with zero observable change in their behavior or timing after this feature ships.
- **SC-003**: When the live endpoint is temporarily unreachable, the navbar panel shows a clearly stale-but-present value or an explicit no-data state 100% of the time, with zero occurrences of a page error or indefinitely frozen "loading" indicator.
- **SC-004**: An operator can change the live-refresh cadence by editing a single configuration value, with no other code changes required.

## Assumptions

- The live status endpoint (`https://wolfsbach.synology.me/live/index.php`) is reachable from the browser under the same network/proxy conditions as the existing daily-data endpoints, and requires no new authentication.
- Only the top-level `watt`, `timestamp`, and `sources.solarlog.ok` fields are needed for this feature; the per-inverter breakdown (`inverters[]`) is out of scope for display, per the Edge Cases note.
- The endpoint's `timestamp` is in the same local time zone / format basis already used elsewhere in the app for reading ages ("Stand: HH:MM"-style display), so no additional time zone conversion logic is needed beyond what existing similar displays do.
- "Decoupled" means the two refresh cycles run as independent timers with independent failure handling — it does not require the live endpoint to replace or feed the 10-minute diagram data pipeline in any way.
- Default live-refresh interval of 1 minute matches the user's explicit instruction; the existing 10-minute `DATA_REFRESH_INTERVAL_MS` diagram cycle is left untouched.
