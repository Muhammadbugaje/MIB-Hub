/* GPA and CGPA calculator (study hub). Everything runs in the browser; the plan is kept on this device only. */
(function () {
  "use strict";
  var root = document.querySelector("[data-cg]");
  if (!root) return;
  var CFG = JSON.parse(root.querySelector("[data-cg-cfg]").textContent);
  var SCALE = CFG.scale.map(function (r) { return { g: String(r[0]), lo: +r[1], hi: +r[2], pt: +r[3] }; })
    .sort(function (a, b) { return b.pt - a.pt; });
  var MAXPT = SCALE.length ? SCALE[0].pt : 5;
  var CLASSES = (CFG.classes || []).map(function (c) { return { name: c[0], min: +c[1] }; }).sort(function (a, b) { return b.min - a.min; });
  var STORE = "ee.cgpa.v1";
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var semsBox = $("[data-cg-sems]"), tplSem = $("[data-cg-tpl-sem]"), tplRow = $("[data-cg-tpl-row]");
  var byCode = {};
  CFG.courses.forEach(function (c) { byCode[norm(c.code)] = c; });

  function norm(code) { return String(code || "").toUpperCase().replace(/\s+/g, "").replace(/([A-Z]+)(\d+)/, "$1 $2"); }
  function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function gradeFor(score) {
    for (var i = 0; i < SCALE.length; i++) if (score >= SCALE[i].lo && score <= SCALE[i].hi + 0.999) return SCALE[i];
    return SCALE[SCALE.length - 1];
  }
  function pointFor(g) { for (var i = 0; i < SCALE.length; i++) if (SCALE[i].g === g) return SCALE[i].pt; return null; }
  function passPoint() { var p = gradeFor(+CFG.pass || 45); return p ? p.pt : 1; }
  function classFor(c) { for (var i = 0; i < CLASSES.length; i++) if (c >= CLASSES[i].min - 1e-9) return CLASSES[i]; return null; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function confirmAction(options, action) {
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[CGPA] Confirmation dialog is unavailable; action was not performed.");
      return;
    }
    window.EEConfirm.open(options).then(function (confirmed) {
      if (confirmed) action();
    }).catch(function (error) {
      console.error("[CGPA] Could not open confirmation dialog", error);
    });
  }

  // datalist of courses
  var dl = $("[data-cg-list]");
  dl.innerHTML = CFG.courses.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.title) + " · " + c.units + " units" + (c.core ? "" : " · elective") + "</option>"; }).join("");

  // target select
  var tsel = $("[data-cg-tsel]");
  tsel.innerHTML = '<option value="">Choose…</option>' + CLASSES.map(function (c) { return '<option value="' + c.min + '">' + esc(c.name) + " (" + fmt(c.min) + ")</option>"; }).join("") +
    [4.0, 3.0, 2.0].map(function (v) { return '<option value="' + v + '">CGPA ' + fmt(v) + "</option>"; }).join("");
  $("[data-cg-entry]").value = String(CFG.entry || 100);

  // ------------------------------------------------------------------ building rows
  function addRow(sem, data) {
    data = data || {};
    var row = tplRow.content.firstElementChild.cloneNode(true);
    var sel = $("[data-cg-grade]", row);
    sel.innerHTML += SCALE.map(function (s) { return '<option value="' + s.g + '">' + s.g + " (" + s.pt + ")</option>"; }).join("");
    $("[data-cg-code]", row).value = data.code || "";
    $("[data-cg-units]", row).value = data.units != null ? data.units : "";
    $("[data-cg-score]", row).value = data.score != null ? data.score : "";
    sel.value = data.grade || "";
    if (data.carry) row.classList.add("is-carry");
    title(row);
    $("[data-cg-rows]", sem).appendChild(row);
    return row;
  }
  function title(row) {
    var c = byCode[norm($("[data-cg-code]", row).value)];
    $("[data-cg-title]", row).textContent = c ? c.title : "";
    return c;
  }
  function addSem(data) {
    data = data || {};
    var sem = tplSem.content.firstElementChild.cloneNode(true);
    $("[data-cg-sname]", sem).value = data.name || ("Semester " + ($$(".cg-sem", semsBox).length + 1));
    semsBox.appendChild(sem);
    (data.rows || []).forEach(function (r) { addRow(sem, r); });
    if (!(data.rows || []).length) addRow(sem);
    return sem;
  }

  // ------------------------------------------------------------------ maths
  function compute() {
    var pu = parseFloat($("[data-cg-pu]").value), pg = parseFloat($("[data-cg-pg]").value);
    var baseU = pu > 0 && pg >= 0 && pg <= MAXPT ? pu : 0, baseQ = baseU ? pu * pg : 0;
    var TU = baseU, TQ = baseQ, TP = baseU ? baseU : 0, series = [], pp = passPoint();
    $$(".cg-sem", semsBox).forEach(function (sem) {
      var U = 0, Q = 0;
      $$(".cg-row:not(.cg-row--head)", sem).forEach(function (row) {
        var u = parseFloat($("[data-cg-units]", row).value), sc = $("[data-cg-score]", row).value, sel = $("[data-cg-grade]", row);
        var pt = null, g = "";
        if (sc !== "" && !isNaN(+sc)) { var gr = gradeFor(Math.max(0, Math.min(100, Math.round(+sc)))); pt = gr.pt; g = gr.g; sel.value = g; sel.disabled = true; }
        else { sel.disabled = false; g = sel.value; pt = g ? pointFor(g) : null; }
        var ptEl = $("[data-cg-pt]", row);
        if (pt != null && u > 0) {
          U += u; Q += u * pt; if (pt >= pp) TP += u;
          ptEl.textContent = (u * pt) + " pts"; row.dataset.state = pt >= pp ? "pass" : "fail";
        } else { ptEl.textContent = "—"; delete row.dataset.state; }
      });
      $("[data-cg-sgpa]", sem).textContent = U ? fmt(Q / U) : "—";
      $("[data-cg-sunits]", sem).textContent = U ? U + " units" : "";
      TU += U; TQ += Q;
      if (U) series.push({ name: $("[data-cg-sname]", sem).value, gpa: Q / U, cgpa: TQ / TU });
    });
    var c = TU ? TQ / TU : 0;
    $("[data-cg-cgpa]").textContent = TU ? fmt(c) : "—";
    $("[data-cg-tu]").textContent = TU; $("[data-cg-tp]").textContent = TP; $("[data-cg-qp]").textContent = Math.round(TQ * 100) / 100;
    var arc = $("[data-cg-arc]"), circ = 2 * Math.PI * 52;
    arc.style.strokeDasharray = circ; arc.style.strokeDashoffset = circ * (1 - (TU ? c / MAXPT : 0));
    var cls = TU ? classFor(+fmt(c)) : null;
    root.dataset.band = cls ? String(CLASSES.indexOf(cls)) : (TU ? "fail" : "");
    $("[data-cg-class]").textContent = !TU ? "Add grades to see your class" : (cls ? cls.name : "Below the lowest class");
    // next class
    var next = $("[data-cg-next]"), higher = CLASSES.filter(function (k) { return k.min > c + 1e-9; }).pop();
    next.innerHTML = TU && higher ? '<span>' + fmt(higher.min - c) + " to " + esc(higher.name) + '</span><i style="--p:' +
      Math.max(0, Math.min(100, (c / higher.min) * 100)).toFixed(1) + '%"></i>' : (TU && cls === CLASSES[0] ? "<span>Top class — keep it there.</span>" : "");
    var warn = $("[data-cg-warn]");
    if (TU && c < CFG.good) { warn.hidden = false; warn.textContent = "Below " + fmt(CFG.good) + ": this would mean probation at the end of the session. Look at the target planner for a way back."; }
    else warn.hidden = true;
    // graduation units
    var entry = $("[data-cg-entry]").value, need = (CFG.grad || {})[entry];
    $("[data-cg-need]").textContent = need ? Math.max(0, need - TP) + " of " + need : "—";
    var left = $("[data-cg-left]");
    if (!left.dataset.touched) left.value = need ? Math.max(0, need - TU) : "";
    chart(series); target(TU, TQ); save();
    $("[data-cg-empty]").hidden = $$(".cg-sem", semsBox).length > 0;
  }

  function target(TU, TQ) {
    var out = $("[data-cg-tout]"), t = parseFloat(tsel.value), L = parseFloat($("[data-cg-left]").value);
    if (!(t > 0)) { out.innerHTML = '<p class="kp-muted">Choose a target to see the average you need in the units you still have to take.</p>'; return; }
    if (!(L > 0)) { out.innerHTML = '<p class="kp-muted">Enter how many units you still have to take.</p>'; return; }
    var need = (t * (TU + L) - TQ) / L, best = (TQ + MAXPT * L) / (TU + L);
    var html;
    if (need <= 0) html = "<p class='cg-ok'><b>Already there.</b> Even with the lowest passing grades you stay at or above " + fmt(t) + ".</p>";
    else if (need > MAXPT + 1e-9) html = "<p class='cg-bad'><b>Not reachable</b> with " + L + " units left: even all " + SCALE[0].g + "s give " + fmt(best) + ". Aim for the next class down, or count more units.</p>";
    else {
      // smallest number of top-grade units, rest at the next grade, that reaches the target
      var a = SCALE[0], b = SCALE[1] || SCALE[0], k = Math.ceil(((need - b.pt) * L) / Math.max(1e-9, a.pt - b.pt));
      k = Math.max(0, Math.min(L, k));
      html = "<p class='cg-mid'>You need an average of <b>" + fmt(need) + "</b> in your remaining " + L + " units.</p>" +
        (a !== b ? "<p class='kp-muted'>For example: " + k + " units of " + a.g + " and " + (L - k) + " units of " + b.g + ".</p>" : "") +
        "<p class='kp-muted'>Best possible CGPA with all " + a.g + "s: " + fmt(best) + ".</p>";
    }
    out.innerHTML = html;
  }

  function chart(series) {
    var box = $("[data-cg-chart]");
    if (series.length < 2) { box.innerHTML = '<p class="kp-muted">The chart appears once two semesters have grades.</p>'; return; }
    var W = 320, H = 170, P = 28, n = series.length, x = function (i) { return P + (i * (W - P - 10)) / (n - 1); },
      y = function (v) { return H - 22 - (v / MAXPT) * (H - 40); };
    var grid = [0, 1, 2, 3, 4, 5].filter(function (v) { return v <= MAXPT; }).map(function (v) {
      return '<line x1="' + P + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="g"/><text x="4" y="' + (y(v) + 4) + '">' + v + "</text>";
    }).join("");
    var bands = CLASSES.map(function (c) { return '<line x1="' + P + '" x2="' + (W - 6) + '" y1="' + y(c.min) + '" y2="' + y(c.min) + '" class="band"/>'; }).join("");
    var line = function (key, cls) {
      return '<polyline class="' + cls + '" points="' + series.map(function (s, i) { return x(i) + "," + y(s[key]); }).join(" ") + '"/>' +
        series.map(function (s, i) { return '<circle class="' + cls + '" cx="' + x(i) + '" cy="' + y(s[key]) + '" r="3.5"><title>' + esc(s.name) + ": " + fmt(s[key]) + "</title></circle>"; }).join("");
    };
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="GPA and CGPA by semester">' + grid + bands + line("gpa", "gpa") + line("cgpa", "cgpa") + "</svg>" +
      '<p class="cg-legend"><span class="gpa">GPA</span><span class="cgpa">CGPA</span><span class="band">class lines</span></p>';
  }

  // ------------------------------------------------------------------ handbook fill and own results
  function fillFromHandbook() {
    function fill() {
      var entry = +$("[data-cg-entry]").value;
      semsBox.innerHTML = "";
      [100, 200, 300, 400, 500].filter(function (l) { return l >= entry; }).forEach(function (lvl) {
        [1, 2].forEach(function (s) {
          var rows = CFG.courses.filter(function (c) { return c.level === lvl && c.sem === s && c.core; })
            .map(function (c) { return { code: c.code, units: c.units }; });
          if (rows.length) addSem({ name: lvl + " level · " + (s === 1 ? "First" : "Second") + " semester", rows: rows });
        });
      });
      $("[data-cg-left]").dataset.touched = ""; compute();
    }
    if ($$(".cg-sem", semsBox).length) {
      confirmAction({
        title: "Replace these semesters?",
        body: "Replace the semesters on this page with the handbook's courses?",
        confirmLabel: "Replace semesters",
        tone: "danger"
      }, fill);
      return;
    }
    fill();
  }
  function loadMine() {
    function load() {
      semsBox.innerHTML = "";
      $("[data-cg-pu]").value = ""; $("[data-cg-pg]").value = "";
      (CFG.mine || []).forEach(function (s) {
        addSem({ name: s.label, rows: s.rows.map(function (r) { return { code: r.code, units: r.units, grade: r.grade, carry: r.carry }; }) });
      });
      compute();
    }
    if ($$(".cg-sem", semsBox).length) {
      confirmAction({
        title: "Load your published results?",
        body: "Replace the semesters on this page with your published results?",
        confirmLabel: "Load results",
        tone: "danger"
      }, load);
      return;
    }
    load();
  }

  // ------------------------------------------------------------------ save, export, print
  function snapshot() {
    return {
      entry: $("[data-cg-entry]").value, pu: $("[data-cg-pu]").value, pg: $("[data-cg-pg]").value, t: tsel.value,
      left: $("[data-cg-left]").dataset.touched ? $("[data-cg-left]").value : "",
      sems: $$(".cg-sem", semsBox).map(function (sem) {
        return { name: $("[data-cg-sname]", sem).value, rows: $$(".cg-row:not(.cg-row--head)", sem).map(function (r) {
          return { code: $("[data-cg-code]", r).value, units: $("[data-cg-units]", r).value, score: $("[data-cg-score]", r).value,
                   grade: $("[data-cg-score]", r).value === "" ? $("[data-cg-grade]", r).value : "", carry: r.classList.contains("is-carry") };
        }) };
      })
    };
  }
  var saveT;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch (e) { /* private mode */ } }, 250); }
  function restore() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { d = null; }
    if (!d) return false;
    $("[data-cg-entry]").value = d.entry || $("[data-cg-entry]").value;
    $("[data-cg-pu]").value = d.pu || ""; $("[data-cg-pg]").value = d.pg || ""; tsel.value = d.t || "";
    if (d.left) { $("[data-cg-left]").value = d.left; $("[data-cg-left]").dataset.touched = "1"; }
    (d.sems || []).forEach(function (s) { addSem(s); });
    return true;
  }
  function csv() {
    var lines = [["Semester", "Course", "Title", "Units", "Score", "Grade", "Point", "Units x point"]];
    $$(".cg-sem", semsBox).forEach(function (sem) {
      var name = $("[data-cg-sname]", sem).value;
      $$(".cg-row:not(.cg-row--head)", sem).forEach(function (r) {
        var u = $("[data-cg-units]", r).value, g = $("[data-cg-grade]", r).value, pt = pointFor(g);
        var c = byCode[norm($("[data-cg-code]", r).value)];
        lines.push([name, $("[data-cg-code]", r).value, c ? c.title : "", u, $("[data-cg-score]", r).value, g, pt == null ? "" : pt, pt == null || !u ? "" : u * pt]);
      });
      lines.push([name, "GPA", "", "", "", "", $("[data-cg-sgpa]", sem).textContent, ""]);
    });
    lines.push(["", "CGPA", "", $("[data-cg-tu]").textContent, "", "", $("[data-cg-cgpa]").textContent, ""]);
    var text = lines.map(function (l) { return l.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = "my-cgpa-plan.csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ------------------------------------------------------------------ events
  root.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-cg-code]")) {
      var row = t.closest(".cg-row"), c = title(row), u = $("[data-cg-units]", row);
      if (c && !u.value) u.value = c.units;
    }
    if (t.matches("[data-cg-left]")) t.dataset.touched = t.value === "" ? "" : "1";
    if (t.matches("[data-cg-score]")) { var v = +t.value; if (t.value !== "" && (v < 0 || v > 100)) t.setCustomValidity("0 to 100"); else t.setCustomValidity(""); }
    compute();
  });
  root.addEventListener("change", compute);
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var sem = b.closest(".cg-sem");
    if (b.matches("[data-cg-addrow]")) { $("[data-cg-code]", addRow(sem)).focus(); }
    else if (b.matches("[data-cg-del]")) { b.closest(".cg-row").remove(); }
    else if (b.matches("[data-cg-sdel]")) {
      confirmAction({
        title: "Remove this semester?",
        body: "Its courses and grades will be removed from this plan.",
        confirmLabel: "Remove semester",
        tone: "danger"
      }, function () { sem.remove(); compute(); });
      return;
    }
    else if (b.matches("[data-cg-allA]")) { $$(".cg-row:not(.cg-row--head)", sem).forEach(function (r) { $("[data-cg-score]", r).value = ""; $("[data-cg-grade]", r).value = SCALE[0].g; }); }
    else if (b.matches("[data-cg-clear]")) { $$(".cg-row:not(.cg-row--head)", sem).forEach(function (r) { $("[data-cg-score]", r).value = ""; $("[data-cg-grade]", r).value = ""; }); }
    else if (b.matches("[data-cg-addsem]")) { var s = addSem(); s.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (b.matches("[data-cg-fill]")) { fillFromHandbook(); return; }
    else if (b.matches("[data-cg-mine]")) { loadMine(); return; }
    else if (b.matches("[data-cg-csv]")) { csv(); return; }
    else if (b.matches("[data-cg-print]")) { window.print(); return; }
    else if (b.matches("[data-cg-reset]")) {
      confirmAction({
        title: "Start again?",
        body: "Clear every semester, grade and saved value on this page?",
        confirmLabel: "Clear calculator",
        tone: "danger"
      }, function () {
        semsBox.innerHTML = ""; $("[data-cg-pu]").value = ""; $("[data-cg-pg]").value = ""; tsel.value = ""; $("[data-cg-left]").dataset.touched = "";
        try { localStorage.removeItem(STORE); } catch (err) { /* ignore */ }
        compute();
      });
      return;
    } else return;
    compute();
  });

  if (!restore()) {
    if ((CFG.mine || []).length) loadMine(); else fillFromHandbook();
  }
  compute();
})();
