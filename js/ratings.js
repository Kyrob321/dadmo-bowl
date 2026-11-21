// Player ratings (25-99). Every player gets the ratings for their role, with a little
// individual variety. Teams with different ratings come later; TEAM_ADJ is the hook.
const RATINGS = (() => {
  // spd speed · bt break tackle · juke · stiff stiff arm · truck · route route running · catch catching
  // pow throw power · acc accuracy (QBs) · tkl tackle · cov coverage · blk blocking (linemen: hold / shed)
  const BASE = {
    QB: { spd: 62, bt: 52, juke: 56, stiff: 50, truck: 46, route: 40, catch: 45, pow: 86, acc: 84, tkl: 30, cov: 20, blk: 30 },
    RB: { spd: 86, bt: 76, juke: 80, stiff: 72, truck: 72, route: 62, catch: 68, tkl: 30, cov: 20, blk: 52 },
    WR: { spd: 88, bt: 58, juke: 77, stiff: 56, truck: 46, route: 80, catch: 82, tkl: 25, cov: 25, blk: 45 },
    TE: { spd: 74, bt: 70, juke: 52, stiff: 72, truck: 76, route: 66, catch: 76, tkl: 30, cov: 20, blk: 66 },
    OL: { spd: 52, bt: 45, juke: 25, stiff: 45, truck: 55, route: 20, catch: 35, tkl: 45, cov: 10, blk: 78 },
    KR: { spd: 89, bt: 70, juke: 80, stiff: 64, truck: 58, route: 60, catch: 80, tkl: 30, cov: 20, blk: 40 },
    DL: { spd: 66, tkl: 76, cov: 30, blk: 77 },
    LB: { spd: 78, tkl: 81, cov: 66, blk: 58 },
    CB: { spd: 88, tkl: 66, cov: 80, blk: 40 },
    S:  { spd: 85, tkl: 75, cov: 76, blk: 45 },
    CV: { spd: 82, tkl: 72, cov: 40, blk: 50 },
  };
  const DEFAULTS = { spd: 60, bt: 45, juke: 40, stiff: 40, truck: 45, route: 30, catch: 45, pow: 50, acc: 50, tkl: 50, cov: 40, blk: 50 };
  const TEAM_ADJ = { 1: {}, 2: {} }; // e.g. { tkl: +4 } for a hard-hitting team, later

  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function make(role, team) {
    const b = Object.assign({}, DEFAULTS, BASE[role] || BASE.OL), adj = TEAM_ADJ[team] || {}, r = {};
    for (const k in b) r[k] = Math.max(25, Math.min(99, Math.round(b[k] + gauss() * 4 + (adj[k] || 0))));
    return r;
  }
  // Speed rating to yards per second (88 → about 7.8 yd/s).
  const speed = s => 3.8 + s * 0.045;

  return { make, speed, gauss, BASE };
})();
