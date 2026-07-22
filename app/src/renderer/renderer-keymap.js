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

  /**
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    const d = requireDeps();
    const state = /** @type {{
        editingAnnotationId: string | null,
        selectedAnnotationId: string | null,
        clipboard: object | null
      }} */ (d.state);
    const chrome = /** @type {{
        toggleHtmlToolbarF10: (src: string) => void,
        closeAllFlyoutMenus: () => void
      }} */ (d.chrome);
    const shapeModal = /** @type {HTMLElement} */ (d.shapeModal);
    const closeShapePicker = /** @type {() => void} */ (d.closeShapePicker);
    const pdfToolsMenu = /** @type {HTMLElement | null} */ (d.pdfToolsMenu);
    const toolbarFileMenu = /** @type {HTMLElement | null} */ (d.toolbarFileMenu);
    const toolbarOptionsMenu = /** @type {HTMLElement | null} */ (d.toolbarOptionsMenu);

    if (event.key === "F10") {
      event.preventDefault();
      event.stopPropagation();
      chrome.toggleHtmlToolbarF10("renderer-keydown");
      return;
    }

    if (event.key === "Escape" && !shapeModal.classList.contains("hidden")) {
      event.preventDefault();
      closeShapePicker();
      return;
    }

    if (event.key === "Escape") {
      const anyFlyout =
        (pdfToolsMenu && !pdfToolsMenu.classList.contains("hidden")) ||
        (toolbarFileMenu && !toolbarFileMenu.classList.contains("hidden")) ||
        (toolbarOptionsMenu && !toolbarOptionsMenu.classList.contains("hidden"));
      if (anyFlyout) {
        event.preventDefault();
        chrome.closeAllFlyoutMenus();
        return;
      }
    }

    // E6-S2: en mode édition texte, ESC doit terminer l'édition (sans perdre le texte).
    if (event.key === "Escape" && state.editingAnnotationId) {
      event.preventDefault();
      const endTextEditOnEscape = /** @type {() => void} */ (d.endTextEditOnEscape);
      endTextEditOnEscape();
      return;
    }

    if (isTypingContext(event.target) || state.editingAnnotationId) return;

    const key = event.key.toLowerCase();
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
    const deleteSelected = /** @type {() => void} */ (d.deleteSelected);
    const undo = /** @type {() => void} */ (d.undo);
    const redo = /** @type {() => void} */ (d.redo);
    const savePdfAs = /** @type {() => Promise<unknown>} */ (d.savePdfAs);
    const pdfSave = /** @type {{ logSave: (code: string, data?: object) => void }} */ (d.pdfSave);
    const promptOpenPdf = /** @type {() => void} */ (d.promptOpenPdf);
    const tryHandleSelectedAnnotationArrowKey = /** @type {(event: KeyboardEvent) => boolean} */ (
      d.tryHandleSelectedAnnotationArrowKey
    );
    const pageShift = /** @type {(delta: number) => void} */ (d.pageShift);

    // Clipboard (Ctrl+C / Ctrl+X / Ctrl+V) pour annotations
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "c") {
      const tab = getActiveTab();
      const item = getSelectedAnnotationFromActivePage(tab);
      if (!tab || !item) return;
      event.preventDefault();
      const copy = cloneForClipboard(item);
      if (!copy) return;
      state.clipboard = copy;
      setStatus("Élément copié");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "x") {
      const tab = getActiveTab();
      const annotations = tab ? currentPageAnnotations(tab) : null;
      const item = getSelectedAnnotationFromActivePage(tab);
      if (!tab || !annotations || !item) return;
      event.preventDefault();
      const cut = cloneForClipboard(item);
      if (!cut) return;
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
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "v") {
      if (!state.clipboard) return;
      event.preventDefault();
      pasteClipboardIntoActivePage();
      setStatus("Élément collé");
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z") {
      event.preventDefault();
      undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (key === "y" || (event.shiftKey && key === "z"))) {
      event.preventDefault();
      redo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      savePdfAs().catch((error) => {
        pdfSave.logSave("save_shortcut_exception", { error: String(error?.message || error) });
      });
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "o") {
      event.preventDefault();
      void promptOpenPdf();
      return;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      if (tryHandleSelectedAnnotationArrowKey(event)) return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      pageShift(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      pageShift(1);
    }
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
