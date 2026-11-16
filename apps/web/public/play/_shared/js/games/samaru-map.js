/* Freshers School Life — the full map.
   Open it with the map key or by tapping the minimap. Drag to pan (it keeps gliding), pinch or wheel to zoom, tap empty
   ground to drop a waypoint (tap the flag again to clear it), tap a marker for a card: what the place is, whether it
   is open, how far, "Set route" and, where a stop is close, "Shuttle here". A search box filters places as you type;
   the chips filter by kind; the "?" button explains every marker. One marker language (shape and colour) is shared
   with the minimap. Everything is drawn on the game canvas in its 960×540 space, so it scales with the stage; the
   only DOM is the search input. Runs headless too: Z.bigmap.tap(x, y) is what a tap does. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData;
  if (!Z || !S) return;
  var M = Z.bigmap = { k: 0, cx: 0, cy: 0, vx: 0, vy: 0, off: {}, q: "", sel: null, legend: false, hits: [], results: [] }, TAU = Math.PI * 2;
  /* ---------- the marker language ---------- */
  var CATS = [
    { id: "class", name: "Classes", col: "#a78bfa", sh: "diamond", says: "lecture theatres, departments, the library" },
    { id: "food", name: "Food", col: "#fb923c", sh: "circle", says: "somewhere to eat: fills FOOD and gives energy" },
    { id: "shop", name: "Shops", col: "#34d399", sh: "square", says: "a shop or a mall store: buy things here" },
    { id: "home", name: "Hostels", col: "#60a5fa", sh: "house", says: "yours is the bright one with a ring: sleep there" },
    { id: "fun", name: "Fun", col: "#f472b6", sh: "star", says: "sport, games, racing, flying, dancing" },
    { id: "garden", name: "Gardens", col: "#86efac", sh: "leaf", says: "gardens and the water: sit, meet, go on dates" },
    { id: "service", name: "Services", col: "#f87171", sh: "cross", says: "Sick Bay, bank, job board, mosque, chapel" },
    { id: "stop", name: "Shuttle", col: "#fde047", sh: "bus", says: "a stop: ride to any other stop for a small fare" },
    { id: "friend", name: "Friends", col: "#f9a8d4", sh: "heart", says: "a friend, wherever they are right now" },
    { id: "job", name: "Jobs", col: "#2dd4bf", sh: "tri", says: "where your current job is taking you" },
    { id: "mission", name: "Missions", col: "#facc15", sh: "bang", says: "your next story step or timetable entry" }
  ], CAT = {}; CATS.forEach(function (c) { CAT[c.id] = c; });
  var EXTRA = [["#22d3ee", "arrow", "you, pointing the way you face"], ["#ef4444", "flag", "your waypoint (tap it to clear). The yellow line leads there"], ["#c4b5fd", "ring", "your next class on the timetable"], ["#3b82f6", "tri", "security, while they are looking for you"], ["#22d3ee", "circle", "another player in your room"]];
  var FUN = { court: 1, social: 1, shinkafi: 1, club: 1, strip: 1, mk_arcade: 1, mk_dance: 1, mk_cinema: 1, theatre: 1 }, SERVICE = { sickbay: 1, bank: 1, gate: 1, mosque: 1, chapel: 1, p2mosque: 1, p2chapel: 1, radio: 1, fire: 1, senate: 1, checkpoint: 1 };
  M.catOf = function (p) {
    var d = p.def || p, r = p.role || d.role || "";
    if (r === "stop") return "stop"; if (r === "home") return "home"; if (FUN[p.id]) return "fun"; if (r === "class" || r === "lecture" || r === "dept") return "class";
    if (r === "food") return "food"; if (r === "shop" || r === "store") return "shop"; if (SERVICE[p.id] || r === "heal" || r === "bank" || r === "jobs") return "service";
    if (r === "race" || r === "air") return "fun"; if (d.zone === "garden" || d.zone === "lake" || /Garden|Dam/.test(p.name)) return "garden"; return "service";
  };
  // what the minimap and the map both draw for a place
  M.mark = function (p) { var c = CAT[M.catOf(p)], mine = Z.P && p.id === Z.P.home; return { x: p.mx, y: p.my, col: mine ? "#2563eb" : c.col, sh: c.sh, r: mine ? 5 : 4, ring: 0, mine: mine, cat: c.id }; };
  M.shape = function (x, px, py, sh, col, r) {
    r = r || 4; x.fillStyle = col; x.strokeStyle = "rgba(0,0,0,.75)"; x.lineWidth = 1.2; x.beginPath();
    if (sh === "square") x.rect(px - r * .85, py - r * .85, r * 1.7, r * 1.7);
    else if (sh === "diamond") { x.moveTo(px, py - r * 1.25); x.lineTo(px + r * 1.1, py); x.lineTo(px, py + r * 1.25); x.lineTo(px - r * 1.1, py); x.closePath(); }
    else if (sh === "house") { x.moveTo(px, py - r * 1.3); x.lineTo(px + r * 1.15, py - r * .2); x.lineTo(px + r * .85, py - r * .2); x.lineTo(px + r * .85, py + r); x.lineTo(px - r * .85, py + r); x.lineTo(px - r * .85, py - r * .2); x.lineTo(px - r * 1.15, py - r * .2); x.closePath(); }
    else if (sh === "star" || sh === "bang") { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .55 : r * 1.35; if (i) x.lineTo(px + Math.cos(a) * q, py + Math.sin(a) * q); else x.moveTo(px + Math.cos(a) * q, py + Math.sin(a) * q); } x.closePath(); }
    else if (sh === "leaf") { x.moveTo(px, py - r * 1.3); x.quadraticCurveTo(px + r * 1.5, py - r * .2, px, py + r * 1.3); x.quadraticCurveTo(px - r * 1.5, py - r * .2, px, py - r * 1.3); }
    else if (sh === "cross") { var t = r * .42; x.moveTo(px - t, py - r * 1.15); x.lineTo(px + t, py - r * 1.15); x.lineTo(px + t, py - t); x.lineTo(px + r * 1.15, py - t); x.lineTo(px + r * 1.15, py + t); x.lineTo(px + t, py + t); x.lineTo(px + t, py + r * 1.15); x.lineTo(px - t, py + r * 1.15); x.lineTo(px - t, py + t); x.lineTo(px - r * 1.15, py + t); x.lineTo(px - r * 1.15, py - t); x.lineTo(px - t, py - t); x.closePath(); }
    else if (sh === "bus") { if (x.roundRect) x.roundRect(px - r * 1.2, py - r * .9, r * 2.4, r * 1.8, r * .5); else x.rect(px - r * 1.2, py - r * .9, r * 2.4, r * 1.8); }
    else if (sh === "heart") { x.moveTo(px, py + r * 1.1); x.bezierCurveTo(px - r * 1.9, py - r * .2, px - r * .8, py - r * 1.5, px, py - r * .5); x.bezierCurveTo(px + r * .8, py - r * 1.5, px + r * 1.9, py - r * .2, px, py + r * 1.1); }
    else if (sh === "tri") { x.moveTo(px, py - r * 1.25); x.lineTo(px + r * 1.2, py + r); x.lineTo(px - r * 1.2, py + r); x.closePath(); }
    else if (sh === "flag") { x.rect(px - .8, py - r * 2.2, 1.6, r * 2.4); x.moveTo(px + .8, py - r * 2.2); x.lineTo(px + r * 1.7, py - r * 1.55); x.lineTo(px + .8, py - r * .9); x.closePath(); }
    else if (sh === "arrow") { x.moveTo(px + r * 1.5, py); x.lineTo(px - r, py - r); x.lineTo(px - r * .4, py); x.lineTo(px - r, py + r); x.closePath(); }
    else if (sh === "ring") { x.arc(px, py, r * 1.2, 0, TAU); x.lineWidth = 2.4; x.strokeStyle = col; x.stroke(); return; }
    else x.arc(px, py, r, 0, TAU);
    x.fill(); x.stroke();
    if (sh === "bus") { x.fillStyle = "#111827"; x.fillRect(px - r * .8, py - r * .45, r * 1.6, r * .5); }
  };

  /* ---------- view ---------- */
  function bounds() { return Z.W.bounds; }
  function fit() { var B = bounds(); return Math.min(900 / (B[2] - B[0]), 430 / (B[3] - B[1])); }
  function sx(wx) { return 480 + (wx - M.cx) * M.k; } function sy(wy) { return 300 + (wy - M.cy) * M.k; }
  function wx(px) { return M.cx + (px - 480) / M.k; } function wy(py) { return M.cy + (py - 300) / M.k; }
  function clampView() { var B = bounds(), k0 = fit(); M.k = Math.max(k0 * .85, Math.min(3.2, M.k)); M.cx = Math.max(B[0] - 300, Math.min(B[2] + 300, M.cx)); M.cy = Math.max(B[1] - 300, Math.min(B[3] + 300, M.cy)); }
  M.open = function () { var me = Z.me; M.k = Math.max(fit() * 1.9, .42); M.cx = me.x; M.cy = me.y; M.vx = M.vy = 0; M.sel = null; M.legend = false; M.q = ""; if (M.input) M.input.value = ""; clampView(); M.isOpen = true; };
  M.close = function () { M.isOpen = false; M.sel = null; if (M.input) { M.input.blur(); M.input.style.display = "none"; } if (Z.bigSet) Z.bigSet(false); };
  M.zoom = function (f, px, py) { var ax = wx(px == null ? 480 : px), ay = wy(py == null ? 300 : py); M.k *= f; clampView(); M.cx = ax - ((px == null ? 480 : px) - 480) / M.k; M.cy = ay - ((py == null ? 300 : py) - 300) / M.k; clampView(); };
  M.centre = function () { M.cx = Z.me.x; M.cy = Z.me.y; M.vx = M.vy = 0; clampView(); };

  /* ---------- what is on the map ---------- */
  function hour() { return Z.P.time / 60; }
  M.info = function (p) {
    var d = p.def || {}, r = p.role, h = hour(), open = true, hours = "", does = "";
    if (r === "class") { open = h >= 8 && h < (d.study ? 22 : 18); hours = "08:00 to " + (d.study ? "22:00" : "18:00"); does = d.study ? "Study sessions: questions for XP" : "Attend class: five questions for XP"; }
    else if (r === "lecture") { open = h >= 7 && h < 19; hours = "07:00 to 19:00"; does = "Lectures on your timetable are held here"; }
    else if (r === "dept") { open = h >= 8 && h < 17; hours = "08:00 to 17:00"; does = "A department: labs, staff, notice boards"; }
    else if (r === "food") does = "Buy food and drinks"; else if (r === "shop" || r === "store") { open = h >= 8 && h < 22; hours = "08:00 to 22:00"; does = d.text || "Buy things"; }
    else if (r === "home") does = Z.P.home === p.id ? "Your hostel: sleep, rest, change clothes, save" : "A hostel (not yours)"; else if (r === "stop") does = "Ride the shuttle to any other stop";
    else if (r === "heal") does = "See the nurse: full health"; else if (r === "bank") does = "Check for an alert from home"; else if (r === "jobs") does = "Job board, and vehicles to hire";
    else if (r === "race") does = "Race events and the garage"; else if (r === "air") does = "The Flying Club: hire the aircraft"; else does = d.text || "A place to visit";
    if (d.menu && r !== "food") does += " · food sold here";
    var me = Z.me, dist = Math.hypot(p.mx - me.x, p.my - me.y), stop = null, sd = 130; Z.placeList.forEach(function (q) { if (q.role !== "stop") return; var dd = Math.hypot(q.mx - p.mx, q.my - p.my); if (dd < sd) { sd = dd; stop = q; } });
    return { open: open, hours: hours, does: String(does).slice(0, 96), dist: dist, stop: stop };
  };
  function distText(d) { return d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d / 10) * 10 + " m"; }
  function shown(cat) { return !M.off[cat]; }
  function match(p) { return !M.q || p.name.toLowerCase().indexOf(M.q) >= 0; }
  // moving things: friends, job, mission, timetable, security, other players
  M.live = function () {
    var out = [], P = Z.P, st = Z.step ? Z.step() : null, tg = Z.target ? Z.target() : null;
    (Z.npcs || []).forEach(function (n) { if (n.hidden) return; var fr = P.friends && P.friends[n.id]; if (n.follow || fr >= 20) out.push({ x: n.x, y: n.y, cat: "friend", name: n.def.name, r: n.follow ? 5 : 4 }); });
    if (P.job) { var j = P.job, jp = j.stage === 0 ? j.a : j.b; if (jp && jp.x != null) out.push({ x: jp.mx != null ? jp.mx : jp.x, y: jp.my != null ? jp.my : jp.y, cat: "job", name: "Job: " + (jp.name || ""), r: 6, pulse: 1 }); }
    if (st && tg && tg !== Z.waypoint) out.push({ x: tg.x, y: tg.y, cat: "mission", name: tg.name || "Mission", r: 6.5, pulse: 1 });
    try { var nx = Z.life && Z.life.next ? Z.life.next() : null, np = nx && (nx.place ? Z.place(nx.place) : nx.at ? Z.place(nx.at) : null); if (np) out.push({ x: np.mx, y: np.my, col: "#c4b5fd", sh: "ring", name: "Next class: " + (nx.code || nx.name || np.name), r: 7, pulse: 1 }); } catch (e) {}
    var sc = P.sec; if (sc && (sc.state === "chase" || sc.state === "search")) (Z.guards || []).forEach(function (g) { out.push({ x: g.x, y: g.y, col: "#3b82f6", sh: "tri", name: "Security", r: 5 }); });
    var peers = Z.net && Z.net.peers || {}; Object.keys(peers).forEach(function (id) { var r = peers[id]; if (r.x != null) out.push({ x: r.x, y: r.y, col: "#22d3ee", sh: "circle", name: r.name || "Player", r: 4.5 }); });
    return out;
  };

  /* ---------- drawing ---------- */
  function rr(x, a, b, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); }
  function btn(x, id, a, b, w, h, label, on, o) { o = o || {}; rr(x, a, b, w, h, o.r == null ? 10 : o.r); x.fillStyle = o.bg || (on ? "rgba(34,211,238,.95)" : "rgba(15,23,42,.88)"); x.fill(); x.lineWidth = 1.5; x.strokeStyle = on ? "#a5f3fc" : "rgba(255,255,255,.28)"; x.stroke(); x.fillStyle = o.fg || (on ? "#04121a" : "#fff"); x.font = (o.font || "800 15px") + " system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, a + w / 2, b + h / 2 + 1); x.textBaseline = "alphabetic"; M.hits.push({ id: id, x: a, y: b, w: w, h: h, data: o.data }); }
  M.draw = function (x, t) {
    var W = Z.W, B = bounds(), me = Z.me, P = Z.P, G = window.SamaruDraw || Z.G, i, night = S.darkness ? S.darkness(P.time) : 0;
    if (!M.isOpen) M.open();
    // glide after a flick
    if (!M.drag && (Math.abs(M.vx) > .5 || Math.abs(M.vy) > .5)) { M.cx -= M.vx / M.k / 60; M.cy -= M.vy / M.k / 60; M.vx *= .92; M.vy *= .92; clampView(); }
    M.hits = [];
    x.save(); x.setLineDash([]); x.globalAlpha = 1; x.fillStyle = "#0b1620"; x.fillRect(0, 0, 960, 540);
    var mini = G && G.miniCanvas ? G.miniCanvas() : null;
    if (mini) { x.imageSmoothingEnabled = true; x.drawImage(mini, sx(B[0]), sy(B[1]), (B[2] - B[0]) * M.k, (B[3] - B[1]) * M.k); }
    else { x.fillStyle = "#86ae5a"; x.fillRect(sx(B[0]), sy(B[1]), (B[2] - B[0]) * M.k, (B[3] - B[1]) * M.k); }
    // beyond the paper: the wild
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.5; x.setLineDash([8, 6]); x.strokeRect(sx(B[0]), sy(B[1]), (B[2] - B[0]) * M.k, (B[3] - B[1]) * M.k); x.setLineDash([]);
    x.fillStyle = "rgba(134,174,90,.5)"; x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; [[(B[0] + B[2]) / 2, B[1] - 60], [(B[0] + B[2]) / 2, B[3] + 70], [B[0] - 120, (B[1] + B[3]) / 2], [B[2] + 120, (B[1] + B[3]) / 2]].forEach(function (q) { x.fillText("WILDERNESS", sx(q[0]), sy(q[1])); });
    if (night > .25) { x.fillStyle = "rgba(10,16,48," + (night * .42).toFixed(2) + ")"; x.fillRect(0, 0, 960, 540); }
    // road names when you are close in
    if (M.k > .75) { var seen = {}; x.font = "700 11px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; W.roads.forEach(function (r) { if (!r.n || r.k === "x" && M.k < 1.4) return; var p = r.p, m = Math.floor(p.length / 4) * 2, ax = p[m - 2 < 0 ? 0 : m - 2], ay = p[m - 2 < 0 ? 1 : m - 1], bx = p[m] == null ? p[p.length - 2] : p[m], by = p[m + 1] == null ? p[p.length - 1] : p[m + 1], px = sx((ax + bx) / 2), py = sy((ay + by) / 2); if (px < 0 || px > 960 || py < 70 || py > 540) return; var key = r.n + ":" + Math.round(px / 170) + ":" + Math.round(py / 90); if (seen[key]) return; seen[key] = 1; var an = Math.atan2(by - ay, bx - ax); if (an > Math.PI / 2) an -= Math.PI; if (an < -Math.PI / 2) an += Math.PI; x.save(); x.translate(px, py); x.rotate(an); x.strokeStyle = "rgba(255,255,255,.75)"; x.strokeText(r.n, 0, 4); x.fillStyle = "#334155"; x.fillText(r.n, 0, 4); x.restore(); }); }
    // the GPS line
    var route = Z.route; if (route && route.length > 3) { x.strokeStyle = "#facc15"; x.lineWidth = 4; x.lineJoin = "round"; x.beginPath(); for (i = 0; i < route.length; i += 2) { if (i) x.lineTo(sx(route[i]), sy(route[i + 1])); else x.moveTo(sx(route[i]), sy(route[i + 1])); } x.stroke(); }
    // places
    var pulse = 1 + Math.sin((t || 0) * 5) * .18, labelK = M.k > .55;
    M.results = [];
    Z.placeList.forEach(function (p) {
      var mk = M.mark(p), ok = shown(mk.cat), hit = match(p); if (M.q && hit && M.results.length < 6) M.results.push(p); if (!ok) return;
      var px = sx(p.mx), py = sy(p.my); if (px < -20 || px > 980 || py < -20 || py > 560) return;
      x.globalAlpha = M.q && !hit ? .22 : 1; var big = M.sel === p || (M.q && hit); if (mk.mine) { x.strokeStyle = "#93c5fd"; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 11, 0, TAU); x.stroke(); }
      M.shape(x, px, py, mk.sh, mk.col, (mk.r + 2.5) * (big ? 1.35 : 1));
      if ((labelK || big) && (p.role || big) && !(p.role === "stop" && M.k < 1 && !big)) { x.font = (big ? "800 13px" : "700 11px") + " system-ui, sans-serif"; x.textAlign = "left"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.8)"; var nm = p.name.replace(/^Shuttle stop: /, ""); x.strokeText(nm, px + 10, py + 4); x.fillStyle = "#fff"; x.fillText(nm, px + 10, py + 4); }
      x.globalAlpha = 1;
    });
    // friends, job, mission, next class, security, players
    M.liveNow = M.live(); M.liveNow.forEach(function (m) { var c = m.cat ? CAT[m.cat] : null; if (c && !shown(c.id)) return; var px = sx(m.x), py = sy(m.y); if (px < -20 || px > 980 || py < -20 || py > 560) return; M.shape(x, px, py, m.sh || c.sh, m.col || c.col, m.r * (m.pulse ? pulse : 1)); if (M.k > .9 || m.pulse) { x.font = "700 11px system-ui, sans-serif"; x.textAlign = "left"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.8)"; x.strokeText(m.name, px + 10, py + 4); x.fillStyle = "#fef9c3"; x.fillText(m.name, px + 10, py + 4); } });
    if (P.flags && P.flags.mappa) (Z.tokens || []).forEach(function (tk, n) { if (!P.tokens[n]) M.shape(x, sx(tk.x), sy(tk.y), "circle", "#7c2d12", 2.5); });
    // waypoint and you
    var wp = Z.waypoint; if (wp) { M.shape(x, sx(wp.x), sy(wp.y), "flag", "#ef4444", 7); }
    var mx = sx(me.x), my = sy(me.y), off = mx < 10 || mx > 950 || my < 76 || my > 530; if (off) { var a2 = Math.atan2(my - 300, mx - 480); mx = Math.max(24, Math.min(936, mx)); my = Math.max(90, Math.min(516, my)); x.save(); x.translate(mx, my); x.rotate(a2); M.shape(x, 0, 0, "arrow", "#22d3ee", 7); x.restore(); } else { x.save(); x.translate(mx, my); x.rotate(Z.r3 && Z.r3.ready && !me.veh && me.speed < .5 ? Z.r3.yaw : me.a); x.fillStyle = "rgba(34,211,238,.22)"; x.beginPath(); x.arc(0, 0, 16 * pulse, 0, TAU); x.fill(); M.shape(x, 0, 0, "arrow", "#22d3ee", 8); x.restore(); x.font = "800 11px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.8)"; x.strokeText("YOU ARE HERE", mx, my + 26); x.fillStyle = "#a5f3fc"; x.fillText("YOU ARE HERE", mx, my + 26); }
    // top bar: search, filters, close
    x.fillStyle = "rgba(8,14,22,.9)"; x.fillRect(0, 0, 960, 70);
    rr(x, 10, 8, 226, 32, 10); x.fillStyle = "rgba(255,255,255,.96)"; x.fill(); x.fillStyle = M.q ? "#0f172a" : "#64748b"; x.font = "600 15px system-ui, sans-serif"; x.textAlign = "left"; x.fillText(M.q ? M.q : "Search places…", 20, 30); M.hits.push({ id: "search", x: 10, y: 8, w: 226, h: 32 });
    x.fillStyle = "rgba(255,255,255,.75)"; x.font = "600 11px system-ui, sans-serif"; x.fillText("Day " + P.day + " · " + S.clock(P) + " · tap to drop a waypoint", 12, 60);
    CATS.forEach(function (c, n) { var row = n < 6 ? 0 : 1, col = row ? n - 6 : n, w = row ? 124 : 103, a = 246 + col * (w + 4), b = 6 + row * 32, on = shown(c.id); rr(x, a, b, w, 28, 14); x.fillStyle = on ? "rgba(30,41,59,.95)" : "rgba(30,41,59,.4)"; x.fill(); x.lineWidth = 1.5; x.strokeStyle = on ? c.col : "rgba(255,255,255,.2)"; x.stroke(); x.globalAlpha = on ? 1 : .4; M.shape(x, a + 15, b + 14, c.sh, c.col, 5); x.fillStyle = "#fff"; x.font = "700 13px system-ui, sans-serif"; x.textAlign = "left"; x.fillText(c.name, a + 28, b + 19); x.globalAlpha = 1; M.hits.push({ id: "cat", x: a, y: b, w: w, h: 28, data: c.id }); });
    btn(x, "close", 912, 8, 40, 40, "✕", false, { font: "800 18px" });
    // side buttons
    btn(x, "zin", 912, 84, 40, 40, "+", false, { font: "800 22px" }); btn(x, "zout", 912, 128, 40, 40, "−", false, { font: "800 22px" }); btn(x, "me", 912, 176, 40, 40, "◎", off, { font: "800 20px" }); btn(x, "legend", 912, 224, 40, 40, "?", M.legend, { font: "800 20px" });
    // search results
    if (M.q) { M.results.forEach(function (p, n) { btn(x, "result", 10, 74 + n * 34, 300, 30, p.name.slice(0, 34), M.sel === p, { font: "700 13px", data: p, r: 8 }); }); if (!M.results.length) { x.fillStyle = "rgba(15,23,42,.88)"; rr(x, 10, 74, 300, 30, 8); x.fill(); x.fillStyle = "#fca5a5"; x.font = "700 13px system-ui, sans-serif"; x.textAlign = "left"; x.fillText("Nothing called that. Try another word.", 22, 94); } }
    // the card for a place
    if (M.sel) { var p = M.sel, inf = M.info(p), c = CAT[M.catOf(p)], cy = 404; rr(x, 10, cy, 380, 126, 12); x.fillStyle = "rgba(8,14,22,.94)"; x.fill(); x.lineWidth = 2; x.strokeStyle = c.col; x.stroke(); M.shape(x, 30, cy + 22, c.sh, c.col, 7); x.fillStyle = "#fff"; x.font = "800 16px system-ui, sans-serif"; x.textAlign = "left"; x.fillText(p.name.replace(/^Shuttle stop: /, "Stop: ").slice(0, 34), 46, cy + 27); M.hits.push({ id: "card", x: 10, y: cy, w: 380, h: 126 }); // the body first, so its buttons (pushed later) win the tap
      x.font = "600 12px system-ui, sans-serif"; x.fillStyle = "rgba(226,232,240,.92)"; var words = inf.does.split(" "), line = "", ly = cy + 46; words.forEach(function (w2) { if (x.measureText(line + w2).width > 350) { x.fillText(line, 22, ly); ly += 15; line = ""; } line += w2 + " "; }); if (ly < cy + 78) x.fillText(line, 22, ly);
      x.font = "800 12px system-ui, sans-serif"; x.fillStyle = inf.open ? "#86efac" : "#fca5a5"; x.fillText((inf.open ? "Open now" : "Closed now") + (inf.hours ? " · " + inf.hours : ""), 22, cy + 84); x.fillStyle = "#fde047"; x.textAlign = "right"; x.fillText(distText(inf.dist) + " away", 378, cy + 84);
      btn(x, "route", 20, cy + 92, 120, 28, "Set route", true, { font: "800 13px" }); if (inf.stop) btn(x, "shuttle", 148, cy + 92, 140, 28, "Shuttle here", false, { font: "800 13px", bg: "#fde047", fg: "#1f2937", data: inf.stop }); btn(x, "unsel", 296, cy + 92, 84, 28, "Close", false, { font: "700 13px" }); }
    else if (wp) { btn(x, "clearwp", 10, 498, 190, 32, "Clear waypoint ✕", false, { font: "700 13px" }); }
    // legend
    if (M.legend) { var lx = 470, lw = 430, lh = 24 * (CATS.length + EXTRA.length) + 46, ly2 = Math.max(76, 534 - lh); rr(x, lx, ly2, lw, lh, 12); x.fillStyle = "rgba(8,14,22,.95)"; x.fill(); x.lineWidth = 1.5; x.strokeStyle = "rgba(255,255,255,.3)"; x.stroke(); x.fillStyle = "#fff"; x.font = "800 15px system-ui, sans-serif"; x.textAlign = "left"; x.fillText("What the markers mean", lx + 14, ly2 + 24); var row2 = 0;
      CATS.map(function (c2) { return [c2.col, c2.sh, c2.name + ": " + c2.says]; }).concat(EXTRA.map(function (e) { return [e[0], e[1], e[2]]; })).forEach(function (e) { var yy = ly2 + 46 + row2 * 24; M.shape(x, lx + 20, yy - 4, e[1], e[0], 5.5); x.fillStyle = "rgba(226,232,240,.95)"; x.font = "600 11px system-ui, sans-serif"; x.textAlign = "left"; var s2 = e[2]; while (x.measureText(s2).width > lw - 48 && s2.length > 8) s2 = s2.slice(0, -2); x.fillText(s2 === e[2] ? s2 : s2 + "…", lx + 36, yy); row2++; }); M.hits.push({ id: "legendPanel", x: lx, y: ly2, w: lw, h: lh }); }
    x.fillStyle = "rgba(255,255,255,.6)"; x.font = "600 11px system-ui, sans-serif"; x.textAlign = "right"; x.fillText("Drag to move · pinch or scroll to zoom · " + (Z.api.keyName ? Z.api.keyName("map") : "N") + " closes", 900, 530);
    x.restore(); placeInput();
  };
  // a small legend under the minimap the first time you play
  M.mini = function (x) {
    var P = Z.P; if (!P || !P.flags || P.flags.mapLegend || Z.mode !== "play" || Z.api.overlayOpen() || (Z.intro && Z.intro.on)) return; M.miniT = (M.miniT || 0) + 1 / 60; if (M.miniT > 26) { P.flags.mapLegend = 1; return; } if (M.miniT < 3) return;
    var a = Math.min(1, (M.miniT - 3) * 2, (26 - M.miniT) * 2), rows = [["home", "your hostel"], ["class", "classes"], ["food", "food"], ["stop", "shuttle"], ["mission", "next step"]], lx = 786, ly = 196; x.save(); x.globalAlpha = a; rr(x, lx, ly, 164, rows.length * 18 + 28, 10); x.fillStyle = "rgba(8,14,22,.82)"; x.fill();
    rows.forEach(function (r, n) { var c = CAT[r[0]]; M.shape(x, lx + 16, ly + 16 + n * 18, c.sh, r[0] === "home" ? "#2563eb" : c.col, 4.5); x.fillStyle = "#fff"; x.font = "700 11px system-ui, sans-serif"; x.textAlign = "left"; x.fillText(r[1], lx + 30, ly + 20 + n * 18); });
    x.fillStyle = "rgba(255,255,255,.7)"; x.font = "600 10px system-ui, sans-serif"; x.fillText("Tap the map for more", lx + 12, ly + rows.length * 18 + 20); x.restore();
  };

  /* ---------- taps ---------- */
  M.tap = function (px, py) {
    var i, h, api = Z.api;
    for (i = M.hits.length - 1; i >= 0; i--) { h = M.hits[i]; if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return act(h); }
    if (py < 70) return;
    var best = null, bd = 20; Z.placeList.forEach(function (p) { if (!shown(M.catOf(p))) return; var d = Math.hypot(sx(p.mx) - px, sy(p.my) - py); if (d < bd) { bd = d; best = p; } });
    if (best) { M.sel = best; api.sound.sfx("click"); return; }
    if (M.sel) { M.sel = null; return; }
    var wp = Z.waypoint; if (wp && Math.hypot(sx(wp.x) - px, sy(wp.y) - py) < 22) { Z.waypoint = null; api.sound.sfx("click"); Z.toast("Waypoint cleared."); return; }
    Z.waypoint = { x: wx(px), y: wy(py), name: "Waypoint" }; if (Z.reroute) Z.reroute(); api.sound.sfx("click");
  };
  function act(h) {
    var api = Z.api, p;
    if (h.id === "close") return M.close(); if (h.id === "zin") return M.zoom(1.5); if (h.id === "zout") return M.zoom(1 / 1.5); if (h.id === "me") return M.centre(); if (h.id === "legend") { M.legend = !M.legend; return; }
    if (h.id === "cat") { M.off[h.data] = !M.off[h.data]; api.sound.sfx("click"); return; }
    if (h.id === "search") { if (M.input) { M.input.style.display = "block"; M.input.focus(); } return; }
    if (h.id === "result") { p = h.data; M.sel = p; M.cx = p.mx; M.cy = p.my; M.k = Math.max(M.k, 1.1); clampView(); return; }
    if (h.id === "unsel") { M.sel = null; return; } if (h.id === "clearwp") { Z.waypoint = null; return; }
    if (h.id === "route" && M.sel) { p = M.sel; Z.waypoint = { x: p.mx, y: p.my, name: p.name }; if (Z.reroute) Z.reroute(); api.sound.sfx("click"); Z.toast("Route set: <b>" + p.name + "</b>"); M.sel = null; return; }
    if (h.id === "shuttle" && h.data) { var me = Z.me, at = null; Z.placeList.forEach(function (q) { if (q.role === "stop" && Math.hypot(q.mx - me.x, q.my - me.y) < 16) at = q; });
      if (at && at !== h.data && Z.travel) { M.close(); Z.travel.go(h.data.id, { mode: "skip" }); return; }
      var near = null, nd = 1e9; Z.placeList.forEach(function (q) { if (q.role !== "stop") return; var d = Math.hypot(q.mx - me.x, q.my - me.y); if (d < nd) { nd = d; near = q; } }); if (near) { Z.waypoint = { x: near.mx, y: near.my, name: near.name }; if (Z.reroute) Z.reroute(); Z.toast("The shuttle leaves from a stop. Route set to <b>" + near.name.replace(/^Shuttle stop: /, "") + "</b>."); } M.sel = null; return; }
  }

  /* ---------- pointer, wheel and the search box (browser only) ---------- */
  function logical(cv, e) { var r = cv.getBoundingClientRect(), d = cv.width / r.width, sc = Math.min(cv.width / 960, cv.height / 540), ox = (cv.width - 960 * sc) / 2, oy = (cv.height - 540 * sc) / 2; return { x: ((e.clientX - r.left) * d - ox) / sc, y: ((e.clientY - r.top) * (cv.height / r.height) - oy) / sc, sc: sc / d }; }
  function placeInput() { var inp = M.input, cv = M.cv; if (!inp || !cv) return; var r = cv.getBoundingClientRect(), st = M.stage.getBoundingClientRect(), d = cv.width / r.width, sc = Math.min(cv.width / 960, cv.height / 540) / d, ox = (r.width - 960 * sc) / 2 + (r.left - st.left), oy = (r.height - 540 * sc) / 2 + (r.top - st.top); inp.style.left = (ox + 10 * sc) + "px"; inp.style.top = (oy + 8 * sc) + "px"; inp.style.width = (226 * sc) + "px"; inp.style.height = (32 * sc) + "px"; inp.style.fontSize = Math.max(16, 15 * sc) + "px"; if (inp.style.display !== "block" && !M.q) inp.style.display = "none"; }
  M.bind = function () {
    if (M.bound || typeof document === "undefined" || !document.querySelector || typeof window.addEventListener !== "function") return; var cv = document.querySelector("[data-gm-canvas]"), stage = document.querySelector("[data-gm-stage]"); if (!cv || !cv.addEventListener || !stage || !stage.appendChild || !cv.getBoundingClientRect) return; M.bound = true; M.cv = cv; M.stage = stage;
    var pts = {}, n = 0, pinch = 0, moved = 0, t0 = 0, last = null;
    function on() { return Z.mode === "play" && Z.bigOpen && Z.bigOpen() && !Z.api.overlayOpen(); }
    stage.addEventListener("pointerdown", function (e) { if (!on() || (e.target !== cv && !(e.target.closest && e.target.closest(".fs-touch")))) return; if (e.target.closest && e.target.closest("[data-fs='closemap']")) return; var q = logical(cv, e); pts[e.pointerId] = q; n = Object.keys(pts).length; moved = 0; t0 = Date.now(); last = q; M.drag = true; M.vx = M.vy = 0; if (n === 2) { var k = Object.keys(pts); pinch = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); } if (M.input && document.activeElement === M.input) M.input.blur(); }, true);
    window.addEventListener("pointermove", function (e) { if (!pts[e.pointerId] || !on()) return; var q = logical(cv, e), o = pts[e.pointerId]; pts[e.pointerId] = q;
      if (n >= 2) { var k = Object.keys(pts), dd = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); if (pinch > 8 && dd > 8) M.zoom(dd / pinch, (pts[k[0]].x + pts[k[1]].x) / 2, (pts[k[0]].y + pts[k[1]].y) / 2); pinch = dd; moved += 99; return; }
      var dx = q.x - o.x, dy = q.y - o.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 8) { M.cx -= dx / M.k; M.cy -= dy / M.k; M.vx = M.vx * .6 + dx * 60 * .4; M.vy = M.vy * .6 + dy * 60 * .4; clampView(); } });
    function up(e) { if (!pts[e.pointerId]) return; var q = pts[e.pointerId]; delete pts[e.pointerId]; n = Object.keys(pts).length; if (n) return; M.drag = false; if (!on()) return; if (moved <= 8 && Date.now() - t0 < 600) { M.vx = M.vy = 0; M.tap(q.x, q.y); } }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", function (e) { delete pts[e.pointerId]; n = Object.keys(pts).length; M.drag = false; });
    stage.addEventListener("wheel", function (e) { if (!on()) return; e.preventDefault(); e.stopPropagation(); var q = logical(cv, e); M.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, q.x, q.y); }, { passive: false, capture: true });
    var inp = document.createElement("input"); inp.type = "search"; inp.placeholder = "Search places…"; inp.setAttribute("aria-label", "Search places on the map"); inp.autocomplete = "off"; inp.style.cssText = "position:absolute;display:none;z-index:6;border:0;border-radius:10px;padding:0 10px;background:#fff;color:#0f172a;font-weight:600;box-sizing:border-box;outline:2px solid #22d3ee";
    inp.addEventListener("input", function () { M.q = inp.value.trim().toLowerCase(); M.sel = null; }); inp.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter" && M.results[0]) { act({ id: "result", data: M.results[0] }); inp.blur(); } else if (e.key === "Escape") { inp.value = ""; M.q = ""; inp.blur(); inp.style.display = "none"; } }); inp.addEventListener("blur", function () { if (!M.q) inp.style.display = "none"; });
    stage.appendChild(inp); M.input = inp;
  };

  M.install = function () {
    if (M.installed || !Z.draw || !Z.click) return; M.installed = true;
    var uDraw = Z.draw, uClick = Z.click;
    Z.draw = function () { var r = uDraw.apply(this, arguments), api = Z.api; try { if (Z.mode === "play" && Z.bigOpen && Z.bigOpen() && api && api.x) { M.bind(); M.draw(api.x, api.t || 0); } else { if (M.isOpen) { M.isOpen = false; if (M.input) { M.input.blur(); M.input.style.display = "none"; } } if (api && api.x) M.mini(api.x); } } catch (e) { M.err = String(e && e.stack || e); } return r; };
    Z.click = function (px, py) { if (Z.mode === "play" && Z.bigOpen && Z.bigOpen() && !(Z.momentClick && Z.momentClick(px, py))) { if (!M.bound) { if (!M.isOpen) M.open(); M.tap(px, py); } return; } return uClick.apply(this, arguments); };
  };
  M.install();
  void D;
})();
