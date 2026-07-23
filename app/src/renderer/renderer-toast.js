/**
 * Toasts (E7) - racine DOM + file d’attente. Chargé avant `renderer.js` ; expose `window.__editifyToast`.
 */
(function () {
  "use strict";

  let toastRoot = null;
  const activeToastsById = new Map();

  function ensureToastRoot() {
    if (toastRoot && document.body.contains(toastRoot)) return toastRoot;
    toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";
    toastRoot.setAttribute("aria-label", "Notifications");
    document.body.appendChild(toastRoot);
    return toastRoot;
  }

  function dismissToast(id) {
    const entry = activeToastsById.get(id);
    if (!entry) return;
    activeToastsById.delete(id);
    try {
      if (entry.timeout) clearTimeout(entry.timeout);
    } catch {
      /* intentional: clearTimeout toast dismiss timer */
    }
    try {
      entry.node?.remove?.();
    } catch {
      /* intentional: remove toast DOM node best-effort */
    }
  }

  function showToast({ message, actionLabel, onAction, timeoutMs = 6500 }) {
    const root = ensureToastRoot();
    const id = `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.toastId = id;

    const msg = document.createElement("div");
    msg.className = "toast-msg";
    msg.textContent = message || "";
    node.appendChild(msg);

    if (actionLabel && typeof onAction === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action";
      btn.textContent = actionLabel;
      btn.onclick = () => {
        try {
          onAction();
        } finally {
          dismissToast(id);
        }
      };
      node.appendChild(btn);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Fermer");
    close.textContent = "✕";
    close.onclick = () => dismissToast(id);
    node.appendChild(close);

    root.appendChild(node);
    const timeout = setTimeout(() => dismissToast(id), Math.max(1200, Number(timeoutMs) || 6500));
    activeToastsById.set(id, { node, timeout });
    return id;
  }

  window.__editifyToast = {
    ensureToastRoot,
    dismissToast,
    showToast
  };
})();
