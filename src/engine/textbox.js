// RPG text boxes, typewriter effect, popups and (non-interactive) choice menus.
// Visual style: black box with a thick 3px white border, white bitmap text, every line starts with '* '.
// Spoken lines can show a face portrait at the left of the box. The typewriter reveals one letter at a time and
// pauses briefly after punctuation; each revealed letter gets one blip sound (T.blipTimes uses the same timing).
(function (PSA) {
  const G = PSA.gfx, F = PSA.font;
  const T = {};

  T.DEFAULT = { x: 16, y: 140, w: 352, h: 68, pad: 13, cps: 30, border: 3 };
  T.CPS = 30;          // letters per second for the typewriter
  T.PAUSE = { '.': 0.3, '!': 0.3, '?': 0.3, ',': 0.15 };   // extra hold after punctuation (only mid-text)
  T.FACE = { w: 56, h: 60, gap: 10 };                         // face portrait window inside the box

  // Reveal time (seconds after typing starts) of every character of a text.
  T.revealTimes = function (text, cps) {
    cps = cps || T.CPS;
    const out = [];
    let tt = 0;
    for (let i = 0; i < text.length; i++) {
      out.push(tt);
      tt += 1 / cps;
      const p = T.PAUSE[text[i]];
      if (p && i < text.length - 1 && text[i + 1] === ' ') tt += p;
    }
    return out;
  };
  // Number of visible characters at local time lt (typewriter). Without a text, a plain cps count.
  T.charsAt = function (lt, cps, text) {
    if (text == null) return Math.max(0, Math.floor(lt * (cps || T.CPS)));
    if (lt < 0) return 0;
    const rt = T.revealTimes(text, cps);
    let n = 0;
    while (n < rt.length && rt[n] <= lt + 1e-9) n++;
    return n;
  };

  // Draw the empty box frame: solid white border, black inside.
  T.frame = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    const b = opts.border || 3;
    G.rect(ctx, x, y, w, h, opts.borderColor || 'white');
    G.rect(ctx, x + b, y + b, w - 2 * b, h - 2 * b, opts.fill || 'black');
  };

  // Face portrait of the girl inside a text box (a crop of the close-up portrait, same pixel size).
  const faceCache = {};
  function faceCanvas(expr) {
    if (faceCache[expr]) return faceCache[expr];
    const c = G.makeCanvas(T.FACE.w, T.FACE.h);
    PSA.portrait.draw(c.getContext('2d'), T.FACE.w >> 1, -16, { expr: expr });
    return (faceCache[expr] = c);
  }

  // Draw a text box with typewriter text.
  // opts: {x,y,w,h,pad,text,chars,scale,color,bullet:'*',alpha}
  // If chars is undefined, the full text is shown. Returns total char count.
  T.draw = function (ctx, opts) {
    const o = Object.assign({}, T.DEFAULT, opts || {});
    const prevAlpha = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevAlpha * o.alpha;
    T.frame(ctx, o.x, o.y, o.w, o.h, o);
    const scale = o.scale || 1;
    let tx = o.x + o.pad, ty = o.y + o.pad;
    let text = o.text || '';
    if (o.face && T.faceProvider) {        // low-res face (28x30) drawn at 2x, like the rest of the art
      const fc = T.faceProvider(o.face);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fc, 0, 0, fc.width, fc.height, o.x + 8, o.y + ((o.h - T.FACE.h) >> 1), T.FACE.w, T.FACE.h);
      tx = o.x + 8 + T.FACE.w + T.FACE.gap;
    } else if (o.face && PSA.portrait) {
      ctx.drawImage(faceCanvas(o.face), o.x + 8, o.y + ((o.h - T.FACE.h) >> 1));
      tx = o.x + 8 + T.FACE.w + T.FACE.gap;
    }
    const bullet = o.bullet === undefined ? '*' : o.bullet;
    if (bullet) { F.text(ctx, bullet, tx, ty, { scale: scale, color: o.color || 'white' }); tx += F.measure(bullet + ' ', scale); }
    F.block(ctx, text, tx, ty, { maxWidth: o.w - o.pad - (tx - o.x), scale: scale, color: o.color || 'white', chars: o.chars,
      lineHeight: F.lineHeight(scale) + 4 });
    ctx.globalAlpha = prevAlpha;
    return text.length;
  };

  // Convenience: a timed text box. Appears at t0, types at cps, stays until t1, with quick fade in/out (fadeDur).
  // Returns true if drawn. Used by the timeline for narration/thought lines.
  T.timed = function (ctx, t, spec) {
    const fade = spec.fade == null ? 0.15 : spec.fade;
    if (t < spec.t0 || t > spec.t1 + fade) return false;
    let alpha = 1;
    if (t < spec.t0 + fade) alpha = (t - spec.t0) / fade;
    else if (t > spec.t1) alpha = 1 - (t - spec.t1) / fade;
    const typeStart = spec.t0 + (spec.typeDelay == null ? 0.2 : spec.typeDelay);
    const chars = spec.instant ? undefined : T.charsAt(t - typeStart, spec.cps, spec.text);
    T.draw(ctx, Object.assign({}, spec.box || {}, { text: spec.text, chars: chars, alpha: alpha, bullet: spec.bullet, color: spec.color, scale: spec.scale, face: spec.face }));
    return true;
  };

  // Blip SFX times for a typed line (one blip per visible non-space character, capped rate).
  T.blipTimes = function (text, t0, cps, typeDelay) {
    const out = [];
    const start = t0 + (typeDelay == null ? 0.2 : typeDelay);
    const rt = T.revealTimes(text, cps);
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ' || text[i] === '\n') continue;
      out.push(start + rt[i]);
    }
    return out;
  };

  // Emote popup above a character: '!' or '?' in a tiny box, with a short pop animation. lt = time since appear.
  T.emote = function (ctx, x, y, symbol, lt) {
    if (lt < 0) return;
    const pop = Math.min(1, lt / 0.15);
    const bob = lt < 0.3 ? Math.round(-3 * Math.sin(Math.min(1, lt / 0.3) * Math.PI)) : 0;
    const w = 9, h = 11;
    const bx = (x - 4) | 0, by = (y - h + bob) | 0;
    if (pop < 1) { G.rect(ctx, bx + 2, by + 4, 5, 5, 'white'); return; }
    G.rect(ctx, bx, by, w, h, 'white');
    G.rect(ctx, bx + 1, by + 1, w - 2, h - 2, 'black');
    F.text(ctx, symbol, bx + 2, by + 2, { color: symbol === '!' ? 'uiAccent' : 'white' });
  };

  // Non-interactive choice menu row inside a box: options drawn side by side with a cursor arrow.
  // cursorIndex may be fractional for sliding animation. opts: {x,y,w,h,options:[...], cursor, alpha, color}
  T.choice = function (ctx, opts) {
    const o = Object.assign({}, T.DEFAULT, opts || {});
    const prevAlpha = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevAlpha * o.alpha;
    T.frame(ctx, o.x, o.y, o.w, o.h, o);
    const n = o.options.length;
    const colW = Math.floor((o.w - 2 * o.pad) / n);
    const ty = o.y + Math.floor((o.h - F.lineHeight(1)) / 2) + 1;
    const xs = [];
    const sel = o.cursor == null ? -1 : Math.round(o.cursor);
    for (let i = 0; i < n; i++) {
      const tx = o.x + o.pad + i * colW + 22;
      xs.push(tx);
      F.text(ctx, '* ' + o.options[i], tx, ty, { color: i === sel ? 'uiAccent' : (o.color || 'white') });
    }
    if (o.cursor != null) {
      const i0 = Math.floor(o.cursor), i1 = Math.min(n - 1, i0 + 1), f = o.cursor - i0;
      const cx = Math.round(G.lerp(xs[Math.min(i0, n - 1)], xs[i1], f)) - 12;
      T.heart(ctx, cx, ty);
    }
    ctx.globalAlpha = prevAlpha;
  };

  // Small red heart used as the menu cursor (7x6).
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  T.heart = function (ctx, x, y) {
    for (let j = 0; j < HEART.length; j++) for (let i = 0; i < 7; i++) if (HEART[j][i] === '#') G.px(ctx, x + i, y + j, 'uiRed');
  };

  PSA.textbox = T;
})(window.PSA);
