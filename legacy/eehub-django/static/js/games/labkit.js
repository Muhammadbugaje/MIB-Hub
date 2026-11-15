/* LabKit: small shared helpers for the engineering "lab" games (Signal Surfer, Maglev Rescue, Drive Room).
 * A readable DOM HUD (real CSS pixels, so it stays legible on a 360 px phone), level grids with stars, sliders, and
 * canvas strip charts. Nothing runs at load time except defining functions. */
(function (root) {
  "use strict";
  var LK = {}, styled = false;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  LK.esc = esc;
  LK.css = function () {
    if (styled || typeof document === "undefined") return; styled = true;
    var st = document.createElement("style");
    st.textContent = ".lk-hud{display:flex;flex-wrap:wrap;gap:4px 6px;padding:6px 8px;font:600 13px/1.25 system-ui,sans-serif;color:#fff}" +
      ".lk-chip{background:rgba(6,14,22,.78);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 9px;white-space:nowrap}" +
      ".lk-chip b{color:var(--lk-a,#7ef0ff);font-weight:800}.lk-chip.warn b{color:#ffb347}.lk-chip.bad b{color:#ff6b6b}.lk-chip.ok b{color:#3dd68c}" +
      ".lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;margin:10px 0;max-height:46vh;overflow:auto;padding:2px}" +
      ".lk-lv{min-height:58px;text-align:left;line-height:1.2;padding:8px 10px!important;display:flex;flex-direction:column;gap:2px;justify-content:center}" +
      ".lk-lv small{opacity:.75;font-size:11.5px}.lk-lv .lk-st{color:#f6c445;letter-spacing:1px;font-size:12px}" +
      ".lk-sl{display:grid;grid-template-columns:minmax(90px,30%) 1fr 74px;align-items:center;gap:8px;margin:8px 0;font-size:14px}" +
      ".lk-sl input[type=range]{width:100%;accent-color:var(--lk-a,#7ef0ff);min-height:32px}.lk-sl output{font:600 13px ui-monospace,monospace;text-align:right}" +
      ".lk-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}" +
      ".lk-card{text-align:left;padding:10px!important;min-height:64px;line-height:1.25}.lk-card[aria-pressed=true]{outline:3px solid var(--lk-a,#7ef0ff)}" +
      ".lk-card small{display:block;opacity:.8;font-size:12px}.lk-card:focus small,.lk-card[aria-pressed=true]:focus small{opacity:1;color:inherit}.lk-teach{border-left:4px solid var(--lk-a,#7ef0ff);padding:8px 12px;background:rgba(255,255,255,.06);border-radius:8px;margin:8px 0}" +
      ".lk-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.lk-canvas{width:100%;max-width:560px;height:auto;display:block;margin:6px auto;border-radius:10px;background:#0b1520}" +
      "@media (max-height:520px){.lk-grid{max-height:none}}@media (max-width:520px){.lk-hud{font-size:12px;padding:4px 6px}.lk-sl{grid-template-columns:1fr 64px}.lk-sl label{grid-column:1/-1}}";
    document.head.appendChild(st);
  };
  LK.hud = function (chips, accent) { // chips: [[label, value, cls?], ...]
    if (typeof document === "undefined") return; var h = document.querySelector("[data-gm-hud]"); if (!h) return;
    var html = "<div class='lk-hud' style='--lk-a:" + (accent || "#7ef0ff") + "'>" + chips.map(function (c) { return "<span class='lk-chip " + (c[2] || "") + "'>" + esc(c[0]) + " <b>" + esc(c[1]) + "</b></span>"; }).join("") + "</div>";
    if (h.__lk !== html) { h.innerHTML = html; h.__lk = html; }
  };
  LK.clearHud = function () { if (typeof document === "undefined") return; var h = document.querySelector("[data-gm-hud]"); if (h) { h.innerHTML = ""; h.__lk = ""; } };
  LK.stars = function (n) { n = n || 0; return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n); };
  LK.grid = function (levels, save, heroAll) {
    return "<div class='lk-grid'>" + levels.map(function (L, k) {
      var open = heroAll || k <= (save.cleared || 0), st = (save.stars || {})[L.id] || 0;
      return "<button type='button' class='gm-btn lk-lv" + (open ? (st ? "" : " gm-btn--go") : "") + "' data-act='" + (open ? "lv" : "no") + "' data-k='" + k + "'" + (open ? "" : " disabled aria-disabled='true'") + ">" +
        "<span>" + (k + 1) + ". " + esc(L.name) + "</span><span class='lk-st' aria-label='" + st + " stars'>" + (open ? LK.stars(st) : "🔒") + "</span></button>";
    }).join("") + "</div>";
  };
  LK.slider = function (id, label, min, max, step, val, unit) {
    return "<div class='lk-sl'><label for='lk-" + id + "'>" + esc(label) + "</label><input type='range' id='lk-" + id + "' data-sl='" + id + "' min='" + min + "' max='" + max + "' step='" + step + "' value='" + val + "'><output data-out='" + id + "'>" + fmtv(val, step) + " " + esc(unit || "") + "</output></div>";
  };
  function fmtv(v, step) { var d = String(step).indexOf(".") >= 0 ? String(step).split(".")[1].length : 0; return Number(v).toFixed(d); }
  LK.bindSliders = function (root, onChange) { // live outputs; onChange(id, value)
    if (!root) return; [].forEach.call(root.querySelectorAll("[data-sl]"), function (inp) {
      inp.addEventListener("input", function () { var id = inp.getAttribute("data-sl"), out = root.querySelector("[data-out='" + id + "']"), unit = out ? out.textContent.replace(/^[-\d.]+\s*/, "") : "";
        if (out) out.textContent = fmtv(inp.value, inp.step) + " " + unit; if (onChange) onChange(id, +inp.value); });
    });
  };
  LK.read = function (root, id) { var el = root && root.querySelector("[data-sl='" + id + "']"); return el ? +el.value : NaN; };
  LK.overlay = function () { return typeof document === "undefined" ? null : document.querySelector("[data-gm-overlay]"); };
  /* strip chart: series [{pts: [[x, y]...], col, w, dash}], o {x0, x1, y0, y1, title, band: [lo, hi], lines: [{y, col}], yfmt} */
  LK.plot = function (x, r, series, o) {
    o = o || {}; x.save(); x.fillStyle = "rgba(6,14,22,.82)"; x.fillRect(r.x, r.y, r.w, r.h); x.strokeStyle = "rgba(255,255,255,.15)"; x.lineWidth = 1; x.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    var px = function (v) { return r.x + 6 + (v - o.x0) / ((o.x1 - o.x0) || 1) * (r.w - 12); }, py = function (v) { return r.y + r.h - 6 - (v - o.y0) / ((o.y1 - o.y0) || 1) * (r.h - 26); };
    if (o.band) { x.fillStyle = "rgba(61,214,140,.14)"; var a = py(o.band[1]), b = py(o.band[0]); x.fillRect(r.x + 2, a, r.w - 4, b - a); }
    (o.lines || []).forEach(function (l) { x.strokeStyle = l.col || "rgba(255,255,255,.35)"; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(r.x + 4, py(l.y)); x.lineTo(r.x + r.w - 4, py(l.y)); x.stroke(); x.setLineDash([]); });
    series.forEach(function (s) {
      if (!s.pts || !s.pts.length) return; x.strokeStyle = s.col || "#7ef0ff"; x.lineWidth = s.w || 2; x.setLineDash(s.dash || []); x.beginPath();
      s.pts.forEach(function (p, i) { var X = px(p[0]), Y = Math.max(r.y + 18, Math.min(r.y + r.h - 4, py(p[1]))); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.stroke(); x.setLineDash([]);
    });
    if (o.title) { x.fillStyle = "#e6f1ff"; x.font = "700 15px system-ui"; x.textAlign = "left"; x.fillText(o.title, r.x + 8, r.y + 16); }
    if (o.legend) { var lx = r.x + r.w - 8; x.textAlign = "right"; x.font = "600 13px system-ui"; o.legend.slice().reverse().forEach(function (l) { x.fillStyle = l[1]; x.fillText(l[0], lx, r.y + 16); lx -= x.measureText(l[0]).width + 12; }); }
    x.restore();
    return { px: px, py: py };
  };
  LK.load = function (A, key, def) { var s = A.store(key); if (!s || typeof s !== "object") s = {}; Object.keys(def).forEach(function (k) { if (s[k] === undefined) s[k] = def[k]; }); return s; };
  LK.optsHtml = function (opts, defs) { // defs: [[key, label]] booleans
    return "<div class='lk-row'>" + defs.map(function (d) { return "<label class='lk-chip' style='color:inherit;background:rgba(255,255,255,.06)'><input type='checkbox' data-opt='" + d[0] + "'" + (opts[d[0]] ? " checked" : "") + "> " + esc(d[1]) + "</label>"; }).join("") + "</div>";
  };
  LK.bindOpts = function (root, opts, persist) { if (!root) return; [].forEach.call(root.querySelectorAll("[data-opt]"), function (c) { c.addEventListener("change", function () { opts[c.getAttribute("data-opt")] = c.checked; persist(); }); }); };
  root.LabKit = LK;
  if (typeof module !== "undefined") module.exports = LK;
})(typeof window !== "undefined" ? window : globalThis);
