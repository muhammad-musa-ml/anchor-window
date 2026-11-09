// Runs the demo in headless Chrome in three modes and writes
// results/browser/<mode>.json. Needs Chrome: set CHROME_PATH if it is not
// in the usual place. Run `npm run build:demo` first.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

import './serve.mjs';

const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.PORT ?? 8765);
const outDir = fileURLToPath(new URL('../results/browser/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  protocolTimeout: 600000,
  args: ['--no-first-run', '--force-device-scale-factor=1'],
});
console.log(await browser.version());

for (const mode of ['none', 'native', 'engine']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 800 });
  await page.goto(`http://127.0.0.1:${port}/demo/index.html?mode=${mode}`);
  await page.waitForFunction('window.demo !== undefined');
  const data = await page.evaluate(() => window.demo.runAll(10, 100));
  data.browser = await browser.version();
  writeFileSync(`${outDir}${mode}.json`, `${JSON.stringify(data, null, 2)}\n`);
  const jumps = data.readUpwards;
  console.log(
    mode,
    'largest jump px per session:',
    jumps.map((r) => Math.round(r.maxJump)).join(' '),
    '| deep link error px:',
    data.deepLink.map((r) => Math.round(r.error)).join(' '),
    '| mounted:',
    data.mountedBlocks
  );
  if (mode === 'engine') {
    const worst = Math.max(...jumps.map((r) => r.maxJump), ...data.deepLink.map((r) => r.error));
    if (worst > 1) {
      console.error(`FAIL: engine mode moved the text by ${worst} px`);
      process.exitCode = 1;
    }
  }
  await page.close();
}
await browser.close();
process.exit(process.exitCode ?? 0);
