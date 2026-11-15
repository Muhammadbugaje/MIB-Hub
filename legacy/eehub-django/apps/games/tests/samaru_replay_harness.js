/* Replay every main mission through the real update loop (Z.update, Z.near, Z.stepStart, Z.target), not just the
   rules: go steps must fire when you stand at the place (no walking away), find/collect items must lie near their scene
   (not in water or inside a building) and be collectable, and every step must give the guide a target.
   Usage: node samaru_replay_harness.js <static/js/games dir>. Prints one JSON object. (FSLG_REVIEW.md §9) */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
const boot = src.slice(0, src.indexOf("const out = { log: [] }"));
const mine = String.raw`
global.addEventListener = global.addEventListener || noop; global.removeEventListener = global.removeEventListener || noop;
const out = { ok: true, goStall: [], findFar: [], findWet: [], findStuck: [], collectFar: [], noTarget: [], counts: { go: 0, find: 0, collect: 0, steps: 0 } };
try {
  run(.3); const ST = Z.story, W = Z.W;
  const p = S.newPlayer("tunde", "Replay"); p.life = { sex: "m", dept: "elect", faith: "", acad: 100 }; api._open = false; Z.intro.noAuto = true; Z.begin(p, true); run(.1);
  const P = Z.P, me = Z.me; P.god = false;
  const main = D.MISSIONS.filter((m) => !m.side);
  function placeOfStep(st) { const r = ST.resolve(P, st); const id = r.place || r.at; return id ? Z.place(id) : null; }
  function standAt(pl) { const f = S.push(W, pl.mx + .5, pl.my + .5, .6); me.veh = null; me.x = f.x; me.y = f.y; me.vx = me.vy = 0; }
  for (const m of main) {
    if (P.m.done[m.id]) continue;
    const need = (m.need || {}).lvl || 0; if (P.lvl < need) { P.xp = S.xpForLevel(need); S.addXp(P, 0); }
    ((m.need || {}).flags || []).forEach((f) => { P.flags[f] = 1; });
    if (P.m.active !== m.id) { if (P.m.active) P.m.active = ""; S.startMission(P, m); Z.stepStart(); }
    let guard = 0;
    while (P.m.active === m.id && guard++ < m.steps.length * 4 + 10) {
      api._open = false; try { if (Z.mini && Z.mini.active && Z.mini.active()) Z.mini.close(); if (Z.momentClear) Z.momentClear(); } catch (e) {} if (Z.inside && Z.interior) Z.interior.leaveNow();
      const i = P.m.step, st = m.steps[i], tag = m.id + "." + (i + 1) + " " + st.t + ":" + (st.place || st.at || st.npc || st.item || ""); out.counts.steps++;
      const tg = Z.target && Z.target(); if (!tg && !/^(turn|choice|choose|vote|stat|sleep|eat|emote|phone|awards|keep|quiz|teach|rhythm|arcade|social|look|watch|listen|routine|flight|sports)$/.test(st.t)) out.noTarget.push(tag);
      if (st.t === "go") {
        out.counts.go++; const pl = placeOfStep(st); if (!pl) { ST.solve("main", 0); run(.03); continue; }
        if (st.night) P.time = 22 * 60; else if (P.time > 20 * 60 || P.time < 6 * 60) P.time = 9 * 60;
        standAt(pl); run(.6);
        if (P.m.active === m.id && P.m.step === i) { out.goStall.push(tag); ST.solve("main", 0); run(.03); }
        continue;
      }
      if (st.t === "find") {
        out.counts.find++; const pl = placeOfStep(st), q = Z.quest;
        if (!q) { out.findStuck.push(tag + " (no item)"); ST.solve("main", 0); run(.03); continue; }
        if (pl && Math.hypot(q.x - pl.mx, q.y - pl.my) > 55) out.findFar.push(tag + " " + Math.round(Math.hypot(q.x - pl.mx, q.y - pl.my)) + " m");
        if (S.inWater(W, q.x, q.y) || S.insideBuilding(W, q.x, q.y)) out.findWet.push(tag);
        const tq = Z.target(); if (!tq || Math.hypot(tq.x - q.x, tq.y - q.y) > 1) out.noTarget.push(tag + " (beacon not on the item)");
        me.veh = null; me.x = q.x; me.y = q.y; run(.4);
        if (P.m.active === m.id && P.m.step === i) { out.findStuck.push(tag); ST.solve("main", 0); run(.03); }
        continue;
      }
      if (st.t === "collect") {
        out.counts.collect++; run(.1); const r = ST.ctx.main, pls = (st.places || [st.at || st.place]).map((id) => Z.place(ST.tok(P, id))).filter(Boolean);
        (r && r.left || []).forEach((q) => { const d = Math.min.apply(null, pls.map((pl) => Math.hypot(q.x - pl.mx, q.y - pl.my))); if (d > (st.places ? 20 : (st.r || 40)) + 15) out.collectFar.push(tag + " " + Math.round(d) + " m"); /* within the radius the step declares */ if (S.inWater(W, q.x, q.y) || S.insideBuilding(W, q.x, q.y)) out.findWet.push(tag + " (collect)"); });
        ST.solve("main", 0); run(.03); continue;
      }
      ST.solve("main", 0); run(.03);
    }
    if (!P.m.done[m.id]) { P.m.done[m.id] = 1; P.m.active = ""; }
  }
  out.missions = main.length;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
`;
eval(boot + mine);
