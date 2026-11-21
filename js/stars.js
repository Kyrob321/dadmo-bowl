// Superstars, player names, and "on fire". Each team has one star (the 1989 Legends' Prime plays both ways).
// Every other player gets a made-up name that stays the same all game (and every game) for that team and spot.
const STARS = (() => {
  // key = position + index in the formation (QB0, RB0, WR0 = left receiver, DL0 = left end, LB0, CB0, S0...)
  const DEF = {
    krush:      { keys: ["QB0"], power: "CLUTCH", blurb: "DEADLY ON 3RD DOWN + LATE" },
    anvils:     { keys: ["RB0"], power: "FREIGHT TRAIN", blurb: "WINS HEAD-ON COLLISIONS" },
    gators:     { keys: ["DL0"], power: "HEAT SEEKER", blurb: "BEATS HIS BLOCKER FAST" },
    comets:     { keys: ["QB0"], power: "CANNON", blurb: "FAST, ACCURATE DEEP BALLS" },
    bolts:      { keys: ["QB0"], power: "THE CAPTAIN", blurb: "1ST DOWNS FIRE UP THE TEAM" },
    yetis:      { keys: ["S0"], power: "BALL HAWK", blurb: "PICKS OFF PASSES NEAR HIM" },
    rattlers:   { keys: ["RB0"], power: "GHOST", blurb: "SLIPS THE FIRST TACKLE" },
    krakens:    { keys: ["LB0"], power: "THE STRIP", blurb: "HIS HITS JAR BALLS LOOSE" },
    twisters:   { keys: ["QB0"], power: "TORNADO", blurb: "SPINS OUT OF THE 1ST SACK" },
    vipers:     { keys: ["WR0"], power: "GLUE HANDS", blurb: "NEVER DROPS A PASS" },
    lawnchairs: { keys: ["RB0"], power: "DAD STRENGTH", blurb: "DRAGS TACKLERS, MASHES X2" },
    legends:    { keys: ["WR0", "CB0"], power: "PRIME TIME", blurb: "OPEN-FIELD SPEED, HEATS UP" },
  };
  const FIRST = ["CHIP", "MOOSE", "TATER", "BUCK", "DUKE", "SKIP", "BUBBA", "RUSTY", "TUCK", "BIFF", "ZIGGY", "HOSS", "DINK",
    "WALLY", "BRICK", "SPUD", "COOTER", "FLAPJACK", "REGGIE", "GUS", "DEWEY", "BOOMER", "LUTZ", "MONK", "KIP", "TEX", "BJORN", "SARGE", "PEPPER", "OTIS"];
  const LAST = ["BUCKETS", "McFLURRY", "LINGUINI", "FAIRBANKS", "THUNDERPANTS", "WAFFLES", "PICKLESWORTH", "GRAVY", "MCSTOMP",
    "BISCUITS", "LUMPKIN", "HAMHOCK", "FROSTBYTE", "DOOLITTLE", "SPATULA", "BRATWURST", "NOODLES", "MEATLOAF", "TURNBUCKLE",
    "MUFFINTOP", "GOODNIGHT", "PANCAKE", "KNUCKLES", "CRUMB", "BOOGALOO", "TRUCKSTOP", "MOONPIE", "GRIDDLE", "SNOWCONE", "PUDDLES"];
  const NUM = { QB: [3, 19], RB: [20, 39], WR: [80, 89], TE: [81, 88], OL: [60, 79], KR: [10, 29], DL: [90, 99], LB: [50, 59], CB: [20, 39], S: [21, 49], CV: [40, 59] };
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  function info(teamId, key) {
    const d = DEF[teamId], t = TEAMS.byId[teamId];
    if (d && d.keys.includes(key)) {
      const [numName] = t.star.split(","); // "#32 HANK MALLORY, RB"
      return { star: true, name: teamId === "legends" ? "#89 PRIME" : numName, power: d.power, blurb: d.blurb };
    }
    const role = key.replace(/\d+$/, ""), h = hash(teamId + key), [lo, hi] = NUM[role] || [1, 99];
    return { star: false, name: "#" + (lo + h % (hi - lo + 1)) + " " + FIRST[h % FIRST.length] + " " + LAST[(h >>> 7) % LAST.length] };
  }
  const powerOf = teamId => (DEF[teamId] || {}).power;
  return { DEF, info, powerOf };
})();
