// Everything you might want to tweak lives here.
const CFG = {
  TEAMS: {
    1: { name: "J ROB'S BOLTS", short: "BOLTS", color: "#c8223a", dark: "#7d1022", trim: "#ffb627" },
    2: { name: "KYLE'S KRUSH", short: "KRUSH", color: "#2f6fd6", dark: "#173f86", trim: "#d8dde3" },
  },
  QUARTER_SECONDS: 180,   // game clock per quarter; about 15 real minutes for a full game
  ACTION_SPEED: 0.78,     // on-field action speed (1 = original pace); lower = more time to think
  FIELD_W: 53.33,         // yards, sideline to sideline
  FIRST_RECEIVER: 1,      // J Rob gets the ball first

  // NFL targets the simulation is tuned to (per play, approximate multi-season league averages).
  NFL: {
    compPct: 65, intPct: 2.2, sackPct: 6.8, ypc: 4.4, ypa: 7.0, missedTacklePct: 12,
    fumblePct: 1.5, fumbleLostShare: 44, contestedCatchPct: 46, runShare: 43,
  },

  // Calibration constants for the hidden rep scores (tuned by simulation against CFG.NFL).
  CAL: {
    // Tackle rep: score = BIAS + TIMING*(offense timing - defense timing) + RATING*(rating gap / 30) + noise
    TK_BIAS: -1.38, TK_TIMING: 0.85, GREEN: 0.35, NO_MOVE_Q: 0.3, TK_RATING: 0.9, TK_SIGMA: 0.62, TK_REACH: 1.2,
    FUMBLE_BASE: 0.0045, FUMBLE_BIG: 0.04,   // fumble chance; rises as the defender wins bigger
    // Contested catch rep: positive = receiver
    CC_BIAS: 0.35, CC_INT: -1.75, CC_MOSS: 1.4, CC_ERRANT: 0.2, CC_RADIUS: 1.0, CC_TIMING: 0.85, CC_RATING: 0.9, CC_SEP: 0.5, CC_SIGMA: 0.85,
    DROP_BASE: 0.02, DROP_SCALE: 0.08,     // uncontested drops
    // Line play: seconds an offensive lineman holds his block, before randomness
    BLOCK_BASE: 0.75, BLOCK_RATING: 1.4,
    // Timing windows (seconds of action time), widened by rating
    WIN_BASE: 0.06, WIN_RATING: 0.12, IDEAL_LEAD: 0.12,
    // Throws
    ACC_MISS: 2.7, PRESSURE_MISS: 1.3, SCRAMBLE_EARLY: 0, POWER_SPEED: 0.065,
    // Computer play calling and timing quality
    CPU_RUN: 0.5, QB_REACT: 0.47, DEF_READ: 0.3, DEF_BREAK: 6, DEF_TRAIL: 0.92, COV_LAG: 0.3, COV_CUSHION: 1.0, LB_EXTRA_LAG: 0.15, LB_CUSHION: 1.6, RUN_BLOCK: 3.8, LB_READ: 1.15, RUN_HOLE: 1.3, QB_SHORT: 12, QB_SHORT_BONUS: 2.0, QB_HOLD_MIN: 1.0, QB_HOLD_MAX: 2.3, CPU_MOVE: 0.55, CPU_Q_MEAN: -0.15, CPU_Q_SD: 0.45,
    // Mash battle: computer presses per second
    CPU_MASH: 6.0,
    // Tackle assist for the human defender
    LUNGE_TIME: 0.22, LUNGE_SPEED: 1.7, DIVE_RANGE: 2.0, DIVE_Q: 0.25, ASSIST_RANGE: 7, ASSIST: 0.45, HUMAN_REP_RANGE: 2.1,
  },
};
