---
description: 'Task list for feature implementation'
---

# Tasks: User Guide Icon Next to Transparency Toggle

**Input**: Design documents from `/specs/026-user-guide-icon-nav/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [design.md](./design.md)

**Tests**: Included — the constitution's Testing standard requires a failing Playwright test to
exist before implementation for every UI-visible change (Development Workflow §3).

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single static web app — `web/` for the app, `tests/e2e/` for Playwright specs, `docs/` for user
guides, per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Project initialization

No new dependencies, build steps, or scaffolding are needed — this feature only rearranges
existing markup/JS/CSS/i18n in an already-running app. Skipping straight to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

None required — `documentText` (icons.js), `nav.userGuideView`/`nav.opensNewTab` (i18n),
`.transparency-toggle` (app.css), and the `href()` language-resolution formula (currently in
`NAV_ITEMS.userGuide`) all already exist and are reused as-is (see research.md). No shared
scaffolding needs to be built before Phase 3 can start.

**Checkpoint**: Foundation ready — proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Open the user guide quickly from the header (Priority: P1) 🎯 MVP

**Goal**: A standalone, icon-only user guide button appears in `.app-header__actions`,
immediately before the Transparency toggle, at every viewport width, and opens the
language-specific guide in a new tab on click.

**Independent Test**: Load the header, click the document icon next to the Transparency toggle,
and verify that the (language-appropriate) user guide opens in a new tab — at both a desktop and
a mobile viewport width.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL (element doesn't exist yet) before implementing.

- [ ] T001 [P] [US1] Create `tests/e2e/header-actions.spec.js` with failing assertions: the
      `#user-guide-link` button is visible in `.app-header__actions` immediately before
      `#transparency-toggle` at a desktop viewport (≥1024px) and at a mobile viewport (≤480px,
      without opening the burger nav); it has a non-empty `aria-label`; clicking it opens
      `https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide.md` in a new tab
      (assert via a `page.waitForEvent('popup')`/`context.waitForEvent('page')` pattern, matching
      existing Playwright conventions in this repo)

### Implementation for User Story 1

- [ ] T002 [US1] Add `<button type="button" class="user-guide-link transparency-toggle"
    id="user-guide-link"></button>` to `web/index.html`, inside `.app-header__actions`,
      immediately before the existing `#transparency-toggle` button (per design.md's icon
      ordering: guide, then Transparency)
- [ ] T003 [US1] In `web/js/main.js`, add a `userGuideLink` element reference
      (`document.getElementById('user-guide-link')`) alongside the existing
      `transparencyToggles` reference
- [ ] T004 [US1] In `web/js/main.js`, add a `userGuideHref()` helper reusing the language-
      resolution formula currently inline in `NAV_ITEMS.userGuide.href` (moved, not duplicated —
      see research.md §1/§4):
      `` `https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide${getLanguage() === 'de' ? '.de' : ''}.md` ``
- [ ] T005 [US1] In `web/js/main.js`, add `renderUserGuideLink()` (mirroring
      `renderTransparencyToggle()`): sets `userGuideLink.innerHTML = icon('documentText',
    'size-5')` and sets both `aria-label` and `title` to
      `` `${t('nav.userGuideView')} (${t('nav.opensNewTab')})` `` (research.md §2)
- [ ] T006 [US1] In `web/js/main.js`, add `initUserGuideLink()` (mirroring
      `initTransparencyToggle()`): calls `renderUserGuideLink()` once, then wires a `click`
      listener on `userGuideLink` that opens `userGuideHref()` via
      `window.open(userGuideHref(), '_blank', 'noopener,noreferrer')`
- [ ] T007 [US1] In `web/js/main.js`'s `bootstrap()`, call `initUserGuideLink()` alongside the
      existing `initTransparencyToggle()` call
- [ ] T008 [US1] In `web/js/main.js`'s `renderLangSwitcher()` language-switch handler, call
      `renderUserGuideLink()` alongside the existing `renderNav()` call so the `aria-label`/
      `title` re-resolve without a page reload (FR-010)
- [ ] T009 [US1] Verify `de.json`/`en.json`'s `nav.userGuideView` and `nav.opensNewTab` strings
      still read naturally when concatenated as `"{userGuideView} ({opensNewTab})"` for an
      `aria-label`/`title`-only context (no visible text); tweak wording only if it reads
      awkwardly out of its old sr-only-suffix context
- [ ] T010 [US1] Run `npx playwright test tests/e2e/header-actions.spec.js --reporter=line` and
      confirm all assertions from T001 now pass

**Checkpoint**: User Story 1 is fully functional and independently testable — the guide is
reachable via a single click on a header icon at every viewport width.

---

## Phase 4: User Story 2 - Existing behavior stays unchanged (Priority: P2)

**Goal**: The user guide entry is removed from the main nav list (desktop and burger-collapsed
mobile) so it exists in exactly one place; all other nav items and the Transparency toggle keep
working unchanged.

**Independent Test**: Click through all remaining nav items and verify they still work as
before, and that the user guide entry no longer appears twice (neither in the list nor the
header) nor disappears entirely.

### Tests for User Story 2 ⚠️

> Write/update these tests FIRST; confirm they FAIL (old entry still present) before
> implementing.

- [ ] T011 [P] [US2] Update `tests/e2e/dashboard-nav.spec.js`: remove `userGuide`/
      "Benutzerhandbuch"/"User Guide" from its expected nav-list label set and adjust any item-
      count assertion so the test currently fails against the not-yet-changed `NAV_ITEMS` (i.e.
      it now expects the entry gone, which is false until T012 lands)
- [ ] T012 [P] [US2] Add an assertion to `tests/e2e/header-actions.spec.js` (from T001) that
      `#app-nav-list` contains no link with `href` matching `docs/user-guide` — i.e. the guide
      exists in exactly one place (header icon only)

### Implementation for User Story 2

- [ ] T013 [US2] In `web/js/main.js`, remove the `userGuide` entry (and its now-orphaned
      `external`/`href` fields) from `NAV_ITEMS`
- [ ] T014 [US2] In `web/js/main.js`'s `renderNav()`, remove the now-dead `item.external`
      branch (no remaining `NAV_ITEMS` entry sets `external: true`) so the function only renders
      routed view links, per the constitution's minimalism bias against unreachable code
- [ ] T015 [US2] Run `npx playwright test tests/e2e/dashboard-nav.spec.js
    tests/e2e/header-actions.spec.js --reporter=line` and confirm all assertions from T011/T012
      now pass, and manually click through the remaining nav items (day/month/year/total/
      statistics/events) to confirm none regressed

**Checkpoint**: Both user stories work together — the guide is reachable exactly once, via the
header icon, with no regression to the rest of the nav or the Transparency toggle.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final verification across both stories

- [ ] T016 [P] Update `docs/user-guide.md`: note that the user guide link now lives as a
      standalone icon in the header next to the Transparency toggle, not in the main nav list
- [ ] T017 [P] Update `docs/user-guide.de.md` with the same change, in German, kept consistent
      with T016 (constitution Documentation Standards)
- [ ] T018 [P] Check `README.md` (line ~35, "see the [User Guide](docs/user-guide.md)") and
      `README.de.md` (line ~37) for any wording implying the guide is reached via the nav list;
      update if so, otherwise leave unchanged
- [ ] T019 Run `npx playwright test tests/e2e/transparency-mode.spec.js --reporter=line` to
      confirm the adjacent Transparency toggle's styling/behavior is unaffected by the new
      sibling button
- [ ] T020 Run `npm run lint` and `npm run format:check`; fix any violations
- [ ] T021 Walk through `quickstart.md` end-to-end (manual desktop/mobile checks + full
      automated check list) to confirm the feature is done
- [ ] T022 Update `**Status**` in `spec.md` from `Draft` to `Implemented` (only once every task
      above is checked off)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — no work needed
- **Foundational (Phase 2)**: Skipped — no blocking prerequisites
- **User Story 1 (Phase 3)**: No dependencies — can start immediately
- **User Story 2 (Phase 4)**: Independent of US1's _tests_ (T011/T012 can be written in
  parallel with US1), but its _implementation_ (T013 removing `NAV_ITEMS.userGuide`) should land
  after US1's T002–T009 so the guide is never briefly unreachable (US1 adds the header icon
  before US2 removes the nav-list fallback)
- **Polish (Phase 5)**: Depends on both US1 and US2 being complete

### Within Each User Story

- Tests (T001; T011/T012) MUST be written and confirmed failing before their implementation
  tasks
- T002 (markup) before T003–T008 (JS wiring, which reference `#user-guide-link`)
- T004 (href helper) before T005/T006 (which call it)
- T005 before T006 (render before init, matching `renderTransparencyToggle`/
  `initTransparencyToggle`'s existing order)
- T013 (remove NAV_ITEMS entry) before T014 (remove now-dead branch it makes unreachable)

### Parallel Opportunities

- T001 (US1 test) and T011/T012 (US2 tests) can be written in parallel — different files
- T016, T017, T018 (Polish docs) can run in parallel — different files
- T003 alone touches `main.js` at a time with no other parallel edit safely possible in the same
  file within Phase 3 (T003–T008 are sequential edits to the same file/function group)

---

## Parallel Example: Test-writing across both stories

```bash
# Launch both stories' test-authoring tasks together (different files):
Task: "Create tests/e2e/header-actions.spec.js with failing US1 assertions (T001)"
Task: "Update tests/e2e/dashboard-nav.spec.js to fail against the not-yet-removed nav entry (T011)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3 (User Story 1): header icon added, working, tested.
2. **STOP and VALIDATE**: the guide is reachable via the new icon at every viewport width — even
   though the old nav-list entry still exists too (harmless duplication, not yet a regression).
3. Deploy/demo if ready — US1 alone already satisfies the feature's primary request.

### Incremental Delivery

1. Phase 3 (US1) → header icon live, guide reachable in the new way → demo.
2. Phase 4 (US2) → nav-list entry removed, single-source-of-truth restored → demo.
3. Phase 5 (Polish) → docs updated, full quickstart validated, spec marked Implemented.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature has no Setup/Foundational work — both phases are intentionally empty, documented
  above rather than omitted, so the phase numbering stays consistent with the template
- Commit after each checkpoint (end of Phase 3, end of Phase 4, end of Phase 5)
- Avoid: styling `.user-guide-link` with duplicated (rather than shared) CSS properties — see
  research.md §3 for why the shared `.transparency-toggle` class is used instead of a new rule
  block
