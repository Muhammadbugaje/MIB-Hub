/* Handling checks for Freshers School Life, run headless at 60 Hz against the same rules the game uses.
   usage: node samaru_drive.js <static/js/games dir>   → one JSON line: { ok, veh: { type: {...} } } */
const path = require("path"), dir = path.resolve(process.argv[2]);
const S = require(path.join(dir, "samaru-sim.js"));
// the visual lean filter from samaru-veh.js, driven with stand-in objects so it can be measured without WebGL
global.window = global; global.SamaruSim = S; global.SamaruGame = { P: null, W: null };
require(path.join(dir, "samaru-veh.js")); const V = global.SamaruGame.veh;
function mesh(type) { return { userData: { body: { rotation: {}, position: {} }, wheels: [], heads: [], tails: [], shadow: { position: {} }, two: !!S.VEH[type].two, type: type, base: 1.4, motor: true }, position: { set() {} }, rotation: {} }; }
function car() { return { x: 0, y: 0, a: 0, vx: 0, vy: 0, speed: 0 }; }
const DT = 1 / 60, out = { ok: true, veh: {} };
function sim(type, secs, input, start) {
  const spec = S.VEH[type], v = Object.assign(car(), start || {}), m = mesh(type), log = []; let t = 0;
  V.lamp = V.lamp || { headOn: 1, headOff: 2, tailOn: 3, tailOff: 4, brake: 5 };
  for (let i = 0; i < Math.round(secs / DT); i++) { t += DT; S.stepVehicle(v, spec, input(t, v) || {}, DT, 1); V.move({ shadows: true }, m, v, t, 0, true); log.push({ t, x: v.x, y: v.y, a: v.a, yaw: v.yaw, st: v.st, vl: v.slide, sp: v.speed, lean: m.userData.two ? m.rotation.x : m.userData.body.rotation.x }); }
  return { v, log };
}
function flips(arr, eps) { let n = 0, s = 0; for (const q of arr) { const z = q > eps ? 1 : q < -eps ? -1 : 0; if (z && s && z !== s) n++; if (z) s = z; } return n; }
for (const type of ["skate", "bike", "scooter", "okada", "keke", "car", "sport"]) {
  const spec = S.VEH[type], r = {}, top = spec.max;
  // 1. straight: 100 m with a tap of steering early on; it must settle and track true
  let q = sim(type, 100 / (top * .8) + 3, (t) => ({ throttle: 1, steer: t > 1 && t < 1.08 ? 1 : 0 }));
  const after = q.log.filter((e) => e.t > 2.2); r.straightHeadingDrift = +(Math.max(...after.map((e) => e.a)) - Math.min(...after.map((e) => e.a))).toFixed(4);
  r.straightLeanFlips = flips(after.map((e) => e.lean), .002); r.straightLeanPeak = +Math.max(...after.map((e) => Math.abs(e.lean))).toFixed(4);
  q = sim(type, 100 / (top * .8) + 3, () => ({ throttle: 1 })); r.lateral100m = +Math.abs(q.v.y).toFixed(4);
  // 2. slalom: left and right every 1.2 s; one lean-in and lean-out per turn, and no growth from gate to gate
  q = sim(type, 12, (t) => ({ throttle: .8, steer: t < 2 ? 0 : Math.floor((t - 2) / 1.2) % 2 ? -1 : 1 }));
  const sl = q.log.filter((e) => e.t > 2), gates = []; for (let g = 0; g < 8; g++) { const seg = sl.filter((e) => e.t >= 2 + g * 1.2 && e.t < 2 + (g + 1) * 1.2); gates.push(Math.max(...seg.map((e) => Math.abs(e.lean)))); }
  r.slalomLeanFlips = flips(sl.map((e) => e.lean), .01); r.slalomSteerFlips = flips(sl.map((e) => e.st), .01); r.slalomGrowth = +(Math.max(...gates.slice(4)) / Math.max(1e-6, Math.max(...gates.slice(1, 4)))).toFixed(3);
  r.slalomLeanJerk = +Math.max(...sl.slice(1).map((e, i) => Math.abs(e.lean - sl[i].lean) / DT)).toFixed(2); r.slalomSlide = +Math.max(...sl.map((e) => e.vl)).toFixed(2);
  // 3. handbrake turn: from 60% of top speed, hold handbrake and steer to 90 degrees, let go, and be settled in 1.5 s
  let rel = null, a0 = 0; q = sim(type, 8, (t, v) => { if (rel == null && Math.abs(v.a) >= Math.PI / 2) rel = t; return rel == null ? { throttle: 0, steer: 1, brake: true } : { throttle: .6 }; }, { vx: top * .6 });
  r.hbTurnTime = rel == null ? null : +rel.toFixed(2);
  if (rel != null) { const post = q.log.filter((e) => e.t > rel), set = post.find((e, i) => post.slice(i, i + 20).every((z) => z.vl < .4 && Math.abs(z.yaw) < .12)); r.hbRecover = set ? +(set.t - rel).toFixed(2) : null; r.hbOverRotate = +(Math.max(...post.map((e) => Math.abs(e.a))) - Math.PI / 2).toFixed(2); r.hbExitSpeed = +(q.v.speed).toFixed(1); }
  // 4. a long drift at 60%: handbrake and full lock for 1.2 s, then hands off; it must not spin
  q = sim(type, 6, (t) => (t < 1.2 ? { throttle: 1, steer: 1, brake: true } : { throttle: .5 }), { vx: top * .6 });
  r.driftTotalTurn = +Math.abs(q.v.a).toFixed(2); r.driftPeakSlip = +Math.max(...q.log.map((e) => Math.atan2(e.vl, Math.max(1, Math.abs(e.sp))))).toFixed(2); r.driftEndSlide = +q.v.slide.toFixed(2); r.driftEndSpeed = +q.v.speed.toFixed(1);
  // 5. crawling: full lock at walking pace must not twitch
  q = sim(type, 4, (t) => ({ throttle: .25, steer: t > 1 ? 1 : 0 })); r.lowYawPeak = +Math.max(...q.log.map((e) => Math.abs(e.yaw))).toFixed(2); r.lowLeanPeak = +Math.max(...q.log.map((e) => Math.abs(e.lean))).toFixed(3);
  out.veh[type] = r;
}
console.log(JSON.stringify(out));
