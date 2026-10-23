// NEW ART (PSA.ut) — the whole film redrawn from scratch in an Undertale-inspired look:
// a low-res 192x108 canvas (every art pixel = 2x2 native = 10x10 on the 1080p video), mostly black backgrounds,
// a tiny flat palette, black outlines in the room and white outlines on the black close-up "inserts", no shading.
// Text boxes, menus and captions are drawn afterwards at native resolution, so text is finer than the art.
// Nothing from the old art (src/assets) is used here.
(function (PSA) {
  const G = PSA.gfx, SP = PSA.sprite;
  const U = {};
  U.LW = 192; U.LH = 108;

  // ---------------------------------------------------------------- palette (all colors used by the new art)
  const C = U.C = {
    k: '#000000', w: '#ffffff', g1: '#c3c3c3', g2: '#7f7f7f', g3: '#3f3f3f',
    yel: '#ffdd33', org: '#ff9a2e', red: '#e8443a', dred: '#8a1f1f', grn: '#4cb050', blu: '#4a8ff0',
    skin: '#ffd2a8', hair: '#7a3e1d', clip: '#40c0b8', swt: '#f0b030', swtD: '#b87818',
    jean: '#3a5aa8', shoe: '#4a2a1a', wood: '#a0602c', woodD: '#6a3a18', pasta: '#ffd860', water: '#7ad0f0',
    frid: '#f0f0f0', fridIn: '#fff4c0', mouth: '#c0392b'
  };

  // Room colors per time of day (flat swaps instead of lighting filters).
  U.roomPal = function (t) {
    const li = PSA.story.light(t);
    // bright rooms: daylight in the morning, warm lamp light in the evening and at night (the window shows the time),
    // a mid-blue moonlit room only while the lamp is off
    if (li.sky === 'morning') return { wall: '#f6f0e0', trim: '#c0b49c', floor: '#d0a878', line: '#a07c58', table: '#c08850', lamp: false, sky: 'morning' };
    if (li.sky === 'sunset') return { wall: '#f8d098', trim: '#c08850', floor: '#c08048', line: '#8a5630', table: C.wood, lamp: true, sky: 'sunset' };
    if (li.sky === 'dusk') return { wall: '#f0c090', trim: '#b88050', floor: '#b47444', line: '#7e4e2c', table: C.wood, lamp: true, sky: 'dusk' };
    if (li.lampOn) return { wall: '#e4b488', trim: '#a87850', floor: '#a86c40', line: '#74462a', table: C.wood, lamp: true, sky: 'night' };
    return { wall: '#7880c0', trim: '#585e9c', floor: '#5a5c98', line: '#3c3e70', table: '#6a5a88', lamp: false, sky: 'night' };
  };

  // ---------------------------------------------------------------- primitives
  const R = (v) => Math.round(v);
  // filled rect with a 1px outline (outline drawn as the rect, fill inset)
  U.orect = function (c, x, y, w, h, fill, ol) { G.rect(c, x, y, w, h, ol || C.k); if (w > 2 && h > 2) G.rect(c, x + 1, y + 1, w - 2, h - 2, fill); };
  U.oell = function (c, cx, cy, rx, ry, fill, ol) { G.ellipse(c, cx, cy, rx, ry, ol || C.k); if (rx > 1 && ry > 1) G.ellipse(c, cx, cy, rx - 1, ry - 1, fill); };
  U.circleO = function (c, cx, cy, r, fill, ol) { U.oell(c, cx, cy, r, r, fill, ol); };

  // ---------------------------------------------------------------- the girl (12x22 sprites, feet at the bottom)
  const GP = { K: C.k, H: C.hair, C: C.clip, S: C.skin, E: C.k, M: C.mouth, Y: C.swt, D: C.swtD, J: C.jean, B: C.shoe, W: C.w };
  const mk = (rows) => SP.make(rows, GP);
  const HEAD_FRONT = [
    '....KKKK....',
    '...KHHHHK...',
    '..KHHHHHHK..',
    '..KCHHHHHK..',
    '.KHHHSHHHHK.',
    '.KHSSSSSSHK.',
    '.KHSESSESHK.',
    '.KHSSSSSSHK.',
    '.KHKSSMSKHK.',
    '..K.KSSK.K..'
  ];
  const HEAD_SIDE = [
    '....KKKK....',
    '...KHHHHK...',
    '..KHHHHHHK..',
    '..KHHHHHHHK.',
    '..KHHHHHSSK.',
    '..KHHHHSESK.',
    '..KCHHHSSSK.',
    '..KHHHHSSMK.',
    '..KHHHHKSK..',
    '...KKKKSK...'
  ];
  const BODY_FRONT = [
    '...KYYYYK...',
    '..KYYYYYYK..',
    '.KYKYYYYKYK.',
    '.KYKYYYYKYK.',
    '.KYKYYYYKYK.',
    '.KSKDDDDKSK.'
  ];
  const BODY_SIDE = [
    '....KYYYK...',
    '...KYYYYYK..',
    '...KYYDYYK..',
    '...KYYDYYK..',
    '...KYYDYYK..',
    '...KDDSDDK..'
  ];
  const BODY_SIDE_NOARM = [
    '....KYYYK...',
    '...KYYYYYK..',
    '...KYYYYYK..',
    '...KYYYYYK..',
    '...KYYYYYK..',
    '...KDDDDDK..'
  ];
  const LEGS_FRONT = ['...KJJJJK...', '...KJJJJK...', '...KJKKJK...', '...KJKKJK...', '..KBBKKBBK..', '..KKKKKKKK..'];
  const LEGS_SIDE = ['....KJJJK...', '....KJJJK...', '....KJJJK...', '....KJJJK...', '....KBBBBK..', '....KKKKKK..'];
  const LEGS_WALK = ['...KJJJJK...', '...KJKKJK...', '..KJK..KJK..', '..KJK..KJK..', '.KBBK..KBBK.', '.KKKK..KKKK.'];
  const SPR = {
    front: mk(HEAD_FRONT.concat(BODY_FRONT, LEGS_FRONT)),
    side: mk(HEAD_SIDE.concat(BODY_SIDE, LEGS_SIDE)),
    sideWalk: mk(HEAD_SIDE.concat(BODY_SIDE, LEGS_WALK)),
    sideArm: mk(HEAD_SIDE.concat(BODY_SIDE_NOARM, LEGS_SIDE)),
    sideArmWalk: mk(HEAD_SIDE.concat(BODY_SIDE_NOARM, LEGS_WALK)),
    frontTop: mk(HEAD_FRONT.concat(BODY_FRONT))           // seated behind the table: only the top half shows
  };
  U.GIRL_H = 22;

  // Draw the girl with her feet at (fx, fy). o = { dir:'front'|'right'|'left', walk:frame, arm:'down'|'forward'|'up',
  //   item:'plate'|'plateHalf'|'spoon'|null, face:'smile'|'closed'|'sleepy'|'yawn'|'neutral', sit:true }
  U.girl = function (c, fx, fy, o) {
    o = o || {};
    fx = R(fx); fy = R(fy);
    const flip = o.dir === 'left';
    const top = fy - 22;
    if (o.dir === 'front' || o.sit) {
      SP.draw(c, o.sit ? SPR.frontTop : SPR.front, fx - 6, top);
      faceFront(c, fx - 6, top, o.face);
      if (o.arm === 'mouth') { G.rect(c, fx + 1, top + 11, 2, 2, C.swt); G.px(c, fx + 1, top + 9, C.skin); G.px(c, fx + 2, top + 10, C.skin); }
      if (o.item === 'plate' || o.item === 'plateHalf') U.plateSmall(c, fx, top + 15 - (o.lift || 0), o.item === 'plateHalf' ? 0.5 : 1);
      return;
    }
    const walking = o.walk != null && (o.walk & 1) === 1;
    const armFwd = o.arm === 'forward' || o.item;
    const def = armFwd ? (walking ? SPR.sideArmWalk : SPR.sideArm) : (walking ? SPR.sideWalk : SPR.side);
    SP.draw(c, def, fx - 6, top - (walking ? 1 : 0), { flip: flip });
    const s = flip ? -1 : 1, bx = fx - 6 + (flip ? 11 : 0);    // mirrored column helper
    const X = (dx) => flip ? fx + 5 - dx : fx - 6 + dx;
    const by = top - (walking ? 1 : 0);
    if (o.face === 'closed' || o.face === 'sleepy') G.px(c, X(9), by + 5, o.face === 'sleepy' ? C.skin : C.skin), G.px(c, X(9), by + 6, C.k);
    if (o.face === 'yawn') { G.px(c, X(9), by + 7, C.k); G.px(c, X(9), by + 8, C.k); }
    if (armFwd) {   // arm reaching forward from the shoulder
      G.rect(c, Math.min(X(8), X(11)), by + 12, 4, 2, C.k);
      G.rect(c, Math.min(X(8), X(10)), by + 12, 3, 1, C.swt);
      G.px(c, X(11), by + 12, C.skin);
      if (o.item === 'plate' || o.item === 'plateHalf') U.plateSmall(c, X(12), by + 11 - (o.lift || 0), o.item === 'plateHalf' ? 0.5 : 1);
      if (o.item === 'spoon') { G.line(c, X(11), by + 12, X(15), by + 8 + (o.spoonDy || 0), C.wood); }
    }
    void s; void bx;
  };
  function faceFront(c, x, y, face) {
    if (face === 'closed' || face === 'sleepy') {
      G.rect(c, x + 4, y + 6, 1, 1, C.skin); G.rect(c, x + 7, y + 6, 1, 1, C.skin);
      G.px(c, x + 4, y + 7, C.k); G.px(c, x + 7, y + 7, C.k);
    }
    if (face === 'yawn') { G.rect(c, x + 5, y + 8, 2, 1, C.k); }
  }

  // ---------------------------------------------------------------- small props (room scale)
  U.plateSmall = function (c, cx, y, amount) {       // 9x4, y = top
    cx = R(cx); y = R(y);
    G.rect(c, cx - 4, y + 2, 9, 2, C.k); G.rect(c, cx - 3, y + 2, 7, 1, C.w);
    if (amount > 0) {
      const w = amount > 0.6 ? 5 : 3;
      G.rect(c, cx - (w >> 1) - 1, y, w + 2, 2, C.k);
      G.rect(c, cx - (w >> 1), y, w, 1, C.pasta); G.px(c, cx, y, C.red);
      G.rect(c, cx - (w >> 1), y + 1, w, 1, C.pasta);
    }
  };
  U.steam = function (c, cx, by, t, n, spread, height) {   // white puffs rising and shrinking
    for (let i = 0; i < n; i++) {
      const age = ((t * 0.7 + i / n) % 1);
      const x = R(cx + Math.sin(i * 2.3 + t * 2) * spread * age);
      const y = R(by - age * height);
      const r = age < 0.6 ? 1 + (i & 1) : 1;
      if (age > 0.9) continue;
      G.circle(c, x, y, r, C.w);
    }
  };
  U.clock = function (c, cx, cy, r, t, ol, face) {
    const ck = PSA.story.clock(t);
    U.circleO(c, cx, cy, r, face || C.w, ol || C.k);
    const mA = (ck.m / 60) * Math.PI * 2, hA = (((ck.h % 12) + ck.m / 60) / 12) * Math.PI * 2;
    const hand = (a, len, th) => {
      for (let dx = 0; dx < th; dx++) for (let dy = 0; dy < th; dy++) G.line(c, cx + dx, cy + dy, R(cx + dx + Math.sin(a) * len), R(cy + dy - Math.cos(a) * len), C.k);
    };
    const th = r >= 20 ? 2 : 1;
    hand(mA, r - 3, th);
    hand(hA, r * 0.55, th + (r >= 20 ? 1 : 0));
    if (r >= 10) for (let i = 0; i < 12; i += 3) { const a = i / 12 * Math.PI * 2; G.px(c, R(cx + Math.sin(a) * (r - 2)), R(cy - Math.cos(a) * (r - 2)), C.k); }
  };
  // Window with sky (x,y,w,h) for 'sunset'|'dusk'|'night'|'morning'
  U.windowSky = function (c, x, y, w, h, sky, ol) {
    U.orect(c, x, y, w, h, C.w, ol);
    const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
    if (sky === 'sunset') { G.rect(c, ix, iy, iw, ih, '#ff8a5a'); G.rect(c, ix, iy + (ih >> 1), iw, ih - (ih >> 1), '#ffc860'); U.circleO(c, ix + (iw >> 1), iy + ih - 2, 3, C.yel, C.yel); }
    else if (sky === 'dusk') { G.rect(c, ix, iy, iw, ih, '#6a4a9a'); G.rect(c, ix, iy + (ih >> 1) + 2, iw, ih - (ih >> 1) - 2, '#e07a8a'); }
    else if (sky === 'night') {
      G.rect(c, ix, iy, iw, ih, '#141a48');
      G.circle(c, ix + iw - 5, iy + 4, 2, C.w); G.circle(c, ix + iw - 4, iy + 3, 2, '#141a48');
      for (let i = 0; i < 5; i++) G.px(c, ix + 2 + ((i * 7) % (iw - 3)), iy + 2 + ((i * 5) % (ih - 3)), C.w);
    } else { G.rect(c, ix, iy, iw, ih, '#a8d8ff'); G.rect(c, ix + 3, iy + 4, 7, 2, C.w); G.rect(c, ix + 5, iy + 3, 3, 1, C.w); }
    G.rect(c, x + (w >> 1), y + 1, 1, h - 2, C.w); G.rect(c, x + 1, y + (h >> 1), w - 2, 1, C.w);   // window cross
  };

  // ---------------------------------------------------------------- the kitchen (wide shot, floating in black)
  // Layout (low-res px): room box x 6..186, wall y 8..44, floor y 44..68, black below (where the text box sits).
  const LY = U.LAYOUT = {
    x0: 6, x1: 186, wallTop: 8, floorY: 44, floorBot: 68,
    table: { x: 18, y: 46, w: 40 }, plate: { x: 38, y: 43 },
    clock: { x: 72, y: 20 }, win: { x: 84, y: 13, w: 26, h: 24 },
    lamp: { x: 38 }, counter: { x: 118, w: 44, top: 34 }, pot: { x: 141 }, fridge: { x: 166, y: 14, w: 18, h: 38 },
    stove: { x: 126, y: 58 }, fridgeMark: { x: 156, y: 60 }, walkY: 60
  };
  U.drawRoom = function (c, t, o) {
    o = o || {};
    const P = U.roomPal(t);
    // wall + baseboard + floor, filling the whole canvas (the wide shots show a 128x72 camera crop of it)
    G.rect(c, 0, 0, U.LW, LY.floorY, P.wall);
    G.rect(c, 0, LY.floorY - 3, U.LW, 3, P.trim);
    G.rect(c, 0, LY.floorY, U.LW, U.LH - LY.floorY, P.floor);
    for (let y = LY.floorY + 5; y < U.LH; y += 6) G.rect(c, 0, y, U.LW, 1, P.line);
    G.rect(c, 0, LY.floorY, U.LW, 1, C.k);
    // window, clock
    U.windowSky(c, LY.win.x, LY.win.y, LY.win.w, LY.win.h, P.sky);
    U.clock(c, LY.clock.x, LY.clock.y, 6, t);
    // lamp (cord from the ceiling)
    G.rect(c, LY.lamp.x, 0, 1, 16, C.g3);
    const on = o.lampOn != null ? o.lampOn : P.lamp;
    G.rect(c, LY.lamp.x - 5, 16, 11, 1, C.k); G.rect(c, LY.lamp.x - 6, 17, 13, 4, C.k);
    G.rect(c, LY.lamp.x - 4, 17, 9, 3, on ? C.yel : C.g2); G.rect(c, LY.lamp.x - 5, 18, 11, 2, on ? C.yel : C.g2);
    if (on) G.rect(c, LY.lamp.x - 1, 21, 3, 1, C.w);
    // shelf with a plant
    G.rect(c, 14, 26, 14, 2, C.k); G.rect(c, 15, 26, 12, 1, C.wood);
    U.orect(c, 17, 22, 4, 4, C.org); G.rect(c, 17, 19, 4, 3, C.grn); G.px(c, 16, 20, C.grn); G.px(c, 21, 19, C.grn);
    // kitchen: upper cabinets, counter, stove, pot, fridge
    const cx = LY.counter.x, cw = LY.counter.w;
    U.orect(c, cx, 10, cw, 13, '#5aa070'); G.rect(c, cx + (cw >> 1), 11, 1, 11, C.k); G.px(c, cx + (cw >> 1) - 2, 18, C.k); G.px(c, cx + (cw >> 1) + 2, 18, C.k);
    G.rect(c, cx, 23, cw, 11, '#4ab8b0'); for (let x = cx + 4; x < cx + cw; x += 5) G.rect(c, x, 24, 1, 10, '#2a8890');   // tiles
    U.orect(c, cx, LY.counter.top, cw, 4, C.g1);
    U.orect(c, cx, LY.counter.top + 3, cw, 15, '#5aa070');
    U.orect(c, cx + 20, LY.counter.top + 3, 16, 15, C.g3);                       // oven door
    G.rect(c, cx + 22, LY.counter.top + 6, 12, 1, C.g2);
    G.px(c, cx + 8, LY.counter.top + 9, C.k); G.px(c, cx + 13, LY.counter.top + 9, C.k);
    if (o.pot !== false) {                                                         // pot on the stove
      U.orect(c, LY.pot.x - 6, LY.counter.top - 7, 13, 8, C.g2);
      G.rect(c, LY.pot.x - 8, LY.counter.top - 6, 2, 1, C.k); G.rect(c, LY.pot.x + 7, LY.counter.top - 6, 2, 1, C.k);
      if (o.boil) U.steam(c, LY.pot.x, LY.counter.top - 8, t, 4, 3, 10);
    }
    // fridge
    U.drawFridge(c, o.fridgeOpen || 0, o.plateInFridge);
    // table + chair
    U.orect(c, LY.table.x + 14, 32, 12, 15, P.table); G.rect(c, LY.table.x + 16, 34, 8, 1, C.woodD); G.rect(c, LY.table.x + 16, 37, 8, 1, C.woodD);
  };
  U.drawTable = function (c, t, plate) {
    const T = LY.table, tc = U.roomPal(t).table;
    U.orect(c, T.x, T.y, T.w, 4, tc);
    U.orect(c, T.x + 2, T.y + 3, 3, 12, C.woodD); U.orect(c, T.x + T.w - 5, T.y + 3, 3, 12, C.woodD);
    if (plate) U.plateSmall(c, LY.plate.x, LY.plate.y, plate === 'half' ? 0.5 : 1);
  };
  U.drawFridge = function (c, open, plateIn) {
    const F = LY.fridge;
    U.orect(c, F.x, F.y, F.w, F.h, C.frid);
    if (open > 0.02) {
      U.orect(c, F.x + 1, F.y + 1, F.w - 2, F.h - 2, C.fridIn);
      for (const sy of [F.y + 10, F.y + 20, F.y + 29]) G.rect(c, F.x + 2, sy, F.w - 4, 1, C.g1);
      G.rect(c, F.x + 3, F.y + 3, 3, 6, C.w); G.rect(c, F.x + 11, F.y + 5, 3, 4, C.red);   // milk + jar
      if (plateIn) U.plateSmall(c, F.x + 9, F.y + 16, 0.5);
      const dw = Math.max(2, R(10 * open));                                                     // door swung to the right
      U.orect(c, F.x + F.w - 1, F.y, dw, F.h, C.g1);
    } else {
      G.rect(c, F.x + 1, F.y + 12, F.w - 2, 1, C.k);
      G.rect(c, F.x + 3, F.y + 4, 1, 6, C.k); G.rect(c, F.x + 3, F.y + 16, 1, 8, C.k);
    }
  };

  // ---------------------------------------------------------------- close-up inserts (black, white outlines)
  // Big plate seen from the front-above at (cx, cy): rim, well, pasta mound (amount 0..1), sauce, basil.
  U.plateBig = function (c, cx, cy, rx, amount, o) {
    o = o || {};
    const ry = R(rx * 0.42), pal = o.pal || {};
    U.oell(c, cx, cy, rx, ry, pal.plate || C.w, pal.ol || C.w);
    G.ellipse(c, cx, cy, rx - 1, ry - 1, pal.plate || C.w);
    G.ellipse(c, cx, cy + 1, R(rx * 0.68), R(ry * 0.6), pal.well || C.g1);
    G.ellipse(c, cx, cy, R(rx * 0.68), R(ry * 0.6), pal.plate || C.w);
    if (amount <= 0) return;
    // spaghetti nest: a bumpy mound (ellipse + round lumps on top), black outline, and tangled strands drawn as
    // short wavy lines in two yellows whose direction changes patch by patch; sauce blob + basil on top
    const mx = R(rx * 0.52 * Math.sqrt(amount)), my = R(ry * 0.62 * Math.sqrt(amount) + 2), sx = R((1 - amount) * -rx * 0.2);
    const ox = cx + sx, oy = cy - 2, lumps = [];
    for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5 * 2 - 1; lumps.push([R(u * mx * 0.8), R(-my * 0.55 + Math.abs(u) * my * 0.4), Math.max(2, R(my * 0.5))]); }
    const inside = (x, y) => (x * x) / (mx * mx) + (y * y) / (my * my) <= 1 || lumps.some((l) => (x - l[0]) ** 2 + (y - l[1]) ** 2 <= l[2] * l[2]);
    const P1 = pal.pasta || C.pasta, P2 = pal.pastaD || '#d89a28', P3 = pal.pastaL || '#fff2b0';
    for (let y = -my - mx; y <= my; y++) for (let x = -mx - 1; x <= mx + 1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      G.px(c, ox + x, oy + y, edge ? C.k : P1);
    }
    // strands: a twirled nest, i.e. wobbly rings around the mound's center, one dark line every 3 px with a light
    // line inside it, so it reads as long noodles wound round
    for (let y = -my - mx; y <= my; y++) for (let x = -mx; x <= mx; x++) {
      if (!inside(x, y) || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) continue;
      const nx = x / mx, ny = (y + my * 0.15) / my, r = Math.sqrt(nx * nx + ny * ny) * mx, th = Math.atan2(ny, nx);
      const v = r + 1.3 * Math.sin(th * 3 + r * 0.35) + 0.6 * Math.sin(th * 7);
      const f = ((v % 3.2) + 3.2) % 3.2;
      if (f < 0.85) G.px(c, ox + x, oy + y, P2); else if (f > 2.5) G.px(c, ox + x, oy + y, P3);
    }
    if (o.sauce !== false) {                         // a flat, wide sauce splash with a few drips (no stem-like leaves)
      const sr = Math.max(3, R(mx * 0.55)), sy = Math.max(2, R(my * 0.32)), top = oy - R(my * 0.3);
      const SD = pal.sauceD || C.dred, S = pal.sauce || C.red;
      const blobs = [[0, 0, sr, sy], [-R(sr * 0.55), 1, R(sr * 0.5), sy], [R(sr * 0.6), -1, R(sr * 0.45), Math.max(1, sy - 1)], [R(sr * 0.2), R(sy * 0.9), 2, 2]];
      for (const b of blobs) G.ellipse(c, ox + b[0], top + b[1], b[2] + 1, b[3] + 1, SD);
      for (const b of blobs) G.ellipse(c, ox + b[0], top + b[1], b[2], b[3], S);
      G.rect(c, ox - R(sr * 0.5), top - sy + 1, 2, 1, pal.sauceL || '#ff9a8a'); G.px(c, ox + 1, top - sy + 1, pal.sauceL || '#ff9a8a');
      if (sr > 4) { G.px(c, ox + 2, top + 1, SD); G.px(c, ox - 3, top, SD); G.px(c, ox + R(sr * 0.6), top, SD); }
      if (o.basil !== false && sr > 4) {             // one small basil leaf lying flat
        const bx = ox + R(sr * 0.4), by = top + 1;
        G.rect(c, bx - 1, by - 1, 5, 3, C.k); G.rect(c, bx, by, 3, 1, C.grn);
      }
    }
    if (amount < 0.8) {                              // the eaten side: a sauce smear where food was taken
      G.rect(c, ox + mx + 2, cy + 1, R(rx * 0.22), 1, pal.sauce || C.red);
      G.rect(c, ox + mx + 4, cy + 2, R(rx * 0.12), 1, pal.sauce || C.red);
    }
  };
  // Close-up background: the room's wall color (same light as the wide shots), optional baseboard line.
  U.wallBg = function (c, t) { const P = U.roomPal(t); G.rect(c, 0, 0, U.LW, U.LH, P.wall); return P; };
  // A table edge band across the bottom of a close-up (flat brown, white top line).
  U.tableBand = function (c, y, col) { G.rect(c, 0, y, U.LW, U.LH - y, col || C.wood); G.rect(c, 0, y, U.LW, 1, C.w); };
  // Hands for the close-ups (skin, black outline, mustard sleeve running off-frame).
  // 'down': fist at the lower-left, sleeve going up-right (holding something from above).
  // 'up':   fist at the upper-left, sleeve going down-right (holding the fork from below). (x,y) = grip point.
  const HP = { K: C.k, S: C.skin, Y: C.swt };
  const HAND_DOWN = SP.make([
    '..........KKKKKK', '.........KYYYYYK', '........KYYYYYK.', '.......KYYYYYK..', '......KKKKKKK...', '.....KSSSSSK....',
    '....KSSSSSSK....', '...KSSKSSSSK....', '...KSSSKSSK.....', '...KSSSSSK......', '....KKKKK.......'], HP);
  const HAND_UP = SP.make([
    '....KKKKK.......', '...KSSSSSK......', '...KSSKSSSK.....', '...KSSSKSSSK....', '....KSSSSSSK....', '.....KSSSSSK....',
    '......KKKKKKK...', '.......KYYYYYK..', '........KYYYYYK.', '.........KYYYYYK', '..........KKKKKK'], HP);
  U.hand = function (c, x, y, mode) {
    x = R(x); y = R(y);
    if (mode === 'up') {
      for (let i = 1; i < 40; i++) G.rect(c, x + 4 + i, y + 5 + i, 8, 7, C.k);           // sleeve: outline pass, then fill
      for (let i = 1; i < 40; i++) G.rect(c, x + 5 + i, y + 6 + i, 6, 5, C.swt);
      SP.draw(c, HAND_UP, x - 5, y - 2);
    } else {
      for (let i = 1; i < 40; i++) G.rect(c, x + 5 + i, y - 9 - i, 8, 7, C.k);
      for (let i = 1; i < 40; i++) G.rect(c, x + 6 + i, y - 8 - i, 6, 5, C.swt);
      SP.draw(c, HAND_DOWN, x - 4, y - 8);
    }
  };
  // Fork held at the hand, tines up at (x,y). Optional twirled pasta on the tines.
  U.fork = function (c, x, y, pasta) {
    x = R(x); y = R(y);
    for (let d = 0; d < 2; d++) G.line(c, x + d, y + 6, x + 10 + d, y + 16, C.g1);       // handle
    G.rect(c, x - 3, y, 1, 6, C.g1); G.rect(c, x - 1, y - 1, 1, 7, C.g1); G.rect(c, x + 1, y - 1, 1, 7, C.g1); G.rect(c, x + 3, y, 1, 6, C.g1);
    G.rect(c, x - 3, y + 5, 7, 2, C.g1);
    if (pasta) { U.oell(c, x, y + 3, 5, 3, C.pasta, C.k); G.px(c, x - 2, y + 3, C.org); G.px(c, x + 1, y + 2, C.org); G.px(c, x + 2, y + 4, C.red); }
  };

  // ---------------------------------------------------------------- portrait (28x30, used x2 in the text box, x4 in S5d)
  const faceCache = {};
  U.faceCanvas = function (expr, frame) {
    const key = expr + '|' + (frame | 0);
    if (faceCache[key]) return faceCache[key];
    const c = G.makeCanvas(28, 30);
    const x = c.getContext('2d');
    // hair (bob) with outline
    G.rect(x, 4, 1, 20, 23, C.k); G.rect(x, 3, 3, 22, 21, C.k);
    G.rect(x, 5, 2, 18, 22, C.hair); G.rect(x, 4, 4, 20, 19, C.hair);
    // face
    G.rect(x, 7, 8, 14, 15, C.k); G.rect(x, 8, 7, 12, 17, C.k);
    G.rect(x, 8, 8, 12, 15, C.skin); G.rect(x, 9, 22, 10, 1, C.skin);
    // fringe swept to the right + clip
    G.rect(x, 7, 6, 14, 3, C.hair); G.rect(x, 13, 9, 7, 1, C.hair); G.rect(x, 17, 10, 3, 1, C.hair);
    G.rect(x, 7, 9, 2, 1, C.k);
    G.rect(x, 6, 7, 2, 2, C.clip);
    // neck + sweater
    G.rect(x, 11, 24, 6, 2, C.k); G.rect(x, 12, 24, 4, 2, C.skin);
    G.rect(x, 3, 26, 22, 4, C.k); G.rect(x, 4, 27, 20, 3, C.swt); G.rect(x, 10, 26, 8, 1, C.swtD);
    // features
    const look = expr === 'look' || expr === 'sniff', unsure = expr === 'unsure';
    const ey = look ? 15 : 14;
    if (expr === 'smile' || expr === 'neutral' || look || unsure) {
      G.rect(x, 10, ey, 2, 3, C.k); G.rect(x, 16, ey, 2, 3, C.k);
      if (!look) { G.px(x, 10, ey, C.w); G.px(x, 16, ey, C.w); }
      if (look) { G.rect(x, 10, ey, 2, 1, C.skin); G.rect(x, 16, ey, 2, 1, C.skin); }
    } else { G.rect(x, 9, 15, 3, 1, C.k); G.rect(x, 16, 15, 3, 1, C.k); }        // closed / content
    if (unsure) { G.rect(x, 9, 11, 3, 1, C.k); G.rect(x, 16, 10, 3, 1, C.k); G.px(x, 18, 11, C.k); }
    G.px(x, 9, 19, '#ff9a8a'); G.px(x, 18, 19, '#ff9a8a');                         // cheeks
    if (expr === 'smile' || expr === 'content') { G.rect(x, 12, 20, 4, 1, C.k); G.px(x, 11, 19, C.k); G.px(x, 16, 19, C.k); }
    else if (unsure) { G.px(x, 12, 21, C.k); G.px(x, 13, 20, C.k); G.px(x, 14, 21, C.k); G.px(x, 15, 20, C.k); }
    else G.rect(x, 13, 20, 2, 1, C.k);
    if (expr === 'sniff') {                                                      // sniff lines next to the nose
      const k = frame & 1;
      G.px(x, 23, 16 + k, C.w); G.px(x, 24, 15 + k, C.w); G.px(x, 25, 16 + k, C.w);
      G.px(x, 14, 18, C.k);
    }
    return (faceCache[key] = c);
  };

  PSA.ut = U;
})(window.PSA);
