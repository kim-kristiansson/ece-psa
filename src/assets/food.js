// src/assets/food.js — PSA.food : the plate of pasta, pasta mound, fork, hand+fork, dry pasta bundle, wooden spoon.
//
// PUBLIC API (all coordinates native px, integers; every function is a pure function of its arguments)
//   drawPlateLarge(ctx, cx, cy, {amount:0..1, sauce:0..1, steam:0..1, t, seed, fork:null|{x,y,angle}})
//       ~150 px wide plate seen from a slight top-down 3/4 angle, centered at (cx,cy) (= center of the plate top).
//       amount 1 = full serving, 0.5 = leftovers (smaller mound shifted left, trailing strands, sauce smear),
//       0.25 = little left. Deterministic for a given (amount, seed) so the SAME plate appears identical across shots.
//   drawPastaMound(ctx, cx, cy, w, h, {amount, sauce, seed})   the mound alone (footprint w x h at the base ellipse).
//   drawForkLarge(ctx, x, y, {angle:'up'|'diag'|'flat', pasta:0..1, t, seed})   (x,y) = tip of the tines.
//       'up' tines up / handle down, 'diag' tines up-left / handle down-right, 'flat' tines left / handle right.
//   drawHandForkLarge(ctx, x, y, {pasta, t, frame, grip:'hold'|'twirl'})  the girl's right hand holding the fork;
//       (x,y) = center of the fist (the grip). Sleeve goes off to the lower right. Returns {tipX, tipY}.
//   drawHandBundle(ctx, x, y, {spread, frame, len, sink})  hand holding dry spaghetti; (x,y) = where the strands leave the fist.
//   drawDryPasta(ctx, x, y, {spread, len, sink})           dry strands alone, hanging from (x,y).
//   drawSpoonLarge(ctx, x, y, {angle:'diag'|'up'})          wooden spoon; (x,y) = bottom of the bowl.
//   drawPlateSmall(ctx, cx, cy, {amount:'full'|'half'|number, steam, t})  room-scale 18x8 plate (reference).
//   drawPlateSmallRef = drawPlateSmall;  drawForkSmall(ctx, x, y);  drawHandLarge(ctx,x,y,{pose,frame}) (bundle alias);
//   drawSauceLadle(ctx, x, y, {pour, t})                    ladle for the serving shot; (x,y) = lip of the ladle bowl.
//
// Pixel rules: integer rects only, palette keys, deterministic (G.rng/G.hash), 1px 'ink' outlines around props.
(function (PSA) {
  const G = PSA.gfx;
  const F = {};

  // ------------------------------------------------------------------ helpers
  // Layer: an offscreen pixel buffer that mimics the tiny ctx API used by PSA.gfx (fillStyle + fillRect), so every
  // G.* primitive can paint into it. blit() first draws a 1px outline (4-neighbour) around everything painted,
  // then the pixels. Used for every prop that needs a clean silhouette outline.
  function Layer(w, h) {
    this.w = w | 0; this.h = h | 0;
    this.data = new Array(this.w * this.h).fill(null);
    this.fillStyle = '#000000';
  }
  Layer.prototype.fillRect = function (x, y, w, h) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) this.data[j * this.w + i] = this.fillStyle;
  };
  Layer.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.data[y * this.w + x];
  };
  Layer.prototype.set = function (x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = G.col(c);
  };
  Layer.prototype.has = function (x, y) { return this.get(x, y) != null; };
  // draw to a real ctx at (ox,oy). opts.outline: palette key (default 'ink') or null for none.
  Layer.prototype.blit = function (ctx, ox, oy, opts) {
    opts = opts || {};
    ox |= 0; oy |= 0;
    const w = this.w, h = this.h, d = this.data;
    const outline = opts.outline === undefined ? 'ink' : opts.outline;
    if (outline) {
      ctx.fillStyle = G.col(outline);
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        if (this.has(x, y)) continue;
        if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (c == null) continue;
      ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  };

  // Walk a quadratic bezier with ~1px steps, calling cb(x, y, t) for each new integer pixel.
  function curve(x0, y0, cx, cy, x1, y1, cb) {
    const n = Math.max(2, Math.ceil((Math.abs(cx - x0) + Math.abs(cy - y0) + Math.abs(x1 - cx) + Math.abs(y1 - cy)) * 1.5));
    let px = null, py = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const x = Math.round(a * x0 + b * cx + c * x1), y = Math.round(a * y0 + b * cy + c * y1);
      if (x !== px || y !== py) { cb(x, y, t); px = x; py = y; }
    }
  }
  // Thick line (capsule) painted with rects: every pixel within r of the segment.
  function capsule(tgt, x0, y0, x1, y1, r, c) {
    tgt.fillStyle = G.col(c);
    const minx = Math.floor(Math.min(x0, x1) - r), maxx = Math.ceil(Math.max(x0, x1) + r);
    const miny = Math.floor(Math.min(y0, y1) - r), maxy = Math.ceil(Math.max(y0, y1) + r);
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + dx * t - x, ey = y0 + dy * t - y;
      if (ex * ex + ey * ey <= r * r + 0.25) tgt.fillRect(x, y, 1, 1);
    }
  }
  function ell(tgt, cx, cy, rx, ry, c) { G.ellipse(tgt, cx, cy, rx, ry, c); }

  // ------------------------------------------------------------------ basil leaves (sprites)
  const LEAF_PAL = { o: 'ink', b: 'basil', d: 'basil2' };
  const LEAF_A = PSA.sprite.make([
    '....ooo....',
    '..oobbboo..',
    '.obbdbbbbo.',
    'obbbbdbbbbo',
    '.obbbbdbbo.',
    '..oobbdoo..',
    '....ooo....'
  ], LEAF_PAL);
  const LEAF_B = PSA.sprite.make([
    '.......oo.',
    '.....oobbo',
    '...oobbdbo',
    '.oobbdbbo.',
    'obbdbbbo..',
    'obbbboo...',
    '.ooo......'
  ], LEAF_PAL);

  // ------------------------------------------------------------------ pasta mound
  // Deterministic strand / sauce layout generated from the seed in normalized dome coordinates (u,v in the unit disc)
  // so that the same seed gives the same tangle whatever the mound size; `amount` only changes the dome size and how
  // many of the strands are used -> leftovers are a stable subset of the full plate.
  const N_STRANDS = 150, N_SAUCE = 10, N_TRAIL = 8;
  const layoutCache = {};
  function moundLayout(seed) {
    seed |= 0;
    if (layoutCache[seed]) return layoutCache[seed];
    const r = G.rng(seed * 7919 + 13);
    const strands = [], sauce = [], trail = [];
    for (let i = 0; i < N_STRANDS; i++) {
      // uniform in disc
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.96;
      strands.push({ u: Math.cos(a) * rr, v: Math.sin(a) * rr, ang: a + Math.PI / 2 + (r() - 0.5) * 1.6 + (r() < 0.5 ? Math.PI : 0), len: 12 + r() * 16, bend: (r() - 0.5) * 12, k: r() });
    }
    for (let i = 0; i < N_SAUCE; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.62;
      sauce.push({ u: Math.cos(a) * rr, v: Math.sin(a) * rr, rx: 4 + r() * 4, ry: 2 + r() * 2, dx: (r() - 0.5) * 6, dy: (r() - 0.5) * 3 });
    }
    for (let i = 0; i < N_TRAIL; i++) trail.push({ a: r(), b: r(), c: r(), d: r() });
    return (layoutCache[seed] = { strands, sauce, trail });
  }

  // Dome geometry for a mound with base ellipse (rx, ry) centered at (cx, cy), top lifted by `lift`.
  function dome(cx, cy, rx, ry, lift) {
    const map = (u, v) => { // point on the dome surface for normalized (u,v)
      const h = lift * Math.sqrt(Math.max(0, 1 - u * u - v * v));
      return [cx + u * rx, cy + v * ry - h];
    };
    // silhouette per column: top & bottom y (inclusive)
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const top = {}, bot = {};
    for (let x = x0; x <= x1; x++) {
      const u = (x - cx) / rx; if (u * u > 1) continue;
      const vm = Math.sqrt(1 - u * u);
      let ty = Infinity;
      for (let i = 0; i <= 24; i++) { const v = -vm + (2 * vm * i) / 24; ty = Math.min(ty, map(u, v)[1]); }
      top[x] = Math.round(ty); bot[x] = Math.round(cy + vm * ry);
    }
    const inside = (x, y) => top[x] !== undefined && y >= top[x] && y <= bot[x];
    return { map, inside, top, bot, x0, x1, cx, cy, rx, ry, lift };
  }

  // Draw one noodle into a layer: a bright top row (tier by `light`) over a darker shadow row -> reads as a round
  // strand. pts: [x0,y0,cx,cy,x1,y1] quadratic bezier; clip(x,y)->bool restricts pixels; wide: 2px thick.
  function drawStrand(L, pts, light, clip, wide) {
    const top = light > 0.62 ? 'pasta1' : light > 0.15 ? 'pasta2' : 'pasta3';
    const sh = light > 0.15 ? 'pasta3' : 'pasta4';
    const px = [];
    curve(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], (x, y) => px.push(x, y));
    const put = (x, y, c) => { if (!clip || clip(x, y)) L.set(x, y, c); };
    for (let i = 0; i < px.length; i += 2) { put(px[i], px[i + 1] + 1, sh); if (wide) put(px[i] + 1, px[i + 1] + 1, sh); }
    for (let i = 0; i < px.length; i += 2) { put(px[i], px[i + 1], top); if (wide) put(px[i] + 1, px[i + 1], top); }
  }

  // drawPastaMound: w,h = footprint (base ellipse) size of the FULL mound; opts.lift = dome height (default h*0.6)
  F.drawPastaMound = function (ctx, cx, cy, w, h, opts) {
    opts = opts || {};
    const amount = G.clamp(opts.amount == null ? 1 : opts.amount, 0, 1);
    const sauceAmt = G.clamp(opts.sauce == null ? 1 : opts.sauce, 0, 1);
    const seed = opts.seed | 0;
    if (amount <= 0.02) return null;
    cx |= 0; cy |= 0;
    const lay = moundLayout(seed);
    const sc = 0.38 + 0.62 * amount;              // footprint scale
    const rx = Math.max(6, Math.round((w / 2) * sc)), ry = Math.max(4, Math.round((h / 2) * sc));
    const lift = Math.max(3, Math.round((opts.lift != null ? opts.lift : h * 0.6) * (0.35 + 0.65 * amount)));
    const D = dome(cx, cy, rx, ry, lift);
    // layer around the mound
    const LX = D.x0 - 2, LY = Math.round(cy - ry - lift) - 2;
    const L = new Layer(D.x1 - D.x0 + 5, Math.round(ry * 2 + lift) + 6);
    const lx = (x) => x - LX, ly = (y) => y - LY;
    const clipL = (x, y) => D.inside(x + LX, y + LY);
    // base fill (the dark gaps between noodles): pasta4, pasta3 on the lit upper-left part
    for (let x = D.x0; x <= D.x1; x++) {
      if (D.top[x] === undefined) continue;
      for (let y = D.top[x]; y <= D.bot[x]; y++) {
        const u = (x - cx) / rx, v = (y - cy) / ry;
        L.set(lx(x), ly(y), (u + v * 1.3 < -0.55 || y - D.top[x] < 2) ? 'pasta3' : 'pasta4');
      }
    }
    // strands: count scales with the area of the dome
    const n = Math.round(N_STRANDS * sc * sc);
    for (let i = 0; i < n; i++) {
      const s = lay.strands[i];
      const u0 = s.u, v0 = s.v;
      const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
      const u1 = u0 + (ca * s.len) / rx, v1 = v0 + (sa * s.len) / ry;
      const um = (u0 + u1) / 2 - (sa * s.bend) / rx, vm = (v0 + v1) / 2 + (ca * s.bend) / ry;
      const p0 = D.map(u0, v0), pm = D.map(um, vm), p1 = D.map(u1, v1);
      const hh = Math.sqrt(Math.max(0, 1 - um * um - vm * vm));
      const light = G.clamp(0.5 - um * 0.2 - vm * 0.25 + hh * 0.25 + (s.k - 0.5) * 0.3, 0, 1);
      drawStrand(L, [lx(p0[0]), ly(p0[1]), lx(pm[0]), ly(pm[1]), lx(p1[0]), ly(p1[1])], light, clipL, true);
    }
    // sauce patches on top (clipped to the dome)
    const ns = Math.round(N_SAUCE * sauceAmt * (0.35 + 0.65 * sc * sc));
    const SL = new Layer(L.w, L.h);
    for (let i = 0; i < ns; i++) {
      const s = lay.sauce[i];
      const p = D.map(s.u, s.v);
      const px = lx(Math.round(p[0])), py = ly(Math.round(p[1]));
      const rx1 = Math.round(s.rx * (0.7 + 0.3 * sc)), ry1 = Math.round(s.ry * (0.7 + 0.3 * sc));
      ell(SL, px, py + 1, rx1, ry1, 'sauce3');
      ell(SL, px + Math.round(s.dx), py + Math.round(s.dy) + 1, Math.max(2, rx1 - 2), Math.max(1, ry1 - 1), 'sauce3');
      ell(SL, px, py, rx1, ry1, 'sauce2');
      ell(SL, px + Math.round(s.dx), py + Math.round(s.dy), Math.max(2, rx1 - 2), Math.max(1, ry1 - 1), 'sauce2');
      G.rect(SL, px - Math.round(rx1 * 0.5), py - Math.round(ry1 * 0.6), 2, 1, 'sauce1');
    }
    for (let y = 0; y < SL.h; y++) for (let x = 0; x < SL.w; x++) {
      const c = SL.data[y * SL.w + x];
      if (c != null && clipL(x, y)) L.data[y * L.w + x] = c;
    }
    // a few strands crossing over the sauce so it sits "in" the tangle
    for (let i = n; i < Math.min(N_STRANDS, n + Math.round(6 * sc)); i++) {
      const s = lay.strands[i];
      const u1 = s.u + (Math.cos(s.ang) * s.len) / rx, v1 = s.v + (Math.sin(s.ang) * s.len) / ry;
      const p0 = D.map(s.u, s.v), p1 = D.map(u1, v1), pm = D.map((s.u + u1) / 2, (s.v + v1) / 2);
      drawStrand(L, [lx(p0[0]), ly(p0[1]), lx(pm[0]), ly(pm[1]), lx(p1[0]), ly(p1[1])], 0.5 + s.k * 0.3, clipL, s.k > 0.5);
    }
    L.blit(ctx, LX, LY, { outline: 'ink' });
    // basil: two leaves resting on top
    const b1 = D.map(-0.3, -0.15), b2 = D.map(0.32, 0.3);
    PSA.sprite.draw(ctx, LEAF_A, Math.round(b1[0]) - 5, Math.round(b1[1]) - 3);
    PSA.sprite.draw(ctx, LEAF_B, Math.round(b2[0]) - 5, Math.round(b2[1]) - 4);
    return { rx, ry, lift, topY: Math.round(cy - ry - lift), layout: lay, dome: D, sc };
  };

  // ------------------------------------------------------------------ steam
  function steamPuffs(ctx, cx, baseY, t, intensity, seed) {
    if (intensity <= 0.02) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.3 + i / n + G.hash(seed, i, 7) * 0.2) % 1;
      if (ph > 0.92) continue;
      const rise = 40 * intensity + 12;
      const y = Math.round(baseY - ph * rise);
      const x = Math.round(cx + (i - (n - 1) / 2) * 13 + Math.sin(ph * 6 + i * 2.1) * 6);
      const r = Math.round(3 + ph * 5 * (0.5 + intensity * 0.5));
      G.ditherCircle(ctx, x, y, r, 'steam', ph < 0.45 ? 0.5 : 0.25, i + (ph * 7 | 0));
      if (ph < 0.5) G.ditherCircle(ctx, x - 1, y + 1, Math.max(1, r - 2), 'steam', 0.75, i);
    }
  }

  // ------------------------------------------------------------------ the plate (close-up)
  const PLATE_RX = 74, PLATE_RY = 44;
  F.PLATE_W = PLATE_RX * 2 + 2; F.PLATE_H = PLATE_RY * 2 + 6;
  F.drawPlateLarge = function (ctx, cx, cy, opts) {
    opts = opts || {};
    cx |= 0; cy |= 0;
    const amount = G.clamp(opts.amount == null ? 1 : opts.amount, 0, 1);
    const sauceAmt = opts.sauce == null ? 1 : opts.sauce;
    const seed = opts.seed | 0;
    const t = opts.t || 0;
    const rx = PLATE_RX, ry = PLATE_RY;
    // under-edge (thickness) + outline
    ell(ctx, cx, cy + 4, rx + 1, ry + 1, 'ink');
    ell(ctx, cx, cy + 4, rx, ry, 'plate3');
    ell(ctx, cx, cy, rx + 1, ry + 1, 'ink');
    // top surface: plate2 shadow ring, plate1 top (light from the upper-left)
    ell(ctx, cx, cy, rx, ry, 'plate2');
    ell(ctx, cx - 1, cy - 1, rx - 2, ry - 2, 'plate1');
    // thin decorative rim stripe
    ell(ctx, cx, cy, rx - 9, ry - 6, 'plateRim');
    ell(ctx, cx, cy, rx - 10, ry - 7, 'plate1');
    // the well: shadow crescent under the top rim, plate2 ring at the bottom
    ell(ctx, cx, cy, rx - 16, ry - 11, 'plate2');
    ell(ctx, cx, cy + 2, rx - 17, ry - 12, 'plate1');
    // leftovers: sauce smear + trailing strands where food was taken (right side of the well)
    const lay = moundLayout(seed);
    const taken = 1 - amount;
    const shift = Math.round(taken * 16);     // the remaining mound sits a bit to the left
    if (taken > 0.15) {
      const sx = cx + 16 + shift, sy = cy + 4;
      const srx = Math.round(8 + taken * 18), sry = Math.round(4 + taken * 8);
      // dithered smear (sauce3 sparse) with a few solid sauce2 streaks
      const SL = new Layer(srx * 2 + 4, sry * 2 + 4);
      ell(SL, srx + 2, sry + 2, srx, sry, 'sauce3');
      for (let y = 0; y < SL.h; y++) for (let x = 0; x < SL.w; x++) {
        if (SL.data[y * SL.w + x] == null) continue;
        const X = sx - srx - 2 + x, Y = sy - sry - 2 + y;
        const on = ((X + 2 * Y) & 3) === 0 || (((X + Y) & 1) === 0 && G.hash(seed, X, Y) < 0.35);
        if (on) G.px(ctx, X, Y, 'sauce3');
      }
      for (let i = 0; i < 3 + Math.round(taken * 3); i++) {
        const tr = lay.trail[i];
        const x0 = sx - srx + Math.round(tr.a * srx * 1.4), y0 = sy - sry + Math.round(tr.b * sry * 1.6);
        const len = 4 + Math.round(tr.c * 8);
        G.hline(ctx, x0, y0, len, 'sauce2');
        G.hline(ctx, x0 + 1, y0 + 1, Math.max(1, len - 3), 'sauce3');
      }
    }
    // the mound
    const mx = cx - shift, my = cy + 3;
    const m = F.drawPastaMound(ctx, mx, my, 96, 50, { amount: amount, sauce: sauceAmt, seed: seed, lift: 18 });
    if (taken > 0.15 && m) {
      // strands trailing out of the mound onto the plate (lying flat: mostly horizontal, loose curls)
      const nt = Math.min(N_TRAIL, 2 + Math.round(taken * 6));
      const TL = new Layer(100, 60);
      const ox = mx - 10, oy = my - 30;
      for (let i = 0; i < nt; i++) {
        const tr = lay.trail[i];
        const x0 = mx + Math.round(m.rx * (0.5 + tr.a * 0.45)), y0 = my + Math.round(m.ry * (tr.b * 1.3 - 0.55));
        const len = 8 + Math.round(tr.c * 12);
        const dir = (tr.d - 0.5) * 1.2 + (y0 > my ? 0.35 : -0.25);            // angle: rightwards, slightly up/down
        const x1 = x0 + Math.round(Math.cos(dir) * len), y1 = y0 + Math.round(Math.sin(dir) * len * 0.6);
        const bend = (tr.a - 0.5) * 14;
        const xm = (x0 + x1) / 2 - Math.sin(dir) * bend, ym = (y0 + y1) / 2 + Math.cos(dir) * bend * 0.6;
        drawStrand(TL, [x0 - ox, y0 - oy, xm - ox, ym - oy, x1 - ox, y1 - oy], 0.4 + tr.b * 0.35, null, false);
        if (i % 2 === 0) { G.rect(TL, Math.round(xm) - ox, Math.round(ym) - oy, 2, 1, 'sauce2'); }
      }
      TL.blit(ctx, ox, oy, { outline: 'pasta4' });
    }
    // fork resting on the plate (optional)
    if (opts.fork) F.drawForkLarge(ctx, opts.fork.x, opts.fork.y, { angle: opts.fork.angle || 'flat', pasta: 0, t: t });
    // steam
    if (opts.steam && m) steamPuffs(ctx, mx, m.topY + 2, t, G.clamp(opts.steam, 0, 1), seed);
  };

  // ------------------------------------------------------------------ fork (close-up)
  // Fork geometry in (s,u) units: s along the axis from the tine tips toward the handle, u across (0 = axis).
  // 'up'/'flat' use 1px units; 'diag' uses the 45-degree lattice (1 unit = sqrt2 px) with half-step fill.
  function forkPainter(L, ox, oy, angle) {
    const diag = angle === 'diag';
    const pt = angle === 'up' ? (s, u) => [ox + u, oy + s]
      : angle === 'flat' ? (s, u) => [ox - s, oy + u]
      : (s, u) => [ox + s + u, oy + s - u];
    const P = {};
    P.pt = pt;
    P.fill = function (s0, s1, u0, u1, c) {
      for (let s = s0; s <= s1; s++) for (let u = u0; u <= u1; u++) {
        const p = pt(s, u); L.set(p[0], p[1], c);
        if (diag) L.set(p[0] + 1, p[1], c);
      }
    };
    P.tine = function (s0, s1, u, c) { for (let s = s0; s <= s1; s++) { const p = pt(s, u); L.set(p[0], p[1], c); if (diag) L.set(p[0] + 1, p[1], c); } };
    return P;
  }
  // dimensions per orientation
  const FORK_DIMS = {
    up:   { tines: [-3, -1, 1, 3], tineLen: 14, shoulder: [[14, 15, -4, 4], [16, 17, -3, 3], [18, 19, -2, 2]], neck: [20, 27, -1, 1], handle: [28, 62, -2, 2], tip: [63, 65, -1, 1], len: 66 },
    flat: null,
    diag: { tines: [-3, -1, 1, 3], tineLen: 9, shoulder: [[10, 10, -4, 3], [11, 11, -4, 3], [12, 12, -3, 2], [13, 13, -2, 1]], neck: [14, 19, -1, 0], handle: [20, 44, -2, 1], tip: [45, 46, -1, 0], len: 47 }
  };
  FORK_DIMS.flat = FORK_DIMS.up;
  F.FORK_DIMS = FORK_DIMS;
  F.drawForkLarge = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const angle = opts.angle || 'up';
    const pasta = G.clamp(opts.pasta || 0, 0, 1);
    const t = opts.t || 0, seed = opts.seed | 0;
    const d = FORK_DIMS[angle] || FORK_DIMS.up;
    const S = 100;
    const L = new Layer(S * 2, S * 2);
    const ox = S, oy = S;
    const P = forkPainter(L, ox, oy, angle);
    const diag = angle === 'diag';
    // handle (fork2 base, fork1 highlight stripe on the light side, fork3 shade stripe on the other)
    P.fill(d.handle[0], d.handle[1], d.handle[2], d.handle[3], 'fork2');
    P.fill(d.tip[0], d.tip[1], d.tip[2], d.tip[3], 'fork2');
    P.fill(d.handle[0] + 1, d.tip[1], d.handle[2], d.handle[2], diag ? 'fork3' : 'fork1');
    P.fill(d.handle[0] + 1, d.tip[1], d.handle[3], d.handle[3], diag ? 'fork1' : 'fork3');
    P.fill(d.tip[0], d.tip[1], d.tip[2], d.tip[3], 'fork3');
    // neck
    P.fill(d.neck[0], d.neck[1], d.neck[2], d.neck[3], 'fork2');
    P.fill(d.neck[0], d.neck[1], diag ? d.neck[3] : d.neck[2], diag ? d.neck[3] : d.neck[2], 'fork1');
    // shoulder
    d.shoulder.forEach((r, i) => {
      P.fill(r[0], r[1], r[2], r[3], 'fork2');
      P.fill(r[0], r[1], diag ? r[3] : r[2], diag ? r[3] : r[2], 'fork1');
      P.fill(r[0], r[1], diag ? r[2] : r[3], diag ? r[2] : r[3], 'fork3');
    });
    // tines (slightly lighter tips)
    d.tines.forEach((u, i) => {
      P.tine(0, d.tineLen - 1, u, 'fork2');
      P.tine(0, 3, u, 'fork1');
      if (!diag && i === d.tines.length - 1) P.tine(4, d.tineLen - 1, u, 'fork3');
    });
    if (!diag) { // a 1px highlight on the left-most tine
      P.tine(0, d.tineLen - 1, d.tines[0], 'fork1');
    }
    L.blit(ctx, x - ox, y - oy, { outline: 'ink' });
    // twirled pasta wound around the lower part of the tines; the tine tips are redrawn on top so the fork reads
    if (pasta > 0.05) {
      const c = P.pt(Math.round(d.tineLen * 0.62), 0);
      drawTwirl(ctx, c[0] - ox + x, c[1] - oy + y, pasta, angle, t, seed);
      const L2 = new Layer(S * 2, S * 2);
      const P2 = forkPainter(L2, ox, oy, angle);
      const tipLen = Math.max(4, Math.round(d.tineLen * 0.34));
      d.tines.forEach((u, i) => { P2.tine(0, tipLen, u, 'fork2'); P2.tine(0, 3, u, 'fork1'); });
      if (!diag) P2.tine(0, tipLen, d.tines[0], 'fork1');
      L2.blit(ctx, x - ox, y - oy, { outline: 'ink' });
    }
  };

  // A twirled bundle of spaghetti wound around the tines, centered at (cx, cy)
  // Elliptical ring of pasta (a strand wound around the tines): radii rA across the fork, rB along it, rotated by rot.
  function woundRing(L, cx, cy, rA, rB, rot, c, lightC) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const steps = Math.max(16, Math.round((rA + rB) * 4));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ex = rA * Math.cos(a), ey = rB * Math.sin(a);
      const px = Math.round(cx + ex * cr - ey * sr), py = Math.round(cy + ex * sr + ey * cr);
      const upperLeft = (ex * cr - ey * sr) + (ex * sr + ey * cr) < -1;   // light from the upper-left
      L.set(px, py, upperLeft ? lightC : c);
    }
  }
  function drawTwirl(ctx, cx, cy, amt, angle, t, seed) {
    const rx = Math.round(5 + 4 * amt), ry = Math.round(3 + 2 * amt);
    const L = new Layer(rx * 2 + 20, ry * 2 + 20);
    const ox = cx - rx - 10, oy = cy - ry - 8;
    const lx = rx + 10, ly = ry + 8;
    // blob = a few ellipses spread ACROSS the fork axis (the bundle is wound around the tines)
    const across = angle === 'up' ? [1, 0] : angle === 'diag' ? [0.7, -0.7] : [0, 1];
    const offs = [-1, 0, 1];
    const spread = Math.round(2 + 3 * amt);
    const centers = offs.map((k) => [Math.round(lx + across[0] * k * spread), Math.round(ly + across[1] * k * spread)]);
    centers.forEach((c) => ell(L, c[0], c[1], rx - 2, ry, 'pasta4'));
    centers.forEach((c) => ell(L, c[0] - 1, c[1] - 1, rx - 3, ry - 1, 'pasta3'));
    const clip = (x, y) => L.has(x, y);
    const r = G.rng(seed * 31 + 5);
    const n = 3 + Math.round(amt * 3);
    const windAng = Math.atan2(across[1], across[0]);
    // wound loops: rings around the fork axis, stacked along it
    const axisAng = windAng + Math.PI / 2;
    const ringN = 2 + Math.round(amt * 2);
    for (let k = 0; k < ringN; k++) {
      const off = (k - (ringN - 1) / 2) * 3;
      const rcx = lx + Math.cos(axisAng) * off, rcy = ly + Math.sin(axisAng) * off;
      woundRing(L, rcx, rcy, rx - 1 - (k & 1), Math.max(2, ry - 1), windAng, 'pasta2', 'pasta1');
    }
    for (let i = 0; i < n; i++) {
      const a = windAng + (r() - 0.5) * 0.8;
      const px = lx + (r() - 0.5) * rx * 1.4, py = ly + (r() - 0.5) * ry * 1.6;
      const len = 6 + r() * (rx + 8);
      const ca = Math.cos(a), sa = Math.sin(a);
      const x0 = px - ca * len / 2, y0 = py - sa * len / 2, x1 = px + ca * len / 2, y1 = py + sa * len / 2;
      const bend = (r() - 0.5) * 6;
      const light = G.clamp(0.5 - (py - ly) / ry * 0.35 - (px - lx) / rx * 0.15 + r() * 0.35, 0, 1);
      drawStrand(L, [x0, y0, px - sa * bend, py + ca * bend, x1, y1], light, clip, true);
    }
    // sauce bits
    for (let i = 0; i < 1 + Math.round(amt * 2); i++) {
      const px = Math.round(lx + (r() - 0.5) * rx * 1.2), py = Math.round(ly + (r() - 0.5) * ry * 1.2);
      ell(L, px, py + 1, 2, 1, 'sauce3'); ell(L, px, py, 2, 1, 'sauce2'); L.set(px - 1, py, 'sauce1');
    }
    // a hanging drip of sauce below the bundle (slowly stretches and resets)
    const dl = 2 + Math.floor(((t * 0.6) % 1) * 3);
    const dx = lx + Math.round(rx * 0.3), dy0 = ly + ry;
    G.rect(L, dx, dy0, 1, dl, 'sauce2');
    G.rect(L, dx - 1, dy0 + dl, 2, 2, 'sauce2'); L.set(dx - 1, dy0 + dl, 'sauce1'); L.set(dx, dy0 + dl + 1, 'sauce3');
    L.blit(ctx, ox, oy, { outline: 'ink' });
  }

  // ------------------------------------------------------------------ hands (shared pieces)
  // Sleeve: a thick capsule of the mustard sweater from the wrist (x0,y0) away to (x1,y1), r = half width.
  function sleeve(L, x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;                       // normal (pointing "down-right" for an up-right arm)
    capsule(L, x0, y0, x1, y1, r, 'sweater2');
    capsule(L, x0 - nx * (r - 3), y0 - ny * (r - 3), x1 - nx * (r - 3), y1 - ny * (r - 3), 2, 'sweater1');
    capsule(L, x0 + nx * (r - 2), y0 + ny * (r - 2), x1 + nx * (r - 2), y1 + ny * (r - 2), 2, 'sweater3');
    // knit texture: short strokes across the sleeve
    for (let k = 10; k < len - 4; k += 9) {
      const px = x0 + dx / len * k, py = y0 + dy / len * k;
      G.line(L, px - nx * 3, py - ny * 3, px + nx * 4, py + ny * 4, 'sweater3');
    }
  }
  // Folded cuff: a band centered at (cx,cy) whose axis is (ax,ay) (unit, perpendicular to the forearm), half-length h,
  // thickness r. Outlined in ink, ribbed along the arm direction.
  function cuff(L, cx, cy, ax, ay, h, r) {
    const x0 = cx - ax * h, y0 = cy - ay * h, x1 = cx + ax * h, y1 = cy + ay * h;
    capsule(L, x0, y0, x1, y1, r + 1, 'ink');
    capsule(L, x0, y0, x1, y1, r, 'sweater2');
    const nx = ay, ny = -ax;                                   // towards the hand side
    capsule(L, x0 + nx * (r - 2), y0 + ny * (r - 2), x1 + nx * (r - 2), y1 + ny * (r - 2), 1, 'sweater1');
    capsule(L, x0 - nx * (r - 1), y0 - ny * (r - 1), x1 - nx * (r - 1), y1 - ny * (r - 1), 1, 'sweater3');
    for (let k = -h + 3; k <= h - 3; k += 4) {
      const px = cx + ax * k, py = cy + ay * k;
      G.line(L, px - nx * (r - 3), py - ny * (r - 3), px + nx * (r - 2), py + ny * (r - 2), 'sweater3');
    }
  }
  // Fist: back-of-hand ellipse + four knuckle lobes + thumb, with skinShade on the lower-right and ink creases.
  //   lobes: [[x,y],...] centers (in layer coords) ordered from index finger to little finger
  //   thumb: [x0,y0,x1,y1] capsule from its base to its tip
  function fist(L, cx, cy, rx, ry, lobes, thumb, big) {
    const lr = big ? 7 : 6, lq = big ? 6 : 5;
    ell(L, cx, cy, rx, ry, 'skin');
    lobes.forEach((p) => ell(L, p[0], p[1], lr, lq, 'skin'));
    // shade: lower-right part of the whole fist
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (L.data[y * L.w + x] == null) continue;
      const dx = (x - cx) / (rx + 4), dy = (y - cy) / (ry + 4);
      if (dx + dy * 1.2 > 0.62) L.data[y * L.w + x] = G.col('skinShade');
    }
    lobes.forEach((p, i) => {
      // shade crescent on the lower-right of each knuckle
      for (let a = -lq + 2; a <= lq - 1; a++) {
        const px = p[0] + lr - Math.round(Math.abs(a - 1) * 0.7), py = p[1] + a;
        if (L.has(px, py)) L.set(px, py, 'skinShade');
        if (a > 1 && L.has(px - 1, py)) L.set(px - 1, py, 'skinShade');
      }
      G.rect(L, p[0] - 3, p[1] - 3, 2, 1, 'skin');
      // crease between this knuckle and the previous one: ink notch at the silhouette, skinShade inside
      if (i > 0) {
        const q = lobes[i - 1];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        let nx = -(p[1] - q[1]), ny = p[0] - q[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }   // outward
        G.line(L, mx + nx * 5, my + ny * 5, mx + nx * 1, my + ny * 1, 'ink');
        G.line(L, mx + nx * 1, my + ny * 1, mx - nx * 3, my - ny * 3, 'skinShade');
      }
    });
    if (thumb) {
      const tr = big ? 5 : 4;
      capsule(L, thumb[0], thumb[1], thumb[2], thumb[3], tr + 1, 'ink');
      capsule(L, thumb[0], thumb[1], thumb[2], thumb[3], tr, 'skin');
      const dx = thumb[2] - thumb[0], dy = thumb[3] - thumb[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      capsule(L, thumb[0] + nx * 2, thumb[1] + ny * 2, thumb[2] + nx * 2 - dx / l * 2, thumb[3] + ny * 2 - dy / l * 2, 1, 'skinShade');
      L.set(Math.round(thumb[2] + dx / l * 2), Math.round(thumb[3] + dy / l * 2), 'skinShade'); // nail hint
    }
  }

  // ------------------------------------------------------------------ hand + fork (close-up)
  // The girl's right hand: a fist around the fork handle seen from the thumb side, the thumb lying along the
  // handle, the folded mustard cuff at the wrist and the sleeve running off to the lower right.
  // (x,y) = fist center. grip 'hold' = fork diagonal (tines up-left), 'twirl' = fork vertical (tines up).
  F.drawHandForkLarge = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const frame = (opts.frame | 0) & 1;
    const grip = opts.grip || 'hold';
    const pasta = G.clamp(opts.pasta == null ? 0 : opts.pasta, 0, 1);
    const t = opts.t || 0;
    const diag = grip !== 'twirl';
    // ---- sleeve + cuff
    const SL = new Layer(130, 120);
    const sx = 30, sy = 30;                                   // fist center inside the layer
    sleeve(SL, sx + 28, sy + 18, sx + 97, sy + 87, 11);
    cuff(SL, sx + 24, sy + 14, 0.7, -0.7, 11, 6);
    SL.blit(ctx, x - sx, y - sy, { outline: 'ink' });
    // ---- fork through the fist
    let tipX, tipY;
    if (diag) { tipX = x - 42 + (frame ? 1 : 0); tipY = y - 42; }
    else { tipX = x + (frame ? 1 : 0); tipY = y - 58; }
    F.drawForkLarge(ctx, tipX, tipY, { angle: diag ? 'diag' : 'up', pasta: pasta, t: t, seed: 3 });
    // ---- the fist
    const HL = new Layer(74, 64);
    const hx = 32, hy = 28;
    if (diag) {
      fist(HL, hx + 5, hy - 1, 14, 11,
        [[hx - 13, hy - 5], [hx - 9, hy + 4], [hx - 2, hy + 10], [hx + 7, hy + 13]],
        [hx - 2, hy - 5, hx - 16, hy - 17], true);
    } else {
      fist(HL, hx + 5, hy, 14, 11,
        [[hx - 12, hy - 9], [hx - 14, hy], [hx - 12, hy + 9], [hx - 5, hy + 14]],
        [hx + 1, hy - 6, hx, hy - 20], true);
    }
    HL.blit(ctx, x - hx, y - hy, { outline: 'ink' });
    return { tipX: tipX, tipY: tipY };
  };

  // ------------------------------------------------------------------ dry spaghetti
  // Strands hang from (x,y). spread 0 = tight bundle, 1 = fanned out; sink shifts them down by sink*len*0.6 (the
  // scene draws the water surface over them so they appear to slide into the pot).
  const N_DRY = 15;
  F.drawDryPasta = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const spread = G.clamp(opts.spread == null ? 0 : opts.spread, 0, 1);
    const len = opts.len == null ? 60 : opts.len | 0;
    const sink = G.clamp(opts.sink == null ? 0 : opts.sink, 0, 1);
    const dy = Math.round(sink * len * 0.6);
    const L = new Layer(len * 2 + 20, len + dy + 6);
    const ox = x - len - 10, oy = y - 3;
    for (let i = 0; i < N_DRY; i++) {
      const k = (i - (N_DRY - 1) / 2) / ((N_DRY - 1) / 2);             // -1..1
      const h = G.hash(i, 11, 3);
      const x0 = x + Math.round(k * 4) - ox, y0 = y - 2 + dy - oy;
      const fan = k * (6 + spread * 26) + (h - 0.5) * 6 * spread;
      const x1 = x0 + Math.round(fan), y1 = y0 + len;
      const cxm = x0 + Math.round(fan * 0.35), cym = y0 + Math.round(len * 0.55);
      const c = (i % 3 === 1) ? 'pastaDry2' : 'pastaDry1';
      curve(x0, y0, cxm, cym, x1, y1, (px, py) => L.set(px, py, c));
    }
    L.blit(ctx, ox, oy, { outline: null });
    // 1px ink edge strands on both sides of the bundle so it reads at 1x
    const edge = (k, c) => {
      const fan = k * (6 + spread * 26);
      const x0 = x + Math.round(k * 4), y0 = y - 2 + dy;
      curve(x0, y0, x0 + Math.round(fan * 0.35), y0 + Math.round(len * 0.55), x0 + Math.round(fan), y0 + len, (px, py) => G.px(ctx, px, py, c));
    };
    edge(-1.08, 'pasta4'); edge(1.08, 'pasta4');
  };

  // Hand holding the dry spaghetti bundle from above; (x,y) = bottom of the fist where the strands come out.
  // The bundle also sticks out above the fist; the sleeve runs up-right.
  F.drawHandBundle = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const frame = (opts.frame | 0) & 1;
    const spread = G.clamp(opts.spread == null ? 0 : opts.spread, 0, 1);
    const len = opts.len == null ? 60 : opts.len;
    // strands: the part above the fist (tight) then the hanging part (fanning)
    F.drawDryPasta(ctx, x, y - 36, { spread: 0, len: 36, sink: 0 });
    F.drawDryPasta(ctx, x, y, { spread: spread, len: len, sink: opts.sink || 0 });
    // sleeve + cuff going up-right from the wrist
    const SL = new Layer(120, 110);
    const sx = 20, sy = 90;                                   // (x,y) inside the layer
    sleeve(SL, sx + 22, sy - 26, sx + 92, sy - 86, 11);
    cuff(SL, sx + 19, sy - 23, 0.66, 0.75, 11, 6);
    SL.blit(ctx, x - sx, y - sy, { outline: 'ink' });
    // the fist (seen from the thumb side) gripping the bundle
    const HL = new Layer(60, 50);
    const hx = 28, hy = 40;                                   // (x,y) = bottom-center of the fist in layer coords
    const f = frame ? 1 : 0;
    fist(HL, hx + 3, hy - 14, 12, 10,
      [[hx - 10 + f, hy - 24], [hx - 12 + f, hy - 16], [hx - 11 + f, hy - 8], [hx - 6, hy - 3]],
      [hx + 4, hy - 25, hx - 10, hy - 28]);
    HL.blit(ctx, x - hx, y - hy, { outline: 'ink' });
  };
  // API.md alias: drawHandLarge(ctx, x, y, {pose:'holdBundle'|'open', frame})
  F.drawHandLarge = function (ctx, x, y, opts) {
    opts = opts || {};
    F.drawHandBundle(ctx, x, y, { spread: opts.pose === 'open' ? 1 : (opts.spread || 0), frame: opts.frame, len: opts.len, sink: opts.sink });
  };

  // ------------------------------------------------------------------ wooden spoon
  // (x,y) = bottom of the bowl. 'up': handle straight up; 'diag': handle up-right.
  F.drawSpoonLarge = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const angle = opts.angle || 'diag';
    const L = new Layer(100, 100);
    const ox = 40, oy = 90;
    if (angle === 'up') {
      // handle: 5px wide, lit on the left
      capsule(L, ox, oy - 20, ox, oy - 82, 2, 'spoon1');
      G.vline(L, ox + 1, oy - 82, 62, 'spoon2'); G.vline(L, ox + 2, oy - 82, 62, 'spoon2');
      // bowl: oval, with the hollow (spoon2) offset to the lower right and a spoon1 rim
      ell(L, ox, oy - 11, 8, 11, 'spoon1');
      ell(L, ox + 1, oy - 10, 6, 9, 'spoon2');
      ell(L, ox, oy - 11, 5, 8, 'spoon1');
      ell(L, ox + 1, oy - 10, 4, 7, 'spoon2');
      G.rect(L, ox - 2, oy - 16, 2, 3, 'spoon1');
    } else {
      // handle up-right
      capsule(L, ox + 7, oy - 20, ox + 52, oy - 74, 2, 'spoon1');
      capsule(L, ox + 8, oy - 18, ox + 53, oy - 72, 1, 'spoon2');
      // bowl tilted along the handle: a stack of ellipses with the hollow to the lower right
      ell(L, ox + 1, oy - 10, 9, 10, 'spoon1');
      ell(L, ox + 2, oy - 9, 7, 8, 'spoon2');
      ell(L, ox, oy - 11, 5, 7, 'spoon1');
      ell(L, ox + 1, oy - 10, 4, 6, 'spoon2');
      G.rect(L, ox - 3, oy - 15, 2, 3, 'spoon1');
      G.line(L, ox + 5, oy - 22, ox + 49, oy - 75, 'spoon1');
    }
    L.blit(ctx, x - ox, y - oy, { outline: 'ink' });
  };

  // ------------------------------------------------------------------ sauce ladle (serving shot)
  F.drawSauceLadle = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const pour = G.clamp(opts.pour || 0, 0, 1), t = opts.t || 0;
    const L = new Layer(80, 80);
    const ox = 20, oy = 60;
    // bowl (tilted toward the lip at the lower-left), handle up-right
    ell(L, ox + 9, oy - 6, 11, 7, 'fork3');
    ell(L, ox + 9, oy - 7, 10, 6, 'fork2');
    ell(L, ox + 8, oy - 8, 8, 4, 'fork1');
    ell(L, ox + 9, oy - 8, 7, 3, 'sauce2');
    G.hline(L, ox + 4, oy - 10, 6, 'sauce1');
    capsule(L, ox + 18, oy - 12, ox + 56, oy - 52, 2, 'fork2');
    capsule(L, ox + 18, oy - 13, ox + 55, oy - 52, 0.6, 'fork1');
    L.blit(ctx, x - ox, y - oy, { outline: 'ink' });
    if (pour > 0.02) {
      const len = Math.round(pour * 26);
      G.rect(ctx, x - 1, y - 2, 3, len, 'sauce2');
      G.vline(ctx, x - 1, y - 2, len, 'sauce1');
      G.vline(ctx, x + 1, y - 2, len, 'sauce3');
      const bob = Math.floor(t * 6) & 1;
      G.rect(ctx, x - 1, y - 2 + len + bob, 3, 2, 'sauce2');
    }
  };

  // ------------------------------------------------------------------ room-scale reference plate + fork
  const PLATE_SMALL_FULL = PSA.sprite.make([
    '......oooooo......',
    '....oobsppsboo....',
    '..oobppbssbppboo..',
    '.oppppssbppsppppo.',
    'odppppbppsbppppddo',
    'oddddpppppppddddoo',
    '.oddddddddddddooo.',
    '..ooooooooooooo...'
  ], { o: 'ink', p: 'plate1', d: 'plate2', s: 'sauce2', b: 'pasta2', r: 'plateRim' });
  const PLATE_SMALL_HALF = PSA.sprite.make([
    '......oooooo......',
    '....oopppppoo.....',
    '..oobspppppsppoo..',
    '.oppbsbppppppppppo',
    'odpppbpppsppppppdo',
    'oddddpppppppddddoo',
    '.oddddddddddddooo.',
    '..ooooooooooooo...'
  ], { o: 'ink', p: 'plate1', d: 'plate2', s: 'sauce2', b: 'pasta2', r: 'plateRim' });
  const PLATE_SMALL_EMPTY = PSA.sprite.make([
    '......oooooo......',
    '....ooppppppoo....',
    '..ooppppppppppoo..',
    '.oppppppppppppppo.',
    'odppppppppppppppdo',
    'oddddpppppppddddoo',
    '.oddddddddddddooo.',
    '..ooooooooooooo...'
  ], { o: 'ink', p: 'plate1', d: 'plate2', s: 'sauce2', b: 'pasta2', r: 'plateRim' });
  F.drawPlateSmall = function (ctx, cx, cy, opts) {
    opts = opts || {};
    let a = opts.amount == null ? 1 : opts.amount;
    if (a === 'full') a = 1; else if (a === 'half') a = 0.5; else if (a === 'empty' || a === 'none') a = 0;
    const def = a > 0.75 ? PLATE_SMALL_FULL : a > 0.1 ? PLATE_SMALL_HALF : PLATE_SMALL_EMPTY;
    PSA.sprite.draw(ctx, def, (cx | 0) - 9, (cy | 0) - 4);
    if (opts.steam) steamPuffsSmall(ctx, cx | 0, (cy | 0) - 4, opts.t || 0, G.clamp(opts.steam, 0, 1));
  };
  F.drawPlateSmallRef = F.drawPlateSmall;
  function steamPuffsSmall(ctx, cx, baseY, t, k) {
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.5 + i * 0.5) % 1;
      if (ph > 0.85) continue;
      const y = Math.round(baseY - 1 - ph * 10 * k), x = cx - 3 + i * 5 + (Math.floor(ph * 4) & 1);
      G.dither(ctx, x, y - 1, 3, 2, 'steam', ph < 0.4 ? 0.5 : 0.25, i);
    }
  }
  const FORK_SMALL = PSA.sprite.make([
    'o.o.o.o',
    'o.o.o.o',
    '.ooooo.',
    '..oho..',
    '..oho..',
    '..oho..',
    '..oho..',
    '..oho..',
    '..oho..',
    '..ooo..'
  ], { o: 'fork3', h: 'fork1' });
  F.drawForkSmall = function (ctx, x, y) { PSA.sprite.draw(ctx, FORK_SMALL, x | 0, y | 0); };

  PSA.food = F;
})(window.PSA);
