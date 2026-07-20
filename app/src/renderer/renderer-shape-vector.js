/**
 * Géométrie et rendu SVG des formes vectorielles (annotations shape).
 * Chargé avant `renderer.js` ; expose `window.__editifyShapeVector`.
 * Parité export PDF : `SHAPE_POLYGON_POINTS` ↔ `SHAPE_PCT` dans pdf_ops.py
 * (voir scripts/shape-geometry-parity.mjs).
 */
(function () {
  "use strict";

  const SHAPE_TYPES = new Set([
    "rect",
    "ellipse",
    "triangle",
    "line",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "arrow",
    "heart",
    "cross",
    "parallelogram",
    "trapezoid"
  ]);

  /** Points polygone (viewBox 0 0 100 100), alignés sur SHAPE_PCT / clip-path CSS (export PDF). */
  const SHAPE_POLYGON_POINTS = {
    triangle: "50,0 0,100 100,100",
    diamond: "50,0 100,50 50,100 0,50",
    pentagon: "50,0 95,35 78,100 22,100 5,35",
    hexagon: "25,0 75,0 100,50 75,100 25,100 0,50",
    octagon: "30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30",
    star: "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35",
    arrow: "0,35 70,35 70,15 100,50 70,85 70,65 0,65",
    // Cœur : contour polygonal stable et symétrique (approximation de courbes + "creux" en haut).
    heart:
      "50,92 62,82 74,70 84,56 90,42 88,30 80,20 68,16 58,20 50,32 42,20 32,16 20,20 12,30 10,42 16,56 26,70 38,82",
    cross: "35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35",
    parallelogram: "18,0 100,0 82,100 0,100",
    trapezoid: "18,0 82,0 100,100 0,100"
  };

  const SHAPE_DEFAULTS = {
    rect: { fillColor: "#007acc", fillAlpha: 0.2, strokeColor: "#007acc", strokeWidth: 0 },
    ellipse: { fillColor: "#ff7800", fillAlpha: 0.2, strokeColor: "#ff7800", strokeWidth: 0 },
    triangle: { fillColor: "#7d53ff", fillAlpha: 0.25, strokeColor: "#7d53ff", strokeWidth: 0 },
    line: { fillColor: "#000000", fillAlpha: 0, strokeColor: "#00a86b", strokeWidth: 3 },
    diamond: { fillColor: "#d10068", fillAlpha: 0.25, strokeColor: "#d10068", strokeWidth: 0 },
    pentagon: { fillColor: "#0077c2", fillAlpha: 0.22, strokeColor: "#0077c2", strokeWidth: 0 },
    hexagon: { fillColor: "#2e8b57", fillAlpha: 0.25, strokeColor: "#2e8b57", strokeWidth: 0 },
    octagon: { fillColor: "#d84315", fillAlpha: 0.22, strokeColor: "#d84315", strokeWidth: 0 },
    star: { fillColor: "#ffd700", fillAlpha: 0.3, strokeColor: "#d4a017", strokeWidth: 0 },
    arrow: { fillColor: "#2196f3", fillAlpha: 0.3, strokeColor: "#1976d2", strokeWidth: 0 },
    heart: { fillColor: "#e91e63", fillAlpha: 0.3, strokeColor: "#c2185b", strokeWidth: 0 },
    cross: { fillColor: "#ffc107", fillAlpha: 0.3, strokeColor: "#ff8f00", strokeWidth: 0 },
    parallelogram: {
      fillColor: "#7b1fa2",
      fillAlpha: 0.24,
      strokeColor: "#7b1fa2",
      strokeWidth: 0
    },
    trapezoid: { fillColor: "#0288d1", fillAlpha: 0.22, strokeColor: "#0288d1", strokeWidth: 0 }
  };

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * @param {string} type
   */
  function shapeStyleDefaults(type) {
    return SHAPE_DEFAULTS[type] || SHAPE_DEFAULTS.rect;
  }

  /**
   * @param {Record<string, unknown>} a
   */
  function mergeShapeStyleFields(a) {
    if (!a || !SHAPE_TYPES.has(/** @type {string} */ (a.type))) return;
    const d = shapeStyleDefaults(/** @type {string} */ (a.type));
    if (a.fillColor == null || a.fillColor === undefined) a.fillColor = d.fillColor;
    if (a.fillAlpha == null || a.fillAlpha === undefined) a.fillAlpha = d.fillAlpha;
    if (a.strokeColor == null || a.strokeColor === undefined) a.strokeColor = d.strokeColor;
    if (a.strokeWidth == null || a.strokeWidth === undefined) a.strokeWidth = d.strokeWidth;
    if (a.strokeAlpha == null || a.strokeAlpha === undefined) a.strokeAlpha = 1;
    if (a.backdropColor === undefined) a.backdropColor = null;
    if (a.backdropAlpha == null || a.backdropAlpha === undefined) a.backdropAlpha = 0;
  }

  /**
   * Opacité de remplissage par défaut après « transparent » puis nouveau choix de couleur
   * (types avec fillAlpha 0 au défaut, ex. ligne).
   * @param {string} type
   */
  function defaultShapeFillAlphaAfterClear(type) {
    let def = shapeStyleDefaults(type).fillAlpha ?? 0.3;
    if (def < 0.02) def = 0.3;
    return def;
  }

  /**
   * @param {string} hex
   * @param {number} alpha01
   */
  function hexToRgba(hex, alpha01) {
    const a = clamp(Number(alpha01) || 0, 0, 1);
    const raw = String(hex || "#000000").replace("#", "");
    const full =
      raw.length === 3
        ? raw
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : raw.slice(0, 6);
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return `rgba(0,0,0,${a})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  /**
   * Rendu forme en SVG (contour suivant la géométrie réelle, comme le PDF).
   * @param {HTMLElement} host
   * @param {Record<string, unknown>} a
   */
  function renderShapeVectorDOM(host, a) {
    host.replaceChildren();
    host.style.background = "transparent";
    host.style.border = "none";
    host.style.clipPath = "none";
    host.style.borderRadius = "0";

    const backdrop = document.createElement("div");
    backdrop.className = "shape-backdrop";
    const bdA = clamp(Number(a.backdropAlpha) || 0, 0, 1);
    const bdC = a.backdropColor;
    if (bdA > 0.001 && bdC && String(bdC).trim()) {
      backdrop.style.backgroundColor = hexToRgba(String(bdC), bdA);
    } else {
      backdrop.style.display = "none";
    }
    host.appendChild(backdrop);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("shape-svg");

    const fa = clamp(Number.isFinite(Number(a.fillAlpha)) ? Number(a.fillAlpha) : 0.3, 0, 1);
    const fillCol = /** @type {string} */ (a.fillColor || "#000000");
    const fillPaint = fa < 0.001 ? "none" : hexToRgba(fillCol, fa);

    const swPx = Math.max(0, Number(a.strokeWidth) || 0);
    const strokeA = clamp(Number.isFinite(Number(a.strokeAlpha)) ? Number(a.strokeAlpha) : 1, 0, 1);
    const strokeCol = /** @type {string} */ (a.strokeColor || "#333333");
    const strokePaint = swPx < 0.001 || strokeA < 0.001 ? "none" : hexToRgba(strokeCol, strokeA);

    /** Contour en pixels écran (pas en unités viewBox). */
    const setStrokeAttrs = (el) => {
      if (strokePaint === "none") {
        el.setAttribute("stroke", "none");
        el.setAttribute("stroke-width", "0");
        el.removeAttribute("vector-effect");
      } else {
        el.setAttribute("stroke", strokePaint);
        el.setAttribute("stroke-width", String(Math.max(0.001, swPx)));
        el.setAttribute("vector-effect", "non-scaling-stroke");
        el.setAttribute("stroke-linejoin", "round");
        el.setAttribute("stroke-linecap", "round");
      }
    };

    if (a.type === "line") {
      const swLine = Math.max(0, Number(a.strokeWidth) || 3);
      const sa = clamp(Number.isFinite(Number(a.strokeAlpha)) ? Number(a.strokeAlpha) : 1, 0, 1);
      const sc = /** @type {string} */ (a.strokeColor || "#00a86b");
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", "0");
      ln.setAttribute("y1", "12");
      ln.setAttribute("x2", "100");
      ln.setAttribute("y2", "12");
      if (sa < 0.001) {
        ln.setAttribute("stroke", "none");
        ln.setAttribute("stroke-width", "0");
      } else {
        ln.setAttribute("stroke", hexToRgba(sc, sa));
        ln.setAttribute("stroke-width", String(Math.max(0.001, swLine)));
        ln.setAttribute("vector-effect", "non-scaling-stroke");
        ln.setAttribute("stroke-linecap", "square");
      }
      svg.appendChild(ln);
    } else if (a.type === "rect") {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", "0");
      r.setAttribute("y", "0");
      r.setAttribute("width", "100");
      r.setAttribute("height", "100");
      r.setAttribute("fill", fillPaint);
      setStrokeAttrs(r);
      svg.appendChild(r);
    } else if (a.type === "ellipse") {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      el.setAttribute("cx", "50");
      el.setAttribute("cy", "50");
      el.setAttribute("rx", "50");
      el.setAttribute("ry", "50");
      el.setAttribute("fill", fillPaint);
      setStrokeAttrs(el);
      svg.appendChild(el);
    } else {
      const pts = SHAPE_POLYGON_POINTS[/** @type {string} */ (a.type)];
      if (pts) {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", pts);
        poly.setAttribute("fill", fillPaint);
        setStrokeAttrs(poly);
        svg.appendChild(poly);
      }
    }

    host.appendChild(svg);
  }

  window.__editifyShapeVector = {
    SHAPE_TYPES,
    SHAPE_POLYGON_POINTS,
    SHAPE_DEFAULTS,
    shapeStyleDefaults,
    mergeShapeStyleFields,
    defaultShapeFillAlphaAfterClear,
    hexToRgba,
    renderShapeVectorDOM
  };
})();
