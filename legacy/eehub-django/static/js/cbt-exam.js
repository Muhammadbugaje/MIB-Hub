/* EE Hub CBT: the exam screen (ported from NAMETS take.html, raised to Phase 8).
 *
 * The server is the authority for time, strikes and status; this script is a
 * display that re-syncs on every save and heartbeat. Answers are saved one by
 * one as they change; while offline they wait in localStorage and are sent
 * when the connection returns, so a dropped network or a closed tab loses
 * nothing. Anti-cheat detectors report events; the server decides the strike
 * and whether the attempt is auto-submitted.
 */
(function () {
  "use strict";
  var root = document.getElementById("cx");
  if (!root) return;

  var D = root.dataset;
  var MODE = D.mode, GUARD = D.guard === "1", LIMIT = parseInt(D.limit, 10) || 3;
  var TOTAL = parseInt(D.total, 10) || 0, DURATION = parseInt(D.duration, 10) || 0;
  var IDLE = parseInt(D.idle, 10) || 0;
  var AUTO = D.autosubmit !== "0";
  var STORE = "cx:" + D.key;
  var qs = Array.prototype.slice.call(document.querySelectorAll(".cx-q"));
  var pal = Array.prototype.slice.call(document.querySelectorAll(".cx-pal__b"));
  var cur = 0, started = false, finishing = false, strikes = parseInt(D.strikes, 10) || 0;
  var deadline = Date.now() + (parseInt(D.left, 10) || 0) * 1000;
  var lastEvent = 0, warned5 = false, warned1 = false, awaySince = null, idleSent = false, devtoolsOpen = false;

  function csrf() {
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    var i = document.querySelector("#cx-submit-form input[name=csrfmiddlewaretoken]");
    return i ? i.value : "";
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRFToken": csrf(), "X-Requested-With": "fetch" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { data._status = r.status; return data; });
    });
  }

  function toast(kind, title, msg) {
    if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(kind, title, msg);
  }

  // ---------------------------------------------------------------- storage
  function loadPending() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { return {}; }
  }
  var pending = loadPending();          // {qid: payload}
  pending.__events = pending.__events || [];
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(pending)); } catch (e) {}
  }
  function pendingCount() { return Object.keys(pending).filter(function (k) { return k !== "__events"; }).length; }

  // ---------------------------------------------------------------- status line
  var savedEl = document.getElementById("cx-saved");
  function setSaved(state, text) {
    if (!savedEl) return;
    savedEl.className = "cx-saved is-" + state;
    savedEl.querySelector("span").textContent = text;
  }
  var offlineEl = document.getElementById("cx-offline");
  function setOffline(on) {
    if (offlineEl) offlineEl.hidden = !on;
    if (on) setSaved("off", pendingCount() ? pendingCount() + " waiting to send" : "Offline");
  }

  // ---------------------------------------------------------------- server state
  function apply(data) {
    if (!data) return;
    if (typeof data.left === "number") deadline = Date.now() + data.left * 1000;
    if (typeof data.strikes === "number") { strikes = data.strikes; drawStrikes(); }
    if (data.status === "elsewhere") return closeDown("This test is open on another device", "Continue on that device, or ask the invigilator to allow this one.", null);
    if (data.redirect && data.status !== "in_progress") {
      var auto = data.status === "auto";
      return closeDown(auto ? "Test submitted automatically" : (data.status === "timeup" ? "Time is up" : "Test submitted"),
        auto ? "You reached " + LIMIT + " strikes. Your answers so far were kept." : "Your answers were saved and submitted.", data.redirect);
    }
  }

  function closeDown(title, text, url) {
    finishing = true;
    var busy = document.getElementById("cx-busy");
    busy.querySelector("[data-busy-title]").textContent = title;
    busy.querySelector("[data-busy-text]").textContent = text;
    busy.hidden = false;
    hideGuard();
    try { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (e) {}
    try { localStorage.removeItem(STORE); } catch (e) {}
    if (url) setTimeout(function () { window.location.href = url; }, 1400);
  }

  // ---------------------------------------------------------------- answers
  function payloadFor(sec) {
    var kind = sec.dataset.kind, p = { q: parseInt(sec.dataset.qid, 10) };
    if (kind === "numeric") p.numeric = sec.querySelector("[data-numeric]").value.trim();
    else if (kind === "text") p.text = sec.querySelector("[data-text]").value;
    else p.selected = Array.prototype.map.call(sec.querySelectorAll("input:checked"), function (i) { return parseInt(i.value, 10); });
    p.flagged = sec.dataset.flagged === "1";
    return p;
  }

  function isAnswered(sec) {
    var k = sec.dataset.kind;
    if (k === "numeric") return !!sec.querySelector("[data-numeric]").value.trim();
    if (k === "text") return !!sec.querySelector("[data-text]").value.trim();
    return !!sec.querySelector("input:checked");
  }

  var sending = false;
  function queue(sec) {
    var p = payloadFor(sec);
    pending[p.q] = p;
    persist();
    sec.dataset.answered = isAnswered(sec) ? "1" : "0";
    sec.querySelectorAll(".cx-opt").forEach(function (l) { l.classList.toggle("is-sel", l.querySelector("input").checked); });
    var note = sec.querySelector("[data-saved-note]");
    if (note) note.textContent = navigator.onLine ? "Saving…" : "Kept on this device · will send when online";
    counts();
    flush();
  }

  function flush() {
    if (sending || finishing) return;
    var keys = Object.keys(pending).filter(function (k) { return k !== "__events"; });
    if (!keys.length) { flushEvents(); return; }
    sending = true;
    setSaved("busy", "Saving…");
    var p = pending[keys[0]];
    post(D.answerUrl, p).then(function (data) {
      sending = false;
      if (data._status === 409) { apply(data); if (!finishing) { delete pending[keys[0]]; persist(); } return; }
      if (data._status === 400) {
        delete pending[keys[0]]; persist();
        var sec = document.getElementById("q-" + p.q);
        var err = sec && sec.querySelector("[data-err]");
        if (err) { err.textContent = data.error || "Could not save this answer."; err.hidden = false; }
        setSaved("err", "Check question " + (sec ? parseInt(sec.dataset.index, 10) + 1 : ""));
        return flush();
      }
      if (!data.ok) throw new Error("save failed");
      if (JSON.stringify(pending[keys[0]]) === JSON.stringify(p)) delete pending[keys[0]];
      persist();
      setOffline(false);
      apply(data);
      var s = document.getElementById("q-" + p.q);
      if (s) {
        var e2 = s.querySelector("[data-err]"); if (e2) e2.hidden = true;
        var n = s.querySelector("[data-saved-note]");
        if (n) n.textContent = isAnswered(s) ? "Answer saved at " + data.saved_at + " · you can change it until time runs out" : "Not answered";
      }
      setSaved("ok", "Saved " + (data.saved_at || ""));
      flush();
    }).catch(function () {
      sending = false;
      setOffline(true);
    });
  }

  function flushEvents() {
    if (!pending.__events.length || finishing) return;
    var ev = pending.__events.shift();
    persist();
    post(D.eventUrl, ev).then(function (data) {
      if (data._status === 409) return apply(data);
      apply(data);
      if (data.submitted) return;
      flushEvents();
    }).catch(function () { pending.__events.unshift(ev); persist(); setOffline(true); });
  }

  // ---------------------------------------------------------------- navigation
  function show(i) {
    if (i < 0 || i >= qs.length) return;
    qs[cur].hidden = true;
    cur = i;
    qs[cur].hidden = false;
    var flagged = qs[cur].dataset.flagged === "1";
    document.querySelectorAll("[data-flag]").forEach(function (b) {
      b.setAttribute("aria-pressed", flagged ? "true" : "false");
      b.classList.toggle("is-on", flagged);
    });
    document.querySelectorAll("[data-flag-label]").forEach(function (l) {
      l.textContent = flagged ? "Flagged" : (l.closest(".cx-drawer") ? "Flag" : "Flag for review");
    });
    document.querySelectorAll("[data-prev]").forEach(function (b) { b.disabled = cur === 0; });
    document.querySelectorAll("[data-next]").forEach(function (b) { b.disabled = cur === qs.length - 1; });
    document.querySelectorAll("[data-cur]").forEach(function (e) { e.textContent = cur + 1; });
    var top = document.getElementById("cx-progress-top");
    if (top) top.style.width = ((cur + 1) * 100 / Math.max(1, qs.length)) + "%";
    counts();
    var h = qs[cur].querySelector(".cx-qnum");
    if (h && document.activeElement && document.activeElement.closest && document.activeElement.closest(".cx-nav, .cx-pal, .cx-drawer")) {
      h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true });
    }
    if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function counts() {
    var a = 0, f = 0;
    qs.forEach(function (s, i) {
      var ans = s.dataset.answered === "1", fl = s.dataset.flagged === "1";
      if (ans) a++;
      if (fl) f++;
      var b = pal[i];
      if (b) {
        b.classList.toggle("is-a", ans);
        b.classList.toggle("is-f", fl);
        b.classList.toggle("is-c", i === cur);
        b.setAttribute("aria-label", "Question " + (i + 1) + (ans ? ", answered" : ", not answered") + (fl ? ", flagged" : "") + (i === cur ? ", current" : ""));
        if (i === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      }
    });
    document.querySelectorAll("[data-count-answered]").forEach(function (e) { e.textContent = a; });
    document.querySelectorAll("[data-count-flagged]").forEach(function (e) { e.textContent = f; });
    document.querySelectorAll("[data-count-blank]").forEach(function (e) { e.textContent = TOTAL - a; });
    return { answered: a, flagged: f };
  }

  function toggleFlag() {
    var s = qs[cur];
    s.dataset.flagged = s.dataset.flagged === "1" ? "0" : "1";
    show(cur);
    queue(s);
  }

  function clearAnswer() {
    var s = qs[cur];
    s.querySelectorAll("input[type=radio], input[type=checkbox]").forEach(function (i) { i.checked = false; });
    s.querySelectorAll("[data-numeric], [data-text]").forEach(function (i) { i.value = ""; });
    queue(s);
  }

  // ---------------------------------------------------------------- clock
  var clock = document.getElementById("cx-clock"), timer = document.getElementById("cx-timer");
  var usedTxt = document.getElementById("cx-used-txt"), usedBar = document.getElementById("cx-used-bar");
  function fmt(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
  }
  function tick() {
    var left = (deadline - Date.now()) / 1000;
    if (clock) clock.textContent = fmt(left);
    if (timer) {
      timer.classList.toggle("is-warn", left <= 300 && left > 60);
      timer.classList.toggle("is-danger", left <= 60);
    }
    var used = DURATION - left;
    if (usedTxt) usedTxt.textContent = fmt(used) + " / " + fmt(DURATION);
    if (usedBar) usedBar.style.width = Math.min(100, Math.max(0, used * 100 / Math.max(1, DURATION))) + "%";
    if (!warned5 && left <= 300 && left > 60 && DURATION > 600) { warned5 = true; toast("warn", "5 minutes left", "Check any questions you flagged."); announce("Five minutes left."); }
    if (!warned1 && left <= 60 && left > 0) { warned1 = true; toast("warn", "1 minute left", "Your answers are submitted when time runs out."); announce("One minute left."); }
    if (left <= 0 && !finishing) { timeUp(); }
  }
  var live = document.createElement("div");
  live.className = "sr-only"; live.setAttribute("aria-live", "assertive");
  document.body.appendChild(live);
  function announce(t) { live.textContent = t; }

  function timeUp() {
    finishing = true;
    closeDown("Time is up", "Submitting your answers…", null);
    var go = function () {
      post(D.submitUrl, {}).then(function (d) { window.location.href = d.redirect || D.doneUrl; })
        .catch(function () { setTimeout(go, 3000); });
    };
    // send what is waiting first (the server accepts saves during the grace period)
    var tries = 0;
    (function wait() {
      finishing = false; flush(); finishing = true;
      if ((pendingCount() && tries++ < 10)) return setTimeout(wait, 500);
      go();
    })();
  }

  // ---------------------------------------------------------------- submit
  function askSubmit() {
    var c = counts();
    var blank = TOTAL - c.answered;
    var body = "You have answered " + c.answered + " of " + TOTAL + " question" + (TOTAL === 1 ? "" : "s") + "." +
      (blank ? " " + blank + " not answered." : "") + (c.flagged ? " " + c.flagged + " flagged for review." : "") +
      " Once submitted you cannot change your answers.";
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[CBT] Confirmation dialog is unavailable; test was not submitted.");
      return;
    }
    window.EEConfirm.open({ title: "Submit your test?", body: body, confirmLabel: "Submit test", cancelLabel: "Not yet", tone: "default" })
      .then(function (ok) { if (ok) submitNow(); })
      .catch(function (error) { console.error("[CBT] Could not open submission confirmation", error); });
  }

  function submitNow() {
    finishing = true;
    closeDown("Submitting your test…", "Please wait. Do not close this page.", null);
    var tries = 0;
    (function wait() {
      finishing = false; flush(); finishing = true;
      if (pendingCount() && tries++ < 12) return setTimeout(wait, 500);
      post(D.submitUrl, {}).then(function (d) { window.location.href = d.redirect || D.doneUrl; })
        .catch(function () { document.getElementById("cx-submit-form").submit(); });
    })();
  }

  // ---------------------------------------------------------------- anti-cheat
  var guard = document.getElementById("cx-guard");
  function drawStrikes() {
    document.querySelectorAll("[data-strike-count]").forEach(function (e) { e.textContent = strikes; });
    var dots = document.querySelector(".cx-strikes__dots");
    if (dots) {
      dots.innerHTML = "";
      for (var i = 0; i < LIMIT; i++) { var d = document.createElement("i"); if (i < strikes) d.className = "is-used"; dots.appendChild(d); }
      var box = document.getElementById("cx-strikes");
      if (box) box.classList.toggle("is-hot", strikes > 0);
    }
    var bars = guard && guard.querySelector("[data-bars]");
    if (bars) {
      bars.innerHTML = "";
      for (var j = 0; j < Math.max(LIMIT, strikes); j++) { var b = document.createElement("span"); if (j < strikes) b.className = "is-on"; bars.appendChild(b); }
    }
  }

  var TEXTS = {
    tab_switch: ["You switched away from the test", "Stay on this page until you submit."],
    blur: ["You left the test window", "Another window or app took the focus."],
    fullscreen_exit: ["You left fullscreen", "The test must stay fullscreen."],
    copy: ["Copying is not allowed", "Questions cannot be copied out of the test."],
    paste: ["Pasting is not allowed", "Type your answers in yourself."],
    right_click: ["Right-click is disabled", "Use the buttons on the page."],
    devtools: ["Developer tools are not allowed", "Close them to continue."],
    idle: ["You were away from the test too long", "Being away from the test counts as another strike."],
    print: ["Printing and saving are not allowed", "The paper stays inside EE Hub."]
  };

  function report(kind, meta) {
    if (!GUARD || !started || finishing) return;
    var now = Date.now();
    if (now - lastEvent < 1500) return;          // one strike per burst (blur + visibilitychange)
    lastEvent = now;
    var ev = { kind: kind, meta: meta || {} };
    var t = TEXTS[kind] || ["A test rule was broken", ""];
    post(D.eventUrl, ev).then(function (data) {
      if (data._status === 409) return apply(data);
      if (typeof data.strikes === "number") strikes = data.strikes;
      drawStrikes();
      if (data.submitted || data.status === "auto" || (data.redirect && data.status !== "in_progress")) return apply(data);
      if (data.counted === false) return;
      openGuard(t, data.at, data.label, data.strike);
    }).catch(function () {
      pending.__events.push(ev); persist(); setOffline(true);
      strikes += 1; drawStrikes();
      openGuard(t, new Date().toLocaleTimeString(), t[0], strikes);
    });
  }

  function openGuard(t, at, label, n) {
    guard.querySelector("#cx-guard-h").textContent = t[0];
    var left = LIMIT - strikes;
    guard.querySelector("[data-guard-count]").textContent = AUTO ? "Strike " + (n || strikes) + " of " + LIMIT : "Strike " + (n || strikes);
    var warnText = !AUTO ? "This strike is logged; the test is not submitted for it." :
      (left <= 1 ? "One more and your test will be submitted automatically." : left + " more and your test will be submitted automatically.");
    guard.querySelector("[data-guard-text]").textContent = t[1] + " " + warnText + " Your answers so far are saved.";
    var log = guard.querySelector("[data-guard-log]");
    var row = document.createElement("div");
    row.innerHTML = '<span class="ee-mono"></span><span></span><span class="ee-chip ee-chip--ember"></span>';
    row.children[0].textContent = at || "";
    row.children[1].textContent = label || t[0];
    row.children[2].textContent = "Strike " + (n || strikes);
    log.appendChild(row);
    drawStrikes();
    guard.hidden = false;
    guard.querySelector("[data-guard-ok]").focus();
  }
  function hideGuard() { if (guard) guard.hidden = true; }

  function fsSupported() {
    var el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
  }
  function enterFs() {
    var el = document.documentElement;
    try {
      var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  function away(on) {
    if (on) { if (awaySince === null) { awaySince = Date.now(); idleSent = false; } }
    else awaySince = null;
  }

  if (GUARD) {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { away(true); report("tab_switch", { at: new Date().toISOString() }); }
      else away(false);
    });
    window.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.hidden) return;                 // counted as tab_switch
        if (document.activeElement && document.activeElement.tagName === "IFRAME") return;
        away(true); report("blur", {});
      }, 60);
    });
    window.addEventListener("focus", function () { away(false); });
    ["fullscreenchange", "webkitfullscreenchange"].forEach(function (n) {
      document.addEventListener(n, function () { if (started && !isFs() && fsSupported()) report("fullscreen_exit", {}); });
    });
    ["copy", "cut"].forEach(function (n) {
      document.addEventListener(n, function (e) { if (!started) return; e.preventDefault(); report("copy", { event: n }); }, true);
    });
    document.addEventListener("paste", function (e) { if (!started) return; e.preventDefault(); report("paste", {}); }, true);
    document.addEventListener("contextmenu", function (e) { if (!started) return; e.preventDefault(); report("right_click", {}); });
    document.addEventListener("dragstart", function (e) { if (started) e.preventDefault(); });
    window.addEventListener("beforeprint", function () { report("print", {}); });
    // devtools: docked panels change the inner size while fullscreen (desktop only)
    setInterval(function () {
      if (!started || finishing || window.matchMedia("(pointer: coarse)").matches) return;
      var open = (window.outerWidth - window.innerWidth > 220) || (window.outerHeight - window.innerHeight > 220 && isFs());
      if (open && !devtoolsOpen) report("devtools", { how: "size" });
      devtoolsOpen = open;
    }, 2000);
    // away too long: one more strike per absence
    setInterval(function () {
      if (!IDLE || awaySince === null || idleSent || !started) return;
      if (Date.now() - awaySince > IDLE * 1000) { idleSent = true; lastEvent = 0; report("idle", { seconds: IDLE }); }
    }, 1000);
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener("keydown", function (e) {
    if (!guard.hidden) {
      if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); resumeFromGuard(); }
      return;
    }
    if (!started) return;
    var k = (e.key || "").toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey;
    if (GUARD) {
      if (e.key === "F12" || (ctrl && e.shiftKey && ["i", "j", "c"].indexOf(k) >= 0) || (ctrl && k === "u")) {
        e.preventDefault(); return report("devtools", { how: "keys" });
      }
      if (ctrl && ["c", "x", "v"].indexOf(k) >= 0) { e.preventDefault(); return report(k === "v" ? "paste" : "copy", { keys: "ctrl+" + k }); }
      if (ctrl && ["p", "s"].indexOf(k) >= 0) { e.preventDefault(); return report("print", { keys: "ctrl+" + k }); }
      if (ctrl && k === "a") { e.preventDefault(); return; }
    }
    if (document.querySelector(".ee-confirm")) return;
    var typing = e.target && (e.target.matches("input[type=text], textarea"));
    if (typing) return;
    if (ctrl || e.altKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); show(cur + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); }
    else if (k === "f") { e.preventDefault(); toggleFlag(); }
    else if (/^[1-6]$/.test(k) || /^[a-e]$/.test(k)) {
      var idx = /^[1-6]$/.test(k) ? parseInt(k, 10) - 1 : "abcde".indexOf(k);
      var inputs = qs[cur].querySelectorAll(".cx-opt input");
      if (inputs[idx]) {
        e.preventDefault();
        inputs[idx].checked = inputs[idx].type === "checkbox" ? !inputs[idx].checked : true;
        queue(qs[cur]);
      }
    }
  });

  // ---------------------------------------------------------------- wiring
  qs.forEach(function (s) {
    s.addEventListener("change", function (e) { if (e.target.matches("input[type=radio], input[type=checkbox]")) queue(s); });
    var t;
    s.addEventListener("input", function (e) {
      if (!e.target.matches("[data-numeric], [data-text]")) return;
      clearTimeout(t); t = setTimeout(function () { queue(s); }, 500);
    });
    s.addEventListener("focusout", function (e) { if (e.target.matches("[data-numeric], [data-text]")) { clearTimeout(t); queue(s); } });
  });
  document.querySelectorAll("[data-prev]").forEach(function (b) { b.addEventListener("click", function () { show(cur - 1); }); });
  document.querySelectorAll("[data-next]").forEach(function (b) { b.addEventListener("click", function () { show(cur + 1); }); });
  document.querySelectorAll("[data-flag]").forEach(function (b) { b.addEventListener("click", toggleFlag); });
  document.querySelectorAll("[data-clear]").forEach(function (b) { b.addEventListener("click", clearAnswer); });
  document.querySelectorAll("[data-submit]").forEach(function (b) { b.addEventListener("click", askSubmit); });
  pal.forEach(function (b) {
    b.addEventListener("click", function () { show(parseInt(b.dataset.goto, 10)); document.body.classList.remove("cx-pal-open"); });
  });
  document.querySelectorAll("[data-palette-open]").forEach(function (b) { b.addEventListener("click", function () { document.body.classList.add("cx-pal-open"); }); });
  document.querySelectorAll("[data-palette-close]").forEach(function (b) { b.addEventListener("click", function () { document.body.classList.remove("cx-pal-open"); }); });

  function resumeFromGuard() {
    hideGuard();
    if (GUARD && fsSupported() && !isFs()) enterFs();
    lastEvent = Date.now();                       // the click itself must not count
    show(cur);
  }
  guard.querySelector("[data-guard-ok]").addEventListener("click", resumeFromGuard);

  var gate = document.getElementById("cx-gate");
  if (GUARD && !fsSupported()) { var note = gate.querySelector("[data-fs-note]"); if (note) note.hidden = false; }
  document.getElementById("cx-go").addEventListener("click", function () {
    if (GUARD && fsSupported()) enterFs();
    setTimeout(function () {
      started = true;
      lastEvent = Date.now();
      gate.hidden = true;
      document.body.classList.add("cx-started");
      var h = qs[cur] && qs[cur].querySelector(".cx-qnum");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }, GUARD ? 350 : 0);
  });

  window.addEventListener("online", function () { setOffline(false); flush(); });
  window.addEventListener("offline", function () { setOffline(true); });
  window.addEventListener("beforeunload", function (e) {
    if (finishing || !started || MODE !== "live") return;
    e.preventDefault(); e.returnValue = "";
  });

  // heartbeat: re-sync the clock, strikes, status (force-submit, extra time) every 15 s
  setInterval(function () {
    if (finishing) return;
    post(D.pingUrl, {}).then(function (d) { if (d._status === 200 || d._status === 409) { setOffline(false); apply(d); flush(); } })
      .catch(function () { setOffline(true); });
  }, 15000);

  // resume: re-apply answers that were waiting on this device
  Object.keys(pending).forEach(function (k) {
    if (k === "__events") return;
    var p = pending[k], s = document.getElementById("q-" + k);
    if (!s) { delete pending[k]; return; }
    if (p.selected) s.querySelectorAll(".cx-opt input").forEach(function (i) { i.checked = p.selected.indexOf(parseInt(i.value, 10)) >= 0; });
    if (p.numeric !== undefined) { var n = s.querySelector("[data-numeric]"); if (n) n.value = p.numeric; }
    if (p.text !== undefined) { var t = s.querySelector("[data-text]"); if (t) t.value = p.text; }
    s.dataset.flagged = p.flagged ? "1" : "0";
    s.dataset.answered = isAnswered(s) ? "1" : "0";
    s.querySelectorAll(".cx-opt").forEach(function (l) { l.classList.toggle("is-sel", l.querySelector("input").checked); });
  });
  persist();

  drawStrikes();
  show(0);
  tick();
  setInterval(tick, 500);
  if (pendingCount()) flush();
  window.EECbt = { report: report, show: show, state: function () { return { cur: cur, strikes: strikes, started: started, pending: pendingCount() }; } };
})();
