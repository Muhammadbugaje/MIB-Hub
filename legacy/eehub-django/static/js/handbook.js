/* EE Hub public handbook: index motion, custom course pages and the editors' "Manage materials" screen.
   - reveal on scroll (sections, handbook levels), on-page nav highlight, materials filter
   - prerequisites map: wires drawn between the nodes, current flowing along them
   - manage: drag-and-drop uploads with progress, drag/arrow reordering, weekly-plan row editor
   No dependencies; respects reduced motion. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || root.getAttribute("data-motion") === "reduce";
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function csrf() { var i = $("input[name=csrfmiddlewaretoken]"); return i ? i.value : ""; }
  function toast(kind, title) { if (window.EE && EE.Toast) EE.Toast.push(kind, title, ""); }

  /* ---- Reveal on scroll ----------------------------------------------------- */
  var targets = $$("[data-cp-reveal], .hb-level");
  if (targets.length && "IntersectionObserver" in window && !reduce) {
    root.classList.add("hb-js");
    var vh = window.innerHeight;
    targets.forEach(function (el) { if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add("is-in"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); drawMaps(); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (el) { if (!el.classList.contains("is-in")) io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add("is-in"); });
    if (targets.length) root.classList.add("hb-js");
  }

  /* ---- On-page nav ---------------------------------------------------------- */
  var navLinks = $$("[data-cp-nav] a");
  if (navLinks.length && "IntersectionObserver" in window) {
    var cur = null;
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cur = en.target.id;
        navLinks.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + cur;
          a.classList.toggle("is-current", on);
          if (on && a.scrollIntoView && a.parentElement.scrollWidth > a.parentElement.clientWidth) {
            a.parentElement.scrollTo({ left: a.offsetLeft - 20, behavior: reduce ? "auto" : "smooth" });
          }
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    navLinks.forEach(function (a) { var t = doc.getElementById(a.getAttribute("href").slice(1)); if (t) nio.observe(t); });
  }

  /* ---- Materials filter ----------------------------------------------------- */
  $$("[data-materials]").forEach(function (box) {
    var btns = $$("[data-mat-filter]", box);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-mat-filter");
        btns.forEach(function (x) { x.classList.toggle("is-active", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        $$(".hb-res", box).forEach(function (r) { r.classList.toggle("is-filtered", !!k && r.getAttribute("data-kind") !== k); });
      });
    });
  });

  /* ---- Prerequisites map wires ---------------------------------------------- */
  var maps = $$("[data-prereq-map]");
  function drawMaps() {
    maps.forEach(function (map) {
      var svg = $("[data-map-wires]", map), me = $("[data-map-me]", map);
      if (!svg || !me || !map.offsetWidth || getComputedStyle(svg).display === "none") return;
      var box = map.getBoundingClientRect(), m = me.getBoundingClientRect();
      var ns = "http://www.w3.org/2000/svg", out = [];
      function wire(x1, y1, x2, y2) {
        var dx = (x2 - x1) / 2;
        return "M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2;
      }
      $$("[data-map-in]", map).forEach(function (n) {
        var r = n.getBoundingClientRect();
        out.push(wire(r.right - box.left, r.top + r.height / 2 - box.top, m.left - box.left, m.top + m.height / 2 - box.top));
      });
      $$("[data-map-out]", map).forEach(function (n) {
        var r = n.getBoundingClientRect();
        out.push(wire(m.right - box.left, m.top + m.height / 2 - box.top, r.left - box.left, r.top + r.height / 2 - box.top));
      });
      svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
      svg.innerHTML = "";
      out.forEach(function (d, i) {
        [false, true].forEach(function (flow) {
          var p = doc.createElementNS(ns, "path");
          p.setAttribute("d", d);
          if (flow) { p.setAttribute("class", "is-flow"); p.style.animationDelay = (-i * 0.35) + "s"; }
          svg.appendChild(p);
        });
      });
    });
  }
  if (maps.length) {
    drawMaps();
    if ("ResizeObserver" in window) maps.forEach(function (m) { new ResizeObserver(drawMaps).observe(m); });
    else window.addEventListener("resize", drawMaps);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(drawMaps);
  }

  /* ======================================================================
     Manage materials
     ====================================================================== */
  var mg = $("[data-manage]");
  if (!mg) return;
  var maxMb = parseInt(mg.getAttribute("data-max-mb") || "15", 10);
  var exts = (mg.getAttribute("data-exts") || "").split(",").filter(Boolean);

  /* ---- Uploads: drop or choose; one request per file with a progress bar ---- */
  $$("[data-dropzone]").forEach(function (form) {
    var input = $("input[type=file]", form), queue = $("[data-queue]", form);
    var isSlot = form.hasAttribute("data-slot");
    form.classList.add("hb-js-on");
    root.classList.add("hb-js");
    function row(name) {
      var li = doc.createElement("li");
      li.className = "hb-q";
      li.innerHTML = "<b></b><span>Waiting…</span><span class=\"hb-q__bar\"><i></i></span>";
      $("b", li).textContent = name;
      queue.appendChild(li);
      return li;
    }
    function send(files) {
      files = Array.prototype.slice.call(files || []);
      if (isSlot) files = files.slice(0, 1);
      if (!files.length) return;
      var pending = files.length, okCount = 0;
      files.forEach(function (f) {
        var li = row(f.name), state = $("span", li), bar = $(".hb-q__bar i", li);
        var ext = (f.name.split(".").pop() || "").toLowerCase();
        if (exts.length && exts.indexOf(ext) < 0) { li.classList.add("is-error"); state.textContent = "Type not allowed"; return done(); }
        if (f.size > maxMb * 1048576) { li.classList.add("is-error"); state.textContent = "Larger than " + maxMb + " MB"; return done(); }
        var fd = new FormData();
        $$("input[type=hidden], select", form).forEach(function (el) { fd.append(el.name, el.value); });
        fd.append("files", f, f.name);
        var xhr = new XMLHttpRequest();
        xhr.open("POST", form.action);
        xhr.setRequestHeader("X-Requested-With", "fetch");
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-CSRFToken", csrf());
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          var p = e.loaded / e.total;
          bar.style.setProperty("--p", p.toFixed(3));
          state.textContent = Math.round(p * 100) + "%";
        };
        xhr.onload = function () {
          var data = {};
          try { data = JSON.parse(xhr.responseText); } catch (e) { /* not JSON */ }
          if (xhr.status < 300 && data.ok !== false) { okCount++; li.classList.add("is-done"); bar.style.setProperty("--p", "1"); state.textContent = "Uploaded"; }
          else { li.classList.add("is-error"); state.textContent = (data.errors && data.errors[0]) || "Upload failed"; }
          done();
        };
        xhr.onerror = function () { li.classList.add("is-error"); state.textContent = "Network problem"; done(); };
        xhr.send(fd);
      });
      function done() {
        if (--pending > 0) return;
        if (okCount) {
          toast("success", "Uploaded " + okCount + " file" + (okCount === 1 ? "" : "s"));
          setTimeout(function () { location.reload(); }, 700);
        }
      }
    }
    input.addEventListener("change", function () { send(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (t) {
      form.addEventListener(t, function (e) {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
        e.preventDefault(); form.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach(function (t) {
      form.addEventListener(t, function (e) {
        if (t === "dragleave" && form.contains(e.relatedTarget)) return;
        form.classList.remove("is-over");
      });
    });
    form.addEventListener("drop", function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault(); send(e.dataTransfer.files);
    });
    form.addEventListener("submit", function (e) {
      if (input.files && input.files.length) { e.preventDefault(); send(input.files); }
    });
  });
  // a file dropped anywhere else on the page must not navigate away
  ["dragover", "drop"].forEach(function (t) { doc.addEventListener(t, function (e) { if (!e.target.closest("[data-dropzone]")) e.preventDefault(); }); });

  /* ---- Sortable lists (materials and weekly plan) ---------------------------- */
  function sortable(list, itemSel, onChange) {
    var dragged = null;
    list.addEventListener("dragstart", function (e) {
      var it = e.target.closest(itemSel);
      if (!it || e.target.closest("input, textarea, select, details[open] form")) return;
      dragged = it; it.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", "move"); } catch (x) { /* old browsers */ }
    });
    list.addEventListener("dragover", function (e) {
      if (!dragged) return;
      e.preventDefault();
      var over = e.target.closest(itemSel);
      $$(".is-target", list).forEach(function (x) { x.classList.remove("is-target"); });
      if (over && over !== dragged) over.classList.add("is-target");
    });
    list.addEventListener("drop", function (e) {
      if (!dragged) return;
      e.preventDefault();
      var over = e.target.closest(itemSel);
      if (over && over !== dragged) {
        var after = e.clientY > over.getBoundingClientRect().top + over.offsetHeight / 2;
        list.insertBefore(dragged, after ? over.nextSibling : over);
        onChange(dragged);
      }
    });
    list.addEventListener("dragend", function () {
      if (dragged) dragged.classList.remove("is-dragging");
      $$(".is-target", list).forEach(function (x) { x.classList.remove("is-target"); });
      dragged = null;
    });
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-move]");
      if (!b) return;
      var it = b.closest(itemSel), dir = parseInt(b.getAttribute("data-move"), 10);
      var sib = dir < 0 ? it.previousElementSibling : it.nextElementSibling;
      if (!sib) return;
      list.insertBefore(it, dir < 0 ? sib : sib.nextSibling);
      b.focus();
      onChange(it);
    });
  }

  var mat = $("[data-sortable]");
  if (mat) {
    var saveTimer = 0;
    sortable(mat, ".hb-mg-item", function (it) {
      it.animate && !reduce && it.animate([{ transform: "scale(.98)" }, { transform: "none" }], { duration: 220, easing: "ease-out" });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        var ids = $$(".hb-mg-item", mat).map(function (li) { return li.getAttribute("data-id"); });
        fetch(mg.getAttribute("data-reorder-url"), {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrf(), "X-Requested-With": "fetch", "Accept": "application/json" },
          body: JSON.stringify({ order: ids })
        }).then(function (r) { return r.json(); })
          .then(function (d) { if (d.ok) toast("success", "Order saved"); else toast("error", d.error || "Could not save the order"); })
          .catch(function () { toast("error", "Network problem: the order was not saved"); });
      }, 450);
    });
  }

  /* ---- Weekly plan editor ------------------------------------------------------ */
  var plan = $("[data-plan-editor]");
  if (plan) {
    var rows = $("[data-plan-rows]", plan), tpl = $("[data-plan-template]", plan);
    sortable(rows, ".hb-plan-ed__row", function () { plan.classList.add("is-dirty"); });
    function add() {
      var frag = tpl.content.cloneNode(true), li = frag.querySelector("li");
      var last = rows.lastElementChild, wk = last && ($("[name=t_week_end]", last).value || $("[name=t_week]", last).value);
      if (wk) $("[name=t_week]", li).value = Math.min(30, parseInt(wk, 10) + 1);
      li.classList.add("is-new");
      rows.appendChild(li);
      $("[name=t_title]", li).focus();
    }
    $("[data-plan-add]", plan).addEventListener("click", add);
    rows.addEventListener("click", function (e) {
      var b = e.target.closest("[data-plan-remove]");
      if (!b) return;
      var li = b.closest("li"), title = $("[name=t_title]", li).value.trim();
      function go() { li.remove(); plan.classList.add("is-dirty"); }
      if (!title) { go(); return; }
      if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
        console.error("[Handbook] Confirmation dialog is unavailable; topic was not removed.");
        return;
      }
      window.EEConfirm.open({
        title: "Remove this topic?",
        body: "'" + title + "' leaves the weekly plan when you save.",
        confirmLabel: "Remove",
        tone: "danger"
      }).then(function (ok) { if (ok) go(); })
        .catch(function (error) { console.error("[Handbook] Could not open confirmation dialog", error); });
    });
    plan.addEventListener("input", function () { plan.classList.add("is-dirty"); });
    plan.addEventListener("submit", function () { plan.classList.remove("is-dirty"); });
    window.addEventListener("beforeunload", function (e) { if (plan.classList.contains("is-dirty")) { e.preventDefault(); e.returnValue = ""; } });
    if (!rows.children.length) add();
  }
})();
