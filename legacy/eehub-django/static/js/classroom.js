/* My class (classroom app): live filters, the classmate picker, assignment form
   toggles, the in-page preview of a submission and the "Suggest a mark" helper. */
(function () {
  "use strict";

  // ---- live filter: <input data-cr-filter=".list li"> (items carry data-name) ----
  document.querySelectorAll("[data-cr-filter]").forEach(function (input) {
    var sel = input.getAttribute("data-cr-filter");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      document.querySelectorAll(sel).forEach(function (li) {
        var name = li.getAttribute("data-name");
        if (name === null) return;
        li.hidden = q !== "" && name.indexOf(q) === -1;
      });
    });
  });

  // ---- classmate picker count ----
  document.querySelectorAll("[data-cr-picker]").forEach(function (form) {
    var out = form.querySelector("[data-cr-picked]");
    function count() {
      var n = form.querySelectorAll('input[name="members"]:checked').length;
      if (out) out.textContent = n + " picked";
    }
    form.addEventListener("change", count);
    count();
  });

  // ---- assignment form: show group / penalty options only when they apply ----
  document.querySelectorAll("[data-cr-asgform]").forEach(function (form) {
    function sync() {
      var mode = form.querySelector('input[name="mode"]:checked');
      var late = form.querySelector('input[name="late_policy"]:checked');
      form.querySelectorAll('[data-cr-when="group"]').forEach(function (el) { el.hidden = !(mode && mode.value === "group"); });
      form.querySelectorAll('[data-cr-when="penalty"]').forEach(function (el) { el.hidden = !(late && late.value === "penalty"); });
    }
    form.addEventListener("change", sync);
    sync();
  });

  // ---- marking: show the first PDF or image inline (same protected download, ?inline=1) ----
  document.querySelectorAll("[data-cr-embed]").forEach(function (box) {
    var url = box.getAttribute("data-cr-embed");
    var name = (box.getAttribute("data-cr-name") || "").toLowerCase();
    if (/\.pdf$/.test(name)) {
      var f = document.createElement("iframe");
      f.src = url; f.title = "Preview of " + name; f.loading = "lazy";
      box.appendChild(f);
    } else if (/\.(png|jpe?g|webp|gif)$/.test(name)) {
      var img = document.createElement("img");
      img.src = url; img.alt = "Submitted image"; img.loading = "lazy";
      box.appendChild(img);
    }
  });

  // ---- "Suggest a mark" (AI). Fills the form; the marker edits and saves. ----
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  document.querySelectorAll("[data-cr-mark]").forEach(function (form) {
    var btn = form.querySelector("[data-cr-suggest]");
    var out = form.querySelector("[data-cr-ai-out]");
    if (!btn || !out) return;
    btn.addEventListener("click", function () {
      var token = form.querySelector('input[name="csrfmiddlewaretoken"]');
      btn.disabled = true;
      var label = btn.innerHTML;
      btn.textContent = "Thinking…";
      fetch(form.getAttribute("data-suggest"), {
        method: "POST", credentials: "same-origin",
        headers: { "X-CSRFToken": token ? token.value : "", "X-Requested-With": "XMLHttpRequest" }
      }).then(function (r) { return r.json(); }).then(function (d) {
        out.hidden = false;
        if (!d.ok) { out.innerHTML = "<b>No suggestion.</b> " + esc(d.error); return; }
        var reasons = (d.reasons || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
        out.innerHTML = "<b>Suggested mark: " + (d.score == null ? "none" : esc(d.score)) + "</b>" +
          (d.feedback ? "<p>" + esc(d.feedback) + "</p>" : "") + (reasons ? "<ul>" + reasons + "</ul>" : "") +
          '<div class="cr-row"><button type="button" class="btn btn-subtle btn-sm" data-cr-use>Use this</button>' +
          '<span class="cr-note">A suggestion only. Check it against the work.</span></div>';
        var use = out.querySelector("[data-cr-use]");
        use.addEventListener("click", function () {
          var sc = form.querySelector('input[name="score"]');
          var fb = form.querySelector('textarea[name="feedback"]');
          if (sc && d.score != null) sc.value = d.score;
          if (fb && d.feedback && !fb.value.trim()) fb.value = d.feedback;
          else if (fb && d.feedback) fb.value = fb.value.trim() + "\n\n" + d.feedback;
          if (sc) sc.focus();
        });
      }).catch(function () {
        out.hidden = false;
        out.textContent = "The AI helper did not answer. Mark this one yourself.";
      }).finally(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  });
})();

/* Round 7 (R7G): tutor requests - Decline asks for a reason first. */
document.addEventListener("click", function (e) {
  var b = e.target.closest("[data-decline-toggle]");
  if (!b) return;
  var f = b.closest("form"), r = f.querySelector("input[name=reason]");
  f.querySelector("[data-decline]").hidden = false;
  f.querySelector("[data-decline-send]").hidden = false;
  b.hidden = true; r.required = true; r.focus();
});
