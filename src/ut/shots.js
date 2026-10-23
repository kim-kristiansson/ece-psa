// NEW SHOTS on the new art (src/ut/art.js). Same shot ids, times, text and sound cues as src/scenes/story.js and the
// scene files (whose sfx lists stay in use); only the pictures are new. Each shot draws on the 192x108 low-res canvas,
// which is then scaled x2 onto the native frame; emotes, captions, the title and the menu are drawn at native size.
(function (PSA) {
  const G = PSA.gfx, U = PSA.ut, C = U.C, LY = U.LAYOUT, ST = PSA.story, TB = PSA.textbox, F = PSA.font;
  if (PSA.style) PSA.style.enabled = false;           // the new art is already flat: no filter pass
  TB.faceProvider = function (expr) { return U.faceCanvas(expr === 'smile' ? 'smile' : expr); };

  const low = G.makeCanvas(U.LW, U.LH), lc = low.getContext('2d');
  // shot(fn, post): fn draws low-res, post (optional) draws native overlays after the x2 blit
  function shot(fn, post) {
    return function (ctx, t, lt) {
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1;
      G.rect(lc, 0, 0, U.LW, U.LH, C.k);
      fn(lc, t, lt);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(low, 0, 0, U.LW, U.LH, 0, 0, PSA.W, PSA.H);
      if (post) post(ctx, t, lt);
    };
  }
  // wide(fn, cam, post): room shots. fn draws the whole room low-res and returns the girl's x (or nothing); the frame
  // shows a 128x72 crop of it scaled x3 (bigger, tighter than the full room). cam = fixed crop x, or 'follow' (keeps
  // the girl in view). post gets the crop x so native overlays can line up with the art.
  const CAM = { w: 128, h: 72, y: 2, max: U.LW - 128 };
  function wide(fn, cam, post) {
    return function (ctx, t, lt) {
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1;
      G.rect(lc, 0, 0, U.LW, U.LH, C.k);
      const gx = fn(lc, t, lt);
      const cx = typeof cam === 'number' ? cam : G.clamp(R(gx == null ? 0 : gx - 64), 0, CAM.max);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(low, cx, CAM.y, CAM.w, CAM.h, 0, 0, PSA.W, PSA.H);
      if (post) post(ctx, t, lt, cx);
    };
  }
  // Wide shots put their text box at the top (the girl walks along the bottom), like Undertale does.
  for (const id of ['S1a', 'S2a', 'S2c', 'S2d', 'S3c', 'S4a', 'S4b', 'S5a', 'S5b']) for (const tx of PSA.timeline.byId(id).text || []) tx.box = { y: 4 };
  const span = G.span, sm = G.smooth, lerp = G.lerp, R = Math.round;
  const walkF = (t) => Math.floor(t * 8) % 2;
  function emote(ctx, cx, fx, fy, sym, lt) { TB.emote(ctx, (fx - cx) * 3 + 1, (fy - 23 - CAM.y) * 3, sym, lt); }

  // ================================================================ SCENE 1 — COOKING
  PSA.shots.S1a = wide(function (c, t) {
    U.drawRoom(c, t, { boil: true });
    U.drawTable(c, t, null);
    // she stands at the stove beside the pot (counter at her waist) and stirs: the spoon circles in the pot,
    // her hand follows it and she sways a little with each stir
    const a = t * 3.4, px = LY.pot.x, rim = LY.counter.top - 6;
    const hx = R(px - 6 + Math.cos(a)), hy = rim + R(Math.sin(a) * 0.6);                   // hand at the rim, shoulder height
    const bx = R(px - 1 + Math.cos(a) * 3), by = rim + 2;                                     // spoon bowl in the water
    const tx = R(hx + (hx - bx) * 0.6), ty = R(hy + (hy - by) * 0.6) - 3;                     // handle runs on through her fist
    G.line(c, tx, ty, bx, by, C.k); G.line(c, tx + 1, ty, bx + 1, by, C.wood);
    U.potSmall(c, true);                                                                       // pot wall hides the bowl
    U.girl(c, px - 11, 60, { dir: 'right', hand: { x: hx, y: hy } });
  }, CAM.max, function (ctx, t, lt) {
    const a = lt < 1.2 || lt > 4.6 ? 0 : lt < 1.6 ? span(lt, 1.2, 1.6) : lt > 4.0 ? 1 - span(lt, 4.0, 4.6) : 1;
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; G.rect(ctx, 0, 0, PSA.W, 50, C.k); ctx.restore();
      F.text(ctx, ST.TITLE, PSA.W >> 1, 18, { scale: 2, align: 'center', color: 'white', alpha: a });
    }
    PSA.light.black(ctx, 1 - sm(lt / 1.5));
  });

  // close-up stove: black, burner, big pot with white outline, water, bubbles, steam
  function tiles(c, y1) {                                                           // kitchen backsplash behind close-ups
    G.rect(c, 0, 0, U.LW, y1, '#5cc8c0');
    for (let x = 5; x < U.LW; x += 14) G.rect(c, x, 0, 1, y1, '#3a9a98');
    for (let y = 10; y < y1; y += 14) G.rect(c, 0, y, U.LW, 1, '#3a9a98');
  }
  function potScene(c, t, o) {
    o = o || {};
    tiles(c, 78);
    G.rect(c, 0, 78, U.LW, 30, C.g3); G.rect(c, 0, 78, U.LW, 1, C.w);              // cooktop
    for (let i = 0; i < 9; i++) {                                                   // flames (2-frame flicker)
      const x = 66 + i * 7, h = 4 + ((i + Math.floor(t * 10)) % 3);
      G.rect(c, x, 78 - h, 3, h, C.org); G.rect(c, x + 1, 78 - h + 2, 1, h - 2, C.yel);
    }
    G.rect(c, 44, 33, 104, 40, C.w); G.rect(c, 45, 34, 102, 38, C.g2);             // pot body
    G.rect(c, 50, 36, 4, 32, C.g1);                                                // one flat highlight stripe
    G.rect(c, 36, 38, 9, 4, C.w); G.rect(c, 37, 39, 7, 2, C.g3);                    // handles
    G.rect(c, 147, 38, 9, 4, C.w); G.rect(c, 148, 39, 7, 2, C.g3);
    U.oell(c, 96, 33, 52, 7, C.water, C.w);                                        // water surface
    if (o.pasta) for (let i = 0; i < 9; i++) G.line(c, 72 + i * 6, 31 + (i & 1), 78 + i * 6 + R(Math.sin(t * 3 + i) * 2), 35, C.pasta);
    for (let i = 0; i < 7; i++) {                                                  // bubbles popping
      const ph = (t * 1.6 + i * 0.37) % 1;
      if (ph < 0.6) G.ring(c, 60 + ((i * 23) % 72), 32 + (i % 3), 1 + (ph > 0.3 ? 1 : 0), C.w);
    }
    U.steam(c, 96, 22, t, 6, 18, 22);
  }
  PSA.shots.S1b = shot(function (c, t) { potScene(c, t); });
  PSA.shots.S1c = shot(function (c, t, lt) {
    potScene(c, t, { pasta: lt > 1.6 });
    const y = R(lerp(-20, 16, sm(span(lt, 0, 1.6))));                             // the bundle drops into the water
    if (lt < 2.2) {
      const fan = sm(span(lt, 1.4, 2.0));
      for (const i of [-4, 4]) G.line(c, 100 + i, y - 22, R(100 + i * (1 + fan * 4)), y + 16, '#e0a830');      // golden edge, no black
      for (let i = -3; i <= 3; i++) G.line(c, 100 + i, y - 22, R(100 + i * (1 + fan * 4)), y + 16, i & 1 ? '#ffe890' : C.pasta);
    }
  });
  PSA.shots.S1d = shot(function (c, t, lt) {
    potScene(c, t, { pasta: true });
    const a = t * 3.2, sx = R(96 + Math.cos(a) * 20), sy = R(30 + Math.sin(a) * 3);
    G.line(c, sx, sy, sx + 40, sy - 46, C.k); G.line(c, sx + 1, sy, sx + 41, sy - 46, C.wood); G.line(c, sx + 2, sy, sx + 42, sy - 46, C.wood); G.line(c, sx + 3, sy, sx + 43, sy - 46, C.k);
    U.oell(c, sx, sy, 3, 2, C.wood, C.k);
  });
  PSA.shots.S1e = shot(function (c, t, lt) {
    tiles(c, 40);
    U.tableBand(c, 40, C.g1);
    const amount = lt < 1.0 ? 0 : lt < 2.0 ? 0.55 : 1;
    U.plateBig(c, 96, 44, 56, amount, { sauce: lt >= 3.0, basil: lt >= 3.4, smear: false });   // whole dish above the text box
    for (const [t0, t1, col, w] of [[0.6, 1.0, C.pasta, 7], [1.6, 2.0, C.pasta, 9], [2.6, 3.0, C.red, 6]]) {   // drops from above
      if (lt < t0 || lt >= t1) continue;
      const y = R(lerp(-8, 36, span(lt, t0, t1)));
      U.oell(c, 96, y, w, 3, col, C.k);
    }
    if (amount > 0) U.steam(c, 96, 30, t, 4, 6, 14);
  });

  // ================================================================ SCENE 2 — DINNER
  // Depth rules for the room: she walks on the floor in front of the kitchen at y LY.walkY (63, below the counter
  // and fridge), and behind the table at y BEHIND (50: the table is drawn after her and hides her legs). She changes
  // between the two lanes beside the table (x 66), never through it, and only puts a plate down from behind it.
  const SEAT = { x: LY.table.x + 20, y: 50 }, BEHIND = 50, SIDE = 66, AT_TABLE = SEAT.x + 6;
  // position along a path of [t, x, y] keys (linear), plus whether she is moving and which way she faces
  function path(t, keys) {
    if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2], moving: false, dir: null };
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      if (t < b[0]) {
        const k = span(t, a[0], b[0]), dx = b[1] - a[1];
        return { x: R(lerp(a[1], b[1], k)), y: R(lerp(a[2], b[2], k)), moving: dx !== 0 || b[2] !== a[2], dir: dx < 0 ? 'left' : dx > 0 ? 'right' : null };
      }
    }
    const l = keys[keys.length - 1];
    return { x: l[1], y: l[2], moving: false, dir: null };
  }
  const S2A_PATH = [[24.4, 150, LY.walkY], [26.9, SIDE, LY.walkY], [27.4, SIDE, BEHIND], [28.0, AT_TABLE, BEHIND]];
  PSA.shots.S2a = wide(function (c, t, lt) {
    U.drawRoom(c, t);
    const down = lt >= 3.9, p = path(t, S2A_PATH), gx = lt < 3.0 ? p.x : SEAT.x;
    if (lt < 3.0) U.girl(c, p.x, p.y, { dir: 'left', walk: walkF(lt), item: 'plate' });
    else if (lt < 4.3) U.girl(c, AT_TABLE, BEHIND, { dir: 'front', item: down ? null : 'plate', lift: R(-3 * sm(span(lt, 3.3, 3.9))) });
    else U.girl(c, SEAT.x, SEAT.y, { sit: true });
    U.drawTable(c, t, down ? 'full' : null);
    if (down) U.steam(c, LY.plate.x, LY.plate.y - 1, t, 3, 2, 8);
    return gx;
  }, 'follow');
  // close on her face: she slurps one noodle from the plate (it shrinks into her mouth), then chews happily
  PSA.timeline.byId('S2b').sfx = [{ t: 0.6, name: 'eat', args: {} }, { t: 2.2, name: 'eat', args: {} }];
  PSA.shots.S2b = shot(function (c, t, lt) {
    U.wallBg(c, t);
    U.windowSky(c, 140, 8, 34, 30, U.roomPal(t).sky, C.k);
    const chew = lt > 2.0, f = U.faceCanvas(chew ? (Math.floor(lt * 4) % 2 ? 'content' : 'smile') : 'closed', 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(f, 0, 0, 28, 30, 68, 4, 56, 60);
    U.tableBand(c, 66, C.wood); G.rect(c, 0, 66, U.LW, 1, C.k);
    U.plateBig(c, 96, 86, 40, 0.85);
    if (!chew) {                                                                    // the noodle, mouth "o"
      G.rect(c, 94, 42, 4, 3, C.k); G.rect(c, 95, 43, 2, 1, C.mouth);
      const k = sm(span(lt, 0.3, 2.0)), y0 = 45, y1 = R(lerp(80, y0, k));
      for (let y = y0; y < y1; y++) { const x = 96 + R(Math.sin(y * 0.5 + lt * 9) * 1.5); G.rect(c, x - 1, y, 3, 1, C.k); G.px(c, x, y, C.pasta); }
    }
  });
  const BITES = [[-9, 0.3, 'down'], [0.3, 0.75, 'mid'], [0.75, 1.6, 'mouth'], [1.6, 1.9, 'down'], [1.9, 2.1, 'mid'], [2.1, 2.5, 'mouth'], [2.5, 3.0, 'down']];
  PSA.shots.S2c = wide(function (c, t, lt) {
    U.drawRoom(c, t);
    const back = lt >= 3.0, b = BITES.find((x) => lt >= x[0] && lt < x[1]);
    U.girl(c, SEAT.x, SEAT.y + (back ? 1 : 0), { sit: true, face: back ? 'closed' : 'smile', arm: !back && b && b[2] === 'mouth' ? 'mouth' : null });
    U.drawTable(c, t, lt >= 2.1 ? 'half' : 'full');
    if (lt < 2.1) U.steam(c, LY.plate.x, LY.plate.y - 1, t, 2, 2, 6);
  }, 0);
  PSA.shots.S2d = wide(function (c, t, lt) {
    U.drawRoom(c, t);
    if (lt < 0.5) U.girl(c, SEAT.x, SEAT.y, { sit: true });
    else if (lt < 0.9) U.girl(c, SEAT.x, BEHIND, { dir: 'front' });
    else U.girl(c, R(lerp(SEAT.x, -14, span(lt, 0.9, 3.6))), BEHIND, { dir: 'left', walk: walkF(lt) });
    U.drawTable(c, t, 'half');
  }, 0);

  // ================================================================ SCENE 3 — TIME PASSES
  // Table close-up on black: a floating clock and window, the table edge, the plate (always the same leftovers).
  function tableClose(c, t, night) {
    const P = U.wallBg(c, t);
    // everything sits above the text box (which covers y 70+ of this canvas)
    U.windowSky(c, 140, 4, 34, 28, P.sky, C.k);
    U.clock(c, 34, 17, 12, t, C.k, night ? '#d8dcf8' : C.w);
    U.tableBand(c, 34, P.table);
    G.rect(c, 0, 34, U.LW, 1, C.k);
    U.plateBig(c, 92, 52, 42, 0.5, night ? { pal: { plate: '#d8dcf8', well: '#a8acd8', pasta: '#e0d088', pastaD: '#b09858', pastaL: '#f0e8c0', sauce: '#b04a58', sauceD: '#7a2a40', sauceL: '#d88898' } } : {});
    U.forkFlat(c, 140, 56, night ? '#c8ccf0' : C.w);                                      // fork beside the plate
  }
  PSA.shots.S3a = shot(function (c, t) { tableClose(c, t, false); });
  PSA.shots.S3b = shot(function (c, t, lt) {
    const tc = G.clamp(t, 50, 56);
    U.wallBg(c, tc);
    U.clock(c, 96, 48, 34, tc, C.k);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; G.rect(c, R(96 + Math.sin(a) * 30), R(48 - Math.cos(a) * 30), 2, 2, C.k); }
  }, function (ctx, t) {
    const tc = G.clamp(t, 50, 56), s = ST.clockLabel(tc), w = F.measure('12:00 AM', 2) + 28;
    TB.frame(ctx, (PSA.W - w) >> 1, 176, w, 32); F.text(ctx, s, PSA.W >> 1, 185, { scale: 2, align: 'center', color: 'white' });
  });
  PSA.shots.S3c = wide(function (c, t) { U.drawRoom(c, t); U.drawTable(c, t, 'half'); }, 0);
  PSA.shots.S3d = shot(function (c, t) { tableClose(c, t, true); }, function (ctx, t) {
    const s = ST.clockLabel(t), w = F.measure('12:00 AM', 2) + 28;
    TB.frame(ctx, 150 - (w >> 1), 18, w, 32); F.text(ctx, s, 150, 27, { scale: 2, align: 'center', color: 'white' });
  });

  // ================================================================ SCENE 4 — MIDNIGHT, INTO THE FRIDGE
  // she comes in behind the table, stops ("!"), walks to her place, picks the plate up, heads right
  const S4A_PATH = [[69.6, -14, BEHIND], [70.6, 10, BEHIND], [71.85, 10, BEHIND], [73.3, AT_TABLE, BEHIND], [74.05, AT_TABLE, BEHIND], [74.5, 60, BEHIND]];
  PSA.shots.S4a = wide(function (c, t) {
    U.drawRoom(c, t);
    const lifted = t >= 73.55, p = path(t, S4A_PATH);
    const face = t >= 70.6 && t < 71.3 ? 'yawn' : 'sleepy';
    if (t < 73.3) U.girl(c, p.x, p.y, { dir: 'right', walk: p.moving ? walkF(t) : null, face: face });
    else if (t < 74.05) U.girl(c, p.x, p.y, { dir: 'front', face: 'sleepy', item: lifted ? 'plateHalf' : null, lift: R(2 * sm(span(t, 73.55, 74.05))) });
    else U.girl(c, p.x, p.y, { dir: 'right', walk: walkF(t), item: 'plateHalf', face: 'sleepy' });
    U.drawTable(c, t, lifted ? null : 'half');                                                 // in front of her
  }, 0, function (ctx, t, lt, cx) { if (t >= 71.3 && t < 72.2) { const p = path(t, S4A_PATH); emote(ctx, cx, p.x, p.y, '!', t - 71.3); } });
  function fridgeOpen(t, o0, o1, c0, c1) { return t < c0 ? sm(span(t, o0, o1)) : 1 - sm(span(t, c0, c1)); }
  const S4B_PATH = [[74.5, 60, BEHIND], [74.8, SIDE, LY.walkY], [75.95, LY.fridgeMark.x, LY.walkY]];
  PSA.shots.S4b = wide(function (c, t) {
    const open = fridgeOpen(t, 76.0, 76.6, 78.1, 78.8), inFridge = t >= 77.7;
    U.drawRoom(c, t, { fridgeOpen: open, plateInFridge: inFridge, lampOn: t < 80.0 });
    const M = LY.fridgeMark, p = path(t, S4B_PATH);
    if (t < 74.8) U.girl(c, p.x, p.y, { dir: 'right', walk: walkF(t), item: 'plateHalf' });   // still behind the table
    U.drawTable(c, t, null);
    if (t < 74.8) { /* drawn above */ }
    else if (t < 75.95) U.girl(c, p.x, p.y, { dir: 'right', walk: walkF(t), item: 'plateHalf' });
    else if (t < 77.7) {
      U.girl(c, M.x, M.y, { dir: 'right', arm: 'forward', item: t < 76.9 ? 'plateHalf' : null });
      if (t >= 76.9) { const k = sm(span(t, 76.9, 77.7)); U.plateSmall(c, lerp(M.x + 6, LY.fridge.x + 9, k), lerp(M.y - 11, LY.fridge.y + 16, k), 0.5); }
    } else if (t < 79.25) U.girl(c, M.x, M.y, { dir: t < 79.0 ? 'right' : 'front', face: 'sleepy' });
    else U.girl(c, lerp(M.x, 60, span(t, 79.25, 81.0)), LY.walkY, { dir: 'left', walk: walkF(t), face: 'sleepy' });
    return t < 75.95 ? p.x : t < 79.25 ? M.x : lerp(M.x, 60, span(t, 79.25, 81.0));
  }, 'follow');

  // ================================================================ SCENE 5 — THE NEXT MORNING
  const WALK0 = 82.4, WALK1 = 86.3;
  PSA.shots.S5a = wide(function (c, t) {
    U.drawRoom(c, t, { plateInFridge: true });
    U.drawTable(c, t, null);
    const gx = lerp(-14, LY.fridgeMark.x, span(t, WALK0, WALK1));
    if (t >= WALK0) U.girl(c, gx, LY.walkY, { dir: 'right', walk: walkF(t) });
    return gx;
  }, 'follow');
  const S5B_PATH = [[88.5, LY.fridgeMark.x - 4, LY.walkY], [90.3, SIDE, LY.walkY], [90.6, SIDE, BEHIND], [91.1, AT_TABLE, BEHIND]];
  PSA.shots.S5b = wide(function (c, t) {
    const open = fridgeOpen(t, 86.6, 87.1, 88.4, 89.0), out = t >= 87.15, onTable = t >= 91.5;
    U.drawRoom(c, t, { fridgeOpen: open, plateInFridge: !out });
    if (t < 88.5 || (t < 91.1 && path(t, S5B_PATH).y !== BEHIND)) U.drawTable(c, t, null);
    const M = LY.fridgeMark;
    if (t < 87.15) U.girl(c, M.x, M.y, { dir: 'right', arm: t >= 86.4 ? 'forward' : null });
    else if (t < 88.5) {
      const k = sm(span(t, 87.15, 87.65));
      if (k < 1) { U.girl(c, M.x, M.y, { dir: 'right', arm: 'forward' }); U.plateSmall(c, lerp(LY.fridge.x + 9, M.x + 6, k), lerp(LY.fridge.y + 16, M.y - 11, k), 0.5); }
      else U.girl(c, M.x - R(4 * span(t, 88.15, 88.45)), M.y, { dir: 'right', item: 'plateHalf' });
    } else if (t < 91.1) {
      const p = path(t, S5B_PATH);
      U.girl(c, p.x, p.y, { dir: 'left', walk: walkF(t), item: 'plateHalf' });
      if (p.y === BEHIND) U.drawTable(c, t, null);                                               // behind the table: table in front
    } else U.girl(c, AT_TABLE, BEHIND, { dir: 'front', item: onTable ? null : 'plateHalf', lift: -R(3 * span(t, 91.1, 91.5)) });
    if (t >= 91.1) U.drawTable(c, t, onTable ? 'half' : null);
    return t < 88.15 ? M.x : t < 88.5 ? M.x - 4 : t < 91.1 ? path(t, S5B_PATH).x : AT_TABLE;
  }, 'follow');
  PSA.shots.S5c = shot(function (c, t) { tableClose(c, t, false); });
  PSA.shots.S5d = shot(function (c, t) {
    const expr = t < 97.4 ? 'look' : t < 99.0 ? 'sniff' : 'unsure';
    const blink = expr !== 'sniff' && (t % 2.9) < 0.12;
    const f = U.faceCanvas(blink ? 'closed' : expr, Math.floor(t * 4));
    U.wallBg(c, t);
    U.windowSky(c, 146, 10, 34, 42, 'morning', C.k);
    c.imageSmoothingEnabled = false;
    c.drawImage(f, 0, 0, 28, 30, 68, 4, 56, 60);
  }, function (ctx, t) { if (t >= 99.5) TB.emote(ctx, 2 * 126, 2 * 14, '?', t - 99.5); });
  // Battle screen: the leftover plate is the "enemy" on black, floating with a slow idle bob; a battle text box
  // below it (S5e), then the Eat it / Throw it out menu (S5f).
  for (const tx of PSA.timeline.byId('S5f').text) tx.box = { y: 136 };
  PSA.timeline.byId('S5e').sfx = [{ t: 0.25, name: 'notice', args: {} }];
  function battle(c, t) {
    const lt = t - 101.0;
    if (lt < 0.45) {                                                                 // encounter flash: blinking
      if (Math.floor(lt * 10) % 2 === 0) G.rect(c, 0, 0, U.LW, U.LH, C.w);
      return;
    }
    const bob = Math.round(Math.sin(t * 2.2) * 1.2);
    const P = { plate: C.w, ol: C.w };
    U.plateBig(c, 96, 40 + bob, 52, 0.5, { pal: P });
    G.rect(c, 0, 62, U.LW, 1, C.k);
  }
  PSA.shots.S5e = shot(function (c, t) { battle(c, t); });
  const MENU = { x: 10, y: 136, w: 364, h: 68, options: ['Eat it', 'Throw it out'] };
  // the heart wavers (Eat it -> Throw it out -> back -> Throw it out), selects at 109.6, then the decision line types
  const SELECT = 109.0;
  function cursorAt(t) {
    if (t < 107.3) return null;
    if (t < 107.9) return 0;
    if (t < 108.4) return 1;
    if (t < 108.7) return 0;
    return 1;
  }
  PSA.timeline.byId('S5f').sfx = [{ t: 0.9, name: 'menuMove', args: {} }, { t: 1.4, name: 'menuMove', args: {} }, { t: 1.7, name: 'menuMove', args: {} }, { t: SELECT - 107.0, name: 'reveal', args: {} }];
  PSA.shots.S5f = shot(function (c, t) { battle(c, t); }, function (ctx, t) {
    const alpha = span(t, 107.0, 107.2);
    if (t >= SELECT + 0.15) return;                                                   // the decision text box takes over
    if (alpha > 0) { const cur = cursorAt(t); TB.choice(ctx, Object.assign({}, MENU, { cursor: cur == null ? undefined : cur, alpha: alpha })); }
  });

  // ================================================================ FOOTSTEPS
  // A cute "boop" per step while she walks, in step with the 2-frame walk cycle (a step whenever the walking frame
  // starts, every 0.25 s), feet alternating pitch. Replaces the footsteps of the old scene files.
  const WALKS = { S2a: [[25.0, 28.0]], S2d: [[40.4, 43.1]], S4a: [[69.6, 70.6], [71.85, 73.3], [74.05, 74.5]], S4b: [[74.5, 75.95], [79.25, 81.0]],
    S5a: [[WALK0, WALK1]], S5b: [[88.5, 91.1]] };
  for (const id in WALKS) {
    const sh = PSA.timeline.byId(id);
    sh.sfx = (sh.sfx || []).filter((e) => e.name !== 'footstep');
    let n = 0;
    for (const w of WALKS[id]) for (let k = Math.ceil((w[0] * 8 - 1) / 2); (2 * k + 1) / 8 < w[1]; k++) {
      const at = (2 * k + 1) / 8;
      if (at >= sh.start && at < sh.end) sh.sfx.push({ t: at - sh.start, name: 'footstep', args: { step: n++, soft: id !== 'S2a' } });
    }
  }
})(window.PSA);
