/* Prerequisite map (R7C, C6): draws links between course boxes and traces a chosen course's path.
   Phones get the list view instead (CSS). No dependencies. */
(function () {
  "use strict";
  const map = document.querySelector("[data-map]");
  const dataEl = document.getElementById("map-data");
  if (!map || !dataEl) return;
  const g = JSON.parse(dataEl.textContent);
  const svg = map.querySelector("[data-map-lines]");
  const nodes = {};
  map.querySelectorAll(".cv-map__node").forEach((b) => { nodes[b.dataset.id] = b; });
  const byId = {}; g.nodes.forEach((n) => { byId[n.id] = n; });
  const ups = {}, downs = {};
  g.edges.forEach((e) => { (ups[e.to] = ups[e.to] || []).push(e.from); (downs[e.from] = downs[e.from] || []).push(e.to); });
  const panel = document.querySelector("[data-map-panel]");
  const find = document.querySelector("[data-map-find]");
  const linkedOnly = document.querySelector("[data-map-linked]");
  let focus = null;

  function walk(start, adj) {
    const seen = new Set(), stack = [start];
    while (stack.length) { const x = stack.pop(); (adj[x] || []).forEach((y) => { if (!seen.has(y)) { seen.add(y); stack.push(y); } }); }
    return seen;
  }
  function draw() {
    const box = map.getBoundingClientRect();
    svg.setAttribute("width", map.scrollWidth); svg.setAttribute("height", map.scrollHeight);
    const parts = [];
    g.edges.forEach((e) => {
      const a = nodes[e.from], b = nodes[e.to];
      if (!a || !b || a.offsetParent === null || b.offsetParent === null) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const x1 = ra.right - box.left + map.scrollLeft, y1 = ra.top + ra.height / 2 - box.top + map.scrollTop;
      let x2 = rb.left - box.left + map.scrollLeft; const y2 = rb.top + rb.height / 2 - box.top + map.scrollTop;
      let d;
      if (x2 > x1) { const m = (x1 + x2) / 2; d = `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`; }
      else { x2 = rb.right - box.left + map.scrollLeft; d = `M${x1},${y1} C${x1 + 24},${y1} ${x2 + 24},${y2} ${x2},${y2}`; }
      parts.push(`<path data-from="${e.from}" data-to="${e.to}" d="${d}"/>`);
    });
    svg.innerHTML = parts.join("");
    paint();
  }
  function paint() {
    map.classList.toggle("is-focused", !!focus);
    const up = focus ? walk(focus, ups) : new Set(), down = focus ? walk(focus, downs) : new Set();
    Object.entries(nodes).forEach(([id, el]) => {
      const n = +id;
      el.classList.toggle("is-focus", n === focus);
      el.classList.toggle("is-req", up.has(n));
      el.classList.toggle("is-next", down.has(n));
      el.classList.toggle("is-on", n === focus || up.has(n) || down.has(n));
      el.setAttribute("aria-pressed", n === focus ? "true" : "false");
    });
    svg.querySelectorAll("path").forEach((p) => {
      const a = +p.dataset.from, b = +p.dataset.to;
      const on = focus && ((up.has(a) || a === focus) && (up.has(b) || b === focus) || (down.has(b) || b === focus) && (down.has(a) || a === focus));
      p.classList.toggle("is-on", !!on);
    });
    if (!panel) return;
    if (!focus) { panel.hidden = true; return; }
    const n = byId[focus];
    panel.hidden = false;
    panel.querySelector("[data-panel-title]").textContent = n.code + " · " + n.title;
    panel.querySelector("[data-panel-sub]").textContent = `${n.level} Level · ${n.sem === 1 ? "first" : "second"} semester · ${n.units} unit${n.units === 1 ? "" : "s"}`;
    const chips = (ids, label, tone) => ids.size ? `<p>${label}</p><div class="cv-chips">${[...ids].map((i) => `<span class="ee-chip ee-chip--${tone}">${byId[i].code}</span>`).join("")}</div>` : "";
    panel.querySelector("[data-panel-needs]").innerHTML = chips(up, "Pass first (directly or on the way):", "gold") || "<p class='cat-muted'>No prerequisites.</p>";
    panel.querySelector("[data-panel-opens]").innerHTML = chips(down, "Opens the way to:", "green");
    panel.querySelector("[data-panel-open]").href = (map.dataset.courseUrl || "").replace("__CODE__", n.slug);
  }
  function setFocus(id, scroll) {
    focus = focus === id ? null : id;
    paint();
    if (focus && scroll) nodes[focus].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }
  map.addEventListener("click", (e) => {
    const b = e.target.closest(".cv-map__node");
    if (b) setFocus(+b.dataset.id);
  });
  function applyLinked() {
    const on = linkedOnly && linkedOnly.checked;
    map.querySelectorAll("[data-lonely]").forEach((el) => { el.hidden = on; });
    draw();
  }
  if (linkedOnly) linkedOnly.addEventListener("change", applyLinked);
  if (find) {
    find.addEventListener("input", () => {
      const q = find.value.trim().toLowerCase().replace(/\s+/g, "");
      Object.values(nodes).forEach((el) => {
        const hit = q && (el.dataset.code.toLowerCase().replace(/\s+/g, "").includes(q) || el.textContent.toLowerCase().includes(find.value.trim().toLowerCase()));
        el.classList.toggle("is-hit", !!hit);
      });
    });
    find.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const hit = map.querySelector(".cv-map__node.is-hit");
      if (hit) { focus = null; setFocus(+hit.dataset.id, true); }
    });
  }
  const clear = document.querySelector("[data-map-clear]");
  if (clear) clear.addEventListener("click", () => { focus = null; if (find) { find.value = ""; find.dispatchEvent(new Event("input")); } paint(); });
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 120); });
  applyLinked();
  if (find && find.value) {
    const q = find.value.trim().toUpperCase();
    const el = Object.values(nodes).find((x) => x.dataset.code === q);
    if (el) setFocus(+el.dataset.id, true);
  }
})();
