/**
 * Historique annotations : snapshots undo/redo + finishUndoRedoUi (TKT-BUG-UNDO-EDIT-001).
 * `bind()` depuis renderer.js après syncPropertyInputs / renderAnnotations / session / pdfv.
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-annotation-history.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  function getTabSnapshotState(tab) {
    return {
      annotationsByPage: tab.annotationsByPage,
      pageRotationsByPage: tab.pageRotationsByPage || {},
      pageRotationsUserTouched: tab.pageRotationsUserTouched || {}
    };
  }

  function normalizePageRotationDeg(deg) {
    const n = Number(deg) || 0;
    return ((Math.round(n) % 360) + 360) % 360;
  }

  function captureSnapshot(tab) {
    const snapshot = JSON.stringify(getTabSnapshotState(tab));
    tab.undoStack.push(snapshot);
    if (tab.undoStack.length > 50) tab.undoStack.shift();
    tab.redoStack = [];
    // E7-S2: toute mutation des annotations rend l'onglet "dirty".
    tab.dirty = true;
  }

  function applySnapshot(tab, snapshot) {
    const parsed = JSON.parse(snapshot);
    const prevRot = { ...(tab.pageRotationsByPage || {}) };
    tab.annotationsByPage = parsed.annotationsByPage || {};
    tab.pageRotationsByPage =
      parsed.pageRotationsByPage && typeof parsed.pageRotationsByPage === "object"
        ? parsed.pageRotationsByPage
        : {};
    tab.pageRotationsUserTouched =
      parsed.pageRotationsUserTouched && typeof parsed.pageRotationsUserTouched === "object"
        ? parsed.pageRotationsUserTouched
        : {};
    const changedPages = new Set();
    const allKeys = new Set([...Object.keys(prevRot), ...Object.keys(tab.pageRotationsByPage)]);
    for (const k of allKeys) {
      if (
        normalizePageRotationDeg(prevRot[k] || 0) !==
        normalizePageRotationDeg(tab.pageRotationsByPage[k] || 0)
      ) {
        changedPages.add(Number(k) || 1);
      }
    }
    return changedPages;
  }

  function finishUndoRedoUi() {
    const d = requireDeps();
    const state =
      /** @type {{ selectedAnnotationId: string | null, editingAnnotationId: string | null }} */ (
        d.state
      );
    state.selectedAnnotationId = null;
    // Ne pas syncTextFromEditor ici : applySnapshot a déjà restauré le modèle ;
    // vider editingAnnotationId sort proprement du mode édition (TKT-BUG-UNDO-EDIT-001).
    state.editingAnnotationId = null;
    try {
      document.activeElement?.blur?.();
    } catch {
      /* ignore */
    }
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const renderAnnotations = /** @type {() => void} */ (d.renderAnnotations);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    syncPropertyInputs();
    renderAnnotations();
    session.scheduleAutoSave();
  }

  function undo() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const pdfv = /** @type {{ rerenderPages: (pages: number[]) => Promise<unknown> }} */ (d.pdfv);
    const tab = getActiveTab();
    if (!tab || !tab.undoStack || tab.undoStack.length === 0) return;
    const current = JSON.stringify(getTabSnapshotState(tab));
    tab.redoStack.push(current);
    const snapshot = tab.undoStack.pop();
    const changedPages = applySnapshot(tab, snapshot);
    const after = () => finishUndoRedoUi(tab);
    if (changedPages.size) {
      pdfv
        .rerenderPages([...changedPages])
        .then(after)
        .catch(after);
    } else {
      after();
    }
  }

  function redo() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const pdfv = /** @type {{ rerenderPages: (pages: number[]) => Promise<unknown> }} */ (d.pdfv);
    const tab = getActiveTab();
    if (!tab || !tab.redoStack || tab.redoStack.length === 0) return;
    const current = JSON.stringify(getTabSnapshotState(tab));
    tab.undoStack.push(current);
    const snapshot = tab.redoStack.pop();
    const changedPages = applySnapshot(tab, snapshot);
    const after = () => finishUndoRedoUi(tab);
    if (changedPages.size) {
      pdfv
        .rerenderPages([...changedPages])
        .then(after)
        .catch(after);
    } else {
      after();
    }
  }

  window.__editifyAnnotationHistory = {
    bind,
    captureSnapshot,
    applySnapshot,
    finishUndoRedoUi,
    undo,
    redo,
    getTabSnapshotState,
    /** Marqueur module pour tests E2E (TKT-BUG-UNDO-EDIT-001). */
    moduleId: "renderer-annotation-history"
  };
})();
