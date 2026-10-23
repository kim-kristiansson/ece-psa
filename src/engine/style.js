// STYLE PASS — turns every rendered shot into flat, hard-edged pixel art with a small fixed palette.
// Runs on the native 384x216 frame after a shot has drawn itself (and its lighting tint), before the text boxes:
//   1. quantize: every pixel snaps to the nearest color of PSA.style.PALETTE (no dithering, so regions stay flat)
//   2. clean:    lone pixels and checkerboard dither collapse into the surrounding color (no "noisy" texture)
//   3. outline:  where two clearly different colors meet, the darker side gets a 1px black line (hard outlines)
// The palette is an original, small set (Undertale-like in spirit: flat colors, black outlines, high contrast).
// The pass is pure (same input pixels -> same output), so exported frames stay deterministic.
(function (PSA) {
  const ST = {};
  ST.enabled = true;

  // The palette: one or two tones per material, picked from PSA.PAL (so the characters and the room keep their colors),
  // plus black/white. Highlights and in-between shades snap onto these, which is what makes the art read flat.
  ST.PALETTE = [
    'black', 'white',
    'wall', 'wallShade', 'wood1', 'wood2', 'floorLine', 'wood4',     // room
    'rug1', 'rug2', 'tile1', 'tileLine', 'counter1', 'counter2',
    'cabinet1', 'cabinet3', 'metal1', 'metal2', 'metal3', 'metal4', 'pot2', 'pot3',
    'fridge2', 'flame1', 'flame2', 'flame3', 'water2', 'water4',
    'pasta2', 'pasta3', 'sauce1', 'sauce2', 'sauce3', 'basil', 'leaf1', 'plateRim',   // food + decor
    'skin', 'skinShade', 'cheek', 'hair2', 'hair3', 'clip',                       // the girl
    'sweater2', 'sweater3', 'jeans1', 'jeans2', 'jeans3',
    'skySunset1', 'skySunset2', 'skySunset3', 'skyDusk1', 'skyDusk3', 'skyNight2', 'skyMorn2', 'moon'
  ];
  ST.OUTLINE = 0;                 // palette index used for outlines (black)
  ST.EDGE = 64;                   // color distance above which an edge gets an outline

  const W = PSA.W, H = PSA.H;
  let pal = null, lum = null, dist = null, n = 0;
  const lut = new Int16Array(32768).fill(-1);   // 15-bit rgb -> palette index

  function hexRgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function init() {
    pal = ST.PALETTE.map((k) => hexRgb(PSA.gfx.col(k))); n = pal.length;
    lum = pal.map((c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
    dist = new Float32Array(n * n);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) dist[a * n + b] = cdist(pal[a], pal[b]);
  }
  // "redmean" color distance: cheap and close enough to perceptual for picking palette entries
  function cdist(p, q) {
    const rm = (p[0] + q[0]) / 2, dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2];
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
  }
  function nearest(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let k = lut[key];
    if (k >= 0) return k;
    const c = [(r & 248) | 4, (g & 248) | 4, (b & 248) | 4];
    let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d = cdist(c, pal[i]); if (d < bd) { bd = d; best = i; } }
    lut[key] = best;
    return best;
  }

  const idx = new Uint8Array(W * H), out = new Uint8Array(W * H);

  // Lighting (PSA.light.apply) runs the pass itself just before it tints, so the tint lands on already-flat colors;
  // `done` tells the timeline not to run it a second time on that shot.
  ST.done = false;
  ST.apply = function (ctx) {
    if (!ST.enabled) return;
    ST.done = true;
    if (!pal) init();
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    // 1. quantize
    for (let i = 0, p = 0; i < W * H; i++, p += 4) idx[i] = nearest(d[p], d[p + 1], d[p + 2]);
    // 2. clean: in raster order, a pixel whose 4 neighbours all share one other color takes that color
    //    (in-place, so a checkerboard collapses to a solid fill). Bright specks on dark (stars, eye glints) survive.
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, c = idx[i], l = idx[i - 1];
      if (l === c || idx[i + 1] !== l || idx[i - W] !== l || idx[i + W] !== l) continue;
      if (lum[c] > 190 && lum[l] < 110) continue;
      idx[i] = l;
    }
    // 3. outline the darker side of every strong edge
    out.set(idx);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = idx[i];
      if (c === ST.OUTLINE) continue;
      const row = c * n, lc = lum[c];
      if ((x > 0 && strong(row, lc, idx[i - 1])) || (x < W - 1 && strong(row, lc, idx[i + 1])) ||
          (y > 0 && strong(row, lc, idx[i - W])) || (y < H - 1 && strong(row, lc, idx[i + W]))) out[i] = ST.OUTLINE;
    }
    for (let i = 0, p = 0; i < W * H; i++, p += 4) { const c = pal[out[i]]; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  };
  function strong(row, lc, o) { return dist[row + o] > ST.EDGE && lum[o] > lc; }

  PSA.style = ST;
})(window.PSA);
