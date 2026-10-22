// SCENE 4 — SHE PUTS IT AWAY (S4a 69.0–74.5, S4b 74.5–81.0). Late night, cool light.
// S4a: dark room -> lamp click -> sleepy girl walks in, yawns, notices the plate ("!"), walks to the table and picks
//      the plate up (the plate leaves the table and appears in her hands) while the camera pans 32 -> 64 toward the fridge.
// S4b: cam 48 -> 64 then holds. She walks to the fridge, the door opens (fridge light + hum), the plate travels from her hands onto the
//      middle shelf, the door closes, she walks off left, the lamp goes off (story.light) and the engine fades to black.
// Every render function is a pure function of time; local time is clamped so crossfade/cut neighbours look right.
(function (PSA) {
  const G = PSA.gfx, L = PSA.LAYOUT, ST = PSA.story, TL = PSA.timeline, R = PSA.room, GIRL = PSA.girl, TB = PSA.textbox;

  // ------------------------------------------------------------------ shared constants
  const WALK_Y = L.marks.walkY;          // 166: walking line in front of the table
  const SPEED = 32;                      // px/s while walking (8 px per step at 4 steps/s: calm, no sliding)
  const STEP_DT = 0.25;                  // one footstep per contact frame of the 8 fps / 4-frame cycle

  // --- S4a beats (absolute seconds)
  const A = {
    lampOn: 69.6,                        // lamp click (story.light switches lampOn at 69.6) + 0.1 s warm flash
    in0: 69.6, in1: 70.6, xIn0: 28, xIn1: 60,      // she walks in from the left doorway (32 px / 1.0 s)
    yawn0: 70.6, yawn1: 71.3,            // yawn beat (stops walking)
    notice: 71.3, noticeEnd: 71.95,      // "!" emote + sfx, she stands and looks at the plate
    walk0: 71.85, walk1: 73.3, xTable: 107,        // walks to the table (47 px / 1.45 s)
    reach0: 73.3,                        // turns left, reaches down to the plate (hand on the plate)
    lift0: 73.55, lift1: 74.05,          // the plate leaves the table and rises in her hands
    front0: 74.05, right0: 74.25,        // turns toward the fridge holding the plate (stays until the cut)
    pan0: 71.9, pan1: 73.3, camEnd: 48   // camera 32 -> 48 (11 px/s) following her walk; S4b continues 48 -> 64
  };
  // --- S4b beats (absolute seconds). The cut at 74.5 carries a small time ellipsis (see notes in the report).
  const B = {
    xStart: 318, xFridge: 358,           // 2 px right of L.marks.fridge so the held plate meets the fridge opening
    walk0: 74.5, walk1: 75.75,           // 40 px / 1.25 s
    pan0: 74.5, pan1: 75.9, cam0: 48, cam1: 64,    // camera follows her to the fridge (11 px/s), then holds at 64
    reach0: 75.75,                       // hand up to the door handle
    door0: 76.0, door1: 76.6,            // door swings open (fridgeOpen 0 -> 1)
    plateUp: 76.6,                       // 'reachPlate': the plate is lifted to shelf height at the opening
    travel0: 76.9, travel1: 77.7,        // the plate travels from her hands onto the middle shelf
    lean: 2,                             // she leans/steps 2 px in while pushing the plate
    handOut: 78.0,                       // arm comes down ('stand')
    close0: 78.1, close1: 78.8,          // door closes (fridgeOpen 1 -> 0)
    turn0: 79.0, walkL0: 79.25,          // turns (front) then walks off to the left
    lampOff: 80.0                        // lamp click; story.light switches lampOn off at 80.0
  };

  // ------------------------------------------------------------------ helpers
  function walkFrame(t, t0) { return Math.floor(Math.max(0, t - t0) * 8) % 4; }
  function idleFrame(t) { return Math.floor(t * 2) % 2; }
  function blinkAt(t) { return (t % 3.7) < 0.12; }
  function footsteps(t0, t1, soft) {   // one footstep per contact frame while moving (t absolute -> shot-relative later)
    const ev = [];
    for (let s = t0; s < t1 - 1e-6; s += STEP_DT) ev.push({ t: s, name: 'footstep', args: { soft: !!soft } });
    return ev;
  }
  function rel(shotStart, events) { return events.map((e) => ({ t: +(e.t - shotStart).toFixed(3), name: e.name, args: e.args })); }

  // Room env for time t (sky / lamp from story, clock via env.t); overrides for the plate / fridge state.
  function envAt(t, o) {
    const li = ST.light(t);
    return Object.assign({
      t: t, sky: li.sky, phase: li.phase, lampOn: li.lampOn,
      potOnStove: true, potBoiling: 0, fridgeOpen: 0, plateInFridge: false,
      plateOnTable: 'half', plateSteam: 0, forkOnTable: true
    }, o || {});
  }
  // Story light + the 2-frame warm flash when the lamp clicks on
  function applyLight(ctx, t) {
    let state = ST.light(t).state;
    if (t >= A.lampOn && t < A.lampOn + 0.1) state = Object.assign({}, state, { warm: (state.warm || 0) + 0.3 });
    PSA.light.apply(ctx, state);
  }

  // The leftover plate (half), side view, same pixels as the one the girl holds (14x8) — used while it travels from her
  // hands into the fridge so it does not change size at the hand-off. Anchored at its BOTTOM-CENTER.
  const PLATE_HELD = PSA.sprite.make([
    '..............',
    '..............',
    '.....o4ao.....',
    '....o12a2o....',
    'opppo2223opppo',
    'orPPPPPPPPPPro',
    '.oqqqqqqqqqqo.',
    '..oooooooooo..'
  ], { o: 'ink', p: 'plate1', P: 'plate2', q: 'plate3', r: 'plateRim', '1': 'pasta1', '2': 'pasta2', '3': 'pasta3', '4': 'pasta4', a: 'sauce1', A: 'sauce2' });
  function drawHeldPlateAt(ctx, bcx, bcy) { PSA.sprite.draw(ctx, PLATE_HELD, (bcx | 0) - 7, (bcy | 0) - 8); }

  // ================================================================== S4a — WIDE -> MEDIUM: lamp on, enter, notice, pick up
  PSA.shots.S4a = function (ctx, t, lt) {
    t = G.clamp(t, 68.0, 74.5 + 0.5);                                   // tolerate the crossfade in / cut out
    const cam = Math.round(G.lerp(L.wideCam, A.camEnd, G.smooth(G.span(t, A.pan0, A.pan1))));

    // --- girl state (world coords) for this moment
    let g = null;                                                       // {x, y, opts} or null (not in the room yet)
    const plateHeld = t >= A.lift0;                                     // the plate leaves the table at lift0
    if (t >= A.in0) {
      const face = t < A.notice ? 'sleepy' : 'neutral';
      const blink = blinkAt(t);
      if (t < A.in1) {                                                  // beat: walks in from the left, sleepy
        const x = Math.round(G.lerp(A.xIn0, A.xIn1, G.span(t, A.in0, A.in1)));
        g = { x: x, y: WALK_Y, opts: { pose: 'walk', dir: 'right', frame: walkFrame(t, A.in0), face: face, blink: blink } };
      } else if (t < A.yawn1) {                                         // beat: stops and yawns (hand to mouth)
        g = { x: A.xIn1, y: WALK_Y, opts: { pose: 'yawn', dir: 'right', face: 'sleepy' } };
      } else if (t < A.walk0) {                                         // beat: "!" — she sees the plate on the table
        g = { x: A.xIn1, y: WALK_Y, opts: { pose: 'stand', dir: 'right', frame: idleFrame(t), face: 'neutral', blink: blink } };
      } else if (t < A.walk1) {                                         // beat: walks to the table
        const x = Math.round(G.lerp(A.xIn1, A.xTable, G.span(t, A.walk0, A.walk1)));
        g = { x: x, y: WALK_Y, opts: { pose: 'walk', dir: 'right', frame: walkFrame(t, A.walk0), face: 'neutral', blink: blink } };
      } else if (t < A.lift0) {                                         // beat: turns to the plate, hand reaches onto it
        g = { x: A.xTable, y: WALK_Y, opts: { pose: 'reach', dir: 'left', face: 'neutral', blink: blink } };
      } else if (t < A.front0) {                                        // beat: lifts the plate off the table (liftY 6 -> -2)
        const lift = Math.round(G.lerp(6, -2, G.easeOut(G.span(t, A.lift0, A.lift1))));
        g = { x: A.xTable, y: WALK_Y, opts: { pose: 'reachPlate', dir: 'left', item: 'plateHalf', liftY: lift, face: 'neutral', blink: blink } };
      } else if (t < A.right0) {                                        // beat: turns, plate held in both hands
        g = { x: A.xTable, y: WALK_Y, opts: { pose: 'carry', dir: 'front', item: 'plateHalf', face: 'neutral', blink: blink } };
      } else {                                                          // beat: faces the fridge (camera has revealed it)
        g = { x: A.xTable, y: WALK_Y, opts: { pose: 'carry', dir: 'right', item: 'plateHalf', frame: idleFrame(t), face: 'neutral', blink: blink } };
      }
    }

    // --- world
    const env = envAt(t, { plateOnTable: plateHeld ? null : 'half', forkOnTable: true });
    R.drawBack(ctx, cam, env);
    R.drawTable(ctx, cam, env);                                         // she is always in front of the table here (y 166 > 146)
    if (g) GIRL.draw(ctx, g.x - cam, g.y, g.opts);
    R.drawFront(ctx, cam, env);
    applyLight(ctx, t);

    // --- UI: the "!" emote above her head while she stands and looks at the plate
    if (g && t >= A.notice && t < A.noticeEnd) {
      const headTop = g.y + GIRL.headTop(g.opts);
      TB.emote(ctx, g.x - cam + 2, headTop - 1, '!', t - A.notice);
    }
  };

  // ================================================================== S4b — MEDIUM FRIDGE: door, plate in, door, off, lamp off
  PSA.shots.S4b = function (ctx, t, lt) {
    t = G.clamp(t, 74.5, 81.0 + 0.5);
    const cam = Math.round(G.lerp(B.cam0, B.cam1, G.smooth(G.span(t, B.pan0, B.pan1))));

    // --- fridge door 0..1 (opens door0..door1, closes close0..close1)
    let open = 0;
    if (t >= B.door0 && t < B.close0) open = G.span(t, B.door0, B.door1);
    else if (t >= B.close0) open = 1 - G.span(t, B.close0, B.close1);

    // --- plate: in her hands until travel0, travelling until travel1, then on the fridge shelf
    const travelling = t >= B.travel0 && t < B.travel1;
    const inFridge = t >= B.travel1;
    const held = t < B.travel0;

    // --- girl state (world coords)
    let g;
    const blink = blinkAt(t);
    const xLean = B.xFridge + (t >= B.travel0 ? B.lean : 0);           // small step in while she pushes the plate
    if (t < B.walk1) {                                                  // beat: arrives at the fridge with the plate
      const x = Math.round(G.lerp(B.xStart, B.xFridge, G.span(t, B.walk0, B.walk1)));
      g = { x: x, y: L.marks.fridge.y, opts: { pose: 'carry', dir: 'right', walking: true, frame: walkFrame(t, B.walk0), item: 'plateHalf', face: 'neutral', blink: blink } };
    } else if (t < B.plateUp) {                                         // beat: reaches up to the handle, the door opens
      g = { x: B.xFridge, y: L.marks.fridge.y, opts: { pose: 'reach', dir: 'right', face: 'neutral', blink: blink } };
    } else if (t < B.travel0) {                                         // beat: lifts the plate to shelf height at the opening
      g = { x: B.xFridge, y: L.marks.fridge.y, opts: { pose: 'reachPlate', dir: 'right', item: 'plateHalf', face: 'neutral', blink: blink } };
    } else if (t < B.handOut) {                                         // beat: pushes the plate in (arm stays extended)
      g = { x: xLean, y: L.marks.fridge.y, opts: { pose: 'reach', dir: 'right', face: 'neutral', blink: blink } };
    } else if (t < B.turn0) {                                           // beat: arm down, the door closes
      g = { x: xLean, y: L.marks.fridge.y, opts: { pose: 'stand', dir: 'right', frame: idleFrame(t), face: 'neutral', blink: blink } };
    } else if (t < B.walkL0) {                                          // beat: turns
      g = { x: xLean, y: L.marks.fridge.y, opts: { pose: 'stand', dir: 'front', face: 'neutral', blink: blink } };
    } else {                                                            // beat: walks off to the left (into the dark after 80.0)
      const x = Math.round(xLean - SPEED * (t - B.walkL0));
      g = { x: x, y: L.marks.fridge.y, opts: { pose: 'walk', dir: 'left', frame: walkFrame(t, B.walkL0), face: 'sleepy', blink: blink } };
    }

    // --- world
    const env = envAt(t, { plateOnTable: null, forkOnTable: true, fridgeOpen: open, plateInFridge: inFridge });
    R.drawBack(ctx, cam, env);
    R.drawTable(ctx, cam, env);
    GIRL.draw(ctx, g.x - cam, g.y, g.opts);
    if (travelling) {
      // bottom-center of the held plate in 'reachPlate' (dir right): feet + (12, -38) (girl.js: hand (11,-39), plate
      // top-left at hand - (6,7), 14x8 px) at her leaned position; the fridge plate's bottom-center is
      // (L.plateInFridge.cx, cy + 4). Ease in-out; the plate keeps its 14 px form for the first half and becomes the
      // room's 18 px plate for the second half (the swap happens mid-motion, where it is least visible).
      const p = G.smooth(G.span(t, B.travel0, B.travel1));
      const x0 = xLean + 12, y0 = L.marks.fridge.y - 38;
      const x1 = L.plateInFridge.cx, y1 = L.plateInFridge.cy + 4;
      const bx = Math.round(G.lerp(x0, x1, p)) - cam, by = Math.round(G.lerp(y0, y1, p));
      if (p < 0.5) drawHeldPlateAt(ctx, bx, by);
      else R.drawPlateSmall(ctx, bx, by - 4, { amount: 'half', steam: 0, t: t });
    }
    R.drawFront(ctx, cam, env);
    applyLight(ctx, t);
  };

  // ================================================================== SFX
  const a = TL.byId('S4a');
  a.sfx = rel(a.start, [].concat(
    [{ t: A.lampOn, name: 'lightSwitch', args: {} }],
    footsteps(A.in0, A.in1, true),
    [{ t: A.yawn0 + 0.05, name: 'yawn', args: {} }],
    [{ t: A.notice, name: 'notice', args: {} }],
    footsteps(A.walk0, A.walk1, true)
  ));
  const b = TL.byId('S4b');
  b.sfx = rel(b.start, [].concat(
    footsteps(B.walk0, B.walk1, true),
    [{ t: B.door0, name: 'fridgeOpen', args: {} }],
    [{ t: B.door0 + 0.1, name: 'fridgeHum', args: { dur: +(B.close1 - B.door0 - 0.1).toFixed(2) } }],
    [{ t: B.close1 - 0.1, name: 'fridgeClose', args: {} }],
    footsteps(B.walkL0, 81.0, true),
    [{ t: B.lampOff, name: 'lightSwitch', args: {} }]
  ));
})(window.PSA);
