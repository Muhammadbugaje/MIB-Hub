/* Circuit Forge, 300-level chapter (EEEN 309: DC machines; generator terminal equation, motor starters). */
(function (C) {
  "use strict";
  C.add(300, [
    { name: "Loading a DC generator", course: "EEEN 309: DC generators", tray: [5.5, 11, 22, 44],
      text: "A separately excited generator makes E = 230 V with armature resistance R_a = 0.5 Ω. Pick the load so the terminal voltage is 220 V. V = E − I_a R_a.",
      nodes: C.loop(), els: [{ k: "E", a: 1, b: 0, E: 230, r: 0.5, role: "cell", name: "generator" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" },
        { k: "R", a: 2, b: 3, R: 0, role: "wire" }, { k: "R", a: 3, b: 4, R: null, role: "slot", name: "load" }, { k: "R", a: 4, b: 0, R: 0, role: "ammeter" }],
      goal: { what: "V", a: 3, b: 4, lo: 219, hi: 221, label: "Terminal voltage", unit: "V" } },
    { name: "Motor starter", course: "EEEN 309: DC motor starters", tray: [2, 5.5, 10, 20],
      text: "At standstill a DC motor has no back emf, so only R_a = 0.5 Ω limits the current from 220 V. Add starter resistance so the starting current is 30–40 A (about 1.5–2 × the 20 A rating).",
      nodes: C.loop(), els: [{ k: "E", a: 1, b: 0, E: 220, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "starter" },
        { k: "R", a: 2, b: 3, R: 0, role: "wire" }, { k: "R", a: 3, b: 4, R: 0.5, role: "motor", name: "armature 0.5 Ω" }, { k: "R", a: 4, b: 0, R: 0, role: "ammeter" }],
      goal: { what: "I", el: 3, lo: 30, hi: 40, label: "Starting current", unit: "A" } }
  ]);
  var W_ = { k: "R", R: 0, role: "wire" }, AM_ = { k: "R", R: 0, role: "ammeter" }, SL_ = function (name) { return { k: "R", R: null, role: "slot", name: name }; };
  function lv_(o, lay) { o.nodes = lay.nodes; o.els = lay.els; return o; }
  function cap_(uF, txt) { return { k: "C", C: uF * 1e-6, label: txt || uF + " µF" }; }
  function ind_(H, txt) { return { k: "L", L: H, label: txt || H + " H" }; }
  var AC_ = function (V, f) { return { k: "E", E: V, r: 0.001, role: "ac", name: V + " V ~ " + f + " Hz" }; };
  C.add(300, [
    lv_({ order: 10, name: "Capacitive reactance", course: "EEEN 309 / PHYS 122: AC through a capacitor", f: 50, tray: [cap_(10), cap_(20), cap_(47), cap_(100)],
      text: "A capacitor on the 230 V, 50 Hz mains should pass about 1.45 A. Its reactance is X_C = 1 / (2πfC).",
      goals: [{ what: "Iac", el: 1, lo: 1.4, hi: 1.5, label: "AC current", unit: "A" }],
      explain: "X_C = 1 / (2π × 50 × 20 µF) = 159 Ω, so I = 230 / 159 = 1.45 A. A bigger capacitor has less reactance and passes more current." },
      C.ring(AC_(230, 50), [SL_("C"), W_, W_, AM_])),
    lv_({ order: 11, name: "Inductive reactance", course: "EEEN 309 / PHYS 122: AC through an inductor", f: 50, tray: [ind_(0.25), ind_(0.5), ind_(1), ind_(2)],
      text: "A choke on the 230 V, 50 Hz mains must limit the current to about 0.73 A. X_L = 2πfL.",
      goals: [{ what: "Iac", el: 1, lo: 0.7, hi: 0.76, label: "AC current", unit: "A" }],
      explain: "X_L = 2π × 50 × 1 H = 314 Ω, so I = 230 / 314 = 0.73 A. Fluorescent-lamp ballasts limit current the same way, without wasting power as heat." },
      C.ring(AC_(230, 50), [SL_("L"), W_, W_, AM_])),
    lv_({ order: 12, name: "Low-pass filter", course: "Filters: RC low-pass cut-off", f: 1000, tray: [1000, 1600, 2200, 4700], unit: "kΩ", scale: 1000,
      text: "At 1 kHz the output across the 100 nF capacitor must be 0.707 of the input: that makes 1 kHz the cut-off. f_c = 1 / (2πRC).",
      goals: [{ what: "gain", a: 3, b: 4, src: 0, lo: 0.69, hi: 0.72, label: "Gain at 1 kHz", unit: "×" }],
      explain: "R = 1 / (2π × 1000 × 100 nF) = 1.59 kΩ, so 1.6 kΩ. At the cut-off R = X_C and the output is 1/√2 = 0.707 of the input (−3 dB)." },
      C.ring(AC_(1, 1000), [SL_("R"), W_, { k: "C", C: 100e-9, role: "cap", name: "100 nF" }, W_])),
    lv_({ order: 13, name: "High-pass filter", course: "Filters: RC high-pass cut-off", f: 50, tray: [cap_(0.1, "0.1 µF"), cap_(0.33, "0.33 µF"), cap_(1, "1 µF"), cap_(3.3, "3.3 µF")],
      text: "Block mains hum: with a 10 kΩ resistor, choose the capacitor that puts the cut-off at about 50 Hz. The output is across the resistor.",
      goals: [{ what: "gain", a: 3, b: 4, src: 0, lo: 0.69, hi: 0.74, label: "Gain at 50 Hz", unit: "×" }],
      explain: "C = 1 / (2π × 50 × 10 kΩ) = 0.32 µF, so 0.33 µF. Below 50 Hz the capacitor's reactance grows and the output falls away." },
      C.ring(AC_(1, 50), [SL_("C"), W_, { k: "R", R: 10000, role: "fixed", name: "10 kΩ" }, W_])),
    lv_({ order: 14, name: "Tune the radio", course: "Resonance: LC tuned circuit", tray: [cap_(47e-6, "47 pF"), cap_(100e-6, "100 pF"), cap_(220e-6, "220 pF"), cap_(470e-6, "470 pF")],
      text: "The aerial coil is 253 µH. Pick the capacitor that tunes the circuit to a 1 MHz station. f₀ = 1 / (2π√(LC)).",
      goals: [{ what: "f0", L: 1, C: 3, lo: 0.98e6, hi: 1.02e6, label: "Tuned frequency", unit: "MHz", scale: 1e6 }],
      explain: "f₀ = 1 / (2π√(253 µH × 100 pF)) = 1.0 MHz. Turning a variable capacitor is how an old radio's tuning dial works." },
      C.ring(AC_(1, "1e6"), [{ k: "L", L: 253e-6, role: "ind", name: "253 µH" }, W_, SL_("C"), W_])),
    lv_({ order: 15, name: "Series resonance", course: "Resonance: maximum current", f: 159.15, tray: [cap_(4.7), cap_(10), cap_(22), cap_(47)],
      text: "10 V at 159 Hz drives a 10 Ω resistor and a 0.1 H coil. Add the capacitor that cancels the coil's reactance so the full 1 A flows.",
      goals: [{ what: "Iac", el: 4, lo: 0.95, hi: 1.01, label: "AC current", unit: "A" }],
      explain: "ω = 2π × 159 = 1000 rad/s, so X_L = 100 Ω and the capacitor needs X_C = 100 Ω: C = 1 / (1000 × 100) = 10 µF. At resonance only R limits the current." },
      C.ring(AC_(10, 159), [{ k: "R", R: 10, role: "fixed", name: "10 Ω" }, { k: "L", L: 0.1, role: "ind", name: "0.1 H" }, SL_("C"), AM_])),
    lv_({ order: 16, name: "Running motor", course: "EEEN 309: DC motor back emf", tray: [0.5, 1, 2, 5],
      text: "A 220 V DC motor runs with a back emf of 200 V and armature resistance 0.5 Ω. Add series resistance so it draws 20 A at this speed. I = (V − E_b) / R_total.",
      goals: [{ what: "I", el: 3, lo: 19.5, hi: 20.5, label: "Armature current", unit: "A" }],
      explain: "(220 − 200) / (0.5 + R) = 20 gives R = 0.5 Ω. The back emf, not the resistance, is what normally limits a running motor's current." },
      C.ring({ k: "E", E: 220, r: 0.001, role: "cell" }, [SL_("series R"), W_, { k: "E", E: 200, r: 0.5, role: "motor", name: "E_b 200 V, R_a 0.5 Ω" }, AM_])),
    lv_({ order: 17, name: "Generator regulation", course: "EEEN 309: generator terminal voltage", tray: [4.6, 9.6, 19.2, 38.4],
      text: "A generator with E = 240 V and R_a = 0.4 Ω must hold its terminals at 230 V (±1 V). Which load does that?",
      goals: [{ what: "V", a: 3, b: 4, lo: 229, hi: 231, label: "Terminal voltage", unit: "V" }],
      explain: "V = E × R / (R + R_a): 240 × 9.6 / 10 = 230.4 V. A heavier load (smaller R) draws more current and drops more voltage inside the machine." },
      C.ring({ k: "E", E: 240, r: 0.4, role: "cell", name: "generator" }, [W_, W_, SL_("load"), AM_])),
    lv_({ order: 18, name: "Field rheostat", course: "EEEN 309: shunt field control", tray: [20, 36.7, 55, 110], labels: ["20 Ω", "36.7 Ω", "55 Ω", "110 Ω"],
      text: "A 110 Ω shunt field on 220 V needs 1.5 A for the speed you want. Set the field rheostat.",
      goals: [{ what: "I", el: 3, lo: 1.48, hi: 1.52, label: "Field current", unit: "A" }],
      explain: "R_total = 220 / 1.5 = 146.7 Ω, so the rheostat is 36.7 Ω. Weakening the field (more rheostat) makes a shunt motor run faster." },
      C.ring({ k: "E", E: 220, r: 0.001, role: "cell" }, [SL_("rheostat"), W_, { k: "R", R: 110, role: "fixed", name: "field 110 Ω" }, AM_]))
  ]);
})(typeof window !== "undefined" ? window.CircuitSim : require("./circuitsim.js"));
