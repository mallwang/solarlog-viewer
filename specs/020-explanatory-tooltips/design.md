# Design: Erklär-Tooltips (Explanatory Tooltips)

**Feature**: [spec.md](spec.md)
**Status**: Approved 2026-08-15
**Mockup**: [mockup.html](mockup.html) (local static snapshot, open directly in a browser) —
originally reviewed at https://claude.ai/code/artifact/e675d1d5-01d5-49c7-b57f-356d7d33650e
(non-functional review artifact; remote link may go stale, the local copy and this document are
the durable record of what was approved).

## Approved layout

Demonstrated against the month view's existing stats panel (`.stats-panel` /
`.summary-table`, see `web/js/views/stats-panel.js`), which every day/month/year/total/welcome
view already shares:

1. **Label + icon** — each explained stat's `<th>` label gets a small circular "i" icon
   inline, right after the label text (`Monatsertrag in €  ⓘ`), inside a `<span class="stat-label">`
   flex row with a small gap. The icon is sized to sit comfortably next to 0.875rem label text
   without disrupting the row's height.
2. **Icon element** — a real, focusable `<button>` (not a decorative span), so keyboard tabbing
   reaches it via native tab order (FR-008) with no extra ARIA wiring beyond
   `aria-describedby` pointing at the tooltip and `role="tooltip"` on the tooltip itself.
3. **Tooltip** — a dark, rounded callout anchored above the icon, appearing on `:hover` (gated to
   hover-capable pointers) and on `:focus-visible` (all input types). It centers on the icon by
   default; icons close to the stats panel's right edge (e.g. "Ist", "Vermiedenes CO2") instead
   anchor their tooltip from the right edge of the icon so it never gets clipped by the panel
   boundary (FR-007). Content is short, single-stat-specific German text describing the
   calculation (FR-005, FR-010).
4. **Touch / no-hover devices** — the icon is not rendered at all (see below), so there is no
   inert tap target and no layout difference from a stat with no explanation registered.

## Icon visibility on touch devices

Initial review considered "icon visible, tap does nothing" (inert-but-present). The approved
direction is simpler and cleaner: **the icon is omitted entirely** on devices that report no
hover capability, gated via `(hover: hover) and (pointer: fine)` rather than a screen-width
breakpoint (so a touchscreen laptop with a trackpad still gets the icon and hover/focus tooltip —
see spec Assumptions). This keeps the mobile stats panel pixel-identical to today's, satisfying
User Story 2 and revised FR-004.

## Requirement traceability

| Region / state                                | Spec item(s) satisfied                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Info icon next to explained stat's `<th>`     | FR-001, FR-005, User Story 1 acceptance scenario 1/3               |
| Hover reveals tooltip (hover-capable only)    | FR-002, User Story 1 acceptance scenario 1                         |
| Tooltip disappears on pointer-out             | FR-003, User Story 1 acceptance scenario 2                         |
| Icon omitted entirely on touch-only devices   | FR-004, User Story 2 acceptance scenarios 1–2 (revised, see above) |
| Right-edge tooltip flip                       | FR-007, Edge Case "icon near viewport edge"                        |
| `:focus-visible` reveals tooltip              | FR-008, Edge Case "keyboard tab to icon"                           |
| Per-stat, plain-language tooltip text         | FR-005, FR-010                                                     |
| Stat with no registered explanation → no icon | FR-009, Edge Case "no explanation registered"                      |

## Explicitly out of scope for this mockup

- The central label→explanation data structure itself (FR-006) — a plan-time/implementation
  concern; the mockup only demonstrates that the rendered result looks the same regardless of
  where the text comes from.
- The day/year/total/welcome views' stats panels — they reuse the identical
  `.stats-panel`/`.summary-table` markup shown here (see `stats-panel.js`) and are not re-mocked
  per view.
- "Smart" auto-placement for every possible icon position — the mockup fixes only that a
  right-edge icon flips its tooltip anchor; a general positioning algorithm is a plan-time
  decision.
- Touch devices with an attached mouse mid-session — the assumption documents the
  pointer-capability detection approach, not a live toggle demo.
- Long-text wrapping edge case (Edge Case: very long explanation) — the mockup's sample text is
  representative-length but wrapping behavior at extreme lengths wasn't separately stress-tested.
