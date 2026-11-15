/* cartoon.js: procedural cartoon character generator for Babylon.js 7 (spike).
   CC.build(scene, look, outfitIndex) -> { root, meshes, update(t) }
   look = parsed look-sheet JSON (see jiya.json / taty.json). Internal units: total height = 1, then the root is scaled to look.height metres.
   The character faces -Z, +Y up. Everything is built from parametric surfaces (lofts, tubes, deformed spheres). */
'use strict';
(function () {
const V = BABYLON.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2)); };  // -> linear
const mix = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));
const C3 = c => new BABYLON.Color3(c[0], c[1], c[2]);
let SEED = 7; const rnd = () => (SEED = (SEED * 16807) % 2147483647) / 2147483647;

/* ---------------- geometry accumulator ---------------- */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  mesh(name, scene, mat) {
    if (!this.i.length) return null;
    const m = new BABYLON.Mesh(name, scene), vd = new BABYLON.VertexData();
    vd.positions = this.p; vd.normals = this.n; vd.uvs = this.uv; vd.colors = this.c; vd.indices = this.i; vd.applyToMesh(m); m.material = mat; return m;
  }
}
/* parametric surface: P(u,v) -> [x,y,z]. o: closed (u wraps), center ([x,y,z] outward reference) or inward, col(u,v,p) -> rgb, us/vs uv scale */
function surf(g, nu, nv, P, o = {}) {
  const W = nu + 1, pts = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(P(i / nu, j / nv));
  const N = pts.map(() => [0, 0, 0]);
  const k = (i, j) => (o.closed && i === nu ? 0 : i) + j * W;
  const add = (a, b, c) => {
    const A = pts[a], B = pts[b], Cc = pts[c];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    [a, b, c].forEach(x => { N[x][0] += n[0]; N[x][1] += n[1]; N[x][2] += n[2]; });
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = k(i, j), b = k(i + 1, j), c = k(i + 1, j + 1), d = k(i, j + 1); add(a, b, c); add(a, c, d); }
  if (o.closed) for (let j = 0; j <= nv; j++) N[nu + j * W] = N[j * W];
  for (let j = 0; j <= nv; j++) {  // poles: average a degenerate row
    let mx = 0; const p0 = pts[j * W]; for (let i = 1; i <= nu; i++) { const p = pts[i + j * W]; mx = Math.max(mx, Math.abs(p[0] - p0[0]) + Math.abs(p[1] - p0[1]) + Math.abs(p[2] - p0[2])); }
    if (mx < 1e-7) { const s = [0, 0, 0]; for (let i = 0; i < nu; i++) { const n = N[i + j * W]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; } for (let i = 0; i <= nu; i++) N[i + j * W] = s.slice(); }
  }
  let ctr = o.center; if (!ctr) { ctr = [0, 0, 0]; pts.forEach(p => { ctr[0] += p[0]; ctr[1] += p[1]; ctr[2] += p[2]; }); ctr = ctr.map(x => x / pts.length); }
  let s = 0; pts.forEach((p, i) => { s += N[i][0] * (p[0] - ctr[0]) + N[i][1] * (p[1] - ctr[1]) + N[i][2] * (p[2] - ctr[2]); });
  const flip = (s < 0) !== !!o.inward ? -1 : 1;
  const base = g.p.length / 3;
  pts.forEach((p, idx) => {
    const n = N[idx], l = Math.hypot(n[0], n[1], n[2]) || 1, i = idx % W, j = (idx - i) / W, u = i / nu, v = j / nv;
    g.p.push(p[0], p[1], p[2]); { let q = [flip * n[0] / l, flip * n[1] / l, flip * n[2] / l]; if (o.nrm) q = o.nrm(p, q); g.n.push(q[0], q[1], q[2]); }
    g.uv.push(u * (o.us || 1), v * (o.vs || 1));
    const c = o.col ? o.col(u, v, p) : (o.color || [1, 1, 1]); g.c.push(c[0], c[1], c[2], 1);
  });
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + i + j * W, b = a + 1, c = a + 1 + W, d = a + W; g.i.push(a, b, c, a, c, d); }
  return pts;
}
/* ellipsoid */
function ell(g, c, r, o = {}, nu = 20, nv = 14) {
  const ax = o.ax || [1, 0, 0], ay = o.ay || [0, 1, 0], az = o.az || [0, 0, 1];
  return surf(g, nu, nv, (u, v) => { const th = u * 2 * Math.PI, ph = v * Math.PI, x = Math.sin(ph) * Math.cos(th) * r[0], y = Math.cos(ph) * r[1], z = Math.sin(ph) * Math.sin(th) * r[2];
    return [c[0] + ax[0] * x + ay[0] * y + az[0] * z, c[1] + ax[1] * x + ay[1] * y + az[1] * z, c[2] + ax[2] * x + ay[2] * y + az[2] * z]; }, Object.assign({ closed: true, center: c }, o));
}
/* monotone cubic interpolation over keys [[x, a, b, ...]] */
function mono(keys) {
  keys = keys.slice().sort((a, b) => a[0] - b[0]);
  const n = keys.length, m = keys[0].length - 1, xs = keys.map(k => k[0]), T = [];
  for (let c = 1; c <= m; c++) {
    const d = [], t = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][c] - keys[i][c]) / (xs[i + 1] - xs[i]));
    t[0] = d[0]; t[n - 1] = d[n - 2]; for (let i = 1; i < n - 1; i++) t[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { t[i] = t[i + 1] = 0; } else { const a = t[i] / d[i], b = t[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const s = 3 / Math.sqrt(h); t[i] = s * a * d[i]; t[i + 1] = s * b * d[i]; } } }
    T.push(t);
  }
  return x => {
    x = clamp(x, xs[0], xs[n - 1]); let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const out = []; for (let c = 1; c <= m; c++) out.push(h00 * keys[i][c] + h10 * h * T[c - 1][i] + h01 * keys[i + 1][c] + h11 * h * T[c - 1][i + 1]); return out;
  };
}
/* smooth curve through points (Catmull-Rom, arc-length parameterised) */
function curve(pts) {
  pts = pts.map(p => Array.isArray(p) ? new V(p[0], p[1], p[2]) : p);
  const n = pts.length;
  const seg = (i, t) => { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n - 1, i + 1)], p3 = pts[Math.min(n - 1, i + 2)], t2 = t * t, t3 = t2 * t;
    return p1.scale(2).add(p2.subtract(p0).scale(t)).add(p0.scale(2).subtract(p1.scale(5)).add(p2.scale(4)).subtract(p3).scale(t2)).add(p1.scale(3).subtract(p0).subtract(p2.scale(3)).add(p3).scale(t3)).scale(0.5); };
  const S = [0], P = [pts[0]], K = Math.max(8, (n - 1) * 8); let L = 0;
  for (let q = 1; q <= K; q++) { const gg = q / K * (n - 1), i = Math.min(n - 2, Math.floor(gg)), p = seg(i, gg - i); L += V.Distance(p, P[P.length - 1]); S.push(L); P.push(p); }
  const f = t => { const s = clamp(t, 0, 1) * L; let lo = 0, hi = K; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (S[md] < s) lo = md; else hi = md; } const w = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0; return V.Lerp(P[lo], P[hi], w); };
  f.L = L; f.tan = t => { const e = 2e-3; return f(Math.min(1, t + e)).subtract(f(Math.max(0, t - e))).normalize(); };
  return f;
}
/* tube along curve f with elliptical sections. R(t) -> {rx, rz, rzb?}; ref(t,p,T) -> V3 depth axis hint (default +Z). */
function tube(g, f, nu, nv, R, o = {}) {
  const rings = [];
  for (let j = 0; j <= nv; j++) {
    const t = (o.t0 || 0) + ((o.t1 == null ? 1 : o.t1) - (o.t0 || 0)) * j / nv, p = f(t), T = f.tan(t);
    let az = o.ref ? o.ref(t, p, T) : new V(0, 0, 1); az = az.subtract(T.scale(V.Dot(az, T))); if (az.lengthSquared() < 1e-9) az = new V(1, 0, 0); az.normalize();
    const ax = V.Cross(az, T).normalize(), r = R(t, p);
    rings.push({ p, ax, az, r, t });
  }
  return surf(g, nu, nv, (u, v) => {
    const rg = rings[Math.round(v * nv)], th = u * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th), r = rg.r;
    const k = r.f ? r.f(th) : 1, dz = (s < 0 ? s * r.rz : s * (r.rzb == null ? r.rz : r.rzb)) * k, dx = c * r.rx * k;
    return [rg.p.x + rg.ax.x * dx + rg.az.x * dz, rg.p.y + rg.ax.y * dx + rg.az.y * dz, rg.p.z + rg.ax.z * dx + rg.az.z * dz];
  }, Object.assign({ closed: true, center: o.center || null }, o, { col: o.col ? (u, v, p) => o.col(u, rings[Math.round(v * nv)].t, p) : null }));
}
/* round-capped radius envelope */
const capEnv = (t, a, b) => Math.sqrt(Math.max(0, Math.min(1, t / a) * (2 - Math.min(1, t / a)))) * Math.sqrt(Math.max(0, Math.min(1, (1 - t) / b) * (2 - Math.min(1, (1 - t) / b))));

/* ---------------- textures ---------------- */
function canvasTex(scene, name, w, h, draw) {
  const dt = new BABYLON.DynamicTexture(name, { width: w, height: h }, scene, true);
  const ctx = dt.getContext(); draw(ctx, w, h); dt.update(false); dt.wrapU = dt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return dt;
}
function eyeTex(scene, look, slit) {
  const F = look.face, ir = hex(F.iris), ii = hex(F.irisIn || F.iris);
  return canvasTex(scene, 'eye', 256, 256, (ctx, w, h) => {
    const im = ctx.createImageData(w, h), ai = F.irisA || 0.72, ap = F.pupilA || 0.3;
    const hl = norm([0.42, 0.55, 0.72]), hl2 = norm([-0.3, -0.35, 0.89]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, ph = v * Math.PI, th = u * 2 * Math.PI, d = [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)];
      let c;
      const pupil = slit ? (Math.abs(d[0]) < 0.09 * Math.sqrt(Math.max(0, 1 - (d[1] / Math.sin(ai)) ** 2)) && ph < ai) : ph < ap;
      if (pupil) c = [0.02, 0.015, 0.012];
      else if (ph < ai) {
        const t = (ph - ap) / (ai - ap), streak = 0.85 + 0.3 * (Math.sin(th * 23) * 0.5 + Math.sin(th * 41 + 1) * 0.3);
        c = mix(ii, ir, sst(0.0, 0.7, t)).map(z => z * streak);
        c = mix(c, [0.01, 0.008, 0.006], sst(0.75, 1.0, t) * 0.85);
        c = c.map(z => z * (1 - 0.35 * Math.max(0, d[1])));   // upper iris shadowed by the lid
      } else { const e = sst(ai, 1.9, ph); c = mix([0.93, 0.9, 0.88], [0.62, 0.55, 0.55], e * 0.7); c = c.map(z => z * (1 - 0.3 * Math.max(0, d[1]) * sst(ai, 1.4, ph))); }
      const s1 = d[0] * hl[0] + d[1] * hl[1] + d[2] * hl[2], s2 = d[0] * hl2[0] + d[1] * hl2[1] + d[2] * hl2[2];
      if (s1 > 0.985) c = [1.4, 1.4, 1.4]; else if (s2 > 0.995) c = mix(c, [1, 1, 1], 0.8);
      const o = 4 * (y * w + x); im.data[o] = 255 * Math.pow(Math.min(1, c[0]), 1 / 2.2); im.data[o + 1] = 255 * Math.pow(Math.min(1, c[1]), 1 / 2.2); im.data[o + 2] = 255 * Math.pow(Math.min(1, c[2]), 1 / 2.2); im.data[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  });
}
function norm(a) { const l = Math.hypot(...a); return a.map(x => x / l); }
function streakTex(scene) {
  return canvasTex(scene, 'hairStreak', 256, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x++) { const b = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(x * 0.9) * Math.sin(x * 0.23 + 2)) * (0.7 + 0.3 * rnd()); const g = Math.round(255 * b); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x, 0, 1, h); }
  });
}
function patternTex(scene, pat) {
  if (pat.type === 'floral') return canvasTex(scene, 'floral', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = pat.bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h, r = 7 + rnd() * 9, cols = pat.cols;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const X = x + dx * w, Y = y + dy * h;
        ctx.fillStyle = pat.leaf; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(X + (k ? r : -r) * 1.1, Y + r * 0.6, r * 0.55, r * 0.22, k ? 0.6 : -0.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = cols[i % cols.length]; for (let k = 0; k < 5; k++) { const a = k * 1.2566 + i; ctx.beginPath(); ctx.arc(X + Math.cos(a) * r * 0.55, Y + Math.sin(a) * r * 0.55, r * 0.45, 0, 7); ctx.fill(); }
        ctx.fillStyle = pat.centre; ctx.beginPath(); ctx.arc(X, Y, r * 0.25, 0, 7); ctx.fill(); }
    }
  });
  if (pat.type === 'denim') return canvasTex(scene, 'denim', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = pat.bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,30,0.08)'; ctx.fillRect(rnd() * w, rnd() * h, 1, 3); }
  });
  if (pat.type === 'jersey') return canvasTex(scene, 'jersey', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = pat.bg; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(x, 0, 4, h); }
  });
  if (pat.type === 'cattee') return canvasTex(scene, 'cattee', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = pat.bg; ctx.fillRect(0, 0, w, h);
  });
  return null;
}

/* ---------------- body ---------------- */
function bodyModel(look) {
  const b = Object.assign({ slim: 0.5, curvy: 0.3, fat: 0, muscle: 0 }, look.body);
  const s = 1 - 0.25 * b.slim, c = b.curvy, f = b.fat, m = b.muscle;
  const B = {};
  B.neckR = 0.0225 * (1 + 0.15 * f);
  B.sh = (0.1 + 0.006 * m + 0.004 * f) * (1 - 0.08 * b.slim);
  // torso keys: y, rx, rz front, rz back, centre z
  B.keys = [
    [0.438, 0.035, 0.03, 0.03, 0.0],
    [0.455, 0.066 * s + 0.01 * c, 0.046, 0.05 + 0.01 * c, 0.002],
    [0.50, (0.078 + 0.014 * c + 0.012 * f) * s, 0.047 + 0.006 * f, (0.058 + 0.016 * c + 0.008 * f) * s, 0.004],
    [0.545, (0.064 + 0.004 * c + 0.012 * f) * s, 0.044 + 0.01 * f, 0.044 + 0.006 * c, 0.002],
    [0.585, (0.052 - 0.003 * c + 0.016 * f) * s, 0.04 + 0.014 * f, 0.036, 0.003],
    [0.632, (0.062 + 0.005 * c + 0.01 * f) * s, 0.048 + 0.012 * c, 0.04, 0.0],
    [0.668, (0.07 + 0.008 * c + 0.008 * f + 0.004 * m) * s, (0.056 + 0.016 * c + 0.008 * f) * (0.9 + 0.1 * s), 0.044, -0.002],
    [0.705, (0.078 + 0.004 * m) * s, 0.046 + 0.006 * c, 0.044, 0.0],
    [0.735, B.sh * 0.95, 0.036, 0.04, 0.004],
    [0.752, B.sh * 0.70, 0.028, 0.032, 0.006],
    [0.762, B.neckR * 1.9, 0.024, 0.026, 0.008],
    [0.772, B.neckR * 1.05, B.neckR, B.neckR, 0.01],
  ];
  B.prof = mono(B.keys);
  B.legX = y => lerp(0.04, 0.047 + 0.006 * c, sst(0.04, 0.47, y));
  B.legZ = y => 0.0;
  B.legR = mono([[0.04, 0.016], [0.08, 0.019], [0.17, 0.03 + 0.003 * m + 0.002 * f], [0.27, 0.026], [0.31, 0.03], [0.4, (0.04 + 0.006 * c + 0.01 * f) * s + 0.006], [0.47, (0.05 + 0.008 * c + 0.01 * f) * s]]);
  B.legRz = y => B.legR(y)[0] * (y > 0.12 && y < 0.25 ? 1.05 : 1);
  const ax = B.sh - 0.01;
  const ao = 0.004 + 0.012 * c; B.arm = curve([[ax - 0.012, 0.742, 0.006], [ax + 0.006, 0.708, 0.008], [ax + 0.014 + ao * 0.4, 0.66, 0.012], [ax + 0.02 + ao * 0.8, 0.585, 0.016], [ax + 0.022 + ao, 0.52, 0.004], [ax + 0.022 + ao, 0.462, -0.008]]);
  B.armR = mono([[0, 0.03], [0.08, 0.028], [0.22, (0.024 + 0.005 * f + 0.003 * m) * s + 0.004], [0.45, 0.019], [0.6, 0.021 + 0.002 * f], [0.92, 0.0145], [1, 0.014]]);
  B.c = c; B.s = s; B.f = f; return B;
}
// a point on the body (or a garment over it) at height y, angle th, with offset
function torsoPt(B, y, th, off, ex) {
  const [rx, rzf, rzb, cz] = B.prof(y), c = Math.cos(th), s = Math.sin(th);
  let RX = rx + off, RZF = rzf + off, RZB = rzb + off;
  if (ex) { const w = ex.w == null ? 1 : ex.w; RX = Math.max(RX, lerp(RX, ex.rx || 0, w)) + (ex.add || 0); RZF = Math.max(RZF, lerp(RZF, ex.rz || 0, w)) + (ex.add || 0) * 0.9; RZB = Math.max(RZB, lerp(RZB, ex.rz || 0, w)) + (ex.add || 0) * 1.05; }
  return [c * RX, y, cz + (s < 0 ? s * RZF : s * RZB)];
}

/* ---------------- head + face ---------------- */
function headModel(look) {
  const F = Object.assign({ w: 0.064, top: 0.08, chin: 0.1, d: 0.072, jaw: 0.6, chinFwd: 0.9, cheek: 0.3, skull: 0.5, flat: 0.25 }, look.face);
  const H = { F, c: [0, 1 - F.top, 0.004] };
  H.P = n => {
    let [x, y, z] = n; let px = x * F.w, py = y * (y > 0 ? F.top : F.chin), pz = z * F.d;
    if (y < 0) { const t = -y; px *= 1 - (1 - F.jaw) * Math.pow(t, F.jawPow || 2.2); py *= 1 - (F.chinFlat == null ? 0.14 : F.chinFlat) * Math.pow(t, 4); if (z > 0) pz *= 1 - 0.5 * t; else pz *= 1 - (1 - F.chinFwd) * t * 0.6; }
    if (z > 0 && y > -0.3) pz *= 1 + 0.1 * F.skull * (1 - Math.abs(y));
    if (z < 0) pz *= 1 - F.flat * Math.max(0, 1 - Math.abs(y) * 1.4) * Math.max(0, 1 - Math.abs(x) * 1.3);
    const ck = Math.exp(-((Math.abs(x) - 0.58) ** 2 / 0.04 + (y + 0.3) ** 2 / 0.05)) * F.cheek * (z < 0 ? 1 : 0);
    px += Math.sign(x) * ck * F.w * 0.12; pz -= ck * F.d * 0.08;
    return [px, py, pz];
  };
  // surface point + normal for a face-front position (x,y in head-local units)
  H.face = (x, y, out = 0) => {
    let qx = x / F.w, qy = y / (y > 0 ? F.top : F.chin), n, p;
    for (let it = 0; it < 8; it++) {
      n = norm([qx, qy, -Math.sqrt(Math.max(0.02, 1 - qx * qx - qy * qy))]); p = H.P(n);
      qx += (x - p[0]) / F.w; qy += (y - p[1]) / (y > 0 ? F.top : F.chin);
    }
    const e = 0.01, a = H.P(norm([n[0] + e, n[1], n[2]])), b = H.P(norm([n[0], n[1] + e, n[2]]));
    const t1 = [a[0] - p[0], a[1] - p[1], a[2] - p[2]], t2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
    let nn = norm([t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]]); if (nn[2] > 0) nn = nn.map(z => -z);
    return { p: [p[0] + nn[0] * out + H.c[0], p[1] + nn[1] * out + H.c[1], p[2] + nn[2] * out + H.c[2]], n: nn };
  };
  H.world = n => { const p = H.P(n); return [p[0] + H.c[0], p[1] + H.c[1], p[2] + H.c[2]]; };
  return H;
}

function buildFace(G, H, look, scene) {
  const F = H.F, skin = hex(look.skin);
  const blush = hex(look.blushCol || '#e07a7a');
  // head
  surf(G.skin, 64, 48, (u, v) => { const th = u * 2 * Math.PI, ph = v * Math.PI; return H.world([Math.sin(ph) * Math.sin(th), Math.cos(ph), -Math.sin(ph) * Math.cos(th)]); },
    { closed: true, center: H.c, col: (u, v, p) => { const x = (p[0] - H.c[0]) / F.w, y = (p[1] - H.c[1]) / F.chin, front = p[2] < H.c[2] ? 1 : 0;
      const bl = front * Math.exp(-((Math.abs(x) - 0.55) ** 2 / 0.05 + (y + 0.32) ** 2 / 0.03)) * (look.blush || 0.3);
      return mix([1, 1, 1], blush.map((b, i) => b / skin[i]).map(z => Math.min(1.2, z)), bl); } });
  // ears
  if (!F.noEars)  [-1, 1].forEach(sd => ell(G.skin, [sd * F.w * 0.96 + H.c[0], H.c[1] - F.chin * 0.12, H.c[2] + 0.004], [0.011, 0.022, 0.016], { ax: [Math.cos(0.3), 0, sd * Math.sin(0.3)], az: [-sd * Math.sin(0.3), 0, Math.cos(0.3)] }));
  // neck
  const BB = G.B, czAt = y => BB.prof(Math.min(y, 0.771))[3];
  const nk = curve([[0, H.c[1] - 0.02, 0.012], [0, 0.79, 0.01], [0, 0.768, czAt(0.768)], [0, 0.74, czAt(0.74)], [0, 0.712, czAt(0.712)]]);
  tube(G.skin, nk, 48, 40, (t, p) => { const b = BB.prof(Math.min(p.y, 0.771)), w = sst(0.786, 0.768, p.y), e = 0.0012;
    return { rx: lerp(BB.neckR, b[0] + e, w), rz: lerp(BB.neckR * 1.05, b[1] + e, w), rzb: lerp(BB.neckR * 1.05, b[2] + e, w) }; },
    { nrm: (p, q) => { const w = sst(0.79, 0.772, p[1]); if (w <= 0) return q; const h = norm([q[0], 0, q[2]]); return norm([lerp(q[0], h[0], w), lerp(q[1], 0, w), lerp(q[2], h[2], w)]); } });
  // eyes
  const ex = F.eyeX * F.w, ey = F.eyeY * F.chin, er = F.eyeR, eh = F.eyeH || 1.05;
  const eyes = [];
  [-1, 1].forEach(sd => {
    const s = H.face(sd * ex, ey, 0);
    const f0 = norm([s.n[0] * 0.35, s.n[1] * 0.2, -1]);
    const c = [s.p[0] - s.n[0] * er * (F.eyeSink || 0.5), s.p[1] - s.n[1] * er * 0.5, s.p[2] - s.n[2] * er * (F.eyeSink || 0.5)];
    const f = f0, rt = norm([-f[2], 0, f[0]]), up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
    const U = up[1] < 0 ? up.map(z => -z) : up, R = [f[1] * U[2] - f[2] * U[1], f[2] * U[0] - f[0] * U[2], f[0] * U[1] - f[1] * U[0]];
    const Rt = R[0] * sd < 0 && false ? R.map(z => -z) : R;
    const E = (dr, du, df, rad) => [c[0] + (Rt[0] * dr + U[0] * du * eh + f[0] * df) * rad, c[1] + (Rt[1] * dr + U[1] * du * eh + f[1] * df) * rad, c[2] + (Rt[2] * dr + U[2] * du * eh + f[2] * df) * rad];
    surf(G.eye, 32, 24, (u, v) => { const ph = v * Math.PI, th = u * 2 * Math.PI; return E(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph), er); }, { closed: true, center: c });
    eyes.push({ c, E, sd });
    // lids (skin), outer side = sd * Rt
    const so = s1 => s1 * sd * Math.sign(Rt[0] || 1);
    const pm = F.eyePm || 1.4, lu = F.lidUp, ll = F.lidLo, tilt = F.tilt || 0;
    const eUp = s1 => lu * (0.12 + 0.88 * Math.pow(Math.max(0, 1 - s1 * s1), 0.6)) + tilt * so(s1);
    const eLo = s1 => -ll * (0.08 + 0.92 * Math.pow(Math.max(0, 1 - s1 * s1), 0.75)) + tilt * 0.6 * so(s1);
    const lidN = (p, q) => norm([lerp(q[0], s.n[0], 0.65), lerp(q[1], s.n[1], 0.65), lerp(q[2], s.n[2], 0.65)]);
    const lidP = (s1, th, rr) => { const ph = s1 * pm; return E(Math.sin(ph) * Math.cos(th), Math.sin(th), Math.cos(ph) * Math.cos(th), er * rr); };
    const shadow = hex(F.shadow || look.skin), sk = hex(look.skin);
    surf(G.skin, 24, 8, (u, v) => { const s1 = u * 2 - 1; return lidP(s1, lerp(eUp(s1), 1.45, v), 1.05 + 0.02 * v); }, { center: c, nrm: lidN, col: (u, v) => mix(shadow.map((x, i) => x / sk[i]), [1, 1, 1], sst(0, 0.35, v)) });
    surf(G.skin, 24, 6, (u, v) => { const s1 = u * 2 - 1; return lidP(s1, lerp(eLo(s1), -1.4, v), 1.06 + 0.02 * v); }, { center: c, nrm: lidN });
    // lash line along the upper lid + optional wing
    const lp = []; for (let i = 0; i <= 14; i++) { const s1 = -1 + 2 * i / 14; lp.push(lidP(s1 * 0.97, eUp(s1 * 0.97) + 0.04, 1.09)); }
    const outerEnd = so(1) > 0 ? lp[lp.length - 1] : lp[0];
    if (F.wing) { const w = E(0, 0, 0, 0); const dirOut = [outerEnd[0] - c[0], outerEnd[1] - c[1], outerEnd[2] - c[2]]; const wp = [outerEnd[0] + dirOut[0] * 0.35 * F.wing, outerEnd[1] + er * 0.4 * F.wing, outerEnd[2] + dirOut[2] * 0.2]; if (so(1) > 0) lp.push(wp); else lp.unshift(wp); }
    const lc = curve(lp);
    tube(G.lash, lc, 8, 30, t => { const o = so(t * 2 - 1) > 0 ? t : 1 - t; const th = F.lash * (0.45 + 0.9 * sst(0.1, 0.85, o)) * (1 - sst(0.93, 1, o) * 0.8); return { rx: th * 0.6, rz: th }; },
      { ref: (t, p) => new V(p.x - c[0], p.y - c[1], p.z - c[2]) });
    if (F.lowerLash) { const lq = []; for (let i = 0; i <= 10; i++) { const s1 = -0.85 + 1.7 * i / 10; lq.push(lidP(s1, eLo(s1) - 0.02, 1.08)); } tube(G.lash, curve(lq), 6, 16, t => { const o = so(t * 2 - 1) > 0 ? t : 1 - t; const th = F.lowerLash * sst(0.2, 0.9, o) * (1 - sst(0.95, 1, o)) + 0.0003; return { rx: th * 0.6, rz: th }; }, { ref: (t, p) => new V(p.x - c[0], p.y - c[1], p.z - c[2]) }); }
    { const od = sd * Math.sign(Rt[0] || 1), nl = F.lashes == null ? 4 : F.lashes, LL = er * (F.lashLen || 0.3);
      for (let i = 0; i < nl; i++) { const o = lerp(0.3, 0.95, nl > 1 ? i / (nl - 1) : 1), s1 = od * o * 0.97, b = lidP(s1, eUp(s1) + 0.05, 1.09), k = (0.6 + 0.4 * o) * LL;
        const dv = (a, bb, cc) => [b[0] + (f[0] * a + U[0] * bb + Rt[0] * od * cc) * k, b[1] + (f[1] * a + U[1] * bb + Rt[1] * od * cc) * k, b[2] + (f[2] * a + U[2] * bb + Rt[2] * od * cc) * k];
        tube(G.lash, curve([b, dv(0.35, 0.2, 0.15 * o), dv(0.5, 0.7, 0.55 * o)]), 6, 8, t => { const r = F.lash * 0.5 * (1 - 0.9 * t); return { rx: r, rz: r }; }); }
      if (F.crease !== 0) { const cq = []; for (let i = 0; i <= 12; i++) { const s1 = od * (-0.7 + 1.5 * i / 12); cq.push(lidP(s1, eUp(s1) + (F.crease || 0.3), 1.078)); }
        tube(G.crease, curve(cq), 6, 20, t => { const r = 0.0002 + 0.0006 * Math.sin(Math.PI * t); return { rx: r, rz: r }; }); } }
    // brow
    const Bw = F.brow, bp = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = sd * (ex - er * 1.05 + t * er * (2.3 * (Bw.len || 1))), y = ey + er * (Bw.y || 1.5) + er * (Bw.arch || 0.3) * Math.sin(Math.PI * Math.pow(t, Bw.peak || 0.75)) + (Bw.tail || 0) * er * t * t + (Bw.tilt || 0) * er * (t - 0.5);
      bp.push(H.face(x, y, 0.0015).p); }
    tube(G.brow, curve(bp), 8, 24, t => { const w = (Bw.w || 0.005) * (1 - 0.72 * Math.pow(t, 1.4)) * Math.min(1, 0.55 + t * 4); return { rx: w, rz: 0.0016 }; },
      { ref: (t, p) => new V(p.x - H.c[0], p.y - H.c[1] - 0.02, p.z - H.c[2] + 0.05) });
  });
  // nose
  const N = F.nose || {}, ny = (N.y || -0.33) * F.chin, ns = N.size || 1;
  { const yT = F.eyeY * F.chin + 0.006, yB = ny - 0.011 * ns, hw = 0.017 * ns, g2 = (a, s) => Math.exp(-a * a / (s * s));
    const bump = (x, y) => { const up = clamp((y - ny) / (yT - ny), 0, 1), ax = Math.abs(x);
      const tipB = 0.0062 * g2(x, 0.0062 * ns) * (y > ny ? g2(y - ny, 0.0075 * ns) : g2(y - ny, 0.0042 * ns));
      const bridge = (y > ny ? lerp(0.0034, 0.001, Math.sqrt(up)) : 0.0034 * g2(y - ny, 0.003 * ns)) * g2(x, lerp(0.0048, 0.0036, up) * ns);
      const ala = 0.0034 * g2(ax - 0.0074 * ns, 0.0036 * ns) * g2(y - (ny - 0.0015), 0.0036 * ns);
      return (tipB + bridge + ala) * (1 - sst(0.7, 1, ax / hw)) * sst(yB, yB + 0.003, y) * (1 - sst(yT - 0.006, yT, y)); };
    surf(G.skin, 30, 44, (u, v) => { const x = (u * 2 - 1) * hw, y = lerp(yB, yT, v); return H.face(x, y, 0.0002 + ns * bump(x, y)).p; },
      { center: H.c, col: (u, v, p) => { const sh = g2(p[0], 0.007 * ns) * g2(p[1] - H.c[1] - (ny - 0.0062 * ns), 0.0026 * ns); return [1 - 0.2 * sh, 1 - 0.3 * sh, 1 - 0.3 * sh]; } }); }
  // mouth
  const M = F.mouth, my = M.y * F.chin, mw = M.w, sm = M.smile || 0, op = M.open || 0, lipC = hex(M.lip);
  const yUp = x => my + sm * 0.0045 * Math.pow(Math.abs(x) / mw, 2) + 0.0012 * Math.cos(Math.PI * x / mw * 0.5);
  const yLo = x => yUp(x) - op * 0.0085 * (1 - Math.pow(Math.abs(x) / mw, 2)) * (1 - 0.15 * sm);
  if (op > 0.02) {
    const inner = (x, t) => { const yy = lerp(yUp(x) - 0.0008, yLo(x) + 0.0008, t); const q = H.face(x * 0.98, yy, 0.0003); return q.p; };
    surf(G.mouth, 20, 6, (u, v) => inner((u * 2 - 1) * mw * 0.97, v), { center: [0, my, 1] , col: (u, v) => [1, 1, 1] });
    surf(G.teeth, 20, 3, (u, v) => { const x = (u * 2 - 1) * mw * 0.82; const yy = lerp(yUp(x) - 0.0006, yUp(x) - Math.min(0.0045, (yUp(x) - yLo(x)) * 0.55), v); return H.face(x, yy, 0.0006).p; }, { center: [0, my, 1] });
  }
  const full = M.full || 1;
  const lipCurve = (fy, k) => { const pts = []; for (let i = 0; i <= 16; i++) { const x = (i / 16 * 2 - 1) * mw; pts.push(H.face(x, fy(x) + k(x), 0.0006).p); } return curve(pts); };
  tube(G.lip, lipCurve(yUp, x => 0.0016 * full * (1 - Math.pow(Math.abs(x) / mw, 2))), 10, 24, t => { const e = Math.sin(Math.PI * t); return { rx: (0.0006 + 0.0019 * full * Math.pow(e, 0.7)) , rz: 0.0012 + 0.0016 * e * full }; }, { ref: () => new V(0, 0, -1) });
  tube(G.lip, lipCurve(yLo, x => -0.0022 * full * (1 - Math.pow(Math.abs(x) / mw, 2))), 10, 24, t => { const e = Math.sin(Math.PI * t); return { rx: (0.0006 + 0.0026 * full * Math.pow(e, 0.8)), rz: 0.0012 + 0.0022 * e * full }; }, { ref: () => new V(0, 0, -1) });
  return eyes;
}

/* ---------------- hair ---------------- */
function buildHair(G, H, B, look) {
  const S = look.hair, F = H.F, C = H.c;
  if (S.none) return;
  const root = hex(S.root), tipc = hex(S.tip || S.root);
  const dirOf = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const rad = d => { const p = H.P(d); return Math.hypot(p[0], p[1], p[2]); };
  const slerp = (a, b, t) => { const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), w = Math.acos(d); if (w < 1e-4) return a.slice(); const s = Math.sin(w), k0 = Math.sin((1 - t) * w) / s, k1 = Math.sin(t * w) / s; return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1]; };
  const D = Math.PI / 180;
  const hl = az => { const a = Math.abs(az) / D; return D * (a < 40 ? lerp(S.hairline || 34, 26, a / 40) : a < 75 ? lerp(26, 8, (a - 40) / 35) : a < 100 ? lerp(8, -14, (a - 75) / 25) : lerp(-14, -48, (a - 100) / 80)); };
  const partAz = (S.part || 0) * D;
  const partDir = s => { const beta = lerp((S.hairline || 34) * D + 2 * D, 222 * D, s); const d = [0, Math.sin(beta), -Math.cos(beta)]; const k = 1 - sst(0, 0.55, s); d[0] = Math.sin(partAz) * k * Math.max(0, Math.cos(beta)) * 1.2; return norm(d); };
  const bound = (s, sd) => { const az = sd * lerp(S.temple || 52, 180, Math.pow(s, 0.9)) * D; return dirOf(az, hl(az)); };
  const capOff = S.cap || 0.006, vol = S.volume || 0;
  const offAt = (d, t) => capOff + vol * 0.012 * sst(0.0, 0.6, d[1] + 0.3) * (0.5 + 0.5 * t) + (d[2] > 0 ? vol * 0.006 : 0);
  const capPt = (s, t, sd, extra = 0) => { const d = slerp(partDir(s), bound(s, sd), t), r = rad(d) + offAt(d, t) + extra, p = H.P(d), l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l * r + C[0], p[1] / l * r + C[1], p[2] / l * r + C[2]]; };
  const capC = root.map(x => Math.min(1, x * (S.capTone || 1))), gcol = (u, v) => capC;
  [-1, 1].forEach(sd => surf(G.scalp, 30, 18, (u, v) => capPt(u, lerp(-(S.capOverlap || 0), 1, v), sd), { center: C, col: gcol, us: 6, vs: 1 }));
  // continuous scalp dome under both cap halves: no see-through at the parting; parting = soft colour line
  { const skinC = hex(look.skin), pd = []; for (let i = 0; i <= 40; i++) pd.push(partDir(i / 40 * 0.6));
    const pw = (S.partWidth || 1.3) * D, pmix = S.partTone == null ? 0.28 : S.partTone;
    surf(G.scalp, 72, 30, (u, v) => { const az = (u * 2 - 1) * Math.PI, el = lerp(89.6 * D, hl(az) + 1.0 * D, v), d = dirOf(az, el), r = rad(d) + capOff * 0.5, p = H.P(d), l = Math.hypot(p[0], p[1], p[2]);
      return [p[0] / l * r + C[0], p[1] / l * r + C[1], p[2] / l * r + C[2]]; },
      { closed: true, center: C, us: 6, vs: 1, col: (u, v, p) => { const d = norm([p[0] - C[0], p[1] - C[1], p[2] - C[2]]); let m = 1; pd.forEach(q => { m = Math.min(m, Math.acos(clamp(d[0] * q[0] + d[1] * q[1] + d[2] * q[2], -1, 1))); });
        const k = pmix * (1 - sst(0, pw, m)); return capC.map((x, i) => x + (skinC[i] * 0.8 - x) * k); } }); }
  // collision bodies
  const collide = p => {
    // head
    const d = norm([p.x - C[0], p.y - C[1], p.z - C[2]]), r = rad(d) + capOff + 0.004, l = Math.hypot(p.x - C[0], p.y - C[1], p.z - C[2]);
    if (l < r) { p.x = C[0] + d[0] * r; p.y = C[1] + d[1] * r; p.z = C[2] + d[2] * r; }
    // neck / torso / clothes
    if (p.y < 0.79 && p.y > 0.42) {
      const [rx, rzf, rzb, cz] = B.prof(Math.min(p.y, 0.771)), m = (look.hairMargin || 0.012) + (p.y > 0.72 ? 0.006 : 0);
      const RX = (p.y > 0.771 ? B.neckR : rx) + m, RZ = (p.z - cz < 0 ? rzf : rzb) + m, x = p.x / RX, z = (p.z - cz) / RZ, q = Math.hypot(x, z);
      if (q < 1) { p.x = x / q * RX; p.z = cz + z / q * RZ; }
    }
    // upper arms
    [-1, 1].forEach(sd => { for (let k = 0; k <= 4; k++) { const a = B.arm(k / 10); const ax = sd * a.x, rr = B.armR(k / 10)[0] + 0.014; const dx = p.x - ax, dz = p.z - a.z, dy = p.y - a.y; if (Math.abs(dy) < 0.04) { const q = Math.hypot(dx, dz); if (q < rr) { p.x = ax + dx / (q || 1) * rr; p.z = a.z + dz / (q || 1) * rr; } } } });
  };
  const mkPath = (s, sd, off, myEnd, ph, fq, t0) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push(new V(...capPt(s, lerp(t0, 1, i / 10), sd, off)));
    let p = pts[10].clone(), dir = p.subtract(pts[9]).normalize(), guard = 0;
    while (p.y > myEnd && guard++ < 200) {
      dir = dir.add(new V(0, -(S.gravity || 0.35), 0)).normalize();
      const below = sst(C[1] - 0.04, C[1] - 0.12, p.y), out = new V(p.x, 0, Math.max(p.z, -0.02) * 0.6).normalize().scale((S.spread || 0) * 0.08 * below);
      dir = dir.add(out).normalize(); p = p.add(dir.scale(0.008)); collide(p); pts.push(p.clone());
    }
    const wv = S.wave || 0;
    for (let i = 11; i < pts.length; i++) {
      const q = (i - 11) / Math.max(1, pts.length - 11), a = wv * 0.012 * sst(0, 0.35, q) * (0.6 + 0.6 * q);
      const o = new V(pts[i].x, 0, pts[i].z).normalize(), tg = new V(-o.z, 0, o.x);
      pts[i] = pts[i].add(tg.scale(Math.sin(i * 0.33 * fq + ph) * a)).add(o.scale((0.5 + 0.5 * Math.cos(i * 0.33 * fq + ph)) * a * 0.7)); collide(pts[i]);
    }
    return curve(pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1));
  };
  const endY = S.endY || 0.62, jit = S.endJitter || 0.04, wph = S.wavePhase || 5, wfq = S.waveFreq || 1;
  const hcol = (y, myEnd, shade) => mix(root, tipc, sst(S.grad || 0.5, 1, (C[1] - y) / (C[1] - myEnd)) * (S.gradAmt == null ? 1 : S.gradAmt)).map(z => z * shade);
  // continuous shell: one sheet per side from the parting to the tips
  const K = 36, Mv = 60;
  [-1, 1].forEach(sd => {
    const grid = [], ends = [];
    for (let k = 0; k <= K; k++) {
      const s = Math.min(0.997, k / K), myEnd = endY + jit * 0.5 * Math.sin(k * 2.1 + sd) - (S.backLonger || 0.02) * sst(0.55, 0.8, s);
      const f = mkPath(s, sd, 0.002 + 0.0022 * Math.abs(Math.sin(k * Math.PI / 3)), myEnd, s * wph + sd * 0.7, wfq, 0), row = [];
      for (let j = 0; j <= Mv; j++) { const q = f(j / Mv); row.push([q.x, q.y, q.z]); } grid.push(row); ends.push(myEnd);
    }
    surf(G.hair, K, Mv, (u, v) => grid[Math.round(u * K)][Math.round(v * Mv)], { center: C, us: 9, vs: 1, col: (u, v, p) => hcol(p[1], ends[Math.round(u * K)], 0.9 + 0.1 * Math.sin(Math.round(u * K) * 1.9)) });
  });
  // a few rounded locks riding on the shell
  const NL = S.locks == null ? 4 : S.locks;
  [-1, 1].forEach(sd => { for (let k = 0; k < NL; k++) {
    const s = clamp((k + 0.5) / NL + (rnd() - 0.5) * 0.04, 0.03, 0.97), myEnd = endY + (rnd() - 0.5) * jit - (S.backLonger || 0.02) * sst(0.55, 0.8, s);
    const f = mkPath(s, sd, 0.0065, myEnd, s * wph + sd * 0.7 + 0.4, wfq, S.lockStart || 0.3), nseg = Math.max(12, Math.round(f.L / 0.006));
    const lockW = (S.lockW || 0.02) * (0.85 + 0.3 * rnd()), thick = S.thick || 0.005, shade = 0.96 + 0.14 * rnd();
    tube(G.hair, f, 10, nseg, t => ({ rx: lockW * (0.1 + 0.9 * sst(0, 0.3, t)) * Math.pow(1 - sst(S.taperStart || 0.55, 1, t), S.tipPow || 0.8) + 0.0005, rz: thick * (0.2 + 0.8 * sst(0, 0.25, t)) * (1 - 0.5 * t) + 0.0005 }),
      { ref: (t, p) => new V(p.x, 0.001, p.z).normalize(), center: null, col: (u, t, p) => hcol(p[1], myEnd, shade), us: 3, vs: 1 });
  } });
  if (S.fringe) { const fr = S.fringe, fa = (fr.az || 60) * D, e0 = (fr.el == null ? 19 : fr.el) * D;
    surf(G.hair, 40, 14, (u, v) => { const az = (u * 2 - 1) * fa, k = Math.round(u * 40), eEnd = e0 + D * 1.6 * Math.sin(k * 1.7) + D * 10 * Math.pow(Math.abs(u * 2 - 1), 3), el = lerp(74 * D, eEnd, v), d = dirOf(az, el);
      const r = rad(d) + capOff + 0.0045 + 0.004 * Math.sin(Math.PI * Math.min(1, v * 1.15)), p = H.P(d), l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l * r + C[0], p[1] / l * r + C[1], p[2] / l * r + C[2]]; },
      { center: C, us: 6, vs: 1, col: u => root.map(z => z * (0.92 + 0.08 * Math.sin(Math.round(u * 40) * 1.9))) }); }
}

/* ---------------- clothing ---------------- */
function torsoGarment(g, B, sp, o = {}) {
  const yb = sp.bottom, off = sp.off || 0.004, neckY = (sp.neckUp ? 0.765 + sp.neckUp : (sp.neckY || 0.763)), nd = sp.neckDepth || 0, nshape = sp.neck || 'crew';
  const flareTop = sp.flareTop || 0.56, flare = sp.flare || 0;
  const topY = th => { const fr = Math.max(0, -Math.sin(th)), bk = Math.max(0, Math.sin(th)); let d = 0;
    if (nshape === 'square') d = nd * sst(0.6, 0.8, fr) + 0.004 * sst(0.3, 0.6, fr);
    else if (nshape === 'crew') d = nd * Math.pow(fr, 3);
    else if (nshape === 'high') d = -0.004;
    return neckY - d - (sp.backDepth || 0) * Math.pow(bk, 3); };
  const exAt = y => { if (y > Math.max(flareTop, 0.57)) return null; if (y > flareTop) return { rx: B.legX(y) + B.legR(y)[0] + off, rz: B.legR(y)[0] + off, w: sst(0.57, 0.47, y), add: 0 }; const lx = B.legX(y) + B.legR(y)[0] + off, lz = B.legR(y)[0] + off; const t = Math.max(0, flareTop - y) / Math.max(0.01, flareTop - yb); return { rx: lx, rz: lz, w: sst(0.57, 0.47, y), add: flare * Math.pow(t, sp.flarePow || 1.3) }; };
  const nu = 128, nv = o.nv || 70;
  return surf(g, nu, nv, (u, v) => {
    let th = u * 2 * Math.PI;
    if (sp.openFront) { const open = lerp(sp.openFront[0], sp.openFront[1], v); th = -Math.PI / 2 + open + u * (2 * Math.PI - 2 * open); }
    const y = lerp(yb, topY(th), 1 - Math.pow(1 - v, 1)), yy = y;
    const ex = exAt(yy); const extraOff = (sp.loose || 0) * sst(0.6, 0.7, yy) * (1 - sst(0.72, 0.75, yy));
    const p = torsoPt(B, yy, th, off + extraOff + 0.009 * sst(0.68, 0.755, yy), ex);
    if (sp.ruffle && yy < yb + 0.04) { const k = 1 + sp.ruffle * Math.sin(th * 28) * (1 - (yy - yb) / 0.04); p[0] *= k; p[2] *= k; }
    if (sp.tiers) sp.tiers.forEach(ty => { if (yy < ty && yy > ty - 0.012) { const k = 1 + 0.03 * (1 - (ty - yy) / 0.012); p[0] *= k; p[2] *= k; } });
    return p;
  }, { closed: !sp.openFront, center: [0, (yb + 0.75) / 2, 0], us: sp.us || 3, vs: sp.vs || 3, col: o.col });
  if (nshape !== 'none' && !sp.openFront) {
    const tp = []; for (let i = 0; i <= 128; i++) { const th = i / 128 * 2 * Math.PI, y = topY(th); const p = torsoPt(B, y, th, off + 0.0105, null); tp.push([p[0], y + 0.0005, p[2]]); }
    tube(g, curve(tp), 8, 320, () => ({ rx: 0.0022, rz: 0.0022 }), { ref: () => new V(0, 1, 0) });
  }
  return null;
}
function sleeve(g, B, sd, sp, o = {}) {
  const off = sp.off || 0.004, len = sp.len, f = t => { const p = B.arm(t); return new V(sd * p.x, p.y, p.z); }; f.tan = t => { const q = B.arm.tan(t); return new V(sd * q.x, q.y, q.z); };
  return tube(g, f, 28, 24, t => { const r = (B.armR(t)[0] + off) * Math.max(0.45, capEnv(t, 0.07, 0.001)) + (sp.puff || 0) * Math.sin(Math.PI * clamp(t / len, 0, 1)) * (t < len ? 1 : 0) + (sp.flare || 0) * Math.pow(t / len, 2); return { rx: r, rz: r * 1.05 }; },
    { t0: sp.start || 0.0, t1: len, us: 2, vs: 2 });
}
function legGarment(g, B, sd, sp) {
  const off = sp.off || 0.004, top = 0.5, hem = sp.hem || 0.05;
  const f = t => { const y = lerp(top, hem, t); return new V(sd * B.legX(y), y, B.legZ(y)); }; f.tan = () => new V(0, -1, 0);
  return tube(g, f, 28, 40, t => { const y = lerp(top, hem, t); const r = Math.max(B.legR(y)[0] + off, sp.minR || 0); return { rx: r, rz: r }; }, { us: 2, vs: 4 });
}
function shoes(G, B, sp) {
  const col = hex(sp.col || '#ffffff'), sole = hex(sp.sole || '#f4f1ec');
  [-1, 1].forEach(sd => {
    const x = sd * (B.legX(0.04) + 0.002), boot = sp.style === 'boots', flat = sp.style === 'flats';
    const hgt = flat ? 0.026 : 0.034, f = curve([[x, 0.03, 0.03], [x, 0.03, 0.0], [x, 0.026, -0.04], [x, 0.02, -0.075]]);
    tube(G.shoe, f, 24, 20, t => { const e = capEnv(t, 0.15, 0.22); const w = (flat ? 0.024 : 0.028) * (0.85 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.2))); return { rx: w * e, rz: hgt * (1 - 0.45 * t) * e, rzb: hgt * 0.9 * (1 - 0.6 * t) * e }; },
      { ref: () => new V(0, -1, 0), col: () => col });
    if (sp.style !== 'flats') tube(G.shoe, curve([[x, 0.006, 0.036], [x, 0.006, 0.0], [x, 0.006, -0.05], [x, 0.008, -0.082]]), 20, 14, t => { const e = capEnv(t, 0.1, 0.14); return { rx: 0.031 * e, rz: 0.0075 * e }; }, { ref: () => new V(0, -1, 0), col: () => sole });
    if (boot) tube(G.shoe, curve([[x, 0.03, 0.006], [x, 0.09, 0.004], [x, 0.15, 0.002]]), 24, 10, t => { const r = B.legR(lerp(0.03, 0.15, t))[0] + 0.006; return { rx: r, rz: r }; }, { col: () => col });
    if (sp.laces) for (let i = 0; i < 3; i++) tube(G.shoe, curve([[x - 0.01, 0.045 - i * 0.005, -0.012 - i * 0.012], [x, 0.047 - i * 0.005, -0.016 - i * 0.012], [x + 0.01, 0.045 - i * 0.005, -0.012 - i * 0.012]]), 6, 6, () => ({ rx: 0.0016, rz: 0.0016 }), { col: () => hex(sp.laces) });
  });
}
function hands(G, B) {
  [-1, 1].forEach(sd => {
    const w = B.arm(1), T = B.arm.tan(1), x = sd * w.x;
    const c = [x + sd * 0.002, w.y - 0.022, w.z - 0.002];
    ell(G.skin, c, [0.0105, 0.027, 0.019], {});
    for (let i = 0; i < 4; i++) { const z = c[2] - 0.01 + i * 0.0065; tube(G.skin, curve([[c[0], c[1] - 0.012, z], [c[0] - sd * 0.002, c[1] - 0.03 + (Math.abs(i - 1.5) * 0.003), z - 0.002], [c[0] - sd * 0.006, c[1] - 0.045 + Math.abs(i - 1.5) * 0.005, z - 0.004]]), 10, 8, t => { const e = capEnv(t, 0.01, 0.3); return { rx: 0.0042 * e, rz: 0.0042 * e }; }); }
    tube(G.skin, curve([[c[0] - sd * 0.004, c[1] + 0.008, c[2] - 0.014], [c[0] - sd * 0.008, c[1] - 0.008, c[2] - 0.024], [c[0] - sd * 0.01, c[1] - 0.022, c[2] - 0.026]]), 10, 8, t => { const e = capEnv(t, 0.01, 0.3); return { rx: 0.0052 * e, rz: 0.0052 * e }; });
  });
}

/* ---------------- accessories ---------------- */
function sunglasses(G, H, sp) {
  const C = H.c, F = H.F, y = C[1] + F.top * 0.86, z = C[2] - F.d * 0.42;
  [-1, 1].forEach(sd => {
    const cx = sd * 0.027, ring = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; ring.push([cx + Math.cos(a) * 0.017, y + Math.sin(a) * 0.016 * 0.35 + 0.004, z + Math.sin(a) * 0.016 * 0.94]); }
    tube(G.frame, curve(ring), 6, 40, () => ({ rx: 0.0017, rz: 0.0017 }));
    surf(G.lens, 16, 4, (u, v) => { const a = u * 2 * Math.PI; return [cx + Math.cos(a) * 0.016 * v, y + 0.004 + Math.sin(a) * 0.015 * 0.35 * v + 0.001, z + Math.sin(a) * 0.015 * 0.94 * v]; }, { center: [cx, y - 1, z] });
  });
  tube(G.frame, curve([[-0.01, y + 0.006, z - 0.003], [0, y + 0.008, z - 0.005], [0.01, y + 0.006, z - 0.003]]), 6, 8, () => ({ rx: 0.0015, rz: 0.0015 }));
  [-1, 1].forEach(sd => tube(G.frame, curve([[sd * 0.044, y + 0.004, z + 0.002], [sd * 0.062, y - 0.004, z + 0.04], [sd * 0.064, y - 0.012, z + 0.08]]), 6, 10, () => ({ rx: 0.0014, rz: 0.0014 })));
}
function cap(G, H, sp) {
  const C = H.c, F = H.F, R = [F.w + 0.014, F.top * 0.62 + 0.012, F.d + 0.012], y0 = C[1] + F.top * 0.28;
  surf(G.cap, 40, 14, (u, v) => { const th = u * 2 * Math.PI, ph = v * Math.PI / 2; return [Math.sin(th) * Math.sin(ph) * R[0], y0 + Math.cos(ph) * R[1] * 1.0, C[2] + 0.004 - Math.cos(th) * Math.sin(ph) * R[2]]; }, { closed: true, center: [C[0], y0, C[2]] });
  surf(G.cap, 24, 6, (u, v) => { const a = (u - 0.5) * 1.9, r = lerp(R[2] * 0.95, R[2] + 0.07, v); return [Math.sin(a) * r * (R[0] / R[2]) * (1 - 0.25 * v), y0 + 0.004 - v * 0.012 - Math.abs(Math.sin(a)) * 0.006 * v, C[2] + 0.004 - Math.cos(a) * r]; }, { center: [0, y0 + 1, C[2]] });
  ell(G.cap, [0, y0 + R[1] * 0.99, C[2] + 0.004], [0.006, 0.003, 0.006]);
  for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.9; tube(G.capTrim, curve([[Math.sin(a) * R[0] * 0.98, y0 + 0.003, C[2] + 0.004 - Math.cos(a) * R[2] * 0.98], [Math.sin(a) * R[0] * 0.6, y0 + R[1] * 0.85, C[2] + 0.004 - Math.cos(a) * R[2] * 0.6], [0, y0 + R[1] * 1.0, C[2] + 0.004]]), 4, 10, () => ({ rx: 0.0009, rz: 0.0009 })); }
}
function choker(G, B, sp) {
  const y = 0.775, r = B.neckR + 0.0025, pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * 2 * Math.PI; pts.push([Math.cos(a) * r, y - 0.002 * Math.sin(a), 0.01 + Math.sin(a) * r]); }
  tube(G.choker, curve(pts), 6, 64, () => ({ rx: 0.0035, rz: 0.0013 }), { ref: (t, p) => new V(p.x, 0, p.z - 0.01) });
  if (sp.charm) ell(G.metal, [0, y - 0.008, 0.01 - r - 0.002], [0.0025, 0.0035, 0.0015]);
}
function catHead(g, gEye, c, s, cols) {  // tiny cat (charm or companion head). c centre [x,y,z], s radius, faces -Z
  const fur = hex(cols.fur), white = hex(cols.white || cols.fur), pink = hex('#f29aa6');
  ell(g, c, [s * 1.12, s, s * 0.95], { col: (u, v, p) => { const fr = (c[2] - p[2]) / s, low = (c[1] - p[1]) / s; return (fr > 0.35 && low > -0.15 && Math.abs(p[0] - c[0]) < s * 0.75) ? white : fur; } }, 24, 18);
  [-1, 1].forEach(sd => {
    const b = [c[0] + sd * s * 0.62, c[1] + s * 0.6, c[2]]; const tp = [c[0] + sd * s * 0.85, c[1] + s * 1.45, c[2] + s * 0.05];
    surf(g, 12, 6, (u, v) => { const a = u * 2 * Math.PI, r = s * 0.42 * (1 - v); return [lerp(b[0], tp[0], v) + Math.cos(a) * r, lerp(b[1], tp[1], v), lerp(b[2], tp[2], v) + Math.sin(a) * r * 0.5]; }, { closed: true, col: (u, v) => (Math.sin(u * 2 * Math.PI) < -0.3 && v < 0.7) ? pink : fur });
    ell(gEye, [c[0] + sd * s * 0.42, c[1] + s * 0.12, c[2] - s * 0.8], [s * 0.22, s * 0.26, s * 0.15]);
  });
  ell(g, [c[0], c[1] - s * 0.18, c[2] - s * 0.95], [s * 0.1, s * 0.07, s * 0.06], { color: pink });
}
function catBody(G, look, sp, scene) {
  const cols = sp, g = G.cat, s = 0.16;  // internal units (character-relative); the cat is ~0.28 m long at 1.65 m
  const fur = hex(cols.fur), white = hex(cols.white || cols.fur);
  const bx = sp.x || 0.2, bz = sp.z || -0.05;
  // sitting cat: body pear, chest white
  ell(g, [bx, 0.055, bz], [0.045, 0.06, 0.055], { col: (u, v, p) => (p[2] < bz - 0.03 && p[1] > 0.03) ? white : fur }, 24, 18);
  ell(g, [bx, 0.03, bz + 0.012], [0.05, 0.035, 0.06], { color: fur });
  [-1, 1].forEach(sd => { tube(g, curve([[bx + sd * 0.02, 0.07, bz - 0.03], [bx + sd * 0.022, 0.03, bz - 0.045], [bx + sd * 0.022, 0.008, bz - 0.05]]), 12, 8, t => ({ rx: 0.011, rz: 0.011 }), { col: () => white }); ell(g, [bx + sd * 0.022, 0.007, bz - 0.055], [0.013, 0.008, 0.016], { color: white }); });
  tube(g, curve([[bx + 0.02, 0.02, bz + 0.06], [bx + 0.07, 0.01, bz + 0.03], [bx + 0.085, 0.02, bz - 0.03], [bx + 0.07, 0.04, bz - 0.06]]), 10, 30, t => { const r = 0.009 * (1 - 0.4 * t); return { rx: r, rz: r }; }, { col: () => fur });
  catHead(g, G.catEye, [bx, 0.135, bz - 0.02], 0.04, cols);
  for (let sd of [-1, 1]) for (let k = 0; k < 2; k++) tube(G.lash, curve([[bx + sd * 0.012, 0.13 - k * 0.006, bz - 0.06], [bx + sd * 0.04, 0.132 - k * 0.012, bz - 0.06], [bx + sd * 0.06, 0.128 - k * 0.018, bz - 0.055]]), 4, 6, () => ({ rx: 0.0006, rz: 0.0006 }));
}
function bagWithCharm(G, B, sp) {
  const sd = sp.side || 1, x = sd * (B.sh + 0.03), y = 0.5, z = 0.0;
  // strap from opposite shoulder across the chest (crossbody)
  const st = []; for (let i = 0; i <= 16; i++) { const t = i / 16, yy = lerp(0.745, y + 0.03, t), xx = lerp(-sd * 0.06, x - sd * 0.01, t), th = -Math.PI / 2; const pf = torsoPt(B, Math.min(0.74, yy), th, 0.016); st.push([xx, yy, Math.min(pf[2], -0.03 + 0 * t) - 0.004]); }
  const back = []; for (let i = 0; i <= 10; i++) { const t = i / 10, yy = lerp(0.745, y + 0.03, t), xx = lerp(-sd * 0.06, x - sd * 0.01, t); back.push([xx, yy, 0.05]); }
  tube(G.bag, curve(st), 6, 40, () => ({ rx: 0.004, rz: 0.0012 }), { ref: () => new V(0, 0, -1) });
  tube(G.bag, curve(back), 6, 30, () => ({ rx: 0.004, rz: 0.0012 }), { ref: () => new V(0, 0, 1) });
  tube(G.bag, curve([[x, y + 0.03, z], [x, y, z], [x, y - 0.03, z]]), 24, 10, t => { const e = capEnv(t, 0.18, 0.18); return { rx: 0.026 * e, rz: 0.012 * e }; }, { ref: () => new V(1, 0, 0) });
  // charm hanging off the bag
  tube(G.metal, curve([[x + sd * 0.012, y + 0.02, z - 0.012], [x + sd * 0.016, y + 0.0, z - 0.016], [x + sd * 0.016, y - 0.02, z - 0.017]]), 4, 8, () => ({ rx: 0.0008, rz: 0.0008 }));
  catHead(G.cat, G.catEye, [x + sd * 0.016, y - 0.03, z - 0.018], 0.011, sp.charm || { fur: '#222', white: '#fff' });
}
function hijab(G, H, B, sp) {
  const C = H.c, D = Math.PI / 180, th = sp.thick || 0.007;
  const t0 = a => { const s = Math.sin(a); return D * (57 + (s > 0 ? -27 : 20) * s * s); };
  const hp = (a, t, ex) => { const d = [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), -Math.cos(t)], p = H.P(d), l = Math.hypot(p[0], p[1], p[2]), r = l + ex; return [p[0] / l * r + C[0], p[1] / l * r + C[1], p[2] / l * r + C[2]]; };
  surf(G.hijab, 72, 32, (u, v) => { const a = u * 2 * Math.PI; return hp(a, lerp(t0(a), Math.PI, v), th * (0.45 + 0.55 * sst(0, 0.12, v)) + 0.004 * sst(0.3, 0.9, v)); }, { closed: true, center: C });
  const rim = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI; rim.push(hp(a, t0(a), th * 0.45)); }
  tube(G.hijab, curve(rim), 8, 128, () => ({ rx: 0.0035, rz: 0.0035 }));
  const dp = (y, a, ex) => { const yy = Math.min(y, 0.74), p = torsoPt(B, yy, a, 0.017 + ex), w = sst(0.74, 0.80, y), c = Math.cos(a), s = Math.sin(a);
    const sx = lerp(B.sh + 0.038, B.sh + 0.014, sst(0.70, 0.745, yy)) + ex, px = (c < 0 ? -1 : 1) * Math.max(Math.abs(p[0]), Math.abs(c) * sx);
    return [lerp(px, c * (0.064 + ex), w), y, lerp(p[2], 0.008 + s * ((s < 0 ? 0.046 : 0.07) + ex), w)]; };
  const yb = a => 0.70 - 0.055 * Math.pow(Math.max(0, -Math.sin(a)), 2);
  surf(G.hijab, 96, 28, (u, v) => { const a = u * 2 * Math.PI; return dp(lerp(yb(a), 0.806, v), a, 0.0015 * Math.sin(a * 9) * (1 - v)); }, { closed: true, center: [0, 0.75, 0] });
  const tr = []; for (let i = 0; i <= 64; i++) tr.push(dp(0.806, i / 64 * 2 * Math.PI, 0));
  tube(G.hijab, curve(tr), 8, 96, () => ({ rx: 0.004, rz: 0.004 }), { ref: () => new V(0, 1, 0) });
  G.dp = dp;
}
function steth(G, B) {
  const dp = G.dp || ((y, a, ex) => torsoPt(B, Math.min(y, 0.771), a, 0.014 + ex));
  [-1, 1].forEach(sd => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(dp(lerp(0.772, 0.6, sst(0.2, 1, t)), Math.PI / 2 - sd * lerp(0, Math.PI - 0.1, Math.pow(t, 0.8)), 0.005)); }
    pts.push(dp(0.585, -Math.PI / 2, 0.005)); tube(G.choker, curve(pts), 8, 60, () => ({ rx: 0.0028, rz: 0.0028 })); });
  tube(G.choker, curve([dp(0.588, -Math.PI / 2, 0.005), dp(0.57, -Math.PI / 2, 0.005), dp(0.552, -Math.PI / 2, 0.005)]), 8, 8, () => ({ rx: 0.0028, rz: 0.0028 }));
  ell(G.metal, dp(0.545, -Math.PI / 2, 0.006), [0.01, 0.01, 0.004], {}, 16, 8);
}
function hood(g) {
  const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * 2 * Math.PI, s = Math.sin(a); pts.push([Math.cos(a) * 0.058, 0.765 + 0.012 * s, 0.012 + s * (s > 0 ? 0.064 : 0.05)]); }
  tube(g, curve(pts), 12, 64, t => { const s = Math.max(0, Math.sin(t * 2 * Math.PI)); return { rx: 0.009 + 0.006 * s, rz: 0.011 + 0.012 * s }; }, { ref: () => new V(0, 1, 0) });
}
function phone(G, B) {
  const w = B.arm(1), c = [w.x + 0.015, w.y - 0.032, w.z - 0.006], se = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
  surf(G.frame, 24, 14, (u, v) => { const th = u * 2 * Math.PI, ph = v * Math.PI; return [c[0] + 0.0032 * Math.sin(ph) * Math.cos(th), c[1] + 0.036 * se(Math.cos(ph), 0.3), c[2] + 0.018 * se(Math.sin(ph) * Math.sin(th), 0.3)]; }, { closed: true, center: c });
}
function bands(G) {  // lawyer's white bands at the collar
  [-1, 1].forEach(sd => surf(G.white, 4, 4, (u, v) => [sd * 0.003 + sd * u * 0.009, 0.755 - v * 0.045, -0.032 - 0.002 * v - 0.003 * (1 - v)], { center: [0, 0.73, 1] }));
}
function buttons(G, B, sp) { for (let i = 0; i < (sp.n || 5); i++) { const y = (sp.top || 0.7) - i * (sp.gap || 0.03); const p = torsoPt(B, y, -Math.PI / 2, (sp.off || 0.004) + 0.002); ell(G.btn, p, [0.0035, 0.0035, 0.0018], {}, 10, 6); } }
function trim(G, B, y, off, key, th = 0.003) { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; pts.push(torsoPt(B, y, a, off)); } tube(G[key], curve(pts), 6, 96, () => ({ rx: th, rz: th * 0.7 }), { ref: (t, p) => new V(p.x, 0, p.z) }); }
function sleeveCuff(G, B, sd, t, off, key) { const p = B.arm(t), r = B.armR(t)[0] + off; const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; pts.push([sd * p.x + Math.cos(a) * r, p.y + 0.004 * Math.cos(a) * sd * 0.5, p.z + Math.sin(a) * r]); } tube(G[key], curve(pts), 6, 40, () => ({ rx: 0.003, rz: 0.002 }), { ref: (tt, q) => new V(q.x - sd * p.x, 0, q.z - p.z) }); }

/* ---------------- materials ---------------- */
function pbr(scene, name, col, o = {}) {
  const m = new BABYLON.PBRMaterial(name, scene); m.albedoColor = C3(col); m.metallic = o.metal || 0; m.roughness = o.rough == null ? 0.7 : o.rough;
  m.backFaceCulling = false; m.twoSidedLighting = true; m.maxSimultaneousLights = 8;
  if (o.tex) m.albedoTexture = o.tex;
  if (o.sheen) { m.sheen.isEnabled = true; m.sheen.intensity = o.sheen; m.sheen.color = C3(o.sheenCol || [1, 1, 1]); m.sheen.roughness = 0.4; }
  if (o.clear) { m.clearCoat.isEnabled = true; m.clearCoat.intensity = o.clear; m.clearCoat.roughness = o.clearRough || 0.15; }
  if (o.sss) { m.subSurface.isTranslucencyEnabled = true; m.subSurface.translucencyIntensity = o.sss; m.subSurface.tintColor = C3(o.sssCol || [1, 0.4, 0.3]); }
  if (o.emissive) m.emissiveColor = C3(o.emissive);
  m.environmentIntensity = o.env == null ? 1 : o.env;
  return m;
}

/* ---------------- build ---------------- */
function build(scene, look, outfitIdx = 0) {
  SEED = look.seed || 7;
  const B = bodyModel(look), H = headModel(look), O = look.outfits[outfitIdx];
  const keys = ['skin', 'eye', 'lash', 'brow', 'lip', 'mouth', 'teeth', 'hair', 'scalp', 'shoe', 'frame', 'lens', 'cap', 'capTrim', 'choker', 'metal', 'cat', 'catEye', 'bag', 'white', 'btn', 'crease', 'hijab'];
  const G = {}; keys.forEach(k => G[k] = new Geo()); G.B = B;
  const garmentGeos = [];
  const skinC = hex(look.skin);
  buildFace(G, H, look, scene);
  buildHair(G, H, B, look);
  // body (skin): torso, arms, legs, hands — covered parts are still built so outfits can be swapped
  const tor = []; surf(G.skin, 48, 40, (u, v) => torsoPt(B, lerp(0.438, 0.772, v), u * 2 * Math.PI, 0), { closed: true, center: [0, 0.6, 0] });
  [-1, 1].forEach(sd => {
    const f = t => { const p = B.arm(t); return new V(sd * p.x, p.y, p.z); }; f.tan = t => { const q = B.arm.tan(t); return new V(sd * q.x, q.y, q.z); };
    tube(G.skin, f, 20, 30, t => { const e = capEnv(t, 0.05, 0.001); const r = B.armR(t)[0] * Math.max(0.3, e); return { rx: r, rz: r * 1.06 }; });
    const lf = t => { const y = lerp(0.5, 0.03, t); return new V(sd * B.legX(y), y, B.legZ(y)); }; lf.tan = () => new V(0, -1, 0);
    tube(G.skin, lf, 24, 40, t => { const y = lerp(0.5, 0.03, t); const r = B.legR(y)[0]; return { rx: r, rz: B.legRz(y), rzb: B.legRz(y) * (y > 0.08 && y < 0.25 ? 1.12 : 1) }; });
  });
  hands(G, B);
  // outfit
  (O.items || []).forEach((it, idx) => {
    const g = new Geo(); let mat = null; const col = hex(it.col || '#888888');
    const tex = it.pattern ? patternTex(scene, it.pattern) : null;
    const mo = { tex, rough: it.rough == null ? 0.82 : it.rough, sheen: it.sheen, sheenCol: it.sheenCol ? hex(it.sheenCol) : null, clear: it.clear };
    if (it.type === 'top' || it.type === 'dress' || it.type === 'gown') {
      torsoGarment(g, B, it); if (it.hood) hood(g);
      if (it.sleeve) [-1, 1].forEach(sd => sleeve(g, B, sd, Object.assign({ off: (it.off || 0.004) + 0.001 }, it.sleeve)));
    }
    if (it.type === 'skirt') torsoGarment(g, B, Object.assign({ neck: 'none' }, it, { neckUp: -(0.765 - it.top) }));
    if (it.type === 'pants') { [-1, 1].forEach(sd => legGarment(g, B, sd, it)); torsoGarment(g, B, { bottom: 0.44, off: (it.off || 0.004) + 0.001, neck: 'none', neckUp: -(0.765 - (it.top || 0.57)), us: 3, vs: 3 }); }
    if (it.type === 'shoes') { shoes(G, B, it); return; }
    if (it.type === 'sunglasses') { sunglasses(G, H, it); return; }
    if (it.type === 'cap') { cap(G, H, it); return; }
    if (it.type === 'choker') { choker(G, B, it); return; }
    if (it.type === 'bag') { bagWithCharm(G, B, it); return; }
    if (it.type === 'bands') { bands(G); return; }
    if (it.type === 'hijab') { hijab(G, H, B, it); return; }
    if (it.type === 'stethoscope') { steth(G, B); return; }
    if (it.type === 'phone') { phone(G, B); return; }
    if (it.trims) it.trims.forEach(tr => { if (tr.y) trim(G, B, tr.y, tr.off || 0.008, 'white', tr.th || 0.003); });
    if (it.buttons) buttons(G, B, Object.assign({ off: it.off }, it.buttons));
    if (it.cuffs) [-1, 1].forEach(sd => sleeveCuff(G, B, sd, it.sleeve.len - 0.01, (it.off || 0.004) + 0.003 + (it.sleeve.flare || 0), 'white'));
    mat = pbr(scene, 'g' + idx + '_' + it.type, col, mo); if (tex) { mat.albedoColor = new BABYLON.Color3(1, 1, 1); }
    garmentGeos.push([g, mat, it.type]);
  });
  if (O.cat) catBody(G, look, O.cat, scene);
  // materials
  const M = {
    skin: pbr(scene, 'skin', skinC, { rough: 0.62, clear: 0.08, clearRough: 0.45, env: 0.7 }),
    eye: pbr(scene, 'eye', [1, 1, 1], { rough: 0.08, tex: eyeTex(scene, look), clear: 1, clearRough: 0.02 }),
    lash: pbr(scene, 'lash', hex(look.face.lashCol || '#120c0a'), { rough: 0.6 }),
    brow: pbr(scene, 'brow', hex(look.face.brow.col), { rough: 0.85 }),
    lip: pbr(scene, 'lip', hex(look.face.mouth.lip), { rough: 0.35, clear: 0.4, clearRough: 0.25 }),
    mouth: pbr(scene, 'mouth', hex('#5a1e22'), { rough: 0.6 }),
    teeth: pbr(scene, 'teeth', hex('#f6f1ea'), { rough: 0.3 }),
    hair: pbr(scene, 'hair', [1, 1, 1], { rough: look.hair.rough || 0.45, tex: streakTex(scene), sheen: 0.4, sheenCol: hex(look.hair.sheen || '#ffd9b0'), clear: look.hair.gloss == null ? 0.3 : look.hair.gloss, clearRough: 0.2, env: look.hair.env }),
    shoe: pbr(scene, 'shoe', [1, 1, 1], { rough: 0.6 }),
    frame: pbr(scene, 'frame', hex('#1a1412'), { rough: 0.3, clear: 0.6 }),
    lens: pbr(scene, 'lens', hex('#2a1d18'), { rough: 0.05, clear: 1, clearRough: 0.02 }),
    cap: pbr(scene, 'cap', hex((O.items.find(i => i.type === 'cap') || {}).col || '#cc2222'), { rough: 0.85, sheen: 0.3 }),
    capTrim: pbr(scene, 'capTrim', hex('#7a1010'), { rough: 0.8 }),
    choker: pbr(scene, 'choker', hex('#0d0b0c'), { rough: 0.35, clear: 0.5 }),
    metal: pbr(scene, 'metal', hex('#d8c08a'), { rough: 0.25, metal: 1 }),
    cat: pbr(scene, 'cat', [1, 1, 1], { rough: 0.8, sheen: 0.5 }),
    catEye: pbr(scene, 'catEye', hex('#7fc24a'), { rough: 0.05, clear: 1, emissive: hex('#1a3008') }),
    bag: pbr(scene, 'bag', hex((O.items.find(i => i.type === 'bag') || {}).col || '#141214'), { rough: 0.4, clear: 0.4 }),
    white: pbr(scene, 'white', hex((O.items.find(i => i.trimCol) || {}).trimCol || '#f4f2ee'), { rough: 0.8 }),
    btn: pbr(scene, 'btn', hex((O.items.find(i => i.buttons) || { buttons: {} }).buttons.col || '#ffffff'), { rough: 0.3, clear: 0.6 }),
    crease: pbr(scene, 'crease', skinC.map(x => x * 0.45), { rough: 0.8 }),
    hijab: pbr(scene, 'hijab', hex((O.items.find(i => i.type === 'hijab') || {}).col || '#888888'), { rough: 0.85, sheen: 0.35 }),
  }; M.scalp = M.hair;
  const hs = look.headScale || 1;
  if (hs !== 1) { const pv = [0, 0.787, 0.008]; keys.map(k => G[k]).concat(garmentGeos.map(x => x[0])).forEach(g => { for (let i = 0; i < g.p.length; i += 3) { const w = sst(0.776, 0.806, g.p[i + 1]); if (w <= 0) continue; const k = 1 + (hs - 1) * w; for (let j = 0; j < 3; j++) g.p[i + j] = pv[j] + (g.p[i + j] - pv[j]) * k; } }); }
  const root = new BABYLON.TransformNode('char_' + look.name, scene), meshes = [];
  keys.forEach(k => { const m = G[k].mesh(look.name + '_' + k, scene, M[k]); if (m) { m.parent = root; meshes.push(m); } });
  garmentGeos.forEach(([g, mat, ty], i) => { const m = g.mesh(look.name + '_' + ty + i, scene, mat); if (m) { m.parent = root; meshes.push(m); } });
  root.scaling.setAll(look.height || 1.7);
  meshes.forEach(m => { m.receiveShadows = !(m.name.endsWith('_scalp') || (look.hair.noSelfShadow && m.name.endsWith('_hair'))); });
  return { root, meshes, B, H, update: t => { root.getChildMeshes().forEach(() => {}); } };
}
window.CC = { build };
})();
