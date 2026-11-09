import { createElement as h, createRef } from 'react';
import { createRoot } from 'react-dom/client';

import { buildTextIndex, find, stepMatch, totalCount } from '../src/find.js';
import { intBetween, rng } from '../src/rng.js';
import { WindowedPage } from '../src/react.js';
import { makeDoc } from '../sim/doc.mjs';

// ?mode=engine  anchoring and pinning from this repo
// ?mode=none    no correction, and the browser's own scroll anchoring off
// ?mode=native  no correction, the browser's own scroll anchoring on
const mode = new URLSearchParams(location.search).get('mode') ?? 'engine';
const N = 10000;
const HEIGHT = 700;
const doc = makeDoc(1, N);
const index = buildTextIndex(doc.texts);
const ref = createRef();
const root = createRoot(document.getElementById('root'));

const renderBlock = (text, i) =>
  h(
    'div',
    { className: 'block', id: doc.ids[i] ?? undefined, style: { height: `${doc.heights[i]}px` } },
    h('b', null, `#${i} ${doc.kinds[i]}`),
    text
  );

function render(estimates) {
  root.render(
    h(WindowedPage, {
      ref,
      blocks: doc.texts,
      estimates,
      ids: doc.ids,
      height: HEIGHT,
      renderBlock,
      anchoring: mode === 'engine',
      nativeAnchor: mode === 'native',
    })
  );
}

const frames = (count) =>
  new Promise((resolve) => {
    let seen = 0;
    const tick = () => (++seen >= count ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });

const scroller = () => document.querySelector('#root > div');
const mountedCount = () => scroller().querySelectorAll('[data-index]').length;

async function freshPage() {
  render(doc.estimates.slice());
  await frames(3);
  scroller().scrollTop = 0;
  await frames(3);
}

function topBlock(el, containerTop) {
  for (const node of el.querySelectorAll('[data-index]')) {
    if (node.getBoundingClientRect().bottom > containerTop + 0.5) return node;
  }
  return null;
}

async function readUpwards(seed, steps) {
  await freshPage();
  const el = scroller();
  const next = rng(seed);
  ref.current.scrollToBlock(Math.floor(N / 2), 0);
  await frames(4);
  const jumps = [];
  for (let s = 0; s < steps; s++) {
    // The text the user was looking at must move by exactly the scroll step.
    const containerTop = el.getBoundingClientRect().top;
    const seen = topBlock(el, containerTop);
    const index = seen.dataset.index;
    const seenY = seen.getBoundingClientRect().top - containerTop;
    const from = el.scrollTop;
    el.scrollTop = Math.max(0, from - intBetween(next, 40, 300));
    const expected = seenY + (from - el.scrollTop);
    await frames(3);
    const node = el.querySelector(`[data-index="${index}"]`);
    jumps.push(node ? Math.abs(node.getBoundingClientRect().top - containerTop - expected) : Infinity);
  }
  // A block that is no longer mounted moved out of the window altogether; its
  // distance is unknown, so it is counted in `leftWindow` and not summed.
  const seen = jumps.filter((j) => Number.isFinite(j));
  return {
    seed,
    maxJump: Math.max(0, ...seen),
    totalJump: seen.reduce((a, b) => a + b, 0),
    stepsWithJump: jumps.filter((j) => !(j <= 1)).length,
    leftWindow: jumps.length - seen.length,
    jumps: jumps.map((j) => (Number.isFinite(j) ? Math.round(j * 100) / 100 : 'left')),
  };
}

async function deepLink(seed) {
  await freshPage();
  const el = scroller();
  const next = rng(seed);
  let target = intBetween(next, 50, N - 50);
  while (!doc.ids[target]) target++;
  const margin = 72;
  if (mode === 'engine') ref.current.scrollToId(doc.ids[target], margin);
  else el.scrollTop = ref.current.page.layout.offsetOf(target) - margin;
  await frames(4);
  const box = el.getBoundingClientRect();
  const node = document.getElementById(doc.ids[target]);
  if (!node) return { seed, error: Infinity, onScreen: false };
  const y = node.getBoundingClientRect().top - box.top;
  return { seed, error: Math.abs(y - margin), onScreen: y >= 0 && y < HEIGHT };
}

async function runAll(sessions = 10, steps = 100) {
  const up = [];
  const links = [];
  for (let seed = 1; seed <= sessions; seed++) {
    up.push(await readUpwards(seed, steps));
    links.push(await deepLink(seed));
  }
  return {
    mode,
    blocks: N,
    containerHeight: HEIGHT,
    steps,
    sessions,
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    mountedBlocks: mountedCount(),
    readUpwards: up,
    deepLink: links,
  };
}

async function save(name, data) {
  const response = await fetch(`/save/${name}`, { method: 'POST', body: JSON.stringify(data, null, 2) });
  return response.status;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function wireFind() {
  const bar = document.getElementById('bar');
  const box = document.createElement('input');
  box.id = 'q';
  box.placeholder = 'find in the whole page';
  const button = document.createElement('button');
  button.textContent = 'next';
  bar.append(' ', box, ' ', button);
  let current = -1;
  const go = () => {
    const matches = find(index, box.value);
    const block = stepMatch(matches, current, 1);
    if (block === null) return setStatus('no match');
    current = block;
    ref.current.scrollToBlock(block, 0);
    setStatus(`${totalCount(matches)} matches in ${matches.length} blocks, at block ${block}`);
  };
  button.addEventListener('click', go);
  box.addEventListener('keydown', (event) => event.key === 'Enter' && go());
}

window.demo = { mode, ref, frames, scroller, mountedCount, runAll, save, readUpwards, deepLink };

render(doc.estimates);
wireFind();
setStatus(`${mode} mode, ${N} blocks`);
// The first render is asynchronous, so wait until the page exists before
// following a link such as demo/index.html#h-4003.
const hashId = decodeURIComponent(location.hash.slice(1));
const followHash = (attemptsLeft) => {
  if (ref.current) ref.current.scrollToId(hashId, 0);
  else if (attemptsLeft > 0) requestAnimationFrame(() => followHash(attemptsLeft - 1));
};
if (hashId) followHash(60);
