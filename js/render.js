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
  let grassTile = null, crowd = null, crowdHome = 1;
  function textures() {
    const g = document.createElement("canvas"); g.width = g.height = 32;
    const gx = g.getContext("2d");
    for (let i = 0; i < 140; i++) {
      gx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.07)";
      gx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1, Math.random() < 0.3 ? 2 : 1);
    }
    grassTile = ctx.createPattern(g, "repeat");
    const T = CFG.TEAMS, misc = ["#d9d4c7", "#5b6470", "#8a5a3c", "#3d3d3d", "#b88c4a", "#6f8fb3"];
    const H = T[crowdHome] || T[1], A = T[crowdHome === 2 ? 1 : 2] || T[2];
    const hc = TEAMS.byId[H.id] ? TEAMS.byId[H.id].color : H.color, ac = TEAMS.byId[A.id] ? TEAMS.byId[A.id].color : A.color;
    crowd = [0, 1].map(f => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 18;
      const x = c.getContext("2d");
      x.fillStyle = "#1d2433"; x.fillRect(0, 0, 640, 18);
      for (let row = 0; row < 3; row++) {
        x.fillStyle = row % 2 ? "#242c3d" : "#1a2130"; x.fillRect(0, row * 6, 640, 6);
        for (let i = 0; i < 160; i++) {
          // a home crowd: about 6 in 10 fans in home colors, 2 in 10 visitors
          const xm = typeof HOLIDAY !== "undefined" && HOLIDAY.on;
          const r = Math.random(), col = xm && r > 0.8 ? (Math.random() < 0.5 ? "#d8342c" : "#1f8a4c") : r < 0.6 ? hc : r < 0.8 ? ac : misc[Math.floor(Math.random() * misc.length)]; // holiday sweaters
          const bob = ((i + row + f) % 3 === 0) ? -1 : 0;
          x.fillStyle = col; x.fillRect(i * 4 + (row % 2) * 2, row * 6 + 2 + bob, 3, 3);
          x.fillStyle = "#e0b48a"; x.fillRect(i * 4 + (row % 2) * 2 + 1, row * 6 + 1 + bob, 1, 1);
          if (f === 1 && Math.random() < 0.25) { x.fillStyle = col; x.fillRect(i * 4 + (row % 2) * 2 + 1, row * 6 - 1 + bob, 1, 2); } // arms up
          if (xm && (i * 7 + row * 3) % 5 < 2) { // about 4 in 10 fans in Santa hats
            const hx = i * 4 + (row % 2) * 2, hy = row * 6 + bob;
            x.fillStyle = "#d8342c"; x.fillRect(hx, hy, 3, 1); x.fillStyle = "#fff"; x.fillRect(hx + 3, hy, 1, 1);
          }
        }
      }
      return c;
    });
  }

  function stands(G, time) {
    const ck = CFG.TEAMS[1].id + CFG.TEAMS[2].id + G.home; if (!crowd || crowd.key !== ck) { crowdHome = G.home || 1; textures(); crowd.key = ck; }
    const fast = G.hype > 0 ? 8 : 1.5;
    const img = crowd[Math.floor(time * fast) % 2];
    const off = ((camX * PX * 0.5) % 128 + 128) % 128;
    for (let x = -off; x < VW; x += 512) ctx.drawImage(img, Math.round(x), 22);
    ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 40, VW, 2);
    if (typeof HOLIDAY !== "undefined" && HOLIDAY.on) { // a string of Christmas lights on the railing, chasing slowly
      const cols = ["#ff3b3b", "#3bd16f", "#ffd23b", "#4aa8ff"], step = Math.floor(time * 3);
      ctx.fillStyle = "#1c3a22"; ctx.fillRect(0, 37, VW, 1);
      const o = camX * PX * 0.5; // unwrapped scroll, so the string never jumps
      for (let x = -(((o % 10) + 10) % 10); x < VW; x += 10) {
        const k = Math.round((x + o) / 10);
        ctx.fillStyle = (k + step) % 4 === 0 ? "#fff6c8" : cols[((k % 4) + 4) % 4];
        ctx.fillRect(Math.round(x), 38, 2, 2);
      }
    }
  }

  function goalposts() {
    for (const gx of [-10, 110]) {
      const x = sx(gx), base = sy(FW / 2);
      if (x < -20 || x > VW + 20) continue;
      ctx.fillStyle = "#c9a200"; ctx.fillRect(x - 1, base - 20, 3, 20);
      ctx.fillStyle = "#ffd400"; ctx.fillRect(x - 9, base - 22, 19, 2); ctx.fillRect(x - 9, base - 44, 2, 22); ctx.fillRect(x + 8, base - 44, 2, 22);
      if (typeof HOLIDAY !== "undefined" && HOLIDAY.on) { // candy-cane stripes, with a bow on the crossbar
        ctx.fillStyle = "#f3efe4"; ctx.fillRect(x - 1, base - 20, 3, 20); ctx.fillRect(x - 9, base - 22, 19, 2); ctx.fillRect(x - 9, base - 44, 2, 22); ctx.fillRect(x + 8, base - 44, 2, 22);
        ctx.fillStyle = "#d8342c";
        for (let y = base - 44; y < base; y += 4) { if (y < base - 22) { ctx.fillRect(x - 9, y, 2, 2); ctx.fillRect(x + 8, y, 2, 2); } else if (y > base - 21) ctx.fillRect(x - 1, y, 3, 2); }
        for (let xx = x - 9; xx < x + 10; xx += 4) ctx.fillRect(xx, base - 22, 2, 2);
        ctx.fillStyle = "#1f8a4c"; ctx.fillRect(x - 2, base - 25, 5, 2); ctx.fillStyle = "#d8342c"; ctx.fillRect(x, base - 25, 1, 3);
      }
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
      const home = CFG.TEAMS[G.home || 1];
      ctx.save(); ctx.globalAlpha = 0.55; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(MASCOTS.icon(home.id), mx - 24, sy(FW / 2) - 30, 48, 48);
      ctx.restore();
      ctx.font = "8px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillText(home.short, mx, sy(FW / 2) + 26);
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
    if (p.lungeT > 0) return ["lunge", 0];
    if (p.anim && G.time - p.anim.t0 < p.anim.dur) {
      const k = (G.time - p.anim.t0) / p.anim.dur;
      switch (p.anim.name) {
        case "throw": return ["throw", Math.min(2, Math.floor(k * 3))];
        case "catch": return ["catch", 0];
        case "kick": return ["kick", k < 0.35 ? 0 : 1];
        case "fall": return [k < 0.55 ? "fall" : "down", 0];
        case "stiff": return ["stiff", 0];
        case "truck": return ["truck", 0];
        case "lunge": return ["lunge", 0];
        case "dive": return ["dive", 0];
        case "juke": return ["run", Math.floor(k * 6) % 6];
      }
    }
    if (p.down > 0 || p.lying) return ["down", 0];
    if (p.jump > 0) return ["jump", 0];
    if (G.phase === "dead" && G.celebrate === p.team) return ["celebrate", Math.floor(time * 5 + p.seed) % 2];
    if (G.phase === "presnap" && (p.role === "OL" || p.role === "DL")) return ["stance", 0];
    if (G.phase === "kick" && G.kick.type !== "kickoff" && p.role === "OL") return ["stance", 0];
    if (Math.hypot(p.vx, p.vy) > 0.6) {
      // Moving opposite to where he's facing = backpedaling (DBs, a QB's drop).
      if (Math.abs(p.vx) > 0.8 && Math.sign(p.vx) !== (p.face || 1)) return ["backpedal", Math.floor(p.stride * 2.2) % 4];
      return ["run", Math.floor(p.stride * (p.burst > 0 ? 2.6 : 2.1)) % 6];
    }
    return ["idle", Math.floor(time * 1.6 + p.seed * 0.37) % 2];
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
    // superstar: a gold star under his feet so you can always find him
    if (p.star && G.powers !== false) starIcon(x, y + 3, time);
    const onFire = GAME.fireOn(p);
    if (onFire) flames(x, y, time, p.seed, true);
    const img = SPRITES.get(p.team, p.skin || 0, pose, frame, face);
    ctx.drawImage(img, x - SPRITES.OX, y - SPRITES.OY);
    if (onFire) flames(x, y, time, p.seed, false);
  }
  // After a touchdown the scoring team's mascot moonwalks along the sideline: facing one way, gliding the other.
  function mascot(G, time) {
    if (G.phase !== "dead" || !G.celebrate || G.deadT == null) return;
    const team = G.celebrate, T = CFG.TEAMS[team], S = 2;
    const k = 1 - Math.max(0, G.deadT) / 2.6;             // 0 → 1 across the celebration
    const x = Math.round(VW + 40 - k * (VW + 80)), y = 240; // glides right to left...
    const frame = Math.floor(time * 6) % 4;                 // ...while his feet "walk" forward (to the right)
    const img = SPRITES.get(team, 0, "backpedal", frame, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x - 12, y - 2, 24, 4);
    ctx.drawImage(img, x - SPRITES.OX * S, y - SPRITES.OY * S, SPRITES.SW * S, SPRITES.SH * S);
    // the big mascot head, bobbing to the beat
    const bob = Math.floor(time * 6) % 2 * 2;
    ctx.drawImage(MASCOTS.icon(T.id), x - 18, y - 76 - bob, 36, 36);
    if (typeof HOLIDAY !== "undefined" && HOLIDAY.on) { // the mascot dresses for the season
      const art = MASCOTS.ART[T.id], top = art ? Math.max(0, art.findIndex(r => /[^.]/.test(r))) : 0;
      const hy = y - 76 - bob + top * 3 - 2; // sits on the top of this mascot's drawing
      ctx.fillStyle = "#d8342c"; ctx.fillRect(x - 12, hy - 6, 22, 6); ctx.fillRect(x - 6, hy - 11, 14, 5); ctx.fillRect(x + 2, hy - 15, 8, 4);
      ctx.fillStyle = "#f3efe4"; ctx.fillRect(x - 15, hy, 28, 5); ctx.fillRect(x + 9, hy - 18, 6, 6);
    }
    if (k > 0.1 && k < 0.9 && Math.floor(time * 3) % 2) text("♪", x + 22, y - 72, "#ffe14a", 8);
  }
  const sh0 = () => 0;
  function starIcon(x, y, time) {
    const pts = [[2, 0], [3, 0], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [4, 4], [0, 5], [5, 5]];
    const glow = Math.floor(time * 3) % 2;
    ctx.fillStyle = "#000"; for (const [a, b] of pts) ctx.fillRect(x - 3 + a, y + b + 1, 1, 1);
    ctx.fillStyle = glow ? "#ffe14a" : "#ffb627"; for (const [a, b] of pts) ctx.fillRect(x - 3 + a, y + b, 1, 1);
  }
  // On fire: flickering pixel flames, some behind him and some in front.
  function flames(x, y, time, seed, back) {
    const cols = ["#ff3b1f", "#ff7a1a", "#ffb627", "#ffe14a"];
    // tongues of flame rise from his feet up past his helmet, licking upward
    for (let i = 0; i < 12; i++) {
      if ((i % 2 === 0) !== back) continue;
      const ph = time * 10 + i * 1.9 + seed, h = 8 + Math.floor((Math.sin(ph) + 1) * 7);
      const fxp = x - 8 + i * 1.4 + Math.sin(ph * 0.7) * 1.5;
      for (let j = 0; j < h; j += 2) {
        ctx.fillStyle = cols[Math.min(3, Math.floor(j / h * 4 + ((i + Math.floor(time * 12)) % 2)))];
        ctx.fillRect(Math.round(fxp), y - 2 - j - (i % 3) * 3, 2, 2);
      }
    }
  }

  function effects(G) {
    if (!G.fx) return;
    for (const e of G.fx) {
      const k = (G.time - e.t0) / 0.6; if (k < 0 || k > 1) continue;
      const x = sx(e.x), y = sy(e.y);
      if (e.kind === "spark") { // a quick white starburst up at hand height: the ball got hit
        if (k > 0.45) continue;
        ctx.fillStyle = "rgba(255,255,255," + (1 - k * 2) + ")";
        for (let i = 0; i < 6; i++) { const a = i * 1.05, r = 3 + k * 16; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 24 + Math.sin(a) * r * 0.7), 2, 2); }
        continue;
      }
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
    if (G.loose) {
      // A loose ball: shadow on the grass, ball above it, tumbling end over end.
      const l = G.loose, x = sx(l.x), y = sy(l.y), z = Math.round(l.z * 3);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x - 2, y - 1, 4, 2);
      const spin = Math.floor(l.t * 14) % 2 && (l.z > 0.05 || Math.hypot(l.vx, l.vy) > 0.4);
      ctx.fillStyle = "#7a3f12";
      if (spin) ctx.fillRect(x - 1, y - z - 3, 3, 5); else ctx.fillRect(x - 2, y - z - 2, 5, 3);
      ctx.fillStyle = "#fff"; ctx.fillRect(x, y - z - 1, 1, 1);
      return;
    }
    const b = G.ball; if (!b || b.state === "dead" || (b.state === "held" && !b.holder)) return;
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
    // score sits right after each team name, however long the name is (8px per letter)
    text(T[1].short, 8, 7, T[1].trim); text(String(G.score[1]), 8 + T[1].short.length * 8 + 10, 7, "#fff");
    text(String(G.score[2]), VW - 8 - T[2].short.length * 8 - 10, 7, "#fff", 8, "right"); text(T[2].short, VW - 8, 7, T[2].trim, 8, "right");
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

  // Bottom corners: who each side is controlling, and his power if he's the superstar.
  function blurbs(G, time) {
    if (G.phase === "over" || G.phase === "kick" || G.lower) return; // the broadcast graphic takes the bottom

    for (const t of [1, 2]) {
      const p = G.control[t]; if (!p || !p.name) continue;
      const T = CFG.TEAMS[t], left = t === 1, x = left ? 4 : VW - 4, al = left ? "left" : "right";
      const star = p.star && G.powers !== false, h = star ? 30 : 12, w = star ? 236 : Math.max(120, p.name.length * 8 + 40);
      const bx = left ? 2 : VW - 2 - w, by = VH - 16 - h;
      ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = T.color; ctx.fillRect(left ? bx : bx + w - 2, by, 2, h);
      const role = p.role === "CV" ? "" : " · " + (p.role === "DL" ? (p.key === "DL0" || p.key === "DL3" ? "DE" : "DT") : p.role);
      text((star ? "★ " : "") + p.name + role, x + (left ? 4 : -4), by + 2, star ? "#ffe14a" : "#f3efe4", 8, al);
      if (star) {
        text(p.power, x + (left ? 4 : -4), by + 12, T.trim, 8, al);
        text(p.blurb, x + (left ? 4 : -4), by + 21, "#9fb1c5", 8, al);
      }
      if (GAME.fireOn(p)) { ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(bx, by - 11, 64, 11); text("ON FIRE", bx + 4, by - 10, Math.floor(time * 8) % 2 ? "#ff7a1a" : "#ffe14a", 8); }
    }
  }
  function prompts(G) {
    const lines = { 1: "", 2: "" };
    for (const t of [1, 2]) {
      if (!G.human[t]) { lines[t] = "CPU"; continue; }
      const offense = t === G.poss;
      const car = G.ball && G.ball.state === "held" ? G.ball.holder : null;
      if (G.mash) lines[t] = G.mash.pause > 0 ? "GET READY..." : "MASH X + Z!";
      else if (G.phase === "presnap") lines[t] = offense ? "X RUN  Z PASS" + (G.down === 4 ? (G.los >= 62 ? "  ▲ FIELD GOAL" : "  ▲ PUNT") : "") : "X SWITCH  MOVE";
      else if (G.phase === "kick") lines[t] = G.kick.team === t ? "Z KICK!" : "";
      else if (G.phase === "live") {
        const pl = G.play;
        if (car && car.team === t) {
          if (car.role === "QB" && pl.type === "pass" && !pl.thrown && !pl.crossed) lines[t] = "X NEXT  Z THROW";
          else {
            lines[t] = "UP/DN JUKE  FWD TRUCK  BACK STIFF  Z BURST";
          }
        } else if (G.ball.state === "air") lines[t] = G.ball.intended && G.ball.intended.team === t ? "Z CATCH (TIME IT!)" : "Z JUMP (TIME IT!)";
        else lines[t] = "X SWITCH  Z TACKLE (TIME IT!)";
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
    text(m.pause > 0 ? "MASH IN " + Math.ceil(m.pause * 4) / 4 + "..." : "MASH!", VW / 2, y0, "#ffb627", 8, "center");
    ctx.fillStyle = T[m.def.team].color; ctx.fillRect(x0, y0 + 13, w, 8);
    ctx.fillStyle = T[m.car.team].color; ctx.fillRect(x0, y0 + 13, w * m.meter, 8);
    ctx.fillStyle = "#fff"; ctx.fillRect(x0 + w / 2, y0 + 11, 1, 12);
  }

  // A small timing bar over the action: the needle sweeps toward contact; press in the green.
  function timingBar(x, y, t0, t1, now, ideal, w, color, fb, label) {
    const bw = 64, x0 = Math.round(x - bw / 2), span = t1 - t0;
    const px = v => x0 + bw * Math.max(0, Math.min(1, (v - t0) / span));
    ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(x0 - 2, y - 2, bw + 4, 9);
    ctx.fillStyle = "#5a1d1d"; ctx.fillRect(x0, y, bw, 5);
    ctx.fillStyle = "#7fd68f"; ctx.fillRect(px(ideal - w), y, Math.max(2, px(ideal + w) - px(ideal - w)), 5);
    ctx.fillStyle = "#fff"; ctx.fillRect(px(now) - 1, y - 2, 2, 9);
    ctx.fillStyle = color; ctx.fillRect(x0 - 2, y + 7, bw + 4, 1);
    if (label) text(label, x0 - 3, y - 1, color, 8, "right");
  }

  function timing(G) {
    const pl = G.play;
    if (G.phase !== "live" || !pl) return;
    const rep = G.rep;
    if (rep) {
      const [x, y] = barSpot(sx((rep.car.x + rep.def.x) / 2), sy(Math.min(rep.car.y, rep.def.y)));
      const end = rep.tc + 0.12;
      if (G.human[rep.car.team] && G.control[rep.car.team] === rep.car)
        timing_(x, y, rep.t0, end, pl.t, rep.ideal, rep.wOff, CFG.TEAMS[rep.car.team].trim, "RUN");
      if (G.human[rep.def.team] && G.control[rep.def.team] === rep.def)
        timing_(x, y + 11, rep.t0, end, pl.t, rep.ideal, rep.wDef, CFG.TEAMS[rep.def.team].trim, "HIT");
    }
    const b = G.ball;
    if (b && b.state === "air" && b.ideal != null) {
      const [x, y] = barSpot(sx(b.tx), sy(b.ty)), end = b.T + 0.05;
      const off = G.poss, def = off === 1 ? 2 : 1, cp = G.control[def];
      if (G.human[off] && b.intended) timing_(x, y, 0, end, b.t, b.ideal, b.wOff, CFG.TEAMS[off].trim, "CATCH");
      if (G.human[def] && cp && (b.defP === cp || Math.hypot(cp.x - b.tx, cp.y - b.ty) < CFG.CAL.JUMP_RANGE)) timing_(x, y + 11, 0, end, b.t, b.ideal, GAME.windowFor(cp.r.cov), CFG.TEAMS[def].trim, "JUMP");
    }
  }
  // Two bars stack 11px apart above the play. Near the top of the field there isn't room above,
  // so they go just below the players instead; sideways they stay clear of the screen edges (label included).
  function barSpot(x, ySpot) {
    let y = ySpot - 56;
    if (y < 26) y = ySpot + 22;
    return [clamp(x, 80, VW - 38), clamp(y, 26, VH - 14 - 22)];
  }
  function timing_(x, y, t0, t1, now, ideal, w, color, label) { timingBar(x, y, t0, t1, now, ideal, w, color, null, label); }

  function popsDraw(G) {
    if (!G.pops) return;
    for (const p of G.pops) {
      const k = (G.time - p.t0) / 0.9; if (k < 0 || k > 1) continue;
      text(p.text, sx(p.x), sy(p.y) - 40 - k * 14, p.color, 8, "center");
    }
  }

  // TV-style lower third: slides in from the left, team color stripe, kicker tag, name, then the stat line.
  function lowerThird(G, time) {
    const L = G.lower; if (!L) return;
    const T = L.team ? CFG.TEAMS[L.team] : null, col = T ? T.color : "#ffb627", trim = T ? T.trim : "#0e1a2b";
    const w = Math.min(VW - 16, Math.max(L.name.length, L.line.length, (L.sub2 || "").length) * 8 + 28);
    const h = L.sub2 ? 44 : 34, by = G.phase === "kick" ? 56 : VH - 16 - h; // up top while the kick meter is showing
    const inK = Math.min(1, L.t / 0.25), outK = L.dur < 900 ? Math.max(0, Math.min(1, (L.dur - L.t) / 0.25)) : 1;
    const bx = Math.round((VW - w) / 2 - (1 - inK) * (VW / 2 + w) + (1 - outK) * (VW / 2 + w));
    ctx.fillStyle = "rgba(8,12,20,.88)"; ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = col; ctx.fillRect(bx, by, 5, h);
    const kw = L.kicker.length * 8 + 10;
    ctx.fillStyle = col; ctx.fillRect(bx + 5, by - 11, kw, 11);
    text(L.kicker, bx + 10, by - 10, trim === col ? "#f3efe4" : trim, 8);
    text(L.name, bx + 14, by + 5, "#f3efe4", 8);
    text(L.line, bx + 14, by + 19, "#ffe14a", 8);
    if (L.sub2) text(L.sub2, bx + 14, by + 32, "#9fb1c5", 8);
  }

  function bannerDraw(G) {
    const b = G.banner; if (!b) return;
    // Big moments get the middle of the screen. Play results (swats, sacks, first downs...) go in a slim
    // strip along the top of the field so they never hide the play they describe.
    const center = /^(TOUCHDOWN|FINAL|HALFTIME|OVERTIME|END OF|SAFETY|IT'S GOOD|NO GOOD)/.test(b.text) && G.phase !== "kick" && G.phase !== "flight";
    if (center) {
      const big = b.text.length > 12 ? 14 : 20, cy = VH / 2;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, cy - 24, VW, b.sub ? 50 : 38);
      text(b.text, VW / 2, cy - 16, b.color, big, "center");
      if (b.sub) text(b.sub, VW / 2, cy + 10, "#f3efe4", 8, "center");
      return;
    }
    const y0 = 22, line = b.text + (b.sub ? "  ·  " + b.sub : "");
    ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(0, y0, VW, 18);
    text(line, VW / 2, y0 + 5, b.color, 8, "center");
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
    effects(G); timing(G); popsDraw(G);
    mascot(G, time);
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
    weather(G, time);
    hud(G); kickMeter(G); mashMeter(G); bannerDraw(G); blurbs(G, time); lowerThird(G, time); prompts(G);
    if (G.fireMsg) { const k = G.fireMsg; text("HE'S ON FIRE!", VW / 2, 52, Math.floor(time * 8) % 2 ? "#ff7a1a" : "#ffe14a", 16, "center"); text(k.name, VW / 2, 72, CFG.TEAMS[k.team].trim, 8, "center"); }
    if (window.DADMO_DEV) { ctx.fillStyle = "#ffb627"; ctx.fillRect(VW - 34, VH - 26, 30, 10); text("DEV", VW - 31, VH - 25, "#000", 8); }
  }

  // Weather on top of the field (drawn from the clock, so no particle lists to keep).
  function weather(G, time) {
    const k = typeof WEATHER !== "undefined" ? WEATHER.kind() : "clear";
    const h = (i, n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
    const fall = (n, vx, vy, w, hgt, col) => {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const x = ((h(i, 1) * (VW + 80) + time * vx) % (VW + 80) + VW + 80) % (VW + 80) - 40;
        const y = ((h(i, 2) * VH + time * vy * (0.7 + h(i, 3) * 0.6)) % VH + VH) % VH;
        ctx.fillRect(Math.round(x), Math.round(y), w, hgt);
      }
    };
    // WEATHER: OFF in the pause menu turns these off too, so the field is truly clear.
    if (typeof HOLIDAY !== "undefined" && HOLIDAY.on && WEATHER.enabled() && k !== "snow" && k !== "rain" && k !== "neon" && k !== "dome") {
      fall(34, -10, 26, 2, 2, "rgba(255,255,255,.75)"); fall(26, -6, 16, 1, 1, "rgba(255,255,255,.6)"); // light holiday flurries
    }
    switch (k) {
      case "night": ctx.fillStyle = "rgba(10,20,60,.28)"; ctx.fillRect(0, 0, VW, VH); break;
      case "sunset": { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "rgba(255,120,40,.30)"); g.addColorStop(1, "rgba(120,40,90,.10)"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); break; }
      case "dome": ctx.fillStyle = "#3a4250"; ctx.fillRect(0, 0, VW, 6); ctx.fillStyle = "#4c5566"; for (let x = 0; x < VW; x += 24) ctx.fillRect(x, 0, 2, 6); break;
      case "snow":
        ctx.fillStyle = "rgba(235,242,255,.16)"; ctx.fillRect(0, 44, VW, VH - 44);
        fall(90, -14, 38, 2, 2, "rgba(255,255,255,.9)"); fall(60, -8, 22, 1, 1, "rgba(255,255,255,.7)"); break;
      case "rain":
        ctx.fillStyle = "rgba(20,40,70,.22)"; ctx.fillRect(0, 0, VW, VH);
        fall(120, -40, 260, 1, 6, "rgba(170,200,255,.55)"); break;
      case "neon":
        ctx.fillStyle = "rgba(60,0,80,.22)"; ctx.fillRect(0, 0, VW, VH);
        fall(70, -30, 240, 1, 6, "rgba(57,255,106,.55)"); fall(60, -30, 220, 1, 5, "rgba(255,60,200,.5)"); break;
      case "fog":
        // soft drifting banks of fog, thicker toward the far end of the screen
        ctx.fillStyle = "rgba(190,198,205,.14)"; ctx.fillRect(0, 0, VW, VH);
        for (let i = 0; i < 9; i++) {
          const x = ((h(i, 5) * (VW + 300) + time * (5 + h(i, 6) * 8)) % (VW + 300)) - 150, y = 50 + h(i, 7) * 220;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 110);
          g.addColorStop(0, "rgba(215,222,228,.34)"); g.addColorStop(1, "rgba(215,222,228,0)");
          ctx.fillStyle = g; ctx.fillRect(x - 110, y - 110, 220, 220);
        }
        break;
      case "wind": fall(26, 520, 6, 18, 1, "rgba(255,255,255,.35)"); fall(40, 380, 10, 3, 1, "rgba(200,180,120,.6)"); break;
      case "heat":
        ctx.fillStyle = "rgba(255,150,40,.12)"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "rgba(255,240,200,.07)"; for (let y = 60; y < VH; y += 9) ctx.fillRect(Math.round(Math.sin(time * 3 + y) * 4), y, VW, 1);
        if (G.quarter >= 4) text("HEAT: TIRED LEGS", VW - 8, VH - 12, "#ffb627", 8, "right"); break;
      case "sprinklers": {
        const wet = G.quarter >= 4;
        if (wet) { ctx.fillStyle = "rgba(80,160,220,.10)"; ctx.fillRect(0, 44, VW, VH - 44); }
        // water arcs from heads along both sidelines
        ctx.fillStyle = "rgba(190,230,255,.7)";
        for (let j = 0; j < (wet ? 6 : 2); j++) for (let i = 0; i < 14; i++) {
          const t = ((time * 0.8 + i / 14 + j * 0.37) % 1), bx = 40 + j * 80, side = j % 2;
          const x = bx + t * 60, y = (side ? VH - 6 : 46) + (side ? -1 : 1) * (Math.sin(t * Math.PI) * 30);
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
        if (wet) text("SPRINKLERS ON!", VW - 8, VH - 12, "#6fb3a8", 8, "right"); break;
      }
      case "crt":
        fall(40, -6, 18, 1, 1, "rgba(255,255,255,.6)");
        ctx.fillStyle = "rgba(0,0,0,.18)"; for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);
        if (Math.floor(time * 7) % 23 === 0) { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(0, Math.floor(h(Math.floor(time), 4) * VH), VW, 6); }
        break;
    }
  }

  // Pause screen: dims the field and shows a small menu.
  function pauseMenu(items, sel, time, msg) {
    ctx.fillStyle = "rgba(5,10,20,.78)"; ctx.fillRect(0, 0, VW, VH);
    text("PAUSED", VW / 2, items.length > 5 ? 56 : 70, "#ffb627", 20, "center");
    const gap = Math.min(24, Math.max(12, Math.floor(118 / Math.max(1, items.length - 1)))), y0 = items.length > 5 ? 96 : 120;
    items.forEach((it, i) => {
      const y = y0 + i * gap, on = i === sel;
      if (on) { const h = Math.min(18, gap); ctx.fillStyle = "#ffb627"; ctx.fillRect(VW / 2 - 100, y - (h - 8) / 2 - 1, 200, h); }
      text(it, VW / 2, y, on ? "#0e1a2b" : "#f3efe4", 8, "center");
    });
    text("UP / DOWN TO CHOOSE · Z OR X TO SELECT · PAUSE TO RESUME", VW / 2, 258, "#9fb1c5", 8, "center");
    if (msg) text(msg, VW / 2, 272, "#ffb627", 8, "center");
    const code = window.PADS && window.PADS.code && window.PADS.code();
    if (code && !msg) text("ROOM " + code + " · PHONES STAY CONNECTED", VW / 2, 272, "#7fd68f", 8, "center");
  }

  return { init, draw, pauseMenu, text, ctx: () => ctx, VW, VH };
})();
