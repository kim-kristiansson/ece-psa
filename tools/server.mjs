// Dev server: node tools/server.mjs [port]  -> open http://localhost:PORT/ to watch the animation in a browser.
import { ROOT } from './_lib.mjs';
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const port = Number(process.argv[2] || 8080);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp4': 'video/mp4', '.wav': 'audio/wav' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${ROOT} at http://localhost:${port}/`));
