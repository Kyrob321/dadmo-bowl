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
        retryTimer = setTimeout(connect, 2500);
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
      } else if (msg.t === "pong") {
        send({ t: "rtt", ms: performance.now() - msg.ts });
      } else if (msg.t === "full") {
        setStatus("GAME IS FULL", "bad");
      }
    });
    conn.on("close", () => { clearInterval(pingTimer); setStatus("DROPPED · RETRYING", "bad"); retryTimer = setTimeout(connect, 1500); });
  }

  function sendState() { send({ t: "in", k: Object.assign({}, state) }); }

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
      const on = held.has(k);
      if (state[k] !== on) { state[k] = on; changed = true; }
    });
    document.querySelectorAll("[data-k]").forEach(el => el.classList.toggle("on", state[el.dataset.k]));
    if (changed) sendState();
  }
  function onTouch(e) {
    e.preventDefault();
    wake();
    for (const t of e.changedTouches) {
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
  pad.addEventListener("mousedown", e => { mouseDown = true; const k = keyAt(e.clientX, e.clientY); if (k) touchKey.set("m", k); refresh(); });
  addEventListener("mouseup", () => { if (!mouseDown) return; mouseDown = false; touchKey.delete("m"); refresh(); });

  // Keep the phone screen awake while playing (iOS 18.4+ in home-screen mode).
  async function wake() {
    if (wakeLock || !("wakeLock" in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { wake(); if (!conn || !conn.open) connect(); }
  });

  // Room code from the QR link, or typed in.
  room = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "");
  function startWith(c) {
    room = c.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (room.length !== 4) return false;
    $("joinForm").hidden = true;
    try { history.replaceState(null, "", "?room=" + room); } catch (e) {}
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
