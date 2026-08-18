# Design: Weather Panel Icons

Approved layout for the nav bar's weather/forecast rework, captured from the reviewed mockup
(see **Mockup** link at the bottom). Built from the real `.app-header`/`.info-panel` markup and
`web/css/tokens.css` values, so it reads as the actual app rather than a generic template.

## Current-conditions line

Replaces the "Aktuell:" text prefix with a leading decorative icon:

```
☀️ Sonnig, 24°C          ← daytime "sunny"
🌙 Klar, 11°C            ← nighttime override (sunny classification, after sunset/before sunrise)
⛅ Wechselnd bewölkt, 18°C
☁️ Bewölkt, 15°C
🌧️ Regen, 11°C
❄️ Schnee, -2°C
Nicht verfügbar          ← unavailable, no icon
```

Icon → label → comma → rounded temperature, in that order, on one line. Icon is
`aria-hidden="true"`. The nighttime override is the only category with a day/night variant —
mixed/cloudy/rain/snow render identically at any hour.

Satisfies: FR-001, FR-002, FR-003, FR-007, FR-009, FR-011, FR-013; Acceptance Scenarios 1–5 of
User Story 1.

## Forecast line

Keeps a prefix, an icon, a label, and a parenthesized low–high range — but the prefix and the
day it describes now switch together at a fixed cutoff hour
(`FORECAST_DAY_SWITCH_HOUR` in `config.js`, default **18:00** local, developer-set only — no
settings UI):

```
Heute: 🌧️ Regen (13°C - 19°C)     ← before the cutoff hour: today's data
Morgen: 🌧️ Regen (11°C - 17°C)    ← at/after the cutoff hour: tomorrow's data
                                    (empty)                     ← unavailable, whole line renders nothing
```

The forecast icon/label never gets the current-conditions line's nighttime override — a
whole-day forecast has no single instant to test for night. Range always reads low before high,
both values rounded independently (so an equal-rounded low/high still shows both bounds, not a
single collapsed value).

Satisfies: FR-004, FR-005, FR-006, FR-008, FR-012, FR-014, FR-015; Acceptance Scenarios 1–5 of
User Story 2.

## Full combination set (approved)

The mockup's two galleries render every combination the spec calls for, confirmed distinct and
non-overlapping:

- **Current-conditions** (7): sunny/day, sunny/night (clear override), mixed, cloudy, rain, snow,
  unavailable.
- **Forecast** (11): each of the 5 categories × before/at-after the cutoff hour (10), plus
  unavailable.

## Responsive behavior

Two DOM copies of the same `.info-panel`, CSS-switched by viewport width (unchanged mechanism):
`.info-panel--desktop` inside the combined header row (`md:` and up), `.info-panel--mobile` as
its own full-width sub-nav bar below the header (below `md:`). Icon + label never separate across
a line wrap at either width — verified in the mockup's Desktop/Mobile viewport toggle.

Satisfies: FR-010, SC-003.

## Out of scope for this mockup (per spec, unaffected by layout)

- Exact WMO-code → category mapping (already defined, unchanged).
- The extra Open-Meteo `sunrise`/`sunset` fields and `forecast_days=2` fetch — no visual effect,
  a data-sourcing change only.
- Production/yield widget styling (pulse dot, wattage, kWh figures) — shown in the mockup only
  for layout context; unchanged by this feature.

## Mockup

Local, durable copy: [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/7c08b192-d8c6-492f-9583-2a756bf088df
