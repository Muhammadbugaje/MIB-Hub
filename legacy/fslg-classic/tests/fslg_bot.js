/* Freshers School Life — replay bot and monkey bot (docs/MASTER_GAME_GUIDE.md §15.1.3 and §15.1.4).
   Boots the real game headlessly through the boot section of samaru_harness.js (stub DOM, seeded Math.random, sim clock)
   and drives it through Z.update with real input, so it sees what a player sees — unlike the story solver, which feeds
   events straight into S.missionEvent (docs/FSLG_REVIEW.md §9).

   node fslg_bot.js <static/js/games dir> story [lastMission=10]
     Plays m1..mN in order like a player following the arrow: walk (teleport) to where the guide points, then act
     (talk with E, pick the item up, wave…). Before every step it checks that the HUD objective, the guide target, the
     map marker and the current step agree; it saves and reloads at every step and checks the step survives; each step
     must advance within a time limit, or it is reported as a stall and the data solver pushes it on.
   node fslg_bot.js <dir> monkey <seed> [gameSeconds=300]
     Seeded random input for N seconds of game time. Reports crashes (exceptions), soft-locks (nothing changes for 30 s),
     stuck states (holding a direction 10 s without moving), falling through the world, NaN positions. Logs the seed.
   Prints one JSON object on the last line. Exit 1 only when the bot itself breaks (problems are data in the JSON). */
"use strict";
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), dir = path.resolve(args[0] || path.join(__dirname, "..", "..", "static", "js", "games")), mode = args[1] || "story";
process.argv[2] = dir;
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"), cut = src.indexOf("const out = { log: [] }");
const boot = new Function("require", "process", "__dirname", "module", "exports", src.slice(0, cut) + "\nreturn { Z: Z, S: S, D: D, api: api, GAME: GAME, run: run, keys: keys, pressed: pressed, tap: tap, STEP: STEP };");
const { Z, S, D, api, GAME, run, keys, pressed, tap, STEP } = boot(require, process, __dirname, module, exports);
const ST = Z.story, out = { ok: true, mode: mode };
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
{ const sh = api.show; api.show = function (html, on) { api._html = html; return sh.apply(this, arguments); }; }
const hud = []; api.x.fillText = (s) => { hud.push(String(s)); }; // what the HUD paints this frame
function drawHud() { hud.length = 0; try { GAME.draw(api); } catch (e) { return ["<draw threw " + String(e).slice(0, 80) + ">"]; } return hud.slice(); }
function newGame(char) { if (Z.intro) Z.intro.noAuto = true; const p = S.newPlayer(char || "tunde", "Bot"); api._open = false; Z.begin(p, true); if (Z.guide && Z.guide.skip) Z.guide.skip(); if (Z.momentClear) Z.momentClear(); run(.2); return Z.P; }
function closeAll() { api._open = false; try { if (Z.phone && Z.phone.isOpen()) Z.phone.close(true); } catch (e) {} }
function place(x, y) { const me = Z.me; if (me.veh) Z.exit(true); const f = S.push(Z.W, x, y, .6); me.x = f.x; me.y = f.y; me.speed = 0; me.fall = 0; }

/* ======================= scripted replay bot ======================= */
function story(last) {
  let P = newGame("tunde"); const me = Z.me, rep = out.story = { missions: [], steps: 0, byPlay: 0, bySolver: 0, problems: [] };
  const bad = (where, kind, msg) => rep.problems.push({ where, kind, msg });
  const ids = []; for (let i = 1; i <= last; i++) ids.push("m" + i);
  let guard = 0, lastKey = "", sameKey = 0;
  while (guard++ < 600) {
    closeAll();
    if (!P.m.active) {
      const next = D.MISSIONS.find((m) => !m.side && !P.m.done[m.id]); if (!next || ids.indexOf(next.id) < 0) break;
      const lvl = (next.need || {}).lvl || 0; if (P.lvl < lvl) { P.xp = S.xpForLevel(lvl); S.addXp(P, 0); }
      ((next.need || {}).flags || []).forEach((f) => { P.flags[f] = P.flags[f] || 1; });
      // a player who just finished a mission keeps whatever Z.quest the last step left behind: that must not leak
      const leak = Z.quest; Z.nextStory(true); run(.3); if (leak && Z.quest === leak && !(Z.step() && /find|collect/.test(Z.step().t))) bad(next.id, "QUEST_LEAK", "the previous mission's item marker is still live in " + next.id);
      if (P.m.active !== next.id) { bad(next.id, "NO_START", "did not start (active '" + P.m.active + "')"); break; }
      rep.missions.push(next.id); continue;
    }
    const m = Z.mission(), st = Z.step(), key = P.m.active + "." + (P.m.step + 1) + "#" + P.m.n; if (!st) { run(.2); continue; }
    if (key === lastKey) { if (++sameKey > 3) { bad(key, "NO_ADVANCE", "the solver could not move it either; giving up on " + m.id); P.m.done[m.id] = 1; P.m.active = ""; continue; } } else { lastKey = key; sameKey = 0; }
    rep.steps++; const at = P.m.active + "." + (P.m.step + 1), stepIdx = P.m.step;
    if (st.night && !S.isNight(P)) { P.time = 20 * 60; }
    /* 1. agreement: HUD text, guide target, map marker, current step */
    const want = st.place || (!Array.isArray(st.at) && st.at) || null, wantP = want ? Z.place(want) : null, npc = st.npc ? Z.npc(ST.tok(P, st.npc)) : null;
    let tg = Z.target(); if (tg === Z.waypoint) tg = null;
    const lines = drawHud(), home = Z.place("@home"), expect = st.text ? (Z.objText ? Z.objText(st) : st.text.replace("your hostel", home ? home.name : "your hostel")) : "";
    const shown = lines.find((l) => expect && l.indexOf(expect.slice(0, 24)) === 0);
    if (expect && !shown) bad(at, "HUD_TEXT", "HUD does not show the objective \"" + expect + "\"");
    if (shown && /@\w+|\{\{/.test(shown)) bad(at, "HUD_TOKEN", "HUD shows a raw token: \"" + shown + "\"");
    let mk = null; try { mk = (Z.bigmap.live() || []).find((q) => q.cat === "mission"); } catch (e) { bad(at, "MAP_THROWS", String(e).slice(0, 100)); }
    if (tg && (!mk || Math.hypot(mk.x - tg.x, mk.y - tg.y) > 1)) bad(at, "MARKER", "map marker " + (mk ? "at a different spot" : "missing") + " (guide: " + tg.name + ")");
    if (wantP && !tg) bad(at, "NO_ARROW", st.t + " at " + wantP.name + " but no guide arrow");
    if (wantP && tg && !npc && st.t !== "find" && st.t !== "collect" && Math.hypot(tg.x - wantP.mx, tg.y - wantP.my) > 25) bad(at, "ARROW_ELSEWHERE", "arrow → " + tg.name + ", step place → " + wantP.name);
    if (npc && tg && !wantP && Math.hypot(tg.x - npc.x, tg.y - npc.y) > 25) bad(at, "ARROW_NOT_AT_NPC", "arrow → " + tg.name + ", " + npc.def.name + " stands " + Math.round(Math.hypot(tg.x - npc.x, tg.y - npc.y)) + " m away");
    if ((st.t === "find" || st.t === "collect") && Z.quest) { if (!tg || Math.hypot(tg.x - Z.quest.x, tg.y - Z.quest.y) > 13) bad(at, "ARROW_NOT_AT_ITEM", "arrow is " + (tg ? Math.round(Math.hypot(tg.x - Z.quest.x, tg.y - Z.quest.y)) + " m" : "nowhere") + " from the item"); if (S.inWater && S.inWater(Z.W, Z.quest.x, Z.quest.y)) bad(at, "ITEM_IN_WATER", "the item is in the water"); }
    /* 2. save and reload, then the same step must be live with the same progress */
    if (!process.env.FSLG_BOT_NORELOAD) { const n0 = P.m.n, q0 = Z.quest ? { x: Z.quest.x, y: Z.quest.y } : null, left0 = ST.ctx.main && ST.ctx.main.left ? ST.ctx.main.left.length : null;
      Z.save(); const loaded = Z.load(); Z.begin(loaded, false); run(.25); closeAll();
      const P2 = Z.P, wentOn = P2.m.active === P.m.active && P2.m.step === stepIdx + 1 && st.t === "go" && wantP && d2(wantP.mx != null ? { x: wantP.mx, y: wantP.my } : wantP, me) < 13; // a go step you stand on completes on load: fine
      if (P2.m.active + "." + (P2.m.step + 1) !== at && !wentOn) bad(at, "RELOAD_STEP", "after reload the game is at " + P2.m.active + "." + (P2.m.step + 1));
      if (P2.m.n !== n0) bad(at, "RELOAD_COUNT", "progress " + n0 + " became " + P2.m.n + " after reload");
      if (q0 && !Z.quest) bad(at, "RELOAD_ITEM", "the item marker is gone after reload");
      if (st.t === "collect" && left0 != null && ST.ctx.main && ST.ctx.main.left && ST.ctx.main.left.length + P2.m.n !== (st.n || 1)) bad(at, "RELOAD_COLLECT", "after reload " + ST.ctx.main.left.length + " items to find + " + P2.m.n + " counted ≠ " + (st.n || 1));
      P = Z.P; } // Z.begin replaced the player object
    const P_ = P;
    /* 3. play it: go where the arrow points, then act */
    const done = () => P_.m.active !== m.id || P_.m.step !== stepIdx || P_.m.n !== (P_.m.n0 === undefined ? P_.m.n : P_.m.n0);
    const advanced = (n0) => P_.m.active !== m.id || P_.m.step !== stepIdx || P_.m.n > n0;
    const n0 = P_.m.n; let how = "", whyNot = "";
    const tgt = Z.target(); const walkable = /^(go|talk|find|collect|look|watch|listen|social|emote|sleep|eat|fight|boss|defend|build|carry|delivery|stealth|walk|escort|care)$/.test(st.t);
    if (walkable && tgt && tgt !== Z.waypoint) {
      place(tgt.x + 1.5, tgt.y); run(.6);
      const limit = Math.max(8, (st.secs || 6) + 4);
      for (let t = 0; t < limit && !advanced(n0); t += .5) {
        closeAll();
        if (st.t === "talk" || (npc && /^(walk|escort|care)$/.test(st.t))) { const n = Z.npc(ST.tok(P_, st.npc)); if (n) { place(n.x + 1.2, n.y); if (t === 0) whyNot = "near: " + Z.npcs.filter((q) => !q.hidden && d2(q, me) < 3).map((q) => q.id).join(",") + " cars: " + Z.cars.filter((c) => d2(c, me) < 4).map((c) => c.type).join(",") + " prompt: " + (Z.prompt ? Z.prompt() : "") + (n.hidden ? " (target hidden)" : "") + (Z.inside ? " inside" : ""); tap("act"); } }
        else if ((st.t === "find" || st.t === "collect") && Z.quest) place(Z.quest.x, Z.quest.y);
        else if (st.t === "emote") tap(st.emote === "dance" ? "emote2" : st.emote === "sit" ? "emote3" : "emote1");
        else if (st.t === "sleep") { if (Z.sleep) Z.sleep(); }
        else if (st.t === "eat") { if (Z.eat) try { Z.eat(Object.keys(D.FOOD)[0]); } catch (e) {} }
        run(.5); if (st.night && !S.isNight(P_)) P_.time = 20 * 60;
      }
      if (advanced(n0)) how = "play"; else if (/^(go|find|collect|talk|look|watch|emote)$/.test(st.t)) bad(at, "STALL", st.t + " did not complete within " + limit + " s at the guide target (" + tgt.name + ")" + (st.t === "go" ? " — standing on the marker" : "") + (whyNot ? " [" + whyNot + "]" : ""));
    }
    if (!how) { // UI-driven or not reachable by walking: let the data solver finish it (counted, not a failure by itself)
      let g = 0; while (!advanced(n0) && g++ < 40) { closeAll(); ST.solve("main", 0); run(.05); }
      how = advanced(n0) ? "solver" : "";
      if (!how) bad(at, "STUCK", "neither play nor the solver advanced " + st.t);
    }
    if (how === "play") rep.byPlay++; else if (how === "solver") rep.bySolver++;
    void done;
  }
  // save versions: a save from before versioning loads and is stamped; a save from a newer build is refused, untouched
  { const cur = JSON.parse(JSON.stringify(Z.P)), old = JSON.parse(JSON.stringify(cur)); delete old.saveVersion; old.v = 1; if (old.story) { delete old.story.ver; }
    api.store("fslg-save", old); const a = Z.load(); const newer = Object.assign({}, cur, { saveVersion: 99 }); api.store("fslg-save", newer); const b = Z.load();
    rep.saveVersions = { current: Z.SAVE_VERSION, oldLoads: !!a && a.saveVersion === Z.SAVE_VERSION && a.v === 2, newerRefused: b === null && !!Z.loadError, untouched: (api.store("fslg-save") || {}).saveVersion === 99 };
    if (a) { Z.begin(a, false); run(.2); rep.saveVersions.oldPlays = Object.keys(Z.P.m.done).length >= Object.keys(cur.m.done).length && (Z.P.story || {}).ver === Z.story.SAVE_VERSION && Z.mode === "play"; }
    api.store("fslg-save", cur); }
  rep.reached = Object.keys(Z.P.m.done).filter((k) => /^m\d+$/.test(k)).sort((a, b) => +a.slice(1) - +b.slice(1));
  rep.finishedAll = ids.every((id) => Z.P.m.done[id]);
}

/* ======================= monkey bot ======================= */
function monkey(seed, secs) {
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const P = newGame(rnd() < .5 ? "tunde" : "amina"), me = Z.me, rep = out.monkey = { seed: seed, gameSeconds: secs, crashes: [], softlocks: [], stuck: [], fell: [], nan: 0, inputs: 0, teleports: 0, vehicles: 0, dialogs: 0, distance: 0 };
  const HOLD = ["up", "down", "left", "right", "run"], TAP = ["jump", "attack", "act", "emote1", "emote2", "emote3", "phone", "map", "radio"];
  let wasIn = false, lastAct = "", jumps = rep.jumps = [], nextChange = 0, held = [], t = 0, lastSig = "", sigSince = 0, stuckT = 0, stuckFrom = null, openT = 0, lx = me.x, ly = me.y, lastTp = 0;
  const err = (e, where) => { if (rep.crashes.length < 20) rep.crashes.push({ t: +t.toFixed(1), where: where, error: String(e && e.stack || e).split("\n").slice(0, 3).join(" | "), pos: [Math.round(me.x), Math.round(me.y)], step: Z.P.m.active + "." + Z.P.m.step }); };
  // pressing into a wall is not "stuck": stuck means no direction moves you
  const free = () => { const save = held.slice(); held.forEach((k) => { keys[k] = false; }); let ok = false;
    for (const k of ["up", "down", "left", "right"]) { const x0 = me.veh ? me.veh.x : me.x, y0 = me.veh ? me.veh.y : me.y; keys[k] = true; for (let j = 0; j < 60; j++) { try { GAME.update(STEP, api); } catch (e) { err(e, "update"); } } keys[k] = false; if (Math.hypot((me.veh ? me.veh.x : me.x) - x0, (me.veh ? me.veh.y : me.y) - y0) > .3) { ok = true; break; } }
    save.forEach((k) => { keys[k] = true; }); return ok; };
  const why = () => { const o = {}; try { o.sit = me.sit || ""; o.emote = me.emote || ""; o.fall = me.fall || 0; o.travel = !!(Z.travel && Z.travel.active); o.swim = !!(Z.water && Z.water.swimming && Z.water.swimming()); o.moment = !!(Z.momentBusy && Z.momentBusy()); o.sec = (Z.P.sec || {}).state || ""; o.wild = Z.wild && Z.wild.st ? Object.keys(Z.wild.st).filter((k) => Z.wild.st[k]).slice(0, 5).join(",") : ""; o.phone = !!(Z.phone && Z.phone.isOpen && Z.phone.isOpen()); o.overlay = !!api._open; o.big = !!(Z.bigOpen && Z.bigOpen()); o.mode = Z.mode; o.job = Z.P.job ? Z.P.job.kind : ""; o.carried = !!me.carried; o.lock = !!(Z.focus && Z.focus.busy && Z.focus.busy()); o.inLecture = !!(Z.interior && Z.interior.lec); o.speed = +(me.speed || 0).toFixed(2); } catch (e) { o.err = String(e); } return o; };
  const steps = Math.round(secs / STEP);
  for (let i = 0; i < steps; i++) {
    t = i * STEP;
    if (t >= nextChange) { // new input chord
      held.forEach((k) => { keys[k] = false; }); held = HOLD.filter(() => rnd() < .35); held.forEach((k) => { keys[k] = true; });
      if (rnd() < .45) { tap(TAP[Math.floor(rnd() * TAP.length)]); rep.inputs++; }
      if (rnd() < .06 && !me.veh) { const c = Z.cars.filter((q) => !q.npc).sort((a, b) => d2(a, me) - d2(b, me))[0]; if (c && d2(c, me) < 60) { place(c.x + 1, c.y); try { Z.enter(c); rep.vehicles++; } catch (e) { err(e, "enter"); } } }
      nextChange = t + .25 + rnd() * 1.25; rep.inputs++;
    }
    if (t - lastTp > 60) { lastTp = t; const q = Z.placeList[Math.floor(rnd() * Z.placeList.length)]; place(q.mx + (rnd() - .5) * 30, q.my + (rnd() - .5) * 30); rep.teleports++; lx = me.x; ly = me.y; }
    // dialogs: press one of the offered actions, or close
    const bigMap = !!(Z.bigOpen && Z.bigOpen()); // the full map freezes walking on purpose; close it like a player would
    if (bigMap && openT > .8 + rnd() * 2) { tap("map"); openT = 0; }
    const open = api.overlayOpen() || (Z.phone && Z.phone.isOpen && Z.phone.isOpen()) || bigMap;
    if (open && !bigMap) { openT += STEP; if (openT > .4 + rnd() * 1.5) { rep.dialogs++; try { if (api._open && api._on && rnd() < .7) { const acts = [...String(api._html || "").matchAll(/data-act='([^']+)'/g)].map((x) => x[1]); const a = acts.length ? acts[Math.floor(rnd() * acts.length)] : "x"; lastAct = (String(api._html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 40)) + " → " + a; api._on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add() {} } }); } else closeAll(); } catch (e) { err(e, "dialog"); closeAll(); } openT = 0; } }
    else if (bigMap) openT += STEP; else openT = 0;
    try { GAME.update(STEP, api); } catch (e) { err(e, "update"); }
    api.t += STEP; if (typeof __pump === "function") __pump(STEP * 1000); for (const k in pressed) pressed[k] = false;
    if (i % 4 === 0) { try { GAME.draw(api); } catch (e) { err(e, "draw"); } }
    if (i % 60 === 0) { // twice a second
      const x = me.veh ? me.veh.x : me.x, y = me.veh ? me.veh.y : me.y;
      if (!isFinite(x) || !isFinite(y)) { rep.nan++; place(Z.places.gate.mx, Z.places.gate.my); continue; }
      const hop = Math.hypot(x - lx, y - ly); rep.distance += hop;
      const inRoom = !!(Z.inside || (Z.interior && Z.interior.cur)); if (inRoom !== wasIn) { wasIn = inRoom; lx = x; ly = y; continue; } // rooms are built 6 km away (samaru-interior.js OFF)
      if (hop > 150 && jumps.length < 15) jumps.push({ t: +t.toFixed(1), from: [Math.round(lx), Math.round(ly)], to: [Math.round(x), Math.round(y)], veh: me.veh ? me.veh.type : "", alt: +(me.alt || 0).toFixed(1), lastDialog: lastAct });
      const B = Z.W.bounds || [-1e4, -1e4, 1e4, 1e4], lim = ((S.RULES || {}).wildLimit || 1500) + 300;
      if (!inRoom && (x < B[0] - lim || y < B[1] - lim || x > B[2] + lim || y > B[3] + lim)) rep.fell.push({ t: +t.toFixed(1), why: "beyond the wild patrol limit (" + lim + " m past the campus bounds)", pos: [Math.round(x), Math.round(y)] });
      if ((me.alt || 0) < -1.5 && !(me.swim) && !(Z.water && Z.water.swimming && Z.water.swimming())) rep.fell.push({ t: +t.toFixed(1), why: "below ground (alt " + (me.alt || 0).toFixed(1) + ")", pos: [Math.round(x), Math.round(y)] });
      if (!Z.inside && !me.veh && S.insideBuilding(Z.W, x, y)) { if (rep.fell.length < 30) rep.fell.push({ t: +t.toFixed(1), why: "inside a building footprint", pos: [Math.round(x), Math.round(y)] }); }
      // stuck: holding a direction for 10 s without moving half a metre (not in a dialog, not knocked down)
      const pushing = held.some((k) => k !== "run") && !open && !(me.fall > 0);
      if (pushing && Math.hypot(x - lx, y - ly) < .05) { if (!stuckFrom) stuckFrom = [x, y]; stuckT += .5; if (stuckT >= 10 && Math.hypot(x - stuckFrom[0], y - stuckFrom[1]) < .5 && !free()) { rep.stuck.push({ t: +t.toFixed(1), pos: [Math.round(x), Math.round(y)], veh: me.veh ? me.veh.type : "", room: inRoom, step: Z.P.m.active + "." + Z.P.m.step, state: why() }); stuckT = 0; stuckFrom = null; place(x + 6, y + 6); } }
      else { stuckT = 0; stuckFrom = null; }
      lx = x; ly = y;
      // soft-lock: nothing at all changes (position, clock, step, dialog) for 30 s
      const sig = [Math.round(x * 2), Math.round(y * 2), Math.floor(Z.P.time), Z.P.m.active, Z.P.m.step, api._open ? 1 : 0, Z.momentBusy && Z.momentBusy() ? 1 : 0].join(",");
      if (sig !== lastSig) { lastSig = sig; sigSince = t; } else if (t - sigSince > 30) { rep.softlocks.push({ t: +t.toFixed(1), sig: sig, overlay: !!api._open, phone: !!(Z.phone && Z.phone.isOpen && Z.phone.isOpen()), moment: !!(Z.momentBusy && Z.momentBusy()) }); sigSince = t; closeAll(); if (Z.momentClear) Z.momentClear(); }
    }
  }
  held.forEach((k) => { keys[k] = false; });
  rep.distance = Math.round(rep.distance); rep.fellCount = rep.fell.length; rep.fell = rep.fell.slice(0, 15);
  rep.end = { step: Z.P.m.active + "." + Z.P.m.step, pos: [Math.round(me.x), Math.round(me.y)], hp: Math.round(Z.P.hp), time: Math.round(Z.P.time) };
}

try {
  run(.3);
  if (mode === "story") story(+(args[2] || 10));
  else if (mode === "monkey") monkey(+(args[2] || 1), +(args[3] || 300));
  else throw new Error("mode must be story or monkey");
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
