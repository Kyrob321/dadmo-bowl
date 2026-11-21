// Original pixel-art players, drawn from a tiny skeleton so every pose and frame matches.
// Each pose is a set of joints (in pixels, origin at the feet, facing right). Sprites are
// rendered once per team / skin / pose / frame / facing into small canvases and reused.
const SPRITES = (() => {
  const SW = 26, SH = 32, OX = 13, OY = 30;
  const SKINS = [["#f1c27d", "#d29a5c"], ["#c68642", "#9c6530"], ["#8d5524", "#6b3d17"], ["#e0ac69", "#bf8a4a"]];
  const cache = new Map();

  // ----- poses -----
  const S = Math.sin, Cs = Math.cos;
  const POSES = {
    // Athletic ready stance that breathes: knees soft, hands up a little.
    idle: f => ({ hip: [0, -9 + (f ? 0 : 0)], neck: [0.5, -16 + (f ? 1 : 0)], head: [1.5, -20 + (f ? 1 : 0)],
      bk: [[-1.5, -5], [-2.5, 0]], fk: [[1.5, -5], [2.5, 0]], ba: [[-1, -12 + (f ? 1 : 0)], [0, -9.5 + (f ? 1 : 0)]], fa: [[2.5, -12 + (f ? 1 : 0)], [3.5, -9.5 + (f ? 1 : 0)]] }),
    // Six-frame sprint: forward lean, knee drive on the swing leg, heel kick on the recovery leg, arms pumping opposite.
    run: f => {
      const a = f * Math.PI / 3, s = S(a), bob = Math.abs(Cs(a)) > 0.7 ? 0 : -1;
      const leg = ph => {
        const sw = S(ph), rec = Math.max(0, Cs(ph));
        const knee = [1 + 3 * sw, -5 + bob - (sw > 0 ? 2 * rec : 0)];
        const foot = sw > 0 ? [1 + 4.5 * sw - 1.5 * rec, -3 * rec] : [1 + 4 * sw - 1.5 * rec, -3.5 * rec];
        return [knee, foot];
      };
      return {
        hip: [0, -9 + bob], neck: [2.5, -16 + bob], head: [4, -20 + bob],
        fk: leg(a), bk: leg(a + Math.PI),
        fa: [[1 - 2.2 * s, -12.5 + bob], [3 - 2.8 * s, -11 + bob - 1.5 * Math.max(0, -s)]],
        ba: [[1 + 2.2 * s, -12.5 + bob], [3 + 2.8 * s, -11 + bob - 1.5 * Math.max(0, s)]],
      };
    },
    // Backpedal: upright, short choppy steps, eyes and chest still facing the play.
    backpedal: f => {
      const a = f * Math.PI / 2, s = S(a), bob = f % 2 ? -1 : 0;
      return { hip: [0, -9 + bob], neck: [1, -16 + bob], head: [2, -20 + bob],
        fk: [[1 + 1.5 * s, -5 + bob], [1.5 + 2.2 * s, -Math.max(0, Cs(a)) * 1.5]], bk: [[-1 - 1.5 * s, -5 + bob], [-1.5 - 2.2 * s, -Math.max(0, -Cs(a)) * 1.5]],
        fa: [[2.5, -12 + bob], [4, -10 + bob]], ba: [[-0.5, -12 + bob], [1, -10 + bob]] };
    },
    stance: () => ({ hip: [-2, -7], neck: [3, -10], head: [5, -12], bk: [[-4, -3], [-4, 0]], fk: [[1, -3], [0, 0]], fa: [[4, -6], [4, -1]], ba: [[2, -8], [1, -6]] }),
    throw: f => [
      { hip: [-1, -9], neck: [-1, -16], head: [0, -20], bk: [[-2, -5], [-4, 0]], fk: [[2, -5], [3, 0]], fa: [[-3, -18], [-6, -20]], ba: [[2, -13], [5, -13]], ball: [-6, -21] },
      { hip: [0, -9], neck: [1, -16], head: [2, -20], bk: [[-2, -5], [-4, 0]], fk: [[2, -5], [3, 0]], fa: [[2, -19], [5, -22]], ba: [[-1, -12], [-2, -10]] },
      { hip: [0, -9], neck: [2, -15], head: [4, -19], bk: [[-2, -5], [-4, 0]], fk: [[2, -5], [4, 0]], fa: [[4, -13], [6, -9]], ba: [[-1, -12], [-3, -11]] },
    ][f],
    catch: () => ({ hip: [0, -9], neck: [0, -16], head: [1, -20], bk: [[-1, -5], [-3, 0]], fk: [[2, -5], [3, 0]], fa: [[2, -20], [3, -24]], ba: [[0, -20], [0, -24]] }),
    jump: () => ({ lift: 6, hip: [0, -9], neck: [0, -16], head: [1, -20], bk: [[1, -6], [-2, -3]], fk: [[2, -5], [0, -2]], fa: [[2, -20], [3, -24]], ba: [[-1, -20], [-1, -24]] }),
    dive: () => ({ lift: 2, hip: [-4, -4], neck: [3, -5], head: [7, -5], fa: [[6, -6], [10, -6]], ba: [[5, -4], [9, -4]], fk: [[-7, -4], [-10, -5]], bk: [[-7, -3], [-10, -2]] }),
    fall: () => ({ hip: [-1, -6], neck: [-4, -11], head: [-6, -13], fa: [[-2, -15], [0, -18]], ba: [[-4, -13], [-3, -16]], fk: [[3, -6], [6, -4]], bk: [[2, -4], [5, -1]] }),
    down: () => ({ hip: [-2, -2], neck: [5, -2], head: [8, -3], fk: [[-6, -3], [-10, -1]], bk: [[-6, -1], [-9, 0]], fa: [[5, -4], [3, -6]], ba: [[4, -1], [2, 0]] }),
    grapple: f => ({ hip: [-2, -8], neck: [2, -13], head: [4, -15], fa: [[5, -13], [8, -12]], ba: [[4, -11], [7, -10]],
      fk: f ? [[1, -4], [2, 0]] : [[0, -5], [0, 0]], bk: f ? [[-4, -4], [-6, 0]] : [[-3, -4], [-5, 0]] }),
    celebrate: f => f
      ? { lift: 4, hip: [0, -9], neck: [0, -16], head: [0, -20], bk: [[-1, -6], [-3, -3]], fk: [[2, -6], [1, -3]], fa: [[3, -20], [5, -24]], ba: [[-3, -20], [-5, -24]] }
      : { hip: [0, -9], neck: [0, -16], head: [0, -20], bk: [[-1, -5], [-3, 0]], fk: [[1, -5], [3, 0]], fa: [[3, -19], [5, -23]], ba: [[-3, -19], [-5, -23]] },
    stiff: () => ({ hip: [0, -9], neck: [1, -16], head: [2, -20], bk: [[-2, -5], [-4, 0]], fk: [[2, -5], [4, -1]], fa: [[5, -15], [9, -15]], ba: [[-1, -12], [-2, -9]] }),
    truck: () => ({ hip: [-1, -8], neck: [3, -12], head: [5, -13], bk: [[-3, -4], [-6, 0]], fk: [[2, -4], [3, 0]], fa: [[4, -10], [5, -8]], ba: [[2, -10], [3, -8]] }),
    lunge: () => ({ lift: 1, hip: [-2, -7], neck: [3, -11], head: [6, -12], bk: [[-4, -4], [-7, -1]], fk: [[0, -4], [1, 0]], fa: [[6, -11], [10, -11]], ba: [[5, -9], [9, -9]] }),
    kick: f => f
      ? { hip: [0, -9], neck: [-2, -16], head: [-1, -20], bk: [[-1, -5], [-1, 0]], fk: [[4, -11], [8, -14]], fa: [[2, -13], [5, -15]], ba: [[-3, -14], [-6, -14]] }
      : { hip: [0, -9], neck: [1, -16], head: [2, -20], bk: [[0, -5], [1, 0]], fk: [[-2, -6], [-5, -3]], fa: [[2, -12], [3, -9]], ba: [[-2, -13], [-4, -12]] },
  };

  // ----- pixel drawing -----
  function brush(ctx, x, y, w, color) {
    ctx.fillStyle = color;
    const h = Math.floor(w / 2);
    ctx.fillRect(Math.round(x) - h, Math.round(y) - h, w, w);
  }
  function seg(ctx, a, b, w, color) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i++) brush(ctx, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, w, color);
  }

  function render(pose, pal) {
    const c = document.createElement("canvas"); c.width = SW; c.height = SH;
    const ctx = c.getContext("2d");
    const L = pose.lift || 0;
    const P = p => [OX + p[0], OY + p[1] - L];
    const hip = P(pose.hip), neck = P(pose.neck), head = P(pose.head);
    const sh = [neck[0], neck[1] + 1];
    const limbArm = (arm, sleeve, skin) => { const e = P(arm[0]), h = P(arm[1]); seg(ctx, sh, e, 2, sleeve); seg(ctx, e, h, 2, skin); brush(ctx, h[0], h[1], 2, skin); };
    const limbLeg = (leg, pants, sock) => {
      const k = P(leg[0]), f = P(leg[1]);
      seg(ctx, hip, k, 3, pants); seg(ctx, k, f, 2, sock);
      ctx.fillStyle = "#151515"; ctx.fillRect(Math.round(f[0]) - 1, Math.round(f[1]), 4, 1);
    };
    // back limbs first, a shade darker for depth
    limbArm(pose.ba, pal.jerseyDark, pal.skinDark);
    limbLeg(pose.bk, pal.pantsShade, pal.jerseyDark);
    // torso, shoulder pads, number
    seg(ctx, hip, neck, 5, pal.jersey);
    brush(ctx, neck[0], neck[1] + 1, 6, pal.jersey);
    const mid = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2];
    ctx.fillStyle = pal.number; ctx.fillRect(Math.round(mid[0]), Math.round(mid[1]) - 1, 2, 2);
    brush(ctx, hip[0], hip[1], 4, pal.pants);
    limbLeg(pose.fk, pal.pants, pal.jersey);
    // helmet: shell, stripe, facemask, a glimpse of face
    const hx = Math.round(head[0]) - 2, hy = Math.round(head[1]) - 2;
    ctx.fillStyle = pal.helmet; ctx.fillRect(hx, hy, 5, 5); ctx.fillRect(hx + 1, hy - 1, 3, 1);
    ctx.fillStyle = pal.helmetShade; ctx.fillRect(hx, hy + 4, 3, 1);
    ctx.fillStyle = pal.stripe; ctx.fillRect(hx + 1, hy - 1, 1, 4);
    ctx.fillStyle = pal.skin; ctx.fillRect(hx + 3, hy + 2, 1, 2);
    ctx.fillStyle = "#9aa0a6"; ctx.fillRect(hx + 4, hy + 1, 1, 3); ctx.fillRect(hx + 5, hy + 2, 1, 1);
    limbArm(pose.fa, pal.jersey, pal.skin);
    if (pose.ball) { const b = P(pose.ball); ctx.fillStyle = "#7a3f12"; ctx.fillRect(Math.round(b[0]) - 1, Math.round(b[1]) - 1, 3, 2); }
    outline(ctx);
    return c;
  }

  function outline(ctx) {
    const img = ctx.getImageData(0, 0, SW, SH), d = img.data, out = new Uint8ClampedArray(d);
    const solid = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && d[(y * SW + x) * 4 + 3] > 0;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        const i = (y * SW + x) * 4; out[i] = 12; out[i + 1] = 12; out[i + 2] = 14; out[i + 3] = 255;
      }
    }
    img.data.set(out); ctx.putImageData(img, 0, 0);
  }

  function palette(team, skin) {
    const T = CFG.TEAMS[team], sk = SKINS[skin % SKINS.length];
    return {
      jersey: T.color, jerseyDark: T.dark, helmet: T.helmet || T.trim, helmetShade: shade(T.helmet || T.trim, -40), stripe: T.color,
      pants: T.pants || "#e9e6dc", pantsShade: shade(T.pants || "#e9e6dc", -40),
      number: T.number || "#ffffff", skin: sk[0], skinDark: sk[1],
    };
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, v + amt));
    return "#" + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0");
  }

  // Returns a ready canvas. face: 1 right, -1 left.
  function get(team, skin, pose, frame, face) {
    const T = CFG.TEAMS[team];
    const key = T.color + (T.helmet || T.trim) + (T.pants || "") + (T.number || "") + "|" + skin + "|" + pose + "|" + frame + "|" + face;
    let c = cache.get(key);
    if (c) return c;
    const base = render(POSES[pose](frame || 0), palette(team, skin));
    if (face < 0) {
      c = document.createElement("canvas"); c.width = SW; c.height = SH;
      const x = c.getContext("2d"); x.translate(SW, 0); x.scale(-1, 1); x.drawImage(base, 0, 0);
      c = flipFix(c);
    } else c = base;
    cache.set(key, c);
    return c;
  }
  function flipFix(c) { return c; }

  return { get, SW, SH, OX, OY };
})();
