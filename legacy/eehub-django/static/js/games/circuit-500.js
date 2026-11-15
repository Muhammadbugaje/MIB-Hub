/* Circuit Forge, 500-level chapter (EEEN 527: per-unit symmetrical fault analysis). With purely reactive impedances all
 * in phase quadrature, reactances add like resistances, so the solver works on reactance magnitudes in per unit (pu). */
(function (C) {
  "use strict";
  C.add(500, [
    { name: "Limit the fault current", course: "EEEN 527: fault analysis, per unit", unit: "pu", tray: [0.05, 0.1, 0.2, 0.4],
      text: "A 1.0 pu source with X_s = 0.1 pu feeds a bus. The breaker can interrupt 5 pu. Pick a series reactor so a three-phase fault draws 4–5 pu: safe, without wasting voltage.",
      nodes: C.loop(), els: [{ k: "E", a: 1, b: 0, E: 1, r: 0.1, role: "cell", name: "X_s 0.1 pu" }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "reactor" },
        { k: "R", a: 2, b: 3, R: 0, role: "wire" }, { k: "R", a: 3, b: 4, R: 0.000001, role: "fault", name: "fault" }, { k: "R", a: 4, b: 0, R: 0, role: "wire" }],
      goal: { what: "I", el: 3, lo: 4, hi: 5, label: "Fault current", unit: "pu" } },
    { name: "Two in-feeds", course: "EEEN 527: Thevenin reactance and fault level", unit: "pu", tray: [0.05, 0.1, 0.15, 0.3],
      text: "Two 1.0 pu in-feeds (X = 0.2 and 0.3 pu) meet at the bus, so X_th = 0.12 pu. Pick the reactor so the fault current is 3.5–4 pu.",
      nodes: [[160, 430], [160, 150], [470, 150], [780, 150], [780, 430], [470, 430]],
      els: [{ k: "E", a: 1, b: 0, E: 1, r: 0.2, role: "cell", name: "in-feed X 0.2" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" },
        { k: "E", a: 2, b: 5, E: 1, r: 0.3, role: "cell", name: "in-feed X 0.3" }, { k: "R", a: 2, b: 3, R: null, role: "slot", name: "reactor" },
        { k: "R", a: 3, b: 4, R: 0.000001, role: "fault", name: "fault" }, { k: "R", a: 4, b: 5, R: 0, role: "wire" }, { k: "R", a: 5, b: 0, R: 0, role: "wire" }],
      goal: { what: "I", el: 4, lo: 3.5, hi: 4, label: "Fault current", unit: "pu" } }
  ]);
  var W_ = { k: "R", R: 0, role: "wire" }, AM_ = { k: "R", R: 0, role: "ammeter" }, SL_ = function (name) { return { k: "R", R: null, role: "slot", name: name }; };
  function lv_(o, lay) { o.nodes = lay.nodes; o.els = lay.els; return o; }
  function cap_(uF, txt) { return { k: "C", C: uF * 1e-6, label: txt || uF + " µF" }; }
  function ind_(H, txt) { return { k: "L", L: H, label: txt || H + " H" }; }
  var AC_ = function (V, f) { return { k: "E", E: V, r: 0.001, role: "ac", name: V + " V ~ " + f + " Hz" }; };
  C.add(500, [
    { order: 10, name: "Power factor correction", course: "EEEN 5xx: power factor correction", f: 50, tray: [cap_(22), cap_(47), cap_(150), cap_(330)],
      text: "A 20 Ω, 50 mH load on 230 V, 50 Hz runs at power factor 0.79 lagging. Add a parallel capacitor to bring it to 0.95 or better without over-correcting.",
      nodes: [[160, 430], [160, 170], [480, 170], [700, 170], [700, 430], [480, 430]],
      els: [{ k: "E", a: 1, b: 0, E: 230, r: 0.001, role: "ac", name: "230 V ~ 50 Hz" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "R", a: 2, b: 3, R: 20, role: "fixed", name: "20 Ω" },
        { k: "L", a: 3, b: 4, L: 0.05, role: "ind", name: "50 mH" }, { k: "R", a: 4, b: 5, R: 0, role: "wire" }, { k: "R", a: 2, b: 5, R: null, role: "slot", name: "C", bend: 110 }, { k: "R", a: 5, b: 0, R: 0, role: "wire" }],
      goals: [{ what: "pf", el: 0, lo: 0.95, hi: 1, label: "Power factor", unit: "" }],
      explain: "The load draws 0.0309 S of conductance and 0.0243 S of inductive susceptance. 47 µF supplies ωC = 0.0148 S, leaving pf = 0.956. 150 µF over-corrects to 0.81 leading." },
    { order: 11, name: "Motor power factor", course: "EEEN 5xx: power factor correction", f: 50, tray: [cap_(47), cap_(100), cap_(220), cap_(470)],
      text: "An induction motor looks like 8 Ω in series with 30 mH: pf 0.65. Choose the capacitor bank for pf 0.95 or better.",
      nodes: [[160, 430], [160, 170], [480, 170], [700, 170], [700, 430], [480, 430]],
      els: [{ k: "E", a: 1, b: 0, E: 230, r: 0.001, role: "ac", name: "230 V ~ 50 Hz" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "R", a: 2, b: 3, R: 8, role: "motor", name: "motor 8 Ω" },
        { k: "L", a: 3, b: 4, L: 0.03, role: "ind", name: "30 mH" }, { k: "R", a: 4, b: 5, R: 0, role: "wire" }, { k: "R", a: 2, b: 5, R: null, role: "slot", name: "C", bend: 110 }, { k: "R", a: 5, b: 0, R: 0, role: "wire" }],
      goals: [{ what: "pf", el: 0, lo: 0.95, hi: 1, label: "Power factor", unit: "" }],
      explain: "Needed: ωC between 0.044 and 0.079 S, so C between 142 and 251 µF: 220 µF. Correcting pf cuts the current the supply has to carry for the same real power." },
    lv_({ order: 12, name: "Cancel the reactance", course: "EEEN 5xx: unity power factor", f: 50, tray: [ind_(0.05), ind_(0.1), ind_(0.2), ind_(0.5)],
      text: "A 10 Ω load in series with 100 µF leads badly. Add the series inductor that brings the power factor to almost exactly 1.",
      goals: [{ what: "pf", el: 0, lo: 0.99, hi: 1, label: "Power factor", unit: "" }],
      explain: "X_C = 1 / (314 × 100 µF) = 31.8 Ω and X_L = 314 × 0.1 = 31.4 Ω: they cancel, leaving pure resistance and pf ≈ 1." },
      C.ring(AC_(230, 50), [{ k: "R", R: 10, role: "fixed", name: "10 Ω" }, { k: "C", C: 1e-4, role: "cap", name: "100 µF" }, SL_("L"), AM_])),
    { order: 13, name: "Three in-feeds", course: "EEEN 527: fault level with several sources", unit: "pu", tray: [0.05, 0.1, 0.15, 0.3],
      text: "Three 1.0 pu in-feeds (X = 0.2, 0.3 and 0.6 pu) meet at a bus: X_th = 0.1 pu. Pick the series reactor so a fault draws 3.8–4.2 pu.",
      nodes: [[120, 430], [120, 150], [320, 150], [320, 430], [520, 150], [520, 430], [780, 150], [780, 430]],
      els: [{ k: "E", a: 1, b: 0, E: 1, r: 0.2, role: "cell", name: "X 0.2" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "E", a: 2, b: 3, E: 1, r: 0.3, role: "cell", name: "X 0.3" },
        { k: "R", a: 3, b: 0, R: 0, role: "wire" }, { k: "R", a: 2, b: 4, R: 0, role: "wire" }, { k: "E", a: 4, b: 5, E: 1, r: 0.6, role: "cell", name: "X 0.6" }, { k: "R", a: 5, b: 3, R: 0, role: "wire" },
        { k: "R", a: 4, b: 6, R: null, role: "slot", name: "reactor" }, { k: "R", a: 6, b: 7, R: 0.000001, role: "fault", name: "fault" }, { k: "R", a: 7, b: 5, R: 0, role: "wire" }],
      goals: [{ what: "I", el: 8, lo: 3.8, hi: 4.2, label: "Fault current", unit: "pu" }],
      explain: "1/X_th = 1/0.2 + 1/0.3 + 1/0.6 = 10, so X_th = 0.1 pu. I_f = 1 / (0.1 + 0.15) = 4 pu." },
    lv_({ order: 14, name: "Fault down the line", course: "EEEN 527: transformer and line impedance", unit: "pu", tray: [0.02, 0.1, 0.2, 0.3],
      text: "Source X = 0.05 pu, line X = 0.15 pu. Choose the transformer reactance so a fault at the line end draws 3–4 pu.",
      goals: [{ what: "I", el: 4, lo: 3, hi: 4, label: "Fault current", unit: "pu" }],
      explain: "I_f = 1 / (0.05 + X_T + 0.15). With X_T = 0.1 pu: 1 / 0.3 = 3.33 pu. 0.02 pu would allow 4.5 pu." },
      C.ring({ k: "E", E: 1, r: 0.05, role: "cell", name: "source X 0.05" }, [SL_("transformer"), { k: "R", R: 0.15, role: "fixed", name: "line 0.15" }, { k: "R", R: 0.000001, role: "fault", name: "fault" }, W_]))
  ]);
})(typeof window !== "undefined" ? window.CircuitSim : require("./circuitsim.js"));
