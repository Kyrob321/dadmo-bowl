// The football: rules, clock, players, AI, controls and the hidden "rep" scores. No drawing in here.
// Positions are yards in the offense's frame (offense always attacks toward x = 100).
const GAME = (() => {
  const W = CFG.FIELD_W, C = W / 2, K = CFG.CAL;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const other = t => (t === 1 ? 2 : 1);
  const gauss = RATINGS.gauss;
  const Q = CFG.QUARTER_SECONDS;

  const G = { phase: "idle", human: { 1: true, 2: false }, score: { 1: 0, 2: 0 }, players: [], control: {}, quarter: 1, clock: Q };
  let seed = 0;

  // ---------- stats (for tuning against the NFL) ----------
  function freshStats() {
    return { plays: 0, runs: 0, rushYds: 0, dropbacks: 0, att: 0, comp: 0, passYds: 0, ints: 0, sacks: 0,
      tackleReps: 0, brokenTackles: 0, mashes: 0, fumbles: 0, fumblesLost: 0, touches: 0,
      contested: 0, contestedCatches: 0, airYds: 0, sepSum: 0, swats: 0, drops: 0, drives: 0, points: 0, tds: 0, fgs: 0,
      repScores: [], ccScores: [] };
  }
  const ST = () => G.stats;
  // Count a stat for the whole game and for one team (default: the team with the ball).
  function bump(k, n, team) {
    n = n == null ? 1 : n; team = team || G.poss;
    G.stats[k] = (G.stats[k] || 0) + n;
    const b = G.stats.by && G.stats.by[team]; if (b) b[k] = (b[k] || 0) + n;
    if (G.quarter >= 4 && G.stats.q4) G.stats.q4[k] = (G.stats.q4[k] || 0) + n; // late-game weather checks
  }
  const teamOf = slot => TEAMS.byId[RATINGS.SLOT_TEAM[slot]] || TEAMS.byId.krush;

  // ---------- helpers ----------
  function makePlayer(team, side, spec) {
    const r = RATINGS.make(spec.role, team);
    // Difficulty: the computer's team gets a ratings boost (or cut) when it plays a person.
    const bst = (G.boost && G.boost[team]) || 0;
    if (bst) for (const k in r) r[k] = clamp(r[k] + bst, 25, 99);
    return {
      team, side, role: spec.role, id: spec.id || spec.role, man: spec.man, r,
      x: spec.x, y: spec.y, x0: spec.x, y0: spec.y, vx: 0, vy: 0,
      spd: RATINGS.speed(r.spd), face: 1, seed: seed++,
      route: null, ri: 0, stride: 0, anim: null, lying: false, skin: Math.floor(Math.random() * 4),
      down: 0, engaged: 0, blockCd: 0, burst: 0, burstCd: 0, jump: 0, dive: 0, slowT: 0, slowMul: 1, cut: 0, cutDir: 0, repCd: 0,
    };
  }
  const byId = id => G.players.find(p => p.side === "off" && p.id === id);
  const qb = () => G.players.find(p => p.side === "off" && p.role === "QB");
  const carrier = () => (G.ball && G.ball.state === "held" ? G.ball.holder : null);
  const teamPlayers = t => G.players.filter(p => p.team === t);
  const trailing = t => G.score[t] < G.score[other(t)];
  const dirOf = p => (p.team === G.poss ? 1 : -1);
  const skill = p => (p.r.juke + p.r.stiff + p.r.truck) / 3;

  // ---------- superstars, names, on fire ----------
  const powersOn = () => G.powers !== false;
  const has = (p, power) => !!(p && p.star && p.power === power && powersOn());
  // Give every player a lasting identity (team + spot), a name, and his star power; then apply
  // temporary boosts: on fire (+8 to everything) and the Bolts captain's rally (+3 per level).
  function tag(list) {
    const n = {};
    for (const p of list) {
      const k = p.team + p.role; n[k] = (n[k] || 0); p.key = p.role + n[k]++;
      const inf = STARS.info(teamOf(p.team).id, p.key);
      p.name = inf.name; p.star = inf.star; p.power = inf.power; p.blurb = inf.blurb;
      let extra = 0;
      if (fireOn(p)) extra += K.FIRE_BOOST;
      extra += 3 * rallyLevel(p.team);
      if (extra) { for (const r in p.r) p.r[r] = clamp(p.r[r] + extra, 25, 99); p.spd = RATINGS.speed(p.r.spd); }
    }
  }
  const fireKey = p => p.team + ":" + p.key;
  const fireOn = p => powersOn() && !!(G.fire[fireKey(p)] && G.fire[fireKey(p)].on);
  function bigPlay(p) {
    if (!p || !p.key || !powersOn()) return;
    const f = G.fire[fireKey(p)] = G.fire[fireKey(p)] || { n: 0, on: false };
    f.n++;
    const need = has(p, "PRIME TIME") ? 1 : p.star ? 2 : 3;
    if (!f.on && f.n >= need) { f.on = true; bump("fires", 1, p.team); event("fire", { team: p.team, name: p.name }); G.fireMsg = { name: p.name, team: p.team, t: 2.4 }; }
  }
  function badPlay(p) {
    if (!p || !p.key) return;
    const f = G.fire[fireKey(p)]; if (!f) return;
    f.n = 0; if (f.on) { f.on = false; pop("FIRE'S OUT", p.x, p.y, "#9fb1c5"); }
  }
  function fireOut(team) { for (const k in G.fire) if (k.startsWith(team + ":")) { G.fire[k].on = false; G.fire[k].n = 0; } }
  // The Captain: each first down on a Bolts drive adds a level (max 2); trailing adds one on either side of the ball.
  function rallyLevel(team) {
    if (!powersOn() || STARS.powerOf(teamOf(team).id) !== "THE CAPTAIN" || !G.rally) return 0;
    return Math.min(2, (G.poss === team ? G.rally[team] || 0 : 0) + (trailing(team) ? 1 : 0));
  }
  function powerPop(p, text) { pop(text, p.x, p.y - 1, "#ffe14a"); bump("powerUses", 1, p.team); ST()["pw_" + p.power] = (ST()["pw_" + p.power] || 0) + 1; }

  function anim(p, name, dur) { if (p) p.anim = { name, t0: G.time, dur }; }
  function fx(kind, x, y) { G.fx.push({ kind, x, y, t0: G.time }); if (G.fx.length > 40) G.fx.shift(); }
  function shake(s) { G.shake = Math.max(G.shake || 0, s); }
  function banner(text, sub, secs, color) { G.banner = { text, sub: sub || "", t: secs || 1.6, color: color || "#ffb627" }; }
  // Per-player box score (for the broadcast pop-ups). Keyed by team + formation spot, so it follows the
  // same named player all game. Every number here is counted as it happens, never estimated.
  function pst(p) {
    if (!p || !p.key || !G.ps) return null;
    const k = p.team + ":" + (p.star ? p.name : p.key); // a two-way star (Prime) keeps one line for both sides
    return G.ps[k] || (G.ps[k] = { team: p.team, key: p.key, name: p.name, star: !!p.star, role: p.role,
      car: 0, rush: 0, rec: 0, recYds: 0, comp: 0, att: 0, passYds: 0, passTds: 0, tds: 0, sacks: 0, ints: 0, broke: 0, tkl: 0 });
  }
  function event(type, data) { G.events.push(Object.assign({ type, q: G.quarter }, data || {})); }
  function pop(text, x, y, color) { G.pops.push({ text, x, y, t0: G.time, color: color || "#fff" }); if (G.pops.length > 8) G.pops.shift(); }

  function setVel(p, dx, dy, mul) {
    let s = p.spd * (mul || 1);
    if (p.burst > 0) s *= 1.3;
    if (p.engaged > 0) s *= 0.12;
    if (p.slowT > 0) s *= p.slowMul;
    s *= WEATHER.get("spd");
    if (G.ball && G.ball.state === "held" && G.ball.holder === p) {
      s *= WEATHER.get("carry"); // cutting with the ball on a slick field
      if (has(p, "PRIME TIME") && !G.players.some(o => o.team !== p.team && o.down <= 0 && Math.hypot(o.x - p.x, o.y - p.y) < 4)) s *= 1.07; // open-field speed
    }
    p.vx = dx * s; p.vy = dy * s;
    const dropping = p.role === "QB" && G.play && G.play.type === "pass" && !G.play.thrown && !G.play.crossed && p.side === "off";
    if (Math.abs(dx) > 0.1 && !dropping) p.face = dx > 0 ? 1 : -1;
  }
  function seek(p, tx, ty, mul) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.15) { p.vx = p.vy = 0; return d; }
    setVel(p, dx / d, dy / d, Math.min(mul || 1, d * 2));
    return d;
  }

  // ---------- timing ----------
  // Window half-width grows with the rating. Quality: 1 = perfect, 0.5 = edge of green, down to -1 for way off.
  const windowFor = rating => K.WIN_BASE + K.WIN_RATING * rating / 100;
  function quality(pressT, idealT, w) {
    if (pressT == null) return null;
    const d = Math.abs(pressT - idealT);
    return d <= w ? 1 - 0.5 * d / w : Math.max(-1, 0.5 - 0.75 * (d - w) / w);
  }
  function verdict(pressT, idealT, w) {
    const d = pressT - idealT;
    if (Math.abs(d) <= w * 0.35) return ["PERFECT!", "#7fd68f"];
    if (Math.abs(d) <= w) return ["GOOD", "#c8f0a0"];
    return [d < 0 ? "EARLY" : "LATE", "#ef5a45"];
  }
  // How well the computer times its presses, from a rating.
  const cpuQ = rating => clamp(K.CPU_Q_MEAN + 0.8 * (rating - 70) / 30 + gauss() * K.CPU_Q_SD, -1, 1);

  // ---------- game flow ----------
  // Put two teams in the slots: colors and names for drawing, ratings and styles for play.
  function setTeams(t1, t2, home) {
    RATINGS.SLOT_TEAM[1] = t1; RATINGS.SLOT_TEAM[2] = t2;
    // "trim" is used for on-screen text, so very dark trims swap to the main color; helmets keep the real trim.
    const lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const far = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    for (const s of [1, 2]) { const t = teamOf(s); CFG.TEAMS[s] = { id: t.id, name: t.name, short: t.short, color: t.color, dark: t.dark, helmet: t.trim, trim: lum(t.trim) < 0.3 ? t.color : t.trim, pants: t.pants || "#e9e6dc", number: "#ffffff", away: false }; }
    // Uniform clash (or the same team twice): the visiting team wears its white road jerseys.
    const A = CFG.TEAMS[1], B = CFG.TEAMS[2];
    // Colors clash when they're the same hue and similar brightness (or nearly identical, for greys).
    const hsl = h => { const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let hue = 0;
      if (d) hue = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      return [(hue + 360) % 360, sat, l]; };
    const clash = (a, b) => { const x = hsl(a), y = hsl(b);
      if (x[1] < 0.2 || y[1] < 0.2) return far(a, b) < 100;
      const dh = Math.min(Math.abs(x[0] - y[0]), 360 - Math.abs(x[0] - y[0]));
      return (dh < 40 && Math.abs(x[2] - y[2]) < 0.28) || far(a, b) < 100; };
    if (clash(A.color, B.color) || A.id === B.id) {
      const v = CFG.TEAMS[home === 1 ? 2 : 1], h = CFG.TEAMS[home === 1 ? 1 : 2], t = TEAMS.byId[v.id];
      // If the home team already wears white-ish, the visitors wear a dark alternate instead.
      if (lum(h.color) > 0.6) { Object.assign(v, { color: "#22262e", dark: "#14161a", number: t.color, away: true }); return; }
      Object.assign(v, { color: "#f3efe4", dark: "#c9c4b8", number: lum(t.color) > 0.75 ? t.trim : t.color, pants: lum(t.color) > 0.75 ? t.trim : t.color, away: true,
        trim: v.trim === "#f3efe4" || lum(v.trim) > 0.85 ? (lum(t.color) > 0.75 ? t.trim : t.color) : v.trim });
    }
  }

  function newGame(human, teams) {
    const home = (teams && teams.home) || (Math.random() < 0.5 ? 1 : 2);
    if (teams) setTeams(teams[1], teams[2], home);
    Object.assign(G, {
      human: Object.assign({ 1: true, 2: false }, human || {}),
      score: { 1: 0, 2: 0 }, quarter: 1, clock: Q, clockRunning: false, ot: false,
      banner: null, events: [], mash: null, next: null, overT: 0, plays: 0,
      time: 0, fx: [], pops: [], shake: 0, celebrate: 0, hype: 0, rep: null, fire: {}, rally: { 1: 0, 2: 0 }, fireMsg: null,
      stats: Object.assign(freshStats(), { by: { 1: freshStats(), 2: freshStats() }, q4: freshStats() }), lastZ: { 1: -9, 2: -9 },
      ps: {}, lower: null, said: {}, lastPop: -99,
    });
    // One team is at home; the game gets that stadium's weather.
    G.boost = (teams && teams.boost) || { 1: 0, 2: 0 };
    G.powers = !(teams && teams.powers === false);
    G.windDir = Math.random() < 0.5 ? -1 : 1;
    G.home = home;
    WEATHER.setFor(CFG.TEAMS[G.home].id, teams && teams.weather);
    setupKickoff(other(CFG.FIRST_RECEIVER));
    banner("KICKOFF!", CFG.TEAMS[CFG.FIRST_RECEIVER].name + " RECEIVE", 1.4);
  }

  function changePoss(team, los) {
    if (team !== G.poss) { bump("drives", 1, team); if (G.rally) G.rally[team] = 0; }
    G.poss = team; G.los = clamp(los, 1, 99); G.down = 1; G.togo = Math.min(10, 100 - G.los);
  }

  function setupKickoff(kickTeam) {
    G.celebrate = 0; G.rep = null; G.loose = null;
    G.phase = "kick"; G.poss = kickTeam; G.los = 35; G.down = 1; G.togo = 10; G.clockRunning = false; G.mash = null;
    G.kick = { type: "kickoff", team: kickTeam, needle: 0, dir: 1, t: 0, cpuAt: rnd(0.8, 1.6) };
    G.players = [];
    G.players.push(makePlayer(kickTeam, "off", { role: "QB", id: "K", x: 33, y: C }));
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(kickTeam, "off", { role: "OL", x: 34.5, y: 5 + i * 6.2 }));
    const recv = other(kickTeam);
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(recv, "def", { role: "LB", x: 50 + (i % 2) * 8, y: 6 + i * 5.9 }));
    G.players.push(makePlayer(recv, "def", { role: "S", x: 92, y: C }));
    tag(G.players);
    G.ball = { state: "tee", holder: null, x: 35, y: C, z: 0 };
    G.players.forEach(p => { p.face = p.team === kickTeam ? 1 : -1; });
    G.control = { [kickTeam]: G.players[0], [recv]: G.players[G.players.length - 1] };
  }

  function setupScrimmage() {
    G.celebrate = 0; G.rep = null; G.loose = null;
    G.phase = "presnap"; G.presnapT = 0; G.cpuSnapAt = rnd(1.1, 2.3); G.mash = null; G.play = null;
    const f = PLAYS.formation(G.los);
    const offT = G.poss, defT = other(offT);
    G.players = f.off.map(s => makePlayer(offT, "off", s)).concat(f.def.map(s => makePlayer(defT, "def", s)));
    G.players.forEach(p => { p.face = p.side === "def" ? -1 : 1; });
    tag(G.players);
    G.plans = PLAYS.makePlans(G.los, G.players.filter(p => p.side === "off"), teamOf(G.poss).style);
    G.ball = { state: "held", holder: qb(), x: G.los - 1.6, y: C, z: 1 };
    G.control = { [offT]: qb(), [defT]: G.players.find(p => p.side === "def" && p.role === "LB") };
    G.receivers = []; G.target = 0;
  }

  function snap(call) {
    if (call === "kick") {
      const fg = G.los >= 62;
      G.phase = "kick";
      G.kick = { type: fg ? "fg" : "punt", team: G.poss, needle: 0, dir: 1, t: 0, cpuAt: rnd(0.7, 1.5) };
      const q = qb(); q.x = G.los - (fg ? 7 : 10); q.y = C; q.face = 1;
      G.ball.x = q.x; G.ball.y = q.y;
      return;
    }
    G.phase = "live"; G.clockRunning = true; G.plays++; bump("plays");
    G.play = { hole: gauss(), type: call, t: 0, thrown: false, handed: false, crossed: false, cpuThrowAt: (h => rnd(h[0], h[1]))(teamOf(G.poss).style.hold || [K.QB_HOLD_MIN, K.QB_HOLD_MAX]), scramble: false, startLos: G.los };
    if (call === "pass") bump("dropbacks"); else bump("runs");
    G.players.forEach(p => { p.route = null; p.ri = 0; });
    if (call === "run") {
      const rb = byId("RB"); rb.route = G.plans.run.rbPath.map(o => ({ x: o.x, y: o.y }));
      // Blocking assignments: line on line (in order), tight end on the nearest linebacker, receivers on their corners.
      const off = G.players.filter(p => p.side === "off"), def = G.players.filter(p => p.side === "def");
      const ol = off.filter(p => p.role === "OL").sort((a, b) => a.y - b.y), dl = def.filter(p => p.role === "DL").sort((a, b) => a.y - b.y);
      ol.forEach((p, i) => p.assign = dl[i]);
      const te = byId("TE"), lbs = def.filter(p => p.role === "LB").sort((a, b) => dist(a, te) - dist(b, te));
      te.assign = lbs[0];
      for (const id of ["WR1", "WR2"]) { const w = byId(id); w.assign = def.find(p => p.role === "CB" && p.man === id); }
    } else {
      const r = G.plans.pass.routes;
      G.receivers = [];
      for (const id of ["WR1", "WR2", "TE", "RB"]) {
        const p = byId(id);
        if (r[id]) { p.route = r[id].pts.map(o => ({ x: o.x, y: o.y })); p.routeName = r[id].name; G.receivers.push(p); }
      }
      G.target = 0;
    }
  }

  function setupReturn(recvTeam, rx, kickTeam) {
    G.poss = recvTeam; bump("drives", 1, recvTeam); G.loose = null; if (G.rally) G.rally[recvTeam] = 0;
    G.phase = "live"; G.clockRunning = true; G.mash = null; G.rep = null;
    G.play = { type: "return", t: 0, thrown: true, handed: true, crossed: true };
    G.players = [];
    const kr = makePlayer(recvTeam, "off", { role: "KR", x: rx, y: clamp(C + rnd(-8, 8), 6, W - 6) });
    G.players.push(kr);
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(recvTeam, "off", { role: "OL", x: rx + rnd(6, 13), y: 5 + i * 6.1 }));
    for (let i = 0; i < 9; i++) G.players.push(makePlayer(kickTeam, "def", { role: "CV", x: rx + rnd(15, 24), y: 4 + i * 5.7 }));
    tag(G.players);
    G.ball = { state: "held", holder: kr, x: kr.x, y: kr.y, z: 1 };
    G.players.forEach(p => { p.face = p.team === recvTeam ? 1 : -1; });
    G.control = { [recvTeam]: kr, [kickTeam]: nearestTo(kickTeam, kr) };
  }

  // skipLine: never hand a human control of a defensive lineman (they're stuck in blocks).
  function nearestTo(team, pt, exclude, skipLine) {
    let best = null, bd = 1e9;
    for (const p of G.players) {
      if (p.team !== team || p === exclude || p.down > 0) continue;
      if (skipLine && p.role === "DL") continue;
      const d = dist(p, pt); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---------- kicks ----------
  function updateKick(dt) {
    const k = G.kick; k.t += dt;
    const spd = k.type === "fg" ? 1.1 + (100 - G.los) / 45 : 1.15;
    k.needle += k.dir * spd * dt;
    if (k.needle > 1) { k.needle = 1; k.dir = -1; }
    if (k.needle < 0) { k.needle = 0; k.dir = 1; }
    let acc = null;
    if (G.human[k.team]) { if (k.t > 0.35 && (INPUT.pressed(k.team, "z") || INPUT.pressed(k.team, "x"))) acc = 1 - Math.abs(k.needle - 0.5) * 2; }
    else if (k.t > k.cpuAt) acc = rnd(0.45, 0.97);
    if (acc !== null) {
      const kicker = G.players.find(p => p.team === k.team && (p.id === "K" || p.role === "QB"));
      anim(kicker, "kick", 0.5); fx("dust", kicker.x + 0.5, kicker.y);
      resolveKick(acc);
    }
  }

  function resolveKick(acc) {
    const k = G.kick, kt = k.team, recv = other(kt);
    if (k.type === "kickoff") {
      const land = 35 + 47 + acc * 18;
      return flight(35, land, 1.7, () => {
        if (land >= 100) { changePoss(recv, 25); banner("TOUCHBACK", "", 1.4); return dead(1.4, setupScrimmage); }
        setupReturn(recv, 100 - land, kt);
      });
    }
    if (k.type === "punt") {
      const land = G.los + 32 + acc * 18;
      return flight(G.los - 2, land, 1.6, () => {
        if (land >= 100) { changePoss(recv, 20); banner("TOUCHBACK", "", 1.4); return dead(1.4, setupScrimmage); }
        banner("PUNT", Math.round(land - G.los) + " YARDS", 1);
        setupReturn(recv, 100 - land, kt);
      });
    }
    const yards = Math.round(100 - G.los + 17);
    bump("fgAtt", 1, kt);
    acc *= WEATHER.get("kick");
    const good = acc >= fgNeed(yards);
    // wind pushes every kick sideways a little (made kicks still go through)
    const drift = WEATHER.drift() ? (G.windDir || 1) * rnd(1, 3) : 0;
    const miss = good ? drift * 0.4 : (Math.random() < 0.5 ? -1 : 1) * rnd(5, 9) + drift;
    flight(G.los - 7, 110, 1.3, () => fgResult(kt, recv, yards, good), C + miss);
  }

  function fgNeed(yards) { return clamp((yards - 17) / 46, 0.15, 0.93); }

  function flight(fx_, tx, T, then, ty) {
    G.phase = "flight";
    G.ball = { state: "air", kick: true, fx: fx_, fy: C, tx: Math.min(tx, 109), ty: ty != null ? ty : clamp(C + rnd(-8, 8), 5, W - 5), t: 0, T, h: 7, x: fx_, y: C, z: 1 };
    G.players.forEach(p => { p.vx = p.vy = 0; });
    G.afterFlight = then;
  }
  function updateFlight(dt) {
    const b = G.ball; b.t += dt;
    const k = Math.min(1, b.t / b.T);
    b.x = b.fx + (b.tx - b.fx) * k; b.y = b.fy + (b.ty - b.fy) * k; b.z = 1 + b.h * 4 * k * (1 - k);
    if (b.t >= b.T + 0.35) { const then = G.afterFlight; G.afterFlight = null; then(); }
  }
  function fgResult(kt, recv, yards, good) {
    event("fg", { team: kt, yards, good });
    if (good) {
      G.score[kt] += 3; bump("points", 3, kt); bump("fgs", 1, kt); G.clockRunning = false; fireOut(recv);
      banner("IT'S GOOD!", yards + "-YARD FIELD GOAL", 2.2);
      return scored(kt, 2.2);
    }
    banner("NO GOOD!", yards + " YARDS", 1.8);
    changePoss(recv, Math.max(20, 100 - (G.los - 7)));
    G.clockRunning = false;
    dead(1.8, setupScrimmage);
  }

  // ---------- pre-snap ----------
  function cpuCall() {
    if (G.down === 4) {
      const late = (G.quarter >= 4 || G.ot) && trailing(G.poss);
      if (G.togo <= 1 && G.los > 40) return Math.random() < 0.6 ? "run" : "pass";
      if (!late) return "kick";
    }
    let run = teamOf(G.poss).style.run != null ? teamOf(G.poss).style.run : K.CPU_RUN;
    if (G.togo >= 8) run -= 0.15; if (G.togo <= 3) run += 0.15;
    return Math.random() < run ? "run" : "pass";
  }

  function updatePresnap(dt) {
    G.presnapT += dt;
    const offT = G.poss, defT = other(offT);
    let call = null;
    if (G.human[offT]) {
      if (G.presnapT > 0.4) {
        if (INPUT.pressed(offT, "x")) call = "run";
        else if (INPUT.pressed(offT, "z")) call = "pass";
        else if (G.down === 4 && INPUT.pressed(offT, "up")) call = "kick";
      }
    } else if (G.presnapT > G.cpuSnapAt) call = cpuCall();
    if (G.human[defT]) {
      if (INPUT.pressed(defT, "x")) {
        const defs = teamPlayers(defT).filter(p => p.role !== "DL").sort((a, c) => dist(a, G.ball) - dist(c, G.ball));
        const i = defs.indexOf(G.control[defT]);
        G.control[defT] = defs[(i + 1) % defs.length];
      }
      const p = G.control[defT], d = INPUT.dir(defT);
      if (p && d.any) { p.x = clamp(p.x + d.dx * 4 * dt, G.los + 1, G.los + 18); p.y = clamp(p.y + d.dy * 4 * dt, 1, W - 1); }
    }
    if (call) snap(call);
  }

  // ---------- controls during a live play ----------
  // Ball carrier: the computer runs; the D-pad does skill moves (up/down juke, forward truck, back stiff arm), Z bursts.
  function carrierControls(team, car) {
    const pl = G.play, dirX = dirOf(car);
    if (INPUT.pressed(team, "z") && car.burstCd <= 0) { car.burst = 0.7; car.burstCd = 3; }
    let move = null, jdir = 0;
    if (INPUT.pressed(team, "up")) { move = "juke"; jdir = -1; }
    else if (INPUT.pressed(team, "down")) { move = "juke"; jdir = 1; }
    else if (INPUT.pressed(team, dirX > 0 ? "right" : "left")) move = "truck";
    else if (INPUT.pressed(team, dirX > 0 ? "left" : "right")) move = "stiff";
    if (!move) return;
    const rep = G.rep;
    if (rep && rep.car === car && rep.offT == null) {
      rep.offT = pl.t; rep.move = move; rep.jdir = jdir;
      const v = verdict(rep.offT, rep.ideal, rep.wOff); rep.offFb = v;
      pop(v[0], car.x, car.y, v[1]);
    }
    // Every move also shows (and a juke also cuts) even outside a tackle rep.
    if (move === "juke") { car.cut = 0.35; car.cutDir = jdir; }
    anim(car, move === "juke" ? "juke" : move, 0.4);
  }

  function controls(team) {
    if (!G.human[team]) return;
    const car = carrier(), b = G.ball, pl = G.play, d = INPUT.dir(team);
    let p = G.control[team];
    if (car && car.team === team) {
      p = G.control[team] = car;
      const pocketQB = car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed;
      if (pocketQB) {
        if (INPUT.pressed(team, "x") && G.receivers.length) G.target = (G.target + 1) % G.receivers.length;
        if (INPUT.pressed(team, "z") && pl.t > 0.25 && G.receivers.length) { throwBall(car, G.receivers[G.target]); return; }
        if (d.any) { setVel(car, d.dx, d.dy, 0.9); car.manual = true; }
        return;
      }
      if (car.role === "QB" && pl.type === "run" && !pl.handed) return;
      return carrierControls(team, car);
    }
    if (b.state === "air" && b.intended && b.intended.team === team) {
      p = G.control[team] = b.intended;
      if (INPUT.pressed(team, "z") && b.offT == null) { b.offT = b.t; const v = verdict(b.t, b.ideal, b.wOff); b.offFb = v; pop(v[0], p.x, p.y, v[1]); anim(p, "catch", 0.4); }
      return;
    }
    // Tackling side: move with the D-pad, X switches, Z is the timed tackle (or a timed jump at a ball in the air).
    if (!p || p.team !== team) p = G.control[team] = nearestTo(team, b, null, true);
    if (INPUT.pressed(team, "x")) {
      const target = car || (b.state === "air" ? { x: b.tx, y: b.ty } : b);
      const n = nearestTo(team, target, p, true); if (n) p = G.control[team] = n;
    }
    if (!p || p.down > 0) return;
    if (INPUT.pressed(team, "z")) {
      if (b.state === "air") {
        if (Math.hypot(p.x - b.tx, p.y - b.ty) < 10 && b.defT == null) {
          b.defT = b.t; b.defP = p; p.jump = b.T - b.t + 0.2;
          const v = verdict(b.t, b.ideal, windowFor(p.r.cov)); b.defFb = v; pop(v[0], p.x, p.y, v[1]);
        }
      } else {
        const rep = G.rep;
        if (rep && rep.def === p && rep.defT == null) {
          // In a tackle rep: the timed press, plus a lunge that closes the last yard or so (tackle assist).
          rep.defT = pl.t; const v = verdict(rep.defT, rep.ideal, rep.wDef); rep.defFb = v; pop(v[0], p.x, p.y, v[1]);
          p.lungeT = K.LUNGE_TIME; anim(p, "lunge", 0.3);
        } else if (car && !rep && dist(p, car) < K.DIVE_RANGE && p.repCd <= 0) {
          // Close but no rep yet: a diving tackle. It counts, but without perfect rhythm.
          G.rep = { car, def: p, t0: pl.t, tc: pl.t + 0.2, ideal: pl.t + 0.08, wOff: windowFor(skill(car)), wDef: windowFor(p.r.tkl),
            offT: null, defT: pl.t, defQ: K.DIVE_Q, move: null, jdir: 0, dive: true };
          if (!G.human[car.team]) G.rep.cpuMove = Math.random() < K.CPU_MOVE ? bestMove(car, p) : null;
          p.lungeT = K.LUNGE_TIME; anim(p, "lunge", 0.3); pop("DIVE!", p.x, p.y, "#ffb627");
        } else if (car && !rep) {
          if (G.time - (G.lastFar || 0) > 0.8) { pop("TOO FAR", p.x, p.y, "#ef5a45"); G.lastFar = G.time; ST().myTooFar = (ST().myTooFar || 0) + 1; }
          G.lastZ[team] = pl.t; // pressed just before a rep starts still counts (it'll be early)
        }
      }
    }
    // Tackle assist: the lunge drives straight at the ball carrier...
    if (p.lungeT > 0 && car) {
      const l = dist(p, car) || 1;
      setVel(p, (car.x - p.x) / l, (car.y - p.y) / l, K.LUNGE_SPEED); p.manual = true; return;
    }
    // ...and when you're steering roughly at him, your angle gets bent toward where he's going.
    // Otherwise it's full control: your defender only moves when you press.
    if (d.any) {
      let dx = d.dx, dy = d.dy;
      if (car && dist(p, car) < K.ASSIST_RANGE) {
        const lead = Math.min(dist(p, car) / p.spd, 0.8);
        const tx = car.x + car.vx * lead - p.x, ty = car.y + car.vy * lead - p.y, tl = Math.hypot(tx, ty) || 1;
        const m = Math.hypot(dx, dy) || 1;
        if ((dx * tx + dy * ty) / (m * tl) > 0.4) { // aiming within about 65 degrees of him
          const w = K.ASSIST;
          dx = dx / m * (1 - w) + tx / tl * w; dy = dy / m * (1 - w) + ty / tl * w;
          const n = Math.hypot(dx, dy) || 1; dx = dx / n * m; dy = dy / n * m;
        }
      }
      setVel(p, dx, dy, 1.05);
    } else { p.vx = p.vy = 0; }
    p.manual = true;
  }

  // ---------- AI ----------
  function runRoute(p, mul) {
    if (!p.route || p.ri >= p.route.length) return false;
    const t = p.route[p.ri];
    // Route running: sharper routes keep full speed through the break.
    const d = seek(p, t.x, t.y, (mul || 1) * (0.9 + 0.1 * p.r.route / 99));
    if (d < 0.8) { p.lastDx = p.vx; p.lastDy = p.vy; p.ri++; }
    return true;
  }
  function afterRoute(p) {
    if (p.routeName === "CURL" || p.routeName === "STICK") { p.vx = p.vy = 0; return; }
    const l = Math.hypot(p.lastDx || 1, p.lastDy || 0) || 1;
    setVel(p, (p.lastDx || 1) / l, (p.lastDy || 0) / l, 0.75);
    if (p.y < 2 || p.y > W - 2) p.vy = 0;
  }

  function aiCarrier(p) {
    const pl = G.play;
    if (p.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed) {
      if (pl.t < 0.7) return seek(p, G.los - 6, p.y, 0.8);
      if (G.human[p.team]) { p.vx = p.vy = 0; return; }
      return cpuQB(p);
    }
    if (p.role === "QB" && pl.type === "run" && !pl.handed) { const rb = byId("RB"); return seek(p, rb.x + 0.4, rb.y, 0.9); }
    if (p.route && p.ri < p.route.length && p.x < G.los + 2 && p.team === G.poss) return runRoute(p);
    // Open-field running: head for the end zone and slip past tacklers. A juke adds a hard cut.
    const dirX = dirOf(p);
    let dx = dirX, dy = 0;
    for (const o of G.players) {
      if (o.team === p.team || o.down > 0) continue;
      const ex = o.x - p.x, ey = o.y - p.y, d = Math.hypot(ex, ey);
      if (d > 7 || ex * dirX < -1.5) continue;
      const w = (7 - d) / 7;
      dy += -(Math.sign(ey) || 1) * w * 0.9;
      dx -= dirX * w * 0.25;
    }
    if (p.cut > 0) { dy += p.cutDir * 2.2; dx = dirX * 0.6; }
    if (p.y < 4) dy += 0.9; if (p.y > W - 4) dy -= 0.9;
    const l = Math.hypot(dx, dy) || 1;
    setVel(p, dx / l, dy / l, 1);
  }

  function openness(r) {
    let m = 99;
    for (const o of G.players) if (o.team !== r.team) m = Math.min(m, dist(o, r));
    const depth = r.x - G.los;
    const st = teamOf(r.team).style, sb = st.short; // how much this team's QB prefers the short throw
    // Fog and wind: receivers heading deep are harder to trust. (Measured at the moment the QB decides,
    // when deep routes are usually 10+ yards out and still climbing.)
    const look = depth >= 10 ? WEATHER.get("deepLook") : 1;
    const q = qb();
    const starPull = has(r, "GLUE HANDS") ? 0.6 : has(r, "PRIME TIME") ? 0.8 : 0;   // the quarterback looks for his star
    const cannonPull = q && has(q, "CANNON") && depth >= 10 ? 0.35 : 0;           // a big arm trusts the deep ball
    return m * look + starPull + cannonPull + (depth < K.QB_SHORT ? (sb != null ? sb : K.QB_SHORT_BONUS) : 0) + (depth >= 15 ? (st.deep || 0) : 0);
  }

  function cpuQB(q) {
    const pl = G.play;
    q.vx = q.vy = 0;
    const pressure = G.players.some(o => o.team !== q.team && o.down <= 0 && dist(o, q) < 2.8);
    if (pl.scramble) {
      pl.crossed = q.x > G.los;
      let near = null, nd = 99;
      for (const o of G.players) { if (o.team === q.team || o.down > 0) continue; const d = dist(o, q); if (d < nd) { nd = d; near = o; } }
      const away = near ? (q.y > near.y ? 1 : -1) : 0;
      // first get outside the rush, then turn upfield
      const out = pl.t - (pl.scrambleT || pl.t) < 0.35;
      return setVel(q, out ? 0.35 : 1, out ? away : away * 0.4, 1);
    }
    // Under pressure the quarterback needs a moment to react: sometimes he gets it off, sometimes he's sacked.
    if (pressure && pl.pressureAt == null) {
      pl.pressureAt = pl.t + Math.max(0.08, K.QB_REACT + gauss() * 0.15);
      // Mobile quarterbacks feel the rush and take off right away instead of freezing.
      const scr = teamOf(q.team).style.scramble || 0;
      // ...but only if he has room to get out (no second rusher right on him).
      const crowd = G.players.filter(o => o.team !== q.team && o.down <= 0 && dist(o, q) < 4.5).length;
      if (scr > 0.4 && crowd <= 1 && Math.random() < scr * K.SCRAMBLE_EARLY) { pl.scramble = true; pl.scrambleT = pl.t; return; }
    }
    const reacting = pl.pressureAt != null && pl.t < pl.pressureAt;
    if (!reacting && (pl.t > pl.cpuThrowAt || pl.pressureAt != null)) {
      const best = G.receivers.map(r => ({ r, s: openness(r) })).sort((a, b) => b.s - a.s)[0];
      if (best && (best.s > 2.2 || pl.t > 3.3 || pressure)) {
        const scr = teamOf(q.team).style.scramble || 0.35;
        if (best.s < 1.2 && Math.random() < scr && pressure) { pl.scramble = true; pl.scrambleT = pl.t; return; } // nobody open: take off
        throwBall(q, best.r);
      }
    }
  }

  function block(p, car) {
    const a = p.assign;
    if (a && a.down <= 0 && dist(a, car) < 14 && !(a.engaged > 0 && dist(a, p) > 1.5)) {
      return seek(p, a.x + (car.x - a.x) * 0.15, a.y + (car.y - a.y) * 0.15, 1);
    }
    let opp = null, bd = 1e9;
    for (const o of G.players) {
      if (o.team === p.team || o.down > 0 || o.engaged > 0) continue;
      if (dist(o, car) > 12) continue;
      const d = dist(o, p); if (d < bd) { bd = d; opp = o; }
    }
    if (!opp) return seek(p, car.x + dirOf(car) * 4, p.y, 0.7);
    seek(p, opp.x + (car.x - opp.x) * 0.2, opp.y + (car.y - opp.y) * 0.2, 1);
  }

  function passBlock(p) {
    const q = qb();
    let opp = null, bd = 1e9;
    for (const o of G.players) { if (o.side !== "def" || o.role !== "DL") continue; const d = dist(o, p); if (d < bd) { bd = d; opp = o; } }
    if (!opp) return seek(p, p.x0 - 1.5, p.y0, 0.5);
    const l = dist(opp, q) || 1;
    seek(p, opp.x + (q.x - opp.x) / l * 0.9, opp.y + (q.y - opp.y) / l * 0.9, 0.9);
  }

  function pursue(p, car, mul) {
    const d = dist(p, car);
    const lead = Math.min(d / p.spd, 1.2) * 0.7;
    seek(p, car.x + car.vx * lead, car.y + car.vy * lead, (mul || 1) * 1.06);
  }

  function aiMove(p) {
    const car = carrier(), b = G.ball, pl = G.play;
    if (car === p) return aiCarrier(p);
    if (car && G.rep && G.rep.def === p) return seek(p, car.x, car.y, 1.1); // committed to the tackle
    if (pl.type === "pass" && !pl.thrown && car && car.role === "QB" && !pl.crossed) {
      if (p.side === "off") { if (p.route) { if (!runRoute(p)) afterRoute(p); return; } return passBlock(p); }
      if (p.role === "DL") return pursue(p, car, 1);
      if (p.role === "CB") {
        // Coverage vs route running decides how much cushion the receiver gets.
        // The corner reacts to where the receiver WAS a moment ago (longer for better route runners),
        // keeping a cushion. That gap is the separation a quarterback throws into.
        return coverMan(p, byId(p.man));
      }
      if (p.role === "LB") {
        let near = null, nd = 12;
        for (const r of G.receivers) { const d = Math.hypot(r.y - p.y0, (r.x - G.los) * 0.5); if (d < nd && r.x < G.los + 12) { nd = d; near = r; } }
        if (near) { // zone: react late and keep a cushion, like the corners
          const h = near.hist || [], delay = Math.round(60 * (K.COV_LAG + K.LB_EXTRA_LAG));
          const i = Math.max(0, h.length / 2 - 1 - delay) * 2;
          const tx = h.length ? h[i] : near.x, ty = h.length ? h[i + 1] : near.y;
          return seek(p, clamp(tx + K.LB_CUSHION, G.los + 1, G.los + 12), ty, 0.9);
        }
        return seek(p, G.los + 6, p.y0, 0.85);
      }
      const deep = G.receivers.reduce((a, r) => (!a || r.x > a.x ? r : a), null);
      return seek(p, G.los + 14, C + (deep ? clamp(deep.y - C, -8, 8) : 0), 0.85);
    }
    if (b.state === "air") {
      if (p === b.intended) return seek(p, b.tx, b.ty, 1);
      if (p.side === "def") {
        // Defenders need a beat to read the throw, then break on the receiver, not a magic landing spot.
        const r = b.intended, near = Math.hypot(p.x - b.tx, p.y - b.ty) < (p.role === "LB" ? K.DEF_BREAK * 0.65 : K.DEF_BREAK);
        // The man covering the target trails him; others break on the ball only if they're close.
        if (p.role === "CB" && p.man === r.id) return coverMan(p, r);
        if (b.t < K.DEF_READ || !near) return seek(p, (p.x + b.tx) / 2, (p.y + b.ty) / 2, 0.45);
        return seek(p, b.tx, b.ty, 0.75 + 0.15 * p.r.cov / 99);
      }
      if (p.route) { if (!runRoute(p)) afterRoute(p); return; }
      return seek(p, b.tx, b.ty, 0.6);
    }
    if (!car) { p.vx = p.vy = 0; return; }
    if (p.team !== car.team) {
      if (pl.type === "run" && !pl.handed && (p.role === "CB" || p.role === "S")) return seek(p, p.x0 - 1, p.y0 + (car.y - p.y0) * 0.3, 0.6);
      if (pl.type === "run" && pl.t < K.LB_READ && p.role === "LB") return seek(p, p.x0, p.y0 + (car.y - p.y0) * 0.3, 0.4); // linebackers read first
      return pursue(p, car, 1);
    }
    if (pl.type === "run" && !pl.handed && p.route) return runRoute(p);
    return block(p, car);
  }

  // The corner reacts to where the receiver WAS a moment ago (longer for better route runners),
  // keeping a cushion. That gap is the separation a quarterback throws into.
  function coverMan(p, r) {
    const h = r.hist || [];
    const delay = Math.round(60 * clamp(K.COV_LAG + 0.25 * (r.r.route - p.r.cov) / 30, 0.08, 0.6));
    const i = Math.max(0, h.length / 2 - 1 - delay) * 2;
    const tx = h.length ? h[i] : r.x, ty = h.length ? h[i + 1] : r.y;
    return seek(p, tx + K.COV_CUSHION, ty, 0.97);
  }

  // Which way a player looks: defenders in coverage keep their eyes on the quarterback (backpedal),
  // the pocket QB looks downfield, movers face where they're going, and anyone standing still faces the ball.
  function faceFor(p) {
    const pl = G.play, b = G.ball, speed = Math.hypot(p.vx, p.vy);
    if (p.role === "QB" && p.side === "off" && pl && pl.type === "pass" && !pl.thrown && !pl.crossed) return 1;
    // Cover men backpedal with eyes on the QB, then turn and run once the receiver gets on top of them.
    if (p.side === "def" && pl && pl.type === "pass" && !pl.thrown && p.role !== "DL" && speed < 5.2) return -1;
    if (speed > 0.8 && Math.abs(p.vx) > 0.4) return p.vx > 0 ? 1 : -1;
    if (b) { const bx = b.state === "air" ? b.tx : b.x; if (Math.abs(bx - p.x) > 0.3) return bx > p.x ? 1 : -1; }
    return p.face || 1;
  }

  // ---------- passing ----------
  function throwBall(q, r) {
    const deep = r.x - q.x >= 13;
    const cannon = has(q, "CANNON") && deep;
    const clutch = has(q, "CLUTCH") && (G.down >= 3 || (G.quarter >= 4 && G.score[q.team] <= G.score[other(q.team)]));
    const speed = (15 + q.r.pow * K.POWER_SPEED) * (cannon ? 1.25 : 1);
    let T = dist(q, r) / speed;
    let tx = r.x + r.vx * T, ty = r.y + r.vy * T;
    T = Math.hypot(tx - q.x, ty - q.y) / speed;
    tx = r.x + r.vx * T; ty = r.y + r.vy * T;
    // Accuracy: every quarterback's throws wander a little, more on long balls and for lower ratings.
    let miss = K.ACC_MISS * (0.3 + (cannon ? Math.min(T, 0.6) : T) * 0.9) * (1.55 - Math.min(99, q.r.acc + (clutch ? 14 : 0)) / 100);
    if (cannon) powerPop(q, "CANNON!"); else if (clutch) powerPop(q, "CLUTCH!");
    // Throwing with a rusher in your face: the ball comes out less accurate.
    if (G.players.some(o => o.team !== q.team && o.down <= 0 && dist(o, q) < 3)) miss *= K.PRESSURE_MISS;
    miss *= WEATHER.get("miss"); if (tx - G.los >= 15) miss *= WEATHER.get("deepMiss");
    tx += gauss() * miss; ty += gauss() * miss;
    ty = clamp(ty, 0.6, W - 0.6);
    T = Math.max(0.25, T);
    G.ball = { state: "air", fx: q.x, fy: q.y, tx, ty, t: 0, T, h: 0.8 + T * 2.4, intended: r, x: q.x, y: q.y, z: 1,
      ideal: T - K.IDEAL_LEAD, wOff: windowFor(r.r.catch) * (clutch ? 1.5 : 1), offT: null, defT: null, defP: null, cannon };
    G.play.thrown = true; bump("att"); G.play.passer = q; pst(q).att++;
    bump("tgtDepth", tx - G.los); if (tx - G.los >= 15) bump("deepAtt");
    let sep = 99; for (const o of G.players) if (o.team !== r.team) sep = Math.min(sep, dist(o, r));
    G.play.sepAtThrow = sep;
    anim(q, "throw", 0.42);
  }

  function resolveCatch() {
    const b = G.ball, spot = { x: b.tx, y: b.ty };
    const offT = G.poss, defT = other(offT);
    const near = (team, skip) => G.players
      .filter(p => p.team === team && p.down <= 0 && !(skip && skip(p)))
      .map(p => ({ p, d: dist(p, spot) })).sort((a, c) => a.d - c.d)[0];
    const r = near(offT, p => p.role === "OL" || p.role === "QB");
    let d = near(defT);
    // Ball Hawk: a pass within 4 yards of him and he's there, jumping the route.
    const hawk = G.players.find(p => p.team === defT && has(p, "BALL HAWK") && p.down <= 0 && dist(p, spot) < 5);
    if (hawk && (!d || d.p !== hawk)) { d = { p: hawk, d: Math.min(dist(hawk, spot), K.CC_RADIUS * 0.9) }; hawk.x += (spot.x - hawk.x) * 0.7; hawk.y += (spot.y - hawk.y) * 0.7; }
    // Glue Hands reaches for (and hauls in) throws a normal receiver couldn't get to.
    const rOk = r && r.d < (has(r.p, "GLUE HANDS") ? 2.3 : 1.8), contested = d && d.d < K.CC_RADIUS;
    const dropOut = () => { anim(r.p, "catch", 0.45); bump("drops"); incomplete("DROPPED!", "drop", r.p); };
    if (!rOk && !contested) return incomplete("INCOMPLETE", "miss");
    if (rOk && !contested) {
      if (!has(r.p, "GLUE HANDS") && Math.random() < (K.DROP_BASE + K.DROP_SCALE * (1 - r.p.r.catch / 100)) * WEATHER.get("drop")) return dropOut();
      if (has(r.p, "GLUE HANDS") && r.d >= 1.8) { completeTo(r.p, "GLUE HANDS!"); anim(r.p, "dive", 0.4); return; }
      return completeTo(r.p, null);
    }
    // ----- contested: a hidden rep, positive favors the receiver -----
    bump("contested"); ST()["cc_" + d.p.role] = (ST()["cc_" + d.p.role] || 0) + 1; ST().ccT = (ST().ccT || 0) + b.T;
    const defP = d.p, rec = rOk ? r.p : null;
    const humanDef = G.human[defT] && G.control[defT] === defP;
    const humanRec = rec && G.human[offT] && G.control[offT] === rec;
    const qo = rec ? (humanRec ? (quality(b.offT, b.ideal, b.wOff) ?? 0) : cpuQ(rec.r.catch)) : 0;
    const qd = humanDef ? (b.defP === defP ? quality(b.defT, b.ideal, windowFor(defP.r.cov)) : -0.5) : cpuQ(defP.r.cov);
    const offR = rec ? (rec.r.catch + rec.r.route) / 2 : defP.r.cov;
    const sep = rec ? (d.d - r.d) * K.CC_SEP : 0;
    const green = (rec && qo >= 0.5 ? K.GREEN : 0) - (qd >= 0.5 ? K.GREEN : 0);
    let s = K.CC_BIAS + K.CC_TIMING * (qo - qd) + green + K.CC_RATING * (offR - defP.r.cov) / 30 + sep + gauss() * K.CC_SIGMA;
    if (!rec) s -= K.CC_ERRANT; // nobody there to catch it: a defender can still jump the bad throw
    if (rec && has(rec, "GLUE HANDS")) s += 0.8;
    if (has(defP, "BALL HAWK")) s -= 0.85;
    s = clamp(Math.round(s * 10) / 10, -2, 2);
    ST().ccScores.push(s);
    if (s <= K.CC_INT) { // pick
      G.ball = { state: "held", holder: defP, x: defP.x, y: defP.y, z: 1 };
      G.control[defT] = defP; G.control[offT] = nearestTo(offT, defP);
      anim(defP, "catch", 0.4); shake(0.2); bump("ints"); pst(defP).ints++;
      if (has(defP, "BALL HAWK")) powerPop(defP, "BALL HAWK!");
      bigPlay(defP); badPlay(qb());
      banner("INTERCEPTED!", "", 1.4, CFG.TEAMS[defT].trim); event("int", { team: defT });
      return;
    }
    if (s <= 0.0 || !rec) { // swat (and a dead tie is knocked loose)
      anim(defP, "catch", 0.35); bump("swats");
      if (rec) anim(rec, "catch", 0.4); // the receiver reached for it...
      const swat = s <= -0.1 || !rec;
      return incomplete(swat ? "SWATTED!" : "KNOCKED LOOSE!", swat ? "swat" : "drop", swat ? defP : rec);
    }
    bump("contestedCatches");
    if (has(rec, "GLUE HANDS")) powerPop(rec, "GLUE HANDS!");
    if (s < K.CC_MOSS) { completeTo(rec, null); return tackle(rec, defP, "contested"); } // caught, but drilled right away
    defP.down = 1.0; anim(defP, "fall", 0.4); fx("dust", defP.x, defP.y);
    completeTo(rec, "MOSSED!");
  }

  function completeTo(rec, shout) {
    G.ball = { state: "held", holder: rec, x: rec.x, y: rec.y, z: 1 };
    rec.route = null; G.control[G.poss] = rec; anim(rec, "catch", 0.35);
    bump("comp"); bump("touches"); G.play.caughtAt = rec.x; pst(rec).rec++; if (G.play.passer) pst(G.play.passer).comp++; bump("airYds", rec.x - G.play.startLos);
    if (G.play.sepAtThrow != null) bump("sepSum", G.play.sepAtThrow);
    if (shout) banner(shout, "", 1, "#7fd68f");
    event("catch", { team: G.poss });
  }

  // What the ball does when a pass isn't caught, so the play reads right without any buttons:
  //  "miss"  no one there: it keeps going and skips along the turf
  //  "swat"  batted: it pops up and away off the defender's hands, then bounces
  //  "drop"  it hits the receiver's hands and falls at his feet
  function incomplete(text, kind, who) {
    const b = G.ball;
    banner(text, "", 1.3, "#f3efe4");
    const fwd = (b.tx - b.fx) / Math.max(0.3, b.T);
    if (!who) kind = "miss";
    if (kind === "swat") {
      // Batted off the raised hands: it leaves fast, high and sideways, with a little burst where it was hit.
      const away = -Math.sign(fwd || 1);
      loose(who.x + away * 0.5, who.y, away * rnd(5, 7), rnd(-3.5, 3.5), rnd(8, 10), 7.5);
      fx("spark", who.x, who.y);
    }
    else if (kind === "drop") { loose(who.x + 0.4 * (who.face || 1), who.y, rnd(-1.2, 1.2), rnd(-1.2, 1.2), 3, 7); fx("spark", who.x, who.y); }
    else { loose(b.tx, b.ty, fwd * 0.3, (b.ty - b.fy) / Math.max(0.3, b.T) * 0.3, 3.5, 0.5); fx("dust", b.tx, b.ty); }
    b.state = "dead";
    endPlay({ type: "inc" });
  }

  // A loose ball with simple bounce physics (yards on the field, z = height). Drawn instead of the normal ball.
  function loose(x, y, vx, vy, vz, z) { G.loose = { x, y, z: z || 1, vx, vy, vz, t: 0 }; }
  function updateLoose(dt) {
    const l = G.loose; if (!l) return;
    l.t += dt; l.vz -= 26 * dt;
    l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt;
    if (l.z <= 0) {
      l.z = 0;
      if (l.vz < -2) { l.vz = -l.vz * 0.45; l.vx *= 0.6; l.vy *= 0.6; fx("dust", l.x, l.y); }
      else { l.vz = 0; l.vx *= 0.9; l.vy *= 0.9; }
    }
  }

  function updateBall(dt) {
    const b = G.ball;
    if (b.state === "held") { const h = b.holder; b.x = h.x + 0.35 * h.face; b.y = h.y; b.z = 1; }
    else if (b.state === "air") {
      b.t += dt; const k = Math.min(1, b.t / b.T);
      b.x = b.fx + (b.tx - b.fx) * k; b.y = b.fy + (b.ty - b.fy) * k; b.z = 1 + b.h * 4 * k * (1 - k);
      // the computer's defender also leaps for a ball near him
      if (k >= 1) resolveCatch();
    }
  }

  // ---------- blocking ----------
  function engageBlocks() {
    const car = carrier(); if (!car) return;
    for (const p of G.players) {
      if (p === car || p.team !== car.team || p.engaged > 0 || p.blockCd > 0 || p.down > 0) continue;
      if (p.route && p.ri < p.route.length) continue;
      for (const o of G.players) {
        if (o.team === p.team || o.engaged > 0 || o.down > 0 || o.blockCd > 0) continue;
        if (dist(p, o) > 0.95) continue;
        const line = p.role === "OL" && o.role === "DL";
        // Blocking ratings: the lineman's hold vs the rusher's shed decide how long the block lasts.
        const base = G.play.type === "run" ? K.RUN_BLOCK : K.BLOCK_BASE;
        // On runs, the whole line wins or loses together (one hidden "hole" roll per play), so some runs
        // get blown up in the backfield and some spring a big gain.
        const spread = G.play.type === "run" ? G.play.hole * K.RUN_HOLE + rnd(-0.4, 0.4) : rnd(-0.8, 0.9);
        const t = line ? clamp(base + K.BLOCK_RATING * (p.r.blk - o.r.blk) / 30 + spread, G.play.type === "run" ? 0.3 : 0.6, 4.8)
                       : clamp(0.9 + 0.6 * (p.r.blk - o.r.blk) / 30 + (G.play.type === "run" ? G.play.hole * 0.5 : 0) + rnd(-0.4, 0.5), 0.3, 2.6);
        let tt = t;
        if (line && G.play.type === "pass" && has(o, "HEAT SEEKER")) { tt = Math.max(0.47, t * 0.8); o.heat = true; } // beats his man faster (never instantly)
        p.engaged = o.engaged = tt; p.blockCd = o.blockCd = tt + (line ? 0.4 : 1.2);
        break;
      }
    }
  }

  // ---------- tackle reps ----------
  // When a defender closes on the ball carrier, a "rep" starts with a contact time. Both sides can
  // press their button (skill move / tackle) during it; the timing, the ratings and some luck give a
  // hidden score from -2 (defender wins big) to +2 (runner wins big).
  function checkReps() {
    const car = carrier(); if (!car) return;
    const pl = G.play;
    const pocket = car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed && !pl.scramble;
    if (pl.type === "run" && !pl.handed && car.role === "QB") {
      // a defender in the backfield before the handoff just tackles the quarterback
      for (const p of G.players) if (p.team !== car.team && p.down <= 0 && p.engaged <= 0 && dist(p, car) < 0.8) return tackle(car, p, "tfl");
      return;
    }
    for (const p of G.players) {
      if (p.team === car.team || p.down > 0 || p.engaged > 0) continue;
      // Tornado: the first rusher to reach him gets spun past (most of the time), and he's free to throw or run.
      if ((pocket || (car.role === "QB" && !pl.thrown)) && has(car, "TORNADO") && !pl.tornado && dist(p, car) < 1.1) {
        pl.tornado = true;
        if (Math.random() < 0.8) { p.down = 0.7; anim(p, "fall", 0.4); fx("dust", p.x, p.y); anim(car, "juke", 0.35); powerPop(car, "TORNADO!"); continue; }
      }
      // Pocket QB: an automatic sack on contact, unless he's a mobile QB, who gets a tackle rep to slip it.
      if (pocket && !(teamOf(car.team).style.scramble > 0.4)) { if (dist(p, car) < 0.9) return tackle(car, p, "sack"); continue; }
      if (G.rep) continue;
      if (p.repCd > 0) continue;
      const d = dist(p, car);
      const mine = G.human[p.team] && G.control[p.team] === p;
      if (d > (mine ? K.HUMAN_REP_RANGE : 2.4)) continue;
      const rvx = car.vx - p.vx, rvy = car.vy - p.vy;
      const closing = -((car.x - p.x) * rvx + (car.y - p.y) * rvy) / (d || 1);
      if (closing < 0.8 && d > 1.0) continue;
      const tc = pl.t + clamp((d - 0.5) / Math.max(closing, 2), 0.32, 0.75);
      const rep = G.rep = {
        car, def: p, t0: pl.t, tc, ideal: tc - K.IDEAL_LEAD,
        wOff: windowFor(skill(car)), wDef: windowFor(p.r.tkl),
        offT: null, defT: null, move: null, jdir: 0,
      };
      // presses made just before the rep began still count (they'll just be early)
      if (G.human[p.team] && G.control[p.team] === p && pl.t - G.lastZ[p.team] < 0.3) rep.defT = G.lastZ[p.team];
      // the computer decides now whether its runner will try a move
      if (!G.human[car.team]) rep.cpuMove = Math.random() < K.CPU_MOVE ? bestMove(car, p) : null;
      return;
    }
  }

  function bestMove(car, def) {
    const headOn = Math.abs(def.y - car.y) < 1.2;
    const score = { juke: car.r.juke + (headOn ? 6 : 0), stiff: car.r.stiff + (headOn ? 0 : 6), truck: car.r.truck + (def.role === "CB" || def.role === "S" ? 6 : 0) };
    return Object.keys(score).sort((a, b) => score[b] - score[a])[0];
  }

  function moveBonus(move, car, def) {
    if (!move) return 0;
    const headOn = Math.abs(def.y - car.y) < 1.2;
    if (move === "juke") return headOn ? 0.15 : 0;
    if (move === "stiff") return headOn ? 0 : 0.15;
    if (move === "truck") return (def.role === "CB" || def.role === "S" || def.role === "CV") ? 0.2 : -0.1;
    return 0;
  }

  function resolveRep() {
    const rep = G.rep, pl = G.play;
    if (!rep || pl.t < rep.tc) return;
    const car = rep.car, def = rep.def;
    if (carrier() !== car || def.down > 0) { G.rep = null; return; }
    // Contact has to actually happen: give the defender a moment to close, otherwise he whiffed on air.
    const reach = def.lungeT > 0 || rep.defT != null ? K.TK_REACH + 0.9 : K.TK_REACH;
    if (dist(def, car) > reach) {
      if (pl.t < rep.tc + 0.3) return;
      G.rep = null; def.repCd = 0.5;
      if (G.human[def.team] && G.control[def.team] === def) { pop("MISSED!", def.x, def.y, "#ef5a45"); ST().myWhiffs = (ST().myWhiffs || 0) + 1; }
      return;
    }
    G.rep = null;
    const humanOff = G.human[car.team] && G.control[car.team] === car;
    const humanDef = G.human[def.team] && G.control[def.team] === def;
    // offense timing and rating
    let move, qo;
    if (humanOff) { move = rep.move; qo = move ? quality(rep.offT, rep.ideal, rep.wOff) : K.NO_MOVE_Q; }
    else { move = rep.cpuMove; qo = move ? cpuQ(car.r[move]) : K.NO_MOVE_Q; if (move) anim(car, move === "juke" ? "juke" : move, 0.35); }
    const rOff = move ? car.r[move] : car.r.bt;
    // defense timing
    const qd = humanDef ? (rep.defQ != null ? rep.defQ : rep.defT != null ? quality(rep.defT, rep.ideal, rep.wDef) : -0.5) : cpuQ(def.r.tkl);
    // gang tackles: a second defender right there helps
    const help = G.players.some(o => o !== def && o.team === def.team && o.down <= 0 && o.engaged <= 0 && dist(o, car) < 1.3) ? -0.35 : 0;
    // Landing in the green earns an extra bonus on top of the timing difference.
    const green = (move && qo >= 0.5 ? K.GREEN : 0) - (qd >= 0.5 ? K.GREEN : 0);
    let s = K.TK_BIAS + K.TK_TIMING * (qo - qd) + green + K.TK_RATING * (rOff - def.r.tkl) / 30 + moveBonus(move, car, def) + help + gauss() * K.TK_SIGMA;
    s += WEATHER.get("brk", G.quarter); // heat and soaked fields wear tacklers down late
    let power = null;
    if (has(car, "FREIGHT TRAIN") && Math.abs(def.y - car.y) < 1.5 && car.vx * dirOf(car) > 0) { s += 0.28; power = "FREIGHT TRAIN!"; }
    if (has(car, "GHOST") && !pl.ghost) { pl.ghost = true; if (qd < 0.9) { s += 0.8 * (K.TK_TIMING * (1 - Math.max(qo, 0)) + K.GREEN); power = "GHOST!"; } }
        s = clamp(Math.round(s * 10) / 10, -2, 2);
    bump("tackleReps"); ST().repScores.push(s);
    if (humanDef) { ST().myReps = (ST().myReps || 0) + 1; if (s <= -0.2) ST().myTackles = (ST().myTackles || 0) + 1; }
    ST()["repsVs" + car.team] = (ST()["repsVs" + car.team] || 0) + 1;
    if (s >= 0.2) ST()["brokeBy" + car.team] = (ST()["brokeBy" + car.team] || 0) + 1;
    def.repCd = 0.6;
    if (s <= -0.2) return tackle(car, def, "rep", s);
    if (s >= 0.2) { if (power) powerPop(car, power); return breakFree(car, def, s, power === "FREIGHT TRAIN!" ? "truck" : move, rep.jdir); }
    // -0.1, 0 or 0.1: a dead heat → mash battle (shown when a human is involved, simulated otherwise)
    bump("mashes");
    if (G.human[car.team] || G.human[def.team]) return startMash(car, def);
    return Math.random() < 0.5 + (car.r.bt - def.r.tkl) / 200 ? breakFree(car, def, 0.2, null, 0) : tackle(car, def, "rep", -0.2);
  }

  function breakFree(car, def, s, move, jdir) {
    bump("brokenTackles"); pst(car).broke++;
    if (car.role === "QB" && G.play && G.play.type === "pass" && !G.play.thrown) { G.play.scramble = true; G.play.scrambleT = G.play.t; }
    // The bigger the win, the less the hit slows the runner down.
    car.slowT = 0.6; car.slowMul = clamp(0.35 + 0.3 * s, 0.35, 0.97);
    def.down = 0.6 + 0.35 * s; anim(def, "fall", 0.4); fx("dust", def.x, def.y);
    if (move === "juke") { car.cut = 0.3; car.cutDir = jdir || (Math.random() < 0.5 ? -1 : 1); }
    if (move === "truck") { def.x += dirOf(car) * 1.2; shake(0.25); }
    const label = s >= 1.5 ? (move === "truck" ? "TRUCKED!" : move === "juke" ? "ANKLES BROKEN!" : move === "stiff" ? "STIFF-ARMED!" : "SHRUGGED OFF!")
      : move === "juke" ? "JUKE!" : move === "truck" ? "TRUCK!" : move === "stiff" ? "STIFF ARM!" : "BROKE A TACKLE!";
    pop(label, car.x, car.y, "#7fd68f");
    event("broke", { team: car.team, s });
  }

  // ---------- mash battle ----------
  function startMash(car, def) {
    G.mash = { car, def, meter: 0.5, pause: 0.5, t: 1.6 };
    car.vx = car.vy = def.vx = def.vy = 0;
    banner("MASH!", "", 0.9, "#ffb627");
  }
  function updateMash(dt) {
    const m = G.mash;
    if (m.pause > 0) { m.pause -= dt; return; } // half a second to get ready
    m.t -= dt;
    const push = (team, sign, rating) => {
      if (G.human[team]) {
        if (INPUT.pressed(team, "x")) m.meter += 0.055 * sign;
        if (INPUT.pressed(team, "z")) m.meter += 0.055 * sign;
      } else if (Math.random() < (K.CPU_MASH + 2 * (rating - 70) / 30) * dt) m.meter += 0.055 * sign;
    };
    push(m.car.team, has(m.car, "DAD STRENGTH") ? 2 : 1, m.car.r.bt); push(m.def.team, -1, m.def.r.tkl);
    m.meter = clamp(m.meter, 0, 1);
    if (m.t > 0) return;
    G.mash = null;
    if (m.meter > 0.5) { banner("BROKE FREE!", "", 0.9, "#7fd68f"); breakFree(m.car, m.def, 0.4, null, 0); }
    else tackle(m.car, m.def, "rep", -0.2);
  }

  // ---------- tackles ----------
  function tackle(car, by, kind, s) {
    // NFL rule: a quarterback brought down behind the line on a pass play is a sack, scramble or not.
    if (car.role === "QB" && G.play && G.play.type === "pass" && !G.play.thrown && car.x < G.los) kind = "sack";
    by.vx = by.vy = 0; car.vx = car.vy = 0;
    if (G.play && G.play.type === "run") { ST()["rt_" + by.role] = (ST()["rt_" + by.role] || 0) + 1; const g = car.x - G.play.startLos; ST()[g < 0 ? "rg_neg" : g < 3 ? "rg_0to3" : g < 6 ? "rg_3to6" : g < 10 ? "rg_6to10" : "rg_10plus"] = (ST()[g < 0 ? "rg_neg" : g < 3 ? "rg_0to3" : g < 6 ? "rg_3to6" : g < 10 ? "rg_6to10" : "rg_10plus"] || 0) + 1; }
    anim(car, "fall", 0.45); anim(by, "fall", 0.45);
    car.lying = by.lying = true;
    fx("dust", car.x, car.y); fx("dust", by.x, by.y);
    shake(kind === "sack" ? 0.35 : (s != null && s <= -1.5) ? 0.3 : 0.18);
    if (kind === "sack") pst(by).sacks++; else if (pst(by)) pst(by).tkl++;
    if (kind === "sack") { bump("sacks"); banner("SACK!", "", 1.3, CFG.TEAMS[by.team].trim); event("sack", { team: by.team }); bigPlay(by); badPlay(car); if (by.heat) powerPop(by, "HEAT SEEKER!"); }
    // Dad Strength: he drags the tackler a couple more yards before going down.
    if (kind !== "sack" && has(car, "DAD STRENGTH")) { const g = dirOf(car) * rnd(0.6, 1.4); car.x += g; by.x += g; powerPop(car, "DAD STRENGTH!"); }
    else if (s != null && s <= -1.5) pop("BIG HIT!", car.x, car.y, "#ef5a45");
    // Fumbles: rare, and likelier the bigger the defender's win.
    if (kind !== "sack") {
      let pf = K.FUMBLE_BASE + (s != null ? K.FUMBLE_BIG * Math.max(0, -s - 1) : 0);
      pf *= teamOf(by.team).flags.fumbleMul || 1;
      pf *= WEATHER.get("fum", G.quarter);
      if (has(by, "THE STRIP")) pf *= 4;
      if (teamOf(car.team).flags.noFumble) pf = 0;
      if (Math.random() < pf) {
        bump("fumbles");
        const lost = Math.random() < CFG.NFL.fumbleLostShare / 100;
        if (lost) bump("fumblesLost");
        banner("FUMBLE!", lost ? "RECOVERED BY " + CFG.TEAMS[by.team].short : "OFFENSE RECOVERS", 1.8);
        // The ball pops out and bounces; whoever recovers dives on top of where it ends up.
        const vx = rnd(-3, 3), vy = rnd(-3, 3);
        loose(car.x, car.y, vx, vy, rnd(5, 8), 1.5); G.ball.state = "dead";
        const recTeam = lost ? by.team : car.team;
        const rec = recTeam === car.team ? (G.players.filter(p => p.team === car.team && p !== car).sort((a, c) => dist(a, car) - dist(c, car))[0] || car) : by;
        if (rec !== car) { rec.x = car.x + vx * 0.5; rec.y = car.y + vy * 0.5; rec.lying = true; anim(rec, "dive", 0.4); }
        event("fumble", { lost, by: by.team });
        if (has(by, "THE STRIP")) powerPop(by, "THE STRIP!");
        if (lost) { bigPlay(by); badPlay(car); }
        return endPlay({ type: "tackle", x: car.x, carrierTeam: lost ? by.team : car.team });
      }
    }
    endPlay({ type: "tackle", x: car.x, carrierTeam: car.team, sack: kind === "sack" });
  }

  function checkBounds() {
    const car = carrier(); if (!car) return;
    if (car.team === G.poss && car.x >= 100) return touchdown(car.team);
    if (car.team !== G.poss && car.x <= 0) return touchdown(car.team);
    if (car.y < 0 || car.y > W) { banner("OUT OF BOUNDS", "", 1, "#f3efe4"); return endPlay({ type: "oob", x: car.x, carrierTeam: car.team }); }
  }

  // ---------- end of a play ----------
  function dead(secs, next) { G.phase = "dead"; G.deadT = secs; G.next = next; G.rep = null; }

  function recordYards(x) {
    const pl = G.play; if (!pl || pl.type === "return") return;
    const gain = x - pl.startLos, c = pst(pl.lastCar);
    if (c && pl.type === "run") { c.car++; c.rush += gain; }
    else if (c && pl.type === "pass" && pl.caughtAt != null) { c.recYds += gain; if (pl.passer) pst(pl.passer).passYds += gain; }
    else if (c && pl.type === "pass" && (pl.crossed || pl.scramble) && !pl.thrown) { c.car++; c.rush += gain; }
    if (pl.type === "run" && pl.handed) { bump("rushYds", gain); bump("touches"); }
    else if (pl.type === "run") bump("rushYds", gain); // tackled before the handoff
    else if (pl.type === "pass" && pl.caughtAt != null) { bump("passYds", gain); event("passGain", { team: G.poss, gain }); }
    else if (pl.type === "pass" && (pl.crossed || pl.scramble) && !pl.thrown) { bump("runs"); bump("dropbacks", -1); bump("scrambles"); bump("rushYds", gain); } // scramble counts as a run
  }

  function endPlay(r) {
    if (G.phase !== "live") return;
    const offT = G.poss, pl = G.play;
    G.mash = null; G.rep = null;
    if (r.type === "inc") { G.clockRunning = false; advanceDown(0); return dead(1.4, setupScrimmage); }
    const x = clamp(r.x, -9.9, 109.9);
    if (r.type === "oob") G.clockRunning = false;
    if (r.carrierTeam === offT && !r.sack) recordYards(x);
    const lc = pl.lastCar;
    if (lc && r.carrierTeam === offT && lc.team === offT && pl.type !== "return" && !r.sack) {
      const gain = x - pl.startLos;
      if (gain >= 15) bigPlay(lc); else if (gain < 0) badPlay(lc);
    }
    if (r.carrierTeam === offT) {
      if (pl.type === "return") { G.los = clamp(x <= 0 ? 20 : x, 1, 99); G.down = 1; G.togo = Math.min(10, 100 - G.los); }
      else if (x <= 0) return safety(offT);
      else { const old = G.los; G.los = clamp(x, 1, 99); advanceDown(G.los - old); }
    } else {
      G.clockRunning = false;
      let nl = 100 - x; if (nl <= 0) nl = 20;
      changePoss(r.carrierTeam, nl);
      if (pl.type !== "return") event("turnover", { team: r.carrierTeam });
    }
    dead(1.3, setupScrimmage);
  }

  function advanceDown(gain) {
    if (gain >= G.togo) {
      G.down = 1; G.togo = Math.min(10, 100 - G.los);
      if (G.play && G.play.type !== "return" && gain > 0) {
        banner("FIRST DOWN", "", 1, "#ffe14a");
        if (rallyLevel(G.poss) >= 0 && STARS.powerOf(teamOf(G.poss).id) === "THE CAPTAIN" && powersOn() && G.rally[G.poss] < 2) {
          G.rally[G.poss]++; const q = qb(); if (q) powerPop(q, "THE CAPTAIN: RALLY +" + 3 * G.rally[G.poss]);
        }
      }
      return;
    }
    G.togo = Math.round((G.togo - gain) * 10) / 10;
    G.down++;
    if (G.down > 4) { banner("TURNOVER ON DOWNS", "", 1.6, "#f3efe4"); changePoss(other(G.poss), 100 - G.los); }
  }

  function scored(team, secs) {
    if (G.ot) return dead(secs, () => gameOver());
    dead(secs, () => setupKickoff(team));
  }

  function touchdown(team) {
    if (G.phase !== "live") return;
    G.mash = null; G.rep = null; G.score[team] += 7; G.clockRunning = false;
    bump("points", 7, team); bump("tds", 1, team);
    if (team === G.poss) recordYards(100);
    { const scorer = team === G.poss ? G.play && G.play.lastCar : carrier(), sc = pst(scorer); if (sc) sc.tds++;
      if (team === G.poss && G.play && G.play.type === "pass" && G.play.caughtAt != null && G.play.passer) pst(G.play.passer).passTds++; }
    if (G.play && G.play.lastCar) bigPlay(G.play.lastCar);
    fireOut(other(team));
    event("td", { team, pickSix: team !== G.poss });
    G.celebrate = team; G.hype = 3; shake(0.3);
    banner("TOUCHDOWN!", CFG.TEAMS[team].name, 2.6, CFG.TEAMS[team].trim);
    scored(team, 2.6);
  }

  function safety(offT) {
    const defT = other(offT);
    G.score[defT] += 2; bump("points", 2, defT); G.clockRunning = false; fireOut(offT);
    banner("SAFETY!", "+2 " + CFG.TEAMS[defT].short, 2);
    event("safety", { team: defT });
    if (G.ot) return dead(2, () => gameOver());
    dead(2, () => setupKickoff(offT));
  }

  function endQuarter() {
    if (G.quarter === 2) {
      G.quarter = 3; G.clock = Q;
      banner("HALFTIME", CFG.TEAMS[1].short + " " + G.score[1] + " · " + CFG.TEAMS[2].short + " " + G.score[2], 2.5);
      return dead(2.5, () => setupKickoff(CFG.FIRST_RECEIVER));
    }
    if (G.quarter === 4) {
      if (G.score[1] === G.score[2]) {
        G.ot = true; G.quarter = 5; G.clock = 0;
        banner("OVERTIME", "NEXT SCORE WINS", 2.6);
        const k = Math.random() < 0.5 ? 1 : 2;
        return dead(2.6, () => setupKickoff(k));
      }
      return gameOver();
    }
    G.quarter++; G.clock = Q;
    banner("END OF Q" + (G.quarter - 1), "", 1.4, "#f3efe4");
    dead(1.4, G.next || setupScrimmage);
  }

  function gameOver() {
    G.phase = "over"; G.overT = 0; G.clockRunning = false;
    const w = G.score[1] === G.score[2] ? 0 : G.score[1] > G.score[2] ? 1 : 2;
    G.winner = w;
    banner("FINAL", w ? CFG.TEAMS[w].name + " WIN!" : "TIE GAME", 999);
  }

  // ---------- main update ----------
  function update(dt) {
    G.time = (G.time || 0) + dt;
    updateLoose(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.hype > 0) G.hype -= dt;
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    if (G.fireMsg) { G.fireMsg.t -= dt; if (G.fireMsg.t <= 0) G.fireMsg = null; }
    const tick = G.clockRunning && !G.ot && (G.phase === "live" || G.phase === "presnap" || G.phase === "dead");
    if (tick && G.clock > 0) G.clock = Math.max(0, G.clock - dt);
    if (G.phase === "live" || G.phase === "flight") dt *= CFG.ACTION_SPEED;
    switch (G.phase) {
      case "kick": return updateKick(dt);
      case "flight": return updateFlight(dt);
      case "presnap":
        if (G.clock <= 0 && !G.ot) { G.next = setupScrimmage; return endQuarter(); }
        return updatePresnap(dt);
      case "dead":
        G.deadT -= dt;
        if (G.deadT > 0) return;
        if (G.clock <= 0 && !G.ot) return endQuarter();
        { const n = G.next; G.next = null; return n(); }
      case "over": G.overT += dt; return;
      case "live": return updateLive(dt);
    }
  }

  function updateLive(dt) {
    const pl = G.play; pl.t += dt;
    if (G.mash) return updateMash(dt);
    for (const p of G.players) {
      p.manual = false;
      for (const k of ["engaged", "blockCd", "burst", "burstCd", "jump", "slowT", "cut", "repCd", "lungeT"]) if (p[k] > 0) p[k] -= dt;
    }
    controls(G.poss); controls(other(G.poss));
    for (const p of G.players) {
      if (p.down > 0) { p.down -= dt; p.vx = p.vy = 0; continue; }
      if (!p.manual) aiMove(p);
      p.stride += Math.hypot(p.vx, p.vy) * dt;
      p.face = faceFor(p);
      if (p.side === "off" && (p.route || p.hist)) { (p.hist || (p.hist = [])).push(p.x, p.y); if (p.hist.length > 80) p.hist.splice(0, 2); }
      p.x = clamp(p.x + p.vx * dt, -12, 112);
      p.y = clamp(p.y + p.vy * dt, -2, W + 2);
    }
    if (pl.type === "run" && !pl.handed) {
      const q = qb(), rb = byId("RB");
      if (G.ball.holder === q && pl.t > 0.3 && dist(q, rb) < 1.4) { G.ball.holder = rb; pl.handed = true; G.control[G.poss] = rb; }
    }
    const car = carrier();
    if (car && car.team === G.poss) pl.lastCar = car;
    if (car && car.role === "QB" && pl.type === "pass" && !pl.thrown && car.x > G.los + 0.3) pl.crossed = true;
    updateBall(dt);
    if (G.phase !== "live") return;
    engageBlocks();
    checkReps();
    if (G.phase === "live") resolveRep();
    if (G.phase === "live" && !G.mash) checkBounds();
  }

  // Run the game fast without drawing (for tests and tuning).
  function sim(seconds, step) {
    const dt = step || 1 / 60; let t = 0;
    while (t < seconds && G.phase !== "over") { update(dt); t += dt; }
    return t;
  }

  // Developer mode helpers: drop straight into a situation.
  const dev = {
    situation(o) {
      if (G.phase === "idle") return;
      if (o.quarter) G.quarter = o.quarter;
      if (o.clock != null) G.clock = o.clock;
      if (o.poss) G.poss = o.poss;
      if (o.los != null) G.los = o.los;
      G.down = o.down || 1; G.togo = Math.min(o.togo || 10, 100 - G.los);
      G.clockRunning = false; G.mash = null; G.rep = null; G.loose = null;
      setupScrimmage();
    },
  };
  return { pst, state: G, newGame, update, sim, fgNeed, windowFor, setTeams, dev, fireOn };
})();
