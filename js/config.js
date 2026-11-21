// Everything you might want to tweak lives here.
const CFG = {
  TEAMS: {
    1: { name: "J ROB'S BOLTS", short: "BOLTS", color: "#c8223a", dark: "#7d1022", trim: "#ffb627" },
    2: { name: "KYLE'S KRUSH", short: "KRUSH", color: "#2f6fd6", dark: "#173f86", trim: "#d8dde3" },
  },
  QUARTER_SECONDS: 180,   // game clock per quarter; about 15 real minutes for a full game
  FIELD_W: 53.33,         // yards, sideline to sideline
  SPEED: { QB: 6.3, RB: 7.6, WR: 7.5, TE: 6.6, OL: 5.0, DL: 6.0, LB: 6.9, CB: 7.6, S: 7.6, KR: 7.7, CV: 7.2 },
  BALL_SPEED: 20,         // yards per second on a throw
  FUMBLE: 0.015,          // chance per tackle
  MASH_CHANCE: 0.25,      // chance a human tackle turns into a mash-off
  FIRST_RECEIVER: 1,      // J Rob gets the ball first
};
