// Draws the game on a small 512x288 canvas that CSS scales up with crisp pixels.
const RENDER = (() => {
  const VW = 512, VH = 288, PX = 12, PY = 4.3, TOP = 44;
  const FW = CFG.FIELD_W;
  const FONT = '"Press Start 2P", monospace';
  let cv, ctx, camX = 40;
  const sx = x => Math.round((x - camX) * PX + VW / 2);
  const sy = y => Math.round(TOP + y * PY);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init(canvas) {
    cv = canvas; cv.width = VW; cv.height = VH;
    ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  }

  function text(s, x, y, color, size, align) {
    ctx.font = (size || 8) + "px " + FONT; ctx.textAlign = align || "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = color || "#f3efe4"; ctx.fillText(s, x, y);
  }

  // Pre-rendered textures: grass speckle tile and two frames of crowd.
  let grassTile = null, crowd = null;
  function textures() {
    const g = document.createElement("canvas"); g.width = g.height = 32;
    const gx = g.getContext("2d");
    for (let i = 0; i < 140; i++) {
      gx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.07)";
      gx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1, Math.random() < 0.3 ? 2 : 1);
    }
    grassTile = ctx.createPattern(g, "repeat");
    const T = CFG.TEAMS, misc = ["#d9d4c7", "#5b6470", "#8a5a3c", "#3d3d3d", "#b88c4a", "#6f8fb3"];
    crowd = [0, 1].map(f => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 18;
      const x = c.getContext("2d");
      x.fillStyle = "#1d2433"; x.fillRect(0, 0, 640, 18);
      for (let row = 0; row < 3; row++) {
        x.fillStyle = row % 2 ? "#242c3d" : "#1a2130"; x.fillRect(0, row * 6, 640, 6);
        for (let i = 0; i < 160; i++) {
          const r = Math.random(), col = r < 0.38 ? T[1].color : r < 0.7 ? T[2].color : misc[Math.floor(Math.random() * misc.length)];
          const bob = ((i + row + f) % 3 === 0) ? -1 : 0;
          x.fillStyle = col; x.fillRect(i * 4 + (row % 2) * 2, row * 6 + 2 + bob, 3, 3);
          x.fillStyle = "#e0b48a"; x.fillRect(i * 4 + (row % 2) * 2 + 1, row * 6 + 1 + bob, 1, 1);
          if (f === 1 && Math.random() < 0.25) { x.fillStyle = col; x.fillRect(i * 4 + (row % 2) * 2 + 1, row * 6 - 1 + bob, 1, 2); } // arms up
        }
      }
      return c;
    });
  }

  function stands(G, time) {
    if (!crowd) textures();
    const fast = G.hype > 0 ? 8 : 1.5;
    const img = crowd[Math.floor(time * fast) % 2];
    const off = ((camX * PX * 0.5) % 128 + 128) % 128;
    for (let x = -off; x < VW; x += 512) ctx.drawImage(img, Math.round(x), 22);
    ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 40, VW, 2);
  }

  function goalposts() {
    for (const gx of [-10, 110]) {
      const x = sx(gx), base = sy(FW / 2);
      if (x < -20 || x > VW + 20) continue;
      ctx.fillStyle = "#c9a200"; ctx.fillRect(x - 1, base - 20, 3, 20);
      ctx.fillStyle = "#ffd400"; ctx.fillRect(x - 9, base - 22, 19, 2); ctx.fillRect(x - 9, base - 44, 2, 22); ctx.fillRect(x + 8, base - 44, 2, 22);
    }
  }

  function field(G, time) {
    ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 0, VW, VH);
    stands(G, time);
    const T = CFG.TEAMS, own = G.poss, opp = own === 1 ? 2 : 1;
    // grass stripes every 5 yards, then a speckle texture that scrolls with the camera
    for (let yd = -15; yd < 115; yd += 5) {
      const x0 = sx(yd), x1 = sx(yd + 5);
      if (x1 < 0 || x0 > VW) continue;
      ctx.fillStyle = (Math.floor(yd / 5) % 2 === 0) ? "#2e8d48" : "#287f40";
      ctx.fillRect(x0, sy(0) - 3, x1 - x0, sy(FW) - sy(0) + 6);
    }
    ctx.save(); ctx.translate(-Math.round(camX * PX) % 32, 0); ctx.fillStyle = grassTile;
    ctx.fillRect(-32, sy(0) - 3, VW + 64, sy(FW) - sy(0) + 6); ctx.restore();
    // end zones: left is defended by the offense, right by the defense
    for (const [a, team] of [[-10, own], [100, opp]]) {
      const x0 = sx(a), x1 = sx(a + 10);
      if (x1 < 0 || x0 > VW) continue;
      ctx.fillStyle = T[team].dark; ctx.fillRect(x0, sy(0), x1 - x0, sy(FW) - sy(0));
      ctx.save(); ctx.beginPath(); ctx.rect(x0, sy(0), x1 - x0, sy(FW) - sy(0)); ctx.clip();
      ctx.strokeStyle = T[team].color; ctx.lineWidth = 3;
      for (let k = -300; k < 300; k += 14) { ctx.beginPath(); ctx.moveTo(x0 + k, sy(0)); ctx.lineTo(x0 + k + 200, sy(FW)); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate((x0 + x1) / 2, (sy(0) + sy(FW)) / 2); ctx.rotate(a < 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.font = "16px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#000"; ctx.fillText(T[team].short, 2, 2);
      ctx.fillStyle = T[team].trim; ctx.fillText(T[team].short, 0, 0); ctx.restore();
    }
    // midfield logo
    const mx = sx(50);
    if (mx > -60 && mx < VW + 60) {
      ctx.font = "8px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillText("DADMO", mx, sy(FW / 2) - 5); ctx.fillText("BOWL", mx, sy(FW / 2) + 6);
    }
    // lines
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (let yd = 0; yd <= 100; yd += 5) { const x = sx(yd); if (x >= -2 && x <= VW + 2) ctx.fillRect(x, sy(0), yd % 50 === 0 || yd % 100 === 0 ? 2 : 1, sy(FW) - sy(0)); }
    for (let yd = 1; yd < 100; yd++) { if (yd % 5 === 0) continue; const x = sx(yd); if (x < 0 || x > VW) continue; ctx.fillRect(x, sy(FW * 0.37), 1, 2); ctx.fillRect(x, sy(FW * 0.63), 1, 2); }
    ctx.fillStyle = "#fff"; ctx.fillRect(sx(-10), sy(0) - 1, sx(110) - sx(-10), 2); ctx.fillRect(sx(-10), sy(FW), sx(110) - sx(-10), 2);
    // yard numbers
    for (let yd = 10; yd <= 90; yd += 10) {
      const x = sx(yd); if (x < -20 || x > VW + 20) continue;
      const n = String(yd <= 50 ? yd : 100 - yd);
      ctx.font = "8px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fillText(n, x + 1, sy(3)); ctx.fillText(n, x + 1, sy(FW - 5));
    }
  }

  function scrimmageLines(G) {
    if (G.phase !== "presnap" && G.phase !== "live" && G.phase !== "dead") return;
    if (G.play && G.play.type === "return") return;
    ctx.fillStyle = "#4aa3ff"; ctx.fillRect(sx(G.los), sy(0), 2, sy(FW) - sy(0));
    const fd = G.los + G.togo;
    if (fd < 100) { ctx.fillStyle = "#ffe14a"; ctx.fillRect(sx(fd), sy(0), 2, sy(FW) - sy(0)); }
  }

  function arrow(pts, color, dashed) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(sx(pts[0].x), sy(pts[0].y));
    for (const p of pts.slice(1)) ctx.lineTo(sx(p.x), sy(p.y));
    ctx.stroke(); ctx.setLineDash([]);
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const ang = Math.atan2(sy(b.y) - sy(a.y), sx(b.x) - sx(a.x));
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(sx(b.x) + Math.cos(ang) * 4, sy(b.y) + Math.sin(ang) * 4);
    ctx.lineTo(sx(b.x) + Math.cos(ang + 2.5) * 5, sy(b.y) + Math.sin(ang + 2.5) * 5);
    ctx.lineTo(sx(b.x) + Math.cos(ang - 2.5) * 5, sy(b.y) + Math.sin(ang - 2.5) * 5);
    ctx.fill();
  }

  function playArt(G) {
    if (G.phase !== "presnap" || !G.plans) return;
    const off = G.players.filter(p => p.side === "off");
    const start = id => off.find(p => p.id === id);
    for (const [id, r] of Object.entries(G.plans.pass.routes)) {
      const s = start(id); if (s) arrow([{ x: s.x, y: s.y }].concat(r.pts), "rgba(255,255,255,.85)", false);
    }
    const rb = start("RB");
    arrow([{ x: rb.x, y: rb.y }].concat(G.plans.run.rbPath), "rgba(255,182,39,.95)", true);
  }

  // Which pose a player is in right now, from what the game says is happening to him.
  function poseFor(G, p, time) {
    if (G.mash && (p === G.mash.car || p === G.mash.def)) return ["grapple", Math.floor(time * 10) % 2];
    if (p.dive > 0) return ["dive", 0];
    if (p.anim && G.time - p.anim.t0 < p.anim.dur) {
      const k = (G.time - p.anim.t0) / p.anim.dur;
      switch (p.anim.name) {
        case "throw": return ["throw", Math.min(2, Math.floor(k * 3))];
        case "catch": return ["catch", 0];
        case "kick": return ["kick", k < 0.35 ? 0 : 1];
        case "fall": return [k < 0.55 ? "fall" : "down", 0];
      }
    }
    if (p.down > 0 || p.lying) return ["down", 0];
    if (p.jump > 0) return ["jump", 0];
    if (G.phase === "dead" && G.celebrate === p.team) return ["celebrate", Math.floor(time * 5 + p.seed) % 2];
    if (G.phase === "presnap" && (p.role === "OL" || p.role === "DL")) return ["stance", 0];
    if (G.phase === "kick" && G.kick.type !== "kickoff" && p.role === "OL") return ["stance", 0];
    if (Math.hypot(p.vx, p.vy) > 0.6) return ["run", Math.floor(p.stride * (p.burst > 0 ? 1.8 : 1.4)) % 4];
    return ["idle", 0];
  }

  function player(G, p, time) {
    const x = sx(p.x), y = sy(p.y);
    if (x < -20 || x > VW + 20) return;
    const [pose, frame] = poseFor(G, p, time);
    const flat = pose === "down" || pose === "dive";
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x - (flat ? 8 : 5), y - 1, flat ? 16 : 10, 2);
    let face = p.face || 1;
    if (G.mash && p === G.mash.def) face = G.mash.car.x > p.x ? 1 : -1;
    if (G.mash && p === G.mash.car) face = G.mash.def.x > p.x ? 1 : -1;
    const img = SPRITES.get(p.team, p.skin || 0, pose, frame, face);
    ctx.drawImage(img, x - SPRITES.OX, y - SPRITES.OY);
  }

  function effects(G) {
    if (!G.fx) return;
    for (const e of G.fx) {
      const k = (G.time - e.t0) / 0.6; if (k < 0 || k > 1) continue;
      const x = sx(e.x), y = sy(e.y);
      ctx.fillStyle = "rgba(214,196,150," + (0.85 * (1 - k)) + ")";
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + e.t0, r = 2 + k * 9;
        ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 2 - Math.abs(Math.sin(a)) * r * 0.6), 2, 2);
      }
    }
  }

  function marker(G, p, team, time) {
    if (!p) return;
    const x = sx(p.x), y = sy(p.y) - 34 - (Math.floor(time * 4) % 2);
    const T = CFG.TEAMS[team];
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x, y + 6); ctx.fill();
    ctx.fillStyle = T.trim; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.fill();
    text(String(team), x - 3, y - 10, T.trim, 8);
  }

  function ball(G) {
    const b = G.ball; if (!b || b.state === "held" && !b.holder) return;
    let x = sx(b.x); const y = sy(b.y);
    if (b.state === "air") { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x - 2, y - 1, 4, 2); }
    let z = b.state === "air" ? b.z * 3 : 12;
    if (b.state === "held" && b.holder) {
      // Tucked against the carrier's body; when he's down, it stays pinned under him (no fake fumbles).
      const h = b.holder, down = h.lying || h.down > 0 || (h.anim && h.anim.name === "fall");
      x = sx(h.x) + (down ? 2 : 3) * (h.face || 1);
      z = down ? 3 : 12;
      if (down) { ctx.fillStyle = "#7a3f12"; ctx.fillRect(x - 2, y - z - 1, 4, 2); return; }
    }
    ctx.fillStyle = "#7a3f12"; ctx.fillRect(x - 2, y - z - 2, 5, 3);
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y - z - 1, 1, 1);
  }

  function hud(G) {
    const T = CFG.TEAMS;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, VW, 22);
    text(T[1].short, 8, 7, T[1].trim); text(String(G.score[1]), 64, 7, "#fff");
    text(String(G.score[2]), VW - 72, 7, "#fff", 8, "right"); text(T[2].short, VW - 8, 7, T[2].trim, 8, "right");
    ctx.fillStyle = T[1].color; ctx.fillRect(0, 20, VW / 2, 2); ctx.fillStyle = T[2].color; ctx.fillRect(VW / 2, 20, VW / 2, 2);
    const clock = G.ot ? "OT" : "Q" + G.quarter + " " + Math.floor(G.clock / 60) + ":" + String(Math.floor(G.clock % 60)).padStart(2, "0");
    text(clock, VW / 2, 2, "#ffb627", 8, "center");
    // possession: a little football under the team name
    const px = G.poss === 1 ? 24 : VW - 28;
    ctx.fillStyle = "#7a3f12"; ctx.fillRect(px, 16, 6, 3);
    if (G.phase === "presnap" || G.phase === "live" || G.phase === "dead") {
      if (!(G.play && G.play.type === "return")) {
        const ord = ["1ST", "2ND", "3RD", "4TH"][Math.min(G.down, 4) - 1];
        const togo = G.los + G.togo >= 100 ? "GOAL" : (G.togo < 1 ? "INCHES" : String(Math.round(G.togo)));
        const spot = G.los < 50 ? "OWN " + Math.round(G.los) : G.los > 50 ? "OPP " + Math.round(100 - G.los) : "MIDFIELD";
        text(ord + " & " + togo + " · " + spot, VW / 2, 12, "#f3efe4", 8, "center");
      }
    }
  }

  function prompts(G) {
    const lines = { 1: "", 2: "" };
    for (const t of [1, 2]) {
      if (!G.human[t]) { lines[t] = "CPU"; continue; }
      const offense = t === G.poss;
      const car = G.ball && G.ball.state === "held" ? G.ball.holder : null;
      if (G.mash) lines[t] = "MASH X + Z!";
      else if (G.phase === "presnap") lines[t] = offense ? "X RUN  Z PASS" + (G.down === 4 ? (G.los >= 62 ? "  ▲ FIELD GOAL" : "  ▲ PUNT") : "") : "X SWITCH  MOVE";
      else if (G.phase === "kick") lines[t] = G.kick.team === t ? "Z KICK!" : "";
      else if (G.phase === "live") {
        const pl = G.play;
        if (car && car.team === t) {
          if (car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed) lines[t] = "X NEXT  Z THROW";
          else lines[t] = "Z BURST";
        } else if (G.ball.state === "air") lines[t] = G.ball.intended && G.ball.intended.team === t ? "GO GET IT" : "Z JUMP";
        else lines[t] = "X SWITCH  Z DIVE";
      } else if (G.phase === "over") lines[t] = G.overT > 2.5 ? "Z NEW GAME" : "";
    }
    const T = CFG.TEAMS;
    ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(0, VH - 14, VW, 14);
    text("P1 " + lines[1], 6, VH - 11, T[1].trim, 8);
    text(lines[2] + " P2", VW - 6, VH - 11, T[2].trim, 8, "right");
  }

  function kickMeter(G) {
    if (G.phase !== "kick") return;
    const k = G.kick, w = 180, x0 = VW / 2 - w / 2, y0 = VH - 48;
    const label = k.type === "fg" ? "FIELD GOAL · " + Math.round(100 - G.los + 17) + " YDS" : k.type === "punt" ? "PUNT" : "KICKOFF";
    ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(x0 - 8, y0 - 18, w + 16, 34);
    text(label, VW / 2, y0 - 13, "#ffb627", 8, "center");
    ctx.fillStyle = "#c8223a"; ctx.fillRect(x0, y0, w, 8);
    if (k.type === "fg") {
      // Green is exactly the window that makes this kick.
      const good = 1 - GAME.fgNeed(Math.round(100 - G.los + 17));
      ctx.fillStyle = "#7fd68f"; ctx.fillRect(x0 + w * (0.5 - good / 2), y0, w * good, 8);
    } else {
      ctx.fillStyle = "#ffb627"; ctx.fillRect(x0 + w * 0.3, y0, w * 0.4, 8);
      ctx.fillStyle = "#7fd68f"; ctx.fillRect(x0 + w * 0.44, y0, w * 0.12, 8);
    }
    ctx.fillStyle = "#fff"; ctx.fillRect(x0 + w * k.needle - 1, y0 - 3, 3, 14);
  }

  function mashMeter(G) {
    const m = G.mash; if (!m) return;
    const T = CFG.TEAMS, w = 200, x0 = VW / 2 - w / 2, y0 = TOP + 6;
    ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(x0 - 8, y0 - 4, w + 16, 30);
    text("MASH!", VW / 2, y0, "#ffb627", 8, "center");
    ctx.fillStyle = T[m.def.team].color; ctx.fillRect(x0, y0 + 13, w, 8);
    ctx.fillStyle = T[m.car.team].color; ctx.fillRect(x0, y0 + 13, w * m.meter, 8);
    ctx.fillStyle = "#fff"; ctx.fillRect(x0 + w / 2, y0 + 11, 1, 12);
  }

  function bannerDraw(G) {
    const b = G.banner; if (!b) return;
    const big = b.text.length > 12 ? 14 : 20;
    // During kicks the banner moves up so it never covers the kicker or the meter.
    const cy = (G.phase === "kick" || G.phase === "flight") ? TOP + 30 : VH / 2;
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, cy - 24, VW, b.sub ? 50 : 38);
    text(b.text, VW / 2, cy - 16, b.color, big, "center");
    if (b.sub) text(b.sub, VW / 2, cy + 10, "#f3efe4", 8, "center");
  }

  function draw(G, time) {
    if (!ctx) return;
    let target = G.ball ? G.ball.x : 50;
    if (G.phase === "kick") target = G.kick.type === "kickoff" ? 45 : G.los + 8;
    if (G.phase === "presnap") target = G.los + 11;
    // Before the throw, look downfield so routes stay on screen.
    if (G.phase === "live" && G.play && G.play.type === "pass" && !G.play.thrown) target = G.los + 10;
    camX += (target - camX) * 0.12;
    camX = clamp(camX, -10 + VW / 2 / PX, 110 - VW / 2 / PX);
    // Screen shake on big hits and touchdowns.
    const sh = G.shake > 0 ? Math.round((Math.random() - 0.5) * G.shake * 14) : 0;
    ctx.save(); ctx.translate(sh, sh ? Math.round((Math.random() - 0.5) * G.shake * 8) : 0);
    field(G, time); scrimmageLines(G); playArt(G); goalposts();
    const list = G.players.slice().sort((a, b) => a.y - b.y);
    for (const p of list) player(G, p, time);
    effects(G);
    // target receiver ring for a human quarterback
    const pl = G.play, car = G.ball && G.ball.state === "held" ? G.ball.holder : null;
    if (pl && pl.type === "pass" && !pl.thrown && car && car.role === "QB" && G.human[G.poss] && G.receivers[G.target]) {
      const r = G.receivers[G.target];
      ctx.strokeStyle = Math.floor(time * 6) % 2 ? "#ffe14a" : "#fff"; ctx.lineWidth = 1;
      ctx.strokeRect(sx(r.x) - 8, sy(r.y) - 26, 16, 27);
    }
    ball(G);
    for (const t of [1, 2]) if (G.human[t] && G.phase !== "kick" && G.phase !== "over") marker(G, G.control[t], t, time);
    ctx.restore();
    hud(G); kickMeter(G); mashMeter(G); bannerDraw(G); prompts(G);
  }

  return { init, draw };
})();
