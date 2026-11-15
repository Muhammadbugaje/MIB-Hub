/* =========================================================================
   Password tools for the sign-in pages (EE Hub, Phase 8 standard)

   - [data-pw-toggle="<input id>"] shows / hides a password field.
   - form[data-pw-form] (first-password page, password change):
       * strength meter [data-pw-meter] (4 bars) + label [data-pw-label]
       * live rule list [data-pw-rules] li[data-rule=length|mix|ident]
       * "they match" hint [data-pw-match]
     Minimum length comes from data-pw-min; the words to avoid (e-mail,
     registration / staff numbers) from <script id="pw-avoid">. The server
     checks every rule again — this is only guidance while typing.
   ========================================================================= */
(function () {
  "use strict";
  if (window.EEPasswordTools) return;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-pw-toggle]");
    if (!btn) return;
    var input = document.getElementById(btn.getAttribute("data-pw-toggle"));
    if (!input) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.classList.toggle("is-shown", show);
    try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); }
    var end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (err) {}
  });

  var LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  var COMMON = /^(password|passw0rd|qwerty|letmein|welcome|admin|abc123|iloveyou|eehub|abu|zaria)/i;

  function avoidList() {
    var el = document.getElementById("pw-avoid");
    if (!el) return [];
    try { return (JSON.parse(el.textContent) || []).map(function (s) { return String(s).toLowerCase(); }); }
    catch (e) { return []; }
  }
  function squash(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function evaluate(pw, min, avoid) {
    var low = pw.toLowerCase(), sq = squash(pw);
    var hasLetter = /[a-z]/i.test(pw), hasDigit = /\d/.test(pw), hasSym = /[^a-z0-9]/i.test(pw);
    var hasUpper = /[A-Z]/.test(pw), hasLower = /[a-z]/.test(pw);
    var identHit = avoid.some(function (a) {
      return a && (low.indexOf(a) !== -1 || (squash(a).length >= 4 && sq.indexOf(squash(a)) !== -1));
    });
    var rules = {
      length: pw.length >= min,
      mix: hasLetter && (hasDigit || hasSym),
      ident: pw.length > 0 && !identHit
    };
    var score = 0;
    if (pw.length) {
      var variety = [hasLower, hasUpper, hasDigit, hasSym].filter(Boolean).length;
      score = 0;
      if (pw.length >= min) score += 1;
      if (pw.length >= min + 4) score += 1;
      if (variety >= 3) score += 1;
      if (variety === 4 || pw.length >= 16) score += 1;
      if (!rules.length || !rules.mix) score = Math.min(score, 1);
      if (identHit || COMMON.test(pw) || /(.)\1{3,}/.test(pw) || /^\d+$/.test(pw)) score = Math.min(score, 1);
      if (pw.length < 4) score = 0;
    }
    return { rules: rules, score: score };
  }

  function init(form) {
    var min = parseInt(form.getAttribute("data-pw-min"), 10) || 10;
    var avoid = avoidList();
    var pw = form.querySelector("[data-pw-new], input[name=new_password1]");
    var again = form.querySelector("[data-pw-confirm], input[name=new_password2]");
    var meter = form.querySelector("[data-pw-meter]");
    var label = form.querySelector("[data-pw-label]");
    var match = form.querySelector("[data-pw-match]");
    var rules = form.querySelector("[data-pw-rules]") || document.querySelector("[data-pw-rules]");
    if (!pw) return;

    function update() {
      var r = evaluate(pw.value, min, avoid);
      if (meter) meter.setAttribute("data-score", pw.value ? String(Math.max(1, r.score)) : "0");
      if (label) {
        label.textContent = pw.value ? "Strength: " + LABELS[r.score] : "Strength shows as you type";
        label.setAttribute("data-score", pw.value ? String(r.score) : "");
      }
      if (rules) {
        Object.keys(r.rules).forEach(function (k) {
          var li = rules.querySelector('[data-rule="' + k + '"]');
          if (!li) return;
          li.classList.toggle("is-met", !!pw.value && r.rules[k]);
          li.classList.toggle("is-unmet", !!pw.value && !r.rules[k]);
        });
      }
      if (match && again) {
        if (!again.value) { match.textContent = ""; match.className = "pw-match"; }
        else if (again.value === pw.value) { match.textContent = "Both passwords match"; match.className = "pw-match is-ok"; }
        else if (pw.value.indexOf(again.value) === 0) { match.textContent = ""; match.className = "pw-match"; }
        else { match.textContent = "These don't match yet"; match.className = "pw-match is-bad"; }
      }
    }
    pw.addEventListener("input", update);
    if (again) again.addEventListener("input", update);
    update();

    form.addEventListener("submit", function () {
      var btn = form.querySelector("[data-pw-submit]");
      if (btn) { btn.disabled = true; btn.classList.add("is-busy"); }
    });
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-pw-form]"), init);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.EEPasswordTools = { evaluate: evaluate };
})();
