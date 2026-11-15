/* EE Hub MATLAB-compatible runner: core (lexer, parser, evaluator, indexing, display).
   An original interpreter for the MATLAB language subset taught in EEEN 316 / EEEN 519. It runs in the browser and in
   Node (tests). It is NOT MathWorks MATLAB: unsupported commands raise a clear "run this in real MATLAB" error.
   Library functions live in mlab-lib.js, plotting commands in mlab-lib.js (model) + mlab-plot.js (SVG), control in mlab-control.js. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.MLab = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- values ---------- */
  function M(r, c, d, im, k) { return { t: "m", r: r, c: c, d: d, im: im || null, k: k || "d" }; }
  function num(x) { return M(1, 1, [x]); }
  function bool(b) { return M(1, 1, [b ? 1 : 0], null, "l"); }
  function str(s) { var d = new Array(s.length); for (var i = 0; i < s.length; i++) d[i] = s.charCodeAt(i); return M(s.length ? 1 : 0, s.length, d, null, "c"); }
  function empty() { return M(0, 0, []); }
  function zeros(r, c) { var d = new Array(r * c); for (var i = 0; i < d.length; i++) d[i] = 0; return M(r, c, d); }
  function rowv(a) { return M(1, a.length, a.slice()); }
  function colv(a) { return M(a.length, 1, a.slice()); }
  function cell(r, c, d) { return { t: "c", r: r, c: c, d: d }; }
  function struct(f) { return { t: "st", f: f || {} }; }
  function MError(msg, id) { this.message = msg; this.identifier = id || ""; }
  function err(msg, id) { return new MError(msg, id); }
  function fatal(msg) { var e = new MError(msg, "EEHub:stopped"); e.fatal = true; return e; }
  function isText(v) { return v && (v.t === "s" || (v.t === "m" && v.k === "c" && v.r <= 1)); }
  function text(v, what) {
    if (v && v.t === "s") return v.v;
    if (v && v.t === "m" && v.k === "c") { if (v.r <= 1) return String.fromCharCode.apply(null, v.d); var rows = []; for (var i = 0; i < v.r; i++) { var s = ""; for (var j = 0; j < v.c; j++) s += String.fromCharCode(v.d[i + j * v.r]); rows.push(s); } return rows.join("\n"); }
    throw err((what || "Argument") + " must be text (a character vector or string).");
  }
  function scalar(v, what) {
    if (v && v.t === "m" && v.d.length >= 1) return v.d[0];
    if (v && v.t === "s") { var x = parseFloat(v.v); if (!isNaN(x)) return x; }
    throw err((what || "Value") + " must be a numeric scalar.");
  }
  function numel(v) { return v.t === "m" || v.t === "c" || v.t === "sa" ? v.r * v.c : 1; }
  function className(v) { return v.t === "m" ? (v.cls || (v.k === "l" ? "logical" : v.k === "c" ? "char" : "double")) : v.t === "c" ? "cell" : v.t === "st" || v.t === "sa" ? "struct" : v.t === "s" ? "string" : v.t === "f" ? "function_handle" : v.t; }
  function truthy(v) {
    if (v.t === "s") throw err("Conversion to logical from string is not possible.");
    if (v.t !== "m") throw err("Conversion to logical from " + className(v) + " is not possible.");
    if (!v.d.length) return false;
    for (var i = 0; i < v.d.length; i++) { if (v.d[i] !== v.d[i]) throw err("NaN's cannot be converted to logicals."); if (v.d[i] === 0 && !(v.im && v.im[i] !== 0)) return false; }
    return true;
  }
  var INT = { int8: [-128, 127], uint8: [0, 255], int16: [-32768, 32767], uint16: [0, 65535], int32: [-2147483648, 2147483647], uint32: [0, 4294967295], int64: [-9007199254740992, 9007199254740992], uint64: [0, 9007199254740992] };
  function mround(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }
  function castInt(v, cls) { var lim = INT[cls], d = v.d.map(function (x) { return x !== x ? 0 : Math.max(lim[0], Math.min(lim[1], mround(x))); }); var o = M(v.r, v.c, d); o.cls = cls; return o; }

  /* ---------- lexer ---------- */
  var KW = { "if": 1, "elseif": 1, "else": 1, "end": 1, "for": 1, "while": 1, "switch": 1, "case": 1, "otherwise": 1, "break": 1, "continue": 1, "return": 1, "function": 1, "try": 1, "catch": 1, "global": 1, "persistent": 1, "parfor": 1 };
  var OPS = ["...", ".^", ".*", "./", ".\\", ".'", "==", "~=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "\\", "^", "'", "<", ">", "=", "&", "|", "~", ":", ",", ";", "(", ")", "[", "]", "{", "}", "@", ".", "!"];
  function lex(src) {
    var toks = [], i = 0, n = src.length, line = 1, depth = [], sp = false, lineStart = true;
    function push(t, v, pos) { toks.push({ t: t, v: v, sp: sp, line: line, pos: pos, e: i }); sp = false; lineStart = false; }
    function valueBefore() { var p = toks[toks.length - 1]; return !!p && (p.t === "num" || p.t === "id" || p.t === "end" || (p.t === "op" && (p.v === ")" || p.v === "]" || p.v === "}" || p.v === "'" || p.v === ".'"))); }
    while (i < n) {
      var ch = src[i];
      if (ch === " " || ch === "\t" || ch === "\r") { i++; sp = true; continue; }
      if (ch === "\n") { i++; var top = depth[depth.length - 1]; if (top !== "(") push("nl", "\n", i - 1); line++; lineStart = true; sp = true; continue; }
      if (ch === "%") {
        if (lineStart && src[i + 1] === "{" && /^%\{[ \t\r]*(\n|$)/.test(src.slice(i, i + 40))) { // block comment
          var close = src.slice(i).search(/\n[ \t]*%\}[ \t\r]*(\n|$)/);
          if (close < 0) { i = n; continue; }
          var seg = src.slice(i, i + close + 1); line += (seg.match(/\n/g) || []).length; i += close + 1; var eol = src.indexOf("\n", i); i = eol < 0 ? n : eol; continue;
        }
        while (i < n && src[i] !== "\n") i++; continue;
      }
      if (ch === "." && src.substr(i, 3) === "...") { while (i < n && src[i] !== "\n") i++; i++; line++; sp = true; continue; }
      var p0 = i;
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] || ""))) {
        var j = i; while (/[0-9]/.test(src[j] || "")) j++;
        if (src[j] === "." && !/[*\/\\^']/.test(src[j + 1] || "") ) { j++; while (/[0-9]/.test(src[j] || "")) j++; }
        if (/[eE]/.test(src[j] || "") && /[0-9]|[+-][0-9]/.test(src.substr(j + 1, 2))) { j++; if (/[+-]/.test(src[j])) j++; while (/[0-9]/.test(src[j] || "")) j++; }
        var v = parseFloat(src.slice(i, j)), imag = false;
        if (/[ij]/.test(src[j] || "") && !/[A-Za-z0-9_]/.test(src[j + 1] || "")) { imag = true; j++; }
        i = j; push("num", v, p0); toks[toks.length - 1].imag = imag; continue;
      }
      if (/[A-Za-z]/.test(ch)) {
        var k = i; while (/[A-Za-z0-9_]/.test(src[k] || "")) k++;
        var w = src.slice(i, k); i = k;
        if (w === "end" && depth.length) push("end", w, p0);
        else if (KW[w] && !(toks.length && toks[toks.length - 1].t === "op" && toks[toks.length - 1].v === ".")) push("kw", w, p0);
        else push("id", w, p0);
        continue;
      }
      if (ch === '"') {
        var s = "", q = i + 1;
        for (;;) { if (q >= n || src[q] === "\n") throw err("Error: Line " + line + ": String is not terminated properly."); if (src[q] === '"') { if (src[q + 1] === '"') { s += '"'; q += 2; continue; } break; } s += src[q++]; }
        i = q + 1; push("str", s, p0); toks[toks.length - 1].dq = true; continue;
      }
      if (ch === "'") {
        var inMat = depth.length && depth[depth.length - 1] !== "(";
        if (valueBefore() && !(inMat && sp)) { i++; push("op", "'", p0); continue; }
        var s2 = "", q2 = i + 1;
        for (;;) { if (q2 >= n || src[q2] === "\n") throw err("Error: Line " + line + ": Character vector is not terminated properly."); if (src[q2] === "'") { if (src[q2 + 1] === "'") { s2 += "'"; q2 += 2; continue; } break; } s2 += src[q2++]; }
        i = q2 + 1; push("str", s2, p0); continue;
      }
      var op = null;
      for (var o = 0; o < OPS.length; o++) if (src.substr(i, OPS[o].length) === OPS[o]) { op = OPS[o]; break; }
      if (!op) throw err("Error: Line " + line + ": Invalid text character '" + ch + "'. Check for unsupported symbols or pasted non-ASCII characters.");
      i += op.length;
      if (op === "(" || op === "[" || op === "{") depth.push(op);
      else if (op === ")" || op === "]" || op === "}") depth.pop();
      push("op", op, p0);
    }
    sp = false; push("nl", "\n", n); push("eof", "", n);
    return toks;
  }

  /* ---------- parser ---------- */
  var FILECMDS = { save: 1, load: 1, type: 1, delete: 1, dir: 1, ls: 1 };
  var CMDS = { hold: 1, grid: 1, format: 1, clear: 1, clearvars: 1, close: 1, axis: 1, box: 1, syms: 1, load: 1, save: 1, delete: 1, dir: 1, ls: 1, help: 1, doc: 1, warning: 1, clc: 1, figure: 1, clf: 1, whos: 1, who: 1, pause: 1, more: 1, disp: 1, colormap: 1, shading: 1, legend: 1, lookfor: 1, type: 1, open: 1, cd: 1, diary: 1, echo: 1, rng: 1, view: 1 };
  function Parser(src) { this.src = src; this.toks = lex(src); this.p = 0; this.mat = false; this.funcs = {}; }
  Parser.prototype = {
    peek: function (o) { return this.toks[this.p + (o || 0)]; },
    next: function () { return this.toks[this.p++]; },
    isOp: function (v, o) { var t = this.toks[this.p + (o || 0)]; return t.t === "op" && t.v === v; },
    isKw: function (v) { var t = this.toks[this.p]; return t.t === "kw" && (v === undefined || t.v === v); },
    fail: function (msg, t) { t = t || this.peek(); return err("Error: Line " + t.line + ": " + msg); },
    expect: function (v) { if (!this.isOp(v)) { var t = this.peek(); throw this.fail(t.t === "eof" || t.t === "nl" ? "Expression or statement is incomplete or incorrect (expected '" + v + "')." : "Invalid expression near '" + (t.v === "\n" ? "end of line" : t.v) + "' (expected '" + v + "'). Check for missing brackets or operators."); } return this.next(); },
    skipSeps: function () { for (;;) { var t = this.peek(); if (t.t === "nl" || (t.t === "op" && (t.v === ";" || t.v === ","))) this.p++; else break; } },
    program: function () {
      var body = this.block({});
      if (this.peek().t !== "eof") throw this.fail(this.isKw("end") ? "Illegal use of reserved keyword \"end\" (there is no matching if, for, while, switch, try or function)." : "Unexpected '" + this.peek().v + "'.");
      return { body: body, funcs: this.funcs };
    },
    block: function (until) {
      var out = [];
      for (;;) {
        this.skipSeps();
        var t = this.peek();
        if (t.t === "eof") return out;
        if (t.t === "kw" && until[t.v]) return out;
        if (t.t === "kw" && t.v === "function") { if (until["function"] !== undefined) return out; this.funcDef(); continue; }
        if (t.t === "kw" && (t.v === "end" || t.v === "else" || t.v === "elseif" || t.v === "case" || t.v === "otherwise" || t.v === "catch")) return out;
        out.push(this.statement());
      }
    },
    endStmt: function () { // consume the terminator; return true when output is suppressed
      var t = this.peek();
      if (t.t === "op" && t.v === ";") { this.p++; return true; }
      if (t.t === "op" && t.v === ",") { this.p++; return false; }
      if (t.t === "nl") { this.p++; return false; }
      if (t.t === "eof" || t.t === "kw") return false;
      throw this.fail("Invalid expression near '" + t.v + "'. Check for a missing operator, comma or semicolon.");
    },
    needEnd: function (what, t0) { if (!this.isKw("end")) throw err("Error: Line " + t0.line + ": This '" + what + "' block has no matching 'end'."); this.p++; },
    statement: function () {
      var t = this.peek(), line = t.line, s;
      if (t.t === "kw") {
        this.p++;
        switch (t.v) {
          case "if": {
            var clauses = [], els = null, c = this.expr(); clauses.push({ cond: c, body: this.block({}) });
            for (;;) {
              if (this.isKw("elseif")) { this.p++; var c2 = this.expr(); clauses.push({ cond: c2, body: this.block({}) }); }
              else if (this.isKw("else")) { this.p++; if (this.isKw("if")) throw this.fail("Use 'elseif' (one word) instead of 'else if', or add another 'end'."); els = this.block({}); }
              else break;
            }
            this.needEnd("if", t); return { type: "if", clauses: clauses, els: els, line: line };
          }
          case "for": case "parfor": {
            var paren = this.isOp("("); if (paren) this.p++;
            var id = this.next(); if (id.t !== "id") throw this.fail("A for loop needs a loop variable, e.g.  for k = 1:10", id);
            this.expect("="); var e = this.expr(); if (paren) this.expect(")");
            var b = this.block({}); this.needEnd("for", t); return { type: "for", v: id.v, e: e, body: b, line: line };
          }
          case "while": { var wc = this.expr(), wb = this.block({}); this.needEnd("while", t); return { type: "while", cond: wc, body: wb, line: line }; }
          case "switch": {
            var se = this.expr(), cases = [], def = null; this.skipSeps();
            for (;;) {
              if (this.isKw("case")) { this.p++; var cv = this.expr(); cases.push({ v: cv, body: this.block({}) }); }
              else if (this.isKw("otherwise")) { this.p++; def = this.block({}); }
              else break;
            }
            this.needEnd("switch", t); return { type: "switch", e: se, cases: cases, def: def, line: line };
          }
          case "try": {
            var tb = this.block({}), cid = null, cb = [];
            if (this.isKw("catch")) { this.p++; var nx = this.peek(); if (nx.t === "id" && !this.isOp("=", 1) && !this.isOp("(", 1) && this.peek(1).t !== "id") { cid = nx.v; this.p++; } cb = this.block({}); }
            this.needEnd("try", t); return { type: "try", body: tb, id: cid, cbody: cb, line: line };
          }
          case "break": this.endStmt(); return { type: "break", line: line };
          case "continue": this.endStmt(); return { type: "continue", line: line };
          case "return": this.endStmt(); return { type: "return", line: line };
          case "global": case "persistent": { var names = []; while (this.peek().t === "id") names.push(this.next().v); this.endStmt(); return { type: t.v, names: names, line: line }; }
          default: throw this.fail("Illegal use of reserved keyword \"" + t.v + "\".", t);
        }
      }
      // command syntax:  hold on, format long, clear x y, close all
      if (t.t === "id" && FILECMDS[t.v]) { // file commands take raw words: save results.mat x y, type out.txt, load data.txt -ascii
        var f1 = this.peek(1), f2 = this.toks[this.p + 2];
        if (f1.sp && (f1.t === "id" || (f1.t === "op" && f1.v === "-" && f2 && !f2.sp)) && !(f2 && f2.t === "op" && (f2.v === "=" || f2.v === "(" || f2.v === "==") )) {
          this.p++; var words = [], endTok = function (k) { return k.t === "nl" || k.t === "eof" || (k.t === "op" && (k.v === ";" || k.v === ",")); };
          while (!endTok(this.peek())) { var wd = String(this.next().v); while (!endTok(this.peek()) && !this.peek().sp) wd += String(this.next().v); words.push(wd); }
          return { type: "cmd", name: t.v, args: words, semi: this.endStmt(), line: line };
        }
      }
      if (t.t === "id" && CMDS[t.v]) {
        var n1 = this.peek(1);
        if ((n1.t === "id" || n1.t === "num") && n1.sp && !(this.toks[this.p + 2].t === "op" && /^(=|\(|\+|-|\*|\/|\.\*|\.\/|\^|\.\^|==|\.)$/.test(this.toks[this.p + 2].v) ) || (n1.t === "str" && n1.sp && t.v !== "disp" && this.toks[this.p + 2].t !== "op")) {
          this.p++; var args = [];
          while (this.peek().t === "id" || this.peek().t === "num" || this.peek().t === "str" || this.peek().t === "kw") args.push(String(this.next().v));
          var semi = this.endStmt();
          return { type: "cmd", name: t.v, args: args, semi: semi, line: line };
        }
      }
      // assignment?  look for a top-level '=' before the statement ends
      var q = this.p, d = 0, isAssign = false;
      for (;; q++) {
        var x = this.toks[q];
        if (x.t === "eof") break;
        if (x.t === "nl" && d === 0) break;
        if (x.t === "op") {
          if (x.v === "(" || x.v === "[" || x.v === "{") d++;
          else if (x.v === ")" || x.v === "]" || x.v === "}") d--;
          else if (d === 0 && (x.v === ";" || x.v === ",")) break;
          else if (d === 0 && x.v === "=") { isAssign = true; break; }
          else if (d === 0 && x.v === "@") break;
        }
        if (x.t === "kw" && d === 0) break;
      }
      if (isAssign) {
        var lhs = [];
        if (this.isOp("[")) {
          this.p++;
          while (!this.isOp("]")) {
            if (this.isOp(",")) { this.p++; continue; }
            if (this.isOp("~")) { this.p++; lhs.push(null); continue; }
            var save = this.mat; this.mat = true; var lv = this.postfix(); this.mat = save; this.checkLv(lv); lhs.push(lv);
          }
          this.p++;
        } else { var one = this.postfix(); this.checkLv(one); lhs.push(one); }
        if (!this.isOp("=")) throw this.fail("Incorrect use of '=' operator. To compare values for equality, use '=='. To assign, the left side must be a variable.");
        this.p++;
        var rhs = this.expr(), sm = this.endStmt();
        return { type: "assign", lhs: lhs, rhs: rhs, semi: sm, line: line };
      }
      s = this.expr();
      return { type: "expr", e: s, semi: this.endStmt(), line: line };
    },
    checkLv: function (n) { var b = n; while (b.type === "idx" || b.type === "field") b = b.e; if (b.type !== "id") throw this.fail("The left side of '=' must be a variable (or an indexed variable). To compare values use '=='."); },
    funcDef: function () {
      var t0 = this.next(), outs = [], name, params = [];
      if (this.isOp("[")) { this.p++; while (!this.isOp("]")) { if (this.isOp(",")) { this.p++; continue; } var o = this.next(); if (o.t !== "id") throw this.fail("Invalid output name in function definition.", o); outs.push(o.v); } this.p++; this.expect("="); name = this.next(); }
      else { name = this.next(); if (this.isOp("=")) { this.p++; outs.push(name.v); name = this.next(); } }
      if (name.t !== "id") throw this.fail("Function definition needs a name, e.g.  function y = square(x)", name);
      if (this.isOp("(")) { this.p++; while (!this.isOp(")")) { if (this.isOp(",")) { this.p++; continue; } var a = this.next(); if (a.t === "op" && a.v === "~") { params.push("~"); continue; } if (a.t !== "id") throw this.fail("Invalid parameter name in function definition.", a); params.push(a.v); } this.p++; }
      var body = this.block({ "function": 1 });
      if (this.isKw("end")) this.p++;
      this.funcs[name.v] = { name: name.v, params: params, outs: outs, body: body, line: t0.line };
    },
    expr: function () { return this.orOr(); },
    orOr: function () { var l = this.andAnd(); while (this.isOp("||")) { this.p++; l = { type: "sc", op: "||", l: l, r: this.andAnd() }; } return l; },
    andAnd: function () { var l = this.or1(); while (this.isOp("&&")) { this.p++; l = { type: "sc", op: "&&", l: l, r: this.or1() }; } return l; },
    or1: function () { var l = this.and1(); while (this.isOp("|")) { this.p++; l = { type: "bin", op: "|", l: l, r: this.and1() }; } return l; },
    and1: function () { var l = this.cmp(); while (this.isOp("&")) { this.p++; l = { type: "bin", op: "&", l: l, r: this.cmp() }; } return l; },
    cmp: function () {
      var l = this.range();
      for (;;) { var t = this.peek(); if (t.t === "op" && (t.v === "==" || t.v === "~=" || t.v === "<" || t.v === "<=" || t.v === ">" || t.v === ">=")) { this.p++; l = { type: "bin", op: t.v, l: l, r: this.range() }; } else return l; }
    },
    range: function () {
      var a = this.add();
      if (this.isOp(":") && !this.colonEnds()) {
        this.p++; var b = this.add();
        if (this.isOp(":") && !this.colonEnds()) { this.p++; var c = this.add(); return { type: "range", a: a, s: b, b: c }; }
        return { type: "range", a: a, s: null, b: b };
      }
      return a;
    },
    colonEnds: function () { var n = this.peek(1); return n.t === "op" && (n.v === ")" || n.v === "," || n.v === "]" || n.v === "}"); },
    splitHere: function (t) { return this.mat && t.sp && !this.peek(1).sp; }, // [1 -2] is two elements, [1 - 2] is one
    add: function () {
      var l = this.mul();
      for (;;) { var t = this.peek(); if (t.t === "op" && (t.v === "+" || t.v === "-") && !this.splitHere(t)) { this.p++; l = { type: "bin", op: t.v, l: l, r: this.mul() }; } else return l; }
    },
    mul: function () {
      var l = this.unary();
      for (;;) { var t = this.peek(); if (t.t === "op" && (t.v === "*" || t.v === "/" || t.v === ".*" || t.v === "./" || t.v === "\\" || t.v === ".\\")) { this.p++; l = { type: "bin", op: t.v, l: l, r: this.unary() }; } else return l; }
    },
    unary: function () {
      var t = this.peek();
      if (t.t === "op" && (t.v === "-" || t.v === "+" || t.v === "~" || t.v === "!")) { this.p++; var e = this.unary(); return t.v === "+" ? { type: "un", op: "+", e: e } : { type: "un", op: t.v === "!" ? "~" : t.v, e: e }; }
      return this.pow();
    },
    pow: function () {
      var l = this.postfix();
      for (;;) {
        var t = this.peek();
        if (t.t === "op" && (t.v === "^" || t.v === ".^")) { this.p++; l = { type: "bin", op: t.v, l: l, r: this.powOperand() }; } else return l;
      }
    },
    powOperand: function () { var t = this.peek(); if (t.t === "op" && (t.v === "-" || t.v === "+" || t.v === "~")) { this.p++; return { type: "un", op: t.v, e: this.powOperand() }; } return this.postfix(); },
    args: function (close) {
      var out = [], save = this.mat; this.mat = false;
      while (!this.isOp(close)) {
        if (this.isOp(",")) { this.p++; continue; }
        if (this.isOp(":") && (this.isOp(",", 1) || this.isOp(close, 1))) { this.p++; out.push({ type: "colon" }); continue; }
        if (this.peek().t === "eof" || this.peek().t === "nl") throw this.fail("Expression or statement is incomplete or incorrect (missing '" + close + "').");
        out.push(this.expr());
        if (!this.isOp(",") && !this.isOp(close)) throw this.fail("Invalid expression near '" + this.peek().v + "'. Check for a missing comma, operator or bracket.");
      }
      this.p++; this.mat = save; return out;
    },
    postfix: function () {
      var e = this.primary();
      for (;;) {
        var t = this.peek();
        if (t.t !== "op") return e;
        if (t.v === "(") { if (this.mat && t.sp) return e; this.p++; e = { type: "idx", e: e, args: this.args(")"), k: "(" , line: t.line }; }
        else if (t.v === "{") { if (this.mat && t.sp) return e; this.p++; e = { type: "idx", e: e, args: this.args("}"), k: "{", line: t.line }; }
        else if (t.v === "." && !t.sp) {
          var n = this.peek(1);
          if (n.t === "id" || n.t === "kw") { this.p += 2; e = { type: "field", e: e, name: n.v }; }
          else if (n.t === "op" && n.v === "(") { this.p += 2; var save = this.mat; this.mat = false; var dn = this.expr(); this.mat = save; this.expect(")"); e = { type: "field", e: e, dyn: dn }; }
          else return e;
        }
        else if (t.v === "'" || t.v === ".'") { this.p++; e = { type: "post", op: t.v, e: e }; }
        else return e;
      }
    },
    primary: function () {
      var t = this.next();
      if (t.t === "num") return { type: "num", v: t.v, imag: t.imag };
      if (t.t === "str") return { type: "str", v: t.v, dq: t.dq };
      if (t.t === "id") return { type: "id", name: t.v, line: t.line };
      if (t.t === "end") return { type: "end" };
      if (t.t === "op") {
        if (t.v === "(") { var save = this.mat; this.mat = false; var e = this.expr(); this.mat = save; this.expect(")"); return { type: "paren", e: e }; }
        if (t.v === "[" || t.v === "{") {
          var close = t.v === "[" ? "]" : "}", rows = [], cur = [], sv = this.mat; this.mat = true;
          for (;;) {
            var x = this.peek();
            if (x.t === "eof") throw this.fail("Expression or statement is incomplete or incorrect (missing '" + close + "').", t);
            if (x.t === "op" && x.v === close) { this.p++; break; }
            if (x.t === "nl" || (x.t === "op" && x.v === ";")) { this.p++; if (cur.length) { rows.push(cur); cur = []; } continue; }
            if (x.t === "op" && x.v === ",") { this.p++; continue; }
            cur.push(this.expr());
          }
          if (cur.length) rows.push(cur);
          this.mat = sv; return { type: close === "]" ? "mat" : "cell", rows: rows };
        }
        if (t.v === "@") {
          if (this.isOp("(")) {
            this.p++; var params = [];
            while (!this.isOp(")")) { if (this.isOp(",")) { this.p++; continue; } var a = this.next(); if (a.t === "op" && a.v === "~") { params.push("~"); continue; } if (a.t !== "id") throw this.fail("Invalid anonymous function parameter.", a); params.push(a.v); }
            this.p++;
            var sm = this.mat; this.mat = false; var body = this.expr(); this.mat = sm;
            var endPos = this.toks[this.p - 1].e;
            return { type: "anon", params: params, body: body, src: this.src.slice(t.pos, endPos).replace(/\s+/g, "") };
          }
          var nm = this.next(); if (nm.t !== "id") throw this.fail("Invalid function handle. Use @name or @(x) expression.", nm);
          return { type: "fh", name: nm.v };
        }
        if (t.v === ":") return { type: "colonstr" };
      }
      if (t.t === "eof" || t.t === "nl") throw this.fail("Expression or statement is incomplete or incorrect.", t);
      throw this.fail(t.t === "kw" ? "Illegal use of reserved keyword \"" + t.v + "\"." : "Invalid expression near '" + t.v + "'. Check for a missing operand, or mismatched brackets.", t);
    }
  };

  /* ---------- number formatting ---------- */
  function pad(s, w) { s = String(s); while (s.length < w) s = " " + s; return s; }
  function padR(s, w) { s = String(s); while (s.length < w) s += " "; return s; }
  function isInt(x) { return x === Math.floor(x) && isFinite(x); }
  function special(x) { return x !== x ? "NaN" : x === Infinity ? "Inf" : x === -Infinity ? "-Inf" : null; }
  function expo(x, p) { var sp = special(x); if (sp) return sp; var s = x.toExponential(p), m = s.match(/^(.*)e([+-])(\d+)$/); return m[1] + "e" + m[2] + (m[3].length < 2 ? "0" + m[3] : m[3]); }
  function fixed(x, p) { var sp = special(x); if (sp) return sp; var s = x.toFixed(Math.max(0, Math.min(100, p))); return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s; }
  function fmtG(x, p, alt) {
    var sp = special(x); if (sp) return sp;
    if (x === 0) return "0";
    if (p < 1) p = 1;
    var e = parseInt(x.toExponential(p - 1).split("e")[1], 10), s;
    if (e < -4 || e >= p) { s = expo(x, p - 1); if (!alt) s = s.replace(/\.?0+e/, "e"); return s; }
    s = fixed(x, p - 1 - e); if (!alt && s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, ""); return s;
  }
  function intStr(x) { var sp = special(x); return sp || (x === 0 ? "0" : String(x)); }
  function scalarStr(x, long) { // the text MATLAB shows for a real scalar
    var sp = special(x); if (sp) return sp;
    if (isInt(x) && Math.abs(x) < 1e10) return intStr(x);
    var a = Math.abs(x);
    if (long) return (a >= 1000 || a < 0.001) ? expo(x, 15) : fixed(x, 15 - Math.max(0, Math.floor(Math.log10(a))));
    return (a >= 1000 || a < 0.001) ? expo(x, 4) : fixed(x, 4);
  }
  function scalarLine(x, long) {
    var s = scalarStr(x, long);
    if (isInt(x) && Math.abs(x) < 1e10 || special(x)) return pad(s, String(Math.abs(x)).length <= 3 || special(x) ? 6 : Math.max(12, s.length + 2));
    return /e/.test(s) ? "   " + (x < 0 ? "" : "") + pad(s, s.length) : pad(s, long ? 20 : 10);
  }
  function cplxStr(re, im, long) {
    function one(v) { var sp = special(v); if (sp) return sp; var a = Math.abs(v); return (a !== 0 && (a >= 1000 || a < 0.001)) ? expo(v, long ? 15 : 4) : fixed(v, long ? 15 : 4); }
    return one(re) + (im < 0 || Object.is(im, -0) ? " - " : " + ") + one(Math.abs(im)) + "i";
  }
  function sizeStr(v) { return v.r + "×" + v.c; }
  function matLines(v, long) { // rows of text for a numeric / logical / char matrix (no name)
    var r = v.r, c = v.c, d = v.d, i, j, lines = [], head = "";
    if (v.k === "c") { for (i = 0; i < r; i++) { var s = ""; for (j = 0; j < c; j++) s += String.fromCharCode(d[i + j * r]); lines.push("    '" + s + "'"); } return lines; }
    var strs = new Array(d.length), w;
    if (v.im) {
      var res = [], ims = [], sg = [];
      for (i = 0; i < d.length; i++) { var cs = cplxStr(d[i], v.im[i], long), m = cs.match(/^(.*) ([+-]) (.*)$/); res.push(m[1]); sg.push(m[2]); ims.push(m[3]); }
      var wr = 0, wi = 0; res.forEach(function (s) { wr = Math.max(wr, s.replace(/^-/, "").length + 1); }); ims.forEach(function (s) { wi = Math.max(wi, s.length); });
      for (i = 0; i < d.length; i++) strs[i] = pad(res[i], wr) + " " + sg[i] + " " + pad(ims[i], wi);
      w = wr + wi + 5;
    } else if (v.k === "l" || v.cls) {
      w = 0; for (i = 0; i < d.length; i++) { strs[i] = intStr(d[i]); w = Math.max(w, strs[i].length); } w += 3;
    } else {
      var allInt = true, mx = 0;
      for (i = 0; i < d.length; i++) { var x = d[i]; if (isFinite(x)) { if (x !== Math.floor(x)) allInt = false; if (Math.abs(x) > mx) mx = Math.abs(x); } }
      if (allInt && mx < 1e10) {
        var ml = 0; for (i = 0; i < d.length; i++) { strs[i] = intStr(d[i]); ml = Math.max(ml, strs[i].length); }
        w = String(mx).length <= 3 ? Math.max(6, ml + 2) : Math.max(12, ml + 2);
      } else if (long) {
        var big = mx >= 1000 || mx < 0.001; w = 0;
        for (i = 0; i < d.length; i++) { strs[i] = d[i] === 0 ? "0" : big ? expo(d[i], 15) : fixed(d[i], 15 - Math.max(0, Math.floor(Math.log10(mx)))); w = Math.max(w, strs[i].length); } w += 3;
      } else {
        var scale = 1;
        if (mx >= 1000 || (mx < 0.001 && mx > 0)) { var e = Math.floor(Math.log10(mx)); scale = Math.pow(10, e); head = "   1.0e" + (e < 0 ? "-" : "+") + (Math.abs(e) < 10 ? "0" : "") + Math.abs(e) + " *"; }
        w = 10; for (i = 0; i < d.length; i++) { strs[i] = d[i] === 0 ? "0" : fixed(d[i] / scale, 4); w = Math.max(w, strs[i].length + 2); }
      }
    }
    var per = Math.max(1, Math.floor(80 / w)), start;
    if (head) lines.push(head, "");
    for (start = 0; start < c; start += per) {
      var stop = Math.min(c, start + per);
      if (c > per) { if (start > 0) lines.push(""); lines.push(stop - start === 1 ? "  Column " + (start + 1) : "  Columns " + (start + 1) + " through " + stop, ""); }
      for (i = 0; i < r; i++) { var ln = ""; for (j = start; j < stop; j++) ln += (v.im ? "  " : "") + pad(strs[i + j * r], v.im ? w - 2 : w); lines.push(ln); }
    }
    return lines;
  }
  function brief(v) { // short description used inside cells and structs
    if (v.t === "m") {
      if (v.k === "c" && v.r <= 1) return "'" + text(v) + "'";
      if (v.r === 1 && v.c >= 1 && v.c <= 10 && v.k !== "c") { var parts = []; for (var i = 0; i < v.c; i++) parts.push(v.im ? cplxStr(v.d[i], v.im[i]).replace(/ /g, "") : scalarStr(v.d[i])); return v.c === 1 ? parts[0] : "[" + parts.join(" ") + "]"; }
      return "[" + sizeStr(v) + " " + className(v) + "]";
    }
    if (v.t === "s") return '"' + v.v + '"';
    if (v.t === "c") return "{" + sizeStr(v) + " cell}";
    if (v.t === "st") return "[1×1 struct]";
    if (v.t === "sa") return "[" + sizeStr(v) + " struct]";
    if (v.t === "f") return fhStr(v);
    return "[" + className(v) + "]";
  }
  function fhStr(v) { return v.name ? "@" + v.name : v.src; }
  function bodyLines(v, I) { // display body (without the "name =" line), as lines
    var long = I && I.format === "long";
    if (v.t === "m") {
      var n = v.r * v.c, cn = className(v);
      if (n === 0) return [v.k === "c" ? "  " + sizeStr(v) + " empty char array" : v.r === 0 && v.c === 0 && cn === "double" ? "     []" : "  " + sizeStr(v) + " empty " + cn + (v.r === 1 ? " row vector" : v.c === 1 ? " column vector" : " matrix")];
      if (v.k === "c") return v.r === 1 ? matLines(v) : ["  " + sizeStr(v) + " char array", ""].concat(matLines(v));
      if (v.k === "l" || v.cls) {
        var lines = matLines(v);
        return [n === 1 ? "  " + cn : "  " + sizeStr(v) + " " + cn + (v.r === 1 ? " row vector" : v.c === 1 ? " column vector" : v.k === "l" ? " array" : " matrix").replace(v.k === "l" ? /row vector|column vector|matrix/ : /^$/, "array"), ""].concat(lines);
      }
      if (n === 1) return [v.im ? (v.d[0] < 0 ? "  " : "   ") + cplxStr(v.d[0], v.im[0], long) : scalarLine(v.d[0], long)];
      return matLines(v, long);
    }
    if (v.t === "s") return ['    "' + v.v + '"'];
    if (v.t === "f") return ["  function_handle with value:", "", "    " + fhStr(v)];
    if (v.t === "c") {
      if (!v.d.length) return ["  " + sizeStr(v) + " empty cell array"];
      var out = ["  " + sizeStr(v) + " cell array", ""], widths = [], i, j, s;
      function item(x) { if (x.t === "m" && x.k !== "c") { if (x.r * x.c === 0) return "{0×0 double}"; if (x.r === 1 && x.c <= 10) return "{" + (x.c === 1 ? "[" + brief(x) + "]" : brief(x)) + "}"; return "{" + sizeStr(x) + " " + className(x) + "}"; } if (x.t === "m" || x.t === "f") return "{" + brief(x) + "}"; if (x.t === "s") return '{["' + x.v + '"]}'; return "{" + (x.t === "c" ? sizeStr(x) + " cell" : x.t === "st" ? "1×1 struct" : sizeStr(x) + " struct") + "}"; }
      for (j = 0; j < v.c; j++) { widths[j] = 0; for (i = 0; i < v.r; i++) widths[j] = Math.max(widths[j], item(v.d[i + j * v.r]).length); }
      for (i = 0; i < v.r; i++) { s = ""; for (j = 0; j < v.c; j++) s += "    " + padR(item(v.d[i + j * v.r]), widths[j]); out.push(s.replace(/\s+$/, "")); }
      return out;
    }
    if (v.t === "st") {
      var keys = Object.keys(v.f); if (!keys.length) return ["  struct with no fields."];
      var w = 0; keys.forEach(function (k) { w = Math.max(w, k.length); });
      return ["  struct with fields:", ""].concat(keys.map(function (k) { return "    " + pad(k, w) + ": " + brief(v.f[k]); }));
    }
    if (v.t === "sa") { var ks = v.d.length ? Object.keys(v.d[0].f) : (v.keys || []); return ["  " + sizeStr(v) + " struct array with fields:", ""].concat(ks.map(function (k) { return "    " + k; })); }
    if (I && I.ext.display && I.ext.display[v.t]) return I.ext.display[v.t](v, I);
    return ["  " + className(v)];
  }
  function showNamed(name, v, I) {
    var body = bodyLines(v, I).join("\n");
    return I.compact ? name + " =\n" + body + "\n" : name + " =\n\n" + body + "\n\n";
  }

  /* ---------- element-wise engine ---------- */
  function bdim(a, b) { return a === b ? a : a === 1 ? b : b === 1 ? a : -1; }
  function ew(a, b, fr, fc, kind) {
    var r = bdim(a.r, b.r), c = bdim(a.c, b.c);
    if (r < 0 || c < 0) throw err("Arrays have incompatible sizes for this operation.");
    var n = r * c, d = new Array(n), out, i, j, ia, ib, same = a.r === r && a.c === c && b.r === r && b.c === c;
    if (!a.im && !b.im) {
      if (same) for (i = 0; i < n; i++) d[i] = fr(a.d[i], b.d[i]);
      else if (a.d.length === 1 && b.r === r && b.c === c) { var x = a.d[0]; for (i = 0; i < n; i++) d[i] = fr(x, b.d[i]); }
      else if (b.d.length === 1 && a.r === r && a.c === c) { var y = b.d[0]; for (i = 0; i < n; i++) d[i] = fr(a.d[i], y); }
      else for (j = 0; j < c; j++) for (i = 0; i < r; i++) d[i + j * r] = fr(a.d[(a.r === 1 ? 0 : i) + (a.c === 1 ? 0 : j) * a.r], b.d[(b.r === 1 ? 0 : i) + (b.c === 1 ? 0 : j) * b.r]);
      out = M(r, c, d, null, kind);
    } else {
      if (!fc) throw err("This operation is not supported for complex values.");
      var im = new Array(n), o = [0, 0], any = false;
      for (j = 0; j < c; j++) for (i = 0; i < r; i++) {
        ia = (a.r === 1 ? 0 : i) + (a.c === 1 ? 0 : j) * a.r; ib = (b.r === 1 ? 0 : i) + (b.c === 1 ? 0 : j) * b.r;
        fc(a.d[ia], a.im ? a.im[ia] : 0, b.d[ib], b.im ? b.im[ib] : 0, o);
        d[i + j * r] = o[0]; im[i + j * r] = o[1]; if (o[1] !== 0) any = true;
      }
      out = M(r, c, d, any && kind !== "l" ? im : null, kind);
    }
    var cls = a.cls || b.cls;
    if (cls && kind !== "l" && INT[cls]) out = castInt(out, cls); else if (cls === "single" && kind !== "l") out.cls = "single";
    return out;
  }
  var C = {
    add: function (a, b, c, d, o) { o[0] = a + c; o[1] = b + d; },
    sub: function (a, b, c, d, o) { o[0] = a - c; o[1] = b - d; },
    mul: function (a, b, c, d, o) { o[0] = a * c - b * d; o[1] = a * d + b * c; },
    div: function (a, b, c, d, o) {
      if (d === 0) { o[0] = a / c; o[1] = b === 0 ? 0 : b / c; return; }
      var den = c * c + d * d; o[0] = (a * c + b * d) / den; o[1] = (b * c - a * d) / den;
    },
    pow: function (a, b, c, d, o) {
      if (a === 0 && b === 0) { o[0] = (c === 0 && d === 0) ? 1 : 0; o[1] = 0; return; }
      if (b === 0 && d === 0 && (a > 0 || c === Math.floor(c))) { o[0] = Math.pow(a, c); o[1] = 0; return; }
      var lr = Math.log(Math.sqrt(a * a + b * b)), th = Math.atan2(b, a), er = Math.exp(c * lr - d * th), ang = d * lr + c * th;
      o[0] = er * Math.cos(ang); o[1] = er * Math.sin(ang);
      if (Math.abs(o[1]) < 1e-15 * Math.abs(o[0])) o[1] = 0; if (Math.abs(o[0]) < 1e-15 * Math.abs(o[1])) o[0] = 0;
    }
  };
  function cmpC(f, eq) { return function (a, b, c, d, o) { o[0] = eq === 1 ? (a === c && b === d ? 1 : 0) : eq === 2 ? (a !== c || b !== d ? 1 : 0) : f(a, c); o[1] = 0; }; }
  function powR(x, y) { return Math.pow(x, y); }
  function needsComplexPow(a, b) {
    if (a.im || b.im) return true;
    var anyNeg = false, anyFrac = false, i;
    for (i = 0; i < a.d.length; i++) if (a.d[i] < 0) { anyNeg = true; break; }
    if (!anyNeg) return false;
    for (i = 0; i < b.d.length; i++) if (b.d[i] !== Math.floor(b.d[i])) { anyFrac = true; break; }
    return anyFrac;
  }
  function withIm(a) { return a.im ? a : { t: "m", r: a.r, c: a.c, d: a.d, im: a.d.map(function () { return 0; }), k: a.k }; }
  function asNum(v, op) {
    if (v.t === "m") return v;
    throw err("Operator '" + op + "' is not supported for operands of type '" + className(v) + "'.");
  }
  function matmul(a, b) {
    if (a.d.length === 1 || b.d.length === 1) return ew(a, b, function (x, y) { return x * y; }, C.mul);
    if (a.c !== b.r) throw err("Incorrect dimensions for matrix multiplication. Check that the number of columns in the first matrix matches the number of rows in the second matrix. To operate on each element of the matrix individually, use TIMES (.*) for elementwise multiplication.");
    var r = a.r, c = b.c, n = a.c, d = new Array(r * c), i, j, k, s;
    if (!a.im && !b.im) { for (j = 0; j < c; j++) for (i = 0; i < r; i++) { s = 0; for (k = 0; k < n; k++) s += a.d[i + k * r] * b.d[k + j * n]; d[i + j * r] = s; } return M(r, c, d); }
    var A = withIm(a), B = withIm(b), im = new Array(r * c), si, any = false;
    for (j = 0; j < c; j++) for (i = 0; i < r; i++) { s = 0; si = 0; for (k = 0; k < n; k++) { var ar = A.d[i + k * r], ai = A.im[i + k * r], br = B.d[k + j * n], bi = B.im[k + j * n]; s += ar * br - ai * bi; si += ar * bi + ai * br; } d[i + j * r] = s; im[i + j * r] = si; if (si !== 0) any = true; }
    return M(r, c, d, any ? im : null);
  }
  function transpose(a, conj) {
    if (a.t === "c") { var cd = new Array(a.d.length); for (var q = 0; q < a.c; q++) for (var p = 0; p < a.r; p++) cd[q + p * a.c] = a.d[p + q * a.r]; return cell(a.c, a.r, cd); }
    if (a.t !== "m") throw err("Transpose is not supported for operands of type '" + className(a) + "'.");
    var r = a.r, c = a.c, d = new Array(r * c), im = a.im ? new Array(r * c) : null, i, j;
    for (j = 0; j < c; j++) for (i = 0; i < r; i++) { d[j + i * c] = a.d[i + j * r]; if (im) im[j + i * c] = conj ? -a.im[i + j * r] : a.im[i + j * r]; }
    var o = M(c, r, d, im, a.k); if (a.cls) o.cls = a.cls; return o;
  }
  /* solve A x = B (A square) with partial pivoting; complex aware */
  function solve(A, B, I) {
    var n = A.r, m = B.c, cx = !!(A.im || B.im), a = A.d.slice(), ai = cx ? withIm(A).im.slice() : null, b = B.d.slice(), bi = cx ? withIm(B).im.slice() : null, i, j, k, o = [0, 0], singular = false;
    for (k = 0; k < n; k++) {
      var p = k, best = -1;
      for (i = k; i < n; i++) { var mag = cx ? Math.hypot(a[i + k * n], ai[i + k * n]) : Math.abs(a[i + k * n]); if (mag > best) { best = mag; p = i; } }
      if (best < 1e-300 || best !== best) { singular = true; continue; }
      if (p !== k) { for (j = 0; j < n; j++) { var t = a[k + j * n]; a[k + j * n] = a[p + j * n]; a[p + j * n] = t; if (cx) { t = ai[k + j * n]; ai[k + j * n] = ai[p + j * n]; ai[p + j * n] = t; } } for (j = 0; j < m; j++) { var u = b[k + j * n]; b[k + j * n] = b[p + j * n]; b[p + j * n] = u; if (cx) { u = bi[k + j * n]; bi[k + j * n] = bi[p + j * n]; bi[p + j * n] = u; } } }
      for (i = k + 1; i < n; i++) {
        var fr, fi = 0;
        if (cx) { C.div(a[i + k * n], ai[i + k * n], a[k + k * n], ai[k + k * n], o); fr = o[0]; fi = o[1]; } else fr = a[i + k * n] / a[k + k * n];
        if (fr === 0 && fi === 0) continue;
        for (j = k; j < n; j++) { if (cx) { var xr = a[k + j * n], xi = ai[k + j * n]; a[i + j * n] -= fr * xr - fi * xi; ai[i + j * n] -= fr * xi + fi * xr; } else a[i + j * n] -= fr * a[k + j * n]; }
        for (j = 0; j < m; j++) { if (cx) { var yr = b[k + j * n], yi = bi[k + j * n]; b[i + j * n] -= fr * yr - fi * yi; bi[i + j * n] -= fr * yi + fi * yr; } else b[i + j * n] -= fr * b[k + j * n]; }
      }
    }
    // conditioning check (cheap): compare pivots
    var pmax = 0, pmin = Infinity; for (k = 0; k < n; k++) { var pv = cx ? Math.hypot(a[k + k * n], ai[k + k * n]) : Math.abs(a[k + k * n]); pmax = Math.max(pmax, pv); pmin = Math.min(pmin, pv); }
    if (singular || pmin === 0) { if (I) I.warn("Matrix is singular to working precision."); var inf = new Array(n * m); for (i = 0; i < inf.length; i++) inf[i] = Infinity; return M(n, m, inf); }
    if (pmin / pmax < 1e-15 && I) I.warn("Matrix is close to singular or badly scaled. Results may be inaccurate.");
    for (j = 0; j < m; j++) for (i = n - 1; i >= 0; i--) {
      var sr = b[i + j * n], si = cx ? bi[i + j * n] : 0;
      for (k = i + 1; k < n; k++) { if (cx) { sr -= a[i + k * n] * b[k + j * n] - ai[i + k * n] * bi[k + j * n]; si -= a[i + k * n] * bi[k + j * n] + ai[i + k * n] * b[k + j * n]; } else sr -= a[i + k * n] * b[k + j * n]; }
      if (cx) { C.div(sr, si, a[i + i * n], ai[i + i * n], o); b[i + j * n] = o[0]; bi[i + j * n] = o[1]; } else b[i + j * n] = sr / a[i + i * n];
    }
    var anyIm = false; if (cx) for (i = 0; i < bi.length; i++) if (Math.abs(bi[i]) > 0) { anyIm = true; break; }
    return M(n, m, b, anyIm ? bi : null);
  }
  function mldivide(A, B, I) {
    if (A.d.length === 1) return ew(B, A, function (x, y) { return x / y; }, C.div);
    if (A.r !== B.r) throw err("Matrix dimensions must agree: in A\\b the number of rows of A (" + A.r + ") must equal the number of rows of b (" + B.r + ").");
    if (A.r === A.c) return solve(A, B, I);
    var At = transpose(A, true); return solve(matmul(At, A), matmul(At, B), I); // least squares (normal equations)
  }
  function mpower(a, b, I) {
    if (a.d.length === 1 && b.d.length === 1) return ew(needsComplexPow(a, b) ? withIm(a) : a, b, powR, C.pow);
    if (b.d.length === 1 && a.r === a.c && isInt(b.d[0]) && !b.im) {
      var p = b.d[0], base = a, res = null;
      if (p < 0) { base = solve(a, eye(a.r), I); p = -p; }
      if (p === 0) return eye(a.r);
      while (p > 0) { if (p & 1) res = res ? matmul(res, base) : base; base = matmul(base, base); p = Math.floor(p / 2); }
      return res;
    }
    if (a.r !== a.c && b.d.length === 1) throw err("Incorrect dimensions for raising a matrix to a power. Check that the matrix is square and the power is a scalar. To operate on each element of the matrix individually, use POWER (.^) for elementwise power.");
    throw err("This form of matrix power is not supported by the browser runner. Use .^ for element-wise power, or run this line in real MATLAB.");
  }
  function eye(n, m) { var o = zeros(n, m === undefined ? n : m); for (var i = 0; i < Math.min(o.r, o.c); i++) o.d[i + i * o.r] = 1; return o; }
  function strOperand(v) { return v.t === "s" ? v.v : v.t === "m" && v.k === "c" ? text(v) : v.t === "m" && v.d.length === 1 ? fmtG(v.d[0], 5) : null; }
  function binop(op, a, b, I) {
    if (a.t !== "m" || b.t !== "m") {
      if (a.t === "s" || b.t === "s") {
        var sa = strOperand(a), sb = strOperand(b);
        if (sa !== null && sb !== null) {
          if (op === "+") return { t: "s", v: sa + sb };
          if (op === "==") return bool(sa === sb); if (op === "~=") return bool(sa !== sb);
          if (op === "<") return bool(sa < sb); if (op === ">") return bool(sa > sb); if (op === "<=") return bool(sa <= sb); if (op === ">=") return bool(sa >= sb);
        }
      }
      var h = I && (I.ext.binop[a.t] || I.ext.binop[b.t]);
      if (h) return h(op, a, b, I);
      throw err("Operator '" + op + "' is not supported for operands of type '" + className(a.t !== "m" ? a : b) + "'.");
    }
    switch (op) {
      case "+": return ew(a, b, function (x, y) { return x + y; }, C.add);
      case "-": return ew(a, b, function (x, y) { return x - y; }, C.sub);
      case ".*": return ew(a, b, function (x, y) { return x * y; }, C.mul);
      case "./": return ew(a, b, function (x, y) { return x / y; }, C.div);
      case ".\\": return ew(b, a, function (x, y) { return x / y; }, C.div);
      case ".^": return needsComplexPow(a, b) ? ew(withIm(a), b, powR, C.pow) : ew(a, b, powR, C.pow);
      case "*": return matmul(a, b);
      case "/":
        if (b.d.length === 1) return ew(a, b, function (x, y) { return x / y; }, C.div);
        if (a.c !== b.c) throw err("Matrix dimensions must agree: in A/B both must have the same number of columns. To divide element by element use ./");
        return transpose(mldivide(transpose(b, true), transpose(a, true), I), true);
      case "\\": return mldivide(a, b, I);
      case "^": return mpower(a, b, I);
      case "==": return ew(a, b, function (x, y) { return x === y ? 1 : 0; }, cmpC(null, 1), "l");
      case "~=": return ew(a, b, function (x, y) { return x !== y ? 1 : 0; }, cmpC(null, 2), "l");
      case "<": return ew(a, b, function (x, y) { return x < y ? 1 : 0; }, cmpC(function (x, y) { return x < y ? 1 : 0; }), "l");
      case "<=": return ew(a, b, function (x, y) { return x <= y ? 1 : 0; }, cmpC(function (x, y) { return x <= y ? 1 : 0; }), "l");
      case ">": return ew(a, b, function (x, y) { return x > y ? 1 : 0; }, cmpC(function (x, y) { return x > y ? 1 : 0; }), "l");
      case ">=": return ew(a, b, function (x, y) { return x >= y ? 1 : 0; }, cmpC(function (x, y) { return x >= y ? 1 : 0; }), "l");
      case "&": return ew(a, b, function (x, y) { return x !== 0 && y !== 0 ? 1 : 0; }, null, "l");
      case "|": return ew(a, b, function (x, y) { return x !== 0 || y !== 0 ? 1 : 0; }, null, "l");
    }
    throw err("Unknown operator " + op);
  }

  /* ---------- indexing ---------- */
  var COLON = { colon: true };
  function idxList(arg, len, pos, nargs) { // -> {all:true} | {i:[0-based], r, c, mask}
    if (arg === COLON) return { all: true, n: len };
    if (arg.t === "m" && arg.k === "c" && arg.d.length === 1 && arg.d[0] === 58) return { all: true, n: len };
    if (arg.t !== "m") throw err("Array indices must be positive integers or logical values.");
    var out = [], i, d = arg.d;
    if (arg.k === "l") {
      if (d.length > len) { for (i = len; i < d.length; i++) if (d[i]) throw err("The logical indices contain a true value outside of the array bounds."); }
      for (i = 0; i < d.length; i++) if (d[i]) out.push(i);
      return { i: out, r: arg.r, c: arg.c, mask: true, max: out.length ? out[out.length - 1] + 1 : 0 };
    }
    var mx = 0;
    for (i = 0; i < d.length; i++) {
      var x = d[i];
      if (x !== Math.floor(x) || x < 1 || !isFinite(x)) throw err(x === 0 ? "Index in position " + (pos + 1) + " is invalid. Array indices must be positive integers or logical values. (MATLAB counts from 1, not 0.)" : "Array indices must be positive integers or logical values.");
      if (x > mx) mx = x; out.push(x - 1);
    }
    return { i: out, r: arg.r, c: arg.c, max: mx };
  }
  function getPositions(v, args) { // -> {pos:[...], r, c}
    var R = v.r, Cc = v.c, n = R * Cc, pos, i, j;
    if (args.length === 1) {
      var L = idxList(args[0], n, 0, 1);
      if (L.all) { pos = new Array(n); for (i = 0; i < n; i++) pos[i] = i; return { pos: pos, r: n, c: 1 }; }
      if (L.max > n) throw err("Index exceeds the number of array elements. Index must not exceed " + n + ".");
      var k = L.i.length, r, c;
      if (L.mask) { if (R === 1 && L.r <= 1) { r = 1; c = k; } else { r = k; c = 1; } if (R !== 1 && Cc === 1) { r = k; c = 1; } if (R === 1 && n > 0) { r = 1; c = k; } }
      else if (L.r !== 1 && L.c !== 1) { r = L.r; c = L.c; }
      else if (R === 1 && Cc !== 1) { r = 1; c = k; }
      else if (Cc === 1 && R !== 1) { r = k; c = 1; }
      else { r = L.r; c = L.c; if (L.r * L.c !== k) { r = 1; c = k; } }
      return { pos: L.i, r: r, c: c };
    }
    if (args.length > 2) { for (i = 2; i < args.length; i++) { var extra = idxList(args[i], 1, i, args.length); if (!extra.all && !(extra.i.length === 1 && extra.i[0] === 0)) throw err("Index in position " + (i + 1) + " exceeds array bounds. This runner supports 2-D arrays only."); } }
    var Ri = idxList(args[0], R, 0, 2), Ci = idxList(args[1], Cc, 1, 2), rows = Ri.all ? null : Ri.i, cols = Ci.all ? null : Ci.i;
    if (!Ri.all && Ri.max > R) throw err("Index in position 1 exceeds array bounds. Index must not exceed " + R + ".");
    if (!Ci.all && Ci.max > Cc) throw err("Index in position 2 exceeds array bounds. Index must not exceed " + Cc + ".");
    var nr = rows ? rows.length : R, nc = cols ? cols.length : Cc; pos = new Array(nr * nc);
    for (j = 0; j < nc; j++) { var cj = cols ? cols[j] : j; for (i = 0; i < nr; i++) pos[i + j * nr] = (rows ? rows[i] : i) + cj * R; }
    return { pos: pos, r: nr, c: nc };
  }
  function indexGet(v, args) {
    if (!args.length) return v;
    if (v.t === "st") v = { t: "sa", r: 1, c: 1, d: [v] };
    if (v.t === "s") { var one = getPositions({ r: 1, c: 1 }, args); if (one.pos.length === 1) return v; throw err("Index exceeds the number of array elements. A string is a single element; use char(s) or extractBetween to reach its characters."); }
    var P = getPositions(v, args), n = P.pos.length, d = new Array(n), i;
    for (i = 0; i < n; i++) d[i] = v.d[P.pos[i]];
    if (v.t === "c") return cell(P.r, P.c, d);
    if (v.t === "sa") return n === 1 ? d[0] : { t: "sa", r: P.r, c: P.c, d: d };
    var im = null; if (v.im) { im = new Array(n); var any = false; for (i = 0; i < n; i++) { im[i] = v.im[P.pos[i]]; if (im[i] !== 0) any = true; } if (!any) im = null; }
    var o = M(P.r, P.c, d, im, v.k); if (v.cls) o.cls = v.cls; return o;
  }
  function fillValue(v) { return v.t === "c" ? empty() : v.t === "sa" ? null : 0; }
  function resize(v, nr, nc) { // returns storage copy with new shape (zero fill)
    var d = new Array(nr * nc), im = v.im ? new Array(nr * nc) : null, f = fillValue(v), i, j;
    for (j = 0; j < nc; j++) for (i = 0; i < nr; i++) { var inside = i < v.r && j < v.c; d[i + j * nr] = inside ? v.d[i + j * v.r] : (v.t === "sa" ? struct(blankFields(v)) : f); if (im) im[i + j * nr] = inside ? v.im[i + j * v.r] : 0; }
    var o = { t: v.t, r: nr, c: nc, d: d }; if (v.t === "m") { o.im = im; o.k = v.k; if (v.cls) o.cls = v.cls; } return o;
  }
  function blankFields(sa) { var f = {}; if (sa.d.length) Object.keys(sa.d[0].f).forEach(function (k) { f[k] = empty(); }); return f; }
  function own(v) { // a private (unshared) shallow copy
    var o;
    if (v.t === "m") { o = M(v.r, v.c, v.d.slice(), v.im ? v.im.slice() : null, v.k); if (v.cls) o.cls = v.cls; return o; }
    if (v.t === "c" || v.t === "sa") { v.d.forEach(function (x) { if (x) x.shared = true; }); return { t: v.t, r: v.r, c: v.c, d: v.d.slice() }; }
    if (v.t === "st") { o = struct({}); Object.keys(v.f).forEach(function (k) { v.f[k].shared = true; o.f[k] = v.f[k]; }); return o; }
    return v;
  }
  function indexSet(v, args, rhs, isDelete) { // () assignment; returns the updated container
    if (v === undefined || v === null) v = rhs.t === "c" ? cell(0, 0, []) : rhs.t === "st" || rhs.t === "sa" ? { t: "sa", r: 0, c: 0, d: [] } : M(0, 0, [], null, rhs.t === "m" ? rhs.k : "d");
    if (v.t === "st") v = { t: "sa", r: 1, c: 1, d: [v] };
    if (v.t === "s") { if (args.length === 1 && args[0].t === "m" && args[0].d.length === 1 && args[0].d[0] === 1) return rhs; throw err("String arrays beyond a single string are not supported by the browser runner."); }
    if (v.t !== "m" && v.t !== "c" && v.t !== "sa") throw err("Unable to use () assignment on a value of type '" + className(v) + "'.");
    var R = v.r, Cc = v.c, n = R * Cc, i, j, pos, cnt, nr = R, nc = Cc;
    if (isDelete) {
      var keep;
      if (args.length === 1) {
        var L = idxList(args[0], n, 0, 1), del = {}; if (L.all) return v.t === "m" ? M(0, 0, [], null, v.k) : { t: v.t, r: 0, c: 0, d: [] };
        L.i.forEach(function (p) { del[p] = 1; }); keep = []; for (i = 0; i < n; i++) if (!del[i]) keep.push(i);
        var src = (Cc === 1 && R !== 1) ? { r: keep.length, c: 1 } : { r: 1, c: keep.length };
        var o1 = { t: v.t, r: src.r, c: src.c, d: keep.map(function (p) { return v.d[p]; }) }; if (v.t === "m") { o1.k = v.k; o1.im = v.im ? keep.map(function (p) { return v.im[p]; }) : null; } return o1;
      }
      var Ri = idxList(args[0], R, 0, 2), Ci = idxList(args[1], Cc, 1, 2);
      if (!Ri.all && !Ci.all) throw err("A null assignment can have only one non-colon index.");
      var rows = [], cols = [], dd = {};
      if (Ri.all) { Ci.i.forEach(function (p) { dd[p] = 1; }); for (j = 0; j < Cc; j++) if (!dd[j]) cols.push(num(j + 1).d[0]); return indexGet(v, [COLON, M(1, cols.length, cols)]); }
      Ri.i.forEach(function (p) { dd[p] = 1; }); for (i = 0; i < R; i++) if (!dd[i]) rows.push(i + 1); return indexGet(v, [M(1, rows.length, rows), COLON]);
    }
    if (v.t === "c" && rhs.t !== "c") rhs = cell(1, 1, [rhs]);
    if (v.t === "sa") { if (rhs.t !== "st" && rhs.t !== "sa") throw err("Assignment to a struct array element needs a struct on the right side."); if (rhs.t === "st") rhs = { t: "sa", r: 1, c: 1, d: [rhs] }; }
    if (v.t === "m" && rhs.t !== "m") {
      if (n === 0 && (rhs.t === "c" )) return indexSet(cell(0, 0, []), args, rhs);
      throw err("Unable to perform assignment because value of type '" + className(rhs) + "' is not convertible to '" + className(v) + "'. (Use a cell array with { } to mix types.)");
    }
    if (args.length === 1) {
      var L1 = idxList(args[0], n, 0, 1);
      if (L1.all) { pos = new Array(n); for (i = 0; i < n; i++) pos[i] = i; if (n === 0 && numel(rhs) > 0) { nr = numel(rhs); nc = 1; pos = new Array(nr); for (i = 0; i < nr; i++) pos[i] = i; } }
      else {
        pos = L1.i;
        if (L1.max > n) {
          if (n === 0) { if (rhs.c === 1 && rhs.r > 1 && !L1.mask) { nr = L1.max; nc = 1; } else { nr = 1; nc = L1.max; } }
          else if (R === 1) nc = L1.max; else if (Cc === 1) nr = L1.max;
          else throw err("Attempt to grow array along ambiguous index dimension.");
        }
      }
    } else {
      if (args.length > 2) throw err("This runner supports 2-D arrays only (use at most two indices).");
      var Rj = idxList(args[0], R, 0, 2), Cj = idxList(args[1], Cc, 1, 2), rc = numel(rhs);
      if (Rj.all && R === 0) { Rj = { i: [], max: 0 }; var need = Cj.all ? rhs.r : (rc === 1 ? 1 : rhs.r); for (i = 0; i < need; i++) Rj.i.push(i); Rj.max = need; }
      if (Cj.all && Cc === 0) { Cj = { i: [], max: 0 }; var need2 = rc === 1 ? 1 : rhs.c; for (i = 0; i < need2; i++) Cj.i.push(i); Cj.max = need2; }
      var rws = Rj.all ? null : Rj.i, cls = Cj.all ? null : Cj.i;
      if (rws && Rj.max > nr) nr = Rj.max; if (cls && Cj.max > nc) nc = Cj.max;
      var kr = rws ? rws.length : nr, kc = cls ? cls.length : nc; pos = new Array(kr * kc);
      for (j = 0; j < kc; j++) for (i = 0; i < kr; i++) pos[i + j * kr] = (rws ? rws[i] : i) + (cls ? cls[j] : j) * nr;
      if (rc !== 1 && rc === kr * kc && (rhs.r !== kr) && !(rhs.r === 1 || rhs.c === 1)) throw err("Unable to perform assignment because the size of the left side is " + kr + "-by-" + kc + " and the size of the right side is " + rhs.r + "-by-" + rhs.c + ".");
    }
    cnt = numel(rhs);
    if (cnt !== 1 && cnt !== pos.length) throw err(args.length === 1 ? "Unable to perform assignment because the left and right sides have a different number of elements." : "Unable to perform assignment because the size of the left side is " + (pos.length) + " element(s) and the size of the right side is " + rhs.r + "-by-" + rhs.c + ".");
    var out = (nr !== R || nc !== Cc) ? resize(v, nr, nc) : (v.shared ? own(v) : v);
    if (out.t === "m") {
      if (rhs.im && !out.im) { out.im = out.d.map(function () { return 0; }); }
      if (out.k !== rhs.k) { if (n === 0 && !v.cls) out.k = rhs.k; else if (out.k === "l" || out.k === "c" || true) out.k = (out.k === rhs.k) ? out.k : (out.k === "c" && rhs.k === "c" ? "c" : "d"); }
      if (rhs.cls && n === 0) out.cls = rhs.cls;
      for (i = 0; i < pos.length; i++) { var s = cnt === 1 ? 0 : i; out.d[pos[i]] = out.cls && INT[out.cls] ? Math.max(INT[out.cls][0], Math.min(INT[out.cls][1], mround(rhs.d[s]))) : rhs.d[s]; if (out.im) out.im[pos[i]] = rhs.im ? rhs.im[s] : 0; }
    } else for (i = 0; i < pos.length; i++) { var e = rhs.d[cnt === 1 ? 0 : i]; e.shared = true; out.d[pos[i]] = e; }
    return out;
  }

  /* ---------- interpreter ---------- */
  var BREAK = { sig: "break" }, CONT = { sig: "continue" }, RET = { sig: "return" };
  var B = {};       // builtins: name -> function(args, nargout, I) -> value | [values] | undefined
  var UNSUPPORTED = {}; // name -> reason
  function Interp(opts) {
    opts = opts || {};
    this.globals = Object.create(null); this.base = { vars: Object.create(null), name: "" }; this.funcs = {};
    this.out = ""; this.figs = []; this.fig = null; this.format = "short"; this.compact = false;
    this.maxSteps = opts.maxSteps || 4e6; this.maxMs = opts.maxMs || 4000; this.maxOut = opts.maxOut || 200000;
    this.inputs = opts.inputs || null; this.onInput = opts.onInput || null;
    this.ext = { binop: {}, display: {}, unop: {} };
    this.seed = 0; this.depth = 0; this.warnings = 0; this.ticStart = Date.now();
    for (var k in Interp.ext) Interp.ext[k](this);
  }
  Interp.ext = {};
  Interp.prototype = {
    print: function (s) { this.out += s; if (this.out.length > this.maxOut) throw fatal("Stopped: the output is too long (over " + this.maxOut + " characters). Add semicolons to hide results inside loops."); },
    warn: function (msg) { this.warnings++; this.print("Warning: " + msg + "\n"); },
    rand: function () { if (!this.seed) return Math.random(); this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; },
    tick: function () { if (++this.steps > this.maxSteps || ((this.steps & 2047) === 0 && Date.now() - this.t0 > this.maxMs)) throw fatal("Stopped: the code ran for too long. Check for an infinite loop (a while condition that never becomes false)."); },
    run: function (src) {
      this.out = ""; this.steps = 0; this.t0 = Date.now(); this.depth = 0; var error = null, self = this;
      try {
        var prog = new Parser(String(src).replace(/\r\n?/g, "\n")).program();
        for (var f in prog.funcs) this.funcs[f] = prog.funcs[f];
        try { this.exec(prog.body, this.base); } catch (e) { if (e !== RET) throw e; }
      } catch (e) {
        if (e === BREAK || e === CONT) error = { message: "A BREAK or CONTINUE statement may only be used inside a for or while loop." };
        else if (e instanceof MError) error = { message: e.message, identifier: e.identifier, line: e.line, fatal: !!e.fatal };
        else if (e instanceof RangeError) error = { message: "Out of memory or recursion too deep. Check for a function that calls itself forever, or an array that is too large for the browser runner." };
        else throw e;
      }
      return { output: this.out, error: error, figures: this.figs.filter(function (f) { return f.axes.some(function (a) { return a.series.length || a.title || a.texts.length; }); }), vars: this.base.vars, interp: self };
    },
    exec: function (stmts, env) {
      for (var i = 0; i < stmts.length; i++) {
        var s = stmts[i];
        this.tick();
        if (this.onStmt) this.onStmt(s, env);
        try { this.stmt(s, env); }
        catch (e) { if (e instanceof MError && e.line === undefined) e.line = s.line; throw e; }
      }
    },
    stmt: function (s, env) {
      var v, i, self = this;
      switch (s.type) {
        case "expr": {
          if (s.e.type === "id" && env.vars[s.e.name] !== undefined) { if (!s.semi) this.print(showNamed(s.e.name, env.vars[s.e.name], this)); return; }
          var res = this.evalMulti(s.e, env, 0);
          if (res.length && res[0] !== undefined) { var plain = s.e.type === "id" || s.e.type === "idx" || s.e.type === "field"; env.vars.ans = res[0]; res[0].shared = true; if (!s.semi) this.print(showNamed("ans", res[0], this)); void plain; }
          return;
        }
        case "assign": {
          if (s.lhs.length === 1) {
            v = this.evalRhs(s.rhs, env, s.lhs[0]);
            var nm = this.assign(s.lhs[0], v, env, s.rhs.type === "mat" && !s.rhs.rows.length);
            if (!s.semi) this.print(showNamed(nm, env.vars[nm], this));
            return;
          }
          var vals = this.evalMulti(s.rhs, env, s.lhs.length);
          if (vals.length < s.lhs.filter(function (x, k) { return x || k === 0; }).length && vals.length < s.lhs.length) {
            var need = 0; s.lhs.forEach(function (x, k) { if (x) need = k + 1; });
            if (vals.length < need) throw err(vals.length <= 1 && s.rhs.type !== "idx" && s.rhs.type !== "id" ? "Too many output arguments." : "Too many output arguments. The right side returned " + vals.length + " value(s) but " + s.lhs.length + " were requested.");
          }
          for (i = 0; i < s.lhs.length; i++) if (s.lhs[i] && vals[i] !== undefined) { var n2 = this.assign(s.lhs[i], vals[i], env); if (!s.semi) this.print(showNamed(n2, env.vars[n2], this)); }
          return;
        }
        case "if":
          for (i = 0; i < s.clauses.length; i++) if (truthy(this.eval(s.clauses[i].cond, env))) { this.exec(s.clauses[i].body, env); return; }
          if (s.els) this.exec(s.els, env); return;
        case "for": {
          var body = s.body, name = s.v;
          var runBody = function () { self.tick(); try { self.exec(body, env); } catch (e) { if (e === BREAK) return true; if (e !== CONT) throw e; } return false; };
          if (s.e.type === "range") {
            var a = scalar(this.eval(s.e.a, env)), st = s.e.s ? scalar(this.eval(s.e.s, env)) : 1, b = scalar(this.eval(s.e.b, env));
            var cnt = st === 0 || (st > 0 && a > b) || (st < 0 && a < b) ? 0 : Math.floor((b - a) / st + 1e-10) + 1;
            for (i = 0; i < cnt; i++) { env.vars[name] = num(a + i * st); if (runBody()) break; }
            return;
          }
          v = this.eval(s.e, env);
          if (v.t === "m") { for (i = 0; i < v.c; i++) { env.vars[name] = v.r === 1 ? (function () { var o = M(1, 1, [v.d[i]], v.im ? [v.im[i]] : null, v.k); if (o.im && o.im[0] === 0) o.im = null; return o; })() : indexGet(v, [COLON, num(i + 1)]); if (runBody()) break; } }
          else if (v.t === "c") { for (i = 0; i < v.c; i++) { env.vars[name] = indexGet(v, [COLON, num(i + 1)]); if (runBody()) break; } }
          else { env.vars[name] = v; runBody(); }
          return;
        }
        case "while":
          while (truthy(this.eval(s.cond, env))) { this.tick(); try { this.exec(s.body, env); } catch (e) { if (e === BREAK) break; if (e !== CONT) throw e; } }
          return;
        case "switch": {
          v = this.eval(s.e, env);
          var match = function (cv) {
            if (cv.t === "c") return cv.d.some(match);
            if (isText(v) || isText(cv)) return isText(v) && isText(cv) && text(v) === text(cv);
            if (v.t === "m" && cv.t === "m") return v.d.length && cv.d.length === 1 && v.d[0] === cv.d[0];
            return false;
          };
          for (i = 0; i < s.cases.length; i++) if (match(this.eval(s.cases[i].v, env))) { this.exec(s.cases[i].body, env); return; }
          if (s.def) this.exec(s.def, env); return;
        }
        case "try":
          try { this.exec(s.body, env); }
          catch (e) {
            if (!(e instanceof MError) || e.fatal) throw e;
            if (s.id) env.vars[s.id] = struct({ message: str(e.message), identifier: str(e.identifier || ""), stack: struct({}) });
            this.lastError = e; this.exec(s.cbody, env);
          }
          return;
        case "break": throw BREAK;
        case "continue": throw CONT;
        case "return": throw RET;
        case "global": s.names.forEach(function (n) { if (self.globals[n] === undefined) self.globals[n] = empty(); Object.defineProperty(env.vars, n, { get: function () { return self.globals[n]; }, set: function (x) { self.globals[n] = x; }, enumerable: true, configurable: true }); }); return;
        case "persistent": { if (!env.name) throw err("A persistent declaration is only allowed inside a function."); self.persist = self.persist || {}; var store = self.persist[env.name] = self.persist[env.name] || {}; s.names.forEach(function (n) { if (store[n] === undefined) store[n] = empty(); Object.defineProperty(env.vars, n, { get: function () { return store[n]; }, set: function (x) { store[n] = x; }, enumerable: true, configurable: true }); }); return; }
        case "cmd": { var out = this.call(s.name, s.args.map(str), 0, env); if (out.length && out[0] !== undefined && !s.semi) { env.vars.ans = out[0]; this.print(showNamed("ans", out[0], this)); } return; }
      }
      throw err("Unknown statement type " + s.type);
    },
    evalRhs: function (node, env) {
      var r = this.evalMulti(node, env, 1);
      if (!r.length || r[0] === undefined) throw err(node.type === "idx" || node.type === "id" ? "Too many output arguments. This function does not return a value, so it cannot be used on the right side of '='." : "The right side of '=' produced no value.");
      return r[0];
    },
    /* assignment into an lvalue chain; returns the top variable name */
    assign: function (lv, rhs, env, isEmptyLiteral) {
      var path = [], n = lv;
      while (n.type !== "id") { path.unshift(n); n = n.e; }
      var name = n.name;
      if (!path.length) { if (rhs.t !== "m" || rhs.d.length > 8) rhs.shared = true; else if (rhs.shared) rhs = own(rhs); env.vars[name] = rhs; return name; }
      env.vars[name] = this.setPath(env.vars[name], path, 0, rhs, env, isEmptyLiteral);
      return name;
    },
    endArgs: function (argNodes, base, env) {
      var out = [], self = this;
      for (var i = 0; i < argNodes.length; i++) {
        var a = argNodes[i];
        if (a.type === "colon") { out.push(COLON); continue; }
        this.endStack.push({ v: base, pos: i, n: argNodes.length });
        try { var vals = this.evalMulti(a, env, 1); vals.forEach(function (x) { out.push(x); }); } finally { self.endStack.pop(); }
      }
      return out;
    },
    endStack: [],
    setPath: function (base, path, k, rhs, env, isEmptyLiteral) {
      var acc = path[k], last = k === path.length - 1, args, sub, cur;
      if (acc.type === "field") {
        var fname = acc.dyn ? text(this.eval(acc.dyn, env), "Dynamic field name") : acc.name;
        if (base === undefined || (base.t === "m" && base.d.length === 0)) base = struct({});
        if (base.t === "sa" && base.d.length === 1) base = base.d[0];
        if (base.t !== "st") {
          var h = this.ext.setField && this.ext.setField[base.t]; if (h) return h(base, fname, rhs, this);
          throw err(base.t === "sa" ? "Assigning to a field of a struct array needs an index, e.g. s(2)." + fname + " = ..." : "Unable to perform assignment: dot indexing is not supported for variables of type '" + className(base) + "'.");
        }
        if (base.shared) base = own(base);
        base.f[fname] = last ? this.mark(rhs) : this.setPath(base.f[fname], path, k + 1, rhs, env, isEmptyLiteral);
        return base;
      }
      args = this.endArgs(acc.args, base === undefined ? empty() : base, env);
      if (acc.k === "{") {
        if (base === undefined || (base.t === "m" && base.d.length === 0)) base = cell(0, 0, []);
        if (base.t !== "c") throw err("Unable to perform assignment because brace indexing is not supported for variables of type '" + className(base) + "'. Use ( ) for ordinary arrays.");
        if (last) return indexSet(base, args, cell(1, 1, [this.mark(rhs)]));
        cur = this.tryGet(base, args); sub = cur && cur.d.length === 1 ? cur.d[0] : undefined;
        return indexSet(base, args, cell(1, 1, [this.setPath(sub, path, k + 1, rhs, env, isEmptyLiteral)]));
      }
      if (last) {
        if (base && base.t === "f") throw err("Cannot assign into a function handle with ( ).");
        var del = isEmptyLiteral && rhs.t === "m" && rhs.d.length === 0 && base !== undefined && !(base.t === "c" && false);
        return indexSet(base, args, rhs, del);
      }
      cur = base === undefined ? null : this.tryGet(base, args);
      if (cur && cur.t === "sa") sub = cur.d.length === 1 ? cur.d[0] : undefined; else if (cur && cur.t === "st") sub = cur; else if (cur && cur.t === "c") sub = undefined; else sub = cur || undefined;
      if (base !== undefined && base.t === "c") { sub = cur && cur.d.length === 1 ? cur.d[0] : undefined; throw err("Use { } to reach inside a cell before indexing further, e.g. c{2}(1) = ..."); }
      var ns = this.setPath(sub && (sub.t === "st") ? sub : (sub && sub.t === "m" && sub.d.length === 0 ? undefined : sub), path, k + 1, rhs, env, isEmptyLiteral);
      if (base !== undefined && base.t === "sa" && ns.t === "st" && base.d.length) { var keys = Object.keys(base.d[0].f); Object.keys(ns.f).forEach(function (kk) { if (keys.indexOf(kk) < 0) { base = own(base); base.d = base.d.map(function (e) { var c = own(e); c.f[kk] = empty(); return c; }); } }); keys.forEach(function (kk) { if (ns.f[kk] === undefined) ns.f[kk] = empty(); }); }
      if (base !== undefined && base.t === "st" && ns.t === "st") { var bk = Object.keys(base.f); bk.forEach(function (kk) { if (ns.f[kk] === undefined) ns.f[kk] = empty(); }); }
      return indexSet(base, args, ns);
    },
    tryGet: function (base, args) { try { return indexGet(base, args); } catch (e) { if (e instanceof MError) return null; throw e; } },
    mark: function (v) { v.shared = true; return v; },
    eval: function (node, env) {
      var r = this.evalMulti(node, env, 1);
      if (!r.length || r[0] === undefined) throw err(node.type === "idx" || node.type === "id" ? "Too many output arguments. '" + (node.name || (node.e && node.e.name) || "this function") + "' does not return a value here." : "Expression produced no value.");
      return r[0];
    },
    evalList: function (nodes, env) { var out = []; for (var i = 0; i < nodes.length; i++) { if (nodes[i].type === "colon" || nodes[i].type === "colonstr") { out.push(str(":")); continue; } var r = this.evalMulti(nodes[i], env, 1); for (var j = 0; j < r.length; j++) if (r[j] !== undefined) out.push(r[j]); else throw err("One of the arguments is a function call that returns no value."); } return out; },
    evalMulti: function (node, env, nargout) {
      var a, b, v, self = this;
      switch (node.type) {
        case "num": return [node.imag ? M(1, 1, [0], [node.v]) : num(node.v)];
        case "str": return [node.dq ? { t: "s", v: node.v } : str(node.v)];
        case "paren": return [this.eval(node.e, env)];
        case "id": {
          v = env.vars[node.name];
          if (v !== undefined) { v.shared = true; return [v]; }
          return this.call(node.name, [], nargout, env, node);
        }
        case "end": { var ctx = this.endStack[this.endStack.length - 1]; if (!ctx) throw err("The end operator must be used within an array index expression."); var bv = ctx.v; var cnt = bv.t === "st" || bv.t === "s" || bv.t === "f" ? 1 : ctx.n === 1 ? bv.r * bv.c : ctx.pos === 0 ? bv.r : ctx.pos === 1 ? bv.c : 1; return [num(cnt)]; }
        case "colonstr": return [str(":")];
        case "bin": a = this.eval(node.l, env); b = this.eval(node.r, env); return [binop(node.op, a, b, this)];
        case "sc": {
          a = this.eval(node.l, env);
          var sc = function (x) { if (x.t !== "m" || x.d.length !== 1) throw err("Operands to the logical AND (&&) and OR (||) operators must be convertible to logical scalar values. Use ANY or ALL to reduce operands to logical scalar values, or use & and | for arrays."); return x.d[0] !== 0; };
          if (node.op === "&&") return [bool(sc(a) && sc(this.eval(node.r, env)))];
          return [bool(sc(a) || sc(this.eval(node.r, env)))];
        }
        case "un":
          a = this.eval(node.e, env);
          if (a.t !== "m") { var uh = this.ext.unop[a.t]; if (uh) return [uh(node.op, a, this)]; throw err("Unary operator '" + node.op + "' is not supported for operands of type '" + className(a) + "'."); }
          if (node.op === "-") { v = M(a.r, a.c, a.d.map(function (x) { return -x; }), a.im ? a.im.map(function (x) { return -x; }) : null); if (a.cls) v = INT[a.cls] ? castInt(v, a.cls) : v; return [v]; }
          if (node.op === "~") return [M(a.r, a.c, a.d.map(function (x) { if (x !== x) throw err("NaN's cannot be converted to logicals."); return x === 0 ? 1 : 0; }), null, "l")];
          return [a.k === "d" ? a : M(a.r, a.c, a.d.slice(), a.im)];
        case "post": a = this.eval(node.e, env); if (a.t !== "m" && a.t !== "c" && this.ext.unop[a.t]) return [this.ext.unop[a.t]("'", a, this)]; return [transpose(a, node.op === "'")];
        case "range": {
          var ra = this.eval(node.a, env), rs = node.s ? this.eval(node.s, env) : null, rb = this.eval(node.b, env);
          return [range(scalarOrFirst(ra), rs ? scalarOrFirst(rs) : 1, scalarOrFirst(rb), ra.k === "c" && rb.k === "c")];
        }
        case "mat": return [this.concat(node, env)];
        case "cell": {
          var rows = [], w = -1;
          node.rows.forEach(function (rw) { var items = []; self.evalList(rw, env).forEach(function (x) { items.push(x); }); rows.push(items); });
          if (!rows.length) return [cell(0, 0, [])];
          // a row made only of cells concatenates them
          var flat = rows.map(function (items) { var out = []; items.forEach(function (x) { out.push(x); }); return out; });
          w = flat[0].length; flat.forEach(function (r) { if (r.length !== w) throw err("Dimensions of arrays being concatenated are not consistent."); });
          var d = new Array(flat.length * w); for (var i = 0; i < flat.length; i++) for (var j = 0; j < w; j++) { flat[i][j].shared = true; d[i + j * flat.length] = flat[i][j]; }
          return [cell(flat.length, w, d)];
        }
        case "anon": {
          var cap = Object.create(null); freeVars(node.body, cap);
          var closure = Object.create(null); for (var nm in cap) if (node.params.indexOf(nm) < 0 && env.vars[nm] !== undefined) { env.vars[nm].shared = true; closure[nm] = env.vars[nm]; }
          return [{ t: "f", params: node.params, body: node.body, closure: closure, src: node.src }];
        }
        case "fh": if (!this.funcs[node.name] && !B[node.name] && !UNSUPPORTED[node.name]) throw err("Unrecognized function or variable '" + node.name + "'."); return [{ t: "f", name: node.name }];
        case "field": {
          var objs = this.evalMulti(node.e, env, 1), fname = node.dyn ? text(this.eval(node.dyn, env), "Dynamic field name") : node.name, out = [];
          objs.forEach(function (o) {
            if (o === undefined) throw err("Dot indexing needs a value on its left side.");
            if (o.t === "st") { if (o.f[fname] === undefined) throw err("Unrecognized field name \"" + fname + "\"."); o.f[fname].shared = true; out.push(o.f[fname]); }
            else if (o.t === "sa") o.d.forEach(function (e) { if (e.f[fname] === undefined) throw err("Unrecognized field name \"" + fname + "\"."); e.f[fname].shared = true; out.push(e.f[fname]); });
            else if (self.ext.getField && self.ext.getField[o.t]) out.push(self.ext.getField[o.t](o, fname, self));
            else throw err("Dot indexing is not supported for variables of type '" + className(o) + "'." + (node.e.type === "id" && (B[node.e.name + "." + fname]) ? "" : ""));
          });
          return out;
        }
        case "idx": return this.index(node, env, nargout);
        case "colon": return [str(":")];
      }
      throw err("Cannot evaluate " + node.type);
    },
    index: function (node, env, nargout) {
      var base, args, self = this;
      if (node.e.type === "id" && env.vars[node.e.name] === undefined) {
        if (node.k === "{") throw err("Unrecognized function or variable '" + node.e.name + "'.");
        var cargs = this.evalList(node.args, env); this.lastArgNodes = node.args; return this.call(node.e.name, cargs, nargout, env, node.e);
      }
      base = node.e.type === "id" ? env.vars[node.e.name] : this.eval(node.e, env);
      if (base.t === "f") { if (node.k === "{") throw err("Brace indexing is not supported for function handles."); return this.callHandle(base, this.evalList(node.args, env), nargout, env); }
      args = this.endArgs(node.args, base, env);
      if (node.k === "{") {
        if (base.t !== "c") throw err("Brace indexing is not supported for variables of this type. Use ( ) to index a " + className(base) + " array; { } is for cell arrays.");
        var sub = indexGet(base, args); sub.d.forEach(function (x) { x.shared = true; }); return sub.d.slice();
      }
      if (this.ext.index && this.ext.index[base.t]) return [this.ext.index[base.t](base, args, self)];
      return [indexGet(base, args)];
    },
    concat: function (node, env) {
      var self = this, rows = [];
      node.rows.forEach(function (rw) { var items = self.evalList(rw, env); if (items.length) rows.push(items); });
      return catRows(rows);
    },
    callHandle: function (h, args, nargout, env) {
      if (h.name) return this.call(h.name, args, nargout, env);
      if (args.length > h.params.length) throw err("Too many input arguments.");
      if (++this.depth > 200) { this.depth = 0; throw fatal("Stopped: recursion is too deep (a function keeps calling itself)."); }
      var vars = Object.create(null), k;
      for (k in h.closure) vars[k] = h.closure[k];
      for (var i = 0; i < h.params.length; i++) if (i < args.length && h.params[i] !== "~") vars[h.params[i]] = args[i];
      try { this.tick(); var saved = this.endStack; this.endStack = []; try { return this.evalMulti(h.body, { vars: vars, name: "anonymous function" }, nargout); } finally { this.endStack = saved; } }
      catch (e) { if (e instanceof MError && !e.fatal && /^Unrecognized function or variable '(\w+)'\.$/.test(e.message)) { var m = e.message.match(/'(\w+)'/)[1]; if (h.params.indexOf(m) >= 0) e.message = "Not enough input arguments."; } throw e; }
      finally { this.depth--; }
    },
    call: function (name, args, nargout, env, node) {
      var f = this.funcs[name], r;
      if (f) return this.callUser(f, args, nargout);
      var b = B[name];
      if (b) { r = b(args, nargout, this, env); return Array.isArray(r) ? r : [r]; }
      if (UNSUPPORTED[name]) throw err("'" + name + "' " + UNSUPPORTED[name] + " The browser runner cannot do this one: copy the code and run it in MATLAB Online or desktop MATLAB.", "EEHub:realMatlabOnly");
      throw err("Unrecognized function or variable '" + name + "'." + hint(name, env, this));
    },
    callUser: function (f, args, nargout) {
      if (args.length > f.params.length && f.params[f.params.length - 1] !== "varargin") throw err("Error using " + f.name + "\nToo many input arguments.");
      if (++this.depth > 200) { this.depth = 0; throw fatal("Stopped: recursion is too deep (a function keeps calling itself without reaching its stopping case)."); }
      var vars = Object.create(null), i, np = f.params.length, outs = [];
      for (i = 0; i < np; i++) {
        if (f.params[i] === "varargin" && i === np - 1) { var rest = args.slice(i); vars.varargin = cell(rest.length ? 1 : 0, rest.length, rest); break; }
        if (i < args.length && f.params[i] !== "~") vars[f.params[i]] = args[i];
      }
      var env = { vars: vars, name: f.name, nargin: args.length, nargout: nargout };
      var saved = this.endStack; this.endStack = [];
      try { this.exec(f.body, env); } catch (e) { if (e !== RET) { if (e instanceof MError && !e.fatal && !e.inFn) { e.inFn = f.name; var m = e.message.match(/^Unrecognized function or variable '(\w+)'\./); if (m && f.params.indexOf(m[1]) >= 0) e.message = "Not enough input arguments. (Function '" + f.name + "' needs a value for '" + m[1] + "'.)"; } throw e; } }
      finally { this.depth--; this.endStack = saved; }
      for (i = 0; i < Math.max(1, nargout); i++) {
        if (i >= f.outs.length) { if (i === 0) return []; throw err("Error using " + f.name + "\nToo many output arguments."); }
        var o = vars[f.outs[i]];
        if (o === undefined) { if (i === 0 && nargout === 0) return []; throw err("Output argument \"" + f.outs[i] + "\" (and possibly others) not assigned a value in the execution with \"" + f.name + "\" function."); }
        outs.push(o);
      }
      return outs;
    },
    /* helper for library code: call a function value (handle or name) with JS-side args */
    feval: function (fn, args, nargout) {
      if (fn.t === "f") return this.callHandle(fn, args, nargout === undefined ? 1 : nargout, this.base);
      if (isText(fn)) return this.call(text(fn), args, nargout === undefined ? 1 : nargout, this.base);
      throw err("Expected a function handle (for example @sin or @(x) x.^2).");
    }
  };
  function hint(name, env, I) {
    var cands = Object.keys(env.vars).concat(Object.keys(I.funcs)), lower = name.toLowerCase(), i;
    for (i = 0; i < cands.length; i++) if (cands[i].toLowerCase() === lower) return "\nDid you mean '" + cands[i] + "'? MATLAB is case-sensitive.";
    if (B[lower]) return "\nDid you mean '" + lower + "'? MATLAB is case-sensitive.";
    return "";
  }
  function scalarOrFirst(v) { if (v.t !== "m" || !v.d.length) throw err("Colon operands must be numeric scalars."); return v.d[0]; }
  function range(a, s, b, isChar) {
    if (s === 0 || (s > 0 && a > b) || (s < 0 && a < b) || a !== a || b !== b || s !== s) return M(1, 0, []);
    var n = Math.floor((b - a) / s + 1e-10) + 1;
    if (n > 5e6) throw err("Requested range has " + n + " elements, which is too large for the browser runner.");
    var d = new Array(n); for (var i = 0; i < n; i++) d[i] = a + i * s;
    return M(1, n, d, null, isChar ? "c" : "d");
  }
  function freeVars(n, acc) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(function (x) { freeVars(x, acc); }); return; }
    if (n.type === "id") acc[n.name] = 1;
    for (var k in n) if (k !== "type" && typeof n[k] === "object") freeVars(n[k], acc);
  }
  function toCharCodes(v) { // numbers in a char concatenation become characters
    return v;
  }
  function catRows(rows) {
    if (!rows.length) return empty();
    var anyCell = false, anyStr = false, anyStruct = false, anyOther = null;
    rows.forEach(function (r) { r.forEach(function (x) { if (x.t === "c") anyCell = true; else if (x.t === "s") anyStr = true; else if (x.t === "st" || x.t === "sa") anyStruct = true; else if (x.t !== "m") anyOther = x; }); });
    if (anyOther) { if (rows.length === 1 && rows[0].length === 1) return rows[0][0]; throw err("Concatenation of '" + className(anyOther) + "' values is not supported. Put them in a cell array with { }."); }
    if (anyStr) { if (rows.length === 1) { return { t: "s", v: rows[0].map(function (x) { return strOperand(x); }).join("") }; } throw err("String arrays with several rows are not supported by the browser runner. Use a cell array of text, e.g. {'a'; 'b'}."); }
    if (anyStruct) { var ds = []; rows.forEach(function (r) { r.forEach(function (x) { if (x.t === "st") ds.push(x); else if (x.t === "sa") x.d.forEach(function (e) { ds.push(e); }); else if (!(x.t === "m" && !x.d.length)) throw err("Cannot concatenate a struct with a non-struct value."); }); }); return ds.length === 1 ? ds[0] : { t: "sa", r: rows.length > 1 ? ds.length : 1, c: rows.length > 1 ? 1 : ds.length, d: ds }; }
    if (anyCell) rows = rows.map(function (r) { return r.map(function (x) { return x.t === "c" ? x : cell(1, 1, [x]); }); });
    var blocks = rows.map(function (r) { return hcat(r); }).filter(function (b) { return numel(b) > 0 || b.c > 0 && rows.length === 1; });
    if (!blocks.length) return anyCell ? cell(0, 0, []) : rows[0][0] && rows[0][0].k === "c" ? M(0, 0, [], null, "c") : empty();
    return vcat(blocks);
  }
  function kindOf(items) { var k = "l", anyC = false, cls = null, i; for (i = 0; i < items.length; i++) { var x = items[i]; if (x.k === "c") anyC = true; if (x.k !== "l") k = "d"; if (x.cls) cls = x.cls; } return { k: anyC ? "c" : k, cls: cls }; }
  function hcat(items) {
    var isCell = items[0].t === "c";
    items = items.filter(function (x) { return x.r * x.c > 0 || (x.r > 0 && items.length === 1); });
    if (!items.length) return isCell ? cell(0, 0, []) : empty();
    var r = items[0].r, c = 0, i, any = false;
    items.forEach(function (x) { if (x.r !== r) throw err("Dimensions of arrays being concatenated are not consistent. (In a row, every piece must have the same number of rows.)"); c += x.c; if (x.im) any = true; });
    var d = [], im = any ? [] : null;
    items.forEach(function (x) { for (i = 0; i < x.d.length; i++) { d.push(x.d[i]); if (im) im.push(x.im ? x.im[i] : 0); } });
    if (isCell) return cell(r, c, d);
    var kk = kindOf(items), o = M(r, c, d, im, kk.k); if (kk.cls && kk.k !== "c") { o.cls = kk.cls; if (INT[kk.cls]) o = castInt(o, kk.cls); } return o;
  }
  function vcat(blocks) {
    var isCell = blocks[0].t === "c";
    blocks = blocks.filter(function (x) { return x.r * x.c > 0; });
    if (!blocks.length) return isCell ? cell(0, 0, []) : empty();
    if (blocks.length === 1) return blocks[0];
    var c = blocks[0].c, r = 0, any = false;
    blocks.forEach(function (x) { if (x.c !== c) throw err(x.k === "c" && blocks[0].k === "c" ? "Dimensions of arrays being concatenated are not consistent. (Rows of a char array must have the same length; use a cell array {'a'; 'bcd'} for text of different lengths.)" : "Dimensions of arrays being concatenated are not consistent. (Every row must have the same number of columns.)"); r += x.r; if (x.im) any = true; });
    var d = new Array(r * c), im = any ? new Array(r * c) : null, off = 0;
    blocks.forEach(function (x) { for (var j = 0; j < c; j++) for (var i = 0; i < x.r; i++) { d[off + i + j * r] = x.d[i + j * x.r]; if (im) im[off + i + j * r] = x.im ? x.im[i + j * x.r] : 0; } off += x.r; });
    if (isCell) return cell(r, c, d);
    var kk = kindOf(blocks), o = M(r, c, d, im, kk.k); if (kk.cls && kk.k !== "c") o.cls = kk.cls; return o;
  }

  function run(src, opts) { return new Interp(opts).run(src); }
  return {
    run: run, Interp: Interp, Parser: Parser, lex: lex, B: B, UNSUPPORTED: UNSUPPORTED, MError: MError,
    _: { M: M, num: num, bool: bool, str: str, empty: empty, zeros: zeros, rowv: rowv, colv: colv, cell: cell, struct: struct, err: err, fatal: fatal, isText: isText, text: text, scalar: scalar,
      numel: numel, className: className, truthy: truthy, INT: INT, castInt: castInt, mround: mround, pad: pad, padR: padR, isInt: isInt, expo: expo, fixed: fixed, fmtG: fmtG, scalarStr: scalarStr,
      bodyLines: bodyLines, showNamed: showNamed, brief: brief, fhStr: fhStr, ew: ew, C: C, binop: binop, matmul: matmul, transpose: transpose, solve: solve, mldivide: mldivide, eye: eye, withIm: withIm,
      COLON: COLON, indexGet: indexGet, indexSet: indexSet, own: own, range: range, catRows: catRows, hcat: hcat, vcat: vcat, sizeStr: sizeStr, cplxStr: cplxStr, special: special, intStr: intStr }
  };
});
