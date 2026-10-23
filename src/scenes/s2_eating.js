// SCENE 2 — EATING AND LEAVING THE LEFTOVERS (S2a..S2d). See docs/SCENES.md.
//   S2a MEDIUM table (cam 0): she carries the plate in along the back of the room, sets it down on the table, sits.
//   S2b CLOSE-UP fork: big planks, the LARGE plate, her hand twirls pasta on the fork and lifts it out of frame.
//   S2c MEDIUM table: two readable bites, the plate becomes 'half', she leans back content (thought box by the engine).
//   S2d WIDE (cam 32): she stands up, steps out from behind the table on the left and walks out; the plate stays.
// All renderers are pure functions of time (lt clamped where needed); light applied after the world, before UI.
(function (PSA) {
  const G = PSA.gfx, L = PSA.LAYOUT, ST = PSA.story, TL = PSA.timeline, R = PSA.room, GIRL = PSA.girl, FD = PSA.food;
  const W = PSA.W, H = PSA.H;
  const PLATE_SEED = 0;                     // the large plate uses the same seed in every close-up (continuity)
  const SEAT = L.marks.tableSeat;           // (98,120) seated behind the table
  const BACK_Y = 142;                       // feet line when she stands / walks BEHIND the table (hidden by the table top)
  const STAND_Y = 138;                      // feet line when she stands up from the chair (head rises a little)

  // ------------------------------------------------------------------ shared helpers
  const blink = (t) => (t % 3.7) < 0.12;
  const breath = (t) => Math.floor(t * 2) % 2;
  const walkFrame = (lt) => ((Math.floor(lt * 8) % 4) + 4) % 4;

  // Room environment for the medium/wide shots at absolute time t (sky / lamp from the story), with overrides.
  function roomEnv(t, extra) {
    const li = ST.light(t);
    return Object.assign({
      t: t, sky: li.sky, phase: li.phase, lampOn: li.lampOn,
      potOnStove: true, potBoiling: 0, fridgeOpen: 0, plateInFridge: false,
      plateOnTable: null, plateSteam: 0, forkOnTable: true
    }, extra || {});
  }
  function applyLight(ctx, t) { PSA.light.apply(ctx, ST.light(t).state); }

  // Position along a piecewise-linear path. segs: [{t0, t1, x0, y0, x1, y1}] in time order.
  function pathPos(segs, t) {
    const first = segs[0];
    if (t <= first.t0) return { x: first.x0, y: first.y0, moving: false };
    for (const s of segs) {
      if (t < s.t1) {
        const k = (t - s.t0) / (s.t1 - s.t0);
        return { x: Math.round(G.lerp(s.x0, s.x1, k)), y: Math.round(G.lerp(s.y0, s.y1, k)), moving: true };
      }
    }
    const last = segs[segs.length - 1];
    return { x: last.x1, y: last.y1, moving: false };
  }
  // One 'footstep' per contact frame (every 0.25 s of shot-relative time) while walking in [t0, t1).
  function footsteps(t0, t1, soft) {
    const ev = [];
    for (let k = Math.ceil(t0 / 0.25); k * 0.25 < t1; k++) ev.push({ t: k * 0.25, name: 'footstep', args: { soft: !!soft } });
    return ev;
  }

  // ================================================================== S2a — she carries the plate in, sets it down, sits
  // Timeline (absolute): 24.5–28.0 walk in along y=142 (behind the counter line, then behind the table) carrying the plate,
  // 28.0–28.3 turn to the camera, 28.3–28.9 the plate goes down onto the table (plateSet 28.9), 28.9–29.3 she looks at it,
  // 29.3 she sits (chair). The plate is drawn by the room from 28.9 (env.plateOnTable 'full' + steam).
  const S2A_WALK = [{ t0: -0.6, t1: 3.0, x0: 220, y0: BACK_Y, x1: SEAT.x, y1: BACK_Y }];   // ≈34 px/s
  const S2A_TURN = 3.0, S2A_DOWN0 = 3.3, S2A_DOWN1 = 3.9, S2A_SIT = 4.3;

  PSA.shots.S2a = function (ctx, t, lt) {
    const cam = 0;
    const onTable = lt >= S2A_DOWN1;
    const env = roomEnv(t, { plateOnTable: onTable ? 'full' : null, plateSteam: onTable ? 1 : 0 });
    R.drawBack(ctx, cam, env);

    // --- the girl (always behind the table in this shot: feet y < table front edge)
    let plateInAir = null;                                   // {x, y, steam} when the plate is drawn by this shot
    if (lt < S2A_TURN) {
      // beat: walking in from the right with the plate (side view, plate in both hands)
      const p = pathPos(S2A_WALK, lt);
      GIRL.draw(ctx, p.x - cam, p.y, { pose: 'carry', dir: 'left', walking: true, frame: walkFrame(lt), item: 'plate', blink: blink(t) });
      // faint steam from the carried plate (plate center is ~30 px above the feet, 6 px in front of her)
      const bob = (walkFrame(lt) & 1) ? -1 : 0;
      R.drawSteamSmall(ctx, p.x - cam - 6, p.y - 32 + bob, t, { intensity: 0.5 });
    } else if (lt < S2A_DOWN1) {
      // beat: turned to the camera, holding the plate out, then lowering it onto the table
      GIRL.draw(ctx, SEAT.x - cam, BACK_Y, { pose: 'carry', dir: 'front', item: null, blink: blink(t) });
      const k = G.smooth(G.span(lt, S2A_DOWN0, S2A_DOWN1));
      plateInAir = { x: Math.round(G.lerp(SEAT.x + 1, L.plateOnTable.cx, k)), y: Math.round(G.lerp(BACK_Y - 31, L.plateOnTable.cy, k)), steam: 0.5 + 0.5 * k };
    } else if (lt < S2A_SIT) {
      // beat: a short look at the dish before sitting
      GIRL.draw(ctx, SEAT.x - cam, BACK_Y, { pose: 'stand', dir: 'front', frame: breath(t), blink: blink(t) });
    } else {
      // beat: seated behind the table (drawn before the table so it hides her lap)
      GIRL.draw(ctx, SEAT.x - cam, SEAT.y, { pose: 'sit', dir: 'front', blink: blink(t) });
    }

    R.drawTable(ctx, cam, env);
    if (plateInAir) R.drawPlateSmall(ctx, plateInAir.x - cam, plateInAir.y, { amount: 'full', steam: plateInAir.steam, t: t });
    R.drawFront(ctx, cam, env);
    applyLight(ctx, t);
  };

  // ================================================================== S2b — close-up: fork twirls pasta, lifts it out of frame
  const PLATE_CX = 168, PLATE_CY = 122;      // the LARGE plate, left-center of the frame
  const FIST_X = 216, FIST_Y = 162;          // fist position while twirling: tines land in the mound (fist - 42, - 42)

  // Big wooden planks of the table top (close-up scale), deterministic grain.
  function drawPlanks(ctx) {
    G.rect(ctx, 0, 0, W, H, 'wood1');
    const ph = 46;
    for (let i = 0; i < 6; i++) {
      const y0 = i * ph - 18;
      const rng = G.rng(101 + i);
      // seam between planks: dark line + a lighter edge below it
      G.hline(ctx, 0, y0, W, 'wood4');
      G.hline(ctx, 0, y0 + 1, W, 'wood3');
      G.hline(ctx, 0, y0 + 2, W, 'counter1');
      // grain streaks
      if (!PSA.FLAT) for (let k = 0; k < 9; k++) {
        const gy = y0 + 4 + Math.floor(rng() * (ph - 7));
        let x = -Math.floor(rng() * 50);
        while (x < W) {
          const len = 16 + Math.floor(rng() * 64);
          G.hline(ctx, x, gy, len, k % 3 === 0 ? 'wood3' : 'wood2');
          x += len + 10 + Math.floor(rng() * 40);
        }
      }
      // a knot
      const kx = Math.floor(rng() * W), ky = y0 + 10 + Math.floor(rng() * (ph - 20));
      if (!PSA.FLAT) { G.ellipse(ctx, kx, ky, 4, 2, 'wood2'); G.ellipse(ctx, kx, ky, 2, 1, 'wood3'); G.px(ctx, kx, ky, 'wood4'); }
      // end joint of the plank
      const jx = Math.floor(rng() * W);
      G.vline(ctx, jx, y0 + 1, ph - 1, 'wood4'); G.vline(ctx, jx + 1, y0 + 3, ph - 3, 'wood2');
    }
    // soft lamp light on the table around the plate (sparse dither so the grain shows through)
    if (PSA.FLAT) return;
    ctx.save(); ctx.globalAlpha *= 0.5;
    for (let y = -70; y <= 70; y++) {
      const f = 1 - (y * y) / (70 * 70);
      const hw = Math.floor(Math.sqrt(Math.max(0, f)) * 150);
      for (let x = -hw; x <= hw; x++) {
        const X = PLATE_CX + 10 + x, Y = PLATE_CY - 6 + y;
        if (((X + 2 * Y) & 3) === 0) G.px(ctx, X, Y, 'lampLight');
      }
    }
    ctx.restore();
  }

  PSA.shots.S2b = function (ctx, t, lt) {
    lt = G.clamp(lt, -0.3, 4.3);
    drawPlanks(ctx);
    // the plate loses a little pasta when the fork comes up
    const amount = G.lerp(1, 0.85, G.smooth(G.span(lt, 2.3, 2.7)));
    FD.drawPlateLarge(ctx, PLATE_CX, PLATE_CY, { amount: amount, sauce: 1, steam: 0.45, t: t, seed: PLATE_SEED });
    // --- the hand with the fork
    let fx, fy, pasta;
    if (lt < 0.4) {                                          // beat: hand comes in from the bottom-right
      const k = G.easeOut(G.span(lt, -0.1, 0.4));
      fx = Math.round(G.lerp(270, FIST_X, k)); fy = Math.round(G.lerp(236, FIST_Y, k)); pasta = 0;
    } else if (lt < 2.3) {                                   // beat: twirl (small circular motion), pasta winds onto the tines
      const w = (lt - 0.4) * Math.PI * 2 * 1.1;
      const amp = G.smooth(G.span(lt, 0.4, 0.8)) * (1 - G.smooth(G.span(lt, 2.0, 2.3)));
      fx = FIST_X + Math.round(3 * Math.cos(w) * amp); fy = FIST_Y + Math.round(2 * Math.sin(w) * amp);
      pasta = G.span(lt, 0.5, 2.1);
    } else {                                                 // beat: lift the fork up and out of the frame
      // the fist goes up and to the right so the sleeve keeps coming in from the right edge (her body is off-frame right);
      // the forkful leaves the frame at the top (toward her mouth) and the hand settles near the top-right corner
      const k = G.smooth(G.span(lt, 2.4, 3.6));
      fx = Math.round(G.lerp(FIST_X, 284, k)); fy = Math.round(G.lerp(FIST_Y, 22, k)); pasta = 1;
    }
    FD.drawHandForkLarge(ctx, fx, fy, { pasta: pasta, t: t, frame: Math.floor(lt * 4) % 2, grip: 'hold' });
    applyLight(ctx, t);
  };

  // ================================================================== S2c — two bites, then leaning back content
  // sitEat frames: 0 fork on the plate, 1 lifting, 2 at the mouth, 3 chewing (eyes closed). Each beat >= 0.25 s.
  // S2b ended with the fork lifted toward her mouth, so bite 1 starts on the lifting frame.
  const BITE1 = [[-9, 0.3, 1], [0.3, 0.75, 2], [0.75, 1.6, 3]];
  const BITE2 = [[1.6, 1.9, 0], [1.9, 2.1, 1], [2.1, 2.5, 2], [2.5, 3.0, 3]];
  const S2C_HALF = 2.1;          // the plate reads 'half' from the moment the second forkful reaches her mouth
  const S2C_BACK = 3.0;          // leaning back from here (thought box 2.8–6.5 by the engine)
  function eatFrame(lt) {
    for (const b of BITE1.concat(BITE2)) if (lt >= b[0] && lt < b[1]) return b[2];
    return -1;
  }

  PSA.shots.S2c = function (ctx, t, lt) {
    const cam = 0;
    const half = lt >= S2C_HALF;
    const steam = half ? G.lerp(0.3, 0, G.span(lt, S2C_HALF, 5.5)) : G.lerp(0.5, 0.3, G.span(lt, 0, S2C_HALF));
    const env = roomEnv(t, { plateOnTable: half ? 'half' : 'full', plateSteam: steam, forkOnTable: lt >= S2C_BACK });
    R.drawBack(ctx, cam, env);
    const f = eatFrame(lt);
    if (lt >= S2C_BACK) {
      // beat: content, leaning back (eyes-closed smile comes from the pose)
      GIRL.draw(ctx, SEAT.x - cam, SEAT.y, { pose: 'sitBack', dir: 'front' });
    } else {
      // beat: eating (face 'closed' on the chew frames is handled by the pose)
      GIRL.draw(ctx, SEAT.x - cam, SEAT.y, { pose: 'sitEat', dir: 'front', frame: f < 0 ? 1 : f, blink: blink(t) });
    }
    R.drawTable(ctx, cam, env);
    R.drawFront(ctx, cam, env);
    applyLight(ctx, t);
  };

  // ================================================================== S2d — she stands up and leaves; the plate stays
  // 39.5–39.8 still leaning back, 39.8 hands on the table (push up, chair scrape), 40.0 standing behind the table,
  // 40.4–42.2 steps out left behind the table (clear of it at x<46), 42.2–44.5 walks out of frame left (gone ≈43.0),
  // then the empty room with the plate.
  const S2D_PUSH = 0.3, S2D_STAND = 0.5, S2D_GO = 0.9;
  const S2D_WALK = [
    { t0: 0.9, t1: 2.7, x0: SEAT.x, y0: STAND_Y, x1: 44, y1: 148 },     // ≈30 px/s, coming slightly forward
    { t0: 2.7, t1: 5.0, x0: 44, y0: 148, x1: -24, y1: 164 }             // ≈30 px/s out to the living room
  ];

  PSA.shots.S2d = function (ctx, t, lt) {
    const cam = L.wideCam;
    const env = roomEnv(t, { plateOnTable: 'half', plateSteam: 0, forkOnTable: true });
    R.drawBack(ctx, cam, env);
    let front = null;                                        // girl drawn after the table (once clear of it on the left)
    if (lt < S2D_PUSH) {
      GIRL.draw(ctx, SEAT.x - cam, SEAT.y, { pose: 'sitBack', dir: 'front' });
    } else if (lt < S2D_STAND) {
      GIRL.draw(ctx, SEAT.x - cam, SEAT.y, { pose: 'sit', dir: 'front', blink: blink(t) });
    } else if (lt < S2D_GO) {
      GIRL.draw(ctx, SEAT.x - cam, STAND_Y, { pose: 'stand', dir: 'front', frame: breath(t), blink: blink(t) });
    } else {
      const p = pathPos(S2D_WALK, lt);
      if (p.moving) {
        const o = { pose: 'walk', dir: 'left', frame: walkFrame(lt), blink: blink(t) };
        if (p.x > 46) GIRL.draw(ctx, p.x - cam, p.y, o); else front = { x: p.x - cam, y: p.y, o: o };
      }
      // after the path ends she is far off-screen: nothing to draw (the empty room is the point)
    }
    R.drawTable(ctx, cam, env);
    if (front) GIRL.draw(ctx, front.x, front.y, front.o);
    R.drawFront(ctx, cam, env);
    applyLight(ctx, t);
  };

  // ================================================================== SFX (times relative to each shot's start)
  TL.byId('S2a').sfx = footsteps(0, 3.0, false).concat([
    { t: 3.9, name: 'plateSet', args: {} },
    { t: 4.3, name: 'chair', args: {} }
  ]);
  TL.byId('S2b').sfx = [
    { t: 0.4, name: 'forkPick', args: {} },
    { t: 1.2, name: 'forkClink', args: {} },
    { t: 1.9, name: 'forkClink', args: {} }
  ];
  TL.byId('S2c').sfx = [
    { t: 0.9, name: 'eat', args: {} },
    { t: 2.5, name: 'eat', args: {} },
    { t: 3.0, name: 'forkClink', args: {} }       // she puts the fork down as she leans back
  ];
  TL.byId('S2d').sfx = [{ t: 0.3, name: 'chair', args: {} }].concat(footsteps(0.9, 3.6, true));
})(window.PSA);
