/* EE Hub — Manage -> Website behaviour.
   - picture drop zones with preview; multi-photo upload preview
   - markdown editor: formatting buttons + server-rendered preview
   - homepage: page picker only for 'one custom page'; sortable sections */
(function () {
  "use strict";
  var doc = document;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function csrf() { var i = $("input[name=csrfmiddlewaretoken]"); return i ? i.value : ""; }

  /* ---- Drop zones ------------------------------------------------------------ */
  $$("[data-drop]").forEach(function (zone) {
    var input = $("input[type=file]", zone);
    if (!input) return;
    ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function () { zone.classList.remove("is-over"); }); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (zone.hasAttribute("data-multi")) {
        var form = zone.closest("form"), box = $("[data-previews]", form), foot = $("[data-upload-foot]", form), count = $("[data-upload-count]", form);
        box.innerHTML = "";
        files.slice(0, 40).forEach(function (f) {
          var img = doc.createElement("img"); img.alt = ""; img.src = URL.createObjectURL(f); box.appendChild(img);
        });
        box.hidden = !files.length; foot.hidden = !files.length;
        count.textContent = files.length + " photo" + (files.length === 1 ? "" : "s") + " ready to upload";
        return;
      }
      var prev = $(".mg-drop__preview", zone);
      if (prev && files[0]) { prev.src = URL.createObjectURL(files[0]); prev.hidden = false; }
    });
  });

  /* ---- Markdown editor -------------------------------------------------------------- */
  $$("[data-md]").forEach(function (box) {
    var ta = $("textarea", box), pv = $(".mg-md__preview", box);
    if (!ta) return;
    function wrap(token) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e) || "text";
      ta.value = v.slice(0, s) + token + sel + token + v.slice(e);
      ta.focus(); ta.setSelectionRange(s + token.length, s + token.length + sel.length);
    }
    function line(prefix) {
      var s = ta.selectionStart, v = ta.value, start = v.lastIndexOf("\n", s - 1) + 1;
      ta.value = v.slice(0, start) + prefix + v.slice(start);
      ta.focus(); ta.setSelectionRange(s + prefix.length, s + prefix.length);
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-md-wrap")) return wrap(b.getAttribute("data-md-wrap"));
      if (b.hasAttribute("data-md-line")) return line(b.getAttribute("data-md-line"));
      if (b.hasAttribute("data-md-link")) {
        var s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en) || "link text";
        ta.value = ta.value.slice(0, s) + "[" + sel + "](https://)" + ta.value.slice(en); ta.focus(); return;
      }
      if (b.hasAttribute("data-md-mode")) {
        var mode = b.getAttribute("data-md-mode");
        $$("[data-md-mode]", box).forEach(function (x) { x.classList.toggle("is-active", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (mode === "write") { pv.hidden = true; ta.hidden = false; ta.focus(); return; }
        pv.innerHTML = "<p>Loading preview…</p>"; pv.hidden = false; ta.hidden = true;
        var body = new FormData(); body.append("text", ta.value); body.append("csrfmiddlewaretoken", csrf());
        fetch(b.getAttribute("data-preview-url"), { method: "POST", body: body, credentials: "same-origin", headers: { "X-CSRFToken": csrf() } })
          .then(function (r) { return r.text(); })
          .then(function (html) { pv.innerHTML = html || "<p><em>Nothing to preview yet.</em></p>"; })
          .catch(function () { pv.innerHTML = "<p>Preview is not available right now.</p>"; });
      }
    });
  });

  /* ---- Homepage: page picker ------------------------------------------------------------ */
  var pick = $("[data-show-when]");
  if (pick) {
    var sync = function () {
      var cur = $("input[name=mode]:checked");
      pick.hidden = !(cur && cur.value === pick.getAttribute("data-show-when"));
    };
    $$("input[name=mode]").forEach(function (r) { r.addEventListener("change", sync); });
    sync();
  }

  /* ---- Homepage: sortable sections ---------------------------------------------------------- */
  var list = $("[data-sortable]");
  if (list) {
    var dragged = null;
    function renumber() { $$(".mg-sec", list).forEach(function (li, i) { var n = $(".mg-sec__n", li); if (n) n.textContent = i + 1; }); }
    list.addEventListener("dragstart", function (e) {
      var li = e.target.closest(".mg-sec"); if (!li) return;
      if (e.target.closest("input, summary, button")) { e.preventDefault(); return; }
      dragged = li; li.classList.add("is-dragging"); e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", li.getAttribute("data-key")); } catch (err) { /* old browsers */ }
    });
    list.addEventListener("dragend", function () { if (dragged) dragged.classList.remove("is-dragging"); dragged = null; renumber(); });
    list.addEventListener("dragover", function (e) {
      if (!dragged) return;
      e.preventDefault();
      var over = e.target.closest(".mg-sec"); if (!over || over === dragged) return;
      var r = over.getBoundingClientRect();
      list.insertBefore(dragged, (e.clientY - r.top) > r.height / 2 ? over.nextSibling : over);
    });
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-move]"); if (!b) return;
      var li = b.closest(".mg-sec"), dir = +b.getAttribute("data-move");
      if (dir < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      if (dir > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      renumber(); b.focus();
    });
    list.addEventListener("change", function (e) {
      if (e.target.name === "enabled") e.target.closest(".mg-sec").classList.toggle("is-off", !e.target.checked);
    });
  }
})();
