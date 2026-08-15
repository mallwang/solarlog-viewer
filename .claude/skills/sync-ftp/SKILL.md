---
name: sync-ftp
description: Compare the remote SolarLog FTP web directory against the local dist/ build artifact and, only after explicit user approval, sync the differences in either direction. Use when asked to "sync ftp", "check what's changed on the FTP", or "upload/download to the SolarLog".
---

# Sync the local `dist/` build artifact with the remote FTP server

Diffs the remote FTP `web` directory (reachable only over VPN) against the
local `dist/` tree — the cache-busted production build produced from
`web/` by `npm run build` (`scripts/build.js`), not `web/` itself — by
file size, then transfers only what the user explicitly approves. Never
transfers anything automatically.

`dist/js/main-<sha>.js` and `dist/css/styles-<sha>.css` get a new
filename on every build (`<sha>` = current git short SHA), so a diff run
after any source change will always show those two as "upload" — that's
expected, it's the whole point (cache-busting), not a sign something's
wrong. `dist/data`/`dist/hist` are symlinks straight through to
`web/data`/`web/hist`, so those still behave exactly as before.

**Byte size decides whether a file is "in sync"** — modified time is
shown in the report but never used to flag a difference on its own. Many
FTP servers stamp a file's mtime with the moment it was uploaded rather
than preserving its original timestamp, so a file re-uploaded by hand (or
moved between filesystems) can show a drift of seconds to hours from its
local counterpart despite being byte-identical. Treating that drift as a
conflict would flood the report with false positives, so it's ignored;
mtime is only used to suggest a direction (upload vs. download) once a
real size difference already exists.

The one exception is paths listed in `.ftp-sync.json`'s
`mtimeSensitivePaths` (e.g. `data/min_cur.js`) — the SolarLog device
rewrites that file in place every 10 minutes without changing its size, so
a same-size comparison alone would wrongly call a stale local copy "in
sync". For those specific paths, a drifted mtime beyond the tolerance is
also treated as a real difference.

**Mtime can also point the wrong direction, not just under-report.** Once a
conflict exists, "newer mtime wins" assumes a fresher mtime means fresher
content — but a `git checkout`/revert, an editor save, or a filesystem move
bumps mtime to "now" without the content actually changing. For files the
SolarLog device alone generates (this project never legitimately hand-edits
or re-uploads them), local mtime being newer just means it was touched
locally, not that it's ahead of the device. Paths listed in
`.ftp-sync.json`'s `remoteAuthoritativePaths` always suggest `download` on
conflict, ignoring mtime entirely.

## Prerequisites

- VPN connection to the remote network must be active. If you're not sure,
  ask the user to confirm before proceeding — a failed connection attempt
  wastes a round trip.
- `.ftp-sync.json` must exist in the repo root (gitignored — copy
  `.ftp-sync.json.example` and fill in `host`, `user`, `password`,
  `remoteRoot`). If it's missing, tell the user and stop.

## Steps

### 1. Build `dist/`

```bash
npm run build
```

Regenerates `dist/` from the current `web/` source — must be run before
every diff/apply, since `dist/` is gitignored and not kept around between
sessions. Skipping this diffs/uploads a stale or missing `dist/`.

### 2. Confirm VPN is up

Ask the user to confirm the VPN is connected if it's not already clear from
context. Don't attempt the diff blind — a bad connection just times out
slowly.

### 3. Run the diff (read-only)

```bash
npm run ftp:diff
# equivalent: node scripts/ftp-sync.js --diff
```

This connects, recursively lists both trees, and writes the comparison to
`.ftp-sync-diff.json` (machine-readable) and `.ftp-sync-diff.html` (a
formatted table). The HTML report opens automatically in the default
browser (best-effort — pass `--no-open` to skip, e.g. in CI or headless
runs). Nothing is transferred in this step.

### 4. Present the diff to the user

Summarize what the command printed: counts of uploads (local-only files),
downloads (remote-only files), and conflicts (same path present on both
sides with a differing byte size). Show the full list grouped by action.
Call out conflicts specifically — each `[conflict]` line either has a
`suggested` direction (based on which side has the newer mtime) or is
`unresolved` (sizes differ but timestamps are equal/near-equal), which
needs a manual pick.

### 5. Human gate — ask before touching anything

Use `AskUserQuestion` (do not just proceed) to ask the user what to do,
offering choices like:

- Sync everything as suggested
- Uploads only
- Downloads only
- Pick specific files (ask which paths, and which direction for any
  unresolved conflicts)
- Abort — do nothing

This step is mandatory every run. Do not skip it even if the diff looks
small or "obviously" one-directional.

### 6. Apply only what was approved

```bash
# everything, using each entry's suggested direction
node scripts/ftp-sync.js --apply --yes

# only specific paths
node scripts/ftp-sync.js --apply --yes --only js/main-abc123.js,data/foo.json

# force a direction for a scoped set (e.g. resolving unresolved conflicts, or overriding a suggestion)
node scripts/ftp-sync.js --apply --yes --only data/foo.json --direction download
```

`--yes` is mandatory for `--apply` — the script refuses to transfer
anything without it. If any selected entry has no resolvable direction
(ambiguous conflict, no `--direction` given), the script fails and lists
which paths need a manual `--direction` — never guesses.

### 7. Verify

`--apply` automatically re-runs the diff afterward and prints a
convergence summary. Report the final state back to the user (fully in
sync, or what's still outstanding and why).

---

## Script reference: `scripts/ftp-sync.js`

```
node scripts/ftp-sync.js --diff
  # read-only: builds and prints the diff, writes .ftp-sync-diff.json
  # and .ftp-sync-diff.html, then auto-opens the HTML report
  [--no-open]                        # skip auto-opening the HTML report

node scripts/ftp-sync.js --apply --yes
  [--only <relPath1,relPath2,...>]   # scope to specific paths (default: all diffed paths)
  [--direction upload|download]      # override suggested direction for the scoped entries
  [--no-open]                        # skip auto-opening the post-apply HTML report
```

Config lives in `.ftp-sync.json` (gitignored, template at
`.ftp-sync.json.example`):

```json
{
  "host": "192.168.x.x",
  "port": 21,
  "user": "...",
  "password": "...",
  "remoteRoot": "/web",
  "includePaths": ["index.html", "favicon-v2.ico", "js", "i18n", "data", "css", "hist", "vendor"],
  "dirFilePatterns": {
    "data": [
      "base_vars.js",
      "days.js",
      "days_hist.js",
      "events.js",
      "events_day.js",
      "favicon-v2.ico",
      "ftpstat.csv",
      "min*.js",
      "months.js",
      "pm.csv",
      "pm.js",
      "years.js"
    ],
    "hist": ["days_hist.js", "days.js", "favicon-v2.ico", "min*.js", "months.js", "years.js"]
  },
  "mtimeSensitivePaths": ["data/min_cur.js"],
  "remoteAuthoritativePaths": [
    "data/days_hist.js",
    "data/events_day.js",
    "data/min_day.js",
    "data/min_cur.js",
    "data/days.js",
    "data/months.js",
    "data/years.js",
    "data/events.js",
    "data/ftpstat.csv",
    "data/pm.js",
    "data/pm.csv"
  ]
}
```

`includePaths` is a whitelist of root-level entries under `remoteRoot` /
`dist/` to walk. The remote `web` directory is shared hosting for unrelated
apps (e.g. a "reality"/hoymiles folder lives alongside this project's
files), so only these listed root files/directories are ever touched —
everything else at the root is left alone on both sides. Omit
`includePaths` (or set it to `[]`) to fall back to syncing the entire tree.

`dirFilePatterns` further restricts which _files_ are walked within
specific directories, by simple glob (`*` wildcard only, case-insensitive).
The SolarLog device mirrors its own web UI into `data/` and `hist/` —
not just html/gif/jpg/css chrome but a pile of its own `.js` files too
(`diagram_dom.js`, `functions.js`, `wz_tooltip.js`, `lang*.js`, …) — so a
broad `*.js` glob isn't tight enough; these entries are exact filenames
except for the `min*.js` wildcard, which matches the daily-generated
`minYYMMDD.js` readings files (plus `min_cur.js`/`min_day.js`). Keyed by
the directory's path relative to `dist/`; a directory with no entry here is
left unrestricted. Omit `dirFilePatterns` (or set it to `{}`) to disable
this filtering entirely.

`mtimeSensitivePaths` lists relative paths (relative to `dist/`, same form
as diff/apply's `--only`) that are rewritten in place at a fixed size, so
a size-only compare would miss real updates to them. For these paths only,
a drifted mtime (beyond the small clock-skew tolerance) is also treated as
a difference, even when the byte size matches. Omit it (or set it to `[]`)
to disable this and fall back to size-only for every path.

`remoteAuthoritativePaths` lists relative paths that are exclusively
generated by the SolarLog device — this project only ever reads/downloads
them, never hand-edits or uploads them. For these paths, a conflict always
suggests `download`, ignoring mtime entirely, since a locally-newer mtime
(from a revert, an editor save, a filesystem move, …) doesn't mean local
content is actually ahead of the device. Omit it (or set it to `[]`) to
fall back to mtime-based suggestions for every path.
