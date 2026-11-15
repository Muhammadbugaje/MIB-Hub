/* EE Hub — system pages (settings, branding, file manager, notifications,
   profile). One file, each part starts only when its page is present. */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(type, title, msg) {
    if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(type, title, msg || "", { duration: 4500 });
  }
  function confirmDialog(opts) {
    if (window.EEConfirm && EEConfirm.open) return EEConfirm.open(opts);
    return Promise.reject(new Error("The shared confirmation dialog is unavailable."));
  }

  /* ------------------------------------------------------------------
     Toasts sent by the server in HX-Trigger: {"eeToast": {type, title}}
     ------------------------------------------------------------------ */
  document.body.addEventListener("eeToast", function (e) {
    var d = e.detail || {};
    toast(d.type || "info", d.title || "", d.message || "");
  });

  /* ==================================================================
     SETTINGS HUB
     ================================================================== */
  function initSettings() {
    var page = $("[data-settings-page]");
    if (!page) return;
    var saveAll = $("[data-save-all]", page);
    var saveAllLabel = $("[data-save-all-label]", page);

    function originalOf(el) {
      if (!el.hasAttribute("data-original")) el.setAttribute("data-original", el.value);
      return el.getAttribute("data-original");
    }
    function rowDirty(row) {
      return $$("[data-dirty-watch]", row).some(function (el) { return el.value !== originalOf(el); });
    }
    function refreshCounts() {
      var dirtyRows = $$("[data-setting-row].is-dirty", page);
      if (saveAll) {
        saveAll.hidden = dirtyRows.length === 0;
        if (saveAllLabel) saveAllLabel.textContent = "Save " + dirtyRows.length + " change" + (dirtyRows.length === 1 ? "" : "s");
      }
      $$("[data-save-section]", page).forEach(function (btn) {
        var sec = document.getElementById(btn.getAttribute("data-save-section"));
        btn.hidden = !sec || !$("[data-setting-row].is-dirty", sec);
      });
    }
    function markRow(row) {
      var dirty = rowDirty(row);
      row.classList.toggle("is-dirty", dirty);
      var badge = $("[data-edited-badge]", row);
      if (badge) badge.hidden = !dirty;
      refreshCounts();
    }
    function wireRow(row) {
      $$("[data-dirty-watch]", row).forEach(function (el) { originalOf(el); });
      // colour picker <-> text box
      $$("[data-colour-for]", row).forEach(function (picker) {
        var text = document.getElementById(picker.getAttribute("data-colour-for"));
        if (!text) return;
        picker.addEventListener("input", function () { text.value = picker.value; markRow(row); });
        text.addEventListener("input", function () { if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value; });
      });
      // switch label follows the switch
      $$(".sh-switch input[type=checkbox]", row).forEach(function (cb) {
        cb.addEventListener("change", function () {
          var lbl = cb.parentNode.querySelector(".sh-switch__label");
          if (lbl) lbl.textContent = cb.checked ? "On" : "Off";
        });
      });
    }
    $$("[data-setting-row]", page).forEach(wireRow);

    page.addEventListener("input", function (e) {
      var row = e.target.closest && e.target.closest("[data-setting-row]");
      if (row && e.target.hasAttribute("data-dirty-watch")) markRow(row);
    });
    page.addEventListener("change", function (e) {
      var row = e.target.closest && e.target.closest("[data-setting-row]");
      if (row && e.target.hasAttribute("data-dirty-watch")) markRow(row);
    });
    // Escape reverts a row
    page.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var row = e.target.closest && e.target.closest("[data-setting-row]");
      if (!row || !e.target.hasAttribute("data-dirty-watch")) return;
      e.target.value = originalOf(e.target);
      markRow(row);
    });

    // JSON must parse before it is sent
    document.body.addEventListener("htmx:confirm", function (e) {
      var form = e.target;
      if (!form.matches || !form.matches("[data-setting-row]")) return;
      var json = $("[data-json]", form);
      if (!json) return;
      try { if (json.value.trim()) JSON.parse(json.value); }
      catch (err) {
        e.preventDefault();
        toast("error", "That is not valid JSON", String(err.message || err));
        json.focus();
      }
    });
    // After a row is swapped in: re-wire, flash, update counters
    document.body.addEventListener("htmx:afterSwap", function (e) {
      var row = e.detail && e.detail.target;
      if (!row || !row.matches || !row.matches("[data-setting-row]")) return;
      var fresh = document.getElementById(row.id) || row;
      wireRow(fresh);
      if (!fresh.classList.contains("has-error")) {
        fresh.classList.add("is-saved");
        setTimeout(function () { fresh.classList.remove("is-saved"); }, 1400);
      }
      applySearch();
      refreshCounts();
    });

    function submitRows(rows) {
      rows.forEach(function (row) {
        if (window.htmx) window.htmx.trigger(row, "submit");
        else row.submit();
      });
    }
    if (saveAll) saveAll.addEventListener("click", function () { submitRows($$("[data-setting-row].is-dirty", page)); });
    $$("[data-save-section]", page).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sec = document.getElementById(btn.getAttribute("data-save-section"));
        if (sec) submitRows($$("[data-setting-row].is-dirty", sec));
      });
    });
    window.addEventListener("beforeunload", function (e) {
      if ($("[data-setting-row].is-dirty", page)) { e.preventDefault(); e.returnValue = ""; }
    });

    // ---- Search across labels / keys / descriptions ----
    var search = $("[data-settings-search]", page);
    var countEl = $("[data-settings-count]", page);
    var none = $("[data-settings-noresults]", page);
    function applySearch() {
      if (!search) return;
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      $$("[data-settings-section]", page).forEach(function (sec) {
        var any = 0;
        $$("[data-setting-row]", sec).forEach(function (row) {
          var hit = !q || (row.getAttribute("data-search") || "").indexOf(q) !== -1;
          row.classList.toggle("is-hidden", !hit);
          if (hit) any++;
        });
        sec.classList.toggle("is-hidden", q && !any);
        var link = $('[data-nav-for="' + sec.id + '"]', page);
        if (link) link.classList.toggle("is-hidden", !!q && !any);
        shown += any;
      });
      if (countEl) countEl.textContent = q ? shown + " match" + (shown === 1 ? "" : "es") : "";
      if (none) none.hidden = !(q && shown === 0);
    }
    if (search) {
      search.addEventListener("input", applySearch);
      var form = $("[data-settings-search-form]", page);
      if (form) form.addEventListener("submit", function (e) { e.preventDefault(); applySearch(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "/" && !/input|textarea|select/i.test((document.activeElement || {}).tagName || "")) {
          e.preventDefault(); search.focus();
        }
      });
    }

    // ---- Highlight the section in view ----
    var links = $$("[data-sh-nav] a", page);
    if ("IntersectionObserver" in window && links.length) {
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove("is-active"); });
          var a = byId[en.target.id];
          if (a) {
            a.classList.add("is-active");
            if (window.innerWidth < 1100) a.parentNode.parentNode.scrollLeft = a.parentNode.offsetLeft - 16;
          }
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    }
    refreshCounts();
  }

  /* ==================================================================
     BRANDING — hover preview + upload preview
     ================================================================== */
  function initBranding() {
    var page = $("[data-branding-page]");
    if (!page) return;
    var saved = {};
    $$("[data-preview]", page).forEach(function (el) { saved[el.getAttribute("data-preview")] = el.innerHTML; });

    function show(slot, html) {
      var targets = $$('[data-preview="' + slot + '"]', page);
      if (slot === "primary") targets = targets.concat($$('[data-preview="favicon"]', page));
      targets.forEach(function (t) { t.innerHTML = html; t.classList.add("is-previewing"); });
    }
    function restore() {
      $$("[data-preview]", page).forEach(function (t) {
        t.innerHTML = saved[t.getAttribute("data-preview")];
        t.classList.remove("is-previewing");
      });
    }
    $$("[data-slot-pick]", page).forEach(function (btn) {
      var card = btn.closest("[data-logo-card]");
      var tpl = card && $("template[data-logo-small]", card);
      if (!tpl) return;
      var enter = function () { show(btn.getAttribute("data-slot-pick"), tpl.innerHTML); };
      btn.addEventListener("mouseenter", enter);
      btn.addEventListener("focus", enter);
      btn.addEventListener("mouseleave", restore);
      btn.addEventListener("blur", restore);
      btn.closest("form").addEventListener("submit", function () { btn.disabled = true; btn.textContent = "Applying…"; });
    });

    var drop = $("[data-drop]", page);
    if (drop) {
      var input = $("[data-drop-input]", drop);
      var label = $("[data-drop-label]", drop);
      var preview = $("[data-drop-preview]", drop);
      ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.add("is-over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-over"); }); });
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        if (!f) return;
        label.textContent = f.name + " · " + Math.max(1, Math.round(f.size / 1024)) + " KB";
        if (f.size > 2 * 1024 * 1024) toast("error", "That file is over 2 MB", "Choose a smaller logo.");
        var url = URL.createObjectURL(f);
        preview.innerHTML = "";
        var img = document.createElement("img");
        img.alt = "";
        img.src = url;
        preview.appendChild(img);
        preview.hidden = false;
        var name = $("#logo-name");
        if (name && !name.value) name.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      });
    }
  }

  /* ==================================================================
     FILE MANAGER — streaming orphan scan (ported from NBTE)
     ================================================================== */
  function initFiles() {
    var form = $("[data-scan-form]");
    if (!form) return;

    // ---- selection ----
    var master = $("[data-check-all]");
    var counter = $("[data-selected-count]");
    var body = $("[data-scan-results-body]");
    function rows() { return body ? $$("[data-check-row]", body) : []; }
    function refreshCount() {
      var list = rows();
      var selected = list.filter(function (r) { return r.checked; }).length;
      if (counter) counter.textContent = String(selected);
      if (master) {
        master.indeterminate = selected > 0 && selected < list.length;
        master.checked = list.length > 0 && selected === list.length;
      }
    }
    if (master) master.addEventListener("change", function () { rows().forEach(function (r) { r.checked = master.checked; }); refreshCount(); });
    if (body) body.addEventListener("change", function (e) { if (e.target.matches("[data-check-row]")) refreshCount(); });
    refreshCount();

    // ---- streaming scan ----
    var streamUrl = form.getAttribute("data-scan-stream-url");
    var button = $("[data-scan-button]", form);
    var label = $("[data-scan-label]", form);
    var progress = $("[data-scan-progress]");
    var phaseEl = $("[data-scan-phase]");
    var bar = $("[data-scan-bar]");
    var scannedEl = $("[data-scan-scanned]");
    var ofEl = $("[data-scan-of]");
    var foundEl = $("[data-scan-found]");
    var foundSuffixEl = $("[data-scan-found-suffix]");
    var currentEl = $("[data-scan-current]");
    var resultsSection = $("[data-scan-results-section]");
    var resultsEmpty = $("[data-scan-results-empty]");
    var resultsForm = $("[data-scan-results-form]");
    var resultsHeading = $("[data-scan-results-heading]");
    var foundCount = 0, total = 0, es = null;

    function setPhase(t) { if (phaseEl) phaseEl.textContent = t; }
    function setBar(p) { if (bar) bar.style.width = Math.max(0, Math.min(100, p)) + "%"; }
    function setScanned(n, of) { if (scannedEl) scannedEl.textContent = String(n); if (ofEl) ofEl.textContent = of ? "of " + of : ""; }
    function setFound(n) { foundCount = n; if (foundEl) foundEl.textContent = String(n); if (foundSuffixEl) foundSuffixEl.textContent = n === 1 ? "" : "s"; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function makeRow(o) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="files-cell-check"><input type="checkbox" name="rel" value="' + esc(o.rel) + '" data-check-row aria-label="Select ' + esc(o.rel) + '">' +
        '<input type="hidden" name="kind" value="' + esc(o.kind) + '"></td>' +
        '<td class="files-cell-file"><code>' + esc(o.rel) + "</code>" + (o.is_variant ? '<span class="files-tag">variant</span>' : "") + "</td>" +
        '<td><span class="files-pill files-pill-' + esc(o.kind) + '">' + esc(o.kind) + "</span></td>" +
        '<td class="files-cell-num">' + esc(o.size_h || "") + "</td>" +
        '<td class="files-cell-age">' + esc(o.age_h || "") + "</td>";
      return tr;
    }
    function emptyHtml() {
      return '<div class="files-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        "<h3>Everything is accounted for</h3><p>Every file on disk belongs to a record.</p></div>";
    }
    function resetUI() {
      setFound(0); total = 0; setScanned(0, 0); setBar(0);
      if (currentEl) currentEl.textContent = "";
      if (body) body.innerHTML = "";
      if (resultsForm) resultsForm.hidden = true;
      if (resultsEmpty) resultsEmpty.hidden = true;
      if (resultsSection) resultsSection.hidden = false;
      if (progress) progress.hidden = false;
    }
    function busy(on) { if (button) button.disabled = on; if (label) label.textContent = on ? "Scanning…" : "Re-scan"; }
    function finish(summary) {
      busy(false); setPhase("Scan complete."); setBar(100);
      if (summary && resultsHeading) {
        resultsHeading.textContent = summary.orphan_count === 0 ? "No orphaned files"
          : summary.orphan_count + " orphan" + (summary.orphan_count === 1 ? "" : "s") + " · " + (summary.orphan_bytes_h || "");
        resultsHeading.hidden = false;
      }
      if (foundCount > 0) { if (resultsForm) resultsForm.hidden = false; }
      else if (resultsEmpty) { resultsEmpty.hidden = false; resultsEmpty.innerHTML = emptyHtml(); }
      refreshCount();
      toast(foundCount ? "warn" : "success", foundCount ? foundCount + " orphaned file" + (foundCount === 1 ? "" : "s") + " found" : "No orphaned files", summary && summary.truncated ? "The scan hit the file limit; results are partial." : "");
    }
    function start() {
      if (es) { try { es.close(); } catch (e) {} }
      resetUI(); busy(true); setPhase("Starting…");
      es = new EventSource(streamUrl);
      es.addEventListener("phase", function (e) {
        var d = JSON.parse(e.data);
        setPhase({ counting: "Counting files…", indexing: "Building the reference index…", scanning: "Scanning files…" }[d.phase] || "Working…");
      });
      es.addEventListener("counted", function (e) { total = JSON.parse(e.data).total || 0; setScanned(0, total); });
      es.addEventListener("indexed", function (e) { setPhase("Scanning " + total + " files… (" + JSON.parse(e.data).refs + " in use)"); });
      es.addEventListener("progress", function (e) {
        var d = JSON.parse(e.data);
        setScanned(d.scanned, d.total);
        if (d.total > 0) setBar(d.scanned / d.total * 100);
        if (currentEl) currentEl.textContent = d.current || "";
      });
      es.addEventListener("found", function (e) {
        var d = JSON.parse(e.data);
        setFound(foundCount + 1);
        setScanned(d.scanned, d.total);
        if (d.total > 0) setBar(d.scanned / d.total * 100);
        if (currentEl) currentEl.textContent = d.orphan.rel || "";
        if (resultsEmpty) resultsEmpty.hidden = true;
        if (resultsForm) resultsForm.hidden = false;
        if (body) body.appendChild(makeRow(d.orphan));
        refreshCount();
      });
      es.addEventListener("done", function (e) {
        var d = JSON.parse(e.data);
        try { es.close(); } catch (err) {}
        es = null;
        finish(d.summary);
      });
      es.addEventListener("error", function (e) {
        try { es.close(); } catch (err) {}
        es = null; busy(false);
        var msg = "Scan failed.";
        try { var d = JSON.parse(e.data || "{}"); if (d.message) msg = d.message; } catch (err) {}
        setPhase("Error: " + msg);
        toast("error", "The scan could not finish", msg);
      });
    }
    form.addEventListener("submit", function (e) {
      if (typeof EventSource === "undefined") return; // no-JS style fallback: plain POST
      e.preventDefault();
      start();
    });
    window.addEventListener("beforeunload", function () { if (es) { try { es.close(); } catch (err) {} } });

    // ---- confirmations for destructive actions ----
    function wire(f, build) {
      if (!f) return;
      f.addEventListener("submit", function (e) {
        if (f.dataset.confirmed === "1") { delete f.dataset.confirmed; return; }
        e.preventDefault();
        var opts = build();
        if (!opts) { toast("info", "Tick at least one file first"); return; }
        confirmDialog(opts).then(function (ok) {
          if (!ok) return;
          f.dataset.confirmed = "1";
          f.submit();
        }).catch(function (error) {
          console.error("[System] Could not open confirmation dialog", error);
          toast("error", "Could not open confirmation", "Please reload the page and try again.");
        });
      });
    }
    wire(resultsForm, function () {
      var n = resultsForm.querySelectorAll("[data-check-row]:checked").length;
      if (!n) return null;
      return { title: "Delete " + n + " file" + (n === 1 ? "" : "s") + "?",
               body: "This permanently removes " + (n === 1 ? "the selected file" : "the selected files") + " from disk. It cannot be undone.",
               confirmLabel: "Delete", cancelLabel: "Keep them", tone: "danger" };
    });
    var purge = document.getElementById("purge-form");
    wire(purge, function () {
      var trigger = document.querySelector('[form="purge-form"]');
      var txt = trigger ? (trigger.textContent || "").trim() : "";
      return { title: "Auto-purge orphaned files?",
               body: "Every orphaned file older than the configured age will be permanently deleted from disk." + (txt ? " (" + txt + ")" : ""),
               confirmLabel: "Purge", cancelLabel: "Cancel", tone: "danger" };
    });
  }

  /* ==================================================================
     NOTIFICATIONS — keep the active tab in step with htmx swaps
     ================================================================== */
  function initNotifications() {
    var tabs = $$("[data-notif-tab]");
    if (!tabs.length) return;
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        var hidden = document.querySelector('.notif-search input[name="filter"]');
        var m = /filter=(\w+)/.exec(t.getAttribute("href") || "");
        if (hidden && m) hidden.value = m[1];
      });
    });
  }

  /* ==================================================================
     PROFILE — apply saved preferences to this device
     ================================================================== */
  function initProfile() {
    var page = $("[data-profile-page]");
    if (!page) return;
    var form = $("[data-prefs-form]", page);
    if (form) {
      form.addEventListener("submit", function () { try { sessionStorage.setItem("ee-apply-prefs", "1"); } catch (e) {} });
      $$(".sh-switch input", form).forEach(function (cb) {
        cb.addEventListener("change", function () {
          var l = cb.parentNode.querySelector(".sh-switch__label");
          if (l) l.textContent = cb.checked ? "On" : "Off";
        });
      });
    }
    var apply = false;
    try { apply = sessionStorage.getItem("ee-apply-prefs") === "1"; sessionStorage.removeItem("ee-apply-prefs"); } catch (e) {}
    if (!apply) return;
    var theme = page.getAttribute("data-user-theme");
    var motion = page.getAttribute("data-user-motion");
    var html = document.documentElement;
    try {
      var os = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      if (theme === "light" || theme === "dark") {
        localStorage.setItem("ee-theme", theme);
        localStorage.setItem("ee-theme-os", os);
        html.setAttribute("data-theme", theme);
      } else {
        localStorage.removeItem("ee-theme");
        localStorage.removeItem("ee-theme-os");
        html.setAttribute("data-theme", os);
      }
      if (motion === "reduce") { localStorage.setItem("ee-motion", "reduce"); html.setAttribute("data-motion", "reduce"); }
      else { localStorage.removeItem("ee-motion"); html.removeAttribute("data-motion"); }
      window.dispatchEvent(new CustomEvent("theme:change", { detail: { theme: html.getAttribute("data-theme") } }));
    } catch (e) { /* storage blocked: the server copy still applies next time */ }
  }

  function boot() {
    initSettings();
    initBranding();
    initFiles();
    initNotifications();
    initProfile();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
