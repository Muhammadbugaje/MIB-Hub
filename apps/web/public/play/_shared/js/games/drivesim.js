/* Drive Room: separately excited DC motor drive (EEEN 524: introduction to electric drives).
 * Armature: La·dIa/dt = Va − Ra·Ia − Kφ·ω.  Torque T = Kφ·Ia.  Mechanics: J·dω/dt = T − TL(ω, t) − B·ω.
 * Field weakening above base speed: φ is reduced so the back-emf Kφ·ω stays within the converter's voltage.
 * Converters (average-value models): 1-phase full converter Va = (2√2/π)·Vs·cos α; 3-phase full converter
 * Va = (3√2/π)·VLL·cos α; step-down chopper Va = D·Vdc. Fully controlled bridges pass current one way only, so they
 * work in quadrants I and IV; a class-A chopper only in quadrant I; a two-quadrant (class C) chopper in I and II;
 * a dual converter or four-quadrant (class E) chopper in all four.
 * Control: speed PI → armature current reference (limited) → current PI → converter voltage (limited).
 * Loads: constant torque (conveyor, friction sign follows speed), hoist (gravity: same sign both ways), fan (T ∝ ω²),
 * winder (constant power, T = P/ω). SI units throughout (rad/s, N·m, A, V). */
(function (root) {
  "use strict";
  var SQ2 = Math.SQRT2, PI = Math.PI;
  var CONVERTERS = [
    { id: "c1a", name: "Step-down chopper (class A)", short: "Chopper A", supply: "dc", vmax: function (s) { return s.vdc; }, vmin: function () { return 0; }, ineg: false, quads: [1], cost: 400 },
    { id: "f1", name: "1-phase full converter", short: "1φ bridge", supply: "ac1", vmax: function (s) { return 2 * SQ2 / PI * s.vs; }, vmin: function (s) { return -2 * SQ2 / PI * s.vs; }, ineg: false, quads: [1, 4], cost: 300 },
    { id: "f3", name: "3-phase full converter", short: "3φ bridge", supply: "ac3", vmax: function (s) { return 3 * SQ2 / PI * s.vll; }, vmin: function (s) { return -3 * SQ2 / PI * s.vll; }, ineg: false, quads: [1, 4], cost: 600 },
    { id: "c2q", name: "Two-quadrant chopper (class C)", short: "Chopper C", supply: "dc", vmax: function (s) { return s.vdc; }, vmin: function () { return 0; }, ineg: true, quads: [1, 2], cost: 650 },
    { id: "c4q", name: "Four-quadrant chopper (class E)", short: "Chopper E", supply: "dc", vmax: function (s) { return s.vdc; }, vmin: function (s) { return -s.vdc; }, ineg: true, quads: [1, 2, 3, 4], cost: 1000 },
    { id: "dual", name: "3-phase dual converter", short: "Dual bridge", supply: "ac3", vmax: function (s) { return 3 * SQ2 / PI * s.vll; }, vmin: function (s) { return -3 * SQ2 / PI * s.vll; }, ineg: true, quads: [1, 2, 3, 4], cost: 1200 }
  ];
  var BYCONV = {}; CONVERTERS.forEach(function (c) { BYCONV[c.id] = c; });
  /* motors: rated V, A, rad/s (base), Ra Ω, La H, Kφ V·s/rad, J kg·m², B N·m·s */
  var MOTORS = {
    small: { name: "5 kW, 220 V", V: 220, I: 25, wb: 150, Ra: 0.8, La: 0.012, Kphi: 1.33, J: 0.25, B: 0.01 },
    mid: { name: "22 kW, 440 V", V: 440, I: 55, wb: 160, Ra: 0.35, La: 0.008, Kphi: 2.6, J: 1.2, B: 0.03 },
    big: { name: "75 kW, 460 V", V: 460, I: 180, wb: 120, Ra: 0.08, La: 0.004, Kphi: 3.7, J: 6, B: 0.1 }
  };
  function load(L, w, t) {
    var k = L.kind, T = L.t0 || 0, s = w > 0.5 ? 1 : w < -0.5 ? -1 : w / 0.5;
    if (k === "conveyor") T = L.t0 * s;
    else if (k === "hoist") T = L.t0;                       // gravity pulls the same way whichever way the cage moves
    else if (k === "fan") T = L.k2 * w * Math.abs(w);
    else if (k === "winder") T = Math.min(L.tmax, L.p / Math.max(10, Math.abs(w))) * s;
    if (L.bump) L.bump.forEach(function (b) { if (t >= b.t && t < b.t + b.d) T += b.dT; });
    return T;
  }
  function refAt(L, t) { var p = L.profile, i; if (t <= p[0][0]) return p[0][1]; for (i = 1; i < p.length; i++) if (t <= p[i][0]) { var a = p[i - 1], b = p[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); } return p[p.length - 1][1]; }
  function dref(L, t) { return (refAt(L, t + 0.01) - refAt(L, t - 0.01)) / 0.02; }
  /* which torque/speed quadrants the job needs (sampled along the profile) */
  function quadrants(L) {
    var M = MOTORS[L.motor], q = {}, t;
    for (t = 0; t <= L.time; t += 0.05) {
      var w = refAt(L, t), T = M.J * dref(L, t) + load(L, w, t) + M.B * w;
      if (Math.abs(w) < 1 && Math.abs(T) < 1) continue;
      var sw = w >= 0 ? 1 : -1, sT = T >= 0 ? 1 : -1;
      if (Math.abs(T) < 0.02 * M.Kphi * M.I) continue;      // tiny torques: friction handles them
      q[sw > 0 ? (sT > 0 ? 1 : 2) : (sT > 0 ? 4 : 3)] = 1;
    }
    return Object.keys(q).map(Number).sort();
  }
  function maxSpeed(L) { var m = 0; L.profile.forEach(function (p) { m = Math.max(m, Math.abs(p[1])); }); return m; }
  function start(L, set) { // set: {conv, kp, ki, ilim (A), fw (bool)}
    return { L: L, M: MOTORS[L.motor], C: BYCONV[set.conv], set: set, t: 0, w: refAt(L, 0), ia: 0, iw: 0, ii: 0, phi: 1, va: 0, e2: 0, peak: 0, ein: 0, eout: 0,
      maxErr: 0, done: false, win: false, why: "", hist: [], trip: false };
  }
  var DT = 0.0005;
  function step(S, dt) {
    if (S.done) return S;
    var L = S.L, M = S.M, C = S.C, sp = L.supply, vmax = C.vmax(sp), vmin = C.vmin(sp), n = Math.max(1, Math.round(dt / DT)), h = dt / n, j;
    var wmaxRef = maxSpeed(L) || 1;
    for (j = 0; j < n; j++) {
      var wr = refAt(L, S.t);
      // field weakening keeps the back-emf below ~95 % of the converter's voltage above base speed
      S.phi = S.set.fw ? Math.max(0.35, Math.min(1, 0.95 * vmax / (M.Kphi * Math.max(1, Math.abs(S.w))))) : 1;
      var kphi = M.Kphi * S.phi, e = wr - S.w;
      var iref = S.set.kp * e + S.set.ki * S.iw;
      var lo = C.ineg ? -S.set.ilim : 0, hi = S.set.ilim, sat = iref > hi || iref < lo;
      iref = Math.max(lo, Math.min(hi, iref)); if (!sat) S.iw += e * h;
      // inner current loop (fast PI, fixed): bandwidth about 300 rad/s
      var ei = iref - S.ia, vref = M.Ra * iref + kphi * S.w + (M.La * 300) * ei + (M.Ra * 300) * S.ii;
      var va = Math.max(vmin, Math.min(vmax, vref)); if (va === vref) S.ii += ei * h;
      var dia = (va - M.Ra * S.ia - kphi * S.w) / M.La; S.ia += dia * h;
      if (!C.ineg && S.ia < 0) S.ia = 0;                    // thyristors / diode block reverse current
      var T = kphi * S.ia, TL = load(L, S.w, S.t);
      S.w += (T - TL - M.B * S.w) / M.J * h; S.t += h; S.va = va;
      var p = va * S.ia; if (p >= 0) S.ein += p * h; else S.eout -= p * h;
      var err = Math.abs(wr - S.w); S.e2 += err * err * h; S.maxErr = Math.max(S.maxErr, err); S.peak = Math.max(S.peak, Math.abs(S.ia));
      if (Math.abs(S.ia) > 2.2 * M.I) { S.done = true; S.trip = true; S.why = "Overcurrent trip: armature current reached " + Math.round(Math.abs(S.ia)) + " A (limit " + Math.round(2.2 * M.I) + " A)."; break; }
      if (S.t >= L.time) { S.done = true; var r = rmsPct(S); S.win = r <= L.tol; S.why = S.win ? "Profile met." : "Speed error " + r.toFixed(1) + "% of top speed (allowed " + L.tol + "%)."; break; }
    }
    S.hist.push([S.t, refAt(L, S.t), S.w, S.ia]); if (S.hist.length > 900) S.hist.shift();
    return S;
  }
  function rmsPct(S) { return S.t > 0 ? 100 * Math.sqrt(S.e2 / S.t) / (maxSpeed(S.L) || 1) : 0; }
  function stars(S) { if (!S.win) return 0; var s = 1, r = rmsPct(S); if (r <= S.L.tol * 0.45) s++; if (BYCONV[S.set.conv].cost <= S.L.budget * 0.75 || (S.eout > 0.05 * S.ein && S.L.regenStar)) s++; return s; }
  function allowed(L) { return CONVERTERS.filter(function (c) { return (L.supplies || ["dc", "ac1", "ac3"]).indexOf(c.supply) >= 0 && c.cost <= L.budget; }); }
  /* reference engineer: cheapest converter that covers the quadrants and voltage; PI tuned to ~25 rad/s */
  function botSet(L) {
    var M = MOTORS[L.motor], need = quadrants(L), top = maxSpeed(L), cands = allowed(L).slice().sort(function (a, b) { return a.cost - b.cost; }), pick = null;
    cands.some(function (c) { var okq = need.every(function (q) { return c.quads.indexOf(q) >= 0; }); var vok = c.vmax(L.supply) >= M.Kphi * Math.min(top, M.wb) + M.Ra * M.I; if (okq && vok) { pick = c; return true; } return false; });
    pick = pick || cands[cands.length - 1];
    var wc = 25, kp = M.J * wc / M.Kphi, fw = top > M.wb * 1.02 || pick.vmax(L.supply) < M.Kphi * top * 1.05;
    return { conv: pick.id, kp: kp, ki: kp * wc / 4, ilim: Math.round(M.I * 1.8), fw: fw };
  }
  function botRun(L) { var S = start(L, botSet(L)); while (!S.done) step(S, 0.02); return S; }
  /* levels */
  function prof(pts) { return pts; }
  var ROWS = [ // name, motor, supply {vdc|vs|vll}, allowed supplies, budget, load, profile [[t, rad/s]...], time, tol %, teaching
    ["First turn", "small", { vdc: 300 }, ["dc"], 500, { kind: "conveyor", t0: 10 }, [[0, 0], [2, 100], [8, 100]], 8, 6, "A chopper sets the average armature voltage Va = D·Vdc. Speed follows: ω ≈ (Va − Ra·Ia)/Kφ."],
    ["Back-emf", "small", { vdc: 300 }, ["dc"], 500, { kind: "conveyor", t0: 15 }, [[0, 0], [1.5, 140], [7, 140]], 7, 6, "As the motor speeds up its back-emf Kφ·ω rises and the current falls: the motor limits itself."],
    ["Current limit", "small", { vdc: 300 }, ["dc"], 500, { kind: "conveyor", t0: 20 }, [[0, 0], [0.8, 140], [7, 140]], 7, 8, "A fast start needs a large current. The current limit protects the motor; the speed ramp must respect it."],
    ["Mains drive", "small", { vs: 230 }, ["ac1"], 400, { kind: "conveyor", t0: 15 }, [[0, 0], [2, 120], [8, 120]], 8, 6, "A 1-phase full converter gives Va = (2√2/π)·Vs·cos α ≈ 0.9·Vs·cos α."],
    ["Speed loop", "small", { vdc: 300 }, ["dc"], 500, { kind: "conveyor", t0: 15, bump: [{ t: 4, d: 2, dT: 12 }] }, [[0, 0], [2, 120], [9, 120]], 9, 5, "A load step slows the motor until the speed PI controller raises the current. Integral action removes the droop."],
    ["Slow down", "small", { vdc: 300 }, ["dc"], 700, { kind: "conveyor", t0: 3 }, [[0, 0], [2, 140], [5, 140], [6, 20], [8, 20]], 8, 6, "A class-A chopper cannot brake: on a fast slow-down the motor just coasts. A class-C chopper returns energy instead."],
    ["Regeneration", "small", { vdc: 300 }, ["dc"], 700, { kind: "conveyor", t0: 2 }, [[0, 0], [1.5, 140], [4, 140], [4.8, 0], [7, 0]], 7, 6, "Regenerative braking: in quadrant II the machine runs as a generator and pushes current back into the supply."],
    ["Fan", "mid", { vll: 415 }, ["ac3"], 700, { kind: "fan", k2: 0.0035 }, [[0, 0], [3, 150], [9, 150]], 9, 5, "A fan's torque rises with ω². Most of the work is at the top of the speed range."],
    ["Three phases", "mid", { vll: 415 }, ["ac3"], 700, { kind: "conveyor", t0: 60 }, [[0, 0], [2.5, 150], [9, 150]], 9, 5, "A 3-phase full converter gives Va = (3√2/π)·VLL·cos α ≈ 1.35·VLL·cos α with much less ripple."],
    ["Hoist up", "mid", { vll: 415 }, ["ac3"], 700, { kind: "hoist", t0: 90 }, [[0, 0], [2, 120], [8, 120]], 8, 5, "Lifting is quadrant I: positive speed, positive torque."],
    ["Hoist down", "mid", { vll: 415 }, ["ac3"], 700, { kind: "hoist", t0: 90 }, [[0, 0], [2, -100], [8, -100]], 8, 5, "Lowering a load is quadrant IV: the motor holds back gravity. A full converter does it with α > 90° (negative Va)."],
    ["Up and down", "mid", { vll: 415 }, ["ac3"], 700, { kind: "hoist", t0: 80 }, [[0, 0], [2, 110], [5, 110], [7, 0], [7.5, 0], [9, -90], [11.5, -90], [13, 0], [13.5, 0]], 13.5, 6, "A full lift cycle visits quadrants I and IV. The same bridge does both; only the firing angle changes."],
    ["Above base", "small", { vdc: 300 }, ["dc"], 700, { kind: "conveyor", t0: 6 }, [[0, 0], [2, 140], [4, 200], [9, 200]], 9, 6, "Above base speed the back-emf reaches the supply voltage. Weaken the field (φ↓) to go faster at lower torque."],
    ["Winder", "small", { vdc: 300 }, ["dc"], 800, { kind: "winder", p: 2500, tmax: 30 }, [[0, 0], [2, 60], [9, 200], [10, 200]], 10, 6, "A winder needs constant power: torque falls as speed rises. Field weakening suits it perfectly."],
    ["Reverse", "small", { vdc: 300 }, ["dc"], 1100, { kind: "conveyor", t0: 8 }, [[0, 0], [1.5, 120], [4, 120], [5.5, -120], [9, -120]], 9, 6, "Reversing needs all four quadrants: a four-quadrant chopper or a dual converter."],
    ["Cheap and right", "mid", { vll: 415, vdc: 560 }, ["dc", "ac3"], 1300, { kind: "hoist", t0: 70 }, [[0, 0], [2, 100], [5, 100], [7, 0], [7.5, 0], [9, -80], [11, -80]], 11, 6, "Pick the cheapest converter that covers the quadrants the job needs. Over-specifying costs money."],
    ["Heavy start", "big", { vll: 415 }, ["ac3"], 800, { kind: "conveyor", t0: 400 }, [[0, 0], [3, 110], [9, 110]], 9, 5, "A big inertia needs a long ramp or a big current. J·dω/dt is the torque you spend on accelerating."],
    ["Loaded fan", "big", { vll: 415 }, ["ac3"], 800, { kind: "fan", k2: 0.05 }, [[0, 0], [4, 115], [10, 115]], 10, 5, "A large fan: 0.05·ω² N·m. Check the current at top speed against the motor rating."],
    ["Crane cycle", "big", { vll: 415 }, ["ac3"], 800, { kind: "hoist", t0: 500 }, [[0, 0], [2.5, 90], [6, 90], [8, 0], [8.5, 0], [10, -80], [13, -80], [14.5, 0], [15, 0]], 15, 6, "A heavy crane: lifting, holding and lowering against 500 N·m of gravity."],
    ["Shock load", "mid", { vdc: 560 }, ["dc"], 1100, { kind: "conveyor", t0: 40, bump: [{ t: 3, d: 1, dT: 80 }, { t: 6, d: 1.5, dT: -30 }] }, [[0, 0], [2, 150], [9, 150]], 9, 5, "Shock loads test the speed loop: a fast controller recovers quickly, a slow one droops."],
    ["Precision", "small", { vdc: 300 }, ["dc"], 1100, { kind: "conveyor", t0: 10 }, [[0, 0], [1, 60], [2, 60], [3, 120], [4, 120], [5, 30], [7, 30], [8, 0], [9, 0]], 9, 3.5, "A tight speed profile with steps up and down: tune the PI loop carefully."],
    ["Lift shaft", "mid", { vll: 415, vdc: 560 }, ["dc", "ac3"], 1300, { kind: "hoist", t0: 85, bump: [{ t: 5, d: 4, dT: 25 }] }, [[0, 0], [1.5, 120], [4, 120], [5, 0], [6, 0], [7.5, -110], [10, -110], [11, 0]], 11, 6, "A passenger lift adds load mid-trip. Smooth starts and stops, every time."],
    ["Fast winder", "small", { vdc: 300 }, ["dc"], 1100, { kind: "winder", p: 3500, tmax: 32 }, [[0, 0], [1.5, 80], [6, 220], [9, 220], [10, 0]], 10, 6, "A winder up past base speed and then a stop: field weakening and braking together."],
    ["Mill stand", "big", { vll: 415 }, ["ac3"], 1500, { kind: "conveyor", t0: 300, bump: [{ t: 3, d: 3, dT: 250 }] }, [[0, 0], [2, 100], [6, 100], [7, -100], [11, -100]], 11, 6, "A rolling mill reverses under load: a dual converter for four-quadrant work."],
    ["Entropy's escalator", "mid", { vll: 415, vdc: 560 }, ["dc", "ac3"], 1300, { kind: "hoist", t0: 95, bump: [{ t: 2, d: 6, dT: 30 }] }, [[0, 0], [1.5, 110], [5, 110], [6, -110], [10, -110], [11, 0], [12, 0]], 12, 5, "Count Entropy jammed the escalator. Pick, tune, run."],
    ["Grand finale", "big", { vll: 415 }, ["ac3"], 1500, { kind: "hoist", t0: 450, bump: [{ t: 4, d: 2, dT: 120 }] }, [[0, 0], [2, 100], [5, 100], [6.5, -90], [10, -90], [11, 0], [12, 0]], 12, 5, "The station's biggest drive: lift, lower, hold, under shock load."]
  ];
  var LEVELS = ROWS.map(function (w, i) {
    return { id: i + 1, name: w[0], motor: w[1], supply: w[2], supplies: w[3], budget: w[4], kind: w[5].kind, t0: w[5].t0, k2: w[5].k2, p: w[5].p, tmax: w[5].tmax, bump: w[5].bump,
      profile: prof(w[6]), time: w[7], tol: w[8], teach: w[9], regenStar: i >= 5 };
  });
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function endlessLevel(k) {
    var r = rng(700 + k * 13); r(); r(); r(); var kinds = ["conveyor", "hoist", "fan", "winder"], kind = kinds[Math.floor(r() * 4)], motor = ["small", "mid", "big"][Math.min(2, Math.floor(r() * (1 + k / 4)))];
    var M = MOTORS[motor], top = M.wb * (0.6 + r() * 0.35), rev = kind !== "fan" && r() < 0.5 + k * 0.02;
    // ramps sized from the motor: accelerate with at most ~half the rated torque left over after the load
    var spare = 0.55 * M.Kphi * M.I, ramp = function (dw) { return Math.max(1.2, M.J * Math.abs(dw) / spare); };
    var t1 = ramp(top) + r() * 0.5, t2 = t1 + 2 + r() * 2, pts = [[0, 0], [t1, top], [t2, top]], tEnd;
    if (rev) { var t3 = t2 + ramp(top), t4 = t3 + 0.5, t5 = t4 + ramp(top * 0.85); pts.push([t3, 0], [t4, 0], [t5, -top * 0.85]); tEnd = t5 + 2.5; pts.push([tEnd, -top * 0.85]); }
    else { var lo = top * (0.5 + r() * 0.5); tEnd = t2 + ramp(top - lo) + 2.5; pts.push([tEnd - 2.5, lo], [tEnd, lo]); }
    var L = { id: 100 + k, name: "Job " + (k + 1), motor: motor, supply: { vdc: motor === "small" ? 300 : 560, vll: 415, vs: 230 }, supplies: ["dc", "ac3"], budget: 1300, kind: kind,
      t0: kind === "hoist" ? M.Kphi * M.I * 0.35 : M.Kphi * M.I * 0.2, k2: M.Kphi * M.I * 0.6 / (top * top), p: M.Kphi * M.I * 0.4 * M.wb * 0.5, tmax: M.Kphi * M.I * 0.6,
      bump: k > 2 ? [{ t: 3 + r() * 3, d: 1 + r(), dT: M.Kphi * M.I * (0.1 + Math.min(0.3, k * 0.02)) }] : null, profile: pts, time: Math.round(tEnd * 10) / 10, tol: Math.max(3, 7 - k * 0.15),
      teach: "Endless shift: read each job, pick a drive, tune and run.", regenStar: true };
    return L;
  }
  var api = { CONVERTERS: CONVERTERS, BYCONV: BYCONV, MOTORS: MOTORS, LEVELS: LEVELS, load: load, refAt: refAt, quadrants: quadrants, maxSpeed: maxSpeed, start: start, step: step,
    rmsPct: rmsPct, stars: stars, allowed: allowed, botSet: botSet, botRun: botRun, endlessLevel: endlessLevel };
  root.DriveSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
