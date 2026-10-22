// MUSIC (placeholder; replaced by the music composition module). Exposes PSA.music.schedule(ctx, bus, t0).
(function (PSA) {
  PSA.music = PSA.music || {};
  if (!PSA.music.schedule) PSA.music.schedule = function (ctx, bus, t0) { /* silence until composed */ };
})(window.PSA);
