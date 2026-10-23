// Global namespace for the whole project. Classic scripts (no ES modules) so index.html works from file://.
window.PSA = window.PSA || {};
(function (PSA) {
  PSA.W = 384;          // native pixel-art width  (x5 = 1920)
  PSA.H = 216;          // native pixel-art height (x5 = 1080)
  PSA.SCALE = 5;        // integer upscale to 1920x1080
  PSA.FPS = 30;         // export frame rate
  PSA.AUDIO_SR = 48000; // offline audio sample rate
  PSA.FLAT = true;      // flat art style: no dither textures, light pools or vignette (see src/engine/style.js)

  // Time warp: the story is timed in "story seconds"; the film plays it at speed 1 except during the clock timelapse
  // (story 45-64.5), which runs WARP.k times faster, easing in and out over WARP.ramp seconds. Picture, sound effects
  // and music all follow the same map (src/audio/director.js), so the music only changes tempo, never pitch.
  const WARP = PSA.WARP = { s0: 45.0, s1: 64.5, k: 1.6, ramp: 2.0 };
  PSA.speedAt = function (s) {
    if (s <= WARP.s0 || s >= WARP.s1) return 1;
    const u = Math.min(1, (s - WARP.s0) / WARP.ramp, (WARP.s1 - s) / WARP.ramp);
    return 1 + (WARP.k - 1) * u;
  };
  const STEP = 0.005, FILM = [0];        // FILM[i] = film time of story time i*STEP (midpoint rule)
  for (let s = 0; s < 400; s += STEP) FILM.push(FILM[FILM.length - 1] + STEP / PSA.speedAt(s + STEP / 2));
  PSA.filmTime = function (s) {          // story seconds -> film seconds
    if (s <= 0) return s;
    const i = Math.min(FILM.length - 2, Math.floor(s / STEP)), f = s / STEP - i;
    return FILM[i] + (FILM[i + 1] - FILM[i]) * f;
  };
  PSA.storyTime = function (f) {         // film seconds -> story seconds
    if (f <= 0) return f;
    let lo = 0, hi = FILM.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (FILM[m] <= f) lo = m; else hi = m; }
    return (lo + (f - FILM[lo]) / (FILM[hi] - FILM[lo])) * STEP;
  };
})(window.PSA);
