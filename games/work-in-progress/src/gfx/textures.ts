/**
 * Every surface texture is painted in code at load time (no image downloads):
 * asphalt, pavers, brick, stone, roof tiles, grass, laterite, bark, leaves,
 * plus the shop-sign atlas and the clock face. Height maps become normal maps
 * so brick and tiles catch the light.
 */
import * as pc from "playcanvas";
import { makeRng, noise2 } from "../sim/rng.ts";

function canvas(size: number, h = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}

export function toTexture(device: pc.GraphicsDevice, src: HTMLCanvasElement, srgb = true, repeat = true, name = "tex"): pc.Texture {
  const tex = new pc.Texture(device, {
    name,
    width: src.width,
    height: src.height,
    format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
    anisotropy: 8,
  });
  tex.setSource(src);
  return tex;
}

/** Per-pixel painter with tileable noise. f returns [r, g, b] 0..255 and a height 0..1. */
function pixels(size: number, f: (x: number, y: number) => [number, number, number, number]): { color: HTMLCanvasElement; height: Float32Array } {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b, h] = f(x, y);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      height[y * size + x] = h;
    }
  ctx.putImageData(img, 0, 0);
  return { color: c, height };
}

/** Tileable noise: wraps at `period` cells. */
function tn(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const w = (v: number) => ((v % period) + period) % period;
  const g = (a: number, b: number) => noise2(w(a) + 0.5, w(b) + 0.5, seed);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(x: number, y: number, size: number, base: number, oct: number, seed: number): number {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) {
    const p = base * 2 ** o;
    s += a * tn((x / size) * p, (y / size) * p, p, seed + o);
    n += a;
    a *= 0.5;
  }
  return s / n;
}

function normalFrom(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / l) * 127 + 128;
      img.data[i + 1] = (dy / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

const clamp = (v: number) => Math.max(0, Math.min(255, v));

export interface TexturePair { map: pc.Texture; normal?: pc.Texture }

export function makeTextures(device: pc.GraphicsDevice, small: boolean) {
  const S = small ? 256 : 512;
  const pair = (name: string, p: { color: HTMLCanvasElement; height: Float32Array }, strength: number, size = S): TexturePair => ({
    map: toTexture(device, p.color, true, true, name),
    normal: strength > 0 ? toTexture(device, normalFrom(p.height, size, strength), false, true, name + "-n") : undefined,
  });

  // Asphalt: dark, fine aggregate, gentle wear patches. One tile = 4 m.
  const asphalt = pair("asphalt", pixels(S, (x, y) => {
    const n = tfbm(x, y, S, 4, 4, 11);
    const grit = tn(x * 0.9, y * 0.9, Math.round(S * 0.9), 12);
    const sp = grit > 0.78 ? 22 : grit < 0.2 ? -10 : 0;
    const v = 62 + n * 26 + sp;
    return [clamp(v), clamp(v + 1), clamp(v + 4), n * 0.5 + grit * 0.5];
  }), 2.2);

  // Concrete pavers (sidewalks): 0.5 m squares, slight colour variation per slab. Tile = 2 m.
  const paver = pair("paver", pixels(S, (x, y) => {
    const cell = S / 4;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const ex = Math.min(x % cell, cell - (x % cell)), ey = Math.min(y % cell, cell - (y % cell));
    const edge = Math.min(ex, ey) < S / 160 + 1 ? 1 : 0;
    const tone = noise2(cx + 0.3, cy + 0.7, 5) * 18;
    const n = tfbm(x, y, S, 8, 3, 21) * 16;
    const v = edge ? 112 : 172 + tone + n - 10;
    return [clamp(v), clamp(v - 4), clamp(v - 12), edge ? 0 : 0.9 + n / 100];
  }), 3);

  // Brick pavers in herringbone-ish stretcher bond (plazas, forecourts). Tile = 2 m.
  const brickPave = pair("brickpave", pixels(S, (x, y) => {
    const bh = S / 16, bw = S / 8;
    const row = Math.floor(y / bh);
    const ox = row % 2 ? bw / 2 : 0;
    const bx = Math.floor((x + ox) / bw);
    const mx = (x + ox) % bw, my = y % bh;
    const mortar = mx < 2 || my < 2;
    const t = noise2(bx + 0.5, row + 0.5, 31);
    const n = tfbm(x, y, S, 16, 2, 32) * 20;
    const r = mortar ? 150 : 160 + t * 40 + n, g = mortar ? 140 : 82 + t * 26 + n * 0.6, b = mortar ? 125 : 58 + t * 16 + n * 0.4;
    return [clamp(r), clamp(g), clamp(b), mortar ? 0 : 1];
  }), 3.5);

  // Wall brick (red, running bond). Tile = 2 m.
  const brick = pair("brick", pixels(S, (x, y) => {
    const bh = S / 26, bw = S / 9;
    const row = Math.floor(y / bh);
    const ox = row % 2 ? bw / 2 : 0;
    const bx = Math.floor((x + ox) / bw);
    const mx = (x + ox) % bw, my = y % bh;
    const mortar = mx < 2.2 || my < 2.2;
    const t = noise2(bx + 0.5, row + 0.5, 41);
    const n = tfbm(x, y, S, 24, 2, 42) * 26;
    if (mortar) return [212, 204, 188, 0];
    return [clamp(150 + t * 50 + n), clamp(66 + t * 22 + n * 0.5), clamp(48 + t * 14 + n * 0.4), 1];
  }), 4);

  // Dressed stone (ashlar) in big courses. White-ish so vertex colour sets the stone tone. Tile = 4 m.
  const stone = pair("stone", pixels(S, (x, y) => {
    const bh = S / 8, bw = S / 4;
    const row = Math.floor(y / bh);
    const ox = row % 2 ? bw / 2 : 0;
    const bx = Math.floor((x + ox) / bw);
    const mx = (x + ox) % bw, my = y % bh;
    const joint = mx < 1.6 || my < 1.6;
    const t = noise2(bx + 0.5, row + 0.5, 51) * 16;
    const n = tfbm(x, y, S, 12, 4, 52) * 30;
    const v = joint ? 170 : 222 + t + n - 18;
    return [clamp(v), clamp(v - 4), clamp(v - 12), joint ? 0 : 0.8 + n / 150];
  }), 2.5);

  // Plaster / render: soft mottling, near white (vertex colour paints it).
  const plaster = pair("plaster", pixels(S, (x, y) => {
    const n = tfbm(x, y, S, 6, 5, 61);
    const v = 226 + (n - 0.5) * 34;
    return [clamp(v), clamp(v), clamp(v - 2), n];
  }), 1.2);

  // Clay roof tiles (barrel rows). Tile = 2 m. Near white so tint picks terracotta or slate.
  const roofTile = pair("rooftile", pixels(S, (x, y) => {
    const rows = 10, cols = 12;
    const ry = (y / S) * rows, rx = (x / S) * cols + (Math.floor(ry) % 2) * 0.5;
    const fy = ry - Math.floor(ry), fx = rx - Math.floor(rx);
    const barrel = Math.sin(fx * Math.PI);
    const lip = fy < 0.12 ? 0.55 : 1;
    const t = noise2(Math.floor(rx), Math.floor(ry), 71) * 30;
    const n = tfbm(x, y, S, 16, 2, 72) * 20;
    const v = (175 + barrel * 60 + t + n - 20) * lip;
    return [clamp(v), clamp(v), clamp(v), barrel * 0.8 * lip + fy * 0.25];
  }), 3);

  // Corrugated metal: ridges. Tile = 2 m.
  const corrugated = pair("corrugated", pixels(S, (x, y) => {
    const r = Math.sin((x / S) * Math.PI * 2 * 26);
    const n = tfbm(x, y, S, 6, 3, 81);
    const rust = n > 0.62 ? (n - 0.62) * 260 : 0;
    const v = 200 + r * 28;
    return [clamp(v + rust * 0.2), clamp(v - rust * 0.45), clamp(v - rust * 0.8), r * 0.5 + 0.5];
  }), 2.5);

  // Wood planks (timber cladding, benches). Tile = 2 m.
  const wood = pair("wood", pixels(S, (x, y) => {
    const plank = Math.floor((x / S) * 10);
    const edge = (x % (S / 10)) < 2;
    const grain = tn(x * 0.04, y * 0.004 + plank * 3, 40, 91 + plank);
    const t = noise2(plank, 0.5, 92) * 30;
    if (edge) return [70, 48, 30, 0];
    return [clamp(150 + t + grain * 40), clamp(100 + t * 0.7 + grain * 26), clamp(62 + t * 0.4 + grain * 14), 1];
  }), 2);

  // Grass: rich green with blade speckle. Tile = 4 m.
  const grass = pair("grass", pixels(S, (x, y) => {
    const n = tfbm(x, y, S, 6, 4, 101);
    const blade = tn(x * 1.3, y * 0.4, Math.round(S * 1.3), 102);
    const v = n * 0.6 + blade * 0.4;
    return [clamp(92 + v * 44), clamp(116 + v * 48), clamp(66 + v * 22), blade];
  }), 1.5);

  // Laterite: red earth with pebbles and tyre-worn streaks. Tile = 4 m.
  const laterite = pair("laterite", pixels(S, (x, y) => {
    const n = tfbm(x, y, S, 5, 5, 111);
    const peb = tn(x * 0.5, y * 0.5, Math.round(S * 0.5), 112);
    const p = peb > 0.74 ? 1 : 0;
    return [clamp(170 + n * 46 - p * 30), clamp(86 + n * 30 - p * 8), clamp(52 + n * 20), n * 0.7 + p * 0.5];
  }), 2);

  // Bark: vertical streaks.
  const bark = pair("bark", pixels(S / 2, (x, y) => {
    const n = tn(x * 0.06, y * 0.008, Math.round((S / 2) * 0.06), 121);
    const f = tfbm(x, y, S / 2, 8, 3, 122);
    const v = 70 + n * 50 + f * 30;
    return [clamp(v + 8), clamp(v - 6), clamp(v - 22), n];
  }, ), 2.5, S / 2);

  // Foliage: leafy clumps, near white so instance colours tint it.
  const leaves = pair("leaves", pixels(S / 2, (x, y) => {
    const n = tfbm(x, y, S / 2, 16, 3, 131);
    const c = tn(x * 0.35, y * 0.35, Math.round((S / 2) * 0.35), 132);
    const v = 165 + n * 60 + (c > 0.62 ? 30 : c < 0.32 ? -32 : 0);
    return [clamp(v), clamp(v), clamp(v), c];
  }), 2, S / 2);

  // Awning stripes: 8 colourways, one per row (u along the stripes).
  const [ac, actx] = canvas(64, 256);
  const ways: [string, string][] = [["#c8442f", "#f2e9d8"], ["#2a6fb0", "#f4f1e8"], ["#2f8a4c", "#f1ead6"], ["#e0a526", "#fdf6e3"], ["#7a2e3b", "#efe2c9"], ["#1f9bb4", "#fafafa"], ["#d9622b", "#2c3e50"], ["#5b4ba8", "#f5efe0"]];
  ways.forEach(([a, b], i) => {
    for (let s = 0; s < 8; s++) {
      actx.fillStyle = s % 2 ? a : b;
      actx.fillRect(s * 8, i * 32, 8, 32);
    }
  });
  const awning = toTexture(device, ac, true, true, "awning");

  // Painted kerb: alternating black and white blocks along u (1 m each with uvScale 2).
  const kerb = pair("kerb", pixels(64, (x, y) => {
    const white = x < 32;
    const n = tn(x * 0.3, y * 0.3, 19, 141) * 24;
    const v = white ? 226 - n : 38 + n;
    return [clamp(v), clamp(v), clamp(v - 2), 0];
  }), 0, 64);

  return { kerb, asphalt, paver, brickPave, brick, stone, plaster, roofTile, corrugated, wood, grass, laterite, bark, leaves, awning };
}

export type Textures = ReturnType<typeof makeTextures>;

/* ------------------------------------------------------------ sign atlas */

export interface SignAtlas { texture: pc.Texture; uv(name: string): [number, number, number, number] }

/**
 * Shop signs, painted once into one atlas (one draw call for every sign in
 * town). Text comes from data (sign slots, plan rule R4), never baked into
 * model textures.
 */
export function makeSignAtlas(device: pc.GraphicsDevice, names: string[]): SignAtlas {
  const W = 2048, cellW = 512, cellH = 128;
  const perRow = W / cellW;
  const rows = Math.ceil(names.length / perRow);
  const H = 2 ** Math.ceil(Math.log2(Math.max(cellH, rows * cellH)));
  const [c, ctx] = canvas(W, H);
  const rng = makeRng(5);
  const bgs = ["#f4efe4", "#1f4e79", "#b8322a", "#f2c230", "#21614a", "#2b2b2b", "#e8f1f5", "#7a2e3b", "#0f7c8c", "#f6a01a"];
  const map = new Map<string, [number, number, number, number]>();
  names.forEach((name, i) => {
    const x = (i % perRow) * cellW, y = Math.floor(i / perRow) * cellH;
    const bg = bgs[i % bgs.length]!;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cellW, cellH);
    const light = ["#f4efe4", "#f2c230", "#e8f1f5", "#f6a01a"].includes(bg);
    // Painted border and a little hand-painted wobble.
    ctx.strokeStyle = light ? "#2b2b2b" : "#f4efe4";
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 8, y + 8, cellW - 16, cellH - 16);
    ctx.fillStyle = light ? "#1d1d1d" : "#fffaf0";
    const big = name.length > 18 ? 40 : 52;
    ctx.font = `800 ${big}px "Trebuchet MS", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(x + cellW / 2, y + cellH / 2 + 2);
    ctx.rotate(rng.range(-0.012, 0.012));
    ctx.fillText(name.toUpperCase(), 0, 0, cellW - 40);
    ctx.restore();
    // Texture v = 0 is the top row of the canvas: the sign's bottom edge samples (y + cellH) / H.
    map.set(name, [x / W, (y + cellH) / H, (x + cellW) / W, y / H]);
  });
  const texture = toTexture(device, c, true, false, "signs");
  return { texture, uv: (n) => map.get(n) ?? [0, 0, 0.01, 0.01] };
}

/** The clock face (the hands are stuck at 6:06, as the story says). */
export function clockFace(device: pc.GraphicsDevice): pc.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = "#f6f0e0";
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#2c2a26";
  ctx.stroke();
  ctx.fillStyle = "#2c2a26";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100);
    ctx.rotate(a);
    ctx.fillRect(-4, -12, 8, 24);
    ctx.restore();
  }
  const hand = (a: number, l: number, w: number) => {
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(a);
    ctx.fillRect(-w / 2, -l, w, l + 14);
    ctx.restore();
  };
  hand((6 / 12) * Math.PI * 2 + (6 / 60) * (Math.PI / 6), 62, 10); // hour hand at just past 6
  hand((6 / 60) * Math.PI * 2, 96, 6); // minute hand at 6 minutes
  ctx.beginPath();
  ctx.arc(128, 128, 9, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(device, c, true, false, "clock");
}

/** Soft round sprite (glows, smoke, dust). */
export function softDot(device: pc.GraphicsDevice): pc.Texture {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(device, c, true, false, "dot");
}

