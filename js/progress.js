// Unlock progress: which teams are open, the ladder of goals, and saving it on this laptop.
// Saved in the browser's storage after every play and every game, so the laptop sleeping, a reload
// or a restart loses nothing. Developer mode keeps its own separate copy and never touches the real one.
const PROGRESS = (() => {
  const KEY = "dadmo-progress-v1", DEV_KEY = "dadmo-dev-progress-v1";
  const START = ["krush", "anvils", "gators", "comets", "bolts"]; // the Bolts move to "finish the tutorial" once it exists
  const CHEAT = ["left", "right", "right", "up", "up", "down", "down", "down", "down", "down"]; // 1-2-2-5: Christmas
  // One door at a time, in this order. Only the next locked team can unlock, at most one per game.
  // Totals (wins, takeaways) count in the background the whole time.
  const LADDER = [
    { id: "yetis", goal: "FINISH YOUR FIRST FULL GAME", prog: s => [Math.min(s.games, 1), 1], done: (s) => s.games >= 1 },
    { id: "rattlers", goal: "SCORE 3 TOUCHDOWNS IN ONE GAME", prog: s => [Math.min(s.bestTds, 3), 3], done: (s, g) => g.tds >= 3 },
    { id: "krakens", goal: "5 TAKEAWAYS (ALL GAMES)", prog: s => [Math.min(s.takeaways, 5), 5], done: s => s.takeaways >= 5 },
    { id: "twisters", goal: "WIN 3 GAMES (ALL GAMES)", prog: s => [Math.min(s.wins, 3), 3], done: s => s.wins >= 3 },
    { id: "vipers", goal: "THROW A 40+ YARD PASS AND WIN THE SAME GAME", prog: s => [s.bestLongWin ? 1 : 0, 1], done: (s, g) => g.long40Win },
    { id: "legends", goal: "UNLOCK ALL 11 TEAMS (ONE IS A SECRET), WIN 8 GAMES, THEN BEAT THE COMPUTER BY 14+",
      prog: (s, u) => [Math.min(u.length, 11) + Math.min(s.wins, 8), 19],
      done: (s, g, u) => u.filter(id => id !== "legends").length >= 11 && s.wins >= 8 && g.cpuMargin >= 14 },
  ];
  const HINT = { lawnchairs: "WHEN DO PRESENTS GET OPENED?" };
  let dev = false, data = load(KEY);
  // If the main save is ever unreadable, fall back to the copy made after the last finished game.
  try { if (localStorage.getItem(KEY) && !JSON.parse(localStorage.getItem(KEY)).unlocked) data = load(KEY + "-backup"); } catch (e) { data = load(KEY + "-backup"); }

  function fresh() { return { v: 1, unlocked: START.slice(), games: 0, wins: 0, takeaways: 0, bestTds: 0, bestLongWin: false, live: null, log: [], vs: {} }; }
  function load(key) {
    let d = null; try { d = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}
    d = Object.assign(fresh(), d || {});
    // A game was cut off (page reloaded mid-game): keep the totals it had earned so far.
    if (d.live) { d.takeaways += d.live.takeaways || 0; d.live = null; }
    return d;
  }
  function save() { try { localStorage.setItem(dev ? DEV_KEY : KEY, JSON.stringify(data)); } catch (e) {} }
  function setDev(on) { if (on === dev) return; dev = on; data = load(dev ? DEV_KEY : KEY); }

  const isUnlocked = id => dev || data.unlocked.includes(id);
  const door = () => LADDER.find(l => !data.unlocked.includes(l.id)) || null;
  function card(id) {
    const t = TEAMS.byId[id], d = door(), rung = LADDER.find(l => l.id === id);
    if (isUnlocked(id)) return { id, open: true };
    if (HINT[id]) return { id, open: false, goal: HINT[id], next: false };
    const next = d && d.id === id;
    return { id, open: false, next, goal: next ? rung.goal : "EARN THE EARLIER TEAMS FIRST",
      prog: next ? rung.prog(data, data.unlocked) : null };
  }
  const openTeams = () => TEAMS.list.filter(t => isUnlocked(t.id)).map(t => t.id);

  // ----- during a game: count takeaways as they happen (saved each play) -----
  function humanTally(G) {
    const t = { tds: 0, takeaways: 0, long40Win: false, won: false, cpuMargin: -99 };
    for (const s of [1, 2]) {
      if (!G.human[s]) continue;
      const ev = G.events.filter(e => e.team === s);
      t.tds = Math.max(t.tds, ev.filter(e => e.type === "td").length);
      t.takeaways += ev.filter(e => e.type === "int").length + (G.events.filter(e => e.type === "fumble" && e.lost && e.by === s).length);
      const won = G.winner === s, long = ev.some(e => e.type === "passGain" && e.gain >= 40);
      if (won) t.won = true;
      if (won && long) t.long40Win = true;
      const o = s === 1 ? 2 : 1;
      if (!G.human[o]) t.cpuMargin = Math.max(t.cpuMargin, G.score[s] - G.score[o]);
    }
    return t;
  }
  function onPlay(G) {
    if (!G.human[1] && !G.human[2]) return;
    data.live = { takeaways: humanTally(G).takeaways }; save();
  }
  // Quit before the end: totals earned so far still count, but the game doesn't.
  function onQuit(G) {
    if (data.live) { data.takeaways += data.live.takeaways; data.live = null; save(); }
  }
  // A finished game. Returns the id of a newly unlocked team, or null.
  function onGameOver(G) {
    if (!G.human[1] && !G.human[2]) return null;
    const g = humanTally(G);
    data.live = null;
    data.games++; if (g.won) data.wins++;
    data.takeaways += g.takeaways;
    data.bestTds = Math.max(data.bestTds, g.tds);
    if (g.long40Win) data.bestLongWin = true;
    let got = null;
    const d = door();
    if (d && d.done(data, g, data.unlocked)) {
      data.unlocked.push(d.id); got = d.id;
      // one-game goals count from when they become the next door, so the bar starts empty
      data.bestTds = 0; data.bestLongWin = false;
    }
    data.log.push({ at: Date.now(), s1: G.score[1], s2: G.score[2], t1: CFG.TEAMS[1].id, t2: CFG.TEAMS[2].id, got });
    if (data.log.length > 50) data.log.shift();
    save();
    try { localStorage.setItem((dev ? DEV_KEY : KEY) + "-backup", JSON.stringify(data)); } catch (e) {}
    return got;
  }

  // ----- cheat code (title screen, phone D-pad or keyboard arrows) -----
  let buf = [];
  function cheatKey(k) {
    buf.push(k); if (buf.length > CHEAT.length) buf.shift();
    if (buf.join() !== CHEAT.join()) return false;
    buf = [];
    if (data.unlocked.includes("lawnchairs")) return "again";
    data.unlocked.push("lawnchairs"); save();
    return true;
  }

  // ----- reset and backup -----
  function reset() { try { localStorage.setItem((dev ? DEV_KEY : KEY) + "-before-reset", JSON.stringify(data)); } catch (e) {} data = fresh(); save(); }
  function code() { return "DADMO-" + btoa(JSON.stringify({ u: data.unlocked, g: data.games, w: data.wins, t: data.takeaways, b: data.bestTds, l: data.bestLongWin })); }
  function restore(str) {
    if (String(str).trim().toUpperCase() === "UNDO") {
      try { const d = JSON.parse(localStorage.getItem((dev ? DEV_KEY : KEY) + "-before-reset")); if (!d) return false; data = Object.assign(fresh(), d); save(); return true; } catch (e) { return false; }
    }
    try {
      const o = JSON.parse(atob(String(str).trim().replace(/^DADMO-/, "")));
      if (!Array.isArray(o.u)) return false;
      data = Object.assign(fresh(), { unlocked: o.u.filter(id => TEAMS.byId[id]), games: +o.g || 0, wins: +o.w || 0, takeaways: +o.t || 0, bestTds: +o.b || 0, bestLongWin: !!o.l, vs: data.vs || {} }); // matchup history stays
      save(); return true;
    } catch (e) { return false; }
  }

  return { isUnlocked, card, door, openTeams, onPlay, onQuit, onGameOver, cheatKey, reset, code, restore, setDev, save,
    get data() { return data; }, LADDER, START, CHEAT };
})();
