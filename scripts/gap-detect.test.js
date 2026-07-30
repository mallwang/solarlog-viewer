/**
 * Tests for gap-detect.js — uses inline fixture filename lists, no filesystem I/O.
 * @module gap-detect.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArchiveFilenames, parseDaysHistLines, parseInstallDate, detectGaps, formatRanges, buildJsonReport } from './gap-detect.js';

// --- parseDaysHistLines ---

describe('parseDaysHistLines', () => {
  it('parses DD.MM.YY dates and returns sorted ISO strings', () => {
    const lines = [
      'da[dx++]="03.07.26|19008;0|9408;0"',
      'da[dx++]="01.07.26|18000;0|9000;0"',
      'da[dx++]="02.07.26|17000;0|8000;0"',
    ];
    assert.deepEqual(parseDaysHistLines(lines), ['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('handles century boundary: YY >= 06 → 20YY', () => {
    const lines = [
      'da[dx++]="18.08.09|660;0|337;0"',
      'da[dx++]="03.11.06|1234;0|500;0"',
    ];
    assert.deepEqual(parseDaysHistLines(lines), ['2006-11-03', '2009-08-18']);
  });

  it('ignores lines that do not match the expected format', () => {
    const lines = [
      '// comment',
      'var da = [];',
      'da[dx++]="01.07.26|19008;0|9408;0"',
    ];
    assert.deepEqual(parseDaysHistLines(lines), ['2026-07-01']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseDaysHistLines([]), []);
  });

  it('deduplicates dates that appear more than once', () => {
    const lines = [
      'da[dx++]="01.07.26|19008;0|9408;0"',
      'da[dx++]="01.07.26|19008;0|9408;0"',
    ];
    assert.deepEqual(parseDaysHistLines(lines), ['2026-07-01']);
  });
});

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

// --- parseInstallDate ---

describe('parseInstallDate', () => {
  it('parses HPInbetrieb in DD.MM.YYYY format', () => {
    const content = 'var HPInbetrieb="15.03.2006"';
    assert.equal(parseInstallDate(content), '2006-03-15');
  });

  it('returns null when HPInbetrieb is absent', () => {
    assert.equal(parseInstallDate('var HPLeistung="6,2 kWp"'), null);
  });

  it('returns null for an invalid date value', () => {
    assert.equal(parseInstallDate('var HPInbetrieb="99.99.2006"'), null);
  });
});

// --- detectGaps with startDate ---

describe('detectGaps with startDate', () => {
  it('reports a leading gap between startDate and first data entry', () => {
    const dates = ['2006-03-18', '2006-03-19'];
    const gaps = detectGaps(dates, undefined, '2006-03-15');
    assert.equal(gaps.length, 1);
    assert.deepEqual(gaps[0], { start: '2006-03-15', end: '2006-03-17', count: 3 });
  });

  it('reports no leading gap when first entry equals startDate', () => {
    const dates = ['2006-03-15', '2006-03-16'];
    const gaps = detectGaps(dates, undefined, '2006-03-15');
    assert.deepEqual(gaps, []);
  });

  it('ignores startDate when first entry is before it', () => {
    const dates = ['2006-03-10', '2006-03-16'];
    const gaps = detectGaps(dates, undefined, '2006-03-15');
    assert.equal(gaps.length, 1);
    assert.deepEqual(gaps[0], { start: '2006-03-11', end: '2006-03-15', count: 5 });
  });

  it('combines leading gap with internal gaps', () => {
    const dates = ['2006-03-18', '2006-03-20'];
    const gaps = detectGaps(dates, undefined, '2006-03-15');
    assert.equal(gaps.length, 2);
    assert.deepEqual(gaps[0], { start: '2006-03-15', end: '2006-03-17', count: 3 });
    assert.deepEqual(gaps[1], { start: '2006-03-19', end: '2006-03-19', count: 1 });
  });

  it('startDate is ignored when dates list is empty', () => {
    assert.deepEqual(detectGaps([], undefined, '2006-03-15'), []);
  });
});
