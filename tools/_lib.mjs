// Shared helpers for the tools: locate playwright, start a static server, open the page in headless mode.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs', '/usr/lib/node_modules/playwright/index.mjs'];
  for (const c of candidates) { try { return await import(c); } catch (e) { /* try next */ } }
  throw new Error('playwright not found. Run: npm install');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.json': 'application/json' };
export function startServer(root = ROOT) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ server: srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

export async function openPage(opts = {}) {
  const pw = await loadPlaywright();
  const { server, url } = await startServer();
  const browser = await pw.chromium.launch({ executablePath: process.env.PSA_CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !opts.quiet) console.error('[page]', m.text()); });
  await page.goto(url + 'index.html?render=1', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__psa, null, { timeout: 15000 });
  if (errors.length) { console.error('Page errors while loading:\n  ' + errors.join('\n  ')); }
  return { page, browser, server, errors, close: async () => { await browser.close(); server.close(); } };
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
      if (out[k] === undefined) out[k] = v; else if (Array.isArray(out[k])) out[k].push(v); else out[k] = [out[k], v];
    } else out._.push(a);
  }
  return out;
}
export const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
export function writeDataUrl(file, dataUrl) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); }
