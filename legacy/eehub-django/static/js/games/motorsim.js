/* Motorworks Trails: DC machine model and the workshop's job list (EEEN 309, electromechanical energy conversion and
   DC machine construction). Pure functions only, so the Node tests check the physics and that every bay can be done.

   Model (SI units, steady electrical state each step, mechanics integrated):
     back-EMF          E = kφ·ω                         (kφ in V·s/rad, ω in rad/s)
     armature          Va = E + Ia·(Ra + Rst)            (Rst = starter resistance in series)
     torque            T = kφ·Ia                         (N·m)
     mechanics         J·dω/dt = T − T_load(ω) − B·ω
     field             kφ = K·tanh(If / Is)              (a saturating magnetisation curve; If in A)
     shunt field       If = 220 V / (Rf + Rx)            (field on the line; Rx = field rheostat → field weakening)
     series field      kφ = K·tanh(Ia / Is), so T grows with Ia² at light current and the no-load speed runs away
     generator         E = kφ·ω at the driven speed, Ia = E / (Ra + RL), Vt = E − Ia·Ra, P = Vt·Ia
     dynamic braking   supply off, armature across Rb: Ia = −E / (Ra + Rb), so the torque opposes the motion
   A breaker trips if |Ia| stays above its setting for 0.25 s (or instantly above 1.6× the setting). */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.MotorSim = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var RPM = 60 / (2 * Math.PI);
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* machines on the workshop floor */
  var MACH = {
    shunt:  { name: "Shunt motor", kind: "shunt", Va: 220, Ia: 10, rpm: 1500, Ra: 1.0, K: 1.8, Is: 1.046, Rf: 220, J: .05, B: .002 },
    sep:    { name: "Separately excited motor", kind: "sep", Va: 220, Ia: 10, rpm: 1500, Ra: 1.0, K: 1.8, Is: 1.046, J: .05, B: .002 },
    series: { name: "Series motor", kind: "series", Va: 220, Ia: 12, rpm: 1400, Ra: 1.4, K: 2.2, Is: 9, J: .06, B: .003 },
    pm:     { name: "Permanent-magnet motor", kind: "pm", Va: 48, Ia: 8, rpm: 3000, Ra: .45, kphi: .14, J: .0015, B: .0001 },
    gen:    { name: "DC generator", kind: "gen", Va: 230, Ia: 20, rpm: 1500, Ra: .6, K: 1.9, Is: 1.0, J: .1, B: .002 }
  };
  function kphi(m, If, Ia) {
    if (m.kind === "pm") return m.kphi;
    if (m.kind === "series") return m.K * Math.tanh(Math.abs(Ia) / m.Is);
    return m.K * Math.tanh(Math.max(0, If) / m.Is);
  }

  /* one bench: a machine, a load and the knobs the job lets you touch */
  function bench(job) {
    var m = MACH[job.mach];
    var b = { job: job, m: m, w: 0, t: 0, Ia: 0, If: 0, kp: 0, E: 0, T: 0, Vt: 0, P: 0, Pin: 0, energy: 0, trip: false, over: 0, hold: 0, done: false, failed: "", phase: 0, peak: 0, log: [] };
    // b.k = what the player has set; b.a = what the machine actually gets (supplies and engines ramp, they do not jump)
    b.k = {}; (job.knobs || []).forEach(function (n) { b.k[n] = KNOB[n].init; }); Object.keys(job.start || {}).forEach(function (n) { b.k[n] = job.start[n]; });
    b.a = {}; Object.keys(b.k).forEach(function (n) { b.a[n] = b.k[n]; });
    if (job.spin) b.w = job.spin / RPM;
    b.load = job.load || { kind: "none" };
    return b;
  }
  /* knob catalogue: label, unit, range and the step one press moves */
  var KNOB = {
    on:  { label: "Main switch", unit: "", min: 0, max: 1, step: 1, init: 0 },
    Va:  { label: "Armature volts", unit: "V", min: -230, max: 230, step: 5, init: 0, rate: 60 },
    Rx:  { label: "Field rheostat", unit: "Ω", min: 0, max: 300, step: 10, init: 0, rate: 120 },
    If:  { label: "Field current", unit: "A", min: 0, max: 2, step: .05, init: 1, rate: .6 },
    Rst: { label: "Starter resistance", unit: "Ω", min: 0, max: 20, step: 1, init: 0 },
    Pm:  { label: "Prime mover speed", unit: "rpm", min: 0, max: 2000, step: 25, init: 0, rate: 600 },
    RL:  { label: "Load resistance", unit: "Ω", min: 2, max: 200, step: 1, init: 50 },
    Rb:  { label: "Braking resistor", unit: "Ω", min: 1, max: 50, step: 1, init: 10 },
    brake: { label: "Brake switch", unit: "", min: 0, max: 1, step: 1, init: 0 }
  };
  function constT(L, t) { return L.T + (L.step && t > L.step.at ? L.step.dT : 0); }
  function loadTorque(L, w, t) {
    var sgn = w < 0 ? -1 : 1;
    if (L.kind === "const") return Math.abs(w) < .05 ? 0 : constT(L, t) * sgn; // friction-like: opposes motion
    if (L.kind === "fan") return L.k * w * Math.abs(w);
    if (L.kind === "hoist") return L.T; // gravity: always pulls the same way, even at rest
    return 0;
  }
  /* advance the bench by dt seconds (sub-stepped for the stiff mechanical time constant) */
  function step(b, dt) {
    var m = b.m, k = b.a, n = 6, h = dt / n;
    Object.keys(b.k).forEach(function (nm) { var r = KNOB[nm] && KNOB[nm].rate, d = b.k[nm] - (b.a[nm] || 0); b.a[nm] = r ? (b.a[nm] || 0) + clamp(d, -r * dt, r * dt) : b.k[nm]; });
    if (b.k.on != null) k.Va = b.k.on ? (b.job.Vsup || m.Va) : 0;
    for (var i = 0; i < n; i++) {
      var w = b.w, Ia, kp, If = 0;
      if (m.kind === "gen") {
        If = k.If; kp = kphi(m, If, 0); b.w = w = k.Pm / RPM; var E = kp * w; Ia = k.RL > 0 ? E / (m.Ra + k.RL) : 0;
        b.E = E; b.Ia = Ia; b.Vt = E - Ia * m.Ra; b.P = b.Vt * Ia; b.T = kp * Ia; b.Pin = b.T * w; b.kp = kp; b.If = If;
      } else {
        var Va = k.Va || 0, Rst = k.Rst || 0, braking = k.brake > 0;
        if (m.kind === "shunt") If = m.Va / (m.Rf + (k.Rx || 0)); // field across the rated 220 V line (armature fed from its own controller)
        else if (m.kind === "sep") If = k.If != null ? k.If : 1;
        if (m.kind === "series") {
          // |Ia| = (|Va| − kφ(|Ia|)·ω·s) / R, solved by bisection on the saturating curve (s = direction of Va).
          // The field follows the armature current, so the torque always pushes in the direction of Va.
          var R = m.Ra + Rst, s = Va < 0 ? -1 : 1, ws = w * s, lo = 0, hi = Math.abs(Va) / R + 1e-9;
          for (var it = 0; it < 40; it++) { var mid = (lo + hi) / 2; if (mid * R + kphi(m, 0, mid) * ws > Math.abs(Va)) hi = mid; else lo = mid; }
          Ia = s * lo; kp = s * kphi(m, 0, lo);
        } else {
          kp = kphi(m, If, 0);
          if (braking) Ia = -kp * w / (m.Ra + (k.Rb || 10)); else Ia = (Va - kp * w) / (m.Ra + Rst);
        }
        var T = m.kind === "series" ? kp * Math.abs(Ia) : kp * Ia, TL = loadTorque(b.load, w, b.t);
        b.w = w + h * (T - TL - m.B * w) / (m.J + (b.load.J || 0));
        if (b.load.kind === "const" && Math.abs(b.w) < .05 && Math.abs(T) <= constT(b.load, b.t)) b.w = 0; // static load holds it still
        b.E = kp * w; b.Ia = Ia; b.T = T; b.kp = kp; b.If = If; b.Vt = braking ? 0 : Va; b.Pin = braking ? 0 : Va * Ia; b.P = T * w;
      }
      b.t += h; b.energy += Math.max(0, b.Pin) * h; b.peak = Math.max(b.peak, Math.abs(b.Ia));
      var lim = b.job.breaker || m.Ia * 2;
      if (Math.abs(b.Ia) > lim) b.over += h; else b.over = Math.max(0, b.over - h * .5);
      if (!b.trip && (b.over > .25 || Math.abs(b.Ia) > lim * 1.6)) { b.trip = true; b.failed = "trip"; }
      if (b.trip) { b.k.Va = k.Va = 0; if (b.k.on) b.k.on = 0; if (m.kind === "gen") b.k.RL = k.RL = 200; }
    }
    if (m.kind === "series" && Math.abs(b.w * RPM) > (b.job.runaway || 3200)) { b.failed = "runaway"; b.k.Va = b.a.Va = 0; }
    judge(b, dt);
    return b;
  }
  function rpm(b) { return b.w * RPM; }
  /* the job's goal: hold a band for `hold` seconds, with limits that must never be broken */
  function judge(b, dt) {
    if (b.done || b.failed) return;
    var g = b.job.goal, ok = true, r = rpm(b);
    if (g.rpm) ok = ok && r >= g.rpm[0] && r <= g.rpm[1];
    if (g.Vt) ok = ok && b.Vt >= g.Vt[0] && b.Vt <= g.Vt[1];
    if (g.P) ok = ok && b.P >= g.P[0] && b.P <= g.P[1];
    if (g.Ia) ok = ok && Math.abs(b.Ia) >= g.Ia[0] && Math.abs(b.Ia) <= g.Ia[1];
    if (g.stop) ok = ok && Math.abs(r) < g.stop;
    if (g.after) ok = ok && b.t >= g.after;
    if (g.maxPeak && b.peak > g.maxPeak) { b.failed = "peak"; return; }
    if (g.within && b.t > g.within && !b.done) { b.failed = "slow"; return; }
    b.hold = ok ? b.hold + dt : 0;
    if (b.hold >= (g.hold || 2)) { b.done = true; b.at = b.t; }
  }
  function stars(b) { if (!b.done) return 0; var p = b.job.par || 12; return b.at <= p ? 3 : b.at <= p * 1.8 ? 2 : 1; }

  /* steady-state operating point (used by the curve plot and by the tests): the speed where motor torque equals load */
  function steady(job, knobs) {
    var b = bench(job); Object.keys(knobs || {}).forEach(function (n) { b.k[n] = knobs[n]; });
    for (var i = 0; i < 2400 && !b.failed; i++) step(b, 1 / 120);
    return b;
  }

  /* the workshop: five halls, six bays each. Each job names its machine, load, the knobs you get, a goal and the idea it
     teaches. `solve` is one known setting that works (the tests run it; it is never shown to players). */
  var C = function (T, J) { return { kind: "const", T: T, J: J || 0 }; }, FAN = function (k) { return { kind: "fan", k: k }; };
  var JOBS = [
    // Hall 1: the shunt motor and back-EMF
    { id: "h1a", hall: 1, mach: "shunt", title: "First spin", knobs: ["Va"], load: { kind: "none" }, goal: { rpm: [1400, 1600], hold: 2 }, par: 8, solve: { Va: 220 },
      idea: "With no load the armature draws almost no current, so E ≈ Va and the speed settles at ω = Va / kφ." },
    { id: "h1b", hall: 1, mach: "shunt", title: "Half speed", knobs: ["Va"], load: C(4), goal: { rpm: [700, 800], hold: 2 }, par: 8, solve: { Va: 115 },
      idea: "Armature-voltage control: speed is almost proportional to Va because E = Va − Ia·Ra and Ia·Ra is small." },
    { id: "h1c", hall: 1, mach: "shunt", title: "Conveyor at rated load", knobs: ["Va"], load: C(13), goal: { rpm: [1380, 1520], hold: 2 }, par: 9, solve: { Va: 220 },
      idea: "At rated torque Ia ≈ T/kφ ≈ 10 A, so E = 220 − 10·1 = 210 V: the speed drops a little below no-load speed." },
    { id: "h1d", hall: 1, mach: "shunt", title: "Soft start", knobs: ["on", "Rst"], start: { Rst: 20 }, load: C(6), breaker: 22, goal: { rpm: [1430, 1560], Ia: [0, 12], hold: 2, maxPeak: 21 }, par: 14, solve: { on: 1, Rst: 0 }, stepped: [[0, { on: 1, Rst: 20 }], [2, { Rst: 12 }], [3.5, { Rst: 6 }], [5, { Rst: 2 }], [6, { Rst: 0 }]],
      idea: "At standstill E = 0, so Ia = Va / (Ra + Rst). Starting straight on 220 V would draw 220 A; the starter keeps it under the breaker until E builds up." },
    { id: "h1e", hall: 1, mach: "shunt", title: "Fan speed", knobs: ["Va"], load: FAN(.00075), goal: { rpm: [1000, 1100], hold: 2 }, par: 9, solve: { Va: 150 },
      idea: "A fan's torque rises with ω², so the operating point is where the motor's straight torque–speed line meets the fan's curve." },
    { id: "h1f", hall: 1, mach: "shunt", title: "Over the top", knobs: ["Va", "Rx"], load: C(4), goal: { rpm: [1800, 1950], Ia: [0, 10], hold: 2 }, par: 12, solve: { Va: 220, Rx: 85 },
      idea: "Field weakening: a shunt-field rheostat lowers If, so kφ falls and ω = E/kφ rises above base speed. Torque per amp falls with it." },
    // Hall 2: separately excited control, both controls together
    { id: "h2a", hall: 2, mach: "sep", title: "Two handles", knobs: ["Va", "If"], load: C(8), goal: { rpm: [1180, 1260], hold: 2 }, par: 10, solve: { Va: 180, If: 1 },
      idea: "Below base speed hold full field and use Va (constant-torque region). Above it, hold Va and weaken the field (constant-power region)." },
    { id: "h2b", hall: 2, mach: "sep", title: "Weak field, light load", knobs: ["Va", "If"], load: C(3), goal: { rpm: [2100, 2300], hold: 2 }, par: 10, solve: { Va: 220, If: .58 },
      idea: "Halving kφ roughly doubles the no-load speed. Light loads only: the same torque now needs twice the armature current." },
    { id: "h2c", hall: 2, mach: "sep", title: "Torque limit", knobs: ["Va", "If"], load: C(12), goal: { rpm: [1640, 1800], Ia: [0, 10.5], hold: 2 }, par: 14, solve: { Va: 220, If: .82 },
      idea: "Weakening the field to go faster raises Ia for the same torque (Ia = T/kφ). Find the speed you can reach without passing rated current." },
    { id: "h2d", hall: 2, mach: "sep", title: "Crawl", knobs: ["Va", "If"], load: C(10), goal: { rpm: [120, 200], hold: 3 }, par: 12, solve: { Va: 31, If: 1 },
      idea: "At very low speed nearly all of Va is spent on Ia·Ra, so small changes in Va make big changes in speed." },
    { id: "h2e", hall: 2, mach: "sep", title: "Reverse gear", knobs: ["Va", "If"], load: C(5), goal: { rpm: [-1300, -1100], hold: 2 }, par: 12, solve: { Va: -180, If: 1 },
      idea: "Reversing the armature voltage reverses Ia, so the torque kφ·Ia and the rotation reverse. (Reversing the field does the same.)" },
    { id: "h2f", hall: 2, mach: "sep", title: "Speed regulation", knobs: ["Va", "If"], load: { kind: "const", T: 3, step: { at: 4, dT: 9 } }, goal: { rpm: [1400, 1500], after: 6, hold: 2 }, par: 14, solve: { Va: 213, If: 1 },
      idea: "Regulation = (ω_no-load − ω_full-load)/ω_full-load. A stiff DC machine loses only Ia·Ra/kφ in speed when the load arrives." },
    // Hall 3: the series motor
    { id: "h3a", hall: 3, mach: "series", title: "Traction start", knobs: ["on", "Rst"], start: { Rst: 12 }, load: C(14, .3), breaker: 28, goal: { rpm: [1100, 1300], hold: 2 }, par: 14, solve: { on: 1, Rst: 0 }, stepped: [[0, { on: 1, Rst: 12 }], [1, { Rst: 6 }], [2, { Rst: 2 }], [3, { Rst: 0 }]],
      idea: "In a series motor the field current is the armature current, so starting torque grows with Ia²: perfect for trams and cranes." },
    { id: "h3b", hall: 3, mach: "series", title: "Never unload it", knobs: ["Va"], load: C(9), runaway: 3000, goal: { rpm: [900, 1400], hold: 3 }, par: 10, solve: { Va: 160 },
      idea: "With little load, Ia and the field both fall, so speed climbs dangerously. Series motors are always coupled to their load." },
    { id: "h3c", hall: 3, mach: "series", title: "Heavy haul", knobs: ["Va"], load: C(24, .2), breaker: 30, goal: { rpm: [500, 750], hold: 2 }, par: 12, solve: { Va: 150 },
      idea: "Series characteristic: high torque at low speed, low torque at high speed — it trades speed for pull by itself." },
    { id: "h3d", hall: 3, mach: "series", title: "Hand cart", knobs: ["Va", "Rst"], load: C(16), breaker: 26, goal: { rpm: [300, 450], hold: 2, maxPeak: 25 }, par: 14, solve: { Va: 110, Rst: 2 },
      idea: "Series resistance gives smooth, low-speed control at the cost of heat (Ia²·Rst wasted)." },
    { id: "h3e", hall: 3, mach: "series", title: "Fan on a series motor", knobs: ["Va"], load: FAN(.0011), goal: { rpm: [830, 950], hold: 2 }, par: 10, solve: { Va: 140 },
      idea: "Fans suit series motors: the load always rises with speed, so it can never run away." },
    { id: "h3f", hall: 3, mach: "series", title: "Compare the motors", knobs: ["Va"], load: C(18), breaker: 30, goal: { rpm: [740, 880], hold: 2 }, par: 12, solve: { Va: 168 },
      idea: "Under the same heavy torque the series motor pulls with less current than a shunt motor would need, because its field strengthens with load." },
    // Hall 4: generators
    { id: "h4a", hall: 4, mach: "gen", title: "Open circuit", knobs: ["Pm", "If"], start: { RL: 200 }, load: { kind: "none" }, goal: { Vt: [215, 225], hold: 2 }, par: 10, solve: { Pm: 1500, If: .95, RL: 200 },
      idea: "Generated EMF E = kφ·ω. With almost no load current, the terminal voltage is the EMF itself." },
    { id: "h4b", hall: 4, mach: "gen", title: "Light the bay", knobs: ["Pm", "If", "RL"], start: { RL: 40 }, goal: { Vt: [215, 228], P: [1100, 1300], hold: 2 }, par: 14, solve: { Pm: 1500, If: .98, RL: 40 },
      idea: "P = Vt·Ia = Vt²/RL. Pick the load and then trim the field to hold the voltage." },
    { id: "h4c", hall: 4, mach: "gen", title: "Armature drop", knobs: ["Pm", "If"], start: { RL: 12 }, goal: { Vt: [218, 228], hold: 2 }, par: 12, solve: { Pm: 1500, If: 1.06, RL: 12 },
      idea: "Under load Vt = E − Ia·Ra. To keep 220 V at the terminals you must generate more than 220 V inside." },
    { id: "h4d", hall: 4, mach: "gen", title: "Slow prime mover", knobs: ["Pm", "If"], start: { RL: 50, Pm: 900 }, lock: { Pm: 900 }, goal: { Vt: [160, 180], hold: 2 }, par: 12, solve: { Pm: 900, If: 1.9, RL: 50 },
      idea: "If the engine is slow, only a stronger field keeps E = kφ·ω up — until the iron saturates and kφ stops growing. Here even full field cannot reach 220 V: get as close as the iron allows." },
    { id: "h4e", hall: 4, mach: "gen", title: "Charge the batteries", knobs: ["Pm", "If", "RL"], start: { RL: 20 }, goal: { Ia: [9, 11], Vt: [120, 140], hold: 2 }, par: 14, solve: { Pm: 1100, If: .73, RL: 13 },
      idea: "Current and voltage are set together by E and the circuit: Ia = E/(Ra + RL)." },
    { id: "h4f", hall: 4, mach: "gen", title: "Full output", knobs: ["Pm", "If", "RL"], start: { RL: 30 }, goal: { P: [4000, 4600], Ia: [0, 20.5], hold: 2 }, par: 16, solve: { Pm: 1500, If: 1, RL: 11 },
      idea: "Rated output is limited by armature heating (Ia rated) and by the field the iron can carry." },
    // Hall 5: braking and the hardest jobs
    { id: "h5a", hall: 5, mach: "shunt", title: "Dynamic brake", knobs: ["Rb", "brake"], spin: 1500, start: { Va: 220, Rb: 30 }, load: C(2, .05), breaker: 30, goal: { stop: 40, within: 4, hold: .5 }, par: 4, solve: { Rb: 6, brake: 1 },
      idea: "Disconnect the supply and put a resistor across the armature: the machine becomes a generator, Ia = −E/(Ra + Rb), and its own torque stops it." },
    { id: "h5b", hall: 5, mach: "shunt", title: "Brake without tripping", knobs: ["Rb", "brake"], spin: 1500, start: { Va: 220, Rb: 2 }, load: C(1, .1), breaker: 24, goal: { stop: 40, within: 6, hold: .5 }, par: 5, solve: { Rb: 8, brake: 1 },
      idea: "Too small a braking resistor makes a huge current: Ia = E/(Ra + Rb) at full speed. Size Rb for the current your breaker allows." },
    { id: "h5c", hall: 5, mach: "sep", title: "Hoist hold", knobs: ["Va", "If"], load: { kind: "hoist", T: 10 }, goal: { rpm: [-40, 40], hold: 3 }, par: 12, solve: { Va: 8, If: 1 },
      idea: "To hold a load still against gravity the motor needs torque at zero speed: E = 0, so Va = Ia·Ra = (T/kφ)·Ra." },
    { id: "h5d", hall: 5, mach: "sep", title: "Lower gently", knobs: ["Va", "If"], load: { kind: "hoist", T: 10 }, goal: { rpm: [-420, -300], hold: 2 }, par: 14, solve: { Va: -42, If: 1 },
      idea: "Lowering a load the machine runs backwards while still pushing up: it generates (regenerative braking) and returns energy to the supply." },
    { id: "h5e", hall: 5, mach: "pm", title: "Robot arm motor", knobs: ["Va"], load: C(.6), goal: { rpm: [2150, 2350], hold: 2 }, par: 9, solve: { Va: 36 },
      idea: "A permanent-magnet motor has a fixed kφ: speed follows voltage, torque follows current, with no field to adjust." },
    { id: "h5f", hall: 5, mach: "sep", title: "The workshop's last job", knobs: ["on", "If", "Rst"], start: { Rst: 20 }, load: { kind: "const", T: 6, step: { at: 6, dT: 6 } }, breaker: 22, goal: { rpm: [1600, 1720], Ia: [0, 10.5], after: 8, hold: 2, maxPeak: 21 }, par: 18, solve: { on: 1, If: .84, Rst: 0 }, stepped: [[0, { on: 1, If: 1, Rst: 20 }], [2, { Rst: 12 }], [3.5, { Rst: 6 }], [5, { Rst: 2 }], [6, { Rst: 0 }], [7, { If: .84 }]],
      idea: "Start safely, then weaken the field for speed, and still hold rated current when the load doubles. Every lesson of the workshop at once." }
  ];
  var HALLS = ["Hall 1 · Shunt motors and back-EMF", "Hall 2 · Separately excited control", "Hall 3 · Series motors", "Hall 4 · Generators", "Hall 5 · Braking and hoists"];
  // a hall opens when you hold this many stars in total
  var GATE = [0, 8, 18, 30, 42];

  /* Night shift: endless random jobs, harder every round (narrower bands, heavier loads, quicker deadlines) */
  function rng(seed) { var s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0 || 1; for (var w = 0; w < 4; w++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function nightJob(round, seed) {
    var r = rng(seed * 7919 + round * 104729), pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var kind = pick(["speed", "speed", "weak", "gen", "brake"]), band = Math.max(40, 140 - round * 8), job;
    if (kind === "speed") { var T = 2 + Math.round(r() * Math.min(12, 4 + round)), target = 400 + Math.round(r() * 10) * 100; job = { mach: "sep", knobs: ["Va", "If"], load: C(T), goal: { rpm: [target - band / 2, target + band / 2], hold: 2 } }; }
    else if (kind === "weak") { var tg = 1650 + Math.round(r() * 5) * 100; job = { mach: "shunt", knobs: ["Va", "Rx"], load: C(2 + Math.round(r() * 3)), goal: { rpm: [tg - band / 2, tg + band / 2], hold: 2 } }; }
    else if (kind === "gen") { var V = 180 + Math.round(r() * 5) * 10; job = { mach: "gen", knobs: ["Pm", "If", "RL"], start: { RL: 20 + Math.round(r() * 60) }, goal: { Vt: [V - band / 20, V + band / 20], hold: 2 } }; }
    else job = { mach: "shunt", knobs: ["Rb", "brake"], spin: 1500, start: { Va: 220, Rb: 30 }, load: C(1, .05), breaker: 26, goal: { stop: 40, within: Math.max(2.5, 6 - round * .2), hold: .5 } };
    job.id = "night-" + round; job.title = "Night shift job " + (round + 1); job.par = Math.max(6, 16 - round); job.idea = "Night shift: every round is a little tighter."; job.night = true;
    return job;
  }

  return { MACH: MACH, KNOB: KNOB, JOBS: JOBS, HALLS: HALLS, GATE: GATE, RPM: RPM, kphi: kphi, bench: bench, step: step, judge: judge, stars: stars, rpm: rpm, steady: steady, nightJob: nightJob, loadTorque: loadTorque };
});
