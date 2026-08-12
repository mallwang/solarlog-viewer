import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertRecapBlock } from './upsert-recap-block.mjs';

const START = '<!-- system-recap:start -->';
const END = '<!-- system-recap:end -->';

test('appends a block when the body has no existing recap', () => {
  const body = 'Some PR description.\n';
  const block = `${START}\nnew recap\n${END}`;

  const result = upsertRecapBlock(body, block);

  assert.equal(result, 'Some PR description.\n\n<!-- system-recap:start -->\nnew recap\n<!-- system-recap:end -->\n');
});

test('replaces an existing block in place, preserving surrounding text', () => {
  const body = `Intro text.\n\n${START}\nold recap\n${END}\n\nOutro text.`;
  const block = `${START}\nnew recap\n${END}`;

  const result = upsertRecapBlock(body, block);

  assert.equal(result, `Intro text.\n\n${START}\nnew recap\n${END}\n\nOutro text.`);
});

test('trims whitespace around the provided block before splicing', () => {
  const body = 'Intro.';
  const block = `\n  ${START}\nnew recap\n${END}  \n`;

  const result = upsertRecapBlock(body, block);

  assert.equal(result, `Intro.\n\n${START}\nnew recap\n${END}\n`);
});

test('rejects a block missing the start marker', () => {
  const block = `no start marker\n${END}`;

  assert.throws(() => upsertRecapBlock('body', block), /must start with/);
});

test('rejects a block missing the end marker', () => {
  const block = `${START}\nno end marker`;

  assert.throws(() => upsertRecapBlock('body', block), /must start with/);
});
