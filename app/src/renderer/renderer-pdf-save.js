/**
 * Enregistrement PDF : dialogue Enregistrer sous, export avec annotations, écrasement même chemin.
 * `window.__editifyPdfSave` — `bind()` depuis `renderer.js` après `__editifyPdfViewer.bind()`.
 *
 * ---------------------------------------------------------------------------
 * NOTE AGENT / MAINTENANCE (EditraDoc)
 * ---------------------------------------------------------------------------
 * Ce fichier est le SEUL point d'entrée pour :
 *   - Enregistrer sous (dialogue + export)
 *   - exportActivePdfToPath (écrasement / E2E)
 *   - readImageFileAsBase64 (préparation image à l'export)
 *
 * NE PAS MODIFIER ce fichier pour des correctifs sans rapport :
 *   ergonomie clavier, menus contextuels, i18n, journal, sidebars, texte, formes, etc.
 * Si la tâche ne concerne pas explicitement la sauvegarde ou l'export PDF, laisser ce
 * module intact et travailler ailleurs (renderer.js, menus, annotations, etc.).
 *
 * Référence stable export : 33b8dda + correctifs chemin dialogue, images base64, cache pdf.js.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  /**
   * @typedef {object} PdfSaveDeps
   * @property {() => unknown | null} getActiveTab
   * @property {{ annotationLayer: HTMLElement | null }} layerRef
   * @property {HTMLElement | null} pagesContainer
   * @property {(targetId: string | null) => void} commitActiveTextEditIfNeeded
   * @property {(tab: unknown, id: string) => { item: Record<string, unknown> } | null} findAnnotationLocation
   * @property {(root: Element) => HTMLElement | null} getAnnotationTextEditor
   * @property {(item: Record<string, unknown>, editorEl: HTMLElement) => void} syncTextFromEditor
   * @property {(item: Record<string, unknown>) => string} plainTextForAnnotationItem
   * @property {(html: string) => string} sanitizeTextHtml
   * @property {(root: HTMLElement) => string} buildExportTextHtmlForPdf
   * @property {(tab: unknown, canvases?: Record<string, { w?: number, h?: number }>) => void} ensureTextAnnotationsSizedForExport
   * @property {() => Promise<void>} [syncOpenPdfPathsToMain]
   * @property {(tab: unknown, zone: { width: number, height: number }, pageKey: string) => boolean} scaleAnnotationsForPage
   * @property {Set<string>} SHAPE_TYPES
   * @property {(a: Record<string, unknown>) => void} mergeShapeStyleFields
   * @property {(pdfPath: string, pageNum: number, rect: object, canvasW: number, canvasH: number) => Promise<object>} convertCanvasRectToPdfUser
   * @property {(paths: string[]) => void} invalidatePdfRenderCache
   * @property {() => void} updateViewer
   * @property {(a: string, b: string) => boolean} pathsEqual
   * @property {(msg: string) => void} setStatus
   * @property {(key: string) => string} t
   */

  /** @type {PdfSaveDeps | null} */
  let deps = null;

  /** @returns {PdfSaveDeps} */
  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyPdfSave.bind() doit être appelé depuis renderer.js après __editifyPdfViewer.bind()."
      );
    }
    return deps;
  }

  /** @param {PdfSaveDeps} next */
  function bind(next) {
    deps = next;
  }

  function buildSuggestedSaveAsName(tab) {
    try {
      const name = String(tab?.name || "document.pdf");
      const base = name.toLowerCase().endsWith(".pdf") ? name.slice(0, -4) : name;
      return `${base}_modifie.pdf`;
    } catch {
      return "document_modifie.pdf";
    }
  }

  /** Chemin suggéré complet (dossier du PDF ouvert + nom _modifie.pdf) pour le dialogue Enregistrer sous. */
  function buildSuggestedSaveAsPath(tab) {
    const suggested = buildSuggestedSaveAsName(tab);
    const src = String(tab?.path || "").trim();
    if (!src) return suggested;
    const sep = src.includes("\\") ? "\\" : "/";
    const idx = src.lastIndexOf(sep);
    if (idx <= 0) return suggested;
    return `${src.slice(0, idx + 1)}${suggested}`;
  }

  /** Lit un fichier image (Blob/File) en base64 brute pour l'export Python. */
  async function readImageFileAsBase64(file) {
    if (!file) throw new Error("fichier vide");
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const t = String(r.result || "");
        const i = t.indexOf("base64,");
        if (i === -1) reject(new Error("filereader"));
        else resolve(t.slice(i + 7));
      };
      r.onerror = () => reject(r.error || new Error("filereader"));
      r.readAsDataURL(file);
    });
  }

  function logSave(step, payload = {}) {
    const data = { step, ...payload };
    const isError = /abort|fail|error|exception/i.test(String(step || ""));
    const isWarn = /warn/i.test(String(step || ""));
    const level = isError ? "error" : isWarn ? "warn" : "info";
    try {
      window.maniPdfApi?.logEvent?.({ level, scope: "save", message: String(step), data });
      window.maniPdfApi?.log?.("save", data);
    } catch (error) {
      try {
        globalThis.__editifyReportError?.("save:log", String(error), { step });
      } catch {
        /* ignore */
      }
    }
  }

  /** Journal export multi-pages — EDITRADOC_EXPORT_AUDIT=1 uniquement (S19 opt-in). */
  function redactTextPreviewForLog(text) {
    const s = String(text ?? "");
    const lines = s ? s.split(/\r?\n/).length : 0;
    const words = s.trim() ? s.trim().split(/\s+/).length : 0;
    return `[len=${s.length} lines=${lines} words=${words}]`;
  }

  function logExportAudit(step, payload = {}) {
    try {
      if (!window.maniPdfApi?.isExportAuditEnabled?.()) return;
      const data = { step, ...payload };
      window.maniPdfApi?.logEvent?.({
        level: "debug",
        scope: "export-audit",
        message: String(step),
        data
      });
    } catch (error) {
      try {
        globalThis.__editifyReportError?.("save:export-audit", String(error), { step });
      } catch {
        /* ignore */
      }
    }
  }

  function summarizeShapeAnnotation(a) {
    if (!a || a.type === "text" || a.type === "image") return null;
    return {
      id: a.id,
      type: a.type,
      x: Math.round(Number(a.x) || 0),
      y: Math.round(Number(a.y) || 0),
      w: Math.round(Number(a.w) || 0),
      h: Math.round(Number(a.h) || 0),
      rotation: Number(a.rotation) || 0,
      fillColor: a.fillColor || null,
      strokeColor: a.strokeColor || null,
      strokeWidth: a.strokeWidth ?? null,
      coords_space: a.coords_space || null,
      hasPdfEx: Array.isArray(a.pdf_ex)
    };
  }

  function summarizeImageAnnotation(a) {
    if (!a || a.type !== "image") return null;
    return {
      id: a.id,
      type: "image",
      x: Math.round(Number(a.x) || 0),
      y: Math.round(Number(a.y) || 0),
      w: Math.round(Number(a.w) || 0),
      h: Math.round(Number(a.h) || 0),
      rotation: Number(a.rotation) || 0,
      hasSrc: Boolean(a.src),
      hasBase64: Boolean(a.src_base64),
      coords_space: a.coords_space || null,
      hasPdfEx: Array.isArray(a.pdf_ex)
    };
  }

  function summarizeAnnotationForAudit(a) {
    if (!a) return null;
    if (a.type === "text") return summarizeTextAnnotation(a);
    if (a.type === "image") return summarizeImageAnnotation(a);
    return summarizeShapeAnnotation(a);
  }

  function collectPageRotationAudit(tab, canvases) {
    const pages = {};
    const allKeys = new Set([
      ...Object.keys(tab?.pageRotationsByPage || {}),
      ...Object.keys(canvases || {}),
      ...Object.keys(tab?.annotationsByPage || {})
    ]);
    allKeys.forEach((pageKey) => {
      const canvas = canvases?.[pageKey] || null;
      const pageNode = requireDeps().pagesContainer?.querySelector?.(
        `.pdf-page[data-page="${pageKey}"]`
      );
      pages[pageKey] = {
        userRotation: tab?.pageRotationsByPage?.[pageKey] ?? 0,
        userTouched: Boolean(tab?.pageRotationsUserTouched?.[pageKey]),
        intrinsicRotation: Number(pageNode?.dataset?.intrinsicRotation) || 0,
        canvasRotation: canvas?.rotation ?? null,
        canvasW: canvas?.w ?? null,
        canvasH: canvas?.h ?? null
      };
    });
    return pages;
  }

  function summarizeTextAnnotation(a) {
    if (!a || a.type !== "text") return null;
    const plain = String(a.text || "");
    return {
      id: a.id,
      type: "text",
      x: Math.round(Number(a.x) || 0),
      y: Math.round(Number(a.y) || 0),
      w: Math.round(Number(a.w) || 0),
      h: Math.round(Number(a.h) || 0),
      rotation: Number(a.rotation) || 0,
      fontSize: Number(a.fontSize) || null,
      fontFamily: a.fontFamily || null,
      padding: Number(a.padding) || null,
      textColor: a.textColor || null,
      bgColor: a.bgColor || null,
      textWrapManual: Boolean(a.textWrapManual),
      textLen: plain.length,
      textPreview: redactTextPreviewForLog(plain),
      htmlLen: String(a.textHtml || "").length,
      coords_space: a.coords_space || null,
      hasPdfEx: Array.isArray(a.pdf_ex),
      hasPdfEy: Array.isArray(a.pdf_ey)
    };
  }

  function summarizeAnnotationsByPage(map, canvases) {
    const out = {};
    Object.keys(map || {}).forEach((pageKey) => {
      const arr = map[pageKey] || [];
      out[pageKey] = {
        count: arr.length,
        canvas: canvases?.[pageKey] || null,
        items: arr.map((a) => summarizeAnnotationForAudit(a)).filter(Boolean)
      };
    });
    return out;
  }

  async function waitForPythonService(maxWaitMs = 5000) {
    const started = Date.now();
    let attempt = 0;
    while (Date.now() - started < maxWaitMs) {
      attempt += 1;
      try {
        const health = await window.maniPdfApi.pythonHealth();
        if (health?.ok) {
          if (health.export_ready === false) {
            logSave("python_missing_deps", { attempt, health });
            return {
              ok: false,
              error:
                "Modules Python manquants (pypdf/reportlab). Lancez: npm run setup:python dans le dossier app/"
            };
          }
          logSave("python_ready", { attempt, elapsedMs: Date.now() - started, health });
          return { ok: true };
        }
        logSave("python_wait", { attempt, health });
      } catch (error) {
        logSave("python_wait_error", { attempt, error: String(error?.message || error) });
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return { ok: false, error: "Service Python indisponible (timeout)." };
  }

  function countAnnotationsByPage(annotationsByPage) {
    try {
      return Object.keys(annotationsByPage || {}).reduce((total, key) => {
        const arr = annotationsByPage[key];
        return total + (Array.isArray(arr) ? arr.length : 0);
      }, 0);
    } catch {
      return 0;
    }
  }

  function flushAllTextAnnotationsForExport(tab) {
    const d = requireDeps();
    if (!tab) return;
    d.commitActiveTextEditIfNeeded(null);

    try {
      d.layerRef.annotationLayer?.querySelectorAll?.(".annotation.text").forEach((node) => {
        const id = node.dataset?.id;
        if (!id) return;
        const item = d.findAnnotationLocation(tab, id)?.item;
        if (item?.type !== "text") return;
        const ed = d.getAnnotationTextEditor(node);
        if (ed) {
          d.syncTextFromEditor(item, ed);
          return;
        }
        const html = String(node.innerHTML || "").trim();
        if (html) {
          item.textHtml = d.sanitizeTextHtml(html);
          item.text = d.plainTextForAnnotationItem(item);
        }
      });
    } catch (error) {
      logSave("text_flush_dom_warn", { error: String(error?.message || error) });
    }

    try {
      Object.keys(tab.annotationsByPage || {}).forEach((pageKey) => {
        (tab.annotationsByPage[pageKey] || []).forEach((a) => {
          if (a?.type !== "text") return;
          const plain = d.plainTextForAnnotationItem(a);
          if (plain) a.text = plain;
          if (!a.textHtml && a.text) a.textHtml = String(a.text);
        });
      });
    } catch (error) {
      logSave("text_flush_model_warn", { error: String(error?.message || error) });
    }
  }

  /** Réaligne les coords stockées sur les dimensions canvas réelles avant export (toutes pages). */
  function resyncAllPagesForExport(tab, canvases) {
    const d = requireDeps();
    if (!tab?.annotationsByPage) return;
    for (const pageKey of Object.keys(tab.annotationsByPage)) {
      const c = canvases?.[pageKey];
      if (!c?.w || !c?.h) continue;
      const zone = { width: c.w, height: c.h };
      if (d.scaleAnnotationsForPage(tab, zone, pageKey)) {
        logSave("coords_rescaled", { pageKey, zone });
      }
    }
  }

  function logExportGeometryAudit(tab, canvases, annotationsByPage) {
    logExportAudit("geometry_full", {
      currentPage: tab?.currentPage || 1,
      pageCount: tab?.pageCount || null,
      canvasPages: Object.keys(canvases || {}),
      annotationPages: Object.keys(tab?.annotationsByPage || {}),
      payloadPages: Object.keys(annotationsByPage || {}),
      detail: summarizeAnnotationsByPage(annotationsByPage || tab?.annotationsByPage, canvases)
    });
  }

  /**
   * Encode une image (blob:, data:, http(s):) en base64 brute pour l'export Python.
   * fetch(blob:) peut échouer selon l'environnement : repli XHR + FileReader.
   */
  async function imageSrcToBase64(src) {
    const s = String(src || "");
    if (!s) throw new Error("src vide");
    if (s.startsWith("data:")) {
      const idx = s.indexOf("base64,");
      if (idx === -1) throw new Error("data: sans base64");
      return s.slice(idx + 7);
    }
    let blob;
    try {
      const res = await fetch(s);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      blob = await res.blob();
    } catch {
      blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", s);
        xhr.responseType = "blob";
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("xhr_blob"));
        xhr.send();
      });
    }
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const t = String(r.result || "");
        const i = t.indexOf("base64,");
        if (i === -1) reject(new Error("filereader"));
        else resolve(t.slice(i + 7));
      };
      r.onerror = () => reject(r.error || new Error("filereader"));
      r.readAsDataURL(blob);
    });
  }

  async function encodeImageForExport(a, pageKey) {
    if (a.type !== "image") return;
    if (a.src_base64) return;
    if (!a.src) return;
    const timeoutMs = 12000;
    try {
      a.src_base64 = await Promise.race([
        imageSrcToBase64(a.src),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("image_encode_timeout")), timeoutMs);
        })
      ]);
    } catch (error) {
      if (!a.src_base64) {
        logSave("image_encode_error", {
          pageKey,
          id: a.id,
          error: String(error?.message || error)
        });
        throw error;
      }
    }
  }

  async function convertAnnotationsToPdfUserSpace(tab, annotationsByPage, canvases) {
    const d = requireDeps();
    const pdfPath = tab?.path;
    if (!pdfPath || !d.convertCanvasRectToPdfUser) return;

    for (const pageKey of Object.keys(annotationsByPage || {})) {
      const meta = canvases?.[pageKey];
      if (!meta?.w || !meta?.h) {
        logExportAudit("pdf_coords_skip_page", {
          pageKey,
          reason: "missing_canvas_meta",
          meta: meta || null,
          annoCount: (annotationsByPage[pageKey] || []).length
        });
        continue;
      }
      const pageNum = Number(pageKey) || 1;
      const arr = annotationsByPage[pageKey] || [];
      for (const a of arr) {
        const before = summarizeTextAnnotation(a);
        try {
          const pdfRect = await d.convertCanvasRectToPdfUser(
            pdfPath,
            pageNum,
            { x: a.x, y: a.y, w: a.w, h: a.h },
            meta.w,
            meta.h
          );
          a.x = pdfRect.x;
          a.y = pdfRect.y;
          a.canvas_w = pdfRect.canvas_w;
          a.canvas_h = pdfRect.canvas_h;
          a.pdf_ex = pdfRect.pdf_ex;
          a.pdf_ey = pdfRect.pdf_ey;
          a.coords_space = "pdf_user";
          logExportAudit("pdf_coords_ok", {
            pageKey,
            pageNum,
            id: a.id,
            type: a.type,
            before,
            after: {
              x: Math.round(Number(a.x) || 0),
              y: Math.round(Number(a.y) || 0),
              canvas_w: a.canvas_w,
              canvas_h: a.canvas_h,
              pdf_ex: a.pdf_ex,
              pdf_ey: a.pdf_ey
            }
          });
        } catch (error) {
          logExportAudit("pdf_coords_fail", {
            pageKey,
            pageNum,
            id: a.id,
            type: a.type,
            before,
            error: String(error?.message || error)
          });
          logSave("pdf_coords_warn", {
            pageKey,
            id: a.id,
            error: String(error?.message || error)
          });
        }
      }
    }
  }

  function resolveExportTextHtmlForClone(d, item) {
    const fallback = d.sanitizeTextHtml(String(item.textHtml || item.text || ""));
    const id = String(item.id || "");
    if (!id) return fallback;
    const node = d.layerRef.annotationLayer?.querySelector?.(`[data-id="${id.replace(/"/g, '\\"')}"]`);
    if (!node) return fallback;
    const ed = d.getAnnotationTextEditor(node);
    const root = ed || node;
    if (typeof d.buildExportTextHtmlForPdf === "function") {
      return d.buildExportTextHtmlForPdf(root);
    }
    return fallback;
  }

  async function prepareExportPayload(tab) {
    const d = requireDeps();
    logExportAudit("prepare_start", {
      currentPage: tab?.currentPage || 1,
      tabPages: Object.keys(tab?.annotationsByPage || {}),
      before: summarizeAnnotationsByPage(tab?.annotationsByPage, null)
    });
    flushAllTextAnnotationsForExport(tab);

    const canvases = {};
    try {
      d.pagesContainer?.querySelectorAll?.(".pdf-page").forEach((node) => {
        const page = Number(node.dataset.page) || 1;
        const c = node.querySelector("canvas.pdf-canvas");
        if (!c) return;
        canvases[String(page)] = {
          w: c.width || 0,
          h: c.height || 0,
          rotation: Number(node.dataset.rotation) || 0
        };
      });
    } catch (error) {
      logSave("canvases_warn", { error: String(error?.message || error) });
    }

    logExportAudit("canvases_collected", {
      pages: canvases,
      domPageNodes: d.pagesContainer?.querySelectorAll?.(".pdf-page")?.length || 0,
      pageRotations: collectPageRotationAudit(tab, canvases)
    });

    resyncAllPagesForExport(tab, canvases);

    try {
      d.ensureTextAnnotationsSizedForExport?.(tab, canvases);
    } catch (error) {
      logSave("text_size_export_warn", { error: String(error?.message || error) });
    }

    logExportAudit("after_text_size", {
      tabPages: summarizeAnnotationsByPage(tab?.annotationsByPage, canvases)
    });

    const annotationsByPage = {};
    try {
      Object.keys(tab.annotationsByPage || {}).forEach((k) => {
        const arr = tab.annotationsByPage[k] || [];
        annotationsByPage[k] = arr.map((a) => {
          const c = { ...a };
          delete c._spellErrors;
          if (d.SHAPE_TYPES.has(c.type)) d.mergeShapeStyleFields(c);
          if (c.type === "text") {
            c.textHtml = resolveExportTextHtmlForClone(d, a);
            c.text = d.plainTextForAnnotationItem(c);
            if (!c.textHtml && c.text) c.textHtml = String(c.text);
            c.padding = Math.round((Number(c.padding) || 6) * 10) / 10;
          }
          return c;
        });
      });
    } catch (error) {
      logSave("annotations_map_error", { error: String(error?.message || error) });
      throw new Error("Impossible de preparer les annotations pour l'export.", { cause: error });
    }

    try {
      await convertAnnotationsToPdfUserSpace(tab, annotationsByPage, canvases);
    } catch (error) {
      logSave("pdf_coords_error", { error: String(error?.message || error) });
    }

    logExportGeometryAudit(tab, canvases, annotationsByPage);

    try {
      for (const pageKey of Object.keys(annotationsByPage)) {
        const arr = annotationsByPage[pageKey] || [];
        for (const a of arr) {
          await encodeImageForExport(a, pageKey);
        }
      }
    } catch (error) {
      logSave("export_abort", {
        reason: "image_encode_failed",
        error: String(error?.message || error)
      });
      throw new Error("image_encode_failed", { cause: error });
    }

    return { canvases, annotationsByPage };
  }

  /** Prépare le payload d'export sans IPC (tests E2E / diagnostic). */
  async function peekExportPayloadForTest() {
    const d = requireDeps();
    const tab = d.getActiveTab();
    if (!tab?.path) return { ok: false, error: "no_active_pdf" };
    try {
      const { canvases, annotationsByPage } = await prepareExportPayload(tab);
      return {
        ok: true,
        inputPath: tab.path,
        canvases,
        annotationsByPage
      };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  async function exportActivePdfToPath(outputPath) {
    const d = requireDeps();
    const tab = d.getActiveTab();
    if (!tab) {
      logSave("export_abort", { reason: "no_active_pdf" });
      return { ok: false, error: "no_active_pdf" };
    }
    if (!tab.path) {
      logSave("export_abort", { reason: "no_input_path", tabId: tab.id });
      return { ok: false, error: "Chemin du PDF source manquant." };
    }
    if (!outputPath) {
      logSave("export_abort", { reason: "no_output_path" });
      return { ok: false, error: "Chemin de sortie manquant." };
    }

    logSave("export_start", {
      inputPath: tab.path,
      outputPath,
      annotationCount: countAnnotationsByPage(tab.annotationsByPage),
      pageRotations: tab.pageRotationsByPage || {},
      currentPage: tab.currentPage || 1
    });

    const pythonReady = await waitForPythonService();
    if (!pythonReady?.ok) {
      logSave("export_abort", { reason: "python_unavailable", error: pythonReady?.error });
      return { ok: false, error: pythonReady?.error || "Service Python indisponible." };
    }

    try {
      await d.syncOpenPdfPathsToMain?.();
    } catch {
      /* ignore */
    }

    let canvases;
    let annotationsByPage;
    try {
      ({ canvases, annotationsByPage } = await prepareExportPayload(tab));
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg === "image_encode_failed") {
        return { ok: false, error: "image_encode_failed" };
      }
      return { ok: false, error: msg };
    }

    logSave("export_ipc", {
      inputPath: tab.path,
      outputPath,
      pages: Object.keys(canvases).length,
      annotationCount: countAnnotationsByPage(annotationsByPage)
    });

    const exportResult = await window.maniPdfApi.exportPdfWithAnnotations({
      input_path: tab.path,
      output_path: outputPath,
      canvases_px_by_page: canvases,
      annotations_by_page: annotationsByPage
    });

    logSave("export_result", {
      ok: Boolean(exportResult?.ok),
      error: exportResult?.error || null,
      outputPath
    });

    return exportResult;
  }

  function applySaveExportSuccess(tab, outputPath) {
    const d = requireDeps();
    if (!tab) return;
    try {
      tab.dirty = false;
    } catch {
      /* ignore */
    }
    const out = String(outputPath || "").trim();
    if (!out || !tab.path) return;
    if (!d.pathsEqual(out, tab.path)) return;
    d.invalidatePdfRenderCache([tab.path, out]);
    d.updateViewer();
  }

  async function savePdfAs() {
    const d = requireDeps();
    logSave("save_start", {});
    try {
      const tab = d.getActiveTab();
      if (!tab) {
        logSave("save_abort", { reason: "no_active_pdf" });
        d.setStatus(d.t("stSaveAsNoPdf"));
        return;
      }

      const suggested = buildSuggestedSaveAsPath(tab);
      logSave("dialog_request", { suggested, inputPath: tab.path });
      const r = await window.maniPdfApi.savePdfAsDialog(suggested);
      if (!r?.ok) {
        if (!r?.cancelled) {
          logSave("dialog_error", { error: r?.error || "cancelled" });
          d.setStatus(r?.error || d.t("stSaveAsCancelled"));
        } else {
          logSave("dialog_cancelled", {});
        }
        return;
      }

      logSave("dialog_ok", { outputPath: r.path });
      d.setStatus(d.t("stExporting"));
      const exportResult = await exportActivePdfToPath(r.path);
      if (exportResult?.ok) {
        logSave("save_success", { outputPath: r.path });
        d.setStatus(d.t("stExported"));
        applySaveExportSuccess(tab, r.path);
      } else if (exportResult?.error === "image_encode_failed") {
        logSave("save_fail", { reason: "image_encode_failed" });
        d.setStatus(d.t("stExportImageEncodeFailed"));
      } else {
        const err = exportResult?.error || d.t("stExportFailed");
        logSave("save_fail", { reason: "export_failed", error: err });
        d.setStatus(err);
      }
    } catch (error) {
      const err = String(error?.message || error);
      logSave("save_exception", { error: err });
      d.setStatus(`Enregistrement impossible: ${err}`);
    }
  }

  window.__editifyPdfSave = {
    bind,
    savePdfAs,
    exportActivePdfToPath,
    peekExportPayloadForTest,
    readImageFileAsBase64,
    logSave,
    logExportAudit
  };
})();
