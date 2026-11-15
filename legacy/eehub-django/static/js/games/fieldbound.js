/* Volt City: an open-world-lite electrostatics adventure (PHYS 122: Coulomb's law, superposition, fields, potential,
 * capacitance, induction). The hero's Volt Pack carries ±25 µC; flipping its sign makes charged pylons attract or repel
 * the hero (F = kqQ/r², summed over every pylon), which is how you slingshot over water, push charged crates and herd
 * Count Entropy's charged sparks into lightning rods. World, physics and challenge data live in voltworld.js; the
 * probe-steering relay puzzles live in fieldsim.js. Both are also checked by node tests. */
(function () {
  "use strict";
  var A = window.Arcade, ME = document.currentScript && document.currentScript.src;
  function need(list, done) { // the catalogue normally loads fieldsim + voltworld first; load any that are missing
    var miss = list.filter(function (n) { return !window[n[0]]; }); if (!miss.length) return done();
    var left = miss.length, base = ME ? ME.replace(/[^\/]*$/, "") : "/static/js/games/", qs = ME && ME.indexOf("?") > 0 ? ME.slice(ME.indexOf("?")) : "";
    miss.forEach(function (n) { var s = document.createElement("script"); s.src = base + n[1] + ".js" + qs; s.onload = function () { if (--left === 0) done(); };
      s.onerror = function () { var st = document.querySelector("[data-gm-overlay]"); if (st) { st.hidden = false; st.innerHTML = "<div class='gm-dlg'><h2>Volt City could not load</h2><p>A game file (" + n[1] + ".js) did not arrive. Check the connection and reload the page.</p></div>"; } };
      document.head.appendChild(s); });
  }
  need([["VoltSim", "fieldsim"], ["VoltWorld", "voltworld"], ["VoltLab", "voltlab"]], start);

  function start() {
  var V = window.VoltWorld, PS = window.VoltSim, VL = window.VoltLab, T = 48, UC = 1e-6, PI2 = Math.PI * 2;
  var DIST = V.DISTRICTS, DBY = {}; DIST.forEach(function (d, i) { d.i = i; DBY[d.id] = d; });
  var ZONE_D = {}; DIST.forEach(function (d) { ZONE_D[d.zone] = d; });
  var save = Object.assign({ done: [], tasks: {}, crystals: [], bonus: 0, trail: "none", who: A.store("kick-p1") || "einstein", intro: false, notes: [], talked: {}, rods: [],
    ring: [], outer: {}, volts: 0, shards: 0, ladder: 0, ladderBest: 0, up: {}, opt: { lines: true, arrow: true, pred: true, hud: "auto" }, ringNotes: [] }, A.store("volt2") || {});
  ["ring", "ringNotes"].forEach(function (k) { if (!Array.isArray(save[k])) save[k] = []; }); ["outer", "up"].forEach(function (k) { if (!save[k] || typeof save[k] !== "object") save[k] = {}; });
  save.opt = Object.assign({ lines: true, arrow: true, pred: true, hud: "auto" }, save.opt || {});
  function upLvl(id) { return save.up[id] || 0; }
  function maxHp() { return 5 + upLvl("cells"); }
  function persist() { A.store("volt2", save); }
  function isDone(id) { return save.done.indexOf(id) >= 0; }
  function restored() { return DIST.filter(function (d) { return isDone(d.id); }).length; }
  function crystalsHave() { return save.crystals.length + (save.bonus || 0); }
  function rand(seed) { var s = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- people, signs, lamps, enemies (positions in metres) ---------- */
  var NPCS = [
    { id: "mayor", name: "Mayor Okafor", x: 29.6, y: 23.1, look: { skin: "#8d5a3b", hair: "#1a1414", style: "bun", coat: "#1f6f5b", eye: "#1a1010" },
      lines: function (k) { return k === 0 ? ["Thank goodness you're here! Count Entropy drained every district's power into his Tower on the lake.",
        "Your Volt Pack carries a charge of 25 µC. Press flip and it swaps between + and −. Like charges repel, unlike charges attract: F = kqQ/r².",
        "Start with Relay Row, just south of the plaza. Its relays steer probe charges with electric fields. Follow the yellow arrow!"]
        : k < 6 ? ["You've restored " + k + " of 6 districts. Every district you light powers more pylons, and that opens new routes.", "If you're ever stuck, open the quest log (" + keyOf("log") + "): it can warp you back to the plaza."]
        : ["Volt City shines again! The crystals still hide around the city. Find them all to unlock every trail."]; } },
    { id: "torsion", name: "Prof. Torsion", x: 36.6, y: 22.3, look: { skin: "#f0c7a0", hair: "#d9d9d9", style: "receding", coat: "#5b4a8a", eye: "#2a2030" },
      lines: function () { return ["Try the practice pylon beside me. It holds −120 µC. Set your pack to + and walk near: you'll be pulled in.",
        "Now flip to −. Same signs repel, and you're thrown straight out along the line joining the charges. That's your slingshot.",
        "Coulomb published this inverse-square law in 1785 after measuring tiny forces with a torsion balance. Halve the distance and the force is four times bigger."]; } },
    { id: "zuri", name: "Zuri", x: 25.6, y: 22.6, look: { skin: "#6b4430", hair: "#141010", style: "dj", coat: "#ff6b9a", eye: "#1a1010" },
      lines: function () { return ["I collect charge crystals! There are 25 hidden around the city, some only reachable by slingshot.", "Every five crystals unlocks a new trail for your Volt Pack. Pick it in the quest log!"]; } },
    { id: "ada", name: "Ada the rod-keeper", x: 27.6, y: 31.2, look: { skin: "#f3d0b2", hair: "#b5651d", style: "bun", coat: "#c9a227", eye: "#2a2a2a" },
      lines: function () { return ["Those purple sparks are Entropy's: little floating charges. Touch one and you get zapped.",
        "Lightning rods are grounded conductors. Any charge that touches one drains away to earth. So does charge that falls into the water.",
        "Match a spark's sign to push it away, or take the opposite sign to pull it, with a rod standing between you."]; } },
    { id: "bisi", name: "Dockmaster Bisi", x: 10.6, y: 28.5, look: { skin: "#7a4a2e", hair: "#2a1c14", style: "band", coat: "#1f6fb2", eye: "#1a1010" },
      lines: function () { return ["A capacitor stores charge on two plates: q = CV. A 470 µF capacitor at 12 V holds 470 µ × 12 = 5.64 mC.",
        "The energy stored is U = ½CV². Double the voltage and you store four times the energy, so keep an eye on the voltage rating.",
        "Charging through a resistor is fast at first, then slows: V = Vs(1 − e^(−t/RC)). Let go of charge at the right moment."]; } },
    { id: "femi", name: "Gardener Femi", x: 12.6, y: 6.6, look: { skin: "#a86b4a", hair: "#3b2a1a", style: "wild", coat: "#2c6b3a", eye: "#1a1010" },
      lines: function () { return ["Every path in my garden follows an equipotential: a line of equal electric potential V.",
        "Moving a charge along an equipotential does no work: W = qΔV = 0. Climbing to higher V costs energy; going down gives it back.",
        "Field lines always cross equipotentials at right angles, like contour lines and the steepest way downhill."]; } },
    { id: "tesla", name: "Nikola (a stylised Tesla avatar)", x: 42.6, y: 12.5, look: A.byId.tesla,
      lines: function () { return ["Storm clouds build up huge charges. Lightning is the discharge between cloud and ground.",
        "A lightning rod gives that discharge an easy, safe path to earth, so it protects whatever stands near it.",
        "Place three rods on the pads. One must guard the generator from strikes; the others ground the sparks marching along the path."]; } },
    { id: "faraday", name: "Michael (a stylised Faraday avatar)", x: 49.6, y: 29.6, look: A.byId.faraday,
      lines: function () { return ["Bring a charged rod near a conductor and its free electrons shift: that's charging by induction.",
        "Earth the conductor while the rod is near, remove the earth, then remove the rod, and the conductor keeps a charge opposite to the rod's.",
        "Faraday's ice-pail experiment (1843) showed the induced charge equals the inducing charge. Try it in the lab."]; } },
    { id: "guard", name: "Barrier guard", x: 40.6, y: 25.5, look: { skin: "#d8a77a", hair: "#2a2a2a", style: "slick", coat: "#3a4a5a", eye: "#1a1010" },
      lines: function (k) { return k < 4 ? ["That purple wall is an Entropy barrier. It feeds off the storm over Rod Heights.", "Restore Rod Heights and it'll fade. Heights is across the river: the pylon at the plaza's north-east corner can fling you there once the Gardens are lit."]
        : ["The barrier's gone! The Induction Quarter is through there."]; } }
  ];
  var SIGNS = [
    { id: "coulomb", x: 27.5, y: 25.5, t: "Coulomb's law", b: "Two point charges q and Q a distance r apart push or pull each other with F = kqQ/r², where k = 8.99 × 10⁹ N·m²/C². Like signs repel, unlike signs attract, and the force acts along the line joining them." },
    { id: "super", x: 22.5, y: 28.5, t: "Superposition", b: "With several charges around, the force on yours is the vector sum of the separate Coulomb forces: F = F₁ + F₂ + … Each pylon pulls or pushes you independently." },
    { id: "field", x: 25.5, y: 30.5, t: "Field lines", b: "The electric field E = F/q is the force per coulomb on a small positive test charge. Field lines start on + charges and end on − charges; where they crowd together the field is stronger." },
    { id: "insul", x: 34.5, y: 33.5, t: "Conductors and insulators", b: "Metals let charge move freely; glass, rubber and dry wood do not. The glass fence around the crate is an insulator: it stops bodies, but electric fields pass straight through it." },
    { id: "cap", x: 9.5, y: 30.5, t: "Capacitors", b: "Two conducting plates separated by an insulator. Charge q = CV sits on them, and the energy stored is U = ½CV² = q²/2C. Capacitance is measured in farads (F); dock capacitors are hundreds of microfarads." },
    { id: "equi", x: 10.5, y: 12.5, t: "Equipotentials", b: "An equipotential is a surface of equal potential V. The work done moving charge q from one to another is W = qΔV; along one, ΔV = 0, so no work is done. For a point charge V = kQ/r, so equipotentials are circles." },
    { id: "rods", x: 37.5, y: 9.5, t: "Lightning rods", b: "A pointed, earthed metal rod. Charges collect densely at sharp points, so the field there is strongest and the air ionises first, giving lightning a safe path to ground." },
    { id: "scope", x: 50.5, y: 26.5, t: "Gold-leaf electroscope", b: "A metal cap joined to two thin leaves. Any charge on the leaves makes them repel and spread apart. Charge it by contact (touching) or by induction (near rod, earth, remove earth, remove rod)." },
    { id: "entropy", x: 31.5, y: 17.5, t: "Count Entropy", b: "Our villain is named after entropy, the thermodynamic measure of disorder. It's a story name only: real entropy doesn't drain power grids. Volt Pack polarity flipping is a game metaphor too." },
    { id: "units", x: 16.5, y: 19.5, t: "Game model and units", b: "1 tile = 1 m. Hero: 0.4 kg, ±25 µC. Pylons: ±120 µC. Ground friction μ = 0.8. Forces in newtons. Charges are treated as small spheres (r² softened by 0.3 m) and sources beyond 9 m are ignored. Real objects this charged would spark over." }
  ];
  var LAMPS = []; (function () { for (var y = 1; y < V.H - 1; y++) for (var x = 1; x < V.W - 1; x++) { if (V.tile(x, y) !== ".") continue;
    var side = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var t = V.tile(x + d[0], y + d[1]); return t === "," || t === "#" || t === ":"; });
    if (side && (x * 3 + y * 5) % 7 === 0) LAMPS.push({ x: x + .5, y: y + .5, z: V.zoneOf(x, y) }); } })();
  var SPAWNS = {
    relay: [["spark", 26.5, 30.6], ["spark", 33.5, 30.4], ["spark", 22.5, 34.5], ["flipper", 38.5, 37.5]],
    docks: [["drone", 13.5, 18.5], ["drone", 4.5, 29.5], ["spark", 13.5, 28.5], ["spark", 15.5, 36.5], ["spark", 3.5, 23.5]],
    gardens: [["flipper", 7.5, 5.5], ["flipper", 13.5, 7.5], ["spark", 4.5, 12.5], ["spark", 18.5, 8.5], ["drone", 12.5, 12.3]],
    heights: [["drone", 52.5, 6.5], ["drone", 40.5, 8.0]],
    quarter: [["drone", 55.5, 22.0], ["flipper", 49.5, 34.5], ["flipper", 55.5, 34.5], ["spark", 51.5, 31.5], ["spark", 49.5, 38.5], ["drone", 47.5, 23.0]]
  };
  var KIND = { spark: { q: 12e-6, m: 0.06, r: 0.22, acc: 7, vmax: 3.2, drag: 1.4, hp: 1, aggro: 7 }, flipper: { q: 16e-6, m: 0.12, r: 0.28, acc: 6, vmax: 3.6, drag: 1.2, hp: 1, aggro: 8 },
    drone: { q: 20e-6, m: 0.3, r: 0.34, acc: 5, vmax: 2.6, drag: 1.5, hp: 2, aggro: 9 }, bolt: { q: 6e-6, m: 0.02, r: 0.12, acc: 0, vmax: 9, drag: 0, hp: 1, aggro: 0 } };

  /* ---------- building blocks (2.5D) ---------- */
  var BLK = [], BOF = {};
  (function () { for (var y = 0; y < V.H; y++) for (var x = 0; x < V.W; x++) { if (V.MAP[y][x] !== "#" || BOF[x + "," + y]) continue;
    var b = { tiles: [], id: BLK.length }, st = [[x, y]]; BOF[x + "," + y] = b;
    while (st.length) { var c = st.pop(); b.tiles.push(c); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = c[0] + d[0], ny = c[1] + d[1], k = nx + "," + ny; if (V.MAP[ny] && V.MAP[ny][nx] === "#" && !BOF[k]) { BOF[k] = b; st.push([nx, ny]); } }); }
    var sx = 0, sy = 0; b.tiles.forEach(function (t) { sx += t[0]; sy += t[1]; }); b.cx = sx / b.tiles.length + .5; b.cy = sy / b.tiles.length + .5;
    b.zone = V.zoneOf(Math.floor(b.cx), Math.floor(b.cy)) || "hub"; b.h = 46 + Math.floor(rand(b.id + 3) * 64) + (b.zone === "quarter" ? 24 : 0); b.seed = rand(b.id * 7 + 1);
    BLK.push(b); } })();
  var PAL = { // ground, road, plaza, wall, roof, window tint
    hub: ["#2f5a3a", "#3a3f4b", "#77705f", "#5a5f73", "#7d8296", "#ffd86b"], relay: ["#33503c", "#363a46", "#5d5850", "#55546c", "#77769a", "#ffe08a"],
    docks: ["#2c4c45", "#3a3f46", "#5a564e", "#7a4c3a", "#9a6248", "#ffc56b"], gardens: ["#3b7d48", "#4a4a3e", "#6d6a52", "#5a6e58", "#7f9a7a", "#fff0a0"],
    heights: ["#5a5a3c", "#4a4438", "#6a6250", "#5e5866", "#837c8e", "#ffb070"], quarter: ["#363a5a", "#322e48", "#4c4766", "#4b3a6e", "#6f58a6", "#e3b6ff"],
    tower: ["#2e2040", "#2a2238", "#4a3560", "#3d1f5c", "#5c2f86", "#ff6b9a"] };
  function pal(z) { return PAL[z] || PAL.hub; }

  /* ---------- state ---------- */
  var S = { mode: "intro", introT: 0, cam: { x: 0, y: 0 }, fx: [], ens: [], msg: null, tod: .3, cine: null, td: null, boss: null, zone: "hub", trail: [], pred: null, predT: 0,
    open: {}, crates: [], checkpoint: V.START.slice(), lines: [], hint: {}, spawned: {} };
  if (save.tasks.gate) S.open["gate:36,38"] = true;
  S.crates = V.CRATES.map(function (c) { var o = Object.assign({ vx: 0, vy: 0, r: 0.35, crate: true }, c); if (save.tasks.gate) { o.x = 38.5; o.y = 34.4; } return o; });
  var h = V.newHero(V.START[0], V.START[1], 1); h.hp = maxHp(); h.inv = 0; h.dashCD = 0; h.face = 1; h.walk = 0; h.dashT = 0; S.h = h;
  function rebuild() {
    S.ws = V.makeState(restored(), { open: S.open }); S.static = S.ws.sources.slice(); S.ws.circles = S.ws.circles.concat(S.crates, [{ x: 33.5, y: 25.5, r: 0.7 }]);
    if (isDone("tower")) { for (var y = 7; y <= 16; y++) V.MAP[y][30] = y >= 10 && y <= 12 ? V.MAP[y][30] : "b"; }
    S.lines = []; S.ws.pylons.forEach(function (p) { if (p.on) S.lines.push({ p: p, lines: fieldLines(p) }); });
    S.mini = null;
  }
  function fieldLines(p) { // streamlines of E from the powered pylons, starting at this pylon
    var out = [], n = 12, dir = p.q > 0 ? 1 : -1;
    for (var i = 0; i < n; i++) { var a = i / n * PI2 + .13, x = p.x + Math.cos(a) * .45, y = p.y + Math.sin(a) * .45, pts = [[x, y]];
      for (var s = 0; s < 32; s++) { var E = V.fieldAt(x, y, S.static, .3, 9), m = Math.hypot(E[0], E[1]); if (m < 1) break; x += dir * E[0] / m * .15; y += dir * E[1] / m * .15; pts.push([x, y]);
        if (Math.hypot(x - p.x, y - p.y) > 4.2) break; var hitOther = S.static.some(function (o) { return o !== p && Math.hypot(o.x - x, o.y - y) < .4; }); if (hitOther) break; }
      out.push(pts); }
    return out;
  }
  var game, API;
  function keyOf(id) { return API ? API.keyName(id) : id; }
  function say(t, dur) { S.msg = { t: t, life: dur || 3.2 }; }
  /* Every Volt City dialog goes through dlg(). The shared Settings and Pause screens reuse the same overlay, so they can
     close one of our dialogs without its button being pressed; the game would then wait for a callback that never
     comes (a dead state). dlg() remembers the pending callback and update() runs it with `dflt` once the overlay is
     gone, so progress always continues. */
  function dlg(api, html, fn, dflt) {
    var pend = function () { if (fn) fn(dflt || "close", null); }; S.after = pend;
    api.show(html, function (a, el) { S.after = null; if (fn) fn(a, el); if (!S.after && api.overlayOpen() && a !== "close") S.after = pend; });
  }

  /* ---------- objectives ---------- */
  function pyl(id) { return V.PYLONS.filter(function (p) { return p.id === id; })[0]; }
  function con(id) { return V.CONSOLES.filter(function (c) { return c.id === id; })[0]; }
  function zoneHere() { return V.zoneOf(Math.floor(h.x), Math.floor(h.y)); }
  function areaHere() { return V.areaOf(Math.floor(h.x), Math.floor(h.y)); }
  function objective() {
    var z = zoneHere(), a = areaHere(), P;
    if (!save.talked.mayor) return { d: null, t: "Central Plaza", s: "Talk to Mayor Okafor (" + keyOf("interact") + ")", x: 29.6, y: 23.1 };
    if (!isDone("relay")) { var d = DBY.relay;
      if (!save.tasks.relayA) { if (a !== "pond-island") { P = pyl("pond-w"); return { d: d, t: d.name, s: "Slingshot from the pond pylon to Relay A", x: P.x, y: P.y }; } return { d: d, t: d.name, s: "Restart Relay A", x: 28.5, y: 34.5 }; }
      if (!save.tasks.gate) return { d: d, t: d.name, s: "Push the charged crate onto the plate", x: 37.5, y: 33 };
      return { d: d, t: d.name, s: "Restart Relay B behind the gate", x: 39.5, y: 38.5 }; }
    if (!isDone("docks")) { d = DBY.docks; if (z !== "docks") { P = pyl("plaza-w"); return { d: d, t: d.name, s: "Slingshot over the canal from the plaza's west pylon", x: P.x, y: P.y }; }
      return { d: d, t: d.name, s: "Charge the dock capacitor bank", x: 7.5, y: 28.5 }; }
    if (!isDone("gardens")) { d = DBY.gardens; if (z === "gardens") return { d: d, t: d.name, s: "Walk the equipotentials at the gazebo", x: 11.5, y: 5.5 };
      if (z === "docks") { P = pyl("docks-n"); return { d: d, t: d.name, s: "Slingshot north over the river", x: P.x, y: P.y }; }
      P = pyl("plaza-w"); return { d: d, t: d.name, s: "Go back to the Docks (west pylon)", x: P.x, y: P.y }; }
    if (!isDone("heights")) { d = DBY.heights; if (z !== "heights") { P = pyl("plaza-ne"); return { d: d, t: d.name, s: "Slingshot north from the plaza's north-east pylon", x: P.x, y: P.y }; }
      if (S.td) return { d: d, t: d.name, s: "Defend the generator! Wave " + Math.min(3, S.td.wave + 1) + "/3", x: V.TD.gen[0], y: V.TD.gen[1] };
      if (save.rods.length < V.TD.rods) { var pad = V.TD.pads.map(function (p, i) { return i; }).filter(function (i) { return save.rods.indexOf(i) < 0; }).sort(function (i, j) { return dist(V.TD.pads[i]) - dist(V.TD.pads[j]); })[0];
        return { d: d, t: d.name, s: "Place lightning rods on the pads (" + save.rods.length + "/" + V.TD.rods + ")", x: V.TD.pads[pad][0], y: V.TD.pads[pad][1] }; }
      return { d: d, t: d.name, s: "Start the storm at the generator", x: V.TD.gen[0], y: V.TD.gen[1] }; }
    if (!isDone("quarter")) { d = DBY.quarter; if (z !== "quarter") return { d: d, t: d.name, s: "The barrier is down: head east", x: 43, y: 23.5 };
      return { d: d, t: d.name, s: "Charge the electroscope in the lab", x: 51.5, y: 28.5 }; }
    if (!isDone("tower")) { d = DBY.tower; if (a === "tower") return { d: d, t: d.name, s: S.boss ? "Ground Count Entropy on a lightning rod!" : "Face Count Entropy", x: S.boss ? S.boss.x : 29.5, y: S.boss ? S.boss.y : 4.5 };
      if (a === "islet") { P = pyl("islet"); return { d: d, t: d.name, s: "Walk round to the islet pylon's north side, then flip", x: P.x, y: P.y - .7 }; }
      P = pyl("plaza-n"); return { d: d, t: d.name, s: "Slingshot to the Tower islet (plaza north pylon)", x: P.x, y: P.y }; }
    var nextRing = OUT.filter(function (o) { return !ringDone(o.id); })[0];
    if (nextRing) return { d: null, t: "The Outer Ring", s: "Open the city map (" + keyOf("log") + ") and ride the tram to " + nextRing.name, x: null };
    var left = V.CRYSTALS.map(function (c, i) { return i; }).filter(function (i) { return save.crystals.indexOf(i) < 0; });
    if (left.length) { var c = left.sort(function (i, j) { return dist(V.CRYSTALS[i]) - dist(V.CRYSTALS[j]); })[0]; return { d: null, t: "Free roam", s: "Find the charge crystals (" + save.crystals.length + "/" + V.CRYSTALS.length + ")", x: V.CRYSTALS[c][0], y: V.CRYSTALS[c][1] }; }
    return { d: null, t: "Volt City", s: "Every light is on. You beat entropy (for now).", x: null };
  }
  function dist(p) { return Math.hypot(p[0] - h.x, p[1] - h.y); }

  /* ---------- particles (world space) ---------- */
  function puff(x, y, col, n, sp, life) { if (API && API.reduce) n = Math.min(n, 4); for (var i = 0; i < n; i++) { var a = Math.random() * PI2, v = (sp || 3) * (.3 + Math.random()); S.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (life || .6) * (.6 + Math.random() * .6), col: col, s: 2 + Math.random() * 3 }); } }

  /* ---------- hero actions ---------- */
  function flip(api) {
    h.q = -h.q; api.sound.sfx("zap"); puff(h.x, h.y, h.q > 0 ? "#ff7b7b" : "#7bb0ff", 14, 3, .5); api.buzz(12);
    if (h.touch && h.touch.pylon && h.touch.on && h.q * h.touch.q > 0) { api.sound.sfx("dash"); api.kick(4); if (!S.hint.launch) { S.hint.launch = 1; } }
  }
  function hurt(api, n, from) {
    if (h.inv > 0 || S.cine) return; if (!(CT.god || heroOn())) h.hp -= n; h.inv = 1.3; api.sound.sfx("hit"); api.kick(8); api.buzz(40); api.flash("#ff3355", .15); puff(h.x, h.y, "#ffd84a", 10, 4);
    if (from) { var dx = h.x - from.x, dy = h.y - from.y, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 5; h.vy += dy / d * 5; }
    if (h.hp <= 0) knockout(api);
  }
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["94f70287837c8b9f70dc3c76e7b931fbdeaecb8c2255ce101e36eeeacc1aacc2","80bb9a7b5d2c130c901812a223e6a02f89042b323105a444b9395d6d9e112319"],"god":["98ca1ee35e581fc9f3885b5abfff2bd490f16c05db985ab36d96f2bcea9b8626","395b0165fa23ef66aef5ce1a634b8c4186a72604d6c1de7f8a0c6cf3369b8998"],"heal":["f981bdc070591e6a26b393cd4d133b830eb5e4f0609f4d68ad53dc90ba6ba841","0bd5049c14001095fb0d4ad8a56497c3a69e31a1d1eaaff9b00057ac3b3eaa06"],"dash":["2d72c60097501004f55c8384496db4bc5793df76bbb452e05601f976b300afbc","507dc34b39bc3d9496f2e4df49f9e4403f3ba6c5010ea3f98d41595697176c47"],"slow":["3fa96a59f17bc73713e4327c2c67f89444240bcd5419d7ab9fe6caa9f7466ed7","f6bc98adf13ea0cab0a0e3c10c5f7d4f45d6c1957ac4317aca91beee38bc5de1"],"party":["83ce76c0ec190de896f34abfc418d3545038073374ed278664334f7c9ef30abb","7235490e7260420bac7e655a22fc03d6a72c5fe988739be96f6a8107a111be5a"],"_combo":"4efc6cb0dd4d530e9dead3e1a3a558c9cdb41744e307f5906df8617f3b436466","_swipe":"e8d93fb5c43885def986321a12f4c136d1959138a6c232769b2215931587fbe9"}/*]CH*/, CT = {};
  function heroOn() { return !!(API && API.hero.active && save.who === "mib"); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Restore the next district", h: CH.skip, run: function () {
        if (S.cine) return; var map = { relay: ["relayA", "relayB"], docks: ["cap"], gardens: ["equi"], heights: ["td"], quarter: ["scope"], tower: ["boss"] }, d = DIST.filter(function (o) { return !isDone(o.id); })[0];
        if (!d) { var od = OUT.filter(function (o) { return !ringDone(o.id); })[0]; if (!od) return; save.outer[od.id] = {}; od.puzzles.forEach(function (sp, i) { save.outer[od.id][i] = 1; }); return restoreRing(api, od); }
        map[d.id].forEach(function (t) { save.tasks[t] = 1; }); complete(api, map[d.id][0]); } },
      god: { label: "Cannot be hurt", h: CH.god, run: function () { CT.god = 1; } },
      heal: { label: "Battery full", h: CH.heal, run: function () { h.hp = maxHp(); } },
      dash: { label: "Dash never cools down", h: CH.dash, run: function () { CT.dash = 1; } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { if (game.menu) game.menu(api); } });
  }
  function cheatTick(api) { var hx = heroOn(); if (api.hero.inUse !== hx) api.hero.use(hx); if (CT.dash || hx) h.dashCD = 0; }
  function knockout(api) {
    api.banner("ZAPPED!", { col: "#c084fc", edge: "#3d1f5c", sad: true, size: 96, sub: "Back to the last checkpoint", dur: 1.8 }); api.sound.sfx("ko"); api.slowmo(.4, .5); api.flash("#3d1f5c", .5); api.kick(8); api.buzz(160); api.sound.roar(true);
    h.hp = maxHp(); h.x = S.checkpoint[0]; h.y = S.checkpoint[1]; h.vx = h.vy = 0; h.inv = 2; S.ens = []; S.spawned = {}; if (S.td) { S.td = null; say("The storm generator reset. Try again."); }
    if (S.boss) { S.boss.x = 29.5; S.boss.y = 3.5; S.boss.vx = S.boss.vy = 0; }
  }

  /* ---------- enemies ---------- */
  function spawnZone(z) {
    if (S.spawned[z] || !SPAWNS[z] || isDone(ZONE_D[z].id)) return; S.spawned[z] = true;
    SPAWNS[z].forEach(function (s, i) { addEnemy(s[0], s[1], s[2], (i % 2 ? -1 : 1), z); });
  }
  function addEnemy(type, x, y, sign, z) { var k = KIND[type]; var e = { type: type, x: x, y: y, vx: 0, vy: 0, q: sign * k.q, m: k.m, r: k.r, hp: k.hp, t: Math.random() * 3, home: [x, y], z: z, stun: 0, shot: 1.5 + Math.random(), flipT: 3, life: 3 }; S.ens.push(e); return e; }
  function pop(api, e, why) {
    var i = S.ens.indexOf(e); if (i >= 0) S.ens.splice(i, 1); puff(e.x, e.y, e.q > 0 ? "#ff8a8a" : "#8ab4ff", e.type === "bolt" ? 5 : 16, 4, .7);
    if (e.type !== "bolt") { api.sound.sfx(why === "rod" ? "zap" : "stomp"); if (why) floatText(e.x, e.y - .4, why === "rod" ? "Grounded!" : why === "water" ? "Earthed in water" : why === "pylon" ? "Neutralised" : "Bonk!", "#fff"); }
  }
  var TEXTS = [];
  function floatText(x, y, t, col) { TEXTS.push({ x: x, y: y, t: t, col: col || "#fff", life: 1.3 }); }
  function enemyStep(api, e, dt) {
    var k = KIND[e.type], dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy);
    e.t += dt; if (e.stun > 0) e.stun -= dt;
    if (e.type === "flipper") { e.flipT -= dt; if (e.flipT <= 0) { e.q = -e.q; e.flipT = 3; puff(e.x, e.y, "#fff", 6, 2); } }
    if (e.type === "bolt") { e.life -= dt; if (e.life <= 0) return pop(api, e); }
    var F = V.coulomb(e.q, h.q, dx, dy, .3), Fp = V.forceOn(e.x, e.y, e.q, S.static, .3, 9), ax = (F[0] + Fp[0]) / e.m, ay = (F[1] + Fp[1]) / e.m;
    for (var i = 0; i < V.RODS.length; i++) { var r = V.RODS[i], rx = r.x - e.x, ry = r.y - e.y, rd = Math.hypot(rx, ry); // image-charge pull of a grounded rod
      if (rd < 1.2) { var fi = V.imageForce(e.q, Math.max(.3, rd)) / e.m; ax += rx / rd * fi; ay += ry / rd * fi; }
      if (rd < .45) return pop(api, e, "rod"); }
    if (k.acc && e.stun <= 0) { var tx, ty;
      if (d < k.aggro && (e.type !== "drone" || d > 4)) { tx = -dx / (d || 1); ty = -dy / (d || 1); }
      else if (e.type === "drone" && d < k.aggro) { tx = -dy / d; ty = dx / d; } // drones circle-strafe
      else { var hx = e.home[0] + Math.cos(e.t * .7) * 1.2 - e.x, hy = e.home[1] + Math.sin(e.t * .9) * 1.2 - e.y, hm = Math.hypot(hx, hy) || 1; tx = hx / hm; ty = hy / hm; }
      ax += tx * k.acc; ay += ty * k.acc;
      if (e.type === "drone" && d < k.aggro) { e.shot -= dt; if (e.shot <= 0) { e.shot = 2.4; var b = addEnemy("bolt", e.x, e.y, Math.sign(e.q), e.z); b.vx = -dx / d * 5.5; b.vy = -dy / d * 5.5; api.sound.sfx("laser"); } } }
    ax -= e.vx * k.drag; ay -= e.vy * k.drag;
    e.vx += ax * dt; e.vy += ay * dt; var sp = Math.hypot(e.vx, e.vy), cap = e.stun > 0 || sp > k.vmax * 2 ? 12 : Math.max(k.vmax, Math.min(12, sp)); if (sp > cap) { e.vx *= cap / sp; e.vy *= cap / sp; }
    if (sp > k.vmax && k.acc) { e.vx *= 1 - dt * 1.2; e.vy *= 1 - dt * 1.2; }
    var nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    function solid(x, y) { return S.ws.solidTile(Math.floor(x), Math.floor(y)); }
    if (solid(nx, e.y)) { if (Math.abs(e.vx) > 4.5 && e.type !== "bolt") wallHit(api, e); e.vx *= -.5; if (e.type === "bolt") return pop(api, e); } else e.x = nx;
    if (solid(e.x, ny)) { if (Math.abs(e.vy) > 4.5 && e.type !== "bolt") wallHit(api, e); e.vy *= -.5; if (e.type === "bolt") return pop(api, e); } else e.y = ny;
    if (S.ens.indexOf(e) < 0) return;
    if (V.tile(Math.floor(e.x), Math.floor(e.y)) === "~" && e.type !== "bolt") return pop(api, e, "water");
    for (var j = 0; j < S.ws.pylons.length; j++) { var p = S.ws.pylons[j]; if (!p.on) continue; var pd = Math.hypot(p.x - e.x, p.y - e.y);
      if (pd < p.r + e.r) { if (p.q * e.q < 0 && e.type !== "drone") return pop(api, e, "pylon"); var nu = [(e.x - p.x) / pd, (e.y - p.y) / pd]; e.x = p.x + nu[0] * (p.r + e.r); e.y = p.y + nu[1] * (p.r + e.r); } }
    if (d < k.r + V.HERO.r && h.inv <= 0) { hurt(api, 1, e); if (e.type !== "drone") pop(api, e); }
  }
  function wallHit(api, e) { e.hp--; e.stun = 1.2; api.sound.sfx("bounce"); puff(e.x, e.y, "#fff", 6, 2); if (e.hp <= 0) pop(api, e, "wall"); }

  /* ---------- Count Entropy (boss) ---------- */
  function bossStart(api) {
    S.boss = { x: 29.5, y: 3.6, vx: 0, vy: 0, q: 60e-6, m: 0.8, hp: 4, max: 4, st: "float", t: 0, next: 2.5, stun: 0, tx: 29.5, ty: 4, warn: 0 };
    api.music(A.song(806, "boss", { bpm: 138 })); api.banner("COUNT ENTROPY", { col: "#c084fc", edge: "#2a0f40", size: 92, sub: "Ground him on his own lightning rods!", dur: 2.6 });
    api.sound.say("Count Entropy! Lure him into a lightning rod."); say("Stand near a rod. Take the OPPOSITE sign to pull him in, then dash aside!", 5);
  }
  function bossStep(api, dt) {
    var b = S.boss; b.t += dt; var dx = b.x - h.x, dy = b.y - h.y, d = Math.hypot(dx, dy) || .01;
    var F = V.coulomb(b.q, h.q, dx, dy, .3), ax = F[0] / b.m, ay = F[1] / b.m;
    if (b.stun > 0) { b.stun -= dt; if (b.stun <= 0) { b.q = (Math.random() < .5 ? 1 : -1) * 60e-6; b.st = "float"; b.next = 1.6; floatText(b.x, b.y - 1, "Recharged " + (b.q > 0 ? "+" : "−") + "60 µC", "#ffb3d1"); } }
    else {
      V.RODS.forEach(function (r) { if (r.y > 8) return; var rx = r.x - b.x, ry = r.y - b.y, rd = Math.hypot(rx, ry); if (rd < 1.3) { var fi = V.imageForce(b.q, Math.max(.35, rd)) / b.m; ax += rx / rd * fi; ay += ry / rd * fi; }
        if (rd < .55 && b.q) { bossHit(api, r); } });
      if (!S.boss) return;
      b.next -= dt; var spd = 1 + (b.max - b.hp) * .3;
      if (b.st === "float") { var tx = b.tx - b.x, ty = b.ty - b.y, tm = Math.hypot(tx, ty) || 1; ax += tx / tm * 4 * spd; ay += ty / tm * 4 * spd; if (tm < .5) { b.tx = 27.5 + Math.random() * 4; b.ty = 3.4 + Math.random() * 2.2; }
        if (b.next <= 0) { var r = Math.random(); b.st = r < .5 ? "aim" : r < .78 ? "ring" : "flip"; b.warn = b.st === "aim" ? .7 : .8; } }
      else if (b.st === "aim") { b.warn -= dt; b.vx *= .9; b.vy *= .9; if (b.warn <= 0) { b.st = "lunge"; b.lt = .55; b.vx = -dx / d * 7.5 * spd; b.vy = -dy / d * 7.5 * spd; api.sound.sfx("dash"); } }
      else if (b.st === "lunge") { b.lt -= dt; if (b.lt <= 0) { b.st = "float"; b.next = 2.2 / spd; } }
      else if (b.st === "ring") { b.warn -= dt; if (b.warn <= 0) { var n = 7 + (b.max - b.hp) * 2; for (var i = 0; i < n; i++) { var a = i / n * PI2, s = addEnemy("bolt", b.x + Math.cos(a) * .6, b.y + Math.sin(a) * .6, Math.sign(b.q), "tower"); s.vx = Math.cos(a) * 4.5; s.vy = Math.sin(a) * 4.5; s.life = 2.2; }
          api.sound.sfx("special"); b.st = "float"; b.next = 2.6 / spd; if (b.hp < b.max && S.ens.filter(function (e) { return e.type === "spark"; }).length < 2) addEnemy("spark", 29.5, 3, -Math.sign(b.q), "tower"); } }
      else if (b.st === "flip") { b.warn -= dt; if (b.warn <= 0) { b.q = -b.q; api.sound.sfx("zap"); floatText(b.x, b.y - 1, "Polarity " + (b.q > 0 ? "+" : "−"), "#fff"); b.st = "float"; b.next = 1.8 / spd; } }
    }
    ax -= b.vx * (b.st === "lunge" ? .4 : 2); ay -= b.vy * (b.st === "lunge" ? .4 : 2);
    b.vx += ax * dt; b.vy += ay * dt; var sp = Math.hypot(b.vx, b.vy); if (sp > 11) { b.vx *= 11 / sp; b.vy *= 11 / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 25.6) { b.x = 25.6; b.vx = Math.abs(b.vx) * .5; } if (b.x > 33.4) { b.x = 33.4; b.vx = -Math.abs(b.vx) * .5; }
    if (b.y < 2.4) { b.y = 2.4; b.vy = Math.abs(b.vy) * .5; } if (b.y > 6.6) { b.y = 6.6; b.vy = -Math.abs(b.vy) * .5; }
    if (d < .75 && b.stun <= 0) hurt(api, 1, b);
  }
  function bossHit(api, rod) {
    var b = S.boss; b.hp--; b.stun = 2.2; b.q = 0; b.st = "stun"; b.vx *= -.3; b.vy *= -.3;
    api.hitstop(.12); api.slowmo(.35, .7); api.zoom(.12, b.x * T - S.cam.x, b.y * T - S.cam.y); api.flash("#ffffff", .2); api.kick(14); api.sound.sfx("heavy"); api.buzz([30, 40, 60]);
    S.bolts = { x: rod.x, y: rod.y, t: .5 }; puff(b.x, b.y, "#ffd84a", 30, 6, .9);
    if (b.hp > 0) { api.banner("GROUNDED!", { col: "#7ef0ff", edge: "#0b3a5c", size: 104, sub: b.hp + " to go", dur: 1.4 }); api.sound.say("Grounded!"); return; }
    api.banner("ENTROPY DEFEATED", { col: "#ffd84a", size: 84, sub: "His charge drained to earth", dur: 3 });
    S.ens = S.ens.filter(function (e) { return e.z !== "tower"; }); S.bossGone = { x: b.x, y: b.y, t: 0 }; S.boss = null;

  }

  /* ---------- districts: completion, restoration cinematic ---------- */
  function complete(api, task) {
    save.tasks[task] = 1; persist();
    var map = { relay: ["relayA", "relayB"], docks: ["cap"], gardens: ["equi"], heights: ["td"], quarter: ["scope"], tower: ["boss"] };
    DIST.forEach(function (d) { if (!isDone(d.id) && map[d.id].every(function (t) { return save.tasks[t]; })) restore(api, d); });
  }
  function restore(api, d) {
    save.done.push(d.id); persist(); rebuild(); S.ens = S.ens.filter(function (e) { if (e.z === d.zone) { puff(e.x, e.y, "#fff", 8, 3); return false; } return true; });
    var score = 300 + h.hp * 50 + crystalsHave() * 10;
    if (A.report) A.report("volt-city", { result: "win", stage: d.stage, score: score });
    S.cine = { d: d, t: 0, dur: 4.6, cam0: { x: S.cam.x, y: S.cam.y } };
    BLK.forEach(function (b) { if (b.zone === d.zone || (d.id === "tower" && b.zone === "hub")) b.lit = .5 + Math.hypot(b.cx - d.center[0], b.cy - d.center[1]) * .09 + rand(b.id) * .35; });
    api.sound.sfx("power");
  }
  function cineStep(api, dt) {
    var c = S.cine, d = c.d; c.t += dt;
    if (c.t > 1.2 && !c.cheer) { c.cheer = 1; api.sound.roar(); api.sound.say(d.name + " restored!"); api.buzz([20, 30, 20]); }
    if (c.t > c.dur) { S.cine = null; api.sound.crowd(0); afterRestore(api, d); }
  }
  function afterRestore(api, d) {
    var k = restored(), next = DIST[k], recap = {
      relay: "You steered probe charges with fields you built yourself. Every charge pushed or pulled the probe along the line joining them, and the forces added as vectors (superposition).",
      docks: "You charged capacitors through a resistor and stopped at the right moment: q = CV for the charge and U = ½CV² for the energy. In series capacitances combine as 1/C = 1/C₁ + 1/C₂, in parallel they add.",
      gardens: "You walked the equipotentials. Along one, ΔV = 0 so no work is done; climbing ΔV took W = qΔV from your battery, and going down gave it back.",
      heights: "Lightning rods are earthed conductors: they give charge an easy path to ground and protect what stands near them.",
      quarter: "You charged an electroscope by contact (it takes the rod's sign) and by induction (it ends with the opposite sign).",
      tower: "Count Entropy's charge drained to earth through his own lightning rods. Volt City is whole again!" }[d.id];
    api.music(songFor(zoneHere()));
    var whoC = A.styled ? A.styled(A.byId[save.who] || A.CAST[0]) : A.byId[save.who];
    api.ceremony(next ? "stageClear" : "gameComplete", { title: next ? "RESTORED!" : "CITY RESTORED!", sub: d.name, hero: whoC, trophy: next ? "star" : "crown", colors: [d.col, "#ffd86b", "#7ef0ff", "#ffffff"], len: next ? 2.8 : 6,
      score: 300 + h.hp * 50 + crystalsHave() * 10, scoreLabel: "District score", stats: [["District", d.stage + " of " + DIST.length], ["Crystals", crystalsHave()], ["Battery", h.hp + " / " + maxHp()]],
      line: next ? "The lights are back on in " + d.name + "." : "All six districts are lit. Count Entropy's charge has gone to earth.", then: function () {
    dlg(api, "<h2>" + A.esc(d.name) + " restored</h2><p>" + A.esc(recap) + "</p>" + (next ? "<p><b>Next:</b> " + A.esc(next.name) + ". " + A.esc(next.blurb) + " New pylons now have power: follow the arrow.</p>"
      : "<p><b>All six districts are lit.</b> Keep exploring for charge crystals, or replay the challenges.</p>") +
      "<p class='gm-small'>District " + d.stage + " of " + DIST.length + " · crystals " + crystalsHave() + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Onward</button></div>", function () { api.hide(); setPad(api, "world"); }); } });
  }

  /* ---------- interaction ---------- */
  function nearest() {
    var best = null, bd = 1.35;
    function test(o, kind, x, y) { var dd = Math.hypot(x - h.x, y - h.y); if (dd < bd) { bd = dd; best = { o: o, kind: kind }; } }
    NPCS.forEach(function (n) { test(n, "npc", n.x, n.y); });
    SIGNS.forEach(function (s) { test(s, "sign", s.x, s.y); });
    V.CONSOLES.forEach(function (c) { if (c.kind !== "boss") test(c, "console", c.x, c.y); });
    if (zoneHere() === "heights" && !isDone("heights") && !S.td) V.TD.pads.forEach(function (p, i) { test(i, "pad", p[0], p[1]); });
    return best;
  }
  function promptText(n) {
    if (n.kind === "npc") return "Talk to " + n.o.name.split(" (")[0];
    if (n.kind === "sign") return "Read: " + n.o.t;
    if (n.kind === "pad") return save.rods.indexOf(n.o) >= 0 ? "Remove lightning rod" : "Place lightning rod (" + save.rods.length + "/" + V.TD.rods + ")";
    var c = n.o; if (c.kind === "td") return S.td ? "Storm in progress" : "Start the storm";
    return (save.tasks[c.id] ? "Replay: " : "") + c.label;
  }
  function interact(api) {
    var n = nearest(); if (!n) return;
    if (n.kind === "npc") return talk(api, n.o);
    if (n.kind === "sign") { if (save.notes.indexOf(n.o.id) < 0) { save.notes.push(n.o.id); persist(); }
      return dlg(api, "<h2>Field note: " + A.esc(n.o.t) + "</h2><p>" + A.esc(n.o.b) + "</p><p class='gm-small'>Field notes read: " + save.notes.length + " / " + SIGNS.length + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Got it</button></div>", function () { api.hide(); }); }
    if (n.kind === "pad") { var i = save.rods.indexOf(n.o); if (i >= 0) save.rods.splice(i, 1); else if (save.rods.length >= V.TD.rods) { say("Only " + V.TD.rods + " rods. Remove one first."); api.sound.sfx("block"); return; } else save.rods.push(n.o); persist(); api.sound.sfx("click"); return; }
    var c = n.o, d = DBY[c.d];
    if (c.kind === "probe") return openProbe(api, c);
    if (c.kind === "cap") return openCap(api);
    if (c.kind === "equi") return openEqui(api);
    if (c.kind === "scope") return openScope(api);
    if (c.kind === "td") { if (isDone("heights")) { say("The storm is over. The generator hums happily."); return; } if (S.td) return;
      if (save.rods.length < V.TD.rods) { say("Place " + V.TD.rods + " lightning rods on the pads first (stand on a pad, " + keyOf("interact") + ")."); api.sound.sfx("block"); return; }
      S.td = V.tdNew(save.rods.slice()); S.ens = S.ens.filter(function (e) { if (e.z === "heights") { puff(e.x, e.y, "#fff", 6, 2); return false; } return true; }); api.banner("STORM!", { col: "#ff9d5c", edge: "#4a1f00", size: 110, sub: "Ground the sparks before they reach the generator", dur: 2 }); api.sound.sfx("whistle"); api.music(A.song(614, "boss", { bpm: 132 })); return; }
    void d;
  }
  function portrait(look) { return "<canvas width='120' height='120' data-npc style='float:left;margin:0 12px 6px 0;border-radius:14px;background:rgba(255,255,255,.08)'></canvas>"; }
  function talk(api, n) {
    var lines = n.lines(restored()), i = 0; save.talked[n.id] = 1; persist();
    function page() {
      dlg(api, portrait(n.look) + "<h2>" + A.esc(n.name) + "</h2><p>" + A.esc(lines[i]) + "</p><div class='gm-actions' style='clear:both'><button class='gm-btn gm-btn--go' data-act='next'>" + (i < lines.length - 1 ? "Next (" + (i + 1) + "/" + lines.length + ")" : "Bye") + "</button></div>",
        function () { i++; if (i < lines.length) page(); else api.hide(); });
      var cv = document.querySelector("[data-npc]"); if (cv) A.drawHead(cv.getContext("2d"), n.look, 60, 58, 38, 1, { mood: "happy" });
    }
    page();
  }

  /* ---------- quest log ---------- */
  function openLog(api) {
    var o = objective(), have = crystalsHave();
    var rows = DIST.map(function (d) { var done = isDone(d.id), locked = !done && restored() < d.stage - 1;
      return "<tr><td>" + (done ? "✅" : locked ? "🔒" : "⚡") + "</td><td><b>" + A.esc(d.name) + "</b><br><small>" + A.esc(d.blurb) + "</small></td></tr>"; }).join("");
    var trails = V.TRAILS.map(function (t) { var ok = have >= t.need; return "<button class='gm-btn gm-btn--sm' data-act='trail' data-id='" + t.id + "'" + (ok ? "" : " disabled") + " aria-pressed='" + (save.trail === t.id) + "'>" + (save.trail === t.id ? "✓ " : "") + A.esc(t.name) + (ok ? "" : " (" + t.need + "◆)") + "</button>"; }).join(" ");
    dlg(api, "<h2>Quest log</h2><p><b>Now:</b> " + A.esc(o.s) + "</p><table>" + rows + "</table><p><b>Charge crystals:</b> " + have + " (" + save.crystals.length + " / " + V.CRYSTALS.length + " found" + (save.bonus ? ", +" + save.bonus + " from bonus relays" : "") + ") · <b>Field notes:</b> " + save.notes.length + " / " + SIGNS.length + "</p>" +
      "<p><b>Volt Pack trail</b></p><div class='gm-actions' style='justify-content:flex-start'>" + trails + "</div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='close'>Back to the city</button><button class='gm-btn' data-act='map'>City map</button><button class='gm-btn' data-act='ladder'>Challenge ladder</button><button class='gm-btn' data-act='lab'>Sandbox lab</button><button class='gm-btn' data-act='up'>Upgrades (" + save.volts + " volts)</button><button class='gm-btn' data-act='opts'>Settings</button><button class='gm-btn' data-act='intro'>Replay intro</button><button class='gm-btn' data-act='reset'>Reset progress</button></div>",
      function (a, el) {
        if (a === "map") return openMap(api); if (a === "ladder") return openLadder(api); if (a === "up") return openUpgrades(api); if (a === "opts") return openOptions(api);
        if (a === "lab") { api.hide(); return openSandbox(api); }
        if (a === "trail") { save.trail = el.getAttribute("data-id"); persist(); openLog(api); return; }
        if (a === "warp") { h.x = V.START[0]; h.y = V.START[1]; h.vx = h.vy = 0; S.td = null; if (S.boss) S.boss = null; S.ens = []; S.spawned = {}; S.checkpoint = V.START.slice(); }
        if (a === "intro") { api.hide(); S.mode = "intro"; S.introT = 0; setPad(api, "intro"); return; }
        if (a === "reset") { dlg(api, "<h2>Reset Volt City?</h2><p>This clears districts, crystals and trails on this device. Coins and XP already earned stay.</p><div class='gm-actions'><button class='gm-btn' data-act='yes'>Reset</button><button class='gm-btn gm-btn--go' data-act='no'>Keep my progress</button></div>",
          function (b) { if (b === "yes") { A.store("volt2", null); location.reload(); } else openLog(api); }); return; }
        api.hide();
      });
  }

  /* =====================================================================================================
   * Challenge 1: probe relays (fieldsim.js). Place charges so the field steers a + probe to the receiver.
   * ===================================================================================================== */
  var PB = { BX: 24, BY: 84, C: 56 };
  function openProbe(api, c) {
    var L = PS.LEVELS[c.level]; S.mode = "probe"; S.pz = { c: c, L: L, placed: [], cur: [3, 3], run: null, res: null, preview: null, lines: [] }; setPad(api, "puzzle"); probeUpdate();
    dlg(api, "<h2>" + A.esc(c.label) + "</h2><p>Count Entropy pulled the relay's breaker. Release a positive probe charge (+0.5 µC) from the source and build an electric field that steers it into the receiver.</p><p>" + A.esc(L.hint) + "</p><p>Place up to <b>" + L.give + "</b> charges: tap a square (or move the cursor and press " + A.esc(keyOf("flip")) + ") to cycle + → − → empty. Arrows show the field E (the push on a + charge). Press " + A.esc(keyOf("interact")) + " to release the probe; " + A.esc(keyOf("back")) + " leaves.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start</button></div>", function () { api.hide(); });
  }
  function probeCharges() { return S.pz.L.fixed.concat(S.pz.placed); }
  function boardSim(z) { return z.kind === "mag" ? VL.magSimulate(z.L, z.placed) : PS.simulate(z.L, probeCharges()); }
  function probeUpdate() { var z = S.pz; z.preview = z.L.preview || z.L.sandbox || (z.ctx && upLvl("visor")) ? boardSim(z).path : null; z.lines = z.kind === "mag" ? [] : probeLines(); }
  function probeLines() { // field lines from + charges (or into − charges when there are no + ones)
    var ch = probeCharges(), out = [], pos = ch.filter(function (q) { return q.s > 0; }), seeds = pos.length ? pos : ch, dir = pos.length ? 1 : -1;
    seeds.forEach(function (q) { for (var i = 0; i < 10; i++) { var a = i / 10 * PI2 + .2, x = (q.c + .5) * PS.CELL + Math.cos(a) * .03, y = (q.r + .5) * PS.CELL + Math.sin(a) * .03, pts = [[x, y]];
      for (var s = 0; s < 120; s++) { var E = PS.field(ch, x, y), m = Math.hypot(E[0], E[1]); if (m < 1) break; x += dir * E[0] / m * .012; y += dir * E[1] / m * .012; pts.push([x, y]);
        if (x < 0 || y < 0 || x > PS.COLS * PS.CELL || y > PS.ROWS * PS.CELL) break; if (ch.some(function (o) { return o !== q && Math.hypot((o.c + .5) * PS.CELL - x, (o.r + .5) * PS.CELL - y) < .02; })) break; }
      out.push(pts); } });
    return out;
  }
  function probeLocked(c, r) { var L = S.pz.L; return (L.src[0] === c && L.src[1] === r) || (L.dst[0] === c && L.dst[1] === r) || L.walls.some(function (w) { return w[0] === c && w[1] === r; }) || L.fixed.some(function (f) { return f.c === c && f.r === r; }); }
  function probeCycle(api, c, r) {
    var z = S.pz; if (z.run || probeLocked(c, r)) { api.sound.sfx("block"); return; }
    var i = -1; z.placed.forEach(function (p, k) { if (p.c === c && p.r === r) i = k; });
    if (i < 0) { if (z.placed.length >= z.L.give) { say("All " + z.L.give + " charges placed. Change or remove one first."); api.sound.sfx("block"); return; } z.placed.push({ c: c, r: r, s: 1 }); }
    else if (z.placed[i].s > 0) z.placed[i].s = -1; else z.placed.splice(i, 1);
    api.sound.sfx("click"); probeUpdate();
  }
  function probeStep(api, dt) {
    var z = S.pz;
    if (z.run) { z.run.i += 2; if (z.run.i % 8 === 0) { var p = z.res.path[Math.min(z.run.i, z.res.path.length - 1)]; z.sparks = z.sparks || []; z.sparks.push({ x: p[0], y: p[1], life: .5 }); }
      if (z.run.i >= z.res.path.length - 1) { z.run.i = z.res.path.length - 1; if (!z.run.end) { z.run.end = true; probeFinish(api); } } return; }
    if (api.hit("left")) z.cur[0] = Math.max(0, z.cur[0] - 1); if (api.hit("right")) z.cur[0] = Math.min(PS.COLS - 1, z.cur[0] + 1);
    if (api.hit("up")) z.cur[1] = Math.max(0, z.cur[1] - 1); if (api.hit("down")) z.cur[1] = Math.min(PS.ROWS - 1, z.cur[1] + 1);
    if (api.hit("flip")) probeCycle(api, z.cur[0], z.cur[1]);
    if (api.hit("interact")) probeRelease(api);
    if (api.hit("back")) leavePuzzle(api);
  }
  function probeRelease(api) { var z = S.pz; if (z.run) return; z.res = boardSim(z); z.run = { i: 0 }; z.sparks = []; api.sound.sfx("zap"); }
  function probeFinish(api) {
    var z = S.pz, c = z.c; if (z.ctx) return boardDone(api, z);
    if (z.res.ok) { api.sound.sfx("power"); api.banner("RELAY ON", { col: "#ffd84a", size: 96, dur: 1.4 }); api.confetti(60, 480, 300);
      var first = !save.tasks[c.id]; if (c.bonus && first) { save.bonus = (save.bonus || 0) + 3; }
      dlg(api, "<h2>" + A.esc(c.label) + " is back on</h2><p>The probe reached the receiver in " + z.res.t.toFixed(2) + " s using " + z.placed.length + " placed charge" + (z.placed.length === 1 ? "" : "s") + ". At every instant it felt the vector sum of the force from each charge: superposition.</p><p class='gm-formula'>F = k q Q / r² · k = 8.99 × 10⁹ N·m²/C² · E = F / q</p>" + (c.bonus && first ? "<p>Bonus relay: <b>+3 charge crystals</b>.</p>" : "") +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='city'>Back to the city</button></div>", function () { api.hide(); leavePuzzle(api); complete(api, c.id); });
    } else { api.sound.sfx("lose");
      dlg(api, "<h2>Not quite</h2><p>" + A.esc(z.res.why) + "</p><p>" + A.esc(z.L.hint) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='retry'>Adjust charges</button><button class='gm-btn' data-act='city'>Leave</button></div>",
        function (a) { z.run = null; api.hide(); if (a === "city") leavePuzzle(api); }); }
  }
  function leavePuzzle(api) { S.mode = "world"; S.pz = null; setPad(api, "world"); api.music(songFor(zoneHere())); }
  function drawProbe(x, api) {
    var z = S.pz, L = z.L, all = probeCharges(), BX = PB.BX, BY = PB.BY, C = PB.C, t = api.t;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0a1a2a"); g.addColorStop(1, "#050d16"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    txt(x, z.ctx ? z.ctx.label : z.c.label + ": steer the probe home", 24, 40, 26, "#fff", "left", 560);
    txt(x, (z.kind === "mag" ? "Tiles " : "Charges ") + z.placed.length + " / " + L.give, 936, 40, 22, "#9fdcff", "right");
    txt(x, z.kind === "mag" ? "Tap a square to cycle ⊗ in / ⊙ out / empty" : "Tap a square to cycle + / − / empty", 24, 70, 18, "rgba(207,233,255,.8)", "left");
    for (var r = 0; r < PS.ROWS; r++) for (var c = 0; c < PS.COLS; c++) { var px = BX + c * C, py = BY + r * C; x.fillStyle = (r + c) % 2 ? "#0c1d29" : "#0f2333"; x.fillRect(px, py, C, C); }
    x.lineWidth = 1.5; z.lines.forEach(function (pts) { x.strokeStyle = "rgba(126,240,255,.22)"; x.beginPath(); pts.forEach(function (q, i) { var px = BX + q[0] / PS.CELL * C, py = BY + q[1] / PS.CELL * C; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); });
    if (z.kind === "mag") drawMagTiles(x, z); else if (z.pot) drawPot(x, all);
    if (z.kind !== "mag") for (r = 0; r < PS.ROWS; r++) for (c = 0; c < PS.COLS; c++) {
      var E = PS.field(all, (c + .5) * PS.CELL, (r + .5) * PS.CELL), mag = Math.hypot(E[0], E[1]); if (mag < 1) continue;
      var len = Math.min(30, 8 + Math.log10(mag) * 3), ux = E[0] / mag, uy = E[1] / mag, mx = BX + c * C + C / 2, my = BY + r * C + C / 2, al = Math.min(.9, .2 + Math.log10(mag) / 9);
      x.strokeStyle = "rgba(126,240,255," + al + ")"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(mx - ux * len / 2, my - uy * len / 2); x.lineTo(mx + ux * len / 2, my + uy * len / 2);
      x.lineTo(mx + ux * len / 2 - (ux * 7 - uy * 5), my + uy * len / 2 - (uy * 7 + ux * 5)); x.moveTo(mx + ux * len / 2, my + uy * len / 2); x.lineTo(mx + ux * len / 2 - (ux * 7 + uy * 5), my + uy * len / 2 - (uy * 7 - ux * 5)); x.stroke();
      if (!api.reduce) { var ph = (t * 1.2 + (c + r) * .13) % 1; x.fillStyle = "rgba(220,250,255," + al + ")"; x.beginPath(); x.arc(mx + ux * len * (ph - .5), my + uy * len * (ph - .5), 2, 0, PI2); x.fill(); }
    }
    L.walls.forEach(function (w) { var px = BX + w[0] * C, py = BY + w[1] * C; x.fillStyle = "#5b4636"; x.fillRect(px + 3, py + 3, C - 6, C - 6); x.strokeStyle = "#7a5f48"; x.lineWidth = 2; for (var k = 10; k < C; k += 12) { x.beginPath(); x.moveTo(px + 3, py + k); x.lineTo(px + C - 3, py + k); x.stroke(); } });
    function cell(c, r) { return [BX + (c + .5) * C, BY + (r + .5) * C]; }
    var s = cell(L.src[0], L.src[1]), d = cell(L.dst[0], L.dst[1]), lit = z.run && z.run.end && z.res.ok;
    x.fillStyle = "#24364a"; x.fillRect(s[0] - 28, s[1] - 28, 56, 56); txt(x, "source", s[0], s[1] + 26, 14, "#9fdcff", "center");
    if (!L.sandbox) { x.strokeStyle = lit ? "#ffd84a" : "#c084fc"; x.lineWidth = 5; x.beginPath(); x.arc(d[0], d[1], 22 + (api.reduce ? 0 : Math.sin(t * 5) * 3), 0, PI2); x.stroke(); txt(x, lit ? "ON" : "relay", d[0], d[1] + 6, 15, lit ? "#ffd84a" : "#e8d4ff", "center"); }
    if (z.kind !== "mag") all.forEach(function (q) { var p = cell(q.c, q.r), fixed = L.fixed.indexOf(q) >= 0; chargeBall(x, p[0], p[1], 22, q.s, t, api.reduce);
      if (fixed) { x.strokeStyle = "#c084fc"; x.lineWidth = 2; x.setLineDash([4, 4]); x.beginPath(); x.arc(p[0], p[1], 28, 0, PI2); x.stroke(); x.setLineDash([]); } });
    var path = z.run ? z.res.path.slice(0, z.run.i + 1) : z.preview;
    if (path) { x.save(); x.lineCap = "round"; if (z.run) { x.shadowColor = "#ffe48a"; x.shadowBlur = api.reduce ? 0 : 14; } x.strokeStyle = z.run ? "#fff4c0" : "rgba(255,255,255,.4)"; x.setLineDash(z.run ? [] : [5, 7]); x.lineWidth = z.run ? 4 : 2.5;
      x.beginPath(); path.forEach(function (q, i) { var px = BX + q[0] / PS.CELL * C, py = BY + q[1] / PS.CELL * C; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); x.restore(); }
    (z.sparks || []).forEach(function (sp) { sp.life -= 1 / 60; if (sp.life <= 0) return; x.fillStyle = "rgba(255,228,138," + sp.life * 1.6 + ")"; x.beginPath(); x.arc(BX + sp.x / PS.CELL * C + (Math.random() - .5) * 6, BY + sp.y / PS.CELL * C + (Math.random() - .5) * 6, 3, 0, PI2); x.fill(); });
    var head = z.run ? z.res.path[Math.min(z.run.i, z.res.path.length - 1)] : null, pp = head ? [BX + head[0] / PS.CELL * C, BY + head[1] / PS.CELL * C] : s;
    x.fillStyle = "#ffe48a"; x.shadowColor = "#ffe48a"; x.shadowBlur = 18; x.beginPath(); x.arc(pp[0], pp[1], 11, 0, PI2); x.fill(); x.shadowBlur = 0; txt(x, "+", pp[0], pp[1] + 6, 16, "#3a2a00", "center");
    if (!z.run) { x.strokeStyle = "#fff"; x.lineWidth = 3; x.strokeRect(BX + z.cur[0] * C + 2, BY + z.cur[1] * C + 2, C - 4, C - 4);
      var E0 = z.kind === "mag" ? [0, 0] : PS.field(all, (z.cur[0] + .5) * PS.CELL, (z.cur[1] + .5) * PS.CELL), m0 = Math.hypot(E0[0], E0[1]);
      if (z.kind === "mag") { txt(x, "B = 0.5 T per tile", 716, 258, 22, "#fff", "left", 0, 700); txt(x, "r = mv/(qB) = 15 cm", 716, 286, 22, "#fff", "left", 0, 700); } else {
      txt(x, "Cursor:", 716, 230, 20, "#9fdcff", "left"); txt(x, "|E| = " + (m0 > 1e4 ? (m0 / 1000).toFixed(0) + " kN/C" : m0.toFixed(0) + " N/C"), 716, 258, 22, "#fff", "left", 0, 700);
      txt(x, "|F| = qE = " + (PS.QP * m0 * 1000).toFixed(1) + " mN", 716, 286, 22, "#fff", "left", 0, 700); } }
    txt(x, z.kind === "mag" ? "⊗ field into the board, ⊙ out of it. The force F = qv × B is always sideways, so the grain keeps its speed and only turns." : "Arrows: field E, the push on a + charge. Dotted line: " + (z.preview ? "predicted path." : "no preview on this relay."), 716, 330, 17, "rgba(255,255,255,.75)", "left", 226);
    txt(x, z.kind === "mag" ? "cell 10 cm · grain +2 µC, 0.1 mg, 1.5 m/s · B = 0.5 T" : "cell 10 cm · charges ±0.5 µC · probe +0.5 µC, 20 g", 24, 508, 17, "rgba(255,255,255,.6)", "left");
    if (z.kind !== "mag" && !z.run) btn(x, api, 716, 440, 220, 44, z.pot ? "Hide potential" : "Show potential V", "pot");
    btn(x, api, 716, 84, 220, 56, "Release ▶", "release", "#ffd84a"); btn(x, api, 716, 152, 220, 48, "Leave", "leave");
  }
  function chargeBall(x, px, py, r, s, t, reduce) {
    var g = x.createRadialGradient(px - r * .3, py - r * .3, 2, px, py, r); g.addColorStop(0, s > 0 ? "#ffc0c0" : "#c0d4ff"); g.addColorStop(1, s > 0 ? "#c0392b" : "#2c4fb8");
    if (!reduce) { x.fillStyle = s > 0 ? "rgba(255,90,90,.18)" : "rgba(90,140,255,.18)"; x.beginPath(); x.arc(px, py, r + 6 + Math.sin(t * 4) * 2, 0, PI2); x.fill(); }
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, PI2); x.fill(); txt(x, s > 0 ? "+" : "−", px, py + r * .38, r * 1.1, "#fff", "center", 0, 800);
  }

  /* =====================================================================================================
   * Challenge 2: capacitor bank (q = CV, U = ½CV², RC charging)
   * ===================================================================================================== */
  function openCap(api) {
    var ri = Math.min(save.capRound || 0, V.CAP.rounds.length - 1); if (save.tasks.cap) ri = 0;
    S.mode = "cap"; S.cp = { ri: ri, opt: 0, V: 0, hist: [], t: 0, res: null }; setPad(api, "puzzle"); capBrief(api);
  }
  function capBrief(api) { var R = V.CAP.rounds[S.cp.ri];
    dlg(api, "<h2>Capacitor bank " + (S.cp.ri + 1) + "/" + V.CAP.rounds.length + ": " + A.esc(R.title) + "</h2><p>" + A.esc(R.brief) + "</p><p>Hold " + A.esc(keyOf("up")) + " to connect the " + R.Vs + " V supply through " + R.R + " Ω (the capacitor charges fast, then slower), hold " + A.esc(keyOf("down")) + " to bleed charge off, " + A.esc(keyOf("left")) + "/" + A.esc(keyOf("right")) + " to choose" + (R.modes ? " the wiring" : " a capacitor") + ", and " + A.esc(keyOf("interact")) + " to fire.</p><p class='gm-formula'>q = CV · U = ½CV² · V(t) = Vs(1 − e^(−t/RC))</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start</button></div>", function () { api.hide(); }); }
  function capStep(api, dt) {
    var z = S.cp, R = V.CAP.rounds[Math.min(z.ri, V.CAP.rounds.length - 1)], C = V.capC(R, z.opt); z.t += dt;
    if (api.hit("back")) return leavePuzzle(api);
    if (api.hit("left") || api.hit("right")) { if (z.V > .05) { say("Bleed the charge off before rewiring (hold " + keyOf("down") + ")."); api.sound.sfx("block"); } else { z.opt = (z.opt + (api.hit("left") ? -1 : 1) + V.capOptions(R)) % V.capOptions(R); api.sound.sfx("click"); } }
    z.charging = api.down("up"); z.bleeding = api.down("down");
    if (z.charging) z.V = V.capCharge(z.V, R.Vs, R.R, C, dt); else if (z.bleeding) z.V = V.capBleed(z.V, R.R, C, dt);
    if (Math.floor(z.t * 20) !== Math.floor((z.t - dt) * 20)) { z.hist.push(z.V); if (z.hist.length > 120) z.hist.shift(); }
    if (z.charging && Math.floor(z.t * 8) !== Math.floor((z.t - dt) * 8)) api.sound.tone(200 + z.V / R.Vs * 600, .05, "triangle", .04);
    if (api.hit("interact")) capFire(api);
  }
  function capFire(api) {
    var z = S.cp, R = V.CAP.rounds[z.ri], res = V.capCheck(R, z.opt, z.V), C = V.capC(R, z.opt);
    var nums = "C = " + fmtC(C) + ", V = " + z.V.toFixed(2) + " V → q = CV = " + (res.q * 1000).toFixed(2) + " mC, U = ½CV² = " + res.E.toFixed(3) + " J";
    if (!res.ok) { api.sound.sfx("lose"); say(res.why, 3.5); S.cp.res = { ok: false, t: nums }; api.kick(4); return; }
    api.sound.sfx("goal"); api.banner("POWERED", { col: "#7ef0ff", edge: "#0b3a5c", size: 96, dur: 1.3 }); api.confetti(50, 480, 300); z.V = 0;
    z.ri++; save.capRound = z.ri; persist();
    if (z.ri >= V.CAP.rounds.length) { save.capRound = 0; persist();
      dlg(api, "<h2>Dock bank fully charged</h2><p>" + A.esc(nums) + "</p><p>Charge on a capacitor is proportional to voltage (q = CV), but stored energy goes with the square of it (U = ½CV²). That's why a capacitor's voltage rating matters so much.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Back to the docks</button></div>", function () { api.hide(); leavePuzzle(api); complete(api, "cap"); });
    } else { dlg(api, "<h2>Done!</h2><p>" + A.esc(nums) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Next capacitor</button></div>", function () { api.hide(); S.cp.opt = 0; S.cp.hist = []; capBrief(api); }); }
  }
  function fmtC(C) { return C >= 1e-3 ? (C * 1e3).toFixed(2) + " mF" : Math.round(C * 1e6) + " µF"; }
  function drawCap(x, api) {
    var z = S.cp, R = V.CAP.rounds[Math.min(z.ri, V.CAP.rounds.length - 1)], C = V.capC(R, z.opt), q = C * z.V, E = .5 * C * z.V * z.V, t = api.t;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0d2233"); g.addColorStop(1, "#071019"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    txt(x, "Capacitor " + (z.ri + 1) + "/" + V.CAP.rounds.length + ": " + R.title, 24, 40, 26, "#fff", "left");
    var tg = R.target, goal = tg.q != null ? "Goal: q = " + (tg.q * 1000).toFixed(2) + " mC" : "Goal: U = " + tg.E.toFixed(3) + " J"; txt(x, goal + (R.vmax ? " · max " + R.vmax + " V" : "") + " (±" + Math.round(R.tol * 100) + "%)", 24, 74, 22, "#7ef0ff", "left");
    // circuit
    var par = R.modes && R.modes[z.opt] === "parallel"; x.strokeStyle = "#cfd8e3"; x.lineWidth = 4; x.beginPath(); x.moveTo(420, 150); x.lineTo(80, 150); x.lineTo(80, 440); x.lineTo(420, 440);
    if (par) { x.moveTo(300, 150); x.lineTo(300, 440); x.moveTo(420, 150); x.lineTo(420, 440); } else { x.moveTo(420, 150); x.lineTo(420, 440); } x.stroke();
    x.fillStyle = "#0d2233"; x.fillRect(60, 250, 40, 90); x.fillStyle = "#cfd8e3"; x.fillRect(62, 270, 36, 6); x.fillRect(72, 290, 16, 6); x.fillRect(62, 310, 36, 6); x.fillRect(72, 330, 16, 4);
    txt(x, R.Vs + " V", 112, 300, 20, "#fff", "left");
    x.fillStyle = "#0d2233"; x.fillRect(180, 138, 110, 24); x.strokeStyle = "#ffb070"; x.lineWidth = 3; x.beginPath(); for (var k = 0; k <= 10; k++) x.lineTo(185 + k * 10, 150 + (k % 2 ? -10 : 10) * (k > 0 && k < 10 ? 1 : 0)); x.stroke(); txt(x, R.R + " Ω", 235, 128, 18, "#ffb070", "center");
    x.fillStyle = z.charging ? "#3dd68c" : z.bleeding ? "#ff9d5c" : "#8899aa"; txt(x, z.charging ? "SUPPLY ON" : z.bleeding ? "BLEEDING" : "OPEN", 330, 128, 16, x.fillStyle, "center");
    var caps = R.modes ? (par ? [[300, 300], [420, 300]] : [[420, 240], [420, 360]]) : [[420, 300]];
    caps.forEach(function (cp, i) { var cx = cp[0], cy = cp[1], frac = clamp(z.V / R.Vs, 0, 1);
      x.fillStyle = "#0d2233"; x.fillRect(cx - 50, cy - 18, 100, 36); x.fillStyle = "#e8eef5"; x.fillRect(cx - 44, cy - 16, 88, 8); x.fillRect(cx - 44, cy + 8, 88, 8);
      var n = Math.round(frac * 7); for (var j = 0; j < n; j++) { txt(x, "+", cx - 36 + j * 12, cy - 20, 16, "#ff8a8a", "center"); txt(x, "−", cx - 36 + j * 12, cy + 34, 16, "#8ab4ff", "center"); }
      var lab = R.modes ? R.caps[i] + " µF" : R.caps[z.opt] + " µF"; txt(x, lab, cx, cy + 58, 18, "#fff", "center"); });
    if (R.modes) txt(x, (R.modes[z.opt] === "series" ? "SERIES: 1/C = 1/C₁ + 1/C₂" : "PARALLEL: C = C₁ + C₂") + " = " + fmtC(C), 60, 478, 20, "#ffd84a", "left");
    else txt(x, "Capacitor: " + fmtC(C) + "  (" + (z.opt + 1) + "/" + R.caps.length + ")", 60, 478, 20, "#ffd84a", "left");
    // meter
    var mx = 520, my = 130, mw = 400, mh = 34, vmax = R.Vs, need = V.capNeedV(R, z.opt), lo, hi;
    if (tg.q != null) { lo = need * (1 - R.tol); hi = need * (1 + R.tol); } else { lo = need * Math.sqrt(1 - R.tol); hi = need * Math.sqrt(1 + R.tol); }
    x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(mx, my, mw, mh);
    if (lo < vmax) { x.fillStyle = "rgba(61,214,140,.35)"; x.fillRect(mx + lo / vmax * mw, my, Math.max(3, (Math.min(hi, vmax) - lo) / vmax * mw), mh); }
    if (R.vmax) { x.fillStyle = "#ff6b6b"; x.fillRect(mx + R.vmax / vmax * mw - 2, my - 6, 4, mh + 12); txt(x, "rating " + R.vmax + " V", mx + R.vmax / vmax * mw, my - 10, 14, "#ff9b9b", "center"); }
    var vf = clamp(z.V / vmax, 0, 1), gg = x.createLinearGradient(mx, 0, mx + mw, 0); gg.addColorStop(0, "#1f6fb2"); gg.addColorStop(1, "#7ef0ff"); x.fillStyle = gg; x.fillRect(mx, my + 8, vf * mw, mh - 16);
    x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(mx, my, mw, mh); txt(x, "0", mx, my + mh + 20, 14, "#9ab", "center"); txt(x, vmax + " V", mx + mw, my + mh + 20, 14, "#9ab", "center");
    txt(x, need > R.Vs || (R.vmax && need > R.vmax) ? "This choice can't reach the goal within the limits." : "", mx, my + mh + 44, 16, "#ff9b9b", "left", 400);
    var rows = [["V", z.V.toFixed(2) + " V"], ["q = CV", (q * 1000).toFixed(3) + " mC"], ["U = ½CV²", E.toFixed(4) + " J"], ["τ = RC", (R.R * C).toFixed(2) + " s"]];
    rows.forEach(function (r, i) { txt(x, r[0], mx, 250 + i * 34, 22, "#9fdcff", "left"); txt(x, r[1], mx + mw, 250 + i * 34, 24, "#fff", "right", 0, 700); });
    // V(t) graph
    var gx = mx, gy = 390, gw = mw, gh = 80; x.fillStyle = "rgba(255,255,255,.05)"; x.fillRect(gx, gy, gw, gh); x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; x.beginPath();
    z.hist.forEach(function (v, i) { var px = gx + i / 120 * gw, py = gy + gh - v / vmax * gh; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); txt(x, "V(t), last 6 s", gx + 6, gy + 18, 14, "#9ab", "left");
    if (S.cp.res && !S.cp.res.ok) txt(x, S.cp.res.t, 24, 506, 16, "#ffd0a0", "left", 480);
    btn(x, api, 520, 482, 120, 46, "◀ ▶", "capopt"); btn(x, api, 656, 482, 130, 46, "Fire", "capfire", "#3dd68c"); btn(x, api, 802, 482, 130, 46, "Leave", "leave");
    void t;
  }

  /* =====================================================================================================
   * Challenge 3: equipotential maze (W = qΔV)
   * ===================================================================================================== */
  function openEqui(api) { var li = save.tasks.equi ? 0 : Math.min(save.eqLevel || 0, V.EQUI.levels.length - 1); S.mode = "equi"; eqReset(li); setPad(api, "puzzle"); eqBrief(api); }
  function eqReset(li) { var L = V.EQUI.levels[li]; S.eq = { li: li, L: L, s: { c: L.start[0], r: L.start[1], e: L.battery }, moves: 0, path: [[L.start[0], L.start[1]]] }; }
  function eqBrief(api) { var L = S.eq.L, w = (V.EQUI.qProbe * L.step * 1000).toFixed(1);
    dlg(api, "<h2>Garden maze " + (S.eq.li + 1) + "/" + V.EQUI.levels.length + ": " + A.esc(L.name) + "</h2><p>Carry a +2 µC seed of charge to the gate. The colours show the electric potential V; bright lines are equipotentials, " + L.step + " V apart.</p><p>Moving within a band is free (ΔV = 0). Stepping up one band costs W = qΔV = " + w + " mJ from your battery; stepping down returns it. You can only cross one equipotential at a time.</p><p>" + A.esc(L.hint) + "</p><p class='gm-small'>" + A.esc(keyOf("left")) + "/" + A.esc(keyOf("right")) + "/" + A.esc(keyOf("up")) + "/" + A.esc(keyOf("down")) + " or tap a neighbour to move · " + A.esc(keyOf("flip")) + " restart · " + A.esc(keyOf("back")) + " leave</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start</button></div>", function () { api.hide(); }); }
  var EQB = { BX: 110, BY: 84, C: 56 };
  function eqStep(api) {
    if (api.hit("back")) return leavePuzzle(api);
    if (api.hit("flip")) { eqReset(S.eq.li); api.sound.sfx("click"); return; }
    var d = api.hit("left") ? [-1, 0] : api.hit("right") ? [1, 0] : api.hit("up") ? [0, -1] : api.hit("down") ? [0, 1] : null; if (d) eqTry(api, d[0], d[1]);
  }
  function eqTry(api, dc, dr) {
    var z = S.eq, m = V.eqMove(z.L, z.s, dc, dr); if (!m.ok) { say(m.why); api.sound.sfx("block"); api.kick(2); return; }
    z.s = { c: m.c, r: m.r, e: m.e }; z.moves++; z.path.push([m.c, m.r]); var w = (V.EQUI.qProbe * z.L.step * 1000).toFixed(1);
    if (m.d > 0) { floatText(m.c, m.r, "−" + w + " mJ", "#ff9b9b"); api.sound.tone(520, .08, "square", .05); } else if (m.d < 0) { floatText(m.c, m.r, "+" + w + " mJ", "#3dd68c"); api.sound.tone(330, .08, "square", .05); } else api.sound.sfx("click");
    if (m.c === z.L.goal[0] && m.r === z.L.goal[1]) {
      api.sound.sfx("goal"); api.banner("BLOOM!", { col: "#3dd68c", edge: "#0b3a1c", size: 100, dur: 1.3 }); api.confetti(50, 480, 300);
      var li = z.li + 1; save.eqLevel = li; persist();
      if (li >= V.EQUI.levels.length) { save.eqLevel = 0; persist(); dlg(api, "<h2>The gardens bloom</h2><p>You crossed the garden in " + z.moves + " moves. Along each equipotential no work was done; every crossing cost or returned W = qΔV.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Back to the gardens</button></div>", function () { api.hide(); leavePuzzle(api); complete(api, "equi"); }); }
      else dlg(api, "<h2>Maze cleared</h2><p>" + z.moves + " moves. Next: a dipole, a + and a − charge together.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Next maze</button></div>", function () { api.hide(); eqReset(li); eqBrief(api); });
    }
  }
  function drawEqui(x, api) {
    var z = S.eq, L = z.L, B = EQB, C = B.C, t = api.t;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0e2a1c"); g.addColorStop(1, "#06140d"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    txt(x, "Garden maze " + (z.li + 1) + "/" + V.EQUI.levels.length + ": " + L.name, 24, 40, 26, "#fff", "left"); txt(x, "Walk the equipotentials to the gate", 24, 70, 20, "#a7f3c5", "left");
    for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) { var px = B.BX + c * C, py = B.BY + r * C, v = V.eqV(L, c, r), b = V.eqBand(L, c, r), f = clamp(v / (L.step * 4), -1, 1);
      x.fillStyle = f > 0 ? "rgb(" + Math.round(60 + 180 * f) + "," + Math.round(70 + 40 * (1 - f)) + "," + Math.round(80 - 30 * f) + ")" : "rgb(" + Math.round(60 + 20 * (1 + f)) + "," + Math.round(80 + 40 * (1 + f)) + "," + Math.round(90 - 150 * f) + ")";
      x.fillRect(px, py, C, C); if (V.eqBlocked(L, c, r) && !L.charges.some(function (q) { return q.c === c && q.r === r; })) { x.fillStyle = "#1f4a2a"; x.fillRect(px + 4, py + 4, C - 8, C - 8); x.fillStyle = "#2c6b3a"; x.beginPath(); x.arc(px + C / 2, py + C / 2, C * .36, 0, PI2); x.fill(); continue; }
      if (!L.charges.some(function (q) { return q.c === c && q.r === r; })) txt(x, (b * L.step) + " V", px + C / 2, py + C - 8, 13, "rgba(255,255,255,.75)", "center"); }
    x.lineWidth = 4; x.strokeStyle = "rgba(255,255,230,.9)"; // equipotential boundaries between bands
    for (r = 0; r < L.rows; r++) for (c = 0; c < L.cols; c++) { var b0 = V.eqBand(L, c, r), px2 = B.BX + c * C, py2 = B.BY + r * C;
      if (c + 1 < L.cols && V.eqBand(L, c + 1, r) !== b0) { x.beginPath(); x.moveTo(px2 + C, py2); x.lineTo(px2 + C, py2 + C); x.stroke(); }
      if (r + 1 < L.rows && V.eqBand(L, c, r + 1) !== b0) { x.beginPath(); x.moveTo(px2, py2 + C); x.lineTo(px2 + C, py2 + C); x.stroke(); } }
    L.charges.forEach(function (q) { chargeBall(x, B.BX + (q.c + .5) * C, B.BY + (q.r + .5) * C, 22, q.q, t, api.reduce); });
    var gx = B.BX + (L.goal[0] + .5) * C, gy = B.BY + (L.goal[1] + .5) * C; x.fillStyle = "#ffd84a"; for (var k = 0; k < 6; k++) { var a = k / 6 * PI2 + t; x.beginPath(); x.arc(gx + Math.cos(a) * 12, gy + Math.sin(a) * 12, 8, 0, PI2); x.fill(); } x.fillStyle = "#ff8a3d"; x.beginPath(); x.arc(gx, gy, 8, 0, PI2); x.fill();
    x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 3; x.setLineDash([6, 6]); x.beginPath(); z.path.forEach(function (p, i) { var px = B.BX + (p[0] + .5) * C, py = B.BY + (p[1] + .5) * C; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); x.setLineDash([]);
    var sx = B.BX + (z.s.c + .5) * C, sy = B.BY + (z.s.r + .5) * C; x.fillStyle = "#ffe48a"; x.shadowColor = "#ffe48a"; x.shadowBlur = 16; x.beginPath(); x.arc(sx, sy, 15, 0, PI2); x.fill(); x.shadowBlur = 0; txt(x, "+", sx, sy + 7, 20, "#3a2a00", "center", 0, 800);
    // battery
    var bx = 790, by = 110, bw = 70, bh = 280, w = (V.EQUI.qProbe * L.step * 1000).toFixed(1);
    txt(x, "Battery", bx + bw / 2, by - 14, 18, "#fff", "center"); x.strokeStyle = "#fff"; x.lineWidth = 3; x.strokeRect(bx, by, bw, bh); x.fillRect(bx + 22, by - 8, 26, 8);
    for (var i = 0; i < L.cap; i++) { var on = i < z.s.e; x.fillStyle = on ? "#3dd68c" : "rgba(255,255,255,.08)"; x.fillRect(bx + 6, by + bh - (i + 1) * (bh / L.cap) + 4, bw - 12, bh / L.cap - 8); }
    txt(x, (z.s.e * w) + " mJ", bx + bw / 2, by + bh + 28, 20, "#3dd68c", "center"); txt(x, "here: V = " + Math.round(V.eqV(L, z.s.c, z.s.r)) + " V", bx + bw / 2, by + bh + 54, 15, "#cde", "center");
    btn(x, api, 110, 488, 150, 44, "Restart", "eqreset"); btn(x, api, 276, 488, 150, 44, "Leave", "leave");
    drawFloatTextsBoard(x);
  }
  function drawFloatTextsBoard(x) { TEXTS.forEach(function (tt) { if (S.mode !== "equi") return; txt(x, tt.t, EQB.BX + (tt.x + .5) * EQB.C, EQB.BY + (tt.y + .1) * EQB.C - (1.3 - tt.life) * 30, 20, tt.col, "center", 0, 800); }); }

  /* =====================================================================================================
   * Challenge 4: gold-leaf electroscope (contact and induction)
   * ===================================================================================================== */
  function openScope(api) { var ri = save.tasks.scope ? 0 : Math.min(save.scRound || 0, V.SCOPE.rounds.length - 1); S.mode = "scope"; scReset(ri); setPad(api, "puzzle"); scBrief(api); }
  function scReset(ri) { var R = V.SCOPE.rounds[ri]; S.sc = { ri: ri, R: R, s: V.scopeNew(R), rod: R.quiz ? (Math.random() < .5 ? 1 : -1) : R.rod, rodX: 0, log: [] }; }
  function scBrief(api) { var R = S.sc.R;
    dlg(api, "<h2>Electroscope " + (S.sc.ri + 1) + "/" + V.SCOPE.rounds.length + ": " + A.esc(R.title) + "</h2><p>" + A.esc(R.brief) + "</p><p>" + A.esc(keyOf("right")) + " brings the rod near, " + A.esc(keyOf("left")) + " takes it away, " + A.esc(keyOf("up")) + " touches it to the cap, " + A.esc(keyOf("down")) + " connects or disconnects the earth wire, and " + A.esc(keyOf("interact")) + " checks your result. The leaves spread when they carry charge (like charges repel).</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start</button></div>", function () { api.hide(); }); }
  function scDo(api, act) {
    var z = S.sc, r = V.scopeAct(z.s, z.rod, act); if (r.why) { say(r.why); api.sound.sfx("block"); return; }
    var before = z.s.N; z.s = r.s; z.log.push(act); if (z.log.length > 6) z.log.shift();
    api.sound.sfx(act === "touch" ? "zap" : act === "ground" || act === "unground" ? "click" : "dash"); if (z.s.N !== before) api.sound.tone(660, .1, "sine", .05);
  }
  function scStep(api, dt) {
    var z = S.sc; z.rodX += ((z.s.near ? 1 : 0) - z.rodX) * Math.min(1, dt * 8);
    if (api.hit("back")) return leavePuzzle(api);
    if (api.hit("right")) scDo(api, "near"); if (api.hit("left")) scDo(api, "away"); if (api.hit("up")) scDo(api, "touch"); if (api.hit("down")) scDo(api, z.s.ground ? "unground" : "ground");
    if (api.hit("interact")) scCheck(api);
  }
  function scCheck(api) {
    var z = S.sc, R = z.R;
    if (R.quiz) { if (!z.s.near && z.log.indexOf("near") < 0) { say("Bring the mystery rod near first and watch the leaves."); return; }
      dlg(api, "<h2>Is the mystery rod + or −?</h2><p>The electroscope started positive. When the rod came near, did the leaves spread more, or close up?</p><div class='gm-actions'><button class='gm-btn' data-act='p'>Positive (+)</button><button class='gm-btn' data-act='n'>Negative (−)</button></div>", function (a) {
        if (a !== "p" && a !== "n") return; var ok = (a === "p" ? 1 : -1) === z.rod; api.hide(); if (ok) scWin(api, "Right! A rod with the same sign as the electroscope pushes more of that charge down to the leaves, so they spread further; an opposite rod pulls it up to the cap and the leaves close.");
        else { api.sound.sfx("lose"); say("Not this time. Same sign → leaves spread more; opposite → they close. Try again."); scReset(z.ri); } }); return; }
    if (z.s.near || z.s.ground) { say("Finish with the rod away and the earth wire disconnected, then check."); api.sound.sfx("block"); return; }
    if (V.scopeDone(z.s, R)) scWin(api, R.rod * R.goal > 0 ? "Charging by contact: some of the rod's charge flowed onto the electroscope, so it has the rod's sign." : "Charging by induction: the rod pushed like charge down to earth while the earth wire was connected. With the wire removed first, the electroscope keeps the opposite charge.");
    else { api.sound.sfx("lose"); say(z.s.N === 0 ? "The electroscope is neutral: the leaves hang straight down." : "Wrong sign! It ended up " + (z.s.N > 0 ? "positive" : "negative") + ".", 3.5); }
  }
  function scWin(api, why) {
    var z = S.sc; api.sound.sfx("goal"); api.banner("CHARGED", { col: "#c084fc", edge: "#2a0f40", size: 96, dur: 1.3 }); api.confetti(50, 480, 300);
    var ri = z.ri + 1; save.scRound = ri; persist();
    if (ri >= V.SCOPE.rounds.length) { save.scRound = 0; persist(); dlg(api, "<h2>Lab restored</h2><p>" + A.esc(why) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Back to the Quarter</button></div>", function () { api.hide(); leavePuzzle(api); complete(api, "scope"); }); }
    else dlg(api, "<h2>Correct</h2><p>" + A.esc(why) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Next experiment</button></div>", function () { api.hide(); scReset(ri); scBrief(api); });
  }
  function drawScope(x, api) {
    var z = S.sc, R = z.R, dd = V.scopeDist(z.s, z.rod), t = api.t;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#1c1430"); g.addColorStop(1, "#0b0814"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    txt(x, "Electroscope " + (z.ri + 1) + "/" + V.SCOPE.rounds.length + ": " + R.title, 24, 40, 26, "#fff", "left");
    txt(x, R.quiz ? "Is the mystery rod + or −?" : "Goal: leave it " + (R.goal > 0 ? "POSITIVE (+)" : "NEGATIVE (−)"), 24, 72, 22, "#e3b6ff", "left");
    var cx = 470, capY = 170; // jar
    x.fillStyle = "rgba(180,220,255,.08)"; x.strokeStyle = "rgba(200,230,255,.5)"; x.lineWidth = 3; x.beginPath(); x.moveTo(370, 230); x.lineTo(370, 450); x.quadraticCurveTo(370, 470, 390, 470); x.lineTo(550, 470); x.quadraticCurveTo(570, 470, 570, 450); x.lineTo(570, 230); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "#5a4a3a"; x.fillRect(440, 222, 60, 16);
    x.fillStyle = "#d9b45a"; x.beginPath(); x.ellipse(cx, capY, 56, 12, 0, 0, PI2); x.fill(); x.fillRect(cx - 4, capY, 8, 170);
    var ang = (6 + Math.min(4, Math.abs(dd.leaves)) * 11) * Math.PI / 180; x.fillStyle = "#f6d36b";
    [-1, 1].forEach(function (sd) { x.save(); x.translate(cx, 340); x.rotate(sd * ang); x.beginPath(); x.moveTo(-3, 0); x.lineTo(3, 0); x.lineTo(sd * 4, 90); x.lineTo(sd * -2, 90); x.closePath(); x.fill(); x.restore(); });
    function signs(n, px, py, spread) { var k = Math.min(6, Math.round(Math.abs(n) * 1.5)); for (var i = 0; i < k; i++) txt(x, n > 0 ? "+" : "−", px + (i - (k - 1) / 2) * spread, py, 20, n > 0 ? "#ff8a8a" : "#8ab4ff", "center", 0, 800); }
    signs(dd.cap, cx, capY - 18, 16);
    [-1, 1].forEach(function (sd) { var lx = cx + Math.sin(sd * ang) * 70, ly = 340 + Math.cos(ang) * 70; signs(dd.leaves / 2, lx + sd * 14, ly, 12); });
    // earth wire
    x.strokeStyle = z.s.ground ? "#3dd68c" : "rgba(255,255,255,.3)"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + 56, capY); x.lineTo(700, capY); x.lineTo(700, z.s.ground ? 420 : 380); x.stroke();
    x.fillStyle = z.s.ground ? "#3dd68c" : "#889"; [0, 1, 2].forEach(function (i) { x.fillRect(700 - 26 + i * 8, 430 + i * 8, 52 - i * 16, 4); });
    txt(x, z.s.ground ? "EARTH ON" : "earth off", 700, 470, 16, z.s.ground ? "#3dd68c" : "#99a", "center");
    // rod
    var rx = 60 + z.rodX * 250, ry = 70 + z.rodX * 40, rodCol = z.rod > 0 ? "#bfe6ff" : "#2a2a2a";
    x.save(); x.translate(rx, ry); x.rotate(.35); x.fillStyle = rodCol; x.fillRect(0, -9, 180, 18); x.strokeStyle = "rgba(255,255,255,.4)"; x.strokeRect(0, -9, 180, 18);
    if (!R.quiz) for (var i = 0; i < 5; i++) txt(x, z.rod > 0 ? "+" : "−", 100 + i * 16, 6, 18, z.rod > 0 ? "#ff6b6b" : "#7ab0ff", "center", 0, 800); x.restore();
    txt(x, R.quiz ? "Mystery rod (?)" : z.rod > 0 ? "Glass rod (+), rubbed with silk" : "Ebonite rod (−), rubbed with fur", 30, 466, 18, "#ddd", "left");
    if (!R.quiz) txt(x, "Net charge on the electroscope: " + (z.s.N > 0 ? "+" : z.s.N < 0 ? "−" : "") + Math.abs(z.s.N) + " units", 600, 100, 18, "#fff", "left");
    txt(x, "Steps: " + (z.log.join(" → ") || "none yet"), 600, 128, 15, "#bba", "left", 340);
    var bw = 132, by2 = 482; btn(x, api, 270, by2, bw, 44, "Near ▶", "sc:near"); btn(x, api, 410, by2, bw, 44, "◀ Away", "sc:away"); btn(x, api, 550, by2, bw, 44, "Touch ▲", "sc:touch"); btn(x, api, 690, by2, bw, 44, "Earth ▼", "sc:earth"); btn(x, api, 830, by2 - 56, 110, 44, "Check", "sc:check", "#c084fc"); btn(x, api, 830, by2, 110, 44, "Leave", "leave");
    void t;
  }

  /* =====================================================================================================
   * The Outer Ring (districts 7-12), the challenge ladder, the sandbox lab, upgrades and options (voltlab.js)
   * ===================================================================================================== */
  var OUT = VL.OUTER, OBY = {}; OUT.forEach(function (d, i) { d.i = i; OBY[d.id] = d; });
  var PCACHE = {};
  function ringDone(id) { return save.ring.indexOf(id) >= 0; }
  function ringOpen(d) { return heroOn() || (restored() >= DIST.length && (d.i === 0 || ringDone(OUT[d.i - 1].id))); }
  function outerPuzzle(d, i) { var k = d.id + i; return PCACHE[k] || (PCACHE[k] = VL.make(d.puzzles[i])); }
  function outerSolved(d, i) { return !!(save.outer[d.id] && save.outer[d.id][i]); }
  function bossOpen(d) { return d.puzzles.every(function (s, i) { return s.boss || s.side || outerSolved(d, i); }); }
  function districtCount() { return restored() + save.ring.length; }
  function earn(api, v, why) { save.volts += v; persist(); floatText(h.x, h.y - 1, "+" + v + " volts", "#ffd84a"); api.sound.sfx("coin"); if (why) say(why + " +" + v + " volts", 2.6); }

  function openMap(api) {
    var rows = "<tr><td>" + (restored() >= DIST.length ? "✅" : "⚡") + "</td><td><b>1–6. Inner city</b><br><small>" + DIST.map(function (d) { return (isDone(d.id) ? "✓ " : "") + A.esc(d.name); }).join(" · ") + "</small></td><td></td></tr>" +
      OUT.map(function (d) { var open = ringOpen(d), done = ringDone(d.id), n = d.puzzles.filter(function (s, i) { return outerSolved(d, i); }).length;
        return "<tr><td>" + (done ? "✅" : open ? "🚋" : "🔒") + "</td><td><b>" + d.stage + ". " + A.esc(d.name) + "</b>" + (open && !done ? "<br><small>" + A.esc(d.blurb) + "</small>" : "") + "</td><td>" +
          (open ? "<button class='gm-btn gm-btn--sm' data-act='d' data-id='" + d.id + "'>" + (done ? "Revisit" : "Ride the tram") + " (" + n + "/" + d.puzzles.length + ")</button>" : "<small>" + (restored() < DIST.length ? "Light all six inner districts first" : "Restore " + A.esc(OUT[d.i - 1].name) + " first") + "</small>") + "</td></tr>"; }).join("");
    dlg(api, "<h2>City map</h2><p>" + districtCount() + " of " + (DIST.length + OUT.length) + " districts lit · ⚡ " + save.volts + " volts · 🔷 " + save.shards + " prism shards</p><table class='gm-maptable'>" + rows + "</table>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='close'>Back to the city</button><button class='gm-btn' data-act='ladder'>Challenge ladder</button><button class='gm-btn' data-act='lab'>Sandbox lab</button><button class='gm-btn' data-act='up'>Upgrades</button></div>",
      function (a, el) { if (a === "d") return openDistrict(api, OBY[el.getAttribute("data-id")]); if (a === "ladder") return openLadder(api); if (a === "lab") { api.hide(); return openSandbox(api); } if (a === "up") return openUpgrades(api); api.hide(); });
  }
  function openDistrict(api, d) {
    if (save.ringNotes.indexOf(d.id) < 0) { save.ringNotes.push(d.id); persist(); }
    var list = d.puzzles.map(function (sp, i) { var p = outerPuzzle(d, i), ok = outerSolved(d, i), lock = sp.boss && !bossOpen(d) && !heroOn();
      return "<tr><td>" + (ok ? "✅" : lock ? "🔒" : sp.boss ? "👑" : sp.side ? "⭐" : "⚡") + "</td><td><b>" + A.esc(p.title || "") + "</b>" + (sp.side ? " <small>(side job, optional)</small>" : "") + "</td><td>" +
        (lock ? "<small>Finish the others first</small>" : "<button class='gm-btn gm-btn--sm' data-act='p' data-i='" + i + "'>" + (ok ? "Replay" : "Start") + "</button>") + "</td></tr>"; }).join("");
    dlg(api, "<h2 style='color:" + d.col + "'>" + A.esc(d.name) + "</h2><p>" + A.esc(d.blurb) + "</p><p class='gm-small'><b>" + A.esc(d.npc) + ":</b> “Welcome to the Outer Ring. Every job here pays in volts.”</p>" +
      "<details><summary>Field note: " + A.esc(d.note[0]) + "</summary><p>" + A.esc(d.note[1]) + "</p></details><table>" + list + "</table>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='map'>City map</button><button class='gm-btn' data-act='close'>Back to the city</button></div>",
      function (a, el) { if (a === "p") { var i = +el.getAttribute("data-i"); api.hide(); return openPuzzle(api, outerPuzzle(d, i), { type: "outer", d: d, i: i, label: d.name + ": " + outerPuzzle(d, i).title }); } if (a === "map") return openMap(api); api.hide(); });
  }
  function openPuzzle(api, p, ctx) {
    ctx.tries = 0;
    if (p.kind === "probe" || p.kind === "mag") return openBoard(api, p, ctx);
    return choicePuzzle(api, p, ctx, {});
  }
  function openBoard(api, L, ctx) {
    S.mode = "probe"; S.pz = { c: { label: ctx.label }, L: L, ctx: ctx, kind: L.kind === "mag" ? "mag" : "probe", placed: [], cur: [3, 3], run: null, res: null, preview: null, lines: [], pot: false }; setPad(api, "puzzle"); probeUpdate();
    api.music(A.song(ctx.d ? ctx.d.song[0] : 919, ctx.d ? ctx.d.song[1] : "synthwave"));
    if (L.sandbox) return dlg(api, "<h2>Sandbox lab</h2><p>Place up to 10 charges anywhere. The arrows show the field E, the lines are field lines, and Show potential paints V = Σ kQ/r (red high, blue low). Release the probe to see where the field throws it.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Play</button></div>", function () { api.hide(); });
    dlg(api, "<h2>" + A.esc(ctx.label) + "</h2><p>" + (L.kind === "mag" ? "A charged grain (+2 µC) flies in from the left at 1.5 m/s. Lay magnet tiles so the magnetic force curls it into the receiver." : "Release a + probe charge from the source and build an electric field that steers it into the receiver.") +
      "</p><p>" + A.esc(L.hint) + "</p><p>Place up to <b>" + L.give + "</b>. Tap a square to cycle " + (L.kind === "mag" ? "⊗ in / ⊙ out / empty" : "+ / − / empty") + "." + (L.preview || upLvl("visor") ? " The dotted line predicts the path." : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start</button></div>", function () { api.hide(); });
  }
  function boardDone(api, z) {
    if (z.L.sandbox) { z.run = null; return say(z.res.why ? z.res.why + " (" + (z.res.path.length / 240).toFixed(1) + " s)" : "Free flight", 3); }
    if (z.res.ok) { api.sound.sfx("power"); api.banner(z.ctx.type === "ladder" ? "RUNG " + z.ctx.n + "!" : "SOLVED", { col: z.ctx.d ? z.ctx.d.col : "#ffd84a", size: 92, dur: 1.2 }); api.confetti(50, 480, 300);
      return solved(api, z.ctx, function () { leavePuzzle(api); }); }
    z.ctx.tries++; api.sound.sfx("lose");
    dlg(api, "<h2>Not quite</h2><p>" + A.esc(z.res.why) + "</p><p>" + A.esc(z.L.hint) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='retry'>Adjust</button><button class='gm-btn' data-act='leave'>Leave</button></div>",
      function (a) { z.run = null; api.hide(); if (a === "leave") leavePuzzle(api); });
  }
  /* choice puzzles: dielectric capacitors, lamp circuits, Gauss's law, field-line reading, velocity selector */
  function choicePuzzle(api, p, ctx, st) {
    var html = "<h2>" + A.esc(ctx.label) + "</h2><p>" + A.esc(p.brief) + "</p>", ch = null, read = "";
    function grp(key, items, lab) { return "<p class='gm-small'><b>" + lab + "</b></p><div class='gm-actions' style='justify-content:flex-start;flex-wrap:wrap'>" + items.map(function (t, i) { return "<button class='gm-btn gm-btn--sm' data-act='set' data-k='" + key + "' data-v='" + i + "' aria-pressed='" + (st[key] === i) + "'>" + A.esc(t) + "</button>"; }).join("") + "</div>"; }
    if (p.kind === "diel") { html += grp("m", VL.MATS.map(function (m) { return m.name + " κ " + m.k.toFixed(m.k < 1.1 ? 3 : 1); }), "Dielectric") + grp("g", VL.GAPS.map(function (g) { return (g * 1000) + " mm"; }), "Gap d");
      if (st.m != null && st.g != null) { ch = [st.m, st.g]; var C = VL.dielC(p, st.m, st.g), E = p.V / VL.GAPS[st.g]; read = "C = κε0A/d = " + VL.fmt(C, "F") + " (target " + VL.fmt(p.C, "F") + ") · E = V/d = " + (E / 1e6).toFixed(2) + " MV/m (" + VL.MATS[st.m].name + " holds " + VL.MATS[st.m].Emax / 1e6 + ")"; } }
    else if (p.kind === "ohm") { var sh = VL.SHELF.map(function (r) { return r + " Ω"; }); html += grp("a", sh, "First resistor") + grp("b", ["none"].concat(sh), "Second resistor") + grp("w", ["series", "parallel"], "Wire the pair in");
      if (st.a != null) { ch = [st.a, st.b ? st.b - 1 : -1, st.b ? (st.w === 1 ? "par" : "ser") : "one"]; var Rn = VL.ohmNet(ch), I = p.emf / (p.RL + Rn); read = "R = " + Rn.toFixed(1) + " Ω · I = ε/(R_lamp + R) = " + (I * 1000).toFixed(1) + " mA (target " + (p.I * 1000).toFixed(0) + " mA)"; } }
    else if (p.kind === "sel") { html += grp("v", VL.SEL_V.map(function (v) { return v + " V"; }), "Plate voltage (d = 1 cm)") + grp("b", VL.SEL_B.map(function (b) { return b + " T"; }), "B1 in the selector") + (p.R != null ? grp("c", VL.SEL_B2.map(function (b) { return b + " T"; }), "B2 in the spectrometer") : "");
      if (st.v != null && st.b != null && (p.R == null || st.c != null)) { ch = p.R == null ? [st.v, st.b] : [st.v, st.b, st.c]; var vv = VL.SEL_V[st.v] / VL.SEL_D / VL.SEL_B[st.b]; read = "v = E/B = " + VL.fmtNum(vv) + " m/s (beam " + VL.fmtNum(p.v) + " m/s)" + (p.R != null ? " · r = mv/(qB2) = " + (p.mass * vv / (1.602e-19 * VL.SEL_B2[st.c]) * 100).toFixed(1) + " cm (detector " + (p.R * 100).toFixed(1) + " cm)" : ""); } }
    else { html += "<canvas data-figure width='520' height='300' style='width:auto;height:auto;max-width:100%;max-height:34vh;aspect-ratio:52/30;border-radius:12px;background:#0b1622;display:block;margin:0 auto 8px'></canvas>" +
      grp("o", p.options.map(function (o) { return p.kind === "gauss" ? "Φ = " + Math.round(o) + " N·m²/C" : o; }), p.kind === "gauss" ? "Flux through the loop" : "Charges"); if (st.o != null) ch = st.o; }
    if (read) html += "<p class='gm-formula'>" + A.esc(read) + "</p>";
    if (st.why) html += "<p role='status' style='color:#fca5a5;font-weight:700'>" + A.esc(st.why) + "</p>";
    html += "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='check'" + (ch == null ? " disabled" : "") + ">Check</button><button class='gm-btn' data-act='leave'>Leave</button></div>";
    dlg(api, html, function (a, el) {
      if (a === "set") { st.why = ""; st[el.getAttribute("data-k")] = +el.getAttribute("data-v"); api.sound.sfx("click"); return choicePuzzle(api, p, ctx, st); }
      if (a === "check" && ch != null) { var res = VL.check(p, ch);
        if (res.ok) { api.hide(); api.sound.sfx("power"); api.banner(ctx.type === "ladder" ? "RUNG " + ctx.n + "!" : "SOLVED", { col: ctx.d ? ctx.d.col : "#ffd84a", size: 92, dur: 1.2 }); api.confetti(50, 480, 300); return solved(api, ctx); }
        ctx.tries++; api.sound.sfx("lose"); st.why = res.why || "Not that one. Look again."; return choicePuzzle(api, p, ctx, st); }
      api.hide();
    });
    if (p.kind === "gauss" || p.kind === "lines") drawFigure(p);
  }
  function drawFigure(p) {
    var cv = document.querySelector("[data-figure]"); if (!cv) return; var x = cv.getContext("2d"), W2 = cv.width, H2 = cv.height, sx = function (v) { return 20 + v * (W2 - 40); }, sy = function (v) { return 10 + v * (H2 - 20); };
    x.fillStyle = "#0b1622"; x.fillRect(0, 0, W2, H2);
    var ch = p.kind === "lines" ? VL.lineCharges(p.set) : p.charges;
    if (p.kind === "lines") { x.strokeStyle = "rgba(126,240,255,.7)"; x.lineWidth = 1.4; VL.fieldLines(ch, 10).forEach(function (pts) { x.beginPath(); pts.forEach(function (q, i) { var px = sx(q[0]), py = sy(q[1]); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); });
      ch.forEach(function (c) { x.fillStyle = "#334155"; x.beginPath(); x.arc(sx(c.x), sy(c.y), 9, 0, PI2); x.fill(); x.fillStyle = "#cbd5e1"; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText("?", sx(c.x), sy(c.y) + 5); }); return; }
    x.strokeStyle = "#c084fc"; x.lineWidth = 3; x.setLineDash([8, 6]); x.beginPath(); p.loop.forEach(function (q, i) { if (i) x.lineTo(sx(q[0]), sy(q[1])); else x.moveTo(sx(q[0]), sy(q[1])); }); x.closePath(); x.stroke(); x.setLineDash([]);
    ch.forEach(function (c) { var pos = c.q > 0; x.fillStyle = pos ? "#e74c3c" : "#3b6fd8"; x.beginPath(); x.arc(sx(c.x), sy(c.y), 14, 0, PI2); x.fill(); x.fillStyle = "#fff"; x.font = "700 13px system-ui"; x.textAlign = "center"; x.fillText((pos ? "+" : "−") + Math.abs(Math.round(c.q * 1e9)) + "nC", sx(c.x), sy(c.y) + 4); });
  }
  function solved(api, ctx, after) {
    var first = ctx.tries === 0, pay;
    if (ctx.type === "outer") { var d = ctx.d, sp = d.puzzles[ctx.i], fresh = !outerSolved(d, ctx.i); save.outer[d.id] = save.outer[d.id] || {}; save.outer[d.id][ctx.i] = 1;
      pay = fresh ? (sp.boss ? 80 : sp.side ? 40 : 25) : 5; if (fresh && first) { save.shards++; } if (sp.side && fresh) save.bonus = (save.bonus || 0) + 2; earn(api, pay, fresh && first ? "First try: +1 prism shard." : "");
      if (after) after(); if (sp.boss && !ringDone(d.id)) return restoreRing(api, d); return openDistrict(api, d); }
    if (ctx.type === "ladder") { pay = VL.ladderReward(ctx.n); save.ladder = ctx.n; save.ladderBest = Math.max(save.ladderBest, ctx.n); earn(api, pay, "Rung " + ctx.n + " cleared.");
      if (ctx.n % 5 === 0 && A.report) A.report("volt-city", { result: "win", score: ctx.n * 100 });
      if (ctx.n % 10 === 0) api.ceremony("newRecord", { title: "RUNG " + ctx.n, sub: "Challenge ladder", trophy: "medal", len: 2.6, score: save.ladderBest, scoreLabel: "Best rung", then: function () { if (after) after(); openLadder(api); } });
      else { if (after) after(); openLadder(api); } }
  }
  function restoreRing(api, d) {
    save.ring.push(d.id); persist(); var last = d.i === OUT.length - 1, score = 400 + d.stage * 50 + save.shards * 10;
    if (A.report) A.report("volt-city", { result: "win", stage: d.stage, score: score });
    api.sound.sfx("power"); api.sound.roar();
    var whoC = A.styled ? A.styled(A.byId[save.who] || A.CAST[0]) : A.byId[save.who];
    api.ceremony(last ? "gameComplete" : "stageClear", { title: last ? "THE RING IS LIT!" : "RESTORED!", sub: d.name, hero: whoC, trophy: last ? "crown" : "star", colors: [d.col, "#ffd86b", "#7ef0ff", "#ffffff"], len: last ? 6 : 2.8,
      score: score, scoreLabel: "District score", stats: [["District", d.stage + " of 12"], ["Prism shards", save.shards], ["Volts", save.volts]],
      line: last ? "All twelve districts shine. Entropy's echo has faded from the Spire." : d.name + " hums again. The tram runs on to the next district.", then: function () { openMap(api); } });
  }
  function openLadder(api) {
    var n = save.ladder + 1, p = VL.ladder(n), next = p ? p.title + ": " + (p.kind === "probe" ? "probe board" : p.kind === "mag" ? "magnet board" : p.kind === "diel" ? "dielectric capacitor" : p.kind === "ohm" ? "lamp circuit" : p.kind === "gauss" ? "Gauss's law" : p.kind === "sel" ? (p.R != null ? "mass spectrometer" : "velocity selector") : "read the field") : "";
    dlg(api, "<h2>Challenge ladder</h2><p>An endless climb. Every rung is generated from a solution the physics has already flown, so it can always be solved, and each one is a little harder than the last.</p><p><b>Next:</b> " + A.esc(next) + "<br><b>Best rung:</b> " + save.ladderBest + " · <b>Reward:</b> " + VL.ladderReward(n) + " volts</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Climb</button>" + (save.ladder ? "<button class='gm-btn' data-act='restart'>Start again at rung 1</button>" : "") + "<button class='gm-btn' data-act='map'>City map</button></div>",
      function (a) { if (a === "go" && p) { api.hide(); return openPuzzle(api, p, { type: "ladder", n: n, label: "Ladder " + p.title }); } if (a === "restart") { save.ladder = 0; persist(); return openLadder(api); } if (a === "map") return openMap(api); api.hide(); });
  }
  function openSandbox(api) { openBoard(api, { src: [0, 3], v: [0.5, 0], dst: [-9, -9], walls: [], fixed: [], give: 10, preview: true, sandbox: true, hint: "" }, { type: "sandbox", label: "Sandbox lab" }); }
  function openUpgrades(api) {
    var rows = VL.UPGRADES.map(function (u) { var lv = upLvl(u.id), full = lv >= u.max, cost = full ? 0 : u.cost[lv];
      return "<tr><td><b>" + A.esc(u.name) + "</b> " + (lv ? "(level " + lv + "/" + u.max + ")" : "") + "<br><small>" + A.esc(u.desc) + "</small></td><td>" + (full ? "Max" : "<button class='gm-btn gm-btn--sm' data-act='buy' data-id='" + u.id + "'" + (save.volts < cost ? " disabled" : "") + ">" + cost + " volts</button>") + "</td></tr>"; }).join("");
    dlg(api, "<h2>Volt Pack upgrades</h2><p>You have <b>" + save.volts + " volts</b>. Earn more in the Outer Ring and on the challenge ladder.</p><table>" + rows + "</table><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='map'>City map</button><button class='gm-btn' data-act='close'>Close</button></div>",
      function (a, el) { if (a === "buy") { var u = VL.UPGRADES.filter(function (o) { return o.id === el.getAttribute("data-id"); })[0], lv = upLvl(u.id); if (lv < u.max && save.volts >= u.cost[lv]) { save.volts -= u.cost[lv]; save.up[u.id] = lv + 1; if (u.id === "cells") h.hp = maxHp(); persist(); api.sound.sfx("power"); } return openUpgrades(api); }
        if (a === "map") return openMap(api); api.hide(); });
  }
  function openOptions(api) { api.hide(); if (api.openSettings) api.openSettings(); } // Volt City's options live in the shared Settings screen
  function setupSettings(api) {
    if (!api.settings || !api.settings.add) return;
    var sec = "Volt City";
    [["vcLines", "lines", "Field lines around pylons", "Streamlines of E from every powered pylon."], ["vcArrow", "arrow", "Force arrow on your hero", "The net Coulomb force F on your Volt Pack."],
     ["vcPred", "pred", "Launch prediction", "Where a flip would throw you while you are stuck to a pylon."]].forEach(function (o) {
      api.settings.add({ id: o[0], tab: "gameplay", section: sec, label: o[2], type: "toggle", default: save.opt[o[1]] !== false, help: o[3], apply: function (v) { save.opt[o[1]] = !!v; persist(); } }); });
    api.settings.add({ id: "vcHudFit", tab: "display", section: sec, label: "Enlarge the HUD on small screens", type: "toggle", default: save.opt.hud !== "normal", help: "Keeps the objective card readable on phones. HUD size also follows HUD scale above.",
      apply: function (v) { save.opt.hud = v ? "auto" : "normal"; persist(); HK.n = 0; } });
  }
  function drawMagTiles(x, z) {
    var all = z.L.fixed.concat(z.placed), C = PB.C;
    all.forEach(function (q) { var px = PB.BX + q.c * C, py = PB.BY + q.r * C, into = q.s > 0, fixed = z.L.fixed.indexOf(q) >= 0;
      x.fillStyle = into ? "rgba(168,85,247,.45)" : "rgba(14,165,233,.45)"; x.fillRect(px + 2, py + 2, C - 4, C - 4);
      x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.arc(px + C / 2, py + C / 2, 16, 0, PI2); x.stroke();
      if (into) { x.beginPath(); x.moveTo(px + C / 2 - 11, py + C / 2 - 11); x.lineTo(px + C / 2 + 11, py + C / 2 + 11); x.moveTo(px + C / 2 + 11, py + C / 2 - 11); x.lineTo(px + C / 2 - 11, py + C / 2 + 11); x.stroke(); }
      else { x.fillStyle = "#fff"; x.beginPath(); x.arc(px + C / 2, py + C / 2, 5, 0, PI2); x.fill(); }
      if (fixed) { x.strokeStyle = "#c084fc"; x.setLineDash([4, 4]); x.strokeRect(px + 4, py + 4, C - 8, C - 8); x.setLineDash([]); } });
  }
  function drawPot(x, all) { // potential V = Σ kQ/r painted per cell (red above zero, blue below)
    for (var r = 0; r < PS.ROWS; r++) for (var c = 0; c < PS.COLS; c++) { var v = 0, px = (c + .5) * PS.CELL, py = (r + .5) * PS.CELL;
      all.forEach(function (q) { v += PS.K * PS.Q * q.s / Math.sqrt(Math.pow(px - (q.c + .5) * PS.CELL, 2) + Math.pow(py - (q.r + .5) * PS.CELL, 2) + 9e-4); });
      var a = Math.min(.55, Math.log10(1 + Math.abs(v) / 1000) / 5); x.fillStyle = v > 0 ? "rgba(239,68,68," + a + ")" : "rgba(59,130,246," + a + ")"; x.fillRect(PB.BX + c * PB.C, PB.BY + r * PB.C, PB.C, PB.C); }
  }

  /* ---------- canvas buttons and text ---------- */
  var BTNS = [];
  function btn(x, api, bx, by, bw, bh, label, act, col) { BTNS.push({ x: bx, y: by, w: bw, h: bh, act: act });
    x.fillStyle = col ? col : "rgba(255,255,255,.12)"; rr(x, bx, by, bw, bh, 12); x.fill(); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.5; x.stroke(); txt(x, label, bx + bw / 2, by + bh / 2 + 7, 20, col ? "#06121a" : "#fff", "center", 0, 700); }
  function rr(x, a, b, w, hh, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + hh, r); x.arcTo(a + w, b + hh, a, b + hh, r); x.arcTo(a, b + hh, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function txt(x, s, px, py, size, col, align, maxW, weight) { x.font = (weight || 600) + " " + size + "px system-ui, sans-serif"; x.textAlign = align || "left"; x.fillStyle = col;
    if (maxW && x.measureText(s).width > maxW) { var words = String(s).split(" "), line = "", yy = py; words.forEach(function (w) { var test = line ? line + " " + w : w; if (x.measureText(test).width > maxW && line) { x.fillText(line, px, yy); line = w; yy += size * 1.2; } else line = test; }); x.fillText(line, px, yy); return; }
    x.fillText(s, px, py); }
  function clickBtn(api, act) {
    if (act === "leave") return leavePuzzle(api);
    if (act === "release") return probeRelease(api);
    if (act === "pot") { S.pz.pot = !S.pz.pot; return; }
    if (act === "capopt") { var z = S.cp, R = V.CAP.rounds[z.ri]; if (z.V > .05) { say("Bleed the charge off before rewiring."); return; } z.opt = (z.opt + 1) % V.capOptions(R); api.sound.sfx("click"); return; }
    if (act === "capfire") return capFire(api);
    if (act === "eqreset") { eqReset(S.eq.li); return; }
    if (act.indexOf("sc:") === 0) { var a = act.slice(3); if (a === "check") return scCheck(api); if (a === "earth") a = S.sc.s.ground ? "unground" : "ground"; return scDo(api, a); }
    if (act === "log") return openLog(api);
  }

  /* ---------- music ---------- */
  var HUB_SONG = A.song(207, "afro", { bpm: 104 });
  function songFor(z) { var d = ZONE_D[z]; if (!d) return HUB_SONG; if (d.id === "tower" && !S.boss) return A.song(13, "dub", { bpm: 84 }); return A.song(d.song[0], d.song[1]); }

  /* ---------- touch layouts ---------- */
  function setPad(api, mode) { api.useActions(mode === "world" ? ["left", "right", "up", "down", "flip", "interact", "dash", "log"] : mode === "intro" ? ["interact"] : ["left", "right", "up", "down", "flip", "interact", "back"]); }

  /* =====================================================================================================
   * World update
   * ===================================================================================================== */
  function worldStep(api, dt) {
    S.tod = (S.tod + dt / 360) % 1;
    if (S.cine) { cineStep(api, dt); stepFx(dt); return; }
    var ix = (api.down("right") ? 1 : 0) - (api.down("left") ? 1 : 0), iy = (api.down("down") ? 1 : 0) - (api.down("up") ? 1 : 0);
    if (api.hit("flip")) flip(api);
    if (api.hit("log")) return openLog(api);
    h.dashCD -= dt; h.inv -= dt; h.dashT -= dt;
    var dbl = api.double("left") ? [-1, 0] : api.double("right") ? [1, 0] : api.double("up") ? [0, -1] : api.double("down") ? [0, 1] : null;
    if (api.hit("dash") && !dbl) dbl = ix || iy ? [ix, iy] : [h.face, 0];
    if (dbl && h.dashCD <= 0 && !h.water) { var dm = Math.hypot(dbl[0], dbl[1]); h.vx = dbl[0] / dm * V.HERO.dashV; h.vy = dbl[1] / dm * V.HERO.dashV; h.dashCD = .7 * (1 - .2 * upLvl("dash")); h.inv = Math.max(h.inv, .3); h.dashT = .25; api.sound.sfx("dash"); puff(h.x, h.y, "#ffffff", 8, 2, .3); }
    // dynamic sources: crates, enemies, Count Entropy (Newton's third law: they push back on you)
    var dyn = S.static.slice(); S.crates.forEach(function (c) { dyn.push({ x: c.x, y: c.y, q: c.q * UC }); }); S.ens.forEach(function (e) { dyn.push({ x: e.x, y: e.y, q: e.q }); }); if (S.boss) dyn.push({ x: S.boss.x, y: S.boss.y, q: S.boss.q });
    S.ws.sources = dyn; h.touch = null;
    V.heroStep(h, { x: ix, y: iy }, S.ws, dt); S.ws.sources = S.static;
    if (ix) h.face = ix; if (ix || iy) h.walk += dt;
    if (h.bonk > 6) { api.kick(5); api.sound.sfx("bounce"); puff(h.x, h.y, "#fff", 6, 2); }
    if (h.fell) { h.fell = false; puff(h.x, h.y, "#9fd8ff", 18, 4, .8); api.sound.sfx("heavy"); floatText(h.x, h.y - .5, "Splash!", "#9fd8ff"); h.x = h.safe[0]; h.y = h.safe[1]; h.vx = h.vy = 0; hurt(api, 1); if (!S.hint.fall) { S.hint.fall = 1; say("Too slow over the water! Launch from a pylon to fly across.", 4); } }
    // crates and the plate
    S.crates.forEach(function (c) { V.crateStep(c, S.static.concat([{ x: h.x, y: h.y, q: h.q }]), S.ws, dt); var p = V.onPlate(c);
      if (p && !save.tasks.gate) { save.tasks.gate = 1; persist(); S.open["gate:36,38"] = true; rebuild(); api.sound.sfx("power"); api.banner("GATE OPEN", { col: "#f6c445", size: 90, dur: 1.4 }); say("The crate's weight on the plate opened the gate. Relay B is through there."); } });
    // zones, music, enemies
    var z = zoneHere(); if (z && z !== S.zone) { S.zone = z; api.music(songFor(z)); var d = ZONE_D[z];
      if (!h.water) S.checkpoint = [h.x, h.y]; if (d) { say(d.name + (isDone(d.id) ? " (restored)" : ""), 2.4); } else say("Central Plaza", 2); }
    if (z && ZONE_D[z] && !isDone(ZONE_D[z].id) && restored() >= ZONE_D[z].stage - 1) spawnZone(z);
    for (var i = S.ens.length - 1; i >= 0; i--) if (S.ens[i]) enemyStep(api, S.ens[i], dt);
    // boss
    if (!S.boss && !S.bossGone && !S.cine && !isDone("tower") && restored() >= 5 && areaHere() === "tower") bossStart(api);
    if (S.boss) { if (h.x < 25.3 || h.x > 33.7 || h.y < 2.3 || h.y > 6.7) { h.x = clamp(h.x, 25.3, 33.7); h.y = clamp(h.y, 2.3, 6.7); h.vx *= -.4; h.vy *= -.4; if (!S.hint.field) { S.hint.field = 1; say("Count Entropy's forcefield keeps you on the island until he's grounded.", 3.5); } }
      bossStep(api, dt); if (S.boss && areaHere() !== "tower" && areaHere() !== "islet") { S.boss = null; S.ens = S.ens.filter(function (e) { return e.z !== "tower"; }); } }
    if (S.bossGone) { S.bossGone.t += dt; if (S.bossGone.t > 1.6 && !S.bossGone.done) { S.bossGone.done = 1; complete(api, "boss"); } if (S.bossGone && S.bossGone.t > 3) S.bossGone = null; }
    // storm wave
    if (S.td) { tdWorld(api, dt); }
    // crystals
    V.CRYSTALS.forEach(function (c, i) { if (save.crystals.indexOf(i) >= 0) return; if (Math.hypot(c[0] - h.x, c[1] - h.y) < .65 + .6 * upLvl("magnet")) { save.crystals.push(i); persist(); api.sound.sfx("coin"); puff(c[0], c[1], "#7ef0ff", 14, 3);
      var have = crystalsHave(), tr = V.TRAILS.filter(function (t) { return t.need === have; })[0]; floatText(c[0], c[1] - .5, "◆ " + save.crystals.length + "/" + V.CRYSTALS.length, "#7ef0ff");
      if (tr) { say("New trail unlocked: " + tr.name + "! Equip it in the quest log.", 4); api.sound.sfx("power"); } } });
    if (api.hit("interact")) interact(api);
    if (!S.hint.repel) S.ws.pylons.forEach(function (p) { if (p.on && p.q * h.q > 0 && Math.hypot(p.x - h.x, p.y - h.y) < 2.2) { S.hint.repel = 1; say("Same sign as the pylon: it pushes you away. Flip (" + keyOf("flip") + ") to be pulled in instead.", 4.5); } });
    // trail
    if (Math.hypot(h.vx, h.vy) > 1) { S.trail.push([h.x, h.y, api.t]); if (S.trail.length > 26) S.trail.shift(); } else if (S.trail.length) S.trail.shift();
    // predicted launch path while touching a pylon that attracts you
    S.predT -= dt; if (h.touch && h.touch.pylon && h.touch.on && h.touch.q * h.q < 0) { if (S.predT <= 0) { S.predT = .15; S.pred = predict(); } if (!S.hint.flip) { S.hint.flip = 1; say("Stuck to the pylon! Flip (" + keyOf("flip") + ") to be thrown away from it. The dotted line shows where.", 5); } }
    else if (!h.touch || !h.touch.pylon) S.pred = null;
    stepFx(dt);
  }
  function predict() { var p = { x: h.x, y: h.y, vx: 0, vy: 0, q: -h.q, F: [0, 0], safe: [h.x, h.y] }, pts = [], dt = 1 / 60; for (var i = 0; i < 100; i++) { V.heroStep(p, {}, S.ws, dt); if (i % 3 === 0) pts.push([p.x, p.y]); if (p.fell) { pts.fell = true; break; } } return pts; }
  function stepFx(dt) {
    for (var i = S.fx.length - 1; i >= 0; i--) { var p = S.fx[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; if (p.life <= 0) S.fx.splice(i, 1); }
    for (i = TEXTS.length - 1; i >= 0; i--) { TEXTS[i].life -= dt; if (TEXTS[i].life <= 0) TEXTS.splice(i, 1); }
    if (S.msg) { S.msg.life -= dt; if (S.msg.life <= 0) S.msg = null; }
    if (S.bolts) { S.bolts.t -= dt; if (S.bolts.t <= 0) S.bolts = null; }
  }
  function tdWorld(api, dt) {
    if (zoneHere() !== "heights") { S.td = null; say("You left the storm. The generator reset."); api.music(songFor(zoneHere())); return; }
    var td = S.td, w0 = td.wave;
    V.tdStep(td, dt, function (e) { var f = V.coulomb(e.q, h.q, e.x - h.x, e.y - h.y, .3); return [f[0] / V.TD.em, f[1] / V.TD.em]; });
    td.events.forEach(function (ev) { if (ev === "wave" && td.wave < V.TD.waves.length) { api.banner("WAVE " + (td.wave + 1), { col: "#ff9d5c", edge: "#4a1f00", size: 96, dur: 1.3 }); }
      else if (ev === "hurt") { api.sound.sfx("hit"); api.kick(6); floatText(V.TD.gen[0], V.TD.gen[1] - 1, "Generator hit!", "#ff6b6b"); }
      else if (ev[0] === "zap") { api.sound.sfx("zap"); S.zaps = S.zaps || []; S.zaps.push({ a: [ev[1], ev[2]], b: [ev[3], ev[4]], t: .25 }); puff(ev[3], ev[4], "#fff2a8", 8, 3); }
      else if (ev[0] === "strike") { api.sound.sfx("boom"); api.flash("#e8f4ff", .18); api.kick(10); S.strike = { x: ev[1], y: ev[2], t: .35, safe: ev[3] }; if (!ev[3]) floatText(ev[1], ev[2] - 1, "Lightning hit the generator!", "#ff6b6b"); } });
    void w0;
    if (td.done) { var won = td.won; S.td = null; api.music(songFor("heights"));
      if (won) complete(api, "td"); else { api.banner("GENERATOR DOWN", { col: "#ff6b6b", edge: "#3a0000", sad: true, size: 80, dur: 2 }); api.sound.sfx("lose"); say("Make sure one rod stands within 3 m of the generator, then try other pads.", 5); } }
  }

  /* =====================================================================================================
   * Drawing: world
   * ===================================================================================================== */
  var LC = document.createElement("canvas"); LC.width = 480; LC.height = 270; var LX = LC.getContext("2d");
  function nightAmt() { return .5 - .5 * Math.cos(S.tod * PI2); } // 0 = noon, 1 = midnight
  function drawWorld(x, api) {
    var cam = S.cam, t = api.t, red = api.reduce, i;
    var tx0 = Math.max(0, Math.floor(cam.x / T) - 1), ty0 = Math.max(0, Math.floor(cam.y / T) - 1), tx1 = Math.min(V.W - 1, Math.ceil((cam.x + 960) / T)), ty1 = Math.min(V.H - 1, Math.ceil((cam.y + 540) / T) + 3);
    var night = nightAmt(), sunX = -1 + 2 * ((S.tod + .25) % 1), shX = sunX * 18, shY = 14;
    // ground pass
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) groundTile(x, tx, ty, tx * T - cam.x, ty * T - cam.y, t, red);
    // shadows of buildings and trees
    x.fillStyle = "rgba(0,0,0," + (.28 - night * .14) + ")";
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) { var ch = V.MAP[ty][tx]; if (ch === "#") { var b = BOF[tx + "," + ty], k = b.h / 60; x.fillRect(tx * T - cam.x + shX * k, ty * T - cam.y + shY * k * .6, T, T); } else if (ch === "T") { x.beginPath(); x.ellipse(tx * T - cam.x + T / 2 + shX * .6, (ty + 1) * T - cam.y - 4, 20, 8, 0, 0, PI2); x.fill(); } }
    // decals: rod pads, plates, consoles' bases, field lines
    if (save.opt.lines) drawFieldLines(x, t, red);
    V.TD.pads.forEach(function (p, i) { var px = p[0] * T - cam.x, py = p[1] * T - cam.y; x.strokeStyle = save.rods.indexOf(i) >= 0 ? "#ffd84a" : "rgba(255,216,74,.55)"; x.lineWidth = 3; x.setLineDash([6, 5]); x.beginPath(); x.arc(px, py, 18, 0, PI2); x.stroke(); x.setLineDash([]); });
    if (zoneHere() === "heights" && (S.td || !isDone("heights"))) { x.strokeStyle = "rgba(255,120,80,.35)"; x.lineWidth = 6; x.setLineDash([10, 10]); x.lineDashOffset = red ? 0 : -t * 30; x.beginPath(); V.TD.path.forEach(function (p, i) { var px = p[0] * T - cam.x, py = p[1] * T - cam.y; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); x.setLineDash([]); x.lineDashOffset = 0;
      x.strokeStyle = "rgba(126,240,255,.25)"; x.lineWidth = 2; x.beginPath(); x.arc(V.TD.gen[0] * T - cam.x, V.TD.gen[1] * T - cam.y, V.TD.protectR * T, 0, PI2); x.stroke(); }
    V.PLATES.forEach(function (p) { var px = p.x * T - cam.x, py = p.y * T - cam.y; x.fillStyle = save.tasks.gate ? "#f6c445" : "#6b6f7a"; x.fillRect(px + 8, py + 8, T - 16, T - 16); x.strokeStyle = "#222"; x.strokeRect(px + 8, py + 8, T - 16, T - 16); });
    // object pass, sorted by foot y
    var list = [];
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) { var c2 = V.MAP[ty][tx]; if ("#Th|GX^".indexOf(c2) >= 0) list.push({ y: (ty + 1) * T - (c2 === "#" ? 0 : 2), tx: tx, ty: ty, ch: c2 }); }
    function inView(px, py) { return px > cam.x - 120 && px < cam.x + 1080 && py > cam.y - 80 && py < cam.y + 700; }
    LAMPS.forEach(function (l) { if (inView(l.x * T, l.y * T)) list.push({ y: l.y * T + 2, lamp: l }); });
    S.ws.pylons.forEach(function (p) { if (inView(p.x * T, p.y * T)) list.push({ y: p.y * T + 10, pyl: p }); });
    V.RODS.forEach(function (r) { if (inView(r.x * T, r.y * T)) list.push({ y: r.y * T + 6, rod: r }); });
    save.rods.forEach(function (i) { var p = V.TD.pads[i]; list.push({ y: p[1] * T + 6, rod: { x: p[0], y: p[1], td: true } }); });
    V.CONSOLES.forEach(function (c) { if (c.kind !== "boss" && inView(c.x * T, c.y * T)) list.push({ y: c.y * T + 12, con: c }); });
    NPCS.forEach(function (n) { if (inView(n.x * T, n.y * T)) list.push({ y: n.y * T + 14, npc: n }); });
    SIGNS.forEach(function (s) { if (inView(s.x * T, s.y * T)) list.push({ y: s.y * T + 10, sign: s }); });
    V.CRYSTALS.forEach(function (c, i) { if (save.crystals.indexOf(i) < 0 && inView(c[0] * T, c[1] * T)) list.push({ y: c[1] * T + 8, cry: c, i: i }); });
    S.crates.forEach(function (c) { list.push({ y: c.y * T + 14, crate: c }); });
    S.ens.forEach(function (e) { list.push({ y: e.y * T + 8, en: e }); });
    if (S.td) S.td.enemies.forEach(function (e) { list.push({ y: e.y * T + 8, en: { type: e.tough ? "drone" : "spark", x: e.x, y: e.y, q: e.q, t: api.t, stun: 0, td: true } }); });
    list.push({ y: V.TD.gen[1] * T + 14, gen: true });
    list.push({ y: 25.5 * T + 16, fountain: true });
    if (S.boss) { list.push({ y: S.boss.y * T + 20, boss: S.boss }); x.strokeStyle = "rgba(192,132,252," + (.35 + .2 * Math.sin(t * 4)) + ")"; x.lineWidth = 4; x.setLineDash([12, 8]); x.strokeRect(25 * T - cam.x, 2 * T - cam.y, 9 * T, 5 * T); x.setLineDash([]); } if (S.bossGone) list.push({ y: S.bossGone.y * T, gone: S.bossGone });
    list.push({ y: h.y * T + 14, hero: true });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { if (o.ch) objTile(x, o.tx, o.ty, o.ch, t, red); else if (o.lamp) drawLamp(x, o.lamp); else if (o.pyl) drawPylon(x, o.pyl, t, red); else if (o.rod) drawRod(x, o.rod, t); else if (o.con) drawConsole(x, o.con, t);
      else if (o.npc) drawNpc(x, o.npc, t); else if (o.sign) drawSign(x, o.sign); else if (o.cry) drawCrystal(x, o.cry, t, red); else if (o.crate) drawCrate(x, o.crate); else if (o.en) drawEnemy(x, o.en, t, red);
      else if (o.gen) drawGen(x, t); else if (o.fountain) drawFountain(x, t, red); else if (o.boss) drawBoss(x, o.boss, t, red); else if (o.gone) drawGone(x, o.gone); else if (o.hero) drawHero(x, t, red); });
    // hero x-ray outline (when hidden behind a building)
    x.globalAlpha = .3; x.strokeStyle = h.q > 0 ? "#ff8a8a" : "#8ab4ff"; x.lineWidth = 2; x.beginPath(); x.arc(h.x * T - cam.x, h.y * T - cam.y - 14, 14, 0, PI2); x.stroke(); x.globalAlpha = 1;
    // effects in world space
    S.fx.forEach(function (p) { x.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); x.fillStyle = p.col; x.fillRect(p.x * T - cam.x - p.s / 2, p.y * T - cam.y - p.s / 2 - 10, p.s, p.s); }); x.globalAlpha = 1;
    (S.zaps || []).forEach(function (zp) { zp.t -= 1 / 60; if (zp.t > 0) bolt(x, zp.a[0] * T - cam.x, zp.a[1] * T - cam.y - 40, zp.b[0] * T - cam.x, zp.b[1] * T - cam.y, "#fff7b0", 3); }); if (S.zaps) S.zaps = S.zaps.filter(function (zp) { return zp.t > 0; });
    if (S.strike) { S.strike.t -= 1 / 60; var sx2 = S.strike.x * T - cam.x, sy2 = S.strike.y * T - cam.y; bolt(x, sx2 + 40, -20, sx2, sy2 - 40, "#e8f4ff", 6); if (S.strike.t <= 0) S.strike = null; }
    if (S.bolts) { var bx2 = S.bolts.x * T - cam.x, by2 = S.bolts.y * T - cam.y; for (i = 0; i < 3; i++) bolt(x, bx2, by2 - 50, bx2 + (Math.random() - .5) * 60, by2 + 10, "#7ef0ff", 4); }
    TEXTS.forEach(function (tt) { if (S.mode !== "world") return; x.globalAlpha = Math.min(1, tt.life * 2); txt(x, tt.t, tt.x * T - cam.x, tt.y * T - cam.y - 30 - (1.3 - tt.life) * 30, 22, tt.col, "center", 0, 800); x.globalAlpha = 1; });
    if (save.opt.pred) drawPrediction(x);
    if (save.opt.arrow) drawForceArrow(x);
    drawLighting(x, api, night, tx0, ty0, tx1, ty1);
    drawHud(x, api);
  }
  function bolt(x, x0, y0, x1, y1, col, w) { x.strokeStyle = col; x.lineWidth = w; x.shadowColor = col; x.shadowBlur = 12; x.beginPath(); x.moveTo(x0, y0); for (var i = 1; i < 7; i++) { var f = i / 7; x.lineTo(x0 + (x1 - x0) * f + (Math.random() - .5) * 22, y0 + (y1 - y0) * f + (Math.random() - .5) * 10); } x.lineTo(x1, y1); x.stroke(); x.shadowBlur = 0; }
  function groundTile(x, tx, ty, px, py, t, red) {
    var ch = V.MAP[ty][tx], z = V.zoneOf(tx, ty) || "hub", P = pal(z), v = rand(tx * 31 + ty * 17);
    if (ch === "~") { x.fillStyle = "#1b4f7c"; x.fillRect(px, py, T, T); x.fillStyle = "rgba(255,255,255,.14)";
      var o = red ? 0 : Math.sin(t * 1.4 + tx * .7 + ty * 1.3) * 8; x.fillRect(px + 8 + o, py + 12 + v * 10, 14, 2); x.fillRect(px + 26 - o, py + 32 - v * 8, 12, 2);
      var up = V.tile(tx, ty - 1); if (up !== "~" && up !== "b") { x.fillStyle = "rgba(220,240,255,.35)"; x.fillRect(px, py, T, 3 + (red ? 0 : Math.sin(t * 2 + tx) * 1.5)); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(px, py + 3, T, 6); }
      return; }
    if (ch === "b") { x.fillStyle = "#7a5a3a"; x.fillRect(px, py, T, T); x.fillStyle = "#5e4329"; for (var k = 0; k < T; k += 12) x.fillRect(px, py + k, T, 2); return; }
    if (ch === "." || ch === "G") { x.fillStyle = P[1]; x.fillRect(px, py, T, T); x.fillStyle = "rgba(255,255,255,.04)"; if (v > .6) x.fillRect(px + v * 30, py + 10, 6, 4); return; }
    if (ch === ":" || ch === "X") { x.fillStyle = P[2]; x.fillRect(px, py, T, T); x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 1; x.strokeRect(px + .5, py + .5, T / 2, T / 2); x.strokeRect(px + T / 2 + .5, py + T / 2 + .5, T / 2 - 1, T / 2 - 1); return; }
    if (ch === "p") { x.fillStyle = P[1]; x.fillRect(px, py, T, T); return; }
    if (ch === "o") { x.fillStyle = P[1]; x.fillRect(px, py, T, T); return; }
    x.fillStyle = P[0]; x.fillRect(px, py, T, T); x.fillStyle = "rgba(255,255,255," + (.03 + v * .04) + ")"; x.fillRect(px + v * 36, py + (1 - v) * 36, 4, 6);
    if (ch === "f") { var cols = ["#ff6b9a", "#ffd84a", "#c084fc", "#ffffff"]; for (k = 0; k < 5; k++) { x.fillStyle = cols[(k + tx) % 4]; x.beginPath(); x.arc(px + 8 + rand(tx + k) * 32, py + 8 + rand(ty * 3 + k) * 32, 4, 0, PI2); x.fill(); } }
  }
  function objTile(x, tx, ty, ch, t, red) {
    var cam = S.cam, px = tx * T - cam.x, py = ty * T - cam.y, z = V.zoneOf(tx, ty) || "hub", P = pal(z);
    if (ch === "#") { var b = BOF[tx + "," + ty], hh = b.h, below = BOF[tx + "," + (ty + 1)] === b, lit = blockLit(b);
      if (!below) { var g = x.createLinearGradient(0, py + T - hh, 0, py + T); g.addColorStop(0, P[3]); g.addColorStop(1, shadeHex(P[3], -.35)); x.fillStyle = g; x.fillRect(px, py + T - hh, T, hh);
        for (var wy = py + T - hh + 10; wy < py + T - 14; wy += 20) for (var wx2 = 0; wx2 < 2; wx2++) { var on = lit && rand(tx * 7 + wx2 + wy * .13 + b.id) > .22; if (lit && S.cine && S.cine.t < b.lit + .3 && S.cine.t > b.lit - .3 && !red) on = Math.random() > .5;
          x.fillStyle = on ? P[5] : "rgba(10,14,24,.85)"; x.fillRect(px + 8 + wx2 * 22, wy, 12, 11); }
        if (BOF[(tx - 1) + "," + ty] !== b) { x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(px, py + T - hh, 3, hh); } }
      x.fillStyle = P[4]; x.fillRect(px, py - hh, T, T); x.fillStyle = "rgba(255,255,255,.12)";
      if (BOF[tx + "," + (ty - 1)] !== b) x.fillRect(px, py - hh, T, 3); if (BOF[(tx - 1) + "," + ty] !== b) x.fillRect(px, py - hh, 3, T);
      if (!below) { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(px, py - hh + T - 3, T, 3); }
      if (rand(tx * 13 + ty * 7) > .82) { x.fillStyle = shadeHex(P[4], -.25); x.fillRect(px + 12, py - hh + 12, 20, 14); }
      return; }
    if (ch === "T" || ch === "^") { var sw = red ? 0 : Math.sin(t * 1.3 + tx * .9) * 2, big = ch === "^";
      x.fillStyle = "#4a3222"; x.fillRect(px + T / 2 - 4, py + T - 18, 8, 16);
      var cols = big ? ["#14301c", "#1b3d24"] : ["#1f5a2c", "#2f7a3e"]; x.fillStyle = cols[0]; x.beginPath(); x.arc(px + T / 2 + sw, py + T - 30, big ? 26 : 20, 0, PI2); x.fill();
      x.fillStyle = cols[1]; x.beginPath(); x.arc(px + T / 2 - 6 + sw, py + T - 36, big ? 16 : 13, 0, PI2); x.arc(px + T / 2 + 8 + sw, py + T - 32, big ? 14 : 11, 0, PI2); x.fill(); return; }
    if (ch === "h") { x.fillStyle = "#1f5a2c"; x.fillRect(px + 2, py + T - 26, T - 4, 24); x.fillStyle = "#2f7a3e"; x.fillRect(px + 2, py + T - 30, T - 4, 8); return; }
    if (ch === "|") { x.fillStyle = "rgba(170,220,255,.22)"; x.fillRect(px + 2, py + T - 34, T - 4, 30); x.strokeStyle = "rgba(220,240,255,.7)"; x.lineWidth = 2; x.strokeRect(px + 2, py + T - 34, T - 4, 30); x.beginPath(); x.moveTo(px + 8, py + T - 30); x.lineTo(px + 18, py + T - 10); x.stroke(); return; }
    if (ch === "G") { if (S.open["gate:" + tx + "," + ty]) { x.fillStyle = "#555"; x.fillRect(px, py + T - 6, T, 6); return; } x.fillStyle = "#7a7f8a"; for (var k = 0; k < 5; k++) x.fillRect(px + 4 + k * 9, py + T - 44, 5, 42); x.fillRect(px, py + T - 44, T, 5); x.fillStyle = "#f6c445"; x.fillRect(px + 16, py + T - 30, 16, 10); return; }
    if (ch === "X") { if (restored() >= 4) return; var a = .45 + (red ? 0 : Math.sin(t * 6 + ty) * .2); x.fillStyle = "rgba(192,132,252," + a + ")"; x.fillRect(px, py + T - 70, T, 68); x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 2;
      x.beginPath(); for (var j = 0; j < 4; j++) { var yy = py + T - 66 + ((j * 17 + (red ? 0 : t * 40)) % 64); x.moveTo(px, yy); x.lineTo(px + T, yy + 6); } x.stroke(); }
  }
  function blockLit(b) { var d = ZONE_D[b.zone]; if (b.zone === "hub") return (isDone("tower") || rand(b.id + 9) < .2 + restored() * .13) && (!S.cine || S.cine.d.id !== "tower" || S.cine.t > b.lit);
    if (!d || !isDone(d.id)) return false; if (S.cine && S.cine.d === d) return S.cine.t > b.lit - .3; return true; }
  function shadeHex(hex, p) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = p < 0 ? 0 : 255, q = Math.abs(p); return "rgb(" + Math.round(r + (f - r) * q) + "," + Math.round(g + (f - g) * q) + "," + Math.round(b + (f - b) * q) + ")"; }
  function zoneLit(z) { if (z === "hub") return true; var d = ZONE_D[z]; return d && isDone(d.id); }
  function drawLamp(x, l) { var px = l.x * T - S.cam.x, py = l.y * T - S.cam.y, on = zoneLit(l.z) && nightAmt() > .35; x.fillStyle = "#2a2e36"; x.fillRect(px - 2, py - 40, 4, 40); x.fillRect(px - 2, py - 40, 10, 3);
    x.fillStyle = on ? "#fff3c4" : "#555b66"; x.beginPath(); x.arc(px + 8, py - 36, 4, 0, PI2); x.fill(); }
  function drawPylon(x, p, t, red) {
    var px = p.x * T - S.cam.x, py = p.y * T - S.cam.y, col = !p.on ? "#666" : p.q > 0 ? "#ff5a5a" : "#4f8bff", near = Math.hypot(p.x - h.x, p.y - h.y) < 5;
    x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(px, py + 6, 18, 7, 0, 0, PI2); x.fill();
    x.fillStyle = "#3a404c"; x.beginPath(); x.ellipse(px, py + 2, 14, 6, 0, 0, PI2); x.fill(); x.fillStyle = "#59616f"; x.fillRect(px - 5, py - 46, 10, 48);
    for (var k = 0; k < 3; k++) { x.fillStyle = "#8a93a3"; x.fillRect(px - 9, py - 16 - k * 10, 18, 3); }
    if (p.on && !red) { x.strokeStyle = col; x.globalAlpha = .4; x.lineWidth = 2; x.beginPath(); x.arc(px, py - 54, 18 + Math.sin(t * 5) * 3, 0, PI2); x.stroke(); x.globalAlpha = 1; }
    var g = x.createRadialGradient(px - 4, py - 58, 2, px, py - 54, 13); g.addColorStop(0, "#fff"); g.addColorStop(1, col); x.fillStyle = g; x.beginPath(); x.arc(px, py - 54, 12, 0, PI2); x.fill();
    txt(x, p.on ? (p.q > 0 ? "+" : "−") : "·", px, py - 47, 18, "#fff", "center", 0, 800);
    if (near && p.on) { txt(x, (p.q > 0 ? "+" : "−") + Math.abs(Math.round(p.q / UC)) + " µC", px, py - 76, 18, "#fff", "center", 0, 700); }
    else if (near && !p.on) txt(x, "no power", px, py - 76, 16, "#aaa", "center");
  }
  function drawRod(x, r, t) { var px = r.x * T - S.cam.x, py = r.y * T - S.cam.y; x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px, py + 3, 9, 4, 0, 0, PI2); x.fill();
    x.fillStyle = "#b9c2cf"; x.fillRect(px - 2, py - 58, 4, 60); x.beginPath(); x.moveTo(px - 5, py - 58); x.lineTo(px, py - 70); x.lineTo(px + 5, py - 58); x.fill(); x.fillStyle = "#3dd68c"; x.fillRect(px - 6, py - 2, 12, 4); void t; }
  function drawConsole(x, c, t) { var px = c.x * T - S.cam.x, py = c.y * T - S.cam.y, done = save.tasks[c.id], col = done ? "#3dd68c" : DBY[c.d].col;
    if (c.kind === "td") return;
    x.fillStyle = "#2a2f3a"; x.fillRect(px - 16, py - 30, 32, 34); x.fillStyle = "#3a4150"; x.fillRect(px - 18, py - 36, 36, 8);
    x.fillStyle = col; x.globalAlpha = .6 + .4 * Math.sin(t * 4); x.fillRect(px - 10, py - 24, 20, 12); x.globalAlpha = 1;
    txt(x, c.kind === "probe" ? "⚡" : c.kind === "cap" ? "C" : c.kind === "equi" ? "V" : "Q", px, py - 2, 14, "#fff", "center", 0, 800); }
  function drawNpc(x, n, t) { var px = n.x * T - S.cam.x, py = n.y * T - S.cam.y, bob = Math.sin(t * 2 + n.x) * 1.5;
    x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px, py + 12, 11, 4, 0, 0, PI2); x.fill(); x.fillStyle = n.look.coat; x.fillRect(px - 8, py - 6 + bob, 16, 18);
    A.drawHead(x, n.look, px, py - 16 + bob, 13, h.x < n.x ? -1 : 1, { mood: "happy", blink: (t + n.x) % 4 < .12 });
    if (!save.talked[n.id] && Math.hypot(n.x - h.x, n.y - h.y) < 6) { txt(x, "!", px, py - 40 + Math.sin(t * 5) * 3, 24, "#ffd84a", "center", 0, 900); } }
  function drawSign(x, s) { var px = s.x * T - S.cam.x, py = s.y * T - S.cam.y, read = save.notes.indexOf(s.id) >= 0; x.fillStyle = "#5c4630"; x.fillRect(px - 2, py - 22, 4, 26); x.fillStyle = read ? "#cbbd98" : "#f2e3b8"; x.fillRect(px - 15, py - 36, 30, 18); txt(x, "i", px, py - 22, 14, "#3b2f20", "center", 0, 800); }
  function drawCrystal(x, c, t, red) { var px = c[0] * T - S.cam.x, py = c[1] * T - S.cam.y - 14 + (red ? 0 : Math.sin(t * 3 + c[0]) * 4);
    x.fillStyle = "rgba(126,240,255,.25)"; x.beginPath(); x.arc(px, py, 14, 0, PI2); x.fill(); x.fillStyle = "#7ef0ff"; x.beginPath(); x.moveTo(px, py - 12); x.lineTo(px + 8, py); x.lineTo(px, py + 12); x.lineTo(px - 8, py); x.closePath(); x.fill(); x.fillStyle = "#fff"; x.fillRect(px - 2, py - 6, 3, 6); }
  function drawCrate(x, c) { var px = c.x * T - S.cam.x, py = c.y * T - S.cam.y; x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(px - 15, py + 4, 32, 8); x.fillStyle = "#8a5a2b"; x.fillRect(px - 16, py - 26, 32, 30); x.fillStyle = "#a8743c"; x.fillRect(px - 16, py - 32, 32, 8);
    x.strokeStyle = "#5e3c1a"; x.lineWidth = 2; x.strokeRect(px - 16, py - 26, 32, 30); x.beginPath(); x.moveTo(px - 16, py - 26); x.lineTo(px + 16, py + 4); x.stroke(); chargeBall(x, px, py - 12, 9, c.q > 0 ? 1 : -1, 0, true);
    if (Math.hypot(c.x - h.x, c.y - h.y) < 4) txt(x, (c.q > 0 ? "+" : "−") + Math.abs(c.q) + " µC crate", px, py - 40, 16, "#fff", "center"); }
  function drawEnemy(x, e, t, red) { var px = e.x * T - S.cam.x, py = e.y * T - S.cam.y - 22, col = e.q > 0 ? "#ff5a5a" : "#4f8bff", warn = e.type === "flipper" && e.flipT < .7 && Math.floor(t * 10) % 2;
    x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(px, py + 26, 8, 3, 0, 0, PI2); x.fill();
    if (e.type === "bolt") { x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 10; x.beginPath(); x.arc(px, py + 10, 6, 0, PI2); x.fill(); x.shadowBlur = 0; return; }
    if (e.type === "drone") { x.fillStyle = "#2a2338"; x.beginPath(); x.ellipse(px, py, 18, 10, 0, 0, PI2); x.fill(); x.strokeStyle = "#c084fc"; x.lineWidth = 2; x.beginPath(); x.moveTo(px - 22, py - 8); x.lineTo(px + 22, py - 8); x.stroke();
      x.fillStyle = col; x.beginPath(); x.arc(px, py, 7, 0, PI2); x.fill(); txt(x, e.q > 0 ? "+" : "−", px, py + 5, 13, "#fff", "center", 0, 800); if (e.stun > 0) txt(x, "✶", px + 10, py - 14, 16, "#ffd84a", "center"); return; }
    var r = e.type === "flipper" ? 13 : 10, wob = red ? 0 : Math.sin(t * 9 + e.x * 3) * 2;
    x.fillStyle = warn ? "#ffffff" : col; x.shadowColor = col; x.shadowBlur = red ? 0 : 12; x.beginPath();
    for (var k = 0; k < 8; k++) { var a = k / 8 * PI2 + t * 3, rr2 = k % 2 ? r * .55 : r + wob; x.lineTo(px + Math.cos(a) * rr2, py + Math.sin(a) * rr2); } x.closePath(); x.fill(); x.shadowBlur = 0;
    x.fillStyle = "#1a0a28"; x.fillRect(px - 5, py - 3, 3, 4); x.fillRect(px + 2, py - 3, 3, 4); txt(x, e.q > 0 ? "+" : "−", px, py + r + 14, 14, "#fff", "center", 0, 800); }
  function drawGen(x, t) { var px = V.TD.gen[0] * T - S.cam.x, py = V.TD.gen[1] * T - S.cam.y, done = isDone("heights");
    x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px, py + 8, 26, 9, 0, 0, PI2); x.fill(); x.fillStyle = "#3a404c"; x.fillRect(px - 22, py - 40, 44, 46); x.fillStyle = "#59616f"; x.fillRect(px - 24, py - 46, 48, 8);
    for (var k = 0; k < 3; k++) { x.strokeStyle = done ? "#ffb070" : "#555"; x.lineWidth = 3; x.beginPath(); x.arc(px, py - 20, 6 + k * 5, 0, PI2); x.stroke(); }
    if (S.td) for (var i = 0; i < V.TD.genHP; i++) { x.fillStyle = i < S.td.hp ? "#3dd68c" : "#5a2a2a"; x.fillRect(px - 25 + i * 10, py - 60, 8, 8); }
    txt(x, done ? "ONLINE" : S.td ? "UNDER ATTACK" : "Generator", px, py - 68, 15, "#fff", "center", 0, 700); void t; }
  function drawFountain(x, t, red) { var px = 33.5 * T - S.cam.x, py = 25.5 * T - S.cam.y; x.fillStyle = "#8a8578"; x.beginPath(); x.ellipse(px, py, 36, 18, 0, 0, PI2); x.fill(); x.fillStyle = "#2b6fa8"; x.beginPath(); x.ellipse(px, py - 2, 30, 13, 0, 0, PI2); x.fill();
    x.fillStyle = "#b8b2a2"; x.fillRect(px - 4, py - 30, 8, 26); x.fillStyle = "rgba(200,235,255,.8)"; for (var k = 0; k < 6; k++) { var a = k / 6 * PI2 + (red ? 0 : t * 2); x.beginPath(); x.arc(px + Math.cos(a) * 14, py - 28 + Math.abs(Math.sin(a)) * 18, 2.5, 0, PI2); x.fill(); } }
  function drawHero(x, t, red) {
    var px = h.x * T - S.cam.x, py = h.y * T - S.cam.y, c = A.styled ? A.styled(A.byId[save.who] || A.CAST[0]) : A.byId[save.who], moving = Math.hypot(h.vx, h.vy) > .3, bob = moving && !red ? Math.sin(h.walk * 14) * 2 : 0, col = h.q > 0 ? "#ff5a5a" : "#4f8bff";
    var tr = V.TRAILS.filter(function (q) { return q.id === save.trail; })[0];
    if (tr && tr.col && S.trail.length > 2) { x.lineCap = "round"; for (var i = 1; i < S.trail.length; i++) { var a = S.trail[i - 1], b = S.trail[i]; x.strokeStyle = tr.col === "rainbow" ? "hsl(" + ((i * 18 + t * 200) % 360) + ",90%,60%)" : tr.col; x.globalAlpha = i / S.trail.length * .8; x.lineWidth = 3 + i / S.trail.length * 8;
      x.beginPath(); x.moveTo(a[0] * T - S.cam.x, a[1] * T - S.cam.y - 12); x.lineTo(b[0] * T - S.cam.x, b[1] * T - S.cam.y - 12); x.stroke(); } x.globalAlpha = 1; }
    if (h.inv > 0 && Math.floor(t * 20) % 2 && h.dashT <= 0) return;
    x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(px, py + 12, 13, 5, 0, 0, PI2); x.fill();
    var g = x.createRadialGradient(px, py - 12, 4, px, py - 12, 34); g.addColorStop(0, h.q > 0 ? "rgba(255,90,90,.35)" : "rgba(80,140,255,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - 36, py - 48, 72, 72);
    x.fillStyle = "#2a2f3a"; x.fillRect(px - h.face * 12 - 5, py - 12 + bob, 10, 16); x.fillStyle = col; x.fillRect(px - h.face * 12 - 3, py - 8 + bob, 6, 6);
    x.fillStyle = c.coat; x.fillRect(px - 9, py - 6 + bob, 18, 16); x.fillStyle = "#1c1c24"; x.fillRect(px - 8, py + 8, 6, 5 + (moving ? Math.max(0, Math.sin(h.walk * 14)) * 3 : 0)); x.fillRect(px + 2, py + 8, 6, 5 + (moving ? Math.max(0, -Math.sin(h.walk * 14)) * 3 : 0));
    A.drawHead(x, c, px, py - 17 + bob, 13, h.face, { mood: h.inv > .5 ? "sad" : "happy", hit: h.inv > 1 });
    x.fillStyle = col; x.strokeStyle = "#fff"; x.lineWidth = 2; x.beginPath(); x.arc(px + 15, py - 34 + bob, 9, 0, PI2); x.fill(); x.stroke(); txt(x, h.q > 0 ? "+" : "−", px + 15, py - 29 + bob, 15, "#fff", "center", 0, 900);
  }
  function drawBoss(x, b, t, red) {
    var px = b.x * T - S.cam.x, py = b.y * T - S.cam.y, hover = red ? 0 : Math.sin(t * 3) * 4, col = !b.q ? "#aaa" : b.q > 0 ? "#ff5a5a" : "#4f8bff";
    x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(px, py + 14, 26, 9, 0, 0, PI2); x.fill();
    if (b.q && !red) { x.strokeStyle = col; x.globalAlpha = .5; x.lineWidth = 3; x.beginPath(); x.arc(px, py - 30 + hover, 40 + Math.sin(t * 8) * 4, 0, PI2); x.stroke(); x.globalAlpha = 1; }
    if ((b.st === "aim" || b.st === "ring" || b.st === "flip") && Math.floor(t * 12) % 2) { x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.arc(px, py - 30 + hover, 48, 0, PI2); x.stroke(); }
    x.fillStyle = "#2a0f40"; x.beginPath(); x.moveTo(px - 26, py + 6 + hover); x.lineTo(px, py - 30 + hover); x.lineTo(px + 26, py + 6 + hover); x.closePath(); x.fill();
    A.drawHead(x, A.VILLAIN, px, py - 34 + hover, 20, h.x < b.x ? -1 : 1, { mood: b.stun > 0 ? "sad" : "fight", hit: b.stun > 1.8 });
    if (b.stun > 0) for (var k = 0; k < 3; k++) { var a = t * 4 + k * 2.1; txt(x, "★", px + Math.cos(a) * 24, py - 62 + Math.sin(a) * 6 + hover, 16, "#ffd84a", "center"); }
    txt(x, b.q ? (b.q > 0 ? "+" : "−") + "60 µC" : "neutral", px, py + 32, 16, col, "center", 0, 800);
  }
  function drawGone(x, g) { var px = g.x * T - S.cam.x + g.t * 260, py = g.y * T - S.cam.y - g.t * 220; x.save(); x.translate(px, py); x.rotate(g.t * 12); A.drawHead(x, A.VILLAIN, 0, 0, 20 * Math.max(.2, 1 - g.t / 3), 1, { mood: "sad" }); x.restore();
    if (g.t < 2) txt(x, "Curses! My lovely disorder... ORDERED!", g.x * T - S.cam.x, g.y * T - S.cam.y - 90, 20, "#e3b6ff", "center", 0, 800); }
  function drawFieldLines(x, t, red) {
    S.lines.forEach(function (L) { var p = L.p, d = Math.hypot(p.x - h.x, p.y - h.y); if (d > 7) return; var al = clamp(1 - (d - 3) / 4, .15, .85);
      x.strokeStyle = p.q > 0 ? "rgba(255,140,140," + al * .7 + ")" : "rgba(140,180,255," + al * .7 + ")"; x.lineWidth = 2; x.setLineDash([8, 10]); x.lineDashOffset = red ? 0 : (p.q > 0 ? -1 : 1) * t * 26;
      L.lines.forEach(function (pts) { x.beginPath(); pts.forEach(function (q, i) { var px = q[0] * T - S.cam.x, py = q[1] * T - S.cam.y; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); }); x.setLineDash([]); x.lineDashOffset = 0;
      // field arrows (direction of E, the push on a + test charge)
      if (d < 4.5) { x.fillStyle = "rgba(255,255,255," + al * .8 + ")"; L.lines.forEach(function (pts) { var k = Math.min(pts.length - 2, 12); if (k < 2) return; var a = pts[k], b = pts[k + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + (p.q > 0 ? 0 : Math.PI), ax = a[0] * T - S.cam.x, ay = a[1] * T - S.cam.y;
        x.save(); x.translate(ax, ay); x.rotate(ang); x.beginPath(); x.moveTo(7, 0); x.lineTo(-5, -5); x.lineTo(-5, 5); x.closePath(); x.fill(); x.restore(); }); } });
  }
  function drawPrediction(x) { if (!S.pred) return; S.pred.forEach(function (p, i) { x.fillStyle = S.pred.fell && i > S.pred.length - 6 ? "rgba(255,100,100,.8)" : "rgba(255,255,255," + (1 - i / S.pred.length) * .85 + ")"; x.beginPath(); x.arc(p[0] * T - S.cam.x, p[1] * T - S.cam.y, 4, 0, PI2); x.fill(); });
    var l = S.pred[S.pred.length - 1]; if (l) txt(x, S.pred.fell ? "splash!" : "flip to launch", l[0] * T - S.cam.x, l[1] * T - S.cam.y - 14, 18, S.pred.fell ? "#ff9b9b" : "#fff", "center", 0, 800); }
  function drawForceArrow(x) { var F = h.F || [0, 0], m = Math.hypot(F[0], F[1]); if (m < .5) return; var len = Math.min(110, 22 + Math.log(1 + m) * 22), ux = F[0] / m, uy = F[1] / m, px = h.x * T - S.cam.x, py = h.y * T - S.cam.y - 14;
    x.strokeStyle = "#ffd84a"; x.fillStyle = "#ffd84a"; x.lineWidth = 4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + ux * len, py + uy * len); x.stroke(); x.beginPath(); x.moveTo(px + ux * (len + 10), py + uy * (len + 10)); x.lineTo(px + ux * len - uy * 7, py + uy * len + ux * 7); x.lineTo(px + ux * len + uy * 7, py + uy * len - ux * 7); x.closePath(); x.fill();
    txt(x, "F = " + (m < 10 ? m.toFixed(1) : Math.round(m)) + " N", px + ux * (len + 18), py + uy * (len + 18) + 6, 18, "#ffe48a", ux < -.3 ? "right" : ux > .3 ? "left" : "center", 0, 800); }
  function drawLighting(x, api, night, tx0, ty0, tx1, ty1) {
    var cam = S.cam, base = .08 + night * .55; LX.globalCompositeOperation = "source-over"; LX.clearRect(0, 0, 480, 270); LX.fillStyle = "rgba(8,10,34," + base + ")"; LX.fillRect(0, 0, 480, 270);
    DIST.forEach(function (d) { if (isDone(d.id) && !(S.cine && S.cine.d === d && S.cine.t < 1)) return; var z = V.ZONES[d.zone]; LX.fillStyle = "rgba(24,6,44,.36)"; LX.fillRect((z[0] * T - cam.x) / 2, (z[1] * T - cam.y) / 2, (z[2] - z[0] + 1) * T / 2, (z[3] - z[1] + 1) * T / 2); });
    var lights = [[h.x, h.y - .3, 3.2, .9]];
    if (night > .25) { LAMPS.forEach(function (l) { if (zoneLit(l.z)) lights.push([l.x + .17, l.y - .75, 2.6, .85]); }); BLK.forEach(function (b) { if (blockLit(b)) lights.push([b.cx, b.cy + .6, 2.2 + b.tiles.length * .08, .6]); }); }
    S.ws.pylons.forEach(function (p) { if (p.on) lights.push([p.x, p.y - 1.1, 1.8, .8]); }); V.CONSOLES.forEach(function (c) { lights.push([c.x, c.y - .4, 1.2, .5]); });
    S.ens.forEach(function (e) { lights.push([e.x, e.y - .4, 1, .6]); }); if (S.boss) lights.push([S.boss.x, S.boss.y - .6, 2.4, .8]);
    LX.globalCompositeOperation = "destination-out";
    lights.forEach(function (l) { var lx = (l[0] * T - cam.x) / 2, ly = (l[1] * T - cam.y) / 2, r = l[2] * T / 2; if (lx < -r || ly < -r || lx > 480 + r || ly > 270 + r) return;
      var g = LX.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, "rgba(0,0,0," + l[3] + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); LX.fillStyle = g; LX.fillRect(lx - r, ly - r, r * 2, r * 2); });
    LX.globalCompositeOperation = "source-over"; x.drawImage(LC, 0, 0, 960, 540);
    if (!api.reduce) { // drifting entropy fog over dark districts
      DIST.forEach(function (d, i) { if (isDone(d.id)) return; var z = V.ZONES[d.zone]; for (var k = 0; k < 6; k++) { var fx = (z[0] + ((k * 3.7 + api.t * .4 + i) % (z[2] - z[0] + 1))) * T - cam.x, fy = (z[1] + ((k * 2.3 + Math.sin(api.t * .5 + k) * 1.5 + 50) % (z[3] - z[1] + 1))) * T - cam.y;
        if (fx < -40 || fy < -40 || fx > 1000 || fy > 580) continue; x.fillStyle = "rgba(192,132,252,.25)"; x.beginPath(); x.arc(fx, fy, 4, 0, PI2); x.fill(); } }); }
    void tx0; void ty0; void tx1; void ty1;
  }

  /* ---------- HUD ---------- */
  var HK = { k: 1, n: 0 };
  function hudK(x) { // scale the HUD up on small screens so text stays readable at 360 px (canvas is 960 wide)
    if (HK.n-- <= 0) { HK.n = 30; var w = 960; try { w = x.canvas.getBoundingClientRect().width || 960; } catch (e) {} HK.auto = clamp(620 / w, 1, 1.45); }
    var user = 1; try { user = (API && API.settings && API.settings.get && API.settings.get("hudScale")) || 1; } catch (e) {}
    return clamp((save.opt.hud === "normal" ? 1 : HK.auto || 1) * user, .7, 1.45);
  }
  function drawHud(x, api) {
    var k = hudK(x); x.save(); x.scale(k, k); drawHudCard(x, api); x.restore();
    x.save(); x.translate(960, 0); x.scale(Math.min(k, 1.15), Math.min(k, 1.15)); x.translate(-960, 0); drawHudMap(x, api); x.restore();
    x.save(); x.translate(480, 540); x.scale(k, k); x.translate(-480, -540); drawHudPrompt(x, api); x.restore();
    x.save(); x.translate(480, 0); x.scale(k, k); x.translate(-480, 0); drawHudMsg(x, api); x.restore();
  }
  function drawHudCard(x, api) {
    var o = objective(), col = o.d ? o.d.col : "#7ef0ff";
    var sl = wrapLines(x, o.s, 22, 440), ch = 62 + sl.length * 26;
    x.fillStyle = "rgba(4,10,20,.8)"; rr(x, 12, 12, 470, ch, 16); x.fill(); x.fillStyle = col; rr(x, 12, 12, 8, ch, 4); x.fill();
    txt(x, o.t, 32, 46, 26, col, "left", 0, 800); sl.forEach(function (l, i) { txt(x, l, 32, 78 + i * 26, 22, "#fff", "left", 0, 600); });
    var hy = 12 + ch + 28; for (var i = 0; i < maxHp(); i++) heart(x, 30 + i * 32, hy, i < h.hp);
    var pc = h.q > 0 ? "#ff5a5a" : "#4f8bff"; x.fillStyle = pc; x.beginPath(); x.arc(212, hy, 20, 0, PI2); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 3; x.stroke(); txt(x, h.q > 0 ? "+" : "−", 212, hy + 9, 28, "#fff", "center", 0, 900);
    txt(x, "q = " + (h.q > 0 ? "+" : "−") + "25 µC", 240, hy + 8, 20, "#fff", "left", 0, 700);
  }
  function drawHudMap(x, api) {
    var o = objective(), pc = h.q > 0 ? "#ff5a5a" : "#4f8bff";
    var mw = 196, mh = 137, mx = 960 - mw - 12, my = 12; if (!S.mini) S.mini = buildMini(); x.fillStyle = "rgba(4,10,20,.8)"; rr(x, mx - 4, my - 4, mw + 8, mh + 8, 12); x.fill(); x.drawImage(S.mini, mx, my, mw, mh);
    var sx = mw / V.W, sy = mh / V.H; DIST.forEach(function (d) { var z = V.ZONES[d.zone]; x.strokeStyle = isDone(d.id) ? d.col : "rgba(192,132,252,.6)"; x.lineWidth = isDone(d.id) ? 2 : 1; x.strokeRect(mx + z[0] * sx, my + z[1] * sy, (z[2] - z[0] + 1) * sx, (z[3] - z[1] + 1) * sy); });
    if (o.x != null) { x.fillStyle = "#ffd84a"; star(x, mx + o.x * sx, my + o.y * sy, 6); }
    x.fillStyle = "#fff"; x.beginPath(); x.arc(mx + h.x * sx, my + h.y * sy, 4, 0, PI2); x.fill(); x.strokeStyle = pc; x.lineWidth = 2; x.stroke();
    txt(x, "◆ " + save.crystals.length + "/" + V.CRYSTALS.length + "   ⚡ " + districtCount() + "/12", mx + mw, my + mh + 26, 20, "#cfefff", "right", 0, 700);
  }
  function drawHudPrompt(x, api) {
    var o = objective();
    if (o.x != null) { var ox = o.x * T - S.cam.x, oy = o.y * T - S.cam.y - 20, on = ox > 30 && ox < 930 && oy > 150 && oy < 520;
      if (on) { var bb = api.reduce ? 0 : Math.sin(api.t * 5) * 5; x.fillStyle = "#ffd84a"; x.beginPath(); x.moveTo(ox, oy - 34 + bb); x.lineTo(ox - 12, oy - 54 + bb); x.lineTo(ox + 12, oy - 54 + bb); x.closePath(); x.fill(); x.strokeStyle = "#5a3a00"; x.lineWidth = 2; x.stroke(); }
      else { var hx = h.x * T - S.cam.x, hy = h.y * T - S.cam.y - 20, ang = Math.atan2(oy - hy, ox - hx), ex = clamp(480 + Math.cos(ang) * 420, 40, 920), ey = clamp(300 + Math.sin(ang) * 200, 170, 500), dm = Math.round(Math.hypot(o.x - h.x, o.y - h.y));
        x.save(); x.translate(ex, ey); x.rotate(ang); x.fillStyle = "#ffd84a"; x.beginPath(); x.moveTo(26, 0); x.lineTo(-10, -16); x.lineTo(-2, 0); x.lineTo(-10, 16); x.closePath(); x.fill(); x.strokeStyle = "#5a3a00"; x.lineWidth = 2; x.stroke(); x.restore();
        txt(x, dm + " m", ex - Math.cos(ang) * 34, ey - Math.sin(ang) * 34 + 7, 20, "#ffd84a", "center", 0, 800); } }
    // prompt
    var n = nearest(); if (n && !S.cine) { var pt = keyOf("interact").split(" / ")[0] + ": " + promptText(n); x.font = "700 24px system-ui, sans-serif"; var w = x.measureText(pt).width + 40; x.fillStyle = "rgba(4,10,20,.85)"; rr(x, 480 - w / 2, 470, w, 48, 14); x.fill(); x.strokeStyle = "#ffd84a"; x.lineWidth = 2; x.stroke(); txt(x, pt, 480, 503, 24, "#fff", "center", 0, 700); }
    if (S.boss) { var bw = 360, by = 418; x.fillStyle = "rgba(4,10,20,.8)"; rr(x, 300, by, bw, 30, 10); x.fill(); for (i = 0; i < S.boss.max; i++) { x.fillStyle = i < S.boss.hp ? "#c084fc" : "#3a2a4a"; x.fillRect(306 + i * 348 / S.boss.max, by + 6, 348 / S.boss.max - 6, 18); } txt(x, "COUNT ENTROPY", 480, by - 6, 20, "#e3b6ff", "center", 0, 900); }
  }
  function drawHudMsg(x, api) {
    if (S.msg) { x.globalAlpha = Math.min(1, S.msg.life * 2); x.font = "700 22px system-ui, sans-serif"; var mw2 = Math.min(820, x.measureText(S.msg.t).width + 40); x.fillStyle = "rgba(4,10,20,.85)"; rr(x, 480 - mw2 / 2, 170, mw2, mw2 >= 820 ? 70 : 44, 12); x.fill(); txt(x, S.msg.t, 480, 199, 22, "#fff", "center", 780, 700); x.globalAlpha = 1; }
    if (S.td) { txt(x, "Wave " + Math.min(3, S.td.wave + 1) + "/3 · generator " + S.td.hp + "/" + V.TD.genHP + " · grounded " + S.td.grounded, 480, 160, 22, "#ffb070", "center", 0, 800); }
  }
  function wrapLines(x, s, size, maxW) { x.font = "600 " + size + "px system-ui, sans-serif"; var out = [], line = ""; String(s).split(" ").forEach(function (w) { var t2 = line ? line + " " + w : w; if (x.measureText(t2).width > maxW && line) { out.push(line); line = w; } else line = t2; }); out.push(line); return out; }
  function heart(x, px, py, full) { x.fillStyle = full ? "#ff5a7a" : "rgba(255,255,255,.15)"; x.beginPath(); x.moveTo(px, py + 9); x.bezierCurveTo(px - 16, py - 2, px - 8, py - 14, px, py - 6); x.bezierCurveTo(px + 8, py - 14, px + 16, py - 2, px, py + 9); x.fill(); }
  function star(x, px, py, r) { x.beginPath(); for (var i = 0; i < 10; i++) { var a = i / 10 * PI2 - Math.PI / 2, q = i % 2 ? r * .45 : r; x.lineTo(px + Math.cos(a) * q, py + Math.sin(a) * q); } x.closePath(); x.fill(); }
  function buildMini() { var c = document.createElement("canvas"); c.width = V.W * 3; c.height = V.H * 3; var m = c.getContext("2d");
    for (var y = 0; y < V.H; y++) for (var xx = 0; xx < V.W; xx++) { var ch = V.MAP[y][xx], z = V.zoneOf(xx, y), lit = z === "hub" || (ZONE_D[z] && isDone(ZONE_D[z].id));
      m.fillStyle = ch === "~" ? "#1b4f7c" : ch === "#" ? (lit ? "#b8b0d8" : "#4a4660") : ch === "." || ch === ":" || ch === "b" ? (lit ? "#8a8f9a" : "#444a55") : ch === "^" ? "#0c1a12" : ch === "X" && restored() < 4 ? "#c084fc" : (lit ? "#3f7a4c" : "#24402c"); m.fillRect(xx * 3, y * 3, 3, 3); }
    S.ws.pylons.forEach(function (p) { if (!p.on) return; m.fillStyle = p.q > 0 ? "#ff5a5a" : "#4f8bff"; m.fillRect(p.x * 3 - 2, p.y * 3 - 2, 4, 4); }); return c; }

  /* ---------- intro cinematic ---------- */
  var SKY = []; (function () { var xx = 0, i = 0; while (xx < 960) { var w = 50 + rand(i + 4) * 70, hh = 120 + rand(i * 3 + 1) * 200; SKY.push({ x: xx, w: w, h: hh, i: i }); xx += w + 6; i++; } })();
  function drawIntro(x, api) {
    var t = S.introT, red = api.reduce;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, t > 5 ? "#120822" : "#0b1a3a"); g.addColorStop(1, t > 5 ? "#2a0f40" : "#1f3a6a"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    for (var s = 0; s < 60; s++) { x.fillStyle = "rgba(255,255,255," + (.3 + rand(s) * .6) + ")"; x.fillRect(rand(s * 7) * 960, rand(s * 11) * 260, 2, 2); }
    x.fillStyle = "#f2efe0"; x.beginPath(); x.arc(160, 90, 34, 0, PI2); x.fill();
    var vx = 720, vy = 170, drain = clamp((t - 4.5) / 3, 0, 1);
    SKY.forEach(function (b) { var by = 540 - b.h; x.fillStyle = "#1a2236"; x.fillRect(b.x, by, b.w, b.h); x.fillStyle = "#232d46"; x.fillRect(b.x, by, b.w, 6);
      var order = Math.abs(b.x + b.w / 2 - vx) / 960; var lit = drain < order * 1.4 + .05 || t > 13;
      for (var wy = by + 14; wy < 520; wy += 22) for (var wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) { var on = lit && rand(wx * .3 + wy * .7) > .25; x.fillStyle = on ? "#ffd86b" : "#0d1220"; x.fillRect(wx, wy, 9, 11); } });
    if (t > 4.5 && t < 9 && !red) { for (var p = 0; p < 30; p++) { var f = ((t * .7 + p / 30) % 1), sx = rand(p) * 960, sy = 300 + rand(p * 5) * 200; x.fillStyle = "rgba(255,216,107," + (1 - f) + ")"; x.beginPath(); x.arc(sx + (vx - sx) * f, sy + (vy - sy) * f, 3, 0, PI2); x.fill(); }
      x.strokeStyle = "rgba(192,132,252,.7)"; x.lineWidth = 4; for (var k = 0; k < 4; k++) { x.beginPath(); x.arc(vx, vy, 20 + k * 14, t * 4 + k, t * 4 + k + 4); x.stroke(); } }
    if (t > 2) { var ex = t < 4 ? 1100 - (t - 2) / 2 * 330 : 770, ey = 150 + (red ? 0 : Math.sin(t * 2) * 8); x.fillStyle = "#2a0f40"; x.beginPath(); x.moveTo(ex - 40, ey + 90); x.lineTo(ex, ey + 10); x.lineTo(ex + 40, ey + 90); x.fill(); A.drawHead(x, A.VILLAIN, ex, ey, 34, -1, { mood: "fight" }); }
    if (t > 7.5) { var hx = 160, hy = 470; x.fillStyle = "#ff5a5a"; x.globalAlpha = clamp(t - 7.5, 0, 1); A.drawHead(x, A.byId[save.who] || A.CAST[0], hx, hy, 30, 1, { mood: "fight" }); x.beginPath(); x.arc(hx + 34, hy - 36, 14, 0, PI2); x.fill(); txt(x, Math.floor(t * 2) % 2 ? "+" : "−", hx + 34, hy - 28, 22, "#fff", "center", 0, 900); x.globalAlpha = 1; }
    var caps = [[0, "Volt City hums with electric charge..."], [2.2, "...until Count Entropy arrives. “Order is so BORING.”"], [4.5, "He drains every district's power into his Tower on the lake."], [7.5, "But you carry a Volt Pack: flip its charge between + and − and let Coulomb's law fling you across the city."], [10.8, ""]];
    var cap = caps.filter(function (c) { return t >= c[0]; }).pop();
    if (cap[1]) { x.fillStyle = "rgba(4,8,18,.82)"; rr(x, 60, 30, 840, 80, 16); x.fill(); txt(x, cap[1], 480, 66, 26, "#fff", "center", 800, 700); }
    if (t > 10.8) { var sc = red ? 1 : Math.min(1, (t - 10.8) * 2); x.save(); x.translate(480, 230); x.scale(sc, sc); txt(x, "VOLT CITY", 6, 6, 110, "#2a0f40", "center", 0, 900); txt(x, "VOLT CITY", 0, 0, 110, "#ffd84a", "center", 0, 900); x.restore();
      txt(x, "Restore six districts · defeat Count Entropy", 480, 290, 26, "#e8f4ff", "center", 0, 700); }
    txt(x, (t > 10.8 ? "Press " + keyOf("interact") + " or tap to start" : "Press " + keyOf("interact") + " or tap to skip"), 480, 530 - 16, 22, "rgba(255,255,255,.85)", "center", 0, 700);
  }
  function endIntro(api) {
    S.mode = "pick"; api.music(HUB_SONG);
    dlg(api, "<h2>Volt City</h2><p>Count Entropy has drained the city. Your Volt Pack holds ±25 µC: flip it to make charged pylons pull you in or throw you away (F = kqQ/r²). Restore all six districts, then storm his Tower.</p>" + A.picker(api, save.who, "Choose your hero") +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>" + (save.done.length ? "Continue (" + restored() + "/6 lit)" : "Start") + "</button></div>",
      function (a, el) { if (a === "pick" && el) { save.who = el.getAttribute("data-id"); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); persist(); }
        else if (a === "go") { save.intro = true; persist(); api.hide(); S.mode = "world"; setPad(api, "world"); api.music(songFor(zoneHere()));
          if (!save.talked.mayor) say("Walk (" + keyOf("left") + "/" + keyOf("right") + "/" + keyOf("up") + "/" + keyOf("down") + ") to Mayor Okafor and press " + keyOf("interact") + ".", 5); } }, "go");
    A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }

  /* ---------- the game object ---------- */
  game = {
    song: HUB_SONG,
    actions: [
      { id: "left", label: "Move left", keys: ["KeyA", "ArrowLeft"], touch: { label: "◀", x: 7, y: 83, s: .9 } },
      { id: "right", label: "Move right", keys: ["KeyD", "ArrowRight"], touch: { label: "▶", x: 27, y: 83, s: .9 } },
      { id: "up", label: "Move up", keys: ["KeyW", "ArrowUp"], touch: { label: "▲", x: 17, y: 72, s: .9 } },
      { id: "down", label: "Move down", keys: ["KeyS", "ArrowDown"], touch: { label: "▼", x: 17, y: 94, s: .9 } },
      { id: "flip", label: "Flip polarity (+/−)", keys: ["Space", "KeyJ"], touch: { label: "±", x: 88, y: 83, s: 1.2 } },
      { id: "interact", label: "Interact / confirm", keys: ["KeyE", "Enter"], touch: { label: "E", x: 71, y: 93, s: .9 } },
      { id: "dash", label: "Dash (or double-tap a direction)", keys: ["ShiftLeft", "KeyK"], touch: { label: "»", x: 71, y: 73, s: .9 } },
      { id: "log", label: "Quest log and map", keys: ["KeyQ", "Tab"], touch: { label: "☰", x: 50, y: 6, s: .8 } },
      { id: "back", label: "Leave a puzzle", keys: ["KeyX", "Backspace"], touch: { label: "✕", x: 50, y: 6, s: .8 } }
    ],
    init: function (api) {
      API = api; setupCheats(api); setupSettings(api); rebuild();
      if (save.intro) { S.mode = "intro"; S.introT = 10.8; } setPad(api, "intro");
      api.panel("<p>Your Volt Pack carries a charge of ±25 µC. Every charged pylon, crate and Entropy spark pushes or pulls on it along the line joining them, and all those forces add as vectors. Flip your sign to switch between attraction and repulsion: get pulled onto a pylon, flip, and you're thrown across the water.</p>" +
        "<table><tr><td>Coulomb's law</td><td><span class='gm-eq'>F = k q Q / r²</span>, k = 8.99 × 10⁹ N·m²/C²</td></tr><tr><td>Superposition</td><td><span class='gm-eq'>F = F₁ + F₂ + …</span> (vectors)</td></tr><tr><td>Field, potential</td><td><span class='gm-eq'>E = F / q</span>, <span class='gm-eq'>V = kQ / r</span>, <span class='gm-eq'>W = qΔV</span></td></tr>" +
        "<tr><td>Capacitors</td><td><span class='gm-eq'>q = CV</span>, <span class='gm-eq'>U = ½CV²</span>, <span class='gm-eq'>V(t) = Vs(1 − e^(−t/RC))</span></td></tr><tr><td>Combining (ENGG 205)</td><td>parallel <span class='gm-eq'>C = C₁ + C₂</span>, series <span class='gm-eq'>1/C = 1/C₁ + 1/C₂</span></td></tr></table>" +
        "<p class='gm-small'>Game model: 1 tile = 1 m; hero 0.4 kg, ±25 µC; pylons ±120 µC; sparks ±12 µC; ground friction μ = 0.8 (a pylon must out-pull μmg = 3.1 N before it can drag you); skimming over water has drag instead of friction. Charges are small spheres (r² softened by 0.3 m) and sources beyond 9 m are ignored. Real objects this charged would spark over, and flipping polarity on demand is a game metaphor. Count Entropy is a story villain. Course: PHYS 122 electrostatics and capacitance; series/parallel capacitors from ENGG 205.</p>",
        "<p>Walk to the yellow arrow. Touch a pylon while it attracts you, then flip to launch along the dotted line. Herd sparks into lightning rods or water. Tap the objective card or the minimap to open the quest log. Progress is saved on this device.</p>");
      window.VoltCity = { S: S, save: save, V: V, h: h, api: api, rebuild: rebuild, objective: objective, restore: function (id) { restore(api, DBY[id]); }, complete: function (t) { complete(api, t); }, open: { probe: function (i) { openProbe(api, V.CONSOLES.filter(function (c) { return c.level === i; })[0]); }, cap: function () { openCap(api); }, equi: function () { openEqui(api); }, scope: function () { openScope(api); } }, endIntro: function () { endIntro(api); },
        ring: { map: function () { openMap(api); }, district: function (id) { openDistrict(api, OBY[id]); }, puzzle: function (id, i) { var d = OBY[id]; openPuzzle(api, outerPuzzle(d, i), { type: "outer", d: d, i: i, label: d.name + ": " + outerPuzzle(d, i).title }); },
          ladder: function () { openLadder(api); }, sandbox: function () { openSandbox(api); }, upgrades: function () { openUpgrades(api); }, options: function () { openOptions(api); } } };
    },
    update: function (dt, api) {
      cheatTick(api);
      if (S.mode === "intro") { S.introT += dt; if (api.hit("interact", "flip")) { if (S.introT < 10.8) S.introT = 10.8; else endIntro(api); } return; }
      if (api.overlayOpen()) { S.ovWas = true; return; }
      if (S.after) { var pend = S.after; S.after = null; pend(); if (api.overlayOpen()) return; }
      if (S.ovWas) { S.ovWas = false; return; } // swallow the Enter/Space that just closed a dialog
      if (S.mode === "world") worldStep(api, dt);
      else if (S.mode === "probe") probeStep(api, dt);
      else if (S.mode === "cap") capStep(api, dt);
      else if (S.mode === "equi") { eqStep(api); stepFx(dt); }
      else if (S.mode === "scope") scStep(api, dt);
      if (S.mode !== "world") stepFx(dt);
      // camera
      var tx = h.x * T - 480, ty = h.y * T - 300;
      if (S.cine) { var k = clamp(S.cine.t / .8, 0, 1), e = k * k * (3 - 2 * k), cx = S.cine.d.center[0] * T - 480, cy = S.cine.d.center[1] * T - 290, back = clamp((S.cine.t - (S.cine.dur - .8)) / .8, 0, 1); tx = S.cine.cam0.x + (cx - S.cine.cam0.x) * e; ty = S.cine.cam0.y + (cy - S.cine.cam0.y) * e; tx += (h.x * T - 480 - tx) * back; ty += (h.y * T - 300 - ty) * back; S.cam.x = tx; S.cam.y = ty; }
      else { S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 7); S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 7); }
      S.cam.x = clamp(S.cam.x, 0, V.W * T - 960); S.cam.y = clamp(S.cam.y, 0, V.H * T - 540);
    },
    draw: function (api) {
      var x = api.x; BTNS = [];
      if (S.mode === "intro" || S.mode === "pick") return drawIntro(x, api);
      if (S.mode === "probe") return drawProbe(x, api);
      if (S.mode === "cap") return drawCap(x, api);
      if (S.mode === "equi") return drawEqui(x, api);
      if (S.mode === "scope") return drawScope(x, api);
      drawWorld(x, api);
    },
    click: function (mx, my, api) {
      if (api.overlayOpen()) return;
      if (S.mode === "intro") { if (S.introT < 10.8) S.introT = 10.8; else endIntro(api); return; }
      for (var i = 0; i < BTNS.length; i++) { var b = BTNS[i]; if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { api.sound.sfx("click"); return clickBtn(api, b.act); } }
      if (S.mode === "probe") { var c = Math.floor((mx - PB.BX) / PB.C), r = Math.floor((my - PB.BY) / PB.C); if (c >= 0 && c < PS.COLS && r >= 0 && r < PS.ROWS) { S.pz.cur = [c, r]; probeCycle(api, c, r); } return; }
      if (S.mode === "equi") { var ec = Math.floor((mx - EQB.BX) / EQB.C), er = Math.floor((my - EQB.BY) / EQB.C), dc = ec - S.eq.s.c, dr = er - S.eq.s.r; if (Math.abs(dc) + Math.abs(dr) === 1) eqTry(api, dc, dr); return; }
      if (S.mode === "world" && ((mx < 482 && my < 100) || (mx > 740 && my < 160))) openLog(api);
    },
    menu: function (api) { api.hide(); S.mode = "intro"; S.introT = 10.8; setPad(api, "intro"); }
  };
  A.run(game);
  }
})();
