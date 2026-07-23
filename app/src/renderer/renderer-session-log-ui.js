/**
 * Modal « Journal de session », raccourcis clavier / menu barre d’outils, purge `beforeunload`.
 * `window.__editifySessionLogUi` - `bind()` depuis `renderer.js` une fois `t` / `sessionLog` / `chrome` disponibles.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} SessionLogUiDeps
   * @property {HTMLElement | null} sessionLogModal
   * @property {HTMLElement | null} sessionLogBody
   * @property {HTMLElement | null} sessionLogCloseBtn
   * @property {{ getEntries: () => { ts: string, category: string, message: string }[], clear: () => void }} sessionLog
   * @property {(key: string) => string} t
   * @property {{ closeAllFlyoutMenus: () => void }} chrome
   * @property {HTMLElement | null} [toolbarSessionLogMenuItem]
   */

  /** @type {SessionLogUiDeps | null} */
  let deps = null;

  function open() {
    if (!deps) return;
    const { sessionLogModal, sessionLogBody, sessionLog, t, sessionLogCloseBtn } = deps;
    if (!sessionLogModal || !sessionLogBody) return;
    sessionLogBody.innerHTML = "";
    const rows = sessionLog.getEntries();
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "session-log-empty";
      p.textContent = t("sessionLogEmpty");
      sessionLogBody.appendChild(p);
    } else {
      for (const row of rows) {
        const line = document.createElement("div");
        line.className = "session-log-line";
        const time = document.createElement("span");
        time.className = "session-log-ts";
        time.textContent = row.ts;
        const msg = document.createElement("span");
        msg.className = "session-log-msg";
        msg.textContent = `[${row.category}] ${row.message}`;
        line.appendChild(time);
        line.appendChild(msg);
        sessionLogBody.appendChild(line);
      }
    }
    sessionLogModal.classList.remove("hidden");
    sessionLogModal.setAttribute("aria-hidden", "false");
    try {
      sessionLogCloseBtn?.focus?.();
    } catch {
      /* intentional: focus close btn after open session log */
    }
  }

  function close() {
    if (!deps?.sessionLogModal) return;
    deps.sessionLogModal.classList.add("hidden");
    deps.sessionLogModal.setAttribute("aria-hidden", "true");
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onDocumentKeydown(e) {
    if (e.key !== "Escape") return;
    if (!deps?.sessionLogModal || deps.sessionLogModal.classList.contains("hidden")) return;
    close();
  }

  function onBeforeUnload() {
    try {
      deps?.sessionLog?.clear?.();
    } catch {
      /* intentional: clear session log on unload best-effort */
    }
  }

  /**
   * @param {SessionLogUiDeps} next
   */
  function bind(next) {
    deps = next;
    next.toolbarSessionLogMenuItem?.addEventListener?.("click", () => {
      next.chrome.closeAllFlyoutMenus();
      open();
    });
    next.sessionLogCloseBtn?.addEventListener?.("click", () => {
      close();
    });
    next.sessionLogModal
      ?.querySelector?.("[data-session-log-dismiss]")
      ?.addEventListener?.("click", () => {
        close();
      });
    document.addEventListener("keydown", onDocumentKeydown);
    window.addEventListener("beforeunload", onBeforeUnload);
  }

  window.__editifySessionLogUi = {
    bind,
    open,
    close
  };
})();
