import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Layout } from '../src/layout.js';
import { WindowedPage } from '../src/react.js';
import { visibleRange } from '../src/window.js';

const N = 5000;
const blocks = Array.from({ length: N }, (_, i) => `block ${i}`);
const estimates = Array.from({ length: N }, () => 100);
const ids = Array.from({ length: N }, (_, i) => (i % 50 === 0 ? `h-${i}` : null));
const renderBlock = (text, i) => h('p', { id: ids[i] ?? undefined }, text);

function markup(props = {}) {
  return renderToStaticMarkup(
    h(WindowedPage, { blocks, estimates, ids, height: 500, renderBlock, ...props })
  );
}

test('the first render mounts the first window and nothing else', () => {
  const html = markup();
  const { start, end } = visibleRange(new Layout(estimates), 0, 500, 3);
  const indexes = [...html.matchAll(/data-index="(\d+)"/g)].map((m) => Number(m[1]));
  assert.equal(indexes.length, end - start);
  assert.deepEqual(indexes, Array.from({ length: end - start }, (_, k) => start + k));
  assert.ok(indexes.length < 20 && N > 1000);
});

test('the spacers stand in for the blocks that are not mounted', () => {
  const html = markup();
  const { end } = visibleRange(new Layout(estimates), 0, 500, 3);
  const spacers = [...html.matchAll(/aria-hidden="true" style="height:(\d+)(?:px)?"/g)].map((m) => Number(m[1]));
  assert.deepEqual(spacers, [0, (N - end) * 100]);
});

test('only the headings that are mounted exist in the page', () => {
  const html = markup();
  assert.ok(html.includes('id="h-0"'));
  assert.ok(!html.includes('id="h-2500"'));
});

test('the scroll container has its height and turns native anchoring off', () => {
  const html = markup();
  assert.match(html, /height:500px/);
  assert.match(html, /overflow-anchor:none/);
  assert.match(markup({ nativeAnchor: true }), /overflow-anchor:auto/);
});
