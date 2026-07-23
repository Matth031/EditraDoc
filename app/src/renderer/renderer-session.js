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
  /** Échecs autosave consécutifs (signal UI seulement à partir de 3). */
  let autosaveFailStreak = 0;

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
      /* intentional: clone session fallback to original object */
      return obj;
    }
  }

  function getApi() {
    // Seam E2E : objet de remplacement (contextBridge fige maniPdfApi).
    return globalThis.__editifySessionApiOverride || window.maniPdfApi;
  }

  /**
   * @param {{ quietStatus?: boolean, source?: string }} [opts]
   *   quietStatus: autosave — pas de setStatus à chaque échec générique (sauf plafond 50 Mo).
   * @returns {Promise<{ ok: boolean, error?: string, errorCode?: string } | void>}
   */
  async function saveSession(opts = {}) {
    const quietStatus = opts.quietStatus === true;
    const source = opts.source || "save";
    try {
      const d = requireDeps();
      const api = getApi();
      if (api?.isE2E?.()) return { ok: true };
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
      const saveResult = await api.saveSession({
        tabs: tabsPayload,
        activeTabId: d.state.activeTabId
      });
      if (saveResult && !saveResult.ok) {
        // Plafond 50 Mo (E-AUDIT-02.5) : géré côté main via prepareSessionSavePayload —
        // on affiche le message i18n, on ne recalcule pas la taille ici.
        const tooLarge = saveResult.errorCode === "SESSION_PAYLOAD_TOO_LARGE";
        const msg = tooLarge
          ? d.t("stSessionSaveTooLarge")
          : saveResult.error || d.t("stSessionSaveFailed");
        try {
          globalThis.__editifyReportWarn?.(`session:${source}`, msg, {
            errorCode: saveResult.errorCode || undefined
          });
        } catch {
          /* intentional: reporting must never throw */
        }
        if (tooLarge || !quietStatus) {
          d.setStatus(msg);
          autosaveFailStreak = 0;
        } else {
          autosaveFailStreak += 1;
          if (autosaveFailStreak >= 3) {
            d.setStatus(d.t("stSessionSaveFailed"));
            autosaveFailStreak = 0;
          }
        }
        return saveResult;
      }
      autosaveFailStreak = 0;
      return saveResult || { ok: true };
    } catch (error) {
      // Propager pour les .catch appelants (IPC autosave / debounce) → reportCaughtError.
      throw error instanceof Error ? error : new Error(String(error ?? "session save failed"));
    }
  }

  async function loadSession() {
    try {
      const d = requireDeps();
      const api = getApi();
      if (api?.isE2E?.()) return;
      const r = await api.loadSession();
      if (r && r.ok === false) {
        const msg = r.error || d.t("stSessionLoadFailed");
        try {
          globalThis.__editifyReportError?.("session:load", msg);
        } catch {
          /* intentional: reporting must never throw */
        }
        d.setStatus(d.t("stSessionLoadFailed"));
        return;
      }
      if (!r?.ok || !r.data?.tabs?.length) return;
      const restored = [];
      for (const row of r.data.tabs) {
        if (!row?.path) continue;
        const open = await api.openPdf(row.path);
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
      throw error instanceof Error ? error : new Error(String(error ?? "session load failed"));
    }
  }

  function scheduleAutoSave() {
    if (autosaveDebounce) clearTimeout(autosaveDebounce);
    autosaveDebounce = setTimeout(() => {
      autosaveDebounce = null;
      saveSession({ quietStatus: true, source: "autosave" }).catch((error) => {
        try {
          globalThis.__editifyReportError?.("session:autosave", String(error?.message || error));
        } catch {
          /* intentional: reporting must never throw */
        }
        autosaveFailStreak += 1;
        if (autosaveFailStreak >= 3) {
          try {
            requireDeps().setStatus(requireDeps().t("stSessionSaveFailed"));
          } catch {
            /* intentional: status after autosave streak best-effort */
          }
          autosaveFailStreak = 0;
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
