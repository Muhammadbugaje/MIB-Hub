/* =========================================================================
   Select and act in bulk (EE Hub, ported from NBTE Phase 8)

   Markup (rendered by the {% bulk_check %}, {% bulk_all %} and
   {% bulk_bar %} tags in core/templatetags/ux_tags.py):
     <form id="bulk-x" class="bulk-bar" data-uxb-bar="bulk-x" ...>  ← the bar
     <input type="checkbox" data-uxb-all="bulk-x">                 ← select all on page
     <input type="checkbox" name="ids" value="7" form="bulk-x" data-uxb-item="bulk-x">
   A row is the checkbox's closest [data-uxb-row] (or <tr>/<li>/<article>).

   Selection mode (round 6, owner: "the checkboxes should not always
   appear"): checkboxes, "Select all", hints and the bar stay hidden until
   the person presses the list's "Select" switch ([data-uxb-toggle], from
   {% bulk_all %}) or long-presses a row on a phone. "Done", Cancel or Esc
   leave selection mode and clear the ticks. While selecting, a tap on a
   row ticks it instead of opening it. Without JS everything is shown.
   Custom tables use [data-select-scope] + [data-select-toggle] and mark
   their selection-only parts with [data-select-only].

   Behaviour: the bar slides up showing "N selected · actions · Cancel";
   destructive verbs ask EEConfirm first; the rows disappear at once
   (optimistic) and come back with a toast if the server says no or the
   network fails. Works without JS as a plain form post (the server
   redirects back with a message). Esc or Cancel clears the selection.
   Everything is delegated, so HTMX-swapped lists keep working.
   ========================================================================= */
(function () {
  "use strict";
  if (window.EEBulk) return;
  document.documentElement.classList.add("bulk-js");

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function items(id) { return $all('input[data-uxb-item="' + id + '"]'); }
  function bar(id) { return document.querySelector('[data-uxb-bar="' + id + '"]'); }
  function rowOf(input) {
    return input.closest("[data-uxb-row]") || input.closest("tr, li, article") || input.parentElement;
  }
  function toast(kind, title, body) {
    if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(kind, title, body || "", { duration: 6000 });
  }

  // ---- selection mode -------------------------------------------------
  var modes = {};
  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function checksOf(id) {
    // Every [data-uxb-check] wrapper (row boxes + "select all") of this list.
    var out = items(id).map(function (i) { return i.closest("[data-uxb-check]"); });
    $all('input[data-uxb-all="' + id + '"]').forEach(function (a) { out.push(a.closest("[data-uxb-check]")); });
    return out.filter(Boolean);
  }
  function toolbarsOf(id) {
    return $all('[data-uxb-ctl="' + id + '"]').map(function (c) {
      return c.closest(".bulk-toolbar") || c.parentElement;
    }).filter(Boolean);
  }
  function applyMode(id, animate) {
    var on = !!modes[id];
    checksOf(id).forEach(function (el) {
      if (on) {
        if (!el.classList.contains("uxb-on")) {
          el.classList.remove("uxb-out");
          el.classList.add("uxb-on");
          if (animate && !reduceMotion()) {
            el.classList.add("uxb-in");
            window.setTimeout(function () { el.classList.remove("uxb-in"); }, 260);
          }
        }
      } else if (el.classList.contains("uxb-on")) {
        if (animate && !reduceMotion()) {
          el.classList.add("uxb-out");
          window.setTimeout(function () {
            if (!modes[id]) el.classList.remove("uxb-on", "uxb-out");
          }, 170);
        } else {
          el.classList.remove("uxb-on");
        }
      }
    });
    items(id).forEach(function (i) {
      var r = rowOf(i);
      if (r) r.classList.toggle("uxb-row-on", on);
    });
    toolbarsOf(id).forEach(function (t) { t.classList.toggle("uxb-on", on); });
    $all('[data-uxb-toggle="' + id + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("is-on", on);
    });
    document.documentElement.classList.toggle("uxb-selecting", Object.keys(modes).some(function (k) { return modes[k]; }));
  }
  function setMode(id, on, animate) {
    if (!on) {
      items(id).forEach(function (i) { i.checked = false; });
    }
    modes[id] = !!on;
    applyMode(id, animate !== false);
    refresh(id);
    if (on) {
      var all = document.querySelector('input[data-uxb-all="' + id + '"]');
      // Keyboard users land on "Select all"; pointer users keep their place.
      if (all && document.activeElement && document.activeElement.hasAttribute("data-uxb-toggle") &&
          document.activeElement.matches(":focus-visible")) all.focus();
    }
  }
  function usable(i) {
    // Rows hidden by a page filter (search box, tabs) don't count.
    var r = rowOf(i);
    return !i.disabled && !!(r ? r.getClientRects().length : i.getClientRects().length);
  }
  function hasToggle(id) { return !!document.querySelector('[data-uxb-toggle="' + id + '"]'); }

  function refresh(id) {
    var b = bar(id);
    var list = items(id).filter(usable);
    // Hide the "Select" switch when the list has nothing to select.
    $all('[data-uxb-ctl="' + id + '"]').forEach(function (c) { c.hidden = !items(id).length; });
    if (!b) return;
    var checked = list.filter(function (i) { return i.checked; });
    var n = checked.length;
    var noun = n === 1 ? (b.getAttribute("data-uxb-noun") || "item") : (b.getAttribute("data-uxb-nouns") || "items");
    var count = b.querySelector("[data-uxb-count]");
    if (count) count.textContent = n ? n + " " + noun + " selected" : "Tick " + (b.getAttribute("data-uxb-nouns") || "items") + " to act on them";
    b.classList.toggle("is-empty", n === 0);
    $all("button[data-uxb-action]", b).forEach(function (btn) { btn.disabled = n === 0; });
    b.classList.toggle("is-visible", n > 0 || !!modes[id]);
    document.documentElement.classList.toggle("has-bulk-bar", !!document.querySelector(".bulk-bar.is-visible"));
    list.forEach(function (i) {
      var r = rowOf(i);
      if (r) r.classList.toggle("is-bulk-selected", i.checked);
    });
    $all('input[data-uxb-all="' + id + '"]').forEach(function (all) {
      all.checked = n > 0 && n === list.length;
      all.indeterminate = n > 0 && n < list.length;
    });
  }

  function clear(id) {
    if (modes[id] || hasToggle(id)) { setMode(id, false); return; }
    items(id).forEach(function (i) { i.checked = false; });
    refresh(id);
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var tg = t.closest && t.closest("[data-uxb-toggle]");
    if (tg) {
      var tid = tg.getAttribute("data-uxb-toggle");
      setMode(tid, !modes[tid]);
      return;
    }
    // Generic scopes (custom tables).
    var st = t.closest && t.closest("[data-select-toggle]");
    if (st) {
      var scope = st.closest("[data-select-scope]");
      if (scope) setScope(scope, !scope.classList.contains("is-selecting"));
      return;
    }
    // While selecting, a tap on a row ticks it instead of opening it.
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    var row = t.closest && t.closest(".uxb-row-on");
    if (!row || t.closest("input, select, textarea, button, label, [data-uxb-check], [data-uxb-ignore]")) return;
    var input = row.querySelector("input[data-uxb-item]");
    if (!input || input.disabled) return;
    e.preventDefault();
    input.checked = !input.checked;
    refresh(input.getAttribute("data-uxb-item"));
  }, true);

  function setScope(scope, on) {
    scope.classList.toggle("is-selecting", on);
    $all("[data-select-toggle]", scope).forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("is-on", on);
    });
    if (!on) {
      $all("[data-select-only] input[type=checkbox], input[type=checkbox][data-select-only]", scope).forEach(function (c) {
        if (c.checked || c.indeterminate) {
          c.checked = false; c.indeterminate = false;
          c.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  }

  // Long press on a phone enters selection mode and ticks that row.
  var press = null, suppressClick = false;
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") return;
    var row = e.target.closest && e.target.closest("[data-uxb-row]");
    if (!row || e.target.closest("input, select, textarea, button")) return;
    var input = row.querySelector("input[data-uxb-item]");
    if (!input) return;
    var id = input.getAttribute("data-uxb-item");
    if (!hasToggle(id) || modes[id]) return;
    var x = e.clientX, y = e.clientY;
    press = {
      x: x, y: y,
      timer: window.setTimeout(function () {
        press = null;
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 900);
        setMode(id, true);
        input.checked = true;
        refresh(id);
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* ignore */ } }
      }, 480)
    };
  }, { passive: true });
  function cancelPress(e) {
    if (!press) return;
    if (e && e.type === "pointermove" && Math.abs(e.clientX - press.x) < 10 && Math.abs(e.clientY - press.y) < 10) return;
    window.clearTimeout(press.timer);
    press = null;
  }
  document.addEventListener("pointermove", cancelPress, { passive: true });
  document.addEventListener("pointerup", cancelPress, { passive: true });
  document.addEventListener("pointercancel", cancelPress, { passive: true });
  document.addEventListener("scroll", function () { cancelPress(); }, { passive: true, capture: true });
  document.addEventListener("contextmenu", function (e) {
    if (suppressClick || (press && e.target.closest && e.target.closest("[data-uxb-row]"))) e.preventDefault();
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    var id = t.getAttribute("data-uxb-item");
    if (id) { refresh(id); return; }
    id = t.getAttribute("data-uxb-all");
    if (id) {
      items(id).filter(usable).forEach(function (i) { i.checked = t.checked; });
      refresh(id);
    }
  });

  // Shift-click selects a range.
  var lastClicked = {};
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t instanceof HTMLInputElement && t.hasAttribute("data-uxb-item")) {
      var id = t.getAttribute("data-uxb-item");
      var list = items(id);
      var prev = lastClicked[id];
      if (e.shiftKey && prev && prev !== t && list.indexOf(prev) !== -1) {
        var a = list.indexOf(prev), b = list.indexOf(t);
        list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (i) { i.checked = t.checked; });
        refresh(id);
      }
      lastClicked[id] = t;
      return;
    }
    var cancel = t.closest && t.closest("[data-uxb-cancel]");
    if (cancel) {
      var form = cancel.closest("[data-uxb-bar]");
      if (form) clear(form.getAttribute("data-uxb-bar"));
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (document.querySelector(".ee-confirm, .fpv, [role=dialog][aria-modal=true]:not([hidden])")) return;
    var open = document.querySelector(".bulk-bar.is-visible");
    if (open) { clear(open.getAttribute("data-uxb-bar")); return; }
    Object.keys(modes).forEach(function (k) { if (modes[k]) setMode(k, false); });
    $all("[data-select-scope].is-selecting").forEach(function (sc) { setScope(sc, false); });
  });

  function restoreRows(rows) {
    rows.forEach(function (r) { r.classList.remove("is-bulk-removing"); r.style.removeProperty("height"); });
  }

  function run(form, submitter) {
    var id = form.getAttribute("data-uxb-bar");
    var checked = items(id).filter(function (i) { return i.checked; });
    if (!checked.length) return;
    var verb = submitter ? submitter.value : "";
    var label = submitter ? (submitter.getAttribute("data-uxb-label") || verb) : verb;
    var removes = submitter && submitter.getAttribute("data-uxb-removes") === "1";
    var danger = submitter && submitter.getAttribute("data-uxb-tone") === "danger";
    var n = checked.length;
    var noun = n === 1 ? form.getAttribute("data-uxb-noun") : form.getAttribute("data-uxb-nouns");

    var confirmFirst = Promise.resolve(true);
    if (danger) {
      if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
        console.error("[Bulk select] Confirmation dialog is unavailable; action was not performed.");
        return;
      }
      confirmFirst = window.EEConfirm.open({
          title: (form.getAttribute("data-uxb-confirm-title") || (label + " {n} {noun}?"))
            .replace("{n}", n).replace("{noun}", noun),
          body: (form.getAttribute("data-uxb-confirm-body") || "This can't be undone.").replace("{n}", n).replace("{noun}", noun),
          confirmLabel: label + " " + n,
          tone: "danger"
        });
    }

    confirmFirst.then(function (ok) {
      if (!ok) return;
      var byId = {};
      checked.forEach(function (i) { byId[i.value] = rowOf(i); });
      var rows = checked.map(rowOf).filter(Boolean);
      if (removes) {
        rows.forEach(function (r) {
          r.style.height = r.getBoundingClientRect().height + "px";
          void r.offsetHeight;
          r.classList.add("is-bulk-removing");
        });
      }
      form.classList.add("is-busy");
      var data = new FormData(form);
      data.delete("ids");
      checked.forEach(function (i) { data.append("ids", i.value); });
      data.set("action", verb);
      // form.action is shadowed by the <button name="action"> controls.
      fetch(form.getAttribute("action"), {
        method: "POST",
        body: data,
        credentials: "same-origin",
        headers: { "Accept": "application/json", "X-Requested-With": "fetch" }
      })
        .then(function (r) {
          return r.json().catch(function () { return { ok: false, message: "" }; })
            .then(function (j) { j.ok = j.ok && r.ok; return j; });
        })
        .then(function (res) {
          form.classList.remove("is-busy");
          if (!res.ok) {
            restoreRows(rows);
            toast("error", "Nothing was changed", res.message || "The server refused this action. Try again.");
            return;
          }
          var done = (res.done || []).map(String);
          var skipped = res.skipped || [];
          skipped.forEach(function (s) {
            var r = byId[String(s.id)];
            if (r) restoreRows([r]);
          });
          done.forEach(function (d) {
            var r = byId[d];
            var input = r && r.querySelector('input[data-uxb-item="' + id + '"]');
            if (input) input.checked = false;
            if (r && removes) window.setTimeout(function () { r.remove(); refresh(id); maybeEmpty(id); }, 260);
          });
          if (removes && done.length) {
            // Counters on the page that count the rows of this list.
            $all('[data-uxb-total="' + id + '"]').forEach(function (c) {
              var v = parseInt(c.textContent, 10);
              if (!isNaN(v)) c.textContent = String(Math.max(0, v - done.length));
            });
          }
          skipped.forEach(function (s) {
            var r = byId[String(s.id)];
            var input = r && r.querySelector('input[data-uxb-item="' + id + '"]');
            if (input) input.checked = true;
          });
          refresh(id);
          var reasons = skipped.map(function (s) { return s.reason; }).filter(Boolean);
          toast(done.length ? "success" : "warn", res.message || (label + " done"),
                reasons.length ? Array.from(new Set(reasons)).join(" ") : "");
          if (!removes && done.length) window.setTimeout(function () { window.location.reload(); }, 600);
          document.dispatchEvent(new CustomEvent("ee:bulk-done", { detail: { form: id, action: verb, result: res } }));
        }).catch(function () {
          form.classList.remove("is-busy");
          restoreRows(rows);
          toast("error", "Nothing was changed", "We couldn't reach the server. Check your connection and try again.");
        });
    }).catch(function (error) {
      console.error("[Bulk select] Could not open confirmation dialog", error);
      toast("error", "Could not open confirmation", "Reload the page and try again.");
    });
  }

  function maybeEmpty(id) {
    if (items(id).length) return;
    // The page is now empty: reload so pagination and the empty state are right.
    window.setTimeout(function () { window.location.reload(); }, 300);
  }

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-uxb-bar")) return;
    if (!window.fetch || !window.FormData) return; // plain post fallback
    e.preventDefault();
    run(form, e.submitter || form.querySelector("button[name=action]"));
  });

  // Lists swapped by HTMX: recount.
  document.addEventListener("htmx:afterSettle", function () {
    Object.keys(modes).forEach(function (k) { applyMode(k, false); });
    $all("[data-uxb-bar]").forEach(function (b) { refresh(b.getAttribute("data-uxb-bar")); });
  });
  function boot() {
    $all("[data-uxb-ctl]").forEach(function (c) { refresh(c.getAttribute("data-uxb-ctl")); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("pageshow", function () {
    $all("[data-uxb-bar]").forEach(function (b) { refresh(b.getAttribute("data-uxb-bar")); });
  });

  window.EEBulk = { refresh: refresh, clear: clear, select: function (id, on) { setMode(id, on !== false); } };
})();
