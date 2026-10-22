// SCENE 7 — FINAL FOOD SAFETY MESSAGE. Minimal dark panel; heading, three facts revealed one by one, then the slogan.
(function (PSA) {
  const G = PSA.gfx, F = PSA.font, ST = PSA.story, TL = PSA.timeline;

  // shot-relative reveal times (shot starts at 121.5)
  const T_HEAD = 0.5, T_L = [2.0, 5.0, 8.0], T_SLOGAN = 11.0, T_FADE0 = 12.7, T_FADE1 = 14.0;
  
  function fadeIn(lt, dur) { return G.clamp(lt / (dur || 0.3), 0, 1); }

  function panel(ctx) {
    G.rect(ctx, 0, 0, PSA.W, PSA.H, 'black');
    // subtle dark texture + inset frame (calm, matches the text boxes)
    G.dither(ctx, 0, 0, PSA.W, PSA.H, '#0a0a12', 0.25, 0);
    G.box(ctx, 10, 10, PSA.W - 20, PSA.H - 20, 'uiBorder');
    G.box(ctx, 13, 13, PSA.W - 26, PSA.H - 26, '#3a3a40');
  }

  PSA.shots.S7 = function (ctx, t, lt) {
    panel(ctx);
    // heading
    if (lt >= T_HEAD) {
      const a = fadeIn(lt - T_HEAD);
      F.text(ctx, ST.INFO.heading, PSA.W / 2, 24, { scale: 2, align: 'center', color: 'uiAccent', shadow: 'ink', alpha: a });
      // small rule under the heading
      G.rect(ctx, PSA.W / 2 - 40, 44, 80, 1, 'uiDim');
    }
    // three facts: left-aligned column with bullets (readable, no orphan words)
    const colX = 46, colW = PSA.W - colX - 30;
    let y = 60;
    for (let i = 0; i < ST.INFO.lines.length; i++) {
      const text = ST.INFO.lines[i];
      const lines = F.wrap(text, colW - 12, 1);
      if (lt >= T_L[i]) {
        const a = fadeIn(lt - T_L[i]);
        F.text(ctx, '*', colX, y, { color: 'uiAccent', alpha: a });
        lines.forEach((ln, k) => F.text(ctx, ln, colX + 12, y + k * (F.lineHeight(1) + 1), { color: 'uiText', alpha: a }));
      }
      y += lines.length * (F.lineHeight(1) + 1) + 9;
    }
    // slogan
    if (lt >= T_SLOGAN) {
      const a = fadeIn(lt - T_SLOGAN, 0.25);
      const fits = F.measure(ST.INFO.slogan, 2) <= PSA.W - 32;
      const bounce = (lt - T_SLOGAN) > 0.25 && (lt - T_SLOGAN) < 0.45 ? -1 : 0;
      const sy = 164 + bounce;
      if (fits) F.text(ctx, ST.INFO.slogan, PSA.W / 2, sy, { scale: 2, align: 'center', color: 'uiRed', shadow: 'ink', alpha: a });
      else {
        F.text(ctx, 'WHEN IN DOUBT,', PSA.W / 2, sy - 10, { scale: 2, align: 'center', color: 'uiRed', shadow: 'ink', alpha: a });
        F.text(ctx, 'THROW IT OUT.', PSA.W / 2, sy + 10, { scale: 2, align: 'center', color: 'uiRed', shadow: 'ink', alpha: a });
      }
    }
    // final fade to black — nothing after the slogan
    if (lt > T_FADE0) PSA.light.black(ctx, G.smooth((lt - T_FADE0) / (T_FADE1 - T_FADE0)));
  };

  TL.byId('S7').sfx = [
    { t: T_HEAD, name: 'reveal', args: {} },
    { t: T_L[0], name: 'reveal', args: {} },
    { t: T_L[1], name: 'reveal', args: {} },
    { t: T_L[2], name: 'reveal', args: {} },
    { t: T_SLOGAN, name: 'reveal', args: { strong: true } },
    { t: T_SLOGAN, name: 'sting', args: { soft: true } }
  ];
})(window.PSA);
