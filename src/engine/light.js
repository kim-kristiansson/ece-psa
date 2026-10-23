// Lighting: multiply tint over the composed scene (before UI), optional vignette.
// Pixel-art friendly: applied on the native canvas with 'multiply' using a flat color + alpha, so edges stay crisp.
(function (PSA) {
  const G = PSA.gfx;
  const L = {};

  // state: { tint: color, strength: 0..1, vignette: 0..1, warm: 0..1 }
  L.apply = function (ctx, state) {
    if (!state) return;
    if (PSA.style && !PSA.style.done) PSA.style.apply(ctx);   // flatten first, then tint the flat image
    const s = state.strength || 0;
    if (s > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = Math.min(1, s);
      ctx.fillStyle = G.col(state.tint || 'tintNight');
      ctx.fillRect(0, 0, PSA.W, PSA.H);
      ctx.restore();
    }
    if (state.warm > 0.001) { // gentle warm wash (lamp light) using 'screen'
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(1, state.warm) * 0.25;
      ctx.fillStyle = G.col('lampGlow');
      ctx.fillRect(0, 0, PSA.W, PSA.H);
      ctx.restore();
    }
    if (state.vignette > 0.001) L.vignette(ctx, state.vignette);
  };

  // Dithered dark vignette (corners), strength 0..1
  L.vignette = function (ctx, strength) {
    if (PSA.FLAT) return;                       // flat style: no vignette
    const steps = Math.round(strength * 4); // 0..4 bands
    if (steps <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, strength) * 0.5;
    for (let i = 0; i < steps; i++) {
      const inset = i * 10;
      const w = PSA.W - 2 * inset, h = PSA.H - 2 * inset;
      ctx.fillStyle = '#0a0a14';
      // border band drawn as a dithered frame
      G.dither(ctx, inset, inset, w, 10, '#0a0a14', 0.5, i);
      G.dither(ctx, inset, inset + h - 10, w, 10, '#0a0a14', 0.5, i);
      G.dither(ctx, inset, inset + 10, 10, h - 20, '#0a0a14', 0.5, i);
      G.dither(ctx, inset + w - 10, inset + 10, 10, h - 20, '#0a0a14', 0.5, i);
    }
    ctx.restore();
  };

  // Fade to black overlay, alpha 0..1
  L.black = function (ctx, alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PSA.W, PSA.H); ctx.restore();
  };

  // Interpolate two light states
  L.mix = function (a, b, t) {
    t = G.clamp(t, 0, 1);
    return {
      tint: G.mix(a.tint || '#ffffff', b.tint || '#ffffff', t),
      strength: G.lerp(a.strength || 0, b.strength || 0, t),
      vignette: G.lerp(a.vignette || 0, b.vignette || 0, t),
      warm: G.lerp(a.warm || 0, b.warm || 0, t)
    };
  };

  PSA.light = L;
})(window.PSA);
