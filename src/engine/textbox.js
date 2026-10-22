// RPG text boxes, typewriter effect, popups and (non-interactive) choice menus.
// Visual style: black box, 2px off-white border with a 1px inner gap, white bitmap text, '*' bullets for narration.
(function (PSA) {
  const G = PSA.gfx, F = PSA.font;
  const T = {};

  T.DEFAULT = { x: 20, y: 150, w: 344, h: 52, pad: 10, cps: 28, border: 2 };
  T.CPS = 28; // characters per second for the typewriter (comfortable reading speed)

  // Number of visible characters at local time lt for a text (typewriter).
  T.charsAt = function (lt, cps) { return Math.max(0, Math.floor(lt * (cps || T.CPS))); };

  // Draw the empty box frame
  T.frame = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    const b = opts.border || 2;
    G.rect(ctx, x, y, w, h, opts.borderColor || 'uiBorder');
    G.rect(ctx, x + b, y + b, w - 2 * b, h - 2 * b, 'black');
    G.rect(ctx, x + b + 1, y + b + 1, w - 2 * b - 2, h - 2 * b - 2, opts.borderColor || 'uiBorder');
    G.rect(ctx, x + b + 2, y + b + 2, w - 2 * b - 4, h - 2 * b - 4, opts.fill || 'black');
  };

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
    if (o.bullet) { F.text(ctx, o.bullet, tx, ty, { scale: scale, color: o.color || 'uiText' }); tx += F.measure(o.bullet + ' ', scale); }
    F.block(ctx, text, tx, ty, { maxWidth: o.w - o.pad - (tx - o.x), scale: scale, color: o.color || 'uiText', chars: o.chars });
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
    const chars = spec.instant ? undefined : T.charsAt(t - typeStart, spec.cps);
    T.draw(ctx, Object.assign({}, spec.box || {}, { text: spec.text, chars: chars, alpha: alpha, bullet: spec.bullet, color: spec.color, scale: spec.scale }));
    return true;
  };

  // Blip SFX times for a typed line (one blip per visible non-space character, capped rate).
  T.blipTimes = function (text, t0, cps, typeDelay) {
    cps = cps || T.CPS;
    const out = [];
    const start = t0 + (typeDelay == null ? 0.2 : typeDelay);
    let last = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ' || text[i] === '\n') continue;
      const tt = start + i / cps;
      if (tt - last >= 1 / cps - 1e-6) { out.push(tt); last = tt; }
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
    if (pop < 1) { G.rect(ctx, bx + 2, by + 4, 5, 5, 'uiBorder'); return; }
    G.rect(ctx, bx, by, w, h, 'uiBorder');
    G.rect(ctx, bx + 1, by + 1, w - 2, h - 2, 'black');
    F.text(ctx, symbol, bx + 2, by + 2, { color: symbol === '!' ? 'uiAccent' : 'uiText' });
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
    for (let i = 0; i < n; i++) {
      const tx = o.x + o.pad + i * colW + 12;
      xs.push(tx);
      F.text(ctx, o.options[i], tx, ty, { color: o.color || 'uiText' });
    }
    if (o.cursor != null) {
      const i0 = Math.floor(o.cursor), i1 = Math.min(n - 1, i0 + 1), f = o.cursor - i0;
      const cx = Math.round(G.lerp(xs[Math.min(i0, n - 1)], xs[i1], f)) - 10;
      // small arrow cursor (original, not a heart)
      const cy = ty + 1;
      G.rect(ctx, cx, cy, 2, 6, 'uiAccent'); G.rect(ctx, cx + 2, cy + 1, 1, 4, 'uiAccent'); G.rect(ctx, cx + 3, cy + 2, 1, 2, 'uiAccent');
    }
    ctx.globalAlpha = prevAlpha;
  };

  PSA.textbox = T;
})(window.PSA);
