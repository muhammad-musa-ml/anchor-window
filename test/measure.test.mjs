import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PageWindow } from '../src/engine.js';
import { Layout } from '../src/layout.js';
import { canMeasure, entriesFromRecords, measureAt } from '../src/measure.js';

// Just enough of a DOM node for the two functions: what they read.
const node = (index, height, isConnected = true) => ({
  isConnected,
  dataset: { index: String(index) },
  getBoundingClientRect: () => ({ height }),
});

test('a record becomes an [index, height] pair when the height moved by half a pixel or more', () => {
  const layout = new Layout([100, 100, 100, 100]);
  const records = [
    { target: node(0, 100.3) },
    { target: node(1, 100.5) },
    { target: node(2, 99.5) },
    { target: node(3, 250) },
  ];
  assert.deepEqual(entriesFromRecords(records, layout), [[1, 100.5], [2, 99.5], [3, 250]]);
});

test('a node that is no longer in the document is skipped, whatever it reports', () => {
  const layout = new Layout([100, 100]);
  const records = [{ target: node(0, 0, false) }, { target: node(1, 180) }];
  assert.deepEqual(entriesFromRecords(records, layout), [[1, 180]]);
});

test('a container with no height cannot be measured', () => {
  assert.equal(canMeasure({ clientHeight: 0 }), false);
  assert.equal(canMeasure({ clientHeight: 700 }), true);
});

test('measureAt starts from the scrollTop the browser has, not the one the window last saw', () => {
  const build = () => {
    const layout = new Layout(Array.from({ length: 30 }, () => 100));
    const page = new PageWindow({ layout, viewport: 500 });
    page.scrollTo(1000);
    page.measure([[10, 100]]);
    return page;
  };
  // The reader scrolled up to 900 and block 9 was measured before the scroll
  // event arrived, so the window still believes the scrollTop is 1000.
  const stale = build();
  assert.equal(stale.measure([[9, 300]]), 1200);
  const synced = build();
  assert.equal(measureAt(synced, 900, [[9, 300]]), 1100);
  assert.equal(synced.layout.offsetOf(10) - synced.scrollTop, 100);
});
