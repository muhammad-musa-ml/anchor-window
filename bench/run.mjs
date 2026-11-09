// Runs the four measurements and writes results/results.json and
// results/results.md. Everything is seeded; only the timings in the last
// table change from run to run.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';
import { deepLink, findShare, readUpwards } from '../sim/scenarios.mjs';
import { NaiveLayout } from './naive-layout.mjs';

const SESSIONS = 200;
const BLOCKS = 10000;

function spread(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { min: sorted[0], median, max: sorted[sorted.length - 1] };
}

const fmt = (x, digits = 1) => Number(x).toFixed(digits);
const cell = (s, digits = 1) => `${fmt(s.median, digits)} (${fmt(s.min, digits)} to ${fmt(s.max, digits)})`;

function seeds() {
  return Array.from({ length: SESSIONS }, (_, i) => i + 1);
}

function runReadUpwards() {
  const rows = {};
  for (const anchoring of [false, true]) {
    const runs = seeds().map((seed) => readUpwards({ seed, n: BLOCKS, anchoring }));
    rows[anchoring ? 'with' : 'without'] = {
      maxJump: spread(runs.map((r) => r.maxJump)),
      totalJump: spread(runs.map((r) => r.totalJump)),
      framesWithJump: spread(runs.map((r) => r.framesWithJump)),
    };
  }
  return rows;
}

function runDeepLink() {
  const rows = {};
  for (const pinned of [false, true]) {
    const runs = seeds().map((seed) => deepLink({ seed, n: BLOCKS, pinned }));
    rows[pinned ? 'with' : 'without'] = {
      error: spread(runs.map((r) => r.error)),
      offTarget: runs.filter((r) => r.error > 1).length,
      offScreen: runs.filter((r) => !r.onScreen).length,
    };
  }
  return rows;
}

function runFind() {
  const queries = ['token', 'webhook', 'refresh token'];
  const out = findShare({ seed: 1, n: BLOCKS, queries, samples: SESSIONS });
  return { whole: out.whole, meanMounted: out.meanMounted, share: spread(out.shares) };
}

function timeLayouts() {
  const n = 100000;
  const ops = 2000;
  const next = rng(99);
  const estimates = Array.from({ length: n }, () => intBetween(next, 24, 600));
  const plan = Array.from({ length: ops }, () => ({
    i: intBetween(next, 0, n - 1),
    height: intBetween(next, 24, 900),
    j: intBetween(next, 0, n - 1),
    y: next() * 30000000,
  }));
  const run = (Make) => {
    const layout = new Make(estimates);
    let check = 0;
    const t0 = performance.now();
    for (const op of plan) {
      layout.setHeight(op.i, op.height);
      check += layout.offsetOf(op.j) + layout.indexAt(op.y);
    }
    return { ms: performance.now() - t0, check };
  };
  const rowFor = (Make) => {
    const times = [];
    let check = 0;
    for (let r = 0; r < 7; r++) {
      const out = run(Make);
      times.push(out.ms);
      check = out.check;
    }
    return { ms: spread(times), check };
  };
  const fenwick = rowFor(Layout);
  const naive = rowFor(NaiveLayout);
  if (Math.abs(fenwick.check - naive.check) > 1e-3 * Math.abs(naive.check)) {
    throw new Error(`layouts disagree: ${fenwick.check} vs ${naive.check}`);
  }
  return { blocks: n, operations: ops, runs: 7, fenwick: fenwick.ms, naive: naive.ms };
}

const results = {
  note: 'Seeded: the first three tables repeat exactly; only the timings vary.',
  sessions: SESSIONS,
  blocks: BLOCKS,
  readUpwards: runReadUpwards(),
  deepLink: runDeepLink(),
  find: runFind(),
  layoutTime: timeLayouts(),
};

const r = results.readUpwards;
const d = results.deepLink;
const f = results.find;
const t = results.layoutTime;
const lines = [
  `Page of ${BLOCKS} blocks, ${SESSIONS} seeded sessions. Each cell is median (min to max).`,
  '',
  '| Reading upwards, 300 wheel steps | no correction | with anchoring |',
  '| --- | --- | --- |',
  `| largest single jump, px | ${cell(r.without.maxJump)} | ${cell(r.with.maxJump)} |`,
  `| total jump over the session, px | ${cell(r.without.totalJump, 0)} | ${cell(r.with.totalJump)} |`,
  `| steps with a jump over 1 px, of 300 | ${cell(r.without.framesWithJump, 0)} | ${cell(r.with.framesWithJump, 0)} |`,
  '',
  '| Deep link to a random heading, 72 px below the top | no pin | pinned |',
  '| --- | --- | --- |',
  `| distance from the intended place, px | ${cell(d.without.error)} | ${cell(d.with.error)} |`,
  `| sessions more than 1 px off, of ${SESSIONS} | ${d.without.offTarget} | ${d.with.offTarget} |`,
  `| sessions with the heading off screen, of ${SESSIONS} | ${d.without.offScreen} | ${d.with.offScreen} |`,
  '',
  `Find: the browser's own find, at a random scroll position with about ${fmt(f.meanMounted, 1)} blocks mounted, sees a median ${fmt(f.share.median * 100, 2)}% (${fmt(f.share.min * 100, 2)}% to ${fmt(f.share.max * 100, 2)}%) of the matches the page-wide index finds. Page-wide counts: ${Object.entries(f.whole).map(([q, c]) => `"${q}" ${c}`).join(', ')}.`,
  '',
  `| Layout cost, ${t.operations} operations on ${t.blocks} blocks, ${t.runs} runs, ms | prefix loop | Fenwick tree |`,
  '| --- | --- | --- |',
  `| median (min to max) | ${cell(t.naive)} | ${cell(t.fenwick, 2)} |`,
];

const outDir = fileURLToPath(new URL('../results/', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}results.json`, `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(`${outDir}results.md`, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
