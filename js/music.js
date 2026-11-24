// Original 8-bit music, written for Dadmo Bowl in the style of an old home-console football game:
// two square-wave voices (lead + harmony), a triangle bass, and noise drums, all made on the fly
// (no audio files). Every tune here is new; none is copied from another game.
//
// Song format: each channel is a string of steps (one step = an 8th note), "|" just marks bars.
//   C5, F#4, Bb3 ...  start a note      -  hold the previous note      .  rest
//   drums: k kick, s snare, h hat, o open hat, x crash, .  rest
const MUSIC = (() => {
  // ---------- the songs ----------
  const rep = (s, n) => Array(n).fill(s).join(" | ");
  const stab = n => ". " + n + " . " + n + " . " + n + " . " + n;      // off-beat chord stabs
  const oct = (r, lo, hi) => rep(r + lo + " " + r + hi, 4).replace(/ \| /g, " "); // bass: root jumping octaves

  const SONGS = {
    // TITLE: "Saturday Kickoff", a bright marching anthem in C.
    title: { bpm: 144, loop: true, ch: {
      lead: "G4 - C5 - E5 - G5 - | A5 - - G5 F5 - A5 - | G5 - - F5 D5 - B4 - | C5 - E5 - G5 - - - |" +
            " A5 - - G5 E5 - C5 - | F5 - A5 - C6 - A5 - | B5 - - A5 G5 - F5 - | D5 - G5 - B5 - D6 - |" +
            " E6 - - D6 C6 - G5 - | A5 - C6 - F6 - - - | D6 - - C6 B5 - G5 - | C6 - - - G5 - E5 - |" +
            " F5 - - E5 D5 - C5 - | A5 - - G5 F5 - E5 - | D5 - E5 - F5 - B5 - | C6 - - - - - . . ",
      harm: "E4 - - - G4 - - - | F4 - - - A4 - - - | D4 - - - F4 - - - | E4 - - - G4 - - - |" +
            " C5 - - - A4 - - - | A4 - - - C5 - - - | D5 - - - B4 - - - | B4 - - - D5 - - - |" +
            " G5 - - - E5 - - - | F5 - - - A5 - - - | G5 - - - D5 - - - | E5 - - - C5 - - - |" +
            " A4 - - - F4 - - - | C5 - - - A4 - - - | B4 - - - D5 - - - | E5 - - - - - . . ",
      bass: "C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 E3 G3 . |" +
            " A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | G2 . B2 . D3 . G2 . |" +
            " C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 . E3 . |" +
            " F2 . C3 . F2 . A2 . | F2 . C3 . F2 . C3 . | G2 . G2 . G2 . G2 . | C3 - - - - - . . ",
      drum: rep("k . s . k k s .", 7) + " | k . s . s s s s | " + rep("k . s . k k s .", 7) + " | x . . . . . . .",
    } },

    // SELECT / VERSUS: "Draft Day", a bouncy, easygoing loop in F while you pick teams.
    select: { bpm: 120, loop: true, ch: {
      lead: "F5 - . A5 C6 - A5 . | D5 - . F5 A5 - F5 . | D5 - F5 - Bb5 - A5 G5 | E5 - G5 - C6 - . . |" +
            " F5 - . A5 C6 - D6 C6 | A5 - . F5 D5 - F5 . | Bb5 - A5 - G5 - F5 - | G5 - - - E5 - C5 - ",
      harm: stab("A4") + " | " + stab("F4") + " | " + stab("F4") + " | " + stab("E4") + " | " +
            stab("A4") + " | " + stab("F4") + " | " + stab("D4") + " | " + stab("E4"),
      bass: "F2 . C3 . F2 . A2 . | D2 . A2 . D2 . F2 . | Bb2 . F2 . Bb2 . D3 . | C3 . G2 . C3 . E2 . |" +
            " F2 . C3 . F2 . A2 . | D2 . A2 . D2 . F2 . | Bb2 . F2 . Bb2 . G2 . | C3 . C3 . E3 . C3 . ",
      drum: rep("k h s h k h s h", 7) + " | k h s h s . s s",
    } },

    // GAME: "Fourth and Goal", the driving in-game loop in A minor, with a lift into C major.
    game: { bpm: 160, loop: true, ch: {
      lead: "E5 - A5 - C6 - B5 A5 | C6 - - A5 F5 - A5 - | B5 - G5 - D5 - G5 B5 | G#5 - E5 - G#5 - B5 - |" +
            " E5 - A5 - C6 - E6 - | D6 C6 A5 - F5 - A5 C6 | B5 A5 G5 - B5 - D6 - | E6 - - - B5 - G#5 - |" +
            " G5 - - E5 G5 - C6 - | B5 - - G5 D6 - B5 - | C6 - - A5 E6 - C6 - | B5 - G#5 - E5 - - - |" +
            " A5 - C6 - F6 - E6 - | D6 - B5 - G5 - D6 - | E6 - D6 - C6 - B5 - | G#5 - - - B5 - - - ",
      harm: stab("C5") + " | " + stab("A4") + " | " + stab("B4") + " | " + stab("G#4") + " | " +
            stab("C5") + " | " + stab("A4") + " | " + stab("B4") + " | " + stab("G#4") + " | " +
            stab("E5") + " | " + stab("D5") + " | " + stab("C5") + " | " + stab("B4") + " | " +
            stab("C5") + " | " + stab("B4") + " | " + stab("G#4") + " | " + stab("G#4"),
      bass: oct("A", 2, 3) + " | " + oct("F", 2, 3) + " | " + oct("G", 2, 3) + " | E2 E3 E2 E3 E2 E3 G#2 B2 | " +
            oct("A", 2, 3) + " | " + oct("F", 2, 3) + " | " + oct("G", 2, 3) + " | E2 E3 E2 E3 E2 E3 D3 B2 | " +
            oct("C", 3, 4) + " | " + oct("G", 2, 3) + " | " + oct("A", 2, 3) + " | " + oct("E", 2, 3) + " | " +
            oct("F", 2, 3) + " | " + oct("G", 2, 3) + " | " + oct("E", 2, 3) + " | E2 E3 E2 E3 G#2 G#3 B2 B3",
      drum: rep("k h s h k k s h", 7) + " | k h s h s s s s | " + rep("k h s h k k s h", 7) + " | s s s s s s x .",
    } },

    // TOUCHDOWN: a short victory jingle, then the game music picks up again.
    td: { bpm: 200, loop: false, ch: {
      lead: "C5 E5 G5 C6 - G5 C6 - | E6 - - - D6 - E6 - | G6 - - - - - - - | . . . .",
      harm: "G4 C5 E5 G5 - E5 G5 - | C6 - - - B5 - C6 - | E6 - - - - - - - | . . . .",
      bass: "C3 . C3 . C3 . C3 . | A2 . A2 . G2 . G2 . | C3 - - - - - - - | . . . .",
      drum: "k . k . k . s s | k . s . k s s s | x . . . . . . . | . . . .",
    } },

    // FINAL WHISTLE: a bigger fanfare over the final score, then quiet.
    final: { bpm: 132, loop: false, ch: {
      lead: "G5 - G5 - C6 - - - | B5 - A5 - G5 - - - | F5 - A5 - C6 - F6 - | E6 - - - D6 - - - | C6 - - - - - - - | . . . .",
      harm: "E5 - E5 - G5 - - - | G5 - F5 - E5 - - - | C5 - F5 - A5 - C6 - | C6 - - - B5 - - - | E5 - - - - - - - | . . . .",
      bass: "C3 . C3 . E3 . G3 . | G2 . G2 . C3 . E3 . | F2 . A2 . C3 . F3 . | G2 . G2 . G2 . G2 . | C3 - - - - - - - | . . . .",
      drum: "k . s . k . s . | k . s . k k s . | k . s . k . s . | s s s s s s s s | x . . . . . . . | . . . .",
    } },
  };

  // ---------- turning text into notes ----------
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) return 0;
    const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12); };
  // Each channel becomes { len, at: { step: [token, lengthInSteps] } }.
  function compile(str) {
    const toks = str.replace(/\|/g, " ").trim().split(/\s+/), at = {};
    toks.forEach((t, i) => { if (t === "-" || t === ".") return; let n = 1; while (toks[i + n] === "-") n++; at[i] = [t, n]; });
    return { len: toks.length, at };
  }
  const BUILT = {};
  for (const [k, s] of Object.entries(SONGS)) {
    const ch = {}; let len = 0;
    for (const [c, str] of Object.entries(s.ch)) { ch[c] = compile(str); len = Math.max(len, ch[c].len); }
    BUILT[k] = { bpm: s.bpm, loop: s.loop, ch, len };
  }

  // ---------- the sound chip ----------
  let ac = null, out = null, waves = null, noiseBuf = null;
  let on = true; try { on = localStorage.getItem("dadmo-music") !== "off"; } catch (e) {}
  const VOL = 0.55, DUCK = 0.3; // overall music level (sound effects stay on top), and while paused
  function setup() {
    if (out) return true;
    ac = SFX.ctx && SFX.ctx(); if (!ac) return false;
    out = ac.createGain(); out.gain.value = level(); out.connect(ac.destination);
    // Square waves with the narrow "pulse" shapes old consoles used (a 25% and a 12.5% duty cycle).
    const pulse = duty => { const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      return ac.createPeriodicWave(re, im); };
    waves = { lead: pulse(0.25), harm: pulse(0.125) };
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function voice(type, f, t, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === "tri") o.type = "triangle"; else o.setPeriodicWave(waves[type]);
    o.frequency.setValueAtTime(f, t);
    const end = t + Math.max(0.04, dur * 0.92);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    if (type !== "tri") g.gain.linearRampToValueAtTime(vol * 0.7, t + Math.min(0.25, dur * 0.6)); // a little decay, NES-style
    g.gain.setValueAtTime(type === "tri" ? vol : vol * 0.7, end - 0.015); g.gain.linearRampToValueAtTime(0, end);
    o.connect(g).connect(out); o.start(t); o.stop(end + 0.02);
  }
  function noise(t, dur, vol, hp) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function drum(k, t) {
    if (k === "k") { const o = ac.createOscillator(), g = ac.createGain(); o.type = "triangle";
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.17); }
    else if (k === "s") noise(t, 0.13, 0.22, 900);
    else if (k === "h") noise(t, 0.035, 0.07, 7000);
    else if (k === "o") noise(t, 0.16, 0.07, 6000);
    else if (k === "x") noise(t, 0.9, 0.16, 3500);
  }
  const LEVEL = { lead: 0.085, harm: 0.045, bass: 0.17 };
  function playStep(song, i, t, spb) {
    for (const [c, chan] of Object.entries(song.ch)) {
      const ev = chan.at[i % chan.len]; if (!ev) continue;
      if (c === "drum") { drum(ev[0], t); continue; }
      const f = freq(ev[0]); if (f) voice(c === "bass" ? "tri" : c, f, t, ev[1] * spb, LEVEL[c]);
    }
  }

  // ---------- the player: schedules a little ahead, so the beat stays steady ----------
  let cur = null, curName = null, back = null, step = 0, next = 0, timer = null;
  function pump() {
    if (!cur || !setup() || ac.state !== "running") return;
    const spb = 60 / cur.bpm / 2; // seconds per step (an 8th note)
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + 0.15) {
      if (step >= cur.len) {
        if (cur.loop) step = 0;
        else { const b = back; cur = null; curName = null; back = null; if (b) play(b); return; } // a jingle ends: back to the loop
      }
      playStep(cur, step, next, spb); step++; next += spb;
    }
  }
  function start(name) { cur = BUILT[name]; curName = name; step = 0; next = 0; if (!timer) timer = setInterval(pump, 25); pump(); }
  // Change the loop (does nothing if it's already playing). A jingle in progress finishes first.
  function play(name) {
    if (!name) { cur = null; curName = null; back = null; return; }
    if (cur && !cur.loop) { back = name; return; }
    if (curName === name) return;
    start(name);
  }
  // A one-shot jingle; afterwards the given loop starts again from the top.
  function jingle(name, thenLoop) { back = thenLoop || null; start(name); }
  let ducked = false;
  const level = () => on ? (ducked ? VOL * DUCK : VOL) : 0;
  function duck(d) { d = !!d; if (d === ducked) return; ducked = d; if (out) out.gain.setTargetAtTime(level(), ac.currentTime, 0.08); }
  function toggle() {
    on = !on; try { localStorage.setItem("dadmo-music", on ? "on" : "off"); } catch (e) {}
    if (out) out.gain.setTargetAtTime(level(), ac.currentTime, 0.05);
    return on;
  }
  // A hidden tab can't keep time; stop cleanly and pick the loop back up when it's visible again.
  let resumeName = null;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { resumeName = cur && cur.loop ? curName : back; cur = null; curName = null; back = null; }
    else if (resumeName) { play(resumeName); resumeName = null; }
  });
  // For previews and tests: render a song into an OfflineAudioContext (the live player is untouched).
  function renderTo(oc, name, loops) {
    const keep = { ac, out, waves, noiseBuf };
    ac = oc; out = oc.createGain(); out.gain.value = VOL; out.connect(oc.destination); waves = null; noiseBuf = null;
    const pulse = duty => { const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty); return oc.createPeriodicWave(re, im); };
    waves = { lead: pulse(0.25), harm: pulse(0.125) };
    noiseBuf = oc.createBuffer(1, oc.sampleRate, oc.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const song = BUILT[name], spb = 60 / song.bpm / 2; let t = 0.05;
    for (let l = 0; l < (loops || 1); l++) for (let i = 0; i < song.len; i++) { playStep(song, i, t, spb); t += spb; }
    ({ ac, out, waves, noiseBuf } = keep);
    return t;
  }
  const api = { play, jingle, duck, toggle, renderTo, enabled: () => on, get current() { return curName; }, SONGS: BUILT };
  return api;
})();
