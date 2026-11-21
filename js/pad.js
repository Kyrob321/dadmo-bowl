// Phone controller: multi-touch d-pad + two buttons, sends the full button state on every change.
(function () {
  const $ = id => document.getElementById(id);
  const state = {}; NET.KEYS.forEach(k => state[k] = false);
  let peer, conn, room, pingTimer, retryTimer, wakeLock;

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
        clearInterval(pingTimer);
        pingTimer = setInterval(() => send({ t: "ping", ts: performance.now() }), 1000);
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
      } else if (msg.t === "pong") {
        send({ t: "rtt", ms: performance.now() - msg.ts });
      } else if (msg.t === "full") {
        setStatus("GAME IS FULL", "bad");
      }
    });
    conn.on("close", () => { clearInterval(pingTimer); if (left) return; setStatus("DROPPED · RETRYING", "bad"); retryTimer = setTimeout(connect, 1500); });
  }

  function sendState() { send({ t: "in", k: Object.assign({}, state, { ax: stick.ax, ay: stick.ay }) }); }

  // --- Joystick (shown on defense): an analog stick; how far you push = how fast you go.
  const stick = { on: false, id: null, ax: 0, ay: 0, lastSent: 0 };
  function showStick(on) {
    if (stick.on === on) return;
    stick.on = on; $("stick").hidden = !on; $("dpad").hidden = on;
    stick.id = null; stick.ax = stick.ay = 0; $("knob").style.transform = ""; $("stick").classList.remove("on");
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
  function keyAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const k = el && el.closest("[data-k]");
    return k ? k.dataset.k : null;
  }
  function refresh() {
    const held = new Set(touchKey.values());
    let changed = false;
    NET.KEYS.forEach(k => {
      if (stick.on && stick.id !== null && ["up", "down", "left", "right"].includes(k)) return; // the stick owns directions
      const on = held.has(k);
      if (state[k] !== on) { state[k] = on; changed = true; }
    });
    document.querySelectorAll("[data-k]").forEach(el => el.classList.toggle("on", state[el.dataset.k]));
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
    wake();
    if (e.type === "touchstart") for (const t of e.changedTouches) { const el = document.elementFromPoint(t.clientX, t.clientY); if (el && el.closest("#leaveBtn")) { leave(); return; } }
    for (const t of e.changedTouches) {
      if (stick.on) {
        if (e.type === "touchstart" && stick.id === null) { const el = document.elementFromPoint(t.clientX, t.clientY); if (el && el.closest("#stick")) { stick.id = t.identifier; stickMove(t.clientX, t.clientY); continue; } }
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
