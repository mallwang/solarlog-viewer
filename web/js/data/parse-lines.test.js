import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAssignedStrings } from './parse-lines.js';

test('extracts a single assigned string', () => {
  const fileText = 'da[dx++]="31.07.26|179;203|143;129"';
  assert.deepEqual(extractAssignedStrings(fileText), ['31.07.26|179;203|143;129']);
});

test('extracts multiple lines in file order', () => {
  const fileText = ['mo[mx++]="01.07.26|584376|290797"', 'mo[mx++]="01.06.26|570240|282240"'].join(
    '\n',
  );
  assert.deepEqual(extractAssignedStrings(fileText), [
    '01.07.26|584376|290797',
    '01.06.26|570240|282240',
  ]);
});

test('ignores lines that do not match the assignment pattern', () => {
  const fileText = ['var Boot=99', 'da[dx++]="31.07.26|179;203|143;129"', ''].join('\n');
  assert.deepEqual(extractAssignedStrings(fileText), ['31.07.26|179;203|143;129']);
});

test('handles Windows-style line endings', () => {
  const fileText = 'da[dx++]="a"\r\nda[dx++]="b"\r\n';
  assert.deepEqual(extractAssignedStrings(fileText), ['a', 'b']);
});

test('returns empty array for empty input', () => {
  assert.deepEqual(extractAssignedStrings(''), []);
});

test('does not execute the file content (never eval)', () => {
  const fileText = 'da[dx++]="x"; window.__pwned = true';
  extractAssignedStrings(fileText);
  assert.equal(globalThis.__pwned, undefined);
});
