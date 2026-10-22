// SYNTH — small chiptune / soft-synth toolkit on Web Audio (PSA.synth).
// Works on any BaseAudioContext (live AudioContext or OfflineAudioContext): everything is scheduled with absolute
// context times, nothing uses timers, and all "random" data (noise buffers, reverb impulses, humanization) comes
// from PSA.gfx.rng with fixed seeds so an offline render is bit-for-bit reproducible.
//
// Conventions
//   ctx   : BaseAudioContext.   bus : the AudioNode to connect into (a GainNode from the director).
//   t     : absolute context time (seconds).   dur : sustain length in seconds (release is added after it).
//   All gains are linear. All per-note parameter changes use ramps (no clicks).
//
// API
//   S.mtof(midi) / S.ftom(freq) / S.note('G4' | 'Bb3' | 'F#5') -> midi
//   S.pulseWave(ctx, duty, harmonics)         -> cached PeriodicWave (band-limited pulse, duty 0..1)
//   S.adsr(param, t, dur, env, peak)          -> end time.  env = {a, d, s, r}  (attack/decay seconds, sustain 0..1, release s)
//   S.ramp(param, t0, t1, v0, v1)             -> linear ramp helper (setValueAtTime + linearRampToValueAtTime)
//   S.curve(param, points)                    -> piecewise-linear automation from [[t, v], ...]
//   S.voice(ctx, bus, opts)                   -> one oscillator note. opts:
//       { t, dur, freq | midi, type: 'pulse'|'square'|'triangle'|'sine'|'sawtooth', duty, gain, env,
//         detune (cents), vibrato: {rate, depth (cents), delay}, lowpass: {freq, q, env (Hz added at attack), decay},
//         glide: {to (freq), at (s, relative to t), dur}, tremolo: {rate, depth 0..1, delay}, pan (-1..1), send: node }
//       returns { osc, gain, end }
//   S.noise(ctx, bus, opts)                   -> filtered noise burst/loop. opts:
//       { t, dur, gain, env, filter: {type, freq, q}, filterEnv (Hz at attack), seed, pan, send }
//   S.delaySend(ctx, bus, opts)               -> { input } feedback delay: {time, feedback, tone (lowpass Hz), wet}
//   S.reverbSend(ctx, bus, opts)              -> { input } convolution reverb with a generated impulse: {seconds, decay, tone, wet, seed}
//   S.instrument(defaults)                    -> function (ctx, bus, t, midi, dur, vel, extra) playing S.voice with merged opts
//   S.sequence(ctx, bus, t0, spec)            -> schedules a note list. spec = { bpm | beatTime(beat) -> seconds (relative),
//       inst (instrument fn), notes: [[beat, midi|name, durBeats, vel, extra], ...], swing, humanize: {seed, time, vel} }
//       returns the end time of the last note.
//   S.lfo(ctx, {t, rate, depth, delay, type})  -> gain node output of a sine LFO (connect to any AudioParam), {osc, gain}
//   S.db(dB) -> linear gain
(function (PSA) {
  const S = {};
  const G = PSA.gfx;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------ pitch helpers
  S.mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  S.ftom = function (f) { return 69 + 12 * Math.log2(f / 440); };
  const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  S.note = function (name) {
    if (typeof name === 'number') return name;
    const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
    if (!m) throw new Error('synth.note: bad note name ' + name);
    let pc = NOTE_PC[m[1].toUpperCase()];
    if (m[2] === '#') pc++; else if (m[2] === 'b') pc--;
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  };
  S.db = function (dB) { return Math.pow(10, dB / 20); };

  // ------------------------------------------------------------------ waveforms
  // Band-limited pulse wave of the given duty cycle (0.5 = square). Cached per context and duty.
  const waveCache = new WeakMap();
  S.pulseWave = function (ctx, duty, harmonics) {
    duty = clamp(duty == null ? 0.25 : duty, 0.02, 0.98);
    harmonics = harmonics || 48;
    let m = waveCache.get(ctx);
    if (!m) { m = new Map(); waveCache.set(ctx, m); }
    const key = duty.toFixed(3) + '/' + harmonics;
    if (m.has(key)) return m.get(key);
    const real = new Float32Array(harmonics + 1), imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      // Fourier series of a pulse with duty d (DC removed): a_n = 2 sin(n pi d) / (n pi); soft roll-off at the top
      const roll = n > harmonics * 0.7 ? (harmonics - n) / (harmonics * 0.3) : 1;
      real[n] = roll * 2 * Math.sin(n * Math.PI * duty) / (n * Math.PI);
    }
    const w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    m.set(key, w);
    return w;
  };

  // ------------------------------------------------------------------ parameter automation
  S.ramp = function (param, t0, t1, v0, v1) {
    param.setValueAtTime(v0, t0);
    param.linearRampToValueAtTime(v1, Math.max(t1, t0 + 0.001));
  };
  // points: [[t, v], ...] sorted by t -> linear segments
  S.curve = function (param, points) {
    if (!points.length) return;
    param.setValueAtTime(points[0][1], points[0][0]);
    for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i][1], Math.max(points[i][0], points[i - 1][0] + 0.001));
  };
  // ADSR on a gain-like param. Returns the time the envelope reaches zero.
  S.adsr = function (param, t, dur, env, peak) {
    env = env || {};
    peak = peak == null ? 1 : peak;
    const a = Math.max(0.003, env.a == null ? 0.01 : env.a);
    const d = Math.max(0.003, env.d == null ? 0.05 : env.d);
    const s = clamp(env.s == null ? 0.7 : env.s, 0, 1);
    const r = Math.max(0.01, env.r == null ? 0.1 : env.r);
    dur = Math.max(dur, a);
    const tEnd = t + dur, tRel = tEnd + r;
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (dur > a + d) {
      param.linearRampToValueAtTime(peak * s, t + a + d);
      param.setValueAtTime(peak * s, tEnd);
    }
    param.linearRampToValueAtTime(0, tRel);
    return tRel;
  };

  // ------------------------------------------------------------------ LFO
  S.lfo = function (ctx, o) {
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.value = o.rate || 5;
    const g = ctx.createGain();
    const delay = o.delay || 0;
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.depth || 0, o.t + delay + 0.25);
    osc.connect(g);
    osc.start(o.t);
    if (o.stop != null) osc.stop(o.stop);
    return { osc: osc, gain: g };
  };

  function panNode(ctx, pan) {
    if (!pan || !ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  // ------------------------------------------------------------------ oscillator voice
  S.voice = function (ctx, bus, o) {
    const t = Math.max(o.t, ctx.currentTime); // never schedule in the past (humanized notes near t0)
    const dur = Math.max(0.01, o.dur == null ? 0.25 : o.dur);
    const freq = o.freq != null ? o.freq : S.mtof(o.midi != null ? o.midi : 69);
    const osc = ctx.createOscillator();
    const type = o.type || 'triangle';
    if (type === 'pulse') osc.setPeriodicWave(S.pulseWave(ctx, o.duty == null ? 0.25 : o.duty, o.harmonics));
    else osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) { // portamento to another frequency
      const at = t + (o.glide.at || 0);
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.linearRampToValueAtTime(o.glide.to, at + Math.max(0.01, o.glide.dur || 0.1));
    }
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);
    if (o.detuneTo != null) { osc.detune.setValueAtTime(o.detune || 0, t); osc.detune.linearRampToValueAtTime(o.detuneTo, t + dur); }

    const amp = ctx.createGain();
    const env = o.env || {};
    const tEnd = S.adsr(amp.gain, t, dur, env, o.gain == null ? 0.2 : o.gain);
    let head = osc;
    if (o.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = o.lowpass.q == null ? 0.7 : o.lowpass.q;
      const f0 = o.lowpass.freq || 2000;
      if (o.lowpass.env) {
        lp.frequency.setValueAtTime(f0 + o.lowpass.env, t);
        lp.frequency.linearRampToValueAtTime(f0, t + Math.max(0.01, o.lowpass.decay || 0.2));
      } else lp.frequency.setValueAtTime(f0, t);
      if (o.lowpass.to != null) { lp.frequency.setValueAtTime(f0, t + 0.001); lp.frequency.linearRampToValueAtTime(o.lowpass.to, tEnd); }
      head.connect(lp); head = lp;
    }
    head.connect(amp);
    let out = amp;
    if (o.tremolo) { // amplitude modulation: gain = 1 - depth/2 + lfo
      const tg = ctx.createGain();
      tg.gain.value = 1 - (o.tremolo.depth || 0.3) / 2;
      const l = S.lfo(ctx, { t: t, rate: o.tremolo.rate || 6, depth: (o.tremolo.depth || 0.3) / 2, delay: o.tremolo.delay || 0, stop: tEnd + 0.05 });
      if (o.tremolo.rateTo) l.osc.frequency.linearRampToValueAtTime(o.tremolo.rateTo, tEnd);
      l.gain.connect(tg.gain);
      out.connect(tg); out = tg;
    }
    const pan = panNode(ctx, o.pan);
    if (pan) { out.connect(pan); out = pan; }
    out.connect(bus);
    if (o.send) out.connect(o.send);
    if (o.vibrato) {
      const v = S.lfo(ctx, { t: t, rate: o.vibrato.rate || 5.5, depth: o.vibrato.depth || 6, delay: o.vibrato.delay || 0.1, stop: tEnd + 0.05 });
      v.gain.connect(osc.detune);
    }
    osc.start(t);
    osc.stop(tEnd + 0.02);
    return { osc: osc, gain: amp, end: tEnd };
  };

  // ------------------------------------------------------------------ noise
  const noiseCache = new WeakMap();
  // 2 s of deterministic white noise (mono) per context + seed
  S.noiseBuffer = function (ctx, seed) {
    seed = seed | 0;
    let m = noiseCache.get(ctx);
    if (!m) { m = new Map(); noiseCache.set(ctx, m); }
    if (m.has(seed)) return m.get(seed);
    const n = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = G.rng(0x9e37 + seed * 7919);
    for (let i = 0; i < n; i++) data[i] = rnd() * 2 - 1;
    m.set(seed, buf);
    return buf;
  };
  S.noise = function (ctx, bus, o) {
    const t = Math.max(o.t, ctx.currentTime), dur = Math.max(0.005, o.dur == null ? 0.05 : o.dur);
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuffer(ctx, o.seed || 0);
    src.loop = true;
    // start somewhere deterministic inside the buffer so repeated hits do not sound identical
    src.loopStart = 0; src.loopEnd = src.buffer.duration;
    const off = o.offset != null ? o.offset : G.hash(Math.round(t * 1000), o.seed || 0, 17) * 1.5;
    let head = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'bandpass';
      f.Q.value = o.filter.q == null ? 1 : o.filter.q;
      const f0 = o.filter.freq || 3000;
      if (o.filterEnv) { f.frequency.setValueAtTime(f0 + o.filterEnv, t); f.frequency.linearRampToValueAtTime(f0, t + Math.max(0.01, o.filterDecay || 0.1)); }
      else f.frequency.setValueAtTime(f0, t);
      if (o.filter.to != null) { f.frequency.setValueAtTime(f0, t + 0.001); f.frequency.linearRampToValueAtTime(o.filter.to, t + dur); }
      head.connect(f); head = f;
    }
    const amp = ctx.createGain();
    const tEnd = S.adsr(amp.gain, t, dur, o.env || { a: 0.005, d: 0.02, s: 0.5, r: 0.03 }, o.gain == null ? 0.1 : o.gain);
    head.connect(amp);
    let out = amp;
    const pan = panNode(ctx, o.pan);
    if (pan) { out.connect(pan); out = pan; }
    out.connect(bus);
    if (o.send) out.connect(o.send);
    src.start(t, off);
    src.stop(tEnd + 0.02);
    return { src: src, gain: amp, end: tEnd };
  };

  // ------------------------------------------------------------------ effect sends
  // Feedback delay with a lowpass in the loop. Connect voices to .input; the wet signal goes to bus.
  S.delaySend = function (ctx, bus, o) {
    o = o || {};
    const input = ctx.createGain(); input.gain.value = 1;
    const d = ctx.createDelay(2.0); d.delayTime.value = o.time == null ? 0.33 : o.time;
    const fb = ctx.createGain(); fb.gain.value = clamp(o.feedback == null ? 0.3 : o.feedback, 0, 0.9);
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = o.tone || 2500; tone.Q.value = 0.5;
    const wet = ctx.createGain(); wet.gain.value = o.wet == null ? 0.3 : o.wet;
    input.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(wet); wet.connect(bus);
    return { input: input, wet: wet, delay: d, feedback: fb };
  };
  // Convolution reverb with a generated (deterministic) stereo impulse.
  const irCache = new WeakMap();
  S.impulse = function (ctx, seconds, decay, tone, seed) {
    seconds = seconds || 1.8; decay = decay || 3; seed = seed | 0;
    let m = irCache.get(ctx);
    if (!m) { m = new Map(); irCache.set(ctx, m); }
    const key = seconds + '/' + decay + '/' + tone + '/' + seed;
    if (m.has(key)) return m.get(key);
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    const k = Math.exp(-2 * Math.PI * (tone || 3000) / ctx.sampleRate); // one-pole lowpass coefficient
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      const rnd = G.rng(0x51ed + seed * 131 + c * 7777);
      let y = 0;
      for (let i = 0; i < n; i++) {
        const x = rnd() * 2 - 1;
        y = k * y + (1 - k) * x;
        const e = Math.exp(-decay * i / n);
        const pre = i < 200 ? i / 200 : 1; // tiny ramp so the direct sound does not double
        data[i] = y * e * pre;
      }
    }
    m.set(key, buf);
    return buf;
  };
  S.reverbSend = function (ctx, bus, o) {
    o = o || {};
    const input = ctx.createGain(); input.gain.value = 1;
    const conv = ctx.createConvolver();
    conv.buffer = S.impulse(ctx, o.seconds, o.decay, o.tone, o.seed);
    const wet = ctx.createGain(); wet.gain.value = o.wet == null ? 0.25 : o.wet;
    input.connect(conv); conv.connect(wet); wet.connect(bus);
    return { input: input, wet: wet, convolver: conv };
  };

  // ------------------------------------------------------------------ instruments + sequencer
  // instrument(defaults) -> play(ctx, bus, t, midi, dur, vel, extra). vel scales gain (1 = defaults.gain).
  S.instrument = function (defaults) {
    return function (ctx, bus, t, midi, dur, vel, extra) {
      const o = Object.assign({}, defaults, extra || {});
      o.t = t; o.dur = dur; o.midi = midi;
      o.gain = (defaults.gain == null ? 0.2 : defaults.gain) * (vel == null ? 1 : vel) * (extra && extra.gainMul != null ? extra.gainMul : 1);
      if (o.unison) { // detuned doubled voice: play two oscillators, +/- cents
        const cents = o.unison;
        const a = Object.assign({}, o, { detune: (o.detune || 0) + cents, gain: o.gain * 0.5, pan: (o.pan || 0) - 0.15 });
        const b = Object.assign({}, o, { detune: (o.detune || 0) - cents, gain: o.gain * 0.5, pan: (o.pan || 0) + 0.15 });
        delete a.unison; delete b.unison;
        S.voice(ctx, bus, a);
        return S.voice(ctx, bus, b);
      }
      return S.voice(ctx, bus, o);
    };
  };

  // Schedules spec.notes with spec.inst. Each note: [beat, midi|name, durBeats, vel, extra] or an object with those keys.
  // Time for a beat: spec.beatTime(beat) (seconds relative to t0) when given, else beat * 60 / bpm.
  S.sequence = function (ctx, bus, t0, spec) {
    const bpm = spec.bpm || 120;
    const bt = spec.beatTime || ((b) => b * 60 / bpm);
    const hum = spec.humanize;
    const rnd = hum ? G.rng(hum.seed || 1) : null;
    let last = t0;
    for (const n of spec.notes) {
      const beat = Array.isArray(n) ? n[0] : n.beat;
      const midi = S.note(Array.isArray(n) ? n[1] : n.midi);
      const durB = Array.isArray(n) ? (n[2] == null ? 1 : n[2]) : (n.dur == null ? 1 : n.dur);
      let vel = Array.isArray(n) ? (n[3] == null ? 1 : n[3]) : (n.vel == null ? 1 : n.vel);
      const extra = Array.isArray(n) ? n[4] : n.extra;
      let tStart = t0 + bt(beat);
      let tEnd = t0 + bt(beat + durB);
      if (spec.swing && Math.abs(beat % 1 - 0.5) < 1e-6) tStart += spec.swing * (bt(beat + 0.5) - bt(beat)); // swing the off-beats
      if (hum) {
        tStart = Math.max(t0, tStart + (rnd() * 2 - 1) * (hum.time || 0));
        vel *= 1 + (rnd() * 2 - 1) * (hum.vel || 0);
      }
      const dur = Math.max(0.03, (tEnd - tStart) * (spec.legato == null ? 0.92 : spec.legato));
      const v = spec.inst(ctx, bus, tStart, midi, dur, vel, extra);
      if (v && v.end > last) last = v.end;
    }
    return last;
  };

  PSA.synth = S;
})(window.PSA);
