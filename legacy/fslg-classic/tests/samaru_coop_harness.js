/* Headless friends missions: 2, 3 and 6 simulated players exchange packed messages through an in-process
   copy of the room relay (games/rooms.py rules: 5 events per post, 40 kept, oversized events dropped) and
   play every friends mission and every session set to the result screen.
   Usage: node samaru_coop_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on a thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
global.window = global; global.self = global;
{ let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
for (const f of ["fslg-map", "samaru-sim", "samaru-data", "fslg-story-coop"]) (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8"));
const S = global.SamaruSim, C = global.FSLGCoop, W = S.buildWorld(global.SamaruMap);
const HOSTELS = ["akenzua", "ribadu", "amina", "suleiman", "akenzua", "amina"];
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function Room() { this.ev = []; this.seq = 0; this.st = {}; this.posted = {}; this.dropped = 0; this.maxLen = 0; this.count = 0; }
Room.prototype.sync = function (pid, st, evs, since, now) {
  this.posted[pid] = now; this.st[pid] = JSON.parse(JSON.stringify(st));
  for (const raw of evs.slice(0, 5)) { if (raw.d) this.maxLen = Math.max(this.maxLen, raw.d.length); const e = C.clean(raw); if (!e) { this.dropped++; continue; } this.seq++; this.count++; e.i = this.seq; e.f = pid; this.ev.push(e); }
  this.ev = this.ev.slice(-40);
  const players = {}; for (const k in this.st) if (+k !== pid && now - this.posted[k] < 8) players[k] = this.st[k];
  return { players, ev: this.ev.filter((e) => e.i > since) };
};

function Bot(pid, room, host) {
  this.pid = pid; this.room = room; this.cl = new C.Client(pid, W); this.host = host ? new C.Host(pid, W) : null; this.out = []; this.since = 0; this.seen = {};
  this.p = { x: 0 + pid * 3, y: -300, a: 0, v: "", z: 0, e: "", s: 0, f: "t" + (pid % 4) + ".s" + (pid % 3) + ".h" + pid }; this.torch = false; this.tele = ""; this.sw = 0; this.cd = {}; this.rh = {}; this.r = rnd(pid * 977 + 13); this.res = null; this.resAll = []; this.alive = true; this.eT = 0; this.meT = 0; this.goT = 0;
}
Bot.prototype.V = function () { const V = Object.assign({}, this.seen); V[this.pid] = this.p; return V; };
Bot.prototype.claim = function (c) { if (this.host && this.host.st) this.host.claim(this.pid, Object.assign({ sid: this.cl.st.sid, si: this.cl.st.si }, c)); else this.cl.claim(c); };
Bot.prototype.step = function (dt, now) {
  if (!this.alive) return;
  if (this.host && this.host.st) { this.host.tick(dt, this.V(), now); this.host.out.splice(0).forEach((ev) => { this.out.push(ev); this.cl.apply(ev.d, now); }); }
  const cl = this.cl, st = cl.st; if (!st) return;
  if (st.ph === "rs" && st.res) { const k = st.sid + ":" + st.si; if (!this.resAll.some((r) => r.k === k)) { this.resAll.push({ k, res: JSON.stringify(st.res), sc: JSON.stringify(st.sc), lg: JSON.stringify(st.lg), mid: st.mid, rw: cl.reward() }); } }
  this.meT -= dt; if (this.meT <= 0 && cl.mine()) { this.meT = 1.2; this.claim({ o: "me", torch: this.torch, en: 50 + Math.floor(this.r() * 50), ch: false, hm: HOSTELS[this.pid % HOSTELS.length] }); }
  const key = st.sid + ":" + st.si + ":" + st.rd; if (st.ph === "ct" && cl.mine() && this.tele !== key) { this.tele = key; const sp = cl.startPos(); this.p.x = sp.x; this.p.y = sp.y; this.p.a = sp.a || 0; this.p.v = sp.v || ""; this.p.z = 0; this.goT = 0; }
  if (st.sw && st.sw[2] !== this.sw) { this.sw = st.sw[2]; const o = st.sw[0] === this.pid ? st.sw[1] : st.sw[1] === this.pid ? st.sw[0] : null; if (o != null && this.seen[o]) { this.p.x = this.seen[o].x; this.p.y = this.seen[o].y; } }
  if (st.ph !== "go") { this.p.s = 0; return; } this.goT += dt;
  const t = cl.task(this.V()); if (!t) { this.p.s = 0; return; }
  if (t.veh !== undefined) this.p.v = t.veh; this.torch = !!t.torch; if (this.eT > 0) { this.eT -= dt; if (this.eT <= 0) this.p.e = ""; }
  this.p.z = this.p.v === "plane" && this.goT > 3 ? 1 : 0;
  let moving = false;
  if (t.x != null) { const dx = t.x - this.p.x, dy = t.y - this.p.y, d = Math.hypot(dx, dy), sp = (this.p.v ? S.VEH[this.p.v].max : 6) * .8, keep = t.act && t.r ? Math.min(t.r * .5, 1.5) : .5;
    if (d > keep) { const k = Math.min(1, sp * dt / d); this.p.x += dx * k; this.p.y += dy * k; this.p.a = Math.atan2(dy, dx); this.p.s = Math.min(sp, d / dt); moving = true; } else this.p.s = 0; }
  if (st.mid === "F14" && st.x.sk !== this.pid && st.rt > 15 && t.hide && Math.hypot(t.x - this.p.x, t.y - this.p.y) < 2) this.p.s = 0;
  const near = !t.act || t.x == null || !t.r || Math.hypot(this.p.x - t.x, this.p.y - t.y) <= t.r;
  if (t.act && near) { const k = t.act.o + (t.act.k != null ? t.act.k : ""); if (!(this.cd[k] > now)) { this.cd[k] = now + .5;
    if (t.act.o === "emote") { this.p.e = t.act.e; this.eT = 3; }
    else if (t.act.o === "ht" && st.mid === "F16") this.claim({ o: "ht", to: t.act.to, w: t.act.w === "s" ? "s" : (this.r() < .3 ? "k" : "p") });
    else if (t.act.o === "sh") this.claim({ o: "sh", q: Math.round((.35 + .65 * this.r()) * 100) / 100 });
    else if (t.act.o === "ph") this.claim({ o: "ph", k: t.act.k, h: 18 });
    else this.claim(Object.assign({}, t.act)); } }
  if (t.meter && near && !(this.cd.sh > now)) { this.cd.sh = now + .8; this.claim({ o: "sh", q: Math.round((.35 + .65 * this.r()) * 100) / 100 }); }
  if (t.rhythm) { const R = t.rhythm, k = R.k + ":" + st.sid + ":" + st.si; const b = this.rh[k] || (this.rh[k] = { t: 0, sent: false }); b.t += dt;
    if (R.loop) { if (b.t >= 5) { b.t = 0; this.claim({ o: "rh", v: .85 }); } } else if (b.t >= R.secs && !b.sent) { b.sent = true; this.claim({ o: "sc", k: R.k, v: Math.floor(C.maxScore(C.beats(R.bpm, R.secs)) * (.55 + .4 * this.r())) }); } }
  if (t.arcade) { const k = "a" + t.arcade.k + ":" + st.sid; const b = this.rh[k] || (this.rh[k] = { t: 0, sent: false }); b.t += dt; if (b.t > 20 && !b.sent) { b.sent = true; this.claim({ o: "sc", k: t.arcade.k, v: Math.floor(this.r() * 2500) }); } }
  void moving;
};
Bot.prototype.sync = function (now) {
  if (!this.alive) return; const a = this.out.splice(0, 5), evs = a.concat(this.cl.out.splice(0, 5 - a.length));
  const j = this.room.sync(this.pid, this.p, evs, this.since, now);
  this.seen = {}; for (const k in j.players) this.seen[+k] = j.players[k];
  for (const e of j.ev) { this.since = Math.max(this.since, e.i); if (e.f === this.pid || e.k !== "co") continue;
    if (e.o === "S") { if (this.host && this.host.st && e.f !== this.pid) continue; this.cl.apply(e.d, now); }
    else if (e.o === "C" && this.host && this.host.st) this.host.claim(e.f, JSON.parse(e.d)); }
};

function play(n, sel, opts) {
  opts = opts || {}; const room = new Room(), bots = []; for (let i = 0; i < n; i++) bots.push(new Bot(101 + i, room, i === 0));
  const host = bots[0], dt = .25; let now = 1000;
  for (let k = 0; k < 4; k++) { bots.forEach((b) => b.sync(now)); now += dt; }
  const ok = host.host.start(sel, bots.map((b) => b.pid), opts.opt || {}, opts.mut || [], opts.seed || 777); host.cl.apply(host.host.last, now); if (!ok) return { error: "could not start " + sel };
  let t = 0, late = null, lateSync = null, left = null; const cap = opts.cap || 4000;
  while (t < cap) {
    bots.forEach((b) => b.step(dt, now)); bots.forEach((b) => b.sync(now)); now += dt; t += dt;
    if (opts.lateAt && t >= opts.lateAt && !late) { late = new Bot(201, room, false); bots.push(late); late.joined = now; }
    if (late && lateSync == null && late.cl.st && host.cl.st && late.cl.st.v >= host.cl.st.v - 2) lateSync = now - late.joined;
    if (opts.hostLeaveAt && t >= opts.hostLeaveAt && host.alive) { host.alive = false; left = now; }
    if (left != null && t >= opts.hostLeaveAt + 12) break;
    if (!host.host.st && t > 2) { for (let k = 0; k < 8; k++) { bots.forEach((b) => b.sync(now)); now += dt; } break; }
  }
  return { bots, room, t, late, lateSync, left, now };
}
function agree(bots, n) { const live = bots.filter((b) => b.alive && b.pid < 200); const ref = live[0].resAll.map((r) => r.k + r.res + r.sc + r.lg).join("|"); return live.every((b) => b.resAll.map((r) => r.k + r.res + r.sc + r.lg).join("|") === ref) && live[0].resAll.length >= n; }

const out = { ok: true, runs: [], fails: [] };
try {
  out.missions = C.MISSIONS.length; out.sets = C.SETS.length; out.riddles = C.RIDDLES.length; out.photos = C.PHOTO.length;
  // every mission, every allowed size
  for (const n of [2, 3, 6]) for (const m of C.MISSIONS) {
    if (n < m.min || n > m.max) continue;
    const r = play(n, m.id, { seed: 100 + n * 7 + C.MISSIONS.indexOf(m), opt: m.id === "F10" && n >= 4 ? { tm: true } : m.id === "F12" && n === 3 ? { vs: true } : {} });
    const b0 = r.bots[0], res = b0.resAll[0] ? JSON.parse(b0.resAll[0].res) : null;
    const row = { n, id: m.id, t: Math.round(r.t), done: !!res, agree: res ? agree(r.bots, 1) : false, win: res ? (res.cp ? res.rk[0] : res.w) : null, aw: res ? res.aw.length : 0, rw: !!b0.resAll[0] && !!b0.resAll[0].rw, maxMsg: r.room.maxLen, dropped: r.room.dropped, events: r.room.count };
    out.runs.push(row); if (!row.done || !row.agree || row.dropped || row.maxMsg > C.MAXMSG || row.aw < 2) out.fails.push(row);
  }
  // session sets with three players, and the grand tour with six
  out.setRuns = [];
  for (const [n, id] of [[3, "quick"], [3, "sports"], [3, "night"], [6, "tour"]]) { const r = play(n, id, { seed: 31 + n, cap: 9000 }), b0 = r.bots[0], list = b0.resAll.map((x) => x.mid);
    const row = { n, id, missions: list, agree: agree(r.bots, list.length), league: b0.resAll.length ? JSON.parse(b0.resAll[b0.resAll.length - 1].lg) : {}, dropped: r.room.dropped, night: id === "night" ? b0.cl.st && b0.cl.st.mut.indexOf("lt") >= 0 : null };
    out.setRuns.push(row); if (!row.agree || list.length < 3 || row.dropped) out.fails.push(row); }
  // every twist at once on a race (swap included)
  { const r = play(3, "F1", { seed: 9, mut: ["hm", "lt", "gw", "md", "or", "sw", "tp"], opt: { ride: "okada" } }), b0 = r.bots[0]; out.mutators = { done: b0.resAll.length === 1, agree: agree(r.bots, 1), swapped: r.bots.some((b) => b.sw > 0), veh: b0.p.v }; if (!out.mutators.done || !out.mutators.agree || !out.mutators.swapped) out.fails.push({ mutators: out.mutators }); }
  // a late joiner sees the game within a second or two and watches until the next mission
  { const r = play(3, "F10", { seed: 5, lateAt: 40 }); out.late = { synced: r.lateSync != null && r.lateSync <= 2, after: r.lateSync, spectator: !!r.late && !!r.late.cl.st && !r.late.cl.st.n.includes(201), done: r.bots[0].resAll.length === 1 }; if (!out.late.synced || !out.late.spectator) out.fails.push({ late: out.late }); }
  // the host walks out: everyone else's view goes stale within the leave window, so the game can end it cleanly
  { const r = play(3, "F13", { seed: 6, hostLeaveAt: 30 }); const others = r.bots.slice(1); out.hostLeft = { stale: others.every((b) => b.cl.st && r.now - b.cl.seen > 8), noResult: others.every((b) => !b.resAll.length) }; if (!out.hostLeft.stale) out.fails.push({ hostLeft: out.hostLeft }); }
  // the referee says no: far photos, long-range punches and a teleport are all ignored
  { const H = new C.Host(1, W), cl = new C.Client(1, W); H.start("F16", [1, 2], {}, [], 3); cl.apply(H.last, 0); let now = 0; const L16 = C.layout(H.st, W), Lc = L16.c, w = L16.sl ? "s" : "p", hit1 = 100 - (L16.sl ? 10 : 12); const far = { 1: { x: Lc.x, y: Lc.y, a: 0, v: "", z: 0, e: "", s: 0 }, 2: { x: Lc.x + 40, y: Lc.y, a: 0, v: "", z: 0, e: "", s: 0 } };
    for (let i = 0; i < 50; i++) { H.tick(.25, far, now); now += .25; } const sid = H.st.sid, si = H.st.si; for (let i = 0; i < 5; i++) { H.claim(1, { o: "ht", to: 2, w, sid, si }); H.tick(.5, far, now); now += .5; }
    const farHit = H.st.x.hp[2]; const close = { 1: far[1], 2: { x: Lc.x + 1, y: Lc.y, a: 0, v: "", z: 0, e: "", s: 0 } }; H.tick(.25, close, now); now += .25; H.claim(1, { o: "ht", to: 2, w, sid, si }); const closeHit = H.st.x.hp[2];
    const jump = { 1: { x: 600, y: 600, a: 0, v: "", z: 0, e: "", s: 0 }, 2: close[2] }; now += 10; H.tick(.25, jump, now); H.tick(.25, close, now + .25); H.claim(1, { o: "ht", to: 2, w, sid, si }); const afterJump = H.st.x.hp[2];
    const P2 = new C.Host(1, W); P2.start("F12", [1, 2], {}, [], 4); for (let i = 0; i < 50; i++) P2.tick(.25, { 1: { x: 1500, y: 900, a: 0, v: "", z: 0, e: "", s: 0 }, 2: { x: 1800, y: 1000, a: 0, v: "", z: 0, e: "", s: 0 } }, i * .25);
    for (let k = 0; k < 6; k++) P2.claim(1, { o: "ph", k, h: 18, sid: P2.st.sid, si: P2.st.si }); const farPhotos = P2.st.x.all;
    const bad = { far: farHit === 100, close: closeHit === hit1, teleportIgnored: afterJump === hit1, photosRejected: farPhotos === 0 }; out.referee = bad; if (!bad.far || !bad.close || !bad.teleportIgnored || !bad.photosRejected) out.fails.push({ referee: bad }); }
  // the relay rule: what is too long or malformed is dropped
  out.clean = { long: C.clean({ k: "co", o: "S", d: "x".repeat(C.MAXMSG + 1) }) === null, kind: C.clean({ k: "chat", o: "S", d: "{}" }) === null, strip: C.clean({ k: "co", o: "SS!", d: "a\u0000b" }).o === "SS" && C.clean({ k: "co", o: "S", d: "a\u0000b" }).d === "ab" };
  if (!out.clean.long || !out.clean.kind || !out.clean.strip) out.fails.push({ clean: out.clean });
  out.ok = !out.fails.length;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
const summary = { ok: out.ok, error: out.error, missions: out.missions, sets: out.sets, riddles: out.riddles, photos: out.photos, runs: out.runs.length, fails: out.fails, setRuns: out.setRuns, mutators: out.mutators, late: out.late, hostLeft: out.hostLeft, referee: out.referee, clean: out.clean,
  table: (out.runs || []).map((r) => r.n + r.id + ":" + (r.done ? (r.win === true || r.win === 1 ? "W" : r.win === false || r.win === 0 ? "L" : "R") : "X") + Math.round(r.t) + "s/" + r.maxMsg).join(" ") };
console.log(JSON.stringify(summary));
process.exit(out.ok ? 0 : 1);
