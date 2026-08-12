#!/usr/bin/env node
/**
 * upsert-recap-block.mjs — upsert a system-recap block into a PR description
 * without touching any text outside the markers.
 *
 * Usage:
 *   node upsert-recap-block.mjs <block-file>              # current branch's PR
 *   node upsert-recap-block.mjs <pr-number> <block-file>  # explicit PR
 *
 * With one argument, resolves the PR the same way `gh pr view`/`gh pr edit`
 * do on their own — from the currently checked-out (and pushed) branch — so
 * no PR number is needed when the PR was created manually on github.com
 * after e.g. the generate-pr skill.
 *
 * The block file must start with `<!-- system-recap:start -->` and end with
 * `<!-- system-recap:end -->`. Requires the `gh` CLI to be authenticated.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const START_MARKER = '<!-- system-recap:start -->';
const END_MARKER = '<!-- system-recap:end -->';

/**
 * Splices `block` into `body` between the recap markers, replacing an
 * existing block in place or appending a new one.
 * @param {string} body - current PR description
 * @param {string} block - recap block, starting with START_MARKER and ending with END_MARKER
 * @returns {string} the updated PR description
 */
export function upsertRecapBlock(body, block) {
  const trimmedBlock = block.trim();
  if (!trimmedBlock.startsWith(START_MARKER) || !trimmedBlock.endsWith(END_MARKER)) {
    throw new Error(`block must start with "${START_MARKER}" and end with "${END_MARKER}"`);
  }

  const startIndex = body.indexOf(START_MARKER);
  const endIndex = body.indexOf(END_MARKER);
  const hasExistingBlock = startIndex !== -1 && endIndex !== -1 && endIndex > startIndex;

  return hasExistingBlock
    ? body.slice(0, startIndex) + trimmedBlock + body.slice(endIndex + END_MARKER.length)
    : `${body.trimEnd()}\n\n${trimmedBlock}\n`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 && args.length !== 2) {
    console.error(
      'usage: upsert-recap-block.mjs [<pr-number>] <block-file>\n' +
        '  (omit <pr-number> to target the current branch\'s PR)',
    );
    process.exit(1);
  }
  const [prSelector, blockFile] = args.length === 2 ? args : [undefined, args[0]];
  // gh accepts a selector argument (number/url/branch) or, when omitted, resolves the PR
  // for the currently checked-out branch — same fallback used here.
  const selector = prSelector ? [prSelector] : [];

  const block = readFileSync(blockFile, 'utf8');

  const { number, body } = JSON.parse(
    execFileSync('gh', ['pr', 'view', ...selector, '--json', 'number,body'], {
      encoding: 'utf8',
    }),
  );

  let nextBody;
  try {
    nextBody = upsertRecapBlock(body, block);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const hadExistingBlock = body.includes(START_MARKER) && body.includes(END_MARKER);
  execFileSync('gh', ['pr', 'edit', ...selector, '--body-file', '-'], { input: nextBody });

  console.log(
    hadExistingBlock
      ? `updated system-recap block on PR #${number}`
      : `added system-recap block to PR #${number}`,
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
