---
description: 'Task list for Documentation Overhaul'
---

# Tasks: Documentation Overhaul

**Input**: Design documents from `/specs/021-documentation-overhaul/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories),
[research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: Not applicable — this is a docs-only feature. No Playwright/`node --test` coverage
applies (plan.md Technical Context). Validation is the manual/scripted checklist in
[quickstart.md](quickstart.md), run in the Polish phase below.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task below is a Markdown edit — file paths are exact, no other conventions apply

## Path Conventions

All paths are repo-root Markdown files: `README.md`, `README.de.md`, `docs/user-guide.md`,
`docs/user-guide.de.md`, `docs/developer-guide.md` (new). No `web/`, `scripts/`, or `tests/` files
are touched (plan.md Structure Decision).

---

## Phase 1: Setup

**Purpose**: Confirm the working tree matches the assumptions data-model.md's line-range mapping
was built on, before any content moves.

- [x] T001 Diff the current line ranges in `README.md` and `docs/user-guide.md` against the
      "Source" column of [data-model.md](data-model.md)'s two section tables; note any drift so
      later tasks cite the right lines

**Checkpoint**: Line-range assumptions confirmed (or corrected) — safe to start moving content.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `docs/developer-guide.md` is the relocation target for content that both User Story 1
(README's pointer, R3) and User Story 2 (user-guide's removal, FR-007) depend on existing first —
neither story's trim/removal step is safe until the destination holds the content.

**⚠️ CRITICAL**: Do not trim README's script section (Phase 3) or remove user-guide's script
sections (Phase 4) until this phase is complete.

- [x] T002 Create `docs/developer-guide.md` with title "Developer Guide: Validation & Aggregation
      Scripts", a scope note (who it's for), and a "Prerequisites" section moved verbatim in
      substance from `docs/user-guide.md`'s existing Prerequisites (Node 22+, manual
      `web/data`/`web/hist` repopulation caveat)
- [x] T003 Add Steps 1–5 to `docs/developer-guide.md` (Detect gaps → `gap-detect.js`, Validate
      daily totals → `validate-plausibility.js`, Fill gaps → `fill-days-hist.js`, Regenerate
      monthly totals → `fill-months.js`, Regenerate annual totals → `fill-years.js`), each moved
      from `docs/user-guide.md`'s current Step 1–5 content and each script's flags/examples
      converted to a markdown table (R4)
- [x] T004 Add "Agentic skills (Claude Code)" and "Typical workflow" sections to
      `docs/developer-guide.md`, moved from `docs/user-guide.md`'s current end-of-file content
      (`/backfill-days-hist`, `/backfill-months`, `/backfill-years` shortcuts + end-to-end example
      sequence)

**Checkpoint**: `docs/developer-guide.md` complete and holds everything Phase 3/4 are about to
remove from their source files — no content is dropped mid-restructure.

---

## Phase 3: User Story 1 - Scan the README to understand and run the project (Priority: P1) 🎯 MVP

**Goal**: A reader can state what the app does and the exact local-run commands after reading only
`README.md`'s opening description through its getting-started section.

**Independent Test**: Hand a reader the restructured `README.md` and time how quickly they can
state (a) the app's purpose and (b) the exact run commands, without scrolling past
getting-started.

### Implementation for User Story 1

- [x] T005 [US1] Add a language-toggle link pair ("English · [Deutsch](README.de.md)") to
      `README.md`, directly below the title/badges block (FR-005; target file arrives in Phase 5,
      link is added now so Phase 5 only needs to confirm it resolves)
- [x] T006 [US1] Rewrite `README.md`'s opening into 1–2 concise paragraphs describing what the app
      does, free of implementation narrative, followed by a scannable features bullet list (sky,
      info panel, events, tooltips, five view modes, i18n, etc.) (FR-001)
- [x] T007 [US1] Move the existing "Dev server" section up to immediately follow the
      opening/features content, retitled "Getting started / Dev server", keeping its
      copy-pasteable `npm install && npm start && npm run open` commands and proxy-behavior note
      (FR-002)
- [x] T008 [US1] Add a link from `README.md`'s getting-started/opening area to
      `docs/user-guide.md` as the destination for the full end-user dashboard walkthrough, instead
      of repeating that walkthrough inline (FR-003)
- [x] T009 [US1] Strip file/function/config-name detail from the "Dynamic sky background" section
      in `README.md`, condense to 1–3 plain-language sentences, keep the existing
      `specs/007-dynamic-sky-weather/` link (FR-004, R2)
- [x] T010 [US1] Strip file/function/config-name detail from the "Global desktop info panel"
      section in `README.md`, condense to 1–3 sentences, keep the existing
      `specs/010-global-info-panel/` link (FR-004, R2)
- [x] T011 [US1] Strip file/function/config-name detail from the "Ereignisse (events) page"
      section in `README.md`, condense to 1–3 sentences, keep/add a link to
      `docs/user-guide.md#ereignisse-events-page` (FR-004, R2)
- [x] T012 [US1] Strip file/function/config-name detail from the "Explanatory tooltips" section in
      `README.md`, condense to 1–3 sentences, keep the existing `specs/020-explanatory-tooltips/`
      link (FR-004, R2)
- [x] T013 [US1] Trim `README.md`'s "Validation & aggregation scripts" section to a short pointer
      into `docs/developer-guide.md` (built in T002–T004), removing the duplicated walkthrough
      (R3)
- [x] T014 [US1] Re-order `README.md`'s sections to match [data-model.md](data-model.md)'s
      11-section target list (Getting started; Production build & deploy; Dynamic sky background;
      Global desktop info panel; Ereignisse page; Explanatory tooltips; Frontend tests; Data
      files; Validation & aggregation scripts pointer; CO2 emission-factor maintenance; License)
- [x] T015 [US1] Confirm `README.md`'s unchanged sections (Production build & deploy, Frontend
      tests, Data files, CO2 emission-factor table maintenance, License) still carry their
      existing external links — DeepWiki badge, live-app link, `LICENSE.md`, icon attribution —
      untouched (FR-011)

**Checkpoint**: `README.md` fully restructured and independently satisfies SC-001 (German mirror
and full parity checks land in Phase 5).

---

## Phase 4: User Story 2 - Find a specific dashboard feature in the user guide (Priority: P2)

**Goal**: A reader can locate any `docs/user-guide.md` topic within one click from its table of
contents, and structured option/filter lists read as tables.

**Independent Test**: Give a reader a feature name and ask them to find its explanation using only
the table of contents, without full-text search.

### Implementation for User Story 2

- [x] T016 [US2] Retitle `docs/user-guide.md`'s heading to drop "Validation & Aggregation
      Workflow" and reflect its end-user-only scope (FR-007)
- [x] T017 [US2] Add a numbered table of contents near the top of `docs/user-guide.md`, one entry
      per top-level section (Dashboard navigation & charts; Ereignisse page; Dynamic sky
      background; Global desktop info panel; Day view & welcome page auto-refresh; CO2 avoidance
      figures; Explanatory tooltips), each entry linking to its heading (FR-006)
- [x] T018 [US2] Convert the "Dashboard navigation & charts" section's option/mode lists in
      `docs/user-guide.md` to a markdown table (FR-009)
- [x] T019 [US2] Convert the "Ereignisse (events) page" section's four filter types in
      `docs/user-guide.md` to a markdown table (FR-009)
- [x] T020 [US2] Remove the "Prerequisites" through "Typical workflow" sections from
      `docs/user-guide.md` (now fully covered by `docs/developer-guide.md` from Phase 2) (FR-007)
- [x] T021 [US2] Confirm `docs/user-guide.md`'s remaining sections (Dynamic sky background, Global
      desktop info panel, Day view & welcome page auto-refresh, CO2 avoidance figures, Explanatory
      tooltips) keep end-user framing and match [data-model.md](data-model.md)'s 7-section order

**Checkpoint**: `docs/user-guide.md` is scoped to end-user tasks with a working TOC (SC-002);
combined with Phase 3, both P1 and P2 stories are independently functional.

---

## Phase 5: User Story 3 - Get the equivalent experience in German (Priority: P3)

**Goal**: `README.de.md` and `docs/user-guide.de.md` match their English counterparts in section
count, order, and topic, with a working language-toggle link pair on every file.

**Independent Test**: List the top-level section headings of each English document next to its
German counterpart and confirm they match in count, order, and topic.

**Dependency**: Requires Phase 3 (README.md final structure) and Phase 4 (user-guide.md final
structure) complete — this phase mirrors their finished shape, not a moving target.

### Implementation for User Story 3

- [x] T022 [P] [US3] Create `README.de.md` mirroring `README.md`'s final structure (title/badges,
      language toggle, opening description, features list, and all 11 numbered sections from
      [data-model.md](data-model.md)), German prose, with a "Deutsch · [English](README.md)"
      toggle link at the top (FR-005)
- [x] T023 [P] [US3] Create `docs/user-guide.de.md` mirroring `docs/user-guide.md`'s final
      structure (title, language toggle, numbered TOC, all 7 sections from
      [data-model.md](data-model.md)), German prose, with the same language-toggle link pair
      pointing at `docs/user-guide.md` (FR-008)
- [x] T024 [US3] Confirm `README.md`'s language-toggle link (added in T005) now resolves to the
      `README.de.md` created in T022 (FR-005)
- [x] T025 [US3] Confirm `docs/user-guide.md` carries a language-toggle link pair pointing at the
      `docs/user-guide.de.md` created in T023, matching FR-008

**Checkpoint**: All three user stories independently functional — EN/DE parity achieved (SC-003).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run the full quickstart.md validation checklist across the finished document set and
close out the feature.

- [x] T026 [P] Run [quickstart.md](quickstart.md) Check 3 (EN/DE structural parity) for
      `README.md`/`README.de.md` and `docs/user-guide.md`/`docs/user-guide.de.md` — expect zero
      mismatches (SC-003)
- [x] T027 [P] Run [quickstart.md](quickstart.md) Check 4 (no dead internal anchors) across all
      four restructured docs — expect no output from any `comm -23` line (SC-004)
- [x] T028 [P] Run [quickstart.md](quickstart.md) Check 5 (no dropped content) — cross-reference
      pre-overhaul README/user-guide headings (`git show HEAD:...`) against the new
      README/user-guide/developer-guide structure (SC-005)
- [x] T029 [P] Run [quickstart.md](quickstart.md) Check 6 (external links preserved) — confirm
      DeepWiki badge, live-app link, `LICENSE.md`, and icon attribution all still present in
      `README.md`/`README.de.md` (FR-011)
- [x] T030 Run [quickstart.md](quickstart.md) Checks 1–2 (README scan test, user-guide TOC test)
      manually for both English and German documents (SC-001, SC-002)
- [x] T031 Update `**Status**` in [spec.md](spec.md) from `Draft` to `Implemented` (only once every
      task above is checked off `[X]`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS the trim/removal steps in Phases 3 and 4
  (T013, T020) but not the rest of those phases' tasks
- **User Story 1 (Phase 3)**: Depends on Foundational for T013 only; T005–T012, T014–T015 can
  start once Phase 1 is done
- **User Story 2 (Phase 4)**: Depends on Foundational for T020 only; T016–T019, T021 can start
  once Phase 1 is done
- **User Story 3 (Phase 5)**: Depends on Phase 3 AND Phase 4 being fully complete (mirrors their
  finished structure)
- **Polish (Phase 6)**: Depends on Phases 3, 4, and 5 all complete

### User Story Dependencies

- **User Story 1 (P1)**: Independently testable once Phase 2's T002–T004 exist for its T013
  pointer to target
- **User Story 2 (P2)**: Independently testable once Phase 2's T002–T004 exist for its T020
  removal to be safe
- **User Story 3 (P3)**: Depends on US1 and US2's final English structure — not independently
  startable before both are done

### Within Each Phase

- All Phase 3 tasks edit `README.md` — sequential, no [P]
- All Phase 4 tasks edit `docs/user-guide.md` — sequential, no [P]
- All Phase 2 tasks edit `docs/developer-guide.md` — sequential, no [P]
- Phase 5's T022/T023 touch different files — parallelizable
- Phase 6's T026–T029 are read-only checks against already-finished files — parallelizable

### Parallel Opportunities

- T022 and T023 (Phase 5) can run in parallel — different files
- T026, T027, T028, T029 (Phase 6) can run in parallel — independent read-only checks

---

## Parallel Example: User Story 3

```bash
# Launch both German mirrors together (different files):
Task: "Create README.de.md mirroring README.md's final structure"
Task: "Create docs/user-guide.de.md mirroring docs/user-guide.md's final structure"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (needed for T013's pointer, even for an English-only MVP)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Hand-test `README.md` against SC-001
5. Ship the restructured English README as a standalone improvement if needed

### Incremental Delivery

1. Setup + Foundational → developer-guide.md ready
2. Add User Story 1 → validate independently → `README.md` done (MVP)
3. Add User Story 2 → validate independently → `docs/user-guide.md` done
4. Add User Story 3 → validate independently → EN/DE parity done
5. Phase 6 → full quickstart.md pass → feature complete

### Parallel Team Strategy

With multiple contributors:

1. Together: Setup + Foundational (`docs/developer-guide.md`)
2. Once Foundational is done: one contributor takes Phase 3 (`README.md`), another takes Phase 4
   (`docs/user-guide.md`) — no file overlap between them
3. Once both finish: split Phase 5's T022/T023 (different files) between two contributors
4. Together: Phase 6 validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test tasks — this is a docs-only feature with no Playwright/`node --test` coverage
  (plan.md Technical Context); validation is quickstart.md's checklist in Phase 6
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: editing the same file from two "parallel" tasks; starting Phase 5 before Phases 3–4 are
  both finished
