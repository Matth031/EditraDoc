/**
 * Onglets PDF : rendu barre, fermeture, undo toast (S6 via pdf:open), ouverture.
 * `hasUnsavedRiskForTab` reste dans renderer.js (couplage session dirty / édition).
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  /** @type {{ tab: object, index: number, wasActive: boolean, prevActiveTabId: string | null, toastId: string | null } | null} */
  let pendingTabUndo = null;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-tabs.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  /** Message utilisateur pour un échec IPC `pdf:open` (codes stables côté main). */
  function resolvePdfOpenErrorMessage(result) {
    const d = requireDeps();
    const t = /** @type {(k: string) => string} */ (d.t);
    if (result?.errorCode === "VALIDATION_SERVICE_UNAVAILABLE") {
      return t("stValidationServiceUnavailable");
    }
    return result?.error || "Impossible d'ouvrir le PDF.";
  }

  /** Décrémente la whitelist main (fermeture onglet). */
  async function unregisterOpenPdfPathOnMain(filePath) {
    try {
      if (!window.maniPdfApi?.unregisterOpenPdfPath || !filePath) return;
      await window.maniPdfApi.unregisterOpenPdfPath(filePath);
    } catch (error) {
      globalThis.__editifyReportWarn?.("tabs:unregisterOpenPdfPath", String(error?.message || error));
    }
  }

  function renderTabs() {
    const d = requireDeps();
    const state = /** @type {{ tabs: object[], activeTabId: string | null }} */ (d.state);
    const tabsEl = /** @type {HTMLElement | null} */ (d.tabs);
    const pdfv = /** @type {{ updateViewer: () => void }} */ (d.pdfv);
    if (!tabsEl) return;

    tabsEl.innerHTML = "";
    state.tabs.forEach((tab) => {
      const node = document.createElement("button");
      node.className = `tab ${tab.id === state.activeTabId ? "active" : ""}`;
      const label = document.createElement("span");
      label.textContent = tab.name;
      node.appendChild(label);

      const closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "✕";
      closeBtn.title = "Retirer ce PDF";
      closeBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeTab(tab.id);
      };
      node.appendChild(closeBtn);
      node.onclick = () => {
        state.activeTabId = tab.id;
        pdfv.updateViewer();
        renderTabs();
      };
      tabsEl.appendChild(node);
    });
  }

  function removeTab(tabId) {
    const d = requireDeps();
    const state =
      /** @type {{ tabs: object[], activeTabId: string | null, selectedAnnotationId: string | null, editingAnnotationId: string | null }} */ (
        d.state
      );
    const pdfv = /** @type {{ updateViewer: () => void }} */ (d.pdfv);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    const updateWelcomeVisibility = /** @type {() => void} */ (d.updateWelcomeVisibility);
    const hasUnsavedRiskForTab = /** @type {(tab: object | null) => boolean} */ (
      d.hasUnsavedRiskForTab
    );
    const showToast = /** @type {(opts: object) => string} */ (d.showToast);
    const dismissToast = /** @type {(id: string) => void} */ (d.dismissToast);
    const clamp = /** @type {(v: number, min: number, max: number) => number} */ (d.clamp);
    const setStatus = /** @type {(msg: string) => void} */ (d.setStatus);

    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const removed = state.tabs[idx];

    if (hasUnsavedRiskForTab(removed)) {
      const ok = window.confirm("Ce PDF a des modifications non sauvegardées. Le retirer ?");
      if (!ok) return;
    }

    if (pendingTabUndo?.toastId) dismissToast(pendingTabUndo.toastId);
    pendingTabUndo = null;

    const wasActive = state.activeTabId === tabId;
    const prevActiveTabId = state.activeTabId;
    state.tabs.splice(idx, 1);

    if (state.activeTabId === tabId) {
      state.activeTabId = state.tabs[0]?.id || null;
      state.selectedAnnotationId = null;
      state.editingAnnotationId = null;
    }

    renderTabs();
    pdfv.updateViewer();
    updateWelcomeVisibility();
    session.scheduleAutoSave();
    unregisterOpenPdfPathOnMain(removed.path).catch(() => {});

    pendingTabUndo = {
      tab: removed,
      index: idx,
      wasActive,
      prevActiveTabId,
      toastId: null
    };
    const toastId = showToast({
      message: "PDF retiré",
      actionLabel: "Annuler",
      onAction: () => {
        if (!pendingTabUndo) return;
        const entry = pendingTabUndo;
        pendingTabUndo = null;
        // Re-validation complète via pdf:open (whitelist S6) — jamais register aveugle.
        void (async () => {
          try {
            if (!entry.tab?.path || !window.maniPdfApi?.openPdf) {
              setStatus("Impossible de restaurer le PDF.");
              return;
            }
            const open = await window.maniPdfApi.openPdf(entry.tab.path);
            if (!open?.ok) {
              setStatus(resolvePdfOpenErrorMessage(open));
              return;
            }
          } catch {
            setStatus("Impossible de restaurer le PDF.");
            return;
          }
          const safeIndex = clamp(entry.index, 0, state.tabs.length);
          state.tabs.splice(safeIndex, 0, entry.tab);
          if (entry.wasActive) state.activeTabId = entry.tab.id;
          else state.activeTabId = entry.prevActiveTabId || state.activeTabId;
          state.selectedAnnotationId = null;
          state.editingAnnotationId = null;

          renderTabs();
          pdfv.updateViewer();
          updateWelcomeVisibility();
          session.scheduleAutoSave();
        })();
      },
      timeoutMs: 6500
    });
    pendingTabUndo.toastId = toastId;
    setTimeout(() => {
      if (pendingTabUndo?.toastId !== toastId) return;
      pendingTabUndo = null;
    }, 7000);
  }

  async function addPdfTab(filePath, fileName) {
    const d = requireDeps();
    const state = /** @type {{ tabs: object[], activeTabId: string | null }} */ (d.state);
    const pdfv = /** @type {{ updateViewer: () => void }} */ (d.pdfv);
    const updateWelcomeVisibility = /** @type {() => void} */ (d.updateWelcomeVisibility);
    const setStatus = /** @type {(msg: string) => void} */ (d.setStatus);
    const tr = /** @type {(k: string, vars?: object) => string} */ (d.tr);

    const result = await window.maniPdfApi.openPdf(filePath);
    if (!result.ok) {
      setStatus(resolvePdfOpenErrorMessage(result));
      return;
    }

    const tab = {
      id: `${Date.now()}-${Math.random()}`,
      name: fileName,
      path: result.path,
      currentPage: 1,
      annotationsByPage: {},
      pageRotationsByPage: {},
      pageRotationsUserTouched: {},
      viewportByPage: {},
      undoStack: [],
      redoStack: []
    };
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderTabs();
    pdfv.updateViewer();
    updateWelcomeVisibility();
    setStatus(tr("stPdfLoadedNamed", { name: fileName }));
    try {
      const t = /** @type {(k: string) => string} */ (d.t);
      setTimeout(() => {
        if (!state.tabs.some((row) => row.id === tab.id)) return;
        setStatus(t("stPdfLoadedHint2"));
      }, 250);
    } catch {
      /* intentional: delayed loaded hint status after open */
    }
  }

  async function promptOpenPdf() {
    const d = requireDeps();
    const setStatus = /** @type {(msg: string) => void} */ (d.setStatus);
    const t = /** @type {(k: string) => string} */ (d.t);

    const selected = await window.maniPdfApi.openPdfDialog();
    if (!selected.ok) {
      if (!selected.cancelled) setStatus(selected.error || t("stSelectionCancelled"));
      return;
    }
    const name = selected.path.split("\\").pop() || "document.pdf";
    await addPdfTab(selected.path, name);
  }

  window.__editifyTabs = {
    bind,
    renderTabs,
    removeTab,
    addPdfTab,
    promptOpenPdf
  };
})();
