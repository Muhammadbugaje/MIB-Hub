/* Freshers School Life — friends missions: 25 co-op and versus missions for 2–6 players in one room
   (docs/story/05_FRIENDS_MISSIONS.md). They sit outside the story: no story flags, no mission progress.

   How it works
   - One player hosts. The host's game is the referee: it owns the mission state, judges positions it sees,
     validates claims from the others and broadcasts a compact snapshot about twice a second.
   - Everything that can be worked out from (mission, seed, player list, options) — gates, nuts, riddles,
     items, routes — is rebuilt identically on every device by C.layout, so snapshots carry only what moves.
   - Messages ride the room relay as events {k:"co", o:"S"|"C", d:"<json>"}; the transport (site relay or a
     local LAN link) does not matter as long as it delivers those events.
   - Pure parts (C.MISSIONS, C.layout, C.Host, C.Client) run in Node for the tests; the browser glue at the
     bottom (C.tick, C.hud, C.onEvent, C.menu…) talks to window.SamaruGame when it exists. */
(function (root) {
  "use strict";
  var C = {}, TAU = Math.PI * 2, MAXMSG = 1000;
  function Sm() { return root.SamaruSim; } function Dd() { return root.SamaruData; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dd(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function ang(d) { var a = d % TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // boolean list <-> hex string (four flags per character)
  function bits(a) { var s = ""; for (var i = 0; i < a.length; i += 4) s += ((a[i] ? 1 : 0) | (a[i + 1] ? 2 : 0) | (a[i + 2] ? 4 : 0) | (a[i + 3] ? 8 : 0)).toString(16); return s; }
  function unbits(s, n) { var o = []; for (var i = 0; i < n; i++) { var c = parseInt((s || "")[i >> 2] || "0", 16); o.push(!!(c & (1 << (i & 3)))); } return o; }

  /* ---------- the campus, read only from shared data so every device agrees ---------- */
  function PL(id) { var D = Dd(); if (!D) return null; for (var i = 0; i < D.PLACES.length; i++) if (D.PLACES[i].id === id) return D.PLACES[i]; return null; }
  function free(W, x, y) { var S = Sm(); for (var k = 0; k < 40; k++) { var a = k * 2.39996, rr = k * 2.5, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (!S.insideBuilding(W, px, py) && !(S.inWater && S.inWater(W, px, py))) return { x: px, y: py }; } return { x: x, y: y }; }
  function reach(W, x, y, drive, name) { var S = Sm(), n = S.nearRoad(W, x, y, 160, !!drive), o; if (n && n.d < 160) { var dx = x - n.x, dy = y - n.y, l = Math.hypot(dx, dy) || 1, off = drive ? 0 : Math.min(l, n.r.w / 2 + 3); o = free(W, n.x + dx / l * off, n.y + dy / l * off); } else o = free(W, x, y); o.x = r1(o.x); o.y = r1(o.y); o.name = name || ""; return o; }
  function spot(W, id, drive) { var p = PL(id); return p ? reach(W, p.x, p.y, drive, p.name) : null; }
  function exists(id) { return !!PL(id); }
  function plen(p) { var s = 0; for (var i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; }
  function at(p, s) { if (s <= 0) return { x: p[0], y: p[1], a: Math.atan2(p[3] - p[1], p[2] - p[0]) }; for (var i = 2; i < p.length; i += 2) { var l = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); if (s <= l || i === p.length - 2) { var k = l ? Math.min(1, s / l) : 0; return { x: p[i - 2] + (p[i] - p[i - 2]) * k, y: p[i - 1] + (p[i + 1] - p[i - 1]) * k, a: Math.atan2(p[i + 1] - p[i - 1], p[i] - p[i - 2]) }; } s -= l; } return { x: p[p.length - 2], y: p[p.length - 1], a: 0 }; }
  function sample(p, step, from) { var L = plen(p), out = []; for (var s = from || 0; s < L; s += step) out.push(at(p, s)); var e = at(p, L); out.push(e); return out.map(function (q) { return { x: r1(q.x), y: r1(q.y), a: q.a }; }); }
  function route(W, a, b, drive) { var S = Sm(), p = S.route(W, a.x, a.y, b.x, b.y, !!drive); return p && p.length >= 4 ? p : [a.x, a.y, b.x, b.y]; }
  function chain(W, list, drive) { var out = []; for (var i = 0; i + 1 < list.length; i++) { var p = route(W, list[i], list[i + 1], drive); out = out.concat(i ? p.slice(2) : p); } return out; }
  var RING = null;
  function ringLoop(W) { // the Ring Road as one closed line, chained from its pieces
    if (RING && RING.W === W) return RING.p; var segs = W.roads.filter(function (r) { return r.n === "Ring Road"; }).map(function (r) { return r.p.slice(); }), p;
    if (!segs.length) { p = []; for (var k = 0; k <= 32; k++) { var a = k / 32 * TAU; p.push(Math.cos(a) * 700, Math.sin(a) * 700); } }
    else { p = segs.shift(); var guard = 0; while (segs.length && guard++ < 500) { var ex = p[p.length - 2], ey = p[p.length - 1], hit = -1, rev = false; for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (Math.hypot(s[0] - ex, s[1] - ey) < 2) { hit = i; break; } if (Math.hypot(s[s.length - 2] - ex, s[s.length - 1] - ey) < 2) { hit = i; rev = true; break; } } if (hit < 0) break; var q = segs.splice(hit, 1)[0]; if (rev) { var rq = []; for (var j = q.length - 2; j >= 0; j -= 2) rq.push(q[j], q[j + 1]); q = rq; } p = p.concat(q.slice(2)); } }
    RING = { W: W, p: p }; return p;
  }
  function zoneBox(zone) { var D = Dd(), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0; D.PLACES.forEach(function (p) { if (p.zone !== zone) return; n++; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }); if (!n) return null; var pad = 45; return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, name: zone }; }
  var DISTRICTS = [["hostel", "the hostels"], ["garden", "the gardens"], ["quiet", "the quiet side"], ["quad", "the Engineering quad"], ["shinkafi", "Shinkafi"], ["tech", "the tech block"]];
  function district(r) { var d = pick(r, DISTRICTS), b = zoneBox(d[0]) || { x0: -200, y0: -400, x1: 200, y1: 0 }; if (b.x1 - b.x0 > 700) { var cx = (b.x0 + b.x1) / 2; b.x0 = cx - 350; b.x1 = cx + 350; } b.label = d[1]; b.cx = (b.x0 + b.x1) / 2; b.cy = (b.y0 + b.y1) / 2; return b; }
  function inBox(b, p) { return p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1; }
  function walkPoint(W, r, b) { var S = Sm(); for (var k = 0; k < 400; k++) { var x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0); if (!S.insideBuilding(W, x, y) && !(S.inWater && S.inWater(W, x, y))) return { x: r1(x), y: r1(y) }; } var f = free(W, b.cx, b.cy); return { x: r1(f.x), y: r1(f.y) }; }
  function grid(s, i, n) { var row = Math.floor(i / 3), col = i % 3, ca = Math.cos(s.a || 0), sa = Math.sin(s.a || 0), lat = (col - 1) * 3.6, back = -row * 6; return { x: r1(s.x + ca * back - sa * lat), y: r1(s.y + sa * back + ca * lat), a: s.a || 0 }; }
  var LANDMARKS = ["gate", "senate", "library", "shinkafi", "social", "ee", "physics", "fire", "dam", "club", "market", "akenzua", "ribadu", "mosque", "chapel", "compsci"];
  var STOPS = ["stop_gate", "stop_senate", "stop_social", "stop_eng", "stop_library", "stop_dam", "stop_market"];
  var VNAME = { "": "on foot", skate: "Skateboard", bike: "Bicycle", scooter: "Scooter", okada: "Okada", keke: "Keke", car: "Car", sport: "Sports car", plane: "Plane" };
  function vmax(v) { var S = Sm(); return v && S.VEH[v] ? S.VEH[v].max : 9.2; }

  /* ---------- content: riddles (F11) and photo subjects (F12) ---------- */
  var RIDDLES = [
    ["I hand out files and stamps, and my tower is orange. Who am I?", "senate"], ["Books on every floor, a clock on top, and nobody may shout.", "library"],
    ["Umbrellas, shawarma, and every gist on campus is told under me.", "shinkafi"], ["Four letters taller than you. Everybody takes a picture with me.", "selfie"],
    ["I crackle with lightning, and a maker's name is on my plaque.", "enggarden"], ["Boats sleep at my pier. The sunset sleeps on my water.", "dam"],
    ["Wheels hum, engines roar, and I keep the trophies.", "club"], ["Planes need me long and flat. The windsock points at me.", "strip"],
    ["Fifteen shops under one roof, and the escalator only goes up.", "market"], ["A dome, a minaret, and the call five times a day.", "mosque"],
    ["A steeple, a bell, and a choir on Sunday morning.", "chapel"], ["Tennis, ping-pong and nine-ball. The evening lives here.", "social"],
    ["Plaster and bandages. Nurse Hauwa waits inside.", "sickbay"], ["Ten departments around one garden. Where am I?", "ee"],
    ["My kettle is always on. I am where engines are drawn before they are built.", "dept_mech"], ["Ohm lives here. So do resistors.", "dept_elect"],
    ["Bridges, roads and concrete cubes. That is my business.", "dept_civil"], ["Code compiles here, and sometimes it runs.", "compsci"],
    ["Pendulums and prisms. The oldest experiments live in my labs.", "physics"], ["Hills of numbers, and a blackboard that never sleeps.", "maths"],
    ["The red truck parks inside me and the siren sleeps on my roof.", "fire"], ["Queen of the hostels, named after a queen.", "amina"],
    ["The biggest hall on campus. Two hundred seats and one microphone.", "nelt"], ["Kainji has a twin. I am the twin. Who am I?", "wt"],
    ["I am Kainji. Find me before the lecturer does.", "kt"], ["Hearts in the hedge. Couples on the bench.", "love"],
    ["Statues stand still in me, even in the harmattan.", "sculpture"], ["A stone globe turns in me without moving.", "geogarden"],
    ["Pepsi named me. The shade is free.", "pepsi"], ["Students film themselves here. Radio voices come from inside.", "radio"],
    ["Pens, notebooks and the torch you will need when the light goes.", "bookshop"], ["The ATM queue starts here at month end.", "bank"],
    ["The faculty keeps a garden too, behind the theatre.", "facgarden"], ["Every first week starts with a lecture in my theatre.", "theatre"],
    ["Fresher? Your first lecture is in my long theatre.", "fslt"], ["The arch over the road. Everyone enters through me.", "gate"],
    ["The far hostels, past the Dam. Dangote built me.", "dangote"], ["My name means 'son of Fodio'. I am out in Phase 2.", "danfodio"],
    ["The shuttles rest at me in Phase 2.", "p2park"], ["Security asks for your ID at me on the long road.", "checkpoint"],
    ["Roadside stalls with roasted corn on the Phase 2 road.", "stalls"], ["The lower water, below the Dam.", "lowerdam"],
    ["Art students paint at me all day.", "art"], ["Future teachers practise at me.", "education"],
    ["Quarters for the staff, gardens and quiet.", "quarters"], ["The white-and-gold shop with the maker's initials.", "mibstore"],
    ["Akenzua is my name. Fresh boys sleep under my roof.", "akenzua"], ["Ribadu, then Alex. The oldest hostel on campus.", "ribadu"],
    ["Courts with nets and painted lines.", "court"], ["Chemical engineering's pilot plant hisses here.", "chemeng"]];
  var PHOTO = [ // k: pl place · tm place+hours · em friend doing an emote · vh friend riding · gp group · me you riding near a place
    { k: "pl", p: "selfie", t: "The giant letters" }, { k: "pl", p: "senate", t: "The Senate tower" }, { k: "pl", p: "library", t: "The library clock" },
    { k: "pl", p: "enggarden", t: "The Tesla coil" }, { k: "pl", p: "dam", t: "Boats at the pier" }, { k: "pl", p: "strip", t: "The windsock on the airstrip" },
    { k: "pl", p: "club", t: "The trophy wall at the Racing Club" }, { k: "pl", p: "market", t: "The mall's big sign" }, { k: "pl", p: "mosque", t: "The mosque dome" },
    { k: "pl", p: "chapel", t: "The chapel steeple" }, { k: "pl", p: "love", t: "The heart hedge" }, { k: "pl", p: "sculpture", t: "A statue in the Sculpture Garden" },
    { k: "pl", p: "geogarden", t: "The stone globe" }, { k: "pl", p: "court", t: "A basketball hoop" }, { k: "pl", p: "shinkafi", t: "Shinkafi's umbrellas" },
    { k: "pl", p: "gate", t: "The Main Gate arch" }, { k: "pl", p: "fire", t: "The red fire truck" }, { k: "pl", p: "radio", t: "The campus radio mast" },
    { k: "pl", p: "nelt", t: "NELT's front steps" }, { k: "pl", p: "kt", t: "The Kainji Theatre sign" }, { k: "pl", p: "wt", t: "The Wolfson Theatre sign" },
    { k: "pl", p: "mibstore", t: "The MIB Store window" }, { k: "pl", p: "market", t: "A goat near the market" }, { k: "pl", p: "pepsi", t: "Shade in the Pepsi Garden" },
    { k: "pl", p: "bookshop", t: "Torches for sale at the Bookshop" }, { k: "pl", p: "sickbay", t: "The Sick Bay's red cross" }, { k: "pl", p: "compsci", t: "The Computer Science sign" },
    { k: "pl", p: "physics", t: "The pendulum in Physics" }, { k: "pl", p: "stop_gate", t: "A shuttle at the gate stop" }, { k: "pl", p: "akenzua", t: "Washing lines at Akenzua" },
    { k: "tm", p: "selfie", a: 17, b: 19.5, t: "The fountain at sunset" }, { k: "tm", p: "dam", a: 17, b: 19.5, t: "The Dam at sunset" }, { k: "tm", p: "enggarden", a: 19, b: 5, t: "The coil glowing at night" },
    { k: "tm", p: "shinkafi", a: 19, b: 2, t: "Shinkafi lit up at night" }, { k: "tm", p: "", a: 19, b: 5, t: "A lit street lamp" }, { k: "tm", p: "mosque", a: 5, b: 7.5, t: "The mosque at dawn" },
    { k: "tm", p: "library", a: 7, b: 9, t: "The library opening" }, { k: "tm", p: "market", a: 19, b: 23, t: "The mall at night" }, { k: "tm", p: "gate", a: 5, b: 8, t: "The gate at sunrise" },
    { k: "em", e: "dance", p: "", t: "Someone dancing" }, { k: "em", e: "dance", p: "selfie", t: "A dance in front of the letters" }, { k: "em", e: "wave", p: "", t: "A friend waving" },
    { k: "em", e: "wave", p: "senate", t: "A wave on the Senate steps" }, { k: "em", e: "sit", p: "", t: "Someone sitting down" }, { k: "em", e: "sit", p: "love", t: "Someone sitting in the Love Garden" },
    { k: "em", e: "dance", p: "social", t: "A dance at the Social Centre" }, { k: "em", e: "wave", p: "dam", t: "A wave from the pier" },
    { k: "vh", v: "okada", t: "A friend on an okada" }, { k: "vh", v: "bike", t: "A friend on a bicycle" }, { k: "vh", v: "keke", t: "A friend in a keke" },
    { k: "vh", v: "car", t: "A friend driving a car" }, { k: "vh", v: "skate", t: "A friend on a skateboard" }, { k: "vh", v: "scooter", t: "A friend on a scooter" },
    { k: "gp", c: 3, t: "A group selfie (three or more)" }, { k: "gp", c: 2, t: "You and a friend together" }, { k: "gp", c: 3, p: "selfie", t: "A group at the letters" },
    { k: "me", v: "bike", p: "selfie", t: "Your bicycle at the letters" }, { k: "me", v: "okada", p: "gate", t: "Your okada at the gate" }, { k: "me", v: "skate", p: "selfie", t: "Your skateboard on the boulevard" },
    { k: "me", v: "car", p: "club", t: "Your car at the Racing Club" }];
  C.RIDDLES = RIDDLES; C.PHOTO = PHOTO;
  function hourIn(h, a, b) { return a <= b ? h >= a && h < b : h >= a || h < b; }

  /* ---------- the 25 missions ---------- */
  // Each mission: id, g group, name, what, min/max players, comp (versus) or co-op, layout(r, ctx) -> L (rebuilt everywhere),
  // init(st, L, ctx), rounds, start(L, rd, i, st) -> {x,y,a,v}, step(st, L, H, dt) host only, claim(st, L, H, pid, c),
  // task(st, L, pid, view) -> {x, y, txt, act?, r?, hide?, mk: markers}, over(st, L, H) -> bool, rank(st, L) or win(st, L).
  var M = [];
  function mission(o) { o.min = o.min || 2; o.max = o.max || 6; o.rounds = o.rounds || function () { return 1; }; o.over = o.over || function () { return false; }; M.push(o); return o; }
  function sc(st, pid, v) { st.sc[pid] = r1((st.sc[pid] || 0) + v); }
  function byScore(st, L) { return st.n.slice().sort(function (a, b) { return (st.sc[b] || 0) - (st.sc[a] || 0) || a - b; }); }
  function act(st) { return st.n.filter(function (p) { return !st.gone || !st.gone[p]; }); }
  function teamsOf(st, k) { var t = []; for (var i = 0; i < k; i++) t.push([]); st.n.forEach(function (p) { t[st.tm[p] || 0].push(p); }); return t; }
  function teamRank(st, tscore) { // everyone on a team shares the team's score
    st.n.forEach(function (p) { st.sc[p] = tscore[st.tm[p] || 0] || 0; }); }

  // racing through gates: shared by F1, F3, F4, F5
  function gateStep(st, L, H, gates, laps, R) {
    var x = st.x; act(st).forEach(function (p) { var q = H.pos[p]; if (!q || x.f[p] != null) return; var k = x.g[p] || 1, g = gates[k % gates.length];
      if (dd(q, g) < R) { k++; if (laps > 1 && k > gates.length) { x.l[p] = (x.l[p] || 0) + 1; k = 1; } else if (laps <= 1 && k >= gates.length) { x.f[p] = r1(st.t + (x.pen && x.pen[p] || 0)); k = gates.length; } if (laps > 1 && (x.l[p] || 0) >= laps) x.f[p] = r1(st.t + (x.pen && x.pen[p] || 0)); x.g[p] = k; }
      if (L.sc && x.o) L.sc.forEach(function (s, j) { if ((x.o >> j) & 1 && (x.g[p] || 1) === s.i + 1 && dd(q, s) < R) x.g[p] = s.i + 2 <= gates.length ? s.i + 2 : 1; }); });
  }
  function gateProgress(st, L, p, n) { var x = st.x; return (x.l[p] || 0) * n + (x.g[p] || 1); }
  function gateRank(st, L, gates) { var x = st.x, n = gates.length; return st.n.slice().sort(function (a, b) {
    var fa = x.f[a], fb = x.f[b]; if (fa != null && fb != null) return fa - fb || a - b; if (fa != null) return -1; if (fb != null) return 1;
    return gateProgress(st, L, b, n) - gateProgress(st, L, a, n) || a - b; }); }
  function gateTask(st, L, p, gates, laps, label) { var x = st.x, k = x.g[p] || 1, g = gates[k % gates.length]; if (x.f[p] != null) return { txt: "Finished in " + x.f[p] + " s. Cheer the others home.", mk: [] };
    var mk = [{ x: g.x, y: g.y, c: "#fde047", r: 10, l: "GATE" }], g2 = gates[(k + 1) % gates.length]; if (g2) mk.push({ x: g2.x, y: g2.y, c: "rgba(253,224,71,.5)", r: 8 });
    if (L.sc) L.sc.forEach(function (s, j) { if ((x.o >> j) & 1) mk.push({ x: s.x, y: s.y, c: "#22d3ee", r: 9, l: "SHORTCUT" }); });
    return { x: g.x, y: g.y, txt: (laps > 1 ? "Lap " + Math.min(laps, (x.l[p] || 0) + 1) + "/" + laps + " · " : "") + label + " " + Math.min(k, gates.length - (laps > 1 ? 0 : 1)) + "/" + (gates.length - (laps > 1 ? 0 : 1)), mk: mk }; }
  function allDone(st, f) { return act(st).every(function (p) { return f[p] != null; }); }
  function firstDone(f) { var t = 1e9; for (var k in f) if (f[k] != null) t = Math.min(t, f[k]); return t < 1e9 ? t : null; }

  mission({ id: "F1", g: "race", name: "Ring Road Rumble", what: "Lap race round the ring road. Three shortcut gates open at random.", comp: true,
    layout: function (r, c) { var loop = ringLoop(c.W), Lp = plen(loop), N = 12, dir = r() < .5, pts = []; for (var i = 0; i < N; i++) { var q = at(loop, (dir ? i : N - i) % N * Lp / N); pts.push({ x: r1(q.x), y: r1(q.y), a: q.a + (dir ? 0 : Math.PI) }); }
      var sc = shuffle(r, [1, 3, 5, 7, 9]).slice(0, 3).sort().map(function (i) { var a = pts[i], b = pts[(i + 2) % N], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; return { i: i, x: r1(mx * .72), y: r1(my * .72) }; });
      var veh = c.opt.veh || (c.mut.ride || pick(r, ["bike", "scooter", "okada", "car", "sport"])); return { gates: pts, laps: 2 + Math.floor(r() * 3), sc: sc, veh: veh, len: Lp, wx: pick(r, ["clear", "clear", "harmattan", "dusk"]) }; },
    init: function (st) { st.x = { g: {}, l: {}, f: {}, o: 0 }; }, dur: function (L) { return Math.round(L.laps * L.len / (vmax(L.veh) * .55) + 60); },
    start: function (L, rd, i) { var g = L.gates[0]; return Object.assign(grid({ x: g.x, y: g.y, a: g.a + Math.PI }, i), { a: g.a, v: L.veh }); },
    step: function (st, L, H) { if (H.every(20)) st.x.o = Math.floor(H.r() * 8); gateStep(st, L, H, L.gates, L.laps, 12); },
    over: function (st, L) { var f0 = firstDone(st.x.f); return allDone(st, st.x.f) || (f0 != null && st.t > f0 + 45); },
    rank: function (st, L) { return gateRank(st, L, L.gates); },
    task: function (st, L, p) { return gateTask(st, L, p, L.gates, L.laps, "Gate"); } });

  mission({ id: "F2", g: "race", name: "Keke Relay", what: "Teams share one keke. Each driver takes a leg and tags in at a shuttle stop.", comp: true, teams: 2,
    layout: function (r, c) { var n = c.n.length, size = Math.ceil(n / 2), M2 = Math.max(2, size + 1), ids = shuffle(r, STOPS.filter(exists)).slice(0, M2 + 1), stops = ids.map(function (id) { return spot(c.W, id, true); }), d = 0;
      for (var i = 0; i + 1 < stops.length; i++) d += dd(stops[i], stops[i + 1]); return { stops: stops, legs: stops.length - 1, pass: Math.floor(r() * (stops.length - 1)), veh: c.mut.ride || "keke", len: d * 1.5 }; },
    init: function (st, L) { var ps = st.n.slice().sort(function (a, b) { return a - b; }); ps.forEach(function (p, i) { st.tm[p] = i % 2; }); st.x = { lg: [0, 0], ft: [null, null], pen: [0, 0] }; },
    dur: function (L) { return Math.round(L.len / 6 + 120); },
    driver: function (st, T, leg) { var t = teamsOf(st, 2)[T]; return t.length ? t[leg % t.length] : null; },
    start: function (L, rd, i, st, p) { var s = L.stops[0], T = st.tm[p] || 0, me = this.driver(st, T, 0) === p; var g = grid({ x: s.x, y: s.y, a: 0 }, i); return { x: g.x, y: g.y, a: 0, v: me ? L.veh : "okada" }; },
    step: function (st, L, H) { var self = this, x = st.x, tms = teamsOf(st, 2); [0, 1].forEach(function (T) { if (x.ft[T] != null || !tms[T].length) return; var leg = x.lg[T], dr = self.driver(st, T, leg), q = H.pos[dr], stop = L.stops[leg + 1]; if (!q || !stop || dd(q, stop) > 12) return;
      if (leg + 1 >= L.legs) { var small = tms[T].length < tms[1 - T].length ? .92 : 1; x.ft[T] = r1((st.t + x.pen[T]) * small); return; }
      var nd = self.driver(st, T, leg + 1), nq = H.pos[nd]; if (nd === dr || (nq && dd(nq, stop) < 12)) { x.lg[T] = leg + 1; sc(st, dr, 1); H.say("tag", T); } }); },
    claim: function (st, L, H, p, c) { var T = st.tm[p] || 0; if (c.o === "bp" && st.x.lg[T] === L.pass && this.driver(st, T, st.x.lg[T]) === p) st.x.pen[T] += 3; },
    over: function (st, L) { var t = teamsOf(st, 2); return (st.x.ft[0] != null || !t[0].length) && (st.x.ft[1] != null || !t[1].length); },
    rank: function (st, L) { var x = st.x, tw = x.ft[0] != null && (x.ft[1] == null || x.ft[0] <= x.ft[1]) ? 0 : x.ft[1] != null ? 1 : (x.lg[0] >= x.lg[1] ? 0 : 1);
      return st.n.slice().sort(function (a, b) { return ((st.tm[a] === tw) ? 0 : 1) - ((st.tm[b] === tw) ? 0 : 1) || (st.sc[b] || 0) - (st.sc[a] || 0) || a - b; }); },
    task: function (st, L, p) { var T = st.tm[p] || 0, x = st.x, leg = x.lg[T]; if (x.ft[T] != null) return { txt: "Your team finished in " + x.ft[T] + " s.", mk: [] };
      var dr = this.driver(st, T, leg), stop = L.stops[leg + 1], mk = [{ x: stop.x, y: stop.y, c: "#fde047", r: 12, l: "STOP" }], pass = leg === L.pass ? " Passenger on board: drive gently!" : "";
      if (dr === p) return { x: stop.x, y: stop.y, txt: "Drive leg " + (leg + 1) + "/" + L.legs + " to " + stop.name + "." + pass, mk: mk, veh: L.veh };
      for (var k = leg + 1; k < L.legs; k++) if (this.driver(st, T, k) === p) { var s2 = L.stops[k]; return { x: s2.x, y: s2.y, txt: "Wait at " + s2.name + ": you drive leg " + (k + 1) + ".", mk: [{ x: s2.x, y: s2.y, c: "#86efac", r: 12, l: "YOUR STOP" }] }; }
      return { x: stop.x, y: stop.y, txt: "Meet your driver at " + stop.name + ".", mk: mk }; } });

  mission({ id: "F3", g: "race", name: "Okada Sprint Cup", what: "Three short sprints between landmarks. Points for every finish.", comp: true,
    layout: function (r, c) { var lm = shuffle(r, LANDMARKS.filter(exists)), pairs = [], i, j; for (i = 0; i < lm.length && pairs.length < 3; i++) for (j = i + 1; j < lm.length && pairs.length < 3; j++) { var a = PL(lm[i]), b = PL(lm[j]), d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 400 && d < 1100 && !pairs.some(function (q) { return q[0] === lm[i] || q[1] === lm[j]; })) pairs.push([lm[i], lm[j]]); }
      return { sp: pairs.map(function (q) { return [spot(c.W, q[0], true), spot(c.W, q[1], true)]; }), veh: c.mut.ride || "okada" }; },
    rounds: function (L) { return L.sp.length; }, init: function (st) { st.x = { g: {}, l: {}, f: {} }; },
    dur: function (L) { return L.sp.reduce(function (s, q) { return s + dd(q[0], q[1]) * 1.5 / vmax(L.veh) / .6 + 40; }, 30); },
    newRound: function (st) { st.x = { g: {}, l: {}, f: {} }; },
    start: function (L, rd, i) { var s = L.sp[rd][0], f = L.sp[rd][1]; return Object.assign(grid({ x: s.x, y: s.y, a: Math.atan2(f.y - s.y, f.x - s.x) }, i), { v: L.veh }); },
    step: function (st, L, H) { var q = L.sp[st.rd]; gateStep(st, L, H, [q[0], q[1]], 1, 12); },
    roundOver: function (st, L) { var f0 = firstDone(st.x.f); return allDone(st, st.x.f) || (f0 != null && st.rt > f0 - (st.t - st.rt) + 30) || st.rt > dd(L.sp[st.rd][0], L.sp[st.rd][1]) * 1.5 / vmax(L.veh) / .5 + 40; },
    endRound: function (st, L) { var PTS = [10, 7, 5, 3, 2, 1]; gateRank(st, L, [L.sp[st.rd][0], L.sp[st.rd][1]]).forEach(function (p, i) { if (st.x.f[p] != null) sc(st, p, PTS[i] || 1); }); },
    rank: byScore, task: function (st, L, p) { var q = L.sp[st.rd] || L.sp[0]; var t = gateTask(st, L, p, [q[0], q[1]], 1, "Sprint " + (st.rd + 1) + "/3 to " + q[1].name); return t; } });

  mission({ id: "F4", g: "race", name: "Bicycle Derby", what: "Bicycles only. Sprinting drains energy; food stalls on the route refill you.", comp: true,
    layout: function (r, c) { var D = Dd(), rt = pick(r, D.ROUTES), via = rt.via.filter(exists).map(function (id) { return spot(c.W, id, false); }), p = chain(c.W, via, false), gates = sample(p, 120), stalls = shuffle(r, gates.slice(1, -1).map(function (g, i) { return i + 1; })).slice(0, Math.min(3, gates.length - 2)).sort();
      return { gates: gates, stalls: stalls, len: plen(p), name: rt.name, veh: "bike", hill: Math.floor(r() * gates.length) }; },
    init: function (st) { st.x = { g: {}, l: {}, f: {}, sv: {} }; }, dur: function (L) { return Math.round(L.len / 5.5 + 60); },
    start: function (L, rd, i) { var g = L.gates[0], g1 = L.gates[1] || g; return Object.assign(grid({ x: g.x, y: g.y, a: Math.atan2(g1.y - g.y, g1.x - g.x) }, i), { v: "bike" }); },
    step: function (st, L, H) { gateStep(st, L, H, L.gates, 1, 10); act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; L.stalls.forEach(function (gi, j) { var g = L.gates[gi]; if (dd(q, g) < 9) st.x.sv[p] = (st.x.sv[p] || 0) | (1 << j); }); }); },
    over: function (st, L) { var f0 = firstDone(st.x.f); return allDone(st, st.x.f) || (f0 != null && st.t > f0 + 40); },
    rank: function (st, L, H) { var x = st.x, en = (H && H.en) || {}; return gateRank(st, L, L.gates).sort(function (a, b) { var fa = x.f[a], fb = x.f[b]; if (fa != null && fb != null && Math.abs(fa - fb) < .5) return (en[b] || 0) - (en[a] || 0); return 0; }); },
    task: function (st, L, p) { var t = gateTask(st, L, p, L.gates, 1, L.name + ": gate"); L.stalls.forEach(function (gi, j) { var g = L.gates[gi]; t.mk.push({ x: g.x, y: g.y, c: (st.x.sv[p] >> j) & 1 ? "#64748b" : "#86efac", r: 6, l: "FOOD" }); }); return t; } });

  mission({ id: "F5", g: "race", name: "The Long Road", what: "Point to point from the Main Gate to Phase 2, traffic on. Hitting walkers costs 5 seconds.", comp: true,
    layout: function (r, c) { var via = ["gate", "checkpoint", "stalls", "p2park"].filter(exists).map(function (id) { return spot(c.W, id, true); }), p = chain(c.W, via, true);
      return { gates: sample(p, 260), len: plen(p), veh: c.mut.ride || c.opt.veh || "car", wx: pick(r, ["day", "dusk", "night"]) }; },
    init: function (st) { st.x = { g: {}, l: {}, f: {}, pen: {} }; }, dur: function (L) { return Math.round(L.len / 10 + 90); },
    start: function (L, rd, i) { var g = L.gates[0], g1 = L.gates[1] || g; return Object.assign(grid({ x: g.x, y: g.y, a: Math.atan2(g1.y - g.y, g1.x - g.x) }, i), { v: L.veh }); },
    step: function (st, L, H) { gateStep(st, L, H, L.gates, 1, 14); }, claim: function (st, L, H, p, c) { if (c.o === "pd" && st.x.f[p] == null) st.x.pen[p] = (st.x.pen[p] || 0) + 5; },
    over: function (st, L) { var f0 = firstDone(st.x.f); return allDone(st, st.x.f) || (f0 != null && st.t > f0 + 60); },
    rank: function (st, L) { return gateRank(st, L, L.gates); }, task: function (st, L, p) { var t = gateTask(st, L, p, L.gates, 1, "Phase 2 road: checkpoint"); if (st.x.pen[p]) t.txt += " · +" + st.x.pen[p] + " s"; return t; } });

  mission({ id: "F6", g: "race", name: "Skate Line", what: "Skateboards down the boulevard through trick gates. Round two: follow the leader.", comp: true,
    layout: function (r, c) { var gates = []; for (var i = 0; i < 14; i++) { var y = -770 + i * 32 + (r() - .5) * 10, x = (r() - .5) * 22; gates.push({ x: r1(x), y: r1(y) }); } return { gates: gates, veh: "skate" }; },
    rounds: function () { return 2; }, init: function (st) { st.x = { cd: {}, ld: 0, lt: {} }; }, dur: function () { return 95; },
    start: function (L, rd, i) { return Object.assign(grid({ x: 0, y: -790, a: Math.PI / 2 }, i), { v: "skate" }); },
    roundOver: function (st) { return st.rd === 0 ? st.rt >= 60 : st.rt >= 30; }, newRound: function (st) { st.x.ld = byScore(st)[0] || 0; st.x.cd = {}; st.x.lt = {}; },
    step: function (st, L, H) { var x = st.x; act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; L.gates.forEach(function (g, j) { var k = p + ":" + j; if (dd(q, g) < 4 && !(H.mem.cd[k] > st.t)) { H.mem.cd[k] = st.t + 3;
      if (st.rd === 0) sc(st, p, 1); else if (p === x.ld) { sc(st, p, 1); x.lt[j] = st.t; } else if (x.lt[j] != null && st.t - x.lt[j] <= 3) sc(st, p, 2); } }); }); },
    rank: byScore, task: function (st, L, p, V) { var best = null, bd = 1e9, q = V && V[p]; L.gates.forEach(function (g) { var d = q ? dd(q, g) : 0; if (d > 6 && d < bd) { bd = d; best = g; } }); best = best || L.gates[0];
      return { x: best.x, y: best.y, txt: st.rd === 0 ? "Hit trick gates for points" : (p === st.x.ld ? "You lead: everyone scores double behind you" : "Follow the leader through their gates (×2)"), mk: L.gates.map(function (g) { return { x: g.x, y: g.y, c: "#f97316", r: 4 }; }) }; } });

  mission({ id: "F7", g: "fly", name: "Formation", what: "Fly through rings together. A ring counts only when every plane passes within 4 seconds.", comp: false,
    layout: function (r, c) { var A = pick(r, [["campus", 0, -150], ["the Dam", 0, 520], ["the forest", 1150, 300]]), R = 14 + 4 * c.n.length, rings = []; for (var i = 0; i < 8; i++) { var a = i / 8 * TAU, rr = 330 + (i % 2) * 120; rings.push({ x: r1(A[1] + Math.cos(a) * rr), y: r1(A[2] + Math.sin(a) * rr) }); }
      var s = spot(c.W, "strip", true) || { x: -400, y: 545 }; return { rings: rings, R: R, area: A[0], strip: s }; },
    init: function (st) { st.x = { k: 0, ps: {} }; }, dur: function () { return 300; },
    start: function (L, rd, i) { return Object.assign(grid({ x: L.strip.x, y: L.strip.y, a: 0 }, i), { v: "plane" }); },
    step: function (st, L, H) { var x = st.x, g = L.rings[x.k]; if (!g) return; var ps = act(st); ps.forEach(function (p) { var q = H.pos[p]; if (q && q.z && dd(q, g) < L.R && x.ps[p] == null) x.ps[p] = r1(st.t); });
      var ts = ps.map(function (p) { return x.ps[p]; }).filter(function (v) { return v != null; }); if (!ts.length) return; var lo = Math.min.apply(null, ts);
      if (ts.length === ps.length && Math.max.apply(null, ts) - lo <= 4) { x.k++; x.ps = {}; ps.forEach(function (p) { sc(st, p, 1); }); H.say("ring"); } else if (st.t - lo > 4) x.ps = {}; },
    over: function (st, L) { return st.x.k >= L.rings.length; }, win: function (st, L) { return st.x.k >= L.rings.length; },
    task: function (st, L, p) { var g = L.rings[st.x.k] || L.rings[0], mk = L.rings.slice(st.x.k, st.x.k + 3).map(function (q, i) { return { x: q.x, y: q.y, c: i ? "rgba(34,211,238,.5)" : "#22d3ee", r: L.R, l: i ? "" : "RING " + (st.x.k + 1) }; });
      return { x: g.x, y: g.y, txt: "Ring " + (st.x.k + 1) + "/8 over " + L.area + ": all together, within 4 s" + (st.x.ps[p] != null ? " · you're through, waiting" : ""), mk: mk, veh: "plane", fly: 1 }; } });

  mission({ id: "F8", g: "fly", name: "Air Drop", what: "Pilots drop crates; drivers catch them under the parachutes. Roles rotate each round.", comp: false,
    layout: function (r, c) { var zs = shuffle(r, ["social", "selfie", "dam", "club", "geogarden", "court"].filter(exists)).slice(0, 3).map(function (id) { return spot(c.W, id, true); }), w = []; for (var i = 0; i < 3; i++) { var a = r() * TAU, s = 2 + r() * 4; w.push([r1(Math.cos(a) * s), r1(Math.sin(a) * s)]); }
      return { zones: zs, wind: w, np: c.n.length <= 3 ? 1 : 2, target: 4 + 3 * c.n.length, strip: spot(c.W, "strip", true) || { x: -400, y: 545 } }; },
    rounds: function () { return 3; }, init: function (st) { st.x = { c: 0, cr: [], m: 0, dn: 0 }; }, dur: function () { return 3 * 75; },
    pilots: function (st, L, rd) { var ps = st.n.slice().sort(function (a, b) { return a - b; }), out = []; for (var j = 0; j < L.np; j++) out.push(ps[(rd * L.np + j) % ps.length]); return out; },
    start: function (L, rd, i, st, p) { var pil = this.pilots(st, L, rd).indexOf(p) >= 0, z = L.zones[0]; return pil ? Object.assign(grid({ x: L.strip.x, y: L.strip.y, a: 0 }, i), { v: "plane" }) : Object.assign(grid({ x: z.x, y: z.y, a: 0 }, i), { v: "car" }); },
    roundOver: function (st) { return st.rt >= 70 || st.x.dn >= 10 && !st.x.cr.length; }, newRound: function (st) { st.x.cr = []; st.x.dn = 0; },
    claim: function (st, L, H, p, c) { var x = st.x; if (c.o !== "dr" || this.pilots(st, L, st.rd).indexOf(p) < 0 || x.dn >= 10) return; var q = H.pos[p]; if (!q || !q.z || H.mem.dcd[p] > st.t) return; if (dd(q, L.zones[st.rd % L.zones.length]) > 70) return;
      H.mem.dcd[p] = st.t + 3.5; var w = L.wind[st.rd]; x.cr.push([r1(q.x + w[0] * 8), r1(q.y + w[1] * 8), r1(st.t + 8), p]); x.dn++; },
    step: function (st, L, H) { var x = st.x, self = this, pil = self.pilots(st, L, st.rd); x.cr = x.cr.filter(function (c) { if (st.t < c[2]) return true; var who = null; act(st).forEach(function (p) { if (pil.indexOf(p) >= 0 || who) return; var q = H.pos[p]; if (q && Math.hypot(q.x - c[0], q.y - c[1]) < 10) who = p; });
      if (who) { x.c++; sc(st, who, 1); sc(st, c[3], .5); H.say("catch"); } else x.m++; return false; }); },
    over: function (st, L) { return false; }, win: function (st, L) { return st.x.c >= L.target; },
    task: function (st, L, p) { var x = st.x, pil = this.pilots(st, L, st.rd).indexOf(p) >= 0, zz = L.zones[st.rd % L.zones.length], mk = [{ x: zz.x, y: zz.y, c: "#86efac", r: 25, l: "DROP ZONE" }].concat(x.cr.map(function (c) { return { x: c[0], y: c[1], c: "#f97316", r: 6, l: "CRATE" }; }));
      var tail = " · caught " + x.c + "/" + L.target; if (pil) { var z = L.zones[st.rd % L.zones.length]; return { x: z.x, y: z.y, txt: "Pilot: fly low over the green zone and drop (" + (10 - x.dn) + " crates left)" + tail, act: { o: "dr" }, r: 80, lab: "Drop crate", mk: mk, veh: "plane", fly: 1 }; }
      var c0 = x.cr[0], z0 = L.zones[st.rd % L.zones.length]; return c0 ? { x: c0[0], y: c0[1], txt: "Catch the crate before it lands" + tail, mk: mk, veh: "car" } : { x: z0.x, y: z0.y, txt: "Driver: wait under the drop zone" + tail, mk: mk, veh: "car" }; } });

  mission({ id: "F9", g: "fly", name: "Sky Tag", what: "One plane is 'it' and trails smoke. Fly through the smoke to pass it on. Least time as 'it' wins.", comp: true, min: 3,
    layout: function (r, c) { return { strip: spot(c.W, "strip", true) || { x: -400, y: 545 }, ceil: pick(r, ["low", "high"]), first: Math.floor(r() * c.n.length) }; },
    init: function (st, L) { st.x = { it: st.n[L.first % st.n.length], im: {} }; }, dur: function () { return 240; },
    start: function (L, rd, i) { return Object.assign(grid({ x: L.strip.x, y: L.strip.y, a: 0 }, i), { v: "plane" }); },
    step: function (st, L, H, dt) { var x = st.x, it = x.it; if (st.gone && st.gone[it]) x.it = it = act(st)[0]; sc(st, it, dt); var q = H.pos[it]; if (!q) return; var tr = H.mem.tr || (H.mem.tr = []); if (H.every(.5)) { tr.push([q.x, q.y, st.t]); while (tr.length > 16) tr.shift(); }
      act(st).forEach(function (p) { if (p === it || x.im[p] > st.t) return; var o = H.pos[p]; if (!o || !o.z) return; for (var i = 0; i < tr.length; i++) if (st.t - tr[i][2] >= .6 && Math.hypot(o.x - tr[i][0], o.y - tr[i][1]) < 8) { x.im[it] = r1(st.t + 4); x.it = p; H.mem.tr = []; H.say("tag", p); return; } }); },
    rank: function (st) { return st.n.slice().sort(function (a, b) { return (st.sc[a] || 0) - (st.sc[b] || 0) || a - b; }); },
    task: function (st, L, p, V) { var it = st.x.it; if (p === it) { var best = null, bd = 1e9; Object.keys(V || {}).forEach(function (k) { if (+k === p) return; var q = V[k], d = V[p] ? dd(q, V[p]) : 0; if (d < bd) { bd = d; best = q; } }); return { x: best ? best.x : L.strip.x, y: best ? best.y : L.strip.y, txt: "You're IT: lead someone into your smoke", mk: [], veh: "plane", fly: 1 }; }
      var q2 = V && V[it]; return { x: q2 ? q2.x : L.strip.x, y: q2 ? q2.y : L.strip.y, txt: "Fly through the IT plane's smoke trail to pass it on (" + Math.round(st.sc[p] || 0) + " s as IT)", mk: q2 ? [{ x: q2.x, y: q2.y, c: "#f43f5e", r: 8, l: "IT" }] : [], veh: "plane", fly: 1 }; } });

  mission({ id: "F10", g: "hunt", name: "Kola Rush", what: "A hundred kola nuts across one district. Grab the most. A golden nut worth 10 appears at the end.", comp: true,
    layout: function (r, c) { var b = district(r), nuts = []; for (var i = 0; i < 100; i++) nuts.push(walkPoint(c.W, r, b)); return { box: b, nuts: nuts, gold: walkPoint(c.W, r, b), teams: !!c.opt.tm && c.n.length >= 4 }; },
    init: function (st, L) { st.x = { tk: bits([]), gd: 0 }; if (L.teams) st.n.slice().sort(function (a, b) { return a - b; }).forEach(function (p, i) { st.tm[p] = i % 2; }); }, dur: function () { return 180; },
    start: function (L, rd, i) { return grid({ x: L.box.cx, y: L.box.cy, a: 0 }, i); },
    step: function (st, L, H) { var x = st.x, tk = unbits(x.tk, 100), ch = false; act(st).forEach(function (p) { var q = H.pos[p]; if (!q || q.v === "plane") return; for (var i = 0; i < 100; i++) if (!tk[i] && dd(q, L.nuts[i]) < 3) { tk[i] = true; sc(st, p, 1); ch = true; }
      if (x.gd === 1 && dd(q, L.gold) < 3) { x.gd = 2; sc(st, p, 10); H.say("gold", p); } }); if (ch) x.tk = bits(tk); if (x.gd === 0 && st.t >= 150) { x.gd = 1; H.say("goldup"); } },
    over: function (st) { return unbits(st.x.tk, 100).every(Boolean) && st.x.gd === 2; },
    rank: function (st, L) { if (!L.teams) return byScore(st); var ind = {}; st.n.forEach(function (p) { ind[p] = st.sc[p] || 0; }); var ts = [0, 0]; st.n.forEach(function (p) { ts[st.tm[p] || 0] += ind[p]; }); var w = ts[0] >= ts[1] ? 0 : 1; return st.n.slice().sort(function (a, b) { return ((st.tm[a] === w) ? 0 : 1) - ((st.tm[b] === w) ? 0 : 1) || ind[b] - ind[a] || a - b; }); },
    task: function (st, L, p, V) { var tk = unbits(st.x.tk, 100), q = V && V[p], best = null, bd = 1e9, mk = []; for (var i = 0; i < 100; i++) { if (tk[i]) continue; var d = q ? dd(q, L.nuts[i]) : i; if (d < 80) mk.push({ x: L.nuts[i].x, y: L.nuts[i].y, c: "#a16207", r: 1.2 }); if (d < bd) { bd = d; best = L.nuts[i]; } }
      if (st.x.gd === 1) { mk.push({ x: L.gold.x, y: L.gold.y, c: "#fde047", r: 3, l: "GOLDEN NUT" }); if (!best || (q && dd(q, L.gold) < bd * 2)) best = L.gold; }
      best = best || { x: L.box.cx, y: L.box.cy }; return { x: best.x, y: best.y, txt: "Grab kola nuts in " + L.box.label + " (" + Math.round(st.sc[p] || 0) + ")", mk: mk }; } });

  mission({ id: "F11", g: "hunt", name: "Treasure Riddle", what: "Kabiru reads a riddle on the radio. It names a place. First there scores. Five riddles.", comp: true, noTele: true,
    layout: function (r, c) { var rs = shuffle(r, RIDDLES.filter(function (q) { return exists(q[1]); })).slice(0, 5); return { rid: rs.map(function (q) { var s = spot(c.W, q[1], false); return { t: q[0], x: s.x, y: s.y, name: s.name }; }), start: spot(c.W, "selfie", false) }; },
    rounds: function () { return 5; }, init: function (st) { st.x = { ar: [] }; }, newRound: function (st) { st.x.ar = []; }, dur: function () { return 5 * 80; },
    start: function (L, rd, i) { return grid({ x: L.start.x, y: L.start.y, a: 0 }, i); },
    step: function (st, L, H) { var g = L.rid[st.rd], x = st.x, PTS = [3, 2, 1]; act(st).forEach(function (p) { var q = H.pos[p]; if (q && x.ar.indexOf(p) < 0 && dd(q, g) < 16) { if (x.ar.length < 3) sc(st, p, PTS[x.ar.length]); x.ar.push(p); H.say("arrive", p); } }); },
    roundOver: function (st) { return st.x.ar.length >= Math.min(3, act(st).length) || st.rt >= 75; },
    rank: byScore, task: function (st, L, p) { var g = L.rid[st.rd] || L.rid[0], hint = st.rt > 40; return { x: g.x, y: g.y, hide: !hint, txt: "Riddle " + (st.rd + 1) + "/5: " + g.t + (hint ? "  (Hint: " + g.name + ")" : ""), mk: hint ? [{ x: g.x, y: g.y, c: "#fde047", r: 16, l: g.name }] : [] }; } });

  function photoOk(s, ctx) { // can this subject be photographed right now by ctx.p? (the host's view of every player)
    var me = ctx.V[ctx.p]; if (!me) return false; var place = s.p ? PL(s.p) : null, here = !place || Math.hypot(me.x - place.x, me.y - place.y) < (s.k === "pl" || s.k === "tm" ? 45 : 40);
    if (!here) return false; var others = Object.keys(ctx.V).filter(function (k) { return +k !== ctx.p; }).map(function (k) { return ctx.V[k]; });
    if (s.k === "pl") return true; if (s.k === "tm") return hourIn(ctx.hour == null ? 12 : ctx.hour, s.a, s.b);
    if (s.k === "em") return others.some(function (o) { return o.e === s.e && dd(o, me) < 25; });
    if (s.k === "vh") return others.some(function (o) { return o.v === s.v && dd(o, me) < 30; });
    if (s.k === "gp") return others.filter(function (o) { return dd(o, me) < 12; }).length + 1 >= Math.min(s.c, Object.keys(ctx.V).length);
    if (s.k === "me") return me.v === s.v; return false; }
  C.photoOk = photoOk;
  mission({ id: "F12", g: "hunt", name: "Photo Hunt", what: "Six things to photograph. Co-op: finish the list. Versus: first to four.", comp: false, vsOpt: true,
    layout: function (r, c) { var vs = !!c.opt.vs, pool = PHOTO.map(function (s, i) { return i; }).filter(function (i) { var s = PHOTO[i]; return (!s.p || exists(s.p)) && (!vs || s.k === "pl" || s.k === "tm" || s.k === "me") && !(s.k === "gp" && s.c > c.n.length); }); return { list: shuffle(r, pool).slice(0, 6), vs: vs }; },
    init: function (st) { st.x = { dn: {}, all: 0 }; }, dur: function () { return 300; },
    start: function (L, rd, i) { return grid({ x: 0, y: -165, a: 0 }, i); },
    claim: function (st, L, H, p, c) { if (c.o !== "ph") return; var k = c.k | 0, s = PHOTO[L.list[k]]; if (!s) return; var hr = +c.h; if (!photoOk(s, { p: p, V: H.pos, hour: isFinite(hr) ? hr : 12 })) return;
      var x = st.x; if (L.vs) { var m = x.dn[p] || 0; if (!((m >> k) & 1)) { x.dn[p] = m | (1 << k); sc(st, p, 1); H.say("snap", p); } } else if (!((x.all >> k) & 1)) { x.all |= 1 << k; sc(st, p, 1); H.say("snap", p); } },
    over: function (st, L) { var x = st.x; if (L.vs) return Object.keys(x.dn).some(function (p) { var m = x.dn[p], n = 0; for (var i = 0; i < 6; i++) n += (m >> i) & 1; return n >= 4; }); return x.all === 63; },
    win: function (st, L) { return L.vs || st.x.all === 63; }, rank: byScore, comp2: function (L) { return L.vs; },
    task: function (st, L, p, V) { var x = st.x, mask = L.vs ? x.dn[p] || 0 : x.all, ps = act(st).slice().sort(function (a, b) { return a - b; }), snapper = L.vs ? p : ps[0];
      for (var k = 0; k < L.list.length; k++) { if ((mask >> k) & 1) continue; var s = PHOTO[L.list[k]], pl = s.p ? PL(s.p) : null, sp = pl ? { x: pl.x, y: pl.y } : (V && V[snapper]) || { x: 0, y: -165 };
        var hours = s.k === "tm" ? " (" + s.a + ":00–" + Math.floor(s.b) + ":00)" : "", list = L.list.map(function (j, i) { return ((mask >> i) & 1 ? "✓ " : "· ") + PHOTO[j].t; }).join("  ");
        if (p !== snapper && (s.k === "em" || s.k === "vh")) return { x: sp.x, y: sp.y, txt: "Pose for the photo: " + s.t + " — " + (s.k === "em" ? "press " + s.e : "ride a " + VNAME[s.v]) + " near " + (V && V[snapper] ? "the photographer" : "them"), act: s.k === "em" ? { o: "emote", e: s.e } : null, r: 30, veh: s.k === "vh" ? s.v : undefined, list: list };
        if (p !== snapper && s.k !== "gp") return { x: sp.x, y: sp.y, txt: "Help find: " + s.t + hours, list: list };
        return { x: sp.x, y: sp.y, txt: "Photograph: " + s.t + hours, act: { o: "ph", k: k }, r: 40, lab: "Snap photo", veh: s.k === "me" ? s.v : undefined, list: list, mk: pl ? [{ x: pl.x, y: pl.y, c: "#f0abfc", r: 12, l: "📷" }] : [] }; }
      return { txt: "List complete!", mk: [] }; } });

  mission({ id: "F13", g: "hunt", name: "Lost and Found", what: "Lost items and their owners. Return everything before dusk.", comp: false,
    layout: function (r, c) { var D = Dd(), n = 6 + 2 * c.n.length, owners = shuffle(r, ["akenzua", "ribadu", "amina", "suleiman", "shinkafi", "library", "bookshop", "social", "senate", "buka", "physics", "ee", "compsci", "chapel", "mosque", "bank"].filter(exists)), names = (D.NAMES && D.NAMES.length ? D.NAMES : ["Ada", "Sadiq", "Musa", "Joy"]), kinds = ["ID card", "slippers", "flash drive", "calculator", "notebook", "phone charger", "lab coat", "umbrella", "water bottle", "keys", "earphones", "textbook"], its = [];
      for (var i = 0; i < n; i++) { var o = owners[i % owners.length], op = spot(c.W, o, false), dp = walkPoint(c.W, r, { x0: op.x - 160, y0: op.y - 160, x1: op.x + 160, y1: op.y + 160, cx: op.x, cy: op.y }); its.push({ k: kinds[i % kinds.length], w: String(pick(r, names)), x: dp.x, y: dp.y, ox: op.x, oy: op.y, on: op.name }); }
      return { items: its }; },
    init: function (st, L) { st.x = { s: L.items.map(function () { return "0"; }).join("") }; }, dur: function (L) { return 240 + 30 * L.items.length; },
    start: function (L, rd, i) { return Object.assign(grid({ x: 0, y: -165, a: 0 }, i), { v: "bike" }); },
    step: function (st, L, H) { var x = st.x, s = x.s.split(""), ch = false, idx = {}; st.n.forEach(function (p, i) { idx[p] = "abcdef"[i]; });
      act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; L.items.forEach(function (it, i) { if (s[i] === "0" && dd(q, it) < 3.5) { s[i] = idx[p]; ch = true; } else if (s[i] === idx[p] && Math.hypot(q.x - it.ox, q.y - it.oy) < 7) { s[i] = "1"; sc(st, p, 1); ch = true; H.say("return", p); } }); });
      st.n.forEach(function (p) { if (st.gone && st.gone[p]) for (var i = 0; i < s.length; i++) if (s[i] === idx[p]) { s[i] = "0"; ch = true; } }); if (ch) x.s = s.join(""); },
    over: function (st) { return st.x.s.split("").every(function (c) { return c === "1"; }); }, win: function (st) { return st.x.s.split("").every(function (c) { return c === "1"; }); },
    task: function (st, L, p, V) { var s = st.x.s, me = "abcdef"[st.n.indexOf(p)], q = V && V[p], best = null, bd = 1e9, carry = 0, mk = [];
      L.items.forEach(function (it, i) { if (s[i] === me) { carry++; var d = q ? Math.hypot(q.x - it.ox, q.y - it.oy) : 0; mk.push({ x: it.ox, y: it.oy, c: "#86efac", r: 6, l: it.w }); if (d < bd) { bd = d; best = { x: it.ox, y: it.oy, t: "Return the " + it.k + " to " + it.w + " at " + it.on }; } } });
      if (!best) L.items.forEach(function (it, i) { if (s[i] !== "0") return; mk.push({ x: it.x, y: it.y, c: "#fbbf24", r: 2, l: it.k }); var d = q ? dd(q, it) : i; if (d < bd) { bd = d; best = { x: it.x, y: it.y, t: "Pick up the lost " + it.k + " (" + it.w + "'s)" }; } });
      var left = s.split("").filter(function (c) { return c !== "1"; }).length; return best ? { x: best.x, y: best.y, txt: best.t + (carry ? " · carrying " + carry : "") + " · " + left + " left", mk: mk } : { txt: left ? "Your friends have the rest" : "All returned!", mk: mk }; } });

  mission({ id: "F14", g: "hunt", name: "Hide and Seek", what: "One seeker with a torch. Hiders may move only while the torch is off.", comp: true, min: 3, noTele: false,
    layout: function (r, c) { var b = district(r), spots = []; for (var i = 0; i < 12; i++) spots.push(walkPoint(c.W, r, b)); return { box: b, spots: spots, night: r() < .5 }; },
    rounds: function (L, st) { return Math.min(st ? st.n.length : 3, 3); }, init: function (st) { st.x = { sk: st.n[0], fd: "", hd: 15 }; }, dur: function () { return 3 * 175; },
    newRound: function (st) { var ps = st.n.slice().sort(function (a, b) { return a - b; }); st.x.sk = ps[st.rd % ps.length]; st.x.fd = ""; }, roundStart: function (st) { var ps = st.n.slice().sort(function (a, b) { return a - b; }); st.x.sk = ps[st.rd % ps.length]; st.x.fd = ""; },
    start: function (L, rd, i) { return grid({ x: L.box.cx, y: L.box.cy, a: 0 }, i); },
    step: function (st, L, H, dt) { var x = st.x, sk = x.sk, q = H.pos[sk], fd = unbits(x.fd, 6), ch = false; if (st.rt < 15 || !q) return; var torch = H.me[sk] && H.me[sk].torch;
      act(st).forEach(function (p, i) { var k = st.n.indexOf(p); if (p === sk || fd[k]) return; var o = H.pos[p]; if (!o) return; var d = dd(o, q), ad = Math.abs(ang(Math.atan2(o.y - q.y, o.x - q.x) - (q.a || 0))), moving = (o.s || 0) > 1.2;
        var oob = !inBox(L.box, o); H.mem.oob[p] = oob ? (H.mem.oob[p] || 0) + dt : 0;
        if ((torch && ((d < 10 && ad < .7) || (moving && d < 25))) || H.mem.oob[p] > 5) { fd[k] = true; ch = true; sc(st, sk, 2); H.say("found", p); } }); if (ch) x.fd = bits(fd); },
    roundOver: function (st) { var fd = unbits(st.x.fd, 6), left = act(st).filter(function (p) { return p !== st.x.sk && !fd[st.n.indexOf(p)]; }); return st.rt >= 165 || (st.rt > 15 && !left.length); },
    endRound: function (st) { var fd = unbits(st.x.fd, 6); act(st).forEach(function (p) { if (p !== st.x.sk && !fd[st.n.indexOf(p)]) sc(st, p, 3); }); },
    rank: byScore, task: function (st, L, p, V) { var x = st.x, seek = p === x.sk, hide = st.rt < 15;
      if (seek) { if (hide) return { x: L.box.cx, y: L.box.cy, txt: "Seeker: cover your eyes and count… " + Math.max(0, Math.ceil(15 - st.rt)), mk: [] }; var sp = L.spots[Math.floor(st.rt / 9) % L.spots.length]; return { x: sp.x, y: sp.y, hide: true, txt: "Seek in " + L.box.label + " with your torch on (F)", torch: 1, mk: [] }; }
      if (unbits(x.fd, 6)[st.n.indexOf(p)]) return { txt: "Found! Watch the seeker hunt the rest.", mk: [] }; var h = L.spots[(st.n.indexOf(p) * 5 + st.rd * 3) % L.spots.length];
      return { x: h.x, y: h.y, hide: !hide, txt: hide ? "Hide in " + L.box.label + "! " + Math.ceil(15 - st.rt) + " s" : "Stay hidden. Move only while the seeker's torch is off.", mk: [{ x: L.box.cx, y: L.box.cy, c: "rgba(148,163,184,.4)", r: Math.max(L.box.x1 - L.box.x0, L.box.y1 - L.box.y0) / 2 }] }; } });

  mission({ id: "F15", g: "hunt", name: "Garri Run", what: "The hostel is out of garri. Bring back the most cups without spilling.", comp: true, teams: 2,
    layout: function (r, c) { var shops = shuffle(r, ["shinkafi", "buka", "market", "mk_supermarket", "p2shops", "bookshop", "shayi"].filter(exists)).slice(0, 4).map(function (id) { return spot(c.W, id, false); }); return { shops: shops, stock: 3 + c.n.length, road: pick(r, ["dry", "dusty", "potholes"]) }; },
    init: function (st, L, H) { var hm = {}; st.n.forEach(function (p) { var h = H && H.me[p] && H.me[p].hm; if (h && exists(h)) (hm[h] = hm[h] || []).push(p); }); var groups = Object.keys(hm).map(function (k) { return { h: k, ps: hm[k] }; }).sort(function (a, b) { return b.ps.length - a.ps.length || (a.h < b.h ? -1 : 1); });
      var homes, ps = st.n.slice().sort(function (a, b) { return a - b; }); if (groups.length >= 2) { homes = [groups[0].h, groups[1].h]; ps.forEach(function (p) { var g = -1; groups.forEach(function (gr, i) { if (gr.ps.indexOf(p) >= 0) g = i; }); st.tm[p] = g === 0 ? 0 : g === 1 ? 1 : (teamsOf(st, 2)[0].length <= teamsOf(st, 2)[1].length ? 0 : 1); }); }
      else { homes = [groups[0] ? groups[0].h : "akenzua", groups[0] && groups[0].h === "amina" ? "akenzua" : "amina"]; ps.forEach(function (p, i) { st.tm[p] = i % 2; }); }
      st.x = { hm: homes, sk: L.shops.map(function () { return L.stock; }), cr: {}, tc: [0, 0] }; },
    roundStart: function (st, L, H) { if (st.rd === 0) this.init(st, L, H); },
    dur: function () { return 240; }, start: function (L, rd, i, st, p) { var h = spot(L.W, (st.x.hm || [])[st.tm[p] || 0], false) || { x: 0, y: -300 }; return grid({ x: h.x, y: h.y, a: 0 }, i); },
    home: function (st, W, T) { return spot(W, st.x.hm[T], false); },
    step: function (st, L, H) { var x = st.x, self = this; act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; var c = x.cr[p] || 0;
      L.shops.forEach(function (s, j) { if (c < 4 && x.sk[j] > 0 && dd(q, s) < 7 && !(H.mem.pk[p] > st.t)) { H.mem.pk[p] = st.t + 1.2; x.sk[j]--; c++; } });
      var T = st.tm[p] || 0, h = self.home(st, H.W, T); if (c && h && dd(q, h) < 9) { x.tc[T] += c; sc(st, p, c); c = 0; H.say("garri", p); } x.cr[p] = c; }); },
    claim: function (st, L, H, p, c) { if (c.o === "bp" && st.x.cr[p] > 0) { st.x.cr[p]--; H.say("spill", p); } },
    over: function (st) { return st.x.sk.every(function (v) { return !v; }) && act(st).every(function (p) { return !st.x.cr[p]; }); },
    rank: function (st) { var x = st.x, w = x.tc[0] >= x.tc[1] ? 0 : 1; return st.n.slice().sort(function (a, b) { return ((st.tm[a] === w) ? 0 : 1) - ((st.tm[b] === w) ? 0 : 1) || (st.sc[b] || 0) - (st.sc[a] || 0) || a - b; }); },
    task: function (st, L, p, V, W) { var x = st.x, c = x.cr[p] || 0, T = st.tm[p] || 0, h = this.home(st, W, T), q = V && V[p], mk = L.shops.map(function (s, j) { return { x: s.x, y: s.y, c: x.sk[j] ? "#fde68a" : "#64748b", r: 6, l: x.sk[j] + " cups" }; });
      if (h) mk.push({ x: h.x, y: h.y, c: "#86efac", r: 9, l: "YOUR HOSTEL" }); var tail = " · team " + x.tc[T] + " vs " + x.tc[1 - T];
      if (c >= 4 || (c && !x.sk.some(Boolean))) return { x: h.x, y: h.y, txt: "Carry " + c + " cups home without bumping anything" + tail, mk: mk };
      var best = null, bd = 1e9; L.shops.forEach(function (s, j) { if (!x.sk[j]) return; var d = q ? dd(q, s) : j; if (d < bd) { bd = d; best = s; } }); return best ? { x: best.x, y: best.y, txt: "Buy garri at " + best.name + " (" + c + "/4 cups)" + tail, mk: mk } : { x: h ? h.x : 0, y: h ? h.y : 0, txt: "Shops are empty" + tail, mk: mk }; } });

  mission({ id: "F16", g: "sport", name: "Court Sparring", what: "Friendly sparring in the ring. Knocked down means 10 seconds out. Shake hands after.", comp: true,
    layout: function (r, c) { var s = spot(c.W, "court", false) || { x: -262, y: -470 }; return { c: s, R: pick(r, [7, 9, 11]), sl: r() < .25, tag: c.n.length === 4 || c.n.length === 6 }; },
    init: function (st, L) { st.x = { hp: {}, out: {}, ac: [] }; if (L.tag) { st.n.slice().sort(function (a, b) { return a - b; }).forEach(function (p, i) { st.tm[p] = Math.floor(i / 2); }); var t = teamsOf(st, st.n.length / 2); st.x.ac = t.map(function (g) { return g[0]; }); } st.n.forEach(function (p) { st.x.hp[p] = 100; }); },
    dur: function () { return 180; }, start: function (L, rd, i, st, p) { var a = i / st.n.length * TAU; return { x: r1(L.c.x + Math.cos(a) * L.R * .6), y: r1(L.c.y + Math.sin(a) * L.R * .6), a: a + Math.PI, v: "" }; },
    fighting: function (st, L, p) { return !L.tag || st.x.ac.indexOf(p) >= 0; },
    claim: function (st, L, H, p, c) { var x = st.x; if (c.o === "tg" && L.tag) { var T = st.tm[p], cur = x.ac[T], q = H.pos[p], o = H.pos[cur]; if (cur !== p && q && o && dd(q, o) < 3.5) x.ac[T] = p; return; }
      if (c.o !== "ht") return; var to = +c.to, w = c.w; if (!this.fighting(st, L, p) || !this.fighting(st, L, to) || to === p || st.n.indexOf(to) < 0) return; if (x.out[p] > st.t || x.out[to] > st.t || H.mem.hcd[p] > st.t) return; if (L.sl && w !== "s") return;
      var a = H.pos[p], b = H.pos[to]; if (!a || !b || dd(a, b) > (w === "s" ? 13 : 3.6) || dd(a, L.c) > L.R + 2 || dd(b, L.c) > L.R + 2) return; H.mem.hcd[p] = st.t + .35;
      var dmg = w === "k" ? 18 : w === "s" ? 10 : 12, me = H.me[to]; if (me && me.blk && H.now - (me.at || 0) < .8) dmg = Math.round(dmg * .3); x.hp[to] = (x.hp[to] == null ? 100 : x.hp[to]) - dmg;
      if (x.hp[to] <= 0) { x.hp[to] = 100; x.out[to] = r1(st.t + 10); sc(st, p, 1); H.say("ko", p, to); } },
    rank: function (st, L) { if (!L.tag) return byScore(st); var ts = {}; st.n.forEach(function (p) { ts[st.tm[p]] = (ts[st.tm[p]] || 0) + (st.sc[p] || 0); }); return st.n.slice().sort(function (a, b) { return ts[st.tm[b]] - ts[st.tm[a]] || (st.tm[a] - st.tm[b]) || (st.sc[b] || 0) - (st.sc[a] || 0) || a - b; }); },
    task: function (st, L, p, V) { var x = st.x; if (x.out[p] > st.t) return { x: L.c.x, y: L.c.y, txt: "Knocked down! Back in " + Math.ceil(x.out[p] - st.t) + " s", mk: [] };
      if (!this.fighting(st, L, p)) { var cur = x.ac[st.tm[p]]; var q0 = V && V[cur]; return { x: q0 ? q0.x : L.c.x, y: q0 ? q0.y : L.c.y, txt: "Tag partner: get close to them and tag in", act: { o: "tg" }, r: 3, lab: "Tag in", mk: [] }; }
      var me = V && V[p], best = null, bd = 1e9, self = this; st.n.forEach(function (o) { if (o === p || !self.fighting(st, L, o) || x.out[o] > st.t || (L.tag && st.tm[o] === st.tm[p])) return; var q = V && V[o]; var d = q && me ? dd(q, me) : 0; if (q && d < bd) { bd = d; best = o; } });
      var q = best != null && V ? V[best] : null; return { x: q ? q.x : L.c.x, y: q ? q.y : L.c.y, txt: (L.sl ? "Slipper round: throw (K) only" : "Spar: punch J, kick L, block B") + " · HP " + Math.max(0, x.hp[p] || 100) + " · KOs " + (st.sc[p] || 0), act: best != null ? { o: "ht", to: best, w: L.sl ? "s" : "p" } : null, r: L.sl ? 12 : 2.6, lab: L.sl ? "Throw" : "Punch", mk: [{ x: L.c.x, y: L.c.y, c: "rgba(239,68,68,.5)", r: L.R }] }; } });

  var FRIENDS = ["Sadiq", "Ada", "Yakubu", "Fatima", "Bolaji", "Kelechi"];
  mission({ id: "F17", g: "sport", name: "Five-a-Side", what: "Small-pitch football, two halves. Missing places are filled by friends from the story.", comp: true, teams: 2,
    layout: function (r, c) { var kind = pick(r, ["grass", "court", "car park"]), cen = kind === "grass" ? free(c.W, 0, -150) : kind === "court" ? (spot(c.W, "court", false) || { x: -262, y: -470 }) : free(c.W, 5, -815), sz = kind === "grass" ? [44, 26] : kind === "court" ? [30, 16] : [36, 20];
      var ps = c.n.slice().sort(function (a, b) { return a - b; }), na = Math.ceil(ps.length / 2), nb = ps.length - na; return { c: { x: r1(cen.x), y: r1(cen.y) }, w: sz[0], h: sz[1], gw: kind === "court" ? 2.4 : 3.2, kind: kind, ai: [Math.max(0, 3 - na), Math.max(0, 3 - nb)], rain: r() < .3 }; },
    rounds: function () { return 2; }, dur: function () { return 250; },
    init: function (st, L) { st.n.slice().sort(function (a, b) { return a - b; }).forEach(function (p, i) { st.tm[p] = i % 2; }); var ai = []; [0, 1].forEach(function (T) { for (var i = 0; i < L.ai[T]; i++) ai.push([r1(L.c.x + (T ? 1 : -1) * L.w * (.15 + .15 * i)), r1(L.c.y + (i - .5) * 5), T]); }); st.x = { b: [L.c.x, L.c.y, 0, 0], g: [0, 0], ai: ai, kt: null, lt: 0 }; },
    newRound: function (st, L) { st.x.b = [L.c.x, L.c.y, 0, 0]; }, roundOver: function (st) { return st.rt >= 120; },
    start: function (L, rd, i, st, p) { var T = st.tm[p] || 0, k = teamsOf(st, 2)[T].indexOf(p); return { x: r1(L.c.x + (T ? 1 : -1) * L.w * (.12 + .12 * k)), y: r1(L.c.y + (k - 1) * 4), a: T ? Math.PI : 0, v: "" }; },
    goal: function (T, L) { return { x: L.c.x + (T ? -1 : 1) * L.w / 2, y: L.c.y }; }, // team T attacks this goal
    kick: function (st, L, who, a, pw) { var b = st.x.b, sp = 9 + 12 * clamp(pw, 0, 1); b[2] = Math.cos(a) * sp; b[3] = Math.sin(a) * sp; st.x.lt = who; },
    step: function (st, L, H, dt) { var x = st.x, b = x.b, self = this, k = Math.exp(-1.4 * dt); b[0] += b[2] * dt; b[1] += b[3] * dt; b[2] *= k; b[3] *= k;
      if (Math.abs(b[1] - L.c.y) > L.h / 2) { b[1] = L.c.y + Math.sign(b[1] - L.c.y) * L.h / 2; b[3] = -b[3] * .6; }
      if (Math.abs(b[0] - L.c.x) > L.w / 2) { var T = b[0] > L.c.x ? 0 : 1; if (Math.abs(b[1] - L.c.y) < L.gw) { x.g[T]++; var sc0 = x.lt; if (typeof sc0 === "number" && st.n.indexOf(sc0) >= 0 && st.tm[sc0] === T) H.mem.gl[sc0] = (H.mem.gl[sc0] || 0) + 1; H.say("goal", T); b[0] = L.c.x; b[1] = L.c.y; b[2] = b[3] = 0; } else { b[0] = L.c.x + Math.sign(b[0] - L.c.x) * L.w / 2; b[2] = -b[2] * .5; } }
      x.ai.forEach(function (a, i) { var g = self.goal(a[2], L), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), sp = 5.2; if (d > .8) { a[0] = r1(a[0] + dx / d * sp * dt); a[1] = r1(a[1] + dy / d * sp * dt); }
        if (d < 1.5 && !(H.mem.ak[i] > st.t)) { H.mem.ak[i] = st.t + 1; self.kick(st, L, "ai" + i, Math.atan2(g.y - b[1] + (H.r() - .5) * 4, g.x - b[0]), .6); } });
      act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; var d = Math.hypot(q.x - b[0], q.y - b[1]); if (d < 1.1 && (q.s || 0) > .5) { b[2] += (Math.cos(q.a) * (q.s || 0) * 1.1 - b[2]) * .3; b[3] += (Math.sin(q.a) * (q.s || 0) * 1.1 - b[3]) * .3; x.lt = p; } });
      b[0] = r1(b[0]); b[1] = r1(b[1]); b[2] = r1(b[2]); b[3] = r1(b[3]); },
    claim: function (st, L, H, p, c) { if (c.o !== "kk") return; var q = H.pos[p], b = st.x.b; if (!q || Math.hypot(q.x - b[0], q.y - b[1]) > 3.4 || H.mem.kc[p] > st.t) return; H.mem.kc[p] = st.t + .4; this.kick(st, L, p, +c.a || 0, +c.p || .5); },
    rank: function (st) { var g = st.x.g, w = g[0] >= g[1] ? 0 : 1; st.n.forEach(function (p) { st.sc[p] = g[st.tm[p] || 0]; }); return st.n.slice().sort(function (a, b) { return ((st.tm[a] === w) ? 0 : 1) - ((st.tm[b] === w) ? 0 : 1) || a - b; }); },
    task: function (st, L, p) { var b = st.x.b, T = st.tm[p] || 0, g = this.goal(T, L); return { x: b[0], y: b[1], txt: (st.rd ? "Second half" : "First half") + " · " + st.x.g[T] + " – " + st.x.g[1 - T] + " · run into the ball to dribble, G to shoot", act: { o: "kk", a: r1(Math.atan2(g.y - b[1], g.x - b[0])), p: .9 }, r: 2.6, lab: "Shoot", mk: [{ x: b[0], y: b[1], c: "#fff", r: .6, l: "⚽" }, { x: g.x, y: g.y, c: "#fde047", r: L.gw, l: "GOAL" }] }; } });

  mission({ id: "F18", g: "sport", name: "Hoops", what: "Half-court shoot-out from five spots. Round two: the hoop moves.", comp: true,
    layout: function (r, c) { var h = spot(c.W, "court", false) || { x: -262, y: -470 }, sp = []; for (var i = 0; i < 5; i++) { var a = -1 + i * .5 + (r() - .5) * .2, d = 4 + i; sp.push({ x: r1(h.x + Math.cos(a) * d), y: r1(h.y + Math.sin(a) * d), d: d }); } return { h: { x: h.x, y: h.y }, sp: sp, noise: Math.floor(r() * 1e6) }; },
    rounds: function () { return 2; }, init: function (st) { st.x = { tu: 0, tt: 0, mk: 0 }; }, newRound: function (st) { st.x.tu = 0; st.x.tt = 0; }, dur: function (L) { return 2 * 5 * 6 * 16; },
    order: function (st) { return act(st).slice().sort(function (a, b) { return a - b; }); },
    shooter: function (st) { var o = this.order(st); return { p: o[st.x.tu % o.length], k: Math.floor(st.x.tu / o.length) }; },
    start: function (L, rd, i) { return { x: r1(L.h.x - 9 + i * 1.8), y: r1(L.h.y + 7), a: -Math.PI / 2, v: "" }; },
    step: function (st, L, H, dt) { st.x.tt += dt; if (st.x.tt > 15) { st.x.tu++; st.x.tt = 0; H.say("miss"); } st.x.tt = r1(st.x.tt); },
    claim: function (st, L, H, p, c) { if (c.o !== "sh") return; var s = this.shooter(st); if (s.p !== p || s.k >= 5) return; var spt = L.sp[s.k], q = H.pos[p]; if (!q || dd(q, spt) > 2.6) return;
      var th = .45 + .05 * s.k + (st.rd ? .1 : 0), noise = (rng(L.noise + st.x.tu * 7 + st.rd * 101)() - .5) * .16; if (clamp(+c.q || 0, 0, 1) + noise >= th) { sc(st, p, 1); H.say("swish", p); } else H.say("miss"); st.x.tu++; st.x.tt = 0; },
    roundOver: function (st) { return this.shooter(st).k >= 5; }, rank: byScore,
    task: function (st, L, p) { var s = this.shooter(st), spt = L.sp[Math.min(4, s.k)]; if (s.p !== p) return { x: L.h.x - 6, y: L.h.y + 7, txt: (st.rd ? "Moving hoop! " : "") + "Watch the shooter. Your baskets: " + (st.sc[p] || 0), mk: [{ x: L.h.x, y: L.h.y, c: "#f97316", r: .8, l: "HOOP" }] };
      return { x: spt.x, y: spt.y, txt: "Your shot from spot " + (s.k + 1) + "/5 (" + spt.d + " m). Press G at the sweet spot.", act: { o: "sh" }, meter: 1, r: 2.4, lab: "Shoot", mk: [{ x: spt.x, y: spt.y, c: "#fde047", r: 1.2, l: "SPOT " + (s.k + 1) }, { x: L.h.x, y: L.h.y, c: "#f97316", r: .8, l: "HOOP" }] }; } });

  // rhythm scoring shared by the dance-off and the resonator: perfect 3, good 1, +1 every 8 in a row
  C.beats = function (bpm, secs) { return Math.floor(secs * bpm / 60); }; C.maxScore = function (beats) { return beats * 3 + Math.floor(beats / 8); };
  mission({ id: "F19", g: "sport", name: "Dance-Off", what: "The Floor's rhythm game, head to head. Three songs; the crowd breaks ties.", comp: true,
    layout: function (r, c) { var f = spot(c.W, "mk_dance", false) || free(c.W, 0, -930); return { f: f, bpm: [100, 116, 124], free: r() < .5, cheer: Math.floor(r() * 1e6) }; },
    rounds: function (L) { return L.free ? 4 : 3; }, init: function (st) { st.x = { cl: {} }; }, newRound: function (st) { st.x.cl = {}; }, dur: function (L) { return (L.free ? 4 : 3) * 40 + 10; },
    start: function (L, rd, i) { return grid({ x: L.f.x, y: L.f.y, a: 0 }, i); },
    claim: function (st, L, H, p, c) { if (c.o !== "sc" || (c.k | 0) !== st.rd || st.x.cl[p]) return; var mx = st.rd < 3 ? C.maxScore(C.beats(L.bpm[st.rd], 30)) : 40; st.x.cl[p] = 1; sc(st, p, clamp(Math.round(+c.v || 0), 0, mx)); },
    step: function (st, L, H) { if (st.rd === 3) act(st).forEach(function (p) { var q = H.pos[p]; if (q && q.e === "dance") H.mem.dn[p] = 1; }); },
    endRound: function (st, L, H) { if (st.rd !== 3) return; act(st).forEach(function (p) { if (st.x.cl[p]) return; var f = (H.fit[p] || "").split(".").filter(Boolean), u = {}; f.forEach(function (k) { u[k] = 1; }); sc(st, p, Math.min(30, Object.keys(u).length * 3) + (H.mem.dn[p] ? 10 : 0)); }); },
    roundOver: function (st) { return st.rt >= 34 || (st.rd < 3 && act(st).every(function (p) { return st.x.cl[p]; })) || (st.rd === 3 && st.rt >= 30); },
    rank: function (st, L) { var ch = function (p) { return rng(L.cheer + p * 31)(); }; return st.n.slice().sort(function (a, b) { return (st.sc[b] || 0) - (st.sc[a] || 0) || ch(b) - ch(a); }); },
    task: function (st, L, p) { if (st.rd === 3) return { x: L.f.x, y: L.f.y, txt: "Freestyle: dance (2) and show off your outfit!", act: { o: "emote", e: "dance" }, r: 30, mk: [] };
      return { x: L.f.x, y: L.f.y, txt: "Song " + (st.rd + 1) + "/3 · " + L.bpm[st.rd] + " bpm · tap G on every beat" + (st.x.cl[p] ? " · score sent" : ""), rhythm: { k: st.rd, bpm: L.bpm[st.rd], secs: 30 }, mk: [] }; } });

  var CAB = ["tabletennis", "kola", "run", "patrol", "ayo"], CABT = { tabletennis: 11, kola: 1500, run: 1200, patrol: 2500, ayo: 25 };
  mission({ id: "F20", g: "sport", name: "Arcade Night", what: "Three Game Room machines in turn. Rank points per machine.", comp: true,
    layout: function (r, c) { return { m: shuffle(r, CAB).slice(0, 3), a: spot(c.W, "mk_arcade", false) || free(c.W, 78, -966) }; },
    rounds: function () { return 3; }, init: function (st) { st.x = { s: {} }; }, newRound: function (st) { st.x.s = {}; }, dur: function () { return 3 * 160; },
    start: function (L, rd, i) { return grid({ x: L.a.x, y: L.a.y, a: 0 }, i); },
    claim: function (st, L, H, p, c) { if (c.o !== "sc" || (c.k | 0) !== st.rd || st.x.s[p] != null) return; var v = +c.v; if (!isFinite(v) || v < 0) return; st.x.s[p] = Math.min(Math.round(v), 1e7); },
    roundOver: function (st) { return st.rt >= 150 || act(st).every(function (p) { return st.x.s[p] != null; }); },
    endRound: function (st, L) { var s = st.x.s, ps = act(st).slice().sort(function (a, b) { return (s[b] || 0) - (s[a] || 0) || a - b; }), n = ps.length; ps.forEach(function (p, i) { sc(st, p, n - i + ((s[p] || 0) >= CABT[L.m[st.rd]] ? 2 : 0)); }); },
    rank: byScore, task: function (st, L, p) { var id = L.m[st.rd] || L.m[0]; return { x: L.a.x, y: L.a.y, txt: "Machine " + (st.rd + 1) + "/3: " + id + " · beat " + CABT[id] + " for a bonus" + (st.x.s[p] != null ? " · score in: " + st.x.s[p] : ""), arcade: { k: st.rd, id: id }, mk: [] }; } });

  function shadeStep(st, H, dt, target, speed, onReach) { // shades walk at the target; a lit torch close by or a punch ends them
    var x = st.x; x.sh = x.sh.filter(function (s) { var dx = target.x - s[0], dy = target.y - s[1], d = Math.hypot(dx, dy); if (d < 5) { onReach(); return false; } s[0] = r1(s[0] + dx / d * speed * dt); s[1] = r1(s[1] + dy / d * speed * dt);
      var dead = false; act(st).forEach(function (p) { var q = H.pos[p], m = H.me[p]; if (!dead && q && m && m.torch && Math.hypot(q.x - s[0], q.y - s[1]) < 7) { s[2] = r1((s[2] || 0) + dt); if (s[2] >= 1) { dead = true; sc(st, p, 1); } } }); if (dead) H.say("shade"); return !dead; }); }
  function shadeHit(st, H, p) { var q = H.pos[p]; if (!q || H.mem.hcd[p] > st.t) return; H.mem.hcd[p] = st.t + .4; var x = st.x, k = -1; x.sh.forEach(function (s, i) { if (k < 0 && Math.hypot(q.x - s[0], q.y - s[1]) < 3) k = i; }); if (k >= 0) { x.sh.splice(k, 1); sc(st, p, 1); H.say("shade"); } }
  function spawnShade(st, H, c, R) { if (st.x.sh.length >= 16) return; var a = H.r() * TAU; st.x.sh.push([r1(c.x + Math.cos(a) * R), r1(c.y + Math.sin(a) * R), 0]); }
  function nearestShade(st, q) { var best = null, bd = 1e9; st.x.sh.forEach(function (s) { var d = q ? Math.hypot(q.x - s[0], q.y - s[1]) : 0; if (d < bd) { bd = d; best = s; } }); return best; }

  mission({ id: "F21", g: "dark", name: "Blackout Shift", what: "The light is gone. Protect a hostel while the generator is carried from the fire station.", comp: false, dark: true,
    layout: function (r, c) { var h = pick(r, ["akenzua", "amina"].filter(exists)); return { h: spot(c.W, h, false), f: spot(c.W, "fire", false) || free(c.W, 630, 270), rate: 10 / (1 + .2 * c.n.length) }; },
    init: function (st, L) { st.x = { g: [L.f.x, L.f.y], cr: 0, nc: 0, ph: 0, rt: 0, hp: 100, sh: [] }; }, dur: function (L) { return Math.round(dd(L.h, L.f) / 1.6 + 200); },
    order: function (st) { var o = act(st).slice().sort(function (a, b) { return a - b; }); return o.length >= 3 ? o.slice(0, 2) : o.slice(0, 1); }, // the escort pair takes turns carrying; the rest hold the hostel
    start: function (L, rd, i, st, p) { var esc = this.order(st).indexOf(p) >= 0, s = esc ? L.f : L.h; return Object.assign(grid({ x: s.x, y: s.y, a: 0 }, i), { v: "" }); },
    step: function (st, L, H, dt) { var x = st.x, o = this.order(st), des = o[x.nc % o.length], g = { x: x.g[0], y: x.g[1] };
      if (x.ph === 0) { if (x.cr) { var q = H.pos[x.cr]; if (!q || (st.gone && st.gone[x.cr]) || (q.v && q.v !== "")) { x.cr = 0; H.say("drop"); } else { x.g = [r1(q.x), r1(q.y)]; } H.mem.ct = (H.mem.ct || 0) + dt; if (H.mem.ct > 45) { x.cr = 0; x.nc++; H.mem.ct = 0; H.say("swap"); } }
        else { var dq = H.pos[des]; if (dq && !dq.v && dd(dq, g) < 3) { x.cr = des; H.mem.ct = 0; } } if (dd({ x: x.g[0], y: x.g[1] }, L.h) < 10) { x.ph = 1; x.cr = 0; H.say("gen"); } }
      else x.rt = r1(x.rt + dt);
      if (H.every(L.rate * (x.ph ? .6 : 1))) spawnShade(st, H, L.h, 70); shadeStep(st, H, dt, L.h, x.ph ? 2.4 : 1.9, function () { x.hp -= 6; H.say("hurt"); }); },
    claim: function (st, L, H, p, c) { if (c.o === "ht") shadeHit(st, H, p); },
    over: function (st) { return st.x.hp <= 0 || st.x.rt >= 60; }, win: function (st) { return st.x.hp > 0 && st.x.rt >= 60; },
    task: function (st, L, p, V) { var x = st.x, o = this.order(st), des = o[x.nc % o.length], q = V && V[p], mk = x.sh.map(function (s) { return { x: s[0], y: s[1], c: "#a78bfa", r: 1.5, l: "" }; }).concat([{ x: L.h.x, y: L.h.y, c: "#86efac", r: 8, l: "HOSTEL " + Math.max(0, x.hp) + "%" }, { x: x.g[0], y: x.g[1], c: "#fde047", r: 3, l: "GENERATOR" }]);
      if (x.ph === 0 && o.indexOf(p) >= 0 && x.cr !== p && des !== p && x.cr) { var cq = V && V[x.cr]; return { x: cq ? cq.x : x.g[0], y: cq ? cq.y : x.g[1], txt: "Escort the carrier: you take the generator next", torch: 1, mk: mk }; }
      if (x.ph === 0 && (x.cr === p || (!x.cr && des === p))) return x.cr === p ? { x: L.h.x, y: L.h.y, txt: "Carry the generator to the hostel on foot", mk: mk } : { x: x.g[0], y: x.g[1], txt: "Your turn: pick up the generator (walk, no vehicle)", mk: mk, veh: "" };
      var s = nearestShade(st, q); return s ? { x: s[0], y: s[1], txt: (x.ph ? "Generator running " + Math.round(x.rt) + "/60 s" : "Protect the carrier") + " · shine your torch on shades (F) or hit them", act: { o: "ht" }, r: 3, lab: "Hit shade", torch: 1, mk: mk } : { x: L.h.x, y: L.h.y, txt: x.ph ? "Hold the hostel " + Math.round(x.rt) + "/60 s" : "Guard the road to the hostel", torch: 1, mk: mk }; } });

  mission({ id: "F22", g: "dark", name: "Lantern Walk", what: "Escort a line of walkers along a dark route. Each torch lights only a cone. Get 80% home.", comp: false, dark: true,
    layout: function (r, c) { var pairs = [["library", "akenzua"], ["shinkafi", "ribadu"], ["selfie", "amina"], ["social", "suleiman"], ["enggarden", "ribadu"]].filter(function (q) { return exists(q[0]) && exists(q[1]); }), q = pick(r, pairs), a = spot(c.W, q[0], false), b = spot(c.W, q[1], false), p = route(c.W, a, b, false);
      return { p: p, len: plen(p), n: 6 + 2 * c.n.length, from: a.name, to: b.name }; },
    init: function (st, L) { st.x = { s: 0, lo: bits([]) }; }, dur: function (L) { return Math.round(L.len / 1.3 * 1.6 + 90); },
    pos: function (L, s, i) { return at(L.p, clamp(s - 2.2 * i, 0, L.len)); },
    start: function (L, rd, i) { var q = at(L.p, 0); return grid({ x: q.x, y: q.y, a: q.a + Math.PI }, i); },
    step: function (st, L, H, dt) { var x = st.x, self = this, lo = unbits(x.lo, L.n), head = self.pos(L, x.s, 0), near = act(st).some(function (p) { var q = H.pos[p]; return q && dd(q, head) < 14; }); if (near) x.s = r1(Math.min(L.len + 2.2 * L.n, x.s + 1.3 * dt));
      var ut = H.mem.ut || (H.mem.ut = []), ch = false; for (var i = 0; i < L.n; i++) { if (lo[i]) continue; var w = self.pos(L, x.s, i); if (x.s - 2.2 * i >= L.len) continue; var lit = act(st).some(function (p) { var q = H.pos[p], m = H.me[p]; return q && m && m.torch && dd(q, w) < 10; }); ut[i] = lit ? 0 : (ut[i] || 0) + dt; if (ut[i] > 6 && x.s > 2.2 * i) { lo[i] = true; ch = true; H.say("lost"); } } if (ch) x.lo = bits(lo); },
    over: function (st, L) { return st.x.s - 2.2 * (L.n - 1) >= L.len; }, win: function (st, L) { var lo = unbits(st.x.lo, L.n).filter(Boolean).length; return st.x.s - 2.2 * (L.n - 1) >= L.len && lo <= L.n * .2; },
    task: function (st, L, p) { var o = act(st).slice().sort(function (a, b) { return a - b; }), k = o.indexOf(p), n = o.length, lo = unbits(st.x.lo, L.n), idx = n > 1 ? Math.round((k + .5) * (L.n - 1) / n) : 1, w = this.pos(L, st.x.s + (k === 0 ? 3 : 0), k === 0 ? 0 : idx), mk = [];
      for (var i = 0; i < L.n; i++) if (!lo[i]) { var q = this.pos(L, st.x.s, i); mk.push({ x: q.x, y: q.y, c: "#fde68a", r: .7 }); }
      var lost = lo.filter(Boolean).length; return { x: w.x, y: w.y, txt: (k === 0 ? "Lead the line to " + L.to : "Walk beside the line") + " · torch on (F) · lost " + lost + "/" + L.n, torch: 1, mk: mk }; } });

  mission({ id: "F23", g: "dark", name: "Coil Guard", what: "Hold the Engineering Garden for five waves while one player keeps the resonator in rhythm.", comp: false, dark: true,
    layout: function (r, c) { var g = spot(c.W, "enggarden", false) || free(c.W, -525, 140), lamps = []; for (var i = 0; i < 4 + c.n.length; i++) { var a = i / (4 + c.n.length) * TAU; lamps.push(free(c.W, g.x + Math.cos(a) * 25, g.y + Math.sin(a) * 25)); } return { c: g, lamps: lamps.map(function (q) { return { x: r1(q.x), y: r1(q.y) }; }), calm: 1 + Math.floor(r() * 3), rate: 2.6 / (1 + .15 * c.n.length) }; },
    rounds: function () { return 5; }, init: function (st) { st.x = { hp: 100, ch: 70, sh: [], lp: 0 }; }, newRound: function (st) { st.x.sh = []; st.x.lp = 0; }, dur: function () { return 5 * 45 + 10; },
    rhythmer: function (st) { var o = act(st).slice().sort(function (a, b) { return a - b; }); return o[st.rd % o.length]; },
    start: function (L, rd, i) { return grid({ x: L.c.x, y: L.c.y, a: 0 }, i); },
    step: function (st, L, H, dt) { var x = st.x; x.ch = r1(clamp(x.ch - 4 * dt, 0, 100)); if (st.rd === L.calm) { act(st).forEach(function (p) { var q = H.pos[p]; if (!q) return; L.lamps.forEach(function (lm, i) { if (dd(q, lm) < 3.5 && !((x.lp >> i) & 1)) { x.lp |= 1 << i; sc(st, p, 1); H.say("lamp"); } }); }); return; }
      if (H.every(L.rate)) spawnShade(st, H, L.c, 70); shadeStep(st, H, dt, L.c, x.ch < 30 ? 2.7 : 1.8, function () { x.hp -= 8; H.say("hurt"); }); },
    claim: function (st, L, H, p, c) { if (c.o === "ht") shadeHit(st, H, p); if (c.o === "rh" && p === this.rhythmer(st) && !(H.mem.rcd[p] > st.t)) { H.mem.rcd[p] = st.t + 4; st.x.ch = r1(clamp(st.x.ch + clamp(+c.v || 0, 0, 1) * 25, 0, 100)); sc(st, p, clamp(+c.v || 0, 0, 1)); } },
    roundOver: function (st, L) { return st.rt >= 45 || (st.rd === L.calm && st.x.lp === (1 << L.lamps.length) - 1) || st.x.hp <= 0; },
    over: function (st) { return st.x.hp <= 0; }, win: function (st) { return st.x.hp > 0 && st.rd >= 4; },
    task: function (st, L, p, V) { var x = st.x, mk = x.sh.map(function (s) { return { x: s[0], y: s[1], c: "#a78bfa", r: 1.5 }; }).concat([{ x: L.c.x, y: L.c.y, c: "#7dd3fc", r: 4, l: "COIL " + Math.max(0, x.hp) + "%" }]), tail = "Wave " + (st.rd + 1) + "/5 · resonator " + Math.round(x.ch) + "%";
      if (st.rd === L.calm) { var q0 = V && V[p], best = null, bd = 1e9; L.lamps.forEach(function (lm, i) { if ((x.lp >> i) & 1) return; var d = q0 ? dd(q0, lm) : i; if (d < bd) { bd = d; best = lm; } }); L.lamps.forEach(function (lm, i) { mk.push({ x: lm.x, y: lm.y, c: (x.lp >> i) & 1 ? "#fde047" : "#475569", r: 1.5, l: "LAMP" }); }); return best ? { x: best.x, y: best.y, txt: "Calm wave: repair the lamps · " + tail, mk: mk } : { txt: "All lamps lit", mk: mk }; }
      if (p === this.rhythmer(st)) return { x: L.c.x, y: L.c.y, txt: "Keep the resonator in rhythm: tap G on every beat · " + tail, rhythm: { k: 100 + st.rd, bpm: 110, secs: 5, loop: 1 }, mk: mk };
      var s = nearestShade(st, V && V[p]); return s ? { x: s[0], y: s[1], txt: "Torch (F) or hit the shades · " + tail, act: { o: "ht" }, r: 3, lab: "Hit shade", torch: 1, mk: mk } : { x: L.c.x, y: L.c.y, txt: "Guard the coil · " + tail, torch: 1, mk: mk }; } });

  mission({ id: "F24", g: "mixed", name: "Delivery Dash", what: "The delivery app is flooded. Split up, deliver, do not double up. One fragile cake.", comp: false,
    layout: function (r, c) { var n = 4 + 2 * c.n.length, from = ["shinkafi", "buka", "market", "mk_food", "bookshop", "bank", "shayi", "mibstore"].filter(exists), to = ["akenzua", "ribadu", "amina", "suleiman", "library", "senate", "ee", "physics", "compsci", "social", "chapel", "mosque", "nelt"].filter(exists), os = [];
      for (var i = 0; i < n; i++) { var a = spot(c.W, pick(r, from), false), b = spot(c.W, pick(r, to), false); os.push({ a: a, b: b, due: 80 + 30 * i }); } return { o: os, cake: Math.floor(r() * n), target: Math.ceil(n * .7), veh: c.mut.ride || "okada" }; },
    init: function (st, L) { st.x = { ac: L.o.map(function () { return 0; }), s: L.o.map(function () { return "0"; }).join(""), lt: 0 }; }, dur: function () { return 300; },
    start: function (L, rd, i) { return Object.assign(grid({ x: L.o[0].a.x, y: L.o[0].a.y, a: 0 }, i), { v: L.veh }); },
    claim: function (st, L, H, p, c) { var x = st.x, k = c.k | 0; if (c.o === "ac" && x.s[k] === "0" && !x.ac[k]) { var mine = x.ac.filter(function (q, i) { return q === p && "0p".indexOf(x.s[i]) >= 0; }).length; if (mine < 2) x.ac[k] = p; }
      if (c.o === "bp") x.ac.forEach(function (q, i) { if (q === p && i === L.cake && x.s[i] === "p") { x.s = x.s.slice(0, i) + "x" + x.s.slice(i + 1); H.say("cake", p); } }); },
    step: function (st, L, H) { var x = st.x, s = x.s.split(""), ch = false; L.o.forEach(function (o, i) { var p = x.ac[i]; if (!p || "0p".indexOf(s[i]) < 0) return; var q = H.pos[p]; if (st.gone && st.gone[p]) { x.ac[i] = 0; if (s[i] === "p") s[i] = "0"; ch = true; return; } if (!q) return;
      if (s[i] === "0" && dd(q, o.a) < 8) { s[i] = "p"; ch = true; } else if (s[i] === "p" && dd(q, o.b) < 8) { s[i] = "d"; ch = true; sc(st, p, 1); if (st.t > o.due) x.lt++; H.say("deliver", p); } }); if (ch) x.s = s.join(""); },
    over: function (st) { return st.x.s.split("").every(function (c) { return c === "d" || c === "x"; }); }, win: function (st, L) { return st.x.s.split("").filter(function (c) { return c === "d"; }).length >= L.target; },
    task: function (st, L, p, V) { var x = st.x, q = V && V[p], done = x.s.split("").filter(function (c) { return c === "d"; }).length, tail = " · " + done + "/" + L.target + (x.lt ? " · " + x.lt + " late" : ""), mk = [], mine = null;
      L.o.forEach(function (o, i) { if (x.ac[i] === p && "0p".indexOf(x.s[i]) >= 0 && !mine) mine = { o: o, i: i }; }); if (mine) { var tg = x.s[mine.i] === "0" ? mine.o.a : mine.o.b; mk.push({ x: tg.x, y: tg.y, c: "#86efac", r: 6, l: x.s[mine.i] === "0" ? "PICK UP" : "DROP" }); return { x: tg.x, y: tg.y, txt: (x.s[mine.i] === "0" ? "Collect order " + (mine.i + 1) + " at " + mine.o.a.name : "Deliver to " + mine.o.b.name + (mine.i === L.cake ? " — it's the CAKE, no bumps!" : "") + " (due " + Math.max(0, Math.round(mine.o.due - st.t)) + " s)") + tail, mk: mk }; }
      var best = null, bd = 1e9; L.o.forEach(function (o, i) { if (x.s[i] !== "0" || x.ac[i]) return; var d = q ? dd(q, o.a) : i; if (d < bd) { bd = d; best = i; } }); if (best == null) return { txt: "All orders taken" + tail, mk: mk };
      var ob = L.o[best]; return { x: ob.a.x, y: ob.a.y, txt: "Accept order " + (best + 1) + ": " + ob.a.name + " → " + ob.b.name + (best === L.cake ? " (fragile cake)" : "") + tail, act: { o: "ac", k: best }, lab: "Accept order", mk: [{ x: ob.a.x, y: ob.a.y, c: "#fde047", r: 6, l: "ORDER " + (best + 1) }] }; } });

  mission({ id: "F25", g: "mixed", name: "Convoy to Phase 2", what: "One long road, and only the lead driver has the map. Arrive together, nobody more than 80 m apart.", comp: false,
    layout: function (r, c) { var via = ["gate", "checkpoint", "stalls", "p2park"].filter(exists).map(function (id) { return spot(c.W, id, true); }), p = chain(c.W, via, true), L0 = plen(p), cps = []; for (var i = 1; i <= 5; i++) { var q = at(p, L0 * i / 5); cps.push({ x: r1(q.x), y: r1(q.y) }); }
      return { cps: cps, len: L0, start: via[0], vs: c.n.map(function (pid, i) { return c.mut.ride || pick(r, ["car", "keke", "okada"]); }), hz: pick(r, ["roadworks", "cattle crossing", "harmattan"]) }; },
    init: function (st) { st.x = { k: 0, sp: 0, pen: 0 }; }, dur: function (L) { return Math.round(L.len / 9 + 150); },
    holder: function (st) { var o = act(st).slice().sort(function (a, b) { return a - b; }); return o[st.x.k % o.length]; },
    start: function (L, rd, i, st, p) { return Object.assign(grid({ x: L.start.x, y: L.start.y, a: 0 }, i), { v: L.vs[st.n.indexOf(p)] || "car" }); },
    step: function (st, L, H, dt) { var x = st.x, h = this.holder(st), q = H.pos[h], cp = L.cps[x.k]; var ps = act(st).map(function (p) { return H.pos[p]; }).filter(Boolean), far = 0;
      for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) far = Math.max(far, dd(ps[i], ps[j])); if (far > 80) { x.sp = r1(x.sp + dt); if (x.sp >= 8) { x.sp = 0; x.pen += 10; H.say("spread"); } } else x.sp = 0;
      if (!cp) return; if (x.k < L.cps.length - 1) { if (q && dd(q, cp) < 18) { x.k++; H.say("cp"); } } else if (ps.length && ps.every(function (o) { return dd(o, cp) < 40; })) { x.k++; } },
    over: function (st, L) { return st.x.k >= L.cps.length; }, win: function (st, L) { return st.x.k >= L.cps.length && st.t + st.x.pen <= this.dur(L); },
    task: function (st, L, p, V) { var x = st.x, h = this.holder(st), cp = L.cps[Math.min(x.k, L.cps.length - 1)], tail = " · checkpoint " + Math.min(x.k + 1, 5) + "/5" + (x.pen ? " · +" + x.pen + " s" : "") + (x.sp > 0 ? " · TOO SPREAD OUT!" : "");
      if (p === h || x.k >= L.cps.length - 1) return { x: cp.x, y: cp.y, txt: (p === h ? "You have the map: lead the convoy" : "Final stretch: arrive together") + tail, mk: [{ x: cp.x, y: cp.y, c: "#fde047", r: 18, l: "CHECKPOINT" }] };
      var q = V && V[h]; return { x: q ? q.x : cp.x, y: q ? q.y : cp.y, txt: "Follow the map holder, stay within 80 m" + tail, mk: q ? [{ x: q.x, y: q.y, c: "#22d3ee", r: 4, l: "MAP" }] : [] }; } });

  C.MISSIONS = M; C.byId = {}; M.forEach(function (m) { C.byId[m.id] = m; });
  C.GROUPS = [["race", "Racing"], ["fly", "Flying"], ["hunt", "Hunting for things"], ["sport", "Sparring and sport"], ["dark", "Together against the dark"], ["mixed", "Mischief and mixed"]];
  C.MUTATORS = [["hm", "Harmattan", "Dust haze; shorter sight"], ["lt", "They have taken light", "Night, lamps off, torches only"], ["gw", "Garri week", "Everyone starts hungry"], ["md", "Market day", "Busier roads"], ["or", "One ride", "Everyone uses the same vehicle type"], ["sw", "Swap", "Every 60 s two players swap places"], ["tp", "Tiny purse", "Prize money in ₦5 coins"]];
  C.SETS = [{ id: "quick", name: "Quick three", what: "One race, one hunt, one co-op." }, { id: "sports", name: "Sports day", what: "Five-a-side, hoops, sparring, dance-off, with a medal table.", list: ["F17", "F18", "F16", "F19"] },
    { id: "night", name: "Night shift", what: "Blackout Shift, Lantern Walk, Coil Guard, with the lights out.", list: ["F21", "F22", "F23"], mut: "lt" }, { id: "tour", name: "Grand tour", what: "Six missions, one from each group, a league table, a trophy and a wooden spoon." }];
  function allowed(m, n) { return n >= m.min && n <= m.max; }
  C.setList = function (id, seed, n) { var r = rng(seed), set = null; C.SETS.forEach(function (s) { if (s.id === id) set = s; }); if (!set) return [];
    if (set.list) return set.list.filter(function (k) { return allowed(C.byId[k], n); });
    var pickG = function (g, coop) { var c = M.filter(function (m) { return (!g || m.g === g) && allowed(m, n) && (coop == null || (!m.comp) === coop); }); return c.length ? pick(r, c).id : null; };
    if (id === "quick") return [pickG("race"), pickG("hunt"), pickG(null, true)].filter(Boolean);
    return C.GROUPS.map(function (g) { return pickG(g[0]); }).filter(Boolean); };

  /* ---------- layout: rebuilt from the snapshot's ids on every device ---------- */
  var LCACHE = {};
  C.layout = function (st, W) { var key = st.sid + ":" + st.si + ":" + st.mid; if (LCACHE[key] && LCACHE[key].W === W) return LCACHE[key].L; var m = C.byId[st.mid], mut = {}; (st.mut || "").split(",").forEach(function (k) { if (k) mut[k === "or" ? "ride" : k] = k === "or" ? (st.opt && st.opt.ride) || "okada" : 1; });
    var L = m.layout(rng(st.seed), { W: W, n: st.n, opt: st.opt || {}, mut: mut }); L.W = W; var ks = Object.keys(LCACHE); if (ks.length > 6) delete LCACHE[ks[0]]; LCACHE[key] = { W: W, L: L }; return L; };
  function comp(m, L) { return m.comp2 ? m.comp2(L) : m.comp; }

  /* ---------- the host: referee and broadcaster ---------- */
  // states: {pid: {x, y, a, v, z, e, s, f}} as the host currently sees everyone (its own player included)
  C.Host = function (pid, W) { this.pid = pid; this.W = W; this.st = null; this.out = []; this.sendT = 0; this.mem = null; this.me = {}; this.sid = 0; this.lastSeen = {}; this.lastPos = {}; this.sus = {}; };
  C.Host.prototype.start = function (sel, players, opt, mut, seed) {
    var n = players.slice().sort(function (a, b) { return a - b; }), base = (seed >>> 0) || ((Date.now() * 7919) >>> 0), list = C.byId[sel] ? [sel] : C.setList(sel, base, n.length);
    list = list.filter(function (k) { return allowed(C.byId[k], n.length); }); if (!list.length) return false; this.sid = (base % 90000) + 10000;
    var set = C.SETS.filter(function (s) { return s.id === sel; })[0], m2 = (mut || []).slice(); if (set && set.mut && m2.indexOf(set.mut) < 0) m2.push(set.mut);
    this.st = { v: 0, sid: this.sid, set: set ? set.id : "", sl: list, si: 0, mid: list[0], ph: "br", pt: 0, t: 0, rt: 0, rd: 0, seed: base, h: this.pid, n: n, mut: m2.join(","), opt: opt || {}, sc: {}, tm: {}, x: {}, lg: {}, gone: {}, sw: null };
    this.begin(); this.flush(true); return true; };
  C.Host.prototype.begin = function () { var st = this.st, m = C.byId[st.mid]; st.ph = "br"; st.pt = 0; st.t = 0; st.rt = 0; st.rd = 0; st.sc = {}; st.tm = {}; st.res = null; st.sw = null; st.seed = (st.seed * 1103515245 + 12345 + st.si) >>> 0;
    this.mem = { cd: {}, dcd: {}, pk: {}, hcd: {}, kc: {}, ak: {}, gl: {}, dn: {}, oob: {}, rcd: {}, ev: {} }; this.dist = {}; this.r = rng(st.seed ^ 0x9e3779b9); var L = C.layout(st, this.W); m.init(st, L, this.H(L)); };
  C.Host.prototype.H = function (L) { var self = this; return { W: this.W, pos: this.pos || {}, me: this.me, mem: this.mem, r: this.r, now: this.now || 0, fit: this.fit || {}, en: this.en || {}, L: L,
    every: function (s) { var k = "e" + s; self.mem.ev[k] = (self.mem.ev[k] || 0) + self.dt; if (self.mem.ev[k] >= s) { self.mem.ev[k] -= s; return true; } return false; },
    say: function (what, a, b) { (self.said = self.said || []).push([what, a, b]); } }; };
  C.Host.prototype.claim = function (from, c) { var st = this.st; if (!st || !c || c.sid !== st.sid || c.si !== st.si) return;
    if (c.o === "me") { this.me[from] = { torch: !!c.torch, blk: !!c.blk, en: +c.en || 0, ch: !!c.ch, hm: String(c.hm || "").slice(0, 16), at: this.now || 0 }; return; }
    if (st.ph !== "go" || st.n.indexOf(from) < 0 || (st.gone && st.gone[from]) || this.sus[from] > (this.now || 0)) return; var m = C.byId[st.mid], L = C.layout(st, this.W);
    if (m.claim) m.claim(st, L, this.H(L), from, c); };
  C.Host.prototype.tick = function (dt, states, now) {
    var st = this.st; if (!st) return; this.dt = dt; this.now = now; var self = this; this.pos = {}; this.fit = {}; this.en = {};
    Object.keys(states).forEach(function (k) { var p = +k, s = states[k]; if (!s || s.x == null) return; self.pos[p] = s; self.fit[p] = s.f || ""; self.lastSeen[p] = now;
      var lp = self.lastPos[p]; if (lp && now > lp.t) { var d = Math.hypot(s.x - lp.x, s.y - lp.y), cap = vmax(s.v) * 1.6 * (now - lp.t) + 25; if (d > cap && st.ph === "go" && !(self.teleT > now)) { self.sus[p] = now + 3; } self.dist[p] = (self.dist[p] || 0) + Math.min(d, cap); } self.lastPos[p] = { x: s.x, y: s.y, t: now }; });
    Object.keys(this.me).forEach(function (k) { self.en[k] = self.me[k].en; });
    st.n.forEach(function (p) { if (!(now - (self.lastSeen[p] == null ? now : self.lastSeen[p]) < 8) && !st.gone[p]) st.gone[p] = 1; });
    var m = C.byId[st.mid], L = C.layout(st, this.W), H = this.H(L); st.pt += dt;
    if (st.ph === "br" && st.pt >= 6) { st.ph = "ct"; st.pt = 0; this.teleT = now + 6; if (m.roundStart) m.roundStart(st, L, H); }
    else if (st.ph === "ct" && st.pt >= 4) { st.ph = "go"; st.pt = 0; st.rt = 0; }
    else if (st.ph === "go") { st.t += dt; st.rt += dt; m.step && m.step(st, L, H, dt);
      if (st.mut.indexOf("sw") >= 0 && H.every(60)) { var a = act(st); if (a.length >= 2) { var i = Math.floor(this.r() * a.length), j = (i + 1 + Math.floor(this.r() * (a.length - 1))) % a.length; st.sw = [a[i], a[j], ((st.sw && st.sw[2]) || 0) + 1]; this.teleT = now + 3; } }
      var nr = m.rounds(L, st), endR = m.roundOver && m.roundOver(st, L, H), fin = m.over(st, L, H) || st.t >= m.dur(L, st) || act(st).length < Math.max(1, m.min - (m.min > 2 ? 1 : 0));
      if (endR || (fin && st.rd < nr)) { if (m.endRound) m.endRound(st, L, H); }
      if (!fin && endR && st.rd + 1 < nr) { st.rd++; if (m.newRound) m.newRound(st, L, H); st.ph = m.noTele ? "go" : "ct"; st.pt = 0; st.rt = 0; this.teleT = now + 6; }
      else if (fin || endR) this.finish(m, L, H); }
    else if (st.ph === "rs" && st.pt >= 12) { if (st.si + 1 < st.sl.length) { st.si++; st.mid = st.sl[st.si]; this.begin(); } else { st.ph = "end"; st.pt = 0; } }
    else if (st.ph === "end" && st.pt >= 3) { this.flush(true); this.st = null; return; }
    this.sendT -= dt; if (this.sendT <= 0) this.flush(); };
  C.Host.prototype.finish = function (m, L, H) { var st = this.st, self = this, cp = comp(m, L), ch = st.n.filter(function (p) { return self.me[p] && self.me[p].ch && !st.opt.ch; });
    var rank = cp ? (m.rank ? m.rank(st, L, H) : byScore(st)) : byScore(st), win = cp ? null : (m.win ? !!m.win(st, L, H) : true); rank = rank.filter(function (p) { return ch.indexOf(p) < 0; }).concat(ch);
    var aw = [], dist = this.dist || {}, live = act(st); aw.push([cp ? "Winner" : (win ? "Hero of the mission" : "Gave everything"), rank[0]]);
    var gl = this.mem.gl, top = null, tv = -1; Object.keys(gl).forEach(function (p) { if (gl[p] > tv) { tv = gl[p]; top = +p; } }); if (top != null) aw.push(["Top scorer", top]); else { var far = null, fv = -1; live.forEach(function (p) { if ((dist[p] || 0) > fv) { fv = dist[p] || 0; far = p; } }); aw.push(["Road warrior (most metres)", far]); }
    if (cp && rank.length > 1) aw.push(["Most honest loser", rank[rank.length - 1 - ch.length] || rank[rank.length - 1]]); else { var bd = null, bh = -1; live.forEach(function (p) { var f = (self.fit[p] || "") + ":" + st.sid, h = hash(f); if (h > bh) { bh = h; bd = p; } }); aw.push(["Best dressed", bd]); }
    st.res = { cp: cp ? 1 : 0, w: win == null ? null : win ? 1 : 0, rk: rank, aw: aw.filter(function (a) { return a[1] != null; }), ch: ch };
    if (st.set) { var nn = rank.length; rank.forEach(function (p, i) { st.lg[p] = (st.lg[p] || 0) + (cp ? nn - i : (win ? Math.ceil(nn / 2) : 1)); }); }
    st.ph = "rs"; st.pt = 0; this.flush(true); };
  C.Host.prototype.flush = function (now) { var st = this.st; if (!st) return; st.v++; this.sendT = .5; var d = JSON.stringify(st, function (k, v) { return typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 10) / 10 : v; }); this.out.push({ k: "co", o: "S", d: d }); this.last = d; };
  C.Host.prototype.cancel = function () { if (!this.st) return; this.st.ph = "end"; this.st.pt = 0; this.st.res = this.st.res || { cp: 0, w: 0, rk: this.st.n.slice(), aw: [], ch: [], x: 1 }; this.flush(true); this.st = null; };

  /* ---------- a client: every player, the host included, sees the game through one ---------- */
  C.Client = function (pid, W) { this.pid = pid; this.W = W; this.st = null; this.v = -1; this.sid = 0; this.out = []; this.seen = 0; this.done = {}; this.tele = ""; this.swap = 0; };
  C.Client.prototype.apply = function (d, now) { var st; try { st = typeof d === "string" ? JSON.parse(d) : d; } catch (e) { return false; } if (!st || !C.byId[st.mid]) return false;
    if (this.st && st.sid === this.st.sid) { if (st.v <= this.v) return false; }
    else if (this.st && this.st.ph !== "end" && (now || 0) - this.seen < 6 && st.sid > this.st.sid) return false; // two hosts at once: the lower session id wins
    this.st = st; this.v = st.v; this.sid = st.sid; this.seen = now || 0; return true; };
  C.Client.prototype.mine = function () { return !!this.st && this.st.n.indexOf(this.pid) >= 0 && !(this.st.gone && this.st.gone[this.pid]); };
  C.Client.prototype.claim = function (c) { if (!this.st) return; c.sid = this.st.sid; c.si = this.st.si; this.out.push({ k: "co", o: "C", d: JSON.stringify(c) }); };
  C.Client.prototype.task = function (V) { var st = this.st; if (!st || !this.mine() || st.ph !== "go") return null; var m = C.byId[st.mid], L = C.layout(st, this.W); return m.task(st, L, this.pid, V, this.W); };
  C.Client.prototype.startPos = function () { var st = this.st, m = C.byId[st.mid], L = C.layout(st, this.W); return m.start(L, st.rd, Math.max(0, st.n.indexOf(this.pid)), st, this.pid); };
  C.Client.prototype.reward = function () { var st = this.st, r = st && st.res; if (!r || !this.mine()) return null; var k = st.sid + ":" + st.si; if (this.done[k]) return null; this.done[k] = 1;
    var cheat = r.ch.indexOf(this.pid) >= 0, pl = r.rk.indexOf(this.pid), cash = 300, xp = 60; if (r.cp) { if (pl === 0) { cash += 200; xp += 40; } else if (pl === 1) { cash += 100; xp += 20; } } else if (r.w) { cash += 200; xp += 40; }
    if (cheat) cash = xp = 0; return { cash: cash, xp: xp, place: pl, cp: !!r.cp, win: !!r.w, cheat: cheat, mid: st.mid }; };

  /* ---------- the relay: what may travel in an event (kept in step with games/rooms.py) ---------- */
  C.clean = function (ev) { if (!ev || ev.k !== "co" || typeof ev.o !== "string" || typeof ev.d !== "string" || ev.d.length > MAXMSG) return null; return { k: "co", o: ev.o.slice(0, 2), d: ev.d.replace(/[^\x20-\x7e]/g, "") }; };
  C.MAXMSG = MAXMSG;

  /* ---------- browser glue (only runs inside the game page) ---------- */
  var G = { host: null, cl: null, hud: null, rhythm: null, meter: null, prev: {}, meT: 0, flags: null, tele: "", sw: 0, arcade: -1, said: 0, rewardDay: "" };
  C._g = G;
  function Z() { return root.SamaruGame; }
  function peersV(z) { var V = {}, N = z.net, me = z.me; if (!me) return V; V[N.me] = { x: me.veh ? me.veh.x : me.x, y: me.veh ? me.veh.y : me.y, a: me.veh ? me.veh.a : me.a, v: me.veh ? me.veh.type : "", z: me.alt > .05 ? 1 : 0, e: me.emote || "", s: me.veh ? Math.abs(me.veh.speed || 0) : (me.speed || me.cs || 0), f: Sm().fitPack(z.P && z.P.fit) };
    Object.keys(N.peers).forEach(function (k) { var r = N.peers[k]; if (r.x != null) V[+k] = { x: r.x, y: r.y, a: r.a || 0, v: r.veh || "", z: r.z ? 1 : 0, e: r.emote || "", s: r.spd || 0, f: r.fitS || "" }; }); return V; }
  C.active = function () { return !!(G.cl && G.cl.st && G.cl.st.ph !== "end"); };
  C.isHost = function () { return !!G.host && !!G.host.st; };
  function send(ev) { var z = Z(); if (z && z.net && z.net.on) z.net.out.push(ev); }
  C.onEvent = function (e, r) { var z = Z(); if (!z || !e || e.k !== "co") return; var now = Date.now() / 1000; if (!G.cl) G.cl = new C.Client(z.net.me, z.W);
    if (e.o === "A") { try { var an = JSON.parse(e.d); C.say(z, an.t, an.p); } catch (x) {} return; }
    if (e.o === "S") { if (G.host && G.host.st && e.f !== z.net.me) { var o = null; try { o = JSON.parse(e.d); } catch (x) {} if (o && o.sid < G.host.st.sid) { G.host.cancel(); G.host = null; z.toast("Another friends mission was already running: joining theirs."); } else return; } if (G.cl.apply(e.d, now)) G.cl.host = e.f; }
    else if (e.o === "C" && G.host && G.host.st) { try { G.host.claim(e.f, JSON.parse(e.d)); } catch (x) {} } };
  C.target = function () { var t = G.hud && G.hud.task; if (!C.active() || !t || t.hide || t.x == null) return null; return { x: t.x, y: t.y, name: "Friends mission" }; };
  function teleport(z, q, veh) { var S = Sm(), me = z.me, f = S.push(z.W, q.x, q.y, 1); if (me.veh) { if (me.alt > .05 && z.exit) { me.alt = 0; } z.exit && z.exit(true); }
    me.x = f.x; me.y = f.y; if (q.a != null) me.a = q.a; me.fall = 0; z.cam.x = me.x; z.cam.y = me.y;
    if (veh) { var VC = { skate: "#f97316", bike: "#2563eb", scooter: "#10b981", okada: "#dc2626", keke: "#facc15", car: "#e5e7eb", sport: "#ef4444", plane: "#f59e0b" }, c = { id: z.cars.length + 9000, type: veh, x: me.x, y: me.y, a: me.a, vx: 0, vy: 0, speed: 0, col: VC[veh] || "#e5e7eb", hx: me.x, hy: me.y, ha: me.a, free: true, coop: true }; z.cars.push(c); G.cars = (G.cars || []).concat([c]); try { z.enter(c); } catch (e) {} } }
  function cleanupCars(z) { if (!G.cars) return; G.cars.forEach(function (c) { if (z.me.veh === c) z.exit(true); var i = z.cars.indexOf(c); if (i >= 0) z.cars.splice(i, 1); }); G.cars = null; }
  function mutApply(z, st) { var P = z.P, on = st && st.ph !== "end" && st.n.indexOf(z.net.me) >= 0, mut = on ? (st.mut || "") : "", m = on ? C.byId[st.mid] : null, L = on ? C.layout(st, z.W) : null, dark = mut.indexOf("lt") >= 0 || (m && m.dark) || (L && L.night && st.mid === "F14"), haze = mut.indexOf("hm") >= 0 || (L && L.wx === "harmattan");
    if (on && !G.flags) G.flags = { nepa: P.flags.nepa, harm: P.flags.harmattan, hunger: P.hunger };
    if (!on && G.flags) { P.flags.nepa = G.flags.nepa; P.flags.harmattan = G.flags.harm; G.flags = null; return; } if (!on) return; P.flags.nepa = dark ? 1 : G.flags.nepa; P.flags.harmattan = haze ? 1 : G.flags.harm; if (mut.indexOf("gw") >= 0 && !G.flags.gw) { G.flags.gw = 1; P.hunger = Math.min(P.hunger, 30); } }
  C.tick = function (dt) { var z = Z(); if (!z || !z.P || z.mode !== "play" || !z.net) return; z.coop = C; var N = z.net, now = Date.now() / 1000;
    if (!N.on) { if (G.host || G.cl) { if (G.host) G.host.st = null; G.host = null; if (G.cl) { mutApply(z, null); cleanupCars(z); } G.cl = null; G.hud = null; } return; }
    var V = peersV(z); if (G.host && G.host.st) { var hs = G.host.st; G.host.tick(dt, V, now); (G.host.said || []).forEach(function (s) { announce(z, s); }); G.host.said = []; G.host.out.splice(0).forEach(function (ev) { send(ev); if (G.cl) G.cl.apply(ev.d, now); }); if (!G.host.st) G.host = null; void hs; }
    var cl = G.cl; if (!cl || !cl.st) return; var st = cl.st;
    if (!G.host && cl.host != null && (!(cl.host in N.peers) || now - cl.seen > 8) && st.ph !== "end") { z.toast("<b>The host left.</b> Friends mission ended."); st.ph = "end"; }
    mutApply(z, st); if (st.ph === "end") { cleanupCars(z); G.hud = null; if (now - cl.seen > 3 || !st.res || st.res.x) { G.cl = null; } return; }
    G.meT -= dt; if (G.meT <= 0 && cl.mine()) { G.meT = 1.2; var P = z.P; cl.claim({ o: "me", torch: !!z.me.torch, blk: !!z.me.block, en: Math.round(P.energy || 0), ch: !!(P.god || (Sm().isHero && Sm().isHero(P))), hm: P.home || "" }); }
    var key = st.sid + ":" + st.si + ":" + st.rd; if (st.ph === "ct" && cl.mine() && G.tele !== key) { G.tele = key; var sp = cl.startPos(); cleanupCars(z); teleport(z, sp, sp.v); api(z).sound.sfx("whistle"); }
    if (st.sw && st.sw[2] !== G.sw) { G.sw = st.sw[2]; var other = st.sw[0] === N.me ? st.sw[1] : st.sw[1] === N.me ? st.sw[0] : null; if (other != null && N.peers[other] && N.peers[other].x != null) { var q = N.peers[other]; teleport(z, { x: q.x, y: q.y }, null); z.toast("<b>Swap!</b> You traded places with " + api(z).esc(N.peers[other].name || "a friend") + "."); } }
    var t = cl.task(V); G.hud = { task: t, st: st };
    if (t && st.ph === "go") { input(z, cl, t, V, dt); }
    if (st.ph === "rs" && st.res) results(z, cl);
    cl.out.splice(0).forEach(function (ev) { if (G.host && G.host.st) { try { G.host.claim(N.me, JSON.parse(ev.d)); } catch (e) {} } else send(ev); }); };
  function api(z) { return z.api; }
  function hitKey(z, k) { try { return z.api.hit(k); } catch (e) { return false; } }
  function input(z, cl, t, V, dt) { var me = V[z.net.me], st = cl.st, near = !t.act || t.x == null || !t.r || (me && Math.hypot(me.x - t.x, me.y - t.y) <= t.r);
    if (t.torch && !z.me.torch && z.P.inv && !z.P.inv.torch && !G.lent) { G.lent = 1; z.P.inv.torch = 1; z.toast("A friend lends you a torch for the mission (F)."); }
    var pressed = hitKey(z, "coop") || G.tap, cur = z.me.veh ? z.me.veh.type : ""; G.tap = false;
    if (t.veh !== undefined && t.veh !== cur) { if (pressed) { cleanupCars(z); teleport(z, { x: z.me.veh ? z.me.veh.x : z.me.x, y: z.me.veh ? z.me.veh.y : z.me.y }, t.veh || null); } return; }
    if (st.mid === "F16") { var o = t.act && t.act.o === "ht" ? t.act : null; if (o) { if (hitKey(z, "attack")) cl.claim({ o: "ht", to: o.to, w: "p" }); if (hitKey(z, "kick")) cl.claim({ o: "ht", to: o.to, w: "k" }); if (hitKey(z, "throw")) cl.claim({ o: "ht", to: o.to, w: "s" }); } }
    else if (st.mid === "F21" || st.mid === "F23") { if (hitKey(z, "attack") && t.act) cl.claim({ o: "ht" }); }
    else if (st.mid === "F17" && hitKey(z, "kick") && t.act) cl.claim({ o: "kk", a: z.me.a, p: 1 });
    if (t.rhythm) rhythmStep(z, cl, t.rhythm, pressed, dt); else G.rhythm = null;
    if (t.meter) { G.meter = G.meter || { ph: 0 }; G.meter.ph = (G.meter.ph + dt * 1.6) % 2; if (pressed && near) { var v = G.meter.ph > 1 ? 2 - G.meter.ph : G.meter.ph; cl.claim({ o: "sh", q: Math.round((1 - Math.abs(v - .5) * 2) * 100) / 100 }); G.meter = null; } } else G.meter = null;
    if (t.arcade) arcadeStep(z, cl, t.arcade);
    if (pressed && near && t.act && !t.meter) { if (t.act.o === "emote") { if (z.emote) z.emote(t.act.e); } else { var c = Object.assign({}, t.act); if (c.o === "ph") { c.h = Math.floor((z.P.time || 720) / 60); z.api.flash("#fff", .25); z.api.sound.sfx("click"); } cl.claim(c); } } }
  function rhythmStep(z, cl, rh, pressed, dt) { var R = G.rhythm; if (!R || R.k !== rh.k) R = G.rhythm = { k: rh.k, t: 0, sc: 0, hits: 0, beats: 0, streak: 0, last: -1, sent: false, bpm: rh.bpm, secs: rh.secs, loop: rh.loop }; R.t += dt; var per = 60 / R.bpm, b = Math.round(R.t / per), off = Math.abs(R.t - b * per);
    if (pressed && b !== R.last && b > 0) { R.last = b; if (off < .07) { R.sc += 3; R.hits++; R.streak++; } else if (off < .15) { R.sc += 1; R.hits++; R.streak++; } else R.streak = 0; if (R.streak && R.streak % 8 === 0) R.sc += 1; }
    R.beats = Math.floor(R.t / per); if (R.t >= R.secs && !R.sent) { if (R.loop) { cl.claim({ o: "rh", v: Math.round(Math.min(1, R.hits / Math.max(1, R.beats)) * 100) / 100 }); G.rhythm = null; } else { R.sent = true; cl.claim({ o: "sc", k: R.k, v: R.sc }); } } }
  function arcadeStep(z, cl, a) { var mini = z.mini; if (!mini) { if (G.arcade !== a.k) { G.arcade = a.k; cl.claim({ o: "sc", k: a.k, v: 0 }); } return; }
    if (G.arcade !== a.k && !mini.active()) { G.arcade = a.k; G.arcSent = false; mini.open(a.id, { free: true, frame: "cabinet" }); return; }
    if (G.arcade === a.k && !G.arcSent && mini.active() && mini.screen && mini.screen() === "over") { var g = mini.games[a.id], s = mini.state(); var res = g && s ? g.result(s) : { score: 0 }; G.arcSent = true; cl.claim({ o: "sc", k: a.k, v: Math.max(0, Math.round(res.score || 0)) }); }
    if (G.arcade === a.k && !G.arcSent && !mini.active()) { G.arcSent = true; cl.claim({ o: "sc", k: a.k, v: 0 }); } }
  var SAY = { tag: "Tag!", ring: "Ring cleared!", catch: "Crate caught!", gold: "The golden nut!", goldup: "A golden kola nut has appeared!", arrive: "Arrived!", snap: "Snap!", return: "Returned!", found: "Found!", garri: "Garri delivered!", spill: "Spilled a cup!", ko: "Knock-down!", goal: "GOAL!", swish: "Swish!", miss: "Missed.", shade: "Shade gone.", hurt: "The shades are getting through!", gen: "Generator running!", drop: "Generator dropped!", swap: "Carrier change!", lost: "A walker wandered off!", lamp: "Lamp repaired.", cake: "The cake is ruined!", deliver: "Delivered!", spread: "Too spread out: +10 s", cp: "Checkpoint!" };
  var QUIET = { shade: 1, miss: 1, lamp: 1, snap: 1, arrive: 1 };
  function announce(z, s) { if (!SAY[s[0]]) return; if (!QUIET[s[0]]) send({ k: "co", o: "A", d: JSON.stringify({ t: s[0], p: typeof s[1] === "number" ? s[1] : null }) }); C.say(z, s[0], s[1]); }
  C.say = function (z, k, p) { var t = SAY[k]; if (!t) return; var N = z.net, who = typeof p === "number" ? (p === N.me ? "You" : (N.peers[p] && N.peers[p].name) || "") : ""; z.toast((who ? "<b>" + z.api.esc(who) + "</b> · " : "") + t); if (k === "goal" || k === "ko" || k === "gold") z.api.sound.sfx("goal"); };
  function name(z, p) { var N = z.net; if (p === N.me) return (z.P.name || "You"); return (N.peers[p] && N.peers[p].name) || "Player " + p; }
  function results(z, cl) { var st = cl.st, r = st.res, k = st.sid + ":" + st.si; if (G.shown === k) return; G.shown = k; var rw = cl.reward(), m = C.byId[st.mid], esc = z.api.esc;
    if (rw) { var P = z.P, day = new Date().toDateString(), b = P.coop || (P.coop = {}); if (b.day !== day) { b.day = day; b.cash = 0; b.xp = 0; } var cash = Math.max(0, Math.min(rw.cash, 3000 - b.cash)), xp = Math.max(0, Math.min(rw.xp, 600 - b.xp)); b.cash += cash; b.xp += xp; b.played = (b.played || 0) + 1; b.cos = b.cos || [];
      if (rw.win || (rw.cp && rw.place === 0)) { b.wins = (b.wins || 0) + 1; ["shirt_cof"].concat(m.teams ? ["scarf"] : [], st.mid === "F2" ? ["keke6"] : []).forEach(function (c) { if (b.cos.indexOf(c) < 0) { b.cos.push(c); z.toast("<b>Co-op unlock:</b> " + ({ shirt_cof: "'Class of Friends' shirt (MIB Store)", scarf: "Team scarf", keke6: "Six-seat keke skin" })[c]); } }); }
      if (cash) z.money(st.mut.indexOf("tp") >= 0 ? 0 : cash); if (cash && st.mut.indexOf("tp") >= 0) { for (var i = 0; i < 12; i++) z.float(z.me.x + Math.cos(i) * 2, z.me.y + Math.sin(i) * 2, "₦5", "#fde047"); P.money += cash; } if (xp) z.xp(xp); rw.cash = cash; rw.xp = xp; z.save(); }
    var top = r.rk.slice(0, 3).map(function (p) { return name(z, p); }), mine = r.rk.indexOf(z.net.me);
    if (z.moment && rw) { if (r.cp) z.moment(mine === 0 ? "raceWin" : "raceLose", { name: m.name, podium: top, place: mine + 1, cash: rw.cash, text: "Friends mission: " + m.name + ". Shake hands and go again." }); else z.moment(r.w ? "mission" : "fail", { title: m.name + (r.w ? "" : " — not this time"), cash: rw.cash, xp: rw.xp, text: r.w ? "" : "Together you'll get it next round." }); }
    var aw = r.aw.map(function (a) { return "<li><b>" + esc(a[0]) + ":</b> " + esc(name(z, a[1])) + "</li>"; }).join(""), rows = r.rk.map(function (p, i) { return "<li>" + (r.cp ? (i + 1) + ". " : "") + esc(name(z, p)) + (st.sc[p] != null ? " · " + st.sc[p] : "") + (r.ch.indexOf(p) >= 0 ? " (cheats on, unranked)" : "") + "</li>"; }).join("");
    var lg = st.set && Object.keys(st.lg).length ? "<p><b>League table</b></p><ol>" + Object.keys(st.lg).sort(function (a, b) { return st.lg[b] - st.lg[a]; }).map(function (p) { return "<li>" + esc(name(z, +p)) + " · " + st.lg[p] + "</li>"; }).join("") + "</ol>" : "";
    var last = st.si + 1 >= st.sl.length, trophy = st.set === "tour" && last ? "<p>🏆 Trophy at the Selfie Garden for <b>" + esc(name(z, +Object.keys(st.lg).sort(function (a, b) { return st.lg[b] - st.lg[a]; })[0])) + "</b>. 🥄 A wooden spoon (for garri) for <b>" + esc(name(z, +Object.keys(st.lg).sort(function (a, b) { return st.lg[a] - st.lg[b]; })[0])) + "</b>.</p>" : "";
    z.api.show("<h2>" + esc(m.name) + " — " + (r.cp ? (mine === 0 ? "you won!" : "results") : r.w ? "done together!" : "not this time") + "</h2>" + (r.cp ? "<ol style='text-align:left'>" : "<ul style='text-align:left'>") + rows + (r.cp ? "</ol>" : "</ul>") + "<p><b>Awards</b></p><ul style='text-align:left'>" + aw + "</ul>" + lg + trophy + (rw ? "<p class='gm-small'>+₦" + rw.cash + " · +" + rw.xp + " XP" + (rw.cheat ? " · cheats were on, so no prize" : "") + " (friends missions pay up to ₦3,000 and 600 XP a day)</p>" : "") + "<p class='gm-small'>" + (last ? "Group photo time: everybody wave!" : "Next mission in a few seconds…") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>OK</button>" + (C.isHost() ? "<button class='gm-btn' data-act='stop'>End the evening</button>" : "") + "</div>",
      function (a) { z.api.hide(); if (a === "stop" && G.host) G.host.cancel(); });
    if (z.emote) z.emote("wave"); }
  C.click = function (px, py) { var h = G.hud; if (!C.active() || !h || !h.task || !G.btn) return false; var b = G.btn; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { G.tap = true; return true; } return false; };
  C.hud = function (x, t) { var z = Z(); if (!z || !G.cl || !G.cl.st || !x || !x.fillText) return; var st = G.cl.st, m = C.byId[st.mid], h = G.hud || {}, task = h.task, N = z.net, esc = function (s) { return s; };
    var L = C.layout(st, z.W), dur = m.dur(L, st), left = st.ph === "go" ? Math.max(0, Math.ceil(dur - st.t)) : 0, px = 712, py = 238, w = 238;
    x.save(); x.fillStyle = "rgba(4,12,20,.78)"; x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, 132, 12); else x.rect(px, py, w, 132); x.fill();
    x.textAlign = "left"; x.font = "800 13px system-ui, sans-serif"; x.fillStyle = "#67e8f9"; x.fillText("FRIENDS · " + m.name.toUpperCase(), px + 10, py + 18);
    x.font = "700 11px system-ui, sans-serif"; x.fillStyle = "#e2e8f0"; var ph = st.ph === "br" ? "Get ready…" : st.ph === "ct" ? "Starting in " + Math.max(1, Math.ceil(4 - st.pt)) : st.ph === "go" ? (left >= 60 ? Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2) : left + " s") + " left" + (m.rounds(L, st) > 1 ? " · round " + (st.rd + 1) + "/" + m.rounds(L, st) : "") : st.ph === "rs" ? "Results" : "";
    x.fillText(ph + (G.cl.mine() ? "" : " · watching"), px + 10, py + 34);
    var txt = st.ph === "br" ? m.what : task ? task.txt : "", lines = wrapT(x, txt, w - 20).slice(0, 3); x.fillStyle = "#fef9c3"; lines.forEach(function (l, i) { x.fillText(l, px + 10, py + 52 + i * 14); });
    var ord = comp(m, L) ? (m.rank ? m.rank(st, L, null) : byScore(st)) : byScore(st); x.font = "600 10px system-ui, sans-serif"; ord.slice(0, 4).forEach(function (p, i) { x.fillStyle = p === N.me ? "#fde047" : "#cbd5e1"; var nm = name(z, p); x.fillText((i + 1) + ". " + nm.slice(0, 12) + (st.sc[p] != null ? "  " + (Math.round(st.sc[p] * 10) / 10) : "") + (st.tm[p] != null && m.teams ? "  [" + "AB"[st.tm[p]] + "]" : ""), px + 10 + (i % 2) * 112, py + 104 + Math.floor(i / 2) * 13); });
    var curV = z.me.veh ? z.me.veh.type : "", needV = task && task.veh !== undefined && task.veh !== curV;
    G.btn = null; if (task && (task.act || needV) && st.ph === "go") { var lab = (needV ? (task.veh ? "Get a " + VNAME[task.veh] : "Get off and walk") : (task.lab || (task.act.o === "emote" ? "Pose: " + task.act.e : "Go"))) + " · " + (z.api.keyName ? z.api.keyName("coop") : "G"); x.font = "800 14px system-ui, sans-serif"; var bw = x.measureText(lab).width + 28; G.btn = { x: 480 - bw / 2, y: 440, w: bw, h: 30 }; x.fillStyle = "rgba(34,211,238,.9)"; x.beginPath(); if (x.roundRect) x.roundRect(G.btn.x, G.btn.y, bw, 30, 15); else x.rect(G.btn.x, G.btn.y, bw, 30); x.fill(); x.fillStyle = "#04121c"; x.textAlign = "center"; x.fillText(lab, 480, 460); }
    if (G.rhythm) { var R = G.rhythm, per = 60 / R.bpm, ph2 = (R.t % per) / per; x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(330, 400, 300, 26); x.fillStyle = "#f0abfc"; x.fillRect(330 + 300 * ph2 - 3, 400, 6, 26); x.fillStyle = "#fde047"; x.fillRect(327, 400, 6, 26); x.font = "800 11px system-ui, sans-serif"; x.textAlign = "center"; x.fillStyle = "#fff"; x.fillText("BEAT · " + R.sc + " pts · streak " + R.streak, 480, 394); }
    if (G.meter) { var v = G.meter.ph > 1 ? 2 - G.meter.ph : G.meter.ph; x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(380, 400, 200, 18); x.fillStyle = "rgba(134,239,172,.6)"; x.fillRect(460, 400, 40, 18); x.fillStyle = "#fff"; x.fillRect(380 + 200 * v - 2, 398, 4, 22); }
    if (task && task.mk && z.r3 && z.r3.ready && z.r3.project) task.mk.forEach(function (k) { var q = z.r3.project(k.x, (task.fly ? 40 : 1.5), k.y); if (!q || q.x < -30 || q.x > 990 || q.y < -30 || q.y > 570) return; x.strokeStyle = k.c; x.lineWidth = 3; x.beginPath(); x.arc(q.x, q.y, Math.max(5, Math.min(26, (k.r || 2) * 2)), 0, TAU); x.stroke(); if (k.l) { x.font = "800 10px system-ui, sans-serif"; x.textAlign = "center"; x.fillStyle = k.c; x.fillText(k.l, q.x, q.y - 14); } });
    x.restore(); void esc; void t; };
  function wrapT(x, s, w) { var out = [], line = ""; String(s || "").split(" ").forEach(function (word) { var t2 = line ? line + " " + word : word; if (x.measureText(t2).width > w && line) { out.push(line); line = word; } else line = t2; }); if (line) out.push(line); return out; }
  // the phone screen: pick a mission or a set, mutators and options; only works inside a room
  var MENU = { mut: {}, opt: { veh: "", tm: false, vs: false, ch: false } };
  C.menu = function (back) { var z = Z(); if (!z) return; var N = z.net, esc = z.api.esc, n = Object.keys(N.peers).length + 1;
    if (!N.on) { z.toast("Join a room first (Phone → Multiplayer)."); return; }
    if (C.active()) { var st = G.cl.st, m = C.byId[st.mid]; return z.api.show("<h2>Friends mission running</h2><p><b>" + esc(m.name) + "</b> · " + esc(m.what) + "</p><p class='gm-small'>" + (G.cl.mine() ? "You're playing." : "You joined late: you'll be in the next one.") + "</p><div class='gm-actions'>" + (C.isHost() ? "<button class='gm-btn' data-act='stop'>End it for everyone</button>" : "") + "<button class='gm-btn gm-btn--go' data-act='ok'>Back to it</button></div>", function (a) { z.api.hide(); if (a === "stop" && G.host) G.host.cancel(); }); }
    if (!N.me) { z.toast("Connecting to the room… try again in a second."); return; }
    var html = "<h2>Friends missions</h2><p class='gm-small'>" + n + " in the room. You host: everybody here plays. Missions never touch the story.</p>";
    html += "<div class='gm-actions'>" + C.SETS.map(function (s) { return "<button class='gm-btn gm-btn--go' data-act='s:" + s.id + "' title='" + esc(s.what) + "'>" + esc(s.name) + "</button>"; }).join("") + "</div>";
    C.GROUPS.forEach(function (g) { html += "<p style='margin:.5em 0 .2em'><b>" + esc(g[1]) + "</b></p><div class='gm-actions'>" + M.filter(function (m) { return m.g === g[0]; }).map(function (m) { var ok = allowed(m, n); return "<button class='gm-btn gm-btn--sm' data-act='m:" + m.id + "'" + (ok ? "" : " disabled") + " title='" + esc(m.what) + "'>" + esc(m.name) + (ok ? "" : " (" + m.min + "+)") + "</button>"; }).join("") + "</div>"; });
    html += "<p style='margin:.5em 0 .2em'><b>Twists</b></p><div class='gm-actions'>" + C.MUTATORS.map(function (q) { return "<button class='gm-btn gm-btn--sm' data-act='u:" + q[0] + "' aria-pressed='" + !!MENU.mut[q[0]] + "' title='" + esc(q[2]) + "'>" + (MENU.mut[q[0]] ? "✓ " : "") + esc(q[1]) + "</button>"; }).join("") + "</div>";
    html += "<div class='gm-actions'><button class='gm-btn gm-btn--sm' data-act='o:veh'>Race vehicle: " + esc(MENU.opt.veh ? VNAME[MENU.opt.veh] : "random") + "</button><button class='gm-btn gm-btn--sm' data-act='o:tm'>Kola Rush teams: " + (MENU.opt.tm ? "on" : "off") + "</button><button class='gm-btn gm-btn--sm' data-act='o:vs'>Photo Hunt: " + (MENU.opt.vs ? "versus" : "co-op") + "</button><button class='gm-btn gm-btn--sm' data-act='o:ch'>Cheats &amp; hidden character: " + (MENU.opt.ch ? "allowed" : "off") + "</button></div><div class='gm-actions'><button class='gm-btn' data-act='back'>Back</button></div>";
    z.api.show(html, function (a) { if (a === "back") { z.api.hide(); if (back) back(); return; }
      if (a.slice(0, 2) === "u:") { var k = a.slice(2); MENU.mut[k] = !MENU.mut[k]; return C.menu(back); }
      if (a === "o:veh") { var vs = ["", "bike", "scooter", "okada", "car", "sport"]; MENU.opt.veh = vs[(vs.indexOf(MENU.opt.veh) + 1) % vs.length]; return C.menu(back); }
      if (a === "o:tm" || a === "o:vs" || a === "o:ch") { var o = a.slice(2); MENU.opt[o] = !MENU.opt[o]; return C.menu(back); }
      var sel = a.slice(2); if (a[0] === "s" || a[0] === "m") { var ps = [N.me].concat(Object.keys(N.peers).map(Number)), mut = Object.keys(MENU.mut).filter(function (k) { return MENU.mut[k]; }), opt = { veh: MENU.opt.veh, tm: MENU.opt.tm, vs: MENU.opt.vs, ch: MENU.opt.ch, ride: MENU.opt.veh || "okada" };
        G.host = new C.Host(N.me, z.W); G.cl = new C.Client(N.me, z.W); if (!G.host.start(sel, ps, opt, mut)) { G.host = null; z.toast("Not enough players for that one."); return; } z.api.hide(); z.toast("<b>Friends mission:</b> " + esc(C.byId[G.host.st.mid].name) + " starts in a few seconds."); } }); };
  // two hooks the game already calls: hits on walkers and bumps count for the missions that care
  C.offend = function (kind) { if (!C.active() || !G.cl || !G.cl.mine() || G.cl.st.ph !== "go") return; var mid = G.cl.st.mid; if (kind === "hitPed" && mid === "F5") G.cl.claim({ o: "pd" }); if ((kind === "crash" || kind === "bump" || kind === "kerb" || kind === "hitPed") && (mid === "F2" || mid === "F15" || mid === "F24")) G.cl.claim({ o: "bp" }); };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
  root.FSLGCoop = C;
})(typeof window !== "undefined" ? window : this);
