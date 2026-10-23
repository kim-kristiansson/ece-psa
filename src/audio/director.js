// Audio director: builds the complete soundtrack on any BaseAudioContext (live AudioContext for playback,
// OfflineAudioContext for the MP4 export). Everything is scheduled relative to t0 (context time of video time 0).
//   PSA.music.schedule(ctx, bus, t0)                 -> composition (src/audio/music.js)
//   PSA.sfx[name](ctx, bus, when, args)              -> one sound effect (src/audio/sfx.js)
// SFX events come from the timeline (shot.sfx + text blips).
(function (PSA) {
  const A = {};
  A.MUSIC_GAIN = 0.8;  // overall music level (music.js balances internally around -16 dBFS RMS)
  A.SFX_GAIN = 0.9;

  // Everything below is scheduled in story seconds; PSA.SPEED plays it faster. While building, every scheduling call
  // (source start/stop, AudioParam automation) maps its time t to t0 + (t - t0) / SPEED, so music keeps its pitch
  // and just runs at a quicker tempo, and sound effects land on the sped-up picture.
  function warped(t0, S, fn) {
    if (S === 1) return fn();
    const W = (t) => (typeof t === 'number' ? t0 + (t - t0) / S : t);
    const SN = AudioScheduledSourceNode.prototype, AP = AudioParam.prototype, BS = AudioBufferSourceNode.prototype;
    const saved = { start: SN.start, stop: SN.stop, bstart: BS.start, set: AP.setValueAtTime, lin: AP.linearRampToValueAtTime,
      exp: AP.exponentialRampToValueAtTime, tgt: AP.setTargetAtTime, curve: AP.setValueCurveAtTime, cancel: AP.cancelScheduledValues };
    SN.start = function (w) { return arguments.length ? saved.start.call(this, W(w)) : saved.start.call(this); };
    SN.stop = function (w) { return arguments.length ? saved.stop.call(this, W(w)) : saved.stop.call(this); };
    if (Object.prototype.hasOwnProperty.call(BS, 'start')) BS.start = function (w, off, dur) {
      const args = [W(w || 0)]; if (off != null) args.push(off); if (dur != null) args.push(dur);
      return saved.bstart.apply(this, args);
    };
    AP.setValueAtTime = function (v, w) { return saved.set.call(this, v, W(w)); };
    AP.linearRampToValueAtTime = function (v, w) { return saved.lin.call(this, v, W(w)); };
    AP.exponentialRampToValueAtTime = function (v, w) { return saved.exp.call(this, v, W(w)); };
    AP.setTargetAtTime = function (v, w, tc) { return saved.tgt.call(this, v, W(w), tc / S); };
    AP.setValueCurveAtTime = function (v, w, d) { return saved.curve.call(this, v, W(w), d / S); };
    AP.cancelScheduledValues = function (w) { return saved.cancel.call(this, W(w)); };
    try { return fn(); }
    finally {
      SN.start = saved.start; SN.stop = saved.stop; if (Object.prototype.hasOwnProperty.call(BS, 'start')) BS.start = saved.bstart;
      AP.setValueAtTime = saved.set; AP.linearRampToValueAtTime = saved.lin; AP.exponentialRampToValueAtTime = saved.exp;
      AP.setTargetAtTime = saved.tgt; AP.setValueCurveAtTime = saved.curve; AP.cancelScheduledValues = saved.cancel;
    }
  }

  A.build = function (ctx, t0, opts) {
    return warped(t0, PSA.SPEED || 1, () => buildStory(ctx, t0, opts));
  };
  function buildStory(ctx, t0, opts) {
    opts = opts || {};
    const master = ctx.createGain(); master.gain.value = 1.0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    const musicBus = ctx.createGain(); musicBus.gain.value = opts.music === false ? 0 : A.MUSIC_GAIN; musicBus.connect(master);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = opts.sfx === false ? 0 : A.SFX_GAIN; sfxBus.connect(master);

    const report = { music: false, sfx: 0, missing: {} };
    if (PSA.music && PSA.music.schedule && opts.music !== false) { PSA.music.schedule(ctx, musicBus, t0); report.music = true; }
    if (PSA.sfx && opts.sfx !== false) {
      const events = PSA.timeline.sfxEvents();
      for (const e of events) {
        const fn = PSA.sfx[e.name];
        if (!fn) { report.missing[e.name] = (report.missing[e.name] || 0) + 1; continue; }
        try { fn(ctx, sfxBus, t0 + e.t, e.args || {}); report.sfx++; }
        catch (err) { console.error('sfx ' + e.name + ' failed', err); }
      }
    }
    return { master: master, musicBus: musicBus, sfxBus: sfxBus, report: report };
  }

  // Render the full soundtrack offline -> AudioBuffer
  A.renderOffline = async function (duration, opts) {
    const sr = PSA.AUDIO_SR;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
    const r = A.build(ctx, 0, opts);
    const buf = await ctx.startRendering();
    return { buffer: buf, report: r.report };
  };

  // AudioBuffer -> 16-bit PCM WAV (ArrayBuffer)
  A.toWav = function (buffer, start, end) {
    const sr = buffer.sampleRate, ch = buffer.numberOfChannels;
    const s0 = Math.max(0, Math.floor((start || 0) * sr));
    const s1 = Math.min(buffer.length, end == null ? buffer.length : Math.ceil(end * sr));
    const n = Math.max(0, s1 - s0);
    const bytes = 44 + n * ch * 2;
    const ab = new ArrayBuffer(bytes), dv = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = s0; i < s1; i++) for (let c = 0; c < ch; c++) {
      let v = chans[c][i]; v = v < -1 ? -1 : v > 1 ? 1 : v;
      dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2;
    }
    return ab;
  };

  PSA.audio = A;
})(window.PSA);
