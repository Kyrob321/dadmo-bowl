// Twelve original pixel mascots (12x12). Letters are colors: k outline, c team color, d team dark,
// t team trim, w white, g steel gray, y gold, r red, b near-black. "." is see-through.
// Used for the midfield logo and the sideline mascot who moonwalks after touchdowns.
const MASCOTS = (() => {
  const ART = {
    krush: [ // steel boot
      "............", "...kkkkk....", "...kgggk....", "...kgggk....", "...kgwgk....", "...kgggk....",
      "...kgggkk...", "...kggggkkk.", "..kggggggggk", "..kggggggggk", "..kkkkkkkkkk", "............"],
    anvils: [ // anvil
      "............", "............", "kkkkkkkkkkk.", "kggggggggggk", ".kgggggggggk", "..kkkgggkkk.",
      "....kgggk...", "....kgggk...", "...kgggggk..", "..kgggggggk.", "..kkkkkkkkk.", "............"],
    gators: [ // gator head
      "............", "..kkkk......", ".kccwkk.....", ".kckkcckkkk.", "kcccccccccck", "kcccccccccck",
      "kcwcwcwcwcck", "kkkkkkkkkkk.", "kwcwcwcwcwk.", ".kcccccccck.", "..kkkkkkkk..", "............"],
    comets: [ // comet
      "..........ky", "........kyyk", "......kyyk..", "....kyyyk...", "..kkyyk.....", ".kwwwwk.....",
      "kwwyywwk....", "kwyyyywk....", "kwyyyywk....", ".kwyywk.....", "..kkkk......", "............"],
    bolts: [ // lightning bolt
      "......kkkk..", ".....kyyk...", "....kyyk....", "...kyyk.....", "..kyyyyyyk..", "..kkkkyyk...",
      ".....kyk....", "....kyk.....", "...kyk......", "...kk.......", "............", "............"],
    yetis: [ // yeti face
      "...kkkkkk...", "..kwwwwwwk..", ".kwwwwwwwwk.", ".kwkkwwkkwk.", ".kwktwwktwk.", ".kwwwwwwwwk.",
      ".kwwkkkkwwk.", ".kwwkwwkwwk.", ".kwwwwwwwwk.", "..kwwwwwwk..", "...kkkkkk...", "............"],
    rattlers: [ // rattlesnake
      "............", "....kkkk....", "...kccccck..", "..kcckccck..", "..kcccccck..", "...kkccckrr.",
      ".....kcck..r", "..kkkkcck...", ".kcdcdcdk...", ".kcdcdcdk...", "..kkkkkk....", "............"],
    krakens: [ // kraken
      "...kkkkkk...", "..kcccccck..", ".kcccccccck.", ".kcwkcckwck.", ".kcwkcckwck.", ".kcccccccck.",
      "..kcccccck..", ".kckckckckk.", "kck.kck.kck.", "kk..kck..kk.", ".....kk.....", "............"],
    twisters: [ // twister
      "kkkkkkkkkkk.", "kccctttccck.", ".kccccccck..", ".kcctttcck..", "..kcccccck..", "...kccttk...",
      "...kcccck...", "....kcck....", "....kctk....", ".....kck....", "......kk....", "............"],
    vipers: [ // viper
      "............", "...kkkkkk...", "..kcccccck..", ".kcckcckcck.", ".kcckcckcck.", ".kcccccccck.",
      "..kcccccck..", "..kcwcwcck..", "...kcccck...", "....krrk....", "....r..r....", "............"],
    lawnchairs: [ // lawn chair
      "............", "..kkkkkkk...", "..kctctctk..", "..ktctctck..", "..kctctctk..", "..ktctctck..",
      "kkkkkkkkkkk.", ".kctctctctk.", ".kkkkkkkkkk.", ".kg......gk.", ".kg......gk.", ".kk......kk."],
    legends: [ // VHS tape
      "............", "kkkkkkkkkkkk", "kbbbbbbbbbbk", "kbwwwwwwwwbk", "kbwkkwwkkwbk", "kbwkkwwkkwbk",
      "kbwwwwwwwwbk", "kbbbbbbbbbbk", "kbbbyyyybbbk", "kkkkkkkkkkkk", "............", "............"],
  };
  const cache = new Map();
  // One canvas per team (and scale), built once.
  function icon(teamId) {
    if (cache.has(teamId)) return cache.get(teamId);
    const t = TEAMS.byId[teamId], art = ART[teamId] || ART.krush;
    const pal = { k: "#0c0c0e", c: t.color, d: t.dark, t: t.trim, w: "#f3efe4", g: "#9aa3ad", y: "#ffcc33", r: "#d8342c", b: "#2a2a2a" };
    const cv = document.createElement("canvas"); cv.width = 12; cv.height = 12;
    const x = cv.getContext("2d");
    art.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }));
    cache.set(teamId, cv);
    return cv;
  }
  return { icon, ART };
})();
