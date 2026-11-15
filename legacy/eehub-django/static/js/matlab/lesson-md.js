/* MATLAB Academy lesson format: a small Markdown dialect, parsed in the browser (to render a lesson) and in Node
   (so tests can run every example and exercise through the interpreter). See docs/MATLAB_ACADEMY.md for the syntax. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.MLLesson = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function inline(s) {
    var codes = [];
    s = String(s).replace(/`([^`]+)`/g, function (m, c) { codes.push("<code>" + esc(c) + "</code>"); return "\u0001" + (codes.length - 1) + "\u0001"; });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#|\.\.?\/)[^)\s]*)\)/g, function (m, t, u) { var ext = /^https?:/.test(u); return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + t + "</a>"; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
    s = s.replace(/\[\[([^\]]+)\]\]/g, "<kbd>$1</kbd>");
    return s.replace(/\u0001(\d+)\u0001/g, function (m, i) { return codes[+i]; });
  }
  function flagsOf(info) { var parts = info.trim().split(/\s+/), f = { lang: parts[0] || "text" }; parts.slice(1).forEach(function (p) { var kv = p.split("="); f[kv[0]] = kv.length > 1 ? kv.slice(1).join("=") : true; }); return f; }
  /* parse a lesson body into blocks */
  function parse(md) {
    var lines = String(md).replace(/\r\n?/g, "\n").split("\n"), i = 0;
    function block(stop) {
      var out = [], para = [];
      function flush() { if (para.length) { out.push({ type: "p", html: inline(para.join(" ")) }); para = []; } }
      while (i < lines.length) {
        var ln = lines[i];
        if (stop && stop(ln)) break;
        var m;
        if ((m = ln.match(/^```(.*)$/))) {
          flush(); var f = flagsOf(m[1]), code = []; i++;
          while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
          i++; out.push({ type: "code", flags: f, code: code.join("\n") }); continue;
        }
        if ((m = ln.match(/^:::(exercise|quiz|task)\s*(.*)$/))) {
          flush(); i++; var kind = m[1], title = m[2].trim(), start = i, depthFence = false, body = [];
          while (i < lines.length) { if (/^```/.test(lines[i])) depthFence = !depthFence; if (!depthFence && /^:::\s*$/.test(lines[i])) break; body.push(lines[i++]); }
          i++; void start;
          out.push(kind === "quiz" ? quiz(body, title) : kind === "exercise" ? exercise(body, title) : { type: "task", title: title, blocks: parse(body.join("\n")) });
          continue;
        }
        if ((m = ln.match(/^::(anim|sandbox|figure)\s+(\S+)\s*(.*)$/))) { flush(); out.push({ type: m[1], name: m[2], arg: m[3].trim() }); i++; continue; }
        if ((m = ln.match(/^(#{3,4})\s+(.*)$/))) { flush(); out.push({ type: "h", level: m[1].length, html: inline(m[2]) }); i++; continue; }
        if (/^(!?)>\s?/.test(ln)) {
          flush(); var warn = ln[0] === "!", q = [];
          while (i < lines.length && /^(!?)>\s?/.test(lines[i])) q.push(lines[i++].replace(/^!?>\s?/, ""));
          out.push({ type: "note", warn: warn, html: inline(q.join(" ")) }); continue;
        }
        if (/^\s*([-*]|\d+\.)\s+/.test(ln)) {
          flush(); var ordered = /^\s*\d+\./.test(ln), items = [];
          while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
            if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); else items[items.length - 1] += " " + lines[i].trim();
            i++;
          }
          out.push({ type: "list", ordered: ordered, items: items.map(inline) }); continue;
        }
        if (/^\|.*\|\s*$/.test(ln)) {
          flush(); var rows = [];
          while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { if (!/^\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/\\\|/g, "\u0002").replace(/^\||\|$/g, "").split("|").map(function (c) { return inline(c.trim().replace(/\u0002/g, "|")); })); i++; }
          out.push({ type: "table", rows: rows }); continue;
        }
        if (/^\s*$/.test(ln)) { flush(); i++; continue; }
        para.push(ln.trim()); i++;
      }
      flush(); return out;
    }
    return block(null);
  }
  function exercise(body, title) {
    var ex = { type: "exercise", title: title || "Exercise", checks: [], expects: [], hints: [], starter: "", solution: "", inputs: "", prompt: [] }, rest = [], i = 0, m;
    while (i < body.length) {
      var ln = body[i];
      if ((m = ln.match(/^```(.*)$/))) { var f = flagsOf(m[1]), code = []; i++; while (i < body.length && !/^```\s*$/.test(body[i])) code.push(body[i++]); i++; if (f.solution) ex.solution = code.join("\n"); else if (f.lang === "matlab" && !ex.starterSet && !f.show) { ex.starter = code.join("\n"); ex.starterSet = true; if (f.input) ex.inputs = String(f.input); } else rest.push("```" + m[1], code.join("\n"), "```"); continue; }
      if ((m = ln.match(/^@check\s+(.*)$/))) ex.checks.push(m[1].trim());
      else if ((m = ln.match(/^@expect\s+(.*)$/))) ex.expects.push(m[1].trim());
      else if ((m = ln.match(/^@hint\s+(.*)$/))) ex.hints.push(inline(m[1].trim()));
      else if ((m = ln.match(/^@input\s+(.*)$/))) ex.inputs = m[1].trim();
      else rest.push(ln);
      i++;
    }
    delete ex.starterSet; ex.prompt = parse(rest.join("\n")); return ex;
  }
  function quiz(body, title) {
    var qs = [], cur = null;
    body.forEach(function (ln) {
      var m;
      if ((m = ln.match(/^\?\s+(.*)$/))) { cur = { q: inline(m[1]), options: [], why: "" }; qs.push(cur); }
      else if (cur && (m = ln.match(/^([-+])\s+(.*)$/))) cur.options.push({ html: inline(m[2]), ok: m[1] === "+" });
      else if (cur && (m = ln.match(/^=\s+(.*)$/))) cur.why = inline(m[1]);
      else if (cur && ln.trim() && cur.options.length === 0) cur.q += " " + inline(ln.trim());
    });
    return { type: "quiz", title: title || "Quick quiz", questions: qs };
  }
  /* split a whole track file into meta + chapters + lessons */
  function splitTrack(md) {
    var text = String(md).replace(/\r\n?/g, "\n"), meta = {}, m = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (m) { m[1].split("\n").forEach(function (l) { var k = l.indexOf(":"); if (k > 0) meta[l.slice(0, k).trim()] = l.slice(k + 1).trim(); }); text = text.slice(m[0].length); }
    var lines = text.split("\n"), chapters = [], chap = null, lesson = null, fence = false;
    lines.forEach(function (ln) {
      if (/^```/.test(ln)) fence = !fence;
      var h1 = !fence && ln.match(/^#\s+(.*)$/), h2 = !fence && ln.match(/^##\s+(.*?)\s*\{#([a-z0-9-]+)\}\s*$/);
      if (h1) { chap = { title: h1[1].trim(), lessons: [] }; chapters.push(chap); lesson = null; return; }
      if (h2) { if (!chap) { chap = { title: meta.title || "Lessons", lessons: [] }; chapters.push(chap); } lesson = { slug: h2[2], title: h2[1].trim(), tag: "", body: [] }; chap.lessons.push(lesson); return; }
      if (lesson) { var t = ln.match(/^@\s+(.*)$/); if (t && !lesson.body.length) lesson.tag = t[1].trim(); else lesson.body.push(ln); }
    });
    chapters.forEach(function (c) { c.lessons.forEach(function (l) { l.md = l.body.join("\n"); delete l.body; }); });
    return { meta: meta, chapters: chapters };
  }
  /* every runnable thing in a lesson, for tests: {kind, code, flags, checks, expects, inputs} */
  function runnables(blocks, out) {
    out = out || [];
    blocks.forEach(function (b) {
      if (b.type === "code" && b.flags.lang === "matlab") out.push({ kind: "example", code: b.code, flags: b.flags });
      else if (b.type === "exercise") { runnables(b.prompt, out); out.push({ kind: "exercise", ex: b }); }
      else if (b.type === "task") runnables(b.blocks, out);
    });
    return out;
  }
  return { parse: parse, inline: inline, splitTrack: splitTrack, runnables: runnables, esc: esc };
});
