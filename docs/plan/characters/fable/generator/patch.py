import os
d = os.path.dirname(os.path.abspath(__file__))
L = open(d + '/cartoon.orig.js').read().split('\n')
def idx(prefix):
    m = [i for i, l in enumerate(L) if l.startswith(prefix)]
    assert len(m) == 1, (prefix, len(m)); return m[0]
def rep(prefix, new): L[idx(prefix)] = new
def after(prefix, new): L.insert(idx(prefix) + 1, new)
def before(prefix, new): L.insert(idx(prefix), new)
def sub(a, b):
    global L
    s = '\n'.join(L); assert s.count(a) == 1, (a, s.count(a)); L = s.replace(a, b).split('\n')

rep('    [0.735, B.sh * 0.97', '    [0.735, B.sh * 0.95, 0.036, 0.04, 0.004],')
rep('    [0.752, B.sh * 0.78', '    [0.752, B.sh * 0.70, 0.028, 0.032, 0.006],')
rep('  B.arm = curve(', '  const ao = 0.004 + 0.012 * c; B.arm = curve([[ax - 0.012, 0.742, 0.006], [ax + 0.006, 0.708, 0.008], [ax + 0.014 + ao * 0.4, 0.66, 0.012], [ax + 0.02 + ao * 0.8, 0.585, 0.016], [ax + 0.022 + ao, 0.52, 0.004], [ax + 0.022 + ao, 0.462, -0.008]]);')
sub('const r = B.armR(t)[0] + off + (sp.puff || 0)', 'const r = (B.armR(t)[0] + off) * Math.max(0.45, capEnv(t, 0.07, 0.001)) + (sp.puff || 0)')
i = idx('  [-1, 1].forEach(sd => ell(G.skin, [sd * F.w * 0.96'); L[i] = '  if (!F.noEars)' + L[i]
sub('const pm = 1.4,', 'const pm = F.eyePm || 1.4,')
rep('    const eUp = s1 =>', '    const eUp = s1 => lu * (0.12 + 0.88 * Math.pow(Math.max(0, 1 - s1 * s1), 0.6)) + tilt * so(s1);')
rep('    const eLo = s1 =>', '''    const eLo = s1 => -ll * (0.08 + 0.92 * Math.pow(Math.max(0, 1 - s1 * s1), 0.75)) + tilt * 0.6 * so(s1);
    const lidN = (p, q) => norm([lerp(q[0], s.n[0], 0.65), lerp(q[1], s.n[1], 0.65), lerp(q[2], s.n[2], 0.65)]);''')
sub('{ center: c, col: (u, v) => mix(shadow.map(', '{ center: c, nrm: lidN, col: (u, v) => mix(shadow.map(')
sub('1.06 + 0.02 * v); }, { center: c });', '1.06 + 0.02 * v); }, { center: c, nrm: lidN });')
after('    if (F.lowerLash)', r'''    { const od = sd * Math.sign(Rt[0] || 1), nl = F.lashes == null ? 4 : F.lashes, LL = er * (F.lashLen || 0.3);
      for (let i = 0; i < nl; i++) { const o = lerp(0.3, 0.95, nl > 1 ? i / (nl - 1) : 1), s1 = od * o * 0.97, b = lidP(s1, eUp(s1) + 0.05, 1.09), k = (0.6 + 0.4 * o) * LL;
        const dv = (a, bb, cc) => [b[0] + (f[0] * a + U[0] * bb + Rt[0] * od * cc) * k, b[1] + (f[1] * a + U[1] * bb + Rt[1] * od * cc) * k, b[2] + (f[2] * a + U[2] * bb + Rt[2] * od * cc) * k];
        tube(G.lash, curve([b, dv(0.35, 0.2, 0.15 * o), dv(0.5, 0.7, 0.55 * o)]), 6, 8, t => { const r = F.lash * 0.5 * (1 - 0.9 * t); return { rx: r, rz: r }; }); }
      if (F.crease !== 0) { const cq = []; for (let i = 0; i <= 12; i++) { const s1 = od * (-0.7 + 1.5 * i / 12); cq.push(lidP(s1, eUp(s1) + (F.crease || 0.3), 1.078)); }
        tube(G.crease, curve(cq), 6, 20, t => { const r = 0.0002 + 0.0006 * Math.sin(Math.PI * t); return { rx: r, rz: r }; }); } }''')
sub('(1 - 0.55 * Math.pow(t, 1.3))', '(1 - 0.72 * Math.pow(t, 1.4))')
i = idx('  const tip = H.face(0, ny')
assert L[i + 4].startswith('  tube(G.skin, curve(br)')
L[i:i + 5] = [r'''  { const yT = F.eyeY * F.chin + 0.006, yB = ny - 0.011 * ns, hw = 0.017 * ns, g2 = (a, s) => Math.exp(-a * a / (s * s));
    const bump = (x, y) => { const up = clamp((y - ny) / (yT - ny), 0, 1), ax = Math.abs(x);
      const tipB = 0.0062 * g2(x, 0.0062 * ns) * (y > ny ? g2(y - ny, 0.0075 * ns) : g2(y - ny, 0.0042 * ns));
      const bridge = (y > ny ? lerp(0.0034, 0.001, Math.sqrt(up)) : 0.0034 * g2(y - ny, 0.003 * ns)) * g2(x, lerp(0.0048, 0.0036, up) * ns);
      const ala = 0.0034 * g2(ax - 0.0074 * ns, 0.0036 * ns) * g2(y - (ny - 0.0015), 0.0036 * ns);
      return (tipB + bridge + ala) * (1 - sst(0.7, 1, ax / hw)) * sst(yB, yB + 0.003, y) * (1 - sst(yT - 0.006, yT, y)); };
    surf(G.skin, 30, 44, (u, v) => { const x = (u * 2 - 1) * hw, y = lerp(yB, yT, v); return H.face(x, y, 0.0002 + ns * bump(x, y)).p; },
      { center: H.c, col: (u, v, p) => { const sh = g2(p[0], 0.007 * ns) * g2(p[1] - H.c[1] - (ny - 0.0062 * ns), 0.0026 * ns); return [1 - 0.2 * sh, 1 - 0.3 * sh, 1 - 0.3 * sh]; } }); }''']
after('  const S = look.hair, F = H.F, C = H.c;', '  if (S.none) return;')
a, b = idx('  // locks'), idx('  // fringe / face-framing')
L[a:b + 1] = [r'''  const mkPath = (s, sd, off, myEnd, ph, fq, t0) => {
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
      { center: C, us: 6, vs: 1, col: u => root.map(z => z * (0.92 + 0.08 * Math.sin(Math.round(u * 40) * 1.9))) }); }''']
before('function bands(G)', r'''function hijab(G, H, B, sp) {
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
}''')
sub("'white', 'btn'];", "'white', 'btn', 'crease', 'hijab'];")
after("    if (it.type === 'bands')", "    if (it.type === 'hijab') { hijab(G, H, B, it); return; }\n    if (it.type === 'stethoscope') { steth(G, B); return; }\n    if (it.type === 'phone') { phone(G, B); return; }")
rep('      torsoGarment(g, B, it);', '      torsoGarment(g, B, it); if (it.hood) hood(g);')
after('    btn: pbr(', "    crease: pbr(scene, 'crease', skinC.map(x => x * 0.45), { rough: 0.8 }),\n    hijab: pbr(scene, 'hijab', hex((O.items.find(i => i.type === 'hijab') || {}).col || '#888888'), { rough: 0.85, sheen: 0.35 }),")
before('  const root = new BABYLON.TransformNode', r'''  const hs = look.headScale || 1;
  if (hs !== 1) { const pv = [0, 0.787, 0.008]; keys.map(k => G[k]).concat(garmentGeos.map(x => x[0])).forEach(g => { for (let i = 0; i < g.p.length; i += 3) { const w = sst(0.776, 0.806, g.p[i + 1]); if (w <= 0) continue; const k = 1 + (hs - 1) * w; for (let j = 0; j < 3; j++) g.p[i + j] = pv[j] + (g.p[i + j] - pv[j]) * k; } }); }''')
open(d + '/cartoon.js', 'w').write('\n'.join(L))
s = open(d + '/studio.js').read()
if "'bust'" not in s:
    k = "      if (name === 'pair')"
    assert k in s
    s = s.replace(k, "      if (name === 'bust') { cam.fov = 0.3; cam.position = new V3(0, h * 0.9, -2.0); cam.setTarget(new V3(0, h * 0.885, 0)); }\n      if (name === 'lineup') { cam.fov = 0.34; cam.position = new V3(0, 0.98, -6.3); cam.setTarget(new V3(0, 0.9, 0)); }\n" + k)
    open(d + '/studio.js', 'w').write(s)
print('patched')
