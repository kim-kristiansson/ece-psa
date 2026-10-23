// Pixel drawing helpers. Everything draws axis-aligned integer rectangles on the native 384x216 canvas,
// so the result is always crisp pixel art (no anti-aliasing, no sub-pixel positions, no gradients).
(function (PSA) {
  const G = {};

  // Resolve a color: palette key (PSA.PAL) or a literal css color.
  G.col = function (c) {
    if (PSA.PAL && Object.prototype.hasOwnProperty.call(PSA.PAL, c)) return PSA.PAL[c];
    return c;
  };

  G.px = function (ctx, x, y, c) { ctx.fillStyle = G.col(c); ctx.fillRect(x | 0, y | 0, 1, 1); };
  G.rect = function (ctx, x, y, w, h, c) { ctx.fillStyle = G.col(c); ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
  G.hline = function (ctx, x, y, w, c) { G.rect(ctx, x, y, w, 1, c); };
  G.vline = function (ctx, x, y, h, c) { G.rect(ctx, x, y, 1, h, c); };
  // 1px outline rectangle (inside the given box)
  G.box = function (ctx, x, y, w, h, c) {
    G.hline(ctx, x, y, w, c); G.hline(ctx, x, y + h - 1, w, c);
    G.vline(ctx, x, y, h, c); G.vline(ctx, x + w - 1, y, h, c);
  };
  // Bresenham line
  G.line = function (ctx, x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    ctx.fillStyle = G.col(c);
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 4096; i++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  // Filled circle / ellipse (pixel-perfect, no AA)
  G.circle = function (ctx, cx, cy, r, c) { G.ellipse(ctx, cx, cy, r, r, c); };
  G.ellipse = function (ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = G.col(c);
    cx |= 0; cy |= 0;
    for (let y = -ry; y <= ry; y++) {
      const f = 1 - (y * y) / (ry * ry + 0.0001);
      if (f < 0) continue;
      const hw = Math.floor(Math.sqrt(f) * rx + 0.5);
      ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
  };
  // Circle outline (1px)
  G.ring = function (ctx, cx, cy, r, c) {
    ctx.fillStyle = G.col(c);
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      const pts = [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]];
      for (const [px, py] of pts) ctx.fillRect(cx + px, cy + py, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };
  // Dithered fill: pattern 0.5 = checkerboard, 0.25 = sparse, 0.75 = dense
  G.dither = function (ctx, x, y, w, h, c, density, phase) {
    ctx.fillStyle = G.col(c);
    density = density == null ? 0.5 : density; phase = phase | 0;
    if (PSA.FLAT) { if (density >= 0.5) ctx.fillRect(x | 0, y | 0, w | 0, h | 0); return; }   // flat style: solid or nothing
    x |= 0; y |= 0;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        let on;
        if (density >= 0.75) on = ((X + Y + phase) & 1) === 0 || ((X & 1) === 0 && (Y & 1) === 0);
        else if (density >= 0.5) on = ((X + Y + phase) & 1) === 0;
        else on = ((X + 2 * Y + phase) & 3) === 0;
        if (on) ctx.fillRect(X, Y, 1, 1);
      }
    }
  };
  // Dithered circle (used for soft light pools, steam puffs)
  G.ditherCircle = function (ctx, cx, cy, r, c, density, phase) {
    ctx.fillStyle = G.col(c);
    density = density == null ? 0.5 : density; phase = phase | 0;
    if (PSA.FLAT) { if (density >= 0.5) G.circle(ctx, cx | 0, cy | 0, r, c); return; }
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const X = cx + x, Y = cy + y;
      let on;
      if (density >= 0.75) on = ((X + Y + phase) & 1) === 0 || ((X & 1) === 0 && (Y & 1) === 0);
      else if (density >= 0.5) on = ((X + Y + phase) & 1) === 0;
      else on = ((X + 2 * Y + phase) & 3) === 0;
      if (on) ctx.fillRect(X, Y, 1, 1);
    }
  };

  // Deterministic pseudo-random helpers (NEVER use Math.random in render code: frames must be reproducible).
  G.hash = function (a, b, c) { // -> [0,1)
    a = (a | 0) * 374761393; b = (b | 0) * 668265263; c = (c | 0) * 2246822519;
    let h = (a ^ (b >>> 3) ^ (c << 5)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
  G.rng = function (seed) { // mulberry32
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smooth = (t) => { t = G.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // progress of t within [a,b] clamped to 0..1
  G.span = (t, a, b) => G.clamp((t - a) / (b - a), 0, 1);
  G.easeIn = (t) => { t = G.clamp(t, 0, 1); return t * t; };
  G.easeOut = (t) => { t = G.clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
  G.easeInOut = (t) => G.smooth(t);

  // Colors
  G.hexToRgb = function (hex) {
    hex = G.col(hex);
    const n = parseInt(hex.slice(1), 16);
    if (hex.length === 4) { const r = (n >> 8) & 15, g = (n >> 4) & 15, b = n & 15; return [r * 17, g * 17, b * 17]; }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  G.rgbToHex = function (r, g, b) {
    const h = (v) => ('0' + Math.round(G.clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  };
  G.mix = function (c1, c2, t) {
    const a = G.hexToRgb(c1), b = G.hexToRgb(c2);
    return G.rgbToHex(G.lerp(a[0], b[0], t), G.lerp(a[1], b[1], t), G.lerp(a[2], b[2], t));
  };
  G.shade = function (c, k) { // k<1 darker, k>1 lighter
    const a = G.hexToRgb(c);
    return G.rgbToHex(a[0] * k, a[1] * k, a[2] * k);
  };

  // Offscreen canvas with pixel-perfect settings
  G.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
  };

  PSA.gfx = G;
})(window.PSA);
