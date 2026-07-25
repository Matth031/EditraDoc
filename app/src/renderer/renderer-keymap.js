/**
 * Raccourcis clavier : dispatch + garde isTypingContext.
 * Façade mince — délègue à history / annotations / tabs / chrome / save (pas de logique métier dupliquée).
 * `bind()` + `wire()` depuis renderer.js après les modules orchestrés.
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;
  let wired = false;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-keymap.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  /**
   * Contexte saisie : ne pas intercepter Ctrl+Z/Delete/etc. (sauf file/button inputs).
   * @param {EventTarget | null | undefined} target
   */
  function isTypingContext(target) {
    if (!target || !(target instanceof Element)) return false;
    const el = /** @type {HTMLElement & { type?: string, isContentEditable?: boolean }} */ (target);
    const tag = el.tagName?.toLowerCase();
    if (tag === "input") {
      const type = String(el.type || "").toLowerCase();
      // file / boutons : pas de saisie clavier — ne pas bloquer Ctrl+S, etc.
      if (type === "file" || type === "button" || type === "submit" || type === "reset") {
        return false;
      }
    }
    return (
      tag === "input" || tag === "textarea" || tag === "select" || Boolean(el.isContentEditable)
    );
  }

  /** @returns {boolean} true si l'événement a été consommé */
  function handleF10(event, d) {
    if (event.key !== "F10") return false;
    event.preventDefault();
    event.stopPropagation();
    const chrome = /** @type {{ toggleHtmlToolbarF10: (src: string) => void }} */ (d.chrome);
    chrome.toggleHtmlToolbarF10("renderer-keydown");
    return true;
  }

  /**
   * Cascade Escape (ordre volontaire, lisible) :
   * 1) modal formes → 2) flyouts toolbar → 3) fin d'édition texte.
   * @returns {boolean} true si consommé
   */
  function handleEscapeStack(event, d) {
    if (event.key !== "Escape") return false;

    const state = /** @type {{ editingAnnotationId: string | null }} */ (d.state);
    const chrome = /** @type {{ closeAllFlyoutMenus: () => void }} */ (d.chrome);
    const shapeModal = /** @type {HTMLElement} */ (d.shapeModal);
    const closeShapePicker = /** @type {() => void} */ (d.closeShapePicker);
    const pdfToolsMenu = /** @type {HTMLElement | null} */ (d.pdfToolsMenu);
    const toolbarFileMenu = /** @type {HTMLElement | null} */ (d.toolbarFileMenu);
    const toolbarOptionsMenu = /** @type {HTMLElement | null} */ (d.toolbarOptionsMenu);

    if (!shapeModal.classList.contains("hidden")) {
      event.preventDefault();
      closeShapePicker();
      return true;
    }

    const anyFlyout =
      (pdfToolsMenu && !pdfToolsMenu.classList.contains("hidden")) ||
      (toolbarFileMenu && !toolbarFileMenu.classList.contains("hidden")) ||
      (toolbarOptionsMenu && !toolbarOptionsMenu.classList.contains("hidden"));
    if (anyFlyout) {
      event.preventDefault();
      chrome.closeAllFlyoutMenus();
      return true;
    }

    // E6-S2: en mode édition texte, ESC doit terminer l'édition (sans perdre le texte).
    if (state.editingAnnotationId) {
      event.preventDefault();
      const endTextEditOnEscape = /** @type {() => void} */ (d.endTextEditOnEscape);
      endTextEditOnEscape();
      return true;
    }

    return false;
  }

  /**
   * Clipboard annotations (Ctrl/Cmd+C/X/V), hors Shift.
   * @returns {boolean} true si un raccourci clipboard a matché (même si no-op)
   */
  function handleClipboardShortcuts(event, d, key) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.shiftKey) return false;
    if (key !== "c" && key !== "x" && key !== "v") return false;

    const state = /** @type {{
        editingAnnotationId: string | null,
        selectedAnnotationId: string | null,
        clipboard: object | null
      }} */ (d.state);
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const getSelectedAnnotationFromActivePage =
      /** @type {(tab: object | null) => object | null} */ (d.getSelectedAnnotationFromActivePage);
    const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
      d.currentPageAnnotations
    );
    const cloneForClipboard = /** @type {(item: object) => object | null} */ (d.cloneForClipboard);
    const setStatus = /** @type {(msg: string) => void} */ (d.setStatus);
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const renderAnnotations = /** @type {() => void} */ (d.renderAnnotations);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    const pasteClipboardIntoActivePage = /** @type {() => void} */ (d.pasteClipboardIntoActivePage);

    if (key === "c") {
      const tab = getActiveTab();
      const item = getSelectedAnnotationFromActivePage(tab);
      if (!tab || !item) return true;
      event.preventDefault();
      const copy = cloneForClipboard(item);
      if (!copy) return true;
      state.clipboard = copy;
      setStatus("Élément copié");
      return true;
    }

    if (key === "x") {
      const tab = getActiveTab();
      const annotations = tab ? currentPageAnnotations(tab) : null;
      const item = getSelectedAnnotationFromActivePage(tab);
      if (!tab || !annotations || !item) return true;
      event.preventDefault();
      const cut = cloneForClipboard(item);
      if (!cut) return true;
      state.clipboard = cut;
      const idx = annotations.findIndex((a) => a.id === item.id);
      if (idx >= 0) {
        captureSnapshot(tab);
        annotations.splice(idx, 1);
        state.selectedAnnotationId = null;
        state.editingAnnotationId = null;
        syncPropertyInputs();
        renderAnnotations();
        session.scheduleAutoSave();
      }
      setStatus("Élément coupé");
      return true;
    }

    // key === "v"
    if (!state.clipboard) return true;
    event.preventDefault();
    pasteClipboardIntoActivePage();
    setStatus("Élément collé");
    return true;
  }

  /** @returns {boolean} */
  function handleDeleteShortcut(event, d) {
    if (event.key !== "Delete" && event.key !== "Backspace") return false;
    event.preventDefault();
    const deleteSelected = /** @type {() => void} */ (d.deleteSelected);
    deleteSelected();
    return true;
  }

  /** Undo / redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z). @returns {boolean} */
  function handleHistoryShortcuts(event, d, key) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return false;
    const undo = /** @type {() => void} */ (d.undo);
    const redo = /** @type {() => void} */ (d.redo);

    if (!event.shiftKey && key === "z") {
      event.preventDefault();
      undo();
      return true;
    }
    if (key === "y" || (event.shiftKey && key === "z")) {
      event.preventDefault();
      redo();
      return true;
    }
    return false;
  }

  /** Ctrl+S / Ctrl+O. @returns {boolean} */
  function handleFileShortcuts(event, d, key) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return false;
    const savePdfAs = /** @type {() => Promise<unknown>} */ (d.savePdfAs);
    const pdfSave = /** @type {{ logSave: (code: string, data?: object) => void }} */ (d.pdfSave);
    const promptOpenPdf = /** @type {() => void} */ (d.promptOpenPdf);

    if (key === "s") {
      event.preventDefault();
      savePdfAs().catch((error) => {
        pdfSave.logSave("save_shortcut_exception", { error: String(error?.message || error) });
      });
      return true;
    }
    if (key === "o") {
      event.preventDefault();
      void promptOpenPdf();
      return true;
    }
    return false;
  }

  /** Flèches : d'abord déplacement annotation, sinon pagination. @returns {boolean} */
  function handleArrowShortcuts(event, d) {
    const key = event.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") {
      return false;
    }
    const tryHandleSelectedAnnotationArrowKey = /** @type {(event: KeyboardEvent) => boolean} */ (
      d.tryHandleSelectedAnnotationArrowKey
    );
    const pageShift = /** @type {(delta: number) => void} */ (d.pageShift);

    if (tryHandleSelectedAnnotationArrowKey(event)) return true;

    if (key === "ArrowLeft") {
      event.preventDefault();
      pageShift(-1);
      return true;
    }
    if (key === "ArrowRight") {
      event.preventDefault();
      pageShift(1);
      return true;
    }
    return false;
  }

  /**
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    const d = requireDeps();
    const state = /** @type {{ editingAnnotationId: string | null }} */ (d.state);

    if (handleF10(event, d)) return;
    if (handleEscapeStack(event, d)) return;

    if (isTypingContext(event.target) || state.editingAnnotationId) return;

    const key = event.key.toLowerCase();
    if (handleClipboardShortcuts(event, d, key)) return;
    if (handleDeleteShortcut(event, d)) return;
    if (handleHistoryShortcuts(event, d, key)) return;
    if (handleFileShortcuts(event, d, key)) return;
    handleArrowShortcuts(event, d);
  }

  /** Enregistre le listener capture une seule fois. */
  function wire() {
    requireDeps();
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", handleKeydown, true);
  }

  window.__editifyKeymap = {
    bind,
    wire,
    isTypingContext,
    handleKeydown,
    moduleId: "renderer-keymap"
  };
})();
