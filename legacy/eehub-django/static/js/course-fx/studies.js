/* course-fx: computing and general studies — a terminal running a program (code: basic | java), a processor's
   fetch–decode–execute cycle (cpu: cpu | mcu), markets, cash flows and ventures (economics: market | growth |
   venture), the scales of justice (law), a report being written (writing: report | speech), the heliocentric
   solar system (orbits), a waving flag (flag) and the water cycle (ecology). Hero visuals for the general and
   computing courses; every one also works as a figure. */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI, abs = Math.abs;
  function pad(f) { return f.small ? 12 : 20; }
  function fit(f, s, size, mono, weight, reserve) {
    var x = f.ctx, max = f.w - 2 * pad(f) - (reserve || 0);
    x.save(); x.font = (weight || 500) + " " + size + "px " + (mono ? f.c.mono : f.c.sans);
    var parts = s.split(" · "), out = s;
    while (x.measureText(out).width > max && parts.length > 1) { parts.pop(); out = parts.join(" · "); }
    while (x.measureText(out).width > max && out.length > 4) out = out.slice(0, -2).replace(/\s+$/, "") + "…";
    x.restore(); return out;
  }
  function caption(f, s, col) {
    var size = f.small ? 10.5 : 12, hero = f.mode === "hero";
    if (hero) f.text(fit(f, s, size, true, 500, f.small ? 150 : 190), f.w - pad(f), f.h - pad(f) + 2, { size: size, mono: true, color: col || f.c.dim, align: "right" });
    else f.text(fit(f, s, size, true), pad(f), f.h - pad(f) + 2, { size: size, mono: true, color: col || f.c.dim });
  }
  function title(f, s, col) { var size = f.small ? 11.5 : 13.5; f.text(fit(f, s, size, false, 700, f.mode === "hero" ? 44 : 0), pad(f), pad(f) - 2, { size: size, weight: 700, color: col || f.c.ink }); }
  function phase(f, per) { return f.reduce ? 0.5 : (f.t % per) / per; }

  /* ================================================================== code */
  var PROGRAMS = {
    basic: { file: "AVERAGE.BAS", lang: "BASIC", lines: [
      "10 REM average of N marks", "20 INPUT \"How many marks\"; N", "30 LET S = 0", "40 FOR I = 1 TO N", "50   INPUT M", "60   LET S = S + M", "70 NEXT I",
      "80 PRINT \"Average =\"; S / N", "90 END"], out: ["RUN", "How many marks? 4", "? 68", "? 74", "? 81", "? 59", "Average = 70.5", "Ok"] },
    java: { file: "Average.java", lang: "Java", lines: [
      "import java.util.Scanner;", "", "public class Average {", "  public static void main(String[] args) {", "    Scanner in = new Scanner(System.in);", "    int n = in.nextInt(); double sum = 0;",
      "    for (int i = 0; i < n; i++) {", "      sum += in.nextDouble();", "    }", "    System.out.printf(\"Average = %.1f%n\", sum / n);", "  }", "}"],
      out: ["$ javac Average.java", "$ java Average", "4 68 74 81 59", "Average = 70.5", "$ _"] }
  };
  var KW = /\b(REM|INPUT|LET|FOR|TO|NEXT|PRINT|END|import|public|class|static|void|int|double|for|new|return)\b/;
  FX.define("code", {
    aspect: 1.7, aspectSmall: 0.95, still: 30,
    draw: function (f) {
      var c = f.c, t = f.t, P = PROGRAMS[f.opts.variant] || PROGRAMS.java, per = 22, u = phase(f, per);
      var chars = P.lines.join("\n").length, typed = Math.floor(FX.clamp(u / 0.55, 0, 1) * chars), outN = Math.floor(FX.clamp((u - 0.6) / 0.35, 0, 1) * (P.out.length + 1));
      f.clear();
      var ew = f.small ? f.w - 2 * pad(f) : f.w * 0.58, ex = pad(f), ey = pad(f), eh = f.small ? f.h * 0.56 : f.h - 2 * pad(f);
      f.box(ex, ey, ew, eh, 10, "rgba(0,0,0,.35)", f.a(c.ink, 0.18), 1);
      f.box(ex, ey, ew, 26, 10, f.a(c.ink, 0.06), null); f.circle(ex + 14, ey + 13, 4, "#ff5f56"); f.circle(ex + 28, ey + 13, 4, "#ffbd2e"); f.circle(ex + 42, ey + 13, 4, "#27c93f");
      f.text(P.file, ex + ew / 2, ey + 13, { size: 11, mono: true, align: "center", color: c.dim });
      var fs = f.small ? 10 : 12, lh = fs * 1.55, y = ey + 40, n = 0, x0 = ex + 14;
      f.ctx.save(); f.rr(ex, ey + 26, ew, eh - 26, 0); f.ctx.clip();
      P.lines.forEach(function (line, li) {
        var shown = line.slice(0, Math.max(0, typed - n)); n += line.length + 1;
        f.text(String(li + 1).padStart(2, " "), x0, y, { size: fs, mono: true, color: f.a(c.ink, 0.3) });
        var x = x0 + fs * 2.2, parts = shown.split(/(\s+|[(){};,=+*/<]|"[^"]*")/).filter(Boolean);
        f.ctx.font = "500 " + fs + "px " + c.mono;
        parts.forEach(function (p) { var col = KW.test(p) ? c.c : /^"/.test(p) ? c.b : /^\d/.test(p) ? c.d : /^(REM|\/\/)/.test(p) ? c.dim : c.ink; if (/REM/.test(line) && li === 0) col = c.a; f.text(p, x, y, { size: fs, mono: true, color: col }); f.ctx.font = "500 " + fs + "px " + c.mono; x += f.ctx.measureText(p).width; });
        if (typed - (n - line.length - 1) >= 0 && typed - (n - line.length - 1) < line.length + 1 && typed < chars) f.box(x + 1, y - fs * 0.6, fs * 0.55, fs * 1.2, 1, f.a(c.a, 0.5 + 0.5 * sin(t * 8)));
        y += lh;
      });
      f.ctx.restore();
      // console
      var cx = f.small ? ex : ex + ew + 14, cy = f.small ? ey + eh + 12 : ey, cw = f.small ? ew : f.w - cx - pad(f), ch = f.small ? f.h - cy - pad(f) : eh;
      f.box(cx, cy, cw, ch, 10, "#02110c", f.a(c.a, 0.3), 1);
      f.text(P.lang === "BASIC" ? "BASIC interpreter" : "terminal", cx + 10, cy + 13, { size: 10, mono: true, color: c.dim });
      var oy = cy + 34;
      P.out.slice(0, outN).forEach(function (line, i) { var isIn = /^\?|^\$|^RUN/.test(line), last = i === outN - 1; f.text(line, cx + 12, oy + i * (fs * 1.6), { size: fs, mono: true, color: /Average/.test(line) ? c.b : isIn ? c.a : c.ink, glow: /Average/.test(line) ? 8 : 0, weight: /Average/.test(line) ? 700 : 500 }); });
      if (outN < P.out.length && u > 0.6) f.box(cx + 12, oy + outN * (fs * 1.6) - fs * 0.6, fs * 0.55, fs * 1.2, 1, f.a(c.a, 0.5 + 0.5 * sin(t * 8)));
      if (!f.small) f.text(P.lang === "BASIC" ? "INPUT · LET · FOR…NEXT · PRINT" : "class · main · Scanner · for · printf", cx + 10, cy + ch - 14, { size: 10.5, color: c.dim });
    }
  });

  /* =================================================================== cpu */
  var PROG = [["LOAD A, [x]", "read x from memory"], ["LOAD B, [y]", "read y from memory"], ["ADD A, B", "A ← A + B"], ["STORE [z], A", "write z to memory"], ["JMP 0", "repeat"]];
  FX.define("cpu", {
    aspect: 1.7, aspectSmall: 1, still: 1.2,
    draw: function (f) {
      var c = f.c, t = f.t, mcu = f.opts.variant === "mcu", per = 1.8, step = f.reduce ? 2 : Math.floor(t / per) % PROG.length, u = (t % per) / per, ph = u < 0.33 ? 0 : u < 0.66 ? 1 : 2;
      f.clear();
      var W = f.w - 2 * pad(f), H = f.h - 2 * pad(f) - 20, x0 = pad(f), y0 = pad(f) + 16;
      var cpuW = f.small ? W : W * 0.5, cpuH = f.small ? H * 0.55 : H, memX = x0 + cpuW + 24, memW = W - cpuW - 24;
      f.box(x0, y0, cpuW, cpuH, 14, c.panel, f.a(c.a, 0.45), 1.5, { glow: 10, glowColor: c.a });
      f.text(mcu ? "microcontroller" : "CPU", x0 + 12, y0 + 14, { size: 11.5, weight: 800, color: c.a });
      // blocks inside: control unit, ALU, registers, (mcu: flash, GPIO)
      var bw = cpuW * 0.42, bh = cpuH * 0.26, gap = cpuW * 0.06;
      var blocks = [["control unit", x0 + gap, y0 + 30, ph === 1 ? c.b : null], ["ALU", x0 + cpuW - gap - bw, y0 + 30, ph === 2 && step < 3 ? c.b : null],
        ["registers A B PC IR", x0 + gap, y0 + 40 + bh, ph === 2 ? c.b : null], [mcu ? "flash + SRAM" : "cache", x0 + cpuW - gap - bw, y0 + 40 + bh, ph === 0 ? c.b : null]];
      blocks.forEach(function (b) { f.box(b[1], b[2], bw, bh, 8, b[3] ? f.a(b[3], 0.18) : f.a(c.ink, 0.04), b[3] ? b[3] : f.a(c.ink, 0.18), 1.2, { glow: b[3] ? 10 : 0 }); f.text(b[0], b[1] + bw / 2, b[2] + bh / 2, { size: f.small ? 9.5 : 11, align: "center", color: b[3] ? c.ink : c.dim, weight: b[3] ? 700 : 500 }); });
      // register values
      var vals = { A: step >= 1 ? (step >= 3 ? 12 : 5) : 0, B: step >= 2 ? 7 : 0, PC: step, IR: PROG[step][0].split(" ")[0] };
      var ry = y0 + 50 + 2 * bh + 6; ["A", "B", "PC", "IR"].forEach(function (r, i) { f.text(r + " = " + vals[r], x0 + gap + i * (bw * 0.5), ry, { size: f.small ? 9.5 : 11, mono: true, color: r === "A" && step === 2 && ph === 2 ? c.b : c.ink }); });
      if (mcu) { var gy = y0 + cpuH - 16; for (var g = 0; g < 8; g++) f.circle(x0 + cpuW - gap - 8 - g * 14, gy, 4, (step + g) % 3 === 0 ? c.a : f.a(c.ink, 0.25), null, 0, { glow: (step + g) % 3 === 0 ? 8 : 0 }); f.text("GPIO", x0 + cpuW - gap - 8 - 8 * 14 - 6, gy, { size: 9.5, color: c.dim, align: "right" }); }
      // bus and memory
      if (!f.small) {
        var busY = y0 + cpuH * 0.5; f.seg(x0 + cpuW, busY - 8, memX, busY - 8, f.a(c.ink, 0.35), 3); f.seg(x0 + cpuW, busY + 8, memX, busY + 8, f.a(c.ink, 0.35), 3);
        f.text("address bus", (x0 + cpuW + memX) / 2, busY - 18, { size: 9.5, align: "center", color: c.dim }); f.text("data bus", (x0 + cpuW + memX) / 2, busY + 20, { size: 9.5, align: "center", color: c.dim });
        if (ph !== 1) { var dir = (ph === 0 || step !== 3) ? -1 : 1, bu = (u * 3) % 1, bxp = dir < 0 ? memX - bu * (memX - x0 - cpuW) : x0 + cpuW + bu * (memX - x0 - cpuW); f.circle(bxp, busY + 8, 4, c.b, null, 0, { glow: 10 }); f.circle(memX - ((u * 3) % 1) * (memX - x0 - cpuW) * (ph === 0 ? 1 : 0.0001), busY - 8, 3, c.c, null, 0, { glow: 8 }); }
        f.box(memX, y0, memW, cpuH, 14, c.panel, f.a(c.ink, 0.2), 1.2); f.text("memory", memX + 12, y0 + 14, { size: 11.5, weight: 800, color: c.ink });
        var cellH = Math.min(26, (cpuH - 40) / (PROG.length + 3));
        PROG.forEach(function (p, i) { var yy = y0 + 32 + i * cellH, on = i === step; f.box(memX + 8, yy, memW - 16, cellH - 4, 5, on ? f.a(c.b, 0.2) : f.a(c.ink, 0.04), on ? c.b : f.a(c.ink, 0.12), 1); f.text(String(i).padStart(2, "0"), memX + 16, yy + cellH / 2 - 2, { size: 10, mono: true, color: c.dim }); f.text(p[0], memX + 40, yy + cellH / 2 - 2, { size: 10.5, mono: true, color: on ? c.ink : c.dim, weight: on ? 700 : 500 }); });
        [["x", 5], ["y", 7], ["z", step >= 3 ? 12 : "?"]].forEach(function (d, i) { var yy = y0 + 32 + (PROG.length + i) * cellH; f.text(d[0] + " = " + d[1], memX + 16, yy + cellH / 2 - 2, { size: 10.5, mono: true, color: d[0] === "z" && step === 3 && ph === 2 ? c.b : c.dim }); });
      }
      var PH = ["fetch", "decode", "execute"];
      f.text(PH[ph] + " · " + PROG[step][0] + " — " + PROG[step][1], x0, f.h - pad(f) + 2, { size: f.small ? 10.5 : 12, mono: true, color: c.b });
      title(f, mcu ? "Microcontroller · fetch, decode, execute" : "Computer architecture · the instruction cycle");
    }
  });

  /* ============================================================= economics */
  FX.define("economics", {
    aspect: 1.7, aspectSmall: 1, still: 2.5,
    draw: function (f) {
      var c = f.c, t = f.t, v = f.opts.variant || "market", per = 12, u = phase(f, per);
      f.clear();
      if (v === "growth") {
        // development: GDP per head, electricity access and life expectancy move together
        var pl = f.plot(pad(f), pad(f) + 18, f.w - 2 * pad(f), f.h - 2 * pad(f) - 30, [1990, 2030], [0, 100], { nx: 8, ny: 5, xl: "year", yl: "index" });
        var yr = 1990 + 40 * FX.clamp(u * 1.15, 0, 1), series = [["electricity access %", function (y) { return 35 + 40 / (1 + Math.exp(-(y - 2012) / 7)); }, c.b], ["GDP per head (index)", function (y) { return 20 + 55 * Math.pow((y - 1990) / 40, 1.6) + 4 * sin((y - 1990) * 0.9); }, c.a], ["life expectancy (index)", function (y) { return 45 + 30 * (y - 1990) / 40; }, c.c]];
        series.forEach(function (s, i) { f.curve(pl, s[1], 1990, 2030, 80, f.a(s[2], 0.25), 1.2, { dash: [3, 3] }); f.curve(pl, s[1], 1990, yr, 80, s[2], 2.4, { glow: 8 }); f.circle(pl.X(yr), pl.Y(s[1](yr)), 4, "#fff", null, 0, { glow: 10, glowColor: s[2] }); f.text(s[0], pl.x0 + 10, pl.y0 + 30 + i * 16, { size: 10.5, color: s[2] }); });
        f.text(Math.round(yr).toString(), Math.min(pl.X(yr), pl.x0 + pl.w - 24), pl.y0 + pl.h - 12, { size: 11, mono: true, color: c.ink, align: "center" });
        title(f, "Development economics · growth, energy and welfare");
        caption(f, "infrastructure, especially electricity, moves with income and health");
        return;
      }
      if (v === "venture") {
        // entrepreneurship: the J-curve of a venture with milestones
        var pl2 = f.plot(pad(f), pad(f) + 18, f.w - 2 * pad(f), f.h - 2 * pad(f) - 30, [0, 36], [-40, 160], { nx: 6, ny: 5, xl: "months", yl: "cash (₦ m)" });
        var cash = function (m) { return -30 * (1 - Math.exp(-m / 6)) * Math.exp(-Math.max(0, m - 12) / 7) + 170 / (1 + Math.exp(-(m - 22) / 4)) - 10; };
        var mo = 36 * FX.clamp(u * 1.1, 0, 1);
        f.curve(pl2, cash, 0, 36, 120, f.a(c.ink, 0.2), 1.2, { dash: [3, 3] }); f.curve(pl2, cash, 0, mo, 120, c.a, 2.6, { glow: 10 });
        var ms = [[2, "idea & customer discovery"], [7, "prototype (MVP)"], [12, "first paying customers"], [18, "break-even"], [26, "scale"]];
        ms.forEach(function (m, i) { var on = m[0] <= mo; if (on) f.circle(pl2.X(m[0]), pl2.Y(cash(m[0])), 4.5, c.b, null, 0, { glow: 12 }); if (!f.small || on) f.text((on ? "● " : "○ ") + m[1], pl2.x0 + 12, pl2.y0 + 30 + i * 15, { size: 10.5, color: on ? c.b : f.a(c.ink, 0.35) }); });
        f.ctx.save(); f.ctx.fillStyle = f.a(c.d, 0.08); f.ctx.fillRect(pl2.x0, pl2.Y(0), pl2.w, pl2.y0 + pl2.h - pl2.Y(0)); f.ctx.restore();
        f.text("valley of death", pl2.X(8), pl2.Y(-30), { size: 10.5, color: c.d });
        f.circle(pl2.X(mo), pl2.Y(cash(mo)), 5, "#fff", null, 0, { glow: 14, glowColor: c.a });
        title(f, "Entrepreneurship · from idea to a business that pays");
        caption(f, "problem → solution → customers → revenue");
        return;
      }
      // engineering economics: a cash-flow diagram and the NPV at a sweeping discount rate
      var pw = f.small ? f.w - 2 * pad(f) : f.w * 0.52, pl3 = f.plot(pad(f), pad(f) + 18, pw, f.small ? f.h * 0.42 : f.h - 2 * pad(f) - 30, [-0.5, 8.5], [-120, 60], { nx: 9, ny: 3, xl: "year", yl: "₦ m" });
      var flows = [-100, 22, 26, 30, 30, 30, 28, 26, 24], rate = 0.02 + 0.22 * (0.5 - 0.5 * cos(u * TAU)), npv = 0;
      flows.forEach(function (cf, yr2) { npv += cf / Math.pow(1 + rate, yr2); var x = pl3.X(yr2), y0 = pl3.Y(0), y1 = pl3.Y(cf), col = cf < 0 ? c.d : c.a; f.arrow(x, y0, x, y1, col, 2.2, { glow: 6 }); f.text((cf > 0 ? "+" : "") + cf, x, y1 + (cf < 0 ? 12 : -12), { size: 9.5, mono: true, color: col, align: "center" }); var pv = cf / Math.pow(1 + rate, yr2); if (yr2) f.box(x - 5, pl3.Y(pv), 10, pl3.Y(0) - pl3.Y(pv), 2, f.a(c.b, 0.45)); });
      if (!f.small) f.text("present value of each flow (gold) at i = " + (rate * 100).toFixed(0) + " %", pl3.x0 + 44, pl3.y0 + 12, { size: 10.5, color: c.b });
      var tx = f.small ? pad(f) : Math.min(pad(f) + pw + 20, f.w - pad(f) - 225), ty = f.small ? pl3.y0 + pl3.h + 28 : pad(f) + 40;
      f.text("NPV = Σ CFₜ / (1+i)ᵗ", tx, ty, { size: f.small ? 11 : 13, mono: true, color: c.ink });
      f.text("NPV = ₦ " + npv.toFixed(1) + " m", tx, ty + 26, { size: f.small ? 13 : 18, weight: 800, mono: true, color: npv >= 0 ? c.a : c.d, glow: 8 });
      f.text(npv >= 0 ? "accept: it earns more than " + (rate * 100).toFixed(0) + " %" : "reject: it earns less than " + (rate * 100).toFixed(0) + " %", tx, ty + 50, { size: 11, color: c.dim });
      if (!f.small) {
        var irr = 0.2; for (var it = 0; it < 40; it++) { var s2 = 0; flows.forEach(function (cf, yr3) { s2 += cf / Math.pow(1 + irr, yr3); }); irr += s2 > 0 ? 0.01 : -0.01; }
        f.text("IRR ≈ " + (irr * 100).toFixed(0) + " %   payback ≈ 4 years", tx, ty + 78, { size: 11.5, mono: true, color: c.c });
        f.text("inflation and tax change the flows", tx, ty + 100, { size: 11, color: c.dim });
        f.text("compare options on the same basis", tx, ty + 118, { size: 11, color: c.dim });
      }
      title(f, "Engineering economics · time value of money");
    }
  });

  /* =================================================================== law */
  var CASES = [["duty of care", "negligence", -1], ["signed contract", "breach", 1], ["safety code met", "liability", -1], ["patent filed", "infringement", 1], ["expert evidence", "claim", 0]];
  FX.define("law", {
    aspect: 1.7, aspectSmall: 1, still: 2,
    draw: function (f) {
      var c = f.c, t = f.t, per = 5, k = f.reduce ? 0 : Math.floor(t / per) % CASES.length, u = (t % per) / per, cs = CASES[k];
      var tilt = cs[2] * 0.14 * FX.ease(FX.clamp((u - 0.15) / 0.5, 0, 1)) + 0.012 * sin(t * 2);
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.34), top = pad(f) + 20, H = f.h - top - pad(f) - 52, beam = Math.min(f.w * 0.3, H * 0.9);
      // pillar and base
      f.box(cx - 5, top + 10, 10, H, 3, c.dim); f.box(cx - beam * 0.4, top + H + 4, beam * 0.8, 10, 4, c.dim);
      f.circle(cx, top + 10, 8, c.b, null, 0, { glow: 12 });
      // beam
      f.ctx.save(); f.ctx.translate(cx, top + 10); f.ctx.rotate(tilt);
      f.seg(-beam / 2, 0, beam / 2, 0, c.b, 4);
      [-1, 1].forEach(function (s) {
        var px = s * beam / 2, chain = H * 0.42, dishR = beam * 0.22;
        f.circle(px, 0, 3, c.b);
        f.ctx.save(); f.ctx.translate(px, 0); f.ctx.rotate(-tilt);
        f.seg(0, 0, -dishR * 0.8, chain, f.a(c.ink, 0.5), 1); f.seg(0, 0, dishR * 0.8, chain, f.a(c.ink, 0.5), 1);
        f.ctx.beginPath(); f.ctx.ellipse(0, chain, dishR, dishR * 0.28, 0, 0, PI); f.ctx.fillStyle = f.a(c.b, 0.25); f.ctx.fill(); f.ctx.strokeStyle = c.b; f.ctx.lineWidth = 2; f.ctx.stroke();
        f.text(s < 0 ? cs[0] : cs[1], 0, chain - 14, { size: f.small ? 10 : 11.5, weight: 700, align: "center", color: c.ink });
        f.ctx.restore();
      });
      f.ctx.restore();
      f.text(["the evidence outweighs the claim", "the obligation stands", "balanced: a matter for the court"][cs[2] < 0 ? 0 : cs[2] > 0 ? 1 : 2], cx, top + H + 30, { size: 11, align: "center", color: c.dim });
      if (!f.small) {
        var tx = Math.min(f.w * 0.66, f.w - pad(f) - 235), ty = f.h * 0.24;
        f.text("what an engineer must know", tx, ty, { size: 13, weight: 700 });
        ["contracts: offer and acceptance", "tort: duty of care, negligence", "liability and COREN registration", "patents and copyright", "health, safety, environment", "arbitration before litigation"].forEach(function (s, i) { var on = i === k % 6; f.circle(tx + 4, ty + 26 + i * 22, 3, on ? c.b : f.a(c.ink, 0.3)); f.text(s, tx + 16, ty + 26 + i * 22, { size: 11.5, color: on ? c.ink : c.dim, weight: on ? 700 : 500 }); });
      }
      title(f, "Law for engineers");
      caption(f, "a signed drawing is a promise the law can hold you to");
    }
  });

  /* =============================================================== writing */
  var DOC = { report: { title: "Design of a 33/11 kV substation feeder", parts: ["Abstract", "1 Introduction", "2 Method", "3 Results", "4 Discussion", "5 Conclusion", "References"], tip: "say it once, clearly, in the right section" },
    speech: { title: "English and communication skills", parts: ["Audience", "Purpose", "Structure", "Clarity", "Tone", "Delivery", "Feedback"], tip: "short sentences, active voice, one idea each" } };
  FX.define("writing", {
    aspect: 1.7, aspectSmall: 1, still: 14,
    draw: function (f) {
      var c = f.c, t = f.t, D = DOC[f.opts.variant] || DOC.report, speech = f.opts.variant === "speech", per = 20, u = phase(f, per);
      f.clear();
      var pw = f.small ? f.w - 2 * pad(f) : Math.min(f.w * 0.44, (f.h - 2 * pad(f) - 20) * 0.78), px = f.small ? pad(f) : f.w * 0.06, py = pad(f) + 16, ph = f.small ? f.h * 0.56 : f.h - 2 * pad(f) - 26;
      f.box(px, py, pw, ph, 6, "#f6f3ea", null, 0, { glow: 14, glowColor: "rgba(0,0,0,.4)" });
      var inner = px + pw * 0.08, lineW = pw * 0.84, y = py + Math.max(14, ph * 0.07), lines = 0, total = D.parts.length * 4 + 1, shown = Math.floor(u * 1.1 * total);
      var dh = Math.max(13, ph * 0.045), db = Math.max(7, ph * 0.028);
      f.text(D.title, inner, y, { size: Math.max(9, pw * 0.032), weight: 800, color: "#1b2a24" }); y += Math.max(18, ph * 0.065); lines++;
      var r = FX.rng(7);
      D.parts.forEach(function (p, i) {
        if (lines >= shown) return;
        f.text(p, inner, y, { size: Math.max(8, pw * 0.026), weight: 700, color: "#14532d" }); y += dh; lines++;
        for (var k = 0; k < 3 && lines < shown; k++) { var wdt = lineW * (0.7 + r() * 0.3); f.box(inner, y - 1.5, wdt, 3, 1.5, "rgba(27,42,36,.22)"); y += db; lines++; }
        if (i === 2 && lines < shown && !speech) { f.box(inner + lineW * 0.25, y, lineW * 0.5, ph * 0.1, 3, "rgba(61,214,140,.18)", "rgba(20,83,45,.5)", 1); var pts = []; for (var q = 0; q <= 20; q++) pts.push([inner + lineW * 0.27 + q / 20 * lineW * 0.46, y + ph * 0.085 - ph * 0.06 * (0.3 + 0.6 * Math.pow(q / 20, 0.7))]); f.line(pts, "#14532d", 1.3); f.text("Figure 3.1", inner + lineW * 0.5, y + ph * 0.1 + 7, { size: Math.max(7, pw * 0.02), align: "center", color: "#4b5a52" }); y += ph * 0.125; }
        y += ph * 0.012;
      });
      if (shown < total) f.box(inner, y - 1.5, lineW * 0.3 * ((t * 2) % 1), 3, 1.5, "rgba(20,83,45,.6)");
      var tx = f.small ? pad(f) : px + pw + 32, ty = f.small ? py + ph + 24 : pad(f) + 30;
      if (speech) {
        // a waveform of speech beside the page
        var ww = f.small ? f.w - 2 * pad(f) : f.w - tx - pad(f), wy = f.small ? f.h - pad(f) - 34 : f.h - pad(f) - 46, pts2 = []; for (var q2 = 0; q2 <= 100; q2++) { var xx = q2 / 100, env = Math.exp(-Math.pow((xx - ((t * 0.3) % 1)) / 0.12, 2)); pts2.push([tx + xx * ww, wy - sin(xx * 60 + t * 20) * 18 * env - sin(xx * 23 - t * 9) * 6 * env]); } f.line(pts2, c.b, 2, { glow: 8 });
        if (!f.small) f.text("speak · listen · write · present", tx, wy + 26, { size: 11.5, color: c.dim });
      }
      if (!f.small || !speech) f.text(speech ? "seven habits of clear communication" : "the structure of a technical report", tx, ty, { size: f.small ? 11 : 13, weight: 700 });
      if (!f.small) D.parts.forEach(function (p, i) { var on = Math.floor(u * 1.1 * total) > i * 4 + 1; f.text(p, tx, ty + 22 + i * (speech ? 16 : 19), { size: 11.5, color: on ? c.ink : f.a(c.ink, 0.35) }); if (on && i === D.parts.length - 1) f.text(" ✓", tx + 90, ty + 22 + i * (speech ? 16 : 19), { size: 12, color: c.a }); });
      caption(f, D.tip);
      title(f, speech ? "Communication skills" : "Technical writing and presentation");
    }
  });

  /* ================================================================ orbits */
  var PLANETS = [["Mercury", 0.39, 0.24, c0("#b8b8b8"), 2.2], ["Venus", 0.72, 0.62, c0("#e8c37a"), 3.2], ["Earth", 1, 1, c0("#5ec8ff"), 3.4], ["Mars", 1.52, 1.88, c0("#ff7a5b"), 2.8], ["Jupiter", 2.6, 11.9, c0("#f6c445"), 6], ["Saturn", 3.3, 29.5, c0("#e9d8a6"), 5.2]];
  function c0(x) { return x; }
  var ERA = [["Aristotle · Ptolemy", "the Earth at the centre, epicycles"], ["Copernicus 1543", "the Sun at the centre"], ["Kepler 1609", "ellipses · equal areas · T² ∝ a³"], ["Galileo 1610", "moons of Jupiter seen by telescope"], ["Newton 1687", "one law of gravity for apple and Moon"]];
  FX.define("orbits", {
    aspect: 1.7, aspectSmall: 1, still: 5,
    draw: function (f) {
      var c = f.c, t = f.t, per = 5, k = f.reduce ? 4 : Math.floor(t / per) % ERA.length, u = (t % per) / per, fade = Math.min(1, u * 5, (1 - u) * 5);
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.36), cy = f.h * 0.52, S = Math.min(f.w * 0.2, f.h * 0.42) / 3.4;
      f.circle(cx, cy, 9, c.b, null, 0, { glow: 30 });
      PLANETS.forEach(function (p) {
        var a = p[1] * S, e = p[0] === "Mercury" ? 0.2 : 0.06, b = a * Math.sqrt(1 - e * e);
        f.ctx.save(); f.ctx.beginPath(); f.ctx.ellipse(cx - a * e, cy, a, b, 0, 0, TAU); f.ctx.strokeStyle = f.a(c.ink, 0.14); f.ctx.lineWidth = 1; f.ctx.stroke(); f.ctx.restore();
        var th = t * TAU / (p[2] * 6) + p[1] * 3; th = th + e * sin(th) * 1.4; // crude equal-area speeding near perihelion
        var x = cx - a * e + cos(th) * a, y = cy + sin(th) * b;
        f.circle(x, y, p[4], p[3], null, 0, { glow: 8 });
        if (p[0] === "Saturn") { f.ctx.save(); f.ctx.beginPath(); f.ctx.ellipse(x, y, p[4] * 2, p[4] * 0.6, 0.3, 0, TAU); f.ctx.strokeStyle = f.a(p[3], 0.8); f.ctx.lineWidth = 1.2; f.ctx.stroke(); f.ctx.restore(); }
        if (p[0] === "Earth") { var mt = t * 2.4; f.circle(x + cos(mt) * 9, y + sin(mt) * 9, 1.5, c.ink); }
        if (p[0] === "Jupiter") for (var m = 0; m < 4; m++) f.circle(x + cos(t * (2 + m) + m) * (9 + m * 3), y + sin(t * (2 + m) + m) * (3 + m), 1.2, c.dim);
        if (!f.small) f.text(p[0], x + p[4] + 4, y - 6, { size: 9.5, color: f.a(c.ink, 0.6) });
      });
      f.ctx.save(); f.ctx.globalAlpha = fade;
      var tx = f.small ? pad(f) : Math.min(f.w * 0.68, f.w - pad(f) - 235), ty = f.small ? f.h - pad(f) - 36 : f.h * 0.34;
      f.text(ERA[k][0], tx, ty, { size: f.small ? 13 : 20, weight: 800, color: c.b });
      f.text(ERA[k][1], tx, ty + (f.small ? 18 : 28), { size: f.small ? 10.5 : 12.5, color: c.ink });
      f.ctx.restore();
      if (!f.small) { f.text("observe → hypothesis → test → theory", tx, f.h * 0.34 + 70, { size: 11, mono: true, color: c.dim }); f.text("science is the method, not the answers", tx, f.h * 0.34 + 90, { size: 11.5, color: c.dim }); }
      title(f, "History and philosophy of science");
      caption(f, "T² ∝ a³ · the outer planets really do move more slowly");
    }
  });

  /* ================================================================== flag */
  FX.define("flag", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t;
      f.clear();
      var px = pad(f) + 18, top = pad(f) + 24, fh = f.h - top - pad(f) - 26, fw = Math.min(f.w - px - pad(f) - 10, fh * 2), cols = 36, rows = 18;
      f.seg(px - 6, top - 6, px - 6, f.h - pad(f) + 4, c.dim, 5); f.circle(px - 6, top - 10, 5, c.b, null, 0, { glow: 10 });
      // a cloth mesh: each quad coloured green, white, green; the wave grows along the fly
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
        var u0 = i / cols, u1 = (i + 1) / cols, v0 = j / rows, v1 = (j + 1) / rows;
        var wave = function (u, v) { return sin(u * 7 - t * 4 + v * 1.5) * fh * 0.05 * u + sin(u * 13 - t * 6) * fh * 0.012 * u; };
        var q = [[px + u0 * fw, top + v0 * fh + wave(u0, v0)], [px + u1 * fw, top + v0 * fh + wave(u1, v0)], [px + u1 * fw, top + v1 * fh + wave(u1, v1)], [px + u0 * fw, top + v1 * fh + wave(u0, v1)]];
        var band = u0 < 1 / 3 ? 0 : u0 < 2 / 3 ? 1 : 2, base = band === 1 ? [245, 245, 240] : [0, 135, 81];
        var shade = 0.78 + 0.22 * cos(u0 * 7 - t * 4 + v0 * 1.5), col = "rgb(" + Math.round(base[0] * shade) + "," + Math.round(base[1] * shade) + "," + Math.round(base[2] * shade) + ")";
        f.ctx.save(); f.ctx.beginPath(); f.ctx.moveTo(q[0][0], q[0][1]); f.ctx.lineTo(q[1][0] + 0.6, q[1][1]); f.ctx.lineTo(q[2][0] + 0.6, q[2][1] + 0.6); f.ctx.lineTo(q[3][0], q[3][1] + 0.6); f.ctx.closePath(); f.ctx.fillStyle = col; f.ctx.fill(); f.ctx.restore();
      }
      if (!f.small) {
        var tx = px + fw + 24;
        if (tx < f.w - 120) {
          f.text("Nigeria", tx, top + 10, { size: 18, weight: 800, color: c.ink });
          ["1 October 1960 · independence", "green: the land and its wealth", "white: peace and unity", "36 states · one federation", "motto: unity and faith, peace and progress"].forEach(function (s, i) { f.text(s, tx, top + 40 + i * 20, { size: 11.5, color: i ? c.dim : c.b }); });
        }
      }
      title(f, "Nationalism · one nation, many peoples");
      caption(f, "citizenship is rights and duties · the engineer serves the public good");
    }
  });

  /* =============================================================== ecology */
  FX.define("ecology", {
    aspect: 1.7, aspectSmall: 1, still: 2,
    init: function (f) { var r = FX.rng(11), d = []; for (var i = 0; i < 60; i++) d.push({ x: r(), p: r(), s: 0.6 + r() * 0.8 }); f.state.d = d; },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t, W = f.w, H = f.h;
      f.clear();
      // sky gradient, hills, river
      var gy = H * 0.72;
      f.ctx.save(); var g = f.ctx.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, "rgba(94,200,255,.12)"); g.addColorStop(1, "rgba(94,200,255,0)"); f.ctx.fillStyle = g; f.ctx.fillRect(0, 0, W, gy); f.ctx.restore();
      // sun
      var sx = W * 0.84, sy = H * 0.2; f.circle(sx, sy, 16, c.b, null, 0, { glow: 36 }); for (var r = 0; r < 8; r++) { var a = t * 0.4 + r * PI / 4; f.seg(sx + cos(a) * 22, sy + sin(a) * 22, sx + cos(a) * 30, sy + sin(a) * 30, f.a(c.b, 0.6), 1.5); }
      // mountain and land
      f.line([[0, gy], [W * 0.1, H * 0.46], [W * 0.2, H * 0.58], [W * 0.3, H * 0.4], [W * 0.46, gy]], null, 0, { close: true, fill: f.a(c.a, 0.2) });
      f.line([[0, gy], [W, gy], [W, H], [0, H]], null, 0, { close: true, fill: f.a(c.a, 0.12) });
      // trees
      for (var k = 0; k < 7; k++) { var tx = W * (0.05 + k * 0.065) + (k % 2) * 8, ty = gy + 6 + (k % 3) * 5, sway = sin(t * 1.5 + k) * 2; f.seg(tx, ty, tx, ty - 14, c.dim, 2); f.circle(tx + sway, ty - 20, 9, f.a(c.a, 0.7)); f.circle(tx + sway - 6, ty - 15, 6, f.a(c.a, 0.6)); f.circle(tx + sway + 6, ty - 15, 6, f.a(c.a, 0.6)); }
      // river to the sea
      var sea = [[W * 0.55, gy], [W, gy], [W, H], [W * 0.55, H]]; f.line(sea, null, 0, { close: true, fill: f.a(c.c, 0.22) });
      for (var w = 0; w < 5; w++) { var wy = gy + 12 + w * 14, pts = []; for (var q = 0; q <= 30; q++) { var xx = W * 0.55 + q / 30 * W * 0.45; pts.push([xx, wy + sin(q * 0.8 + t * 2 + w) * 2]); } f.line(pts, f.a(c.c, 0.35), 1); }
      f.line([[W * 0.3, H * 0.4], [W * 0.34, H * 0.5], [W * 0.3, H * 0.6], [W * 0.38, gy], [W * 0.5, H * 0.8], [W * 0.56, H * 0.82]], c.c, 3, { glow: 8 });
      // evaporation (up from the sea), cloud, rain (down on the hills)
      var cloudX = W * 0.28, cloudY = H * 0.22;
      s.d.forEach(function (d, i) {
        var u = (t * 0.12 * d.s + d.p) % 1;
        if (i % 2) { var ex = W * 0.6 + d.x * W * 0.35, ey = gy - u * (gy - cloudY) ; var drift = (ex - cloudX) * u; f.circle(ex - drift * 0.9, ey + sin(u * 10) * 4, 1.6, f.a(c.c, 0.6 * (1 - u * 0.6))); }
        else { var rx = cloudX - 50 + d.x * 110, ry = cloudY + 14 + u * (H * 0.45 - cloudY); if (ry < H * 0.6 - (abs(rx - W * 0.3) < 30 ? H * 0.2 * (1 - abs(rx - W * 0.3) / 30) : 0)) f.seg(rx, ry, rx - 2, ry + 7, f.a(c.c, 0.7), 1.2); }
      });
      [[-34, 6, 20], [-6, -2, 26], [24, 6, 20], [8, 12, 18], [-20, 12, 16]].forEach(function (b) { f.circle(cloudX + b[0] + sin(t * 0.3) * 6, cloudY + b[1], b[2], "rgba(233,243,238,.85)"); });
      // labels
      var L = [["evaporation", W * 0.74, H * 0.5, c.c], ["condensation", cloudX + 60, cloudY - 14, c.ink], ["precipitation", cloudX - 70, H * 0.42, c.c], ["run-off and rivers", W * 0.42, H * 0.86, c.c], ["photosynthesis · O₂", W * 0.14, gy - 46, c.a]];
      if (!f.small) L.forEach(function (l) { f.text(l[0], l[1], l[2], { size: 11, color: l[3], weight: 600 }); });
      title(f, "Man and the environment · the water cycle");
      caption(f, "clean water, clean air, safe waste: engineering touches the whole cycle");
    }
  });
})();
