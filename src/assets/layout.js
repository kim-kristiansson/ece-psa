// ROOM LAYOUT — shared world coordinates (native pixels). The viewport is 384x216; the world is 448 wide so the
// camera can pan (camera x in 0..64). Everything that places furniture, props or the girl in the room uses these.
// Projection: classic RPG oblique view. Back wall from y=0 to the wall/floor seam at y=floorY; the floor continues
// down to y=216. Objects "against the back wall" have their base at/just below the seam; things closer to the camera are
// lower on screen and drawn later (y-sort by base y).
(function (PSA) {
  PSA.LAYOUT = {
    worldW: 448,
    floorY: 140,                                        // wall/floor seam
    wideCam: 32,                                        // default wide-shot camera x (shows world 32..416)

    // --- dining area (left) ---
    shelf:    { x: 20, y: 62, w: 40 },                  // small wall shelf with a potted plant + a jar
    lamp:     { cx: 98, cordTop: 0, shadeY: 24, shadeW: 26, shadeH: 14 },   // pendant lamp above the table
    clock:    { cx: 146, cy: 48, r: 11 },               // wall clock between the table and the window
    chair:    { cx: 98, backTop: 86, seatY: 120 },      // chair BEHIND the table (far side), seat hidden by the table
    table:    { x: 56, y: 118, w: 84, h: 28, legH: 14 },// table top surface rectangle (front edge at y+h=146), legs below
    plateOnTable: { cx: 98, cy: 132 },                  // plate center when it sits on the table
    forkOnTable:  { x: 112, y: 134 },                   // fork resting beside the plate
    rug:      { x: 40, y: 142, w: 116, h: 40 },         // rug on the floor under/in front of the table

    // --- window on the back wall (between dining and kitchen) ---
    window:   { x: 166, y: 26, w: 56, h: 66 },

    // --- kitchen (right) ---
    upperCabinets: { x: 232, y: 26, w: 134, h: 38 },    // y 26..64, with a range hood section above the stove
    counter:  { x: 232, y: 120, w: 134, topH: 7, frontH: 13 },   // top surface band y 120..126, cabinet fronts 127..140 (counter top = 30px above the girl's feet at the stove mark = waist/hip height)
    stove:    { x: 290, y: 120, w: 50 },                // stove section inside the counter (dark cooktop band + knobs on the front)
    burnerFL: { cx: 304, cy: 125 },                     // front-left burner: the pot sits here
    burnerBR: { cx: 326, cy: 122 },
    potSmall: { cx: 304, bottomY: 126, w: 22, h: 14 },  // small pot on the burner (body spans y 112..126)
    fridge:   { x: 376, y: 76, w: 44, h: 70, hinge: 'right', doorOpenW: 16 },  // body 376..420 x 76..146 (bottom 6px below the seam); door hinge on the RIGHT, swings open to the right (panel 420..436)
    fridgeShelfYs: [96, 114, 132],                      // interior shelf lines (plate goes on the middle shelf at y=114)
    plateInFridge: { cx: 398, cy: 112 },

    // --- character marks: FEET positions (bottom-center of the standing sprite) ---
    marks: {
      stove:      { x: 282, y: 150, dir: 'right' },     // cooking: pot to her right, forward hand reaches the pot
      tableSeat:  { x: 98,  y: 120, dir: 'front' },     // seated behind the table: draw 'sit' pose with its base (lap line) at y=120, then the table on top
      tableFront: { x: 98,  y: 176, dir: 'front' },     // standing in front of the table (near side)
      tableSide:  { x: 152, y: 160, dir: 'left' },      // standing at the right end of the table (to set the plate down)
      fridge:     { x: 356, y: 152, dir: 'right' },     // standing at the fridge, facing it
      exitLeft:   { x: -24, y: 166 },                   // off-screen left (living room)
      walkY: 166                                        // default walking line on the floor
    }
  };
})(window.PSA);
