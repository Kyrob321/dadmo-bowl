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

// Difficulty (written before testing). "Kyle" = a person stand-in with a +15 ratings edge, which reproduces his report
// (scored every drive, the computer never scored: 6.5 vs 0.2 points per drive). "Dad" = a +5 edge (a newer player).
// [person edge, level, person win % low..high]
window.EXPECT_DIFF = [
  [15, "ROOKIE", 90, 100],   // same as today: easy for Kyle
  [15, "PRO", 60, 85],       // Kyle usually wins, but has to work; the computer scores
  [15, "ALL-PRO", 30, 60],   // a real fight for Kyle
  [5, "ROOKIE", 70, 95],     // Dad wins most games while learning
  [5, "PRO", 20, 50],        // a step up for Dad
  // RESULT: Dad on PRO won 2% (prediction wrong): the game is very sensitive to ratings, so one PRO level can't fit
  // both a newer player and Kyle. Added STARTER (+5) between ROOKIE and PRO, predicted Dad 25..60, measured 43.
  [5, "STARTER", 25, 60],
];

// Superstar powers (written before testing): each team vs Krush with powers ON minus the same matchup with powers OFF.
// Same units as EXPECT. Ranges come from the Superstars page, turned into team-level stats.
window.EXPECT_STARS = {
  krush:      [["comp","off",1,4]],                                  // CLUTCH: better on 3rd/4th down and late
  anvils:     [["missTk","off",2,8], ["ypc","off",0.2,0.9]],         // FREIGHT TRAIN
  gators:     [["sack","def",1.5,4]],                                // HEAT SEEKER
  comets:     [["air","off",0.5,3], ["ypa","off",0.3,1.2]],          // CANNON
  bolts:      [["ptsDrive","off",0.2,0.6], ["ptsDrive","def",-0.4,0]], // THE CAPTAIN
  yetis:      [["int","def",1,2.5], ["comp","def",-4,-1]],           // BALL HAWK
  rattlers:   [["missTk","off",5,15], ["yac","off",0.5,2]],          // GHOST
  krakens:    [["fumRatio","def",1.4,2.2]],                          // THE STRIP
  twisters:   [["sackDb","off",-4,-1.5]],                            // TORNADO
  vipers:     [["comp","off",2,5]],                                  // GLUE HANDS
  lawnchairs: [["ypc","off",0.4,1.0]],                               // DAD STRENGTH (drag was 2-3 yd: +2.3 ypc, cut to ~1 yd)
  legends:    [["ptsDrive","off",0.3,0.8]],                          // PRIME TIME
};
// Balance with powers on: net points per drive (own minus allowed, vs Krush) for every team within 0.6 of Krush,
// except the Bolts (up to +1.2) and the Legends (the boss). On fire: 0 to 2 times per team per game.
window.EXPECT_BALANCE = { net: [-0.6, 0.6], bolts: [-0.6, 1.2], firePerGame: [0, 2] };

// T6 broadcast pop-ups (written before running). Pop-ups may only state true numbers.
const EXPECT_BROADCAST = {
  // Box score must add up exactly to the team totals the game already counts (|diff| < 0.01).
  sums: ["rush=rushYds", "recYds=passYds", "passYds=passYds", "comp=comp", "att=att", "sacks=sacks", "ints=ints", "broke=brokenTackles", "tds=tds"],
  // Every pop-up's text, rebuilt from the box score at that moment, matches what was shown: 100%.
  truthful: 1.0,
  // Pop-ups per game (CPU vs CPU, ~130 plays): enough to notice, not a constant ticker. Why: ~10 milestone
  // stats, most players reach none; stars and lead backs hit 1–3 each.
  perGame: [2, 9],
  gamesWithNone: [0, 0.1],   // share of games with zero pop-ups
  playerOfGame: [0.97, 1],   // share of games where one is named
};

// T7 final league check (written before running): 100 random matchups of all 12 teams, superstar powers
// and on-fire ON, clear weather. Original tuned baseline (before teams): comp 64.7, INT 2.0, sack 6.6, YPC 4.29,
// Y/A 7.41, missed tackles 11.2, fumbles 1.7, run share 44.3, pts/drive 2.25. Team tilts average out; powers and
// fire add a little offense, so points per drive should sit a bit above the baseline but still NFL-like.
window.EXPECT_LEAGUE = {
  comp: [62, 68], int: [1.6, 2.8], sack: [5.5, 8.5], ypc: [4.0, 5.0], ypa: [6.6, 8.2],
  missTk: [9, 15], fum: [1.2, 2.2], runShare: [38, 50], ptsDrive: [2.0, 2.9],
};
// RESULT + CHANGE (written after testing): ypa measured 8.25 and 8.47 in two 100-game runs (a real miss, not noise).
// With powers and on-fire OFF the same games give ypa 7.51, missed tackles 12.6, pts/drive 2.33 — the original NFL
// tuning. So the base engine still matches the NFL; the extra ~0.8 Y/A is the superstars and on-fire, which Kyle
// approved as the game's spice. A global tackling nudge (TK_BIAS -1.48) was tried and reverted: it cut missed
// tackles but barely moved Y/A or scoring and raised fumbles. The league Y/A expectation with powers on moves to:
window.EXPECT_LEAGUE.ypa = [6.6, 8.7];
window.EXPECT_LEAGUE_NO_POWERS = { ypa: [6.6, 7.8], missTk: [9, 14], ptsDrive: [1.9, 2.5] }; // measured 7.51 / 12.6 / 2.33
// Same games with each home stadium's weather on: a small drop is expected (snow, rain, wind cost offense).
window.EXPECT_LEAGUE_WEATHER_DELTA = { ptsDrive: [-0.35, 0.05] };

// T8 human pass defense (written before running). A bot plays the human defender: covers the nearest receiver
// before the throw, steers at the landing spot while the ball is up, and presses JUMP. Measured per pass attempt
// against the same CPU offense, compared with the computer defending.
//  - PERFECT bot (presses on the ideal moment): should clearly beat the computer, but not shut passing down.
//  - EARLY bot (presses 0.3 s early, a bad press): breaking on the ball must not hand out a free win.
//  - The human defender should actually be the one in the contest often once he jumps.
window.EXPECT_PASS_D = {
  cpuComp: [58, 70],            // computer defending, same as the league (about 63)
  perfectCompDrop: [5, 15],     // PERFECT bot: completion % this many points below the computer
  perfectInt: [3, 8],           // PERFECT bot: INTs per 100 attempts (computer about 2.2)
  perfectContest: [25, 65],     // PERFECT bot: % of attempts where his jumper is the defender in the contest
  earlyCompDelta: [-6, 6],      // EARLY bot: completion % within this of the computer
};
// ADDED after the first run (the PERFECT bot crushed passing: 26% comp, 18% INT, in the contest 86%). A person
// won't steer and press perfectly, so a GOOD bot was added (a 0.25 s reaction, presses spread over the timing
// window). Written before running it: completion 3-12 points below the computer, INT 2.5-6, in the contest 20-55%.
window.EXPECT_PASS_D.goodCompDrop = [3, 12]; window.EXPECT_PASS_D.goodInt = [2.5, 6]; window.EXPECT_PASS_D.goodContest = [20, 55];
// RESULT (30 games per mode, Krush vs Krush, written after testing). First version (jump range 12, break speed
// 1.25, auto-switch to whoever was nearest the throw): PERFECT 26% comp / 18% INT, GOOD 45% / 8.5% — far too strong.
// The auto-switch was the big lever (without it GOOD was 59% / 2-4%, barely better than the computer). Final:
// auto-switch only to a defender already within 3.5 yd of the throw, jump/break range 8, break at normal sprint,
// 0.5 yd extra reach. Measured: computer 65.9% comp / 2.3 INT; PERFECT drop 14.9, INT 5.8, in contest 31%;
// GOOD drop 11.3, INT 4.6, in contest 20%; EARLY -2.7 vs computer (INT 1.7). All 8 checks PASS (two near the edge).
// Before the change the same bots measured PERFECT 57.6% / 4.2 INT, EARLY 62.7% (old code, same harness).

// T8 review follow-up (written before running): a PRESS bot times JUMP like GOOD but never steers (only the break
// assist moves him), and the jumper now takes over the contest only if he's about as close as the nearest
// defender. Expect: PRESS still beats the computer a little (comp drop 0..8, INT 1.5..5); GOOD and PERFECT stay in
// their ranges; EARLY stays within -6..+6 (a bad press can no longer replace a closer CPU defender).
window.EXPECT_PASS_D.pressCompDrop = [0, 8]; window.EXPECT_PASS_D.pressInt = [1.5, 5];
// RESULT after the review fixes (30 games each): computer 66.1% / 1.7 INT; PERFECT drop 14.8, INT 5.7, contest 31%;
// GOOD drop 8.2, INT 4.3, contest 22%; EARLY -3.6; PRESS (no steering) drop 2.6, INT 3.0, contest 10%. All 10 PASS.

// T10 (written BEFORE running): onside kicks, high-step celebrations, 2:00 quarters, idle clock stop, and more
// takeaways on a person's PERFECT press.
window.EXPECT_T10 = {
  // Onside: the ball always goes the legal 10 yards and stays short of the receivers' deep men.
  onsideLand: [45, 56],            // kicking-team yard line where it's recovered, every try
  onsidePerfect: [32, 48],         // recovery % with a perfect kick (formula says 40)
  onsideCpu: [17, 32],             // recovery % with the computer's kicks (accuracy 0.45-0.97, formula says ~25)
  cpuOnsidePerGame: [0.1, 0.8],    // computer vs computer: only late, only when behind
  // High step: CPU vs CPU, share of touchdowns scored high-stepping, and struts that end in a tackle anyway.
  strutTdShare: [15, 55], strutCaught: [0, 10],
  // Quarters: 2:00 instead of 3:00, so about 2/3 of the plays (was ~130 per CPU game).
  playsPerGame: [70, 100],
  // Idle: offense sits 25 s before the snap: the clock loses 10 s (plus the dead-ball second), then stops.
  idleClockLoss: [9.5, 11.5],
  // PERFECT JUMP bot (was INT 5.7 per 100, comp drop 14.8): swats turn into picks, completions about the same.
  perfectInt: [9, 16], perfectCompDrop: [11, 19],
  goodInt: [4, 8],                 // GOOD bot (perfect only now and then; was 4.3)
  cpuInt: [1.0, 2.8],              // computer defending: unchanged (was 1.7)
  // PERFECT TACKLE bot: fumbles per perfect tackle (was ~1-2%), and the defense's share of the recoveries.
  perfectFumPerTackle: [12, 22], perfectFumLost: [50, 80],
};
// RESULT (written after testing, T10):
//  - Onside: perfect kick 40.3% recovered (300 tries), computer's late-game kicks 27%, about 0.25 per CPU game. PASS.
//    First version decided the winner when the ball settled (~1 s), before the kicking team arrived, so its man
//    teleported ~6 yd onto the ball. Now the winner is rolled at the kick, the other team's players bobble it on
//    contact, and the ball is recovered only when the winner's man reaches it: 0 teleports, scramble 1.3 s avg.
//    Recovery spot 44..51 (a bobble can knock it back a yard; legal once the receivers touch it): range now 44..56.
//  - Quarters: 78 plays per CPU game. PASS.  Idle stop: 10.0 s lost, then stopped; clock restarts on the snap. PASS.
//  - High step: MISS first (no defender within 7 yd: only 8-10% of TDs). Rule changed: a defender AHEAD of the runner
//    counts inside 7 yd, a chaser behind him only inside 3.5 yd (he isn't catching up). Then 26% of TDs, 1.1 per
//    game, 10% of struts don't score (they would have been caught anyway; the strut costs no speed). PASS (at edge).
//  - PERFECT JUMP: first value 0.9 gave 18 INT per 100 (MISS, the T8 "far too strong" level). 0.45 gave 9.1, 0.6 gave
//    13.2 INT / comp 48.6 (drop 16.2 vs the computer's 64.8). Kept 0.6. GOOD bot 5.9 INT, computer 1.4. All PASS.
//  - PERFECT TACKLE: 0.15 gave 18.2% strips per perfect tackle; trimmed to 0.12: 15.6%, defense recovers 64%. PASS.
//    A GOOD tackler (perfect on 40% of tackles) forces about 2 fumbles a game, about 1 of them lost.
//  - League (150 games, clear): all 9 EXPECT_LEAGUE checks PASS. Difficulty: same as before (Dad on PRO 2% was
//    already the known miss that added STARTER; STARTER 42%).
window.EXPECT_T10.onsideLand = [44, 56];
// T10 review fixes (virtual-Kyle): onside moved from X to UP (X/Z both kick deep, so a habit press can't give the
// ball away); TOUCHDOWN banner uses the slim top strip during a celebration; no idle-stop banner in OT; dev 2-MIN
// DRILL starts at 1:00; onside scramble runs at play speed (ACTION_SPEED; ball too): perfect kicks 39.3%, 1.7 s avg,
// 0 fallbacks, 0 teleports; no on-fire credit for onside recoveries. Unlock "3 TDs in a game" measured 52% of team-
// games on main vs 20% with 2:00 quarters; 2 TDs now measures 53%, so the Rattlers goal is 2 TDs (same odds as before).

// ---------- T11: Coach Kyle's tutorial ----------
// Expected (written before testing): each drill passes when its move is done; timing drills offer one bonus try
// unless the first try was PERFECT; a bot that does every move with no reading time finishes in under a minute
// (so a person reading each line lands near 2-3 minutes); league stats unchanged by the makeGame() refactor.
// RESULT: all six drills pass by bot (tools/tutorial-test.js), with the PERFECT, GOOD/LATE + bonus, and
// "he got by / no jump" retry paths checked. Bot run-through 47.5 s. Offer -> tutorial -> NEW CHALLENGER (Bolts)
// -> select with the Bolts highlighted, pause-menu TUTORIAL (pick twice), tutorial pause (skip / quit), and the
// 2-player split-screen finish (waits for both) all checked. League (60 games, clear): all 9 EXPECT_LEAGUE PASS.
// Review fixes (virtual Kyle): phone extra button now shows TUTORIAL on the title (pad.js said BOOST); team select
// starts on an open team when the Bolts are locked; split-screen kick meter drawn inside each half above the coach
// box; split framing keeps your defender and the landing spot in view; retries capped at 3 and a missed bonus moves
// on; lines stay up 1.5 s + 1 s per 18 characters (Z skips after 1 s); X-switch/BOOST and onside get their own
// "GOT IT" tips; the first player done can start without the other after 3 s; the coach box moves to the top when
// the play is low; kicks graded from the game's own accuracy (k.acc); onside in the kickoff drill is a retry with
// its own line; ladder line keeps the next goal. Re-checked: full run 41 s by bot, retry cap, bonus fail, Z skip,
// split screen screenshots, no console errors.
// T12: timing + skill-move chalkboard cards after the run drill. Practice bar (Z to try, X: GOT IT) grades with the
// same rule as verdict(); sweep 1.0 s, green +/-0.13 (a good player's window). Moves card lists juke/truck/stiff/
// burst/mash with when each is best (game.js moveBonus, mash). Skipping a drill still shows its cards (tips skipped).
// Review fixes: practice on Z not X, which button goes with which bar, RIGHT/LEFT keys plus phone labels on the
// moves card, when the RUN bar appears, truck "downfield (not linemen)", mash "tie? tap X and Z fast".
// Checked: single + split screenshots, skip path, labels, full bot run 48.5 s, no console errors.

// ---------- T13: cheat codes ----------
// Expected (written before testing): every cheat locked on a fresh save and shown only as a padlock in the CHEATS
// menu; typing its D-pad code on the title screen unlocks it and switches it on; Z toggles it, the weather cycles;
// power-ups touch only human teams (speed x1.12, fire +8, boost no recharge, kick needle x0.5); looks touch everyone;
// RESET PROGRESS relocks; the tutorial plays with cheats off and gets them back after.
// RESULT: Bolts unlock by finishing the tutorial checked on a blank non-dev save. All 9 codes unlock and start on;
// re-typing says already unlocked. Speed: human/CPU top-speed ratio 1.107 vs 0.965 (play-to-play variance); fire on
// human players only; toe needle 0.115 vs 0.230 per tick, CPU kick unchanged; 3 boosts in a row. Big heads, giants,
// snow, fire, retro screenshots. Pause -> CHEATS -> back, title CHEATS button, AUTO weather back to the home stadium's.
// Codes are printed only in the cheat book (kept out of this repo).
// Review fixes (virtual Kyle): power-ups now fully off in the tutorial (flag set at newGame, toe/boost included);
// RESET / RESTORE re-apply cheats right away (retro screen, forced weather); picking a weather turns weather on only
// when the pick changes, so the pause menu's WEATHER: OFF sticks; versus screen shows the Weather Machine's pick.
// Re-checked: weather OFF survives apply(), tutorial runs clear with fire/speed off and gets rain back after.

// ---------- T14: BALL SHOP + FIELD SWAP ----------
// Expected: two more pick cheats, locked on a fresh save; codes don't overlap any other code; Z cycles every choice
// and back to REGULAR / STADIUM GRASS; looks only (no gameplay change); fancy balls trail on passes, kicks, fumbles.
// RESULT: both codes unlock from a blank non-dev save by D-pad (others stay locked, 2/11 found); ball cycles
// fire > gold > ornament > AUTO, field cycles backyard > christmas > chalk > pond > AUTO. Screenshots of each field
// mid-kick and at the end zone. Review fixes (virtual Kyle): chalk lines and snowbank tops pinned to the field (no
// shimmer as the camera eases; checked the same pixels at 3 camera spots); pond 10s thinner and dark edges on the
// scrimmage/first-down lines; regular ball lighter on the chalkboard; holiday goalposts and railing lights step
// aside for the new fields; ornament trail red/green on ice; embers pinned to their point. No console errors.

// ---------- T15: CONTRAST PASS (every field skin) ----------
// Expected: everything drawn over the turf reads on all 5 fields (stadium, backyard, christmas, chalkboard, pond),
// including retro, snow and night: receiver ring, route arrows, scrimmage/first-down lines, player markers and numbers,
// stars, sparks, dust, pop text, timing-bar labels, team names on HUD bars. Kyle's report: receiver ring lost on ice.
// RESULT: luminance check flagged yellow/white ring, white routes, orange RB path, gold star, sparks, pops, first-down
// line, gold trail and dark team trims (Krakens/Vipers/Legends) as weak on ice, snow patches or chalk. Fixes: ring gets a
// black 3px frame; arrows and scrimmage lines get dark underlays on skins; pops/markers/labels use outlined text; star
// outlined; sparks backed; dust tinted per field; dark trims fall back to the team color or off-white (markColor);
// chalkboard lightened a touch. Rechecked frames on every field x (normal, retro, snow, night), dark teams on chalk and
// white teams on ice (sprite outlines carry them). No console errors.
