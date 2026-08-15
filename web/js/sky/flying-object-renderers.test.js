/**
 * @file Unit tests for web/js/sky/flying-object-renderers.js
 * Run with: node --test web/js/sky/flying-object-renderers.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// jsdom is not available here; simulate the minimum DOM needed for the renderer.
// We use a minimal HTMLElement stub so tests can run under Node without a browser.
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.dataset = {};
    this._style = {};
    this.children = [];
    this.textContent = '';
    this._listeners = {};
  }

  get style() {
    return {
      setProperty: (name, value) => {
        this._style[name] = value;
      },
      getPropertyValue: (name) => this._style[name] ?? '',
    };
  }

  setAttribute(name, value) {
    this.dataset[name] = value;
  }

  getAttribute(name) {
    return this.dataset[name] ?? null;
  }

  append(child) {
    this.children.push(child);
  }

  addEventListener(event, handler) {
    this._listeners[event] = handler;
  }
}

// Inject a minimal document global so createBirdElement can call document.createElement.
const fakeDoc = {
  createElement: (tag) => new FakeElement(tag),
};
globalThis.document = fakeDoc;

// Now import the module under test (after patching document).
const { createBirdElement, createPlaneElement, createBalloonElement, createRocketElement } =
  await import('./flying-object-renderers.js');

describe('createBirdElement', () => {
  it('returns an HTMLElement-like object with correct classes', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 15 });
    assert.ok(el instanceof FakeElement, 'should return a FakeElement (HTMLElement)');
    assert.ok(
      el.className.includes('sky-flying-object'),
      'outer element should have class sky-flying-object',
    );
    assert.ok(
      el.className.includes('sky-flying-object--bird'),
      'outer element should have class sky-flying-object--bird',
    );
  });

  it('sets --lane-top and --flight-duration CSS custom properties on outer element', () => {
    const el = createBirdElement({ durationS: 13.5, laneTopPct: 20 });
    assert.ok(el._style['--lane-top'] !== undefined, 'should set --lane-top CSS variable');
    assert.ok(el._style['--lane-top'].includes('20'), '--lane-top should encode laneTopPct value');
    assert.ok(
      el._style['--flight-duration'] !== undefined,
      'should set --flight-duration CSS variable',
    );
    assert.ok(
      el._style['--flight-duration'].includes('13.5') ||
        el._style['--flight-duration'].includes('13'),
      '--flight-duration should encode durationS value',
    );
  });

  it('outer element contains a child .sky-bird-sprite', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
    const sprite = el.children.find((c) => c.className.includes('sky-bird-sprite'));
    assert.ok(sprite, 'should have a child element with class sky-bird-sprite');
  });

  it('sets --wingbeat-duration on .sky-bird-sprite within [0.4, 0.9] s', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
    const sprite = el.children.find((c) => c.className.includes('sky-bird-sprite'));
    const raw = sprite._style['--wingbeat-duration'];
    assert.ok(raw, 'sky-bird-sprite should have --wingbeat-duration CSS variable');
    const val = Number.parseFloat(raw);
    assert.ok(val >= 0.4 && val <= 0.9, `--wingbeat-duration ${val}s should be in [0.4, 0.9]`);
  });

  it('sets --bird-scale on .sky-bird-sprite within [0.25, 0.5]', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
    const sprite = el.children.find((c) => c.className.includes('sky-bird-sprite'));
    const raw = sprite._style['--bird-scale'];
    assert.ok(raw !== undefined, 'sky-bird-sprite should have --bird-scale CSS variable');
    const val = Number.parseFloat(raw);
    assert.ok(val >= 0.25 && val <= 0.5, `--bird-scale ${val} should be in [0.25, 0.5]`);
  });

  it('produces distinct --bird-scale values across 10 spawns', () => {
    const scales = new Set();
    for (let i = 0; i < 10; i++) {
      const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
      const sprite = el.children.find((c) => c.className.includes('sky-bird-sprite'));
      scales.add(sprite._style['--bird-scale']);
    }
    assert.ok(
      scales.size >= 3,
      `Expected at least 3 distinct --bird-scale values across 10 spawns, got ${scales.size}`,
    );
  });

  it('textContent of outer element is empty (no emoji or text)', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
    // textContent on our FakeElement is a plain property — check it's empty/unset.
    assert.strictEqual(el.textContent, '', 'outer element textContent should be empty');
  });

  it('produces at least two distinct data-wavy-profile values across 10 spawns', () => {
    const profiles = new Set();
    for (let i = 0; i < 10; i++) {
      const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
      const profile = el.getAttribute('data-wavy-profile');
      assert.ok(
        profile === 'a' || profile === 'b',
        `data-wavy-profile should be "a" or "b", got "${profile}"`,
      );
      profiles.add(profile);
    }
    assert.ok(
      profiles.size >= 2,
      `Expected at least 2 distinct data-wavy-profile values across 10 spawns, got ${profiles.size}`,
    );
  });

  it('sets data-direction to ltr or rtl when passed explicitly', () => {
    const ltrEl = createBirdElement({ durationS: 12, laneTopPct: 10, direction: 'ltr' });
    assert.strictEqual(
      ltrEl.getAttribute('data-direction'),
      'ltr',
      'should set data-direction="ltr"',
    );

    const rtlEl = createBirdElement({ durationS: 12, laneTopPct: 10, direction: 'rtl' });
    assert.strictEqual(
      rtlEl.getAttribute('data-direction'),
      'rtl',
      'should set data-direction="rtl"',
    );
  });

  it('defaults data-direction to ltr when not specified', () => {
    const el = createBirdElement({ durationS: 12, laneTopPct: 10 });
    assert.strictEqual(el.getAttribute('data-direction'), 'ltr', 'default direction should be ltr');
  });
});

describe('createPlaneElement', () => {
  it('returns an element with correct classes', () => {
    const el = createPlaneElement({ durationS: 20, laneTopPct: 10 });
    assert.ok(el.className.includes('sky-flying-object'), 'should have sky-flying-object class');
    assert.ok(
      el.className.includes('sky-flying-object--plane'),
      'should have sky-flying-object--plane class',
    );
  });

  it('sets --lane-top and --flight-duration', () => {
    const el = createPlaneElement({ durationS: 22, laneTopPct: 15 });
    assert.ok(el._style['--lane-top'].includes('15'), '--lane-top should encode laneTopPct');
    assert.ok(
      el._style['--flight-duration'].includes('22'),
      '--flight-duration should encode durationS',
    );
  });

  it('contains a child .sky-plane-sprite', () => {
    const el = createPlaneElement({ durationS: 20, laneTopPct: 10 });
    const sprite = el.children.find((c) => c.className.includes('sky-plane-sprite'));
    assert.ok(sprite, 'should have a child .sky-plane-sprite');
  });

  it('sets --plane-scale on .sky-plane-sprite within [1.7, 2.3]', () => {
    const el = createPlaneElement({ durationS: 20, laneTopPct: 10 });
    const sprite = el.children.find((c) => c.className.includes('sky-plane-sprite'));
    const val = Number.parseFloat(sprite._style['--plane-scale']);
    assert.ok(val >= 1.7 && val <= 2.3, `--plane-scale ${val} should be in [1.7, 2.3]`);
  });

  it('produces distinct --plane-scale values across 10 spawns', () => {
    const scales = new Set();
    for (let i = 0; i < 10; i++) {
      const el = createPlaneElement({ durationS: 20, laneTopPct: 10 });
      scales.add(
        el.children.find((c) => c.className.includes('sky-plane-sprite'))._style['--plane-scale'],
      );
    }
    assert.ok(scales.size >= 3, `Expected ≥3 distinct --plane-scale values, got ${scales.size}`);
  });

  it('sets data-direction when passed', () => {
    assert.strictEqual(
      createPlaneElement({ durationS: 20, laneTopPct: 10, direction: 'rtl' }).getAttribute(
        'data-direction',
      ),
      'rtl',
    );
    assert.strictEqual(
      createPlaneElement({ durationS: 20, laneTopPct: 10 }).getAttribute('data-direction'),
      'ltr',
      'default should be ltr',
    );
  });
});

describe('createBalloonElement', () => {
  it('returns an element with correct classes', () => {
    const el = createBalloonElement({ durationS: 25, laneTopPct: 40 });
    assert.ok(el.className.includes('sky-flying-object'), 'should have sky-flying-object class');
    assert.ok(
      el.className.includes('sky-flying-object--balloon'),
      'should have sky-flying-object--balloon class',
    );
  });

  it('sets --lane-top and --flight-duration', () => {
    const el = createBalloonElement({ durationS: 28, laneTopPct: 50 });
    assert.ok(el._style['--lane-top'].includes('50'), '--lane-top should encode laneTopPct');
    assert.ok(
      el._style['--flight-duration'].includes('28'),
      '--flight-duration should encode durationS',
    );
  });

  it('contains a child .sky-balloon-sprite', () => {
    const el = createBalloonElement({ durationS: 25, laneTopPct: 40 });
    const sprite = el.children.find((c) => c.className.includes('sky-balloon-sprite'));
    assert.ok(sprite, 'should have a child .sky-balloon-sprite');
  });

  it('sets --balloon-scale on .sky-balloon-sprite within [0.8, 1.0]', () => {
    const el = createBalloonElement({ durationS: 25, laneTopPct: 40 });
    const sprite = el.children.find((c) => c.className.includes('sky-balloon-sprite'));
    const val = Number.parseFloat(sprite._style['--balloon-scale']);
    assert.ok(val >= 0.8 && val <= 1.0, `--balloon-scale ${val} should be in [0.8, 1.0]`);
  });

  it('produces distinct --balloon-scale values across 10 spawns', () => {
    const scales = new Set();
    for (let i = 0; i < 10; i++) {
      const el = createBalloonElement({ durationS: 25, laneTopPct: 40 });
      scales.add(
        el.children.find((c) => c.className.includes('sky-balloon-sprite'))._style[
          '--balloon-scale'
        ],
      );
    }
    assert.ok(scales.size >= 3, `Expected ≥3 distinct --balloon-scale values, got ${scales.size}`);
  });

  it('sets data-direction when passed', () => {
    assert.strictEqual(
      createBalloonElement({ durationS: 25, laneTopPct: 40, direction: 'rtl' }).getAttribute(
        'data-direction',
      ),
      'rtl',
    );
    assert.strictEqual(
      createBalloonElement({ durationS: 25, laneTopPct: 40 }).getAttribute('data-direction'),
      'ltr',
      'default should be ltr',
    );
  });
});

describe('createRocketElement', () => {
  it('returns an element with correct classes', () => {
    const el = createRocketElement({ durationS: 10, laneTopPct: 50 });
    assert.ok(el.className.includes('sky-flying-object'), 'should have sky-flying-object class');
    assert.ok(
      el.className.includes('sky-flying-object--rocket'),
      'should have sky-flying-object--rocket class',
    );
  });

  it('sets --lane-left (not --lane-top) for horizontal position', () => {
    const el = createRocketElement({ durationS: 10, laneTopPct: 60 });
    assert.ok(el._style['--lane-left'].includes('60'), '--lane-left should encode laneTopPct');
    assert.strictEqual(
      el._style['--lane-top'],
      undefined,
      '--lane-top should not be set for rocket',
    );
  });

  it('sets --flight-duration', () => {
    const el = createRocketElement({ durationS: 11, laneTopPct: 40 });
    assert.ok(
      el._style['--flight-duration'].includes('11'),
      '--flight-duration should encode durationS',
    );
  });

  it('contains a child .sky-rocket-sprite', () => {
    const el = createRocketElement({ durationS: 10, laneTopPct: 50 });
    const sprite = el.children.find((c) => c.className.includes('sky-rocket-sprite'));
    assert.ok(sprite, 'should have a child .sky-rocket-sprite');
  });
});
