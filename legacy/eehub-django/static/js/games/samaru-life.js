/* Freshers School Life — student life: sex, hostel, department and faith choices, a weekly timetable, the "next up"
   strip, lecture scenes and students streaming to class. Everything here is optional for the player: nothing is forced.
   Loaded after samaru-core.js; it wraps a few Z functions instead of editing them. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z || !S || !D) return;
  var L = Z.life = { delay: 1 }, TAU = Math.PI * 2;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hm(m) { var h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm; }
  function hash(a, b) { return S.hash ? S.hash(a, b) : Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1; }

  /* ---------- data ---------- */
  L.DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // id, name, course code, place id, fallback place ids, question subject, two core course titles
  L.DEPTS = [
    ["elect", "Electrical Engineering", "EEEN", "dept_elect", ["ee"], "ee", ["Circuit Theory", "Electrical Machines"]],
    ["mech", "Mechanical Engineering", "MEEN", "dept_mech", ["ee"], "phys", ["Machine Design", "Fluid Mechanics"]],
    ["civil", "Civil Engineering", "CVEN", "dept_civil", ["ee"], "phys", ["Structural Analysis", "Soil Mechanics"]],
    ["chem", "Chemical Engineering", "CHEN", "dept_chem", ["chemeng"], "chem", ["Transport Phenomena", "Reaction Engineering"]],
    ["agric", "Agricultural Engineering", "AGEN", "dept_agric", ["chemeng", "ee"], "chem", ["Farm Power", "Irrigation Engineering"]],
    ["metal", "Metallurgical Engineering", "MMEN", "dept_metal", ["chemeng", "ee"], "chem", ["Physical Metallurgy", "Materials Science"]],
    ["mining", "Mining Engineering", "MNEN", "dept_mining", ["ee"], "phys", ["Mine Surveying", "Rock Mechanics"]],
    ["comp", "Computer Engineering", "COEN", "dept_comp", ["ee"], "ee", ["Digital Logic", "Computer Architecture"]],
    ["telecom", "Telecommunications Engineering", "TCEN", "dept_telecom", ["ee"], "ee", ["Communication Principles", "Antennas and Propagation"]],
    ["water", "Water Resources Engineering", "WREN", "dept_water", ["chemeng", "ee"], "phys", ["Hydrology", "Hydraulics"]],
    ["compsci", "Computer Science", "COSC", "compsci", ["maths"], "math", ["Programming", "Data Structures"]],
    ["physics", "Physics", "PHYS", "physics", ["maths"], "phys", ["Modern Physics", "Optics"]]
  ].map(function (d) { return { id: d[0], name: d[1], code: d[2], place: d[3], fb: d[4], subject: d[5], core: d[6] }; });
  L.COMMON = {
    100: [["MATH 101", "Elementary Mathematics", "math"], ["PHYS 111", "Mechanics", "phys"], ["CHEM 101", "General Chemistry", "chem"], ["GENS 101", "Use of English", "gen"], ["ENGG 102", "Introduction to Engineering", "ee"]],
    200: [["ENGG 201", "Engineering Mathematics I", "math"], ["ENGG 203", "Engineering Mechanics", "phys"], ["EEEN 201", "Circuit Theory I", "ee"], ["GENS 202", "Entrepreneurship", "gen"]],
    300: [["ENGG 301", "Engineering Mathematics III", "math"], ["EEEN 316", "Computational Methods with MATLAB", "math"], ["EEEN 303", "Electromagnetic Fields", "phys"], ["GENS 301", "Peace Studies", "gen"]],
    400: [["ENGG 401", "Numerical Methods", "math"], ["EEEN 407", "Control Engineering", "ee"], ["ENGG 405", "Engineering Economics", "gen"], ["ENGG 403", "Technical Report Writing", "gen"]],
    500: [["ENGG 501", "Engineering Law and Management", "gen"], ["EEEN 519", "Modelling and Simulation", "math"], ["ENGG 503", "Project Seminar", "gen"], ["EEEN 505", "Power Systems", "ee"]]
  };
  L.STAFF = ["Dr Bello", "Prof. Okafor", "Engr. Yusuf", "Dr Adeyemi", "Mrs Danjuma", "Dr Lawal", "Prof. Ibrahim", "Engr. Nwosu"]; // fictional
  L.LESSONS = {
    ee: [["Current is charge on the move. Voltage is the push behind it.", "Resistance is how hard the path pushes back: V equals I times R.", "Before you solve any circuit, mark your node voltages. Half the work is bookkeeping."],
      ["Power is voltage times current. That is what NEPA bills you for, per hour.", "In series the same current flows; in parallel the same voltage sits across.", "Kirchhoff: what enters a node must leave it. Charge does not pile up."]],
    phys: [["A body keeps doing what it is doing until a force says otherwise.", "Force is mass times acceleration. Draw the free-body diagram first, always.", "Energy is never lost, only moved. Follow where it goes and the problem opens."],
      ["Velocity is how fast and which way. Speed alone forgets the direction.", "Momentum before equals momentum after, when nothing outside pushes.", "Units are free marks. Carry them through every line."]],
    math: [["A derivative is a slope that will not sit still.", "An integral adds up thin slices: area, distance, charge.", "If you cannot solve it, sketch it. The graph usually tells you the answer's shape."],
      ["A matrix is a machine that moves vectors.", "Solve the small case by hand before you trust the computer.", "Check your answer by putting it back in the question."]],
    chem: [["Atoms keep their own count. Balance the equation before anything else.", "A mole is just a very big dozen.", "Acids give protons, bases take them. pH tells you who is winning."],
      ["Heat flows from hot to cold, never the other way by itself.", "Rate depends on how often molecules meet and how hard.", "Write the units on the gas constant and the mistakes show themselves."]],
    gen: [["A report nobody can read is a report nobody will use.", "Say the main point first. Then prove it.", "Cite what you borrow. Your name is the only thing you truly own here."],
      ["A good engineer listens before drawing.", "Budget the time as well as the money.", "Write so that a tired person can still follow you."]]
  };
  L.REACT = { good: ["The whole row nods.", "Somebody behind you whispers: 'Sharp guy.'", "The lecturer points at you: 'Correct.'", "Your seatmate copies it down fast."], bad: ["Somebody coughs. Nobody laughs.", "Your seatmate slides you the right page.", "The lecturer says: 'Close. Think again at home.'", "A hand goes up three rows back."] };
  // lecture halls and other stops, each with stand-ins used until the map has them
  var FALL = { kt: ["theatre", "fslt"], wt: ["theatre", "fslt"], nelt: ["fslt", "theatre"], macd: ["buka", "shinkafi"], court: ["social"], compsci: ["maths"] };
  L.resolve = function (id) {
    if (id === "@home") return (Z.P && Z.P.home && Z.places[Z.P.home]) ? Z.P.home : "akenzua"; if (id === "@dept" || id === "@lab") return L.deptPlace();
    if (Z.places[id]) return id; var f = FALL[id] || []; for (var i = 0; i < f.length; i++) if (Z.places[f[i]]) return f[i]; return null;
  };
  L.dept = function (id) { for (var i = 0; i < L.DEPTS.length; i++) if (L.DEPTS[i].id === id) return L.DEPTS[i]; return L.DEPTS[0]; };
  L.deptPlace = function () { var d = L.dept(Z.P && Z.P.life && Z.P.life.dept); if (Z.places[d.place]) return d.place; for (var i = 0; i < d.fb.length; i++) if (Z.places[d.fb[i]]) return d.fb[i]; return "senate"; };
  var SEX = { amina: "f", ribadu: "f", dangote: "m", danfodio: "m" }, PH2 = { dangote: 1, danfodio: 1 };
  L.hostels = function (sex) { return Z.placeList.filter(function (p) { var sx = (p.def && p.def.sex) || SEX[p.id] || "m"; return p.role === "home" && (sx === sex || sx === "x"); }); };
  L.phase2 = function (id) { var p = Z.places[id]; return !!(p && ((p.def && (p.def.phase2 || p.def.phase === 2)) || PH2[id])); };

  /* ---------- state ---------- */
  L.ensure = function (P) {
    var lf = P.life; if (!lf || typeof lf !== "object") lf = P.life = {};
    if (lf.sex !== "m" && lf.sex !== "f") { var ch = Z.charOf ? Z.charOf(P.char) : null; lf.sex = ch && ch.voice === "female" ? "f" : "m"; }
    if (!lf.dept) lf.dept = "elect"; if (!lf.faith) lf.faith = "none";
    if (!(lf.acad >= 100)) lf.acad = 100; ["att", "missed", "streak", "best"].forEach(function (k) { if (!(lf[k] >= 0)) lf[k] = 0; });
    if (!lf.done || lf.done.day !== P.day) lf.done = { day: P.day, k: {}, miss: {} }; if (!lf.done.k) lf.done.k = {}; if (!lf.done.miss) lf.done.miss = {};
    if (!P.home || !Z.places[P.home]) P.home = (L.hostels(lf.sex)[0] || { id: "akenzua" }).id;
    return lf;
  };
  L.acadFor = function (P) { var n = 0; if (P.m && P.m.done) for (var k in P.m.done) if (P.m.done[k] && /^m\d+$/.test(k)) n++; return 100 + 100 * Math.min(4, Math.max(Math.floor(n / 8), Math.floor((P.lvl || 1) / 12))); };
  L.courses = function (acad, dept) { var d = L.dept(dept), c = (L.COMMON[acad] || L.COMMON[100]).map(function (q) { return { code: q[0], title: q[1], s: q[2] }; }); d.core.forEach(function (t, i) { c.push({ code: d.code + " " + (acad + 5 + i * 2), title: t, s: d.subject, core: true }); }); return c; };

  /* ---------- the week ---------- */
  var cache = {};
  L.week = function (P) {
    var lf = L.ensure(P), key = [lf.acad, lf.dept, lf.faith].join("|"); if (cache[key]) return cache[key];
    var cs = L.courses(lf.acad, lf.dept), di = L.DEPTS.indexOf(L.dept(lf.dept)), days = [], halls = ["kt", "wt", "@dept", "nelt", "wt", "kt", "@lab"], slots = [480, 600, 840, 960], seq = 0;
    function add(d, kind, start, end, place, label, extra) { var e = { kind: kind, start: start, end: end, place: place, label: label }; if (extra) for (var k in extra) e[k] = extra[k]; days[d].push(e); }
    for (var d = 0; d < 7; d++) {
      days.push([]);
      if (d < 5) {
        var n = 2 + Math.floor(hash(lf.acad + d * 7, di + 3) * 3), skip = Math.floor(hash(d + 11, lf.acad + di) * 4);
        for (var i = 0; i < 4; i++) { if (n < 4 && (n === 2 ? (i === skip || i === (skip + 2) % 4) : i === skip)) continue; var c = cs[seq++ % cs.length], hall = c.core ? (i % 2 ? "@lab" : "@dept") : halls[(d * 2 + i + di) % halls.length]; add(d, "class", slots[i], slots[i] + 120, hall, c.code + " " + c.title, { course: c, staff: L.STAFF[(seq + di) % L.STAFF.length] }); }
        add(d, "break", 720, 780, "macd", "Lunch break");
        if (d < 4) add(d, "study", 1170, 1260, "library", "Evening study at the Library"); else add(d, "social", 1200, 1320, "social", "Friday night at the Social Centre");
      } else if (d === 5) { add(d, "errand", 660, 720, "bookshop", "Bookshop run"); add(d, "break", 780, 840, "shinkafi", "Lunch at Shinkafi"); add(d, "sport", 990, 1080, "court", "Basketball with the hall"); add(d, "social", 1200, 1320, "shinkafi", "Saturday night at Shinkafi"); }
      else { add(d, "break", 780, 840, "macd", "Sunday rice"); add(d, "study", 960, 1080, "library", "Read ahead for Monday"); }
      if (lf.faith === "muslim") { if (d === 4) add(d, "prayer", 780, 840, "mosque", "Jumu'ah at the Central Mosque"); else add(d, "prayer", 795, 825, "mosque", "Zuhr prayer"); add(d, "prayer", 1110, 1130, "mosque", "Maghrib prayer"); }
      if (lf.faith === "christian") { if (d === 6) add(d, "prayer", 540, 630, "chapel", "Sunday service at the Chapel"); if (d === 2) add(d, "prayer", 1110, 1160, "chapel", "Midweek fellowship"); }
      add(d, "sleep", 1350, 1440, "@home", "Back to the hostel and sleep");
      days[d].sort(function (a, b) { return a.start - b.start || a.end - b.end; }); days[d].forEach(function (e, j) { e.i = j; e.dow = d; });
    }
    return (cache[key] = days);
  };
  L.dow = function (P, off) { return (((P.day || 1) - 1 + (off || 0)) % 7 + 7) % 7; };
  L.today = function (P, off) { return L.week(P)[L.dow(P, off)]; };
  function place(e) { var id = L.resolve(e.place); return id ? Z.places[id] : null; }
  function closeAt(e) { return e.kind === "class" ? e.end - (Z.P && Z.P.flags && Z.P.flags.pass_queue ? 4 : 20) : e.end; }       // you can walk in late, but not at the very end
  function openAt(e) { return e.start - (e.kind === "class" ? 30 : 20); }
  L.view = function (e, tomorrow) { var p = place(e); return { kind: e.kind, place: p ? p.id : null, placeName: p ? p.name : "", start: e.start, end: e.end, label: e.label, course: e.course || null, staff: e.staff || "", i: e.i, tomorrow: !!tomorrow, e: e }; };
  // The next thing on your day that you have not done or missed. {kind, place, start, end, label, ...} or null.
  L.next = function () {
    var P = Z.P; if (!P) return null; var lf = L.ensure(P), t = P.time, list = L.today(P), i;
    for (i = 0; i < list.length; i++) if (!lf.done.k[i] && !lf.done.miss[i] && t < closeAt(list[i]) && place(list[i])) return L.view(list[i]);
    list = L.today(P, 1); for (i = 0; i < list.length; i++) if (place(list[i])) return L.view(list[i], true); return null;
  };
  // Is there a lecture at this place that is on now or about to start? Friends use this to walk to class with you.
  L.attending = function (placeId) { var n = L.next(); return n && n.kind === "class" && !n.tomorrow && n.place === placeId && Z.P.time >= openAt(n.e) ? n : null; };
  L.target = function () { var n = L.next(); if (!n || !n.place) return null; var p = Z.places[n.place]; return { x: p.mx, y: p.my, name: p.name }; };
  L.status = function (n) { var t = Z.P.time; if (n.tomorrow) return "tomorrow " + hm(n.start); if (t < n.start) { var m = Math.round(n.start - t); return m > 90 ? "at " + hm(n.start) : "in " + m + " min"; } return n.kind === "class" ? "on now, slip in" : "now"; };

  /* ---------- doing things ---------- */
  function say(h) { if (Z.toast) Z.toast(h); }
  function nextLine() { var n = L.next(); return n ? "<br><small>Next: " + esc(n.label) + " · " + esc(n.placeName) + " · " + L.status(n) + "</small>" : ""; }
  L.complete = function (e, quiet) {
    var P = Z.P, lf = L.ensure(P); if (lf.done.k[e.i]) return false; lf.done.k[e.i] = 1;
    if (e.kind === "prayer") { P.energy = Math.min(100, P.energy + 6); lf.calm = (lf.calm || 0) + 1; if (!quiet) say("<b>" + esc(e.label) + ".</b> You come out lighter." + nextLine()); }
    else if (e.kind === "break") { if (!quiet) say("<b>" + esc(e.label) + ".</b> Eat something before the next lecture." + nextLine()); }
    else if (e.kind === "study") { S.addXp(P, 15); if (!quiet) say("<b>" + esc(e.label) + ".</b> +15 XP for showing up. A study session here gives more." + nextLine()); }
    else if (e.kind === "social" || e.kind === "sport") { S.addXp(P, 10); P.energy = Math.max(1, P.energy - (e.kind === "sport" ? 6 : 0)); if (!quiet) say("<b>" + esc(e.label) + ".</b> +10 XP. Everybody is here." + nextLine()); }
    else if (e.kind === "errand") { if (!quiet) say("<b>" + esc(e.label) + ".</b> Notebooks, a calculator, airtime." + nextLine()); }
    return true;
  };
  var tickT = 0, deptIn = false;
  L.tick = function (dt) {
    var P = Z.P; if (!P || Z.mode !== "play") return; tickT -= dt; if (tickT > 0) return; tickT = .5;
    var lf = L.ensure(P), me = Z.inside ? Z.inside.out : Z.me, list = L.today(P), t = P.time, i, e, p;
    for (i = 0; i < list.length; i++) {
      e = list[i]; if (lf.done.k[i] || lf.done.miss[i]) continue; p = place(e); if (!p) continue;
      if (t >= closeAt(e)) { lf.done.miss[i] = 1; if (e.kind === "class") { if (Z.focus && Z.focus.excuse()) say("<b>" + esc(e.course.code) + "</b> went on without you while you were working. Excused this once today."); else { lf.missed++; lf.streak = 0; if (!Z.focus || Z.focus.allow("missed-class")) say("You missed <b>" + esc(e.course.code) + "</b>. No wahala: catch the next one." + nextLine()); } } continue; }
      if (e.kind === "class" && Z.focus && Z.focus.busy() && t >= e.start - 15 && t < closeAt(e) && Z.focus.allow("class-warning", i)) say("Class at " + ("0" + Math.floor(e.start / 60)).slice(-2) + ":" + ("0" + Math.floor(e.start % 60)).slice(-2) + ": <b>" + esc(e.course.code) + "</b>. Finish up or cancel the job.");
      if (e.kind !== "class" && e.kind !== "sleep" && t >= openAt(e) && Math.hypot(p.mx - me.x, p.my - me.y) < 16) L.complete(e);
    }
    var dp = Z.places[L.deptPlace()], near = dp && Math.hypot(dp.mx - me.x, dp.my - me.y) < 13; if (near && !deptIn && Z.emit) Z.emit({ t: "go", place: "@dept" }); deptIn = !!near;
    var ac = L.acadFor(P); if (ac > lf.acad) { lf.acad = ac; cache = {}; lf.done = { day: P.day, k: {}, miss: {} }; if (Z.moment) Z.moment("goal", { title: "Promoted to " + ac + " level" }); say("<b>" + ac + " level.</b> New courses are on your timetable."); }
    stream(lf, list, t);
  };
  // Students walk to the hall before a lecture and spill out after it.
  function stream(lf, list, t) {
    if (!Z.peds || !Z.W || !S.randomRoadPoint || !S.wanderStart || Z.inside) return; var me = Z.me, i, n, k;
    for (k = Z.peds.length - 1; k >= 0; k--) { n = Z.peds[k]; if (!n.hall) continue; if (n.fade != null) { if (n.fade <= 0) Z.peds.splice(k, 1); } else if (Math.hypot(n.hall.x - n.x, n.hall.y - n.y) < 2.2 || t > n.hall.until) n.fade = 1; else { n.w.x = n.hall.x; n.w.y = n.hall.y; } }
    for (i = 0; i < list.length; i++) {
      var e = list[i]; if (e.kind !== "class") continue; var p = place(e); if (!p) continue; var d = Math.hypot(p.mx - me.x, p.my - me.y); if (d > 150) continue;
      var going = t >= e.start - 12 && t < e.start + 4, leaving = t >= e.end - 2 && t < e.end + 8; if (!going && !leaving) continue;
      var have = 0; for (k = 0; k < Z.peds.length; k++) if (Z.peds[k].cls === e.i) have++; if (have >= 9 || Math.random() > .6) continue;
      var q = S.randomRoadPoint(Z.W, Math.random, false, { x: p.mx, y: p.my }, going ? 60 : 16); if (!q || Math.hypot(q.x - me.x, q.y - me.y) < 14) continue;
      var w = S.wanderStart(Z.W, Math.random, q, false), sd = Math.floor(Math.random() * 1e6), sd0 = (Math.random() < .5 ? 1 : -1) * (q.r.w / 2 + 1.2); S.wanderStep(Z.W, w, 0, Math.random, sd0); if (Z.brawl && (!Z.brawl.okSpawn(w, 135, 45) || Z.brawl.onRoad(w.x, w.y))) continue; /* same rule as every walker: on the pavement, out of sight */
      n = { w: w, x: w.x, y: w.y, a: w.a, spd: 0, look: Z.lookOf ? Z.lookOf(sd) : (Z.peds[0] && Z.peds[0].look) || { skin: "#6b4226", hair: "low", top: "#2563eb" }, sp: 1.5 + Math.random() * .8, side: (Math.random() < .5 ? 1 : -1) * 1.6, walk: Math.random() * 6, fall: 0, wave: 0, flee: 0, k: sd % 7, cls: e.i };
      if (going) { var dr = Z.interior && Z.interior.doors && Z.interior.doors[p.id], dg = dr && dr.g ? dr.g.position : null; n.hall = { x: dg ? dg.x : p.mx, y: dg ? dg.z : p.my, until: e.start + 6 }; } Z.peds.push(n);
    }
  }

  /* ---------- lecture scene ---------- */
  function hallCanvas(seat, at) { // a raked hall seen from the back: board, lecturer, rows of heads, your seat
    try {
      var cv = document.querySelector("[data-gm-overlay] canvas[data-hall]"); if (!cv) return; var x = cv.getContext("2d"), W = cv.width, H = cv.height, r, c;
      var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1e293b"); g.addColorStop(1, "#0b1220"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = "#14532d"; x.fillRect(W * .2, 14, W * .6, 62); x.strokeStyle = "#a16207"; x.lineWidth = 4; x.strokeRect(W * .2, 14, W * .6, 62);
      x.fillStyle = "rgba(255,255,255,.85)"; x.font = "700 15px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(at || "", W / 2, 50);
      x.fillStyle = "#7c2d12"; x.fillRect(W * .3, 92, W * .4, 12); x.fillStyle = "#6b4226"; x.beginPath(); x.arc(W * .5 + Math.sin(Date.now() / 900) * 30, 82, 9, 0, TAU); x.fill(); x.fillStyle = "#e2e8f0"; x.fillRect(W * .5 + Math.sin(Date.now() / 900) * 30 - 8, 90, 16, 16);
      var skins = ["#6b4226", "#8a5633", "#4a2c17", "#74472a", "#9a6a44"], tops = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0ea5e9", "#e11d48", "#f8fafc"];
      for (r = 0; r < 5; r++) { var y = 128 + r * 28, n = 9 + r * 2, sc = .7 + r * .12; x.fillStyle = "#334155"; x.fillRect(W * .5 - (n * 26 * sc) / 2 - 8, y + 9 * sc, n * 26 * sc + 16, 7);
        for (c = 0; c < n; c++) { var px = W * .5 + (c - (n - 1) / 2) * 26 * sc, mine = r === [0, 2, 4][seat] && c === Math.floor(n / 2), hs = hash(r * 31 + c, 7); if (!mine && hs < .14) continue;
          x.fillStyle = mine ? "#fde047" : tops[Math.floor(hs * 97) % tops.length]; x.fillRect(px - 8 * sc, y, 16 * sc, 12 * sc); x.fillStyle = skins[Math.floor(hs * 53) % skins.length]; x.beginPath(); x.arc(px, y - 5 * sc, 6.5 * sc, 0, TAU); x.fill();
          if (mine) { x.strokeStyle = "#fde047"; x.lineWidth = 2; x.beginPath(); x.arc(px, y - 5 * sc, 10 * sc, 0, TAU); x.stroke(); } } }
    } catch (err) {}
  }
  function later(f, ms) { if (L.delay) setTimeout(f, ms * L.delay); else f(); }
  L.lecture = function (pl, n, done) {
    var P = Z.P, lf = L.ensure(P), api = Z.api, e = n.e || n, c = e.course, seat = 1, late = P.time > e.start + 10, nq = 3, right = 0, qi = 0;
    var pr = L.prep(e), lines = pr.lines, qs = pr.qs, spare = P.inv && P.inv.calculator ? 1 : 0;
    var with_ = []; try { with_ = Z.friends && Z.friends.companions ? Z.friends.companions() : []; with_.forEach(function (q) { q.ft = Math.max(q.ft || 0, 240); }); } catch (err) {} // friends walking with you sit in the same lecture and leave with you
    var pals = with_.map(function (q) { return q.def ? q.def.name : null; }).concat(Object.keys(P.friends || {}).map(function (id) { var q = Z.npc && Z.npc(id); return q && q.def && with_.indexOf(q) < 0 ? q.def.name : null; })).filter(Boolean).slice(0, 2);
    var head = "<p class='gm-small'>" + esc(pl.name) + " · " + esc(c.code) + " · " + hm(e.start) + " to " + hm(e.end) + " · " + esc(e.staff) + "</p>", small = false;
    function cvs() { return "<canvas data-hall width='640' height='270' style='width:auto;max-width:100%;height:" + (small ? "clamp(70px,17vh,150px)" : "clamp(110px,34vh,270px)") + ";border-radius:12px;display:block;margin:0 auto 4px'></canvas>"; }
    function show(html, on) { api.show(head + cvs() + html, on); hallCanvas(seat, c.code); }
    if (Z.guide && Z.guide.note) Z.guide.note("quiz");
    show("<h2 style='font-size:clamp(18px,3.4vw,26px)'>" + esc(c.title) + "</h2><p>" + (late ? "You slip in late. Heads turn, then turn back." : "The hall is filling up.") + (pals.length ? " " + esc(pals.join(" and ")) + (with_.length ? (pals.length > 1 ? " take seats beside you." : " takes the seat beside you.") : (pals.length > 1 ? " are" : " is") + " already here and waves you over.") : "") + " Where will you sit?</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='s0'>Front row</button><button class='gm-btn' data-act='s1'>Middle</button><button class='gm-btn' data-act='s2'>Back row</button><button class='gm-btn' data-act='leave'>Leave</button></div><p class='gm-small'>Front row: +10% XP. Back row: you rest a little.</p>",
      function (a) { if (a === "leave") { api.hide(); return; } seat = +a.slice(1) || 0; if (Z.me) Z.me.sit = 0; teach(0); });
    function teach(i) {
      if (i >= lines.length) return ask(); try { api.sound.say(lines[i], { voice: i % 2 ? "female" : "male", pitch: .9 }); } catch (err) {}
      show("<p><b>" + esc(e.staff) + ":</b> <i>“" + esc(lines[i]) + "”</i></p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='n'>" + (i < lines.length - 1 ? "Keep listening" : "Any questions?") + "</button></div>", function () { teach(i + 1); });
    }
    function ask() {
      if (qi >= qs.length) return end(); small = true; var q = qs[qi], order = [0, 1, 2, 3].sort(function () { return Math.random() - .5; });
      show("<p class='gm-small'>" + esc(e.staff) + " looks straight at you. Question " + (qi + 1) + " of " + qs.length + "</p><h2 style='font-size:clamp(17px,3.2vw,24px)'>" + esc(q.q) + "</h2><div class='gm-actions' style='flex-direction:column;align-items:stretch;max-width:520px;margin:0 auto;width:100%'>" + order.map(function (o) { return "<button class='gm-btn' data-act='" + o + "'>" + esc(q.o[o]) + "</button>"; }).join("") + "</div><p class='gm-small' data-react>&nbsp;</p>",
        function (a, el) { if (el && el.disabled) return; var ok = +a === q.a; P.seenQ[q.id] = 1; if (!ok && spare) { spare = 0; ok = true; say("Your calculator saved that one."); }
          if (ok) right++; try { api.sound.sfx(ok ? "coin" : "lose"); var bs = document.querySelectorAll("[data-gm-overlay] button"); [].forEach.call(bs, function (b) { b.disabled = true; if (+b.getAttribute("data-act") === q.a) b.classList.add("gm-btn--go"); }); var rc = document.querySelector("[data-gm-overlay] [data-react]"); if (rc) rc.textContent = L.REACT[ok ? "good" : "bad"][Math.floor(Math.random() * 4)]; } catch (err) {}
          qi++; later(ask, ok ? 900 : 1500); });
    }
    function end() { L.finish(pl, e, right, qs.length, seat, done, show); }
  };
  // The fixed lesson lines (recordable) and the questions for one timetable entry.
  L.prep = function (e) { var P = Z.P, c = e.course, bank = L.LESSONS[c.s] || L.LESSONS.gen; return { lines: bank[Math.floor(hash(e.i + P.day, 5) * bank.length)], qs: S.pickQuestions(D.QUESTIONS, Math.random, 3, c.s, P.seenQ) }; };
  // Marks, attendance, streak and the "what next" card. Shared by the hall scene and the plain dialog.
  L.finish = function (pl, e, right, total, seat, done, show) {
    var P = Z.P, lf = L.ensure(P), api = Z.api, ch = Z.charOf(P.char), r = S.classReward(P, right, total), bonus = 0; show = show || function (h, on) { api.show(h, on); };
    lf.done.k[e.i] = 1; lf.att++; lf.streak++; lf.best = Math.max(lf.best, lf.streak);
    bonus += Math.min(lf.streak, 10) * 4; if (seat === 0) bonus += Math.round(r.xp * .1); if (ch && ch.perk === "brain") bonus += Math.round(r.xp * .2); var lv = r.levels + S.addXp(P, bonus);
    S.advance(P, Math.max(20, Math.min(120, e.end - P.time))); P.energy = Math.max(1, Math.min(100, P.energy - (seat === 2 ? -4 : 5))); P.hunger = Math.max(1, P.hunger - 4);
    var nx = L.next();
    show("<h2>" + right + " / " + total + "</h2><p>" + (right === total ? "Perfect. " + esc(e.staff) + " writes your name down, the good way." : r.pass ? "Solid. You followed the lecture." : "Rough one. Borrow the notes and read tonight.") + "</p><p><b>+" + (r.xp + bonus) + " XP</b> · attendance " + lf.att + " · streak " + lf.streak + (lf.streak > 1 ? " (+" + Math.min(lf.streak, 10) * 4 + " XP)" : "") + "</p>" + (nx ? "<p>Next: <b>" + esc(nx.label) + "</b> at " + esc(nx.placeName) + ", " + L.status(nx) + ".</p>" : "") +
      "<div class='gm-actions'>" + (nx ? "<button class='gm-btn gm-btn--go' data-act='guide'>Show me the way</button>" : "") + "<button class='gm-btn" + (nx ? "" : " gm-btn--go") + "' data-act='ok'>" + (Z.inside ? "Stand up" : "Leave the hall") + "</button></div>",
      function (a) { api.hide(); if (a === "guide") lf.follow = 1; if (lv > 0 && Z.levelUp) Z.levelUp(); if (Z.emit) Z.emit({ t: "class", score: right, place: pl.id }); if (Z.save) Z.save(); if (done) done(right); });
  };
  // Extra rows for a place menu: the lecture that is on here, or when the next one starts.
  L.placeItems = function (pl, items) {
    var P = Z.P; if (!P) return; var lf = L.ensure(P), list = L.today(P), t = P.time;
    for (var i = 0; i < list.length; i++) { var e = list[i]; if (e.kind !== "class" || lf.done.k[i] || lf.done.miss[i]) continue; var p = place(e); if (!p || p.id !== pl.id) continue;
      if (t >= openAt(e) && t < closeAt(e)) items.unshift({ label: "Attend lecture: " + e.label, sub: e.staff + " · " + hm(e.start) + " to " + hm(e.end) + " · three questions", act: "lecture", go: true, entry: L.view(e) });
      else if (t < openAt(e)) items.push({ label: "Lecture later: " + e.label, sub: "Doors open " + hm(openAt(e)), act: "none", off: true }); }
  };

  /* ---------- phone: timetable ---------- */
  L.menu = function (back, off) {
    var P = Z.P, lf = L.ensure(P), U = Z.ui; off = off || 0; var list = L.today(P, off), d = L.dept(lf.dept), dn = L.DAYS[L.dow(P, off)];
    var shut = function (p) { return !off && p && Z.interior && Z.interior.closed && Z.interior.closed(p) ? " · closed now, opens " + Z.interior.opensAt(p) : ""; }; var items = list.map(function (e) { var p = place(e), st = off ? "" : lf.done.k[e.i] ? "done" : lf.done.miss[e.i] ? "missed" : P.time >= e.start && P.time < e.end ? "now" : ""; return { label: hm(e.start) + "  " + e.label, sub: (p ? p.name : "") + (e.staff ? " · " + e.staff : "") + (st ? " · " + st : shut(p)), act: "e", e: e, off: st === "done" || st === "missed" }; });
    var tu = !off && Z.interior && Z.interior.tutorial ? Z.interior.tutorial() : null; if (tu) items.push({ label: "19:00  Tutorial tonight: " + tu.course.code, sub: tu.placeName + " · with " + tu.tutor + ", a senior student · optional" + (tu.done ? " · done" : ""), act: "tut", off: tu.done, tu: tu });
    items.push({ label: off ? "Back to today" : "Tomorrow", act: "day" }, { label: "Yellow line follows: " + (lf.follow ? "my timetable" : "the story"), sub: "Tap to switch", act: "follow" });
    U.menu("Timetable · " + dn, esc(d.name) + " · " + lf.acad + " level · attendance " + lf.att + " · missed " + lf.missed + " · best streak " + lf.best + "<br><small>Nothing here is forced. Miss a class and you only lose the streak.</small>", items,
      function (it) { if (it.act === "day") return L.menu(back, off ? 0 : 1); if (it.act === "follow") { lf.follow = lf.follow ? 0 : 1; return L.menu(back, off); } if (it.act === "tut") { Z.waypoint = { x: Z.places[it.tu.place].mx, y: Z.places[it.tu.place].my, name: it.tu.placeName }; lf.follow = 0; Z.api.hide(); say("Yellow line set to <b>" + esc(it.tu.placeName) + "</b> when the story is not using it."); return; } if (it.act === "e") { lf.follow = 1; Z.api.hide(); var p = place(it.e); say("Yellow line set to <b>" + esc(p ? p.name : it.e.label) + "</b>."); } }, back);
  };

  /* ---------- drawing ---------- */
  L.hud = function (x) {
    var P = Z.P; if (!P || Z.mode !== "play" || (Z.intro && Z.intro.on) || Z.race || P.job || (Z.focus && !Z.focus.allow("lecture-strip")) || (Z.api.overlayOpen && Z.api.overlayOpen()) || (Z.bigOpen && Z.bigOpen())) return; var n = L.next(); if (!n) return;
    var p = Z.places[n.place], me = Z.inside ? Z.inside.out : Z.me, d = Math.hypot(p.mx - me.x, p.my - me.y), late = !n.tomorrow && n.kind === "class" && P.time < n.start && d / ((S.FOOT && S.FOOT.walk) || 4.9) > n.start - P.time + 30;
    var txt = "NEXT  " + (n.course ? n.course.code : n.label) + " · " + n.placeName + " · " + L.status(n) + (n.tomorrow ? "" : " · " + (d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d / 5) * 5 + " m")) + (late ? " · ride or sprint" : "") + (!n.tomorrow && Z.interior && Z.interior.closed && Z.interior.closed(p) && P.time >= n.start - 30 ? " · closed" : "");
    var tun = Z.interior && Z.interior.tutorial ? Z.interior.tutorial() : null; if (tun && !tun.done && P.time >= 1080 && P.time < tun.end - 15 && (n.tomorrow || n.kind !== "class")) txt = "TONIGHT  Tutorial " + tun.course.code + " · " + tun.placeName + " · " + (P.time < tun.start ? "19:00" : "on now") + " · optional";
    x.save(); x.font = "700 12px system-ui, sans-serif"; x.textAlign = "center"; if (txt.length > 86) txt = txt.slice(0, 84) + "…"; var w = Math.min(600, x.measureText(txt).width + 24), y = 80;
    x.fillStyle = "rgba(4,12,20,.62)"; if (x.roundRect) { x.beginPath(); x.roundRect(480 - w / 2, y, w, 22, 11); x.fill(); } else x.fillRect(480 - w / 2, y, w, 22);
    x.fillStyle = late ? "#fca5a5" : !n.tomorrow && P.time >= openAt(n.e) ? "#86efac" : "#e9d5ff"; x.fillText(txt, 480, y + 15); x.restore();
  };
  L.marks = function (m) { var P = Z.P; if (!P) return; var lf = L.ensure(P), list = L.today(P); list.forEach(function (e) { if (lf.done.k[e.i] || lf.done.miss[e.i] || e.kind === "sleep") return; var p = place(e); if (p) m.push({ x: p.mx, y: p.my, col: e.kind === "class" ? "#f0abfc" : "#fde68a", r: 5 }); }); };

  /* ---------- skin tone (creator choice; saves without one keep the character's own) ---------- */
  var oChar = Z.charOf, toned = {};
  L.skinCol = function (id) { var l = D.SKINS || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].col; return ""; };
  if (oChar) Z.charOf = function (id) { var ch = oChar(id), c = Z.ui && Z.ui.inCreator, sk = c ? (c.char === id ? c.skin : "") : Z.P && Z.P.char === id ? Z.P.skin : "", col = sk && L.skinCol(sk), sh = !c && Z.P && Z.P.char === id && Z.P.mib && Z.P.mib.shirt && Z.P.mib.shirt.on ? Z.P.mib.shirt.col : ""; if ((!col && !sh) || ch.id !== id) return ch; var k = id + "|" + sk + "|" + sh; if (!toned[k]) { toned[k] = Object.create(ch); if (col) toned[k].skin = col; if (sh) toned[k].top = sh; } return toned[k]; };

  /* ---------- wiring: wrap rather than edit the core ---------- */
  var oPlace = Z.place, oTarget = Z.target, oBegin = Z.begin, oUpdate = Z.update, oDraw = Z.draw, oEmit = Z.emit;
  if (oPlace) Z.place = function (id) { return id === "@dept" ? Z.places[L.deptPlace()] : oPlace(id); };
  if (oTarget) Z.target = function () { var P = Z.P; if (!P || Z.race || P.job || (Z.date && Z.date.spot)) return oTarget(); var lf = L.ensure(P), st = Z.step && Z.step(); if (lf.follow || !st) { var t = L.target(); if (t) return t; } return oTarget(); };
  if (oBegin) Z.begin = function (p, fresh) {
    Z.P = p; L.ensure(p); if (!fresh) p.life.acad = Math.max(p.life.acad, L.acadFor(p)); cache = {}; deptIn = false;
    var dp = Z.places[L.deptPlace()]; D.MISSIONS.forEach(function (m) { m.steps.forEach(function (s) { if (s.place === "@dept" && dp) s.text = "Take your file to " + dp.name + (dp.name.indexOf(L.dept(p.life.dept).name) < 0 ? " (" + L.dept(p.life.dept).name + ")" : ""); }); });
    return oBegin.apply(Z, arguments);
  };
  if (oUpdate) Z.update = function (dt) { var r = oUpdate.apply(Z, arguments); try { for (var fk = 0; Z.peds && fk < Z.peds.length; fk++) if (Z.peds[fk].fade != null) Z.peds[fk].fade -= dt * 2.6; L.tick(dt); } catch (err) { if (!L.err) { L.err = err; if (typeof console !== "undefined") console.error(err); } } return r; };
  if (oDraw) Z.draw = function () { var r = oDraw.apply(Z, arguments); try { if (Z.api && Z.api.x) L.hud(Z.api.x); } catch (err) {} return r; };
  if (oEmit) Z.emit = function (ev) { var P = Z.P; if (P && ev && ev.t === "sleep") L.ensure(P).follow = 0; return oEmit.apply(Z, arguments); };
})();
