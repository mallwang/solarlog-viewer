import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLING_STAR_DELAY_BAND_MS,
  randomDelayMs,
  createFallingStarScheduler,
} from './falling-star-scheduler.js';

/** A deterministic RNG stub: cycles through a fixed sequence of [0,1) values. */
function seededRng(sequence) {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('the next-replay delay always falls within its infrequent band', () => {
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const delay = randomDelayMs(FALLING_STAR_DELAY_BAND_MS, () => roll);
    assert.ok(delay >= FALLING_STAR_DELAY_BAND_MS[0]);
    assert.ok(delay <= FALLING_STAR_DELAY_BAND_MS[1]);
  }
});

test('poll(nowMs) returns false before the next randomized fire time', () => {
  const rng = seededRng([0.5, 0.5]);
  const scheduler = createFallingStarScheduler({ now: () => 0, rng });

  const justBefore =
    FALLING_STAR_DELAY_BAND_MS[0] +
    0.5 * (FALLING_STAR_DELAY_BAND_MS[1] - FALLING_STAR_DELAY_BAND_MS[0]) -
    1;
  assert.equal(scheduler.poll(justBefore), false);
});

test('poll(nowMs) returns true exactly at/after the fire time, then reschedules to a new future time', () => {
  const rng = seededRng([0, 0.5, 0.5]);
  const scheduler = createFallingStarScheduler({ now: () => 0, rng });

  const fireAt = FALLING_STAR_DELAY_BAND_MS[0]; // first roll (rng=0) puts it at the band minimum
  assert.equal(scheduler.poll(fireAt - 1), false);
  assert.equal(scheduler.poll(fireAt), true);

  // Immediately re-polling the same instant must not fire again — it was just rescheduled to a
  // new future time.
  assert.equal(scheduler.poll(fireAt), false);
});

test('scheduling is fully deterministic given a fixed RNG seed', () => {
  function run() {
    const rng = seededRng([0.1, 0.4, 0.7, 0.2, 0.9, 0.3]);
    const scheduler = createFallingStarScheduler({ now: () => 0, rng });
    const fired = [];
    let t = 0;
    for (let i = 0; i < 200; i++) {
      t += 60_000; // advance one minute per poll
      fired.push(scheduler.poll(t));
    }
    return fired;
  }

  assert.deepEqual(run(), run());
});

test('uses now() as the default nowMs argument when polled with no argument', () => {
  let clockMs = 0;
  const rng = seededRng([0]);
  const scheduler = createFallingStarScheduler({ now: () => clockMs, rng });

  clockMs = FALLING_STAR_DELAY_BAND_MS[0];
  assert.equal(scheduler.poll(), true);
});
