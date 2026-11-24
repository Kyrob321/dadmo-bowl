// Test harness for tuning (loaded by hand in the browser console; not part of the game).
window.metrics = function (o) {
  const pct = (a, b) => 100 * (a || 0) / Math.max(1, b || 0), d = (a, b) => (a || 0) / Math.max(1, b || 0);
  return {
    comp: pct(o.comp, o.att), int: pct(o.ints, o.att), sack: pct(o.sacks, (o.att || 0) + (o.sacks || 0)), sackDb: pct(o.sacks, (o.dropbacks || 0) + (o.scrambles || 0)), // sacks per pass call
    ypc: d(o.rushYds, o.runs), ypa: d(o.passYds, o.att), missTk: pct(o.brokenTackles, o.tackleReps),
    fum: pct(o.fumbles, o.plays), runShare: pct(o.runs, (o.runs || 0) + (o.dropbacks || 0)),
    ptsDrive: d(o.points, o.drives), air: d(o.airYds, o.comp), yac: d((o.passYds || 0) - (o.airYds || 0), o.comp), drops: pct(o.drops, o.att), depth: d(o.tgtDepth, o.att), deepPct: pct(o.deepAtt, o.att),
  };
};
// Team vs the neutral Krush, alternating sides. Returns summed offense stats for the team and for its opponents.
window.runMatch = function (teamId, games) {
  const G = GAME.state, off = {}, def = {}; let err = null;
  const add = (acc, o) => { for (const k in o) if (typeof o[k] === "number") acc[k] = (acc[k] || 0) + o[k]; };
  try {
    for (let g = 0; g < games; g++) {
      const slot = g % 2 ? 1 : 2, other = slot === 1 ? 2 : 1;
      const t = slot === 1 ? { 1: teamId, 2: "krush" } : { 1: "krush", 2: teamId };
      GAME.newGame({ 1: false, 2: false }, t); GAME.sim(3600);
      add(off, G.stats.by[slot]); add(def, G.stats.by[other]);
    }
  } catch (e) { err = String(e) + " " + e.stack.split("\n")[1]; }
  return { off, def, err, games };
};
window.RESULTS = window.RESULTS || {};
window.store = () => { try { localStorage.setItem("dadmo-dev-results", JSON.stringify(RESULTS)); } catch (e) {} };
window.restore = () => { try { Object.assign(RESULTS, JSON.parse(localStorage.getItem("dadmo-dev-results") || "{}")); } catch (e) {} };
// Compare each team's measured change vs baseline against the written expectations.
window.grade = function () {
  const base = RESULTS.krush, bOff = metrics(base.off), bDef = metrics(base.def), rows = [];
  for (const [team, exps] of Object.entries(EXPECT)) {
    const r = RESULTS[team]; if (!r) { rows.push(team + ": not run"); continue; }
    const mo = metrics(r.off), md = metrics(r.def);
    for (const [stat, side, lo, hi] of exps) {
      let v;
      if (stat === "fumRatio") v = (side === "off" ? mo.fum : md.fum) / Math.max(0.01, side === "off" ? bOff.fum : bDef.fum);
      else v = side === "off" ? mo[stat] - bOff[stat] : md[stat] - bDef[stat];
      rows.push(`${v >= lo && v <= hi ? "PASS" : "MISS"} ${team} ${side} ${stat}: ${v.toFixed(2)} (expected ${lo}..${hi})`);
    }
  }
  return rows;
};

// ---------- weather (phase T6) ----------
// Whole-game totals in one weather, rotating every team through both slots so no team skews it.
window.runWeather = function (kind, games, onlyTeam) {
  const all = {}, q4 = {}; const ids = TEAMS.list.map(t => t.id); let err = null;
  const add = (acc, o) => { for (const k in o) if (typeof o[k] === "number") acc[k] = (acc[k] || 0) + o[k]; };
  WEATHER.force(kind); if (!WEATHER.enabled()) WEATHER.toggle();
  try {
    for (let g = 0; g < games; g++) {
      const a = onlyTeam || ids[g % 12], b = onlyTeam ? "krush" : ids[(g * 5 + 7) % 12];
      const t = g % 2 ? { 1: a, 2: b } : { 1: b, 2: a };
      GAME.newGame({ 1: false, 2: false }, t); GAME.sim(3600);
      add(all, GAME.state.stats); add(q4, GAME.state.stats.q4);
    }
  } catch (e) { err = String(e) + " " + (e.stack || "").split("\n")[1]; }
  WEATHER.force(null);
  return { all, q4, err, games };
};
window.wmetrics = r => { const m = metrics(r.all), q = metrics(r.q4);
  return Object.assign(m, { fgPct: 100 * (r.all.fgs || 0) / Math.max(1, r.all.fgAtt || 0), dropsRaw: m.drops,
    missTkQ4: q.missTk, ypcQ4: q.ypc, fumQ4: q.fum }); };
window.WRES = window.WRES || {};
window.gradeWeather = function () {
  const base = wmetrics(WRES.clear), rows = [];
  const RATIO = { fumRatio: "fum", drops: "dropsRaw", fumRatioQ4: "fumQ4" };
  for (const [kind, exps] of Object.entries(EXPECT_WEATHER)) {
    if (kind === "clear") continue;
    const r = WRES[kind]; if (!r) { rows.push(kind + ": not run"); continue; }
    const m = wmetrics(r);
    for (const [stat, , lo, hi] of exps) {
      if (stat === "any") {
        for (const k of ["ypc", "ypa", "ptsDrive"]) { const v = m[k] - base[k]; rows.push(`${v >= lo && v <= hi ? "PASS" : "MISS"} ${kind} ${k}: ${v.toFixed(2)} (expected ${lo}..${hi})`); }
        continue;
      }
      const v = RATIO[stat] ? m[RATIO[stat]] / Math.max(0.01, base[RATIO[stat]]) : m[stat] - base[stat];
      rows.push(`${v >= lo && v <= hi ? "PASS" : "MISS"} ${kind} ${stat}: ${v.toFixed(2)} (expected ${lo}..${hi})`);
    }
  }
  return rows;
};

// Team x weather grid: one team vs Krush in one weather. Stores totals plus wins for that team.
window.runCombo = function (kind, team, games) {
  const r = runWeather(kind, 0); const all = {}; let wins = 0, err = null;
  const add = (acc, o) => { for (const k in o) if (typeof o[k] === "number") acc[k] = (acc[k] || 0) + o[k]; };
  WEATHER.force(kind); if (!WEATHER.enabled()) WEATHER.toggle();
  try {
    for (let g = 0; g < games; g++) {
      const slot = g % 2 ? 1 : 2, t = slot === 1 ? { 1: team, 2: "krush" } : { 1: "krush", 2: team };
      GAME.newGame({ 1: false, 2: false }, t); GAME.sim(3600);
      add(all, GAME.state.stats); if (GAME.state.winner === slot) wins++;
    }
  } catch (e) { err = String(e); }
  WEATHER.force(null);
  return { all, q4: {}, wins, games, err };
};

// Difficulty: slot 1 is a "person" stand-in (computer with a ratings edge), slot 2 is the computer at a difficulty boost.
window.runDiff = function (personEdge, cpuBoost, games) {
  const a = {}, b = {}; let w = 0, err = null;
  const add = (acc, o) => { for (const k in o) if (typeof o[k] === "number") acc[k] = (acc[k] || 0) + o[k]; };
  WEATHER.force("clear");
  try { for (let g = 0; g < games; g++) {
    GAME.newGame({ 1: false, 2: false }, { 1: "krush", 2: "krush", boost: { 1: personEdge, 2: cpuBoost } }); GAME.sim(3600);
    add(a, GAME.state.stats.by[1]); add(b, GAME.state.stats.by[2]); if (GAME.state.winner === 1) w++;
  } } catch (e) { err = String(e); }
  WEATHER.force(null);
  return { person: metrics(a).ptsDrive.toFixed(2), cpu: metrics(b).ptsDrive.toFixed(2), personWin: Math.round(100 * w / games), err };
};

// Superstars: team vs Krush with powers on or off (clear weather so nothing else moves).
window.runPow = function (teamId, games, powers) {
  const off = {}, def = {}; let err = null;
  const add = (acc, o) => { for (const k in o) if (typeof o[k] === "number") acc[k] = (acc[k] || 0) + o[k]; };
  WEATHER.force("clear");
  try { for (let g = 0; g < games; g++) {
    const slot = g % 2 ? 1 : 2, other = slot === 1 ? 2 : 1;
    const t = slot === 1 ? { 1: teamId, 2: "krush" } : { 1: "krush", 2: teamId }; t.powers = powers;
    GAME.newGame({ 1: false, 2: false }, t); GAME.sim(3600);
    add(off, GAME.state.stats.by[slot]); add(def, GAME.state.stats.by[other]);
  } } catch (e) { err = String(e) + " " + (e.stack || "").split("\n")[1]; }
  WEATHER.force(null);
  return { off, def, err, games };
};
window.PRES = window.PRES || {};
window.gradeStars = function () {
  const rows = [];
  for (const [team, exps] of Object.entries(EXPECT_STARS)) {
    const on = PRES[team + "|on"], off = PRES[team + "|off"]; if (!on || !off) { rows.push(team + ": not run"); continue; }
    const a = { off: metrics(on.off), def: metrics(on.def) }, b = { off: metrics(off.off), def: metrics(off.def) };
    for (const [stat, side, lo, hi] of exps) {
      const v = stat === "fumRatio" ? a[side].fum / Math.max(0.01, b[side].fum) : a[side][stat] - b[side][stat];
      rows.push(`${v >= lo && v <= hi ? "PASS" : "MISS"} ${team} ${side} ${stat}: ${v.toFixed(2)} (expected ${lo}..${hi})`);
    }
  }
  return rows;
};

// ---------- human pass defense (phase T8) ----------
// A bot plays team 2's human defender against the CPU offense (team 1). mode: "cpu" (computer defends),
// "perfect" (JUMP on the ideal moment) or "early" (JUMP 0.3 s early). Team 2 is human only while defending.
window.passD = function (mode, games, teams) {
  const G = GAME.state, V = INPUT.virt[2], K = CFG.CAL;
  const tally = { att: 0, comp: 0, ints: 0, contest: 0, jumps: 0, err: null };
  const steer = (p, x, y) => { const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy); if (l < 0.3) { V.ax = V.ay = 0; return; } V.ax = dx / l; V.ay = dy / l; };
  try {
    for (let g = 0; g < games; g++) {
      GAME.newGame({ 1: false, 2: mode !== "cpu" }, teams || { 1: "krush", 2: "krush" });
      let wasAir = null, guard = 0;
      while (G.phase !== "over" && guard++ < 60 * 3600) {
        const defending = mode !== "cpu" && G.poss === 1 && (G.phase === "presnap" || G.phase === "live") && !G.mash;
        G.human[2] = defending; V.ax = V.ay = 0; V.z = false;
        const b = G.ball, p = G.control[2];
        if (defending && G.phase === "live" && p && p.team === 2) {
          if (b && b.state === "air") {
            if (mode !== "press") steer(p, b.tx, b.ty); // "press": times JUMP like "good" but never steers
            if ((mode === "good" || mode === "press") && b.t < 0.25) { V.ax = V.ay = 0; } // a person needs a moment to see the throw
            if ((mode === "good" || mode === "press") && b._at == null) b._at = b.ideal + (Math.random() * 2 - 1) * 0.9 * GAME.windowFor(p.r.cov); // lands in the GOOD window, rarely PERFECT
            const at = mode === "early" ? b.ideal - 0.3 : (mode === "good" || mode === "press") ? b._at : b.ideal;
            if (b.defT == null && b.t >= at) V.z = true;
          } else {
            let best = null, bd = 1e9; // cover the nearest receiver
            for (const o of G.players) if (o.team === 1 && o.route) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
            if (best) steer(p, best.x + 1, best.y);
          }
        }
        INPUT.poll(); GAME.update(1 / 60);
        const nb = G.ball;
        if (wasAir && (!nb || nb.state !== "air")) {
          if (G.human[2] && wasAir.defP) { tally.jumps++; const j = wasAir.defP; if (Math.hypot(j.x - wasAir.tx, j.y - wasAir.ty) < K.CC_RADIUS + K.JUMP_REACH) tally.contest++; }
        }
        wasAir = nb && nb.state === "air" && G.poss === 1 ? nb : null;
      }
      const s = G.stats.by[1]; tally.att += s.att || 0; tally.comp += s.comp || 0; tally.ints += s.ints || 0;
    }
  } catch (e) { tally.err = String(e) + " " + (e.stack || "").split("\n")[1]; }
  V.ax = V.ay = 0; V.z = false;
  const pct = (a, b) => Math.round(1000 * a / Math.max(1, b)) / 10;
  return { mode, games, att: tally.att, comp: pct(tally.comp, tally.att), int: pct(tally.ints, tally.att), contest: pct(tally.contest, tally.att), jumps: tally.jumps, err: tally.err };
};
