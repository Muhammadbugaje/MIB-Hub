/* Bakes Light Bender's generated levels into static/js/games/bender-levels.js. Run: node games/levelgen/bender_levels.js
 * Each chapter lists [seed, spec]; the generator (OpticSim.generate) builds every level from a working beam path, so
 * every level is solvable by construction, and games/tests/test_puzzles.py re-proves it with a full search. */
const path = require("path"), fs = require("fs");
const O = require(path.join(__dirname, "../../static/js/games/opticsim.js"));
const PLAN = {
  mirrors: [[11, { rot: [1, 1], par: [2, 4] }], [12, { rot: [2, 2], par: [3, 5] }], [13, { rot: [2, 2], par: [4, 7] }], [14, { rot: [2, 3], par: [5, 8] }], [15, { rot: [3, 3], par: [6, 10] }]],
  split: [[21, { rot: [0, 1], split: true, par: [2, 5] }], [22, { rot: [1, 1], split: true, par: [3, 6] }], [23, { rot: [1, 2], split: true, par: [4, 7] }], [24, { rot: [1, 2], split: true, par: [4, 8] }], [25, { rot: [2, 2], split: true, par: [5, 9] }], [26, { rot: [2, 2], split: true, par: [6, 10] }]],
  glass: [[31, { rot: [1, 1], glass: "water", par: [2, 5] }], [32, { rot: [1, 2], glass: "glass", par: [3, 6] }], [33, { rot: [2, 2], glass: "diamond", par: [3, 7] }], [34, { rot: [2, 2], glass: "glass", par: [4, 8] }], [35, { rot: [2, 3], glass: "diamond", par: [5, 9] }]],
  prism: [[41, { rot: [1, 1], glass: "prism", par: [2, 5] }], [42, { rot: [1, 2], glass: "prism", tir: true, par: [3, 6] }], [43, { rot: [2, 2], glass: "prism", par: [3, 7] }], [44, { rot: [2, 2], glass: "prism", tir: true, par: [4, 8] }], [45, { rot: [2, 3], glass: "prism", tir: true, par: [5, 9] }]],
  lens: [[51, { rot: [1, 1], lens: true, par: [2, 5] }], [52, { rot: [1, 2], lens: true, par: [3, 6] }], [53, { rot: [2, 2], lens: true, par: [3, 7] }], [54, { rot: [2, 2], lens: true, par: [4, 8] }], [55, { rot: [2, 2], lens: true, glass: "glass", par: [4, 8] }], [56, { rot: [2, 3], lens: true, par: [5, 9] }]],
  colour: [[61, { rot: [1, 1], filter: true, par: [2, 5] }], [62, { rot: [0, 1], split: true, filter: true, par: [2, 6] }], [63, { rot: [1, 1], split: true, filter: true, par: [3, 7] }], [64, { rot: [1, 2], split: true, filter: true, par: [4, 8] }], [65, { rot: [1, 2], split: true, filter: true, par: [4, 8] }], [66, { rot: [2, 2], split: true, filter: true, par: [5, 9] }]],
  entropy: [[71, { rot: [2, 2], split: true, glass: "glass", par: [5, 9] }], [72, { rot: [2, 2], lens: true, glass: "prism", par: [5, 9] }], [73, { rot: [1, 2], split: true, lens: true, filter: true, par: [5, 9] }], [74, { rot: [2, 3], glass: "diamond", lens: true, par: [6, 10] }], [75, { rot: [2, 2], split: true, glass: "prism", par: [5, 10] }], [76, { rot: [3, 3], split: true, par: [7, 12] }]]
};
const NAMES = {
  mirrors: ["Corner shot", "Zig-zag", "Detour", "Three turns", "Mirror maze"], split: ["Two receivers", "Fork in the beam", "Half and half", "Split decision", "Double duty", "Twin towers"],
  glass: ["Pond", "Glass bend", "Diamond", "Sideways shift", "Hard glass"], prism: ["Triangle", "Corner prism", "Bent by glass", "Trapped light", "Prism puzzle"],
  lens: ["Burning glass", "Focus", "Spread out", "Through the focus", "Lens and glass", "Optics bench"], colour: ["Red light", "Green and blue", "Sort the colours", "Colour split", "Rainbow desk", "Gel puzzle"],
  entropy: ["Entropy's first trap", "Prism and lens", "Colour corridor", "Diamond lens", "Total control", "The long way round"]
};
const out = {}; let n = 0;
for (const [ch, list] of Object.entries(PLAN)) {
  out[ch] = list.map(([seed, spec], k) => { const L = O.generate(seed, spec); if (!L) throw new Error("no level for " + ch + " " + seed); L.name = NAMES[ch][k]; L.spec = spec; n++; return L; });
}
const file = path.join(__dirname, "../../static/js/games/bender-levels.js");
fs.writeFileSync(file, "/* Light Bender generated levels (written by games/levelgen/bender_levels.js; do not edit by hand). */\n(function (O) {\n  \"use strict\";\n  O.addBaked(" + JSON.stringify(out) + ");\n})(typeof window !== \"undefined\" ? window.OpticSim : require(\"./opticsim.js\"));\n");
console.log("levels", n, "total", O.LEVELS.length);
for (const [ch, list] of Object.entries(out)) console.log(ch, list.map(L => L.mirrors.length + "m/par" + L.par + "/sols" + L.solCount).join("  "));
