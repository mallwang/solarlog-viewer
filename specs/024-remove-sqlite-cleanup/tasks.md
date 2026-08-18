# Tasks: Remove SQLite Data Store

**Input**: Design documents from `/specs/024-remove-sqlite-cleanup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not requested for this feature (deletion/documentation cleanup only — see plan.md Testing section). `npm run test:scripts` must continue to pass unchanged; no new test tasks are generated.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent verification of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task

## Path Conventions

Single project at repository root: `scripts/`, `web/`, `.specify/memory/`, `specs/`, plus top-level `package.json`, `CLAUDE.md`, `README.md`, `.gitignore`.

---

## Phase 1: Setup

**Purpose**: No project initialization is needed — this is a deletion/documentation cleanup on an already-configured repo.

- [ ] T001 Confirm current state matches research.md's inspection findings by running `grep -rin "sqlite" package.json CLAUDE.md README.md README.de.md .gitignore scripts/ .specify/memory/constitution.md` and `find . -iname "*.sqlite*" -o -iname "*.db" | grep -v node_modules`, from repo root; note which of `.gitignore`/`README.md`/`README.de.md` actually need edits (research.md found none as of 2026-08-18, but confirm it's still true)

**Checkpoint**: Setup complete — exact scope of Phase 3+ edits confirmed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Retract the SQLite narrow-exception language from the project constitution via the amendment procedure. Per plan.md's Constitution Check gate, this MUST happen before (or alongside) the code deletion in the user stories below — deleting the code while the constitution still documents the exception would leave governance text contradicting reality.

**⚠️ CRITICAL**: No user story deletion work should be considered complete until this phase is also complete — both must land together so the constitution never contradicts the working tree.

- [ ] T002 Run `/speckit-constitution` to amend `.specify/memory/constitution.md`: retract the SQLite narrow-exception clauses in Principle I ("Narrow exception — local SQLite cache", line ~80), Principle III (SQLite database for developer tooling mention, lines ~47-51), Technical Standards → Backend section (line ~228, "A local SQLite cache populated by an offline sync script..."), and Modernization Scope (line ~157, 169: "Optional: a local SQLite cache..." in-scope bullet and the "may store derived aggregates" out-of-scope carve-out); bump version MINOR (material contraction of existing guidance, not removal of a whole principle) per research.md's Decision: Constitution amendment is in-scope
- [ ] T003 Verify `grep -in "sqlite" .specify/memory/constitution.md` returns no output after T002

**Checkpoint**: Constitution no longer documents SQLite as a permitted exception — code/doc deletion in Phase 3+ can now proceed without contradicting governance text

---

## Phase 3: User Story 1 - Maintainer no longer sees a dead data-storage path (Priority: P1) 🎯 MVP

**Goal**: Remove every script, npm command, and active-doc reference to the SQLite sync workflow so nothing points a maintainer or AI agent toward it.

**Independent Test**: Search the repository for SQLite references (scripts, `package.json` commands, docs) and confirm none remain outside historical/archived records; `npm run` shows no SQLite-related command.

### Implementation for User Story 1

- [ ] T004 [US1] Verify no other script or module depends on `scripts/sync-sqlite.js` by running `grep -rl "sync-sqlite" scripts/ web/` from repo root and confirming only `scripts/sync-sqlite.js` and `scripts/sync-sqlite.test.js` themselves match (FR-008 / research.md's Decision: No dependents to update)
- [ ] T005 [P] [US1] Delete `scripts/sync-sqlite.js`
- [ ] T006 [P] [US1] Delete `scripts/sync-sqlite.test.js`
- [ ] T007 [US1] Remove the `"sync:sqlite": "node scripts/sync-sqlite.js"` line from the `scripts` block in `package.json`
- [ ] T008 [US1] Remove the "sqlite sync" mention from the Filesystem-reading-scripts sentence in the Local Development Server section of `CLAUDE.md`, leaving "backfill, `gap:detect`" and the rest of the sentence intact
- [ ] T009 [US1] Verify `grep -in "sqlite" package.json CLAUDE.md` (and `README.md`, `README.de.md` if T001 found references there) returns no output, and `npm run 2>&1 | grep -i sqlite` returns no output

**Checkpoint**: User Story 1 fully satisfied — no active script, npm command, or doc points to SQLite. Independently verifiable via the Independent Test above.

---

## Phase 4: User Story 2 - No leftover SQLite artifacts on disk (Priority: P2)

**Goal**: Remove any generated SQLite database file(s) from the working tree, and any now-unnecessary `.gitignore` entries.

**Independent Test**: Confirm no `*.sqlite*`/`*.db` files remain in the repository, and `.gitignore` carries no SQLite-specific entries.

### Implementation for User Story 2

- [ ] T010 [P] [US2] Delete the generated artifact `data/solarlog.sqlite3` from the working tree
- [ ] T011 [US2] Remove any SQLite-specific entries from `.gitignore` if T001 found any (research.md found none as of 2026-08-18 — skip the edit, keep this task as a re-verification, if none are found)
- [ ] T012 [US2] Verify `find . -iname "*.sqlite*" -o -iname "*.db" | grep -v node_modules` returns no output

**Checkpoint**: User Story 2 fully satisfied — zero SQLite files anywhere in the working tree. Independently verifiable via the Independent Test above, and combinable with US1's checkpoint.

---

## Phase 5: User Story 3 - Retired spec is clearly marked, not silently deleted (Priority: P3)

**Goal**: Mark `specs/004-sqlite-meter-sync/spec.md` as abandoned/superseded without deleting it or its supporting files.

**Independent Test**: Open `specs/004-sqlite-meter-sync/spec.md` and confirm it carries a clear "Superseded/Abandoned" status marker and a pointer to this cleanup spec.

### Implementation for User Story 3

- [ ] T013 [US3] Edit the `**Status**:` line of `specs/004-sqlite-meter-sync/spec.md` (currently "Done") to read "Abandoned — superseded by 024-remove-sqlite-cleanup, see that spec for rationale."; leave the rest of the file (plan.md, research.md, data-model.md, contracts/, tasks.md, quickstart.md, checklists/ in that folder) untouched as historical record

**Checkpoint**: User Story 3 fully satisfied — retired spec's status is unambiguous within 10 seconds of opening the file (SC-004). Independently verifiable via the Independent Test above.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final repo-wide validation that the cleanup is complete and nothing else broke.

- [ ] T014 Run `npm run lint` and `npm run format:check` and confirm both exit 0
- [ ] T015 Run `npm run test:scripts` and confirm it exits 0 (`sync-sqlite.test.js` simply absent from the glob, not failing within it)
- [ ] T016 Run the full quickstart.md validation end-to-end (`specs/024-remove-sqlite-cleanup/quickstart.md` sections 1-5) and confirm every "Expected: no output" / exit-0 check holds
- [ ] T017 Update `**Status**` in `specs/024-remove-sqlite-cleanup/spec.md` from `Draft` to `Implemented` (only once every task above is checked off `[X]`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001's findings inform T002's exact edit scope) — BLOCKS nothing structurally, but per the Constitution Check gate MUST land together with (not strictly before) the deletions in Phase 3+; recommended order is still Phase 2 first so the constitution never lags behind the code
- **User Story 1 (Phase 3)**: Can start after Phase 1; independent of Phase 2/US2/US3 content-wise, but T009's "no output" check is strongest once Phase 2 has also landed
- **User Story 2 (Phase 4)**: Can start after Phase 1; fully independent of US1 and US3 (different files)
- **User Story 3 (Phase 5)**: Can start after Phase 1; fully independent of US1 and US2 (different file)
- **Polish (Phase 6)**: Depends on Phases 2, 3, 4, and 5 all being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 or US3 — independently testable
- **User Story 2 (P2)**: No dependency on US1 or US3 — independently testable
- **User Story 3 (P3)**: No dependency on US1 or US2 — independently testable

### Within Each Story

- T004 (dependent-check) before T005/T006 (deletion) in US1
- T005/T006/T007/T008 (edits) before T009 (verification) in US1
- T010/T011 (edits) before T012 (verification) in US2

### Parallel Opportunities

- T005 and T006 (both file deletions in `scripts/`) can run in parallel
- Once Phase 1 (Setup) completes, Phase 2, Phase 3 (US1), Phase 4 (US2), and Phase 5 (US3) can all be worked in parallel — they touch disjoint files (`.specify/memory/constitution.md` vs. `scripts/`+`package.json`+`CLAUDE.md` vs. `data/`+`.gitignore` vs. `specs/004-sqlite-meter-sync/spec.md`)
- T010 (US2) and the whole of US1/US3 can run in parallel — no shared files

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# After T004 confirms no dependents:
Task: "Delete scripts/sync-sqlite.js"
Task: "Delete scripts/sync-sqlite.test.js"
```

## Parallel Example: Across Stories (after Phase 1)

```bash
Task: "Amend .specify/memory/constitution.md via /speckit-constitution (Phase 2)"
Task: "Delete scripts/sync-sqlite.js and scripts/sync-sqlite.test.js, edit package.json and CLAUDE.md (Phase 3 / US1)"
Task: "Delete data/solarlog.sqlite3, verify .gitignore (Phase 4 / US2)"
Task: "Relabel specs/004-sqlite-meter-sync/spec.md status (Phase 5 / US3)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (constitution amendment — required by the Constitution Check gate before the deletions are considered fully compliant)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run US1's Independent Test
5. This alone satisfies the feature's core motivation (spec's "Why this priority" for US1)

### Incremental Delivery

1. Setup + Foundational → constitution amended, ready to delete
2. Add User Story 1 → verify independently → no more misleading scripts/docs (MVP!)
3. Add User Story 2 → verify independently → no more leftover artifacts
4. Add User Story 3 → verify independently → retired spec clearly marked
5. Polish → full quickstart.md pass, spec Status flipped to Implemented

### Parallel Team Strategy

With multiple contributors, after Phase 1 (Setup):

- Contributor A: Phase 2 (constitution amendment)
- Contributor B: Phase 3 (US1 — script/npm/CLAUDE.md removal)
- Contributor C: Phase 4 (US2 — artifact/.gitignore removal)
- Contributor D: Phase 5 (US3 — retired spec relabel)

All four touch disjoint files and can land as independent commits before Phase 6 (Polish) ties them together.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature has no test tasks — deletion/documentation cleanup only, per plan.md's Testing section
- Verify-only tasks (T001, T011) are here because research.md found no `.gitignore`/README edits needed as of 2026-08-18; re-check at implementation time rather than assuming
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: deleting `specs/004-sqlite-meter-sync/` outright (FR-006 forbids it — relabel only)
