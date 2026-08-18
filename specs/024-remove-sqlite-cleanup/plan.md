# Implementation Plan: Remove SQLite Data Store

**Branch**: `024-remove-sqlite-cleanup` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-remove-sqlite-cleanup/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Remove the abandoned SQLite developer-tooling cache (`scripts/sync-sqlite.js`,
`scripts/sync-sqlite.test.js`, the `sync:sqlite` npm script, and any generated
`data/solarlog.sqlite3` artifact) so the repository has exactly one documented,
hard-dependency data source: the SolarLog device's `.js` export files
(`min*.js` and related aggregates). Because the constitution currently
documents SQLite as an explicit, narrow-scoped _permitted exception_ in
Principle I, Principle III, and the Backend/Modernization-Scope sections, this
feature requires a **constitution amendment** to retract that exception before
(or alongside) the code/doc cleanup — per the Governance section's rule that
any task conflicting with a principle must be raised as an amendment first.
The retired spec `specs/004-sqlite-meter-sync/` is relabeled as
abandoned/superseded, not deleted.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules
(`type="module"`) — no bundler, no JS framework (constitution Technical
Standards → Frontend). This feature only _removes_ a Node.js CLI script; it
does not touch the browser-side ES module graph.

**Primary Dependencies**: None added. `scripts/sync-sqlite.js` used Node's
built-in `node:sqlite` module (no external npm package to remove from
`package.json` dependencies) — confirmed via inspection of `package.json`
devDependencies, which lists no SQLite driver.

**Storage**: Browser `localStorage` for user preferences (unaffected). The
SolarLog device's static `.js` data files under `web/data/` / `web/hist/`
remain the sole source of truth for plant data (constitution Principle I).
**Override for this feature**: the local SQLite cache previously permitted as
a narrow exception (`data/solarlog.sqlite3`, populated by
`scripts/sync-sqlite.js`) is being retracted entirely — this feature removes
that exception from both the codebase and the constitution text itself.

**Testing**: `node --test` (via `npm run test:scripts`) — after removal,
`scripts/sync-sqlite.test.js` no longer exists so it drops out of that glob
automatically; the rest of `npm run test:scripts` must still pass unchanged.
No Playwright test is added because this feature has no browser-visible UI
effect (constitution Testing standard only mandates Playwright for
UI-visible changes).

**Target Platform**: Static site, unaffected — this feature only removes a
Node-side CLI dev-tooling script, never something served to the browser.

**Project Type**: Single static web app (`web/`) plus `scripts/` CLI helpers
— no frontend/backend split, no server component (constitution Principle
III). This feature deletes one `scripts/` CLI helper and its test; no new
project type introduced.

**Performance Goals**: N/A — this is a deletion/documentation feature with no
runtime performance surface.

**Constraints**: Must not remove or weaken any _other_ dev-tooling script;
`scripts/gap-detect.js`, `scripts/ftp-sync.js`, backfill/fill scripts, etc.
are out of scope and must keep working exactly as before (verified via
`npm run test:scripts` and `npm run lint` passing post-removal).

**Scale/Scope**: Small, bounded cleanup: 2 source files deleted (~711 lines),
1 npm script entry removed, 1 generated artifact deleted if present, doc
edits in `CLAUDE.md`, `README.md` (only if it turns out to reference
sqlite), `.gitignore` (only if sqlite-specific entries exist), a status-only
edit to `specs/004-sqlite-meter-sync/spec.md`, and a constitution amendment
retracting three exception clauses.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / Section                   | Applies?          | How satisfied                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred   | Yes               | This feature does not touch `.js` data files at all; it removes the _SQLite_ narrow exception text from this principle. The core rule (`.js` files are source of truth, unmodified) is reinforced, not weakened.                                                                                                                                                                                                              |
| II. Zero Historical Data Loss         | Yes (reassurance) | No historical `.js` data is touched, moved, or deleted by this feature — only a derived, disposable cache and its sync tooling.                                                                                                                                                                                                                                                                                               |
| III. No Backend Introduction          | Yes               | Removes the SQLite narrow-exception clause; the site remains 100% static with zero backend, which is a _stricter_ reading of this principle, not a violation.                                                                                                                                                                                                                                                                 |
| Technical Standards → Backend         | Yes               | The paragraph permitting a local SQLite cache is removed; the section reverts to "no application server, no backend."                                                                                                                                                                                                                                                                                                         |
| Modernization Scope (Optional bullet) | Yes               | The "Optional: a local SQLite cache..." in-scope bullet and the corresponding "may store derived aggregates" out-of-scope carve-out are removed.                                                                                                                                                                                                                                                                              |
| Governance — Amendment procedure      | **Gate**          | Removing a documented, ratified exception is itself a change to constitution text and MUST go through the amendment procedure (open discussion → update constitution text → bump version → verify no spec/plan contradicts it) **before or alongside** implementation. This plan treats the amendment as Phase 0/1 work product (see `research.md`); the actual `/speckit-constitution` run is the first implementation task. |

**Result**: No violation of a _principle's substance_ — this feature narrows scope back toward the constitution's default, stricter posture (no backend, no non-`.js` data store). The one required gate is procedural: the constitution text itself must be amended (MINOR version bump — material contraction of existing guidance, not a removal of a whole principle) as part of this feature's implementation, before the exception-permitted code is actually deleted. See Complexity Tracking below — this is not a "violation to justify" but a required governance step, tracked so it isn't skipped.

## Project Structure

### Documentation (this feature)

```text
specs/024-remove-sqlite-cleanup/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — N/A, see note inside
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no new API, CLI contract, or
UI-facing interface — it only removes an internal dev-tooling script and
corrects documentation/governance text.

### Source Code (repository root)

```text
.specify/memory/
└── constitution.md        # AMEND: retract SQLite narrow-exception clauses in
                             Principle I, Principle III, Technical Standards →
                             Backend, and Modernization Scope; bump version.

scripts/
├── sync-sqlite.js          # DELETE
└── sync-sqlite.test.js     # DELETE

data/
└── solarlog.sqlite3        # DELETE (generated artifact, if present in working tree)

package.json                # EDIT: remove "sync:sqlite" script entry

CLAUDE.md                   # EDIT: remove "sqlite sync" mention in the dev-server
                              proxy-scope note (Local Development Server section)

README.md, README.de.md     # VERIFY: confirm no SQLite reference exists (spec's
                              own research found none as of 2026-08-18); edit if
                              a reference is found

.gitignore                  # VERIFY: confirm no SQLite-specific ignore entries
                              exist (spec's own research found none as of
                              2026-08-18); remove if found

specs/004-sqlite-meter-sync/spec.md   # EDIT: set Status to "Abandoned —
                                        superseded by 024-remove-sqlite-cleanup"
                                        with a one-line pointer; body left intact
                                        as historical record
```

**Structure Decision**: This is a deletion/documentation feature — no new
runtime modules under `web/js/`. All changes are confined to `scripts/`,
`package.json`, top-level docs, `.specify/memory/constitution.md`, and the
retired spec's status line. No new top-level directory is introduced.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation                                                 | Why Needed                                                                                                                                                                                                                                                                                                                     | Simpler Alternative Rejected Because                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Constitution text amendment required before code deletion | The SQLite cache is a _ratified, documented_ exception (Principle I, Principle III, Backend, Modernization Scope) — deleting the code while leaving the constitution claiming the exception still exists would leave the governance document contradicting reality, which the amendment procedure explicitly exists to prevent | Deleting the code without amending the constitution was rejected: it would leave stale, actively-misleading governance text (the same failure mode this whole feature exists to fix, just moved into `.specify/memory/constitution.md` instead of `scripts/`/docs) |
