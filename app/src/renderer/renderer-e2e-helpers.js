/**
 * Hooks Playwright / diagnostic (`window.__maniE2E`) - pas d’IPC main.
 * `window.__editifyE2eHelpers` - `bind()` depuis la fin de `renderer.js` une fois l’état et les handlers définis.
 */
(function () {
  "use strict";

  /**
   * @param {Record<string, unknown>} d
   */
  function bind(d) {
    try {
      window.__maniE2E = window.__maniE2E || {};
      const state =
        /** @type {{ tabs: unknown[], activeTabId: string | null, selectedAnnotationId: string | null, editingAnnotationId: string | null, clipboard: unknown }} */ (
          d.state
        );
      const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
      const cancelPointerInteraction = /** @type {() => void} */ (d.cancelPointerInteraction);
      const pagesContainer = /** @type {HTMLElement | null} */ (d.pagesContainer);
      const renderTabs = /** @type {() => void} */ (d.renderTabs);
      const pdfv = /** @type {{ updateViewer: () => void }} */ (d.pdfv);
      const updateWelcomeVisibility = /** @type {() => void} */ (d.updateWelcomeVisibility);
      const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
      const setStatus = /** @type {(msg: string) => void} */ (d.setStatus);
      const t = /** @type {(k: string) => string} */ (d.t);
      const cloneForClipboard = /** @type {(item: object) => object | null} */ (
        d.cloneForClipboard
      );
      const getSelectedAnnotationFromActivePage =
        /** @type {(tab: object | null) => object | null} */ (
          d.getSelectedAnnotationFromActivePage
        );
      const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
        d.currentPageAnnotations
      );
      const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
      const renderAnnotations = /** @type {() => void} */ (d.renderAnnotations);
      const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
      const addAnnotation = /** @type {(type: string, extra?: object) => void} */ (d.addAnnotation);
      const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
      const newAnnotationId = /** @type {() => string} */ (d.newAnnotationId);
      const findAnnotationLocation =
        /** @type {(tab: object, id: string) => { item?: object } | null} */ (
          d.findAnnotationLocation
        );
      const fitAnnotationToSafeZone = /** @type {(item: object, zone: object) => void} */ (
        d.fitAnnotationToSafeZone
      );
      const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
        d.getSafeZoneSize
      );
      const tcm =
        /** @type {{ setTextCtxMenuTargetId: (id: string) => void, ctxMenuExecFormat: (cmd: string) => void }} */ (
          d.tcm
        );
      const pasteClipboardIntoActivePage = /** @type {() => void} */ (
        d.pasteClipboardIntoActivePage
      );
      const clickManiColorValidateButtonForInputId = /** @type {(id: string) => void} */ (
        d.clickManiColorValidateButtonForInputId
      );
      const exportActivePdfToPath = /** @type {(outputPath: string) => Promise<Record<string, unknown>>} */ (
        d.exportActivePdfToPath
      );

      window.__maniE2E.resetUiState = () => {
        try {
          state.tabs = [];
          state.activeTabId = null;
          state.selectedAnnotationId = null;
          state.editingAnnotationId = null;
          cancelPointerInteraction();
          if (pagesContainer) pagesContainer.innerHTML = "";
          renderTabs();
          pdfv.updateViewer();
          updateWelcomeVisibility();
          syncPropertyInputs();
          setStatus(t("ready"));
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.getUiState = () => {
        try {
          const tab = getActiveTab();
          const page = String(tab?.currentPage || 1);
          const annos = tab?.annotationsByPage?.[page] || [];
          return {
            activeTabId: state.activeTabId,
            currentPage: tab?.currentPage || 1,
            pageCount: tab?.pageCount ?? null,
            selectedAnnotationId: state.selectedAnnotationId,
            editingAnnotationId: state.editingAnnotationId,
            clipboard: state.clipboard,
            annotationsOnCurrentPageCount: annos.length
          };
        } catch {
          return { error: true };
        }
      };
      window.__maniE2E.setLanguage = (lang) => {
        try {
          const setLanguage = /** @type {(l: string) => void} */ (d.setLanguage);
          setLanguage(String(lang || "fr"));
          return state.language;
        } catch {
          return null;
        }
      };
      window.__maniE2E.copySelected = () => {
        try {
          const tab = getActiveTab();
          const item = getSelectedAnnotationFromActivePage(tab);
          if (!tab || !item) return false;
          const copy = cloneForClipboard(item);
          if (!copy) return false;
          state.clipboard = copy;
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.cutSelected = () => {
        try {
          const tab = getActiveTab();
          const annotations = tab ? currentPageAnnotations(tab) : null;
          const item = getSelectedAnnotationFromActivePage(tab);
          if (!tab || !annotations || !item) return false;
          const cut = cloneForClipboard(item);
          if (!cut) return false;
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
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.paste = () => {
        try {
          if (!state.clipboard) return false;
          pasteClipboardIntoActivePage();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.injectShapeForTest = (shapeType) => {
        try {
          const tab = getActiveTab();
          if (!tab) return null;
          if (shapeType === "line") {
            addAnnotation("line", { h: 20 });
          } else if (SHAPE_TYPES.has(shapeType)) {
            addAnnotation(shapeType);
          } else {
            return null;
          }
          return state.selectedAnnotationId;
        } catch {
          return null;
        }
      };
      window.__maniE2E.injectTextForTest = (opts = {}) => {
        try {
          const tab = getActiveTab();
          if (!tab) return null;
          captureSnapshot(tab);
          const annotations = currentPageAnnotations(tab);
          const id = newAnnotationId();
          const plain = opts.plain != null ? String(opts.plain) : "hello";
          const html = opts.textHtml != null ? String(opts.textHtml).trim() : "";
          const ann = {
            id,
            type: "text",
            x: 100,
            y: 100,
            w: 260,
            h: 100,
            rotation: 0,
            opacity: 100,
            textColor: "#111111",
            bgColor: null,
            padding: 6,
            fontFamily: "Arial",
            fontSize: 14,
            text: plain,
            ...(html ? { textHtml: html } : {})
          };
          annotations.push(ann);
          state.selectedAnnotationId = id;
          state.editingAnnotationId = null;
          syncPropertyInputs();
          renderAnnotations();
          session.scheduleAutoSave();
          return id;
        } catch {
          return null;
        }
      };
      window.__maniE2E.applyCtxFormatToSelectedText = (cmd) => {
        try {
          const id = state.selectedAnnotationId;
          if (!id) return false;
          tcm.setTextCtxMenuTargetId(id);
          tcm.ctxMenuExecFormat(cmd);
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.injectImageForTest = (dataUrl) => {
        try {
          const tab = getActiveTab();
          if (!tab) return null;
          captureSnapshot(tab);
          const annotations = currentPageAnnotations(tab);
          const id = newAnnotationId();
          const src =
            dataUrl ||
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
          annotations.push({
            id,
            type: "image",
            x: 130,
            y: 130,
            w: 100,
            h: 75,
            rotation: 11,
            opacity: 92,
            src,
            fileName: "e2e.png"
          });
          state.selectedAnnotationId = id;
          renderAnnotations();
          session.scheduleAutoSave();
          return id;
        } catch {
          return null;
        }
      };
      window.__maniE2E.clearSelectionForTest = () => {
        try {
          state.selectedAnnotationId = null;
          state.editingAnnotationId = null;
          syncPropertyInputs();
          renderAnnotations();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.setAnnotationLogicalSizeForTest = (annotationId, w, h) => {
        try {
          const tab = getActiveTab();
          if (!tab || !annotationId) return false;
          const loc = findAnnotationLocation(tab, annotationId);
          if (!loc?.item) return false;
          const item = loc.item;
          if (!SHAPE_TYPES.has(item.type)) return false;
          captureSnapshot(tab);
          item.w = Math.max(1, Math.floor(Number(w) || 1));
          item.h = Math.max(1, Math.floor(Number(h) || 1));
          fitAnnotationToSafeZone(item, getSafeZoneSize());
          renderAnnotations();
          session.scheduleAutoSave();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.getAnnotationProps = (annotationId) => {
        try {
          const tab = getActiveTab();
          if (!tab || !annotationId) return null;
          const loc = findAnnotationLocation(tab, annotationId);
          if (!loc?.item) return null;
          const a = loc.item;
          const base = {
            type: a.type,
            rotation: a.rotation,
            opacity: a.opacity,
            w: a.w,
            h: a.h
          };
          if (a.type === "text") {
            return {
              ...base,
              text: a.text,
              textHtml: a.textHtml ?? null,
              textColor: a.textColor,
              bgColor: a.bgColor ?? null
            };
          }
          if (SHAPE_TYPES.has(a.type)) {
            return {
              ...base,
              fillColor: a.fillColor,
              strokeColor: a.strokeColor,
              fillAlpha: a.fillAlpha,
              strokeWidth: a.strokeWidth
            };
          }
          return base;
        } catch {
          return null;
        }
      };
      window.__maniE2E.applyPanelColorForTest = (inputId, hex) => {
        try {
          const el = document.getElementById(inputId);
          if (!el) return false;
          el.value = String(hex || "").trim();
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (typeof globalThis.maniAfterColorCommit === "function") {
            globalThis.maniAfterColorCommit(el);
          } else {
            clickManiColorValidateButtonForInputId(inputId);
          }
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.exportActivePdfToPathForTest = (p) => exportActivePdfToPath(String(p || ""));
    } catch {
      /* ignore */
    }
  }

  window.__editifyE2eHelpers = {
    bind
  };
})();
