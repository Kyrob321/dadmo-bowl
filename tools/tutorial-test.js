// Tutorial test helpers (inject into the page in ?dev mode). Drives the drills with virtual input.
window.T = {
  v: INPUT.virt,
  press(k, s = 1) { this.v[s][k] = true; DADMO.tick(1); this.v[s][k] = false; DADMO.tick(1); },
  wait(n) { DADMO.tick(n); },
  until(f, max = 1200) { let n = 0; while (!f() && n < max) { DADMO.tick(1); n++; } return n; },
  H(i = 0) { return TUTORIAL.halves[i]; },
  // fresh tutorial, jumped ahead to drill d (0-based)
  at(d, human = { 1: true, 2: false }) {
    TUTORIAL.stop(); DADMO.startTutorial(human);
    for (let i = 0; i < d; i++) for (const s of [1, 2]) if (human[s]) TUTORIAL.skipDrill(s);
    DADMO.tick(20);
    return TUTORIAL.halves;
  },
  // answer whatever Coach Kyle is waiting on with key k (after the short guard)
  answer(H, k, s) { T.until(() => H.await, 600); DADMO.tick(16); T.press(k, s || H.s); },
  // steer player s's defender at the runner; press tackle at the ideal moment + off seconds
  tackle(H, off = 0) {
    const G = H.G, v = T.v[H.s]; let pressed = false, r = null, n = 0;
    while (H.sub === "chase" && n < 900) {
      const me = G.control[H.s], run = G.players.find(p => p.team === H.o);
      if (me && run && !G.rep) { const dx = run.x + 1.5 - me.x, dy = run.y - me.y, l = Math.hypot(dx, dy) || 1; v.ax = dx / l; v.ay = dy / l; } else { v.ax = 0; v.ay = 0; }
      if (G.rep && !pressed && G.play.t >= G.rep.ideal + off) { r = G.rep; v.z = true; pressed = true; } else v.z = false;
      DADMO.tick(1); n++;
    }
    v.ax = 0; v.ay = 0; v.z = false;
    return r && r.defFb && r.defFb[0];
  },
  // jump drill: steer under the throw, jump at the ideal moment + off
  jump(H, off = 0) {
    const G = H.G, v = T.v[H.s], b = H.ball; let n = 0, pressed = false;
    while (H.sub === "air" && n < 600) {
      const me = G.control[H.s];
      if (me && b.state === "air") { const dx = b.tx - me.x, dy = b.ty - me.y, l = Math.hypot(dx, dy); if (l > 0.4) { v.ax = dx / l; v.ay = dy / l; } else { v.ax = 0; v.ay = 0; } }
      if (!pressed && b.state === "air" && b.t >= b.ideal + off && Math.hypot(me.x - b.tx, me.y - b.ty) < CFG.CAL.JUMP_RANGE) { v.z = true; pressed = true; } else v.z = false;
      DADMO.tick(1); n++;
    }
    v.ax = 0; v.ay = 0; v.z = false;
    return b.defFb && b.defFb[0];
  },
  // kick: press when the needle is within tol of the middle
  kick(H, tol = 0.03) {
    const G = H.G; let n = 0;
    while (G.phase === "kick" && n < 600) {
      if (G.kick.t > 0.4 && Math.abs(G.kick.needle - 0.5) < tol) { T.press("z", H.s); break; }
      DADMO.tick(1); n++;
    }
  },
};
"T ready";
