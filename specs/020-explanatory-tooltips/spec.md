# Feature Specification: Explanatory Tooltips

**Feature Branch**: `020-explanatory-tooltips`

**Created**: 2026-08-15

**Status**: Done

**Input**: User description: "I would like to add different tooltips at different places across the application, each with an information icon, that only shows on mouse over on desktop, not on mobile. Mainly to explain the calculations behind some values like the "Tagesertrag in €", the "Soll", "Soll (auflaufend", "Ist", "Vermiedenes CO2". They should be easily extendible in the future when we decide to add more."

**Design**: [design.md](design.md) — approved mockup of the info-icon + tooltip layout in the stats panel.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Understand a figure's calculation on desktop (Priority: P1)

A desktop visitor looks at a stat such as "Soll (auflaufend)" or "Vermiedenes CO2" on a day, month, year, or total view and isn't sure how the number was derived. Next to the value they notice a small information icon. Hovering over it reveals a short, plain-language explanation of what the figure means and how it's calculated, without navigating away or clicking anything.

**Why this priority**: This is the entire feature — without it there is nothing to test or ship. It directly answers the recurring "how was this number calculated?" confusion the feature exists to resolve.

**Independent Test**: Load any view containing an annotated stat (e.g. the month view's "Soll (auflaufend)" tile) on a desktop-sized viewport, hover the information icon next to it, and confirm an explanatory tooltip appears with accurate, readable content and disappears when the mouse moves away.

**Acceptance Scenarios**:

1. **Given** a desktop viewport viewing a stat that has an explanation registered, **When** the user hovers the information icon next to that stat, **Then** a tooltip appears showing the explanation text for that specific stat.
2. **Given** the tooltip is currently visible, **When** the user moves the mouse away from the icon, **Then** the tooltip disappears.
3. **Given** a desktop viewport, **When** the user hovers an information icon for "Tagesertrag in €", **Then** the tooltip text describes that this figure is the day's yield converted to euros (not the "Soll", "Soll (auflaufend)", "Ist", or "Vermiedenes CO2" calculation).

---

### User Story 2 - No tooltip clutter on mobile (Priority: P2)

A visitor on a phone or tablet views the same stats. Because there is no mouse to hover with, an information icon that could only ever sit there unusable would just be clutter — so on touch-only devices the icons aren't rendered at all, and the mobile layout stays exactly as clean as it is today.

**Why this priority**: Prevents the feature from degrading the mobile experience (touch has no hover state, so a naive implementation could leave icons that appear to do nothing, or icons that visually clutter tight mobile layouts). Secondary to P1 because the desktop explanation capability is the core value; this is a guardrail.

**Independent Test**: Load the same annotated view at a mobile viewport width (or on an actual touch device) and confirm no hover-triggered tooltip UI appears or interferes with normal tapping/scrolling of the page.

**Acceptance Scenarios**:

1. **Given** a mobile viewport (touch-primary device), **When** the user views a stat that has a desktop tooltip, **Then** no information icon or floating explanation box is rendered at all, and the surrounding label/value looks identical to a stat with no explanation registered.
2. **Given** a mobile viewport, **When** the page renders, **Then** the omitted information icon introduces zero extra layout width/height compared to the same stat without the feature.

---

### User Story 3 - Add a new explained stat later (Priority: P3)

A developer wants to add an explanation for a stat that doesn't have one yet, or add tooltips to a brand-new stat introduced in a future feature. They should be able to do this by registering a new label/explanation pair in one place, without duplicating the hover/icon/positioning logic per call site.

**Why this priority**: Explicitly requested ("easily extendible in the future") but is a maintainability property rather than end-user-facing behavior, so it ranks below the two user-facing stories.

**Independent Test**: Add one new stat + explanation entry to the central definition and confirm it renders with a working icon and tooltip in its view, using the same visual style and hover behavior as the existing five, with no changes needed to the tooltip's rendering/positioning code.

**Acceptance Scenarios**:

1. **Given** a stat that has no explanation yet, **When** a developer adds an explanation for it via the feature's extension point, **Then** the stat displays an information icon with a working hover tooltip without any changes to shared tooltip rendering code.
2. **Given** two stats reusing the same underlying explanation (e.g. "Soll" appearing on both the month and year views), **When** the explanation text is updated once, **Then** both places reflect the updated text.

## Edge Cases

- What happens when a stat with an information icon is very close to the edge of the viewport (e.g. rightmost column of a data table)? The tooltip must still be fully visible on-screen rather than clipped or pushed off.
- What happens when a user tabs to an information icon using the keyboard rather than the mouse? The tooltip should be revealed on keyboard focus as well, so the explanation isn't hover-only-accessible.
- What happens if a device reports as a touch device but is also connected to a mouse/trackpad (e.g. touchscreen laptop)? The feature should key off actual hover capability rather than assuming touch devices never have a pointer, so hover still works when a precise pointer is present.
- What happens when the explanation text is long? The tooltip should wrap and remain readable rather than overflowing or being truncated.
- What happens when a stat currently has no registered explanation? No information icon is shown for it — existing stats are not required to gain tooltips as a side effect of this feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST display a small information icon next to any stat value that has a registered explanation.
- **FR-002**: On pointer-capable (hover-capable) devices, hovering the information icon MUST reveal a tooltip containing that stat's explanation text.
- **FR-003**: The tooltip MUST disappear when the pointer moves away from the icon (and, where applicable, away from the tooltip itself).
- **FR-004**: On touch-only devices (no hover capability), the information icon MUST NOT be rendered at all — there's nothing useful a tap could do with it, so it is omitted entirely rather than shown inert, keeping the stats panel exactly as clean as it is today.
- **FR-005**: The system MUST provide explanations, at minimum, for: "Tagesertrag in €", "Soll", "Soll (auflaufend)", "Ist", and "Vermiedenes CO2", each with wording accurate to that stat's actual calculation as implemented in the app.
- **FR-006**: Explanation text MUST be defined in a single, centrally maintained place (label → explanation) that view code references, so adding or editing an explanation does not require touching tooltip rendering/positioning logic.
- **FR-007**: The tooltip MUST remain fully within the viewport when the icon is near an edge (e.g. flipping side/alignment as needed) rather than being clipped.
- **FR-008**: The information icon MUST be reachable and operable via keyboard (focusable, revealing the tooltip on focus), so the explanation is not exclusively mouse-hover-accessible.
- **FR-009**: Adding an explanation for a stat that doesn't currently have one MUST NOT be required — the feature only adds icons where an explanation has been registered for that stat.
- **FR-010**: The tooltip content MUST be plain-language and specific to the individual stat (not a generic/shared message across unrelated stats).

### Key Entities

- **Explanation entry**: A single stat's tooltip content — the stat's identifying label (e.g. "Soll (auflaufend)") and its explanatory text. Multiple call sites for the same conceptual stat (e.g. "Soll" shown on both month and year views) may reference the same entry.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On desktop, a user can view the explanation for any of the five initial stats ("Tagesertrag in €", "Soll", "Soll (auflaufend)", "Ist", "Vermiedenes CO2") within one hover action, with no page navigation or click required.
- **SC-002**: On mobile/touch viewports, zero information icons or tooltip elements are rendered for any stat, across all views that carry annotated stats.
- **SC-003**: A developer can add an explanation for a new stat by editing a single central definition, with the icon and tooltip appearing correctly with no other code changes.
- **SC-004**: Tooltip text stays fully visible on screen (no clipping) regardless of the annotated stat's position on the page, including near viewport edges.
- **SC-005**: All information icons are operable via keyboard alone (tab to focus reveals the tooltip), verified across all views that carry annotated stats.

## Assumptions

- "Desktop" vs. "mobile" is determined by hover/pointer capability (e.g. `(hover: hover) and (pointer: fine)`-style detection) rather than screen width alone, so a touch-enabled laptop with a trackpad still gets hover tooltips while a phone does not.
- The five stats named in the request ("Tagesertrag in €", "Soll", "Soll (auflaufend)", "Ist", "Vermiedenes CO2") appear across the existing day/month/year/total views and the welcome/CO2 stats areas described in the codebase; exact wording of each explanation will be drafted to match the real calculation logic already implemented (e.g. in `yield-stats.js`), not invented independently.
- No persistence, analytics, or dismissal state is required — tooltips are stateless, purely presentational, and re-evaluate every time the icon is hovered/focused.
- Explanation text will be authored in German, matching the existing UI's language, unless stated otherwise.
- Styling (icon appearance, tooltip box style) should visually match the existing design system rather than introducing a new visual language.
