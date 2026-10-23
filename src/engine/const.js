// Global namespace for the whole project. Classic scripts (no ES modules) so index.html works from file://.
window.PSA = window.PSA || {};
(function (PSA) {
  PSA.W = 384;          // native pixel-art width  (x5 = 1920)
  PSA.H = 216;          // native pixel-art height (x5 = 1080)
  PSA.SCALE = 5;        // integer upscale to 1920x1080
  PSA.FPS = 30;         // export frame rate
  PSA.AUDIO_SR = 48000; // offline audio sample rate
  PSA.FLAT = true;
  PSA.SPEED = 1.14;     // playback speed: the story is timed in "story seconds" (137 s); the film runs this much faster
                        // (picture, sound effects and music alike, music pitch unchanged) -> about 2:00      // flat art style: no dither textures, light pools or vignette (see src/engine/style.js)
})(window.PSA);
