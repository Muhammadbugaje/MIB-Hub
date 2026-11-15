/* Circuit Forge, 400-level chapter (EEEN 415: conductor size from voltage drop). Resistive loads on a 230 V supply,
 * modelled as DC (resistive loads at unity power factor). Cable resistance R = ρ × 2L / A with copper ρ = 1.72 × 10⁻⁸ Ω·m
 * (2L: out and back). This chapter uses a 4% voltage-drop limit and asks for the cheapest cable that meets it. */
(function (C) {
  "use strict";
  function cable(mm2, len) { return 1.72e-8 * 2 * len / (mm2 * 1e-6); }
  C.add(400, [
    { name: "Size the socket circuit", course: "EEEN 415: conductor size and voltage drop", unit: "mm²", tray: [cable(1.5, 30), cable(2.5, 30), cable(4, 30), cable(6, 30)], labels: ["1.5 mm²", "2.5 mm²", "4 mm²", "6 mm²"],
      text: "A 30 m run feeds a 20 A load (11.5 Ω) from 230 V. Pick the smallest cable that keeps the load above 96% of 230 V (220.8 V). Bigger cables cost more.",
      nodes: C.loop(), els: [{ k: "E", a: 1, b: 0, E: 230, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "cable" },
        { k: "R", a: 2, b: 3, R: 0, role: "wire" }, { k: "R", a: 3, b: 4, R: 11.5, role: "lamp", pmax: 1e9, name: "load 20 A" }, { k: "R", a: 4, b: 0, R: 0, role: "wire" }],
      goal: { what: "V", a: 3, b: 4, lo: 220.8, hi: 223.5, label: "Load voltage", unit: "V" } },
    { name: "The cooker circuit", course: "EEEN 415: internal wiring estimation", unit: "mm²", tray: [cable(2.5, 50), cable(4, 50), cable(6, 50), cable(10, 50)], labels: ["2.5 mm²", "4 mm²", "6 mm²", "10 mm²"],
      text: "A cooker draws about 32 A (7.19 Ω) at the end of a 50 m run. Same rule: at least 220.8 V at the cooker with the cheapest cable.",
      nodes: C.loop(), els: [{ k: "E", a: 1, b: 0, E: 230, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "cable" },
        { k: "R", a: 2, b: 3, R: 0, role: "wire" }, { k: "R", a: 3, b: 4, R: 7.19, role: "lamp", pmax: 1e9, name: "cooker 32 A" }, { k: "R", a: 4, b: 0, R: 0, role: "wire" }],
      goal: { what: "V", a: 3, b: 4, lo: 220.8, hi: 223.5, label: "Cooker voltage", unit: "V" } }
  ]);
  var W_ = { k: "R", R: 0, role: "wire" }, AM_ = { k: "R", R: 0, role: "ammeter" }, SL_ = function (name) { return { k: "R", R: null, role: "slot", name: name }; };
  function lv_(o, lay) { o.nodes = lay.nodes; o.els = lay.els; return o; }
  function cap_(uF, txt) { return { k: "C", C: uF * 1e-6, label: txt || uF + " µF" }; }
  function ind_(H, txt) { return { k: "L", L: H, label: txt || H + " H" }; }
  var AC_ = function (V, f) { return { k: "E", E: V, r: 0.001, role: "ac", name: V + " V ~ " + f + " Hz" }; };
  function cable_(mm2, len) { return 1.72e-8 * 2 * len / (mm2 * 1e-6); }
  C.add(400, [
    lv_({ order: 10, name: "Inverting amplifier", course: "Op-amps: inverting amplifier", tray: [4700, 10000, 22000, 47000], unit: "kΩ", scale: 1000,
      text: "The ideal op-amp keeps its − input at 0 V. With R_in = 1 kΩ and 0.5 V in, choose R_f for −5 V out. Gain = −R_f / R_in.",
      goals: [{ what: "V", a: 3, b: 0, lo: -5.1, hi: -4.9, label: "Output voltage", unit: "V" }],
      explain: "Gain −10 needs R_f = 10 × 1 kΩ = 10 kΩ: V_out = −10 × 0.5 = −5 V. The same current flows through R_in and R_f, because no current enters the op-amp." },
      C.opamp("inv", { k: "E", E: 0.5, r: 0.001, role: "cell", name: "input" }, { k: "R", R: 1000, role: "fixed", name: "R_in 1 kΩ" }, { k: "R", R: null, role: "slot", name: "R_f" })),
    lv_({ order: 11, name: "Non-inverting amplifier", course: "Op-amps: non-inverting amplifier", tray: [4700, 10000, 22000, 47000], unit: "kΩ", scale: 1000,
      text: "Now the signal goes into the + input. With R₁ = 1 kΩ to ground, choose R_f for a gain of 11 (0.5 V in, 5.5 V out). Gain = 1 + R_f / R₁.",
      goals: [{ what: "V", a: 3, b: 0, lo: 5.4, hi: 5.6, label: "Output voltage", unit: "V" }],
      explain: "1 + 10k / 1k = 11, so 0.5 V becomes 5.5 V. The non-inverting amplifier keeps the signal's sign and has a very high input resistance." },
      C.opamp("non", { k: "E", E: 0.5, r: 0.001, role: "cell", name: "input" }, { k: "R", R: 1000, role: "fixed", name: "R₁ 1 kΩ" }, { k: "R", R: null, role: "slot", name: "R_f" })),
    lv_({ order: 12, name: "Gain of 22", course: "Op-amps: choosing both resistors", tray: [1000, 2200, 4700, 10000, 22000, 47000], unit: "kΩ", scale: 1000,
      text: "Build an inverting amplifier with a gain of −22: 0.2 V in, −4.4 V out. Fill both R_in and R_f.",
      goals: [{ what: "V", a: 3, b: 0, lo: -4.49, hi: -4.31, label: "Output voltage", unit: "V" }],
      explain: "R_f / R_in = 22 k / 1 k = 22. Other pairs such as 47 k / 2.2 k = 21.4 miss the ±2% window: resistor ratios, not values, set the gain." },
      C.opamp("inv", { k: "E", E: 0.2, r: 0.001, role: "cell", name: "input" }, { k: "R", R: null, role: "slot", name: "R_in" }, { k: "R", R: null, role: "slot", name: "R_f" })),
    lv_({ order: 13, name: "Gain of π", course: "Op-amps: non-inverting gain from a ratio", tray: [1000, 2200, 4700, 6800, 15000], unit: "kΩ", scale: 1000,
      text: "A sensor gives 1 V; the display wants about 3.14 V. Make a non-inverting amplifier with gain 1 + R_f / R₁ ≈ 3.14 by filling both slots.",
      goals: [{ what: "V", a: 3, b: 0, lo: 3.09, hi: 3.18, label: "Output voltage", unit: "V" }],
      explain: "1 + 4.7 k / 2.2 k = 3.14. With E12 values you hunt for a ratio, and 15 k / 6.8 k = 2.21 would give 3.21: just outside." },
      C.opamp("non", { k: "E", E: 1, r: 0.001, role: "cell", name: "input" }, { k: "R", R: null, role: "slot", name: "R₁" }, { k: "R", R: null, role: "slot", name: "R_f" })),
    lv_({ order: 14, name: "Heater on a long run", course: "EEEN 415: conductor size and voltage drop", unit: "mm²", tray: [cable_(1.5, 40), cable_(2.5, 40), cable_(4, 40), cable_(6, 40)], labels: ["1.5 mm²", "2.5 mm²", "4 mm²", "6 mm²"],
      text: "A 3 kW heater (17.6 Ω) sits 40 m from the 230 V board. Pick the cheapest cable that keeps at least 220.8 V (a 4% drop) at the heater.",
      goals: [{ what: "V", a: 3, b: 4, lo: 220.8, hi: 223.5, label: "Heater voltage", unit: "V" }],
      explain: "R = ρ × 2L / A: 2.5 mm² over 80 m of copper is 0.55 Ω, so the heater gets 230 × 17.6 / 18.15 = 223 V. 1.5 mm² drops it to 218.6 V." },
      C.ring({ k: "E", E: 230, r: 0.001, role: "cell" }, [SL_("cable"), W_, { k: "R", R: 17.6, role: "lamp", pmax: 1e9, name: "heater 3 kW" }, W_])),
    lv_({ order: 15, name: "Workshop sub-main", course: "EEEN 415: sub-main sizing", unit: "mm²", tray: [cable_(4, 60), cable_(6, 60), cable_(10, 60), cable_(16, 60)], labels: ["4 mm²", "6 mm²", "10 mm²", "16 mm²"],
      text: "A workshop 60 m away draws 40 A (5.75 Ω). Pick the cheapest sub-main cable that keeps 220.8 V at the far end.",
      goals: [{ what: "V", a: 3, b: 4, lo: 220.8, hi: 223.5, label: "Workshop voltage", unit: "V" }],
      explain: "10 mm² over 120 m of copper is 0.21 Ω: 230 × 5.75 / 5.96 = 221.9 V. 6 mm² (0.34 Ω) leaves only 217 V." },
      C.ring({ k: "E", E: 230, r: 0.001, role: "cell" }, [SL_("cable"), W_, { k: "R", R: 5.75, role: "lamp", pmax: 1e9, name: "workshop 40 A" }, W_]))
  ]);
})(typeof window !== "undefined" ? window.CircuitSim : require("./circuitsim.js"));
