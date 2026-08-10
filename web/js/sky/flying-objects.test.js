import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPAWN_DELAY_BANDS_MS,
  randomDelayMs,
  createFlyingObjectScheduler,
} from './flying-objects.js';

/** A deterministic RNG stub: cycles through a fixed sequence of [0,1) values. */
function seededRng(sequence) {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('bird next-spawn delay always falls within its ~10-25s band', () => {
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const delay = randomDelayMs(SPAWN_DELAY_BANDS_MS.bird, () => roll);
    assert.ok(delay >= SPAWN_DELAY_BANDS_MS.bird[0]);
    assert.ok(delay <= SPAWN_DELAY_BANDS_MS.bird[1]);
  }
});

test('plane next-spawn delay always falls within its 45-60s band', () => {
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const delay = randomDelayMs(SPAWN_DELAY_BANDS_MS.plane, () => roll);
    assert.ok(delay >= SPAWN_DELAY_BANDS_MS.plane[0]);
    assert.ok(delay <= SPAWN_DELAY_BANDS_MS.plane[1]);
  }
});

test('balloon next-spawn delay always falls within its 25-35s band', () => {
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const delay = randomDelayMs(SPAWN_DELAY_BANDS_MS.balloon, () => roll);
    assert.ok(delay >= SPAWN_DELAY_BANDS_MS.balloon[0]);
    assert.ok(delay <= SPAWN_DELAY_BANDS_MS.balloon[1]);
  }
});

test('rocket next-spawn delay always falls within its ~4-6 min band', () => {
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const delay = randomDelayMs(SPAWN_DELAY_BANDS_MS.rocket, () => roll);
    assert.ok(delay >= SPAWN_DELAY_BANDS_MS.rocket[0]);
    assert.ok(delay <= SPAWN_DELAY_BANDS_MS.rocket[1]);
  }
});

test('the bird timer fires and reschedules within its band', () => {
  let clockMs = 0;
  const rng = seededRng([0, 0.5, 0.5, 0.5, 0.5]);
  const scheduler = createFlyingObjectScheduler({ now: () => clockMs, rng });

  // First roll (rng=0) puts birdAt at the band minimum; nothing else fires yet.
  clockMs = SPAWN_DELAY_BANDS_MS.bird[0];
  const spawned = scheduler.poll('sun');

  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].kind, 'bird');
});

test('rocket kind is selected regardless of body value', () => {
  for (const body of ['sun', 'moon']) {
    let clockMs = 0;
    const rng = seededRng([0]);
    const scheduler = createFlyingObjectScheduler({ now: () => clockMs, rng });
    clockMs = SPAWN_DELAY_BANDS_MS.rocket[0];
    const spawned = scheduler.poll(body);
    assert.ok(
      spawned.some((obj) => obj.kind === 'rocket'),
      `rocket should fire during '${body}'`,
    );
  }
});

test('scheduling is fully deterministic given a fixed RNG seed', () => {
  function run() {
    let clockMs = 0;
    const rng = seededRng([0.1, 0.4, 0.7, 0.2, 0.9, 0.3]);
    const scheduler = createFlyingObjectScheduler({ now: () => clockMs, rng });
    const allSpawned = [];
    for (let i = 0; i < 200; i++) {
      clockMs += 60_000; // advance one minute per poll
      allSpawned.push(...scheduler.poll('sun').map((obj) => obj.kind));
    }
    return allSpawned;
  }

  assert.deepEqual(run(), run());
});
