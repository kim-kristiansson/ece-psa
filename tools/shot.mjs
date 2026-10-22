// Frame inspection tool (headless Chromium). Examples:
//   node tools/shot.mjs --t 12.5 --t 30                 # single frames -> out/shots/t012.50.png (3x upscale)
//   node tools/shot.mjs --sheet 45 70 --n 12 --cols 4   # contact sheet of 12 frames between 45s and 70s (1x)
//   node tools/shot.mjs --shot S1b --n 6                # 6 evenly spaced frames across a shot (sheet)
//   node tools/shot.mjs --expr "PSA.girl.draw(ctx, 40, 70, {pose:'walk', dir:'right', frame:1})" --w 80 --h 80 --scale 6 --bg "#777"
//   node tools/shot.mjs --expr "..." --frames 4 --w 40 --h 60   # animation strip: the expression may use the variable f (0..frames-1)
//   node tools/shot.mjs --list                          # list shots and whether a render function is registered
// Options: --out dir|file, --scale N (default 3 for frames, 1 for sheets), --crop x,y,w,h (native px, applied before scaling)
import fs from 'node:fs'; import path from 'node:path';
import { openPage, parseArgs, asList, writeDataUrl, ROOT } from './_lib.mjs';

const a = parseArgs(process.argv.slice(2));
const outDir = a.out && !a.out.endsWith('.png') ? a.out : path.join(ROOT, 'out', 'shots');
const { page, close, errors } = await openPage();
try {
  if (a.list) {
    const shots = await page.evaluate(() => window.__psa.shots());
    for (const s of shots) console.log(`${s.id.padEnd(5)} ${s.start.toFixed(1).padStart(6)} - ${s.end.toFixed(1).padEnd(6)} in=${s.in.type}${s.in.dur ? '(' + s.in.dur + ')' : ''}  ${s.implemented ? 'ok' : 'MISSING render'}`);
    console.log('duration', await page.evaluate(() => window.__psa.duration()));
  }
  const crop = a.crop ? a.crop.split(',').map(Number) : null;
  const cropCode = crop ? `const cc=document.createElement('canvas');cc.width=${crop[2]};cc.height=${crop[3]};const cx=cc.getContext('2d');cx.imageSmoothingEnabled=false;cx.drawImage(window.PSA.nativeCanvas,${crop[0]},${crop[1]},${crop[2]},${crop[3]},0,0,${crop[2]},${crop[3]});` : '';
  for (const ts of asList(a.t)) {
    const t = Number(ts); const scale = Number(a.scale || 3);
    const url = await page.evaluate(({ t, scale, cropCode }) => {
      window.__psa.renderFrame(t);
      let src = window.PSA.nativeCanvas;
      if (cropCode) { const f = new Function(cropCode + 'return cc;'); src = f(); }
      const c = document.createElement('canvas'); c.width = src.width * scale; c.height = src.height * scale;
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }, { t, scale, cropCode });
    const file = a.out && a.out.endsWith('.png') ? a.out : path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    writeDataUrl(file, url);
    const errs = await page.evaluate(() => window.__psa.errors());
    console.log('wrote', path.relative(ROOT, file), errs.length ? ' RENDER ERRORS: ' + JSON.stringify(errs.slice(0, 2)) : '');
  }
  if (a.sheet || a.shot) {
    let t0, t1, label;
    if (a.shot) { const s = (await page.evaluate(() => window.__psa.shots())).find((s) => s.id === a.shot); if (!s) throw new Error('unknown shot ' + a.shot); t0 = s.start; t1 = s.end; label = a.shot; }
    else { const v = asList(a.sheet); t0 = Number(v[0]); t1 = Number(a._[0] !== undefined ? a._[0] : v[1]); label = `${t0}-${t1}`; }
    const n = Number(a.n || 12), cols = Number(a.cols || 4), scale = Number(a.scale || 1);
    const times = []; for (let i = 0; i < n; i++) times.push(t0 + (t1 - t0) * (n === 1 ? 0 : i / (n - 1)) * 0.999);
    const url = await page.evaluate(({ times, cols, scale }) => {
      const W = window.PSA.W, H = window.PSA.H, rows = Math.ceil(times.length / cols);
      const pad = 2, lab = 10;
      const c = document.createElement('canvas'); c.width = cols * (W * scale + pad); c.height = rows * (H * scale + pad + lab);
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.fillStyle = '#222'; cx.fillRect(0, 0, c.width, c.height);
      times.forEach((t, i) => {
        window.__psa.renderFrame(t);
        const x = (i % cols) * (W * scale + pad), y = Math.floor(i / cols) * (H * scale + pad + lab);
        cx.drawImage(window.PSA.nativeCanvas, x, y + lab, W * scale, H * scale);
        cx.fillStyle = '#fff'; cx.font = '9px monospace'; cx.fillText('t=' + t.toFixed(2), x + 2, y + 8);
      });
      return c.toDataURL('image/png');
    }, { times, cols, scale });
    const file = a.out && a.out.endsWith('.png') ? a.out : path.join(outDir, `sheet_${label}.png`);
    writeDataUrl(file, url);
    const errs = await page.evaluate(() => window.__psa.errors());
    console.log('wrote', path.relative(ROOT, file), 'frames at', times.map((t) => t.toFixed(1)).join(','), errs.length ? ' RENDER ERRORS: ' + JSON.stringify(errs.slice(0, 2)) : '');
  }
  if (a.expr) {
    const w = Number(a.w || 96), h = Number(a.h || 96), scale = Number(a.scale || 4), frames = Number(a.frames || 1), bg = a.bg || '#6a6a6a';
    const url = await page.evaluate(({ expr, w, h, scale, frames, bg }) => {
      const G = window.PSA.gfx;
      const strip = G.makeCanvas(w * frames + (frames - 1), h); const sctx = strip.getContext('2d');
      sctx.fillStyle = '#ff00ff'; sctx.fillRect(0, 0, strip.width, strip.height);
      for (let f = 0; f < frames; f++) {
        const c = G.makeCanvas(w, h); const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        const fn = new Function('ctx', 'PSA', 'G', 'W', 'H', 'f', expr);
        fn(ctx, window.PSA, G, w, h, f);
        sctx.drawImage(c, f * (w + 1), 0);
      }
      const s = G.makeCanvas(strip.width * scale, strip.height * scale); const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false;
      sx.drawImage(strip, 0, 0, s.width, s.height);
      return s.toDataURL('image/png');
    }, { expr: a.expr, w, h, scale, frames, bg });
    const file = a.out && a.out.endsWith('.png') ? a.out : path.join(outDir, 'expr.png');
    writeDataUrl(file, url);
    console.log('wrote', path.relative(ROOT, file));
  }
  if (errors.length) { console.error('PAGE ERRORS:', errors); process.exitCode = 2; }
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await close(); }
