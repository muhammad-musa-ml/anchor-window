// Turns results/browser/<mode>.json into one table, and writes it to
// results/browser.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../results/', import.meta.url));
const modes = [
  ['none', 'no correction, Chrome scroll anchoring off'],
  ['native', "no correction, Chrome's own scroll anchoring on"],
  ['engine', 'this window'],
];

function spread(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return `${Math.round(median)} (${Math.round(sorted[0])} to ${Math.round(sorted[sorted.length - 1])})`;
}

const rows = [];
let first;
for (const [mode, label] of modes) {
  const data = JSON.parse(readFileSync(`${dir}browser/${mode}.json`, 'utf8'));
  first ??= data;
  const up = data.readUpwards;
  const link = data.deepLink;
  rows.push(
    `| ${label} | ${spread(up.map((r) => r.maxJump))} | ${spread(up.map((r) => r.stepsWithJump))} | ${spread(up.map((r) => r.leftWindow))} | ${spread(link.map((r) => (Number.isFinite(r.error) ? r.error : 99999)))} | ${link.filter((r) => !r.onScreen).length} |`
  );
}

const lines = [
  `${first.browser}, ${first.sessions} sessions of ${first.steps} wheel steps on a page of ${first.blocks} blocks in a ${first.containerHeight} px container. Cells are median (min to max) over the sessions.`,
  '',
  '| mode | largest jump, px | steps with a jump over 1 px, of 100 | steps where the block left the window | deep link: distance from the intended place, px | deep links with the heading off screen, of 10 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
];
writeFileSync(`${dir}browser.md`, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
