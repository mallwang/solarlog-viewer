---
name: generate-pr
description: Generate a conventional-commit PR title and copy-paste-ready markdown PR description from the current branch's diff against main. Use when asked to "generate a PR description", "write a pull request", "create PR title", or "draft PR".
---

# Generate Pull Request Description

Produces a conventional-commit PR title and a structured markdown PR description by analysing the diff of the current branch against `main`.

## Steps

### 1. Gather git context

Run these commands (they are fast and safe):

```bash
git log main...HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Use the log to understand the sequence of commits and spot the overall intent.
Use the stat to identify which packages/directories changed.
Use the full diff to understand what specifically changed in each file.

### 2. Produce the PR title

Format: `<type>(<scope>): <short imperative summary>`

**Type** — pick one:

- `feat` — new user-visible behaviour
- `fix` — bug fix
- `refactor` — no behaviour change
- `test` — tests only
- `docs` — documentation / spec files only
- `chore` — tooling, config, deps
- `ci` — CI / build pipeline

**Scope** — the tightest meaningful grouping, e.g. a package name (`contracts`, `dashboard`, `shared`) or a cross-cutting concern (`db`, `auth`). Omit if the change is truly repo-wide.

**Summary** — imperative mood, ≤60 chars, no period. Describes the _what_ a developer cares about, not an implementation detail.

Example: `feat(contracts): add startDate, details, serviceUrl, and cancellationPeriod fields`

### 3. Produce the PR description

Output **only** the markdown block below — no preamble, no explanation. The user will copy-paste it directly into GitHub.

Follow this structure exactly:

```markdown
## Summary

- <bullet 1 — user-visible behaviour or high-level change>
- <bullet 2>
- <bullet 3, if applicable>

## What changed

**<Package or layer name>** (`<npm scope / path if applicable>`)

- `<file or symbol>`: <one-line description of the change>
- …

**<Next package or layer>**

- …
```

**Rules for Summary bullets:**

- 2–4 bullets maximum
- Each bullet covers one coherent user-facing or architectural change
- Mention concrete artefacts (field names, enum values, endpoints) when they fit in one line
- Write in present tense ("Adds X", "Normalises Y", "Migrates Z automatically")

**Rules for What changed sections:**

- Group by package or architectural layer (Shared, Backend, Frontend, Specs, CI, …)
- Include the npm scope or path in parentheses only when it adds clarity
- List only files/symbols that are non-trivially changed — skip generated lock files, minor formatting
- Each bullet: backtick the filename or symbol, colon, plain-English change
- Keep spec/docs files in their own section (e.g. **Specs**) so reviewers can skip them

### 4. Output format

Wrap the entire output in a single triple-backtick code fence so the user can copy raw markdown and paste it directly into GitHub's PR form. The fence itself must not have a language tag. Print the title on its own line inside the fence, then a blank line, then the markdown description. Example:

````
```
feat(contracts): add startDate, details, serviceUrl, and cancellationPeriod fields

## Summary

- Adds four new optional fields to contracts: `startDate`, `details`, `serviceUrl`, and `cancellationPeriod` (with value + unit)
- Backend stores the fields in SQLite and migrates existing databases via `ALTER TABLE` at startup
- Frontend form and table updated to expose and display all new fields

## What changed

**Shared** (`@pcm/shared`)
- `types/contract.ts`: added `CancellationPeriodUnit` const enum (`DAYS` | `WEEKS` | `MONTHS`) and `CancellationPeriod` interface
- `schemas/contract.ts`: added `CancellationPeriodUnitSchema`, `CancellationPeriodSchema`; extended `ContractSchema`, `CreateContractBodySchema` with `startDate`, `details`, `serviceUrl`, `cancellationPeriod`

**Backend**
- `schema.sql`: new columns `start_date`, `details`, `service_url`, `cancellation_period_value`, `cancellation_period_unit`
- `client.ts`: `runMigrations` adds missing columns via `ALTER TABLE IF NOT EXISTS`; `ContractRow` updated
- `contract.ts`: SQL queries and `rowToContract` updated for all new fields

**Frontend**
- `ContractForm`: added inputs for all four new fields; cancellation period rendered as value + unit pair
- `ContractEdit`: `defaultValues` extended with new fields

**Specs**
- `specs/004-contract-fields-enhancement/`: spec, plan, tasks, data-model, API docs, quickstart, requirements checklist added
```
````

## Notes

- Ignore commits whose messages start with `[Spec Kit]` or `docs(spec-kit):` when deriving the PR title — those are housekeeping commits added by tooling.
- If the diff contains only spec/docs changes, use type `docs` and scope `specs`.
- Do not include a "Test plan" section — the project's CI covers that.
