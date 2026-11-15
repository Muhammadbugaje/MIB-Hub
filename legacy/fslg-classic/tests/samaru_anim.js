/* Headless checks for the Freshers School Life character animation (static/js/games/samaru-anim.js).
   Usage: node samaru_anim.js <static/js/games dir> [dump]  → one JSON line { ok, cases: { name: {...} } }.
   Runs the real pose solver against a stand-in figure (no THREE, no DOM) at 60 frames a second through every body-state
   change: sitting down and standing up (ground, chair, kneeling), the falls (trip, shove, punch, car, faint, off a bike),
   getting up from the back and from the front, mounting and leaving a bicycle, okada, skateboard, car and keke,
   lifting a fallen bike. Fully deterministic: fixed clock, no random numbers. With "dump", every frame's joint points
   are included (for drawing stick-figure strips). */
const fs = require("fs"), path = require("path"), dir = process.argv[2], DUMP = process.argv[3] === "dump";
global.window = global;
global.SamaruGame = { me: null, bubbles: [] };
(0, eval)(fs.readFileSync(path.join(dir, "samaru-anim.js"), "utf8"));
const A = global.SamaruGame.anim; A.trace = true;
function v3(s) { return { x: s || 0, y: s || 0, z: s || 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, setScalar(v) { this.x = this.y = this.z = v; } }; }
function node() { return { position: v3(), rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, scale: v3(1), userData: {}, visible: true, traverse() {} }; }
function figure(seed) { const r = { c: {}, w: {}, ph: 0, seed: seed || 1.3, v: 0, av: 0, a: 0, s0: 1.08, hTop: .9, body: node(), hips: node(), chest: node(), head: node(), torso: node(), torch: node(), shadow: node(), lL: { hp: node(), kn: node(), ft: node() }, lR: { hp: node(), kn: node(), ft: node() }, aL: { sh: node(), el: node() }, aR: { sh: node(), el: node() }, eyes: [node(), node()] };
  const g = node(); g.scale.setScalar(1.08); g.userData.rig = r; return g; }
const P = A.init({}, { geo: {}, mat() {}, box() {}, hex() {}, R: {} });
const ANC = {
  bike: { seat: [-.31, 1.09], grip: [.36, 1.16, .25], pedal: { c: [-.1, .3], r: .16 }, lean: -.26, maxLean: -.7, crankA: 0, pillion: { seat: [-.66, .88], foot: [-.6, .42, .1], lean: -.05 } },
  okada: { seat: [-.42, 1.04], grip: [.36, 1.18, .36], foot: [-.03, .3, .19], lean: -.18, maxLean: -.6, tuck: .008, crankA: 0, pillion: { seat: [-.74, 1.04], foot: [-.36, .34, .19], lean: -.1 } },
  scooter: { seat: [-.36, .97], grip: [.36, 1.22, .27], foot: [.12, .24, .09], lean: -.06, maxLean: -.45, crankA: 0, pillion: { seat: [-.7, .97], foot: [-.18, .24, .12], lean: -.02 } },
  skate: { stand: 1, seat: [0, .167], crankA: 0 },
  car: { roof: 1.27, seat: [.14, .42], side: -.4, scale: .68, grip: [.6, 1.0, .14], foot: [.8, .36, .1], lean: .13, door: 1.65, crankA: 0, pillion: { seat: [.14, .42], side: .4, lean: .13 } },
  keke: { roof: 1.64, seat: [.06, .76], scale: .78, grip: [.7, 1.16, .28], foot: [.52, .5, .12], lean: -.1, maxLean: -.4, door: 1.3, crankA: 0, pillion: { roof: 1.7, seat: [-.72, .82], side: .3, lean: .06 } }
};
let EVN = {}; ["step", "land", "seat", "doorOpen", "doorClose"].forEach((n) => A.on(n, () => { EVN[n] = (EVN[n] || 0) + 1; }));
const K = A.KEYS, DT = 1 / 60, out = { ok: true, cases: {} }, POSES = {}; // every frame's pose, per case, for the clothing check
function num(v) { return typeof v === "number" && isFinite(v); }
/* run one case: phases = [[seconds, stateFn(t) → { x, y, a, st }], ...] */
function run(name, phases, opts) {
  opts = opts || {}; EVN = {}; const g = figure(opts.seed), r = g.userData.rig, o = opts.o || {}; let t = 10, f = 0;
  const res = { frames: 0, nan: 0, below: 0, minY: 9, worstW: 0, maxJump: 0, hipSpeed: 0, doorMax: 0, liftMax: 0, modes: [], clips: [], phases: [], end: null, dump: [], slide: 0, thigh: 0 };
  let prevSole = null, slideSum = 0, slideN = 0;
  let prevC = null, prevHip = null, prevMode = "", prevClip = "";
  for (const [secs, fn] of phases) {
    const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++, f++) {
      const s = fn(i * DT, i, o); s.st.o = o; s.st.near = true;
      P.pose(g, s.x, s.y, s.a, s.st, t); t += DT; res.frames++;
      const c = r.c, rt = r.root;
      for (const k of K) if (!num(c[k])) res.nan++;
      if (!num(rt.x) || !num(rt.y) || !num(rt.z) || !num(rt.yaw) || !num(rt.s)) res.nan++;
      const sum = (r.wts || [1]).reduce((p, q) => p + q, 0); res.worstW = Math.max(res.worstW, Math.abs(sum - 1)); if ((r.wts || []).some((w) => w < -1e-9 || w > 1 + 1e-9)) res.worstW = 9;
      const ride = s.st.ride != null, cl = r.clip ? r.clip.C.name : "", veh = r.clip && r.clip.C.veh;
      const lo = A.fk(c) + (r.yAdj || 0); // lowest point of the figure over its own floor, after the ground fix
      const onFoot = !ride && !veh && !(s.st.air > .05) && !(s.st.sit && s.st.sit === "chair") && !(r.clip && r.clip.C.noLift);
      if (onFoot) { res.minY = Math.min(res.minY, lo); if (lo < -.012) res.below++; }
      if (prevC && cl === prevClip && r.mode === prevMode) { let j = 0; for (const k of K) j = Math.max(j, Math.abs(c[k] - prevC[k])); res.maxJump = Math.max(res.maxJump, j); }
      const hx = c.fwd - .92 * Math.sin(c.lean), ca = Math.cos(rt.yaw), sa = Math.sin(rt.yaw), hip = { x: rt.x + rt.s * (hx * ca - c.side * sa), z: rt.z + rt.s * (hx * sa + c.side * ca) }; // the hip joint in the world
      if (prevHip && !opts.moving) res.hipSpeed = Math.max(res.hipSpeed, Math.hypot(hip.x - prevHip.x, hip.z - prevHip.z) / DT);
      if (opts.slide && i > 30) res.thigh = Math.max(res.thigh, Math.abs(c.hL + c.lean), Math.abs(c.hR + c.lean)); // thigh swing from the vertical
      if (opts.slide && i > 30) { const pts = []; A.fk(c, pts); let lo = null; pts.forEach((p, j) => { if ((p[0] === "toe" || p[0] === "heel") && (!lo || p[2] < lo.y)) lo = { j: j, x: p[1], y: p[2], z: p[3] }; });
        const ys = (r.yAdj || 0); const cw = Math.cos(rt.yaw), sw = Math.sin(rt.yaw), wx = rt.x + rt.s * (lo.x * cw - lo.z * sw), wz = rt.z + rt.s * (lo.x * sw + lo.z * cw);
        if (lo.y + ys < .03 && prevSole && prevSole.j === lo.j) { slideSum += Math.hypot(wx - prevSole.x, wz - prevSole.z) / DT; slideN++; } prevSole = { j: lo.j, x: wx, z: wz }; }
      if (o.animDoor) res.doorMax = Math.max(res.doorMax, o.animDoor); if (o.animLift) res.liftMax = Math.max(res.liftMax, o.animLift);
      if (r.mode !== prevMode) res.modes.push(r.mode); if (cl !== prevClip) res.clips.push(cl || "-");
      (POSES[name] || (POSES[name] = [])).push({ hL: c.hL, kL: c.kL, hR: c.hR, kR: c.kR });
      prevC = Object.assign({}, c); prevHip = hip; prevMode = r.mode; prevClip = cl;
      if (DUMP && (f % 2 === 0)) { const pts = []; A.fk(c, pts); res.dump.push({ f, mode: r.mode, clip: cl, u: r.clip ? +r.clip.u.toFixed(3) : null, root: [rt.x, rt.y, rt.z, rt.yaw, rt.s], yAdj: r.yAdj || 0, pts: pts.map((p) => [p[0], +p[1].toFixed(3), +p[2].toFixed(3), +p[3].toFixed(3), p[4]]) }); }
    }
    res.phases.push({ mode: r.mode, clip: r.clip ? r.clip.C.name : "", lean: +r.c.lean.toFixed(3), roll: +r.c.roll.toFixed(3), lowest: +(A.fk(r.c) + (r.yAdj || 0)).toFixed(3), lie: r.lie || "", pose: Object.fromEntries(K.map((k) => [k, +r.c[k].toFixed(3)])) });
  }
  const c = r.c; res.end = { mode: r.mode, clip: r.clip ? r.clip.C.name : "", c: Object.fromEntries(K.map((k) => [k, +c[k].toFixed(3)])), root: [+r.root.x.toFixed(3), +r.root.y.toFixed(3), +r.root.z.toFixed(3), +r.root.yaw.toFixed(3), +r.root.s.toFixed(3)], lowest: +(A.fk(c) + (r.yAdj || 0)).toFixed(3), lie: r.lie || "", obj: { animBusy: o.animBusy || 0, animLift: o.animLift, doorT: opts.vo ? opts.vo.doorT : null, tipA: opts.vo ? opts.vo.tipA : null } };
  res.events = Object.assign({}, EVN); res.thigh = +res.thigh.toFixed(3); res.slide = slideN ? +(slideSum / slideN).toFixed(3) : 0;
  res.minY = +res.minY.toFixed(3); res.worstW = +res.worstW.toExponential(2); res.maxJump = +res.maxJump.toFixed(3); res.hipSpeed = +res.hipSpeed.toFixed(2);
  if (!DUMP) delete res.dump; out.cases[name] = res; return res;
}
const stand = (x, y, a) => () => ({ x: x, y: y, a: a, st: { vel: 0 } });
const hold = (st, x, y, a) => () => ({ x: x || 0, y: y || 0, a: a || 0, st: Object.assign({}, st) });
/* sitting down and getting up */
run("sitGround", [[1, stand(0, 0, 0)], [2.2, hold({ sit: true })], [2.2, stand(0, 0, 0)]]);
run("sitChair", [[1, stand(0, 0, 0)], [2, hold({ sit: "chair" }, .6, .2, Math.PI / 2)], [2, stand(0, 0, 0)]]);
run("sitRaised", [[1, stand(0, 0, 0)], [2, hold({ sit: true, z: 1.8 }, .5, 0, 0)], [2, stand(0, 0, 0)]]); // a lecture-theatre tier: seat surface 1.8 m up, its floor 0.3 m below that
run("sitKneel", [[1, stand(0, 0, 0)], [2, hold({ sit: "kneel" })], [2, stand(0, 0, 0)]]);
/* falls: each lies still, then gets up (brawl-style getUpT progress, and also with no getUpT at all) */
function downUp(name, setup, secs, opts) {
  const o = {}; opts = Object.assign({ o: o }, opts || {});
  run(name, [[.8, stand(0, 0, 0)], [secs, (t, i, ob) => { if (i === 0) setup(ob); if (ob.hitT > 0) ob.hitT = Math.max(0, ob.hitT - DT); return { x: Math.min(t, .4) * (ob.kx || 0) * .3, y: Math.min(t, .4) * (ob.ky || 0) * .3, a: 0, st: { fall: secs - t, air: ob.air ? Math.max(0, ob.kz0 * t - 9 * t * t) : 0 } }; }],
    [1.3, (t, i, ob) => { ob.getUpT = Math.min(1, .001 + t / .9); if (ob.getUpT >= 1) ob.getUpT = 0; ob.kv = 0; return { x: .4 * (ob.kx || 0) * .3, y: .4 * (ob.ky || 0) * .3, a: 0, st: {} }; }], [1, (t, i, ob) => ({ x: .4 * (ob.kx || 0) * .3, y: .4 * (ob.ky || 0) * .3, a: 0, st: {} })]], opts);
}
downUp("trip", () => {}, 2.2);
downUp("punchBack", (o) => { o.hitT = .35; o.hitA = Math.PI; }, 2.2);
downUp("shoveFront", (o) => { o.hitT = .35; o.hitA = 0; }, 2.2);
downUp("carHit", (o) => { o.kv = 1; o.kx = 6; o.ky = 1; o.kz0 = 5; o.air = .05; }, 2.6);
run("faint", [[.8, stand(0, 0, 0)], [2.4, () => ({ x: 0, y: 0, a: 0, st: { fall: 99 } })], [2, stand(0, 0, 0)]]);
run("noGetUpT", [[.8, stand(0, 0, 0)], [2, hold({ fall: 1 })], [2, stand(0, 0, 0)]]);
/* machines: walk up from 1.5 m away, get on, ride a little, get off (the game puts you beside it) */
function machine(name, type, opts) {
  opts = opts || {}; const an = ANC[type], vo = opts.vo || { doorT: 0, tip: 0, tipA: 0 }, a = opts.a || 0, sk = type === "skate" ? 1.1 : 0, o = {};
  const ride = (t) => ({ x: t * (opts.drive || 0), y: 0, a: a + sk, st: { ride: 0, anc: an, ry: 0, veh: type, vsp: opts.drive || 0, stand: type === "skate", vo: vo, pil: opts.pil } });
  const ex = { x: 1.2 * Math.sin(a), y: -1.25 * Math.cos(a) };
  return run(name, [[.6, stand(opts.sx || -1.2, opts.sy || -1.4, .4)], [opts.inSecs || 2.4, ride], [1.0, (t) => ride(0)], [3.4, () => ({ x: ex.x, y: ex.y, a: a, st: { vel: 0 } })]], { o: o, vo: vo });
}
machine("bike", "bike"); machine("okada", "okada"); machine("scooter", "scooter"); machine("skate", "skate"); machine("car", "car", { inSecs: 2.6 }); machine("keke", "keke", { inSecs: 2.6 });
machine("kekePassenger", "keke", { pil: true, inSecs: 3.6 }); machine("okadaPillion", "okada", { pil: true });
machine("liftBike", "bike", { vo: { doorT: 0, tip: 1.45, tipA: 1.4 }, inSecs: 3 });
/* thrown off a bike: riding, then down off the side (bike tips the other way), lying, up */
function offBike(name, type, tip) {
  const vo = { tip: tip, tipA: 0 }, o = {}, an = ANC[type];
  run(name, [[.8, () => ({ x: 0, y: 0, a: 0, st: { ride: 0, anc: an, ry: 0, veh: type, vsp: 6, vo: vo } })],
    [2.2, (t, i, ob) => { if (i === 0) { ob.hitT = .4; ob.hitA = .3; } ob.hitT = Math.max(0, ob.hitT - DT); return { x: Math.min(t, .5) * 1.4, y: 0, a: .3, st: { fall: 2.2 - t } }; }],
    [1.4, (t, i, ob) => { ob.getUpT = Math.min(1, .001 + t / .7); if (ob.getUpT >= 1) ob.getUpT = 0; return { x: .7, y: 0, a: .3, st: {} }; }], [.8, () => ({ x: .7, y: 0, a: .3, st: {} })]], { o: o });
}
offBike("offBike", "bike", 1.45); offBike("offOkada", "okada", -1.45); offBike("offSkate", "skate", 1.45);
/* hands: on the steering wheel at ten to two as it turns either way (shuffling past ~50 degrees), on the handlebar grips, a
   pillion's hands at the rider's waist. Measured with the same joint chain: distance from each hand to where it should be. */
{ const car = Object.assign({}, ANC.car, { wheel: { c: [.42, .78, -.42], r: .15 }, wheelA: 0 }), g = figure(), r = g.userData.rig, hands = { wheelErr: 0, crossed: 0, shuffleFollow: 0, gripErr: 0, waistErr: 0 }; let t = 50;
  const hp = () => { const pts = []; A.fk(r.c, pts); const h = pts.filter((p) => p[0] === "hand"), s = r.root.s; return h.map((p) => [p[1] * s, (p[2] + (r.yAdj || 0)) * s, p[3] * s]); };
  for (let f = 0; f < 420; f++) { t += DT; const wa = f < 60 ? 0 : Math.sin((f - 60) / 60) * 1.5; car.wheelA = wa; P.pose(g, 0, 0, 0, { ride: 0, anc: car, ry: 0, veh: "car", near: true }, t);
    if (f < 30) continue; const H = hp(), hr = Math.max(-.9, Math.min(.9, wa)); if (H[0][2] >= H[1][2]) hands.crossed++;
    [-1.05, 1.05].forEach((p0, k) => { const ph = p0 + hr, ty = .78 + .15 * Math.cos(ph), tz = -.42 + .15 * Math.sin(ph); hands.wheelErr = Math.max(hands.wheelErr, Math.hypot(H[k][1] - ty, H[k][2] - tz)); }); }
  const b = Object.assign({}, ANC.okada), g2 = figure(), r2 = g2.userData.rig, g3 = figure(), r3 = g3.userData.rig;
  for (let f = 0; f < 60; f++) { t += DT; P.pose(g2, 0, 0, 0, { ride: 0, anc: b, ry: 0, veh: "okada", near: true }, t); P.pose(g3, 0, 0, 0, { ride: 0, anc: b, ry: 0, veh: "okada", pil: 1, near: true }, t); }
  [[r2, (k) => [b.grip[0], b.grip[1], (k ? 1 : -1) * b.grip[2]], "gripErr"], [r3, (k) => [b.seat[0] + .08, b.seat[1] + .32, (k ? 1 : -1) * .19], "waistErr"]].forEach(([rr, tgt, key]) => { const pts = []; A.fk(rr.c, pts); pts.filter((p) => p[0] === "hand").forEach((p, k) => { const T = tgt(k), sc = rr.root.s; hands[key] = Math.max(hands[key], Math.hypot(p[1] * sc - T[0], p[2] * sc - T[1], p[3] * sc - T[2])); }); });
  for (const k in hands) hands[k] = +hands[k].toFixed(3); out.hands = hands; }
/* cutscene skip: half way into sitting down, Z.anim.snap(o) — the next frame is the finished sitting pose */
run("snapSit", [[1, stand(0, 0, 0)], [.3, hold({ sit: true })], [1 / 60, (t, i, o) => { A.snap(o); return { x: 0, y: 0, a: 0, st: { sit: true } }; }], [1, stand(0, 0, 0)]]);
run("snapAll", [[1, stand(0, 0, 0)], [.4, hold({ fall: 2 })], [1 / 60, () => { A.snap(); return { x: 0, y: 0, a: 0, st: { fall: 2 } }; }], [.5, hold({ fall: 2 })]]);
/* game logic shoves someone 0.8 m in one frame (Z.hurt does): eased out, not a pop */
run("shoveJump", [[1, stand(0, 0, 0)], [1.2, stand(.8, 0, 0)]]);
/* steady gaits: the planted foot must stay planted (cycle speed matched to ground speed) */
for (const [nm, sp] of [["stroll", 1.2], ["walk", 3.5], ["jog", 5], ["sprint", 6.4]]) run("feet_" + nm, [[3, (t) => ({ x: t * sp, y: 0, a: 0, st: { vel: sp } })]], { moving: true, slide: true });
/* walking about and turning on the spot, for the foot checks */
run("walkTurn", [[1, (t) => ({ x: t * 3.5, y: 0, a: 0, st: { vel: 3.5 } })], [1, (t) => ({ x: 3.5, y: 0, a: t * 3, st: { vel: 0 } })], [3, () => ({ x: 3.5, y: 0, a: 3, st: { vel: 0 } })]], { moving: true });
/* every outfit with every animation: the 83 wardrobe items, dressed one at a time; the ones that hang cloth over the legs
   (robes, gowns, skirts, tunics, coats) run through every frame above; a leg must never poke through the side of the cloth */
{ const NAMES = { "fslg-map": "SamaruMap", "samaru-sim": "SamaruSim", "samaru-data": "SamaruData" }; global.self = global; global.document = global.document || { createElement: () => ({ getContext: () => null }) };
  for (const f of ["fslg-map", "samaru-sim", "samaru-data", "samaru-wardrobe"]) { module.exports = {}; (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); if (NAMES[f] && !global[NAMES[f]]) global[NAMES[f]] = module.exports; }
  const D = global.SamaruData, S = global.SamaruSim, W = global.SamaruGame.wardrobe, cloth = { items: 0, shells: 0, frames: 0, miss: 0, worst: 0, flare: 0, bad: [] };
  D.WARDROBE.forEach((it) => { cloth.items++; const fit = { acc: [] }; if (it.slot === "acc") fit.acc = [it.id]; else fit[it.slot] = it.id; const sp = W.spec({ skin: "#8d5524", fit: S.fitClean(fit, D.WARDROBE) }, "tee");
    [sp.shell, sp.tunic2 && { k: "tunic", len: sp.tunic2.len }].forEach((sh) => { if (!sh) return; cloth.shells++; const rb = .2 + sh.len * (sh.k === "tunic" ? .1 : .2), sx0 = .86 * (sh.open ? 1.04 : 1), fo = {};
      for (const nm in POSES) { const stt = {}; POSES[nm].forEach((q) => { A.shellFit(q.hL, q.kL, q.hR, q.kR, sh.len, rb, sx0, stt, DT, fo); cloth.frames++; cloth.flare = Math.max(cloth.flare, fo.sx); if (fo.miss > .005) { cloth.miss++; cloth.worst = Math.max(cloth.worst, fo.miss); if (cloth.bad.length < 8 && cloth.bad.indexOf(it.id + "/" + nm) < 0) cloth.bad.push(it.id + "/" + nm); } }); } }); });
  cloth.worst = +cloth.worst.toFixed(3); cloth.flare = +cloth.flare.toFixed(2); out.cloth = cloth; }
process.stdout.write(JSON.stringify(out) + "\n");
