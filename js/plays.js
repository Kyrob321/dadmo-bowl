// Formations and auto-generated plays. Coordinates are in yards, in the offense's frame:
// x runs from the offense's own goal line (0) to the opponent's goal line (100); y runs sideline to sideline.
const PLAYS = (() => {
  const W = CFG.FIELD_W, C = W / 2;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function formation(los) {
    return {
      off: [
        { role: "QB", x: los - 1.6, y: C },
        { role: "RB", x: los - 5.2, y: C },
        { role: "OL", x: los - 0.6, y: C - 3.3 }, { role: "OL", x: los - 0.6, y: C - 1.1 },
        { role: "OL", x: los - 0.6, y: C + 1.1 }, { role: "OL", x: los - 0.6, y: C + 3.3 },
        { role: "TE", x: los - 0.8, y: C + 5.6, id: "TE" },
        { role: "WR", x: los - 0.6, y: 7.5, id: "WR1" },
        { role: "WR", x: los - 0.6, y: W - 7.5, id: "WR2" },
      ],
      def: [
        { role: "DL", x: los + 1, y: C - 4.2 }, { role: "DL", x: los + 1, y: C - 1.4 },
        { role: "DL", x: los + 1, y: C + 1.4 }, { role: "DL", x: los + 1, y: C + 4.2 },
        { role: "LB", x: los + 5, y: C - 4.5 }, { role: "LB", x: los + 5, y: C + 4.5 },
        { role: "CB", x: los + 6.5, y: 7.5, man: "WR1" }, { role: "CB", x: los + 6.5, y: W - 7.5, man: "WR2" },
        { role: "S", x: los + 13, y: C },
      ],
    };
  }

  // Routes as [downfield, inward] steps from the receiver's starting spot.
  const WR_ROUTES = {
    GO: [[26, 0]], SLANT: [[3, 0], [14, 8]], OUT: [[9, 0], [9, -7]], IN: [[10, 0], [11, 11]],
    POST: [[11, 0], [26, 8]], CURL: [[11, 0], [9.5, 1.5]], CORNER: [[11, 0], [23, -7]],
  };
  const TE_ROUTES = { SEAM: [[20, 0]], FLAT: [[4, 0], [6, -7]], DRAG: [[3, 0], [5, 13]], STICK: [[6, 0], [6, -2]] };

  function route(start, steps) {
    const inward = start.y < C ? 1 : -1;
    return steps.map(([dx, dy]) => ({ x: start.x + dx, y: Math.max(1.2, Math.min(W - 1.2, start.y + dy * inward)) }));
  }

  function makePlans(los, offense, style) {
    style = style || {};
    const at = id => offense.find(p => p.id === id || p.role === id);
    // Run: pick a hole, then go.
    const holes = [C - 2.2, C + 2.2, C - 8, C + 8];
    const hole = pick(holes);
    const rb = at("RB");
    const run = {
      hole,
      rbPath: [
        { x: los - 3.2, y: C + Math.sign(hole - C) * 0.9 },
        { x: los + 1.2, y: hole },
        { x: los + 30, y: hole + Math.sign(hole - C) * 2 },
      ],
      from: { x: rb.x, y: rb.y },
    };
    // Pass: every eligible receiver gets a route; the running back either stays in to block or runs to the flat.
    const routes = {};
    // Air Raid style teams call more deep routes.
    const DEEP = ["GO", "POST", "CORNER"];
    const wrPick = () => Math.random() < (style.deepRoutes || 0) ? pick(DEEP) : pick(Object.keys(WR_ROUTES));
    const wr1 = wrPick();
    let wr2 = wrPick(); if (wr2 === wr1) wr2 = wrPick();
    routes.WR1 = { name: wr1, pts: route(at("WR1"), WR_ROUTES[wr1]) };
    routes.WR2 = { name: wr2, pts: route(at("WR2"), WR_ROUTES[wr2]) };
    const te = pick(Object.keys(TE_ROUTES));
    routes.TE = { name: te, pts: route(at("TE"), TE_ROUTES[te]) };
    if (Math.random() < 0.6) {
      const side = Math.random() < 0.5 ? -1 : 1;
      routes.RB = { name: "FLAT", pts: [{ x: los - 3, y: C + side * 6 }, { x: los + 3, y: C + side * 13 }] };
    }
    return { run, pass: { routes } };
  }

  return { formation, makePlans };
})();
