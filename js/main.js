// Ties it together: title screen, start, fixed-step game loop, back to title.
(function () {
  const canvas = document.getElementById("game");
  RENDER.init(canvas);
  const params = new URLSearchParams(location.search);
  const demo = params.has("demo");
  let mode = "title";

  function start(human) {
    document.body.classList.add("playing");
    GAME.newGame(human);
    mode = "game";
  }
  function toTitle() { document.body.classList.remove("playing"); mode = "title"; }

  function step(dt) {
    INPUT.poll();
    if (mode === "title") {
      for (const s of [1, 2]) {
        if (INPUT.pressed(s, "z") || INPUT.pressed(s, "x")) return start({ 1: true, 2: INPUT.active(2) });
      }
      if (demo) start({ 1: false, 2: false });
      return;
    }
    const G = GAME.state;
    if (!demo && !G.human[2] && INPUT.active(2)) G.human[2] = true; // Player 2 joins mid-game
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
    if (mode === "game") RENDER.draw(GAME.state, now / 1000);
    requestAnimationFrame(frame);
  }
  const go = () => requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').then(go, go); else go();

  window.DADMO = { start, toTitle };
})();
