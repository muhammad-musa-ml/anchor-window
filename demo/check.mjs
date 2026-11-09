// Two checks of the demo in headless Chrome: a link with a heading id in the
// address lands on that heading, and pressing next in the page-wide find 100
// times ends on a match more than 1,000 blocks from the start and lands that
// block at the top of the page. It also counts what the browser's own find
// would see in the mounted text and fails if that is 5% or more of the
// matches. Writes results/check.md, with the browser version; exits 1 on a
// failure. Needs `npm run build:demo` first.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import { buildTextIndex, find, totalCount } from '../src/find.js';
import { makeDoc } from '../sim/doc.mjs';
import './serve.mjs';

const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.PORT ?? 8765);
const base = `http://127.0.0.1:${port}/demo/index.html?mode=engine`;
const doc = makeDoc(1, 10000);

let target = 4000;
while (!doc.ids[target]) target++;
const matches = find(buildTextIndex(doc.texts), 'refresh token');

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
let failed = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 800 });

  await page.goto(`${base}#${doc.ids[target]}`);
  await page.waitForFunction('window.demo !== undefined');
  await page.evaluate(() => window.demo.frames(8));
  const offset = await page.evaluate((id) => {
    const top = window.demo.scroller().getBoundingClientRect().top;
    const node = document.getElementById(id);
    return node ? node.getBoundingClientRect().top - top : null;
  }, doc.ids[target]);
  assert.ok(offset !== null && Math.abs(offset) < 1, `${doc.ids[target]} is ${offset} px from the top`);
  console.log(`link to #${doc.ids[target]}: heading is ${offset} px from the top of the page`);

  await page.goto(base);
  await page.waitForFunction('window.demo !== undefined');
  await page.type('#q', 'refresh token');
  for (let press = 0; press < 100; press++) {
    await page.click('button');
    await page.evaluate(() => window.demo.frames(2));
  }
  await page.evaluate(() => window.demo.frames(8));
  const found = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    mounted: window.demo.mountedCount(),
  }));
  const block = matches[99].block;
  assert.ok(block > 1000, `the 100th match is at block ${block}, which is not far from the start`);
  assert.equal(found.status, `${totalCount(matches)} matches in ${matches.length} blocks, at block ${block}`);
  const where = await page.evaluate((index) => {
    const top = window.demo.scroller().getBoundingClientRect().top;
    const node = document.querySelector(`[data-index="${index}"]`);
    return node ? node.getBoundingClientRect().top - top : null;
  }, block);
  assert.ok(where !== null && Math.abs(where) < 1, `block ${block} is ${where} px from the top`);
  console.log(`find: ${found.status}; block ${block} is ${where} px from the top, ${found.mounted} blocks mounted`);

  // What the browser's own find can see is the text of the mounted blocks.
  const inDom = await page.evaluate(
    () => document.body.innerText.toLowerCase().replace(/\s+/g, ' ').split('refresh token').length - 1
  );
  const everywhere = totalCount(matches);
  assert.ok(inDom * 20 < everywhere, `${inDom} of ${everywhere} matches are in the document text`);
  console.log(`"refresh token" in document.body.innerText: ${inDom} of ${everywhere}`);

  const version = await browser.version();
  const report = [
    `Headless ${version}, demo page of ${doc.texts.length} blocks, engine mode (npm run check:demo).`,
    '',
    `- Link to #${doc.ids[target]}: the heading is ${offset} px from the top of the page.`,
    `- Page-wide find for "refresh token": ${found.status}; pressing next 100 times (one block per press) lands on block ${block}, ${where} px from the top, with ${found.mounted} blocks mounted.`,
    `- "refresh token" in document.body.innerText, which is what the browser's find sees: ${inDom} of the ${everywhere} matches in the page.`,
  ];
  writeFileSync(fileURLToPath(new URL('../results/check.md', import.meta.url)), `${report.join('\n')}\n`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
