# Quickstart: Validate Transparency Mode

**Feature**: 009-transparency-mode | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/transparency-mode.md](./contracts/transparency-mode.md)

## Prerequisites

- Repo installed (`npm install`).
- Local dev server running: `npm start` (browser-sync + Tailwind watch — see project `CLAUDE.md`). Open the printed URL in a browser (WSL2 cannot auto-open one).

## Manual validation

1. Open the dashboard view (`/` or `visu.html`, per current routing).
2. Locate the transparency-mode toggle in the header (near the language switcher / mobile-nav-toggle area).
3. **Enable it** — confirm, without reloading:
   - The header nav (`app-nav`) and secondary period nav (`period-nav`) backgrounds disappear completely; the animated sky background (clouds, flying objects, blue sky) is visible behind them.
   - Chart containers and the statistics panel (`stats-panel`) become noticeably see-through (~40% opacity) while their labels/values/charts remain legible.
4. Navigate between day / month / year / dashboard views (and any drill-down) — confirm the transparent styling persists on every view without needing to re-enable it (FR-005).
5. Reload the page — confirm transparency mode is still enabled (FR-006, SC-004).
6. **Disable it** — confirm nav bars and panels immediately return to their normal, fully opaque baseline appearance (FR-004), and this also survives a reload.

## Automated validation

```bash
# Playwright end-to-end coverage (primary quality gate per constitution)
npx playwright test tests/e2e/transparency-mode.spec.js --reporter=line

# Full navigation regression, since the toggle lives in shared header chrome
npx playwright test tests/e2e/navigation.spec.js --reporter=line

# Unit tests for the new preference module (if logic beyond a boolean flag warrants it)
node --test web/js/settings.test.js
```

## Expected outcome

- `data-transparency="on"` appears on `<html>` only while enabled; absent/`"off"` otherwise (see [contracts/transparency-mode.md](./contracts/transparency-mode.md)).
- `localStorage.getItem('solarlog-transparency')` reflects the last user choice across reloads.
- No SolarLog data values, chart data, CO₂ figures, or Soll/Ist stats change — only the opacity/transparency of their containers (Constitution Principles I & II unaffected).
