import type {
  AnnotationBox,
  GeometryDeps,
  GeometryPort,
  PageKey,
  TabGeometryHost,
  ZoneSize
} from "./geometry-port.js";

export type { GeometryPort, GeometryDeps, ZoneSize, AnnotationBox };

declare global {
  interface Window {
    __editifyGeometry?: GeometryPort;
  }
}

/**
 * Géométrie / safe-zone — source TypeScript (P4).
 * Artefact commité : `renderer-geometry.js` (IIFE), régénéré via `npm run build:geometry`.
 */
(function () {
  "use strict";

  let deps: GeometryDeps | null = null;

  function requireDeps(): GeometryDeps {
    if (!deps) {
      throw new Error("[editify] renderer-geometry.js : appeler bind() avant usage.");
    }
    return deps;
  }

  function bind(next: GeometryDeps): void {
    deps = next;
  }

  function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function getSafeZoneSize(): ZoneSize {
    const d = requireDeps();
    const canvas = d.pdfLayerRef.pdfCanvas;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      return { width: canvas.width, height: canvas.height };
    }
    const rect = d.pdfLayerRef.annotationLayer?.getBoundingClientRect?.();
    if (!rect) return { width: 0, height: 0 };
    return {
      width: Math.max(0, Math.floor(rect.width)),
      height: Math.max(0, Math.floor(rect.height))
    };
  }

  /** Zone canvas d'une page précise (export multi-pages — ne pas utiliser la page active). */
  function getSafeZoneSizeForPage(
    tab: TabGeometryHost | null | undefined,
    pageKey: PageKey | number,
    canvases?: Record<PageKey, { w: number; h: number }>
  ): ZoneSize {
    const d = requireDeps();
    const key = String(pageKey || 1);
    const meta = canvases?.[key];
    if (meta && meta.w > 0 && meta.h > 0) {
      return { width: meta.w, height: meta.h };
    }
    const vp = tab?.viewportByPage?.[key];
    if (vp && vp.width > 0 && vp.height > 0) {
      return { width: vp.width, height: vp.height };
    }
    const pageNode = d.pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
    const canvas = pageNode?.querySelector?.("canvas.pdf-canvas") as HTMLCanvasElement | null;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      return { width: canvas.width, height: canvas.height };
    }
    return getSafeZoneSize();
  }

  /** Lit la géométrie DOM d'une annotation (repère canvas interne) — diagnostic export. */
  function readAnnotationGeometryFromDom(
    node: Element | null,
    canvas: HTMLCanvasElement | null
  ): { x: number; y: number; w: number; h: number } | null {
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

  function fitAnnotationToSafeZone(item: AnnotationBox, zone: ZoneSize): void {
    const d = requireDeps();
    const SHAPE_TYPES = d.SHAPE_TYPES;
    const logText = d.logText;
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

  function scaleAnnotationsForZoneChange(tab: TabGeometryHost | null, zone: ZoneSize): boolean {
    if (!tab) return false;
    const pageKey = String(tab.currentPage || 1);
    return scaleAnnotationsForPage(tab, zone, pageKey);
  }

  function scaleAnnotationsForPage(
    tab: TabGeometryHost | null,
    zone: ZoneSize,
    pageKey: PageKey | number
  ): boolean {
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

  function enforceSafeZoneForActiveTab(): void {
    const d = requireDeps();
    const tab = d.getActiveTab();
    if (!tab) return;
    const zone = getSafeZoneSize();
    const annotations = d.currentPageAnnotations(tab);
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
      d.syncPropertyInputs();
      d.renderAnnotations();
    }
  }

  const api: GeometryPort = {
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

  window.__editifyGeometry = api;
})();
