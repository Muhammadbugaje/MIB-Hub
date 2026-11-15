/* EE Hub — in-place section editor for course study pages (K11). Editors only.
   Reads the section schema (#kp-schema, knowledge/sections.py SCHEMA), loads the section JSON,
   renders a form (scalar fields + repeatable rows with add / move / remove), previews LaTeX live
   and saves the whole section in one POST. Every save is a revision that can be restored. */
(function () {
  "use strict";
  var doc = document;
  var sheet = doc.getElementById("kp-sheet-edit"), schemaEl = doc.getElementById("kp-schema");
  if (!sheet || !schemaEl) return;
  var SCHEMA = JSON.parse(schemaEl.textContent || "{}");
  var body = sheet.querySelector("[data-editor-body]"), title = sheet.querySelector("[data-edit-title]");
  var editUrl = sheet.getAttribute("data-edit-url"), histUrl = sheet.getAttribute("data-history-url");
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function csrf() { var m = doc.cookie.match(/(?:^|; )csrftoken=([^;]+)/); if (m) return decodeURIComponent(m[1]); var i = $("input[name=csrfmiddlewaretoken]"); return i ? i.value : ""; }
  var uid = 0;

  function fieldHtml(f, v) {
    var id = "kpe-" + (++uid), lab = '<label for="' + id + '">' + esc(f.label) + "</label>", val = v == null ? "" : v;
    if (f.type === "bool") return '<label class="kp-check"><input type="checkbox" id="' + id + '" data-name="' + f.name + '"' + (v ? " checked" : "") + "><span>" + esc(f.label) + "</span></label>";
    if (f.type === "select") return '<div class="kp-field">' + lab + '<select id="' + id + '" data-name="' + f.name + '">' + f.choices.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (String(c[0]) === String(val) ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("") + "</select></div>";
    if (f.type === "lines") return '<div class="kp-field">' + lab + '<textarea id="' + id + '" rows="4" data-name="' + f.name + '" data-type="lines">' + esc((val || []).join ? val.join("\n") : val) + "</textarea></div>";
    if (f.type === "paras") return '<div class="kp-field">' + lab + '<textarea id="' + id + '" rows="6" data-name="' + f.name + '" data-type="paras">' + esc((val || []).join ? val.join("\n\n") : val) + "</textarea></div>";
    if (f.type === "json") return '<div class="kp-field">' + lab + '<textarea id="' + id + '" rows="3" class="hb-mono" spellcheck="false" data-name="' + f.name + '" data-type="json">' + esc(typeof val === "string" ? val : JSON.stringify(val || {})) + "</textarea></div>";
    if (f.type === "markdown") return '<div class="kp-field">' + lab + '<textarea id="' + id + '" rows="3" data-name="' + f.name + '">' + esc(val) + "</textarea></div>";
    if (f.type === "latex") return '<div class="kp-field">' + lab + '<textarea id="' + id + '" rows="2" class="hb-mono" spellcheck="false" data-name="' + f.name + '" data-latex>' + esc(val) + '</textarea><div class="kpe-preview" aria-live="polite"></div></div>';
    var type = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text";
    return '<div class="kp-field">' + lab + '<input id="' + id + '" type="' + type + '" data-name="' + f.name + '" value="' + esc(val) + '"></div>';
  }
  function rowHtml(list, row) {
    return '<fieldset class="kpe-row"><div class="kpe-row__bar"><span class="kpe-row__n"></span><div class="btn-group">' +
      '<button type="button" class="kp-ibtn" data-up aria-label="Move up">↑</button><button type="button" class="kp-ibtn" data-down aria-label="Move down">↓</button>' +
      '<button type="button" class="kp-ibtn" data-del aria-label="Remove row">×</button></div></div><div class="kpe-row__fields">' +
      list.row.map(function (f) { return fieldHtml(f, row ? row[f.name] : (f.type === "bool" ? (f.name === "is_visible") : "")); }).join("") + "</div></fieldset>";
  }
  function number(listEl) { $$(".kpe-row", listEl).forEach(function (r, i) { $(".kpe-row__n", r).textContent = "#" + (i + 1); }); }
  function preview(ta) {
    var p = ta.nextElementSibling; if (!p || !window.katex) return;
    try { window.katex.render(ta.value || "\\;", p, { displayMode: true, throwOnError: true, strict: "ignore" }); p.classList.remove("is-err"); }
    catch (e) { p.textContent = e.message; p.classList.add("is-err"); }
  }

  function render(section, data) {
    var sch = SCHEMA[section];
    var html = '<form class="kpe" data-section="' + section + '">';
    html += sch.fields.map(function (f) { return fieldHtml(f, data[f.name]); }).join("");
    sch.lists.forEach(function (l) {
      html += '<div class="kpe-list" data-list="' + l.name + '"><h3 class="kp-h3">' + esc(l.label) + ' <small class="kp-muted">' + (data[l.name] || []).length + "</small></h3><div class=\"kpe-rows\">" +
        (data[l.name] || []).map(function (r) { return rowHtml(l, r); }).join("") + '</div><button type="button" class="pub-btn pub-btn--ghost pub-btn--sm" data-add>+ Add</button></div>';
    });
    html += '<div class="kp-field"><label for="kpe-note">What did you change? (optional, kept in the history)</label><input id="kpe-note" type="text" maxlength="200" data-note></div>';
    html += '<p class="kpe-err" role="alert" hidden></p><div class="kpe-foot btn-group"><button type="submit" class="pub-btn pub-btn--primary">Save section</button><button type="button" class="pub-btn pub-btn--ghost" data-kp-close>Cancel</button></div></form>';
    body.innerHTML = html;
    var form = $("form", body);
    $$(".kpe-rows", form).forEach(number);
    $$("[data-latex]", form).forEach(preview);
    form.addEventListener("input", function (e) { if (e.target.hasAttribute("data-latex")) preview(e.target); });
    form.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var listEl = b.closest(".kpe-list"), row = b.closest(".kpe-row");
      if (b.hasAttribute("data-add")) {
        var l = sch.lists.filter(function (x) { return x.name === listEl.getAttribute("data-list"); })[0];
        var rows = $(".kpe-rows", listEl); rows.insertAdjacentHTML("beforeend", rowHtml(l, null)); number(rows);
        var last = rows.lastElementChild; var f = $("input, textarea", last); if (f) f.focus();
        $$("[data-latex]", last).forEach(preview);
      } else if (b.hasAttribute("data-del") && row) {
        if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
          console.error("[Knowledge editor] Confirmation dialog is unavailable; row was not removed.");
          return;
        }
        window.EEConfirm.open({
          title: "Remove this row?",
          body: "You can restore it from the history after saving.",
          confirmLabel: "Remove row",
          tone: "danger"
        }).then(function (confirmed) {
          if (confirmed && row.isConnected) { var rs = row.parentNode; row.remove(); number(rs); }
        }).catch(function (error) { console.error("[Knowledge editor] Could not open confirmation dialog", error); });
      } else if (b.hasAttribute("data-up") && row && row.previousElementSibling) { row.parentNode.insertBefore(row, row.previousElementSibling); number(row.parentNode); }
      else if (b.hasAttribute("data-down") && row && row.nextElementSibling) { row.parentNode.insertBefore(row.nextElementSibling, row); number(row.parentNode); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $(".kpe-err", form); err.hidden = true;
      try { var out = collect(form, sch); } catch (ex) { err.textContent = ex.message; err.hidden = false; return; }
      var btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "Saving…";
      fetch(editUrl.replace("SECTION", section), { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf(), "X-Requested-With": "fetch" },
        body: JSON.stringify({ data: out, note: ($("[data-note]", form) || {}).value || "" }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok) { location.reload(); return; }
          err.textContent = j.error || "Could not save. Check the fields and try again."; err.hidden = false; btn.disabled = false; btn.textContent = "Save section";
        }).catch(function () { err.textContent = "Network problem — nothing was saved."; err.hidden = false; btn.disabled = false; btn.textContent = "Save section"; });
    });
  }
  function readField(el) {
    var t = el.getAttribute("data-type");
    if (el.type === "checkbox") return el.checked;
    if (t === "lines") return el.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    if (t === "paras") return el.value.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (t === "json") { try { return JSON.parse(el.value || "{}"); } catch (e) { throw new Error("Settings must be valid JSON, e.g. {\"fx\": \"torque\"}."); } }
    return el.value;
  }
  function collect(form, sch) {
    var out = {};
    sch.fields.forEach(function (f) { var el = $('.kpe > .kp-field [data-name="' + f.name + '"], .kpe > .kp-check [data-name="' + f.name + '"]', form); if (el) out[f.name] = readField(el); });
    sch.lists.forEach(function (l) {
      out[l.name] = $$('.kpe-list[data-list="' + l.name + '"] .kpe-row', form).map(function (r) {
        var o = {}; $$("[data-name]", r).forEach(function (el) { o[el.getAttribute("data-name")] = readField(el); }); return o;
      });
    });
    return out;
  }

  doc.addEventListener("click", function (e) {
    var b = e.target.closest("[data-kp-edit]");
    if (b) {
      var section = b.getAttribute("data-kp-edit");
      title.textContent = "Edit · " + b.getAttribute("data-label");
      body.innerHTML = '<p class="kp-muted">Loading…</p>';
      window.KPSheet.open("kp-sheet-edit");
      fetch(editUrl.replace("SECTION", section), { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); }).then(function (j) { render(section, j.data || {}); })
        .catch(function () { body.innerHTML = '<p class="kpe-err">Could not load the section.</p>'; });
      return;
    }
    var h = e.target.closest("[data-kp-history]");
    if (h) {
      title.textContent = "History · " + h.getAttribute("data-label");
      body.innerHTML = '<p class="kp-muted">Loading…</p>';
      window.KPSheet.open("kp-sheet-edit");
      fetch(histUrl.replace("SECTION", h.getAttribute("data-kp-history")), { credentials: "same-origin" })
        .then(function (r) { return r.text(); }).then(function (t) { body.innerHTML = t; })
        .catch(function () { body.innerHTML = '<p class="kpe-err">Could not load the history.</p>'; });
    }
  });
})();
