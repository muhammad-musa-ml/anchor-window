import assert from 'node:assert/strict';
import { test } from 'node:test';

import { captureAnchor, scrollTopFor } from '../src/anchor.js';
import { PageWindow } from '../src/engine.js';
import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';

const screenY = (layout, index, scrollTop) => layout.offsetOf(index) - scrollTop;

test('captureAnchor and scrollTopFor are inverses', () => {
  const layout = new Layout([100, 100, 100, 100]);
  const anchor = captureAnchor(layout, 250);
  assert.deepEqual(anchor, { index: 2, offset: 50 });
  assert.equal(scrollTopFor(layout, anchor), 250);
});

test('a block measured above the anchor moves scrollTop by the same amount', () => {
  const layout = new Layout(Array.from({ length: 20 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1000);
  const before = screenY(layout, page.anchor.index, page.scrollTop);
  const next = page.measure([[3, 340]]);
  assert.equal(next, 1240);
  assert.equal(screenY(layout, page.anchor.index, page.scrollTop), before);
});

test('without anchoring the same measurement makes the text jump', () => {
  const layout = new Layout(Array.from({ length: 20 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500, anchoring: false });
  page.scrollTo(1000);
  const index = page.anchor.index;
  const before = screenY(layout, index, page.scrollTop);
  page.measure([[3, 340]]);
  assert.equal(page.scrollTop, 1000);
  assert.equal(screenY(layout, index, page.scrollTop) - before, 240);
});

test('a block measured below the anchor leaves scrollTop alone', () => {
  const layout = new Layout(Array.from({ length: 20 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1000);
  assert.equal(page.measure([[12, 900]]), 1000);
});

test('the anchor block itself growing keeps the viewport inside it', () => {
  const layout = new Layout(Array.from({ length: 20 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1040);
  assert.equal(page.measure([[10, 400]]), 1040);
  assert.deepEqual(page.anchor, { index: 10, offset: 40 });
});

test('the anchor block shrinking below the offset leaves the viewport where it was', () => {
  const layout = new Layout(Array.from({ length: 20 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1090);
  assert.equal(page.measure([[10, 30]]), 1090);
  assert.equal(layout.indexAt(page.scrollTop), 11);
});

test('a user scroll keeps the measured anchor, so what the user saw moves by the scroll delta', () => {
  const layout = new Layout(Array.from({ length: 30 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1000);
  page.measure([[10, 100]]);
  assert.equal(screenY(layout, 10, page.scrollTop), 0);
  page.scrollTo(900);
  assert.equal(page.anchor.index, 10);
  assert.equal(screenY(layout, 10, page.scrollTop), 100);
  page.measure([[8, 500], [9, 40]]);
  assert.equal(screenY(layout, 10, page.scrollTop), 100);
});

test('an anchor that is no longer mounted is replaced by the block at the top', () => {
  const layout = new Layout(Array.from({ length: 200 }, () => 100));
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(1000);
  page.measure([[10, 100]]);
  page.scrollTo(15000);
  assert.equal(page.anchor.index, 150);
});

test('scrollTop is clamped when the page gets shorter than the viewport allows', () => {
  const layout = new Layout([300, 300, 300]);
  const page = new PageWindow({ layout, viewport: 500 });
  page.scrollTo(400);
  page.measure([[0, 20], [1, 20], [2, 20]]);
  assert.equal(page.scrollTop, 0);
});

test('over random measurements the anchor block never moves on screen', () => {
  const next = rng(21);
  const layout = new Layout(Array.from({ length: 400 }, () => intBetween(next, 20, 200)));
  const page = new PageWindow({ layout, viewport: 700 });
  for (let round = 0; round < 1500; round++) {
    if (round % 5 === 0) page.scrollTo(next() * page.maxScroll());
    const index = page.anchor.index;
    const before = screenY(layout, index, page.scrollTop);
    const entries = [];
    for (let k = intBetween(next, 1, 6); k > 0; k--) {
      entries.push([intBetween(next, 0, layout.n - 1), intBetween(next, 10, 700)]);
    }
    const kept = entries.filter(([i]) => i !== index);
    page.measure(kept);
    const clampedTop = page.scrollTop === 0 || page.scrollTop === page.maxScroll();
    if (!clampedTop) {
      const after = screenY(layout, index, page.scrollTop);
      assert.ok(Math.abs(after - before) < 1e-6, `round ${round}: moved ${after - before}px`);
    }
  }
});
