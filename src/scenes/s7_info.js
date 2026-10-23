// SCENE 7 — THE NUMBERS AND THE RULES. Black cards in the Undertale text style, typed letter by letter with a blip:
//   1. how many people get sick / die from unsafe food every year (WHO), big numbers popping in;
//   2. Ece's end cards, word for word and in her order: LOOKS CAN BE DECEIVING. / three rules / WHEN IN DOUBT,
//      THROW IT OUT. with a red heart and the USDA source. The last card is the finish frame, with a REPLAY button.
(function (PSA) {
  const G = PSA.gfx, F = PSA.font, ST = PSA.story, TL = PSA.timeline, TB = PSA.textbox;

  const CPS = 30, CPS2 = 42;
  // card 1: shot-relative start time, text, scale, color, y; big lines pop in whole (no typing)
  const LINES = [
    { at: 0.5, text: 'An estimated', s: 2, y: 14 },
    { at: 1.1, text: ST.STATS.ill, s: 4, y: 38, color: 'uiAccent', pop: true },
    { at: 1.7, text: 'fall ill after eating', s: 2, y: 78 },
    { at: 2.6, text: 'contaminated food, and', s: 2, y: 100 },
    { at: 3.8, text: ST.STATS.die, s: 4, y: 128, color: 'uiRed', pop: true },
    { at: 4.4, text: 'die every year.', s: 2, y: 168 }
  ];
  const SOURCE_AT = 5.0;

  // Ece's end cards (src/scenes/story.js ST.END): shot-relative start, lines, scale, color, line y's, typing speed
  const E = ST.END;
  const CARDS = [
    { at: 6.6,  lines: E.looks, s: 3, color: 'white', ys: [80, 112], cps: 20 },
    { at: 10.4, lines: E.rules[0], s: 2, color: 'white', ys: [88, 112], cps: 30 },
    { at: 14.4, lines: E.rules[1], s: 2, color: 'white', ys: [88, 112], cps: 30 },
    { at: 18.2, lines: E.rules[2], s: 2, color: 'white', ys: [88, 112], cps: 30 },
    { at: 22.0, lines: E.doubt, s: 4, color: 'uiAccent', ys: [26, 66], cps: 18 }
  ];
  const TYPE_DELAY = 0.3, FINAL = CARDS[CARDS.length - 1];
  const HEART_AT = FINAL.at + 2.2, USDA_AT = FINAL.at + 2.8, REPLAY_AT = FINAL.at + 3.6;
  const joined = (C) => C.lines.join('\n');

  PSA.shots.S7 = function (ctx, t, lt) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black');
    if (lt < CARDS[0].at) {
      for (const L of LINES) {
        if (lt < L.at) continue;
        const n = L.pop ? L.text.length : TB.charsAt(lt - L.at, CPS, L.text);
        const x0 = Math.round(PSA.W / 2 - F.measure(L.text, L.s) / 2);       // centered on the final width
        const bounce = L.pop && lt - L.at < 0.15 ? -2 : 0;
        F.text(ctx, L.text.slice(0, n), x0, L.y + bounce, { scale: L.s, color: L.color || 'white' });
      }
      if (lt >= SOURCE_AT) F.text(ctx, ST.STATS.source, PSA.W / 2, 200, { align: 'center', color: 'uiDim', alpha: G.clamp((lt - SOURCE_AT) / 0.4, 0, 1) });
      return;
    }
    let C = CARDS[0];
    for (const c of CARDS) if (lt >= c.at) C = c;
    let n = TB.charsAt(lt - C.at - TYPE_DELAY, C.cps, joined(C));
    C.lines.forEach((line, i) => {
      const x0 = Math.round(PSA.W / 2 - F.measure(line, C.s) / 2);
      F.text(ctx, line.slice(0, Math.max(0, n)), x0, C.ys[i], { scale: C.s, color: C.color });
      n -= line.length + 1;
    });
    if (C !== FINAL) return;
    if (lt >= HEART_AT) TB.heart(ctx, PSA.W / 2 - 10, lt - HEART_AT < 0.15 ? 112 : 114, 3);
    if (lt >= USDA_AT) F.text(ctx, E.source, PSA.W / 2, 202, { align: 'center', color: 'uiDim', alpha: G.clamp((lt - USDA_AT) / 0.4, 0, 1) });
    if (lt >= REPLAY_AT) replayButton(ctx, lt - REPLAY_AT);
  };

  // Undertale-style menu button under the finish frame. In the browser it is clickable (src/main.js restarts the
  // film); in the exported video it is only a picture.
  const BTN = PSA.REPLAY_BUTTON = { x: 132, y: 146, w: 120, h: 32 };
  function replayButton(ctx, lt) {
    const on = Math.floor(lt * 1.6) % 2 === 0, col = on ? 'uiAccent' : '#ff9a2e';
    G.rect(ctx, BTN.x, BTN.y, BTN.w, BTN.h, col);
    G.rect(ctx, BTN.x + 3, BTN.y + 3, BTN.w - 6, BTN.h - 6, 'black');
    TB.heart(ctx, BTN.x + 12, BTN.y + 10, 2);
    F.text(ctx, 'REPLAY', BTN.x + 34, BTN.y + 9, { scale: 2, color: col });
  }

  const blip = (bt) => ({ t: bt, name: 'blip', args: { kind: 'narr', soft: true } });
  TL.byId('S7').sfx = [].concat(
    ...LINES.map((L) => L.pop ? [{ t: L.at, name: 'reveal', args: { strong: L.color === 'uiRed' } }] : TB.blipTimes(L.text, L.at, CPS, 0).map(blip)),
    [{ t: LINES[4].at, name: 'sting', args: { soft: true } }],
    ...CARDS.map((C) => TB.blipTimes(joined(C), C.at, C.cps, TYPE_DELAY).map(blip)),
    [{ t: HEART_AT, name: 'reveal', args: {} }, { t: REPLAY_AT, name: 'menuMove', args: {} }]
  );
})(window.PSA);
