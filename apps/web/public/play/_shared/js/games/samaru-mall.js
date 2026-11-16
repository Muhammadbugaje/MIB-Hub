/* Freshers School Life — more walk-in rooms built on samaru-interior.js: the Kanti Market mall (a ground floor and a
   raised gallery joined by wide stairs, fifteen open-front stores), the games arcade, the dance club with its rhythm
   game, the MIB Store and the Sick Bay. Stores, the arcade and the club only appear when the map defines their places
   (mk_*), and other workers' features (wardrobe, mini-games) are used only when present. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, I = Z && Z.interior; if (!I || !I.kit) return;
  var K = I.kit, room = K.room, item = K.item, spot = K.spot, person = K.person, hash = K.hash, say = K.say, sfx = K.sfx, esc = K.esc, HP = Math.PI / 2, TAU = Math.PI * 2, M = I.mall = {};
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function place(id) { return Z.places && Z.places[id]; }
  function low() { return !!(Z.r3 && Z.r3.quality === "low"); }
  function staff(r, x, y, a, seed, o) { if (!low()) return person(r, x, y, a, seed, o); r.crowd.push({ x: x, y: y, h: .9, a: a, seed: seed, stand: 1, idle: "talk", dance: o && o.dance, top: o && o.look && o.look.top }); return null; }
  function pseudo(id, name) { var mk = place("market") || place("gate") || Z.placeList[0]; return place(id) || { id: id, name: name, mx: mk.mx, my: mk.my, def: {}, pseudo: 1 }; }

  /* ---------- which room ---------- */
  var oType = I.typeOf;
  I.typeOf = function (pl) {
    if (!pl || !I.on) return ""; var id = pl.id;
    if (id === "mk_arcade") return "arcade"; if (id === "mk_dance") return "dance"; if (id === "market" || /^mk_/.test(id)) return "mall";
    if (id === "mibstore") return "mib"; if (id === "sickbay") return "sick"; return oType(pl);
  };

  /* ---------- the mall ---------- */
  var MW = 44, MD = 52, GAL = 35, UP = 4.2, R0 = 27; // width, depth, where the gallery starts, its height, where the stairs start
  // id, sign, side (L/R ground, l/r gallery, b gallery back), slot, kind of counter, colour
  M.STORES = [
    ["mk_supermarket", "SUPERMARKET", "L", 0, "place", 0x16a34a], ["mk_pharmacy", "PHARMACY", "L", 1, "place", 0x0d9488], ["mk_phones", "PHONES", "L", 2, "phones", 0x2563eb], ["mk_electronics", "ELECTRONICS", "L", 3, "place", 0x334155],
    ["mk_fashion", "FASHION", "R", 0, "wear", 0xdb2777], ["mk_shoes", "SHOES", "R", 1, "wear", 0xb45309], ["mk_native", "NATIVE WEAR · TAILOR", "R", 2, "wear", 0x7c3aed], ["mk_books", "BOOKS", "R", 3, "books", 0x92400e],
    ["mk_eyewear", "EYEWEAR", "l", 0, "wear", 0x0f172a], ["mk_sports", "SPORTS", "l", 1, "wear", 0xdc2626], ["mk_modest", "MODEST WEAR", "r", 0, "wear", 0x0f766e], ["mk_thrift", "THRIFT · OKRIKA", "r", 1, "wear", 0xca8a04],
    ["mk_barber", "BARBER · SALON", "b", 0, "hair", 0x1d4ed8], ["mk_food", "FOOD COURT", "b", 1, "place", 0xea580c], ["mk_gifts", "GIFTS", "b", 2, "place", 0xe11d48]
  ].map(function (s) { return { id: s[0], sign: s[1], side: s[2], slot: s[3], kind: s[4], col: s[5] }; });
  function frame(st) { // unit coordinates: u along the shop front, v from the front (0) to the back wall (8)
    var g = st.side === "l" || st.side === "r" || st.side === "b", base = g ? UP : 0, cy = st.side === "L" || st.side === "R" ? 6 + st.slot * 6 : 39.5 + st.slot * 7, cx = (st.slot - 1) * 9;
    if (st.side === "L" || st.side === "l") return { base: base, swap: 1, to: function (u, v) { return [-14 - v, cy + u]; }, face: 0 };
    if (st.side === "R" || st.side === "r") return { base: base, swap: 1, to: function (u, v) { return [14 + v, cy - u]; }, face: Math.PI };
    return { base: base, swap: 0, to: function (u, v) { return [cx + u, 44 + v]; }, face: -HP, wide: 1 };
  }
  M.lift = function (x, y) { return y >= GAL ? UP : y > R0 && Math.abs(x) < 5 ? (y - R0) / (GAL - R0) * UP : 0; };
  K.ROOMS.mall = function (pl) {
    var r = room(MW, MD, 10, { floor: 0xd6d3d1, wall: 0xf5f5f4, trim: 0x78716c }), i; r.lift = M.lift; r.stores = [];
    function solid(x0, y0, x1, y1) { r.solids.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) }); }
    solid(-22, GAL - .2, -5, GAL + .2); solid(5, GAL - .2, 22, GAL + .2); solid(-5.2, R0, -4.8, GAL); solid(4.8, R0, 5.2, GAL); // gallery front and stair rails
    solid(-2.6, 11.4, 2.6, 16.6); // fountain
    M.STORES.forEach(function (st) {
      var f = frame(st), sp = place(st.id), a = f.to(-3, 0), b = f.to(-3, 8), c2 = f.to(3, 0), d2 = f.to(3, 8), hw = f.wide ? 4.3 : 3; st.f = f; st.open = !!sp;
      a = f.to(-hw, 0); b = f.to(-hw, 8); c2 = f.to(hw, 0); d2 = f.to(hw, 8); solid(a[0] - .1, a[1] - .1, b[0] + .1, b[1] + .1); solid(c2[0] - .1, c2[1] - .1, d2[0] + .1, d2[1] + .1); // dividers
      var bk0 = f.to(-hw, 7), bk1 = f.to(hw, 8); solid(bk0[0], bk0[1], bk1[0], bk1[1]); // shelves along the back wall
      if (!sp) { var s0 = f.to(-hw, 0), s1 = f.to(hw, .3); solid(s0[0], s0[1], s1[0], s1[1]); return; } // shuttered
      var c0 = f.to(-2.4, 2.6), c1 = f.to(-.4, 3.3), keep = f.to(-1.4, 3.9), use = f.to(-1.4, 1.5); solid(c0[0], c0[1], c1[0], c1[1]);
      r.crowd.push({ x: keep[0], y: keep[1], h: f.base + .9, a: f.face, seed: st.slot * 7 + st.id.length, stand: 1, idle: "talk", top: "#" + ("000000" + st.col.toString(16)).slice(-6) });
      r.stores.push(st); spot(r, "store", use[0], use[1], st.sign.split(" · ")[0].charAt(0) + st.sign.split(" · ")[0].slice(1).toLowerCase() + " counter", { lift: f.base, r: 1.7, store: st, use: function (c, s) { M.shop(s.store); } });
    });
    // the old market, as a stall in the court
    if (pl.id === "market" || place("market")) { solid(-9.5, 19, -6.5, 21); spot(r, "menu", -8, 17.8, "Market stall", { r: 1.6, use: function () { Z.ui.place(place("market") || pl); } }); r.stall = 1; r.crowd.push({ x: -8, y: 21.6, h: .9, a: -HP, seed: 91, stand: 1, idle: "talk", top: "#f97316" }); }
    spot(r, "portal", -17, 37.2, "Games arcade", { lift: UP, r: 1.6, use: function () { I.hop(pseudo("mk_arcade", "Games Arcade"), 1); } });
    spot(r, "portal", 17, 37.2, "The club", { lift: UP, r: 1.6, use: function () { I.hop(pseudo("mk_dance", "The Club"), 1); } });
    spot(r, "note", 0, 9.8, "Read the mall directory", { id: "mall_dir", text: "<b>Ground:</b> supermarket, pharmacy, phones, electronics · fashion, shoes, native wear, books.<br><b>Upstairs:</b> eyewear, sports, modest wear, thrift, barber, food court, gifts, the arcade and the club." });
    spot(r, "token", 20.5, 28.5, "Look under the stairs", { id: "kola_mall", cash: 300, xp: 25, text: "A kola nut and ₦300 in a shoe box somebody forgot. +25 XP." });
    for (i = 0; i < 4; i++) solid([-6, 6, -6, 6][i] - .9, [8, 8, 20, 20][i] - .35, [-6, 6, -6, 6][i] + .9, [8, 8, 20, 20][i] + .35); // benches
    // shoppers on foot (full characters, a few) and browsers standing in the stores (instanced)
    var hi = !(Z.r3 && Z.r3.quality === "low"), loops = [[[-10, 5], [-10, 24], [10, 24], [10, 5]], [[11, 23], [11, 6], [-11, 6], [-11, 23]], [[0, 22], [0, 37], [-11, 38.5], [-11, 42], [11, 42], [11, 38.5], [0, 37]], [[-3, 26], [-3, 37], [3, 37], [3, 26], [8, 6], [-8, 6]], [[9, 40], [-9, 40]]];
    for (i = 0; i < (hi ? 5 : 1); i++) { var lp = loops[i], w = person(r, lp[0][0], lp[0][1], 0, 700 + i * 13, { path: lp, sp: 1 + hash(i, 3) * .5, bag: [0xf97316, 0x22c55e, 0xe11d48, 0x3b82f6, 0xfacc15][i] }); w.pi = 1; }
    staff(r, 3.4, 3.2, HP, 808, { look: { skin: "#5e3a22", hair: "cap", hairCol: "#1e3a8a", top: "#1e3a8a", pants: "#0f172a", mode: "tee" }, opt: { scale: 1.1 }, queue: 1 }); // security
    r.stores.forEach(function (st, k) { if (k % 2 && !hi) return; var q = st.f.to(1.6 - (k % 3), 5.2 - (k % 2)); r.crowd.push({ x: q[0], y: q[1], h: st.f.base + .9, a: st.f.face + Math.PI + (k % 2 ? .6 : -.5), seed: 200 + k * 5, stand: 1, idle: "talk" }); });
    r.draw3 = M.draw; r.step3 = function (c, dt) { if (c.jet) { c.jet.scale.y = 1 + Math.sin(c.t * 3) * .12; c.water.rotation.z += dt * .3; } };
    r.enterAt = function (from) { for (var k = 0; k < r.stores.length; k++) if (r.stores[k].id === from.id) { var q = r.stores[k].f.to(1.5, -1.5); return { x: q[0], y: q[1], a: r.stores[k].f.face + Math.PI }; } return null; };
    return r;
  };
  // what E does at each counter
  M.shop = function (st) {
    var pl = place(st.id), P = Z.P, W = Z.wardrobe; if (!pl) return;
    if ((st.kind === "wear" || st.kind === "hair") && W && W.editor) { try { W.editor("shop", { store: st.id, hair: st.kind === "hair", stock: W.stock ? W.stock(st.id) : null, back: function () { Z.api.hide(); } }); return; } catch (e) { M.err = e; } }
    if (st.kind === "books") return M.books(pl);
    if (st.kind === "phones" && !(pl.def.stock || []).length) return M.phones(pl);
    if ((pl.def.menu || []).length || (pl.def.stock || []).length || pl.role) return Z.ui.place(pl);
    say("<b>" + esc(pl.name) + ".</b> “We are still stocking the shelves. Come back next week.”");
  };
  M.BOOSTS = { ee: 400, phys: 350, math: 350, chem: 300, gen: 250 };
  M.books = function (pl) {
    var P = Z.P; P.boost = P.boost || {}; var items = Object.keys(M.BOOSTS).map(function (s) { return { label: "Past questions: " + D.SUBJECTS[s] + " · " + naira(M.BOOSTS[s]), sub: "Saves one wrong answer in a " + D.SUBJECTS[s].toLowerCase() + " lecture. You have " + (P.boost[s] || 0) + ".", act: s, off: P.money < M.BOOSTS[s] || (P.boost[s] || 0) >= 5 }; });
    Z.ui.menu(esc(pl.name), "Past question booklets. Each one rescues a single wrong answer in class. <small>" + naira(P.money) + "</small>", items, function (it) { P.money -= M.BOOSTS[it.act]; P.boost[it.act] = (P.boost[it.act] || 0) + 1; sfx("coin"); M.books(pl); }, function () { Z.api.hide(); });
  };
  M.phones = function (pl) {
    var P = Z.P, air = D.ITEMS && D.ITEMS.airtime, skins = [["Classic black", 0], ["Gold case", 1500], ["Green-white-green", 800], ["Clear case", 500]], items = [];
    if (Z.phone && Z.phone.lost && Z.phone.lost()) items.push({ label: "Cheap replacement phone · " + naira(Z.phone.REPLACE), sub: "Yours was stolen. Your SIM brings your contacts back.", act: "rep", go: true, off: P.money < Z.phone.REPLACE }); // samaru-phone.js
    if (air) items.push({ label: "Airtime · " + naira(air.price), sub: "For calling friends to hang out", act: "air", off: P.money < air.price });
    skins.forEach(function (s, i) { var own = i === 0 || (P.flags["phone" + i]); items.push({ label: s[0] + (own ? "" : " · " + naira(s[1])), sub: (P.phoneSkin || 0) === i ? "On your phone now" : own ? "Yours. Tap to use." : "Phone case", act: "s" + i, off: !own && P.money < s[1] }); });
    Z.ui.menu(esc(pl.name), "Cases, top-ups, and a man who can fix any screen. <small>" + naira(P.money) + "</small>", items, function (it) { if (it.act === "rep") { Z.phone.replace(); return M.phones(pl); } if (it.act === "air") { P.money -= air.price; P.inv.airtime = (P.inv.airtime || 0) + 1; sfx("coin"); } else { var i = +it.act.slice(1); if (i && !P.flags["phone" + i]) { P.money -= skins[i][1]; P.flags["phone" + i] = 1; sfx("coin"); } P.phoneSkin = i; } M.phones(pl); }, function () { Z.api.hide(); });
  };
  // one wrong answer in a lecture is forgiven per booklet
  M.rescue = function (subject) { var P = Z.P; if (P && P.boost && P.boost[subject] > 0) { P.boost[subject]--; say("Your past-question booklet saved that one."); return true; } return false; };

  /* ---------- mall drawing: everything plain is merged into the room's one box mesh ---------- */
  var GOODS = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0x14b8a6, 0xf43f5e, 0xeab308, 0x64748b, 0xf8fafc];
  M.draw = function (x) {
    var T = x.T, g = x.g, bx = x.bx, c = x.c, r = c.room, i, j;
    // gallery slab, its face, stairs and rails
    bx(MW, .3, MD - GAL, 0xe7e5e4, 0, UP - .15, (GAL + MD) / 2); bx(17, UP - .3, .4, 0xd6d3d1, -13.5, (UP - .3) / 2, GAL); bx(17, UP - .3, .4, 0xd6d3d1, 13.5, (UP - .3) / 2, GAL);
    var steps = 14, sd = (GAL - R0) / steps; for (i = 0; i < steps; i++) bx(9.6, (i + 1) * UP / steps, sd + .02, i % 2 ? 0xa8a29e : 0xbfbab5, 0, (i + 1) * UP / steps / 2, R0 + (i + .5) * sd);
    for (i = -1; i <= 1; i += 2) { bx(.12, 1, 17, 0x57534e, i * 13.5, UP + .5, GAL, HP); bx(.1, .08, 17, 0xfbbf24, i * 13.5, UP + 1.02, GAL, HP); bx(.14, UP + 1.1, GAL - R0, 0x57534e, i * 5, (UP + 1.1) / 2, (R0 + GAL) / 2); }
    // court: benches, planters, floor inlay; fountain as real meshes
    bx(12, .02, 12, 0xfde68a, 0, .012, 14, Math.PI / 4); bx(8, .022, 8, 0xd6d3d1, 0, .014, 14, Math.PI / 4);
    [[-6, 8], [6, 8], [-6, 20], [6, 20]].forEach(function (p) { bx(1.8, .1, .6, 0x92400e, p[0], .46, p[1]); bx(.12, .46, .5, 0x44403c, p[0] - .7, .23, p[1]); bx(.12, .46, .5, 0x44403c, p[0] + .7, .23, p[1]); });
    [[-11, 4], [11, 4], [-11, 25], [11, 25], [-7, 36.5], [7, 36.5], [-12, 36.5], [12, 36.5]].forEach(function (p) { var b = p[1] > GAL ? UP : 0; bx(1, .7, 1, 0x78716c, p[0], b + .35, p[1]); bx(.8, .8, .8, 0x15803d, p[0], b + 1.1, p[1], .5); bx(.5, .5, .5, 0x16a34a, p[0], b + 1.7, p[1], .2); });
    var basin = new T.Mesh(x.own(new T.CylinderGeometry(2.5, 2.7, .7, 24)), x.lam(0xa8a29e)); basin.position.set(0, .35, 14); g.add(basin); c.water = new T.Mesh(x.own(new T.CircleGeometry(2.3, 24)), x.flat(0x38bdf8)); c.water.rotation.x = -HP; c.water.position.set(0, .72, 14); g.add(c.water); c.jet = new T.Mesh(x.own(new T.CylinderGeometry(.08, .3, 2.4, 8)), x.flat(0xbae6fd)); c.jet.position.set(0, 1.9, 14); g.add(c.jet);
    var sky = new T.Mesh(x.own(new T.PlaneGeometry(18, 30)), x.flat(0xbfe3ff)); sky.rotation.x = HP; sky.position.set(0, r.h - .03, 22); g.add(sky); for (i = 0; i < 6; i++) bx(18, .12, .2, 0x57534e, 0, r.h - .1, 9.5 + i * 5);
    var up = x.own(new T.PointLight(0xfff1d6, 8, 46, 1.1)); up.position.set(0, UP + 4.5, 44); g.add(up);
    if (r.stall) { bx(3, .9, 1.6, 0x92400e, -8, .45, 20); bx(3.4, .1, 2.4, 0xdc2626, -8, 2.5, 20); bx(.1, 2.5, .1, 0x44403c, -9.5, 1.25, 19); bx(.1, 2.5, .1, 0x44403c, -6.5, 1.25, 19); for (i = 0; i < 6; i++) bx(.36, .26, .36, GOODS[i], -9.1 + i * .44, 1.03, 20); }
    var dir = x.canvasPlate(1.6, 1.1, function (cx, W, H) { cx.fillStyle = "#1e293b"; cx.fillRect(0, 0, W, H); cx.fillStyle = "#fde047"; cx.textAlign = "center"; cx.font = "900 56px system-ui, sans-serif"; cx.fillText("KANTI MALL", W / 2, 90); cx.fillStyle = "#fff"; cx.font = "600 30px system-ui, sans-serif"; cx.fillText("15 stores · arcade · club", W / 2, 150); cx.fillText("stairs to the gallery ↑", W / 2, 200); }, 512); dir.position.set(0, 1.6, 9.2); dir.rotation.y = Math.PI; g.add(dir); bx(.12, 1.1, .12, 0x334155, 0, .55, 9.25);
    // stores
    M.STORES.forEach(function (st) {
      var f = st.f, b = f.base, hw = f.wide ? 4.3 : 3;
      function ub(wu, h, dv, col, u, upv, v) { var p = f.to(u, v); bx(f.swap ? dv : wu, h, f.swap ? wu : dv, col, p[0], b + upv, p[1]); }
      ub(.2, 3.6, 8, 0xe7e5e4, -hw, 1.8, 4); ub(.2, 3.6, 8, 0xe7e5e4, hw, 1.8, 4); ub(hw * 2, .5, .3, st.open ? st.col : 0x57534e, 0, 3.35, .1); ub(hw * 2, .03, 8, st.open ? 0xfafaf9 : 0xa8a29e, 0, .02, 4);
      if (!st.open) { ub(hw * 2, 3.1, .12, 0x78716c, 0, 1.55, .15); for (i = 0; i < 6; i++) ub(hw * 2, .04, .14, 0x57534e, 0, .5 + i * .5, .13); return; }
      var sg = x.canvasPlate(hw * 1.7, .46, function (cx, W, H) { cx.fillStyle = "#" + ("000000" + st.col.toString(16)).slice(-6); cx.fillRect(0, 0, W, H); cx.fillStyle = "#fff"; cx.textAlign = "center"; var fs = Math.floor(H * .72); do { cx.font = "900 " + fs + "px system-ui, sans-serif"; fs -= 3; } while (cx.measureText(st.sign).width > W - 30 && fs > 14); cx.textBaseline = "middle"; cx.fillText(st.sign, W / 2, H / 2 + 4); }, 1024), sp = f.to(0, -.12); sg.position.set(sp[0], b + 3.36, sp[1]); sg.rotation.y = f.swap ? (f.face === 0 ? HP : -HP) : Math.PI; g.add(sg);
      ub(2, 1, .7, 0x57534e, -1.4, .5, 2.95); ub(2.2, .06, .9, 0xf5f5f4, -1.4, 1.03, 2.95); ub(.4, .3, .3, 0x1f2937, -1.9, 1.2, 2.95); // counter and till
      function shelf(u, v, w, rows, cols, pal, sz) { ub(w, rows * .55 + .3, .5, 0xa16207, u, (rows * .55 + .3) / 2, v); for (i = 0; i < rows; i++) for (j = 0; j < cols; j++) ub(sz || .34, .36, .2, pal[(i * 3 + j) % pal.length], u - w / 2 + (j + .5) * w / cols, .38 + i * .55, v - .28); }
      function rail(u, v, n, pal, len) { ub(n * .32 + .3, .06, .06, 0x9ca3af, u, 1.7, v); ub(.06, 1.7, .06, 0x9ca3af, u - n * .16 - .1, .85, v); ub(.06, 1.7, .06, 0x9ca3af, u + n * .16 + .1, .85, v); for (i = 0; i < n; i++) ub(.26, len || .9, .34, pal[i % pal.length], u - n * .16 + i * .32 + .16, 1.66 - (len || .9) / 2, v); }
      function dummy(u, v, top) { ub(.3, .08, .3, 0x44403c, u, .04, v); ub(.06, .9, .06, 0x9ca3af, u, .5, v); ub(.44, .62, .26, top, u, 1.26, v); ub(.2, .22, .2, 0xe7e5e4, u, 1.7, v); }
      function table(u, v, col) { ub(1.2, .06, 1.2, col || 0xb7791f, u, .76, v); ub(.12, .76, .12, 0x57534e, u, .38, v); }
      var id = st.id;
      if (id === "mk_supermarket") { for (var a = 0; a < 2; a++) { ub(.7, 1.5, 3.4, 0xe2e8f0, .6 + a * 1.6, .75, 5); for (i = 0; i < 3; i++) for (j = 0; j < 6; j++) { ub(.1, .3, .4, GOODS[(i + j + a) % 10], .6 + a * 1.6 - .4, .35 + i * .5, 3.6 + j * .55); ub(.1, .3, .4, GOODS[(i * 2 + j + a) % 10], .6 + a * 1.6 + .4, .35 + i * .5, 3.6 + j * .55); } } shelf(0, 7.7, 5.4, 3, 12, GOODS); ub(1.2, .05, .5, 0x111827, -1.4, 1.07, 2.95); }
      else if (id === "mk_pharmacy") { shelf(0, 7.7, 5.4, 4, 14, [0xffffff, 0x99f6e4, 0xfecaca, 0xbfdbfe, 0xfef08a], .26); ub(1.2, .36, .08, 0x16a34a, 1.6, 2.6, 7.4); ub(.36, 1.2, .08, 0x16a34a, 1.6, 2.6, 7.4); ub(1.6, 1, .5, 0xf8fafc, 1.6, .5, 5); }
      else if (id === "mk_phones") { for (a = 0; a < 2; a++) { ub(2, .95, .7, 0xf8fafc, 1, .48, 4 + a * 1.8); ub(2, .04, .7, 0xbae6fd, 1, .97, 4 + a * 1.8); for (j = 0; j < 5; j++) ub(.2, .03, .34, [0x111827, 0xfbbf24, 0xe11d48, 0x2563eb, 0xf8fafc][j], .2 + j * .4, 1.01, 4 + a * 1.8); } shelf(0, 7.7, 5.4, 3, 9, [0x111827, 0x1e3a8a, 0xfbbf24, 0xf8fafc], .3); }
      else if (id === "mk_electronics") { for (j = 0; j < 3; j++) { ub(1.5, .9, .08, 0x0f172a, -1.7 + j * 1.7, 2, 7.4); ub(1.36, .76, .02, [0x38bdf8, 0x4ade80, 0xfb923c][j], -1.7 + j * 1.7, 2, 7.34); } ub(5.4, .7, .6, 0x334155, 0, .35, 7.4); for (j = 0; j < 4; j++) ub(.4, .9, .4, 0x1f2937, -2 + j * 1.3, .45, 5.4); ub(.5, .3, .4, 0xe2e8f0, 1.8, 1.05, 4); table(1.8, 4, 0xe2e8f0); }
      else if (id === "mk_fashion") { rail(1, 4.2, 8, [0xdb2777, 0xf472b6, 0x7c3aed, 0x0ea5e9, 0xfacc15, 0xf8fafc]); rail(1, 5.8, 8, [0x0f172a, 0xdc2626, 0x16a34a, 0xf59e0b]); dummy(2.5, 1.2, 0xdb2777); dummy(1.4, 1.2, 0x0ea5e9); shelf(0, 7.7, 5.4, 3, 8, [0xfce7f3, 0xdbeafe, 0xfef9c3, 0xdcfce7], .5); }
      else if (id === "mk_shoes") { for (i = 0; i < 4; i++) for (j = 0; j < 9; j++) { ub(.44, .05, .3, 0xe7e5e4, -2.4 + j * .6, .5 + i * .55, 7.35); ub(.3, .16, .22, [0x111827, 0x92400e, 0xf8fafc, 0xdc2626, 0x2563eb][(i + j) % 5], -2.4 + j * .6, .6 + i * .55, 7.35); } ub(1.6, .44, .5, 0x92400e, 1.4, .22, 4.6); ub(.5, .7, .06, 0xbae6fd, 2.6, .5, 4.6); }
      else if (id === "mk_native") { for (j = 0; j < 8; j++) ub(.3, 1.5, .3, [0x7c3aed, 0xf59e0b, 0x0f766e, 0xdc2626, 0x1d4ed8, 0xf8fafc, 0x15803d, 0xbe185d][j], -2.4 + j * .68, .95, 7.5); ub(5.4, .2, .5, 0xa16207, 0, .1, 7.5); table(1.6, 4.6, 0x8b5e34); ub(.5, .3, .22, 0x111827, 1.6, .95, 4.6); ub(.1, .34, .1, 0x9ca3af, 1.4, 1.1, 4.6); ub(.7, .03, .5, 0xf59e0b, 2, .81, 4.7); dummy(2.5, 1.2, 0xf8fafc); dummy(.6, 6, 0x7c3aed); }
      else if (id === "mk_books") { shelf(0, 7.7, 5.4, 4, 16, [0xb91c1c, 0x1d4ed8, 0x15803d, 0xa16207, 0x6d28d9, 0x0f766e], .28); ub(.5, 2, 3, 0xa16207, 2.6, 1, 5); for (i = 0; i < 3; i++) for (j = 0; j < 7; j++) ub(.2, .4, .3, GOODS[(i + j) % 10], 2.3, .4 + i * .6, 3.8 + j * .4); table(.8, 5, 0x92400e); for (j = 0; j < 4; j++) ub(.36, .08 + j * .05, .26, GOODS[j + 2], .5 + j * .22, .84, 5); }
      else if (id === "mk_eyewear") { for (j = 0; j < 3; j++) { ub(.7, 1.05, .7, 0xf8fafc, -.6 + j * 1.3, .53, 5); for (i = 0; i < 3; i++) ub(.4, .06, .1, [0x111827, 0x92400e, 0xdc2626][i], -.6 + j * 1.3, 1.12 + i * .02, 4.8 + i * .2); } ub(5.4, 1.4, .06, 0xbae6fd, 0, 1.9, 7.4); for (j = 0; j < 9; j++) ub(.4, .1, .08, 0x111827, -2.4 + j * .6, 1.4 + (j % 3) * .4, 7.32); }
      else if (id === "mk_sports") { rail(1.2, 5.8, 7, [0xdc2626, 0x16a34a, 0xf8fafc, 0x2563eb, 0xfacc15]); for (j = 0; j < 6; j++) ub(.36, .36, .36, [0xf97316, 0xf8fafc, 0xf97316, 0xfacc15, 0xf8fafc, 0xdc2626][j], -2.4 + j * .5, .7 + (j % 2) * .6, 7.4, 0); ub(5.4, .5, .5, 0x334155, 0, .25, 7.5); ub(.9, .16, .16, 0x111827, 1.6, .2, 4.2); ub(.2, .36, .36, 0x111827, 1.2, .2, 4.2); ub(.2, .36, .36, 0x111827, 2, .2, 4.2); dummy(2.5, 1.2, 0x16a34a); }
      else if (id === "mk_modest") { rail(1, 4.4, 8, [0x0f766e, 0x1e293b, 0x7c2d12, 0x6b21a8, 0xf5f5f4, 0xfda4af], 1.4); rail(1, 6, 8, [0x111827, 0x334155, 0x0f766e, 0x9f1239], 1.4); dummy(2.5, 1.2, 0x0f766e); dummy(1.4, 1.2, 0x6b21a8); shelf(0, 7.7, 5.4, 2, 8, [0xfda4af, 0x99f6e4, 0xfde68a, 0xddd6fe], .5); }
      else if (id === "mk_thrift") { rail(.8, 3.8, 9, GOODS); rail(.8, 5, 9, GOODS.slice(3)); rail(.8, 6.2, 9, GOODS.slice(5)); for (j = 0; j < 3; j++) { ub(.9, .6, .9, 0x92400e, -2 + j * 2, .3, 7.4); ub(.7, .2, .7, GOODS[j * 3], -2 + j * 2, .68, 7.4); } }
      else if (id === "mk_barber") { for (j = 0; j < 3; j++) { ub(.7, .5, .7, 0x111827, -2.6 + j * 2.6, .45, 5.6); ub(.7, .8, .14, 0x7f1d1d, -2.6 + j * 2.6, 1, 6); ub(.2, .4, .2, 0x9ca3af, -2.6 + j * 2.6, .2, 5.6); ub(1.4, 1.6, .06, 0xbae6fd, -2.6 + j * 2.6, 1.9, 7.4); ub(1.6, .08, .4, 0xf5f5f4, -2.6 + j * 2.6, 1, 7.2); } for (i = 0; i < 6; i++) ub(.2, .22, .2, [0xdc2626, 0xf8fafc, 0x1d4ed8][i % 3], 3.9, 1.2 + i * .22, .4); }
      else if (id === "mk_food") { ub(7.6, 1, .8, 0x7c2d12, 0, .5, 6.4); ub(7.8, .07, 1, 0xf5f5f4, 0, 1.04, 6.4); for (j = 0; j < 6; j++) { ub(.5, .26, .5, 0x94a3b8, -3 + j * 1.2, 1.2, 6.4); ub(.4, .04, .4, [0xf97316, 0xfde047, 0xb45309, 0xfef3c7, 0x84cc16, 0xdc2626][j], -3 + j * 1.2, 1.34, 6.4); } for (j = 0; j < 3; j++) { table(-.2 + j * 2.2, .8, 0xfbbf24); table(-.2 + j * 2.2, -1.6, 0xfbbf24); } ub(7.6, 1.2, .06, 0x1c1917, 0, 2.6, 7.4); for (j = 0; j < 4; j++) ub(1.5, .9, .02, [0xfde68a, 0xfed7aa, 0xbbf7d0, 0xfecaca][j], -2.7 + j * 1.8, 2.6, 7.36); }
      else if (id === "mk_gifts") { shelf(0, 7.7, 7.6, 3, 14, [0xe11d48, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7], .4); for (j = 0; j < 5; j++) { ub(.5, .5, .5, GOODS[j], .4 + j * .7, .25 + (j % 2) * .5, 5); ub(.54, .08, .08, 0xfef08a, .4 + j * .7, .52 + (j % 2) * .5, 5); } for (j = 0; j < 4; j++) { ub(.02, 1.2, .02, 0x9ca3af, 3 + j * .25, 1.6, 2); ub(.3, .36, .3, [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e][j], 3 + j * .25, 2.3 + (j % 2) * .2, 2); } }
    });
  };

  /* ---------- games arcade ---------- */
  function minis() { var m = Z.mini, l = []; try { l = m && m.list ? m.list() : []; } catch (e) {} return (l || []).map(function (g) { return typeof g === "string" ? { id: g, name: g.charAt(0).toUpperCase() + g.slice(1).replace(/[-_]/g, " ") } : { id: g.id, name: g.name || g.title || g.id }; }).filter(function (g) { return g.id && g.id !== "dance"; }); }
  M.play = function (id, c, k) { var m = Z.mini; if (!m || !m.open) { say("The screen says <b>OUT OF ORDER</b>. Somebody has written “since 2019” under it."); return false; } if (c) { c.playing = k; c.playT = 0; } try { m.open(id); } catch (e) { M.err = e; say("The cabinet eats your coin and stays dark."); return false; } return true; };
  K.ROOMS.arcade = function (pl) {
    var r = room(16, 14, 4.4, { floor: 0x1e1b4b, wall: 0x312e81, trim: 0xf59e0b }), gs = minis(), n = 6, i; r.cabs = [];
    for (i = 0; i < n; i++) { var left = i < 3, cx = left ? -7.3 : 7.3, cy = 4 + (i % 3) * 3.2, g = gs[i % Math.max(1, gs.length)] || null; r.solids.push({ x0: cx - .45, y0: cy - .5, x1: cx + .45, y1: cy + .5 }); r.cabs.push({ x: cx, y: cy, left: left, g: g, col: [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0x14b8a6][i] });
      (function (k, gm) { spot(r, "cab", cx + (left ? 1.3 : -1.3), cy, gm ? "Play " + gm.name : "Cabinet (out of order)", { r: 1.2, use: function (c) { if (gm) M.play(gm.id, c, k); else M.play("", null); } }); })(i, g); }
    item(r, "pingpong", 0, 8); spot(r, "note", 0, 10.2, "Watch the table tennis", { id: "arc_pp", text: "Best of three. Loser feeds the cabinet." });
    item(r, "counter", 0, 13, 0, { sx: .7 }); staff(r, 0, 13.6, -HP, 931, { look: { top: "#f59e0b" } }); item(r, "notice", 0, 13.88, 0, { text: "HIGH SCORES", sub: "1. MIB   2. RZR   3. YOU?" });
    var fans = []; for (i = 0; i < 4; i++) { fans.push({ x: -5.6 + (i % 2) * .7, y: 3.6 + i * .5, h: .9, a: Math.PI, seed: 950 + i, stand: 1, idle: "talk" }); r.crowd.push(fans[i]); }
    staff(r, -2.2, 8, 0, 941, { play: 1 }); staff(r, 2.2, 8, Math.PI, 942, { play: 1 });
    r.step = function (c, dt) { var k = c.playing == null ? 0 : c.playing, cb = r.cabs[k]; fans.forEach(function (p, j) { var tx = cb.x + (cb.left ? 1 : -1) * (2 + (j % 2) * .8), ty = cb.y + (j - 1.5) * .8; p.x += (tx - p.x) * Math.min(1, dt * 2); p.y += (ty - p.y) * Math.min(1, dt * 2); p.a = Math.atan2(cb.y - p.y, cb.x - p.x); p.idle = c.playing != null ? "talk" : "write"; }); };
    r.draw3 = function (x) { r.cabs.forEach(function (cb) { var s = cb.left ? 1 : -1; x.bx(.8, 1.9, .9, 0x0f172a, cb.x, .95, cb.y); x.bx(.1, 1.9, .9, cb.col, cb.x + s * .42, .95, cb.y); x.bx(.5, .3, .7, 0x1f2937, cb.x + s * .5, 1, cb.y); var scr = x.part(x.g, .04, .56, .66, cb.g ? cb.col : 0x1f2937, cb.x + s * .43, 1.5, cb.y, "b"); void scr; x.bx(.1, .12, .1, 0xef4444, cb.x + s * .6, 1.2, cb.y - .15); x.bx(.08, .1, .08, 0xfde047, cb.x + s * .6, 1.2, cb.y + .15); }); for (var k = 0; k < 5; k++) x.part(x.g, 15.6, .05, .08, [0xf472b6, 0x22d3ee, 0xfde047, 0xa78bfa, 0x4ade80][k], 0, 3.2 + k * .2, 13.95, "b"); };
    return r;
  };

  /* ---------- the club and its rhythm game ---------- */
  K.ROOMS.dance = function (pl) {
    var r = room(18, 18, 5.2, { floor: 0x18181b, wall: 0x27272a, trim: 0xa21caf }), i, hi = !(Z.r3 && Z.r3.quality === "low");
    item(r, "counter", 0, 16.6, 0, { sx: 1.1 }); staff(r, 0, 17.3, -HP, 961, { look: { hair: "cap", hairCol: "#f8fafc", top: "#a21caf" }, dance: 1, opt: { scale: 1.1 } });
    item(r, "sofa", -8, 4, HP); item(r, "sofa", 8, 4, HP); item(r, "counter", 7.6, 12, HP, { sx: .6 }); staff(r, 8.4, 12, Math.PI, 963, { look: { top: "#f8fafc" } });
    for (i = 0; i < (hi ? 22 : 12); i++) { var a = hash(i, 9) * TAU, d = 1.2 + hash(i, 8) * 3.6; r.crowd.push({ x: Math.cos(a) * d, y: 9.5 + Math.sin(a) * d * .9, h: .9, a: a + Math.PI, seed: 970 + i, stand: 1, dance: 1 }); }
    for (i = 0; i < (hi ? 3 : 0); i++) person(r, -3 + i * 3, 6.2, HP, 981 + i * 7, { dance: 1 });
    spot(r, "dance", 0, 5, "Dance (rhythm game)", { r: 2.2, use: function (c) { M.danceStart(c); } }); spot(r, "menu", 6.4, 12, "Drinks", { r: 1.5, use: function () { var b = place("buka") || place("shinkafi"); if (b) Z.ui.place(b); } });
    spot(r, "note", -8, 6.2, "Read the wall", { id: "club_wall", text: "Scratched into the paint: <i>“The DJ takes requests. The DJ ignores requests.”</i>" });
    r.beat = 110 / 60 * Math.PI; r.club = 1; r.onEnter = function () { try { Z.api.music(window.Arcade.song(733, "afro", { bpm: 110, scale: "minor" })); if (!Z.api.sound.muted) say("♪ <b>Club Night</b>"); } catch (e) {} };
    r.draw3 = function (x) { var T = x.T, c = x.c; c.beat = r.beat; c.tiles = new T.InstancedMesh(x.own(new T.BoxGeometry(1.46, .06, 1.46)), x.own(new T.MeshBasicMaterial({ color: 0xffffff })), 36); c.tiles.frustumCulled = false; var d = new T.Object3D(); for (var k = 0; k < 36; k++) { d.position.set(-3.75 + (k % 6) * 1.5, .04, 5.75 + Math.floor(k / 6) * 1.5); d.updateMatrix(); c.tiles.setMatrixAt(k, d.matrix); c.tiles.setColorAt(k, new T.Color(0x222222)); } x.g.add(c.tiles);
      x.bx(3.4, 1.2, 1, 0x3f3f46, 0, .6, 16.6); x.bx(.9, .1, .9, 0x111827, -.8, 1.26, 16.6); x.bx(.9, .1, .9, 0x111827, .8, 1.26, 16.6); x.bx(1.2, 2.4, 1, 0x09090b, -4, 1.2, 17.2); x.bx(1.2, 2.4, 1, 0x09090b, 4, 1.2, 17.2);
      c.spots = []; var n = Z.r3 && Z.r3.quality === "low" ? 1 : 3; for (k = 0; k < n; k++) { var l = x.own(new T.PointLight(0xff00ff, 7, 20, 1.3)); l.position.set(-5 + k * 5, 4.2, 9); x.g.add(l); c.spots.push(l); } };
    r.step3 = function (c) { var T = Z.r3.kit.T, b = Math.floor(c.t * r.beat / Math.PI), pal = [0xe11d48, 0x22d3ee, 0xfde047, 0xa855f7, 0x4ade80, 0xfb923c]; if (b !== c.lastBeat) { c.lastBeat = b; var col = new T.Color(); for (var k = 0; k < 36; k++) c.tiles.setColorAt(k, col.set((k + b + Math.floor(k / 6)) % 3 === 0 ? pal[(k + b) % 6] : 0x1f1f23)); c.tiles.instanceColor.needsUpdate = true; (c.spots || []).forEach(function (l, i) { l.color.set(pal[(b + i * 2) % 6]); }); } };
    r.step = function (c, dt) { M.danceStep(c, dt); };
    return r;
  };
  var DIRS = ["left", "up", "right", "down"], ARROW = ["←", "↑", "→", "↓"];
  M.danceStart = function (c) {
    var P = Z.P; if (M.dance) return; if (Z.mini && Z.mini.open && (function () { try { return (Z.mini.list() || []).some(function (g) { return (g.id || g) === "dance"; }); } catch (e) { return false; } })()) { try { Z.mini.open("dance"); return; } catch (e) {} }
    var bpm = 110, beat = 60 / bpm, len = 72, notes = [], t = 2.4, k = 0; while (t < len - 2) { notes.push({ t: t, d: Math.floor(hash(k, P.day + 31) * 4), s: 0 }); t += beat * (hash(k, 77) < .3 && t > 20 ? 1 : 2); k++; }
    M.dance = { t: 0, len: len, notes: notes, score: 0, streak: 0, best: 0, hits: 0, miss: 0, x: Z.me.x, y: Z.me.y, a: Z.me.a, flash: "", ft: 0, cheer: 0 }; sfx("power"); say("<b>On the floor!</b> Press the arrow that reaches the line: " + (Z.touch && Z.touch.active ? "tap the pads" : "arrow keys or WASD") + ".");
  };
  M.danceHit = function (dir) {
    var g = M.dance; if (!g) return 0; var best = null, bd = .22; g.notes.forEach(function (n) { var e = Math.abs(n.t - g.t); if (!n.s && n.d === dir && e < bd) { bd = e; best = n; } });
    if (!best) { g.streak = 0; g.flash = "miss"; g.ft = .4; return 0; } best.s = 1; g.hits++; g.streak++; g.best = Math.max(g.best, g.streak); var pts = (bd < .08 ? 100 : 60) + Math.min(g.streak, 20) * 5; g.score += pts; g.flash = bd < .08 ? "PERFECT" : "good"; g.ft = .4; sfx("coin");
    if (g.streak && g.streak % 10 === 0) { g.cheer = 1.5; var pals = Z.npcs.filter(function (n) { return n.follow || n.lead; }); say(pals.length ? "<b>" + esc(pals[0].def.name) + "</b> is screaming your name. Streak " + g.streak + "!" : "The floor opens a circle for you. Streak " + g.streak + "!"); } return pts;
  };
  M.danceStep = function (c, dt) {
    var g = M.dance, me = Z.me, P = Z.P, api = Z.api; if (!g) return; g.t += dt; g.ft = Math.max(0, g.ft - dt); g.cheer = Math.max(0, g.cheer - dt);
    me.x = g.x; me.y = g.y; me.cs = 0; me.emote = g.cheer > 0 ? "cheer" : "dance"; me.emoteT = 2; me.sit = false; // you stay on your tile and dance; the keys are the game
    for (var i = 0; i < 4; i++) if (api.hit && api.hit(DIRS[i])) M.danceHit(i);
    g.notes.forEach(function (n) { if (!n.s && g.t - n.t > .22) { n.s = 2; g.miss++; g.streak = 0; } });
    if (g.t >= g.len || (api.hit && api.hit("act") && g.t > 3)) M.danceEnd(c);
  };
  M.danceEnd = function (c) {
    var g = M.dance, P = Z.P; if (!g) return; M.dance = null; Z.me.emote = ""; var total = g.hits + g.miss, acc = total ? g.hits / total : 0, today = P.flags.danceDay === P.day ? P.flags.danceN || 0 : 0, paid = today < (P.flags.pass_social ? 5 : 3), xp = paid ? Math.round(Math.min(70, 10 + g.score / 220)) : 0;
    if (paid) { P.flags.danceDay = P.day; P.flags.danceN = today + 1; var lv = S.addXp(P, xp); P.skills.charm = (P.skills.charm || 0) + (acc > .6 ? 1 : .4); P.stats.dances = (P.stats.dances || 0) + 1; if (lv > 0 && Z.levelUp) Z.levelUp(); }
    P.flags.danceBest = Math.max(P.flags.danceBest || 0, g.score); sfx(acc > .6 ? "win" : "click"); if (Z.emit) Z.emit({ t: "emote", emote: "dance", place: "mk_dance" });
    say("<b>" + (acc > .85 ? "The floor is yours." : acc > .6 ? "Clean moves." : acc > .3 ? "You kept the beat, mostly." : "Two left feet tonight.") + "</b> Score " + g.score.toLocaleString() + " · best streak " + g.best + " · " + Math.round(acc * 100) + "% on the beat" + (paid ? " · +" + xp + " XP, people will remember this" : " · no more XP today, but the floor still loves you") + "."); M.last = { score: g.score, acc: acc, xp: xp, paid: paid };
  };
  M.danceDraw = function (x) { // the note lanes, on the HUD canvas
    var g = M.dance; if (!g) return; var X0 = 330, W = 300, Y1 = 400, i; x.save(); x.fillStyle = "rgba(9,9,11,.55)"; x.fillRect(X0, 120, W, 320); x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(X0, Y1 - 2, W, 4); x.textAlign = "center"; x.textBaseline = "middle";
    for (i = 0; i < 4; i++) { x.fillStyle = "rgba(255,255,255,.16)"; x.fillRect(X0 + i * 75 + 6, Y1 - 26, 63, 52); x.fillStyle = "rgba(255,255,255,.5)"; x.font = "900 30px system-ui, sans-serif"; x.fillText(ARROW[i], X0 + i * 75 + 37, Y1); }
    g.notes.forEach(function (n) { var dy = (n.t - g.t) * 150; if (n.s === 1 || dy > 290 || dy < -40) return; x.fillStyle = n.s === 2 ? "#52525b" : ["#f472b6", "#22d3ee", "#fde047", "#4ade80"][n.d]; x.beginPath(); x.arc(X0 + n.d * 75 + 37, Y1 - dy, 24, 0, TAU); x.fill(); x.fillStyle = "#09090b"; x.font = "900 28px system-ui, sans-serif"; x.fillText(ARROW[n.d], X0 + n.d * 75 + 37, Y1 - dy + 1); });
    x.fillStyle = "#fff"; x.font = "800 16px system-ui, sans-serif"; x.fillText("SCORE " + g.score.toLocaleString() + "   STREAK " + g.streak + "   " + Math.max(0, Math.ceil(g.len - g.t)) + " s", X0 + W / 2, 136); if (g.ft > 0) { x.font = "900 26px system-ui, sans-serif"; x.fillStyle = g.flash === "miss" ? "#fca5a5" : "#fde047"; x.fillText(g.flash.toUpperCase(), X0 + W / 2, 168); } x.restore();
  };
  var oDraw = Z.draw; if (oDraw) Z.draw = function () { var r = oDraw.apply(Z, arguments); try { if (M.dance && Z.api && Z.api.x) M.danceDraw(Z.api.x); } catch (e) {} return r; };
  var oPr = Z.prompt; if (oPr) Z.prompt = function () { return M.dance ? (M.dance.t > 3 ? "Stop dancing" : "") : oPr.apply(Z, arguments); };
  var oClick = Z.click; Z.click = function (x, y) { if (M.dance && y > 330 && x >= 330 && x <= 630) { M.danceHit(Math.min(3, Math.floor((x - 330) / 75))); return; } return oClick ? oClick.apply(Z, arguments) : undefined; };

  /* ---------- MIB Store ---------- */
  K.ROOMS.mib = function (pl) {
    var r = room(14, 12, 4.6, { floor: 0xfafaf9, wall: 0xffffff, trim: 0xd4a017 }), i;
    item(r, "counter", 3.4, 9.4, 0, { sx: .7 }); person(r, 3.4, 10.2, -HP, 1001, { look: { top: "#ffffff", pants: "#1c1917", hair: "low" }, opt: { scale: 1.08 } }); r.staffAt = { x: 3.4, y: 10.2, a: -HP };
    r.solids.push({ x0: -6.9, y0: 3, x1: -6.2, y1: 9 }, { x0: 6.2, y0: 2.6, x1: 6.9, y1: 7 }, { x0: -1, y0: 5.6, x1: 1, y1: 7.2 }, { x0: -5.2, y0: 10.9, x1: -1.2, y1: 11.9 });
    for (i = 0; i < 3; i++) r.crowd.push({ x: -5.4, y: 3.8 + i * 2.2, h: .9, a: 0, seed: 1010 + i, stand: 1, idle: "write", top: i === 1 ? "#d4a017" : "#ffffff", legs: "#1c1917" });
    spot(r, "menu", 3.4, 8, "MIB Store counter", { r: 1.6, use: function () { M.mib(pl); } });
    spot(r, "story", -3.2, 10, "Read the maker's wall", { r: 1.8, use: function () { var h = (D.HALL || []).filter(function (q) { return q.me; })[0]; say("<b>" + esc(D.CREATOR.full) + "</b><br>" + esc(h ? h.text : "The engineer behind everything you are standing in.")); } });
    spot(r, "case", 0, 4.8, "The signature case", { r: 1.6, use: function (c) { var P = Z.P; if (S.isHero && S.isHero(P)) { c.caseOpen = 1; if (!P.flags.in_mib_case) { P.flags.in_mib_case = 1; sfx("power"); } if (Z.egg) Z.egg("mib_case", "The glass slides back for you. Inside: the first sketch of this campus, signed <i>M.I. BUGAJE</i>."); else say("The glass slides back for you."); } else say("A locked glass case with a white-and-gold figure inside. A small plate reads: <i>“For the one who knows the code.”</i>"); } });
    spot(r, "note", 5.4, 4.8, "Look at the merchandise", { id: "mib_merch", text: (Z.resolveText || String)("{{GAME_INITIALS}}") + " mugs, caps, a tiny Tesla coil that really sparks, and a campus map printed on a scarf." });
    r.draw3 = function (x) { var T = x.T, G = 0xd4a017, bx = x.bx;
      bx(13.6, .04, .5, G, 0, .03, 1.2); bx(.5, .04, 10, G, 0, .03, 6.2); // gold inlay
      for (var k = 0; k < 2; k++) { bx(.06, .06, 5.6, G, -6.5, 1.8, 6); for (var j = 0; j < 12; j++) bx(.34, 1, .3, j % 3 === 1 ? G : j % 3 ? 0xffffff : 0x1c1917, -6.5, 1.28, 3.4 + j * .46); } bx(.1, 1.8, .1, G, -6.5, .9, 3.2); bx(.1, 1.8, .1, G, -6.5, .9, 8.8);
      bx(.6, 3, 4.4, 0xfafaf9, 6.6, 1.5, 4.8); for (k = 0; k < 3; k++) for (j = 0; j < 6; j++) bx(.3, .3, .3, [G, 0xffffff, 0x1c1917, 0xf59e0b][(k + j) % 4], 6.2, .7 + k * .8, 3 + j * .7); for (k = 0; k < 3; k++) bx(.3, .04, 4.2, G, 6.3, .5 + k * .8, 4.8);
      bx(2, .9, 1.6, 0xffffff, 0, .45, 6.4); bx(2.1, .06, 1.7, G, 0, .93, 6.4); bx(.5, .7, .3, 0xffffff, 0, 1.6, 6.4); bx(.24, .26, .24, 0x6b4226, 0, 2.1, 6.4); bx(.3, .1, .3, 0xffffff, 0, 2.28, 6.4); bx(.56, .1, .34, G, 0, 1.26, 6.4); bx(.2, .5, .2, 0x1c1917, -.12, 1, 6.4); bx(.2, .5, .2, 0x1c1917, .12, 1, 6.4);
      x.c.glass = new T.Mesh(x.own(new T.BoxGeometry(1.5, 1.8, 1.2)), x.own(new T.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: .22, depthWrite: false }))); x.c.glass.position.set(0, 1.86, 6.4); x.g.add(x.c.glass);
      var h = (D.HALL || []).filter(function (q) { return q.me; })[0], wall = x.canvasPlate(4, 2.2, function (cx, W, H) { cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, W, H); cx.strokeStyle = "#d4a017"; cx.lineWidth = 14; cx.strokeRect(10, 10, W - 20, H - 20); cx.fillStyle = "#d4a017"; cx.textAlign = "center"; cx.font = "900 86px system-ui, sans-serif"; cx.fillText("M · I · B", W / 2, 120); cx.fillStyle = "#1c1917"; cx.font = "800 40px system-ui, sans-serif"; cx.fillText(D.CREATOR.full, W / 2, 186); cx.font = "500 27px system-ui, sans-serif"; cx.fillStyle = "#44403c"; var ws = (h ? h.text : (Z.resolveText || String)("Engineer. Maker of {{GAME_INITIALS}} and EE Hub.")).split(" "), ln = "", y = 250; for (var q = 0; q < ws.length && y < H - 40; q++) { if (cx.measureText(ln + ws[q]).width > W - 120 && ln) { cx.fillText(ln, W / 2, y); y += 36; ln = ""; } ln += ws[q] + " "; } if (y < H - 30) cx.fillText(ln, W / 2, y); }, 1024); wall.position.set(-3.2, 2.2, 11.84); wall.rotation.y = Math.PI; x.g.add(wall);
      var logo = x.canvasPlate(3, .8, function (cx, W, H) { cx.fillStyle = "#1c1917"; cx.fillRect(0, 0, W, H); cx.fillStyle = "#d4a017"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.font = "900 92px system-ui, sans-serif"; cx.fillText("MIB STORE", W / 2, H / 2 + 6); }, 512); logo.position.set(3.4, 3.2, 11.84); logo.rotation.y = Math.PI; x.g.add(logo); };
    r.step3 = function (c) { if (c.glass) c.glass.visible = !c.caseOpen; };
    return r;
  };

  /* ---------- MIB Store stock: what the game can honour today works; the rest says plainly that it comes with the story ---------- */
  M.SHIRT_COLS = [["White", "#ffffff"], ["Gold", "#d4a017"], ["Black", "#1c1917"], ["Green", "#15803d"], ["Royal blue", "#1d4ed8"], ["Wine", "#7f1d1d"]];
  M.SHIRT_TEXT = ["MIB", "{{GAME_INITIALS}}", "EE HUB", "FRESHER", "NO LIGHT, NO PROBLEM", "UP NEPA!", "ENGINEER LOADING", "KANTI TO THE WORLD"];
  M.MIB = [
    { id: "shirt", sec: "Custom", label: "Custom shirt", price: 2500, sub: "Pick the colour and the print. The colour shows on you now; the print is on your profile until the fitting-room update." },
    { id: "x_cap", sec: "Only here", label: "White-and-gold cap", price: 2000, sub: "Collectible. People notice (+charm)." }, { id: "x_mug", sec: "Only here", label: (Z.resolveText || String)("{{GAME_INITIALS}} mug"), price: 1200, sub: "Collectible for your desk." }, { id: "x_coil", sec: "Only here", label: "Desk Tesla coil that really sparks", price: 6000, sub: "Collectible. +1 brain: you keep staring at it." }, { id: "x_scarf", sec: "Only here", label: "Campus-map scarf", price: 3500, sub: "Collectible. Shows the kola nuts on your map." },
    { id: "phone", sec: "Phones", label: "MIB Phone, gold edition", price: 18000, sub: "Gold case on your phone." },
    { id: "ride_bike", sec: "Rides", label: "MIB Edition bicycle", price: 9000, sub: "White and gold. Delivered to your hostel. Yours for good.", ride: "bike" }, { id: "ride_scooter", sec: "Rides", label: "MIB Edition scooter", price: 25000, sub: "Delivered to your hostel. Needs the scooter licence to ride.", ride: "scooter" }, { id: "ride_car", sec: "Rides", label: "MIB Edition car", price: 120000, sub: "Delivered to your hostel. Needs the car licence to drive.", ride: "car" },
    { id: "pass_library", sec: "Passes", label: "Library late pass", price: 2500, sub: "The Library never closes for you." }, { id: "pass_social", sec: "Passes", label: "Social pass", price: 3000, sub: "Social Centre open till 02:00, and five paid dances a day at the club instead of three." }, { id: "pass_queue", sec: "Passes", label: "Skip-the-queue pass", price: 3500, sub: "Walk into a lecture right up to its last minutes and still be counted." }, { id: "pass_shuttle", sec: "Passes", label: "Shuttle pass", price: 4000, sub: "COMING WITH THE STORY: free shuttle rides. Buy now, it starts working when the shuttle office opens.", later: 1 },
    { id: "tk_concert", sec: "Tickets", label: "Concert night ticket", price: 3000, sub: "COMING WITH THE STORY: keep it safe; the date is announced on Campus Radio.", later: 1 }, { id: "tk_final", sec: "Tickets", label: "Football final ticket", price: 2500, sub: "COMING WITH THE STORY: the final is played later in the semester.", later: 1 }
  ];
  M.has = function (id) { var P = Z.P; return !!(P && P.flags && P.flags["mib_" + id]); };
  M.deliver = function (type) { // an MIB Edition machine parked at your hostel, free to use for good
    var P = Z.P, hm = Z.place("@home"); if (!hm || !Z.cars || Z.cars.some(function (c) { return c.mib === type; })) return false; var k = { bike: 0, scooter: 1, car: 2 }[type] || 0, f = S.push(Z.W, hm.mx + 5 + k * 2.6, hm.my - 4, 1.2);
    Z.cars.push({ id: "mib_" + type, type: type, x: f.x, y: f.y, a: 0, vx: 0, vy: 0, speed: 0, col: "#f8f5e6", hx: f.x, hy: f.y, ha: 0, free: true, paid: true, mib: type }); return true;
  };
  M.buy = function (it, opt) {
    var P = Z.P; if (P.money < it.price) return false; if (M.has(it.id) && it.id !== "shirt") return false; P.money -= it.price; P.flags["mib_" + it.id] = 1; sfx("coin");
    if (it.id === "shirt") { P.mib = P.mib || {}; P.mib.shirt = { col: opt.col, text: opt.text, on: 1 }; }
    else if (it.id === "x_cap") P.skills.charm = (P.skills.charm || 0) + 2; else if (it.id === "x_coil") P.skills.brain = (P.skills.brain || 0) + 1; else if (it.id === "x_scarf") P.flags.mappa = 1;
    else if (it.id === "phone") { P.flags.phone1 = 1; P.phoneSkin = 1; }
    else if (it.ride) { P.flags["own_" + it.ride] = 1; M.deliver(it.ride); }
    else if (it.id === "pass_library") P.flags.pass_library = 1; else if (it.id === "pass_social") P.flags.pass_social = 1; else if (it.id === "pass_queue") P.flags.pass_queue = 1;
    if (Z.save) Z.save(); return true;
  };
  M.mib = function (pl) {
    var P = Z.P, W = Z.wardrobe, items = [], sec = "";
    if (W && W.editor) items.push({ label: "The MIB clothing line", sub: "Fitting room", act: "line", go: true });
    M.MIB.forEach(function (it) { var own = M.has(it.id) && it.id !== "shirt"; items.push({ label: (sec !== it.sec ? "[" + it.sec + "] " : "") + it.label + (own ? "" : " · " + naira(it.price)), sub: own ? "Yours." + (it.later ? " " + it.sub : "") : it.sub, act: it.id, off: own || P.money < it.price, it: it }); sec = it.sec; });
    if (P.mib && P.mib.shirt) items.push({ label: P.mib.shirt.on ? "Take off the custom shirt" : "Wear the custom shirt", sub: "“" + P.mib.shirt.text + "”", act: "wear" });
    Z.ui.menu("MIB Store", "White, gold, and nothing else. <small>" + naira(P.money) + "</small>", items, function (it) {
      if (it.act === "line") { try { W.editor("shop", { store: "mibstore", stock: W.stock ? W.stock("mibstore") : null, back: function () { M.mib(pl); } }); } catch (e) { M.err = e; M.mib(pl); } return; }
      if (it.act === "wear") { P.mib.shirt.on = P.mib.shirt.on ? 0 : 1; return M.mib(pl); }
      if (it.act === "shirt") return Z.ui.menu("Custom shirt: colour", naira(it.it.price), M.SHIRT_COLS.map(function (c, i) { return { label: c[0], act: "c" + i }; }), function (ci) { var col = M.SHIRT_COLS[+ci.act.slice(1)][1]; Z.ui.menu("Custom shirt: print", "What should it say?", M.SHIRT_TEXT.map(function (t, i) { return { label: (Z.resolveText || String)(t), act: "t" + i }; }), function (ti) { M.buy(it.it, { col: col, text: (Z.resolveText || String)(M.SHIRT_TEXT[+ti.act.slice(1)]) }); say("Printed while you wait. <b>“" + esc(P.mib.shirt.text) + "”</b>"); M.mib(pl); }, function () { M.mib(pl); }); }, function () { M.mib(pl); });
      if (M.buy(it.it)) say(it.it.ride ? "<b>" + esc(it.it.label) + "</b> is on its way to " + esc(Z.place("@home").name) + "." : it.it.later ? "<b>" + esc(it.it.label) + "</b> bought. It starts working later in the story." : "<b>" + esc(it.it.label) + "</b> is yours."); M.mib(pl);
    }, function () { Z.api.hide(); });
  };
  // machines you bought come back to your hostel whenever the game starts
  var oBeg = Z.begin; if (oBeg) Z.begin = function (p) { var r = oBeg.apply(Z, arguments); try { ["bike", "scooter", "car"].forEach(function (t) { if (p && p.flags && p.flags["mib_ride_" + t]) M.deliver(t); }); } catch (e) {} return r; };

  /* ---------- Sick Bay ---------- */
  K.ROOMS.sick = function (pl) {
    var r = room(18, 14, 4, { floor: 0xe2e8f0, wall: 0xf0fdfa, trim: 0x0d9488 }), i; r.beds = [];
    item(r, "counter", -4.5, 4.2, 0, { sx: .8 }); r.staffP = person(r, -4.5, 5.1, -HP, 1101, { look: { hair: "hijab", hairCol: "#ffffff", top: "#bae6fd", mode: "coat" }, opt: { scale: 1.1 } }); r.staffAt = { x: -4.5, y: 5.1, a: -HP };
    item(r, "sofa", -8, 2.2, HP); item(r, "plant", -8.2, 6.2); item(r, "notice", -8.88, 4.4, HP, { text: "SICK BAY", sub: "Eat. Sleep. Drink water. Come back less." });
    r.solids.push({ x0: -.2, y0: 2.6, x1: .2, y1: 14 }); // the ward wall
    for (i = 0; i < 6; i++) { var bxp = 2 + (i % 3) * 2.6, byp = i < 3 ? 12 : 6.2, occ = i === 1 || i === 3 || i === 5; item(r, "bed", bxp, byp, 0, { col: 0x99f6e4 }); r.beds.push({ x: bxp, y: byp, free: !occ }); if (occ) r.crowd.push({ x: bxp, y: byp - .1, h: .55, a: HP, seed: 1110 + i, lie: 1 }); }
    item(r, "cabinet", 8.4, 9, HP); item(r, "desk", -6, 12.6); item(r, "bed", -3, 11.5, 0, { col: 0xf8fafc }); item(r, "cabinet", -8.4, 12, HP); r.solids.push({ x0: -9, y0: 8.3, x1: -1.4, y1: 8.7 }); // treatment room partition
    for (i = 0; i < 2; i++) item(r, "window", 9, 5 + i * 5, HP);
    spot(r, "menu", -4.5, 2.9, "Reception", { r: 1.5 }); spot(r, "note", -3, 9.8, "Look into the treatment room", { id: "sick_room", text: "A scale that adds two kilos, an eye chart nobody can finish, and a jar of sweets <i>for brave patients only</i>." });
    spot(r, "token", 8, 8, "Check the supply cabinet", { id: "kola_sick", cash: 0, xp: 15, text: "Glucose biscuits, strictly for emergencies. This feels like one. +15 XP." });
    r.draw3 = function (x) { x.bx(.3, 4, 11.4, 0xccfbf1, 0, 2, 8.3); x.bx(7.6, 2.4, .12, 0xccfbf1, -5.2, 1.2, 8.5); for (var k = 0; k < 3; k++) x.bx(.06, 2, 1.6, 0x5eead4, 3.3 + k * 2.6, 1, 11.6); x.part(x.g, 1, .3, .06, 0xdc2626, -4.5, 3, .1, "b"); x.part(x.g, .3, 1, .06, 0xdc2626, -4.5, 3, .1, "b"); };
    return r;
  };
  // Wake up in a Sick Bay bed (after a knock-out, or when the campus patrol brings you in). Safe to call from anywhere.
  I.wake = function (id, line) {
    var pl = place(id || "sickbay") || place("sickbay"), me = Z.me; if (!pl || !Z.P) return false; if (I.cur) I.leaveNow(); I.trans = null; if (me.veh && Z.exit) Z.exit(true);
    me.x = pl.mx; me.y = pl.my; me.fall = 0; if (!I.goIn(pl)) return false; var c = I.cur, bed = (c.room.beds || []).filter(function (b) { return b.free; })[0];
    if (bed) { me.x = c.ox + bed.x; me.y = c.oy + bed.y; me.a = -HP; me.sit = true; me.emote = "sit"; me.emoteT = 1e9; c.seat = { x: bed.x, y: bed.y, h: .28, a: -HP }; c.stand = { x: c.ox + bed.x - 1.1, y: c.oy + bed.y }; c.wakeT = 2.2; }
    var text = line || "Easy. You are in the Sick Bay. Sit up slowly, drink this, and next time eat before you run."; if (Z.sub) Z.sub("hauwa", text, 6); else say("<b>Nurse Hauwa:</b> " + esc(text)); return true;
  };
  // For the side-mission system: bring an injured person in. Puts them in a free bed when you are inside the Sick Bay
  // (or marks them admitted and hides them if you are not). Returns true when a bed was found. Undo with I.discharge.
  I.admit = function (npc) { if (!npc) return false; var c = I.cur, bed = c && c.type === "sick" ? (c.room.beds || []).filter(function (b) { return b.free; })[0] : null; npc.admitted = Z.P ? Z.P.day : 1; npc.follow = false; npc.lead = false; if (bed) { bed.free = false; npc.x = npc.hx = c.ox + bed.x; npc.y = npc.hy = c.oy + bed.y; npc.sitIn = .3; if (c.moved.every(function (m) { return m.n !== npc; })) c.moved.push({ n: npc, x: c.out.x + 2, y: c.out.y, hx: npc.hx0 || npc.hx, hy: npc.hy0 || npc.hy, a: 0 }); return true; } npc.hidden = true; return false; };
  I.discharge = function (npc) { if (!npc) return; npc.admitted = 0; npc.hidden = false; npc.sitIn = null; };

  /* ---------- hostel TV and console: free play ---------- */
  var oHostel = K.ROOMS.hostel; K.ROOMS.hostel = function (pl) { var r = oHostel(pl); r.solids.push({ x0: 1.2, y0: .3, x1: 3, y1: .9 }); spot(r, "tv", 1.5, 1.6, "Play the console", { r: 1.1, use: function (c) { var g = minis(); if (g.length) M.play(g[Math.floor(Math.random() * g.length)].id, null); else M.play("", null); } }); var od = r.draw3; r.draw3 = function (x) { if (od) od(x); x.bx(1.8, .5, .5, 0x44403c, 2.1, .25, .6); x.bx(1.5, .9, .08, 0x0f172a, 2.1, 1.1, .5); x.part(x.g, 1.36, .76, .02, 0x38bdf8, 2.1, 1.1, .56, "b"); x.bx(.4, .08, .3, 0xf8fafc, 1.6, .54, .7); }; return r; };

  /* ---------- per-frame extras ---------- */
  var oU = Z.update; Z.update = function (dt) { var r = oU.apply(Z, arguments); try { var c = I.cur; if (M.dance && (!c || c.type !== "dance")) { M.dance = null; Z.me.emote = ""; } if (c && c.wakeT > 0) { c.wakeT -= dt; if (c.wakeT <= 0 && Z.me.sit && c.seat) { Z.me.sit = false; Z.me.emote = ""; Z.me.z = 0; Z.me.x = c.stand.x; Z.me.y = c.stand.y; c.seat = null; } } } catch (e) { if (!M.uerr) { M.uerr = e; if (typeof console !== "undefined") console.error(e); } } return r; };
})();
