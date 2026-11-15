/* People and office picker (NBTE messaging picker, generalised).
 *
 * Markup: templates/memos/_picker.html — a .msg-picker with [data-wf-picker]
 * and data-name="<form field>". Ticked options become hidden inputs with that
 * name, in the order they were picked ([data-ordered] numbers the chips, for
 * the Through route). [data-single] allows one choice only.
 */
(function () {
  "use strict";

  function initPicker(root) {
    if (root.__wfPicker) return;
    root.__wfPicker = true;
    var name = root.getAttribute("data-name");
    var ordered = root.hasAttribute("data-ordered");
    var single = root.hasAttribute("data-single");
    var chipsBox = root.querySelector("[data-chips]");
    var search = root.querySelector("[data-search]");
    var panel = root.querySelector("[data-panel]");
    var list = root.querySelector("[data-list]");
    var hiddenBox = root.querySelector("[data-hidden-inputs]");
    var countLabel = root.querySelector("[data-count-label]");
    var clearBtn = root.querySelector("[data-clear]");
    var toggle = root.querySelector("[data-picker-toggle]");
    var control = root.querySelector("[data-picker-control]");
    var info = {};
    var order = [];

    list.querySelectorAll(".msg-picker-item").forEach(function (li) {
      var cb = li.querySelector(".msg-picker-checkbox");
      if (!cb) return;
      var nameEl = li.querySelector(".msg-user-info strong");
      var av = li.querySelector(".msg-avatar");
      info[cb.value] = {
        name: nameEl ? nameEl.textContent.trim() : cb.value,
        initials: (av && av.textContent.trim().slice(0, 2)) ||
          (nameEl ? nameEl.textContent.trim().split(/\s+/).filter(function (w) { return /^[A-Z]/.test(w); }).slice(0, 2).map(function (w) { return w[0]; }).join("") : "?"),
        office: cb.value.indexOf("o:") === 0
      };
    });
    hiddenBox.querySelectorAll("input").forEach(function (inp) {
      if (order.indexOf(inp.value) === -1 && info[inp.value]) order.push(inp.value);
    });
    list.querySelectorAll(".msg-picker-checkbox").forEach(function (cb) {
      if (cb.checked && order.indexOf(cb.value) === -1) order.push(cb.value);
    });

    function open() { panel.hidden = false; root.classList.add("is-open"); }
    function close() { panel.hidden = true; root.classList.remove("is-open"); }

    function render() {
      chipsBox.querySelectorAll(".msg-chip").forEach(function (el) { el.remove(); });
      hiddenBox.innerHTML = "";
      order.forEach(function (value, i) {
        var d = info[value] || { name: value, initials: "?" };
        var chip = document.createElement("span");
        chip.className = "msg-chip " + (d.office ? "wf-chip-office" : "msg-chip-c" + (i % 8));
        chip.setAttribute("data-value", value);
        var av = document.createElement("span");
        av.className = "msg-chip-avatar";
        av.textContent = ordered ? String(i + 1) : d.initials;
        var nm = document.createElement("span");
        nm.className = "msg-chip-name";
        nm.textContent = d.name;
        var x = document.createElement("button");
        x.type = "button";
        x.className = "msg-chip-x";
        x.setAttribute("aria-label", "Remove " + d.name);
        x.textContent = "×";
        x.addEventListener("click", function (e) {
          e.stopPropagation();
          setChecked(value, false);
        });
        chip.appendChild(av); chip.appendChild(nm); chip.appendChild(x);
        chipsBox.insertBefore(chip, search);
        var inp = document.createElement("input");
        inp.type = "hidden"; inp.name = name; inp.value = value;
        hiddenBox.appendChild(inp);
      });
      if (countLabel) countLabel.textContent = order.length + " selected";
      search.placeholder = order.length ? "" : (search.getAttribute("data-ph") || search.placeholder);
      root.dispatchEvent(new CustomEvent("wf-picker:change", { bubbles: true, detail: { values: order.slice() } }));
    }

    function setChecked(value, on) {
      var cb = list.querySelector('.msg-picker-checkbox[value="' + CSS.escape(value) + '"]');
      if (single && on) {
        order.slice().forEach(function (v) {
          var other = list.querySelector('.msg-picker-checkbox[value="' + CSS.escape(v) + '"]');
          if (other) other.checked = false;
        });
        order = [];
      }
      if (cb) cb.checked = on;
      var i = order.indexOf(value);
      if (on && i === -1) order.push(value);
      if (!on && i !== -1) order.splice(i, 1);
      render();
      if (single && on) close();
    }

    search.setAttribute("data-ph", search.placeholder);
    list.addEventListener("change", function (e) {
      var cb = e.target.closest(".msg-picker-checkbox");
      if (cb) setChecked(cb.value, cb.checked);
    });
    search.addEventListener("focus", open);
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      open();
      list.querySelectorAll(".msg-picker-item").forEach(function (li) {
        li.hidden = q && (li.getAttribute("data-search-text") || "").indexOf(q) === -1;
      });
    });
    search.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !search.value && order.length) {
        setChecked(order[order.length - 1], false);
      } else if (e.key === "Escape") {
        close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        var first = Array.prototype.find.call(list.querySelectorAll(".msg-picker-item"), function (li) { return !li.hidden; });
        if (first) {
          var cb = first.querySelector(".msg-picker-checkbox");
          setChecked(cb.value, !cb.checked);
          search.value = "";
          search.dispatchEvent(new Event("input"));
        }
      }
    });
    if (toggle) toggle.addEventListener("click", function () { if (panel.hidden) { open(); search.focus(); } else close(); });
    if (control) control.addEventListener("click", function (e) { if (e.target === control || e.target === chipsBox) search.focus(); });
    if (clearBtn) clearBtn.addEventListener("click", function () {
      order.slice().forEach(function (v) { setChecked(v, false); });
    });
    document.addEventListener("click", function (e) { if (!root.contains(e.target)) close(); });
    render();
  }

  function initAll(scope) {
    (scope || document).querySelectorAll("[data-wf-picker]").forEach(initPicker);
  }
  window.WFPicker = { init: initAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { initAll(); });
  else initAll();
})();
