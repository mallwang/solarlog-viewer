# Phase 0 Research: Remove SQLite Data Store

## Decision: Full removal, not gradual deprecation

**Decision**: Delete `scripts/sync-sqlite.js`, `scripts/sync-sqlite.test.js`,
the `sync:sqlite` npm script, and any generated `data/solarlog.sqlite3` file
outright, in this feature — not behind a deprecation warning or staged
removal.

**Rationale**: The feature description confirms the SQLite idea "is not
valid anymore" and the user asked for a "holistic cleanup." Inspection
confirms the script has no other in-repo consumers (see below), so there is
no migration path to stage — it is dead code with zero callers.

**Alternatives considered**: A soft-deprecation (keep the script, print a
warning) was rejected — it would leave the misleading artifact in place,
which is exactly the problem being fixed (spec User Story 1).

## Decision: No external dependency to remove from `package.json`

**Decision**: No `devDependencies`/`dependencies` entry needs removal beyond
the `sync:sqlite` script line.

**Rationale**: `scripts/sync-sqlite.js` imports `DatabaseSync` from the
Node.js built-in `node:sqlite` module (stable/experimental core API, not an
npm package). `package.json` was checked and lists no `better-sqlite3`,
`sqlite3`, or similar third-party driver.

**Alternatives considered**: N/A — confirmed by direct inspection, not a
judgment call.

## Decision: No dependents to update (FR-008 verification)

**Decision**: No other script or module imports `scripts/sync-sqlite.js` or
`scripts/sync-sqlite.test.js`.

**Rationale**: `grep -rl "sync-sqlite" scripts/ web/` returns only the two
files themselves. Safe to delete without touching any other file's imports.

**Alternatives considered**: N/A — confirmed by direct inspection.

## Decision: `.gitignore` and `README.md`/`README.de.md` need no edit unless verified otherwise

**Decision**: As of 2026-08-18, `.gitignore` contains no SQLite-specific
entries (`grep -i "sqlite\|\.db"` returns nothing), and `README.md` contains
no "sqlite" mentions. Treat these as VERIFY-only steps in `tasks.md` (confirm
still true at implementation time, edit only if a reference has since
appeared), not guaranteed edits.

**Rationale**: Avoids the plan asserting file changes that inspection shows
are unnecessary; keeps the task list honest about what actually needs
touching.

**Alternatives considered**: Pre-writing edits for files that currently have
nothing to change was rejected as speculative/inaccurate.

## Decision: `CLAUDE.md` does need an edit

**Decision**: `CLAUDE.md`'s "Local Development Server" section currently
says: "Filesystem-reading scripts (backfill, `gap:detect`, sqlite sync) are
**not** covered by this proxy..." — the "sqlite sync" mention must be
removed from this list once the script no longer exists.

**Rationale**: Direct inspection confirms this reference exists today and
would become stale/misleading (pointing at a deleted script) if left as-is
— exactly the FR-004 requirement.

**Alternatives considered**: N/A.

## Decision: Constitution amendment is in-scope, executed via `/speckit-constitution`

**Decision**: Retract the SQLite narrow-exception language from
`.specify/memory/constitution.md` (Principle I, Principle III, Technical
Standards → Backend, Modernization Scope) as part of this feature's task
list, run through the project's normal `/speckit-constitution` amendment
flow rather than hand-edited inline here. Version bump: **MINOR** (a
material contraction of existing guidance — reverting an explicit permitted
exception back to the stricter default — not the removal of an entire
principle, which would be MAJOR per the constitution's own versioning
policy).

**Rationale**: Constitution Governance section requires any task that
conflicts with a documented principle/exception to go through the amendment
procedure before implementation proceeds. Leaving the constitution's SQLite
exception text in place while deleting the code it describes would recreate
the exact "stale, misleading instructions" problem this feature exists to
fix, just relocated into the governance document.

**Alternatives considered**:

- _Leave the constitution exception text in place, delete only the code_:
  rejected — directly contradicts the feature's own goal (spec FR-004/FR-007)
  and the constitution's own governance rule.
- _Treat this as a MAJOR bump_: rejected — no principle is being removed or
  fundamentally redefined; Principle I/III's core rules (`.js` files are
  truth, no backend) are unchanged and in fact reinforced. This is a scope
  contraction of a narrow exception, matching the constitution's own
  definition of MINOR ("material expansion **or contraction** of existing
  guidance" is treated symmetrically with the MINOR bumps already used for
  the Tailwind and bundler exceptions being _added_).

## Decision: `specs/004-sqlite-meter-sync/` is relabeled, not deleted

**Decision**: Edit only the `**Status**:` line (and add one pointer sentence)
of `specs/004-sqlite-meter-sync/spec.md` to read something like "Abandoned —
superseded by 024-remove-sqlite-cleanup, see that spec for rationale." Leave
`plan.md`, `research.md`, `data-model.md`, `contracts/`, `tasks.md`,
`quickstart.md`, and `checklists/` in that folder untouched as historical
record.

**Rationale**: Matches spec User Story 3 / FR-006 — preserves institutional
memory of a considered-and-rejected design without leaving it looking like
active, actionable guidance.

**Alternatives considered**: Deleting the folder outright was rejected per
explicit spec requirement (FR-006) and the user's own framing ("holistic
cleanup", not "erase history").
