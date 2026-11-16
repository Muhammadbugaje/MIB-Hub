/* MIB-Hub phone pad (window.MIBPad): a round, Sega-style controller for the arcade games' touch layer.
 *
 *   Left:  a round 8-way D-pad. Slide the thumb anywhere on the disc: up, down, left, right and the four corners
 *          (up-forward, down-back...). A small dead zone in the middle; the arrows light up for the active direction.
 *   Right: four round buttons in a diamond. A thumb on the gap between two buttons presses both (like rolling a thumb
 *          on a real pad), and sliding from one button to another works without lifting.
 *   Extra: optional small round buttons above the diamond (e.g. Block and Special).
 *
 * Every finger is tracked on its own, so you can hold a direction and press buttons, or slide between buttons.
 * arcade.js uses it through api.usePad(spec) (see clash.js, Impulse Arena):
 *
 *   MIBPad.build(touchLayer, { dpad: { up, down, left, right },              key codes, e.g. "@up"
 *                              buttons: [{ code, label, name, pos: "top"|"right"|"bottom"|"left", color }],
 *                              extra: [{ code, label, name, color }] },
 *                {  press(code), release(code), buzz(ms), scale, alpha, layout(id) -> saved { x, y, s, a, h } | null })
 *     -> { destroy() }
 *
 * Pure helpers (tested in apps/web/test/play-pad.test.ts): dir8(dx, dy, dead) and hits(buttons, x, y).
 * No dependencies; runs in Safari 15+. */
(function (root) {
  "use strict";
  var P = {};

  /** 8-way direction from an offset (y grows downward), each axis -1..1 of the disc's radius. Inside `dead` (0..1): none. */
  P.dir8 = function (dx, dy, dead) {
    var out = { up: false, down: false, left: false, right: false, sector: -1 };
    var d = Math.sqrt(dx * dx + dy * dy);
    if (!(d > (dead == null ? 0.22 : dead))) return out;
    var s = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    s = ((s % 8) + 8) % 8; // 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right
    out.sector = s;
    out.right = s === 7 || s === 0 || s === 1;
    out.down = s === 1 || s === 2 || s === 3;
    out.left = s === 3 || s === 4 || s === 5;
    out.up = s === 5 || s === 6 || s === 7;
    return out;
  };

  /** Which round buttons a finger at (x, y) presses: every button it is on (two on the gap between them), or else
   *  the nearest one within a forgiving reach. buttons: [{ id, x, y, r }] (centres and radii, same units). */
  P.hits = function (buttons, x, y) {
    var on = [], best = null, bestD = Infinity;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i], d = Math.sqrt((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y));
      if (d <= b.r * 1.12) on.push(b.id);
      if (d <= b.r * 1.6 && d < bestD) { bestD = d; best = b.id; }
    }
    if (!on.length && best != null) on.push(best);
    return on;
  };

  var doc = root.document;
  if (!doc || !doc.createElement) { root.MIBPad = P; return; } // tests: helpers only

  var CSS =
    ".mp-pz{position:absolute;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
    ".mp-dpad{border-radius:50%;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.16),rgba(255,255,255,.05) 60%,rgba(0,0,0,.25));border:2px solid rgba(255,255,255,.32);box-shadow:inset 0 2px 10px rgba(255,255,255,.08),0 6px 18px rgba(0,0,0,.35)}" +
    ".mp-dpad svg{position:absolute;inset:8%;width:84%;height:84%;overflow:visible}" +
    ".mp-dpad .x{fill:rgba(10,20,30,.6);stroke:rgba(255,255,255,.18);stroke-width:1}" +
    ".mp-dpad .a{fill:rgba(255,255,255,.8);transition:fill .06s}" +
    ".mp-dpad .a.is-on{fill:var(--gm-a,#3dd68c);filter:drop-shadow(0 0 4px var(--gm-a,#3dd68c))}" +
    ".mp-dpad b{position:absolute;z-index:2;left:50%;top:50%;width:30%;height:30%;margin:-15% 0 0 -15%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#cfe3ee 55%,#8aa9b8);box-shadow:0 3px 10px rgba(0,0,0,.5);opacity:.85;will-change:transform}" +
    ".mp-dpad.is-on{border-color:rgba(255,255,255,.7)}" +
    ".mp-btns .mp-b,.mp-extra .mp-b{position:absolute;display:grid;place-items:center;border-radius:50%;border:2px solid rgba(255,255,255,.55);color:#fff;font:800 var(--fs,15px)/1 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.02em;text-shadow:0 1px 2px rgba(0,0,0,.7);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.35),var(--c,rgba(80,100,120,.6)) 60%);box-shadow:0 4px 12px rgba(0,0,0,.4),inset 0 -3px 6px rgba(0,0,0,.25);transition:transform .05s,filter .05s;pointer-events:none}" +
    ".mp-b small{display:block;font-size:.55em;font-weight:700;opacity:.85;margin-top:2px}" +
    ".mp-btns .mp-b{width:40%;height:40%}" +
    ".mp-b[data-pos=top]{left:30%;top:2%}.mp-b[data-pos=bottom]{left:30%;bottom:2%}.mp-b[data-pos=left]{left:2%;top:30%}.mp-b[data-pos=right]{right:2%;top:30%}" +
    ".mp-b.is-down{transform:scale(.9);filter:brightness(1.35);border-color:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.25),0 2px 6px rgba(0,0,0,.4)}" +
    ".mp-extra .mp-b{top:0;bottom:0;border-radius:999px}";
  // A cross with four arrows, drawn in a 100x100 box (scales with the disc).
  var DPAD_SVG = "<svg viewBox='0 0 100 100' aria-hidden='true'><path class='x' d='M37 4h26a4 4 0 0 1 4 4v25h25a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H67v25a4 4 0 0 1-4 4H37a4 4 0 0 1-4-4V67H8a4 4 0 0 1-4-4V37a4 4 0 0 1 4-4h25V8a4 4 0 0 1 4-4z'/>" +
    "<path class='a' data-d='up' d='M50 10l11 14H39z'/><path class='a' data-d='down' d='M50 90L39 76h22z'/><path class='a' data-d='left' d='M10 50l14-11v22z'/><path class='a' data-d='right' d='M90 50L76 61V39z'/></svg>";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  P.build = function (layer, spec, io) {
    if (!doc.getElementById("mib-pad-css")) { var st = doc.createElement("style"); st.id = "mib-pad-css"; st.textContent = CSS; doc.head.appendChild(st); }
    io = io || {};
    var stage = layer.parentElement || layer, sr = stage.getBoundingClientRect();
    var k = clamp(+io.scale || 1, 0.6, 1.6), alpha = clamp(+io.alpha || 0.85, 0.3, 1);
    // Sized to thumbs: about a fifth of the stage width in landscape, never smaller than 112 px.
    var D = Math.round(clamp(Math.min(sr.height * 0.4, sr.width * 0.19), 112, 156) * k), C = Math.round(D * 1.08), E = Math.round(clamp(D * 0.34, 44, 60));
    var gapX = "max(14px, env(safe-area-inset-left, 0px) + 8px)", gapR = "max(14px, env(safe-area-inset-right, 0px) + 8px)", gapB = "max(12px, env(safe-area-inset-bottom, 0px) + 6px)";
    var parts = [], ptrs = {}, down = {}, dir = { up: false, down: false, left: false, right: false };

    function zone(cls, id, label, w, h, css) {
      var z = doc.createElement("div"); z.className = "mp-pz " + cls; z.setAttribute("data-lay", id); z.setAttribute("data-lay-label", label);
      z.style.cssText = "width:" + w + "px;height:" + h + "px;opacity:" + alpha + ";" + css;
      var L = io.layout ? io.layout(id) : null;
      if (L) { z.style.left = L.x + "%"; z.style.top = L.y + "%"; z.style.right = "auto"; z.style.bottom = "auto"; z.style.transform = "translate(-50%,-50%)"; z.style.width = Math.round(w * (L.s || 1)) + "px"; z.style.height = Math.round(h * (L.s || 1)) + "px"; if (L.a != null) z.style.opacity = L.a; if (L.h) z.setAttribute("data-lay-hidden", ""); }
      layer.appendChild(z); parts.push(z); return z;
    }
    function btnHtml(b, fs, more) { return "<span class='mp-b' data-code='" + esc(b.code) + "'" + (b.pos ? " data-pos='" + esc(b.pos) + "'" : "") + " style='" + (more || "") + "--c:" + esc(b.color || "rgba(80,100,120,.6)") + ";--fs:" + fs + "px' aria-hidden='true'>" + esc(b.label) + (b.sub ? "<small>" + esc(b.sub) + "</small>" : "") + "</span>"; }

    var dp = spec.dpad ? zone("mp-dpad", "pad-dpad", "Direction pad", D, D, "left:" + gapX + ";bottom:" + gapB) : null;
    if (dp) { dp.innerHTML = DPAD_SVG + "<b></b>"; dp.setAttribute("role", "group"); dp.setAttribute("aria-label", "Direction pad"); }
    var bz = (spec.buttons || []).length ? zone("mp-btns", "pad-buttons", "Action buttons", C, C, "right:" + gapR + ";bottom:" + gapB) : null;
    if (bz) bz.innerHTML = spec.buttons.map(function (b) { return btnHtml(b, Math.round(C * 0.13)); }).join("");
    var n = (spec.extra || []).length, ez = n ? zone("mp-extra", "pad-extra", "Extra buttons", n * E + (n - 1) * 10, E, "right:calc(" + gapR + " + " + Math.round((C - (n * E + (n - 1) * 10)) / 2) + "px);bottom:calc(" + gapB + " + " + (C + 10) + "px)") : null;
    if (ez) ez.innerHTML = spec.extra.map(function (b, i) { return btnHtml(b, Math.round(E * 0.26), "left:" + (n > 1 ? (i * 100 / n + 0) : 0) + "%;width:" + (n > 1 ? 100 / n - 4 : 100) + "%;"); }).join("");
    [bz, ez].forEach(function (z) { if (!z) return; z.setAttribute("role", "group"); z.setAttribute("aria-label", "Buttons: " + [].map.call(z.querySelectorAll(".mp-b"), function (b) { return b.textContent; }).join(", ")); });

    function setDir(nd) {
      ["up", "down", "left", "right"].forEach(function (d) {
        if (nd[d] === dir[d]) return; dir[d] = nd[d];
        var code = spec.dpad[d]; if (nd[d]) { io.press(code); if (io.buzz) io.buzz(6); } else io.release(code);
        var arrow = dp.querySelector("[data-d=" + d + "]"); if (arrow) arrow.setAttribute("class", nd[d] ? "a is-on" : "a");
      });
    }
    function dpadMove(e) {
      var r = dp.getBoundingClientRect(), R = r.width / 2, dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      setDir(P.dir8(dx, dy, 0.22));
      var m = Math.min(1, Math.sqrt(dx * dx + dy * dy)), a = Math.atan2(dy, dx), nub = dp.querySelector("b");
      if (nub) nub.style.transform = "translate(" + (Math.cos(a) * m * R * 0.42).toFixed(1) + "px," + (Math.sin(a) * m * R * 0.42).toFixed(1) + "px)";
    }
    function dpadEnd() { setDir({ up: false, down: false, left: false, right: false }); var nub = dp.querySelector("b"); if (nub) nub.style.transform = ""; dp.classList.remove("is-on"); }

    function centres() {
      var out = [];
      [bz, ez].forEach(function (z) { if (!z || z.hasAttribute("data-lay-hidden")) return; [].forEach.call(z.querySelectorAll(".mp-b"), function (el) { var r = el.getBoundingClientRect(); out.push({ id: el.getAttribute("data-code"), x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2, el: el }); }); });
      return out;
    }
    function count(code) { var c = 0; for (var p in ptrs) if (ptrs[p].codes && ptrs[p].codes.indexOf(code) >= 0) c++; return c; }
    function btnMove(pid, e) {
      var list = centres(), now = P.hits(list, e.clientX, e.clientY), was = ptrs[pid].codes || [];
      ptrs[pid].codes = now;
      was.forEach(function (c) { if (now.indexOf(c) < 0 && count(c) === 0) { io.release(c); down[c] = false; mark(list, c, false); } });
      now.forEach(function (c) { if (!down[c]) { down[c] = true; io.press(c); if (io.buzz) io.buzz(8); } mark(list, c, true); });
    }
    function mark(list, code, on) { list.forEach(function (b) { if (b.id === code) b.el.classList.toggle("is-down", on); }); }
    function btnEnd(pid) {
      var was = ptrs[pid] && ptrs[pid].codes || []; delete ptrs[pid];
      var list = centres(); was.forEach(function (c) { if (count(c) === 0) { io.release(c); down[c] = false; mark(list, c, false); } });
    }

    function onDown(e) {
      if (stage.classList.contains("gms-editing") || layer.classList.contains("is-editing")) return; // the layout editor is moving things
      var z = e.currentTarget; e.preventDefault();
      try { z.setPointerCapture(e.pointerId); } catch { /* old browser */ }
      if (z === dp) { ptrs[e.pointerId] = { zone: "dpad" }; dp.classList.add("is-on"); dpadMove(e); }
      else { ptrs[e.pointerId] = { zone: "btns", codes: [] }; btnMove(e.pointerId, e); }
    }
    function onMove(e) { var p = ptrs[e.pointerId]; if (!p) return; e.preventDefault(); if (p.zone === "dpad") dpadMove(e); else btnMove(e.pointerId, e); }
    function onUp(e) { var p = ptrs[e.pointerId]; if (!p) return; if (p.zone === "dpad") { delete ptrs[e.pointerId]; dpadEnd(); } else btnEnd(e.pointerId); }
    parts.forEach(function (z) {
      z.addEventListener("pointerdown", onDown);
      z.addEventListener("pointermove", onMove);
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) { z.addEventListener(t, onUp); });
      z.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    function releaseAll() { for (var p in ptrs) onUp({ pointerId: p }); }
    root.addEventListener("blur", releaseAll);

    return {
      destroy: function () { releaseAll(); root.removeEventListener("blur", releaseAll); parts.forEach(function (z) { if (z.parentNode) z.parentNode.removeChild(z); }); parts = []; },
      parts: function () { return parts.slice(); }
    };
  };

  root.MIBPad = P;
})(typeof window !== "undefined" ? window : globalThis);
