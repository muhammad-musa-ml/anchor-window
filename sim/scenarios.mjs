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
 * Read upwards from the middle of the page, one wheel step per frame. After
 * each step the browser measures the blocks that just came into the window.
 * A jump is how far the block at the top of the viewport moved on screen
 * because of those measurements.
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
    page.scrollTo(page.scrollTop - intBetween(next, 40, 300));
    const top = page.layout.indexAt(page.scrollTop);
    const before = screenY(page, top);
    settle(page, doc.heights);
    const jump = Math.abs(screenY(page, top) - before);
    maxJump = Math.max(maxJump, jump);
    totalJump += jump;
    if (jump > 1) framesWithJump++;
  }
  return { maxJump, totalJump, framesWithJump };
}

/**
 * Jump to a random heading, 72 px below the top of the viewport. The error is
 * how far the heading ends up from that place once the browser has measured
 * the blocks around it.
 */
export function deepLink({ seed, n = 10000, pinned }) {
  const doc = makeDoc(seed, n);
  const margin = 72;
  const next = rng(seed * 104729 + 3);
  let target = intBetween(next, 50, n - 50);
  while (!doc.ids[target]) target++;
  const page = newPage(doc, { anchoring: pinned });
  if (pinned) page.scrollToId(doc.ids[target], margin);
  else page.scrollTo(page.layout.offsetOf(target) - margin);
  settle(page, doc.heights);
  const error = screenY(page, target) - margin;
  const y = screenY(page, target);
  return { error: Math.abs(error), onScreen: y >= 0 && y < VIEWPORT };
}

/** How much of a page-wide search the browser's own find could see. */
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
