/* Impulse Arena: data + simulation core (UMD: window.ClashData in the browser, module.exports in Node).
 * Everything here is deterministic given a seed, so Node tests can play whole CPU-vs-CPU matches.
 * Physics model (simplified, disclosed in game): 1 m = 100 px, g = 9.8 m/s², every hit is an impulse J (N·s) that changes the
 * defender's velocity by Δv = J/m. A hit's contact time Δt sets the average force F̄ = J/Δt; damage is proportional to that
 * force, so a block, which stretches Δt by 4×, cuts the force (and the damage) to ¼ while the same impulse still pushes the
 * blocker back. Sliding fighters slow at a = μg (μ = 0.6). Impulses are about 5–10× a real punch so the knockback is visible.
 * Frame data is in 60 fps frames; the sim runs at 120 steps per second. Specials are labelled game metaphors. */
(function (root, factory) {
  var D = factory();
  if (typeof module === "object" && module.exports) module.exports = D;
  if (typeof window !== "undefined") window.ClashData = D;
})(this, function () {
  "use strict";
  var FPS = 60;
  var PHYS = { g: 9.8, mu: 0.6, muGlide: 0.1, px: 100, stageW: 12, view: 9.6, walk: 2.1, walkBack: 1.7, run: 4.6, jumpV: 5.4, jumpVX: 2.4,
    blockDt: 4, maxSep: 7.4, roundTime: 60, hp: 100, standH: 1.75, crouchH: 1.05, airH: 1.5, half: 0.3, exCost: 50, finaleT: 5, finisherT: 3.6 };
  var BTN = ["LP", "HP", "LK", "HK"];
  var DIRS = ["D", "F", "B", "U"];

  /* ---------- Fighters (masses match Arcade.CAST; "look" only for characters not in the shared cast) ---------- */
  var FIGHTERS = {
    newton: { mass: 80, speed: 1.0, jump: 1.0, power: 1.05, arena: "orchard", col: "#f6c445" },
    tesla: { mass: 74, speed: 1.04, jump: 1.02, power: 1.03, arena: "coil", col: "#7ef0ff" },
    einstein: { mass: 72, speed: 1.0, jump: 1.0, power: 1.04, arena: "observatory", col: "#fff3a6" },
    curie: { mass: 58, speed: 1.1, jump: 1.08, power: 0.9, arena: "accel", col: "#3dd68c" },
    faraday: { mass: 70, speed: 1.05, jump: 1.0, power: 0.97, arena: "coil", col: "#a78bfa" },
    bohr: { mass: 86, speed: 0.92, jump: 0.95, power: 1.08, arena: "observatory", col: "#7ef0ff" },
    groove: { mass: 64, speed: 1.14, jump: 1.06, power: 1.07, arena: "quad", col: "#ff3d8b" },
    kai: { mass: 66, speed: 1.1, jump: 1.1, power: 1.07, arena: "quad", col: "#d62828" },
    inertia: { mass: 110, speed: 0.86, jump: 0.85, power: 1.1, arena: "foundry", col: "#ff9d5c", boss: "mid",
      look: { id: "inertia", name: "Professor Inertia", life: "mid-boss", skin: "#e2b48c", hair: "#3a3a3a", style: "receding", coat: "#4b5563", eye: "#1e1e1e", guest: true,
        fact: "An original EE Hub mid-boss: a heavyweight who never changes his mind, or his velocity, without a net force.", src: "Original EE Hub character",
        special: "Unstoppable charge", idea: "Inertia is resistance to a change in motion; more mass means a smaller Δv for the same impulse." } },
    entropy: { mass: 82, speed: 1.06, jump: 1.04, power: 1.08, arena: "clock", col: "#c084fc", boss: "final" }
  };
  var ORDER = ["newton", "tesla", "einstein", "curie", "faraday", "bohr", "groove", "kai"];
  var BOSSES = ["inertia", "entropy"];

  /* ---------- Normal moves (frames at 60 fps; J in N·s; dt = contact time in s; reach/h in m) ----------
     lvl: high (whiffs over a crouching rival), mid, low (block crouching), overhead (block standing), throw (unblockable). */
  var NORMALS = {
    lp: { name: "Low punch", st: 4, act: 3, rec: 8, dmg: 4, J: 90, dt: 0.010, reach: 0.75, h: 1.15, lvl: "mid", hs: 16, bs: 10 },
    hp: { name: "High punch", st: 6, act: 3, rec: 13, dmg: 7, J: 140, dt: 0.010, reach: 0.85, h: 1.5, lvl: "high", hs: 20, bs: 12 },
    lk: { name: "Low kick", st: 6, act: 3, rec: 12, dmg: 5, J: 110, dt: 0.012, reach: 0.9, h: 0.35, lvl: "low", hs: 17, bs: 11 },
    hk: { name: "High kick", st: 9, act: 4, rec: 18, dmg: 10, J: 200, dt: 0.012, reach: 1.05, h: 1.45, lvl: "high", hs: 22, bs: 14 },
    c_lp: { name: "Crouching punch", st: 4, act: 3, rec: 9, dmg: 3, J: 70, dt: 0.010, reach: 0.75, h: 0.7, lvl: "mid", hs: 15, bs: 10, crouch: true },
    c_lk: { name: "Crouching low kick", st: 5, act: 3, rec: 10, dmg: 4, J: 90, dt: 0.012, reach: 0.95, h: 0.2, lvl: "low", hs: 16, bs: 10, crouch: true },
    c_hk: { name: "Crouching high kick", st: 8, act: 4, rec: 16, dmg: 8, J: 170, dt: 0.012, reach: 1.05, h: 0.35, lvl: "low", hs: 20, bs: 12, crouch: true },
    upper: { name: "Uppercut (↓ + HP)", st: 7, act: 5, rec: 28, dmg: 12, J: 360, ang: 72, dt: 0.010, reach: 0.8, h: 1.2, hr: 0.8, lvl: "mid", hs: 30, bs: 14, launch: true, crouch: true },
    sweep: { name: "Sweep (← + LK)", st: 9, act: 4, rec: 24, dmg: 8, J: 130, ang: 15, dt: 0.012, reach: 1.15, h: 0.15, lvl: "low", hs: 30, bs: 12, kd: true, crouch: true },
    j_p: { name: "Air punch", st: 4, act: 7, rec: 6, dmg: 6, J: 130, ang: -20, dt: 0.010, reach: 0.8, h: 0.75, hr: 0.5, lvl: "overhead", hs: 18, bs: 10, air: true },
    j_k: { name: "Air kick (jump-in)", st: 5, act: 9, rec: 6, dmg: 9, J: 180, ang: -10, dt: 0.012, reach: 0.95, h: 0.45, hr: 0.55, lvl: "overhead", hs: 21, bs: 12, air: true },
    throw: { name: "Throw (close + LP)", st: 3, act: 2, rec: 30, dmg: 12, J: 300, ang: 40, dt: 0.05, reach: 0.75, h: 1.0, lvl: "throw", hs: 30, bs: 0, kd: true }
  };
  var CHAINS = [
    { id: "lab", name: "Lab Jab", seq: ["hp", "hp", "lp"] },
    { id: "double", name: "Double Kick", seq: ["hk", "lk"] },
    { id: "body", name: "Body Rush", seq: ["lp", "lp", "hp"] },
    { id: "lowhigh", name: "Low–High", seq: ["lk", "hk"] },
    { id: "tri", name: "Tri-Strike", seq: ["lp", "hp", "hk"] }
  ];
  var BTN_MOVE = { LP: "lp", HP: "hp", LK: "lk", HK: "hk" };

  /* ---------- Specials: in = motion tokens + button, or {hold, t} (hold a button t seconds, release).
     sc = shortcut direction with the Special button (F/B/D/U + SP). Each has a labelled game-metaphor caption. ---------- */
  function S(o) { o.st = o.st || 10; o.act = o.act || 2; o.rec = o.rec || 18; o.dt = o.dt || 0.01; o.lvl = o.lvl || "mid"; o.hs = o.hs || 22; o.bs = o.bs || 12; return o; }
  var SPECIALS = {
    newton: [
      S({ id: "cannon", name: "Momentum Cannon", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 13, rec: 22, dmg: 10, J: 240, v: 6, life: 2.4, h: 1.2, r: 0.3, art: "ball", hs: 26, kd: true,
        cap: "A 40 kg cartoon cannonball.", idea: "Momentum p = mv: 40 kg × 6 m/s = 240 N·s. Stopping it hands over the impulse J = Δp = 240 N·s." }),
      S({ id: "reversal", name: "Third-Law Reversal", in: ["D", "B", "LP"], sc: "B", kind: "shield", effect: "reflect", dur: 0.55, st: 3, act: 30, rec: 14,
        cap: "Bounces projectiles back and returns melee pushes.", idea: "Newton's third law: if A pushes B, B pushes A with an equal and opposite force." }),
      S({ id: "apple", name: "Falling Apple", in: ["D", "D", "HP"], sc: "D", kind: "drop", drop: 4, st: 12, rec: 20, dmg: 9, J: 220, lvl: "overhead", hs: 30, art: "apple",
        cap: "A giant 25 kg cartoon apple.", idea: "Dropped from h = 4 m it lands at v = √(2gh) ≈ 8.9 m/s after t = √(2h/g) ≈ 0.9 s (air resistance ignored)." }),
      S({ id: "shoulder", name: "Principia Shoulder", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 5, st: 8, act: 21, rec: 18, dmg: 10, J: 260, reach: 0.7, h: 1.2, armor: true, kd: true,
        cap: "An armoured shoulder charge.", idea: "80 kg moving at 5 m/s carries p = mv = 400 N·s; more mass, more momentum at the same speed." }),
      S({ id: "prism", name: "Prism Flash", in: { hold: "LP", t: 1 }, sc: null, kind: "strike", st: 6, act: 6, rec: 20, dmg: 5, J: 60, reach: 1.35, h: 1.3, hr: 0.9, hs: 55, art: "prism",
        cap: "A dazzling rainbow flash.", idea: "A prism splits white light into a spectrum because each colour refracts by a different amount (dispersion)." }),
      S({ id: "orbit", name: "Orbit Kick", in: ["F", "D", "F", "LK"], sc: "U", kind: "rise", vy: 5.6, vx: 1.2, st: 4, act: 10, rec: 24, dmg: 11, J: 320, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
        cap: "A rising anti-air kick.", idea: "At the top of its arc a projectile has vy = 0; only the horizontal speed is left." })
    ],
    tesla: [
      S({ id: "bolt", name: "Coil Bolt", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 11, rec: 20, dmg: 8, J: 150, dt: 0.008, v: 9, life: 1.6, h: 1.3, r: 0.25, art: "bolt",
        cap: "A lightning bolt from a hand-held coil.", idea: "A Tesla coil is a resonant transformer: it steps voltage up to hundreds of kilovolts, enough to break down air (≈ 3 MV/m)." }),
      S({ id: "ray", name: "Death Ray", in: { hold: "HP", t: 1 }, sc: null, kind: "beam", st: 18, act: 16, rec: 30, dmg: 13, J: 220, dt: 0.02, reach: 7.5, h: 1.35, hr: 0.4, hs: 28, kd: true, art: "ray",
        cap: "Tesla's claimed 'teleforce' beam was never built or demonstrated.", idea: "Energy delivered is power × time, E = PΔt: a 1 kW beam for 2 s carries 2 kJ." }),
      S({ id: "spark", name: "Spark-Gap Uppercut", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.5, vx: 1.2, st: 5, act: 10, rec: 26, dmg: 11, J: 320, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spark",
        cap: "A rising spark.", idea: "A spark jumps a gap once the electric field exceeds air's breakdown strength, about 3 MV/m." }),
      S({ id: "ac", name: "AC Pulse", in: ["D", "B", "LP"], sc: "B", kind: "proj", st: 14, rec: 22, dmg: 7, J: 140, v: 5, life: 2.2, h: 1.1, r: 0.3, art: "ac", wave: 1.5,
        cap: "A pulse that pushes, then pulls.", idea: "On a 50 Hz grid (Nigeria) alternating current reverses direction 100 times a second." }),
      S({ id: "trap", name: "Induction Coil Trap", in: ["D", "D", "LK"], sc: "D", kind: "trap", dist: 2.2, life: 6, st: 16, rec: 18, dmg: 8, J: 150, lvl: "low", hs: 34, art: "coil",
        cap: "A coil hidden in the floor.", idea: "Faraday's law: a changing magnetic flux induces an EMF, ε = −dΦ/dt." }),
      S({ id: "aura", name: "Overload Aura", in: ["B", "B", "HK"], sc: null, kind: "aura", dur: 2.5, reach: 1.15, tick: 0.4, st: 10, rec: 16, dmg: 2, J: 60, hs: 14, art: "aura",
        cap: "A crackling halo.", idea: "Charge leaks from sharp points into the air as a corona discharge: the glow you can see around high-voltage lines." })
    ],
    einstein: [
      S({ id: "photon", name: "Photon Shot", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 9, rec: 18, dmg: 7, J: 110, dt: 0.006, v: 14, life: 1.2, h: 1.3, r: 0.2, art: "photon",
        cap: "A fast straight-line shot.", idea: "Light arrives in photons of energy E = hf. In game the shot just flies fast in a straight line." }),
      S({ id: "dilate", name: "Time-Dilation Field", in: ["D", "B", "HP"], sc: "B", kind: "field", effect: "slow", range: 6, dur: 2.5, st: 16, rec: 26, art: "clock",
        cap: "Your rival's clock runs at half speed for 2.5 s.", idea: "Moving clocks run slow by γ = 1/√(1 − v²/c²). γ = 2 (half speed) would need v ≈ 0.87c." }),
      S({ id: "lightdash", name: "Light-Speed Dash", in: ["B", "F", "HK"], sc: "D", kind: "rush", v: 11, st: 6, act: 20, rec: 20, dmg: 9, J: 190, reach: 0.6, h: 1.1, through: true, art: "streak",
        cap: "A blur of a dash (not light speed!).", idea: "Nothing with mass reaches c ≈ 3.0 × 10⁸ m/s. This dash is 11 m/s, about 0.000004 % of c." }),
      S({ id: "burst", name: "Mass–Energy Burst", in: { hold: "HP", t: 1 }, sc: "U", kind: "strike", both: true, st: 10, act: 6, rec: 24, dmg: 12, J: 300, ang: 30, reach: 1.25, h: 1.0, hr: 1.0, kd: true, art: "burst",
        cap: "A flash of 'converted' energy.", idea: "E = mc²: 1 g of mass is equivalent to 9 × 10¹³ J. The burst is a metaphor, nothing is converted." }),
      S({ id: "well", name: "Gravity Well", in: ["D", "D", "HP"], sc: null, kind: "field", effect: "pull", range: 5, J: 180, dmg: 3, st: 14, rec: 20, art: "well",
        cap: "A dip in spacetime pulls the rival in.", idea: "General relativity: gravity is the curvature of spacetime, and objects follow the curves." }),
      S({ id: "hop", name: "Equivalence Hop", in: ["B", "B", "LK"], sc: null, kind: "hop", vy: 4.6, vx: 2.6, gScale: 0.45, st: 4, act: 2, rec: 4, art: "float",
        cap: "A floaty low-g hop.", idea: "Equivalence principle: in a closed box you cannot tell gravity from acceleration." })
    ],
    curie: [
      S({ id: "cloud", name: "Half-Life Cloud", in: ["D", "B", "HP"], sc: "B", kind: "proj", st: 16, rec: 22, dmg: 2, J: 20, v: 1.4, life: 4, h: 1.0, r: 0.75, art: "cloud", dot: 16, linger: true,
        cap: "A cartoon glowing cloud (real radiation is no toy).", idea: "Activity halves every half-life: A = A₀(½)^(t/T½). Game half-life T½ = 1 s, so the damage rate halves each second." }),
      S({ id: "polonium", name: "Polonium Glow Shot", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 10, rec: 20, dmg: 4, J: 90, v: 10, life: 1.4, h: 1.3, r: 0.2, art: "glow", dot: 4,
        cap: "A small glowing shot that keeps stinging.", idea: "Curie named polonium after Poland (1898). Polonium-210's real half-life is about 138 days." }),
      S({ id: "radium", name: "Radium Glow", in: ["D", "F", "HP"], sc: null, kind: "proj", st: 13, rec: 22, dmg: 8, J: 150, v: 6.5, life: 2, h: 1.2, r: 0.3, art: "glow2", dot: 6,
        cap: "A bigger, slower glow.", idea: "Radium (discovered 1898) glows faintly; radium-226's half-life is about 1600 years." }),
      S({ id: "alpha", name: "Alpha Burst", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.2, vx: 1, st: 5, act: 10, rec: 24, dmg: 10, J: 300, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "alpha",
        cap: "A rising burst.", idea: "Alpha particles are helium nuclei: two protons and two neutrons. A sheet of paper stops them." }),
      S({ id: "fade", name: "Decay Fade", in: ["B", "B", "LK"], sc: "D", kind: "tele", to: "back", st: 4, act: 8, rec: 10, inv: 14, art: "fade",
        cap: "She fades out and reappears further back.", idea: "One atom's decay is random; only the average over many atoms is predictable." }),
      S({ id: "geiger", name: "Geiger Rush", in: ["B", "F", "LK"], sc: null, kind: "rush", v: 4.5, st: 7, act: 30, rec: 18, dmg: 3, J: 70, n: 3, reach: 0.7, h: 0.3, lvl: "low", hs: 18, art: "clicks",
        cap: "A low slide that 'clicks' three times.", idea: "A Geiger counter clicks once for each ionising particle it detects." })
    ],
    faraday: [
      S({ id: "cage", name: "Faraday Cage", in: ["D", "B", "HP"], sc: "B", kind: "shield", effect: "cage", dur: 3, st: 8, act: 2, rec: 12, art: "cage",
        cap: "Projectiles stop at the bars; melee damage is halved.", idea: "Charges sit on the outside of a closed conductor, so the field inside is zero: a car shields you from lightning." }),
      S({ id: "pull", name: "Induction Pull", in: ["D", "F", "LK"], sc: "F", kind: "field", effect: "pull", range: 4.5, J: 200, dmg: 4, st: 12, rec: 20, art: "loops",
        cap: "Reels the rival in.", idea: "Faraday's law: a changing magnetic flux induces a current, and that current feels a force in the field." }),
      S({ id: "brake", name: "Lenz Brake", in: ["D", "D", "LP"], sc: "D", kind: "field", effect: "brake", range: 5, dur: 2.5, st: 12, rec: 20, art: "brake",
        cap: "Your rival's motion is opposed for 2.5 s.", idea: "Lenz's law: the induced current opposes the change that caused it. Magnetic train brakes work this way." }),
      S({ id: "dynamo", name: "Dynamo Spark", in: ["D", "F", "HP"], sc: null, kind: "proj", st: 12, rec: 20, dmg: 8, J: 150, v: 7, life: 1.8, h: 1.2, r: 0.25, art: "spark",
        cap: "A spark from a spinning dynamo.", idea: "A wire of length L moving at v across a field B has an EMF ε = BLv." }),
      S({ id: "lash", name: "Field-Line Lash", in: ["B", "F", "HK"], sc: "U", kind: "strike", st: 9, act: 5, rec: 20, dmg: 9, J: 200, ang: 25, reach: 1.7, h: 1.1, hr: 0.7, art: "lines",
        cap: "A long whip of field lines.", idea: "Field lines show which way a north pole would be pushed; they never cross." }),
      S({ id: "bubbles", name: "Electrolysis Bubbles", in: { hold: "LK", t: 1 }, sc: null, kind: "proj", st: 10, rec: 18, dmg: 6, J: 90, v: 2.6, life: 3, h: 0.6, r: 0.35, rise: 0.35, art: "bubble",
        cap: "Slow floating gas bubbles.", idea: "Faraday's law of electrolysis: the mass released is proportional to the charge passed, m = (Q/F)(M/z)." })
    ],
    bohr: [
      S({ id: "tele", name: "Quantum Teleport", in: ["D", "D", "LK"], sc: "D", kind: "tele", to: "behind", st: 6, act: 8, rec: 10, inv: 12, art: "fade",
        cap: "He vanishes and reappears behind you.", idea: "In Bohr's model an electron jumps between allowed orbits without passing through the space between." }),
      S({ id: "orbitals", name: "Electron Shield", in: ["D", "B", "LP"], sc: "B", kind: "shield", effect: "orbit", charges: 3, dur: 6, st: 8, act: 2, rec: 12, art: "orbit",
        cap: "Three orbiting electrons each soak up one hit.", idea: "Bohr's electrons may only circle on orbits whose angular momentum is a whole number of ħ." }),
      S({ id: "wave", name: "Complementarity Wave", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 12, rec: 20, dmg: 8, J: 150, v: 7, life: 1.8, h: 1.2, r: 0.3, phase: true, art: "wave",
        cap: "A wave that passes through other projectiles.", idea: "Complementarity: electrons and light act as waves or particles depending on the experiment." }),
      S({ id: "levels", name: "Energy-Level Jump", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 5.8, vx: 0.8, st: 5, act: 12, rec: 24, dmg: 11, J: 330, ang: 75, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "levels",
        cap: "A rising jump in three steps.", idea: "Hydrogen's levels are Eₙ = −13.6 eV / n²; a jump between two levels emits light of one colour." }),
      S({ id: "spectral", name: "Spectral Kick", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 4, st: 8, act: 16, rec: 18, dmg: 9, J: 210, reach: 0.9, h: 1.0, art: "spectrum",
        cap: "A kick trailing spectral lines.", idea: "Each element has its own set of spectral lines, a fingerprint of its energy levels." }),
      S({ id: "slam", name: "Atomic Slam", in: { hold: "HK", t: 1 }, sc: null, kind: "strike", both: true, st: 14, act: 6, rec: 24, dmg: 11, J: 258, ang: 35, reach: 1.8, h: 0.15, hr: 0.4, lvl: "low", kd: true, art: "quake",
        cap: "A floor-shaking stomp (block it low).", idea: "86 kg landing at 3 m/s pushes the floor with p = mv = 258 N·s." })
    ],
    groove: [
      S({ id: "glide", name: "Glide Slide", in: ["D", "F", "LK"], sc: "D", kind: "rush", v: 6, glide: true, st: 6, act: 33, rec: 16, dmg: 8, J: 170, ang: 20, reach: 0.75, h: 0.2, lvl: "low", kd: true, art: "slide",
        cap: "A low slide on a near-frictionless floor.", idea: "Friction f = μN. Dropping μ from 0.6 to 0.1 makes the stopping distance d = v²/(2μg) six times longer." }),
      S({ id: "spin", name: "Spin Cycle", in: ["B", "F", "HP"], sc: "F", kind: "rush", v: 2.6, st: 7, act: 36, rec: 16, dmg: 3.5, J: 70, n: 4, reach: 0.8, h: 1.2, hr: 0.7, art: "spin",
        cap: "Four spinning hits.", idea: "Angular momentum L = Iω is conserved: pull your arms in (smaller I) and you spin faster." }),
      S({ id: "bass", name: "Bass Drop", in: ["D", "D", "HP"], sc: null, kind: "proj", st: 12, rec: 22, dmg: 7, J: 140, v: 7, life: 1.5, h: 0.2, r: 0.3, lvl: "low", art: "sound",
        cap: "A shock wave along the floor (block it low).", idea: "Sound is a pressure wave; in air at 20 °C it travels at about 343 m/s." }),
      S({ id: "doppler", name: "Doppler Dash", in: ["B", "B", "HK"], sc: null, kind: "rush", v: 8, st: 6, act: 22, rec: 18, dmg: 7, J: 160, reach: 0.6, h: 1.1, through: true, art: "doppler",
        cap: "A dash straight through you.", idea: "Doppler effect: a source moving towards you sounds higher; moving away, lower." }),
      S({ id: "beat", name: "Resonance Beat", in: { hold: "LP", t: 1 }, sc: "U", kind: "strike", both: true, st: 8, act: 6, rec: 22, dmg: 5, J: 80, reach: 1.4, h: 1.0, hr: 1.0, hs: 50, art: "rings",
        cap: "A dizzying beat.", idea: "Resonance: pushing a system at its natural frequency builds up a large amplitude." }),
      S({ id: "moon", name: "Moonwalk Glide", in: ["D", "B", "LK"], sc: "B", kind: "buff", effect: "glide", dur: 3, st: 4, act: 2, rec: 8, art: "ice",
        cap: "μ: 0.6 → 0.1 for 3 s, and quicker feet.", idea: "With little friction a push keeps you gliding: Newton's first law in action." })
    ],
    kai: [
      S({ id: "push", name: "One-Inch Push", in: ["D", "F", "HP"], sc: "F", kind: "strike", st: 10, act: 3, rec: 24, dmg: 15, J: 420, dt: 0.004, reach: 0.9, h: 1.2, hr: 0.6, kd: true, art: "push",
        cap: "A tiny wind-up, a huge shove.", idea: "Impulse J = FΔt = Δp: 420 N·s delivered in 4 ms is an average force of 105 kN (game-scaled)." }),
      S({ id: "flurry", name: "Hundred-Palm Flurry", in: ["B", "F", "LP"], sc: null, kind: "rush", v: 1.2, st: 6, act: 40, rec: 18, dmg: 2.5, J: 50, n: 6, reach: 0.85, h: 1.2, hr: 0.6, art: "flurry",
        cap: "Six quick palms.", idea: "Small impulses add up: the total change in momentum is the sum, Δp = ΣJ." }),
      S({ id: "crane", name: "Crane Rise", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 6, vx: 1, st: 4, act: 12, rec: 24, dmg: 11, J: 330, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
        cap: "A soaring kick.", idea: "Take-off speed comes from the impulse your legs give the floor: v = J/m." }),
      S({ id: "roll", name: "Momentum Roll", in: ["D", "B", "LK"], sc: "D", kind: "rush", v: 5, st: 5, act: 27, rec: 14, dmg: 6, J: 140, reach: 0.6, h: 0.3, lvl: "low", projInv: true, art: "roll",
        cap: "A low roll that ducks projectiles.", idea: "A rolling body has two kinds of kinetic energy: KE = ½mv² + ½Iω²." }),
      S({ id: "iron", name: "Iron Stance", in: ["D", "D", "LP"], sc: "B", kind: "shield", effect: "armor", dur: 0.9, st: 3, act: 50, rec: 10, art: "stance",
        cap: "Absorbs hits without being moved.", idea: "A wide stance lowers your centre of mass and widens your base, so a push is less likely to tip you." }),
      S({ id: "palm", name: "Palm Wave", in: { hold: "HP", t: 1 }, sc: null, kind: "proj", st: 10, rec: 22, dmg: 10, J: 240, v: 8, life: 0.4, h: 1.2, r: 0.35, art: "palm",
        cap: "A short-range air blast.", idea: "A sharp push sends a pressure pulse through the air, a tiny shock wave." })
    ],
    inertia: [
      S({ id: "charge", name: "Unstoppable Charge", in: ["B", "F", "HP"], sc: "F", kind: "rush", v: 4.5, st: 10, act: 36, rec: 22, dmg: 12, J: 330, reach: 0.8, h: 1.2, armor: true, kd: true, art: "dust",
        cap: "An armoured charge.", idea: "First law: a body keeps moving until a net force acts. 110 kg at 4.5 m/s carries p = 495 N·s." }),
      S({ id: "stomp", name: "Heavy Stomp", in: ["D", "D", "HK"], sc: "D", kind: "strike", both: true, st: 16, act: 6, rec: 26, dmg: 11, J: 260, ang: 40, reach: 2.2, h: 0.15, hr: 0.4, lvl: "low", kd: true, art: "quake",
        cap: "The floor jumps (block low).", idea: "A big mass stopping fast pushes the floor hard: F̄ = Δp/Δt." }),
      S({ id: "flywheel", name: "Flywheel Spin", in: ["D", "B", "HK"], sc: "B", kind: "rush", v: 1.2, st: 9, act: 42, rec: 22, dmg: 3.5, J: 90, n: 4, reach: 0.95, h: 1.1, hr: 0.8, art: "spin",
        cap: "A slow, heavy spin.", idea: "Rotational inertia I = Σmr²; a flywheel stores energy ½Iω²." }),
      S({ id: "driver", name: "Mass Driver", in: ["D", "F", "LP"], sc: null, kind: "proj", st: 14, rec: 22, dmg: 10, J: 250, v: 7, life: 2, h: 1.1, r: 0.32, art: "ball",
        cap: "A launched steel slug.", idea: "Magnets accelerate a payload along a track; its momentum is p = mv." }),
      S({ id: "brace", name: "Brace", in: { hold: "LK", t: 1 }, sc: null, kind: "shield", effect: "armor", dur: 2, st: 6, act: 2, rec: 10, art: "stance",
        cap: "Armour for 2 s.", idea: "More mass, smaller Δv for the same impulse: Δv = J/m." }),
      S({ id: "bump", name: "Rebound Bump", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 4.4, vx: 0.6, st: 6, act: 12, rec: 26, dmg: 12, J: 380, ang: 70, reach: 0.9, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
        cap: "A rising belly bump.", idea: "In a collision the total momentum is conserved; the lighter body gets the bigger Δv." })
    ],
    entropy: [
      S({ id: "scramble", name: "Disorder Scramble", in: ["D", "B", "HP"], sc: "B", kind: "field", effect: "scramble", range: 5.5, dur: 3, st: 14, rec: 22, art: "dice",
        cap: "Your left and right swap for 3 s (a story effect).", idea: "Entropy measures disorder: S = k ln W, where W counts the ways a system can be arranged." }),
      S({ id: "drain", name: "Entropy Drain", in: ["D", "D", "LP"], sc: "D", kind: "field", effect: "drain", range: 4.5, amount: 40, st: 12, rec: 20, art: "drain",
        cap: "Steals up to 40 % of your super meter.", idea: "Second law: in an isolated system entropy never decreases, so useful energy runs down. (Game metaphor.)" }),
      S({ id: "orb", name: "Heat-Death Orb", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 12, rec: 22, dmg: 10, J: 180, v: 4.5, life: 2.6, h: 1.2, r: 0.32, wobble: 0.5, art: "orb",
        cap: "A wandering orb.", idea: "Heat flows from hot to cold on its own, never the reverse." }),
      S({ id: "warp", name: "Random Walk", in: ["D", "D", "LK"], sc: null, kind: "tele", to: "random", st: 5, act: 8, rec: 10, inv: 12, art: "fade",
        cap: "Reappears somewhere random.", idea: "A random walker drifts on average about √N steps from the start after N steps." }),
      S({ id: "surge", name: "Second-Law Surge", in: ["B", "F", "HK"], sc: "U", kind: "rush", v: 6, st: 8, act: 24, rec: 18, dmg: 6, J: 150, n: 2, reach: 0.7, h: 1.1, art: "streak",
        cap: "A two-hit surge.", idea: "Mixing is easy and unmixing is hard: that's why processes run one way." }),
      S({ id: "arrow", name: "Arrow of Time", in: { hold: "HK", t: 1 }, sc: null, kind: "beam", st: 16, act: 14, rec: 28, dmg: 12, J: 200, dt: 0.02, reach: 6, h: 1.25, hr: 0.4, kd: true, art: "ray2",
        cap: "A beam pointing one way only.", idea: "The arrow of time points from low to high entropy: eggs break but never unbreak." })
    ]
  };

  /* ---------- Finishers: comic, harmless, only in the FINALE! window when the rival is dizzy ---------- */
  var FINISHERS = {
    newton: { name: "Gravity's Gift", in: ["D", "D", "U", "HP"], art: "apple", text: "A giant cartoon apple bonks them. Boing!" },
    tesla: { name: "Light-Bulb Moment", in: ["F", "B", "F", "HK"], art: "bulb", text: "They light up like a bulb. Ding! Bright idea." },
    einstein: { name: "Time Flies", in: ["B", "F", "B", "LP"], art: "old", text: "Fifty years pass in two seconds: a cartoon grandparent with a cane, then back." },
    curie: { name: "Night-Light", in: ["F", "D", "B", "LK"], art: "nightlight", text: "They glow a soft green like a night-light and nod off. (Cartoon glow only.)" },
    faraday: { name: "Cage Bounce", in: ["D", "F", "D", "HK"], art: "cage", text: "Dropped into a Faraday cage: sparks outside, safe and grumpy inside." },
    bohr: { name: "Superposition", in: ["D", "U", "D", "HP"], art: "copies", text: "Split into three blinking copies that collapse into one very confused one." },
    groove: { name: "Dance-Off", in: ["F", "B", "F", "LK"], art: "disco", text: "A disco ball drops and they can't stop dancing, then flop." },
    kai: { name: "Featherweight Flick", in: ["B", "B", "F", "HP"], art: "flick", text: "One finger poke on a frictionless floor: they glide into a pile of cushions." },
    inertia: { name: "Gym Ball", in: ["F", "F", "D", "HK"], art: "ball", text: "A giant soft gym ball rolls over them. Flat as a pancake, then pop!" },
    entropy: { name: "Total Mess", in: ["D", "B", "D", "LK"], art: "mess", text: "Hair becomes a bird's nest, socks mismatch, papers everywhere." }
  };

  /* ---------- Weapons: pickups and buyable starting weapons (same stats; break after a few hits; dropped on knock-down) ---------- */
  var WEAPONS = {
    rule: { name: "Metre rule", shop: "wpn-rule", price: 150, reach: 0.6, st: 6, act: 4, rec: 12, dmg: 6, J: 120, dt: 0.012, hs: 18, bs: 11, uses: 10, col: "#e9c46a", len: 1.0,
      idea: "Tip speed v = ωr: a 1 m rule swung at 14 rad/s has a 14 m/s tip, so length buys reach and speed." },
    wrench: { name: "Big wrench", shop: "wpn-wrench", price: 180, reach: 0.35, st: 10, act: 4, rec: 20, dmg: 11, J: 240, dt: 0.008, hs: 24, bs: 14, uses: 8, kd: true, col: "#9aa4b5", len: 0.45,
      idea: "Torque τ = rF: a long handle turns a stiff nut with less force." },
    staff: { name: "Coil staff", shop: "wpn-staff", price: 220, reach: 0.75, st: 9, act: 5, rec: 18, dmg: 8, J: 160, dt: 0.01, hs: 30, bs: 13, uses: 8, col: "#c08a3e", len: 1.1,
      idea: "An induction coil stores energy in its magnetic field, E = ½LI²." },
    fork: { name: "Tuning fork", shop: "wpn-fork", price: 160, reach: 0.45, st: 7, act: 4, rec: 14, dmg: 6, J: 100, dt: 0.01, hs: 34, bs: 12, uses: 10, col: "#d6dde6", len: 0.5,
      idea: "A tuning fork rings at one natural frequency, e.g. 440 Hz for concert A." }
  };

  /* ---------- Arenas (2.5D scenes, each with its own seeded music) ---------- */
  var ARENAS = [
    { id: "coil", name: "Coil Hall", seed: 4101, style: "synthwave", bpm: 124 },
    { id: "quad", name: "Campus Quad at Dusk", seed: 4102, style: "afro", bpm: 112 },
    { id: "orchard", name: "Apple Orchard", seed: 4103, style: "funk", bpm: 108 },
    { id: "observatory", name: "Rooftop Observatory", seed: 4104, style: "dub", bpm: 96 },
    { id: "accel", name: "Accelerator Tunnel", seed: 4105, style: "chip", bpm: 136 },
    { id: "foundry", name: "Flywheel Foundry", seed: 4106, style: "march", bpm: 116 },
    { id: "clock", name: "Clock Tower of Disorder", seed: 4107, style: "boss", bpm: 140 }
  ];
  var ARENA = {}; ARENAS.forEach(function (a) { ARENA[a.id] = a; });

  /* ---------- Tower: 8 regular fights, a mid-boss (5th) and the final boss (10th). Difficulty rises each rung. ---------- */
  var SKILL = [0.12, 0.22, 0.32, 0.42, 0.55, 0.58, 0.66, 0.74, 0.82, 0.92];
  function tower(player) {
    var pool = ORDER.filter(function (id) { return id !== player; }), rungs = [], k = 0;
    for (var i = 0; i < 10; i++) {
      var r = { n: i + 1, skill: SKILL[i] };
      if (i === 4) { r.opp = "inertia"; r.boss = "mid"; r.arena = "foundry"; }
      else if (i === 9) { r.opp = "entropy"; r.boss = "final"; r.arena = "clock"; }
      else if (i === 8) { r.opp = player; r.mirror = true; r.arena = "accel"; }
      else { r.opp = pool[k++ % pool.length]; r.arena = FIGHTERS[r.opp].arena; }
      rungs.push(r);
    }
    return rungs;
  }
  var DIFFICULTY = [{ id: "easy", name: "Easy", s: 0.15 }, { id: "normal", name: "Normal", s: 0.45 }, { id: "hard", name: "Hard", s: 0.72 }, { id: "master", name: "Master", s: 0.95 }];

  /* ---------- helpers ---------- */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function frames(mv) { return (mv.st + mv.act + mv.rec) / FPS; }
  function advantage(mv) { return { hit: (mv.hs || 0) - mv.rec - (mv.act - 1), block: (mv.bs || 0) - mv.rec - (mv.act - 1) }; }
  function seqString(inp) {
    var g = { D: "↓", F: "→", B: "←", U: "↑" };
    if (!Array.isArray(inp)) return "hold " + inp.hold + " " + inp.t + " s, release";
    return inp.map(function (t) { return g[t] || " + " + t; }).join("").replace(/^ \+ /, "");
  }
  function validInput(inp) {
    if (!Array.isArray(inp)) return !!(inp && BTN.indexOf(inp.hold) >= 0 && inp.t > 0);
    if (inp.length < 2) return false;
    for (var i = 0; i < inp.length - 1; i++) if (DIRS.indexOf(inp[i]) < 0) return false;
    return BTN.indexOf(inp[inp.length - 1]) >= 0;
  }

  /* ---------- match ---------- */
  function fighter(id, side, o) {
    o = o || {}; var d = FIGHTERS[id];
    return { id: id, side: side, d: d, m: d.mass, x: side ? 7.6 : 4.4, y: 0, vx: 0, vy: 0, face: side ? -1 : 1, hp: PHYS.hp, ghost: PHYS.hp, meter: 0, wins: 0,
      st: "intro", t: 0, mv: null, kind: null, fired: false, hits: 0, lastHit: -9, chain: [], conn: false, crouch: false, inv: 0, buf: {}, orbit: 0,
      dot: null, wpn: o.weapon ? { id: o.weapon, uses: WEAPONS[o.weapon].uses } : null, startWpn: o.weapon || null,
      combo: 0, comboDmg: 0, jp: 0, airAtk: false, lowG: false, ex: 0, hist: [], dirC: "", hold: { LP: 0, HP: 0, LK: 0, HK: 0 }, prevH: {}, tap: { F: -9, B: -9 },
      stunT: 0, ctrl: {}, cpu: o.cpu ? { s: o.skill == null ? 0.5 : o.skill, t: 0.4, q: [], hold: null, holdT: 0, ai: o.ai || d.ai || "balanced" } : null, guard: false, takeMul: o.takeMul || 1, pend: null,
      look: { wear: 0, sq: 0, sqA: 0, recoil: 0, sweat: 0 }, stateT: 0, lastSt: "intro", mirror: !!o.mirror };
  }
  function create(o) {
    var m = { mode: o.mode || "versus", seed: o.seed || 1, rng: rng(o.seed || 1), t: 0, round: 1, phase: "intro", pt: 0, time: o.roundTime || PHYS.roundTime, roundTime: o.roundTime || PHYS.roundTime, need: o.rounds || 2, hazards: o.hazards !== false,
      f: [fighter(o.p1, 0, o.p1o), fighter(o.p2, 1, o.p2o)], proj: [], drops: [], traps: [], items: [], ev: [], weapons: !!o.weapons, itemT: 8,
      finale: o.finale !== false && o.mode !== "training", winner: -1, result: null, training: o.mode === "training", said: {}, fin: null, rounds: [] };
    if (m.training) { m.phase = "fight"; m.f.forEach(function (f) { f.st = "idle"; }); m.time = Infinity; }
    else emit(m, { type: "round", n: 1 });
    return m;
  }
  function emit(m, e) { m.ev.push(e); }
  function setSt(f, st) { if (f.st !== st) { f.st = st; f.t = 0; f.stateT = 0; } }
  var FREE = { idle: 1, walk: 1, crouch: 1, block: 1, run: 1 };
  var BUSY_OK = { idle: 1, walk: 1, crouch: 1, block: 1, run: 1, air: 1, attack: 1, special: 1, hitstun: 1, blockstun: 1, juggle: 1, knockdown: 1, getup: 1,
    backdash: 1, throw: 1, held: 1, dizzy: 1, ko: 1, win: 1, lose: 1, intro: 1, finisher: 1, victim: 1 };
  function isFree(f) { return !!FREE[f.st]; }
  function height(f) { return f.y > 0.05 ? PHYS.airH : f.crouch || f.st === "crouch" ? PHYS.crouchH : PHYS.standH; }

  function resetRound(m) {
    m.round++; m.phase = "intro"; m.pt = 0; m.time = m.roundTime || PHYS.roundTime; m.proj = []; m.drops = []; m.traps = []; m.said = {}; m.fin = null; m.winner = -1;
    m.f.forEach(function (f, i) {
      f.x = i ? 7.6 : 4.4; f.y = 0; f.vx = f.vy = 0; f.face = i ? -1 : 1; f.hp = f.ghost = PHYS.hp; setSt(f, "intro"); f.mv = null; f.buf = {}; f.orbit = 0; f.dot = null;
      f.combo = 0; f.jp = 0; f.inv = 0; f.ex = 0; f.crouch = false; f.lowG = false; f.look.wear *= 0.7;
      if (f.cpu) { f.cpu.q = []; f.cpu.hold = null; f.cpu.t = 0.4; }
    });
    emit(m, { type: "round", n: m.round });
  }

  /* ---------- input: direction history (relative to facing), double taps, holds ---------- */
  function readCtrl(m, f, c, dt) {
    var l = !!c.l, r = !!c.r;
    if (f.buf.scramble > 0) { var t = l; l = r; r = t; }
    var fw = f.face > 0 ? r : l, bk = f.face > 0 ? l : r;
    var code = (c.d ? "D" : "") + (c.u ? "U" : "") + (fw ? "F" : "") + (bk ? "B" : "");
    var dblF = false, dblB = false;
    if (code !== f.dirC) {
      if (code.indexOf("F") >= 0 && f.dirC.indexOf("F") < 0) { if (m.t - f.tap.F < 0.26) dblF = true; f.tap.F = m.t; }
      if (code.indexOf("B") >= 0 && f.dirC.indexOf("B") < 0) { if (m.t - f.tap.B < 0.26) dblB = true; f.tap.B = m.t; }
      f.dirC = code; f.hist.push({ c: code, t: m.t }); if (f.hist.length > 20) f.hist.shift();
    }
    var h = c.h || {}, p = c.p || {}, P = {}, R = {};
    BTN.forEach(function (b) {
      P[b] = !!p[b] || (!!h[b] && !f.prevH[b]);
      if (h[b]) f.hold[b] += dt; else { if (f.prevH[b] && f.hold[b] > 0) R[b] = f.hold[b]; f.hold[b] = 0; }
      f.prevH[b] = !!h[b];
    });
    var sp = !!(c.p && c.p.SP) || (!!c.sp && !f.prevH.SP); f.prevH.SP = !!c.sp;
    var k = { fw: fw, bk: bk, u: !!c.u, d: !!c.d, blk: !!c.blk, P: P, R: R, sp: sp, dash: !!c.dash, dblF: dblF || !!c.dblF, dblB: dblB || !!c.dblB, spec: c.spec, ex: !!c.ex, fin: !!c.fin, sup: !!c.sup };
    f.ctrl = k; return k;
  }
  // Does the direction history end with this token sequence (diagonals count for both parts), within the time window?
  function seqMatch(m, f, toks, win) {
    win = win || 0.6; var k = toks.length - 1, gap = false, h = f.hist;
    if (k < 0) return true;
    for (var i = h.length - 1; i >= 0 && k >= 0; i--) {
      var e = h[i]; if (m.t - e.t > win) break;
      var has = e.c.indexOf(toks[k]) >= 0;
      if (has && (k === toks.length - 1 || toks[k] !== toks[k + 1] || gap)) { k--; gap = false; }
      else if (k < toks.length - 1 && e.c.indexOf(toks[k + 1]) < 0) gap = true;
    }
    return k < 0;
  }

  /* ---------- starting moves ---------- */
  function moveFor(f, id) {
    if (id === "hp" && f.wpn) { var w = WEAPONS[f.wpn.id]; return { id: "wpn", name: w.name, st: w.st, act: w.act, rec: w.rec, dmg: w.dmg, J: w.J, dt: w.dt, reach: 0.85 + w.reach, h: 1.35, hr: 0.5, lvl: "mid", hs: w.hs, bs: w.bs, kd: w.kd, weapon: true }; }
    var mv = NORMALS[id]; return Object.assign({ id: id }, mv);
  }
  function startMove(m, f, id, chainStep) {
    var mv = moveFor(f, id);
    f.mv = mv; f.kind = "normal"; f.hits = 0; f.lastHit = -9; f.conn = false; f.fired = false;
    if (!chainStep) f.chain = [];
    f.chain.push(id === "wpn" ? "hp" : mv.id === "wpn" ? "hp" : id);
    setSt(f, "attack"); f.t = 0; f.crouch = !!mv.crouch;
    if (mv.air) f.airAtk = true;
    // follow-through: step in just enough that friction (a = μg) stops you about 0.6 m from the rival, v = √(2μg·d)
    if (chainStep) { var o = m.f[1 - f.side], gap = Math.abs(o.x - f.x) - 0.6; if (gap > 0.05 && f.y <= 0) f.vx = f.face * Math.sqrt(2 * PHYS.mu * PHYS.g * gap); }
    emit(m, { type: "move", side: f.side, id: mv.id, name: mv.name });
  }
  function onScreen(m, f) { for (var i = 0; i < m.proj.length; i++) if (m.proj[i].side === f.side && !m.proj[i].sp.linger) return true; return false; }
  function startSpecial(m, f, sp, ex) {
    if (sp.kind === "proj" && !sp.super && !sp.linger && onScreen(m, f)) { emit(m, { type: "projbusy", side: f.side }); return false; } // one shot of yours on screen at a time
    if (ex) { if (f.meter >= PHYS.exCost) f.meter -= PHYS.exCost; else ex = false; }
    f.ex = 0;
    f.mv = sp; f.kind = "special"; f.spx = !!ex; f.hits = 0; f.lastHit = -9; f.conn = false; f.fired = false; f.chain = [];
    setSt(f, "special"); f.crouch = false;
    if (sp.inv) f.inv = Math.max(f.inv, sp.inv / FPS);
    emit(m, { type: "special", side: f.side, id: sp.id, name: sp.name, cap: sp.cap, idea: sp.idea, ex: !!ex, kind: sp.kind, art: sp.art });
  }
  function exMul(f) { return f.spx ? 1.35 : 1; }
  function chainNext(f, btn) {
    var next = f.chain.concat([BTN_MOVE[btn]]);
    for (var i = 0; i < CHAINS.length; i++) { var s = CHAINS[i].seq; if (next.length <= s.length && next.every(function (v, j) { return s[j] === v; })) return { id: BTN_MOVE[btn], chain: CHAINS[i], last: next.length === s.length }; }
    return null;
  }

  function tryActions(m, f, o, k) {
    var free = isFree(f), cancel = (f.st === "attack" && f.kind === "normal" && f.conn && f.t < (f.mv.st + f.mv.act + f.mv.rec * 0.6) / FPS);
    var anyP = k.P.LP || k.P.HP || k.P.LK || k.P.HK;
    // input buffer: a button pressed up to 6 frames before you are free again still comes out (no lost inputs at the end of a move)
    if (anyP && !free && !cancel) f.pend = { P: Object.assign({}, k.P), t: m.t };
    else if (!anyP && free && f.pend && m.t - f.pend.t <= 6 / FPS) { k.P = f.pend.P; anyP = true; f.pend = null; }
    else if (f.pend && m.t - f.pend.t > 6 / FPS) f.pend = null;
    // super: full meter, then ↓→↓→ + HK (or ★ + block, or the CPU's request)
    var sup = SUPERS[f.id];
    if (sup && f.meter >= SUPER_COST && (free || cancel) && m.phase === "fight" && (k.sup || (k.sp && k.blk) || (k.P.HK && seqMatch(m, f, ["D", "F", "D", "F"], 0.9)))) {
      f.meter = 0; f.pend = null; startSpecial(m, f, sup, false); emit(m, { type: "super", side: f.side, name: sup.name, cap: sup.cap, idea: sup.idea }); return true;
    }
    // FINALE: the winner may enter the finisher
    var dashing = (f.st === "backdash" && f.t < 0.2) || f.st === "run";
    if (m.phase === "finale" && m.winner === f.side && (free || dashing || f.st === "air")) {
      var fin = FINISHERS[f.id];
      if (k.fin || (k.sp && k.u) || (anyP && k.P[fin.in[fin.in.length - 1]] && seqMatch(m, f, fin.in.slice(0, -1), 1.4))) { startFinisher(m, f, o); return true; }
    }
    if (free || cancel || dashing) {
      var list = SPECIALS[f.id];
      if (k.spec != null && list[k.spec]) { startSpecial(m, f, list[k.spec], k.ex); return true; }
      // motion specials, longest first
      var sorted = list.filter(function (s) { return Array.isArray(s.in); }).sort(function (a, b) { return b.in.length - a.in.length; });
      for (var i = 0; i < sorted.length; i++) { var s = sorted[i], b = s.in[s.in.length - 1]; if (k.P[b] && seqMatch(m, f, s.in.slice(0, -1))) { startSpecial(m, f, s, f.ex > 0); return true; } }
      for (var j = 0; j < list.length; j++) { var hs = list[j]; if (!Array.isArray(hs.in) && k.R[hs.in.hold] >= hs.in.t) { startSpecial(m, f, hs, f.ex > 0); return true; } }
      if (k.sp) {
        var dir = k.fw ? "F" : k.bk ? "B" : k.d ? "D" : k.u ? "U" : "N";
        if (dir === "N") { if (f.meter >= PHYS.exCost) { f.ex = 1.5; emit(m, { type: "armed", side: f.side }); } else emit(m, { type: "nometer", side: f.side }); return false; }
        for (var q = 0; q < list.length; q++) if (list[q].sc === dir) { startSpecial(m, f, list[q], f.ex > 0); return true; }
      }
    }
    if (cancel && anyP) {
      var btn = k.P.HP ? "HP" : k.P.LP ? "LP" : k.P.HK ? "HK" : "LK", nx = chainNext(f, btn);
      if (nx) { startMove(m, f, nx.id, true); if (nx.last) emit(m, { type: "chain", side: f.side, name: nx.chain.name }); return true; }
    }
    if (f.st === "air" && !f.airAtk && anyP) { startMove(m, f, k.P.HP || k.P.LP ? "j_p" : "j_k"); return true; }
    if (!free) return false;
    if (anyP) {
      var d = Math.abs(o.x - f.x);
      if (k.P.LP && d < NORMALS.throw.reach && o.y <= 0.05 && o.inv <= 0 && !(o.thrownT > 0) && isFree(o) && o.st !== "block") { startThrow(m, f, o); return true; } // never on a rival in blockstun or holding block (that was an unblockable loop) // a throw no longer grabs a rival mid-attack, and cannot be repeated for 2.5 s
      if (k.d) { startMove(m, f, k.P.HP ? "upper" : k.P.LP ? "c_lp" : k.P.HK ? "c_hk" : "c_lk"); return true; }
      if (k.bk && k.P.LK) { startMove(m, f, "sweep"); return true; }
      startMove(m, f, k.P.HP ? "hp" : k.P.LP ? "lp" : k.P.HK ? "hk" : "lk"); return true;
    }
    return false;
  }
  function startThrow(m, f, o) {
    f.mv = moveFor(f, "throw"); f.kind = "throw"; setSt(f, "throw"); f.chain = [];
    o.mv = null; setSt(o, "held"); o.vx = o.vy = 0; o.heldBy = f.side; o.thrownT = 2.5;
    emit(m, { type: "throw", side: f.side });
  }
  function startFinisher(m, f, o) {
    m.phase = "finisher"; m.pt = 0; m.fin = { side: f.side, id: f.id, name: FINISHERS[f.id].name, text: FINISHERS[f.id].text, art: FINISHERS[f.id].art };
    setSt(f, "finisher"); setSt(o, "victim"); f.vx = o.vx = 0;
    var side = o.x >= f.x ? 1 : -1; o.x = clamp(f.x + side * 1.4, 0.5, PHYS.stageW - 0.5); if (Math.abs(o.x - f.x) < 1.2) f.x = clamp(o.x - side * 1.4, 0.5, PHYS.stageW - 0.5);
    emit(m, { type: "finisher", side: f.side, name: m.fin.name, text: m.fin.text, art: m.fin.art });
  }

  /* ---------- per-fighter update ---------- */
  function fighterStep(m, f, o, c, dt) {
    for (var b in f.buf) if (f.buf[b] > 0) f.buf[b] = Math.max(0, f.buf[b] - dt);
    if (f.buf.orbit <= 0) f.orbit = 0;
    var ts = f.buf.slow > 0 ? 0.5 : 1, ld = dt * ts;
    f.ld = ld; f.t += ld; f.stateT += dt; f.inv = Math.max(0, f.inv - ld); if (f.thrownT > 0) f.thrownT -= dt; if (f.ex > 0) f.ex = Math.max(0, f.ex - dt);
    f.ghost = Math.max(f.hp, f.ghost - 18 * dt * (f.ghost - f.hp > 20 ? 2 : 1) * (f.combo > 0 && f.st !== "idle" ? 0.15 : 1));
    var L = f.look; L.sq = Math.max(0, L.sq - dt * 4); L.recoil = Math.max(0, L.recoil - dt * 3); L.wear = Math.max(L.wear, 1 - f.hp / PHYS.hp);
    if (f.dot) { // half-life damage: remaining R(t) = D0·(½)^t; damage this step is the drop in R
      var r0 = f.dot.d0 * Math.pow(0.5, f.dot.t); f.dot.t += dt; var r1 = f.dot.d0 * Math.pow(0.5, f.dot.t), dd = r0 - r1;
      if (m.phase === "fight") { f.hp = Math.max(m.training ? 1 : 0, f.hp - (f.god ? 0 : dd)); f.dot.dealt += dd; }
      if (f.dot.t > 7) f.dot = null;
    }
    var k = readCtrl(m, f, c, dt);
    var active = m.phase === "fight" || (m.phase === "finale" && m.winner === f.side);
    if (active && f.st === "held" && f.stateT < 0.25 && k.P.LP && o.st === "throw" && !o.fired) { // throw tech: both fighters spring apart
      setSt(f, "idle"); f.heldBy = null; o.mv = null; setSt(o, "idle"); var dir = f.x >= o.x ? 1 : -1; f.vx = dir * 3.2; o.vx = -dir * 3.2; emit(m, { type: "tech", side: f.side, x: (f.x + o.x) / 2 }); }
    if (active) tryActions(m, f, o, k);
    if (active && isFree(f) && f.y <= 0) {
      var sp = f.d.speed * (f.buf.glide > 0 ? 1.3 : 1) * (f.buf.brake > 0 ? 0.45 : 1);
      if (f.st === "run") {
        if (!k.fw || f.t > 1.6 || k.blk || k.d) setSt(f, "idle"); else f.vx = f.face * PHYS.run * sp;
      }
      if (f.st !== "run") {
        if (k.u) { f.vy = PHYS.jumpV * f.d.jump; f.vx = (k.fw ? 1 : k.bk ? -1 : 0) * PHYS.jumpVX * f.face * f.d.speed; setSt(f, "air"); f.airAtk = false; f.crouch = false; f.y = 0.001; emit(m, { type: "jump", side: f.side }); }
        else if (k.dblB || (k.dash && k.bk && !k.fw)) { setSt(f, "backdash"); f.inv = 0.12; f.vx = -f.face * 4.2; emit(m, { type: "backdash", side: f.side }); }
        else if (k.dash || k.dblF) { setSt(f, "run"); emit(m, { type: "dash", side: f.side }); }
        else if (k.blk) { setSt(f, "block"); f.crouch = k.d; }
        else if (k.d) { setSt(f, "crouch"); f.crouch = true; }
        else if (k.fw || k.bk) { setSt(f, "walk"); f.crouch = false; f.vx = (k.fw ? PHYS.walk : -PHYS.walkBack) * f.face * sp; }
        else { setSt(f, "idle"); f.crouch = false; }
      }
    }
    // timed states
    var mv = f.mv;
    if ((f.st === "attack" || f.st === "throw") && !mv) setSt(f, f.y > 0.02 ? "air" : "idle");
    else if (f.st === "attack" || f.st === "throw") {
      if (f.st === "throw" && f.t >= 0.3 && !f.fired) {
        f.fired = true; if (o.st === "held") { o.heldBy = null; applyHit(m, f, o, hitOf(f, f.mv, f.face), { unblock: true }); }
      }
      if (f.t >= frames(mv)) { f.mv = null; f.chain = []; setSt(f, f.y > 0.02 ? "air" : f.ctrl.d ? "crouch" : "idle"); f.crouch = f.st === "crouch"; }
    } else if (f.st === "special") specialStep(m, f, o, ld);
    else if (f.st === "hitstun" || f.st === "blockstun") { if (f.t >= f.stunT) { setSt(f, f.crouch && f.ctrl.d ? "crouch" : "idle"); endCombo(m, f); } }
    else if (f.st === "backdash") { if (f.t > 0.2) f.vx *= 0.8; if (f.t >= 0.34) setSt(f, "idle"); }
    else if (f.st === "knockdown") { if (f.t >= 0.75) { setSt(f, "getup"); f.inv = 0.45; } }
    else if (f.st === "getup") { if (f.t >= 0.4) { setSt(f, "idle"); endCombo(m, f); } }
    else if (f.st === "held") { if (f.stateT > 1.2) setSt(f, "idle"); }
    // physics (in this fighter's own, possibly dilated, time)
    var selfProp = f.st === "walk" || f.st === "run" || (f.st === "backdash" && f.t < 0.2) || (f.st === "special" && f.mv && f.mv.kind === "rush" && f.fired && f.t < (f.mv.st + f.mv.act) / FPS);
    if (f.y > 0 || f.vy > 0) {
      f.vy -= PHYS.g * (f.lowG ? f.lowG : 1) * ld; f.y += f.vy * ld; f.x += f.vx * ld;
      if (f.y <= 0) land(m, f);
    } else {
      f.x += f.vx * ld;
      if (!selfProp) {
        var mu = (f.buf.glide > 0 ? PHYS.muGlide : PHYS.mu) * (f.buf.brake > 0 ? 3 : 1), dec = mu * PHYS.g * ld;
        f.vx = Math.abs(f.vx) <= dec ? 0 : f.vx - Math.sign(f.vx) * dec;
        if (isFree(f) && f.st !== "walk" && Math.abs(f.vx) < 0.5) f.vx = 0;
      }
    }
    if (f.st !== "air" && f.st !== "juggle" && f.y <= 0 && (isFree(f) || f.st === "getup") && Math.abs(o.x - f.x) > 0.05) f.face = o.x > f.x ? 1 : -1;
  }
  function land(m, f) {
    f.y = 0; var hard = f.vy < -4; f.vy = 0; f.lowG = false;
    if (f.st === "juggle") { setSt(f, "knockdown"); f.jp = 0; f.vx *= 0.5; f.mv = null; emit(m, { type: "land", side: f.side, hard: true, x: f.x }); if (f.wpn) dropWeapon(m, f); }
    else if (f.st === "air" || (f.st === "attack" && f.mv && f.mv.air)) { setSt(f, "idle"); f.mv = null; f.vx = 0; emit(m, { type: "land", side: f.side, hard: false, x: f.x }); }
    else if (f.st === "special") { f.vx *= 0.3; }
    else if (f.st === "victim" || f.st === "dizzy") f.vx = 0;
    if (hard) emit(m, { type: "dust", x: f.x });
  }
  function endCombo(m, f) { if (f.combo >= 2) emit(m, { type: "comboEnd", side: 1 - f.side, hits: f.combo, dmg: Math.round(f.comboDmg) }); f.combo = 0; f.comboDmg = 0; f.jp = 0; }

  function specialStep(m, f, o, ld) {
    var s = f.mv; if (!s) { setSt(f, f.y > 0.02 ? "air" : "idle"); return; }
    var x = exMul(f), t0 = s.st / FPS;
    if (!f.fired && f.t >= t0) {
      f.fired = true;
      if (s.kind === "proj") {
        var n = f.spx && !s.linger ? 2 : 1;
        for (var i = 0; i < n; i++) m.proj.push({ side: f.side, x: f.x + f.face * (0.55 + i * 0.6), y: f.y + s.h, y0: f.y + s.h, v: s.v * f.face * (f.spx ? 1.15 : 1), r: s.r * (f.spx ? 1.2 : 1), life: s.life, t: 0, sp: s, ex: f.spx, art: s.art, phase: !!s.phase, hit: false });
        emit(m, { type: "proj", side: f.side, art: s.art });
      } else if (s.kind === "field") {
        var d = Math.abs(o.x - f.x);
        if (d <= s.range && o.inv <= 0 && o.st !== "knockdown") {
          if (s.effect === "slow") { o.buf.slow = s.dur * x; emit(m, { type: "field", side: f.side, effect: "slow", dur: s.dur * x }); }
          else if (s.effect === "brake") { o.buf.brake = s.dur * x; emit(m, { type: "field", side: f.side, effect: "brake", dur: s.dur * x }); }
          else if (s.effect === "scramble") { o.buf.scramble = s.dur * x; emit(m, { type: "field", side: f.side, effect: "scramble", dur: s.dur * x }); }
          else if (s.effect === "drain") { var a = Math.min(o.meter, s.amount * x); o.meter -= a; f.meter = Math.min(100, f.meter + a); emit(m, { type: "field", side: f.side, effect: "drain", amount: Math.round(a) }); }
          else if (s.effect === "pull") { applyHit(m, f, o, { dmg: s.dmg * x, J: s.J * x, ang: 8, dt: 0.05, lvl: "mid", hs: 18, bs: 10, label: s.name, dir: -f.face, field: true }, { unblock: false }); }
        } else emit(m, { type: "whiff", side: f.side, name: s.name });
      } else if (s.kind === "shield" || s.kind === "buff") {
        var dur = s.dur * x;
        if (s.effect === "orbit") { f.orbit = s.charges + (f.spx ? 1 : 0); f.buf.orbit = dur; }
        else f.buf[s.effect] = dur;
        emit(m, { type: "shield", side: f.side, effect: s.effect, dur: dur });
      } else if (s.kind === "drop") {
        m.drops.push({ side: f.side, x: o.x + o.vx * 0.5, y: s.drop, vy: 0, sp: s, ex: f.spx, art: s.art, t: 0 });
        emit(m, { type: "drop", side: f.side, x: o.x, h: s.drop });
      } else if (s.kind === "trap") {
        m.traps.push({ side: f.side, x: clamp(f.x + f.face * s.dist, 0.5, PHYS.stageW - 0.5), life: s.life, sp: s, ex: f.spx, t: 0 });
      } else if (s.kind === "aura") { f.buf.aura = s.dur * x; f.auraT = 0; }
      else if (s.kind === "tele") {
        var nx;
        if (s.to === "behind") nx = o.x - o.face * 0.8;
        else if (s.to === "back") nx = f.x - f.face * 2.2;
        else nx = 1 + m.rng() * (PHYS.stageW - 2);
        f.x = clamp(nx, 0.5, PHYS.stageW - 0.5); f.y = 0; f.vy = 0; f.face = o.x > f.x ? 1 : -1;
        emit(m, { type: "tele", side: f.side, x: f.x });
      } else if (s.kind === "rise") { f.vy = s.vy; f.vx = s.vx * f.face; f.y = 0.001; }
      else if (s.kind === "rush") { f.vx = s.v * f.face * f.d.speed; if (s.armor) f.buf.armor = s.act / FPS; if (s.glide) f.buf.glide = (s.act + s.rec) / FPS; }
      else if (s.kind === "hop") { f.vy = s.vy; f.vx = s.vx * f.face; f.lowG = s.gScale; f.y = 0.001; f.mv = null; setSt(f, "air"); f.airAtk = false; return; }
    }
    if (s.kind === "rush" && f.fired && f.t < (s.st + s.act) / FPS) f.vx = s.v * f.face * f.d.speed * (f.buf.slow > 0 ? 1 : 1);
    if (s.kind === "rush" && s.through) { /* passes through: separation is skipped for this fighter */ }
    if (f.t >= frames(s)) { f.mv = null; setSt(f, f.y > 0.02 ? "air" : "idle"); f.airAtk = true; }
  }

  /* ---------- hits ---------- */
  function hitOf(f, mv, dir) {
    var x = f.kind === "special" ? exMul(f) : 1;
    return { dmg: mv.dmg * f.d.power * x, J: mv.J * x, ang: mv.ang || 0, dt: mv.dt || 0.01, lvl: mv.lvl, hs: mv.hs, bs: mv.bs, kd: !!mv.kd, launch: !!mv.launch, label: mv.name, dir: dir, weapon: !!mv.weapon, special: f.kind === "special" };
  }
  function meleeActive(f) {
    var mv = f.mv; if (!mv) return false;
    if (f.st === "attack") return f.kind === "normal" && f.t >= mv.st / FPS && f.t < (mv.st + mv.act) / FPS;
    if (f.st === "special") return (mv.kind === "rush" || mv.kind === "strike" || mv.kind === "rise" || mv.kind === "beam") && f.t >= mv.st / FPS && f.t < (mv.st + mv.act) / FPS;
    return false;
  }
  function inBox(f, o, mv) {
    if (o.inv > 0 || o.st === "knockdown" || o.st === "getup" || o.st === "held" || o.st === "victim" || o.st === "ko" || (o.st === "juggle" && o.jugInv)) return false;
    var dx = (o.x - f.x) * f.face, reach = (mv.reach || 0.8) + PHYS.half;
    if (mv.both) { if (Math.abs(o.x - f.x) > reach) return false; }
    else if (dx < -0.25 || dx > reach) return false;
    var hy = f.y + (mv.h || 1), hr = mv.hr || 0.35, top = o.y + height(o);
    return hy + hr >= o.y && hy - hr < top;
  }
  function blocks(m, def, hv) {
    if (hv.lvl === "throw" || hv.unblock) return false;
    if (def.y > 0.02) return false;
    var stance = def.st === "block" || def.st === "blockstun" || (isFree(def) && def.ctrl.blk);
    if (def.guard && (isFree(def) || def.st === "blockstun" || def.st === "block")) { stance = true; def.crouch = hv.lvl === "low"; }
    if (!stance) return false;
    if (hv.dir !== -def.face && !hv.field) return false; // must come from the front
    if (hv.lvl === "low" && !def.crouch) return false;
    if (hv.lvl === "overhead" && def.crouch) return false;
    return true;
  }
  function applyHit(m, att, def, hv, o) {
    o = o || {};
    if (m.phase === "finale" && def.st === "dizzy") { // a plain hit on the dizzy loser ends the FINALE as a normal K.O.
      def.hp = 0; setSt(def, "juggle"); def.vy = 3; def.vx = hv.dir * 3; m.phase = "ko"; m.pt = 0; m.fin = null; finishRound(m, att.side, "ko");
      emit(m, { type: "hit", att: att.side, def: def.side, dmg: 0, J: hv.J, dt: hv.dt, F: hv.J / hv.dt, m: def.m, dv: hv.J / def.m, label: hv.label, blocked: false, combo: 1, x: def.x, y: def.y + 1.2, heavy: true, ko: true });
      return "hit";
    }
    if (def.buf.reflect > 0 && !o.unblock && hv.lvl !== "throw") { // third-law reversal: equal and opposite impulse back on the attacker
      if (!o.proj) { att.vx += -hv.dir * hv.J / att.m; att.mv = null; att.chain = []; if (att.y <= 0) { setSt(att, "hitstun"); att.stunT = 0.35; } else { setSt(att, "juggle"); att.vy = Math.max(att.vy, 1.5); } }
      emit(m, { type: "counter", side: def.side, J: hv.J, dv: hv.J / att.m, x: def.x }); return "counter";
    }
    if (def.orbit > 0 && hv.lvl !== "throw") { def.orbit--; emit(m, { type: "absorb", side: def.side, x: def.x, left: def.orbit }); att.vx -= hv.dir * 1; return "absorb"; }
    var blocked = !o.unblock && blocks(m, def, hv);
    var J = hv.J, dt = blocked ? hv.dt * PHYS.blockDt : hv.dt, F = J / dt;
    var scale = 1; if (!blocked) { def.combo = (def.st === "hitstun" || def.st === "juggle") ? def.combo + 1 : 1; scale = Math.max(0.35, 1 - 0.1 * (def.combo - 1)); }
    var dmg = blocked ? hv.dmg * (hv.dt / dt) : hv.dmg * scale; if (def.god) dmg = 0; else if (att.oneHit && !blocked) dmg = 9999; // damage ∝ peak force; block stretches Δt so damage drops to ¼
    if (def.buf.cage > 0) dmg *= 0.5;
    if (def.takeMul !== 1 && !def.god && !(att.oneHit && !blocked)) dmg *= def.takeMul; // handicap
    var armored = def.buf.armor > 0 && !blocked;
    if (armored) dmg *= 0.6;
    if (blocked && def.hp - dmg < 1) dmg = Math.max(0, def.hp - 1); // chip never K.O.s
    if (m.training) dmg = Math.min(dmg, Math.max(0, def.hp - 1));
    def.hp = Math.max(0, def.hp - dmg);
    var dv = J / def.m, a = (hv.ang || 0) * Math.PI / 180, dvx = Math.min(9, dv * Math.cos(a)), dvy = dv * Math.sin(a);
    if (!armored) def.vx = (blocked ? def.vx * 0.3 : def.vx * 0.2) + hv.dir * dvx;
    // the wall pushes back: a fighter pinned in the corner returns the impulse to the attacker (third law)
    if (!blocked || true) { var wall = (hv.dir < 0 && def.x < 1.0) || (hv.dir > 0 && def.x > PHYS.stageW - 1.0); if (wall && att.y <= 0 && !o.proj) att.vx -= hv.dir * Math.min(3, dvx * 0.6); }
    if (!armored) { def.mv = null; def.chain = []; def.kind = null; }
    if (blocked) { setSt(def, "blockstun"); def.stunT = (hv.bs || 10) / FPS; }
    else if (armored) { emit(m, { type: "armor", side: def.side }); }
    else {
      def.comboDmg += dmg; def.mv = null;
      if (def.y > 0.02 || hv.launch || hv.kd || def.st === "juggle") {
        def.jp += 1; setSt(def, "juggle"); def.jugInv = def.jp >= 4; def.crouch = false; def.lowG = false;
        def.vy = Math.max(def.y > 0.02 ? 2.4 : 0, dvy, hv.kd && !hv.launch ? 2.6 : 0); if (def.y <= 0) def.y = 0.001;
        if (hv.ang < 0 && def.y > 0.02) def.vy = Math.min(def.vy, -1);
      } else { setSt(def, "hitstun"); def.stunT = (hv.hs || 16) / FPS; }
      if (def.wpn && (hv.kd || hv.launch)) dropWeapon(m, def);
    }
    if (!blocked && def.ex > 0) def.ex = 0;
    att.conn = true; att.hits++;
    att.meter = Math.min(100, att.meter + (blocked ? dmg * 0.5 : dmg * 1.2)); def.meter = Math.min(100, def.meter + dmg * 0.8);
    def.look.sq = 1; def.look.sqA = Math.min(1, 0.35 + dmg / 14); def.look.recoil = 1; def.look.wear = Math.max(def.look.wear, 1 - def.hp / PHYS.hp);
    if (att.wpn && hv.weapon && !blocked) { att.wpn.uses--; if (att.wpn.uses <= 0) { emit(m, { type: "wbreak", side: att.side, id: att.wpn.id }); att.wpn = null; } }
    emit(m, { type: blocked ? "block" : "hit", att: att.side, def: def.side, dmg: dmg, J: J, dt: dt, F: F, m: def.m, dv: dv, label: hv.label, blocked: blocked, combo: blocked ? 0 : def.combo, x: def.x, y: def.y + (hv.lvl === "low" ? 0.3 : 1.3),
      heavy: !blocked && (dmg >= 9 || hv.kd || hv.launch), armored: armored, lvl: hv.lvl, proj: !!o.proj, special: !!hv.special, chip: blocked });
    return blocked ? "block" : "hit";
  }
  function dropWeapon(m, f) { m.items.push({ id: f.wpn.id, uses: f.wpn.uses, x: f.x, y: 1.2, vx: -f.face * 1.5, vy: 3, t: 0 }); emit(m, { type: "wdrop", side: f.side, id: f.wpn.id }); f.wpn = null; }

  function resolveMelee(m) {
    var A = m.f[0], B = m.f[1], pending = [];
    [A, B].forEach(function (f) {
      var o = m.f[1 - f.side], mv = f.mv;
      if (!meleeActive(f)) return;
      var n = mv.n || 1, gap = (mv.act / FPS) / n;
      if (f.hits >= n || m.t - f.lastHit < gap * 0.95) return;
      if (!inBox(f, o, mv)) return;
      var dir = mv.both ? (o.x >= f.x ? 1 : -1) : f.face;
      pending.push([f, o, hitOf(f, mv, dir)]);
    });
    pending.forEach(function (p) { p[0].lastHit = m.t; applyHit(m, p[0], p[1], p[2]); });
  }

  function stepObjects(m, dt) {
    // projectiles
    for (var i = m.proj.length - 1; i >= 0; i--) {
      var q = m.proj[i], o = m.f[1 - q.side], s = q.sp; q.t += dt; q.life -= dt;
      var mul = 1; if (q.art === "ac") mul = 0.55 + 0.9 * Math.max(0, Math.sin(q.t * 2 * Math.PI * (s.wave || 1.5)));
      q.x += q.v * dt * mul;
      if (s.rise) q.y += s.rise * dt; if (s.wobble) q.y = q.y0 + Math.sin(q.t * 5) * s.wobble;
      var dead = q.life <= 0 || q.x < -0.5 || q.x > PHYS.stageW + 0.5;
      // projectile vs projectile
      for (var j = 0; j < m.proj.length && !dead; j++) { var p = m.proj[j]; if (p !== q && p.side !== q.side && !p.dead && Math.abs(p.x - q.x) < p.r + q.r && Math.abs(p.y - q.y) < 0.6) { if (!q.phase && !p.phase) { p.dead = true; dead = true; emit(m, { type: "clash", x: q.x, y: q.y }); } } }
      if (!dead && !q.hitT && Math.abs(q.x - o.x) < q.r + PHYS.half && q.y + q.r > o.y && q.y - q.r < o.y + height(o) && o.inv <= 0 && !(o.st === "special" && o.mv && o.mv.projInv) && o.st !== "knockdown" && o.st !== "getup" && o.st !== "victim" && o.st !== "ko" && !(o.st === "juggle" && o.jugInv)) {
        if (o.buf.cage > 0) { dead = true; emit(m, { type: "absorb", side: o.side, x: o.x, cage: true }); }
        else if (o.buf.reflect > 0) { q.v = -q.v; q.side = o.side; q.life = Math.max(q.life, 1); emit(m, { type: "reflect", side: o.side, x: q.x }); }
        else {
          var att = m.f[q.side], x = q.ex ? 1.35 : 1, hv = { dmg: s.dmg * att.d.power * x, J: s.J * x, ang: s.ang || 0, dt: s.dt || 0.01, lvl: s.lvl, hs: s.hs, bs: s.bs, kd: !!s.kd && !!q.ex, label: s.name, dir: q.v > 0 ? 1 : -1, special: true };
          var res = applyHit(m, att, o, hv, { proj: true });
          if (s.dot && res === "hit") { o.dot = { d0: s.dot * x + (o.dot ? o.dot.d0 * Math.pow(0.5, o.dot.t) : 0), t: 0, dealt: 0 }; emit(m, { type: "dot", side: o.side, d0: o.dot.d0 }); }
          if (s.linger) q.hitT = true; else dead = true;
        }
      }
      if (dead) { q.dead = true; m.proj.splice(i, 1); }
    }
    m.proj = m.proj.filter(function (p) { return !p.dead; });
    // drops (free fall from rest: v = g t, lands at v = √(2gh))
    for (var d = m.drops.length - 1; d >= 0; d--) {
      var r = m.drops[d], ov = m.f[1 - r.side]; r.t += dt; r.vy -= PHYS.g * dt; r.y += r.vy * dt;
      if (!r.hit && Math.abs(r.x - ov.x) < 0.55 && r.y < ov.y + height(ov) && r.y > ov.y && ov.inv <= 0 && ov.st !== "knockdown" && ov.st !== "victim") {
        r.hit = true; var at = m.f[r.side], xx = r.ex ? 1.35 : 1;
        applyHit(m, at, ov, { dmg: r.sp.dmg * at.d.power * xx, J: r.sp.J * xx, ang: -60, dt: 0.01, lvl: "overhead", hs: r.sp.hs, bs: 12, label: r.sp.name, dir: ov.face * -1, special: true }, { proj: true });
        emit(m, { type: "bonk", x: r.x, y: r.y, v: Math.abs(r.vy) });
      }
      if (r.y <= 0) { emit(m, { type: "thud", x: r.x, v: Math.abs(r.vy) }); m.drops.splice(d, 1); }
    }
    // traps
    for (var k = m.traps.length - 1; k >= 0; k--) {
      var tr = m.traps[k], ot = m.f[1 - tr.side]; tr.life -= dt; tr.t += dt;
      if (tr.t > 0.3 && ot.y <= 0.05 && Math.abs(ot.x - tr.x) < 0.45 && ot.inv <= 0 && ot.st !== "knockdown" && ot.st !== "getup") {
        var ta = m.f[tr.side], tx = tr.ex ? 1.35 : 1;
        applyHit(m, ta, ot, { dmg: tr.sp.dmg * ta.d.power * tx, J: tr.sp.J * tx, ang: 50, dt: 0.01, lvl: "low", hs: tr.sp.hs, bs: 12, label: tr.sp.name, dir: ot.x > tr.x ? 1 : -1, special: true, launch: true }, { proj: true });
        m.traps.splice(k, 1); continue;
      }
      if (tr.life <= 0) m.traps.splice(k, 1);
    }
    // auras
    m.f.forEach(function (f) {
      if (f.buf.aura > 0) {
        f.auraT = (f.auraT || 0) + dt; var sp = SPECIALS[f.id].filter(function (s) { return s.kind === "aura"; })[0], o = m.f[1 - f.side];
        if (sp && f.auraT >= sp.tick) { f.auraT = 0; if (Math.abs(o.x - f.x) < sp.reach + PHYS.half && Math.abs(o.y - f.y) < 1.5 && o.inv <= 0 && o.st !== "knockdown" && o.st !== "getup" && o.st !== "victim")
          applyHit(m, f, o, { dmg: sp.dmg * f.d.power, J: sp.J, ang: 0, dt: 0.01, lvl: "mid", hs: sp.hs, bs: 8, label: sp.name, dir: o.x > f.x ? 1 : -1, special: true }, { proj: true }); }
      }
    });
    // weapon pickups: fall, rest, picked up by walking over them
    if (m.weapons && !m.training && m.phase === "fight") {
      m.itemT -= dt;
      if (m.itemT <= 0) { m.itemT = 12 + m.rng() * 10; if (m.items.length < 1 && !m.f[0].wpn && !m.f[1].wpn) { var ids = Object.keys(WEAPONS), id = ids[Math.floor(m.rng() * ids.length)]; m.items.push({ id: id, uses: WEAPONS[id].uses, x: 1.5 + m.rng() * (PHYS.stageW - 3), y: 4.5, vx: 0, vy: 0, t: 0 }); emit(m, { type: "wspawn", id: id }); } }
    }
    for (var w = m.items.length - 1; w >= 0; w--) {
      var it = m.items[w]; it.t += dt;
      if (it.y > 0) { it.vy -= PHYS.g * dt; it.y += it.vy * dt; it.x = clamp(it.x + it.vx * dt, 0.4, PHYS.stageW - 0.4); if (it.y <= 0) { it.y = 0; it.vy = 0; it.vx = 0; emit(m, { type: "clink", x: it.x }); } }
      else {
        for (var fi = 0; fi < 2; fi++) { var ff = m.f[fi]; if (!ff.wpn && isFree(ff) && ff.y <= 0 && Math.abs(ff.x - it.x) < 0.45 && it.t > 0.6) { ff.wpn = { id: it.id, uses: it.uses }; m.items.splice(w, 1); emit(m, { type: "pickup", side: fi, id: it.id, name: WEAPONS[it.id].name, idea: WEAPONS[it.id].idea }); break; } }
      }
      if (it.t > 25 && m.items[w] === it) m.items.splice(w, 1);
    }
  }

  function separate(m) {
    var a = m.f[0], b = m.f[1], W = PHYS.stageW;
    var through = function (f) { return f.st === "special" && f.mv && f.mv.through && f.t < (f.mv.st + f.mv.act) / FPS; };
    var skip = a.st === "held" || b.st === "held" || through(a) || through(b) || a.st === "knockdown" || b.st === "knockdown";
    var dx = b.x - a.x, dy = Math.abs(a.y - b.y);
    if (!skip && Math.abs(dx) < 0.6 && dy < 1.3) {
      var push = (0.6 - Math.abs(dx)) / 2, s = dx >= 0 ? 1 : -1; if (dx === 0) s = a.face;
      a.x -= push * s; b.x += push * s;
    }
    var held = a.st === "held" ? a : b.st === "held" ? b : null;
    if (held) { var gr = m.f[1 - held.side]; held.x = gr.x + gr.face * 0.55; held.y = 0; }
    [a, b].forEach(function (f) { if (f.x < 0.4) { f.x = 0.4; if (f.vx < 0) f.vx = 0; } if (f.x > W - 0.4) { f.x = W - 0.4; if (f.vx > 0) f.vx = 0; } });
    var sep = b.x - a.x;
    if (Math.abs(sep) > PHYS.maxSep) { var c = (a.x + b.x) / 2, h = PHYS.maxSep / 2 * Math.sign(sep); a.x = c - h; b.x = c + h; }
  }

  /* ---------- round flow ---------- */
  function forceRound(m, w) { if (m.phase !== "fight") return false; m.f[1 - w].hp = 0; finishRound(m, w, "ko"); return true; } // cheat hook: end the round now
  function finishRound(m, w, how) {
    m.roundWinner = w; m.how = how; m.pt = 0; m.phase = "ko";
    var loser = w >= 0 ? m.f[1 - w] : null;
    if (w >= 0) { m.f[w].wins++; }
    m.f.forEach(function (f) { f.buf.slow = 0; });
    m.rounds.push({ n: m.round, winner: w, how: how });
    emit(m, { type: how === "time" ? "timeup" : how === "draw" ? "draw" : how === "finisher" ? "finisherKO" : "ko", winner: w, loser: loser ? loser.side : -1 });
  }
  function matchDecided(m) { var n = m.need || 2; return m.f[0].wins >= n || m.f[1].wins >= n || m.round >= 2 * n; } // best of 1, 3 or 5 rounds

  function step(m, ctrls, dt) {
    dt = dt || 1 / 120; m.t += dt; m.pt += dt;
    if (m.phase === "over") return m;
    var A = m.f[0], B = m.f[1];
    if (m.phase === "intro") {
      if (!m.said.fight && m.pt >= 1.2) { m.said.fight = true; emit(m, { type: "fight" }); }
      if (m.pt >= 1.7) { m.phase = "fight"; m.pt = 0; setSt(A, "idle"); setSt(B, "idle"); }
    }
    var c0 = A.cpu ? cpuCtrl(m, A, dt) : (ctrls[0] || {}), c1 = B.cpu ? cpuCtrl(m, B, dt) : (ctrls[1] || {});
    if (m.training && DUMMY[m.dummy]) c1 = dummyCtrl(m, B, dt);
    B.guard = m.training && m.dummy === "guard";
    fighterStep(m, A, B, c0, dt); fighterStep(m, B, A, c1, dt);
    if (m.phase === "fight" || m.phase === "finale") resolveMelee(m);
    stepObjects(m, dt);
    separate(m);
    if (m.phase === "fight" && !m.training) {
      m.time -= dt;
      var ka = A.hp <= 0, kb = B.hp <= 0;
      if (ka && kb) finishRound(m, -1, "draw");
      else if (ka || kb) {
        var w = ka ? 1 : 0, win = m.f[w], lose = m.f[1 - w];
        if (m.finale && win.wins + 1 >= 2) { // match-deciding K.O.: the loser is dizzy and the FINALE! window opens
          m.phase = "finale"; m.pt = 0; m.winner = w; lose.hp = 0; lose.mv = null; lose.vx = 0; lose.dot = null;
          if (lose.y > 0.02) { lose.vy = Math.min(lose.vy, 0); }
          setSt(lose, "dizzy"); lose.inv = 0; win.buf.slow = 0;
          if (win.st === "hitstun" || win.st === "blockstun" || win.st === "juggle") setSt(win, win.y > 0.02 ? "air" : "idle");
          emit(m, { type: "finale", winner: w, input: FINISHERS[win.id].in });
        } else { finishRound(m, w, "ko"); setSt(lose, "juggle"); if (lose.y <= 0) { lose.y = 0.001; lose.vy = Math.max(lose.vy, 2.5); } lose.jugInv = true; }
      } else if (m.time <= 0) {
        m.time = 0;
        if (Math.abs(A.hp - B.hp) < 0.5) finishRound(m, -1, "time");
        else finishRound(m, A.hp > B.hp ? 0 : 1, "time");
      }
    } else if (m.phase === "finale") {
      var L = m.f[1 - m.winner]; if (L.y <= 0 && L.st !== "dizzy") { setSt(L, "dizzy"); }
      if (m.pt >= PHYS.finaleT) { finishRound(m, m.winner, "ko"); setSt(L, "juggle"); L.y = 0.001; L.vy = 1.5; L.jugInv = true; }
    } else if (m.phase === "finisher") {
      var vic = m.f[1 - m.fin.side], wv = m.f[m.fin.side];
      if (m.fin.art === "flick" && m.pt > 0.4) { var dir = vic.x >= wv.x ? 1 : -1, end = dir > 0 ? PHYS.stageW - 0.8 : 0.8; if ((end - vic.x) * dir > 0) vic.x += dir * Math.min(4.5 * dt, Math.abs(end - vic.x)); } // μ ≈ 0: no friction, constant speed
      if (m.pt >= PHYS.finisherT) { var wn = m.fin.side; finishRound(m, wn, "finisher"); setSt(m.f[1 - wn], "ko"); }
    } else if (m.phase === "ko") {
      m.f.forEach(function (f) {
        if (f.side === m.roundWinner && m.pt > 0.9 && f.y <= 0 && f.st !== "win") { setSt(f, "win"); f.mv = null; }
        if (f.side !== m.roundWinner && m.roundWinner >= 0 && f.st === "knockdown") { setSt(f, "ko"); }
        if (m.roundWinner < 0 && m.how === "time" && f.y <= 0 && f.st !== "lose") setSt(f, "lose");
        if (m.roundWinner < 0 && m.how === "draw" && f.st === "knockdown") setSt(f, "ko");
      });
      if (m.roundWinner >= 0 && m.how === "time") { var lz = m.f[1 - m.roundWinner]; if (lz.y <= 0 && lz.st !== "lose") setSt(lz, "lose"); }
      if (m.pt >= 3.0) {
        if (matchDecided(m)) {
          m.phase = "over"; var a = A.wins, b = B.wins;
          m.winner = a === b ? -1 : a > b ? 0 : 1; m.result = m.winner;
          emit(m, { type: "over", winner: m.winner });
        } else resetRound(m);
      }
    }
    if (m.training) m.f.forEach(function (f) { if (f.hp < PHYS.hp && isFree(f) && f.stateT > 1.2) { f.hp = PHYS.hp; f.ghost = PHYS.hp; } if (f.meter < 100 && m.trainMeter) f.meter = 100; });
    m.f.forEach(function (f) {
      if (!BUSY_OK[f.st]) throw new Error("unknown state " + f.st);
      if (f.st !== f.lastSt) { f.lastSt = f.st; }
    });
    return m;
  }

  /* ---------- training dummy ---------- */
  var DUMMY = { stand: 1, crouch: 1, jump: 1, guard: 1 };
  function dummyCtrl(m, f, dt) {
    var c = { h: {}, p: {} }, mode = m.dummy;
    if (mode === "crouch") c.d = true;
    else if (mode === "jump") { if (f.y <= 0 && isFree(f) && f.stateT > 0.5) c.u = true; }
    return c;
  }

  /* ---------- CPU: reaction delay, read-the-attack blocking, anti-air, spacing, strings, specials, finishers ---------- */
  function threat(m, f, o) {
    if ((o.st === "attack" || o.st === "special") && o.mv && (o.mv.reach || o.mv.kind === "proj" || o.mv.kind === "beam")) {
      var mv = o.mv, end = (mv.st + mv.act) / FPS, d = Math.abs(o.x - f.x), reach = (mv.reach || 0.8) + 0.8;
      if (o.t < end && (d < reach || mv.kind === "beam") && (o.face * (f.x - o.x) > 0 || mv.both)) return { lvl: mv.lvl || "mid" };
    }
    for (var i = 0; i < m.proj.length; i++) { var q = m.proj[i]; if (q.side !== f.side && (f.x - q.x) * Math.sign(q.v) > 0 && Math.abs(f.x - q.x) < 2.8) return { lvl: q.sp.lvl || "mid", proj: q }; }
    for (var j = 0; j < m.drops.length; j++) if (m.drops[j].side !== f.side && Math.abs(m.drops[j].x - f.x) < 0.8) return { lvl: "overhead", drop: true };
    return null;
  }
  var CUR_R = null; // the CPU picks among every special that fits, not always the first one
  function findSpec(f, pred) { var l = SPECIALS[f.id], c = []; for (var i = 0; i < l.length; i++) if (pred(l[i])) c.push(i); if (!c.length) return -1; return CUR_R ? c[Math.floor(CUR_R() * c.length)] : c[0]; }
  function cpuCtrl(m, f, dt) {
    var b = f.cpu, o = m.f[1 - f.side], s = b.s, r = m.rng, c = { h: {}, p: {} }, ai = b.ai || "balanced"; CUR_R = r;
    var abs = function (rel, val) { if (rel === "fw") c[f.face > 0 ? "r" : "l"] = val; else if (rel === "bk") c[f.face > 0 ? "l" : "r"] = val; else c[rel] = val; };
    b.t -= dt;
    if (b.hold) { for (var hk in b.hold) abs(hk, b.hold[hk]); b.holdT -= dt; if (b.holdT <= 0) b.hold = null; }
    for (var i = b.q.length - 1; i >= 0; i--) { var e = b.q[i]; if (m.t >= e.at) { if (e.btn) c.p[e.btn] = true; if (e.d) c.d = true; if (e.bk) abs("bk", true); if (e.u) c.u = true; if (e.fw) abs("fw", true); if (e.spec != null) { c.spec = e.spec; c.ex = e.ex; } if (e.fin) c.fin = true; b.q.splice(i, 1); } }
    if (m.phase !== "fight" && m.phase !== "finale") { b.q = []; b.hold = null; return c; }
    if (f.st === "held") { if (!b.techTry) { b.techTry = true; if (r() < 0.12 + 0.55 * s) c.p.LP = true; } return c; }
    b.techTry = false;
    if (f.st === "blockstun" || f.st === "hitstun") b.pressed = true;
    else if (b.pressed && isFree(f) && f.y <= 0) { // just came out of a block or a hit: answer the pressure at once
      b.pressed = false; var dd = Math.abs(o.x - f.x);
      if (dd < 1.4 && r() < 0.3 + 0.6 * s) {
        var rv = findSpec(f, function (x) { return x.kind === "rise" && x.inv; }), roll0 = r();
        if (rv >= 0 && roll0 < 0.35) { c.spec = rv; return c; }
        if (roll0 < 0.6 && dd < 0.72 && o.y <= 0.05 && isFree(o)) { c.p.LP = true; return c; }
        if (roll0 < 0.8) { c.p.LP = true; return c; }
        c.dblB = true; abs("bk", true); return c;
      }
    }
    if (f.buf.scramble > 0 && r() < 0.5) { var t = c.l; c.l = c.r; c.r = t; } // the scramble confuses the CPU too
    // punish: the rival is stuck in the recovery of a move it has already finished (one decision per move, made fast)
    if (o.mv && (o.st === "attack" || o.st === "special") && o.y <= 0.05 && isFree(f) && f.y <= 0 && m.phase === "fight") {
      var om = o.mv, left = (om.st + om.act + om.rec) / FPS - o.t, live = o.t < (om.st + om.act) / FPS, dp = Math.abs(o.x - f.x);
      if (!live && left > 8 / FPS && b.punFor !== om && (dp < 1.25 || ((om.kind === "proj" || om.kind === "beam" || om.kind === "drop") && dp < 4.2))) {
        b.punFor = om;
        if (r() < 0.2 + 0.7 * s) {
          if (dp >= 1.25) { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.32, btn: "HK" }); b.t = 0.5; } // jump in over the projectile
          else if (dp > 1.0) { var rp = findSpec(f, function (x) { return x.kind === "rush" || (x.kind === "strike" && (x.reach || 0) >= 1.1); }); if (rp >= 0) c.spec = rp; else { abs("bk", true); c.p.LK = true; } } // out of jab range: rush or sweep
          else if (dp > 0.8) c.p.HK = true;
          else if (r() < 0.5) { c.d = true; c.p.HP = true; }
          else { var ch0 = CHAINS[Math.floor(r() * CHAINS.length)], g0 = 0.1 + (1 - s) * 0.05; ch0.seq.forEach(function (mv, k) { b.q.push({ at: m.t + k * g0, btn: mv.toUpperCase() }); }); b.t = ch0.seq.length * g0 + 0.2; }
          return c;
        }
      }
    }
    if (b.t > 0) return c;
    b.t = 0.08 + (1 - s) * 0.28 + r() * 0.1;
    var d = Math.abs(o.x - f.x), free = isFree(f) || f.st === "air";
    if (m.phase === "finale") {
      if (m.winner === f.side && isFree(f)) {
        if (!b.finTry && m.pt > 0.6) { b.finTry = true; if (r() < 0.35 + 0.6 * s) { c.fin = true; return c; } }
        if (m.pt > 2.2) { if (d > 0.9) { b.hold = { fw: true }; b.holdT = 0.3; } else c.p.HP = true; }
      }
      return c;
    }
    b.finTry = false;
    if (!free && f.st !== "blockstun" && f.st !== "attack") return c;
    var th = threat(m, f, o);
    if (th && f.y <= 0) {
      if (th.proj && r() < 0.25 * s) { var sh = findSpec(f, function (x) { return x.effect === "reflect" || x.effect === "cage"; }); if (sh >= 0 && isFree(f)) { c.spec = sh; return c; } }
      if (th.proj) b.zoned = Math.min(4, (b.zoned || 0) + 1);
      if (th.proj && r() < 0.3 + 0.45 * s && isFree(f) && th.proj.y < 1.5) { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.34, btn: "HK" }); return c; }
      // the CPU learns: the more you repeat a move, the more often it blocks it (and blocks it the right way)
      var mid0 = o.mv && o.mv.id ? o.mv.id : th.lvl; if (b.lastSeen !== o.t + mid0) { b.lastSeen = o.t + mid0; b.seen = b.seen || {}; b.seen[mid0] = Math.min(4, (b.seen[mid0] || 0) * 0.85 + 1); }
      var learn = Math.min(0.35, 0.09 * ((b.seen || {})[mid0] || 0));
      if (r() < 0.15 + 0.75 * s + learn) { var low = th.lvl === "low" ? r() < 0.45 + 0.5 * s + learn * 1.4 : th.lvl === "overhead" ? false : r() < 0.2; b.hold = { blk: true, d: low }; b.holdT = 0.22 + r() * 0.2; for (var hk2 in b.hold) abs(hk2, b.hold[hk2]); return c; }
    }
    if (f.st === "attack" || f.st === "blockstun") return c;
    if (f.st === "air") { if (!f.airAtk && d < 1.3 && f.vy < 1) c.p[r() < 0.6 ? "HK" : "HP"] = true; return c; }
    // super with a full meter, when it can land (beams from anywhere, rushes up close)
    var sup = SUPERS[f.id];
    if (sup && f.meter >= SUPER_COST && isFree(f) && (sup.kind === "beam" ? d < 7.5 : d < 2.2) && o.inv <= 0 && r() < 0.25 + 0.45 * s) { c.sup = true; return c; }
    // personality: zoners keep their distance, rushers close in, grapplers look for throws, tricksters teleport and hop
    if (ai === "zoner" && d < 2.2 && r() < 0.18 + 0.2 * s && isFree(f)) { if (r() < 0.5) { c.dblB = true; abs("bk", true); } else { b.hold = { bk: true }; b.holdT = 0.3; abs("bk", true); } return c; }
    if (ai === "zoner" && d > 2.6 && r() < 0.25 + 0.2 * s) { var zp = findSpec(f, function (x) { return x.kind === "proj" || x.kind === "beam" || x.kind === "drop"; }); if (zp >= 0) { c.spec = zp; c.ex = f.meter >= PHYS.exCost && r() < 0.3; return c; } }
    if (ai === "rush" && d > 1.6 && r() < 0.3 + 0.2 * s) { c.dblF = true; abs("fw", true); return c; }
    if (ai === "grappler" && d < 0.72 && o.y <= 0.05 && !(o.thrownT > 0) && r() < 0.25 + 0.25 * s) { c.p.LP = true; return c; }
    if (ai === "tricky" && r() < 0.08 + 0.1 * s) { var tk = findSpec(f, function (x) { return x.kind === "tele" || x.kind === "hop" || x.kind === "trap" || x.kind === "field"; }); if (tk >= 0) { c.spec = tk; return c; } }
    // anti-air
    if (o.y > 0.5 && d < 1.7 && (o.x - f.x) * o.vx < 0.5 && r() < 0.15 + 0.55 * s) {
      var rise = findSpec(f, function (x) { return x.kind === "rise"; });
      if (rise >= 0 && r() < 0.5) c.spec = rise; else { c.d = true; c.p.HP = true; }
      return c;
    }
    if (o.st === "knockdown" || o.st === "getup" || o.st === "juggle" && o.jugInv) { if (d > 1.6) { b.hold = { fw: true }; b.holdT = 0.25; } return c; }
    if (o.st === "juggle" && d < 1.3 && r() < 0.3 + 0.5 * s) { c.d = true; c.p.HP = true; return c; }
    var ex = f.meter >= PHYS.exCost && r() < 0.35 * s;
    b.zoned = Math.max(0, (b.zoned || 0) - 0.02);
    var behind = f.hp < o.hp - 8 && m.time < 25;
    if (d > 2.2 && ((b.zoned || 0) > 1.5 || behind) && r() < 0.55 + 0.3 * s) { if (r() < 0.6) { c.dblF = true; abs("fw", true); } else { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.34, btn: "HK" }); } return c; } // stop being zoned: close the gap
    if (d > 3.2) {
      var pr = findSpec(f, function (x) { return x.kind === "proj" || x.kind === "drop" || x.kind === "beam" || (x.kind === "field" && x.range >= d); });
      var roll = r();
      if (pr >= 0 && roll < 0.22 + 0.15 * s) { c.spec = pr; c.ex = ex; }
      else if (roll < 0.4) { c.dblF = true; abs("fw", true); }
      else if (roll < 0.47) { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.35 + r() * 0.15, btn: "HK" }); }
      else { b.hold = { fw: true }; b.holdT = 0.25 + r() * 0.35; abs("fw", true); }
    } else if (d > 1.25) {
      var roll2 = r();
      if (roll2 < 0.12 + 0.1 * s) { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.3 + r() * 0.12, btn: r() < 0.7 ? "HK" : "HP" }); }
      else if (roll2 < 0.25 && d < 1.5) { abs("bk", true); c.p.LK = true; }
      else if (roll2 < 0.38) { var rs = findSpec(f, function (x) { return x.kind === "rush" || x.kind === "proj" || x.kind === "strike" && x.reach > 1.3; }); if (rs >= 0) { c.spec = rs; c.ex = ex; } }
      else if (roll2 < 0.45) { b.hold = { bk: true }; b.holdT = 0.2; abs("bk", true); }
      else { b.hold = { fw: true }; b.holdT = 0.2 + r() * 0.25; abs("fw", true); }
    } else {
      var roll3 = r(), blocking = o.st === "block" || o.st === "blockstun";
      if (blocking && roll3 < 0.4 + 0.3 * s) { if (d < 0.72) c.p.LP = true; else if (r() < 0.5) { c.d = true; c.p.LK = true; } else { c.u = true; abs("fw", true); b.q.push({ at: m.t + 0.25, btn: "HK" }); } }
      else if (roll3 < 0.5 + 0.25 * s) {
        var ch = CHAINS[Math.floor(r() * CHAINS.length)], gap = 0.1 + (1 - s) * 0.06;
        ch.seq.forEach(function (mv, k) { b.q.push({ at: m.t + k * gap, btn: mv.toUpperCase() }); });
        if (s > 0.45 && r() < s) { var fin2 = findSpec(f, function (x) { return x.kind === "rush" || x.kind === "strike" || x.kind === "proj"; }); if (fin2 >= 0) b.q.push({ at: m.t + ch.seq.length * gap + 0.02, spec: fin2, ex: ex }); }
        b.t = ch.seq.length * gap + 0.25;
      }
      else if (roll3 < 0.62) { c.d = true; c.p.HP = true; }
      else if (roll3 < 0.72) { var cl = findSpec(f, function (x) { return x.kind === "strike" || x.kind === "rise" || x.kind === "shield" || x.kind === "tele"; }); if (cl >= 0) { c.spec = cl; c.ex = ex; } else c.p.HK = true; }
      else if (roll3 < 0.8 && d < 0.72) c.p.LP = true;
      else if (roll3 < 0.88) { abs("bk", true); c.p.LK = true; }
      else { b.hold = { bk: true }; b.holdT = 0.25; abs("bk", true); if (r() < 0.3) c.dblB = true; }
    }
    return c;
  }

  /* ---------- Roster 2: twelve more scientists and two original characters (Nov 2026) ----------
     Each look is an original cartoon avatar; life dates and facts are the commonly cited ones. Specials reuse the engine's
     kinds (proj, rush, rise, strike, beam, field, shield/buff, drop, trap, aura, tele, hop) with their own numbers. */
  function P(o) { return S(o); }
  var ROSTER2 = [
    { id: "volta", f: { mass: 70, speed: 1.02, jump: 1.0, power: 1.02, arena: "coil", col: "#f59e0b", ai: "balanced" },
      look: { name: "Alessandro Volta", life: "1745–1827", skin: "#efc6a0", hair: "#d8d4cc", style: "receding", coat: "#5b3a1e", eye: "#3a2a20",
        fact: "Built the voltaic pile in 1800, the first battery to give a steady current.", src: "Encyclopaedia Britannica, “Alessandro Volta”",
        special: "Voltaic pile", idea: "Stacking cells in series adds their voltages: V = V₁ + V₂ + …" },
      sp: [P({ id: "pile", name: "Voltaic Pile", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 12, rec: 20, dmg: 9, J: 180, v: 7, life: 2, h: 1.2, r: 0.3, art: "bolt",
          cap: "A stack of zinc and copper discs fires a spark.", idea: "A voltaic pile stacks cells in series, so the voltages add: ten 1.1 V cells give about 11 V." }),
        P({ id: "frog", name: "Frog-Leg Twitch", in: ["F", "D", "F", "LK"], sc: "U", kind: "rise", vy: 5.4, vx: 1.1, st: 4, act: 10, rec: 24, dmg: 10, J: 300, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spark",
          cap: "A twitchy rising kick.", idea: "Volta showed the twitch in Galvani's frog legs came from the metals touching, not 'animal electricity'." }),
        P({ id: "series", name: "Series Rush", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 5.5, st: 7, act: 22, rec: 18, dmg: 5, J: 110, n: 3, reach: 0.7, h: 1.1, art: "streak",
          cap: "Three hits in a row, like cells in a row.", idea: "In series the same current flows through every element." }),
        P({ id: "electrophorus", name: "Electrophorus", in: ["D", "B", "LP"], sc: "B", kind: "buff", effect: "armor", dur: 1.1, st: 6, act: 8, rec: 12, art: "aura",
          cap: "Charges up and shrugs off one blow.", idea: "An electrophorus makes charge by induction and can be recharged again and again." }),
        P({ id: "potential", name: "Potential Drop", in: ["D", "D", "HP"], sc: "D", kind: "drop", drop: 3.5, st: 12, rec: 20, dmg: 9, J: 210, lvl: "overhead", hs: 30, art: "coil",
          cap: "A cartoon battery falls from above.", idea: "Voltage is energy per unit charge: 1 V = 1 J/C." }),
        P({ id: "arc", name: "Carbon Arc", in: { hold: "HP", t: 1 }, sc: null, kind: "beam", st: 16, act: 14, rec: 28, dmg: 11, J: 190, dt: 0.02, reach: 5.5, h: 1.3, hr: 0.4, kd: true, art: "ray",
          cap: "A bright arc between two rods.", idea: "An arc lamp passes current across a small air gap, heating it until it glows white." })],
      fin: { name: "Battery Low", in: ["D", "F", "D", "HP"], art: "bulb", text: "Their battery icon drops to one bar and they power down for a nap." },
      sup: { name: "Hundred-Cell Pile", kind: "beam", art: "ray", cap: "A hundred cells in series light up the whole stage.", idea: "100 cells × 1.1 V ≈ 110 V: series voltages add." } },
    { id: "ohm", f: { mass: 84, speed: 0.94, jump: 0.95, power: 1.08, arena: "foundry", col: "#94a3b8", ai: "grappler" },
      look: { name: "Georg Ohm", life: "1789–1854", skin: "#f0c8a4", hair: "#7a6a5a", style: "whiskers", coat: "#334155", eye: "#2a2f36",
        fact: "Published the relation between voltage, current and resistance in 1827.", src: "Encyclopaedia Britannica, “Georg Simon Ohm”",
        special: "Resistance", idea: "Ohm's law: V = IR. More resistance, less current for the same voltage." },
      sp: [P({ id: "resist", name: "Resistance Wall", in: ["D", "B", "LP"], sc: "B", kind: "field", effect: "brake", range: 4.5, dur: 2.2, st: 10, rec: 18, art: "brake",
          cap: "The rival wades through treacle.", idea: "Resistance opposes current: a bigger R means a smaller I = V/R." }),
        P({ id: "vir", name: "V-I-R Press", in: ["D", "F", "HP"], sc: "F", kind: "strike", st: 9, act: 4, rec: 22, dmg: 12, J: 300, reach: 1.0, h: 1.2, kd: true, art: "push",
          cap: "A heavy two-handed shove.", idea: "Double the voltage across a fixed resistor and the current doubles." }),
        P({ id: "heat", name: "Joule Heating", in: ["D", "D", "LK"], sc: "D", kind: "aura", dur: 2.4, reach: 1.1, tick: 0.4, st: 10, rec: 16, dmg: 2, J: 60, hs: 14, art: "aura",
          cap: "He glows warm like a toaster wire.", idea: "Power lost in a resistor is P = I²R, which is why wires get warm." }),
        P({ id: "short", name: "Short Circuit", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 4.2, st: 9, act: 22, rec: 20, dmg: 11, J: 280, reach: 0.7, h: 1.2, armor: true, kd: true, art: "streak",
          cap: "An armoured charge with almost no resistance.", idea: "A short circuit has tiny R, so I = V/R becomes very large." }),
        P({ id: "rheostat", name: "Rheostat Spin", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 4.8, vx: 0.6, st: 6, act: 10, rec: 26, dmg: 12, J: 330, ang: 75, reach: 0.8, h: 1.3, hr: 0.9, inv: 5, launch: true, art: "spin",
          cap: "A rising twist like turning a dial.", idea: "A rheostat is a variable resistor: turning it changes R and so the current." }),
        P({ id: "ground", name: "Earth Lead", in: { hold: "LK", t: 1 }, sc: null, kind: "strike", both: true, st: 14, act: 6, rec: 24, dmg: 12, J: 280, ang: 20, reach: 1.3, h: 0.3, hr: 0.4, lvl: "low", kd: true, art: "quake",
          cap: "A stamp that sends the shock to ground.", idea: "An earth wire gives fault current an easy path to ground, so the fuse blows instead of you." })],
      fin: { name: "Ohm Sweet Ohm", in: ["B", "D", "F", "HK"], art: "cage", text: "A giant Ω drops over them like a cosy tent. They decide to stay in." },
      sup: { name: "Infinite Resistance", kind: "rush", art: "streak", cap: "An unstoppable armoured slam.", idea: "An open circuit has infinite resistance: no current flows at all." } },
    { id: "ampere", f: { mass: 68, speed: 1.08, jump: 1.04, power: 1.0, arena: "coil", col: "#60a5fa", ai: "rush" },
      look: { name: "André-Marie Ampère", life: "1775–1836", skin: "#f1c8a2", hair: "#5a4636", style: "wild", coat: "#1e3a5f", eye: "#2a2a30",
        fact: "Showed in 1820 that two parallel currents attract or repel each other.", src: "Encyclopaedia Britannica, “André-Marie Ampère”",
        special: "Parallel wires", idea: "Currents in the same direction attract; in opposite directions they repel." },
      sp: [P({ id: "attract", name: "Parallel Pull", in: ["D", "F", "LK"], sc: "F", kind: "field", effect: "pull", range: 4.2, J: 170, dmg: 3, st: 12, rec: 18, art: "well",
          cap: "Same-way currents: the rival is pulled in.", idea: "Parallel currents in the same direction attract each other." }),
        P({ id: "repel", name: "Anti-Parallel Push", in: ["D", "B", "HP"], sc: "B", kind: "strike", st: 8, act: 4, rec: 20, dmg: 9, J: 320, ang: 10, reach: 1.1, h: 1.2, kd: true, art: "push",
          cap: "Opposite currents: a big shove away.", idea: "Antiparallel currents repel." }),
        P({ id: "solenoid", name: "Solenoid Spin", in: ["B", "F", "LP"], sc: null, kind: "rush", v: 2.4, st: 6, act: 34, rec: 16, dmg: 3, J: 70, n: 5, reach: 0.8, h: 1.1, art: "spin",
          cap: "A whirling coil of fists.", idea: "A coil of wire (solenoid) carrying current makes a field like a bar magnet." }),
        P({ id: "rightgrip", name: "Right-Hand Grip", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.6, vx: 1.2, st: 4, act: 10, rec: 24, dmg: 10, J: 300, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
          cap: "A curling rising kick.", idea: "Right-hand grip rule: thumb along the current, fingers curl with the magnetic field." }),
        P({ id: "ampdash", name: "Current Dash", in: ["D", "D", "HK"], sc: "D", kind: "rush", v: 8, st: 5, act: 18, rec: 16, dmg: 7, J: 160, reach: 0.6, h: 1.0, through: true, art: "streak",
          cap: "A slide straight through the rival.", idea: "Current is charge per second: 1 A = 1 C/s." }),
        P({ id: "loop", name: "Current Loop", in: { hold: "HP", t: 1 }, sc: null, kind: "proj", st: 12, rec: 22, dmg: 10, J: 200, v: 5, life: 2.4, h: 1.2, r: 0.4, art: "rings",
          cap: "A ring of current rolls forward.", idea: "A current loop behaves like a tiny magnet with a north and south face." })],
      fin: { name: "Unit Named After You", in: ["F", "F", "D", "LP"], art: "flick", text: "A huge 'A' sign lands on them. Everyone is measured in amps now." },
      sup: { name: "Ampère's Circuit", kind: "rush", art: "spin", cap: "A spinning storm of current.", idea: "Ampère's law: the field around a closed loop depends on the current through it." } },
    { id: "maxwell", f: { mass: 72, speed: 1.0, jump: 1.0, power: 1.04, arena: "observatory", col: "#22d3ee", ai: "zoner" },
      look: { name: "James Clerk Maxwell", life: "1831–1879", skin: "#f2cba8", hair: "#3b2a20", style: "whiskers", coat: "#1f2937", eye: "#2b2620",
        fact: "Unified electricity, magnetism and light in one theory (1865).", src: "Encyclopaedia Britannica, “James Clerk Maxwell”",
        special: "Light is a wave", idea: "Light is an electromagnetic wave travelling at c ≈ 3.0 × 10⁸ m/s." },
      sp: [P({ id: "emwave", name: "EM Wave", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 11, rec: 20, dmg: 8, J: 150, v: 8, life: 2, h: 1.25, r: 0.3, art: "wave", wave: 1.2,
          cap: "A rippling wave of light.", idea: "A changing electric field makes a magnetic field, and back again: that is a light wave." }),
        P({ id: "displacement", name: "Displacement Current", in: ["D", "B", "LP"], sc: "B", kind: "shield", effect: "reflect", dur: 0.5, st: 3, act: 28, rec: 14, art: "rings",
          cap: "Sends projectiles back the way they came.", idea: "Maxwell added the 'displacement current' term so his equations held even inside a capacitor." }),
        P({ id: "spectrum", name: "Spectrum Sweep", in: { hold: "HK", t: 1 }, sc: null, kind: "beam", st: 16, act: 16, rec: 28, dmg: 12, J: 200, dt: 0.02, reach: 7, h: 1.3, hr: 0.4, kd: true, art: "spectrum",
          cap: "A rainbow beam.", idea: "Radio, light and X-rays are the same kind of wave with different wavelengths." }),
        P({ id: "demon", name: "Maxwell's Demon", in: ["D", "D", "LK"], sc: "D", kind: "tele", to: "behind", st: 6, act: 8, rec: 12, inv: 12, art: "fade",
          cap: "A tiny doorkeeper lets him through.", idea: "Maxwell's thought-experiment demon sorts fast molecules from slow ones; it cannot beat the second law." }),
        P({ id: "curl", name: "Curl Kick", in: ["F", "D", "F", "LK"], sc: "U", kind: "rise", vy: 5.4, vx: 1.1, st: 5, act: 10, rec: 24, dmg: 10, J: 300, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
          cap: "A circling rising kick.", idea: "The curl measures how a field circulates around a point." }),
        P({ id: "colour", name: "Colour Photo", in: ["B", "F", "HP"], sc: null, kind: "strike", st: 8, act: 6, rec: 20, dmg: 6, J: 80, reach: 1.4, h: 1.3, hr: 0.9, hs: 50, art: "prism",
          cap: "A dazzling three-colour flash.", idea: "Maxwell showed the first colour photograph (1861) by mixing red, green and blue images." })],
      fin: { name: "Four Equations", in: ["D", "B", "F", "HP"], art: "copies", text: "Four chalk equations orbit them until they sit down to take notes." },
      sup: { name: "Speed of Light", kind: "beam", art: "spectrum", cap: "A full-spectrum beam across the arena.", idea: "c = 1/√(μ₀ε₀): Maxwell calculated light's speed from electricity and magnetism." } },
    { id: "galileo", f: { mass: 74, speed: 1.0, jump: 1.04, power: 1.03, arena: "observatory", col: "#facc15", ai: "balanced" },
      look: { name: "Galileo Galilei", life: "1564–1642", skin: "#e9bf96", hair: "#8a6a4a", style: "receding", coat: "#7c2d12", eye: "#3a2a20",
        fact: "Pointed a telescope at the sky in 1609–10 and saw four moons of Jupiter.", src: "Encyclopaedia Britannica, “Galileo”",
        special: "Falling bodies", idea: "Without air resistance, heavy and light objects fall with the same acceleration." },
      sp: [P({ id: "tower", name: "Leaning-Tower Drop", in: ["D", "D", "HP"], sc: "D", kind: "drop", drop: 4.5, st: 12, rec: 20, dmg: 10, J: 230, lvl: "overhead", hs: 30, art: "ball",
          cap: "Two balls fall together.", idea: "All objects fall with g ≈ 9.8 m/s² when air resistance is small." }),
        P({ id: "lens", name: "Telescope Glint", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 9, rec: 18, dmg: 7, J: 120, v: 12, life: 1.3, h: 1.3, r: 0.2, art: "photon",
          cap: "A glint of focused light.", idea: "A refracting telescope uses lenses to gather light and magnify." }),
        P({ id: "pendulum", name: "Pendulum Swing", in: ["B", "F", "HK"], sc: null, kind: "strike", both: true, st: 10, act: 8, rec: 22, dmg: 10, J: 240, reach: 1.2, h: 1.0, hr: 0.8, kd: true, art: "arc",
          cap: "A wide swinging kick.", idea: "A pendulum's period T = 2π√(L/g) does not depend on the swing size (for small swings)." }),
        P({ id: "ramp", name: "Inclined Plane", in: ["D", "F", "LK"], sc: null, kind: "rush", v: 6, glide: true, st: 6, act: 20, rec: 18, dmg: 7, J: 150, reach: 0.6, h: 0.3, lvl: "low", art: "slide",
          cap: "A low sliding kick down a ramp.", idea: "Galileo slowed falling with ramps so he could time it." }),
        P({ id: "moons", name: "Jovian Moons", in: ["D", "B", "LP"], sc: "B", kind: "shield", effect: "orbit", charges: 4, dur: 4, st: 8, act: 6, rec: 14, art: "orbit",
          cap: "Four moons circle him and absorb hits.", idea: "Io, Europa, Ganymede and Callisto orbit Jupiter; Galileo saw them in 1610." }),
        P({ id: "inertia2", name: "Thought Experiment", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 5.6, vx: 1.0, st: 5, act: 10, rec: 24, dmg: 11, J: 310, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spark",
          cap: "A rising uppercut.", idea: "A ball rolling on a frictionless plane would roll forever: Galileo's idea of inertia." })],
      fin: { name: "Eppur si muove", in: ["F", "D", "B", "HP"], art: "flick", text: "They orbit the stage slowly, insisting they are not moving." },
      sup: { name: "Starry Messenger", kind: "beam", art: "photon", cap: "A telescope beam full of stars.", idea: "Sidereus Nuncius (1610) reported the moons of Jupiter and the Moon's mountains." } },
    { id: "kepler", f: { mass: 66, speed: 1.08, jump: 1.1, power: 0.98, arena: "observatory", col: "#a3e635", ai: "tricky" },
      look: { name: "Johannes Kepler", life: "1571–1630", skin: "#f0c6a0", hair: "#4b3a2a", style: "slick", coat: "#365314", eye: "#2a2a24",
        fact: "Found that planets move in ellipses with the Sun at one focus (1609).", src: "Encyclopaedia Britannica, “Johannes Kepler”",
        special: "Equal areas", idea: "A planet sweeps out equal areas in equal times, so it speeds up near the Sun." },
      sp: [P({ id: "ellipse", name: "Elliptical Orbit", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 12, rec: 20, dmg: 8, J: 150, v: 5.5, life: 2.6, h: 1.2, r: 0.3, art: "orb", wave: 1.4,
          cap: "A planet on a looping path.", idea: "Kepler's first law: orbits are ellipses, not circles." }),
        P({ id: "perihelion", name: "Perihelion Dash", in: ["B", "B", "HK"], sc: null, kind: "rush", v: 9, st: 5, act: 18, rec: 18, dmg: 8, J: 170, reach: 0.6, h: 1.0, art: "doppler",
          cap: "Fastest when closest.", idea: "Kepler's second law: a planet moves fastest at perihelion." }),
        P({ id: "harmony", name: "Harmony of Worlds", in: ["D", "D", "LP"], sc: "D", kind: "field", effect: "slow", range: 5.5, dur: 2, st: 15, rec: 24, art: "clock",
          cap: "The rival's clock runs slow.", idea: "Third law: T² ∝ a³. Far planets take much longer to orbit." }),
        P({ id: "comet", name: "Comet Kick", in: ["F", "D", "F", "LK"], sc: "U", kind: "rise", vy: 6, vx: 1.4, st: 4, act: 10, rec: 22, dmg: 10, J: 290, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "streak",
          cap: "A rising kick with a tail.", idea: "Comets on long ellipses swing fast past the Sun and crawl far away." }),
        P({ id: "snowflake", name: "Six-Cornered Snowflake", in: ["D", "B", "LK"], sc: "B", kind: "trap", dist: 2, life: 6, st: 14, rec: 18, dmg: 7, J: 140, lvl: "low", hs: 34, art: "ice",
          cap: "A slippery snowflake on the floor.", idea: "Kepler wrote a booklet (1611) asking why snowflakes have six sides." }),
        P({ id: "float2", name: "Weightless Hop", in: ["B", "D", "LK"], sc: null, kind: "hop", vy: 4.8, vx: 2.4, gScale: 0.5, st: 4, act: 2, rec: 4, art: "float",
          cap: "A floaty hop.", idea: "Less gravity, longer hang time: t = 2v/g." })],
      fin: { name: "Music of the Spheres", in: ["B", "F", "D", "LK"], art: "disco", text: "Planets hum a tune and they can't help swaying in an ellipse." },
      sup: { name: "Three Laws", kind: "rush", art: "orbit", cap: "Orbit, sweep, harmony: three hits in one.", idea: "Kepler's three laws describe every planet's orbit." } },
    { id: "hertz", f: { mass: 70, speed: 1.06, jump: 1.02, power: 1.0, arena: "accel", col: "#e879f9", ai: "zoner" },
      look: { name: "Heinrich Hertz", life: "1857–1894", skin: "#f1caa6", hair: "#2b2018", style: "slick", coat: "#4a044e", eye: "#2a2024",
        fact: "Proved in 1887–88 that electromagnetic waves exist, by making and detecting radio waves.", src: "Encyclopaedia Britannica, “Heinrich Hertz”",
        special: "Radio waves", idea: "Frequency is cycles per second, measured in hertz (Hz)." },
      sp: [P({ id: "radio", name: "Radio Pulse", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 11, rec: 20, dmg: 8, J: 140, v: 9, life: 1.8, h: 1.3, r: 0.3, art: "sound",
          cap: "A pulse of radio waves.", idea: "Hertz's spark-gap transmitter made waves that crossed the room to a receiver loop." }),
        P({ id: "freq", name: "Frequency Sweep", in: ["D", "B", "HP"], sc: "B", kind: "proj", st: 14, rec: 22, dmg: 6, J: 120, v: 4, life: 2.6, h: 1.0, r: 0.35, art: "ac", wave: 2,
          cap: "A wavy pulse that goes up and down.", idea: "f = 1/T: a 100 Hz wave repeats every 10 ms." }),
        P({ id: "gap", name: "Spark-Gap Snap", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.5, vx: 1.2, st: 5, act: 10, rec: 26, dmg: 11, J: 320, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spark",
          cap: "A rising crackle.", idea: "A spark across a gap rings like a bell at the circuit's resonant frequency." }),
        P({ id: "antenna", name: "Dipole Antenna", in: { hold: "LP", t: 1 }, sc: null, kind: "beam", st: 16, act: 14, rec: 28, dmg: 11, J: 190, dt: 0.02, reach: 6.5, h: 1.3, hr: 0.4, kd: true, art: "ray2",
          cap: "A straight broadcast beam.", idea: "A dipole antenna about half a wavelength long radiates well." }),
        P({ id: "photoel", name: "Photoelectric Pop", in: ["D", "D", "HK"], sc: "D", kind: "strike", both: true, st: 9, act: 6, rec: 22, dmg: 10, J: 260, ang: 30, reach: 1.1, h: 1.0, hr: 1.0, kd: true, art: "burst",
          cap: "A burst of light all around.", idea: "Hertz noticed ultraviolet light helped sparks jump: the photoelectric effect." }),
        P({ id: "standing", name: "Standing Wave", in: ["B", "F", "LK"], sc: null, kind: "rush", v: 3, st: 6, act: 30, rec: 16, dmg: 3, J: 70, n: 4, reach: 0.8, h: 1.0, art: "wave",
          cap: "Four quick pulses on the spot.", idea: "Two waves travelling opposite ways make a standing wave with fixed nodes." })],
      fin: { name: "Off the Air", in: ["D", "U", "D", "LK"], art: "nightlight", text: "Static fills the screen and they stand there buffering." },
      sup: { name: "Broadcast", kind: "beam", art: "sound", cap: "Full-power transmission.", idea: "Every radio and phone today uses Hertz's waves." } },
    { id: "archimedes", f: { mass: 88, speed: 0.92, jump: 0.94, power: 1.1, arena: "orchard", col: "#38bdf8", ai: "grappler" },
      look: { name: "Archimedes", life: "c. 287–212 BC", skin: "#e2b48c", hair: "#e5e5e5", style: "wig", coat: "#0e7490", eye: "#2a2620",
        fact: "Explained the lever and the upthrust on things in water, in Syracuse over 2,200 years ago.", src: "Encyclopaedia Britannica, “Archimedes”",
        special: "Lever", idea: "Give me a lever long enough and I will move the world: force × distance balances on both sides." },
      sp: [P({ id: "lever", name: "Long Lever", in: ["D", "F", "HP"], sc: "F", kind: "strike", st: 11, act: 5, rec: 22, dmg: 12, J: 340, ang: 25, reach: 1.4, h: 1.1, hr: 0.6, kd: true, art: "push",
          cap: "A huge prying swing.", idea: "Moment = force × distance from the pivot, so a long lever multiplies force." }),
        P({ id: "eureka", name: "Eureka Splash", in: ["D", "D", "HP"], sc: "D", kind: "strike", both: true, st: 14, act: 6, rec: 24, dmg: 11, J: 270, ang: 30, reach: 1.3, h: 1.0, hr: 1.0, kd: true, art: "bubble",
          cap: "He jumps out of the bath and splashes everyone.", idea: "Upthrust equals the weight of fluid displaced (Archimedes' principle)." }),
        P({ id: "screw", name: "Archimedes' Screw", in: ["B", "F", "LP"], sc: null, kind: "rush", v: 2.2, st: 7, act: 36, rec: 18, dmg: 3, J: 70, n: 5, reach: 0.8, h: 1.1, armor: true, art: "spin",
          cap: "A turning armoured screw.", idea: "A turning screw lifts water uphill; it is still used for irrigation." }),
        P({ id: "mirror", name: "Burning Mirrors", in: { hold: "HP", t: 1 }, sc: null, kind: "beam", st: 18, act: 14, rec: 30, dmg: 12, J: 200, dt: 0.02, reach: 6, h: 1.3, hr: 0.4, kd: true, art: "ray",
          cap: "A legend: mirrors focusing sunlight (probably never happened).", idea: "A concave mirror focuses parallel light to a point, the focus." }),
        P({ id: "pulley", name: "Compound Pulley", in: ["D", "B", "LK"], sc: "B", kind: "field", effect: "pull", range: 4.5, J: 190, dmg: 4, st: 14, rec: 20, art: "well",
          cap: "A rope drags the rival in.", idea: "More pulley wheels, less effort: the same work spread over more rope." }),
        P({ id: "catapult", name: "Catapult Hop", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 4.6, vx: 0.6, st: 6, act: 10, rec: 26, dmg: 12, J: 330, ang: 75, reach: 0.8, h: 1.3, hr: 0.9, inv: 5, launch: true, art: "arc",
          cap: "A heavy rising strike.", idea: "Stored elastic energy becomes kinetic energy on release." })],
      fin: { name: "Eureka!", in: ["F", "B", "D", "HP"], art: "ball", text: "A bathtub appears; they climb in, the water rises, and they shout 'Eureka!'" },
      sup: { name: "Move the World", kind: "rush", art: "push", cap: "A lever under the whole arena.", idea: "With a long enough lever, a small force balances a huge one." } },
    { id: "alhazen", f: { mass: 70, speed: 1.04, jump: 1.0, power: 1.02, arena: "quad", col: "#fbbf24", ai: "zoner" },
      look: { name: "Ibn al-Haytham", life: "c. 965–1040", skin: "#c99a6e", hair: "#2b2018", style: "receding", coat: "#7c5a1a", eye: "#2a2018",
        fact: "Wrote the Book of Optics, arguing that we see because light enters the eye.", src: "Encyclopaedia Britannica, “Ibn al-Haytham”",
        special: "Camera obscura", idea: "Light through a small hole makes an upside-down image of the scene outside." },
      sp: [P({ id: "pinhole", name: "Pinhole Beam", in: ["D", "F", "HP"], sc: "F", kind: "proj", st: 10, rec: 18, dmg: 8, J: 130, v: 11, life: 1.5, h: 1.3, r: 0.22, art: "photon",
          cap: "A thin straight ray of light.", idea: "Light travels in straight lines, which is why a pinhole makes a sharp image." }),
        P({ id: "obscura", name: "Camera Obscura", in: ["D", "B", "LP"], sc: "B", kind: "field", effect: "scramble", range: 4.5, dur: 1.6, st: 14, rec: 20, art: "clicks",
          cap: "Everything flips: left and right swap.", idea: "A pinhole image is inverted, top to bottom and left to right." }),
        P({ id: "refract", name: "Refraction Step", in: ["D", "D", "LK"], sc: "D", kind: "tele", to: "back", st: 4, act: 8, rec: 10, inv: 12, art: "fade",
          cap: "He appears where you did not expect.", idea: "Light bends at a boundary, so things under water are not where they look." }),
        P({ id: "lensrise", name: "Lens Rise", in: ["F", "D", "F", "LK"], sc: "U", kind: "rise", vy: 5.5, vx: 1.1, st: 5, act: 10, rec: 24, dmg: 10, J: 300, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "arc",
          cap: "A rising kick.", idea: "A convex lens brings light rays together at a focus." }),
        P({ id: "method", name: "Experimental Method", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 5, st: 7, act: 22, rec: 18, dmg: 5, J: 110, n: 3, reach: 0.7, h: 1.1, art: "streak",
          cap: "Test, test, test.", idea: "Ibn al-Haytham insisted claims be checked by careful experiment." }),
        P({ id: "rainbow", name: "Reflection Ward", in: { hold: "HK", t: 1 }, sc: null, kind: "shield", effect: "reflect", dur: 0.6, st: 3, act: 30, rec: 14, art: "prism",
          cap: "Throws shots back.", idea: "Law of reflection: angle in equals angle out." })],
      fin: { name: "Upside Down", in: ["D", "F", "U", "LP"], art: "copies", text: "Their image appears upside down on the wall and they try to stand on their head to match it." },
      sup: { name: "Book of Optics", kind: "beam", art: "prism", cap: "Seven volumes of light at once.", idea: "His Kitab al-Manazir (c. 1011–1021) shaped optics for centuries." } },
    { id: "hypatia", f: { mass: 60, speed: 1.12, jump: 1.08, power: 0.94, arena: "quad", col: "#f472b6", ai: "tricky" },
      look: { name: "Hypatia", life: "c. 360–415, Alexandria", skin: "#d4a37a", hair: "#2b1d16", style: "bun", coat: "#6b21a8", eye: "#2a1f1a",
        fact: "Taught mathematics and astronomy in Alexandria and wrote commentaries on them.", src: "Encyclopaedia Britannica, “Hypatia”",
        special: "Astrolabe", idea: "An astrolabe models the sky so you can find the time or a star's height." },
      sp: [P({ id: "astrolabe", name: "Astrolabe Spin", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 10, rec: 20, dmg: 7, J: 120, v: 7, life: 2, h: 1.25, r: 0.3, art: "orb",
          cap: "A spinning brass disc.", idea: "An astrolabe's rotating plate (the rete) shows where the stars are." }),
        P({ id: "conic", name: "Conic Section", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 7, st: 6, act: 20, rec: 18, dmg: 8, J: 160, reach: 0.6, h: 1.0, art: "arc",
          cap: "A curving dash.", idea: "Slice a cone and you get a circle, ellipse, parabola or hyperbola." }),
        P({ id: "hydrometer", name: "Hydrometer Float", in: ["D", "D", "LK"], sc: "D", kind: "hop", vy: 4.6, vx: 2.6, gScale: 0.45, st: 4, act: 2, rec: 4, art: "float",
          cap: "She floats up like a hydrometer.", idea: "A hydrometer floats higher in denser liquid, measuring density." }),
        P({ id: "proof", name: "Proof Strike", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 6, vx: 1.2, st: 4, act: 10, rec: 22, dmg: 10, J: 290, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 7, launch: true, art: "spark",
          cap: "A sharp rising strike. QED.", idea: "A proof shows a statement must be true from things already known." }),
        P({ id: "lesson", name: "Lecture Hall", in: ["D", "B", "HP"], sc: "B", kind: "field", effect: "slow", range: 5, dur: 2.2, st: 15, rec: 24, art: "clock",
          cap: "The rival stops to listen.", idea: "Students came from far away to hear her lectures in Alexandria." }),
        P({ id: "stars", name: "Star Chart", in: { hold: "LP", t: 1 }, sc: null, kind: "strike", st: 6, act: 6, rec: 20, dmg: 5, J: 60, reach: 1.35, h: 1.3, hr: 0.9, hs: 55, art: "prism",
          cap: "A flash of a thousand stars.", idea: "Ancient astronomers charted stars by their angles above the horizon." })],
      fin: { name: "Homework", in: ["B", "D", "F", "LP"], art: "old", text: "A tall stack of geometry homework lands on their desk. They start on page one." },
      sup: { name: "Library of Alexandria", kind: "rush", art: "flurry", cap: "A storm of scrolls.", idea: "The great library collected scrolls from across the ancient world." } },
    { id: "lovelace", f: { mass: 58, speed: 1.12, jump: 1.06, power: 0.95, arena: "accel", col: "#c084fc", ai: "tricky" },
      look: { name: "Ada Lovelace", life: "1815–1852", skin: "#f5d3b8", hair: "#3b2a24", style: "bun", coat: "#4c1d95", eye: "#2c2433",
        fact: "In 1843 published notes with what is often called the first computer program.", src: "Encyclopaedia Britannica, “Ada Lovelace”",
        special: "Analytical Engine", idea: "A machine can follow a list of instructions — a program — to compute anything it is given." },
      sp: [P({ id: "punchcard", name: "Punch Card", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 9, rec: 18, dmg: 6, J: 110, v: 10, life: 1.5, h: 1.25, r: 0.22, art: "clicks",
          cap: "A flying punch card.", idea: "The Analytical Engine was to read its program from punched cards, like a loom." }),
        P({ id: "loopy", name: "Loop", in: ["B", "F", "LP"], sc: null, kind: "rush", v: 2.6, st: 6, act: 32, rec: 16, dmg: 3, J: 60, n: 5, reach: 0.8, h: 1.1, art: "loops",
          cap: "The same move, five times.", idea: "A loop repeats instructions without writing them out again." }),
        P({ id: "ifelse", name: "If–Else", in: ["D", "B", "LK"], sc: "B", kind: "tele", to: "behind", st: 6, act: 8, rec: 12, inv: 12, art: "fade",
          cap: "If you're in front, she's behind.", idea: "A program branches: if a condition holds do one thing, else another." }),
        P({ id: "bernoulli", name: "Bernoulli Numbers", in: ["D", "D", "HP"], sc: "D", kind: "drop", drop: 4, st: 12, rec: 20, dmg: 9, J: 210, lvl: "overhead", hs: 30, art: "dice",
          cap: "A falling column of numbers.", idea: "Her famous Note G worked out Bernoulli numbers step by step on the Engine." }),
        P({ id: "gear", name: "Difference Gear", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.6, vx: 1.2, st: 4, act: 10, rec: 24, dmg: 10, J: 300, ang: 70, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spin",
          cap: "A rising cog kick.", idea: "Babbage's engines computed with toothed gears, not electricity." }),
        P({ id: "debug", name: "Debug", in: { hold: "LK", t: 1 }, sc: null, kind: "trap", dist: 2.2, life: 6, st: 14, rec: 18, dmg: 8, J: 150, lvl: "low", hs: 34, art: "coil",
          cap: "A trap on the floor waits for a mistake.", idea: "Testing a program step by step finds where it goes wrong." })],
      fin: { name: "Infinite Loop", in: ["D", "F", "D", "LK"], art: "copies", text: "They walk in a circle saying 'nearly done' forever." },
      sup: { name: "Note G", kind: "rush", art: "loops", cap: "The whole program runs at once.", idea: "Note G is the 1843 algorithm for Bernoulli numbers." } },
    { id: "noether", f: { mass: 64, speed: 1.06, jump: 1.04, power: 1.02, arena: "clock", col: "#2dd4bf", ai: "balanced" },
      look: { name: "Emmy Noether", life: "1882–1935", skin: "#f2cdb0", hair: "#3a2a20", style: "bun", coat: "#134e4a", eye: "#28241f",
        fact: "Proved in 1918 that every symmetry in physics comes with a conserved quantity.", src: "Encyclopaedia Britannica, “Emmy Noether”",
        special: "Symmetry", idea: "Laws that are the same at every time conserve energy; the same everywhere, conserve momentum." },
      sp: [P({ id: "conserve", name: "Conservation Shield", in: ["D", "B", "LP"], sc: "B", kind: "shield", effect: "reflect", dur: 0.55, st: 3, act: 30, rec: 14, art: "rings",
          cap: "What goes out comes back.", idea: "Momentum is conserved: the total before equals the total after." }),
        P({ id: "symkick", name: "Mirror Symmetry", in: ["D", "F", "HK"], sc: "F", kind: "strike", both: true, st: 9, act: 6, rec: 22, dmg: 10, J: 260, ang: 25, reach: 1.2, h: 1.0, hr: 0.9, kd: true, art: "burst",
          cap: "Kicks both ways at once.", idea: "A symmetric law treats left and right the same." }),
        P({ id: "invariant", name: "Invariant", in: ["D", "D", "HK"], sc: "D", kind: "buff", effect: "armor", dur: 1.2, st: 6, act: 8, rec: 12, art: "aura",
          cap: "Nothing changes her stance.", idea: "An invariant is a quantity that stays the same under a change." }),
        P({ id: "ring", name: "Noetherian Ring", in: ["D", "F", "HP"], sc: null, kind: "proj", st: 12, rec: 20, dmg: 9, J: 170, v: 6, life: 2.2, h: 1.2, r: 0.35, art: "rings",
          cap: "A ring rolls across the floor.", idea: "In algebra, 'Noetherian rings' are named after her." }),
        P({ id: "timeshift", name: "Time Translation", in: ["F", "D", "F", "LP"], sc: "U", kind: "rise", vy: 5.6, vx: 1.1, st: 5, act: 10, rec: 24, dmg: 11, J: 310, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "clock",
          cap: "A rising strike that ignores the clock.", idea: "If the laws do not change with time, energy is conserved." }),
        P({ id: "gauge", name: "Gauge Shift", in: ["B", "B", "LK"], sc: null, kind: "tele", to: "random", st: 5, act: 8, rec: 10, inv: 12, art: "fade",
          cap: "She shifts somewhere else on the stage.", idea: "Gauge symmetry underlies the conservation of electric charge." })],
      fin: { name: "Conserved", in: ["F", "B", "F", "HK"], art: "copies", text: "Their energy is neither created nor destroyed. It just goes to sleep." },
      sup: { name: "Noether's Theorem", kind: "beam", art: "rings", cap: "Every symmetry fires at once.", idea: "Symmetry ↔ conservation: one of the deepest results in physics." } },
    { id: "static", f: { mass: 68, speed: 1.14, jump: 1.08, power: 1.04, arena: "quad", col: "#fde047", ai: "rush", rival: true },
      look: { name: "Static Sule", life: "rival", skin: "#7a4a2a", hair: "#151010", style: "dj", coat: "#ca8a04", eye: "#1a1410",
        fact: "An original EE Hub character: a cocky 300-level student who has an answer for everything and a shock for everyone.", src: "Original EE Hub character",
        special: "Static shock", idea: "Rubbing two materials moves electrons from one to the other, leaving both charged." },
      sp: [P({ id: "rub", name: "Balloon Rub", in: ["D", "F", "LP"], sc: "F", kind: "proj", st: 9, rec: 18, dmg: 7, J: 120, v: 10, life: 1.4, h: 1.25, r: 0.25, art: "spark",
          cap: "A crackling spark flicked forward.", idea: "Charge built up by friction jumps as a spark when it finds a path." }),
        P({ id: "zap", name: "Doorknob Zap", in: ["B", "F", "HK"], sc: null, kind: "rush", v: 7.5, st: 5, act: 18, rec: 16, dmg: 9, J: 180, reach: 0.6, h: 1.1, art: "streak",
          cap: "A dash that ends in a zap.", idea: "Walking on carpet charges you; touching a metal knob discharges it." }),
        P({ id: "hair", name: "Hair-Raiser", in: ["F", "D", "F", "HK"], sc: "U", kind: "rise", vy: 5.8, vx: 1.2, st: 4, act: 10, rec: 22, dmg: 10, J: 300, ang: 72, reach: 0.8, h: 1.3, hr: 0.9, inv: 6, launch: true, art: "spark",
          cap: "A rising kick with his hair on end.", idea: "Like charges repel, so charged hairs push apart and stand up." }),
        P({ id: "cling", name: "Static Cling", in: ["D", "B", "HP"], sc: "B", kind: "field", effect: "pull", range: 4, J: 160, dmg: 3, st: 12, rec: 18, art: "well",
          cap: "The rival sticks to him.", idea: "A charged object attracts a neutral one by polarising it." }),
        P({ id: "ground2", name: "Grounded", in: ["D", "D", "LP"], sc: "D", kind: "field", effect: "drain", range: 4, amount: 30, st: 14, rec: 20, art: "drain",
          cap: "Steals the rival's super meter.", idea: "Touching ground lets excess charge flow away." }),
        P({ id: "lightning", name: "Mini Lightning", in: { hold: "HP", t: 1 }, sc: null, kind: "beam", st: 16, act: 12, rec: 28, dmg: 11, J: 190, dt: 0.02, reach: 6, h: 1.3, hr: 0.4, kd: true, art: "ray2",
          cap: "A tiny bolt of lightning.", idea: "Lightning is a huge static discharge between cloud and ground." })],
      fin: { name: "Bad Hair Day", in: ["D", "B", "D", "HP"], art: "mess", text: "Their hair stands straight up and refuses to come down for the photo." },
      sup: { name: "Thunderhead", kind: "beam", art: "ray2", cap: "He becomes a small storm cloud.", idea: "A thundercloud separates charge until the air breaks down." } },
    { id: "overload", f: { mass: 100, speed: 0.9, jump: 0.9, power: 1.12, arena: "foundry", col: "#ef4444", boss: "mid", ai: "rush" },
      look: { name: "Baron Overload", life: "boss", skin: "#d9a07a", hair: "#2a2a2a", style: "tophat", coat: "#7f1d1d", eye: "#1e1e1e",
        fact: "An original EE Hub boss who plugs everything into one socket and never lets the fuse blow.", src: "Original EE Hub character",
        special: "Overcurrent", idea: "Too much current heats wires (P = I²R); fuses and breakers cut it off to stop fires." },
      sp: [P({ id: "surge", name: "Power Surge", in: ["B", "F", "HP"], sc: "F", kind: "rush", v: 5, st: 10, act: 24, rec: 22, dmg: 12, J: 330, reach: 0.8, h: 1.2, armor: true, kd: true, art: "streak",
          cap: "An armoured charge.", idea: "A surge is a short spike of voltage above normal." }),
        P({ id: "plugs", name: "Extension Tower", in: ["D", "D", "HP"], sc: "D", kind: "drop", drop: 4.5, st: 14, rec: 22, dmg: 11, J: 240, lvl: "overhead", hs: 32, art: "coil",
          cap: "A tower of extension boards falls.", idea: "Daisy-chaining extension boards overloads the first one." }),
        P({ id: "fuse", name: "Never-Blow Fuse", in: ["D", "B", "HK"], sc: "B", kind: "buff", effect: "armor", dur: 2, st: 6, act: 8, rec: 14, art: "aura",
          cap: "Takes hits without flinching.", idea: "A fuse that never blows lets wires overheat: dangerous." }),
        P({ id: "spark2", name: "Arc Flash", in: ["D", "F", "LP"], sc: null, kind: "proj", st: 12, rec: 22, dmg: 10, J: 200, v: 6, life: 2.2, h: 1.2, r: 0.35, art: "burst",
          cap: "A bright flash of arcing.", idea: "An arc flash is the explosive release of energy from a fault." }),
        P({ id: "trip", name: "Breaker Slam", in: { hold: "LK", t: 1 }, sc: null, kind: "strike", both: true, st: 16, act: 6, rec: 26, dmg: 13, J: 300, ang: 20, reach: 1.4, h: 0.3, hr: 0.4, lvl: "low", kd: true, art: "quake",
          cap: "A stamp that shakes the floor.", idea: "A circuit breaker trips on overcurrent and can be reset." }),
        P({ id: "bounce", name: "Inrush Uppercut", in: ["F", "D", "F", "HP"], sc: "U", kind: "rise", vy: 4.6, vx: 0.6, st: 6, act: 10, rec: 26, dmg: 12, J: 330, ang: 75, reach: 0.8, h: 1.3, hr: 0.9, inv: 5, launch: true, art: "arc",
          cap: "A heavy rising strike.", idea: "Motors draw a big inrush current for a moment when they start." })],
      fin: { name: "Lights Out", in: ["F", "F", "B", "HK"], art: "bulb", text: "Every bulb in the arena pops at once; they sit in the dark until NEPA brings light." },
      sup: { name: "Total Overload", kind: "rush", art: "burst", cap: "Everything plugged into one socket at once.", idea: "Overloading a circuit is why breakers exist." } }
  ];
  var ORIG = ORDER.slice();
  ROSTER2.forEach(function (r) {
    var f = r.f; f.look = Object.assign({ id: r.id, guest: false }, r.look); FIGHTERS[r.id] = f;
    SPECIALS[r.id] = r.sp; FINISHERS[r.id] = r.fin;
    if (f.boss) BOSSES.push(r.id); else ORDER.push(r.id);
  });
  ORDER.splice(ORDER.indexOf("static"), 1); ORDER.push("static"); // the rival comes last on the select screen
  // Personalities for the first ten (the new ones carry their own): who rushes, who keeps away, who grabs.
  var AIP = { newton: "balanced", tesla: "zoner", einstein: "zoner", curie: "tricky", faraday: "grappler", bohr: "grappler", groove: "rush", kai: "rush", inertia: "grappler", entropy: "tricky" };
  Object.keys(AIP).forEach(function (id) { if (!FIGHTERS[id].ai) FIGHTERS[id].ai = AIP[id]; });
  /* Supers: a full meter (100 %) and ↓→↓→ + HK, or ★ + block on a phone. One per fighter; a big, labelled metaphor. */
  var SUPER_DEF = {
    newton: { name: "Principia", kind: "rush", art: "apple", cap: "An orchard's worth of momentum.", idea: "F = dp/dt: a big change of momentum needs a big force or a long time." },
    tesla: { name: "Wardenclyffe", kind: "beam", art: "ray", cap: "The tower he never finished, finished.", idea: "Tesla's Wardenclyffe tower (1901–17) was meant for wireless power; it never worked as planned." },
    einstein: { name: "Annus Mirabilis", kind: "beam", art: "photon", cap: "Four big ideas in one blast.", idea: "In 1905 he published on the photoelectric effect, Brownian motion, special relativity and E = mc²." },
    curie: { name: "Two Nobels", kind: "rush", art: "glow2", cap: "Physics and chemistry, back to back.", idea: "Curie won Nobel prizes in physics (1903) and chemistry (1911)." },
    faraday: { name: "Dynamo", kind: "beam", art: "coil", cap: "A spinning disc of current.", idea: "Faraday's disc (1831) was the first electric generator." },
    bohr: { name: "Quantum Leap", kind: "rush", art: "levels", cap: "Up every energy level at once.", idea: "An electron jumping down a level emits a photon of energy hf." },
    groove: { name: "Drop the Bass", kind: "rush", art: "disco", cap: "The whole floor bounces.", idea: "Low notes have long wavelengths: a 50 Hz bass note is about 6.9 m long." },
    kai: { name: "Thousand Palms", kind: "rush", art: "flurry", cap: "Too many palms to count.", idea: "Many small impulses add up to a big change in momentum." },
    inertia: { name: "Immovable", kind: "rush", art: "ball", cap: "A heavyweight who will not stop.", idea: "An object keeps moving unless a net force acts (Newton's first law)." },
    entropy: { name: "Heat Death", kind: "beam", art: "ray2", cap: "Everything runs down at once.", idea: "In a closed system entropy never decreases." }
  };
  ROSTER2.forEach(function (r) { SUPER_DEF[r.id] = r.sup; });
  var SUPERS = {};
  Object.keys(SUPER_DEF).forEach(function (id) {
    var d = SUPER_DEF[id], beam = d.kind === "beam";
    SUPERS[id] = S({ id: "super", name: d.name, in: ["D", "F", "D", "F", "HK"], sc: null, kind: d.kind, art: d.art, cap: d.cap, idea: d.idea, super: true,
      st: beam ? 14 : 8, act: beam ? 20 : 26, rec: 30, dmg: beam ? 22 : 7, n: beam ? 1 : 4, J: beam ? 380 : 140, dt: beam ? 0.02 : 0.012, v: 6.5, reach: beam ? 8 : 0.75, h: 1.25, hr: beam ? 0.5 : 0.9,
      ang: 30, kd: true, inv: 12, armor: !beam, hs: 34, bs: 16 });
  });
  var SUPER_COST = 100;

  /* ---------- summary for tests / move lists ---------- */
  function allMoves() {
    var out = [];
    Object.keys(NORMALS).forEach(function (k) { out.push(Object.assign({ who: "all", id: k }, NORMALS[k])); });
    Object.keys(SPECIALS).forEach(function (who) { SPECIALS[who].forEach(function (s) { out.push(Object.assign({ who: who }, s)); }); });
    Object.keys(SUPERS).forEach(function (who) { out.push(Object.assign({ who: who }, SUPERS[who])); });
    Object.keys(WEAPONS).forEach(function (k) { out.push(Object.assign({ who: "weapon", id: k }, WEAPONS[k])); });
    return out;
  }
  // Play a whole match with both sides on CPU (used by tests and the attract demo).
  function simulate(p1, p2, o) {
    o = o || {}; var m = create({ p1: p1, p2: p2, seed: o.seed || 7, mode: "versus", weapons: o.weapons !== false, p1o: { cpu: true, skill: o.s1 == null ? 0.6 : o.s1 }, p2o: { cpu: true, skill: o.s2 == null ? 0.6 : o.s2 } });
    var steps = 0, max = (o.maxSeconds || 600) * 120, stuck = 0, worst = { st: "", t: 0 }, states = {}, events = {};
    while (m.phase !== "over" && steps < max) {
      step(m, [{}, {}], 1 / 120); steps++;
      m.ev.forEach(function (e) { events[e.type] = (events[e.type] || 0) + 1; }); m.ev = [];
      m.f.forEach(function (f) {
        states[f.st] = (states[f.st] || 0) + 1;
        var timed = { attack: 1, special: 1, hitstun: 1, blockstun: 1, juggle: 1, knockdown: 1, getup: 1, backdash: 1, throw: 1, held: 1, air: 1 };
        if (timed[f.st] && f.t > worst.t) worst = { st: f.st, t: f.t, wall: f.stateT };
      });
    }
    return { over: m.phase === "over", seconds: steps / 120, winner: m.winner, rounds: m.rounds, wins: [m.f[0].wins, m.f[1].wins], worst: worst, states: states, events: events };
  }

  return { FPS: FPS, PHYS: PHYS, BTN: BTN, FIGHTERS: FIGHTERS, ORDER: ORDER, BOSSES: BOSSES, NORMALS: NORMALS, CHAINS: CHAINS, SPECIALS: SPECIALS, FINISHERS: FINISHERS,
    WEAPONS: WEAPONS, ARENAS: ARENAS, ARENA: ARENA, tower: tower, SKILL: SKILL, DIFFICULTY: DIFFICULTY, create: create, forceRound: forceRound, step: step, seqMatch: seqMatch, seqString: seqString,
    validInput: validInput, SUPERS: SUPERS, SUPER_COST: SUPER_COST, ORIG: ORIG, ROSTER2: ROSTER2.map(function (r) { return r.id; }), cpuCtrl: cpuCtrl, advantage: advantage, frames: frames, allMoves: allMoves, simulate: simulate, isFree: isFree, height: height, rng: rng, FREE: FREE };
});
