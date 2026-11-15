/* course-fx: communications — QAM constellation (qam), eye diagram (eye), OSI packet journey (osi),
   power-line OFDM (plc), time/frequency with aliasing (fft), Erlang B traffic (erlang). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;
  var R = FX.rng(12345);
  function gauss() { return FX.gauss(R); }

  /* =================================================================== qam */
  FX.define("qam", {
    aspect: 1.9, aspectSmall: 0.82,
    controls: [
      { key: "M", label: "Modulation", type: "select", value: 16, options: [[4, "QPSK"], [16, "16-QAM"], [64, "64-QAM"]] },
      { key: "snr", label: "SNR", min: 4, max: 34, step: 1, value: 20, unit: " dB" }
    ],
    init: function (f) { f.state.pts = []; f.state.acc = 0; f.state.err = 0; f.state.tot = 0; f.state.sym = []; },
    onChange: function (f) { f.state.pts = []; f.state.err = 0; f.state.tot = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var M = hero ? [4, 16, 64][Math.floor(f.t / 6) % 3] : (f.v.M || 16), snr = hero ? 24 : (f.v.snr || 20);
      if (hero && s.lastM !== M) { s.pts = []; s.lastM = M; }
      var k = Math.sqrt(M), lv = []; for (var i = 0; i < k; i++) lv.push(-(k - 1) + 2 * i);
      var Es = 2 * (M - 1) / 3, sigma = Math.sqrt(Es / (2 * Math.pow(10, snr / 10)));
      var add = f.reduce && !f.playing ? (s.pts.length ? 0 : 500) : Math.round((f.dt || 0) * 120);
      for (var a = 0; a < add; a++) {
        var si = Math.floor(R() * k), sq = Math.floor(R() * k);
        var ri = lv[si] + gauss() * sigma, rq = lv[sq] + gauss() * sigma;
        var di = Math.round((ri + k - 1) / 2), dq = Math.round((rq + k - 1) / 2);
        di = FX.clamp(di, 0, k - 1); dq = FX.clamp(dq, 0, k - 1);
        var e = di !== si || dq !== sq;
        s.pts.push([ri, rq, e, f.t]); s.tot++; if (e) s.err++;
        s.sym.push([lv[si], lv[sq]]); if (s.sym.length > 24) s.sym.shift();
      }
      if (s.pts.length > 700) s.pts.splice(0, s.pts.length - 700);
      f.clear();
      var small = f.w / f.h < 1.25;
      var size = hero ? Math.min(f.w, f.h) * 0.8 : (small ? Math.min(f.w - 40, f.h * 0.56) : Math.min(f.h - 40, f.w * 0.48));
      var cx = hero ? f.w / 2 : (small ? f.w / 2 : 20 + size / 2), cy = hero ? f.h / 2 : (small ? 16 + size / 2 : f.h / 2);
      var sc = size / 2 / (k + 0.2);
      var X = function (v) { return cx + v * sc; }, Y = function (v) { return cy - v * sc; };
      f.box(cx - size / 2, cy - size / 2, size, size, 10, c.panel, f.a(c.ink, 0.1), 1);
      f.seg(cx - size / 2, cy, cx + size / 2, cy, f.a(c.ink, 0.18), 1); f.seg(cx, cy - size / 2, cx, cy + size / 2, f.a(c.ink, 0.18), 1);
      // decision boundaries
      for (var b = 1; b < k; b++) { var bv = -(k - 1) + 2 * b - 1; f.seg(X(bv), cy - size / 2, X(bv), cy + size / 2, f.a(c.ink, 0.05), 1); f.seg(cx - size / 2, Y(bv), cx + size / 2, Y(bv), f.a(c.ink, 0.05), 1); }
      var spin = hero ? f.t * 0.15 : 0;
      s.pts.forEach(function (p) {
        var age = f.t - p[3], al = Math.max(0.12, 1 - age * 0.25);
        var x = p[0], y = p[1];
        if (spin) { var xr = x * cos(spin) - y * sin(spin), yr = x * sin(spin) + y * cos(spin); x = xr; y = yr; }
        f.ctx.globalAlpha = al; f.circle(X(x), Y(y), p[2] ? 2.2 : 1.6, p[2] ? c.d : c.c); f.ctx.globalAlpha = 1;
      });
      lv.forEach(function (i) { lv.forEach(function (q) {
        var x = i, y = q; if (spin) { var xr = x * cos(spin) - y * sin(spin), yr = x * sin(spin) + y * cos(spin); x = xr; y = yr; }
        f.circle(X(x), Y(y), M > 16 ? 2.6 : 4, c.b, null, 0, { glow: 10, glowColor: c.b });
      }); });
      f.text("I", cx + size / 2 - 10, cy - 10, { size: 11, color: c.dim }); f.text("Q", cx + 8, cy - size / 2 + 12, { size: 11, color: c.dim });
      if (hero) { f.text(M === 4 ? "QPSK" : M + "-QAM", cx - size / 2 + 10, cy - size / 2 + 16, { size: 12, mono: true, weight: 700, color: c.b }); return; }
      // right panel: I/Q and passband waveform for the last symbols
      var px0 = small ? 16 : cx + size / 2 + 24, py0 = small ? cy + size / 2 + 18 : 20, pw = small ? f.w - 32 : f.w - px0 - 16, ph = small ? f.h - py0 - 40 : f.h - 84;
      var bits = Math.log2(M);
      var ser = s.tot ? s.err / s.tot : 0;
      var ry = small ? f.h - 16 : f.h - 30;
      f.text(bits + " bits/symbol · symbol errors " + (ser * 100).toFixed(2) + " %", px0, ry, { size: 12, mono: true, color: ser > 0.01 ? c.d : c.a });
      if (ph < 60) return;
      var pl = f.plot(px0, py0, pw, ph, [0, 6], [-(k + 0.5), k + 0.5], { nx: 6, ny: 4, yl: "passband s(t) = I cos ωt − Q sin ωt", xl: "symbols" });
      var sym = s.sym.slice(-6);
      if (sym.length === 6) {
        f.curve(pl, function (u) { var j = Math.min(5, Math.floor(u)); return sym[j][0] * cos(TAU * 3 * u) - sym[j][1] * sin(TAU * 3 * u); }, 0, 6, 600, c.a, 1.8, { glow: 6 });
        for (var j = 0; j < 6; j++) { f.seg(pl.X(j), pl.y0, pl.X(j), pl.y0 + pl.h, f.a(c.ink, 0.1), 1); }
      }
    }
  });

  /* =================================================================== eye */
  FX.define("eye", {
    aspect: 1.9, aspectSmall: 0.9,
    controls: [
      { key: "bw", label: "Channel bandwidth", min: 0.25, max: 2, step: 0.05, value: 0.8, fmt: function (v) { return v.toFixed(2) + " × bit rate"; } },
      { key: "noise", label: "Noise", min: 0, max: 0.3, step: 0.01, value: 0.06, fmt: function (v) { return v.toFixed(2); } }
    ],
    init: function (f) { f.state.traces = []; f.state.acc = 0; },
    onChange: function (f) { f.state.traces = []; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var bw = hero ? 0.6 + 0.35 * sin(f.t * 0.3) : (f.v.bw || 0.8), noise = hero ? 0.05 : (f.v.noise == null ? 0.06 : f.v.noise);
      var tau = 1 / (TAU * bw);
      var make = function () {
        var bits = []; for (var i = 0; i < 9; i++) bits.push(R() > 0.5 ? 1 : -1);
        var N = 80, out = [];
        for (var n = 0; n <= N; n++) {
          var t = 6 + 2 * n / N, y = 0; // window covers bit periods 6..8 (bits 6 and 7 centred)
          for (var b = 0; b < 9; b++) {
            var t0 = t - b; if (t0 < 0) continue;
            var resp = t0 < 1 ? 1 - Math.exp(-t0 / tau) : (1 - Math.exp(-1 / tau)) * Math.exp(-(t0 - 1) / tau);
            y += bits[b] * resp;
          }
          y += -bits.slice(0, 9).reduce(function () { return 0; }, 0);
          out.push(y + gauss() * noise);
        }
        return out;
      };
      var add = f.reduce && !f.playing ? (s.traces.length ? 0 : 90) : Math.max(1, Math.round((f.dt || 0) * 40));
      for (var a = 0; a < add; a++) s.traces.push(make());
      if (s.traces.length > 110) s.traces.splice(0, s.traces.length - 110);
      f.clear();
      var pl = f.plot(18, 16, f.w - 36, f.h - 48, [0, 2], [-1.5, 1.5], { nx: 8, ny: 6, xl: "two bit periods", yl: "received signal" });
      f.ctx.save(); f.ctx.globalCompositeOperation = "lighter";
      s.traces.forEach(function (tr, i) {
        var pts = tr.map(function (y, n) { return [pl.X(2 * n / (tr.length - 1)), pl.Y(y)]; });
        f.line(pts, f.a(c.c, 0.08 + 0.12 * (i / s.traces.length)), 1.3);
      });
      f.ctx.restore();
      // eye opening at the sampling instants (t = 0.5, 1.5 bit periods => indices 20 and 60)
      var lo1 = 9, hi0 = -9;
      s.traces.forEach(function (tr) { var y = tr[60]; if (y > 0) lo1 = Math.min(lo1, y); else hi0 = Math.max(hi0, y); });
      var open = Math.max(0, lo1 - hi0) / 2;
      f.seg(pl.X(1.5), pl.Y(hi0), pl.X(1.5), pl.Y(lo1), open > 0.05 ? c.a : c.d, 2.4, { glow: 10 });
      f.seg(pl.X(1.5) - 6, pl.Y(hi0), pl.X(1.5) + 6, pl.Y(hi0), open > 0.05 ? c.a : c.d, 2);
      f.seg(pl.X(1.5) - 6, pl.Y(lo1), pl.X(1.5) + 6, pl.Y(lo1), open > 0.05 ? c.a : c.d, 2);
      f.text("sample here", pl.X(1.5), pl.y0 + pl.h - 12, { size: 10.5, align: "center", color: c.dim });
      f.text("eye opening " + Math.round(open * 100) + " %", pl.x0 + pl.w - 46, pl.y0 + 14, { size: 12, mono: true, align: "right", color: open > 0.3 ? c.a : open > 0.05 ? c.b : c.d, weight: 700 });
    }
  });

  /* =================================================================== osi */
  var LAYERS = [
    ["Application", "HTTP", "#ff7ab6"], ["Presentation", "TLS", "#c79bff"], ["Session", "sockets", "#8f9dff"],
    ["Transport", "TCP", "#5ec8ff"], ["Network", "IP", "#3dd68c"], ["Data link", "Ethernet", "#f6c445"], ["Physical", "bits", "#ff9a3c"]
  ];
  FX.define("osi", {
    aspect: 1.75, aspectSmall: 0.75,
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      f.clear();
      var small = f.w / f.h < 1.2;
      var n = LAYERS.length, top = 26, bottom = f.h - (small ? 46 : 40), lh = (bottom - top) / n;
      var colW = small ? f.w * 0.34 : Math.min(f.w * 0.26, 230), lx = 14, rx = f.w - 14 - colW;
      f.text("Sender", lx + colW / 2, 12, { size: 11, weight: 700, align: "center", color: c.dim });
      f.text("Receiver", rx + colW / 2, 12, { size: 11, weight: 700, align: "center", color: c.dim });
      var T = f.reduce ? 3.6 : f.t % 9, stepT = 0.5;
      // phase: down 0..3.5, across 3.5..5.5, up 5.5..9
      var downK = Math.min(n - 1, Math.floor(T / stepT)), upK = Math.max(0, n - 1 - Math.floor((T - 5.5) / stepT));
      LAYERS.forEach(function (L, i) {
        var y = top + i * lh;
        [lx, rx].forEach(function (x, side) {
          var active = side === 0 ? (T < 3.5 && i === downK) : (T >= 5.5 && i === upK);
          f.box(x, y + 2, colW, lh - 4, 8, f.a(L[2], active ? 0.28 : 0.08), f.a(L[2], active ? 0.9 : 0.35), 1.2, { glow: active ? 12 : 0, glowColor: L[2] });
          f.text((n - i) + "  " + L[0], x + 10, y + lh / 2, { size: small ? 10 : 11.5, weight: 650, color: c.ink });
          if (!small) f.text(L[1], x + colW - 10, y + lh / 2, { size: 10, mono: true, align: "right", color: f.a(L[2], 0.95) });
        });
        f.hit({ x: lx, y: y, w: colW, h: lh }, "Layer " + (n - i) + ": " + L[0], ["Applications exchange messages (web, e-mail).", "Encryption, encoding and compression.", "Opens, manages and closes the conversation.", "End-to-end delivery, ports, retransmission (TCP) or none (UDP).", "Addressing and routing between networks (IP).", "Frames on one link: MAC addresses, CRC (Ethernet, Wi-Fi).", "Bits as voltages, light or radio."][i]);
      });
      // the packet
      var midX = (lx + colW + rx) / 2, pw = Math.max(80, (rx - lx - colW) * 0.7);
      var headers, px, py;
      if (T < 3.5) { headers = Math.min(n - 1, downK + 0); px = lx + colW + 16 + pw / 2; py = top + downK * lh + lh / 2; }
      else if (T < 5.5) { headers = n - 1; var u = (T - 3.5) / 2; px = lx + colW + 16 + pw / 2 + u * (rx - lx - colW - 32 - pw); py = top + (n - 1) * lh + lh / 2; }
      else { headers = Math.max(0, upK); px = rx - 16 - pw / 2; py = top + upK * lh + lh / 2; }
      if (small) { px = midX; }
      var data = Math.max(30, pw * 0.34), hdrW = Math.min(16, (pw - data) / 6);
      var total = data + hdrW * headers, x0 = px - total / 2;
      if (T >= 3.5 && T < 5.5) {
        // bits on the wire
        var bitsY = py, r = FX.rng(Math.floor(f.t * 12));
        f.seg(lx + colW, bitsY + lh * 0.38, rx, bitsY + lh * 0.38, f.a(c.ink, 0.25), 2);
        for (var b = 0; b < 26; b++) {
          var bx = lx + colW + ((b / 26 + (T - 3.5) * 0.25) % 1) * (rx - lx - colW);
          f.text(r() > 0.5 ? "1" : "0", bx, bitsY + lh * 0.38 - 9, { size: 11, mono: true, color: "#ff9a3c", glow: 6 });
        }
      }
      for (var h = 0; h < headers; h++) {
        var L2 = LAYERS[headers - 1 - h];
        f.box(x0 + h * hdrW, py - lh * 0.28, hdrW - 1, lh * 0.56, 2, L2[2], null, 0, { glow: 6, glowColor: L2[2] });
      }
      f.box(x0 + headers * hdrW, py - lh * 0.28, data, lh * 0.56, 3, "#fff", null, 0, { glow: 10, glowColor: "#fff" });
      f.text("data", x0 + headers * hdrW + data / 2, py, { size: 10, weight: 700, align: "center", color: "#0b1712" });
      if (!hero) {
        var msg = T < 3.5 ? "Encapsulation: each layer adds its header" : T < 5.5 ? "Transmission: the frame crosses the link as bits" : "Decapsulation: each layer reads and removes its header";
        f.text(msg, f.w / 2, f.h - 14, { size: 11.5, align: "center", color: c.ink, weight: 600 });
      }
    }
  });

  /* =================================================================== plc */
  FX.define("plc", {
    aspect: 1.75, aspectSmall: 0.8,
    controls: [
      { key: "imp", label: "Impulsive noise", type: "toggle", value: false },
      { key: "tm", label: "Adaptive tone map", type: "toggle", value: true }
    ],
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero", t = f.reduce ? 0.4 : f.t;
      var imp = hero ? (Math.floor(t / 4) % 2 === 1) : !!f.v.imp, tm = hero ? true : f.v.tm !== false;
      f.clear();
      var small = f.w / f.h < 1.2;
      var h1 = (f.h - 44) * 0.46, h2 = (f.h - 44) * 0.54 - 10;
      // time domain: 2 cycles of 50 Hz with an OFDM burst riding on it
      var pl = f.plot(16, 16, f.w - 32, h1, [0, 40], [-1.35, 1.35], { nx: 8, ny: 4, xl: "ms", yl: "mains voltage + PLC signal" });
      var ofdm = function (ms) { var y = 0; for (var k = 0; k < 6; k++) y += sin(TAU * (ms * (2.4 + k * 0.37)) + k * 1.7 + t * (1 + k * 0.2)); return y / 6; };
      f.curve(pl, function (ms) { return sin(TAU * ms / 20 + t * 2); }, 0, 40, 200, f.a(c.ink, 0.5), 1.6);
      var burst = function (ms) { var b = imp ? Math.exp(-Math.pow(((ms + t * 7) % 10) - 5, 2) * 4) * 0.6 * sin(ms * 30) : 0; return b; };
      f.curve(pl, function (ms) { return sin(TAU * ms / 20 + t * 2) + 0.16 * ofdm(ms) + burst(ms); }, 0, 40, 900, c.b, 1.4, { glow: 6 });
      f.text("50 Hz mains", pl.x0 + 10, pl.y0 + pl.h - 12, { size: 10.5, color: c.dim });
      f.text("+ OFDM carrier (amplified for view)", pl.x0 + 90, pl.y0 + pl.h - 12, { size: 10.5, color: c.b });
      // spectrum
      var y2 = 16 + h1 + 26;
      var sp = f.plot(16, y2, f.w - 32, h2, [0, 150], [0, 1.1], { nx: 6, ny: 4, xl: "frequency (kHz)", yl: "subcarrier SNR" });
      var bands = [[3, 95, "CENELEC A (utilities)", c.a], [95, 125, "B", c.c], [125, 140, "C", "#c79bff"], [140, 148.5, "D", "#ff7ab6"]];
      bands.forEach(function (b) {
        f.ctx.save(); f.ctx.fillStyle = f.a(b[3], 0.07); f.ctx.fillRect(sp.X(b[0]), sp.y0, sp.X(b[1]) - sp.X(b[0]), sp.h); f.ctx.restore();
        f.text(b[2], (sp.X(b[0]) + sp.X(b[1])) / 2, sp.y0 + 12, { size: small && b[2].length > 3 ? 9 : 10, align: "center", color: f.a(b[3], 0.9) });
      });
      for (var kk = 0; kk <= 150; kk += 25) f.text(String(kk), sp.X(kk), sp.y0 + sp.h + 11, { size: 9.5, color: c.dim, align: "center" });
      var active = 0, thr = 0.32, bw = (sp.X(1.5625) - sp.X(0)) * 0.7;
      for (var i = 0; i < 36; i++) {
        var fk = 35.9 + i * 1.5625;
        var fade = 0.75 + 0.25 * sin(fk * 0.21 + t * 0.6) - 0.55 * Math.exp(-Math.pow((fk - (60 + 18 * sin(t * 0.25))) / 4, 2));
        if (imp) fade -= 0.35 * Math.abs(sin(fk * 0.9 + t * 9)) * (Math.floor(t * 3) % 2);
        fade = FX.clamp(fade, 0.05, 1);
        var on = !tm || fade > thr;
        if (on) active++;
        var col = on ? (fade > thr ? c.b : c.d) : f.a(c.ink, 0.2);
        f.box(sp.X(fk) - bw / 2, sp.Y(fade), bw, sp.Y(0) - sp.Y(fade), 1.5, col, null, 0, { glow: on ? 6 : 0, glowColor: col });
      }
      if (tm) f.seg(sp.X(35), sp.Y(thr), sp.X(92), sp.Y(thr), f.a(c.ink, 0.5), 1, { dash: [4, 4] });
      var rate = active * 1 / 0.64; // kb/s raw with DBPSK, 640 µs symbols
      f.text(active + "/36 carriers · raw ≈ " + rate.toFixed(0) + " kb/s", sp.x0 + sp.w - 46, sp.y0 + 30, { size: 11.5, mono: true, align: "right", color: c.ink });
    }
  });

  /* =================================================================== fft */
  FX.define("fft", {
    aspect: 1.75, aspectSmall: 0.8,
    controls: [
      { key: "h3", label: "3rd harmonic", min: 0, max: 1, step: 0.05, value: 0.35, fmt: function (v) { return v.toFixed(2); } },
      { key: "f2", label: "Extra tone", min: 0, max: 950, step: 10, value: 320, unit: " Hz" },
      { key: "nz", label: "Noise", min: 0, max: 0.6, step: 0.02, value: 0.1, fmt: function (v) { return v.toFixed(2); } }
    ],
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      var h3 = hero ? 0.3 + 0.25 * sin(f.t * 0.5) : (f.v.h3 == null ? 0.35 : f.v.h3);
      var f2 = hero ? 200 + 150 * sin(f.t * 0.23) : (f.v.f2 == null ? 320 : f.v.f2), nz = hero ? 0.08 : (f.v.nz == null ? 0.1 : f.v.nz);
      var fs = 1000, N = 128, ph = f.reduce ? 0 : f.t * 0.8;
      var rn = FX.rng(99);
      var x = [];
      for (var n = 0; n < N; n++) { var tt = n / fs; x.push(sin(TAU * 50 * tt + ph) + h3 * sin(TAU * 150 * tt + 3 * ph) + 0.6 * sin(TAU * f2 * tt + ph * 0.7) + nz * FX.gauss(rn)); }
      // DFT magnitude
      var mag = [];
      for (var k = 0; k <= N / 2; k++) { var re = 0, im = 0; for (var m = 0; m < N; m++) { var a = -TAU * k * m / N; re += x[m] * cos(a); im += x[m] * sin(a); } mag.push(2 * Math.hypot(re, im) / N); }
      f.clear();
      var h1 = (f.h - 40) * 0.44;
      var pl = f.plot(16, 16, f.w - 32, h1, [0, N / fs * 1000], [-2.4, 2.4], { nx: 8, ny: 4, xl: "time (ms)", yl: "x(t) and samples x[n]" });
      f.curve(pl, function (ms) { var tt = ms / 1000; return sin(TAU * 50 * tt + ph) + h3 * sin(TAU * 150 * tt + 3 * ph) + 0.6 * sin(TAU * f2 * tt + ph * 0.7); }, 0, N, 900, f.a(c.ink, 0.35), 1.2);
      var pts = x.map(function (v, i) { return [pl.X(i), pl.Y(v)]; });
      f.line(pts, c.c, 1.4, { glow: 6 });
      if (f.w > 500) x.forEach(function (v, i) { if (i % 2 === 0) f.circle(pl.X(i), pl.Y(v), 1.8, c.c); });
      var y2 = 16 + h1 + 24, h2 = f.h - y2 - 24;
      var sp = f.plot(16, y2, f.w - 32, h2, [0, fs / 2], [0, 1.2], { nx: 10, ny: 4, xl: "frequency (Hz)", yl: "|X[k]|" });
      var bw = Math.max(2, (sp.X(fs / N) - sp.X(0)) * 0.7);
      mag.forEach(function (mv, k) {
        var fr = k * fs / N, hgt = Math.min(1.2, mv);
        f.box(sp.X(fr) - bw / 2, sp.Y(hgt), bw, sp.Y(0) - sp.Y(hgt), 1, hgt > 0.2 ? c.a : f.a(c.a, 0.5), null, 0, { glow: hgt > 0.2 ? 8 : 0, glowColor: c.a });
      });
      for (var fr2 = 0; fr2 <= 500; fr2 += 100) f.text(String(fr2), sp.X(fr2), sp.y0 + sp.h + 11, { size: 9.5, color: c.dim, align: "center" });
      var alias = f2 > fs / 2 ? fs - f2 : f2;
      if (f2 > fs / 2) {
        f.text("aliased: " + Math.round(f2) + " Hz appears at " + Math.round(alias) + " Hz", sp.X(alias), sp.y0 + 28, { size: 11, color: c.d, weight: 700, align: alias > 300 ? "right" : "left" });
      }
      f.text("f_s = 1 kHz · N = " + N + " · Δf = " + (fs / N).toFixed(2) + " Hz", sp.x0 + sp.w - 46, sp.y0 + 12, { size: 11, mono: true, align: "right", color: c.ink });
    }
  });

  /* ================================================================ erlang */
  function erlangB(A, N) { var b = 1; for (var k = 1; k <= N; k++) b = A * b / (k + A * b); return b; }
  FX.erlangB = erlangB;
  FX.define("erlang", {
    aspect: 1.75, aspectSmall: 0.8,
    controls: [
      { key: "A", label: "Offered traffic", min: 1, max: 30, step: 0.5, value: 10, unit: " E" },
      { key: "N", label: "Channels", min: 1, max: 40, step: 1, value: 15 }
    ],
    init: function (f) { f.state.ch = []; f.state.next = 0; f.state.blocked = []; f.state.tot = 0; f.state.blk = 0; },
    onChange: function (f) { f.state.ch = []; f.state.tot = 0; f.state.blk = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var A = hero ? 10 : (f.v.A || 10), N = hero ? 14 : (f.v.N || 15);
      // simulation in "model time": mean holding = 1 unit, arrival rate = A per unit; 1 s real = 0.6 units
      var dt = (f.dt || 0) * 0.6, now = (s.now || 0) + dt; s.now = now;
      s.ch = s.ch.filter(function (e) { return e.end > now; });
      if (dt > 0) {
        while (s.next <= now) {
          s.tot++;
          if (s.ch.length < N) s.ch.push({ start: s.next, end: s.next - Math.log(R() || 1e-6), slot: firstFree(s.ch, N) });
          else { s.blk++; s.blocked.push({ at: f.t }); }
          s.next += -Math.log(R() || 1e-6) / A;
        }
      } else if (s.next === 0) s.next = now;
      s.blocked = s.blocked.filter(function (b) { return f.t - b.at < 1.2; });
      f.clear();
      var small = f.w / f.h < 1.2;
      // channel strip
      var sx = 16, sy = 18, sw = f.w - 32, cols = Math.min(N, small ? 10 : 20), rows = Math.ceil(N / cols), cw = sw / cols, chh = Math.min(26, (f.h * 0.3) / rows);
      for (var i = 0; i < N; i++) {
        var busy = s.ch.filter(function (e) { return e.slot === i; })[0], x = sx + (i % cols) * cw, y = sy + Math.floor(i / cols) * (chh + 6);
        var frac = busy ? FX.clamp((now - busy.start) / Math.max(0.01, busy.end - busy.start), 0, 1) : 0;
        f.box(x + 2, y, cw - 4, chh, 5, busy ? f.a(c.a, 0.25) : c.panel, busy ? c.a : f.a(c.ink, 0.2), 1.2, { glow: busy ? 8 : 0, glowColor: c.a });
        if (busy) f.box(x + 2, y + chh - 4, (cw - 4) * (1 - frac), 4, 2, c.a);
      }
      var stripH = rows * (chh + 6);
      f.text(s.ch.length + " of " + N + " channels busy", sx, sy + stripH + 10, { size: 11.5, mono: true, color: c.ink });
      if (s.blocked.length) f.text("call blocked!", sx + sw, sy + stripH + 10, { size: 11.5, weight: 800, align: "right", color: c.d, glow: 8 });
      if (hero) return;
      // B(A,N) curve
      var py = sy + stripH + 28, ph = f.h - py - 28;
      var Nmax = 40, pl = f.plot(36, py, f.w - 52, ph, [0, Nmax], [0, 1], { nx: 8, ny: 4, xl: "channels N", yl: "blocking probability" });
      f.curve(pl, function (n) { return erlangB(A, Math.round(n)); }, 1, Nmax, 39, c.b, 2.4, { glow: 8 });
      f.seg(pl.X(0), pl.Y(0.02), pl.X(Nmax), pl.Y(0.02), f.a(c.d, 0.7), 1, { dash: [5, 4] });
      f.text("2 % target", pl.X(Nmax) - 4, pl.Y(0.02) - 8, { size: 10, color: c.d, align: "right" });
      var B = erlangB(A, N);
      f.circle(pl.X(N), pl.Y(B), 6, "#fff", null, 0, { glow: 14, glowColor: c.b });
      for (var nn = 0; nn <= 40; nn += 10) f.text(String(nn), pl.X(nn), pl.y0 + pl.h + 11, { size: 9.5, color: c.dim, align: "center" });
      var meas = s.tot > 30 ? s.blk / s.tot : null;
      f.text("Erlang B: " + (B * 100).toFixed(2) + " %" + (meas != null ? "   simulated: " + (meas * 100).toFixed(1) + " %" : ""), pl.x0 + pl.w - 10, pl.y0 + 14, { size: 12, mono: true, align: "right", color: B < 0.02 ? c.a : c.d });
    }
  });
  function firstFree(ch, N) { var used = {}; ch.forEach(function (e) { used[e.slot] = 1; }); for (var i = 0; i < N; i++) if (!used[i]) return i; return 0; }
})();
