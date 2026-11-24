// Full-screen moments drawn on the game canvas: team select, the VERSUS slam, and the NEW CHALLENGER unlock.
const SCREENS = (() => {
  const R = () => RENDER.ctx(), VW = 512, VH = 288;
  const text = (...a) => RENDER.text(...a);
  const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

  // A big pixel helmet (facing right, or left if flip), drawn from rectangles so it scales crisply.
  function helmet(x, y, s, team, flip, mystery) {
    const c = R(), t = TEAMS.byId[team] || {}, shell = mystery ? "#3a4658" : t.color, stripe = mystery ? "#55627a" : t.trim;
    const px = (gx, gy, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + (flip ? (14 - gx - w) : gx) * s), Math.round(y + gy * s), w * s, h * s); };
    // outline
    px(2, 0, 9, 1, "#0c0c0e"); px(1, 1, 11, 1, "#0c0c0e"); px(0, 2, 13, 8, "#0c0c0e"); px(1, 10, 11, 1, "#0c0c0e");
    // shell
    px(2, 1, 9, 1, shell); px(1, 2, 11, 7, shell); px(2, 9, 8, 1, shell);
    px(1, 7, 4, 2, shade(shell, -45)); // lower shade
    px(4, 1, 2, 8, stripe);           // center stripe
    px(3, 2, 1, 2, "rgba(255,255,255,.35)"); // shine
    // ear hole and facemask
    px(7, 5, 2, 2, "#0c0c0e");
    px(11, 4, 3, 1, "#b9bec4"); px(11, 7, 3, 1, "#b9bec4"); px(13, 4, 1, 5, "#b9bec4");
    if (mystery) text("?", x + 7 * s, y + 2.5 * s, "#ffb627", Math.round(s * 4), "center");
    else if (typeof HOLIDAY !== "undefined" && HOLIDAY.on) { // Santa hat, flopping toward the back of the helmet
      px(0, -4, 11, 1, "#0c0c0e"); px(-1, -6, 7, 2, "#0c0c0e"); px(-3, -9, 5, 4, "#0c0c0e");            // dark outline
      px(1, -3, 10, 2, "#d8342c"); px(0, -5, 6, 2, "#d8342c"); px(-1, -6, 3, 1, "#d8342c");              // red cap, flopping back
      px(7, -3, 4, 1, "#a81f1a"); px(4, -5, 2, 1, "#a81f1a");                                                 // shade
      px(1, -1, 11, 2, "#f3efe4");                                                                            // white fur trim
      px(-2, -8, 3, 3, "#ffffff");                                                                            // pom-pom
    }
  }
  function shade(hex, amt) {
    if (hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + amt));
    return "#" + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0");
  }
  function backdrop(time) {
    const c = R();
    c.fillStyle = "#0e1a2b"; c.fillRect(0, 0, VW, VH);
    // slow scrolling yard lines
    c.fillStyle = "#16263d"; for (let x = -((time * 20) % 32); x < VW; x += 32) c.fillRect(Math.round(x), 0, 2, VH);
    if (typeof HOLIDAY !== "undefined" && HOLIDAY.on) snow(time);
  }
  // Christmas season: gentle snow over the full-screen moments (worked out from the clock, no particles to keep).
  function snow(time) {
    const c = R(), h = (i, n) => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 70; i++) {
      const big = i < 25, x = ((h(i, 1) * (VW + 40) - time * (big ? 9 : 5) + Math.sin(time + i) * 4) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const y = ((h(i, 2) * VH + time * (big ? 24 : 14) * (0.7 + h(i, 3) * 0.6)) % VH + VH) % VH;
      c.fillStyle = big ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.5)"; c.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
    }
  }
  function bars(x, y, team, k, align) {
    const tp = TEAMS.tape(team), c = R();
    Object.entries(tp).forEach(([lbl, v], i) => {
      const yy = y + i * 16, w = Math.round(v * 9 * ease(k));
      text(lbl, align === "right" ? x : x, yy, "#9fb1c5", 8, align === "right" ? "right" : "left");
      const bx = align === "right" ? x - 64 - w : x + 64;
      c.fillStyle = "#16263d"; c.fillRect(align === "right" ? x - 64 - 90 : x + 64, yy, 90, 8);
      c.fillStyle = CFGtrim(TEAMS.byId[team]) === TEAMS.byId[team].trim ? TEAMS.byId[team].trim : "#f3efe4"; c.fillRect(bx, yy, w, 8);
      c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(bx, yy, w, 2);
    });
  }

  // ---------- team select ----------
  // sel: { 1: {idx, locked, phone, human}, 2: {...} }, list: team ids in order
  function select(S, time) {
    backdrop(time);
    text("CHOOSE YOUR TEAM", VW / 2, 12, "#ffb627", 16, "center");
    for (const s of [1, 2]) {
      const P = S.slot[s], x0 = s === 1 ? 8 : VW / 2 + 4, w = VW / 2 - 12, c = R();
      c.fillStyle = "#16263d"; c.fillRect(x0, 40, w, 206);
      c.fillStyle = s === 1 ? "#c8223a" : "#2f6fd6"; c.fillRect(x0, 40, w, 3);
      text("PLAYER " + s, x0 + 8, 50, s === 1 ? "#ef5a45" : "#6fa0f0", 8);
      const cx = x0 + w / 2;
      if (!P.human) {
        text("COMPUTER", cx, 92, "#f3efe4", 12, "center");
        // difficulty: up / down on the person's controller
        const lv = CFG.DIFFICULTY[S.level], lvls = CFG.DIFFICULTY.length;
        text("LEVEL", cx, 194, "#9fb1c5", 8, "center");
        for (let i = 0; i < lvls; i++) { c.fillStyle = i <= S.level ? "#ffb627" : "#22324a"; c.fillRect(cx - lvls * 13 + i * 26 + 2, 206, 22, 8); }
        text(lv.id, cx, 220, "#ffb627", 10, "center"); text(lv.note, cx, 234, "#9fb1c5", 8, "center");
        if (window.DADMO_DEV) { text("DEV: PLAYS THE", cx, 112, "#ffb627", 8, "center"); text("P2 TEAM FROM THE PANEL", cx, 124, "#ffb627", 8, "center"); }
        else { text("PICKS A RANDOM", cx, 112, "#9fb1c5", 8, "center"); text("UNLOCKED TEAM", cx, 124, "#9fb1c5", 8, "center"); }
        helmet(cx - 28, 140, 4, null, s === 2, true);
        continue;
      }
      if (P.phone) { // secret pick: the TV never shows what you're browsing
        if (P.locked) { helmet(cx - 42, 78, 6, null, s === 2, true); text("LOCKED IN!", cx, 160, "#7fd68f", 12, "center"); text("SECRET UNTIL KICKOFF", cx, 184, "#9fb1c5", 8, "center"); }
        else { const dots = ".".repeat(1 + Math.floor(time * 2) % 3); text("PICKING ON", cx, 110, "#f3efe4", 10, "center"); text("PHONE" + dots, cx, 128, "#f3efe4", 10, "center"); text("(NO PEEKING)", cx, 156, "#9fb1c5", 8, "center"); }
        continue;
      }
      // keyboard player: browse on the TV
      const id = S.list[P.idx], t = TEAMS.byId[id], cd = PROGRESS.card(id);
      helmet(cx - 35, 64, 5, cd.open ? id : null, s === 2, !cd.open);
      text("<", x0 + 12, 84, "#ffb627", 16); text(">", x0 + w - 28, 84, "#ffb627", 16);
      text((P.idx + 1) + "/" + S.list.length, cx, 122, "#9fb1c5", 8, "center");
      if (cd.open) {
        text(t.name, cx, 136, t.color === "#e8f1ff" ? "#e8f1ff" : CFGtrim(t), 8, "center");
        text(t.tag, cx, 152, "#9fb1c5", 8, "center");
        text(t.star.split(",")[0], cx, 170, "#f3efe4", 8, "center");
        if (P.locked) { c.fillStyle = "#7fd68f"; c.fillRect(x0 + 20, 196, w - 40, 22); text("LOCKED IN!", cx, 203, "#0e1a2b", 8, "center"); }
        else if (S.taken && S.taken[s] === id) text("TAKEN · PICK ANOTHER", cx, 203, "#ef5a45", 8, "center");
        else text("Z: LOCK IN", cx, 203, "#ffb627", 8, "center");
      } else {
        text("LOCKED", cx, 136, (S.t - (P.flash || -9)) < 0.6 && Math.floor(S.t * 10) % 2 ? "#ffffff" : "#ef5a45", 10, "center");
        wrap(cd.goal, cx, 156, 26).forEach((ln, i) => text(ln, cx, 156 + i * 12, "#f3efe4", 8, "center"));
        if (cd.prog) progressBar(x0 + 24, 206, w - 48, cd.prog);
      }
    }
    text(S.vsCpu ? "< > TEAM · UP/DOWN LEVEL · Z LOCK IN · X BACK" : "< > BROWSE · Z LOCK IN · X BACK", VW / 2, 258, "#9fb1c5", 8, "center");
  }
  const CFGtrim = t => { const n = parseInt(t.trim.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l < 0.3 ? t.color : t.trim; };
  function wrap(s, cx, y, n) {
    const out = [], words = String(s).split(" "); let line = "";
    for (const w of words) { if ((line + " " + w).trim().length > n) { out.push(line.trim()); line = w; } else line += " " + w; }
    if (line.trim()) out.push(line.trim()); return out;
  }
  function progressBar(x, y, w, [have, need]) {
    const c = R(); c.fillStyle = "#0e1a2b"; c.fillRect(x, y, w, 10);
    c.fillStyle = "#ffb627"; c.fillRect(x + 1, y + 1, Math.round((w - 2) * Math.min(1, have / need)), 8);
    text(have + "/" + need, x + w / 2, y + 14, "#9fb1c5", 8, "center");
  }

  // ---------- VERSUS ----------
  // t: seconds since the reveal started. Helmets fly in, slam at 0.55s, then the tale of the tape fills in.
  function versus(teams, t) {
    const c = R();
    backdrop(t);
    const slam = 0.55, k = ease(t / slam);
    // team color halves
    c.fillStyle = TEAMS.byId[teams[1]].color; c.fillRect(Math.round(-VW / 2 + k * VW / 2) - 20, 0, VW / 2 + 20, VH);
    c.fillStyle = TEAMS.byId[teams[2]].color; c.fillRect(Math.round(VW - k * VW / 2), 0, VW / 2 + 20, VH);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(0, 0, VW, VH);
    // the helmets meet in the middle
    const hx1 = -120 + k * (VW / 2 - 96 + 120), hx2 = VW + 20 - k * (VW + 20 - VW / 2 - 12);
    const bump = t > slam && t < slam + 0.25 ? Math.sin((t - slam) * 60) * 3 : 0;
    helmet(hx1 - bump, 34, 6, teams[1], false);
    helmet(hx2 + bump, 34, 6, teams[2], true);
    if (t > slam && t < slam + 0.12) { c.fillStyle = "rgba(255,255,255,.85)"; c.fillRect(0, 0, VW, VH); }
    if (t > slam) {
      const s = Math.max(1, 3 - (t - slam) * 8);
      text("VS", VW / 2, 112, "#ffb627", Math.round(24 * s), "center");
      const kk = (t - slam - 0.2) / 0.8;
      for (const sl of [1, 2]) {
        const tm = TEAMS.byId[teams[sl]], x = sl === 1 ? 16 : VW - 16, al = sl === 1 ? "left" : "right";
        text(tm.name, x, 144, "#f3efe4", 8, al);
        text(tm.tag, x, 156, "#f3efe4", 8, al);
        text("★ " + tm.star.split(",")[0], x, 168, "#ffe14a", 8, al);
        bars(sl === 1 ? 16 : VW - 16, 182, teams[sl], kk, al);
      }
    }
    // Matchup memory: how these two have done against each other on this laptop.
    if (t > 0.9) { c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(0, 241, VW, VH - 241); } // readable on any team color
    if (t > 0.9 && typeof BROADCAST !== "undefined") {
      const m = BROADCAST.memoryLines(teams[1], teams[2]);
      text(m.head, VW / 2, 246, "#f3efe4", 8, "center");
      if (m.sub) text(m.sub, VW / 2, 257, "#ffb627", 8, "center");
    }
    if (t > 1.2 && teams.home) {
      const ht = TEAMS.byId[teams[teams.home]];
      text("AT " + ht.short + " STADIUM · " + (WEATHER.enabled() ? WEATHER.KINDS[ht.home].label : "WEATHER OFF"), VW / 2, 268, "#9fb1c5", 8, "center");
    }
    if (t > 1.6) text("Z: MEET THE SUPERSTARS", VW / 2, 279, Math.floor(t * 3) % 2 ? "#f3efe4" : "#ffb627", 8, "center");
  }

  // ---------- NEW CHALLENGER ----------
  function challenger(id, t) {
    const c = R(), tm = TEAMS.byId[id];
    backdrop(t);
    // sweeping light bars
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "rgba(255,182,39,.10)" : "rgba(255,255,255,.05)"; const x = ((t * 160 + i * 110) % (VW + 200)) - 100; c.fillRect(Math.round(x), 0, 40, VH); }
    if (t < 0.15) { c.fillStyle = "#fff"; c.fillRect(0, 0, VW, VH); }
    const blink = Math.floor(t * 4) % 2;
    text("A NEW CHALLENGER", VW / 2, 22, blink ? "#ffb627" : "#ef5a45", 16, "center");
    text("HAS UNLOCKED!", VW / 2, 46, blink ? "#ffb627" : "#ef5a45", 16, "center");
    const k = ease((t - 0.3) / 0.6);
    helmet(VW / 2 - 42, 80 + (1 - k) * -120, 6, id, false);
    if (t > 0.9) {
      text(tm.name, VW / 2, 160, "#f3efe4", 12, "center");
      text(tm.tag, VW / 2, 182, "#9fb1c5", 8, "center");
      text("SUPERSTAR " + tm.star, VW / 2, 200, "#ffe14a", 8, "center");
    }
    if (t > 1.6) text("PICK THEM NEXT GAME · Z TO CONTINUE", VW / 2, 252, "#9fb1c5", 8, "center");
  }

  // ---------- STAR WALKOUT ----------
  // The superstar walks out of a pixel tunnel into a spotlight. slot: 1 or 2 (uses that slot's uniform).
  function walkout(teamId, slot, t) {
    const c = R(), tm = TEAMS.byId[teamId], inf = STARS.info(teamId, STARS.DEF[teamId].keys[0]);
    c.fillStyle = "#05070c"; c.fillRect(0, 0, VW, VH);
    // the tunnel: rings in team colors rushing toward you
    const cx = VW / 2, cy = 120;
    for (let i = 9; i >= 0; i--) {
      const z = ((i + (t * 2.2) % 1) / 10), w = 30 + z * z * 900, h = 20 + z * z * 560;
      c.fillStyle = i % 2 ? tm.color : tm.dark; c.globalAlpha = Math.min(1, z * 1.6);
      c.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
      c.fillStyle = "#05070c"; c.fillRect(Math.round(cx - w / 2 + 3), Math.round(cy - h / 2 + 3), Math.round(w - 6), Math.round(h - 6));
    }
    c.globalAlpha = 1;
    // tunnel lights flicker on as he walks
    for (let i = 0; i < 6; i++) if (t * 4 > i) { c.fillStyle = "#ffe9a8"; c.fillRect(cx - 120 + i * 48, 26, 6, 3); }
    // spotlight cone
    const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "rgba(255,240,190,.28)"); g.addColorStop(1, "rgba(255,240,190,.06)");
    c.fillStyle = g; c.beginPath(); c.moveTo(cx - 14, 0); c.lineTo(cx + 14, 0); c.lineTo(cx + 90, VH); c.lineTo(cx - 90, VH); c.closePath(); c.fill();
    // smoke along the floor
    for (let i = 0; i < 14; i++) { const x = ((i * 53 + t * 30) % (VW + 80)) - 40; c.fillStyle = "rgba(200,210,220,.10)"; c.fillRect(Math.round(x), 238 + (i % 3) * 6, 70, 14); }
    // the star walks toward the camera and grows
    const k = ease(Math.min(1, t / 1.6)), sc = 1 + k * 3, y = 150 + k * 108;
    const arrived = t > 1.6;
    const img = SPRITES.get(slot, 0, arrived ? "celebrate" : "run", arrived ? Math.floor(t * 4) % 2 : Math.floor(t * 9) % 6, 1);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(Math.round(cx - 7 * sc), Math.round(y - 1), Math.round(14 * sc), Math.max(2, Math.round(2 * sc)));
    c.drawImage(img, Math.round(cx - SPRITES.OX * sc), Math.round(y - SPRITES.OY * sc), Math.round(SPRITES.SW * sc), Math.round(SPRITES.SH * sc));
    // camera flashes in the crowd once he's out
    if (arrived) for (let i = 0; i < 5; i++) if (Math.random() < 0.25) { c.fillStyle = "#fff"; c.fillRect(Math.random() * VW, 8 + Math.random() * 40, 2, 2); }
    // name card
    if (t > 0.5) {
      text(tm.name, 14, 14, CFGtrim(tm), 8);
      text(inf.name, 14, 28, "#f3efe4", 16);
    }
    if (t > 1.1) {
      c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(VW - 236, 200, 228, 40);
      text("★ " + inf.power, VW - 14, 206, "#ffe14a", 10, "right");
      text(inf.blurb, VW - 14, 224, "#9fb1c5", 8, "right");
    }
    text("Z TO SKIP", VW - 8, VH - 12, "#55627a", 8, "right");
  }

  return { select, versus, challenger, helmet, walkout };
})();
