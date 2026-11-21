// Tiny original sound effects made on the fly (no audio files). The browser only allows sound after
// someone presses a key or clicks on the laptop, so phone-only sessions may stay quiet until then.
const SFX = (() => {
  let ac = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }
  addEventListener("keydown", ctx, { once: false }); addEventListener("pointerdown", ctx);
  function tone(freq, t0, dur, type, vol, slide) {
    const a = ctx(); if (!a || a.state !== "running") return;
    const o = a.createOscillator(), g = a.createGain(), s = a.currentTime + t0;
    o.type = type || "square"; o.frequency.setValueAtTime(freq, s);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, s + dur);
    g.gain.setValueAtTime(vol || 0.08, s); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g).connect(a.destination); o.start(s); o.stop(s + dur + 0.02);
  }
  function noise(t0, dur, vol) {
    const a = ctx(); if (!a || a.state !== "running") return;
    const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), g = a.createGain(); src.buffer = b; g.gain.value = vol || 0.15;
    src.connect(g).connect(a.destination); src.start(a.currentTime + t0);
  }
  return {
    // bright four-note chime: cheat code, unlocks
    chime() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, "square", 0.06)); tone(1568, 0.36, 0.5, "triangle", 0.05); },
    // helmets crashing together
    slam() { noise(0, 0.25, 0.25); tone(110, 0, 0.3, "square", 0.12, 40); },
    buzz() { tone(90, 0, 0.18, "sawtooth", 0.07); },
    roar() { noise(0, 1.2, 0.08); noise(0.2, 1.0, 0.06); },
    blip() { tone(880, 0, 0.05, "square", 0.04); },
    lock() { tone(660, 0, 0.08, "square", 0.06); tone(990, 0.07, 0.12, "square", 0.06); },
    fanfare() { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, "square", 0.06)); },
  };
})();
