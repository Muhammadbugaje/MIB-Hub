/* Arcade: MIB-Hub's home hero scene (Canvas 2D, no dependencies).

   A neon floor grid runs to the horizon, the MIB token (the logo's gold coin)
   turns above it inside two orbit rings, controller glyphs drift in the sky, a
   gold ball bounces along the floor leaving its arc behind (the physics every
   arcade game here is built on), and three phase waves cross the bottom edge,
   as on EE Hub's hero.

   Same contract as the other scenes (see gl.js):
     create(canvas, opts) -> { start(), stop(), resize(cssW, cssH, dpr), destroy() }
   resize() always paints one frame, so the scene is never blank when motion is
   paused, reduced, or the browser never ticks requestAnimationFrame. */
import { loop } from "../gl.js";

const TAU = Math.PI * 2;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

/* A small deterministic random, so the still frame is the same on every load. */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* The token's notched rim, as in Logo.astro: 18 notches around a circle. */
function rimPath(ctx, r) {
  const N = 18;
  ctx.beginPath();
  for (let i = 0; i < N * 4; i++) {
    const a = (i / (N * 4)) * TAU;
    const k = i % 4;
    const rr = k === 0 || k === 3 ? r : r * 0.915;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* Controller glyphs, drawn around (0, 0) at size s. */
const GLYPHS = {
  triangle(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.closePath();
  },
  circle(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.86, 0, TAU);
  },
  square(ctx, s) {
    const k = s * 0.78;
    ctx.beginPath();
    ctx.rect(-k, -k, k * 2, k * 2);
  },
  cross(ctx, s) {
    const k = s * 0.74;
    ctx.beginPath();
    ctx.moveTo(-k, -k); ctx.lineTo(k, k);
    ctx.moveTo(k, -k); ctx.lineTo(-k, k);
  },
  dpad(ctx, s) {
    const a = s * 0.36, b = s;
    ctx.beginPath();
    ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a); ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a);
    ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a); ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a);
    ctx.closePath();
  },
  diamond(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0);
    ctx.closePath();
  },
  star(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 10;
      const r = i % 2 ? s * 0.44 : s;
      ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  },
};
const GLYPH_NAMES = Object.keys(GLYPHS);

/* 8x8 pixel art: a heart (a life) and a little walker with two frames. */
const HEART = ["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000", "00000000"];
const WALK = [
  ["00111100", "01111110", "11011011", "11111111", "01111110", "00100100", "01000010", "11000011"],
  ["00111100", "01111110", "11011011", "11111111", "01111110", "00100100", "00100100", "01100110"],
];
function pixels(ctx, rows, x, y, px, colour) {
  ctx.fillStyle = colour;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) if (row[c] === "1") ctx.fillRect(x + c * px, y + r * px, px + 0.5, px + 0.5);
  }
}

export function create(canvas, opts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const pal = opts.palette || {};
  const GOLD = pal.a || "#e6c867", VOLT = pal.b || "#38e1f5", PLUM = pal.c || "#a78bfa", MINT = "#4ade80";
  const COLOURS = [VOLT, GOLD, PLUM, MINT];

  let w = 0, h = 0, dpr = 1, phone = !!opts.phone;
  let stars = [], glyphs = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function layout() {
    const rnd = seeded(20261115);
    stars = [];
    const nStars = phone ? 46 : 110;
    for (let i = 0; i < nStars; i++) {
      stars.push({ x: rnd(), y: rnd() * 0.62, r: 0.5 + rnd() * 1.3, p: rnd() * TAU, s: 0.5 + rnd() * 1.6, c: rnd() < 0.2 ? GOLD : rnd() < 0.5 ? VOLT : "#ffffff" });
    }
    glyphs = [];
    const nGlyphs = phone ? 7 : 15;
    for (let i = 0; i < nGlyphs; i++) {
      // Spread over the right-hand side (the copy sits on the left on wide screens).
      const gx = phone ? 0.04 + rnd() * 0.92 : 0.42 + rnd() * 0.58;
      const gy = phone ? 0.02 + rnd() * 0.3 : 0.1 + rnd() * 0.5;
      glyphs.push({
        kind: GLYPH_NAMES[i % GLYPH_NAMES.length],
        x: gx, y: gy,
        s: (phone ? 7 : 9) + rnd() * (phone ? 9 : 17),
        rot: rnd() * TAU, spin: (rnd() - 0.5) * 0.5,
        bob: 6 + rnd() * 12, bp: rnd() * TAU, bs: 0.35 + rnd() * 0.5,
        depth: 0.3 + rnd() * 0.9,
        c: COLOURS[i % COLOURS.length],
        a: 0.3 + rnd() * 0.5,
      });
    }
  }

  function geometry() {
    if (phone) {
      const R = Math.min(w * 0.19, 78);
      return { hy: Math.min(h * 0.36, 252), vx: w * 0.5, cx: w * 0.5, cy: 82 + R, R };
    }
    const R = Math.min(h * 0.165, w * 0.11, 160);
    return { hy: h * 0.67, vx: w * 0.7, cx: w * 0.735, cy: h * 0.4, R };
  }

  function drawStars(t) {
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = rgba(s.c === "#ffffff" ? "#ffffff" : s.c, a.toFixed(3));
      ctx.beginPath();
      ctx.arc(s.x * w + mouse.x * 6, s.y * h + mouse.y * 4, s.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawFloor(t, g) {
    const { hy, vx } = g;
    const depth = h - hy;
    // horizon glow
    const glow = ctx.createLinearGradient(0, hy - depth * 0.5, 0, hy + depth * 0.2);
    glow.addColorStop(0, rgba(VOLT, 0));
    glow.addColorStop(0.72, rgba(VOLT, 0.16));
    glow.addColorStop(1, rgba(VOLT, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, hy - depth * 0.5, w, depth * 0.7);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, w, depth);
    ctx.clip();
    ctx.lineWidth = 1;
    // lines running to the vanishing point
    const n = phone ? 14 : 26;
    for (let i = -n; i <= n; i++) {
      const xb = vx + (i / n) * w * 1.9;
      const a = 0.26 * (1 - Math.abs(i) / (n + 4));
      const grad = ctx.createLinearGradient(0, hy, 0, h);
      grad.addColorStop(0, rgba(VOLT, 0));
      grad.addColorStop(0.2, rgba(VOLT, a * 0.6));
      grad.addColorStop(1, rgba(VOLT, a));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(vx, hy);
      ctx.lineTo(xb, h);
      ctx.stroke();
    }
    // lines rolling towards the viewer
    const rows = 13;
    const shift = (t * 0.22) % 1;
    for (let k = 0; k < rows; k++) {
      const z = (k + shift) / rows;
      const y = hy + depth * Math.pow(z, 2.3);
      ctx.strokeStyle = rgba(k % 4 === 0 ? GOLD : VOLT, (0.06 + z * 0.34).toFixed(3));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
    // the horizon itself
    const hz = ctx.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, rgba(VOLT, 0));
    hz.addColorStop(phone ? 0.2 : 0.45, rgba(VOLT, 0.5));
    hz.addColorStop(phone ? 0.5 : 0.72, rgba("#ffffff", 0.9));
    hz.addColorStop(1, rgba(GOLD, 0.45));
    ctx.strokeStyle = hz;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(w, hy);
    ctx.stroke();
  }

  function drawToken(t, g) {
    const { cx, cy, R } = g;
    const x = cx + mouse.x * 14, y = cy + mouse.y * 10 + Math.sin(t * 0.8) * 5;
    // halo
    const halo = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 2.5);
    halo.addColorStop(0, rgba(VOLT, 0.3));
    halo.addColorStop(0.45, rgba(GOLD, 0.09));
    halo.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - R * 2.5, y - R * 2.5, R * 5, R * 5);

    // orbit rings (behind and in front are the same stroke; the coin covers the middle)
    ctx.save();
    ctx.translate(x, y);
    const orbits = [
      { rx: R * 1.72, ry: R * 0.5, tilt: -0.32, c: VOLT, sp: 0.5, dots: 2 },
      { rx: R * 2.15, ry: R * 0.74, tilt: 0.42, c: GOLD, sp: -0.32, dots: 1 },
    ];
    for (const o of orbits) {
      ctx.save();
      ctx.rotate(o.tilt);
      ctx.strokeStyle = rgba(o.c, 0.34);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let d = 0; d < o.dots; d++) {
        const a = t * o.sp + (d * TAU) / o.dots;
        const px = Math.cos(a) * o.rx, py = Math.sin(a) * o.ry;
        ctx.fillStyle = rgba(o.c, 0.22);
        ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = o.c;
        ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // the coin
    ctx.save();
    ctx.rotate(t * 0.14);
    const gold = ctx.createLinearGradient(-R, -R, R, R);
    gold.addColorStop(0, "#f6e6ae");
    gold.addColorStop(0.5, "#c8a951");
    gold.addColorStop(1, "#8f7226");
    ctx.shadowColor = rgba(GOLD, 0.6);
    ctx.shadowBlur = R * 0.34;
    ctx.fillStyle = gold;
    rimPath(ctx, R);
    ctx.fill();
    ctx.restore();

    const disc = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R * 0.8);
    disc.addColorStop(0, "#2a9a66");
    disc.addColorStop(0.55, "#0e3a2c");
    disc.addColorStop(1, "#061423");
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.76, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba("#f6e6ae", 0.55);
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.stroke();

    ctx.save();
    ctx.rotate(-t * 0.22);
    ctx.strokeStyle = rgba(VOLT, 0.5);
    ctx.lineWidth = Math.max(1, R * 0.016);
    ctx.setLineDash([R * 0.05, R * 0.1]);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.63, 0, TAU); ctx.stroke();
    ctx.restore();

    // play mark, pulsing softly
    const pulse = 1 + Math.sin(t * 1.6) * 0.035;
    ctx.save();
    ctx.scale(pulse, pulse);
    const s = R * 0.36;
    const volt = ctx.createLinearGradient(0, -s, 0, s);
    volt.addColorStop(0, "#e8fdff");
    volt.addColorStop(1, "#38e1f5");
    ctx.shadowColor = rgba(VOLT, 0.9);
    ctx.shadowBlur = R * 0.22;
    ctx.fillStyle = volt;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s);
    ctx.lineTo(s * 1.02, 0);
    ctx.lineTo(-s * 0.62, s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // a gold spark, top right
    ctx.fillStyle = "#f3dc8e";
    ctx.save();
    ctx.translate(R * 0.47, -R * 0.5);
    ctx.rotate(t * 0.5);
    const k = R * 0.1 * (0.85 + 0.15 * Math.sin(t * 3));
    ctx.beginPath();
    ctx.moveTo(0, -k); ctx.lineTo(k * 0.28, -k * 0.28); ctx.lineTo(k, 0); ctx.lineTo(k * 0.28, k * 0.28);
    ctx.lineTo(0, k); ctx.lineTo(-k * 0.28, k * 0.28); ctx.lineTo(-k, 0); ctx.lineTo(-k * 0.28, -k * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // reflection on the floor
    if (!phone) {
      const ry = g.hy + (g.hy - cy) * 0.22;
      const refl = ctx.createRadialGradient(x, ry, 0, x, ry, R * 1.9);
      refl.addColorStop(0, rgba(GOLD, 0.22));
      refl.addColorStop(1, rgba(GOLD, 0));
      ctx.save();
      ctx.translate(x, ry); ctx.scale(1, 0.22); ctx.translate(-x, -ry);
      ctx.fillStyle = refl;
      ctx.beginPath(); ctx.arc(x, ry, R * 1.9, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawGlyphs(t) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const gl of glyphs) {
      const x = gl.x * w + mouse.x * 26 * gl.depth;
      const y = gl.y * h + Math.sin(t * gl.bs + gl.bp) * gl.bob + mouse.y * 18 * gl.depth;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(gl.rot + t * gl.spin);
      GLYPHS[gl.kind](ctx, gl.s);
      ctx.strokeStyle = rgba(gl.c, (gl.a * 0.22).toFixed(3));
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = rgba(gl.c, gl.a.toFixed(3));
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBall(t, g) {
    if (phone || w < 1000) return;
    // The ball crosses the floor from right to left in a chain of shrinking hops.
    const floorY = g.hy + (h - g.hy) * 0.5;
    const period = 7.5;
    const u = (t % period) / period; // 0..1 across the screen
    const x0 = w * 1.04, x1 = w * 0.46;
    const hops = 5;
    const pos = (uu) => {
      const hop = Math.min(hops - 1, Math.floor(uu * hops));
      const f = uu * hops - hop;
      const amp = (h * 0.3) * Math.pow(0.72, hop);
      return { x: x0 + (x1 - x0) * uu, y: floorY - 4 * amp * f * (1 - f), hop, f };
    };
    // dotted arc already travelled
    for (let i = 1; i <= 26; i++) {
      const uu = u - i * 0.012;
      if (uu < 0) break;
      const p = pos(uu);
      ctx.fillStyle = rgba(GOLD, (0.5 * (1 - i / 26)).toFixed(3));
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * (1 - i / 40), 0, TAU); ctx.fill();
    }
    const p = pos(u);
    const fade = Math.min(1, u * 12, (1 - u) * 8);
    // landing ripples
    for (let hop = 1; hop <= p.hop + (p.f > 0.98 ? 1 : 0) && hop < hops + 1; hop++) {
      const landU = hop / hops;
      const age = (u - landU) * period;
      if (age < 0 || age > 1.1) continue;
      const lx = x0 + (x1 - x0) * landU;
      ctx.strokeStyle = rgba(GOLD, (0.5 * (1 - age / 1.1)).toFixed(3));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(lx, floorY + 3, 10 + age * 44, 3 + age * 10, 0, 0, TAU); ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = rgba(GOLD, 0.95);
    ctx.shadowBlur = 22;
    const ball = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 10);
    ball.addColorStop(0, "#fff7d6");
    ball.addColorStop(1, "#d9be6e");
    ctx.fillStyle = ball;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawPixels(t, g) {
    const px = phone ? 2 : 3;
    // lives, top right of the token
    const hx = g.cx + g.R * (phone ? 1.25 : 1.05), hyy = g.cy - g.R * (phone ? 0.95 : 1.45);
    for (let i = 0; i < 3; i++) {
      const beat = i === Math.floor(t * 1.2) % 3 ? 1 : 0;
      pixels(ctx, HEART, hx + i * px * 10, hyy - beat * 2, px, rgba(i < 2 ? "#ff6b8b" : "#ffffff", i < 2 ? 0.9 : 0.25));
    }
    if (phone || w < 1000) return;
    // a walker marching along the horizon
    const frame = WALK[Math.floor(t * 4) % 2];
    const span = w * 0.5;
    const wx = w * 0.5 + ((t * 26) % span);
    const edge = Math.min(1, (wx - w * 0.5) / 60, (w * 0.5 + span - wx) / 60);
    pixels(ctx, frame, wx, g.hy - 8 * px - 2, px, rgba(MINT, (0.85 * Math.max(0, edge)).toFixed(3)));
  }

  function drawWaves(t) {
    const base = h - (phone ? 44 : 78);
    const amp = phone ? 12 : 22;
    const list = [
      { c: GOLD, ph: 0 },
      { c: VOLT, ph: TAU / 3 },
      { c: PLUM, ph: (2 * TAU) / 3 },
    ];
    for (const wv of list) {
      ctx.beginPath();
      for (let x = 0; x <= w + 8; x += 8) {
        const y = base + Math.sin(x * 0.0085 - t * 1.25 + wv.ph) * amp * (0.75 + 0.25 * Math.sin(x * 0.002 + t * 0.4));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(wv.c, 0.14);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = rgba(wv.c, 0.72);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  function draw(_dt, t) {
    if (w < 2 || h < 2) return;
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const g = geometry();
    drawStars(t);
    drawFloor(t, g);
    drawGlyphs(t);
    drawToken(t, g);
    drawPixels(t, g);
    drawBall(t, g);
    drawWaves(t);
  }

  const runner = loop(draw, phone ? 30 : 0);
  runner.time = 2.6; // a pleasant still: the ball is mid-arc

  function onMove(e) {
    mouse.tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * -1;
    mouse.ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * -1;
  }
  const finePointer = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  if (finePointer && opts.motion === "full") window.addEventListener("pointermove", onMove, { passive: true });

  return {
    start() { runner.start(); },
    stop() { runner.stop(); },
    resize(cssW, cssH, ratio) {
      w = cssW; h = cssH; dpr = ratio || 1;
      phone = !!opts.phone || cssW < 700;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      layout();
      draw(0, runner.time);
    },
    destroy() {
      runner.stop();
      window.removeEventListener("pointermove", onMove);
    },
  };
}
export default create;
