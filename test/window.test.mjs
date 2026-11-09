import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';
import { spacers, visibleRange } from '../src/window.js';

function touching(heights, from, to) {
  const hit = [];
  let start = 0;
  for (let k = 0; k < heights.length; k++) {
    const end = start + heights[k];
    if (end > from && start < to) hit.push(k);
    start = end;
  }
  return hit;
}

test('every block that touches the viewport is inside the range', () => {
  const next = rng(11);
  const heights = Array.from({ length: 300 }, () => intBetween(next, 8, 500));
  const layout = new Layout(heights);
  const total = layout.total();
  for (let round = 0; round < 500; round++) {
    const viewport = intBetween(next, 200, 1200);
    const scrollTop = next() * Math.max(0, total - viewport);
    const { start, end } = visibleRange(layout, scrollTop, viewport, 0);
    for (const k of touching(heights, scrollTop, scrollTop + viewport)) {
      assert.ok(k >= start && k < end, `block ${k} outside [${start}, ${end}) at ${scrollTop}`);
    }
  }
});

test('overscan adds blocks on both sides and is cut off at the page ends', () => {
  const layout = new Layout(Array.from({ length: 50 }, () => 100));
  const plain = visibleRange(layout, 2000, 300, 0);
  const wide = visibleRange(layout, 2000, 300, 4);
  assert.equal(wide.start, plain.start - 4);
  assert.equal(wide.end, plain.end + 4);
  const top = visibleRange(layout, 0, 300, 4);
  assert.equal(top.start, 0);
  const bottom = visibleRange(layout, 4700, 300, 4);
  assert.equal(bottom.end, 50);
});

test('the mounted blocks stay a small share of a long page', () => {
  const layout = new Layout(Array.from({ length: 10000 }, () => 80));
  const { start, end } = visibleRange(layout, 400000, 900, 3);
  const most = Math.ceil(900 / 80) + 1 + 2 * 3;
  assert.ok(end - start <= most, `mounted ${end - start}, bound ${most}`);
});

test('spacers plus the mounted blocks add up to the whole page', () => {
  const next = rng(12);
  const heights = Array.from({ length: 200 }, () => intBetween(next, 10, 300));
  const layout = new Layout(heights);
  for (let round = 0; round < 200; round++) {
    const scrollTop = next() * layout.total();
    const range = visibleRange(layout, scrollTop, 800, 2);
    const { before, after } = spacers(layout, range);
    let mounted = 0;
    for (let k = range.start; k < range.end; k++) mounted += heights[k];
    assert.ok(Math.abs(before + mounted + after - layout.total()) < 1e-6);
  }
});

test('an empty page has an empty range', () => {
  const layout = new Layout([]);
  assert.deepEqual(visibleRange(layout, 0, 800, 3), { start: 0, end: 0 });
});
