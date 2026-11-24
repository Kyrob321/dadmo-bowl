// TV screen: opens a room, shows the QR code, assigns phones to player slots,
// and lights up each player's buttons so we can feel the lag.
(function () {
  const $ = id => document.getElementById(id);
  const slots = { 1: null, 2: null };          // slot -> clientId
  const conns = {};                             // clientId -> DataConnection
  const inputs = { 1: {}, 2: {} };              // slot -> {key: bool}
  let peer, code;

  function padUrl(c) {
    const base = location.href.replace(/[^/]*([?#].*)?$/, "");
    const x = new URLSearchParams(location.search).get("xmas"); // testing: phones follow a forced holiday on/off
    return base + "pad.html?room=" + c + (x === "1" || x === "0" ? "&xmas=" + x : "");
  }

  function showRoom() {
    $("code").textContent = code;
    const url = padUrl(code);
    $("url").textContent = url.replace(/^https?:\/\//, "");
    $("qr").innerHTML = "";
    new QRCode($("qr"), { text: url, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M });
  }

  function setNet(text, cls) { const n = $("net"); n.textContent = text; n.className = "net " + (cls || ""); }

  // The room code is saved on this computer and reused, so a phone that scanned once stays attached,
  // even after the page reloads. If the old code is still being released by the server, retry it for
  // a little while before giving up and making a new one.
  let saved = null;
  try { saved = localStorage.getItem("dadmo-room"); } catch (e) {}
  function openRoom(tries) {
    tries = tries || 0;
    code = (saved && tries < 24) ? saved : NET.newCode(); // keep trying the same code ~1 minute, so phones find the room again
    peer = new Peer(NET.peerId(code));
    peer.on("open", () => { showRoom(); setNet("READY · WAITING FOR PHONES", "ok"); try { localStorage.setItem("dadmo-room", code); } catch (e) {} saved = code; });
    peer.on("connection", onConn);
    peer.on("disconnected", () => { setNet("RECONNECTING…", "bad"); try { peer.reconnect(); } catch (e) {} });
    peer.on("error", err => {
      if (err.type === "unavailable-id") {
        peer.destroy();
        if (saved && tries < 24) { setNet("REOPENING ROOM " + saved + "…", ""); setTimeout(() => openRoom(tries + 1), 2500); }
        else { saved = null; openRoom(99); }
        return;
      }
      setNet("LINK ERROR: " + String(err.type || err).toUpperCase(), "bad");
      console.error(err);
    });
  }

  function slotFor(clientId) {
    for (const s of [1, 2]) if (slots[s] === clientId) return s;          // rejoin same slot
    for (const s of [1, 2]) if (!slots[s] || !conns[slots[s]]) { slots[s] = clientId; return s; }
    return 0;                                                              // full
  }

  function onConn(conn) {
    conn.on("data", msg => {
      if (!msg || typeof msg !== "object") return;
      if (msg.t === "hello") {
        const s = slotFor(msg.id);
        if (!s) { conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); return; }
        if (conns[msg.id] && conns[msg.id] !== conn) conns[msg.id].close();
        conns[msg.id] = conn; conn._slot = s; conn._id = msg.id; inputs[s] = {}; // start clean: nothing held, no old press counts
        conn.send({ t: "welcome", slot: s });
        lastLabels[s] = null; lastPick[s] = null; // make sure this phone gets the current labels and pick
        $("slot" + s).classList.add("in");
        $("state" + s).textContent = "READY";
      } else if (msg.t === "bye") {
        // A phone left on purpose: free its player slot so another phone can take it.
        const s = conn._slot;
        if (s && slots[s] === conn._id) { slots[s] = null; delete conns[conn._id]; inputs[s] = {}; draw(s);
          $("slot" + s).classList.remove("in"); $("state" + s).textContent = "OPEN · SCAN TO JOIN"; $("lag" + s).textContent = ""; }
        conn._slot = null; setTimeout(() => conn.close(), 200);
      } else if (msg.t === "in" && conn._slot && conns[conn._id] === conn) {
        if (msg.q != null) { if (conn._q != null && msg.q <= conn._q) return; conn._q = msg.q; } // stale or repeated
        inputs[conn._slot] = msg.k || {};
        draw(conn._slot);
      } else if (msg.t === "ack" && conn._slot) {
        const p = pending[conn._slot]; if (p && p.id === msg.id) pending[conn._slot] = null;
      } else if (msg.t === "restore" && conn._slot && conns[conn._id] === conn) {
        // The phone repeats this until it hears back; use it once, and just repeat the answer after that.
        const s = conn._slot, code = String(msg.code || "");
        if (msg.rid && doneRid[s] && doneRid[s].rid === msg.rid) { window.PADS.sheet(s, doneRid[s].res); return; }
        const res = code.length > 400000 ? { kind: "result", ok: false, text: "THAT CODE IS TOO LONG. CHECK IT WAS COPIED RIGHT." }
          : window.PADS.onRestore ? window.PADS.onRestore(s, code) : null;
        if (res) { doneRid[s] = { rid: msg.rid, res }; window.PADS.sheet(s, res); }
      } else if (msg.t === "ping") {
        conn.send({ t: "pong", ts: msg.ts });
      } else if (msg.t === "rtt" && conn._slot) {
        $("lag" + conn._slot).textContent = "LAG " + Math.round(msg.ms / 2) + " MS (ONE WAY)";
      }
    });
    conn.on("close", () => {
      const s = conn._slot;
      if (!s || conns[conn._id] !== conn) return;
      delete conns[conn._id];
      inputs[s] = {}; draw(s);
      $("slot" + s).classList.remove("in");
      $("state" + s).textContent = "DROPPED · SCAN TO REJOIN";
      $("lag" + s).textContent = "";
    });
  }

  function draw(s) {
    $("view" + s).querySelectorAll("span").forEach(el => el.classList.toggle("on", !!inputs[s][el.dataset.k]));
  }

  // The game reads phone buttons from here (keyboard lives in input.js).
  const lastLabels = {}, lastPick = {};
  // Backup/restore sheets: repeated every 400 ms until the phone acks (the link may drop a message).
  const pending = { 1: null, 2: null }, doneRid = {};
  let sheetSeq = 0;
  setInterval(() => { for (const s of [1, 2]) { const p = pending[s]; if (!p) continue; if (++p.tries > 25) { pending[s] = null; continue; } sendTo(s, p.msg); } }, 400);
  function sendTo(s, msg) { const c = slots[s] && conns[slots[s]]; if (c && c.open) c.send(msg); }
  window.PADS = {
    code: () => code,
    inputs, connected: s => !!(slots[s] && conns[slots[s]]),
    // Only sends when the labels actually change (and always to a phone that just joined).
    // Team select: what this phone (and only this phone) is looking at.
    pick(s, P) { const k = JSON.stringify(P); if (lastPick[s] === k) return; lastPick[s] = k; sendTo(s, Object.assign({ t: "pick" }, P)); },
    sheet(s, m) { const msg = Object.assign({ t: "sheet", id: ++sheetSeq }, m); pending[s] = { msg, tries: 0 }; sendTo(s, msg); },
    onRestore: null,
    labels(s, L) { const k = JSON.stringify(L); if (lastLabels[s] === k) return; lastLabels[s] = k; sendTo(s, Object.assign({ t: "labels" }, L)); },
  };

  if (typeof Peer === "undefined") setNet("COULD NOT LOAD THE LINK LIBRARY · CHECK INTERNET", "bad");
  else openRoom();
})();
