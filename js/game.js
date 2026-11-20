// The football: rules, clock, players, AI and controls. No drawing in here.
// Positions are yards in the offense's frame (offense always attacks toward x = 100).
const GAME = (() => {
  const W = CFG.FIELD_W, C = W / 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const other = t => (t === 1 ? 2 : 1);
  const Q = CFG.QUARTER_SECONDS;

  const G = { phase: "idle", human: { 1: true, 2: false }, score: { 1: 0, 2: 0 }, players: [], control: {}, quarter: 1, clock: Q };
  let seed = 0;

  // ---------- helpers ----------
  function makePlayer(team, side, spec) {
    return {
      team, side, role: spec.role, id: spec.id || spec.role, man: spec.man,
      x: spec.x, y: spec.y, x0: spec.x, y0: spec.y, vx: 0, vy: 0,
      spd: CFG.SPEED[spec.role] || 6.5, face: 1, seed: seed++,
      route: null, ri: 0, down: 0, engaged: 0, blockCd: 0, burst: 0, burstCd: 0, jump: 0, dive: 0, broke: false,
    };
  }
  const byId = id => G.players.find(p => p.side === "off" && p.id === id);
  const qb = () => G.players.find(p => p.side === "off" && p.role === "QB");
  const carrier = () => (G.ball && G.ball.state === "held" ? G.ball.holder : null);
  const teamPlayers = t => G.players.filter(p => p.team === t);
  const trailing = t => G.score[t] < G.score[other(t)];

  function banner(text, sub, secs, color) { G.banner = { text, sub: sub || "", t: secs || 1.6, color: color || "#ffb627" }; }
  function event(type, data) { G.events.push(Object.assign({ type, q: G.quarter }, data || {})); }

  function setVel(p, dx, dy, mul) {
    let s = p.spd * (mul || 1);
    if (p.burst > 0) s *= 1.35;
    if (p.engaged > 0) s *= 0.12;
    p.vx = dx * s; p.vy = dy * s;
    if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1;
  }
  function seek(p, tx, ty, mul) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.15) { p.vx = p.vy = 0; return d; }
    setVel(p, dx / d, dy / d, Math.min(mul || 1, d * 2));
    return d;
  }

  // ---------- game flow ----------
  function newGame(human) {
    Object.assign(G, {
      human: Object.assign({ 1: true, 2: false }, human || {}),
      score: { 1: 0, 2: 0 }, quarter: 1, clock: Q, clockRunning: false, ot: false,
      banner: null, events: [], mash: null, next: null, overT: 0, plays: 0,
    });
    setupKickoff(other(CFG.FIRST_RECEIVER));
    banner("KICKOFF!", CFG.TEAMS[CFG.FIRST_RECEIVER].name + " RECEIVE", 2);
  }

  function changePoss(team, los) {
    G.poss = team; G.los = clamp(los, 1, 99); G.down = 1; G.togo = Math.min(10, 100 - G.los);
  }

  function setupKickoff(kickTeam) {
    G.phase = "kick"; G.poss = kickTeam; G.los = 35; G.down = 1; G.togo = 10; G.clockRunning = false; G.mash = null;
    G.kick = { type: "kickoff", team: kickTeam, needle: 0, dir: 1, t: 0, cpuAt: rnd(0.8, 1.6) };
    G.players = [];
    G.players.push(makePlayer(kickTeam, "off", { role: "QB", id: "K", x: 33, y: C }));
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(kickTeam, "off", { role: "OL", x: 34.5, y: 5 + i * 6.2 - (i > 3 ? 0 : 0) }));
    const recv = other(kickTeam);
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(recv, "def", { role: "LB", x: 50 + (i % 2) * 8, y: 6 + i * 5.9 }));
    G.players.push(makePlayer(recv, "def", { role: "S", x: 92, y: C }));
    G.ball = { state: "tee", holder: null, x: 35, y: C, z: 0 };
    G.control = { [kickTeam]: G.players[0], [recv]: G.players[G.players.length - 1] };
  }

  function setupScrimmage() {
    G.phase = "presnap"; G.presnapT = 0; G.cpuSnapAt = rnd(1.1, 2.3); G.mash = null; G.play = null;
    const f = PLAYS.formation(G.los);
    const offT = G.poss, defT = other(offT);
    G.players = f.off.map(s => makePlayer(offT, "off", s)).concat(f.def.map(s => makePlayer(defT, "def", s)));
    G.plans = PLAYS.makePlans(G.los, G.players.filter(p => p.side === "off"));
    G.ball = { state: "held", holder: qb(), x: G.los - 1.6, y: C, z: 1 };
    G.control = { [offT]: qb(), [defT]: G.players.find(p => p.side === "def" && p.role === "LB") };
    G.receivers = [];
    G.target = 0;
  }

  function snap(call) {
    if (call === "kick") {
      const fg = G.los >= 62;
      G.phase = "kick";
      G.kick = { type: fg ? "fg" : "punt", team: G.poss, needle: 0, dir: 1, t: 0, cpuAt: rnd(0.7, 1.5) };
      return;
    }
    G.phase = "live"; G.clockRunning = true; G.plays++;
    G.play = { type: call, t: 0, thrown: false, handed: false, mashUsed: false, crossed: false, cpuThrowAt: rnd(1.4, 2.6), scramble: false };
    G.players.forEach(p => { p.route = null; p.ri = 0; });
    if (call === "run") {
      const rb = byId("RB"); rb.route = G.plans.run.rbPath.map(o => ({ x: o.x, y: o.y }));
      G.players.filter(p => p.side === "off" && (p.role === "WR" || p.role === "TE")).forEach(p => p.blocker = true);
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
    G.poss = recvTeam; G.phase = "live"; G.clockRunning = true; G.mash = null;
    G.play = { type: "return", t: 0, thrown: true, handed: true, mashUsed: false, crossed: true };
    G.players = [];
    const kr = makePlayer(recvTeam, "off", { role: "KR", x: rx, y: clamp(C + rnd(-8, 8), 6, W - 6) });
    G.players.push(kr);
    for (let i = 0; i < 8; i++) G.players.push(makePlayer(recvTeam, "off", { role: "OL", x: rx + rnd(6, 13), y: 5 + i * 6.1 }));
    for (let i = 0; i < 9; i++) G.players.push(makePlayer(kickTeam, "def", { role: "CV", x: rx + rnd(15, 24), y: 4 + i * 5.7 }));
    G.ball = { state: "held", holder: kr, x: kr.x, y: kr.y, z: 1 };
    G.control = { [recvTeam]: kr, [kickTeam]: nearestTo(kickTeam, kr) };
  }

  function nearestTo(team, pt, exclude) {
    let best = null, bd = 1e9;
    for (const p of G.players) {
      if (p.team !== team || p === exclude || p.down > 0) continue;
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
    if (acc !== null) resolveKick(acc);
  }

  function resolveKick(acc) {
    const k = G.kick, kt = k.team, recv = other(kt);
    G.lastKickAcc = acc;
    if (k.type === "kickoff") {
      const land = 35 + 47 + acc * 18;
      if (land >= 100) { changePoss(recv, 25); banner("TOUCHBACK", "", 1.4); return dead(1.4, setupScrimmage); }
      return setupReturn(recv, 100 - land, kt);
    }
    if (k.type === "punt") {
      const land = G.los + 32 + acc * 18;
      if (land >= 100) { changePoss(recv, 20); banner("TOUCHBACK", "", 1.4); return dead(1.4, setupScrimmage); }
      banner("PUNT", Math.round(land - G.los) + " YARDS", 1);
      return setupReturn(recv, 100 - land, kt);
    }
    // field goal
    const yards = Math.round(100 - G.los + 17);
    const need = clamp((yards - 17) / 46, 0.15, 0.93);
    const good = acc >= need;
    event("fg", { team: kt, yards, good });
    if (good) {
      G.score[kt] += 3; G.clockRunning = false;
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
    return Math.random() < (G.togo > 6 ? 0.3 : 0.55) ? "run" : "pass";
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
        const defs = teamPlayers(defT); const i = defs.indexOf(G.control[defT]);
        G.control[defT] = defs[(i + 1) % defs.length];
      }
      const p = G.control[defT], d = INPUT.dir(defT);
      if (p && d.any) { p.x = clamp(p.x + d.dx * 4 * dt, G.los + 1, G.los + 18); p.y = clamp(p.y + d.dy * 4 * dt, 1, W - 1); }
    }
    if (call) snap(call);
  }

  // ---------- controls during a live play ----------
  function controls(team, dt) {
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
      if (car.role === "QB" && pl.type === "run" && !pl.handed) return; // the handoff is automatic
      if (INPUT.pressed(team, "z") && car.burstCd <= 0) { car.burst = 0.7; car.burstCd = 3; }
      if (d.any) { setVel(car, d.dx, d.dy, 1.03); car.manual = true; }
      return;
    }
    if (b.state === "air" && b.intended && b.intended.team === team) {
      p = G.control[team] = b.intended;
      if (d.any) { setVel(p, d.dx, d.dy, 1); p.manual = true; }
      return;
    }
    // Tackling side.
    if (!p || p.team !== team) p = G.control[team] = nearestTo(team, b);
    if (INPUT.pressed(team, "x")) {
      const target = car || { x: b.tx != null && b.state === "air" ? b.tx : b.x, y: b.state === "air" ? b.ty : b.y };
      const n = nearestTo(team, target, p); if (n) p = G.control[team] = n;
    }
    if (!p || p.down > 0) return;
    if (INPUT.pressed(team, "z") && p.dive <= 0) {
      if (b.state === "air" && Math.hypot(p.x - b.tx, p.y - b.ty) < 6) p.jump = 0.5;
      else {
        let dx = d.dx, dy = d.dy;
        if (!d.any && car) { const l = dist(p, car) || 1; dx = (car.x - p.x) / l; dy = (car.y - p.y) / l; }
        if (!d.any && !car) dx = p.face;
        p.dive = 0.3; p.diveDx = dx; p.diveDy = dy;
      }
    }
    if (p.dive > 0) { p.vx = p.diveDx * 11; p.vy = p.diveDy * 11; p.manual = true; return; }
    if (d.any) { setVel(p, d.dx, d.dy, 1.05); p.manual = true; }
  }

  // ---------- AI ----------
  function runRoute(p, mul) {
    if (!p.route || p.ri >= p.route.length) return false;
    const t = p.route[p.ri];
    const d = seek(p, t.x, t.y, mul || 1);
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
    // Open-field running: head for the end zone and slip past tacklers.
    const dirX = p.team === G.poss ? 1 : -1;
    let dx = dirX, dy = 0;
    for (const o of G.players) {
      if (o.team === p.team || o.down > 0) continue;
      const ex = o.x - p.x, ey = o.y - p.y, d = Math.hypot(ex, ey);
      if (d > 7 || ex * dirX < -1.5) continue;
      const w = (7 - d) / 7;
      dy += -(Math.sign(ey) || 1) * w * 1.5;
      dx -= dirX * w * 0.25;
    }
    if (p.y < 4) dy += 0.9; if (p.y > W - 4) dy -= 0.9;
    const l = Math.hypot(dx, dy) || 1;
    setVel(p, dx / l, dy / l, 1);
  }

  function openness(r) {
    let m = 99;
    for (const o of G.players) if (o.team !== r.team) m = Math.min(m, dist(o, r));
    return m + (r.x - G.los) * 0.04;
  }

  function cpuQB(q) {
    const pl = G.play;
    q.vx = q.vy = 0;
    const pressure = G.players.some(o => o.team !== q.team && o.down <= 0 && dist(o, q) < 2.8);
    if (pl.scramble) { pl.crossed = q.x > G.los; return aiRunTo(q); }
    if (pl.t > pl.cpuThrowAt || (pressure && pl.t > 1)) {
      const best = G.receivers.map(r => ({ r, s: openness(r) })).sort((a, b) => b.s - a.s)[0];
      if (best && (best.s > 2.2 || pl.t > 3.3 || pressure)) {
        if (best.s < 1.2 && Math.random() < 0.35 && pressure) { pl.scramble = true; return; }
        throwBall(q, best.r);
      }
    }
  }
  function aiRunTo(p) { const l = 1; setVel(p, 1, (C - p.y) * 0.02, 1); }

  function block(p, car) {
    let opp = null, bd = 1e9;
    for (const o of G.players) {
      if (o.team === p.team || o.down > 0 || o.engaged > 0) continue;
      if (dist(o, car) > 12) continue;
      const d = dist(o, p); if (d < bd) { bd = d; opp = o; }
    }
    if (!opp) { const dirX = car.team === G.poss ? 1 : -1; return seek(p, car.x + dirX * 4, p.y, 0.7); }
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
    seek(p, car.x + car.vx * lead, car.y + car.vy * lead, mul || 1);
  }

  function aiMove(p) {
    const car = carrier(), b = G.ball, pl = G.play;
    if (car === p) return aiCarrier(p);
    // Pass play before the throw: routes, pass protection and coverage.
    if (pl.type === "pass" && !pl.thrown && car && car.role === "QB" && !pl.crossed) {
      if (p.side === "off") {
        if (p.route) { if (!runRoute(p)) afterRoute(p); return; }
        return passBlock(p);
      }
      if (p.role === "DL") return pursue(p, car, 1);
      if (p.role === "CB") { const r = byId(p.man); return seek(p, r.x + r.vx * 0.35 + 1.2, r.y + r.vy * 0.35, 0.97); }
      if (p.role === "LB") {
        let near = null, nd = 9;
        for (const r of G.receivers) { const d = Math.abs(r.y - p.y0); if (d < nd && r.x > G.los - 1) { nd = d; near = r; } }
        return seek(p, G.los + 7, p.y0 + (near ? clamp(near.y - p.y0, -6, 6) : 0), 0.85);
      }
      return seek(p, G.los + 14, C + (q => q ? clamp(q.y - C, -8, 8) : 0)(G.receivers[G.target]), 0.85);
    }
    if (b.state === "air") {
      const near = Math.hypot(p.x - b.tx, p.y - b.ty) < 9;
      if (p === b.intended || (p.side === "def" && near)) return seek(p, b.tx, b.ty, 1);
      if (p.route) { if (!runRoute(p)) afterRoute(p); return; }
      return seek(p, b.tx, b.ty, 0.6);
    }
    if (!car) { p.vx = p.vy = 0; return; }
    if (p.team !== car.team) {
      if (pl.type === "run" && !pl.handed && (p.role === "CB" || p.role === "S")) return seek(p, p.x0 - 1, p.y0 + (car.y - p.y0) * 0.3, 0.6);
      if (pl.type === "run" && pl.t < 0.7 && p.role === "LB") return seek(p, p.x0, p.y0 + (car.y - p.y0) * 0.3, 0.4); // linebackers read first
      return pursue(p, car, 1);
    }
    // The running back runs his path to the handoff; everyone else on his team blocks.
    if (pl.type === "run" && !pl.handed && p.route) return runRoute(p);
    return block(p, car);
  }

  // ---------- the ball ----------
  function throwBall(q, r) {
    let T = dist(q, r) / CFG.BALL_SPEED;
    let tx = r.x + r.vx * T, ty = r.y + r.vy * T;
    T = Math.hypot(tx - q.x, ty - q.y) / CFG.BALL_SPEED;
    tx = r.x + r.vx * T; ty = clamp(r.y + r.vy * T, 0.6, W - 0.6);
    G.ball = { state: "air", fx: q.x, fy: q.y, tx, ty, t: 0, T: Math.max(0.25, T), h: 0.8 + T * 2.4, intended: r, x: q.x, y: q.y, z: 1 };
    G.play.thrown = true;
  }

  function resolveCatch() {
    const b = G.ball, spot = { x: b.tx, y: b.ty };
    const offT = G.poss, defT = other(offT);
    const near = (team, skip) => G.players
      .filter(p => p.team === team && p.down <= 0 && !(skip && skip(p)))
      .map(p => ({ p, d: dist(p, spot) })).sort((a, c) => a.d - c.d)[0];
    const r = near(offT, p => p.role === "OL" || p.role === "QB");
    const d = near(defT);
    const rOk = r && r.d < 1.8, dNear = d && d.d < 1.7;
    let out;
    if (dNear) {
      const jumping = d.p.jump > 0 && G.human[defT] && G.control[defT] === d.p;
      const pInt = jumping ? 0.5 : rOk ? 0.1 : 0.28;
      const pSwat = jumping ? 0.42 : rOk ? 0.32 : 0.5;
      const roll = Math.random();
      out = roll < pInt ? "int" : roll < pInt + pSwat ? "swat" : rOk ? "catch" : "inc";
    } else out = rOk ? (Math.random() < 0.94 ? "catch" : "drop") : "inc";

    if (out === "catch") {
      G.ball = { state: "held", holder: r.p, x: r.p.x, y: r.p.y, z: 1 };
      r.p.route = null; G.control[offT] = r.p;
      event("catch", { team: offT });
    } else if (out === "int") {
      G.ball = { state: "held", holder: d.p, x: d.p.x, y: d.p.y, z: 1 };
      G.control[defT] = d.p; G.control[offT] = nearestTo(offT, d.p);
      banner("INTERCEPTED!", "", 1.4, CFG.TEAMS[defT].trim);
      event("int", { team: defT });
    } else {
      banner(out === "swat" ? "SWATTED!" : out === "drop" ? "DROPPED!" : "INCOMPLETE", "", 1.3, "#f3efe4");
      G.ball.state = "dead";
      endPlay({ type: "inc" });
    }
  }

  function updateBall(dt) {
    const b = G.ball;
    if (b.state === "held") { const h = b.holder; b.x = h.x + 0.35 * h.face; b.y = h.y; b.z = 1; }
    else if (b.state === "air") {
      b.t += dt; const k = Math.min(1, b.t / b.T);
      b.x = b.fx + (b.tx - b.fx) * k; b.y = b.fy + (b.ty - b.fy) * k; b.z = 1 + b.h * 4 * k * (1 - k);
      if (k >= 1) resolveCatch();
    }
  }

  // ---------- contact ----------
  function engageBlocks() {
    const car = carrier(); if (!car) return;
    for (const p of G.players) {
      if (p === car || p.team !== car.team || p.engaged > 0 || p.blockCd > 0 || p.down > 0) continue;
      if (p.route && p.ri < p.route.length) continue; // receivers and backs on a route don't stop to block
      for (const o of G.players) {
        if (o.team === p.team || o.engaged > 0 || o.down > 0 || o.blockCd > 0) continue;
        if (dist(p, o) > 0.95) continue;
        const line = p.role === "OL" && o.role === "DL";
        const t = line ? rnd(2.4, 4.2) : rnd(0.6, 1.6);
        p.engaged = o.engaged = t; p.blockCd = o.blockCd = t + (line ? 0.4 : 1.2);
        break;
      }
    }
  }

  function checkContacts() {
    const car = carrier(); if (!car) return;
    const pl = G.play;
    for (const p of G.players) {
      if (p.team === car.team || p.down > 0 || p.engaged > 0) continue;
      const reach = p.dive > 0 ? 1.15 : 0.75;
      if (dist(p, car) > reach) continue;
      const pocket = car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed;
      if (pocket) return tackle(car, p, "sack");
      if (p.dive > 0) return tackle(car, p);
      const humanInvolved = (G.human[p.team] && G.control[p.team] === p) || (G.human[car.team] && G.control[car.team] === car);
      if (humanInvolved && !pl.mashUsed && Math.random() < CFG.MASH_CHANCE) return startMash(car, p);
      if (!p.broke && Math.random() < 0.12) { p.broke = true; p.down = 0.8; continue; }
      return tackle(car, p);
    }
  }

  function startMash(car, def) {
    G.mash = { car, def, meter: 0.5, t: 1.6 };
    G.play.mashUsed = true;
    car.vx = car.vy = def.vx = def.vy = 0;
  }

  function updateMash(dt) {
    const m = G.mash; m.t -= dt;
    const push = (team, sign) => {
      if (G.human[team]) {
        if (INPUT.pressed(team, "x")) m.meter += 0.055 * sign;
        if (INPUT.pressed(team, "z")) m.meter += 0.055 * sign;
      } else if (Math.random() < 7.5 * dt) m.meter += 0.05 * sign;
    };
    push(m.car.team, 1); push(m.def.team, -1);
    m.meter = clamp(m.meter, 0, 1);
    if (m.t > 0) return;
    G.mash = null;
    if (m.meter > 0.5) {
      m.def.down = 1.1; m.car.burst = 0.6;
      banner("BROKE FREE!", "", 0.9, "#7fd68f");
      event("broke", { team: m.car.team });
    } else tackle(m.car, m.def);
  }

  function tackle(car, by, kind) {
    by.vx = by.vy = 0;
    if (kind === "sack") { banner("SACK!", "", 1.3, CFG.TEAMS[by.team].trim); event("sack", { team: by.team }); }
    if (kind !== "sack" && Math.random() < CFG.FUMBLE) {
      const lost = Math.random() < 0.5;
      banner("FUMBLE!", lost ? "RECOVERED BY " + CFG.TEAMS[by.team].short : "OFFENSE RECOVERS", 1.8);
      event("fumble", { lost });
      return endPlay({ type: "tackle", x: car.x, carrierTeam: lost ? by.team : car.team });
    }
    endPlay({ type: "tackle", x: car.x, carrierTeam: car.team });
  }

  function checkBounds() {
    const car = carrier(); if (!car) return;
    if (car.team === G.poss && car.x >= 100) return touchdown(car.team);
    if (car.team !== G.poss && car.x <= 0) return touchdown(car.team);
    if (car.y < 0 || car.y > W) { banner("OUT OF BOUNDS", "", 1, "#f3efe4"); return endPlay({ type: "oob", x: car.x, carrierTeam: car.team }); }
  }

  // ---------- end of a play ----------
  function dead(secs, next) { G.phase = "dead"; G.deadT = secs; G.next = next; }

  function endPlay(r) {
    if (G.phase !== "live") return;
    const offT = G.poss, pl = G.play;
    G.mash = null;
    if (r.type === "inc") { G.clockRunning = false; advanceDown(0); return dead(1.4, setupScrimmage); }
    const x = clamp(r.x, -9.9, 109.9);
    if (r.type === "oob") G.clockRunning = false;
    if (r.carrierTeam === offT) {
      if (pl.type === "return") { changePoss(offT, x <= 0 ? 20 : x); }
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
      if (G.play && G.play.type !== "return" && gain > 0) banner("FIRST DOWN", "", 1, "#ffe14a");
      return;
    }
    G.togo = Math.round((G.togo - gain) * 10) / 10;
    G.down++;
    if (G.down > 4) {
      banner("TURNOVER ON DOWNS", "", 1.6, "#f3efe4");
      changePoss(other(G.poss), 100 - G.los);
    }
  }

  function scored(team, secs) {
    if (G.ot) return dead(secs, () => gameOver());
    dead(secs, () => setupKickoff(team));
  }

  function touchdown(team) {
    if (G.phase !== "live") return;
    G.mash = null; G.score[team] += 6; G.clockRunning = false;
    const xp = Math.random() < 0.96; if (xp) G.score[team] += 1;
    event("td", { team, pickSix: team !== G.poss });
    banner("TOUCHDOWN!", CFG.TEAMS[team].name + (xp ? "" : " · EXTRA POINT MISSED"), 2.6, CFG.TEAMS[team].trim);
    scored(team, 2.6);
  }

  function safety(offT) {
    const defT = other(offT);
    G.score[defT] += 2; G.clockRunning = false;
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
    const next = G.next || setupScrimmage;
    dead(1.4, next);
  }

  function gameOver() {
    G.phase = "over"; G.overT = 0; G.clockRunning = false;
    const w = G.score[1] === G.score[2] ? 0 : G.score[1] > G.score[2] ? 1 : 2;
    G.winner = w;
    banner("FINAL", w ? CFG.TEAMS[w].name + " WIN!" : "TIE GAME", 999);
  }

  // ---------- main update ----------
  function update(dt) {
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    const tick = G.clockRunning && !G.ot && (G.phase === "live" || G.phase === "presnap" || G.phase === "dead");
    if (tick && G.clock > 0) G.clock = Math.max(0, G.clock - dt);

    switch (G.phase) {
      case "kick": return updateKick(dt);
      case "presnap":
        if (G.clock <= 0 && !G.ot) { G.next = setupScrimmage; return endQuarter(); }
        return updatePresnap(dt);
      case "dead":
        G.deadT -= dt;
        if (G.deadT > 0) return;
        if (G.clock <= 0 && !G.ot && G.next !== gameOver) { return endQuarter(); }
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
      for (const k of ["engaged", "blockCd", "burst", "burstCd", "jump"]) if (p[k] > 0) p[k] -= dt;
      if (p.dive > 0) { p.dive -= dt; if (p.dive <= 0) p.down = 0.6; }
    }
    controls(G.poss, dt); controls(other(G.poss), dt);
    for (const p of G.players) {
      if (p.down > 0) { p.down -= dt; p.vx = p.vy = 0; continue; }
      if (!p.manual) aiMove(p);
      p.x = clamp(p.x + p.vx * dt, -12, 112);
      p.y = clamp(p.y + p.vy * dt, -2, W + 2);
    }
    // Handoff on run plays.
    if (pl.type === "run" && !pl.handed) {
      const q = qb(), rb = byId("RB");
      if (G.ball.holder === q && pl.t > 0.3 && dist(q, rb) < 1.4) {
        G.ball.holder = rb; pl.handed = true; G.control[G.poss] = rb;
      }
    }
    const car = carrier();
    if (car && car.role === "QB" && pl.type === "pass" && !pl.thrown && car.x > G.los + 0.3) pl.crossed = true;
    updateBall(dt);
    if (G.phase !== "live") return;
    engageBlocks();
    checkContacts();
    if (G.phase === "live") checkBounds();
  }

  // Run the game fast without drawing (for tests and attract mode checks).
  function sim(seconds, step) {
    const dt = step || 1 / 60; let t = 0;
    while (t < seconds && G.phase !== "over") { update(dt); t += dt; }
    return t;
  }

  return { state: G, newGame, update, sim };
})();
