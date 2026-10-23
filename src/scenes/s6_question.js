// SCENE 6 — THE QUESTION. Black screen, "WOULD YOU EAT IT?" then "IT LOOKS FINE. BUT IS IT SAFE?"
(function (PSA) {
  const G = PSA.gfx, F = PSA.font, ST = PSA.story, TL = PSA.timeline;

  const Q1_AT = 0.7;    // S6a-relative appearance of line 1 (abs 112.2)
  const Q2_AT = 0.3;    // S6b-relative appearance of line 2 (abs 116.8)
  const CPS = 14;       // typing speed for the big question (slower than dialogue: dramatic)

  function typed(ctx, text, y, scale, lt, color) {
    if (lt < 0) return;
    const chars = Math.floor(lt * CPS);
    const shown = text.slice(0, chars);
    // keep the line centered on its FINAL width so it does not slide while typing
    const x0 = Math.round(PSA.W / 2 - F.measure(text, scale) / 2);
    F.text(ctx, shown, x0, y, { scale: scale, color: color || 'uiText' });
    // blinking cursor block while typing
    if (chars < text.length && Math.floor(lt * 6) % 2 === 0) {
      const cx = x0 + F.measure(shown, scale) + (shown.length ? PSA.FONT.spacing * scale : 0);
      G.rect(ctx, cx, y + 2 * scale, 3 * scale, 5 * scale, 'uiDim');
    }
  }

  function blips(text, t0) { // one 'narr' blip per non-space char at CPS
    const ev = [];
    for (let i = 0; i < text.length; i++) if (text[i] !== ' ') ev.push({ t: t0 + i / CPS, name: 'blip', args: { kind: 'narr', soft: true } });
    return ev;
  }

  PSA.shots.S6a = function (ctx, t, lt) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black');
    typed(ctx, ST.QUESTION1, 76, 3, lt - Q1_AT);
  };
  PSA.shots.S6b = function (ctx, t, lt) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black');
    typed(ctx, ST.QUESTION1, 76, 3, 99);                 // line 1 stays fully shown
    const fits2 = F.measure(ST.QUESTION2, 2) <= PSA.W - 24;
    typed(ctx, ST.QUESTION2, fits2 ? 118 : 124, fits2 ? 2 : 1, lt - Q2_AT, 'uiText');
  };

  const a = TL.byId('S6a'), b = TL.byId('S6b');
  a.sfx = [{ t: 0.6, name: 'sting', args: {} }].concat(blips(ST.QUESTION1, Q1_AT));
  b.sfx = [{ t: 0.2, name: 'swell', args: { dur: 5 } }].concat(blips(ST.QUESTION2, Q2_AT));
})(window.PSA);
