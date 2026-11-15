/* Wavefront data and wave physics (PHYS 124 Geometrical and Wave Optics; PHYS 122 electromagnetism).
 * UMD: window.WavefrontData in the browser, module.exports in Node (games/tests/test_shooter.py checks it).
 *
 * Physics used by the weapons (SI units):
 *   c = fλ (c = 2.998 × 10⁸ m/s)           photon energy E = hf (h = 6.626 × 10⁻³⁴ J s)
 *   diffraction grating d sinθ = nλ         orders with |nλ/d| > 1 do not exist and are omitted
 *   Young's double slit (small angles): bright fringes at y = nλL/d, intensity I = I₀ cos²(π d y / (λ L))
 *   Malus's law I = I₀ cos²θ for polarised light; an ideal polariser passes I₀/2 of unpolarised light
 *   point-source pulse intensity falls as 1/r² (EMP); spin "gravity" a = ω²r on the orbital station
 * Game-world model, disclosed in the physics panel: wave shapes on screen are drawn 1 px per 16.7 nm (λ enlarged
 * about 6 × 10⁷ times); damage is proportional to photon energy hf (a game metaphor); the double slit is an
 * ideal pair of point sources with no single-slit envelope. Level geometry is in pixels of the 960 × 540 view. */
(function (root) {
  "use strict";
  var C = 2.998e8, H = 6.626e-34, EV = 1.602e-19, F_REF = 5.0e14;
  var FREQS = [4.3e14, 4.8e14, 5.3e14, 5.8e14, 6.3e14, 6.8e14, 7.3e14]; // Hz, red → violet, all visible light
  var NM_PX = 0.06; // drawn wavelength: px per nm

  function lambda(f) { return C / f; }                         // m
  function nm(f) { return C / f * 1e9; }                       // nm
  function photonEV(f) { return H * f / EV; }                  // eV
  function damageFactor(f) { return f / F_REF; }               // ∝ E = hf (game metaphor)
  function drawnLambda(f) { return nm(f) * NM_PX; }            // px on screen
  function colour(w) { // approximate colour of visible light of wavelength w (nm)
    var r = 0, g = 0, b = 0;
    if (w < 440) { r = -(w - 440) / 60; b = 1; } else if (w < 490) { g = (w - 440) / 50; b = 1; } else if (w < 510) { g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; } else if (w < 645) { r = 1; g = -(w - 645) / 65; } else { r = 1; }
    function c(v) { return Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), .8)); }
    return "rgb(" + c(r * .9 + .1) + "," + c(g * .9 + .1) + "," + c(b * .9 + .1) + ")";
  }
  function band(w) { return w >= 620 ? "red" : w >= 590 ? "orange" : w >= 570 ? "yellow" : w >= 495 ? "green" : w >= 450 ? "blue" : "violet"; }

  /* Diffraction grating: every order n in [-nMax, nMax] with |sinθ| ≤ 1. θ in radians, measured from the beam axis. */
  function gratingAngles(lam, d, nMax) {
    var out = []; nMax = nMax == null ? 2 : nMax;
    for (var n = -nMax; n <= nMax; n++) { var s = n * lam / d; if (Math.abs(s) <= 1) out.push({ n: n, sin: s, theta: Math.asin(s), deg: Math.asin(s) * 180 / Math.PI }); }
    return out;
  }
  /* Malus's law: fraction of polarised light passed by a polariser at angle theta (radians) to the light's plane. */
  function malus(theta) { var c = Math.cos(theta); return c * c; }
  function transmit(axisDeg, pol) { return pol == null ? 0.5 : malus((axisDeg - pol) * Math.PI / 180); } // pol null: unpolarised
  /* Young's double slit, small-angle form. */
  function fringeY(n, lam, L, d) { return n * lam * L / d; }
  function fringeI(y, lam, L, d) { var c = Math.cos(Math.PI * d * y / (lam * L)); return c * c; }
  function empFactor(r, r0) { return r <= r0 ? 1 : (r0 * r0) / (r * r); }
  function spinG(omega, r) { return omega * omega * r; }

  /* ---------- Weapons (rates in shots per second; everything finite) ---------- */
  var WEAPONS = {
    sine: { name: "Sine Beam", short: "SINE", rate: [7, 8, 9], speed: 950, dmg: [1, 1.2, 1.45], twin: [0, 0, 1],
      idea: "A travelling light wave. Step the frequency up and the wavelength shrinks (λ = c/f) while each photon carries more energy (E = hf)." },
    spread: { name: "Diffraction Spread", short: "GRATE", rate: [3.2, 3.6, 4.0], speed: 820, dmg: [0.8, 0.9, 1.0], d: [3.0e-6, 1.6e-6, 1.1e-6], weights: [1, 0.7, 0.5],
      idea: "A diffraction grating splits the beam into orders at d sinθ = nλ. Finer gratings (smaller d) and longer wavelengths fan out wider; orders with nλ/d > 1 vanish." },
    emp: { name: "EMP Pulse", short: "EMP", rate: [1.0, 1.2, 1.4], radius: [150, 190, 230], r0: 40, dmg: [6, 8, 10], stun: [1.2, 1.6, 2.0],
      idea: "An electromagnetic pulse from a sudden current surge. From a point source its intensity falls as 1/r², so it only bites up close. It overloads drone electronics." },
    lance: { name: "Interference Lance", short: "LANCE", rate: [6, 7, 8], range: [460, 540, 620], dmg: [0.9, 1.1, 1.3], slit: 4e-6, cone: 25,
      idea: "Two coherent beams from slits d apart overlap: bright fringes where the path difference is a whole number of wavelengths (y = nλL/d), dark in between. Only bright fringes do damage." },
    shield: { name: "Polariser Shield", short: "POL", move: [0.35, 0.45, 0.55], size: [64, 72, 80], step: 15,
      idea: "A polarising sheet passes I = I₀cos²θ of polarised light, where θ is the angle between its axis and the light's polarisation, and half of unpolarised light." }
  };

  /* ---------- Count Entropy's machines (Normal difficulty). rate = shots per second, 0 = never fires. ---------- */
  var ENEMIES = {
    walker: { name: "Disorder walker", hp: 3, speed: 70, rate: 0.45, shot: "shell", w: 34, h: 52, score: 100 },
    runner: { name: "Scatter wheel", hp: 2, speed: 230, rate: 0, w: 32, h: 30, score: 80 },
    jumper: { name: "Spring hopper", hp: 3, speed: 150, rate: 0, jump: 660, w: 32, h: 40, score: 120 },
    turret: { name: "Beam turret", hp: 8, speed: 0, rate: 0.6, shot: "beam", w: 40, h: 34, score: 200 },
    drone: { name: "Entropy drone", hp: 2, speed: 150, rate: 0.4, shot: "bomb", w: 36, h: 22, score: 120, fly: true, electronic: true },
    mine: { name: "Drift mine", hp: 1, speed: 0, rate: 0, w: 22, h: 22, blast: 72, score: 50, fly: true },
    carrier: { name: "Cargo pod", hp: 4, speed: 130, rate: 0, w: 46, h: 26, score: 300, fly: true },
    tower: { name: "Polarised beam tower", hp: 6, speed: 0, rate: 0.42, shot: "beam", w: 30, h: 70, score: 250 },
    filter: { name: "Filter knight", hp: 6, speed: 55, rate: 0.35, shot: "shell", w: 38, h: 56, score: 250 },
    splitter: { name: "Scatter cell", hp: 5, speed: 90, rate: 0, w: 40, h: 40, score: 180, splits: 2 },        // breaks into two scatter wheels
    warden: { name: "Shield warden", hp: 7, speed: 60, rate: 0.3, shot: "shell", w: 40, h: 58, score: 300 },     // front plate: hit it from behind, from above, or with the EMP
    sniper: { name: "Laser sniper", hp: 4, speed: 0, rate: 0.28, shot: "beam", w: 30, h: 54, score: 260, aimT: 0.9 } // shows its aim line before it fires
  };
  var FILTERS = { red: [620, 750], green: [495, 570], blue: [400, 495], yellow: [560, 620] }; // pass bands, nm
  var MIDS = {
    siege: { name: "Siege Walker", hp: [70, 60], w: 120, h: 130, look: "siege", move: "walk",
      phases: [{ every: 1.5, att: [["fan", { n: 3, spread: 26, kind: "shell" }], ["slam"]] }, { every: 1.1, att: [["fan", { n: 5, spread: 40, kind: "shell" }], ["aim", { kind: "beam", pol: 0 }], ["slam"]] }] },
    drill: { name: "Drill Carrier", hp: [80], w: 150, h: 90, look: "drill", move: "charge",
      phases: [{ every: 1.3, att: [["charge"], ["summon", { kind: "runner", n: 2 }], ["fan", { n: 3, spread: 30, kind: "shell" }]] }] },
    gatecore: { name: "Gate Core", hp: [60, 50], w: 90, h: 300, look: "gate", move: "wall", empWeak: 2,
      phases: [{ every: 1.2, att: [["aim", { kind: "beam", pol: 90 }], ["fan", { n: 4, spread: 50, kind: "shell" }]] }, { every: 0.9, att: [["aim", { kind: "beam", pol: 45 }], ["mines", { n: 2 }], ["summon", { kind: "drone", n: 2 }]] }] }
  };
  var BOSSES = {
    crawler: { name: "Tide Crawler", hp: [110, 100], w: 200, h: 120, look: "crawler", move: "walk",
      phases: [{ every: 1.4, att: [["fan", { n: 3, spread: 30, kind: "shell" }], ["slam"], ["aim", { kind: "beam", pol: null }]] },
        { every: 1.0, att: [["fan", { n: 5, spread: 50, kind: "shell" }], ["slam"], ["summon", { kind: "runner", n: 2 }], ["aim", { kind: "beam", pol: 0 }]] }] },
    turbine: { name: "Torrent Turbine", hp: [110, 100, 90], w: 180, h: 240, look: "turbine", move: "wall",
      phases: [{ every: 1.3, att: [["lob", { n: 4 }], ["aim", { kind: "beam", pol: 90 }]] },
        { every: 1.1, att: [["summon", { kind: "drone", n: 2 }], ["lob", { n: 5 }], ["fan", { n: 5, spread: 60, kind: "shell" }]] },
        { every: 0.8, att: [["sweep", { pol: 90 }], ["lob", { n: 6 }]] }] },
    transformer: { name: "Core Transformer", hp: [120, 110, 90], w: 220, h: 150, look: "transformer", move: "hover", empWeak: 2,
      phases: [{ every: 1.2, att: [["aim", { kind: "beam", pol: 45 }], ["fan", { n: 4, spread: 60, kind: "shell" }]] },
        { every: 1.0, att: [["mines", { n: 3 }], ["aim", { kind: "beam", pol: 135 }], ["rain", { n: 6 }]] },
        { every: 0.7, att: [["sweep", { pol: 45 }], ["aim", { kind: "beam", pol: 135 }], ["summon", { kind: "drone", n: 2 }]] }] },
    hydra: { name: "Antenna Hydra", hp: [140, 130], w: 260, h: 180, look: "hydra", move: "hover",
      phases: [{ every: 1.0, att: [["heads", { pols: [0, 45, 90] }], ["fan", { n: 3, spread: 30, kind: "shell" }]] },
        { every: 0.75, att: [["heads", { pols: [90, 135, 0] }], ["rain", { n: 8 }], ["summon", { kind: "drone", n: 2 }]] }] },
    hauler: { name: "Hover Hauler", hp: [150, 130], w: 240, h: 110, look: "hauler", move: "hover",
      phases: [{ every: 1.1, att: [["bombs", { n: 4 }], ["summon", { kind: "runner", n: 3 }], ["aim", { kind: "beam", pol: 0 }]] },
        { every: 0.8, att: [["sweep", { pol: 0 }], ["bombs", { n: 6 }], ["fan", { n: 5, spread: 50, kind: "shell" }]] }] },
    golem: { name: "Prism Golem", hp: [140, 120, 110], w: 170, h: 220, look: "golem", move: "walk", filters: [null, "red", "blue"],
      phases: [{ every: 1.2, att: [["spectrum", { n: 5 }], ["slam"]] },
        { every: 1.0, att: [["spectrum", { n: 7 }], ["aim", { kind: "beam", pol: 45 }], ["slam"]] },
        { every: 0.8, att: [["spectrum", { n: 9 }], ["sweep", { pol: 135 }], ["summon", { kind: "jumper", n: 2 }]] }] },
    gyro: { name: "Gyro Sentinel", hp: [160, 140], w: 200, h: 200, look: "gyro", move: "orbit", empWeak: 1.5,
      phases: [{ every: 1.0, att: [["ring", { n: 8 }], ["aim", { kind: "beam", pol: 90 }]] },
        { every: 0.7, att: [["ring", { n: 12 }], ["charge"], ["mines", { n: 3 }], ["sweep", { pol: 0 }]] }] },
    engine: { name: "Chaos Engine", hp: [170, 150, 140, 130], w: 260, h: 260, look: "engine", move: "hover", pod: 2,
      phases: [{ every: 1.1, att: [["fan", { n: 5, spread: 50, kind: "shell" }], ["aim", { kind: "beam", pol: 0 }], ["slam"]] },
        { every: 0.9, att: [["summon", { kind: "drone", n: 3 }], ["mines", { n: 3 }], ["heads", { pols: [45, 90, 135] }]] },
        { every: 0.8, att: [["sweep", { pol: 90 }], ["aim", { kind: "beam", pol: 45 }], ["disorder", { n: 10 }]] },
        { every: 0.6, att: [["disorder", { n: 14 }], ["sweep", { pol: 0 }], ["heads", { pols: [0, 90, 45] }], ["rain", { n: 8 }]] }] },
    mirage: { name: "Mirage Hydra", hp: [150, 140, 120], w: 260, h: 180, look: "hydra", move: "hover", hue: 140,
      phases: [{ every: 0.95, att: [["heads", { pols: [0, 90, 45] }], ["spectrum", { n: 5 }]] },
        { every: 0.8, att: [["heads", { pols: [135, 45, 90] }], ["rain", { n: 9 }], ["summon", { kind: "sniper", n: 1 }]] },
        { every: 0.65, att: [["sweep", { pol: 135 }], ["heads", { pols: [0, 45, 90] }], ["summon", { kind: "splitter", n: 2 }]] }] },
    refinery: { name: "Refinery Colossus", hp: [170, 150, 130], w: 200, h: 240, look: "turbine", move: "wall", hue: 200, empWeak: 1.5,
      phases: [{ every: 1.1, att: [["lob", { n: 5 }], ["aim", { kind: "beam", pol: 0 }], ["summon", { kind: "warden", n: 1 }]] },
        { every: 0.9, att: [["bombs", { n: 5 }], ["sweep", { pol: 90 }], ["fan", { n: 5, spread: 55, kind: "shell" }]] },
        { every: 0.7, att: [["lob", { n: 7 }], ["sweep", { pol: 45 }], ["mines", { n: 3 }]] }] },
    lantern: { name: "Lantern Swarm Queen", hp: [160, 150], w: 220, h: 150, look: "transformer", move: "hover", hue: 300,
      phases: [{ every: 0.9, att: [["ring", { n: 10 }], ["summon", { kind: "drone", n: 3 }], ["aim", { kind: "beam", pol: null }]] },
        { every: 0.65, att: [["ring", { n: 14 }], ["disorder", { n: 10 }], ["summon", { kind: "splitter", n: 2 }]] }] },
    echo: { name: "Entropy's Echo", hp: [180, 170, 160, 150, 140], w: 270, h: 270, look: "engine", move: "hover", pod: 2, hue: 250, empWeak: 1.2,
      phases: [{ every: 1.0, att: [["fan", { n: 6, spread: 60, kind: "shell" }], ["aim", { kind: "beam", pol: 45 }], ["summon", { kind: "warden", n: 1 }]] },
        { every: 0.85, att: [["heads", { pols: [0, 45, 90] }], ["mines", { n: 4 }], ["summon", { kind: "sniper", n: 2 }]] },
        { every: 0.75, att: [["spectrum", { n: 9 }], ["sweep", { pol: 135 }], ["rain", { n: 10 }]] },
        { every: 0.65, att: [["ring", { n: 14 }], ["disorder", { n: 12 }], ["summon", { kind: "splitter", n: 3 }]] },
        { every: 0.55, att: [["disorder", { n: 16 }], ["sweep", { pol: 0 }], ["heads", { pols: [135, 90, 45] }], ["lob", { n: 7 }]] }] }
  };

  /* ---------- Stages: section lists expanded by build() into geometry, spawns and events ---------- */
  var STAGES = [
    { id: "coast", name: "Coastline Relay", seed: 11, theme: "coast", song: [1901, "synthwave", 128], bossSong: [1951, "boss", 150],
      intro: "Count Entropy has seized the coastal relay that beams power to the city. Fight along the shore and take it back.",
      secs: [["run", { len: 1700, foes: "walker,runner", n: 9, gaps: 1, carrier: "spread" }], ["run", { len: 1600, foes: "walker,drone,turret", n: 10, gaps: 2, secret: 1 }],
        ["arena", { waves: [["walker", 4], ["runner", 4], ["drone", 3]] }], ["run", { len: 1700, foes: "walker,jumper,drone,mine", n: 11, gaps: 2, carrier: "spread" }],
        ["mid", { boss: "siege" }], ["run", { len: 1800, foes: "walker,turret,drone,runner,tower", n: 13, gaps: 2, secret: 1, carrier: "emp" }],
        ["arena", { waves: [["jumper", 3], ["walker", 4], ["drone", 4]] }], ["run", { len: 1400, foes: "walker,runner,turret", n: 10, gaps: 1 }], ["boss", { boss: "crawler" }]] },
    { id: "falls", name: "Cascade Lift", seed: 22, theme: "falls", song: [1902, "afro", 118], bossSong: [1952, "boss", 156],
      intro: "The relay's power line climbs a waterfall to the dam. Cross the falls, ride the service lift and stop the turbine.",
      secs: [["run", { len: 1500, foes: "walker,drone,runner", n: 9, gaps: 1, carrier: "spread" }], ["falls", { len: 1700, foes: "drone,jumper,turret" , n: 8, secret: 1 }],
        ["arena", { waves: [["drone", 4], ["jumper", 3], ["walker", 4]] }], ["lift", { rise: 1500, waves: [["drone", 3], ["jumper", 3], ["drone", 4], ["jumper", 4]] }],
        ["run", { len: 1500, foes: "walker,turret,tower,mine", n: 11, gaps: 2, carrier: "emp" }], ["mid", { boss: "drill" }],
        ["falls", { len: 1700, foes: "drone,jumper,turret,mine", n: 10, secret: 1 }], ["run", { len: 1200, foes: "walker,runner,drone", n: 9, gaps: 1, carrier: "spread" }], ["boss", { boss: "turbine" }]] },
    { id: "plant", name: "Power Plant Maze", seed: 33, theme: "plant", song: [1903, "breaks", 134], bossSong: [1953, "boss", 160],
      intro: "Inside the plant, Entropy's drones have rewired the halls into a maze of live arcs. Find the open gaps, floor by floor.",
      secs: [["run", { len: 1300, foes: "walker,drone", n: 8, gaps: 1, carrier: "emp" }], ["maze", { len: 2200, foes: "walker,drone,turret,mine", n: 14, secret: 1 }],
        ["arena", { waves: [["drone", 5], ["walker", 4], ["drone", 5]] }], ["maze", { len: 2200, foes: "walker,jumper,turret,drone", n: 14, carrier: "spread" }],
        ["mid", { boss: "gatecore" }], ["maze", { len: 1800, foes: "drone,turret,mine,tower", n: 12, secret: 1, carrier: "emp" }],
        ["run", { len: 1000, foes: "walker,runner", n: 7, gaps: 1 }], ["boss", { boss: "transformer" }]] },
    { id: "tower", name: "Signal Tower Climb", seed: 44, theme: "tower", song: [1904, "synthwave", 120], bossSong: [1954, "boss", 164],
      intro: "Entropy's mast jams every radio in the region. Climb it floor by floor while its towers fire polarised beams.",
      secs: [["run", { len: 1400, foes: "walker,tower,drone", n: 9, gaps: 1, carrier: "shield" }], ["climb", { floors: 10, foes: "drone,jumper,turret,tower", n: 10, secret: 1 }],
        ["arena", { waves: [["drone", 4], ["jumper", 4], ["walker", 5]] }], ["climb", { floors: 12, foes: "drone,tower,mine,jumper", n: 12, carrier: "lance" }],
        ["mid", { boss: "siege" }], ["run", { len: 1400, foes: "walker,tower,turret", n: 10, gaps: 2, secret: 1 }], ["climb", { floors: 8, foes: "drone,tower,jumper", n: 9, carrier: "emp" }], ["boss", { boss: "hydra" }]] },
    { id: "roofs", name: "Rooftop Chase", seed: 55, theme: "roofs", song: [1905, "breaks", 142], bossSong: [1955, "boss", 168],
      intro: "Count Entropy's hauler is fleeing across the rooftops with the stolen relay core. The city scrolls on: keep up!",
      secs: [["run", { len: 1300, foes: "walker,runner,drone", n: 9, gaps: 2, carrier: "lance" }], ["roof", { len: 2600, speed: 150, foes: "runner,drone,jumper,mine", n: 14, secret: 1 }],
        ["arena", { waves: [["runner", 5], ["drone", 4], ["jumper", 4]] }], ["roof", { len: 2600, speed: 175, foes: "runner,drone,walker,turret", n: 15, carrier: "spread" }],
        ["mid", { boss: "drill" }], ["roof", { len: 2000, speed: 190, foes: "drone,jumper,tower,mine", n: 13, secret: 1, carrier: "lance" }], ["boss", { boss: "hauler" }]] },
    { id: "canyon", name: "Spectral Canyon", seed: 66, theme: "canyon", song: [1906, "amapiano", 112], bossSong: [1956, "boss", 152],
      intro: "In the crystal canyon Entropy's filter knights carry coloured glass. Tune your frequency so your light gets through.",
      secs: [["run", { len: 1600, foes: "filter,walker,drone", n: 10, gaps: 1, carrier: "spread" }], ["falls", { len: 1500, foes: "filter,drone,turret", n: 9, secret: 1 }],
        ["arena", { waves: [["filter", 3], ["drone", 4], ["filter", 4]] }], ["run", { len: 1800, foes: "filter,tower,jumper,mine", n: 13, gaps: 2, carrier: "shield" }],
        ["mid", { boss: "gatecore" }], ["lift", { rise: 1200, waves: [["drone", 4], ["jumper", 4], ["drone", 5]] }],
        ["run", { len: 1600, foes: "filter,walker,turret,runner", n: 12, gaps: 2, secret: 1, carrier: "emp" }], ["boss", { boss: "golem" }]] },
    { id: "orbit", name: "Orbital Station", seed: 77, theme: "orbit", song: [1907, "dub", 124], bossSong: [1957, "boss", 170],
      intro: "Entropy launched the relay core to his spinning station. Light needs no medium: your beams work fine in vacuum.",
      secs: [["space", { len: 1800, foes: "drone,mine,turret", n: 11, carrier: "emp" }], ["space", { len: 1800, foes: "walker,tower,drone", n: 12, g: 0.55, secret: 1 }],
        ["arena", { waves: [["drone", 5], ["walker", 4], ["mine", 5], ["drone", 4]] }], ["space", { len: 2000, foes: "jumper,drone,mine,turret", n: 13, g: 0.4, carrier: "lance" }],
        ["mid", { boss: "siege" }], ["space", { len: 1800, foes: "walker,tower,drone,filter", n: 12, secret: 1, carrier: "spread" }], ["boss", { boss: "gyro" }]] },
    { id: "fortress", name: "Entropy Fortress", seed: 88, theme: "fortress", song: [1908, "march", 132], bossSong: [1958, "boss", 176],
      intro: "The relay core powers Count Entropy's fortress. Everything you have learned about light is needed here.",
      secs: [["run", { len: 1500, foes: "walker,filter,tower,drone", n: 11, gaps: 2, carrier: "lance" }], ["maze", { len: 2000, foes: "walker,turret,drone,mine", n: 14, secret: 1 }],
        ["arena", { waves: [["filter", 3], ["drone", 5], ["jumper", 4], ["walker", 5]] }], ["climb", { floors: 9, foes: "drone,tower,jumper", n: 10, carrier: "emp" }],
        ["mid", { boss: "gatecore" }], ["roof", { len: 1800, speed: 170, foes: "runner,drone,mine,jumper", n: 12, secret: 1, carrier: "spread" }],
        ["arena", { waves: [["walker", 5], ["filter", 4], ["drone", 6]] }], ["run", { len: 1200, foes: "walker,tower,turret,filter", n: 10, gaps: 1 }], ["boss", { boss: "engine" }]] },
    /* ---------- After the fortress: Entropy's echo (stages 9–12) ---------- */
    { id: "dunes", name: "Harmattan Dunes", seed: 99, theme: "dunes", song: [1909, "afro", 124], bossSong: [1959, "boss", 158],
      intro: "The fortress fell, but its signal echoes. In the dusty harmattan, scatter cells split apart when you break them, and wardens hide behind shield plates.",
      secs: [["run", { len: 1600, foes: "walker,splitter,runner", n: 11, gaps: 1, carrier: "spread" }], ["run", { len: 1700, foes: "warden,drone,splitter,turret", n: 12, gaps: 2, secret: 1 }],
        ["arena", { waves: [["splitter", 3], ["warden", 2], ["drone", 4]] }], ["falls", { len: 1500, foes: "drone,jumper,warden", n: 10, carrier: "emp" }],
        ["mid", { boss: "siege" }], ["run", { len: 1800, foes: "splitter,warden,tower,mine", n: 13, gaps: 2, secret: 1, carrier: "lance" }],
        ["arena", { waves: [["warden", 3], ["splitter", 4], ["drone", 5]] }], ["run", { len: 1300, foes: "walker,splitter,turret", n: 10, gaps: 1 }], ["boss", { boss: "mirage" }]] },
    { id: "lagoon", name: "Lagoon Refinery", seed: 111, theme: "lagoon", song: [1910, "dub", 120], bossSong: [1960, "boss", 162],
      intro: "The echo has taken the lagoon refinery. Laser snipers show their aim line before they fire: break cover when it fades.",
      secs: [["run", { len: 1500, foes: "walker,sniper,drone", n: 10, gaps: 1, carrier: "shield" }], ["maze", { len: 2000, foes: "sniper,turret,mine,warden", n: 13, secret: 1 }],
        ["lift", { rise: 1300, waves: [["drone", 4], ["sniper", 2], ["jumper", 4], ["drone", 5]] }], ["arena", { waves: [["sniper", 3], ["warden", 3], ["splitter", 4]] }],
        ["mid", { boss: "drill" }], ["run", { len: 1800, foes: "sniper,warden,tower,runner", n: 13, gaps: 2, secret: 1, carrier: "emp" }],
        ["falls", { len: 1500, foes: "drone,sniper,mine", n: 10, carrier: "spread" }], ["boss", { boss: "refinery" }]] },
    { id: "market", name: "Night Market Grid", seed: 122, theme: "market", song: [1911, "amapiano", 116], bossSong: [1961, "boss", 166],
      intro: "Stall lights flicker as the echo feeds on the market's power. Run the rooftops, then hold the square.",
      secs: [["run", { len: 1400, foes: "walker,runner,splitter", n: 10, gaps: 1, carrier: "lance" }], ["roof", { len: 2400, speed: 165, foes: "runner,drone,splitter,sniper", n: 14, secret: 1 }],
        ["arena", { waves: [["splitter", 4], ["drone", 5], ["sniper", 2], ["warden", 3]] }], ["climb", { floors: 10, foes: "drone,tower,sniper,jumper", n: 11, carrier: "emp" }],
        ["mid", { boss: "gatecore" }], ["roof", { len: 2000, speed: 185, foes: "drone,jumper,warden,mine", n: 13, secret: 1, carrier: "spread" }], ["boss", { boss: "lantern" }]] },
    { id: "echo", name: "Echo Core", seed: 133, theme: "echo", song: [1912, "synthwave", 136], bossSong: [1962, "boss", 180],
      intro: "The last of Count Entropy's signal has folded in on itself. Every machine you have met is here. Bring order.",
      secs: [["space", { len: 1800, foes: "warden,sniper,drone,mine", n: 13, g: 0.6, carrier: "lance" }], ["maze", { len: 2000, foes: "splitter,turret,warden,sniper", n: 14, secret: 1 }],
        ["arena", { waves: [["warden", 3], ["sniper", 3], ["splitter", 4], ["filter", 3]] }], ["climb", { floors: 10, foes: "drone,tower,sniper,jumper", n: 11, carrier: "emp" }],
        ["mid", { boss: "siege" }], ["roof", { len: 1800, speed: 180, foes: "runner,drone,splitter,warden", n: 13, secret: 1, carrier: "spread" }],
        ["arena", { waves: [["filter", 4], ["warden", 4], ["sniper", 3], ["drone", 6]] }], ["run", { len: 1200, foes: "walker,tower,sniper,filter", n: 11, gaps: 1 }], ["boss", { boss: "echo" }]] }
  ];

  /* ---------- Upgrade tree: spent with "photons" earned by clearing stages and surviving waves. Each branch is bought in order. ---------- */
  var UPGRADES = [
    { id: "armour", name: "Armour", nodes: [
      { id: "plate", name: "Extra plate", cost: 40, text: "+1 armour segment." },
      { id: "mend", name: "Field mend", cost: 90, text: "Clearing an arena or a survival wave restores 1 armour." },
      { id: "phase", name: "Phase blink", cost: 150, text: "Respawn shield lasts 4 s instead of 2.6 s." },
      { id: "spare", name: "Spare body", cost: 240, text: "+1 life at the start of every stage." }] },
    { id: "optics", name: "Optics", nodes: [
      { id: "tuned", name: "Tuned emitter", cost: 40, text: "Sine Beam starts at level 2." },
      { id: "cadence", name: "Fast cadence", cost: 90, text: "Every weapon fires 10% faster." },
      { id: "focus", name: "Tight focus", cost: 150, text: "Every weapon does 10% more damage." },
      { id: "memory", name: "Weapon memory", cost: 240, text: "Losing a life no longer lowers your weapon level." }] },
    { id: "tactics", name: "Tactics", nodes: [
      { id: "wide", name: "Wide polariser", cost: 40, text: "Polariser shield is 15% bigger." },
      { id: "reach", name: "Long pulse", cost: 90, text: "EMP radius +15% (the 1/r² falloff still applies)." },
      { id: "magnet", name: "Pickup magnet", cost: 150, text: "Pickups drift to you from 160 px away." },
      { id: "bounty", name: "Bounty", cost: 240, text: "+10% score." }] }
  ];
  function upgradeCost(have, branch, i) { var b = UPGRADES.filter(function (x) { return x.id === branch; })[0]; if (!b || !b.nodes[i]) return null; for (var j = 0; j < i; j++) if (!have[b.nodes[j].id]) return null; return have[b.nodes[i].id] ? 0 : b.nodes[i].cost; }

  /* ---------- Survival: an endless arena. Waves grow with n; every 5th wave adds a modifier, every 10th brings a boss. ---------- */
  var MODIFIERS = [
    { id: "lowg", name: "Low gravity", text: "Gravity at 55%: jumps go higher." },
    { id: "fast", name: "Overclocked", text: "Machines move and fire 25% faster." },
    { id: "swarm", name: "Drone swarm", text: "Every wave brings extra drones." },
    { id: "polar", name: "Polar storm", text: "Every beam is polarised at 45°: turn your shield to 135°." },
    { id: "glass", name: "Glass cannon", text: "One armour segment, double score." },
    { id: "dark", name: "Blackout", text: "The arena goes dark beyond your light." },
    { id: "heavy", name: "Armoured", text: "Machines have 40% more hit points." }
  ];
  var WAVE_POOL = ["walker", "runner", "jumper", "drone", "splitter", "warden", "sniper", "filter", "mine", "turret"];
  function survivalWave(n, seed) { // n from 1: [[kind, count], ...]; deterministic for a seed
    var r = rng((seed || 1) * 1000 + n), unlocked = WAVE_POOL.slice(0, Math.min(WAVE_POOL.length, 3 + Math.floor(n / 2))), out = [], groups = 1 + Math.min(3, Math.floor(n / 4));
    for (var g = 0; g < groups; g++) { var k = unlocked[Math.floor(r() * unlocked.length)]; out.push([k, Math.min(9, 2 + Math.floor(n / 3) + Math.floor(r() * 2))]); }
    return out;
  }
  function survivalBoss(n, seed) { var r = rng((seed || 1) * 77 + n), keys = Object.keys(BOSSES), mids = Object.keys(MIDS); return n % 10 === 0 ? { t: "boss", boss: keys[Math.floor(r() * keys.length)] } : n % 5 === 0 ? { t: "mid", boss: mids[Math.floor(r() * mids.length)] } : null; }
  function survivalScale(n) { return 1 + Math.max(0, n - 1) * 0.06; } // enemy HP multiplier: +6% a wave
  function buildSurvival() { // a flat arena wider than a phone screen, with ledges
    var G = 460, len = 1700, o = { k: -1, def: { id: "survival", name: "Survival", theme: "arena", intro: "" }, solids: [{ x: -400, y: G, w: len + 800, h: 600, kind: "ground" }, { x: -400, y: -900, w: 400, h: G + 900, kind: "hull" }, { x: len, y: -900, w: 400, h: G + 900, kind: "hull" }],
      plats: [{ x: 200, y: G - 130, w: 220 }, { x: 640, y: G - 230, w: 420 }, { x: 1280, y: G - 130, w: 220 }, { x: 520, y: G - 360, w: 160 }, { x: 1020, y: G - 360, w: 160 }],
      movers: [], hazards: [], props: [], items: [], spawns: [], events: [], bands: [{ x0: -1e5, x1: 1e5, top: G - 460, bottom: G + 80 }], gzones: [], deco: [], secrets: 0, boss: null, finish: 1e9, len: len, endY: G };
    return o;
  }

  function rng(seed) { var s = (seed * 2654435761 >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* build(k): expand stage k into { solids, plats, movers, hazards, props, items, spawns, events, bands, gzones, deco, boss, finish } */
  function build(k) {
    var D = STAGES[k], r = rng(D.seed), G = 460, cx = 0, VW = 960;
    var o = { k: k, def: D, solids: [], plats: [], movers: [], hazards: [], props: [], items: [], spawns: [], events: [], bands: [], gzones: [], deco: [], secrets: 0, boss: null, finish: 0 };
    function solid(x, y, w, h, kind) { o.solids.push({ x: x, y: y, w: w, h: h, kind: kind || "ground" }); }
    function plat(x, y, w) { o.plats.push({ x: x, y: y, w: w }); }
    function spawn(x, y, kind, extra) { var s = { x: Math.round(x), y: Math.round(y), k: kind }; for (var e in extra || {}) s[e] = extra[e]; o.spawns.push(s); }
    function band(x0, x1, top, bottom) { o.bands.push({ x0: x0, x1: x1, top: top, bottom: bottom }); }
    function pick(list) { return list[Math.floor(r() * list.length)]; }
    function foes(list, n, places) { // places: [{x0,x1,y,kind:'ground'|'air'}]
      var kinds = list.split(","), filt = ["red", "green", "blue", "yellow"];
      for (var i = 0; i < n; i++) {
        // spread evenly along the section, then snap to the nearest standing place
        var lo = Math.min.apply(null, places.map(function (q) { return q.x0; })), hi = Math.max.apply(null, places.map(function (q) { return q.x1; }));
        var want = lo + (i + .2 + .6 * r()) / n * (hi - lo), pl = places.slice().sort(function (a, b) { return dist(a, want) - dist(b, want) || r() - .5; })[r() < .7 ? 0 : Math.min(1, places.length - 1)];
        var kd = kinds[i % kinds.length], x = Math.max(pl.x0 + 30, Math.min(pl.x1 - 30, want));
        if (pl.x1 - pl.x0 < 60) x = (pl.x0 + pl.x1) / 2;
        var ex = {};
        if (kd === "tower" || kd === "turret" || kd === "sniper") ex.pol = pick([0, 45, 90, 135, null]);
        if (kd === "filter") ex.filter = filt[(i + k) % 4];
        if (kd === "drone" || kd === "mine") spawn(x, pl.y - 170 - r() * 120, kd, ex);
        else if (kd === "turret" && pl.ceil) spawn(x, pl.ceil, kd, { pol: ex.pol, hang: true });
        else spawn(x, pl.y, kd, ex);
      }
    }
    function dist(q, x) { return x < q.x0 ? q.x0 - x : x > q.x1 ? x - q.x1 : 0; }
    function carrier(x, y, w) { spawn(x, y, "carrier", { drop: w }); }
    function secret(x, y) { o.items.push({ x: x, y: y, kind: "cell", secret: true }); o.secrets++; }

    var sec = {
      run: function (s) {
        var end = cx + s.len, x = cx, gaps = s.gaps || 0, ground = [], y = G, prevGap = false;
        function seg(a, b) { solid(a, y, b - a, 600); ground.push({ x0: a, x1: b, y: y }); }
        seg(x, x + 320); x += 320;
        while (x < end - 380) {
          var w = 280 + r() * 360;
          if (gaps > 0 && !prevGap && r() < 0.5) { var gw = 90 + Math.round(r() * 25); if (r() < .5) o.hazards.push({ x: x, y: y + 60, w: gw, h: 40, kind: "spikes" }); x += gw; gaps--; prevGap = true; continue; }
          else if (!prevGap && r() < 0.35) { y = Math.max(G - 70, Math.min(G + 40, y + (r() < .5 ? -1 : 1) * (40 + Math.round(r() * 30)))); }
          prevGap = false;
          seg(x, Math.min(end - 300, x + w)); x = Math.min(end - 300, x + w);
        }
        y = G; seg(x, end);
        ground.forEach(function (g, i) {
          if (g.x1 - g.x0 > 300 && r() < .65) { var pw = 140 + r() * 120; plat(g.x0 + 60 + r() * (g.x1 - g.x0 - pw - 80), g.y - 125, pw); }
          if (g.x1 - g.x0 > 260 && r() < .5) o.props.push({ x: g.x0 + 40 + r() * (g.x1 - g.x0 - 120), y: g.y - 40, w: 40, h: 40, hp: 4, kind: r() < .3 ? "tank" : "crate", drop: r() < .25 ? "medal" : null });
        });
        var places = ground.filter(function (g) { return g.x1 - g.x0 > 120 && g.x0 > cx + 300; });
        foes(s.foes, s.n, places.length ? places : ground);
        if (s.carrier) carrier(cx + s.len * .45, G - 270, s.carrier);
        if (s.secret) { var gs = ground[Math.floor(ground.length * .6)], sx = gs.x0 + 20; plat(sx, gs.y - 125, 110); plat(sx + 130, gs.y - 245, 90); secret(sx + 175, gs.y - 275); }
        band(cx, end, G - 140 - 460, G + 80);
        cx = end;
      },
      arena: function (s) {
        solid(cx, G, 960, 600); plat(cx + 160, G - 130, 180); plat(cx + 620, G - 130, 180); plat(cx + 390, G - 250, 180);
        o.events.push({ x: cx, t: "arena", x0: cx, x1: cx + 960, waves: s.waves });
        band(cx, cx + 960, G - 460, G + 80); cx += 960;
      },
      mid: function (s) {
        solid(cx, G, 960, 600); plat(cx + 120, G - 140, 160); plat(cx + 680, G - 140, 160);
        o.events.push({ x: cx, t: "mid", x0: cx, x1: cx + 960, boss: s.boss });
        band(cx, cx + 960, G - 460, G + 80); cx += 960;
      },
      boss: function (s) {
        solid(cx, G, 1200, 600); plat(cx + 140, G - 140, 170); plat(cx + 650, G - 140, 170);
        o.events.push({ x: cx, t: "boss", x0: cx, x1: cx + 960, boss: s.boss }); o.boss = { x: cx, kind: s.boss };
        band(cx, cx + 1200, G - 460, G + 80); o.finish = cx + 1080; cx += 1200;
      },
      climb: function (s) {
        var W = 880, x0 = cx + 200, n = s.floors, top = G - 120 * (n + 1), places = [];
        solid(cx, G, W + 400, 600);
        solid(x0 - 40, top - 700, 40, (G - 170) - (top - 700));             // left wall, entry gap at the bottom
        solid(x0 + W, top - 700, 40, (top - 170) - (top - 700));            // right wall above the exit
        solid(x0 + W, top, 40, G - top);                                     // right wall below the exit
        for (var i = 1; i <= n; i++) {
          var y = G - 120 * i, left = i % 2 === 1;
          if (i % 4 === 0) { plat(x0, y, W * .3); plat(x0 + W * .7, y, W * .3); places.push({ x0: x0, x1: x0 + W * .3, y: y }); }
          else { var a = left ? x0 : x0 + W * .42; plat(a, y, W * .58); places.push({ x0: a, x1: a + W * .58, y: y }); }
          if (i % 3 === 0) o.hazards.push({ x: left ? x0 + W - 70 : x0 + 10, y: y - 20, w: 60, h: 20, kind: "arc", period: 2.6, on: 1.1, ph: i * .7 });
        }
        plat(x0, top, W); solid(x0 + W, top, 440, 600); places.push({ x0: x0, x1: x0 + W, y: top });
        foes(s.foes, s.n, places.slice(1));
        if (s.carrier) carrier(x0 + W / 2, G - 120 * Math.round(n / 2) - 60, s.carrier);
        if (s.secret) { plat(x0 + W / 2 - 50, G - 120 * (n - 1) - 60, 100); secret(x0 + W / 2, G - 120 * (n - 1) - 90); }
        band(cx, x0 + W + 40, top - 460, G + 80);
        o.deco.push({ t: "shaft", x: x0, y: top - 200, w: W, h: G - top + 200 });
        cx = x0 + W + 40; G = top; band(cx, cx + 400, G - 460, G + 80); cx += 400;
      },
      lift: function (s) {
        var W = 720, x0 = cx + 240, top = G - s.rise;
        solid(cx, G, 240, 600);
        solid(x0 - 40, top - 700, 40, (G - 170) - (top - 700));
        solid(x0 + W, top, 40, G + 600 - top); solid(x0 + W, top - 700, 40, 530);
        solid(x0, G + 140, W, 460);
        o.movers.push({ x: x0, y: G, w: W, lift: true, y0: G, y1: top, speed: 75 });
        for (var j = 1; j < s.rise / 300; j++) spawn(j % 2 ? x0 + 8 : x0 + W - 48, G - j * 300, "turret", { wall: j % 2 ? 1 : -1, pol: [0, 90, 45, null][j % 4] });
        o.events.push({ x: x0, t: "lift", x0: x0, x1: x0 + W, waves: s.waves });
        o.deco.push({ t: "lift", x: x0, y: top - 200, w: W, h: G - top + 340 });
        band(cx, x0 + W + 40, top - 460, G + 80);
        cx = x0 + W + 40; G = top; solid(cx, G, 400, 600); band(cx, cx + 400, G - 460, G + 80); cx += 400;
      },
      falls: function (s) {
        var end = cx + s.len, x = cx + 260, places = [];
        solid(cx, G, 260, 600); o.hazards.push({ x: cx + 260, y: G + 70, w: s.len - 520, h: 60, kind: "water" });
        var flip = 0;
        while (x < end - 400) {
          var gap = 95 + r() * 25;
          x += gap;
          if (flip++ % 2) { var w = 150 + r() * 80, y = G - 40 + Math.round(r() * 60); solid(x, y, w, 600, "rock"); places.push({ x0: x, x1: x + w, y: y }); x += w; }
          else { var mw = 130; o.movers.push({ x: x, y: G - 10, w: mw, ax: 0, ay: 34, period: 2.2 + r(), ph: r() * 6 }); o.deco.push({ t: "fall", x: x - 20, y: G - 700, w: 70 }); x += mw; }
        }
        solid(end - 260, G, 260, 600); places.push({ x0: end - 260, x1: end, y: G });
        foes(s.foes, s.n, places);
        o.deco.push({ t: "fall", x: cx + s.len * .3, y: G - 700, w: 120 }); o.deco.push({ t: "fall", x: cx + s.len * .7, y: G - 700, w: 90 });
        if (s.secret) { var p = places[Math.floor(places.length / 2)]; plat(p.x0, p.y - 150, 100); secret(p.x0 + 50, p.y - 180); }
        band(cx, end, G - 460, G + 80); cx = end;
      },
      maze: function (s) {
        var end = cx + s.len, ceil = G - 400, x = cx, room = 0, places = [];
        solid(cx, ceil - 300, s.len, 300, "metal"); solid(cx, G, s.len, 600, "metal");
        while (x < end - 300) {
          var w = 420 + Math.round(r() * 120), x1 = Math.min(end, x + w), lvl = room === 0 ? 0 : Math.floor(r() * 3);
          plat(x + 10, G - 120, (x1 - x) * (room % 2 ? .55 : .8)); plat(x1 - (x1 - x) * .55, G - 240, (x1 - x) * .55);
          places.push({ x0: x, x1: x1, y: G, ceil: ceil + 4 }); places.push({ x0: x + 10, x1: x + 10 + (x1 - x) * .5, y: G - 120 });
          if (room % 2) o.hazards.push({ x: x + w * .45, y: G - 30, w: 70, h: 30, kind: "arc", period: 2.4, on: 1.0, ph: room });
          if (x1 < end - 200) { // wall with one opening at level lvl (0 floor, 1 = G-120, 2 = G-240)
            var oy = G - 120 * lvl, top = oy - 112;
            solid(x1, ceil, 36, top - ceil, "metal"); if (oy < G) solid(x1, oy, 36, G - oy, "metal");
            plat(x1 - 140, oy, 316);
            if (lvl === 2) plat(x1 - 300, G - 120, 230);                       // stepping ledge up to the high gap
          }
          x = x1; room++;
        }
        foes(s.foes, s.n, places.filter(function (p) { return p.x0 > cx + 200; }));
        if (s.carrier) carrier(cx + s.len * .5, G - 330, s.carrier);
        if (s.secret) { o.props.push({ x: cx + s.len * .4, y: G - 72, w: 36, h: 72, hp: 10, kind: "cracked", drop: null }); secret(cx + s.len * .4 + 18, G - 36); }
        o.deco.push({ t: "maze", x: cx, y: ceil, w: s.len, h: 400 });
        band(cx, end, G - 460, G + 80); cx = end;
      },
      roof: function (s) {
        var end = cx + s.len, x = cx, y = G, places = [];
        o.events.push({ x: cx, t: "scroll", x0: cx, x1: end - 960, speed: s.speed });
        while (x < end) {
          var w = Math.min(end - x, 380 + r() * 420); solid(x, y, w, 600, "roof"); places.push({ x0: x, x1: x + w, y: y });
          if (r() < .5) o.props.push({ x: x + w * .5, y: y - 46, w: 54, h: 46, hp: 6, kind: "ac", drop: r() < .3 ? "medal" : null });
          if (r() < .4) plat(x + 40, y - 130, 140);
          x += w; if (x < end - 200) { x += 85 + Math.round(r() * 40); y = Math.max(G - 90, Math.min(G + 40, y + (r() < .5 ? -1 : 1) * Math.round(r() * 70))); }
        }
        foes(s.foes, s.n, places.filter(function (p) { return p.x0 > cx + 300; }));
        if (s.carrier) carrier(cx + s.len * .5, G - 280, s.carrier);
        if (s.secret) { var p = places[Math.floor(places.length / 2)]; plat(p.x0 + 20, p.y - 125, 120); plat(p.x0 + 60, p.y - 245, 80); secret(p.x0 + 100, p.y - 275); }
        band(cx, end, G - 140 - 460, G + 80); cx = end;
      },
      space: function (s) {
        var end = cx + s.len, ceil = G - 380, x = cx, places = [];
        solid(cx, ceil - 300, s.len, 300, "hull"); solid(cx, G, s.len, 600, "hull");
        if (s.g) o.gzones.push({ x0: cx, x1: end, g: s.g });
        while (x < end - 200) {
          var w = 360 + r() * 260; places.push({ x0: x, x1: Math.min(end, x + w), y: G, ceil: ceil + 4 });
          if (r() < .6) plat(x + 80, G - 125, 160); if (r() < .4) plat(x + 200, G - 245, 140);
          x += w; if (x < end - 300 && r() < .45) o.props.push({ x: x, y: ceil, w: 34, h: G - ceil, hp: 14, kind: "door", drop: r() < .5 ? "medal" : null });
        }
        foes(s.foes, s.n, places.filter(function (p) { return p.x0 > cx + 250; }));
        if (s.carrier) carrier(cx + s.len * .5, G - 260, s.carrier);
        if (s.secret) { o.props.push({ x: cx + s.len * .6, y: G - 70, w: 60, h: 70, hp: 10, kind: "cracked", drop: null }); secret(cx + s.len * .6 + 30, G - 35); }
        o.deco.push({ t: "space", x: cx, y: ceil, w: s.len, h: 380, g: s.g || 1 });
        band(cx, end, G - 460, G + 80); cx = end;
      }
    };
    D.secs.forEach(function (s) { sec[s[0]](s[1]); });
    o.len = cx; o.endY = G;
    o.spawns.sort(function (a, b) { return a.x - b.x; });
    for (var i = 1; i < o.spawns.length; i++) if (o.spawns[i].x <= o.spawns[i - 1].x) o.spawns[i].x = o.spawns[i - 1].x + 1; // strictly increasing
    o.events.sort(function (a, b) { return a.x - b.x; });
    o.props.forEach(function (p, i) { p.id = i; p.max = p.hp; });
    return o;
  }

  var api = { C: C, H: H, F_REF: F_REF, FREQS: FREQS, NM_PX: NM_PX, lambda: lambda, nm: nm, photonEV: photonEV, damageFactor: damageFactor, drawnLambda: drawnLambda,
    colour: colour, band: band, gratingAngles: gratingAngles, malus: malus, transmit: transmit, fringeY: fringeY, fringeI: fringeI, empFactor: empFactor, spinG: spinG,
    WEAPONS: WEAPONS, ENEMIES: ENEMIES, FILTERS: FILTERS, MIDS: MIDS, BOSSES: BOSSES, STAGES: STAGES, build: build, rng: rng,
    UPGRADES: UPGRADES, upgradeCost: upgradeCost, MODIFIERS: MODIFIERS, survivalWave: survivalWave, survivalBoss: survivalBoss, survivalScale: survivalScale, buildSurvival: buildSurvival };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WavefrontData = api;
})(typeof window !== "undefined" ? window : this);
