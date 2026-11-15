/* Freshers School Life — the water: swimming, the fish and birds of The Dam, the Dam Visitor Centre (an aquarium
   gallery that looks into the reservoir, with panels you can read) and the buoy swim.
   Depth: the map only says where water is, so depth is made up here from the distance to the shore (Z.water.depth):
   a shelf you can wade on, then a slope down to the middle. Deep water switches you to swimming: a slow surface
   stroke, a sprint stroke that costs energy, a dive with a generous breath meter that can never drown you (running
   out pushes you back up), and climbing out at any bank, the visitor-centre steps or the pier. Cars that roll in stall
   and are towed back; you swim clear. Walkers keep out of deep water; the lifeguard is the one exception.
   Races: Z.water.race({ gates, laps, ... }) is a small gate-and-lap timer for swimming races (docs/story/ENGINE.md);
   the buoy swim at the visitor centre is built on it.
   Load time only attaches Z.water, data and wrappers; everything else starts from the game's own update, so the Node
   harnesses run it headless (no three.js: the fish and the swim still simulate). */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z || !S || !D) return;
  var Wa = Z.water = { fish: [], schools: [], ducks: [], jumps: [], rings: [], cur: null, best: null }, TAU = Math.PI * 2, HP = Math.PI / 2, SURF = .16;
  var RULES = S.RULES || (S.RULES = {});
  function rule(k, v) { if (RULES[k] == null) RULES[k] = v; }
  rule("swimWade", 1.05);   // metres of water at which you stop wading and start swimming
  rule("swimBreath", 28);   // seconds of air under water (guide §11.4: 20–30 s); surfacing refills it in a few seconds
  rule("swimDive", 2.6);    // how deep a dive takes you, metres below the surface (less where it is shallower)
  rule("swimTow", 18);      // seconds before a stalled vehicle is towed back to where it was parked
  var wr = S.rng(5150); // our own random stream, so the water never shifts anybody else's (deterministic harnesses)
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function api() { return Z.api || null; }
  function snd(n) { try { Z.api.sound.sfx(n); } catch (e) {} } // names live in the samaru-days pack (tools/sfx/build_water.py)
  function say(h) { if (Z.toast) Z.toast(h); }
  function opt(id, d) { return Z.opt ? Z.opt(id, d) : d; }
  function key(a) { var A = api(); return "<b>" + esc(A && A.keyName ? A.keyName(a).split(" ")[0] : a) + "</b>"; }
  function touchy() { return !!(Z.touch && Z.touch.active); }
  function fmt(t) { if (t == null) return "—"; var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }

  /* ---------- data: the visitor centre, its lifeguard, the fish ---------- */
  if (D.PLACES && !D.PLACES.some(function (p) { return p.id === "damcentre"; }))
    D.PLACES.push({ id: "damcentre", name: "Dam Visitor Centre", x: -95, y: 396, zone: "lake", role: "visit", hours: [7, 20], text: "An aquarium window into the reservoir, the story of the dam, and the buoy swim." });
  if (D.NPCS && !D.NPCS.some(function (n) { return n.id === "lifeguard"; }))
    D.NPCS.push({ id: "lifeguard", name: "Okon", role: "Lifeguard", at: "dam", skin: "#5e3a22", hair: "low", top: "#dc2626", voice: "male", pitch: 1.0,
      hi: ["Swim where I can see you: between the buoys.", "Tired? Roll on your back, float, and wave. I will come.", "The board by the steps starts the buoy swim. Beat the best time."] });
  // Local species of a northern Nigerian reservoir. len in metres (a typical adult here, not a record); depth the band
  // they keep to (bottom: they feed on the bed); n fish per school, schools per lake; the rest is how they are drawn.
  Wa.SPECIES = [
    { id: "tilapia", name: "Nile tilapia", sci: "Oreochromis niloticus", ha: "karfasa", len: .28, n: 13, schools: 3, depth: [.5, 2.6], speed: 1.1, jump: .5,
      back: 0x55654f, belly: 0xd9dcc6, bars: 7, h: .42, w: .16, tail: .22, dorsal: .9,
      facts: ["The fish most people catch and eat from Nigerian reservoirs.", "Grazes on algae and soft plants in the warm shallows.", "The mother keeps her eggs and young in her mouth until they can fend for themselves."] },
    { id: "redbelly", name: "Redbelly tilapia", sci: "Coptodon zillii", ha: "", len: .2, n: 8, schools: 2, depth: [.4, 2], speed: 1.2, jump: .35,
      back: 0x5f6c3c, belly: 0xc2412d, bars: 6, h: .44, w: .15, tail: .2, dorsal: .9,
      facts: ["Eats water plants, so it helps keep weeds in check.", "Both parents dig a nest in the shallows and guard it together.", "Its red belly is brightest at breeding time."] },
    { id: "catfish", name: "African sharptooth catfish", sci: "Clarias gariepinus", ha: "tarwada", len: .62, n: 2, schools: 3, depth: [0, 0], bottom: 1, speed: .55, jump: 0,
      back: 0x3d3a33, belly: 0xb9b2a0, spots: .3, h: .15, w: .17, tail: .14, dorsal: .25, flat: 1, barbels: 1,
      facts: ["Has an extra breathing organ and can gulp air, so it survives in muddy water with little oxygen.", "Hunts at night along the bottom, finding food with its long whiskers (barbels).", "The most farmed fish in Nigeria."] },
    { id: "perch", name: "Nile perch", sci: "Lates niloticus", ha: "", len: .95, n: 1, schools: 2, depth: [1.6, 5], speed: .9, jump: .15,
      back: 0x6b7a83, belly: 0xe2e8ec, h: .3, w: .14, tail: .24, dorsal: 1.1, hump: 1,
      facts: ["One of the biggest freshwater fish in Africa, and a hunter of smaller fish.", "Lives in rivers and lakes of the Niger and Chad basins.", "Its eyes shine with a glow in torchlight."] },
    { id: "synodontis", name: "Squeaker catfish", sci: "Synodontis species", ha: "", len: .2, n: 6, schools: 2, depth: [0, 0], bottom: 1, speed: .7, jump: 0,
      back: 0x8a7650, belly: 0xd8ccb0, spots: .45, h: .3, w: .14, tail: .22, dorsal: 1.2, barbels: 1, upside: .35,
      facts: ["Squeaks when caught, by rubbing the spines of its fins.", "Some kinds swim upside down to feed off the surface and the undersides of leaves.", "Armoured with bony plates behind the head."] },
    { id: "elephant", name: "Elephantfish", sci: "family Mormyridae", ha: "", len: .32, n: 3, schools: 2, depth: [1, 4], speed: .8, jump: 0,
      back: 0x34303a, belly: 0x8f8794, h: .22, w: .1, tail: .2, dorsal: .5, snout: .22,
      facts: ["Its trunk-like snout probes the mud for insect larvae.", "Makes a weak electric field to find food and signal to others in murky water.", "Has one of the largest brains for its size of any fish."] },
    { id: "bonytongue", name: "African bonytongue", sci: "Heterotis niloticus", ha: "", len: .65, n: 1, schools: 2, depth: [.4, 2.2], speed: .7, jump: 0, gulp: 1,
      back: 0x6c5c45, belly: 0xbfae8c, h: .24, w: .13, tail: .18, dorsal: .45,
      facts: ["Rises to gulp air at the surface; you can see the rings it leaves.", "Builds a floating nest of cut plants and guards its young.", "Filters tiny food from the water with its gill rakers."] }
  ];
  var SP = {}; Wa.SPECIES.forEach(function (s, i) { s.i = i; SP[s.id] = s; });

  /* ---------- lakes and depth ---------- */
  var lakeCache = null;
  function inPoly(p, x, y) { var c = false; for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { var yi = p[i + 1], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < (p[j] - p[i]) * (y - yi) / (yj - yi) + p[i]) c = !c; } return c; }
  function lakes() {
    var W = Z.W; if (!W || !W.water) return []; if (lakeCache && lakeCache.W === W) return lakeCache.list;
    var list = W.water.map(function (a) { var p = a.p, cx = 0, cy = 0, n = p.length / 2; for (var k = 0; k < p.length; k += 2) { cx += p[k]; cy += p[k + 1]; } var area = (a.x1 - a.x0) * (a.y1 - a.y0); return { a: a, p: p, x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1, cx: cx / n, cy: cy / n, name: a.n || "water", area: area, maxD: 0, ramp: 0 }; });
    list.sort(function (q, r) { return r.area - q.area; }); list.forEach(function (L, i) { L.main = i === 0; L.maxD = L.area > 40000 ? 7 : 3.2; L.ramp = L.area > 40000 ? 18 : 10; });
    lakeCache = { W: W, list: list }; return list;
  }
  Wa.lakes = lakes; Wa.main = function () { return lakes()[0] || null; };
  function lakeAt(x, y) { var ls = lakes(); for (var i = 0; i < ls.length; i++) { var L = ls[i]; if (x >= L.x0 && x <= L.x1 && y >= L.y0 && y <= L.y1 && inPoly(L.p, x, y)) return L; } return null; }
  var QQ = { x: 0, y: 0 };
  function edge(L, x, y, out) { var p = L.p, best = 1e9; for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { var ax = p[j], ay = p[j + 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy || 1, u = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), qx = ax + dx * u, qy = ay + dy * u, d = Math.hypot(x - qx, y - qy); if (d < best) { best = d; if (out) { out.x = qx; out.y = qy; } } } return best; }
  Wa.lakeAt = lakeAt;
  // metres of water at a point (0 on land and on the pier deck)
  Wa.depth = function (x, y) {
    var L = lakeAt(x, y); if (!L) return 0; var W = Z.W; if (W.props && W.props.length && S.deckAt && S.deckAt(W, x, y) > 0) return 0; var ramp = L.ramp;
    if (L.main) { var st = site && site.W === W ? site : Wa.site(); if (st) { var dd = Math.hypot(x - st.edge.x, y - st.edge.y - 2); if (dd < 22) ramp *= 1 - (1 - dd / 22) * .7; } } // dredged deep in front of the visitor-centre steps
    return L.maxD * sm(edge(L, x, y) / ramp);
  };
  // the nearest dry point to (x, y), a little way up the bank
  Wa.shore = function (x, y, up) { var L = lakeAt(x, y) || lakes()[0]; if (!L) return { x: x, y: y }; edge(L, x, y, QQ); var dx = QQ.x - L.cx, dy = QQ.y - L.cy, l = Math.hypot(dx, dy) || 1; return { x: QQ.x + dx / l * (up == null ? 1.5 : up), y: QQ.y + dy / l * (up == null ? 1.5 : up) }; };
  Wa.swimming = function () { var s = Z.me && Z.me.swim; return !!(s && s.on); };
  Wa.state = function () { var s = Z.me && Z.me.swim; return s ? { on: !!s.on, under: s.d > .55, depth: +s.d.toFixed(2), breath: +(s.breath / RULES.swimBreath).toFixed(3), wet: s.wet > 0 } : { on: false, under: false, depth: 0, breath: 1, wet: false }; };

  // Feet and wheels: on the shelf you wade (the bed under you), further out vehicles settle with their roofs above water.
  var oGround = S.groundY; if (oGround) S.groundY = function (W, x, y) { var g = oGround.apply(S, arguments); if (y > 3000 || !lakeCache) return g; var d = Wa.depth(x, y); return d > 0 ? g - Math.min(d * .92, 1.15) : g; };

  /* ---------- places by the visitor centre: steps, the start board, the lifeguard's chair, the buoys ---------- */
  var site = null;
  Wa.site = function () {
    if (site && site.W === Z.W) return site; var pl = Z.places && Z.places.damcentre, L = lakes()[0]; if (!pl || !L) return null;
    var x = pl.mx, y = pl.my + 14, k; for (k = 0; k < 80 && !lakeAt(x, y); k++) y += .5; // walk south from the door to the water's edge
    var e = { x: x, y: y }, nx = 0, ny = 1;
    site = { W: Z.W, edge: e, nx: nx, ny: ny, top: { x: x, y: y - 3.2 }, foot: { x: x, y: y + 4.2 }, board: { x: x - 6.5, y: y - 4 }, chair: { x: x + 6.5, y: y - 2.2 },
      gates: [{ x: -62, y: 470, r: 5.5 }, { x: -4, y: 522, r: 5.5 }, { x: -82, y: 506, r: 5.5 }, { x: x, y: y + 6.5, r: 5, finish: 1 }] };
    return site;
  };

  // The diving spot: a springboard at the end of the pier, over the deepest water near the shore.
  var pierE = null;
  Wa.pierEnd = function () { var W = Z.W; if (pierE && pierE.W === W) return pierE; pierE = null; if (!W || !W.props) return null; var L = lakes()[0];
    for (var i = 0; i < W.props.length; i++) { var q = W.props[i]; if (q.k !== "pier") continue; var c = Math.cos(q.a || 0), sn = Math.sin(q.a || 0), ex = q.x + c * 48, ey = q.y + sn * 48; if (L && Math.hypot(ex - L.cx, ey - L.cy) < Math.hypot(L.x1 - L.x0, L.y1 - L.y0)) { pierE = { W: W, x: ex, y: ey, a: q.a || 0, jx: q.x + c * 54, jy: q.y + sn * 54 }; break; } }
    return pierE; };
  function nearBoardEnd() { var pe = Wa.pierEnd(), me = Z.me; return !!pe && !Wa.swimming() && !Wa.leap && Math.hypot(me.x - pe.x, me.y - pe.y) < 3.2; }
  Wa.diveIn = function () { var pe = Wa.pierEnd(), me = Z.me; if (!pe || Wa.leap) return false; me.x = pe.x; me.y = pe.y; me.a = pe.a; me.vz = 6.2; me.z = .01; Wa.leap = { t: 0, dur: .9, x0: pe.x, y0: pe.y, x1: pe.jx, y1: pe.jy }; snd("dash"); return true; };
  function leapStep(dt) {
    var L = Wa.leap, me = Z.me, s = sw(); if (!L) return; L.t += dt; var u = Math.min(1, L.t / L.dur); me.x = L.x0 + (L.x1 - L.x0) * u; me.y = L.y0 + (L.y1 - L.y0) * u; me.z = Math.max(.01, .66 + Math.sin(u * Math.PI) * 1.6 - u * 1.2); me.vz = 0;
    if (u >= 1) { Wa.leap = null; me.z = 0; me.vz = 0; enterWater(9); s.d = 1.8; s.want = 0; ring(me.x, me.y, 2.8, 1); spray(me.x, me.y, 18, 2.2); snd("splash"); for (var k = 0; k < 8; k++) bubble(me.x, me.y, SURF - 1.4); if (Z.P) { Z.P.stats = Z.P.stats || {}; Z.P.stats.dives = (Z.P.stats.dives || 0) + 1; } } }
  // Under water the world goes muffled: a low-pass on the effect buses (Arcade.Audio), opened again at the surface.
  var muffled = false;
  function muffle(on) {
    if (on === muffled) return; var A = window.Arcade, X = A && A.Audio, Sd = A && A.Sound; if (!X || !X.out || !Sd || !Sd.ac) return; muffled = on;
    try { if (!Wa.lp) { var f = Sd.ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 20000; f.Q.value = .7; Object.keys(X.bus).forEach(function (b) { if (b === "ui") return; X.bus[b].disconnect(); X.bus[b].connect(f); }); f.connect(X.out); Wa.lp = f; }
      Wa.lp.frequency.setTargetAtTime(on ? 560 : 20000, Sd.ac.currentTime, on ? .06 : .15); } catch (e) {}
  }

  /* ---------- swimming ---------- */
  function sw() { var me = Z.me; return me.swim || (me.swim = { on: false, d: 0, want: 0, breath: RULES.swimBreath, ph: 0, ripT: 0, wet: 0, out: 0, t: 0, told: 0 }); }
  function maxBreath() { return opt("swimBreath", "generous") === "endless" ? 1e9 : RULES.swimBreath; }
  function nearSteps(r) { var st = Wa.site(), me = Z.me; if (!st) return false; var dx = me.x - st.edge.x, dy = me.y - st.edge.y; return Math.abs(dx) < 3.4 && dy > -2 && dy < (r || 6); }
  function nearBoard() { var st = Wa.site(), me = Z.me; return !!st && Math.hypot(me.x - st.board.x, me.y - st.board.y) < 3; }
  function enterWater(d0) {
    var me = Z.me, s = sw(), P = Z.P, hard = (me.cs || me.speed || 0) > 3 || me.z > .3; s.on = true; s.d = 0; s.want = 0; s.out = 0; s.t = 0; s.breath = Math.min(s.breath, maxBreath()); if (s.breath <= 0) s.breath = maxBreath();
    me.z = 0; me.vz = 0; me.sit = false; if (me.emote === "sit" || me.emote === "dance") me.emote = "";
    ring(me.x, me.y, hard ? 2.4 : 1.4, hard ? 1 : .7); spray(me.x, me.y, hard ? 14 : 6, hard ? 1.6 : 1); snd(hard ? "splash" : "splash_small");
    if (P && !P.flags.swam) { P.flags.swam = 1; say("<b>Swimming.</b> " + (touchy() ? "The <b>JUMP</b> button dives and comes up; push the stick to the rim to sprint." : key("jump") + " dives and comes back up; " + key("run") + " sprints (it uses energy).") + " Swim to a bank, the steps or the pier to climb out."); }
    if (Z.emit) Z.emit({ t: "swim", on: true }); void d0;
  }
  function leaveWater(quiet) {
    var me = Z.me, s = sw(); s.on = false; s.d = 0; s.want = 0; s.out = 0; s.wet = 30; if (quiet) return;
    snd("water_out"); ring(me.x, me.y, 1.2, .6); if (Z.emit) Z.emit({ t: "swim", on: false });
  }
  Wa.climbOut = function () { var st = Wa.site(), me = Z.me; if (!st) return false; me.x = st.top.x + (me.x - st.edge.x) * .4; me.y = st.top.y; me.a = -HP; leaveWater(); spray(st.edge.x, st.edge.y, 8, 1.2); return true; };
  Wa.dive = function (on) { var s = sw(), me = Z.me; if (!s.on) return false; if (on == null) on = !(s.want > 0); if (on) { if (s.out > 0 && s.breath < maxBreath() * .3) { say("Catch your breath first."); return false; } if (Wa.depth(me.x, me.y) < 1.7) { say("Too shallow to dive here."); return false; } s.want = RULES.swimDive; snd("swim_under"); ring(me.x, me.y, 1.1, .6); } else s.want = 0; return true; };
  function swimStep(dt, d0) {
    var me = Z.me, s = sw(), P = Z.P, mb = maxBreath(), moving = (me.cs || 0) > .4; s.t += dt;
    me.z = 0; me.vz = 0; if (me.sit) me.sit = false; if (me.emote === "sit" || me.emote === "dance") me.emote = "";
    var target = s.want > 0 ? Math.min(s.want, d0 - .65) : 0; if (target < .9) target = s.want > 0 && d0 > 1.7 ? .9 : 0; if (s.want > 0 && d0 < 1.55) s.want = 0;
    var was = s.d; s.d += clamp(target - s.d, -dt * (s.out ? 3 : 2.1), dt * 1.4); var under = s.d > .55;
    if (was > .55 && !under) { snd("gasp"); ring(me.x, me.y, 1.3, .8); spray(me.x, me.y, 5, .8); }
    if (under && mb < 1e8 && s.breath < mb * .3 && s.breath > 0) { if ((s.warnT = (s.warnT || 0) - dt) <= 0) { s.warnT = s.breath < mb * .15 ? .7 : 1.4; snd("pluck"); if (!s.warned) { s.warned = 1; say("<b>Air low.</b> Come up and breathe (" + key("jump") + ")."); } } } else if (!under) s.warned = 0;
    if (under) { if (mb < 1e8) s.breath = Math.max(0, s.breath - dt); if (s.breath <= 0 && !s.out) { s.breath = 0; s.want = 0; s.out = 1; snd("bubbles"); say("<b>Out of breath.</b> You kick hard for the surface. Breathe, then dive again."); } }
    else { s.breath = Math.min(mb, s.breath + dt * Math.min(mb, RULES.swimBreath) / 2.6); if (s.out && s.breath > mb * .3) s.out = 0; }
    if (P && moving && (api().down("run") || Z.runLock)) P.energy = Math.max(0, P.energy - dt * .9); // the sprint stroke is hard work
    var stw = Wa.site(), inArea = stw && (Math.hypot(me.x - stw.edge.x, me.y - stw.edge.y - 8) < 26 || Wa.cur); var pe = Wa.pierEnd(); if (pe && Math.hypot(me.x - pe.x, me.y - pe.y) < 16) inArea = true; s.deep = !inArea && d0 > 2.5;
    if (s.deep && !s.deepTold) { s.deepTold = 1; snd("whistle"); say("<b>Deep water.</b> You are outside the lifeguard's area. Stay near the buoys by the steps or the pier."); }
    var prev = s.ph; s.ph += dt * (moving ? 2.1 + (me.cs || 0) * .55 : 1.3);
    if (moving && Math.floor(s.ph / Math.PI) !== Math.floor(prev / Math.PI)) { snd(under ? "swim_under" : "swim_stroke"); if (!under) { var side = Math.floor(s.ph / Math.PI) % 2 ? 1 : -1, hx = me.x + Math.cos(me.a) * .5 + Math.cos(me.a + HP) * side * .35, hy = me.y + Math.sin(me.a) * .5 + Math.sin(me.a + HP) * side * .35; ring(hx, hy, .7, .45); spray(hx, hy, 3, .55); } }
    if (!under && (s.ripT -= dt) <= 0) { s.ripT = moving ? .32 : 1.2; ring(me.x - Math.cos(me.a) * .5, me.y - Math.sin(me.a) * .5, moving ? .9 : 1.3, moving ? .5 : .35); }
    if (under && wr() < dt * 2.2) bubble(me.x + Math.cos(me.a) * .4, me.y + Math.sin(me.a) * .4, SURF - s.d + .3);
  }
  // A machine that rolls in drags to a halt; past the shelf the engine floods, you swim clear, and it is towed back later.
  Wa.wade = function (v) { return !!(v && !(Z.me && Z.me.alt > .05)); }; // samaru-core asks before bouncing a vehicle off the water
  function stall(v) {
    var me = Z.me; v.speed = 0; v.vx = v.vy = 0; v.drown = 1; v.drownT = RULES.swimTow; v.wT = 0;
    if (me.veh === v && Z.exit) { Z.exit(true); var sx = v.x + Math.cos(v.a - HP) * 1.8, sy = v.y + Math.sin(v.a - HP) * 1.8; if (Wa.depth(sx, sy) > 0) { me.x = sx; me.y = sy; } }
    snd("bubbles"); ring(v.x, v.y, 3, 1); spray(v.x, v.y, 16, 1.4);
    say("<b>The engine floods.</b> You climb out and swim clear. Nobody is hurt; it will be towed back to where it was parked.");
  }
  function vehicles(dt) {
    var me = Z.me, v = me.veh, W = Z.W;
    if (v && me.alt < .05 && S.inWater(W, v.x, v.y)) {
      var dep = Wa.depth(v.x, v.y), k = Math.exp(-dt * (.9 + dep * 1.5)); v.vx *= k; v.vy *= k; v.speed *= k; v.wT = (v.wT || 0) + dt;
      if (!v.inW) { v.inW = 1; snd("splash"); ring(v.x, v.y, 3.2, 1); spray(v.x, v.y, 18, 2); }
      if (Math.abs(v.speed) > 1 && wr() < dt * 14) spray(v.x + Math.cos(v.a) * 1.4, v.y + Math.sin(v.a) * 1.4, 2, 1.2);
      if (dep > 1.25 || (v.wT > 2.2 && Math.abs(v.speed) < .9)) stall(v);
    } else if (v) { v.wT = 0; v.inW = 0; }
    for (var i = 0; i < Z.cars.length; i++) { var c = Z.cars[i]; if (c === me.veh) continue;
      if (c.drown) { c.vx = c.vy = 0; c.speed = 0; c.drownT -= dt; if (c.drownT <= 0 && Math.hypot(c.x - me.x, c.y - me.y) > 25) { c.drown = 0; c.inW = 0; if (c.hx != null) { c.x = c.hx; c.y = c.hy; c.a = c.ha || 0; } else { var q = Wa.shore(c.x, c.y, 4); c.x = q.x; c.y = q.y; } } }
      else if ((c.vx || c.vy) && S.inWater(W, c.x, c.y) && Wa.depth(c.x, c.y) > .3) { c.vx = c.vy = 0; c.speed = 0; c.drown = 1; c.drownT = RULES.swimTow; } }
  }
  // walkers keep out of deep water: anyone found in it is put back on the nearest bank
  var avoidT = 0;
  function avoid(dt) {
    if ((avoidT -= dt) > 0) return; avoidT = .25; var L = lakes()[0]; if (!L) return; var list = Z.npcs.concat(Z.peds);
    for (var i = 0; i < list.length; i++) { var n = list[i]; if (!n || n.hidden || n.id === "lifeguard" || n.follow || n.lead || n.y > 3000) continue; if (n.x < L.x0 - 60 && n.y < L.y0 - 60) continue; var d = Wa.depth(n.x, n.y); if (d < .55) continue;
      var q = Wa.shore(n.x, n.y, 2); n.x = q.x; n.y = q.y; if (n.lx != null) { n.lx = q.x; n.ly = q.y; } if (n.hx != null && Wa.depth(n.hx, n.hy) > .55) { n.hx = q.x; n.hy = q.y; } }
  }
  // friends walking with you follow you in and swim beside you (the follow logic is theirs; we only say who is in the water)
  function friends(dt) {
    for (var i = 0; i < Z.npcs.length; i++) { var n = Z.npcs[i]; if (n.hidden || n.y > 3000) { if (n.swimS) n.swimS.on = false; continue; }
      var inW = (n.follow || n.lead) && Wa.depth(n.x, n.y) > RULES.swimWade, ss = n.swimS || (n.swimS = { on: false, d: 0, ph: wr() * 6, want: 0 });
      if (inW && !ss.on) { ring(n.x, n.y, 1.6, .8); spray(n.x, n.y, 6, 1); if (Math.hypot(n.x - Z.me.x, n.y - Z.me.y) < 30) snd("splash_small"); } else if (!inW && ss.on) ring(n.x, n.y, 1, .5);
      ss.on = inW; if (inW) { ss.ph += dt * 3; if ((ss.rip = (ss.rip || 0) - dt) <= 0) { ss.rip = .5; ring(n.x, n.y, .9, .4); } } }
  }
  // the lifeguard keeps his chair by the steps and blows the whistle when somebody is in trouble
  var lgT = 0;
  function lifeguard(dt) {
    var n = Z.npc && Z.npc("lifeguard"), st = Wa.site(), me = Z.me; if (!n || !st || n.follow || n.lead) return;
    if (Math.hypot(st.chair.x - me.x, st.chair.y - me.y) > 260) return;
    n.x = n.hx = st.chair.x + 1.5; n.y = n.hy = st.chair.y - .3; n.a = HP + Math.sin((Z.api ? Z.api.t : 0) * .3) * .6;
    var s = me.swim; if ((lgT -= dt) > 0 || !s || !s.on) return;
    if (s.d > .55 && s.breath < maxBreath() * .25 && Math.hypot(me.x - n.x, me.y - n.y) < 120) { lgT = 6; snd("whistle"); if (Z.say) Z.say(n, "Up! Come up and breathe!"); }
    else if (Wa.cur && Wa.cur.state === "run" && wr() < dt * .4) { lgT = 9; if (Z.say) Z.say(n, ["Keep going!", "Stroke, stroke, breathe!", "Round the buoy, not over it!"][Math.floor(wr() * 3)]); }
  }

  /* ---------- races: gates, laps and a clock (the buoy swim is one) ---------- */
  Wa.race = function (o) {
    o = o || {}; var h = { id: o.id || "race", name: o.name || "Swim race", mode: o.mode || "swim", laps: Math.max(1, o.laps || 1), gates: (o.gates || []).map(function (g) { return { x: g.x, y: g.y, r: g.r || 5 }; }),
      gate: 0, lap: 0, t: 0, splits: [], state: "ready", count: 0, dry: 0, o: o };
    h.start = function (countdown) { if (Wa.cur && Wa.cur !== h) Wa.cur.stop("replaced"); Wa.cur = h; h.state = countdown ? "count" : "run"; h.count = countdown || 0; h.t = 0; h.gate = 0; h.lap = 0; h.splits = []; h.dry = 0; h.beep = -1; return h; };
    h.stop = function (why) { if (Wa.cur === h) Wa.cur = null; h.state = why === "finish" ? "done" : "stopped"; h.why = why || "stopped"; if (why !== "finish" && o.onStop) o.onStop(h, h.why); return h; };
    h.next = function () { return h.state === "run" || h.state === "count" ? h.gates[h.gate] || null : null; };
    h.time = function () { return h.t; };
    return h;
  };
  function raceStep(dt) {
    var h = Wa.cur, me = Z.me; if (!h) return; var o = h.o;
    if (h.state === "count") { var c = Math.ceil(h.count); if (c !== h.beep) { h.beep = c; snd("pluck"); } h.count -= dt; if (h.count <= 0) { h.state = "run"; snd("whistle"); if (o.onGo) o.onGo(h); } return; }
    if (h.state !== "run") return; h.t += dt;
    if (me.veh || Z.inside) return h.stop(me.veh ? "vehicle" : "inside");
    if (h.mode === "swim" && !Wa.swimming()) { h.dry += dt; if (h.dry > 12) return h.stop("left the water"); } else h.dry = 0;
    var g = h.gates[h.gate]; if (g && Math.hypot(g.x - me.x, g.y - me.y) > 500) return h.stop("too far");
    if (g && Math.hypot(g.x - me.x, g.y - me.y) < g.r) {
      h.splits.push(+h.t.toFixed(2)); h.gate++; snd("pluck"); if (o.onGate) o.onGate(h, h.gate - 1);
      if (h.gate >= h.gates.length) { h.lap++; if (h.lap >= h.laps) { h.stop("finish"); if (o.onFinish) o.onFinish(h); } else h.gate = 0; }
    }
  }
  // The buoy swim: from the board by the steps, round three buoys and back to the steps. Best time kept in your save.
  Wa.challenge = function () {
    var st = Wa.site(), P = Z.P; if (!st || !P) return null; P.stats = P.stats || {};
    var h = Wa.race({ id: "buoys", name: "Buoy swim", gates: st.gates, laps: 1, mode: "swim",
      onGo: function () { say("<b>Go!</b> Into the water and round the orange buoys in order."); },
      onGate: function (r, i) { if (i < r.gates.length - 1) say("Buoy " + (i + 1) + " of " + (r.gates.length - 1) + " · " + fmt(r.t)); },
      onFinish: function (r) { var best = P.stats.swimBest, rec = !best || r.t < best, first = !P.flags.swimDone; P.stats.swimN = (P.stats.swimN || 0) + 1; if (rec) P.stats.swimBest = +r.t.toFixed(2); P.flags.swimDone = 1;
        var cash = first ? 300 : rec ? 150 : 0, xp = first ? 60 : rec ? 30 : 10; P.money += cash; if (Z.xp) Z.xp(xp); else S.addXp(P, xp); snd(rec ? "power" : "coin");
        say("<b>Buoy swim: " + fmt(r.t) + "</b>" + (rec ? (best ? " · new best (was " + fmt(best) + ")" : " · your first record") : " · best " + fmt(best)) + (cash ? " · +₦" + cash : "") + " · +" + xp + " XP"); if (Z.emit) Z.emit({ t: "swimrace", time: r.t, best: P.stats.swimBest }); },
      onStop: function (r, why) { if (why !== "replaced") say("Buoy swim abandoned (" + esc(why) + ")."); } });
    say("<b>Buoy swim.</b> Round buoys 1, 2 and 3, then back to the steps." + (P.stats.swimBest ? " Best: " + fmt(P.stats.swimBest) + "." : "") + " Ready…");
    return h.start(3);
  };
  Wa.best = function () { return Z.P && Z.P.stats ? Z.P.stats.swimBest || null : null; };

  /* ---------- fish, ducks and egrets (simulated only near the water) ---------- */
  function deepPoint(L, r, min) { for (var k = 0; k < 400; k++) { var x = L.x0 + r() * (L.x1 - L.x0), y = L.y0 + r() * (L.y1 - L.y0); if (Wa.depth(x, y) > min) return { x: x, y: y }; } return { x: L.cx, y: L.cy }; }
  Wa.initFish = function () {
    var L = lakes()[0]; Wa.fish = []; Wa.schools = []; Wa.ducks = []; Wa.egrets = []; if (!L) return; var r = S.rng(7151);
    var st = Wa.site(); Wa.SPECIES.forEach(function (sp) { for (var k = 0; k < sp.schools; k++) {
      var p = deepPoint(L, r, sp.bottom ? 1.2 : sp.depth[0] + 1.2), sc = { sp: sp, x: p.x, y: p.y, a: r() * TAU, d: (sp.depth[0] + sp.depth[1]) / 2, tw: r() * 100, seed: r() * 50 }; Wa.schools.push(sc);
      if (st && k === 0 && (sp.id === "tilapia" || sp.id === "redbelly")) { sc.home = { x: st.edge.x + (sp.id === "tilapia" ? -4 : 6), y: st.edge.y + 9 }; sc.x = sc.home.x; sc.y = sc.home.y; p = sc.home; }
      for (var m = 0; m < sp.n; m++) { var f = { sc: sc, sp: sp, x: p.x + (r() - .5) * 3, y: p.y + (r() - .5) * 3, d: sc.d, a: sc.a, ox: (r() - .5) * (1.2 + sp.n * .22), oy: (r() - .5) * (1.2 + sp.n * .22), od: (r() - .5) * .7, s: sp.len * (.75 + r() * .45), ph: r() * TAU, up: sp.upside && r() < sp.upside ? 1 : 0, jump: null }; Wa.fish.push(f); } } });
    // a family of white-faced whistling ducks, and egrets on the shelf
    var dp = deepPoint(L, r, 2.2); for (var i = 0; i < 7; i++) Wa.ducks.push({ x: dp.x + (r() - .5) * 6, y: dp.y + (r() - .5) * 6, a: r() * TAU, dip: 0, ph: r() * TAU, s: i < 2 ? 1 : .8 + r() * .15 });
    Wa.ducks.home = { x: dp.x, y: dp.y, a: r() * TAU };
    for (var e = 0, tries = 0; e < 3 && tries < 200; tries++) { var vi = Math.floor(r() * L.p.length / 2) * 2, vx = L.p[vi], vy = L.p[vi + 1], vl = Math.hypot(L.cx - vx, L.cy - vy) || 1, ex = vx + (L.cx - vx) / vl * (1.2 + r() * 1.6), ey = vy + (L.cy - vy) / vl * (1.2 + r() * 1.6), dd = Wa.depth(ex, ey); if (dd > .1 && dd < .5 && !Wa.egrets.some(function (q) { return Math.hypot(q.x - ex, q.y - ey) < 30; })) { Wa.egrets.push({ x: ex, y: ey, a: Math.atan2(L.cy - ey, L.cx - ex), t: r() * 5 }); e++; } }
    Wa.jumpT = 3; Wa.fishOK = Z.W;
  };
  function nearLake(m) { var L = lakes()[0], me = Z.me; if (!L || !me || me.y > 3000) return false; m = m || 160; return me.x > L.x0 - m && me.x < L.x1 + m && me.y > L.y0 - m && me.y < L.y1 + m; }
  Wa.near = nearLake;
  function turnTo(a, b, k) { var da = ((b - a + Math.PI * 3) % TAU) - Math.PI; return a + clamp(da, -k, k); }
  Wa.fishStep = function (dt) {
    if (Wa.fishOK !== Z.W) Wa.initFish(); var L = lakes()[0]; if (!L) return; var i, me = Z.me;
    for (i = 0; i < Wa.schools.length; i++) { var sc = Wa.schools[i], sp = sc.sp; sc.tw += dt;
      var spd = sp.speed * (.75 + .35 * Math.sin(sc.tw * .21 + sc.seed)), wa = sc.a + (Math.sin(sc.tw * .37 + sc.seed) * .55 + Math.sin(sc.tw * .11 + sc.seed * 2) * .4) * dt, nx = sc.x + Math.cos(wa) * spd * dt, ny = sc.y + Math.sin(wa) * spd * dt, need = sp.bottom ? 1.3 : sp.depth[0] + 1.1, dn = Wa.depth(nx, ny);
      if (dn < need) { sc.a = turnTo(sc.a, Math.atan2(L.cy - sc.y, L.cx - sc.x) + Math.sin(sc.seed) * .8, dt * 1.6); }
      else if (sc.home && Math.hypot(sc.home.x - sc.x, sc.home.y - sc.y) > 9) { sc.a = turnTo(wa, Math.atan2(sc.home.y - sc.y, sc.home.x - sc.x), dt * 1.2); sc.x = nx; sc.y = ny; } // the tame school by the steps
      else { sc.a = wa; sc.x = nx; sc.y = ny; }
      if (me.swim && me.swim.on && Math.hypot(me.x - sc.x, me.y - sc.y) < 5) { sc.a = turnTo(sc.a, Math.atan2(sc.y - me.y, sc.x - me.x), dt * 4); } // a swimmer scatters them
      var here = Wa.depth(sc.x, sc.y); sc.d = sc.home ? clamp(.55 + Math.sin(sc.tw * .2) * .2, .35, here - .4) : sp.bottom ? here - .3 : clamp((sp.depth[0] + sp.depth[1]) / 2 + Math.sin(sc.tw * .17 + sc.seed) * (sp.depth[1] - sp.depth[0]) / 2, .35, here - .4); }
    for (i = 0; i < Wa.fish.length; i++) { var f = Wa.fish[i], s0 = f.sc, ca = Math.cos(s0.a), sa = Math.sin(s0.a);
      if (f.jump) continue;
      var tx = s0.x + f.ox * ca - f.oy * sa, ty = s0.y + f.ox * sa + f.oy * ca, dx = tx - f.x, dy = ty - f.y, dl = Math.hypot(dx, dy), v = Math.min(dl * 1.3, f.sp.speed * 2.2), px = f.x, py = f.y;
      f.ph += dt * (2 + v * 3);
      if (dl > .05) { f.x += dx / dl * v * dt; f.y += dy / dl * v * dt; f.a = turnTo(f.a, dl > .4 ? Math.atan2(dy, dx) : s0.a, dt * 3); }
      var dep = Wa.depth(f.x, f.y); if (dep < .55) { f.x = px; f.y = py; dep = Wa.depth(px, py); }
      f.d = f.sp.bottom ? Math.max(.3, dep - .3 - f.od * .2) : clamp(s0.d + f.od, .3, Math.max(.3, dep - .3)); }
    // jumps and surface rings close to you
    if ((Wa.jumpT -= dt) <= 0) { Wa.jumpT = 3 + wr() * 6; var pick = null; for (var k = 0; k < 12 && !pick; k++) { var c = Wa.fish[Math.floor(wr() * Wa.fish.length)]; if (c && !c.jump && c.sp.jump && wr() < c.sp.jump && Math.hypot(c.x - me.x, c.y - me.y) < 75) pick = c; }
      if (pick) { pick.jump = { t: 0, dur: .7 + pick.s * .6, x: pick.x, y: pick.y, a: pick.a, h: .5 + pick.s * 1.4 }; ring(pick.x, pick.y, 1.1, .8); spray(pick.x, pick.y, 4, .8); if (Math.hypot(pick.x - me.x, pick.y - me.y) < 45) snd("splash_small"); }
      else { var g = Wa.fish[Math.floor(wr() * Wa.fish.length)]; if (g && (g.sp.gulp || g.d < .8)) ring(g.x, g.y, .8, .5); } }
    for (i = 0; i < Wa.fish.length; i++) { var j = Wa.fish[i].jump; if (!j) continue; j.t += dt; var fj = Wa.fish[i]; fj.x = j.x + Math.cos(j.a) * j.t * 1.6; fj.y = j.y + Math.sin(j.a) * j.t * 1.6;
      if (j.t >= j.dur) { fj.jump = null; ring(fj.x, fj.y, 1.3, .9); spray(fj.x, fj.y, 6, .9); if (Math.hypot(fj.x - me.x, fj.y - me.y) < 45) snd("splash_small"); if (Wa.depth(fj.x, fj.y) < .55) { fj.x = j.x; fj.y = j.y; } } }
    // ducks paddle round a slow loop and keep clear of you; egrets wade
    var hm = Wa.ducks.home; if (hm) { hm.a += dt * .03; var lx = hm.x + Math.cos(hm.a) * 14, ly = hm.y + Math.sin(hm.a) * 9;
      Wa.ducks.forEach(function (dk, n) { var tx2 = lx + Math.cos(n * 2.4) * (1.2 + n * .5), ty2 = ly + Math.sin(n * 2.4) * (1.2 + n * .5), ddx = tx2 - dk.x, ddy = ty2 - dk.y, md = Math.hypot(me.x - dk.x, me.y - dk.y);
        if (md < 7) { ddx += (dk.x - me.x) * 2; ddy += (dk.y - me.y) * 2; } var l = Math.hypot(ddx, ddy); dk.ph += dt;
        if (l > .2) { var sp2 = Math.min(md < 7 ? 2.2 : .7, l), nx2 = dk.x + ddx / l * sp2 * dt, ny2 = dk.y + ddy / l * sp2 * dt; if (Wa.depth(nx2, ny2) > .35) { dk.x = nx2; dk.y = ny2; } dk.a = turnTo(dk.a, Math.atan2(ddy, ddx), dt * 2.5); }
        dk.dip = Math.max(0, dk.dip - dt); if (wr() < dt * .05) dk.dip = 1.4; }); }
    Wa.egrets.forEach(function (eg) { eg.t += dt; });
  };

  /* ---------- small effects (logical lists; drawn in 3D when it is up) ---------- */
  function ring(x, y, size, power) { var R = Wa.rings; if (R.length > 40) R.shift(); R.push({ x: x, y: y, s: size || 1, p: power == null ? .7 : power, t: 0 }); }
  function spray(x, y, n, up) { var R = Z.r3; if (R && R.ready && R.puff) try { R.puff(x, SURF + .1, y, 0xe0f2fe, n || 4, .9, (up || 1) * 1.6, { size: .14, life: .7, grav: 9 }); } catch (e) {} }
  var bubbles = [];
  function bubble(x, y, h) { if (bubbles.length > 30) bubbles.shift(); bubbles.push({ x: x + (wr() - .5) * .3, y: y + (wr() - .5) * .3, h: h, t: 0, s: .04 + wr() * .05 }); }
  Wa.ring = ring;

  /* ---------- the update: input first (dive, climb out, start), the original update, then the water ---------- */
  var oUpdate = Z.update;
  function pre() {
    var me = Z.me, A = api(), s = sw(); if (!A || Z.inside || me.veh || Z.mode !== "play" || (Z.bigOpen && Z.bigOpen())) return null;
    if (s.on) { var blk = { jump: 1, attack: 1, kick: 1, "throw": 1, emote2: 1, emote3: 1, emote4: 1 };
      if (A.hit("jump")) Wa.dive();
      if (A.hit("act") && nearSteps(5)) { Wa.climbOut(); blk.act = 1; }
      return blk; }
    if (Wa.leap) return { act: 1, jump: 1, attack: 1 };
    if (A.hit("act") && nearBoardEnd()) { Wa.diveIn(); return { act: 1 }; }
    if (A.hit("act") && nearBoard() && !(Wa.cur && Wa.cur.state !== "done")) { Wa.challenge(); return { act: 1 }; }
    return null;
  }
  function post(dt) {
    var me = Z.me, s = sw(), P = Z.P; if (!P || Z.mode !== "play") return;
    if (Z.inside) { if (s.on) leaveWater(true); camRelease(); return; }
    vehicles(dt);
    var d0 = me.veh ? 0 : Wa.depth(me.x, me.y), swim = !me.veh && d0 > RULES.swimWade && !me.alt && !Wa.leap;
    if (swim && !s.on) enterWater(d0); else if (!swim && s.on) leaveWater();
    if (s.on) swimStep(dt, d0); else if (s.wet > 0) { s.wet -= dt; if (wr() < dt * 3 * Math.min(1, s.wet / 10)) { var R = Z.r3; if (R && R.ready && R.puff) try { R.puff(me.x + (wr() - .5) * .4, 1 + wr() * .5, me.y + (wr() - .5) * .4, 0xbae6fd, 1, .05, -.4, { size: .05, life: .5, grav: 9 }); } catch (e) {} } }
    var near = nearLake(); if (near || s.on) Wa.fishStep(dt);
    for (var i = Wa.rings.length - 1; i >= 0; i--) { Wa.rings[i].t += dt; if (Wa.rings[i].t > 1.6) Wa.rings.splice(i, 1); }
    for (i = bubbles.length - 1; i >= 0; i--) { var b = bubbles[i]; b.t += dt; b.h += dt * (.6 + b.s * 8); b.x += Math.sin(b.t * 9 + i) * dt * .2; if (b.h > SURF) { bubbles.splice(i, 1); } }
    avoid(dt); friends(dt); lifeguard(dt); raceStep(dt); camStep(dt); muffle(!!Wa.camUnder || (s.on && s.d > .6)); leapStep(dt);
    if (near && !P.flags.dcSeen) { var pl = Z.places && Z.places.damcentre; if (pl && Math.hypot(pl.mx - me.x, pl.my - me.y) < 200) { P.flags.dcSeen = 1; if (!Z.waypoint) { Z.waypoint = { x: pl.mx, y: pl.my, name: pl.name }; if (Z.reroute) Z.reroute(); } say("<b>New: the Dam Visitor Centre.</b> An aquarium window into the reservoir, and a buoy swim with a lifeguard." + (Z.waypoint && Z.waypoint.name === pl.name ? " Waypoint set." : "")); } }
    if (near || s.on || Wa.g3) try { step3(dt); } catch (e) { if (!Wa.err3) { Wa.err3 = e; if (typeof console !== "undefined") console.error(e); } }
    hud();
  }
  if (oUpdate) Z.update = function (dt) {
    var A = api(), blk = null, oh = null; try { if (Z.P && Z.me) blk = pre(dt); } catch (e) { Wa.err = Wa.err || e; }
    if (blk && A) { oh = A.hit; A.hit = function () { for (var i = 0; i < arguments.length; i++) if (blk[arguments[i]]) return false; return oh.apply(A, arguments); }; }
    try { return oUpdate.apply(Z, arguments); }
    finally { if (oh) A.hit = oh; try { if (Z.P && Z.me) post(dt); } catch (e) { if (!Wa.err) { Wa.err = e; if (typeof console !== "undefined") console.error(e); } } }
  };
  var oPrompt = Z.prompt; if (oPrompt) Z.prompt = function () {
    if (!Z.inside && Z.me && !Z.me.veh) { if (Wa.swimming() && nearSteps(5)) return "Climb out"; if (nearBoardEnd()) return "Dive in"; if (!Wa.swimming() && nearBoard() && !(Wa.cur && Wa.cur.state !== "done")) return "Start the buoy swim" + (Wa.best() ? " (best " + fmt(Wa.best()) + ")" : ""); }
    return oPrompt.apply(Z, arguments);
  };
  var oTarget = Z.target; if (oTarget) Z.target = function () { var h = Wa.cur; if (h && !Z.inside && (h.state === "run" || h.state === "count")) { var g = h.gates[h.gate]; if (g) return { x: g.x, y: g.y, name: h.gate === h.gates.length - 1 ? "Finish: the steps" : "Buoy " + (h.gate + 1) }; } return oTarget.apply(Z, arguments); };
  var oEnter = Z.enter; if (oEnter) Z.enter = function (v) { if (v && v.drown) { say("The engine is flooded. Leave it: it will be towed back to its bay."); return; } if (Wa.swimming()) { say("Climb out of the water first."); return; } return oEnter.apply(Z, arguments); };
  var oBegin = Z.begin; if (oBegin) Z.begin = function () { var r = oBegin.apply(Z, arguments); if (Z.me) Z.me.swim = null; Wa.cur = null; Wa.rings.length = 0; return r; };
  var oSI = Z.settingsInit; Z.settingsInit = function (A) { if (oSI) oSI.apply(Z, arguments); var St = A && A.settings; if (!St || typeof St.add !== "function") return;
    St.add({ id: "swimBreath", tab: "gameplay", section: "Swimming", label: "Breath under water", type: "choice", default: "generous", choices: [["generous", "Generous (" + RULES.swimBreath + " s)"], ["endless", "Unlimited"]], help: "Running out of breath only sends you back to the surface." });
    St.add({ id: "swimCam", tab: "controls", section: "Camera", label: "Camera when you dive", type: "choice", default: "follow", choices: [["follow", "Follows you under water"], ["above", "Stays above the surface"]] });
    St.add({ id: "damLife", tab: "display", section: Z.resolveText ? Z.resolveText("{{GAME_NAME}}") : "This game", label: "Fish and birds at The Dam", type: "toggle", default: true, help: "Off saves a little work on slow phones." }); };

  /* ---------- HUD: the breath meter and the race clock (DOM, so it stays readable on a phone) ---------- */
  var hudEl, hudKey = "";
  function hud() {
    var s = Z.me && Z.me.swim, h = Wa.cur, lines = [], mb = maxBreath();
    if (s && s.on && (s.d > .3 || s.breath < mb - .5) && mb < 1e8) { var f = clamp(s.breath / mb, 0, 1), low = f < .3; lines.push("<div style='display:flex;align-items:center;gap:8px;justify-content:center'><span style='opacity:" + (low && Math.floor(((Z.api && Z.api.t) || 0) * 3) % 2 ? .45 : 1) + "'>" + (low ? "Air low!" : "Breath") + "</span><span style='display:inline-block;width:clamp(110px,30vw,170px);height:12px;border-radius:7px;background:rgba(2,12,20,.6);border:1px solid rgba(186,230,253,.6);overflow:hidden'><i style='display:block;height:100%;width:" + Math.round(f * 100) + "%;background:" + (low ? "#f87171" : "#7dd3fc") + "'></i></span></div>"); }
    if (s && s.on && s.t < 7 && !Z.P.flags.swamHud) lines.push("<div style='font-weight:600;opacity:.9'>" + (touchy() ? "JUMP: dive / come up" : esc(api().keyName("jump").split(" ")[0]) + ": dive / come up · " + esc(api().keyName("run").split(" ")[0]) + ": sprint") + "</div>");
    if (s && s.on && s.t >= 7) Z.P.flags.swamHud = 1;
    if (s && s.on && s.deep) lines.push("<div style='color:#fbbf24'>Deep water: outside the lifeguard's area</div>");
    if (h && (h.state === "count" || h.state === "run")) lines.push("<div style='font-size:1.15em'>" + (h.state === "count" ? "Get ready… " + Math.max(1, Math.ceil(h.count)) : "Buoy swim " + fmt(h.t) + " · " + (h.gate < h.gates.length - 1 ? "buoy " + (h.gate + 1) + "/" + (h.gates.length - 1) : "to the steps!")) + (Wa.best() ? " · best " + fmt(Wa.best()) : "") + "</div>");
    var k = lines.join(""); if (k === hudKey) return; hudKey = k;
    if (hudEl === undefined) { hudEl = null; try { var st = document.querySelector("[data-gm-stage]"); if (st && st.appendChild && document.createElement) { hudEl = document.createElement("div"); hudEl.className = "fw-water"; hudEl.style.cssText = "position:absolute;left:50%;top:clamp(78px,15%,120px);transform:translateX(-50%);pointer-events:none;z-index:6;text-align:center;font:800 clamp(13px,3.6vw,16px)/1.35 system-ui,sans-serif;color:#e0f2fe;text-shadow:0 1px 3px rgba(0,0,0,.85);background:rgba(4,12,20,.45);padding:6px 12px;border-radius:12px;white-space:nowrap"; st.appendChild(hudEl); } } catch (e) { hudEl = null; } }
    if (hudEl) { hudEl.innerHTML = k; hudEl.style.display = k ? "block" : "none"; var stg = hudEl.parentNode, tall = !!(stg && stg.clientHeight > stg.clientWidth); if (hudEl._tall !== tall) { hudEl._tall = tall; var hs = hudEl.style; if (tall) { hs.left = "50%"; hs.top = "max(64px, env(safe-area-inset-top))"; hs.transform = "translateX(-50%)"; hs.textAlign = "center"; } else { hs.left = "max(14px, env(safe-area-inset-left))"; hs.top = "clamp(150px, 24%, 200px)"; hs.transform = "none"; hs.textAlign = "left"; } } } // phones upright: top middle; wide screens: under the money, clear of the clock and the objective
    // the touch JUMP button reads DIVE / UP while you swim (samaru-touch keeps its own label in _t; we only repaint it)
    var B = Z.touch && Z.touch.buttons && Z.touch.buttons.jump; if (B && B.style) { if (s && s.on) B.innerHTML = s.want > 0 ? "UP" : "DIVE"; else if (B._t != null) B.innerHTML = B._t; }
  }

  /* ---------- the camera under water ---------- */
  var camS = null;
  function camRelease() { var R = Z.r3; if (R && Wa.shotMine && R.shot === Wa.shotMine) R.shot = null; Wa.shotMine = null; Wa.camUnder = false; camS = null; }
  function camStep(dt) {
    var R = Z.r3, me = Z.me, s = me.swim; if (!R || !R.ready) return;
    if (!(s && s.on && s.d > .7 && opt("swimCam", "follow") === "follow" && !(Z.intro && Z.intro.on) && (!R.shot || R.shot === Wa.shotMine))) { camRelease(); return; }
    var yaw = R.yaw, pitch = clamp(R.pitch || .3, .05, .7), dist = 4.6 * clamp(R.zoom || 1, .7, 1.6), cx = me.x - Math.cos(yaw) * dist * Math.cos(pitch), cy = me.y - Math.sin(yaw) * dist * Math.cos(pitch), body = SURF - s.d;
    var ch = Math.min(SURF - .3, body + .5 + Math.sin(pitch) * dist * .55), floor = SURF - Wa.depth(cx, cy) + .45; if (ch < floor) ch = floor; if (Wa.depth(cx, cy) < .8) { cx = me.x - Math.cos(yaw) * 1.6; cy = me.y - Math.sin(yaw) * 1.6; ch = body + .3; }
    var k = camS ? 1 - Math.exp(-dt * 6) : 1; camS = camS || { x: cx, y: cy, h: ch }; camS.x += (cx - camS.x) * k; camS.y += (cy - camS.y) * k; camS.h += (ch - camS.h) * k;
    R.shot = Wa.shotMine = { x: camS.x, h: camS.h, y: camS.y, tx: me.x + Math.cos(yaw) * 1.5, th: body + .15, ty: me.y + Math.sin(yaw) * 1.5 }; Wa.camUnder = camS.h < SURF - .05;
  }

  /* ---------- the swimmer's body (layered over samaru-anim's pose, which stays untouched) ---------- */
  var UWC = null, UWB = null;
  function swimPose(g, st, t, ent) {
    var r = g.userData.rig, me = Z.me, mine = !ent || ent === me, s = mine ? me.swim : ent.swimS; if (!r || !r.body) return; var dt = clamp(t - (r.swT || t), 0, .1); r.swT = t;
    var on = !!(s && s.on) && (mine ? !me.veh : !ent.rideV); r.swW = (r.swW || 0) + ((on ? 1 : 0) - (r.swW || 0)) * (on ? 1 : 1 - Math.exp(-dt * 8)); var k = r.swW; if (k < .01) { r.swW = 0; return; }
    var sp = mine ? me.cs || 0 : r.v || 0, mv = clamp(sp / 1.6, 0, 1), under = clamp((s ? s.d : 0) / .7, 0, 1), ph = s ? s.ph : t * 2, ws = Wa.wavY ? Wa.wavY : 0;
    // three bodies blended: treading water upright, the surface crawl, and the glide under water
    var crawl = mv * (1 - under), tread = (1 - mv) * (1 - under), glide = under, lean = tread * -.22 + crawl * -1.22 + glide * -1.5 + (glide ? clamp((r.swPrevD || 0) - s.d, -.05, .05) * 8 : 0);
    var y = SURF + ws + tread * (-1.12 + Math.sin(t * 2.2) * .05) + crawl * (-.44 + Math.sin(ph * 2) * .03) + glide * (-(s ? s.d : 0) - .3); r.swPrevD = s ? s.d : 0;
    var back = -Math.sin(lean) * 1.12, ca = Math.cos(r.a), sa = Math.sin(r.a), p = g.position, mix = function (a, b) { return a + (b - a) * k; };
    p.x = mix(p.x, p.x - ca * back); p.z = mix(p.z, p.z - sa * back); p.y = mix(p.y, y);
    var b = r.body; b.rotation.z = mix(b.rotation.z, lean); b.rotation.x = mix(b.rotation.x, crawl * Math.sin(ph) * .32 + tread * Math.sin(t * 1.1) * .05);
    var sL = tread * (.55 + Math.sin(ph) * .3) + crawl * (ph % TAU) + glide * (2.9 - Math.max(0, Math.sin(ph * .7)) * 1.7), sR = tread * (.55 - Math.sin(ph) * .3) + crawl * ((ph + Math.PI) % TAU) + glide * (2.9 - Math.max(0, Math.sin(ph * .7)) * 1.7);
    var xL = tread * 1.15 + crawl * .18 + glide * (.25 + Math.max(0, Math.sin(ph * .7)) * .6), eL = tread * .5 + crawl * (Math.sin(ph) > 0 ? .25 : 1.1) + glide * .2, eR = tread * .5 + crawl * (Math.sin(ph) > 0 ? 1.1 : .25) + glide * .2;
    r.aL.sh.rotation.set(mix(r.aL.sh.rotation.x, xL), 0, mix(r.aL.sh.rotation.z, sL)); r.aR.sh.rotation.set(mix(r.aR.sh.rotation.x, -xL), 0, mix(r.aR.sh.rotation.z, sR)); r.aL.el.rotation.set(0, 0, mix(r.aL.el.rotation.z, eL)); r.aR.el.rotation.z = mix(r.aR.el.rotation.z, eR);
    var kick = Math.sin(ph * 2.2), frog = Math.max(0, Math.sin(ph * .7 + 1.2));
    var hL = tread * (.7 + Math.sin(t * 2.6) * .35) + crawl * (.1 + kick * .28) + glide * (.15 + frog * .8), hR = tread * (.7 - Math.sin(t * 2.6) * .35) + crawl * (.1 - kick * .28) + glide * (.15 + frog * .8);
    var kL = tread * (-1 - Math.cos(t * 2.6) * .35) + crawl * (-.15 - Math.max(0, kick) * .35) + glide * (-.2 - frog * 1.6), kR = tread * (-1 + Math.cos(t * 2.6) * .35) + crawl * (-.15 - Math.max(0, -kick) * .35) + glide * (-.2 - frog * 1.6);
    r.lL.hp.rotation.z = mix(r.lL.hp.rotation.z, hL); r.lR.hp.rotation.z = mix(r.lR.hp.rotation.z, hR); r.lL.kn.rotation.z = mix(r.lL.kn.rotation.z, kL); r.lR.kn.rotation.z = mix(r.lR.kn.rotation.z, kR); r.lL.ft.rotation.z = mix(r.lL.ft.rotation.z, -.7); r.lR.ft.rotation.z = mix(r.lR.ft.rotation.z, -.7);
    r.head.rotation.z = mix(r.head.rotation.z, tread * .05 + crawl * .95 + glide * 1.15); if (r.shadow) r.shadow.visible = r.shadow.visible && k < .5;
    // under water: murky green-blue haze instead of the sky (the 3D view sets fog every frame, so this lasts one frame)
    if (mine && Wa.camUnder && Z.r3 && Z.r3.kit) { var sc = Z.r3.kit.scene, T = Z.r3.kit.T; if (!UWC) { UWC = new T.Color(0x2a5b52); UWB = new T.Color(0x24504a); } var dk = Z.P ? S.darkness(Z.P.time) : 0; UWB.setHex(0x2c6157).lerp(new T.Color(0x06141a), dk * .85); UWC.copy(UWB); if (sc.fog) { sc.fog.color.copy(UWC); sc.fog.near = .5; sc.fog.far = 26; } sc.background = UWB; }
  }
  if (Z.anim && Z.anim.init) { var oInit = Z.anim.init; Z.anim.init = function () { var o = oInit.apply(Z.anim, arguments); if (o && o.pose && !o._water) { var op = o.pose; o._water = 1; o.pose = function (g, x, y, a, st) { var r = op.apply(o, arguments); if (st && st.o && (st.o === Z.me || (st.o.swimS && st.o.swimS.on) || g.userData.rig && g.userData.rig.swW)) try { swimPose(g, st, arguments[5], st.o); } catch (e) { if (!Wa.perr) { Wa.perr = e; if (typeof console !== "undefined") console.error(e); } } return r; }; } return o; }; }

  /* ================= 3D ================= */
  function kit() { return Z.r3 && Z.r3.ready && Z.r3.kit; }
  var G3 = null, WU = { value: 0 }, DUM = null;
  // a small fish, built along +x (nose) with a forked tail, a dorsal fin, an eye, bars or spots; vertex-coloured
  function fishGeo(T, sp) {
    var pos = [], col = [], idx = [], N = 14, M = 10, cB = new T.Color(sp.back), cU = new T.Color(sp.belly), c = new T.Color(), snout = sp.snout || 0, i, j;
    function v(x, y, z, cc) { pos.push(x, y, z); col.push(cc.r, cc.g, cc.b); return pos.length / 3 - 1; }
    for (i = 0; i <= N; i++) { var u = i / N, x = -.5 + u, rr = Math.pow(Math.max(.1, Math.sin(Math.PI * Math.pow(u, 1.35))), .6) * (u > .97 ? .4 : 1), hh = sp.h * rr * (sp.hump ? 1 + .25 * Math.sin(Math.PI * u) : 1), ww = sp.w * rr * (sp.flat ? .7 + u * .6 : 1);
      for (j = 0; j < M; j++) { var th = j / M * TAU, cy = Math.cos(th), cz = Math.sin(th), t2 = (1 - cy) / 2; c.copy(cB).lerp(cU, sm((t2 - .25) / .5));
        if (sp.bars && t2 < .62 && Math.sin(u * Math.PI * sp.bars) > .55) c.multiplyScalar(.72);
        if (sp.spots && t2 < .7 && Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1) < sp.spots) c.multiplyScalar(.55);
        if (u > .8 && u < .9 && Math.abs(cy) < .35 && t2 > .3 && t2 < .62) c.setRGB(.05, .05, .06); // the eye
        v(x, cy * hh / 2 + (sp.flat ? -hh * .1 : 0), cz * ww / 2, c); } }
    for (i = 0; i < N; i++) for (j = 0; j < M; j++) { var a = i * M + j, b = i * M + (j + 1) % M, d = a + M, e = b + M; idx.push(a, d, b, b, d, e); }
    var fin = new T.Color(sp.back).multiplyScalar(.8), tip = new T.Color(sp.back).lerp(new T.Color(sp.belly), .3);
    var t0 = v(-.48, 0, 0, fin), t1 = v(-.5 - sp.tail, sp.h * .55, 0, tip), t2b = v(-.5 - sp.tail * .55, 0, 0, fin), t3 = v(-.5 - sp.tail, -sp.h * .55, 0, tip); idx.push(t0, t1, t2b, t0, t2b, t3);
    var d0 = v(-.25, sp.h * .4, 0, fin), d1 = v(.12, sp.h * .45, 0, fin), d2 = v(-.05, sp.h * (.4 + .4 * (sp.dorsal || .8)), 0, tip); idx.push(d0, d2, d1);
    if (sp.flat) { var q0 = v(-.45, sp.h * .3, 0, fin), q1 = v(.15, sp.h * .4, 0, fin), q2 = v(-.15, sp.h * .62, 0, tip); idx.push(q0, q2, q1); }
    if (sp.barbels) for (var bb = 0; bb < 4; bb++) { var by = (bb < 2 ? .02 : -.03), bz = (bb % 2 ? 1 : -1) * sp.w * .25, p0 = v(.47, by, bz, fin), p1 = v(.47, by + .015, bz, fin), p2 = v(.62 + bb * .03, by - .04, bz * 3, fin); idx.push(p0, p1, p2); }
    if (snout) { var s0 = v(.48, .015, 0, fin), s1 = v(.48, -.03, .012, fin), s2 = v(.5 + snout, -.06, 0, fin), s3 = v(.48, -.03, -.012, fin); idx.push(s0, s1, s2, s0, s2, s3); }
    var gm = new T.BufferGeometry(); gm.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); gm.setAttribute("color", new T.Float32BufferAttribute(col, 3)); gm.setIndex(idx); gm.computeVertexNormals(); return gm;
  }
  function wagMat(T, o) { // vertex-coloured Lambert whose tail swings (a shared clock in uT, phase from the instance position)
    var m = new T.MeshLambertMaterial(Object.assign({ vertexColors: true, side: T.DoubleSide }, o || {}));
    m.onBeforeCompile = function (sh) { sh.uniforms.uT = WU; sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat wph = 0.0;\n#ifdef USE_INSTANCING\nwph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;\n#endif\nfloat wb = clamp(0.3 - position.x, 0.0, 1.2);\ntransformed.z += sin(uT * 8.0 + wph - position.x * 5.0) * 0.12 * wb * wb;"); };
    m.customProgramCacheKey = function () { return "fslg-fish-wag"; }; return m;
  }
  function weedMat(T) {
    var m = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
    m.onBeforeCompile = function (sh) { sh.uniforms.uT = WU; sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat wph = 0.0;\n#ifdef USE_INSTANCING\nwph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.3;\n#endif\nfloat wh = position.y * position.y;\ntransformed.x += sin(uT * 1.3 + wph) * 0.18 * wh;\ntransformed.z += cos(uT * 1.1 + wph * 1.7) * 0.12 * wh;"); };
    m.customProgramCacheKey = function () { return "fslg-weed-sway"; }; return m;
  }
  function weedGeo(T) { var pos = [], col = [], c = new T.Color(); for (var s = 0; s < 4; s++) { var y0 = s / 4, y1 = (s + 1) / 4, w0 = .09 * (1 - y0 * .8), w1 = .09 * (1 - y1 * .8); c.setRGB(.16 + y0 * .18, .36 + y0 * .2, .14 + y0 * .05); var c2 = [c.r * 1.1, c.g * 1.1, c.b * 1.1]; [[-w0, y0], [w0, y0], [w1, y1], [-w0, y0], [w1, y1], [-w1, y1]].forEach(function (q, n) { pos.push(q[0], q[1], 0); col.push(n === 2 || n > 3 ? c2[0] : c.r, n === 2 || n > 3 ? c2[1] : c.g, n === 2 || n > 3 ? c2[2] : c.b); }); } for (var k = pos.length / 3 - 1, base = pos.slice(); k >= 0; k--) { pos.push(base[k * 3 + 2], base[k * 3 + 1], base[k * 3]); col.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]); } var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
  function ripplesTex(T) { // a tiling normal map of soft crossing ripples, for the sun to glint on
    var n = 128, cv = document.createElement("canvas"); cv.width = cv.height = n; var x = cv.getContext("2d"), im = x.createImageData(n, n), d = im.data, h = function (i, j) { var a = i / n * TAU, b = j / n * TAU; return Math.sin(a * 3 + Math.sin(b * 2) * 1.2) + Math.sin(b * 4 + a) * .6 + Math.sin((a + b) * 5) * .3; };
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) { var dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), k = (j * n + i) * 4, l = Math.hypot(dx, dy, 3); d[k] = (dx / l * .5 + .5) * 255; d[k + 1] = (dy / l * .5 + .5) * 255; d[k + 2] = (3 / l * .5 + .5) * 255; d[k + 3] = 255; }
    x.putImageData(im, 0, 0); var t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function gradTex(T, stops, w, h, horiz, soft) { var cv = document.createElement("canvas"); cv.width = w || 8; cv.height = h || 256; var x = cv.getContext("2d"), g = horiz ? x.createLinearGradient(0, 0, cv.width, 0) : x.createLinearGradient(0, 0, 0, cv.height); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
    if (soft) { var e = x.createLinearGradient(0, 0, cv.width, 0); e.addColorStop(0, "rgba(0,0,0,0)"); e.addColorStop(.5, "rgba(0,0,0,1)"); e.addColorStop(1, "rgba(0,0,0,0)"); x.globalCompositeOperation = "destination-in"; x.fillStyle = e; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = "source-over"; } /* soft side edges for light shafts */ var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; }
  // split the lake's outline into small triangles so colour and the bed can follow the depth
  function lakeTris(T, L, maxEdge) {
    var pts = []; for (var k = 0; k < L.p.length; k += 2) pts.push(new T.Vector2(L.p[k], L.p[k + 1])); if (T.ShapeUtils.isClockWise(pts)) pts.reverse();
    var tris = T.ShapeUtils.triangulateShape(pts, []), out = [];
    function split(a, b, c, n) { var ab = Math.hypot(a[0] - b[0], a[1] - b[1]), bc = Math.hypot(b[0] - c[0], b[1] - c[1]), ca = Math.hypot(c[0] - a[0], c[1] - a[1]), m = Math.max(ab, bc, ca); if (m < maxEdge || n > 9) { out.push(a, b, c); return; }
      if (m === ab) { var p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; split(a, p, c, n + 1); split(p, b, c, n + 1); } else if (m === bc) { var q = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]; split(a, b, q, n + 1); split(a, q, c, n + 1); } else { var r = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2]; split(a, b, r, n + 1); split(r, b, c, n + 1); } }
    tris.forEach(function (t) { split([pts[t[0]].x, pts[t[0]].y], [pts[t[1]].x, pts[t[1]].y], [pts[t[2]].x, pts[t[2]].y], 0); }); return out;
  }
  function build3(K) {
    var T = K.T, sc = K.scene, g = new T.Group(), own = []; G3 = Wa.g3 = { g: g, own: own, scene: sc, T: T, lakes: [], species: [] }; DUM = new T.Object3D();
    // the 3D view's own flat blue water is replaced by ours (depth-tinted, rippled); found by its look, never edited
    sc.traverse(function (o) { var m = o.material; if (o.isMesh && m && m.transparent && Math.abs(m.opacity - .92) < .001 && m.side === T.DoubleSide && m.color && m.color.getHex() === 0x3a8fd0) { o.visible = false; G3.hid = (G3.hid || []).concat([o]); } });
    var nmap = ripplesTex(T); G3.nmap = nmap; nmap.repeat.set(1, 1);
    var cShal = new T.Color(0x6f8a5a), cMid = new T.Color(0x2f6f6c), cDeep = G3.cDeep = new T.Color(0x1d4f5e), c = new T.Color(), mud0 = new T.Color(0x5b4a32), mud1 = new T.Color(0x2f3a28);
    lakes().forEach(function (L) {
      var tri = lakeTris(T, L, L.main ? 9 : 6), sp = [], scol = [], bp = [], bcol = [], uv = [];
      for (var ii = 0; ii < tri.length; ii++) { var i = ii - ii % 3 + [0, 2, 1][ii % 3], x = tri[i][0], y = tri[i][1], d = L.maxD * sm(edge(L, x, y) / L.ramp), f = d / L.maxD; c.copy(cShal).lerp(cMid, sm(d / 1.6)).lerp(cDeep, sm((d - 1.6) / (L.maxD - 1.6)));
        sp.push(x, SURF, y); scol.push(c.r, c.g, c.b, .62 + .36 * sm(d / 2.4)); uv.push(x / 3.5, y / 3.5);
        var n = Math.abs(Math.sin(x * .37 + y * .23) + Math.sin(x * .11 - y * .19)) * .25; c.copy(mud0).lerp(mud1, f).multiplyScalar(.85 + n); bp.push(x, -.03 - d, y); bcol.push(c.r, c.g, c.b); }
      var sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(sp, 3)); sg.setAttribute("color", new T.Float32BufferAttribute(scol, 4)); sg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); sg.computeVertexNormals(); own.push(sg);
      var sm2 = new T.MeshPhongMaterial({ vertexColors: true, transparent: true, side: T.DoubleSide, shininess: 26, specular: 0x2c3f47, normalMap: nmap, normalScale: new T.Vector2(.55, .55), polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }); own.push(sm2);
      var surf = new T.Mesh(sg, sm2); surf.renderOrder = 2; g.add(surf);
      var bg = new T.BufferGeometry(); bg.setAttribute("position", new T.Float32BufferAttribute(bp, 3)); bg.setAttribute("color", new T.Float32BufferAttribute(bcol, 3)); bg.computeVertexNormals(); own.push(bg);
      var bm = new T.MeshLambertMaterial({ vertexColors: true }); own.push(bm); var bed = new T.Mesh(bg, bm); g.add(bed);
      G3.lakes.push({ L: L, surf: surf, bed: bed });
    });
    var L0 = lakes()[0], r = S.rng(991);
    if (L0) { // weeds on the shelf and rocks on the slope
      var WG = weedGeo(T), wm = weedMat(T), nW = 340, weeds = new T.InstancedMesh(WG, wm, nW), wc = 0; own.push(WG, wm); weeds.frustumCulled = false;
      for (var t = 0; t < 4000 && wc < nW; t++) { var p = deepPoint(L0, r, .25), dd = Wa.depth(p.x, p.y); if (dd < .7 || dd > 3.6) continue; for (var cl = 0; cl < 4 && wc < nW; cl++) { var qx = p.x + (r() - .5) * 1.6, qy = p.y + (r() - .5) * 1.6, qd = Wa.depth(qx, qy); if (qd < .6) continue; var hgt = Math.min(qd - .35, .6 + r() * 1.6); DUM.position.set(qx, -.03 - qd, qy); DUM.rotation.set(0, r() * TAU, 0); DUM.scale.set(1, hgt, 1); DUM.updateMatrix(); weeds.setMatrixAt(wc++, DUM.matrix); } }
      weeds.count = wc; g.add(weeds);
      var RG = new T.IcosahedronGeometry(1, 0), rm = new T.MeshLambertMaterial({ color: 0x6d6a5c, flatShading: true }), nR = 90, rocks = new T.InstancedMesh(RG, rm, nR), rcol = new T.Color(); own.push(RG, rm); rocks.frustumCulled = false;
      for (var k2 = 0; k2 < nR; k2++) { var rp = deepPoint(L0, r, .4), rd = Wa.depth(rp.x, rp.y), rs = .3 + r() * (rd > 3 ? 1.3 : .7); DUM.position.set(rp.x, -.03 - rd + rs * .2, rp.y); DUM.rotation.set(r() * 3, r() * 3, r() * 3); DUM.scale.set(rs, rs * (.5 + r() * .4), rs * (.8 + r() * .4)); DUM.updateMatrix(); rocks.setMatrixAt(k2, DUM.matrix); rocks.setColorAt(k2, rcol.setHSL(.1 + r() * .05, .12, .25 + r() * .15)); }
      g.add(rocks);
    }
    // fish: one instanced mesh per species, plus their shadows seen from the bank
    var byS = {}; Wa.fish.forEach(function (f) { (byS[f.sp.id] = byS[f.sp.id] || []).push(f); });
    Wa.SPECIES.forEach(function (spc) { var list = byS[spc.id] || []; if (!list.length) return; var geo = G3.fishGeo && G3.fishGeo[spc.id] || (G3.fishGeo = G3.fishGeo || {}, G3.fishGeo[spc.id] = fishGeo(T, spc)), m = G3.fishMat || (G3.fishMat = wagMat(T)), im = new T.InstancedMesh(geo, m, list.length); im.frustumCulled = false; g.add(im); G3.species.push({ im: im, list: list }); own.push(geo); });
    own.push(G3.fishMat);
    var sh = new T.Shape(); sh.moveTo(.5, 0); sh.bezierCurveTo(.4, .22, -.1, .24, -.42, .06); sh.lineTo(-.62, .2); sh.lineTo(-.56, 0); sh.lineTo(-.62, -.2); sh.lineTo(-.42, -.06); sh.bezierCurveTo(-.1, -.24, .4, -.22, .5, 0);
    var shg = new T.ShapeGeometry(sh, 6); shg.rotateX(-HP); var shm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 }); own.push(shg, shm);
    G3.shad = new T.InstancedMesh(shg, shm, Math.max(1, Wa.fish.length)); G3.shad.frustumCulled = false; G3.shad.renderOrder = 3; g.add(G3.shad);
    // rings on the surface (additive: a colour fading to black is a ring fading away)
    var rg = new T.RingGeometry(.86, 1, 40); rg.rotateX(-HP); var rgm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 }); own.push(rg, rgm);
    G3.rings = new T.InstancedMesh(rg, rgm, 42); G3.rings.frustumCulled = false; G3.rings.renderOrder = 4; g.add(G3.rings);
    var bgeo = new T.SphereGeometry(1, 6, 5), bmat = new T.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: .55, depthWrite: false }); own.push(bgeo, bmat); G3.bub = new T.InstancedMesh(bgeo, bmat, 32); G3.bub.frustumCulled = false; g.add(G3.bub);
    // ducks and egrets
    G3.duck = birdMesh(T, own, "duck", Wa.ducks.length || 1); g.add(G3.duck); G3.egret = birdMesh(T, own, "egret", Math.max(1, (Wa.egrets || []).length)); g.add(G3.egret);
    // the visitor-centre waterfront: steps into the water, the board, the lifeguard's chair, buoys and the finish
    var st = Wa.site(); if (st) waterfront(T, K, g, own, st);
    // light shafts and specks, shown only when the camera is under water
    var shaftT = gradTex(T, [[0, "rgba(255,255,240,.9)"], [.5, "rgba(220,255,240,.35)"], [1, "rgba(200,255,240,0)"]], 64, 256, false, true), shaftM = new T.MeshBasicMaterial({ map: shaftT, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }), shaftG = new T.PlaneGeometry(2.6, 12); shaftG.translate(0, -6, 0); own.push(shaftT, shaftM, shaftG);
    G3.shafts = new T.Group(); for (var s2 = 0; s2 < 9; s2++) { var m2 = new T.Mesh(shaftG, shaftM); m2.position.set((r() - .5) * 18, SURF - .05, (r() - .5) * 18); m2.rotation.set(.32, r() * TAU, .12); G3.shafts.add(m2); } G3.shafts.visible = false; g.add(G3.shafts);
    sc.add(g);
  }
  function birdMesh(T, own, kind, n) {
    var parts = [], P = [], N = [], C = [], c = new T.Color();
    function add(geo, col, x, y, z, sx, sy, sz, rz) { geo.scale(sx || 1, sy || 1, sz || 1); if (rz) geo.rotateZ(rz); geo.translate(x, y, z); var g2 = geo.index ? geo.toNonIndexed() : geo; g2.computeVertexNormals(); var p = g2.attributes.position, nn = g2.attributes.normal; c.setHex(col); for (var i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); C.push(c.r, c.g, c.b); } parts.push(g2); }
    if (kind === "duck") { add(new T.SphereGeometry(.2, 10, 8), 0x7a4a2a, 0, .06, 0, 1.5, .75, 1); add(new T.SphereGeometry(.16, 8, 6), 0x2a2420, -.05, .12, 0, 1.2, .5, 1.05); add(new T.CylinderGeometry(.045, .06, .18, 8), 0x1d1a18, .22, .2, 0); add(new T.SphereGeometry(.075, 8, 6), 0xf5f1e6, .27, .31, 0); add(new T.SphereGeometry(.05, 6, 5), 0x1d1a18, .29, .3, 0, 1, .9, 1.2); add(new T.ConeGeometry(.025, .09, 6), 0x2b2b30, .37, .3, 0, 1, 1, 1, -HP); }
    else { add(new T.SphereGeometry(.2, 10, 8), 0xf8fafc, 0, .95, 0, 1.4, .8, .8, .3); add(new T.CylinderGeometry(.035, .04, .42, 6), 0xf1f5f9, .2, 1.22, 0, 1, 1, 1, -.4); add(new T.SphereGeometry(.07, 8, 6), 0xf8fafc, .3, 1.42, 0); add(new T.ConeGeometry(.025, .2, 6), 0xf59e0b, .42, 1.42, 0, 1, 1, 1, -HP); add(new T.CylinderGeometry(.015, .015, .9, 5), 0x1f2937, -.03, .45, .05); add(new T.CylinderGeometry(.015, .015, .9, 5), 0x1f2937, .03, .45, -.05); }
    var geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(P, 3)); geo.setAttribute("normal", new T.Float32BufferAttribute(N, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(C, 3)); parts.forEach(function (q) { q.dispose(); });
    var m = new T.MeshLambertMaterial({ vertexColors: true }), im = new T.InstancedMesh(geo, m, n); im.frustumCulled = false; own.push(geo, m); return im;
  }
  function waterfront(T, K, g, own, st) {
    var e = st.edge, mat = function (col) { var m = new T.MeshLambertMaterial({ color: col }); own.push(m); return m; }, box = function (w, h, d, col, x, y, z, ry) { var b = new T.BoxGeometry(w, h, d); own.push(b); var m = new T.Mesh(b, mat(col)); m.position.set(x, y, z); if (ry) m.rotation.y = ry; g.add(m); return m; };
    // stone steps from the bank down under the water, with rails
    for (var i = 0; i < 7; i++) { var y0 = .45 - i * .3, z0 = e.y - 3 + i * 1.05; box(6.2, Math.max(.3, y0 + 1.6), 1.05, i % 2 ? 0xb8b2a4 : 0xc6c0b2, e.x, y0 - Math.max(.3, y0 + 1.6) / 2, z0 + .52); }
    box(7.4, .5, 3.4, 0xd6d0c2, e.x, .2, e.y - 4.6); [-1, 1].forEach(function (sd) { box(.07, .07, 7.6, 0xe5e7eb, e.x + sd * 3.05, .55, e.y + .4).rotation.x = .26; for (var p = 0; p < 4; p++) box(.07, 1.05, .07, 0x9ca3af, e.x + sd * 3.05, .45 - p * .5 + .1, e.y - 2.6 + p * 2.3); });
    // the start board
    var bd = new T.Group(); bd.position.set(st.board.x, 0, st.board.y); g.add(bd); K.part(bd, .14, 2.4, .14, 0x334155, -1.1, 1.2, 0); K.part(bd, .14, 2.4, .14, 0x334155, 1.1, 1.2, 0);
    var cv = document.createElement("canvas"); cv.width = 512; cv.height = 300; var x = cv.getContext("2d"); x.fillStyle = "#0f766e"; x.fillRect(0, 0, 512, 300); x.fillStyle = "#f97316"; x.fillRect(0, 0, 512, 54); x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "900 40px system-ui, sans-serif"; x.fillText("BUOY SWIM", 256, 42); x.font = "700 30px system-ui, sans-serif"; x.fillText("Round buoys 1 · 2 · 3", 256, 112); x.fillText("then back to the steps", 256, 152); x.font = "600 24px system-ui, sans-serif"; x.fillStyle = "#ccfbf1"; x.fillText("Swim only when the lifeguard is here", 256, 214); x.fillText("Press E here to start", 256, 254);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; var pm = new T.MeshBasicMaterial({ map: tx }), pg = new T.PlaneGeometry(2.4, 1.4); own.push(tx, pm, pg); var pl = new T.Mesh(pg, pm); pl.position.set(0, 1.9, .09); pl.rotation.y = 0; bd.add(pl); var pl2 = pl.clone(); pl2.rotation.y = Math.PI; pl2.position.z = -.09; bd.add(pl2); K.part(bd, 2.56, 1.56, .12, 0x1f2937, 0, 1.9, 0);
    // the lifeguard's chair and its umbrella
    var ch = new T.Group(); ch.position.set(st.chair.x, 0, st.chair.y); g.add(ch); [[-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45]].forEach(function (q) { K.part(ch, .1, 1.9, .1, 0xf8fafc, q[0], .95, q[1]); }); K.part(ch, 1, .1, 1, 0xf8fafc, 0, 1.9, 0); K.part(ch, 1, .9, .1, 0xf8fafc, 0, 2.35, -.45); K.part(ch, .9, .1, .2, 0xdc2626, 0, 1.2, .55);
    var ug = new T.ConeGeometry(1.5, .6, 10), um = mat(0xdc2626); own.push(ug); var umb = new T.Mesh(ug, um); umb.position.set(0, 3.6, 0); ch.add(umb); K.part(ch, .05, 1.5, .05, 0xe5e7eb, 0, 2.9, 0); K.plate(ch, "LIFEGUARD", 1.2, .3, 0, 1.55, .58, "#dc2626", "#ffffff");
    // buoys: orange floats with a white band and a little flag; the finish is a floating platform by the steps
    var bgeo = new T.SphereGeometry(.55, 14, 10), bm = mat(0xf97316), bwg = new T.CylinderGeometry(.57, .57, .14, 14), bwm = mat(0xffffff); own.push(bgeo, bwg); G3.buoys = [];
    st.gates.forEach(function (gt, n) { if (gt.finish) return; var b = new T.Group(); b.position.set(gt.x, SURF, gt.y); g.add(b); b.add(new T.Mesh(bgeo, bm)); var w = new T.Mesh(bwg, bwm); w.position.y = .1; b.add(w); K.part(b, .05, 1.3, .05, 0x111827, 0, .9, 0); K.plate(b, String(n + 1), .5, .4, .27, 1.3, 0, "#f97316", "#ffffff"); G3.buoys.push(b); });
    var pon = new T.Group(); pon.position.set(st.gates[st.gates.length - 1].x + 4.6, SURF, st.gates[st.gates.length - 1].y); g.add(pon); K.part(pon, 2.4, .3, 3.4, 0x9a6b3f, 0, .05, 0); K.part(pon, 2.6, .35, .3, 0x1f2937, 0, -.08, 1.7); K.plate(pon, "FINISH", 1.6, .4, 0, .9, 0, "#0f766e", "#ffffff"); K.part(pon, .06, .9, .06, 0x1f2937, -.7, .45, 0); K.part(pon, .06, .9, .06, 0x1f2937, .7, .45, 0);
    // signs: the shallow shelf to the west, deep water beyond the rope, the rules
    function sign(x, y, ry, t1, t2, bg) { var sg = new T.Group(); sg.position.set(x, 0, y); sg.rotation.y = ry; g.add(sg); K.part(sg, .1, 1.7, .1, 0x334155, 0, .85, 0); K.plate(sg, t1, 1.9, .42, 0, 1.9, 0, bg, "#ffffff"); if (t2) K.plate(sg, t2, 1.9, .34, 0, 1.44, 0, "#f8fafc", "#0f172a"); return sg; }
    sign(e.x - 15, e.y - 1.2, 0, "SHALLOW 0–1 m", "wading · children here", "#0ea5e9"); sign(e.x + 13, e.y - 1, 0, "DEEP WATER", "swim inside the buoys", "#dc2626"); sign(e.x - 4.6, e.y - 6.2, 0, "SWIM WITH THE LIFEGUARD", "never alone · 07:00–19:00", "#0f766e");
    // a life ring on its post, and a canoe pulled up on the bank
    var lr = new T.Group(); lr.position.set(e.x + 4.4, 0, e.y - 4.4); g.add(lr); K.part(lr, .12, 1.6, .12, 0x7c5a3a, 0, .8, 0); var tg = new T.TorusGeometry(.32, .08, 8, 18), tm = mat(0xf97316); own.push(tg); var tor = new T.Mesh(tg, tm); tor.position.set(0, 1.25, .1); lr.add(tor); for (var wi = 0; wi < 4; wi++) K.part(lr, .1, .17, .17, 0xffffff, Math.cos(wi * HP) * .32, 1.25 + Math.sin(wi * HP) * .32, .1);
    var cn = new T.Group(); cn.position.set(e.x - 9, .08, e.y - 3); cn.rotation.y = .4; g.add(cn); var hg = new T.CylinderGeometry(.42, .42, 4.4, 12, 1, false, 0, Math.PI), hm = mat(0x9a3412); hm.side = T.DoubleSide; own.push(hg); var hull = new T.Mesh(hg, hm); hull.rotation.set(0, 0, HP); hull.rotation.x = Math.PI; hull.position.y = .42; hull.scale.set(1, 1, .8); cn.add(hull); K.part(cn, 4, .05, .1, 0xfde68a, 0, .43, .33); K.part(cn, 4, .05, .1, 0xfde68a, 0, .43, -.33); K.part(cn, .08, .05, 1.6, 0x7c5a3a, .9, .5, .4);
    // the diving spot: a springboard and a ladder at the end of the pier
    var pe = Wa.pierEnd(); if (pe) { var dg = new T.Group(); dg.position.set(pe.x, .66, pe.y); dg.rotation.y = -pe.a; g.add(dg); K.part(dg, .6, .5, .6, 0x475569, 0, .25, 0); K.part(dg, 3.2, .08, .55, 0x2563eb, 1.5, .55, 0); K.part(dg, .5, .02, .5, 0xe2e8f0, 2.8, .6, 0);
      [-1, 1].forEach(function (sd) { K.part(dg, .06, 2.2, .06, 0xd1d5db, -1.2, -.4, sd * .35); for (var rg2 = 0; rg2 < 4; rg2++) K.part(dg, .06, .06, .7, 0xd1d5db, -1.2, -1.2 + rg2 * .5, 0); });
      var ds = new T.Group(); ds.position.set(pe.x + Math.cos(pe.a + HP) * 2.4 - Math.cos(pe.a) * 1.5, .66, pe.y + Math.sin(pe.a + HP) * 2.4 - Math.sin(pe.a) * 1.5); ds.rotation.y = -pe.a + HP; g.add(ds); K.part(ds, .1, 2.4, .1, 0x334155, 0, 1.2, 0); K.plate(ds, "DIVING", 1.4, .4, 0, 2.3, 0, "#1d4ed8", "#ffffff"); K.plate(ds, "deep water · feet first", 1.6, .3, 0, 1.86, 0, "#f8fafc", "#0f172a"); }
    // reeds along the shallow margins of the lake, swaying with the weeds' shader
    var L0r = lakes()[0]; if (L0r) { var rgeo = weedGeo(T), rmat = weedMat(T), nRd = 260, reeds = new T.InstancedMesh(rgeo, rmat, nRd), rc = 0, rr2 = S.rng(313); own.push(rgeo, rmat); reeds.frustumCulled = false;
      for (var tr = 0; tr < 3000 && rc < nRd; tr++) { var vi = Math.floor(rr2() * L0r.p.length / 2) * 2, ax = L0r.p[vi], ay = L0r.p[vi + 1], bi = (vi + 2) % L0r.p.length, f2 = rr2(), px = ax + (L0r.p[bi] - ax) * f2, py = ay + (L0r.p[bi + 1] - ay) * f2, vl = Math.hypot(L0r.cx - px, L0r.cy - py) || 1, inn = .4 + rr2() * 2.2; px += (L0r.cx - px) / vl * inn; py += (L0r.cy - py) / vl * inn;
        if (Math.hypot(px - e.x, py - e.y) < 24 || (pe && Math.hypot(px - pe.x, py - pe.y) < 50)) continue; var dp = Wa.depth(px, py); if (dp > .55) continue; for (var cl = 0; cl < 5 && rc < nRd; cl++) { DUM.position.set(px + (rr2() - .5) * 1.2, -.03 - dp, py + (rr2() - .5) * 1.2); DUM.rotation.set(0, rr2() * TAU, 0); DUM.scale.set(1.6, dp + 1 + rr2() * 1.1, 1.6); DUM.updateMatrix(); reeds.setMatrixAt(rc++, DUM.matrix); } }
      reeds.count = rc; g.add(reeds); }
    // a rope line of small floats marking the swimming area in front of the steps
    var fg = new T.SphereGeometry(.16, 8, 6), fm = mat(0xfacc15); own.push(fg); var fl = new T.InstancedMesh(fg, fm, 40); fl.frustumCulled = false; for (var f = 0; f < 40; f++) { var a = f / 39 * Math.PI, rx = e.x + Math.cos(a) * 16, ry = e.y + 2 + Math.sin(a) * 12; DUM.position.set(rx, SURF + .02, ry); DUM.rotation.set(0, 0, 0); DUM.scale.set(1, .7, 1); DUM.updateMatrix(); fl.setMatrixAt(f, DUM.matrix); } g.add(fl);
  }
  var col0 = null;
  function step3(dt) {
    var K = kit(); if (!K) return; if (!G3 || G3.scene !== K.scene) { if (Wa.fishOK !== Z.W) Wa.initFish(); build3(K); } var T = K.T, me = Z.me, t = (Z.api && Z.api.t) || 0, i, n;
    WU.value = t; if (G3.nmap) { G3.nmap.offset.set((t * .015) % 1, (t * .009) % 1); }
    var life = opt("damLife", true), near = nearLake(), under = !!Wa.camUnder, wy = Math.sin(t * .8) * .03; Wa.wavY = wy;
    G3.lakes.forEach(function (q) { q.surf.position.y = wy; });
    // fish
    var show = life && (near || under); if (!col0) col0 = new T.Color();
    G3.species.forEach(function (S2) { S2.im.visible = show; if (!show) return; for (var k = 0; k < S2.list.length; k++) { var f = S2.list[k], j = f.jump, y = SURF - f.d, pitch = 0;
        if (j) { var u = j.t / j.dur; y = SURF + Math.sin(u * Math.PI) * j.h - .1; pitch = (1 - u * 2) * 1.1; }
        DUM.position.set(f.x, y, f.y); DUM.rotation.set(f.up ? Math.PI : 0, -f.a, pitch, "YXZ"); if (j) DUM.rotation.set(0, -f.a, pitch, "YXZ"); DUM.scale.setScalar(f.s); DUM.updateMatrix(); S2.im.setMatrixAt(k, DUM.matrix); }
      S2.im.instanceMatrix.needsUpdate = true; });
    G3.shad.visible = show && !under; if (G3.shad.visible) { n = 0; for (i = 0; i < Wa.fish.length; i++) { var fi = Wa.fish[i]; if (fi.jump) continue; var fade = clamp((fi.d - .2) / 2.4, 0, 1); DUM.position.set(fi.x, SURF + .05 + wy, fi.y); DUM.rotation.set(0, -fi.a, 0); DUM.scale.set(fi.s * (2.1 + fade * .5), 1, fi.s * (2.1 + fade * .5)); DUM.updateMatrix(); G3.shad.setMatrixAt(n, DUM.matrix); G3.shad.setColorAt(n, col0.setRGB(.03, .09, .1).lerp(G3.cDeep, fade * .75)); n++; } G3.shad.count = n; G3.shad.instanceMatrix.needsUpdate = true; if (G3.shad.instanceColor) G3.shad.instanceColor.needsUpdate = true; }
    // rings
    n = 0; for (i = 0; i < Wa.rings.length && n < 42; i++) { var rg = Wa.rings[i], u2 = rg.t / 1.6, rad = rg.s * (.3 + u2 * 1.6); DUM.position.set(rg.x, SURF + .06 + wy, rg.y); DUM.rotation.set(0, 0, 0); DUM.scale.set(rad, 1, rad); DUM.updateMatrix(); G3.rings.setMatrixAt(n, DUM.matrix); var al = rg.p * (1 - u2) * (1 - u2) * (under ? .4 : .75); G3.rings.setColorAt(n, col0.setRGB(al, al, al)); n++; }
    G3.rings.count = n; G3.rings.instanceMatrix.needsUpdate = true; if (G3.rings.instanceColor) G3.rings.instanceColor.needsUpdate = true;
    n = 0; for (i = 0; i < bubbles.length; i++) { var b = bubbles[i]; DUM.position.set(b.x, b.h, b.y); DUM.rotation.set(0, 0, 0); DUM.scale.setScalar(b.s); DUM.updateMatrix(); G3.bub.setMatrixAt(n++, DUM.matrix); } G3.bub.count = n; G3.bub.instanceMatrix.needsUpdate = true;
    // birds
    G3.duck.visible = life && near; if (G3.duck.visible) { Wa.ducks.forEach(function (dk, k) { var dip = dk.dip > 0 ? Math.sin(Math.min(1, dk.dip / 1.4) * Math.PI) : 0; DUM.position.set(dk.x, SURF + wy + Math.sin(dk.ph * 1.7) * .02 - .05, dk.y); DUM.rotation.set(0, -dk.a, -dip * 1.1, "YXZ"); DUM.scale.setScalar(dk.s * 1.2); DUM.updateMatrix(); G3.duck.setMatrixAt(k, DUM.matrix); }); G3.duck.count = Wa.ducks.length; G3.duck.instanceMatrix.needsUpdate = true; }
    G3.egret.visible = life && near && (Wa.egrets || []).length > 0; if (G3.egret.visible) { Wa.egrets.forEach(function (eg, k) { DUM.position.set(eg.x, -.25, eg.y); DUM.rotation.set(0, -eg.a + Math.sin(eg.t * .4) * .5, 0); DUM.scale.setScalar(1.1); DUM.updateMatrix(); G3.egret.setMatrixAt(k, DUM.matrix); }); G3.egret.count = Wa.egrets.length; G3.egret.instanceMatrix.needsUpdate = true; }
    (G3.buoys || []).forEach(function (bo, k) { bo.position.y = SURF - .12 + Math.sin(t * 1.4 + k) * .06; bo.rotation.z = Math.sin(t * 1.1 + k * 2) * .08; var h = Wa.cur, nx = h && (h.state === "run" || h.state === "count") && h.gate === k; bo.scale.setScalar(nx ? 1.25 + Math.sin(t * 6) * .08 : 1); });
    G3.shafts.visible = under; if (under) { G3.shafts.position.set(me.x, 0, me.y); G3.shafts.children.forEach(function (m, k) { m.material.opacity = .13 + Math.sin(t * .5 + k) * .04; m.rotation.y += dt * .02; }); }
    G3.lakes.forEach(function (q) { q.bed.visible = true; });
    void dt;
  }

  /* ================= the Dam Visitor Centre: an aquarium gallery (samaru-interior.js rooms) ================= */
  Wa.PANELS = {
    purpose: { title: "Why this dam is here", sub: "Water for the dry season", html:
      "<p>Northern Nigeria has one long rainy season and a longer dry one. A dam holds back a river in the rains so the water can be used all year.</p>" +
      "<ul><li><b>Drinking water.</b> After treatment it is piped to halls, offices and homes. In Zaria, the university and the city both draw their water from reservoirs on local rivers.</li>" +
      "<li><b>Farming.</b> Water let out downstream irrigates dry-season crops and research plots.</li><li><b>Fishing.</b> The reservoir is a fishery: tilapia and catfish feed families and traders.</li>" +
      "<li><b>Floods.</b> Holding back the first storms of the rains protects the land downstream.</li><li><b>Learning.</b> Engineers, ecologists and agricultural students study here.</li></ul>" +
      "<p class='gm-small'>The Dam in this game is a made-up reservoir, inspired by the one on the Kubanni River that serves Ahmadu Bello University's Samaru campus. Figures are left out on purpose: the real ones change with every rainy season.</p>" },
    dam: { title: "How a dam and its spillway work", sub: "Wall, intake, spillway, outlet", html:
      "<p>A dam is a barrier across a river valley. Many in Nigeria are <b>embankment dams</b>: a bank of compacted earth and rock with a watertight clay core, faced with stone (riprap) so waves cannot wash it away. Others are built of concrete.</p>" +
      "<ul><li><b>Reservoir.</b> The lake that builds up behind the wall.</li><li><b>Intake tower.</b> Draws water from the depth where it is cleanest, through screens that keep out fish and weeds.</li>" +
      "<li><b>Spillway.</b> A channel that carries surplus water safely around or over the dam when the reservoir is full, so water never pours over the top of the embankment, which could wash it away.</li>" +
      "<li><b>Outlet works.</b> Valves and pipes that release water downstream on purpose: to farms, to the treatment works, and to keep the river alive.</li>" +
      "<li><b>Watching it.</b> Engineers check the water level, seepage through the bank and any movement of the wall all year.</li></ul>" },
    treat: { title: "From reservoir to tap", sub: "How the water is made safe", html:
      "<ol><li><b>Screening.</b> Bars and mesh catch leaves, fish and rubbish at the intake.</li><li><b>Aeration.</b> Mixing in air drives off smells and helps remove iron.</li>" +
      "<li><b>Coagulation and flocculation.</b> Alum is added and stirred gently: tiny particles clump into flakes called floc.</li><li><b>Sedimentation.</b> In big still tanks the floc settles out.</li>" +
      "<li><b>Filtration.</b> The water runs down through beds of sand and gravel.</li><li><b>Disinfection.</b> Chlorine kills the germs that are left, and a little stays in the pipes to keep it safe.</li>" +
      "<li><b>Storage and supply.</b> Pumped to tanks and water towers, then down to taps by gravity.</li></ol>" +
      "<p class='gm-small'>Reservoir water is never safe to drink straight from the lake. Boil or treat water when you are not sure.</p>" },
    safety: { title: "Safety by the water", sub: "Read this before you swim", html:
      "<ul><li><b>Never swim alone.</b> Swim where a lifeguard can see you.</li><li><b>Stay away from the spillway and the intake.</b> Moving water there can pull a strong swimmer under.</li>" +
      "<li><b>It gets deep fast.</b> Reservoirs shelve steeply, the water is murky and colder below, and weeds can tangle legs.</li><li><b>Never dive into water you cannot see into.</b></li>" +
      "<li><b>Tired or cramped?</b> Roll on your back, float, breathe, and raise one arm.</li><li><b>Reach or throw, don't go.</b> Help someone in trouble with a pole, a rope or anything that floats, and shout for help.</li>" +
      "<li><b>Health.</b> Still fresh water in much of Nigeria can carry bilharzia (schistosomiasis). In real life, swim only in pools or where the authorities say the water is safe.</li></ul>" +
      "<p class='gm-small'>In this game the water cannot hurt you: run out of breath and you simply come back up.</p>" },
    fish: { title: "Fish of the reservoir", sub: "Who lives behind the glass" },
    swim: { title: "Buoy swim records", sub: "The board by the steps" }
  };
  function fishHtml() { return "<p>These live in reservoirs and rivers across northern Nigeria. Look for them through the window.</p>" + Wa.SPECIES.map(function (s) { return "<p><b>" + esc(s.name) + "</b> <i>(" + esc(s.sci) + ")</i>" + (s.ha ? " · Hausa: <i>" + esc(s.ha) + "</i>" : "") + "<br>" + s.facts.map(esc).join(" ") + "</p>"; }).join(""); }
  function swimHtml() { var P = Z.P || {}, st = P.stats || {}; return "<p>Start at the board by the steps outside. Swim round buoys 1, 2 and 3 in order, then back to the steps. The clock runs from the whistle.</p><p><b>Your best: " + (st.swimBest ? fmt(st.swimBest) : "no time yet") + "</b>" + (st.swimN ? " · swims finished: " + st.swimN : "") + "</p><p class='gm-small'>Swimming races between friends will start from this board too.</p>"; }
  Wa.panel = function (id) {
    var p = Wa.PANELS[id], A = api(); if (!p || !A) return false; var body = id === "fish" ? fishHtml() : id === "swim" ? swimHtml() : p.html;
    A.show("<h2>" + esc(p.title) + "</h2><div style='text-align:left;max-width:640px;margin:0 auto;font-size:clamp(14px,3.8vw,16px);line-height:1.45'>" + body + "</div><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Close</button></div>", function () { A.hide(); });
    if (Z.P) { Z.P.flags["dc_" + id] = 1; var all = ["purpose", "dam", "treat", "safety", "fish"].every(function (k) { return Z.P.flags["dc_" + k]; }); if (all && !Z.P.flags.dc_all) { Z.P.flags.dc_all = 1; if (Z.xp) Z.xp(80); say("<b>You read every panel.</b> +80 XP. Engineers call that due diligence."); } }
    snd("click"); return true;
  };
  var I = Z.interior;
  if (I && I.kit) (function () {
    var K = I.kit, room = K.room, spot = K.spot, person = K.person;
    var oType = I.typeOf; I.typeOf = function (pl) { if (pl && pl.id === "damcentre" && I.on) return "aquarium"; return oType.apply(I, arguments); };
    var TANK = 14.6, RW = 24, RD = 23, RH = 7;
    K.ROOMS.aquarium = function (pl) {
      var r = room(RW, RD, RH, { floor: 0x37474f, wall: 0x2b3b45, trim: 0x0f766e }); r.rects = [{ x0: -RW / 2, y0: 0, x1: RW / 2, y1: TANK - .45 }]; r.tank = TANK;
      // benches facing the glass, the reception desk, the panels and the fish kiosk
      r.solids.push({ x0: -6.3, y0: TANK - 4.1, x1: -1.7, y1: TANK - 3.4 }, { x0: 1.7, y0: TANK - 4.1, x1: 6.3, y1: TANK - 3.4 }, { x0: 6.6, y0: 1.5, x1: 10.4, y1: 2.5 }, { x0: -.6, y0: TANK - 1.75, x1: .6, y1: TANK - 1.05 });
      spot(r, "seat", -4, TANK - 4.6, "Sit and watch the fish", { free: { x: -4, y: TANK - 3.75, h: .15, a: HP }, r: 1.3 }); spot(r, "seat", 4, TANK - 4.6, "Sit and watch the fish", { free: { x: 4, y: TANK - 3.75, h: .15, a: HP }, r: 1.3 });
      [["purpose", -1, 4], ["dam", -1, 9.2], ["treat", 1, 4], ["safety", 1, 9.2]].forEach(function (q) { spot(r, "panel", q[1] * (RW / 2 - 1.3), q[2], "Read: " + Wa.PANELS[q[0]].title, { r: 1.6, pid: q[0], use: function () { Wa.panel(q[0]); } }); });
      spot(r, "panel", 0, TANK - 2.45, "Read: " + Wa.PANELS.fish.title, { r: 1.5, pid: "fish", use: function () { Wa.panel("fish"); } });
      spot(r, "panel", -8.4, 1.9, "Read: Buoy swim records", { r: 1.5, pid: "swim", use: function () { Wa.panel("swim"); } });
      spot(r, "guide", 8.5, 3.4, "Talk to the guide", { r: 1.6, use: function () { var L2 = ["“The window looks straight into the reservoir. The big silver one is a Nile perch.”", "“The catfish stay on the bottom. They can breathe air, you know.”", "“The concrete on the left is the dam wall and its water intake.”", "“Read the safety panel before you swim. Then go and beat the record.”"]; say("<b>Guide:</b> " + L2[Math.floor(wr() * L2.length)]); } });
      r.staffP = person(r, 8.5, 2.9 + 1.4, -HP, 717, { look: { top: "#0f766e", hair: "hijab", hairCol: "#0f766e", mode: "tee" }, opt: { scale: 1.08 } }); r.staffAt = { x: 8.5, y: 4.3, a: -HP };
      for (var k = 0; k < 4; k++) r.crowd.push({ x: -9 + k * 5.6 + (k > 1 ? 1.2 : 0), y: TANK - 1.2, h: .9, a: HP + (k % 2 ? .2 : -.15), seed: 900 + k * 7, stand: 1, idle: "talk" });
      r.draw3 = drawAquarium; r.step3 = stepAquarium;
      return r;
    };
    function drawAquarium(o) {
      var T = o.T, g = o.g, c = o.c, own = o.own, part = o.part, r = c.room, w = r.w, d = r.d, h = r.h, zT = TANK, rr = S.rng(4401);
      g.traverse(function (q) { if (q.isPointLight) q.intensity *= .45; if (q.isAmbientLight) q.intensity = .32; }); // a dim gallery so the tank glows
      // benches, desk, kiosk
      [-4, 4].forEach(function (bx) { part(g, 4.4, .12, .62, 0x7c5a3a, bx, .46, zT - 3.75); part(g, .2, .4, .5, 0x334155, bx - 1.9, .22, zT - 3.75); part(g, .2, .4, .5, 0x334155, bx + 1.9, .22, zT - 3.75); });
      part(g, 3.8, 1.05, 1, 0x0f766e, 8.5, .52, 2); part(g, 4, .08, 1.2, 0xe2e8f0, 8.5, 1.08, 2);
      part(g, 1.1, .9, .6, 0x1f2937, 0, .45, zT - 1.4); var kiosk = o.canvasPlate(1.1, .62, function (x, W2, H2) { x.fillStyle = "#082f33"; x.fillRect(0, 0, W2, H2); x.fillStyle = "#5eead4"; x.font = "800 44px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("FISH OF THE", W2 / 2, 70); x.fillText("RESERVOIR", W2 / 2, 120); x.fillStyle = "#e2e8f0"; x.font = "600 30px system-ui, sans-serif"; x.fillText("Press E to read", W2 / 2, 200); }, 512); kiosk.position.set(0, 1.12, zT - 1.72); kiosk.rotation.x = -.55; kiosk.rotation.y = Math.PI; g.add(kiosk);
      // the panels on the side walls
      [["purpose", -1, 4], ["dam", -1, 9.2], ["treat", 1, 4], ["safety", 1, 9.2], ["swim", 0, 0]].forEach(function (q) {
        var id = q[0], P0 = Wa.PANELS[id], pw = id === "swim" ? 2.2 : 3.6, ph = id === "swim" ? 1.4 : 2.3, pnl = o.canvasPlate(pw, ph, function (x, W2, H2) { paintPanel(x, W2, H2, id, P0); }, 1024);
        if (id === "swim") { pnl.position.set(-8.4, 2, .2); pnl.rotation.y = Math.PI; } else { pnl.position.set(q[1] * (w / 2 - .2), 2.25, q[2]); pnl.rotation.y = q[1] < 0 ? HP : -HP; } g.add(pnl); });
      var sign = o.canvasPlate(9, .9, function (x, W2, H2) { x.fillStyle = "#06272b"; x.fillRect(0, 0, W2, H2); x.fillStyle = "#99f6e4"; x.font = "900 60px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("THE DAM · UNDER THE SURFACE", W2 / 2, 66); }, 1024); sign.position.set(0, h - .75, zT - .32); sign.rotation.y = Math.PI; g.add(sign);
      // the glass wall: sill, header, mullions, a faint tint and reflections
      part(g, w, .75, .5, 0x1f2937, 0, .37, zT - .1); part(g, w, .5, .5, 0x1f2937, 0, h - .25, zT - .1); for (var mI = -2; mI <= 2; mI++) part(g, .16, h, .3, 0x111827, mI * 5.4, h / 2, zT);
      var glass = new T.Mesh(own(new T.PlaneGeometry(w, h - 1.2)), own(new T.MeshBasicMaterial({ color: 0x9ff0e8, transparent: true, opacity: .07, depthWrite: false }))); glass.position.set(0, .75 + (h - 1.2) / 2, zT); glass.rotation.y = Math.PI; g.add(glass);
      for (var rf = 0; rf < 3; rf++) { var refl = new T.Mesh(own(new T.PlaneGeometry(.5 + rf * .3, h * 1.2)), own(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .045, depthWrite: false }))); refl.position.set(-7 + rf * 6.5, h / 2, zT - .03); refl.rotation.set(0, Math.PI, .5); g.add(refl); }
      // the water beyond: back and side walls painted as deep murk, haze layers, the lit surface overhead
      var back = gradTex(T, [[0, "#7cc4b4"], [.12, "#3f8f86"], [.45, "#1d5a57"], [1, "#0a2426"]]); own(back);
      var bw = new T.Mesh(own(new T.PlaneGeometry(w, h)), own(new T.MeshBasicMaterial({ map: back, fog: false }))); bw.position.set(0, h / 2, d - .05); bw.rotation.y = Math.PI; g.add(bw);
      [-1, 1].forEach(function (sd) { var sw2 = new T.Mesh(own(new T.PlaneGeometry(d - zT, h)), own(new T.MeshBasicMaterial({ map: back, fog: false }))); sw2.position.set(sd * (w / 2 - .05), h / 2, (zT + d) / 2); sw2.rotation.y = sd < 0 ? HP : -HP; g.add(sw2); });
      var hazeM = own(new T.MeshBasicMaterial({ color: 0x24605a, transparent: true, opacity: .2, depthWrite: false, fog: false })), hazeG = own(new T.PlaneGeometry(w, h));
      [zT + 1.6, zT + 3.2, zT + 4.9, zT + 6.6].forEach(function (z) { var hz = new T.Mesh(hazeG, hazeM); hz.position.set(0, h / 2, z); hz.rotation.y = Math.PI; hz.renderOrder = 1; g.add(hz); });
      var caus = causticTex(T); own(caus); caus.repeat.set(3, 1.2); c.caus = caus;
      var top = new T.Mesh(own(new T.PlaneGeometry(w, d - zT)), own(new T.MeshBasicMaterial({ map: caus, color: 0xa7e8dc, fog: false }))); top.position.set(0, h - .02, (zT + d) / 2); top.rotation.x = HP; g.add(top);
      // the bed: mud and sand rising to a bank on the left; rocks; weeds
      var N = 40, M = 16, pos = [], col = [], cc = new T.Color(), idx = [];
      for (var j = 0; j <= M; j++) for (var i = 0; i <= N; i++) { var x0 = -w / 2 + i / N * w, z0 = zT + j / M * (d - zT), bank = Math.max(0, (-x0 - 3) / 9), yy = .15 + bank * bank * 2.6 + Math.sin(x0 * .7 + z0) * .12 + Math.sin(x0 * 2.1 - z0 * 1.3) * .06 + (j / M) * .5; pos.push(x0, yy, z0); cc.setHex(0x4a4130).lerp(new T.Color(0x6e6a45), bank).multiplyScalar(.8 + rr() * .3); col.push(cc.r, cc.g, cc.b); }
      for (j = 0; j < M; j++) for (i = 0; i < N; i++) { var a = j * (N + 1) + i; idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
      var bgeo = own(new T.BufferGeometry()); bgeo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); bgeo.setAttribute("color", new T.Float32BufferAttribute(col, 3)); bgeo.setIndex(idx); bgeo.computeVertexNormals(); g.add(new T.Mesh(bgeo, own(new T.MeshLambertMaterial({ vertexColors: true }))));
      var rkG = own(new T.IcosahedronGeometry(1, 0)), rkM = own(new T.MeshLambertMaterial({ color: 0x5f5b50, flatShading: true }));
      for (var k = 0; k < 26; k++) { var rk = new T.Mesh(rkG, rkM), rx = -w / 2 + rr() * w * .8, rs = .2 + rr() * .7; rk.position.set(rx, .2 + Math.max(0, (-rx - 3) / 9) * 2 + rs * .2, zT + 1 + rr() * (d - zT - 1.5)); rk.scale.set(rs * 1.3, rs * .7, rs); rk.rotation.set(rr() * 3, rr() * 3, 0); g.add(rk); }
      var wG = own(weedGeo(T)), wM = own(weedMat(T)), nWd = 70, wd = new T.InstancedMesh(wG, wM, nWd); wd.frustumCulled = false; var dm = new T.Object3D();
      for (k = 0; k < nWd; k++) { var wx = -w / 2 + .4 + rr() * (w * .62), wz = zT + .7 + rr() * (d - zT - 1.2); dm.position.set(wx, .1 + Math.max(0, (-wx - 3) / 9) * 2, wz); dm.rotation.set(0, rr() * TAU, 0); dm.scale.set(1.4, 1.2 + rr() * 2.8, 1.4); dm.updateMatrix(); wd.setMatrixAt(k, dm.matrix); } g.add(wd);
      // the dam wall and its water intake, on the right
      part(g, 2.2, h, d - zT, 0x8d9091, w / 2 - 1.1, h / 2, (zT + d) / 2); for (var lj = 0; lj < 6; lj++) part(g, .06, .05, d - zT, 0x6b6f70, w / 2 - 2.22, .9 + lj * 1.05, (zT + d) / 2);
      part(g, 2.6, 4.2, 2.6, 0x9a9d9e, w / 2 - 3.2, 2.1, zT + 4.6); part(g, 1.5, 1.3, .12, 0x0b1517, w / 2 - 3.2, 2.4, zT + 3.24); for (var gb = 0; gb < 6; gb++) part(g, .06, 1.3, .14, 0x3f4547, w / 2 - 3.85 + gb * .26, 2.4, zT + 3.2);
      var pipeG = own(new T.CylinderGeometry(.45, .45, 3, 14)), pipe = new T.Mesh(pipeG, own(new T.MeshLambertMaterial({ color: 0x6b7280 }))); pipe.rotation.z = HP; pipe.position.set(w / 2 - 1.2, .9, zT + 6.6); g.add(pipe);
      part(g, 2.1, .32, .05, 0x0f766e, w / 2 - 3.2, 4.45, zT + 3.28); var tag = o.canvasPlate(2, .3, function (x, W2, H2) { x.fillStyle = "#0f766e"; x.fillRect(0, 0, W2, H2); x.fillStyle = "#fff"; x.font = "800 40px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("WATER INTAKE", W2 / 2, 44); }, 512); tag.position.set(w / 2 - 3.2, 4.45, zT + 3.25); tag.rotation.y = Math.PI; g.add(tag);
      // light from above, shafts through the murk
      var tl = own(new T.PointLight(0x7fe3cf, 26, 22, 1.2)); tl.position.set(0, h - .6, zT + 3.5); g.add(tl);
      var shT = gradTex(T, [[0, "rgba(230,255,245,.85)"], [.6, "rgba(200,255,240,.25)"], [1, "rgba(200,255,240,0)"]], 64, 256, false, true), shM = own(new T.MeshBasicMaterial({ map: shT, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })), shG = own(new T.PlaneGeometry(1.6, h)); own(shT);
      c.shafts = []; for (k = 0; k < 6; k++) { var sm3 = new T.Mesh(shG, shM); sm3.position.set(-9 + k * 3.6 + rr(), h / 2, zT + 1.5 + rr() * 5); sm3.rotation.set(0, .3 + rr() * .4, .22); sm3.renderOrder = 2; g.add(sm3); c.shafts.push(sm3); }
      // fish behind the glass: lanes across the tank, the catfish on the bottom, one big perch, a few upside-down squeakers
      var fishList = [], add = function (sid, n) { for (var q = 0; q < n; q++) { var spc = SP[sid], bot = spc.bottom, f = { sp: spc, x: -w / 2 + rr() * w, z: zT + .9 + rr() * (d - zT - 1.6), y: bot ? .55 + rr() * .35 : 1 + rr() * (h - 2.2), v: (spc.speed * (.5 + rr() * .5)) * (rr() < .5 ? -1 : 1), s: spc.len * (.8 + rr() * .4) * (sid === "tilapia" || sid === "redbelly" || sid === "synodontis" ? 1.8 : 1.15), ph: rr() * TAU, up: spc.upside && rr() < .6 ? 1 : 0 }; if (sid === "tilapia" && q > 0 && fishList.length) { var lead = fishList[fishList.length - 1]; if (lead.sp === spc && q % 6) { f.x = lead.x - Math.sign(lead.v) * (.4 + rr() * .5); f.y = lead.y + (rr() - .5) * .5; f.z = lead.z + (rr() - .5) * .6; f.v = lead.v; } } fishList.push(f); } };
      add("tilapia", 18); add("redbelly", 7); add("catfish", 3); add("perch", 1); add("synodontis", 5); add("elephant", 3); add("bonytongue", 2); c.fishList = fishList;
      if (!G3) G3 = { fishGeo: {} }; G3.fishGeo = G3.fishGeo || {}; var fmat = G3.fishMat || (G3.fishMat = wagMat(T)); c.fishIM = [];
      Wa.SPECIES.forEach(function (spc) { var l2 = fishList.filter(function (f) { return f.sp === spc; }); if (!l2.length) return; var geo = G3.fishGeo[spc.id] || (G3.fishGeo[spc.id] = fishGeo(T, spc)), im = new T.InstancedMesh(geo, fmat, l2.length); im.frustumCulled = false; g.add(im); c.fishIM.push({ im: im, list: l2 }); });
      var bG = own(new T.SphereGeometry(1, 6, 5)), bM = own(new T.MeshBasicMaterial({ color: 0xe0fbff, transparent: true, opacity: .5, depthWrite: false })); c.bub = new T.InstancedMesh(bG, bM, 30); c.bub.frustumCulled = false; g.add(c.bub); c.bubs = []; for (k = 0; k < 30; k++) c.bubs.push({ x: w / 2 - 3.2 + (rr() - .5) * .8, z: zT + 3.1, y: rr() * h, s: .03 + rr() * .05 });
      c.dm = c.dm || new T.Object3D();
    }
    function stepAquarium(c, dt) {
      if (!c.fishList) return; var t = c.t, w = c.room.w, dm = c.dm, h = c.room.h; WU.value = (Z.api && Z.api.t) || t;
      if (c.caus) c.caus.offset.set((t * .03) % 1, (t * .017) % 1);
      if (c.shafts) c.shafts.forEach(function (m, k) { m.material.opacity = .11 + Math.sin(t * .4 + k * 1.7) * .035; });
      c.fishList.forEach(function (f) { f.x += f.v * dt; f.ph += dt; if (f.x > w / 2 + 1.5) f.x = -w / 2 - 1.5; if (f.x < -w / 2 - 1.5) f.x = w / 2 + 1.5; });
      c.fishIM.forEach(function (q) { q.list.forEach(function (f, k) { var bob = Math.sin(f.ph * .8) * .12; dm.position.set(f.x, f.y + bob, f.z + Math.sin(f.ph * .3) * .3); dm.rotation.set(f.up ? Math.PI : 0, f.v > 0 ? 0 : Math.PI, Math.cos(f.ph * .8) * .06, "YXZ"); dm.scale.setScalar(f.s); dm.updateMatrix(); q.im.setMatrixAt(k, dm.matrix); }); q.im.instanceMatrix.needsUpdate = true; });
      if (c.bub) { c.bubs.forEach(function (b, k) { b.y += dt * (.5 + b.s * 10); if (b.y > h - .1) b.y = 2.4; dm.position.set(b.x + Math.sin(t * 3 + k) * .08, b.y, b.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(b.s); dm.updateMatrix(); c.bub.setMatrixAt(k, dm.matrix); }); c.bub.instanceMatrix.needsUpdate = true; }
      dm.scale.set(1, 1, 1);
    }
  })();
  function causticTex(T) { var n = 256, cv = document.createElement("canvas"); cv.width = cv.height = n; var x = cv.getContext("2d"); x.fillStyle = "#3e8f86"; x.fillRect(0, 0, n, n); x.strokeStyle = "rgba(230,255,248,.55)"; x.lineWidth = 3; var r = S.rng(77);
    for (var i = 0; i < 46; i++) { var cx = r() * n, cy = r() * n, rad = 10 + r() * 26; x.beginPath(); for (var a = 0; a <= 12; a++) { var an = a / 12 * TAU, rr = rad * (.7 + .5 * Math.sin(an * 3 + i)); for (var ox = -1; ox <= 1; ox++) void ox; var px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr; if (a) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
    var t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; }
  // the painted panels: a title band, a small diagram, and the call to read more
  function paintPanel(x, W2, H2, id, p) {
    x.fillStyle = "#f8fafc"; x.fillRect(0, 0, W2, H2); x.fillStyle = "#0f766e"; x.fillRect(0, 0, W2, H2 * .2); x.fillStyle = "#fff"; x.textAlign = "left"; var fs = 64; do { x.font = "900 " + fs + "px system-ui, sans-serif"; fs -= 2; } while (x.measureText(p.title).width > W2 - 60 && fs > 20); x.fillText(p.title, 30, H2 * .135);
    x.fillStyle = "#334155"; x.font = "600 34px system-ui, sans-serif"; x.fillText(p.sub, 30, H2 * .29); var top = H2 * .34, bot = H2 * .84, L = 30, R = W2 - 30, mid = (top + bot) / 2;
    x.lineWidth = 6; x.lineJoin = "round";
    if (id === "dam") { x.fillStyle = "#7dd3fc"; x.beginPath(); x.moveTo(L, bot); x.lineTo(L, mid - 20); x.lineTo(W2 * .45, mid - 20); x.lineTo(W2 * .47, bot); x.fill(); x.fillStyle = "#a16207"; x.beginPath(); x.moveTo(W2 * .4, bot); x.lineTo(W2 * .5, top + 10); x.lineTo(W2 * .58, top + 10); x.lineTo(W2 * .8, bot); x.fill(); x.fillStyle = "#57534e"; x.fillRect(W2 * .505, top + 30, W2 * .05, bot - top - 30); x.fillStyle = "#334155"; x.fillRect(W2 * .3, top + 10, 26, bot - top - 10); x.fillStyle = "#0369a1"; x.fillRect(W2 * .3 + 26, bot - 30, W2 * .55, 14);
      x.fillStyle = "#0f172a"; x.font = "700 28px system-ui, sans-serif"; x.fillText("reservoir", L + 10, mid + 30); x.fillText("intake", W2 * .25, top); x.fillText("clay core", W2 * .6, top + 40); x.fillText("outlet pipe", W2 * .62, bot - 40); x.fillText("spillway →", W2 * .82, mid); }
    else if (id === "treat") { var steps = ["Screen", "Air", "Floc", "Settle", "Filter", "Chlorine", "Tank"]; steps.forEach(function (s, i) { var cx = L + 60 + i * (R - L - 120) / 6; x.fillStyle = ["#0369a1", "#0ea5e9", "#14b8a6", "#0d9488", "#a16207", "#16a34a", "#334155"][i]; x.beginPath(); x.arc(cx, mid - 10, 46, 0, TAU); x.fill(); x.fillStyle = "#fff"; x.font = "900 40px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(String(i + 1), cx, mid + 4); x.fillStyle = "#0f172a"; x.font = "700 26px system-ui, sans-serif"; x.fillText(s, cx, mid + 80); if (i < 6) { x.strokeStyle = "#94a3b8"; x.beginPath(); x.moveTo(cx + 52, mid - 10); x.lineTo(cx + (R - L - 120) / 6 - 52, mid - 10); x.stroke(); } }); x.textAlign = "left"; }
    else if (id === "safety") { ["Never swim alone", "Keep off the spillway", "Reach or throw, don't go", "Float and wave if tired"].forEach(function (s, i) { var yy = top + 30 + i * (bot - top - 30) / 4; x.fillStyle = i === 1 ? "#dc2626" : "#f97316"; x.beginPath(); x.moveTo(L + 30, yy - 30); x.lineTo(L + 62, yy + 24); x.lineTo(L - 2, yy + 24); x.closePath(); x.fill(); x.fillStyle = "#fff"; x.font = "900 34px system-ui"; x.textAlign = "center"; x.fillText("!", L + 30, yy + 16); x.textAlign = "left"; x.fillStyle = "#0f172a"; x.font = "700 38px system-ui, sans-serif"; x.fillText(s, L + 90, yy + 12); }); }
    else if (id === "purpose") { [["Drinking water", "#0ea5e9"], ["Dry-season farming", "#16a34a"], ["Fishing", "#f59e0b"], ["Flood control", "#6366f1"]].forEach(function (q, i) { var cx = L + (i % 2) * (R - L) / 2, cy = top + 20 + Math.floor(i / 2) * (bot - top) / 2; x.fillStyle = q[1]; x.beginPath(); x.arc(cx + 40, cy + 40, 34, 0, TAU); x.fill(); x.fillStyle = "#0f172a"; x.font = "700 36px system-ui, sans-serif"; x.fillText(q[0], cx + 90, cy + 52); }); }
    else if (id === "swim") { var best = Wa.best(); x.fillStyle = "#0f172a"; x.font = "800 70px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(best ? fmt(best) : "—", W2 / 2, mid + 30); x.font = "600 30px system-ui, sans-serif"; x.fillText(best ? "your best" : "no time yet: start at the board outside", W2 / 2, mid + 80); x.textAlign = "left"; }
    x.fillStyle = "#0f766e"; x.font = "800 34px system-ui, sans-serif"; x.fillText("Walk up and press E to read", 30, H2 - 30);
  }
})();
