import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NaiveLayout } from '../bench/naive-layout.mjs';
import { Layout } from '../src/layout.js';
import { intBetween, rng } from '../src/rng.js';
import { deepLink, readUpwards } from '../sim/scenarios.mjs';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

test('the simulation repeats exactly for one seed', () => {
  assert.deepEqual(
    readUpwards({ seed: 3, n: 2000, frames: 60, anchoring: false }),
    readUpwards({ seed: 3, n: 2000, frames: 60, anchoring: false })
  );
});

test('reading upwards with anchoring never moves the text', () => {
  for (const seed of SEEDS) {
    const run = readUpwards({ seed, n: 2000, frames: 100, anchoring: true });
    assert.ok(run.maxJump < 1e-6, `seed ${seed}: ${run.maxJump}px`);
    assert.equal(run.framesWithJump, 0);
  }
});

test('reading upwards without it moves the text by whole blocks', () => {
  for (const seed of SEEDS) {
    const run = readUpwards({ seed, n: 2000, frames: 100, anchoring: false });
    assert.ok(run.maxJump > 50, `seed ${seed}: only ${run.maxJump}px`);
    assert.ok(run.framesWithJump > 20, `seed ${seed}: ${run.framesWithJump} steps`);
  }
});

test('a pinned deep link lands exactly where it was asked to', () => {
  for (const seed of SEEDS) {
    const run = deepLink({ seed, n: 2000, pinned: true });
    assert.ok(run.error < 1e-6, `seed ${seed}: ${run.error}px`);
    assert.equal(run.onScreen, true);
  }
});

test('an unpinned jump to the estimated offset ends up elsewhere', () => {
  const off = SEEDS.filter((seed) => deepLink({ seed, n: 2000, pinned: false }).error > 1);
  assert.ok(off.length >= SEEDS.length - 1, `only ${off.length} of ${SEEDS.length} were off`);
});

test('the prefix loop used in the benchmark agrees with the Fenwick layout', () => {
  const next = rng(77);
  const estimates = Array.from({ length: 700 }, () => intBetween(next, 20, 300));
  const fast = new Layout(estimates);
  const slow = new NaiveLayout(estimates);
  for (let round = 0; round < 500; round++) {
    const i = intBetween(next, 0, 699);
    const height = intBetween(next, 10, 800);
    fast.setHeight(i, height);
    slow.setHeight(i, height);
    const j = intBetween(next, 0, 699);
    assert.ok(Math.abs(fast.offsetOf(j) - slow.offsetOf(j)) < 1e-6);
    const y = next() * fast.total();
    assert.equal(fast.indexAt(y), slow.indexAt(y));
  }
});
