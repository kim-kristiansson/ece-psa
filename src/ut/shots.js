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
  const span = G.span, sm = G.smooth, lerp = G.lerp, R = Math.round;
  const walkF = (t) => Math.floor(t * 8) % 2;
  function emote(ctx, fx, fy, sym, lt) { TB.emote(ctx, fx * 2 + 1, (fy - 23) * 2, sym, lt); }

  // ================================================================ SCENE 1 — COOKING
  PSA.shots.S1a = shot(function (c, t) {
    U.drawRoom(c, t, { boil: true });
    U.drawTable(c, t, null);
    const m = LY.stove;
    U.girl(c, m.x, m.y, { dir: 'right', item: 'spoon', spoonDy: Math.floor(t * 3) % 2 });
  }, function (ctx, t, lt) {
    const a = lt < 1.2 || lt > 4.6 ? 0 : lt < 1.6 ? span(lt, 1.2, 1.6) : lt > 4.0 ? 1 - span(lt, 4.0, 4.6) : 1;
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; G.rect(ctx, 0, 0, PSA.W, 50, C.k); ctx.restore();
      F.text(ctx, ST.TITLE, PSA.W >> 1, 18, { scale: 2, align: 'center', color: 'white', alpha: a });
    }
    PSA.light.black(ctx, 1 - sm(lt / 1.5));
  });

  // close-up stove: black, burner, big pot with white outline, water, bubbles, steam
  function potScene(c, t, o) {
    o = o || {};
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
    const y = R(lerp(-2, 16, sm(span(lt, 0, 1.6))));                              // bundle lowered into the water
    if (lt < 2.2) {
      const fan = sm(span(lt, 1.4, 2.0));
      for (let i = -3; i <= 3; i++) G.line(c, 100 + i, y - 4, R(100 + i * (1 + fan * 4)), y + 16, C.pasta);
      U.hand(c, 100, y - 2, 'down');
    } else U.hand(c, R(lerp(100, 160, span(lt, 2.2, 3.0))), R(lerp(-4, -30, span(lt, 2.2, 3.0))), 'down');
  });
  PSA.shots.S1d = shot(function (c, t, lt) {
    potScene(c, t, { pasta: true });
    const a = t * 3.2, sx = R(96 + Math.cos(a) * 20), sy = R(30 + Math.sin(a) * 3);
    G.line(c, sx, sy, sx + 30, sy - 34, C.k); G.line(c, sx + 1, sy, sx + 31, sy - 34, C.wood); G.line(c, sx + 2, sy, sx + 32, sy - 34, C.wood);
    U.oell(c, sx, sy, 3, 2, C.wood, C.k);
    U.hand(c, sx + 28, sy - 32, 'down');
  });
  PSA.shots.S1e = shot(function (c, t, lt) {
    U.tableBand(c, 74, C.g1);
    const amount = lt < 1.0 ? 0 : lt < 2.0 ? 0.55 : 1;
    U.plateBig(c, 96, 76, 56, amount, { sauce: lt >= 3.0, basil: lt >= 3.4 });
    if (lt > 2.4 && lt < 3.6) {                                                    // ladle pours sauce
      const y = R(lerp(30, 58, sm(span(lt, 2.4, 2.9))));
      U.oell(c, 98, y, 6, 3, C.g1, C.w); G.line(c, 104, y - 1, 140, y - 40, C.w);
      if (lt > 2.8) G.rect(c, 97, y + 3, 2, 70 - y, C.red);
    }
    if (lt > 0.6 && lt < 2.4) {                                                    // tongs drop the pasta
      const y = R(lerp(20, 60, span((lt - 0.6) % 1, 0, 0.5)));
      G.line(c, 96, y, 130, y - 40, C.g1); U.oell(c, 96, y + 2, 6, 3, C.pasta, C.k);
    }
  });

  // ================================================================ SCENE 2 — DINNER
  const SEAT = { x: LY.table.x + 20, y: 50 };
  PSA.shots.S2a = shot(function (c, t, lt) {
    U.drawRoom(c, t);
    const down = lt >= 3.9;
    if (lt < 3.0) U.girl(c, R(lerp(150, SEAT.x + 6, span(lt, -0.6, 3.0))), 54, { dir: 'left', walk: walkF(lt), item: 'plate' });
    else if (lt < 4.3) U.girl(c, SEAT.x + 6, 54, { dir: 'front', item: down ? null : 'plate', lift: R(-3 * sm(span(lt, 3.3, 3.9))) });
    else U.girl(c, SEAT.x, SEAT.y, { sit: true });
    U.drawTable(c, t, down ? 'full' : null);
    if (down) U.steam(c, LY.plate.x, LY.plate.y - 1, t, 3, 2, 8);
  });
  PSA.shots.S2b = shot(function (c, t, lt) {
    U.tableBand(c, 0, C.wood);
    for (let y = 18; y < U.LH; y += 22) G.rect(c, 0, y, U.LW, 1, C.woodD);
    U.plateBig(c, 92, 64, 60, lt > 2.4 ? 0.85 : 1);
    let fx, fy, pasta = span(lt, 0.5, 2.1) > 0.5;
    if (lt < 2.3) { const a = lt * 9, amp = sm(span(lt, 0.4, 0.8)) * 4; fx = 94 + R(Math.cos(a) * amp); fy = 54 + R(Math.sin(a) * amp * 0.5) + R(lerp(50, 0, sm(span(lt, -0.1, 0.4)))); }
    else { const k = sm(span(lt, 2.4, 3.6)); fx = R(94 + k * 20); fy = R(54 - k * 70); }
    U.fork(c, fx, fy, pasta);
    U.hand(c, fx + 11, fy + 17, 'up');
  });
  const BITES = [[-9, 0.3, 'down'], [0.3, 0.75, 'mid'], [0.75, 1.6, 'mouth'], [1.6, 1.9, 'down'], [1.9, 2.1, 'mid'], [2.1, 2.5, 'mouth'], [2.5, 3.0, 'down']];
  PSA.shots.S2c = shot(function (c, t, lt) {
    U.drawRoom(c, t);
    const back = lt >= 3.0, b = BITES.find((x) => lt >= x[0] && lt < x[1]);
    U.girl(c, SEAT.x, SEAT.y + (back ? 1 : 0), { sit: true, face: back ? 'closed' : 'smile', arm: !back && b && b[2] === 'mouth' ? 'mouth' : null });
    U.drawTable(c, t, lt >= 2.1 ? 'half' : 'full');
    if (lt < 2.1) U.steam(c, LY.plate.x, LY.plate.y - 1, t, 2, 2, 6);
  });
  PSA.shots.S2d = shot(function (c, t, lt) {
    U.drawRoom(c, t);
    if (lt < 0.5) U.girl(c, SEAT.x, SEAT.y, { sit: true });
    else if (lt < 0.9) U.girl(c, SEAT.x, 54, { dir: 'front' });
    else U.girl(c, R(lerp(SEAT.x, -14, span(lt, 0.9, 3.6))), R(lerp(54, 62, span(lt, 0.9, 1.5))), { dir: 'left', walk: walkF(lt) });
    U.drawTable(c, t, 'half');
  });

  // ================================================================ SCENE 3 — TIME PASSES
  // Table close-up on black: a floating clock and window, the table edge, the plate (always the same leftovers).
  function tableClose(c, t, night) {
    const P = U.roomPal(t);
    U.windowSky(c, 130, 8, 40, 34, P.sky, C.w);
    U.clock(c, 40, 26, 15, t, C.w, night ? '#b8b8e0' : C.w);
    U.tableBand(c, 62, night ? '#3a2e5a' : P.sky === 'morning' ? '#a07848' : C.wood);
    U.plateBig(c, 92, 80, 46, 0.5, night ? { pal: { plate: '#b8b8e0', well: '#8888b8', pasta: '#c8b060', pastaD: '#8a6a30', sauce: '#a03a40', ol: C.w } } : {});
    G.rect(c, 120, 92, 22, 1, night ? '#8888b8' : C.g1); G.rect(c, 142, 91, 4, 3, night ? '#8888b8' : C.g1);   // fork beside the plate
  }
  PSA.shots.S3a = shot(function (c, t) { tableClose(c, t, false); });
  PSA.shots.S3b = shot(function (c, t, lt) {
    const tc = G.clamp(t, 50, 56);
    U.clock(c, 96, 48, 34, tc, C.w);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; G.rect(c, R(96 + Math.sin(a) * 30), R(48 - Math.cos(a) * 30), 2, 2, C.k); }
  }, function (ctx, t) {
    const tc = G.clamp(t, 50, 56), s = ST.clockLabel(tc), w = F.measure('12:00 AM', 1) + 16;
    TB.frame(ctx, (PSA.W - w) >> 1, 178, w, 22); F.text(ctx, s, PSA.W >> 1, 185, { align: 'center', color: 'white' });
  });
  PSA.shots.S3c = shot(function (c, t) { U.drawRoom(c, t); U.drawTable(c, t, 'half'); });
  PSA.shots.S3d = shot(function (c, t) { tableClose(c, t, true); }, function (ctx, t) {
    const s = ST.clockLabel(t), w = F.measure('12:00 AM', 1) + 16;
    TB.frame(ctx, 80 - (w >> 1), 92, w, 22); F.text(ctx, s, 80, 99, { align: 'center', color: 'white' });
  });

  // ================================================================ SCENE 4 — MIDNIGHT, INTO THE FRIDGE
  function s4aPos(t) {
    if (t < 70.6) return { x: lerp(-14, 10, span(t, 69.6, 70.6)), walk: true };
    if (t < 71.85) return { x: 10, walk: false };
    if (t < 73.3) return { x: lerp(10, 66, span(t, 71.85, 73.3)), walk: true };
    return { x: 66, walk: false };
  }
  PSA.shots.S4a = shot(function (c, t) {
    U.drawRoom(c, t);
    const lifted = t >= 73.55;
    U.drawTable(c, t, lifted ? null : 'half');
    const p = s4aPos(t);
    const face = t >= 70.6 && t < 71.3 ? 'yawn' : 'sleepy';
    if (t < 73.3) U.girl(c, p.x, LY.walkY, { dir: 'right', walk: p.walk ? walkF(t) : null, face: face });
    else if (t < 74.05) U.girl(c, p.x, LY.walkY, { dir: 'left', item: lifted ? 'plateHalf' : null, arm: 'forward', lift: R(4 * sm(span(t, 73.55, 74.05))) });
    else U.girl(c, p.x, LY.walkY, { dir: 'right', item: 'plateHalf' });
  }, function (ctx, t) { if (t >= 71.3 && t < 72.2) emote(ctx, s4aPos(t).x, LY.walkY, '!', t - 71.3); });
  function fridgeOpen(t, o0, o1, c0, c1) { return t < c0 ? sm(span(t, o0, o1)) : 1 - sm(span(t, c0, c1)); }
  PSA.shots.S4b = shot(function (c, t) {
    const open = fridgeOpen(t, 76.0, 76.6, 78.1, 78.8), inFridge = t >= 77.7;
    U.drawRoom(c, t, { fridgeOpen: open, plateInFridge: inFridge, lampOn: t < 80.0 });
    U.drawTable(c, t, null);
    const M = LY.fridgeMark;
    if (t < 75.75) U.girl(c, lerp(66, M.x, span(t, 74.5, 75.75)), lerp(LY.walkY, M.y, span(t, 74.5, 75.75)), { dir: 'right', walk: walkF(t), item: 'plateHalf' });
    else if (t < 77.7) {
      U.girl(c, M.x, M.y, { dir: 'right', arm: 'forward', item: t < 76.9 ? 'plateHalf' : null });
      if (t >= 76.9) { const k = sm(span(t, 76.9, 77.7)); U.plateSmall(c, lerp(M.x + 6, LY.fridge.x + 9, k), lerp(M.y - 11, LY.fridge.y + 16, k), 0.5); }
    } else if (t < 79.25) U.girl(c, M.x, M.y, { dir: t < 79.0 ? 'right' : 'front', face: 'sleepy' });
    else U.girl(c, lerp(M.x, 60, span(t, 79.25, 81.0)), LY.walkY, { dir: 'left', walk: walkF(t), face: 'sleepy' });
  });

  // ================================================================ SCENE 5 — THE NEXT MORNING
  const WALK0 = 82.4, WALK1 = 86.3;
  PSA.shots.S5a = shot(function (c, t) {
    U.drawRoom(c, t, { plateInFridge: true });
    U.drawTable(c, t, null);
    if (t >= WALK0) U.girl(c, lerp(-14, LY.fridgeMark.x, span(t, WALK0, WALK1)), LY.walkY, { dir: 'right', walk: walkF(t) });
  });
  PSA.shots.S5b = shot(function (c, t) {
    const open = fridgeOpen(t, 86.6, 87.1, 88.4, 89.0), out = t >= 87.15, onTable = t >= 91.5;
    U.drawRoom(c, t, { fridgeOpen: open, plateInFridge: !out });
    U.drawTable(c, t, onTable ? 'half' : null);
    const M = LY.fridgeMark;
    if (t < 87.15) U.girl(c, M.x, M.y, { dir: 'right', arm: t >= 86.4 ? 'forward' : null });
    else if (t < 88.5) {
      const k = sm(span(t, 87.15, 87.65));
      if (k < 1) { U.girl(c, M.x, M.y, { dir: 'right', arm: 'forward' }); U.plateSmall(c, lerp(LY.fridge.x + 9, M.x + 6, k), lerp(LY.fridge.y + 16, M.y - 11, k), 0.5); }
      else U.girl(c, M.x - R(4 * span(t, 88.15, 88.45)), M.y, { dir: 'right', item: 'plateHalf' });
    } else if (t < 91.1) U.girl(c, lerp(M.x - 4, 66, span(t, 88.5, 91.1)), lerp(M.y, LY.walkY, span(t, 88.5, 89.0)), { dir: 'left', walk: walkF(t), item: 'plateHalf' });
    else if (!onTable) U.girl(c, 66, LY.walkY, { dir: 'left', item: 'plateHalf', lift: -R(3 * span(t, 91.1, 91.5)) });
    else U.girl(c, 66, LY.walkY, { dir: 'left' });
  });
  PSA.shots.S5c = shot(function (c, t) { tableClose(c, t, false); });
  PSA.shots.S5d = shot(function (c, t) {
    const expr = t < 97.4 ? 'look' : t < 99.0 ? 'sniff' : 'unsure';
    const blink = expr !== 'sniff' && (t % 2.9) < 0.12;
    const f = U.faceCanvas(blink ? 'closed' : expr, Math.floor(t * 4));
    c.imageSmoothingEnabled = false;
    c.drawImage(f, 0, 0, 28, 30, 96 - 42, 108 - 90, 84, 90);
    U.windowSky(c, 152, 10, 30, 40, 'morning', C.w);
  }, function (ctx, t) { if (t >= 99.5) TB.emote(ctx, 2 * 140, 2 * 26, '?', t - 99.5); });
  // hand + fork rising from the plate toward her mouth (top of frame), slowing, then stopping
  function handComp(c, t) {
    U.tableBand(c, 0, '#a07848');
    for (let y = 18; y < U.LH; y += 22) G.rect(c, 0, y, U.LW, 1, '#6a5038');
    U.plateBig(c, 80, 98, 46, 0.45);
    const e = G.easeOut(span(t, 101.6, 104.5));
    const fx = R(lerp(118, 124, e)), fy = R(lerp(78, 18, e));
    U.fork(c, fx, fy, true);
    U.hand(c, fx + 11, fy + 17, 'up');
  }
  PSA.shots.S5e = shot(function (c, t) { handComp(c, t); });
  const MENU = { x: 20, y: 160, w: 344, h: 40, options: ['Eat it', 'Throw it out'] };
  function cursorAt(t) {
    if (t < 107.3) return null;
    if (t < 108.6) return 0;
    if (t < 110.0) return sm(span(t, 108.6, 108.78));
    if (t < 110.8) return 1 - sm(span(t, 110.0, 110.18));
    return 0.4 * sm(span(t, 110.8, 111.1));
  }
  PSA.shots.S5f = shot(function (c, t) { handComp(c, Math.max(t, 104.6)); }, function (ctx, t) {
    const alpha = span(t, 107.0, 107.2);
    if (alpha > 0) { const cur = cursorAt(t); TB.choice(ctx, Object.assign({}, MENU, { cursor: cur == null ? undefined : cur, alpha: alpha })); }
  });
})(window.PSA);
