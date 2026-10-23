// SCENE 5 — THE NEXT DAY (81.0–111.5). Quiet, pale morning. S5a wide, S5b fridge (plate comes out, goes to the table),
// S5c plate close-up, S5d portrait (look / sniff / unsure "?"), S5e hand + fork rising and STOPPING, S5f the choice menu.
// Every renderer is a pure function of absolute time t (lt only for sfx bookkeeping); all beats use clamped spans.
(function (PSA) {
  const G = PSA.gfx, L = PSA.LAYOUT, ST = PSA.story, TL = PSA.timeline, TB = PSA.textbox;
  const RM = PSA.room, FD = PSA.food, PR = PSA.props, PT = PSA.portrait, GIRL = PSA.girl;
  const W = PSA.W, H = PSA.H;

  // ================================================================== shared helpers
  const BLINK = (t) => (t % 3.7) < 0.12;                 // house blink rule
  const BREATH = (t) => Math.floor(t * 2) % 2;           // idle breathing frame

  // Room environment for the morning (no lamp, pot cold, fork left on the table, fridge handled per shot)
  function morningEnv(t, extra) {
    const li = ST.light(t);
    return Object.assign({
      t: t, sky: li.sky, phase: li.phase, lampOn: false, lampLightPool: false,
      potOnStove: true, potBoiling: 0, fridgeOpen: 0,
      plateInFridge: true, plateOnTable: null, plateSteam: 0, forkOnTable: true
    }, extra || {});
  }

  // ---- the girl's walk from the left of the wide shot to the fridge (continues across the S5a -> S5b cut).
  // docs/SCENES.md times (enter 82.6, at x~300 by 85.8, at the fridge 86.4) imply ~88 px/s, so that is the speed used.
  const WALK_T0 = 82.4, WALK_X0 = 20, WALK_V = 88, WALK_FPS = 10;
  const FRIDGE_X = L.marks.fridge.x, FRIDGE_Y = L.marks.fridge.y;         // 356, 152
  const WALK_T1 = WALK_T0 + (FRIDGE_X - WALK_X0) / WALK_V;                // ~86.32 arrival
  function walkInX(t) { return Math.round(G.clamp(WALK_X0 + (t - WALK_T0) * WALK_V, WALK_X0, FRIDGE_X)); }
  // she leaves the walking line (y 166) and steps up to the fridge mark (y 152) over the last 40 px
  function walkInY(x) { return Math.round(G.lerp(L.marks.walkY, FRIDGE_Y, G.span(x, FRIDGE_X - 40, FRIDGE_X))); }
  function walkFrame(t, t0, fps) { return Math.floor(Math.max(0, t - t0) * (fps || WALK_FPS)) % 4; }
  // one footstep per contact frame (frames 0 and 2) between t0 and t1 (absolute), returned shot-relative
  function footsteps(t0, t1, shotStart, fps, soft) {
    const ev = [], step = 2 / (fps || WALK_FPS);
    for (let tt = t0; tt < t1 - 1e-6; tt += step) ev.push({ t: +(tt - shotStart).toFixed(3), name: 'footstep', args: { soft: soft !== false } });
    return ev;
  }

  // ---- table wood for the close-ups: horizontal planks with seams and sparse grain (deterministic)
  function drawPlanks(ctx, x, y, w, h, plankH, seed) {
    G.rect(ctx, x, y, w, h, 'wood1');
    const nRows = Math.ceil(h / plankH) + 1;
    for (let r = 0; r < nRows; r++) {
      const py = y + r * plankH;
      if (py > y + h) break;
      // seam between planks (shadow line + lighter edge below it)
      if (r > 0) { G.hline(ctx, x, py, w, 'wood4'); G.hline(ctx, x, py + 1, w, 'wood3'); }
      // a vertical joint somewhere in the row (staggered)
      const jx = x + Math.round(G.hash(seed, r, 1) * w);
      G.vline(ctx, jx, py + (r > 0 ? 2 : 0), Math.min(plankH - (r > 0 ? 2 : 0), y + h - py), 'wood3');
      // grain dashes
      const n = PSA.FLAT ? 0 : Math.round(w / 14);
      for (let i = 0; i < n; i++) {
        const gx = x + Math.floor(G.hash(seed, r * 97 + i, 2) * w);
        const gy = py + 3 + Math.floor(G.hash(seed, r * 97 + i, 3) * Math.max(1, plankH - 5));
        const gl = 4 + Math.floor(G.hash(seed, r * 97 + i, 4) * 9);
        if (gy >= y + h || gy < y) continue;
        G.hline(ctx, gx, gy, Math.min(gl, x + w - gx), G.hash(seed, r * 97 + i, 5) < 0.3 ? 'wood3' : 'wood2');
      }
    }
  }

  // ---- cream wall with the quiet cross motif (same as the portrait backdrop) for the table close-up
  function drawWallMotif(ctx, x, y, w, h) {
    G.rect(ctx, x, y, w, h, 'wall');
    for (let j = -1; j * 24 < h + 24; j++) for (let i = -1; i * 24 < w + 24; i++) {
      const mx = x + i * 24 + ((j & 1) ? 12 : 0) + 6, my = y + j * 24 + 10;
      if (my - 1 < y || my + 1 >= y + h) continue;
      G.hline(ctx, mx - 1, my, 3, 'wallShade'); G.px(ctx, mx, my - 1, 'wallShade'); G.px(ctx, mx, my + 1, 'wallShade');
    }
    G.hline(ctx, x, y, w, 'wallShade');
  }

  // ---- big wall clock driven by the story clock, with a quiet real-time second hand (one tick per second)
  function bigClock(ctx, cx, cy, r, t) {
    const c = ST.clock(t);
    PR.drawClock(ctx, cx, cy, r, c.h, Math.floor(c.m) + (Math.floor(t) % 60) / 60, { big: true });
  }

  // ================================================================== S5a 81.0–86.0  WIDE morning
  // Pale room, nobody; narration (engine) 82–85.2; she walks in from the left toward the fridge; camera pans 32 -> 64.
  PSA.shots.S5a = function (ctx, t) {
    const cam = Math.round(G.lerp(L.wideCam, 64, G.smooth(G.span(t, 84.0, 86.0))));
    const env = morningEnv(t);
    RM.drawBack(ctx, cam, env);
    RM.drawTable(ctx, cam, env);
    // the girl: enters at 82.5 along the walking line (she is in front of the table: drawn after it)
    if (t >= WALK_T0) {
      const x = walkInX(t), y = walkInY(x);
      const walking = t < WALK_T1;
      GIRL.draw(ctx, x - cam, y, { dir: 'right', pose: walking ? 'walk' : 'stand', frame: walking ? walkFrame(t, WALK_T0) : BREATH(t),
                                   face: 'neutral', blink: BLINK(t) });
    }
    RM.drawFront(ctx, cam, env);
    PSA.light.apply(ctx, ST.light(t).state);
  };

  // ================================================================== S5b 86.0–92.0  MEDIUM FRIDGE
  // Beats (absolute): arrive 86.2 | reach 86.4, door opens 86.6–87.1 | plate travels fridge -> hand 87.15–87.65 | reachPlate 87.65–88.15
  // | carry, one step back 88.15–88.45 | door swings shut 88.4–89.0 | turns, walks left with the plate 88.5–91.1 (camera 64 -> 0
  // during 89.4–91.2) | lowers the plate onto the table 91.1–91.5 | stands looking at it.
  const B = {
    reach0: 86.4, doorOpen0: 86.6, doorOpen1: 87.1,
    travel0: 87.15, travel1: 87.65,
    reachPlate1: 88.15,
    stepBack1: 88.45,
    doorClose0: 88.4, doorClose1: 89.0,
    walk0: 88.5, walk1: 91.1,
    setDown0: 91.1, setDown1: 91.5
  };
  const SET_X = 114, SET_Y = L.marks.tableSide.y;          // feet position when she lowers the plate (plate lands on the table spot)
  const HAND_PLATE = { cx: FRIDGE_X + 12, cy: FRIDGE_Y - 41 }; // centre of the plate in the 'reachPlate' hand (facing right)

  function fridgeOpenAt(t) {
    if (t < B.doorClose0) return G.smooth(G.span(t, B.doorOpen0, B.doorOpen1));
    return 1 - G.smooth(G.span(t, B.doorClose0, B.doorClose1));
  }
  function s5bCam(t) { return Math.round(64 - 64 * G.smooth(G.span(t, 89.4, 91.2))); }

  PSA.shots.S5b = function (ctx, t) {
    const cam = s5bCam(t);
    const plateOut = t >= B.travel0;                                     // plate has left the shelf
    const onTable = t >= B.setDown1;
    const env = morningEnv(t, { fridgeOpen: fridgeOpenAt(t), plateInFridge: !plateOut, plateOnTable: onTable ? 'half' : null });
    RM.drawBack(ctx, cam, env);
    RM.drawTable(ctx, cam, env);

    // ---- the girl
    let o, x, y;
    if (t < WALK_T1) {                                                   // still arriving
      x = walkInX(t); y = walkInY(x);
      o = { dir: 'right', pose: 'walk', frame: walkFrame(t, WALK_T0), face: 'neutral' };
    } else if (t < B.reach0) {                                           // a breath in front of the fridge
      x = FRIDGE_X; y = FRIDGE_Y;
      o = { dir: 'right', pose: 'stand', frame: BREATH(t), face: 'neutral' };
    } else if (t < B.travel1) {                                          // hand on the handle, then into the fridge
      x = FRIDGE_X; y = FRIDGE_Y;
      o = { dir: 'right', pose: 'reach', face: 'neutral' };
    } else if (t < B.reachPlate1) {                                      // plate in the extended hand
      x = FRIDGE_X; y = FRIDGE_Y;
      o = { dir: 'right', pose: 'reachPlate', item: 'plateHalf', face: 'neutral' };
    } else if (t < B.walk0) {                                            // plate lowered to the carry hold, one step back
      x = Math.round(FRIDGE_X - 10 * G.span(t, B.reachPlate1, B.stepBack1)); y = FRIDGE_Y;
      const walking = t < B.stepBack1;
      o = { dir: 'right', pose: 'carry', item: 'plateHalf', walking: walking, frame: walking ? walkFrame(t, B.reachPlate1) : 0, face: 'neutral' };
    } else if (t < B.setDown0) {                                         // carries it left to the table
      const x0 = FRIDGE_X - 10;
      x = Math.round(G.lerp(x0, SET_X, G.span(t, B.walk0, B.walk1)));
      y = Math.round(G.lerp(FRIDGE_Y, SET_Y, G.span(x0 - x, 0, 40)));
      o = { dir: 'left', pose: 'carry', item: 'plateHalf', walking: true, frame: walkFrame(t, B.walk0), face: 'neutral' };
    } else if (t < B.setDown1) {                                         // lowers the plate onto the table
      x = SET_X; y = SET_Y;
      o = { dir: 'left', pose: 'carry', item: 'plateHalf', liftY: Math.round(3 * G.smooth(G.span(t, B.setDown0, B.setDown1))), face: 'neutral' };
    } else {                                                             // stands, looking at it
      x = SET_X; y = SET_Y;
      o = { dir: 'left', pose: 'stand', frame: BREATH(t), face: 'neutral' };
    }
    o.blink = BLINK(t);
    GIRL.draw(ctx, x - cam, y, o);

    // ---- the plate travelling from the middle shelf into her hand (drawn after her so it rides over the reaching arm)
    if (t >= B.travel0 && t < B.travel1) {
      const e = G.smooth(G.span(t, B.travel0, B.travel1));
      const px = Math.round(G.lerp(L.plateInFridge.cx, HAND_PLATE.cx, e));
      const py = Math.round(G.lerp(L.plateInFridge.cy, HAND_PLATE.cy, e));
      RM.drawPlateSmall(ctx, px - cam, py, { amount: 'half', steam: 0, t: t });
    }
    RM.drawFront(ctx, cam, env);
    PSA.light.apply(ctx, ST.light(t).state);
  };

  // ================================================================== S5c 92.0–96.0  CLOSE-UP PLATE (morning)
  // The table-corner composition (as S3a/S3d): wall + big clock upper-left, large window right, table planks across the lower
  // part, the SAME plate (amount 0.5, default seed) with the fork beside it. Nothing moves but the second hand.
  const TC = { tableY: 96, plate: { cx: 150, cy: 150 }, fork: { x: 306, y: 174 }, clock: { cx: 70, cy: 50, r: 30 }, win: { x: 250, y: 8, w: 110, h: 100 } };
  function drawTableCorner(ctx, t, plateAmount) {
    const li = ST.light(t);
    drawWallMotif(ctx, 0, 0, W, TC.tableY);
    bigClock(ctx, TC.clock.cx, TC.clock.cy, TC.clock.r, t);
    PR.drawWindowLarge(ctx, TC.win.x, TC.win.y, TC.win.w, TC.win.h, { sky: li.sky, phase: li.phase, t: t });
    // table: far edge line, then planks
    drawPlanks(ctx, 0, TC.tableY, W, H - TC.tableY, 24, 11);
    G.hline(ctx, 0, TC.tableY, W, 'wood4'); G.hline(ctx, 0, TC.tableY + 1, W, 'wood3');
    FD.drawPlateLarge(ctx, TC.plate.cx, TC.plate.cy, { amount: plateAmount, steam: 0, t: t });
    FD.drawForkLarge(ctx, TC.fork.x, TC.fork.y, { angle: 'flat', pasta: 0, t: t });
  }
  PSA.shots.S5c = function (ctx, t) {
    drawTableCorner(ctx, t, 0.5);
    PSA.light.apply(ctx, ST.light(t).state);
  };

  // ================================================================== S5d 96.0–101.0  CLOSE-UP PORTRAIT
  // look down at the plate 96.0–97.6 -> sniff frames 97.6–99.0 -> unsure from 99.0, "?" at 99.5. One blink (97.3).
  const PORTRAIT_CX = 192, PORTRAIT_TOP = 30;
  PSA.shots.S5d = function (ctx, t) {
    const li = ST.light(t);
    PT.drawBackdrop(ctx, { sky: li.sky, phase: li.phase, lampOn: false });
    let o;
    if (t < 97.6) o = { expr: 'look', lookDown: true };
    else if (t < 99.0) o = { expr: 'sniff', frame: Math.floor((t - 97.6) * 4) % 2 };
    else o = { expr: 'unsure' };
    o.blink = (t >= 97.3 && t < 97.42);
    PT.draw(ctx, PORTRAIT_CX, PORTRAIT_TOP, o);
    PSA.light.apply(ctx, li.state);
    TB.emote(ctx, PORTRAIT_CX + 34, PORTRAIT_TOP - 2, '?', t - 99.5);
  };

  // ================================================================== S5e 101.0–107.0  CLOSE-UP HAND + FORK
  // Plate low in the frame (cut by the bottom edge), table wood behind; her hand with the forkful rests at the plate rim
  // 101.0–101.6, rises toward the mouth (above the frame) with easeOut 101.6–104.5, then holds dead still (1 px twitch
  // every 0.5 s). The fist keeps x >= 284 while high so the sleeve always leaves the frame at the lower right.
  const HC = { plate: { cx: 180, cy: 190, amount: 0.45 }, hand0: { x: 284, y: 176 }, hand1: { x: 292, y: 60 }, rise0: 101.6, rise1: 104.5 };
  function handPos(t) {
    const e = G.easeOut(G.span(t, HC.rise0, HC.rise1));
    let x = Math.round(G.lerp(HC.hand0.x, HC.hand1.x, e)), y = Math.round(G.lerp(HC.hand0.y, HC.hand1.y, e));
    if (t >= HC.rise1 && ((t - HC.rise1) % 0.5) < 0.09) y += 1;        // the allowed 1 px tremble, twice a second
    return { x: x, y: y };
  }
  function drawHandComp(ctx, t) {
    drawPlanks(ctx, 0, 0, W, H, 30, 23);
    FD.drawPlateLarge(ctx, HC.plate.cx, HC.plate.cy, { amount: HC.plate.amount, steam: 0, t: t });
    const h = handPos(t);
    FD.drawHandForkLarge(ctx, h.x, h.y, { pasta: 1, t: t, frame: 0, grip: 'hold' });
    PSA.light.apply(ctx, ST.light(t).state);
  }
  PSA.shots.S5e = function (ctx, t) { drawHandComp(ctx, t); };

  // ================================================================== S5f 107.0–111.5  CHOICE MENU
  // Same frame held. Menu fades in 107.0–107.2; cursor appears at 0 (107.3), slides to 1 at 108.6, back to 0 at 110.0,
  // then drifts to 0.4 (between the options) from 110.8 and stays there. Hard cut to black is the engine's.
  const MENU = { x: 20, y: 160, w: 344, h: 40, options: ['Eat it', 'Throw it out'] };
  function cursorAt(t) {
    if (t < 107.3) return null;
    const slide = 0.18;
    if (t < 108.6) return 0;
    if (t < 110.0) return G.smooth(G.span(t, 108.6, 108.6 + slide));                 // 0 -> 1
    if (t < 110.8) return 1 - G.smooth(G.span(t, 110.0, 110.0 + slide));             // 1 -> 0
    return 0.4 * G.smooth(G.span(t, 110.8, 110.8 + 0.3));                             // 0 -> 0.4, undecided
  }
  PSA.shots.S5f = function (ctx, t) {
    drawHandComp(ctx, Math.max(t, HC.rise1 + 0.01));
    const alpha = G.span(t, 107.0, 107.2);
    if (alpha <= 0) return;
    const cur = cursorAt(t);
    TB.choice(ctx, { x: MENU.x, y: MENU.y, w: MENU.w, h: MENU.h, options: MENU.options, cursor: cur == null ? undefined : cur, alpha: alpha });
  };

  // ================================================================== SFX
  const a = TL.byId('S5a'), b = TL.byId('S5b'), c = TL.byId('S5c'), d = TL.byId('S5d'), e = TL.byId('S5e'), f = TL.byId('S5f');
  a.sfx = footsteps(WALK_T0, a.end, a.start);
  b.sfx = [].concat(
    footsteps(b.start, WALK_T1, b.start),
    [{ t: +(B.doorOpen0 + 0.1 - b.start).toFixed(2), name: 'fridgeOpen', args: {} },
     { t: +(B.doorOpen0 + 0.2 - b.start).toFixed(2), name: 'fridgeHum', args: { dur: +(B.doorClose1 - B.doorOpen0 - 0.1).toFixed(2) } },
     { t: +(B.doorClose1 - b.start).toFixed(2), name: 'fridgeClose', args: {} }],
    footsteps(B.reachPlate1, B.stepBack1, b.start),
    footsteps(B.walk0, B.walk1, b.start),
    [{ t: +(B.setDown1 - b.start).toFixed(2), name: 'plateSet', args: {} }]
  ).sort((p, q) => p.t - q.t);
  c.sfx = [{ t: 0.5, name: 'swell', args: { dur: 4, soft: true } }];
  d.sfx = [{ t: 3.5, name: 'question', args: {} }];
  e.sfx = [{ t: 0.6, name: 'forkPick', args: {} }];
  f.sfx = [{ t: 1.6, name: 'menuMove', args: {} }, { t: 3.0, name: 'menuMove', args: {} }];
})(window.PSA);
