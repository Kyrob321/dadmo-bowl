// The Dadmo Bowl league: 12 original teams. Edits to names/colors/stars come from the league page.
// tilt: rating changes by group ("all", "off", "def") or by role (QB, RB, WR, TE, OL, DL, LB, CB, S).
// style: how the computer calls plays for this team. run = share of run calls; short = how strongly the
// QB prefers the short open throw (lower = takes more deep shots); scramble = chance to scramble under pressure.
// flags: fumbleMul (this defense jars more balls loose), noFumble (this offense never fumbles).
const TEAMS = (() => {
  const L = [
    { id: "krush", pants: "#d8dde3", tag: "ALL-AROUND", tier: "start", name: "KYLE'S KRUSH", short: "KRUSH", color: "#2f6fd6", trim: "#d8dde3",
      style: { run: 0.5, short: 2.0 }, tilt: {}, star: "#7 ROCKET REYES, QB", power: "CLUTCH", home: "clear", mascot: "steel boot" },
    { id: "anvils", pants: "#2b2f36", tag: "GROUND & POUND", tier: "start", name: "IRONWORKS ANVILS", short: "ANVILS", color: "#5b6470", trim: "#ff7a1a",
      style: { run: 0.66, short: 2.6 }, tilt: { QB: { spd: -4 }, WR: { spd: -3 }, RB: { bt: 8, truck: 10 }, TE: { truck: 6, blk: 6 }, OL: { blk: 8 } },
      star: "#32 HANK MALLORY, RB", power: "FREIGHT TRAIN", home: "night", mascot: "anvil" },
    { id: "gators", pants: "#f2c230", tag: "BLITZ", tier: "start", name: "BAYOU GATORS", short: "GATORS", color: "#2e7d32", trim: "#f2c230",
      style: { run: 0.5, short: 2.0 }, tilt: { DL: { blk: 12, spd: 3 }, LB: { spd: 3 }, CB: { cov: -1 }, S: { cov: -1 } },
      star: "#99 BOUDREAUX LANDRY, DE", power: "HEAT SEEKER", home: "rain", mascot: "gator" },
    { id: "comets", pants: "#e8e8f0", tag: "AIR RAID", tier: "start", name: "CAPITAL COMETS", short: "COMETS", color: "#1b2a6b", trim: "#e8423f",
      style: { run: 0.3, short: 0.6, deep: 2.0, hold: [1.6, 2.8], deepRoutes: 0.7 }, tilt: { QB: { pow: 8, acc: 3 }, WR: { catch: 4 }, TE: { catch: 4 }, RB: { bt: -5 }, OL: { blk: -3 } },
      star: "#12 DANNY VANCE, QB", power: "CANNON", home: "dome", mascot: "comet" },
    { id: "bolts", pants: "#f0d27a", tag: "THE CAPTAIN'S TEAM", tier: "tutorial", name: "J ROB'S BOLTS", short: "BOLTS", color: "#c8223a", trim: "#ffb627",
      style: { run: 0.5, short: 2.0 }, tilt: { all: { "*": 3 } }, star: "#1 J ROB, QB", power: "THE CAPTAIN", home: "sunset", mascot: "lightning bolt" },
    { id: "yetis", pants: "#4aa3df", tag: "NO-FLY ZONE", tier: "earn", name: "SUMMIT YETIS", short: "YETIS", color: "#e8f1ff", trim: "#4aa3df", dark: "#9fb4cf",
      style: { run: 0.5, short: 2.0 }, tilt: { all: { spd: -2 }, CB: { cov: 8 }, S: { cov: 8 }, LB: { cov: 8 } },
      star: "#21 BJORN HALVORSEN, S", power: "BALL HAWK", home: "snow", mascot: "yeti" },
    { id: "rattlers", pants: "#f3e2c0", tag: "SPEED KILLS", tier: "earn", name: "DESERT RATTLERS", short: "RATTLERS", color: "#c9a46a", trim: "#7a1f2b",
      style: { run: 0.5, short: 2.0 }, tilt: { all: { spd: 6 }, off: { juke: 6 }, OL: { blk: -5 }, TE: { blk: -5 } },
      star: "#4 JAVI ORTEGA, RB", power: "GHOST", home: "heat", mascot: "rattlesnake" },
    { id: "krakens", pants: "#14161a", tag: "TAKEAWAY", tier: "earn", name: "HARBOR KRAKENS", short: "KRAKENS", color: "#0f7c7a", trim: "#14161a",
      style: { run: 0.5, short: 2.0 }, tilt: { def: { tkl: 5 }, QB: { acc: -3 } }, flags: { fumbleMul: 1.8 },
      star: "#55 MARCUS OKAFOR, LB", power: "THE STRIP", home: "fog", mascot: "kraken" },
    { id: "twisters", pants: "#f5d000", tag: "CHAOS QB", tier: "earn", name: "PRAIRIE TWISTERS", short: "TWISTERS", color: "#5e2b97", trim: "#f5d000",
      style: { run: 0.45, short: 2.0, scramble: 0.45 }, tilt: { QB: { spd: 8, bt: 4, acc: -4 } },
      star: "#9 TUCKER BELL, QB", power: "TORNADO", home: "wind", mascot: "twister" },
    { id: "vipers", pants: "#1a1a1a", tag: "ROUTE RUNNERS", tier: "earn", name: "NEON VIPERS", short: "VIPERS", color: "#39ff6a", trim: "#1a1a1a", dark: "#1f9e3e",
      style: { run: 0.38, short: 1.2, deepRoutes: 0.35 }, tilt: { WR: { route: 8, catch: 8 }, TE: { route: 8, catch: 8 }, RB: { catch: 6 }, def: { tkl: -4 } },
      star: "#81 DEZ MONROE, WR", power: "GLUE HANDS", home: "neon", mascot: "viper" },
    { id: "lawnchairs", pants: "#6fb3a8", tag: "DAD BALL", tier: "code", name: "THE LAWN CHAIRS", short: "CHAIRS", color: "#c7b58a", trim: "#6fb3a8",
      style: { run: 0.65, short: 2.4 }, tilt: { all: { spd: -10 }, off: { truck: 12, bt: 8 } }, flags: { noFumble: true },
      star: "#00 BIG DALE, RB", power: "DAD STRENGTH", home: "sprinklers", mascot: "lawn chair" },
    { id: "legends", pants: "#141414", tag: "THE FINAL BOSS", tier: "legend", name: "1989 LEGENDS", short: "LEGENDS", color: "#b8963e", trim: "#141414",
      style: { run: 0.45, short: 1.8 }, tilt: { all: { "*": 8 } }, star: "#89 PRIME", power: "PRIME TIME", home: "crt", mascot: "vhs tape" },
  ];
  const OFF = ["QB", "RB", "WR", "TE", "OL", "KR"], DEF = ["DL", "LB", "CB", "S", "CV"];
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + amt));
    return "#" + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0");
  }
  L.forEach(t => { t.dark = t.dark || shade(t.color, -70); t.flags = t.flags || {}; });
  const byId = {}; L.forEach(t => byId[t.id] = t);

  // Rating changes for one role on one team ("*" means every rating).
  function adjFor(team, role) {
    const t = byId[team]; if (!t) return {};
    const out = {}, add = o => { if (!o) return; for (const k in o) out[k] = (out[k] || 0) + o[k]; };
    add(t.tilt.all); if (OFF.includes(role)) add(t.tilt.off); if (DEF.includes(role)) add(t.tilt.def); add(t.tilt[role]);
    return out;
  }
  // Tale of the tape for the VERSUS screen: four 1-10 bars from the rating tilts and play style.
  function tape(team) {
    const avg = (role, keys) => { const a = adjFor(team, role); return keys.reduce((n, k) => n + (a[k] || 0) + (a["*"] || 0), 0) / keys.length; };
    const t = byId[team], bar = v => Math.max(1, Math.min(10, Math.round(5 + v)));
    return {
      RUN: bar((avg("RB", ["bt", "truck", "juke"]) + avg("OL", ["blk"])) / 3 + (t.style.run - 0.5) * 6),
      PASS: bar((avg("QB", ["acc", "pow"]) + avg("WR", ["catch", "route"])) / 3 + (0.5 - t.style.run) * 4),
      DEFENSE: bar((avg("DL", ["blk", "tkl"]) + avg("LB", ["tkl", "cov"]) + avg("CB", ["cov", "tkl"])) / 4),
      SPEED: bar(["QB", "RB", "WR", "CB", "LB"].reduce((n, r) => n + (adjFor(team, r).spd || 0) + (adjFor(team, r)["*"] || 0), 0) / 5 / 2),
    };
  }
  return { list: L, byId, adjFor, tape };
})();
