/* Maglev Rescue suspension model (EEEN 320: time-varying fields, magnetic force).
 * A pod hangs under a steel rail from an electromagnet. Lifting force F = K·(I/g)², K = μ0·N²·A / 4 (two pole faces).
 * With gap g measured downward from the rail: m·g̈ = m·grav − K·(I/g)² + F_disturbance. Equilibrium current I0 = g·√(m·grav/K).
 * The equilibrium is unstable: a smaller gap gives a larger force (dF/dg = −2K·I²/g³ < 0), so the pod snaps up or falls away
 * unless a controller acts. Coil: L·dI/dt = V − R·I with L = μ0·N²·A / (2g0), limited by the supply voltage.
 * Controller (the player tunes it): I_ref = I_ff + Kp·e + Ki·∫e + Kd·ė, e = g − g_ref, ė from a filtered gap sensor.
 * Linearised: δg̈ = a·δg − b·δI with a = 2·grav/g0, b = 2·grav/I0; PD is stable when Kp > a/b = I0/g0 and Kd > 0.
 * Units: SI internally (m, A, kg, s); the game shows mm. */
(function (root) {
  "use strict";
  var MU0 = 4 * Math.PI * 1e-7, GRAV = 9.81, N = 400, AREA = 0.004, K = MU0 * N * N * AREA / 4, R = 2, G0 = 0.010, M0 = 20;
  var L = MU0 * N * N * AREA / (2 * G0), I0 = G0 * Math.sqrt(M0 * GRAV / K), SUB = 0.0004;
  function force(I, g) { return K * (I / g) * (I / g); }
  function eqCurrent(m, g) { return g * Math.sqrt(m * GRAV / K); }
  function lin(m, g) { var i0 = eqCurrent(m, g); return { a: 2 * GRAV / g, b: 2 * GRAV / i0, i0: i0 }; }
  /* gains in game units: Kp A/mm, Kd A·ms/mm (= A·s/m), Ki A/(mm·s) */
  function toSI(gn) { return { kp: gn.kp * 1000, kd: gn.kd, ki: gn.ki * 1000 }; }
  /* pole placement for the PD(+I) loop on the nominal pod: ωn rad/s, ζ damping */
  function design(wn, zeta, withI) {
    var l = lin(M0, G0), kp = (wn * wn + l.a) / l.b, kd = 2 * zeta * wn / l.b;
    return { kp: kp / 1000, kd: kd, ki: withI ? kp * wn / 8 / 1000 : 0 };
  }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  /* track events by distance x (m): rail steps (mm, + = rail dips toward the pod), payload changes (kg), gust pulses (N, s) */
  function railAt(T, x) { var r = 0; T.rail.forEach(function (e) { if (x >= e.x) r = e.h; }); return r / 1000; }
  function massAt(T, x) { var m = M0; T.load.forEach(function (e) { if (x >= e.x) m = M0 + e.kg; }); return m; }
  function gustAt(T, x) { var f = 0; T.gust.forEach(function (e) { if (x >= e.x && x < e.x + e.len) f += e.n * Math.sin(Math.PI * (x - e.x) / e.len); }); return f; }
  var ROWS = [ // name, length m, speed m/s, rail steps, payloads, gusts, sensor noise mm, Imax A, Vmax V, spec mm, teaching
    ["Hold still", 60, 4, 0, 0, 0, 0, 40, 150, 3, "Magnets only pull. Too close and the pull grows: the hanging pod is unstable on its own."],
    ["Just enough", 80, 5, 1, 0, 0, 0, 40, 150, 3, "Equilibrium current I0 = g·√(m·g/K). At 10 mm this pod needs about 10 A."],
    ["Stiffness", 100, 6, 2, 0, 0, 0, 40, 150, 3, "Proportional gain must beat the magnet's negative stiffness: Kp > I0/g0 ≈ 1 A/mm, or the pod slams into the rail."],
    ["Damping", 100, 6, 3, 0, 0, 0, 40, 150, 2.5, "Derivative gain adds damping. Without it the pod rings like a bell after every bump."],
    ["Rail joints", 140, 8, 5, 0, 0, 0, 40, 150, 2.5, "Each rail joint is a step disturbance. A well-damped loop settles in a few tens of ms."],
    ["Parcel post", 120, 6, 2, 1, 0, 0, 45, 150, 3, "A heavier pod sags: proportional control alone leaves a steady-state error. Add integral action."],
    ["Integral", 140, 7, 3, 2, 0, 0, 45, 150, 2.5, "Integral gain removes the steady error, but too much makes the pod overshoot and oscillate."],
    ["Square law", 140, 7, 3, 2, 0, 0, 45, 150, 2.5, "Force goes with I²: doubling current gives four times the pull. Small current changes act hard near the rail."],
    ["Voltage limit", 160, 8, 4, 1, 0, 0, 45, 90, 2.5, "The coil's inductance resists fast current change: dI/dt ≤ V/L. A low supply slows your fastest correction."],
    ["Noisy sensor", 160, 8, 4, 1, 0, 0.15, 45, 150, 2.5, "Derivative gain amplifies sensor noise into coil chatter and wasted energy. Balance Kd against noise."],
    ["Cross-winds", 180, 9, 4, 1, 3, 0, 45, 150, 3, "Gusts push the pod. Disturbance rejection needs high loop gain."],
    ["Heavy cargo", 160, 7, 3, 3, 1, 0, 60, 150, 3, "Big payloads need more current: check that the current limit leaves headroom."],
    ["Current limit", 180, 8, 4, 2, 2, 0, 38, 150, 3, "When the controller asks for more than Imax the loop saturates and loses grip. Lower gains or lift the gap."],
    ["Close running", 160, 8, 5, 1, 1, 0, 45, 150, 1.5, "A tight tolerance needs a stiff, well-damped loop and a calm gap setting."],
    ["Fast track", 220, 14, 8, 1, 2, 0, 45, 150, 2.5, "Faster travel means rail steps arrive more often. The loop has less time to settle between them."],
    ["Delivery run", 220, 10, 6, 4, 2, 0.1, 55, 150, 2.5, "Payloads on and off along the line: integral action earns its keep."],
    ["Bumpy line", 240, 11, 10, 2, 2, 0.1, 50, 150, 2.5, "Many small steps: a high bandwidth loop follows the rail; a low one rides over it."],
    ["Storm line", 240, 11, 6, 2, 5, 0.1, 50, 150, 3, "Wind and rail together. Find gains that reject both without chattering."],
    ["Thin supply", 220, 10, 6, 2, 3, 0.1, 50, 70, 3, "Only 70 V to drive the coil: a gentle, well-damped design beats an aggressive one."],
    ["Fine gap", 220, 10, 6, 2, 2, 0.05, 50, 150, 1.4, "Precision suspension: tight tolerance, little noise, every gain matters."],
    ["Heavy haul", 260, 9, 6, 6, 3, 0.1, 70, 150, 3, "The heaviest loads of the line. Watch the current."],
    ["Express", 300, 16, 12, 2, 4, 0.1, 50, 150, 2.5, "Top speed, many joints, little settling time."],
    ["Night freight", 300, 12, 10, 6, 4, 0.15, 65, 150, 3, "Noise, loads, gusts and joints, through the night."],
    ["Entropy's sabotage", 320, 13, 14, 5, 6, 0.15, 60, 120, 2.5, "Count Entropy loosened the rail. Hold the pod through the sabotage."],
    ["Rescue run", 360, 14, 14, 7, 6, 0.15, 70, 120, 2.5, "Carry the stranded engineers home: everything at once."],
    ["Golden line", 400, 15, 16, 7, 7, 0.12, 70, 120, 2, "The final line to the station. A controller worthy of a real maglev."]
  ];
  function track(row, seed, sev) {
    sev = sev || seed; var r = rng(seed * 104729 + 7), len = row[1], T = { len: len, v: row[2], rail: [], load: [], gust: [] }, k;
    for (k = 0; k < row[3]; k++) T.rail.push({ x: 10 + (len - 20) * (k + 0.5) / row[3] + (r() - 0.5) * 4, h: Math.round(((r() - 0.5) * 2 * (1 + sev / 10)) * 10) / 10 });
    T.rail.sort(function (a, b) { return a.x - b.x; });
    var kg = 0; for (k = 0; k < row[4]; k++) { kg = k % 2 === 0 || kg === 0 ? Math.round(3 + r() * (4 + sev / 2)) : 0; T.load.push({ x: 15 + (len - 30) * (k + 0.5) / row[4], kg: kg }); }
    for (k = 0; k < row[5]; k++) T.gust.push({ x: 10 + r() * (len - 20), len: 2 + r() * 4, n: (r() - 0.5) * 2 * (25 + sev * 3) });
    return T;
  }
  var LEVELS = ROWS.map(function (w, i) {
    return { id: i + 1, name: w[0], track: track(w, i + 1), noise: w[6] / 1000, imax: w[7], vmax: w[8], spec: w[9] / 1000, teach: w[10] };
  });
  function endlessLevel(k) {
    var row = ["Gauntlet " + (k + 1), 200, 9 + Math.min(8, k * 0.6), 6 + k, 1 + Math.floor(k / 2), 2 + Math.floor(k / 2), Math.min(0.2, 0.03 * k), 60, 140, 3, ""];
    return { id: 100 + k, name: row[0], track: track(row, 200 + k, Math.min(34, 8 + k * 1.5)), noise: row[6] / 1000, imax: row[7], vmax: row[8], spec: row[9] / 1000, teach: "Endless gauntlet: every stretch is harder." };
  }
  function start(Lv, gains, gref) {
    var T = Lv.track, gr = (gref || 10) / 1000, m = massAt(T, 0), ieq = eqCurrent(m, gr);
    return { Lv: Lv, T: T, t: 0, x: 0, g: gr, v: 0, I: ieq, integ: 0, gref: gr, gains: gains, meas: gr, dmeas: 0, scrapes: 0, energy: 0, err2: 0, n: 0, maxErr: 0,
      over: 0, done: false, win: false, why: "", seed: rng(Lv.id * 31 + 5), hist: [], sat: 0 };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function step(S, dt) {
    if (S.done) return S;
    var Lv = S.Lv, T = S.T, G = toSI(S.gains), n = Math.max(1, Math.round(dt / SUB)), h = dt / n, j;
    for (j = 0; j < n; j++) {
      var m = massAt(T, S.x), rail = railAt(T, S.x), gust = gustAt(T, S.x);
      var gap = S.g - rail, meas = gap + (Lv.noise ? gauss(S.seed) * Lv.noise : 0);
      S.dmeas += ((meas - S.meas) / h - S.dmeas) * Math.min(1, h / 0.002); S.meas = meas; // 2 ms derivative filter
      var e = meas - S.gref;
      var ff = S.gref * Math.sqrt(M0 * GRAV / K); // feedforward: the nominal pod's equilibrium current at this gap
      var iref = ff + G.kp * e + G.ki * S.integ + G.kd * S.dmeas;
      var sat = iref > Lv.imax || iref < 0; iref = Math.max(0, Math.min(Lv.imax, iref));
      if (!sat) S.integ += e * h; else S.sat += h; // anti-windup: hold the integrator while saturated
      var V = Math.max(-Lv.vmax, Math.min(Lv.vmax, R * iref + (L / 0.003) * (iref - S.I)));
      S.I = Math.max(0, S.I + (V - R * S.I) / L * h);
      var F = force(S.I, Math.max(0.0005, gap));
      S.v += (GRAV - F / m + gust / m) * h; S.g += S.v * h;
      var gp = S.g - rail;
      if (gp <= 0.001) { S.g = rail + 0.001; if (S.v < 0) { S.v = -S.v * 0.3; S.scrapes++; S.lastScrape = S.t; } }
      S.energy += S.I * S.I * R * h; S.x += T.v * h; S.t += h;
      var err = Math.abs(gp - S.gref); S.err2 += err * err * h; S.maxErr = Math.max(S.maxErr, err); if (err > Lv.spec) S.over += h;
      if (gp > 0.030) { S.done = true; S.why = "The pod dropped onto its safety skids (gap over 30 mm)."; break; }
      if (S.scrapes >= 3) { S.done = true; S.why = "The pod hit the rail three times."; break; }
      if (S.x >= T.len) { S.done = true; S.win = S.over <= S.t * 0.15; S.why = S.win ? "Delivered safely." : "Delivered, but the gap was outside ±" + (Lv.spec * 1000).toFixed(1) + " mm for " + Math.round(100 * S.over / S.t) + "% of the trip."; break; }
    }
    S.hist.push([S.t, (S.g - railAt(T, S.x)) * 1000, S.I]); if (S.hist.length > 600) S.hist.shift();
    return S;
  }
  function rms(S) { return S.t > 0 ? Math.sqrt(S.err2 / S.t) : 0; }
  function stars(S) { if (!S.win) return 0; var s = 1; if (rms(S) <= S.Lv.spec * 0.35) s++; if (S.scrapes === 0 && S.over <= S.t * 0.03) s++; return s; }
  /* step-response preview for the tuning screen: 0.6 s after a 2 mm step in the reference */
  function stepTest(gains, Lv) {
    var flat = { id: 0, track: { len: 1e9, v: 0, rail: [], load: [], gust: [] }, noise: 0, imax: (Lv || {}).imax || 45, vmax: (Lv || {}).vmax || 150, spec: 0.003 };
    var S = start(flat, gains, 10), out = [], k; S.gref = 0.012;
    for (k = 0; k < 120 && !S.done; k++) { step(S, 0.005); out.push((S.g) * 1000); }
    var peak = Math.max.apply(null, out), fin = out[out.length - 1];
    return { trace: out, overshoot: Math.max(0, (peak - 12) / 2 * 100), final: fin, stable: !S.done && Math.abs(fin - 12) < 1.5 && S.scrapes === 0 };
  }
  function botGains(Lv) { return design(Lv.noise > 0.0001 ? 55 : 70, 0.75, Lv.track.load.length > 0); }
  function botRun(Lv, dt) { var S = start(Lv, botGains(Lv), 10); while (!S.done) step(S, dt || 1 / 60); return S; }
  var api = { MU0: MU0, GRAV: GRAV, N: N, AREA: AREA, K: K, R: R, L: L, G0: G0, M0: M0, I0: I0, force: force, eqCurrent: eqCurrent, lin: lin, design: design, toSI: toSI,
    LEVELS: LEVELS, endlessLevel: endlessLevel, start: start, step: step, rms: rms, stars: stars, stepTest: stepTest, botGains: botGains, botRun: botRun, railAt: railAt, massAt: massAt };
  root.MaglevSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
