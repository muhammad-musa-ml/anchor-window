import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PageWindow } from '../src/engine.js';
import { buildTextIndex, find, stepMatch, totalCount } from '../src/find.js';
import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';

const WORDS = ['token', 'refresh', 'webhook', 'schema', 'Endpoint', 'retry', 'cursor', 'limit'];

function makeTexts(seed, n) {
  const next = rng(seed);
  return Array.from({ length: n }, () => {
    const words = [];
    for (let k = intBetween(next, 3, 30); k > 0; k--) words.push(WORDS[intBetween(next, 0, WORDS.length - 1)]);
    return words.join(next() < 0.2 ? '\n  ' : ' ');
  });
}

function naiveCount(texts, query) {
  const needle = query.toLowerCase().replace(/\s+/g, ' ').trim();
  let total = 0;
  const blocks = [];
  texts.forEach((text, block) => {
    const hay = text.toLowerCase().replace(/\s+/g, ' ');
    let count = 0;
    for (let at = 0; at <= hay.length - needle.length; ) {
      if (hay.startsWith(needle, at)) {
        count++;
        at += needle.length;
      } else at++;
    }
    if (count > 0) blocks.push(block);
    total += count;
  });
  return { total, blocks };
}

test('find agrees with a character-by-character scan on 2,000 blocks', () => {
  const texts = makeTexts(41, 2000);
  const index = buildTextIndex(texts);
  for (const query of ['token', 'Refresh', 'webhook schema', 'retry cursor limit', 'x']) {
    const got = find(index, query);
    const want = naiveCount(texts, query);
    assert.equal(totalCount(got), want.total, query);
    assert.deepEqual(got.map((m) => m.block), want.blocks, query);
  }
});

test('case and the amount of white space do not matter', () => {
  const index = buildTextIndex(['The Refresh   Token', 'refresh\ntoken', 'refreshtoken']);
  assert.deepEqual(find(index, 'REFRESH token').map((m) => m.block), [0, 1]);
});

test('occurrences do not overlap, as in the browser', () => {
  const index = buildTextIndex(['aaaa', 'aaa']);
  assert.deepEqual(find(index, 'aa'), [{ block: 0, count: 2 }, { block: 1, count: 1 }]);
});

test('an empty or blank query finds nothing', () => {
  const index = buildTextIndex(['a b c']);
  assert.deepEqual(find(index, ''), []);
  assert.deepEqual(find(index, '   '), []);
});

test('stepMatch moves to the next and previous match and wraps around', () => {
  const matches = [{ block: 3, count: 1 }, { block: 9, count: 2 }, { block: 20, count: 1 }];
  assert.equal(stepMatch(matches, -1, 1), 3);
  assert.equal(stepMatch(matches, 3, 1), 9);
  assert.equal(stepMatch(matches, 20, 1), 3);
  assert.equal(stepMatch(matches, 20, -1), 9);
  assert.equal(stepMatch(matches, 3, -1), 20);
  assert.equal(stepMatch([], 0, 1), null);
});

test('a match in a block that is not mounted can be jumped to and stays put', () => {
  const texts = makeTexts(42, 500);
  texts[377] = 'the only needleword in this page';
  const index = buildTextIndex(texts);
  const layout = new Layout(texts.map(() => 90));
  const page = new PageWindow({ layout, viewport: 700 });
  const range = page.range();
  assert.ok(377 >= range.end, 'the match starts outside the mounted range');
  const [hit] = find(index, 'needleword');
  assert.equal(hit.block, 377);
  page.scrollToBlock(hit.block, 60);
  const mounted = page.range();
  assert.ok(hit.block >= mounted.start && hit.block < mounted.end);
  page.measure([[370, 400], [375, 12]]);
  assert.equal(layout.offsetOf(377) - page.scrollTop, 60);
});

test('scrollToBlock refuses an index outside the page', () => {
  const page = new PageWindow({ layout: new Layout([10, 10]), viewport: 5 });
  assert.equal(page.scrollToBlock(2), null);
  assert.equal(page.scrollToBlock(-1), null);
});
