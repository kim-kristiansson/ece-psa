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

  // An original small palette (25 colors) in the spirit of Undertale's overworld: slightly muted, warm, strong darks.
  // Highlights and in-between shades of the source art snap onto these, which is what makes it read flat.
  ST.PALETTE = [
    '#000000', '#ffffff', '#c8c8c8', '#808088', '#404048',      // black, white, greys (metal, fridge)
    '#f0e0a8', '#c8a868', '#a06838', '#603818',                 // cream wall, tan, wood brown, dark brown
    '#d83838', '#781818', '#f8d038', '#e88830', '#f8c098',      // red, dark red, yellow, orange, skin
    '#68a878', '#285838', '#70c8c0',                            // green, dark green, teal
    '#3858b8', '#182858', '#a878c8', '#483068', '#98d0f0',      // blue, navy, purple, dark purple, sky
    '#e07070', '#a8a8b0', '#e0a040'                             // sunset pink, light metal, mustard
  ];
  ST.OUTLINE = 0;                 // palette index used for outlines (black)
  ST.EDGE = 28;                   // color distance above which an edge gets an outline (low: nearly every color change)
  ST.PIXEL = 1;                   // art pixel size in native pixels; set per shot by the timeline (shot.px)

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

  const idx = new Uint8Array(W * H), out = new Uint8Array(W * H), full = new Uint8Array(W * H);

  // Lighting (PSA.light.apply) runs the pass itself just before it tints, so the tint lands on already-flat colors;
  // `done` tells the timeline not to run it a second time on that shot.
  ST.done = false;
  ST.apply = function (ctx) {
    if (!ST.enabled) return;
    ST.done = true;
    if (!pal) init();
    const P = ST.PIXEL | 0 || 1, w = Math.floor(W / P), h = Math.floor(H / P);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    // 1. quantize (full resolution), then reduce each PxP block to its most common color (ties -> the darkest,
    //    so 1px lines survive the reduction)
    for (let i = 0, p = 0; i < W * H; i++, p += 4) full[i] = nearest(d[p], d[p + 1], d[p + 2]);
    if (P === 1) idx.set(full);
    else {
      const cnt = new Uint8Array(n);
      for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
        cnt.fill(0);
        let best = full[by * P * W + bx * P], bc = 0;
        for (let j = 0; j < P; j++) for (let k = 0; k < P; k++) {
          const c = full[(by * P + j) * W + bx * P + k], v = ++cnt[c];
          if (v > bc || (v === bc && lum[c] < lum[best])) { bc = v; best = c; }
        }
        idx[by * w + bx] = best;
      }
    }
    // 2. clean: in raster order, a pixel whose 4 neighbours all share one other color takes that color
    //    (in-place, so a checkerboard collapses to a solid fill). Bright specks on dark (stars, eye glints) survive.
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, c = idx[i], l = idx[i - 1];
      if (l === c || idx[i + 1] !== l || idx[i - w] !== l || idx[i + w] !== l) continue;
      if (lum[c] > 190 && lum[l] < 110) continue;
      idx[i] = l;
    }
    // 3. outline the darker side of every strong edge
    out.set(idx.subarray(0, w * h));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = idx[i];
      if (c === ST.OUTLINE) continue;
      const row = c * n, lc = lum[c];
      if ((x > 0 && strong(row, lc, idx[i - 1])) || (x < w - 1 && strong(row, lc, idx[i + 1])) ||
          (y > 0 && strong(row, lc, idx[i - w])) || (y < h - 1 && strong(row, lc, idx[i + w]))) out[i] = ST.OUTLINE;
    }
    for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p += 4) {
      const c = pal[out[Math.min(h - 1, (y / P) | 0) * w + Math.min(w - 1, (x / P) | 0)]];
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  function strong(row, lc, o) { return dist[row + o] > ST.EDGE && lum[o] > lc; }

  PSA.style = ST;
})(window.PSA);
