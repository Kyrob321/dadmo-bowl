// Weather: each team's home stadium has its own, and the game is played at one team's home.
// The pause menu can switch it off. Effects are small nudges to the same math the game already uses,
// and each one was predicted before testing (see tools/expectations.js).
const WEATHER = (() => {
  // fum: fumble chance x   drop: uncontested drop chance x   spd: everyone's speed x   miss: throw wobble x
  // deepMiss: extra wobble on 15+ yard throws   deepLook: how open deep receivers look to the computer QB (fog, wind)
  // kick: kick accuracy x   q4: late-game effects (fatigue, a soaked field) that only start in the 4th quarter
  // carry: ball carrier speed x (on top of spd)   brk: nudge to tackle battles in the runner's favor (positive = runner)
  const KINDS = {
    clear:      { label: "CLEAR SKIES" },
    night:      { label: "UNDER THE LIGHTS" },
    sunset:     { label: "SUNSET" },
    dome:       { label: "INDOORS · DOME" },
    snow:       { label: "SNOW", fum: 1.8, drop: 1.45, spd: 0.94, carry: 0.95, miss: 1.06, kick: 0.9 },
    rain:       { label: "RAIN", fum: 1.3, drop: 1.8, miss: 1.12, spd: 0.98 },
    fog:        { label: "FOG", deepLook: 0.4, deepMiss: 1.35 },
    wind:       { label: "WIND", miss: 1.08, deepMiss: 1.5, deepLook: 0.75, kick: 0.85, drift: true },
    heat:       { label: "DESERT HEAT", q4: { brk: 0.2 } },
    neon:       { label: "NEON RAIN", drop: 1.35, miss: 1.05 },
    sprinklers: { label: "SPRINKLERS", q4: { fum: 1.8, brk: 0.18 } },
    crt:        { label: "CRT STATIC + FLURRIES", fum: 1.3, spd: 0.98 },
  };
  let on = true, kind = "clear", forced = null;
  try { on = localStorage.getItem("dadmo-weather") !== "off"; } catch (e) {}

  function setFor(homeTeamId, override) { kind = forced || override || (TEAMS.byId[homeTeamId] || {}).home || "clear"; if (!KINDS[kind]) kind = "clear"; }
  const fx = () => (on ? KINDS[kind] : KINDS.clear);
  // A single effect value; late-game ones only count from the 4th quarter on.
  function get(key, quarter) {
    const k = fx(); let v = k[key];
    if (k.q4 && quarter >= 4 && k.q4[key] != null) v = (key === "brk" ? (v || 0) + k.q4[key] : (v || 1) * k.q4[key]);
    return v == null ? (key === "brk" ? 0 : 1) : v;
  }
  return {
    get, setFor, KINDS,
    kind: () => (on ? kind : "clear"), label: () => KINDS[kind].label,
    enabled: () => on, toggle() { on = !on; try { localStorage.setItem("dadmo-weather", on ? "on" : "off"); } catch (e) {} },
    force(k) { forced = k; if (k) kind = k; }, // developer mode / tests
    drift: () => !!fx().drift,
  };
})();
