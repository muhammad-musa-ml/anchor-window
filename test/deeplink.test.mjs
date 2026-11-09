import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PageWindow } from '../src/engine.js';
import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';

function page(options = {}) {
  const n = 200;
  const layout = new Layout(Array.from({ length: n }, () => 100));
  const ids = Array.from({ length: n }, (_, i) => (i % 10 === 0 ? `h-${i}` : null));
  return new PageWindow({ layout, viewport: 600, ids, ...options });
}

const screenY = (p, index) => p.layout.offsetOf(index) - p.scrollTop;

test('an unknown id returns null and moves nothing', () => {
  const p = page();
  p.scrollTo(500);
  assert.equal(p.scrollToId('nope'), null);
  assert.equal(p.scrollTop, 500);
});

test('scrollToId puts the target at the top of the viewport', () => {
  const p = page();
  const result = p.scrollToId('h-120');
  assert.equal(result.index, 120);
  assert.equal(screenY(p, 120), 0);
});

test('the target stays at the top while blocks above it are measured', () => {
  const p = page();
  p.scrollToId('h-120');
  p.measure([[115, 400], [117, 15], [119, 260]]);
  assert.equal(screenY(p, 120), 0);
  p.measure([[40, 900], [118, 333]]);
  assert.equal(screenY(p, 120), 0);
});

test('with anchoring off the target drifts by the measured change', () => {
  const p = page({ anchoring: false });
  p.scrollToId('h-120');
  p.measure([[115, 400], [117, 15], [119, 260]]);
  assert.equal(screenY(p, 120), 300 - 85 + 160);
});

test('a margin leaves room for a sticky header and is kept after measuring', () => {
  const p = page();
  p.scrollToId('h-60', 72);
  assert.equal(screenY(p, 60), 72);
  p.measure([[58, 500], [59, 20]]);
  assert.equal(screenY(p, 60), 72);
});

test('the echo of our own scroll keeps the pin; a real scroll drops it', () => {
  const p = page();
  const { scrollTop } = p.scrollToId('h-60', 72);
  p.scrollTo(scrollTop + 0.4);
  assert.equal(p.pinned, true);
  p.scrollTo(scrollTop + 250);
  assert.equal(p.pinned, false);
  const before = p.anchor;
  p.measure([[59, 500]]);
  assert.deepEqual(p.anchor, before);
  assert.equal(p.scrollTop, 6000 - 72 + 250 + 400);
});

test('a target near the end of the page is clamped and still reachable', () => {
  const layout = new Layout(Array.from({ length: 200 }, () => 100));
  const ids = Array.from({ length: 200 }, (_, i) => (i === 198 ? 'tail' : null));
  const p = new PageWindow({ layout, viewport: 600, ids });
  const result = p.scrollToId('tail');
  assert.equal(result.scrollTop, p.maxScroll());
  assert.equal(screenY(p, 198), 19800 - 19400);
});

test('the first block wins when an id repeats', () => {
  const layout = new Layout(Array.from({ length: 10 }, () => 100));
  const p = new PageWindow({ layout, viewport: 300, ids: ['a', null, 'b', 'a', 'b'] });
  assert.equal(p.scrollToId('a').index, 0);
  assert.equal(p.scrollToId('b').index, 2);
});

test('over random targets and measurements the target never leaves its place', () => {
  const next = rng(31);
  for (let round = 0; round < 200; round++) {
    const layout = new Layout(Array.from({ length: 300 }, () => intBetween(next, 20, 220)));
    const ids = Array.from({ length: 300 }, (_, i) => `b-${i}`);
    const p = new PageWindow({ layout, viewport: 700, ids });
    const target = intBetween(next, 1, 250);
    const margin = intBetween(next, 0, 80);
    p.scrollToId(`b-${target}`, margin);
    for (let k = 0; k < 20; k++) {
      const entries = [];
      for (let m = intBetween(next, 1, 5); m > 0; m--) {
        const i = intBetween(next, 0, 299);
        if (i !== target) entries.push([i, intBetween(next, 10, 800)]);
      }
      p.measure(entries);
      assert.ok(Math.abs(screenY(p, target) - margin) < 1e-6, `round ${round} step ${k}`);
    }
  }
});
