/* Course form routing (R7C): reorder, remove and add steps; keeps hidden step1..3 inputs in order. */
(function () {
  const form = document.querySelector("[data-route-form]");
  if (!form) return;
  const flow = form.querySelector("[data-route-flow]");
  const addRow = form.querySelector("[data-add-row]");
  const MAX = 3;
  const SUB = {"hod": "Approves, signs and stamps", "registration-officer": "Checks courses, carry-overs and overrides",
               "exam-officer": "Checks carry-overs and results on record", "level-coordinator": "Checks the forms of their own level"};

  function steps() { return Array.from(flow.querySelectorAll("li[data-step]")); }
  function renumber() {
    const list = steps();
    list.forEach((li, i) => {
      li.querySelector(".rg-route__n").textContent = String(i + 1);
      const inp = li.querySelector("input[type=hidden]");
      inp.name = "step" + (i + 1);
      const sub = li.querySelector("small");
      if (li.dataset.step === "hod" && sub) sub.textContent = i === list.length - 1 ? SUB.hod : "Approves";
      li.querySelector("[data-move='-1']").disabled = i === 0;
      li.querySelector("[data-move='1']").disabled = i === list.length - 1;
      li.querySelector("[data-remove]").disabled = list.length === 1;
    });
    const keys = list.map((li) => li.dataset.step);
    addRow.querySelectorAll("[data-add]").forEach((b) => {
      b.hidden = keys.includes(b.dataset.add);
      b.disabled = keys.length >= MAX;
    });
  }
  flow.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const li = btn.closest("li[data-step]");
    if (btn.hasAttribute("data-remove")) { li.remove(); }
    else if (btn.dataset.move === "-1" && li.previousElementSibling && li.previousElementSibling.dataset.step) {
      flow.insertBefore(li, li.previousElementSibling);
    } else if (btn.dataset.move === "1" && li.nextElementSibling) {
      flow.insertBefore(li.nextElementSibling, li);
    }
    renumber();
  });
  addRow.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b || steps().length >= MAX) return;
    const tpl = steps()[0];
    const li = tpl.cloneNode(true);
    li.dataset.step = b.dataset.add;
    li.classList.toggle("is-hod", b.dataset.add === "hod");
    li.querySelector("b").textContent = b.dataset.label;
    li.querySelector("small").textContent = SUB[b.dataset.add] || "";
    const meta = li.querySelector(".rg-route__meta");
    if (meta) meta.textContent = "Saved with the route";
    li.querySelector("input[type=hidden]").value = b.dataset.add;
    flow.appendChild(li);
    renumber();
  });
  renumber();
})();
