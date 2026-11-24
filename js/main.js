// Ties it together: title screen, start, fixed-step game loop, back to title.
(function () {
  const canvas = document.getElementById("game");
  RENDER.init(canvas);
  const params = new URLSearchParams(location.search);
  const demo = params.has("demo");
  let mode = "title";
  // Developer mode: ?dev in the address, or hold PAUSE for 3 seconds on the title screen.
  let dev = params.has("dev"), holdStart = 0;
  function setDev(on) {
    dev = on; window.DADMO_DEV = on; PROGRESS.setDev(on); ladderLine();
    const p = document.getElementById("devpanel"); if (!p) return;
    p.hidden = !on;
    if (on && !p.dataset.ready) {
      p.dataset.ready = "1";
      const opts = TEAMS.list.map(t => `<option value="${t.id}">${t.short}</option>`).join("");
      for (const [id, def] of [["devT1", "bolts"], ["devT2", "krush"]]) { const s = document.getElementById(id); s.innerHTML = opts; s.value = def; }
    }
  }
  setTimeout(() => setDev(dev), 0);
  // ----- title screen: next unlock line, cheat code -----
  function ladderLine() {
    const el = document.getElementById("ladder"); if (!el) return;
    if (dev) { el.textContent = "DEV MODE · ALL TEAMS UNLOCKED · TEST PROGRESS IS SAVED SEPARATELY"; return; }
    const d = PROGRESS.door();
    if (!d) { el.textContent = "EVERY TEAM UNLOCKED · " + PROGRESS.data.wins + " WINS"; return; }
    const [have, need] = d.prog(PROGRESS.data, PROGRESS.data.unlocked);
    el.textContent = "NEXT TEAM: " + TEAMS.byId[d.id].name + " · " + d.goal + " · " + have + "/" + need;
  }
  setTimeout(ladderLine, 0);
  function cheatFlash(again) {
    const el = document.getElementById("cheat"); if (!el) return;
    el.textContent = again ? "THE LAWN CHAIRS ARE ALREADY HERE" : "THE LAWN CHAIRS HAVE ARRIVED";
    el.hidden = false; el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
    SFX.chime(); clearTimeout(cheatFlash.t); cheatFlash.t = setTimeout(() => { el.hidden = true; }, 3200);
    ladderLine();
  }

  // ----- team select (secret on phones) and the VERSUS slam -----
  const SEL = { slot: { 1: {}, 2: {} }, list: [], t: 0, taken: {}, level: 0, vsCpu: false };
  try { SEL.level = Math.max(0, Math.min(CFG.DIFFICULTY.length - 1, +localStorage.getItem("dadmo-level") || 0)); } catch (e) {}
  function openSelect(human, highlight) {
    document.body.classList.add("playing");
    pause.lastHuman = Object.assign({}, human);
    SEL.list = TEAMS.list.map(t => t.id); SEL.t = 0; SEL.taken = {};
    SEL.vsCpu = !human[1] !== !human[2]; // exactly one person: the difficulty level matters
    for (const s of [1, 2]) {
      const prevId = SEL.slot[s] && SEL.slot[s].lockedId;
      const start = prevId ? SEL.list.indexOf(prevId) : SEL.list.indexOf(s === 1 ? "bolts" : "krush");
      SEL.slot[s] = { human: !!human[s], idx: Math.max(0, start), locked: false, lockedId: null, phone: false, flash: 0 };
      if (highlight && s === 1) SEL.slot[s].idx = SEL.list.indexOf(highlight); // the new team, ready to play
      else if (dev) { const v = document.getElementById(s === 1 ? "devT1" : "devT2").value; if (v) SEL.slot[s].idx = SEL.list.indexOf(v); }
    }
    mode = "select";
  }
  function cpuPick(not) {
    const pool = PROGRESS.openTeams().filter(id => id !== not && id !== "legends" || PROGRESS.openTeams().length <= 1);
    return pool[Math.floor(Math.random() * pool.length)] || "krush";
  }
  function selectStep(dt) {
    SEL.t += dt;
    for (const s of [1, 2]) {
      const P = SEL.slot[s]; if (!P.human) continue;
      P.phone = !!(window.PADS && window.PADS.connected(s));
      const n = SEL.list.length;
      if (!P.locked) {
        if (INPUT.pressed(s, "right") || (!SEL.vsCpu && INPUT.pressed(s, "down"))) { P.idx = (P.idx + 1) % n; SFX.blip(); SEL.taken[s] = null; }
        if (INPUT.pressed(s, "left") || (!SEL.vsCpu && INPUT.pressed(s, "up"))) { P.idx = (P.idx + n - 1) % n; SFX.blip(); SEL.taken[s] = null; }
        // against the computer, up / down sets how tough it is (remembered for next time)
        if (SEL.vsCpu && (INPUT.pressed(s, "up") || INPUT.pressed(s, "down"))) {
          SEL.level = Math.max(0, Math.min(CFG.DIFFICULTY.length - 1, SEL.level + (INPUT.pressed(s, "up") ? 1 : -1))); SFX.blip();
          try { localStorage.setItem("dadmo-level", SEL.level); } catch (e) {}
        }
        if (INPUT.pressed(s, "z")) {
          const id = SEL.list[P.idx], o = SEL.slot[s === 1 ? 2 : 1];
          if (!PROGRESS.isUnlocked(id)) { SFX.buzz(); P.flash = SEL.t; }
          else if (o.locked && o.lockedId === id) SEL.taken[s] = id;
          else { P.locked = true; P.lockedId = id; SFX.lock(); }
        }
        if (INPUT.pressed(s, "x") && SEL.t > 0.3) { toTitle(); return; }
      } else if (INPUT.pressed(s, "x")) { P.locked = false; P.lockedId = null; }
    }
    const S1 = SEL.slot[1], S2 = SEL.slot[2];
    if ((!S1.human || S1.locked) && (!S2.human || S2.locked)) {
      const teams = { 1: S1.human ? S1.lockedId : null, 2: S2.human ? S2.lockedId : null };
      if (!teams[1]) teams[1] = cpuPick(teams[2]);
      if (!teams[2]) teams[2] = dev ? document.getElementById("devT2").value : cpuPick(teams[1]);
      teams.home = Math.random() < 0.5 ? 1 : 2; // whose stadium (and weather) this game is at
      if (SEL.vsCpu) { const cpu = S1.human ? 2 : 1; teams.boost = { 1: 0, 2: 0 }; teams.boost[cpu] = CFG.DIFFICULTY[SEL.level].boost; }
      if (!dev && PROGRESS.data.games === 0) teams.weather = "clear"; // first game ever: clear skies, easy to read
      WEATHER.setFor(teams[teams.home], teams.weather);
      VS.teams = teams; VS.t = 0; mode = "versus";
    }
  }
  const VS = { teams: null, t: 0, slammed: false };
  // Star walkouts: player 1's superstar, then player 2's, before kickoff. Z skips.
  const WALK = { i: 1, t: 0 };
  function walkoutStep(dt) {
    WALK.t += dt;
    const skip = WALK.t > 0.3 && (INPUT.pressed(1, "z") || INPUT.pressed(2, "z") || INPUT.pressed(1, "x") || INPUT.pressed(2, "x"));
    if (WALK.t > 3.2 || skip) {
      if (WALK.i === 1 && !skip) { WALK.i = 2; WALK.t = 0; SFX.roar(); return; }
      start(pause.lastHuman, VS.teams);
    }
  }
  function versusStep(dt) {
    VS.t += dt;
    if (VS.t > 0.55 && !VS.slammed) { VS.slammed = true; SFX.slam(); }
    const go = VS.t > 6 || (VS.t > 1.0 && (INPUT.pressed(1, "z") || INPUT.pressed(2, "z") || INPUT.pressed(1, "x") || INPUT.pressed(2, "x")));
    if (go) { VS.slammed = false; WALK.i = 1; WALK.t = 0; GAME.setTeams(VS.teams[1], VS.teams[2], VS.teams.home); mode = "walkout"; SFX.roar(); }
  }
  // What a phone shows while picking: the team it's on (only that phone sees it).
  function pickFor(s) {
    if (mode !== "select" || !SEL.slot[s].human) return { off: true };
    const P = SEL.slot[s], id = SEL.list[P.idx], t = TEAMS.byId[id], cd = PROGRESS.card(id);
    const o = { id, n: (P.idx + 1) + "/" + SEL.list.length, open: cd.open, locked: P.locked, taken: SEL.taken[s] === id,
      level: SEL.vsCpu ? CFG.DIFFICULTY[SEL.level].id : null };
    const lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    const ui = lum(t.color) < 0.3 ? (lum(t.trim) < 0.3 ? "#f3efe4" : t.trim) : t.color; // readable on the dark card
    if (cd.open) Object.assign(o, { name: t.name, tag: t.tag, star: t.star, color: ui, helm: t.color, trim: t.trim, tape: TEAMS.tape(id) });
    else Object.assign(o, { name: cd.next ? t.name : "???", goal: cd.goal, prog: cd.prog });
    return o;
  }
  const UNLOCK = { id: null, t: 0 };
  const DEV_ITEMS = ["DEV: 4TH & 1 AT OPP 30", "DEV: 2-MIN DRILL, DOWN 4", "DEV: GOAL LINE, 1ST & GOAL", "DEV: RED ZONE DEFENSE"];
  // Pause menu: either player can pause (PAUSE on the phone, P / Esc / Enter on the keyboard).
  const BASE_ITEMS = ["RESUME", "NEW GAME", "QUIT TO TITLE", "WEATHER: ON", "MUSIC: ON", "BACK UP PROGRESS", "RESTORE PROGRESS", "RESET PROGRESS"];
  const pauseItems = () => BASE_ITEMS.map(i => i.startsWith("WEATHER") ? "WEATHER: " + (WEATHER.enabled() ? "ON" : "OFF") : i.startsWith("MUSIC") ? "MUSIC: " + (MUSIC.enabled() ? "ON" : "OFF") : i === "RESET PROGRESS" && pause.armReset ? "RESET? PICK AGAIN TO ERASE" : i === "NEW GAME" && pause.armNew ? "NEW GAME? PICK AGAIN" : i).concat(dev ? DEV_ITEMS : []);
  let PAUSE_ITEMS = BASE_ITEMS;
  const pause = { on: false, sel: 0, by: 1, lastHuman: null, msg: "", armReset: false };

  let lastTeams = { 1: "bolts", 2: "krush" };
  function start(human, teams) {
    document.body.classList.add("playing");
    pause.lastHuman = Object.assign({}, human);
    if (teams) lastTeams = teams;
    GAME.newGame(human, lastTeams);
    mode = "game"; pause.on = false; lastPlays = 0; lastPhase = null;
    if (!demo) BROADCAST.kickoff(GAME.state);
  }
  function toTitle() {
    if (mode === "game" && GAME.state.phase !== "over") PROGRESS.onQuit(GAME.state);
    document.body.classList.remove("playing"); mode = "title"; pause.on = false; ladderLine();
  }
  let lastPlays = 0, lastPhase = null;
  const wasConn = { 1: false, 2: false }, dropped = { 1: false, 2: false };

  if (window.PADS) window.PADS.onRestore = (s, str) => {
    const ok = PROGRESS.restore(str);
    pause.msg = ok ? "PROGRESS RESTORED! (UNDO PUTS IT BACK)" : "THAT CODE DIDN'T WORK";
    return { kind: "result", ok, text: ok ? "PROGRESS RESTORED! (CHANGED YOUR MIND? RESTORE AGAIN WITH UNDO)" : "THAT CODE DIDN'T WORK. CHECK IT WAS COPIED WHOLE." };
  };
  function pauseStep() {
    for (const s of [1, 2]) {
      if (INPUT.pressed(s, "start")) { pause.on = false; return; }
      if (INPUT.pressed(s, "up") || INPUT.pressed(s, "down")) { pause.msg = ""; if (pause.armReset || pause.armNew) { pause.armReset = pause.armNew = false; PAUSE_ITEMS = pauseItems(); } }
      if (INPUT.pressed(s, "up")) pause.sel = Math.max(0, pause.sel - 1); // no wrap-around, so UP from RESUME can't land on RESET
      if (INPUT.pressed(s, "down")) pause.sel = Math.min(PAUSE_ITEMS.length - 1, pause.sel + 1);
      if (INPUT.pressed(s, "z") || INPUT.pressed(s, "x")) {
        const pick = PAUSE_ITEMS[pause.sel];
        // menu items that keep the pause screen open
        if (pick.startsWith("MUSIC")) { const m = MUSIC.toggle(); PAUSE_ITEMS = pauseItems(); musicLabel(); pause.msg = m ? "MUSIC ON" : "MUSIC OFF (PRESS M ON THE LAPTOP ANYTIME)"; return; }
        if (pick.startsWith("WEATHER")) { WEATHER.toggle(); PAUSE_ITEMS = pauseItems(); pause.msg = WEATHER.enabled() ? "WEATHER ON: " + WEATHER.label() : "WEATHER OFF: CLEAR FIELD, NORMAL FOOTING"; return; }
        // Backup and restore happen on the phone that picked them (copy into Notes / paste back in).
        // From the laptop keyboard (no phone), they fall back to a laptop dialog.
        const phone = window.PADS && window.PADS.connected(s) && !INPUT.kbHeld(s, "z") && !INPUT.kbHeld(s, "x");
        if (pick === "BACK UP PROGRESS") {
          const code = PROGRESS.code();
          if (phone) { window.PADS.sheet(s, { kind: "backup", code }); sheetOpen[s] = true; pause.msg = "BACKUP CODE SENT TO P" + s + "'S PHONE"; return; }
          window.prompt("Your Dadmo Bowl backup code. Copy it (Cmd+C) and keep it in a note:", code);
          pause.msg = "BACKUP CODE SHOWN ON THE LAPTOP"; return;
        }
        if (pick === "RESTORE PROGRESS") {
          if (phone) { window.PADS.sheet(s, { kind: "restore" }); sheetOpen[s] = true; pause.msg = "PASTE THE CODE ON P" + s + "'S PHONE"; return; }
          const str = window.prompt("Paste your Dadmo Bowl backup code (or type UNDO to bring back progress from before the last reset):");
          pause.msg = str == null ? "" : PROGRESS.restore(str) ? "PROGRESS RESTORED!" : "THAT CODE DIDN'T WORK";
          return;
        }
        if (pick === "NEW GAME") { pause.armNew = true; PAUSE_ITEMS = pauseItems(); pause.msg = "THIS ENDS THE CURRENT GAME. PICK AGAIN TO CONFIRM"; return; }
        if (pick === "RESET PROGRESS") { pause.armReset = true; PAUSE_ITEMS = pauseItems(); pause.msg = "THIS ERASES ALL UNLOCKS. PICK AGAIN TO CONFIRM"; return; }
        if (pick.startsWith("RESET?")) { PROGRESS.reset(); pause.armReset = false; SEL.level = 0; try { localStorage.removeItem("dadmo-level"); } catch (e) {} PAUSE_ITEMS = pauseItems(); pause.msg = "PROGRESS RESET · UNDO WITH RESTORE PROGRESS + 'UNDO'"; return; }
        pause.on = false;
        const D = GAME.dev;
        if (pick === "DEV: 4TH & 1 AT OPP 30") D.situation({ down: 4, togo: 1, los: 70, poss: 1 });
        else if (pick === "DEV: 2-MIN DRILL, DOWN 4") { GAME.state.score[1] = GAME.state.score[2] - 4; D.situation({ quarter: 4, clock: 120, los: 25, poss: 1 }); }
        else if (pick === "DEV: GOAL LINE, 1ST & GOAL") D.situation({ los: 97, poss: 1, togo: 3 });
        else if (pick === "DEV: RED ZONE DEFENSE") D.situation({ los: 80, poss: 2 });
        if (pick === "RESUME") for (const s of [1, 2]) if (dropped[s] && !(window.PADS && window.PADS.connected(s))) { GAME.state.human[s] = false; dropped[s] = false; } // the computer takes over until that phone presses a button
        if (pick.startsWith("NEW GAME?")) { PROGRESS.onQuit(GAME.state); openSelect(Object.assign({}, pause.lastHuman, { 2: GAME.state.human[2] || INPUT.active(2) })); } // every new game starts with team select
        else if (pick === "QUIT TO TITLE") toTitle();
        return;
      }
    }
  }

  // What each phone button does right now, for player t. Directions are from the TV's point of view
  // (offense always attacks to the right), so "right" is forward for whoever has the ball.
  function labelsFor(t) {
    const L = { x: "", z: "", up: "", down: "", left: "", right: "" };
    if (mode === "title") return Object.assign(L, { x: "START", z: "START", start: MUSIC.enabled() ? "MUSIC: ON" : "MUSIC: OFF" }); // PAUSE toggles music here
    if (mode === "select") { const P = SEL.slot[t]; if (!P.human) return L;
      return P.locked ? Object.assign(L, { x: "CHANGE" }) : Object.assign(L, { x: "BACK", z: "LOCK IN", left: "PREV", right: "NEXT" },
        SEL.vsCpu ? { up: "HARDER", down: "EASIER" } : { up: "PREV", down: "NEXT" }); }
    if (mode === "versus") return Object.assign(L, { z: "NEXT", x: "NEXT" });
    if (mode === "walkout") return Object.assign(L, { z: "SKIP", x: "SKIP" });
    if (mode === "unlock") return Object.assign(L, { z: "PLAY THEM" });
    const G = GAME.state;
    if (!G.human[t]) return L;
    const offense = t === G.poss, car = G.ball && G.ball.state === "held" ? G.ball.holder : null;
    const move = { up: "MOVE", down: "MOVE", left: "MOVE", right: "MOVE" };
    const boost = { b: G.boostAt && G.time - G.boostAt[t] < CFG.CAL.BOOST_CD ? "BOOST…" : "BOOST" }; // the defense BOOST button ("…" = dim while it recharges)
    if (pause.on) return Object.assign(L, { x: "SELECT", z: "SELECT", up: "UP", down: "DOWN" });
    if (G.mash) return G.mash.pause > 0 ? Object.assign(L, { x: "READY", z: "READY" }) : Object.assign(L, { x: "MASH!", z: "MASH!" });
    switch (G.phase) {
      case "presnap":
        if (offense) return Object.assign(L, { x: "RUN", z: "PASS", up: G.down === 4 ? (G.los >= 62 ? "FG" : "PUNT") : "" });
        return Object.assign(L, { x: "SWITCH", z: "TACKLE", stick: true, b: "BOOST…" }, move); // shown (dim) so the buttons don't jump at the snap
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
          return Object.assign(L, { x: "SWITCH", z: "JUMP", stick: true }, move, boost);
        }
        return Object.assign(L, { x: "SWITCH", z: "TACKLE", stick: true }, move, boost);
      }
    }
    return L;
  }

  // Music follows the screen: the title anthem, the team-select loop, the game loop with a jingle on every
  // touchdown and a fanfare at the final whistle. Quieter while paused.
  let musEv = 0, musOver = false, musGame = null;
  function music() {
    if (typeof MUSIC === "undefined") return;
    if (mode === "title") return MUSIC.play("title");
    if (mode === "select" || mode === "versus" || mode === "walkout") return MUSIC.play("select");
    if (mode === "unlock") return MUSIC.play(null);
    const G = GAME.state;
    if (musGame !== G) { musGame = G; musEv = G.events.length; musOver = false; }
    MUSIC.duck(pause.on);
    for (; musEv < G.events.length; musEv++) if (G.events[musEv].type === "td" && G.phase !== "over") MUSIC.jingle("td", "game");
    if (G.phase === "over") { if (!musOver) { musOver = true; MUSIC.jingle("final", null); } return; }
    MUSIC.play("game");
  }
  // Music on/off from anywhere: M on the laptop, the button on the title screen, the pause menu,
  // or PAUSE on a phone while the title screen is up.
  function musicToggle() { MUSIC.toggle(); PAUSE_ITEMS = pauseItems(); musicLabel(); }
  function musicLabel() { const b = document.getElementById("musicBtn"); if (!b) return; const on = MUSIC.enabled(); b.textContent = "MUSIC: " + (on ? "ON" : "OFF"); b.classList.toggle("off", !on); }
  addEventListener("keydown", e => { if (e.code === "KeyM") musicToggle(); });
  { const b = document.getElementById("musicBtn"); if (b) { b.addEventListener("click", e => { musicToggle(); b.blur(); }); musicLabel(); } }

  // A backup/restore sheet left open on a phone closes once the game is unpaused.
  const sheetOpen = { 1: false, 2: false };
  function step(dt) {
    INPUT.poll();
    music();
    if (!pause.on || mode !== "game") for (const s of [1, 2]) if (sheetOpen[s]) { sheetOpen[s] = false; if (window.PADS && window.PADS.sheet) window.PADS.sheet(s, { kind: "close" }); }
    if (window.PADS && window.PADS.labels) for (const s of [1, 2]) if (window.PADS.connected(s)) { const L = labelsFor(s); if (L) window.PADS.labels(s, L); }
    if (window.PADS && window.PADS.pick) for (const s of [1, 2]) if (window.PADS.connected(s)) window.PADS.pick(s, pickFor(s));
    if (mode === "title") {
      // hold PAUSE for 3 seconds to flip developer mode
      if (INPUT.kbHeld(1, "start")) { holdStart += dt; if (holdStart > 3 && holdStart - dt <= 3) setDev(!dev); } else holdStart = 0;
      for (const s of [1, 2]) {
        if (INPUT.pressed(s, "start") && !INPUT.kbHeld(s, "start")) musicToggle(); // phone PAUSE on the title: music on/off (laptop P stays for developer mode)
        for (const k of ["up", "down", "left", "right"]) if (INPUT.pressed(s, k)) { const r = PROGRESS.cheatKey(k); if (r) cheatFlash(r === "again"); }
        if (INPUT.pressed(s, "z") || INPUT.pressed(s, "x")) {
          const human = { 1: true, 2: INPUT.active(2) };
          return openSelect(human); // developer mode too: every team is open there, so any team can be tested
        }
      }
      if (demo) { const a = cpuPick(null); start({ 1: false, 2: false }, { 1: a, 2: cpuPick(a) }); }
      return;
    }
    if (mode === "select") return selectStep(dt);
    if (mode === "versus") return versusStep(dt);
    if (mode === "walkout") return walkoutStep(dt);
    if (mode === "unlock") { UNLOCK.t += dt; if (UNLOCK.t > 1.6 && (INPUT.pressed(1, "z") || INPUT.pressed(2, "z"))) { const id = UNLOCK.id; UNLOCK.id = null; openSelect(Object.assign({}, pause.lastHuman, { 2: GAME.state.human[2] || INPUT.active(2) }), id); } return; }
    const G = GAME.state;
    if (pause.on) return pauseStep();
    if (!demo && G.phase !== "over" && (INPUT.pressed(1, "start") || INPUT.pressed(2, "start"))) { pause.on = true; pause.sel = 0; pause.msg = ""; pause.armReset = false; pause.armNew = false; PAUSE_ITEMS = pauseItems(); return; }
    // Player 2 can take over from the computer mid-game only by connecting a phone.
    // A phone takes over a computer-run team only once someone presses a button on it (a phone that just
    // rejoins in a pocket shouldn't freeze the computer's team).
    for (const s of [1, 2]) if (!demo && !G.human[s] && window.PADS && window.PADS.connected(s) && INPUT.anyPressed(s)) { G.human[s] = true; dropped[s] = false; }
    // A player's phone dropped mid-game (locked, a text, out of range): pause until it's back.
    for (const s of [1, 2]) {
      const on = !!(window.PADS && window.PADS.connected(s));
      if (!demo && G.human[s] && wasConn[s] && !on && G.phase !== "over") {
        dropped[s] = true; pause.on = true; pause.sel = 0; pause.armReset = false; pause.armNew = false; PAUSE_ITEMS = pauseItems();
        pause.msg = "P" + s + " PHONE DROPPED · REOPEN IT, OR RESUME: CPU PLAYS";
      }
      wasConn[s] = on;
    }
    if (pause.on) return;
    const wasOver = G.phase === "over";
    GAME.update(dt);
    // Broadcast graphics: a milestone check after each play; off the screen once the ball is snapped.
    BROADCAST.update(G, dt);
    if (G.phase === "dead" && lastPhase === "live") BROADCAST.afterPlay(G);
    if (G.phase === "live" && G.lower && G.lower.t > 2.2) G.lower = null; // always readable for at least ~2 seconds
    lastPhase = G.phase;
    if (!demo && G.plays !== lastPlays) { lastPlays = G.plays; PROGRESS.onPlay(G); }
    if (!demo && !wasOver && G.phase === "over") {
      if (G.human[1] || G.human[2]) BROADCAST.record(G); // first, so the after-game backup includes it
      UNLOCK.id = PROGRESS.onGameOver(G); UNLOCK.t = 0;
    }
    if (!wasOver && G.phase === "over") BROADCAST.final(G);
    if (G.phase === "over" && G.overT > 2.5) {
      if (demo) { if (G.overT > 6) start({ 1: false, 2: false }); }
      else if (INPUT.pressed(1, "z") || INPUT.pressed(2, "z")) {
        if (UNLOCK.id) { mode = "unlock"; UNLOCK.t = 0; SFX.fanfare(); } else openSelect(Object.assign({}, pause.lastHuman, { 2: GAME.state.human[2] || INPUT.active(2) }));
      }
    }
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    paint(now);
    requestAnimationFrame(frame);
  }
  function paint(now) {
    if (mode === "game") { RENDER.draw(GAME.state, now / 1000); if (pause.on) RENDER.pauseMenu(PAUSE_ITEMS, pause.sel, now / 1000, pause.msg); }
    else if (mode === "select") SCREENS.select(SEL, now / 1000);
    else if (mode === "versus") SCREENS.versus(VS.teams, VS.t);
    else if (mode === "walkout") SCREENS.walkout(VS.teams[WALK.i], WALK.i, WALK.t);
    else if (mode === "unlock") SCREENS.challenger(UNLOCK.id, UNLOCK.t);
  }
  // For tests: run n frames by hand (the browser pauses animation when the window is hidden).
  let fakeNow = 0;
  function tick(n) { for (let i = 0; i < (n || 1); i++) { step(1 / 60); fakeNow += 1000 / 60; } paint(performance.now()); }
  const go = () => requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').then(go, go); else go();

  // Keep the laptop screen on: phones don't count as "using the computer", so without this the screen
  // dims and sleeps mid-game. Asked for at load and again on any key/click (some browsers need one),
  // and again whenever the page comes back into view (the lock drops when the tab is hidden).
  let wakeLock = null;
  async function stayAwake() {
    if (wakeLock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } catch (e) {}
  }
  stayAwake();
  addEventListener("keydown", stayAwake); addEventListener("pointerdown", stayAwake);
  document.addEventListener("visibilitychange", stayAwake);
  setInterval(stayAwake, 30000); // re-ask if the system dropped it (e.g. after the lid was closed)

  window.DADMO = { tick, start, toTitle, pause, openSelect, SEL, VS, UNLOCK, get mode() { return mode; } };
})();
