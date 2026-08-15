# Implementation Plan: Documentation Overhaul

**Branch**: `021-documentation-overhaul` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-documentation-overhaul/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Restructure the four user-facing docs (`README.md`, `README.de.md`, `docs/user-guide.md`,
`docs/user-guide.de.md`) around a klaro-style split: a short, feature-first README that gets a
reader running the project in seconds and links out for depth, and a numbered,
table-of-contents-led user guide scoped strictly to end-user dashboard tasks. Implementation-level
detail currently embedded in README feature paragraphs is stripped out (the specs it already links
to remain the detail's home); developer-facing script/validation instructions currently mixed into
`docs/user-guide.md` relocate into a new `docs/developer-guide.md`. No application code changes —
this is a documentation-only restructuring with EN/DE parity as a hard requirement.

## Technical Context

<!--
  These fields are fixed for this repository (solarlog-viewer) — a single static web app with no
  backend, per .specify/memory/constitution.md. Only override a field below if this feature
  genuinely changes it (e.g. adds a real dependency, needs a constitution amendment for a new
  storage mechanism) — note the override and why. Performance Goals/Constraints/Scale still vary
  per feature and MUST be filled in for real, not left as the example text.
-->

**Language/Version**: N/A — this feature touches only Markdown documentation
(`README.md`/`README.de.md`/`docs/user-guide.md`/`docs/user-guide.de.md`, plus a new
`docs/developer-guide.md`). No application source changes.

**Primary Dependencies**: None added. No change to ApexCharts/Tailwind/vanilla-ES-module stack.

**Storage**: Unaffected — no change to `localStorage` usage, `.js` data files, or the SQLite cache.

**Testing**: No Playwright/`node --test` coverage applies (no UI-visible or logic change). Validation
is manual: a heading-parity check (EN vs. DE section lists) and an internal-anchor-link check
(every `[text](#anchor)` resolves to an existing heading in the same file), both scripted as
one-off `grep`/`node` checks in `quickstart.md` rather than a committed test file — there is no
ongoing logic to regression-test.

**Target Platform**: N/A — documentation only, no runtime/deployment surface touched.

**Project Type**: Single static web app (`web/`) — no change; this feature only touches
repo-root/`docs/` Markdown files.

**Performance Goals**: N/A — no runtime code.

**Constraints**: EN/DE structural parity (FR-005, FR-008) is mandatory and manually maintained
per the constitution's Documentation Standards (no automated sync tooling introduced — out of
scope per spec Assumptions). Zero dead internal anchors (FR-010, SC-004). Zero dropped content —
every feature currently documented must remain discoverable somewhere in the new structure
(FR-012, SC-005).

**Scale/Scope**: 4 existing files restructured (README.md, README.de.md, docs/user-guide.md,
docs/user-guide.de.md) + 1 new file created (docs/developer-guide.md, English; a German
counterpart is out of scope — see Complexity Tracking). ~1,160 lines of existing Markdown as the
starting point (293 + 312 + 270 + 285).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Documentation Standards → README**: This feature's entire purpose is keeping `README.md` and
  `README.de.md` consistent with each other — directly satisfies, doesn't conflict with, this
  principle. PASS.
- **Documentation Standards → User guides**: Same — `docs/user-guide.md`/`.de.md` consistency is
  a hard requirement (FR-008, SC-003). PASS.
- **Principle I–III, V–VI (data model, no backend, charting, five modes)**: Not implicated — no
  application code changes. N/A.
- **Principle IV (responsive layout)**: Not implicated — Markdown docs, not app UI. N/A.
- **Testing standard (Playwright per UI change)**: Not implicated — no UI-visible change. N/A.
- **Development Workflow → spec before plan, plan before code**: Followed — spec.md already
  exists and is being planned here before any file is edited.

No violations. No Complexity Tracking entries needed beyond the one documented deviation below
(German developer-guide deferred, not a constitution violation — the constitution's parity
requirement applies to the _README_ and _user guide_ pairs by name, not to every doc the project
adds).

## Project Structure

### Documentation (this feature)

```text
specs/021-documentation-overhaul/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — doc structure/section map
├── quickstart.md         # Phase 1 output (/speckit-plan command) — validation checklist
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — this feature exposes no API, CLI schema, or other machine-readable interface;
its "contract" is the section-structure mapping captured in `data-model.md` instead.

### Source Code (repository root)

<!--
  This repo has one fixed layout (below) — there is no frontend/backend or mobile/API split to
  choose between. ACTION REQUIRED: expand the tree with the actual new/changed files for this
  feature (mirroring how prior specs/*/plan.md did it), not just the unchanged skeleton.
-->

```text
README.md                  # CHANGED — restructured: concise intro/features, getting-started
                              near top, feature sections slimmed of implementation detail
README.de.md                # CHANGED — mirrored restructuring, German
docs/
├── user-guide.md            # CHANGED — numbered TOC added, developer script content removed,
│                                option/filter/field lists converted to tables
├── user-guide.de.md          # CHANGED — mirrored restructuring, German
├── developer-guide.md        # NEW — validation/aggregation script docs relocated from
│                                user-guide.md (Prerequisites → Typical workflow sections),
│                                English only (see Complexity Tracking)
├── architecture.md           # UNCHANGED — already covers the legacy pre-modernization site;
│                                implementation detail stripped from README stays discoverable via
│                                existing specs/*/  links each feature section already carries,
│                                not via this file
└── ...                        # other existing docs/ files unchanged

web/                          # UNCHANGED — no application code touched by this feature
scripts/                      # UNCHANGED
tests/e2e/                    # UNCHANGED — no new Playwright coverage needed (docs-only change)
```

**Structure Decision**: Pure documentation restructuring in place — no new top-level directory,
one new file (`docs/developer-guide.md`). `docs/architecture.md` is left untouched: it documents
the legacy frameset site, not the modernized app, so it is not the landing spot for detail
stripped out of README feature sections; that detail's existing home is the `specs/NNN-*/` dirs
each section already links to (FR-004 is satisfied by those links surviving the trim, not by new
architecture-doc content).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                                                                                   | Why Needed                                                                                                                                                                                                       | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/developer-guide.md` created English-only, no `docs/developer-guide.de.md` counterpart | The spec's EN/DE parity requirements (FR-005, FR-008) name only `README`/`README.de` and `user-guide`/`user-guide.de` explicitly; the constitution's Documentation Standards likewise name only those two pairs. | Producing a German developer-guide doubles translation effort for content aimed at developers running Node scripts from a terminal — a population that, unlike the plant-owner end user, is expected to read English technical docs. Adding it isn't precluded later; it's just not required by this spec. |
