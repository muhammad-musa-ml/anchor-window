import { buildTextIndex, find, totalCount } from '../src/find.js';
import { PageWindow } from '../src/engine.js';
import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';
import { screenY, settle } from './browser.mjs';
import { makeDoc } from './doc.mjs';

const VIEWPORT = 900;

function newPage(doc, options) {
  const layout = new Layout(doc.estimates);
  return new PageWindow({ layout, viewport: VIEWPORT, ids: doc.ids, ...options });
}

/**
 * Read upwards from the middle of the page, one scroll step per frame (a
 * scrollTop set directly, 40 to 300 px). After each step the browser measures
 * the blocks that just came into the window. The text the user was looking at
 * should move by exactly the scroll step. A jump is how far the block that was
 * at the top of the viewport before the step ends up from where that rule
 * puts it.
 */
export function readUpwards({ seed, n = 10000, frames = 300, anchoring }) {
  const doc = makeDoc(seed, n);
  const page = newPage(doc, { anchoring });
  const next = rng(seed * 7919 + 1);
  page.scrollTo(page.layout.offsetOf(Math.floor(n / 2)));
  settle(page, doc.heights);
  let maxJump = 0;
  let totalJump = 0;
  let framesWithJump = 0;
  for (let f = 0; f < frames; f++) {
    const seen = page.layout.indexAt(page.scrollTop);
    const seenY = screenY(page, seen);
    const from = page.scrollTop;
    page.scrollTo(from - intBetween(next, 40, 300));
    const expected = seenY + (from - page.scrollTop);
    settle(page, doc.heights);
    const jump = Math.abs(screenY(page, seen) - expected);
    maxJump = Math.max(maxJump, jump);
    totalJump += jump;
    if (jump > 1) framesWithJump++;
  }
  return { maxJump, totalJump, framesWithJump };
}

/**
 * Jump to a random heading, 72 px below the top of the viewport. The error is
 * how far the heading ends up from that place once the browser has measured
 * the blocks around it. `jump` is 'pinned' (scrollToId, anchoring on) or
 * 'estimate' (one jump to the estimated offset, anchoring off).
 */
export function deepLink({ seed, n = 10000, jump }) {
  if (jump !== 'pinned' && jump !== 'estimate') throw new Error(`jump is ${jump}`);
  const doc = makeDoc(seed, n);
  const margin = 72;
  const next = rng(seed * 104729 + 3);
  let target = intBetween(next, 50, n - 50);
  while (!doc.ids[target]) target++;
  const page = newPage(doc, { anchoring: jump === 'pinned' });
  if (jump === 'pinned') page.scrollToId(doc.ids[target], margin);
  else page.scrollTo(page.layout.offsetOf(target) - margin);
  settle(page, doc.heights);
  const error = screenY(page, target) - margin;
  const y = screenY(page, target);
  return { error: Math.abs(error), onScreen: y >= 0 && y < VIEWPORT };
}

/**
 * What share of a page-wide search falls inside the mounted blocks, which is
 * all the browser's own find can see. One page (the seed), `samples` random
 * scroll positions, every query at every position.
 */
export function findShare({ seed, n = 10000, queries, samples = 200 }) {
  const doc = makeDoc(seed, n);
  const index = buildTextIndex(doc.texts);
  const next = rng(seed * 15485863 + 5);
  const whole = new Map(queries.map((q) => [q, totalCount(find(index, q))]));
  const shares = [];
  let mountedBlocks = 0;
  for (let s = 0; s < samples; s++) {
    const page = newPage(doc, {});
    page.scrollTo(next() * page.maxScroll());
    settle(page, doc.heights);
    const { start, end } = page.range();
    mountedBlocks += end - start;
    for (const q of queries) {
      const seen = totalCount(find(index.slice(start, end), q));
      shares.push(seen / whole.get(q));
    }
  }
  return { whole: Object.fromEntries(whole), shares, meanMounted: mountedBlocks / samples };
}
