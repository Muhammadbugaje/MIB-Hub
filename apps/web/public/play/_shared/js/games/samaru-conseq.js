/* Campus story systems: consequences and rumours. A choice is not over when the dialog closes. Days later a text
   arrives, a stranger says what they heard, somebody greets you differently, a little money or food turns up every
   week, and a rumour starts that the twins will happily spread. All of it comes from data (D.CONSEQ, written in
   fslg-story-choices.js) keyed by the flags the choices set, and all of it is saved.
     Z.conseq.check()            look for consequences that are due (run each new day and after every choice)
     Z.conseq.ledger()           → [{ flag, day, done }] what has happened because of you
     Z.rumours.start(id, opt)    start or re-heat a rumour · .heat(idOrKind) → 0..100 · .list() · .squash(id)
   The noticeboard by the Senate shows what people are saying and what you chose. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, K = Z && Z.kit;
  if (!Z || !S || !D || !K) return;
  var C = Z.conseq = {}, R = Z.rumours = {};
  // kind: cheat (your partner hears it), shame (people tease), good (people warm to you), funny (just gist)
  var RUMOUR = R.DEFS = {
    twotimer: { kind: "cheat", heat: 85, title: "You were seeing two people at once", lines: ["Don't date that one. Ask the twins why.", "Two people. At the same time. And called it a scheduling problem.", "I heard both of them now eat together at the buka. Without the two-timer."], daily: { social: -1 } },
    seenwith: { kind: "cheat", heat: 55, title: "You were seen out with {who}", lines: ["I saw that one at the gardens with {who}. Holding the same umbrella o.", "Is that not the person who is dating somebody else? With {who}? Hmm.", "The twins say {who} got flowers. From somebody's somebody."] },
    stoodup: { kind: "shame", heat: 45, title: "You left {who} waiting", lines: ["{who} waited one hour at the garden. Alone. With two drinks.", "Imagine standing somebody up in this economy. Transport is not free."] },
    walletforgetter: { kind: "shame", heat: 40, title: "\"Forgot your wallet\" for three weeks", lines: ["\"I forgot my wallet.\" For three weeks. The wallet has relocated.", "Just say you are broke. We are all broke. It is garri week somewhere."] },
    megawattboy: { kind: "funny", heat: 40, title: "You signed Chief Megawatt's form", lines: ["That's the one who signed for Megawatt. Ask them to dash you a projector.", "Megawatt's own student. Small time now they will name a socket after them."] },
    boardwriter: { kind: "good", heat: 35, title: "Somebody new is writing the noticeboard", lines: ["This week's noticeboard story is different. Funnier. Who is writing it?", "The board said something nice about the porters. About time."], daily: { social: 1 } },
    godwhen: { kind: "good", heat: 50, title: "That native you wore to class", lines: ["God when? Did you see the native?", "Who is the tailor? No, seriously. Who is the tailor?"], daily: { social: 1 } },
    kabirumic: { kind: "funny", heat: 45, title: "DJ Kabiru and the unplugged microphone", lines: ["Kabiru MC'd a full wedding with the mic unplugged. Legend.", "They said his voice carried. It had to. The mic was on holiday."] },
    generous: { kind: "good", heat: 45, title: "You shared food when it was garri week", lines: ["That one shared garri in week four. Week FOUR. Marry them.", "Some people cook for the whole corridor. I know one. I won't say who. It's that one."], daily: { community: 1 } },
    bigspender: { kind: "funny", heat: 40, title: "You have been spending like allowance just landed", lines: ["Big boy things. They bought suya without asking the price.", "Money has entered that one's account. Greet them well; you may need a loan."] },
    builder: { kind: "good", heat: 40, title: "You are building something on the cliff", lines: ["Somebody is building a tower above the Dam. With their own hands!", "The cliff tower has a new floor. I thought that project was a myth."], daily: { community: 1 } }
  };
  function blk(P) { return K.block(P, "cq", { seen: {}, done: {}, week: {}, rum: [], said: 0 }); }
  function tok(id) { try { return Z.story.tok(Z.P, id); } catch (e) { return id; } }
  function fill(t, who) { return String(t).replace(/\{who\}/g, who || "somebody"); }

  /* ---------- rumours ---------- */
  R.start = function (id, opt) {
    var P = Z.P, d = RUMOUR[id]; if (!P || !d) return null; opt = opt || {}; var b = blk(P), key = id + (opt.about ? ":" + opt.about : ""), r = null;
    b.rum.forEach(function (q) { if (q.key === key) r = q; });
    if (!r) { r = { key: key, id: id, about: opt.about || "", heat: 0, day: P.day }; b.rum.push(r); if (b.rum.length > 8) b.rum.shift(); }
    r.heat = Math.min(100, Math.max(r.heat, opt.heat || d.heat) + (r.heat > 0 ? 10 : 0)); r.day = P.day;
    if (!opt.quiet) K.toast("<b>A rumour is going round:</b> " + K.esc(R.title(r)) + ".<br><small>The twins know. So everybody will. Read the noticeboard, or set it straight with Lily or Lyzzy.</small>");
    K.emit({ t: "rumour", id: id, about: r.about, story: true }); return r;
  };
  R.title = function (r) { var d = RUMOUR[r.id] || {}; return fill(d.title || r.id, r.about ? K.name(r.about) : ""); };
  R.list = function () { return Z.P ? blk(Z.P).rum.filter(function (r) { return r.heat > 0; }) : []; };
  R.heat = function (idOrKind) { var h = 0; R.list().forEach(function (r) { var d = RUMOUR[r.id] || {}; if (r.id === idOrKind || r.key === idOrKind || d.kind === idOrKind) h = Math.max(h, r.heat); }); return h; };
  R.squash = function (key, by) { var P = Z.P, ok = false; blk(P).rum.forEach(function (r) { if (r.key === key || r.id === key) { r.heat = Math.max(0, r.heat - (by || 50)); ok = true; } }); return ok; };
  R.lines = function () { var out = []; R.list().forEach(function (r) { var d = RUMOUR[r.id]; if (d) d.lines.forEach(function (l) { out.push(fill(l, r.about ? K.name(r.about) : "")); }); }); return out; };
  function rumourDay(P) {
    var b = blk(P), s = Z.story.state(P);
    b.rum.forEach(function (r) { var d = RUMOUR[r.id] || {}; if (r.heat <= 0) return; if (r.heat >= 40) for (var t in (d.daily || {})) s.standing[t] = K.clamp((s.standing[t] || 0) + d.daily[t], -100, 100); r.heat = Math.max(0, r.heat - (d.kind === "cheat" ? 5 : 7)); });
    b.rum = b.rum.filter(function (r) { return r.heat > 0 || P.day - r.day < 3; });
  }

  /* ---------- consequences ---------- */
  C.apply = function (c, P) {
    var s = Z.story.state(P), b = blk(P);
    if (c.text) { var from = tok(c.text.from); try { if (Z.texts && Z.texts.send) Z.texts.send(K.npcDef(from) ? from : "story:" + from, c.text.text, { name: c.text.name || K.name(from) }); } catch (e) {} C.lastText = [from, c.text.text]; }
    for (var n in (c.friend || {})) S.bond(P, tok(n), c.friend[n]);
    for (var t in (c.standing || {})) s.standing[t] = K.clamp((s.standing[t] || 0) + c.standing[t], -100, 100);
    if (c.money) { P.money = Math.max(0, P.money + c.money); }
    if (c.toast) K.toast(c.toast);
    if (c.rumour) R.start(c.rumour, { quiet: !!c.text });
    hi(c); b.done[c.flag] = P.day; K.emit({ t: "consequence", flag: c.flag, story: true });
  };
  function hi(c) { for (var id in (c.hi || {})) { var d = K.npcDef(id); if (d) { if (!d._hi0) d._hi0 = d.hi; d.hi = c.hi[id]; } } }
  C.check = function () {
    var P = Z.P; if (!P) return 0; var b = blk(P), n = 0;
    (D.CONSEQ || []).forEach(function (c) {
      if (!P.flags[c.flag]) return; if (b.seen[c.flag] == null) b.seen[c.flag] = P.day;
      if (b.done[c.flag] == null) { if (P.day - b.seen[c.flag] >= (c.after == null ? 1 : c.after)) { C.apply(c, P); n++; } return; }
      var w = c.weekly; if (w && P.day - (b.week[c.flag] || b.done[c.flag]) >= 7) { b.week[c.flag] = P.day; if (w.money) { try { Z.money(w.money); } catch (e) { P.money += w.money; } } if (w.energy) P.energy = Math.min(100, P.energy + w.energy); if (w.item && Z.inv) Z.inv.add(w.item, 1, { quiet: true }); if (w.toast) K.toast(w.toast); n++; }
    });
    return n;
  };
  C.ledger = function () { var P = Z.P, b = blk(P), out = []; (D.CONSEQ || []).forEach(function (c) { if (b.seen[c.flag] != null) out.push({ flag: c.flag, day: b.seen[c.flag], done: b.done[c.flag] != null, due: b.seen[c.flag] + (c.after == null ? 1 : c.after) }); }); return out; };
  C.walkerLines = function () { // what passers-by might say today: fresh consequences and live rumours
    var P = Z.P, b = blk(P), out = R.lines(); (D.CONSEQ || []).forEach(function (c) { if (c.walker && b.done[c.flag] != null && P.day - b.done[c.flag] < 21) out = out.concat(c.walker); }); return out;
  };
  K.begin(function (P) { var b = blk(P); (D.NPCS || []).forEach(function (d) { if (d._hi0) { d.hi = d._hi0; d._hi0 = null; } }); (D.CONSEQ || []).forEach(function (c) { if (b.done[c.flag] != null) hi(c); }); C.sayT = 50; });
  K.daily(function (P) { rumourDay(P); C.check(); });
  K.on("picked", function (pk, P) { if (pk.rumour) R.start(pk.rumour); (pk.flags || []).forEach(function (f) { var b = blk(P); if (b.seen[f] == null && (D.CONSEQ || []).some(function (c) { return c.flag === f; })) b.seen[f] = P.day; }); });
  // overheard: a passer-by close to you says one of the lines (never during a menu, a mission beat with lines, or a race)
  K.tick(function (dt, P) {
    C.sayT = (C.sayT == null ? 50 : C.sayT) - dt; if (C.sayT > 0) return; C.sayT = 20; if (K.busy() || Z.race || Z.inside || (Z.story.busy && Z.story.busy())) return;
    var lines = C.walkerLines(); if (!lines.length) { C.sayT = 60; return; } var me = Z.me, ped = null, bd = 12;
    (Z.peds || []).forEach(function (p) { var d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd && !p.fall) { bd = d; ped = p; } }); if (!ped) return;
    var b = blk(P), line = lines[b.said % lines.length]; b.said++; C.sayT = 75 + S.hash(P.day, b.said) * 60; C.lastOverheard = line;
    try { Z.say(ped, line); Z.sub("", "Overheard: “" + line + "”", 5); } catch (e) {}
  });

  /* ---------- the noticeboard ---------- */
  C.board = function () {
    var P = Z.P, e = K.esc, rum = R.list().sort(function (a, b) { return b.heat - a.heat; }), log = (Z.story.state(P).log || []).slice(-6).reverse(), led = C.ledger().filter(function (l) { return !l.done; });
    var body = "<b>What people are saying</b><br>" + (rum.length ? rum.map(function (r) { var d = RUMOUR[r.id] || {}; return "• " + e(R.title(r)) + " <small>(" + (r.heat >= 60 ? "everybody knows" : r.heat >= 30 ? "going round" : "dying down") + (d.kind === "good" ? ", and they like it" : d.kind === "cheat" ? ", and it stings" : "") + ")</small>"; }).join("<br>") : "<small>Nothing about you this week. Enjoy it.</small>") +
      "<br><br><b>What you chose</b><br>" + (log.length ? log.map(function (l) { return "• Day " + l[1] + ": " + e(l[2]); }).join("<br>") : "<small>No big decisions yet.</small>") +
      (led.length ? "<br><br><small>" + led.length + " thing" + (led.length > 1 ? "s" : "") + " you did " + (led.length > 1 ? "have" : "has") + " not finished happening yet.</small>" : "") +
      (Z.prosper ? "<br><br><b>Your pocket</b><br>" + e(Z.prosper.line()) : "");
    K.panel("📌 The noticeboard", body, [{ id: "ok", label: "Walk on", go: true }], function () {});
  };
  function build() {
    var q = K.beside("senate", 2.2, 9); if (!q) return; var a = 0;
    K.prop({ id: "noticeboard", x: q.x, y: q.y, a: a, parts: [[.12, 2.2, .12, 0x5b3a1c, -1.1, 1.1, 0], [.12, 2.2, .12, 0x5b3a1c, 1.1, 1.1, 0], [2.4, 1.3, .1, 0x1f5132, 0, 1.6, 0], [2.6, .14, .3, 0x7c4a21, 0, 2.3, 0], [.5, .6, .02, 0xfef9c3, -.7, 1.65, .07], [.5, .7, .02, 0xffffff, -.05, 1.6, .07], [.5, .5, .02, 0xfecaca, .65, 1.7, .07], [.4, .3, .02, 0xbae6fd, .6, 1.25, .07]] });
    K.spot({ id: "noticeboard", x: q.x, y: q.y, r: 3.2, label: "Read the noticeboard", act: C.board });
  }
  K.begin(build);
  // the twins: set a rumour straight (once a day; honesty works better than gifts)
  K.tick(function () { var F = Z.friends; if (!F || F._cq || !F.items) return; F._cq = 1; var oi = F.items; F.items = function (n, items) { oi.apply(F, arguments); if (!n || (n.id !== "lily" && n.id !== "lyzzy")) return; var rum = R.list().filter(function (r) { return (RUMOUR[r.id] || {}).kind !== "good"; }); if (!rum.length) return; var P = Z.P, used = P.flags.cq_twins === P.day;
    items.push({ label: "Set the record straight", sub: used ? "They have heard you out today" : "About: " + R.title(rum[0]), off: used, run: function () { P.flags.cq_twins = P.day; R.squash(rum[0].key, 45); K.close(); try { Z.say(n, n.id === "lily" ? "Hm. That is not how we heard it. I will tell Lyzzy. Gently." : "So the true story is LESS interesting? Fine. I'll print a correction. Small font."); } catch (e) {} K.toast("The rumour cools: " + K.esc(R.title(rum[0])) + "."); } }); }; });
})();
