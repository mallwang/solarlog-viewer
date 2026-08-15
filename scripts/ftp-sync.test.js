import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffTrees,
  formatDiffHtml,
  formatDiffReport,
  isAllowedFile,
  isAllowedTopLevelEntry,
  mergeReplaceEntries,
} from './ftp-sync.js';

test('diffTrees: local-only file is an upload', () => {
  const local = new Map([['a.txt', { size: 10, mtimeMs: 1000 }]]);
  const remote = new Map();
  const diff = diffTrees(local, remote);
  assert.equal(diff.length, 1);
  assert.deepEqual(diff[0], {
    path: 'a.txt',
    action: 'upload',
    local: { size: 10, mtimeMs: 1000 },
    remote: null,
    suggested: 'upload',
  });
});

test('diffTrees: remote-only file is a download', () => {
  const local = new Map();
  const remote = new Map([['b.txt', { size: 20, mtimeMs: 2000 }]]);
  const diff = diffTrees(local, remote);
  assert.equal(diff.length, 1);
  assert.deepEqual(diff[0], {
    path: 'b.txt',
    action: 'download',
    local: null,
    remote: { size: 20, mtimeMs: 2000 },
    suggested: 'download',
  });
});

test('diffTrees: identical size and mtime (within tolerance) is omitted', () => {
  const local = new Map([['c.txt', { size: 30, mtimeMs: 5000 }]]);
  const remote = new Map([['c.txt', { size: 30, mtimeMs: 5900 }]]); // < 2s tolerance
  const diff = diffTrees(local, remote);
  assert.deepEqual(diff, []);
});

test('diffTrees: same size but wildly drifted mtime is still omitted (e.g. a past manual upload)', () => {
  // FTP servers commonly stamp mtime with the upload time rather than
  // preserving the source's original timestamp, so a same-size file can
  // drift by minutes/hours/days without its content having changed at all.
  const local = new Map([['d.txt', { size: 40, mtimeMs: 10_000 }]]);
  const remote = new Map([['d.txt', { size: 40, mtimeMs: 10_000 + 6 * 60 * 60 * 1000 }]]); // 6h drift
  const diff = diffTrees(local, remote);
  assert.deepEqual(diff, []);
});

test('diffTrees: differing size, local newer -> conflict suggesting upload', () => {
  const local = new Map([['d.txt', { size: 41, mtimeMs: 10_000 }]]);
  const remote = new Map([['d.txt', { size: 40, mtimeMs: 5000 }]]);
  const diff = diffTrees(local, remote);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].action, 'conflict');
  assert.equal(diff[0].suggested, 'upload');
});

test('diffTrees: differing size, remote newer -> conflict suggesting download', () => {
  const local = new Map([['e.txt', { size: 41, mtimeMs: 1000 }]]);
  const remote = new Map([['e.txt', { size: 40, mtimeMs: 9000 }]]);
  const diff = diffTrees(local, remote);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].action, 'conflict');
  assert.equal(diff[0].suggested, 'download');
});

test('diffTrees: differing size with equal mtime -> conflict with no suggestion', () => {
  const local = new Map([['f.txt', { size: 100, mtimeMs: 1000 }]]);
  const remote = new Map([['f.txt', { size: 200, mtimeMs: 1000 }]]);
  const diff = diffTrees(local, remote);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].action, 'conflict');
  assert.equal(diff[0].suggested, null);
});

test('diffTrees: same size but drifted mtime on a listed sensitive path is a conflict', () => {
  const local = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_000 }]]);
  const remote = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_000 + 10 * 60 * 1000 }]]); // 10 min drift
  const diff = diffTrees(local, remote, ['data/min_cur.js']);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].action, 'conflict');
  assert.equal(diff[0].suggested, 'download'); // remote is newer
});

test('diffTrees: same size and mtime (within tolerance) on a sensitive path is still omitted', () => {
  const local = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_000 }]]);
  const remote = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_900 }]]); // < 2s tolerance
  const diff = diffTrees(local, remote, ['data/min_cur.js']);
  assert.deepEqual(diff, []);
});

test('diffTrees: same size and drifted mtime on an unlisted path is omitted (default behavior unchanged)', () => {
  const local = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_000 }]]);
  const remote = new Map([['data/min_cur.js', { size: 396, mtimeMs: 10_000 + 10 * 60 * 1000 }]]);
  const diff = diffTrees(local, remote, ['data/some_other_file.js']);
  assert.deepEqual(diff, []);
});

test('diffTrees: differing size on a remote-authoritative path suggests download even though local is newer', () => {
  // Simulates a git revert: local content went back to the old (smaller)
  // version, but the revert touched mtime to "now" — newer than remote.
  const local = new Map([['data/days_hist.js', { size: 598, mtimeMs: 50_000 }]]);
  const remote = new Map([['data/days_hist.js', { size: 641, mtimeMs: 10_000 }]]);
  const diff = diffTrees(local, remote, null, ['data/days_hist.js']);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].action, 'conflict');
  assert.equal(diff[0].suggested, 'download');
});

test('diffTrees: differing size on an unlisted path still uses mtime as normal (regression guard)', () => {
  const local = new Map([['data/days_hist.js', { size: 598, mtimeMs: 50_000 }]]);
  const remote = new Map([['data/days_hist.js', { size: 641, mtimeMs: 10_000 }]]);
  const diff = diffTrees(local, remote, null, ['data/some_other_file.js']);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].suggested, 'upload'); // local mtime is newer, so default heuristic still applies
});

test('diffTrees: mixed tree produces one entry per differing path, sorted by path', () => {
  const local = new Map([
    ['z.txt', { size: 1, mtimeMs: 1 }],
    ['a.txt', { size: 1, mtimeMs: 1 }],
  ]);
  const remote = new Map([['m.txt', { size: 1, mtimeMs: 1 }]]);
  const diff = diffTrees(local, remote);
  assert.deepEqual(
    diff.map((e) => e.path),
    ['a.txt', 'm.txt', 'z.txt'],
  );
});

test('mergeReplaceEntries: pairs a new-hash upload with a same-stem old-hash download into one replace entry', () => {
  const diff = [
    { path: 'css/styles-1ee9793.css', action: 'upload', local: { size: 100, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'css/styles-38f505e.css', action: 'download', local: null, remote: { size: 90, mtimeMs: 2 }, suggested: 'download' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], {
    path: 'css/styles-1ee9793.css',
    action: 'replace',
    local: { size: 100, mtimeMs: 1 },
    remote: { size: 90, mtimeMs: 2 },
    suggested: 'replace',
    staleRemotePaths: ['css/styles-38f505e.css'],
  });
});

test('mergeReplaceEntries: collects multiple stale old-hash files onto one replace entry', () => {
  const diff = [
    { path: 'js/main-1ee9793.js', action: 'upload', local: { size: 100, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'js/main-38f505e.js', action: 'download', local: null, remote: { size: 90, mtimeMs: 2 }, suggested: 'download' },
    { path: 'js/main-abc1234.js', action: 'download', local: null, remote: { size: 80, mtimeMs: 3 }, suggested: 'download' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].action, 'replace');
  assert.deepEqual(merged[0].staleRemotePaths.sort(), ['js/main-38f505e.js', 'js/main-abc1234.js']);
});

test('mergeReplaceEntries: does not pair across different directories', () => {
  const diff = [
    { path: 'css/styles-1ee9793.css', action: 'upload', local: { size: 100, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'other/styles-38f505e.css', action: 'download', local: null, remote: { size: 90, mtimeMs: 2 }, suggested: 'download' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((e) => e.action).sort(),
    ['download', 'upload'],
  );
});

test('mergeReplaceEntries: does not pair files with different stems or extensions', () => {
  const diff = [
    { path: 'js/main-1ee9793.js', action: 'upload', local: { size: 100, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'js/vendor-38f505e.js', action: 'download', local: null, remote: { size: 90, mtimeMs: 2 }, suggested: 'download' },
    { path: 'js/main-abc1234.css', action: 'download', local: null, remote: { size: 80, mtimeMs: 3 }, suggested: 'download' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.equal(merged.length, 3);
  assert.equal(merged.filter((e) => e.action === 'replace').length, 0);
});

test('mergeReplaceEntries: leaves non hash-suffixed uploads/downloads and conflicts untouched', () => {
  const diff = [
    { path: 'favicon-v2.ico', action: 'download', local: null, remote: { size: 5, mtimeMs: 1 }, suggested: 'download' },
    { path: 'index.html', action: 'conflict', local: { size: 10, mtimeMs: 1 }, remote: { size: 20, mtimeMs: 2 }, suggested: 'upload' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.deepEqual(merged, diff);
});

test('mergeReplaceEntries: result is sorted by path', () => {
  const diff = [
    { path: 'z-1.txt', action: 'upload', local: { size: 1, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'a-2.txt', action: 'upload', local: { size: 1, mtimeMs: 1 }, remote: null, suggested: 'upload' },
  ];
  const merged = mergeReplaceEntries(diff);
  assert.deepEqual(
    merged.map((e) => e.path),
    ['a-2.txt', 'z-1.txt'],
  );
});

test('isAllowedTopLevelEntry: no includePaths (undefined/null/empty) allows everything', () => {
  assert.equal(isAllowedTopLevelEntry('reality', undefined), true);
  assert.equal(isAllowedTopLevelEntry('reality', null), true);
  assert.equal(isAllowedTopLevelEntry('reality', []), true);
});

test('isAllowedTopLevelEntry: allows only listed root entries', () => {
  const includePaths = ['index.html', 'favicon.ico', 'js', 'i18n', 'data', 'css', 'hist', 'vendor'];
  assert.equal(isAllowedTopLevelEntry('js', includePaths), true);
  assert.equal(isAllowedTopLevelEntry('index.html', includePaths), true);
  assert.equal(isAllowedTopLevelEntry('reality', includePaths), false);
  assert.equal(isAllowedTopLevelEntry('hoymiles', includePaths), false);
});

test('isAllowedFile: no dirFilePatterns (undefined/null/empty) allows everything', () => {
  assert.equal(isAllowedFile('data', 'anlageninfo.html', undefined), true);
  assert.equal(isAllowedFile('data', 'anlageninfo.html', null), true);
  assert.equal(isAllowedFile('data', 'anlageninfo.html', {}), true);
});

test('isAllowedFile: directory with no configured patterns is unrestricted', () => {
  const dirFilePatterns = { data: ['*.js'] };
  assert.equal(isAllowedFile('js', 'app.js', dirFilePatterns), true);
  assert.equal(isAllowedFile('js', 'logo.png', dirFilePatterns), true);
});

test('isAllowedFile: matches configured glob patterns for the directory', () => {
  const dirFilePatterns = { data: ['*.js', '*.csv', 'favicon.ico'] };
  assert.equal(isAllowedFile('data', 'months.js', dirFilePatterns), true);
  assert.equal(isAllowedFile('data', 'min260812.js', dirFilePatterns), true);
  assert.equal(isAllowedFile('data', 'pm.csv', dirFilePatterns), true);
  assert.equal(isAllowedFile('data', 'favicon.ico', dirFilePatterns), true);
  assert.equal(isAllowedFile('data', 'anlageninfo.html', dirFilePatterns), false);
  assert.equal(isAllowedFile('data', 'back.gif', dirFilePatterns), false);
});

test('isAllowedFile: matching is case-insensitive (device uses .JPG etc.)', () => {
  const dirFilePatterns = { data: ['*.js'] };
  assert.equal(isAllowedFile('data', 'MONTHS.JS', dirFilePatterns), true);
});

test('formatDiffReport: empty diff reports no differences', () => {
  const report = formatDiffReport([]);
  assert.match(report, /no differences/i);
});

test('formatDiffReport: groups entries by action with counts', () => {
  const diff = [
    { path: 'a.txt', action: 'upload', local: { size: 10, mtimeMs: 1 }, remote: null, suggested: 'upload' },
    { path: 'b.txt', action: 'download', local: null, remote: { size: 20, mtimeMs: 1 }, suggested: 'download' },
    {
      path: 'c.txt',
      action: 'conflict',
      local: { size: 1, mtimeMs: 1 },
      remote: { size: 2, mtimeMs: 1 },
      suggested: null,
    },
  ];
  const report = formatDiffReport(diff);
  assert.match(report, /1 upload/i);
  assert.match(report, /1 download/i);
  assert.match(report, /1 conflict/i);
  assert.match(report, /a\.txt/);
  assert.match(report, /b\.txt/);
  assert.match(report, /c\.txt/);
});

test('formatDiffHtml: empty diff renders an empty-state message and zeroed counts', () => {
  const html = formatDiffHtml([], '2026-08-13T00:00:00.000Z');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /No differences/i);
  assert.match(html, /<strong>0<\/strong> upload/);
});

test('formatDiffHtml: renders one row per entry with escaped paths and byte sizes', () => {
  const diff = [
    { path: 'a&<b>.txt', action: 'upload', local: { size: 1500, mtimeMs: 0 }, remote: null, suggested: 'upload' },
    {
      path: 'c.txt',
      action: 'conflict',
      local: { size: 1, mtimeMs: 1 },
      remote: { size: 2, mtimeMs: 1 },
      suggested: null,
    },
  ];
  const html = formatDiffHtml(diff, '2026-08-13T00:00:00.000Z');
  assert.match(html, /a&amp;&lt;b&gt;\.txt/);
  assert.doesNotMatch(html, /a&<b>\.txt/);
  assert.match(html, /1\.5 KB/);
  assert.match(html, /unresolved/);
  assert.match(html, /<strong>1<\/strong> upload/);
  assert.match(html, /<strong>1<\/strong> conflict/);
  assert.match(html, /data-sort-key="path"/);
  assert.match(html, /data-path="a&amp;&lt;b&gt;\.txt"/);
  assert.match(html, /data-localsize="1500"/);
});

test('formatDiffHtml: embeds a favicon link when a data URI is given, omits it otherwise', () => {
  const withFavicon = formatDiffHtml([], '2026-08-13T00:00:00.000Z', 'data:image/x-icon;base64,AAA=');
  assert.match(withFavicon, /<link rel="icon" href="data:image\/x-icon;base64,AAA=" \/>/);

  const withoutFavicon = formatDiffHtml([], '2026-08-13T00:00:00.000Z', null);
  assert.doesNotMatch(withoutFavicon, /<link rel="icon"/);
});
