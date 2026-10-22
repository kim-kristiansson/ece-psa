// Audio director: builds the complete soundtrack on any BaseAudioContext (live AudioContext for playback,
// OfflineAudioContext for the MP4 export). Everything is scheduled relative to t0 (context time of video time 0).
//   PSA.music.schedule(ctx, bus, t0)                 -> composition (src/audio/music.js)
//   PSA.sfx[name](ctx, bus, when, args)              -> one sound effect (src/audio/sfx.js)
// SFX events come from the timeline (shot.sfx + text blips).
(function (PSA) {
  const A = {};
  A.MUSIC_GAIN = 0.8;  // overall music level (music.js balances internally around -16 dBFS RMS)
  A.SFX_GAIN = 0.9;

  A.build = function (ctx, t0, opts) {
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
  };

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
