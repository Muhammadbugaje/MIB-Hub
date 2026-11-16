/* Freshers School Life — moments. One call, Z.moment(kind, data), stages the beats worth stopping for:
   a passed mission, a new level, a new licence, the end of the story, a race result, a lost job, a knock-down.
   Wins get a banner, confetti, a fanfare, counters that tick up, a victory dance and a slow camera orbit;
   losses get slow motion, a drained picture, a low sting, a kind word and a quick way to try again.
   Moments queue, never pause the game, and need nothing but the arcade api (so they also run headless). */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData;
  var queue = [], cur = null, grey = 0;
  var KIND = {
    mission: { dur: 3.8, good: 1 }, goal: { dur: 3, good: 1 }, job: { dur: 2.6, good: 1 }, level: { dur: 3.4, good: 1 }, unlock: { dur: 3.6, good: 1 },
    finale: { dur: 11, good: 1 }, promotion: { dur: 4, good: 1 }, raceWin: { dur: 4.6, good: 1 }, raceLose: { dur: 5, good: 0 }, escaped: { dur: 3, good: 1 }, caught: { dur: 3.4, good: 0 }, fail: { dur: 3.6, good: 0 }, ko: { dur: 2.8, good: 0 }
  };
  var TUNE = { // [seconds, hertz, length]
    mission: [[0, 523, .14], [.12, 659, .14], [.24, 784, .14], [.38, 1047, .34], [.38, 784, .34], [.38, 659, .34]],
    goal: [[0, 659, .12], [.12, 784, .12], [.24, 988, .3]],
    job: [[0, 784, .1], [.1, 988, .22]],
    promotion: [[0, 523, .1], [.1, 659, .1], [.2, 784, .1], [.32, 1047, .16], [.5, 988, .1], [.62, 1047, .45], [.62, 784, .45]],
    level: [[0, 392, .1], [.09, 494, .1], [.18, 587, .1], [.27, 784, .1], [.36, 988, .1], [.48, 1175, .42], [.48, 784, .42]],
    unlock: [[0, 523, .1], [.1, 523, .1], [.2, 784, .16], [.4, 1047, .4], [.4, 659, .4]],
    finale: [[0, 523, .2], [.2, 523, .1], [.3, 523, .2], [.5, 659, .3], [.8, 587, .2], [1, 659, .2], [1.2, 784, .5], [1.8, 1047, .2], [2, 988, .2], [2.2, 784, .2], [2.4, 880, .3], [2.7, 988, .3], [3, 1047, .9], [3, 784, .9], [3, 659, .9]],
    raceWin: [[0, 659, .1], [.1, 659, .1], [.2, 659, .1], [.32, 880, .3], [.62, 784, .14], [.76, 1047, .5], [.76, 659, .5]],
    raceLose: [[0, 392, .3], [.32, 349, .3], [.64, 311, .3], [.98, 262, .7]],
    fail: [[0, 330, .26], [.28, 294, .26], [.56, 247, .6]],
    ko: [[0, 294, .22], [.24, 262, .22], [.48, 196, .7]],
    escaped: [[0, 587, .1], [.1, 740, .1], [.2, 880, .1], [.32, 1175, .3]],
    caught: [[0, 330, .2], [.22, 262, .5]]
  };
  function api() { return Z.api; }
  function fx(name) { var a = api(); if (a && typeof a[name] === "function") { try { return a[name].apply(a, Array.prototype.slice.call(arguments, 1)); } catch (e) {} } }
  function tone(f, d, good) { var a = api(); try { if (a && a.sound && a.sound.tone) a.sound.tone(f, d, good ? "triangle" : "sine", good ? .11 : .13); } catch (e) {} }
  function sfx(n) { var a = api(); try { if (a && a.sound && a.sound.sfx) a.sound.sfx(n); } catch (e) {} }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function setGrey(v) { // drain the 3D picture (the HUD canvas on top keeps its colour)
    if (v === grey) return; grey = v;
    try { var a = api(), top = a && a.x && a.x.canvas, par = top && top.parentNode, cs = par && par.querySelectorAll ? par.querySelectorAll("canvas") : []; for (var i = 0; i < cs.length; i++) if (cs[i] !== top) { cs[i].style.transition = "filter .45s ease"; cs[i].style.filter = v ? "grayscale(.85) brightness(.82)" : ""; } } catch (e) {}
  }
  function idleFeet() { var a = api(), me = Z.me; if (!me || me.veh || me.fall || me.sit) return false; try { if (a.down("up") || a.down("down") || a.down("left") || a.down("right")) return false; } catch (e) {} return !(Z.stick && Z.stick.on) && !(Z.foes && Z.foes.length); }

  Z.moment = function (kind, data) {
    if (!KIND[kind]) return null; var m = { kind: kind, d: data || {}, t: 0, dur: KIND[kind].dur, good: KIND[kind].good, note: 0, wave: 0, tick: 0 };
    if (kind === "level" && cur && cur.kind === "level") { cur.d = m.d; cur.t = Math.min(cur.t, .5); return cur; } // several levels at once: one card, latest numbers
    if (!m.good) { for (var i = queue.length - 1; i >= 0; i--) if (!queue[i].good) queue.splice(i, 1); queue.unshift(m); if (cur && !cur.good) cur.t = cur.dur; } else { for (var j = queue.length - 1; j >= 0; j--) if (queue[j].kind === kind && kind !== "finale") queue.splice(j, 1); queue.push(m); while (queue.length > 4) queue.splice(queue[0].good ? 0 : 1, 1); } // a backlog never builds: the newest of each kind wins
    if (!cur) next(); return m;
  };
  Z.momentBusy = function () { return !!cur || queue.length > 0; };
  Z.momentClear = function () { queue.length = 0; cur = null; setGrey(0); };
  function next() { cur = queue.shift() || null; if (cur) begin(cur); else setGrey(0); }

  function begin(m) {
    var d = m.d, me = Z.me, P = Z.P;
    m.rows = []; m.lines = [];
    if (m.kind === "mission") {
      fx("banner", "MISSION PASSED", { col: "#86efac", edge: "#14532d", size: 76, sub: d.title || "", dur: 3.2 }); fx("confetti", 160); fx("slowmo", .4, .7); fx("buzz", [40, 60, 40, 60, 120]);
      if (d.cash) m.rows.push({ label: "Cash", val: d.cash, money: 1, col: "#86efac" }); if (d.xp) m.rows.push({ label: "XP", val: d.xp, col: "#fde047" }); m.head = d.title || "Mission passed"; m.dance = 3.2;
    } else if (m.kind === "goal") {
      fx("banner", "GOAL COMPLETE", { col: "#fde047", size: 70, sub: d.title || "", dur: 2.8 }); fx("confetti", 120);
      if (d.cash) m.rows.push({ label: "Cash", val: d.cash, money: 1, col: "#86efac" }); if (d.xp) m.rows.push({ label: "XP", val: d.xp, col: "#fde047" }); m.head = d.title || "Goal complete"; m.dance = 2.2;
    } else if (m.kind === "job") {
      fx("banner", "JOB DONE", { size: 70, col: "#86efac", sub: d.fast ? "Speed bonus!" : "", dur: 2 }); fx("confetti", 60);
      if (d.cash) m.rows.push({ label: "Pay", val: d.cash, money: 1, col: "#86efac" }); if (d.xp) m.rows.push({ label: "XP", val: d.xp, col: "#fde047" }); m.head = (d.title || "Job done") + (d.stars ? "  " + "★★★★★".slice(0, d.stars) + "☆☆☆☆☆".slice(0, 5 - d.stars) : "");
      if (d.tip) m.lines.push("Includes a " + naira(d.tip) + " tip for smooth driving"); if (d.fee) m.lines.push("Vehicle hire " + naira(d.fee) + " taken out"); if (d.total > 1) m.lines.push(d.legs + " of " + d.total + " stops"); if (d.lines) d.lines.forEach(function (l) { m.lines.push(l); });
    } else if (m.kind === "level") {
      fx("banner", "LEVEL " + d.lvl, { col: "#fde047", sub: d.title || "", dur: 2.8, size: 100 }); fx("confetti", 200); fx("flash", "#fde047", .25); fx("buzz", [30, 40, 60]);
      m.head = "Level " + d.lvl + (d.title ? " · " + d.title : ""); m.lines = (d.unlocks || []).map(function (u) { return "New licence: " + u; }); if (!m.lines.length && d.next) m.lines.push(d.next); m.dance = 3; m.waves = 1;
      if (d.unlocks && d.unlocks.length) { m.dur += 1; m.waves = 2; }
    } else if (m.kind === "unlock") {
      fx("banner", "UNLOCKED", { col: "#7ef0ff", edge: "#0b4a5c", size: 84, sub: d.name || "", dur: 3 }); fx("confetti", 180); fx("flash", "#7ef0ff", .25);
      m.head = d.name || "Unlocked"; if (d.text) m.lines.push(d.text); m.dance = 3; m.waves = 2;
    } else if (m.kind === "promotion") {
      fx("banner", d.banner || "PROMOTED", { col: "#fde047", edge: "#7c2d12", size: 88, sub: d.title || d.name || "", dur: 3.2 }); fx("confetti", 200); fx("flash", "#fde047", .25); fx("buzz", [30, 40, 60]);
      m.head = d.title || d.name || "Promoted"; if (d.text) m.lines.push(d.text); if (d.cash) m.rows.push({ label: "Cash", val: d.cash, money: 1, col: "#86efac" }); if (d.xp) m.rows.push({ label: "XP", val: d.xp, col: "#fde047" }); m.dance = 3.2; m.waves = 2;
    } else if (m.kind === "finale") {
      fx("banner", d.banner || "STORY COMPLETE", { col: "#fde047", edge: "#7c2d12", size: 84, sub: d.sub || "You carried the whole school.", dur: 6 }); fx("confetti", 240); fx("slowmo", .35, 1.4); fx("flash", "#fff7cc", .5); fx("buzz", [60, 60, 60, 60, 200]);
      m.head = (Z.resolveText || String)("{{GAME_NAME}}"); m.waves = 7; m.dance = 9;
      if (P) { m.rows.push({ label: "Days on campus", val: P.day || 1, col: "#e2e8f0" }, { label: "Level", val: P.lvl || 1, col: "#fde047" }, { label: "Kilometres", val: Math.round(P.stats.km * 10) / 10, col: "#7dd3fc", dec: 1 }, { label: "Cash", val: Math.max(0, P.money), money: 1, col: "#86efac" }); }
      m.lines.push("The campus is yours now: races, jobs, classes and the road to level 100.", "A game by " + ((D && D.CREATOR && D.CREATOR.full) || "M.I. BUGAJE"));
    } else if (m.kind === "raceWin") {
      fx("banner", "1ST PLACE", { col: "#fde047", size: 100, sub: (d.name || "") + (d.cup ? " · " + d.cup : ""), dur: 3 }); fx("confetti", 220); fx("slowmo", .4, 1); fx("buzz", [40, 40, 40, 40, 160]);
      m.head = d.name || "Race won"; m.podium = d.podium || null; if (d.cash) m.rows.push({ label: "Prize", val: d.cash, money: 1, col: "#86efac" }); if (d.time) m.lines.push("Your time " + d.time + " s" + (d.best ? "  ·  new best" : "")); m.waves = 3; m.dance = 3;
    } else if (m.kind === "raceLose") {
      fx("banner", d.place ? ordinal(d.place) + " PLACE" : "BEATEN", { sad: true, col: "#94a3b8", size: 90, sub: d.name || "", dur: 2.8 }); fx("slowmo", .35, 1.1); fx("flash", "#0b1020", .6); sfx("lose");
      m.head = d.name || "Race lost"; m.podium = d.podium || null; m.lines.push(d.text || "So close. Brake before the bend, then power out."); m.retry = d.retry || null; m.retryLabel = "Race again";
    } else if (m.kind === "fail") {
      fx("banner", d.banner || "NOT THIS TIME", { sad: true, col: "#94a3b8", size: 76, dur: 2.4 }); fx("slowmo", .45, .7); fx("flash", "#0b1020", .45); sfx("lose");
      m.head = d.title || "It slipped away"; m.lines.push(d.text || "It happens. Breathe, then go again."); m.retry = d.retry || null; m.retryLabel = d.retryLabel || "Try again";
    } else if (m.kind === "escaped") {
      fx("banner", "YOU LOST THEM", { col: "#7ef0ff", edge: "#0b4a5c", size: 76, dur: 2.4 }); fx("confetti", 70); fx("buzz", [30, 30, 80]);
      m.head = "Clean getaway"; m.lines.push(d.text || "They gave up. Keep your head down for a while."); m.dance = 2;
    } else if (m.kind === "caught") {
      fx("banner", "CAUGHT", { sad: true, col: "#93c5fd", edge: "#1e3a8a", size: 80, dur: 2.2 }); fx("flash", "#0b1020", .4); sfx("whistle");
      m.head = "A talking-to, nothing more"; if (d.fine) m.rows.push({ label: "Fine", val: d.fine, money: 1, neg: 1, col: "#fca5a5" }); m.lines.push(d.text || "Your warnings are wiped. Go and sin no more.");
    } else if (m.kind === "ko") {
      fx("banner", "KNOCKED DOWN", { sad: true, col: "#fca5a5", edge: "#450a0a", size: 80, dur: 2.2 }); fx("slowmo", .3, 1); fx("flash", "#000", .9); sfx("lose");
      m.head = "Back on your feet"; m.lines.push(d.text || "Everybody falls. Stand up.");
    }
    if (!m.good) setGrey(1);
    if (m.dance && me && idleFeet()) { me.emote = "cheer"; me.emoteT = m.dance; m.orbit = 1; } // fists in the air
    else if (!m.good && me && !me.veh && !me.fall) { me.emote = "sad"; me.emoteT = m.dur - .3; } // head down
    else if (m.good && me && me.veh && (m.kind === "raceWin" || m.kind === "finale")) m.orbit = 1;
  }
  function ordinal(n) { return n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH"); }

  // Called every frame from the game loop, even while a menu is open (so the queue can never jam).
  Z.momentTick = function (dt) {
    if (!cur) { if (queue.length) next(); return; }
    var m = cur, t0 = m.t, tune = TUNE[m.kind] || []; m.t += dt;
    while (m.note < tune.length && tune[m.note][0] <= m.t) { tone(tune[m.note][1], tune[m.note][2], m.good); m.note++; }
    if (m.waves && m.wave < m.waves && m.t > 1.2 * (m.wave + 1)) { m.wave++; fx("confetti", 140, 180 + Math.random() * 600, 120 + Math.random() * 120); if (m.kind === "finale") sfx("coin"); }
    if (m.rows.length && m.t > .55 && m.t < 1.9) { m.tick -= dt; if (m.tick <= 0) { m.tick = .075; tone(1200 + (m.t - .55) * 500, .03, 1); } }
    if (m.orbit && m.t < Math.min(m.dur - .4, 3.6) && Z.r3 && Z.r3.ready && Z.r3.turn && Z.mode === "play") { if (m.kind !== "finale" && !idleFeet() && !(Z.me && Z.me.veh)) m.orbit = 0; else if (!Z.r3.locked) Z.r3.turn(dt * .55); }
    if (!m.good && m.t > Math.max(1.2, m.dur - 1) && t0 <= Math.max(1.2, m.dur - 1)) setGrey(0);
    if (m.t >= m.dur) { cur = null; next(); }
  };
  function hasRetry(m) { return m && m.retry && m.t > .5 && m.t < m.dur; }
  // E (or a tap on the button) takes the offered retry. Returns true when it used the press.
  Z.momentAct = function () { if (!hasRetry(cur)) return false; var f = cur.retry; cur = null; setGrey(0); next(); try { f(); } catch (e) {} return true; };
  Z.momentClick = function (px, py) { var m = cur; if (!hasRetry(m) || !m.btn) return false; if (px < m.btn.x || px > m.btn.x + m.btn.w || py < m.btn.y || py > m.btn.y + m.btn.h) return false; return Z.momentAct(); };

  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath(); }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }
  // The result card: slides up under the banner, counts the rewards up, shows a podium after races.
  Z.momentDraw = function (x) {
    var m = cur; if (!m || !x || !x.fillText) return; if (!m.rows.length && !m.lines.length && !m.podium && !m.retry) return;
    var inn = ease(m.t / .35), out = ease((m.dur - m.t) / .3), a = Math.min(inn, out); if (a <= 0 || m.t < .25) return;
    var w = m.podium ? 440 : 380, ph = m.podium ? 92 : 0, h = 40 + m.rows.length * 26 + m.lines.length * 19 + ph + (m.retry ? 42 : 0) + 10, cx = 480, top = 326 + (1 - inn) * 40, y = top, i;
    if (top + h > 534) top = y = 534 - h;
    x.save(); x.globalAlpha = a;
    x.fillStyle = m.good ? "rgba(6,20,16,.86)" : "rgba(12,16,28,.88)"; rr(x, cx - w / 2, top, w, h, 14); x.fill(); x.lineWidth = 2; x.strokeStyle = m.good ? "rgba(134,239,172,.75)" : "rgba(148,163,184,.7)"; x.stroke();
    x.textAlign = "center"; x.textBaseline = "alphabetic"; x.font = "800 16px system-ui, sans-serif"; x.fillStyle = m.good ? "#fef9c3" : "#e2e8f0"; x.fillText(String(m.head || "").slice(0, 44), cx, top + 26); y = top + 40;
    if (m.podium) { podium(x, m, cx, y, w - 40, ph - 8); y += ph; }
    var k = ease((m.t - .55) / 1.3);
    for (i = 0; i < m.rows.length; i++) { var r = m.rows[i], v = r.val * k, txt = r.money ? (r.neg ? "−" : "+") + naira(v) : r.dec ? v.toFixed(r.dec) : (r.label === "XP" ? "+" : "") + Math.round(v).toLocaleString();
      x.font = "600 14px system-ui, sans-serif"; x.textAlign = "left"; x.fillStyle = "rgba(226,232,240,.85)"; x.fillText(r.label, cx - w / 2 + 28, y + 16); x.textAlign = "right"; x.font = "800 17px system-ui, sans-serif"; x.fillStyle = r.col || "#fff"; x.fillText(txt, cx + w / 2 - 28, y + 17); y += 26; }
    x.textAlign = "center"; x.font = "600 13px system-ui, sans-serif"; x.fillStyle = m.good ? "#bbf7d0" : "#cbd5e1";
    for (i = 0; i < m.lines.length; i++) { x.fillText(String(m.lines[i]).slice(0, 64), cx, y + 15); y += 19; }
    if (m.retry) { var bw = 200, bx = cx - bw / 2, by = y + 8, key = ""; try { key = api().keyName("act"); } catch (e) {} m.btn = { x: bx, y: by, w: bw, h: 30 };
      x.fillStyle = "#22d3ee"; rr(x, bx, by, bw, 30, 15); x.fill(); x.fillStyle = "#04121a"; x.font = "800 14px system-ui, sans-serif"; x.fillText("↻ " + m.retryLabel + (key ? "  (" + key + ")" : ""), cx, by + 20); }
    x.restore();
  };
  function podium(x, m, cx, y, w, h) { // three steps; whoever came 1st stands in the middle
    var p = m.podium.slice(0, 3), slot = [1, 0, 2], hs = [h * .62, h * .44, h * .3], cols = ["#fde047", "#cbd5e1", "#d6a06a"], bw = w / 3 - 10, rise = ease((m.t - .4) / .7);
    for (var i = 0; i < p.length; i++) { var s = slot[i], bx = cx - w / 2 + s * (w / 3) + 5, bh = hs[i] * rise, by = y + h - bh;
      x.fillStyle = p[i].me ? cols[i] : "rgba(148,163,184,.55)"; rr(x, bx, by, bw, bh + 2, 5); x.fill(); if (p[i].me) { x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke(); }
      x.fillStyle = "#0f172a"; x.font = "900 16px system-ui, sans-serif"; x.textAlign = "center"; if (bh > 20) x.fillText(String(i + 1), bx + bw / 2, by + 19);
      x.fillStyle = p[i].me ? "#fff" : "#e2e8f0"; x.font = (p[i].me ? "800" : "600") + " 12px system-ui, sans-serif"; x.fillText(String(p[i].name).slice(0, 14) + (p[i].time ? "  " + p[i].time + "s" : ""), bx + bw / 2, by - 6); }
  }
  void S;
})();
