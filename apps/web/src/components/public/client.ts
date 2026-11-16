/**
 * Small browser behaviours for the public pages. Every page works without
 * them (filters are links, forms post normally); this only makes things
 * instant. Loaded with:
 *
 *   <script>import "../../components/public/client.ts";</script>
 *
 *   [data-filter-root]   chips ([data-filter-chip="value"]) + a search box ([data-filter-q])
 *                        filter [data-filter-item] (data-cat, data-text); groups
 *                        ([data-filter-group]) hide when empty; [data-filter-empty] shows when nothing matches.
 *   [data-like]          POST /api/likes, then shows the new count.
 *   [data-copy]          copies its value to the clipboard.
 *   form[data-json-form] posts as JSON and shows the API's error inline, else goes to data-thanks?ref=…
 *   .pp-pill input       marks the chosen pill (for browsers without :has()).
 */

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ---- Filters ----------------------------------------------------------------- */
for (const root of $$<HTMLElement>("[data-filter-root]")) {
  const chips = $$<HTMLAnchorElement>("[data-filter-chip]", root);
  const input = root.querySelector<HTMLInputElement>("[data-filter-q]");
  const items = $$<HTMLElement>("[data-filter-item]", root);
  const groups = $$<HTMLElement>("[data-filter-group]", root);
  const empty = root.querySelector<HTMLElement>("[data-filter-empty]");
  const count = root.querySelector<HTMLElement>("[data-filter-count]");
  const param = root.getAttribute("data-filter-param") ?? "cat";
  let cat = chips.find((c) => c.getAttribute("aria-current") === "true")?.getAttribute("data-filter-chip") ?? "";

  const apply = () => {
    const terms = norm(input?.value ?? "").split(" ").filter(Boolean);
    let shown = 0;
    for (const it of items) {
      const okCat = !cat || (it.getAttribute("data-cat") ?? "").split(" ").includes(cat);
      const text = norm(it.getAttribute("data-text") ?? it.textContent ?? "");
      const okText = terms.every((t) => text.includes(t));
      it.hidden = !(okCat && okText);
      if (!it.hidden) shown++;
    }
    for (const g of groups) g.hidden = !$$<HTMLElement>("[data-filter-item]", g).some((it) => !it.hidden);
    if (empty) empty.hidden = shown > 0;
    if (count) count.textContent = String(shown);
    const url = new URL(location.href);
    if (cat) url.searchParams.set(param, cat);
    else url.searchParams.delete(param);
    if (input?.value.trim()) url.searchParams.set("q", input.value.trim());
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  };

  for (const chip of chips) {
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      cat = chip.getAttribute("data-filter-chip") ?? "";
      for (const c of chips) c.setAttribute("aria-current", String(c === chip));
      apply();
    });
  }
  if (input) {
    input.addEventListener("input", apply);
    input.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      apply();
    });
  }
}

/* ---- Likes -------------------------------------------------------------------- */
for (const btn of $$<HTMLButtonElement>("[data-like]")) {
  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameSlug: btn.getAttribute("data-like"), level: btn.getAttribute("data-level") ?? "" }),
      });
      const data = (await res.json()) as { ok?: boolean; liked?: boolean; total?: number; error?: string };
      if (data.ok) {
        btn.setAttribute("aria-pressed", String(Boolean(data.liked)));
        const n = btn.querySelector("[data-like-count]");
        if (n) n.textContent = (data.total ?? 0).toLocaleString("en-NG");
        btn.classList.remove("is-pop");
        void btn.offsetWidth;
        btn.classList.add("is-pop");
      } else if (data.error) {
        btn.title = data.error;
      }
    } catch {
      btn.title = "Could not reach the server. Try again.";
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---- Copy ---------------------------------------------------------------------- */
for (const btn of $$<HTMLButtonElement>("[data-copy]")) {
  btn.addEventListener("click", async () => {
    const value = btn.getAttribute("data-copy") === "url" ? location.href : (btn.getAttribute("data-copy") ?? "");
    try {
      await navigator.clipboard.writeText(value);
      const label = btn.querySelector("[data-copy-label]");
      const before = label?.textContent;
      btn.classList.add("is-done");
      if (label) label.textContent = "Copied";
      setTimeout(() => {
        btn.classList.remove("is-done");
        if (label && before) label.textContent = before;
      }, 1800);
    } catch {
      /* clipboard blocked: the value is still on screen to select */
    }
  });
}

/* ---- Pills ----------------------------------------------------------------------- */
const syncPills = () => {
  for (const pill of $$<HTMLElement>(".pp-pill")) pill.classList.toggle("is-on", Boolean(pill.querySelector<HTMLInputElement>("input")?.checked));
};
document.addEventListener("change", (e) => {
  if ((e.target as HTMLElement).closest?.(".pp-pill")) syncPills();
});
syncPills();

/* ---- JSON forms -------------------------------------------------------------------- */
for (const form of $$<HTMLFormElement>("form[data-json-form]")) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = form.querySelector<HTMLElement>("[data-form-error]");
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (err) err.hidden = true;
    if (submit) submit.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(form.action, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { ok?: boolean; ref?: string; error?: string };
      if (data.ok) {
        const to = form.getAttribute("data-thanks") ?? "/";
        location.href = data.ref ? `${to}?ref=${encodeURIComponent(data.ref)}` : to;
        return;
      }
      if (err) {
        err.textContent = data.error ?? "Something went wrong. Please try again.";
        err.hidden = false;
      }
    } catch {
      if (err) {
        err.textContent = "Could not reach the server. Check your connection and try again.";
        err.hidden = false;
      }
    }
    if (submit) submit.disabled = false;
  });
}
