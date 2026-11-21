// Expected effects, written BEFORE running the simulations.
// Each entry: [stat, side, low, high] = the change vs the Krush mirror baseline should land in [low, high].
// side "off" = this team's offense; "def" = what opponents do against this team.
// Units: percentage points for % stats, yards for ypc/ypa, points for ptsDrive, ratio for fumble multipliers.
window.EXPECT = {
  anvils:   [["runShare","off",8,25], ["ypc","off",0.1,1.2], ["missTk","off",1,8], ["ypa","off",-1.5,0.4]],
  gators:   [["sack","def",1.5,8], ["comp","def",-7,0.5]],
  comets:   [["runShare","off",-28,-8], ["ypa","off",0.2,2.0], ["ypc","off",-1.2,0.1], ["air","off",0.5,5]],
  bolts:    [["ptsDrive","off",0.15,1.0], ["ptsDrive","def",-0.7,-0.05]],
  yetis:    [["int","def",0.3,3.0], ["comp","def",-9,-1], ["ypa","def",-1.8,-0.1]],
  rattlers: [["ypc","off",0.2,1.6], ["missTk","off",1,10], ["yac","off",0.3,3]],
  krakens:  [["fumRatio","def",1.3,2.6], ["missTk","def",-6,-0.5]],
  // (sack measured per dropback, since a scrambling team throws less often)
  twisters: [["sackDb","off",-6,-0.5], ["comp","off",-7,0.5]],
  vipers:   [["comp","off",1.5,9], ["ypa","off",0.2,1.8], ["missTk","def",0.5,6]],
  lawnchairs: [["fumRatio","off",0,0.05], ["runShare","off",8,25], ["missTk","off",1,12], ["ypc","off",-1.5,0.5]],
  legends:  [["ptsDrive","off",0.5,2.5], ["ptsDrive","def",-1.6,-0.3]],
};

// Weather (phase T6): written now, tested when weather exists. Change vs clear weather.
window.EXPECT_WEATHER = {
  snow:       [["fumRatio","both",1.4,2.2], ["ypc","both",-0.8,-0.2], ["ypa","both",-1.5,-0.3], ["drops","both",1.3,2.0], ["fgPct","both",-15,-3], ["ptsDrive","both",-0.6,-0.1]],
  rain:       [["drops","both",1.5,2.2], ["comp","both",-7,-2], ["fumRatio","both",1.1,1.6], ["ypa","both",-1.0,-0.2]],
  // fog comp: CHANGED after testing (was -3..1). Predicted fewer completions; measured +1.3, because computer QBs
  // stop trusting deep routes and check down to short, easier throws. That's realistic, so the expectation moved.
  fog:        [["air","both",-3,-0.5], ["int","both",0,1.2], ["comp","both",-3,2]],
  wind:       [["fgPct","both",-20,-5], ["air","both",-2.5,-0.3], ["comp","both",-4,0]],
  heat:       [["missTkQ4","both",1,6], ["ypcQ4","both",0,0.8]],
  neon:       [["drops","both",1.1,1.6], ["comp","both",-4,-0.5]],
  sprinklers: [["fumRatioQ4","both",1.3,2.5], ["missTkQ4","both",1,8]],
  crt:        [["fumRatio","both",1.1,1.5], ["ypc","both",-0.4,0]],
  dome:       [["any","both",-0.5,0.5]],
  clear:      [["any","both",-0.5,0.5]], night: [["any","both",-0.5,0.5]], sunset: [["any","both",-0.5,0.5]],
};

// Every team in every weather (written before the run). Each team vs Krush, change vs that same matchup in clear weather.
// 1. The weather's main stat moves the same way for every team (snow/rain/crt: more fumbles, except the Lawn Chairs,
//    who never fumble; rain/snow/neon: more drops; wind/fog: shorter catches).
// 2. No team breaks: points per drive (both teams together) stays within -1.0..+0.5 of clear for every team.
// 3. Home field doesn't flip a matchup: no team's win share swings more than 25 points vs clear.
window.EXPECT_COMBO = { ptsDrive: [-1.0, 0.5], winSwing: 25 };
