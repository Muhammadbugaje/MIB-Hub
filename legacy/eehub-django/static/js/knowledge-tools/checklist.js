/* EE Hub — checklist with progress (Round 7, R7E, shared tool). settings: {items: ["text" | {text, note, group, count}], done_text}
   Ticks are remembered in this browser only (localStorage, best effort). An item with count: 22 shows 22 boxes (e.g. weekly signatures). */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function build(mount, S, root) {
    var items = (S.items || []).map(function (x) { return typeof x === "string" ? { text: x } : x; });
    var key = "kt-check-" + (root.getAttribute("data-settings-id") || "") + "-" + items.length, state = store(key) || {};
    var wrap = el("div", "kt-checklist");
    var head = el("div", "kt-row"), lab = el("b", null, ""); head.appendChild(lab);
    var reset = el("button", "kt-btn kt-btn--ghost", "Clear all"); reset.type = "button";
    var bg = el("div", "btn-group"); bg.appendChild(reset); head.appendChild(bg);
    wrap.appendChild(head);
    var bar = el("div", "kt-progress"), fill = el("i"); bar.appendChild(fill);
    bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
    wrap.appendChild(bar);
    var miss = el("p", "kt-note"); miss.setAttribute("aria-live", "polite");
    var ul = el("ul", "kt-check"), boxes = [], group = null;
    items.forEach(function (it, i) {
      if (it.group && it.group !== group) { group = it.group; ul.appendChild(el("h5", null, group)); }
      var n = it.count || 1, li = el("li");
      if (n === 1) {
        var l = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!state[i];
        cb.addEventListener("change", function () { state[i] = cb.checked; store(key, state); paint(); });
        var t = el("span"); t.appendChild(document.createTextNode(it.text)); if (it.note) t.appendChild(el("small", null, it.note));
        l.appendChild(cb); l.appendChild(t); li.appendChild(l);
        boxes.push({ cb: cb, text: it.text });
      } else {
        var fs = el("fieldset", "kt-multi"), lg = el("legend", null, it.text); fs.appendChild(lg);
        if (it.note) fs.appendChild(el("small", null, it.note));
        var row = el("div", "kt-multi__row");
        for (var k = 0; k < n; k++) (function (k) {
          var id = i + "." + k, l2 = el("label", "kt-multi__b"), c2 = el("input"); c2.type = "checkbox"; c2.checked = !!state[id];
          c2.setAttribute("aria-label", it.text + " — " + (it.unit || "week") + " " + (k + 1));
          c2.addEventListener("change", function () { state[id] = c2.checked; store(key, state); paint(); });
          l2.appendChild(c2); l2.appendChild(el("span", null, String(k + 1))); row.appendChild(l2);
          boxes.push({ cb: c2, text: it.text + " (" + (it.unit || "week") + " " + (k + 1) + ")" });
        })(k);
        fs.appendChild(row); li.appendChild(fs);
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul); wrap.appendChild(miss);
    reset.addEventListener("click", function () { state = {}; store(key, state); boxes.forEach(function (b) { b.cb.checked = false; }); paint(); });
    mount.appendChild(wrap);
    function paint() {
      var done = boxes.filter(function (b) { return b.cb.checked; }).length, pct = boxes.length ? Math.round(done / boxes.length * 100) : 0;
      lab.textContent = done + " of " + boxes.length + " done (" + pct + " %)";
      fill.style.width = pct + "%"; bar.setAttribute("aria-valuenow", String(pct)); bar.setAttribute("aria-label", "Progress " + pct + " percent");
      var left = boxes.filter(function (b) { return !b.cb.checked; }).map(function (b) { return b.text; });
      miss.textContent = !left.length ? (S.done_text || "Everything is ticked — well done.") : "Still to do: " + left.slice(0, 6).join("; ") + (left.length > 6 ? " … and " + (left.length - 6) + " more" : "");
    }
    paint();
  }
  KT.define("checklist", build);
})();
