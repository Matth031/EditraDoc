/**
 * Persistance session (onglets, annotations) via IPC `maniPdfApi.saveSession` / `loadSession`.
 * `window.__editifySession` - `bind()` depuis `renderer.js` juste après `__editifySidebars.bind()`.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} SessionDeps
   * @property {{ tabs: unknown[], activeTabId: unknown, selectedAnnotationId: unknown, editingAnnotationId: unknown }} state
   * @property {(msg: string) => void} setStatus
   * @property {(key: string) => string} t
   * @property {() => void} renderTabs
   * @property {() => void} updateViewer
   * @property {() => void} updateWelcomeVisibility
   * @property {() => void} syncPropertyInputs
   * @property {() => void} scheduleSidebarUpdate
   */

  /** @type {SessionDeps | null} */
  let deps = null;

  let autosaveDebounce = null;

  /** @param {SessionDeps} next */
  function bind(next) {
    deps = next;
  }

  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifySession.bind() doit être appelé depuis renderer.js après __editifySidebars.bind()."
      );
    }
    return deps;
  }

  function cloneForSession(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  async function saveSession() {
    try {
      const d = requireDeps();
      if (window.maniPdfApi?.isE2E?.()) return;
      const tabsPayload = d.state.tabs.map((t) => ({
        id: t.id,
        name: t.name,
        path: t.path,
        currentPage: t.currentPage || 1,
        annotationsByPage: cloneForSession(t.annotationsByPage || {}),
        pageRotationsByPage: cloneForSession(t.pageRotationsByPage || {}),
        pageRotationsUserTouched: cloneForSession(t.pageRotationsUserTouched || {}),
        viewportByPage: cloneForSession(t.viewportByPage || {}),
        undoStack: Array.isArray(t.undoStack) ? cloneForSession(t.undoStack) : [],
        redoStack: Array.isArray(t.redoStack) ? cloneForSession(t.redoStack) : []
      }));
      const saveResult = await window.maniPdfApi.saveSession({
        tabs: tabsPayload,
        activeTabId: d.state.activeTabId
      });
      if (saveResult && !saveResult.ok) {
        const msg =
          saveResult.errorCode === "SESSION_PAYLOAD_TOO_LARGE"
            ? d.t("stSessionSaveTooLarge")
            : saveResult.error || d.t("stSessionSaveFailed");
        d.setStatus(msg);
      }
    } catch (error) {
      try {
        globalThis.__editifyReportError?.("session:save", String(error?.message || error));
      } catch {
        /* intentional: reporting must never throw */
      }
    }
  }

  async function loadSession() {
    try {
      const d = requireDeps();
      if (window.maniPdfApi?.isE2E?.()) return;
      const r = await window.maniPdfApi.loadSession();
      if (!r?.ok || !r.data?.tabs?.length) return;
      const restored = [];
      for (const row of r.data.tabs) {
        if (!row?.path) continue;
        const open = await window.maniPdfApi.openPdf(row.path);
        if (!open.ok) continue;
        restored.push({
          id: row.id || `${Date.now()}-${Math.random()}`,
          name: row.name || "document.pdf",
          path: open.path,
          currentPage: Math.max(1, row.currentPage || 1),
          annotationsByPage:
            row.annotationsByPage && typeof row.annotationsByPage === "object"
              ? row.annotationsByPage
              : {},
          pageRotationsByPage:
            row.pageRotationsByPage && typeof row.pageRotationsByPage === "object"
              ? row.pageRotationsByPage
              : {},
          pageRotationsUserTouched:
            row.pageRotationsUserTouched && typeof row.pageRotationsUserTouched === "object"
              ? row.pageRotationsUserTouched
              : {},
          viewportByPage:
            row.viewportByPage && typeof row.viewportByPage === "object" ? row.viewportByPage : {},
          undoStack: Array.isArray(row.undoStack) ? row.undoStack : [],
          redoStack: Array.isArray(row.redoStack) ? row.redoStack : []
        });
      }
      if (!restored.length) return;
      d.state.tabs = restored;
      d.state.activeTabId = restored.some((t) => t.id === r.data.activeTabId)
        ? r.data.activeTabId
        : restored[0].id;
      d.state.selectedAnnotationId = null;
      d.state.editingAnnotationId = null;
      d.renderTabs();
      d.updateViewer();
      d.updateWelcomeVisibility();
      d.syncPropertyInputs();
      d.scheduleSidebarUpdate();
      if (r.recovered) d.setStatus(d.t("stSessionRecovered"));
    } catch (error) {
      try {
        globalThis.__editifyReportError?.("session:load", String(error?.message || error));
      } catch {
        /* intentional: reporting must never throw */
      }
    }
  }

  function scheduleAutoSave() {
    if (autosaveDebounce) clearTimeout(autosaveDebounce);
    autosaveDebounce = setTimeout(() => {
      autosaveDebounce = null;
      saveSession().catch((error) => {
        try {
          globalThis.__editifyReportError?.("session:autosave", String(error?.message || error));
        } catch {
          /* intentional: reporting must never throw */
        }
      });
    }, 600);
  }

  window.__editifySession = {
    bind,
    scheduleAutoSave,
    saveSession,
    loadSession
  };
})();
