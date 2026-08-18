# Quickstart: Validate SQLite Removal

Run these checks after implementation to confirm the cleanup is complete and
nothing else broke.

## Prerequisites

- Repository checked out on branch `024-remove-sqlite-cleanup`
- `npm install` already run

## 1. No SQLite references remain in active code/docs

```bash
grep -rin "sqlite" package.json CLAUDE.md README.md README.de.md scripts/ 2>/dev/null
```

**Expected**: no output (zero matches). `.specify/memory/constitution.md`
should also no longer mention SQLite as a permitted exception — check with:

```bash
grep -in "sqlite" .specify/memory/constitution.md
```

**Expected**: no output.

## 2. No SQLite files remain on disk

```bash
find . -iname "*.sqlite*" -o -iname "*.db" | grep -v node_modules
```

**Expected**: no output.

## 3. No stale npm script

```bash
npm run 2>&1 | grep -i sqlite
```

**Expected**: no output — `sync:sqlite` no longer listed.

## 4. Retired spec is clearly marked

```bash
head -n 10 specs/004-sqlite-meter-sync/spec.md
```

**Expected**: the `**Status**:` line reads something like "Abandoned —
superseded by 024-remove-sqlite-cleanup", not "Draft" or blank.

## 5. Nothing else broke

```bash
npm run lint
npm run format:check
npm run test:scripts
```

**Expected**: all three exit 0. (`sync-sqlite.test.js` should simply be gone
from the `test:scripts` glob, not failing within it.)
