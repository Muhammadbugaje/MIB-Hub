/* Circuit Forge, more 100-level circuits (PHYS 162 / PHYS 122: Ohm's law, power, series and parallel, cells, LEDs).
 * Every answer is proved unique by games/tests/test_puzzles.py, which solves each circuit with nodal analysis. */
(function (C) {
  "use strict";
  var W = { k: "R", R: 0, role: "wire" }, AM = { k: "R", R: 0, role: "ammeter" }, SLOT = function (name) { return { k: "R", R: null, role: "slot", name: name }; };
  function lvl(o, lay) { o.nodes = lay.nodes; o.els = lay.els; return o; }
  C.add(100, [
    lvl({ order: 10, name: "Series string", course: "PHYS 162: series resistors", tray: [6, 10, 15, 22, 30],
      text: "A 16 Ω lamp needs 0.25 A from a 12 V cell. Fill both slots: series resistances add, so you need 48 Ω in total.",
      goals: [{ what: "I", el: 3, lo: 0.245, hi: 0.255, label: "Lamp current", unit: "A" }],
      explain: "R_total = 12 / 0.25 = 48 Ω. Take away the lamp's 16 Ω: the two resistors must add to 32 Ω, and only 10 + 22 does." },
      C.ring({ k: "E", E: 12, r: 0.001, role: "cell" }, [SLOT("R₁"), SLOT("R₂"), { k: "R", R: 16, role: "lamp", pmax: 2 }, AM])),
    lvl({ order: 11, name: "Rated lamp", course: "PHYS 162: electrical power", tray: [6, 12, 18, 24],
      text: "A 12 V, 6 W lamp on an 18 V supply. Its rated current is P / V = 0.5 A. Add series resistance so it runs at its rating without blowing.",
      goals: [{ what: "P", el: 3, lo: 5.7, hi: 6.1, label: "Lamp power", unit: "W" }],
      explain: "The lamp is 12² / 6 = 24 Ω. For 0.5 A the total must be 18 / 0.5 = 36 Ω, so the series resistor is 12 Ω and drops the extra 6 V." },
      C.ring({ k: "E", E: 18, r: 0.001, role: "cell" }, [SLOT("series R"), W, { k: "R", R: 24, role: "lamp", pmax: 6.6, name: "lamp 12 V 6 W" }, AM])),
    lvl({ order: 12, name: "LED resistor", course: "PHYS 162: diodes and current limiting", tray: [100, 220, 330, 470, 1000],
      text: "A red LED drops about 2 V and is happiest at 15–25 mA. Above 30 mA it burns out. Choose the resistor for a 9 V battery.",
      goals: [{ what: "I", el: 3, lo: 0.015, hi: 0.025, label: "LED current", unit: "A" }],
      explain: "I = (9 − 2) / (R + 10 Ω LED resistance). 330 Ω gives 7 / 340 = 20.6 mA. 220 Ω gives 30.4 mA and burns the LED; 470 Ω gives only 14.6 mA." },
      C.ring({ k: "E", E: 9, r: 0.001, role: "cell" }, [SLOT("R"), W, { k: "D", Vf: 2, rd: 10, Imax: 0.03, role: "led", name: "red LED" }, AM])),
    lvl({ order: 13, name: "Cells in series", course: "PHYS 122: emf in series", tray: [{ k: "E", E: 1.5, r: 0.1, label: "1.5 V cell" }, { k: "E", E: -1.5, r: 0.1, label: "1.5 V cell, reversed" }, { k: "E", E: 3, r: 0.2, label: "3 V cell" }, { k: "W", label: "plain wire" }],
      text: "The motor (6 Ω) needs about 0.75 A, so the cells must add up to about 4.5 V. One 1.5 V cell is already fitted; fill both slots. A reversed cell subtracts its emf, and a plain wire adds nothing.",
      goals: [{ what: "I", el: 3, lo: 0.7, hi: 0.78, label: "Motor current", unit: "A" }],
      explain: "Emfs in series add: 1.5 + 3 + 0 = 4.5 V. With 6 Ω plus 0.3 Ω of internal resistance, I = 4.5 / 6.3 = 0.71 A. Two 1.5 V cells and the 3 V cell would give 6 V and 0.94 A." },
      C.ring({ k: "E", E: 1.5, r: 0.1, role: "cell" }, [SLOT("slot 1"), SLOT("slot 2"), { k: "R", R: 6, role: "motor", name: "motor 6 Ω" }, AM])),
    { order: 14, name: "Equivalent resistance", course: "PHYS 162: series and parallel networks", tray: [4, 6, 8, 12, 24],
      text: "Make the network between the two terminals measure exactly 10 Ω: one resistor in series, two in parallel after it.",
      nodes: [[180, 270], [400, 270], [640, 270], [800, 270]],
      els: [{ k: "R", a: 0, b: 1, R: null, role: "slot", name: "series" }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "parallel A", bend: -90 }, { k: "R", a: 1, b: 2, R: null, role: "slot", name: "parallel B", bend: 90 }, { k: "R", a: 2, b: 3, R: 0, role: "wire" }],
      goals: [{ what: "Req", a: 0, b: 3, lo: 9.95, hi: 10.05, label: "Resistance", unit: "Ω" }],
      explain: "Parallel pair: 1/R = 1/R_A + 1/R_B, so 8 ∥ 24 = 192 / 32 = 6 Ω. Add the 4 Ω in series: 10 Ω. No other choice of three parts makes exactly 10 Ω." },
    lvl({ order: 15, name: "Heater element", course: "PHYS 162: P = V² / R", tray: [13.2, 26.5, 52.9, 106], labels: ["13.2 Ω", "26.5 Ω", "52.9 Ω", "106 Ω"],
      text: "A kettle element must take about 2 kW from the 230 V mains. P = V² / R. Pick the element.",
      goals: [{ what: "P", el: 1, lo: 1900, hi: 2100, label: "Element power", unit: "W" }],
      explain: "R = V² / P = 230² / 2000 = 26.5 Ω. Half the resistance would double the power (4 kW) and trip the circuit." },
      C.ring({ k: "E", E: 230, r: 0.001, role: "cell", name: "mains (as DC)" }, [SLOT("element"), W, W, AM])),
    { order: 16, name: "Share the current", course: "PHYS 162: current divider", tray: [3, 6, 9, 18],
      text: "12 V through a 2 Ω feeder into two branches: a fixed 6 Ω lamp and your slot. The lamp must take exactly 1 A.",
      nodes: [[160, 440], [160, 200], [380, 200], [620, 200], [800, 200], [800, 440]],
      els: [{ k: "E", a: 1, b: 0, E: 12, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: 2, role: "fixed", name: "feeder 2 Ω" },
        { k: "R", a: 2, b: 4, R: 6, role: "lamp", pmax: 30, bend: -80, name: "lamp 6 Ω" }, { k: "R", a: 2, b: 4, R: null, role: "slot", bend: 80, name: "branch" },
        { k: "R", a: 4, b: 5, R: 0, role: "wire" }, { k: "R", a: 5, b: 0, R: 0, role: "ammeter" }],
      goals: [{ what: "I", el: 2, lo: 0.97, hi: 1.03, label: "Lamp current", unit: "A" }],
      explain: "The lamp needs 6 V across it, so the feeder drops 6 V and carries 3 A. The branch takes the other 2 A at 6 V: 3 Ω." },
    lvl({ order: 17, name: "Two loads, one cell", course: "PHYS 122: Kirchhoff's voltage law", tray: [2, 4, 6, 8, 10],
      text: "A 12 V cell feeds two loads in series. The first must have 4 V across it and the second 8 V, with 1 A flowing.",
      goals: [{ what: "V", a: 2, b: 3, lo: 3.95, hi: 4.05, label: "Load 1 voltage", unit: "V" }, { what: "V", a: 3, b: 4, lo: 7.9, hi: 8.1, label: "Load 2 voltage", unit: "V" }, { what: "I", el: 4, lo: 0.98, hi: 1.02, label: "Current", unit: "A" }],
      explain: "Around the loop the voltages add up to the emf: 4 + 8 = 12 V. With 1 A, Ohm's law gives 4 Ω and 8 Ω." },
      C.ring({ k: "E", E: 12, r: 0.001, role: "cell" }, [W, SLOT("load 1"), SLOT("load 2"), AM]))
  ]);
})(typeof window !== "undefined" ? window.CircuitSim : require("./circuitsim.js"));
