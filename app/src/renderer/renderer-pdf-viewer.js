/**
 * Visionneuse PDF (pdf.js), zoom, calques page, DnD overlay.
 * `window.__editifyPdfViewer` - `bind()` depuis `renderer.js` juste après `__editifySidebars.bind()`, avant `session.bind()`.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} PdfLayerRef
   * @property {HTMLElement | null} annotationLayer
   * @property {HTMLElement | null} dropOverlay
   * @property {HTMLCanvasElement | null} pdfCanvas
   */

  /**
   * @typedef {object} PdfViewerDeps
   * @property {{ tabs: unknown[], activeTabId: unknown, zoomScale?: number }} state
   * @property {PdfLayerRef} layerRef
   * @property {HTMLElement | null} viewer
   * @property {HTMLElement | null} pagesContainer
   * @property {HTMLElement | null} pageInfo
   * @property {HTMLElement | null} zoomInfo
   * @property {HTMLElement | null} zoomOutBtn
   * @property {HTMLElement | null} zoomInBtn
   * @property {() => unknown | null} getActiveTab
   * @property {(key: string) => string} t
   * @property {(key: string, vars: Record<string, string>) => string} tr
   * @property {(msg: string) => void} setStatus
   * @property {(n: number, min: number, max: number) => number} clamp
   * @property {() => void} enforceSafeZoneForActiveTab
   * @property {() => void} renderAnnotations
   * @property {() => boolean} [shouldPauseScrollPageSync]
   * @property {() => void} scheduleSidebarUpdate
   */

  /** @type {PdfViewerDeps | null} */
  let deps = null;

  let pendingZoomAnchor = null;
  let activePdfRenderToken = 0;
  /** @type {unknown[]} */
  let activePdfRenderTasks = [];
  let scrollPageSyncTimer = null;
  let suppressScrollPageSync = false;

  const pdfRenderCache = {
    path: /** @type {string | null} */ (null),
    base64: /** @type {string | null} */ (null),
    doc: /** @type {unknown} */ (null)
  };

  /** @returns {PdfViewerDeps} */
  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyPdfViewer.bind() doit être appelé depuis renderer.js après __editifySidebars.bind() et avant __editifySession.bind()."
      );
    }
    return deps;
  }

  /** @param {PdfViewerDeps} next */
  function bind(next) {
    deps = next;
  }

  function captureZoomAnchor() {
    const d = requireDeps();
    const v = d.viewer;
    if (!v) return null;
    return {
      centerX: (v.scrollLeft || 0) + v.clientWidth / 2,
      centerY: (v.scrollTop || 0) + v.clientHeight / 2,
      prevScrollW: v.scrollWidth || 0,
      prevScrollH: v.scrollHeight || 0
    };
  }

  function applyZoomAnchorIfAny() {
    const d = requireDeps();
    const viewer = d.viewer;
    if (!pendingZoomAnchor || !viewer) return;
    const { centerX, centerY, prevScrollW, prevScrollH } = pendingZoomAnchor;
    pendingZoomAnchor = null;
    const nextScrollW = viewer.scrollWidth || 0;
    const nextScrollH = viewer.scrollHeight || 0;
    if (prevScrollW <= 0 || prevScrollH <= 0 || nextScrollW <= 0 || nextScrollH <= 0) return;

    const rx = nextScrollW / prevScrollW;
    const ry = nextScrollH / prevScrollH;
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;

    const targetCenterX = centerX * rx;
    const targetCenterY = centerY * ry;
    const nextLeft = targetCenterX - viewer.clientWidth / 2;
    const nextTop = targetCenterY - viewer.clientHeight / 2;

    viewer.scrollLeft = Math.max(
      0,
      Math.min(nextLeft, Math.max(0, nextScrollW - viewer.clientWidth))
    );
    viewer.scrollTop = Math.max(
      0,
      Math.min(nextTop, Math.max(0, nextScrollH - viewer.clientHeight))
    );
  }

  function resolveDominantVisiblePage() {
    const d = requireDeps();
    const { viewer, pagesContainer } = d;
    if (!viewer || !pagesContainer) return null;

    const viewRect = viewer.getBoundingClientRect();
    const viewHeight = viewRect.height;
    if (viewHeight <= 0) return null;

    let bestPage = null;
    let bestRatio = 0;
    pagesContainer.querySelectorAll(".pdf-page").forEach((pageNode) => {
      const rect = pageNode.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewRect.top);
      const visibleBottom = Math.min(rect.bottom, viewRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const ratio = visibleHeight / viewHeight;
      const pageNumber = Number(pageNode.dataset.page) || 1;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestPage = pageNumber;
      }
    });

    if (bestRatio > 0.5 && bestPage !== null) return bestPage;
    return null;
  }

  function syncActivePageFromScroll() {
    if (suppressScrollPageSync) return;
    const d = requireDeps();
    if (d.shouldPauseScrollPageSync?.()) return;
    const tab = d.getActiveTab();
    if (!tab) return;
    const page = resolveDominantVisiblePage();
    if (page == null || page === tab.currentPage) return;
    setActivePage(page);
  }

  /** Pause la synchro scroll → page (ex. scrollIntoView programmé). */
  function runWithScrollSyncPaused(fn) {
    suppressScrollPageSync = true;
    try {
      fn();
    } finally {
      setTimeout(() => {
        suppressScrollPageSync = false;
      }, 220);
    }
  }

  function wireScrollPageSync() {
    const d = requireDeps();
    const viewer = d.viewer;
    if (!viewer || viewer.dataset.scrollPageSync === "1") return;
    viewer.dataset.scrollPageSync = "1";
    viewer.addEventListener(
      "scroll",
      () => {
        if (scrollPageSyncTimer) clearTimeout(scrollPageSyncTimer);
        scrollPageSyncTimer = setTimeout(() => {
          scrollPageSyncTimer = null;
          syncActivePageFromScroll();
        }, 80);
      },
      { passive: true }
    );
  }

  function updateViewer() {
    const d = requireDeps();
    const { pagesContainer, pageInfo, t, setStatus } = d;
    const tab = d.getActiveTab();
    if (!tab) {
      if (pagesContainer) pagesContainer.innerHTML = "";
      if (pageInfo) pageInfo.textContent = t("noPdf");
      return;
    }
    renderPdfDocument(tab.path).catch((error) => {
      try {
        globalThis.__editifyReportError?.("pdf:render", error?.message || String(error), {
          path: tab.path
        });
      } catch {
        /* ignore */
      }
      setStatus(t("stPdfRenderError"));
    });
    syncPageInfoFooter(tab.currentPage || 1);
  }

  async function paintPdfPageOnNode(page, pageNumber, pageNode, tab, containerWidth) {
    const pageKey = String(pageNumber);
    const intrinsic = page.rotate || 0;
    const userDelta = getUserPageRotation(tab, pageKey, intrinsic);
    const absRot = getAbsolutePageRotation(tab, pageKey, intrinsic);

    const d = requireDeps();
  // pdf.js : rotation = angle total affiché (défaut page.rotate), pas un delta additif.
    const baseViewport = page.getViewport({ scale: 1, rotation: absRot });
    const baseScale = containerWidth / baseViewport.width;
    const scale = baseScale * (d.state.zoomScale || 1);
    const viewport = page.getViewport({
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      rotation: absRot
    });

    pageNode.dataset.intrinsicRotation = String(normalizePageRotation(intrinsic));
    pageNode.dataset.rotation = String(absRot);
    pageNode.dataset.userRotation = String(userDelta);

    let canvas = pageNode.querySelector("canvas.pdf-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "pdf-canvas";
      pageNode.appendChild(canvas);
    }
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    pageNode.style.width = `${canvas.width}px`;
    pageNode.style.height = `${canvas.height}px`;

    const ctx = canvas.getContext("2d", { alpha: false });
    const task = page.render({ canvasContext: ctx, viewport });
    activePdfRenderTasks.push(task);
    try {
      await task.promise;
    } finally {
      activePdfRenderTasks = activePdfRenderTasks.filter((tk) => tk !== task);
    }
    return canvas;
  }

  async function rerenderPage(pageNumber) {
    const d = requireDeps();
    const tab = d.getActiveTab();
    if (!tab?.path || !d.pagesContainer) return;
    const pageNode = d.pagesContainer.querySelector(`.pdf-page[data-page="${pageNumber}"]`);
    if (!pageNode) return;

    const doc = await loadPdfDocument(tab.path);
    const page = await doc.getPage(pageNumber);
    const containerWidth = Math.max(1, Math.floor((d.viewer?.clientWidth || 1) - 24));
    const canvas = await paintPdfPageOnNode(page, pageNumber, pageNode, tab, containerWidth);

    const pageKey = String(pageNumber);
    if (!tab.viewportByPage) tab.viewportByPage = {};
    if (canvas) {
      tab.viewportByPage[pageKey] = { width: canvas.width, height: canvas.height };
    }

    if (tab.currentPage === pageNumber) {
      syncPageInfoFooter(pageNumber);
      ensureOverlaysOn(pageNode);
      const lr = d.layerRef;
      lr.pdfCanvas = canvas;
      if (lr.annotationLayer) {
        lr.annotationLayer.style.width = `${canvas.width}px`;
        lr.annotationLayer.style.height = `${canvas.height}px`;
      }
      if (lr.dropOverlay) {
        lr.dropOverlay.style.width = `${canvas.width}px`;
        lr.dropOverlay.style.height = `${canvas.height}px`;
      }
      d.enforceSafeZoneForActiveTab();
      d.renderAnnotations();
    }
    d.scheduleSidebarUpdate();
  }

  async function rerenderPages(pageNumbers) {
    for (const n of pageNumbers) {
      await rerenderPage(n);
    }
  }

  function clampZoomScale(value) {
    const d = requireDeps();
    return d.clamp(Number(value) || 1, 0.25, 4);
  }

  function updateZoomUI() {
    const d = requireDeps();
    if (!d.zoomInfo) return;
    const pct = Math.round((d.state.zoomScale || 1) * 100);
    d.zoomInfo.textContent = `${pct}%`;
  }

  function setZoomScale(next) {
    const d = requireDeps();
    const prev = d.state.zoomScale || 1;
    pendingZoomAnchor = captureZoomAnchor();
    d.state.zoomScale = clampZoomScale(next);
    if (prev === d.state.zoomScale) return;
    updateZoomUI();

    if (d.getActiveTab()) updateViewer();
  }

  function zoomByWheelDelta(deltaY) {
    const direction = deltaY < 0 ? 1 : -1;
    const step = 1.1;
    const d = requireDeps();
    const next = (d.state.zoomScale || 1) * (direction > 0 ? step : 1 / step);
    setZoomScale(next, "ctrl+wheel");
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function getPdfJs() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 2500) {
      const lib = window.pdfjsLib;
      if (lib) return lib;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("pdfjsLib non chargé (pdfjs-bridge.mjs).");
  }

  async function loadPdfDocument(pdfPath) {
    const key = String(pdfPath || "");
    if (pdfRenderCache.path === key && pdfRenderCache.doc) return pdfRenderCache.doc;
    const pdfjs = await getPdfJs();
    const read = await window.maniPdfApi.readPdfBytes(key);
    if (!read.ok) throw new Error(read.error || "Lecture PDF impossible.");
    const data = base64ToUint8Array(read.base64);
    const loadingTask = pdfjs.getDocument({ data, disableFontFace: true });
    const doc = await loadingTask.promise;
    pdfRenderCache.path = key;
    pdfRenderCache.base64 = read.base64;
    pdfRenderCache.doc = doc;
    return doc;
  }

  /** Invalide le cache pdf.js pour forcer une relecture disque après export / écrasement. */
  function invalidatePdfRenderCache(paths) {
    const norm = (p) => String(p || "").trim().replace(/\//g, "\\").toLowerCase();
    const targets = new Set((paths || []).map(norm).filter(Boolean));
    if (!targets.size || !pdfRenderCache.path) return;
    if (!targets.has(norm(pdfRenderCache.path))) return;
    try {
      pdfRenderCache.doc?.destroy?.();
    } catch {
      /* ignore */
    }
    pdfRenderCache.path = null;
    pdfRenderCache.base64 = null;
    pdfRenderCache.doc = null;
  }

  function ensureOverlaysOn(pageNode) {
    if (!pageNode) return;
    const d = requireDeps();
    const lr = d.layerRef;
    if (!lr.annotationLayer) {
      lr.annotationLayer = document.createElement("div");
      lr.annotationLayer.id = "annotationLayer";
    }
    if (!lr.dropOverlay) {
      lr.dropOverlay = document.createElement("div");
      lr.dropOverlay.id = "dropOverlay";
      lr.dropOverlay.setAttribute("aria-hidden", "true");
    }
    pageNode.appendChild(lr.annotationLayer);
    pageNode.appendChild(lr.dropOverlay);
    attachDropOverlayListeners(lr.dropOverlay);
  }

  function normalizePageRotation(deg) {
    const n = Number(deg) || 0;
    return ((Math.round(n) % 360) + 360) % 360;
  }

  function getUserPageRotation(tab, pageKey, intrinsicRotate) {
    if (!tab?.pageRotationsByPage) return 0;
    if (tab.pageRotationsByPage[pageKey] === undefined) return 0;
    const intrinsic = normalizePageRotation(intrinsicRotate);
    const stored = normalizePageRotation(tab.pageRotationsByPage[pageKey]);
    // Anciennes sessions : /Rotate PDF confondu avec rotation utilisateur
    if (stored === intrinsic) {
      delete tab.pageRotationsByPage[pageKey];
      return 0;
    }
    return stored;
  }

  function getAbsolutePageRotation(tab, pageKey, intrinsicRotate) {
    const intrinsic = normalizePageRotation(intrinsicRotate);
    const userDelta = getUserPageRotation(tab, pageKey, intrinsic);
    return normalizePageRotation(intrinsic + userDelta);
  }

  function formatPageInfoLabel(pageNumber, userRotationDeg) {
    const d = requireDeps();
    const userRot = normalizePageRotation(userRotationDeg);
    if (userRot === 0) {
      return `${d.t("pageWord")} ${pageNumber}`;
    }
    return d.tr("pageInfoLine", { page: String(pageNumber), deg: String(userRot) });
  }

  function syncPageInfoFooter(pageNumber) {
    const d = requireDeps();
    const tab = d.getActiveTab();
    if (!d.pageInfo || !tab) return;
    const pageKey = String(pageNumber);
    const pageNode = d.pagesContainer?.querySelector?.(`.pdf-page[data-page="${pageKey}"]`);
    const intrinsic = Number(pageNode?.dataset?.intrinsicRotation) || 0;
    const userRot = getUserPageRotation(tab, pageKey, intrinsic);
    d.pageInfo.textContent = formatPageInfoLabel(pageNumber, userRot);
  }

  function setActivePage(pageNumber) {
    const d = requireDeps();
    const tab = d.getActiveTab();
    const { pagesContainer, layerRef: lr } = d;
    if (!tab || !pagesContainer) return;
    tab.currentPage = pageNumber;
    syncPageInfoFooter(pageNumber);

    pagesContainer.querySelectorAll(".pdf-page").forEach((p) => p.classList.remove("active"));
    const active = pagesContainer.querySelector(`.pdf-page[data-page="${pageNumber}"]`);
    if (active) active.classList.add("active");

    ensureOverlaysOn(active);
    lr.pdfCanvas = active?.querySelector?.("canvas") || null;

    if (lr.pdfCanvas && lr.annotationLayer) {
      lr.annotationLayer.style.width = `${lr.pdfCanvas.width}px`;
      lr.annotationLayer.style.height = `${lr.pdfCanvas.height}px`;
    }
    if (lr.pdfCanvas && lr.dropOverlay) {
      lr.dropOverlay.style.width = `${lr.pdfCanvas.width}px`;
      lr.dropOverlay.style.height = `${lr.pdfCanvas.height}px`;
    }

    d.enforceSafeZoneForActiveTab();
    d.renderAnnotations();
    d.scheduleSidebarUpdate();
  }

  async function renderPdfDocument(pdfPath) {
    const d = requireDeps();
    const { pagesContainer, viewer, setStatus, tr, t, scheduleSidebarUpdate, getActiveTab } = d;
    if (!pagesContainer) return;
    const tab = getActiveTab();
    if (!tab) return;

    activePdfRenderToken += 1;
    const token = activePdfRenderToken;
    try {
      activePdfRenderTasks.forEach((task) => task?.cancel?.());
    } catch {
      /* ignore */
    }
    activePdfRenderTasks = [];

    const doc = await loadPdfDocument(pdfPath);
    const count = doc.numPages || 1;
    tab.pageCount = count;
    const containerWidth = Math.max(1, Math.floor((viewer?.clientWidth || 1) - 24));

    pagesContainer.innerHTML = "";
    try {
      setStatus(tr("stRendering", { a: "0", b: String(count) }));
    } catch {
      /* ignore */
    }
    let lastProgressAt = 0;

    for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
      if (token !== activePdfRenderToken) return;
      const now = Date.now();
      if (pageNumber === 1 || pageNumber === count || now - lastProgressAt > 140) {
        lastProgressAt = now;
        try {
          setStatus(tr("stRendering", { a: String(pageNumber), b: String(count) }));
        } catch {
          /* ignore */
        }
      }
      const page = await doc.getPage(pageNumber);

      const pageNode = document.createElement("div");
      pageNode.className = "pdf-page";
      pageNode.dataset.page = String(pageNumber);

      pageNode.addEventListener("mousedown", () => setActivePage(pageNumber));

      pagesContainer.appendChild(pageNode);

      await paintPdfPageOnNode(page, pageNumber, pageNode, tab, containerWidth);
    }

    setActivePage(tab.currentPage || 1);
    applyZoomAnchorIfAny();
    scheduleSidebarUpdate();
    syncActivePageFromScroll();
    if (token !== activePdfRenderToken) return;
    try {
      setStatus(t("stPdfLoadedHint"));
    } catch {
      /* ignore */
    }
  }

  function insertTextAtCaret(text) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function trySetCaretFromPoint(container, clientX, clientY) {
    if (!container) return false;
    try {
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(clientX, clientY);
        if (!pos) return false;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function attachDropOverlayListeners(node) {
    if (!node || !node.addEventListener) return;
    if (node.dataset?.dndAttached === "1") return;
    const d = requireDeps();
    if (!d.layerRef.annotationLayer) return;
    node.dataset.dndAttached = "1";

    const allowDrop = (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const overlayAllow = (event) => {
      allowDrop(event);
      const active = Boolean(d.state.editingAnnotationId);
      if (!active) return;
    };

    node.addEventListener("dragenter", overlayAllow, true);
    node.addEventListener("dragover", overlayAllow, true);
    node.addEventListener(
      "drop",
      (event) => {
        allowDrop(event);
        const textPlain = event.dataTransfer?.getData("text/plain") || "";
        const text = textPlain.trim();

        if (!d.state.editingAnnotationId) return;
        const editingNode = d.layerRef.annotationLayer?.querySelector?.(
          `[data-id="${d.state.editingAnnotationId}"]`
        );
        if (!editingNode) return;
        editingNode.focus();
        trySetCaretFromPoint(editingNode, event.clientX, event.clientY);
        if (text) insertTextAtCaret(text);
      },
      true
    );
  }

  function setupDragAndDrop() {
    try {
      const allowDrop = (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      };

      let dragDepth = 0;

      document.addEventListener(
        "dragenter",
        (event) => {
          dragDepth += 1;
          allowDrop(event);
          if (dragDepth === 1) {
            document.body.classList.add("dnd-active");
          }
        },
        true
      );
      document.addEventListener(
        "dragover",
        (event) => {
          allowDrop(event);
        },
        true
      );
      document.addEventListener(
        "dragleave",
        (event) => {
          event.preventDefault();
          dragDepth = Math.max(0, dragDepth - 1);
          if (dragDepth === 0) {
            document.body.classList.remove("dnd-active");
          }
        },
        true
      );
      document.addEventListener(
        "drop",
        (event) => {
          allowDrop(event);
          dragDepth = 0;
          document.body.classList.remove("dnd-active");
        },
        true
      );
    } catch {
      /* ignore */
    }
  }

  function wireResize() {
    window.addEventListener("resize", () => {
      if (window.__maniPdfResizeDebounce) clearTimeout(window.__maniPdfResizeDebounce);
      window.__maniPdfResizeDebounce = setTimeout(() => {
        const d = requireDeps();
        if (!d.getActiveTab()) return;
        updateViewer();
      }, 120);
    });
  }

  function wireWheel() {
    window.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey) return;
        const inViewer = event.target?.closest?.(".viewer");
        if (!inViewer) return;
        event.preventDefault();
        zoomByWheelDelta(event.deltaY);
      },
      { passive: false }
    );
  }

  function wireZoomButtons() {
    const d = requireDeps();
    const { zoomOutBtn, zoomInBtn, state } = d;
    zoomOutBtn?.addEventListener?.("click", () =>
      setZoomScale((state.zoomScale || 1) / 1.1, "btn-")
    );
    zoomInBtn?.addEventListener?.("click", () =>
      setZoomScale((state.zoomScale || 1) * 1.1, "btn+")
    );
  }

  async function convertCanvasRectToPdfUser(pdfPath, pageNumber, rect, canvasW, canvasH) {
    void canvasH;
    const doc = await loadPdfDocument(pdfPath);
    const page = await doc.getPage(pageNumber);
    const intrinsic = page.rotate || 0;
    const tab = requireDeps().getActiveTab?.();
    const pageKey = String(pageNumber);
    const absRot = tab
      ? getAbsolutePageRotation(tab, pageKey, intrinsic)
      : normalizePageRotation(intrinsic);
    const baseVp = page.getViewport({ scale: 1, rotation: absRot });
    const scale = canvasW > 0 && baseVp.width > 0 ? canvasW / baseVp.width : 1;
    const viewport = page.getViewport({
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      rotation: absRot
    });

    const x1 = Number(rect?.x) || 0;
    const y1 = Number(rect?.y) || 0;
    const x2 = x1 + (Number(rect?.w) || 0);
    const y2 = y1 + (Number(rect?.h) || 0);

    const origin = viewport.convertToPdfPoint(x1, y1);
    const topRight = viewport.convertToPdfPoint(x2, y1);
    const bottomLeft = viewport.convertToPdfPoint(x1, y2);

    return {
      x: origin[0],
      y: origin[1],
      canvas_w: Number(rect?.w) || 0,
      canvas_h: Number(rect?.h) || 0,
      pdf_ex: [topRight[0] - origin[0], topRight[1] - origin[1]],
      pdf_ey: [bottomLeft[0] - origin[0], bottomLeft[1] - origin[1]]
    };
  }

  window.__editifyPdfViewer = {
    bind,
    wireResize,
    wireWheel,
    wireZoomButtons,
    wireScrollPageSync,
    setupDragAndDrop,
    updateViewer,
    setActivePage,
    setZoomScale,
    updateZoomUI,
    zoomByWheelDelta,
    runWithScrollSyncPaused,
    invalidatePdfRenderCache,
    convertCanvasRectToPdfUser,
    rerenderPage,
    rerenderPages,
    syncPageInfoFooter,
    formatPageInfoLabel,
    getUserPageRotation
  };
})();
