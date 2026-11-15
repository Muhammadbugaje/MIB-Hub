/* Round 6 SIWES: small helpers for the applications pages. */
(function () {
  "use strict";
  // Character counter on the application statement.
  document.querySelectorAll("textarea[name=statement][maxlength]").forEach(function (ta) {
    var max = parseInt(ta.getAttribute("maxlength"), 10) || 800;
    var out = document.createElement("small");
    out.className = "pg-muted pg-small";
    out.setAttribute("aria-live", "polite");
    ta.insertAdjacentElement("afterend", out);
    function upd() { out.textContent = ta.value.length + " / " + max; }
    ta.addEventListener("input", upd);
    upd();
  });

  // Button-level confirmation (EEConfirm handles form-level data-confirm; these forms have several buttons).
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-confirm]");
    if (!btn || !btn.form || btn.form.hasAttribute("data-confirm") || btn.dataset.confirmed === "1") return;
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[SIWES] Confirmation dialog is unavailable; action was not submitted.");
      return;
    }
    e.preventDefault();
    window.EEConfirm.open({ body: btn.dataset.confirm, confirmLabel: btn.dataset.confirmLabel || "Confirm",
                            tone: btn.dataset.confirmTone || "default" }).then(function (ok) {
      if (!ok) return;
      btn.dataset.confirmed = "1";
      if (typeof btn.form.requestSubmit === "function") btn.form.requestSubmit(btn); else btn.click();
      window.setTimeout(function () { delete btn.dataset.confirmed; }, 0);
    }).catch(function (error) { console.error("[SIWES] Could not open confirmation dialog", error); });
  }, true);
})();

/* Round 7 (R7W): SIWES profile (autosave, conditions, inputs), the form builder (drag to reorder, type panels), exports. */
(function () {
  "use strict";
  function csrf() {
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    var i = document.querySelector("input[name=csrfmiddlewaretoken]");
    return i ? i.value : "";
  }
  function toast(msg, tone) { if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(tone || "info", msg, ""); }

  // ---- the student's step form ------------------------------------------------
  var form = document.querySelector("form[data-sw-autosave]");
  if (form && !form.hasAttribute("data-readonly")) {
    var url = form.getAttribute("data-sw-autosave"), timer = null, busy = false, dirty = false;
    var saved = document.querySelector("[data-sw-saved]"), prog = document.querySelectorAll("[data-sw-progress]");
    var ring = document.querySelector(".sw-progress .sw-ring");
    function setSaved(t) { if (saved) saved.textContent = t; }
    function save() {
      if (busy) { dirty = true; return; }
      busy = true; dirty = false; setSaved("Saving…");
      var fd = new FormData(form);
      Array.from(form.querySelectorAll("input[type=file]")).forEach(function (f) { fd.delete(f.name); });
      fetch(url, { method: "POST", body: fd, headers: { "X-CSRFToken": csrf(), "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) { setSaved(d.message || "Not saved"); return; }
          setSaved("Saved just now");
          prog.forEach(function (el) { el.textContent = d.progress; });
          if (ring) ring.style.setProperty("--p", d.progress);
        })
        .catch(function () { setSaved("Offline: not saved yet"); })
        .finally(function () { busy = false; if (dirty) schedule(); });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(save, 1200); }
    form.addEventListener("input", function (e) { if (e.target.type !== "file") schedule(); });
    form.addEventListener("change", function (e) { if (e.target.type !== "file") schedule(); applyConditions(); });
    form.addEventListener("submit", function () { clearTimeout(timer); });
    window.addEventListener("beforeunload", function () {
      if (timer && navigator.sendBeacon) { var fd = new FormData(form); fd.append("csrfmiddlewaretoken", csrf());
        Array.from(form.querySelectorAll("input[type=file]")).forEach(function (f) { fd.delete(f.name); }); navigator.sendBeacon(url, fd); }
    });
  }

  // conditions between fields of the same step (the server checks them again)
  function valueOf(root, name) {
    var els = root.querySelectorAll("[name='" + name + "']");
    if (!els.length) return null;
    var out = [];
    els.forEach(function (el) {
      if ((el.type === "radio" || el.type === "checkbox")) { if (el.checked) out.push(el.value); }
      else out.push(el.value);
    });
    return out;
  }
  function applyConditions() {
    if (!form) return;
    form.querySelectorAll("[data-cond-field]").forEach(function (q) {
      var name = q.getAttribute("data-cond-field"), op = q.getAttribute("data-cond-op") || "eq",
          want = (q.getAttribute("data-cond-value") || "").toLowerCase(), have = valueOf(form, name);
      if (have === null) return;               // depends on another step: the server decided
      var vals = have.map(function (v) { return String(v).trim().toLowerCase(); }).filter(Boolean), show;
      if (op === "truthy") show = vals.length > 0;
      else if (op === "falsy") show = vals.length === 0;
      else if (op === "ne") show = vals.indexOf(want) === -1;
      else if (op === "gte") show = vals.length && parseFloat(vals[0]) >= parseFloat(want);
      else show = vals.indexOf(want) !== -1;
      q.hidden = !show;
      q.querySelectorAll("input, select, textarea").forEach(function (el) { el.disabled = !show; });
    });
  }
  applyConditions();

  // digits only for NUBAN / BVN, file names on the drop zones
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.matches && el.matches("[data-sw-digits]")) {
      var n = parseInt(el.getAttribute("data-sw-digits"), 10), v = el.value.replace(/\D/g, "").slice(0, n);
      if (v !== el.value) el.value = v;
    }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.matches && el.matches(".sw-drop input[type=file]")) {
      var b = el.parentElement.querySelector("b");
      if (b && el.files.length) { b.textContent = el.files.length === 1 ? el.files[0].name : el.files.length + " files chosen"; el.parentElement.classList.add("has-file"); }
    }
  });

  // ---- field editor: show the settings for the chosen type ---------------------
  var ff = document.querySelector("form[data-sw-fieldform]");
  if (ff) {
    var sel = ff.querySelector("select[name=type]");
    var sync = function () {
      var t = sel.value;
      ff.querySelectorAll("[data-for]").forEach(function (el) {
        el.hidden = (" " + el.getAttribute("data-for") + " ").indexOf(" " + t + " ") === -1;
      });
    };
    if (sel) { sel.addEventListener("change", sync); sync(); }
  }

  // ---- export: tick all ------------------------------------------------------
  document.querySelectorAll("[data-sw-checkall]").forEach(function (b) {
    b.addEventListener("click", function () {
      var boxes = document.querySelectorAll("input[name='" + b.getAttribute("data-sw-checkall") + "']");
      var all = Array.from(boxes).every(function (x) { return x.checked; });
      boxes.forEach(function (x) { x.checked = !all; });
    });
  });

  // ---- builder: drag the handles to reorder sections and fields -----------------
  var wrap = document.querySelector("[data-sw-sortable]");
  if (wrap) {
    var moveUrl = wrap.getAttribute("data-sw-sortable"), drag = null;
    function itemOf(grip) { return grip.closest(".sw-fld") || grip.closest(".sw-sec"); }
    wrap.addEventListener("pointerdown", function (e) {
      var grip = e.target.closest(".sw-grip");
      if (!grip) return;
      var el = itemOf(grip);
      if (!el) return;
      e.preventDefault();
      drag = { el: el, kind: el.classList.contains("sw-fld") ? "fld" : "sec" };
      el.classList.add("is-dragging");
      grip.setPointerCapture && grip.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var under = document.elementFromPoint(e.clientX, e.clientY);
      if (!under) return;
      if (drag.kind === "fld") {
        var target = under.closest(".sw-fld"), list = under.closest(".sw-flds");
        if (target && target !== drag.el && target.parentElement.matches(".sw-flds")) {
          var r = target.getBoundingClientRect();
          target.parentElement.insertBefore(drag.el, e.clientY < r.top + r.height / 2 ? target : target.nextSibling);
        } else if (list && !list.querySelector(".sw-fld:not(.sw-fld--empty):not(.is-dragging)")) {
          list.appendChild(drag.el);
        }
      } else {
        var sec = under.closest(".sw-sec");
        if (sec && sec !== drag.el) {
          var r2 = sec.getBoundingClientRect();
          wrap.insertBefore(drag.el, e.clientY < r2.top + r2.height / 2 ? sec : sec.nextSibling);
        }
      }
    });
    function finish() {
      if (!drag) return;
      drag.el.classList.remove("is-dragging");
      drag = null;
      var body = { sections: [], fields: {} };
      wrap.querySelectorAll(".sw-sec").forEach(function (s) {
        body.sections.push(s.getAttribute("data-sec"));
        body.fields[s.getAttribute("data-sec")] = Array.from(s.querySelectorAll(".sw-fld[data-fld]")).map(function (f) { return f.getAttribute("data-fld"); });
      });
      fetch(moveUrl, { method: "POST", body: JSON.stringify(body), credentials: "same-origin",
                       headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() } })
        .then(function (r) { return r.json(); })
        .then(function (d) { toast(d.ok ? "Order saved." : "Not saved.", d.ok ? "success" : "error"); })
        .catch(function () { toast("Not saved. Use the arrows instead.", "error"); });
    }
    wrap.addEventListener("pointerup", finish);
    wrap.addEventListener("pointercancel", finish);
  }
})();
