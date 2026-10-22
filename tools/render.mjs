// Full export: frames (384x216 PNG, nearest-neighbour upscaled to 1920x1080 by ffmpeg) + offline audio -> MP4.
//   node tools/render.mjs                         # -> out/psa.mp4
//   node tools/render.mjs --start 40 --end 70 --out out/clip.mp4
//   node tools/render.mjs --no-audio
//   node tools/render.mjs --fps 30 --crf 16
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync, spawn } from 'node:child_process';
import { openPage, parseArgs, ROOT } from './_lib.mjs';

const a = parseArgs(process.argv.slice(2));
const outFile = path.resolve(ROOT, a.out || 'out/psa.mp4');
const fps = Number(a.fps || 30), crf = Number(a.crf || 16);
const { page, close, errors } = await openPage({ quiet: true });
try {
  const duration = await page.evaluate(() => window.__psa.duration());
  const start = Number(a.start || 0), end = Math.min(duration, Number(a.end || duration));
  const nFrames = Math.round((end - start) * fps);
  console.log(`rendering ${nFrames} frames (${start}s..${end}s) at ${fps} fps, duration ${duration}s`);
  const framesDir = path.join(ROOT, 'out', 'frames'); fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir, { recursive: true });
  const t0 = Date.now(); let renderErrors = [];
  const BATCH = 60;
  for (let i = 0; i < nFrames; i += BATCH) {
    const n = Math.min(BATCH, nFrames - i);
    const res = await page.evaluate(({ i, n, fps, start }) => {
      const out = []; const errs = [];
      for (let k = 0; k < n; k++) { const t = start + (i + k) / fps; out.push(window.__psa.renderFrame(t)); const e = window.__psa.errors(); if (e.length) errs.push({ t, e: e[0] }); }
      return { out, errs };
    }, { i, n, fps, start });
    res.out.forEach((d, k) => fs.writeFileSync(path.join(framesDir, `f${String(i + k).padStart(5, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
    renderErrors.push(...res.errs);
    if ((i / BATCH) % 10 === 0) process.stdout.write(`\r  frames ${i + n}/${nFrames}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`\n  frames done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (renderErrors.length) console.error('RENDER ERRORS in', renderErrors.length, 'frames, first:', JSON.stringify(renderErrors[0]));

  let wavFile = null;
  if (!a['no-audio']) {
    const ta = Date.now();
    const report = await page.evaluate(() => window.__psa.renderAudio({}));
    const parts = []; const cs = 10;
    for (let i = 0; ; i++) { const b64 = await page.evaluate(({ i, cs }) => window.__psa.audioWavChunk(i, cs), { i, cs }); if (!b64) break; parts.push(Buffer.from(b64, 'base64')); }
    const pcm = Buffer.concat(parts.map((p) => p.subarray(44)));
    const header = Buffer.from(parts[0].subarray(0, 44)); header.writeUInt32LE(36 + pcm.length, 4); header.writeUInt32LE(pcm.length, 40);
    wavFile = path.join(ROOT, 'out', 'audio.wav'); fs.writeFileSync(wavFile, Buffer.concat([header, pcm]));
    console.log(`  audio rendered in ${((Date.now() - ta) / 1000).toFixed(1)}s`, JSON.stringify(report));
  }
  const args = ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', path.join(framesDir, 'f%05d.png')];
  if (wavFile) args.push('-ss', String(start), '-t', String(end - start), '-i', wavFile);
  args.push('-vf', 'scale=1920:1080:flags=neighbor,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-r', String(fps), '-tune', 'animation');
  if (wavFile) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', outFile);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const te = Date.now();
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`  encoded in ${((Date.now() - te) / 1000).toFixed(1)}s -> ${path.relative(ROOT, outFile)}`);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate', '-of', 'default=nw=1', outFile], { encoding: 'utf8' });
  console.log(probe.trim());
  if (errors.length) { console.error('PAGE ERRORS:', errors); process.exitCode = 2; }
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await close(); }
