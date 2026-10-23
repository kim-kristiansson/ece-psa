// SCENE 7 — THE NUMBERS. Two black cards in the Undertale text style (big 2x text, typed letter by letter with a blip):
//   1. how many people get sick / die from unsafe food every year (WHO, June 2026), big numbers popping in;
//   2. most people recover, but some get chronic, severe or life-threatening problems (in a full-screen text box).
// Then a fade to black. (Replaces the earlier "FOOD SAFETY" bullet slides.)
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
  const SOURCE_AT = 5.0, CARD2 = 8.0, T_FADE0 = 14.2, T_FADE1 = 15.5;

  PSA.shots.S7 = function (ctx, t, lt) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black');
    if (lt < CARD2) {
      for (const L of LINES) {
        if (lt < L.at) continue;
        const n = L.pop ? L.text.length : TB.charsAt(lt - L.at, CPS, L.text);
        const x0 = Math.round(PSA.W / 2 - F.measure(L.text, L.s) / 2);       // centered on the final width
        const bounce = L.pop && lt - L.at < 0.15 ? -2 : 0;
        F.text(ctx, L.text.slice(0, n), x0, L.y + bounce, { scale: L.s, color: L.color || 'white' });
      }
      if (lt >= SOURCE_AT) F.text(ctx, ST.STATS.source, PSA.W / 2, 200, { align: 'center', color: 'uiDim', alpha: G.clamp((lt - SOURCE_AT) / 0.4, 0, 1) });
    } else {
      TB.draw(ctx, { x: 10, y: 8, w: 364, h: 200, pad: 16, text: ST.STATS.recover, chars: TB.charsAt(lt - CARD2 - 0.3, CPS2, ST.STATS.recover) });
    }
    if (lt > T_FADE0) PSA.light.black(ctx, G.smooth((lt - T_FADE0) / (T_FADE1 - T_FADE0)));
  };

  const blip = (bt) => ({ t: bt, name: 'blip', args: { kind: 'narr', soft: true } });
  TL.byId('S7').sfx = [].concat(
    ...LINES.map((L) => L.pop ? [{ t: L.at, name: 'reveal', args: { strong: L.color === 'uiRed' } }] : TB.blipTimes(L.text, L.at, CPS, 0).map(blip)),
    [{ t: LINES[4].at, name: 'sting', args: { soft: true } }],
    TB.blipTimes(ST.STATS.recover, CARD2, CPS2, 0.3).filter((bt, i) => i % 2 === 0).map(blip)
  );
})(window.PSA);
