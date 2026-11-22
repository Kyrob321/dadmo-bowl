// TV-style lower-third pop-ups built only from numbers counted during this game, plus matchup memory:
// every finished game between two teams is remembered on this laptop (saved with the unlock progress).
const BROADCAST = (() => {
  const yd = n => Math.round(n);
  const short = t => CFG.TEAMS[t].short;
  const ROLE = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", DL: "DL", LB: "LB", CB: "CB", S: "S", KR: "KR" };
  const COOLDOWN = 12; // at least this many plays between pop-ups, so they stay special

  // ---------- matchup memory ----------
  const pairKey = (a, b) => [a, b].sort().join("|");
  function series(a, b) { const v = PROGRESS.data.vs || {}; return v[pairKey(a, b)] || null; }
  // "MEETING #3 · LAST TIME: YETIS 21-17" and the series record, from team a's point of view.
  function memoryLines(a, b) {
    const s = series(a, b), A = TEAMS.byId[a], B = TEAMS.byId[b];
    if (!s) return { head: A.short + " VS " + B.short + " · FIRST MEETING EVER", sub: "" };
    const L = s.last, w = L.s1 === L.s2 ? null : (L.s1 > L.s2 ? L.t1 : L.t2);
    const hi = Math.max(L.s1, L.s2), lo = Math.min(L.s1, L.s2);
    const last = w ? "LAST TIME: " + TEAMS.byId[w].short + " " + hi + "-" + lo : "LAST TIME: TIED " + hi + "-" + lo;
    let rec;
    if (a === b) rec = "MIRROR MATCH";
    else {
      const wa = s.w[a] || 0, wb = s.w[b] || 0, ties = s.ties ? " (" + s.ties + " TIE" + (s.ties > 1 ? "S" : "") + ")" : "";
      rec = wa === wb ? "SERIES TIED " + wa + "-" + wb + ties : "SERIES: " + (wa > wb ? A.short : B.short) + " LEAD " + Math.max(wa, wb) + "-" + Math.min(wa, wb) + ties;
    }
    return { head: A.short + " VS " + B.short + " · MEETING #" + (s.n + 1), sub: last + " · " + rec, star: L.top || "" };
  }
  // Called once when a real game (not the demo) ends.
  function record(G) {
    const d = PROGRESS.data; if (!d.vs) d.vs = {};
    const t1 = CFG.TEAMS[1].id, t2 = CFG.TEAMS[2].id, k = pairKey(t1, t2);
    const s = d.vs[k] || (d.vs[k] = { n: 0, w: {}, ties: 0, last: null });
    s.n++;
    if (G.score[1] === G.score[2]) s.ties++;
    else { const w = G.score[1] > G.score[2] ? t1 : t2; s.w[w] = (s.w[w] || 0) + 1; }
    const pog = playerOfGame(G);
    s.last = { t1, t2, s1: G.score[1], s2: G.score[2], at: Date.now(), top: pog ? pog.name + " (" + TEAMS.byId[CFG.TEAMS[pog.team].id].short + "): " + pog.line : "" };
    PROGRESS.save();
  }

  // ---------- stat lines ----------
  function passLine(p) { return p.comp + " OF " + p.att + ", " + yd(p.passYds) + " YDS" + (p.passTds ? ", " + p.passTds + " TD" : ""); }
  function bestLine(p) {
    const parts = [];
    if (p.att >= 3) parts.push(passLine(p));
    if (p.car >= 3 || Math.abs(p.rush) >= 30) parts.push(yd(p.rush) + " RUSH YDS");
    if (p.rec) parts.push(pl(p.rec, "CATCH") + ", " + yd(p.recYds) + " YDS");
    if (p.tds && !p.att) parts.push(p.tds + " TD");
    if (p.sacks) parts.push(p.sacks + " SACK" + (p.sacks > 1 ? "S" : ""));
    if (p.ints) parts.push(p.ints + " INT");
    if (p.broke >= 2) parts.push(p.broke + " BROKEN TACKLES");
    return parts.slice(0, 2).join(" · ");
  }
  function playerOfGame(G) {
    const won = G.winner || 0;
    let best = null, bs = -1;
    for (const p of Object.values(G.ps || {})) {
      const sc = Math.max(0, p.rush) + p.recYds + p.passYds * 0.45 + (p.tds + p.passTds) * 20 + p.sacks * 18 + p.ints * 25 + p.broke * 4 + p.tkl * 3
        + (won && p.team === won ? 15 : 0);
      if (sc > bs) { bs = sc; best = p; }
    }
    return best && bs > 0 ? { name: best.name, team: best.team, line: bestLine(best) } : null;
  }

  // ---------- milestones ----------
  // Each one: which stat, the values worth announcing, and the words. A milestone is shown once, the
  // first time it's reached; numbers come straight from the box score at that moment.
  const pl = (n, w) => n + " " + w + (n === 1 ? "" : w.endsWith("H") ? "ES" : "S");
  const MILESTONES = [
    { k: "rush", at: [75, 100, 150, 200], say: p => yd(p.rush) + " RUSHING YDS ON " + p.car + " CARRIES" },
    { k: "recYds", at: [100, 150, 200], say: p => pl(p.rec, "CATCH") + " FOR " + yd(p.recYds) + " YDS" },
    { k: "rec", at: [6, 9], say: p => pl(p.rec, "CATCH") + " FOR " + yd(p.recYds) + " YDS" },
    { k: "passYds", at: [200, 300, 400], say: p => passLine(p) },
    { k: "tds", at: [2, 3, 4, 5], say: p => p.tds + " TOUCHDOWNS TODAY" },
    { k: "passTds", at: [3, 4, 5], say: p => p.passTds + " TD PASSES TODAY" },
    { k: "broke", at: [4, 6, 9], say: p => p.broke + " BROKEN TACKLES TODAY" },
    { k: "sacks", at: [2, 3, 4], say: p => p.sacks + " SACKS TODAY" },
    { k: "ints", at: [2, 3], say: p => p.ints + " INTERCEPTIONS TODAY" },
    { k: "tkl", at: [12], say: p => p.tkl + " TACKLES TODAY" },
  ];
  const TEAM_MS = [
    { k: "sacks", at: [3, 5, 7], say: n => n + " SACKS TODAY" },
    { k: "takeaways", at: [3, 4, 5], say: n => n + " TURNOVERS FORCED TODAY" },
  ];
  function teamCount(G, t, k) {
    if (k === "sacks") return Object.values(G.ps).filter(p => p.team === t).reduce((a, p) => a + p.sacks, 0);
    if (k === "takeaways") return G.events.filter(e => (e.type === "int" && e.team === t) || (e.type === "fumble" && e.lost && e.by === t)).length;
    return 0;
  }

  function show(G, o) { G.lower = Object.assign({ t: 0, dur: 3.6 }, o); }

  // After every play: announce at most one new milestone (biggest first).
  function afterPlay(G) {
    if (!G.ps || G.phase === "over") return;
    G.said = G.said || {};
    if (G.lower && G.lower.t < G.lower.dur) return;
    if (G.plays - G.lastPop < COOLDOWN) return;
    let best = null;
    for (const p of Object.values(G.ps)) for (const m of MILESTONES) {
      const v = p[m.k], hit = m.at.filter(a => v >= a).pop();
      if (hit == null) continue;
      const id = p.team + ":" + p.key + ":" + m.k;
      if ((G.said[id] || 0) >= hit) continue;
      const rank = m.at.indexOf(hit) * 10 + (p.star ? 3 : 0) + (m.k === "tds" || m.k === "broke" ? 2 : 0);
      if (!best || rank > best.rank) best = { rank, id, hit, team: p.team, name: p.name, star: p.star, role: ROLE[p.role] || "", line: m.say(p) };
    }
    for (const t of [1, 2]) for (const m of TEAM_MS) {
      const v = teamCount(G, t, m.k), hit = m.at.filter(a => v >= a).pop();
      if (hit == null) continue;
      const id = t + ":team:" + m.k;
      if ((G.said[id] || 0) >= hit) continue;
      const rank = m.at.indexOf(hit) * 10 + 1;
      if (!best || rank > best.rank) best = { rank, id, hit, team: t, name: CFG.TEAMS[t].name + " DEFENSE", line: m.say(v) };
    }
    if (!best) return;
    // Mark every milestone this player/team has already passed, so a skipped smaller one never shows late.
    G.said[best.id] = best.hit;
    G.lastPop = G.plays;
    show(G, { team: best.team, kicker: short(best.team) + " · TODAY", name: (best.star ? "★ " : "") + best.name + (best.role ? " · " + best.role : ""), line: best.line });
  }

  // Before the opening kickoff: the matchup history.
  function kickoff(G) {
    const m = memoryLines(CFG.TEAMS[1].id, CFG.TEAMS[2].id);
    show(G, { team: 0, kicker: "THE MATCHUP", name: m.head, line: m.sub || "A BRAND NEW RIVALRY STARTS NOW", dur: 4.2 });
  }
  // At the final whistle: player of the game and the updated series.
  function final(G) {
    const pog = playerOfGame(G), m = memoryLines(CFG.TEAMS[1].id, CFG.TEAMS[2].id);
    if (!pog) return;
    show(G, { team: pog.team, kicker: "PLAYER OF THE GAME", name: pog.name, line: pog.line, dur: 999, sub2: m.sub ? m.sub.split(" · ").pop() : "" });
  }
  function update(G, dt) {
    if (!G.lower) return;
    G.lower.t += dt;
    if (G.lower.t > G.lower.dur) G.lower = null;
  }
  return { afterPlay, kickoff, final, update, record, series, memoryLines, playerOfGame, MILESTONES };
})();
