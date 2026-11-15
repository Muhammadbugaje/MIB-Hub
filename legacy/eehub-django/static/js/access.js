/* People and access: pickers, matrix toasts, profile form, appoint picker. */
(function () {
  "use strict";

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(type, title, body) {
    if (window.EE && EE.Toast) EE.Toast.push(type || "info", title || "", body || "");
  }

  // ---- HTMX toasts sent as HX-Trigger: {"accessToast": {...}} -------------------
  document.body.addEventListener("accessToast", function (e) {
    var d = e.detail || {};
    toast(d.type, d.title, d.body);
  });
  document.body.addEventListener("htmx:responseError", function (e) {
    var el = e.detail && e.detail.elt;
    if (el && el.closest && el.closest(".acc-page")) {
      toast("error", "That did not work", e.detail.xhr && e.detail.xhr.status === 403 ? "You do not have permission." : "Please try again.");
    }
  });

  // ---- Auto-submit filters ----------------------------------------------------------
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.matches && el.matches("[data-autosubmit]") && el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
  });

  // ---- Permission picker --------------------------------------------------------------
  function initPicker(root) {
    var total = root.querySelector("[data-picker-total]");
    function syncGroup(g) {
      var boxes = $all('input[name="perms"]', g);
      var on = boxes.filter(function (b) { return b.checked; }).length;
      var cnt = g.querySelector("[data-group-count]");
      if (cnt) cnt.textContent = on;
      var all = g.querySelector("[data-group-all]");
      if (all) { all.checked = on === boxes.length && on > 0; all.indeterminate = on > 0 && on < boxes.length; }
    }
    function syncAll() {
      $all("[data-picker-group]", root).forEach(syncGroup);
      if (total) total.textContent = $all('input[name="perms"]:checked', root).length;
    }
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.matches("[data-group-all]")) {
        var g = t.closest("[data-picker-group]");
        $all('[data-picker-item]:not([hidden]) input[name="perms"]', g).forEach(function (b) { b.checked = t.checked; });
      }
      syncAll();
    });
    var search = root.querySelector("[data-picker-search]");
    if (search) {
      search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase();
        var any = false;
        $all("[data-picker-group]", root).forEach(function (g) {
          var shown = 0;
          $all("[data-picker-item]", g).forEach(function (li) {
            var hit = !q || li.getAttribute("data-search").indexOf(q) !== -1;
            li.hidden = !hit;
            if (hit) shown++;
          });
          g.hidden = shown === 0;
          if (q && shown) g.open = true;
          if (shown) any = true;
        });
        var none = root.querySelector("[data-picker-none]");
        if (none) none.hidden = any;
      });
      search.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
    }
    var exp = root.querySelector("[data-picker-expand]");
    if (exp) exp.addEventListener("click", function () {
      var groups = $all("[data-picker-group]", root);
      var open = groups.some(function (g) { return !g.open; });
      groups.forEach(function (g) { g.open = open; });
      exp.textContent = open ? "Close all" : "Open all";
    });
    syncAll();
  }

  // ---- Widget picker (order = DOM order of checked boxes) -----------------------------
  function initWidgets(root) {
    var list = root.querySelector("[data-widget-list]");
    if (!list) return;
    var dragging = null;
    function sync() {
      $all("[data-widget-item]", list).forEach(function (li) {
        li.classList.toggle("is-on", li.querySelector('input[name="widgets"]').checked);
      });
    }
    list.addEventListener("change", sync);
    list.addEventListener("click", function (e) {
      var up = e.target.closest("[data-widget-up]"), down = e.target.closest("[data-widget-down]");
      if (!up && !down) return;
      var li = e.target.closest("[data-widget-item]");
      if (up && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      if (down && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      (up || down).focus();
    });
    list.addEventListener("dragstart", function (e) {
      dragging = e.target.closest("[data-widget-item]");
      if (!dragging) return;
      dragging.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", ""); } catch (err) {}
    });
    list.addEventListener("dragover", function (e) {
      if (!dragging) return;
      e.preventDefault();
      var over = e.target.closest("[data-widget-item]");
      $all(".is-over", list).forEach(function (x) { x.classList.remove("is-over"); });
      if (over && over !== dragging) over.classList.add("is-over");
    });
    list.addEventListener("drop", function (e) {
      if (!dragging) return;
      e.preventDefault();
      var over = e.target.closest("[data-widget-item]");
      if (over && over !== dragging) {
        var rect = over.getBoundingClientRect();
        list.insertBefore(dragging, e.clientY > rect.top + rect.height / 2 ? over.nextElementSibling : over);
      }
    });
    list.addEventListener("dragend", function () {
      if (dragging) dragging.classList.remove("is-dragging");
      $all(".is-over", list).forEach(function (x) { x.classList.remove("is-over"); });
      dragging = null;
    });
    sync();
  }

  // ---- Profile fields: show what fits the chosen kind; filter levels by programme --------
  function initProfileForm(form) {
    var kind = form.querySelector('select[name$="kind"]');
    var prog = form.querySelector('select[name$="programme"]');
    var level = form.querySelector("[data-level-select]");
    function showKind() {
      var k = kind ? kind.value : "";
      $all("[data-kind-show]", form).forEach(function (el) {
        el.hidden = !k || el.getAttribute("data-kind-show").split(" ").indexOf(k) === -1;
      });
    }
    function filterLevels() {
      if (!level || !prog) return;
      var p = prog.value;
      $all("option[data-programme]", level).forEach(function (o) {
        var ok = !p || o.getAttribute("data-programme") === p;
        o.hidden = !ok; o.disabled = !ok;
        if (!ok && o.selected) level.value = "";
      });
    }
    if (kind) kind.addEventListener("change", showKind);
    if (prog) prog.addEventListener("change", filterLevels);
    showKind(); filterLevels();

    // Live registration-number check against the formats.
    var reg = form.querySelector('input[name$="reg_number"]');
    var live = form.querySelector("#regno-live");
    var url = form.getAttribute("data-identify-url") || "/access/regno/preview/";
    var timer = null;
    if (reg && live && window.fetch) {
      reg.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var v = reg.value.trim();
          if (!v) return;
          fetch(url + "?mode=identify&test=" + encodeURIComponent(v), { headers: { "HX-Request": "true" }, credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (html) {
              if (!html) return;
              var box = live.querySelector("[data-live-result]");
              if (!box) { box = document.createElement("div"); box.setAttribute("data-live-result", ""); live.appendChild(box); }
              box.innerHTML = html;
              // Pick the programme for the user when the format names one.
            })
            .catch(function () {});
        }, 250);
      });
    }
  }

  // ---- Appoint: choose a person from search results ----------------------------------------
  function initAppoint(form) {
    var hidden = form.querySelector('input[name="person"]');
    var chosen = form.querySelector("[data-chosen]");
    var search = form.querySelector("[data-person-search]");
    var kindSel = form.querySelector('select[name="profile_kind"]');
    var officeKind = form.getAttribute("data-office-kind");
    form.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick-person]");
      if (b) {
        hidden.value = b.getAttribute("data-pick-person");
        chosen.querySelector("[data-chosen-name]").textContent = b.getAttribute("data-name");
        chosen.querySelector("[data-chosen-meta]").textContent = b.getAttribute("data-email") || "";
        var ini = b.querySelector(".avatar");
        chosen.querySelector("[data-chosen-initials]").textContent = ini ? ini.textContent : "";
        chosen.hidden = false; search.hidden = true;
        var kinds = (b.getAttribute("data-kinds") || "").split(",").filter(Boolean);
        if (kindSel && officeKind === "any" && kinds.length && kinds.indexOf(kindSel.value) === -1) kindSel.value = kinds[0];
        return;
      }
      if (e.target.closest("[data-chosen-clear]")) {
        hidden.value = ""; chosen.hidden = true; search.hidden = false;
        var input = search.querySelector("input");
        if (input) input.focus();
      }
    });
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.matches('input[type="search"]')) e.preventDefault();
    });
  }

  // ---- Reset password: show the field only for "I will type one" ------------------------------
  function initResetPw() {
    var field = document.querySelector("[data-pw-field]");
    if (!field) return;
    $all("[data-pw-method]").forEach(function (r) {
      r.addEventListener("change", function () {
        var set = document.querySelector('[data-pw-method][value="set"]').checked;
        field.hidden = !set;
        var input = field.querySelector("input");
        input.required = set;
        if (set) input.focus();
      });
    });
  }

  // ---- Office editor: live icon / colour preview ------------------------------------------------
  function initOfficePreview() {
    var preview = document.querySelector("[data-icon-preview]");
    if (!preview) return;
    var head = document.querySelector("[data-office-preview-icon]");
    $all('input[name="color"]').forEach(function (r) {
      r.addEventListener("change", function () {
        [preview, head].forEach(function (el) {
          if (!el) return;
          el.className = el.className.replace(/tone-\w+/, "tone-" + r.value);
        });
      });
    });
  }

  // ---- Registration-number editor: manual pattern toggle ----------------------------------------
  function initRegno() {
    var toggle = document.querySelector("[data-auto-toggle]");
    var manual = document.querySelector("[data-manual-pattern]");
    if (!toggle || !manual) return;
    toggle.addEventListener("change", function () {
      manual.hidden = toggle.checked;
      if (!toggle.checked) {
        var input = manual.querySelector("input");
        var code = document.querySelector("#regno-preview .acc-rx__code code");
        if (input && !input.value && code) input.value = code.textContent.trim();
      }
    });
  }

  // ---- Import: show the chosen file name -------------------------------------------------------
  function initDrop() {
    $all("[data-drop]").forEach(function (drop) {
      var input = drop.querySelector('input[type="file"]');
      var name = drop.querySelector("[data-drop-name]");
      input.addEventListener("change", function () { if (input.files[0] && name) name.textContent = input.files[0].name; });
      ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.add("is-over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-over"); }); });
    });
  }

  function init() {
    $all("[data-perm-picker]").forEach(initPicker);
    $all("[data-widget-picker]").forEach(initWidgets);
    $all("[data-profile-form]").forEach(initProfileForm);
    $all("[data-appoint-form]").forEach(initAppoint);
    initResetPw(); initOfficePreview(); initRegno(); initDrop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
