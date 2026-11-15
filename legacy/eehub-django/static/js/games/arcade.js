/* EE Hub learning arcade runtime (shared by every game). No dependencies.
 * Arcade.run(game) mounts a game on the play page: fixed-step loop (120 Hz), letterboxed 960x540 canvas,
 * keyboard + big touch buttons mapped to the same key codes, DOM overlays for menus, procedural Web Audio
 * (starts muted; only plays after a user gesture), pause on hide, reduced-motion flag.
 * Arcade.CAST is the shared, clearly fictionalised scientist cast (facts cite their sources). */
(function () {
  "use strict";
  var W = 960, H = 540, STEP = 1 / 120;
  var reduce = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    document.documentElement.getAttribute("data-motion") === "reduce";
  var baseReduce = reduce;
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem("ee-arcade-" + k)); localStorage.setItem("ee-arcade-" + k, JSON.stringify(v)); } catch (e) { return null; } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Cast: stylised avatars. Specials are labelled game metaphors, not historical claims. ---------- */
  var CAST = [
    { id: "newton", name: "Isaac Newton", life: "1643–1727", skin: "#f1c9a5", hair: "#e9e4dc", style: "wig", coat: "#7a3b2e", eye: "#3b2a20",
      mass: 80, speed: 1.0, jump: 1.0, power: 1.05,
      fact: "Set out the laws of motion and universal gravitation in the Principia (1687).", src: "Encyclopaedia Britannica, “Isaac Newton”",
      special: "Third-law shove", idea: "Forces come in equal and opposite pairs: push the ball or a rival and you are pushed back too." },
    { id: "faraday", name: "Michael Faraday", life: "1791–1867", skin: "#f0c7a0", hair: "#8a8f99", style: "whiskers", coat: "#2f4a6b", eye: "#26313d",
      mass: 70, speed: 1.05, jump: 1.0, power: 0.95,
      fact: "Discovered electromagnetic induction in 1831.", src: "Encyclopaedia Britannica, “Michael Faraday”",
      special: "Lenz brake", idea: "An induced current opposes the change that causes it (Lenz's law), so moving magnets near conductors get slowed." },
    { id: "curie", name: "Marie Curie", life: "1867–1934", skin: "#f3d0b2", hair: "#5a3d2b", style: "bun", coat: "#3b3550", eye: "#2c2433",
      mass: 58, speed: 1.12, jump: 1.08, power: 0.9,
      fact: "Nobel Prize in Physics (1903) and in Chemistry (1911) for work on radioactivity.", src: "nobelprize.org, “Marie Curie – Facts”",
      special: "Half-life", idea: "Radioactive activity halves every half-life: N = N₀(½)^(t/T½). The effect fades by half each second." },
    { id: "tesla", name: "Nikola Tesla", life: "1856–1943", skin: "#efc8a2", hair: "#1e1b1d", style: "slick", coat: "#1f2a33", eye: "#1c2226",
      mass: 74, speed: 1.04, jump: 1.02, power: 1.0,
      fact: "Patented a polyphase AC induction motor in 1888.", src: "Encyclopaedia Britannica, “Nikola Tesla”",
      special: "AC pulse", idea: "Alternating current reverses direction many times a second (50 Hz in Nigeria). The pulse pushes, then pulls." },
    { id: "einstein", name: "Albert Einstein", life: "1879–1955", skin: "#f2cba8", hair: "#f2f2f2", style: "wild", coat: "#5b5f6a", eye: "#2f2a26",
      mass: 72, speed: 1.0, jump: 1.0, power: 1.08,
      fact: "Explained the photoelectric effect (1905); the 1921 Nobel Prize in Physics cites it.", src: "nobelprize.org, “Albert Einstein – Facts”",
      special: "Photon shot", idea: "Light arrives in quanta of energy E = hf. In game, the shot travels in a straight line, very fast." },
    { id: "bohr", name: "Niels Bohr", life: "1885–1962", skin: "#f0c4a0", hair: "#6b5444", style: "receding", coat: "#36503f", eye: "#2b2a24",
      mass: 86, speed: 0.92, jump: 0.95, power: 1.1,
      fact: "Proposed his model of the hydrogen atom in 1913; Nobel Prize in Physics 1922.", src: "nobelprize.org, “Niels Bohr – Facts”",
      special: "Quantum jump", idea: "In Bohr's model an electron sits only on allowed energy levels and jumps between them, never in between." },
    { id: "groove", name: "DJ Groove", life: "guest", skin: "#8d5a3b", hair: "#1a1414", style: "dj", coat: "#1b1b2b", eye: "#1a1010", guest: true,
      mass: 64, speed: 1.14, jump: 1.06, power: 0.92,
      fact: "An original EE Hub guest character: a dancer who loves physics.", src: "Original EE Hub character",
      special: "Low-friction glide", idea: "Friction force is f = μN. Shrink μ and the same push carries you much further before friction stops you." },
    { id: "kai", name: "Master Kai", life: "guest", skin: "#e8c193", hair: "#151515", style: "band", coat: "#b8860b", eye: "#151515", guest: true,
      mass: 66, speed: 1.1, jump: 1.1, power: 1.0,
      fact: "An original EE Hub guest character: a kung-fu teacher who explains every move with Newton's laws.", src: "Original EE Hub character",
      special: "One-inch push", idea: "Impulse J = FΔt = Δp. A big force over a very short time still changes momentum a lot."
    }
  ];
  var VILLAIN = { id: "entropy", name: "Count Entropy", life: "villain", skin: "#d8d0e8", hair: "#2a1f3d", style: "tophat", coat: "#3d1f5c", eye: "#ff3355", guest: true,
    mass: 82, speed: 1.06, jump: 1.04, power: 1.1,
    fact: "The arcade's original villain. He wants every ordered system to fall into disorder.", src: "Original EE Hub character",
    special: "Disorder", idea: "Named after entropy, the thermodynamic measure of disorder. His move scatters motion in random directions: a story effect, not real thermodynamics." };
  // SHA-256 in plain JS (crypto.subtle is not available on a plain-http LAN address). Returns lower-case hex of the UTF-8 bytes.
  function sha256(str) {
    var K = sha256.K, i, j; if (!K) { K = sha256.K = []; var n = 2, c = 0; while (c < 64) { var p = true; for (i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; } if (p) K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; n++; } }
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], b = [], s = unescape(encodeURIComponent(String(str)));
    for (i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); var bits = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    b.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    var w = new Array(64);
    for (var o = 0; o < b.length; o += 64) {
      for (i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (i = 16; i < 64; i++) { var x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[i - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0; }
      var a = H[0], bb = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) { var t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & bb) ^ (a & cc) ^ (bb & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = bb; bb = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    for (i = 0, j = ""; i < 8; i++) j += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8); return j;
  }
  // The maker's hidden character: white and gold, initials MIB. Not in CAST, so no picker shows him until he is unlocked.
  var HERO = { id: "mib", name: "M.I. Bugaje", full: "Muhammad Iliyasu Bugaje", life: "maker", skin: "#dcab80", hair: "#17110d", style: "coily", coat: "#ffffff", eye: "#f6c445", trim: "#f6c445", tag: "MIB", hidden: true,
    mass: 80, speed: 1.3, jump: 1.25, power: 1.5, fact: "Muhammad Iliyasu Bugaje designed and built EE Hub and this arcade.", src: "EE Hub", special: "Maker's Mark", idea: "The maker's test character: every stat is maxed so each game can be walked through quickly." };
  var byId = {}; CAST.concat([VILLAIN]).forEach(function (c) { byId[c.id] = c; });
  // the hidden character only resolves once the server has accepted the maker's code in this session; otherwise every game falls back to its default
  Object.defineProperty(byId, "mib", { enumerable: false, get: function () { return window.__gmSession && window.__gmSession.hero ? HERO : undefined; } });

  function drawHead(x, c, cx, cy, r, face, o) {
    o = o || {}; face = face || 1;
    x.save(); x.translate(cx, cy);
    if (o.hit) x.translate((Math.random() - .5) * 4, 0);
    // body stub (coat + collar)
    x.fillStyle = c.coat; x.beginPath(); x.ellipse(0, r * 1.05, r * .72, r * .45, 0, Math.PI, 0); x.fill();
    x.fillStyle = "#f4f4f0"; x.beginPath(); x.moveTo(-r * .18, r * .62); x.lineTo(0, r * .9); x.lineTo(r * .18, r * .62); x.fill();
    // back hair
    x.fillStyle = c.hair;
    if (c.style === "wig") { for (var i = -1; i <= 1; i += 2) { x.beginPath(); x.ellipse(i * r * .78, r * .25, r * .38, r * .7, 0, 0, 7); x.fill(); } }
    if (c.style === "bun") { x.beginPath(); x.arc(-face * r * .7, -r * .55, r * .32, 0, 7); x.fill(); }
    // face
    var g = x.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r * 1.05);
    g.addColorStop(0, "#fff3e6"); g.addColorStop(.35, c.skin); g.addColorStop(1, shade(c.skin, -.22));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
    // hair top
    x.fillStyle = c.hair; x.beginPath();
    if (c.style === "wild") { for (var k = 0; k < 9; k++) { var a = Math.PI + k / 8 * Math.PI; x.moveTo(0, 0); x.arc(Math.cos(a) * r * .78, Math.sin(a) * r * .72 - r * .1, r * .36, 0, 7); } x.fill(); }
    else if (c.style === "receding") { x.arc(0, -r * .05, r * 1.0, Math.PI * 1.05, Math.PI * 1.25); x.arc(0, -r * .05, r * 1.0, Math.PI * 1.75, Math.PI * 1.95); x.lineTo(0, -r * .3); x.fill(); }
    else if (c.style === "coily") { // dark tight curls: a low cap with a ring of small coils along the hairline and crown
      x.ellipse(0, -r * .5, r * .97, r * .6, 0, Math.PI, 0); x.fill();
      for (var q = 0; q < 2; q++) for (var cz = 0; cz <= 10 - q; cz++) { var ca = Math.PI * (1.04 + (cz + q * .5) / 10 * .92), rr2 = r * (1.02 - q * .2); x.beginPath(); x.arc(Math.cos(ca) * rr2, Math.sin(ca) * rr2 * .98 - r * .08, r * (.17 - q * .02), 0, 7); x.fill(); }
      x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = Math.max(1, r * .035); for (var cs = 0; cs < 7; cs++) { var sa = Math.PI * (1.12 + cs / 6 * .76); x.beginPath(); x.arc(Math.cos(sa) * r * .86, Math.sin(sa) * r * .84 - r * .08, r * .08, .4, 4.2); x.stroke(); } }
    else if (c.style === "slick") { x.ellipse(face * -r * .08, -r * .55, r * .95, r * .55, face * -.15, Math.PI, 0); x.fill(); }
    else if (c.style === "dj") { x.ellipse(0, -r * .55, r * .95, r * .55, 0, Math.PI, 0); x.fill(); x.strokeStyle = "#ff3d8b"; x.lineWidth = r * .14; x.beginPath(); x.arc(0, -r * .1, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.fillStyle = "#ff3d8b"; x.fillRect(-r * 1.12, -r * .25, r * .26, r * .5); x.fillRect(r * .86, -r * .25, r * .26, r * .5); x.beginPath(); }
    else if (c.style === "band") { x.ellipse(0, -r * .5, r * .98, r * .6, 0, Math.PI, 0); x.fill(); x.fillStyle = "#d62828"; x.fillRect(-r * .98, -r * .52, r * 1.96, r * .2); x.beginPath(); x.moveTo(-face * r * .9, -r * .45); x.lineTo(-face * r * 1.4, -r * .2); x.lineTo(-face * r * 1.3, -r * .5); x.fill(); x.beginPath(); }
    else { x.ellipse(0, -r * .5, r * .98, r * .6, 0, Math.PI, 0); x.fill(); if (c.style === "wig") { for (var w = -2; w <= 2; w++) { x.moveTo(w * r * .35, -r * .9); x.arc(w * r * .35, -r * .9, r * .2, 0, 7); } x.fill(); } }
    // eyes
    var blink = o.blink || o.expr === "hurt" ? .15 : 1, ex = face * r * .14;
    for (var s = -1; s <= 1; s += 2) {
      x.fillStyle = "#fff"; x.beginPath(); x.ellipse(s * r * .32 + ex, -r * .05, r * .16, r * .18 * blink, 0, 0, 7); x.fill();
      x.fillStyle = c.eye; x.beginPath(); x.arc(s * r * .32 + ex + face * r * .06, -r * .03, r * .08 * blink, 0, 7); x.fill();
    }
    // brows
    x.strokeStyle = shade(c.hair === "#f2f2f2" || c.hair === "#e9e4dc" ? "#9a9590" : c.hair, -.1); x.lineWidth = r * .08; x.lineCap = "round";
    var angry = o.mood === "fight" ? .12 : 0;
    for (var t = -1; t <= 1; t += 2) { x.beginPath(); x.moveTo(t * r * .46 + ex, -r * .3 - (t * face > 0 ? 0 : angry * r)); x.lineTo(t * r * .18 + ex, -r * .3 + (t * face > 0 ? angry * r : 0)); x.stroke(); }
    // moustache / whiskers / mouth
    if (c.id === "einstein" || c.id === "tesla") { x.fillStyle = c.id === "einstein" ? "#e6e6e6" : "#1e1b1d"; x.beginPath(); x.ellipse(ex, r * .3, r * .3, r * .1, 0, 0, 7); x.fill(); }
    if (c.style === "whiskers") { x.fillStyle = c.hair; for (var q = -1; q <= 1; q += 2) { x.beginPath(); x.ellipse(q * r * .86, r * .2, r * .16, r * .42, 0, 0, 7); x.fill(); } }
    x.strokeStyle = "#6b3a2c"; x.lineWidth = r * .07; x.beginPath();
    if (o.mouth > .05) { x.stroke(); x.fillStyle = "#4a1b18"; x.beginPath(); x.ellipse(ex, r * .45, r * (.13 + o.mouth * .08), r * (.05 + o.mouth * .2), 0, 0, 7); x.fill(); if (o.mouth > .4) { x.fillStyle = "#e86a6a"; x.beginPath(); x.ellipse(ex, r * (.5 + o.mouth * .1), r * .08, r * .05 * o.mouth, 0, 0, 7); x.fill(); } x.beginPath(); }
    else if (o.mood === "happy") x.arc(ex, r * .38, r * .2, .15 * Math.PI, .85 * Math.PI); else if (o.mood === "sad") x.arc(ex, r * .6, r * .16, 1.2 * Math.PI, 1.8 * Math.PI); else { x.moveTo(ex - r * .14, r * .48); x.lineTo(ex + r * .14, r * .46); }
    x.stroke();
    if (c.style === "tophat") { x.fillStyle = "#15101f"; x.fillRect(-r * .62, -r * 1.75, r * 1.24, r * .95); x.fillRect(-r * .95, -r * .86, r * 1.9, r * .16); x.fillStyle = "#c084fc"; x.fillRect(-r * .62, -r * 1.02, r * 1.24, r * .14); }
    if (c.tag) { x.fillStyle = c.trim || "#f6c445"; x.fillRect(-r * .98, -r * .62, r * 1.96, r * .26); x.fillStyle = "#3a2a05"; x.font = "900 " + Math.max(6, r * .24) + "px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(c.tag, 0, -r * .48); x.textBaseline = "alphabetic"; }
    if (c.id === "curie" || c.id === "bohr" || c.id === "faraday") { x.fillStyle = "rgba(255,120,120,.18)"; for (var b = -1; b <= 1; b += 2) { x.beginPath(); x.arc(b * r * .55, r * .2, r * .13, 0, 7); x.fill(); } }
    x.restore();
  }
  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = p < 0 ? 0 : 255, t = Math.abs(p);
    return "rgb(" + Math.round(r + (f - r) * t) + "," + Math.round(g + (f - g) * t) + "," + Math.round(b + (f - b) * t) + ")";
  }

  /* ---------- Settings (per game, this device only: controls, touch layout, sound, feel) ---------- */
  var SLUG = (document.querySelector("[data-gm-stage]") || {}).getAttribute ? (document.querySelector("[data-gm-stage]").getAttribute("data-gm-slug") || "game") : "game";
  var SET = Object.assign({ music: .55, sfx: .8, voice: true, buzz: true, shake: true, fx: "high", keys: {}, touch: {}, touchScale: 1, touchAlpha: .85 }, store("set-" + SLUG) || {});
  function saveSet() { store("set-" + SLUG, SET); }
  /* Option registry (docs/ARCADE_SETTINGS.md). Games call api.settings.add({id, tab, label, type, default, ...}) in init and read
     api.settings.get(id). Values live in SET.o and are saved with the rest; the methods are non-enumerable so they are never saved.
     The settings screen itself is static/js/games/arcade-settings.js; without it (test harnesses) the registry still works. */
  SET.o = SET.o && typeof SET.o === "object" ? SET.o : {}; SET.layout = SET.layout && typeof SET.layout === "object" ? SET.layout : {};
  var REG = [], REGI = {}, REGSUB = [];
  function regGet(id) { var o = REGI[id]; if (Object.prototype.hasOwnProperty.call(SET.o, id)) return SET.o[id]; if (o) return o.default; return SET[id]; }
  function regApply(o, v) { if (o && o.apply) try { o.apply(v); } catch (e) { if (window.console) console.warn("setting " + o.id, e); } }
  Object.defineProperties(SET, {
    add: { value: function (o) { if (!o || !o.id) return; if (REGI[o.id]) REG.splice(REG.indexOf(REGI[o.id]), 1); o.tab = o.tab || "gameplay"; o.type = o.type || "toggle"; REG.push(o); REGI[o.id] = o; regApply(o, regGet(o.id)); return o; } },
    get: { value: regGet },
    set: { value: function (id, v) { SET.o[id] = v; saveSet(); regApply(REGI[id], v); REGSUB.forEach(function (f) { try { f(id, v); } catch (e) {} }); } },
    reset: { value: function (id) { delete SET.o[id]; saveSet(); regApply(REGI[id], regGet(id)); REGSUB.forEach(function (f) { try { f(id, regGet(id)); } catch (e) {} }); } },
    list: { value: function (tab) { return REG.filter(function (o) { return !tab || o.tab === tab; }); } },
    on: { value: function (f) { REGSUB.push(f); } },
    save: { value: saveSet }
  });

  /* ---------- Sound v2: synthesised instruments, seeded composer, crowd, announcer. Muted until switched on. ---------- */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9, 12, 14], minpenta: [0, 3, 5, 7, 10, 12, 15] };
  // Drum grooves on a 16-step bar: k kick, s snare, h hat, o open hat, c clap, p shaker/perc, l log drum (bass hit)
  var GROOVES = {
    anthem: { k: "x...x...x...x...", s: "....x.......x...", h: "..x...x...x...x.", c: "....x.......x..x" },
    afro: { k: "x..x..x...x..x..", s: "......x.......x.", h: "x.xxx.xxx.xxx.xx", p: "..x...x...x..x.x", l: "x.....x...x....." },
    amapiano: { k: "x...x...x...x...", h: "..x...x...x...x.", p: "x.xx.xx.x.xx.xx.", l: "...x..x....x.x..", c: "....x.......x..." },
    funk: { k: "x.....x...x.....", s: "....x..x.x..x...", h: "xxxxxxxxxxxxxxxx", o: ".......x.......x" },
    synthwave: { k: "x...x...x...x...", s: "....x.......x...", h: "..x...x...x...x.", o: "......x.......x." },
    chip: { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    dub: { k: "x.........x.....", s: "........x.......", h: "..x...x...x...x.", o: "...........x...." },
    march: { k: "x...x...x...x...", s: "..x.x.x...x.xxx.", h: "x...x...x...x..." },
    boss: { k: "x.x.x.x.x.x.x.xx", s: "....x.......x.x.", h: "xxxxxxxxxxxxxxxx", c: "....x.......x..." },
    calm: { k: "x.......x.......", h: "....x.......x...", p: "..x.......x....." },
    breaks: { k: "x.....x.x.......", s: "....x.......x..x", h: "x.xxx.x.x.xxx.x." }
  };
  // song(seed, style, opts): an original, deterministic composition (bpm, key, scale, chord loop, bass line, lead motif).
  function song(seed, style, o) {
    o = o || {}; var r = rng(seed * 2654435761 + 7), sc = o.scale || ["minor", "dorian", "major", "mixolydian", "harmonic", "minor"][Math.floor(r() * 6)];
    var progs = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [0, 6, 5, 4], [0, 2, 3, 4], [5, 3, 0, 4], [0, 0, 3, 5]];
    var prog = o.prog || progs[Math.floor(r() * progs.length)], motif = [], b;
    for (b = 0; b < 2; b++) { var bar = []; for (var st = 0; st < 16; st++) { var on = (st % 4 === 0 ? .8 : st % 2 === 0 ? .5 : .28) > r(); bar.push(on ? Math.floor(r() * 7) - (r() < .25 ? 7 : 0) : null); } motif.push(bar); }
    var bassRh = ["x...x...x...x...", "x..x..x.x..x..x.", "x.x...x.x.x...x.", "x.....x...x.x...", "x...x.x.x...x.x."][Math.floor(r() * 5)];
    return { seed: seed, style: style, bpm: o.bpm || 92 + Math.floor(r() * 50), root: o.root || 45 + Math.floor(r() * 10), scale: SCALES[sc], prog: prog, motif: motif, bass: o.bassRh || bassRh,
      groove: GROOVES[o.groove || style] || GROOVES.anthem, lead: o.lead || (style === "chip" ? "square" : style === "calm" ? "sine" : r() < .5 ? "sawtooth" : "square"),
      pad: o.pad !== false, swing: style === "funk" || style === "afro" ? .12 : 0, bright: o.bright || 1800 + r() * 2600, arp: o.arp != null ? o.arp : r() < .5 };
  }
  var Sound = { ac: null, muted: store("muted") === true, vol: store("vol") == null ? .7 : store("vol"), timer: 0, step: 0, next: 0, song: null, lastSfx: {} };
  Sound.ensure = function () {
    if (this.ac || this.muted) return !!this.ac;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { this.ac = new AC(); } catch (e) { return false; }
    var a = this.ac, comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(a.destination);
    this.master = a.createGain(); this.master.gain.value = this.vol; this.master.connect(comp);
    this.music = a.createGain(); this.music.gain.value = SET.music * .5 * (SET.musicMul == null ? 1 : SET.musicMul); this.music.connect(this.master);
    this.fx = a.createGain(); this.fx.gain.value = SET.sfx; this.fx.connect(this.master);
    this.delay = a.createDelay(1); this.delay.delayTime.value = .28; var fb = a.createGain(); fb.gain.value = .32; var wet = a.createGain(); wet.gain.value = .35;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.music);
    var n = a.sampleRate * 2, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = buf;
    return true;
  };
  Sound.env = function (g, t, a, peak, dec) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); };
  Sound.osc = function (type, f, t, dur, peak, dest, o) {
    o = o || {}; var a = this.ac, s = a.createOscillator(), g = a.createGain(); s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.slide) s.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + dur); if (o.detune) s.detune.value = o.detune;
    var node = s; if (o.cut) { var fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(o.cut, t); if (o.cutEnd) fl.frequency.exponentialRampToValueAtTime(o.cutEnd, t + dur); fl.Q.value = o.q || 1; s.connect(fl); node = fl; }
    node.connect(g); g.connect(dest); this.env(g, t, o.att || .005, peak, dur); s.start(t); s.stop(t + dur + (o.att || .005) + .05); return g;
  };
  Sound.noise = function (t, dur, peak, dest, type, f, q) {
    var a = this.ac, s = a.createBufferSource(), g = a.createGain(), fl = a.createBiquadFilter(); s.buffer = this.noiseBuf; fl.type = type || "highpass"; fl.frequency.value = f || 6000; fl.Q.value = q || .7;
    s.connect(fl); fl.connect(g); g.connect(dest); this.env(g, t, .002, peak, dur); s.start(t, Math.random()); s.stop(t + dur + .05);
  };
  var DRUM = {
    k: function (S, t) { S.osc("sine", 150, t, .32, .9, S.music, { slide: .3 }); S.osc("triangle", 60, t, .2, .4, S.music); },
    s: function (S, t) { S.noise(t, .16, .45, S.music, "bandpass", 2200, .8); S.osc("triangle", 190, t, .1, .3, S.music, { slide: .6 }); },
    c: function (S, t) { for (var i = 0; i < 3; i++) S.noise(t + i * .011, .09, .3, S.music, "bandpass", 1500, 1.2); },
    h: function (S, t) { S.noise(t, .035, .13, S.music, "highpass", 8000); },
    o: function (S, t) { S.noise(t, .22, .1, S.music, "highpass", 7000); },
    p: function (S, t) { S.noise(t, .05, .09, S.music, "bandpass", 5200, 2); },
    l: function (S, t, root) { S.osc("sine", root, t, .42, .8, S.music, { slide: .55 }); S.osc("square", root, t, .08, .12, S.music, { cut: 900 }); }
  };
  function mhz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  Sound.play = function (sg) { if (!sg) return; if (this.song && this.song.seed === sg.seed && this.song.style === sg.style) return; this.song = sg; this.step = 0; if (this.ac) this.next = this.ac.currentTime + .08; this.loop(); };
  Sound.loop = function () {
    var T = this; clearTimeout(T.timer);
    if (!T.song || T.muted || !T.ac) return;
    var sg = T.song, spb = 60 / sg.bpm / 4;
    while (T.next < T.ac.currentTime + .25) {
      var bar = Math.floor(T.step / 16), s = T.step % 16, sect = Math.floor(bar / 8) % 2, chordDeg = sg.prog[bar % sg.prog.length] + (sect && bar % 4 === 3 ? 1 : 0);
      var deg = function (d) { var n = sg.scale.length, o = Math.floor(d / n); return sg.scale[((d % n) + n) % n] + 12 * o; };
      var root = sg.root + deg(chordDeg), t = T.next + (s % 2 ? sg.swing * spb : 0), G = sg.groove, fill = bar % 8 === 7 && s >= 12;
      for (var key in G) if (G[key][s] === "x" && !(fill && key === "h")) DRUM[key](T, t, mhz(root - 12));
      if (fill && s % 1 === 0) DRUM.s(T, t);
      if (sg.bass[s] === "x") T.osc(sg.style === "chip" ? "square" : "sawtooth", mhz(root - 12 + (s === 14 ? 7 : 0)), t, spb * 1.8, .22, T.music, { cut: 700, cutEnd: 200, q: 4 });
      if (sg.pad && s === 0) [0, 2, 4].forEach(function (k, i) { T.osc("sawtooth", mhz(sg.root + 12 + deg(chordDeg + k)), t, spb * 15, .035, T.music, { att: .25, cut: 1400, detune: (i - 1) * 9 }); });
      if (sg.arp && s % 2 === 1) T.osc("triangle", mhz(sg.root + 24 + deg(chordDeg + [0, 2, 4, 7][(s >> 1) % 4])), t, spb * .9, .035, T.music, { cut: sg.bright });
      var mot = sg.motif[(bar + sect) % 2][s];
      if (mot != null && (bar % 4 !== 3 || s < 12)) { var g = T.osc(sg.lead, mhz(sg.root + 24 + deg(chordDeg + mot + (sect ? 2 : 0))), t, spb * 1.6, .07, T.music, { cut: sg.bright, att: .01 }); g.connect(T.delay); }
      T.next += spb; T.step++;
    }
    T.timer = setTimeout(function () { T.loop(); }, 60);
  };
  Sound.sfx = function (name, o) {
    if (this.muted || !this.ac) return; var T = this, t = T.ac.currentTime, last = T.lastSfx[name] || 0;
    if (t - last < ({ bounce: .09, hit: .05, click: .03, zap: .06, kick: .06 }[name] || 0)) return; T.lastSfx[name] = t; var F = T.fx;
    ({ kick: function () { T.osc("sine", 180, t, .14, .7, F, { slide: .35 }); T.noise(t, .05, .25, F, "bandpass", 1800); },
       bounce: function () { T.osc("triangle", 260, t, .07, .25, F, { slide: .7 }); },
       jump: function () { T.osc("square", 260, t, .16, .09, F, { slide: 2.2, cut: 3000 }); },
       dash: function () { T.noise(t, .22, .25, F, "bandpass", 900, .6); T.osc("sawtooth", 140, t, .2, .08, F, { slide: 2.5, cut: 1500 }); },
       hit: function () { T.noise(t, .14, .5, F, "lowpass", 1400); T.osc("square", 110, t, .14, .2, F, { slide: .5, cut: 900 }); },
       heavy: function () { T.noise(t, .25, .7, F, "lowpass", 900); T.osc("sine", 90, t, .3, .6, F, { slide: .4 }); },
       block: function () { T.osc("square", 900, t, .05, .1, F, { slide: .8 }); T.noise(t, .04, .2, F, "highpass", 4000); },
       special: function () { T.osc("sawtooth", 180, t, .55, .14, F, { slide: 5, cut: 4000 }); T.osc("square", 270, t, .55, .07, F, { slide: 3 }); },
       zap: function () { for (var i = 0; i < 4; i++) T.osc("sawtooth", 900 + Math.random() * 1600, t + i * .03, .05, .07, F, { cut: 5000 }); T.noise(t, .15, .2, F, "highpass", 3000); },
       laser: function () { T.osc("sawtooth", 1400, t, .18, .1, F, { slide: .2, cut: 6000 }); },
       boom: function () { T.noise(t, .8, .8, F, "lowpass", 600); T.osc("sine", 70, t, .7, .7, F, { slide: .3 }); },
       coin: function () { T.osc("square", 988, t, .06, .1, F); T.osc("square", 1319, t + .06, .18, .1, F); },
       stomp: function () { T.osc("square", 300, t, .1, .15, F, { slide: .4 }); T.noise(t, .06, .2, F, "lowpass", 1200); },
       power: function () { [262, 330, 392, 523, 659].forEach(function (f, i) { T.osc("square", f, t + i * .06, .16, .08, F, { cut: 4000 }); }); },
       goal: function () { [523, 659, 784, 1046].forEach(function (f, i) { T.osc("square", f, t + i * .09, .3, .1, F, { cut: 5000 }); }); },
       win: function () { [392, 523, 659, 784, 659, 1046].forEach(function (f, i) { T.osc("triangle", f, t + i * .12, .26, .16, F); }); },
       lose: function () { [392, 330, 262, 196].forEach(function (f, i) { T.osc("triangle", f, t + i * .18, .32, .14, F); }); },
       whistle: function () { T.osc("sine", 2600, t, .35, .14, F, { detune: 30 }); T.osc("sine", 2750, t, .35, .08, F); },
       click: function () { T.osc("square", 1100, t, .03, .05, F); },
       ko: function () { T.osc("sawtooth", 400, t, .9, .2, F, { slide: .15, cut: 2000 }); }
    }[name] || function () {})();
  };
  // Crowd: no noise bed (it sounded like radio static). Cheers and groans are short musical stingers instead.
  Sound.crowd = function () {};
  Sound.chant = function () {};
  Sound.roar = function (sad) {
    if (this.muted || !this.ac) return; var T = this, t = T.ac.currentTime, F = T.fx;
    if (sad) { [[392, 0], [349, .16], [311, .32], [262, .5]].forEach(function (n) { T.osc("triangle", n[0], t + n[1], .34, .12, F, { cut: 1800 }); }); return; }
    [523, 659, 784].forEach(function (f, i) { T.osc("sawtooth", f, t + .02 * i, 1.1, .05, F, { att: .05, cut: 2600 }); });
    [784, 988, 1175, 1568].forEach(function (f, i) { T.osc("square", f, t + .25 + i * .09, .22, .06, F, { cut: 4200 }); });
  };
  // Fanfares for the ceremony kit: a different musical sting for a win, a title, a draw and a loss.
  Sound.fanfare = function (kind) {
    if (this.muted || !this.ac) return; var T = this, t = T.ac.currentTime + .02, F = T.fx;
    function brass(f, at, d, v) { T.osc("sawtooth", f, t + at, d, v || .07, F, { att: .02, cut: 2400, cutEnd: 1200 }); T.osc("square", f * 2, t + at, d * .8, (v || .07) * .35, F, { att: .02, cut: 3600 }); }
    function drum(at) { T.osc("sine", 82, t + at, .5, .5, F, { slide: .5 }); T.noise(t + at, .12, .12, F, "lowpass", 500); }
    if (kind === "champion" || kind === "gameComplete") {
      [[392, 0, .16], [392, .17, .16], [392, .34, .16], [523, .51, .5], [466, 1.02, .22], [523, 1.26, .22], [587, 1.5, .22], [659, 1.74, .9]].forEach(function (n) { brass(n[0], n[1], n[2]); brass(n[0] * 1.26, n[1], n[2], .04); });
      [784, 988, 1175, 1568].forEach(function (f, i) { T.osc("triangle", f, t + 1.74 + i * .07, 1.4, .07, F, { att: .03 }); });
      [0, .51, 1.74, 2.0, 2.26].forEach(drum); T.roar(false);
    } else if (kind === "win" || kind === "stageClear" || kind === "newRecord") {
      [[523, 0, .13], [659, .13, .13], [784, .26, .13], [1046, .39, .55]].forEach(function (n) { brass(n[0], n[1], n[2], .06); });
      [1046, 1319, 1568].forEach(function (f, i) { T.osc("triangle", f, t + .39 + i * .05, .9, .06, F, { att: .02 }); }); drum(.39);
      if (kind === "newRecord") [1568, 2093, 2637].forEach(function (f, i) { T.osc("square", f, t + .95 + i * .08, .16, .05, F, { cut: 5000 }); });
    } else if (kind === "draw") {
      [[440, 0, .3], [392, .32, .3], [440, .64, .7]].forEach(function (n) { T.osc("triangle", n[0], t + n[1], n[2], .12, F, { att: .02 }); });
    } else { // lose, eliminated: a slow falling minor line over a low drone
      var seq = kind === "eliminated" ? [[392, 0], [370, .42], [311, .84], [294, 1.26], [233, 1.7], [196, 2.2]] : [[392, 0], [349, .36], [311, .72], [262, 1.1], [196, 1.55]];
      seq.forEach(function (n, i) { T.osc("triangle", n[0], t + n[1], i === seq.length - 1 ? 1.5 : .5, .13, F, { att: .04, cut: 1500 }); T.osc("sine", n[0] / 2, t + n[1], .6, .1, F, { att: .05 }); });
      T.osc("sine", 65, t, 2.8, .16, F, { att: .4 });
    }
  };
  // A game may register Sound.provider(text, opts, ctx): recorded human voice clips. It returns "robot" to fall through
  // to speech synthesis (only when the player switched that on); anything else means it handled the line.
  Sound.say = function (text, o) {
    if (this.muted || !SET.voice) return;
    if (this.provider) { try { this.ensure(); if (this.provider(text, o || {}, { ac: this.ac, out: this.fx, music: this.music, musicVol: SET.music * .5, fill: SET.fill || (SET.robot ? "robot" : "phrases") }) !== "robot") return; } catch (e) { return; } }
    if (!window.speechSynthesis) return;
    try { var u = new SpeechSynthesisUtterance(text); o = o || {}; u.rate = o.rate || 1.05; u.pitch = o.pitch || 1; u.volume = Math.min(1, SET.sfx);
      var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
      if (vs.length && o.voice) { var fem = /female|samantha|victoria|karen|zira|susan|serena|moira|tessa|fiona|veena|google uk english female|libby|sonia/i, pool = vs.filter(function (v) { return o.voice === "female" ? fem.test(v.name) : !fem.test(v.name); }); if (pool.length) u.voice = pool[(o.vi || 0) % pool.length]; }
      if (!o.queue) speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  };
  Sound.tone = function (f, d, type, vol) { if (this.muted || !this.ac) return; this.osc(type || "square", f, this.ac.currentTime, d, vol || .1, this.fx); };
  Sound.unlock = function () {
    if (this.muted) return; this.ensure(); if (!this.ac) return;
    if (this.ac.state === "suspended") { var T = this; this.ac.resume().then(function () { T.next = T.ac.currentTime + .05; T.loop(); }).catch(function () {}); }
    if (!this.unlocked) { this.unlocked = true;
      try { var el = document.createElement("audio"); el.setAttribute("x-webkit-airplay", "deny"); el.preload = "auto"; el.loop = true;
        el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; el.volume = 0.01; var pr = el.play(); if (pr && pr.catch) pr.catch(function () {}); this.silentEl = el; } catch (e) {}
      // a tiny silent buffer also wakes Web Audio on iOS
      try { var b = this.ac.createBuffer(1, 1, 22050), src = this.ac.createBufferSource(); src.buffer = b; src.connect(this.ac.destination); src.start(0); } catch (e) {}
    }
    if (!this.timer || this.next < this.ac.currentTime) { this.next = this.ac.currentTime + .05; this.loop(); }
  };
  // Character voices: a tiny formant synthesiser (glottal sawtooth through two vowel filters) for grunts and shouts.
  var VOWEL = { a: [750, 1200], o: [500, 900], u: [350, 800], e: [450, 1900], i: [300, 2300], ah: [700, 1100] };
  Sound.voice = function (v, kind) {
    if (this.muted || !this.ac || !v) return; var t = this.ac.currentTime, key = "v" + (v.id || "") + kind;
    if (t - (this.lastSfx[key] || 0) < .18) return; this.lastSfx[key] = t;
    var K = { jump: ["u", .13, 1.25, .5], kick: ["a", .16, 1.1, .8], shoot: ["ah", .34, 1.35, 1], hurt: ["o", .26, .8, .9], ko: ["u", .7, .6, .9], power: ["a", .45, 1.5, 1], win: ["e", .5, 1.4, .9], sad: ["o", .55, .7, .6], effort: ["ah", .2, 1.05, .6], laugh: ["a", .5, 1.3, .7] }[kind] || ["a", .15, 1, .6];
    var a = this.ac, f0 = v.f0 * (.94 + Math.random() * .12), dur = K[1], o = a.createOscillator(), g = a.createGain(), out = a.createGain(); out.gain.value = .9 * (v.gain || 1);
    o.type = "sawtooth"; o.frequency.setValueAtTime(f0 * (kind === "hurt" || kind === "ko" || kind === "sad" ? 1.3 : 1), t); o.frequency.exponentialRampToValueAtTime(f0 * K[2], t + dur);
    if (kind === "laugh") for (var k = 0; k < 5; k++) { o.frequency.setValueAtTime(f0 * 1.3, t + k * .1); o.frequency.exponentialRampToValueAtTime(f0 * .9, t + k * .1 + .08); }
    var fm = VOWEL[v.vowel && kind !== "hurt" ? v.vowel : K[0]] || VOWEL.a, sh = v.formant || 1;
    [fm[0] * sh, fm[1] * sh].forEach(function (fr, i) { var bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fr; bp.Q.value = i ? 9 : 6; o.connect(bp); bp.connect(g); });
    if (v.rasp) { var n = a.createBufferSource(), nf = a.createBiquadFilter(), ng = a.createGain(); n.buffer = this.noiseBuf; nf.type = "bandpass"; nf.frequency.value = 1400; ng.gain.value = .25 * v.rasp; n.connect(nf); nf.connect(ng); ng.connect(g); n.start(t, Math.random()); n.stop(t + dur + .05); }
    g.connect(out); out.connect(this.fx); this.env(g, t, .02, .55 * K[3], dur); o.start(t); o.stop(t + dur + .08);
  };
  Sound.setMuted = function (m) {
    this.muted = m; store("muted", m);
    if (!m) { this.ensure(); if (this.ac && this.ac.state === "suspended") this.ac.resume(); if (this.ac) { this.next = this.ac.currentTime + .05; this.loop(); } }
    else { clearTimeout(this.timer); try { speechSynthesis.cancel(); } catch (e) {} }
  };
  Sound.setVol = function (v) { this.vol = v; store("vol", v); if (this.master) this.master.gain.value = v; };
  Sound.applySet = function () { if (this.music) this.music.gain.value = SET.music * .5 * (SET.musicMul == null ? 1 : SET.musicMul); if (this.fx) this.fx.gain.value = SET.sfx; };

  /* ---------- Game host ---------- */
  function run(game) {
    var stage = document.querySelector("[data-gm-stage]"), cv = stage.querySelector("[data-gm-canvas]"), x = cv.getContext("2d");
    var ov = stage.querySelector("[data-gm-overlay]"), touch = stage.querySelector("[data-gm-touch]");
    var keys = {}, pressed = {}, tapAt = {}, doubled = {}, paused = false, last = 0, acc = 0, scale = 1, ox = 0, oy = 0;
    var actions = {}; (game.actions || []).forEach(function (a) { actions[a.id] = a; });
    function bound(id) { return (SET.keys[id] && SET.keys[id].length ? SET.keys[id] : actions[id].keys) || []; }
    function anyKey(list, map) { for (var i = 0; i < list.length; i++) { var id = list[i]; if (actions[id]) { var b = bound(id); for (var j = 0; j < b.length; j++) if (map[b[j]]) return true; if (map["@" + id]) return true; } else if (map[id]) return true; } return false; }
    var fxState = { slow: 1, slowT: 0, stop: 0, zoom: 0, zx: 480, zy: 270, flash: null, banners: [], confetti: [] };
    var api = { W: W, H: H, x: x, reduce: reduce, keys: keys, sound: Sound, cast: CAST, byId: byId, drawHead: drawHead, store: store, clamp: clamp, esc: esc, t: 0, settings: SET,
      down: function () { return anyKey(arguments, keys); },
      hit: function () { return anyKey(arguments, pressed); },
      double: function (id) { if (doubled[id]) { doubled[id] = false; return true; } return false; },
      shake: 0, parts: [],
      burst: function (px, py, col, n, sp) { n = SET.fx === "low" || reduce ? Math.min(4, n) : n; for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (sp || 200) * (.3 + Math.random()); api.parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .5 + Math.random() * .4, col: col }); } },
      kick: function (m) { if (!reduce && SET.shake) api.shake = Math.max(api.shake, m); },
      buzz: function (p) { if (SET.buzz && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} },
      confetti: function (n, px, py) { n = SET.fx === "low" || reduce ? Math.min(30, n || 120) : (n || 160); var cols = ["#f6c445", "#3dd68c", "#7ef0ff", "#ff6b9a", "#a78bfa", "#ffffff"];
        for (var i = 0; i < n; i++) fxState.confetti.push({ x: px == null ? Math.random() * 960 : px, y: py == null ? -20 - Math.random() * 200 : py, vx: (Math.random() - .5) * (px == null ? 120 : 700), vy: px == null ? 60 + Math.random() * 120 : -200 - Math.random() * 500, r: Math.random() * 6.28, vr: (Math.random() - .5) * 12, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, col: cols[i % cols.length], life: 3 + Math.random() * 2 }); },
      banner: function (text, o) { o = o || {}; var b = { text: text, t: 0, dur: o.dur || 2.2, col: o.col || "#ffd84a", edge: o.edge || "#8a4b00", sad: !!o.sad, size: o.size || 120, sub: o.sub || "", y: o.y || 230 }; b.img = bannerImage(b); fxState.banners.push(b); },
      slowmo: function (f, d) { if (reduce) return; fxState.slow = f; fxState.slowT = d; },
      hitstop: function (d) { fxState.stop = Math.max(fxState.stop, d); },
      flash: function (col, d) { if (!reduce && regGet("flashes") !== false) fxState.flash = { col: col, t: d, d: d }; },
      zoom: function (z, px, py) { if (reduce || !SET.shake) return; fxState.zoom = z; fxState.zx = px == null ? 480 : px; fxState.zy = py == null ? 270 : py; },
      show: function (html, on) { ov.innerHTML = '<div class="gm-dlg" role="dialog" aria-modal="true">' + html + "</div>"; ov.hidden = false; ov.onclick = function (e) { var b = e.target.closest("[data-act]"); if (b && on) { Sound.sfx("click"); on(b.getAttribute("data-act"), b); } }; var f = ov.querySelector(".gm-btn--go, button"); if (f) f.focus({ preventScroll: true }); },
      hide: function () { ov.hidden = true; ov.innerHTML = ""; cv.focus({ preventScroll: true }); },
      overlayOpen: function () { return !ov.hidden; },
      setTouch: function (spec) { // legacy: [[label, code, aria], ...] pads, or a list of action ids
        touchSpec = spec; drawTouch();
      },
      useActions: function (ids) { touchSpec = ids; drawTouch(); },
      music: function (sg) { if (typeof sg === "string") sg = SONGS[sg]; Sound.play(sg); },
      panel: function (concept, controls) { document.querySelector("[data-gm-concept]").innerHTML = concept; document.querySelector("[data-gm-controls]").innerHTML = controls + controlsTable(); },
      keyName: function (id) { var b = actions[id] ? bound(id) : [id]; return b.map(keyLabel).join(" / "); }
    };
    function keyLabel(c) { return { Space: "Space", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Enter: "Enter", ShiftLeft: "Shift", ShiftRight: "R-Shift", Slash: "/", Period: ".", Comma: ",", Semicolon: ";", Backspace: "⌫", Escape: "Esc" }[c] || c.replace(/^Key|^Digit/, ""); }
    function controlsTable() {
      var list = game.actions || []; if (!list.length) return "";
      return "<p class='gm-small'>Your current keys (change them in Settings):</p><table>" + list.filter(function (a) { return !a.hidden; }).map(function (a) { return "<tr><td>" + esc(a.label) + "</td><td>" + bound(a.id).map(function (k) { return "<kbd>" + esc(keyLabel(k)) + "</kbd>"; }).join(" ") + "</td></tr>"; }).join("") + "</table>";
    }
    /* touch controls: from actions (movable, resizable) or the legacy pad spec */
    var touchSpec = null;
    function drawTouch() {
      if (!touchSpec) { touch.innerHTML = ""; return; }
      if (typeof touchSpec[0] === "string") {
        touch.classList.add("gm-touch--free");
        touch.innerHTML = touchSpec.map(function (id) { var a = actions[id]; if (!a || !a.touch) return ""; var L = api.layout.get(id), p = L || SET.touch[id] || a.touch, sz = Math.round(62 * (p.s || 1) * SET.touchScale);
          return '<button type="button" class="gm-key" data-k="@' + id + '" data-id="' + id + '" data-lay="' + id + '" data-lay-label="' + esc(a.label) + '" aria-label="' + esc(a.label) + '" style="left:' + p.x + '%;top:' + p.y + '%;width:' + sz + 'px;height:' + sz + 'px;opacity:' + (L && L.a != null ? L.a : SET.touchAlpha) + (L && L.h ? ';display:none' : '') + '">' + esc(a.touch.label) + "</button>"; }).join("");
      } else {
        touch.classList.remove("gm-touch--free");
        touch.innerHTML = touchSpec.map(function (pad) { return '<div class="gm-pad">' + pad.map(function (k) { return '<button type="button" class="gm-key" data-k="' + k[1] + '" aria-label="' + esc(k[2] || k[0]) + '" style="opacity:' + SET.touchAlpha + '">' + k[0] + "</button>"; }).join("") + "</div>"; }).join("");
      }
    }
    function size() {
      var r = stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5) * Math.max(.5, Math.min(1, +regGet("res") || 1));
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
      scale = Math.min(cv.width / W, cv.height / H); ox = (cv.width - W * scale) / 2; oy = (cv.height - H * scale) / 2;
    }
    window.addEventListener("resize", size); window.addEventListener("orientationchange", function () { setTimeout(size, 200); }); size();
    var BLOCK = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 }, capture = null;
    function press(code) {
      if (!keys[code]) { pressed[code] = true; var now = performance.now();
        for (var id in actions) if (bound(id).indexOf(code) >= 0 || code === "@" + id) { if (now - (tapAt[id] || 0) < 260) doubled[id] = true; tapAt[id] = now; } }
      keys[code] = true;
    }
    document.addEventListener("keydown", function (e) {
      if (capture) { e.preventDefault(); capture(e.code); return; }
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.code === "KeyP" || e.code === "Escape") { if (!api.overlayOpen() || paused) togglePause(); return; }
      if (e.code === "KeyM" && !anyKeyBound("KeyM")) { mute.click(); return; }
      if (!api.overlayOpen() && (BLOCK[e.code] || anyKeyBound(e.code))) e.preventDefault();
      press(e.code);
    });
    function anyKeyBound(code) { for (var id in actions) if (bound(id).indexOf(code) >= 0) return true; return false; }
    document.addEventListener("keyup", function (e) { keys[e.code] = false; });
    window.addEventListener("blur", function () { for (var k in keys) keys[k] = false; });
    function tk(e, on) { if (editing) return; var b = e.target.closest(".gm-key"); if (!b) return; e.preventDefault(); var c = b.getAttribute("data-k"); if (on) press(c); else keys[c] = false; b.classList.toggle("is-down", on); if (on) api.buzz(8); }
    touch.addEventListener("pointerdown", function (e) { try { e.target.releasePointerCapture(e.pointerId); } catch (_) {} tk(e, true); });
    ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach(function (n) { touch.addEventListener(n, function (e) { tk(e, false); }); });
    if (matchMedia("(pointer: coarse)").matches) touch.classList.add("is-on");
    window.addEventListener("touchstart", function () { touch.classList.add("is-on"); }, { once: true, passive: true });
    cv.addEventListener("pointerdown", function (e) { if (game.click) { var r = cv.getBoundingClientRect(), d = cv.width / r.width; game.click(((e.clientX - r.left) * d - ox) / scale, ((e.clientY - r.top) * d - oy) / scale, api, e); } });

    /* settings: keys, touch layout, sound, feel */
    var editing = false;
    function settings() { if (window.ArcadeSettings && api.settingsUI) return api.settingsUI.open(); legacySettings(); }
    function legacySettings() {
      var wasPaused = paused; paused = true;
      var rows = (game.actions || []).filter(function (a) { return !a.hidden; }).map(function (a) { return "<tr><td>" + esc(a.label) + "</td><td><b data-kb='" + a.id + "'>" + esc(bound(a.id).map(keyLabel).join(" / ")) + "</b></td><td><button class='gm-btn gm-btn--sm' data-act='bind' data-id='" + a.id + "'>Change</button></td></tr>"; }).join("");
      api.show("<h2>Settings</h2><div class='gm-set'>" +
        (rows ? "<section><h3>Keyboard</h3><table class='gm-bind'>" + rows + "</table><p class='gm-small'>Press Change, then the key you want. Taken keys swap over.</p></section>" : "") +
        "<section><h3>Phone buttons</h3><label>Size <input type='range' min='70' max='150' value='" + Math.round(SET.touchScale * 100) + "' data-set='touchScale'></label><label>See-through <input type='range' min='30' max='100' value='" + Math.round(SET.touchAlpha * 100) + "' data-set='touchAlpha'></label>" +
        (typeof (touchSpec || [])[0] === "string" ? "<button class='gm-btn gm-btn--sm' data-act='layout'>Move buttons</button>" : "") + "</section>" +
        "<section><h3>Sound</h3><label>Music <input type='range' min='0' max='100' value='" + Math.round(SET.music * 100) + "' data-set='music'></label><label>Effects <input type='range' min='0' max='100' value='" + Math.round(SET.sfx * 100) + "' data-set='sfx'></label>" +
        "<label class='gm-check'><input type='checkbox' data-set='voice'" + (SET.voice ? " checked" : "") + "> " + (Sound.provider ? "Voices" : "Announcer voice") + "</label>" + (Sound.provider ? (function (f) { return "<label>Fill unrecorded lines with <select data-set='fill' style='font:inherit'>" + [["phrases", "phrases"], ["murmur", "murmur"], ["robot", "robot voice"]].map(function (o) { return "<option value='" + o[0] + "'" + (f === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>"; })(SET.fill || (SET.robot ? "robot" : "phrases")) : "") + "</section>" +
        "<section><h3>Feel</h3><label class='gm-check'><input type='checkbox' data-set='buzz'" + (SET.buzz ? " checked" : "") + "> Vibration (phones)</label><label class='gm-check'><input type='checkbox' data-set='shake'" + (SET.shake ? " checked" : "") + "> Screen shake and zoom</label>" +
        "<label class='gm-check'><input type='checkbox' data-set='fxlow'" + (SET.fx === "low" ? " checked" : "") + "> Fewer effects (older phones)</label></section>" +
        (api.cheatIds && api.cheatIds().length ? "<section><h3>Code</h3><p class='gm-small'>Type a code here on a phone (on a keyboard, just type it while playing).</p><input type='text' data-code autocomplete='off' autocapitalize='off' spellcheck='false' aria-label='Code' style='font:inherit;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;width:150px'> <button class='gm-btn gm-btn--sm' data-act='code'>Enter</button> <span data-code-msg class='gm-small'></span></section>" : "") + "</div>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='done'>Done</button><button class='gm-btn' data-act='reset'>Reset to defaults</button></div>",
        function (act, el) {
          if (act === "done") { api.hide(); paused = wasPaused; drawTouch(); if (!paused) { last = 0; Sound.loop(); } }
          else if (act === "reset") { SET.keys = {}; SET.touch = {}; SET.touchScale = 1; SET.touchAlpha = .85; saveSet(); settings(); }
          else if (act === "code") { var ci = ov.querySelector("[data-code]"), cm = ov.querySelector("[data-code-msg]"), okc = api.enterCode(ci.value); cm.textContent = okc ? "Code accepted." : "Not a code."; ci.value = ""; }
          else if (act === "layout") { api.hide(); layoutEditor(function () { settings(); }); }
          else if (act === "bind") { var id = el.getAttribute("data-id"), lab = ov.querySelector("[data-kb='" + id + "']"); lab.textContent = "Press a key…";
            capture = function (code) { capture = null; if (code === "Escape") { settings(); return; }
              for (var o in actions) if (o !== id && bound(o).indexOf(code) >= 0) { var mine = bound(id); SET.keys[o] = bound(o).map(function (k) { return k === code ? mine[0] : k; }); }
              SET.keys[id] = [code]; saveSet(); settings(); }; }
        });
      [].forEach.call(ov.querySelectorAll("[data-set]"), function (inp) { inp.addEventListener("input", function () { var k = inp.getAttribute("data-set");
        if (k === "fxlow") SET.fx = inp.checked ? "low" : "high"; else if (inp.tagName === "SELECT") SET[k] = inp.value; else if (inp.type === "checkbox") SET[k] = inp.checked; else SET[k] = inp.value / 100;
        saveSet(); Sound.applySet(); drawTouch(); }); });
    }
    function layoutEditor(done) {
      editing = true; touch.classList.add("is-on", "is-editing"); var bar = document.createElement("div"); bar.className = "gm-edit-bar";
      bar.innerHTML = "<span>Drag the buttons where your thumbs like them.</span><button class='gm-btn gm-btn--sm' data-e='reset'>Reset</button><button class='gm-btn gm-btn--go gm-btn--sm' data-e='done'>Save layout</button>"; stage.appendChild(bar);
      var drag = null;
      function mv(e) { if (!drag) return; var r = stage.getBoundingClientRect(), px = clamp((e.clientX - r.left) / r.width * 100, 2, 92), py = clamp((e.clientY - r.top) / r.height * 100, 4, 90);
        drag.style.left = px + "%"; drag.style.top = py + "%"; var id = drag.getAttribute("data-id"), a = actions[id]; SET.touch[id] = { x: Math.round(px), y: Math.round(py), s: (SET.touch[id] || a.touch).s || 1 }; }
      function dn(e) { var b = e.target.closest(".gm-key"); if (!b) return; drag = b; e.preventDefault(); }
      function up() { drag = null; }
      touch.addEventListener("pointerdown", dn); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
      bar.addEventListener("click", function (e) { var b = e.target.closest("[data-e]"); if (!b) return;
        if (b.getAttribute("data-e") === "reset") { SET.touch = {}; drawTouch(); return; }
        saveSet(); editing = false; touch.classList.remove("is-editing"); bar.remove(); touch.removeEventListener("pointerdown", dn); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); done(); });
    }
    var fullBtn = document.querySelector("[data-gm-full]");
    if (fullBtn) fullBtn.addEventListener("click", function () { try { if (document.fullscreenElement) document.exitFullscreen(); else (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage); if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); } catch (e) {} setTimeout(size, 300); });
    var setBtn = document.querySelector("[data-gm-settings]"); if (setBtn) setBtn.addEventListener("click", function () { if (!editing) settings(); });
    api.openSettings = settings;
    var skipFrame = false, LAYP = []; // phone-control layout providers (docs/ARCADE_SETTINGS.md)
    function orient() { var r = stage.getBoundingClientRect(); return r.width >= r.height ? "land" : "port"; }
    api.layout = { orient: orient,
      get: function (id) { var m = SET.layout[orient()]; return m && m[id] ? m[id] : null; },
      register: function (p) { if (p && LAYP.indexOf(p) < 0) LAYP.push(p); },
      providers: function () { return LAYP.slice(); },
      refresh: function () { drawTouch(); LAYP.forEach(function (p) { try { if (p.refresh) p.refresh(); } catch (e) {} }); } };

    var pauseBtn = document.querySelector("[data-gm-pause]"), mute = document.querySelector("[data-gm-mute]"), vol = document.querySelector("[data-gm-vol]");
    function togglePause(force) {
      paused = force === undefined ? !paused : force;
      pauseBtn.setAttribute("aria-pressed", paused); pauseBtn.querySelector("span").textContent = paused ? "Resume" : "Pause";
      if (paused) { clearTimeout(Sound.timer); if (!api.overlayOpen()) { api.show("<h2>Paused</h2><p>Take a breath. Press P or Resume to carry on.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='resume'>Resume</button><button class='gm-btn' data-act='settings'>Settings</button>" + (game.saves ? "<button class='gm-btn' data-act='saves'>Saves</button>" : "") + (game.menu ? "<button class='gm-btn' data-act='quit'>Quit to menu</button>" : "") + "</div>", function (a) { if (a === "settings") { api._pauseDlg = false; settings(); return; } if (a === "quit") { api._pauseDlg = false; paused = false; pauseBtn.querySelector("span").textContent = "Pause"; game.menu(api); return; } if (a === "saves" && game.saves) { api._pauseDlg = false; paused = false; pauseBtn.setAttribute("aria-pressed", false); pauseBtn.querySelector("span").textContent = "Pause"; game.saves(api); return; } togglePause(false); }); api._pauseDlg = true; } }
      else { if (api._pauseDlg) { api.hide(); api._pauseDlg = false; } Sound.loop(); last = 0; }
    }
    pauseBtn.addEventListener("click", function () { togglePause(); });
    function paintMute() { mute.setAttribute("aria-pressed", Sound.muted); mute.querySelector("span").textContent = Sound.muted ? "Muted (tap for sound)" : "Sound on"; }
    mute.addEventListener("click", function () { Sound.setMuted(!Sound.muted); paintMute(); if (!Sound.muted) { Sound.unlock(); Sound.song = null; Sound.play(api._song || game.song); Sound.sfx("click"); } });
    if (vol) { vol.value = Math.round(Sound.vol * 100); vol.addEventListener("input", function () { Sound.setVol(vol.value / 100); }); }
    paintMute();
    var origMusic = api.music; api.music = function (sg) { if (typeof sg === "string") sg = SONGS[sg]; api._song = sg; origMusic(sg); };
    document.addEventListener("visibilitychange", function () { if (document.hidden && !paused && !api.overlayOpen()) togglePause(true); });
    ["pointerdown", "keydown", "touchend"].forEach(function (ev) { document.addEventListener(ev, function () { Sound.unlock(); }, { passive: true }); });

    function frame(now) {
      requestAnimationFrame(frame);
      var dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
      if (regGet("fps30")) { skipFrame = !skipFrame; if (skipFrame) { last = now - dt * 1000; return; } }
      if (!paused) tick(game.fixedSpeed ? dt : dt * (+regGet("speed") || 1));
      paint();
    }
    function tick(dt) {
      var real = dt;
      if (fxState.stop > 0) { fxState.stop -= dt; dt = 0; }
      if (fxState.slowT > 0) { fxState.slowT -= real; dt *= fxState.slow; } else fxState.slow = 1;
      acc += dt;
      while (acc >= STEP) { game.update(STEP, api); api.t += STEP; for (var k in pressed) pressed[k] = false; for (var d in doubled) doubled[d] = false; acc -= STEP; }
      for (var i = api.parts.length - 1; i >= 0; i--) { var p = api.parts[i]; p.life -= real; p.x += p.vx * real; p.y += p.vy * real; p.vy += 500 * real; if (p.life <= 0) api.parts.splice(i, 1); }
      for (var c = fxState.confetti.length - 1; c >= 0; c--) { var q = fxState.confetti[c]; q.life -= real; q.vy += 260 * real; q.vx *= .99; q.vy = Math.min(q.vy, 160); q.x += (q.vx + Math.sin(q.life * 4 + c) * 40) * real; q.y += q.vy * real; q.r += q.vr * real; if (q.life <= 0 || q.y > 600) fxState.confetti.splice(c, 1); }
      fxState.banners.forEach(function (b) { b.t += real; }); fxState.banners = fxState.banners.filter(function (b) { return b.t < b.dur; });
      if (fxState.flash) { fxState.flash.t -= real; if (fxState.flash.t <= 0) fxState.flash = null; }
      fxState.zoom *= Math.pow(.02, real);
      api.shake = Math.max(0, api.shake - real * 30);
      if (cer) cerTick(real);
    }
    function paint() {
      x.setTransform(1, 0, 0, 1, 0, 0); if (game.bleed) x.clearRect(0, 0, cv.width, cv.height); else { x.fillStyle = "#050c12"; x.fillRect(0, 0, cv.width, cv.height); } // bleed: a game with its own layer underneath shows it edge to edge
      var sx = api.shake ? (Math.random() - .5) * api.shake * scale : 0, sy = api.shake ? (Math.random() - .5) * api.shake * scale : 0, z = 1 + fxState.zoom;
      x.setTransform(scale * z, 0, 0, scale * z, ox + sx + (1 - z) * fxState.zx * scale, oy + sy + (1 - z) * fxState.zy * scale);
      x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
      game.draw(api);
      api.parts.forEach(function (p) { x.globalAlpha = Math.max(0, p.life * 1.6); x.fillStyle = p.col; x.fillRect(p.x - 2, p.y - 2, 4, 4); });
      x.globalAlpha = 1; x.restore();
      x.setTransform(scale, 0, 0, scale, ox, oy);
      if (cer) cerDraw();
      fxState.confetti.forEach(function (q) { x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.globalAlpha = Math.min(1, q.life); x.fillStyle = q.col; x.fillRect(-q.w / 2, -q.h / 2 * Math.abs(Math.cos(q.r * 2)), q.w, q.h * Math.abs(Math.cos(q.r * 2)) + .5); x.restore(); });
      x.globalAlpha = 1;
      if (fxState.flash) { x.globalAlpha = fxState.flash.t / fxState.flash.d * .6; x.fillStyle = fxState.flash.col; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
      fxState.banners.forEach(drawBanner);
    }
    function bannerImage(b) {
      var c = document.createElement("canvas"), cx = c.getContext("2d"), f = "900 " + b.size + "px system-ui, 'Arial Black', sans-serif";
      cx.font = f; var w = Math.ceil(cx.measureText(b.text).width) + 60, h = Math.ceil(b.size * (b.sub ? 1.75 : 1.3)) + 20;
      c.width = w; c.height = h; cx.font = f; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.lineJoin = "round";
      var X = w / 2, Y = b.size * .62 + 6;
      for (var d = 10; d > 0; d--) { cx.fillStyle = b.edge; cx.fillText(b.text, X + d * .8, Y + d); }
      cx.lineWidth = 10; cx.strokeStyle = "rgba(0,0,0,.55)"; cx.strokeText(b.text, X, Y);
      var g = cx.createLinearGradient(0, Y - b.size / 2, 0, Y + b.size / 2); g.addColorStop(0, "#fff"); g.addColorStop(.45, b.col); g.addColorStop(1, b.edge); cx.fillStyle = g; cx.fillText(b.text, X, Y);
      if (b.sub) { cx.font = "800 26px system-ui, sans-serif"; cx.lineWidth = 6; cx.strokeText(b.sub, X, Y + b.size * .62); cx.fillStyle = "#fff"; cx.fillText(b.sub, X, Y + b.size * .62); }
      return { c: c, w: w, h: h, oy: Y };
    }
    function drawBanner(b) {
      var inT = Math.min(1, b.t / .35), outT = Math.max(0, (b.t - (b.dur - .35)) / .35), s;
      s = reduce ? 1 : inT < 1 ? 1.6 - .6 * (1 - Math.pow(1 - inT, 3)) + Math.sin(inT * Math.PI) * .15 : 1 + Math.sin(b.t * 9) * .03;
      if (b.sad && !reduce) s *= 1 - .05 * Math.sin(b.t * 3);
      x.save(); x.translate(480, b.y + (b.sad ? Math.min(30, b.t * 20) : 0)); x.scale(s, s); x.rotate(reduce ? 0 : b.sad ? .04 : Math.sin(b.t * 5) * .03);
      x.globalAlpha = 1 - outT; x.drawImage(b.img.c, -b.img.w / 2, -b.img.oy); x.restore(); x.globalAlpha = 1;
    }
    /* ---------- Ceremony kit: one staged, skippable moment for every ending (win, lose, draw, champion, eliminated,
       newRecord, stageClear, gameComplete). api.ceremony(kind, opts) plays on the canvas, then hands over to the game's
       own result dialog (opts.then) or builds one from opts.buttons. Everything it starts is removed when the dialog closes.
       opts: title, sub, line (a kind, specific sentence), tip, colors [..], score, scoreLabel, stars (0-3), stats [[label, value]..],
       trophy "cup"|"medal"|"star"|"crown"|"none", hero / rival (cast objects), len (s), draw(x, t, c) custom scene,
       then() or buttons [{ id, label, go }] + on(id). ---------- */
    var cer = null, CER = {
      win: { title: "YOU WIN!", col: "#ffd84a", edge: "#8a4b00", mood: 1, trophy: "medal", len: 3.4, fire: .5 },
      champion: { title: "CHAMPIONS!", col: "#ffe07a", edge: "#8a4b00", mood: 1, trophy: "cup", len: 6, fire: 1 },
      gameComplete: { title: "COMPLETE!", col: "#ffe07a", edge: "#7a3d00", mood: 1, trophy: "crown", len: 6, fire: 1 },
      stageClear: { title: "CLEARED!", col: "#7ef0c0", edge: "#0b5a3c", mood: 1, trophy: "star", len: 2.8, fire: .25 },
      newRecord: { title: "NEW RECORD!", col: "#7ef0ff", edge: "#0b4a6a", mood: 1, trophy: "star", len: 3, fire: .4 },
      draw: { title: "DRAW", col: "#dbeafe", edge: "#334155", mood: 0, trophy: "none", len: 2.6, fire: 0 },
      lose: { title: "NOT THIS TIME", col: "#b6c6d8", edge: "#1c2a3a", mood: -1, trophy: "none", len: 3.4, fire: 0 },
      eliminated: { title: "KNOCKED OUT", col: "#b6c6d8", edge: "#1c2a3a", mood: -1, trophy: "none", len: 4.4, fire: 0 }
    };
    function cerEase(v) { v = clamp(v, 0, 1); return 1 - Math.pow(1 - v, 3); }
    function cerBack(v) { v = clamp(v, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); }
    function cerNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
    api.ceremony = function (kind, o) {
      var K = CER[kind] || CER.win; o = o || {}; if (cer) cerEnd(true);
      var lite = reduce || SET.fx === "low", cols = o.colors && o.colors.length ? o.colors : (K.mood > 0 ? ["#f6c445", "#3dd68c", "#7ef0ff", "#ff6b9a", "#a78bfa", "#ffffff"] : ["#8fa3b8"]);
      cer = { kind: kind, K: K, o: o, t: 0, len: (o.len || K.len) * (reduce ? .45 : 1), lite: lite, cols: cols, sparks: [], rain: [], rays: Math.random() * 6, shown: false, armed: false, fireT: .5, tickT: 0, stars: 0,
        trophy: o.trophy || K.trophy, img: bannerImage({ text: o.title || K.title, size: (o.title || K.title).length > 13 ? 62 : (o.title || K.title).length > 9 ? 78 : 96, col: o.col || K.col, edge: o.edge || K.edge, sub: o.sub || "" }) };
      if (!o.quiet) { Sound.fanfare(kind); }
      if (K.mood > 0) { api.hitstop(.1); api.slowmo(.35, .5); api.flash("#fff", .3); api.kick(8); api.buzz(kind === "champion" || kind === "gameComplete" ? [40, 40, 40, 40, 160] : [30, 40, 90]);
        cerConfetti(kind === "champion" || kind === "gameComplete" ? 220 : 120); }
      else if (K.mood < 0) { api.slowmo(.5, .6); api.flash("#0a1220", .5); api.buzz(160);
        if (!lite) for (var i = 0; i < 70; i++) cer.rain.push({ x: Math.random() * 1100 - 60, y: Math.random() * 540, v: 420 + Math.random() * 260, l: 10 + Math.random() * 14 }); }
      else { api.flash("#dbeafe", .25); }
      stage.classList.add("gm-cer-on");
      return cer;
    };
    var cerShow = api.show; api.show = function (html, on) { if (cer && !cer.revealing && !cer.shown) cerEnd(); cerShow(html, on); }; // any other dialog (pause, menu) cancels a ceremony that has not handed over yet
    /* ---------- Cheats, secret reveal and the maker's hidden character. Codes never ship in plain text: the page config
       (data-gm-config) and each game's defaults hold SHA-256 hashes of slug + ":" + code. ---------- */
    var CFG = {}; try { CFG = JSON.parse(stage.getAttribute("data-gm-config") || "{}") || {}; } catch (e) { CFG = {}; }
    var SESSION = window.__gmSession = { cheated: false, boards: !!CFG.cheatsOnBoards, hero: false };
    api.config = CFG; api.cheated = false;
    var cheatMap = {}, cheatHash = {}, typed = "";
    function codeNorm(s) { return String(s == null ? "" : s).toLowerCase().replace(/\s+/g, ""); }
    function cheatRun(id) { var c = cheatMap[id]; if (!c) return false; api.cheated = true; SESSION.cheated = true; try { c.run(api); } catch (e) { return false; } toast("<b>Cheat on:</b> " + esc(c.label || id)); Sound.sfx("power"); return true; }
    function cheatTry(n) { if (!n) return false; var id = cheatHash[sha256(SLUG + ":" + n)]; return id ? cheatRun(id) : false; }
    api.cheats = function (map) { // { id: { label, run(api), h: [hash, ...] } }; config hashes win over the game's own defaults
      cheatMap = map || {}; cheatHash = {}; var id;
      if (CFG.cheats && CFG.cheats.length) CFG.cheats.forEach(function (c) { if (!cheatMap[c.id]) return; [c.typed, c.dial].forEach(function (h) { if (h) cheatHash[h] = c.id; }); });
      else for (id in cheatMap) [].concat(cheatMap[id].h || []).forEach(function (h) { if (h) cheatHash[h] = id; });
      return api;
    };
    api.enterCode = function (raw) { return cheatTry(codeNorm(raw)); };
    api.cheatIds = function () { return Object.keys(cheatMap); };
    function cheatFeed(ch) { typed = (typed + ch).slice(-24); for (var n = 4; n <= typed.length; n++) if (cheatTry(typed.slice(-n))) { typed = ""; return; } }
    // secret reveal: a key sequence on PC or a swipe pattern on touch, checked only while a menu is open
    var secret = null, seqK = "", seqS = "", sw = null;
    function seqTok(v) { return String(v).toLowerCase().split(/[\s,]+/).map(function (w) { return { up: "u", down: "d", left: "l", right: "r" }[w] || (w.length === 1 ? w : ""); }).join(""); }
    function seqHash(kind, v) { return /^[0-9a-f]{64}$/.test(v || "") ? v : v ? sha256(SLUG + ":" + kind + ":" + seqTok(v)) : ""; }
    function seqTry(kind, buf) { if (!secret || !secret[kind] || api.hero.revealed) return; for (var n = 4; n <= buf.length; n++) if (sha256(SLUG + ":" + kind + ":" + buf.slice(-n)) === secret[kind]) return heroReveal(); }
    api.hero = { active: false, revealed: false, inUse: false, c: HERO, enabled: !(CFG.hero && CFG.hero.enabled === false),
      verify: function (code) {
        if (!api.hero.enabled) return Promise.resolve(false);
        var call = window.Arcade && window.Arcade.apiCall; if (!call) return Promise.resolve(false);
        return call("hero/", { slug: SLUG, code: String(code || "") }).then(function (r) { var ok = !!(r && r.ok === true); if (ok) { api.hero.active = true; SESSION.hero = true; store("hero-ok", true); } return ok; }).catch(function (e) { api.hero.offline = !navigator.onLine || (e && e.name === "TypeError"); return false; });
      },
      use: function (on) { api.hero.inUse = !!(on && api.hero.active); if (api.hero.inUse) { api.cheated = true; SESSION.cheated = true; }
        var b = stage.querySelector(".gm-hero-skip"); if (api.hero.inUse && !b) { b = document.createElement("button"); b.type = "button"; b.className = "gm-hero-skip"; b.textContent = "MIB ⏭"; b.title = "Maker: skip to the end (backquote key)"; b.addEventListener("click", function () { if (!api.overlayOpen()) cheatRun("skip"); }); stage.appendChild(b); } else if (!api.hero.inUse && b) b.remove();
        return api.hero.inUse; } };
    api.secret = function (o) { o = o || {}; var h = CFG.hero || {}; secret = { combo: seqHash("combo", h.combo || o.combo), swipe: seqHash("swipe", h.swipe || o.swipe), onReveal: o.onReveal }; return api; };
    function heroReveal() {
      if (!api.hero.enabled) return; api.hero.revealed = true; Sound.sfx("power"); api.flash("#f6c445", .4);
      var done = function (ok) { if (secret && secret.onReveal) secret.onReveal(ok); };
      api.show("<h2>A hidden player steps out</h2><p><b>M.I. BUGAJE</b>, the maker of this arcade. Enter the maker's code to play as him.</p><p><input type='password' data-hero-code autocomplete='off' autocapitalize='off' spellcheck='false' aria-label='Maker code' style='font:inherit;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;width:min(260px,80%);text-align:center'></p><p data-hero-msg class='gm-small'></p>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Unlock</button><button class='gm-btn' data-act='no'>Not now</button></div>", function (act) {
          if (act !== "ok") { api.hero.revealed = false; return done(false); }
          var inp = ov.querySelector("[data-hero-code]"), msg = ov.querySelector("[data-hero-msg]"); if (msg) msg.textContent = "Checking…";
          api.hero.verify(inp ? inp.value : "").then(function (ok) { if (ok) { toast("<b>M.I. BUGAJE unlocked</b> on this device."); Sound.fanfare("newRecord"); done(true); } else if (ov.querySelector("[data-hero-msg]")) { ov.querySelector("[data-hero-msg]").textContent = "That code was not accepted."; if (inp) inp.value = ""; if (api.hero.offline) ov.querySelector("[data-hero-msg]").textContent = "Checking the code needs internet once. After that he works offline on this device."; } });
        });
    }
    if (api.hero.enabled && store("hero-ok") === true) { // remembered on this device, but re-checked with the server before it counts
      var callH = window.Arcade && window.Arcade.apiCall; if (callH) callH("hero/", { slug: SLUG, check: true }).then(function (r) { if (r && r.ok === true) { api.hero.active = true; SESSION.hero = true; } else store("hero-ok", false); }).catch(function (e) { if (!navigator.onLine || (e && e.name === "TypeError")) { api.hero.active = true; SESSION.hero = true; } }); // no network: keep what this device already verified
    }
    document.addEventListener("keydown", function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest("input, textarea, select"))) return;
      var k = e.key || "";
      if (e.code === "Backquote" && api.hero.inUse && !api.overlayOpen()) { cheatRun("skip"); return; }
      if (!api.overlayOpen() && k.length === 1 && /[a-z0-9*#]/i.test(k)) cheatFeed(k.toLowerCase());
      if (api.overlayOpen() && secret) { var tk = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" }[e.code] || (k.length === 1 ? k.toLowerCase() : ""); if (tk) { seqK = (seqK + tk).slice(-16); seqTry("combo", seqK); } }
    });
    stage.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" && api.overlayOpen()) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; }, true);
    window.addEventListener("pointerup", function (e) { if (!sw || e.pointerId !== sw.id) return; var dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 44 || !secret) return;
      seqS = (seqS + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"))).slice(-16); seqTry("swipe", seqS); }, true);
    api.ceremonyActive = function () { return !!cer; };
    api.trophy = function (kind, px, py, s, t) { cerTrophy(kind, px, py, s == null ? 1 : s, t == null ? api.t : t); };
    api.ceremonyEnd = function () { cerEnd(); };
    function cerConfetti(n) {
      api.confetti(n); var c = cer.cols, from = Math.max(0, fxState.confetti.length - (cer.lite ? 30 : n));
      for (var i = from; i < fxState.confetti.length; i++) fxState.confetti[i].col = c[i % c.length];
      if (!cer.lite) for (var s = 0; s < 14; s++) fxState.confetti.push({ x: Math.random() * 960, y: -30 - Math.random() * 260, vx: (Math.random() - .5) * 60, vy: 70 + Math.random() * 60, r: Math.random() * 6.28, vr: (Math.random() - .5) * 5, w: 26 + Math.random() * 22, h: 4, col: c[s % c.length], life: 5 + Math.random() * 2 });
    }
    function cerFirework() {
      var px = 120 + Math.random() * 720, py = 70 + Math.random() * 190, col = cer.cols[(Math.random() * cer.cols.length) | 0], n = cer.lite ? 10 : 34;
      for (var i = 0; i < n; i++) { var a = i / n * 6.283 + Math.random() * .2, v = 110 + Math.random() * 130; cer.sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .9 + Math.random() * .6, col: i % 5 ? col : "#ffffff" }); }
      if (!Sound.muted && Sound.ac) { Sound.noise(Sound.ac.currentTime, .25, .1, Sound.fx, "bandpass", 900 + Math.random() * 900, .8); }
    }
    function cerEnd(keep) {
      if (!cer) return; cer = null; fxState.confetti.length = 0; fxState.slow = 1; fxState.slowT = 0; stage.classList.remove("gm-cer-on"); ov.classList.remove("gm-overlay--cer");
      if (!keep) { var d = ov.querySelector("[data-cer]"); if (d) d.removeAttribute("data-cer"); }
    }
    function cerCard() { // the summary block placed at the top of whatever dialog follows
      var c = cer, o = c.o, h = "<div class='gm-cer gm-cer--" + (c.K.mood > 0 ? "up" : c.K.mood < 0 ? "down" : "flat") + "'>";
      if (o.stars != null) h += "<div class='gm-cer__stars' aria-label='" + o.stars + " of 3 stars'>" + [0, 1, 2].map(function (i) { return "<i class='" + (i < o.stars ? "is-on" : "") + "' style='animation-delay:" + (i * .16) + "s'>★</i>"; }).join("") + "</div>";
      if (o.score != null) h += "<div class='gm-cer__score'><small>" + esc(o.scoreLabel || "Score") + "</small><b data-cer-score>" + cerNum(o.score) + "</b></div>";
      if (o.line) h += "<p class='gm-cer__line'>" + esc(o.line) + "</p>";
      if (o.stats && o.stats.length) h += "<dl class='gm-cer__stats'>" + o.stats.map(function (s) { return "<div><dt>" + esc(String(s[0])) + "</dt><dd>" + esc(String(s[1])) + "</dd></div>"; }).join("") + "</dl>";
      if (o.tip && c.K.mood <= 0) h += "<p class='gm-cer__tip'><b>" + (c.K.mood < 0 ? "Next time" : "Tip") + ":</b> " + esc(o.tip) + "</p>";
      return h + "</div>";
    }
    function cerReveal() {
      var c = cer, o = c.o; c.shown = true; c.shownT = c.t; c.revealing = true;
      if (o.then) { try { o.then(); } catch (e) { cerEnd(); throw e; } }
      else { var bs = o.buttons || [{ id: "ok", label: "Continue", go: true }];
        api.show("<h2>" + esc(o.title || c.K.title) + "</h2><div class='gm-actions'>" + bs.map(function (b) { return "<button class='gm-btn" + (b.go ? " gm-btn--go" : "") + "' data-act='" + esc(b.id) + "'>" + esc(b.label) + "</button>"; }).join("") + "</div>",
          function (act) { var on = o.on; if (cer === c) { api.hide(); cerEnd(); } if (on) on(act); }); }
      c.revealing = false; if (cer !== c) return;
      var d = ov.hidden ? null : ov.querySelector(".gm-dlg");
      if (!d) { cerEnd(); return; }
      d.setAttribute("data-cer", c.kind); ov.classList.add("gm-overlay--cer");
      var h2 = d.querySelector("h2"), wrap = document.createElement("div"); wrap.innerHTML = cerCard(); var card = wrap.firstChild;
      if (card && card.childNodes.length) { if (h2 && h2.nextSibling) d.insertBefore(card, h2.nextSibling); else d.insertBefore(card, d.firstChild ? d.firstChild.nextSibling : null); }
      var big = d.querySelector(".gm-btn--go"); if (big && c.K.mood < 0) big.classList.add("gm-btn--retry");
    }
    function cerSkip(e) { if (cer && !cer.shown && cer.t > 1) { cer.t = cer.len; if (e && e.preventDefault && e.type === "keydown" && (e.code === "Space" || e.code === "Enter")) e.preventDefault(); } }
    stage.addEventListener("pointerdown", cerSkip); document.addEventListener("keydown", function (e) { if (!e.repeat) cerSkip(e); });
    function cerTick(dt) {
      var c = cer, K = c.K, i; c.t += dt; c.rays += dt * .5;
      if (K.fire && c.t > .5) { c.fireT -= dt; if (c.fireT <= 0 && (!c.shown || c.t - c.shownT < 6)) { cerFirework(); c.fireT = (c.lite ? 1.4 : .55) / K.fire * (.6 + Math.random() * .8); if (K.fire >= 1 && Math.random() < .3) cerConfetti(40); } }
      for (i = c.sparks.length - 1; i >= 0; i--) { var s = c.sparks[i]; s.life -= dt; s.vx *= Math.pow(.25, dt); s.vy = s.vy * Math.pow(.25, dt) + 90 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0) c.sparks.splice(i, 1); }
      for (i = 0; i < c.rain.length; i++) { var r = c.rain[i]; r.y += r.v * dt; r.x -= r.v * .18 * dt; if (r.y > 560) { r.y = -20; r.x = Math.random() * 1100 - 20; } }
      var o = c.o;
      if (o.score != null && c.t > 1.5 && c.t < 2.7 && !c.shown) { c.tickT -= dt; if (c.tickT <= 0) { c.tickT = .07; Sound.tone(700 + (c.t - 1.5) * 500, .03, "square", .04); } }
      if (o.stars) { var want = Math.min(o.stars, Math.floor((c.t - 1.7) / .32) + 1); if (c.t > 1.7 && want > c.stars && !c.shown) { c.stars = want; Sound.sfx("coin"); api.kick(3); } }
      if (!c.shown && c.t >= c.len) cerReveal();
      else if (c.shown && c.t - c.shownT > .15 && (ov.hidden || !ov.querySelector("[data-cer]"))) cerEnd();
    }
    function cerTrophy(kind, px, py, s, t) {
      var g = x.createLinearGradient(-40, -60, 40, 40); g.addColorStop(0, "#fff6c2"); g.addColorStop(.45, "#f6c445"); g.addColorStop(1, "#a86a10");
      x.save(); x.translate(px, py); x.scale(s, s); x.lineJoin = "round"; x.lineWidth = 4; x.strokeStyle = "#5a3606"; x.fillStyle = g;
      if (kind === "cup") {
        x.lineWidth = 7; x.strokeStyle = "#c98a1a"; x.beginPath(); x.arc(-44, -30, 20, 1.2, 4.9); x.stroke(); x.beginPath(); x.arc(44, -30, 20, -1.75, 1.95); x.stroke();
        x.lineWidth = 4; x.strokeStyle = "#5a3606"; x.beginPath(); x.moveTo(-42, -62); x.lineTo(42, -62); x.quadraticCurveTo(40, 6, 9, 14); x.lineTo(9, 34); x.lineTo(28, 40); x.lineTo(28, 54); x.lineTo(-28, 54); x.lineTo(-28, 40); x.lineTo(-9, 34); x.lineTo(-9, 14); x.quadraticCurveTo(-40, 6, -42, -62); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = "#5a3606"; x.fillRect(-34, 54, 68, 12); x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(-22, -34, 6, 20, .15, 0, 7); x.fill();
        x.fillStyle = "#8a4b00"; x.font = "900 26px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("1", 0, -18);
      } else if (kind === "medal") {
        x.fillStyle = (cer && cer.cols[1]) || "#3dd68c"; x.beginPath(); x.moveTo(-30, -78); x.lineTo(-8, -78); x.lineTo(8, -22); x.lineTo(-12, -14); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = (cer && cer.cols[2]) || "#7ef0ff"; x.beginPath(); x.moveTo(30, -78); x.lineTo(8, -78); x.lineTo(-8, -22); x.lineTo(12, -14); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = g; x.beginPath(); x.arc(0, 14, 40, 0, 7); x.fill(); x.stroke(); x.strokeStyle = "rgba(90,54,6,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(0, 14, 31, 0, 7); x.stroke();
        cerStar(0, 14, 20, "#fff6c2", "#8a4b00");
      } else if (kind === "crown") {
        x.beginPath(); x.moveTo(-52, 30); x.lineTo(-60, -34); x.lineTo(-28, -4); x.lineTo(0, -52); x.lineTo(28, -4); x.lineTo(60, -34); x.lineTo(52, 30); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = "#8a4b00"; x.fillRect(-54, 30, 108, 14); [["#ff6b9a", -30], ["#7ef0ff", 0], ["#3dd68c", 30]].forEach(function (j) { x.fillStyle = j[0]; x.beginPath(); x.arc(j[1], 14, 7, 0, 7); x.fill(); });
        [[-60, -34], [0, -52], [60, -34]].forEach(function (p) { x.fillStyle = "#fff6c2"; x.beginPath(); x.arc(p[0], p[1], 6, 0, 7); x.fill(); x.stroke(); });
      } else if (kind === "star") { cerStar(0, 0, 58, g, "#5a3606"); }
      // shine sweep
      var sw = (t * .9) % 2.4; if (sw < 1 && kind !== "none") { x.globalCompositeOperation = "lighter"; x.globalAlpha = .5 * Math.sin(sw * Math.PI); x.fillStyle = "#fff"; x.save(); x.rotate(-.5); x.fillRect(-90 + sw * 180, -90, 12, 180); x.restore(); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; }
      x.restore();
    }
    function cerStar(px, py, r, fill, edge) { x.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; x[i ? "lineTo" : "moveTo"](px + Math.cos(a) * q, py + Math.sin(a) * q); } x.closePath(); x.fillStyle = fill; x.fill(); if (edge) { x.strokeStyle = edge; x.lineWidth = Math.max(2, r * .08); x.stroke(); } }
    function cerDraw() {
      var c = cer, K = c.K, o = c.o, t = c.t, a = cerEase(t / .6), i, behind = c.shown ? .55 : 1;
      x.save();
      if (K.mood < 0) { // drain the colour, dim, and let it rain
        try { x.globalCompositeOperation = "saturation"; x.globalAlpha = (o.grey != null ? o.grey : .85) * a; x.fillStyle = "#808080"; x.fillRect(0, 0, W, H); } catch (e) {}
        x.globalCompositeOperation = "source-over"; x.globalAlpha = .55 * a; x.fillStyle = "#07101c"; x.fillRect(0, 0, W, H);
        x.globalAlpha = .35 * a; x.strokeStyle = "#a9c4e0"; x.lineWidth = 1.5; x.beginPath(); for (i = 0; i < c.rain.length; i++) { var r = c.rain[i]; x.moveTo(r.x, r.y); x.lineTo(r.x - r.l * .18, r.y + r.l); } x.stroke();
        var vg = x.createRadialGradient(480, 250, 80, 480, 270, 560); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.7)"); x.globalAlpha = a; x.fillStyle = vg; x.fillRect(0, 0, W, H);
      } else {
        x.globalAlpha = (o.dim != null ? o.dim : K.mood > 0 ? .5 : .4) * a; x.fillStyle = K.mood > 0 ? "#0a0f22" : "#101826"; x.fillRect(0, 0, W, H);
        if (K.mood > 0 && !c.lite) { x.globalCompositeOperation = "lighter"; for (i = 0; i < 4; i++) { var sx0 = 120 + i * 240, ang = Math.sin(c.rays * (1 + i * .23) + i * 1.7) * .5, lg = x.createLinearGradient(sx0, 0, sx0 + Math.sin(ang) * 520, 520); lg.addColorStop(0, "rgba(255,255,255,.22)"); lg.addColorStop(1, "rgba(255,255,255,0)"); x.globalAlpha = a * .8 * behind; x.fillStyle = lg; x.beginPath(); x.moveTo(sx0, -10); x.lineTo(sx0 + Math.sin(ang - .13) * 640, 620); x.lineTo(sx0 + Math.sin(ang + .13) * 640, 620); x.closePath(); x.fill(); } x.globalCompositeOperation = "source-over"; }
      }
      x.globalAlpha = 1;
      if (o.draw) { x.save(); try { o.draw(x, t, c); } catch (e) {} x.restore(); }
      // fireworks
      x.globalCompositeOperation = "lighter"; for (i = 0; i < c.sparks.length; i++) { var s = c.sparks[i]; x.globalAlpha = Math.min(1, s.life * 1.4); x.fillStyle = s.col; x.fillRect(s.x - 2, s.y - 2, 4, 4); x.globalAlpha *= .35; x.fillRect(s.x - s.vx * .04 - 1.5, s.y - s.vy * .04 - 1.5, 3, 3); } x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
      if (!c.shown) {
        var cy = o.draw ? 150 : 268, hasT = c.trophy && c.trophy !== "none" && !o.draw;
        if (hasT) { // glow rays, then the prize rising into place
          var up = cerBack((t - .7) / .7), ty = cy + 20 + (1 - cerEase((t - .7) / .7)) * 240;
          if (t > .7) { if (!c.lite) { x.save(); x.translate(480, ty); x.rotate(c.rays); x.globalAlpha = .16 * cerEase((t - .9) / .6); x.fillStyle = "#fff3b0"; for (i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(-22, 230); x.lineTo(22, 230); x.closePath(); x.fill(); } x.restore(); x.globalAlpha = 1; }
            cerTrophy(c.trophy, 480, ty + (c.lite ? 0 : Math.sin(t * 2.4) * 4), .2 + .95 * up, t); }
        }
        var heroY = hasT ? cy + 30 : cy + 40;
        if (o.hero && !o.draw) { var hb = K.mood > 0 ? -Math.abs(Math.sin(t * 6)) * 16 : K.mood < 0 ? Math.min(14, t * 8) : 0, hx = hasT ? 300 : (o.rival ? 380 : 480), ha = cerEase((t - .35) / .4);
          x.globalAlpha = ha; drawHead(x, o.hero, hx, heroY + hb + (1 - ha) * 40, 52, 1, { mood: K.mood > 0 ? "happy" : K.mood < 0 ? "sad" : undefined });
          if (K.mood < 0 && t > 1) { x.fillStyle = "#7ecbff"; var tear = ((t - 1) * .9) % 1; x.globalAlpha = ha * (1 - tear); x.beginPath(); x.ellipse(hx + 20, heroY + hb + 6 + tear * 46, 4, 6, 0, 0, 7); x.fill(); }
          x.globalAlpha = 1; }
        if (o.rival && !o.draw) { var ra = cerEase((t - .5) / .4), rb = K.mood < 0 ? -Math.abs(Math.sin(t * 6)) * 14 : K.mood > 0 ? Math.min(12, t * 8) : 0, rx = hasT ? 660 : 580; x.globalAlpha = ra * (K.mood < 0 ? 1 : .8); drawHead(x, o.rival, rx, heroY + rb, K.mood < 0 ? 50 : 44, -1, { mood: K.mood < 0 ? "happy" : K.mood > 0 ? "sad" : undefined }); x.globalAlpha = 1; }
        // title slam
        var ti = (t - .2) / .32, ts = ti < 0 ? 0 : ti < 1 ? (c.lite ? 1 : 2.4 - 1.4 * cerEase(ti)) : 1 + (c.lite ? 0 : Math.sin(t * 7) * .02 * (K.mood > 0 ? 1 : 0));
        if (ts > 0) { x.save(); x.translate(480, (o.draw ? 74 : 92) + (K.mood < 0 ? Math.min(10, t * 4) : 0)); x.scale(ts, ts); x.rotate(K.mood < 0 ? -.03 : 0); x.globalAlpha = Math.min(1, ti * 3); x.drawImage(c.img.c, -c.img.w / 2, -c.img.oy); x.restore(); x.globalAlpha = 1; }
        // score count-up and stars
        x.textAlign = "center"; x.lineJoin = "round";
        var by = o.scoreY || (o.draw ? 468 : 432);
        if (o.score != null && t > 1.4) { var f = cerEase((t - 1.5) / 1.2), pop = 1 + (t > 2.7 && t < 2.9 ? .15 : 0); x.save(); x.translate(480, by); x.scale(pop, pop); x.font = "900 44px system-ui, 'Arial Black', sans-serif"; x.lineWidth = 8; x.strokeStyle = "rgba(0,0,0,.7)"; var st = cerNum(o.score * f); x.strokeText(st, 0, 0); x.fillStyle = K.mood < 0 ? "#dbe6f2" : "#fff"; x.fillText(st, 0, 0);
          x.font = "800 15px system-ui, sans-serif"; x.lineWidth = 4; x.strokeText((o.scoreLabel || "Score").toUpperCase(), 0, -40); x.fillStyle = K.mood < 0 ? "#9fb3c8" : "#ffe9a8"; x.fillText((o.scoreLabel || "Score").toUpperCase(), 0, -40); x.restore(); }
        if (o.stars != null && t > 1.6) for (i = 0; i < 3; i++) { var on = i < c.stars, sp = on ? cerBack((t - 1.7 - i * .32) / .3) : 1; x.globalAlpha = on ? 1 : .35; cerStar(480 + (i - 1) * 62, by + 44 - (i === 1 ? 6 : 0), 22 * Math.max(.2, sp), on ? "#ffd84a" : "#3a4658", on ? "#8a4b00" : "#1c2532"); } x.globalAlpha = 1;
        if (o.line && t > 1.1 && o.score == null && o.stars == null) { x.font = "700 20px system-ui, sans-serif"; x.lineWidth = 5; x.strokeStyle = "rgba(0,0,0,.7)"; x.globalAlpha = cerEase((t - 1.1) / .5); x.strokeText(o.line, 480, by, 880); x.fillStyle = "#fff"; x.fillText(o.line, 480, by, 880); x.globalAlpha = 1; }
        if (t > 1) { x.font = "700 13px system-ui, sans-serif"; x.globalAlpha = .55 + .3 * Math.sin(t * 5); x.fillStyle = "#fff"; x.fillText("Tap or press a key to continue", 480, 534); x.globalAlpha = 1; }
      }
      x.restore();
    }
    if (window.ArcadeSettings) try { api.settingsUI = window.ArcadeSettings.install({ api: api, game: game, SET: SET, saveSet: saveSet, actions: actions, bound: bound, keyLabel: keyLabel, stage: stage, cv: cv, ov: ov, touch: touch, Sound: Sound, store: store, slug: SLUG, drawTouch: drawTouch, size: size, press: press, keys: keys,
      paused: function (v) { if (v === undefined) return paused; paused = v; if (!v) { last = 0; Sound.loop(); } }, capture: function (f) { capture = f; }, layoutEditor: layoutEditor, legacy: legacySettings,
      setReduce: function (v) { reduce = !!v || baseReduce; api.reduce = reduce; }, touchSpec: function () { return touchSpec; } }); } catch (e) { if (window.console) console.warn("settings", e); }
    game.init(api);
    requestAnimationFrame(frame);
    window.EEArcadeDebug = { api: api, game: game, fx: fxState, cer: function () { return cer; }, step: function (n) { for (var i = 0; i < (n || 1); i++) { tick(STEP); } }, paint: function () { size(); paint(); },
      press: function (c) { press(actions[c] ? (bound(c)[0]) : c); }, release: function (c) { keys[actions[c] ? bound(c)[0] : c] = false; }, settings: SET };
    return api;
  }

  /* ---------- Progress: the server decides coins/XP; this only reports and shows the result. ---------- */
  var cfg = document.querySelector("[data-gm-api]"), Profile = { me: null, ready: null };
  function csrf() { return cfg ? cfg.getAttribute("data-csrf") : ""; }
  function api(path, body) {
    if (!cfg) return Promise.reject(new Error("offline"));
    return fetch(cfg.getAttribute("data-gm-api") + path, { method: body ? "POST" : "GET", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf(), "Accept": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Request failed"); return j; }); });
  }
  Profile.ready = cfg ? api("me/").then(function (me) { Profile.me = me; return me; }).catch(function () { return null; }) : Promise.resolve(null);
  function toast(html) {
    var host = document.querySelector("[data-gm-stage]") || document.body, t = document.createElement("div");
    t.className = "gm-toast"; t.innerHTML = html; host.appendChild(t);
    setTimeout(function () { t.classList.add("is-out"); }, 4200); setTimeout(function () { t.remove(); }, 4800);
  }
  function report(game, payload) {
    var ss = window.__gmSession; if (ss && ss.cheated && !ss.boards) { toast("Cheat or maker mode was used, so this result is not saved."); return Promise.resolve(null); }
    payload.game = game; payload.mode = payload.mode || "solo";
    return api("result/", payload).then(function (me) {
      Profile.me = me;
      var lines = "<b>+" + me.earned_coins + " coins</b> · +" + me.earned_xp + " XP";
      if (me.levelled_up) { lines += "<br><b>Level up!</b> You are level " + me.level + ", " + esc(me.rank) + "."; Sound.sfx("win"); }
      me.new_badges.forEach(function (b) { lines += "<br>Badge earned: <b>" + esc(b.name) + "</b>"; });
      toast(lines); return me;
    }).catch(function (e) {
      // Played with no internet: keep the result on this device and add it to the record later (arcade-offline.js).
      var O = window.ArcadeOffline; if (O && e.message !== "offline" && O.isNetErr(e)) { O.queue("result", payload); toast("<b>Saved on this device.</b> It will be added to your record when you are back online."); return null; }
      toast(esc(e.message === "offline" ? "Progress not saved (offline)." : e.message)); });
  }
  function owns(item) { return !!(Profile.me && Profile.me.owned.indexOf(item) >= 0); }
  function styled(c) { // the player's own character wearing their equipped kit
    var me = Profile.me, kit = me && me.equipped.kit, item = kit && me.shop.filter(function (s) { return s.id === kit; })[0];
    return item ? Object.assign({}, c, { coat: item.value }) : c;
  }
  function trail() { var me = Profile.me, t = me && me.equipped.trail, item = t && me.shop.filter(function (s) { return s.id === t; })[0]; return item ? item.value : null; }

  /* character picker markup + canvases */
  function picker(api, chosen, label) {
    var list = api && api.hero && api.hero.active ? CAST.concat([HERO]) : CAST;
    return "<p><b>" + esc(label) + "</b></p><div class='gm-picks'>" + list.map(function (c) {
      var lock = c.guest && !owns("char-" + c.id);
      if (lock) return "<button type='button' class='gm-pick is-locked' data-act='locked' disabled aria-disabled='true'><canvas width='144' height='144' data-face='" + c.id + "'></canvas><b>" + esc(c.name.split(" ").pop()) + "</b><small>300 coins in the shop</small></button>";
      return "<button type='button' class='gm-pick' data-act='pick' data-id='" + c.id + "' aria-pressed='" + (c.id === chosen) + "'><canvas width='144' height='144' data-face='" + c.id + "'></canvas><b>" + esc(c.name.split(" ").pop()) + "</b><small>" + esc(c.special) + "</small></button>";
    }).join("") + "</div>";
  }
  function paintFaces(root) {
    [].forEach.call(root.querySelectorAll("canvas[data-face]"), function (cv) { var x = cv.getContext("2d"); x.clearRect(0, 0, 144, 144); drawHead(x, byId[cv.getAttribute("data-face")], 72, 66, 46, 1, { mood: "happy" }); });
  }
  function card(c) {
    return "<div class='gm-card-note'><b>" + esc(c.name) + " (" + c.life + ")</b>: " + esc(c.fact) + "<br><b>" + esc(c.special) + "</b> is a game metaphor. " + esc(c.idea) +
      "<small>" + (c.guest ? "Original guest character, not based on any real person." : "Source: " + esc(c.src) + ". Stylised, fictional avatar for learning; not a portrait.") + "</small></div>";
  }

  /* arcade index: cast banner and card thumbnails (static drawings) */
  function decorate() {
    var hero = document.querySelector("[data-gm-cast]");
    if (hero) { var x = hero.getContext("2d"); CAST.forEach(function (c, i) { drawHead(x, c, 32 + i * 51, 92 + (i % 2) * 36, 26, i < 4 ? 1 : -1, { mood: "happy" }); }); }
    [].forEach.call(document.querySelectorAll("[data-gm-art]"), function (el) {
      var kind = el.getAttribute("data-gm-art"), cv = document.createElement("canvas"); cv.width = 520; cv.height = 300; el.appendChild(cv);
      var x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 300);
      if (kind === "kickoff") {
        g.addColorStop(0, "#0d3b5c"); g.addColorStop(1, "#0a2a1c"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.fillStyle = "#1f8f4e"; x.fillRect(0, 238, 520, 62); x.strokeStyle = "rgba(255,255,255,.5)"; x.setLineDash([6, 8]); x.beginPath(); x.moveTo(110, 220); x.quadraticCurveTo(260, -10, 400, 160); x.stroke(); x.setLineDash([]);
        drawHead(x, byId.einstein, 110, 200, 36, 1, { mood: "happy" }); drawHead(x, byId.curie, 420, 200, 36, -1, {});
        x.fillStyle = "#fff"; x.beginPath(); x.arc(330, 70, 14, 0, 7); x.fill();
      } else if (kind === "clash") {
        g.addColorStop(0, "#2a1408"); g.addColorStop(1, "#0b0f1a"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.fillStyle = "#3a2a1a"; x.fillRect(0, 248, 520, 52); x.strokeStyle = "#f6c445"; x.lineWidth = 4; x.beginPath(); x.moveTo(230, 150); x.lineTo(260, 130); x.lineTo(250, 160); x.lineTo(290, 140); x.stroke();
        drawHead(x, byId.newton, 150, 190, 46, 1, { mood: "fight" }); drawHead(x, byId.tesla, 380, 190, 46, -1, { mood: "fight" });
      } else if (kind === "fieldbound") {
        x.fillStyle = "#061722"; x.fillRect(0, 0, 520, 300);
        for (var i = 0; i < 9; i++) { x.fillStyle = i % 3 ? "#0e2b3a" : "#123a2a"; x.fillRect(20 + i * 56, 120 - (i * 37 % 70), 44, 200); x.fillStyle = i % 2 ? "#ffd86b" : "#1c3644"; for (var w = 0; w < 4; w++) x.fillRect(30 + i * 56, 140 - (i * 37 % 70) + w * 26, 10, 10); }
        x.strokeStyle = "rgba(126,240,255,.8)"; x.lineWidth = 2; for (var k = 0; k < 6; k++) { x.beginPath(); x.arc(380, 90, 20 + k * 16, -1.2, 1.9); x.stroke(); }
        x.fillStyle = "#ff6b6b"; x.beginPath(); x.arc(380, 90, 12, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = "bold 16px sans-serif"; x.textAlign = "center"; x.fillText("+", 380, 96);
      } else if (kind === "dash") {
        g.addColorStop(0, "#ff9a62"); g.addColorStop(1, "#ffd27a"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.fillStyle = "#4a5a3a"; x.fillRect(0, 170, 520, 130); x.fillStyle = "#c9ced6"; x.fillRect(0, 228, 520, 4); x.fillRect(0, 246, 520, 4);
        x.strokeStyle = "#c77d3a"; x.lineWidth = 8; [250, 390].forEach(function (cx) { x.beginPath(); x.ellipse(cx, 212, 20, 50, 0, 0, 7); x.stroke(); });
        x.fillStyle = "#d62828"; x.fillRect(80, 214, 40, 12); x.fillStyle = "#1f6fb2"; x.fillRect(120, 214, 40, 12); x.fillStyle = "#111"; x.beginPath(); x.arc(95, 234, 9, 0, 7); x.arc(145, 234, 9, 0, 7); x.fill();
        drawHead(x, byId.faraday, 120, 182, 24, 1, { mood: "happy" }); x.fillStyle = "#1e1406"; x.font = "800 20px system-ui, sans-serif"; x.fillText("ε = BLv", 380, 60);
      } else if (kind === "forge") {
        g.addColorStop(0, "#0d1b24"); g.addColorStop(1, "#08121a"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.strokeStyle = "#e9c46a"; x.lineWidth = 4; x.strokeRect(90, 70, 340, 170);
        var lg = x.createRadialGradient(400, 155, 4, 400, 155, 70); lg.addColorStop(0, "rgba(255,220,120,.9)"); lg.addColorStop(1, "rgba(255,220,120,0)"); x.fillStyle = lg; x.fillRect(330, 85, 140, 140);
        x.fillStyle = "#fff3c4"; x.beginPath(); x.arc(430, 155, 18, 0, 7); x.fill(); x.fillStyle = "#0d1b24"; x.fillRect(220, 58, 80, 26);
        x.strokeStyle = "#f6c445"; x.lineWidth = 3; x.beginPath(); x.moveTo(220, 70); for (var z = 0; z < 6; z++) x.lineTo(226 + z * 13, z % 2 ? 80 : 60); x.lineTo(300, 70); x.stroke();
        x.fillStyle = "#e9c46a"; x.fillRect(80, 135, 20, 4); x.fillRect(86, 145, 8, 4); x.font = "700 16px system-ui, sans-serif"; x.fillText("V = IR", 205, 200);
      } else if (kind === "platformer") {
        g.addColorStop(0, "#7ec8ff"); g.addColorStop(1, "#d6f0ff"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.fillStyle = "#4ade80"; x.fillRect(0, 230, 520, 70); x.fillStyle = "#3a8a3f"; x.fillRect(0, 230, 520, 8);
        x.fillStyle = "#c08a3e"; [[150, 160], [190, 160], [230, 160]].forEach(function (b) { x.fillRect(b[0], b[1], 36, 36); x.strokeStyle = "#7a5520"; x.lineWidth = 3; x.strokeRect(b[0], b[1], 36, 36); });
        x.fillStyle = "#f6c445"; for (var cn = 0; cn < 4; cn++) { x.beginPath(); x.ellipse(320 + cn * 36, 120 - Math.abs(cn - 1.5) * 14, 9, 12, 0, 0, 7); x.fill(); }
        x.strokeStyle = "rgba(255,255,255,.7)"; x.setLineDash([5, 6]); x.lineWidth = 2; x.beginPath(); x.moveTo(90, 220); x.quadraticCurveTo(200, 40, 330, 150); x.stroke(); x.setLineDash([]);
        x.fillStyle = "#3d1f5c"; x.beginPath(); x.ellipse(430, 220, 26, 14, 0, Math.PI, 0); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(422, 214, 4, 0, 7); x.fill();
        drawHead(x, byId.newton, 90, 196, 26, 1, { mood: "happy" });
      } else if (kind === "shooter") {
        g.addColorStop(0, "#0b1730"); g.addColorStop(1, "#1b2a4a"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.fillStyle = "#14233b"; for (var bd = 0; bd < 7; bd++) x.fillRect(bd * 80, 150 - (bd * 29 % 60), 60, 160);
        x.fillStyle = "#2a3a52"; x.fillRect(0, 236, 520, 64);
        x.strokeStyle = "#7ef0ff"; x.lineWidth = 3; x.beginPath(); for (var wx = 0; wx <= 260; wx += 4) x.lineTo(140 + wx, 196 + Math.sin(wx / 14) * 12); x.stroke();
        x.strokeStyle = "rgba(126,240,255,.35)"; x.lineWidth = 8; x.stroke();
        x.fillStyle = "#3d1f5c"; x.beginPath(); x.ellipse(430, 190, 34, 18, 0, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(420, 186, 6, 0, 7); x.fill();
        x.strokeStyle = "#c084fc"; x.lineWidth = 2; x.beginPath(); x.moveTo(396, 172); x.lineTo(464, 172); x.stroke();
        drawHead(x, byId.einstein, 110, 196, 28, 1, { mood: "fight" });
      } else if (kind === "logic") {
        x.fillStyle = "#081420"; x.fillRect(0, 0, 520, 300);
        x.strokeStyle = "rgba(126,240,255,.12)"; for (var lg = 0; lg < 520; lg += 26) { x.beginPath(); x.moveTo(lg, 0); x.lineTo(lg, 300); x.stroke(); }
        x.lineWidth = 4; x.strokeStyle = "#3dd68c"; x.beginPath(); x.moveTo(40, 110); x.lineTo(180, 110); x.moveTo(40, 170); x.lineTo(180, 170); x.moveTo(260, 140); x.lineTo(400, 140); x.stroke();
        x.fillStyle = "#13283a"; x.strokeStyle = "#e9f6ff"; x.lineWidth = 3; x.beginPath(); x.moveTo(180, 95); x.lineTo(215, 95); x.arc(215, 140, 45, -Math.PI / 2, Math.PI / 2); x.lineTo(180, 185); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = "#e9f6ff"; x.font = "800 20px system-ui, sans-serif"; x.fillText("AND", 202, 147);
        x.fillStyle = "#2a3a4a"; x.fillRect(400, 70, 70, 150); x.fillStyle = "#3dd68c"; x.fillRect(408, 70, 6, 150); x.fillStyle = "#7ef0ff"; x.font = "700 16px ui-monospace, monospace"; x.fillText("1", 60, 100); x.fillText("1", 60, 160);
      } else if (kind === "bender") {
        x.fillStyle = "#0a1018"; x.fillRect(0, 0, 520, 300);
        x.strokeStyle = "rgba(255,80,80,.5)"; x.lineWidth = 7; x.beginPath(); x.moveTo(40, 230); x.lineTo(220, 230); x.lineTo(220, 70); x.lineTo(460, 70); x.stroke();
        x.strokeStyle = "#ffd0d0"; x.lineWidth = 2; x.stroke();
        x.strokeStyle = "#e9f6ff"; x.lineWidth = 5; [[220, 230, 1], [220, 70, -1]].forEach(function (m) { x.beginPath(); x.moveTo(m[0] - 26, m[1] + 26 * m[2]); x.lineTo(m[0] + 26, m[1] - 26 * m[2]); x.stroke(); });
        x.fillStyle = "rgba(126,220,255,.18)"; x.fillRect(290, 120, 150, 90); x.strokeStyle = "rgba(160,230,255,.7)"; x.strokeRect(290, 120, 150, 90);
        x.fillStyle = "#ffd86b"; x.beginPath(); x.arc(470, 70, 18, 0, 7); x.fill();
      } else {
        g.addColorStop(0, "#12202b"); g.addColorStop(1, "#0a1219"); x.fillStyle = g; x.fillRect(0, 0, 520, 300);
        x.strokeStyle = "rgba(255,255,255,.12)"; for (var gx = 0; gx < 520; gx += 26) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 300); x.stroke(); }
        x.fillStyle = "rgba(255,255,255,.35)"; x.font = "600 22px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("Coming soon", 260, 158);
      }
    });
  }

  var SONGS = { funk: song(11, "funk", { bpm: 108 }), cup: song(21, "anthem", { bpm: 126, scale: "major" }), city: song(31, "calm", { bpm: 92 }) };
  function hub() {
    var me = document.querySelector(".gm-me"); if (!me) return;
    var xp = me.querySelector("[data-xp]"), v = +xp.getAttribute("data-xp"), lo = +xp.getAttribute("data-a"), hi = +xp.getAttribute("data-b"), pct = Math.round(100 * (v - lo) / Math.max(1, hi - lo));
    setTimeout(function () { xp.querySelector("i").style.width = pct + "%"; }, 60); me.querySelector(".gm-me__lv").style.setProperty("--lvp", pct + "%");
    var vc = document.querySelector("[data-gm-villain]"); if (vc) drawHead(vc.getContext("2d"), VILLAIN, 80, 92, 52, 1, { mood: "fight" });
    [].forEach.call(document.querySelectorAll("[data-face-sw]"), function (el) { var c = document.createElement("canvas"); c.width = c.height = 60; el.appendChild(c); drawHead(c.getContext("2d"), byId[el.getAttribute("data-face-sw")], 30, 28, 20, 1, { mood: "happy" }); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-buy], [data-equip]"); if (!b) return; b.disabled = true;
      var buy = b.hasAttribute("data-buy");
      api(buy ? "buy/" : "equip/", { item: b.getAttribute(buy ? "data-buy" : "data-equip") }).then(function () { location.reload(); }).catch(function (err) { b.disabled = false; alert(err.message); });
    });
    var pv = document.querySelector("[data-privacy]"); if (pv) pv.addEventListener("change", function () { api("privacy/", { on_leaderboard: pv.checked }).catch(function () { pv.checked = !pv.checked; }); });
    var fb = document.querySelector("[data-gm-filters]"); // library filters (client-side, no reload)
    if (fb) {
      var empty = document.querySelector("[data-gm-empty]");
      fb.addEventListener("click", function (e) {
        var b = e.target.closest("[data-f]"); if (!b) return;
        var f = b.getAttribute("data-f");
        [].forEach.call(fb.querySelectorAll("[data-f]"), function (c) { var on = c === b; c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", on); });
        var shown = 0;
        [].forEach.call(document.querySelectorAll(".gm-card"), function (card) {
          var tags = (card.getAttribute("data-gm-tags") || "").split(" ");
          var show = f === "all" || (f === "mine" ? card.hasAttribute("data-gm-mine") : tags.indexOf(f) >= 0);
          card.classList.toggle("is-filtered", !show); if (show) shown++;
        });
        [].forEach.call(document.querySelectorAll(".gm-shelf"), function (sh) {
          sh.classList.toggle("is-empty", !sh.querySelector(".gm-card:not(.is-filtered)"));
        });
        if (empty) empty.hidden = shown > 0;
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hub); else hub();

  window.Arcade = { hash: sha256, HERO: HERO, song: song, rng: rng, settings: SET, songs: SONGS, esc: esc, VILLAIN: VILLAIN, report: report, profile: Profile, styled: styled, trail: trail, owns: owns, toast: toast, apiCall: api, run: run, CAST: CAST, cast: CAST, byId: byId, drawHead: drawHead, picker: picker, paintFaces: paintFaces, card: card, store: store, Sound: Sound, W: W, H: H };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate); else decorate();
})();
