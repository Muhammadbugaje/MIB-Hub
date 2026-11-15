/* MATLAB Academy page behaviour: renders a lesson from its Markdown, the "Try it yourself" code boxes, the code
   stepper, exercises that check themselves, quizzes, real-MATLAB task checklists and browser-side progress. */
(function () {
  "use strict";
  var L = window.MLLesson, esc = L.esc;
  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    step: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 5v14l9-7z" fill="currentColor"/><rect x="16.5" y="5" width="2.5" height="14" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M18 5v14l-9-7z" fill="currentColor"/><rect x="5" y="5" width="2.5" height="14" fill="currentColor"/></svg>'
  };
  var MATLAB_ONLINE = "https://matlab.mathworks.com", OCTAVE_ONLINE = "https://octave-online.net";
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function btn(cls, html, title) { var b = el("button", "mla-btn " + (cls || ""), html); b.type = "button"; if (title) b.title = title; return b; }

  /* ---------- progress (this browser only) ---------- */
  var KEY = "ee-matlab-progress";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  var P = load(); P.done = P.done || {}; P.ex = P.ex || {}; P.quiz = P.quiz || {}; P.task = P.task || {};
  function mark(kind, id, val) { P[kind][id] = val === undefined ? Date.now() : val; save(P); paintProgress(); }
  function paintProgress() {
    [].forEach.call(document.querySelectorAll("[data-mla-link]"), function (a) { a.classList.toggle("is-done", !!P.done[a.getAttribute("data-mla-link")]); });
    [].forEach.call(document.querySelectorAll("[data-mla-track-progress]"), function (box) {
      var slug = box.getAttribute("data-mla-track-progress"), total = +box.getAttribute("data-total") || 0, n = 0;
      Object.keys(P.done).forEach(function (k) { if (k.indexOf(slug + "/") === 0) n++; });
      n = Math.min(n, total); var bar = box.querySelector("i"), lab = box.querySelector(":scope > span:last-child") || box.querySelector("span");
      if (bar) bar.style.width = (total ? Math.round(n / total * 100) : 0) + "%"; if (lab) lab.textContent = n ? n + " of " + total + " lessons done" : total + " lessons";
    });
    [].forEach.call(document.querySelectorAll("[data-mla-ring]"), function (ring) {
      var slug = ring.getAttribute("data-mla-ring"), total = +ring.getAttribute("data-total") || 0, n = 0;
      Object.keys(P.done).forEach(function (k) { if (k.indexOf(slug + "/") === 0) n++; });
      var pct = total ? Math.min(100, Math.round(n / total * 100)) : 0, arc = ring.querySelectorAll("circle")[1];
      if (arc) arc.setAttribute("stroke-dasharray", pct + " 100"); ring.classList.toggle("is-full", pct >= 100); ring.classList.toggle("is-some", pct > 0 && pct < 100);
    });
    var all = document.querySelector("[data-mla-total-progress]");
    if (all) { var t = +all.getAttribute("data-total") || 0, d = Math.min(t, Object.keys(P.done).length); all.textContent = d ? d + " of " + t + " lessons completed on this device" : ""; }
    var done = document.querySelector("[data-mla-complete]");
    if (done) { var id = done.getAttribute("data-mla-complete"), on = !!P.done[id]; done.classList.toggle("is-done", on); done.querySelector("span").textContent = on ? "Lesson completed" : "Mark lesson as complete"; done.setAttribute("aria-pressed", on); }
  }

  /* ---------- syntax highlighting ---------- */
  var KWS = /^(if|elseif|else|end|for|while|switch|case|otherwise|break|continue|return|function|try|catch|global|persistent)$/;
  function hl(code) {
    var out = "", i = 0, n = code.length, prevVal = false, depth = 0;
    while (i < n) {
      var ch = code[i], m;
      if (ch === "%") { var e = code.indexOf("\n", i); if (e < 0) e = n; out += '<span class="tk-c">' + esc(code.slice(i, e)) + "</span>"; i = e; prevVal = false; continue; }
      if (ch === "\n") { out += "\n"; i++; prevVal = false; continue; }
      if (ch === '"' || (ch === "'" && !(prevVal && !(depth > 0 && /\s/.test(code[i - 1] || ""))))) {
        var j = i + 1; while (j < n && code[j] !== "\n") { if (code[j] === ch) { if (code[j + 1] === ch) { j += 2; continue; } break; } j++; }
        out += '<span class="tk-s">' + esc(code.slice(i, Math.min(n, j + 1))) + "</span>"; i = Math.min(n, j + 1); prevVal = true; continue;
      }
      if ((m = /^[A-Za-z]\w*/.exec(code.slice(i, i + 64)))) { var w = m[0]; out += KWS.test(w) && !(w === "end" && depth > 0) ? '<span class="tk-k">' + w + "</span>" : esc(w); i += w.length; prevVal = !KWS.test(w) || w === "end"; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?[ij]?/.exec(code.slice(i, i + 40)))) { out += '<span class="tk-n">' + m[0] + "</span>"; i += m[0].length; prevVal = true; continue; }
      if (ch === "(" || ch === "[" || ch === "{") depth++; else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
      if (ch === "." && code.substr(i, 3) === "...") { var e2 = code.indexOf("\n", i); if (e2 < 0) e2 = n; out += '<span class="tk-c">' + esc(code.slice(i, e2)) + "</span>"; i = e2; continue; }
      out += esc(ch); if (!/\s/.test(ch)) prevVal = ch === ")" || ch === "]" || ch === "}" || ch === "'"; i++;
    }
    return out;
  }

  /* ---------- editor: a textarea over a highlighted <pre> ---------- */
  function editor(code, opts) {
    opts = opts || {};
    var wrap = el("div", "mla-ed"), pre = el("pre", "mla-ed__hl"), ta = el("textarea", "mla-ed__ta"), gut = el("div", "mla-ed__ln"), gutN = 0; gut.setAttribute("aria-hidden", "true");
    pre.setAttribute("aria-hidden", "true"); ta.spellcheck = false; ta.autocapitalize = "off"; ta.autocomplete = "off"; ta.setAttribute("autocorrect", "off"); ta.setAttribute("aria-label", opts.label || "MATLAB code editor"); ta.wrap = "off";
    function paint() { pre.innerHTML = hl(ta.value) + "\n"; var lines = ta.value.split("\n").length; if (lines !== gutN) { gutN = lines; var g = ""; for (var q = 1; q <= lines; q++) g += q + "\n"; gut.textContent = g; } wrap.style.setProperty("--lines", Math.max(opts.minLines || 1, Math.min(opts.maxLines || 28, lines))); }
    ta.value = code; paint();
    ta.addEventListener("input", paint);
    ta.addEventListener("scroll", function () { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.style.transform = "translateY(" + (-ta.scrollTop) + "px)"; });
    ta.addEventListener("focus", function () { wrap.classList.add("is-focus"); }); ta.addEventListener("blur", function () { wrap.classList.remove("is-focus"); });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; paint(); }
      else if (e.key === "Escape") ta.blur();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && opts.onRun) { e.preventDefault(); opts.onRun(); }
      else if (e.key === "Enter" && !e.shiftKey) { var st = ta.selectionStart, ls = ta.value.lastIndexOf("\n", st - 1) + 1, ind = /^[ \t]*/.exec(ta.value.slice(ls, st))[0], line = ta.value.slice(ls, st); if (/^\s*(if|for|while|switch|function|try|else|elseif|case|otherwise|catch)\b/.test(line) && !/\bend\s*;?\s*$/.test(line)) ind += "    "; if (ind) { e.preventDefault(); ta.value = ta.value.slice(0, st) + "\n" + ind + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = st + 1 + ind.length; paint(); } }
    });
    wrap.appendChild(gut); wrap.appendChild(pre); wrap.appendChild(ta);
    return { el: wrap, get: function () { return ta.value; }, set: function (v) { ta.value = v; paint(); }, focus: function () { ta.focus(); }, ta: ta };
  }
  function copyText(text, b) { function ok() { var old = b.innerHTML; b.innerHTML = ICON.check + "<span>Copied</span>"; setTimeout(function () { b.innerHTML = old; }, 1400); } if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback(); function fallback() { var t = el("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); ok(); } catch (e) {} t.remove(); } }
  function realLinks() { return '<a class="mla-link" href="' + MATLAB_ONLINE + '" target="_blank" rel="noopener noreferrer">MATLAB Online ' + ICON.ext + '</a><a class="mla-link" href="' + OCTAVE_ONLINE + '" target="_blank" rel="noopener noreferrer">Octave Online ' + ICON.ext + "</a>"; }

  /* ---------- running code ---------- */
  function runCode(code, inputs) {
    var opts = { maxMs: 3500 };
    if (inputs && inputs.length) opts.inputs = inputs.slice();
    opts.onInput = function (prompt) { return window.prompt(prompt || "Enter a value:"); };
    try { return window.MLab.run(code, opts); }
    catch (e) { return { output: "", error: { message: "The runner hit an internal problem with this code (" + (e && e.message ? e.message : e) + "). Please run it in real MATLAB and report this lesson to the page editor." , internal: true }, figures: [], vars: {} }; }
  }
  var TIPS = [
    [/Incorrect dimensions for matrix multiplication|raising a matrix to a power/, "you probably want the element-wise operator. Put a dot before it: <code>.*</code>, <code>./</code> or <code>.^</code>."],
    [/Arrays have incompatible sizes/, "the two arrays have different lengths. Check each with <code>size(x)</code>; a row and a column of the same length also expand to a matrix, so make both rows (or both columns)."],
    [/Unrecognized function or variable '(\w+)'/, "<code>$1</code> does not exist at this point. Check the spelling and capital letters, and that the line that creates it runs before this one."],
    [/Index exceeds the number of array elements|exceeds array bounds/, "you asked for an element past the end. Use <code>numel(x)</code> or <code>end</code>, and check loop limits such as <code>for k = 1:numel(x)</code>."],
    [/Array indices must be positive integers|MATLAB counts from 1/, "MATLAB indexes from 1. A loop that starts at 0 needs <code>x(k+1)</code>, and an index must be a whole number."],
    [/Dimensions of arrays being concatenated/, "every row inside <code>[ ]</code> needs the same number of elements. Check for a missing value or a stray space before a minus sign."],
    [/has no matching 'end'|incomplete or incorrect/, "count your <code>end</code> statements and brackets: every <code>if</code>, <code>for</code>, <code>while</code>, <code>switch</code> and <code>function</code> needs one <code>end</code>."],
    [/Not enough input arguments/, "the function was called with fewer inputs than it uses. Check the call against the function line."],
    [/Too many (input|output) arguments/, "compare the call with the first line of the function: it lists how many inputs and outputs exist."],
    [/Vectors must be the same length/, "<code>x</code> and <code>y</code> in <code>plot(x, y)</code> need the same number of points. Compute <code>y</code> from the same <code>x</code> vector."],
    [/left side|Incorrect use of '='/, "use <code>==</code> to compare and <code>=</code> to assign; the left of <code>=</code> must be a variable name."],
    [/ran for too long|infinite loop/, "make sure something inside the <code>while</code> loop changes the condition, or add a counter and <code>break</code>."],
    [/Unrecognized field name/, "check the field spelling with <code>fieldnames(s)</code>."],
    [/Undefined function '(\w+)' for input arguments of type '(\w+)'/, "<code>$1</code> does not work on a <code>$2</code>. Convert it first (for example <code>str2double</code> for text, <code>c{k}</code> to get a cell's content)."],
    [/Brace indexing is not supported/, "use round brackets <code>( )</code> for ordinary arrays; curly braces are only for cell arrays."],
    [/Unable to find (or open|file)/, "the file is not in this page's memory. Write it first (for example with <code>writematrix</code> or <code>fopen(name, 'w')</code>) or use a sample file: <code>readings.csv</code>, <code>students.csv</code>, <code>data.txt</code>, <code>notes.txt</code>."]
  ];
  function tip(msg) { for (var i = 0; i < TIPS.length; i++) { var m = TIPS[i][0].exec(msg); if (m) return TIPS[i][1].replace(/\$(\d)/g, function (q, k) { return esc(m[+k] || ""); }); } return ""; }
  function download(name, content) { var a = el("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function showResult(box, r) {
    box.innerHTML = ""; box.hidden = false;
    var any = false;
    if (r.output) { var pre = el("pre", "mla-out__text"); pre.textContent = r.output.replace(/\n+$/, "\n"); box.appendChild(pre); any = true; }
    (r.figures || []).forEach(function (f, i) { var fig = el("figure", "mla-out__fig"); try { fig.innerHTML = window.MLab.plotSVG(f, { uid: "f" + Date.now() + i }); } catch (e) { fig.textContent = "The figure could not be drawn in the browser (" + e.message + "). Run this plot in real MATLAB."; } box.appendChild(fig); any = true; });
    if (r.error) {
      var real = r.error.identifier === "EEHub:realMatlabOnly", inp = r.error.identifier === "EEHub:input";
      var eb = el("div", "mla-out__err" + (real || inp ? " is-real" : ""));
      eb.innerHTML = "<strong>" + (real ? "This one needs real MATLAB" : inp ? "Waiting for input" : r.error.fatal ? "Stopped" : "Error" + (r.error.line ? " (line " + r.error.line + ")" : "")) + "</strong><pre></pre>" + (real ? '<p class="mla-out__go">' + realLinks() + "</p>" : "");
      eb.querySelector("pre").textContent = r.error.message; var fix = tip(r.error.message); if (fix && !real && !inp) { var tp = el("p", "mla-out__tip", "<b>Usual fix:</b> " + fix); eb.appendChild(tp); } box.appendChild(eb); any = true;
    }
    if (!any) { box.appendChild(el("p", "mla-out__none", "Ran with no output. Remove a semicolon <code>;</code> at the end of a line to see its value, or use <code>disp</code>.")); }
  }
  function inputsFrom(field) { return field && field.value.trim() ? field.value.split(/[\n,]/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; }) : []; }
  function inputField(code, preset) { if (!/\binput\s*\(/.test(code) && !preset) return null; var w = el("label", "mla-inputs", '<span>Input values <small>(what you would type at each <code>input</code> prompt, separated by commas)</small></span><input type="text" inputmode="text" autocomplete="off">'); w.querySelector("input").value = preset || ""; return w; }

  /* The result area under an editor: Command Window, Figure and Workspace tabs, and a status line.
     It is always on the page (with a hint before the first run), so pressing Run does not push the lesson down. */
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || "");
  function runHint() { return "<kbd>" + (MAC ? "⌘" : "Ctrl") + " ↵</kbd>"; }
  function resultPanel(hint) {
    var wrap = el("div", "mla-res"), tabs = el("div", "mla-res__tabs"), body = el("div", "mla-res__body"), status = el("span", "mla-res__status"), panes = {}, btns = {}, has = {};
    tabs.setAttribute("role", "tablist"); status.setAttribute("role", "status");
    [["cw", "Command Window"], ["fig", "Figure"], ["ws", "Workspace"]].forEach(function (n) {
      var b = el("button", "mla-res__tab", "<span>" + n[1] + "</span><i></i>"), p = el("div", "mla-res__pane mla-out"); b.type = "button"; b.setAttribute("role", "tab"); p.setAttribute("role", "tabpanel"); p.setAttribute("aria-label", n[1]);
      b.addEventListener("click", function () { view([n[0]]); }); tabs.appendChild(b); body.appendChild(p); panes[n[0]] = p; btns[n[0]] = b;
    });
    tabs.appendChild(status); wrap.appendChild(tabs); wrap.appendChild(body); panes.cw.setAttribute("aria-live", "polite");
    function view(on) { Object.keys(panes).forEach(function (k) { var y = on.indexOf(k) >= 0; panes[k].hidden = !y; btns[k].setAttribute("aria-selected", y); }); body.classList.toggle("is-both", on.length > 1); }
    function idle() { panes.cw.innerHTML = '<p class="mla-out__none">' + (hint || "Press Run to see the Command Window here.") + "</p>"; panes.fig.innerHTML = '<p class="mla-out__none">No figure yet. A <code>plot</code> command draws one here.</p>'; panes.ws.innerHTML = '<p class="mla-out__none">No variables yet.</p>'; btns.fig.querySelector("i").textContent = ""; btns.ws.querySelector("i").textContent = ""; status.textContent = ""; wrap.removeAttribute("data-state"); view(["cw"]); }
    function busy() { wrap.setAttribute("data-state", "run"); status.textContent = "Running…"; }
    function set(r, ms) {
      var figs = (r.figures || []).slice(), txt = { output: r.output, error: r.error, figures: [] }; showResult(panes.cw, txt);
      if (!r.output && !r.error && figs.length) panes.cw.innerHTML = '<p class="mla-out__none">No text output. The plot is in the Figure tab.</p>';
      panes.fig.innerHTML = ""; if (figs.length) showResult(panes.fig, { output: "", figures: figs }); else panes.fig.innerHTML = '<p class="mla-out__none">This code did not draw a figure.</p>';
      var names = Object.keys(r.vars || {}).sort(), _ = window.MLab._;
      panes.ws.innerHTML = names.length ? "<table class='mla-table mla-table--ws'><thead><tr><th>Name</th><th>Value</th><th>Size</th><th>Class</th></tr></thead><tbody>" + names.map(function (n) { var v = r.vars[n], sz = v.t === "m" || v.t === "c" || v.t === "sa" ? v.r + "×" + v.c : "1×1", b; try { b = _.brief(v); } catch (e) { b = ""; } return "<tr><td><code>" + esc(n) + "</code></td><td>" + esc(b) + "</td><td>" + sz + "</td><td>" + esc(_.className(v)) + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="mla-out__none">No variables yet.</p>';
      btns.fig.querySelector("i").textContent = figs.length || ""; btns.ws.querySelector("i").textContent = names.length || "";
      has = { fig: figs.length > 0, text: !!(r.output || r.error) };
      view(r.error ? ["cw"] : has.fig && has.text ? ["cw", "fig"] : has.fig ? ["fig"] : ["cw"]);
      var real = r.error && (r.error.identifier === "EEHub:realMatlabOnly" || r.error.identifier === "EEHub:input");
      wrap.setAttribute("data-state", r.error ? (real ? "real" : "err") : "ok");
      status.textContent = r.error ? (real ? "Needs real MATLAB" : "Error" + (r.error.line ? " on line " + r.error.line : "")) : "Ran" + (ms !== undefined ? " in " + Math.max(1, Math.round(ms)) + " ms" : "");
    }
    idle();
    return { el: wrap, set: set, idle: idle, busy: busy };
  }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }

  function codeBox(code, flags) {
    var norun = !!flags.norun, box = el("div", "mla-code" + (norun ? " mla-code--static" : ""));
    var head = el("div", "mla-code__head"), title = el("span", "mla-code__title", norun ? "MATLAB code <em>run this one in real MATLAB</em>" : (flags.title ? esc(String(flags.title).replace(/_/g, " ")) : "Try it yourself") + " <em>edit the code, then run it</em>");
    head.appendChild(title); box.appendChild(head);
    if (norun) {
      var pre = el("pre", "mla-code__static"); pre.innerHTML = hl(code); box.appendChild(pre);
      var bar = el("div", "mla-code__bar"), c = btn("mla-btn--ghost", ICON.copy + "<span>Copy</span>"); c.addEventListener("click", function () { copyText(code, c); });
      bar.appendChild(c); if (flags.file) { var dl = btn("mla-btn--go", "<span>Download " + esc(String(flags.file)) + "</span>"); dl.addEventListener("click", function () { download(String(flags.file), code + "\n"); }); bar.insertBefore(dl, c); title.innerHTML = "Starter file <em>" + esc(String(flags.file)) + "</em>"; }
      var links = el("span", "mla-code__links", realLinks()); bar.appendChild(links); box.appendChild(bar);
      return box;
    }
    var res = resultPanel();
    var ed = editor(code, { onRun: run }), bar2 = el("div", "mla-code__bar"), go = btn("mla-btn--go", ICON.play + "<span>Run</span>" + runHint(), "Run (Ctrl+Enter)"), rs = btn("mla-btn--ghost", ICON.reset + "<span>Reset</span>"), cp = btn("mla-btn--ghost", ICON.copy + "<span>Copy</span>");
    var inp = inputField(code, flags.input ? String(flags.input).replace(/\|/g, ", ") : "");
    function run() { go.disabled = true; res.busy(); setTimeout(function () { var t0 = now(), r = runCode(ed.get(), inputsFrom(inp && inp.querySelector("input"))); res.set(r, now() - t0); go.disabled = false; }, 15); }
    box.run = run;
    go.addEventListener("click", run); rs.addEventListener("click", function () { ed.set(code); res.idle(); }); cp.addEventListener("click", function () { copyText(ed.get(), cp); });
    bar2.appendChild(go); bar2.appendChild(rs); bar2.appendChild(cp); bar2.appendChild(el("span", "mla-code__links", realLinks()));
    box.appendChild(ed.el); if (inp) box.appendChild(inp); box.appendChild(bar2); box.appendChild(res.el);
    return box;
  }

  /* ---------- code stepper: watch the code run line by line ---------- */
  function tracer(code, flags) {
    var box = el("div", "mla-trace"), steps = [], I = new window.MLab.Interp({ maxMs: 2500 }), lines = code.split("\n"), brief = window.MLab._.brief;
    function snap(env) { var o = []; Object.keys(env.vars).forEach(function (k) { var v = env.vars[k], s; try { s = v.t === "m" && v.r * v.c > 12 ? "[" + v.r + "×" + v.c + " " + window.MLab._.className(v) + "]" : v.t === "m" && v.r > 1 ? matBrief(v) : brief(v); } catch (e) { s = "…"; } o.push([k, s]); }); return o; }
    function matBrief(v) { var rows = []; for (var i = 0; i < v.r; i++) { var r = []; for (var j = 0; j < v.c; j++) r.push(window.MLab._.scalarStr(v.d[i + j * v.r])); rows.push(r.join(" ")); } return "[" + rows.join("; ") + "]"; }
    I.onStmt = function (s, env) { if (steps.length < 600) steps.push({ line: s.line, scope: env.name || "", vars: snap(env), out: I.out.length }); };
    var r = I.run(code); steps.push({ line: 0, scope: "", vars: snap(I.base), out: r.output.length, end: true, error: r.error });
    var k = 0, timer = null, reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.innerHTML = '<div class="mla-code__head"><span class="mla-code__title">' + (flags.title ? esc(String(flags.title).replace(/_/g, " ")) : "Watch it run") + " <em>step through the code</em></span></div>" +
      '<div class="mla-trace__body"><ol class="mla-trace__code"></ol><div class="mla-trace__side"><div class="mla-trace__ws"><h4></h4><table><tbody></tbody></table></div><div class="mla-trace__outw"><h4>Command Window</h4><pre class="mla-trace__out"></pre></div></div></div>' +
      '<div class="mla-code__bar"></div><p class="mla-trace__cap" aria-live="polite"></p>';
    var ol = box.querySelector("ol"); lines.forEach(function (ln) { var li = el("li"); li.innerHTML = hl(ln) || "&nbsp;"; ol.appendChild(li); });
    var bar = box.querySelector(".mla-code__bar"), bPrev = btn("mla-btn--ghost", ICON.back + "<span>Back</span>"), bNext = btn("mla-btn--go", ICON.step + "<span>Step</span>"), bPlay = btn("mla-btn--ghost", ICON.play + "<span>Play</span>"), bReset = btn("mla-btn--ghost", ICON.reset + "<span>Restart</span>");
    [bPrev, bNext, bPlay, bReset].forEach(function (b) { bar.appendChild(b); });
    var scrub = el("input", "mla-scrub"); scrub.type = "range"; scrub.min = 0; scrub.max = Math.max(0, steps.length - 1); scrub.step = 1; scrub.setAttribute("aria-label", "Step"); bar.appendChild(scrub); scrub.addEventListener("input", function () { stop(); k = +scrub.value; paint(); });
    var count = el("span", "mla-trace__count"); bar.appendChild(count);
    function paint() {
      var s = steps[k];
      [].forEach.call(ol.children, function (li, i) { li.classList.toggle("is-on", i + 1 === s.line); li.classList.toggle("is-past", false); });
      var on = ol.querySelector(".is-on"); if (on && on.scrollIntoView && ol.scrollHeight > ol.clientHeight) ol.scrollTop = Math.max(0, on.offsetTop - ol.clientHeight / 2);
      box.querySelector(".mla-trace__ws h4").textContent = s.scope ? "Workspace of function " + s.scope : "Workspace";
      box.querySelector("tbody").innerHTML = s.vars.length ? s.vars.map(function (v) { return "<tr><th>" + esc(v[0]) + "</th><td>" + esc(v[1]) + "</td></tr>"; }).join("") : '<tr><td class="mla-trace__empty">no variables yet</td></tr>';
      box.querySelector(".mla-trace__out").textContent = r.output.slice(0, s.out) || " ";
      count.textContent = "Step " + (k + 1) + " of " + steps.length; scrub.value = k; scrub.style.setProperty("--p", (steps.length > 1 ? k / (steps.length - 1) * 100 : 0) + "%");
      box.querySelector(".mla-trace__cap").textContent = s.end ? (s.error ? "Stopped with an error: " + s.error.message : "Finished. Every line has run.") : "About to run line " + s.line + ": " + (lines[s.line - 1] || "").trim();
      bPrev.disabled = k === 0; bNext.disabled = k === steps.length - 1;
    }
    function stop() { clearInterval(timer); timer = null; bPlay.innerHTML = ICON.play + "<span>Play</span>"; }
    bNext.addEventListener("click", function () { stop(); if (k < steps.length - 1) k++; paint(); });
    bPrev.addEventListener("click", function () { stop(); if (k > 0) k--; paint(); });
    bReset.addEventListener("click", function () { stop(); k = 0; paint(); });
    bPlay.addEventListener("click", function () { if (timer) { stop(); return; } if (k === steps.length - 1) k = 0; bPlay.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg><span>Pause</span>'; timer = setInterval(function () { if (k >= steps.length - 1) { stop(); return; } k++; paint(); }, reduce ? 1400 : 750); paint(); });
    paint();
    return box;
  }

  /* ---------- exercises ---------- */
  function exercise(ex, id) {
    var box = el("section", "mla-ex"), passed = !!P.ex[id];
    box.innerHTML = '<header class="mla-ex__head"><span class="mla-ex__badge">Exercise</span><h3></h3><span class="mla-ex__state"></span></header><div class="mla-ex__prompt"></div>';
    box.querySelector("h3").textContent = ex.title; renderBlocks(box.querySelector(".mla-ex__prompt"), ex.prompt, id + "p");
    var res = resultPanel("Run your code to see what it prints. Check answer runs it and tests the result."), tried = false;
    var verdict = el("div", "mla-ex__verdict"); verdict.hidden = true; verdict.setAttribute("role", "status");
    var ed = editor(ex.starter, { onRun: check, minLines: 3, label: "Your answer for " + ex.title }), inp = inputField(ex.starter + ex.solution, ex.inputs);
    var bar = el("div", "mla-code__bar"), bRun = btn("mla-btn--ghost", ICON.play + "<span>Run</span>"), bCheck = btn("mla-btn--go", ICON.check + "<span>Check answer</span>"), bHint = btn("mla-btn--ghost", ICON.bulb + "<span>Hint</span>"), bSol = btn("mla-btn--ghost", "<span>Show solution</span>"), bReset = btn("mla-btn--ghost", ICON.reset + "<span>Reset</span>");
    var hintBox = el("div", "mla-ex__hint"); hintBox.hidden = true; var hintN = 0;
    function state() { box.classList.toggle("is-passed", passed); box.classList.toggle("is-tried", tried && !passed); box.querySelector(".mla-ex__state").innerHTML = passed ? ICON.check + " Solved" : tried ? "Keep going" : "Not solved yet"; }
    function run() { var t0 = now(), r = runCode(ed.get(), inputsFrom(inp && inp.querySelector("input"))); res.set(r, now() - t0); return r; }
    function check() {
      var r = run(), fails = [], I = r.interp;
      if (r.error) fails.push("Your code stopped with an error. Fix it first, then check again.");
      else {
        ex.checks.forEach(function (c) {
          var ok = false, why = "";
          try { var q = I.run("mla_check__ = (" + c + ");"); if (q.error) why = q.error.message; else ok = window.MLab._.truthy(I.base.vars.mla_check__); } catch (e) { why = String(e.message || e); }
          if (!ok) { var m = /^Unrecognized function or variable '(\w+)'/.exec(why); fails.push(m ? "The variable <code>" + esc(m[1]) + "</code> does not exist yet. Check its name and spelling (MATLAB is case-sensitive)." : "This condition is not true yet: <code>" + esc(c) + "</code>"); }
        });
        var flat = r.output.replace(/\s+/g, " ");
        ex.expects.forEach(function (t) { if (flat.indexOf(t.replace(/\s+/g, " ")) < 0) fails.push("The output should contain: <code>" + esc(t) + "</code>"); });
      }
      verdict.hidden = false;
      if (!fails.length) { verdict.className = "mla-ex__verdict is-ok"; verdict.innerHTML = ICON.check + " <strong>Correct.</strong> Well done. Try changing the numbers to see what happens."; if (!passed) { passed = true; mark("ex", id); box.classList.add("is-fresh"); setTimeout(function () { box.classList.remove("is-fresh"); }, 1600); } state(); }
      else { tried = true; state(); verdict.className = "mla-ex__verdict is-no"; verdict.innerHTML = "<strong>Not yet.</strong><ul>" + fails.slice(0, 3).map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>"; }
    }
    bRun.addEventListener("click", run); bCheck.addEventListener("click", check);
    bReset.addEventListener("click", function () { ed.set(ex.starter); res.idle(); verdict.hidden = true; });
    bHint.addEventListener("click", function () { if (!ex.hints.length) return; hintBox.hidden = false; hintN = Math.min(ex.hints.length, hintN + 1); hintBox.innerHTML = ex.hints.slice(0, hintN).map(function (h, i) { return "<p><strong>Hint " + (i + 1) + "</strong>" + h + "</p>"; }).join(""); bHint.querySelector("span").textContent = hintN >= ex.hints.length ? "No more hints" : "Next hint (" + (ex.hints.length - hintN) + " left)"; if (hintN >= ex.hints.length) bHint.disabled = true; });
    bSol.addEventListener("click", function () { if (!ex.solution) return; if (bSol.dataset.on) { ed.set(bSol.dataset.mine); delete bSol.dataset.on; bSol.querySelector("span").textContent = "Show solution"; } else { bSol.dataset.mine = ed.get(); bSol.dataset.on = "1"; ed.set(ex.solution); bSol.querySelector("span").textContent = "Back to my code"; } });
    box.appendChild(ed.el); if (inp) box.appendChild(inp);
    bar.appendChild(bCheck); bar.appendChild(bRun); if (ex.hints.length) bar.appendChild(bHint); if (ex.solution) bar.appendChild(bSol); bar.appendChild(bReset);
    box.appendChild(bar); box.appendChild(hintBox); box.appendChild(verdict); box.appendChild(res.el);
    state(); return box;
  }
  function quiz(qz, id) {
    var box = el("section", "mla-quiz"), n = qz.questions.length;
    box.innerHTML = '<header class="mla-ex__head"><span class="mla-ex__badge mla-ex__badge--quiz">Quiz</span><h3></h3><span class="mla-ex__state"></span></header>';
    box.querySelector("h3").textContent = qz.title;
    qz.questions.forEach(function (q, qi) {
      var fs = el("fieldset", "mla-quiz__q"); fs.innerHTML = "<legend><b>" + (qi + 1) + "</b><span>" + q.q + "</span></legend>";
      q.options.forEach(function (o, oi) { var lab = el("label", "mla-quiz__opt"); lab.innerHTML = '<input type="radio" name="' + id + "-" + qi + '" value="' + oi + '"><span>' + o.html + "</span>"; fs.appendChild(lab); });
      var why = el("p", "mla-quiz__why"); why.hidden = true; fs.appendChild(why); box.appendChild(fs); fs.addEventListener("change", function () { [].forEach.call(fs.querySelectorAll(".mla-quiz__opt"), function (l) { l.classList.remove("is-right", "is-wrong"); l.classList.toggle("is-picked", l.querySelector("input").checked); }); fs.classList.remove("is-missed"); });
    });
    var bar = el("div", "mla-code__bar"), go = btn("mla-btn--go", ICON.check + "<span>Check my answers</span>"), again = btn("mla-btn--ghost", ICON.reset + "<span>Try again</span>"), score = el("span", "mla-quiz__score"); score.setAttribute("role", "status");
    bar.appendChild(go); bar.appendChild(again); bar.appendChild(score); box.appendChild(bar);
    function paintBest() { var best = P.quiz[id]; box.querySelector(".mla-ex__state").innerHTML = best !== undefined ? "Best: " + best + " / " + n : ""; }
    go.addEventListener("click", function () {
      var right = 0, answered = 0;
      [].forEach.call(box.querySelectorAll(".mla-quiz__q"), function (fs, qi) {
        var q = qz.questions[qi], pick = fs.querySelector("input:checked"), why = fs.querySelector(".mla-quiz__why");
        [].forEach.call(fs.querySelectorAll(".mla-quiz__opt"), function (lab, oi) { lab.classList.remove("is-right", "is-wrong", "is-picked"); if (pick && q.options[oi].ok) lab.classList.add("is-right"); else if (pick && +pick.value === oi) lab.classList.add("is-wrong"); });
        fs.classList.toggle("is-missed", !pick); if (pick) { answered++; var ok = q.options[+pick.value].ok; if (ok) right++; why.className = "mla-quiz__why " + (ok ? "is-ok" : "is-no"); why.hidden = false; why.innerHTML = (ok ? "<strong>Correct.</strong> " : "<strong>Not quite.</strong> ") + (q.why || ""); }
      });
      score.textContent = answered < n ? "Answer every question (" + answered + " of " + n + " done)." : "You scored " + right + " out of " + n + ".";
      if (answered === n) { if (P.quiz[id] === undefined || right > P.quiz[id]) mark("quiz", id, right); paintBest(); }
    });
    again.addEventListener("click", function () { [].forEach.call(box.querySelectorAll("input"), function (i) { i.checked = false; }); [].forEach.call(box.querySelectorAll(".mla-quiz__opt"), function (l) { l.classList.remove("is-right", "is-wrong", "is-picked"); }); [].forEach.call(box.querySelectorAll(".mla-quiz__why"), function (w) { w.hidden = true; }); [].forEach.call(box.querySelectorAll(".mla-quiz__q"), function (f) { f.classList.remove("is-missed"); }); score.textContent = ""; });
    paintBest(); return box;
  }
  function task(t, id) {
    var box = el("section", "mla-task"), st = P.task[id] || {};
    box.innerHTML = '<header class="mla-ex__head"><span class="mla-ex__badge mla-ex__badge--task">Do it in MATLAB</span><h3></h3><span class="mla-ex__state"></span></header><div class="mla-task__body"></div>';
    box.querySelector("h3").textContent = t.title || "Assignment";
    var body = box.querySelector(".mla-task__body"); renderBlocks(body, t.blocks, id + "t");
    var items = body.querySelectorAll("ol > li");
    [].forEach.call(items, function (li, i) { var cb = el("input"); cb.type = "checkbox"; cb.checked = !!st[i]; cb.setAttribute("aria-label", "Step " + (i + 1) + " done"); var lab = el("label", "mla-task__step"), txt = el("span", "mla-task__txt"); while (li.firstChild) txt.appendChild(li.firstChild); lab.appendChild(txt); lab.appendChild(cb); li.appendChild(lab); li.classList.toggle("is-done", cb.checked); cb.addEventListener("change", function () { st[i] = cb.checked ? 1 : 0; li.classList.toggle("is-done", cb.checked); mark("task", id, st); state(); }); });
    var foot = el("div", "mla-code__bar"); foot.innerHTML = '<span class="mla-code__links">' + realLinks() + "</span>"; box.appendChild(foot);
    function state() { var n = 0; [].forEach.call(items, function (li, i) { if (st[i]) n++; }); box.querySelector(".mla-ex__state").innerHTML = items.length ? (n === items.length ? ICON.check + " All steps done" : n + " of " + items.length + " steps done") : ""; box.classList.toggle("is-passed", items.length > 0 && n === items.length); }
    state(); return box;
  }

  /* ---------- lesson rendering ---------- */
  function renderBlocks(root, blocks, idBase) {
    var nEx = 0, nQz = 0, nTk = 0;
    blocks.forEach(function (b) {
      var e;
      switch (b.type) {
        case "p": e = el("p", null, b.html); break;
        case "h": e = el(b.level === 3 ? "h3" : "h4", "mla-h", b.html); break;
        case "note": e = el("div", "mla-note" + (b.warn ? " mla-note--warn" : ""), "<p>" + b.html + "</p>"); break;
        case "list": e = el(b.ordered ? "ol" : "ul", "mla-list", b.items.map(function (i) { return "<li>" + i + "</li>"; }).join("")); break;
        case "table": e = el("div", "mla-tablewrap"); e.innerHTML = "<table class='mla-table'><thead><tr>" + b.rows[0].map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>" + b.rows.slice(1).map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>"; break;
        case "code":
          if (b.flags.lang === "matlab") e = b.flags.trace ? tracer(b.code, b.flags) : codeBox(b.code, b.flags);
          else { e = el("div", "mla-plain" + (b.flags.lang === "output" ? " mla-plain--out" : "")); e.innerHTML = (b.flags.lang === "output" ? '<span class="mla-plain__tag">Result</span>' : "") + "<pre></pre>"; e.querySelector("pre").textContent = b.code; }
          break;
        case "exercise": e = exercise(b, idBase + "#e" + (nEx++)); break;
        case "quiz": e = quiz(b, idBase + "#q" + (nQz++)); break;
        case "task": e = task(b, idBase + "#t" + (nTk++)); break;
        case "anim": case "figure": case "sandbox":
          e = el("div", "mla-anim"); if (window.MLAnim && window.MLAnim.mount) { try { window.MLAnim.mount(b.type === "sandbox" ? "sandbox" : b.name, e, b.type === "sandbox" ? b.name : b.arg); } catch (err) { e.textContent = "This interactive figure could not load (" + err.message + ")."; } } else e.textContent = "Interactive figure: " + b.name;
          break;
      }
      if (e) root.appendChild(e);
    });
  }
  function math(root) {
    if (!window.renderMathInElement) return;
    try { window.renderMathInElement(root, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option", "svg"], ignoredClasses: ["mla-ed", "mla-out", "mla-trace", "mla-sb"], throwOnError: false }); } catch (e) {}
  }
  function initLesson() {
    var host = document.querySelector("[data-mla-lesson]"), src = document.getElementById("mla-md");
    if (!host || !src) return;
    var md = JSON.parse(src.textContent), id = host.getAttribute("data-mla-lesson");
    host.innerHTML = "";
    try { renderBlocks(host, L.parse(md), id); math(host); }
    catch (e) { host.innerHTML = ""; var p = el("pre", "mla-plain"); p.textContent = md; host.appendChild(el("p", "mla-note mla-note--warn", "This lesson could not be made interactive in your browser, so it is shown as plain text.")); host.appendChild(p); }
    var done = document.querySelector("[data-mla-complete]");
    if (done) done.addEventListener("click", function () { if (P.done[id]) { delete P.done[id]; save(P); paintProgress(); } else mark("done", id); });
    var next = document.querySelector("[data-mla-next]"); if (next) next.addEventListener("click", function () { if (!P.done[id]) mark("done", id); });
    try { localStorage.setItem("ee-matlab-last", JSON.stringify({ url: location.pathname, title: document.querySelector("h1") ? document.querySelector("h1").textContent : "" })); } catch (e) {}
  }
  function initSide() {
    var side = document.querySelector("[data-mla-side]"), tog = document.querySelector("[data-mla-side-toggle]");
    var scrim = document.querySelector("[data-mla-scrim]"), cls = document.querySelector("[data-mla-side-close]");
    function drawer(open) { if (!side) return; side.classList.toggle("is-open", open); if (scrim) scrim.hidden = !open; if (tog) tog.setAttribute("aria-expanded", open); document.documentElement.classList.toggle("mla-noscroll", open); if (open && cls) cls.focus(); else if (!open && tog && document.activeElement === cls) tog.focus(); }
    if (side && tog) tog.addEventListener("click", function () { drawer(!side.classList.contains("is-open")); });
    if (scrim) scrim.addEventListener("click", function () { drawer(false); }); if (cls) cls.addEventListener("click", function () { drawer(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && side && side.classList.contains("is-open")) drawer(false); });
    var cur = document.querySelector(".mla-side a[aria-current]"); if (cur && side && side.scrollHeight > side.clientHeight) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
    var resume = document.querySelector("[data-mla-resume]");
    if (resume) { try { var last = JSON.parse(localStorage.getItem("ee-matlab-last")); if (last && last.url) { resume.hidden = false; resume.querySelector("a").href = last.url; resume.querySelector("b").textContent = last.title; } } catch (e) {} }
  }
  /* ---------- playground: one big editor, the Command Window and the Workspace ---------- */
  function initPlayground() {
    var host = document.querySelector("[data-mla-playground]"); if (!host) return;
    var SAVE = "ee-matlab-playground", start = "% Type MATLAB code here, then press Run (or Ctrl+Enter).\nt = linspace(0, 0.04, 400);      % two cycles of 50 Hz\nv = 325*sin(2*pi*50*t);          % 230 V rms mains\nVrms = sqrt(mean(v.^2))\nplot(t*1000, v, 'LineWidth', 1.5)\ngrid on\nxlabel('time (ms)'), ylabel('voltage (V)')\ntitle('Mains voltage')\n";
    try { var saved = localStorage.getItem(SAVE); if (saved) start = saved; } catch (e) {}
    var ed = editor(start, { onRun: run, minLines: 14, maxLines: 30 }), out = host.querySelector("[data-pg-out]"), ws = host.querySelector("[data-pg-ws]"), inp = host.querySelector("[data-pg-inputs]");
    host.querySelector("[data-pg-editor]").appendChild(ed.el);
    function run() {
      try { localStorage.setItem(SAVE, ed.get()); } catch (e) {}
      var r = runCode(ed.get(), inputsFrom(inp)); showResult(out, r);
      var names = Object.keys(r.vars || {}).sort(), _ = window.MLab._;
      ws.innerHTML = names.length ? "<table class='mla-table'><thead><tr><th>Name</th><th>Value</th><th>Size</th><th>Class</th></tr></thead><tbody>" + names.map(function (n) { var v = r.vars[n], sz = v.t === "m" || v.t === "c" || v.t === "sa" ? v.r + "×" + v.c : "1×1", b; try { b = _.brief(v); } catch (e) { b = ""; } return "<tr><td><code>" + esc(n) + "</code></td><td>" + esc(b) + "</td><td>" + sz + "</td><td>" + esc(_.className(v)) + "</td></tr>"; }).join("") + "</tbody></table>" : "<p class='mla-out__none'>No variables yet. Run some code.</p>";
    }
    host.querySelector("[data-pg-run]").addEventListener("click", run);
    host.querySelector("[data-pg-clear]").addEventListener("click", function () { ed.set(""); ed.focus(); });
    host.querySelector("[data-pg-copy]").addEventListener("click", function (e) { copyText(ed.get(), e.currentTarget); });
    [].forEach.call(host.querySelectorAll("[data-pg-sample]"), function (b) { b.addEventListener("click", function () { ed.set(b.getAttribute("data-pg-sample").replace(/\\n/g, "\n")); run(); }); });
  }
  window.MLA = { tip: tip, download: download, progress: function () { return P; }, hl: hl, editor: editor, codeBox: codeBox, runCode: runCode, showResult: showResult, renderBlocks: renderBlocks, el: el, btn: btn, ICON: ICON };
  function initSearch() {
    var box = document.getElementById("mla-q"), src = document.getElementById("mla-index"); if (!box || !src) return;
    var idx = JSON.parse(src.textContent), res = document.getElementById("mla-q-res"), count = document.getElementById("mla-q-count");
    function hi(text, words) { var out = esc(text); words.forEach(function (w) { out = out.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); }); return out; }
    function run() {
      var words = box.value.toLowerCase().split(/\s+/).filter(Boolean); res.innerHTML = "";
      if (!words.length) { count.textContent = idx.length + " lessons. Type to search titles, text and function names."; return; }
      var hits = [];
      idx.forEach(function (e) { var title = e.title.toLowerCase(), code = " " + e.c.toLowerCase() + " ", body = e.x.toLowerCase(), score = 0, all = true; words.forEach(function (w) { var s = (title.indexOf(w) >= 0 ? 6 : 0) + (code.indexOf(" " + w + " ") >= 0 ? 4 : code.indexOf(w) >= 0 ? 2 : 0) + (body.indexOf(w) >= 0 ? 1 : 0); if (!s) all = false; score += s; }); if (all) hits.push([score, e]); });
      hits.sort(function (a, b) { return b[0] - a[0]; });
      count.textContent = hits.length ? hits.length + " lesson" + (hits.length > 1 ? "s" : "") + " found" : "Nothing found. Try a function name such as plot, or a shorter word.";
      hits.slice(0, 40).forEach(function (h) { var e = h[1], li = el("li"), at = e.x.toLowerCase().indexOf(words[0]), snip = e.x.slice(Math.max(0, at - 60), Math.max(0, at - 60) + 170); li.innerHTML = '<a href="/matlab/' + e.t + "/" + e.s + '/"><b>' + hi(e.title, words) + "</b><small>" + esc(e.track) + " · " + esc(e.ch) + "</small><small>" + (at > 60 ? "…" : "") + hi(snip, words) + "…</small></a>"; res.appendChild(li); });
    }
    box.addEventListener("input", run); run();
  }
  function initCert() {
    var c = document.querySelector("[data-mla-cert]"), src = document.getElementById("mla-cert-ids"); if (!c || !src) return;
    var ids = JSON.parse(src.textContent), done = ids.filter(function (id) { return P.done[id]; }), last = 0, ex = 0;
    done.forEach(function (id) { last = Math.max(last, +P.done[id] || 0); }); Object.keys(P.ex).forEach(function (k) { if (ids.indexOf(k.split("#")[0]) >= 0) ex++; });
    c.querySelector("[data-cert-bar]").style.width = Math.round(done.length / ids.length * 100) + "%";
    var detail = c.querySelector("[data-cert-detail]");
    if (done.length < ids.length) { detail.textContent = done.length + " of " + ids.length + " lessons completed on this device."; return; }
    c.setAttribute("data-locked", "0"); var name = c.querySelector("[data-cert-name]"), inp = c.querySelector("[data-cert-input]"), pr = c.querySelector("[data-cert-print]");
    c.querySelector("[data-cert-line]").innerHTML = "This records that";
    detail.innerHTML = "completed all <b>" + ids.length + "</b> lessons of <b>" + esc(c.getAttribute("data-track")) + "</b>" + (ex ? " and solved <b>" + ex + "</b> exercises" : "") + " in the EE Hub MATLAB Academy, finishing on " + new Date(last || Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + ".";
    name.hidden = inp.hidden = pr.hidden = false; try { inp.value = localStorage.getItem("ee-matlab-name") || ""; } catch (e) {}
    function paint() { name.textContent = inp.value.trim() || "Your name"; try { localStorage.setItem("ee-matlab-name", inp.value.trim()); } catch (e) {} }
    inp.addEventListener("input", paint); paint(); pr.addEventListener("click", function () { window.print(); });
  }
  function initDemo() {
    var host = document.querySelector("[data-mla-demo]"), src = document.getElementById("mla-demo-code"); if (!host || !src) return;
    var box = codeBox(JSON.parse(src.textContent), { title: "mains.m" }); host.appendChild(box); if (window.MLab && box.run) box.run();
  }
  function initStatic() { [].forEach.call(document.querySelectorAll("pre[data-mla-hl]"), function (p) { p.innerHTML = hl(p.textContent); }); }
  function boot() { initLesson(); initSide(); initPlayground(); initSearch(); initCert(); initDemo(); initStatic(); paintProgress(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
