// src/assets/portrait.js — LARGE close-up portrait of the girl (head + shoulders) and a calm backdrop for the portrait shot.
//
//   PSA.portrait.W = 96, PSA.portrait.H = 110
//   PSA.portrait.draw(ctx, cx, topY, opts)
//     cx, topY     : horizontal centre of the head and the y of the top of the hair (native px)
//     opts.expr    : 'smile' (default) | 'content' | 'neutral' | 'look' | 'sniff' | 'unsure' | 'worried'
//     opts.frame   : animation frame ('sniff' has 2 frames: 0 / 1 — she leans 1 / 2 px, nostrils flare, sniff lines move)
//     opts.blink   : true -> eyes closed for a blink frame (any expression)
//     opts.lookDown: true -> pupils look down toward the bottom of the frame (the plate). 'look' and 'sniff' imply it.
//     opts.lean    : optional extra vertical offset in px (integer) for custom motion
//   PSA.portrait.drawBackdrop(ctx, { sky, phase, lampOn })
//     fills the whole canvas: cream wall with a quiet wallpaper motif, the left edge of the window (frame, sill, sky
//     bands for 'sunset'|'dusk'|'night'(moon+stars)|'morning') and the curtain on the far right. lampOn adds a soft
//     dithered warm glow on the upper-left of the wall. Nothing moves; the engine applies the time-of-day tint on top.
//
// Design (same character as the sprite, see docs/STYLE.md §3): frontal view, chestnut chin-length bob with a side fringe
// swept to screen-right, teal clip on screen-left, mustard sweater with a ribbed rounded collar. Skin / skinShade,
// 1px 'ink' outlines. The sweater continues down to the bottom of the canvas so the bust never looks cut off.
// The base drawing (hair, face, neck, sweater) is identical for all expressions and rasterised once into an offscreen
// canvas; only the features (brows, eyes, nose, mouth, sniff lines) change. Everything is deterministic.
//
// Local coordinates: bx = 50 + x (0..99), by = y (0..219); the portrait is drawn with its local origin at (cx-50, topY).
(function (PSA) {
  const G = PSA.gfx;
  const P = {};
  P.W = 96;
  P.H = 110;

  // --- local colours (the palette has no iris tones; warm brown to go with the chestnut hair) ---
  const IRIS_BASE = '#7a5433';
  const IRIS_HI = '#b08457';

  const BW = 100, BH = 220;        // base canvas size (the sweater runs to the bottom)
  const OX = 50;                   // local x of the head centre

  // ------------------------------------------------------------------ geometry of the base drawing
  // fringe bottom edge (local y) per local x: a side fringe swept from the clip (screen-left, high) to the right (low),
  // with three shallow pointed strands.
  function fringeEdge(bx) {
    const x = bx - OX;                       // -50..49
    let y;
    if (x < -22) y = 24;
    else if (x <= 20) { const u = (x + 22) / 42; y = 24 + 14 * u * u; }    // 24 -> 38 (curved, steeper to the right)
    else y = 38 + (x - 20) * 2;              // sweeps down along the right side of the face
    // strands: small sawtooth notches on the edge
    const s = ((x + 50) % 9);
    if (s === 4 || s === 5) y += 1;
    if (s === 6) y += 2;
    return y | 0;
  }
  function inEll(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1.0;
  }
  // silhouettes (as predicates on local pixel coords)
  const inCap = (x, y) => inEll(x, y, 50, 37, 33, 36);
  // the bob's sides hang to just below the chin and tuck inward under the jaw (no gap between hair and face)
  const inSideHair = (x, y) => (y >= 37 && y <= 78 && ((x >= 17 && x <= 40) || (x >= 60 && x <= 83))) ||
                               inEll(x, y, 29, 78, 13, 6) || inEll(x, y, 71, 78, 13, 6);
  const inBackHair = (x, y) => inCap(x, y) || inSideHair(x, y);
  const inFace = (x, y) => inEll(x, y, 50, 44, 26, 27) || inEll(x, y, 50, 57, 22, 21);
  const inNeck = (x, y) => x >= 41 && x <= 59 && y >= 66 && y <= 97;
  const inShoulders = (x, y) => inEll(x, y, 50, 112, 48, 22) || (y >= 112 && x >= 4 && x <= 96);
  const inCollarOuter = (x, y) => inEll(x, y, 50, 92, 14, 8);
  const inCollarHole = (x, y) => inEll(x, y, 50, 90, 9, 4) || (x >= 41 && x <= 59 && y < 90);
  const inBody = (x, y) => (inShoulders(x, y) || inCollarOuter(x, y)) && !inCollarHole(x, y);
  const inFringe = (x, y) => inCap(x, y) && y <= fringeEdge(x);

  // ------------------------------------------------------------------ layer helper
  // A layer is an offscreen canvas painted per pixel by colorFn(x,y) -> palette key | css | null, then the pixels of
  // its silhouette that touch transparency get the 1px 'ink' outline (inset, so sizes stay exact). Out-of-canvas
  // below counts as opaque so the sweater has no outline where it is cut by the frame edge.
  function makeLayer(colorFn) {
    const cv = G.makeCanvas(BW, BH);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(BW, BH);
    const d = img.data;
    const mask = new Uint8Array(BW * BH);
    const rgbCache = {};
    const rgb = (c) => rgbCache[c] || (rgbCache[c] = G.hexToRgb(c));
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const c = colorFn(x, y);
      if (!c) continue;
      const k = y * BW + x; mask[k] = 1;
      const v = rgb(c); d[k * 4] = v[0]; d[k * 4 + 1] = v[1]; d[k * 4 + 2] = v[2]; d[k * 4 + 3] = 255;
    }
    const op = (x, y) => (y >= BH) ? 1 : (x < 0 || y < 0 || x >= BW) ? 0 : mask[y * BW + x];
    const ink = rgb(G.col('ink'));
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const k = y * BW + x;
      if (!mask[k]) continue;
      if (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1)) {
        d[k * 4] = ink[0]; d[k * 4 + 1] = ink[1]; d[k * 4 + 2] = ink[2];
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv: cv, mask: mask, has: (x, y) => (x >= 0 && y >= 0 && x < BW && y < BH) ? !!mask[y * BW + x] : false };
  }

  // ------------------------------------------------------------------ base drawing (built once)
  let base = null;
  function buildBase() {
    const cv = G.makeCanvas(BW, BH);
    const ctx = cv.getContext('2d');

    // 1) back hair: chestnut bob. highlight (upper-left crescent of the cap), shade on the lower part and the right side.
    const backHair = makeLayer((x, y) => {
      if (!inBackHair(x, y)) return null;
      if (inCap(x, y) && !inEll(x, y, 54, 42, 33, 36) && y < 34) return 'hair1';
      if (y >= 72 + Math.abs(x - 50) / 6 || (x >= 78 && y > 30)) return 'hair3';   // jaw shadow curves with the bob
      if (inSideHair(x, y) && !inCap(x, y) && x > 50) return 'hair3';
      return 'hair2';
    });
    // 2) neck: skin, shaded under the chin and on the right
    const neck = makeLayer((x, y) => {
      if (!inNeck(x, y)) return null;
      if (y < 82 || x >= 56) return 'skinShade';
      return 'skin';
    });
    // 3) body: mustard sweater with ribbed rounded collar; highlight on the left shoulder, shade on the right
    const body = makeLayer((x, y) => {
      if (!inBody(x, y)) return null;
      const rib = (((x - 50) % 3) + 3) % 3 === 0;
      if (inCollarOuter(x, y) && !inShoulderInner(x, y)) return rib ? 'sweater3' : (y < 92 && x < 50 ? 'sweater1' : 'sweater2');
      if (inCollarOuter(x, y)) return rib ? 'sweater3' : 'sweater2';
      if (inEll(x, y, 50, 95, 17, 10)) return 'sweater3';                                   // shadow under the collar
      if (y < 112 && x < 50 && !inEll(x, y, 53, 116, 48, 22)) return 'sweater1';            // lit upper-left shoulder slope
      if (y < 112 && x > 50 && !inEll(x, y, 47, 109, 48, 22)) return 'sweater3';            // shaded upper-right slope
      if (x >= 90) return 'sweater3';                                                        // right side in shade
      if (x <= 8 && y >= 112) return 'sweater1';                                             // left edge catches light
      if ((x === 16 || x === 84) && y >= 118) return 'sweater3';                             // sleeve seams
      return 'sweater2';
    });
    function inShoulderInner(x, y) { return inEll(x, y, 50, 112, 46, 20); }
    // 4) face: skin with a shade crescent along the right side and under the chin
    const face = makeLayer((x, y) => {
      if (!inFace(x, y)) return null;
      const lit = inEll(x, y, 47, 42, 26, 27) || inEll(x, y, 47, 55, 22, 21);
      return lit ? 'skin' : 'skinShade';
    });
    // 5) fringe: swept to the right; highlight on the upper-left, shade band above its bottom edge, strand lines
    const fringe = makeLayer((x, y) => {
      if (!inFringe(x, y)) return null;
      const e = fringeEdge(x);
      if (y >= e - 2) return 'hair3';
      if (!inEll(x, y, 54, 42, 33, 36) && y < 30 && x < 62) return 'hair1';
      // two strand separation lines running with the sweep
      const sx = x - 50, sy = y;
      if (sx > -14 && sx < 12 && (sy === (20 + ((sx + 14) * 0.45 | 0)) || sy === (12 + ((sx + 4) * 0.5 | 0)) && sx > -4)) return 'hair3';
      return 'hair2';
    });

    ctx.drawImage(backHair.cv, 0, 0);
    ctx.drawImage(neck.cv, 0, 0);
    ctx.drawImage(body.cv, 0, 0);
    ctx.drawImage(face.cv, 0, 0);
    // shade band on the forehead just below the fringe edge (the fringe's shadow), only on face pixels
    for (let x = 0; x < BW; x++) {
      const e = fringeEdge(x);
      for (let y = e + 1; y <= e + 2; y++) if (face.has(x, y) && fringe.has(x, e)) G.px(ctx, x, y, 'skinShade');
    }
    ctx.drawImage(fringe.cv, 0, 0);
    // teal hair clip on screen-left, pinning the hair back at the temple
    PSA.sprite.draw(ctx, CLIP, 22, 22);
    return cv;
  }

  // ------------------------------------------------------------------ small sprite maps
  const CLIP = PSA.sprite.make([
    '...ooo.',
    '..ohco.',
    '.ohcco.',
    '.occo..',
    'occo...',
    'oco....',
    'oo.....'
  ], { o: 'ink', c: 'clip', h: 'tile1' });

  const MOUTH = {
    smile: PSA.sprite.make([
      'm.......m',
      '.m.....m.',
      '..mmmmm..'
    ], { m: 'mouth' }),
    content: PSA.sprite.make([
      'm.........m',
      '.m.......m.',
      '..m.....m..',
      '...mmmmm...'
    ], { m: 'mouth' }),
    neutral: PSA.sprite.make([
      'mmmmm'
    ], { m: 'mouth' }),
    small: PSA.sprite.make([
      'mmm'
    ], { m: 'mouth' }),
    unsure: PSA.sprite.make([
      '.mm...mm...',
      'm..m.m..m.m',
      '.........m.'
    ], { m: 'mouth' }),
    worried: PSA.sprite.make([
      '.mm...mm.',
      'm..m.m..m',
      '....m....'
    ], { m: 'mouth' })
  };

  // ------------------------------------------------------------------ features
  // eyebrow: polyline outer -> mid -> inner (screen-left brow; mirrored for the right). ys relative to the brow base.
  function drawBrow(ctx, ox, oy, side, ys, thick) {
    // side -1 = screen-left brow (outer at the left), +1 = screen-right brow
    const xo = ox + side * -17, xm = ox + side * -11, xi = ox + side * -5;    // outer / mid / inner x
    const yb = oy + 39;
    for (let t = 0; t < (thick || 2); t++) {
      G.line(ctx, xo, yb + ys[0] + t, xm, yb + ys[1] + t, 'hair3');
      G.line(ctx, xm, yb + ys[1] + t, xi, yb + ys[2] + t, 'hair3');
    }
  }

  // eye centred at (ex, ey): 11x9 almond, ink upper lid + lashes, skinShade lower lid, 3-tone iris clipped to the sclera.
  //   state: 'open' | 'blink' | 'happy';  lid: 0..3 px the upper lid is lowered;  px,py: pupil offset
  function drawEye(ctx, ex, ey, side, state, lid, px, py) {
    if (state === 'happy') {            // closed, content: ∩ arc
      G.line(ctx, ex - 5, ey + 1, ex - 3, ey - 2, 'ink');
      G.line(ctx, ex - 3, ey - 2, ex + 3, ey - 2, 'ink');
      G.line(ctx, ex + 3, ey - 2, ex + 5, ey + 1, 'ink');
      G.hline(ctx, ex - 2, ey - 3, 5, 'ink');
      return;
    }
    if (state === 'blink') {            // closed, relaxed: slight ∪ line with a lash at the outer corner
      G.hline(ctx, ex - 4, ey + 1, 9, 'ink');
      G.px(ctx, ex - 5, ey, 'ink'); G.px(ctx, ex + 5, ey, 'ink');
      G.px(ctx, ex + side * 6, ey - 1, 'ink');
      G.hline(ctx, ex - 3, ey + 2, 7, 'skinShade');
      return;
    }
    lid = lid | 0;
    const rx = 5, ry = 4;
    const topRow = ey - ry + lid;
    const icx = ex + px, icy = ey + 1 + py;      // iris centre (resting slightly low under the lid)
    for (let y = -ry; y <= ry; y++) {
      const f = 1 - (y * y) / (ry * ry + 0.0001);
      const hw = Math.floor(Math.sqrt(Math.max(f, 0)) * rx + 0.5);
      const Y = ey + y;
      if (Y < topRow) continue;
      for (let x = -hw; x <= hw; x++) {
        const X = ex + x;
        let c = 'eyeWhite';
        const edgeX = Math.abs(x) === hw;
        const isTop = Y === topRow;
        const isBottom = y === ry;
        if (isTop || (edgeX && y <= 0)) c = 'ink';
        else if (isBottom || (edgeX && y > 0)) c = 'skinShade';
        else {
          const dx = X - icx, dy = Y - icy, d2 = dx * dx + dy * dy;
          if (d2 <= 2.3) c = 'eye';
          else if (d2 <= 10.5) c = (dx + dy > 1) ? IRIS_HI : IRIS_BASE;
          if (dx === -1 && dy === -1) c = 'eyeWhite';          // catch-light upper-left
          if (dx === 1 && dy === 1 && d2 <= 10.5) c = IRIS_HI;
        }
        G.px(ctx, X, Y, c);
      }
    }
    // thicker lid at the centre + a lash at the outer corner
    G.hline(ctx, ex - 3, topRow + 1, 7, 'ink');
    G.px(ctx, ex + side * 6, topRow + 1, 'ink');
    G.px(ctx, ex + side * 6, topRow, 'ink');
  }

  // nose: bridge shade line on the right (light from the upper-left), small underside; flare = nostrils flared (sniff)
  function drawNose(ctx, ox, oy, flare) {
    G.vline(ctx, ox + 2, oy + 54, 7, 'skinShade');
    G.hline(ctx, ox - 2, oy + 61, 5, 'skinShade');
    G.px(ctx, ox - 2, oy + 60, 'skinShade');
    G.px(ctx, ox - 1, oy + 61, 'cheek'); G.px(ctx, ox + 2, oy + 61, 'cheek');
    if (flare) { G.px(ctx, ox - 3, oy + 61, 'skinShade'); G.px(ctx, ox + 3, oy + 61, 'skinShade'); G.px(ctx, ox - 2, oy + 62, 'cheek'); G.px(ctx, ox + 2, oy + 62, 'cheek'); }
  }
  function drawCheeks(ctx, ox, oy, strong) {
    G.hline(ctx, ox - 20, oy + 58, 4, 'cheek'); G.hline(ctx, ox - 21, oy + 59, 5, 'cheek');
    G.hline(ctx, ox + 17, oy + 58, 4, 'cheek'); G.hline(ctx, ox + 17, oy + 59, 5, 'cheek');
    if (strong) { G.hline(ctx, ox - 20, oy + 60, 3, 'cheek'); G.hline(ctx, ox + 18, oy + 60, 3, 'cheek'); }
  }
  // tiny air-stream lines beside the nostrils for the sniff frames
  function drawSniffLines(ctx, ox, oy, frame) {
    // tiny air-puff ticks just outside each nostril (2 px), rising 1 px between the two frames
    // classic pixel-art air dashes, clear of the face (so they do not read as wrinkles); frame 1 = moved 1 px up/outward
    const k = frame ? 1 : 0;
    for (const sgn of [-1, 1]) {
      const dx = (8 + k) * sgn;
      G.px(ctx, ox + dx, oy + 59 - k, 'hair3'); G.px(ctx, ox + dx + sgn, oy + 58 - k, 'hair3');
      G.px(ctx, ox + dx + 2 * sgn, oy + 62 - k, 'hair3'); G.px(ctx, ox + dx + 3 * sgn, oy + 61 - k, 'hair3');
    }
  }
  function drawMouth(ctx, ox, oy, def, dy) {
    const w = PSA.sprite.width(def);
    PSA.sprite.draw(ctx, def, ox - (w >> 1), oy + 67 + (dy | 0));
  }

  // expression table: brows [outer, mid, inner] per side, eye state/lid, pupils, mouth
  const EXPR = {
    smile:   { browL: [2, 0, 0], browR: [2, 0, 0], lid: 0, mouth: 'smile',   cheeks: true },
    content: { browL: [1, -1, -1], browR: [1, -1, -1], eyes: 'happy', mouth: 'content', cheeks: true, strong: true },
    neutral: { browL: [2, 0, 0], browR: [2, 0, 0], lid: 0, mouth: 'neutral', cheeks: true },
    look:    { browL: [2, 0, 0], browR: [2, 0, 0], lid: 1, mouth: 'small',  cheeks: true, lookDown: true },   // half-lidded calm glance down
    sniff:   { browL: [2, -1, 0], browR: [2, -1, 0], lid: 1, mouth: 'small', cheeks: true, lookDown: true, sniff: true },
    unsure:  { browL: [1, -2, -2], browR: [2, 1, 2], lid: 1, mouth: 'unsure', cheeks: true, mouthDy: 1 },
    worried: { browL: [3, 1, -1], browR: [3, 1, -1], lid: 2, mouth: 'worried', cheeks: true, mouthDy: 1, pupilDown: 1 }
  };

  // ------------------------------------------------------------------ public: draw
  P.draw = function (ctx, cx, topY, opts) {
    opts = opts || {};
    const e = EXPR[opts.expr] || EXPR.smile;
    const frame = (opts.frame | 0);
    let lean = (opts.lean | 0);
    if (e.sniff) lean += (frame & 1) ? 2 : 1;
    cx |= 0; topY |= 0;
    const ox = cx, oy = topY + lean;
    if (!base) base = buildBase();
    ctx.drawImage(base, cx - OX, oy);

    // brows
    drawBrow(ctx, ox, oy, -1, e.browL, 2);
    drawBrow(ctx, ox, oy, +1, e.browR, 2);
    // eyes
    const lookDown = !!opts.lookDown || !!e.lookDown;
    const py = (lookDown ? 2 : 0) + (e.pupilDown | 0);
    const px = 0;
    let state = e.eyes || 'open';
    if (opts.blink) state = 'blink';
    drawEye(ctx, ox - 12, oy + 48, -1, state, e.lid | 0, px, py);
    drawEye(ctx, ox + 12, oy + 48, +1, state, e.lid | 0, px, py);
    // nose, cheeks, mouth
    drawNose(ctx, ox, oy, e.sniff && (frame & 1) === 0);
    if (e.cheeks) drawCheeks(ctx, ox, oy, e.strong);
    if (e.sniff) drawSniffLines(ctx, ox, oy, frame & 1);
    drawMouth(ctx, ox, oy, MOUTH[e.mouth], e.mouthDy);
  };

  // ------------------------------------------------------------------ public: backdrop
  // Close-up of the kitchen wall behind the table: cream wall with a quiet motif, the left edge of the window with its
  // sill and sky, and the curtain hanging on the far right. Sized to the canvas (384x216 normally).
  const SKY = {
    sunset:  ['skySunset1', 'skySunset2', 'skySunset3'],
    dusk:    ['skyDusk1', 'skyDusk2', 'skyDusk3'],
    night:   ['skyNight1', 'skyNight2', 'skyNight3'],
    morning: ['skyMorn1', 'skyMorn2', 'skyMorn3']
  };
  P.drawBackdrop = function (ctx, env) {
    env = env || {};
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const sky = SKY[env.sky] || SKY.morning;
    const phase = G.clamp(env.phase == null ? 0 : env.phase, 0, 1);

    // wall
    G.rect(ctx, 0, 0, W, H, 'wall');
    // quiet wallpaper motif: small 3px crosses on a staggered 24px grid
    for (let j = -1; j * 24 < H + 24; j++) {
      for (let i = -1; i * 24 < W + 24; i++) {
        const x = i * 24 + ((j & 1) ? 12 : 0) + 6, y = j * 24 + 10;
        G.hline(ctx, x - 1, y, 3, 'wallShade'); G.px(ctx, x, y - 1, 'wallShade'); G.px(ctx, x, y + 1, 'wallShade');
      }
    }
    // soft shadow band at the very top (ceiling side); plain wall below (like the room: no chair rail)
    G.hline(ctx, 0, 0, W, 'wallShade');
    const railY = H - 30;

    // lamp glow (the pendant lamp hangs above the table, i.e. above her head, out of frame)
    if (env.lampOn) G.ditherCircle(ctx, W >> 1, -70, 120, 'lampLight', 0.25, 0);

    // window: left frame edge, sky, mullion, sill
    const wx = 296, sillY = railY - 14;
    const skyX = wx + 8, skyW = W - skyX;
    // sky bands (3 tones, soft dithered transitions). phase pushes the bands down a little as the day moves on.
    const b1 = Math.round(sillY * (0.30 + 0.10 * phase)), b2 = Math.round(sillY * (0.62 + 0.10 * phase));
    G.rect(ctx, skyX, 0, skyW, b1, sky[0]);
    G.rect(ctx, skyX, b1, skyW, b2 - b1, sky[1]);
    G.rect(ctx, skyX, b2, skyW, sillY - b2, sky[2]);
    G.dither(ctx, skyX, b1 - 6, skyW, 6, sky[1], 0.5, 0);
    G.dither(ctx, skyX, b1, skyW, 6, sky[0], 0.5, 1);
    G.dither(ctx, skyX, b2 - 6, skyW, 6, sky[2], 0.5, 0);
    G.dither(ctx, skyX, b2, skyW, 6, sky[1], 0.5, 1);
    if (env.sky === 'night') {
      G.circle(ctx, skyX + 24, 34, 8, 'moon');
      G.circle(ctx, skyX + 28, 31, 7, sky[0]);          // crescent
      for (let i = 0; i < 9; i++) {
        const sx = skyX + 4 + ((G.hash(i, 7, 1) * (skyW - 8)) | 0), sy = 4 + ((G.hash(i, 3, 2) * (b2 - 10)) | 0);
        G.px(ctx, sx, sy, 'star');
      }
    } else if (env.sky === 'sunset') {
      // low sun glow near the bottom band
      G.dither(ctx, skyX, b2 - 14, skyW, 10, 'skySunset1', 0.25, 0);
    }
    // mullion bar (horizontal) and the window frame's vertical edge
    const mulY = Math.round(sillY * 0.5);
    G.rect(ctx, skyX, mulY - 3, skyW, 6, 'frame1'); G.hline(ctx, skyX, mulY + 2, skyW, 'frame2'); G.hline(ctx, skyX, mulY - 3, skyW, 'frame2');
    G.rect(ctx, wx, 0, 8, sillY, 'frame1');
    G.vline(ctx, wx, 0, sillY, 'frame2'); G.vline(ctx, wx + 7, 0, sillY, 'frame2');
    G.vline(ctx, wx + 1, 0, sillY, 'white');
    // sill
    G.rect(ctx, wx - 6, sillY, W - wx + 6, 7, 'frame1');
    G.hline(ctx, wx - 6, sillY, W - wx + 6, 'white');
    G.hline(ctx, wx - 6, sillY + 6, W - wx + 6, 'frame2');
    G.rect(ctx, wx - 6, sillY + 7, W - wx + 6, 3, 'wallLine');
    G.hline(ctx, wx - 6, sillY + 10, W - wx + 6, 'wallShade');

    // curtain on the WALL side of the frame, like the room's window: hung from a rod, tied back half-way, ending above the sill
    const cx0 = wx - 26, cw = 30, tieY = Math.round(sillY * 0.54);
    G.rect(ctx, cx0, 3, cw, sillY - 5, 'curtain1');
    for (let x = cx0 + 3; x < cx0 + cw; x += 7) G.vline(ctx, x, 3, sillY - 5, 'curtain2');      // folds
    G.vline(ctx, cx0, 3, sillY - 5, 'curtain2'); G.vline(ctx, cx0 + cw - 1, 3, sillY - 5, 'curtain2');
    G.rect(ctx, cx0, tieY - 2, 4, 9, 'wall'); G.rect(ctx, cx0 + cw - 4, tieY - 2, 4, 9, 'wall');  // pinch at the tie-back
    G.rect(ctx, cx0 + 4, tieY, cw - 8, 4, 'curtain2'); G.hline(ctx, cx0 + 5, tieY + 1, cw - 10, 'wood3');
    // curtain rod with rings, running over the window
    G.rect(ctx, cx0 - 6, 0, W - cx0 + 6, 2, 'wood2'); G.hline(ctx, cx0 - 6, 0, W - cx0 + 6, 'wood1');
    for (let x = cx0 + 2; x < cx0 + cw; x += 7) G.rect(ctx, x, 2, 2, 2, 'wood3');
  };

  PSA.portrait = P;
})(window.PSA);
