// SCENE 3 — TIME PASSES (S3a..S3d). Cozy -> mysterious. The leftover plate stays on the table while the clock runs.
//   S3a  45.0-50.0  CLOSE-UP TABLE (evening): big plate + fork, big window (sunset->dusk), big clock 7:10, lamp pool.
//   S3b  50.0-56.0  CLOCK CLOSE-UP: hands sweep 7:10 -> 9:00 PM with a live caption.
//   S3c  56.0-61.5  WIDE room, nobody there, lamp on, wall clock 9:00 -> 11:00; lamp clicks off as the shot ends.
//   S3d  61.5-69.0  CLOSE-UP TABLE (night): same plate, lamp off, moonlight; the clock reaches 12:00.
// The plate is drawn by ONE helper with ONE seed/amount in S3a and S3d so it is pixel-identical except for lighting.
// Everything is a pure function of time; clocks come from PSA.story.clock, light from PSA.story.light.
(function (PSA) {
  const G = PSA.gfx, F = PSA.font, ST = PSA.story, TL = PSA.timeline, L = PSA.LAYOUT;
  const PR = PSA.props, FD = PSA.food, RM = PSA.room, TB = PSA.textbox, LI = PSA.light;
  const W = PSA.W, H = PSA.H;

  // ------------------------------------------------------------------ shared constants (also exported for S5c)
  const PLATE_SEED = 0;            // the ONE seed of the leftover plate (default seed of food.drawPlateLarge)
  const PLATE_AMOUNT = 0.5;        // leftovers
  const C = {
    seamY: 88,                                   // wall / table-top seam of the close-up composition
    plate: { cx: 150, cy: 150 },                 // large plate center
    fork:  { x: 240, y: 176 },                   // large fork, tine tip (handle goes right)
    clock: { cx: 70, cy: 50, r: 30 },            // big wall clock
    win:   { x: 250, y: 10, w: 110, h: 120 }     // large window frame rect
  };
  const SWEEP_PERIOD = 1.5;        // seconds per turn of the second hand while the clock fast-forwards

  // ------------------------------------------------------------------ helpers
  // Dithered filled ellipse (soft light pools): density 0.25 sparse / 0.5 checker / 0.75 dense.
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

  // Clock hands for a shot: hours/minutes from the story at (clamped) time tc; the SECOND hand is ours, because the
  // story minutes run at up to ~22 min/s in this scene and the asset derives seconds from the fractional minute.
  //   mode 'tick'  : the second hand jumps once per second, at lt = 0.5, 1.5, ... (in sync with the tick sfx)
  //   mode 'sweep' : smooth fast sweep, one turn per SWEEP_PERIOD (reads as "time is flying"); sweepEnd = the lt at
  //                  which the shot switches to 'tick', so the hand position is continuous at the switch.
  function clockHands(tc, lt, mode, sweepEnd) {
    const c = ST.clock(tc);
    const mInt = Math.floor(c.m) % 60;
    let frac;
    if (mode === 'sweep') {
      const e = sweepEnd == null ? 0 : sweepEnd;
      const off = (Math.floor(e + 0.5) % 60) / 60 - e / SWEEP_PERIOD;        // so sweep(e) == tick(e)
      frac = ((lt / SWEEP_PERIOD + off) % 1 + 1) % 1;
    } else frac = ((Math.floor(lt + 0.5) % 60) + 60) % 60 / 60;
    return { h: c.h, m: mInt + frac };
  }

  // Wallpaper at close-up scale: the room's diamond motif (16px lattice) seen 2x closer -> 32px lattice, 2x2 blocks.
  function drawWallCloseup(ctx, y0, y1) {
    G.rect(ctx, 0, y0, W, y1 - y0, 'wall');
    for (let y = 8; y < y1 + 8; y += 32) {
      const off = ((y / 32) | 0) & 1 ? 16 : 0;
      for (let x = -16 + off; x < W + 16; x += 32) {
        G.rect(ctx, x, y, 2, 2, 'wallShade'); G.rect(ctx, x - 2, y + 2, 2, 2, 'wallShade');
        G.rect(ctx, x + 2, y + 2, 2, 2, 'wallShade'); G.rect(ctx, x, y + 4, 2, 2, 'wallShade');
      }
    }
    // anything of the motif that spilled above y0 is covered again (keeps the band clean)
    if (y0 > 0) G.rect(ctx, 0, 0, W, y0, 'wall');
  }

  // Table top seen close: big planks running across, grain dashes, the far edge against the wall at seamY.
  function drawTableCloseup(ctx, seamY) {
    G.rect(ctx, 0, seamY, W, H - seamY, 'wood1');
    const plankH = 26;
    for (let k = 0; ; k++) {
      const y = seamY + 18 + k * plankH;
      if (y >= H) break;
      G.hline(ctx, 0, y, W, 'wood3');                  // gap between planks
      G.hline(ctx, 0, y + 1, W, 'wood2');              // its lit lower lip
      // grain: a few long soft streaks per plank (deterministic)
      for (let i = 0; i < (PSA.FLAT ? 0 : 6); i++) {
        const gx = Math.floor(G.hash(k, i, 31) * (W + 60)) - 30;
        const gy = y + 4 + Math.floor(G.hash(k, i, 32) * (plankH - 8));
        const gl = 14 + Math.floor(G.hash(k, i, 33) * 40);
        G.hline(ctx, gx, gy, gl, 'wood2');
        if (G.hash(k, i, 34) < 0.5) G.hline(ctx, gx + 3, gy + 1, Math.max(4, gl - 8), 'wood2');
      }
      // plank-end joints, offset per row
      const jx = 40 + Math.floor(G.hash(k, 9, 35) * 300);
      G.vline(ctx, jx, y + 2, plankH - 2, 'wood2');
    }
    // far edge of the table top (meets the wall): dark line + sheen, and its soft shadow on the wall
    G.hline(ctx, 0, seamY, W, 'wood4');
    G.hline(ctx, 0, seamY + 1, W, 'counter1');
    G.dither(ctx, 0, seamY - 2, W, 2, 'wallShade', 0.5, 0);
  }

  // Warm pendant-lamp pool on the table top (the lamp hangs above the plate). Sparse so the wood shows through.
  function drawLampPoolCloseup(ctx, seamY) {
    if (PSA.FLAT) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, seamY + 2, W, H - seamY - 2); ctx.clip();
    ctx.globalAlpha *= 0.5;                                        // soft glow
    ditherEllipse(ctx, 146, 150, 140, 54, 'lampLight', 0.25, 0);   // sparse halo: the wood shows through
    ditherEllipse(ctx, 146, 148, 70, 26, 'lampLight', 0.25, 2);    // second sparse pass, offset: denser core
    ctx.restore();
  }

  // Moonlight falling through the window onto the table (lamp off): a soft elongated pool below the window with the
  // mullion cross cut out as shadows. Sparse and small: a hint of moonlight, not a spotlight.
  function drawMoonPatch(ctx, seamY) {
    const cx = C.win.x + (C.win.w >> 1) - 14, cy = seamY + 26, rx = 72, ry = 34;   // pool center/size on the table
    const vGap = cx + 4, hGap = cy + 2;                                            // mullion shadows (vertical / horizontal)
    ctx.save();
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= 0.35;   // a faint wash of moonlight (screen blend)
    ctx.fillStyle = G.col('skyMorn2');
    for (let y = -ry; y <= ry; y++) {
      const Y = cy + y;
      if (Y < seamY + 2 || Y >= H) continue;
      if (Y >= hGap && Y < hGap + 3) continue;                                     // horizontal bar shadow
      const f = 1 - (y * y) / (ry * ry);
      const hw = Math.floor(Math.sqrt(f) * rx + 0.5);
      for (let x = -hw; x <= hw; x++) {
        const X = cx + x;
        if (X >= vGap - 1 && X < vGap + 2) continue;                              // vertical bar shadow
        const edge = (x * x) / (hw * hw + 1) > 0.55;                               // outer third: thinner
        const on = edge ? (((X + Y) & 1) === 0 && ((X + 2 * Y) & 3) === 0) : (((X + Y) & 1) === 0);
        if (on) ctx.fillRect(X, Y, 1, 1);
      }
    }
    ctx.restore();
  }

  // Mini caption frame (black box, border) with centered text. alpha optional.
  function miniCaption(ctx, cx, y, text, alpha) {
    const w = F.measure('12:00 AM', 1) + 14, h = 20;
    const x = Math.round(cx - w / 2);
    const prev = ctx.globalAlpha;
    if (alpha != null) ctx.globalAlpha = prev * G.clamp(alpha, 0, 1);
    TB.frame(ctx, x, y, w, h);
    F.text(ctx, text, Math.round(cx), y + 6, { color: 'uiText', align: 'center' });
    ctx.globalAlpha = prev;
  }

  // ------------------------------------------------------------------ the table close-up composition (S3a, S3d, S5c)
  // o = { t, light (story light), clock {h,m}, moonlight:bool }
  function drawTableScene(ctx, o) {
    const t = o.t || 0, light = o.light, seamY = C.seamY;
    // wall + window + clock (back)
    drawWallCloseup(ctx, 0, seamY);
    PR.drawWindowLarge(ctx, C.win.x, C.win.y, C.win.w, C.win.h, { sky: light.sky, phase: light.phase, t: t });
    PR.drawClock(ctx, C.clock.cx, C.clock.cy, C.clock.r, o.clock.h, o.clock.m, { big: true });
    // table top (front) + light on it
    drawTableCloseup(ctx, seamY);
    if (light.lampOn) drawLampPoolCloseup(ctx, seamY);
    else if (o.moonlight && !PSA.FLAT) drawMoonPatch(ctx, seamY);
    // THE plate (identical in every shot: same amount, same seed, no steam) + the fork beside it
    FD.drawPlateLarge(ctx, C.plate.cx, C.plate.cy, { amount: PLATE_AMOUNT, sauce: 1, steam: 0, t: 0, seed: PLATE_SEED });
    FD.drawForkLarge(ctx, C.fork.x, C.fork.y, { angle: 'flat', pasta: 0, t: 0 });
  }

  // ------------------------------------------------------------------ S3a  CLOSE-UP TABLE (evening, 7:10 PM)
  PSA.shots.S3a = function (ctx, t, lt) {
    const tc = G.clamp(t, 45, 50);                    // crossfade frames outside the shot hold its first/last state
    const light = ST.light(tc);
    drawTableScene(ctx, { t: tc, light: light, clock: clockHands(tc, lt, 'tick'), moonlight: false });
    LI.apply(ctx, light.state);
  };

  // ------------------------------------------------------------------ S3b  CLOCK CLOSE-UP (7:10 -> 9:00 PM)
  PSA.shots.S3b = function (ctx, t, lt) {
    const tc = G.clamp(t, 50, 56);
    const light = ST.light(tc);
    drawWallCloseup(ctx, 0, H);
    // soft shadow of the clock on the wall (light from the upper-left)
    G.ditherCircle(ctx, 192 + 3, 100 + 3, 62, 'wallShade', 0.5, 0);
    const hands = clockHands(tc, lt, lt < 6 ? 'sweep' : 'tick', 6);      // sweeps for the shot, holds at 9:00 in the fade
    PR.drawClock(ctx, 192, 100, 60, hands.h, hands.m, { big: true });
    LI.apply(ctx, light.state);
    // live caption under the clock: "7:40 PM" ... settling on "9:00 PM"
    miniCaption(ctx, 192, 172, ST.clockLabel(tc));
  };

  // ------------------------------------------------------------------ S3c  WIDE room, nobody there (9:00 -> 11:00 PM)
  PSA.shots.S3c = function (ctx, t, lt) {
    const tc = G.clamp(t, 56, 61.5);
    const light = ST.light(t);                        // real t: the lamp goes off at 61.5, as the shot crossfades out
    const clk = ST.clock(tc);
    const env = {
      t: tc, sky: light.sky, phase: light.phase, lampOn: light.lampOn,
      potOnStove: true, potBoiling: 0, fridgeOpen: 0, plateInFridge: false,
      plateOnTable: 'half', plateSteam: 0, forkOnTable: true, clock: { h: clk.h, m: clk.m }
    };
    const cam = L.wideCam;
    RM.drawBack(ctx, cam, env);
    RM.drawTable(ctx, cam, env);
    RM.drawFront(ctx, cam, env);
    LI.apply(ctx, light.state);
  };

  // ------------------------------------------------------------------ S3d  CLOSE-UP TABLE (night, lamp off, 11 -> 12)
  PSA.shots.S3d = function (ctx, t, lt) {
    const tc = G.clamp(t, 61.5, 69);                  // lamp is off for the whole shot (story: lampOn false from 61.5)
    const light = ST.light(tc);
    const hands = clockHands(tc, lt, lt < 4 ? 'sweep' : 'tick', 4);      // sweeps up to midnight (65.5), then ticks
    drawTableScene(ctx, { t: tc, light: light, clock: hands, moonlight: true });
    LI.apply(ctx, light.state);
    // faint mini caption "12:00 AM" under the clock once it has settled (65.5 = lt 4.0)
    const capA = G.span(lt, 4.0, 4.5) * 0.7;
    if (capA > 0) miniCaption(ctx, C.clock.cx, C.clock.cy + C.clock.r + 4, ST.clockLabel(tc), capA);
  };

  // ------------------------------------------------------------------ SFX (t relative to each shot's start)
  function ticks(t0, step, count, level0, level1) {
    const ev = [];
    for (let i = 0; i < count; i++) {
      const lv = count > 1 ? G.lerp(level0, level1, i / (count - 1)) : level0;
      ev.push({ t: +(t0 + i * step).toFixed(3), name: 'tick', args: { accent: i % 4 === 3, level: +lv.toFixed(3) } });
    }
    return ev;
  }
  TL.byId('S3a').sfx = ticks(0.5, 1.0, 5, 0.35, 0.35);                           // 45.5 .. 49.5
  TL.byId('S3b').sfx = ticks(0.25, 0.5, 12, 0.5, 0.7);                           // 50.25 .. 55.75, tension rises
  TL.byId('S3c').sfx = ticks(0.5, 1.0, 5, 0.45, 0.45).concat([                    // 56.5 .. 60.5
    { t: 5.4, name: 'lightSwitch', args: {} }                                     // 61.4: the lamp clicks off
  ]);
  TL.byId('S3d').sfx = ticks(0.5, 1.0, 7, 0.55, 0.55).concat([                    // 62.0 .. 68.0
    { t: 1.0, name: 'swell', args: { dur: 6 } }                                   // very quiet pad under the ticks
  ]);

  // Exported for scene 5 (S5c reuses this exact composition and plate)
  PSA.s3 = { PLATE_SEED: PLATE_SEED, PLATE_AMOUNT: PLATE_AMOUNT, COMP: C, drawTableScene: drawTableScene, clockHands: clockHands };
})(window.PSA);
