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
      const exportActivePdfToPath =
        /** @type {(outputPath: string) => Promise<Record<string, unknown>>} */ (
          d.exportActivePdfToPath
        );
      const peekExportPayloadForTest = /** @type {() => Promise<Record<string, unknown>>} */ (
        d.peekExportPayloadForTest
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
            annotationsOnCurrentPageCount: annos.length,
            textOnCurrentPage: annos
              .filter((a) => a && a.type === "text")
              .map((a) => String(a.text || ""))
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
      window.__maniE2E.injectTextOnPageForTest = (pageNum, opts = {}) => {
        try {
          if (!window.__maniE2E.setCurrentPageForTest?.(pageNum)) return null;
          return window.__maniE2E.injectTextForTest(opts);
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
            w: Math.max(40, Number(opts.w) || 260),
            h: Math.max(24, Number(opts.h) || 100),
            rotation: 0,
            opacity: 100,
            textColor: opts.textColor != null ? String(opts.textColor) : "#111111",
            bgColor: opts.bgColor != null ? opts.bgColor : null,
            padding: Math.max(0, Math.min(64, Number(opts.padding) || 6)),
            fontFamily: opts.fontFamily != null ? String(opts.fontFamily) : "Arial",
            fontSize: Math.max(8, Math.min(96, Number(opts.fontSize) || 14)),
            text: plain,
            ...(opts.textWrapManual ? { textWrapManual: true } : {}),
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
      window.__maniE2E.applyCtxFormatToTextRangeForTest = (annotationId, start, end, cmd) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id || !cmd) return false;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return false;
          state.selectedAnnotationId = id;
          state.editingAnnotationId = id;
          tcm.setTextCtxMenuTargetId(id);
          renderAnnotations();
          const host = pagesContainer?.querySelector?.(`[data-id="${id}"]`);
          const ed = host?.querySelector?.(".text-editor");
          const helpers = window.__editifyTextCtxHelpers;
          const htmlApi = window.__editifyTextHtml;
          if (!ed || !helpers || !htmlApi) return false;
          if (!helpers.setPlainSelectionInEditor(ed, start, end)) return false;
          captureSnapshot(tab);
          ed.focus();
          try {
            document.execCommand(String(cmd), false, null);
          } catch {
            return false;
          }
          loc.item.textHtml = htmlApi.sanitizeTextHtml(ed.innerHTML);
          const rng = document.createRange();
          rng.selectNodeContents(ed);
          loc.item.text = String(rng.toString() || "").replace(/\r\n/g, "\n");
          delete loc.item._spellErrors;
          state.editingAnnotationId = null;
          renderAnnotations();
          session.scheduleAutoSave();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.getTextInlineFormatForTest = (annotationId) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return null;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return null;
          const html = String(loc.item.textHtml || loc.item.text || "");
          const helpers = window.__editifyTextCtxHelpers;
          if (!helpers) return null;
          return {
            bold: helpers.getFormatCoverageFromSanitizedHtml(html, "bold"),
            italic: helpers.getFormatCoverageFromSanitizedHtml(html, "italic"),
            underline: helpers.getFormatCoverageFromSanitizedHtml(html, "underline"),
            textHtml: loc.item.textHtml || null,
            text: loc.item.text || ""
          };
        } catch {
          return null;
        }
      };
      const undo = /** @type {() => void} */ (d.undo);
      window.__maniE2E.undoForTest = () => {
        try {
          undo();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.applyPartialTextColorForTest = (annotationId, start, end, hex) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return false;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return false;
          state.selectedAnnotationId = id;
          state.editingAnnotationId = id;
          renderAnnotations();
          const host = pagesContainer?.querySelector?.(`[data-id="${id}"]`);
          const ed = host?.querySelector?.(".text-editor");
          const helpers = window.__editifyTextCtxHelpers;
          const htmlApi = window.__editifyTextHtml;
          if (!ed || !helpers || !htmlApi) return false;
          if (!helpers.setPlainSelectionInEditor(ed, start, end)) return false;
          captureSnapshot(tab);
          const sel = window.getSelection();
          const savedRange =
            sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
          if (
            !helpers.applyTextColorInEditor(ed, hex, {
              selectAllIfCollapsed: false,
              savedRange
            })
          ) {
            return false;
          }
          loc.item.textHtml = htmlApi.sanitizeTextHtml(ed.innerHTML);
          const rng = document.createRange();
          rng.selectNodeContents(ed);
          loc.item.text = String(rng.toString() || "").replace(/\r\n/g, "\n");
          delete loc.item._spellErrors;
          state.editingAnnotationId = null;
          renderAnnotations();
          session.scheduleAutoSave();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.applyWholeTextColorForTest = (annotationId, hex) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return false;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return false;
          captureSnapshot(tab);
          loc.item.textColor = String(hex || "#111111");
          state.editingAnnotationId = null;
          renderAnnotations();
          session.scheduleAutoSave();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.typeInTextEditorForTest = (annotationId, text) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return null;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return null;
          state.selectedAnnotationId = id;
          state.editingAnnotationId = id;
          renderAnnotations();
          const host = pagesContainer?.querySelector?.(`[data-id="${id}"]`);
          const ed = host?.querySelector?.(".text-editor");
          if (!ed) return null;
          ed.focus();
          ed.textContent = "";
          captureSnapshot(tab);
          const chars = String(text || "");
          for (const ch of chars) {
            try {
              document.execCommand("insertText", false, ch);
            } catch {
              ed.textContent += ch;
            }
            ed.dispatchEvent(
              new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch })
            );
          }
          return loc.item.text || ed.innerText || "";
        } catch {
          return null;
        }
      };
      window.__maniE2E.getTextEditorVirtualTailForTest = (annotationId) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return null;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return null;
          const host = pagesContainer?.querySelector?.(`[data-id="${id}"]`);
          const ed = host?.querySelector?.(".text-editor");
          const tailPx = ed ? Number(ed.dataset.virtualTailPx || 0) : 0;
          const paddingRight = ed
            ? Number.parseFloat(window.getComputedStyle(ed).paddingRight || "0") || 0
            : 0;
          const fontSize = Math.max(8, Math.min(96, Number(loc.item.fontSize) || 14));
          return {
            editing: state.editingAnnotationId === id,
            tailPx,
            paddingRight,
            fontSize,
            text: loc.item.text || "",
            textEndsWithSpace: /\s$/.test(String(loc.item.text || ""))
          };
        } catch {
          return null;
        }
      };
      window.__maniE2E.narrowTextAnnotationForTest = (annotationId, maxWidthPx) => {
        try {
          const tab = getActiveTab();
          const id = String(annotationId || "");
          if (!tab || !id) return false;
          const loc = findAnnotationLocation(tab, id);
          if (!loc?.item || loc.item.type !== "text") return false;
          const zone = getSafeZoneSize();
          const margin = Math.max(20, Number(maxWidthPx) || 80);
          loc.item.x = Math.max(0, zone.width - margin);
          loc.item.w = 20;
          loc.item.h = 40;
          renderAnnotations();
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
            x: a.x,
            y: a.y,
            w: a.w,
            h: a.h
          };
          if (a.type === "text") {
            return {
              ...base,
              text: a.text,
              textHtml: a.textHtml ?? null,
              textColor: a.textColor,
              bgColor: a.bgColor ?? null,
              fontFamily: a.fontFamily,
              fontSize: a.fontSize,
              padding: a.padding
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
      window.__maniE2E.getPageRotationForTest = () => {
        try {
          const tab = getActiveTab();
          const pageKey = String(tab?.currentPage || 1);
          const node = pagesContainer?.querySelector?.(`.pdf-page[data-page="${pageKey}"]`);
          const fromTab = tab?.pageRotationsByPage?.[pageKey];
          if (fromTab !== undefined) {
            return (((Number(fromTab) || 0) % 360) + 360) % 360;
          }
          return (((Number(node?.dataset?.userRotation) || 0) % 360) + 360) % 360;
        } catch {
          return -1;
        }
      };
      window.__maniE2E.getPageRotationForPageTest = (pageNum) => {
        try {
          const tab = getActiveTab();
          const key = String(pageNum || 1);
          const node = pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
          const fromTab = tab?.pageRotationsByPage?.[key];
          if (fromTab !== undefined) {
            return (((Number(fromTab) || 0) % 360) + 360) % 360;
          }
          return (((Number(node?.dataset?.userRotation) || 0) % 360) + 360) % 360;
        } catch {
          return -1;
        }
      };
      window.__maniE2E.getPageRenderMetaForTest = (pageNum) => {
        try {
          const key = String(pageNum || 1);
          const node = pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
          const canvas = node?.querySelector?.("canvas.pdf-canvas");
          return {
            w: canvas?.width || 0,
            h: canvas?.height || 0,
            intrinsic: (((Number(node?.dataset?.intrinsicRotation) || 0) % 360) + 360) % 360,
            user: (((Number(node?.dataset?.userRotation) || 0) % 360) + 360) % 360,
            absolute: (((Number(node?.dataset?.rotation) || 0) % 360) + 360) % 360
          };
        } catch {
          return null;
        }
      };
      window.__maniE2E.getThumbTitleForPageTest = (pageNum) => {
        try {
          const items = document.querySelectorAll("#thumbsList .thumb-item");
          for (const item of items) {
            const title = item.querySelector(".thumb-title");
            const text = String(title?.textContent || "");
            if (text.includes(` ${pageNum}`) || text.startsWith(`Page ${pageNum}`)) {
              return text;
            }
          }
          const idx = Math.max(0, (Number(pageNum) || 1) - 1);
          return String(items[idx]?.querySelector(".thumb-title")?.textContent || "");
        } catch {
          return "";
        }
      };
      window.__maniE2E.setCurrentPageForTest = (pageNum) => {
        try {
          const tab = getActiveTab();
          if (!tab) return false;
          const n = Math.max(1, Math.floor(Number(pageNum) || 1));
          const max = tab.pageCount ? Math.max(1, tab.pageCount) : n;
          tab.currentPage = Math.min(n, max);
          pdfv.setActivePage(tab.currentPage);
          const active = pagesContainer?.querySelector?.(
            `.pdf-page[data-page="${tab.currentPage}"]`
          );
          active?.scrollIntoView?.({ block: "start", inline: "nearest" });
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.beginTextEditForTest = (annotationId) => {
        try {
          const tab = getActiveTab();
          if (!tab || !annotationId) return false;
          const loc = findAnnotationLocation(tab, String(annotationId));
          if (!loc?.item || loc.item.type !== "text") return false;
          state.selectedAnnotationId = String(annotationId);
          state.editingAnnotationId = String(annotationId);
          syncPropertyInputs();
          renderAnnotations();
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.getStatusTextForTest = () => {
        try {
          const el = document.getElementById("statusText");
          return String(el?.textContent || "");
        } catch {
          return "";
        }
      };
      window.__maniE2E.areRotateButtonsDisabledForTest = () => {
        try {
          const left = document.getElementById("rotateLeftBtn");
          const right = document.getElementById("rotateRightBtn");
          return Boolean(left?.disabled && right?.disabled);
        } catch {
          return false;
        }
      };
      window.__maniE2E.rotatePageForTest = async (direction) => {
        try {
          const fn = window.__editifyPageRotate?.rotateCurrentPage;
          if (typeof fn !== "function") return false;
          await fn(direction === "left" ? "left" : "right");
          return true;
        } catch {
          return false;
        }
      };
      window.__maniE2E.exportActivePdfToPathForTest = (p) => exportActivePdfToPath(String(p || ""));
      window.__maniE2E.peekExportPayloadForTest = () => peekExportPayloadForTest();
      window.__maniE2E.debugTextExportCaptureForTest = (annotationId) => {
        try {
          const htmlApi = window.__editifyTextHtml;
          if (!htmlApi?.buildExportTextHtmlForPdf) return { ok: false, error: "no_api" };
          const host = pagesContainer?.querySelector?.(`[data-id="${annotationId}"]`);
          if (!host) return { ok: false, error: "no_node" };
          const ed = host.querySelector?.(".text-editor");
          const root = ed || host;
          return {
            ok: true,
            clientWidth: host.clientWidth,
            wrapDisplay: host.classList.contains("wrap-display"),
            offsets: htmlApi.getVisualLineBreakOffsets?.(root) || [],
            captured: htmlApi.buildExportTextHtmlForPdf(root)
          };
        } catch (error) {
          return { ok: false, error: String(error?.message || error) };
        }
      };
      window.__maniE2E.overwriteActivePdfForTest = async () => {
        try {
          const tab = getActiveTab();
          const out = String(tab?.path || "").trim();
          if (!out) return { ok: false, error: "no_active_pdf" };
          const result = await exportActivePdfToPath(out);
          if (result?.ok) {
            tab.dirty = false;
            pdfv.invalidatePdfRenderCache([out]);
            pdfv.updateViewer();
          }
          return result;
        } catch (error) {
          return { ok: false, error: String(error?.message || error) };
        }
      };
    } catch {
      /* ignore */
    }
  }

  window.__editifyE2eHelpers = {
    bind
  };
})();
