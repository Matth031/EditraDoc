/**
 * Géométrie / safe-zone : clamp, fit, scale viewport, enforce.
 * `bind()` depuis renderer.js avant textLayout.bind (getSafeZoneSize / fitAnnotationToSafeZone).
 * Hors périmètre : flèches clavier annotation (rester dans renderer.js).
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-geometry.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function getSafeZoneSize() {
    const d = requireDeps();
    const pdfLayerRef =
      /** @type {{ pdfCanvas: HTMLCanvasElement | null, annotationLayer: HTMLElement | null }} */ (
        d.pdfLayerRef
      );
    const canvas = pdfLayerRef.pdfCanvas;
    if (canvas?.width > 0 && canvas?.height > 0) {
      return { width: canvas.width, height: canvas.height };
    }
    const rect = pdfLayerRef.annotationLayer?.getBoundingClientRect?.();
    if (!rect) return { width: 0, height: 0 };
    return {
      width: Math.max(0, Math.floor(rect.width)),
      height: Math.max(0, Math.floor(rect.height))
    };
  }

  /** Zone canvas d'une page précise (export multi-pages — ne pas utiliser la page active). */
  function getSafeZoneSizeForPage(tab, pageKey, canvases) {
    const d = requireDeps();
    const pagesContainer = /** @type {HTMLElement | null} */ (d.pagesContainer);
    const key = String(pageKey || 1);
    const meta = canvases?.[key];
    if (meta?.w > 0 && meta?.h > 0) {
      return { width: meta.w, height: meta.h };
    }
    const vp = tab?.viewportByPage?.[key];
    if (vp?.width > 0 && vp?.height > 0) {
      return { width: vp.width, height: vp.height };
    }
    const pageNode = pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
    const canvas = pageNode?.querySelector?.("canvas.pdf-canvas");
    if (canvas?.width > 0 && canvas?.height > 0) {
      return { width: canvas.width, height: canvas.height };
    }
    return getSafeZoneSize();
  }

  /** Lit la géométrie DOM d'une annotation (repère canvas interne) — diagnostic export. */
  function readAnnotationGeometryFromDom(node, canvas) {
    if (!node || !canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, canvasRect.width);
    const sy = canvas.height / Math.max(1, canvasRect.height);
    return {
      x: (nodeRect.left - canvasRect.left) * sx,
      y: (nodeRect.top - canvasRect.top) * sy,
      w: nodeRect.width * sx,
      h: nodeRect.height * sy
    };
  }

  function fitAnnotationToSafeZone(item, zone) {
    const d = requireDeps();
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const logText = /** @type {(scope: string, data?: object) => void} */ (d.logText);
    // Toutes les formes géométriques : taille minimale 1×1 (aligné branche test).
    let minW = 20;
    let minH = 20;
    if (SHAPE_TYPES.has(item.type)) {
      minW = 1;
      minH = 1;
    }
    const prevW = item.w;
    const prevH = item.h;
    item.w = clamp(item.w, minW, Math.max(minW, zone.width));
    item.h = clamp(item.h, minH, Math.max(minH, zone.height));
    item.x = clamp(item.x, 0, Math.max(0, zone.width - item.w));
    item.y = clamp(item.y, 0, Math.max(0, zone.height - item.h));
    if (SHAPE_TYPES.has(item.type) && (prevW !== item.w || prevH !== item.h)) {
      try {
        logText("shapeFitZone", {
          type: item.type,
          id: item.id,
          prevW,
          prevH,
          w: item.w,
          h: item.h,
          minW,
          minH,
          zw: zone.width,
          zh: zone.height
        });
      } catch {
        /* ignore */
      }
    }
  }

  function scaleAnnotationsForZoneChange(tab, zone) {
    if (!tab) return false;
    const pageKey = String(tab.currentPage || 1);
    return scaleAnnotationsForPage(tab, zone, pageKey);
  }

  function scaleAnnotationsForPage(tab, zone, pageKey) {
    if (!tab || !zone?.width || !zone?.height) return false;
    const key = String(pageKey || 1);
    if (!tab.viewportByPage) tab.viewportByPage = {};
    const prev = tab.viewportByPage[key];
    tab.viewportByPage[key] = { width: zone.width, height: zone.height };

    if (!prev || prev.width <= 0 || prev.height <= 0) return false;
    if (prev.width === zone.width && prev.height === zone.height) return false;

    const sx = zone.width / prev.width;
    const sy = zone.height / prev.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;

    const annotations = tab.annotationsByPage?.[key] || [];
    if (!annotations.length) return false;

    annotations.forEach((item) => {
      item.x *= sx;
      item.y *= sy;
      item.w *= sx;
      item.h *= sy;
      if (item.type === "text") {
        const scale = Math.min(sx, sy);
        if (Number.isFinite(scale) && scale > 0) {
          item.fontSize = clamp((item.fontSize ?? 14) * scale, 8, 96);
          item.padding = clamp((item.padding ?? 6) * scale, 0, 64);
        }
      }
      fitAnnotationToSafeZone(item, zone);
    });
    return true;
  }

  function enforceSafeZoneForActiveTab() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
      d.currentPageAnnotations
    );
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const renderAnnotations = /** @type {() => void} */ (d.renderAnnotations);
    const tab = getActiveTab();
    if (!tab) return;
    const zone = getSafeZoneSize();
    const annotations = currentPageAnnotations(tab);
    let changed = false;
    if (scaleAnnotationsForZoneChange(tab, zone)) {
      changed = true;
    }
    annotations.forEach((item) => {
      const before = `${item.x}|${item.y}|${item.w}|${item.h}`;
      fitAnnotationToSafeZone(item, zone);
      const after = `${item.x}|${item.y}|${item.w}|${item.h}`;
      if (before !== after) changed = true;
    });
    if (changed) {
      syncPropertyInputs();
      renderAnnotations();
    }
  }

  window.__editifyGeometry = {
    bind,
    clamp,
    getSafeZoneSize,
    getSafeZoneSizeForPage,
    readAnnotationGeometryFromDom,
    fitAnnotationToSafeZone,
    scaleAnnotationsForZoneChange,
    scaleAnnotationsForPage,
    enforceSafeZoneForActiveTab,
    moduleId: "renderer-geometry"
  };
})();
