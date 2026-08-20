# Quickstart: Validate the User Guide Header Icon

Prerequisites: `npm install` already run once; repo on branch `026-user-guide-icon-nav`.

## 1. Start the dev server

```bash
npm start
```

Copy the printed local URL into a browser (WSL2 cannot auto-open one).

## 2. Manual visual check (desktop width)

1. Load the site. In `.app-header__actions` (top-right of the header row), confirm two adjacent
   icon-only buttons: a document icon, then the eye/eye-slash Transparency icon, in that order,
   with no visible text next to either.
2. Hover the document icon: a native tooltip shows the user guide label (e.g. "Benutzerhandbuch
   (öffnet in neuem Tab)" in German, "User Guide (opens in new tab)" in English).
3. Click it: a new browser tab opens to
   `https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide.md` (or `.de.md` if the
   UI language is German).
4. Open the main nav (desktop list or burger menu on mobile) and confirm there is no
   "Benutzerhandbuch"/"User Guide" entry anywhere in it — the icon is the only way to reach it.

## 3. Manual visual check (mobile width)

1. Resize the viewport to ≤480px (or use browser devtools' device toolbar).
2. Without opening the burger menu, confirm the same two icons (guide, then Transparency) are
   still visible and clickable in the header row.

## 4. Language switch check

1. If the language switcher is visible (`SHOW_LANGUAGE_SWITCHER` in `config.js`), switch
   language.
2. Re-hover/re-click the guide icon without reloading the page; confirm the tooltip text and the
   opened tab's URL both now match the newly selected language, with no page reload.

## 5. Automated checks

```bash
npx playwright test tests/e2e/header-actions.spec.js --reporter=line
npx playwright test tests/e2e/dashboard-nav.spec.js --reporter=line
npx playwright test tests/e2e/transparency-mode.spec.js --reporter=line
npm run lint
npm run format:check
```

Expected outcome: all Playwright specs pass, including new assertions for icon visibility at
desktop/mobile widths, correct `href`/accessible name per language, absence of a "userGuide" nav
list entry, and unchanged Transparency toggle behavior (adjacent icon didn't break its styling or
click handling). Lint and format checks exit 0.
