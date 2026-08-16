import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearFetchCache } from '../../data/fetch-cache.js';

// A minimal fake DOM element supporting exactly the subset of the Element API
// statistics-view.js/common-topic.js/best-worst-topic.js use (innerHTML get/set, and
// querySelector for the one child selector the shell looks up) — there's no jsdom dependency in
// this project (view-level DOM rendering is otherwise covered by Playwright, per project
// convention), so this is enough to exercise the shell's fetch-once/topic-mounting logic without
// one.
function fakeElement() {
  const el = {
    _html: '',
    _content: null,
    get innerHTML() {
      return el._html;
    },
    set innerHTML(value) {
      el._html = value;
    },
    querySelector(selector) {
      if (selector === '.stats-content') {
        el._content ??= fakeElement();
        return el._content;
      }
      return null;
    },
  };
  return el;
}

let fetchCallCount = 0;

/** Always resolves ok with an empty file body — enough for every parser used here to return []. */
async function fakeFetch() {
  fetchCallCount += 1;
  return { ok: true, status: 200, text: async () => '' };
}

test.beforeEach(() => {
  fetchCallCount = 0;
  clearFetchCache();
  globalThis.window = globalThis.window ?? {};
  globalThis.fetch = fakeFetch;
});

test('fetches each source file exactly once even when the topic changes twice', async () => {
  const { render } = await import(`./statistics-view.js?case=fetch-once`);
  const container = fakeElement();

  await render(container, { plant: null, route: { params: { topic: 'common' } } });
  const afterFirst = fetchCallCount;
  assert.ok(afterFirst > 0);

  await render(container, { plant: null, route: { params: { topic: 'heatmaps' } } });
  await render(container, { plant: null, route: { params: { topic: 'common' } } });

  assert.equal(fetchCallCount, afterFirst, 'no additional network calls on topic-only changes');
});

test('mounts the renderer matching route.params.topic', async () => {
  const { render } = await import(`./statistics-view.js?case=topic-mount`);

  const commonContainer = fakeElement();
  await render(commonContainer, { plant: null, route: { params: { topic: 'common' } } });
  assert.match(commonContainer.querySelector('.stats-content').innerHTML, /tile-grid/);

  const bestWorstContainer = fakeElement();
  await render(bestWorstContainer, { plant: null, route: { params: { topic: 'best-worst' } } });
  assert.match(bestWorstContainer.querySelector('.stats-content').innerHTML, /pair-row/);
});

test('an invalid topic falls back to common', async () => {
  const { render } = await import(`./statistics-view.js?case=invalid-topic`);
  const container = fakeElement();

  await render(container, { plant: null, route: { params: { topic: 'not-a-real-topic' } } });

  assert.match(container.querySelector('.stats-content').innerHTML, /tile-grid/);
});
