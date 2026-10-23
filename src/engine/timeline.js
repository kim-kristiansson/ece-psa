// Timeline / shot scheduler. The whole video is a list of SHOTS with absolute [start, end) times.
// Each shot has a render function (ctx, t, lt) that must be a PURE function of time (no accumulated state),
// so any frame can be rendered independently (needed for the exporter and for scrubbing).
//
// shot = {
//   id: 'S1b', start: 9.5, end: 13.0,
//   in: { type: 'cut' | 'cross' | 'fade', dur: 0.6 },   // transition INTO this shot (from the previous one)
//   render: function (ctx, t, lt) { ... },               // lt = t - start (may be slightly <0 or >dur during transitions)
//   sfx: [ { t: 0.5, name: 'clink', args: {...} } ],     // sound events, t relative to shot start
//   text: [ { t0, t1, text, bullet:'*', cps } ]          // RPG text boxes (absolute times handled by engine: t0/t1 relative to shot start)
// }
// Render functions are registered in PSA.shots[id] by the scene modules; the shot list lives in src/scenes/story.js.
(function (PSA) {
  const G = PSA.gfx, L = PSA.light, TB = PSA.textbox;
  const TL = { shots: [], duration: 0 };
  let bufA = null, bufB = null;

  TL.set = function (shots) {
    TL.shots = shots.slice().sort((a, b) => a.start - b.start);
    for (let i = 0; i < TL.shots.length; i++) {
      const s = TL.shots[i];
      s.index = i;
      if (s.in == null) s.in = { type: 'cut', dur: 0 };
      if (s.in.dur == null) s.in.dur = s.in.type === 'cut' ? 0 : 0.6;
    }
    TL.duration = TL.shots.length ? TL.shots[TL.shots.length - 1].end : 0;
  };

  TL.shotAt = function (t) {
    const s = TL.shots;
    for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].start) return s[i];
    return s[0];
  };
  TL.byId = function (id) { return TL.shots.find((s) => s.id === id); };

  function renderShot(ctx, shot, t) {
    const fn = (PSA.shots && PSA.shots[shot.id]) || PSA.shots.__placeholder;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (PSA.style) { PSA.style.done = false; PSA.style.PIXEL = shot.px || 1; }
    try { fn(ctx, t, t - shot.start, shot); }
    catch (e) { PSA.shots.__error(ctx, shot, e); }
    ctx.restore();
    if (PSA.style && !PSA.style.done && !shot.noStyle) PSA.style.apply(ctx);
  }

  // Draw the shot's own text boxes (timed, relative to shot start) above everything else.
  function renderText(ctx, shot, t) {
    if (!shot.text) return;
    for (const tx of shot.text) {
      TB.timed(ctx, t, Object.assign({}, tx, { t0: shot.start + tx.t0, t1: shot.start + tx.t1 }));
    }
  }

  // Main entry: render the frame for absolute time t into ctx (native size).
  TL.render = function (ctx, t) {
    if (!TL.shots.length) { G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black'); return; }
    t = Math.max(0, Math.min(t, TL.duration - 1e-4));
    const cur = TL.shotAt(t);
    const next = TL.shots[cur.index + 1];
    const prev = TL.shots[cur.index - 1];
    if (!bufA) { bufA = G.makeCanvas(PSA.W, PSA.H); bufB = G.makeCanvas(PSA.W, PSA.H); }

    // Is a transition active? 'cross' spans [start-dur/2, start+dur/2]; 'fade' spans [start-dur/2, start+dur/2] through black.
    let tr = null;
    if (cur.in.type !== 'cut' && t < cur.start + cur.in.dur / 2 && prev) tr = { type: cur.in.type, from: prev, to: cur, p: (t - (cur.start - cur.in.dur / 2)) / cur.in.dur };
    else if (next && next.in.type !== 'cut' && t >= next.start - next.in.dur / 2) tr = { type: next.in.type, from: cur, to: next, p: (t - (next.start - next.in.dur / 2)) / next.in.dur };

    if (!tr) {
      renderShot(ctx, cur, t);
      renderText(ctx, cur, t);
      return;
    }
    const p = G.clamp(tr.p, 0, 1);
    if (tr.type === 'cross') {
      const ca = bufA.getContext('2d'), cb = bufB.getContext('2d');
      ca.clearRect(0, 0, PSA.W, PSA.H); cb.clearRect(0, 0, PSA.W, PSA.H);
      renderShot(ca, tr.from, t); renderText(ca, tr.from, t);
      renderShot(cb, tr.to, t); renderText(cb, tr.to, t);
      ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(bufA, 0, 0);
      ctx.globalAlpha = G.smooth(p); ctx.drawImage(bufB, 0, 0); ctx.restore();
    } else { // fade through black
      if (p < 0.5) { renderShot(ctx, tr.from, t); renderText(ctx, tr.from, t); L.black(ctx, G.smooth(p / 0.5)); }
      else { renderShot(ctx, tr.to, t); renderText(ctx, tr.to, t); L.black(ctx, 1 - G.smooth((p - 0.5) / 0.5)); }
    }
  };

  // Collect all SFX events (absolute times) from shots + text box blips.
  TL.sfxEvents = function () {
    const ev = [];
    for (const s of TL.shots) {
      if (s.sfx) for (const e of s.sfx) ev.push({ t: s.start + e.t, name: e.name, args: e.args || {} });
      if (s.text) for (const tx of s.text) {
        if (tx.instant || tx.silent) continue;
        for (const bt of TB.blipTimes(tx.text, s.start + tx.t0, tx.cps, tx.typeDelay)) ev.push({ t: bt, name: 'blip', args: { kind: tx.face ? 'voice' : 'narr' } });
      }
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  };

  PSA.timeline = TL;
  PSA.shots = PSA.shots || {};
  PSA.shots.__placeholder = function (ctx, t, lt, shot) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, '#303040');
    if (PSA.FONT) { PSA.font.text(ctx, 'PLACEHOLDER ' + shot.id, 8, 8, { color: 'uiText' }); PSA.font.text(ctx, 't=' + t.toFixed(2), 8, 20, { color: 'uiDim' }); }
  };
  PSA.shots.__error = function (ctx, shot, e) {
    G.rect(ctx, 0, 0, PSA.W, 24, '#800');
    if (PSA.FONT) PSA.font.text(ctx, 'ERROR ' + shot.id + ': ' + String(e.message).slice(0, 60), 4, 4, { color: 'white' });
    if (!PSA.__errors) PSA.__errors = [];
    PSA.__errors.push({ shot: shot.id, message: String(e && e.stack || e) });
    if (PSA.__errors.length <= 3) console.error('shot ' + shot.id + ' render error', e);
  };
})(window.PSA);
