// Sanity check: loads the page headless, lists shots missing a render function, renders one frame per shot
// and reports render errors / page errors. Exit code != 0 on problems.
import { openPage } from './_lib.mjs';
const { page, close, errors } = await openPage();
try {
  const shots = await page.evaluate(() => window.__psa.shots());
  const missing = shots.filter((s) => !s.implemented).map((s) => s.id);
  if (missing.length) console.log('shots without render function (placeholder shown):', missing.join(' '));
  let bad = 0;
  for (const s of shots) {
    for (const t of [s.start + 0.01, (s.start + s.end) / 2, s.end - 0.01]) {
      const errs = await page.evaluate((t) => { window.__psa.renderFrame(t); return window.__psa.errors(); }, t);
      if (errs.length) { bad++; console.log(`render error in ${s.id} at t=${t.toFixed(2)}: ${errs[0].message.split('\n')[0]}`); }
    }
  }
  const ev = await page.evaluate(() => window.__psa.sfxEvents());
  const sfxNames = await page.evaluate(() => Object.keys(window.PSA.sfx || {}));
  const missingSfx = [...new Set(ev.map((e) => e.name).filter((n) => !sfxNames.includes(n)))];
  if (missingSfx.length) console.log('sfx events without implementation:', missingSfx.join(' '));
  console.log(`shots: ${shots.length}, duration: ${await page.evaluate(() => window.__psa.duration())}s, sfx events: ${ev.length}, page errors: ${errors.length}, render errors: ${bad}`);
  if (errors.length) console.log('PAGE ERRORS:\n  ' + errors.join('\n  '));
  if (errors.length || bad) process.exitCode = 1;
} finally { await close(); }
