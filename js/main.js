// Ties it together: title screen, start, fixed-step game loop, back to title.
(function () {
  const canvas = document.getElementById("game");
  RENDER.init(canvas);
  const params = new URLSearchParams(location.search);
  const demo = params.has("demo");
  let mode = "title";
  // Pause menu: either player can pause (PAUSE on the phone, P / Esc / Enter on the keyboard).
  const PAUSE_ITEMS = ["RESUME", "RESTART GAME", "QUIT TO TITLE"];
  const pause = { on: false, sel: 0, by: 1, lastHuman: null };

  function start(human) {
    document.body.classList.add("playing");
    pause.lastHuman = Object.assign({}, human);
    GAME.newGame(human);
    mode = "game"; pause.on = false;
  }
  function toTitle() { document.body.classList.remove("playing"); mode = "title"; pause.on = false; }

  function pauseStep() {
    for (const s of [1, 2]) {
      if (INPUT.pressed(s, "start")) { pause.on = false; return; }
      if (INPUT.pressed(s, "up")) pause.sel = (pause.sel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
      if (INPUT.pressed(s, "down")) pause.sel = (pause.sel + 1) % PAUSE_ITEMS.length;
      if (INPUT.pressed(s, "z") || INPUT.pressed(s, "x")) {
        const pick = PAUSE_ITEMS[pause.sel]; pause.on = false;
        if (pick === "RESTART GAME") start(Object.assign({}, pause.lastHuman, { 2: GAME.state.human[2] }));
        else if (pick === "QUIT TO TITLE") toTitle();
        return;
      }
    }
  }

  // What each phone button does right now, for player t. Directions are from the TV's point of view
  // (offense always attacks to the right), so "right" is forward for whoever has the ball.
  function labelsFor(t) {
    const L = { x: "", z: "", up: "", down: "", left: "", right: "" };
    if (mode === "title") return Object.assign(L, { x: "START", z: "START" });
    const G = GAME.state;
    if (!G.human[t]) return L;
    const offense = t === G.poss, car = G.ball && G.ball.state === "held" ? G.ball.holder : null;
    const move = { up: "MOVE", down: "MOVE", left: "MOVE", right: "MOVE" };
    if (pause.on) return Object.assign(L, { x: "SELECT", z: "SELECT", up: "UP", down: "DOWN" });
    if (G.mash) return G.mash.pause > 0 ? Object.assign(L, { x: "READY", z: "READY" }) : Object.assign(L, { x: "MASH!", z: "MASH!" });
    switch (G.phase) {
      case "presnap":
        if (offense) return Object.assign(L, { x: "RUN", z: "PASS", up: G.down === 4 ? (G.los >= 62 ? "FG" : "PUNT") : "" });
        return Object.assign(L, { x: "SWITCH", z: "TACKLE", stick: true }, move);
      case "dead": case "flight": return null; // keep whatever the phone shows between plays
      case "kick": return G.kick.team === t ? Object.assign(L, { x: "KICK", z: "KICK" }) : L;
      case "over": return G.overT > 2.5 ? Object.assign(L, { z: "NEW GAME" }) : L;
      case "live": {
        const pl = G.play;
        if (car && car.team === t) {
          if (car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed) return Object.assign(L, { x: "NEXT", z: "THROW" }, move);
          const fwd = car.team === G.poss ? "right" : "left", back = fwd === "right" ? "left" : "right";
          return Object.assign(L, { z: "BURST", up: "JUKE", down: "JUKE", [fwd]: "TRUCK", [back]: "STIFF" });
        }
        if (G.ball.state === "air") {
          if (G.ball.intended && G.ball.intended.team === t) return Object.assign(L, { z: "CATCH" });
          return Object.assign(L, { x: "SWITCH", z: "JUMP", stick: true }, move);
        }
        return Object.assign(L, { x: "SWITCH", z: "TACKLE", stick: true }, move);
      }
    }
    return L;
  }

  function step(dt) {
    INPUT.poll();
    if (window.PADS && window.PADS.labels) for (const s of [1, 2]) if (window.PADS.connected(s)) { const L = labelsFor(s); if (L) window.PADS.labels(s, L); }
    if (mode === "title") {
      for (const s of [1, 2]) {
        if (INPUT.pressed(s, "z") || INPUT.pressed(s, "x")) return start({ 1: true, 2: INPUT.active(2) });
      }
      if (demo) start({ 1: false, 2: false });
      return;
    }
    const G = GAME.state;
    if (pause.on) return pauseStep();
    if (!demo && (INPUT.pressed(1, "start") || INPUT.pressed(2, "start"))) { pause.on = true; pause.sel = 0; return; }
    // Player 2 can take over from the computer mid-game only by connecting a phone.
    if (!demo && !G.human[2] && window.PADS && window.PADS.connected(2)) G.human[2] = true;
    GAME.update(dt);
    if (G.phase === "over" && G.overT > 2.5) {
      if (demo) { if (G.overT > 6) start({ 1: false, 2: false }); }
      else if (INPUT.pressed(1, "z") || INPUT.pressed(2, "z")) toTitle();
    }
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    if (mode === "game") { RENDER.draw(GAME.state, now / 1000); if (pause.on) RENDER.pauseMenu(PAUSE_ITEMS, pause.sel, now / 1000); }
    requestAnimationFrame(frame);
  }
  const go = () => requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').then(go, go); else go();

  window.DADMO = { start, toTitle, pause };
})();
