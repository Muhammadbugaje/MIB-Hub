/* Handling numbers for Freshers School Life (pedal feel, brakes, turning): node samaru_feel.js <static/js/games/samaru-sim.js>
   Before the Nov 2026 pass: car 0-80% 3.41 s, launch 7.5 m/s2 at once, brake from 90% 16.2 m (1.6 g); bicycle brake 2.5 m (1.3 g).
   After: throttle and brake ease in over ~0.1 s, brakes 0.75 g (two-wheelers) to ~1.3 g (sports car), weight transfer on turn-in. */
const S = require(process.argv[2] || "/Users/macbookair/Downloads/eehub-2/static/js/games/samaru-sim.js"); const DT = 1/120, out = {};
function sim(type, secs, inp, st) { const v = Object.assign({ x: 0, y: 0, a: 0, vx: 0, vy: 0, speed: 0 }, st || {}); const L = []; for (let i = 0; i < secs / DT; i++) { const t = i * DT; S.stepVehicle(v, S.VEH[type], inp(t, v) || {}, DT, 1); L.push({ t, sp: v.speed, a: v.a, x: v.x, y: v.y, yaw: v.yaw, sl: v.slide }); } return { v, L }; }
for (const type of ["bike", "okada", "keke", "car", "sport"]) { const sp = S.VEH[type], r = {};
  let q = sim(type, 15, () => ({ throttle: 1 })); const t80 = q.L.find((e) => e.sp >= sp.max * .8); r.t80 = t80 ? +t80.t.toFixed(2) : null;
  r.jerk0 = +((q.L[6].sp - q.L[0].sp) / (6 * DT)).toFixed(1); // initial accel m/s2
  q = sim(type, 6, () => ({ throttle: -1 }), { vx: sp.max * .9 }); const st = q.L.find((e) => e.sp <= .2); r.brake = st ? +Math.hypot(st.x, st.y).toFixed(1) : null; r.brakeT = st ? +st.t.toFixed(2) : null;
  q = sim(type, 8, () => ({ throttle: .5, steer: 1 }), { vx: sp.max * .5 }); const h = q.L.slice(-240); let xs = h.map((e) => e.x), ys = h.map((e) => e.y); r.radius50 = +(((Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys))) / 4).toFixed(1);
  q = sim(type, 8, () => ({ throttle: 1, steer: 1 }), { vx: sp.max * .9 }); xs = q.L.slice(-240).map((e) => e.x); ys = q.L.slice(-240).map((e) => e.y); r.radiusTop = +(((Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys))) / 4).toFixed(1);
  q = sim(type, 5, () => ({ throttle: -1 })); r.revTop = +Math.min(...q.L.map((e) => e.sp)).toFixed(1);
  out[type] = r; }
console.log(JSON.stringify(out));
