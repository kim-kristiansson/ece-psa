// Shared palette. Use palette KEYS (strings) everywhere so the whole video shares one harmonious set of colors.
// Grouped by use. Keep additions minimal and in the same warm/retro register.
(function (PSA) {
  PSA.PAL = {
    // --- outlines / neutrals ---
    ink:        '#2b1d1e',   // warm near-black outline (never use pure #000 for art; UI may use black)
    black:      '#000000',
    white:      '#ffffff',
    uiBorder:   '#f4f1e8',   // text box border
    uiText:     '#f4f1e8',
    uiDim:      '#9a948a',
    uiAccent:   '#f0c46a',   // highlight / cursor color in UI
    uiRed:      '#e0564a',   // sparingly, for the final slogan accent

    // --- wall / room ---
    wall:       '#f0dfbf',
    wallShade:  '#e2cca3',
    wallLine:   '#d8bf95',
    baseboard:  '#8a5a36',
    floor1:     '#b9804f',   // wood planks (light)
    floor2:     '#a46d3f',
    floor3:     '#8a5631',
    floorLine:  '#6f4224',
    rug1:       '#b94a3c',
    rug2:       '#8f3a2e',
    rug3:       '#e0b05a',

    // --- furniture wood ---
    wood1:      '#d19a62',
    wood2:      '#ab7240',
    wood3:      '#7e4e2b',
    wood4:      '#5a3420',

    // --- kitchen ---
    tile1:      '#8fbfb6',   // backsplash tiles
    tile2:      '#6fa39b',
    tileLine:   '#4f8079',
    counter1:   '#e8e1d2',   // counter top
    counter2:   '#c9bfae',
    cabinet1:   '#7ea38f',   // sage green cabinets
    cabinet2:   '#5f8470',
    cabinet3:   '#43604f',
    metal1:     '#d6dadc',
    metal2:     '#9ea5aa',
    metal3:     '#6c747a',
    metal4:     '#454b50',
    stoveTop:   '#3c3f44',
    flame1:     '#ffd36b',
    flame2:     '#ff8c3a',
    flame3:     '#4f7fd6',

    // --- fridge ---
    fridge1:    '#eef1f3',
    fridge2:    '#cfd6db',
    fridge3:    '#a3adb5',
    fridge4:    '#6c767e',
    fridgeLight:'#fff7d6',
    fridgeIn1:  '#f6f8fa',
    fridgeIn2:  '#d9e2e8',
    fridgeIn3:  '#aeb9c2',

    // --- pot / water ---
    pot1:       '#b9c3c9',
    pot2:       '#8a969e',
    pot3:       '#5e6a73',
    pot4:       '#3b444b',
    water1:     '#e9f6fb',   // foam / highlight
    water2:     '#a9d4ea',
    water3:     '#7fb6d6',
    water4:     '#5a93b6',
    steam:      '#ffffff',

    // --- food ---
    pasta1:     '#f6dc80',   // highlight
    pasta2:     '#e6c15a',   // base
    pasta3:     '#c29a3b',   // shade
    pasta4:     '#8f6e28',   // deep shade / outline
    pastaDry1:  '#efd79a',
    pastaDry2:  '#cdb06a',
    sauce1:     '#e85a3f',
    sauce2:     '#c0392b',
    sauce3:     '#8e2a1f',
    basil:      '#4f8a3a',
    basil2:     '#366a28',
    plate1:     '#f8f3e8',
    plate2:     '#ddd3c2',
    plate3:     '#b9ad9a',
    plateRim:   '#7fa8b2',   // thin decorative rim stripe
    fork1:      '#e3e7ea',
    fork2:      '#a8b0b6',
    fork3:      '#6d757b',
    spoon1:     '#d9a86c',   // wooden spoon
    spoon2:     '#a77a42',

    // --- girl (main character, keep EXACT) ---
    skin:       '#f3c9a3',
    skinShade:  '#d9a47c',
    cheek:      '#eaa08c',
    hair1:      '#8d5233',   // highlight
    hair2:      '#6b3a24',   // base (chestnut)
    hair3:      '#4a2617',   // shade
    sweater1:   '#f0c46a',   // highlight
    sweater2:   '#e3a84a',   // base (mustard)
    sweater3:   '#b8822f',   // shade
    jeans1:     '#4e6f94',
    jeans2:     '#3f5a7a',
    jeans3:     '#2c3f57',
    shoe1:      '#6e4632',
    shoe2:      '#4a2f22',
    eye:        '#2b1d1e',
    eyeWhite:   '#fbf7f0',
    mouth:      '#b05a52',
    clip:       '#4fa3a0',   // teal hair clip accent

    // --- window / sky (evening -> night -> morning) ---
    skySunset1: '#f6c276',
    skySunset2: '#ee8f5a',
    skySunset3: '#c9636a',
    skyDusk1:   '#9a6f94',
    skyDusk2:   '#5f5a8d',
    skyDusk3:   '#3b3f6b',
    skyNight1:  '#2a3560',
    skyNight2:  '#1c2545',
    skyNight3:  '#121a33',
    moon:       '#f2ecd0',
    star:       '#e8e4d8',
    skyMorn1:   '#eef4f7',
    skyMorn2:   '#c3dcea',
    skyMorn3:   '#9ec2d8',
    frame1:     '#f7f2e6',   // window frame
    frame2:     '#cdbfa6',
    curtain1:   '#e0b05a',
    curtain2:   '#b88a3d',

    // --- lamp / light ---
    lampShade1: '#f3d08a',
    lampShade2: '#d9a84f',
    lampLight:  '#ffe9a8',   // dithered light pool
    lampGlow:   '#fff3c8',

    // --- clock ---
    clockFace:  '#fbf6ea',
    clockRim:   '#5a3420',
    clockHand:  '#2b1d1e',
    clockSec:   '#c0392b',

    // --- plants / decor ---
    leaf1:      '#7fb069',
    leaf2:      '#55883f',
    leaf3:      '#3a6430',
    potClay1:   '#d08a5a',
    potClay2:   '#a0623a',

    // --- lighting tints (used by PSA.light) ---
    tintDusk:   '#d9cfe8',
    tintEvening:'#b9b4dc',
    tintNight:  '#5f6fae',
    tintMoon:   '#6c7ec0',
    tintMorning:'#dfe9f1',
    tintLate:   '#9aa0d8'
  };
})(window.PSA);
