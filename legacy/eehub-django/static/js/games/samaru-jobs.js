/* Freshers School Life — proper jobs, and one thing at a time.
   Jobs: a job that needs wheels comes with them: a marked keke for taxi runs, an okada with a box for deliveries,
   waiting beside you, hired out of the payout (S.RULES.jobFee*), handed back when the job ends. Your own machine
   works too, and then there is no fee. The passenger waits at the kerb, climbs in, and climbs out at the far end;
   the parcel rides on the rack. Some jobs are chains of stops. Smooth driving earns a tip and a better rating.
   While you work, an ON A JOB card sits top-left with the objective, the money so far, the clock and Cancel.
   Focus: Z.focus says what you are busy with (mission, job, lecture, date, or nothing) so the rest of the game
   holds its prompts back while you work. Other files ask Z.focus.allow(kind) before they speak up. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, J = Z.jobs = {}, TAU = Math.PI * 2;
  var R0 = S.RULES || (S.RULES = {});
  if (R0.jobFeeRate == null) R0.jobFeeRate = .1;   // share of the pay kept as hire for the job vehicle
  if (R0.jobFeeMin == null) R0.jobFeeMin = 50;     // naira
  if (R0.jobTipRate == null) R0.jobTipRate = .25;  // best tip for a perfectly smooth run, as a share of the pay
  if (R0.jobChain == null) R0.jobChain = .35;      // chance a board offer is a chain of stops
  var NAMES = { delivery: "Delivery", taxi: "Taxi run", lost: "Lost property", errand: "Errand" }, NEED = { taxi: "keke", delivery: "okada" };
  var PAX = ["Driver, abeg fast fast.", "Oga, I dey late for lecture.", "Take am easy for bump o.", "Do you have change?", "Play something on that radio."];
  var THANKS = ["Thank you, driver.", "Keep the change.", "You try. God bless.", "Next time, same driver!"], ROUGH = ["Ah! You nearly killed me.", "I will trek next time.", "My neck! Take your money."];
  function rnd() { return Math.random(); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function say(o, t) { try { if (Z.say) Z.say(o, t); } catch (e) {} }
  function toast(h) { try { if (Z.toast) Z.toast(h); } catch (e) {} }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function fee(j) { return Math.max(S.RULES.jobFeeMin, Math.round(j.pay * S.RULES.jobFeeRate / 10) * 10); }
  function suits(type, kind) { return kind === "taxi" ? (S.VEH[type].seats || 0) > 0 : kind === "delivery" ? /^(okada|keke|car|scooter|bike|sport)$/.test(type) : true; }

  /* ---------- focus: one thing owns your attention ---------- */
  var stack = [], PRI = { chase: 6, race: 6, mission: 5, job: 4, lecture: 3, date: 2, roam: 0 };
  var F = Z.focus = {
    push: function (kind, label) { F.pop(kind); stack.push({ kind: kind, label: label || "" }); },
    pop: function (kind) { for (var i = stack.length - 1; i >= 0; i--) if (stack[i].kind === kind) stack.splice(i, 1); },
    // What you are busy with right now, highest priority first.
    current: function () {
      var P = Z.P, m = Z.me, best = { kind: "roam", label: "" }, i; if (!P) return best;
      function take(k, l) { if ((PRI[k] || 0) > (PRI[best.kind] || 0)) best = { kind: k, label: l || "" }; }
      if (P.sec && P.sec.state) take("chase", "Security"); if (Z.race) take("race", Z.race.name);
      var st = Z.step && Z.step(); if (st && (st.t === "fight" || (Z.foes && Z.foes.length && Z.foes.some(function (f) { return f.quest; })))) take("mission", "Mission");
      else if (st && Z.target) { var tg = Z.target(); if (tg && !P.job && tg !== Z.waypoint && Math.hypot(tg.x - m.x, tg.y - m.y) < 45 && st.t !== "stat") take("mission", "Mission"); }
      if (P.job) take("job", NAMES[P.job.kind] || "Job");
      if (Z.date) take("date", "Date"); else if (Z.friends && Z.npcs.some(function (n) { return n.lead; })) take("date", "With a friend");
      for (i = 0; i < stack.length; i++) take(stack[i].kind, stack[i].label);
      return best;
    },
    // May this kind of prompt speak up now? Kinds: lecture-strip, missed-class, class-warning, friend-offer, help,
    // reminder, bystander, tip, moment. While you are on a job or a mission only moments and urgent tips pass,
    // plus ONE gentle class warning per lecture.
    allow: function (kind, key) {
      var c = F.current().kind, busy = (PRI[c] || 0) >= PRI.job;
      if (kind === "moment" || kind === "tip-urgent") return true;
      if (kind === "class-warning") { if (!busy) return false; var k = "cw:" + (key || "") + ":" + (Z.P ? Z.P.day : 0); if (F._warned === k) return false; F._warned = k; return true; }
      if (kind === "friend-offer" || kind === "help") return (PRI[c] || 0) < PRI.lecture;
      if (kind === "bystander") return c !== "race";
      return !busy;
    },
    // Working through a lecture: the first miss of the day is not held against you. Returns true when excused.
    excuse: function () { var P = Z.P; if (!P || (PRI[F.current().kind] || 0) < PRI.job) return false; if (P.flags.excused === P.day) return false; P.flags.excused = P.day; return true; },
    busy: function () { return (PRI[F.current().kind] || 0) >= PRI.job; }
  };

  /* ---------- taking a job ---------- */
  function spawnVeh(j) {
    var m = Z.me, W = Z.W, type = NEED[j.kind], nr = S.nearRoad(W, m.x, m.y, 60, true), a = nr && nr.r ? Math.atan2(nr.y - m.y, nr.x - m.x) + 1.5708 : m.a, bx = nr && nr.d < 25 ? nr.x + (m.x - nr.x) * .35 : m.x + Math.cos(m.a + 1.2) * 3, by = nr && nr.d < 25 ? nr.y + (m.y - nr.y) * .35 : m.y + Math.sin(m.a + 1.2) * 3, q = S.push(W, bx, by, 1.2);
    var c = { id: Z.cars.length, type: type, x: q.x, y: q.y, a: a, vx: 0, vy: 0, speed: 0, col: type === "keke" ? "#facc15" : "#f97316", hx: q.x, hy: q.y, ha: a, free: true, job: true, cargo: j.kind === "delivery" ? 0 : -1, label: j.kind === "taxi" ? "TAXI" : "DELIVERY" };
    Z.cars.push(c); return c;
  }
  function returnVeh(j) {
    var c = j.veh, m = Z.me; if (!c) return; if (m.veh === c) { c.vx = c.vy = 0; c.speed = 0; m.alt = 0; try { Z.exit(true); } catch (e) { m.veh = null; } }
    var i = Z.cars.indexOf(c); if (i >= 0) Z.cars.splice(i, 1); j.veh = null;
  }
  function removePax(j) { if (j.pax) { var i = Z.peds.indexOf(j.pax); if (i >= 0 && !j.pax.freed) Z.peds.splice(i, 1); j.pax = null; } }
  function waitingPax(j, at) { // the passenger, waving at the kerb
    var W = Z.W, q = S.push(W, at.x + 1.5, at.y + 1.5, .45), nr = S.nearRoad(W, q.x, q.y, 80) || { x: q.x, y: q.y, r: W.roads[0] }, r = Math.random, w = S.wanderStart(W, r, { x: nr.x, y: nr.y, r: nr.r }, false);
    var n = { w: w, x: q.x, y: q.y, a: 0, spd: 0, look: Z.lookOf ? Z.lookOf(Math.floor(r() * 1e6)) : { skin: "#6b4226", hair: "low", top: "#2563eb" }, sp: 1.5, side: nr.r.w / 2 + 1.2, walk: 0, fall: 0, wave: 0, flee: 0, k: 3, pax: "wait", busy: true };
    Z.peds.push(n); j.pax = n; return n;
  }
  var baseTake = Z.takeJob;
  Z.takeJob = function (j) {
    var P = Z.P, m = Z.me; if (P.job) J.cancel(true);
    j.legs = 0; j.earned = 0; j.rough = 0; j.crash = 0; j.tipOn = 1; j.name = NAMES[j.kind] || "Job"; j.total = 1 + (j.chain ? j.chain.length : 0);
    baseTake(j);
    var need = NEED[j.kind];
    if (need && !(m.veh && suits(m.veh.type, j.kind))) { j.veh = spawnVeh(j); j.fee = P.flags["own_" + need] ? 0 : fee(j);
      toast("<b>" + j.name + ".</b> A " + (need === "keke" ? "keke taxi" : "delivery okada") + " is waiting beside you" + (j.fee ? ": hire " + naira(j.fee) + " comes out of your pay" : "") + ". Your own machine works too."); }
    if (j.kind === "taxi") waitingPax(j, j.a);
    Z.emit && Z.emit({ t: "jobStart", kind: j.kind });
  };
  // Board offers: now and then a chain of stops instead of a single run.
  var baseOffers = Z.offers;
  Z.offers = function (from) {
    var out = baseOffers(from); out.forEach(function (j) { if ((j.kind === "delivery" || j.kind === "taxi") && rnd() < S.RULES.jobChain) { var pts = Z.placeList.filter(function (p) { return p.id !== j.a.id && p.id !== j.b.id && Math.hypot(p.mx - j.b.x, p.my - j.b.y) > 120; }), n = 1 + (rnd() < .4 ? 1 : 0); j.chain = [];
      for (var i = 0; i < n && pts.length; i++) { var p = pts.splice(Math.floor(rnd() * pts.length), 1)[0]; j.chain.push({ id: p.id, name: p.name, x: p.mx, y: p.my }); }
      j.legPay = Math.round(j.pay * .7 / 10) * 10; j.total = 1 + j.chain.length; j.multi = true; } });
    return out;
  };
  J.title = function (j) { return (NAMES[j.kind] || "Job") + (j.chain && j.chain.length ? " · " + (1 + j.chain.length) + " stops" : ""); };

  /* ---------- while you work ---------- */
  function score(j) { return Math.max(0, 1 - j.crash * .4 - j.rough * .12); }
  function stars(j, late) { return Math.max(1, Math.min(5, Math.round(5 - j.crash * 1.5 - j.rough * .4 - (late ? 1 : 0)))); }
  var lastV = 0, lastStage = -1, lastB = null;
  // Called every frame while playing. Watches the driving, moves the passenger, handles chains and the cancel key.
  J.tick = function (dt) {
    var P = Z.P, m = Z.me, j = P && P.job, a = Z.api; if (!P) return;
    if (!j) { if (J.last) { finish(J.last); J.last = null; } lastStage = -1; return; }
    J.last = j;
    try { if (a.hit("cancelJob")) { J.cancel(); return; } } catch (e) {}
    // how you drive, once the fare or the parcel is aboard
    var v = m.veh, sp = v ? Math.hypot(v.vx, v.vy) : 0; if (v && v === j.veh) j.rode = true;
    if (j.stage > 0 && v) { var dec = (lastV - sp) / Math.max(dt, .001); if (dec > 60 && lastV > 7) { j.crash++; lastV = sp; if (j.kind === "taxi") Z.sub && Z.sub("", "Passenger: \"" + pick(ROUGH) + "\"", 2.5); } else if (dec > 15 && lastV > 6) { j.brakeT = (j.brakeT || 0) + dt; if (j.brakeT > .18) { j.brakeT = -1.2; j.rough++; } } else if (j.brakeT > 0) j.brakeT = 0; else if (j.brakeT < 0) j.brakeT = Math.min(0, j.brakeT + dt); }
    lastV = sp;
    // the passenger
    var p = j.pax;
    if (j.kind === "taxi" && p) {
      if (p.pax === "wait") { p.wave = .5; p.a += S.angDiff(Math.atan2(m.y - p.y, m.x - p.x), p.a) * Math.min(1, dt * 5); if (j.stage > 0) p.pax = "board"; }
      if (p.pax === "board") { var tx = v ? v.x : m.x, ty = v ? v.y : m.y, d = Math.hypot(tx - p.x, ty - p.y); if (d < 1.4 || !v) { var i = Z.peds.indexOf(p); if (i >= 0) Z.peds.splice(i, 1); p.pax = "in"; sfx("click"); Z.sub && Z.sub("", "Passenger: \"" + pick(PAX) + "\"", 3); } else p.walk += S.walkTo(Z.W, p, tx, ty, 3.2, dt, null, .4) * 2.6; }
    }
    // a chain: the core has just finished the leg to j.b; send them on instead of ending the job
    if (v && v.cargo != null && v.cargo >= 0) v.cargo = j.kind === "delivery" && j.stage > 0 ? 1 : 0;
    lastStage = j.stage; lastB = j.b;
  };
  // The core calls this when a leg is reached, before it would end the job. True = there is another stop.
  J.nextLeg = function (j) {
    if (!j.chain || !j.chain.length) return false;
    j.legs++; j.earned += j.legPay || Math.round(j.pay * .7); var nx = j.chain.shift(); j.b = nx; j.time = 0; j.limit = j.limit ? Math.round(j.limit * .9) + 20 : 0; sfx("coin");
    if (j.kind === "taxi") { dropPax(j, true); waitingPax(j, { x: Z.me.x + 2, y: Z.me.y + 2 }); j.pax.pax = "board"; }
    toast("<b>Stop " + j.legs + " of " + j.total + " done.</b> Next: " + (j.kind === "taxi" ? "another fare to " : "deliver to ") + "<b>" + nx.name + "</b>."); return true;
  };
  function dropPax(j, quiet) {
    var p = j.pax, m = Z.me, W = Z.W; if (!p || p.pax !== "in") { removePax(j); return; }
    var q = S.push(W, m.x + Math.cos(m.a + 1.5708) * 1.8, m.y + Math.sin(m.a + 1.5708) * 1.8, .45), nr = S.nearRoad(W, q.x, q.y, 80);
    p.x = q.x; p.y = q.y; p.pax = null; p.busy = false; p.freed = true; p.wave = 1.2; p.spd = 0; if (nr) { p.w = S.wanderStart(W, Math.random, { x: nr.x, y: nr.y, r: nr.r }, false); p.side = nr.r.w / 2 + 1.2; }
    Z.peds.push(p); if (!quiet) say(p, pick(score(j) < .5 ? ROUGH : THANKS)); j.pax = null;
  }
  // The job has just ended (the core cleared P.job): hand the vehicle back and say how it went.
  function finish(j) {
    if (j.closed) return; j.closed = true; dropPax(j); returnVeh(j);
  }
  // Extra money and the rating for a finished job. The core adds it to the result it shows.
  J.settle = function (j, r, ok) {
    var P = Z.P, used = j.veh && (Z.me.veh === j.veh || j.rode), f = ok && used ? (j.fee || 0) : 0, tip = ok && (j.kind === "taxi" || j.kind === "delivery") ? Math.round(j.pay * S.RULES.jobTipRate * score(j) / 10) * 10 : 0, chain = j.earned || 0;
    P.money += tip + chain - f; var cash = (r.cash || 0) + tip + chain - f, st = stars(j, !ok);
    P.stats.stars = (P.stats.stars || 0) + st; P.stats.rated = (P.stats.rated || 0) + 1;
    return { cash: cash, tip: tip, fee: f, stars: st, legs: (j.legs || 0) + (ok ? 1 : 0), total: j.total || 1 };
  };
  // Cancel: the vehicle goes back, finished legs are paid, nothing else is lost.
  J.cancel = function (quiet) {
    var P = Z.P, j = P && P.job; if (!j) return false; var paid = j.earned || 0; P.money += paid; P.job = null; j.closed = true; dropPax(j, true); removePax(j); returnVeh(j); J.last = null;
    if (!quiet) { sfx("click"); if (paid && Z.moment) Z.moment("job", { cash: paid, title: "Job cancelled", lines: [j.legs + " of " + j.total + " stops paid"] }); else toast("<b>Job cancelled.</b> " + (j.veh === null && NEED[j.kind] ? "The vehicle has gone back. " : "") + "No pay, no penalty."); }
    try { Z.save && Z.save(); } catch (e) {} return true;
  };

  /* ---------- the ON A JOB card ---------- */
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath(); }
  J.card = null;
  J.draw = function (x) {
    var P = Z.P, j = P && P.job; J.card = null; if (!j || !x || !x.fillText || (Z.bigOpen && Z.bigOpen())) return;
    var X = 14, Y = 134, W = 268, H = 92, key = ""; try { key = Z.api.keyName("cancelJob"); } catch (e) {}
    x.save(); x.fillStyle = "rgba(6,20,16,.88)"; rr(x, X, Y, W, H, 12); x.fill(); x.lineWidth = 2; x.strokeStyle = "#facc15"; x.stroke();
    x.fillStyle = "#facc15"; rr(x, X + 8, Y + 8, 74, 18, 9); x.fill(); x.fillStyle = "#1c1300"; x.font = "900 11px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("ON A JOB", X + 45, Y + 21);
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 13px system-ui, sans-serif"; x.fillText(J.title(j).slice(0, 26), X + 90, Y + 22);
    x.font = "600 12px system-ui, sans-serif"; x.fillStyle = "#e2e8f0"; var txt = S.jobText(j); if (j.veh && Z.me.veh !== j.veh && !(Z.me.veh && suits(Z.me.veh.type, j.kind)) && j.stage === 0 && !j.rode) txt = "Get on the " + (j.veh.type === "keke" ? "yellow keke" : "delivery okada"); x.fillText(txt.length > 40 ? txt.slice(0, 39) + "…" : txt, X + 10, Y + 44);
    var left = j.limit && (j.stage > 0 || j.kind === "lost") ? Math.max(0, Math.ceil(j.limit - j.time)) : 0, earn = (j.earned || 0), est = j.pay + earn;
    x.fillStyle = "#86efac"; x.font = "800 12px system-ui, sans-serif"; x.fillText("Earned " + naira(earn) + "  ·  on finish " + naira(est), X + 10, Y + 62);
    x.fillStyle = left && left < 15 ? "#fca5a5" : "#fde68a"; x.fillText((j.total > 1 ? "Stop " + Math.min(j.total, (j.legs || 0) + 1) + "/" + j.total + "  " : "") + (left ? "⏱ " + left + " s" : j.limit ? "⏱ starts at pick-up" : ""), X + 10, Y + 80);
    var bw = 86, bx = X + W - bw - 8, by = Y + H - 26; x.fillStyle = "rgba(248,113,113,.92)"; rr(x, bx, by, bw, 20, 10); x.fill(); x.fillStyle = "#fff"; x.font = "800 11px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("Cancel" + (key ? " (" + key + ")" : ""), bx + bw / 2, by + 14);
    J.card = { x: bx, y: by, w: bw, h: 20 }; x.restore();
  };
  J.click = function (px, py) { var c = J.card; if (!c || px < c.x - 6 || px > c.x + c.w + 6 || py < c.y - 8 || py > c.y + c.h + 8) return false; return J.cancel(); };
  // 3D: the parcel box on a delivery machine, and a roof sign on the job keke. `part` is the renderer's box helper.
  J.dress = function (m, c, part) {
    if (!c.job || !part) return; var u = m.userData;
    if (!u.jobSign) { u.jobSign = 1; try { if (c.type === "keke") part(m, .5, .16, .7, 0x111827, .1, 1.98, 0); u.box = part(m, .62, .5, .56, 0x9a3412, -.82, c.type === "keke" ? 1.0 : 1.12, 0); part(u.box, .64, .06, .58, 0xfde68a, 0, .2, 0); } catch (e) {} }
    if (u.box) u.box.visible = c.cargo === 1;
  };
  void TAU;
})();
