(function () {
  "use strict";

  var nextId = 0;
  var dialogQueue = Promise.resolve();

  function createButton(label, className) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }

  function showDialog(options) {
    return new Promise(function (resolve) {
      var id = ++nextId;
      var tone = options.tone === "danger" ? "danger" : "default";
      var root = document.createElement("div");
      root.className = "ee-confirm";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-labelledby", "ee-confirm-title-" + id);
      root.setAttribute("aria-describedby", "ee-confirm-body-" + id);

      var backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "ee-confirm__backdrop";
      backdrop.setAttribute("aria-label", "Cancel confirmation");

      var panel = document.createElement("div");
      panel.className = "ee-confirm__panel";
      if (tone === "danger") panel.classList.add("ee-confirm__panel--danger");
      panel.setAttribute("role", "document");
      panel.tabIndex = -1;

      var title = document.createElement("h2");
      title.className = "ee-confirm__title";
      title.id = "ee-confirm-title-" + id;
      title.textContent = options.title || "Are you sure?";

      var body = document.createElement("p");
      body.className = "ee-confirm__body";
      body.id = "ee-confirm-body-" + id;
      body.textContent = options.body || "This action may not be reversible.";

      var actions = document.createElement("div");
      actions.className = "ee-confirm__actions";
      var cancelButton = createButton(
        options.cancelLabel || "Cancel",
        "btn btn-ghost"
      );
      var confirmButton = createButton(
        options.confirmLabel || "Confirm",
        tone === "danger" ? "btn btn-danger" : "btn btn-primary"
      );

      actions.append(cancelButton, confirmButton);
      panel.append(title, body, actions);
      root.append(backdrop, panel);

      var previousFocus = document.activeElement;
      var previousOverflow = document.body.style.overflow;
      var closed = false;

      function close(result) {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
        root.remove();
        document.body.style.overflow = previousOverflow;
        if (previousFocus && typeof previousFocus.focus === "function" &&
            previousFocus.isConnected) {
          previousFocus.focus();
        }
        resolve(result);
      }

      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key !== "Tab") return;

        var first = cancelButton;
        var last = confirmButton;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      function onFocusIn(event) {
        if (!root.contains(event.target)) {
          (tone === "danger" ? cancelButton : confirmButton).focus();
        }
      }

      backdrop.addEventListener("click", function () { close(false); });
      cancelButton.addEventListener("click", function () { close(false); });
      confirmButton.addEventListener("click", function () { close(true); });
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("focusin", onFocusIn, true);
      document.body.style.overflow = "hidden";
      document.body.appendChild(root);
      (tone === "danger" ? cancelButton : confirmButton).focus();
    });
  }

  function open(options) {
    if (!options || typeof options !== "object") {
      return Promise.reject(new TypeError("Confirmation options are required."));
    }
    return enqueue(function () { return showDialog(options); });
  }

  function enqueue(show) {
    var result = dialogQueue.then(show);
    dialogQueue = result.then(function () {}, function () {});
    return result;
  }

  function showMessageDialog(options, mode) {
    return new Promise(function (resolve) {
      var id = ++nextId;
      var root = document.createElement("div");
      root.className = "ee-confirm";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-labelledby", "ee-confirm-title-" + id);
      if (options.body) root.setAttribute("aria-describedby", "ee-confirm-body-" + id);

      var backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "ee-confirm__backdrop";
      backdrop.setAttribute("aria-label", mode === "prompt" ? "Cancel prompt" : "Close message");

      var panel = document.createElement("div");
      panel.className = "ee-confirm__panel";
      panel.setAttribute("role", "document");
      panel.tabIndex = -1;

      var title = document.createElement("h2");
      title.className = "ee-confirm__title";
      title.id = "ee-confirm-title-" + id;
      title.textContent = options.title || (mode === "prompt" ? "Enter a value" : "Notice");
      panel.appendChild(title);

      if (options.body) {
        var body = document.createElement("p");
        body.className = "ee-confirm__body";
        body.id = "ee-confirm-body-" + id;
        body.textContent = options.body;
        panel.appendChild(body);
      }

      var input = null;
      if (mode === "prompt") {
        input = document.createElement("input");
        input.className = "ee-confirm__input";
        input.type = options.inputType || "text";
        input.value = options.value || "";
        input.placeholder = options.placeholder || "";
        input.setAttribute("aria-label", options.label || "Value");
        if (options.autocomplete) input.autocomplete = options.autocomplete;
        panel.appendChild(input);
      }

      var actions = document.createElement("div");
      actions.className = "ee-confirm__actions";
      var closeButton = createButton(
        mode === "prompt" ? (options.cancelLabel || "Cancel") : (options.closeLabel || "Close"),
        "btn btn-ghost"
      );
      var submitButton = mode === "prompt" ? createButton(options.confirmLabel || "Continue", "btn btn-primary") : null;
      if (submitButton) actions.append(closeButton, submitButton);
      else actions.appendChild(closeButton);
      panel.appendChild(actions);
      root.append(backdrop, panel);

      var previousFocus = document.activeElement;
      var previousOverflow = document.body.style.overflow;
      var closed = false;
      function close(result) {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
        root.remove();
        document.body.style.overflow = previousOverflow;
        if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) {
          previousFocus.focus();
        }
        resolve(result);
      }
      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          close(mode === "prompt" ? null : undefined);
          return;
        }
        if (event.key === "Enter" && mode === "prompt" && document.activeElement === input) {
          event.preventDefault();
          close(input.value);
          return;
        }
        if (event.key !== "Tab") return;
        var first = closeButton, last = submitButton || closeButton;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      function onFocusIn(event) {
        if (!root.contains(event.target)) (input || closeButton).focus();
      }

      backdrop.addEventListener("click", function () { close(mode === "prompt" ? null : undefined); });
      closeButton.addEventListener("click", function () { close(mode === "prompt" ? null : undefined); });
      if (submitButton) submitButton.addEventListener("click", function () { close(input.value); });
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("focusin", onFocusIn, true);
      document.body.style.overflow = "hidden";
      document.body.appendChild(root);
      (input || closeButton).focus();
    });
  }

  window.EEConfirm = { open: open };
  window.EEPrompt = {
    open: function (options) {
      if (!options || typeof options !== "object") {
        return Promise.reject(new TypeError("Prompt options are required."));
      }
      return enqueue(function () { return showMessageDialog(options, "prompt"); });
    }
  };
  window.EEAlert = {
    open: function (options) {
      if (!options || typeof options !== "object") {
        return Promise.reject(new TypeError("Message options are required."));
      }
      return enqueue(function () { return showMessageDialog(options, "alert"); });
    }
  };

  function initFormConfirmations() {
    var bypass = new WeakSet();
    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-confirm")) {
        return;
      }
      if (bypass.has(form)) {
        bypass.delete(form);
        return;
      }

      event.preventDefault();
      if (form.dataset.confirmPending === "true") return;
      form.dataset.confirmPending = "true";
      var submitter = event.submitter;

      open({
        title: form.dataset.confirmTitle,
        body: form.dataset.confirmBody || form.dataset.confirm,
        confirmLabel: form.dataset.confirmLabel ||
          form.dataset.confirmAction || "Confirm",
        cancelLabel: form.dataset.confirmCancel,
        tone: form.dataset.confirmTone ||
          (form.dataset.confirmVariant === "neutral" ? "default" : "danger")
      }).then(function (confirmed) {
        if (!confirmed || !form.isConnected) return;
        if (typeof form.requestSubmit === "function") {
          bypass.add(form);
          window.setTimeout(function () { bypass.delete(form); }, 0);
          if (submitter && submitter.form === form) form.requestSubmit(submitter);
          else form.requestSubmit();
        } else if (!form.reportValidity || form.reportValidity()) {
          form.submit();
        }
      }).catch(function (error) {
        console.error("[EE] Could not open confirmation dialog", error);
      }).finally(function () {
        delete form.dataset.confirmPending;
      });
    }, true);
  }

  initFormConfirmations();
})();
