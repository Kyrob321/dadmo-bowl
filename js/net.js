// Shared networking helpers for the TV screen (host) and the phone pad.
// PeerJS's free cloud only introduces the devices; button data then goes direct over Wi-Fi.
const NET = {
  PREFIX: "dadmo-bowl-26-",
  // No I, O, 0, 1: easy to read off a TV.
  LETTERS: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  newCode() {
    let c = "";
    for (let i = 0; i < 4; i++) c += this.LETTERS[Math.floor(Math.random() * this.LETTERS.length)];
    return c;
  },
  peerId(code) { return this.PREFIX + code.toUpperCase(); },
  KEYS: ["up", "down", "left", "right", "x", "z", "b", "start"],
};
