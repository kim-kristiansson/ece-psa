// Boot: live playback in the browser + hooks used by the export tools (window.__psa).
(function (PSA) {
  const G = PSA.gfx;
  const native = G.makeCanvas(PSA.W, PSA.H);
  const nctx = native.getContext('2d');
  PSA.nativeCanvas = native;

  const params = new URLSearchParams(location.search);
  const headless = params.get('render') === '1'; // tools mode: no autoplay loop

  // ---- export hooks -------------------------------------------------------
  const api = {
    duration: () => PSA.filmTime(PSA.timeline.duration),   // film seconds (the timeline itself is in story seconds)
    fps: PSA.FPS,
    renderFrame: function (t) { // film time t -> native canvas data URL (384x216 PNG)
      PSA.__errors = [];
      nctx.setTransform(1, 0, 0, 1, 0, 0);
      nctx.globalAlpha = 1; nctx.globalCompositeOperation = 'source-over';
      nctx.fillStyle = '#000'; nctx.fillRect(0, 0, PSA.W, PSA.H);
      PSA.timeline.render(nctx, PSA.storyTime(t));
      return native.toDataURL('image/png');
    },
    errors: () => PSA.__errors || [],
    // scaled preview (nearest neighbour) for inspection tools
    renderScaled: function (t, scale) {
      api.renderFrame(t);
      const c = G.makeCanvas(PSA.W * scale, PSA.H * scale);
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
      cx.drawImage(native, 0, 0, PSA.W * scale, PSA.H * scale);
      return c.toDataURL('image/png');
    },
    // evaluate arbitrary drawing code on a fresh canvas (used by tools/shot.mjs --expr)
    evalDraw: function (code, w, h, scale, bg) {
      const c = G.makeCanvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = bg || '#555'; ctx.fillRect(0, 0, w, h);
      const fn = new Function('ctx', 'PSA', 'G', 'W', 'H', code);
      fn(ctx, PSA, G, w, h);
      const s = G.makeCanvas(w * scale, h * scale); const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false;
      sx.drawImage(c, 0, 0, w * scale, h * scale);
      return s.toDataURL('image/png');
    },
    renderAudio: async function (opts) {
      const r = await PSA.audio.renderOffline(api.duration() + 0.5, opts || {});
      PSA.__audioBuffer = r.buffer;
      return r.report;
    },
    audioWavChunk: function (chunk, chunkSeconds) { // base64 of a WAV slice
      const buf = PSA.__audioBuffer;
      const start = chunk * chunkSeconds, end = Math.min(buf.duration, start + chunkSeconds);
      if (start >= buf.duration) return null;
      const ab = PSA.audio.toWav(buf, start, end);
      const u8 = new Uint8Array(ab); let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    },
    sfxEvents: () => PSA.timeline.sfxEvents(),
    shots: () => PSA.timeline.shots.map((s) => ({ id: s.id, start: s.start, end: s.end, in: s.in, implemented: !!(PSA.shots[s.id]) }))
  };
  window.__psa = api;
  if (headless) return;

  // ---- live playback -------------------------------------------------------
  const display = document.getElementById('screen');
  const dctx = display.getContext('2d');
  const overlay = document.getElementById('overlay');
  let audioCtx = null, t0 = null, startedAt = null, rafId = 0, finished = false;

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.max(1, Math.floor(Math.min(vw / PSA.W, vh / PSA.H)));
    display.width = PSA.W * s; display.height = PSA.H * s;
    dctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', fit); fit();

  function now() {
    if (audioCtx) return audioCtx.currentTime - t0;
    return (performance.now() - startedAt) / 1000;
  }
  function frame() {
    const t = Math.min(now(), api.duration());
    api.renderFrame(t);
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(native, 0, 0, display.width, display.height);
    if (t >= api.duration() - 0.001) { finished = true; return; }
    rafId = requestAnimationFrame(frame);
  }
  async function start(withAudio) {
    overlay.style.display = 'none';
    if (withAudio) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        if (audioCtx.state !== 'running') { audioCtx = null; }
      } catch (e) { audioCtx = null; }
    }
    if (audioCtx) { t0 = audioCtx.currentTime + 0.15; PSA.audio.build(audioCtx, t0); }
    else startedAt = performance.now();
    cancelAnimationFrame(rafId); finished = false;
    frame();
  }
  // Try to autoplay with sound; browsers usually require a gesture first -> show the overlay and start on click/key.
  (async function () {
    try {
      const probe = new (window.AudioContext || window.webkitAudioContext)();
      if (probe.state === 'running') { await probe.close(); start(true); return; }
      await probe.close();
    } catch (e) {}
    overlay.style.display = 'flex';
    const go = () => { if (overlay.style.display !== 'none') start(true); };
    overlay.addEventListener('click', go); window.addEventListener('keydown', go, { once: true });
  })();
  async function replay() {
    if (audioCtx) { try { await audioCtx.close(); } catch (e) {} audioCtx = null; }
    start(true);
  }
  window.addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'Enter' || e.key === 'z') && finished) replay(); });
  display.addEventListener('click', (e) => {          // the REPLAY button on the finish frame
    if (!finished) return;
    const r = display.getBoundingClientRect(), B = PSA.REPLAY_BUTTON;
    const x = (e.clientX - r.left) / r.width * PSA.W, y = (e.clientY - r.top) / r.height * PSA.H;
    if (!B || (x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h)) replay();
  });
  display.addEventListener('mousemove', (e) => {
    const r = display.getBoundingClientRect(), B = PSA.REPLAY_BUTTON;
    const x = (e.clientX - r.left) / r.width * PSA.W, y = (e.clientY - r.top) / r.height * PSA.H;
    display.style.cursor = finished && B && x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h ? 'pointer' : 'default';
  });
})(window.PSA);
