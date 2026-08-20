# Design: Compact Weather Widget

Approved layout for the info panel's weather/forecast area, captured from the reviewed mockup
(see **Mockup** link at the bottom). Built from the real `.info-panel`/`.info-panel__weather`
markup and `web/css/tokens.css` values, so it reads as the actual app rather than a generic
template.

## Two compact indicators, split by a divider

Both the current-conditions indicator and the forecast indicator collapse to the same shape —
icon on top, a value beneath it — with a vertical divider between them:

```
 ☀️  │ 🌧️
24°C │ 15° - 19°
```

- **Current conditions**: icon + rounded temperature (`24°C`). No condition label text visible.
- **Forecast**: icon + rounded low–high range (`15° - 19°`), no `°C` suffix repeated per value
  (keeps the range compact) and no condition label or "Heute:"/"Morgen:" day prefix visible.
- **Divider**: a `border-left` on the forecast indicator, using `--color-border` — only a
  boundary marker, no interactive behavior of its own.

Satisfies: FR-001, FR-002, FR-003, FR-008; Acceptance Scenarios 1–4 of User Story 1.

## Hover/focus reveals the original text

Hovering or focusing (`:hover` / `:focus-within`, keyboard-reachable via `tabindex="0"` on each
indicator) either icon shows a floating tooltip with the exact text that used to render inline
for that indicator:

```
Current:  "Klar, 21°C"
Forecast: "Heute: Regen (15°C - 19°C)"   ← keeps the day prefix
```

Each tooltip is independent — hovering current conditions never reveals the forecast text and
vice versa. The tooltip disappears when the pointer leaves or focus moves elsewhere.

Satisfies: FR-004, FR-005, FR-006; Acceptance Scenarios 1–4 of User Story 2.

## Unavailable state

Each indicator's unavailable state is independent: an icon-only dash (`–`) at reduced opacity,
still visible by default (not hidden behind hover), matching the current app's existing
"unavailable" handling. Current conditions can be unavailable while the forecast is available,
or vice versa.

Satisfies: FR-007; Edge Cases (independent current/forecast availability).

## Responsive behavior

Reuses the existing `.info-panel--desktop` / `.info-panel--mobile` split (unchanged mechanism,
verified 023-weather-panel-icons) — both DOM copies get the same compact markup. Confirmed in
the mockup's Desktop/Mobile viewport toggle that the divider and icon-over-value stacking hold
at both widths.

## Out of scope for this mockup (per spec, unaffected by layout)

- Exact icon glyph per weather category (`weather-icon.js`, unchanged) — only sunny/rain glyphs
  shown for illustration.
- Forecast day-switch logic (today vs. tomorrow, `FORECAST_DAY_SWITCH_HOUR`) — unaffected, only
  the display shape of whichever day is selected changes.
- Production/yield widget styling — shown in the mockup only for layout context.

## Mockup

Local, durable copy: [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/8b566f46-aaa2-4e41-ba6e-dd7d66747e1b
