# Design: Configurable Weather Backgrounds

**Status**: Approved (2026-08-14)
**Mockup**: https://claude.ai/code/artifact/eba2b5f6-d524-43b0-9f19-4a414c9a7238 (non-functional review artifact — static states only, no live data or real animation timing; may not stay live indefinitely, this file is the durable record)

## Approved layout

The feature has no new screen or region — it modifies the existing `.sky-clouds` backdrop
(`web/index.html`/`app.css`/`sky-controller.js`) in place. The mockup therefore reused the
existing app-header chrome and the existing sky-backdrop area beneath it, and only exercised
states via toggles rather than proposing new layout structure.

### Sky backdrop (the animated background under review)

- Occupies the same fixed layer as today's `.sky-clouds`, clipped below the header/nav
  (`--chrome-height`), full width, full remaining viewport height.
- Five distinct visual treatments, one per category:
  - **sunny** — bright blue-to-pale gradient, full-opacity sun, sparse/faint clouds (extends
    today's `clear` tier).
  - **mixed** — softer blue, sun at reduced opacity, moderate cloud density (extends today's
    `partly` tier).
  - **cloudy** — grey gradient, sun mostly obscured, dense clouds (extends today's `overcast`
    tier).
  - **rain** — darker grey-blue gradient, dense clouds, **new**: a diagonal rain-streak layer.
  - **snow** — pale grey gradient, dense clouds, **new**: a falling-snowflake layer.
- All five MUST be genuinely animated in the real implementation (cloud drift, rain streak
  motion, snow drift) — the mockup's states are static toggle-driven snapshots only, precisely
  because animation timing/motion is out of scope for a review mockup, not because the real
  feature should be static. Respect `prefers-reduced-motion` the same way the existing cloud
  drift and flying-object animations already do.
- A small badge (top-left, mockup-only affordance for review purposes — not part of the real
  UI) narrates which config mode is active; not part of the shipped design.

### Nav bar weather text

- Unchanged in position/structure — the existing `.info-panel__weather-current` /
  `.info-panel__weather-forecast` elements in `.app-header__actions` (desktop) and the mobile
  sub-nav.
- **Behavior confirmed during review**: this text is fully independent of the background-weather
  setting. It always shows real, live weather/forecast data, in every mode ("auto", "off", or a
  fixed override) — because that information is relevant to the visitor on its own, separate
  from whatever the animated background happens to be showing. The two only visually agree while
  the background setting is "auto", because both are then reading the same live classification.
  This overturned an earlier draft of FR-002/FR-006 that assumed a fixed/off background should
  also force the nav bar text — see the "Revision" note below.

### Config setting (`web/js/config.js`)

- Not a runtime UI control — a single exported constant, edited by the operator, following the
  existing manual-override pattern (`SITE_TITLE`, `SKY_LOCATION_OVERRIDE`) already in that file.
  The mockup's "config panel" (a read-only snippet with the active line highlighted) exists only
  to make the three modes reviewable side by side; it has no shipped equivalent.
- Three modes reviewed: `'auto'` (default, live), `'off'` (plain default background), or one of
  the five category names as a fixed override.

## Requirement traceability

| Mockup element                                             | Spec requirement(s)                      |
| ---------------------------------------------------------- | ---------------------------------------- |
| Five distinct sky treatments                               | FR-001, FR-003, User Story 1             |
| Nav bar text always live, independent of background config | FR-002, FR-006, FR-007, User Story 1 AS7 |
| "auto" mode: background and nav bar agree                  | FR-002, User Story 1 AS1–AS6             |
| "off" mode: plain default background                       | FR-005, FR-007, User Story 2             |
| "fixed" mode: pinned background, nav bar unaffected        | FR-005, FR-006, User Story 3             |
| Config snippet showing single-setting, next-load semantics | FR-005, FR-010                           |

## Out of scope for this mockup (still in spec, deferred to planning/implementation)

- Real animation timing, drift speed, particle density/count for rain and snow.
- The exact WMO-weather-code → category mapping table (FR-004; default mapping documented in
  spec.md's Assumptions, to be finalized against the live Open-Meteo response during planning).
- `prefers-reduced-motion` handling for the two new (rain/snow) animated layers.
- The mobile sub-nav weather row's exact pixel layout (same text/values as desktop, different
  position — not re-drawn in the mockup, no layout change expected).
- Config-value validation/fallback-to-auto behavior (FR-008) — a data/logic concern, not visual.

## Revision during review

The first mockup draft assumed a fixed/off background setting should also force the nav bar's
weather text to match (mirroring how "auto" mode keeps them in sync). Feedback during review
corrected this: the nav bar must always show real weather/forecast regardless of the background
setting, since that information is independently relevant to visitors. `spec.md`'s FR-002,
FR-006, FR-007, the User Story 1 acceptance scenarios, and SC-001–SC-003 were updated to reflect
this before this file was written.
