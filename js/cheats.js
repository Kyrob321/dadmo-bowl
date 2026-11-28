// Cheat codes, old-school: type a code with the D-pad (phone or arrow keys) on the title screen to unlock it.
// Every cheat then shows up in the CHEATS menu (pause menu, or the CHEATS button on the title screen), where it
// can be switched on and off. Locked ones are just a padlock there: the codes live in the printed cheat book.
// Unlocks and on/off are saved with the rest of the progress (so RESET PROGRESS locks them again).
const CHEATS = (() => {
  const U = "up", D = "down", L = "left", R = "right";
  // kind: team (unlocks a team), toggle (on/off), pick (cycles through choices)
  const LIST = [
    { id: "lawnchairs", name: "THE LAWN CHAIRS", kind: "team", code: [L, R, R, U, U, D, D, D, D, D], what: "A SECRET TEAM" },
    { id: "weather", name: "WEATHER MACHINE", kind: "pick", code: [D, D, D, U, U, U, L, R], what: "PICK THE WEATHER",
      choices: ["AUTO", "snow", "rain", "wind", "fog", "night", "sunset", "neon", "crt", "clear"], start: "snow" },
    { id: "ball", name: "BALL SHOP", kind: "pick", code: [U, R, D, L, U, R, D, L], what: "PICK A NEW FOOTBALL",
      choices: ["AUTO", "fire", "gold", "ornament"], start: "fire",
      labels: { AUTO: "REGULAR", fire: "FLAMING", gold: "GOLDEN", ornament: "ORNAMENT" } },
    { id: "field", name: "FIELD SWAP", kind: "pick", code: [L, R, L, R, D, U, D, U], what: "PLAY ON A DIFFERENT FIELD",
      choices: ["AUTO", "backyard", "christmas", "chalk", "pond"], start: "backyard",
      labels: { AUTO: "STADIUM GRASS", backyard: "BACKYARD", christmas: "CHRISTMAS", chalk: "CHALKBOARD", pond: "FROZEN POND" } },
    { id: "bighead", name: "BIG HEADS", kind: "toggle", code: [U, U, L, L, R, R, U, U], what: "EVERYONE'S HELMET IS HUGE" },
    { id: "giants", name: "GIANT SUPERSTARS", kind: "toggle", code: [U, D, U, D, U, U, U, U], what: "STARS PLAY TWICE AS TALL" },
    { id: "retro", name: "RETRO GREEN", kind: "toggle", code: [L, L, L, L, R, R, R, R], what: "AN OLD GREEN HANDHELD SCREEN" },
    { id: "fire", name: "ALWAYS ON FIRE", kind: "toggle", code: [R, R, R, R, U, D, U, D], what: "YOUR WHOLE TEAM STARTS ON FIRE" },
    { id: "boost", name: "UNLIMITED BOOST", kind: "toggle", code: [R, U, R, U, R, U, R, U], what: "NO RECHARGE ON DEFENSE BOOST" },
    { id: "toe", name: "GOLDEN TOE", kind: "toggle", code: [D, R, D, R, D, R, U, U], what: "YOUR KICK NEEDLE MOVES AT HALF SPEED" },
    { id: "speed", name: "SUPER SPEED", kind: "toggle", code: [R, D, R, D, R, D, R, R], what: "YOUR PLAYERS RUN 12% FASTER" },
  ];
  const byId = {}; for (const c of LIST) byId[c.id] = c;
  const ARROW = { up: "↑", down: "↓", left: "←", right: "→" };

  const data = () => PROGRESS.data;
  const dev = () => !!window.DADMO_DEV;
  function unlocked(id) {
    if (id === "lawnchairs") return PROGRESS.isUnlocked("lawnchairs");
    return dev() || !!(data().cheats && data().cheats[id]);
  }
  function value(id) {
    const c = byId[id]; if (!c || !unlocked(id)) return c && c.kind === "pick" ? "AUTO" : false;
    const v = data().cheatOn && data().cheatOn[id];
    if (c.kind === "pick") return c.choices.includes(v) ? v : "AUTO";
    return !!v;
  }
  // The question the game asks: is this cheat on right now?
  const on = id => value(id) === true;

  function set(id, v) {
    const d = data(); d.cheatOn = d.cheatOn || {}; d.cheatOn[id] = v; PROGRESS.save(); apply();
    if (id === "weather") weatherOn(v);
  }
  // Things that live outside the game state: the weather choice and the green screen.
  function apply() {
    const w = value("weather");
    if (typeof WEATHER !== "undefined" && !(typeof TUTORIAL !== "undefined" && TUTORIAL.halves.length)) {
      WEATHER.force(w === "AUTO" ? null : w);
      if (w === "AUTO" && typeof GAME !== "undefined" && GAME.state.home) WEATHER.setFor(CFG.TEAMS[GAME.state.home].id); // back to the home stadium's
    }
    const cv = document.getElementById("game");
    if (cv) cv.classList.toggle("retro", on("retro"));
  }

  // Picking a weather means wanting to see it (only when the pick changes, so WEATHER: OFF in the pause menu sticks).
  function weatherOn(v) { if (v !== "AUTO" && typeof WEATHER !== "undefined" && !WEATHER.enabled()) WEATHER.toggle(); }

  // ----- typing codes on the title screen -----
  let buf = [];
  const MAX = Math.max(...LIST.map(c => c.code.length));
  // Returns null, or { cheat, fresh } when a code was just completed.
  function key(dir) {
    buf.push(dir); if (buf.length > MAX) buf.shift();
    for (const c of LIST) {
      if (buf.length < c.code.length || buf.slice(-c.code.length).join() !== c.code.join()) continue;
      buf = [];
      if (c.id === "lawnchairs") { const r = PROGRESS.cheatKeyUnlock(); return { cheat: c, fresh: r }; }
      const d = data(), fresh = !(d.cheats && d.cheats[c.id]);
      d.cheats = d.cheats || {}; d.cheats[c.id] = true;
      if (fresh) { d.cheatOn = d.cheatOn || {}; d.cheatOn[c.id] = c.kind === "pick" ? c.start : true; } // a new cheat starts switched on
      PROGRESS.save(); apply();
      if (fresh && c.id === "weather") weatherOn(c.start);
      return { cheat: c, fresh };
    }
    return null;
  }

  // ----- the CHEATS menu -----
  const M = { sel: 0, t: 0, msg: "" };
  function open() { M.sel = 0; M.t = 0; M.msg = ""; }
  const count = () => LIST.filter(c => unlocked(c.id)).length;
  // Returns true when the menu should close.
  function step(dt) {
    M.t += dt;
    for (const s of [1, 2]) {
      if (INPUT.pressed(s, "start") || (M.t > 0.2 && INPUT.pressed(s, "x"))) return true;
      if (INPUT.pressed(s, "up")) { M.sel = (M.sel + LIST.length - 1) % LIST.length; M.msg = ""; }
      if (INPUT.pressed(s, "down")) { M.sel = (M.sel + 1) % LIST.length; M.msg = ""; }
      if (M.t > 0.2 && INPUT.pressed(s, "z")) {
        const c = LIST[M.sel];
        if (!unlocked(c.id)) { M.msg = "LOCKED · FIND ITS CODE IN THE CHEAT BOOK"; SFX.buzz && SFX.buzz(); continue; }
        if (c.kind === "team") { M.msg = "THE LAWN CHAIRS ARE ON THE TEAM SELECT SCREEN"; continue; }
        if (c.kind === "pick") { const i = c.choices.indexOf(value(c.id)); set(c.id, c.choices[(i + 1) % c.choices.length]); }
        else set(c.id, !value(c.id));
        SFX.blip && SFX.blip();
        M.msg = "";
      }
    }
    return false;
  }
  const label = c => {
    if (c.kind === "team") return "ON THE TEAM LIST";
    if (c.kind === "pick") { const v = value(c.id); return c.labels ? c.labels[v] : v === "AUTO" ? "AUTO (HOME STADIUM)" : WEATHER.KINDS[v].label; }
    return value(c.id) ? "ON" : "OFF";
  };
  function lock(c2, x, y, col) { // a chunky padlock, 14 x 16
    c2.fillStyle = col;
    c2.fillRect(x + 3, y, 8, 2); c2.fillRect(x + 1, y + 2, 3, 5); c2.fillRect(x + 10, y + 2, 3, 5); // shackle
    c2.fillRect(x, y + 6, 14, 10);                                                                     // body
    c2.fillStyle = "#0b1224"; c2.fillRect(x + 6, y + 9, 2, 4); c2.fillRect(x + 5, y + 9, 4, 2);        // keyhole
  }
  function draw(time) {
    const c2 = RENDER.ctx(), VW = RENDER.VW, VH = RENDER.VH; if (!c2) return;
    c2.fillStyle = "rgba(4,7,14,.94)"; c2.fillRect(0, 0, VW, VH);
    c2.fillStyle = "#c8223a"; c2.fillRect(0, 0, VW, 3); c2.fillStyle = "#ffb627"; c2.fillRect(0, 3, VW, 2);
    RENDER.text("CHEATS", VW / 2, 12, "#ffe14a", 16, "center");
    RENDER.text(count() + "/" + LIST.length + " FOUND", VW - 14, 16, "#9fb1c5", 8, "right");
    const top = 38, rowH = 18;
    LIST.forEach((c, i) => {
      const y = top + i * rowH, sel = i === M.sel, open = unlocked(c.id);
      if (sel) { c2.fillStyle = "rgba(255,225,74,.14)"; c2.fillRect(24, y - 4, VW - 48, rowH - 1); }
      if (sel) RENDER.text(Math.floor(time * 3) % 2 ? "▶" : " ", 30, y, "#ffe14a", 8);
      if (!open) { lock(c2, 50, y - 4, sel ? "#ffe14a" : "#55627a"); return; }
      RENDER.text(c.name, 50, y, sel ? "#ffe14a" : "#f3efe4", 8);
      const v = label(c), lit = c.kind === "team" || (c.kind === "pick" ? value(c.id) !== "AUTO" : value(c.id));
      RENDER.text(v, VW - 34, y, lit ? "#7fd68f" : "#9fb1c5", 8, "right");
    });
    const c = LIST[M.sel];
    const foot = M.msg || (unlocked(c.id) ? c.what : "LOCKED: TYPE ITS CODE ON THE TITLE SCREEN");
    RENDER.text(foot, VW / 2, VH - 30, M.msg ? "#ffb627" : "#9fb1c5", 8, "center");
    RENDER.text("Z: SWITCH   X: BACK", VW / 2, VH - 16, "#ffe14a", 8, "center");
  }
  const labels = () => ({ x: "BACK", z: "SWITCH", up: "UP", down: "DOWN", left: "", right: "" });

  return { LIST, byId, ARROW, unlocked, value, on, set, apply, key, open, step, draw, labels, count, M };
})();
