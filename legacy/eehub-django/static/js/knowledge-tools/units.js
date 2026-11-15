/* EE Hub — units and SI-prefix trainer (Round 7, R7E, shared tool K8).
   settings: {families: ["prefix","length","energy",...], family: "prefix", drill: true, unit: "Ω"} */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el, F = KT.fmt;
  var PREF = [["T", 1e12, "tera"], ["G", 1e9, "giga"], ["M", 1e6, "mega"], ["k", 1e3, "kilo"], ["", 1, "(none)"], ["m", 1e-3, "milli"], ["µ", 1e-6, "micro"], ["n", 1e-9, "nano"], ["p", 1e-12, "pico"]];
  // factor to the SI unit (first entry). Temperature handled separately.
  var FAM = {
    length: { label: "Length", u: [["m", 1], ["km", 1e3], ["cm", 1e-2], ["mm", 1e-3], ["µm", 1e-6], ["inch", 0.0254], ["ft", 0.3048], ["mile", 1609.344], ["nautical mile", 1852]] },
    area: { label: "Area", u: [["m²", 1], ["mm²", 1e-6], ["cm²", 1e-4], ["km²", 1e6], ["hectare", 1e4], ["ft²", 0.09290304], ["acre", 4046.8564224]] },
    volume: { label: "Volume", u: [["m³", 1], ["litre (dm³)", 1e-3], ["cm³ (mL)", 1e-6], ["ft³", 0.028316846592], ["UK gallon", 4.54609e-3], ["US gallon", 3.785411784e-3]] },
    mass: { label: "Mass", u: [["kg", 1], ["g", 1e-3], ["tonne", 1e3], ["lb", 0.45359237], ["oz", 0.028349523125]] },
    energy: { label: "Energy", u: [["J", 1], ["kJ", 1e3], ["kWh", 3.6e6], ["MWh", 3.6e9], ["Wh", 3600], ["eV", 1.602176634e-19], ["cal", 4.184], ["kcal", 4184], ["BTU", 1055.05585]] },
    power: { label: "Power", u: [["W", 1], ["kW", 1e3], ["MW", 1e6], ["hp (metric)", 735.49875], ["hp (imperial)", 745.69987], ["BTU/h", 0.29307107], ["kcal/h", 1.16222]] },
    pressure: { label: "Pressure", u: [["Pa", 1], ["kPa", 1e3], ["MPa", 1e6], ["bar", 1e5], ["atm", 101325], ["mmHg", 133.322387], ["psi", 6894.757293], ["m of water", 9806.65]] },
    angle: { label: "Angle", u: [["rad", 1], ["degree", Math.PI / 180], ["revolution", 2 * Math.PI], ["grad", Math.PI / 200]] },
    speed: { label: "Speed", u: [["m/s", 1], ["km/h", 1 / 3.6], ["mph", 0.44704], ["knot", 1852 / 3600]] },
    rotation: { label: "Rotation / frequency", u: [["rad/s", 1], ["rpm", 2 * Math.PI / 60], ["Hz (rev/s)", 2 * Math.PI]] },
    data: { label: "Data", u: [["bit", 1], ["byte", 8], ["kbit", 1e3], ["Mbit", 1e6], ["kB", 8e3], ["MB", 8e6], ["GB", 8e9], ["KiB", 8192], ["MiB", 8388608]] },
    magnetic: { label: "Magnetic flux density", u: [["T (Wb/m²)", 1], ["mT", 1e-3], ["gauss", 1e-4], ["lines/in²", 1.55e-5]] },
    charge: { label: "Charge", u: [["C", 1], ["mAh", 3.6], ["Ah", 3600], ["µC", 1e-6]] },
    temperature: { label: "Temperature", temp: true, u: [["°C"], ["K"], ["°F"], ["°R"]] }
  };
  function toK(v, u, diff) {
    if (diff) return u === "°F" || u === "°R" ? v * 5 / 9 : v;
    return u === "°C" ? v + 273.15 : u === "K" ? v : u === "°F" ? (v - 32) * 5 / 9 + 273.15 : v * 5 / 9;
  }
  function fromK(k, u, diff) {
    if (diff) return u === "°F" || u === "°R" ? k * 9 / 5 : k;
    return u === "°C" ? k - 273.15 : u === "K" ? k : u === "°F" ? (k - 273.15) * 9 / 5 + 32 : k * 9 / 5;
  }
  KT.units = { FAM: FAM, PREF: PREF, toK: toK, fromK: fromK };

  function build(mount, S) {
    var fams = S.families || ["prefix", "length", "area", "energy", "power", "pressure", "angle", "rotation", "temperature", "data"];
    var fam = S.family || fams[0], baseUnit = S.unit || "Ω";
    var wrap = el("div", "kt-units");
    var famOpts = fams.map(function (f) { return [f, f === "prefix" ? "SI prefixes" : FAM[f].label]; });
    if (fams.length > 1) wrap.appendChild(KT.ui.select({ label: "What to convert", options: famOpts, value: fam }, function (v) { fam = v; conv(); }));
    var box = el("div"); wrap.appendChild(box);
    var res = el("div", "kt-tablebox"); wrap.appendChild(res);
    mount.appendChild(wrap);
    var value = S.value != null ? S.value : 4.7, from = S.from || "k", diff = false;

    function conv() {
      box.innerHTML = ""; res.innerHTML = "";
      var row = el("div", "kt-row");
      var v = KT.ui.text({ label: "Value", value: String(value) }, function (x) { value = x; table(); });
      v.classList.add("kt-field"); v.querySelector("input").inputMode = "decimal";
      row.appendChild(v);
      var units = fam === "prefix" ? PREF.map(function (p) { return [p[0], (p[0] || "") + baseUnit + "  (" + p[2] + ")"]; }) : FAM[fam].u.map(function (x) { return [x[0], x[0]]; });
      if (fam !== "prefix" && !units.some(function (x) { return x[0] === from; })) from = units[0][0];
      if (fam === "prefix" && !PREF.some(function (p) { return p[0] === from; })) from = "k";
      var s = KT.ui.select({ label: "From", options: units, value: from }, function (x) { from = x; table(); });
      s.classList.add("kt-field"); row.appendChild(s);
      if (fam === "prefix") {
        var bu = KT.ui.text({ label: "Unit symbol", value: baseUnit }, function (x) { baseUnit = x || ""; table(); });
        bu.classList.add("kt-field"); row.appendChild(bu);
      }
      box.appendChild(row);
      if (fam === "temperature") box.appendChild(KT.ui.toggle({ label: "This is a temperature difference (Δ)", value: diff }, function (x) { diff = !!x; table(); }));
      table();
    }
    function table() {
      res.innerHTML = "";
      var x = parseFloat(String(value).replace(/,/g, ""));
      if (!isFinite(x)) { res.appendChild(el("p", "kt-error", "Type a number.")); return; }
      var tw = el("div", "kt-tablewrap"), t = el("table", "kt-table"), tb = el("tbody");
      var head = el("tr"); ["Unit", "Value", "Scientific"].forEach(function (h) { var th = el("th", null, h); th.scope = "col"; head.appendChild(th); });
      var th = el("thead"); th.appendChild(head); t.appendChild(th);
      function add(u, v, hl) { var r = el("tr"); if (hl) r.className = "is-hl"; r.appendChild(el("td", null, u)); r.appendChild(el("td", null, F.sig(v, 6))); r.appendChild(el("td", null, v === 0 ? "0" : v.toExponential(4))); tb.appendChild(r); }
      if (fam === "prefix") {
        var f = PREF.filter(function (p) { return p[0] === from; })[0][1], si = x * f;
        PREF.forEach(function (p) { add(p[0] + baseUnit, si / p[1], p[0] === from); });
        res.appendChild(el("p", "kt-note", "Rule: moving one prefix step (×10³) down multiplies the number by 1000. " + F.sig(x, 6) + " " + from + baseUnit + " = " + F.sig(si, 6) + " " + baseUnit + "."));
      } else if (FAM[fam].temp) {
        var k = toK(x, from, diff);
        FAM.temperature.u.forEach(function (u) { add((diff ? "Δ" : "") + u[0], fromK(k, u[0], diff), u[0] === from); });
        res.appendChild(el("p", "kt-note", diff ? "A difference of 1 °C equals 1 K; 1 °F equals 1 °R = 5/9 K. Do not add 273.15 to a difference." : "T(K) = T(°C) + 273.15;  T(°F) = 9/5·T(°C) + 32;  T(°R) = T(°F) + 459.67."));
      } else {
        var base = FAM[fam].u.filter(function (u) { return u[0] === from; })[0][1] * x;
        FAM[fam].u.forEach(function (u) { add(u[0], base / u[1], u[0] === from); });
      }
      t.appendChild(tb); tw.appendChild(t); res.appendChild(tw);
    }
    conv();

    if (S.drill !== false) {
      var d = el("div", "kt-steps"), head = el("div", "kt-steps__head");
      head.appendChild(el("b", null, "Prefix drill — 10 quick questions"));
      var startB = el("button", "kt-btn", "Start"); startB.type = "button";
      var hb = el("div", "btn-group"); hb.appendChild(startB); head.appendChild(hb);
      d.appendChild(head);
      var q = el("p", "kt-out"); q.hidden = true; q.setAttribute("aria-live", "polite");
      var arow = el("div", "kt-row"); arow.hidden = true;
      var ans = KT.ui.text({ label: "Your answer (number only)", value: "" }, function () { });
      ans.classList.add("kt-field"); ans.querySelector("input").inputMode = "decimal";
      var check = el("button", "kt-btn", "Check"); check.type = "button";
      arow.appendChild(ans); var cg = el("div", "btn-group"); cg.appendChild(check); arow.appendChild(cg);
      var fb = el("p", "kt-note"); fb.setAttribute("aria-live", "polite");
      d.appendChild(q); d.appendChild(arow); d.appendChild(fb);
      wrap.appendChild(d);
      var n = 0, score = 0, cur = null, units = ["Ω", "V", "A", "W", "F", "H", "Hz", "m", "s"];
      function next() {
        if (n >= 10) { q.textContent = "Done: " + score + " / 10. " + (score >= 8 ? "Excellent — prefixes are second nature." : "Have another go; aim for 8 or more."); arow.hidden = true; startB.textContent = "Start again"; startB.hidden = false; return; }
        var a = PREF[1 + Math.floor(Math.random() * 7)], b = PREF[1 + Math.floor(Math.random() * 7)];
        while (b === a) b = PREF[1 + Math.floor(Math.random() * 7)];
        var mant = [1, 2.2, 3.3, 4.7, 5.6, 6.8, 10, 15, 22, 47, 68, 100, 220, 470][Math.floor(Math.random() * 14)], u = units[Math.floor(Math.random() * units.length)];
        cur = { v: mant * a[1] / b[1], txt: mant + " " + a[0] + u + " = ? " + b[0] + u };
        q.textContent = "Q" + (n + 1) + ".  " + cur.txt;
        ans.querySelector("input").value = ""; ans.querySelector("input").focus();
      }
      function doCheck() {
        if (!cur) return;
        var x = parseFloat(ans.querySelector("input").value.replace(/,/g, "").replace(/×10\^?/, "e").replace("x10^", "e"));
        var ok = isFinite(x) && Math.abs(x - cur.v) <= 1e-6 * Math.abs(cur.v);
        if (ok) score++;
        fb.textContent = (ok ? "Correct. " : "Not quite: ") + cur.txt.replace("?", F.sig(cur.v, 6)) + "   Score " + score + "/" + (n + 1);
        n++; next();
      }
      startB.addEventListener("click", function () { n = 0; score = 0; q.hidden = false; arow.hidden = false; startB.hidden = true; fb.textContent = ""; next(); });
      check.addEventListener("click", doCheck);
      ans.querySelector("input").addEventListener("keydown", function (e) { if (e.key === "Enter") doCheck(); });
    }
  }
  KT.define("units", build);
})();
