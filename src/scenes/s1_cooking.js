// SCENE 1 — COOKING (0:00–0:25), warm and cozy. Shots S1a..S1e (see docs/SCENES.md).
//   S1a WIDE   : the kitchen at 6:30 PM, the girl stirring at the stove; fade in from black + title overlay.
//   S1b..S1d   : one continuous close-up composition of the big pot on the cooktop (tiles behind, counter at the edges):
//                boiling -> spaghetti lowered in by her hand -> stirred with the wooden spoon.
//   S1e        : close-up of the counter: the plate is filled from a fork (twice), sauce ladled on, steam; dish finished.
// Every render function is a pure function of time (the engine may call it slightly before/after the shot for crossfades).
(function (PSA) {
  const G = PSA.gfx, F = PSA.font, P = PSA.props, FD = PSA.food, ST = PSA.story, TL = PSA.timeline, L = PSA.LAYOUT;
  const W = PSA.W, H = PSA.H;
  const R = Math.round;

  // ------------------------------------------------------------------ shared constants
  const PLATE_SEED = 0;                     // the ONE plate of the film (keep the default seed so every scene agrees)
  // Close-up stove composition (S1b..S1d): tiles above y=104, cooktop below, pot centered at x=192 standing on the burner.
  const CU = { tilesH: 104, counterL: 40, counterR: 66, potCx: 192, potBottom: 160, burner: { cx: 192, cy: 162, rx: 62, ry: 7 } };
  CU.rimY = CU.potBottom - 76;              // rim centre line of the pot (props.POT rimY = -76)
  CU.waterY = CU.rimY + 1;                  // water surface centre line (85)
  CU.steamBase = CU.rimY - 4;

  // ------------------------------------------------------------------ helpers
  // Draw inside an integer rectangle only (used to sink things "into" the water).
  function withClip(ctx, x, y, w, h, fn) {
    ctx.save(); ctx.beginPath(); ctx.rect(x | 0, y | 0, w | 0, h | 0); ctx.clip(); fn(); ctx.restore();
  }
  // Draw everywhere EXCEPT inside an integer rectangle (even-odd clip hole).
  function withHole(ctx, x, y, w, h, fn) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(x | 0, y | 0, w | 0, h | 0); ctx.clip('evenodd'); fn(); ctx.restore();
  }
  // The girl's bare fist seen from above with the sleeve running up-right (for gripping the spoon / ladle handle).
  // food.js has no "hand holding a spoon" drawing, so we reuse the bundle hand and hide its spaghetti: the hanging
  // strands get length 1 (hidden under the fist) and the stub above the fist is cut away with a clip hole.
  // (x, y) = bottom-centre of the fist.
  function drawFist(ctx, x, y, frame) {
    x |= 0; y |= 0;
    withHole(ctx, x - 8, y - 44, 17, 11, () => FD.drawHandBundle(ctx, x, y, { spread: 0, frame: frame | 0, len: 1, sink: 0 }));
  }
  // A big glass jar of tomato sauce (context prop at the edge of the close-ups). (cx, bottomY) = bottom centre.
  function drawJar(ctx, cx, bottomY) {
    cx |= 0; bottomY |= 0;
    const w = 28, h = 38, x = cx - (w >> 1), y = bottomY - h;
    G.rect(ctx, x - 1, y + 6, w + 2, h - 6, 'ink');                // outline
    G.rect(ctx, x, y + 7, w, h - 8, 'fridgeIn2');                   // glass
    G.rect(ctx, x + 1, y + 12, w - 2, h - 15, 'sauce2');            // sauce inside
    G.rect(ctx, x + 2, y + 12, 4, h - 15, 'sauce1');                // glossy highlight (light from the upper-left)
    G.rect(ctx, x + w - 5, y + 13, 4, h - 16, 'sauce3');            // shade on the right
    G.hline(ctx, x + 1, y + 11, w - 2, 'sauce1');                   // sauce surface
    G.rect(ctx, x + 1, y + 7, w - 2, 4, 'fridgeIn1');               // air gap under the lid
    G.vline(ctx, x + 1, y + 7, h - 8, 'fridgeIn1');                 // glass edge highlight
    G.vline(ctx, x + w - 2, y + 8, h - 9, 'fridgeIn3');
    G.hline(ctx, x + 1, bottomY - 2, w - 2, 'sauce3');              // dark bottom of the sauce
    // label with a basil leaf and a tomato dot
    G.rect(ctx, x + 8, y + 22, 12, 9, 'plate1'); G.box(ctx, x + 8, y + 22, 12, 9, 'plate3');
    G.rect(ctx, x + 11, y + 25, 3, 3, 'sauce2'); G.px(ctx, x + 11, y + 25, 'sauce1');
    G.rect(ctx, x + 15, y + 24, 2, 2, 'basil'); G.px(ctx, x + 16, y + 26, 'basil2');
    // wooden lid
    G.rect(ctx, x - 2, y, w + 4, 7, 'ink');
    G.rect(ctx, x - 1, y + 1, w + 2, 5, 'wood3');
    G.hline(ctx, x - 1, y + 1, w + 2, 'wood2'); G.hline(ctx, x, y + 1, 10, 'wood1');
    G.hline(ctx, x - 1, y + 5, w + 2, 'wood4');
    // shadow on the counter under the jar
    G.dither(ctx, x - 1, bottomY, w + 4, 2, 'counter2', 0.5, 0);
  }
  // The plate base exactly as food.drawPlateLarge draws it (no leftovers smear), so the plate can be filled from empty.
  // Once the serving is complete the scene uses food.drawPlateLarge itself, so the finished plate is pixel-identical
  // to the one every later scene draws.
  const PLATE_RX = 74, PLATE_RY = 44;
  function drawPlateClean(ctx, cx, cy) {
    const rx = PLATE_RX, ry = PLATE_RY, E = G.ellipse;
    E(ctx, cx, cy + 4, rx + 1, ry + 1, 'ink');
    E(ctx, cx, cy + 4, rx, ry, 'plate3');
    E(ctx, cx, cy, rx + 1, ry + 1, 'ink');
    E(ctx, cx, cy, rx, ry, 'plate2');
    E(ctx, cx - 1, cy - 1, rx - 2, ry - 2, 'plate1');
    E(ctx, cx, cy, rx - 9, ry - 6, 'plateRim');
    E(ctx, cx, cy, rx - 10, ry - 7, 'plate1');
    E(ctx, cx, cy, rx - 16, ry - 11, 'plate2');
    E(ctx, cx, cy + 2, rx - 17, ry - 12, 'plate1');
  }
  function drawServingPlate(ctx, cx, cy, amount, sauce, steam, t) {
    if (amount >= 0.999) { FD.drawPlateLarge(ctx, cx, cy, { amount: 1, sauce: sauce, steam: steam, t: t, seed: PLATE_SEED }); return; }
    drawPlateClean(ctx, cx, cy);
    if (amount > 0.02) FD.drawPastaMound(ctx, cx, cy + 3, 96, 50, { amount: amount, sauce: sauce, seed: PLATE_SEED, lift: 18 });
  }
  // The wooden cutting board leaning against the tiles (as in the room, left of the stove). (x, bottomY) = bottom-left.
  function drawBoard(ctx, x, bottomY) {
    const w = 30, h = 46, y = bottomY - h;
    G.rect(ctx, x - 1, y - 1, w + 2, h + 2, 'wood4');
    G.rect(ctx, x, y, w, h, 'wood1');
    G.rect(ctx, x + 2, y + 2, w - 4, h - 4, 'wood2');
    G.rect(ctx, x + 3, y + 3, w - 6, h - 6, 'wood1');
    for (let gx = x + 6; gx < x + w - 4; gx += 7) G.vline(ctx, gx, y + 5, h - 10, 'wood2');   // grain
    G.vline(ctx, x + 1, y + 1, h - 2, 'counter1');                                          // lit edge
    G.rect(ctx, x + (w >> 1) - 2, y + 4, 4, 3, 'wood4'); G.hline(ctx, x + (w >> 1) - 1, y + 5, 2, 'wallShade'); // hanging hole
    G.hline(ctx, x - 1, bottomY + 1, w + 2, 'counter2');                                    // shadow on the counter
  }
  // Shared backdrop of the pot close-ups: tiles, counter at both edges (board left, sauce jar right, like the room),
  // cooktop + burner + flame. The right strip is wide enough that the cooktop's back burner stays out of frame.
  function drawStoveBackdrop(ctx, t) {
    P.drawTileWall(ctx, 0, 0, W, CU.tilesH);
    const cl = CU.counterL, cr = CU.counterR;
    P.drawCounterCloseup(ctx, { x: 0, y: CU.tilesH, w: cl, h: H - CU.tilesH });
    P.drawCounterCloseup(ctx, { x: W - cr, y: CU.tilesH, w: cr, h: H - CU.tilesH });
    drawBoard(ctx, 5, CU.tilesH + 26);
    drawJar(ctx, W - cr + 32, CU.tilesH + 34);
    P.drawStoveCloseup(ctx, { t: t, flame: 1, x: cl, y: CU.tilesH, w: W - cl - cr, h: H - CU.tilesH, burner: CU.burner });
  }
  // The big pot on the burner + the front flame tongues licking its lower edge.
  function drawPot(ctx, t, opts) {
    P.drawPotLarge(ctx, CU.potCx, CU.potBottom, Object.assign({ t: t }, opts));
    P.drawFlames(ctx, { t: t, flame: 1, burner: CU.burner });
  }
  function drawPotSteam(ctx, t, intensity) {
    P.drawSteam(ctx, CU.potCx, CU.steamBase, t, { intensity: intensity, width: 72, height: 86, seed: 1 });
  }
  function applyLight(ctx, t) { PSA.light.apply(ctx, ST.light(t).state); }

  // ================================================================== S1a — WIDE (0.0–9.5)
  const TITLE_IN0 = 1.2, TITLE_IN1 = 1.6, TITLE_OUT0 = 4.0, TITLE_OUT1 = 4.6;
  function titleAlpha(lt) {
    if (lt < TITLE_IN0 || lt > TITLE_OUT1) return 0;
    if (lt < TITLE_IN1) return G.span(lt, TITLE_IN0, TITLE_IN1);
    if (lt > TITLE_OUT0) return 1 - G.span(lt, TITLE_OUT0, TITLE_OUT1);
    return 1;
  }
  PSA.shots.S1a = function (ctx, t, lt) {
    const light = ST.light(t);
    const cam = L.wideCam;
    const env = { t: t, sky: light.sky, phase: light.phase, lampOn: light.lampOn, potOnStove: true, potBoiling: 1,
                  fridgeOpen: 0, plateInFridge: false, plateOnTable: null, plateSteam: 0, forkOnTable: false };
    // beat: the room, 6:30 PM (clock from story), sunset in the window, the lamp on
    PSA.room.drawBack(ctx, cam, env);
    PSA.room.drawTable(ctx, cam, env);
    // beat: the girl at the stove, stirring (2 frames at 3 fps), smiling, blinking now and then
    const m = L.marks.stove;
    PSA.girl.draw(ctx, m.x - cam, m.y, { dir: 'right', pose: 'stir', frame: Math.floor(t * 3) % 2, face: 'smile', blink: (t % 3.7) < 0.12 });
    PSA.room.drawFront(ctx, cam, env);
    applyLight(ctx, t);
    // beat: title overlay on a dark band (keeps it clear of the lamp and cabinets), 1.2–4.6 s with alpha fades
    const ta = titleAlpha(lt);
    if (ta > 0) {
      ctx.save(); ctx.globalAlpha = ta; G.rect(ctx, 0, 14, W, 32, 'black'); ctx.restore();
      F.text(ctx, ST.TITLE, W >> 1, 22, { scale: 2, align: 'center', color: 'uiText', shadow: 'ink', alpha: ta });
    }
    // beat: fade in from black over the first 1.5 s (last thing drawn)
    PSA.light.black(ctx, 1 - G.smooth(lt / 1.5));
  };

  // ================================================================== S1b — CLOSE-UP POT (9.5–13.0)
  PSA.shots.S1b = function (ctx, t, lt) {
    drawStoveBackdrop(ctx, t);
    // beat: the pot at a rolling boil, bubbles and foam, steam rising to the top of the frame
    drawPot(ctx, t, { boiling: 1, pasta: 0, stir: 0 });
    drawPotSteam(ctx, t, 1);
    applyLight(ctx, t);
  };

  // ================================================================== S1c — PASTA IN (13.0–16.5)
  // Hand with the dry bundle enters top-right, lowers to the water (0–1.6), the bundle fans and sinks (1.6–2.8),
  // the hand lets go and withdraws (2.8–3.5) while the strands slide under the surface.
  const C_IN1 = 1.6, C_SINK1 = 2.8, C_OUT1 = 3.5;
  const C_HAND = { x: 196, y: 36 }, C_HAND_OFF = { x: 326, y: -62 }, C_LEN = 60;
  PSA.shots.S1c = function (ctx, t, lt) {
    const u = G.clamp(lt, 0, 3.5);
    const spread = G.smooth(G.span(u, C_IN1, C_IN1 + 0.7));
    const sink = G.span(u, C_IN1, C_SINK1);
    const pasta = 0.6 * G.smooth(sink);
    drawStoveBackdrop(ctx, t);
    drawPot(ctx, t, { boiling: 0.9, pasta: pasta, stir: 0 });
    drawPotSteam(ctx, t, 0.7);                      // steam behind the hand (keeps the action readable)
    const clipH = CU.waterY + 1;                    // everything below the water line is "in the pot"
    if (u < C_SINK1) {
      // beat: hand + bundle coming in, then dipping a little further as the strands sink
      const k = G.smooth(G.span(u, 0, C_IN1));
      const hx = R(G.lerp(C_HAND_OFF.x, C_HAND.x, k)), hy = R(G.lerp(C_HAND_OFF.y, C_HAND.y, k)) + R(8 * sink);
      const frame = u > C_IN1 ? Math.floor(u * 4) & 1 : 0;   // fingers loosen while the bundle spreads
      withClip(ctx, 0, 0, W, clipH, () => FD.drawHandBundle(ctx, hx, hy, { spread: spread, frame: frame, len: C_LEN, sink: sink }));
    } else {
      // beat: the strands are let go and keep sliding into the water; the empty hand withdraws up-right
      const k = G.smooth(G.span(u, C_SINK1, C_OUT1));
      const sy = C_HAND.y + 8 + R(k * 34);
      withClip(ctx, 0, 0, W, clipH, () => FD.drawDryPasta(ctx, C_HAND.x, sy, { spread: 1, len: C_LEN, sink: 1 }));
      const hx = R(G.lerp(C_HAND.x, C_HAND_OFF.x, k)), hy = R(G.lerp(C_HAND.y + 8, C_HAND_OFF.y, k));
      drawFist(ctx, hx, hy, 1);
    }
    applyLight(ctx, t);
  };

  // ================================================================== S1d — STIR (16.5–20.0)
  // The wooden spoon (held by her hand) slides in from the right (0–0.6), dips into the pot and stirs in slow circles;
  // the water swirls with it (pot.stir), strands follow.
  const D_IN1 = 0.6, D_STIR0 = 0.7;
  PSA.shots.S1d = function (ctx, t, lt) {
    const u = G.clamp(lt, 0, 3.5);
    const tp = lt - D_STIR0;                              // pot time: the swirl angle (stir*t*1.8) starts at 0 when stirring begins
    const stir = G.span(u, D_STIR0, 1.5);
    drawStoveBackdrop(ctx, t);
    drawPot(ctx, t, { boiling: 0.8, pasta: 1, stir: stir, t: tp });
    // spoon bowl path: an ellipse on the water surface, same angular speed as the water swirl
    const phi = Math.max(0, u - D_STIR0) * 1.8;
    const enter = 1 - G.smooth(G.span(u, 0, D_IN1));
    const waterY = CU.waterY + R(Math.sin(phi) * 3);
    const sx = CU.potCx + R(Math.cos(phi) * 36) + R(enter * 190);
    const sy = waterY + 7 - R(enter * 46);
    // beat: the spoon, its bowl under the surface (clipped at the water line), foam around the shaft
    withClip(ctx, 0, 0, W, waterY + 1, () => FD.drawSpoonLarge(ctx, sx, sy, { angle: 'diag' }));
    if (enter < 0.05) {
      const f = Math.floor(t * 6) & 1;
      G.hline(ctx, sx - 9 - f, waterY, 5, 'water1'); G.hline(ctx, sx + 6 + f, waterY, 5, 'water1');
      G.px(ctx, sx - 4, waterY - 1, 'water1'); G.px(ctx, sx + 5, waterY - 1, 'water1');
    }
    // beat: her hand gripping the handle's end (handle runs up-right from the bowl)
    drawFist(ctx, sx + 42, sy - 52, 0);
    drawPotSteam(ctx, t, 0.9);
    applyLight(ctx, t);
  };

  // ================================================================== S1e — SERVE (20.0–25.0)
  // Counter close-up: the plate is filled by the fork (two passes, 0–2.5), the ladle pours the sauce (2.5–4.6),
  // then steam rises from the finished dish.
  const PLATE = { cx: 220, cy: 150 };
  const E_FIST = { x: 262, y: 158 }, E_FIST_OFF = { x: 344, y: 266 };
  const E_PASS = [ { in0: 0.0, in1: 0.5, drop0: 0.6, drop1: 1.0, out0: 1.0, out1: 1.35 },
                   { in0: 1.35, in1: 1.75, drop0: 1.75, drop1: 2.0, out0: 2.05, out1: 2.5 } ];
  const E_LADLE = { in0: 2.5, in1: 2.9, pour0: 2.9, pour1: 3.3, hold1: 3.9, stop1: 4.2, out0: 4.2, out1: 4.6 };
  const LADLE_AT = { x: 228, y: 78 }, LADLE_OFF = { x: 336, y: -46 };
  PSA.shots.S1e = function (ctx, t, lt) {
    const u = G.clamp(lt, 0, 5);
    // amount: each pass adds half a serving while the fork releases its twirl
    let amount = 0;
    for (const p of E_PASS) amount += 0.5 * G.smooth(G.span(u, p.drop0, p.drop1));
    const sauce = G.span(u, 3.0, 4.0);
    const steam = G.span(u, 4.0, 5.0);
    // backdrop: tiles, counter top with the sauce jar at the back-left
    P.drawTileWall(ctx, 0, 0, W, 72);
    P.drawCounterCloseup(ctx, { x: 0, y: 72, w: W, h: H - 72 });
    drawJar(ctx, 44, 100);
    // beat: the plate
    drawServingPlate(ctx, PLATE.cx, PLATE.cy, amount, sauce, steam, t);
    // beat: hand + fork with twirled pasta, in from the bottom-right, releases over the plate, out again (twice)
    for (const p of E_PASS) {
      if (u < p.in0 || u > p.out1) continue;
      let k;                                              // 0 = off-frame, 1 = over the plate
      if (u < p.in1) k = G.smooth(G.span(u, p.in0, p.in1));
      else if (u < p.out0) k = 1;
      else k = 1 - G.smooth(G.span(u, p.out0, p.out1));
      const dip = R(5 * Math.sin(Math.PI * G.span(u, p.drop0, p.drop1)));   // small dip while releasing
      const fx = R(G.lerp(E_FIST_OFF.x, E_FIST.x, k)), fy = R(G.lerp(E_FIST_OFF.y, E_FIST.y, k)) + dip;
      const pasta = u < p.drop0 ? 1 : 1 - G.span(u, p.drop0, p.drop1);
      FD.drawHandForkLarge(ctx, fx, fy, { pasta: pasta, t: t, frame: Math.floor(u * 3) & 1, grip: 'hold' });
    }
    // beat: the ladle comes from the top-right, tips and pours sauce onto the pasta, straightens and leaves
    if (u >= E_LADLE.in0 && u <= E_LADLE.out1) {
      let k;
      if (u < E_LADLE.in1) k = G.smooth(G.span(u, E_LADLE.in0, E_LADLE.in1));
      else if (u < E_LADLE.out0) k = 1;
      else k = 1 - G.smooth(G.span(u, E_LADLE.out0, E_LADLE.out1));
      let pour = 0;
      if (u < E_LADLE.hold1) pour = G.smooth(G.span(u, E_LADLE.pour0, E_LADLE.pour1));
      else pour = 1 - G.smooth(G.span(u, E_LADLE.hold1, E_LADLE.stop1));
      const lx = R(G.lerp(LADLE_OFF.x, LADLE_AT.x, k)), ly = R(G.lerp(LADLE_OFF.y, LADLE_AT.y, k));
      const kk = pour * 0.42;
      const lipY = ly - 4 + R(kk * 17);
      const moundTop = PLATE.cy + 3 - 25 - 18 + 4;          // top of the full mound (+ a little so the stream lands on it)
      P.drawSauceLadle(ctx, lx, ly, { pour: pour, t: t, streamLen: Math.max(4, moundTop - lipY) });
      // her hand on the handle (handle geometry mirrors props.drawSauceLadle)
      const ang = Math.PI * (0.27 + 0.2 * pour);
      const hx0 = lx + 16, hy0 = ly - 5 - R(kk * 16);
      drawFist(ctx, R(hx0 + Math.cos(ang) * 29), R(hy0 - Math.sin(ang) * 29), 0);
    }
    applyLight(ctx, t);
  };

  // ================================================================== SFX
  TL.byId('S1a').sfx = [ { t: 0.0, name: 'boil', args: { dur: 9.5, level: 0.5 } } ];
  TL.byId('S1b').sfx = [ { t: 0.0, name: 'boil', args: { dur: 3.6, level: 1 } } ];
  TL.byId('S1c').sfx = [ { t: 0.0, name: 'boil', args: { dur: 3.5, level: 0.8 } },
                         { t: 1.6, name: 'splash', args: {} } ];
  TL.byId('S1d').sfx = [ { t: 0.0, name: 'boil', args: { dur: 3.5, level: 0.4 } },
                         { t: 0.6, name: 'stir', args: { dur: 2.9 } } ];
  TL.byId('S1e').sfx = [ { t: 1.0, name: 'serve', args: {} },
                         { t: 2.0, name: 'serve', args: {} },
                         { t: 2.9, name: 'ladle', args: {} } ];
})(window.PSA);
