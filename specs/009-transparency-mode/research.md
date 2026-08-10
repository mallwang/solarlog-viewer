# Phase 0 Research: Transparency Mode

No `NEEDS CLARIFICATION` markers remained in the Technical Context after drafting it directly from the existing codebase conventions, so this phase documents the decisions made and the precedent they follow rather than resolving open unknowns.

## Decision: Preference storage & persistence mechanism

- **Decision**: Store the transparency-mode boolean in `localStorage` under a dedicated key (e.g. `solarlog-transparency`), read once at boot and whenever the user toggles it.
- **Rationale**: The codebase already has an established, working pattern for exactly this shape of preference — `web/js/i18n.js` persists the language choice under `solarlog-lang` in `localStorage`, exposes `get*()`/`set*()` functions, and is read once during `initI18n()` at bootstrap. Reusing the same shape keeps the new preference consistent with existing code and requires no new infrastructure. It also naturally satisfies FR-006 (remembered across reloads/visits) and the Assumptions note that this is a local, per-browser preference with no account/server sync.
- **Alternatives considered**:
  - *`sessionStorage`* — rejected because it would not persist across the "future visits" case required by FR-006 and SC-004.
  - *URL query parameter* — rejected; it isn't "global" in the sense of a durable per-browser preference and would complicate every internal link/navigation across day/month/year/dashboard views.
  - *Cookie* — rejected as unnecessary; no server ever needs to read this preference (Constitution Principle III — no backend), so browser-local storage is sufficient and simpler than managing cookie attributes.

## Decision: How transparency is expressed in markup/CSS

- **Decision**: Toggle a single attribute (e.g. `data-transparency="on"`) on the root `<html>` element; express all opacity effects as CSS rules scoped under that attribute, using CSS custom properties in `web/css/tokens.css` for the two opacity levels (`0%`/fully-transparent for nav, `40%` for panels/diagrams).
- **Rationale**: The project's existing theming approach already uses CSS custom properties as "the single source of design-token truth" (constitution, Technical Standards → Frontend) and the sky-background feature (007-dynamic-sky-weather) already relies on layered, semi-transparent chrome over an animated background — this feature extends that same visual system rather than inventing a new one. A single root attribute means every current and future component that uses the shared nav/chart-container/stats-panel classes (`app-nav`, `period-nav__link`, chart-container cards, `stats-panel.js`) automatically respects the mode via CSS alone; no per-view JavaScript changes are needed, keeping the change small and consistent with "vanilla CSS/JS, no framework."
- **Alternatives considered**:
  - *Inline style manipulation via JavaScript on every panel/nav element* — rejected: fragile, requires touching every view module (`dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`, `period-nav.js`, `stats-panel.js`) individually, and duplicates logic the CSS cascade already provides for free.
  - *Two separate classes (one for nav, one for panels)* — rejected in favor of one root attribute with two scoped rule sets, since both are driven by the same single user setting and should always change together; a single attribute is simpler to reason about and impossible to get out of sync.
  - *CSS `prefers-*` media feature* — not applicable; this is an explicit user-chosen application setting, not an OS-level signal.

## Decision: Where the toggle control lives

- **Decision**: Add a toggle control to the existing header (`web/index.html`, alongside the existing language-switcher/mobile-nav-toggle area), wired up in `web/js/main.js`.
- **Rationale**: FR-001 requires the setting be "accessible from anywhere in the application"; the header/nav is already present on every view (per constitution Principle IV/VI, all views share the same chrome), so placing the control there satisfies the requirement without introducing a new page or panel. This mirrors how the (currently hidden) language switcher is positioned in the same header region.
- **Alternatives considered**:
  - *A dedicated settings page/route* — rejected as unnecessary ceremony for a single boolean toggle; adds a navigation hop that contradicts FR-007 ("without requiring the user to navigate to a different page").

## Decision: Legibility of transparent nav content

- **Decision**: Rely on existing text/icon styling (font-weight, drop-shadow/outline already used for text sitting over the animated sky background) rather than introducing new contrast machinery.
- **Rationale**: Per the spec's Assumptions, no new visual treatment is mandated. The sky-background feature already had to solve "text readable over a moving background" for its header title; this feature can reuse that precedent for nav bar transparency instead of duplicating a new contrast system.
- **Alternatives considered**:
  - *Dynamic contrast/luminance sampling of the background* — rejected as out of scope per the spec's Edge Cases answer; unnecessary complexity for a display preference.

**Output**: All Technical Context items are resolved; no `NEEDS CLARIFICATION` markers remain.
