// Merges keyboard, phone pads and test input into one simple state per player.
// Player 1 keyboard: arrows + Z / X.  Player 2 keyboard: W A S D + G (Z) / F (X).
const INPUT = (() => {
  const KEYS = ["up", "down", "left", "right", "x", "z", "start"];
  const MAP = {
    ArrowUp: [1, "up"], ArrowDown: [1, "down"], ArrowLeft: [1, "left"], ArrowRight: [1, "right"], KeyZ: [1, "z"], KeyX: [1, "x"],
    Escape: [1, "start"], KeyP: [1, "start"], Enter: [1, "start"],
    KeyW: [2, "up"], KeyS: [2, "down"], KeyA: [2, "left"], KeyD: [2, "right"], KeyG: [2, "z"], KeyF: [2, "x"],
  };
  const kb = { 1: {}, 2: {} };
  const virt = { 1: {}, 2: {} };
  const used = { 1: false, 2: false };
  let cur = { 1: {}, 2: {} }, prev = { 1: {}, 2: {} };
  // Phone press counters: a tap the TV never saw "down" (too quick, or a lost message) still counts once.
  const lastC = { 1: {}, 2: {} }, tap = { 1: {}, 2: {} };

  addEventListener("keydown", e => {
    const m = MAP[e.code]; if (!m) return;
    e.preventDefault(); kb[m[0]][m[1]] = true;
    if (m[1] === "x" || m[1] === "z") used[m[0]] = true; // only a button press (not a stray direction key) counts as joining
  });
  addEventListener("keyup", e => { const m = MAP[e.code]; if (m) kb[m[0]][m[1]] = false; });
  addEventListener("blur", () => { kb[1] = {}; kb[2] = {}; });

  function poll() {
    prev = cur; cur = { 1: {}, 2: {} };
    for (const s of [1, 2]) {
      const pad = (window.PADS && window.PADS.inputs[s]) || {};
      for (const k of KEYS) cur[s][k] = !!(kb[s][k] || pad[k] || virt[s][k]);
      tap[s] = {};
      if (!(window.PADS && window.PADS.connected(s))) lastC[s] = {}; // a phone that comes back starts fresh: no replayed presses
      if (pad.c) for (const k of KEYS) {
        const n = pad.c[k] || 0, was = lastC[s][k];
        if (was != null && n > was && !(cur[s][k] && !prev[s][k])) tap[s][k] = true;
        lastC[s][k] = n;
      }
      const ax = pad.ax || virt[s].ax || 0, ay = pad.ay || virt[s].ay || 0;
      cur[s].ax = ax; cur[s].ay = ay;
    }
  }

  return {
    poll,
    held: (s, k) => !!cur[s][k],
    kbHeld: (s, k) => !!kb[s][k], // the laptop keyboard only (developer shortcuts)
    pressed: (s, k) => (!!cur[s][k] && !prev[s][k]) || !!tap[s][k],
    anyPressed: s => KEYS.some(k => (cur[s][k] && !prev[s][k]) || tap[s][k]),
    dir(s) {
      // Phone joystick: analog direction, and a light push means a slower step.
      const ax = cur[s].ax || 0, ay = cur[s].ay || 0, m = Math.hypot(ax, ay);
      if (m > 0.15) { const k = Math.min(1, m) / m; return { dx: ax * k, dy: ay * k, any: true }; }
      const dx = (cur[s].right ? 1 : 0) - (cur[s].left ? 1 : 0);
      const dy = (cur[s].down ? 1 : 0) - (cur[s].up ? 1 : 0);
      const l = Math.hypot(dx, dy) || 1;
      return { dx: dx / l, dy: dy / l, any: !!(dx || dy) };
    },
    active: s => used[s] || !!(window.PADS && window.PADS.connected(s)),
    virt,
  };
})();
