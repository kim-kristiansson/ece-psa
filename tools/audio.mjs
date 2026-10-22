// Audio inspection / export tool.
//   node tools/audio.mjs                       # render full soundtrack -> out/audio.wav, print level report per 5 s, spectrogram + waveform PNGs
//   node tools/audio.mjs --start 40 --end 70   # only a slice (also written as wav)
//   node tools/audio.mjs --no-music | --no-sfx
//   node tools/audio.mjs --sfx clink --args '{"x":1}' --dur 2   # render ONE sfx (at t=0.2) into out/sfx_clink.wav + png
//   node tools/audio.mjs --events               # list all scheduled sfx events
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { openPage, parseArgs, ROOT } from './_lib.mjs';

const a = parseArgs(process.argv.slice(2));
const outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
const { page, close, errors } = await openPage();
try {
  if (a.events) {
    const ev = await page.evaluate(() => window.__psa.sfxEvents());
    const counts = {}; for (const e of ev) counts[e.name] = (counts[e.name] || 0) + 1;
    console.log(ev.filter((e) => e.name !== 'blip').map((e) => `${e.t.toFixed(2).padStart(7)}  ${e.name}  ${JSON.stringify(e.args)}`).join('\n'));
    console.log('counts:', counts);
  }
  let wavFile;
  if (a.sfx) {
    const dur = Number(a.dur || 2.5);
    const b64 = await page.evaluate(async ({ name, args, dur }) => {
      const sr = window.PSA.AUDIO_SR; const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
      const g = ctx.createGain(); g.connect(ctx.destination);
      const fn = window.PSA.sfx[name]; if (!fn) throw new Error('unknown sfx ' + name);
      fn(ctx, g, 0.2, args);
      const buf = await ctx.startRendering();
      const ab = window.PSA.audio.toWav(buf); const u8 = new Uint8Array(ab); let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, { name: a.sfx, args: a.args ? JSON.parse(a.args) : {}, dur });
    wavFile = path.join(outDir, `sfx_${a.sfx}.wav`); fs.writeFileSync(wavFile, Buffer.from(b64, 'base64'));
  } else if (!a.events || a.render) {
    const report = await page.evaluate((opts) => window.__psa.renderAudio(opts), { music: a['no-music'] ? false : true, sfx: a['no-sfx'] ? false : true });
    console.log('audio report:', JSON.stringify(report));
    const chunkSeconds = 10; const parts = [];
    for (let i = 0; ; i++) { const b64 = await page.evaluate(({ i, cs }) => window.__psa.audioWavChunk(i, cs), { i, cs: chunkSeconds }); if (!b64) break; parts.push(Buffer.from(b64, 'base64')); }
    // concatenate: keep first header, fix sizes
    const pcm = Buffer.concat(parts.map((p, i) => p.subarray(44)));
    const header = Buffer.from(parts[0].subarray(0, 44)); header.writeUInt32LE(36 + pcm.length, 4); header.writeUInt32LE(pcm.length, 40);
    let wav = Buffer.concat([header, pcm]);
    wavFile = path.join(outDir, 'audio.wav'); fs.writeFileSync(wavFile, wav);
    if (a.start || a.end) {
      const s = Number(a.start || 0), e = a.end ? Number(a.end) : 9999;
      const cut = path.join(outDir, `audio_${s}-${e}.wav`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(s), '-to', String(e), '-i', wavFile, cut]);
      wavFile = cut;
    }
  }
  if (wavFile) {
    const base = wavFile.replace(/\.wav$/, '');
    // level report: RMS / peak per 5 s window via ffmpeg astats
    const stats = execFileSync('ffmpeg', ['-hide_banner', '-i', wavFile, '-af', 'astats=metadata=1:reset=240000,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const rms = [...stats.matchAll(/pts_time:([\d.]+)[\s\S]*?RMS_level=([-\d.inf]+)/g)].map((m) => `${Number(m[1]).toFixed(0)}s:${Number(m[2]).toFixed(1)}`);
    console.log('RMS dBFS per 5s:', rms.join('  '));
    const vol = execFileSync('ffmpeg', ['-hide_banner', '-i', wavFile, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    try { const v2 = execFileSync('ffmpeg', ['-hide_banner', '-i', wavFile, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { const m = String(e.stderr || '').match(/(mean_volume:[^\n]*)\n[^\n]*(max_volume:[^\n]*)/); if (m) console.log(m[1], m[2]); }
    try { const r = execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wavFile, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) {}
    const vd = (() => { try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wavFile, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stderr); } return ''; })();
    const spec = path.join(base + '_spectrogram.png'), wave = path.join(base + '_waveform.png');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavFile, '-lavfi', 'showspectrumpic=s=1600x400:legend=1:scale=log', spec]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavFile, '-filter_complex', 'showwavespic=s=1600x240:split_channels=1', '-frames:v', '1', wave]);
    const vdo = (() => { let s = ''; try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wavFile, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { s = String(e.stderr); } return s; })();
    console.log('wrote', path.relative(ROOT, wavFile), path.relative(ROOT, spec), path.relative(ROOT, wave));
  }
  if (errors.length) { console.error('PAGE ERRORS:', errors); process.exitCode = 2; }
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await close(); }
