# Design: Day/Night Sky Background

**Status**: Approved (2026-08-14)
**Mockup**: https://claude.ai/code/artifact/90b74546-0ad4-49e7-b74a-b0ee078aee73 (non-functional
review artifact — static states only, no live data, no real animation timing; may not stay live
indefinitely, this file is the durable record)

## Approved layout

No new screen or region — this feature extends the existing sky backdrop
(`web/index.html` / `app.css` / `sky-controller.js`) in place, the same area reviewed for
`017-background-weather-config`. The mockup reused that existing app-header chrome and sky area,
exercising the new day/night × weather-category matrix purely via toggles.

### Sky backdrop states

Six states reviewed, covering the matrix FR-001/FR-004/FR-005 define:

- **Day** — unchanged from today: bright blue gradient, sun, existing cloud treatment per
  weather category (not itself re-reviewed here — see `017-background-weather-config/design.md`).
- **Night · sunny** and **Night · mixed** — dark navy gradient, moon (today's existing crossfade
  slot, unchanged), plus a **starfield** layer and an occasional **falling-star** element.
- **Night · cloudy** — dark navy gradient with a lighter, slightly warmer tint (reads as ambient
  light reflected off the cloud ceiling rather than pure black), moon dimmed to ~15% opacity
  (mirrors how the sun is already dimmed under cloud cover today), clouds only — **no stars**.
- **Night · rain** / **Night · snow** — same overcast-tinted night base as cloudy, moon dimmed,
  existing rain-streak/snowflake layers unchanged in behavior — **no stars**.

### Starfield & falling star

- Starfield: a fixed set of small twinkling dots layered behind the cloud layer, above the night
  gradient. Shown only when Day/Night State is night **and** the weather category is sunny or
  mixed. Absent in every other state (day, or night with cloudy/rain/snow).
- Falling star: a single transient streak-and-dot element that lives inside the starfield layer
  and is only ever present alongside the starfield (never independently). Reviewed as an
  independent show/hide toggle to confirm it reads as an occasional accent, not a permanent
  fixture — real timing/frequency is a motion-design/implementation detail (Assumptions in
  spec.md), not a layout one.
- Both respect the existing `prefers-reduced-motion` handling pattern: the falling star (motion)
  is suppressed, the static starfield (no motion) is unaffected.

### Clouds, rain/snow, flying objects

- Confirmed unchanged in position, shape, and behavior between day and night — only their tint
  shifts slightly to read correctly against the darker night base. No new layout structure.

### Mocked app header / nav-bar weather text

- Unchanged in position/structure from `017-background-weather-config` — included in the mockup
  only to give the sky backdrop visual context, not itself under review here.

## Requirement traceability

| Mockup element                                                  | Spec requirement(s)                |
| --------------------------------------------------------------- | ---------------------------------- |
| Day state unchanged from today                                  | FR-002, FR-006, User Story 1 AS2   |
| Night state (dark base + moon) across all 5 weather categories  | FR-001, User Story 1 AS1, AS3, AS4 |
| Clouds/rain/snow/flying-objects unchanged between day and night | FR-003, User Story 1 AS4, SC-002   |
| Starfield only on night-sunny / night-mixed                     | FR-004, FR-006, User Story 2       |
| No starfield on night-cloudy / night-rain / night-snow          | FR-005, User Story 2 AS3           |
| Falling star scoped inside the starfield only                   | FR-007, FR-008, User Story 3       |

## Out of scope for this mockup (still in spec, deferred to planning/implementation)

- Real twinkle timing and falling-star arc path/duration/frequency (FR-007; "occasional,
  randomized" per spec.md's Assumptions — exact tuning left to implementation).
- The sunrise/sunset crossfade blend itself (FR-009) — `solar-arc.js`'s existing crossfade
  window already handles the sun/moon transition; this mockup shows only the two end-states
  (fully day, fully night), not the blend.
- Star count/placement algorithm — mockup uses fixed placeholder positions only.
- `prefers-reduced-motion` handling specifics for the falling star (FR-011) — a behavior
  concern, not a layout one.
- Exact color values for the night gradient/moon-dimming — mockup values are indicative,
  final values chosen during implementation to match the app's existing sky palette.
