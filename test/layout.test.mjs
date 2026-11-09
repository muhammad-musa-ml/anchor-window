import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';

function naiveOffset(heights, i) {
  let sum = 0;
  for (let k = 0; k < i; k++) sum += heights[k];
  return sum;
}

function naiveIndexAt(heights, y) {
  let start = 0;
  for (let k = 0; k < heights.length; k++) {
    if (y < start + heights[k]) return k;
    start += heights[k];
  }
  return heights.length - 1;
}

test('offsetOf and total match a plain running sum', () => {
  const next = rng(1);
  const heights = Array.from({ length: 257 }, () => intBetween(next, 10, 400));
  const layout = new Layout(heights);
  for (let i = 0; i <= heights.length; i++) {
    assert.equal(layout.offsetOf(i), naiveOffset(heights, i), `offsetOf(${i})`);
  }
  assert.equal(layout.total(), naiveOffset(heights, heights.length));
});

test('indexAt matches a linear scan, including offsets on a block boundary', () => {
  const next = rng(2);
  const heights = Array.from({ length: 100 }, () => intBetween(next, 5, 60));
  const layout = new Layout(heights);
  const total = layout.total();
  for (let y = 0; y < total; y += 1) {
    assert.equal(layout.indexAt(y), naiveIndexAt(heights, y), `indexAt(${y})`);
  }
});

test('indexAt clamps below the first block and past the last one', () => {
  const layout = new Layout([10, 20, 30]);
  assert.equal(layout.indexAt(-5), 0);
  assert.equal(layout.indexAt(60), 2);
  assert.equal(layout.indexAt(10_000), 2);
});

test('setHeight keeps every prefix sum correct after many measurements', () => {
  const next = rng(3);
  const heights = Array.from({ length: 500 }, () => intBetween(next, 10, 400));
  const layout = new Layout(heights);
  for (let round = 0; round < 2000; round++) {
    const i = intBetween(next, 0, heights.length - 1);
    const value = 5 + next() * 600;
    const delta = layout.setHeight(i, value);
    assert.ok(Math.abs(delta - (value - heights[i])) < 1e-9);
    heights[i] = value;
  }
  for (let i = 0; i <= heights.length; i += 7) {
    assert.ok(Math.abs(layout.offsetOf(i) - naiveOffset(heights, i)) < 1e-6, `offsetOf(${i})`);
  }
  const total = layout.total();
  for (let k = 0; k < 300; k++) {
    const y = next() * total;
    assert.equal(layout.indexAt(y), naiveIndexAt(heights, y));
  }
});

test('setHeight marks a block as measured and leaves the others alone', () => {
  const layout = new Layout([10, 10, 10]);
  assert.equal(layout.isMeasured(1), false);
  layout.setHeight(1, 25);
  assert.equal(layout.isMeasured(1), true);
  assert.equal(layout.isMeasured(0), false);
  assert.equal(layout.height(1), 25);
  assert.equal(layout.offsetOf(2), 35);
});

test('an index that is not a block is refused instead of looping or corrupting the tree', () => {
  const layout = new Layout([10, 20, 30]);
  assert.equal(layout.offsetOf(3), 60);
  for (const bad of [0.5, -1, 4, NaN, null, undefined, '1']) {
    assert.throws(() => layout.offsetOf(bad), RangeError, `offsetOf(${bad})`);
  }
  for (const bad of [3, -1, 0.5, NaN, null, undefined]) {
    assert.throws(() => layout.setHeight(bad, 10), RangeError, `setHeight(${bad})`);
  }
  assert.equal(layout.total(), 60);
  assert.equal(layout.isMeasured(0), false);
});

test('a height that is not a size is refused and changes nothing', () => {
  const layout = new Layout([10, 20, 30]);
  for (const bad of [NaN, -1, Infinity, undefined]) {
    assert.throws(() => layout.setHeight(1, bad), RangeError, `setHeight(1, ${bad})`);
  }
  assert.equal(layout.total(), 60);
  assert.equal(layout.isMeasured(1), false);
  assert.equal(layout.setHeight(1, 0), -20);
  assert.equal(layout.total(), 40);
});

test('a page with one block, and an empty page', () => {
  const one = new Layout([42]);
  assert.equal(one.total(), 42);
  assert.equal(one.indexAt(0), 0);
  assert.equal(one.indexAt(41.9), 0);
  const none = new Layout([]);
  assert.equal(none.total(), 0);
  assert.equal(none.indexAt(5), 0);
});
