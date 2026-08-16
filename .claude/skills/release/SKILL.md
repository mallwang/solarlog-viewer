---
name: release
description: Guided release workflow using release-it — dry-run preview, confirmation gate, version bump, changelog, git tag, and GitHub Release notes. Use when the user asks to "release", "cut a release", "make a release", or "bump the version".
---

# Skill: Guided Release Workflow

Guides the developer through a human-reviewed release using `release-it`. Runs a dry-run preview,
asks for explicit confirmation, executes the release, verifies the result, and outputs formatted
GitHub Release notes.

This app has no npm registry publish and no Docker image — it's a static site FTP'd to the
SolarLog device (see `scripts/ftp-sync.js` / the `sync-ftp` skill). A release here only means:
bump `package.json`'s version, update `CHANGELOG.md`, and create a `vX.Y.Z` git tag. It does
**not** build or deploy the site — run `npm run build` and the `sync-ftp` skill separately if a
deploy is also wanted.

## Steps

### Step 1 — Branch check

Run:

```bash
git branch --show-current
```

If the output is not `main`, abort immediately with:

> "Must be on main branch to release. Currently on: `<branch>`."

### Step 2 — Clean working tree check

Run:

```bash
git status --porcelain
```

If the output is not empty, abort with:

> "Working tree has uncommitted changes — commit or stash before releasing."

List the dirty files from the output so the developer knows what to address.

### Step 3 — Dry-run preview

Run:

```bash
npx release-it --ci --dry-run
```

**Do not** use `npm run release -- --dry-run`. The `release` script is `release-it --ci`, and npm
forwards extra args with a literal `--` separator, producing `release-it --ci -- --dry-run`.
release-it's CLI parser then treats `--dry-run` as a positional argument (an invalid
version-increment override) instead of the dry-run flag, so it silently performs a **real**
release — commit, tag, and push included. Calling `release-it` directly via `npx` avoids the
extra `--` entirely.

Display the **full output** to the developer. This shows the proposed version bump and the
changelog entries that will be included. Every git-mutating line (npm version, git commit, git
tag, git push) must be prefixed with `!` in the output, meaning release-it is only describing the
action, not executing it. If any of those lines appear with a ✔ checkmark instead of a leading
`!`, the dry run actually executed — stop immediately and tell the developer:

> "The dry-run executed a real release instead of previewing one. Do not proceed — inspect
> `git log` and `git tag` for unexpected new commits/tags before doing anything else."

If the output contains "Nothing to release" or indicates no releasable commits exist, abort with:

> "Nothing to release — no conventional commits found since the last tag."

### Step 4 — Confirmation gate

Ask the developer:

> "Proceed with release? (yes/no)"

- If the answer is **no** (or anything other than yes/y): abort with "Release cancelled."
- If the answer is **yes** / **y**: continue to Step 5.

### Step 5 — Run release

Run:

```bash
npx release-it --ci
```

Wait for the command to complete. Display the output.

### Step 6 — Verify result

After the release command completes:

1. Read `package.json` at the workspace root and extract the `version` field.
2. Confirm the version matches the proposed bump shown in Step 3.
3. Read `CHANGELOG.md` at the workspace root and confirm a section header for the new version
   exists (e.g., `## [1.1.0]`).

If either check fails, report the discrepancy clearly and stop:

> "Release verification failed: `<specific issue>`. Please investigate before pushing."

### Step 7 — Generate GitHub Release output

1. Extract the new version's section from `CHANGELOG.md`:
   - Start from the line containing the new version header (e.g., `## [1.1.0]`)
   - End just before the next version header (or end of file if this is the first release)
2. Format the **GitHub Release title**: `v<version>` (e.g., `v1.1.0`)
3. Format the **GitHub Release body** as the extracted CHANGELOG section in markdown.

Present the output in clearly labelled blocks:

---

**GitHub Release Title** (copy this):

```
v<version>
```

**GitHub Release Body** (copy this):

```markdown
<extracted changelog section>
```

---

### Step 8 — Final step

`git.push` is enabled in `.release-it.json`, so Step 5 already pushed the release commit and tag
to GitHub — no manual `git push` needed. `github.release` is disabled, so the GitHub Release
itself still needs to be created by hand. Present the following instruction to the developer:

> The release commit and tag `v<version>` have been pushed. Create the GitHub Release:
>
> 1. Go to the repository on GitHub → **Releases** → **Draft a new release**
> 2. Select the tag `v<version>`
> 3. Paste the **GitHub Release Title** and **GitHub Release Body** from above
> 4. Click **Publish release**
>
> This does not build or deploy the site. To ship the release, run `npm run build` and then the
> `sync-ftp` skill (or `npm run ftp:diff` to preview what would change).
