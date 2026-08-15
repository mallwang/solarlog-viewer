# Phase 0 Research: Documentation Overhaul

## R1 — Structural reference: klaro README/user-guide style

**Decision**: Adopt a two-tier structure per language: README = short intro paragraph(s) → a
scannable features list → a getting-started/dev-server section with copy-paste commands, near the
top → brief feature call-outs (1–3 sentences each, no file/function names) that link to
`docs/user-guide.md` (end-user depth) or `specs/NNN-*/` (implementation depth) → a small
tech-stack-and-links tail (license, attribution, DeepWiki badge). User guide = numbered H2
sections, each linked from a table of contents at the top, with a per-doc-audience scope (this
guide: end-user dashboard tasks only).

**Rationale**: Matches the spec's explicit reference project and the acceptance scenarios in User
Story 1 (SC-001: purpose + run-commands from the opening section alone) and User Story 2 (SC-002:
one-click TOC navigation). Both are testable, mechanical properties, not subjective style
opinions, so a consistent template satisfies them regardless of exact prose.

**Alternatives considered**: Single combined README+guide document — rejected, spec explicitly
keeps README and user-guide as separate documents with separate audiences (FR-003, FR-007).
Auto-generated TOC via a tool (e.g. `doctoc`) — rejected as a new dependency for a one-time,
manually-maintained restructuring (spec Assumptions: "one-time structural overhaul... not
something this feature automates"); a hand-written numbered list is sufficient at this section
count (~10–13 top-level sections per doc).

## R2 — Destination for implementation detail stripped from README feature sections

**Decision**: Existing feature sections (Dynamic sky background, Global desktop info panel,
Ereignisse page, Explanatory tooltips) already end with a `See specs/NNN-.../ for the full
spec/plan` link. Keep that link, delete everything above it that names a specific file, function,
CSS selector, or config constant, and replace it with 1–3 plain-language sentences describing what
the feature does and why it matters to a reader deciding whether to look further.

**Rationale**: `docs/architecture.md` was inspected and found to document the **legacy**
pre-modernization frameset site (frameset entry points, `diagram.js` pixel-math engine, etc.) —
not the modernized app these README sections describe. Redirecting detail there would be
factually wrong. The `specs/NNN-*/` directories already contain the authoritative plan/data-model
for each modernized feature and are already linked; FR-004's "must remain available in the
existing developer docs" is satisfied without writing new content, only by not deleting the
existing links.

**Alternatives considered**: Add a new "Modernized Architecture" section to
`docs/architecture.md` — rejected as out of scope for this spec (spec's Edge Cases and FR-004 only
require detail to _relocate somewhere already linkable_, not that a new architecture document be
authored; that would be a separate, larger feature). Delete the detail with no link at all —
rejected, violates FR-004 and FR-012 (nothing may be silently dropped).

## R3 — Destination for developer-facing script docs currently in `docs/user-guide.md`

**Decision**: New file `docs/developer-guide.md` (English only — see plan.md Complexity Tracking)
receives the "Prerequisites" through "Typical workflow" sections currently in
`docs/user-guide.md` (gap-detect, validate-plausibility, fill-days-hist, fill-months, fill-years,
the Claude Code agentic-skill shortcuts). `README.md`'s existing "Validation & Aggregation
Scripts" section — which already duplicates most of this content — is trimmed to a short pointer
into the new doc instead of carrying the full duplicate walkthrough inline, consistent with
FR-002's "avoid inline duplication" spirit applied symmetrically.

**Rationale**: The user guide's own opening line ("User Guide: Validation & Aggregation Workflow")
already signals the doc has drifted from its end-user purpose — FR-007 requires it scoped to
dashboard tasks. The content isn't deletable (FR-012), and README already has a natural,
lower-friction home for it since a near-duplicate section exists there already; consolidating into
one dedicated developer doc (rather than leaving the duplicate split across two files) removes the
duplication entirely rather than moving it once.

**Alternatives considered**: Move the content into `docs/architecture.md` — rejected, that file's
scope is the legacy site's architecture, not developer script usage. Leave it duplicated in both
README and user-guide as today — rejected, contradicts FR-007 directly (user guide MUST be
scoped to end-user tasks).

## R4 — Table conversion candidates (FR-009)

**Decision**: Convert to markdown tables: user-guide's event-page filter list (filter types →
what they narrow), the CO2/other stats-explanation groupings if presented as a list of
term→meaning pairs, and the developer-guide's script list (script name → purpose → example
command) carried over from README's existing bullet-per-script format. Any section already using
prose to describe a _single_ option (not a set) stays prose — FR-009 targets "a set of options,
fields, or filter/sort choices," not every sentence that happens to mention a config value.

**Rationale**: Directly implements FR-009 and mirrors the klaro reference's stated
table-for-structured-data style (spec Assumptions).

**Alternatives considered**: Convert everything possible to tables — rejected, over-applies FR-009
beyond its literal scope ("a set of options, fields, or filter/sort choices") and would make
narrative sections (e.g. the sky-background feature description) harder to read, not easier.

## R5 — Anchor-link and EN/DE parity validation approach

**Decision**: No new committed script. `quickstart.md` documents two one-off shell checks run
manually before considering the feature done: (1) extract `^#{1,6} ` headings from each EN/DE pair
and diff the topic lists (count/order/topic match, FR-005/FR-008/SC-003); (2) extract every
in-document `](#anchor)` reference per file and confirm each resolves to a slugified heading in
that same file (FR-010/SC-004).

**Rationale**: This is a one-time structural overhaul (spec Assumptions: "keeping the English and
German documents in sync going forward remains a manual process, not something this feature
automates"), so a permanent CI check or `scripts/*.js` helper (with the mandatory TDD/lint
overhead per CLAUDE.md) is disproportionate to a single restructuring pass. A documented manual
check is sufficient to satisfy SC-003/SC-004 once, at completion.

**Alternatives considered**: Write a committed `scripts/check-docs.js` — rejected as scope creep
for a docs-only feature; would itself need a spec/plan/tests per the constitution's Development
Workflow, which is disproportionate here. Revisit only if doc-sync regressions become a recurring
problem.
