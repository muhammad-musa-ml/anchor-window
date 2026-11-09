import { intBetween, rng } from '../src/rng.js';

// A made-up documentation page. Each kind of block has a true height range, and
// the layout starts from the midpoint of that range, so the estimate is right
// on average and wrong for most single blocks.
export const KINDS = [
  { name: 'heading', weight: 0.08, lo: 36, hi: 64, words: [2, 5] },
  { name: 'paragraph', weight: 0.55, lo: 24, hi: 180, words: [20, 60] },
  { name: 'code', weight: 0.2, lo: 90, hi: 640, words: [5, 40] },
  { name: 'image', weight: 0.07, lo: 160, hi: 720, words: [1, 3] },
  { name: 'list', weight: 0.1, lo: 40, hi: 300, words: [8, 40] },
];

export const VOCABULARY = [
  'token', 'refresh', 'webhook', 'schema', 'endpoint', 'retry', 'cursor', 'limit',
  'request', 'response', 'header', 'payload', 'signature', 'version', 'project',
  'deploy', 'branch', 'config', 'theme', 'search', 'page', 'navigation', 'example', 'error',
];

const midpoint = (kind) => Math.round((kind.lo + kind.hi) / 2);

export function makeDoc(seed, n) {
  const next = rng(seed);
  const heights = new Array(n);
  const estimates = new Array(n);
  const ids = new Array(n);
  const texts = new Array(n);
  const kinds = new Array(n);
  for (let i = 0; i < n; i++) {
    let pick = next();
    let kind = KINDS[KINDS.length - 1];
    for (const candidate of KINDS) {
      if (pick < candidate.weight) {
        kind = candidate;
        break;
      }
      pick -= candidate.weight;
    }
    kinds[i] = kind.name;
    heights[i] = intBetween(next, kind.lo, kind.hi);
    estimates[i] = midpoint(kind);
    ids[i] = kind.name === 'heading' ? `h-${i}` : null;
    const words = [];
    for (let w = intBetween(next, kind.words[0], kind.words[1]); w > 0; w--) {
      words.push(VOCABULARY[intBetween(next, 0, VOCABULARY.length - 1)]);
    }
    texts[i] = words.join(' ');
  }
  return { heights, estimates, ids, texts, kinds };
}
