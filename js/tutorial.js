// Coach Kyle's tutorial: six short hands-on drills on the real field, about 2-3 minutes.
// Each player gets their own copy of the game (two players = split screen, each half drilling against the
// computer). Doing the move passes a step; timing moves then offer one optional "go for PERFECT" try.
// The game freezes while Coach Kyle is talking or waiting for a specific button, so nothing is rushed,
// but the plays themselves run at full game speed.
const TUTORIAL = (() => {
  const VW = 512, VH = 288;
  const DRILLS = ["run", "pass", "tackle", "jump", "kickoff", "fg"];
  const TITLE = { run: "OFFENSE: RUN", pass: "OFFENSE: PASS", tackle: "DEFENSE: TACKLE", jump: "DEFENSE: JUMP", kickoff: "SPECIAL TEAMS: KICKOFF", fg: "SPECIAL TEAMS: 4TH DOWN" };
  const PERFECT_LINE = {
    pass: "PERFECT CATCH! WHEN IT'S A JUMP BALL, PERFECT TIMING WINS IT.",
    tackle: "PERFECT TACKLE! PERFECT TACKLES CAN KNOCK THE BALL LOOSE!",
    jump: "PERFECT JUMP! THOSE TURN INTO PICKS A LOT.",
    kickoff: "PERFECT KICK! RIGHT DOWN THE MIDDLE.",
  };
  const BONUS_ASK = {
    pass: "WANT ONE MORE TRY FOR A PERFECT CATCH?",
    tackle: "ONE MORE TRY FOR PERFECT? PERFECT TACKLES KNOCK THE BALL LOOSE!",
    jump: "ONE MORE TRY FOR PERFECT? PERFECT JUMPS GET PICKS!",
    kickoff: "ONE MORE KICK, GOING FOR PERFECT?",
  };
  const other = s => (s === 1 ? 2 : 1);
  let halves = [], offCanvas = {};

  // ---------- flow helpers ----------
  // Freeze the game until one of `keys` is pressed ("stick" = any direction). pass: the press also goes
  // through to the game on that same frame (so RUN really snaps, JUKE really jukes). wrong: messages for
  // the other buttons. labels: what the phone shows meanwhile.
  function ask(H, msg, hint, keys, then, o) {
    o = o || {};
    H.msg = msg; H.hint = hint;
    H.await = { keys, then, pass: !!o.pass, wrong: o.wrong || {}, labels: o.labels || null, t: 0 };
  }
  function say(H, msg, hint) { H.msg = msg; H.hint = hint || ""; }
  function later(H, secs, fn) { H.later = { t: secs, fn, age: 0 }; }
  // Say a line, give time to read it on a TV (longer lines stay up longer; Z moves on after a moment), then fn.
  const readT = msg => Math.max(2.2, 1.5 + msg.length / 18);
  function talk(H, msg, fn) { say(H, msg); later(H, readT(msg), fn); H.later.skip = true; }
  const labelsFrom = (keys, hint) => { const L = {}; for (const k of keys) if (k !== "stick") L[k] = hint; return L; };

  function newHalf(s) {
    const g = makeGame(), o = other(s), boost = { 1: 0, 2: 0 };
    boost[o] = -15; // a soft computer team, so the drills work the first time
    g.newGame({ [s]: true, [o]: false }, { 1: "bolts", 2: "krush", home: 1, weather: "clear", boost, powers: false });
    const H = { s, o, g, G: g.state, d: 0, msg: "", hint: "", await: null, later: null, hold: false, bonus: false, done: false, verdict: null, tries: 0, afterI: 0, card: null };
    setup(H, true);
    const name = s === 1 ? "DAD" : "P2";
    ask(H, "HEY " + name + "! IT'S KYLE. 2 MINUTES OF PRACTICE, THEN YOU'RE PLAYING FOR REAL. YOU'RE THE " + CFG.TEAMS[s].short + ".",
      "Z: LET'S GO", ["z", "x"], () => start(H), { labels: { z: "LET'S GO", x: "LET'S GO" } });
    return H;
  }

  function begin(slots) {
    GAME.setTeams("bolts", "krush", 1);
    WEATHER.force("clear");
    halves = slots.map(newHalf);
  }
  function stop() { halves = []; WEATHER.force(null); }

  // ---------- the drills ----------
  // setup(H, quiet): put the field in place. quiet = just lay it out (shown behind the intro).
  function setup(H, quiet) {
    const G = H.G, g = H.g, name = DRILLS[H.d];
    H.verdict = null; H.rep = null; H.sub = ""; H.hold = false; H.later = null; H.ball = null; H.flag = {};
    G.human = { [H.s]: true, [H.o]: false };
    G.score = { 1: 0, 2: 0 }; G.events = []; G.banner = null; G.pops = []; G.lower = null; G.fireMsg = null;
    if (name === "run" || name === "pass") g.dev.situation({ poss: H.s, los: 30, down: 1, togo: 10, quarter: 1, clock: 999 });
    else if (name === "tackle") g.dev.oneOnOne({ poss: H.o, cx: 30, dx: 47 });
    else if (name === "jump") { g.dev.situation({ poss: H.o, los: 35, down: 1, togo: 10, quarter: 1, clock: 999 }); G.cpuSnapAt = 1e9; G.human[H.s] = false; }
    else if (name === "kickoff") { g.dev.kickoff(H.s); G.clock = 999; }
    else if (name === "fg") g.dev.situation({ poss: H.s, los: 80, down: 4, togo: 6, quarter: 1, clock: 999 });
    if (name === "tackle") H.hold = true; // the runner waits for "GO"
    if (!quiet) start(H);
  }

  // The first message of each drill.
  function start(H) {
    const name = DRILLS[H.d], G = H.G;
    H.await = null;
    if (name === "run") {
      H.sub = "snap";
      ask(H, "PRESS RUN (X) TO SNAP. TAP UP OR DOWN TO JUKE!", "X: RUN", ["x"], () => { G.presnapT = 1; say(H, "HERE WE GO!"); },
        { pass: true, wrong: { z: "THAT'S A PASS. WE'LL THROW NEXT. PRESS RUN (X)!" }, labels: { x: "RUN" } });
    } else if (name === "pass") {
      H.sub = "snap";
      ask(H, "PRESS PASS (Z) TO SNAP.", "Z: PASS", ["z"], () => { G.presnapT = 1; say(H, "DROP BACK..."); },
        { pass: true, wrong: { x: "THAT'S A RUN. PRESS PASS (Z)!" }, labels: { z: "PASS" } });
    } else if (name === "tackle") {
      H.sub = "go";
      ask(H, "STEER WITH THE STICK. GET CLOSE, PRESS TACKLE (Z) WHEN THE BAR HITS GREEN.", "Z: GO", ["z", "x"],
        () => { H.hold = false; H.sub = "chase"; say(H, "GET IN FRONT OF HIM. TACKLE (Z) WHEN THE BAR HITS GREEN!"); }, { labels: { z: "GO", x: "GO" } });
    } else if (name === "jump") {
      H.sub = "go";
      ask(H, "NOW DEFENSE ON A PASS. I'LL STOP THE PLAY THE MOMENT HE THROWS.", "Z: GO", ["z", "x"], () => {
        H.g.dev.snap("pass");
        // just the quarterback, his top receiver and the corner covering him: easy to read
        H.g.dev.keep(p => (p.side === "off" && (p.role === "QB" || p.id === "WR1")) || (p.side === "def" && p.role === "CB" && p.man === "WR1"));
        H.sub = "cover"; say(H, "WATCH THE THROW...");
      }, { labels: { z: "GO", x: "GO" } });
    } else if (name === "kickoff") {
      H.sub = "go"; H.hold = true;
      ask(H, "PRESS KICK (Z) WHEN THE NEEDLE'S IN THE GREEN.", "Z: GO", ["z", "x"],
        () => { H.hold = false; H.sub = "kick"; say(H, "PRESS KICK (Z) WHEN THE NEEDLE'S IN THE GREEN!"); }, { labels: { z: "GO", x: "GO" } });
    } else if (name === "fg") {
      H.sub = "call";
      ask(H, "ON 4TH DOWN, UP KICKS. TRY THIS FIELD GOAL!", "UP: FIELD GOAL", ["up"], () => { G.presnapT = 1; H.sub = "kick"; say(H, "PRESS KICK (Z) WHEN THE NEEDLE'S IN THE GREEN!"); },
        { pass: true, wrong: { x: "THAT'S A RUN. ON 4TH DOWN, PRESS UP TO KICK!", z: "THAT'S A PASS. ON 4TH DOWN, PRESS UP TO KICK!" }, labels: { up: "FIELD GOAL" } });
    }
  }

  // Every frame while a drill runs (after the game has moved).
  function watch(H) {
    const G = H.G, name = DRILLS[H.d], car = G.ball && G.ball.state === "held" ? G.ball.holder : null, live = G.phase === "live";
    if (G.mash) { say(H, "MASH X AND Z AS FAST AS YOU CAN!"); return; }
    if (name === "run") {
      if (H.sub === "snap" && live) H.sub = "carry";
      if (H.sub === "carry") {
        if (live && G.play.handed && car && car.team === H.s) {
          H.sub = "juke";
          ask(H, "NOW TAP UP OR DOWN TO JUKE!", "UP/DOWN: JUKE", ["up", "down"], () => {
            H.sub = "after"; say(H, "NICE JUKE! TAP Z FOR A BURST OF SPEED.");
          }, { pass: true, labels: { up: "JUKE", down: "JUKE" } });
        } else if (!live) retry(H, "LET'S RUN THAT AGAIN.");
      }
      if (H.sub === "after" && live && car) H.endX = car.x;
      if (H.sub === "after" && !live) { // let the run finish, then move on
        H.sub = "done";
        const gain = Math.round((H.endX || 30) - 30);
        talk(H, gain > 0 ? "NICE RUN! " + gain + " YARDS." : "TOUGH YARDS! YOU'VE GOT THE IDEA.", () => next(H));
      }
    } else if (name === "pass") {
      if (H.sub === "snap" && live) H.sub = "drop";
      if (H.sub === "drop" && live && G.play.t > 0.7 && !G.play.thrown) {
        H.sub = "pick";
        ask(H, "NEXT (X) PICKS A GUY, THROW (Z). THEN PRESS CATCH (Z) RIGHT AS IT GETS THERE.", "X: NEXT  Z: THROW", ["x", "z"],
          () => { say(H, "NEXT (X) PICKS A GUY, THROW (Z)!"); }, { pass: true, labels: { x: "NEXT", z: "THROW" } });
      }
      if ((H.sub === "pick" || H.sub === "drop") && live && G.play.thrown) { H.sub = "air"; H.ball = G.ball; say(H, "NOW PRESS CATCH (Z) RIGHT AS IT GETS THERE!"); }
      if (H.sub === "air") {
        if (H.ball.offFb) H.verdict = H.ball.offFb[0];
        if (G.ball !== H.ball) { // the pass came down: caught, dropped or picked
          H.sub = "done";
          const v = H.verdict, caught = car && car.team === H.s, picked = car && car.team === H.o;
          const timing = v === "PERFECT!" ? PERFECT_LINE.pass : v === "GOOD" ? "GOOD CATCH TIMING!" : v ? "A LITTLE " + v + " ON THE CATCH." : "NEXT TIME, PRESS CATCH (Z) AS IT GETS THERE.";
          const lead = caught ? "CAUGHT! " : picked ? "PICKED OFF! IT HAPPENS. " : "INCOMPLETE. ";
          passed(H, lead + timing, v === "PERFECT!");
        }
      } else if (H.sub !== "done" && H.sub !== "snap" && !live) retry(H, "DOWN BEFORE THE THROW! SNAP IT AND THROW A LITTLE QUICKER.");
    } else if (name === "tackle") {
      const me = G.control[H.s];
      if (G.rep && G.rep.def === me) H.rep = G.rep; // keep it: the rep is cleared when it resolves
      if (H.rep) H.verdict = H.rep.defFb ? H.rep.defFb[0] : H.rep.dive ? "DIVE" : null;
      if (H.sub !== "chase") return;
      if (!live) {
        H.sub = "done";
        if (G.events.some(e => e.type === "td")) return retry(H, "HE BROKE IT! STAY IN FRONT OF HIM AND TRY AGAIN.");
        if (!H.verdict) return retry(H, "HE'S DOWN, BUT TRY IT WITH THE TACKLE BUTTON (Z) WHEN THE BAR SHOWS.");
        const fum = G.events.some(e => e.type === "fumble");
        const v = H.verdict, line = v === "PERFECT!" ? PERFECT_LINE.tackle : v === "GOOD" ? "GOOD TACKLE!" : v === "DIVE" ? "DIVING TACKLE! THE BAR TIMES IT EVEN BETTER." : "GOT HIM! A LITTLE " + v + " ON THE TIMING.";
        return passed(H, line + (fum && v !== "PERFECT!" ? " AND THE BALL CAME LOOSE!" : ""), v === "PERFECT!");
      }
      const runner = G.players.find(p => p.team === H.o);
      if (runner && me && (runner.x > me.x + 6 || G.play.t > 8)) { H.sub = "done"; return retry(H, "HE GOT BY! GET IN FRONT OF HIM, THEN PRESS TACKLE WHEN THE BAR SHOWS."); }
    } else if (name === "jump") {
      if (H.sub === "cover" && G.ball && G.ball.state === "air") {
        H.sub = "air"; H.ball = G.ball;
        const cb = G.players.find(p => p.team === H.s);
        G.human[H.s] = true; G.control[H.s] = cb;
        ask(H, "BALL'S IN THE AIR! STEER UNDER IT AND PRESS JUMP (Z).", "STICK: MOVE  Z: JUMP", ["z", "stick"], () => say(H, "GET UNDER IT AND PRESS JUMP (Z)!"),
          { pass: true, labels: { z: "JUMP", stick: true, up: "MOVE", down: "MOVE", left: "MOVE", right: "MOVE" } });
        return;
      }
      if (H.sub === "cover" && live && G.play.t > 6) { H.sub = "done"; return retry(H, "LET'S TRY THAT AGAIN."); }
      if (H.sub === "air") {
        if (H.ball.defFb) H.verdict = H.ball.defFb[0];
        if (G.ball !== H.ball && G.ball.state !== "air") {
          H.sub = "done";
          if (H.ball.defT == null) return retry(H, "GET CLOSE TO WHERE IT'S COMING DOWN, THEN PRESS JUMP (Z).");
          const pick = car && car.team === H.s, v = H.verdict;
          const line = pick ? "PICKED OFF! " + (v === "PERFECT!" ? "PERFECT JUMPS GET PICKS!" : "NICE JUMP!") : v === "PERFECT!" ? PERFECT_LINE.jump : v === "GOOD" ? "GOOD JUMP!" : "NICE TRY! A LITTLE " + v + ".";
          passed(H, line, v === "PERFECT!");
        }
      }
    } else if (name === "kickoff") {
      if (H.sub === "kick" && G.phase !== "kick") {
        if (G.kick.onside) return retry(H, "THAT WAS AN ONSIDE KICK (UP)! SAVE IT FOR WHEN YOU'RE BEHIND. KICK THIS ONE DEEP WITH Z.");
        H.sub = "flying"; const acc = G.kick.acc != null ? G.kick.acc : 0; H.verdict = acc >= 0.88 ? "PERFECT!" : acc >= 0.6 ? "GOOD" : "WIDE";
      }
      if (H.sub === "flying" && G.phase !== "flight" && G.phase !== "kick") {
        H.sub = "done"; H.hold = true;
        const v = H.verdict;
        passed(H, v === "PERFECT!" ? PERFECT_LINE.kickoff : v === "GOOD" ? "GOOD KICK! STOP IT IN THE GREEN FOR PERFECT." : "IT'S A KICK! AIM FOR THE GREEN IN THE MIDDLE.", v === "PERFECT!");
      }
    } else if (name === "fg") {
      const fg = G.events.find(e => e.type === "fg");
      if (H.sub === "kick" && fg) {
        H.sub = "done";
        talk(H, fg.good ? "IT'S GOOD! THREE POINTS." : "NO GOOD! LONG KICKS NEED THE NEEDLE CLOSE TO THE MIDDLE.", () => next(H));
      }
    }
  }

  // The move was done: praise, then (for timing drills, first time only) offer one try for PERFECT.
  function passed(H, line, perfect) {
    const name = DRILLS[H.d];
    if (H.bonus) return talk(H, perfect ? line : line + " YOU'LL GET IT IN THE GAME!", () => next(H)); // this was the bonus try
    if (!BONUS_ASK[name] || perfect) return talk(H, line, () => next(H));
    talk(H, line, () => ask(H, BONUS_ASK[name], "Z: TRY IT  X: SKIP", ["z", "x"], k => {
      if (k === "z") { H.bonus = true; setup(H); } else next(H);
    }, { labels: { z: "TRY IT", x: "SKIP" } }));
  }
  // Missed it: try again, but never more than a few times (and a missed bonus try just moves on).
  function retry(H, msg) {
    H.sub = "done"; H.tries++;
    const first = (msg.match(/^[^.!]*[.!]/) || [msg])[0];
    if (H.bonus) return talk(H, first + " NO WORRIES, YOU'LL GET IT IN THE GAME.", () => next(H));
    if (H.tries >= 3) return talk(H, first + " WE'LL GET IT IN THE GAME. MOVING ON!", () => next(H));
    talk(H, msg, () => setup(H));
  }
  // After some drills: a chalkboard card or a tip, each waiting for "GOT IT".
  // The run drill is followed by how the timing bars work (with a practice bar) and every offensive skill move.
  const AFTER = {
    run: [
      { card: "timing", msg: "EVERY BIG MOMENT HAS A TIMING BAR. PRESS Z A FEW TIMES TO PRACTICE ON THIS ONE!", hint: "Z: TRY IT  X: GOT IT", keys: ["x"], labels: { z: "TRY IT", x: "GOT IT" } },
      { card: "moves", msg: "WHEN A TACKLER CLOSES IN, A RUN BAR POPS UP. HIT ONE OF THESE MOVES IN THE GREEN!",
        labels: { z: "GOT IT", x: "GOT IT", up: "JUKE", down: "JUKE", right: "TRUCK", left: "STIFF" } },
    ],
    jump: [{ msg: "TIP: ON DEFENSE, X SWITCHES TO ANOTHER PLAYER, AND BOOST IS A BURST OF SPEED." }],
    kickoff: [{ msg: "TIP: BEHIND LATE? PRESS UP INSTEAD FOR A SURPRISE ONSIDE KICK." }],
  };
  function next(H, skipped) {
    const list = AFTER[DRILLS[H.d]];
    if (list && skipped) while (H.afterI < list.length && !list[H.afterI].card) H.afterI++;
    if (list && H.afterI < list.length) {
      const a = list[H.afterI++];
      H.hold = true; H.card = a.card || null; H.demo = { t: 0, fb: null, fbT: 0, at: 0 };
      return ask(H, a.msg, a.hint || "Z: GOT IT", a.keys || ["z", "x"], () => next(H), { labels: a.labels || { z: "GOT IT", x: "GOT IT" } });
    }
    H.card = null; H.afterI = 0;
    H.bonus = false; H.tries = 0; H.d++;
    if (H.d < DRILLS.length) return setup(H);
    H.d = DRILLS.length - 1; H.hold = true;
    const xmas = typeof HOLIDAY !== "undefined" && HOLIDAY.on;
    const end = H.s === 1 ? (xmas ? "MERRY CHRISTMAS, DAD. LET'S PLAY!" : "LET'S PLAY, DAD!") : "LET'S PLAY!";
    ask(H, "THAT'S IT! PAUSE ANY TIME FOR THE MENU. " + end, "Z: LET'S PLAY", ["z", "x"], () => {
      H.done = true; H.doneT = 0; say(H, halves.length > 1 ? "READY! WAITING FOR THE OTHER PLAYER..." : "");
    }, { labels: { z: "LET'S PLAY", x: "LET'S PLAY" } });
  }
  // From the pause menu: skip the drill this player is on.
  function skipDrill(s) {
    const H = halves.find(h => h.s === s) || halves[0]; if (!H || H.done) return;
    H.await = null; H.later = null; next(H, true);
  }

  // ---------- each frame ----------
  function step(dt) {
    let go1 = false;
    for (const H of halves) {
      if (H.done) {
        H.doneT += dt;
        if (H.doneT > 3) H.hint = "Z: START WITHOUT THEM";
        if (H.doneT > 3 && INPUT.pressed(H.s, "z")) go1 = true;
        continue;
      }
      if (H.later) {
        H.later.t -= dt; H.later.age += dt;
        if (H.later.skip && H.later.age > 1 && !H.later.armed && !INPUT.held(H.s, "z")) H.later.armed = true; // a held button from the play doesn't skip
        if (H.later.t <= 0 || (H.later.armed && INPUT.pressed(H.s, "z"))) { const f = H.later.fn; H.later = null; f(); }
      }
      let go = !H.await && !H.hold;
      const A = H.await;
      if (H.card === "timing") demoStep(H, dt, A && A.t > 0.25 && INPUT.pressed(H.s, "z"));
      if (A) {
        A.t += dt;
        const hit = A.t > 0.25 && A.keys.find(k => k === "stick" ? INPUT.dir(H.s).any : INPUT.pressed(H.s, k));
        if (hit) { H.await = null; if (A.pass) go = true; A.then && A.then(hit); if (H.await || H.hold) go = A.pass; }
        else if (A.t > 0.25) for (const k in A.wrong) if (INPUT.pressed(H.s, k)) { H.msg = A.wrong[k]; SFX.buzz && SFX.buzz(); }
      }
      if (go) { H.g.update(dt); watch(H); }
    }
    return halves.length > 0 && (go1 || halves.every(h => h.done));
  }

  // The practice bar on the timing card: the needle sweeps; X stops it and grades the press like the game does.
  const DEMO = { sweep: 1.0, ideal: 0.62, w: 0.13 }; // real bars: 0.4-0.9 s; the green here matches a good player's
  function demoStep(H, dt, press) {
    const D = H.demo;
    if (D.fbT > 0) { D.fbT -= dt; if (D.fbT <= 0) { D.t = 0; D.fb = null; } return; }
    D.t += dt; if (D.t > DEMO.sweep + 0.3) D.t = 0; // a short rest past the end, then again
    if (press) {
      D.at = Math.min(1, D.t / DEMO.sweep);
      const d = D.at - DEMO.ideal;
      D.fb = Math.abs(d) <= DEMO.w * 0.35 ? ["PERFECT!", "#7fd68f"] : Math.abs(d) <= DEMO.w ? ["GOOD", "#c8f0a0"] : [d < 0 ? "EARLY" : "LATE", "#ef5a45"];
      D.fbT = 1.1;
      if (D.fb[0] === "PERFECT!" && SFX.chime) SFX.chime();
    }
  }

  // What a phone shows: the coach's buttons while he's waiting, otherwise the game's own labels (null).
  function labels(s) {
    const H = halves.find(h => h.s === s);
    if (!H) return { x: "", z: "", up: "", down: "", left: "", right: "" };
    if (H.later && !H.await && H.later.armed) return { x: "", z: "NEXT", up: "", down: "", left: "", right: "" };
    if (H.done && H.doneT > 3) return { x: "", z: "START", up: "", down: "", left: "", right: "" };
    if (H.done || (H.later && !H.await) || H.hold && !H.await) return { x: "", z: "", up: "", down: "", left: "", right: "" };
    if (H.await) return Object.assign({ x: "", z: "", up: "", down: "", left: "", right: "" }, H.await.labels || labelsFrom(H.await.keys, "GO"));
    return null;
  }
  const stateFor = s => { const H = halves.find(h => h.s === s); return H ? H.G : null; };

  // ---------- drawing ----------
  // Pixel Kyle: ball cap and headset, Krush blue. 16 x 16, drawn at 2x (or bigger on the offer screen).
  const FACE = [
    "................",
    ".....BBBBBB.....",
    "....BBBWWBBB....",
    "...KBBBBBBBBB...",
    "...KBBBBBBBBBBB.",
    "...KHSSSSSSS....",
    "..KKHSSESSES....",
    "..KKSSSSSSSS....",
    "..KKSSSSSSSS....",
    "...KmSSMMMSS....",
    "....mmmSSSS.....",
    ".....SSSSSS.....",
    "....TTTSSTTT....",
    "...TTTTTTTTTT...",
    "..TTTTTWTTTTTT..",
    "..TTTTTTTTTTTT..",
  ];
  const PAL = { B: "#2f6fd6", W: "#f3efe4", K: "#26282e", H: "#6b4423", S: "#e8b98a", s: "#c99466", E: "#1b1b1b", M: "#8e3b2e", m: "#4a4d55", T: "#2f6fd6" };
  function kyle(c, x, y, k) {
    for (let r = 0; r < 16; r++) for (let col = 0; col < 16; col++) {
      const ch = FACE[r][col]; if (ch === ".") continue;
      c.fillStyle = PAL[ch]; c.fillRect(x + col * k, y + r * k, k, k);
    }
  }
  function wrap(str, max) {
    const out = []; let line = "";
    for (const w of str.split(" ")) {
      if ((line + " " + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + " " + w).trim();
    }
    if (line) out.push(line);
    return out;
  }
  // Where the coach box goes: along the bottom, or up top when the play is down there.
  function boxGeom(H, w) {
    const msg = H.msg || "", hint = H.hint || (H.later && H.later.armed ? "Z: NEXT" : "");
    const lines = wrap(msg, Math.floor((w - 50) / 8)), h = 18 + lines.length * 10 + (hint ? 12 : 0) + 4;
    const G = H.G, me = G.control && G.control[H.s];
    const fy = Math.round(44 + ((G.ball && G.ball.state === "air" && me) ? Math.max(me.y, G.ball.ty || 0) : (G.ball ? G.ball.y : 26)) * 4.3);
    const lowLine = VH - h - 4 - 14;
    if (fy > lowLine + 8) H.boxTop = true; else if (fy < lowLine - 16) H.boxTop = false;
    if (G.phase === "kick" || G.phase === "presnap" || H.card) H.boxTop = false;
    const show = !!(msg || hint);
    return { lines, hint, h, y0: H.boxTop ? 24 : VH - h - 4, top: !!H.boxTop, show };
  }
  function coachBox(c, H, x0, w, time, B) {
    if (!B.show) return;
    const tx = x0 + 44, y0 = B.y0;
    c.fillStyle = "rgba(5,8,16,.88)"; c.fillRect(x0 + 4, y0, w - 8, B.h);
    c.fillStyle = "#2f6fd6"; c.fillRect(x0 + 4, B.top ? y0 + B.h - 2 : y0, w - 8, 2);
    c.fillStyle = "#0b1224"; c.fillRect(x0 + 8, y0 + 6, 34, 34);
    kyle(c, x0 + 9, y0 + 7, 2);
    RENDER.text("COACH KYLE", tx, y0 + 6, "#6fa8ff", 8);
    B.lines.forEach((l, i) => RENDER.text(l, tx, y0 + 18 + i * 10, "#f3efe4", 8));
    if (B.hint) RENDER.text(B.hint, tx, y0 + 18 + B.lines.length * 10 + 2, Math.floor(time * 3) % 2 ? "#ffe14a" : "#ffb627", 8);
  }
  // ----- chalkboard cards -----
  const MOVES = [
    { key: "UP/DOWN", name: "JUKE", pose: "run", why: "BEST WHEN HE'S HEAD-ON" },
    { key: "RIGHT", name: "TRUCK", pose: "truck", why: "BEST DOWNFIELD (NOT LINEMEN)" },
    { key: "LEFT", name: "STIFF ARM", pose: "stiff", why: "BEST WHEN HE'S AT YOUR SIDE" },
    { key: "Z", name: "BURST", pose: "run", why: "QUICK SPEED, 3 SEC RECHARGE" },
    { key: "X / Z", name: "MASH", pose: "grapple", why: "A TIE? TAP X AND Z FAST" },
  ];
  function board(c, x0, w, y0, y1, title) {
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(x0, 20, w, VH - 20);
    c.fillStyle = "#6b4a2b"; c.fillRect(x0 + 6, y0, w - 12, y1 - y0);
    c.fillStyle = "#123323"; c.fillRect(x0 + 10, y0 + 4, w - 20, y1 - y0 - 8);
    RENDER.text(title, x0 + w / 2, y0 + 12, "#ffe14a", 8, "center");
  }
  function timingCard(c, H, x0, w, y0, y1, time) {
    board(c, x0, w, y0, y1, "HOW TIMING WORKS");
    const wide = w > 300, cx = x0 + w / 2, L = [wide ? "A BAR POPS UP AT BIG MOMENTS:" : "BARS POP UP AT BIG PLAYS:", "RUN \u00b7 HIT \u00b7 CATCH \u00b7 JUMP"];
    RENDER.text(L[0], cx, y0 + 28, "#f3efe4", 8, "center");
    RENDER.text("RUN BAR: DO A MOVE", cx, y0 + 40, "#9fd0ff", 8, "center");
    RENDER.text("HIT \u00b7 CATCH \u00b7 JUMP BARS: Z", cx, y0 + 51, "#9fd0ff", 8, "center");
    // the practice bar, drawn like the real one (bigger)
    const bw = Math.min(220, w - 48), bx = Math.round(cx - bw / 2), by = y0 + 84, D = H.demo || { t: 0 };
    const px = v => bx + Math.round(bw * Math.max(0, Math.min(1, v)));
    RENDER.text("PERFECT", px(DEMO.ideal), by - 20, "#7fd68f", 8, "center");
    c.fillStyle = "#7fd68f"; c.fillRect(px(DEMO.ideal) - 1, by - 9, 2, 6);
    c.fillStyle = "rgba(0,0,0,.75)"; c.fillRect(bx - 3, by - 3, bw + 6, 16);
    c.fillStyle = "#5a1d1d"; c.fillRect(bx, by, bw, 10);
    c.fillStyle = "#7fd68f"; c.fillRect(px(DEMO.ideal - DEMO.w), by, px(DEMO.ideal + DEMO.w) - px(DEMO.ideal - DEMO.w), 10);
    const needle = D.fb ? D.at : Math.min(1, D.t / DEMO.sweep);
    c.fillStyle = "#fff"; c.fillRect(px(needle) - 1, by - 4, 3, 18);
    RENDER.text("EARLY", px((DEMO.ideal - DEMO.w) / 2), by + 18, "#ef5a45", 8, "center");
    RENDER.text("GOOD", px(DEMO.ideal), by + 18, "#c8f0a0", 8, "center");
    RENDER.text("LATE", px((1 + DEMO.ideal + DEMO.w) / 2), by + 18, "#ef5a45", 8, "center");
    if (D.fb) RENDER.text(D.fb[0], cx, by + 34, D.fb[1], 8, "center");
    const tips = [wide ? "PRESS WHILE IT'S IN THE GREEN." : "PRESS IN THE GREEN.", "DEAD CENTER = PERFECT.", "CLOSER TO CENTER = BETTER.", "BETTER PLAYERS: WIDER GREEN."];
    const ty = by + 46;
    tips.forEach((t, i) => { if (ty + i * 11 < y1 - 12) RENDER.text(t, cx, ty + i * 11, i === 1 ? "#7fd68f" : "#f3efe4", 8, "center"); });
  }
  function movesCard(c, H, x0, w, y0, y1, time) {
    const wide = w > 300;
    board(c, x0, w, y0, y1, wide ? "SKILL MOVES (AFTER A HANDOFF OR CATCH)" : "SKILL MOVES WITH THE BALL");
    if (wide) {
      const rowH = Math.min(28, Math.floor((y1 - y0 - 46) / MOVES.length)), top = y0 + 28;
      MOVES.forEach((m, i) => {
        const y = top + i * rowH, frame = m.pose === "run" ? Math.floor(time * 10) % 6 : 0;
        const img = SPRITES.get(H.s, 0, m.pose, frame, 1);
        c.drawImage(img, x0 + 34 - SPRITES.OX, y + rowH - 2 - SPRITES.OY);
        RENDER.text(m.key, x0 + 56, y + rowH / 2 - 4, "#ffe14a", 8);
        RENDER.text(m.name, x0 + 132, y + rowH / 2 - 4, "#f3efe4", 8);
        RENDER.text(m.why, x0 + 222, y + rowH / 2 - 4, "#9fb1c5", 8);
      });
    } else {
      const top = y0 + 26, rowH = Math.min(24, Math.floor((y1 - y0 - 44) / MOVES.length));
      MOVES.forEach((m, i) => {
        const y = top + i * rowH;
        RENDER.text(m.key, x0 + 16, y, "#ffe14a", 8);
        RENDER.text(m.name, x0 + w - 16, y, "#f3efe4", 8, "right");
        RENDER.text(m.why, x0 + 16, y + 10, "#9fb1c5", 8);
      });
    }
    RENDER.text(wide ? "TIME THE MOVE WITH THE RUN BAR!" : "TIME IT WITH THE RUN BAR!", x0 + w / 2, y1 - 16, "#7fd68f", 8, "center");
  }
  function card(c, H, x0, w, B, time) {
    if (!H.card) return;
    const y0 = 26, y1 = B.show && !B.top ? B.y0 - 4 : VH - 6;
    if (H.card === "timing") timingCard(c, H, x0, w, y0, y1, time);
    else if (H.card === "moves") movesCard(c, H, x0, w, y0, y1, time);
  }

  // The kick meter sits just above the coach box.
  const meterAt = (B, x) => ({ x, y: B.show && !B.top ? B.y0 - 20 : VH - 30 });
  function topBar(c, H, x0, w, split) {
    c.fillStyle = "#000"; c.fillRect(x0, 0, w, 20);
    const T = CFG.TEAMS[H.s];
    c.fillStyle = T.color; c.fillRect(x0, 18, w, 2);
    const left = split ? "P" + H.s + " \u00b7 " + (H.d + 1) + "/" + DRILLS.length : "DRILL " + (H.d + 1) + "/" + DRILLS.length;
    const right = (split ? TITLE[DRILLS[H.d]].split(": ")[1] : TITLE[DRILLS[H.d]]) + (H.bonus ? " \u2605" : "");
    RENDER.text(left, x0 + 6, 6, T.trim, 8);
    RENDER.text(right, x0 + w - 6, 6, "#f3efe4", 8, "right");
  }
  // Split screen: which part of the full-width view each half shows (follows the ball, and keeps your
  // own player in the picture on defense).
  function cropFor(H) {
    const G = H.G, me = G.control && G.control[H.s];
    let focus = G.ball ? (G.ball.state === "air" && G.ball.tx != null ? (G.ball.x + G.ball.tx) / 2 : G.ball.x) : G.los;
    if (G.phase === "presnap") focus = G.los + 4;
    else if (G.phase === "kick") focus = G.kick.type === "kickoff" ? 38 : G.los + 4;
    else if (me && G.human[H.s] && G.phase === "live") {
      const ref = G.ball && G.ball.state === "air" && G.ball.tx != null ? G.ball.tx : focus;
      if (Math.abs(me.x - ref) < 18) focus = (me.x + ref) / 2;
    }
    const want = Math.max(0, Math.min(VW / 2, (focus - (G.cam != null ? G.cam : focus)) * 12 + VW / 2 - VW / 4));
    H.cropX = H.cropX == null ? want : H.cropX + (want - H.cropX) * 0.15;
    return Math.round(H.cropX);
  }
  function draw(time) {
    const c = RENDER.ctx(); if (!c || !halves.length) return;
    if (halves.length === 1) {
      const H = halves[0], B = boxGeom(H, VW);
      RENDER.draw(H.G, time, { tutorial: true, meter: meterAt(B, VW / 2) });
      card(c, H, 0, VW, B, time); topBar(c, H, 0, VW, false); coachBox(c, H, 0, VW, time, B);
      return;
    }
    // Split screen: draw each game off screen, then show a half-width slice of it on its side.
    halves.forEach((H, i) => {
      const off = offCanvas[i] || (offCanvas[i] = Object.assign(document.createElement("canvas"), { width: VW, height: VH }));
      const B = boxGeom(H, VW / 2), cx = cropFor(H), x0 = i * (VW / 2);
      RENDER.drawTo(off, H.G, time, { tutorial: true, meter: meterAt(B, cx + VW / 4) });
      c.drawImage(off, cx, 0, VW / 2, VH, x0, 0, VW / 2, VH);
      card(c, H, x0, VW / 2, B, time); topBar(c, H, x0, VW / 2, true); coachBox(c, H, x0, VW / 2, time, B);
    });
    c.fillStyle = "#000"; c.fillRect(VW / 2 - 1, 0, 2, VH);
  }

  // The first-game offer: "NEW HERE?"
  function drawOffer(time, twoPlayers) {
    const c = RENDER.ctx(); if (!c) return;
    c.fillStyle = "#0b1224"; c.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? "#123a1f" : "#15461f"; c.fillRect(0, 170 + i * 10, VW, 10); }
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(48, 52, 112, 112);
    kyle(c, 56, 60, 6);
    RENDER.text("NEW HERE?", 300, 40, "#ffe14a", 16, "center");
    RENDER.text("COACH KYLE'S TUTORIAL", 300, 70, "#6fa8ff", 8, "center");
    RENDER.text("SIX QUICK DRILLS, ABOUT 2 MINUTES", 300, 90, "#f3efe4", 8, "center");
    RENDER.text(twoPlayers ? "BOTH PLAYERS, SIDE BY SIDE" : "RUN, PASS, TACKLE, JUMP, KICK", 300, 104, "#9fb1c5", 8, "center");
    RENDER.text("FINISH IT TO UNLOCK", 300, 128, "#f3efe4", 8, "center");
    RENDER.text(TEAMS.byId.bolts.name + "!", 300, 142, "#ffb627", 8, "center");
    const blink = Math.floor(time * 2.5) % 2;
    RENDER.text("Z: START THE TUTORIAL", VW / 2, 226, blink ? "#ffe14a" : "#ffb627", 8, "center");
    RENDER.text("X: SKIP FOR NOW (IT'S ALSO ON THE TITLE SCREEN)", VW / 2, 244, "#9fb1c5", 8, "center");
  }

  return { begin, stop, step, draw, drawOffer, labels, stateFor, skipDrill, get halves() { return halves; }, DRILLS };
})();
