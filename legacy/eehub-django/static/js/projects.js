/* Round 6 final-year projects: the supervisor's small rich-text editor, "add a correction" rows and
   attachment previews. Without JS the page still works: a plain textarea and three correction rows. */
(function () {
  "use strict";

  // ---- rich text editor (contenteditable -> hidden textarea; the server sanitises) ----
  document.querySelectorAll("[data-pj-editor]").forEach(function (box) {
    var area = box.querySelector(".pj-editor__area");
    var src = box.querySelector(".pj-editor__src");
    if (!area || !src || typeof document.execCommand !== "function") return;
    box.classList.add("is-rich");
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* older browsers */ }
    function sync() { src.value = area.innerHTML.trim() === "<br>" ? "" : area.innerHTML; }
    area.addEventListener("input", sync);
    area.addEventListener("paste", function (e) {
      // paste as plain text so Word formatting does not come along
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      if (text) { e.preventDefault(); document.execCommand("insertText", false, text); }
    });
    box.querySelectorAll("[data-cmd]").forEach(function (btn) {
      btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
      btn.addEventListener("click", function () {
        area.focus();
        var cmd = btn.getAttribute("data-cmd"), arg = btn.getAttribute("data-arg") || null;
        if (cmd === "createLink") {
          var selection = window.getSelection();
          var savedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
          if (!window.EEPrompt || typeof window.EEPrompt.open !== "function") {
            console.error("[Projects] Link prompt is unavailable; no link was inserted.");
            return;
          }
          window.EEPrompt.open({
            title: "Insert a link",
            body: "Enter a web or e-mail address to link the selected text.",
            label: "Link address",
            placeholder: "https://… or mailto:…",
            confirmLabel: "Insert link"
          }).then(function (value) {
            if (value === null || value === "") return;
            if (!/^(https?:|mailto:)/i.test(value)) {
              if (window.EEAlert && EEAlert.open) {
                EEAlert.open({ title: "Invalid link", body: "Use an address beginning with https://, http:// or mailto:." })
                  .catch(function (error) { console.error("[Projects] Could not show validation dialog", error); });
              } else {
                console.error("[Projects] Invalid link address:", value);
              }
              return;
            }
            area.focus();
            if (savedRange && selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }
            document.execCommand("createLink", false, value);
            sync();
          }).catch(function (error) { console.error("[Projects] Could not open link prompt", error); });
          return;
        }
        if (cmd === "formatBlock" && arg) {
          var cur = (document.queryCommandValue("formatBlock") || "").toLowerCase();
          arg = cur === arg ? "p" : arg;
          arg = "<" + arg + ">";
        }
        document.execCommand(cmd, false, arg);
        sync();
      });
    });
    function state() {
      box.querySelectorAll("[data-cmd]").forEach(function (b) {
        var c = b.getAttribute("data-cmd");
        if (["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"].indexOf(c) === -1) return;
        try { b.classList.toggle("is-on", document.queryCommandState(c)); } catch (e) { /* ignore */ }
      });
    }
    document.addEventListener("selectionchange", function () { if (document.activeElement === area) state(); });
    var form = box.closest("form");
    if (form) form.addEventListener("submit", sync);
  });

  // ---- numbered corrections: add a row; Enter in a row jumps to (or makes) the next ----
  document.querySelectorAll("[data-pj-review]").forEach(function (form) {
    var list = form.querySelector("[data-pj-items]");
    var add = form.querySelector("[data-pj-add]");
    if (!list || !add) return;
    function addRow(focus) {
      var li = document.createElement("li");
      var input = document.createElement("input");
      input.type = "text"; input.name = "item"; input.maxLength = 2000;
      input.placeholder = "Another correction"; input.setAttribute("aria-label", "Correction");
      li.appendChild(input); list.appendChild(li);
      if (focus) input.focus();
      return input;
    }
    add.addEventListener("click", function () { addRow(true); });
    list.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target.name !== "item") return;
      e.preventDefault();
      var li = e.target.closest("li");
      var next = li && li.nextElementSibling && li.nextElementSibling.querySelector("input");
      (next || addRow(false)).focus();
    });
  });

  // ---- thumbnails for chosen pictures ----
  document.querySelectorAll("input[type=file][data-pj-preview]").forEach(function (input) {
    var out = document.getElementById(input.getAttribute("data-pj-preview"));
    if (!out) return;
    input.addEventListener("change", function () {
      out.innerHTML = "";
      Array.prototype.slice.call(input.files || [], 0, 8).forEach(function (f) {
        var span = document.createElement("span");
        span.className = "pj-thumb" + (/^image\//.test(f.type) ? "" : " pj-thumb--file");
        if (/^image\//.test(f.type) && window.URL) {
          var img = document.createElement("img");
          img.alt = f.name; img.src = URL.createObjectURL(f);
          img.onload = function () { URL.revokeObjectURL(img.src); };
          span.appendChild(img);
        } else {
          var s = document.createElement("small"); s.textContent = f.name; span.appendChild(s);
        }
        out.appendChild(span);
      });
      if ((input.files || []).length > 8) {
        var note = document.createElement("small"); note.className = "pg-muted"; note.textContent = "Only the first 8 are sent.";
        out.appendChild(note);
      }
    });
  });

  // Button-level confirmation (EEConfirm handles form-level data-confirm; these forms have several buttons).
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-confirm]");
    if (!btn || !btn.form || btn.form.hasAttribute("data-confirm") || btn.dataset.confirmed === "1") return;
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[Projects] Confirmation dialog is unavailable; action was not submitted.");
      return;
    }
    e.preventDefault();
    window.EEConfirm.open({ body: btn.dataset.confirm, confirmLabel: btn.dataset.confirmLabel || "Confirm",
                            tone: btn.dataset.confirmTone || "default" }).then(function (ok) {
      if (!ok) return;
      btn.dataset.confirmed = "1";
      if (typeof btn.form.requestSubmit === "function") btn.form.requestSubmit(btn); else btn.click();
      window.setTimeout(function () { delete btn.dataset.confirmed; }, 0);
    }).catch(function (error) { console.error("[Projects] Could not open confirmation dialog", error); });
  }, true);
})();
