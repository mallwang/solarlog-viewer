/**
 * ftp-sync.js — diff and (on approval) sync the remote SolarLog FTP `web`
 * directory against the local `web/` tree, in either direction.
 *
 * Read-only by default: `--diff` builds a byte-size comparison of both
 * trees (mtime is shown but never decides "in sync" — see the
 * `TIME_TOLERANCE_MS` comment below for why) and writes it to
 * `.ftp-sync-diff.json` for a human (or the `sync-ftp` skill acting on a
 * human's behalf) to review. Nothing is ever transferred without
 * `--apply --yes`.
 *
 * The remote `web` directory is shared hosting for unrelated apps (e.g. a
 * "reality"/hoymiles folder alongside this one), so only the root-level
 * files/directories listed in `.ftp-sync.json`'s `includePaths` are ever
 * walked — everything else at the remote root is left untouched. Omit
 * `includePaths` (or leave it empty) to fall back to syncing the whole tree.
 *
 * The `data` and `hist` directories are themselves the SolarLog device's own
 * web UI mirror (html/gif/jpg/css chrome) with the handful of data files
 * this project needs (`*.js`, `*.csv`) interleaved among them. `.ftp-sync.json`'s
 * `dirFilePatterns` further restricts, per relative directory, which
 * filenames are walked at all — directories with no entry there stay
 * unrestricted.
 *
 * A handful of files (e.g. `data/min_cur.js`) are rewritten by the device in
 * place on a fixed interval without changing size, so a size-only compare
 * would call them "in sync" even when remote content is newer. List those
 * paths in `.ftp-sync.json`'s `mtimeSensitivePaths` to also fall back to
 * mtime for them specifically (see {@link diffTrees}).
 *
 * Conversely, files the device alone generates (e.g. `data/days_hist.js`)
 * are never legitimately authored or re-uploaded locally — a local mtime
 * bump (from a `git checkout`/revert, an editor save, etc.) doesn't mean
 * local content is actually newer, so the "newer mtime wins" suggestion can
 * point the wrong way. List those paths in `.ftp-sync.json`'s
 * `remoteAuthoritativePaths` to always suggest `download` on conflict for
 * them, ignoring mtime entirely (see {@link diffTrees}).
 *
 * Every `--diff` run also opens `.ftp-sync-diff.html` in the default
 * browser (best-effort; pass `--no-open` to skip).
 *
 * The local tree walked is `dist/`, not `web/` — `dist/` is the production build artifact
 * produced by `npm run build` (`scripts/build.js`): hashed/cache-busted `js/main-<sha>.js` and
 * `css/styles-<sha>.css`, copies of `i18n`/`img`/`vendor`, and `dist/data`/`dist/hist` as
 * symlinks straight through to the real `web/data`/`web/hist` (the device's own data mirror,
 * untouched by the build). Run `npm run build` before `--diff`/`--apply`, or you'll be
 * diffing/uploading a stale or missing `dist/`.
 *
 * Usage:
 *   node scripts/ftp-sync.js --diff [--no-open]
 *   node scripts/ftp-sync.js --apply --yes [--only a.txt,b/c.txt] [--direction upload|download]
 *
 * @module ftp-sync
 */

import { Client } from 'basic-ftp';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const CONFIG_PATH = resolve('.ftp-sync.json');
const DIFF_PATH = resolve('.ftp-sync-diff.json');
const HTML_PATH = resolve('.ftp-sync-diff.html');
const LOCAL_ROOT = resolve('dist');

// Modified-time is not used to decide whether a file is in sync — many FTP
// servers rewrite mtime to the moment of upload rather than preserving the
// source's original timestamp, so a file re-uploaded by hand (or moved
// between filesystems) can drift by seconds to minutes from its local
// counterpart despite being byte-identical. Byte size is the sole signal
// for "differs"; mtime is used only to suggest a direction once a real
// (size) difference is already established, within this tolerance.
const TIME_TOLERANCE_MS = 2000;

// ---------------------------------------------------------------------------
// Pure logic (unit-tested in ftp-sync.test.js)
// ---------------------------------------------------------------------------

/**
 * Compare a local and remote file-tree index and classify every path that
 * needs attention. A path present on both sides with matching byte size is
 * normally considered in sync, regardless of modified-time drift (see
 * {@link TIME_TOLERANCE_MS} for why mtime alone is unreliable) — except for
 * paths listed in `mtimeSensitivePaths`, where a size match is not proof of
 * identical content. The SolarLog device rewrites some files in place on a
 * fixed interval (e.g. `data/min_cur.js` every 10 minutes) without their size
 * changing, so those paths also fall back to mtime to catch a same-size
 * update; a real difference there becomes a conflict rather than being
 * silently skipped.
 *
 * @param {Map<string, {size: number, mtimeMs: number}>} localIndex - relative POSIX path -> stat
 * @param {Map<string, {size: number, mtimeMs: number}>} remoteIndex - relative POSIX path -> stat
 * @param {string[]|null} [mtimeSensitivePaths] - relative POSIX paths for which a same-size, drifted-mtime pair is still flagged as a conflict (see above)
 * @param {string[]|null} [remoteAuthoritativePaths] - relative POSIX paths for which a conflict always suggests `download`, ignoring mtime (see {@link diffTrees} doc comment on `remoteAuthoritativePaths`)
 * @returns {Array<{path: string, action: 'upload'|'download'|'conflict', local: {size:number,mtimeMs:number}|null, remote: {size:number,mtimeMs:number}|null, suggested: 'upload'|'download'|null}>}
 */
export function diffTrees(localIndex, remoteIndex, mtimeSensitivePaths = null, remoteAuthoritativePaths = null) {
  const sensitivePaths = mtimeSensitivePaths ? new Set(mtimeSensitivePaths) : null;
  const authoritativePaths = remoteAuthoritativePaths ? new Set(remoteAuthoritativePaths) : null;
  const paths = new Set([...localIndex.keys(), ...remoteIndex.keys()]);
  const entries = [];

  for (const path of paths) {
    const local = localIndex.get(path) ?? null;
    const remote = remoteIndex.get(path) ?? null;

    if (local && !remote) {
      entries.push({ path, action: 'upload', local, remote, suggested: 'upload' });
      continue;
    }
    if (!local && remote) {
      entries.push({ path, action: 'download', local, remote, suggested: 'download' });
      continue;
    }

    const entry = diffPresentOnBothSides(path, local, remote, sensitivePaths, authoritativePaths);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

/**
 * Classify a path present in both trees: `null` if it's in sync, otherwise a
 * `conflict` entry. Split out of {@link diffTrees} to keep that loop's
 * cognitive complexity in check.
 *
 * @param {string} path - relative POSIX path
 * @param {{size: number, mtimeMs: number}} local
 * @param {{size: number, mtimeMs: number}} remote
 * @param {Set<string>|null} sensitivePaths - see `mtimeSensitivePaths` on {@link diffTrees}
 * @param {Set<string>|null} authoritativePaths - see `remoteAuthoritativePaths` on {@link diffTrees}
 * @returns {{path: string, action: 'conflict', local: object, remote: object, suggested: 'upload'|'download'|null}|null}
 */
function diffPresentOnBothSides(path, local, remote, sensitivePaths, authoritativePaths) {
  const timeDiff = local.mtimeMs - remote.mtimeMs;
  const timeDiffers = Math.abs(timeDiff) > TIME_TOLERANCE_MS;

  if (local.size === remote.size) {
    // Same size is normally proof enough of "in sync" — except for paths
    // known to be rewritten in place at a fixed size, where it isn't.
    if (!sensitivePaths?.has(path) || !timeDiffers) return null;
  }

  let suggested = null;
  if (authoritativePaths?.has(path)) {
    // Local mtime can't be trusted for device-generated files — a revert or
    // editor save bumps it without local content actually being newer.
    suggested = 'download';
  } else if (timeDiffers) {
    suggested = timeDiff > 0 ? 'upload' : 'download';
  }
  return { path, action: 'conflict', local, remote, suggested };
}

/**
 * Render a diff as a human-readable report: a summary count line per
 * action, followed by a table of every entry.
 *
 * @param {ReturnType<typeof diffTrees>} diffEntries
 * @returns {string}
 */
export function formatDiffReport(diffEntries) {
  if (diffEntries.length === 0) return 'No differences — local and remote are in sync.';

  const counts = { upload: 0, download: 0, conflict: 0 };
  for (const entry of diffEntries) counts[entry.action]++;

  const lines = [
    `${diffEntries.length} difference(s): ${counts.upload} upload, ${counts.download} download, ${counts.conflict} conflict`,
    '',
  ];

  for (const entry of diffEntries) {
    const localDesc = entry.local ? `${entry.local.size}B @ ${new Date(entry.local.mtimeMs).toISOString()}` : '—';
    const remoteDesc = entry.remote ? `${entry.remote.size}B @ ${new Date(entry.remote.mtimeMs).toISOString()}` : '—';
    const suffix = entry.action === 'conflict' ? ` (suggested: ${entry.suggested ?? 'unresolved — pick manually'})` : '';
    lines.push(`[${entry.action}]${suffix} ${entry.path}`, `    local:  ${localDesc}`, `    remote: ${remoteDesc}`);
  }

  return lines.join('\n');
}

/**
 * Escape a string for safe embedding in HTML text content or attributes.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Format a byte count with a fixed set of units (B/KB/MB/GB), one decimal
 * place below KB.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1000;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

const ACTION_LABELS = { upload: 'Upload', download: 'Download', conflict: 'Conflict' };

/**
 * Render one side (local/remote) of a diff entry as a table cell's inner HTML.
 *
 * @param {{size: number, mtimeMs: number}|null} side
 * @returns {string}
 */
function renderSideCell(side) {
  if (!side) return '<span class="empty">—</span>';
  const date = new Date(side.mtimeMs);
  return (
    `<span class="size">${escapeHtml(formatBytes(side.size))}</span>` +
    `<span class="time">${escapeHtml(date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z'))}</span>`
  );
}

/**
 * Render a full standalone HTML report for a diff — a dashboard-style page
 * with a summary bar and a sortable table grouped by action, suitable for
 * opening directly in a browser.
 *
 * @param {ReturnType<typeof diffTrees>} diffEntries
 * @param {string} generatedAt - ISO timestamp of when the diff was produced
 * @param {string|null} [faviconDataUri] - `data:` URI for the tab icon, or null to omit
 * @returns {string} a complete HTML document
 */
export function formatDiffHtml(diffEntries, generatedAt, faviconDataUri = null) {
  const counts = { upload: 0, download: 0, conflict: 0 };
  for (const entry of diffEntries) counts[entry.action]++;

  const rows = diffEntries
    .map((entry) => {
      let suggestedLabel = '';
      if (entry.action === 'conflict') {
        suggestedLabel = entry.suggested ? `→ ${ACTION_LABELS[entry.suggested]}` : 'unresolved';
      }
      const sortAttrs = [
        `data-path="${escapeHtml(entry.path.toLowerCase())}"`,
        `data-action="${escapeHtml(entry.action)}"`,
        `data-localsize="${entry.local ? entry.local.size : ''}"`,
        `data-localtime="${entry.local ? entry.local.mtimeMs : ''}"`,
        `data-remotesize="${entry.remote ? entry.remote.size : ''}"`,
        `data-remotetime="${entry.remote ? entry.remote.mtimeMs : ''}"`,
        `data-suggested="${escapeHtml(suggestedLabel.toLowerCase())}"`,
      ].join(' ');
      return `
      <tr class="row-${entry.action}" ${sortAttrs}>
        <td class="path"><code>${escapeHtml(entry.path)}</code></td>
        <td><span class="badge badge-${entry.action}">${ACTION_LABELS[entry.action]}</span></td>
        <td class="side">${renderSideCell(entry.local)}</td>
        <td class="side">${renderSideCell(entry.remote)}</td>
        <td class="suggested">${escapeHtml(suggestedLabel)}</td>
      </tr>`;
    })
    .join('');

  const emptyState =
    diffEntries.length === 0
      ? '<p class="empty-state">No differences — local and remote are in sync.</p>'
      : '';

  const faviconTag = faviconDataUri ? `<link rel="icon" href="${escapeHtml(faviconDataUri)}" />` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
${faviconTag}
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FTP Sync Diff</title>
<style>
  :root {
    --bg: #f5f6f8;
    --surface: #ffffff;
    --border: #e1e4ea;
    --text: #1a1e24;
    --text-muted: #5c6472;
    --accent: #2f6feb;
    --upload: #2f6feb;
    --upload-bg: #e8f0fe;
    --download: #7c3aed;
    --download-bg: #f1eafe;
    --conflict: #a15c07;
    --conflict-bg: #fdf1e0;
    --row-hover: #eef1f5;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #10131a;
      --surface: #171b23;
      --border: #2a2f3a;
      --text: #e7eaf0;
      --text-muted: #8b93a3;
      --accent: #6a9bff;
      --upload: #6a9bff;
      --upload-bg: #1c2a4a;
      --download: #b79bfa;
      --download-bg: #2b2247;
      --conflict: #e8a94e;
      --conflict-bg: #3a2a10;
      --row-hover: #1f242e;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2.5rem clamp(1rem, 4vw, 3rem);
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.4;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    margin-bottom: 1.75rem;
  }
  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .generated {
    color: var(--text-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 1.75rem;
  }
  .pill {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4em;
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .pill strong {
    font-size: 1rem;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .pill-upload strong { color: var(--upload); }
  .pill-download strong { color: var(--download); }
  .pill-conflict strong { color: var(--conflict); }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    min-width: 640px;
  }
  thead th {
    position: sticky;
    top: 0;
    text-align: left;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0.7rem 0.9rem;
  }
  thead th.sortable {
    cursor: pointer;
    user-select: none;
  }
  thead th.sortable:hover { color: var(--text); }
  thead th.sortable::after {
    content: "↕";
    margin-left: 0.35em;
    opacity: 0.35;
    font-size: 0.9em;
  }
  thead th.sortable.sorted-asc::after { content: "↑"; opacity: 1; color: var(--accent); }
  thead th.sortable.sorted-desc::after { content: "↓"; opacity: 1; color: var(--accent); }
  tbody td {
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--row-hover); }
  td.path code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }
  .badge {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge-upload { color: var(--upload); background: var(--upload-bg); }
  .badge-download { color: var(--download); background: var(--download-bg); }
  .badge-conflict { color: var(--conflict); background: var(--conflict-bg); }
  td.side { font-variant-numeric: tabular-nums; }
  td.side .size { display: block; font-weight: 600; }
  td.side .time { display: block; color: var(--text-muted); font-size: 0.78rem; }
  .empty { color: var(--text-muted); }
  td.suggested { color: var(--text-muted); font-size: 0.82rem; white-space: nowrap; }
  .empty-state {
    padding: 2.5rem;
    text-align: center;
    color: var(--text-muted);
  }
</style>
</head>
<body>
  <header>
    <h1>FTP Sync Diff</h1>
    <span class="generated">Generated ${escapeHtml(generatedAt)}</span>
  </header>
  <div class="summary">
    <span class="pill pill-upload"><strong>${counts.upload}</strong> upload</span>
    <span class="pill pill-download"><strong>${counts.download}</strong> download</span>
    <span class="pill pill-conflict"><strong>${counts.conflict}</strong> conflict</span>
  </div>
  ${
    diffEntries.length === 0
      ? emptyState
      : `<div class="table-wrap">
    <table id="diff-table">
      <thead>
        <tr>
          <th class="sortable" data-sort-key="path">Path</th>
          <th class="sortable" data-sort-key="action">Action</th>
          <th class="sortable" data-sort-key="localsize">Local</th>
          <th class="sortable" data-sort-key="remotesize">Remote</th>
          <th class="sortable" data-sort-key="suggested">Suggested</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </div>
  <script>
    (function () {
      var table = document.getElementById('diff-table');
      if (!table) return;
      var tbody = table.tBodies[0];
      var headers = Array.prototype.slice.call(table.querySelectorAll('th.sortable'));
      var state = { key: null, dir: 1 };
      headers.forEach(function (th) {
        th.addEventListener('click', function () {
          var key = th.getAttribute('data-sort-key');
          state.dir = state.key === key ? state.dir * -1 : 1;
          state.key = key;
          headers.forEach(function (h) { h.classList.remove('sorted-asc', 'sorted-desc'); });
          th.classList.add(state.dir === 1 ? 'sorted-asc' : 'sorted-desc');
          var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
          rows.sort(function (a, b) {
            var av = a.dataset[key] || '';
            var bv = b.dataset[key] || '';
            var an = Number(av);
            var bn = Number(bv);
            var cmp;
            if (av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
              cmp = an - bn;
            } else {
              cmp = av.localeCompare(bv);
            }
            return cmp * state.dir;
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        });
      });
    })();
  </script>`
  }
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// I/O wrappers
// ---------------------------------------------------------------------------

/**
 * Decide whether a top-level `web/` entry (a root file or a root directory
 * name) should be walked at all. The `web` directory doubles as shared
 * hosting for unrelated apps (e.g. a "reality"/hoymiles folder), so only an
 * explicit allowlist of root entries should ever be touched.
 *
 * @param {string} name - a single path segment at the tree root (no slashes)
 * @param {string[]|null|undefined} includePaths - allowlisted root entries; falsy/empty means "allow everything"
 * @returns {boolean}
 */
export function isAllowedTopLevelEntry(name, includePaths) {
  if (!includePaths || includePaths.length === 0) return true;
  return includePaths.includes(name);
}

/**
 * Convert a simple glob pattern (only `*` as a wildcard, no `?`/`[]`) into a
 * case-insensitive RegExp matching a whole filename.
 *
 * @param {string} pattern - e.g. `"*.js"` or `"favicon-v2.ico"`
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, String.raw`\$&`).replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Decide whether a file directly inside a given relative directory should be
 * included, based on per-directory glob allowlists. Some remote directories
 * (e.g. `data`, `hist`) are the SolarLog device's own web UI mirror — full
 * of html/gif/jpg/css chrome — interleaved with the handful of data files
 * (`*.js`, `*.csv`) this project actually needs. Directories with no entry
 * in `dirFilePatterns` are left unrestricted.
 *
 * @param {string} relDirPath - relative POSIX path of the directory the file lives in (e.g. `"data"`)
 * @param {string} fileName - the file's base name (no path)
 * @param {Object<string, string[]>|null|undefined} dirFilePatterns - relative dir path -> allowlisted glob patterns
 * @returns {boolean}
 */
export function isAllowedFile(relDirPath, fileName, dirFilePatterns) {
  if (!dirFilePatterns) return true;
  const patterns = dirFilePatterns[relDirPath];
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => globToRegExp(pattern).test(fileName));
}

/**
 * Recursively index a local directory into relative POSIX paths.
 *
 * @param {string} rootDir - absolute path to the local root (e.g. `web/`)
 * @param {string[]|null} [includePaths] - allowlisted root-level file/directory names (see {@link isAllowedTopLevelEntry})
 * @param {Object<string, string[]>|null} [dirFilePatterns] - per-directory filename allowlists (see {@link isAllowedFile})
 * @param {string} [subDir] - relative path currently being walked (internal recursion)
 * @param {Map<string, {size: number, mtimeMs: number}>} [out] - accumulator (internal recursion)
 * @returns {Map<string, {size: number, mtimeMs: number}>}
 */
export function walkLocal(rootDir, includePaths = null, dirFilePatterns = null, subDir = '', out = new Map()) {
  const dirPath = join(rootDir, subDir);
  for (const name of readdirSync(dirPath)) {
    if (subDir === '' && !isAllowedTopLevelEntry(name, includePaths)) continue;
    const relPath = subDir ? `${subDir}/${name}` : name;
    const absPath = join(dirPath, name);
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      walkLocal(rootDir, includePaths, dirFilePatterns, relPath, out);
    } else if (stat.isFile()) {
      if (!isAllowedFile(subDir, name, dirFilePatterns)) continue;
      out.set(relPath, { size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
  return out;
}

/**
 * Resolve a remote FTP file's modified time, falling back to an explicit
 * `MDTM` lookup when the directory listing didn't already include it.
 *
 * @param {import('basic-ftp').Client} client - connected, logged-in FTP client
 * @param {string} dirPath - absolute remote path of the item's parent directory
 * @param {import('basic-ftp').FileInfo} item - the listed file entry
 * @returns {Promise<number>} modified time in epoch milliseconds
 */
async function resolveRemoteMtime(client, dirPath, item) {
  if (item.modifiedAt) return item.modifiedAt.getTime();
  return (await client.lastMod(`${dirPath}/${item.name}`)).getTime();
}

/**
 * Recursively index the remote FTP directory into relative POSIX paths.
 *
 * @param {import('basic-ftp').Client} client - connected, logged-in FTP client
 * @param {string} remoteRoot - absolute remote directory to walk (e.g. `/web`)
 * @param {string[]|null} [includePaths] - allowlisted root-level file/directory names (see {@link isAllowedTopLevelEntry})
 * @param {Object<string, string[]>|null} [dirFilePatterns] - per-directory filename allowlists (see {@link isAllowedFile})
 * @param {string} [subDir] - relative path currently being walked (internal recursion)
 * @param {Map<string, {size: number, mtimeMs: number}>} [out] - accumulator (internal recursion)
 * @returns {Promise<Map<string, {size: number, mtimeMs: number}>>}
 */
export async function walkRemote(
  client,
  remoteRoot,
  includePaths = null,
  dirFilePatterns = null,
  subDir = '',
  out = new Map(),
) {
  const dirPath = subDir ? `${remoteRoot}/${subDir}` : remoteRoot;
  const list = await client.list(dirPath);

  for (const item of list) {
    if (subDir === '' && !isAllowedTopLevelEntry(item.name, includePaths)) continue;
    const relPath = subDir ? `${subDir}/${item.name}` : item.name;
    if (item.isDirectory) {
      await walkRemote(client, remoteRoot, includePaths, dirFilePatterns, relPath, out);
    } else if (item.isFile && isAllowedFile(subDir, item.name, dirFilePatterns)) {
      out.set(relPath, { size: item.size, mtimeMs: await resolveRemoteMtime(client, dirPath, item) });
    }
  }
  return out;
}

/**
 * Read and validate the local `.ftp-sync.json` config file.
 *
 * @returns {{host: string, port: number, user: string, password: string, remoteRoot: string, includePaths: string[]|null, dirFilePatterns: Object<string, string[]>|null, mtimeSensitivePaths: string[]|null, remoteAuthoritativePaths: string[]|null}}
 */
export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Missing ${CONFIG_PATH}. Copy .ftp-sync.json.example to .ftp-sync.json and fill in your credentials.`,
    );
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  for (const field of ['host', 'user', 'password', 'remoteRoot']) {
    if (!config[field]) throw new Error(`.ftp-sync.json is missing required field "${field}"`);
  }
  if (config.includePaths !== undefined && !Array.isArray(config.includePaths)) {
    throw new Error('.ftp-sync.json field "includePaths" must be an array of strings if present');
  }
  for (const field of ['mtimeSensitivePaths', 'remoteAuthoritativePaths']) {
    if (config[field] !== undefined && !Array.isArray(config[field])) {
      throw new Error(`.ftp-sync.json field "${field}" must be an array of strings if present`);
    }
  }
  if (config.dirFilePatterns !== undefined) {
    const valid =
      typeof config.dirFilePatterns === 'object' &&
      config.dirFilePatterns !== null &&
      !Array.isArray(config.dirFilePatterns) &&
      Object.values(config.dirFilePatterns).every((patterns) => Array.isArray(patterns));
    if (!valid) {
      throw new Error(
        '.ftp-sync.json field "dirFilePatterns" must be an object mapping relative dir paths to arrays of glob patterns',
      );
    }
  }
  return {
    port: 21,
    includePaths: null,
    dirFilePatterns: null,
    mtimeSensitivePaths: null,
    remoteAuthoritativePaths: null,
    ...config,
  };
}

/**
 * Best-effort: open a local file in the OS default browser. Never throws —
 * this is a convenience, not a required step, so failures are swallowed
 * with a console warning.
 *
 * @param {string} filePath - absolute path to open
 * @returns {void}
 */
function openInBrowser(filePath) {
  // These are the standard portable OS "open with default app" launchers —
  // resolving them via PATH is the whole point, there's no fixed absolute
  // path that works across distros/installs, and this only ever runs a
  // local dev tool.
  try {
    const isWsl = process.platform === 'linux' && /microsoft/i.test(release());
    if (isWsl) {
      const windowsPath = execFileSync('wslpath', ['-w', filePath], { encoding: 'utf8' }).trim(); // NOSONAR (S4036)
      spawn('explorer.exe', [windowsPath], { detached: true, stdio: 'ignore' }).unref(); // NOSONAR (S4036)
    } else if (process.platform === 'darwin') {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref(); // NOSONAR (S4036)
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', filePath], { detached: true, stdio: 'ignore' }).unref(); // NOSONAR (S4036)
    } else {
      spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref(); // NOSONAR (S4036)
    }
  } catch (err) {
    console.warn(`Could not auto-open ${filePath}: ${err.message}`);
  }
}

/**
 * Connect and log in to the FTP server described by config.
 *
 * @param {{host: string, port: number, user: string, password: string}} config
 * @returns {Promise<import('basic-ftp').Client>}
 */
async function connect(config) {
  const client = new Client();
  await client.access({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    secure: false,
  });
  return client;
}

/**
 * Build both the local and remote indexes for the configured trees.
 *
 * @param {{remoteRoot: string, includePaths: string[]|null, dirFilePatterns: Object<string, string[]>|null}} config
 * @returns {Promise<{localIndex: Map<string, {size:number,mtimeMs:number}>, remoteIndex: Map<string, {size:number,mtimeMs:number}>}>}
 */
async function buildIndexes(config) {
  const client = await connect(config);
  try {
    const [localIndex, remoteIndex] = await Promise.all([
      Promise.resolve(walkLocal(LOCAL_ROOT, config.includePaths, config.dirFilePatterns)),
      walkRemote(client, config.remoteRoot, config.includePaths, config.dirFilePatterns),
    ]);
    return { localIndex, remoteIndex };
  } finally {
    client.close();
  }
}

/**
 * Load the site favicon as a `data:` URI, for embedding as the diff report's
 * browser-tab icon. Self-contained (no separate file reference) so the
 * report still shows its icon regardless of where it's opened from.
 *
 * @returns {string|null} `data:` URI, or null if the favicon file isn't present
 */
function loadFaviconDataUri() {
  const faviconPath = join(LOCAL_ROOT, 'favicon-v2.ico');
  if (!existsSync(faviconPath)) return null;
  return `data:image/x-icon;base64,${readFileSync(faviconPath).toString('base64')}`;
}

/**
 * Run diff mode: build both trees, diff them, print + persist the report.
 *
 * @param {{open?: boolean}} [options] - `open` (default true) auto-opens the HTML report
 * @returns {Promise<ReturnType<typeof diffTrees>>}
 */
async function runDiff({ open = true } = {}) {
  const config = loadConfig();
  const { localIndex, remoteIndex } = await buildIndexes(config);
  const diff = diffTrees(localIndex, remoteIndex, config.mtimeSensitivePaths, config.remoteAuthoritativePaths);
  const generatedAt = new Date().toISOString();

  console.log(formatDiffReport(diff));
  writeFileSync(DIFF_PATH, JSON.stringify({ generatedAt, diff }, null, 2));
  writeFileSync(HTML_PATH, formatDiffHtml(diff, generatedAt, loadFaviconDataUri()));
  console.log(`\nWrote ${diff.length} entr${diff.length === 1 ? 'y' : 'ies'} to ${DIFF_PATH} and ${HTML_PATH}`);
  if (open) openInBrowser(HTML_PATH);
  return diff;
}

/**
 * Run apply mode: transfer only the approved entries, in the resolved
 * direction, then re-diff to report convergence.
 *
 * @param {{only: string[]|null, direction: string|null, yes: boolean, open?: boolean}} options
 * @returns {Promise<void>}
 */
async function runApply({ only, direction, yes, open = true }) {
  if (!yes) {
    throw new Error('Refusing to transfer files without --yes (explicit human approval required).');
  }
  if (!existsSync(DIFF_PATH)) {
    throw new Error(`No ${DIFF_PATH} found — run "node scripts/ftp-sync.js --diff" first.`);
  }

  const { diff } = JSON.parse(readFileSync(DIFF_PATH, 'utf8'));
  const scoped = only ? diff.filter((entry) => only.includes(entry.path)) : diff;

  const resolved = scoped.map((entry) => ({
    ...entry,
    resolvedDirection: direction ?? entry.suggested,
  }));

  const unresolved = resolved.filter((entry) => !entry.resolvedDirection);
  if (unresolved.length > 0) {
    throw new Error(
      `${unresolved.length} entr${unresolved.length === 1 ? 'y has' : 'ies have'} no resolvable direction ` +
        `(ambiguous conflict): ${unresolved.map((e) => e.path).join(', ')}. ` +
        'Pass --direction upload|download or resolve them individually with --only.',
    );
  }

  const config = loadConfig();
  const client = await connect(config);
  try {
    for (const entry of resolved) {
      const localPath = join(LOCAL_ROOT, entry.path);
      const remotePath = `${config.remoteRoot}/${entry.path}`;
      if (entry.resolvedDirection === 'upload') {
        await client.ensureDir(dirname(remotePath));
        await client.cd('/');
        await client.uploadFrom(localPath, remotePath);
        console.log(`uploaded ${entry.path}`);
      } else {
        mkdirSync(dirname(localPath), { recursive: true });
        await client.downloadTo(localPath, remotePath);
        console.log(`downloaded ${entry.path}`);
      }
    }
  } finally {
    client.close();
  }

  console.log('\nRe-checking...');
  await runDiff({ open });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      diff: { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      only: { type: 'string' },
      direction: { type: 'string' },
      'no-open': { type: 'boolean', default: false },
    },
  });

  const mode = values.apply ? 'apply' : 'diff';
  const open = !values['no-open'];

  try {
    if (mode === 'diff') {
      await runDiff({ open });
    } else {
      await runApply({
        only: values.only ? values.only.split(',') : null,
        direction: values.direction ?? null,
        yes: values.yes,
        open,
      });
    }
    process.exit(0);
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}
