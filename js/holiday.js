// Christmas season: on from November 20 through December 31 (by the laptop's own date), off again on
// New Year's Day, every year. For testing any time: add ?xmas=1 (force on) or ?xmas=0 (force off) to the address.
// The rest of the game asks HOLIDAY.on; the page gets an "xmas" class for the decorations in the CSS.
const HOLIDAY = (() => {
  const force = new URLSearchParams(location.search).get("xmas");
  const inSeason = d => (d.getMonth() === 10 && d.getDate() >= 20) || d.getMonth() === 11;
  const on = force === "1" ? true : force === "0" ? false : inSeason(new Date());
  if (on) {
    document.documentElement.classList.add("xmas");
    // Falling snow over the title screen and the phone pad (plain page elements, behind the controls).
    const flakes = () => {
      if (document.getElementById("xsnow")) return;
      const box = document.createElement("div"); box.id = "xsnow"; box.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 46; i++) {
        const f = document.createElement("i");
        const size = 2 + Math.floor(Math.random() * 3);
        f.style.cssText = "left:" + (Math.random() * 100).toFixed(1) + "%;width:" + size + "px;height:" + size + "px;" +
          "animation-duration:" + (7 + Math.random() * 9).toFixed(1) + "s;animation-delay:-" + (Math.random() * 16).toFixed(1) + "s;" +
          "--drift:" + Math.round(Math.random() * 60 - 30) + "px;opacity:" + (0.5 + Math.random() * 0.5).toFixed(2);
        box.appendChild(f);
      }
      document.body.prepend(box);
      // A holiday line under the title logo.
      const sub = document.querySelector(".title .sub");
      if (sub && !document.querySelector(".xmas-msg")) { const p = document.createElement("p"); p.className = "xmas-msg"; p.textContent = "HOLIDAY EDITION · MERRY CHRISTMAS!"; sub.after(p); }
    };
    if (document.body) flakes(); else document.addEventListener("DOMContentLoaded", flakes);
  }
  return { on };
})();
