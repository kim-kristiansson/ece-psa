// MUSIC — the original score of "Small Mistakes, Big Risks" (PSA.music).
//   PSA.music.schedule(ctx, bus, t0)   schedules the WHOLE score on any BaseAudioContext (offline or live);
//                                      t0 = context time of video time 0. No timers, no Math.random.
//   PSA.music.sections                 [{t0, t1, name, mood}] — the dramatic sections of the score (video seconds)
//   PSA.music.gainAt(t)                master automation curve (0..1) at video time t (the fade-in, the duck at 104.5 s,
//                                      the final fade-out). The same curve drives the master GainNode.
//   PSA.music.beatTime(beat)           tempo map of the cozy tune (seconds for a beat; the tune slows down after 45 s)
//   PSA.music.barTime(bar)             same for bars (3/4 time)
//
// Structure (video seconds):
//    0 – 45   COZY        "Evening Pasta" — original waltz in G major, 84 BPM: triangle lead, lowpassed pulse arpeggio,
//                         round bass, soft pad, noise brush. Form: 2-bar intro, A (8 bars), B (8 bars), A' (bars 18–25).
//   45 – 69   TIME PASSES the same tune ritardando (84 -> 56 BPM) and sliding into G minor from bar 22; the arps and
//                         brush fade out, the pad detunes, a low drone fades in, the melody thins to an echo of the motif.
//   69 – 81   LATE NIGHT  low minor pad + drone, three sparse high sine notes, no beat.
//   81 – 101  MORNING     suspended/ambiguous pad chords, thin high sustained tones, very slow.
//  101 – 104.5 TENSION    rising sine tone + tremolo on the pad; at 104.5 the master gain ducks to silence (0.6 s).
//  104.5 – 111.5 SILENCE
//  111.5 – 121.5 QUESTION near silence; from 113 s a very low drone swells slowly.
//  121.5 – 135.5 INFO     slow serious pad chords Gm – Eb – Cm – Dsus4 resolving to G major at the slogan (132.5),
//                         fading out completely by 136.6 (the film ends at 137.0).
(function (PSA) {
  const S = PSA.synth, G = PSA.gfx;
  const M = {};

  // ------------------------------------------------------------------ sections
  M.sections = [
    { t0: 0,     t1: 45,    name: 'cozy',       mood: 'warm, relaxed waltz (G major)' },
    { t0: 45,    t1: 69,    name: 'timePasses', mood: 'same tune slowing, sliding to G minor, pad detunes, drone' },
    { t0: 69,    t1: 81,    name: 'lateNight',  mood: 'subdued minimal: low pad + sparse high notes' },
    { t0: 81,    t1: 101,   name: 'morning',    mood: 'quiet, uneasy suspended chords, thin high tones' },
    { t0: 101,   t1: 104.5, name: 'tension',    mood: 'rising tone + tremolo, then duck to silence' },
    { t0: 104.5, t1: 111.5, name: 'silence',    mood: 'silent' },
    { t0: 111.5, t1: 121.5, name: 'question',   mood: 'near silence, very low drone swell from 113 s' },
    { t0: 121.5, t1: 137.0, name: 'info',       mood: 'soft serious minor pad resolving to major at 132.5, out by 136.6' }
  ];

  // ------------------------------------------------------------------ master automation (video time -> gain)
  const MASTER = [
    [0, 0], [1.4, 1],            // fade in with the picture
    [104.5, 1], [105.1, 0],      // the fork stops: duck to silence in 0.6 s
    [111.5, 0], [111.6, 1],      // (silent anyway) re-open for the question drone
    [134.8, 1], [136.6, 0], [137.0, 0]   // the final chord rings under the slogan, out before the picture is black
  ];
  M.gainAt = function (t) {
    if (t <= MASTER[0][0]) return MASTER[0][1];
    for (let i = 1; i < MASTER.length; i++) {
      if (t <= MASTER[i][0]) { const a = MASTER[i - 1], b = MASTER[i]; return G.lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    }
    return MASTER[MASTER.length - 1][1];
  };

  // ------------------------------------------------------------------ tempo map (3/4, beats)
  // 84 BPM until beat 63 (= 45.0 s, bar 21), then a long ritardando to 56 BPM at beat 96, constant afterwards.
  const BPM0 = 84, BPM1 = 56, RIT_B0 = 63, RIT_B1 = 96;
  function bpmAt(b) { return b < RIT_B0 ? BPM0 : b < RIT_B1 ? G.lerp(BPM0, BPM1, (b - RIT_B0) / (RIT_B1 - RIT_B0)) : BPM1; }
  const STEP = 1 / 16, MAXBEAT = 160;
  const beatTable = [0];
  for (let b = 0; b < MAXBEAT; b += STEP) beatTable.push(beatTable[beatTable.length - 1] + STEP * 60 / bpmAt(b + STEP / 2));
  M.beatTime = function (b) {
    const k = b / STEP, i = Math.floor(k);
    if (i >= beatTable.length - 1) return beatTable[beatTable.length - 1] + (b - MAXBEAT) * 60 / BPM1;
    return G.lerp(beatTable[i], beatTable[i + 1], k - i);
  };
  M.barTime = function (bar) { return M.beatTime(bar * 3); };

  // ------------------------------------------------------------------ harmony helpers
  // Parallel minor: G major -> G minor (B->Bb, E->Eb, F#->F). Written for the key of G (tonic midi 67 = G4).
  const TONIC = 67;
  function toMinor(midi) { const pc = ((midi - TONIC) % 12 + 12) % 12; return (pc === 4 || pc === 9 || pc === 11) ? midi - 1 : midi; }
  // Chord of the tune per bar, by root pitch class offset from G and quality ('M' major, 'm' minor).
  // Bars 0-1 intro, 2-9 A, 10-17 B, 18-25 A', 26-29 echo. From bar 22 everything is passed through toMinor().
  const MINOR_FROM_BAR = 22;
  const CH = {
    G: { r: 0, q: 'M' }, C: { r: 5, q: 'M' }, D: { r: 7, q: 'M' }, Em: { r: 9, q: 'm' }, Am: { r: 2, q: 'm' }, Bm: { r: 4, q: 'm' }
  };
  const PROG = [
    'G', 'G',                                   // intro
    'G', 'G', 'C', 'D', 'Em', 'C', 'D', 'G',    // A
    'Em', 'Bm', 'C', 'G', 'Am', 'D', 'C', 'D',  // B
    'G', 'G', 'C', 'D', 'Em', 'C', 'D', 'G',    // A'  (bars 22-25 become Eb, Cm, Dm, Gm)
    'G', 'G', 'C', 'G'                          // echo (Gm, Gm, Cm, Gm)
  ];
  // chord tones [root, third, fifth] with the root placed in [lo, lo+12)
  function chordTones(bar, lo) {
    const c = CH[PROG[Math.min(bar, PROG.length - 1)]];
    let root = TONIC + c.r;
    while (root >= lo + 12) root -= 12;
    while (root < lo) root += 12;
    const tones = [root, root + (c.q === 'm' ? 3 : 4), root + 7];
    return bar >= MINOR_FROM_BAR ? tones.map(toMinor) : tones;
  }
  function pitchAt(bar, midi) { return bar >= MINOR_FROM_BAR ? toMinor(midi) : midi; }

  // ------------------------------------------------------------------ the melody (midi, G major; beats inside the 8-bar phrase)
  // [beat, midi, durBeats, vel]
  const MEL_A = [
    [0, 71, 1, 0.9], [1, 74, 1, 0.85], [2, 79, 1, 1.0],
    [3, 78, 2, 0.95], [5, 76, 1, 0.8],
    [6, 76, 1, 0.85], [7, 72, 1, 0.8], [8, 76, 1, 0.9],
    [9, 74, 3, 0.95],
    [12, 71, 1, 0.85], [13, 74, 1, 0.85], [14, 76, 1, 0.9],
    [15, 74, 1.5, 0.9], [16.5, 72, 0.5, 0.75], [17, 69, 1, 0.8],
    [18, 71, 1, 0.85], [19, 69, 1, 0.8], [20, 66, 1, 0.8],
    [21, 67, 2, 0.9], [23, 74, 1, 0.8]                       // pickup into B
  ];
  const MEL_B = [
    [0, 76, 1, 0.9], [1, 79, 1, 0.9], [2, 83, 1, 1.0],
    [3, 81, 2, 0.95], [5, 78, 1, 0.8],
    [6, 79, 1, 0.9], [7, 76, 1, 0.8], [8, 72, 1, 0.8],
    [9, 74, 3, 0.95],
    [12, 72, 1, 0.85], [13, 76, 1, 0.85], [14, 81, 1, 0.95],
    [15, 78, 1.5, 0.9], [16.5, 76, 0.5, 0.75], [17, 74, 1, 0.85],
    [18, 72, 1, 0.85], [19, 71, 1, 0.8], [20, 69, 1, 0.8],
    [21, 66, 1.5, 0.85], [22.5, 67, 0.5, 0.75], [23, 69, 1, 0.85] // F# G A -> leads into the B of A'
  ];
  // A' = first half of A (major), then a sparser second half (turned minor by the bar rule), then the echo.
  const MEL_A2 = [
    [0, 71, 1, 0.9], [1, 74, 1, 0.85], [2, 79, 1, 1.0],
    [3, 78, 2, 0.95], [5, 76, 1, 0.8],
    [6, 76, 1, 0.85], [7, 72, 1, 0.8], [8, 76, 1, 0.9],
    [9, 74, 3, 0.9],
    [12, 71, 2, 0.8], [14, 76, 1, 0.75],                    // bar 22: Bb .. Eb  (minor from here)
    [15, 74, 2, 0.75], [17, 69, 1, 0.65],
    [18, 71, 2, 0.7], [20, 66, 1, 0.6],
    [21, 67, 3, 0.7]
  ];
  const MEL_ECHO = [                                         // bars 26-28: a fading echo of the motif head
    [0, 71, 1, 0.55], [1, 74, 1, 0.5], [2, 79, 1.5, 0.55],
    [4, 78, 2, 0.45],
    [7.5, 76, 1.5, 0.35],
    [9, 74, 3, 0.35]
  ];

  // ------------------------------------------------------------------ instruments
  const INST = {
    lead: S.instrument({ type: 'triangle', gain: 0.2, env: { a: 0.025, d: 0.12, s: 0.8, r: 0.28 },
      lowpass: { freq: 3200, q: 0.5 }, vibrato: { rate: 5.4, depth: 7, delay: 0.18 } }),
    arp: S.instrument({ type: 'pulse', duty: 0.25, gain: 0.075, env: { a: 0.004, d: 0.14, s: 0.3, r: 0.07 },
      lowpass: { freq: 1500, q: 0.8, env: 900, decay: 0.12 }, pan: 0.22 }),
    bass: S.instrument({ type: 'sine', gain: 0.17, env: { a: 0.012, d: 0.25, s: 0.75, r: 0.16 } }),
    bassTop: S.instrument({ type: 'triangle', gain: 0.06, env: { a: 0.012, d: 0.2, s: 0.5, r: 0.14 }, lowpass: { freq: 900, q: 0.5 } }),
    pad: S.instrument({ type: 'pulse', duty: 0.5, gain: 0.03, env: { a: 0.45, d: 0.4, s: 0.85, r: 0.6 },
      lowpass: { freq: 700, q: 0.4 }, unison: 4 }),
    padSoft: S.instrument({ type: 'triangle', gain: 0.085, env: { a: 1.2, d: 0.8, s: 0.85, r: 1.6 },
      lowpass: { freq: 900, q: 0.3 }, unison: 3 }),
    padDark: S.instrument({ type: 'pulse', duty: 0.5, gain: 0.02, env: { a: 1.2, d: 0.8, s: 0.85, r: 1.6 },
      lowpass: { freq: 420, q: 0.3 }, unison: 6 }),
    high: S.instrument({ type: 'sine', gain: 0.07, env: { a: 1.2, d: 0.6, s: 0.8, r: 1.4 }, vibrato: { rate: 4.2, depth: 4, delay: 0.8 } }),
    droneSub: S.instrument({ type: 'sine', gain: 0.075, env: { a: 2, d: 1, s: 1, r: 2 } }),
    droneLow: S.instrument({ type: 'triangle', gain: 0.03, env: { a: 2, d: 1, s: 1, r: 2 }, lowpass: { freq: 260, q: 0.4 } })
  };

  // ------------------------------------------------------------------ schedule
  M.schedule = function (ctx, bus, t0) {
    const BT = (b) => t0 + M.beatTime(b);          // absolute time of a beat
    const BAR = (bar) => BT(bar * 3);
    const T = (sec) => t0 + sec;                    // absolute time of a video second
    const sub = (points) => {                       // an element bus with its own gain curve (video seconds)
      const g = ctx.createGain();
      S.curve(g.gain, points.map((p) => [T(p[0]), p[1]]));
      g.connect(master);
      return g;
    };

    // master gain (also ducks the effect tails) + global sends
    const master = ctx.createGain();
    S.curve(master.gain, MASTER.map((p) => [T(p[0]), p[1]]));
    master.connect(bus);
    const verb = S.reverbSend(ctx, master, { seconds: 2.2, decay: 3.2, tone: 2600, wet: 0.22, seed: 3 });
    const verbLong = S.reverbSend(ctx, master, { seconds: 4.0, decay: 2.6, tone: 1800, wet: 0.3, seed: 5 });
    const echo = S.delaySend(ctx, master, { time: M.beatTime(1.5) - M.beatTime(0), feedback: 0.22, tone: 2200, wet: 0.16 });

    // ---------------------------------------------------------- element buses (fades over the transition)
    const leadBus = sub([[0, 1], [47, 1], [58, 0.8], [69, 0.5]]);
    const arpBus = sub([[0, 1], [46, 1], [60, 0]]);
    const brushBus = sub([[0, 1], [45, 1], [55, 0]]);
    const bassBus = sub([[0, 1], [49, 1], [58, 0.5], [65, 0]]);
    const padBus = sub([[0, 1], [50, 1], [69, 0.65], [80.0, 0.5], [81.2, 0]]);
    const droneBus = sub([[0, 0], [50, 0], [66, 1], [79.5, 1], [81.2, 0]]);
    const nightBus = sub([[0, 1]]);

    // ---------------------------------------------------------- 0–69 s: the tune (tempo map handles the ritardando)
    const BARS = 30; // bars 0..29 (bar 29 ends around 70 s)
    const firstMelodyBar = 2;

    // lead melody: A (bars 2-9), B (10-17), A' (18-25), echo (26-28)
    const phrases = [[2, MEL_A], [10, MEL_B], [18, MEL_A2], [26, MEL_ECHO]];
    const melNotes = [];
    for (const [bar0, mel] of phrases) for (const n of mel) {
      const beat = bar0 * 3 + n[0];
      const bar = Math.floor(beat / 3);
      melNotes.push([beat, pitchAt(bar, n[1]), n[2], n[3]]);
    }
    S.sequence(ctx, leadBus, t0, { beatTime: M.beatTime, inst: INST.lead, notes: melNotes, legato: 0.9,
      humanize: { seed: 11, time: 0.008, vel: 0.05 } });
    // lead also feeds the echo + reverb sends (through a tap so the send level is fixed)
    const leadTap = ctx.createGain(); leadTap.gain.value = 0.9; leadBus.connect(leadTap); leadTap.connect(echo.input); leadTap.connect(verb.input);

    // arpeggio: 6 eighth notes per bar through chord tones, accent on the downbeat
    const ARP_VEL = [1, 0.62, 0.72, 0.85, 0.72, 0.62];
    const arpNotes = [];
    for (let bar = 0; bar < 26; bar++) {
      const c = chordTones(bar, 55);
      const pat = [c[0], c[1], c[2], c[0] + 12, c[2], c[1]];
      for (let i = 0; i < 6; i++) arpNotes.push([bar * 3 + i * 0.5, pat[i], 0.5, ARP_VEL[i] * (bar < 2 ? 0.8 : 1)]);
    }
    S.sequence(ctx, arpBus, t0, { beatTime: M.beatTime, inst: INST.arp, notes: arpNotes, legato: 0.8,
      humanize: { seed: 23, time: 0.004, vel: 0.08 } });
    const arpTap = ctx.createGain(); arpTap.gain.value = 0.5; arpBus.connect(arpTap); arpTap.connect(verb.input);

    // bass: root on beat 1 (two beats), fifth on beat 3 (short) — a soft waltz "oom-pah"
    const bassNotes = [], bassTopNotes = [];
    for (let bar = 0; bar < 28; bar++) {
      const c = chordTones(bar, 41);
      const v = bar < 2 ? 0.8 : 1;
      bassNotes.push([bar * 3, c[0], 2, v]);
      bassNotes.push([bar * 3 + 2, c[2] > c[0] + 7 ? c[2] - 12 : c[2], 1, 0.7 * v]);
      bassTopNotes.push([bar * 3, c[0] + 12, 2, v]);
    }
    S.sequence(ctx, bassBus, t0, { beatTime: M.beatTime, inst: INST.bass, notes: bassNotes, legato: 0.85 });
    S.sequence(ctx, bassBus, t0, { beatTime: M.beatTime, inst: INST.bassTop, notes: bassTopNotes, legato: 0.85 });

    // pad: open voicing (root, fifth, tenth) per bar; detunes more and more after 48 s
    const padDetune = (sec) => G.lerp(0, 13, G.span(sec, 48, 64));
    for (let bar = 0; bar < BARS; bar++) {
      const c = chordTones(bar, 55);
      const tones = [c[0], c[2], c[1] + 12];
      const tA = BAR(bar), tB = BAR(bar + 1);
      const sec = tA - t0;
      const det = padDetune(sec), detTo = padDetune(tB - t0);
      const vel = bar < 2 ? 0.6 : bar < 22 ? 0.8 : 1.0;
      tones.forEach((m, i) => {
        INST.pad(ctx, padBus, tA, m, tB - tA - 0.1, vel, { detune: det * (i === 1 ? -1 : 1), detuneTo: detTo * (i === 1 ? -1 : 1) });
      });
    }
    const padTap = ctx.createGain(); padTap.gain.value = 0.7; padBus.connect(padTap); padTap.connect(verb.input);

    // brush: soft filtered-noise taps on beats 2 and 3 (and a ghost on the "and" of 3 every other bar)
    for (let bar = 2; bar < 24; bar++) {
      const hits = [[1, 0.9], [2, 0.7]];
      if (bar % 2 === 1) hits.push([2.5, 0.4]);
      for (const [b, v] of hits) {
        const tt = BT(bar * 3 + b);
        S.noise(ctx, brushBus, { t: tt, dur: 0.035, gain: 0.045 * v, seed: 4, env: { a: 0.006, d: 0.03, s: 0.35, r: 0.045 },
          filter: { type: 'bandpass', freq: b === 1 ? 5200 : 4300, q: 1.8 }, pan: -0.25, send: verb.input });
      }
    }

    // drone fading in under the ritardando (G1 + G2) — carried by droneBus 50 -> 66 s, out at 81
    INST.droneSub(ctx, droneBus, T(50), 31, 29, 1);          // G1  (49 Hz)
    INST.droneLow(ctx, droneBus, T(50), 43, 29, 1);          // G2 triangle, lowpassed
    droneBus.connect(verbLong.input);

    // ---------------------------------------------------------- 69–81 s: late night — low pad + sparse high notes
    const lateChords = [[69.0, 75.0, [43, 50, 58]], [75.0, 80.5, [39, 46, 55]]]; // Gm (G2 D3 Bb3), Eb (Eb2 Bb2 G3)
    for (const [a, b, tones] of lateChords) for (const m of tones) INST.padDark(ctx, nightBus, T(a), m, b - a - 1.2, 1, { send: verbLong.input });
    const lateHigh = [[72.0, 86, 2.2, 0.55], [76.2, 82, 2.4, 0.5], [79.0, 79, 1.6, 0.4]];   // D6, Bb5, G5
    for (const [a, m, d, v] of lateHigh) INST.high(ctx, nightBus, T(a), m, d, v, { send: verbLong.input, pan: m === 82 ? -0.2 : 0.2 });

    // ---------------------------------------------------------- 81–101 s: morning — suspended chords, thin high tones
    const mornChords = [
      [81.0, 87.2, [55, 62, 69]],        // Gsus2  (G3 D4 A4)
      [87.0, 93.2, [48, 55, 62, 65]],    // Csus2 + F (C3 G3 D4 F4) — ambiguous
      [93.0, 98.2, [50, 57, 67]],        // Dsus4  (D3 A3 G4)
      [98.0, 104.6, [51, 58, 65]]        // Ebsus2 (Eb3 Bb3 F4)
    ];
    for (const [a, b, tones] of mornChords) for (const m of tones) INST.padSoft(ctx, nightBus, T(a), m, b - a - 1.6, 0.8, { send: verbLong.input });
    const mornHigh = [[82.6, 86, 3.0, 0.6], [88.6, 81, 3.0, 0.55], [94.4, 79, 2.6, 0.5], [99.0, 82, 2.4, 0.5]];  // D6 A5 G5 Bb5
    for (const [a, m, d, v] of mornHigh) INST.high(ctx, nightBus, T(a), m, d, v, { send: verbLong.input, pan: (m % 2 ? 0.2 : -0.2) });

    // ---------------------------------------------------------- 101–104.5 s: tension — rising tone + tremolo pad layer
    S.voice(ctx, nightBus, { t: T(101.0), dur: 3.9, freq: S.mtof(79), type: 'sine', gain: 0.09,
      env: { a: 1.6, d: 0.5, s: 1, r: 0.4 }, glide: { to: S.mtof(84), at: 0.6, dur: 3.3 },
      tremolo: { rate: 5, rateTo: 9.5, depth: 0.6, delay: 0.4 }, send: verbLong.input });
    for (const m of [58, 65]) S.voice(ctx, nightBus, { t: T(101.0), dur: 4.0, midi: m, type: 'triangle', gain: 0.05,
      env: { a: 1.2, d: 0.4, s: 1, r: 0.4 }, lowpass: { freq: 900, q: 0.3 }, tremolo: { rate: 5.5, rateTo: 10, depth: 0.7, delay: 0.3 } });

    // ---------------------------------------------------------- 111.5–121.5 s: the question — very low drone swell from 113 s
    INST.droneSub(ctx, nightBus, T(113), 31, 8.0, 0.75, { env: { a: 7.5, d: 0.5, s: 1, r: 1.8 } });            // G1
    INST.droneLow(ctx, nightBus, T(113), 43, 8.0, 0.7, { env: { a: 7.5, d: 0.5, s: 1, r: 1.8 }, send: verbLong.input }); // G2

    // ---------------------------------------------------------- 121.5–135.5 s: info screen — Gm, Eb, Cm, Dsus4 -> G major
    const infoChords = [
      [121.5, 125.5, [43, 50, 58, 67]],  // Gm   (G2 D3 Bb3 G4)
      [125.3, 128.9, [51, 58, 63, 67]],  // Eb   (Eb3 Bb3 Eb4 G4)
      [128.7, 131.1, [48, 55, 63, 67]],  // Cm   (C3 G3 Eb4 G4)
      [130.9, 132.6, [50, 57, 67]],      // Dsus4 (D3 A3 G4)
      [132.5, 136.6, [43, 50, 59, 67]]   // G major (G2 D3 B3 G4) — the slogan
    ];
    for (const [a, b, tones] of infoChords) {
      const last = b > 135;
      for (const m of tones) INST.padSoft(ctx, nightBus, T(a), m, b - a - (last ? 0.3 : 1.0), last ? 0.9 : 0.8,
        { env: { a: last ? 0.5 : 0.9, d: 0.6, s: 0.85, r: last ? 1.2 : 1.4 }, send: verbLong.input });
      for (const m of tones.slice(0, 2)) INST.padDark(ctx, nightBus, T(a), m, b - a - 1.0, 0.7, { env: { a: 0.9, d: 0.6, s: 0.85, r: 1.4 } });
    }
    // a thin high D6 bell over the slogan
    INST.high(ctx, nightBus, T(132.6), 86, 1.4, 0.45, { send: verbLong.input });
  };

  PSA.music = M;
})(window.PSA);
