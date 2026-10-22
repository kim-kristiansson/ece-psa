// STORY: the single source of truth for timing, the in-story clock, lighting over the day, and text lines.
// Scene modules (s1_cooking.js ... s7_info.js) register render functions in PSA.shots[id] for every id below.
// All times in seconds. Total duration ~2:15.
(function (PSA) {
  const G = PSA.gfx;
  const ST = {};

  // ---------------------------------------------------------------- SHOT LIST
  // in: transition INTO the shot from the previous one: cut | cross | fade (through black)
  const SH = [
    // SCENE 1 - COOKING (warm, cozy). Opens on the wide shot (fading in from black), title overlay in the first seconds.
    { id: 'S1a', start: 0.0,  end: 9.5,  in: { type: 'cut' },            note: 'WIDE kitchen, 6:30 PM, girl stirring at the stove. Fade in from black 0-1.5s. Title "SMALL MISTAKES, BIG RISKS" overlay 1.2-4.6s. Narration box 5.2-9.3.',
      text: [ { t0: 5.2, t1: 9.3, text: 'A quiet evening. Pasta for dinner.', bullet: '*' } ] },
    { id: 'S1b', start: 9.5,  end: 13.0, in: { type: 'cross', dur: 0.7 }, note: 'CLOSE-UP pot on the stove: boiling water, bubbles, steam, flame; tiles behind.' },
    { id: 'S1c', start: 13.0, end: 16.5, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP hand lowering dry spaghetti into the pot; strands fan out and sink.' },
    { id: 'S1d', start: 16.5, end: 20.0, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP stirring the pasta with a wooden spoon; steam.' },
    { id: 'S1e', start: 20.0, end: 25.0, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP serving: pasta lifted into a plate, sauce ladled on top; plate finished.' },
    // SCENE 2 - EATING AND LEAVING THE LEFTOVERS
    { id: 'S2a', start: 25.0, end: 30.0, in: { type: 'cross', dur: 0.8 }, note: 'MEDIUM table: girl carries the plate in, sets it down (clink), sits. Clock 7:00 PM.' },
    { id: 'S2b', start: 30.0, end: 34.0, in: { type: 'cross', dur: 0.5 }, note: 'CLOSE-UP fork twirls pasta and lifts it.' },
    { id: 'S2c', start: 34.0, end: 39.5, in: { type: 'cross', dur: 0.5 }, note: 'MEDIUM table: she eats two bites (happy), leans back content; plate still half full. Thought box 36.8-39.5 (continues in S2d).',
      text: [ { t0: 2.8, t1: 6.5, text: "I'll put it away later.", bullet: null } ] },
    { id: 'S2d', start: 39.5, end: 45.0, in: { type: 'cut' },            note: 'WIDE: she stands up, walks out to the left; the plate stays on the table; fridge visible, closed. Dusk in the window.',
      text: [ { t0: -1.0, t1: 1.0, text: "I'll put it away later.", bullet: null, instant: true, silent: true } ] },
    // SCENE 3 - TIME PASSES (cozy -> mysterious)
    { id: 'S3a', start: 45.0, end: 50.0, in: { type: 'cross', dur: 1.0 }, note: 'CLOSE-UP table: the leftover plate + fork, wall clock (7:10 PM) and window (dusk) behind. Steam gone. Ticking starts softly.' },
    { id: 'S3b', start: 50.0, end: 56.0, in: { type: 'cross', dur: 0.8 }, note: 'CLOCK CLOSE-UP: hands advance 7:10 -> 9:00 PM (readable), caption "9:00 PM" settles. Light cools.' },
    { id: 'S3c', start: 56.0, end: 61.5, in: { type: 'cross', dur: 0.8 }, note: 'WIDE room, darker, lamp still on: plate still on the table; wall clock moves 9:00 -> 11:00 PM; window night.' },
    { id: 'S3d', start: 61.5, end: 69.0, in: { type: 'cross', dur: 0.8 }, note: 'CLOSE-UP table at night (lamp off, moonlight): same plate; clock reaches 12:00. Narration 64.5-69.',
      text: [ { t0: 3.0, t1: 7.5, text: 'Midnight. The pasta has been out for 5 hours.', bullet: '*' } ] },
    // SCENE 4 - SHE FINALLY PUTS IT AWAY (late night, cooler light)
    { id: 'S4a', start: 69.0, end: 74.5, in: { type: 'cross', dur: 0.8 }, note: 'WIDE/MEDIUM: lamp clicks on, sleepy girl walks in from the left, notices the plate ("!" 70.8), picks it up (72.5), walks right; camera pans toward the fridge.' },
    { id: 'S4b', start: 74.5, end: 81.0, in: { type: 'cut' },            note: 'MEDIUM fridge: opens door (75.5), fridge light spills, plate goes in (77.0), door closes (78.5), she walks off; lamp off (80.0).' },
    // SCENE 5 - THE NEXT DAY (quiet, pale, slightly unsettling)
    { id: 'S5a', start: 81.0, end: 86.0, in: { type: 'fade', dur: 2.0 },  note: 'WIDE morning, 8:00 AM, pale cool light, window bright. Narration 82-85. Girl walks in to the fridge.',
      text: [ { t0: 1.0, t1: 4.2, text: 'The next morning.', bullet: '*' } ] },
    { id: 'S5b', start: 86.0, end: 92.0, in: { type: 'cut' },            note: 'MEDIUM fridge: opens (86.8), takes the plate out (88.0), closes (89.3), walks to the table, sets the plate down (91.3).' },
    { id: 'S5c', start: 92.0, end: 96.0, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP plate: the pasta looks normal (just cold and matte). No steam.' },
    { id: 'S5d', start: 96.0, end: 101.0, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP portrait: she looks at it, sniffs, expression turns uncertain; "?" at 99.5.' },
    { id: 'S5e', start: 101.0, end: 107.0, in: { type: 'cross', dur: 0.6 }, note: 'CLOSE-UP hand + fork with twirled pasta rising toward the mouth (top of frame), slows... stops at 104.5. Music ducks to silence. Hold.' },
    { id: 'S5f', start: 107.0, end: 111.5, in: { type: 'cut' },            note: 'Same composition; RPG choice menu appears: "Eat it" / "Throw it out"; cursor wavers between them (107.6 -> 108.8 -> 110.0), hovers. HARD CUT to black at 111.5.' },
    // SCENE 6 - THE QUESTION
    { id: 'S6a', start: 111.5, end: 116.5, in: { type: 'cut' },           note: 'BLACK. "WOULD YOU EAT IT?" appears at 112.2 (typed, large). Near silence then low drone.' },
    { id: 'S6b', start: 116.5, end: 121.5, in: { type: 'cut' },           note: 'Second line "IT LOOKS FINE. BUT IS IT SAFE?" appears at 116.8 below the first. Hold.' },
    // SCENE 7 - FINAL FOOD SAFETY MESSAGE
    { id: 'S7',  start: 121.5, end: 135.5, in: { type: 'fade', dur: 1.2 }, note: 'Info screen: "FOOD SAFETY" 122.0; line1 123.5; line2 126.5; line3 129.5; slogan "WHEN IN DOUBT, THROW IT OUT." 132.5; hold; fade to black 134.2-135.5. Nothing after the slogan.' }
  ];
  ST.shots = SH;
  ST.duration = 135.5;

  // Exact final-screen copy (do not change wording)
  ST.INFO = {
    heading: 'FOOD SAFETY',
    lines: [
      'Perishable food should not stay at room temperature for more than 2 hours.',
      'Above 32°C? Refrigerate within 1 hour.',
      'Food can be unsafe even when it looks and smells normal.'
    ],
    slogan: 'WHEN IN DOUBT, THROW IT OUT.'
  };
  ST.QUESTION1 = 'WOULD YOU EAT IT?';
  ST.QUESTION2 = 'IT LOOKS FINE. BUT IS IT SAFE?';
  ST.TITLE = 'SMALL MISTAKES, BIG RISKS';

  // ---------------------------------------------------------------- IN-STORY CLOCK
  // Returns {h, m} (24h). Wall clocks must use this so every shot agrees.
  const clockKeys = [ // [videoTime, storyMinutes]
    [0,    18 * 60 + 30], // 6:30 PM cooking
    [25,   18 * 60 + 58],
    [25.5, 19 * 60 + 0],  // 7:00 PM dinner
    [45,   19 * 60 + 10], // 7:10 PM plate left
    [50,   19 * 60 + 10],
    [56,   21 * 60 + 0],  // 9:00 PM (clock close-up ends)
    [61.5, 23 * 60 + 0],  // 11:00 PM (wide ends)
    [65.5, 24 * 60 + 0],  // 12:00 AM midnight
    [69,   24 * 60 + 0],
    [81,   24 * 60 + 6],  // 12:06 AM put away
    [81.001, 32 * 60 + 0], // next morning 8:00 AM
    [111.5, 32 * 60 + 12]
  ];
  ST.clockMinutes = function (t) {
    if (t <= clockKeys[0][0]) return clockKeys[0][1];
    for (let i = 1; i < clockKeys.length; i++) {
      if (t <= clockKeys[i][0]) {
        const a = clockKeys[i - 1], b = clockKeys[i];
        return G.lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return clockKeys[clockKeys.length - 1][1];
  };
  ST.clock = function (t) {
    const m = ST.clockMinutes(t);
    const h = Math.floor(m / 60) % 24;
    return { h: h, m: m % 60, minutes: m };
  };
  ST.clockLabel = function (t) {
    const c = ST.clock(t);
    const h12 = ((Math.floor(c.h) + 11) % 12) + 1;
    const mm = Math.floor(c.m);
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (c.h < 12 ? 'AM' : 'PM');
  };

  // ---------------------------------------------------------------- SKY / LIGHT OVER THE STORY
  // sky: 'sunset'|'dusk'|'night'|'morning' with phase 0..1 inside; lampOn; tint state for PSA.light.apply
  const LIGHT = {
    evening:  { tint: '#ffffff',   strength: 0.0,  vignette: 0.0, warm: 0.15 },
    dusk:     { tint: 'tintDusk',  strength: 0.35, vignette: 0.1, warm: 0.1 },
    evening2: { tint: 'tintEvening', strength: 0.5, vignette: 0.25, warm: 0.05 },
    night:    { tint: 'tintNight', strength: 0.75, vignette: 0.45, warm: 0.0 },
    late:     { tint: 'tintLate',  strength: 0.45, vignette: 0.3, warm: 0.0 },
    morning:  { tint: 'tintMorning', strength: 0.35, vignette: 0.15, warm: 0.0 }
  };
  ST.LIGHT = LIGHT;
  ST.light = function (t) {
    const L = PSA.light;
    if (t < 45)   return { sky: 'sunset', phase: G.span(t, 0, 45) * 0.6, lampOn: true, state: LIGHT.evening };
    if (t < 50)   return { sky: 'sunset', phase: G.lerp(0.6, 1.0, G.span(t, 45, 50)), lampOn: true, state: L.mix(LIGHT.evening, LIGHT.dusk, G.span(t, 45, 50)) };
    if (t < 56)   return { sky: 'dusk', phase: G.span(t, 50, 56), lampOn: true, state: L.mix(LIGHT.dusk, LIGHT.evening2, G.span(t, 50, 56)) };
    if (t < 61.5) return { sky: 'night', phase: G.span(t, 56, 61.5) * 0.6, lampOn: true, state: L.mix(LIGHT.evening2, LIGHT.night, G.span(t, 56, 61.5) * 0.6) };
    if (t < 69)   return { sky: 'night', phase: 1, lampOn: false, state: LIGHT.night };
    if (t < 69.6) return { sky: 'night', phase: 1, lampOn: false, state: LIGHT.night };               // S4a before the lamp click
    if (t < 80.0) return { sky: 'night', phase: 1, lampOn: true, state: LIGHT.late };                  // lamp on, late-night cool
    if (t < 81)   return { sky: 'night', phase: 1, lampOn: false, state: LIGHT.night };                // lamp off, leaving
    return { sky: 'morning', phase: G.span(t, 81, 111.5), lampOn: false, state: LIGHT.morning };
  };

  // Where is the plate of pasta at time t? (for wide shots) 'none' | 'counter' | 'carried' | 'table' | 'fridge' | 'carriedBack'
  ST.plate = function (t) {
    if (t < 25) return 'counter';
    if (t < 27.3) return 'carried';
    if (t < 72.5) return 'table';
    if (t < 77.0) return 'carried';
    if (t < 88.0) return 'fridge';
    if (t < 91.3) return 'carriedBack';
    return 'table';
  };

  // Install
  PSA.story = ST;
  PSA.timeline.set(SH.map((s) => Object.assign({}, s)));
})(window.PSA);
