/* Signal Surfer channel model (EEEN 342: overview of telecommunication systems, noise).
 * Free-space link: Pr = Pt·Gt·Gr·(c / 4πdf)²  (Friis). Thermal noise PSD N0 = kT0·F (F = noise factor) plus interferers.
 * BPSK over additive white Gaussian noise: Eb/N0 = Pr / (N0·Rb), bit error rate BER = ½·erfc(√(Eb/N0)).
 * A 1000-bit packet survives with probability (1 − BER)^1000; goodput = Rb·(1 − BER)^1000.
 * Shannon: no scheme can beat C = B·log₂(1 + S/N); with B = Rb this is Rb·log₂(1 + Eb/N0).
 * Units: W, Hz, m, s, bits. Game-world simplification: a slow deterministic fade instead of random fading. */
(function (root) {
  "use strict";
  var EFF = 0.35, /* transmitter efficiency: battery power = Pt / 0.35 */ C = 3e8, KT0 = 4.0e-21, PKT = 1000, RATES = [0.25e6, 0.5e6, 1e6, 2e6, 4e6, 8e6], FMIN = 0.4e9, FMAX = 6e9;
  function erfc(x) { // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7
    var z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
    var y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
    return x >= 0 ? y : 2 - y;
  }
  function db(v) { return 10 * Math.log10(v); }
  function undb(d) { return Math.pow(10, d / 10); }
  function dbm(w) { return db(w * 1000); }
  function pathGain(d, f) { var a = C / (4 * Math.PI * d * f); return a * a; }
  function ber(ebn0) { return ebn0 <= 0 ? 0.5 : 0.5 * erfc(Math.sqrt(ebn0)); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  /* interferer: centre f0 (Hz), half-width w (Hz), level j (× thermal), drift (Hz/s) bouncing in the band, duty on/off */
  function jamAt(L, j, t) {
    var span = FMAX - FMIN, p = (j.f0 - FMIN + j.drift * t) % (2 * span); if (p < 0) p += 2 * span;
    var f = FMIN + (p > span ? 2 * span - p : p), on = !j.period || ((t + j.phase) % j.period) < j.period * j.duty;
    return { f: f, on: on };
  }
  function noisePSD(L, f, t) {
    var n0 = KT0 * undb(L.nf), s = 0;
    (L.jams || []).forEach(function (j) { var a = jamAt(L, j, t); if (!a.on) return; var u = (f - a.f) / j.w; s += j.j * Math.exp(-u * u); });
    return n0 * (1 + s);
  }
  function fade(L, t) { return L.fade ? undb(-L.fade * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / L.fadeT + 1.3)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / (L.fadeT * 0.37)))) : 1; }
  function link(L, cfg, t) { // cfg: {pt W, f Hz, rb bit/s}
    var pr = cfg.pt * pathGain(L.d, cfg.f) * undb(-(L.loss || 0)) * fade(L, t), n0 = noisePSD(L, cfg.f, t), e = pr / (n0 * cfg.rb), b = ber(e);
    var good = cfg.rb * Math.pow(1 - b, PKT), cap = cfg.rb * Math.log2(1 + e);
    return { pr: pr, n0: n0, ebn0: e, ebn0db: db(e), ber: b, goodput: good, capacity: cap, snrdb: db(e) };
  }
  /* 26 levels. Each row: name, distance m, message Mb, time s, max Pt W, battery J, noise figure dB, jammer recipe, fade dB, teaching */
  var ROWS = [
    ["First contact", 200, 20, 30, 0.1, 30, 6, 0, 0, "Received power falls with the square of distance: double d and Pr drops 6 dB (Friis)."],
    ["Turn it up", 800, 20, 30, 0.1, 30, 6, 0, 0, "Signal-to-noise ratio is a ratio of powers. 3 dB is twice the power; 10 dB is ten times."],
    ["Lower is longer", 2000, 15, 30, 0.1, 30, 6, 0, 0, "Path loss also grows with frequency (20·log f). Lower carriers reach further for the same power."],
    ["Thermal floor", 1500, 30, 30, 0.1, 30, 9, 0, 0, "Every receiver hears thermal noise kT0 = −174 dBm/Hz, raised by its noise figure."],
    ["Slow and sure", 4000, 8, 30, 0.1, 30, 6, 0, 0, "Halving the bit rate doubles the energy per bit Eb, so Eb/N0 rises 3 dB and errors fall fast."],
    ["Error cliff", 3000, 25, 30, 0.1, 35, 6, 0, 0, "BPSK bit errors fall off a cliff: about 10⁻⁵ needs Eb/N0 ≈ 9.6 dB. A few dB decide everything."],
    ["Packets", 2500, 40, 30, 0.2, 40, 6, 0, 0, "A 1000-bit packet fails if any bit is wrong, so goodput = Rb·(1 − BER)^1000."],
    ["Neighbours", 1200, 40, 30, 0.1, 30, 6, 1, 0, "An interferer raises the noise floor near its frequency. Move your carrier away from it."],
    ["Busy band", 1500, 40, 30, 0.1, 30, 6, 2, 0, "Channel selection is the cheapest fix for interference: it costs no power."],
    ["Drifters", 1200, 45, 35, 0.1, 35, 6, 3, 0, "Some interferers wander. Watch the spectrum and keep tuning."],
    ["Shannon's wall", 3000, 60, 30, 0.2, 40, 6, 1, 0, "No code beats Shannon's limit C = B·log₂(1 + S/N). More rate without more SNR only adds errors."],
    ["Battery budget", 2500, 35, 35, 0.2, 18, 6, 1, 0, "Energy per bit costs battery. The cheapest delivery uses just enough Eb/N0, no more."],
    ["Fading", 2000, 30, 35, 0.1, 35, 6, 0, 8, "Fading makes received power rise and fall. Send hard in the good moments, ease off in the deep fades."],
    ["Deep fades", 2500, 30, 40, 0.1, 40, 6, 1, 14, "A 14 dB fade cuts power to 1/25. Adapting the rate (link adaptation) keeps the link alive."],
    ["Pulse jammer", 1500, 45, 35, 0.1, 35, 6, 4, 0, "Pulsed interference comes and goes. Send fast when the band is quiet."],
    ["Crowded city", 1200, 60, 35, 0.1, 40, 7, 5, 4, "Many signals share the spectrum. Find the quiet gap and hold it."],
    ["Long haul", 5000, 20, 40, 0.5, 60, 5, 1, 4, "A long link needs a low carrier, a low rate and every dB of power the rules allow."],
    ["Noisy front end", 2500, 40, 35, 0.2, 45, 12, 2, 0, "A noisy first amplifier (high noise figure) wastes dB you cannot win back later."],
    ["Storm front", 2000, 40, 40, 0.2, 45, 6, 3, 10, "Fading and interference together: tune away from the jammers, then ride the fades."],
    ["Rush hour", 1500, 80, 40, 0.2, 55, 6, 4, 6, "High data volume in little time: push the rate up only while Eb/N0 stays above the cliff."],
    ["Thin battery", 3000, 40, 45, 0.3, 25, 6, 2, 6, "Power is limited by the battery, not only the regulations. Spend it where the channel is best."],
    ["Swarm", 1500, 60, 45, 0.2, 55, 6, 6, 4, "Six interferers drifting at once. The spectrum display is your map."],
    ["Mountain relay", 4500, 35, 45, 0.5, 70, 6, 3, 8, "Across hills: low frequency, careful power, patient rate."],
    ["Pulse storm", 2000, 70, 45, 0.3, 60, 6, 7, 8, "Pulsed jammers everywhere: transmit in the gaps, rest in the bursts."],
    ["Noise Baron's lair", 3000, 80, 50, 0.5, 80, 7, 8, 10, "Count Entropy's noise baron floods the band. Everything you have learnt, at once."],
    ["Clear sky", 3500, 100, 60, 0.5, 90, 6, 9, 12, "Final relay: deliver the full archive through the worst channel yet."]
  ];
  function jams(recipe, seed) {
    var r = rng(seed * 7919 + 13), out = [], k;
    for (k = 0; k < recipe; k++) out.push({ f0: FMIN + r() * (FMAX - FMIN), w: (0.08 + r() * 0.25) * 1e9, j: 30 + r() * 400, drift: k % 3 === 2 || recipe >= 5 ? (r() - 0.5) * 0.12e9 : 0,
      period: (recipe >= 4 && k % 2 === 1) ? 3 + r() * 4 : 0, duty: 0.55, phase: r() * 5 });
    return out;
  }
  /* Excess loss (walls, terrain, foliage, rain) is set so that, on a clean channel at 1 GHz with full power, the fastest
     rate that still gives Eb/N0 = 10.5 dB carries `slack` times the needed average rate. Later levels get less slack and a
     battery that cannot run the transmitter flat out for the whole time. */
  function calibrate(L, slack, bfac) {
    var need = L.msg / L.time * slack, rb = RATES[RATES.length - 1], k;
    for (k = 0; k < RATES.length; k++) if (RATES[k] >= need) { rb = RATES[k]; break; }
    var prNeed = undb(10.5) * KT0 * undb(L.nf) * rb;
    L.loss = Math.max(0, db(L.pmax * pathGain(L.d, 1e9) / prNeed));
    L.battery = Math.round(L.pmax / EFF * L.time * bfac * 10) / 10;
    return L;
  }
  var LEVELS = ROWS.map(function (w, i) {
    var u = i / (ROWS.length - 1);
    return calibrate({ id: i + 1, name: w[0], d: w[1], msg: w[2] * 1e6, time: w[3], pmax: w[4], nf: w[6], jams: jams(w[7], i + 1), fade: w[8], fadeT: 7 + (i % 4) * 2, teach: w[9] },
      2.6 - 1.1 * u, 1.5 - 0.65 * u);
  });
  function endlessLevel(k) { // the k-th message of the endless relay (k = 0, 1, 2 ...)
    var r = rng(9000 + k * 31);
    return calibrate({ id: 100 + k, name: "Relay " + (k + 1), d: 800 + Math.min(4200, k * 180) + r() * 400, msg: (30 + Math.min(70, k * 4)) * 1e6, time: 40, pmax: 0.5,
      nf: 6, jams: jams(Math.min(9, 1 + Math.floor(k / 2)), 500 + k), fade: Math.min(14, k * 0.8), fadeT: 7, teach: "Endless relay: each message is harder than the last." },
      Math.max(1.25, 2.4 - k * 0.06), Math.max(0.75, 1.4 - k * 0.03));
  }
  /* a fresh run on a level */
  function start(L) { return { L: L, t: 0, sent: 0, energy: 0, cfg: { pt: Math.min(0.05, L.pmax), f: 1.2e9, rb: 1e6 }, errs: 0, done: false, win: false, why: "" }; }
  function step(R, dt) {
    if (R.done) return R;
    var k = link(R.L, R.cfg, R.t), good = k.goodput * dt;
    R.sent += good; R.errs += (R.cfg.rb - k.goodput) * dt; R.energy += R.cfg.pt / EFF * dt; R.t += dt; R.last = k;
    if (R.sent >= R.L.msg) { R.done = true; R.win = true; R.why = "Message delivered."; }
    else if (R.energy >= R.L.battery) { R.done = true; R.why = "The battery ran flat."; }
    else if (R.t >= R.L.time) { R.done = true; R.why = "Time ran out with " + ((R.L.msg - R.sent) / 1e6).toFixed(1) + " Mb still to send."; }
    return R;
  }
  function stars(R) { if (!R.win) return 0; var s = 1; if (R.t <= R.L.time * 0.7) s++; if (R.energy <= R.L.battery * 0.6) s++; return s; }
  var PSTEPS = [], FSTEPS = [];
  (function () { var p; for (p = -10; p <= 27.01; p += 1) PSTEPS.push(undb(p) / 1000); var f; for (f = FMIN; f <= FMAX + 1; f += 0.05e9) FSTEPS.push(f); })();
  /* the reference "engineer": cheapest setting that keeps ahead of the schedule, else the fastest one */
  function best(R) {
    var L = R.L, need = Math.max(0, (L.msg - R.sent) / Math.max(0.5, L.time * 0.8 - R.t)) * 1.15, pick = null, top = null, i, j, k;
    for (i = 0; i < FSTEPS.length; i += 2) for (k = 0; k < RATES.length; k++) for (j = 0; j < PSTEPS.length; j++) {
      var pt = PSTEPS[j]; if (pt > L.pmax * 1.0001) break;
      var c = { pt: pt, f: FSTEPS[i], rb: RATES[k] }, g = link(L, c, R.t).goodput;
      if (!top || g > top.g) top = { c: c, g: g };
      if (g >= need) { if (!pick || pt < pick.c.pt) pick = { c: c, g: g }; break; }
    }
    return (pick || top).c;
  }
  function botRun(L, dt) {
    var R = start(L); dt = dt || 0.1; var acc = 0;
    while (!R.done) { if (acc <= 0) { R.cfg = best(R); acc = 0.5; } step(R, dt); acc -= dt; }
    return R;
  }
  var api = { C: C, KT0: KT0, PKT: PKT, RATES: RATES, FMIN: FMIN, FMAX: FMAX, EFF: EFF, erfc: erfc, db: db, undb: undb, dbm: dbm, pathGain: pathGain, ber: ber, noisePSD: noisePSD, jamAt: jamAt,
    fade: fade, link: link, LEVELS: LEVELS, endlessLevel: endlessLevel, start: start, step: step, stars: stars, best: best, botRun: botRun, PSTEPS: PSTEPS, FSTEPS: FSTEPS };
  root.SignalSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
