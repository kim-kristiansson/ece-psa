// src/assets/girl.js — the main character sprite: PSA.girl
//
// API (see docs/API.md):
//   PSA.girl.H = 52; PSA.girl.W = 20;
//   PSA.girl.draw(ctx, feetX, feetY, opts)
//     opts.dir   'right' | 'left' | 'front' | 'back'          (left = mirrored right)
//     opts.pose  'stand' | 'walk' | 'carry' | 'stir' | 'reach' | 'reachPlate' |
//                'sit' | 'sitEat' | 'sitBack' | 'sitHold' | 'yawn'
//     opts.frame integer (walk 0..3, stir 0..1, sitEat 0..3, stand breathing 0..1)
//     opts.walking  for 'carry': use the walk legs (frame 0..3)
//     opts.face  'smile' (default) | 'neutral' | 'closed' | 'sleepy' | 'unsure'
//     opts.blink eyes closed for a blink frame
//     opts.item  null | 'plate' | 'plateHalf' | 'spoon' | 'fork'   (drawn in her hands, pixel-aligned)
//                 'stir' always draws the wooden spoon; 'reachPlate' always holds a plate (plateHalf if given);
//                 sitEat / sitHold always draw the fork. Other poses draw the item in the hanging / forward hand.
//     opts.liftY px offset applied to the carried item (set-down animation)
//   Directions: 'stir', 'reach' are side-view only (front/back fall back to 'stand', reachPlate to 'carry');
//   the sit* poses are always drawn front-view. Faces 'open' and 'chew' are used internally by yawn / sitEat.
//   PSA.girl.hand(opts)    -> {x, y} offset of the forward / right hand relative to the feet anchor
//   PSA.girl.headTop(opts) -> y offset of the top of the head (-52 standing, -30 seated, +-1 on bob frames)
//
// Construction: she is composed from PARTS (sprite defs with an anchor offset ax/ay relative to the FEET point:
// x = feet center column, y = feet line; negative y is up). Standing: head top -52, shoulder line -38, hands ~-22.
// Seated poses use the same head/torso parts with the lap line as the base (head top -30).
// Only the RIGHT-facing side view is drawn; 'left' mirrors every part around the anchor column.
// All colors are palette keys (see PAL below). Outline is always 'ink'.
(function (PSA) {
  const G = PSA.gfx;
  const S = PSA.sprite;
  const girl = { H: 52, W: 20 };

  // ------------------------------------------------------------------ palette chars
  const PAL = {
    o: 'ink',
    s: 'skin', S: 'skinShade', c: 'cheek',
    h: 'hair1', H: 'hair2', d: 'hair3', k: 'clip',
    y: 'sweater1', Y: 'sweater2', m: 'sweater3',
    j: 'jeans1', J: 'jeans2', n: 'jeans3',
    b: 'shoe1', B: 'shoe2',
    e: 'eye', w: 'eyeWhite', u: 'mouth',
    p: 'plate1', P: 'plate2', q: 'plate3', r: 'plateRim',
    '1': 'pasta1', '2': 'pasta2', '3': 'pasta3', '4': 'pasta4',
    a: 'sauce1', A: 'sauce2', z: 'sauce3', g: 'basil',
    f: 'fork1', F: 'fork2', E: 'fork3',
    t: 'spoon1', T: 'spoon2'
  };

  // part helper: rows + anchor offset (ax, ay) of the part's top-left relative to the feet point
  function P(ax, ay, rows) { return S.make(rows, PAL, { ax: ax, ay: ay }); }

  // draw a part at anchor (fx, by) with extra offset (dx, dy); flip mirrors around the anchor column
  function put(ctx, part, fx, by, flip, dx, dy) {
    dx = dx | 0; dy = dy | 0;
    const w = part.rows[0].length;
    const x = flip ? fx - (part.ax + dx) - w + 1 : fx + part.ax + dx;
    S.draw(ctx, part, x, by + part.ay + dy, { flip: flip });
  }

  // ================================================================== SIDE VIEW (facing right)
  // --- head: 14 x 13, hair top at -52, chin at -41, bob bottom outline at -40. Face at the right.
  const headSide = P(-7, -52, [
    '....ooooooo...',
    '...ohhhhhHHo..',
    '..ohhhhHHHHHo.',
    '.ohhhHHHHHHHoo',
    '.ohhHHHHHHHdso',
    'oHHHHHHHHdoSso',
    'oHHHHHHHossSso',
    'oHHHHHHossssso',
    'oHHHHHHossssso',
    'oHHHHHHoscssso',
    '.oHHHHHoSsssso',
    '.oddddddoSSSo.',
    '..ooooooo.ooo.'
  ]);
  // side face overlays (eye block at x 3..4, rows -46..-45; mouth at x 4..5 row -43)
  const faceSide = {
    eyeOpen:   P(3, -46, ['we', 'ee']),
    eyeBlink:  P(3, -45, ['ee']),
    eyeClosed: P(3, -46, ['.e', 'e.']),       // content ^ (profile)
    eyeSleepy: P(3, -46, ['SS', 'ee']),
    browUp:    P(4, -47, ['dd']),
    mouthSmile:   P(4, -43, ['uu']),
    mouthNeutral: P(5, -43, ['u']),
    mouthUnsure:  P(4, -43, ['.u', 'u.']),
    mouthOpen:    P(4, -44, ['uu', 'uu'])
  };
  // teal clip: on her LEFT temple, so it is visible only when she faces left (mirrored view)
  const clipSide = P(1, -47, ['k']);
  // --- neck (shared by side/front/back)
  const neckSide = P(-1, -40, ['oSSSo', 'oSSSo']);
  // --- torso: 10 x 17, shoulders -38, hem outline -22
  const torsoSide = P(-5, -38, [
    '.oooooooo.',
    'oyyYyyyYYo',
    'oyYYYYYYYo',
    'oyYYYYYYmo',
    'oyYYYYYYmo',
    'oyYYYYYYmo',
    'oyYYYYYYmo',
    'oyYYYYYYmo',
    'oyYYYYYYmo',
    '.oYYYYYYmo',
    '.oYYYYYYmo',
    '.oYYYYYYmo',
    '.oYYYYYYmo',
    '.oYYYYYmmo',
    '.omYmYmmmo',
    '.ommmmmmmo',
    '.oooooooo.'
  ]);
  // --- side arms (near arm, drawn in front of the torso). Hand bottom at -22 for the hanging arm.
  const armSideHang = P(0, -36, [
    'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo',
    'oyyo', 'oyyo',            // folded cuff -26..-25
    'osSo', 'osSo',            // hand -24..-23
    '.oo.'                     // -22
  ]);
  // arm swinging forward (hand ~3 px forward) / backward, for the walk contact frames
  const armSideFwd = P(0, -36, [
    'oYmo...', 'oYmo...', 'oYmo...', '.oYmo..', '.oYmo..', '.oYmo..', '..oYmo.', '..oYmo.', '..oYmo.', '...oYmo',
    '...oyyo', '...oyyo',
    '...osSo', '...osSo',
    '....oo.'
  ]);
  const armSideBack = P(-3, -36, [
    '...oYmo', '...oYmo', '...oYmo', '..oYmo.', '..oYmo.', '..oYmo.', '.oYmo..', '.oYmo..', '.oYmo..', 'oYmo...',
    'oyyo...', 'oyyo...',
    'osSo...', 'osSo...',
    '.oo....'
  ]);
  // far arm (behind the torso) peeking out when swinging: darker
  const armSideFarBack = P(-3, -35, [
    '...omo', '...omo', '..omo.', '..omo.', '.omo..', '.omo..', 'omo...', 'omo...', 'omo...', 'omo...',
    'omo...', 'oSo...', 'oSo...', '.o....'
  ]);
  // carry: near arm bent, forearm forward; hand at x 5..6, y -28..-26 (under the plate's near edge)
  const armSideCarry = P(0, -36, [
    'oYmo....',
    'oYmo....',
    'oYmo....',
    'oYmo....',
    'oYmo....',
    'oYmo....',
    'oYmoo...',
    'oYYYYoo.',
    '.oYYyyso',
    '..ooysSo',
    '....oooo'
  ]);
  // far arm for carry: parallel, 1 px higher and behind (shade colors)
  const armSideCarryFar = P(-1, -36, [
    'omo.....',
    'omo.....',
    'omo.....',
    'omo.....',
    'omo.....',
    'omoo....',
    'ommmoo..',
    '.ommmmSo',
    '..ooooo.'
  ]);
  // stir: near arm raised forward; 2x2 hand at x 7..8 (frame 0, rows -34..-33) / x 8..9 (frame 1, rows -33..-32).
  // The spoon is drawn BEFORE this arm so the hand grips the handle.
  const armSideStir = [
    P(0, -37, [
      'oYmo......',
      'oYmmoo....',
      '.oYYmmooo.',
      '..oYyymsso',
      '...oyyosSo',
      '....oooooo'
    ]),
    P(0, -37, [
      'oYmo.......',
      'oYmmoo.....',
      '.oYYmmooo..',
      '..oYYyymooo',
      '...oyyyosso',
      '....oooosSo',
      '.......oooo'
    ])
  ];
  // reach: near arm extended straight forward (slightly raised shoulder) to a shelf; hand at x 10..11, rows -39..-37
  const armSideReach = P(0, -40, [
    '.........oooo',
    '.ooooooooysso',
    'oYYYYYYYyysSo',
    'oYmmmmmmyysSo',
    '.ooooooooooo.'
  ]);
  // yawn: elbow pulled forward, forearm straight up, hand (x 5..6, rows -43..-41) over the mouth
  const armSideYawn = P(0, -43, [
    '....osso',
    '....osSo',
    '....osSo',
    '....oyyo',
    '....oyyo',
    '....oYmo',
    'oYmooYmo',
    'oYmmoYmo',
    '.oYmmYmo',
    '..oYmmmo',
    '...oYmmo',
    '....oooo'
  ]);
  // --- legs (side). Standing: 9 x 21 (-21..-1). Walk frames are wider; pass frames are 22 rows (bob).
  const legsSideStand = P(-4, -21, [
    'oJJJJJJo.',
    'ojJJJJJo.',
    'ojJJJJJo.',
    'ojJJJJJo.',
    'ojJJJJJo.',
    'ojJJJJJo.',
    'ojJJJJJo.',
    'onoJJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'onojJJJo.',
    'oBobbbbbo',
    'oBoBbbbbo',
    '.oooooooo'
  ]);
  // contact A: near leg forward (right), far leg back (left). 13 wide (x -6..6)
  const legsSideA = P(-6, -21, [
    '..oJJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..onnojJJo...',
    '.onnnoojJJo..',
    '.onno.ojJJo..',
    '.onno.ojJJo..',
    '.onno..ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'onno...ojJJo.',
    'oBBbo..obbbbo',
    'oBBbo..oBbbbo',
    '.ooo....ooooo'
  ]);
  // pass 1: near leg straight under the body (22 rows -> body bobs up 1), far leg swinging behind, foot lifted
  const legsSidePass = P(-4, -22, [
    '.oJJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.onojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'onnojJJJo.',
    'oBBojJJJo.',
    'oBBoojJJo.',
    '.oobbbbbbo',
    '..oBbbbbbo',
    '...ooooooo'
  ]);
  // contact B: far leg forward (right, shaded), near leg back (left)
  const legsSideB = P(-6, -21, [
    '..oJJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJJJJo...',
    '..ojJJonno...',
    '.ojJJoonnno..',
    '.ojJJo.onno..',
    '.ojJJo.onno..',
    '.ojJJo..onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'ojJJo...onno.',
    'obbbo...oBBBo',
    'oBbbo...oBBBo',
    '.ooo.....ooo.'
  ]);
  // pass 2: far leg straight under the body, near leg swinging in front, foot lifted
  const legsSidePass2 = P(-4, -22, [
    '.oJJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJJJo.',
    '.ojJJJonno',
    '.ojJJoonno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.ojJJo.nno',
    '.obbbbonno',
    '.oBbbbonno',
    '..oooooBBo',
    '......oBBo',
    '.......ooo'
  ]);

  // ================================================================== FRONT VIEW
  // --- head: 14 x 13 (x -7..6), clip on screen-left, fringe swept to screen-right
  const headFront = P(-7, -52, [
    '....oooooo....',
    '...ohhhhhHo...',
    '..ohhhhHHHHo..',
    '.ohhhhHHHHHHo.',
    'ohhhHHHHHHHHHo',
    'oHkoSSsssdHHHo',
    'oHossssssssdHo',
    'oHossssssssdHo',
    'oHossssssssdHo',
    'oHocsssssscdHo',
    'oHosssssssssHo',
    '.oHoSSSSSSoHo.',
    '.oo.oo...oo.oo'
  ]);
  // front face overlays: eyes at x -3..-2 and 1..2 rows -45..-44; mouth around x -1..1 row -42
  const faceFront = {
    eyeOpen:   P(-3, -45, ['we..we', 'ee..ee']),
    eyeBlink:  P(-3, -44, ['ee..ee']),
    eyeClosed: P(-4, -45, ['.e...e.', 'e.e.e.e']),
    eyeSleepy: P(-3, -45, ['SS..SS', 'ee..ee']),
    browUp:    P(-3, -47, ['dd']),
    mouthSmile:   P(-2, -43, ['u...u', '.uuu.']),
    mouthNeutral: P(-1, -42, ['uu']),
    mouthUnsure:  P(-2, -43, ['...uu', 'uu...']),
    mouthOpen:    P(-1, -43, ['uu', 'uu']),
    mouthChew:    P(-1, -42, ['uu'])
  };
  const neckFront = P(-2, -40, ['oSSSo', 'oSSSo']);
  // --- torso: 12 x 17 (x -6..5)
  const torsoFront = P(-6, -38, [
    '.oooooooooo.',
    'oyyYySSyYYmo',
    'oyyYYyyYYYmo',
    'oyyYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.omYmYmYmmo.',
    '.ommmmmmmmo.',
    '.oooooooooo.'
  ]);
  const torsoBack = P(-6, -38, [
    '.oooooooooo.',
    'oyyYYYYYYYmo',
    'oyyYYYYYYYmo',
    'oyyYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    'oyYYYYYYYYmo',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.oYYYYYYYmo.',
    '.omYmYmYmmo.',
    '.ommmmmmmmo.',
    '.oooooooooo.'
  ]);
  // --- front/back arms hanging: left arm at x -10..-7, right arm at x 6..9
  const armL = P(-9, -37, [
    '..oo', 'oYYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo',
    'oyyo', 'oyyo', 'osSo', 'osSo', '.oo.'
  ]);
  const armR = P(5, -37, [
    'oo..', 'oYYo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo',
    'oyyo', 'oyyo', 'osSo', 'osSo', '.oo.'
  ]);
  // carry seen from behind: only the upper arms show (forearms are in front of her), ending at the elbow (-29)
  const armLUpper = P(-9, -37, ['..oo', 'oYYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', '.oo.']);
  const armRUpper = P(5, -37, ['oo..', 'oYYo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', '.oo.']);
  // carry (front): upper arm down the side to the elbow, forearm toward the camera + inward; hands meet under the plate
  const armLCarry = P(-9, -38, [
    '..oo.....',
    'oYYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYoo....',
    'oyYYYoo..',
    '.oYYyyoo.',
    '..ooyysso',
    '....ooooo'
  ]);
  const armRCarry = P(1, -38, [
    '.....oo..',
    '.....oYYo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '....ooYmo',
    '..ooYYYmo',
    '.ooyymYo.',
    'ossyyoo..',
    'ooooo....'
  ]);
  // yawn (front): her right arm (screen-left): upper arm down, forearm up across the chest, hand (x -1..2, rows -43..-41) on the mouth
  const armLYawn = P(-9, -43, [
    '........osso',
    '........osSo',
    '........osSo',
    '.......oyyo.',
    '.......oyyo.',
    '......oYmo..',
    '..oo..oYmo..',
    'oYYo.oYmo...',
    'oyYo.oYmo...',
    'oyYooYmo....',
    'oyYooYmo....',
    'oyYoYmo.....',
    'oyYoYmo.....',
    'oyYYmo......',
    'oyYYmo......',
    'oyYmo.......',
    'oyYmo.......',
    '.oooo.......'
  ]);

  // ================================================================== BACK VIEW
  const headBack = P(-7, -52, [
    '....oooooo....',
    '...ohhhhhHo...',
    '..ohhhhHHHHo..',
    '.ohhhhHHHHHHo.',
    'ohhhHHHHHHHHHo',
    'ohhHHHHHHHHHko',
    'ohHHHHHHHHHHko',
    'oHHHHHHHHHHHHo',
    'oHHHHHHHHHHHHo',
    'oHHHHHHHHHHHHo',
    'oHHHHHHHHHdddo',
    '.oHHddddddddo.',
    '.oooooooooooo.'
  ]);

  // ================================================================== FRONT/BACK LEGS
  // standing: 10 x 21 (x -5..4)
  const legsFrontStand = P(-5, -21, [
    'oJJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJoJJJo',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'obbboobbbo',
    'oBBboobBBo',
    'oooooooooo'
  ]);
  // walk contact A: screen-left leg lifted (bent), right leg straight
  const legsFrontA = P(-5, -21, [
    'oJJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJoJJJo',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'obbbooJJno',
    'oBBbooJJno',
    'oooooobbbo',
    '....oobBBo',
    '....oooooo'
  ]);
  const legsFrontB = P(-5, -21, [
    'oJJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJoJJJo',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJoobbbo',
    'ojJJoobBBo',
    'obbbooooo.',
    'oBBboo....',
    'oooooo....'
  ]);
  // pass: 22 rows (bob), feet together
  const legsFrontPass = P(-5, -22, [
    'oJJJJJJJJo',
    'oJJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJJJJJo',
    'ojJJJoJJJo',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'ojJJooJJno',
    'obbboobbbo',
    'oBBboobBBo',
    'oooooooooo'
  ]);
  const heelTones = { b: 'shoe2', B: 'shoe1' };            // from behind the heel (dark) is on top
  const legsBackStand = S.recolor(legsFrontStand, heelTones), legsBackA = S.recolor(legsFrontA, heelTones);
  const legsBackB = S.recolor(legsFrontB, heelTones), legsBackPass = S.recolor(legsFrontPass, heelTones);

  // ================================================================== SEATED (front) — base = lap line
  // torso truncated to 16 rows (-16..-1): same rows as torsoFront minus the hem outline
  const torsoSit = P(-6, -16, torsoFront.rows.slice(0, 16));
  // arms on the table: upper arm down, forearm inward along the base; hands at x -3..-1 / 0..2, y -4..-2
  const armLSit = P(-9, -16, [
    '..oo.....',
    'oYYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYoo....',
    'oyYYYoo..',
    '.oYYyyoo.',
    '..ooyysso',
    '....ossso',
    '.....ooo.'
  ]);
  const armRSit = P(1, -16, [
    '.....oo..',
    '.....oYYo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '.....oYmo',
    '....ooYmo',
    '..ooYYYmo',
    '.ooyymYo.',
    'ossyyoo..',
    'osSso....',
    '.ooo.....'
  ]);
  // arms hanging down at the sides (sitBack)
  const armLSitDown = P(-9, -15, [
    '..oo', 'oYYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyYo', 'oyyo', 'oyyo', 'osSo', 'osSo', '.oo.'
  ]);
  const armRSitDown = P(5, -15, [
    'oo..', 'oYYo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oYmo', 'oyyo', 'oyyo', 'osSo', 'osSo', '.oo.'
  ]);
  // right hand (screen-left arm) holding the fork: 4 positions. Hand = 3x3 skin block; the fork goes up from it.
  // down (fork in the plate): hand at x -4..-2, y -5..-3
  const armLForkDown = P(-9, -16, [
    '..oo.....',
    'oYYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYo.....',
    'oyYoo....',
    'oyYYYoo..',
    '.oYYyyoo.',
    '..ooyysso',
    '....osSso',
    '.....ooo.'
  ]);
  // lifting: forearm up across the lap, hand at x -4..-2, rows -10..-8
  const armLForkMid = P(-9, -16, [
    '..oo....',
    'oYYo....',
    'oyYo....',
    'oyYo....',
    'oyYo....',
    'oyYo....',
    'oyYooooo',
    'oyYYyyso',
    '.oYYyySo',
    '..oooooo'
  ]);
  // at the mouth: V-shaped arm, hand at x -3..-1, rows -17..-15 (the fork handle sits in it)
  const armLForkUp = P(-9, -17, [
    '......osso',
    '..oo..osSo',
    'oYYo..osSo',
    'oyYo.oyyo.',
    'oyYo.oyyo.',
    'oyYooYmo..',
    'oyYooYmo..',
    'oyYoYmo...',
    'oyYoYmo...',
    'oyYYmo....',
    'oyYmo.....',
    '.oooo.....'
  ]);

  // ================================================================== ITEMS (drawn in the hands)
  // plate, side view: 14 x 8 (mound 4 rows on top of a 4-row plate). Anchor = top-left; ref hand point = (6, 7)
  const plateSideFull = P(0, 0, [
    '....o4o44o....',
    '...o1a1223ao..',
    '..o12a122a21o.',
    '.o2122a3g2223o',
    'oppppppppppppo',
    'orPPPPPPPPPPro',
    '.oqqqqqqqqqqo.',
    '..oooooooooo..'
  ]);
  const plateSideHalf = P(0, 0, [
    '..............',
    '..............',
    '.....o4ao.....',
    '....o12a2o....',
    'opppo2223opppo',
    'orPPPPPPPPPPro',
    '.oqqqqqqqqqqo.',
    '..oooooooooo..'
  ]);
  // plate, front view (seen slightly from above): 14 x 7
  const plateFrontFull = P(0, 0, [
    '....oooooo....',
    '..oop4o44poo..',
    '.op1a1223a1po.',
    'op12a122a21qpo',
    'orq2122a322qro',
    '.oqq3222a3qqo.',
    '..oooooooooo..'
  ]);
  const plateFrontHalf = P(0, 0, [
    '....oooooo....',
    '..ooppppppoo..',
    '.oppp4oa4pppo.',
    'oppp12a22ppqpo',
    'orqq2223aqqqro',
    '.oqqqqqqqqqqo.',
    '..oooooooooo..'
  ]);
  // wooden spoon (stir pose): drawn procedurally from the hand to the pot so it can be any length/angle.
  // (hx,hy) = grip point relative to the anchor, (tx,ty) = tip (bowl center). flip mirrors around the anchor column.
  function drawSpoon(ctx, fx, by, flip, hx, hy, tx, ty) {
    const X = (x) => fx + (flip ? -x : x), Y = (y) => by + y;
    // handle: 2 px of wood (highlight over base) with a 1 px ink outline above and below
    G.line(ctx, X(hx), Y(hy - 2), X(tx), Y(ty - 2), 'ink');
    G.line(ctx, X(hx), Y(hy + 1), X(tx), Y(ty + 1), 'ink');
    G.line(ctx, X(hx), Y(hy - 1), X(tx), Y(ty - 1), 'spoon1');
    G.line(ctx, X(hx), Y(hy), X(tx), Y(ty), 'spoon2');
    // bowl at the tip: 5x4 with outline
    const bx = flip ? X(tx) - 3 : X(tx) - 1;
    G.rect(ctx, bx, Y(ty) - 3, 5, 4, 'ink');
    G.rect(ctx, bx + 1, Y(ty) - 2, 3, 1, 'spoon1');
    G.rect(ctx, bx + 1, Y(ty) - 1, 3, 1, 'spoon2');
  }
  // fork (front view, held vertically): 3 x 9; tines at the top. Variants with twirled pasta.
  const forkUp = P(0, 0, ['fof', 'fof', 'ffF', '.F.', '.F.', '.F.', '.F.', '.F.', '.o.']);
  const forkUpPasta = P(0, 0, ['.o4ao', 'o12ao', 'o3A3o', '.oFo.', '.oFo.', '.oFo.', '.oFo.', '..o..']);
  const forkDown = P(0, 0, ['.o.', '.F.', '.F.', '.F.', 'ffF', 'fof']);
  // spoon seen in a hanging hand (not used by poses but available for 'spoon' item outside stir)
  const spoonHang = P(0, 0, ['oTo', 'oTo', 'oTo', 'oTo', 'oto', 'oto', '.o.']);

  // ================================================================== FACE
  function drawFaceSide(ctx, fx, by, flip, dy, face, blink) {
    const F = faceSide;
    if (face === 'unsure') put(ctx, F.browUp, fx, by, flip, 0, dy);
    if (blink) put(ctx, F.eyeBlink, fx, by, flip, 0, dy);
    else if (face === 'closed') put(ctx, F.eyeClosed, fx, by, flip, 0, dy);
    else if (face === 'sleepy') put(ctx, F.eyeSleepy, fx, by, flip, 0, dy);
    else put(ctx, F.eyeOpen, fx, by, flip, 0, dy);
    if (face === 'neutral' || face === 'sleepy') put(ctx, F.mouthNeutral, fx, by, flip, 0, dy);
    else if (face === 'unsure') put(ctx, F.mouthUnsure, fx, by, flip, 0, dy);
    else if (face === 'open') put(ctx, F.mouthOpen, fx, by, flip, 0, dy);
    else put(ctx, F.mouthSmile, fx, by, flip, 0, dy);
  }
  function drawFaceFront(ctx, fx, by, dy, face, blink) {
    const F = faceFront;
    if (face === 'unsure') put(ctx, F.browUp, fx, by, false, 0, dy);
    if (blink) put(ctx, F.eyeBlink, fx, by, false, 0, dy);
    else if (face === 'closed') put(ctx, F.eyeClosed, fx, by, false, 0, dy);
    else if (face === 'sleepy') put(ctx, F.eyeSleepy, fx, by, false, 0, dy);
    else put(ctx, F.eyeOpen, fx, by, false, 0, dy);
    if (face === 'neutral' || face === 'sleepy') put(ctx, F.mouthNeutral, fx, by, false, 0, dy);
    else if (face === 'unsure') put(ctx, F.mouthUnsure, fx, by, false, 0, dy);
    else if (face === 'open') put(ctx, F.mouthOpen, fx, by, false, 0, dy);
    else if (face === 'chew') put(ctx, F.mouthChew, fx, by, false, 0, dy);
    else put(ctx, F.mouthSmile, fx, by, false, 0, dy);
  }

  // ================================================================== POSE LOGIC
  function norm(opts) {
    opts = opts || {};
    let dir = opts.dir || 'front';
    if (dir !== 'right' && dir !== 'left' && dir !== 'front' && dir !== 'back') dir = 'front';
    let pose = opts.pose || 'stand';
    const isSit = pose === 'sit' || pose === 'sitEat' || pose === 'sitBack' || pose === 'sitHold';
    if (isSit) dir = 'front';                             // seated poses are front-view only
    const side = dir === 'right' || dir === 'left';
    if (!side && (pose === 'stir')) pose = 'stand';       // side-only poses fall back
    if (!side && pose === 'reach') pose = 'stand';
    if (!side && pose === 'reachPlate') pose = 'carry';
    let frame = Math.max(0, opts.frame | 0);
    return { dir: dir, pose: pose, frame: frame, side: side, flip: dir === 'left', face: opts.face || 'smile',
             blink: !!opts.blink, item: opts.item || null, liftY: opts.liftY | 0, walking: !!opts.walking, isSit: isSit };
  }
  // vertical bob of the upper body for a pose/frame (negative = up)
  function bodyBob(o) {
    if (o.pose === 'walk' || (o.pose === 'carry' && o.walking)) return (o.frame & 1) ? -1 : 0;
    if (o.pose === 'stand') return (o.frame & 1) ? 1 : 0;      // breathing: 1 px down on frame 1
    return 0;
  }
  // legs for a standing pose
  function legsFor(o) {
    const walk = o.pose === 'walk' || (o.pose === 'carry' && o.walking);
    const f = o.frame & 3;
    if (o.side) {
      if (!walk) return legsSideStand;
      return [legsSideA, legsSidePass, legsSideB, legsSidePass2][f];
    }
    if (!walk) return o.dir === 'back' ? legsBackStand : legsFrontStand;
    const set = o.dir === 'back' ? [legsBackA, legsBackPass, legsBackB, legsBackPass] : [legsFrontA, legsFrontPass, legsFrontB, legsFrontPass];
    return set[f];
  }

  // Hand offsets (forward / right hand) per pose; side values are for 'right' (mirrored for 'left')
  function handOffset(o) {
    const bob = bodyBob(o);
    if (o.isSit) {
      if (o.pose === 'sitEat') return [{ x: -3, y: -4 }, { x: -4, y: -10 }, { x: -3, y: -17 }, { x: -3, y: -4 }][o.frame & 3];
      if (o.pose === 'sitHold') return { x: -4, y: -10 };
      if (o.pose === 'sitBack') return { x: -8, y: -3 };
      return { x: -2, y: -3 };
    }
    let h;
    if (o.side) {
      switch (o.pose) {
        case 'carry': h = { x: 6, y: -27 }; break;
        case 'stir': h = o.frame & 1 ? { x: 8, y: -33 } : { x: 7, y: -34 }; break;
        case 'reach': case 'reachPlate': h = { x: 10, y: -39 }; break;
        case 'yawn': h = { x: 5, y: -43 }; break;
        case 'walk': h = [{ x: 3, y: -23 }, { x: 0, y: -23 }, { x: -3, y: -23 }, { x: 0, y: -23 }][o.frame & 3]; break;
        default: h = { x: 0, y: -23 };
      }
      if (o.flip) h = { x: -h.x, y: h.y };
    } else {
      switch (o.pose) {
        case 'carry': h = { x: -2, y: -28 }; break;
        case 'yawn': h = { x: -1, y: -43 }; break;
        default: h = { x: -8, y: -23 };
      }
    }
    h.y += bob;
    return h;
  }

  girl.hand = function (opts) { return handOffset(norm(opts)); };
  girl.headTop = function (opts) {
    const o = norm(opts);
    if (o.isSit) return -30;
    return -52 + bodyBob(o);
  };

  // ------------------------------------------------------------------ item helpers
  function plateDef(item, side) {
    if (item === 'plateHalf') return side ? plateSideHalf : plateFrontHalf;
    return side ? plateSideFull : plateFrontFull;
  }
  // draw a plate so that its bottom-center sits at hand point (hx, hy) (y = top of the hand), relative to the anchor
  function putPlate(ctx, def, fx, by, flip, hx, hy, lift) {
    put(ctx, def, fx, by, flip, hx - 6, hy - 7 + lift);
  }

  // ================================================================== DRAW
  girl.draw = function (ctx, feetX, feetY, opts) {
    const o = norm(opts);
    const fx = feetX | 0, by = feetY | 0;
    const flip = o.flip;
    const item = o.item;

    // ---------------------------------------------------------------- seated poses (front view, base = lap)
    if (o.isSit) {
      const up = 22;                                              // shift standing parts up: -38 -> -16
      let face = o.face, blink = o.blink;
      const f = o.frame & 3;
      // back arm first (screen-right arm is behind nothing, but draw both before the torso for the hanging variant)
      if (o.pose === 'sitBack') {
        put(ctx, armLSitDown, fx, by, false, 0, 0);
        put(ctx, armRSitDown, fx, by, false, 0, 0);
        if (face === 'smile') face = 'closed';
      }
      put(ctx, torsoSit, fx, by, false, 0, 0);
      put(ctx, neckFront, fx, by, false, 0, up);
      put(ctx, headFront, fx, by, false, 0, up);
      if (o.pose === 'sit') {
        put(ctx, armLSit, fx, by, false, 0, 0);
        put(ctx, armRSit, fx, by, false, 0, 0);
      } else if (o.pose === 'sitEat') {
        put(ctx, armRSit, fx, by, false, 0, 0);
        if (f === 0 || f === 3) {                                 // fork down into the plate (tines below the lap line)
          put(ctx, forkDown, fx, by, false, -4, -7);
          put(ctx, armLForkDown, fx, by, false, 0, 0);
          if (f === 3) { face = 'chew'; blink = true; }           // chewing: eyes closed
        } else if (f === 1) {                                     // lifting, pasta on the fork
          put(ctx, forkUpPasta, fx, by, false, -5, -15);
          put(ctx, armLForkMid, fx, by, false, 0, 0);
        } else {                                                  // at the mouth: pasta just under the nose, mouth open
          face = 'open';
          put(ctx, forkUpPasta, fx, by, false, -4, -22);
          put(ctx, armLForkUp, fx, by, false, 0, 0);
        }
      } else if (o.pose === 'sitHold') {
        put(ctx, armRSit, fx, by, false, 0, 0);
        put(ctx, forkUpPasta, fx, by, false, -5, -15);
        put(ctx, armLForkMid, fx, by, false, 0, 0);
        if (face === 'smile') face = 'unsure';
      }
      drawFaceFront(ctx, fx, by, up, face, blink);
      return;
    }

    // ---------------------------------------------------------------- standing poses
    const bob = bodyBob(o);
    const legs = legsFor(o);
    put(ctx, legs, fx, by, flip, 0, 0);
    const hand = handOffset(o);
    const lift = o.liftY;

    if (o.side) {
      // far arm (behind the torso)
      const walk = o.pose === 'walk' || (o.pose === 'carry' && o.walking);
      const f = o.frame & 3;
      if (o.pose === 'walk' && f === 0) put(ctx, armSideFarBack, fx, by, flip, 0, bob);
      if (o.pose === 'carry') put(ctx, armSideCarryFar, fx, by, flip, 0, bob);
      put(ctx, torsoSide, fx, by, flip, 0, bob);
      put(ctx, neckSide, fx, by, flip, 0, bob);
      put(ctx, headSide, fx, by, flip, 0, bob);
      if (flip) put(ctx, clipSide, fx, by, flip, 0, bob);
      let face = o.face;
      if (o.pose === 'yawn') { face = 'open'; }
      drawFaceSide(ctx, fx, by, flip, bob, face, o.blink || o.pose === 'yawn');
      // items that go behind the near arm
      if (o.pose === 'carry' && (item === 'plate' || item === 'plateHalf')) putPlate(ctx, plateDef(item, true), fx, by, flip, 6, -27 + bob, lift);
      // the spoon goes under the near arm so the hand grips its handle
      if (o.pose === 'stir' && (item === 'spoon' || item == null)) {
        if (o.frame & 1) drawSpoon(ctx, fx, by, flip, 8, -33 + bob, 20, -36 + bob);   // bowl inside the pot
        else drawSpoon(ctx, fx, by, flip, 7, -34 + bob, 18, -38 + bob);               // bowl at the rim
      }
      // near arm
      switch (o.pose) {
        case 'walk': put(ctx, [armSideFwd, armSideHang, armSideBack, armSideHang][f], fx, by, flip, 0, bob); break;
        case 'carry': put(ctx, armSideCarry, fx, by, flip, 0, bob); break;
        case 'stir': put(ctx, armSideStir[o.frame & 1], fx, by, flip, 0, bob); break;
        case 'reach': case 'reachPlate': put(ctx, armSideReach, fx, by, flip, 0, bob); break;
        case 'yawn': put(ctx, armSideYawn, fx, by, flip, 0, bob); break;
        default: put(ctx, armSideHang, fx, by, flip, 0, bob);
      }
      // items in the forward hand
      if (o.pose === 'stir') {
        // spoon already drawn
      } else if (o.pose === 'reachPlate' && (item === 'plate' || item === 'plateHalf' || item == null)) {
        putPlate(ctx, plateDef(item || 'plate', true), fx, by, flip, 11, -39 + bob, lift);
      } else if (o.pose !== 'carry' && o.pose !== 'stir' && o.pose !== 'reachPlate' && (item === 'plate' || item === 'plateHalf')) {
        putPlate(ctx, plateDef(item, true), fx, by, flip, hand.x * (flip ? -1 : 1), hand.y - 1, lift);
      } else if (item === 'spoon' && o.pose !== 'stir') {
        put(ctx, spoonHang, fx, by, flip, hand.x * (flip ? -1 : 1) - 1, hand.y - 3);
      } else if (item === 'fork' && o.pose !== 'carry' && o.pose !== 'reachPlate') {
        put(ctx, forkUp, fx, by, flip, hand.x * (flip ? -1 : 1) - 1, hand.y - 7);
      }
      return;
    }

    // front / back
    const back = o.dir === 'back';
    const f = o.frame & 3;
    const walk = o.pose === 'walk' || (o.pose === 'carry' && o.walking);
    const swing = 0;                                        // (front/back arms do not swing: keeps the shoulder line clean)
    if (back && o.pose === 'carry' && (item === 'plate' || item === 'plateHalf')) {
      // plate behind the body: only the edges peek out
      putPlate(ctx, plateDef(item, false), fx, by, false, 1, -27 + bob, lift);
    }
    if (back) {
      put(ctx, torsoBack, fx, by, false, 0, bob);
      put(ctx, neckFront, fx, by, false, 0, bob);
      put(ctx, headBack, fx, by, false, 0, bob);
      if (o.pose === 'carry') {
        put(ctx, armLUpper, fx, by, false, 0, bob);
        put(ctx, armRUpper, fx, by, false, 0, bob);
      } else {
        put(ctx, armL, fx, by, false, 0, bob + swing);
        put(ctx, armR, fx, by, false, 0, bob - swing);
      }
      return;
    }
    put(ctx, torsoFront, fx, by, false, 0, bob);
    put(ctx, neckFront, fx, by, false, 0, bob);
    put(ctx, headFront, fx, by, false, 0, bob);
    let face = o.face, blink = o.blink;
    if (o.pose === 'yawn') { face = 'open'; blink = true; }
    drawFaceFront(ctx, fx, by, bob, face, blink);
    if (o.pose === 'carry') {
      put(ctx, armLCarry, fx, by, false, 0, bob);
      put(ctx, armRCarry, fx, by, false, 0, bob);
      if (item === 'plate' || item === 'plateHalf') putPlate(ctx, plateDef(item, false), fx, by, false, 1, -28 + bob, lift);
    } else if (o.pose === 'yawn') {
      put(ctx, armLYawn, fx, by, false, 0, bob);
      put(ctx, armR, fx, by, false, 0, bob);
    } else {
      put(ctx, armL, fx, by, false, 0, bob + swing);
      put(ctx, armR, fx, by, false, 0, bob - swing);
      if (item === 'plate' || item === 'plateHalf') putPlate(ctx, plateDef(item, false), fx, by, false, -8, -24 + bob, lift);
      else if (item === 'fork') put(ctx, forkUp, fx, by, false, -9, -30 + bob);
      else if (item === 'spoon') put(ctx, spoonHang, fx, by, false, -9, -26 + bob);
    }
  };

  // expose parts for tooling / previews
  girl._parts = { headSide: headSide, headFront: headFront, headBack: headBack, torsoSide: torsoSide, torsoFront: torsoFront };

  PSA.girl = girl;
})(window.PSA);
