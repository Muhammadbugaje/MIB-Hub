/* Arcade Management → characters, game config and credits (super admin only; server rules in games/fslg_admin.py).
   The page loads the game's own data files and samaru-overrides.js, so the people, lines, wardrobe and the text tokens
   are exactly the game's. Everything typed here is shown with textContent / value, never as HTML. */
(function () {
  "use strict";
  var host = document.getElementById("fslg-admin"); if (!host) return;
  var API = host.getAttribute("data-api"), CSRF = host.getAttribute("data-csrf"), PAGE = host.getAttribute("data-page");
  var D = window.SamaruData || {}, F = window.GameConfig, Z = window.SamaruGame || {};
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- small helpers ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag); attrs = attrs || {};
    for (var k in attrs) { var v = attrs[k]; if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "on") for (var ev in v) e.addEventListener(ev, v[ev]); else if (k === "cls") e.className = v; else if (k === "value") e.value = v; else e.setAttribute(k, v === true ? "" : v); }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }); return e;
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function req(path, body) {
    var opt = { credentials: "same-origin", headers: { Accept: "application/json" } };
    if (body !== undefined) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.headers["X-CSRFToken"] = CSRF; opt.body = JSON.stringify(body); }
    return fetch(API + path, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ("The server said " + r.status + ".")); return j; }); });
  }
  function status(msg, bad) { var s = $("#fa-status"); if (s) { s.textContent = msg; s.className = "fa-status" + (bad ? " fa-status--bad" : " fa-status--ok"); } }
  function tellGames() { try { var bc = new BroadcastChannel("fslg"); bc.postMessage("changed"); bc.close(); } catch (e) {} }
  var TOKENS = ["GAME_NAME", "GAME_SHORT", "GAME_INITIALS", "TAGLINE", "CURRENCY", "PLAYER_NAME", "AUTHOR"];
  function tokensIn(t) { var out = {}, re = /\{\{([A-Z_]+)(?:\|(?:upper|lower))?\}\}/g, m; while ((m = re.exec(t || ""))) out[m[1]] = 1; return out; }
  function checkLine(t, orig) { // the same rules as fslg_admin.check_tokens + "keep the original's tokens"
    if (!String(t).trim()) return "A line cannot be empty."; if (t.length > 400) return "At most 400 characters.";
    if (/[<>]/.test(t)) return "Angle brackets are not allowed.";
    var tk = tokensIn(t); for (var k in tk) if (TOKENS.indexOf(k) < 0) return "Unknown token {{" + k + "}}.";
    var rest = t.replace(/\{\{[A-Z_]+(?:\|(?:upper|lower))?\}\}/g, ""); if (/[{}]/.test(rest)) return "A token is broken: write it like {{PLAYER_NAME}}.";
    var d = 0, b = 0; for (var i = 0; i < rest.length; i++) { var c = rest[i]; if (c === "(") d++; else if (c === ")" && --d < 0) return "A ')' has no '('."; else if (c === "[") b++; else if (c === "]" && --b < 0) return "A ']' has no '['."; }
    if (d || b) return "A bracket is opened and never closed.";
    var ot = tokensIn(orig); for (var k2 in ot) if (!tk[k2]) return "Keep {{" + k2 + "}}: the original line uses it."; return "";
  }

  /* ---------- history (all three pages) ---------- */
  function history(box, kind, key, onBack) {
    box.textContent = "Loading…";
    req("history/?kind=" + encodeURIComponent(kind) + "&key=" + encodeURIComponent(key || "")).then(function (j) {
      box.textContent = ""; if (!j.history.length) { box.appendChild(el("p", { text: "No changes yet: the game's own version is in use." })); return; }
      var tb = el("tbody"); j.history.forEach(function (h, i) {
        tb.appendChild(el("tr", {}, [el("td", { "data-l": "Version" }, [el("b", { text: "v" + h.version }), i === 0 ? el("span", { cls: "gs-tag gs-tag--on", text: "current" }) : null]), el("td", { "data-l": "When", text: h.at }), el("td", { "data-l": "Who", text: h.by }), el("td", { "data-l": "What", text: h.note }),
          el("td", {}, [i === 0 ? null : el("button", { cls: "btn btn-ghost btn-sm", type: "button", text: "Roll back to this", on: { click: function () { if (!confirm("Go back to version " + h.version + "? This is saved as a new version, so you can undo it.")) return;
            req("rollback/", { kind: kind, key: key, version: h.version }).then(function (r) { tellGames(); status("Rolled back to version " + h.version + "."); onBack(r.data || {}); history(box, kind, key, onBack); }, function (e) { status(e.message, true); }); } } })])]));
      });
      box.appendChild(el("div", { cls: "gs-table-wrap" }, [el("table", { cls: "gs-table gs-table--stack" }, [el("thead", {}, [el("tr", {}, ["Version", "When", "Who", "What", ""].map(function (t) { return el("th", { text: t }); }))]), tb])]));
    }, function (e) { box.textContent = e.message; });
  }

  /* =====================================================================================================
     CHARACTERS
     ===================================================================================================== */
  function characters() {
    var bit = function (c) { return /^(a|an|the|your)\s/i.test(c.name) ? 1 : 0; }; // named people first, bit parts ("A fan") after
    var cat = F.catalogue().filter(function (c) { return !c.retired; }).sort(function (a, b) { return bit(a) - bit(b) || a.name.localeCompare(b.name); });
    var saved = {}, cur = null, draft = null, tab = "who", list = $("#fa-people"), edit = $("#fa-edit");
    var KIND = { student: "Student", staff: "Staff", trader: "Trader", family: "Family" };
    req("?all=1").then(function (b) { saved = b.characters || {}; draw(); var want = (location.hash || "").slice(1); if (want && cat.some(function (c) { return c.id === want; })) open(want); }, function (e) { $("#fa-count").textContent = e.message; });
    $("#fa-q").addEventListener("input", draw); $("#fa-kind").addEventListener("change", draw);
    function draw() {
      var q = $("#fa-q").value.trim().toLowerCase(), k = $("#fa-kind").value, n = 0; list.textContent = "";
      cat.forEach(function (c) {
        if (k === "story" ? !c.story : k === "edited" ? !saved[c.id] : k && c.kind !== k) return;
        var nm = (saved[c.id] && saved[c.id].name) || c.name;
        if (q && (nm + " " + c.name + " " + c.role + " " + c.id).toLowerCase().indexOf(q) < 0 && !(q.length > 2 && c.lines.some(function (l) { return l.text.toLowerCase().indexOf(q) >= 0; }))) return;
        n++; list.appendChild(el("li", {}, [el("button", { type: "button", cls: "fa-person", "aria-current": c.id === cur ? "true" : null, on: { click: function () { open(c.id); } } },
          [el("b", { text: nm }), el("small", { text: c.role || "—" }), el("span", { cls: "fa-chips" }, [el("span", { cls: "gs-tag", text: KIND[c.kind] }), c.story ? el("span", { cls: "gs-tag", text: "story" }) : null, saved[c.id] ? el("span", { cls: "gs-tag gs-tag--warn", text: "changed" }) : null, el("span", { cls: "fa-n", text: c.lines.length + " lines" })])])]));
      });
      $("#fa-count").textContent = n + " of " + cat.length + " people";
    }
    function byId(id) { for (var i = 0; i < cat.length; i++) if (cat[i].id === id) return cat[i]; return null; }
    function open(id) { cur = id; draft = clone(saved[id] || {}); try { window.history.replaceState(null, "", "#" + id); } catch (e) {} draw(); render(); if (window.innerWidth < 900) edit.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
    function get(path) { var o = draft; for (var i = 0; i < path.length; i++) { if (o == null) return undefined; o = o[path[i]]; } return o; }
    function set(path, v) { var o = draft; for (var i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {}; if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = v; dirty(); }
    function dirty() { var b = $("#fa-save"); if (b) b.disabled = JSON.stringify(draft) === JSON.stringify(saved[cur] || {}); preview(); }
    function input(label, path, opt) {
      opt = opt || {}; var v = get(path), id = "f-" + path.join("-");
      var inp = opt.options ? el("select", { id: id }, [el("option", { value: "", text: opt.blank || ("Game's own" + (opt.def != null && opt.def !== "" ? ": " + opt.def : "")) })].concat(opt.options.map(function (o) { return el("option", { value: o[0], text: o[1] }); })))
        : opt.area ? el("textarea", { id: id, rows: opt.rows || 3, maxlength: opt.max || 400, placeholder: opt.def || "" }) : el("input", { id: id, type: opt.type || "text", maxlength: opt.max || 60, placeholder: opt.def == null ? "" : String(opt.def), min: opt.min, max: opt.maxv, step: opt.step });
      inp.className = opt.options ? "" : "gs-input gs-input--plain"; if (v != null) inp.value = Array.isArray(v) ? v.join(opt.join || ", ") : v;
      inp.addEventListener(opt.options ? "change" : "input", function () { var x = inp.value; if (opt.type === "number" || opt.type === "range") x = x === "" ? "" : +x; if (opt.split) x = x.split(opt.split).map(function (s) { return s.trim(); }).filter(Boolean); if (opt.bool) x = x === "" ? "" : x === "yes"; set(path, x); if (opt.after) opt.after(x); });
      if (opt.bool && v != null) inp.value = v ? "yes" : "no";
      return el("label", { cls: "gs-field", "for": id }, [label, inp, opt.help ? el("small", { text: opt.help }) : null]);
    }
    function render() {
      var c = byId(cur); if (!c) return; var b = c.base; edit.textContent = "";
      var tabs = [["who", "Identity"], ["look", "Looks"], ["att", "Attitude"], ["voice", "Voice"], ["lines", "Lines (" + c.lines.length + ")"], ["hist", "History"]];
      edit.appendChild(el("div", { cls: "fa-head" }, [el("div", { cls: "fa-prev" }, [el("canvas", { id: "fa-canvas", width: 360, height: 420, "aria-label": "Preview of " + c.name })]),
        el("div", {}, [el("h2", { text: (draft.name || c.name) }), el("p", { text: [c.role, KIND[c.kind], c.story ? "story cast (" + c.story + ")" : "", "id: " + c.id].filter(Boolean).join(" · ") }),
          el("div", { cls: "gs-row" }, [el("button", { id: "fa-save", cls: "btn btn-primary btn-sm", type: "button", text: "Save changes", disabled: true, on: { click: save } }),
            el("button", { cls: "btn btn-ghost btn-sm", type: "button", text: "Reset to the game's own", disabled: !saved[cur], on: { click: reset } }), el("span", { id: "fa-status", cls: "fa-status", role: "status" })])])]));
      edit.appendChild(el("nav", { cls: "gs-tabs", "aria-label": "Sections" }, tabs.map(function (t) { return el("a", { href: "#" + cur, "aria-current": t[0] === tab ? "page" : null, text: t[1], on: { click: function (e) { e.preventDefault(); tab = t[0]; render(); } } }); })));
      var body = el("div", { cls: "fa-body" }); edit.appendChild(body);
      var skins = (D.SKINS || []).map(function (s) { return [s.col, s.name]; }), skinName = (D.SKINS || []).filter(function (s) { return s.col === b.skin; }).map(function (s) { return s.name; })[0] || "their own tone", hairs = (D.HAIRS || []).concat([["cap", "Cap"], ["hijab", "Hijab"]]);
      if (tab === "who") body.appendChild(el("div", { cls: "gs-fields" }, [input("Display name", ["name"], { def: b.name, max: 40, after: function () { $("h2", edit).textContent = draft.name || c.name; } }),
        input("Nicknames", ["nick"], { split: ",", def: "comma between them", max: 120 }), input("Role or department", ["role"], { def: b.role, max: 60 }), input("Short bio", ["bio"], { area: true, def: b.bio || "A sentence or two", max: 400 })]));
      if (tab === "look") {
        var slots = (D.WARD_SLOTS || []).filter(function (s) { return s[0] !== "acc"; }), items = D.WARDROBE || [];
        var wear = function (slot) { var out = []; items.forEach(function (it) { if (it.slot !== slot) return; (it.cols || []).forEach(function (col, i) { out.push([it.id + "." + i, it.name + (it.cols.length > 1 ? " · " + (String(col).indexOf("|") > 0 ? String(col).split("|")[0] + " " + (i + 1) : col) : "")]); }); }); return out; };
        body.appendChild(el("div", { cls: "gs-fields" }, [input("Skin tone", ["look", "skin"], { options: skins, def: skinName }), input("Hair style", ["look", "hair"], { options: hairs, def: b.hair }),
          input("Hair colour", ["look", "hairCol"], { options: (D.HAIR_COLS || []).map(function (h, i) { return [h, ["Black", "Dark brown", "Brown", "Chestnut", "Grey", "Auburn", "Copper"][i] || h]; }).concat([["#ffffff", "White"], ["#0f766e", "Teal (scarf)"]]), def: b.hairCol || "black" }),
          input("Main colour (shirt)", ["look", "top"], { type: "color", help: "Used when no wardrobe top is chosen." }), input("Outfit style", ["look", "mode"], { options: (D.OUTFITS || []).map(function (o) { return [o.mode, o.name]; }), def: "game picks" }),
          input("Height", ["look", "scale"], { type: "range", min: .85, maxv: 1.2, step: .05, help: "1 = normal" }), input("Beard", ["look", "beard"], { options: (D.BEARDS || []).filter(function (x) { return x[0]; }) }),
          input("Eyebrows", ["look", "brow"], { options: D.BROWS || [] }), input("Eyes", ["look", "eyes"], { options: D.EYES || [] })]));
        body.appendChild(el("h3", { text: "Wardrobe" }));
        body.appendChild(el("div", { cls: "gs-fields" }, slots.map(function (s) { return input(s[1], ["look", "fit", s[0]], { options: wear(s[0]), blank: "Not set" }); }).concat([0, 1, 2].map(function (i) {
          var acc = wear("acc"), sel = input("Extra " + (i + 1), ["look", "acc", String(i)], { options: acc, blank: "None" }); var s2 = $("select", sel); s2.value = (get(["look", "acc"]) || [])[i] || "";
          s2.onchange = function () { var a = (get(["look", "acc"]) || []).slice(); a[i] = s2.value; set(["look", "acc"], a.filter(Boolean)); }; return sel; }))));
        var tp = $("#f-look-top", body); if (tp && !get(["look", "top"])) tp.value = /^#[0-9a-f]{6}$/i.test(b.top || "") ? b.top : "#888888";
      }
      if (tab === "att") {
        var places = (D.PLACES || []).map(function (p) { return [p.id, p.name]; }).sort(function (x, y) { return x[1].localeCompare(y[1]); });
        var opp = (get(["voice", "sex"]) || b.voice) === "female" ? "male" : "female";
        body.appendChild(el("div", { cls: "gs-fields" }, [input("Personality", ["att", "preset"], { options: [["friendly", "Friendly"], ["grumpy", "Grumpy"], ["funny", "Funny"], ["shy", "Shy"], ["serious", "Serious"], ["flirty", "Flirty but modest"], ["calm", "Calm"], ["loud", "Loud"], ["wise", "Wise"], ["proud", "Proud"]] }),
          input("Mood", ["att", "mood"], { options: [["cheerful", "Cheerful"], ["relaxed", "Relaxed"], ["tired", "Tired"], ["stressed", "Stressed"], ["moody", "Moody"], ["excited", "Excited"]] }),
          input("When bumped", ["att", "bump"], { options: [["shrug", "Shrugs it off"], ["complain", "Complains"], ["shove", "Snaps back"], ["flee", "Gets scared"]] }),
          input("When hit", ["att", "hit"], { options: [["flee", "Runs away"], ["hit_back", "Hits back once or twice"], ["stand_up", "Stands up and fights"]], help: "Sets how they fight in the game." }),
          input("When honked at", ["att", "honk"], { options: [["jump", "Jumps clear"], ["shout", "Shouts at the driver"], ["ignore", "Ignores it"]] }),
          input("Walk speed", ["att", "speed"], { type: "range", min: .6, maxv: 1.6, step: .1, help: "1 = normal" }),
          input("Can be a friend", ["att", "friend"], { options: [["yes", "Yes"], ["no", "No"]], bool: true, def: "" }),
          input("Romance option", ["att", "romance"], { options: [["yes", "Yes"], ["no", "No"]], bool: true, def: b.date ? "yes" : "no", help: "Only a " + opp + " player can ask them out (opposite sex only)." }),
          input("Favourite gifts", ["att", "likes"], { split: ",", def: (b.likes && (b.likes.gifts || [b.likes.gift]).filter(Boolean).join(", ")) || "item ids, e.g. kilishi, novel", max: 160 }),
          input("Disliked gifts", ["att", "dislikes"], { split: ",", def: "item ids", max: 160 }),
          input("Disliked topic", ["att", "hateTopic"], { options: Object.keys(D.TALK || {}).map(function (k) { return [k, D.TALK[k]]; }), def: typeof b.hates === "string" ? b.hates : "" })]));
        var known = Object.keys(D.ITEMS || {}); body.appendChild(el("p", { cls: "fa-hint", text: "Gift ids the game knows: " + known.slice(0, 40).join(", ") + (known.length > 40 ? "…" : "") }));
        body.appendChild(el("h3", { text: "Daily routine" })); var rt = el("div", { cls: "fa-routine" }); body.appendChild(rt);
        var drawRt = function () { rt.textContent = ""; var r = get(["att", "routine"]) || [];
          r.forEach(function (row, i) { var ps = el("select", { "aria-label": "Place " + (i + 1) }, places.map(function (p) { return el("option", { value: p[0], text: p[1] }); })); ps.value = row[0];
            var hr = el("input", { type: "number", min: 0, max: 23.5, step: .5, value: row[1], cls: "gs-input gs-input--plain", "aria-label": "Hour " + (i + 1) });
            ps.onchange = hr.oninput = function () { r[i] = [ps.value, Math.max(0, Math.min(23.75, +hr.value || 0))]; set(["att", "routine"], r); };
            rt.appendChild(el("div", { cls: "gs-row" }, [el("span", { text: "From" }), hr, el("span", { text: ":00 at" }), ps, el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "Remove", on: { click: function () { r.splice(i, 1); set(["att", "routine"], r); drawRt(); } } })])); });
          if (r.length < 8) rt.appendChild(el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "+ Add a stop", on: { click: function () { r.push([b.at && b.at.charAt(0) !== "@" ? b.at : "library", r.length ? Math.min(23, r[r.length - 1][1] + 3) : 8]); set(["att", "routine"], r); drawRt(); } } }));
          if (!r.length) rt.appendChild(el("p", { cls: "fa-hint", text: "None: they keep the game's own day (their usual spot" + (b.at ? ", " + b.at : "") + ", or a student's timetable)." })); };
        drawRt();
        body.appendChild(el("h3", { text: "What they shout" }));
        body.appendChild(el("div", { cls: "gs-fields" }, [["bump", "Bumped into"], ["hit", "Hit"], ["honk", "Honked at / nearly run over"], ["flee", "Running away"], ["fight", "Squaring up"], ["yield", "Giving up a fight"]].map(function (k) {
          return input(k[1], ["barks", k[0]], { area: true, rows: 2, split: "\n", join: "\n", max: 500, def: "One line per row, up to 4. Empty: the game's usual lines." }); })));
      }
      if (tab === "voice") {
        var roles = [].slice.call(($("#fa-voice-roles") || { content: { children: [] } }).content.children).map(function (o) { return [o.value, o.value]; });
        body.appendChild(el("div", { cls: "gs-fields" }, [input("Voice", ["voice", "sex"], { options: [["male", "Male"], ["female", "Female"]], def: b.voice, help: "Also decides who can date them." }),
          input("Recorded by (voice role)", ["voice", "role"], { options: roles, def: "from the script's cast list" }),
          input("Pitch", ["voice", "pitch"], { type: "range", min: .5, maxv: 1.6, step: .05, help: "Game's own: " + (b.pitch || 1) }),
          input("Tone", ["voice", "tone"], { options: [["natural", "Natural"], ["deep", "Deeper"], ["warm", "Warm"], ["bright", "Brighter"]] })]));
        body.appendChild(el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "▶ Hear the speech blip", on: { click: blip } }));
      }
      if (tab === "lines") lines(body, c);
      if (tab === "hist") { var hb = el("div"); body.appendChild(hb); history(hb, "character", cur, function (d) { saved[cur] = d; if (!Object.keys(d).length) delete saved[cur]; draft = clone(d); draw(); render(); }); }
      dirty();
    }
    function blip() { try { var A = new (window.AudioContext || window.webkitAudioContext)(), c = byId(cur), v = draft.voice || {}, p = (+v.pitch || c.base.pitch || 1) * ({ deep: .88, warm: .96, bright: 1.1 }[v.tone] || 1), f = ((v.sex || c.base.voice) === "female" ? 230 : 140) * p;
      [0, .12, .24].forEach(function (t, i) { var o = A.createOscillator(), g = A.createGain(); o.type = "triangle"; o.frequency.value = f * [1, 1.12, .94][i]; g.gain.setValueAtTime(.0001, A.currentTime + t); g.gain.exponentialRampToValueAtTime(.2, A.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, A.currentTime + t + .1); o.connect(g).connect(A.destination); o.start(A.currentTime + t); o.stop(A.currentTime + t + .12); }); } catch (e) {} }
    function lines(body, c) {
      var q = el("input", { type: "search", cls: "gs-input gs-input--plain", placeholder: "Find a line", "aria-label": "Find a line" }), wrap = el("div");
      body.appendChild(el("p", { cls: "fa-hint", text: "Keep tokens like {{PLAYER_NAME}} as they are. Each line is saved on its own; edited lines are marked “needs re-record” for the voice script." }));
      body.appendChild(q); body.appendChild(wrap);
      if (!c.lines.length) { wrap.appendChild(el("p", { text: "This person has no spoken lines in the story data." })); return; }
      var groups = {}, order = []; c.lines.forEach(function (l) { var g = l.group || "Other"; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(l); });
      function row(l) {
        var cur2 = (saved[cur] && saved[cur].lines && saved[cur].lines[l.key]) || null, ta = el("textarea", { rows: 2, maxlength: 400, cls: "gs-input gs-input--plain", "aria-label": "Line" }), err = el("small", { cls: "fa-err", role: "alert" });
        ta.value = cur2 ? cur2.t : l.text; var sv = el("button", { type: "button", cls: "btn btn-primary btn-sm", text: "Save line", disabled: true }), rv = el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "Revert", disabled: !cur2 });
        ta.oninput = function () { var m = checkLine(ta.value, l.text); err.textContent = m; sv.disabled = !!m || ta.value === (cur2 ? cur2.t : l.text); };
        function put(next) { var base = clone(saved[cur] || {}); base.lines = base.lines || {}; if (next == null) delete base.lines[l.key]; else base.lines[l.key] = { t: next, o: l.text, g: (l.group || "").slice(0, 80) };
          return req("save/", { kind: "character", key: cur, data: base, note: (next == null ? "Line reverted: " : "Line edited: ") + l.text.slice(0, 60) }).then(function (j) { saved[cur] = j.data; if (j.data.lines) draft.lines = clone(j.data.lines); else delete draft.lines; dirty(); tellGames(); status(next == null ? "Line back to the original." : "Line saved. Marked: needs re-record."); draw(); var n = row(l); r.parentNode.replaceChild(n, r); }, function (e) { err.textContent = e.message; }); }
        sv.onclick = function () { put(ta.value.trim()); }; rv.onclick = function () { put(null); };
        var r = el("div", { cls: "fa-line" + (cur2 ? " fa-line--edited" : ""), "data-text": (l.text + " " + (cur2 ? cur2.t : "")).toLowerCase() }, [el("div", { cls: "fa-orig" }, [el("small", { text: "Original" }), el("span", { text: l.text })]), ta,
          el("div", { cls: "gs-row" }, [sv, rv, cur2 ? el("span", { cls: "gs-tag gs-tag--warn", text: "needs re-record" }) : null, el("small", { cls: "fa-where", text: l.groups.slice(0, 2).map(function (g) { return g.split(" — ")[1] || ""; }).filter(Boolean).join("; ") })]), err]);
        return r;
      }
      order.forEach(function (g, i) { var det = el("details", { cls: "fa-group", open: i === 0 || order.length < 4 ? true : null }), sum = el("summary", { text: g + " (" + groups[g].length + ")" }); det.appendChild(sum);
        var filled = false; function fill() { if (filled) return; filled = true; groups[g].forEach(function (l) { det.appendChild(row(l)); }); } if (det.open) fill(); det.addEventListener("toggle", fill); wrap.appendChild(det); });
      q.oninput = function () { var s = q.value.trim().toLowerCase(); [].forEach.call(wrap.querySelectorAll("details"), function (d) { if (s) { d.open = true; d.dispatchEvent(new Event("toggle")); } var any = false; [].forEach.call(d.querySelectorAll(".fa-line"), function (x) { var ok = !s || x.getAttribute("data-text").indexOf(s) >= 0; x.hidden = !ok; any = any || ok; }); d.hidden = !!s && !any; }); };
    }
    function save() { var data = clone(draft); delete data.lines; if (saved[cur] && saved[cur].lines) data.lines = saved[cur].lines; // lines are saved one by one
      if (data.look && data.look.acc) data.look.acc = data.look.acc.filter(Boolean); data.base = { name: byId(cur).base.name || "", sex: byId(cur).base.voice || "" };
      req("save/", { kind: "character", key: cur, data: data, note: "Character edited" }).then(function (j) { saved[cur] = j.data; draft = clone(j.data); tellGames(); draw(); render(); status("Saved for everyone (version " + j.version + ")."); }, function (e) { status(e.message, true); }); }
    function reset() { if (!confirm("Put " + byId(cur).name + " back exactly as the game has them? Your changes stay in History.")) return;
      req("reset/", { kind: "character", key: cur }).then(function () { delete saved[cur]; draft = {}; tellGames(); draw(); render(); status("Back to the game's own version."); }, function (e) { status(e.message, true); }); }

    /* ---------- preview: the game's own figure (samaru-anim.js) in three.js; the 2D face if WebGL is missing ---------- */
    var P3 = window.__faPreview = { T: null, failed: false }, pend = 0;
    function look() { var c = byId(cur), b = c.base, lk = draft.look || {}, o = { skin: lk.skin || b.skin, hair: lk.hair || b.hair, hairCol: lk.hairCol || b.hairCol, top: lk.top || b.top, voice: (draft.voice || {}).sex || b.voice };
      var fit = null; if (lk.fit || lk.acc || lk.beard || lk.brow || lk.eyes) { fit = { acc: (lk.acc || []).filter(Boolean), hair: o.hair === "cap" || o.hair === "hijab" ? "low" : o.hair }; for (var k in (lk.fit || {})) fit[k] = lk.fit[k]; ["beard", "brow", "eyes"].forEach(function (k2) { if (lk[k2]) fit[k2] = lk[k2]; }); }
      else if (b.fit) fit = clone(b.fit); if (fit) o.fit = window.SamaruSim ? SamaruSim.fitClean(fit, D.WARDROBE) : fit; return { look: o, mode: lk.mode || (o.hair === "cap" ? "kaftan" : "tee"), scale: lk.scale || 1 }; }
    function preview() { clearTimeout(pend); pend = setTimeout(draw3, 60); }
    function face(cv, L) { var x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height); x.fillStyle = "#1f2937"; x.fillRect(0, 0, cv.width, cv.height); if (window.SamaruDraw && SamaruDraw.face) { try { SamaruDraw.face(x, Object.assign({}, L.look), cv.width / 2, cv.height / 2 - 10, 92); } catch (e) {} }
      x.fillStyle = "#e5e7eb"; x.font = "600 15px system-ui"; x.textAlign = "center"; x.fillText("2D preview (3D needs WebGL)", cv.width / 2, cv.height - 18); }
    function draw3() {
      var cv = $("#fa-canvas"); if (!cv || !cur) return; var L = look();
      if (P3.failed || !window.SamaruGame || !Z.anim) { face(cv, L); return; }
      if (!P3.T) { face(cv, L); if (!P3.loading) { P3.loading = true; import(host.getAttribute("data-three")).then(function (T) { P3.T = T; draw3(); }, function (e) { P3.failed = true; P3.why = "three.js: " + (e && e.message || e); draw3(); }); } return; }
      try {
        var T = P3.T; if (P3.cv !== cv) { if (P3.r) P3.r.dispose(); var nc = el("canvas", { id: "fa-canvas", width: cv.width, height: cv.height, "aria-label": cv.getAttribute("aria-label") }); cv.parentNode.replaceChild(nc, cv); cv = nc; /* the 2D stand-in already took the old canvas */ P3.cv = cv; P3.r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); P3.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); P3.r.setSize(cv.width, cv.height, false);
          if (T.SRGBColorSpace) P3.r.outputColorSpace = T.SRGBColorSpace; P3.s = new T.Scene(); P3.c = new T.PerspectiveCamera(28, cv.width / cv.height, .1, 50); P3.c.position.set(5.6, 1.9, 1.2); P3.c.lookAt(0, 1.05, 0);
          P3.s.add(new T.HemisphereLight(0xffffff, 0x445566, 1.1)); var dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(4, 6, 3); P3.s.add(dl);
          var ground = new T.Mesh(new T.CircleGeometry(1.1, 40), new T.MeshBasicMaterial({ color: 0x334155 })); ground.rotation.x = -Math.PI / 2; P3.s.add(ground);
          var geo = {}, mats = {}, h = { geo: geo, hex: function (s) { return typeof s === "number" ? s : parseInt(String(s).replace("#", ""), 16); }, box: function (w, hh, d) { var k = "b" + w + "," + hh + "," + d; return geo[k] || (geo[k] = new T.BoxGeometry(w, hh, d)); },
            mat: function (col, o) { var k = col + (o || ""); return mats[k] || (mats[k] = o === "b" ? new T.MeshBasicMaterial({ color: col }) : o === "t" ? new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, depthWrite: false }) : new T.MeshLambertMaterial({ color: col, flatShading: true })); },
            R: { quality: "high", shadows: false, tx: 0, ty: 0 } };
          P3.an = Z.anim.init(T, h); }
        if (P3.g) P3.s.remove(P3.g); var key = JSON.stringify(L.look); L.look = clone(L.look); P3.g = P3.an.rig(L.look, L.mode, { scale: L.scale }); P3.g.rotation.y = P3.rot || 0; P3.s.add(P3.g); P3.key = key;
        var tick = function () { if (P3.cv !== $("#fa-canvas")) return; if (!reduce) { P3.rot = (P3.rot || 0) + .006; P3.g.rotation.y = P3.rot; } P3.r.render(P3.s, P3.c); if (!reduce) P3.raf = requestAnimationFrame(tick); };
        cancelAnimationFrame(P3.raf); tick();
      } catch (e) { if (window.console) console.warn("Preview", e); P3.failed = true; P3.why = String(e && e.message || e); face(cv, L); }
    }
  }

  /* =====================================================================================================
     CONFIG
     ===================================================================================================== */
  var FONT = { A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"], C: ["111", "100", "100", "100", "111"], D: ["110", "101", "101", "101", "110"], E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"], G: ["111", "100", "101", "101", "111"],
    H: ["101", "101", "111", "101", "101"], I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "111"], K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"], M: ["101", "111", "111", "101", "101"], N: ["111", "101", "101", "101", "101"],
    O: ["111", "101", "101", "101", "111"], P: ["111", "101", "111", "100", "100"], Q: ["111", "101", "101", "111", "001"], R: ["111", "101", "110", "101", "101"], S: ["111", "100", "111", "001", "111"], T: ["111", "010", "010", "010", "010"], U: ["101", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"], W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"], Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"], 0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "111", "001", "111"], 4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"], 6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "001", "001", "001"], 8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"] };
  function sign(cv, lines, bg, fg) { var x = cv.getContext("2d"), W = cv.width, H = cv.height, gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = W / 100; x.strokeRect(W * .014, W * .014, W * .972, H - W * .028); x.textAlign = "center"; x.textBaseline = "middle";
    lines.forEach(function (l) { var s = l[0], fs = l[1] + 4; do { fs -= 4; x.font = "900 " + fs + "px system-ui, 'Arial Black', sans-serif"; } while (x.measureText(s).width > W * .92 && fs > 14); x.lineWidth = fs * .09; x.strokeStyle = "rgba(0,0,0,.55)"; x.strokeText(s, W / 2, l[2]); x.fillStyle = l[3] || fg; x.fillText(s, W / 2, l[2]); }); }
  function config() {
    var form = $("#fa-config"), defs = JSON.parse($("#fa-defaults").textContent), cfg = null;
    var names = ["gameName", "gameShortName", "initialsOverride", "tagline", "currencyName", "primaryColour", "secondaryColour"];
    function fill(c) { names.forEach(function (n) { form.elements[n].value = c[n] == null ? "" : c[n]; }); show(); }
    function read() { var c = {}; names.forEach(function (n) { c[n] = form.elements[n].value.trim(); }); c.initialsOverride = c.initialsOverride.toUpperCase(); return c; }
    function show() {
      var c = read(), errs = F.checkConfig(c), eb = $("#fa-config-err"); eb.hidden = !errs.length; eb.textContent = ""; if (errs.length) eb.appendChild(el("ul", {}, errs.map(function (e) { return el("li", { text: e }); })));
      if (c.gameName) F.setConfig(c); var C = F.cfg(), ini = F.shownInitials(C); $("#fa-auto-init").textContent = F.initialsOf(c.gameName);
      [].forEach.call(document.querySelectorAll("[data-p]"), function (n) { var k = n.getAttribute("data-p"); n.textContent = k === "upper" ? C.gameName.toUpperCase() : k === "tagline" ? F.resolveText(C.tagline) : k === "name" ? C.gameName : k === "short" ? C.gameShortName : k === "currency" ? C.currencySymbol + "1,000 " + C.currencyName : k === "sample" ? F.resolveText("Story text: “Welcome to {{GAME_NAME}}, {{PLAYER_NAME}}. Your {{GAME_INITIALS}} ID card costs 2,000 {{CURRENCY}}.”") : ""; });
      $(".fa-title").style.background = "linear-gradient(135deg," + C.secondaryColour + ",#0b1220)"; $(".fa-title b").style.color = C.primaryColour;
      sign($("#fa-sign"), [["M.I. BUGAJE", 150, 140], ["PRESENTS", 50, 245, "#fde047"], [C.gameName.toUpperCase(), 78, 370]], [C.secondaryColour, "#134e4a"], "#ffffff");
      sign($("#fa-plate"), [[C.gameName.toUpperCase(), 84, 68]], ["#f7f3ea", "#f7f3ea"], "#14532d");
      var lt = $("#fa-letters"); lt.textContent = ""; var cols = ["#e11d48", "#f59e0b", "#16a34a", "#2563eb"];
      ini.toUpperCase().split("").forEach(function (ch, i) { var g = el("div", { cls: "fa-glyph" }); (FONT[ch] || FONT.O).forEach(function (r) { r.split("").forEach(function (b) { g.appendChild(el("i", { style: b === "1" ? "background:" + cols[i % 4] : "" })); }); }); lt.appendChild(g); });
      return errs;
    }
    form.addEventListener("input", show);
    $("[data-fa=defaults]").addEventListener("click", function () { fill(defs); status("The original name is filled in. Save to use it."); });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (show().length) { status("Fix the problems above first.", true); return; }
      req("save/", { kind: "config", key: "", data: read(), note: form.elements.note.value }).then(function (j) { cfg = j.config; tellGames(); status("Saved for everyone (version " + j.version + "). Open games update within two minutes."); form.elements.note.value = ""; hist(); }, function (er) { status(er.message, true); }); });
    function hist() { history($("#fa-history"), "config", "", function () { req("").then(function (b) { fill(b.config); }); }); }
    req("").then(function (b) { cfg = b.config; fill(cfg); hist(); }, function (e) { status(e.message, true); fill(defs); });
  }

  /* =====================================================================================================
     CREDITS
     ===================================================================================================== */
  function credits() {
    var model = null, box = $("#fa-sections"), uid = 0, dragged = null;
    function nid(p) { return p + Date.now().toString(36) + (uid++); }
    req("?all=1").then(function (b) { model = b.credits; delete model.version; $("#fa-outro").value = model.outro || ""; drawAll(); history($("#fa-history"), "credits", "", function (d) { model = d.sections ? d : model; drawAll(); }); }, function (e) { box.textContent = e.message; });
    $("#fa-outro").addEventListener("input", function () { model.outro = this.value; prev(); });
    $("#fa-cq").addEventListener("input", filter);
    $("[data-fa=add-section]").addEventListener("click", function () { model.sections.push({ id: nid("s"), title: "New section", visible: true, entries: [] }); drawAll(); });
    $("[data-fa=roll]").addEventListener("click", function () { var layer = el("div", { style: "position:fixed;inset:0;z-index:9999" }); document.body.appendChild(layer); F.rollCredits({ root: layer, credits: shown(), onEnd: function () { layer.remove(); } }); });
    $("[data-fa=save-credits]").addEventListener("click", function () { renumber(); req("save/", { kind: "credits", key: "", data: { sections: model.sections, outro: model.outro || "" }, note: $("#fa-cnote").value }).then(function (j) { model = j.data; tellGames(); $("#fa-cnote").value = ""; drawAll(); status("Saved for everyone (version " + j.version + ")."); history($("#fa-history"), "credits", "", function (d) { model = d.sections ? d : model; drawAll(); }); }, function (e) { status(e.message, true); }); });
    function renumber() { model.sections.forEach(function (s, i) { s.order = i; s.entries.forEach(function (e, j) { e.order = j; }); }); }
    function shown() { renumber(); return { outro: model.outro, sections: model.sections.map(function (s) { return Object.assign({}, s, { entries: s.entries.filter(function (e) { return e.visible !== false && e.approved === true; }) }); }) }; }
    function prev() { var r = $("#fa-roll"); r.textContent = ""; F.creditLines(shown(), F.cfg()).forEach(function (row) { r.appendChild(el(row.k === "title" ? "h3" : "div", { cls: "fa-r-" + row.k, text: row.t || "" })); }); warn(); }
    function warn() { var w = [], seen = {}; model.sections.forEach(function (s) { if (!s.title.trim()) w.push("A section has no title."); if (!s.entries.length) w.push("“" + s.title + "” has no entries.");
      s.entries.forEach(function (e) { var k = s.id + "|" + e.name.trim().toLowerCase() + "|" + (e.role || "").trim().toLowerCase(); if (!e.name.trim()) w.push("An entry in “" + s.title + "” has no name."); else { if (!(e.role || "").trim()) w.push(e.name + " (" + s.title + ") has no role."); if (seen[k]) w.push(e.name + " appears twice in “" + s.title + "” with the same role."); seen[k] = 1; }
        if (e.link && !/^https?:\/\//.test(e.link)) w.push(e.name + ": the link must start with https://"); }); });
      var pend = 0; model.sections.forEach(function (s) { s.entries.forEach(function (e) { if (e.approved !== true && e.visible !== false) pend++; }); }); if (pend) w.unshift(pend + " name(s) wait for approval and are hidden from players.");
      var b = $("#fa-warn"); b.hidden = !w.length; b.textContent = ""; if (w.length) b.appendChild(el("ul", {}, w.slice(0, 12).map(function (t) { return el("li", { text: t }); }).concat(w.length > 12 ? [el("li", { text: "…and " + (w.length - 12) + " more." })] : []))); }
    function filter() { var q = $("#fa-cq").value.trim().toLowerCase(); [].forEach.call(box.querySelectorAll(".fa-entry"), function (r) { r.hidden = !!q && r.getAttribute("data-s").indexOf(q) < 0; }); }
    function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; drawAll(); }
    function drawAll() {
      box.textContent = "";
      model.sections.forEach(function (s, si) {
        var card = el("div", { cls: "fa-sec" + (s.visible === false ? " fa-off" : "") });
        var ti = el("input", { cls: "gs-input gs-input--plain fa-sec__t", value: s.title, maxlength: 60, "aria-label": "Section title" }); ti.oninput = function () { s.title = ti.value; prev(); };
        var vis = el("input", { type: "checkbox", "aria-label": "Show this section" }); vis.checked = s.visible !== false; vis.onchange = function () { s.visible = vis.checked; card.classList.toggle("fa-off", !vis.checked); prev(); };
        card.appendChild(el("div", { cls: "gs-row fa-sec__head" }, [ti, el("label", { cls: "fa-mini" }, [vis, " shown"]), el("button", { type: "button", cls: "btn btn-ghost btn-sm", "aria-label": "Move section up", text: "↑", on: { click: function () { move(model.sections, si, -1); } } }),
          el("button", { type: "button", cls: "btn btn-ghost btn-sm", "aria-label": "Move section down", text: "↓", on: { click: function () { move(model.sections, si, 1); } } }),
          el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "Delete section", on: { click: function () { if (confirm("Delete the section “" + s.title + "” and its " + s.entries.length + " entries?")) { model.sections.splice(si, 1); drawAll(); } } } })]));
        var ul = el("ol", { cls: "fa-entries" }); card.appendChild(ul);
        s.entries.forEach(function (e, ei) {
          function f(k, label, max, wide) { var i = el("input", { cls: "gs-input gs-input--plain", value: e[k] || "", maxlength: max, placeholder: label, "aria-label": label }); i.oninput = function () { e[k] = i.value; li.setAttribute("data-s", [e.name, e.role, e.characterName, e.note].join(" ").toLowerCase()); prev(); }; return wide ? el("span", { cls: "fa-wide" }, [i]) : i; }
          var ap = el("input", { type: "checkbox", "aria-label": "Approved by " + (e.name || "this person") }), vi = el("input", { type: "checkbox", "aria-label": "Shown" });
          ap.checked = e.approved === true; vi.checked = e.visible !== false; ap.onchange = function () { e.approved = ap.checked; li.classList.toggle("fa-pending", !ap.checked); prev(); }; vi.onchange = function () { e.visible = vi.checked; li.classList.toggle("fa-off", !vi.checked); prev(); };
          var li = el("li", { cls: "fa-entry" + (e.approved === true ? "" : " fa-pending") + (e.visible === false ? " fa-off" : ""), draggable: "true", "data-s": [e.name, e.role, e.characterName, e.note].join(" ").toLowerCase() }, [
            el("span", { cls: "fa-grip", "aria-hidden": "true", text: "⋮⋮" }), f("name", "Name", 80), f("role", "Role (e.g. Voiced the lecturer)", 120), f("characterName", "Character", 60), f("note", "Note", 200, true), f("link", "Link (https://…)", 200, true),
            el("span", { cls: "fa-ctl" }, [el("label", { cls: "fa-mini" }, [ap, " approved"]), el("label", { cls: "fa-mini" }, [vi, " shown"]),
              el("button", { type: "button", cls: "btn btn-ghost btn-sm", "aria-label": "Move up", text: "↑", on: { click: function () { move(s.entries, ei, -1); } } }), el("button", { type: "button", cls: "btn btn-ghost btn-sm", "aria-label": "Move down", text: "↓", on: { click: function () { move(s.entries, ei, 1); } } }),
              el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "Duplicate", on: { click: function () { var c = clone(e); c.id = nid("e"); s.entries.splice(ei + 1, 0, c); drawAll(); } } }),
              el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "Delete", on: { click: function () { s.entries.splice(ei, 1); drawAll(); } } })])]);
          li.addEventListener("dragstart", function (ev) { dragged = { s: s, i: ei }; try { ev.dataTransfer.setData("text/plain", e.name); ev.dataTransfer.effectAllowed = "move"; } catch (x) {} li.classList.add("fa-drag"); });
          li.addEventListener("dragend", function () { li.classList.remove("fa-drag"); });
          li.addEventListener("dragover", function (ev) { if (dragged) { ev.preventDefault(); li.classList.add("fa-over"); } }); li.addEventListener("dragleave", function () { li.classList.remove("fa-over"); });
          li.addEventListener("drop", function (ev) { ev.preventDefault(); if (!dragged) return; var it = dragged.s.entries.splice(dragged.i, 1)[0], at = dragged.s === s && dragged.i < ei ? ei - 1 : ei; s.entries.splice(at, 0, it); dragged = null; drawAll(); });
          ul.appendChild(li);
        });
        card.appendChild(el("button", { type: "button", cls: "btn btn-ghost btn-sm", text: "+ Add a person", on: { click: function () { s.entries.push({ id: nid("e"), name: "", role: "", note: "", link: "", characterName: "", visible: true, approved: false }); drawAll(); var ins = box.querySelectorAll(".fa-sec")[si].querySelectorAll(".fa-entry input"); var last = ins[ins.length - 8]; if (last) last.focus(); } } }));
        box.appendChild(card);
      });
      filter(); prev();
    }
  }

  function boot() { if (!F) { host.hidden = false; host.textContent = "The game's data did not load."; return; } if (PAGE === "fslg_chars") characters(); else if (PAGE === "fslg_config") config(); else if (PAGE === "fslg_credits") credits(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
