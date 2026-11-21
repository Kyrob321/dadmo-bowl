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
        text(tm.name, x, 150, "#f3efe4", 8, al);
        text(tm.tag + " · " + tm.star.split(",")[0], x, 164, "#ffe14a", 8, al);
        bars(sl === 1 ? 16 : VW - 16, 186, teams[sl], kk, al);
      }
    }
    if (t > 1.2 && teams.home) {
      const ht = TEAMS.byId[teams[teams.home]];
      text("AT " + ht.short + " STADIUM · " + (WEATHER.enabled() ? WEATHER.KINDS[ht.home].label : "WEATHER OFF"), VW / 2, 250, "#9fb1c5", 8, "center");
    }
    if (t > 1.6) text("Z TO KICK OFF", VW / 2, 270, Math.floor(t * 3) % 2 ? "#f3efe4" : "#ffb627", 8, "center");
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

  return { select, versus, challenger, helmet };
})();
