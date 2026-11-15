/* Freshers School Life — people who react.
   Getting knocked over: down, lie still, get up, dust off, then do something about it. Nobody dies.
   Being hit: timid people shout and run; ordinary people hit back once or twice and walk off; tough ones square
   up, wind up where you can see it (dodge or block), chase a short way, then leave you with a warning. Keep
   swinging and it becomes a short fight: they have stamina, and at the bottom of it they put their hands up.
   On the road: walkers wait at the kerb for traffic, and jump clear when something fast bears down on them.
   Every spoken line is fixed text from the tables below and goes out through Z.say. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, B = Z.brawl = {}, TAU = Math.PI * 2, rnd = Math.random;
  var SAY = {
    hurt: ["Ah! What was that for?", "Ye! My body!", "Are you mad?", "Who sent you?"],
    scared: ["Abeg! I don't want trouble!", "Leave me alone!", "Somebody help!", "I'm going, I'm going!"],
    back: ["You think I can't fight?", "Take your own!", "Oya, collect!", "Try me again!"],
    tough: ["You want to try me?", "Wrong person today.", "Square up then.", "I will humble you."],
    enough: ["Don't try that again.", "Next time, think first.", "Respect yourself.", "I'm letting you go. Once."],
    warn: ["Run now. I know your face.", "Keep running. And keep far from me.", "That is your warning."],
    yield: ["Okay okay! It's enough!", "I surrender, abeg!", "Stop! You win!", "No more, please!"],
    up: ["My back o...", "Who does that?!", "I will report you.", "Chai."],
    car: ["Are you blind?! This is a school!", "My leg! Driver, come down!", "You no dey see road?!"],
    dodge: ["Hey! Slow down!", "Jesus! Careful!", "This one wants to kill somebody."],
    gasp: ["Ah ah! What is this?", "Fight! Fight!", "Somebody call security!", "Leave him alone o!", "This campus self."],
    film: ["I am recording o.", "World Star!", "This one is going online."],
    shout: ["You hit somebody! Stop!", "Driver! You have knocked person!", "Security! Security!"],
    friendNo: ["Ah! Stop it. Leave them alone.", "What are you doing?! That is not you.", "Abeg, let us go. Please."],
    friendIn: ["Leave my friend alone!", "It is two of us now.", "Touch my person again and see."],
    npc: ["What is wrong with you?!", "After everything? Wow.", "I will remember this."],
    guard: ["You dare?! Assaulting an officer!", "Now you have done it."]
  };
  B.SAY = SAY;
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function say(o, t) { try { if (Z.say) Z.say(o, t); } catch (e) {} }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  function fx(name, a, b, c, d) { try { if (Z.fx && Z.fx[name]) Z.fx[name](a, b, c, d); } catch (e) {} }
  function offend(k) { try { if (Z.offend) Z.offend(k); } catch (e) {} }
  function turn(o, x, y, dt) { o.a += S.angDiff(Math.atan2(y - o.y, x - o.x), o.a) * Math.min(1, dt * 8); }
  function still(o, dt) { o.spd = (o.spd || 0) * Math.exp(-12 * dt); }

  /* ---------- knocked down, and back up ---------- */
  // secs = time lying still once they have landed. ang/kv/kz = which way and how hard they are thrown.
  B.down = function (o, secs, ang, kv, kz, hard) {
    o.fall = Math.max(.4, secs); o.kv = 1; o.kx = Math.cos(ang || 0) * (kv || 0); o.ky = Math.sin(ang || 0) * (kv || 0); o.kz = kz || 2.4; o.air = .05; o.getUpT = 0; o.dustT = 0; o.wind = 0; o.atkT = 0; o.hard = !!hard; o.dodge = 0; o.spd = 0; o.kvx = o.kvy = 0; o.wasDown = 1;
  };
  // True while they are in the air, on the ground, getting up or dusting off: the caller must not move them.
  B.downed = function (o, dt) {
    if (o.fall > 0) {
      if (o.kv) { var r = o.def && o.def.r ? o.def.r : .4, p = S.push(Z.W, o.x + o.kx * dt, o.y + o.ky * dt, r); o.x = p.x; o.y = p.y; var k = Math.exp(-2.5 * dt); o.kx *= k; o.ky *= k; o.kz -= 18 * dt; o.air = Math.max(0, (o.air || 0) + o.kz * dt); if (o.air <= 0) { o.kv = 0; o.air = 0; o.kx = o.ky = 0; fx("dust", o.x, o.y, 6, .8); } }
      else { o.fall -= dt; if (o.fall <= 0) { o.fall = 0; o.getUpT = .001; } }
      o.kvx = o.kvy = 0; o.spd = 0; return true;
    }
    if (o.fall < 0 || o.fall !== o.fall) o.fall = 0;
    if (o.getUpT > 0) { o.getUpT += dt / (o.hard ? 1.4 : .9); if (o.getUpT >= 1) { o.getUpT = 0; o.dustT = o.mood === 0 && !o.hard ? .05 : .8; } /* the timid do not stop to dust off: they scramble up and go */ o.spd = 0; o.kvx = o.kvy = 0; return true; }
    if (o.dustT > 0) { o.dustT -= dt; if (o.dustT <= 0) { o.dustT = 0; if (o.wasDown) { o.wasDown = 0; o.rose = 1; } } o.spd = 0; return true; }
    return false;
  };

  /* ---------- the road ---------- */
  function onRoad(x, y) { var nr = S.nearRoad(Z.W, x, y, 14, true); return !!nr && nr.d < nr.r.w / 2 - .2; }
  B.onRoad = onRoad;
  function threats() { var m = Z.me, l = B._th; if (l && B._thT === Z.api.t) return l; l = B._th = []; B._thT = Z.api.t; if (m.veh && m.alt < .05 && Math.abs(m.veh.speed) > 2) l.push({ x: m.veh.x, y: m.veh.y, a: Math.atan2(m.veh.vy, m.veh.vx), s: Math.hypot(m.veh.vx, m.veh.vy), mine: 1 }); for (var i = 0; i < Z.traffic.length; i++) { var t = Z.traffic[i]; if (t.v > 2) l.push({ x: t.x, y: t.y, a: t.a, s: t.v }); } return l; }
  // Is something coming that could not stop for a person at (x, y)?
  function coming(x, y, wide) { var l = threats(); for (var i = 0; i < l.length; i++) { var t = l[i], dx = x - t.x, dy = y - t.y, fw = dx * Math.cos(t.a) + dy * Math.sin(t.a), sd = Math.abs(dy * Math.cos(t.a) - dx * Math.sin(t.a)); if (fw > -1 && fw < t.s * t.s / 10 + t.s * 1.2 + 6 && sd < (wide || 6)) return t; } return null; }
  // Where may a walker (or a car) appear? Never in view, never where you will be in the next six seconds.
  B.okSpawn = function (q, draw, far2d) {
    var m = Z.me, v = m.veh, dx = q.x - m.x, dy = q.y - m.y, d = Math.hypot(dx, dy), sp = v ? Math.hypot(v.vx, v.vy) : (m.speed || 0), reach = Math.max(40, sp * 6);
    if (d < reach) return false;
    var ha = v ? (sp > 1 ? Math.atan2(v.vy, v.vx) : v.a) : m.a, fw = dx * Math.cos(ha) + dy * Math.sin(ha), sd = Math.abs(dy * Math.cos(ha) - dx * Math.sin(ha));
    if (sp > 3 && fw > 0 && fw < reach + 30 && sd < 14) return false; // in your way
    if (!(Z.r3 && Z.r3.ready)) return d > (far2d || 45);
    if (d > draw) return true;
    var yw = Z.r3.yaw || 0, inCone = (dx * Math.cos(yw) + dy * Math.sin(yw)) / (d || 1) > .12;
    return !inCone || !S.los(Z.W, m.x, m.y, q.x, q.y); // behind the camera, or hidden by a building
  };

  /* ---------- walkers ---------- */
  function init(n) { if (n.mood != null) return; var h = S.hash((n.k || 0) + 3, Math.floor((n.sp || 1) * 977)); n.mood = h < .4 ? 0 : h < .8 ? 1 : 2; n.maxHp = n.hp = n.mood === 0 ? 3 : n.mood === 1 ? 6 : 10; n.back = 0; n.cd = 0; n.st = ""; }
  B.mood = function (n) { init(n); return ["timid", "normal", "tough"][n.mood]; };
  function bystanders(o, lines, shout) {
    var said = 0; for (var i = 0; i < Z.peds.length; i++) { var p = Z.peds[i]; if (p === o || p.fall > 0 || p.st || p.getUpT > 0) continue; var d = Math.hypot(p.x - o.x, p.y - o.y); if (d > 14) continue; init(p); p.st = "watch"; p.t = 2.5 + rnd() * 3; p.film = rnd() < .35; p.wx = o.x; p.wy = o.y; if (said < (shout ? 2 : 1) && rnd() < .7) { said++; say(p, pick(p.film ? SAY.film : lines)); } }
  }
  var friendT = -99;
  function friends(o, started) {
    if (!Z.friends || !Z.P) return; var c = Z.friends.companions(), t = Z.api.t; if (!c.length) return; var f = c[0];
    if (started) { if (t - friendT < 20) return; friendT = t; say(f, pick(SAY.friendNo)); if (Z.P.friends[f.id] > 1) S.bond(Z.P, f.id, -1); }
    else if (!o.helped) { o.helped = 1; say(f, pick(SAY.friendIn)); f.wave = .8; o.hp -= 2; o.hitT = .35; o.hitA = Math.atan2(o.y - f.y, o.x - f.x); fx("knock", o, o.hitA, 4); }
  }
  // You hit a walker. kind: punch | kick | tackle | shove | car
  B.hit = function (n, ang, heavy, kind) {
    init(n); var m = Z.me; n.hits = (n.hits || 0) + 1; n.aggro = Z.api.t; n.hitT = .35; n.hitA = ang; n.wave = 0; n.hold = false;
    if (kind !== "shove") n.hp -= heavy ? 2 : 1;
    offend(kind === "shove" ? "bump" : "shove"); fx("hit", n, ang, heavy, "ped"); bystanders(n, SAY.gasp); friends(n, true);
    var down = kind === "tackle" || n.hp <= 0 || (heavy && (n.mood === 0 || rnd() < .55)) || (n.mood === 0 && kind !== "shove" && rnd() < .35);
    if (n.st === "fight" && n.wind > 0) n.wind = 0; // a clean hit breaks their wind-up
    if (down) B.down(n, n.hp <= 0 ? 3 : 1.6 + rnd() * .9, ang, heavy ? 6 : 3.6, heavy ? 4.2 : 2.6, n.hp <= 0); else fx("knock", n, ang, kind === "shove" ? 6 : 2.6);
    if (n.hp <= 0) n.hp = 0;
    n.react = .45; if (!n.st || n.st === "watch" || n.st === "leave") say(n, pick(SAY.hurt));
    void m;
  };
  function runOver(n, v) {
    init(n); var sp = Math.hypot(v.vx, v.vy), a = Math.atan2(v.vy, v.vx), hard = sp > 9;
    B.down(n, 2.4 + Math.min(3, sp * .12), a + (rnd() - .5) * .6, sp * .7, 4 + sp * .22, hard); n.hp = Math.max(1, n.hp - 3); n.limp = hard ? 16 : 8; n.sitAfter = hard && rnd() < .5 ? 5 : 0; n.st = "hurt"; n.react = 0;
    offend("hitPed"); fx("hit", n, a, true, "car"); say(n, pick(SAY.car)); bystanders(n, SAY.shout, true);
  }
  function react(n, d) {
    var m = Z.me; n.react = 0;
    if (n.hp <= Math.max(1, n.maxHp * .25) && n.hits > 1) { n.st = "yield"; n.t = 2; say(n, pick(SAY.yield)); return; }
    if (n.mood === 0) { n.st = "flee"; n.t = 5 + rnd() * 2; say(n, pick(SAY.scared)); return; }
    if (n.mood === 1) { if (n.back >= 2) { leave(n, SAY.enough); return; } n.st = "fight"; n.left = 2 - n.back; n.ft = 7; n.cd = .25; say(n, pick(SAY.back)); return; }
    n.st = "fight"; n.left = 99; n.ft = 14; n.cd = .3; n.runKicks = 0; if (n.hits <= 1 || rnd() < .3) say(n, pick(SAY.tough)); void m; void d;
  }
  function leave(n, lines) { n.st = "leave"; n.t = 3.5; n.wind = 0; if (lines) say(n, pick(lines)); }
  function fight(n, dt, d) {
    var m = Z.me, W = Z.W; n.ft -= dt; n.cd -= dt; turn(n, m.x, m.y, dt);
    if (m.fall > 0 || m.veh || Z.mode !== "play") { leave(n, m.fall > 0 ? SAY.enough : null); return; }
    var calm = Z.api.t - (n.aggro || 0);
    if (n.mood === 1 && d > 7) { leave(n, SAY.enough); return; }             // you walked away: they let you go
    if (n.mood === 2 && (d > 22 || n.ft <= 0 || (calm > 5 && n.back >= 2))) { leave(n, d > 8 ? SAY.warn : SAY.enough); return; }
    if (n.left <= 0 && !(n.wind > 0)) { leave(n, SAY.enough); return; }
    if (n.wind > 0) { // the telegraph: they stand and wind up; step away, dash through or block
      n.wind -= dt; still(n, dt);
      if (n.wind <= 0) { n.atkT = .26; n.combo = n.kick ? 2 : 1; sfx("kick");
        var reach = n.kick ? 2.0 : 1.7, facing = Math.abs(S.angDiff(Math.atan2(m.y - n.y, m.x - n.x), n.a)) < 1.0;
        if (d < reach && facing && !(m.inv > 0) && (!Z.clearReach || Z.clearReach(n, m))) { var dmg = (n.kick ? 5 : 3) + (n.mood === 2 ? 1 : 0), blocked = m.block && Math.abs(S.angDiff(Math.atan2(n.y - m.y, n.x - m.x), m.a)) < 1.3;
          if (blocked) { dmg = 1; sfx("block"); fx("sparks", m.x, 1.3, m.y, 5, 0xfde68a); m.hitT = .15; m.hitA = n.a; if (Z.float) Z.float(m.x, m.y - 1.6, "BLOCK", "#fde68a"); Z.P.hp = Math.max(1, Z.P.hp - dmg); }
          else if (Z.hurt) Z.hurt(dmg, n);
          n.landed = (n.landed || 0) + 1; if (n.landed >= 2 && calm > 2) friends(n, false); }
        n.back++; n.left--; if (n.kick && m.speed > S.FOOT.walk + 1) n.runKicks = (n.runKicks || 0) + 1; n.cd = .8 + rnd() * .7; }
      return; }
    var fleeing = (m.speed || 0) > S.FOOT.walk + 1 && d > 2.2;
    if (n.mood === 2 && fleeing && (n.runKicks || 0) >= 2) { leave(n, SAY.warn); return; }
    if (d < (fleeing ? 2.1 : 1.5) && n.cd <= 0) { n.wind = fleeing ? .32 : .5; n.kick = fleeing || (n.mood === 2 && rnd() < .4); still(n, dt); return; }
    if (d > 1.3) { var sp = n.mood === 2 ? (d > 4 ? S.FOOT.run * .84 : 3.6) : 3; n.walk += S.walkTo(W, n, m.x, m.y, sp, dt, null, .38) * 2.6; } else still(n, dt);
  }
  // Called for every walker each frame, before the ordinary wandering. True = handled, leave them be.
  B.ped = function (n, dt, d) {
    var m = Z.me, v = m.veh, W = Z.W; init(n);
    if (n.atkT > 0) n.atkT = Math.max(0, n.atkT - dt); if (n.scT > 0) n.scT -= dt; if (n.limp > 0) n.limp -= dt;
    if (B.downed(n, dt)) return true;
    if (n.rose) { n.rose = 0; if (n.st === "hurt") { n.st = n.sitAfter ? "sit" : "leave"; n.t = n.sitAfter || 3; say(n, pick(SAY.up)); } else if (!n.react) n.react = .05; }
    // traffic and your own machine
    if (v && m.alt < .05) {
      var sp = Math.hypot(v.vx, v.vy);
      if (sp > 4.5 && d < S.VEH[v.type].len * .4 + .8) { runOver(n, v); return true; }
      if (sp > 4 && !(n.dodge > 0)) { var va = Math.atan2(v.vy, v.vx), dx = n.x - v.x, dy = n.y - v.y, fw = dx * Math.cos(va) + dy * Math.sin(va), sd = dy * Math.cos(va) - dx * Math.sin(va);
        if (fw > 0 && fw < sp * 1.3 + 7 && Math.abs(sd) < 2.6) { n.dodge = .7; n.da = va + (sd >= 0 ? 1.5708 : -1.5708); n.st = n.st === "fight" ? "" : n.st; if (!(n.scT > 0)) { n.scT = 8; if (rnd() < .5) say(n, pick(SAY.dodge)); if (sp > 13 && fw < 12) offend("reckless"); } } }
    }
    if (n.dodge > 0) { n.dodge -= dt; n.walk += S.walkTo(W, n, n.x + Math.cos(n.da) * 4, n.y + Math.sin(n.da) * 4, 7, dt, null, .38) * 2.6; n.hold = false; return true; }
    if (n.react > 0) { n.react -= dt; still(n, dt); turn(n, m.x, m.y, dt); if (n.react <= 0) react(n, d); return true; }
    switch (n.st) {
      case "fight": fight(n, dt, d); return true;
      case "flee": n.t -= dt; var fa = Math.atan2(n.y - m.y, n.x - m.x); n.walk += S.walkTo(W, n, n.x + Math.cos(fa) * 6, n.y + Math.sin(fa) * 6, n.limp > 0 ? 3 : 6.4, dt, null, .38) * 2.6; if (n.t <= 0 || d > 45) n.st = ""; return true;
      case "yield": n.t -= dt; still(n, dt); turn(n, m.x, m.y, dt); if (n.t <= 0) { n.st = "flee"; n.t = 4; n.limp = 10; } return true;
      case "leave": n.t -= dt; var la = Math.atan2(n.y - m.y, n.x - m.x); n.walk += S.walkTo(W, n, n.x + Math.cos(la) * 5, n.y + Math.sin(la) * 5, n.limp > 0 ? 1.2 : 2.4, dt, null, .38) * 2.6; if (n.t <= 0) { n.st = ""; n.back = Math.max(0, n.back - 1); } return true;
      case "sit": n.t -= dt; n.sit = true; still(n, dt); if (n.t <= 0) { n.sit = false; n.st = ""; } return true;
      case "watch": n.t -= dt; turn(n, n.wx, n.wy, dt); var wd = Math.hypot(n.wx - n.x, n.wy - n.y); if (wd < 5) { var wa = Math.atan2(n.y - n.wy, n.x - n.wx); n.walk += S.walkTo(W, n, n.x + Math.cos(wa) * 3, n.y + Math.sin(wa) * 3, 2.6, dt, null, .38) * 2.6; turn(n, n.wx, n.wy, dt * 3); } else still(n, dt); if (n.t <= 0) { n.st = ""; n.film = false; } return true;
    }
    n.sit = false;
    // kerb drill: look before stepping onto the road, and do not dawdle on it
    n.kt = (n.kt || 0) - dt;
    if (n.kt <= 0) { n.kt = .2; var ca = Math.atan2(n.w.y - n.y, n.w.x - n.x), on = onRoad(n.x, n.y), nextOn = onRoad(n.x + Math.cos(ca) * 1.4, n.y + Math.sin(ca) * 1.4);
      n.onRoad = on; n.hold = !on && nextOn && !!coming(n.x + Math.cos(ca) * 2.5, n.y + Math.sin(ca) * 2.5, 7) && (n.waited || 0) < 9; }
    if (n.hold) { n.waited = (n.waited || 0) + dt; still(n, dt); return true; } n.waited = 0;
    return false;
  };
  // Walking pace for the ordinary wander: limping after a knock, brisk while on the carriageway.
  B.pace = function (n) { return (n.limp > 0 ? .5 : 1) * (n.onRoad ? 1.7 : 1); };

  /* ---------- named people and security ---------- */
  B.npc = function (n, dt, d) {
    var m = Z.me, v = m.veh;
    // anyone standing in the way of something fast steps back to the kerb, named people included
    if (n.dodge > 0) { n.dodge -= dt; n.walk = (n.walk || 0) + S.walkTo(Z.W, n, n.x + Math.cos(n.da) * 4, n.y + Math.sin(n.da) * 4, 6.5, dt, null, .4) * 2.6; n.sit = false; n.dance = false; return true; }
    if (v && m.alt < .05 && !n.hidden && !n.riding && !n.onBike && !(n.fall > 0) && d < 40) { var vs = Math.hypot(v.vx, v.vy); if (vs > 4) { var va = Math.atan2(v.vy, v.vx), dx = n.x - v.x, dy = n.y - v.y, fw = dx * Math.cos(va) + dy * Math.sin(va), sd = dy * Math.cos(va) - dx * Math.sin(va); if (fw > 0 && fw < vs * 1.3 + 7 && Math.abs(sd) < 2.6) { n.dodge = .8; n.da = va + (sd >= 0 ? 1.5708 : -1.5708); if (!(n.scT > 0)) { n.scT = 8; if (Math.random() < .5) say(n, pick(SAY.dodge)); } return true; } } }
    if (n.scT > 0) n.scT -= dt;
    if (v && m.alt < .05 && !n.hidden && !n.riding && !n.onBike && !(n.fall > 0) && Math.hypot(v.vx, v.vy) > 4.5 && d < S.VEH[v.type].len * .4 + .8) { var sp = Math.hypot(v.vx, v.vy), a = Math.atan2(v.vy, v.vx); B.down(n, 2.4 + Math.min(2.5, sp * .1), a, sp * .6, 4 + sp * .2, sp > 9); offend("hitPed"); fx("hit", n, a, true, "car"); say(n, pick(SAY.car)); if (Z.P && Z.P.friends[n.id] > 4) S.bond(Z.P, n.id, -4); bystanders(n, SAY.shout, true); }
    if (!B.downed(n, dt)) { if (n.rose) { n.rose = 0; say(n, pick(SAY.npc)); } return false; }
    n.sit = false; n.dance = false; n.rideV = null; return true;
  };
  B.hitNpc = function (n, ang, heavy, kind) {
    n.hitT = .35; n.hitA = ang; offend(kind === "shove" ? "bump" : "shove"); fx("hit", n, ang, heavy, "ped"); bystanders(n, SAY.gasp);
    if (Z.P && Z.P.friends[n.id] > 3) S.bond(Z.P, n.id, -3);
    if (n.follow && Z.friends) Z.friends.release(n, "Ah! Why?! I am going.");
    if (heavy || kind === "tackle") B.down(n, 1.8, ang, heavy ? 5 : 3.4, 3, false); else { fx("knock", n, ang, 2.6); say(n, pick(SAY.hurt)); }
  };
  B.hitGuard = function (g, ang, heavy) { g.hitT = .35; g.hitA = ang; fx("hit", g, ang, heavy, "ped"); offend("shove"); offend("shove"); B.down(g, heavy ? 2.2 : 1.5, ang, heavy ? 5 : 3, 2.8, false); say(g, pick(SAY.guard)); };

  /* ---------- your moves ---------- */
  // The nearest person in front of you within reach.
  function target(reach) {
    var m = Z.me, best = null, bd = reach, lists = [[Z.peds, "ped"], [Z.npcs, "npc"], [Z.guards, "guard"]];
    for (var li = 0; li < lists.length; li++) for (var i = 0; i < lists[li][0].length; i++) { var o = lists[li][0][i]; if (o.hidden || o.fall > 0 || o.getUpT > 0 || o.riding || o.onBike || (lists[li][1] === "guard" && o.st === "leave")) continue; var d = Math.hypot(o.x - m.x, o.y - m.y); if (d >= bd) continue; var a = Math.atan2(o.y - m.y, o.x - m.x); if (Math.abs(S.angDiff(a, m.a)) > 1.25 && d > .7) continue; if (Z.clearReach && !Z.clearReach(m, o)) continue; bd = d; best = { o: o, k: lists[li][1], a: a }; }
    return best;
  }
  // A blow at whoever is in front (the core has already dealt with monsters and bullies). Returns true if it landed.
  B.strike = function (heavy, kind) {
    var m = Z.me; if (m.block && kind === "punch") { kind = "shove"; heavy = false; }
    var t = target(kind === "tackle" ? 2.6 : kind === "kick" ? 1.9 : 1.6); if (!t) return false;
    if (t.k === "ped") B.hit(t.o, t.a, heavy, kind); else if (t.k === "npc") B.hitNpc(t.o, t.a, heavy, kind); else B.hitGuard(t.o, t.a, heavy);
    return true;
  };
  // The kick button: a front kick standing, a flying tackle at a sprint.
  B.kick = function () {
    var m = Z.me, P = Z.P; if (!P || m.veh || m.fall || m.cool > 0 || Z.mode !== "play") return false;
    var running = (m.cs || m.speed || 0) > S.FOOT.walk + 1.2, kind = running ? "tackle" : "kick";
    m.combo = 2; m.cool = running ? .7 : .46; m.punch = .18; m.emote = ""; m.sit = false; sfx("kick");
    if (running) { fx("knock", m, m.a, 5); fx("dust", m.x, m.y, 5, .8); }
    var base = (10 + P.lvl * 1.3 + P.skills.fit * .15) * (running ? 2.1 : 1.8), any = false;
    if (Z.hitFoe) Z.foes.forEach(function (f) { var a = Math.atan2(f.y - m.y, f.x - m.x); if (!f.dead && Math.hypot(f.x - m.x, f.y - m.y) < f.def.r + (running ? 2.4 : 1.9) && Math.abs(S.angDiff(a, m.a)) < 1.3 && (!Z.clearReach || Z.clearReach(m, f))) { Z.hitFoe(f, base, a, true); any = true; } });
    if (!any) any = B.strike(true, kind);
    return any;
  };
  B.tick = function (dt) {
    var m = Z.me, a = Z.api; if (!Z.P) return;
    m.block = !m.veh && !m.fall && Z.mode === "play" && !!a.down("block");
    if (a.hit("kick")) B.kick();
    // you get up too
    if (m.fall > 0) m.wasDown = 1; else if (m.wasDown) { m.wasDown = 0; m.getUpT = .001; }
    if (m.getUpT > 0) { m.getUpT += dt / .95; if (m.getUpT >= 1) m.getUpT = 0; } /* long enough for samaru-anim's push-up or roll to a knee */
  };
  // Stamina bars over anyone squaring up to you.
  B.draw = function (x) {
    if (!Z.px || !x || !x.fillRect) return;
    for (var i = 0; i < Z.peds.length; i++) { var n = Z.peds[i]; if (!(n.st === "fight" || n.st === "yield" || (n.react > 0 && n.hits)) || !n.maxHp) continue; var px = Z.px(n.x, n.y), py = Z.py(n.x, n.y) - 62; if (px < 0 || px > 960) continue; var k = Math.max(0, Math.min(1, n.hp / n.maxHp));
      x.fillStyle = "rgba(4,12,20,.75)"; x.fillRect(px - 23, py - 1, 46, 7); x.fillStyle = k > .5 ? "#86efac" : k > .25 ? "#fbbf24" : "#f87171"; x.fillRect(px - 22, py, 44 * k, 5);
      if (n.wind > 0) { x.font = "900 16px system-ui, sans-serif"; x.textAlign = "center"; x.fillStyle = "#fde047"; x.fillText("!", px, py - 6); } }
  };
  void TAU;
})();
