// src/assets/props.js — LARGE close-up kitchen props (PSA.props).
//
// Everything here is drawn at 1 native pixel = 1 px ("camera moved closer": more detail, never an upscaled sprite),
// with the shared palette (src/assets/palette.js), 1px 'ink' outlines on the important props (pot, ladle, clock, knobs),
// 2-3 tones per material, light from the upper-left, and dithering only for soft things (steam, flame glow, sky bands).
// All coordinates are integers; nothing uses arcs, gradients, transforms or Math.random (seeds come from PSA.gfx.hash/rng).
//
// API (all functions are pure functions of their arguments; t = seconds):
//   skyBands(sky, phase)                                   -> [topKey, midKey, horizonKey] palette keys (top to bottom)
//   drawClock(ctx, cx, cy, r, h, m, {big, numerals})       analog clock. r>=24 (or big:true) = close-up version: wooden rim,
//                                                          12 hour marks (4 long), 2-3px hour/minute hands, thin red second
//                                                          hand driven by the fractional part of m. Smaller r = wall version.
//   drawWindowLarge(ctx, x, y, w, h, {sky, phase, t})       window FRAME rect (x,y,w,h): frame, 4 panes, sky bands + sun/moon/
//                                                          stars/rooftops, curtains on a rod (overhang ~12px each side, 6px
//                                                          above) and a sill (extends 6px each side, 6px below the rect).
//   drawTileWall(ctx, x, y, w, h)                           teal 12px running-bond tiles with grout and a subtle highlight.
//   drawStoveCloseup(ctx, {t, flame, x, y, w, h, burner})   cooktop band + front panel with knobs + burner ring/grate + flames
//                                                          (rect defaults to the bottom of the frame below y=104;
//                                                          burner defaults to {cx: x+w/2, cy: y+63, rx: 62, ry: 9}).
//   drawFlames(ctx, {t, flame, burner})                   only the FRONT flame tongues: call it after drawPotLarge when the
//                                                          flames should lick over the pot's lower edge (optional).
//   drawPotLarge(ctx, cx, bottomY, {boiling, t, pasta, stir, lid, tilt})
//                                                          ~170x92 steel pot, bottom-center anchored, seen slightly from above:
//                                                          water surface with foam ring, bubbles (boiling 0..1), spaghetti
//                                                          strands (pasta 0..1) that swirl when stir>0 (angle = stir*t*1.8).
//                                                          lid:true covers it; tilt (-1..1) leans the pot sideways (row shear).
//   drawSteam(ctx, cx, baseY, t, {intensity, width, height, seed, period})
//                                                          dithered puffs rising from (cx, baseY) and spreading, looping.
//   drawCounterCloseup(ctx, {x, y, w, h, edge})             cream counter top with a speckle; optional front edge band.
//   drawSauceLadle(ctx, x, y, {pour, t, streamLen})         ladle, bowl centre at (x,y), handle up-right; pour 0..1 tilts the
//                                                          bowl and pours a sauce stream (streamLen px) from the left lip.
//   POT_LARGE = {w, h, rimRy}                                dimensions, for scenes that place the steam/spoon.
(function (PSA) {
  const G = PSA.gfx;
  const P = PSA.props || (PSA.props = {});

  // Local colors not in the palette (same warm, desaturated register):
  const TILE_HI = '#a8d2c9';   // tile highlight edge (lighter teal than tile1)
  const SUN = 'lampGlow';      // the setting sun uses the pale warm glow key

  // ------------------------------------------------------------------ helpers
  const R = Math.round;
  const TAU = Math.PI * 2;

  function inEll(dx, dy, rx, ry) { return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1; }
  // half width of the row at offset y of an ellipse (same rounding as G.ellipse), -1 outside
  function ellipseHW(rx, ry, y) {
    const f = 1 - (y * y) / (ry * ry + 0.0001); if (f < 0) return -1;
    const hw = Math.floor(Math.sqrt(f) * rx + 0.5);
    return (hw === 0 && ry > 2) ? -1 : hw;                 // drop the 1px nub G.ellipse leaves at the top/bottom row
  }
  // Filled ellipse without the top/bottom nub (use for the big props; G.ellipse elsewhere is fine)
  function ell(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = G.col(c); cx |= 0; cy |= 0;
    for (let y = -ry; y <= ry; y++) { const hw = ellipseHW(rx, ry, y); if (hw >= 0) ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  }
  // 1px outline of a horizontally symmetric shape given by hwFn(y) (half width per row, -1 = no row): every pixel of
  // the shape with a 4-neighbour outside it. Gap-free, and it matches the fills exactly. half: 'top'|'bottom'|undefined.
  function outlineShape(ctx, cx, hwFn, y0, y1, c, half) {
    ctx.fillStyle = G.col(c); cx |= 0;
    for (let y = y0; y <= y1; y++) {
      if (half && half.top != null) { if (half.side === 'top' && y > half.top) continue; if (half.side === 'bottom' && y < half.top) continue; }
      const hw = hwFn(y); if (hw < 0) continue;
      const up = hwFn(y - 1), dn = hwFn(y + 1);
      for (let x = -hw; x <= hw; x++) {
        const ax = Math.abs(x);
        if (ax === hw || ax > up || ax > dn) ctx.fillRect(cx + x, y, 1, 1);
      }
    }
  }
  function ellipseOutline(ctx, cx, cy, rx, ry, c, half) {
    cy |= 0;
    outlineShape(ctx, cx, (y) => ellipseHW(rx, ry, y - cy), cy - ry, cy + ry, c, half ? { side: half, top: cy } : null);
  }

  // Dithered elliptic ring between (rx,ry) and (rx2,ry2)  (rx2 < rx). density 0.25 / 0.5 / 0.75 like G.dither.
  function ditherEllipseRing(ctx, cx, cy, rx, ry, rx2, ry2, c, density, phase) {
    ctx.fillStyle = G.col(c);
    density = density == null ? 0.5 : density; phase = phase | 0;
    cx |= 0; cy |= 0;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if (!inEll(x, y, rx, ry)) continue;
      if (rx2 > 0 && inEll(x, y, rx2, ry2)) continue;
      const X = cx + x, Y = cy + y;
      let on;
      if (density >= 0.75) on = ((X + Y + phase) & 1) === 0 || ((X & 1) === 0 && (Y & 1) === 0);
      else if (density >= 0.5) on = ((X + Y + phase) & 1) === 0;
      else on = ((X + 2 * Y + phase) & 3) === 0;
      if (on) ctx.fillRect(X, Y, 1, 1);
    }
  }

  // Line with integer thickness w (1..3): extra Bresenham lines offset along the axis perpendicular to the main direction.
  function thickLine(ctx, x0, y0, x1, y1, w, c) {
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
    const lo = -((w - 1) >> 1), hi = lo + w - 1;
    for (let k = lo; k <= hi; k++) {
      if (horiz) G.line(ctx, x0, y0 + k, x1, y1 + k, c);
      else G.line(ctx, x0 + k, y0, x1 + k, y1, c);
    }
  }

  // Reusable offscreen scratch canvases (cleared before use).
  const scratch = {};
  function getScratch(name, w, h) {
    let c = scratch[name];
    if (!c || c.width !== w || c.height !== h) { c = G.makeCanvas(w, h); scratch[name] = c; }
    const sctx = c.getContext('2d');
    sctx.clearRect(0, 0, w, h);
    return c;
  }
  // Blit a canvas with an integer shear: rows shifted by shiftRow(j) px (mode 'row') or columns by shiftCol(i) (mode 'col').
  function blitShear(ctx, src, dx, dy, mode, shiftFn) {
    const w = src.width, h = src.height;
    if (mode === 'row') for (let j = 0; j < h; j++) ctx.drawImage(src, 0, j, w, 1, dx + (shiftFn(j) | 0), dy + j, w, 1);
    else for (let i = 0; i < w; i++) ctx.drawImage(src, i, 0, 1, h, dx + i, dy + (shiftFn(i) | 0), 1, h);
  }

  // ------------------------------------------------------------------ sky
  // Three palette keys, top -> horizon, for the window panes.
  P.skyBands = function (sky, phase) {
    phase = G.clamp(phase == null ? 0 : phase, 0, 1);
    switch (sky) {
      case 'sunset':  return phase < 0.5 ? ['skySunset3', 'skySunset2', 'skySunset1'] : ['skyDusk1', 'skySunset3', 'skySunset2'];
      case 'dusk':    return phase < 0.5 ? ['skyDusk2', 'skyDusk1', 'skySunset3'] : ['skyDusk3', 'skyDusk2', 'skyDusk1'];
      case 'night':   return phase < 0.5 ? ['skyNight2', 'skyNight1', 'skyDusk3'] : ['skyNight3', 'skyNight2', 'skyNight1'];
      case 'morning': return ['skyMorn3', 'skyMorn2', 'skyMorn1'];
      default:        return ['skySunset3', 'skySunset2', 'skySunset1'];
    }
  };
  // Silhouette color of the distant rooftops for a sky
  function rooftopColor(sky, phase) {
    if (sky === 'night') return 'skyNight3';
    if (sky === 'dusk') return phase < 0.5 ? 'skyDusk3' : 'skyNight2';
    if (sky === 'morning') return 'skyMorn3';
    return phase < 0.5 ? 'skyDusk2' : 'skyDusk3';
  }

  // Sky inside a rect (x,y,w,h): 3 bands with 2px dithered transitions, sun/moon/stars, rooftops along the bottom.
  function drawSky(ctx, x, y, w, h, sky, phase, t) {
    const b = P.skyBands(sky, phase);
    const h1 = R(h * 0.42), h2 = R(h * 0.30);
    G.rect(ctx, x, y, w, h1, b[0]);
    G.rect(ctx, x, y + h1, w, h2, b[1]);
    G.rect(ctx, x, y + h1 + h2, w, h - h1 - h2, b[2]);
    // soft transitions (the brief allows dither for the dusk sky; kept to 2 rows so it stays calm)
    G.dither(ctx, x, y + h1 - 2, w, 2, b[1], 0.5, 0);
    G.dither(ctx, x, y + h1, w, 2, b[0], 0.5, 1);
    G.dither(ctx, x, y + h1 + h2 - 2, w, 2, b[2], 0.5, 0);
    G.dither(ctx, x, y + h1 + h2, w, 2, b[1], 0.5, 1);

    const horizon = y + h - R(h * 0.14);           // rooftop line
    if (sky === 'sunset') {
      // sun sinking behind the rooftops as phase -> 1
      const sr = Math.max(4, R(w * 0.055));
      const sx = x + R(w * 0.62), sy = horizon - sr - 3 - R((1 - phase) * h * 0.16) + R(phase * (sr + 2));
      G.circle(ctx, sx, sy, sr, SUN);
      G.circle(ctx, sx - 1, sy - 1, sr - 2, 'skyMorn1');
    }
    if (sky === 'night' || (sky === 'dusk' && phase > 0.4)) {
      // stars: seeded positions in the upper 70%, gentle twinkle
      const n = sky === 'night' ? 14 : 5;
      const tick = Math.floor((t || 0) * 1.5);
      for (let i = 0; i < n; i++) {
        const px = x + 2 + Math.floor(G.hash(i, 11, 1) * (w - 4));
        const py = y + 2 + Math.floor(G.hash(i, 12, 1) * (h * 0.66));
        if (G.hash(i, tick, 3) < 0.25) continue;                 // twinkle off
        G.px(ctx, px, py, 'star');
        if (G.hash(i, 13, 1) < 0.3) { G.px(ctx, px - 1, py, b[1]); G.px(ctx, px + 1, py, b[1]); G.px(ctx, px, py - 1, b[1]); G.px(ctx, px, py + 1, b[1]); }
      }
    }
    if (sky === 'night') {
      const mr = Math.max(4, R(w * 0.06));
      const mx = x + R(w * 0.3), my = y + R(h * 0.26);
      G.circle(ctx, mx, my, mr, 'moon');
      G.px(ctx, mx + 1, my + 1, 'skyMorn2'); G.px(ctx, mx - 2, my - 1, 'skyMorn2'); G.px(ctx, mx + 2, my - 2, 'skyMorn2');
    }
    if (sky === 'morning') {
      // two small pale clouds
      const cy1 = y + R(h * 0.2), cx1 = x + R(w * 0.3);
      G.ellipse(ctx, cx1, cy1, R(w * 0.12), 2, 'skyMorn1'); G.ellipse(ctx, cx1 + 4, cy1 - 2, R(w * 0.07), 2, 'skyMorn1');
      const cy2 = y + R(h * 0.44), cx2 = x + R(w * 0.72);
      G.ellipse(ctx, cx2, cy2, R(w * 0.1), 2, 'skyMorn1'); G.ellipse(ctx, cx2 - 3, cy2 - 2, R(w * 0.05), 1, 'skyMorn1');
    }
    // distant rooftops (silhouette) along the horizon
    const rc = rooftopColor(sky, phase);
    G.rect(ctx, x, horizon, w, y + h - horizon, rc);
    let hx = x - 4, k = 0;
    while (hx < x + w) {
      const hw = 10 + Math.floor(G.hash(k, 21, 2) * 10), hh = 4 + Math.floor(G.hash(k, 22, 2) * 7);
      const bx0 = Math.max(x, hx), bx1 = Math.min(x + w, hx + hw);
      if (bx1 > bx0) {
        G.rect(ctx, bx0, horizon - hh, bx1 - bx0, hh, rc);
        // pitched roof: 3 steps
        for (let s = 1; s <= 3; s++) {
          const rx0 = Math.max(x, hx + s * 2), rx1 = Math.min(x + w, hx + hw - s * 2);
          if (rx1 > rx0) G.rect(ctx, rx0, horizon - hh - s, rx1 - rx0, 1, rc);
        }
        // a chimney on some houses
        if (G.hash(k, 23, 2) < 0.4 && hx + hw - 5 >= x && hx + hw - 4 <= x + w) G.rect(ctx, hx + hw - 5, horizon - hh - 5, 2, 5, rc);
        // lit windows at night/dusk (1px warm squares), only a few
        if ((sky === 'night' || sky === 'dusk') && G.hash(k, 24, 2) < 0.6) {
          const wx = hx + 3 + Math.floor(G.hash(k, 25, 2) * Math.max(1, hw - 6)), wy = horizon - hh + 2;
          if (wx >= x && wx + 1 < x + w) G.rect(ctx, wx, wy, 2, 2, 'curtain1');
        }
      }
      hx += hw + 2 + Math.floor(G.hash(k, 26, 2) * 5);
      k++;
    }
  }

  // ------------------------------------------------------------------ window (large)
  P.drawWindowLarge = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    x |= 0; y |= 0; w |= 0; h |= 0;
    const sky = opts.sky || 'sunset', phase = opts.phase || 0, t = opts.t || 0;
    const fw = Math.max(4, R(w * 0.045));                 // frame thickness
    const mw = Math.max(3, R(w * 0.035));                 // mullion width
    // frame
    G.rect(ctx, x, y, w, h, 'frame1');
    G.box(ctx, x, y, w, h, 'frame2');
    G.hline(ctx, x + 1, y + h - 2, w - 2, 'frame2');      // bottom shade
    G.vline(ctx, x + w - 2, y + 1, h - 2, 'frame2');      // right shade
    // panes
    const px = x + fw, py = y + fw, pw = w - fw * 2, ph = h - fw * 2;
    drawSky(ctx, px, py, pw, ph, sky, phase, t);
    // inner frame rebate (shadow line inside the frame, light from upper-left)
    G.hline(ctx, px, py, pw, 'frame2'); G.vline(ctx, px, py, ph, 'frame2');
    // mullions (cross), horizontal bar slightly above the middle
    const mx = x + R(w / 2) - (mw >> 1), my = y + R(h * 0.46) - (mw >> 1);
    G.rect(ctx, mx, py, mw, ph, 'frame1'); G.vline(ctx, mx + mw - 1, py, ph, 'frame2');
    G.rect(ctx, px, my, pw, mw, 'frame1'); G.hline(ctx, px, my + mw - 1, pw, 'frame2');
    G.hline(ctx, px, my, pw, 'frame1');
    // glass glints: 1px highlight on the right/bottom pane edges (light catching the glass edge)
    G.vline(ctx, px + pw - 1, py + 1, ph - 2, 'frame1'); G.hline(ctx, px + 1, py + ph - 1, pw - 2, 'frame1');

    // sill: wood ledge under the frame, overhanging 6px on each side
    const sx = x - 6, sw = w + 12, sy = y + h;
    G.rect(ctx, sx, sy, sw, 2, 'wood1');
    G.rect(ctx, sx, sy + 2, sw, 3, 'wood2');
    G.hline(ctx, sx, sy + 5, sw, 'wood4');
    G.vline(ctx, sx + sw - 1, sy, 6, 'wood4');
    G.vline(ctx, sx, sy, 6, 'wood3');
    G.hline(ctx, sx, sy, sw, 'frame1');                   // top highlight of the sill
    // shadow under the sill on the wall (soft, 1 row)
    G.dither(ctx, sx + 1, sy + 6, sw - 2, 1, 'wallShade', 0.5, 0);

    // curtain rod with ball finials
    const ry0 = y - 6;
    G.rect(ctx, x - 12, ry0, w + 24, 2, 'wood2');
    G.hline(ctx, x - 12, ry0, w + 24, 'wood1');
    G.rect(ctx, x - 14, ry0 - 1, 3, 4, 'wood3'); G.rect(ctx, x + w + 11, ry0 - 1, 3, 4, 'wood3');
    G.px(ctx, x - 14, ry0 - 1, 'wood2'); G.px(ctx, x + w + 11, ry0 - 1, 'wood2');
    // curtains: hang from the rod to just above the sill; tie-back narrows them at 58% height
    const cw = Math.max(12, R(w * 0.21)), ctop = ry0 + 2, cbot = sy - 1;
    drawCurtain(ctx, x - 9, ctop, cw, cbot - ctop, false);
    drawCurtain(ctx, x + w + 9 - cw, ctop, cw, cbot - ctop, true);
  };

  // One curtain panel. (x,y,w,h) = its box; the inner edge (toward the glass) is the right edge for the left curtain
  // (mirror=false) and the left edge for the right curtain (mirror=true). The outer edge stays straight.
  function drawCurtain(ctx, x, y, w, h, mirror) {
    const tieY = R(h * 0.58), tieH = 4, pinchMax = Math.max(4, R(w * 0.3));
    for (let j = 0; j < h; j++) {
      // gathered by a tie-back: the inner edge curves in toward the tie and flares back out to the hem
      const pinch = j <= tieY ? R(pinchMax * G.smooth(j / tieY)) : R(pinchMax * (1 - 0.8 * G.smooth((j - tieY) / (h - tieY))));
      let rw = w - pinch;
      if (j === h - 1) rw -= 1;
      const rx = mirror ? x + w - rw : x;
      // folds: 3px stripes, highlight / base / shade
      for (let i = 0; i < rw; i++) {
        const u = mirror ? rw - 1 - i : i;
        const fold = (u + (j >> 5)) % 7;           // slight diagonal drift so the folds are not dead-straight
        const c = fold < 2 ? 'curtain1' : fold < 5 ? 'curtain1' : 'curtain2';
        G.px(ctx, rx + i, y + j, fold === 4 ? 'sweater1' : c);
      }
      // inner edge shade
      G.px(ctx, mirror ? rx : rx + rw - 1, y + j, 'curtain2');
    }
    // scalloped hem (every 3px a 1px notch in the hem line)
    for (let i = 0; i < w; i++) {
      const u = mirror ? w - 1 - i : i;
      if (u % 3 === 1) G.px(ctx, x + i, y + h - 1, 'wallShade');
      else G.px(ctx, x + i, y + h - 1, 'curtain2');
    }
    // tie band
    const tw = w - pinchMax + 1;
    G.rect(ctx, mirror ? x + w - tw : x, y + tieY - (tieH >> 1), tw, tieH, 'sweater3');
    G.hline(ctx, mirror ? x + w - tw : x, y + tieY - (tieH >> 1), tw, 'sweater2');
    G.vline(ctx, mirror ? x + w - tw : x + tw - 1, y + tieY - (tieH >> 1), tieH, 'ink');
    // curtain hooks at the rod (1px loops)
    for (let i = 2; i < w; i += 6) G.px(ctx, x + i, y - 1, 'wood4');
  }

  // ------------------------------------------------------------------ tiles
  P.drawTileWall = function (ctx, x, y, w, h) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const pitch = 12;
    G.rect(ctx, x, y, w, h, 'tileLine');
    const rows = Math.ceil(h / pitch) + 1, cols = Math.ceil(w / pitch) + 2;
    for (let j = 0; j < rows; j++) {
      const ty = y + j * pitch + 1;                         // 1px grout above each row
      const off = (j & 1) ? pitch >> 1 : 0;                // running bond
      for (let i = -1; i < cols; i++) {
        const tx = x + i * pitch + off + 1;
        // clip the tile to the rect
        const x0 = Math.max(x, tx), y0 = Math.max(y, ty);
        const x1 = Math.min(x + w, tx + pitch - 1), y1 = Math.min(y + h, ty + pitch - 1);
        if (x1 <= x0 || y1 <= y0) continue;
        const dark = G.hash(i + 7, j + 3, 5) < 0.14;      // a few darker tiles for variety
        G.rect(ctx, x0, y0, x1 - x0, y1 - y0, dark ? 'tile2' : 'tile1');
        // bevel: light top/left, shade bottom/right (clipped)
        if (ty >= y && ty < y + h) G.hline(ctx, x0, ty, x1 - x0, dark ? 'tile1' : TILE_HI);
        if (tx >= x && tx < x + w) G.vline(ctx, tx, y0, y1 - y0, dark ? 'tile1' : TILE_HI);
        if (ty + pitch - 2 >= y && ty + pitch - 2 < y + h) G.hline(ctx, x0, ty + pitch - 2, x1 - x0, 'tile2');
        if (tx + pitch - 2 >= x && tx + pitch - 2 < x + w) G.vline(ctx, tx + pitch - 2, y0, y1 - y0, 'tile2');
        // a corner glint on the lighter tiles
        if (!dark && tx + 2 >= x && ty + 2 >= y && tx + 2 < x + w && ty + 2 < y + h) G.px(ctx, tx + 2, ty + 2, TILE_HI);
      }
    }
  };

  // ------------------------------------------------------------------ clock
  P.drawClock = function (ctx, cx, cy, r, h, m, opts) {
    opts = opts || {};
    cx |= 0; cy |= 0; r |= 0;
    const big = !!opts.big || r >= 24;
    const rimW = big ? Math.max(3, R(r * 0.09)) : 1;
    // rim (outline, wood, highlight crescent on the upper-left)
    G.circle(ctx, cx, cy, r + 1, 'ink');
    if (big) {
      G.circle(ctx, cx, cy, r, 'wood3');
      G.circle(ctx, cx + 1, cy + 1, r - 1, 'clockRim');
    } else G.circle(ctx, cx, cy, r, 'clockRim');
    const R1 = r - rimW;                                   // face radius
    G.circle(ctx, cx, cy, R1, big ? 'plate2' : 'clockFace');
    if (big) G.circle(ctx, cx - 1, cy - 1, R1 - 1, 'clockFace');
    // hour marks
    const rIn = R1 - (big ? 2 : 1);
    for (let i = 0; i < 12; i++) {
      const long = i % 3 === 0;
      if (!big && !long) continue;
      const a = (i / 12) * TAU - Math.PI / 2;
      const len = big ? (long ? Math.max(4, R(r * 0.14)) : Math.max(2, R(r * 0.07))) : (long ? 2 : 1);
      const x1 = cx + Math.cos(a) * rIn, y1 = cy + Math.sin(a) * rIn;
      const x0 = cx + Math.cos(a) * (rIn - len), y0 = cy + Math.sin(a) * (rIn - len);
      thickLine(ctx, x0, y0, x1, y1, big && long ? 2 : 1, 'clockHand');
    }
    // numerals 12/3/6/9 on the big version when there is room
    if (big && r >= 40 && opts.numerals !== false && PSA.font && PSA.font.text) {
      const nr = rIn - Math.max(4, R(r * 0.14)) - 6;
      const F = PSA.font;
      F.text(ctx, '12', cx, cy - nr - 3, { color: 'clockHand', align: 'center' });
      F.text(ctx, '6', cx, cy + nr - 4, { color: 'clockHand', align: 'center' });
      F.text(ctx, '3', cx + nr + 1, cy - 4, { color: 'clockHand', align: 'center' });
      F.text(ctx, '9', cx - nr - 1, cy - 4, { color: 'clockHand', align: 'center' });
    }
    // hands (angles: 12 o'clock = up)
    h = h == null ? 0 : h; m = m == null ? 0 : m;
    const hm = ((h % 12) + m / 60) / 12, mm = (m % 60) / 60;
    const ah = hm * TAU - Math.PI / 2, am = mm * TAU - Math.PI / 2;
    const lh = R(R1 * 0.52), lm = R(R1 * 0.76), tail = big ? Math.max(2, R(r * 0.08)) : 0;
    const wh = big ? (r >= 40 ? 3 : 2) : 1, wm = big ? 2 : 1;
    thickLine(ctx, cx - Math.cos(ah) * tail, cy - Math.sin(ah) * tail, cx + Math.cos(ah) * lh, cy + Math.sin(ah) * lh, wh, 'clockHand');
    thickLine(ctx, cx - Math.cos(am) * tail, cy - Math.sin(am) * tail, cx + Math.cos(am) * lm, cy + Math.sin(am) * lm, wm, 'clockHand');
    if (big) {
      // second hand: fractional minute -> 0..60 s, thin red with a short tail
      const sec = (m - Math.floor(m)) * 60;
      const as = (sec / 60) * TAU - Math.PI / 2, ls = R(R1 * 0.84), ts = Math.max(3, R(r * 0.14));
      G.line(ctx, cx - Math.cos(as) * ts, cy - Math.sin(as) * ts, cx + Math.cos(as) * ls, cy + Math.sin(as) * ls, 'clockSec');
      G.circle(ctx, cx, cy, r >= 40 ? 2 : 1, 'clockHand');
      G.px(ctx, cx, cy, 'clockSec');
    } else G.px(ctx, cx, cy, 'clockHand');
  };

  // ------------------------------------------------------------------ stove close-up
  P.drawStoveCloseup = function (ctx, opts) {
    opts = opts || {};
    const t = opts.t || 0, flame = G.clamp(opts.flame == null ? 1 : opts.flame, 0, 1);
    const x = opts.x == null ? 0 : opts.x | 0, y = opts.y == null ? 104 : opts.y | 0;
    const w = opts.w == null ? PSA.W - x : opts.w | 0, h = opts.h == null ? PSA.H - y : opts.h | 0;
    const topH = R(h * 0.72);                              // cooktop surface band; the rest is the front panel
    const b = Object.assign({ cx: x + (w >> 1), cy: y + R(h * 0.52), rx: 62, ry: 7 }, opts.burner || {});
    // cooktop surface
    G.rect(ctx, x, y, w, topH, 'stoveTop');
    G.hline(ctx, x, y, w, 'metal3');                       // back edge against the tiles
    G.hline(ctx, x, y + 1, w, 'metal4');
    // front edge lip + front panel with knobs
    G.hline(ctx, x, y + topH - 1, w, 'metal4');
    G.hline(ctx, x, y + topH, w, 'metal1');
    G.hline(ctx, x, y + topH + 1, w, 'metal2');
    G.rect(ctx, x, y + topH + 2, w, h - topH - 2, 'metal3');
    G.hline(ctx, x, y + h - 2, w, 'metal4'); G.hline(ctx, x, y + h - 1, w, 'metal4');
    const ky = y + topH + ((h - topH) >> 1) + 1, kr = Math.max(4, Math.min(7, (h - topH) >> 2));
    const knobX = [b.cx - R(b.rx * 0.65), b.cx + R(b.rx * 0.65)];
    knobX.forEach((kx, i) => {
      if (kx - kr - 1 < x || kx + kr + 1 > x + w) return;
      G.circle(ctx, kx, ky, kr + 1, 'ink');
      G.circle(ctx, kx, ky, kr, 'metal2');
      G.circle(ctx, kx - 1, ky - 1, kr - 1, 'metal1');
      G.circle(ctx, kx, ky, kr - 3, 'metal2');
      // pointer: knob 0 (the lit burner) turned to "high" (pointing up-left), knob 1 off (pointing down)
      const a = i === 0 && flame > 0 ? -Math.PI * 0.75 : Math.PI / 2;
      thickLine(ctx, kx, ky, kx + Math.cos(a) * (kr - 1), ky + Math.sin(a) * (kr - 1), 2, 'ink');
    });
    // a second (unlit) burner at the back right if it fits
    const b2x = b.cx + R(b.rx * 1.55), b2y = y + R(h * 0.22), b2rx = R(b.rx * 0.45), b2ry = Math.max(3, R(b.ry * 0.5));
    if (b2x + b2rx + 2 < x + w && b2y - b2ry > y + 2) {
      G.ellipse(ctx, b2x, b2y, b2rx + 1, b2ry + 1, 'metal4');
      G.ellipse(ctx, b2x, b2y, b2rx, b2ry, 'stoveTop');
      G.ellipse(ctx, b2x, b2y, b2rx - 3, Math.max(1, b2ry - 2), 'metal4');
      G.ellipse(ctx, b2x, b2y, b2rx - 4, Math.max(1, b2ry - 3), 'stoveTop');
      G.hline(ctx, b2x - b2rx, b2y, b2rx * 2 + 1, 'metal4');
      G.vline(ctx, b2x, b2y - b2ry, b2ry * 2 + 1, 'metal4');
    }
    // flame glow on the cooktop (soft, dithered, only when lit)
    if (flame > 0.15) ditherEllipseRing(ctx, b.cx, b.cy + 1, b.rx + 8, b.ry + 4, b.rx + 2, b.ry + 1, 'flame2', 0.25, Math.floor(t * 8) & 1);
    // tongues at the back of the ring (seen behind the ring; the pot usually hides them)
    if (flame > 0.02) drawFlames(ctx, b, t, flame * 0.45, false);
    // burner ring (steel) + radial grate bars the pot stands on
    G.ellipse(ctx, b.cx, b.cy, b.rx + 2, b.ry + 1, 'metal4');
    G.ellipse(ctx, b.cx, b.cy, b.rx, b.ry, 'stoveTop');
    G.ellipse(ctx, b.cx, b.cy, b.rx - 3, Math.max(1, b.ry - 2), 'metal3');
    G.ellipse(ctx, b.cx, b.cy, b.rx - 4, Math.max(1, b.ry - 3), 'stoveTop');
    const bars = 6;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * TAU + Math.PI / bars;
      const ex = b.cx + Math.cos(a) * (b.rx + 12), ey = b.cy + Math.sin(a) * (b.ry + 4);
      thickLine(ctx, b.cx + Math.cos(a) * (b.rx - 6), b.cy + Math.sin(a) * (b.ry - 1), ex, ey, 2, 'metal4');
      G.line(ctx, b.cx + Math.cos(a) * (b.rx - 6), b.cy + Math.sin(a) * (b.ry - 1) - 1, ex, ey - 1, 'metal2');
    }
    // flames along the FRONT arc of the ring (a pot drawn afterwards sits on them; its bottomY should be ~burner.cy - 2)
    if (flame > 0.02) {
      ellipseRingFront(ctx, b.cx, b.cy, b.rx - 1, b.ry - 1, 'flame3');
      drawFlames(ctx, b, t, flame, true);
    }
  };
  // Flame tongues along one half of the burner ellipse b. front=true: the half nearer the camera (y >= cy).
  // Exposed as P.drawFlames(ctx, {t, flame, burner}) so a scene can draw the front tongues OVER a pot's lower edge.
  function drawFlames(ctx, b, t, flame, front) {
    const n = 22, fr = Math.floor(t * 12);
    for (let i = 0; i < n; i++) {
      const a = (front ? 1 : -1) * Math.PI * (i + 0.5) / n;   // 0..pi => front half (sin > 0 => below centre)
      const fx = R(b.cx + Math.cos(a) * (b.rx - 2)), fy = R(b.cy + Math.sin(a) * (b.ry - 1));
      const depth = 0.5 + 0.5 * Math.abs(Math.sin(a));        // tongues at the sides are seen edge-on: shorter
      const hgt = R(flame * (6 + 8 * G.hash(i, fr, front ? 9 : 10)) * depth);
      if (hgt < 2) continue;
      const lean = G.hash(i, fr + 1, 9) < 0.33 ? -1 : G.hash(i, fr + 1, 9) > 0.66 ? 1 : 0;
      G.rect(ctx, fx - 1, fy - 2, 3, 3, 'flame3');            // blue base
      const lowH = Math.max(1, R(hgt * 0.4)), midH = Math.max(1, R(hgt * 0.35)), tipH = Math.max(1, hgt - lowH - midH);
      let yy = fy - 2;
      G.rect(ctx, fx - 1, yy - lowH, 3, lowH, 'flame2');       // wide orange base
      yy -= lowH;
      G.rect(ctx, fx + (lean < 0 ? -1 : 0), yy - midH, 2, midH, 'flame2');   // narrower middle, leaning
      yy -= midH;
      G.rect(ctx, fx + lean, yy - tipH, 1, tipH, 'flame2');    // 1px tip
      G.vline(ctx, fx, fy - 2 - lowH, lowH, 'flame1');         // yellow core
      if (midH > 1) G.px(ctx, fx + (lean < 0 ? -1 : 0), fy - 2 - lowH - 1, 'flame1');
      G.px(ctx, fx + lean, yy - tipH, 'flame1');
    }
  }
  P.drawFlames = function (ctx, opts) {
    opts = opts || {};
    const b = Object.assign({ cx: PSA.W >> 1, cy: 162, rx: 62, ry: 7 }, opts.burner || {});
    drawFlames(ctx, b, opts.t || 0, G.clamp(opts.flame == null ? 1 : opts.flame, 0, 1), true);
  };
  // front half of a 1px ellipse outline (y >= cy)
  function ellipseRingFront(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = G.col(c);
    for (let x = -rx; x <= rx; x++) {
      const f = 1 - (x * x) / (rx * rx);
      const yy = R(Math.sqrt(Math.max(0, f)) * ry);
      ctx.fillRect(cx + x, cy + yy, 1, 1);
      // fill vertical gaps where the curve is steep
      const f2 = 1 - ((x + 1) * (x + 1)) / (rx * rx);
      const yy2 = x < rx ? R(Math.sqrt(Math.max(0, f2)) * ry) : yy;
      const lo = Math.min(yy, yy2), hi = Math.max(yy, yy2);
      if (hi - lo > 1) ctx.fillRect(cx + x + (yy2 > yy ? 0 : 1), cy + lo + 1, 1, hi - lo - 1);
    }
  }

  // ------------------------------------------------------------------ big pot
  const POT = { w: 170, h: 92, rx: 85, rimY: -76, rimRy: 12, botRy: 10, botRx: 82, innerRx: 80, innerRy: 9 };
  P.POT_LARGE = { w: POT.w, h: POT.h, rimRy: POT.rimRy };

  P.drawPotLarge = function (ctx, cx, bottomY, opts) {
    opts = opts || {};
    cx |= 0; bottomY |= 0;
    const boiling = G.clamp(opts.boiling == null ? 0 : opts.boiling, 0, 1);
    const pasta = G.clamp(opts.pasta == null ? 0 : opts.pasta, 0, 1);
    const stir = G.clamp(opts.stir == null ? 0 : opts.stir, 0, 1);
    const tilt = G.clamp(opts.tilt == null ? 0 : opts.tilt, -1, 1);
    const t = opts.t || 0;
    // draw into a scratch canvas so the tilt can be applied as an integer row shear
    const SW = POT.w + 48, SH = POT.h + 8;                 // handles overhang, rim top above
    const ox = SW >> 1, oy = SH - 4;                       // pot anchor inside the scratch canvas
    const c = getScratch('pot', SW, SH);
    const s = c.getContext('2d');
    drawPotBody(s, ox, oy, boiling, pasta, stir, t, !!opts.lid);
    const dx = cx - ox, dy = bottomY - oy;
    if (tilt === 0) ctx.drawImage(c, dx, dy);
    else blitShear(ctx, c, dx, dy, 'row', (j) => R(tilt * (oy - j) * 0.14));
  };

  function drawPotBody(ctx, cx, by, boiling, pasta, stir, t, lid) {
    const RX = POT.rx, rimY = by + POT.rimY, rimRy = POT.rimRy;
    const botCy = by - POT.botRy, botRx = POT.botRx, botRy = POT.botRy;
    // --- side handles (drawn first; the body covers their inner ends)
    for (const side of [-1, 1]) {
      const hw = 22, hh = 12;
      const hx = side < 0 ? cx - RX - hw + 2 : cx + RX - 1, hy = rimY - 2;
      G.rect(ctx, hx, hy, hw, hh, 'ink');
      G.rect(ctx, hx + 1, hy + 1, hw - 2, hh - 2, 'pot2');
      G.hline(ctx, hx + 1, hy + 1, hw - 2, 'pot1');
      G.hline(ctx, hx + 1, hy + hh - 2, hw - 2, 'pot3');
      G.hline(ctx, hx + 1, hy + hh - 3, hw - 2, 'pot3');
      // hole through the handle
      const holeX = side < 0 ? hx + 4 : hx + 6, holeW = 12, holeH = 4;
      ctx.clearRect(holeX, hy + 4, holeW, holeH);
      G.box(ctx, holeX - 1, hy + 3, holeW + 2, holeH + 2, 'ink');
      G.hline(ctx, holeX, hy + 8, holeW, 'pot1');         // light catching the lower edge of the hole
      // rounded outer corners (2px)
      const ox2 = side < 0 ? hx : hx + hw - 2;
      ctx.clearRect(ox2, hy, 2, 1); ctx.clearRect(side < 0 ? hx : hx + hw - 1, hy + 1, 1, 1);
      ctx.clearRect(ox2, hy + hh - 1, 2, 1); ctx.clearRect(side < 0 ? hx : hx + hw - 1, hy + hh - 2, 1, 1);
      G.px(ctx, side < 0 ? hx + 1 : hx + hw - 2, hy + 1, 'ink'); G.px(ctx, side < 0 ? hx + 1 : hx + hw - 2, hy + hh - 2, 'ink');
      // rivets where the handle meets the body
      const rvx = side < 0 ? hx + hw - 4 : hx + 2;
      G.px(ctx, rvx, hy + 3, 'pot1'); G.px(ctx, rvx, hy + hh - 4, 'pot1');
    }
    // --- body: rows from the rim centre line down to the bottom ellipse's lower arc
    const hwAt = (y) => {
      if (y < rimY || y > by) return -1;
      if (y <= botCy) return R(G.lerp(RX, botRx, (y - rimY) / (botCy - rimY)));
      return ellipseHW(botRx, botRy, y - botCy);
    };
    for (let y = rimY; y <= by; y++) {
      const hw = hwAt(y); if (hw < 0) continue;
      const x0 = cx - hw, x1 = cx + hw;
      // shading bands by horizontal position on the cylinder (light from the upper-left)
      const bands = [[-1, -0.92, 'pot3'], [-0.92, -0.6, 'pot2'], [-0.6, 0.3, 'pot3'], [0.3, 1.01, 'pot4']];
      for (const bd of bands) {
        const bx0 = Math.max(x0, R(cx + bd[0] * hw)), bx1 = Math.min(x1, R(cx + bd[1] * hw));
        if (bx1 > bx0) G.rect(ctx, bx0, y, bx1 - bx0, 1, bd[2]);
      }
      G.px(ctx, R(cx - 0.8 * hw), y, 'pot1');            // 1px specular line
      // lower rows darker (shadow under the belly, soot near the bottom)
      if (y > botCy + 4) { G.rect(ctx, x0, y, hw * 2 + 1, 1, 'pot4'); }
      else if (y > botCy) { G.rect(ctx, R(cx - 0.6 * hw), y, R(1.6 * hw), 1, 'pot4'); }
    }
    // shadow cast by the rim's lip on the body (follows the rim's lower arc)
    ell(ctx, cx, rimY, RX - 1, rimRy + 3, 'pot4');
    ell(ctx, cx, rimY, RX - 2, rimRy + 1, 'pot3');
    // body outline (sides + bottom arc), gap-free
    outlineShape(ctx, cx, hwAt, rimY, by, 'ink');
    // --- rim: highlight crescent (upper-left), base, inner shade, outline
    ell(ctx, cx, rimY, RX, rimRy, 'pot1');
    ell(ctx, cx + 1, rimY + 1, RX - 2, rimRy - 2, 'pot2');
    ell(ctx, cx, rimY, POT.innerRx + 1, POT.innerRy + 1, 'pot3');
    ellipseOutline(ctx, cx, rimY, RX, rimRy, 'ink');
    // --- interior wall + water
    ell(ctx, cx, rimY, POT.innerRx, POT.innerRy, 'pot4');
    const wRx = 78, wRy = 7, wCy = rimY + 1;
    if (lid) {
      // lid: a slightly domed disc on the rim with a knob
      ell(ctx, cx, rimY - 2, RX, rimRy, 'pot2');
      ell(ctx, cx - 1, rimY - 3, RX - 2, rimRy - 2, 'pot1');
      ell(ctx, cx + 1, rimY - 2, RX - 4, rimRy - 4, 'pot2');
      ell(ctx, cx, rimY - 2, RX - 16, rimRy - 6, 'pot3');
      ell(ctx, cx, rimY - 3, RX - 18, rimRy - 7, 'pot2');
      ellipseOutline(ctx, cx, rimY - 2, RX, rimRy, 'ink');
      G.rect(ctx, cx - 5, rimY - 10, 10, 6, 'ink');
      G.rect(ctx, cx - 4, rimY - 9, 8, 4, 'pot3');
      G.hline(ctx, cx - 4, rimY - 9, 8, 'pot1');
      return;
    }
    ell(ctx, cx, wCy, wRx, wRy, 'water4');
    ell(ctx, cx, wCy, wRx - 2, wRy - 1, 'water3');
    ell(ctx, cx - 10, wCy - 1, 56, 4, 'water2');     // lighter reflection toward the upper-left
    ell(ctx, cx - 30, wCy - 2, 18, 1, 'water1');      // glint

    // --- pasta strands under the surface (curves of short line segments, clipped to the water ellipse)
    const swirl = stir * t * 1.8;
    const nStr = R(pasta * 16);
    const cosS = Math.cos(swirl), sinS = Math.sin(swirl);
    const toPx = (u, v) => [cx + R((u * cosS - v * sinS) * (wRx - 4)), wCy + R((u * sinS + v * cosS) * (wRy - 1))];
    const inside = (u, v) => u * u + v * v <= 0.94;
    for (let k = 0; k < nStr; k++) {
      const a0 = G.hash(k, 31, 7) * TAU, r0 = Math.sqrt(G.hash(k, 32, 7)) * 0.85;
      let u = Math.cos(a0) * r0, v = Math.sin(a0) * r0;
      let head = G.hash(k, 33, 7) * TAU;
      const curve = (G.hash(k, 34, 7) - 0.5) * 0.9;
      const col = k % 3 === 0 ? 'pasta1' : 'pasta2';
      // strands wobble gently with the boil
      head += Math.sin(t * 2.2 + k) * 0.12 * boiling;
      let p = toPx(u, v);
      for (let sgm = 0; sgm < 7; sgm++) {
        const nu = u + Math.cos(head) * 0.16, nv = v + Math.sin(head) * 0.16;
        if (!inside(nu, nv)) { head += Math.PI * 0.6; continue; }
        const q = toPx(nu, nv);
        G.line(ctx, p[0], p[1] + 1, q[0], q[1] + 1, 'pasta4');
        G.line(ctx, p[0], p[1], q[0], q[1], col);
        u = nu; v = nv; p = q; head += curve;
      }
    }
    // --- swirl streaks when stirring (foam lines following the rotation)
    if (stir > 0.05) {
      const n = R(stir * 5);
      for (let k = 0; k < n; k++) {
        const a = swirl * 1.3 + k * (TAU / 5), r = 0.45 + 0.3 * G.hash(k, 41, 1);
        for (let sgm = 0; sgm < 3; sgm++) {
          const aa = a + sgm * 0.22, ab = aa + 0.2;
          const p1 = toPx(Math.cos(aa) * r, Math.sin(aa) * r), p2 = toPx(Math.cos(ab) * r, Math.sin(ab) * r);
          // toPx already rotates by swirl, so these move with the water
          G.line(ctx, p1[0], p1[1], p2[0], p2[1], 'water1');
        }
      }
    }
    // --- foam ring near the walls + clumps (scaled by boiling)
    if (boiling > 0.05) {
      const dens = boiling > 0.9 ? 0.75 : boiling > 0.4 ? 0.5 : 0.25;
      ditherEllipseRing(ctx, cx, wCy, wRx - 1, wRy, wRx - 6, wRy - 2, 'water1', dens, Math.floor(t * 6) & 1);
      const nc = R(boiling * 9), tick = Math.floor(t * 5);
      for (let k = 0; k < nc; k++) {
        if (G.hash(k, tick, 51) < 0.35) continue;
        const a = G.hash(k, 52, 1) * TAU + Math.sin(t + k) * 0.1;
        const fx = cx + R(Math.cos(a) * (wRx - 7)), fy = wCy + R(Math.sin(a) * (wRy - 2));
        ell(ctx, fx, fy, 2 + (G.hash(k, tick, 53) < 0.5 ? 1 : 0), 1, 'water1');
      }
    }
    // --- bubbles: seeded positions, each on its own life cycle (rise -> dome -> pop)
    const nb = R(boiling * 26);
    for (let i = 0; i < nb; i++) {
      const ang = G.hash(i, 61, 2) * TAU, rad = Math.sqrt(G.hash(i, 62, 2)) * 0.9;
      const period = 0.5 + 0.8 * G.hash(i, 63, 2);
      const age = (t / period + G.hash(i, 64, 2)) % 1;
      const p = toPx(Math.cos(ang) * rad * 0.97, Math.sin(ang) * rad * 0.97);
      if (age < 0.45) {
        G.px(ctx, p[0], p[1], 'water1');
      } else if (age < 0.8) {
        ell(ctx, p[0], p[1], 2, 1, 'water1');
        G.px(ctx, p[0], p[1], 'water2');
        G.px(ctx, p[0] - 1, p[1] - 1, 'water1');
      } else {
        // pop: 4 flecks
        G.px(ctx, p[0] - 2, p[1], 'water1'); G.px(ctx, p[0] + 2, p[1], 'water1');
        G.px(ctx, p[0], p[1] - 1, 'water1'); G.px(ctx, p[0], p[1] + 1, 'water1');
      }
    }
  }

  // ------------------------------------------------------------------ steam
  P.drawSteam = function (ctx, cx, baseY, t, opts) {
    opts = opts || {};
    cx |= 0; baseY |= 0; t = t || 0;
    const intensity = G.clamp(opts.intensity == null ? 1 : opts.intensity, 0, 1);
    if (intensity <= 0.01) return;
    const width = opts.width == null ? 60 : opts.width, height = opts.height == null ? 80 : opts.height;
    const seed = opts.seed == null ? 1 : opts.seed | 0, period = opts.period || 2.6;
    const n = Math.max(2, R(6 + intensity * 10));
    // all puffs share one dither phase so overlapping puffs merge into one soft texture instead of going solid
    for (let i = 0; i < n; i++) {
      const ph = G.hash(i, seed, 71);
      const age = ((t / period) + ph) % 1;                 // 0 at the base -> 1 at the top (loops)
      if (age > 0.92) continue;
      const e = G.easeOut(age);
      const yy = baseY - R(e * height);
      const spread = (G.hash(i, seed, 72) - 0.5) * width;
      const sway = Math.sin(t * 0.8 + ph * TAU + i * 1.7) * (2 + age * 4);
      const xx = cx + R(spread * (0.15 + 0.85 * age) + sway);
      const r = 3 + R(age * (6 + 3 * intensity));
      const dens = age < 0.55 ? 0.5 : 0.25;                // young puffs 50%, old ones thin out to 25%
      G.ditherCircle(ctx, xx, yy, r, 'steam', dens, 0);
      // a second, trailing lobe so the puff is not a perfect disc
      G.ditherCircle(ctx, xx + (G.hash(i, seed, 73) < 0.5 ? -1 : 1) * (r >> 1), yy + (r >> 1), Math.max(1, r - 2), 'steam', dens, 0);
    }
  };

  // ------------------------------------------------------------------ counter close-up
  P.drawCounterCloseup = function (ctx, opts) {
    opts = opts || {};
    const x = opts.x == null ? 0 : opts.x | 0, y = opts.y == null ? 104 : opts.y | 0;
    const w = opts.w == null ? PSA.W - x : opts.w | 0, h = opts.h == null ? PSA.H - y : opts.h | 0;
    const edge = opts.edge == null ? 0 : opts.edge | 0;
    G.rect(ctx, x, y, w, h, 'counter1');
    // speckle (fine stone-like texture, deterministic)
    for (let j = 0; j < h - edge; j++) for (let i = 0; i < w; i++) {
      const hsh = G.hash(x + i, y + j, 81);
      if (hsh < 0.035) G.px(ctx, x + i, y + j, 'counter2');
      else if (hsh > 0.985) G.px(ctx, x + i, y + j, 'plate1');
    }
    // shadow line where the counter meets the backsplash
    G.hline(ctx, x, y, w, 'counter2');
    G.dither(ctx, x, y + 1, w, 1, 'counter2', 0.5, 0);
    // optional front edge (rounded nose: highlight, face, dark underside)
    if (edge > 0) {
      const ey = y + h - edge;
      G.hline(ctx, x, ey, w, 'plate1');
      G.rect(ctx, x, ey + 1, w, edge - 2, 'counter2');
      G.hline(ctx, x, y + h - 1, w, 'plate3');
    }
  };

  // ------------------------------------------------------------------ sauce ladle
  P.drawSauceLadle = function (ctx, x, y, opts) {
    opts = opts || {};
    x |= 0; y |= 0;
    const pour = G.clamp(opts.pour == null ? 0 : opts.pour, 0, 1), t = opts.t || 0;
    const streamLen = opts.streamLen == null ? 44 : opts.streamLen | 0;
    const BRX = 18, BRY = 13;                                // bowl ellipse (lower half visible)
    // bowl in a scratch canvas, then column-sheared to tilt it (left lip down, right lip up)
    const SW = BRX * 2 + 4, SH = BRY + 10;
    const c = getScratch('ladle', SW, SH), s = c.getContext('2d');
    const bx = SW >> 1, byy = 7;                             // bowl centre inside the scratch
    // bowl body: lower half of an ellipse (shaded steel) with a gap-free outline
    ell(s, bx, byy, BRX, BRY, 'fork2');
    ell(s, bx - 2, byy - 2, BRX - 3, BRY - 3, 'fork1');
    ell(s, bx + 1, byy - 1, BRX - 5, BRY - 5, 'fork2');
    ell(s, bx + 4, byy + 2, BRX - 6, BRY - 5, 'fork3');
    ell(s, bx + 2, byy + 1, BRX - 9, BRY - 7, 'fork2');
    ellipseOutline(s, bx, byy, BRX, BRY, 'ink', 'bottom');
    // cut away the top half (above the opening)
    s.clearRect(0, 0, SW, byy - 4);
    // opening: ellipse with sauce inside; the sauce surface slides toward the pouring lip
    ell(s, bx, byy - 4, BRX, 4, 'fork1');                   // the rim seen from slightly above
    ell(s, bx, byy - 3, BRX - 2, 3, 'sauce3');
    ell(s, bx - R(pour * 2), byy - 3, BRX - 3, 2, 'sauce2');
    G.hline(s, bx - 6 - R(pour * 3), byy - 4, 7, 'sauce1');   // glossy highlight sliding toward the pouring lip
    ellipseOutline(s, bx, byy - 4, BRX, 4, 'ink');
    // shear: column i shifted by tilt*(i - centre)
    const k = pour * 0.42;
    const dx = x - bx, dy = y - byy;
    blitShear(ctx, c, dx, dy, 'col', (i) => R(-k * (i - bx)));
    // handle: from the right lip, rising with pour (the hand lifts the handle to tip the bowl)
    const ang = Math.PI * (0.27 + 0.2 * pour);              // from the horizontal, going up-right
    const hx0 = x + BRX - 2, hy0 = y - 5 - R(k * (BRX - 2));
    const len = 52;
    const hx1 = R(hx0 + Math.cos(ang) * len), hy1 = R(hy0 - Math.sin(ang) * len);
    thickLine(ctx, hx0, hy0, hx1, hy1, 5, 'ink');
    thickLine(ctx, hx0, hy0, hx1, hy1, 3, 'fork2');
    if (Math.abs(hx1 - hx0) >= Math.abs(hy1 - hy0)) G.line(ctx, hx0, hy0 - 1, hx1, hy1 - 1, 'fork1'); else G.line(ctx, hx0 - 1, hy0, hx1 - 1, hy1, 'fork1');
    // handle end: a small flat hook
    G.rect(ctx, hx1 - 3, hy1 - 3, 6, 4, 'ink');
    G.rect(ctx, hx1 - 2, hy1 - 2, 4, 2, 'fork2');
    G.px(ctx, hx1 - 2, hy1 - 2, 'fork1');
    // sauce stream from the left lip
    const lipX = x - BRX + 1, lipY = y - 4 + R(k * (BRX - 1));
    if (pour > 0.12) {
      const flow = G.span(pour, 0.12, 0.55);                 // 0 = drips, 1 = full stream
      const sw = flow < 0.5 ? 2 : 3;
      const sl = R(streamLen * G.span(pour, 0.12, 0.4));
      if (sl > 2) {
        for (let j = 0; j < sl; j++) {
          const wig = (j > 10 && (((j + Math.floor(t * 14)) >> 4) & 1)) ? 1 : 0;
          G.rect(ctx, lipX - 1 + wig, lipY + j, sw, 1, 'sauce2');
          G.px(ctx, lipX - 1 + wig, lipY + j, 'sauce1');
          if (sw === 3) G.px(ctx, lipX + 1 + wig, lipY + j, 'sauce3');
        }
        // splash flecks at the bottom of the stream
        const tick = Math.floor(t * 10);
        for (let k2 = 0; k2 < 3; k2++) {
          if (G.hash(k2, tick, 91) < 0.4) continue;
          const sx2 = lipX - 3 + Math.floor(G.hash(k2, tick, 92) * 7), sy2 = lipY + sl - 1 - Math.floor(G.hash(k2, tick, 93) * 3);
          G.px(ctx, sx2, sy2, 'sauce1');
        }
      }
      // falling drops beside/under the stream
      const nd = flow < 0.5 ? 2 : 1;
      for (let d = 0; d < nd; d++) {
        const dy2 = Math.floor(((t * 70) + G.hash(d, 94, 1) * streamLen) % Math.max(8, streamLen));
        G.rect(ctx, lipX - 1 + d * 2, lipY + dy2, 2, 2, 'sauce2');
        G.px(ctx, lipX - 1 + d * 2, lipY + dy2, 'sauce1');
      }
    }
    // a drip hanging from the lip when barely tilted
    if (pour > 0.04 && pour <= 0.12) G.rect(ctx, lipX - 1, lipY + 1, 2, 2, 'sauce2');
  };
})(window.PSA);
