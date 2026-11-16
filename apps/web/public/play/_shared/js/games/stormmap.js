/* Gridkeepers: Storm Map (EEEN 327). A storm has tripped the distribution network. Drive the crew truck along the lines
   to patrol, open switches to isolate faults, earth and repair, then re-energise and back-feed through ties — safely,
   within source ratings and voltage limits, with the fewest customer-minutes lost. Model: gridsim.js. */
(function () {
  "use strict";
  var A = window.Arcade, G = window.GridSim;
  var save = A.store("stormmap") || { stars: {}, best: 0, open: 1 };
  function persist() { A.store("stormmap", save); }
  var S = { net: null, level: 0, sel: null, selEdge: null, anim: null, done: false, note: null, season: null, fit: null };
  var api0 = null, hero = function () { return api0 && api0.hero && api0.hero.inUse; };
  function total() { var n = 0; for (var k in save.stars) n += save.stars[k]; return n; }

  /* ---------- map geometry ---------- */
  function fit() { var N = S.net.N, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; N.forEach(function (n) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
    var sc = Math.min(900 / Math.max(1, x1 - x0), 400 / Math.max(1, y1 - y0), 1.25); S.fit = { sc: sc, ox: 480 - (x0 + x1) / 2 * sc, oy: 300 - (y0 + y1) / 2 * sc }; }
  function P(n) { return { x: S.fit.ox + n.x * S.fit.sc, y: S.fit.oy + n.y * S.fit.sc }; }
  function hhmm(min) { var t = 120 + Math.round(min), h = Math.floor(t / 60) % 24, m = t % 60; return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; }

  /* ---------- an incident ---------- */
  function start(api, level, seasonRound) { try { if (window.MIBPlay) MIBPlay.level(level + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    S.level = level; S.net = G.incident(level, seasonRound != null ? S.season.seed + seasonRound : 0); S.sel = null; S.selEdge = null; S.anim = null; S.done = false; fit();
    api.useActions(["prev", "next", "go", "info", "map"]); api.music(A.song(1201 + level, level >= 18 ? "boss" : "dub", { bpm: 84 + level }));
    var n = S.net, P2 = n.P, lesson = G.LESSONS[Math.min(level, G.LESSONS.length - 1)];
    var trip = n.E.filter(function (e) { return e.dev === "cb" && !e.closed; }).length;
    api.show("<h2>" + (S.season ? "Storm season · storm " + (seasonRound + 1) : "Incident " + (level + 1)) + "</h2><p>02:00. The storm has passed. <b>" + trip + " breaker" + (trip === 1 ? "" : "s") + "</b> tripped and <b>" + G.custOut(n) + "</b> customers are in the dark" + (n.N.some(function (x) { return x.out; }) ? ", and a whole substation has lost its supply" : "") + ".</p>" +
      "<p><b>Lesson:</b> " + A.esc(lesson) + "</p><p class='gm-small'>Tap a place to drive there (driving a line patrols it). Tap the truck's own spot, or a line, for switching. Breakers at substations work by remote. Three safety violations end the shift.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Roll out</button><button class='gm-btn' data-act='map'>Incident list</button></div>", function (a) { if (a === "map") return list(api); api.hide(); });
  }
  function list(api) {
    var rows = ""; for (var i = 0; i < G.LEVELS; i++) { var st = save.stars[i] || 0, open = hero() || S.allOpen || i < save.open; rows += "<button class='gm-btn" + (open && !st ? " gm-btn--go" : "") + "' data-act='" + (open ? "lv" : "no") + "' data-i='" + i + "'" + (open ? "" : " disabled") + ">" + (i + 1) + (st ? " " + "★".repeat(st) : open ? "" : " 🔒") + "</button>"; }
    api.show("<h2>Gridkeepers: Storm Map</h2><p>Keep the lights on after every storm. Faults, protection, earthing, back-feeds, ratings and voltage are modelled for real.</p><p><b>★ " + total() + " / " + G.LEVELS * 3 + "</b>" + (save.best ? " · Storm season best " + save.best : "") + "</p><div class='gm-actions' style='flex-wrap:wrap'>" + rows + "</div>" +
      "<div class='gm-actions'>" + (save.open > 8 || hero() ? "<button class='gm-btn' data-act='season'>⛈ Storm season (endless)</button>" : "<button class='gm-btn' disabled>⛈ Storm season opens after incident 8</button>") + "</div>",
      function (a, el) { if (a === "lv") start(api, +el.getAttribute("data-i")); else if (a === "season") startSeason(api); });
  }

  /* ---------- driving and switching ---------- */
  function driveTo(api, id) {
    var n = S.net; if (S.anim || id === n.truck) return;
    var r = G.route(n, n.truck, id); if (!r.edges.length) return;
    var pts = [P(n.N[n.truck])], cur = n.truck; r.edges.forEach(function (e) { cur = G.other(e, cur); pts.push(P(n.N[cur])); });
    S.anim = { pts: pts, i: 0, f: 0, to: id, edges: r.edges }; api.sound.sfx("dash");
  }
  function finishDrive(api) {
    var n = S.net, a = S.anim; S.anim = null; var unknown = a.edges.filter(function (e) { return !e.known; }); G.drive(n, a.to);
    var found = unknown.filter(function (e) { return e.fault; }); if (found.length) { api.sound.sfx("block"); S.note = { t: "Patrol: damage found on " + found.length + " section" + (found.length > 1 ? "s" : "") + " (marked in red).", life: 4 }; api.kick(4); }
    check(api);
  }
  function siteDialog(api, nodeId, edge) {
    var n = S.net, here = nodeId != null ? n.N[nodeId] : null, list = edge ? [edge] : G.adj(n, nodeId), rows = [];
    list.forEach(function (e) {
      var nm = edgeName(e), btn = function (what, label) { var why = G.can(n, e, what); rows.push("<button class='gm-btn" + (why ? "" : " gm-btn--go") + "' data-act='" + what + ":" + e.id + "'" + (why ? " title='" + A.esc(why) + "'" : "") + ">" + label + "</button>"); };
      rows.push("<p style='margin:.6em 0 .2em'><b>" + A.esc(nm) + "</b> — " + state(e) + "</p>");
      if (e.dev && e.dev !== "none") btn(e.closed ? "open" : "close", (e.closed ? "Open " : "Close ") + (e.dev === "cb" ? "breaker" : e.tie ? "tie switch" : "switch"));
      if (e.known && (e.fault || e.earthed)) { btn(e.earthed ? "unearth" : "earth", e.earthed ? "Remove earth" : "Apply earth"); if (e.fault) btn("repair", "Repair (" + G.T.REPAIR + " min)"); }
    });
    if (here && here.dg) rows.push("<p><b>Solar-battery unit</b> (" + here.dg.cap + " MW) — " + (here.dg.on ? "running" : "off") + "</p><button class='gm-btn' data-act='dg:" + here.id + "'>" + (here.dg.on ? "Stop it" : "Start it as an island") + "</button>");
    var title = here ? here.name + (here.kind === "sub" ? "" : " · " + here.cust + " customers" + (here.hospital ? " · priority" : "")) + (n.truck === here.id ? " · crew on site" : "") : edgeName(edge);
    api.show("<h2>" + A.esc(title) + "</h2>" + (here && here.kind === "load" ? "<p>" + (n.served[here.id] ? "Supplied at " + (n.V[here.id] || 0).toFixed(3) + " pu" : n.live[here.id] ? "Live but voltage too low (" + (n.V[here.id] || 0).toFixed(3) + " pu < " + G.VMIN + ")" : "Off supply") + "</p>" : "") + rows.join("") +
      "<p class='gm-small'>Greyed buttons say why when tapped. Switching costs " + G.T.SWITCH + " min on site; earthing " + G.T.EARTH + " min.</p><div class='gm-actions'>" + (here && n.truck !== here.id ? "<button class='gm-btn gm-btn--go' data-act='drive'>Drive the crew here</button>" : "") + "<button class='gm-btn' data-act='close'>Close</button></div>",
      function (a) {
        if (a === "close") return api.hide();
        if (a === "drive") { api.hide(); return driveTo(api, here.id); }
        if (a.indexOf("dg:") === 0) { var r0 = G.dgToggle(n, n.N[+a.slice(3)]); api.hide(); if (!r0.ok) violation(api, r0.why); return check(api); }
        var p = a.split(":"), e = n.E[+p[1]], what = p[0], why = G.can(n, e, what);
        if (why) { S.note = { t: why, life: 4 }; api.sound.sfx("block"); return api.hide(); }
        var r = G.act(n, e, what); api.hide();
        if (!r.ok) { if (r.violation) violation(api, r.why); else S.note = { t: r.why, life: 4 }; return; }
        api.sound.sfx(what === "close" ? "power" : "click");
        if (r.tripped) { api.sound.sfx("boom"); api.flash("#ff4d4d", .3); api.kick(8); S.note = { t: "Breaker " + edgeName(r.tripped) + " tripped: you energised a fault. Patrol before switching in.", life: 5 }; }
        else if (r.overload) { api.sound.sfx("boom"); S.note = { t: "Overload: that source cannot carry so much. Its breaker opened. Transfer less, or split the feeder.", life: 5 }; }
        else if (S.net.low.length) S.note = { t: S.net.low.length + " place" + (S.net.low.length > 1 ? "s are" : " is") + " live but below " + G.VMIN + " pu: the path is too long or too loaded.", life: 5 };
        if (what === "repair") api.burst(P(n.N[n.truck]).x, P(n.N[n.truck]).y, "#3dd68c", 20, 200);
        check(api);
      });
  }
  function violation(api, why) { api.sound.sfx("lose"); api.flash("#ff9f1a", .3); S.note = { t: "Safety violation " + S.net.violations + " of 3: " + why, life: 6 }; check(api); }
  function edgeName(e) { var N = S.net.N, a = N[e.a], b = N[e.b]; return (e.tie ? "Tie " : e.dev === "cb" ? "Breaker " : "Line ") + a.name.split(" ")[0] + "–" + b.name.split(" ")[0]; }
  function state(e) { return (e.dev === "none" ? "no switch" : e.closed ? "closed" : "open") + (e.live ? ", live" : ", dead") + (e.known ? (e.fault ? ", <b style='color:#ff6b6b'>DAMAGED</b>" : ", patrolled, healthy") : ", not patrolled") + (e.earthed ? ", <b>earthed</b>" : "") + (e.fpi ? ", indicator lit" : ""); }

  /* ---------- win and loss ---------- */
  function check(api) {
    var n = S.net; if (S.done) return;
    if (n.violations >= 3 || n.t > n.limit) { S.done = true; return lose(api, n.violations >= 3 ? "Three safety violations: the shift is stood down." : "Out of time: the morning shift takes over."); }
    if (G.finished(n)) { S.done = true; return win(api); }
  }
  function win(api) {
    var n = S.net, st = Math.max(1, G.stars(n, n.par)), lv = S.level, out = G.custAll(n);
    if (S.season) return seasonNext(api, st);
    save.stars[lv] = Math.max(save.stars[lv] || 0, st); save.open = Math.max(save.open, lv + 2); persist();
    A.report("storm-map", { result: "win", stage: lv + 1, score: st * 100 + Math.max(0, Math.round(200 - n.cmi / Math.max(1, out))) });
    var all = lv === G.LEVELS - 1;
    api.ceremony(all ? "gameComplete" : "stageClear", { title: all ? "THE GRID IS SAFE!" : "LIGHTS ON!", sub: "Incident " + (lv + 1), trophy: all ? "crown" : "star", stars: st, colors: ["#ffd84a", "#7ef0ff", "#3dd68c", "#fff"], len: all ? 5 : 2.8, score: st * 100,
      stats: [["Restored by", hhmm(n.t)], ["Customer-minutes lost", Math.round(n.cmi).toLocaleString()], ["Breaker trips", n.trips], ["Safety violations", n.violations]],
      line: st === 3 ? "Close to the best possible plan." : "The best crew lost about " + Math.round(n.par).toLocaleString() + " customer-minutes.",
      then: function () { api.show("<h2>" + "★".repeat(st) + "☆".repeat(3 - st) + " Incident " + (lv + 1) + "</h2><p>Every customer is back by " + hhmm(n.t) + ".</p><p>" + A.esc(G.LESSONS[Math.min(lv, G.LESSONS.length - 1)]) + "</p>" +
        "<p class='gm-small'>Stars compare your customer-minutes interrupted (CMI) with a reference crew's plan: 3 ★ within 25 %, 2 ★ within 90 %.</p><div class='gm-actions'>" + (lv + 1 < G.LEVELS ? "<button class='gm-btn gm-btn--go' data-act='next'>Next incident</button>" : "") + "<button class='gm-btn' data-act='retry'>Replay</button><button class='gm-btn' data-act='list'>Incident list</button></div>",
        function (a) { if (a === "next") start(api, lv + 1); else if (a === "retry") start(api, lv); else list(api); }); } });
  }
  function lose(api, why) {
    if (S.season) return endSeason(api, why);
    api.ceremony("lose", { title: "Shift over", sub: "Incident " + (S.level + 1), line: why, tip: "Isolate, prove dead, earth — then repair. Patrol before you close a breaker.", then: function () { api.show("<h2>Shift over</h2><p>" + A.esc(why) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='retry'>Try again</button><button class='gm-btn' data-act='list'>Incident list</button></div>", function (a) { if (a === "retry") start(api, S.level); else list(api); }); } });
  }
  function startSeason(api) { S.season = { round: 0, score: 0, seed: (Date.now() & 0xffff) || 11 }; start(api, 26 + 0, 0); }
  function seasonNext(api, st) { var s = S.season; s.score += st * 150 + s.round * 40; s.round++; api.banner("STORM " + (s.round + 1), { dur: 1.3 }); setTimeout(function () { if (S.season) start(api, 26 + Math.min(9, s.round), s.round); }, 1000); }
  function endSeason(api, why) {
    var s = S.season; S.season = null; var rec = s.score > (save.best || 0); if (rec) { save.best = s.score; persist(); }
    api.ceremony(rec ? "newRecord" : "lose", { title: rec ? "NEW RECORD!" : "Season over", score: s.score, stats: [["Storms cleared", s.round]], line: why, tip: "Every storm is a little bigger. Use the indicators to find faults fast.",
      then: function () { api.show("<h2>Storm season: " + s.score + "</h2><p>" + s.round + " storms cleared. Best " + save.best + ".</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>New season</button><button class='gm-btn' data-act='list'>Incident list</button></div>", function (a) { if (a === "again") startSeason(api); else list(api); }); } });
  }

  /* ---------- drawing ---------- */
  function draw(api) {
    var x = api.x, n = S.net, t = api.t;
    x.fillStyle = "#0b1218"; x.fillRect(0, 0, 960, 540);
    if (!n) return;
    for (var gx = 0; gx < 960; gx += 48) { x.fillStyle = "rgba(255,255,255,.025)"; x.fillRect(gx, 50, 1, 490); }
    // lines
    n.E.forEach(function (e) { var a = P(n.N[e.a]), b = P(n.N[e.b]);
      x.lineWidth = e.tie ? 3 : 6; x.setLineDash(e.tie && !e.closed ? [8, 8] : !e.known && !e.live ? [3, 6] : []);
      x.strokeStyle = e.known && e.fault ? "#ff5d5d" : e.live ? (n.low.length && (n.low.indexOf(e.a) >= 0 || n.low.indexOf(e.b) >= 0) ? "#ffb347" : "#ffd84a") : e.tie && !e.closed ? "#3dd68c" : "#46505c";
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.setLineDash([]);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (e.known && e.fault) { x.fillStyle = "#ff5d5d"; x.font = "800 22px system-ui"; x.textAlign = "center"; x.fillText("⚡", mx, my - 8); }
      if (e.earthed) { x.fillStyle = "#7ef0ff"; x.font = "800 20px system-ui"; x.textAlign = "center"; x.fillText("⏚", mx, my + 22); }
      if (e.fpi) { x.fillStyle = Math.sin(t * 6) > 0 ? "#ff9f1a" : "#7a4b00"; x.beginPath(); x.arc(mx + 10, my - 10, 6, 0, 7); x.fill(); }
      if (e.dev && e.dev !== "none") { var dx = a.x + (b.x - a.x) * .22, dy = a.y + (b.y - a.y) * .22, s = e.dev === "cb" ? 11 : 8; x.fillStyle = e.closed ? (e.dev === "cb" ? "#f6c445" : "#cfd8e3") : "#0b1218"; x.strokeStyle = e.dev === "cb" ? "#f6c445" : "#cfd8e3"; x.lineWidth = 2; x.fillRect(dx - s, dy - s, s * 2, s * 2); x.strokeRect(dx - s, dy - s, s * 2, s * 2); }
      if (S.selEdge === e) { x.strokeStyle = "#fff"; x.lineWidth = 2; x.beginPath(); x.arc(mx, my, 18, 0, 7); x.stroke(); } });
    // places
    n.N.forEach(function (nd) { var p = P(nd), served = n.served[nd.id];
      if (nd.kind === "sub") { x.fillStyle = nd.out ? "#5a2f2f" : "#2f4a6b"; x.fillRect(p.x - 22, p.y - 22, 44, 44); x.fillStyle = "#fff"; x.font = "800 22px system-ui"; x.textAlign = "center"; x.fillText(nd.out ? "✖" : "⚡", p.x, p.y + 8); x.font = "700 14px system-ui"; x.fillText((nd.out ? "LOST " : "") + nd.cap + " MW", p.x, p.y + 40); return; }
      x.fillStyle = served ? "#ffd84a" : n.live[nd.id] ? "#ffb347" : "#3a4552"; x.beginPath(); x.arc(p.x, p.y, nd.hospital ? 15 : 11, 0, 7); x.fill();
      if (nd.hospital) { x.fillStyle = "#e33"; x.font = "900 16px system-ui"; x.textAlign = "center"; x.fillText("H", p.x, p.y + 6); }
      if (nd.dg) { x.fillStyle = nd.dg.on ? "#3dd68c" : "#8899aa"; x.fillRect(p.x + 12, p.y - 20, 14, 10); }
      if (S.sel === nd.id) { x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, 20, 0, 7); x.stroke(); } });
    // truck
    var tp = S.anim ? lerpPath(S.anim) : P(n.N[n.truck]);
    x.fillStyle = "#ff8a00"; x.fillRect(tp.x - 16, tp.y - 30, 32, 18); x.fillStyle = hero() ? "#f6c445" : "#fff"; x.fillRect(tp.x + 4, tp.y - 28, 10, 8); x.fillStyle = "#111"; x.beginPath(); x.arc(tp.x - 9, tp.y - 11, 4, 0, 7); x.arc(tp.x + 9, tp.y - 11, 4, 0, 7); x.fill();
    // HUD
    x.globalAlpha = .92; x.fillStyle = "#121a22"; x.fillRect(0, 0, 960, 50); x.globalAlpha = 1;
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 26px system-ui"; x.fillText(hhmm(n.t), 16, 35);
    x.fillStyle = G.custOut(n) ? "#ff9f9f" : "#3dd68c"; x.font = "800 22px system-ui"; x.fillText("Dark: " + G.custOut(n), 110, 34);
    x.fillStyle = "#ffd84a"; x.fillText("CMI " + Math.round(n.cmi).toLocaleString(), 300, 34);
    x.fillStyle = n.violations ? "#ff9f1a" : "#9fb3c8"; x.fillText("⚠ " + n.violations + "/3", 520, 34);
    x.fillStyle = "#9fb3c8"; x.fillText((S.season ? "Season " + (S.season.round + 1) : "Incident " + (S.level + 1)) + " · until " + hhmm(n.limit), 620, 34);
    if (S.note && S.note.life > 0) { x.fillStyle = "rgba(6,10,16,.92)"; x.fillRect(40, 486, 880, 46); x.fillStyle = "#ffe9a8"; x.font = "700 19px system-ui"; x.textAlign = "center"; x.fillText(S.note.t.length > 86 ? S.note.t.slice(0, 84) + "…" : S.note.t, 480, 516); }
    else { x.fillStyle = "#7f93a8"; x.font = "600 17px system-ui"; x.textAlign = "center"; x.fillText("Tap a place to drive · tap the crew or a line to switch · yellow = supplied · red ⚡ = damage · orange dot = indicator", 480, 524); }
  }
  function lerpPath(an) { var a = an.pts[an.i], b = an.pts[Math.min(an.i + 1, an.pts.length - 1)]; return { x: a.x + (b.x - a.x) * an.f, y: a.y + (b.y - a.y) * an.f }; }

  /* ---------- cheats and the maker ---------- */
  var CH = /*CH[*/{"skip":["885509b5091fc03a7c86ceb955aa1693b3a5a8d4eff5567e4e0d55c27b589f9f","a4f9bd1f3e53f95b2cf6c1b37e0980a8b97690505b5c7f4757a09c9b7ad8dc50"],"reveal":["a366f07237362c7309938e1b68d29d3f1f5c02f4b1902e496924437cd5c85d9f","0b6df836a6793bdf7d0d3e115e6590069e013c1e3c2340e267cd9515450daeb0"],"safe":["296925f21a7fafe8ee74d43ba5b131f565e818dd6a67c47bf8c4a671c5c234d5","b67e7cf9c6c0d06061d31151ca71141fc79266da7b4a5da0fcd4d6989edc7ea2"],"time":["dd191442529fb87faac9428d9f80311aecae3753fff671fd66b017acae624c44","9823fa6da3ef7dc19def5165d267febde44a7d21ed39239abfe2b25eef689736"],"stars":["d0f2f3c4e3a306c28d9ea4f9a0cbae447acb97e8989a0c5e420752bc32c3339d","c955d18c0c575773a01279a721af31394cb9549f1f18e3a0714a9d216e984b77"],"unlock":["324118a1d27bb711ea20c4d3520edbe8c530faa8ef985df2f882e6df8513969f","8d6226670ced379442655fb29cc7a3feb31b0462bbafd1228ec9420ef893323c"],"slow":["bab7d7baa6069474859aad4bb502a157d00151fcdf0d5fb1820fcab60dbdd622","a9058b0fd84ec57b96f5e1f4d65c8909048355e523de0f5c24bea3deaa685356"],"party":["d45eb3b8b9fa10f80a84e0095f7cc492a5fa2f2ad3049d8effefccfa344014a5","082f3fcf20919585ffedde4dc4918d0463de9ee6ffaf62fbc567dfe52b88813b"],"_combo":"5c7a23ede1c7ff8145e38edf9bc341fedd4fa8a7713887669f749be93a963a8d","_swipe":"3344324368ce3eb0074fa237cb8db9542286d9f7be4627f2225c4f7acc6d85a3"}/*]CH*/;
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Restore everything now", h: CH.skip, run: function () { if (!S.net || S.done) return; var r = G.solve(S.net); r.net.violations = 0; r.net.cmi = Math.min(r.net.cmi, S.net.par); S.net = r.net; fit(); check(api); } },
      reveal: { label: "Show every fault", h: CH.reveal, run: function () { if (S.net) S.net.E.forEach(function (e) { e.known = true; }); } },
      safe: { label: "Forgive safety violations", h: CH.safe, run: function () { if (S.net) S.net.violations = 0; } },
      time: { label: "+2 hours", h: CH.time, run: function () { if (S.net) S.net.limit += 120; } },
      stars: { label: "Three stars for this incident", h: CH.stars, run: function () { save.stars[S.level] = 3; persist(); } },
      unlock: { label: "Every incident open", h: CH.unlock, run: function () { S.allOpen = true; save.open = G.LEVELS; persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    if (CH._combo) api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { list(api); } });
  }
  function pick(mx, my) { // nearest place, else nearest line midpoint
    var n = S.net, best = null, bd = 34; n.N.forEach(function (nd) { var p = P(nd), d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = { node: nd.id }; } });
    if (best) return best; bd = 26; n.E.forEach(function (e) { var a = P(n.N[e.a]), b = P(n.N[e.b]), d = Math.hypot((a.x + b.x) / 2 - mx, (a.y + b.y) / 2 - my); if (d < bd) { bd = d; best = { edge: e }; } }); return best;
  }
  function useSel(api) { var n = S.net; if (S.sel == null) return; if (S.sel === n.truck) siteDialog(api, S.sel); else driveTo(api, S.sel); }

  var game = {
    song: A.song(1200, "dub"),
    savePrefix: ["ee-arcade-stormmap"],
    menu: function (api) { S.season = null; list(api); },
    actions: [
      { id: "prev", label: "Previous place", keys: ["ArrowLeft", "KeyA", "ShiftLeft"], touch: { label: "◀", x: 8, y: 86 } }, { id: "next", label: "Next place", keys: ["ArrowRight", "KeyD", "Tab"], touch: { label: "▶", x: 20, y: 86 } },
      { id: "go", label: "Drive / switch here", keys: ["Enter", "Space", "KeyE"], touch: { label: "E", x: 92, y: 86 } }, { id: "info", label: "Lesson", keys: ["KeyH"], touch: { label: "?", x: 6, y: 18 } }, { id: "map", label: "Incident list", keys: ["KeyM"], touch: { label: "☰", x: 94, y: 18 } }
    ],
    click: function (mx, my, api) {
      if (api.overlayOpen() || !S.net || S.anim) return; var p = pick(mx, my); if (!p) return;
      if (p.edge) { S.selEdge = p.edge; return siteDialog(api, null, p.edge); }
      S.sel = p.node; S.selEdge = null; if (p.node === S.net.truck) siteDialog(api, p.node); else siteDialog(api, p.node);
    },
    init: function (api) {
      api0 = api; setupCheats(api);
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "truckSpeed", tab: "gameplay", label: "Truck animation speed", type: "slider", default: 1, min: .5, max: 3, step: .25, format: function (v) { return Math.round(v * 100) + "%"; }, help: "Only the animation; game time per kilometre is fixed." });
        api.settings.add({ id: "hints", tab: "gameplay", label: "Explain greyed-out actions", type: "toggle", default: true });
      }
      api.panel("<p>Each storm is a real radial distribution network with protection, interlocks and a voltage-drop load flow.</p><table><tr><td>Protection</td><td>a closed path from a source to a fault trips the first breaker on it</td></tr><tr><td>Safety</td><td>isolate both sides → earth → repair → remove earth</td></tr><tr><td>Ratings</td><td>load on each source ≤ its MW rating</td></tr><tr><td>Voltage</td><td><span class='gm-eq'>V(child) = V(parent) − R·P(downstream)</span>, every customer ≥ 0.92 pu, substations regulate to 1.03 pu</td></tr><tr><td>Score</td><td>customer-minutes interrupted (CMI)</td></tr></table>" +
        "<p class='gm-small'>Simplifications: one switch per section at its source end, lumped loads, no reactive power, no reclosing timers. Course: EEEN 327, electric energy sources and transmission and distribution.</p>",
        "<p class='gm-small'>Tap a place to drive there; tap the crew's place or a line to switch. With keys: ◀ ▶ choose a place, E drives or opens switching.</p>");
      list(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) S.note.life -= dt;
      if (!S.net || api.overlayOpen() || S.done) return;
      if (hero()) S.net.violations = 0;
      check(api); if (S.done) return;
      if (S.anim) { var an = S.anim, sp = 520 * ((api.settings && api.settings.get && api.settings.get("truckSpeed")) || 1) * dt; while (sp > 0 && S.anim) { var a = an.pts[an.i], b = an.pts[an.i + 1]; if (!b) { finishDrive(api); break; } var L = Math.hypot(b.x - a.x, b.y - a.y) || 1, left = (1 - an.f) * L; if (sp < left) { an.f += sp / L; sp = 0; } else { sp -= left; an.i++; an.f = 0; if (an.i >= an.pts.length - 1) { finishDrive(api); break; } } } return; }
      var ids = S.net.N.map(function (n) { return n.id; });
      if (api.hit("next")) { S.sel = S.sel == null ? S.net.truck : ids[(ids.indexOf(S.sel) + 1) % ids.length]; S.selEdge = null; }
      if (api.hit("prev")) { S.sel = S.sel == null ? S.net.truck : ids[(ids.indexOf(S.sel) - 1 + ids.length) % ids.length]; S.selEdge = null; }
      if (api.hit("go")) useSel(api);
      if (api.hit("info")) S.note = { t: G.LESSONS[Math.min(S.level, G.LESSONS.length - 1)], life: 8 };
      if (api.hit("map")) list(api);
    },
    draw: draw
  };
  A.run(game);
  window.StormMap = { S: S, save: save, start: function (l) { start(api0, l); } };
})();
