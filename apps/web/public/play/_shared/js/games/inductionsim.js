/* Induction Dash physics and tracks. A magnet cart crosses a coil of effective length L and width d at speed v.
 * Motional emf ε = N B L v; while inside, current I = ε / R flows and Lenz's law brakes the cart with F = N B² L² v / R
 * (a coil of N turns has N times the resistance of one turn, so ε² / R grows as N, not N²).
 * Energy harvested E = F d = N B² L² v d / R, which equals the kinetic energy lost, and the speed drop is Δv = N B² L² d / (m R).
 * Aluminium brake plates are eddy-current brakes: the same braking force with R_al = 0.25 Ω, but the energy becomes heat.
 * Game-world values: a very strong magnet (B = 2 T), L = 1 m, d = 2 m, R = 0.5 Ω, cart plus rider m = 20 kg. Carts vary B and m. */
(function (root) {
  "use strict";
  var P = { B: 2, L: 1, d: 2, R: 0.5, m: 20, Ral: 0.25, dPlate: 1 };
  function cartP(c) { return c ? { B: c.B, L: P.L, d: P.d, R: P.R, m: c.m } : P; }
  function emf(v, c, n) { var q = cartP(c); return (n || 1) * q.B * q.L * v; }
  function energy(v, c, n) { var q = cartP(c); return (n || 1) * q.B * q.B * q.L * q.L * v * q.d / q.R; }
  function dv(c, n) { var q = cartP(c); return (n || 1) * q.B * q.B * q.L * q.L * q.d / (q.m * q.R); }
  function plateDv(c) { var q = cartP(c); return q.B * q.B * q.L * q.L * P.dPlate / (q.m * P.Ral); } // eddy brake: lost as heat
  function rng(seed) { seed = seed % 2147483647; if (seed <= 0) seed += 2147483646; return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var CRUISE = 14;

  /* Carts: different handling comes from real parameters. Heavier carts lose less speed per coil (Δv ∝ 1/m);
     stronger magnets harvest more per coil but brake harder (both ∝ B²). need = medals required to unlock. */
  var CARTS = [
    { id: "basic", name: "Copper Cart", B: 2.0, m: 20, cruise: 14, hearts: 3, need: 0, col: ["#d62828", "#1f6fb2"], text: "Balanced. B = 2.0 T, 20 kg." },
    { id: "hauler", name: "Iron Hauler", B: 2.0, m: 32, cruise: 13, hearts: 4, need: 8, col: ["#6b7280", "#374151"], text: "Heavy: coils barely slow it (Δv ∝ 1/m). One extra heart, lower top speed." },
    { id: "neo", name: "Neodymium Racer", B: 2.4, m: 20, cruise: 15, hearts: 3, need: 18, col: ["#7c3aed", "#f59e0b"], text: "Stronger magnet: 44% more energy per coil (E ∝ B²), and 44% more braking." },
    { id: "sprint", name: "Carbon Sprinter", B: 1.8, m: 14, cruise: 17, hearts: 2, need: 30, col: ["#111827", "#22d3ee"], text: "Light and fast, but fragile. Each coil still harvests E = B²L²vd/R." },
    { id: "halbach", name: "Halbach Flyer", B: 2.6, m: 26, cruise: 16, hearts: 3, need: 45, col: ["#f8fafc", "#eab308"], text: "A Halbach array focuses the field on one side: B = 2.6 T. The best all-rounder." }
  ];

  /* Six zones of five tracks. Each zone adds one idea, so nothing new appears without its own introduction. */
  var ZONES = [
    { id: "test", name: "Test Track", sky: ["#7ec8ff", "#d6f0ff"], ground: "#3b7a4a", adds: "coils, crates and boost arrows", kinds: ["coil", "block", "boost"], song: "afro" },
    { id: "dusk", name: "Dusk Line", sky: ["#ff9a62", "#ffd27a"], ground: "#4a5a3a", adds: "Entropy drones: they show where they will move before they switch lanes", kinds: ["coil", "block", "boost", "drone"], song: "synthwave" },
    { id: "yard", name: "Eddy Yard", sky: ["#9aa7b8", "#e2e8f0"], ground: "#4b5563", adds: "aluminium brake plates (eddy currents: braking, no energy) and jump ramps", kinds: ["coil", "block", "boost", "drone", "plate", "ramp"], song: "funk" },
    { id: "solenoid", name: "Solenoid Valley", sky: ["#2dd4bf", "#ccfbf1"], ground: "#2f5d50", adds: "double coils (N = 2: twice the energy, twice the braking) and shields", kinds: ["coil", "coil2", "block", "boost", "drone", "plate", "ramp", "shield"], song: "amapiano" },
    { id: "storm", name: "Storm Run", sky: ["#2a1446", "#55307a"], ground: "#2c2a3a", adds: "lightning: a lane flashes, then the bolt lands", kinds: ["coil", "coil2", "block", "boost", "drone", "plate", "bolt", "shield"], song: "breaks" },
    { id: "rail", name: "Entropy's Rail", sky: ["#0b1020", "#3b0d2e"], ground: "#1f1b2e", adds: "everything at once, faster", kinds: ["coil", "coil2", "block", "boost", "drone", "plate", "ramp", "bolt", "shield", "magnet"], song: "boss" }
  ];
  var TRACK_NAMES = [
    ["First light", "Lane school", "Crate hop", "Boost line", "Beacon one"],
    ["Low sun", "Drone watch", "Switchback", "Long shadows", "Beacon two"],
    ["Plate yard", "Ramp step", "Heat sink", "Shunting line", "Beacon three"],
    ["Two turns", "Valley floor", "Shielded run", "Copper canyon", "Beacon four"],
    ["First thunder", "Wet rails", "Strike zone", "Static field", "Beacon five"],
    ["Entropy gate", "Disorder mile", "Echo line", "Last switch", "The final beacon"]
  ];
  var TRACKS = [];
  ZONES.forEach(function (z, zi) {
    TRACK_NAMES[zi].forEach(function (nm, ti) {
      var k = zi * 5 + ti, lvl = k / 29;
      TRACKS.push({ id: z.id + "-" + (ti + 1), name: nm, zone: zi, idx: ti, len: Math.round(420 + 260 * lvl + ti * 25), seed: 7 + k * 13, cruise: CRUISE + Math.round(lvl * 30) / 10,
        coils: .5 - lvl * .06, hazards: .2 + lvl * .14, boosts: .08, drones: zi >= 1 ? .05 + lvl * .07 : 0, kinds: z.kinds, sky: z.sky, ground: z.ground, fresh: ti === 0 ? z.adds : null });
    });
  });

  /* track(st): items along distance (m). kind: coil | coil2 | block | boost | drone | plate | ramp | bolt | shield | magnet; lane 0..2.
     Fair by construction: at any distance at most two of the three lanes hold something you must avoid. */
  var HAZ = { block: 1, drone: 1, plate: 1, bolt: 1 };
  function rowItems(r, x, st, out, diff) {
    var has = function (k) { return st.kinds.indexOf(k) >= 0; }, lane = Math.floor(r() * 3), roll = r(), used = {};
    function put(l, kind) { if (used[l]) return; used[l] = 1; var o = { x: x, lane: l, kind: kind }; if (kind === "drone") { o.lanes = [l, (l + 1 + Math.floor(r() * 2)) % 3]; o.period = 3.2 - diff; } if (kind === "coil2") { o.kind = "coil"; o.n = 2; } out.push(o); }
    var hz = ["block"]; if (has("plate")) hz.push("plate"); if (has("bolt")) hz.push("bolt");
    var c = st.coils, h = st.hazards, b = st.boosts, d = st.drones;
    if (roll < c) put(lane, has("coil2") && r() < .3 ? "coil2" : "coil");
    else if (roll < c + h) put(lane, hz[Math.floor(r() * hz.length)]);
    else if (roll < c + h + b) put(lane, has("ramp") && r() < .35 ? "ramp" : "boost");
    else if (roll < c + h + b + d) put(lane, "drone");
    else if (has("shield") && r() < .08) put(lane, r() < .5 || !has("magnet") ? "shield" : "magnet");
    if (r() < .35) { var l2 = (lane + 1 + Math.floor(r() * 2)) % 3; var hazards = out.filter(function (o) { return o.x === x && HAZ[o.kind]; }).length; var kind = r() < .6 ? "coil" : hz[Math.floor(r() * hz.length)]; if (HAZ[kind] && hazards >= 1) kind = "coil"; put(l2, kind); }
  }
  function track(st) {
    var r = rng(st.seed), out = [], diff = Math.min(1.6, (st.zone || 0) * .25);
    for (var x = 40; x < st.len - 20; x += 14) rowItems(r, x, st, out, diff);
    return out;
  }
  function coilEnergy(items, v, c) { return items.reduce(function (a, o) { return a + (o.kind === "coil" ? energy(v, c, o.n || 1) : 0); }, 0); }
  function potential(st, v) { return coilEnergy(track(st), v || CRUISE); }
  // targets: 38–48% of every coil on the track at cruising speed, rising with the track number; silver 1.3×, gold 1.6× (gold needs near-perfect lane choices)
  TRACKS.forEach(function (st, k) { st.target = Math.round(potential(st, CRUISE) * (0.38 + 0.10 * (k / 29)) / 50) * 50; st.medals = [st.target, Math.round(st.target * 1.3 / 50) * 50, Math.round(st.target * 1.6 / 50) * 50]; });

  /* Endless mode: 120 m chunks, harder with every chunk; the motor's cruising speed creeps up. */
  var ENDLESS = { chunk: 120, cruise0: 14, cruiseStep: 0.18, cruiseMax: 27 };
  function endlessChunk(n, seed) {
    var lvl = Math.min(1, n / 40), zone = Math.min(5, Math.floor(n / 6)), st = { kinds: ZONES[zone].kinds, coils: .5 - lvl * .08, hazards: .2 + lvl * .2, boosts: .08, drones: n > 3 ? .05 + lvl * .1 : 0, zone: zone };
    var r = rng((seed || 1) * 7919 + n * 104729), out = [], x0 = n * ENDLESS.chunk;
    for (var x = x0 + (n ? 0 : 40); x < x0 + ENDLESS.chunk; x += 14) rowItems(r, x, st, out, Math.min(1.6, zone * .25));
    return out;
  }
  function endlessCruise(dist) { return Math.min(ENDLESS.cruiseMax, ENDLESS.cruise0 + ENDLESS.cruiseStep * Math.floor(dist / 100)); }

  var api = { CRUISE: CRUISE, P: P, emf: emf, energy: energy, dv: dv, plateDv: plateDv, CARTS: CARTS, ZONES: ZONES, TRACKS: TRACKS, STAGES: TRACKS, track: track, potential: potential,
    coilEnergy: coilEnergy, ENDLESS: ENDLESS, endlessChunk: endlessChunk, endlessCruise: endlessCruise, rng: rng };
  root.InductionSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
