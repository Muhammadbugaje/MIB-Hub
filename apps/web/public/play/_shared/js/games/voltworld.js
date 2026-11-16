/* Volt City world: map, hero/charge physics and the district challenges. Shared by fieldbound.js (the game) and
 * games/tests/test_volt.py (node). Everything is in SI units; one map tile is 1 m.
 *
 * Physics model (PHYS 122 electrostatics, with disclosed game simplifications):
 *  - Coulomb's law F = k q Q / r² along the line joining two charges; like charges repel, unlike attract.
 *    Charges are small spheres, so r² is softened to r² + s² (s = 0.3 m) and the force stays finite at contact.
 *  - Superposition: the force on a charge is the vector sum of the forces from every source.
 *    For speed, sources more than 9 m away are ignored (a 120 µC pylon there pushes the hero with < 0.35 N).
 *  - Potential V = Σ k Q / r; energy to move a charge q between potentials W = q ΔV.
 *  - Capacitors: q = C V, energy U = ½ C V², RC charging V(t) = Vs (1 − e^(−t/RC)); series 1/C = 1/C₁ + 1/C₂,
 *    parallel C = C₁ + C₂ (ENGG 205 extension).
 *  - Ground friction: static/kinetic μ m g with μ = 0.8. Skimming over water: no friction, linear drag (game model).
 *  - Hero charge ±25 µC and pylon charges ±120 µC are game values: real objects this charged would spark over. */
(function (root) {
  "use strict";
  var K = 8.99e9, G = 9.8, UC = 1e-6;
  var HERO = { q: 25e-6, m: 0.4, r: 0.3, mu: 0.8, walkV: 4.5, walkA: 30, fastA: 6, gain: 9, dragT: 0.6, flyMin: 3.0, fallV: 2.0,
    dashV: 8, maxV: 16, range: 9, soft: 0.3 };
  var PYLON_R = 0.35, PYLON_Q = 120e-6;

  /* ---------- Coulomb's law and superposition ---------- */
  // Force on charge q1 at r1 from q2 at r2, with (dx, dy) = r1 − r2. Positive q1·q2 pushes along +d (repulsion).
  function coulomb(q1, q2, dx, dy, soft) {
    var s2 = (soft == null ? 0 : soft * soft), r2 = dx * dx + dy * dy + s2, f = K * q1 * q2 / (r2 * Math.sqrt(r2));
    return [f * dx, f * dy];
  }
  function forceOn(x, y, q, sources, soft, range, skip) { // superposition over sources [{x, y, q}]
    var fx = 0, fy = 0, rr = (range || 1e9) * (range || 1e9);
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i]; if (s === skip || !s.q) continue;
      var dx = x - s.x, dy = y - s.y; if (dx * dx + dy * dy > rr) continue;
      var f = coulomb(q, s.q, dx, dy, soft == null ? HERO.soft : soft); fx += f[0]; fy += f[1];
    }
    return [fx, fy];
  }
  function fieldAt(x, y, sources, soft, range) { var f = forceOn(x, y, 1, sources, soft, range); return f; } // E = F / q (N/C)
  function potential(x, y, sources, soft) { // V = Σ k Q / r (V)
    var v = 0, s2 = (soft == null ? HERO.soft : soft); s2 *= s2;
    for (var i = 0; i < sources.length; i++) { var s = sources[i], dx = x - s.x, dy = y - s.y; v += K * s.q / Math.sqrt(dx * dx + dy * dy + s2); }
    return v;
  }
  // Grounded conductor (lightning rod): a charge q at distance d is pulled toward it by its image charge,
  // F ≈ k q² / (2d)² (plane-conductor image; a good model close to the rod's tip).
  function imageForce(q, d) { return K * q * q / (4 * d * d); }

  /* ---------- the map (60 × 42 tiles, 1 m each) ----------
   * ,  grass        .  street        :  plaza        ~  water (cross only by flying fast)    b  boardwalk
   * #  building     T  tree          ^  forest edge  h  hedge         |  glass fence (insulator: fields pass)
   * X  Entropy barrier (opens when a district is restored)   G  gate (opens while a crate sits on its plate o)
   * p  lightning-rod pad (Rod Heights)   f  flower bed */
  var W = 60, H = 42;
  var ZONES = { // [x0, y0, x1, y1] inclusive
    hub: [21, 17, 41, 29], relay: [21, 30, 41, 40], docks: [1, 17, 17, 40], gardens: [1, 1, 21, 13], heights: [36, 1, 58, 13], quarter: [44, 17, 58, 40], tower: [22, 1, 35, 12]
  };
  function build() {
    var g = [], x, y;
    for (y = 0; y < H; y++) { g[y] = []; for (x = 0; x < W; x++) g[y][x] = ","; }
    function R(x0, y0, x1, y1, ch) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) g[yy][xx] = ch; }
    function P(xx, yy, ch) { g[yy][xx] = ch; }
    // edges, river, lake, canal
    R(0, 0, 59, 0, "^"); R(0, 41, 59, 41, "^"); R(0, 0, 0, 41, "^"); R(59, 0, 59, 41, "^");
    R(1, 14, 58, 16, "~"); R(22, 1, 35, 13, "~"); R(18, 17, 20, 40, "~");
    R(25, 2, 33, 6, ":"); R(27, 10, 32, 12, ",");                 // Entropy Tower island, stepping islet
    // ---- Central Plaza (hub)
    R(21, 17, 41, 18, "."); R(21, 17, 22, 29, "."); R(21, 29, 41, 29, "."); R(40, 17, 41, 29, ".");
    R(27, 20, 35, 26, ":"); R(26, 23, 36, 23, "."); R(31, 19, 31, 28, ".");
    R(23, 19, 25, 21, "#"); R(23, 25, 25, 27, "#"); R(37, 20, 39, 21, "#"); R(37, 25, 39, 27, "#"); R(28, 27, 30, 28, "#"); R(32, 27, 34, 28, "#");
    P(26, 19, "T"); P(36, 19, "T"); P(26, 27, "T"); P(36, 27, "T"); P(29, 19, "f"); P(33, 19, "f");
    // ---- Relay Row (district 1): pond with relay island, crate pen, gated yard
    R(21, 30, 41, 30, "."); R(24, 30, 24, 40, "."); R(34, 30, 34, 40, ".");
    R(25, 32, 33, 39, "~"); R(28, 34, 30, 36, ":"); P(31, 31, "T"); P(26, 31, "T");
    R(21, 31, 23, 32, "#"); R(21, 36, 23, 40, "#"); R(25, 40, 33, 40, "#");
    R(35, 31, 39, 31, "|"); R(35, 35, 39, 35, "|"); R(35, 32, 35, 34, "|"); R(39, 32, 39, 34, "|"); P(38, 34, "o"); // crate pen
    R(40, 31, 41, 34, "#"); R(36, 36, 41, 36, "#"); R(36, 37, 36, 40, "#"); P(36, 38, "G"); R(37, 40, 41, 40, "#");
    // ---- Capacitor Docks (district 2)
    R(1, 17, 17, 17, "."); R(9, 17, 9, 40, "."); R(1, 29, 17, 29, "."); R(16, 18, 17, 40, ".");
    R(2, 19, 6, 22, "#"); R(11, 19, 14, 21, "#"); R(2, 24, 6, 27, "#"); R(11, 24, 14, 27, "#");
    R(1, 31, 4, 40, "~"); R(5, 32, 7, 33, "#"); R(5, 36, 7, 39, "#"); R(11, 31, 14, 34, "#"); R(11, 39, 14, 40, "#");
    R(5, 34, 7, 35, "b"); R(1, 35, 4, 35, "b");
    // ---- Equipotential Gardens (district 3)
    R(1, 13, 21, 13, "."); R(10, 1, 10, 12, "."); R(1, 7, 21, 7, "."); R(21, 1, 21, 13, ".");
    R(2, 2, 8, 2, "h"); R(2, 2, 2, 5, "h"); R(12, 2, 19, 2, "h"); R(19, 2, 19, 5, "h"); R(3, 9, 7, 11, "h"); R(4, 10, 6, 10, "f");
    R(13, 9, 18, 11, "#"); R(4, 4, 7, 5, "f"); R(13, 4, 17, 5, "f"); P(3, 3, "T"); P(17, 3, "T"); P(8, 9, "T"); P(19, 10, "T"); P(2, 12, "T");
    // ---- Rod Heights (district 4): storm path from the north-east gate to the generator
    R(36, 13, 58, 13, "."); R(36, 1, 36, 13, "."); R(37, 1, 38, 12, ",");
    R(39, 2, 40, 6, "#"); R(52, 9, 57, 11, "#"); R(39, 9, 41, 11, "#");
    R(56, 2, 57, 3, "."); R(43, 3, 55, 3, "."); R(43, 3, 43, 8, "."); R(43, 8, 50, 8, "."); R(50, 8, 50, 11, "."); R(44, 11, 50, 11, ".");
    [[45, 2], [48, 4], [52, 2], [42, 6], [47, 9], [45, 12]].forEach(function (p) { P(p[0], p[1], "p"); });
    P(54, 6, "T"); P(57, 7, "T"); P(37, 4, "T"); P(48, 6, "T");
    // ---- Induction Quarter (district 5)
    R(42, 17, 43, 40, "#"); R(42, 22, 43, 24, "X");
    R(44, 17, 58, 17, "."); R(44, 23, 58, 23, "."); R(50, 17, 50, 40, "."); R(44, 33, 58, 33, ".");
    R(45, 19, 48, 21, "#"); R(52, 19, 57, 21, "#"); R(45, 25, 48, 31, "#"); R(53, 25, 57, 27, "#"); R(45, 35, 48, 40, "#"); R(52, 35, 54, 38, "#");
    P(52, 30, "T"); P(57, 30, "T"); P(56, 39, "T"); P(44, 39, "f");
    return g;
  }
  var MAP = build();

  // Charged pylons: q in µC (sign shows polarity), need = district restorations required before it has power.
  var PYLONS = [
    { id: "pond-w", x: 23.5, y: 35.5, q: 120, need: 0, note: "Slingshot to the relay island" },
    { id: "pond-c", x: 29.5, y: 35.5, q: -120, need: 0, note: "Catch pylon on the island" },
    { id: "plaza-w", x: 22.5, y: 23.5, q: 120, need: 1, note: "Canal crossing to the Docks" },
    { id: "docks-e", x: 16.5, y: 34.5, q: -120, need: 1, note: "Back to the Plaza" },
    { id: "docks-n", x: 8.5, y: 18.5, q: 120, need: 2, note: "River crossing to the Gardens" },
    { id: "garden-s", x: 15.5, y: 12.5, q: -120, need: 2, note: "Back to the Docks" },
    { id: "plaza-ne", x: 39.5, y: 18.5, q: 120, need: 3, note: "River crossing to Rod Heights" },
    { id: "heights-s", x: 37.5, y: 12.5, q: -120, need: 3, note: "Back to the Plaza" },
    { id: "plaza-n", x: 29.5, y: 18.5, q: 120, need: 5, note: "To the Tower islet" },
    { id: "islet", x: 29.5, y: 11.5, q: -120, need: 5, note: "Catch and relaunch to the Tower" },
    { id: "hub-1", x: 35.5, y: 23.5, q: -120, need: 0, note: "Practice pylon" },
    { id: "docks-1", x: 6.5, y: 23.5, q: -120, need: 1 },
    { id: "quarter-1", x: 55.5, y: 29.5, q: 120, need: 4 },
    { id: "garden-1", x: 10.5, y: 4.5, q: 120, need: 2 }
  ];
  var RODS = [ // lightning rods: grounded conductors that discharge charged enemies (and Count Entropy)
    [29.5, 30.5], [38.5, 29.5], [12.5, 23.5], [7.5, 30.5], [5.5, 8.5], [16.5, 6.5], [51.5, 25.5], [46.5, 33.5], [56.5, 18.5],
    [25.5, 2.5], [33.5, 2.5], [25.5, 6.5], [33.5, 6.5]
  ].map(function (p) { return { x: p[0], y: p[1] }; });
  var CRATES = [{ id: "pen", x: 36.5, y: 32.5, q: -60, m: 0.5, mu: 0.4 }];
  var PLATES = [{ x: 38, y: 34, gate: [36, 38] }];
  var BARRIERS = [{ id: "quarter", tiles: [[42, 22], [43, 22], [42, 23], [43, 23], [42, 24], [43, 24]], need: 4 }];
  var START = [31.5, 24.5];

  /* Districts in story order. stage = number reported to the server. */
  var DISTRICTS = [
    { id: "relay", stage: 1, name: "Relay Row", zone: "relay", col: "#f6c445", center: [31, 35], song: [301, "synthwave"], tint: "#2a2a3a",
      blurb: "Steer probe charges with electric fields to restart two relays." },
    { id: "docks", stage: 2, name: "Capacitor Docks", zone: "docks", col: "#7ef0ff", center: [9, 28], song: [402, "dub"], tint: "#1d2c3a",
      blurb: "Charge the dock capacitor bank to the right charge and energy: q = CV, U = ½CV²." },
    { id: "gardens", stage: 3, name: "Equipotential Gardens", zone: "gardens", col: "#3dd68c", center: [10, 7], song: [503, "calm"], tint: "#1d3328",
      blurb: "Walk the equipotential paths: moving along equal V costs no work." },
    { id: "heights", stage: 4, name: "Rod Heights", zone: "heights", col: "#ff9d5c", center: [47, 7], song: [604, "breaks"], tint: "#33291f",
      blurb: "Place lightning rods to ground a storm of charged Entropy sparks." },
    { id: "quarter", stage: 5, name: "Induction Quarter", zone: "quarter", col: "#c084fc", center: [51, 29], song: [705, "funk"], tint: "#2b2238",
      blurb: "Charge a gold-leaf electroscope by contact and by induction." },
    { id: "tower", stage: 6, name: "Entropy Tower", zone: "tower", col: "#ff6b9a", center: [29, 5], song: [806, "boss"], tint: "#2a1830",
      blurb: "Ground Count Entropy on his own lightning rods." }
  ];
  var CONSOLES = [ // interactive challenge points
    { id: "relayA", d: "relay", x: 28.5, y: 34.5, kind: "probe", level: 0, label: "Relay A" },
    { id: "relayB", d: "relay", x: 39.5, y: 38.5, kind: "probe", level: 1, label: "Relay B" },
    { id: "cap", d: "docks", x: 7.5, y: 28.5, kind: "cap", label: "Capacitor bank" },
    { id: "relayC", d: "docks", x: 15.5, y: 38.5, kind: "probe", level: 2, label: "Harbour relay (bonus)", bonus: true },
    { id: "equi", d: "gardens", x: 11.5, y: 5.5, kind: "equi", label: "Garden gazebo" },
    { id: "td", d: "heights", x: 44.5, y: 10.5, kind: "td", label: "Storm generator" },
    { id: "scope", d: "quarter", x: 51.5, y: 28.5, kind: "scope", label: "Electroscope lab" },
    { id: "relayD", d: "quarter", x: 55.5, y: 37.5, kind: "probe", level: 3, label: "Market relay (bonus)", bonus: true },
    { id: "boss", d: "tower", x: 29.5, y: 4.5, kind: "boss", label: "Entropy Tower" }
  ];
  // Pylon crossings that link areas. The test flies each one with the real hero physics.
  // from: where the hero starts; pylon: the launch pylon; to: an area id the hero must land in.
  var CROSSINGS = [
    { id: "pond-in", pylon: "pond-w", from: [24.4, 35.5], to: "pond-island", need: 0 },
    { id: "pond-out", pylon: "pond-c", from: [30.6, 35.5], to: "relay", need: 0 },
    { id: "canal-w", pylon: "plaza-w", from: [21.6, 23.5], to: "docks", need: 1 },
    { id: "canal-e", pylon: "docks-e", from: [17.4, 34.5], to: "relay", need: 1 },
    { id: "river-n", pylon: "docks-n", from: [8.5, 17.4], to: "gardens", need: 2 },
    { id: "river-s", pylon: "garden-s", from: [15.5, 13.4], to: "docks", need: 2 },
    { id: "heights-n", pylon: "plaza-ne", from: [39.5, 17.4], to: "heights", need: 3 },
    { id: "heights-s", pylon: "heights-s", from: [37.5, 13.4], to: "hub", need: 3 },
    { id: "islet-n", pylon: "plaza-n", from: [29.5, 17.4], to: "islet", need: 5 },
    { id: "tower-n", pylon: "islet", from: [29.5, 10.6], to: "tower", need: 5 }
  ];
  var CRYSTALS = [
    [22.5, 20.5], [40.5, 28.5], [35.5, 24.5], [28.5, 36.5], [32.5, 31.5], [40.5, 38.5], [22.5, 34.5],
    [2.5, 18.5], [15.5, 30.5], [6.5, 34.5], [10.5, 39.5], [2.5, 35.5],
    [3.5, 6.5], [18.5, 4.5], [5.5, 12.5], [14.5, 7.5],
    [57.5, 12.5], [38.5, 7.5], [46.5, 6.5], [56.5, 4.5],
    [57.5, 18.5], [44.5, 34.5], [57.5, 40.5], [49.5, 24.5], [31.5, 11.5]
  ];
  var TRAILS = [{ id: "none", name: "No trail", need: 0, col: null }, { id: "spark", name: "Spark trail", need: 5, col: "#ffd84a" },
    { id: "field", name: "Field-line trail", need: 10, col: "#7ef0ff" }, { id: "aurora", name: "Aurora trail", need: 15, col: "#3dd68c" },
    { id: "rainbow", name: "Rainbow trail", need: 20, col: "rainbow" }, { id: "entropy", name: "Tamed-entropy trail", need: 25, col: "#c084fc" }];

  /* ---------- world state helpers ---------- */
  function tile(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? "^" : MAP[y][x]; }
  function zoneOf(x, y) { for (var k in ZONES) { var z = ZONES[k]; if (x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3]) return k; } return null; }
  function areaOf(x, y) { // finer areas used by the reachability test
    if (x >= 28 && x < 31 && y >= 34 && y < 37) return "pond-island";
    if (x >= 27 && x < 33 && y >= 10 && y < 13) return "islet";
    if (x >= 25 && x < 34 && y >= 2 && y < 7) return "tower";
    return zoneOf(x, y);
  }
  // A world state: restored = number of districts restored so far; open = {gate/barrier keys}; extra sources/circles.
  function makeState(restored, opts) {
    opts = opts || {};
    var ws = { restored: restored, open: opts.open || {}, sources: [], circles: [], pylons: [] };
    PYLONS.forEach(function (p) { var on = restored >= p.need; var s = { id: p.id, x: p.x, y: p.y, q: on ? p.q * UC : 0, on: on, r: PYLON_R, pylon: true }; ws.pylons.push(s); if (on) ws.sources.push(s); ws.circles.push(s); });
    RODS.forEach(function (r) { ws.circles.push({ x: r.x, y: r.y, r: 0.2, rod: true }); });
    ws.solidTile = function (tx, ty) {
      var t = tile(tx, ty);
      if (t === "#" || t === "T" || t === "^" || t === "|" || t === "h") return true;
      if (t === "G") return !ws.open["gate:" + tx + "," + ty];
      if (t === "X") return restored < 4 && !ws.open.barrier;
      return false;
    };
    return ws;
  }

  /* ---------- hero physics (used by the game every 1/120 s and by the tests) ---------- */
  function blocked(h, x, y, ws, fast) {
    var r = HERO.r, pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (var i = 0; i < 4; i++) { var tx = Math.floor(pts[i][0]), ty = Math.floor(pts[i][1]);
      if (ws.solidTile(tx, ty)) return true;
      if (tile(tx, ty) === "~" && !fast && tile(Math.floor(h.x), Math.floor(h.y)) !== "~") return true; } // too slow to skim onto water
    return false;
  }
  function heroStep(h, inp, ws, dt) {
    var F = forceOn(h.x, h.y, h.q, ws.sources, HERO.soft, HERO.range, h.self), ax = F[0] / HERO.m, ay = F[1] / HERO.m;
    h.F = F; var sp = Math.hypot(h.vx, h.vy), onWater = tile(Math.floor(h.x), Math.floor(h.y)) === "~" && tile(Math.floor(h.x), Math.floor(h.y)) !== "b";
    h.water = onWater; h.bonk = 0;
    if (onWater) { ax -= h.vx / HERO.dragT; ay -= h.vy / HERO.dragT; }
    else {
      var ix = inp.x || 0, iy = inp.y || 0, im = Math.hypot(ix, iy), fr = HERO.mu * G;
      if (im > 0) {
        ix /= im; iy /= im; var lim = sp > HERO.walkV + .5 ? HERO.fastA : HERO.walkA, dx = (ix * HERO.walkV - h.vx) * HERO.gain, dy = (iy * HERO.walkV - h.vy) * HERO.gain, dm = Math.hypot(dx, dy);
        if (dm > lim) { dx *= lim / dm; dy *= lim / dm; } ax += dx; ay += dy;
      } else if (sp < 0.05) { var am = Math.hypot(ax, ay); if (am <= fr) { ax = ay = 0; h.vx = h.vy = 0; } else { ax -= ax / am * fr; ay -= ay / am * fr; } }
      else { var dec = Math.min(fr, sp / dt); ax -= h.vx / sp * dec; ay -= h.vy / sp * dec; }
    }
    h.vx += ax * dt; h.vy += ay * dt;
    sp = Math.hypot(h.vx, h.vy); if (sp > HERO.maxV) { h.vx *= HERO.maxV / sp; h.vy *= HERO.maxV / sp; sp = HERO.maxV; }
    var fast = sp >= HERO.flyMin, nx = h.x + h.vx * dt, ny = h.y + h.vy * dt;
    if (blocked(h, nx, h.y, ws, fast)) { if (Math.abs(h.vx) > 4) h.bonk = Math.abs(h.vx); h.vx = 0; } else h.x = nx;
    if (blocked(h, h.x, ny, ws, fast)) { if (Math.abs(h.vy) > 4) h.bonk = Math.max(h.bonk, Math.abs(h.vy)); h.vy = 0; } else h.y = ny;
    for (var i = 0; i < ws.circles.length; i++) { // round obstacles: pylons, rods, crates
      var c = ws.circles[i], ddx = h.x - c.x, ddy = h.y - c.y, d = Math.hypot(ddx, ddy), mn = HERO.r + c.r;
      if (d < mn && d > 1e-6) { var nxu = ddx / d, nyu = ddy / d; h.x = c.x + nxu * mn; h.y = c.y + nyu * mn; var vn = h.vx * nxu + h.vy * nyu; if (vn < 0) { h.vx -= vn * nxu; h.vy -= vn * nyu; } h.touch = c; }
    }
    var still = tile(Math.floor(h.x), Math.floor(h.y)) === "~";
    if (still && Math.hypot(h.vx, h.vy) < HERO.fallV) { h.fell = true; }
    if (!still && Math.hypot(h.vx, h.vy) < HERO.walkV + 1) { h.safe = [h.x, h.y]; }
    return h;
  }
  function newHero(x, y, sign) { return { x: x, y: y, vx: 0, vy: 0, q: (sign || 1) * HERO.q, F: [0, 0], safe: [x, y] }; }
  // A scripted crossing: get attracted onto the pylon from `from` (holding toward it or toward `aim`'s opposite), then flip.
  function flyCrossing(c, ws) {
    var p = PYLONS.filter(function (q) { return q.id === c.pylon; })[0], sign = p.q > 0 ? -1 : 1, h = newHero(c.from[0], c.from[1], sign), dt = 1 / 120, t;
    // the player walks at the pylon until touching it, lets go (attraction holds them there), then flips
    for (t = 0; t < 1.5; t += dt) { var dx = p.x - h.x, dy = p.y - h.y, touching = Math.hypot(dx, dy) < HERO.r + PYLON_R + 0.02; heroStep(h, touching ? {} : { x: dx, y: dy }, ws, dt); }
    h.q = -h.q; var path = [[h.x, h.y]];
    for (t = 0; t < 5; t += dt) { heroStep(h, {}, ws, dt); if (h.fell) break; path.push([h.x, h.y]); }
    return { fell: !!h.fell, x: h.x, y: h.y, area: areaOf(Math.floor(h.x), Math.floor(h.y)), path: path };
  }

  /* ---------- charged crates: pushed or pulled by the hero's field, held back by static friction μ m g ---------- */
  function crateStep(c, sources, ws, dt) {
    var F = forceOn(c.x, c.y, c.q * UC, sources, HERO.soft, HERO.range, c), fm = Math.hypot(F[0], F[1]), fr = c.mu * c.m * G, sp = Math.hypot(c.vx || 0, c.vy || 0);
    c.vx = c.vx || 0; c.vy = c.vy || 0; var ax = F[0] / c.m, ay = F[1] / c.m;
    if (sp < 0.02) { if (fm <= fr) { c.vx = c.vy = 0; return c; } ax -= F[0] / fm * fr / c.m; ay -= F[1] / fm * fr / c.m; }
    else { var dec = Math.min(fr / c.m, sp / dt); ax -= c.vx / sp * dec; ay -= c.vy / sp * dec; }
    c.vx += ax * dt; c.vy += ay * dt; var r = 0.35;
    function hit(x, y) { return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].some(function (p) { var tx = Math.floor(p[0]), ty = Math.floor(p[1]); return ws.solidTile(tx, ty) || tile(tx, ty) === "~"; }); }
    var nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (hit(nx, c.y)) c.vx = 0; else c.x = nx;
    if (hit(c.x, ny)) c.vy = 0; else c.y = ny;
    return c;
  }
  function onPlate(c) { return PLATES.filter(function (p) { return Math.floor(c.x) === p.x && Math.floor(c.y) === p.y; })[0] || null; }

  /* ---------- reachability (walking + verified crossings) ---------- */
  function walkable(ws, x, y) { var t = tile(x, y); return t !== "~" && !ws.solidTile(x, y); }
  function flood(ws, sx, sy, seen) {
    var q = [[sx, sy]], out = []; seen[sx + "," + sy] = 1;
    while (q.length) { var c = q.pop(); out.push(c); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = c[0] + d[0], ny = c[1] + d[1], k = nx + "," + ny; if (!seen[k] && walkable(ws, nx, ny)) { seen[k] = 1; q.push([nx, ny]); } }); }
    return out;
  }
  function reachable(restored, opts) { // tiles reachable from START with `restored` districts done
    var ws = makeState(restored, opts), seen = {}, frontier = [[Math.floor(START[0]), Math.floor(START[1])]], landed = {}, guard = 0;
    while (frontier.length && guard++ < 50) {
      var s = frontier.pop(); if (seen[s[0] + "," + s[1]]) continue; flood(ws, s[0], s[1], seen);
      CROSSINGS.forEach(function (c) {
        if (restored < c.need || landed[c.id] || !seen[Math.floor(c.from[0]) + "," + Math.floor(c.from[1])]) return;
        var r = flyCrossing(c, ws); if (r.fell) return; landed[c.id] = r; frontier.push([Math.floor(r.x), Math.floor(r.y)]);
      });
    }
    return { seen: seen, landed: landed, ws: ws };
  }

  /* ---------- Capacitor Docks: charge the bank (q = CV, U = ½CV², RC charging) ---------- */
  var CAP = { rounds: [
    { title: "Fill the crane's capacitor", caps: [470], Vs: 20, R: 4700, target: { q: 5.64e-3 }, tol: 0.05,
      brief: "The crane magnet needs a charge of q = 5.64 mC from its 470 µF capacitor. Charge it, then fire." },
    { title: "Wake the swing bridge", caps: [1000, 2200, 4700], Vs: 24, R: 2200, vmax: 12, target: { E: 0.135 }, tol: 0.06,
      brief: "The swing bridge needs U = ½CV² = 0.135 J, but its insulation is rated to 12 V. Pick a capacitor that can store it below 12 V." },
    { title: "Combine the dock bank", caps: [220, 330], modes: ["series", "parallel"], Vs: 12, R: 1000, vmax: 12, target: { q: 5.5e-3 }, tol: 0.05,
      brief: "Two capacitors, 220 µF and 330 µF. Wire them in series or parallel so they hold q = 5.5 mC at 12 V or less. (ENGG 205: parallel C add, series 1/C add.)" }
  ] };
  function capC(round, opt) { // µF → F for the chosen option
    var a = round.caps[0] * UC, b = (round.caps[1] || 0) * UC;
    if (round.modes) return round.modes[opt] === "series" ? 1 / (1 / a + 1 / b) : a + b;
    return round.caps[opt] * UC;
  }
  function capOptions(round) { return round.modes ? round.modes.length : round.caps.length; }
  function capCharge(V, Vs, R, C, dt) { return Vs + (V - Vs) * Math.exp(-dt / (R * C)); }       // RC charging
  function capBleed(V, R, C, dt) { return V * Math.exp(-dt / (2 * R * C)); }                      // discharge via 2R
  function capCheck(round, opt, V) {
    var C = capC(round, opt), q = C * V, E = 0.5 * C * V * V, tg = round.target, want = tg.q != null ? tg.q : tg.E, got = tg.q != null ? q : E;
    if (round.vmax && V > round.vmax * 1.001) return { ok: false, q: q, E: E, why: "Over " + round.vmax + " V: the insulation would break down." };
    var err = (got - want) / want;
    return { ok: Math.abs(err) <= round.tol, q: q, E: E, err: err, why: err > 0 ? "Too much: discharge a little." : "Not enough yet: keep charging." };
  }
  function capNeedV(round, opt) { var C = capC(round, opt), tg = round.target; return tg.q != null ? tg.q / C : Math.sqrt(2 * tg.E / C); }
  function capWindow(round, opt) { // seconds the charging voltage spends inside the accepted window (≥ 0.15 s is playable)
    var C = capC(round, opt), Vs = round.Vs, need = capNeedV(round, opt), tol = round.tol, lo, hi;
    if (round.target.q != null) { lo = need * (1 - tol); hi = need * (1 + tol); } else { lo = need * Math.sqrt(1 - tol); hi = need * Math.sqrt(1 + tol); }
    if (round.vmax) hi = Math.min(hi, round.vmax); if (hi > Vs * 0.995) hi = Vs * 0.995; if (lo >= hi) return 0;
    var tau = round.R * C; return tau * (Math.log(Vs / (Vs - hi)) - Math.log(Vs / (Vs - lo)));
  }

  /* ---------- Equipotential Gardens: move along equal-V bands; crossing a band costs or returns W = qΔV ---------- */
  var EQUI = { qProbe: 2e-6, levels: [
    { name: "Lily ring", cols: 11, rows: 7, cell: 0.5, charges: [{ c: 5, r: 3, q: 0.06 }], step: 250, start: [0, 3], goal: [10, 3], battery: 3, cap: 3,
      blocks: [[5, 0], [5, 1], [5, 5], [5, 6]], hint: "Rings around a single charge are equipotentials. The hedges force you over the hill: climbing three rings costs all your battery, and you get it back coming down." },
    { name: "Dipole hedge", cols: 11, rows: 7, cell: 0.5, charges: [{ c: 3, r: 3, q: 0.05 }, { c: 7, r: 3, q: -0.05 }], step: 250, start: [0, 0], goal: [10, 6], battery: 1, cap: 3,
      blocks: [[5, 0], [5, 1], [5, 5], [5, 6], [2, 0], [2, 6], [8, 0], [8, 6], [1, 1], [9, 5]], hint: "A + and a − charge (a dipole). The V = 0 line runs straight between them: cross there. Heading down toward the − charge banks energy for the climb to the gate." }
  ] };
  function eqV(L, c, r) { var src = L.charges.map(function (q) { return { x: (q.c + .5) * L.cell, y: (q.r + .5) * L.cell, q: q.q * UC }; }); return potential((c + .5) * L.cell, (r + .5) * L.cell, src, L.cell * 0.6); }
  function eqBand(L, c, r) { return Math.round(eqV(L, c, r) / L.step); }
  function eqBlocked(L, c, r) { if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return true; if (L.charges.some(function (q) { return q.c === c && q.r === r; })) return true; return L.blocks.some(function (b) { return b[0] === c && b[1] === r; }); }
  // Try a move: returns {ok, e (new battery in band-steps), why}. Band change of ±1 only; up costs 1, down returns 1 (capped).
  function eqMove(L, s, dc, dr) {
    var c = s.c + dc, r = s.r + dr; if (eqBlocked(L, c, r)) return { ok: false, why: "Blocked." };
    var d = eqBand(L, c, r) - eqBand(L, s.c, s.r);
    if (Math.abs(d) > 1) return { ok: false, why: "That jumps " + Math.abs(d) + " equipotentials at once: the field is too steep there." };
    var e = s.e - d; if (e < 0) return { ok: false, why: "Not enough stored energy to climb: W = qΔV." };
    return { ok: true, c: c, r: r, e: Math.min(L.cap, e), d: d };
  }
  function eqSolve(L) { // BFS over (cell, energy)
    var start = { c: L.start[0], r: L.start[1], e: L.battery }, q = [start], seen = {}, prev = {};
    seen[start.c + "," + start.r + "," + start.e] = 1;
    while (q.length) { var s = q.shift(); if (s.c === L.goal[0] && s.r === L.goal[1]) { var path = [], k = s.c + "," + s.r + "," + s.e; while (k) { path.unshift(k); k = prev[k]; } return path; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var m = eqMove(L, s, d[0], d[1]); if (!m.ok) return; var k = m.c + "," + m.r + "," + m.e; if (seen[k]) return; seen[k] = 1; prev[k] = s.c + "," + s.r + "," + s.e; q.push({ c: m.c, r: m.r, e: m.e }); }); }
    return null;
  }

  /* ---------- Induction Quarter: gold-leaf electroscope (charges in units of a few nC) ---------- */
  var SCOPE = { d: 2, rounds: [
    { title: "Charge by contact", rod: -1, goal: -1, brief: "Ebonite rubbed with fur is negative. Leave the electroscope with a NEGATIVE charge." },
    { title: "Charge by induction", rod: -1, goal: 1, brief: "Same negative rod, but now leave the electroscope POSITIVE. Touching would give it the rod's sign..." },
    { title: "Induction, reversed", rod: 1, goal: -1, brief: "Glass rubbed with silk is positive. Leave the electroscope NEGATIVE." },
    { title: "Mystery rod", rod: 0, goal: 0, quiz: true, start: 2, brief: "The electroscope already holds a positive charge. Bring the mystery rod near and watch the leaves: is the rod + or −?" }
  ] };
  function scopeNew(round) { return { N: round.start || 0, near: false, ground: false }; }
  function scopeDist(s, rod) { // returns cap and leaf charges. A charged rod near the cap pushes like charge to the leaves.
    if (s.ground) { var c = s.near ? -rod * SCOPE.d : 0; return { cap: c, leaves: 0 }; }
    var ind = s.near ? rod * SCOPE.d : 0; return { cap: s.N / 2 - ind, leaves: s.N / 2 + ind };
  }
  function scopeAct(s, rod, act) { // near | away | touch | ground | unground
    var n = { N: s.N, near: s.near, ground: s.ground };
    if (act === "near") n.near = true; else if (act === "away") n.near = false;
    else if (act === "ground") n.ground = true; else if (act === "unground") n.ground = false;
    else if (act === "touch") { if (!n.near) return { s: n, why: "Bring the rod near first." }; if (!n.ground) n.N = Math.max(-4, Math.min(4, n.N + 2 * rod)); }
    if (n.ground) n.N = scopeDist(n, rod).cap; // charge flows to or from earth until the leaves are neutral
    return { s: n };
  }
  function scopeDone(s, round) { return !s.near && !s.ground && Math.sign(s.N) === round.goal; }
  function scopeSolve(round) { // shortest action list
    var acts = ["near", "away", "touch", "ground", "unground"], start = scopeNew(round), q = [[start, []]], seen = {};
    while (q.length) { var it = q.shift(), s = it[0]; if (scopeDone(s, round)) return it[1]; if (it[1].length > 6) continue;
      acts.forEach(function (a) { var n = scopeAct(s, round.rod, a).s, k = n.N + "," + n.near + "," + n.ground; if (!seen[k]) { seen[k] = 1; q.push([n, it[1].concat([a])]); } }); }
    return null;
  }

  /* ---------- Rod Heights: storm wave along a path; rods ground enemies that come close ---------- */
  var TD = { path: [[56.5, 2.5], [56.5, 3.5], [43.5, 3.5], [43.5, 8.5], [50.5, 8.5], [50.5, 11.5], [44.5, 11.5]], gen: [44.5, 10.5],
    pads: [[45.5, 2.5], [48.5, 4.5], [52.5, 2.5], [42.5, 6.5], [47.5, 9.5], [45.5, 12.5]], rods: 3, rodR: 1.4, rodCool: 1.0, protectR: 3.2, steer: 6, pull: 0, // pull: image-force radius (0 in the wave; the hero does the pulling)
   
    strikeEvery: 7, genHP: 5, eq: 12e-6, em: 0.08,
    waves: [{ n: 6, gap: 1.2, v: 1.5 }, { n: 9, gap: 0.8, v: 1.7 }, { n: 12, gap: 0.6, v: 1.9, tough: 3 }] };
  function tdNew(rodPads) {
    return { t: 0, wave: 0, spawned: 0, next: 1.5, hp: TD.genHP, enemies: [], rods: rodPads.map(function (i) { return { pad: i, x: TD.pads[i][0], y: TD.pads[i][1], cool: 0 }; }),
      strikeT: TD.strikeEvery, done: false, won: false, grounded: 0, events: [] };
  }
  function tdStep(s, dt, extra) { // extra(e) → [ax, ay] lets the game add the hero's Coulomb force
    if (s.done) return s; s.t += dt; s.events.length = 0;
    var w = TD.waves[s.wave];
    if (w) { s.next -= dt; if (s.next <= 0 && s.spawned < w.n) { var tough = w.tough && s.spawned % w.tough === w.tough - 1;
        s.enemies.push({ x: TD.path[0][0], y: TD.path[0][1], vx: 0, vy: 0, wp: 1, q: (s.spawned % 2 ? -1 : 1) * TD.eq * (tough ? 1.6 : 1), hp: tough ? 2 : 1, v: w.v * (tough ? .8 : 1), tough: !!tough });
        s.spawned++; s.next = w.gap; s.events.push("spawn"); }
      if (s.spawned >= w.n && !s.enemies.length) { s.wave++; s.spawned = 0; s.next = 3; s.events.push("wave"); if (s.wave >= TD.waves.length) { s.done = true; s.won = s.hp > 0; return s; } } }
    s.rods.forEach(function (r) { r.cool = Math.max(0, r.cool - dt); });
    for (var i = s.enemies.length - 1; i >= 0; i--) {
      var e = s.enemies[i], wp = TD.path[Math.min(e.wp, TD.path.length - 1)], dx = wp[0] - e.x, dy = wp[1] - e.y, d = Math.hypot(dx, dy);
      if (d < 0.25 && e.wp < TD.path.length - 1) e.wp++;
      var ax = (dx / (d || 1) * e.v - e.vx) * TD.steer, ay = (dy / (d || 1) * e.v - e.vy) * TD.steer;
      s.rods.forEach(function (r) { var rx = r.x - e.x, ry = r.y - e.y, rd = Math.max(0.3, Math.hypot(rx, ry)); if (rd < TD.pull) { var f = imageForce(e.q, rd) / TD.em; ax += rx / rd * f; ay += ry / rd * f; } });
      if (extra) { var ex = extra(e); ax += ex[0]; ay += ex[1]; }
      e.vx += ax * dt; e.vy += ay * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      var hit = null; s.rods.forEach(function (r) { if (!hit && r.cool <= 0 && Math.hypot(r.x - e.x, r.y - e.y) < TD.rodR) hit = r; });
      if (hit) { hit.cool = TD.rodCool; e.hp--; s.events.push(["zap", hit.x, hit.y, e.x, e.y]); if (e.hp <= 0) { s.enemies.splice(i, 1); s.grounded++; continue; } }
      if (Math.hypot(TD.gen[0] - e.x, TD.gen[1] - e.y) < 0.6 && e.wp >= TD.path.length - 1) { s.hp--; s.enemies.splice(i, 1); s.events.push("hurt"); }
    }
    s.strikeT -= dt;
    if (s.strikeT <= 0) { s.strikeT = TD.strikeEvery; var guard = s.rods.filter(function (r) { return Math.hypot(r.x - TD.gen[0], r.y - TD.gen[1]) <= TD.protectR; })[0];
      if (guard) s.events.push(["strike", guard.x, guard.y, true]); else { s.hp--; s.events.push(["strike", TD.gen[0], TD.gen[1], false]); } }
    if (s.hp <= 0) { s.done = true; s.won = false; }
    return s;
  }
  function tdRun(rodPads) { var s = tdNew(rodPads), dt = 1 / 60; while (!s.done && s.t < 300) tdStep(s, dt); return s; }

  var api = { K: K, G: G, HERO: HERO, PYLON_R: PYLON_R, PYLON_Q: PYLON_Q, W: W, H: H, MAP: MAP, ZONES: ZONES, PYLONS: PYLONS, RODS: RODS, CRATES: CRATES, PLATES: PLATES,
    BARRIERS: BARRIERS, START: START, DISTRICTS: DISTRICTS, CONSOLES: CONSOLES, CROSSINGS: CROSSINGS, CRYSTALS: CRYSTALS, TRAILS: TRAILS,
    coulomb: coulomb, forceOn: forceOn, fieldAt: fieldAt, potential: potential, imageForce: imageForce, tile: tile, zoneOf: zoneOf, areaOf: areaOf,
    makeState: makeState, heroStep: heroStep, crateStep: crateStep, onPlate: onPlate, newHero: newHero, flyCrossing: flyCrossing, reachable: reachable,
    CAP: CAP, capC: capC, capOptions: capOptions, capCharge: capCharge, capBleed: capBleed, capCheck: capCheck, capNeedV: capNeedV, capWindow: capWindow,
    EQUI: EQUI, eqV: eqV, eqBand: eqBand, eqBlocked: eqBlocked, eqMove: eqMove, eqSolve: eqSolve,
    SCOPE: SCOPE, scopeNew: scopeNew, scopeDist: scopeDist, scopeAct: scopeAct, scopeDone: scopeDone, scopeSolve: scopeSolve,
    TD: TD, tdNew: tdNew, tdStep: tdStep, tdRun: tdRun };
  root.VoltWorld = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
