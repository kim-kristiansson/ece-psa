// ROOM — the kitchen + dining room at native scale (PSA.room).
//
// Self-contained: this module draws its OWN room-scale versions of the clock, window, fridge, lamp, plant, small pot,
// small plate, fork and steam (it never calls PSA.props / PSA.food). All positions come from PSA.LAYOUT (world
// coordinates, world width 448); the camera is applied inside each main entry with ctx.translate(-camX, 0).
//
// Main API (env = { t, sky:'sunset'|'dusk'|'night'|'morning', phase:0..1, lampOn, potOnStove, potBoiling:0..1,
//                   fridgeOpen:0..1, plateInFridge, plateOnTable:'full'|'half'|null, plateSteam:0..1, forkOnTable,
//                   lampLightPool }):
//   PSA.room.drawBack(ctx, camX, env)   wall, wallpaper, baseboard, floor, rug, shelf (+plant, jar), lamp (+pool), clock,
//                                       window, upper cabinets + hood, tiles, counter + stove + pot, fridge, chair back
//   PSA.room.drawTable(ctx, camX, env)  the table (top + front edge + legs), its share of the lamp pool, plate + fork on it
//   PSA.room.drawFront(ctx, camX, env)  foreground (nothing at the moment — kept for the contract)
//   PSA.room.lampPool(ctx, camX, env)   the dithered warm light pool on the rug/floor under the lamp (called by drawBack)
//
// Sub-drawers (world/any coordinates, reusable by scenes):
//   drawClock(ctx, cx, cy, r, h, m)                       round wall clock, hands from hours/minutes (PSA.story.clock)
//   drawWindow(ctx, x, y, w, h, {sky, phase, t})          frame + curtains + sill + sky bands (sun / moon + stars)
//   drawFridge(ctx, {open:0..1, light, plateInside, t})   at PSA.LAYOUT.fridge; door hinged on the right, 3 shelves inside
//   drawLamp(ctx, {on})                                   pendant lamp at PSA.LAYOUT.lamp (cord, shade, bulb glow)
//   drawPlant(ctx, x, y)                                  small potted plant, x = center, y = bottom of the pot
//   drawPotSmall(ctx, cx, bottomY, {boiling:0..1, t})     small steel pot (22x14) with foam + steam when boiling
//   drawPlateSmall(ctx, cx, cy, {amount:'full'|'half', steam:0..1, t})   the plate of pasta, room scale (~18x8)
//   drawForkSmall(ctx, x, y)                              fork resting on the table (top-left of its 9x4 box)
//   drawSteamSmall(ctx, cx, baseY, t, {intensity:0..1})   deterministic dithered steam puffs rising from baseY
//
// Only the window sky and the lamp change with the time of day; the engine tints the whole frame afterwards.
(function (PSA) {
  const G = PSA.gfx;
  const L = PSA.LAYOUT;
  const R = {};

  // ------------------------------------------------------------------ local helpers
  // Dithered filled ellipse (soft light pools). density 0.25 / 0.5 / 0.75, see G.dither.
  function ditherEllipse(ctx, cx, cy, rx, ry, c, density, phase) {
    ctx.fillStyle = G.col(c);
    density = density == null ? 0.5 : density; phase = phase | 0;
    cx |= 0; cy |= 0;
    for (let y = -ry; y <= ry; y++) {
      const f = 1 - (y * y) / (ry * ry + 0.0001);
      if (f < 0) continue;
      const hw = Math.floor(Math.sqrt(f) * rx + 0.5);
      for (let x = -hw; x <= hw; x++) {
        const X = cx + x, Y = cy + y;
        let on;
        if (density >= 0.75) on = ((X + Y + phase) & 1) === 0 || ((X & 1) === 0 && (Y & 1) === 0);
        else if (density >= 0.5) on = ((X + Y + phase) & 1) === 0;
        else on = ((X + 2 * Y + phase) & 3) === 0;
        if (on) ctx.fillRect(X, Y, 1, 1);
      }
    }
  }
  // Light pool: sparse halo + a small checker core, both dithered (never a solid fill) so the surface shows through.
  function lightPool(ctx, cx, cy, rx, ry, c) {
    if (PSA.FLAT) return;
    ditherEllipse(ctx, cx, cy, rx, ry, c, 0.25, 0);
    ditherEllipse(ctx, cx, cy, (rx * 0.5) | 0, (ry * 0.5) | 0, c, 0.5, 0);
  }
  // Rounded blob from per-row half-widths (top to bottom), centered at (cx, cy = row of index `mid`).
  // Fills with `fill` and traces a 1px outline in `outline` (pixels that stick out beyond the neighbouring rows).
  // This avoids the pointy single-pixel tips that G.ellipse produces at this small size.
  function blob(ctx, cx, cy, hws, mid, fill, outline) {
    for (let i = 0; i < hws.length; i++) {
      const y = cy + i - mid, hw = hws[i];
      G.hline(ctx, cx - hw, y, hw * 2 + 1, fill);
    }
    if (!outline) return;
    for (let i = 0; i < hws.length; i++) {
      const y = cy + i - mid, hw = hws[i];
      const nb = Math.min(i > 0 ? hws[i - 1] : -1, i < hws.length - 1 ? hws[i + 1] : -1);
      for (let x = nb + 1; x <= hw; x++) { G.px(ctx, cx - x, y, outline); G.px(ctx, cx + x, y, outline); }
    }
  }
  // Clip helper (integer rect). Used so a dithered pool stays on one surface (e.g. the table top).
  function withClip(ctx, x, y, w, h, fn) {
    ctx.save(); ctx.beginPath(); ctx.rect(x | 0, y | 0, w | 0, h | 0); ctx.clip(); fn(); ctx.restore();
  }
  const SKY = {
    sunset:  { top: 'skySunset3', mid: 'skySunset2', bot: 'skySunset1', hill: 'skyDusk2' },
    dusk:    { top: 'skyDusk3',   mid: 'skyDusk2',   bot: 'skyDusk1',   hill: 'skyNight2' },
    night:   { top: 'skyNight3',  mid: 'skyNight2',  bot: 'skyNight1',  hill: 'skyNight3' },
    morning: { top: 'skyMorn3',   mid: 'skyMorn2',   bot: 'skyMorn1',   hill: 'skyMorn3' }
  };

  // ================================================================== WALL CLOCK
  // Round clock, radius r (11 on the wall). Hands computed from h (0..23) and m (0..59, fractional ok).
  R.drawClock = function (ctx, cx, cy, r, h, m) {
    cx |= 0; cy |= 0; r |= 0;
    h = h == null ? 0 : h; m = m == null ? 0 : m;
    G.circle(ctx, cx + 1, cy + 1, r, 'wood4');          // soft drop shadow (down-right)
    G.circle(ctx, cx, cy, r, 'clockRim');
    G.circle(ctx, cx, cy, r - 2, 'clockFace');
    G.px(ctx, cx - r + 2, cy - 1, 'white'); G.px(ctx, cx - r + 3, cy - 2, 'white');   // glass glint (upper-left)
    // 12 / 3 / 6 / 9 marks
    const mr = r - 4;
    G.px(ctx, cx, cy - mr, 'clockHand'); G.px(ctx, cx + mr, cy, 'clockHand');
    G.px(ctx, cx, cy + mr, 'clockHand'); G.px(ctx, cx - mr, cy, 'clockHand');
    if (r >= 14) for (let i = 0; i < 12; i++) { // minor marks on bigger versions
      if (i % 3 === 0) continue;
      const a = i / 12 * Math.PI * 2;
      G.px(ctx, Math.round(cx + Math.sin(a) * mr), Math.round(cy - Math.cos(a) * mr), 'clockRim');
    }
    // hands
    const am = (m / 60) * Math.PI * 2;
    const ah = (((h % 12) + m / 60) / 12) * Math.PI * 2;
    const lm = r - 3, lh = Math.round(r * 0.55);
    // hour hand: short and 2px thick (drawn twice, offset perpendicular to its direction) so it reads at 1x
    const hx = Math.round(cx + Math.sin(ah) * lh), hy = Math.round(cy - Math.cos(ah) * lh);
    const ox = Math.abs(Math.sin(ah)) < 0.71 ? 1 : 0, oy = ox ? 0 : 1;
    G.line(ctx, cx, cy, hx, hy, 'clockHand');
    G.line(ctx, cx + ox, cy + oy, hx + ox, hy + oy, 'clockHand');
    // minute hand: long and thin
    G.line(ctx, cx, cy, Math.round(cx + Math.sin(am) * lm), Math.round(cy - Math.cos(am) * lm), 'clockHand');
    G.px(ctx, cx, cy, 'clockSec');
  };

  // ================================================================== WINDOW
  // Frame + glass (sky bands), mullion cross, curtains on a rod, sill. (x,y,w,h) = outer frame box.
  R.drawWindow = function (ctx, x, y, w, h, o) {
    o = o || {};
    x |= 0; y |= 0; w |= 0; h |= 0;
    const sky = SKY[o.sky] || SKY.sunset, phase = G.clamp(o.phase || 0, 0, 1), t = o.t || 0;
    const name = SKY[o.sky] ? o.sky : 'sunset';
    // frame
    G.rect(ctx, x, y, w, h, 'frame2');
    G.rect(ctx, x + 1, y + 1, w - 2, h - 2, 'frame1');
    const gx = x + 3, gy = y + 3, gw = w - 6, gh = h - 10;   // glass (leaves room for the bottom rail + sill)
    // --- sky bands (dithered boundaries)
    const bTop = Math.round(gh * (name === 'sunset' ? 0.28 + 0.22 * phase : 0.34));
    const bMid = Math.round(gh * (name === 'sunset' ? 0.62 + 0.18 * phase : 0.68));
    G.rect(ctx, gx, gy, gw, gh, sky.bot);
    G.rect(ctx, gx, gy, gw, bMid, sky.mid);
    G.rect(ctx, gx, gy, gw, bTop, sky.top);
    G.dither(ctx, gx, gy + bTop, gw, 2, sky.top, 0.5, 0);
    G.dither(ctx, gx, gy + bMid, gw, 2, sky.mid, 0.5, 0);
    // --- celestial bodies
    if (name === 'sunset') {
      const sy = gy + Math.round(gh * (0.50 + 0.38 * phase));
      const sx = gx + Math.round(gw * 0.36);
      G.circle(ctx, sx, sy, 4, 'skySunset1');
      G.circle(ctx, sx, sy, 3, 'flame1');
      G.hline(ctx, sx - 7, sy - 2, 15, 'skySunset1');     // horizontal glow streaks
      G.hline(ctx, sx - 9, sy + 2, 19, 'skySunset1');
    } else if (name === 'night' || (name === 'dusk' && phase > 0.45)) {
      const stars = [[0.18, 0.12], [0.62, 0.08], [0.82, 0.3], [0.4, 0.26], [0.72, 0.5]];
      const n = name === 'night' ? 5 : 2 + Math.round(phase);
      for (let i = 0; i < n; i++) {
        const sx = gx + Math.round(stars[i][0] * (gw - 1)), sy = gy + Math.round(stars[i][1] * (gh - 1));
        const blink = G.hash(i, Math.floor(t * 2), 7) < 0.15;        // occasional twinkle (dim frame)
        G.px(ctx, sx, sy, blink ? sky.mid : 'star');
      }
      if (name === 'night') {
        const mx = gx + Math.round(gw * 0.70), my = gy + Math.round(gh * 0.22);
        G.circle(ctx, mx, my, 4, 'moon');
        G.circle(ctx, mx - 3, my - 1, 4, sky.top);          // crescent cut-out
        G.px(ctx, mx + 2, my + 1, 'skyMorn1');
      }
    } else if (name === 'morning') {
      const cx1 = gx + Math.round(gw * 0.3), cy1 = gy + Math.round(gh * 0.3);
      G.ellipse(ctx, cx1, cy1, 6, 2, 'skyMorn1'); G.ellipse(ctx, cx1 + 3, cy1 - 2, 4, 2, 'skyMorn1');
      G.ellipse(ctx, gx + Math.round(gw * 0.78), gy + Math.round(gh * 0.5), 4, 1, 'skyMorn1');
    }
    // --- distant hills / treeline along the bottom of the glass
    for (let i = 0; i < gw; i++) {
      const u = i / gw;
      const hh = 3 + Math.round(2.4 * Math.sin(u * 7.3 + 1.1) + 1.6 * Math.sin(u * 15.1 + 0.4));
      G.vline(ctx, gx + i, gy + gh - hh, hh, sky.hill);
    }
    // --- mullion cross (+ its shadow) over the glass
    const mx = gx + (gw >> 1) - 1, my = gy + Math.round(gh * 0.48);
    G.rect(ctx, mx, gy, 2, gh, 'frame1'); G.rect(ctx, gx, my, gw, 2, 'frame1');
    G.vline(ctx, mx + 2, gy, gh, 'frame2'); G.hline(ctx, gx, my + 2, gw, 'frame2');
    // inner shadow line (depth) top/left of the glass
    G.hline(ctx, gx, gy, gw, 'frame2'); G.vline(ctx, gx, gy, gh, 'frame2');
    // --- bottom rail + sill (sticks out 2px each side)
    G.rect(ctx, x, y + h - 7, w, 3, 'frame1');
    G.rect(ctx, x - 2, y + h - 4, w + 4, 3, 'frame1');
    G.hline(ctx, x - 2, y + h - 1, w + 4, 'frame2');
    G.hline(ctx, x - 2, y + h - 4, w + 4, 'white');
    G.hline(ctx, x - 1, y + h, w + 2, 'wallShade');          // shadow under the sill
    // --- curtain rod + curtains (tied back at mid height)
    const ry = y - 2;
    G.hline(ctx, x - 7, ry, w + 14, 'wood2'); G.hline(ctx, x - 7, ry - 1, w + 14, 'wood1');
    G.rect(ctx, x - 8, ry - 2, 2, 4, 'wood3'); G.rect(ctx, x + w + 6, ry - 2, 2, 4, 'wood3');
    const cw = 9, ch = h - 4;
    const drawCurtain = function (cx0, flip) {
      for (let j = 0; j < ch; j++) {
        const yy = ry + 1 + j;
        const tie = j > ch * 0.52 && j < ch * 0.52 + 4;
        const pinch = j > ch * 0.52 ? Math.max(0, 3 - Math.round((j - ch * 0.52) / 5)) : 0;   // narrows at the tie, flares below
        const ww = cw - (tie ? 3 : pinch);
        const xs = flip ? cx0 + (cw - ww) : cx0;
        G.hline(ctx, xs, yy, ww, tie ? 'curtain2' : 'curtain1');
        if (!tie) for (let k = 1; k < ww; k += 3) G.px(ctx, xs + (flip ? ww - 1 - k : k), yy, 'curtain2');   // folds
        G.px(ctx, flip ? xs : xs + ww - 1, yy, tie ? 'wood3' : 'curtain2');                                // inner edge
      }
      // ring loops on the rod
      for (let k = 1; k < cw; k += 3) G.px(ctx, cx0 + k, ry - 1, 'wood3');
    };
    drawCurtain(x - 5, false);
    drawCurtain(x + w - cw + 5, true);
  };

  // ================================================================== PLANT / JAR / SHELF
  // Small potted plant: x = center, y = bottom of the pot. ~9 wide, ~14 tall.
  R.drawPlant = function (ctx, x, y) {
    x |= 0; y |= 0;
    // pot (clay) with ink outline
    G.rect(ctx, x - 3, y - 5, 7, 5, 'potClay1');
    G.rect(ctx, x - 4, y - 6, 9, 2, 'potClay1');
    G.vline(ctx, x + 2, y - 4, 4, 'potClay2'); G.hline(ctx, x - 3, y - 1, 6, 'potClay2');
    G.box(ctx, x - 4, y - 7, 9, 3, 'ink'); G.hline(ctx, x - 3, y, 7, 'ink');
    G.vline(ctx, x - 4, y - 5, 5, 'ink'); G.vline(ctx, x + 4, y - 5, 5, 'ink');
    G.rect(ctx, x - 3, y - 6, 7, 1, 'potClay1');
    // leaves: a small bushy cluster
    G.rect(ctx, x - 3, y - 11, 7, 4, 'leaf2');
    G.rect(ctx, x - 2, y - 13, 5, 2, 'leaf2');
    G.px(ctx, x - 4, y - 10, 'leaf2'); G.px(ctx, x + 4, y - 9, 'leaf2');
    G.px(ctx, x - 5, y - 12, 'leaf2'); G.px(ctx, x - 4, y - 12, 'leaf2');
    G.px(ctx, x + 4, y - 12, 'leaf2'); G.px(ctx, x + 5, y - 11, 'leaf2');
    G.px(ctx, x, y - 14, 'leaf2'); G.px(ctx, x - 1, y - 14, 'leaf2');
    // highlights (upper-left) and shade (lower-right)
    G.px(ctx, x - 2, y - 12, 'leaf1'); G.px(ctx, x - 3, y - 10, 'leaf1'); G.px(ctx, x - 1, y - 13, 'leaf1');
    G.px(ctx, x + 1, y - 11, 'leaf1'); G.px(ctx, x - 4, y - 12, 'leaf1');
    G.px(ctx, x + 2, y - 8, 'leaf3'); G.px(ctx, x + 3, y - 9, 'leaf3'); G.px(ctx, x + 1, y - 8, 'leaf3');
    G.px(ctx, x + 2, y - 10, 'leaf3'); G.px(ctx, x - 1, y - 8, 'leaf3');
  };
  // Glass jar of dry spaghetti (decor). x = center, y = bottom.
  function drawJar(ctx, x, y) {
    G.rect(ctx, x - 3, y - 9, 7, 9, 'fridgeIn2');
    G.rect(ctx, x - 2, y - 8, 5, 7, 'pastaDry1');
    G.vline(ctx, x - 1, y - 8, 7, 'pastaDry2'); G.vline(ctx, x + 1, y - 8, 7, 'pastaDry2');
    G.vline(ctx, x - 3, y - 9, 9, 'fridgeIn1');
    G.box(ctx, x - 4, y - 10, 9, 11, 'ink');
    G.rect(ctx, x - 3, y - 12, 7, 3, 'wood2'); G.hline(ctx, x - 3, y - 12, 7, 'wood1');
    G.box(ctx, x - 4, y - 13, 9, 4, 'ink');
  }
  // Wall shelf (plank + 2 brackets) at PSA.LAYOUT.shelf with the plant and the jar on it.
  function drawShelf(ctx) {
    const s = L.shelf;
    G.rect(ctx, s.x, s.y, s.w, 3, 'wood2');
    G.hline(ctx, s.x, s.y, s.w, 'wood1');
    G.hline(ctx, s.x, s.y + 2, s.w, 'wood3');
    G.hline(ctx, s.x, s.y + 3, s.w, 'wood4');
    G.hline(ctx, s.x + 1, s.y + 4, s.w, 'wallShade');      // shadow on the wall
    for (const bx of [s.x + 4, s.x + s.w - 7]) {           // brackets
      G.rect(ctx, bx, s.y + 3, 3, 3, 'wood3'); G.rect(ctx, bx, s.y + 6, 2, 2, 'wood4');
    }
    R.drawPlant(ctx, s.x + 22, s.y);                      // on the right part of the plank: fully visible at camX 32
    drawJar(ctx, s.x + 35, s.y);
  }

  // ================================================================== PENDANT LAMP
  // Cord from the ceiling, trapezoid shade, bulb underneath. on → bulb glows + halo inside the shade.
  R.drawLamp = function (ctx, o) {
    o = o || {};
    const l = L.lamp;
    const top = l.shadeY, bot = l.shadeY + l.shadeH, cx = l.cx;
    G.vline(ctx, cx, l.cordTop, top - l.cordTop, 'ink');
    G.rect(ctx, cx - 1, l.cordTop, 3, 2, 'metal3');            // ceiling rose
    // shade: widens from 12 px at the top to shadeW at the bottom
    for (let j = 0; j < l.shadeH; j++) {
      const hw = Math.round(6 + (l.shadeW / 2 - 6) * (j / (l.shadeH - 1)));
      G.hline(ctx, cx - hw, top + j, hw * 2 + 1, 'lampShade1');
      G.rect(ctx, cx + Math.round(hw * 0.35), top + j, hw - Math.round(hw * 0.35) + 1, 1, 'lampShade2');   // right-side shade
      G.px(ctx, cx - hw, top + j, 'ink'); G.px(ctx, cx + hw, top + j, 'ink');
    }
    G.hline(ctx, cx - 6, top, 13, 'ink');
    G.hline(ctx, cx - (l.shadeW >> 1), bot - 1, l.shadeW + 1, 'lampShade2');
    G.hline(ctx, cx - (l.shadeW >> 1), bot, l.shadeW + 1, 'ink');
    G.vline(ctx, cx - 4, top + 2, l.shadeH - 4, 'lampGlow');     // rim highlight (upper-left light)
    // bulb
    if (o.on) {
      G.ditherCircle(ctx, cx, bot + 1, 5, 'lampLight', 0.5, 0);
      G.rect(ctx, cx - 2, bot - 1, 5, 3, 'lampGlow');
      G.rect(ctx, cx - 1, bot + 2, 3, 1, 'lampGlow');
      G.px(ctx, cx, bot + 1, 'white');
      G.hline(ctx, cx - (l.shadeW >> 1) + 2, bot - 1, l.shadeW - 3, 'lampGlow');   // lit inner rim
    } else {
      G.rect(ctx, cx - 1, bot - 1, 3, 3, 'metal2');
      G.px(ctx, cx + 1, bot + 1, 'metal3');
    }
  };

  // Warm light pool on the rug / floor under the lamp (the table draws its own share on its top surface).
  R.lampPool = function (ctx, camX, env) {
    env = env || {};
    if (!env.lampOn || env.lampLightPool === false) return;
    ctx.save(); ctx.translate(-(camX | 0), 0);
    ctx.globalAlpha *= 0.5;                                                                      // soft: a glow, not a doily
    if (PSA.FLAT) { ctx.restore(); return; }                                                     // flat style: no light pools
    withClip(ctx, L.rug.x - 30, L.floorY, L.rug.w + 60, 60, function () {
      ditherEllipse(ctx, L.lamp.cx, L.table.y + L.table.h + 8, 44, 14, 'lampLight', 0.25, 0);   // sparse: the rug shows through
      ditherEllipse(ctx, L.lamp.cx, L.table.y + L.table.h + 6, 20, 5, 'lampLight', 0.25, 2);    // slightly denser just under the table edge
    });
    ctx.restore();
  };
  function lampPoolTable(ctx, env) {
    if (!env.lampOn || env.lampLightPool === false) return;
    const T = L.table;
    ctx.save(); ctx.globalAlpha *= 0.55;
    withClip(ctx, T.x + 1, T.y + 1, T.w - 2, T.h - 6, function () {
      lightPool(ctx, L.lamp.cx, T.y + 10, 30, 8, 'lampLight');
    });
    ctx.restore();
  }

  // ================================================================== STEAM (small)
  // Deterministic puffs rising from (cx, baseY). intensity 0..1 → number/size of puffs.
  R.drawSteamSmall = function (ctx, cx, baseY, t, o) {
    o = o || {};
    const k = G.clamp(o.intensity == null ? 1 : o.intensity, 0, 1);
    if (k <= 0.02) return;
    const n = k > 0.66 ? 4 : k > 0.33 ? 3 : 2;
    const rise = o.rise != null ? o.rise : 16 + 6 * k;
    for (let i = 0; i < n; i++) {
      const ph = ((t || 0) * 0.55 + i * (1 / n) + G.hash(i, 3, 9) * 0.2) % 1;
      const y = baseY - Math.round(ph * rise);
      const sway = Math.round(Math.sin((ph * 6.28) + i * 2.1) * 2.5);
      const x = cx + sway + (i % 2 ? 2 : -2);
      const r = ph < 0.15 ? 1 : ph < 0.8 ? 2 : 1;
      G.ditherCircle(ctx, x, y, r, 'steam', ph > 0.7 ? 0.25 : 0.5, i);
    }
  };

  // ================================================================== SMALL POT (on the stove)
  R.drawPotSmall = function (ctx, cx, bottomY, o) {
    o = o || {};
    cx |= 0; bottomY |= 0;
    const w = L.potSmall.w, h = L.potSmall.h;            // 22 x 14
    const x0 = cx - (w >> 1), top = bottomY - h;         // body 112..126
    const boil = G.clamp(o.boiling || 0, 0, 1), t = o.t || 0;
    // body
    G.rect(ctx, x0 + 1, top + 2, w - 2, h - 2, 'pot2');
    G.rect(ctx, x0 + 2, top + 3, 4, h - 5, 'pot1');                      // left highlight
    G.rect(ctx, x0 + w - 6, top + 3, 4, h - 5, 'pot3');                  // right shade
    G.hline(ctx, x0 + 2, bottomY - 2, w - 4, 'pot3');
    // rim (seen slightly from above: a 3px band, with the water inside)
    G.rect(ctx, x0, top, w, 3, 'pot1');
    G.hline(ctx, x0 + 1, top + 1, w - 2, boil > 0.05 ? 'water2' : 'water3');
    if (boil > 0.05) { // foam / bubbles along the water line
      for (let i = 0; i < w - 2; i++) {
        if (G.hash(i, Math.floor(t * 7), 11) < 0.25 + 0.4 * boil) G.px(ctx, x0 + 1 + i, top + 1, 'water1');
      }
    }
    // outline (ink) + handles
    G.box(ctx, x0, top, w, h, 'ink');
    G.hline(ctx, x0, top + 3, w, 'pot4');
    G.rect(ctx, x0 - 3, top + 5, 3, 3, 'pot3'); G.hline(ctx, x0 - 3, top + 5, 3, 'pot1');
    G.rect(ctx, x0 + w, top + 5, 3, 3, 'pot3'); G.hline(ctx, x0 + w, top + 5, 3, 'pot1');
    G.box(ctx, x0 - 4, top + 4, 5, 5, 'ink'); G.box(ctx, x0 + w - 1, top + 4, 5, 5, 'ink');
    G.rect(ctx, x0 - 3, top + 5, 3, 3, 'pot2'); G.rect(ctx, x0 + w, top + 5, 3, 3, 'pot2');
    G.hline(ctx, x0 - 3, top + 5, 3, 'pot1'); G.hline(ctx, x0 + w, top + 5, 3, 'pot1');
    if (boil > 0.05) R.drawSteamSmall(ctx, cx, top - 1, t, { intensity: boil });
  };

  // ================================================================== SMALL PLATE + FORK
  // The plate of pasta seen from the room's oblique angle: ~18x8 ellipse, mound of spaghetti + sauce + basil.
  R.drawPlateSmall = function (ctx, cx, cy, o) {
    o = o || {};
    cx |= 0; cy |= 0;
    const half = o.amount === 'half' || o.amount === 0.5;
    const steam = G.clamp(o.steam || 0, 0, 1);
    // plate: 19x7 rounded blob (rows cy-3..cy+3) with an ink outline, rim stripe, shaded underside
    blob(ctx, cx, cy, [3, 6, 8, 9, 8, 6, 3], 3, 'plate1', 'ink');
    G.hline(ctx, cx - 7, cy + 1, 15, 'plate2'); G.hline(ctx, cx - 5, cy + 2, 11, 'plate2');   // lower half in shade
    G.hline(ctx, cx - 2, cy + 3, 5, 'plate3');
    G.hline(ctx, cx - 4, cy - 2, 9, 'plateRim');            // decorative rim stripe following the far edge
    G.px(ctx, cx - 5, cy - 1, 'plateRim'); G.px(ctx, cx + 5, cy - 1, 'plateRim');
    G.hline(ctx, cx - 2, cy + 4, 5, (o && o.shadow) || 'wood4');   // contact shadow (table wood, or the fridge shelf tone)
    if (half) {
      // leftovers: a smaller mound pushed to the left, sauce smears on the empty side
      blob(ctx, cx - 2, cy - 1, [2, 4, 4, 3], 3, 'pasta2', null);
      G.hline(ctx, cx - 5, cy - 1, 7, 'pasta3');
      G.hline(ctx, cx - 4, cy - 4, 3, 'pasta1'); G.px(ctx, cx - 5, cy - 3, 'pasta1');
      G.px(ctx, cx - 1, cy - 3, 'sauce2'); G.px(ctx, cx - 3, cy - 2, 'sauce1'); G.px(ctx, cx, cy - 2, 'sauce2');
      G.hline(ctx, cx + 3, cy, 3, 'sauce3'); G.px(ctx, cx + 5, cy - 1, 'sauce2'); G.px(ctx, cx + 2, cy + 1, 'sauce3');
      G.px(ctx, cx - 4, cy - 2, 'basil');
    } else {
      // full mound: 13 wide, 5 tall (rows cy-4..cy), soft (no outline), highlight upper-left, shade underneath
      blob(ctx, cx, cy, [3, 5, 6, 6, 5], 4, 'pasta2', null);
      G.hline(ctx, cx - 5, cy, 11, 'pasta3'); G.hline(ctx, cx - 6, cy - 1, 2, 'pasta3'); G.hline(ctx, cx + 4, cy - 1, 3, 'pasta3');
      G.hline(ctx, cx - 3, cy - 4, 4, 'pasta1'); G.hline(ctx, cx - 5, cy - 3, 3, 'pasta1'); G.px(ctx, cx + 1, cy - 3, 'pasta1');
      G.px(ctx, cx + 3, cy - 1, 'pasta4'); G.px(ctx, cx - 2, cy - 1, 'pasta4');
      G.rect(ctx, cx - 1, cy - 3, 3, 2, 'sauce2'); G.px(ctx, cx, cy - 3, 'sauce1');
      G.px(ctx, cx + 3, cy - 2, 'sauce2'); G.px(ctx, cx - 4, cy - 1, 'sauce2'); G.px(ctx, cx + 2, cy, 'sauce3');
      G.px(ctx, cx - 2, cy - 4, 'basil'); G.px(ctx, cx + 2, cy - 3, 'basil2');
    }
    if (steam > 0.02) R.drawSteamSmall(ctx, cx, cy - 5, o.t || 0, { intensity: steam, rise: 11 });   // low: stays below a seated girl's face
  };
  // Fork lying on the table (handle toward the camera-right, tines up-left). (x,y) = top-left of its 9x4 box.
  R.drawForkSmall = function (ctx, x, y) {
    x |= 0; y |= 0;
    // 11x5 fork lying on the table, head at the left: three readable tines over a small base, 2px handle.
    G.hline(ctx, x + 1, y + 4, 10, 'wood4');                                   // contact shadow on the table
    G.rect(ctx, x + 5, y + 1, 6, 2, 'fork2'); G.hline(ctx, x + 5, y + 1, 6, 'fork1');   // handle
    G.hline(ctx, x + 5, y + 3, 6, 'fork3');                                     // handle underside
    G.rect(ctx, x, y + 2, 5, 2, 'fork2'); G.hline(ctx, x, y + 2, 5, 'fork1');   // head base
    G.vline(ctx, x, y - 1, 3, 'fork1'); G.vline(ctx, x + 2, y - 1, 3, 'fork1'); G.vline(ctx, x + 4, y - 1, 3, 'fork1');   // tines
    G.vline(ctx, x + 1, y, 2, 'fork3'); G.vline(ctx, x + 3, y, 2, 'fork3');    // gaps between the tines
    G.hline(ctx, x, y + 4, 5, 'ink');                                           // dark under-edge of the head
  };

  // ================================================================== FRIDGE
  // White fridge at PSA.LAYOUT.fridge. Door hinged on the RIGHT; as it opens the door panel foreshortens toward the hinge
  // and a side panel grows to the right (420..436). Interior: 3 shelves (milk carton, jar, drawer) + the plate.
  R.drawFridge = function (ctx, o) {
    o = o || {};
    const F = L.fridge;
    const x0 = F.x, y0 = F.y, w = F.w, h = F.h, x1 = x0 + w, y1 = y0 + h;   // 376..420 x 76..146
    const e = G.smooth(G.clamp(o.open || 0, 0, 1));
    const lit = o.light !== false && e > 0.02;
    // body shell (sides visible when the door is open)
    G.rect(ctx, x0, y0, w, h, 'fridge2');
    G.box(ctx, x0, y0, w, h, 'fridge4');
    G.hline(ctx, x0 + 1, y0 + 1, w - 2, 'fridge1');
    if (e > 0.02) {
      // --- interior cavity
      const ix = x0 + 2, iy = y0 + 4, iw = w - 4, ih = h - 7;
      G.rect(ctx, ix, iy, iw, ih, lit ? 'fridgeIn1' : 'fridgeIn3');
      if (lit) {
        G.dither(ctx, ix, iy, iw, ih, 'fridgeLight', 0.5, 0);
        G.rect(ctx, ix + 1, iy + 1, 3, ih - 2, 'fridgeIn2');                   // left inner wall in shadow
        G.dither(ctx, ix + 1, iy + 1, 3, ih - 2, 'fridgeIn1', 0.5, 1);
        G.rect(ctx, ix, iy, iw, 2, 'fridgeLight'); G.px(ctx, ix + (iw >> 1), iy + 2, 'white');   // the light strip at the top
      } else {
        G.rect(ctx, ix + 1, iy + 1, 3, ih - 2, 'fridge4');
      }
      // shelves (glass-white lines with a shadow under them)
      for (const sy of L.fridgeShelfYs) {
        G.hline(ctx, ix, sy, iw, lit ? 'white' : 'fridgeIn2');
        G.hline(ctx, ix, sy + 1, iw, 'fridgeIn3');
      }
      // door-side racks are on the door, so the cavity stays tidy: milk carton (top shelf, left), jar (top shelf, right)
      const s0 = L.fridgeShelfYs[0], s2 = L.fridgeShelfYs[2];
      G.rect(ctx, ix + 6, s0 - 12, 6, 12, 'fridge1'); G.box(ctx, ix + 5, s0 - 13, 8, 14, 'ink');
      G.rect(ctx, ix + 6, s0 - 11, 6, 2, 'water3'); G.rect(ctx, ix + 7, s0 - 7, 4, 3, 'water4'); G.px(ctx, ix + 8, s0 - 6, 'white');
      G.vline(ctx, ix + 11, s0 - 10, 10, 'fridge2');
      G.rect(ctx, ix + 23, s0 - 8, 7, 8, 'sauce2'); G.rect(ctx, ix + 24, s0 - 7, 2, 5, 'sauce1');
      G.rect(ctx, ix + 23, s0 - 10, 7, 2, 'metal2'); G.hline(ctx, ix + 23, s0 - 10, 7, 'metal1');
      G.box(ctx, ix + 22, s0 - 11, 9, 11, 'ink');
      // bottom: crisper drawer
      G.rect(ctx, ix + 3, s2 + 2, iw - 6, ih - (s2 + 2 - iy) - 1, 'fridgeIn2');
      G.box(ctx, ix + 3, s2 + 2, iw - 6, ih - (s2 + 2 - iy) - 1, 'fridgeIn3');
      G.hline(ctx, ix + (iw >> 1) - 4, s2 + 4, 8, 'fridgeIn3');
      // leftovers plate on the middle shelf
      if (o.plateInside) R.drawPlateSmall(ctx, L.plateInFridge.cx, L.plateInFridge.cy, { amount: 'half', steam: 0, t: o.t, shadow: 'fridgeIn3' });
    }
    // --- door panel: anchored on the right (hinge), width shrinks as it opens
    const dw = Math.round(w * (1 - e));
    if (dw > 0) {
      const dx = x1 - dw;
      G.rect(ctx, dx, y0, dw, h, 'fridge1');
      G.rect(ctx, x1 - 3, y0 + 3, 2, h - 6, 'fridge2');                   // right-side shade
      G.hline(ctx, dx + 1, y1 - 3, dw - 2, 'fridge2'); G.hline(ctx, dx + 1, y1 - 2, dw - 2, 'fridge3');
      G.box(ctx, dx, y0, dw, h, 'fridge4');
      G.hline(ctx, dx + 1, y0 + 1, dw - 2, 'white'); G.hline(ctx, dx + 1, y0 + 2, dw - 2, 'fridge2');   // top edge (seen from above)
      if (dw > 8) { // handle on the free (left) edge
        G.rect(ctx, dx + 3, y0 + 16, 2, 26, 'fridge3');
        G.vline(ctx, dx + 3, y0 + 16, 26, 'fridge4'); G.px(ctx, dx + 4, y0 + 16, 'fridge2');
        G.rect(ctx, dx + 2, y0 + 16, 1, 2, 'fridge4'); G.rect(ctx, dx + 2, y0 + 40, 1, 2, 'fridge4');
      }
      if (e > 0.02) G.vline(ctx, dx, y0 + 1, h - 2, 'fridge3');          // door thickness at the free edge
    }
    // --- side panel of the open door (to the right of the hinge)
    const sw = Math.round(F.doorOpenW * e);
    if (sw > 0) {
      G.rect(ctx, x1, y0, sw, h, 'fridge2');
      G.rect(ctx, x1, y0 + 1, Math.max(1, sw >> 2), h - 2, 'fridge1');
      G.box(ctx, x1 - 1, y0, sw + 1, h, 'fridge4');
      G.hline(ctx, x1, y1 - 2, sw, 'fridge3');
      if (sw > 5) { for (const sy of L.fridgeShelfYs) G.hline(ctx, x1 + 1, sy + 4, sw - 2, 'fridge3'); }   // door racks
    }
    // feet
    G.rect(ctx, x0 + 2, y1, 3, 1, 'fridge4'); G.rect(ctx, x1 - 5, y1, 3, 1, 'fridge4');
  };
  // Light wedge spilling onto the floor from the open fridge (dithered, drawn on the floor before the fridge body).
  function fridgeFloorLight(ctx, open) {
    const e = G.smooth(G.clamp(open, 0, 1));
    if (e < 0.05 || PSA.FLAT) return;
    const F = L.fridge, y1 = F.y + F.h;
    const depth = Math.round(12 * e), spread = Math.round(26 * e);
    ctx.fillStyle = G.col('fridgeLight');
    for (let j = 0; j < depth; j++) {
      const y = y1 + j;
      const reach = Math.round(spread * (1 - j / depth) + 6 * (j / depth));
      const xs = F.x + 4 - reach - Math.round(j * 0.6), xe = F.x + F.w - 6 - Math.round(j * 1.2);
      for (let x = xs; x < xe; x++) {
        const core = x > xs + reach * 0.45;
        const on = core ? ((x + y) & 1) === 0 : ((x + 2 * y) & 3) === 0;
        if (on) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // ================================================================== BACKGROUND PIECES
  function drawWall(ctx) {
    G.rect(ctx, -64, 0, L.worldW + 128, L.floorY, 'wall');
    // very subtle wallpaper: tiny diamond motifs on a 16px lattice, offset every other row
    for (let y = 6; y < L.floorY - 8; y += 16) {
      const off = ((y / 16) | 0) & 1 ? 8 : 0;
      for (let x = -64 + off; x < L.worldW + 64; x += 16) {
        G.px(ctx, x, y, 'wallShade'); G.px(ctx, x - 1, y + 1, 'wallShade'); G.px(ctx, x + 1, y + 1, 'wallShade');
        G.px(ctx, x, y + 2, 'wallShade');
      }
    }
    // picture rail / top band
    G.hline(ctx, -64, 0, L.worldW + 128, 'wallLine');
    // baseboard
    G.rect(ctx, -64, L.floorY - 6, L.worldW + 128, 6, 'baseboard');
    G.hline(ctx, -64, L.floorY - 6, L.worldW + 128, 'wood1');
    G.hline(ctx, -64, L.floorY - 5, L.worldW + 128, 'wood2');
    G.hline(ctx, -64, L.floorY - 1, L.worldW + 128, 'wood4');
    G.hline(ctx, -64, L.floorY - 7, L.worldW + 128, 'wallShade');
  }
  function drawFloor(ctx) {
    const y0 = L.floorY, H = 216;
    G.rect(ctx, -64, y0, L.worldW + 128, H - y0, 'floor2');
    const rowH = 8, plankW = 40;
    for (let r = 0, y = y0; y < H; y += rowH, r++) {
      const off = (r & 1) ? plankW >> 1 : 0;
      for (let x = -64 + off - plankW; x < L.worldW + 64; x += plankW) {
        G.vline(ctx, x, y, rowH, 'floorLine');                                        // plank end seam
      }
      G.hline(ctx, -64, y + rowH - 1, L.worldW + 128, 'floorLine');                    // row seam
    }
    G.hline(ctx, -64, y0, L.worldW + 128, 'floor3');     // shadow line under the baseboard
  }
  function drawRug(ctx) {
    const r = L.rug;
    G.rect(ctx, r.x, r.y, r.w, r.h, 'rug1');
    G.box(ctx, r.x, r.y, r.w, r.h, 'rug2');
    G.box(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 'rug2');
    G.box(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 'rug3');
    // central diamond lattice
    for (let y = r.y + 8; y < r.y + r.h - 6; y += 8) {
      for (let x = r.x + 10; x < r.x + r.w - 8; x += 12) {
        G.px(ctx, x, y, 'rug3'); G.px(ctx, x - 1, y + 1, 'rug3'); G.px(ctx, x + 1, y + 1, 'rug3'); G.px(ctx, x, y + 2, 'rug3');
        G.px(ctx, x, y + 1, 'rug2');
      }
    }
    // fringe left/right
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 2) { G.px(ctx, r.x - 1, y, 'rug3'); G.px(ctx, r.x + r.w, y, 'rug3'); }
    G.hline(ctx, r.x, r.y + r.h, r.w, 'floorLine');   // contact shadow
  }
  function drawChair(ctx) {
    const c = L.chair, top = c.backTop, seat = c.seatY;
    const xl = c.cx - 12, xr = c.cx + 10;
    // posts
    G.rect(ctx, xl, top, 3, seat - top, 'wood2'); G.rect(ctx, xr, top, 3, seat - top, 'wood2');
    G.vline(ctx, xl, top, seat - top, 'wood1'); G.vline(ctx, xr + 2, top, seat - top, 'wood3');
    G.vline(ctx, xl - 1, top, seat - top, 'wood4'); G.vline(ctx, xr + 3, top, seat - top, 'wood4');
    G.vline(ctx, xl + 3, top + 5, seat - top - 5, 'wood4'); G.vline(ctx, xr - 1, top + 5, seat - top - 5, 'wood4');
    // top rail + mid slat
    G.rect(ctx, xl - 1, top, xr - xl + 4, 5, 'wood2');
    G.hline(ctx, xl - 1, top, xr - xl + 4, 'wood1'); G.hline(ctx, xl - 1, top + 4, xr - xl + 4, 'wood4');
    G.hline(ctx, xl - 1, top - 1, xr - xl + 4, 'wood4');
    G.rect(ctx, xl + 3, top + 12, xr - xl - 3, 4, 'wood2');
    G.hline(ctx, xl + 3, top + 12, xr - xl - 3, 'wood1'); G.hline(ctx, xl + 3, top + 15, xr - xl - 3, 'wood4');
    G.hline(ctx, xl + 3, top + 11, xr - xl - 3, 'wood3');
  }
  function drawCabinets(ctx) {
    const c = L.upperCabinets, s = L.stove;
    const y0 = c.y, y1 = c.y + c.h;
    // base block
    G.rect(ctx, c.x, y0, c.w, c.h, 'cabinet2');
    G.box(ctx, c.x, y0, c.w, c.h, 'cabinet3');
    G.hline(ctx, c.x, y0, c.w, 'cabinet1');
    G.hline(ctx, c.x + 1, y1, c.w, 'wallShade'); G.hline(ctx, c.x + 2, y1 + 1, c.w, 'wallShade');   // shadow on the tiles
    const door = function (x, y, w, h) {
      G.rect(ctx, x, y, w, h, 'cabinet1');
      G.box(ctx, x, y, w, h, 'cabinet3');
      G.box(ctx, x + 3, y + 3, w - 6, h - 6, 'cabinet2');                 // recessed panel
      G.hline(ctx, x + 4, y + 4, w - 8, 'cabinet1'); G.vline(ctx, x + 4, y + 4, h - 8, 'cabinet1');
      G.hline(ctx, x + 1, y + h - 2, w - 2, 'cabinet2');
    };
    const handle = function (x, y) { G.rect(ctx, x, y, 2, 5, 'metal2'); G.px(ctx, x, y, 'metal1'); G.px(ctx, x + 1, y + 4, 'metal3'); };
    // left: two doors
    const lw = s.x - c.x;                 // 58
    door(c.x, y0, lw >> 1, c.h); door(c.x + (lw >> 1), y0, lw - (lw >> 1), c.h);
    handle(c.x + (lw >> 1) - 5, y1 - 10); handle(c.x + (lw >> 1) + 3, y1 - 10);
    // right: one door
    const rx = s.x + s.w;
    door(rx, y0, c.x + c.w - rx, c.h); handle(rx + 3, y1 - 10);
    // middle (above the stove): a short cabinet + the range hood below it
    door(s.x, y0, s.w >> 1, 18); door(s.x + (s.w >> 1), y0, s.w - (s.w >> 1), 18);
    handle(s.x + (s.w >> 1) - 5, y0 + 10); handle(s.x + (s.w >> 1) + 3, y0 + 10);
    const hy = y0 + 18, hh = y1 - hy;                                     // hood 44..64
    G.rect(ctx, s.x, hy, s.w, hh, 'metal2');
    for (let j = 0; j < hh; j++) {                                        // sloped front: widens toward the bottom
      const inset = Math.max(0, 6 - j);
      G.hline(ctx, s.x + inset, hy + j, s.w - inset * 2, j < 3 ? 'metal1' : j < hh - 4 ? 'metal2' : 'metal3');
    }
    G.rect(ctx, s.x, hy, 6, 6, 'cabinet2'); G.rect(ctx, s.x + s.w - 6, hy, 6, 6, 'cabinet2');   // wall seen beside the hood top
    G.hline(ctx, s.x, y1 - 1, s.w, 'metal4');
    G.hline(ctx, s.x, y1 - 4, s.w, 'metal1');
    G.hline(ctx, s.x + 2, y1 - 7, s.w - 4, 'metal3');                     // seam
    G.rect(ctx, s.x + s.w - 10, y1 - 3, 4, 2, 'lampShade1');             // hood light (off = pale lens)
    G.box(ctx, s.x, hy + 6, s.w, hh - 6, 'metal4');
  }
  function drawTiles(ctx) {
    const c = L.upperCabinets, k = L.counter;
    const x0 = c.x, y0 = c.y + c.h, w = c.w, h = k.y - y0;              // 232..366 x 64..120
    G.rect(ctx, x0, y0, w, h, 'tile1');
    const tw = 8, th = 7;
    for (let r = 0, y = y0; y < y0 + h; y += th, r++) {
      const off = (r & 1) ? tw >> 1 : 0;
      for (let x = x0 - tw + off; x < x0 + w; x += tw) {
        const xs = Math.max(x, x0), xe = Math.min(x + tw, x0 + w);
        if (xe <= xs) continue;
        const ye = Math.min(y + th, y0 + h);
        G.hline(ctx, xs, ye - 1, xe - xs, 'tile2');                        // soft grout (tile2) ...
        G.vline(ctx, xe - 1, y, ye - y, 'tile2');
        G.px(ctx, xe - 1, ye - 1, 'tileLine');                             // ... with a darker pixel at the crossings
      }
    }
    G.hline(ctx, x0, y0 + h - 1, w, 'tileLine');
    G.hline(ctx, x0, y0 + h - 2, w, 'tile2');
  }
  function drawCounter(ctx, env) {
    const k = L.counter, s = L.stove, y0 = k.y, yf = k.y + k.topH, y1 = L.floorY;   // top 120..126, fronts 127..140
    // counter top (cream) with a lip
    G.rect(ctx, k.x - 1, y0, k.w + 2, k.topH, 'counter1');
    G.hline(ctx, k.x - 1, y0, k.w + 2, 'white');
    G.hline(ctx, k.x - 1, yf - 2, k.w + 2, 'counter2');
    G.hline(ctx, k.x - 1, yf - 1, k.w + 2, 'cabinet3');                   // shadow of the lip on the cabinet fronts
    // cabinet fronts
    G.rect(ctx, k.x, yf, k.w, y1 - yf, 'cabinet2');
    G.hline(ctx, k.x, y1 - 1, k.w, 'cabinet3');
    const door = function (x, w) {
      G.rect(ctx, x + 1, yf + 1, w - 2, y1 - yf - 3, 'cabinet1');
      G.box(ctx, x + 1, yf + 1, w - 2, y1 - yf - 3, 'cabinet3');
      G.hline(ctx, x + 2, yf + 2, w - 4, 'cabinet1');
    };
    const handle = function (x, y) { G.rect(ctx, x, y, 5, 2, 'metal2'); G.hline(ctx, x, y, 5, 'metal1'); };
    // left of the stove: 2 doors + a drawer line
    const lw = s.x - k.x;
    door(k.x, lw >> 1); door(k.x + (lw >> 1), lw - (lw >> 1));
    handle(k.x + (lw >> 1) - 8, yf + 4); handle(k.x + (lw >> 1) + 3, yf + 4);
    // right of the stove: one door
    const rx = s.x + s.w; door(rx, k.x + k.w - rx); handle(rx + 3, yf + 4);
    // --- stove section: dark cooktop on the counter + oven front with knobs
    G.rect(ctx, s.x, y0, s.w, k.topH - 1, 'stoveTop');
    G.hline(ctx, s.x, y0, s.w, 'metal3');
    G.hline(ctx, s.x, yf - 2, s.w, 'metal4');
    G.hline(ctx, s.x, yf - 1, s.w, 'metal4');
    const burner = function (b, rx, ry) {
      G.ellipse(ctx, b.cx, b.cy, rx, ry, 'metal3');
      G.ellipse(ctx, b.cx, b.cy, rx - 2, ry - 1, 'stoveTop');
      G.ellipse(ctx, b.cx, b.cy, rx - 4, 1, 'metal4');
    };
    burner(L.burnerBR, 6, 2); burner({ cx: L.burnerFL.cx, cy: L.burnerFL.cy - 1 }, 7, 2);   // ring kept inside the cooktop band
    // oven front (rows yf..y1-1 = 127..139): knob rail on top, handle bar, oven window below
    G.rect(ctx, s.x, yf, s.w, y1 - yf, 'metal4');
    G.hline(ctx, s.x + 1, yf, s.w - 2, 'metal3');
    for (const kx of [s.x + 5, s.x + 11, s.x + s.w - 14, s.x + s.w - 8]) {   // 4 knobs (3x2, lit top, dark pointer)
      G.rect(ctx, kx, yf + 1, 3, 2, 'metal2'); G.hline(ctx, kx, yf + 1, 3, 'metal1'); G.px(ctx, kx + 1, yf + 2, 'ink');
    }
    G.rect(ctx, s.x + 3, yf + 4, s.w - 6, 2, 'metal2');                   // oven handle bar
    G.hline(ctx, s.x + 3, yf + 4, s.w - 6, 'metal1');
    G.rect(ctx, s.x + 4, yf + 7, s.w - 8, 5, 'metal3');                   // oven window
    G.rect(ctx, s.x + 5, yf + 8, s.w - 10, 3, 'stoveTop');
    G.hline(ctx, s.x + 6, yf + 8, s.w - 14, 'metal2');
    // decoration on the counter: cutting board leaning on the tiles (left) and a small jar (right)
    const bx = k.x + 14;
    G.rect(ctx, bx, y0 - 13, 16, 13, 'wood1'); G.rect(ctx, bx + 1, y0 - 12, 14, 11, 'wood2');
    G.rect(ctx, bx + 2, y0 - 11, 12, 9, 'wood1'); G.vline(ctx, bx + 4, y0 - 10, 7, 'wood2'); G.vline(ctx, bx + 9, y0 - 10, 7, 'wood2');
    G.box(ctx, bx - 1, y0 - 14, 18, 15, 'wood4'); G.px(ctx, bx + 7, y0 - 12, 'wood4');   // hanging hole
    const jx = k.x + k.w - 12;
    G.rect(ctx, jx - 3, y0 - 8, 7, 8, 'fridgeIn2'); G.rect(ctx, jx - 2, y0 - 6, 5, 5, 'sauce2'); G.vline(ctx, jx - 2, y0 - 6, 5, 'sauce1');
    G.rect(ctx, jx - 3, y0 - 10, 7, 2, 'wood3'); G.box(ctx, jx - 4, y0 - 11, 9, 12, 'ink');
    G.hline(ctx, jx - 3, y0 - 10, 7, 'wood2');
    // small pot on the front-left burner
    if (env.potOnStove !== false) R.drawPotSmall(ctx, L.potSmall.cx, L.potSmall.bottomY, { boiling: env.potBoiling || 0, t: env.t || 0 });
  }

  // ================================================================== MAIN ENTRIES
  function normEnv(env) {
    env = env || {};
    return {
      t: env.t || 0, sky: env.sky || 'sunset', phase: env.phase || 0, lampOn: env.lampOn !== false,
      potOnStove: env.potOnStove !== false, potBoiling: env.potBoiling || 0, fridgeOpen: env.fridgeOpen || 0,
      plateInFridge: !!env.plateInFridge, plateOnTable: env.plateOnTable || null, plateSteam: env.plateSteam || 0,
      forkOnTable: env.forkOnTable === undefined ? !!env.plateOnTable : !!env.forkOnTable, lampLightPool: env.lampLightPool !== false,
      clock: env.clock || null
    };
  }
  // Hours/minutes for the wall clock: explicit env.clock {h,m}, else PSA.story.clock(t) when available.
  function clockFor(env) {
    if (env.clock) return env.clock;
    if (PSA.story && PSA.story.clock) return PSA.story.clock(env.t);
    return { h: 18, m: 30 };
  }

  R.drawBack = function (ctx, camX, env) {
    env = normEnv(env);
    camX = camX | 0;
    ctx.save(); ctx.translate(-camX, 0);
    drawWall(ctx);
    drawFloor(ctx);
    drawRug(ctx);
    fridgeFloorLight(ctx, env.fridgeOpen);
    ctx.restore();
    R.lampPool(ctx, camX, env);
    ctx.save(); ctx.translate(-camX, 0);
    drawShelf(ctx);
    R.drawLamp(ctx, { on: env.lampOn });
    const c = clockFor(env);
    R.drawClock(ctx, L.clock.cx, L.clock.cy, L.clock.r, c.h, c.m);
    R.drawWindow(ctx, L.window.x, L.window.y, L.window.w, L.window.h, { sky: env.sky, phase: env.phase, t: env.t });
    drawCabinets(ctx);
    drawTiles(ctx);
    drawCounter(ctx, env);
    R.drawFridge(ctx, { open: env.fridgeOpen, light: true, plateInside: env.plateInFridge, t: env.t });
    drawChair(ctx);
    ctx.restore();
  };

  R.drawTable = function (ctx, camX, env) {
    env = normEnv(env);
    camX = camX | 0;
    const T = L.table, y1 = T.y + T.h;             // 118..146
    ctx.save(); ctx.translate(-camX, 0);
    // legs (below the front edge)
    for (const lx of [T.x + 4, T.x + T.w - 8]) {
      G.rect(ctx, lx, y1, 4, T.legH, 'wood2');
      G.vline(ctx, lx, y1, T.legH, 'wood1'); G.vline(ctx, lx + 3, y1, T.legH, 'wood3');
      G.hline(ctx, lx - 1, y1 + T.legH, 6, 'floorLine');
    }
    // top surface (wood1 with grain) + front edge (wood2/wood3)
    G.rect(ctx, T.x, T.y, T.w, T.h - 5, 'wood1');
    for (let y = T.y + 4; y < y1 - 6; y += 5) {
      const o = ((y / 5) | 0) & 1 ? 9 : 0;
      G.hline(ctx, T.x + 6 + o, y, 22, 'wood2'); G.hline(ctx, T.x + 40 + o, y, 30, 'wood2');
    }
    G.hline(ctx, T.x + 1, T.y + 1, T.w - 2, 'counter1');                  // sheen on the far edge
    G.rect(ctx, T.x, y1 - 5, T.w, 5, 'wood2');
    G.hline(ctx, T.x, y1 - 5, T.w, 'wood3');
    G.hline(ctx, T.x, y1 - 1, T.w, 'wood3');
    G.box(ctx, T.x - 1, T.y - 1, T.w + 2, T.h + 2, 'wood4');
    G.hline(ctx, T.x, y1 - 6, T.w, 'wood4');                              // edge line between top and front
    lampPoolTable(ctx, env);
    // plate + fork
    if (env.plateOnTable) R.drawPlateSmall(ctx, L.plateOnTable.cx, L.plateOnTable.cy, { amount: env.plateOnTable, steam: env.plateSteam, t: env.t });
    if (env.forkOnTable) R.drawForkSmall(ctx, L.forkOnTable.x, L.forkOnTable.y);
    ctx.restore();
  };

  R.drawFront = function (ctx, camX, env) {
    // Nothing is in front of the action for now (kept for the contract). Reserved for foreground props.
  };

  PSA.room = R;
})(window.PSA);
