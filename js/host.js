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
    return base + "pad.html?room=" + c;
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
    code = (saved && tries < 8) ? saved : NET.newCode();
    peer = new Peer(NET.peerId(code));
    peer.on("open", () => { showRoom(); setNet("READY · WAITING FOR PHONES", "ok"); try { localStorage.setItem("dadmo-room", code); } catch (e) {} saved = code; });
    peer.on("connection", onConn);
    peer.on("disconnected", () => { setNet("RECONNECTING…", "bad"); try { peer.reconnect(); } catch (e) {} });
    peer.on("error", err => {
      if (err.type === "unavailable-id") {
        peer.destroy();
        if (saved && tries < 8) { setNet("REOPENING ROOM " + saved + "…", ""); setTimeout(() => openRoom(tries + 1), 2500); }
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
        conns[msg.id] = conn; conn._slot = s; conn._id = msg.id;
        conn.send({ t: "welcome", slot: s });
        lastLabels[s] = null; // make sure this phone gets the current labels
        $("slot" + s).classList.add("in");
        $("state" + s).textContent = "READY";
      } else if (msg.t === "bye") {
        // A phone left on purpose: free its player slot so another phone can take it.
        const s = conn._slot;
        if (s && slots[s] === conn._id) { slots[s] = null; delete conns[conn._id]; inputs[s] = {}; draw(s);
          $("slot" + s).classList.remove("in"); $("state" + s).textContent = "OPEN · SCAN TO JOIN"; $("lag" + s).textContent = ""; }
        conn._slot = null; setTimeout(() => conn.close(), 200);
      } else if (msg.t === "in" && conn._slot) {
        inputs[conn._slot] = msg.k || {};
        draw(conn._slot);
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
  const lastLabels = {};
  function sendTo(s, msg) { const c = slots[s] && conns[slots[s]]; if (c && c.open) c.send(msg); }
  window.PADS = {
    code: () => code,
    inputs, connected: s => !!(slots[s] && conns[slots[s]]),
    // Only sends when the labels actually change (and always to a phone that just joined).
    labels(s, L) { const k = JSON.stringify(L); if (lastLabels[s] === k) return; lastLabels[s] = k; sendTo(s, Object.assign({ t: "labels" }, L)); },
  };

  if (typeof Peer === "undefined") setNet("COULD NOT LOAD THE LINK LIBRARY · CHECK INTERNET", "bad");
  else openRoom();
})();
