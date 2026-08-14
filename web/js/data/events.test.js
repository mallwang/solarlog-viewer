import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEventLine, parseEventsFile, mergeAndDedupeEvents, enrichEvent } from './events.js';

const CODES = {
  statusCodes: [
    ['Offset', 'Stop', 'Netzueb.', 'Warten', 'Mpp', 'Stoer.', 'Fehler', ''],
    ['Offset', 'Stop', 'Mpp', 'Stoer.', 'Fehler', ''],
  ],
  errorCodes: [
    ['-------', 'NUW-UAC', 'NUW-FAC', ''],
    ['-------', 'NUW-UAC', ''],
  ],
};

test('parseEventLine parses a valid, closed event line', () => {
  const record = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;0');
  assert.deepEqual(record, {
    startRaw: '13.08.26 06:37:30',
    endRaw: '13.08.26 06:37:44',
    inverterIdx: 0,
    statusCode: 6,
    errorCode: 0,
    dedupeKey: '13.08.26 06:37:30;13.08.26 06:37:44;0;6;0',
  });
});

test('parseEventLine parses a valid, ongoing event line (empty end field)', () => {
  const record = parseEventLine('14.08.26 06:38:45;;0;7;0');
  assert.equal(record.endRaw, '');
});

test('parseEventLine returns null for a line with the wrong field count (FR-009)', () => {
  assert.equal(parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6'), null);
  assert.equal(parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;0;extra'), null);
});

test('parseEventLine returns null when inverterIdx/statusCode/errorCode do not parse as integers (FR-009)', () => {
  assert.equal(parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;x;6;0'), null);
  assert.equal(parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;x;0'), null);
  assert.equal(parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;x'), null);
});

test('parseEventsFile extracts and parses every assigned-string line, skipping malformed ones', () => {
  const fileText = `e[ev++]="13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"
e[ev++]="not a valid event line"
e[ev++]="13.08.26 06:37:45;13.08.26 06:38:29;0;2;0"
`;
  const records = parseEventsFile(fileText);
  assert.equal(records.length, 2);
  assert.equal(records[0].statusCode, 6);
  assert.equal(records[1].statusCode, 2);
});

test('mergeAndDedupeEvents dedupes a line duplicated across both fixture files (FR-008)', () => {
  const history = parseEventsFile(
    'e[ev++]="13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"\ne[ev++]="13.08.26 06:37:45;13.08.26 06:38:29;0;2;0"',
  );
  const today = parseEventsFile(
    'e[ev++]="13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"\ne[ev++]="14.08.26 06:38:45;;0;7;0"',
  );
  const merged = mergeAndDedupeEvents(history, today);
  assert.equal(merged.length, 3);
  const dedupeKeys = merged.map((r) => r.dedupeKey);
  assert.equal(new Set(dedupeKeys).size, 3);
});

test('mergeAndDedupeEvents prefers the closed copy over a still-open one for the same (start, inverter)', () => {
  // Reproduces the real WR2 duplicate: events.js snapshots the event while still open, then
  // events_day.js closes it out once the state changes — same identity, different endRaw.
  const history = parseEventsFile('e[ev++]="14.08.26 06:10:00;;1;3;0"');
  const today = parseEventsFile('e[ev++]="14.08.26 06:10:00;14.08.26 06:19:14;1;3;0"');
  const merged = mergeAndDedupeEvents(history, today);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].endRaw, '14.08.26 06:19:14');
});

test('mergeAndDedupeEvents prefers the closed copy regardless of which file it came from', () => {
  const history = parseEventsFile('e[ev++]="14.08.26 06:10:00;14.08.26 06:19:14;1;3;0"');
  const today = parseEventsFile('e[ev++]="14.08.26 06:10:00;;1;3;0"');
  const merged = mergeAndDedupeEvents(history, today);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].endRaw, '14.08.26 06:19:14');
});

test('mergeAndDedupeEvents keeps genuinely different events for the same inverter (different start)', () => {
  const history = parseEventsFile('e[ev++]="14.08.26 06:07:52;14.08.26 06:09:59;1;0;0"');
  const today = parseEventsFile('e[ev++]="14.08.26 06:20:00;;1;7;0"');
  const merged = mergeAndDedupeEvents(history, today);
  assert.equal(merged.length, 2);
});

test('enrichEvent produces an ongoing event (end: null, isOngoing: true, durationMs: null)', () => {
  const raw = parseEventLine('14.08.26 06:38:45;;0;7;0');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.end, null);
  assert.equal(event.isOngoing, true);
  assert.equal(event.durationMs, null);
  assert.deepEqual(event.start, new Date(2026, 7, 14, 6, 38, 45));
});

test('enrichEvent computes durationMs for a closed event', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;0');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.isOngoing, false);
  assert.equal(event.durationMs, 14000);
});

test('enrichEvent resolves an in-range status code to its label', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;0');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.statusLabel, 'Fehler');
});

test('enrichEvent resolves an out-of-range status code to "Offline" (FR-010)', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;99;0');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.statusLabel, 'Offline');
});

test('enrichEvent resolves error code 0 to null (no error)', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;0');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.errorLabel, null);
  assert.equal(event.errorRawCode, null);
});

test('enrichEvent resolves a known error code to its label', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;1');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.errorLabel, 'NUW-UAC');
  assert.equal(event.errorRawCode, null);
});

test('enrichEvent resolves a genuinely unknown error code to errorRawCode (FR-010)', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;0;6;42');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.errorLabel, null);
  assert.equal(event.errorRawCode, 42);
});

test('enrichEvent falls back gracefully for a stale/unknown inverter index', () => {
  const raw = parseEventLine('13.08.26 06:37:30;13.08.26 06:37:44;3;6;1');
  const event = enrichEvent(raw, CODES);
  assert.equal(event.statusLabel, 'Offline');
  assert.equal(event.errorLabel, null);
  assert.equal(event.errorRawCode, 1);
});
