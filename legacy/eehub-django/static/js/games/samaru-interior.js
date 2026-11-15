/* Freshers School Life — walk-in interiors. A building's inside is a small logical room (walls, furniture boxes, spots
   you can use, people) parked far outside the map, so the normal character, controls, camera and entity code all keep
   working; only collision is swapped for the room's. The 3D dressing is built from the engine's kit when three.js is
   up; without it (the Node harness, the 2D fallback) the room still works as positions and spots. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z || !S || !D) return;
  var I = Z.interior = { cur: null, on: true }, OFF = 6000, TAU = Math.PI * 2, HP = Math.PI / 2;
  function hash(a, b) { return S.hash ? S.hash(a, b) : Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function say(h) { if (Z.toast) Z.toast(h); }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  var SKIN = ["#3b2416", "#4a2c17", "#5e3a22", "#6b4226", "#74472a", "#8a5633", "#9a6a44", "#b07d55"], TOP = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0ea5e9", "#e11d48", "#f8fafc", "#0f766e", "#fb7185", "#facc15", "#334155"];
  function lookOf(seed, o) { var h = function (n) { return hash(seed, n); }, hair = ["low", "afro", "fade", "braids", "hijab", "cap", "bun"][Math.floor(h(1) * 7)], l = { skin: SKIN[Math.floor(h(2) * SKIN.length)], hair: hair, hairCol: hair === "hijab" ? TOP[Math.floor(h(3) * TOP.length)] : hair === "cap" ? "#f8fafc" : "#16110d", top: TOP[Math.floor(h(4) * TOP.length)], pants: ["#1f2937", "#1e3a8a", "#3f3f46", "#44403c"][Math.floor(h(5) * 4)], mode: "tee" }; if (o) for (var k in o) l[k] = o[k]; return l; }

  /* ---------- which room a place gets ---------- */
  I.typeOf = function (pl) {
    if (!pl || !I.on) return ""; var id = pl.id, d = pl.def || {}, role = pl.role || d.role;
    if (/^(kt|wt|nelt|fslt|theatre)$/.test(id) || role === "lecture") return "theatre";
    if (/^dept_/.test(id) || role === "dept" || /^(compsci|physics|ee|chemeng|maths)$/.test(id)) return "lab";
    if (role === "home") return Z.P && id === Z.P.home ? "hostel" : "";
    if (id === "library") return "library"; if (id === "senate") return "senate"; if (id === "social") return "social";
    if (/^(macd|buka|shinkafi)$/.test(id)) return "canteen"; if (role === "shop" || role === "bank") return "shop"; return "";
  };

  /* ---------- opening hours ----------
     A place may set its own in data: hours: [open, close] in hours of the day (close past 24 means after midnight),
     or hours: "always". Otherwise the kind of room decides. Lecture halls and departments lock after hours, except
     where tonight's student-led tutorial is on. */
  var HOURS = { theatre: [7.5, 18.5], lab: [7.5, 18.5], senate: [8, 17], library: [7, 23], canteen: [7, 21], social: [9, 23], shop: [8, 21], mall: [8, 23], arcade: [10, 24], dance: [18, 26], mib: [9, 21] };
  function clock(h) { h = ((h % 24) + 24) % 24; var m = Math.round((h % 1) * 60); return (h < 10 ? "0" : "") + Math.floor(h) + ":" + (m < 10 ? "0" : "") + m; }
  I.hours = function (pl) { var d = pl && pl.def || {}, t = I.typeOf(pl), P = Z.P; if (d.hours === "always" || t === "hostel" || t === "sick" || (pl.role || d.role) === "bank") return null; var h = d.hours && d.hours.length === 2 ? d.hours : pl.id === "shinkafi" ? [8, 25] : HOURS[t] || null; if (h && t === "library" && P && P.flags && P.flags.pass_library) return null; if (h && t === "social" && P && P.flags && P.flags.pass_social) return [h[0], 26]; return h; };
  I.isOpen = function (pl, at) { var h = I.hours(pl); if (!h || !Z.P) return true; var t = (at == null ? Z.P.time : at) / 60; if (t >= h[0] && t < h[1]) return true; if (h[1] > 24 && t < h[1] - 24) return true; var tu = I.tutorial(); return !!(tu && tu.place === pl.id && tu.on); };
  I.opensAt = function (pl) { var h = I.hours(pl); return h ? clock(h[0]) : ""; };
  I.closed = function (pl) { return !!(pl && I.typeOf(pl) && !I.isOpen(pl)); };
  // Tonight's tutorial, if there is one: a senior student teaches 19:00 to 21:00 in a hall or in your department.
  I.tutorial = function () {
    var P = Z.P, L = Z.life; if (!P || !L) return null; var day = P.day || 1; if (hash(day, 41) > .62) return null;
    var halls = ["kt", "wt", "nelt", "@dept"], id = L.resolve(halls[Math.floor(hash(day, 43) * halls.length)]); if (!id || !Z.places[id]) return null; var lf = L.ensure(P), cs = L.courses(lf.acad, lf.dept), c = cs[Math.floor(hash(day, 47) * cs.length)], t = P.time;
    return { place: id, placeName: Z.places[id].name, course: c, tutor: ["Bola", "Kelechi", "Aisha", "Tanko", "Ngozi", "Danladi"][Math.floor(hash(day, 53) * 6)], start: 1140, end: 1260, on: t >= 1125 && t < 1250, done: P.flags.tutDay === day };
  };

  /* ---------- room specs: local x across (0 in the middle), y from the door wall (0) to the far wall (d) ---------- */
  function room(w, d, h, o) { var r = { w: w, d: d, h: h, items: [], solids: [], spots: [], people: [], crowd: [], rects: [{ x0: -w / 2, y0: 0, x1: w / 2, y1: d }], floor: 0x9a8b78, wall: 0xe7dfcf, trim: 0x7c5a3a }; if (o) for (var k in o) r[k] = o[k]; r.spots.push({ k: "exit", x: 0, y: .9, r: 1.7, label: "Go outside" }); return r; }
  function item(r, k, x, y, a, o) { var it = { k: k, x: x, y: y, a: a || 0 }; if (o) for (var q in o) it[q] = o[q]; r.items.push(it); var sz = SIZE[k]; if (sz && sz[2] > .5) { var sw = (a ? sz[1] : sz[0]) * (it.sx || 1), sd = (a ? sz[0] : sz[1]); r.solids.push({ x0: x - sw / 2, y0: y - sd / 2, x1: x + sw / 2, y1: y + sd / 2 }); } return it; }
  function spot(r, k, x, y, label, o) { var s = { k: k, x: x, y: y, r: 1.9, label: label }; if (o) for (var q in o) s[q] = o[q]; r.spots.push(s); return s; }
  function person(r, x, y, a, seed, o) { var p = { x: x, y: y, a: a, lx: x, ly: y, look: lookOf(seed, o && o.look), sit: false, wave: 0, spd: 0, h: 0, walk: 0 }; if (o) for (var q in o) if (q !== "look") p[q] = o[q]; r.people.push(p); return p; }
  var SIZE = { desk: [1.5, .7, .76], bench: [2.6, .9, .92], bed: [1, 2, .55], locker: [1, .5, 2], shelf: [2.6, .45, 2.3], counter: [4, .7, 1.05], table: [1.3, 1.3, .76], pingpong: [2.74, 1.52, .78], pool: [2.6, 1.4, .82], plant: [.5, .5, .4], sofa: [2, .8, .8], lectern: [.7, .5, 1.15], rack: [1.6, .5, 1.6], atm: [.8, .5, 1.8], cabinet: [1, .5, 1.3], rug: [3, 2, 0], chair: [.5, .5, .2], notice: [1.6, .1, 0], board: [0, 0, 0], plaque: [.8, .1, 0], window: [0, 0, 0], door: [0, 0, 0] };
  var ROOMS = {
    theatre: function (pl) {
      var big = pl.id === "nelt", w = big ? 30 : 24, d = big ? 30 : 26, r = room(w, d, 6.5, { floor: 0x6b5a48, wall: 0xdcd3c0 }), rows = big ? 7 : 6, half = w / 2 - 2.2, n = Math.floor((half - 1.3) / 1.15), row, s, k = 0;
      item(r, "board", 0, d - .25, 0, { w: big ? 13 : 10.5 }); item(r, "lectern", -4.5, d - 3.2);
      r.rowsN = rows; r.seats = [];
      for (row = 0; row < rows; row++) { var ry = d - 7.2 - row * 2.05, rh = row * .3;
        [-1, 1].forEach(function (side) { var x0 = side * 1.3, x1 = side * (1.3 + n * 1.15), xa = Math.min(x0, x1), xb = Math.max(x0, x1);
          r.items.push({ k: "tier", x: (xa + xb) / 2, y: ry + .25, w: xb - xa + .3, h: rh }); r.solids.push({ x0: xa - .1, y0: ry - .25, x1: xb + .3, y1: ry + 1.1 });
          for (s = 0; s < n; s++) { var seat = { x: side * (1.3 + .55 + s * 1.15), y: ry, h: rh, row: row, near: s }; r.seats.push(seat); if (s > 1 && hash(row * 31 + s * 7 + side, pl.mx) > .22) { seat.taken = 1; r.crowd.push({ x: seat.x, y: seat.y, h: rh + .5, a: HP, seed: k++, idle: hash(k, 3) < .12 ? "sleep" : hash(k, 4) < .5 ? "write" : "talk" }); } } });
        spot(r, "seat", 0, ry + .4, "Sit in row " + (row + 1), { row: row, r: 1.25 }); }
      for (s = 0; s < 4; s++) item(r, "window", (s < 2 ? -1 : 1) * w / 2, 6 + (s % 2) * 8, HP);
      r.staffAt = { x: 4.5, y: d - 3, a: -HP };
      r.lecturer = person(r, -2, d - 2.4, -HP, pl.mx * 3 + 1, { look: { top: "#f8fafc", pants: "#1f2937", mode: "coat", hair: "low" }, opt: { scale: 1.1 }, pace: 1 });
      spot(r, "menu", -4.5, d - 4, "Ask at the lectern", { r: 1.6 }); item(r, "notice", w / 2 - .12, 3, HP, { text: "NO FOOD · NO PHONES", sub: "The back row is not a bedroom." });
      spot(r, "note", w / 2 - 1.2, 3, "Read the notice", { id: "th_notice", text: "Under the notice somebody has pencilled: <i>“The answer to question 3 is always units.”</i>" });
      return r;
    },
    lab: function (pl) {
      var r = room(16, 14, 4, { floor: 0x8fa3a8, wall: 0xe5ecef }), i, j, dn = pl.name.replace(/^Department of /, "");
      item(r, "board", 0, 13.75, 0, { w: 6, text: dn.toUpperCase() });
      for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) { item(r, "bench", -3.8 + i * 7.6, 4 + j * 3.6, 0, { gear: (i + j * 2 + Math.floor(pl.mx)) % 4 }); r.crowd.push({ x: -4.6 + i * 7.6, y: 3.2 + j * 3.6, h: .5, a: HP, seed: i * 2 + j + pl.my, idle: "write" }); }
      item(r, "counter", 5.2, 12, 0, { sx: .6 }); item(r, "cabinet", -7.4, 11, HP); item(r, "cabinet", -7.4, 10, HP); item(r, "plant", 7.2, 1); item(r, "notice", -7.88, 5, HP, { text: "TIMETABLE", sub: dn });
      for (i = 0; i < 2; i++) item(r, "window", 8, 4 + i * 5, HP);
      person(r, 5.2, 12.9, -HP, pl.my * 5 + 2, { look: { top: "#f8fafc", mode: "coat" }, opt: { scale: 1.08 } });
      spot(r, "office", 5.2, 10.9, "Department office", {}); spot(r, "time", -6.8, 5, "Read the timetable"); spot(r, "menu", 0, 12.4, "Join a class at the board");
      var tu = I.tutorial(); if (tu && tu.on && tu.place === pl.id) { r.lecturer = person(r, -1.5, 12.9, -HP, pl.mx + (Z.P ? Z.P.day : 1), { look: { mode: "tee", hair: "low" } }); for (i = 0; i < 6; i++) r.crowd.push({ x: -2.5 + i, y: 10.6 + (i % 2) * .7, h: .9, a: HP, seed: 60 + i, stand: 1, idle: "write" }); }
      spot(r, "note", -6.6, 10.3, "Look in the cabinet", { id: "lab_" + pl.id, cash: 150, text: "Behind the multimeters: ₦150 and a note. <i>“If found, you were meant to. Buy bread.”</i>" });
      return r;
    },
    hostel: function (pl) {
      var r = room(9, 9, 3.4, { floor: 0xb08a5e, wall: 0xf1e6cf });
      item(r, "bed", -3.6, 6.2, 0, { col: 0x2563eb }); item(r, "bed", 3.6, 6.2, 0, { col: 0xdc2626 }); item(r, "locker", -3.9, 2.4, HP); item(r, "locker", 3.9, 2.4, HP); item(r, "desk", 0, 8.4); item(r, "chair", 0, 7.6); item(r, "rug", 0, 4.6); item(r, "window", 0, 9, 0); item(r, "notice", -4.42, 4.2, HP, { text: "HALL RULES", sub: "1. No cooking. 2. See rule 1." });
      spot(r, "menu", -2.7, 6.2, "Your bed"); spot(r, "outfit", -3.1, 2.4, "Open your locker"); spot(r, "note", 0, 7.3, "Sit at the desk", { id: "desk", text: "Carved into the desk: <i>“EEEN 201 finished me, 2019.”</i> Under it, newer: <i>“Not me. — M.I.B.”</i>" });
      spot(r, "token", 3.2, 2.6, "Check the top of " + ((Z.story && Z.story.roomieName && Z.story.roomieName()) || "your roommate") + "'s locker", { id: "kola_room", cash: 200, xp: 20, text: "A kola nut, wrapped in a past question paper. +₦200, +20 XP." });
      return r;
    },
    library: function (pl) {
      var r = room(24, 18, 5, { floor: 0x7a5c44, wall: 0xe9e2d2 }), i, j;
      for (i = 0; i < 4; i++) for (j = 0; j < 2; j++) item(r, "shelf", -9 + i * 3.3, 8.5 + j * 5, HP, { hue: i * 2 + j });
      for (i = 0; i < 3; i++) { item(r, "table", 4 + i * 3.4, 12, 0, { sx: 1.6 }); r.crowd.push({ x: 4 + i * 3.4 - .5, y: 11, h: .5, a: HP, seed: i + 40, idle: "write" }); if (i !== 1) r.crowd.push({ x: 4 + i * 3.4 + .5, y: 13, h: .5, a: -HP, seed: i + 50, idle: i ? "sleep" : "write" }); }
      item(r, "counter", 6, 3.4, 0); item(r, "plant", -11, 1); item(r, "plant", 11, 1); item(r, "notice", 11.88, 8, HP, { text: "SILENCE", sub: "Running is a kind of noise." });
      for (i = 0; i < 3; i++) item(r, "window", 12, 5 + i * 5, HP);
      r.staffP = person(r, 6, 4.5, -HP, 77, { look: { hair: "bun", top: "#7c3aed", mode: "tee" }, opt: { scale: 1.08 } }); r.staffAt = { x: 6, y: 4.5, a: -HP }; r.quiet = 1;
      spot(r, "menu", 6, 1.2, "Librarian's desk"); spot(r, "seat", 7.4, 13.1, "Sit and read", { free: { x: 7.9, y: 13.05, h: 0, a: -HP } });
      spot(r, "secret", -11, 16.6, "A book sticks out: “Coils and Lightning”", { id: "lib_secret" });
      r.annex = { x0: -17, y0: 14.5, x1: -11.5, y1: 17.8 }; item(r, "plaque", -16.9, 16.2, HP); item(r, "desk", -14.5, 17.2);
      spot(r, "plaque", -15.9, 16.2, "Read the brass plaque", { id: "maker" }); spot(r, "token", -14.5, 16.2, "Open the old tin", { id: "kola_lib", cash: 500, xp: 40, text: "Three kola nuts and ₦500 in an old Bournvita tin. +40 XP." });
      return r;
    },
    canteen: function (pl) {
      var r = room(18, 14, 4.2, { floor: 0xc9b8a0, wall: 0xf4e3c1 }), i, j;
      item(r, "counter", 0, 11.6, 0, { sx: 2.4, food: 1 }); item(r, "notice", 0, 13.88, 0, { text: pl.name.toUpperCase().slice(0, 18), sub: "Pay before you chop" });
      for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) { var tx = -5.6 + i * 5.6, ty = 3.6 + j * 3.6; item(r, "table", tx, ty); if ((i + j) % 2) { r.crowd.push({ x: tx - .95, y: ty, h: .5, a: 0, seed: i * 3 + j + 9, idle: "talk" }); r.crowd.push({ x: tx + .95, y: ty, h: .5, a: Math.PI, seed: i * 3 + j + 19, idle: "write" }); } else spot(r, "seat", tx, ty - 1.2, "Sit and eat", { free: { x: tx, y: ty - .95, h: 0, a: HP }, r: 1.3 }); }
      for (i = 0; i < 2; i++) item(r, "window", -9, 4 + i * 5, HP);
      r.staffP = person(r, 0, 12.6, -HP, pl.mx + 5, { look: { hair: "hijab", top: "#f97316", mode: "tee" }, opt: { scale: 1.1 } }); r.staffAt = { x: 0, y: 12.6, a: -HP };
      for (i = 0; i < 3; i++) person(r, 2.2 + i * .15, 10.4 - i * 1.1, HP, pl.my + i * 13 + 3, { queue: 1 });
      spot(r, "menu", -.6, 9.2, "Order at the counter"); spot(r, "note", 8.2, 12.6, "Read the chalkboard", { id: "chalk_" + pl.id, text: "Today's special: <b>rice</b>. Tomorrow's special: <b>also rice</b>." });
      return r;
    },
    senate: function (pl) {
      var r = room(20, 15, 6, { floor: 0xd8d2c4, wall: 0xf3ede0, trim: 0xb45309 }), i;
      item(r, "counter", 0, 10.6, 0, { sx: 1.8 }); item(r, "notice", 0, 14.88, 0, { text: "REGISTRY", sub: "Queue here. Yes, this is the queue." }); item(r, "sofa", -7.5, 3.2, HP); item(r, "sofa", 7.5, 3.2, HP); item(r, "plant", -9, 13.5); item(r, "plant", 9, 13.5); item(r, "rug", 0, 5.5, 0, { sx: 1.6 });
      for (i = 0; i < 2; i++) item(r, "cabinet", -9.4, 8 + i, HP); item(r, "door", 9.9, 9, HP, { text: "STAFF ONLY" });
      for (i = 0; i < 2; i++) item(r, "window", -10, 4 + i * 6, HP);
      for (i = 0; i < 3; i++) person(r, 1.8, 9 - i * 1.15, HP, 300 + i * 17, { queue: 1 });
      r.staffAt = { x: 0, y: 11.7, a: -HP };
      spot(r, "menu", -1, 8.3, "Registration desk"); spot(r, "staff", 9, 9, "Try the staff door", { id: "sen_staff" }); spot(r, "note", -8.6, 8.6, "Look through the files", { id: "sen_files", text: "A file with your name on it. Somebody has already ticked <i>“promising”</i>." });
      return r;
    },
    social: function (pl) {
      var r = room(22, 16, 5, { floor: 0x4a6b7c, wall: 0xe8eef2 }), i;
      item(r, "pingpong", -6, 6); item(r, "pingpong", -6, 11.5); item(r, "pool", 4, 6); item(r, "pool", 4, 11.5); item(r, "counter", 8.6, 14.2, 0, { sx: .9 }); item(r, "sofa", 9.8, 4, HP); item(r, "notice", -10.88, 8, HP, { text: "NINE-BALL LADDER", sub: "1. Razor  2. Chioma  3. You?" });
      for (i = 0; i < 2; i++) item(r, "window", 11, 5 + i * 6, HP);
      person(r, -8.2, 6, 0, 501, { play: 1 }); person(r, -3.8, 6, Math.PI, 502, { play: 1 }); person(r, 4, 4.7, HP, 503, {}); person(r, 5.9, 11.5, Math.PI, 504, {}); r.staffP = person(r, 8.6, 15.1, -HP, 505, { look: { top: "#0f766e" } }); r.staffAt = { x: 8.6, y: 15.1, a: -HP };
      spot(r, "menu", 8.6, 11.7, "Snack bar"); spot(r, "note", -6, 9, "Watch the ping-pong", { id: "pp", text: "Twenty-one to nineteen. The loser buys zobo. That is the law." }); spot(r, "note", 4, 9, "Watch the nine-ball", { id: "pool", text: "The nine drops off a three-cushion bank. Nobody claps. Everybody saw." });
      spot(r, "token", -10, 15, "Look behind the table-tennis bats", { id: "kola_social", cash: 200, xp: 20, text: "A kola nut in the bat box. +₦200, +20 XP." });
      return r;
    },
    shop: function (pl) {
      var bank = (pl.role || (pl.def || {}).role) === "bank", r = room(12, 10, 3.8, { floor: 0xb9c2c9, wall: 0xf2f4f6 }), i;
      if (bank) { for (i = 0; i < 3; i++) item(r, "atm", -3 + i * 3, 9.5); item(r, "plant", 5, 1); spot(r, "menu", 0, 8.3, "Use the ATM"); }
      else { for (i = 0; i < 2; i++) { item(r, "rack", -4.6, 3.6 + i * 3, HP, { hue: i }); item(r, "rack", 4.6, 3.6 + i * 3, HP, { hue: i + 2 }); } item(r, "counter", 0, 8.2, 0, { sx: .9 }); r.staffP = person(r, 0, 9.1, -HP, pl.mx + 9, { opt: { scale: 1.08 } }); r.staffAt = { x: 0, y: 9.1, a: -HP }; spot(r, "menu", 0, 5.7, "Buy at the counter"); }
      item(r, "window", -6, 5, HP); item(r, "notice", 0, 9.88, 0, { text: pl.name.toUpperCase().slice(0, 18), sub: bank ? "Network is up. For now." : "No credit today. Come tomorrow." });
      return r;
    }
  };
  I.build = function (pl) { var t = I.typeOf(pl); return t && ROOMS[t] ? ROOMS[t](pl) : null; };
  I.kit = { ROOMS: ROOMS, SIZE: SIZE, room: room, item: item, spot: spot, person: person, lookOf: lookOf, hash: hash, say: say, sfx: sfx, esc: esc, SKIN: SKIN, TOP: TOP };

  /* ---------- collision inside ---------- */
  function rects(c) { return c.open && c.room.annex ? c.room.rects.concat([{ x0: c.room.annex.x0, y0: c.room.annex.y0, x1: c.room.annex.x1 + 1.2, y1: c.room.annex.y1 }]) : c.room.rects; }
  function inRects(c, x, y, m) { var rs = rects(c); for (var i = 0; i < rs.length; i++) if (x >= rs[i].x0 + m && x <= rs[i].x1 - m && y >= rs[i].y0 + m && y <= rs[i].y1 - m) return true; return false; }
  function pushIn(c, wx, wy, r) {
    var x = wx - c.ox, y = wy - c.oy, hit = false, rs = rects(c), i, best = null, bd = 1e9;
    if (!inRects(c, x, y, r)) { for (i = 0; i < rs.length; i++) { var q = rs[i], cx = Math.max(q.x0 + r, Math.min(q.x1 - r, x)), cy = Math.max(q.y0 + r, Math.min(q.y1 - r, y)), dd = (cx - x) * (cx - x) + (cy - y) * (cy - y); if (dd < bd) { bd = dd; best = [cx, cy]; } } x = best[0]; y = best[1]; hit = true; }
    for (var pass = 0; pass < 2; pass++) for (i = 0; i < c.room.solids.length; i++) { var s = c.room.solids[i]; if (x > s.x0 - r && x < s.x1 + r && y > s.y0 - r && y < s.y1 + r) { var cand = [[x - (s.x0 - r), s.x0 - r, y], [(s.x1 + r) - x, s.x1 + r, y], [y - (s.y0 - r), x, s.y0 - r], [(s.y1 + r) - y, x, s.y1 + r]].sort(function (p1, p2) { return p1[0] - p2[0]; }), pick = null; for (var ci = 0; ci < 4 && !pick; ci++) if (inRects(c, cand[ci][1], cand[ci][2], r - .02)) pick = cand[ci]; pick = pick || cand[0]; x = pick[1]; y = pick[2]; hit = true; } } // never shoved out through a wall: a cabinet against the wall pushes you into the room
    // still wedged (a gap narrower than you between two things): take the nearest clear spot instead
    if (!clear(c, x, y, r)) { var done = false; for (var rad = .3; rad < 6 && !done; rad += .3) for (var an = 0; an < 12 && !done; an++) { var tx = x + Math.cos(an * .5236) * rad, ty = y + Math.sin(an * .5236) * rad; if (clear(c, tx, ty, r)) { x = tx; y = ty; done = true; } } if (!done) { x = 0; y = 2.4; } hit = true; }
    return { x: x + c.ox, y: y + c.oy, hit: hit };
  }
  function clear(c, x, y, r) { if (!inRects(c, x, y, r - .02)) return false; for (var i = 0; i < c.room.solids.length; i++) { var s = c.room.solids[i]; if (x > s.x0 - r + .02 && x < s.x1 + r - .02 && y > s.y0 - r + .02 && y < s.y1 + r - .02) return false; } return true; }
  var oPush = S.push, oIn = S.insideBuilding, oRoute = S.route;
  S.push = function (W, x, y, r) { var c = I.cur; return c && y > OFF / 2 ? pushIn(c, x, y, r || .4) : oPush.apply(S, arguments); };
  S.insideBuilding = function (W, x, y) { var c = I.cur; if (c && y > OFF / 2) return inRects(c, x - c.ox, y - c.oy, .25) ? null : c.wallB; return oIn.apply(S, arguments); };
  var oGround = S.groundY; if (oGround) S.groundY = function (W, x, y) { return I.cur && y > OFF / 2 ? 0 : oGround.apply(S, arguments); }; // rooms are flat, whatever the land does out there
  var oWild = S.wildD; if (oWild) S.wildD = function (W, x, y) { return y > OFF / 2 ? 0 : oWild.apply(S, arguments); }; // a room is not the wilderness: the patrol leaves you alone indoors
  if (oRoute) S.route = function (W, x1, y1) { var c = I.cur; return c && y1 > OFF / 2 ? null : oRoute.apply(S, arguments); };

  /* ---------- going in and out ---------- */
  I.enter = function (pl) {
    var me0 = Z.me; if (I.cur || I.trans || !Z.P || me0.veh || me0.fall || me0.alt > .05) return false; if (!I.typeOf(pl)) return false;
    if ((Z.foes || []).some(function (f) { return f.def && f.def.boss && Math.hypot(f.x - me0.x, f.y - me0.y) < 30; })) { say("Not in the middle of this fight."); return true; } // ordinary trouble you may hide from; a boss fight you finish
    if (!I.isOpen(pl)) { say("<b>Locked.</b> " + esc(pl.name) + " opens " + I.opensAt(pl) + "." + (function () { var tu = I.tutorial(); return tu && !tu.done && Z.P.time < tu.end ? " Tonight's tutorial (" + esc(tu.course.code) + ") is at " + esc(tu.placeName) + ", 19:00." : ""; })()); sfx("block"); return true; }
    var room = I.build(pl); if (!room) return false;
    I.trans = { t: 0, dir: 1, pl: pl, room: room }; try { Z.api.flash("#000", .5); } catch (e) {} sfx("click"); if (I.door3) I.door3(pl, 1); return true;
  };
  function goIn(pl, room) {
    var me = Z.me, P = Z.P, c = I.cur = Z.inside = { pl: pl, type: I.typeOf(pl), room: room, ox: Math.round(pl.mx), oy: Math.round(pl.my) + OFF, out: { x: me.x, y: me.y, a: me.a }, people: [], wallB: { h3: room.h, i: -1 }, open: !!(P.flags && P.flags.in_lib_secret), moved: [], t: 0, shh: 0 };
    room.people.forEach(function (p) { p.x += c.ox; p.y += c.oy; p.lx = p.x; p.ly = p.y; c.people.push(p); });
    // the people who belong to this place come inside with you (the porter at his desk, your roommate in the room) and friends walking with you follow
    var k = 0; Z.npcs.forEach(function (n) { var at = n.def && n.def.at, home = at && Z.place(at) === pl && !n.hidden, tag = n.follow || n.lead; if (home && I.typeOf(pl) === "hostel" && pl.id === (Z.P && Z.P.home) && Z.story && Z.story.roomie) home = n.id === Z.story.roomie(); /* your room: only your roommate lives here */ if (!home && !(tag && Math.hypot(n.x - me.x, n.y - me.y) < 25)) return; c.moved.push({ n: n, x: n.x, y: n.y, hx: n.hx, hy: n.hy, a: n.a });
      var sp = home && room.staffAt && !c.staffed ? room.staffAt : home ? { x: (k % 2 ? -1 : 1) * (room.w / 2 - 1.6), y: Math.min(room.d - 2, 4 + k * 1.4), a: k % 2 ? 0 : Math.PI } : { x: (k % 2 ? 1 : -1) * (1.2 + k * .4), y: 2.2 + k * .5, a: HP }; if (home && room.staffAt && !c.staffed) { c.staffed = 1; if (room.staffP) room.staffP.gone = 1; } if (home && c.type === "hostel") sp = { x: 1.9, y: 5.4, a: Math.PI }; k++; n.x = n.hx = c.ox + sp.x; n.y = n.hy = c.oy + sp.y; n.a = sp.a; });
    Z.peds.length = 0; var ea = room.enterAt ? room.enterAt(pl) : null; me.x = c.ox + (ea ? ea.x : 0); me.y = c.oy + (ea ? ea.y : c.type === "theatre" ? 3.6 : 2.4); me.a = ea ? ea.a : HP; if (room.onEnter) try { room.onEnter(c); } catch (e) {} me.sit = false; me.emote = ""; me.z = 0; me.vz = 0; if (Z.r3) { Z.r3.yaw = me.a; Z.r3.pitch = .34; Z.r3.tx = me.x; Z.r3.ty = me.y; }
    if (I.build3) try { I.build3(c); } catch (e) { I.err = e; if (typeof console !== "undefined") console.error(e); }
    if (Z.emit) { Z.emit({ t: "door", open: true, place: pl.id }); Z.emit({ t: "enter", place: pl.id }); } if (c.type === "theatre") arrive(c);
  }
  I.exit = function () { if (!I.cur || I.trans) return false; I.trans = { t: 0, dir: -1 }; try { Z.api.flash("#000", .5); } catch (e) {} sfx("click"); return true; };
  // Put everything back. restore=false when something else (shuttle, phone call, mission, cheat) already moved you.
  function cleanup(c, restore) {
    var me = Z.me; if (I.drop3) I.drop3(c); if (I.lec && I.lec.open) try { Z.api.hide(); } catch (e) {} I.lec = null;
    c.moved.forEach(function (m) { var keep = m.n.follow || m.n.lead; m.n.x = keep ? c.out.x + 1.2 : m.x; m.n.y = keep ? c.out.y + 1.2 : m.y; m.n.hx = m.hx; m.n.hy = m.hy; m.n.a = m.a; m.n.sitIn = null; });
    me.sit = false; me.z = 0; me.vz = 0; if (me.emote === "sit") me.emote = ""; I.cur = Z.inside = null;
    if (restore) { me.x = c.out.x; me.y = c.out.y; me.a = c.out.a + Math.PI; if (Z.r3) { Z.r3.yaw = me.a; Z.r3.tx = me.x; Z.r3.ty = me.y; } }
    if (I.door3) I.door3(c.pl, 0); if (Z.emit) { Z.emit({ t: "door", open: false, place: c.pl.id }); Z.emit({ t: "leave", place: c.pl.id }); }
  }
  function goOut() { if (I.cur) cleanup(I.cur, true); }
  I.leaveNow = function () { if (I.cur) goOut(); I.trans = null; };
  // Step from one room straight into another (mall to arcade and back). The way out still leads to where you came in from.
  I.hop = function (pl, back) { var c = I.cur; if (!c || !pl) return false; var room = I.build(pl); if (!room) return false; var out = c.out, prev = c.pl; cleanup(c, false); Z.me.x = out.x; Z.me.y = out.y; Z.me.a = out.a; goIn(pl, room); I.cur.out = out; if (back) I.cur.back = prev; try { Z.api.flash("#000", .35); } catch (e) {} return true; };
  I.goIn = function (pl) { var room = I.build(pl); if (!room || I.cur) return false; goIn(pl, room); return true; };

  /* ---------- using things inside ---------- */
  I.spot = function () { var c = I.cur; if (!c) return null; var me = Z.me, best = null, bd = 1e9; c.room.spots.forEach(function (s) { if (s.gone || (s.k === "plaque" || (s.k === "token" && s.id === "kola_lib")) && !c.open) return; if (s.k === "token" && Z.P.flags["in_" + s.id]) return; var d = Math.hypot(c.ox + s.x - me.x, c.oy + s.y - me.y); if (d < s.r && d < bd) { bd = d; best = s; } }); return best; };
  I.prompt = function () { var c = I.cur; if (!c) return ""; if (!I.lec && c.type === "lab" && tutorHere(c)) { var ts = I.spot(); if (ts && ts.k === "menu" && /board/.test(ts.label)) return "Join the tutorial"; } if (I.lec) return I.lec.phase === "ask" && !I.lec.open ? "Raise your hand" : I.lec.phase === "over" ? "" : "Listening…"; if (Z.me.sit && c.seat) return "Stand up"; var s = I.spot(); return s ? s.label : ""; };
  I.act = function () {
    var c = I.cur, me = Z.me, P = Z.P; if (I.trans) return true; if (!c) return false;
    if (I.lec) { if (I.lec.phase === "ask" && !I.lec.open) raise(); return true; }
    if (me.sit && c.seat) { stand(c); return true; }
    var s = I.spot(), sd = s ? Math.hypot(c.ox + s.x - me.x, c.oy + s.y - me.y) : 1e9;
    for (var i = 0; i < Z.npcs.length; i++) { var nd = Math.hypot(Z.npcs[i].x - me.x, Z.npcs[i].y - me.y); if (nd < 3 && nd < sd && !Z.npcs[i].hidden) return false; } // talking comes first, unless you stand on a marked spot
    if (!s) return true;
    if (s.use) s.use(c, s);
    else if (s.k === "exit") { if (c.back) I.hop(c.back); else I.exit(); }
    else if (s.k === "menu" && c.type === "lab" && tutorHere(c) && /board/.test(s.label)) tutorialStart(c, true);
    else if (s.k === "menu") Z.ui.place(c.pl);
    else if (s.k === "time") { if (Z.life) Z.life.menu(function () { Z.api.hide(); }); }
    else if (s.k === "outfit") { P.outfit = ((P.outfit || 0) + 1) % D.OUTFITS.length; say("You change into <b>" + esc(D.OUTFITS[P.outfit].name) + "</b>."); sfx("click"); }
    else if (s.k === "office") { say("<b>Department office.</b> The secretary stamps your file without looking up. “Lectures are on the board. Do not be late.”"); if (Z.emit) Z.emit({ t: "go", place: "@dept" }); }
    else if (s.k === "note" || s.k === "token") { var key = "in_" + s.id, first = !P.flags[key]; if (first && (s.cash || s.xp)) { P.flags[key] = 1; P.money += s.cash || 0; if (s.xp) { var lv = S.addXp(P, s.xp); if (lv > 0 && Z.levelUp) Z.levelUp(); } sfx("coin"); } else if (first && s.k === "note") P.flags[key] = 1; say(first || s.k === "note" ? s.text : "Nothing else here."); }
    else if (s.k === "secret") { if (!c.open) { c.open = true; P.flags.in_lib_secret = 1; sfx("power"); say("The shelf swings in. <b>A reading room nobody talks about.</b>"); if (I.open3) I.open3(c); } else say("The shelf is already open."); }
    else if (s.k === "plaque") { if (Z.egg) Z.egg("maker_room", "<i>“This room, this school and every road in it were built by " + esc(D.CREATOR.full) + ". Sit. Read. Then go and build your own.”</i>"); }
    else if (s.k === "staff") { if (P.flags.restored) { if (!P.flags.in_sen_staff) { P.flags.in_sen_staff = 1; P.money += 1000; sfx("coin"); say("The staff door is open now. On the desk: the grid logbook, signed off, and an envelope. <b>“For the fresher who turned the light back on.”</b> +₦1,000."); } else say("An empty office and a humming fridge."); } else say("<b>Staff only.</b> Locked. Behind it something hums, the way the transformers hum before the light goes." + (P.m && P.m.done && P.m.done.m3 ? " You have heard that hum before." : "")); }
    else if (s.k === "seat") sit(c, s);
    return true;
  };
  function sit(c, s) {
    var me = Z.me, seat = s.free; if (!seat) { var best = null; c.room.seats.forEach(function (q) { if (q.row === s.row && !q.taken && (!best || q.near < best.near || (q.near === best.near && Math.abs(q.x - (me.x - c.ox)) < Math.abs(best.x - (me.x - c.ox))))) best = q; }); if (!best) { say("This row is full."); return; } seat = { x: best.x, y: best.y, h: best.h, a: HP, ref: best }; }
    c.seat = seat; c.stand = { x: me.x, y: me.y }; me.x = c.ox + seat.x; me.y = c.oy + seat.y; me.a = seat.a; me.sit = true; me.emote = "sit"; me.emoteT = 1e9; me.cs = 0; sfx("click");
    // friends walking with you take the seats beside you
    var k = 1; c.moved.forEach(function (m) { if (!(m.n.follow || m.n.lead) || !seat.ref) return; var nb = null; c.room.seats.forEach(function (q) { if (q.row === seat.ref.row && !q.taken && q !== seat.ref && Math.abs(q.x - seat.ref.x) < 1.2 * k + .1 && Math.abs(q.x - seat.ref.x) > .5 && !q.pal) nb = nb || q; }); if (nb) { nb.pal = 1; m.n.x = m.n.hx = c.ox + nb.x; m.n.y = m.n.hy = c.oy + nb.y; m.n.a = HP; m.n.sitIn = nb.h; k++; } });
    if (c.type === "theatre") startLecture(c); else if (c.type === "library") say("You sit. The quiet is thick. Use the librarian's desk for a study session."); else if (c.type === "canteen") say("You sit. Order at the counter first if you have not.");
  }
  function stand(c) { var me = Z.me; me.sit = false; me.emote = ""; me.z = 0; if (c.stand) { me.x = c.stand.x; me.y = c.stand.y; } c.seat = null; c.room.seats && c.room.seats.forEach(function (q) { q.pal = 0; }); c.moved.forEach(function (m) { m.n.sitIn = null; }); }

  /* ---------- lectures in the hall ---------- */
  function tutorHere(c) { var tu = I.tutorial(); return tu && tu.on && !tu.done && tu.place === c.pl.id ? tu : null; }
  function tutorialStart(c, standing) {
    var tu = tutorHere(c), L = Z.life, P = Z.P; if (!tu || I.lec) return false; var bank = L.LESSONS[tu.course.s] || L.LESSONS.gen, e = { course: tu.course, staff: tu.tutor + " (400 level)", start: tu.start, end: tu.end, i: 90, tutorial: 1 };
    I.lec = { c: c, n: { e: e }, e: e, lines: bank[Math.floor(hash(P.day, 59) * bank.length)].slice(0, 2), qs: S.pickQuestions(D.QUESTIONS, Math.random, 2, tu.course.s, P.seenQ), phase: "settle", t: 0, li: 0, qi: 0, right: 0, seat: 1, shown: 0, said: -1, mark: "", dirty: 1, tut: 1, stand: standing ? { x: Z.me.x, y: Z.me.y } : null };
    say("<b>Tutorial: " + esc(tu.course.code) + "</b> with " + esc(tu.tutor) + ", a senior student. Short one: two questions."); return true;
  }
  function tutorialEnd(lc) {
    var P = Z.P, c = lc.c, xp = 12 + lc.right * 10; P.flags.tutDay = P.day; P.stats.tutorials = (P.stats.tutorials || 0) + 1; var lv = S.addXp(P, xp); if (lc.right === lc.qs.length) P.skills.brain = (P.skills.brain || 0) + 1; S.advance(P, 30);
    Z.api.show("<h2>" + lc.right + " / " + lc.qs.length + "</h2><p>" + (lc.right === lc.qs.length ? "“You see? You know it.” " : "“We go again next time.” ") + esc(lc.e.staff.split(" ")[0]) + " cleans the board.</p><p><b>+" + xp + " XP</b> · tutorials attended " + P.stats.tutorials + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Thanks</button></div>", function () { Z.api.hide(); I.lec = null; if (Z.me.sit && c.seat) stand(c); if (lv > 0 && Z.levelUp) Z.levelUp(); if (Z.emit) Z.emit({ t: "tutorial", place: c.pl.id, score: lc.right }); if (Z.save) Z.save(); });
  }
  function arrive(c) { var tu0 = tutorHere(c); if (tu0) { c.room.crowd.length = Math.min(c.room.crowd.length, 14); if (c.room.lecturer) { c.room.lecturer.look = lookOf(c.pl.mx + Z.P.day, { mode: "tee", hair: "low" }); c.room.lecturer.opt = null; } say("<b>Evening tutorial.</b> " + esc(tu0.tutor) + " is taking " + esc(tu0.course.code) + ". Sit anywhere."); return; } var n = Z.life && Z.life.attending(c.pl.id); if (n) say("<b>" + esc(n.label) + "</b> is about to start. Pick a row and sit down."); else if (Z.life) { var nx = Z.life.next(); c.room.crowd.length = Math.min(c.room.crowd.length, 8); if (c.room.lecturer) c.room.lecturer.gone = 1; say("No lecture here right now." + (nx ? " Next for you: <b>" + esc(nx.label) + "</b> at " + esc(nx.placeName) + "." : "")); } }
  function startLecture(c) {
    if (tutorialStart(c)) return;
    var L = Z.life, n = L && L.attending(c.pl.id); if (!n) { say("You take a seat. The hall is between lectures."); return; }
    var pr = L.prep(n.e), row = c.seat.ref ? c.seat.ref.row : 3;
    I.lec = { c: c, n: n, e: n.e, lines: pr.lines, qs: pr.qs, phase: "settle", t: 0, li: 0, qi: 0, right: 0, seat: row < 2 ? 0 : row < 4 ? 1 : 2, shown: 0, said: -1, mark: "", dirty: 1 };
    say("<b>" + esc(n.e.course.code) + "</b> with " + esc(n.e.staff) + ". Eyes on the board.");
  }
  function raise() {
    var lc = I.lec, q = lc.qs[lc.qi], me = Z.me, order = [0, 1, 2, 3]; lc.open = true; me.emote = "wave"; lc.order = order;
    Z.api.show("<p class='gm-small'>" + esc(lc.e.staff) + " points at you. Question " + (lc.qi + 1) + " of " + lc.qs.length + "</p><h2 style='font-size:clamp(16px,3vw,22px)'>" + esc(q.q) + "</h2><div class='gm-actions' style='flex-direction:column;align-items:stretch;max-width:520px;margin:0 auto;width:100%'>" + order.map(function (o) { return "<button class='gm-btn' data-act='" + o + "'><b>" + "ABCD"[o] + "</b> &nbsp;" + esc(q.o[o]) + "</button>"; }).join("") + "</div>",
      function (a) { var ok = +a === q.a, P = Z.P; P.seenQ[q.id] = 1; if (!ok && P.inv && P.inv.calculator && !lc.spare) { lc.spare = 1; ok = true; say("Your calculator saved that one."); } if (!ok && I.mall && I.mall.rescue(lc.e.course.s)) ok = true; if (ok) lc.right++; sfx(ok ? "coin" : "lose"); Z.api.hide(); me.emote = "sit"; lc.open = false; lc.mark = ok ? "ok" : "no"; lc.phase = "marked"; lc.t = 0; lc.dirty = 1; say(Z.life.REACT[ok ? "good" : "bad"][Math.floor(Math.random() * 4)]); });
  }
  function lecture(dt) {
    var lc = I.lec, c = lc.c, L = Z.life; lc.t += dt * (I.fast || 1);
    if (lc.phase === "settle") { if (lc.t > 1.6) { lc.phase = "teach"; lc.t = 0; lc.dirty = 1; } }
    else if (lc.phase === "ask" && !lc.open) { if (lc.t > 9) { lc.mark = "no"; lc.phase = "marked"; lc.t = 0; lc.dirty = 1; say(esc(lc.e.staff) + " picks somebody else. Raise your hand faster next time."); } }
    else if (lc.phase === "teach") {
      var line = lc.lines[lc.li], want = Math.min(line.length, Math.floor(lc.t * 30)); if (lc.said !== lc.li) { lc.said = lc.li; try { Z.api.sound.say(line, { voice: "male", pitch: .9 }); } catch (e) {} }
      if (want !== lc.shown) { lc.shown = want; lc.dirty = 1; } if (lc.t > line.length / 30 + 1.7) { lc.li++; lc.t = 0; lc.shown = 0; lc.dirty = 1; if (lc.li >= lc.lines.length) { lc.phase = "ask"; lc.li = lc.lines.length; lc.t = 0; } }
    } else if (lc.phase === "marked") { if (lc.t > 1.5) { lc.qi++; lc.mark = ""; lc.t = 0; lc.dirty = 1; if (lc.qi >= lc.qs.length) finish(); else lc.phase = "ask"; } }
    if (c.room.lecturer) { var lr = c.room.lecturer, tx = c.ox + (lc.phase === "teach" ? -2.5 + (lc.shown / 40) * 3 : Math.sin(c.t * .5) * 3.5), ty = c.oy + c.room.d - (lc.phase === "teach" ? 1.3 : 2.6), dx = tx - lr.x, dy = ty - lr.y, d = Math.hypot(dx, dy), st = Math.min(d, 1.3 * dt); if (d > .05) { lr.x += dx / d * st; lr.y += dy / d * st; lr.a = Math.atan2(dy, dx); lr.spd = st / dt; } else { lr.spd = 0; lr.a = lc.phase === "teach" ? HP : -HP; } }
    void L;
  }
  function finish() {
    var lc = I.lec, c = lc.c; lc.phase = "over"; lc.dirty = 1; if (lc.tut) return tutorialEnd(lc);
    Z.life.finish(c.pl, lc.e, lc.right, lc.qs.length, lc.seat, function () { I.lec = null; c.empty = 1; c.emptyT = 0; if (Z.me.sit) stand(c); });
  }

  /* ---------- per-frame ---------- */
  I.update = function (dt) {
    var tr = I.trans, c, me = Z.me; if (tr) { tr.t += dt; if (tr.t > .22 && !tr.done) { tr.done = 1; if (tr.dir > 0) goIn(tr.pl, tr.room); else goOut(); } if (tr.t > .45) I.trans = null; }
    try { I.strays(dt); } catch (e) {}
    c = I.cur;
    if (!c) { if (Z.P && Z.mode === "play" && me.y > OFF / 2 && !I.trans) { var hm = Z.place("@home") || Z.places.gate; me.x = hm.mx; me.y = hm.my + 4; me.sit = false; me.z = 0; } return; } // never leave anybody stranded in interior space
    if (me.y < OFF / 2 || me.veh) { cleanup(c, !!me.veh && me.y > OFF / 2); return; } // something else moved you out: tidy up, keep where you were put
    c.t += dt; var lx = me.x - c.ox, ly = me.y - c.oy, held = Z.api.down && (Z.api.down("up") || Z.api.down("down") || Z.api.down("left") || Z.api.down("right")) || (Z.stick && Z.stick.on);
    if (!inRects(c, lx, ly, .2)) { me.x = c.ox; me.y = c.oy + 2.4; }
    if (!c.fs) c.fs = { x: me.x, y: me.y, t: 0 }; if (Math.hypot(me.x - c.fs.x, me.y - c.fs.y) > .4 || !held || I.lec || (Z.api.overlayOpen && Z.api.overlayOpen())) { c.fs.x = me.x; c.fs.y = me.y; c.fs.t = 0; } else if ((c.fs.t += dt) > 3) { c.fs.t = 0; me.sit = false; me.emote = ""; me.z = 0; c.seat = null; me.x = c.ox; me.y = c.oy + 2.4; say("You find your way back to the door."); }
    if (me.sit && c.seat) { me.z = c.seat.h + I.SEAT; me.vz = 0; me.x = c.ox + c.seat.x; me.y = c.oy + c.seat.y; } else if (c.seat && !I.lec) { c.seat = null; me.z = 0; }
    c.lift = c.room.lift ? c.room.lift(me.x - c.ox, me.y - c.oy) : 0; if (c.room.step) c.room.step(c, dt);
    if (I.lec && I.lec.stand) { if (Math.hypot(me.x - I.lec.stand.x, me.y - I.lec.stand.y) > 4 && !I.lec.open) { I.lec = null; say("You drift away from the tutorial."); } else lecture(dt); }
    else if (I.lec) { if (!me.sit && !I.lec.open) { I.lec = null; c.seat = null; me.z = 0; say("You slip out before the end. No attendance this time: sit down again to rejoin."); } else lecture(dt); }
    c.moved.forEach(function (m) { if (m.n.sitIn != null) { m.n.sit = true; m.n.z = m.n.sitIn; } });
    c.people.forEach(function (p, i) { if (p.gone) { p.x = c.ox; p.y = c.oy - 40; return; } if (p.path) { var wp = p.path[p.pi || 0], tx = c.ox + wp[0], ty = c.oy + wp[1], pdx = tx - p.x, pdy = ty - p.y, pd = Math.hypot(pdx, pdy), ps = Math.min(pd, (p.sp || 1.2) * dt); if (pd < .3) { p.pi = ((p.pi || 0) + 1) % p.path.length; } else { p.x += pdx / pd * ps; p.y += pdy / pd * ps; p.a = Math.atan2(pdy, pdx); p.spd = p.sp || 1.2; } if (c.room.lift) p.h = c.room.lift(p.x - c.ox, p.y - c.oy); } if (p.play) { p.wave = Math.sin(c.t * 5 + i * 3) > .2 ? 1 : 0; p.a += Math.sin(c.t * 3 + i) * dt * .6; } if (p.queue) p.a = HP + Math.sin(c.t * .7 + i * 2) * .25; });
    if (c.room.quiet) { c.shh = Math.max(0, c.shh - dt); if (c.shh <= 0 && ((me.cs || 0) > 6.2 || me.punch > 0)) { c.shh = 6; sfx("block"); say("<b>“Shhh!”</b> The librarian looks at you over her glasses. Walk."); } }
    if (c.empty) { c.emptyT += dt; if (c.room.lecturer) c.room.lecturer.gone = c.emptyT > 3 ? 1 : 0; }
    if (I.step3) try { I.step3(c, dt); } catch (e) { if (!I.err) { I.err = e; if (typeof console !== "undefined") console.error(e); } }
  };
  I.SEAT = .3;
  // Nobody may be left in interior space by accident: people who wander or are placed into the room you are in are
  // adopted (so they leave with you and stay inside its walls), and anyone found there with no room open goes home.
  var strayT = 0;
  function homeOf(n) { if (n.hx != null && n.hy < OFF / 2) return { x: n.hx, y: n.hy }; var pl = n.def && n.def.at && Z.place(n.def.at); return pl ? { x: pl.mx + 2, y: pl.my + 2 } : { x: Z.me.x + 2, y: Z.me.y + 2 }; }
  I.strays = function (dt) {
    strayT -= dt; if (strayT > 0) return; strayT = .25; var c = I.cur, list = (Z.npcs || []).concat(Z.peds || []);
    list.forEach(function (n) { if (!n || !(n.y > OFF / 2)) return; var ped = (Z.peds || []).indexOf(n) >= 0;
      if (!c || c.trans) { if (ped) { n.gone = 1; n.x = n.y = 0; } else { var h = homeOf(n); n.x = h.x; n.y = h.y; if (n.hy > OFF / 2) { n.hx = h.x; n.hy = h.y; } n.sitIn = null; } return; }
      if (!ped && c.moved.every(function (m) { return m.n !== n; })) { var hh = homeOf(n); c.moved.push({ n: n, x: hh.x, y: hh.y, hx: hh.x, hy: hh.y, a: n.a || 0 }); }
      var lx = n.x - c.ox, ly = n.y - c.oy; if (!inRects(c, lx, ly, .3)) { var f = pushIn(c, n.x, n.y, .4); n.x = f.x; n.y = f.y; if (n.hy > OFF / 2) { n.hx = f.x; n.hy = f.y; } } });
    if (Z.peds) for (var i = Z.peds.length - 1; i >= 0; i--) if (Z.peds[i].gone && Z.peds[i].x === 0 && Z.peds[i].y === 0) Z.peds.splice(i, 1);
  };

  /* ---------- wiring ---------- */
  var oUpdate = Z.update, oBegin = Z.begin, oSave = Z.save, oTarget = Z.target, oPrompt = Z.prompt, oDraw = Z.draw;
  if (oUpdate) Z.update = function (dt) { var r = oUpdate.apply(Z, arguments); try { I.update(dt); } catch (e) { if (!I.err) { I.err = e; if (typeof console !== "undefined") console.error(e); } } return r; };
  if (oBegin) Z.begin = function () { if (I.cur && I.drop3) I.drop3(I.cur); I.cur = Z.inside = null; I.trans = null; I.lec = null; return oBegin.apply(Z, arguments); };
  if (oSave) Z.save = function () { var c = I.cur, me = Z.me; if (!c) return oSave.apply(Z, arguments); var x = me.x, y = me.y, a = me.a; me.x = c.out.x; me.y = c.out.y; me.a = c.out.a; try { return oSave.apply(Z, arguments); } finally { me.x = x; me.y = y; me.a = a; } };
  if (oTarget) Z.target = function () { var c = I.cur; if (!c) return oTarget.apply(Z, arguments); return null; };
  if (oPrompt) Z.prompt = function () { if (I.cur) { var me = Z.me; for (var i = 0; i < Z.npcs.length; i++) if (Math.hypot(Z.npcs[i].x - me.x, Z.npcs[i].y - me.y) < 3 && !Z.npcs[i].hidden) return oPrompt.apply(Z, arguments); return I.prompt(); } var p = oPrompt.apply(Z, arguments); if (!Z.me.veh) { var pl = Z.near(7); if (pl && I.typeOf(pl) && (!p || p === pl.name || p.indexOf(pl.name) === 0)) return I.isOpen(pl) ? "Enter " + pl.name : "Locked · opens " + I.opensAt(pl); } return p; };
  // without the 3D view, a plain top-down room so the game is still playable
  if (oDraw) Z.draw = function () { var r = oDraw.apply(Z, arguments), c = I.cur; if (!c || !Z.api || !Z.api.x || Z.mode !== "play") return r;
    if (Z.r3 && Z.r3.ready) { try { if ((Z.api.overlayOpen && Z.api.overlayOpen()) || (Z.bigOpen && Z.bigOpen()) || (Z.intro && Z.intro.on)) return r; var mx = Z.api.x, R = 78, cx = 868, cy = 96, rs = rects(c), bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; rs.forEach(function (q) { bx0 = Math.min(bx0, q.x0); by0 = Math.min(by0, q.y0); bx1 = Math.max(bx1, q.x1); by1 = Math.max(by1, q.y1); }); var kk = Math.min(118 / (bx1 - bx0), 118 / (by1 - by0)), qx = function (v) { return cx - (v - (bx0 + bx1) / 2) * kk; }, qy = function (v) { return cy + ((by0 + by1) / 2 - v) * kk; };
      mx.save(); mx.beginPath(); mx.arc(cx, cy, R, 0, TAU); mx.fillStyle = "#1e293b"; mx.fill(); mx.lineWidth = 4; mx.strokeStyle = "#f8fafc"; mx.stroke(); mx.clip(); mx.fillStyle = "#e7dfcf"; rs.forEach(function (q) { mx.fillRect(qx(q.x1), qy(q.y1), (q.x1 - q.x0) * kk, (q.y1 - q.y0) * kk); }); mx.fillStyle = "#8b7355"; c.room.solids.forEach(function (s) { mx.fillRect(qx(s.x1), qy(s.y1), (s.x1 - s.x0) * kk, (s.y1 - s.y0) * kk); });
      mx.fillStyle = "#16a34a"; mx.fillRect(qx(1.1), qy(0) - 2, 2.2 * kk, 5); mx.fillStyle = "#2563eb"; c.people.concat(c.moved.map(function (m) { return m.n; })).forEach(function (p) { if (p.gone) return; mx.beginPath(); mx.arc(qx(p.x - c.ox), qy(p.y - c.oy), 2.5, 0, TAU); mx.fill(); }); mx.fillStyle = "#f97316"; mx.strokeStyle = "#fff"; mx.lineWidth = 2; mx.beginPath(); mx.arc(qx(Z.me.x - c.ox), qy(Z.me.y - c.oy), 5, 0, TAU); mx.fill(); mx.stroke(); mx.restore();
      mx.save(); mx.font = "800 11px system-ui, sans-serif"; mx.textAlign = "center"; mx.fillStyle = "#fff"; mx.strokeStyle = "rgba(0,0,0,.7)"; mx.lineWidth = 3; var nm = c.pl.name.length > 26 ? c.pl.name.slice(0, 25) + "…" : c.pl.name; mx.strokeText(nm, cx, cy + R + 16); mx.fillText(nm, cx, cy + R + 16); mx.restore(); } catch (e) {} return r; } try { var x = Z.api.x, k = Math.min(760 / c.room.w, 400 / c.room.d), px = function (v) { return 480 + v * k; }, py = function (v) { return 500 - v * k; }; x.save(); x.fillStyle = "#0b1220"; x.fillRect(0, 110, 960, 430); x.fillStyle = "#c9b8a0"; rects(c).forEach(function (q) { x.fillRect(px(q.x0), py(q.y1), (q.x1 - q.x0) * k, (q.y1 - q.y0) * k); }); x.fillStyle = "#6b4f3a"; c.room.solids.forEach(function (s) { x.fillRect(px(s.x0), py(s.y1), (s.x1 - s.x0) * k, (s.y1 - s.y0) * k); }); x.fillStyle = "#475569"; c.room.crowd.forEach(function (p) { x.beginPath(); x.arc(px(p.x), py(p.y), 4, 0, TAU); x.fill(); }); x.fillStyle = "#0ea5e9"; c.people.concat(c.moved.map(function (m) { return m.n; })).forEach(function (p) { x.beginPath(); x.arc(px(p.x - c.ox), py(p.y - c.oy), 6, 0, TAU); x.fill(); }); x.fillStyle = "#fde047"; c.room.spots.forEach(function (s) { x.fillRect(px(s.x) - 3, py(s.y) - 3, 6, 6); }); x.fillStyle = "#f97316"; x.beginPath(); x.arc(px(Z.me.x - c.ox), py(Z.me.y - c.oy), 7, 0, TAU); x.fill(); x.fillStyle = "#fff"; x.font = "700 14px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(c.pl.name + (I.prompt() ? "  ·  E: " + I.prompt() : ""), 480, 130); x.restore(); } catch (e) {} return r; };

  /* ================= 3D dressing ================= */
  var BOARD_ART = { // strokes in board units (0..1 across, 0..1 down), drawn on as the lecturer talks
    ee: [[[.08, .3], [.08, .8], [.42, .8], [.42, .3], [.08, .3]], [[.2, .3], [.22, .22], [.25, .38], [.28, .22], [.31, .38], [.33, .3]], [[.06, .5], [.1, .5]], [[.07, .56], [.09, .56]]],
    phys: [[[.06, .82], [.44, .82], [.44, .4], [.06, .82]], [[.24, .56], [.31, .49], [.36, .55], [.29, .62], [.24, .56]], [[.3, .55], [.3, .3]], [[.28, .34], [.3, .3], [.32, .34]]],
    math: [[[.07, .85], [.07, .2]], [[.07, .85], [.45, .85]], [[.07, .8], [.15, .72], [.22, .58], [.3, .42], [.38, .3], [.44, .24]], [[.22, .85], [.22, .58]], [[.3, .85], [.3, .42]]],
    chem: [[[.16, .25], [.16, .78], [.36, .78], [.36, .25]], [[.16, .5], [.36, .5]], [[.12, .25], [.4, .25]], [[.22, .62], [.24, .58], [.26, .62]], [[.3, .68], [.32, .64], [.34, .68]]],
    gen: [[[.08, .3], [.44, .3]], [[.08, .45], [.38, .45]], [[.08, .6], [.42, .6]], [[.08, .75], [.3, .75]]]
  };
  I.boardPaint = function (x, W, H, lc, room) { // also used headlessly with a stub context
    x.fillStyle = "#14532d"; x.fillRect(0, 0, W, H); x.fillStyle = "rgba(255,255,255,.05)"; for (var i = 0; i < 9; i++) x.fillRect(hash(i, 1) * W, hash(i, 2) * H, 120, 3);
    x.textBaseline = "top"; x.textAlign = "left"; x.fillStyle = "#fef9c3";
    if (!lc) { x.font = "800 64px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(room && room.boardText ? room.boardText : "NEXT LECTURE ON THE HOUR", W / 2, H / 2 - 40); return; }
    x.font = "800 46px system-ui, sans-serif"; x.fillText(lc.e.course.code + "  " + lc.e.course.title, 36, 22); x.fillStyle = "rgba(254,249,195,.6)"; x.fillRect(36, 78, W - 72, 3);
    var y = 100, li, s, k;
    if (lc.phase === "settle" || lc.phase === "teach" || (lc.phase === "ask" && lc.qi === 0 && !lc.open && lc.t < 0)) {
      x.font = "600 36px system-ui, sans-serif"; x.fillStyle = "#f8fafc"; var tw = W * .5;
      for (li = 0; li <= Math.min(lc.li, lc.lines.length - 1); li++) { var txt = li < lc.li ? lc.lines[li] : lc.lines[li].slice(0, lc.shown), words = ("• " + txt).split(" "), cur = ""; for (k = 0; k < words.length; k++) { if (x.measureText(cur + words[k]).width > tw && cur) { x.fillText(cur, W * .47, y); y += 42; cur = "  "; } cur += words[k] + " "; } x.fillText(cur, W * .47, y); y += 52; }
      var art = BOARD_ART[lc.e.course.s] || BOARD_ART.gen, total = lc.lines.length, prog = Math.min(1, (lc.li + (lc.lines[lc.li] ? lc.shown / lc.lines[lc.li].length : 1)) / total), per = 1 / art.length; x.strokeStyle = "#fde68a"; x.lineWidth = 6; x.lineCap = "round"; x.lineJoin = "round";
      for (s = 0; s < art.length; s++) { var f = Math.max(0, Math.min(1, (prog - s * per) / per)); if (f <= 0) break; var pts = art[s], segs = (pts.length - 1) * f; x.beginPath(); x.moveTo(pts[0][0] * W, 60 + pts[0][1] * (H - 60)); for (k = 1; k <= Math.ceil(segs) && k < pts.length; k++) { var fr = Math.min(1, segs - (k - 1)), ax = pts[k - 1][0], ay = pts[k - 1][1]; x.lineTo((ax + (pts[k][0] - ax) * fr) * W, 60 + (ay + (pts[k][1] - ay) * fr) * (H - 60)); } x.stroke(); }
    } else {
      var q = lc.qs[Math.min(lc.qi, lc.qs.length - 1)]; x.font = "700 30px system-ui, sans-serif"; x.fillStyle = "#fde68a"; x.fillText(lc.phase === "over" ? "That is all for today." : "Question " + (lc.qi + 1) + " of " + lc.qs.length, 36, y); y += 46; if (lc.phase === "over") { x.fillStyle = "#f8fafc"; x.fillText("Read chapter " + (2 + lc.e.i) + " before the next class.", 36, y); return; }
      x.font = "800 42px system-ui, sans-serif"; x.fillStyle = "#f8fafc"; var ws = q.q.split(" "), ln = ""; for (k = 0; k < ws.length; k++) { if (x.measureText(ln + ws[k]).width > W - 90 && ln) { x.fillText(ln, 36, y); y += 46; ln = ""; } ln += ws[k] + " "; } x.fillText(ln, 36, y); y += 62;
      x.font = "700 36px system-ui, sans-serif"; for (k = 0; k < 4; k++) { var cx = 36 + (k % 2) * (W / 2 - 20), cy = y + Math.floor(k / 2) * 56, hit = lc.mark && k === q.a; x.fillStyle = hit ? "#86efac" : "#e2e8f0"; x.fillText("ABCD"[k] + ")  " + q.o[k] + (hit ? "  ✓" : ""), cx, cy); }
      if (lc.mark) { x.font = "800 40px system-ui, sans-serif"; x.fillStyle = lc.mark === "ok" ? "#86efac" : "#fca5a5"; x.textAlign = "right"; x.fillText(lc.mark === "ok" ? "Correct" : "Not quite", W - 36, 22); }
    }
  };
  function kit() { return Z.r3 && Z.r3.ready && Z.r3.kit; }
  I.build3 = function (c) {
    var K = kit(); if (!K) return; var T = K.T, r = c.room, g = new T.Group(), w = r.w, d = r.d, h = r.h, tex = [], BP = [], BN = [], BC = [], bcol = new T.Color();
    var FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], FV = [[[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]];
    function bx(bw, bh, bd, col, x, y, z, ry, ox, oz) { var cs = Math.cos(ry || 0), sn = Math.sin(ry || 0); bcol.set(col); for (var f = 0; f < 6; f++) { var nn = FN[f], q4 = FV[f], idx = [0, 1, 2, 0, 2, 3]; for (var v = 0; v < 6; v++) { var p = q4[idx[v]], lx = x + p[0] * bw / 2, lz = z + p[2] * bd / 2; BP.push((ox || 0) + lx * cs + lz * sn, y + p[1] * bh / 2, (oz || 0) - lx * sn + lz * cs); BN.push(nn[0] * cs + nn[2] * sn, nn[1], -nn[0] * sn + nn[2] * cs); BC.push(bcol.r, bcol.g, bcol.b); } } }
    function part(parent, pw, ph, pd, col, x, y, z, o) { if (o || !parent || (parent !== g && parent.userData.real)) return K.part(parent, pw, ph, pd, col, x, y, z, o); if (parent === g) bx(pw, ph, pd, col, x || 0, y || 0, z || 0, 0, 0, 0); else bx(pw, ph, pd, col, x || 0, y || 0, z || 0, parent.rotation.y, parent.position.x, parent.position.z); return null; }
    g.position.set(c.ox, 0, c.oy); c.g = g; c.tex = tex; c.own = [];
    function own(o) { c.own.push(o); return o; }
    function lam(col) { return K.mat(col); }
    function flat(col) { return K.mat(col, "b"); }
    // shell: floor with a border, four walls with a skirting, a ceiling you only see from below, strip lights
    part(g, w + .6, .2, d + .6, r.floor, 0, -.1, d / 2); for (var fi = 0; fi < Math.floor(d / 2); fi++) part(g, w - .2, .012, .05, 0x000000, 0, .012, 1 + fi * 2, "t");
    function wall(x0, y0, x1, y1) { var len = Math.hypot(x1 - x0, y1 - y0), horiz = Math.abs(y1 - y0) < .01, m = part(g, horiz ? len + .3 : .3, h, horiz ? .3 : len + .3, r.wall, (x0 + x1) / 2, h / 2, (y0 + y1) / 2); part(g, horiz ? len : .36, .22, horiz ? .36 : len, r.trim, (x0 + x1) / 2, .11, (y0 + y1) / 2); part(g, horiz ? len : .34, .5, horiz ? .34 : len, r.trim, (x0 + x1) / 2, h - .25, (y0 + y1) / 2); return m; }
    wall(-w / 2, -.15, -1.1, -.15); wall(1.1, -.15, w / 2, -.15); part(g, 2.3, h - 2.6, .3, r.wall, 0, 2.6 + (h - 2.6) / 2, -.15); wall(-w / 2, d + .15, w / 2, d + .15); wall(w / 2 + .15, 0, w / 2 + .15, d);
    if (r.annex) { var a = r.annex; wall(-w / 2 - .15, 0, -w / 2 - .15, a.y0); c.gate = K.part(g, .34, h, a.y1 - a.y0 + .4, 0x6b4f3a, -w / 2 - .15, h / 2, (a.y0 + a.y1) / 2); c.gate.visible = !c.open; part(g, a.x1 - a.x0 + 1, .2, a.y1 - a.y0 + .6, 0x5b4636, (a.x0 + a.x1) / 2 - .3, -.09, (a.y0 + a.y1) / 2); part(g, .3, h, a.y1 - a.y0 + .6, 0x8a7a66, a.x0 - .15, h / 2, (a.y0 + a.y1) / 2); part(g, a.x1 - a.x0 + 1, h, .3, 0x8a7a66, (a.x0 + a.x1) / 2 - .3, h / 2, a.y0 - .15); part(g, a.x1 - a.x0 + 1, h, .3, 0x8a7a66, (a.x0 + a.x1) / 2 - .3, h / 2, a.y1 + .15); own(new T.PointLight(0xffc27a, 6, 12, 1.4)).position.set((a.x0 + a.x1) / 2, 2.4, (a.y0 + a.y1) / 2); g.add(c.own[c.own.length - 1]); }
    else wall(-w / 2 - .15, 0, -w / 2 - .15, d);
    var ceil = new T.Mesh(own(new T.PlaneGeometry(w + .6, d + .6)), lam(0xf8fafc)); ceil.rotation.x = HP; ceil.position.set(0, h, d / 2); g.add(ceil);
    for (var lx = -1; lx <= 1; lx += 2) for (var ly = 0; ly < Math.max(2, Math.round(d / 6)); ly++) part(g, 1.6, .08, .3, 0xfffbeb, lx * w / 4, h - .06, (ly + .5) * d / Math.max(2, Math.round(d / 6)), "b");
    // the way out: a frame, a leaf that stands open and daylight beyond
    part(g, .14, 2.6, .34, 0x4a3524, -1.1, 1.3, -.15); part(g, .14, 2.6, .34, 0x4a3524, 1.1, 1.3, -.15); part(g, 2.3, .14, .34, 0x4a3524, 0, 2.6, -.15); part(g, 2.06, 2.5, .05, 0xdbeafe, 0, 1.25, -.28, "b"); part(g, .06, 2.4, 1, 0x7c4a22, -1.02, 1.2, .5); K.plate(g, "EXIT", .9, .3, 0, 2.95, .02, "#15803d", "#ffffff");
    var light = own(new T.PointLight(0xfff1d6, 9, Math.max(w, d) * 2.2, 1.1)); light.position.set(0, h - .6, d / 2); g.add(light); var amb = own(new T.AmbientLight(0xffffff, .55)); g.add(amb);
    // furniture
    function grp(it) { var q = new T.Group(); q.position.set(it.x, 0, it.y); q.rotation.y = -(it.a || 0); g.add(q); return q; }
    function canvasPlate(w2, h2, draw, px) { var cv = document.createElement("canvas"); cv.width = px || 512; cv.height = Math.round((px || 512) * h2 / w2); draw(cv.getContext("2d"), cv.width, cv.height); var t = own(new T.CanvasTexture(cv)); t.colorSpace = T.SRGBColorSpace; var m = new T.Mesh(own(new T.PlaneGeometry(w2, h2)), own(new T.MeshBasicMaterial({ map: t }))); m.userData.cv = cv; m.userData.tex = t; return m; }
    var BOOK = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xa16207, 0x6d28d9, 0x0f766e, 0xbe185d, 0x334155];
    r.items.forEach(function (it) {
      var q, i, k = it.k, sx = it.sx || 1;
      if (k === "tier") { if (it.h > 0) part(g, it.w, it.h, 2.05, 0x57493b, it.x, it.h / 2, it.y + .3); part(g, it.w - .2, .06, .5, 0x8b5e34, it.x, it.h + .78, it.y + .62); part(g, it.w - .2, .5, .05, 0x6f4a28, it.x, it.h + .52, it.y + .86); part(g, it.w - .2, .08, .42, 0x334155, it.x, it.h + .45, it.y - .05); part(g, it.w - .2, .5, .06, 0x1f2937, it.x, it.h + .7, it.y - .28); return; }
      if (k === "board") { q = grp(it); var bw = it.w || 8, bh = Math.min(3.4, h - 2.2); part(q, bw + .3, bh + .3, .08, 0x7c5a3a, 0, 1.3 + bh / 2, -.02); var bd = canvasPlate(bw, bh, function (x, W, H) { I.boardPaint(x, W, H, null, { boardText: it.text }); }, 1024); bd.position.set(0, 1.3 + bh / 2, -.08); bd.rotation.y = Math.PI; q.add(bd); if (!c.board) c.board = bd; part(q, bw * .6, .06, .14, 0x9ca3af, 0, 1.2, -.14); return; }
      if (k === "window") { q = grp(it); var win = canvasPlate(2.6, 1.7, function (x, W, H) { var gd = x.createLinearGradient(0, 0, 0, H); gd.addColorStop(0, "#7dd3fc"); gd.addColorStop(.7, "#e0f2fe"); gd.addColorStop(.71, "#4d7c0f"); gd.addColorStop(1, "#3f6212"); x.fillStyle = gd; x.fillRect(0, 0, W, H); x.fillStyle = "#166534"; x.beginPath(); x.arc(W * .25, H * .62, H * .2, 0, TAU); x.arc(W * .75, H * .58, H * .26, 0, TAU); x.fill(); x.fillStyle = "#fff"; x.fillRect(W / 2 - 4, 0, 8, H); x.fillRect(0, H / 2 - 4, W, 8); }, 256); var sgn = it.x > 0 ? -1 : 1; if (it.a) { win.rotation.y = sgn * HP; win.position.set(0, 0, 0); q.rotation.y = 0; win.position.set(-sgn * -.01 + sgn * .02, h > 5 ? 3.2 : 2.1, 0); } else { win.rotation.y = Math.PI; win.position.set(0, 2.1, -.02); } q.add(win); return; }
      q = grp(it); if (k === "notice" || k === "plaque" || k === "door") q.userData.real = 1;
      if (k === "desk") { part(q, 1.5, .06, .7, 0x8b5e34, 0, .76, 0); part(q, .06, .76, .64, 0x6f4a28, -.7, .38, 0); part(q, .06, .76, .64, 0x6f4a28, .7, .38, 0); part(q, .3, .04, .22, 0xf8fafc, -.3, .81, 0); part(q, .12, .26, .12, 0x1f2937, .45, .92, .1); }
      else if (k === "chair") { part(q, .46, .06, .46, 0x334155, 0, .46, 0); part(q, .46, .5, .06, 0x334155, 0, .74, -.2); }
      else if (k === "bench") { part(q, 2.6, .08, .9, 0x1f2937, 0, .92, 0); part(q, 2.4, .86, .8, 0xcbd5e1, 0, .43, 0); var gr = it.gear || 0; if (gr === 0) { part(q, .5, .3, .4, 0x0f172a, -.7, 1.11, 0); part(q, .4, .22, .02, 0x22c55e, -.7, 1.12, .21, "b"); part(q, .3, .14, .3, 0xf59e0b, .5, 1.03, 0); } else if (gr === 1) { for (i = 0; i < 3; i++) { var fl = new T.Mesh(K.cyl(.05, .12, .3, 10), lam([0x38bdf8, 0xf472b6, 0xa3e635][i])); fl.position.set(-.6 + i * .5, 1.11, 0); q.add(fl); } } else if (gr === 2) { part(q, .7, .04, .5, 0x166534, 0, .98, 0); part(q, .1, .1, .1, 0xef4444, -.2, 1.05, .1, "b"); part(q, .3, .2, .3, 0x475569, .8, 1.06, 0); } else { part(q, .6, .4, .1, 0x111827, 0, 1.2, -.1); part(q, .54, .32, .02, 0x60a5fa, 0, 1.2, -.04, "b"); part(q, .5, .03, .2, 0x334155, 0, .98, .2); } }
      else if (k === "bed") { part(q, 1, .3, 2, 0x6f4a28, 0, .25, 0); part(q, .94, .16, 1.94, 0xf8fafc, 0, .48, 0); part(q, .96, .1, 1.2, it.col || 0x2563eb, 0, .58, -.36); part(q, .6, .12, .36, 0xe2e8f0, 0, .6, .74); part(q, 1, .7, .08, 0x6f4a28, 0, .55, 1); }
      else if (k === "locker") { part(q, 1, 2, .5, 0x64748b, 0, 1, 0); part(q, .02, 1.9, .02, 0x1f2937, 0, 1, .26); part(q, .06, .14, .04, 0xfbbf24, .12, 1.05, .27); part(q, .3, .2, .3, 0x92400e, .2, 2.1, 0); }
      else if (k === "shelf") { part(q, 2.6, 2.3, .45, 0x6f4a28, 0, 1.15, 0); for (i = 0; i < 4; i++) for (var bj = 0; bj < 6; bj++) { var bc = BOOK[(i * 3 + bj + (it.hue || 0)) % BOOK.length]; part(q, .38, .4, .06, bc, -1.05 + bj * .42, .35 + i * .52, .23); part(q, .38, .4, .06, bc, -1.05 + bj * .42, .35 + i * .52, -.23); } }
      else if (k === "rack") { part(q, 1.6, 1.6, .5, 0xe2e8f0, 0, .8, 0); for (i = 0; i < 3; i++) for (bj = 0; bj < 4; bj++) part(q, .3, .32, .08, BOOK[(i + bj * 2 + (it.hue || 0)) % BOOK.length], -.56 + bj * .38, .3 + i * .5, .27); }
      else if (k === "counter") { part(q, 4 * sx, 1, .7, 0x7c5a3a, 0, .5, 0); part(q, 4 * sx + .2, .07, .9, 0xf1f5f9, 0, 1.04, 0); if (it.food) for (i = 0; i < 5; i++) { var pot = new T.Mesh(K.cyl(.26, .22, .26, 12), lam(0x94a3b8)); pot.position.set(-3.6 + i * 1.8, 1.21, 0); q.add(pot); part(q, .44, .03, .44, [0xf97316, 0xfde047, 0xb45309, 0xfef3c7, 0x84cc16][i], -3.6 + i * 1.8, 1.34, 0, "b"); } else { part(q, .5, .34, .06, 0x111827, .6, 1.3, 0); part(q, .6, .04, .4, 0xf8fafc, -.7, 1.1, 0); } }
      else if (k === "table") { part(q, 1.3 * sx, .06, 1.3, 0xb7791f, 0, .76, 0); part(q, .12, .76, .12, 0x4b5563, 0, .38, 0); for (i = 0; i < 4; i++) part(q, .38, .45, .38, 0x334155, [-.95 * sx, .95 * sx, 0, 0][i], .225, [0, 0, -.95, .95][i]); part(q, .2, .1, .2, 0xef4444, .2, .84, .1); }
      else if (k === "pingpong") { part(q, 2.74, .05, 1.52, 0x166534, 0, .78, 0); part(q, 2.74, .012, .03, 0xffffff, 0, .81, 0); part(q, .02, .16, 1.6, 0xf8fafc, 0, .89, 0); for (i = 0; i < 4; i++) part(q, .08, .76, .08, 0x334155, i < 2 ? -1.2 : 1.2, .38, i % 2 ? -.6 : .6); c.ball = part(g, .07, .07, .07, 0xfb923c, it.x, 1, it.y, "b"); c.ballAt = c.ballAt || it; }
      else if (k === "pool") { part(q, 2.6, .2, 1.4, 0x5b3a1e, 0, .74, 0); part(q, 2.34, .03, 1.14, 0x15803d, 0, .85, 0); for (i = 0; i < 4; i++) part(q, .14, .66, .14, 0x3b2512, i < 2 ? -1.1 : 1.1, .33, i % 2 ? -.5 : .5); for (i = 0; i < 7; i++) { var b = new T.Mesh(own(new T.SphereGeometry(.05, 10, 8)), flat([0xfde047, 0x2563eb, 0xdc2626, 0x7c3aed, 0xf97316, 0x16a34a, 0xffffff][i])); b.position.set(-.8 + hash(i, it.y) * 1.6, .91, -.4 + hash(i, it.x + 3) * .8); q.add(b); } }
      else if (k === "plant") { var pt = new T.Mesh(K.cyl(.26, .2, .4, 10), lam(0xb45309)); pt.position.y = .2; q.add(pt); var lf = new T.Mesh(own(new T.IcosahedronGeometry(.5, 1)), lam(0x15803d)); lf.position.y = .95; lf.scale.y = 1.3; q.add(lf); }
      else if (k === "sofa") { part(q, 2, .4, .8, 0x1d4ed8, 0, .3, 0); part(q, 2, .5, .2, 0x1e40af, 0, .7, -.3); part(q, .2, .3, .8, 0x1e40af, -.9, .62, 0); part(q, .2, .3, .8, 0x1e40af, .9, .62, 0); }
      else if (k === "lectern") { part(q, .7, 1.1, .5, 0x6f4a28, 0, .55, 0); part(q, .76, .05, .56, 0x8b5e34, 0, 1.13, 0); }
      else if (k === "atm") { part(q, .8, 1.8, .5, 0x1e3a8a, 0, .9, 0); part(q, .5, .36, .02, 0x7dd3fc, 0, 1.3, -.26, "b"); part(q, .4, .2, .06, 0x94a3b8, 0, .95, -.27); }
      else if (k === "cabinet") { part(q, 1, 1.3, .5, 0x94a3b8, 0, .65, 0); for (i = 0; i < 3; i++) part(q, .8, .04, .02, 0x475569, 0, .3 + i * .4, .26); }
      else if (k === "rug") { part(q, 3 * sx, .02, 2, 0x9f1239, 0, .012, 0); part(q, 2.6 * sx, .022, 1.6, 0xfbbf24, 0, .014, 0); part(q, 2.3 * sx, .024, 1.3, 0x9f1239, 0, .016, 0); }
      else if (k === "notice") { part(q, 2.7, 1.7, .05, 0xb08968, 0, 2.05, 0); var np = canvasPlate(2.56, 1.56, function (x, W, H) { x.fillStyle = "#fef3c7"; x.fillRect(0, 0, W, H); x.fillStyle = "#b91c1c"; x.beginPath(); x.arc(W / 2, 18, 9, 0, TAU); x.fill(); x.fillStyle = "#111827"; x.textAlign = "center"; var fs = 58; do { x.font = "900 " + fs + "px system-ui, sans-serif"; fs -= 3; } while (x.measureText(it.text || "").width > W - 40 && fs > 16); x.fillText(it.text || "", W / 2, H * .5); x.font = "700 27px system-ui, sans-serif"; x.fillStyle = "#44403c"; x.fillText(it.sub || "", W / 2, H * .76); }, 512); np.position.set(0, 2.05, it.a ? (it.x > 0 ? 0 : 0) : 0); var face = it.a ? (it.x > 0 ? -1 : 1) : -1; if (it.a) { q.rotation.y = 0; np.rotation.y = face * HP; np.position.x = face * .04; q.children[0].rotation.y = HP; } else { np.rotation.y = Math.PI; np.position.z = -.04; } q.add(np); }
      else if (k === "plaque") { q.rotation.y = 0; part(q, .06, .6, .9, 0xb45309, 0, 1.6, 0); var pp = canvasPlate(.8, .5, function (x, W, H) { x.fillStyle = "#d4a373"; x.fillRect(0, 0, W, H); x.fillStyle = "#3b2f20"; x.textAlign = "center"; x.font = "900 54px system-ui, sans-serif"; x.fillText(D.CREATOR.short, W / 2, H * .45); x.font = "600 26px system-ui, sans-serif"; x.fillText("built this school", W / 2, H * .72); }, 512); pp.rotation.y = HP; pp.position.set(.04, 1.6, 0); q.add(pp); }
      else if (k === "door") { q.rotation.y = 0; part(q, .08, 2.3, 1.2, 0x44403c, 0, 1.15, 0); part(q, .1, .08, .08, 0xfbbf24, -.06, 1.1, .4); var dp = canvasPlate(1, .26, function (x, W, H) { x.fillStyle = "#7f1d1d"; x.fillRect(0, 0, W, H); x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "800 70px system-ui, sans-serif"; x.fillText(it.text || "", W / 2, H * .72); }, 512); dp.rotation.y = -HP; dp.position.set(-.06, 2.5, 0); q.add(dp); }
    });
    // seated crowd: three instanced meshes whatever the head count
    var n = r.crowd.length, low = Z.r3.quality === "low"; if (low && n > 30) n = 30; c.crowdN = n;
    if (n) { var mk = function (geo) { var im = new T.InstancedMesh(own(geo), own(new T.MeshLambertMaterial({ color: 0xffffff })), n); im.frustumCulled = false; g.add(im); return im; }; c.cb = mk(new T.CapsuleGeometry(.21, .26, 4, 10)); c.ch = mk(new T.SphereGeometry(.17, 10, 8)); c.chr = mk(new T.SphereGeometry(.185, 10, 6, 0, TAU, 0, HP * 1.05)); c.ca = mk(new T.BoxGeometry(.5, .1, .34)); c.cl = mk(new T.BoxGeometry(.34, .9, .22)); var col = new T.Color(); c.dm = new T.Object3D();
      for (var ci = 0; ci < n; ci++) { var p = r.crowd[ci]; c.cb.setColorAt(ci, col.set(TOP[Math.floor(hash(p.seed, 4) * TOP.length)])); c.ch.setColorAt(ci, col.set(SKIN[Math.floor(hash(p.seed, 2) * SKIN.length)])); c.chr.setColorAt(ci, col.set(hash(p.seed, 6) < .25 ? TOP[Math.floor(hash(p.seed, 7) * TOP.length)] : "#16110d")); c.ca.setColorAt(ci, col.set(SKIN[Math.floor(hash(p.seed, 2) * SKIN.length)])); c.cl.setColorAt(ci, col.set(p.legs || ["#1f2937", "#1e3a8a", "#3f3f46", "#44403c"][Math.floor(hash(p.seed, 5) * 4)])); if (p.top) c.cb.setColorAt(ci, col.set(p.top)); } [c.cb, c.ch, c.chr, c.ca, c.cl].forEach(function (m) { m.instanceColor.needsUpdate = true; }); }
    // glowing floor marks for the things you can use: one instanced mesh
    c.marks = r.spots.filter(function (s) { return !(s.k === "seat" && r.seats); }); c.dm = c.dm || new T.Object3D();
    if (c.marks.length) { c.mk = new T.InstancedMesh(own(new T.RingGeometry(.34, .46, 20)), own(new T.MeshBasicMaterial({ color: 0xffffff })), c.marks.length); c.mk.frustumCulled = false; var mc = new T.Color(); c.marks.forEach(function (s, i) { c.mk.setColorAt(i, mc.set(s.k === "exit" ? 0x4ade80 : s.k === "token" || s.k === "secret" ? 0xfb923c : 0xfde047)); }); c.mk.instanceColor.needsUpdate = true; g.add(c.mk); }
    if (r.draw3) r.draw3({ T: T, K: K, g: g, c: c, bx: bx, part: part, own: own, lam: lam, flat: flat, canvasPlate: canvasPlate, grp: grp });
    if (BP.length) { var bg = own(new T.BufferGeometry()); bg.setAttribute("position", new T.Float32BufferAttribute(BP, 3)); bg.setAttribute("normal", new T.Float32BufferAttribute(BN, 3)); bg.setAttribute("color", new T.Float32BufferAttribute(BC, 3)); var bm = new T.Mesh(bg, own(new T.MeshLambertMaterial({ vertexColors: true }))); bm.frustumCulled = false; g.add(bm); c.boxes = BP.length / 108; }
    K.scene.add(g); c.boardKey = "";
  };
  I.open3 = function (c) { if (c.gate) c.gate.visible = false; };
  I.drop3 = function (c) { var K = kit(); if (!K || !c.g) return; K.scene.remove(c.g); (c.own || []).forEach(function (o) { if (o.dispose) o.dispose(); }); c.g = null; };
  I.step3 = function (c, dt) {
    if (!c.g) return; var t = c.t, i, P = Z.P;
    if (c.cb) { var d = c.dm, n = c.crowdN, leave = c.empty ? Math.max(0, 1 - c.emptyT / 5) : 1, show = Math.ceil(n * leave);
      for (i = 0; i < n; i++) { var p = c.room.crowd[i], on = i < show && !p.gone, nod = p.idle === "sleep" ? .75 : p.idle === "write" ? .28 + Math.sin(t * 2.2 + p.seed) * .12 : Math.sin(t * .9 + p.seed) * .08, turn = p.idle === "talk" ? Math.sin(t * .6 + p.seed * 3) * .7 : 0, hand = I.lec && I.lec.phase === "ask" && hash(p.seed, Math.floor(t / 4)) < .12, by = p.h, sway = 0, ca = Math.cos(p.a), sa = Math.sin(p.a);
        if (p.dance) { var bt = t * (c.beat || 3.6) + p.seed; by += Math.abs(Math.sin(bt)) * (.1 + (p.seed % 3) * .05); sway = Math.sin(bt * (p.seed % 2 ? 1 : .5)) * .5; hand = Math.sin(bt * .5 + p.seed) > .3; nod = Math.sin(bt) * .15; }
        if (p.lie) { d.position.set(p.x, on ? p.h + .12 : -50, p.y); d.rotation.set(HP, 0, -p.a + HP); d.updateMatrix(); c.cb.setMatrixAt(i, d.matrix); d.position.set(p.x + ca * .5, on ? p.h + .16 : -50, p.y + sa * .5); d.rotation.set(0, 0, 0); d.updateMatrix(); c.ch.setMatrixAt(i, d.matrix); c.chr.setMatrixAt(i, d.matrix); d.position.set(0, -50, 0); d.updateMatrix(); c.ca.setMatrixAt(i, d.matrix); c.cl.setMatrixAt(i, d.matrix); continue; }
        d.position.set(p.x, on ? by + .26 : -50, p.y); d.rotation.set(0, -p.a + HP + sway, 0); d.scale.set(1, 1, 1); d.updateMatrix(); c.cb.setMatrixAt(i, d.matrix);
        d.position.set(p.x + ca * nod * .18, on ? by + .68 - nod * .08 : -50, p.y + sa * nod * .18); d.rotation.set(0, -p.a + HP + turn + sway, 0); d.rotateX(nod); d.updateMatrix(); c.ch.setMatrixAt(i, d.matrix); c.chr.setMatrixAt(i, d.matrix);
        if (hand) { d.position.set(p.x + .26, on ? by + .8 : -50, p.y); d.rotation.set(0, 0, HP); } else { d.position.set(p.x + ca * (p.stand ? .12 : .3), on ? by + (p.stand ? .22 : .36) : -50, p.y + sa * (p.stand ? .12 : .3)); d.rotation.set(0, -p.a + HP + sway, 0); } d.updateMatrix(); c.ca.setMatrixAt(i, d.matrix);
        d.position.set(p.x, on && p.stand ? by - .45 : -50, p.y); d.rotation.set(0, -p.a + HP, 0); d.updateMatrix(); c.cl.setMatrixAt(i, d.matrix); }
      c.cb.instanceMatrix.needsUpdate = c.ch.instanceMatrix.needsUpdate = c.chr.instanceMatrix.needsUpdate = c.ca.instanceMatrix.needsUpdate = c.cl.instanceMatrix.needsUpdate = true; }
    if (c.board) { var lc = I.lec, key = lc ? [lc.phase, lc.li, lc.shown, lc.qi, lc.mark].join("|") : "idle"; if (key !== c.boardKey && (!lc || lc.dirty || 1)) { c.boardKey = key; if (lc) lc.dirty = 0; var cv = c.board.userData.cv; I.boardPaint(cv.getContext("2d"), cv.width, cv.height, lc, { boardText: c.room.items[0] && c.room.items[0].text }); c.board.userData.tex.needsUpdate = true; } }
    if (c.ball && c.ballAt) { var ph = t * 2.6; c.ball.position.set(c.ballAt.x + Math.sin(ph) * 1.2, .86 + Math.abs(Math.sin(ph * 2)) * .32, c.ballAt.y + Math.sin(ph * .7) * .4); }
    if (c.mk) { var sp = I.spot(), dd = c.dm; c.marks.forEach(function (s, mi) { var hid = (Z.intro && Z.intro.on) || s.gone || s.hide || (s.k === "token" && P.flags["in_" + s.id]) || ((s.k === "plaque" || s.id === "kola_lib") && !c.open), sc = hid ? .0001 : s === sp ? 1.25 + Math.sin(t * 6) * .12 : 1; dd.position.set(s.x, (s.lift || 0) + .04, s.y); dd.rotation.set(-HP, 0, 0); dd.scale.set(sc, sc, sc); dd.updateMatrix(); c.mk.setMatrixAt(mi, dd.matrix); }); c.mk.instanceMatrix.needsUpdate = true; c.dm.scale.set(1, 1, 1); }
    if (c.room.step3) c.room.step3(c, dt);
  };
  // doors on the outside of buildings you can walk into
  var doors = I.doors = {}, doorT = 0;
  function nearestWall(pl) { var W = Z.W, best = null, bd = 30 * 30; if (!W || !W.b) return null; W.b.forEach(function (b) { if (pl.mx < b.x0 - 30 || pl.mx > b.x1 + 30 || pl.my < b.y0 - 30 || pl.my > b.y1 + 30) return; var p = b.p; for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { var ax = p[j], ay = p[j + 1], bx = p[i], by = p[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; if (l2 < 9) continue; var u = Math.max(.15, Math.min(.85, ((pl.mx - ax) * dx + (pl.my - ay) * dy) / l2)), qx = ax + dx * u, qy = ay + dy * u, dd = (qx - pl.mx) * (qx - pl.mx) + (qy - pl.my) * (qy - pl.my); if (dd < bd) { bd = dd; best = { x: qx, y: qy, a: Math.atan2(pl.my - qy, pl.mx - qx), ea: Math.atan2(dy, dx) }; } } }); return best; }
  I.doors3 = function () {
    var K = kit(); if (!K || !Z.P || I.cur) return; var T = K.T, me = Z.me;
    Z.placeList.forEach(function (pl) { var d = doors[pl.id], near = Math.hypot(pl.mx - me.x, pl.my - me.y) < 170, want = near && !!I.typeOf(pl);
      if (want && !d) { var nw = nearestWall(pl); if (!nw) { doors[pl.id] = { none: 1 }; return; } var g = new T.Group(), nx = Math.cos(nw.a), ny = Math.sin(nw.a), out = Math.abs(((nw.a - nw.ea + Math.PI * 3) % TAU) - Math.PI) > .2 ? nw.ea + (Math.sin(nw.a - nw.ea) > 0 ? HP : -HP) : nw.a; nx = Math.cos(out); ny = Math.sin(out);
        g.position.set(nw.x + nx * .12, 0, nw.y + ny * .12); g.rotation.y = -out + HP; K.part(g, 2.1, 2.7, .16, 0x3f2d1c, 0, 1.35, 0); K.part(g, 1.8, 2.5, .06, 0x0b1220, 0, 1.25, .08); var leaf = new T.Group(); leaf.position.set(-.85, 0, .14); K.part(leaf, 1.7, 2.4, .07, 0x9a5b2a, .85, 1.2, 0); K.part(leaf, .1, .1, .1, 0xfbbf24, 1.5, 1.15, .06); g.add(leaf); K.part(g, 2.8, .12, 1.1, 0xb45309, 0, 2.95, .55); K.part(g, 2.4, .1, .9, 0x9ca3af, 0, .05, .5); K.plate(g, pl.name.replace(/^Department of /, "").slice(0, 22), 2.4, .5, 0, 3.4, .2, "#1e3a8a", "#ffffff");
        var lock = new T.Group(); K.part(lock, .26, .22, .1, 0xfbbf24, 0, 1.12, .24); K.part(lock, .16, .14, .05, 0x9ca3af, 0, 1.3, .24); g.add(lock); var glow = K.part(g, 1.8, .34, .05, 0xfde68a, 0, 2.62, .13, "b"); glow.visible = false; var gl2 = K.part(g, 1.5, 1.2, .03, 0xfef3c7, 0, 1.6, .2, "b"); gl2.visible = false;
        K.scene.add(g); doors[pl.id] = { g: g, leaf: leaf, open: 0, to: 0, lock: lock, glow: glow, gl2: gl2, pl: pl }; }
      else if (!want && d && d.g && !near) { K.scene.remove(d.g); delete doors[pl.id]; }
      else if (!want && d && d.none && !near) delete doors[pl.id];
      d = doors[pl.id]; if (d && d.g) { var op = I.isOpen(pl), tu = I.tutorial(), lit = !!(tu && tu.on && tu.place === pl.id); d.lock.visible = !op; d.glow.visible = lit; d.gl2.visible = lit && !d.open; } });
  };
  I.door3 = function (pl, open) { var d = doors[pl.id]; if (d && d.g) d.to = open ? 1 : 0; };
  var oU2 = Z.update; Z.update = function (dt) { var r = oU2.apply(Z, arguments); try { doorT -= dt; if (doorT <= 0) { doorT = .7; I.doors3(); } for (var k in doors) { var d = doors[k]; if (d.g && d.open !== d.to) { d.open += Math.sign(d.to - d.open) * Math.min(Math.abs(d.to - d.open), dt * 5); d.leaf.rotation.y = -d.open * 1.5; } } } catch (e) { if (!I.derr) { I.derr = e; if (typeof console !== "undefined") console.error(e); } } return r; };
})();
