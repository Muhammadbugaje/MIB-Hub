/* Freshers School Life — vehicle models and vehicle motion.
   Every machine is built once per type as a few merged geometries (one per material): bodies are side profiles
   extruded with bevelled edges and smoothed normals, wheels are lathed tyres with rims and spokes. Instances share
   the geometry and only differ by paint. Models face +X, Y is up, Z is across. Nothing runs at load time. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim;
  var T = null, lo = false, GEO = {}, MAT = {}, PROTO = {}, tmp = null;
  // the driver's seat and the ceiling over it, per closed machine (metres, machine space). The head-clearance rule
  // (docs/MASTER_GAME_GUIDE.md 11.2) is checked against this table by games/tests/test_samaru_crash.py.
  var CABIN = { car: { seat: .42, roof: 1.27, scale: .68 }, sport: { seat: .31, roof: .98, scale: .54 }, pickup: { seat: .5, roof: 1.5, scale: .72 }, bus: { seat: .78, roof: 2.04, scale: .8 }, keke: { seat: .76, roof: 1.7, roofBack: 1.74, scale: .78 }, plane: { seat: 1.04, roof: 2.1, scale: .6 } }; CABIN.taxi = CABIN.car; // the plane's roof is the canopy under the wing
  var V = Z.veh = { kinds: ["skate", "bike", "scooter", "okada", "keke", "car", "sport", "plane", "taxi", "pickup", "bus"] };

  function boot(three, R) {
    lo = !!R && R.quality === "low";
    if (T) return; T = three;
    tmp = { m: new T.Matrix4(), n: new T.Matrix3(), v: new T.Vector3(), v2: new T.Vector3(), s: new T.Vector3(), q: new T.Quaternion(), e: new T.Euler(), up: new T.Vector3(0, 1, 0) };
  }
  function qk(k) { return k + (lo ? "~" : ""); }

  /* ---------- geometry helpers ---------- */
  // average face normals across faces that meet at less than `deg`, so curves shade smooth and creases stay crisp
  function smooth(g, deg) {
    if (g.index) g = g.toNonIndexed();
    var p = g.attributes.position, n = p.count, cos = Math.cos(deg * Math.PI / 180), fn = new Float32Array(n * 3), ar = new Float32Array(n), map = {}, out = new Float32Array(n * 3), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), i, j, k;
    for (i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); c.sub(b); a.sub(b); c.cross(a); var l = c.length() || 1e-9; c.multiplyScalar(1 / l);
      for (j = 0; j < 3; j++) { fn[(i + j) * 3] = c.x; fn[(i + j) * 3 + 1] = c.y; fn[(i + j) * 3 + 2] = c.z; ar[i + j] = l; }
    }
    for (i = 0; i < n; i++) { k = Math.round(p.getX(i) * 500) + "," + Math.round(p.getY(i) * 500) + "," + Math.round(p.getZ(i) * 500); (map[k] || (map[k] = [])).push(i); }
    for (k in map) { var L = map[k]; for (i = 0; i < L.length; i++) { var vi = L[i] * 3, x = 0, y = 0, z = 0; for (j = 0; j < L.length; j++) { var vj = L[j] * 3; if (fn[vi] * fn[vj] + fn[vi + 1] * fn[vj + 1] + fn[vi + 2] * fn[vj + 2] >= cos) { x += fn[vj] * ar[L[j]]; y += fn[vj + 1] * ar[L[j]]; z += fn[vj + 2] * ar[L[j]]; } } var m = Math.hypot(x, y, z) || 1; out[vi] = x / m; out[vi + 1] = y / m; out[vi + 2] = z / m; } }
    g.setAttribute("normal", new T.BufferAttribute(out, 3)); g.deleteAttribute("uv"); return g;
  }
  // a side profile (in X,Y) pushed out across the width, with rounded edges; the outline stays the size you drew
  function ext(key, shape, width, bev, crease, cs, bs) {
    key = qk(key); if (GEO[key]) return GEO[key];
    bev = Math.min(bev, width / 2 - .001);
    var g = new T.ExtrudeGeometry(shape(), { depth: width - bev * 2, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: lo ? 1 : bs || 2, curveSegments: lo ? 3 : cs || 5 });
    g.translate(0, 0, -(width - bev * 2) / 2);
    return (GEO[key] = smooth(g, crease || 42));
  }
  function path(pts) { // [x,y] = line, [cx,cy,x,y] = curve; first point starts the outline
    return function () { var s = new T.Shape(); pts.forEach(function (q, i) { if (!i) s.moveTo(q[0], q[1]); else if (q.length === 2) s.lineTo(q[0], q[1]); else if (q.length === 4) s.quadraticCurveTo(q[0], q[1], q[2], q[3]); else s.absarc(q[0], q[1], q[2], q[3], q[4], true); }); return s; };
  }
  // wheel-arch notch for a profile whose underside runs at height gc
  function arch(ax, r, gc) { var cy = r * .92, ar = r + .075, d = Math.asin(Math.max(-1, Math.min(1, (cy - gc) / ar))); return [[ax - ar * Math.cos(d), gc], [ax, cy, ar, Math.PI + d, -d]]; }
  function rbox(w, h, d, r) { // a box with every edge rounded
    r = Math.min(r == null ? .03 : r, w / 2 - .002, h / 2 - .002, d / 2 - .002);
    return ext("rb" + [w, h, d, r].join(), function () { var s = new T.Shape(), x = w / 2, y = h / 2; s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s; }, d, r, 50, 2, 1);
  }
  function bx(w, h, d) { var k = "bx" + [w, h, d].join(); return GEO[k] || (GEO[k] = new T.BoxGeometry(w, h, d)); }
  function cyl(r, h, n, r2) { var k = qk("cy" + [r, h, n, r2].join()); return GEO[k] || (GEO[k] = new T.CylinderGeometry(r2 == null ? r : r2, r, h, lo ? Math.max(6, n >> 1) : n)); } // axis along Y
  function sph(r) { var k = qk("sp" + r); return GEO[k] || (GEO[k] = new T.SphereGeometry(r, lo ? 8 : 14, lo ? 6 : 10)); }
  function lathe(key, pts, n) { key = qk(key); return GEO[key] || (GEO[key] = smooth(new T.LatheGeometry(pts.map(function (q) { return new T.Vector2(q[0], q[1]); }), lo ? Math.max(8, n >> 1) : n), 50)); }

  /* ---------- a bag gathers pieces by material and bakes them into one geometry each ---------- */
  function Bag() { this.b = {}; }
  Bag.prototype.raw = function (k) { return this.b[k] || (this.b[k] = { p: [], n: [] }); };
  Bag.prototype.addM = function (k, g, m) {
    var src = g.index ? (g.userData.ni || (g.userData.ni = g.toNonIndexed())) : g, p = src.attributes.position, n = src.attributes.normal, b = this.raw(k), v = tmp.v, i; tmp.n.getNormalMatrix(m);
    for (i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); b.p.push(v.x, v.y, v.z); v.fromBufferAttribute(n, i).applyMatrix3(tmp.n).normalize(); b.n.push(v.x, v.y, v.z); }
    return this;
  };
  Bag.prototype.add = function (k, g, x, y, z, rx, ry, rz, sx, sy, sz) { tmp.m.compose(tmp.v2.set(x || 0, y || 0, z || 0), tmp.q.setFromEuler(tmp.e.set(rx || 0, ry || 0, rz || 0)), tmp.s.set(sx || 1, sy || sx || 1, sz || sx || 1)); return this.addM(k, g, tmp.m); };
  Bag.prototype.pair = function (k, g, x, y, z, rx, ry, rz) { this.add(k, g, x, y, z, rx, ry, rz); return this.add(k, g, x, y, -z, -(rx || 0), -(ry || 0), rz); }; // both sides of the machine
  Bag.prototype.tri = function (k, a, b, c) { var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1, r = this.raw(k); r.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (var i = 0; i < 3; i++) r.n.push(n[0] / l, n[1] / l, n[2] / l); };
  Bag.prototype.quad = function (k, a, b, c, d) { this.tri(k, a, b, c); this.tri(k, a, c, d); return this; };
  // a flat convex panel on both flanks (windows, door seams, stripes): pts in X,Y, at ±z
  Bag.prototype.side = function (k, pts, z) {
    var area = 0, i, n = pts.length; for (i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; } if (area < 0) pts = pts.slice().reverse();
    for (i = 1; i < n - 1; i++) { this.tri(k, [pts[0][0], pts[0][1], z], [pts[i][0], pts[i][1], z], [pts[i + 1][0], pts[i + 1][1], z]); this.tri(k, [pts[0][0], pts[0][1], -z], [pts[i + 1][0], pts[i + 1][1], -z], [pts[i][0], pts[i][1], -z]); }
    return this;
  };
  Bag.prototype.rect = function (k, x0, y0, x1, y1, z) { return this.side(k, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z); };
  // a pane across the car between two profile points (windscreen, rear glass), lifted a hair off the body
  Bag.prototype.pane = function (k, x0, y0, x1, y1, hz, hz1) { var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = dy / l * .006, ny = -dx / l * .006; if (hz1 == null) hz1 = hz; if (nx * (x0 + x1) < 0 && Math.abs(nx) > Math.abs(ny)) { nx = -nx; ny = -ny; } if (ny < 0 && Math.abs(ny) >= Math.abs(nx)) { nx = -nx; ny = -ny; }
    var a = [x0 + nx, y0 + ny, hz], b = [x1 + nx, y1 + ny, hz1], c = [x1 + nx, y1 + ny, -hz1], d = [x0 + nx, y0 + ny, -hz]; this.quad(k, a, b, c, d); this.quad(k, d, c, b, a); return this; };
  Bag.prototype.tube = function (k, a, b, r, r2, n) { var d = tmp.v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length() || 1e-6; tmp.q.setFromUnitVectors(tmp.up, d.multiplyScalar(1 / l)); tmp.m.compose(tmp.v2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tmp.q, tmp.s.set(1, 1, 1)); return this.addM(k, cyl(r, +l.toFixed(3), n || 8, r2), tmp.m.clone()); };
  Bag.prototype.tubes = function (k, a, b, r) { this.tube(k, a, b, r); return this.tube(k, [a[0], a[1], -a[2]], [b[0], b[1], -b[2]], r); };
  Bag.prototype.geos = function () { var o = {}, k; for (k in this.b) { var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(this.b[k].p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(this.b[k].n, 3)); g.computeBoundingSphere(); o[k] = g; } return o; };

  /* ---------- wheels: axle along Z ---------- */
  function wheelGeo(r, w, style) {
    var key = qk("wh" + [r, w, style].join()); if (GEO[key]) return GEO[key];
    var b = new Bag(), ri = r * (style === "low" ? .72 : .62), hw = w / 2, i, HP = Math.PI / 2;
    if (style === "bike") { var tg = qk("bt" + r); b.add("rubber", GEO[tg] || (GEO[tg] = new T.TorusGeometry(r - .022, .022, lo ? 4 : 6, lo ? 14 : 24))); b.add("chrome", GEO[tg + "r"] || (GEO[tg + "r"] = new T.TorusGeometry(r - .05, .011, 4, lo ? 12 : 20))); for (i = 0; i < (lo ? 3 : 6); i++) b.add("chrome", cyl(.005, (r - .05) * 2, 4), 0, 0, 0, 0, 0, i * Math.PI / (lo ? 3 : 6)); b.add("chrome", cyl(.03, .09, 8), 0, 0, 0, HP); }
    else if (style === "skate") { b.add("white", cyl(r, w, 12), 0, 0, 0, HP); b.add("chrome", cyl(r * .45, w * 1.08, 8), 0, 0, 0, HP); }
    else {
      b.add("rubber", lathe("ty" + [r, w, ri].join(), [[ri, -hw * .9], [r * .9, -hw], [r, -hw * .55], [r, hw * .55], [r * .9, hw], [ri, hw * .9]], 18), 0, 0, 0, HP);
      b.add("rim", cyl(ri * 1.01, w * .62, 14), 0, 0, 0, HP);
      var ns = lo ? 3 : style === "moto" ? 3 : 5; for (i = 0; i < ns; i++) { var an = i * Math.PI * 2 / ns; b.add("chrome", bx(ri * .92, ri * .2, w * .8), Math.cos(an) * ri * .5, Math.sin(an) * ri * .5, 0, 0, 0, an); }
      b.add("chrome", cyl(ri * .3, w * .88, 10), 0, 0, 0, HP);
      if (!lo) { var lk = qk("lip" + ri); b.pair("chrome", GEO[lk] || (GEO[lk] = new T.TorusGeometry(ri, .014, 3, 14)), 0, 0, hw * .86); }
    }
    return (GEO[key] = b.geos());
  }
  function wheel(P, x, y, z, r, w, style, o) { P.parts.push(Object.assign({ wheel: r, geos: wheelGeo(r, w, style), pos: [x, y == null ? r : y, z] }, o || {})); }

  /* ---------- materials ---------- */
  function mat(k, make) { k = qk(k); return MAT[k] || (MAT[k] = make()); }
  function paint(col, gloss) { return mat("p" + col + (gloss || ""), function () { return lo ? new T.MeshLambertMaterial({ color: col }) : new T.MeshPhongMaterial({ color: col, shininess: gloss || 70, specular: 0x4a4a4a }); }); }
  function basic(col) { return mat("b" + col, function () { return new T.MeshBasicMaterial({ color: col }); }); }
  function tone(col, f) { var c = new T.Color(col); if (f < 1) c.multiplyScalar(f); else c.lerp(new T.Color(0xffffff), f - 1); return c.getHex(); }
  function matset(col, kind) {
    var c = typeof col === "number" ? col : parseInt(String(col || "#e5e7eb").replace("#", ""), 16), second = tone(c, .62);
    if (kind === "taxi") { c = 0xfacc15; second = 0x1f2937; } else if (kind === "bus") { c = 0xf8fafc; second = 0x15803d; } else if (kind === "keke") second = 0x1c1f26; else if (kind === "plane") second = 0xf3f4f6; else if (kind === "sport") second = 0x16181d; else if (kind === "bike" || kind === "okada" || kind === "scooter") second = tone(c, 1.55);
    return { paint: paint(c), paint2: paint(second), dark: mat("dark", function () { return new T.MeshLambertMaterial({ color: 0x1d2027 }); }), rubber: mat("rub", function () { return new T.MeshLambertMaterial({ color: 0x17181c }); }), rim: mat("rim", function () { return new T.MeshLambertMaterial({ color: 0x2c3038 }); }),
      seat: mat("seat", function () { return new T.MeshLambertMaterial({ color: 0x3a2a20 }); }), chrome: paint(0xc9ced6, 130), white: paint(0xf3f4f6, 40), glass: mat("glass", function () { return lo ? new T.MeshLambertMaterial({ color: 0x1a2733 }) : new T.MeshPhongMaterial({ color: 0x16222e, shininess: 160, specular: 0x9fc4e8 }); }),
      gls: mat("gls", function () { return new T.MeshPhongMaterial({ color: 0x9fc4dc, shininess: 160, specular: 0xffffff, transparent: true, opacity: .3, depthWrite: false }); }), green: paint(0x16a34a), amber: basic(0xf59e0b), red: basic(0xef4444), navg: basic(0x22c55e), head: basic(0xd9d4bc), tail: mat("tail", function () { return new T.MeshLambertMaterial({ color: 0x8f1d1d }); }), disc: mat("disc", function () { return new T.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: .28, depthWrite: false, side: T.DoubleSide }); }) };
  }
  function lampMats() { return V.lamp || (V.lamp = { headOff: basic(0xd9d4bc), headOn: basic(0xfffbe0), tailOff: MAT[qk("tail")], tailOn: basic(0xd42a2a), brake: basic(0xff4a3d) }); }
  function glowTex() { if (V.gt) return V.gt; var c = document.createElement("canvas"); c.width = 64; c.height = 32; var x = c.getContext("2d"), g = x.createRadialGradient(6, 16, 1, 22, 16, 40); g.addColorStop(0, "rgba(255,244,200,.85)"); g.addColorStop(.5, "rgba(255,236,170,.28)"); g.addColorStop(1, "rgba(255,230,150,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 32); return (V.gt = new T.CanvasTexture(c)); }
  function label(text, bg, fg, w, h) { var k = "lb" + text + bg; if (!MAT[k]) { var c = document.createElement("canvas"); c.width = 256; c.height = Math.max(16, Math.round(256 * h / w)); var x = c.getContext("2d"), t; var paint = function () { var s = Z && Z.resolveText ? Z.resolveText(text) : text; x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; var fs = c.height * .8; do { x.font = "900 " + fs + "px system-ui, Arial, sans-serif"; fs -= 2; } while (x.measureText(s).width > 236 && fs > 8); x.fillText(s, 128, c.height / 2 + 1); if (t) t.needsUpdate = true; };
      paint(); if (text.indexOf("{{") >= 0 && Z && Z.onConfig) Z.onConfig(paint); /* liveries with the game's initials follow a rename */ t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; MAT[k] = new T.MeshBasicMaterial({ map: t }); } var gk = "lbg" + w + "," + h; return new T.Mesh(GEO[gk] || (GEO[gk] = new T.PlaneGeometry(w, h)), MAT[k]); }

  /* ---------- four-wheelers ---------- */
  function carProto(kind) {
    var sp = S.VEH[kind === "sport" ? "sport" : "car"], L = kind === "bus" ? 4.9 : sp.len, W = sp.wid, h = L / 2, b = new Bag(), P = { parts: [], len: L, wid: W }, low = kind === "sport", pick = kind === "pickup", bus = kind === "bus";
    var r = low ? .34 : pick ? .37 : bus ? .36 : .33, tw = low ? .3 : .24, gc = low ? .15 : pick ? .3 : bus ? .3 : .21, ax = bus ? h * .6 : L * .31, bw = W, zs = W / 2 + .004, top, cab, cw, cz, belt, roof, pil, int;
    function lower(t) { return path([[-h + .14, gc]].concat(arch(-ax, r, gc), arch(ax, r, gc), [[h - .14, gc]], t, [[-h, gc, -h + .14, gc]])); }
    if (low) {
      belt = .7; top = [[h, gc, h, .3], [h, .47, h - .45, .53], [1.1, .62, .55, .68], [-1.5, .76], [-h, .78, -h, .56]];
      cab = 1; cw = W * .78; roof = [[.06, 1.05], [-.25, 1.14, -.55, 1.11], [-.85, 1.07, -1.05, 1.01], [-1.0, .96], [-.55, 1.05], [-.25, 1.08, .0, 1.0]]; pil = [[.82, .68, .04, 1.05], [-1.0, 1.0, -1.72, .76]]; int = { seat: -.2, dash: .62 };
    } else if (pick) {
      belt = .94; top = [[h, gc, h, .5], [h, .82, h - .3, .86], [1.5, .94, .95, .96], [-h + .1, .96], [-h, .96, -h, .86]];
      cab = 1; cw = W * .86; roof = [[.54, 1.5], [.42, 1.6, .22, 1.6], [-.5, 1.6], [-.66, 1.6, -.66, 1.46], [-.58, 1.46], [-.5, 1.54], [.22, 1.54], [.4, 1.54, .5, 1.45]]; pil = [[1.02, .92, .52, 1.52], [-.62, .92, -.62, 1.5]]; int = { seat: .2, dash: .88 };
    } else if (bus) {
      belt = 1.1; top = [[h, gc, h, .5], [h, belt], [-h, belt], [-h, .5]]; cab = null; // the body stops at the windows: above it are pillars, clear glass and a roof, so people inside show
    } else {
      belt = .84; top = [[h, gc, h, .42], [h, .68, h - .28, .72], [1.3, .82, .82, .85], [-1.4, .87], [-h, .87, -h, .64]];
      cab = 1; cw = W * .84; roof = [[.36, 1.29], [.15, 1.4, -.15, 1.41], [-.72, 1.39], [-1.0, 1.36, -1.17, 1.23], [-1.1, 1.2], [-.95, 1.3, -.72, 1.33], [-.15, 1.35], [.12, 1.34, .3, 1.24]]; pil = [[1.0, .82, .34, 1.3], [-.14, .84, -.14, 1.36], [-1.14, 1.24, -1.6, .86]]; int = { seat: .1, dash: .8, rear: -1.1 };
    }
    b.add("paint", ext("lo" + kind, lower(top), bw, bus ? .12 : .09));
    b.add("dark", rbox(L * .78, .26, W * .7, .04), 0, gc + .17, 0); // floor pan, so you cannot see through the arches
    if (cab) { cz = cw / 2 + .004; // an open greenhouse: roof, pillars and clear glass, so whoever is driving can be seen
      b.add("paint2", ext("roof" + kind, path(roof), cw, .06)); pil.forEach(function (q) { b.tubes("paint2", [q[0], q[1], cw / 2 - .04], [q[2], q[3], cw / 2 - .05], .04); });
      var sx0 = int.seat, sy0 = belt - .1; b.pair("seat", rbox(.13, .52, .44, .05), sx0 - .3, sy0 + .22, W * .21, 0, 0, .12); b.pair("seat", rbox(.1, .16, .26, .04), sx0 - .34, sy0 + .58, W * .21);
      if (int.rear != null) b.add("seat", rbox(.14, .46, cw * .86, .05), int.rear, sy0 + .2, 0, 0, 0, .14);
      b.add("dark", rbox(.3, .14, cw * .9, .05), int.dash, belt + .02, 0); var wk = qk("swh"), swb = new Bag(); swb.add("dark", GEO[wk] || (GEO[wk] = new T.TorusGeometry(.15, .022, 5, lo ? 8 : 14)), 0, 0, 0, 0, Math.PI / 2, 0); swb.add("dark", bx(.02, .26, .03), 0, 0, 0); P.parts.push({ sw: true, geos: swb.geos(), pos: [int.dash - .2, belt + .16, -W * .21] }); b.tube("dark", [int.dash - .2, belt + .16, -W * .21], [int.dash, belt + .04, -W * .21], .02); } // the steering wheel is its own part: it turns with the steering
    // glass
    if (low) { b.side("gls", [[.6, .72], [.0, 1.02], [-.38, 1.07], [-.38, .72]], cz); b.side("gls", [[-.46, .72], [-.46, 1.07], [-.62, 1.05], [-1.12, .92], [-1.36, .78], [-1.36, .72]], cz); b.pane("gls", .78, .7, .08, 1.04, cw * .4, cw * .37); b.pane("gls", -.7, 1.07, -1.6, .8, cw * .34, cw * .38); }
    else if (pick) { b.side("gls", [[.86, .98], [.5, 1.44], [-.5, 1.5], [-.5, .98]], cz); b.pane("gls", .98, .96, .56, 1.48, cw * .42, cw * .4); b.pane("gls", -.645, 1.05, -.645, 1.48, cw * .38); }
    else if (bus) { for (var i = 0; i < 4; i++) b.rect("gls", -h + .32 + i * 1.04, belt + .04, -h + 1.22 + i * 1.04, 2.08, zs); b.pane("gls", h - .012, belt + .02, h - .29, 2.1, W * .45, W * .43);
      b.add("paint", rbox(L - .04, .12, W, .05), 0, 2.18, 0); for (i = 0; i < 5; i++) b.tubes("paint", [-h + .27 + i * 1.04, belt, W / 2 - .05], [-h + .27 + i * 1.04, 2.14, W / 2 - .05], .045); b.tubes("paint", [h - .02, belt, W / 2 - .06], [h - .3, 2.14, W / 2 - .06], .045);
      b.add("paint", rbox(.08, 1.06, W, .03), -h + .04, belt + .52, 0); b.pane("glass", -h - .01, 1.4, -h - .01, 1.95, W * .36); // rear wall and its window
      SEATS.bus.concat([{ seat: [1.55, .78], side: -.5 }]).forEach(function (q) { var z = q.side * (W / .5 / 3.8); b.add("seat", rbox(.42, .1, .44, .03), q.seat[0], .66, q.side); b.add("seat", rbox(.08, .5, .44, .03), q.seat[0] - .24, .95, q.side); void z; }); // a seat under every anchor
      b.add("dark", rbox(.3, .22, W * .9, .05), h - .22, belt + .02, 0); var bsw = new Bag(), bk = qk("swh"); bsw.add("dark", GEO[bk] || (GEO[bk] = new T.TorusGeometry(.15, .022, 5, lo ? 8 : 14)), 0, 0, 0, 0, Math.PI / 2, 0); bsw.add("dark", bx(.02, .26, .03), 0, 0, 0); P.parts.push({ sw: true, geos: bsw.geos(), pos: [1.95, 1.24, -.5] }); b.tube("dark", [1.95, 1.24, -.5], [2.2, 1.08, -.5], .02); b.rect("paint2", -h + .2, .86, h - .2, 1.04, zs); b.rect("dark", h - 1.02, .42, h - .98, 1.95, zs); b.rect("dark", h - .34, .42, h - .3, 1.95, zs); }
    else { b.side("gls", [[.84, .88], [.38, 1.23], [-.1, 1.31], [-.1, .88]], cz); b.side("gls", [[-.18, .88], [-.18, 1.31], [-.72, 1.3], [-1.0, 1.24], [-1.42, .9], [-1.42, .88]], cz); b.pane("gls", .97, .84, .37, 1.3, cw * .43, cw * .4); b.pane("gls", -1.18, 1.24, -1.58, .9, cw * .38, cw * .41); }
    // seams, sills, handles, trim
    if (!bus) { var d0 = low ? .7 : pick ? .9 : .86, d1 = low ? -.42 : pick ? -.6 : -.14, sy = gc + .14; b.rect("dark", d0, sy, d0 + .018, belt - .06, zs); b.rect("dark", d1, sy, d1 + .018, belt - .04, zs); if (!low && !pick) b.rect("dark", -1.12, sy + .3, -1.102, belt - .04, zs);
      b.rect("dark", -ax + r + .12, gc + .01, ax - r - .12, gc + .1, zs); b.rect("chrome", d1 + .08, belt - .17, d1 + .26, belt - .14, zs + .002); if (!low && !pick) b.rect("chrome", -1.04, belt - .17, -.86, belt - .14, zs + .002);
      b.rect(low ? "white" : kind === "taxi" ? "dark" : "chrome", -h + .5, low ? .36 : belt - .08, h - (low ? .9 : .6), low ? .41 : belt - .06, zs + .001);
      b.pair("paint", rbox(.11, .09, .17, .03), low ? .62 : pick ? .9 : .82, belt + (low ? .04 : .08), W / 2 + .06); }
    // nose and tail
    var ny = low ? .4 : pick ? .62 : bus ? .72 : .55, hy = low ? .49 : pick ? .74 : bus ? .78 : .63, ty = low ? .62 : pick ? .8 : bus ? .9 : .7;
    b.add("dark", rbox(.1, low ? .1 : .17, W * (bus ? .5 : .46), .03), h - .03, ny - .08, 0); if (!lo && !low) for (var s = 0; s < 3; s++) b.add("chrome", rbox(.02, .014, W * .42, .005), h + .022, ny - .13 + s * .05, 0);
    b.add("dark", rbox(.16, .15, W * .98, .05), h - .05, gc + .11, 0); b.add("dark", rbox(.16, .15, W * .98, .05), -h + .05, gc + .11, 0);
    b.pair("head", rbox(.1, low ? .08 : .14, low ? .44 : .38, .03), h - (low ? .2 : .055), hy, W * .32); b.pair("amber", rbox(.06, .05, .12, .02), h - .05, hy - (low ? .09 : .13), W * .4);
    b.pair("tail", rbox(.09, .11, low ? .56 : .36, .03), -h + .035, ty, W * (low ? .28 : .34)); b.add("white", rbox(.02, .11, .42, .008), h + .028, gc + .12, 0); b.add("white", rbox(.02, .11, .42, .008), -h - .028, gc + .12, 0);
    b.tube("chrome", [-h + .25, gc + .03, W * .28], [-h - .04, gc + .03, W * .28], .035); if (low) b.tube("chrome", [-h + .25, gc + .03, -W * .28], [-h - .04, gc + .03, -W * .28], .035);
    if (low) { b.add("dark", rbox(.3, .035, W * .96, .015), -h + .22, 1.0, 0); b.pair("dark", rbox(.06, .24, .05, .015), -h + .24, .88, W * .36); b.side("dark", [[-.9, .34], [-.9, .56], [-.62, .5], [-.62, .34]], zs + .001); b.add("dark", rbox(.3, .03, W * .9, .01), h - .12, gc + .02, 0); }
    if (pick) { b.add("dark", rbox(1.42, .02, W * .78, .008), -1.44, .968, 0); b.pair("paint", rbox(1.5, .16, .09, .03), -1.42, 1.03, W / 2 - .05); b.add("paint", rbox(.09, .16, W * .98, .03), -h + .05, 1.03, 0); b.tubes("chrome", [-.76, .96, W * .4], [-.76, 1.58, W * .4], .03); b.tube("chrome", [-.76, 1.58, W * .4], [-.76, 1.58, -W * .4], .03); }
    if (kind === "taxi") { b.add("amber", rbox(.34, .13, .2, .04), -.2, 1.48, 0); b.rect("dark", -1.1, .5, .86, .56, zs + .001); }
    if (bus) { b.add("dark", rbox(.5, .08, W * .5, .03), -.4, 2.26, 0); b.pair("paint", rbox(.12, .2, .1, .03), h - .1, 1.5, W / 2 + .1); P.text = { t: "{{GAME_INITIALS}} SHUTTLE", bg: "#f8fafc", fg: "#15803d", w: 2.3, h: .26, x: -.3, y: .62, z: zs + .003 }; }
    P.parts.push({ body: true, geos: b.geos() });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { wheel(P, ax * q[0], r, (W / 2 - tw / 2 + .03) * q[1], r, tw, low ? "low" : "car", { front: q[0] > 0 }); });
    P.base = ax * 2; P.lights = { x: h, y: hy }; P.motor = true;
    P.anc = low ? { roof: CABIN.sport.roof, seat: [-.3, .31], side: -.4, scale: .54, grip: [.22, .8, .13], foot: [.42, .3, .1], lean: .3, bend: -.05, pillion: { seat: [-.3, .34], side: .4, lean: .3 } }
      : pick ? { roof: CABIN.pickup.roof, seat: [.18, .5], side: -.42, scale: .72, grip: [.68, 1.1, .15], foot: [.85, .45, .1], lean: .1, pillion: { seat: [.18, .5], side: .42, lean: .1 } }
      : bus ? { roof: CABIN.bus.roof, seat: [1.55, .78], side: -.5, scale: .8, grip: [1.98, 1.28, .17], foot: [2.05, .72, .1], lean: .02, pillion: { seat: [.4, .78], side: .5, lean: .05 } }
      : { roof: CABIN.car.roof, seat: [.14, .42], side: -.4, scale: .68, grip: [.6, 1.0, .14], foot: [.8, .36, .1], lean: .13, pillion: { seat: [.14, .42], side: .4, lean: .13 } };
    P.anc.door = W / 2 + .7;
    if (!bus) { var dA = low ? .7 : pick ? .9 : .86, dB = low ? -.42 : pick ? -.6 : -.14, dy0 = gc + .16, dy1 = belt - .07, db = new Bag(); db.add("paint", rbox(dA - dB - .03, dy1 - dy0, .03, .012), -(dA - dB) / 2, (dy1 - dy0) / 2, 0); db.add("chrome", rbox(.16, .03, .02, .008), -(dA - dB) + .2, dy1 - dy0 - .1, -.02);
      P.parts.push({ door: true, geos: db.geos(), pos: [dA, dy0, -(W / 2 + .012)] }); }
    return P;
  }

  /* ---------- keke ---------- */
  function kekeProto() {
    var sp = S.VEH.keke, W = sp.wid, b = new Bag(), P = { parts: [], len: sp.len, wid: W, motor: true, base: 1.84 }, gc = .22, r = .26, zs = W / 2 + .004;
    b.add("paint", ext("ktub", path([[-1.26, gc]].concat(arch(-.84, r, gc), [[.42, gc], [.42, .52], [-.18, .52], [-.44, .97], [-1.3, 1.0], [-1.42, 1.0, -1.42, .82], [-1.42, gc, -1.26, gc]])), W, .07));
    b.add("paint", ext("knose", path([[.3, .3]].concat(arch(1.0, r, .3), [[1.36, .3], [1.44, .34, 1.42, .62], [1.36, .98, 1.0, 1.02], [.46, 1.02], [.3, .6]])), .66, .12));
    b.add("dark", ext("kroof", path([[.8, 1.72], [-.3, 1.94, -1.4, 1.76], [-1.44, 1.67], [-.3, 1.85, .76, 1.65]]), W * 1.06, .03));
    b.pane("gls", .99, 1.03, .66, 1.68, .34, .56); b.tubes("dark", [1.0, 1.0, .33], [.64, 1.7, .58], .025); b.tubes("dark", [-1.3, .98, W / 2 - .05], [-1.34, 1.72, W / 2 - .03], .025); b.tubes("dark", [-.3, .52, W / 2 - .05], [-.32, 1.86, W / 2 - .03], .02);
    b.quad("dark", [-1.39, 1.0, zs - .06], [-1.39, 1.0, -zs + .06], [-1.39, 1.74, -zs + .04], [-1.39, 1.74, zs - .04]); b.quad("glass", [-1.4, 1.3, .36], [-1.4, 1.3, -.36], [-1.4, 1.58, -.36], [-1.4, 1.58, .36]);
    b.add("paint2", rbox(.07, .62, W * .92, .03), -.24, .82, 0); b.add("seat", rbox(.4, .12, .46, .04), .0, .58, 0); b.add("seat", rbox(.46, .14, W * .82, .05), -.74, .66, 0); b.add("seat", rbox(.12, .4, W * .82, .05), -1.14, .9, 0);
    b.rect("green", -1.3, .78, -.5, .88, zs); b.rect("dark", -1.2, gc + .02, .36, gc + .1, zs);
    b.tube("dark", [.86, .98, 0], [.7, 1.16, 0], .025); b.tube("dark", [.7, 1.16, .3], [.7, 1.16, -.3], .02); b.pair("rubber", cyl(.03, .1, 6), .7, 1.16, .3, Math.PI / 2);
    b.add("head", sph(.1), 1.4, .74, 0, 0, 0, 0, .6, 1, 1); b.pair("amber", sph(.045), 1.3, .92, .26); b.pair("tail", rbox(.06, .12, .16, .02), -1.42, .78, W * .38); b.add("dark", rbox(.1, .1, W * .96, .04), -1.42, gc + .1, 0); b.add("white", rbox(.02, .1, .34, .008), -1.475, .56, 0);
    b.add("paint", rbox(.5, .05, .2, .02), 1.0, .6, 0);
    P.parts.push({ body: true, geos: b.geos() });
    wheel(P, 1.0, r, 0, r, .14, "moto", { front: true }); wheel(P, -.84, r, W * .46 - .03, r, .15, "moto"); wheel(P, -.84, r, -W * .46 + .03, r, .15, "moto");
    P.lights = { x: 1.42, y: .74 }; P.anc = { roof: CABIN.keke.roof, seat: [.06, .76], scale: .78, grip: [.7, 1.16, .28], foot: [.52, .5, .12], lean: -.1, maxLean: -.4, pillion: { roof: CABIN.keke.roofBack, seat: [-.72, .82], side: .3, lean: .06 }, door: W / 2 + .6 }; /* roof: the ceiling over each seat, so heads (and hair) stay inside */ return P;
  }

  /* ---------- two-wheelers: the fork, bars and front wheel turn together ---------- */
  function bikeProto() {
    var b = new Bag(), f = new Bag(), c = new Bag(), P = { parts: [], len: 1.8, wid: .55, two: true, seat: .04, base: 1.3 }, r = .36, A = [-.65, r, 0], B = [-.1, .3, 0], Sx = [-.28, .86, 0], H = [.42, .9, 0], Hb = [.46, .72, 0];
    b.tube("paint", B, Sx, .022); b.tube("paint", Sx, H, .022); b.tube("paint", B, Hb, .026); b.tube("paint", H, Hb, .028); b.tubes("paint", [A[0], A[1], .05], [B[0], B[1], .04], .013); b.tubes("paint", [A[0], A[1], .05], [Sx[0], Sx[1] - .06, .02], .012);
    b.tube("chrome", Sx, [-.31, .94, 0], .014); b.add("dark", rbox(.27, .05, .15, .022), -.31, .96, 0, 0, 0, .04); b.add("chrome", rbox(.34, .015, .16, .006), -.66, .76, 0); b.tubes("chrome", [-.66, .75, .07], [A[0], A[1], .06], .006);
    b.add("paint2", rbox(.5, .012, .06, .005), -.62, r + .385, 0, 0, 0, .1);
    P.parts.push({ body: true, geos: b.geos() });
    f.tubes("paint", [.04, -.18, .05], [.23, -.54, .055], .014); f.tube("chrome", [0, 0, 0], [-.06, .26, 0], .016); f.tube("chrome", [-.06, .26, .27], [-.06, .26, -.27], .013); f.pair("rubber", cyl(.02, .1, 6), -.06, .26, .25, Math.PI / 2); f.add("head", sph(.035), .06, .02, 0);
    P.parts.push({ steer: true, geos: f.geos(), pos: H.slice() }); wheel(P, .65 - H[0], r - H[1], 0, r, .04, "bike", { inSteer: true, front: true });
    c.add("chrome", cyl(.085, .012, 12), 0, 0, .05, Math.PI / 2); c.tube("chrome", [0, 0, .06], [.16, 0, .06], .01); c.tube("chrome", [0, 0, -.06], [-.16, 0, -.06], .01); c.add("dark", rbox(.09, .02, .08, .008), .16, 0, .11); c.add("dark", rbox(.09, .02, .08, .008), -.16, 0, -.11);
    P.parts.push({ crank: true, geos: c.geos(), pos: B.slice() }); wheel(P, -.65, r, 0, r, .04, "bike"); P.anc = { seat: [-.31, 1.09], grip: [.36, 1.16, .25], pedal: { c: [B[0], B[1]], r: .16 }, lean: -.26, maxLean: -.7, pillion: { seat: [-.66, .88], foot: [-.6, .42, .1], lean: -.05 } }; return P;
  }
  function scooterProto() {
    var b = new Bag(), f = new Bag(), P = { parts: [], len: 1.7, wid: .6, two: true, seat: -.1, motor: true, base: 1.2 }, r = .23, H = [.44, .9, 0];
    b.add("paint", ext("scr", path([[-.12, .2], [-.12, .6], [-.16, .74, -.3, .75], [-.8, .73], [-.98, .7, -.92, .5], [-.89, .44]].concat([[-.6, r * .92, r + .075, 0.75, Math.PI - .25]], [[-.34, .2]])), .36, .1));
    b.add("dark", rbox(.56, .06, .32, .025), .12, .2, 0); b.add("paint", ext("scs", path([[.32, .17], [.46, .17], [.66, .5, .52, .9], [.42, .9], [.52, .5, .36, .24]]), .42, .05));
    b.add("seat", ext("scseat", path([[-.2, .75], [-.2, .82, -.3, .85], [-.74, .86], [-.84, .86, -.86, .76]]), .28, .05)); b.add("tail", rbox(.05, .08, .18, .02), -.95, .62, 0); b.add("chrome", rbox(.3, .02, .2, .008), -.82, .88, 0);
    b.tube("chrome", [-.5, .24, .19], [-.95, .3, .19], .04); b.add("dark", rbox(.2, .16, .12, .04), -.5, .3, .16);
    P.parts.push({ body: true, geos: b.geos() });
    f.tubes("dark", [.03, -.1, .09], [.16, -.67, .09], .02); f.add("paint", rbox(.36, .06, .15, .028), .16, -.38, 0, 0, 0, -.05); f.tube("dark", [0, -.1, 0], [-.07, .3, 0], .022); f.add("paint", rbox(.16, .14, .24, .05), -.04, .22, 0); f.add("head", sph(.07), .03, .22, 0, 0, 0, 0, .5, 1, 1);
    f.tube("dark", [-.08, .32, .3], [-.08, .32, -.3], .015); f.pair("rubber", cyl(.022, .1, 6), -.08, .32, .27, Math.PI / 2); f.pair("chrome", cyl(.05, .012, 10), -.08, .5, .24, 0, 0, Math.PI / 2); f.tubes("chrome", [-.08, .32, .22], [-.08, .5, .24], .006);
    P.parts.push({ steer: true, geos: f.geos(), pos: H.slice() }); wheel(P, .6 - H[0], r - H[1], 0, r, .13, "moto", { inSteer: true, front: true }); wheel(P, -.6, r, 0, r, .14, "moto");
    P.lights = { x: .55, y: 1.1, one: true }; P.anc = { seat: [-.36, .97], grip: [.36, 1.22, .27], foot: [.12, .24, .09], lean: -.06, maxLean: -.45, pillion: { seat: [-.7, .97], foot: [-.18, .24, .12], lean: -.02 } }; return P;
  }
  function okadaProto() {
    var b = new Bag(), f = new Bag(), P = { parts: [], len: 2.1, wid: .8, two: true, seat: -.1, motor: true, base: 1.5 }, r = .3, ax = .756, H = [.5, .98, 0];
    b.tube("dark", H, [.16, .42, 0], .028); b.tube("dark", H, [-.3, .78, 0], .028); b.tube("dark", [-.3, .78, 0], [-.92, .84, 0], .022); b.tubes("dark", [-.08, .36, .07], [-ax, r, .08], .022); b.tubes("chrome", [-.5, .78, .11], [-.72, .36, .11], .022);
    b.add("paint", ext("oktank", path([[.44, .82], [.46, 1.0, .2, 1.04], [-.05, 1.05, -.18, .92], [-.2, .82]]), .32, .12)); b.add("seat", ext("okseat2", path([[-.16, .82], [-.18, .94, -.3, .93], [-1.0, .93], [-1.12, .93, -1.12, .84], [-1.1, .82]]), .29, .06)); // a long bench: room for the rider and two behind
    b.tubes("chrome", [-.9, .98, .16], [-1.18, .98, .14], .016); b.tube("chrome", [-1.18, .98, .14], [-1.18, .98, -.14], .016); b.tubes("chrome", [-1.0, .84, .15], [-1.12, .97, .15], .014); // grab rail
    b.tubes("chrome", [-.48, .36, .13], [-.48, .36, .24], .016); b.tubes("chrome", [-.8, .38, .13], [-.8, .38, .25], .016); // pillion foot pegs
    b.add("paint", rbox(.32, .17, .27, .05), -.36, .7, 0); b.add("dark", rbox(.38, .3, .3, .06), .02, .46, 0); b.add("chrome", rbox(.17, .2, .22, .03), .1, .66, 0, 0, 0, -.2); b.pair("chrome", cyl(.09, .04, 10), -.02, .44, .16, Math.PI / 2);
    b.tube("chrome", [.14, .4, .17], [-.35, .3, .2], .028); b.tube("chrome", [-.35, .3, .2], [-.98, .44, .21], .05, .058);
    b.add("paint", ext("okfr", path([[-.52, .66], [-.8, .74, -1.06, .6], [-1.07, .56], [-.8, .68, -.52, .61]]), .17, .03)); b.add("tail", rbox(.06, .08, .14, .02), -1.02, .72, 0); b.add("white", rbox(.02, .11, .2, .006), -1.08, .56, 0);
    b.add("chrome", rbox(.3, .015, .24, .006), -.92, .95, 0); b.tubes("chrome", [.0, .3, .13], [-.1, .28, .2], .012);
    P.parts.push({ body: true, geos: b.geos() });
    f.tubes("chrome", [.0, .04, .095], [ax - H[0], r - H[1], .095], .026); f.add("paint", ext("okff", path([[.5, -.34], [.3, -.26, .06, -.4], [.05, -.44], [.3, -.31, .5, -.39]]), .15, .03));
    f.add("dark", sph(.105), .1, -.04, 0, 0, 0, 0, .9, 1, 1); f.add("head", sph(.09), .15, -.04, 0, 0, 0, 0, .6, 1, 1); f.tube("chrome", [-.02, .04, .1], [-.02, .04, -.1], .02); f.tubes("chrome", [-.02, .04, .09], [-.14, .2, .34], .014); f.pair("rubber", cyl(.024, .12, 6), -.14, .2, .36, Math.PI / 2);
    f.tubes("chrome", [-.11, .17, .26], [-.1, .38, .3], .006); f.pair("chrome", cyl(.055, .012, 10), -.1, .39, .3, 0, 0, Math.PI / 2); f.pair("amber", sph(.03), .08, -.12, .14);
    P.parts.push({ steer: true, geos: f.geos(), pos: H.slice() }); wheel(P, ax - H[0], r - H[1], 0, r, .12, "moto", { inSteer: true, front: true }); wheel(P, -ax, r, 0, r, .15, "moto");
    P.lights = { x: .7, y: .94, one: true }; P.anc = { seat: [-.4, 1.0], grip: [.36, 1.18, .36], foot: [-.03, .3, .19], lean: -.18, maxLean: -.6, tuck: .008, pillion: SEATS.okada[0] }; return P;
  }
  function skateProto() {
    var b = new Bag(), P = { parts: [], len: 1.0, wid: .45, two: true, seat: .2 };
    b.add("paint", ext("deck", path([[-.5, .2], [-.42, .145, -.34, .14], [.34, .14], [.42, .145, .5, .2], [.5, .222], [.42, .168, .34, .164], [-.34, .164], [-.42, .168, -.5, .222]]), .25, .04, 60));
    b.add("dark", rbox(.6, .006, .2, .002), 0, .167, 0); b.add("chrome", rbox(.07, .05, .2, .015), .3, .112, 0); b.add("chrome", rbox(.07, .05, .2, .015), -.3, .112, 0);
    P.parts.push({ body: true, geos: b.geos() }); [[.3, .1], [.3, -.1], [-.3, .1], [-.3, -.1]].forEach(function (q) { wheel(P, q[0], .055, q[1] * 1.15, .055, .045, "skate"); }); P.anc = { stand: 1, seat: [0, .167] }; return P;
  }

  /* ---------- light aircraft ---------- */
  function planeProto() {
    var sp = S.VEH.plane, W = sp.wid, b = new Bag(), p = new Bag(), P = { parts: [], len: sp.len, wid: W, motor: true, plane: true }, cy = 1.3, HP = Math.PI / 2;
    var foil = path([[.75, 0], [.62, .13, .1, .12], [-.75, .02], [-.75, -.012], [.4, -.07, .75, 0]]);
    b.add("paint", lathe("fus", [[.0, -3.7], [.09, -3.6], [.22, -3.0], [.44, -1.5], [.6, 0], [.64, 1.2], [.6, 2.3]], 16), 0, cy, 0, 0, 0, -HP, 1.06, 1, .9);
    b.add("paint2", lathe("cowl", [[.61, 2.28], [.6, 2.6], [.5, 3.02], [.32, 3.18], [0, 3.2]], 16), 0, cy, 0, 0, 0, -HP, 1.06, 1, .9);
    b.add("gls", sph(.6), .95, cy + .5, 0, 0, 0, 0, 1.7, .68, .86);
    b.add("paint2", ext("wing", foil, W, .05), .7, cy + .86, 0); b.pair("paint", rbox(1.5, .14, .5, .05), .7, cy + .87, W / 2 - .2); b.add("red", sph(.06), .7, cy + .9, -W / 2); b.add("navg", sph(.06), .7, cy + .9, W / 2);
    b.tubes("paint2", [.9, cy + .82, 2.3], [.95, cy - .3, .5], .04); b.add("paint2", ext("tailp", foil, 3.3, .04), -3.25, cy + .16, 0, 0, 0, 0, .58, .7, 1);
    b.add("paint", ext("fin", path([[-2.5, cy + .2], [-3.2, cy + 1.3], [-3.5, cy + 1.42, -3.72, cy + 1.3], [-3.68, cy + .1]]), .09, .04));
    b.tubes("chrome", [1.2, cy - .35, .4], [1.2, .34, .9], .04); b.pair("paint", sph(.36), 1.16, .4, .9, 0, 0, 0, 1.25, .8, .5); b.tube("chrome", [-2.9, cy - .15, 0], [-3.15, .22, 0], .025);
    b.rect("paint2", -2.6, cy - .04, 2.2, cy + .04, .625);
    P.parts.push({ body: true, geos: b.geos() });
    p.add("chrome", cyl(.16, .34, 12, .02), .1, 0, 0, 0, 0, -HP); p.add("dark", rbox(.05, 2.3, .17, .02), 0, 0, 0, .25);
    P.parts.push({ prop: true, geos: p.geos(), pos: [3.42, cy, 0] });
    wheel(P, 1.2, .3, .9, .3, .16, "moto", { onBody: true }); wheel(P, 1.2, .3, -.9, .3, .16, "moto", { onBody: true }); wheel(P, -3.15, .2, 0, .2, .1, "moto", { onBody: true });
    P.text = { t: "5N-{{GAME_INITIALS}}", bg: "#f3f4f6", fg: "#111827", w: 1.3, h: .22, x: -1.5, y: cy + .22, z: .505, tilt: .07 }; P.anc = { roof: CABIN.plane.roof, seat: [.82, 1.04], scale: .6, grip: [1.28, 1.36, .12], foot: [1.45, .95, .1], lean: .1 }; return P;
  }

  function proto(kind) {
    var k = qk(kind); if (PROTO[k]) return PROTO[k];
    var P = kind === "keke" ? kekeProto() : kind === "bike" ? bikeProto() : kind === "scooter" ? scooterProto() : kind === "okada" ? okadaProto() : kind === "skate" ? skateProto() : kind === "plane" ? planeProto() : carProto(kind);
    P.tris = 0; P.parts.forEach(function (pt) { for (var m in pt.geos) P.tris += pt.geos[m].attributes.position.count / 3; });
    return (PROTO[k] = P);
  }
  V.tris = function (kind) { return T ? proto(kind).tris : 0; };

  /* ---------- build one vehicle ---------- */
  V.build = function (three, R, type, col, kind, shade) {
    boot(three, R); kind = kind && V.kinds.indexOf(kind) >= 0 ? kind : type;
    var P = proto(kind), ms = matset(col, kind), g = new T.Group(), body = new T.Group(), u = g.userData, steer = null; lampMats();
    g.rotation.order = "YXZ"; // heading first, then lean about the machine's own length (the default order leaned it about the world X axis)
    u.body = body; u.wheels = []; u.type = type; u.kind = kind; u.two = !!P.two; u.base = P.base || 0; u.motor = !!P.motor; u.plane = !!P.plane; u.heads = []; u.tails = []; if (P.two) u.seat = P.seat; u.anc = P.anc ? Object.assign({}, P.anc, { crankA: 0 }) : null; g.add(body);
    function fill(grp, geos) { for (var k in geos) { var m = new T.Mesh(geos[k], ms[k] || ms.dark); if (k === "head") u.heads.push(m); else if (k === "tail") u.tails.push(m); else if (k === "glass" || k === "gls" || k === "disc") m.userData.noShade = 1; grp.add(m); } return grp; }
    P.parts.forEach(function (pt) {
      if (pt.body) return fill(body, pt.geos);
      var grp = new T.Group(); grp.position.set(pt.pos[0], pt.pos[1], pt.pos[2]);
      if (pt.steer) { steer = u.steer = fill(grp, pt.geos); g.add(grp); }
      else if (pt.crank) { u.crank = fill(grp, pt.geos); body.add(grp); }
      else if (pt.prop) { u.prop = fill(grp, pt.geos); var d = new T.Mesh(GEO.pdisc || (GEO.pdisc = new T.CircleGeometry(1.15, 20)), ms.disc); d.rotation.y = Math.PI / 2; d.visible = false; u.propDisc = d; var hold = new T.Group(); hold.position.copy(grp.position); grp.position.set(0, 0, 0); hold.add(grp); hold.add(d); body.add(hold); }
      else if (pt.door) { u.door = fill(grp, pt.geos); body.add(grp); }
      else if (pt.sw) { u.sw = fill(grp, pt.geos); body.add(grp); if (u.anc) u.anc.wheel = { c: pt.pos.slice(), r: .15 }; } // anc.wheel and anc.wheelA: where the hands go (for the animation worker)
      else if (pt.wheel) { var spin = fill(new T.Group(), pt.geos); grp.add(spin); (pt.inSteer ? steer : pt.onBody ? body : g).add(grp); u.wheels.push({ pivot: grp, spin: spin, r: pt.wheel, front: !!pt.front && !pt.inSteer, rear: !pt.front && pt.pos[0] < 0, x: pt.pos[0], z: pt.pos[2] }); }
    });
    if (P.text && !lo) [1, -1].forEach(function (sd) { var m = label(P.text.t, P.text.bg, P.text.fg, P.text.w, P.text.h); m.position.set(P.text.x, P.text.y, P.text.z * sd); if (sd < 0) m.rotation.y = Math.PI; if (P.text.tilt) m.rotation.z = P.text.tilt * sd; body.add(m); });
    if (P.lights && !lo) { var w = P.lights.one ? 2.4 : 3.6, gl = new T.Mesh(GEO["glow" + w] || (GEO["glow" + w] = new T.PlaneGeometry(8, w)), MAT.glow || (MAT.glow = new T.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .55 }))); gl.rotation.x = -Math.PI / 2; gl.position.set(P.lights.x + 3.9, .09, 0); gl.visible = false; g.add(gl); u.glow = gl; }
    var sh = new T.Mesh(GEO["bs" + kind] || (GEO["bs" + kind] = new T.BoxGeometry(P.len * 1.05, .02, Math.max(.5, (P.plane ? 1.6 : P.wid) * 1.1))), MAT.blob || (MAT.blob = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false }))); sh.position.y = .07; g.add(sh); u.shadow = sh;
    if (shade) shade(g); g.traverse(function (o) { if (o.userData.noShade) o.castShadow = false; });
    return g;
  };

  /* ---------- motion: place it, then lean, squat, steer and spin from how it is actually moving ---------- */
  var SK = null;
  function skidInit(scene) {
    var n = 420, g = new T.BufferGeometry(), pos = new Float32Array(n * 18), col = new Float32Array(n * 24); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("color", new T.BufferAttribute(col, 4));
    var mesh = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x0c0c0e, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); mesh.frustumCulled = false; mesh.renderOrder = 2; scene.add(mesh);
    SK = { n: n, i: 0, pos: pos, col: col, g: g, a: new Float32Array(n), t: 0, live: 0 };
  }
  function skidSeg(ax, ay, bx, by, y, w, alpha) {
    var dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (l < .02 || l > 3) return; var nx = -dy / l * w, ny = dx / l * w, i = SK.i = (SK.i + 1) % SK.n, o = i * 18, p = SK.pos, k, c = SK.col, q = [ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax + nx, ay + ny, bx - nx, by - ny, ax - nx, ay - ny];
    for (k = 0; k < 6; k++) { p[o + k * 3] = q[k * 2]; p[o + k * 3 + 1] = y; p[o + k * 3 + 2] = q[k * 2 + 1]; c[i * 24 + k * 4] = c[i * 24 + k * 4 + 1] = c[i * 24 + k * 4 + 2] = 1; c[i * 24 + k * 4 + 3] = alpha; }
    SK.a[i] = alpha; SK.live = 12; SK.g.attributes.position.needsUpdate = true;
  }
  V.fade = function (dt) { // called once a frame: marks stay a few seconds, then go
    if (!SK || SK.live <= 0) return; SK.live -= dt; SK.t += dt; if (SK.t < .1) return; var f = Math.exp(-SK.t / 5), c = SK.col, i, k; SK.t = 0;
    for (i = 0; i < SK.n; i++) { if (SK.a[i] <= .004) continue; SK.a[i] *= f; for (k = 0; k < 6; k++) c[i * 24 + k * 4 + 3] = SK.a[i]; } SK.g.attributes.color.needsUpdate = true;
  };
  function skid(m, c, u, dt, air) {
    var sl = c.slide || 0, on = !air && !(c.hz > .02) && (c.lock || sl > 2.2) && Z.W && S.onRoad(Z.W, c.x, c.y), i, w;
    if (!on) { u.sk = null; return; } if (!SK && m.parent) skidInit(m.parent); if (!SK) return;
    var ca = Math.cos(c.a), sa = Math.sin(c.a), y = u.lift + .004, al = Math.min(.6, .22 + sl * .06), now = [];
    for (i = 0; i < u.wheels.length; i++) { w = u.wheels[i]; if (!w.rear) continue; var wx = c.x + ca * w.x - sa * w.z, wy = c.y + sa * w.x + ca * w.z; now.push(wx, wy); if (u.sk && u.sk.length > now.length - 2) skidSeg(u.sk[now.length - 2], u.sk[now.length - 1], wx, wy, y, Math.max(.035, Math.min(.12, w.r * .32)), al); }
    u.sk = now;
  }
  var dkT = -1, dk = 0, ROAD_Y = .07, GROUND_Y = .05; // the road mesh sits at .05-.06, grass areas at .03-.045
  V.move = function (R, m, c, t, up, on) {
    var u = m.userData, first = !u.t, dt = Math.min(.05, Math.max(.001, t - (u.t || t))), sp = c.speed != null ? c.speed : (c.v || 0), as = Math.abs(sp), i, w;
    var da = first ? 0 : ((c.a - u.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, yr = typeof c.yaw === "number" && on === true ? c.yaw : da / dt, acc = first ? 0 : (sp - u.sp) / dt;
    var k = 1 - Math.exp(-dt * 8), kb = 1 - Math.exp(-dt * (u.two ? 7 : 6));
    if (dkT !== t) { V.fade(dkT < 0 ? 0 : Math.min(.1, Math.max(0, t - dkT))); dkT = t; dk = Z.P ? S.darkness(Z.P.time) : 0; }
    up = up || 0; var climb = first ? 0 : (up - (u.up || 0)) / dt; u.t = t; u.a = c.a; u.sp = sp; u.up = up;
    u.acc = (u.acc || 0) + (S.clamp(acc, -30, 30) - (u.acc || 0)) * k; u.yr = (u.yr || 0) + (S.clamp(yr, -4, 4) - (u.yr || 0)) * k; u.cl = (u.cl || 0) + (climb - (u.cl || 0)) * k;
    // tyres rest on whatever is under them: the road is a little proud of the grass
    var base = Z.W && S.groundY ? S.groundY(Z.W, c.x, c.y) + .008 : GROUND_Y; u.lift = first || u.lift == null ? base : u.lift + (base - u.lift) * k;
    var vp = on === true ? V.vis(c) : null; // the machine you drive is drawn where it is between the 120 Hz steps (no judder)
    m.position.set(vp ? vp._dx : c.x, up + u.lift + (c.hz || 0), vp ? vp._dy : c.y); m.rotation.y = -c.a;
    // lean and squat answer the real sideways and forward acceleration; two cascaded low-passes give a critically
    // damped, frame-rate independent response with no overshoot and nothing moving at rest
    var lat = u.yr * sp, roll, pitch, live = on !== false && u.motor, air = up > .2;
    if (u.plane) { // nose comes up as it nears flying speed, the wings bank into a turn, and the nose follows the climb
      var to = S.VEH.plane.takeoff, rot = S.clamp((sp - to * .78) / (to * .22), 0, 1); roll = air ? S.clamp(u.yr * .62, -.6, .6) : 0; pitch = air ? S.clamp(u.cl * .045 + .05, -.16, .3) : rot * .11; }
    else if (u.two) { roll = S.clamp(Math.atan(lat / 9.81) * .62, -.4, .4) * S.clamp((as - 1) / 3.5, 0, 1); if (u.type === "skate") roll *= .5; pitch = 0; }
    else { roll = S.clamp(-lat * .0055, -.065, .065); pitch = S.clamp(u.acc * .0075, -.045, .055); }
    u.r1 = (u.r1 || 0) + (roll - (u.r1 || 0)) * kb; u.roll = (u.roll || 0) + (u.r1 - (u.roll || 0)) * kb; u.p1 = (u.p1 || 0) + (pitch - (u.p1 || 0)) * kb; u.pitch = (u.pitch || 0) + (u.p1 - (u.pitch || 0)) * kb;
    if (u.two) { m.rotation.x = u.roll + (c.tipA || 0); u.body.rotation.z = 0; } /* tipA: lying on its side after a spill */ else { u.body.rotation.x = u.roll; u.body.rotation.z = u.pitch; }
    u.body.position.y = 0;
    // front wheels and handlebars follow the steering; wheels roll with the ground speed
    var st = typeof c.st === "number" && on === true ? c.st * .5 / (1 + as / 14) : as > .4 ? S.clamp(Math.atan(u.yr * (u.base || 1.5) / Math.max(2.5, as)) * (sp < 0 ? -1 : 1), -.5, .5) : 0; u.st = (u.st || 0) + (st - (u.st || 0)) * k;
    if (u.steer) u.steer.rotation.y = -u.st * (u.two ? .8 : 1);
    if (u.sw) { var swA = (typeof c.st === "number" && on === true ? c.st : S.clamp(u.st * 2, -1, 1)) * 1.57; u.sw.rotation.x = swA; if (u.anc) u.anc.wheelA = swA; } // about 90 degrees each way
    for (i = 0; i < u.wheels.length; i++) { w = u.wheels[i]; if (!(c.lock && w.rear)) w.spin.rotation.z -= sp * dt / w.r; if (w.front) w.pivot.rotation.y = -u.st; }
    if (on === true || c.lock) skid(m, c, u, dt, air);
    if (u.door) { if (c.doorT > 0) { c.doorT = Math.max(0, c.doorT - dt); var dT = .8 - c.doorT; u.door.rotation.y = S.clamp(Math.min(dT / .2, c.doorT / .25), 0, 1) * -1.05; } else if (u.door.rotation.y) u.door.rotation.y = 0; }
    if (u.crank) { u.crank.rotation.z -= sp * dt * 1.05; if (u.anc) u.anc.crankA = u.crank.rotation.z; }
    if (u.prop) { var spinning = live && (as > .5 || up > 0); u.rpm = (u.rpm || 0) + ((spinning ? (c.thr > 0 || air ? 1 : .35) : 0) - (u.rpm || 0)) * (1 - Math.exp(-dt * 1.6)); u.prop.rotation.x += dt * u.rpm * 60; u.propDisc.visible = u.rpm > .5; u.prop.visible = !u.propDisc.visible; }
    // lamps: headlights and running lights after dark while the engine is on, brake lights when slowing hard
    var L = V.lamp, night = dk > .32 && live, brake = live && u.acc < -3.2 && as > 1, hm = night ? L.headOn : L.headOff, tm = brake ? L.brake : night ? L.tailOn : L.tailOff;
    if (u.hm !== hm) { u.hm = hm; for (i = 0; i < u.heads.length; i++) u.heads[i].material = hm; } if (u.tm !== tm) { u.tm = tm; for (i = 0; i < u.tails.length; i++) u.tails[i].material = tm; }
    if (u.glow) { u.glow.visible = night && up < .5; u.glow.position.y = .03 - up; }
    u.shadow.visible = !R.shadows || up > 0; u.shadow.position.y = .012 - up;
  };

  /* ---------- drawn position: the game steps at 120 Hz, the screen at whatever it likes. The machine you drive is
     drawn a little ahead of its last step by its own velocity and eased back onto the true position, so it glides
     instead of juddering by a step now and then. The camera and the rider use the same point. ---------- */
  function now() { return typeof performance !== "undefined" && performance.now ? performance.now() / 1000 : 0; }
  V.vis = function (c) {
    var n = now(); if (c._vn === n && c._dx != null) return c; var dt = c._vn == null ? 0 : n - c._vn; c._vn = n;
    if (c._dx == null || !(dt > 0) || dt > .1 || Math.hypot(c.x - c._dx, c.y - c._dy) > 2) { c._dx = c.x; c._dy = c.y; return c; }
    var vx = c.vx != null ? c.vx : Math.cos(c.a) * (c.v || 0), vy = c.vy != null ? c.vy : Math.sin(c.a) * (c.v || 0), k = 1 - Math.exp(-dt * 16);
    c._dx += vx * dt; c._dy += vy * dt; c._dx += (c.x - c._dx) * k; c._dy += (c.y - c._dy) * k; return c;
  };

  /* ---------- crashes: every machine is a capsule (its length and width) with a mass. Contacts are solved with an
     impulse (restitution and friction), pushed apart so nothing overlaps, and answered with a sound for what met
     what, a shake for how hard, and a reaction: shoved and spun, a driver who brakes and honks, a rider who comes
     off and gets up again. Pure maths first (V.collide, V.wallSolve, V.crashSounds) so the Node tests can drive it. */
  var MASS = { skate: 75, bike: 90, scooter: 190, okada: 230, keke: 480, car: 1300, taxi: 1300, sport: 1250, pickup: 1800, bus: 3200, plane: 1100, ped: 70 };
  var DIM = { bus: [4.9, 1.9], taxi: [4.4, 1.9], pickup: [4.6, 1.9] }, SPIN = .7, TWO = { skate: 1, bike: 1, scooter: 1, okada: 1 };
  var HORNS = { car: "horn_car", sport: "horn_sport", okada: "horn_okada", scooter: "horn_scooter", keke: "horn_keke", bus: "horn_bus", bike: "horn_bike" };
  V.MASS = MASS; V.log = []; V.spills = []; V.crashSounds = true;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function kindOf(o) { return o.ped ? "ped" : o.vk || o.type; }
  V.mass = function (o) { return (MASS[kindOf(o)] || MASS[o.type] || MASS.car) + ((o.pax || 0) + (o._riders || 0)) * 70; }; // passengers add their weight
  V.dims = function (o) { if (o.ped) return { len: .5, wid: .5 }; var d = DIM[o.vk], sp = S.VEH[o.type] || S.VEH.car; return d ? { len: d[0], wid: d[1] } : { len: sp.len, wid: sp.wid }; };
  // what it sounds like when it is hit: bicycle (light rattle), skate (wood), moto (metal and plastic), car, bus, ped
  V.mat = function (o) { var k = kindOf(o); return k === "bus" || k === "pickup" ? "bus" : k === "bike" ? "bicycle" : k === "skate" ? "skate" : k === "okada" || k === "scooter" ? "moto" : k === "ped" ? "ped" : "car"; };
  V.isTwo = function (o) { return !!TWO[o.type]; };

  // Sound names for a contact between two materials (wall and pole count as materials), loudest first.
  V.sounds = function (a, b, imp, slide) {
    var g = clamp(.3 + imp / 12, .3, 1), out = [], seen = {};
    function add(n, gain) { if (!seen[n]) { seen[n] = 1; out.push({ n: n, g: +clamp(gain, .15, 1).toFixed(2) }); } }
    function own(m, gain, other) {
      if (m === "bicycle") add("crash_bicycle", gain); else if (m === "skate") add("crash_skate", gain); else if (m === "moto") add("crash_moto", gain);
      else if (m === "bus") add("crash_bus", gain); else if (m === "wall") { if (imp > 2.5 || (other !== "bicycle" && other !== "skate")) add("crash_wall", other === "bicycle" || other === "skate" ? gain * .45 : gain); }
      else if (m === "pole") add("crash_pole", gain); else if (m === "ped") add("hit_person", gain);
      else if (m === "car") { var soft = other === "bicycle" || other === "skate" || other === "ped"; add(soft || imp < 4 || (imp < 6 && other !== "car" && other !== "bus") ? "crash_car_light" : "crash_car", soft ? gain * .5 : gain); } // a car hitting a bicycle is a thunk, not a crunch
    }
    var light = { bicycle: 1, skate: 1, ped: 1 }, first = light[a] || light[b] ? (light[a] ? a : b) : a, second = first === a ? b : a;
    own(first, g, second); own(second, g, first);
    var metal = { car: 1, bus: 1 }; if (metal[a] && metal[b]) { if (imp > 11) add("crash_heavy", g); if (imp > 16) add("glass", g * .8); }
    if (slide > 4 && imp < 6 && (metal[a] || metal[b] || a === "moto" || b === "moto")) add("scrape", clamp(slide / 14, .25, .8));
    return out;
  };

  // closest points between segments p1-q1 and p2-q2
  var CP = { ax: 0, ay: 0, bx: 0, by: 0 };
  function closest(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
    var d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y, rx = p1x - p2x, ry = p1y - p2y, a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry, s = 0, t = 0;
    if (a < 1e-9 && e < 1e-9) { s = t = 0; } else if (a < 1e-9) { t = clamp(f / e, 0, 1); }
    else { var c = d1x * rx + d1y * ry; if (e < 1e-9) s = clamp(-c / a, 0, 1); else { var b = d1x * d2x + d1y * d2y, den = a * e - b * b; s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
    CP.ax = p1x + d1x * s; CP.ay = p1y + d1y * s; CP.bx = p2x + d2x * t; CP.by = p2y + d2y * t; return CP;
  }
  // a rigid body for the solver: o is the game object, role "me" (vx, vy, spin), "traffic" (a, v + knock kx, ky, kw) or "loose" (vx, vy, w)
  V.body = function (o, role) {
    var d = V.dims(o), m = V.mass(o), r = d.wid / 2, ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0), vx, vy;
    if (role === "traffic") { vx = ca * (o.v || 0) + (o.kx || 0); vy = sa * (o.v || 0) + (o.ky || 0); } else { vx = o.vx || 0; vy = o.vy || 0; }
    return { o: o, role: role, x: o.x, y: o.y, a: o.a || 0, h: Math.max(0, d.len / 2 - r), r: r, m: m, I: m * (d.len * d.len + d.wid * d.wid) / 12 * (o.ped ? 1 : 1), vx: vx, vy: vy, w: (role === "traffic" ? o.kw : role === "me" ? o.spin : o.w) || 0, mat: V.mat(o), vx0: vx, vy0: vy };
  };
  function push(b, jx, jy, rx, ry, sg) { b.vx += sg * jx / b.m; b.vy += sg * jy / b.m; b.w += sg * (rx * jy - ry * jx) / b.I * SPIN; }
  // Two bodies: separate them and exchange an impulse. Returns null when apart, else the contact.
  V.collide = function (A, B, e, mu) {
    var ca = Math.cos(A.a), sa = Math.sin(A.a), cb = Math.cos(B.a), sb = Math.sin(B.a);
    var q = closest(A.x - ca * A.h, A.y - sa * A.h, A.x + ca * A.h, A.y + sa * A.h, B.x - cb * B.h, B.y - sb * B.h, B.x + cb * B.h, B.y + sb * B.h);
    var dx = q.ax - q.bx, dy = q.ay - q.by, d = Math.hypot(dx, dy), R = A.r + B.r, nx, ny; if (d >= R) return null;
    if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = A.x - B.x; ny = A.y - B.y; var l = Math.hypot(nx, ny); if (l < 1e-6) { nx = -sb; ny = cb; l = 1; } nx /= l; ny /= l; }
    var pen = R - d, px = q.bx + nx * B.r, py = q.by + ny * B.r, ia = 1 / A.m, ib = 1 / B.m, s = ia + ib, c = pen + .02;
    A.x += nx * c * ia / s; A.y += ny * c * ia / s; B.x -= nx * c * ib / s; B.y -= ny * c * ib / s;
    var rax = px - A.x, ray = py - A.y, rbx = px - B.x, rby = py - B.y, vax = A.vx - A.w * ray, vay = A.vy + A.w * rax, vbx = B.vx - B.w * rby, vby = B.vy + B.w * rbx;
    var rvx = vax - vbx, rvy = vay - vby, vn = rvx * nx + rvy * ny, res = { nx: nx, ny: ny, x: px, y: py, pen: pen, imp: Math.max(0, -vn), j: 0, dvA: 0, dvB: 0, slide: 0 };
    if (vn < 0) {
      var ran = rax * ny - ray * nx, rbn = rbx * ny - rby * nx, k = s + ran * ran / A.I * SPIN + rbn * rbn / B.I * SPIN, j = -(1 + e) * vn / k;
      push(A, nx * j, ny * j, rax, ray, 1); push(B, nx * j, ny * j, rbx, rby, -1); res.j = j;
      var tx = rvx - vn * nx, ty = rvy - vn * ny, tl = Math.hypot(tx, ty); res.slide = tl;
      if (tl > 1e-3) { tx /= tl; ty /= tl; var rat = rax * ty - ray * tx, rbt = rbx * ty - rby * tx, kt = s + rat * rat / A.I * SPIN + rbt * rbt / B.I * SPIN, jt = clamp(-tl / kt, -mu * j, mu * j); push(A, tx * jt, ty * jt, rax, ray, 1); push(B, tx * jt, ty * jt, rbx, rby, -1); }
      res.dvA = Math.hypot(A.vx - A.vx0, A.vy - A.vy0); res.dvB = Math.hypot(B.vx - B.vx0, B.vy - B.vy0);
    }
    return res;
  };
  // A body against the world (buildings, rocks, trees, the edge): pushed out along the wall, so it slides along it
  // instead of sticking. A glancing touch keeps most of the speed; a square hit stops it with a small bounce.
  V.wallSolve = function (W, b, e, mu) {
    var best = null, ca = Math.cos(b.a), sa = Math.sin(b.a), ks = b.h > .15 ? [1, 0, -1] : [0], it, i;
    for (it = 0; it < 3; it++) {
      var worst = null;
      for (i = 0; i < ks.length; i++) { var px = b.x + ca * b.h * ks[i], py = b.y + sa * b.h * ks[i], n = S.push(W, px, py, b.r), tn = trunks(n.x, n.y, b.r); if (tn) n = tn; if (!n.hit) continue; var cx = n.x - px, cy = n.y - py, l = Math.hypot(cx, cy); if (!worst || l > worst.l) worst = { l: l, cx: cx, cy: cy, nx: n.nx, ny: n.ny, px: n.x - n.nx * b.r, py: n.y - n.ny * b.r, tree: n.tree }; }
      if (!worst) break;
      b.x += worst.cx; b.y += worst.cy; var nx = worst.nx, ny = worst.ny; if (worst.l > 1e-4) { nx = worst.cx / worst.l; ny = worst.cy / worst.l; }
      var rx = worst.px - b.x, ry = worst.py - b.y, vx = b.vx - b.w * ry, vy = b.vy + b.w * rx, vn = vx * nx + vy * ny;
      if (!best) best = { nx: nx, ny: ny, x: worst.px, y: worst.py, imp: 0, slide: 0, mat: worst.tree ? "pole" : "wall" };
      if (vn < 0) { var rn = rx * ny - ry * nx, k = 1 / b.m + rn * rn / b.I * SPIN, j = -(1 + e) * vn / k; push(b, nx * j, ny * j, rx, ry, 1);
        var tx = vx - vn * nx, ty = vy - vn * ny, tl = Math.hypot(tx, ty); if (tl > 1e-3) { tx /= tl; ty /= tl; var rt = rx * ty - ry * tx, kt = 1 / b.m + rt * rt / b.I * SPIN, jt = clamp(-tl / kt, -mu * j, mu * j); push(b, tx * jt, ty * jt, rx, ry, 1); }
        if (-vn > best.imp) { best.imp = -vn; best.nx = nx; best.ny = ny; best.x = worst.px; best.y = worst.py; best.slide = tl; } }
    }
    if (best && W.flat && S.wildRocks) { var wr = S.wildRocks(W, best.x, best.y); for (i = 0; i < wr.length; i++) if (wr[i].k === "baobab" && Math.hypot(wr[i].x - best.x, wr[i].y - best.y) < wr[i].r + .3) best.mat = "pole"; }
    return best;
  };
  function writeBack(b) {
    var o = b.o; o.x = b.x; o.y = b.y;
    if (b.role === "traffic") { o.v = 0; o.kx = b.vx; o.ky = b.vy; o.kw = clamp(b.w, -4, 4); } // the driver brakes; the knock carries it
    else { o.vx = b.vx; o.vy = b.vy; if (b.role === "me") o.spin = clamp(b.w, -3, 3); else { o.w = clamp(b.w, -6, 6); o.loose = 1; } }
  }

  /* ---------- in the game ---------- */
  var rr = S.rng(90210);
  function api() { return Z.api; }
  function sfx(n, o) { var a = api(); if (a && a.sound && a.sound.sfx) a.sound.sfx(n, o); }
  function playHit(list, x, y) { for (var i = 0; i < list.length; i++) sfx(list[i].n, { x: x, y: y, ref: 22, gain: list[i].g }); }
  function note(kind, a, b, res, list) { V.log.push({ t: api() ? api().t : 0, kind: kind, a: a, b: b, imp: +res.imp.toFixed(2), names: list.map(function (q) { return q.n; }) }); if (V.log.length > 60) V.log.shift(); }
  // what you feel and see when your own machine hits something
  function feel(res, mine, matA) {
    var a = api(), ang = Math.atan2(-res.ny, -res.nx), imp = res.imp; if (!a || !Z.fx) return;
    if (matA === "bicycle" || matA === "skate") Z.fx.dust(res.x, res.y, Math.min(6, 2 + imp * .4), Math.min(1, imp * .1), ang + Math.PI);
    else if (imp > 3 && Z.fx.crash) Z.fx.crash(res.x, res.y, res.nx, res.ny, imp); else Z.fx.dust(res.x, res.y, 2, .4, ang + Math.PI);
    if (mine) { a.kick(Math.min(16, imp * 1.1)); if (Z.fx.camKick) Z.fx.camKick(ang, Math.min(.45, imp * .035)); if (a.buzz) a.buzz(Math.round(Math.min(90, 12 + imp * 6))); }
  }
  function tipOver(c, nx, ny, dv) { // a two-wheeler goes down on the side it was hit from, with a little hop
    var side = (-Math.sin(c.a) * nx + Math.cos(c.a) * ny) >= 0 ? -1 : 1; c.tip = side * 1.45; c.tipA = c.tipA || 0; c.hz = Math.max(c.hz || 0, .001); c.hvz = Math.min(2.8, .8 + dv * .25); c.loose = 1;
  }
  // Never during the tutorial, the opening film or a mission's ride step; and only when you drove into it.
  function mayThrow() {
    if (Z.intro && Z.intro.on) return false; if (Z.guide && Z.guide.active && Z.guide.active()) return false;
    try { var st = Z.step && Z.step(); if (st && (st.t === "ride" || st.ride)) return false; } catch (e) {} return true;
  }
  V.mayThrow = mayThrow;
  function atFault(A, B, res) { var mine = -(A.vx0 * res.nx + A.vy0 * res.ny), theirs = B.vx0 * res.nx + B.vy0 * res.ny; return mine > 3 && mine >= theirs; } // you were the one closing in
  // You come off your own machine: it carries on without you, you land and get up.
  V.throwOff = function (v, ang, dv, from) {
    var me = Z.me, P = Z.P, vx = v.vx, vy = v.vy; if (!me || me.veh !== v) return;
    Z.exit(true); v.vx = vx; v.vy = vy; v.speed = 0; tipOver(v, Math.cos(ang + 1.2), Math.sin(ang + 1.2), dv);
    var f = S.push(Z.W, v.x, v.y, .45); me.x = f.x; me.y = f.y; me.a = ang;
    if (P && Z.hurt) { var dmg = Math.min(3 + dv * 1.1, Math.max(0, P.hp - 15)); me.inv = 0; if (dmg > 0) Z.hurt(dmg, from && from.x != null ? from : null); }
    me.fall = 1.5 + Math.min(1.3, dv * .09); me.hitT = .4; me.hitA = ang; if (Z.fx) Z.fx.knock(me, ang, Math.min(8, 2 + dv * .5));
    sfx("fall", { x: me.x, y: me.y, ref: 18 }); if (Z.say) Z.say("me", ["Ah! My back!", "Who taught you to drive?", "Chai! I don fall."][Math.floor(rr() * 3)]);
    V.log.push({ t: api() ? api().t : 0, kind: "thrown", a: v.type, imp: +dv.toFixed(2), names: ["fall"] });
  };
  // A traffic rider comes off: the bike slides away on its own, the rider is knocked down, gets up and rides on.
  V.spill = function (t, B, ang, dv) {
    var W = Z.W, i = Z.traffic.indexOf(t); if (i < 0) return null; Z.traffic.splice(i, 1);
    var c = { id: Z.cars.length, type: t.type, x: B.x, y: B.y, a: B.a, vx: B.vx, vy: B.vy, speed: 0, w: B.w, col: t.col, hx: B.x, hy: B.y, ha: B.a, free: true, dropped: 1, loose: 1 };
    tipOver(c, Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), dv); Z.cars.push(c);
    var f = S.push(W, t.x + Math.cos(ang) * .4, t.y + Math.sin(ang) * .4, .4), nr = S.nearRoad(W, f.x, f.y, 60), w = nr ? S.wanderStart(W, rr, { x: nr.x, y: nr.y, r: nr.r }, false) : t.w;
    var p = { w: w, x: f.x, y: f.y, a: ang, spd: 0, look: t.look || {}, sp: 1.5, side: nr ? nr.r.w / 2 + 1 : 0, walk: 0, fall: 0, wave: 0, flee: 0, k: 1 };
    Z.peds.push(p);
    if (Z.brawl && Z.brawl.down) Z.brawl.down(p, 1.6 + Math.min(1.6, dv * .15), ang, 2 + dv * .55, 3.2 + dv * .3, dv > 6);
    else { p.fall = 2.4; p.kv = 1; p.kx = Math.cos(ang) * (2 + dv * .55); p.ky = Math.sin(ang) * (2 + dv * .55); p.kz = 3.2 + dv * .3; p.air = .05; }
    sfx("fall", { x: p.x, y: p.y, ref: 18 }); if (Z.say) Z.say(p, ["Ah! My okada!", "Oga, you no see me?", "Wetin be this?!"][Math.floor(rr() * 3)]);
    var sp = { p: p, c: c, t: 0, type: t.type, col: t.col, look: t.look, pri: t.pri, sp: t.sp }; V.spills.push(sp);
    V.log.push({ t: api() ? api().t : 0, kind: "spill", a: t.type, imp: +dv.toFixed(2), names: ["fall"] });
    return sp;
  };
  function spills(dt) {
    var me = Z.me, W = Z.W;
    for (var i = V.spills.length - 1; i >= 0; i--) {
      var s = V.spills[i], p = s.p, c = s.c; s.t += dt;
      if (Z.peds.indexOf(p) < 0 || Z.cars.indexOf(c) < 0 || s.t > 25) { if (p.pax === "spill") p.pax = null; V.spills.splice(i, 1); continue; }
      if (me.veh === c) { if (p.pax === "spill") p.pax = null; if (!s.cried && Z.say) { s.cried = 1; Z.say(p, "Hey! Na my own be that!"); } V.spills.splice(i, 1); continue; }
      if (p.fall > 0 || p.getUpT > 0 || p.dustT > 0 || s.t < 1) continue; // down, getting up, dusting off: the brawl code has them
      p.pax = "spill"; var d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > 1.3) { p.walk += S.walkTo(W, p, c.x, c.y, 2.4, dt, null, .4) * 2.6; continue; }
      if (c.loose && Math.hypot(c.vx || 0, c.vy || 0) > .3) continue;
      // back on and away
      Z.peds.splice(Z.peds.indexOf(p), 1); Z.cars.splice(Z.cars.indexOf(c), 1); V.spills.splice(i, 1);
      var nr = S.nearRoad(W, c.x, c.y, 40, true); if (!nr) continue; var w0 = S.wanderStart(W, rr, { x: nr.x, y: nr.y, r: nr.r }, true); S.wanderStep(W, w0, 0, rr, nr.r.w * .23);
      Z.traffic.push({ w: w0, type: s.type, col: s.col, sp: s.sp || 6, v: 0, x: c.x, y: c.y, a: w0.a, pri: (Z.carSeq = (Z.carSeq || 0) + 1), look: s.look, ghost: 1.5, remount: 1 });
    }
  }
  // a machine nobody is riding: slides, spins and settles; a two-wheeler that went down stays down until picked up
  function loose(c, dt) {
    var W = Z.W, two = V.isTwo(c);
    if (c.hz > 0) { c.hvz = (c.hvz || 0) - 11 * dt; c.hz += c.hvz * dt; if (c.hz <= 0) { c.hz = 0; c.hvz = 0; if (two) sfx(c.type === "bike" ? "crash_bicycle" : c.type === "skate" ? "crash_skate" : "crash_moto", { x: c.x, y: c.y, ref: 18, gain: .4 }); } }
    if (c.tip != null) { c.tipA = (c.tipA || 0) + (c.tip - (c.tipA || 0)) * (1 - Math.exp(-dt * 7)); }
    if (!c.loose) return;
    var sp = Math.hypot(c.vx, c.vy), dec = (two ? (c.tip ? 6 : 2.5) : 7.5) * dt; // on its side it scrapes to a stop; parked cars have the handbrake on
    if (sp <= dec) { c.vx = c.vy = 0; } else { c.vx -= c.vx / sp * dec; c.vy -= c.vy / sp * dec; }
    c.x += c.vx * dt; c.y += c.vy * dt; c.a += (c.w || 0) * dt; c.w = (c.w || 0) * Math.exp(-dt * (two ? 3 : 4.5));
    var b = V.body(c, "loose"), hit = V.wallSolve(W, b, .2, .4); if (hit) { c.x = b.x; c.y = b.y; c.vx = b.vx; c.vy = b.vy; c.w = b.w; if (hit.imp > 2.5 && !(c._sndT > 0)) { c._sndT = .3; playHit(V.sounds(V.mat(c), hit.mat, hit.imp, hit.slide), hit.x, hit.y); } }
    if (c._sndT > 0) c._sndT -= dt;
    c.hx = c.x; c.hy = c.y; c.ha = c.a; c.speed = 0;
    if (Math.hypot(c.vx, c.vy) < .05 && Math.abs(c.w || 0) < .05 && !(c.hz > 0)) { c.vx = c.vy = 0; c.w = 0; c.loose = 0; }
  }
  // Traffic that has been hit coasts on its knock, brakes, then honks and drives on. True while it is shaken.
  V.stunned = function (t, dt) {
    if (t.pax == null) { var lr = S.hash(t.pri || 1, 77); t.pax = t.type === "keke" ? (lr < .45 ? 3 : lr < .7 ? 1 + Math.floor(lr * 10) % 2 : 0) : t.type === "okada" ? (lr < .25 ? 2 : lr < .55 ? 1 : 0) : t.type === "scooter" ? (lr < .3 ? 1 : 0) : t.type === "car" && t.vk !== "bus" ? (lr < .3 ? 1 : 0) : 0; } // some come full
    if (!(t.stun > 0)) return false; var W = Z.W; t.stun -= dt;
    t.v = Math.max(0, (t.v || 0) - 9 * dt); var k = Math.exp(-dt * 2.8); t.kx = (t.kx || 0) * k; t.ky = (t.ky || 0) * k; t.kw = (t.kw || 0) * Math.exp(-dt * 3.5);
    t.x += (Math.cos(t.a) * t.v + t.kx) * dt; t.y += (Math.sin(t.a) * t.v + t.ky) * dt; t.a += t.kw * dt; t.spd = t.v; t.speed = t.v;
    var b = V.body(t, "traffic"), hit = V.wallSolve(W, b, .2, .4); if (hit) { t.x = b.x; t.y = b.y; t.kx *= .3; t.ky *= .3; }
    if (t.stun <= 0) { t.stun = 0; t.kx = t.ky = t.kw = 0; if (t.honk) { t.honk = 0; sfx(HORNS[t.vk === "bus" ? "bus" : t.type] || "horn_car", { x: t.x, y: t.y, ref: 18 }); } t.ghost = Math.max(t.ghost || 0, .6); }
    return true;
  };
  // Your machine against a wall: called by the driving code after each physics step.
  V.wall = function (v, dt) {
    var b = V.body(v, "me"), m = V.mat(v), hit = V.wallSolve(Z.W, b, m === "bicycle" || m === "skate" ? .1 : .18, .28); if (!hit) return null;
    v.x = b.x; v.y = b.y; v.vx = b.vx; v.vy = b.vy; v.spin = clamp(b.w, -3, 3);
    if (hit.imp > 1.6 && !(v._hitT > 0)) { v._hitT = .25; var list = V.sounds(m, hit.mat, hit.imp, hit.slide); playHit(list, hit.x, hit.y); note("wall", m, hit.mat, hit, list); feel(hit, true, m);
      if (hit.imp > 9 && !V.isTwo(v) && Z.hurt) Z.hurt((hit.imp - 9) * 1.2);
      if (V.isTwo(v) && hit.imp > (v.type === "okada" || v.type === "scooter" ? 11 : 8.5) && mayThrow()) V.throwOff(v, Math.atan2(-hit.ny, -hit.nx) + Math.PI, hit.imp, null); }
    else if (hit.slide > 4 && !(v._scrT > 0) && m !== "bicycle" && m !== "skate") { v._scrT = .45; sfx("scrape", { x: hit.x, y: hit.y, ref: 18, gain: clamp(hit.slide / 14, .25, .8) }); }
    return hit;
  };
  function react(t, res, A, B, mine) { // a traffic machine you hit
    var heavier = A.m > B.m * 1.5;
    if (V.isTwo(t) && heavier && res.dvB > 2.2) { V.spill(t, B, Math.atan2(-res.ny, -res.nx), res.dvB); return; }
    writeBack(B); t.stun = clamp(.7 + res.dvB * .3, .7, 2.6); t.honk = 1; if (res.imp > 1.5) t.v = 0;
    void mine;
  }
  // One frame of crash work, after the traffic has moved: loose machines, riders getting back on, and your machine
  // against every other machine and every walker it touches.
  V.tick = function (dt) {
    var me = Z.me, W = Z.W, v = me && me.veh, i, c; if (!W || !me) return;
    if (!V.reg) { V.reg = 1; var sn = api() && api().sound; if (sn && sn.register) sn.register({
      crash_car: { group: "crashes", desc: "Car into car: a metal crunch" }, crash_car_light: { group: "crashes", desc: "A small car bump" },
      crash_bus: { group: "crashes", desc: "Hitting the shuttle bus or a pick-up: heavy and deep" }, crash_moto: { group: "crashes", desc: "Okada or scooter hit: light metal and plastic" },
      crash_bicycle: { group: "crashes", desc: "Bicycle hit or falling over: a light rattle" }, crash_skate: { group: "crashes", desc: "Skateboard hit: wood clack and wheels" },
      crash_wall: { group: "crashes", desc: "A vehicle into a wall or kerb" }, crash_pole: { group: "crashes", desc: "A vehicle into a tree or pole" },
      scrape: { group: "crashes", desc: "Bodywork scraping along a wall" }, hit_person: { group: "crashes", desc: "A vehicle bumping into someone" },
      rustle: { group: "world", desc: "Pushing through a bush or hedge" }, rustle_big: { group: "world", desc: "Driving hard through a hedge or small tree" }, crops: { group: "world", desc: "Going through a field of crops" } }); }
    V.plantTick(dt);
    for (i = 0; i < Z.cars.length; i++) { c = Z.cars[i]; if (c === v) { if (c.tip) { c.tip0 = c.tipA || c.tip; c.tip = 0; } c.w = 0; c.loose = 0;
        // picked up: the bike rises with the rider's hands (samaru-anim writes me.animLift 0..1); held down while the clip
        // winds up; without an animation it simply eases upright
        if (c.tipA) { var lift = me.animLift; if (typeof lift === "number" && c.tip0) c.tipA = c.tip0 * (1 - Math.max(0, Math.min(1, lift))); else if (!me.animBusy) c.tipA *= Math.exp(-dt * 10); }
        if (Math.abs(c.tipA || 0) < .002) { c.tipA = 0; c.tip0 = 0; } continue; } if (c.loose || c.hz > 0 || c.tip != null) loose(c, dt); }
    spills(dt);
    if (v && v._hitT > 0) v._hitT -= dt; if (v && v._scrT > 0) v._scrT -= dt;
    if (!v || me.alt > .05) return;
    var nr = 0; for (i = 0; i < Z.npcs.length; i++) if (Z.npcs[i].rideV === v) nr++; v._riders = nr; var m0 = MASS[kindOf(v)] || MASS.car; v.loadK = m0 / (m0 + nr * 70 * (V.isTwo(v) ? .8 : .5)); // a full okada pulls slower
    if (v.spin) { v.a += v.spin * dt; v.spin *= Math.exp(-dt * 5); if (Math.abs(v.spin) < .01) v.spin = 0; }
    var A = V.body(v, "me"), mA = A.mat, any = false, R0 = A.h + A.r + 6;
    var lists = [Z.traffic, Z.cars];
    for (var li = 0; li < 2; li++) for (i = lists[li].length - 1; i >= 0; i--) {
      c = lists[li][i]; if (!c || c === v || c.hidden || Math.abs(c.x - A.x) > R0 || Math.abs(c.y - A.y) > R0) continue;
      var B = V.body(c, li ? "loose" : "traffic"), two = V.isTwo(v), res = V.collide(A, B, two || V.isTwo(c) ? .12 : .22, .3); if (!res) continue; any = true;
      if (li) { writeBack(B); if (V.isTwo(c) && A.m > B.m * 1.5 && res.dvB > 2.2) tipOver(c, res.nx, res.ny, res.dvB); }
      else react(c, res, A, B, true);
      if (res.imp > 1.2 && !(c._hitT > (api() ? api().t : 0))) { c._hitT = (api() ? api().t : 0) + .3; var list = V.sounds(mA, B.mat, res.imp, res.slide); playHit(list, res.x, res.y); note(li ? "parked" : "traffic", mA, B.mat, res, list); feel(res, true, mA);
        if (!li && res.imp > 11 && Z.offend) Z.offend("crash"); if (!V.isTwo(v) && res.dvA > 9 && Z.hurt) Z.hurt((res.dvA - 9) * .8); }
      // the lighter one comes off
      if (two && B.m > A.m * 1.5 && res.dvA > 5 && mayThrow() && atFault(A, B, res)) { v.x = A.x; v.y = A.y; v.vx = A.vx; v.vy = A.vy; V.throwOff(v, Math.atan2(res.ny, res.nx), res.dvA, c); return; }
    }
    if (any) { var hit = V.wallSolve(W, A, .1, .3); void hit; writeBack(A); }
    // walkers: a slow nudge makes them stumble out of the way; faster than that the knock-down code takes over
    var sp = Math.hypot(v.vx, v.vy), ppl = [Z.peds, Z.npcs], ca = Math.cos(v.a), sa = Math.sin(v.a);
    for (li = 0; li < 2; li++) for (i = 0; i < ppl[li].length; i++) {
      var n = ppl[li][i]; if (!n || n.hidden || n.fall > 0 || n.pax || n.riding || n.rideV || n.follow || Math.abs(n.x - v.x) > R0 || Math.abs(n.y - v.y) > R0) continue;
      var q = closest(v.x - ca * A.h, v.y - sa * A.h, v.x + ca * A.h, v.y + sa * A.h, n.x, n.y, n.x, n.y), dx = n.x - q.ax, dy = n.y - q.ay, d = Math.hypot(dx, dy); if (d > A.r + .35) continue;
      if (sp > 4.5 || sp < .5) continue; /* a parked machine is walked round, not shoved against */ var ang = d > 1e-3 ? Math.atan2(dy, dx) : v.a + Math.PI / 2;
      var f = S.push(W, q.ax + Math.cos(ang) * (A.r + .36), q.ay + Math.sin(ang) * (A.r + .36), .4); n.x = f.x; n.y = f.y; // never inside the machine
      if (sp > .9 && !(n.stumT > 0)) { n.stumT = 1; n.hitT = .35; n.hitA = ang; if (Z.fx) Z.fx.knock(n, ang, 1.5 + sp * .6); if (li === 0) n.flee = Math.max(n.flee || 0, .6); sfx("hit_person", { x: n.x, y: n.y, ref: 14, gain: clamp(.25 + sp * .08, .25, .6) }); v.vx *= .9; v.vy *= .9; if (Z.say && rr() < .5) Z.say(n, ["Ehn! Watch it!", "Easy now!", "My leg o!"][Math.floor(rr() * 3)]); V.log.push({ t: api() ? api().t : 0, kind: "stumble", a: mA, b: "ped", imp: +sp.toFixed(2), names: ["hit_person"] }); }
    }
    for (li = 0; li < 2; li++) for (i = 0; i < ppl[li].length; i++) { n = ppl[li][i]; if (n && n.stumT > 0) n.stumT -= dt; }
  };

  /* ---------- plants: hedges and small trees give way and spring back; big trunks are solid ----------
     samaru-3d.js hands each chunk's instanced hedges and trees over (V.plants) and takes them back when the chunk
     goes (V.unplant). Only plants something is touching are animated: a damped spring per plant, written straight
     into the instance matrices (bent about its foot, away from whatever pushed it). No three.js needed here. */
  var PG = {}, PCELL = 20, BENT = [], PN = [];
  function pk(cx, cy) { return cx * 100003 + cy; }
  function plantsNear(x, y, R) { PN.length = 0; for (var cx = Math.floor((x - R) / PCELL); cx <= Math.floor((x + R) / PCELL); cx++) for (var cy = Math.floor((y - R) / PCELL); cy <= Math.floor((y + R) / PCELL); cy++) { var l = PG[pk(cx, cy)]; if (l) for (var i = 0; i < l.length; i++) PN.push(l[i]); } return PN; }
  V.plants = function (three, grp, list) {
    var all = grp.userData.plants || (grp.userData.plants = []);
    for (var i = 0; i < list.length; i++) { var p = list[i]; p.b = 0; p.bv = 0; p.dx = 1; p.dy = 0; p.fxT = 0; for (var j = 0; j < p.parts.length; j++) { var q = p.parts[j]; q.m0 = Array.prototype.slice.call(q.m.instanceMatrix.array, q.i * 16, q.i * 16 + 16); }
      var k = pk(Math.floor(p.x / PCELL), Math.floor(p.y / PCELL)); (PG[k] || (PG[k] = [])).push(p); all.push(p); }
  };
  V.unplant = function (grp) { var l = grp.userData.plants; if (!l) return; for (var i = 0; i < l.length; i++) { var p = l[i], a = PG[pk(Math.floor(p.x / PCELL), Math.floor(p.y / PCELL))], j = a ? a.indexOf(p) : -1; if (j >= 0) a.splice(j, 1); p.dead = 1; } BENT = BENT.filter(function (p) { return !p.dead; }); grp.userData.plants = null; };
  V.plantList = function () { var o = []; for (var k in PG) o.push.apply(o, PG[k]); return o; };
  V.plantCount = function () { var n = 0; for (var k in PG) n += PG[k].length; return n; };
  // a circle (x, y, r) pushed out of any solid trunk: same shape as S.push's answer, or null
  function trunks(x, y, r) {
    var l = plantsNear(x, y, r + 1), hit = null;
    for (var i = 0; i < l.length; i++) { var p = l[i]; if (p.k !== "trunk") continue; var dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), m = p.r + r; if (d >= m) continue; if (d < 1e-6) { dx = 1; dy = 0; d = 1; } x = p.x + dx / d * m; y = p.y + dy / d * m; hit = { x: x, y: y, hit: true, nx: dx / d, ny: dy / d, tree: 1 }; }
    return hit;
  }
  V.trunks = trunks;
  // write one plant's bend into its instance matrices: rotate about the foot, top towards (dx, dy)
  function bendWrite(p) {
    var th = p.b, ax = p.dy, az = -p.dx, l = Math.hypot(ax, az) || 1, c = Math.cos(th), s = Math.sin(th), t = 1 - c; ax /= l; az /= l;
    var r00 = t * ax * ax + c, r01 = -s * az, r02 = t * ax * az, r10 = s * az, r11 = c, r12 = -s * ax, r20 = t * ax * az, r21 = s * ax, r22 = t * az * az + c;
    var px = p.x, py = 0, pz = p.y, tx = px - (r00 * px + r01 * py + r02 * pz), ty = py - (r10 * px + r11 * py + r12 * pz), tz = pz - (r20 * px + r21 * py + r22 * pz);
    for (var j = 0; j < p.parts.length; j++) { var q = p.parts[j], m = q.m0, o = q.m.instanceMatrix.array, b0 = q.i * 16;
      for (var col = 0; col < 4; col++) { var x = m[col * 4], y = m[col * 4 + 1], z = m[col * 4 + 2], w = m[col * 4 + 3];
        o[b0 + col * 4] = r00 * x + r01 * y + r02 * z + tx * w; o[b0 + col * 4 + 1] = r10 * x + r11 * y + r12 * z + ty * w; o[b0 + col * 4 + 2] = r20 * x + r21 * y + r22 * z + tz * w; o[b0 + col * 4 + 3] = w; }
      q.m.instanceMatrix.needsUpdate = true; }
  }
  V.bendWrite = bendWrite;
  var LEAF = { hedge: 0x3f7a2e, small: 0x4f8f3f };
  // something moving at speed sp (direction ux, uy), shaped as a capsule, brushing the plants
  function brush(x, y, a, h, r, sp, ux, uy, veh, dt) {
    var l = plantsNear(x, y, h + r + 2), ca = Math.cos(a), sa = Math.sin(a), drag = 0;
    for (var i = 0; i < l.length; i++) {
      var p = l[i]; if (p.k === "trunk") continue; var hx = p.k === "hedge" ? Math.cos(p.a) * p.half : 0, hy = p.k === "hedge" ? Math.sin(p.a) * p.half : 0;
      var q = closest(x - ca * h, y - sa * h, x + ca * h, y + sa * h, p.x - hx, p.y - hy, p.x + hx, p.y + hy); if (Math.hypot(q.ax - q.bx, q.ay - q.by) > r + p.r) continue;
      var press = clamp(.12 + sp * .045, 0, p.k === "hedge" ? .55 : .2); p.dx = ux; p.dy = uy;
      if (p.b < press) p.bv += (press - p.b) * 55 * dt + (sp > 3 && p.b < .02 ? sp * .04 : 0);
      if (BENT.indexOf(p) < 0) BENT.push(p);
      if (sp > .8) drag = Math.max(drag, p.k === "hedge" ? .9 : .6);
      if (!(p.fxT > 0) && sp > .6) { p.fxT = sp > 6 ? .25 : .5; var R3 = Z.r3; if (R3 && R3.ready && R3.puff) { R3.puff(q.bx, (p.h || 1) * .6, q.by, LEAF[p.k] || 0x3f7a2e, Math.min(10, 2 + Math.round(sp * .7)), .8 + sp * .08, .8, { size: .16, life: 1.1, grav: 2.2, drag: 1.8, vx: ux * sp * .3, vz: uy * sp * .3 }); }
        if (Z.fx && Z.fx.dust && veh) Z.fx.dust(q.bx, q.by, 2, Math.min(1, sp * .08), Math.atan2(uy, ux));
        sfx(sp > 8 && veh ? "rustle_big" : "rustle", { x: q.bx, y: q.by, ref: 12, gain: clamp(.3 + sp * .07, .3, 1) }); V.log.push({ t: api() ? api().t : 0, kind: "plant", a: veh ? V.mat(veh) : "foot", b: p.k, imp: +sp.toFixed(2), names: [sp > 8 && veh ? "rustle_big" : "rustle"] }); if (V.log.length > 60) V.log.shift(); }
    }
    return drag;
  }
  /* ---------- seats: who sits where (hooks for the animation worker) ----------
     V.seats(v) → the passenger seats of a machine (the driver's seat is the machine's own anc), each an anc object in
     the machine's own space, the same shape the rider pose reads: seat [forward, height], side (+ right), lean, foot,
     scale, roof (ceiling over that seat), door (+1 right, -1 left, 0 climbs on from behind or the side).
     V.door(v, i) → the world point beside seat i where someone gets in (i = -1: the driver's door).
     A passenger sitting in seat i has n.rideV = v, n.seatAnc = V.seats(v)[i], n.x/y/a = the machine's. */
  function seatSet(scale, roof, list) { return list.map(function (q) { return Object.assign({ scale: scale, roof: roof, lean: .1 }, q); }); }
  var SEATS = {
    car: seatSet(.68, 1.27, [{ seat: [.14, .42], side: .4, door: 1 }, { seat: [-.95, .42], side: -.4, door: -1, foot: [-.5, .3, .1] }, { seat: [-.95, .42], side: .4, door: 1, foot: [-.5, .3, .1] }]),
    sport: seatSet(.54, .98, [{ seat: [-.3, .34], side: .4, lean: .3, door: 1 }]),
    pickup: seatSet(.72, 1.5, [{ seat: [.18, .5], side: .42, door: 1 }]),
    bus: seatSet(.8, 2.04, [{ seat: [.4, .78], side: .5, door: 1 }, { seat: [.4, .78], side: -.5, door: 1 }, { seat: [-.6, .78], side: .5, door: 1 }, { seat: [-.6, .78], side: -.5, door: 1 }, { seat: [-1.6, .78], side: .5, door: 1 }, { seat: [-1.6, .78], side: -.5, door: 1 }]),
    keke: seatSet(.78, CABIN.keke.roofBack, [{ seat: [-.72, .82], side: .42, lean: .06, door: 1 }, { seat: [-.72, .82], side: -.42, lean: .06, door: -1 }, { seat: [-.72, .82], side: 0, lean: .06, door: 1 }]),
    // two behind the okada rider, on the long bench: feet on the pegs, leaning in, hands on the person in front
    okada: [{ seat: [-.76, 1.0], foot: [-.48, .38, .2], grip: [-.36, 1.22, .2], lean: -.14, door: 0 }, { seat: [-1.08, 1.0], foot: [-.8, .4, .22], grip: [-.72, 1.22, .2], lean: -.1, door: 0 }],
    scooter: [{ seat: [-.7, .97], foot: [-.18, .24, .12], lean: -.02, door: 0 }],
    plane: [], bike: [], skate: []
  };
  SEATS.taxi = SEATS.car;
  V.SEATS = SEATS; V.CABIN = CABIN;
  // the driver's place, mirrored from each proto's anc (for the seat tests: no two seated bodies may touch)
  V.DRIVER = { car: { seat: [.14, .42], side: -.4, lean: .13, scale: .68 }, taxi: { seat: [.14, .42], side: -.4, lean: .13, scale: .68 }, sport: { seat: [-.3, .31], side: -.4, lean: .3, scale: .54 }, pickup: { seat: [.18, .5], side: -.42, lean: .1, scale: .72 },
    bus: { seat: [1.55, .78], side: -.5, lean: .02, scale: .8 }, keke: { seat: [.06, .76], side: 0, lean: -.1, scale: .78 }, okada: { seat: [-.4, 1.0], side: 0, lean: -.18, scale: 1 }, plane: { seat: [.82, 1.04], side: 0, lean: .1, scale: .6 }, scooter: { seat: [-.36, .97], side: 0, lean: -.06, scale: 1 } };
  V.seats = function (v) { var k = v.vk && SEATS[v.vk] ? v.vk : v.type === "taxi" ? "car" : v.type; return SEATS[k] || SEATS.car; };
  V.door = function (v, i) { var s = i < 0 ? { seat: [.1, 0], side: -.4, door: -1 } : V.seats(v)[i]; if (!s) return null; var d = V.dims(v), side = s.door ? s.door * (d.wid / 2 + .6) : (s.side || 0) + .7, ca = Math.cos(v.a), sa = Math.sin(v.a), fx = s.seat[0];
    return S.push(Z.W, v.x + ca * fx - sa * side, v.y + sa * fx + ca * side, .4); };
  V.riders = function (v) { var n = 0; for (var i = 0; i < Z.npcs.length; i++) if (Z.npcs[i].rideV === v) n++; return n + (v.pax || 0); };

  /* ---------- the horn: people ahead look round, then step smartly aside (some complain); traffic ahead gives way,
     and a driver may honk back ---------- */
  var HORNQ = [], SHOUT = ["Ehn! I dey here now!", "You wan run me down?", "Horn horn horn. I hear you!", "Haba! Small small!", "Na road I dey cross o!", "Oga, calm down!"];
  V.horn = function (v) {
    var me = Z.me, ca = Math.cos(v.a), sa = Math.sin(v.a), lists = [Z.peds, Z.npcs], n = 0, i, li;
    for (li = 0; li < 2; li++) for (i = 0; i < lists[li].length; i++) {
      var p = lists[li][i]; if (!p || p.hidden || p.fall > 0 || p.pax || p.follow || p.rideV) continue; var dx = p.x - v.x, dy = p.y - v.y, fw = dx * ca + dy * sa, sd = -dx * sa + dy * ca;
      if (fw < -2 || fw > 15 || Math.abs(sd) > 5 || Math.hypot(dx, dy) > 15) continue;
      if (HORNQ.some(function (q) { return q.o === p; })) continue;
      HORNQ.push({ o: p, t: .25 + rr() * .3, side: sd >= 0 ? 1 : -1, a: v.a, npc: li === 1 }); n++;
    }
    for (i = 0; i < Z.traffic.length; i++) { var t = Z.traffic[i], tx = t.x - v.x, ty = t.y - v.y, tf = tx * ca + ty * sa, ts = Math.abs(-tx * sa + ty * ca); if (tf < 2 || tf > 25 || ts > 3.5) continue;
      t.yieldT = 2.2; if (rr() < .35 && !(t.honkBack > 0)) { t.honkBack = 1; HORNQ.push({ o: t, t: .5 + rr() * .4, car: 1 }); } n++; }
    // birds in the trees nearby take off
    var R3 = Z.r3, tl = plantsNear(v.x, v.y, 25), fl = 0; if (R3 && R3.ready && R3.puff) for (i = 0; i < tl.length && fl < 2; i++) { var tp = tl[i]; if (tp.k === "hedge" || Math.hypot(tp.x - v.x, tp.y - v.y) > 25 || (tp.flown || 0) > (api() ? api().t : 0)) continue; tp.flown = (api() ? api().t : 0) + 20; fl++; R3.puff(tp.x, (tp.h || 5) * .8, tp.y, 0x1f2937, 7, 2.2, 4.5, { size: .13, life: 2.2, grav: -1.2, drag: .4 }); }
    V.log.push({ t: api() ? api().t : 0, kind: "horn", a: v.type, imp: n, names: [] }); return n;
  };
  function hornTick(dt) {
    var me = Z.me;
    for (var i = HORNQ.length - 1; i >= 0; i--) { var q = HORNQ[i], o = q.o; q.t -= dt;
      if (q.car) { if (q.t <= 0) { HORNQ.splice(i, 1); o.honkBack = 0; if (Z.traffic.indexOf(o) >= 0) sfx(HORNS[o.vk === "bus" ? "bus" : o.type] || "horn_car", { x: o.x, y: o.y, ref: 18, gain: .8 }); } continue; }
      if (q.t > 0) { // look round at the noise
        var la = Math.atan2(me.y - o.y, me.x - o.x); o.a += S.angDiff ? S.angDiff(la, o.a) * Math.min(1, dt * 10) : 0; continue; }
      HORNQ.splice(i, 1); if (o.fall > 0) continue;
      o.dodge = .75; o.da = q.a + q.side * Math.PI / 2; o.hornT = 1; // samaru-brawl walks a dodging walker briskly to the side
      if (q.npc && Z.fx && Z.fx.knock) Z.fx.knock(o, o.da, 4); // named people: a quick eased side-step
      if (rr() < .4) { o.wave = 1; if (Z.say) Z.say(o, SHOUT[Math.floor(rr() * SHOUT.length)]); } }
    for (i = 0; i < Z.traffic.length; i++) { var t = Z.traffic[i]; if (t.yieldT > 0) { t.yieldT -= dt; t.v = Math.min(t.v, (t.sp || 6) * .45); } }
  }
  V.plantTick = function (dt) {
    hornTick(dt);
    var hv = Z.me && Z.me.veh, ap = api(); if (hv && ap && ap.down && ap.down("horn")) { V.hornHeld = (V.hornHeld || 0) + dt; if (V.hornHeld > .6) { V.hornHeld = 0; V.horn(hv); } } else V.hornHeld = 0; // a long blast keeps clearing the way
    var me = Z.me, W = Z.W, i; if (!me || !W) return;
    for (i = BENT.length - 1; i >= 0; i--) { var p = BENT[i]; if (p.fxT > 0) p.fxT -= dt; p.bv += (-70 * p.b - 8 * p.bv) * dt; p.b += p.bv * dt;
      if (Math.abs(p.b) < .002 && Math.abs(p.bv) < .02) { p.b = 0; p.bv = 0; bendWrite(p); BENT.splice(i, 1); } else bendWrite(p); }
    var v = me.veh, x, y, a, h, r, vx, vy; if (me.alt > .05 || Z.inside) return;
    if (v) { var A = V.body(v, "me"); x = v.x; y = v.y; a = v.a; h = A.h; r = A.r; vx = v.vx; vy = v.vy; } else { x = me.x; y = me.y; a = me.a; h = 0; r = .3; var cs = me.cs || 0; vx = Math.cos(me.a) * cs; vy = Math.sin(me.a) * cs; }
    var sp = Math.hypot(vx, vy), ux = sp > .01 ? vx / sp : Math.cos(a), uy = sp > .01 ? vy / sp : Math.sin(a);
    var drag = brush(x, y, a, h, r, sp, ux, uy, v, dt); if (v && drag) { var k = Math.exp(-drag * dt); v.vx *= k; v.vy *= k; } // pushing through a hedge costs a little speed
    // crops: farmland swishes as you go through it
    me._cropD = (me._cropD || 0) + sp * dt; if (me._cropD > 2.6) { me._cropD = 0; var ar = sp > 1.5 && S.areaAt ? S.areaAt(W, x, y) : null; if (ar && ar.k === "farmland") { sfx("crops", { x: x, y: y, ref: 10, gain: clamp(.3 + sp * .05, .3, .8) }); var R3 = Z.r3; if (R3 && R3.ready && R3.puff) R3.puff(x, .5, y, 0x9aa35a, 4, 1, .8, { size: .14, life: .9, grav: 3 }); } }
  };
})();
