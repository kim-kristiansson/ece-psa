// SFX LIBRARY — synthesized retro-RPG flavoured sound effects on Web Audio.
//
//   PSA.sfx[name](ctx, bus, when, args)
//     ctx  : any BaseAudioContext (live AudioContext or OfflineAudioContext for the export)
//     bus  : AudioNode to connect to (the director's sfx bus)
//     when : ABSOLUTE context time at which the sound starts
//     args : per-sound options (see docs/SFX.md); every arg is optional
//   PSA.sfx.__names : list of all implemented names (docs/SFX.md must be a subset of it)
//
// Design rules (see the task brief):
//   * Everything is scheduled with AudioParam automation at `when` — nothing uses setTimeout, nothing uses the wall clock,
//     so the same soundtrack renders identically offline.
//   * No Math.random: noise buffers and "random" pop timings come from PSA.gfx.rng(seed). Noise buffers are cached per
//     context in a WeakMap, from a pool of NOISE_POOL seeds (variation between calls comes from the start offset inside the
//     looped buffer), so a long scene does not allocate hundreds of buffers.
//   * Every gain envelope starts at 0 and ramps (linear attack, exponential-ish decay finished with a short linear ramp to
//     0) so nothing clicks. Every source is stopped shortly after its envelope ends.
//   * Levels: effects peak around -10 dBFS (0.3), text blips / clock ticks / menu ticks around -20 dBFS (0.1).
//     Soft, never harsh: square waves are always low-passed, noise is always band-limited.
//
// Building blocks (private): gain envelopes, tones (osc + optional glide / vibrato / filter), noise bursts (buffer + filter),
// and a few composite "instruments" (pop, clink, thud) that several effects share.
(function (PSA) {
  const S = PSA.sfx || {};
  const I = {};          // implementations; exported through a wrapper that sanitizes `when` and `args`
  const G = PSA.gfx;

  // ---- level constants (linear amplitude) -----------------------------------------------------------------------
  const FX = 0.30;       // ~ -10 dBFS: regular effects
  const SOFT = 0.18;     // ~ -15 dBFS: quieter effects
  const TICK = 0.10;     // ~ -20 dBFS: blips and ticks
  const BED = 0.06;      // ~ -24 dBFS: beds (hum, hiss, pads)
  const EPS = 0.0004;    // end value of exponential decays before the final linear ramp to 0

  // ---- noise buffers (deterministic, cached per context) --------------------------------------------------------
  const NOISE_LEN = 2.0; // seconds per buffer (looped)
  const NOISE_POOL = 16; // distinct buffers per context (seed % NOISE_POOL)
  const noiseCache = new WeakMap();
  function noiseBuffer(ctx, seed) {
    let m = noiseCache.get(ctx);
    if (!m) { m = new Map(); noiseCache.set(ctx, m); }
    let b = m.get(seed);
    if (b) return b;
    const n = Math.ceil(ctx.sampleRate * NOISE_LEN);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0), r = G.rng(seed);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    m.set(seed, b);
    return b;
  }

  // ---- envelope helpers -------------------------------------------------------------------------------------------
  // Attack from 0 to `peak` over `a` seconds, hold for `h`, then decay (exponential to EPS, linear to 0) over `r`.
  // Returns the time at which the envelope is fully silent.
  function env(param, when, peak, a, h, r) {
    a = Math.max(0.002, a || 0); r = Math.max(0.004, r || 0); h = Math.max(0, h || 0);
    peak = Math.max(peak, 1e-5); // an exponential ramp needs a non-zero start value (args.level = 0 stays inaudible)
    param.setValueAtTime(0, when);
    param.linearRampToValueAtTime(peak, when + a);
    param.setValueAtTime(peak, when + a + h);
    param.exponentialRampToValueAtTime(EPS, when + a + h + r * 0.85);
    param.linearRampToValueAtTime(0, when + a + h + r);
    return when + a + h + r;
  }
  // Smooth bed envelope: fade in `fi`, sustain, fade out `fo`, total `dur`. Returns the end time.
  function bed(param, when, peak, dur, fi, fo) {
    fi = Math.min(fi, dur * 0.5); fo = Math.min(fo, dur * 0.5); peak = Math.max(peak, 1e-5);
    param.setValueAtTime(0, when);
    param.linearRampToValueAtTime(peak, when + fi);
    param.setValueAtTime(peak, when + dur - fo);
    param.linearRampToValueAtTime(0, when + dur);
    return when + dur;
  }
  function gainTo(ctx, dest, v) { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; g.connect(dest); return g; }
  function filt(ctx, dest, type, f, q) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; b.connect(dest); return b;
  }
  // Tremolo stage: a gain that oscillates between 1 - 2*depth and 1 (never negative), independent of the envelope
  // so the enveloped gain still reaches exactly 0 at both ends (no click when the source stops).
  function tremolo(ctx, dest, when, end, rate, depth) {
    const tg = gainTo(ctx, dest, 1 - depth);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rate;
    lfo.connect(gainTo(ctx, tg.gain, depth));
    lfo.start(when); lfo.stop(end + 0.02);
    return tg;
  }

  // ---- tone: one oscillator with envelope, optional pitch glide / vibrato / filter ------------------------------
  // o = { type, f, f1 (glide target, reached at a+h), glide (seconds, default a+h), a, h, r, level,
  //       lp (lowpass Hz), hp (highpass Hz), q, vib: {rate, depth}, detune }
  function tone(ctx, bus, when, o) {
    const g = gainTo(ctx, bus, 0);
    let dest = g;
    if (o.lp) dest = filt(ctx, dest, 'lowpass', o.lp, o.q);
    if (o.hp) dest = filt(ctx, dest, 'highpass', o.hp, o.q);
    if (o.bp) dest = filt(ctx, dest, 'bandpass', o.bp, o.q == null ? 2 : o.q);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(o.f, when);
    if (o.f1 && o.f1 !== o.f) osc.frequency.exponentialRampToValueAtTime(o.f1, when + (o.glide || ((o.a || 0) + (o.h || 0)) || 0.05));
    if (o.detune) osc.detune.value = o.detune;
    osc.connect(dest);
    const end = env(g.gain, when, o.level, o.a, o.h, o.r);
    if (o.vib) {
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = o.vib.rate;
      const lg = gainTo(ctx, osc.frequency, o.vib.depth); lfo.connect(lg);
      lfo.start(when); lfo.stop(end + 0.01);
    }
    osc.start(when); osc.stop(end + 0.01);
    return end;
  }

  // ---- noise burst: looped noise buffer -> filter -> envelope ----------------------------------------------------
  // o = { seed, type ('bandpass'|'lowpass'|'highpass'), f, f1 (filter glide target at end of a+h), q, a, h, r, level,
  //       lp (extra lowpass), trem: {rate, depth 0..1} }
  function noise(ctx, bus, when, o) {
    const g = gainTo(ctx, bus, 0);
    let dest = g;
    if (o.lp) dest = filt(ctx, dest, 'lowpass', o.lp, 0.7);
    const f = filt(ctx, dest, o.type || 'bandpass', o.f, o.q == null ? 1 : o.q);
    const end = env(g.gain, when, o.level, o.a, o.h, o.r);
    if (o.f1 && o.f1 !== o.f) { f.frequency.setValueAtTime(o.f, when); f.frequency.exponentialRampToValueAtTime(o.f1, o.glideEnd || end); }
    // Only NOISE_POOL distinct buffers per context (a buffer is 2 s of samples); variation between calls comes from
    // the seed-and-time derived start offset inside the looped buffer.
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, (o.seed || 1) % NOISE_POOL); src.loop = true;
    const off = o.offset != null ? o.offset : G.hash(o.seed || 1, Math.floor(when * 1000), 7) * (NOISE_LEN - 0.1);
    let inlet = f;
    if (o.trem) inlet = tremolo(ctx, f, when, end, o.trem.rate, o.trem.depth);
    src.connect(inlet);
    src.start(when, off); src.stop(end + 0.01);
    return end;
  }

  // ---- shared composite instruments ------------------------------------------------------------------------------
  // Soft wet "plop": sine gliding down + a short band-limited watery noise.
  function plop(ctx, bus, when, level, f0, f1, dur, seed) {
    tone(ctx, bus, when, { type: 'sine', f: f0, f1: f1, glide: dur * 0.6, a: 0.006, h: 0.01, r: dur, level: level });
    noise(ctx, bus, when + 0.004, { seed: seed, type: 'bandpass', f: 900, f1: 500, q: 1.2, a: 0.008, h: 0.02, r: dur * 0.9, level: level * 0.45 });
    return when + dur + 0.03;
  }
  // Small water droplet / bubble: short rising sine ("bloop").
  function droplet(ctx, bus, when, level, f0, f1, dur) {
    return tone(ctx, bus, when, { type: 'sine', f: f0, f1: f1, glide: dur, a: 0.004, h: 0.0, r: dur, level: level });
  }
  // Ceramic / metallic clink: 2-3 inharmonic sine partials with fast decays.
  function clink(ctx, bus, when, level, partials, decay) {
    let end = when;
    for (let i = 0; i < partials.length; i++) {
      end = Math.max(end, tone(ctx, bus, when + i * 0.0015, { type: 'sine', f: partials[i], a: 0.005, h: 0.003, r: decay * (1 - i * 0.18), level: level * (1 - i * 0.28) }));
    }
    return end;
  }
  // Wooden thud: low sine with a quick pitch drop + a dull low-passed noise knock.
  function thud(ctx, bus, when, level, f, dur, seed) {
    tone(ctx, bus, when, { type: 'sine', f: f * 1.6, f1: f, glide: 0.03, a: 0.004, h: 0.01, r: dur, level: level });
    noise(ctx, bus, when, { seed: seed, type: 'lowpass', f: 420, q: 0.8, a: 0.003, h: 0.008, r: 0.05, level: level * 0.7 });
    return when + dur + 0.03;
  }
  // Short low-passed square tick (menu / typewriter family).
  function squareTick(ctx, bus, when, level, f, dur, lp) {
    tone(ctx, bus, when, { type: 'square', f: f, a: 0.003, h: dur * 0.4, r: dur * 0.6, level: level * 0.55, lp: lp || 2600 });
    tone(ctx, bus, when, { type: 'triangle', f: f, a: 0.003, h: dur * 0.4, r: dur * 0.6, level: level * 0.8 });
    return when + dur + 0.02;
  }

  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const seedOf = (when, k) => (Math.floor(when * 997) + k * 7919) >>> 0;

  // =================================================================================================================
  // TEXT / UI
  // =================================================================================================================
  // Typewriter blip: 'narr' = narration box (lower), 'voice' = thought/speech (a bit higher). args.soft = quieter.
  I.blip = function (ctx, bus, when, args) {
    args = args || {};
    const voice = args.kind === 'voice';
    const lvl = TICK * (args.soft ? 0.6 : 1.0);
    const f = voice ? 1046 : 784;
    tone(ctx, bus, when, { type: 'square', f: f, f1: f * 0.96, glide: 0.03, a: 0.002, h: 0.012, r: 0.03, level: lvl * 0.5, lp: 2400 });
    tone(ctx, bus, when, { type: 'triangle', f: f * 2, a: 0.002, h: 0.008, r: 0.022, level: lvl * 0.5 });
  };

  // Menu cursor move: dry little tick.
  I.menuMove = function (ctx, bus, when) {
    squareTick(ctx, bus, when, TICK * 0.6, 1320, 0.035, 3000);
    tone(ctx, bus, when + 0.012, { type: 'triangle', f: 1980, a: 0.003, h: 0.006, r: 0.03, level: TICK * 0.25 });
  };

  // RPG "!" alert: rising two-note blip (E5 -> B5), soft square + triangle.
  I.notice = function (ctx, bus, when) {
    const notes = [659.3, 987.8];
    for (let i = 0; i < 2; i++) {
      const t = when + i * 0.085;
      tone(ctx, bus, t, { type: 'square', f: notes[i], a: 0.004, h: 0.05, r: 0.06 + i * 0.08, level: SOFT * 0.45, lp: 2800 });
      tone(ctx, bus, t, { type: 'triangle', f: notes[i], a: 0.004, h: 0.05, r: 0.06 + i * 0.08, level: SOFT * 0.7 });
    }
  };

  // RPG "?" wobble: triangle with vibrato, drifting gently upward then settling.
  I.question = function (ctx, bus, when) {
    tone(ctx, bus, when, { type: 'triangle', f: 523, f1: 622, glide: 0.28, a: 0.03, h: 0.2, r: 0.22, level: SOFT * 0.8, vib: { rate: 7, depth: 22 } });
    tone(ctx, bus, when + 0.02, { type: 'square', f: 523, f1: 622, glide: 0.28, a: 0.03, h: 0.2, r: 0.2, level: SOFT * 0.25, lp: 1800 });
  };

  // Soft pixel "appear" chime for info lines: quick ascending 3-note arpeggio (C6 E6 G6; strong adds C7).
  I.reveal = function (ctx, bus, when, args) {
    args = args || {};
    const notes = args.strong ? [1046.5, 1318.5, 1568, 2093] : [1046.5, 1318.5, 1568];
    const lvl = SOFT * (args.strong ? 1.0 : 0.8);
    for (let i = 0; i < notes.length; i++) {
      const t = when + i * 0.045, last = i === notes.length - 1;
      tone(ctx, bus, t, { type: 'triangle', f: notes[i], a: 0.003, h: 0.03, r: last ? 0.22 : 0.05, level: lvl * 0.75 });
      tone(ctx, bus, t, { type: 'square', f: notes[i], a: 0.003, h: 0.03, r: last ? 0.18 : 0.05, level: lvl * 0.22, lp: 3200 });
    }
  };

  // =================================================================================================================
  // COOKING
  // =================================================================================================================
  // Gentle boiling water for args.dur seconds: low filtered rumble (slowly wobbling lowpass) + small random bubble pops.
  I.boil = function (ctx, bus, when, args) {
    args = args || {};
    const dur = Math.max(0.5, num(args.dur, 3)), level = G.clamp(num(args.level, 1), 0, 1);
    const seed = seedOf(when, 11);
    // rumble bed
    const g = gainTo(ctx, bus, 0);
    const lp = filt(ctx, g, 'lowpass', 230, 1.1);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, seed % NOISE_POOL); src.loop = true; src.connect(lp);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.9;
    const lg = gainTo(ctx, lp.frequency, 70); lfo.connect(lg);
    const end = bed(g.gain, when, FX * 0.95 * level, dur, Math.min(0.6, dur * 0.3), Math.min(0.7, dur * 0.3));
    src.start(when); src.stop(end + 0.01); lfo.start(when); lfo.stop(end + 0.01);
    // bubble pops: deterministic jittered times, each a tiny rising "bloop" through a lowpass so they stay soft
    const r = G.rng(seed ^ 0x5bd1e995);
    let t = when + 0.15 + r() * 0.2;
    while (t < when + dur - 0.12) {
      const p = (t - when) / dur;
      const fade = Math.min(1, p / 0.2, (1 - p) / 0.2);     // follow the bed's fade in/out
      const f0 = 280 + r() * 260, size = 0.03 + r() * 0.05;
      tone(ctx, bus, t, { type: 'sine', f: f0, f1: f0 * (1.35 + r() * 0.4), glide: size, a: 0.004, h: 0, r: size, level: SOFT * 0.75 * level * (0.35 + 0.65 * fade) * (0.5 + r() * 0.5), lp: 900 });
      t += 0.08 + r() * 0.26;
    }
  };

  // Faint stove hiss for args.dur: high-passed noise with a slow flutter.
  I.sizzle = function (ctx, bus, when, args) {
    args = args || {};
    const dur = Math.max(0.5, num(args.dur, 3));
    const g = gainTo(ctx, bus, 0);
    const hp = filt(ctx, g, 'highpass', 3200, 0.6);
    const lp = filt(ctx, hp, 'lowpass', 7500, 0.5);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, seedOf(when, 13) % NOISE_POOL); src.loop = true;
    const end = bed(g.gain, when, BED * 0.8, dur, Math.min(0.5, dur * 0.3), Math.min(0.6, dur * 0.3));
    // flutter: two tremolo stages (fast crackle + slow breathing) ahead of the enveloped gain
    const t1 = tremolo(ctx, lp, when, end, 7.3, 0.14);
    const t2 = tremolo(ctx, t1, when, end, 1.7, 0.18);
    const t3 = tremolo(ctx, t2, when, end, 11.9, 0.1);
    src.connect(t3);
    src.start(when); src.stop(end + 0.01);
  };

  // Pasta going into the water: soft plop + short watery noise + two tiny droplets.
  I.splash = function (ctx, bus, when) {
    const seed = seedOf(when, 17);
    plop(ctx, bus, when, FX * 0.9, 320, 130, 0.16, seed);
    noise(ctx, bus, when + 0.02, { seed: seed + 1, type: 'bandpass', f: 1500, f1: 700, q: 0.9, a: 0.02, h: 0.05, r: 0.25, level: FX * 0.4, lp: 3000 });
    droplet(ctx, bus, when + 0.17, SOFT * 0.5, 520, 900, 0.05);
    droplet(ctx, bus, when + 0.26, SOFT * 0.35, 640, 1100, 0.04);
  };

  // Spoon stirring in water for args.dur: periodic soft swishes (filtered noise with a sweeping bandpass).
  I.stir = function (ctx, bus, when, args) {
    args = args || {};
    const dur = Math.max(0.3, num(args.dur, 3));
    const seed = seedOf(when, 19), r = G.rng(seed);
    const period = 0.62;
    let t = when + 0.05, i = 0;
    while (t < when + dur - 0.2) {
      const p = (t - when) / dur, fade = Math.min(1, (1 - p) / 0.25 + 0.2);
      const up = (i & 1) === 0;
      noise(ctx, bus, t, { seed: seed + (i % 3), type: 'bandpass', f: up ? 500 : 1100, f1: up ? 1300 : 600, q: 1.4, a: 0.11, h: 0.05, r: 0.2, level: FX * 0.6 * fade * (0.8 + r() * 0.2), lp: 2600 });
      // a faint wet 'glug' under the swish
      tone(ctx, bus, t + 0.06, { type: 'sine', f: 240 + r() * 60, f1: 180, glide: 0.12, a: 0.03, h: 0.02, r: 0.12, level: SOFT * 0.4 * fade });
      t += period + (r() - 0.5) * 0.08; i++;
    }
  };

  // Pasta landing on a plate: a rounder, lower plop with a soft noise cushion.
  I.serve = function (ctx, bus, when) {
    const seed = seedOf(when, 23);
    plop(ctx, bus, when, FX, 240, 95, 0.2, seed);
    noise(ctx, bus, when + 0.03, { seed: seed + 2, type: 'lowpass', f: 700, q: 0.8, a: 0.03, h: 0.04, r: 0.18, level: FX * 0.35 });
    droplet(ctx, bus, when + 0.2, SOFT * 0.3, 380, 520, 0.05);
  };

  // Sauce ladled on: a short wet dollop (descending wet noise + low "blub").
  I.ladle = function (ctx, bus, when) {
    const seed = seedOf(when, 29);
    noise(ctx, bus, when, { seed: seed, type: 'bandpass', f: 1400, f1: 380, q: 1.1, a: 0.03, h: 0.06, r: 0.22, level: FX * 0.7, lp: 2800 });
    tone(ctx, bus, when + 0.04, { type: 'sine', f: 200, f1: 105, glide: 0.14, a: 0.02, h: 0.03, r: 0.16, level: FX * 0.6 });
    droplet(ctx, bus, when + 0.22, SOFT * 0.35, 300, 430, 0.06);
    droplet(ctx, bus, when + 0.3, SOFT * 0.25, 260, 360, 0.07);
  };

  // =================================================================================================================
  // TABLE / EATING
  // =================================================================================================================
  // Ceramic plate set on the wooden table: clink + thud.
  I.plateSet = function (ctx, bus, when) {
    thud(ctx, bus, when, FX * 0.48, 115, 0.12, seedOf(when, 31));
    clink(ctx, bus, when + 0.004, FX * 0.38, [2650, 4150, 5600], 0.09);
    clink(ctx, bus, when + 0.065, FX * 0.16, [2650, 4150], 0.05);   // a tiny second contact (plate settling)
  };

  // Fork lifted from the plate: light metallic tick.
  I.forkPick = function (ctx, bus, when) {
    clink(ctx, bus, when, TICK * 0.75, [3600, 5300, 6400], 0.045);
  };

  // Fork touching the plate while twirling: tick with a hint of ceramic.
  I.forkClink = function (ctx, bus, when) {
    clink(ctx, bus, when, TICK * 0.85, [4100, 2650, 6200], 0.06);
    clink(ctx, bus, when + 0.055, TICK * 0.4, [2650, 4150], 0.04);
  };

  // Cute, muted munching: 3 soft low-passed ticks.
  I.eat = function (ctx, bus, when) {
    const seed = seedOf(when, 37);
    const gaps = [0, 0.17, 0.36];
    for (let i = 0; i < 3; i++) {
      const t = when + gaps[i], lvl = SOFT * (i === 1 ? 0.8 : 1.0);
      noise(ctx, bus, t, { seed: seed + i, type: 'bandpass', f: 520 + i * 60, q: 1.3, a: 0.006, h: 0.015, r: 0.05, level: lvl * 0.9, lp: 1400 });
      tone(ctx, bus, t, { type: 'sine', f: 200 - i * 15, f1: 140, glide: 0.04, a: 0.004, h: 0.01, r: 0.05, level: lvl * 0.7 });
    }
  };

  // Chair scraped on wood: short, muted (rippled bandpass noise + a wooden resonance).
  I.chair = function (ctx, bus, when) {
    const seed = seedOf(when, 41);
    noise(ctx, bus, when, { seed: seed, type: 'bandpass', f: 240, f1: 330, q: 2.5, a: 0.04, h: 0.16, r: 0.14, level: FX * 1.4, lp: 1200, trem: { rate: 27, depth: 0.5 } });
    tone(ctx, bus, when + 0.01, { type: 'triangle', f: 150, f1: 165, glide: 0.2, a: 0.04, h: 0.14, r: 0.12, level: FX * 0.5, lp: 500 });
  };

  // One footstep on wood (args.soft = quieter / socks).
  I.footstep = function (ctx, bus, when, args) {
    args = args || {};
    const lvl = FX * (args.soft ? 0.3 : 0.55);
    thud(ctx, bus, when, lvl, 85, 0.08, seedOf(when, 43));
    noise(ctx, bus, when, { seed: seedOf(when, 44), type: 'bandpass', f: args.soft ? 350 : 650, q: 1, a: 0.003, h: 0.006, r: 0.03, level: lvl * 0.5, lp: 1500 });
  };

  // =================================================================================================================
  // FRIDGE / ROOM
  // =================================================================================================================
  // Fridge door opens: seal pop + soft suction + short hinge whine.
  I.fridgeOpen = function (ctx, bus, when) {
    const seed = seedOf(when, 47);
    noise(ctx, bus, when, { seed: seed, type: 'lowpass', f: 650, q: 1, a: 0.004, h: 0.012, r: 0.07, level: FX * 0.8 });
    tone(ctx, bus, when, { type: 'sine', f: 220, f1: 85, glide: 0.05, a: 0.004, h: 0.01, r: 0.1, level: FX * 0.7 });
    // suction: breathy band of noise sweeping up
    noise(ctx, bus, when + 0.02, { seed: seed + 1, type: 'bandpass', f: 500, f1: 1600, q: 1.5, a: 0.05, h: 0.08, r: 0.2, level: FX * 0.35, lp: 3000 });
    // hinge: faint rising creak with vibrato
    tone(ctx, bus, when + 0.12, { type: 'triangle', f: 330, f1: 420, glide: 0.25, a: 0.08, h: 0.12, r: 0.14, level: SOFT * 0.35, vib: { rate: 18, depth: 9 }, lp: 1600 });
  };

  // Fridge door closes: muted thud + light rattle of things inside.
  I.fridgeClose = function (ctx, bus, when) {
    const seed = seedOf(when, 53);
    thud(ctx, bus, when, FX, 62, 0.22, seed);
    noise(ctx, bus, when, { seed: seed + 1, type: 'lowpass', f: 300, q: 0.9, a: 0.004, h: 0.03, r: 0.12, level: FX * 0.6 });
    // rattle: a few quick, quiet glassy ticks
    const gaps = [0.045, 0.09, 0.17, 0.26];
    for (let i = 0; i < gaps.length; i++) {
      const lv = TICK * (0.7 - i * 0.14);
      clink(ctx, bus, when + gaps[i], lv, [2300 + i * 170, 3500 - i * 120], 0.045);
      noise(ctx, bus, when + gaps[i], { seed: seed + 2 + i, type: 'bandpass', f: 1800, q: 2, a: 0.005, h: 0.004, r: 0.03, level: lv * 0.35, lp: 5000 });
    }
  };

  // Faint fridge hum for args.dur (mains-ish harmonics + a hint of air noise).
  I.fridgeHum = function (ctx, bus, when, args) {
    args = args || {};
    const dur = Math.max(0.3, num(args.dur, 3));
    const g = gainTo(ctx, bus, 0);
    const end = bed(g.gain, when, BED * 0.7, dur, Math.min(0.4, dur * 0.3), Math.min(0.5, dur * 0.3));
    const parts = [[60, 1.0, 'sine'], [120, 0.45, 'sine'], [180, 0.25, 'triangle'], [240, 0.12, 'sine']];
    for (const p of parts) {
      const o = ctx.createOscillator(); o.type = p[2]; o.frequency.value = p[0];
      o.connect(gainTo(ctx, g, p[1])); o.start(when); o.stop(end + 0.01);
    }
    // compressor-motor air: very quiet low-passed noise
    const nf = filt(ctx, g, 'lowpass', 500, 0.6);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, seedOf(when, 59) % NOISE_POOL); src.loop = true;
    src.connect(gainTo(ctx, nf, 0.12)); src.start(when); src.stop(end + 0.01);
  };

  // Lamp switch: a dry double click.
  I.lightSwitch = function (ctx, bus, when) {
    const seed = seedOf(when, 61);
    noise(ctx, bus, when, { seed: seed, type: 'bandpass', f: 2600, q: 1.5, a: 0.002, h: 0.004, r: 0.018, level: FX * 0.6 });
    tone(ctx, bus, when, { type: 'sine', f: 1500, f1: 900, glide: 0.01, a: 0.002, h: 0.003, r: 0.02, level: FX * 0.35 });
    noise(ctx, bus, when + 0.028, { seed: seed + 1, type: 'bandpass', f: 1900, q: 1.5, a: 0.002, h: 0.003, r: 0.025, level: FX * 0.45 });
    tone(ctx, bus, when + 0.028, { type: 'sine', f: 1100, f1: 600, glide: 0.012, a: 0.002, h: 0.003, r: 0.03, level: FX * 0.3 });
  };

  // One clock tick. args.accent = slightly brighter (the "tock"), args.level 0..1 scales with tension.
  I.tick = function (ctx, bus, when, args) {
    args = args || {};
    const lvl = TICK * G.clamp(num(args.level, 1), 0, 1) * (args.accent ? 1.15 : 1.0);
    const f = args.accent ? 2900 : 2300;
    noise(ctx, bus, when, { seed: seedOf(when, 67), type: 'bandpass', f: f, q: 3, a: 0.002, h: 0.004, r: 0.03, level: lvl * 0.9 });
    tone(ctx, bus, when, { type: 'sine', f: f * 0.8, a: 0.002, h: 0.004, r: 0.025, level: lvl * 0.5 });
    tone(ctx, bus, when, { type: 'sine', f: 420, f1: 300, glide: 0.02, a: 0.002, h: 0.006, r: 0.04, level: lvl * 0.45 });   // wooden case
  };

  // Subtle sleepy yawn: a slow vocal-ish sweep (triangle through a sweeping formant filter) + breath.
  I.yawn = function (ctx, bus, when) {
    const g = gainTo(ctx, bus, 0);
    const form = filt(ctx, g, 'bandpass', 520, 2.2);
    form.frequency.setValueAtTime(480, when);
    form.frequency.exponentialRampToValueAtTime(900, when + 0.45);
    form.frequency.exponentialRampToValueAtTime(380, when + 1.0);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(205, when);
    o.frequency.exponentialRampToValueAtTime(300, when + 0.4);
    o.frequency.exponentialRampToValueAtTime(175, when + 1.0);
    o.connect(form);
    const end = env(g.gain, when, SOFT * 1.4, 0.3, 0.3, 0.45);
    o.start(when); o.stop(end + 0.01);
    noise(ctx, bus, when + 0.05, { seed: seedOf(when, 71), type: 'bandpass', f: 1200, f1: 700, q: 0.8, a: 0.35, h: 0.25, r: 0.4, level: BED * 0.6, lp: 2500 });
  };

  // =================================================================================================================
  // QUESTION / INFO SCREENS
  // =================================================================================================================
  // Quiet low unsettling swell: slow attack, detuned low tones under a slowly opening lowpass. args.soft = quieter/shorter.
  I.sting = function (ctx, bus, when, args) {
    args = args || {};
    const soft = !!args.soft;
    const dur = soft ? 2.6 : 4.2, lvl = SOFT * (soft ? 0.5 : 0.85);
    const g = gainTo(ctx, bus, 0);
    const lp = filt(ctx, g, 'lowpass', 160, 1.2);
    lp.frequency.setValueAtTime(140, when);
    lp.frequency.exponentialRampToValueAtTime(soft ? 300 : 420, when + dur * 0.6);
    lp.frequency.exponentialRampToValueAtTime(120, when + dur);
    const end = env(g.gain, when, lvl, dur * 0.45, dur * 0.2, dur * 0.35);
    const parts = [[55, 'sawtooth', 0.5, 0], [55, 'triangle', 0.8, 7], [82.4, 'triangle', 0.35, -6], [116.5, 'sine', 0.22, 4]]; // A1, E2, Bb2 (minor-ninth rub)
    for (const p of parts) {
      const o = ctx.createOscillator(); o.type = p[1]; o.frequency.value = p[0]; o.detune.value = p[3];
      o.connect(gainTo(ctx, lp, p[2])); o.start(when); o.stop(end + 0.01);
    }
    // a faint high rub far above, fading in late
    tone(ctx, bus, when + dur * 0.3, { type: 'sine', f: 932, a: dur * 0.3, h: 0.1, r: dur * 0.3, level: lvl * 0.07 });
  };

  // Quiet low pad swell for args.dur (root + fifth + octave, slow in / slow out, gently opening filter).
  I.swell = function (ctx, bus, when, args) {
    args = args || {};
    const dur = Math.max(1, num(args.dur, 4));
    const g = gainTo(ctx, bus, 0);
    const lp = filt(ctx, g, 'lowpass', 300, 0.8);
    lp.frequency.setValueAtTime(220, when);
    lp.frequency.exponentialRampToValueAtTime(620, when + dur * 0.55);
    lp.frequency.exponentialRampToValueAtTime(200, when + dur);
    const end = bed(g.gain, when, SOFT * 0.7, dur, dur * 0.5, dur * 0.45);
    const parts = [[110, 'triangle', 0.8, 0], [110, 'sawtooth', 0.22, 6], [165, 'triangle', 0.45, -5], [220, 'sine', 0.3, 3]];
    for (const p of parts) {
      const o = ctx.createOscillator(); o.type = p[1]; o.frequency.value = p[0]; o.detune.value = p[3];
      o.connect(gainTo(ctx, lp, p[2])); o.start(when); o.stop(end + 0.01);
    }
  };

  // ---- export: clamp `when` to a valid context time (>= 0), default args, keep the names list ----------------------
  S.__names = ['blip', 'boil', 'sizzle', 'splash', 'stir', 'serve', 'ladle', 'plateSet', 'forkPick', 'forkClink', 'eat',
    'chair', 'footstep', 'notice', 'question', 'menuMove', 'fridgeOpen', 'fridgeClose', 'fridgeHum', 'lightSwitch', 'tick',
    'yawn', 'sting', 'reveal', 'swell'];
  for (const name of S.__names) {
    const impl = I[name];
    S[name] = function (ctx, bus, when, args) {
      when = typeof when === 'number' && isFinite(when) ? Math.max(0, when) : 0;
      return impl(ctx, bus, when, args || {});
    };
  }

  PSA.sfx = S;
})(window.PSA);
