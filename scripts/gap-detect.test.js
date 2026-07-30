/**
 * Tests for gap-detect.js — uses inline fixture filename lists, no filesystem I/O.
 * @module gap-detect.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArchiveFilenames, detectGaps, formatRanges, buildJsonReport } from './gap-detect.js';

// --- parseArchiveFilenames ---

describe('parseArchiveFilenames', () => {
  it('extracts and sorts dates from valid minYYMMDD.js filenames', () => {
    const filenames = ['min260701.js', 'min260703.js', 'min260702.js', 'min_cur.js', 'days.js'];
    const result = parseArchiveFilenames(filenames);
    assert.deepEqual(result, ['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('handles century boundary: YY >= 06 → 20YY', () => {
    const filenames = ['min061103.js', 'min070101.js'];
    const result = parseArchiveFilenames(filenames);
    assert.deepEqual(result, ['2006-11-03', '2007-01-01']);
  });

  it('returns empty array when no min files match', () => {
    const result = parseArchiveFilenames(['days.js', 'min_cur.js', 'months.js']);
    assert.deepEqual(result, []);
  });
});

// --- detectGaps ---

describe('detectGaps', () => {
  it('returns empty array when no gaps exist', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03'];
    assert.deepEqual(detectGaps(dates), []);
  });

  it('detects a single isolated gap', () => {
    const dates = ['2026-07-01', '2026-07-03'];
    const gaps = detectGaps(dates);
    assert.equal(gaps.length, 1);
    assert.deepEqual(gaps[0], { start: '2026-07-02', end: '2026-07-02', count: 1 });
  });

  it('collapses consecutive missing days into one range', () => {
    const dates = ['2026-07-01', '2026-07-06'];
    const gaps = detectGaps(dates);
    assert.equal(gaps.length, 1);
    assert.deepEqual(gaps[0], { start: '2026-07-02', end: '2026-07-05', count: 4 });
  });

  it('detects multiple separate gap ranges', () => {
    const dates = ['2026-07-01', '2026-07-03', '2026-07-05'];
    const gaps = detectGaps(dates);
    assert.equal(gaps.length, 2);
    assert.deepEqual(gaps[0], { start: '2026-07-02', end: '2026-07-02', count: 1 });
    assert.deepEqual(gaps[1], { start: '2026-07-04', end: '2026-07-04', count: 1 });
  });

  it('--since filter trims output to dates on or after the cutoff', () => {
    const dates = ['2026-07-01', '2026-07-03', '2026-07-10', '2026-07-12'];
    const gaps = detectGaps(dates, '2026-07-09');
    assert.equal(gaps.length, 1);
    assert.deepEqual(gaps[0], { start: '2026-07-11', end: '2026-07-11', count: 1 });
  });

  it('returns empty array when dates list has one element (no span to check)', () => {
    assert.deepEqual(detectGaps(['2026-07-01']), []);
  });

  it('returns empty array for empty dates list', () => {
    assert.deepEqual(detectGaps([]), []);
  });
});

// --- formatRanges ---

describe('formatRanges', () => {
  it('formats a single-day gap', () => {
    const gaps = [{ start: '2026-07-02', end: '2026-07-02', count: 1 }];
    const lines = formatRanges(gaps);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /2026-07-02/);
    assert.match(lines[0], /1 day missing/);
  });

  it('formats a multi-day range', () => {
    const gaps = [{ start: '2026-07-02', end: '2026-07-05', count: 4 }];
    const lines = formatRanges(gaps);
    assert.match(lines[0], /2026-07-02/);
    assert.match(lines[0], /2026-07-05/);
    assert.match(lines[0], /4 days missing/);
  });

  it('returns empty array for no gaps', () => {
    assert.deepEqual(formatRanges([]), []);
  });
});

// --- buildJsonReport ---

describe('buildJsonReport', () => {
  it('produces correct structure with gaps', () => {
    const meta = { firstFile: '2026-07-01', lastFile: '2026-07-05', fileCount: 4 };
    const gaps = [{ start: '2026-07-03', end: '2026-07-03', count: 1 }];
    const report = buildJsonReport(meta, gaps);
    assert.equal(report.gapCount, 1);
    assert.equal(report.totalMissingDays, 1);
    assert.deepEqual(report.gaps, gaps);
    assert.equal(report.meta.fileCount, 4);
  });

  it('produces correct structure with no gaps', () => {
    const meta = { firstFile: '2026-07-01', lastFile: '2026-07-03', fileCount: 3 };
    const report = buildJsonReport(meta, []);
    assert.equal(report.gapCount, 0);
    assert.equal(report.totalMissingDays, 0);
    assert.deepEqual(report.gaps, []);
  });
});
