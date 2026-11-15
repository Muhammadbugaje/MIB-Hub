// Impulse Arena: simple "spam" players against the CPU, to catch loops that win too easily (docs/ARCADE_AUDIT.md §1.2).
// usage: node clash_bots.js <skill> <matches>   → JSON {bot: winRate}
const D = require("../../static/js/games/clashdata.js");
const skill = +(process.argv[2] || 0.55), N = +(process.argv[3] || 12);
const toward = (f, o) => (o.x > f.x ? { r: 1 } : { l: 1 });
const BOTS = {
  walkJab: (m, f, o, t) => Object.assign(toward(f, o), Math.abs(o.x - f.x) < 0.9 ? { h: { LP: (t % 8) < 4 } } : {}),
  sweep: (m, f, o, t) => Math.abs(o.x - f.x) > 1.0 ? toward(f, o) : Object.assign(o.x > f.x ? { l: 1 } : { r: 1 }, { h: { LK: (t % 10) < 5 } }),
  jumpKick: (m, f, o, t) => Object.assign(toward(f, o), { u: (t % 40) < 3 ? 1 : 0, h: { HK: (t % 40) > 20 && (t % 40) < 26 } }),
  upper: (m, f, o, t) => Object.assign(Math.abs(o.x - f.x) > 0.8 ? toward(f, o) : {}, { d: 1, h: { HP: (t % 14) < 7 } }),
  throwSpam: (m, f, o, t) => Object.assign(toward(f, o), { h: { LP: (t % 6) < 3 } }),
  fireball: (m, f, o, t) => { const k = t % 30; return k < 4 ? { d: 1 } : k < 8 ? Object.assign({ d: 1 }, toward(f, o)) : k < 10 ? Object.assign(toward(f, o), { h: { HP: 1 } }) : {}; },
  heavyMash: (m, f, o, t) => Object.assign(Math.abs(o.x - f.x) > 1.1 ? toward(f, o) : {}, { h: { HK: (t % 12) < 6, HP: (t % 12) >= 6 } }),
  turtle: (m, f, o, t) => Object.assign({ blk: 1 }, (t % 60) < 4 ? { h: { LP: 1 } } : {})
};
const P1 = ["newton", "kai", "ohm", "volta", "static", "archimedes"], P2 = ["tesla", "bohr", "curie", "galileo", "maxwell", "hypatia"];
const out = {};
for (const name of Object.keys(BOTS)) {
  let wins = 0, played = 0;
  for (let i = 0; i < N; i++) {
    const a = P1[i % P1.length], b = P2[(i * 5 + 1) % P2.length];
    const m = D.create({ p1: a, p2: b, mode: "versus", seed: 1000 + i * 31, weapons: false, p2o: { cpu: true, skill: skill } });
    let t = 0;
    while (m.phase !== "over" && t < 120 * 400) { const f = m.f[0], o = m.f[1]; const c = BOTS[name](m, f, o, t); c.h = c.h || {}; D.step(m, [c, {}], 1 / 120); m.ev = []; t++; }
    played++; if (m.winner === 0) wins++;
  }
  out[name] = Math.round(100 * wins / played) / 100;
}
console.log(JSON.stringify(out));
