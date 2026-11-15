/* EE Hub — custom course page behaviour (templates/academics/public/course_page.html):
   - KaTeX: display equations ([data-tex]) and inline \( … \) maths in the worked example
   - reveal-on-scroll for sections ([data-reveal]); the donut and timeline animate in
   - copy button and light MATLAB syntax colouring for code blocks
   - "Show the solution": reveals the steps one by one
   The on-page navigation highlight, materials filter and prerequisite wires come from handbook.js. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || root.getAttribute("data-motion") === "reduce";
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  /* ---- maths ---------------------------------------------------------------- */
  function maths() {
    if (!window.katex) return;
    $$("[data-tex]").forEach(function (el) {
      try { window.katex.render(el.getAttribute("data-tex"), el, { displayMode: true, throwOnError: false, strict: "ignore" }); el.classList.add("is-tex"); }
      catch (e) { /* leave the TeX source visible */ }
    });
    if (window.renderMathInElement) {
      // inline \( … \) maths anywhere on the page: stats, notes, captions, the worked example
      $$(".cp").forEach(function (el) {
        window.renderMathInElement(el, { delimiters: [{ left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: true }], throwOnError: false, strict: "ignore" });
      });
    }
  }

  /* ---- reveal ---------------------------------------------------------------- */
  function reveal() {
    var els = $$("[data-reveal]");
    if (!els.length) return;
    root.classList.add("cp-js");
    if (reduce || doc.querySelector("[data-no-reveal]") || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-in"); }); return; }
    var vh = window.innerHeight;
    els.forEach(function (e) { if (e.getBoundingClientRect().top < vh * 0.9) e.classList.add("is-in"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    els.forEach(function (e) { if (!e.classList.contains("is-in")) io.observe(e); });
    // safety net: never leave content hidden (e.g. printing, odd scroll containers)
    setTimeout(function () { els.forEach(function (e) { e.classList.add("is-in"); }); }, 6000);
    window.addEventListener("beforeprint", function () { els.forEach(function (e) { e.classList.add("is-in"); }); });
  }

  /* ---- code blocks ---------------------------------------------------------- */
  var KW = /\b(function|end|for|while|if|elseif|else|break|return|switch|case|otherwise|try|catch)\b/g;
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function colour(src) {
    return src.split("\n").map(function (line) {
      var ci = -1, inStr = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === "'" && !(i > 0 && /[\w)\]\.]/.test(line[i - 1]) && !inStr)) inStr = !inStr;
        else if (ch === "%" && !inStr) { ci = i; break; }
      }
      var code = ci >= 0 ? line.slice(0, ci) : line, com = ci >= 0 ? line.slice(ci) : "";
      var parts = code.split(/('(?:[^'\n]|'')*')/g).map(function (p, j) {
        if (j % 2 === 1) return '<span class="t-str">' + esc(p) + "</span>";
        return esc(p).replace(KW, '<span class="t-kw">$1</span>').replace(/\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b/g, '<span class="t-num">$1</span>');
      }).join("");
      return parts + (com ? '<span class="t-com">' + esc(com) + "</span>" : "");
    }).join("\n");
  }
  function code() {
    $$("[data-code]").forEach(function (box) {
      var el = box.querySelector("pre code");
      if (!el) return;
      var src = el.textContent;
      if (el.className.indexOf("lang-matlab") >= 0) el.innerHTML = colour(src);
      var btn = box.querySelector("[data-copy]");
      if (btn) btn.addEventListener("click", function () {
        var done = function () { var s = btn.querySelector("span"); if (s) { s.textContent = "Copied"; setTimeout(function () { s.textContent = "Copy"; }, 1600); } };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(src).then(done, function () {});
        else { var ta = doc.createElement("textarea"); ta.value = src; doc.body.appendChild(ta); ta.select(); try { doc.execCommand("copy"); done(); } catch (e) {} ta.remove(); }
      });
    });
  }

  /* ---- worked example: steps appear one after another ---------------------- */
  function example() {
    $$("[data-ex]").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        $$(".cp-ex__steps li, .cp-ex__ans", d).forEach(function (li, i) {
          li.classList.remove("is-shown");
          if (reduce) { li.classList.add("is-shown"); return; }
          setTimeout(function () { li.classList.add("is-shown"); }, 120 + i * 260);
        });
      });
    });
  }

  function start() { maths(); reveal(); code(); example(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
