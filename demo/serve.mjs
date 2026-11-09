// A static server for the demo, on localhost only. A POST to /save/<name>
// writes the body to results/browser/<name>.json; window.demo.save in
// demo/main.js posts to it, and no script in this repository calls
// window.demo.save.
// demo/measure.mjs and demo/check.mjs import this file to serve the page and
// write their results themselves.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname.startsWith('/save/')) {
    const name = url.pathname.slice('/save/'.length);
    if (!/^[a-z0-9-]+$/.test(name)) {
      res.writeHead(400);
      return res.end('bad name');
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      mkdirSync(join(root, 'results', 'browser'), { recursive: true });
      writeFileSync(join(root, 'results', 'browser', `${name}.json`), Buffer.concat(chunks));
      res.writeHead(204);
      res.end();
    });
    return undefined;
  }
  const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  return res.end(readFileSync(file));
});

const port = Number(process.env.PORT ?? 8765);
server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/demo/index.html`));
