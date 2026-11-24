// Phone controller: multi-touch d-pad + two buttons, sends the full button state on every change.
(function () {
  const $ = id => document.getElementById(id);
  const state = {}; NET.KEYS.forEach(k => state[k] = false);
  let peer, conn, room, pingTimer, retryTimer, wakeLock, lastPong = 0;

  // A stable id per phone, so a dropped phone gets its own slot back.
  let clientId;
  try { clientId = localStorage.getItem("dadmo-id"); } catch (e) {}
  if (!clientId) {
    clientId = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem("dadmo-id", clientId); } catch (e) {}
  }

  function setStatus(t, cls) { const s = $("status"); s.textContent = t; s.className = cls || ""; }

  function send(msg) { if (conn && conn.open) conn.send(msg); }

  function connect() {
    clearTimeout(retryTimer);
    setStatus("CONNECTING");
    if (!peer || peer.destroyed) {
      peer = new Peer();
      peer.on("open", () => dial());
      peer.on("error", err => {
        if (err.type === "peer-unavailable") setStatus("ROOM NOT FOUND", "bad");
        else setStatus("LINK ERROR", "bad");
        console.error(err);
        if (!left) retryTimer = setTimeout(connect, 2500);
      });
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
    } else dial();
  }

  function dial() {
    conn = peer.connect(NET.peerId(room), { reliable: false, serialization: "json" });
    conn.on("open", () => { send({ t: "hello", id: clientId }); });
    conn.on("data", msg => {
      if (msg.t === "welcome") {
        $("who").textContent = "PLAYER " + msg.slot;
        $("who").className = "p" + msg.slot;
        setStatus("CONNECTED", "ok");
        sendState();
        clearInterval(pingTimer); lastPong = performance.now();
        // Watchdog: if the TV stops answering (phone was locked, Wi-Fi blip), reconnect instead of looking connected.
        pingTimer = setInterval(() => {
          if (performance.now() - lastPong > 4500) {
            clearInterval(pingTimer); setStatus("RECONNECTING", "bad");
            const dead = conn; try { dead.close(); } catch (e) {} // the close handler retries
            setTimeout(() => { if (!left && conn === dead) connect(); }, 4000); // in case "close" never fires
            return;
          }
          send({ t: "ping", ts: performance.now() });
        }, 1000);
      } else if (msg.t === "labels") {
        // Button labels follow the game: RUN/PASS before the snap, THROW/NEXT in the pocket, TACKLE/SWITCH on defense...
        for (const [k, id] of [["x", "lx"], ["z", "lz"], ["up", "lup"], ["down", "ldown"], ["left", "lleft"], ["right", "lright"]]) {
          const el = $(id); const v = msg[k] || "";
          if (el.textContent !== v) {
            el.textContent = v;
            if (k === "x" || k === "z") { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 250); }
          }
        }
        showStick(!!msg.stick);
        document.querySelector('.b[data-k="x"]').classList.toggle("off", !msg.x);
        document.querySelector('.b[data-k="z"]').classList.toggle("off", !msg.z);
        const bb = $("boostBtn"); bb.hidden = !msg.b; bb.textContent = "BOOST"; bb.classList.toggle("off", !msg.b || msg.b.endsWith("…"));
      } else if (msg.t === "sheet") {
        // The link can drop a message, so the TV repeats this until the phone says it got it.
        send({ t: "ack", id: msg.id });
        if (msg.id !== lastSheet) { lastSheet = msg.id; showSheet(msg); }
      } else if (msg.t === "pick") {
        showPick(msg);
      } else if (msg.t === "pong") {
        lastPong = performance.now();
        send({ t: "rtt", ms: performance.now() - msg.ts });
      } else if (msg.t === "full") {
        setStatus("GAME IS FULL", "bad");
      }
    });
    conn.on("close", () => { clearInterval(pingTimer); if (left) return; setStatus("DROPPED · RETRYING", "bad"); retryTimer = setTimeout(connect, 1500); });
  }

  // Backup / restore, opened from the TV's pause menu: the code lives on the phone, where it can be copied
  // into Notes or pasted back in (the laptop may be across the room in full screen).
  let lastSheet = null, restoreTimer = null;
  function showSheet(m) {
    const sh = $("sheet"), ta = $("sheetCode"), go = $("sheetGo"), note = $("sheetNote");
    if (m.kind === "close") { clearInterval(restoreTimer); sh.hidden = true; ta.blur(); return; }
    if (m.kind === "result") { clearInterval(restoreTimer); note.textContent = m.text || ""; note.style.color = m.ok ? "" : "#ef5a45"; if (m.ok) setTimeout(() => { sh.hidden = true; }, 1800); return; }
    touchKey.clear(); if (stick.id !== null) stickRelease(); refresh(); // nothing stays held behind the sheet
    note.textContent = ""; note.style.color = ""; sh.hidden = false;
    if (m.kind === "backup") {
      $("sheetMsg").textContent = "YOUR BACKUP CODE. TAP COPY, THEN PASTE IT INTO NOTES TO KEEP IT SAFE.";
      ta.value = m.code || ""; ta.readOnly = true; go.textContent = "COPY";
      go.onclick = () => {
        const done = () => { note.style.color = ""; note.textContent = "COPIED! NOW PASTE IT INTO NOTES."; };
        const manual = () => { note.style.color = "#ffb627"; note.textContent = "PRESS AND HOLD THE CODE, TAP SELECT ALL, THEN COPY."; };
        // Copy inside the tap itself (iOS only allows it there): select the text, then try the old way first.
        ta.readOnly = false; ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
        let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
        ta.readOnly = true;
        if (ok) return done();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, manual); else manual();
      };
    } else {
      $("sheetMsg").textContent = "PASTE YOUR BACKUP CODE BELOW (OR TYPE UNDO TO BRING BACK PROGRESS FROM BEFORE THE LAST RESET).";
      ta.value = ""; ta.readOnly = false; go.textContent = "RESTORE";
      go.onclick = () => {
        const v = ta.value.trim(); if (!v) { ta.focus(); return; }
        note.style.color = ""; note.textContent = "SENDING…";
        // Sent again every second until the TV answers (the link can drop a message); the TV only uses it once.
        const rid = Date.now() + "" + Math.random(); let n = 0;
        clearInterval(restoreTimer); send({ t: "restore", code: v, rid });
        restoreTimer = setInterval(() => { if (++n > 6) { clearInterval(restoreTimer); note.style.color = "#ef5a45"; note.textContent = "NO ANSWER FROM THE TV. TAP RESTORE AGAIN."; return; } send({ t: "restore", code: v, rid }); }, 1000);
      };
      setTimeout(() => ta.focus(), 50);
    }
    $("sheetClose").onclick = () => { clearInterval(restoreTimer); sh.hidden = true; ta.blur(); };
  }

  // Team select: a private card in the middle of the pad. Nobody else can see what you're browsing.
  function showPick(m) {
    const box = $("pick"), logo = $("logoMid");
    if (m.off) { box.hidden = true; logo.hidden = false; return; }
    box.hidden = false; logo.hidden = true;
    const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    let h = '<div class="pk-n">' + (m.level ? '<b class="pk-lvl">VS CPU: ' + esc(m.level) + ' ▲▼</b>' : '') + esc(m.n) + '</div>';
    if (m.open) {
      h += '<div class="pk-helm" style="background:' + esc(m.helm || m.color) + ';box-shadow:inset 0 0 0 4px ' + esc(m.trim) + '"></div>';
      h += '<div class="pk-name" style="color:' + esc(m.color) + '">' + esc(m.name) + '</div><div class="pk-tag">' + esc(m.tag) + '</div><div class="pk-star">' + esc(m.star) + '</div>';
      if (m.tape) h += '<div class="pk-tape">' + Object.entries(m.tape).map(([k, v]) => '<span>' + esc(k) + '</span><i><b style="width:' + (v * 10) + '%;background:' + esc(m.color) + '"></b></i>').join("") + '</div>';
      h += m.locked ? '<div class="pk-lock ok">LOCKED IN! WAITING…</div>' : m.taken ? '<div class="pk-lock bad">TAKEN · PICK ANOTHER</div>' : '<div class="pk-lock">Z TO LOCK IN</div>';
    } else {
      h += '<div class="pk-helm mystery">?</div><div class="pk-name">' + esc(m.name) + '</div><div class="pk-tag bad">LOCKED</div><div class="pk-star">' + esc(m.goal) + '</div>';
      if (m.prog) h += '<div class="pk-prog"><b style="width:' + Math.min(100, 100 * m.prog[0] / m.prog[1]) + '%"></b></div><div class="pk-tag">' + m.prog[0] + '/' + m.prog[1] + '</div>';
    }
    box.innerHTML = h;
  }

  // Messages can get lost or arrive out of order on the fast (unreliable) link, so each one is numbered
  // and the latest state is sent again a few times a second; the TV ignores anything older than what it has.
  let seq = 0, lastSend = 0;
  // c = how many times each button has been pressed, so the TV can count a tap even if it never saw it "down".
  const presses = {};
  function sendState() { lastSend = performance.now(); send({ t: "in", q: ++seq, k: Object.assign({}, state, { ax: stick.ax, ay: stick.ay, c: Object.assign({}, presses) }) }); }
  setInterval(() => { if (performance.now() - lastSend > 120) sendState(); }, 150);

  // --- Joystick (shown on defense): an analog stick; how far you push = how fast you go.
  const stick = { on: false, id: null, ax: 0, ay: 0, lastSent: 0 };
  function showStick(on) {
    if (stick.on === on) return;
    stick.on = on; $("stick").hidden = !on; $("dpad").hidden = on;
    stick.id = null; stick.ax = stick.ay = 0; $("knob").style.transform = ""; $("stick").classList.remove("on");
    state.up = state.down = state.left = state.right = false;
    sendState();
  }
  function stickMove(x, y) {
    const r = $("stick").getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * 0.36;
    let dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    let ax = dx / max, ay = dy / max;
    if (Math.hypot(ax, ay) < 0.15) ax = ay = 0;          // small dead zone in the middle
    stick.ax = Math.round(ax * 100) / 100; stick.ay = Math.round(ay * 100) / 100;
    $("knob").style.transform = "translate(" + dx + "px," + dy + "px)";
    $("stick").classList.toggle("on", !!(stick.ax || stick.ay));
    // Also set the plain directions (menus use them), then send at most ~40 times a second.
    state.up = stick.ay < -0.5; state.down = stick.ay > 0.5; state.left = stick.ax < -0.5; state.right = stick.ax > 0.5;
    // Send at most ~40 times a second, but always deliver the latest position (trailing send).
    const now = performance.now();
    if (now - stick.lastSent > 25) { stick.lastSent = now; clearTimeout(stick.pending); sendState(); }
    else { clearTimeout(stick.pending); stick.pending = setTimeout(() => { stick.lastSent = performance.now(); sendState(); }, 26); }
  }
  function stickRelease() {
    stick.id = null; stick.ax = stick.ay = 0; state.up = state.down = state.left = state.right = false;
    $("knob").style.transform = ""; $("stick").classList.remove("on"); sendState();
  }

  // --- Touch handling: every finger is tracked, so you can hold a direction and press a button.
  const touchKey = new Map(); // touch id -> key
  // Generous tap zones: a touch anywhere near the D-pad picks the direction it leans toward, and a touch
  // anywhere on the right side goes to the nearest of X and Z. Only PAUSE and LEAVE need an exact hit.
  function keyAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const pill = el && el.closest(".pill[data-k]");
    if (pill) return pill.dataset.k;
    if (el && el.closest(".bar, .join-form")) return null;
    const dp = $("dpad");
    if (!dp.hidden) {
      const r = dp.getBoundingClientRect(), reach = r.width * 0.45;
      if (x > r.left - reach && x < r.right + reach && y > r.top - reach && y < r.bottom + reach) {
        const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < r.width * 0.1) return null; // dead center: no direction
        return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      }
    }
    let best = null, bd = Infinity, size = 0;
    for (const b of document.querySelectorAll(".b[data-k]")) {
      const r = b.getBoundingClientRect(), w = b.offsetWidth; // offsetWidth: the real size (the row is tilted)
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) - w / 2;
      if (d < bd) { bd = d; best = b.dataset.k; size = w; }
    }
    const bb = $("boostBtn"); // the wide BOOST bar (defense only), measured in its own tilted frame
    if (!bb.hidden) {
      const r = bb.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = 12 * Math.PI / 180;
      const lx = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), ly = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a); // undo the -12° tilt
      const d = Math.hypot(Math.max(Math.abs(lx) - bb.offsetWidth / 2, 0), Math.max(Math.abs(ly) - bb.offsetHeight / 2, 0));
      if ((d === 0 && bd > 0) || (d < 10 && d + 14 < bd)) return "b"; // on the bar itself = BOOST; near its edge, X and Z win close calls
    }
    return bd < Math.max(50, size * 0.5) ? best : null; // reach: about half a button past its edge
  }
  // A quick tap still counts: every press stays down at least MIN_HOLD ms, so the TV (60 frames a second)
  // always sees it, even if the finger lifts right away.
  const MIN_HOLD = 90, pressAt = {};
  let holdTimer = null;
  function refresh() {
    const held = new Set(touchKey.values()), now = performance.now();
    let changed = false, wait = 0;
    NET.KEYS.forEach(k => {
      if (stick.on && stick.id !== null && ["up", "down", "left", "right"].includes(k)) return; // the stick owns directions
      let on = held.has(k);
      if (on && !state[k]) { pressAt[k] = now; presses[k] = (presses[k] || 0) + 1; }
      if (!on && state[k] && now - pressAt[k] < MIN_HOLD) { on = true; wait = Math.max(wait, MIN_HOLD - (now - pressAt[k])); }
      if (state[k] !== on) { state[k] = on; changed = true; }
    });
    if (wait) { clearTimeout(holdTimer); holdTimer = setTimeout(refresh, wait + 2); }
    document.querySelectorAll("[data-k]").forEach(el => el.classList.toggle("on", !!state[el.dataset.k]));
    if (changed) sendState();
  }
  // LEAVE: tap once to arm, tap again within 2 seconds to leave. Frees your player slot on the TV.
  let leaveArmed = 0;
  function leave() {
    if (Date.now() - leaveArmed > 2000) { leaveArmed = Date.now(); $("leaveBtn").classList.add("armed"); $("leaveBtn").textContent = "TAP TO CONFIRM";
      setTimeout(() => { if (Date.now() - leaveArmed >= 2000) { $("leaveBtn").classList.remove("armed"); $("leaveBtn").textContent = "LEAVE"; } }, 2100); return; }
    send({ t: "bye" });
    try { localStorage.removeItem("dadmo-pad-room"); } catch (e) {}
    left = true; clearInterval(pingTimer); clearTimeout(retryTimer);
    setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} }, 300);
    $("joinMsg").textContent = "YOU LEFT THE GAME. SCAN THE TV AGAIN OR ENTER THE CODE TO REJOIN.";
    $("joinForm").hidden = false;
    $("codeGo").onclick = () => { left = false; peer = null; if (!startWith($("codeIn").value)) $("codeIn").focus(); };
  }
  let left = false;

  function onTouch(e) {
    e.preventDefault();
    if (!$("sheet").hidden) { if (touchKey.size) { touchKey.clear(); refresh(); } return; } // nothing presses behind the sheet
    wake();
    // A finger the phone no longer reports (a missed lift) can't keep a button held.
    const live = new Set([...e.touches].map(t => t.identifier));
    for (const id of [...touchKey.keys()]) if (id !== "m" && !live.has(id)) touchKey.delete(id);
    if (stick.id !== null && stick.id !== "m" && !live.has(stick.id) && e.type !== "touchend" && e.type !== "touchcancel") stickRelease();
    if (e.type === "touchstart") for (const t of e.changedTouches) { const el = document.elementFromPoint(t.clientX, t.clientY); if (el && el.closest("#leaveBtn")) { leave(); return; } }
    for (const t of e.changedTouches) {
      if (stick.on) { // on defense, a touch anywhere on the left side grabs the stick
        if (e.type === "touchstart" && stick.id === null) { const el = document.elementFromPoint(t.clientX, t.clientY); if ((el && el.closest("#stick")) || (t.clientX < innerWidth * 0.42 && !(el && el.closest(".bar")))) { stick.id = t.identifier; stickMove(t.clientX, t.clientY); continue; } }
        if (t.identifier === stick.id) { if (e.type === "touchend" || e.type === "touchcancel") stickRelease(); else stickMove(t.clientX, t.clientY); continue; }
      }
      if (e.type === "touchend" || e.type === "touchcancel") touchKey.delete(t.identifier);
      else {
        const k = keyAt(t.clientX, t.clientY);
        if (k) touchKey.set(t.identifier, k); else touchKey.delete(t.identifier);
      }
    }
    refresh();
  }
  const pad = $("pad");
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(ev => pad.addEventListener(ev, onTouch, { passive: false }));

  // Mouse support, for testing on a computer.
  let mouseDown = false;
  pad.addEventListener("mousedown", e => { if (e.target.closest("#leaveBtn")) { leave(); return; }
    if (stick.on && e.target.closest("#stick")) { stick.id = "m"; stickMove(e.clientX, e.clientY); return; }
    mouseDown = true; const k = keyAt(e.clientX, e.clientY); if (k) touchKey.set("m", k); refresh(); });
  addEventListener("mousemove", e => { if (stick.id === "m") stickMove(e.clientX, e.clientY); });
  addEventListener("mouseup", () => { if (stick.id === "m") { stickRelease(); return; } if (!mouseDown) return; mouseDown = false; touchKey.delete("m"); refresh(); });

  // Keep the phone screen awake while playing (iOS 18.4+ in home-screen mode).
  async function wake() {
    if (wakeLock || !("wakeLock" in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { touchKey.clear(); if (stick.id !== null) stickRelease(); refresh(); }
    if (document.visibilityState === "visible") { wake(); if (!conn || !conn.open) connect(); }
  });

  // Room code from the QR link, or typed in.
  // Remember the room: once you've scanned, opening the controller again (even from the home screen) rejoins.
  let savedRoom = null; try { savedRoom = localStorage.getItem("dadmo-pad-room"); } catch (e) {}
  room = (new URLSearchParams(location.search).get("room") || savedRoom || "").toUpperCase().replace(/[^A-Z]/g, "");
  function startWith(c) {
    room = c.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (room.length !== 4) return false;
    $("joinForm").hidden = true;
    try { history.replaceState(null, "", "?room=" + room); localStorage.setItem("dadmo-pad-room", room); } catch (e) {}
    connect();
    return true;
  }
  if (typeof Peer === "undefined") { setStatus("NO INTERNET?", "bad"); }
  else if (room.length === 4) startWith(room);
  else {
    $("joinForm").hidden = false;
    $("codeGo").addEventListener("click", () => { if (!startWith($("codeIn").value)) $("codeIn").focus(); });
    $("codeIn").addEventListener("keydown", e => { if (e.key === "Enter") $("codeGo").click(); });
  }
})();
