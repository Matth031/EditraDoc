"use strict";

/**
 * Transformations géométriques pour la rotation de page (origine haut-gauche, Y vers le bas).
 * Partagé entre le renderer (via window) et les tests Node.
 */

function normalizeRotation(deg) {
  const n = Number(deg) || 0;
  return ((Math.round(n) % 360) + 360) % 360;
}

/**
 * @param {Record<string, unknown>} item
 * @param {number} deltaDeg 90 | 180 | 270 (sens horaire positif)
 * @param {number} canvasW
 * @param {number} canvasH
 */
function rotateAnnotationBox(item, deltaDeg, canvasW, canvasH) {
  const delta = normalizeRotation(deltaDeg);
  if (delta === 0) return { ...item };

  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  const w = Number(item.w) || 0;
  const h = Number(item.h) || 0;
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;

  if (delta === 90) {
    nx = y;
    ny = canvasW - x - w;
    nw = h;
    nh = w;
  } else if (delta === 180) {
    nx = canvasW - x - w;
    ny = canvasH - y - h;
  } else if (delta === 270) {
    nx = canvasH - y - h;
    ny = x;
    nw = h;
    nh = w;
  }

  const copy = { ...item, x: nx, y: ny, w: nw, h: nh };
  copy.rotation = normalizeRotation((Number(item.rotation) || 0) + delta);
  return copy;
}

/**
 * @param {Record<string, unknown>[]} annotations
 * @param {number} deltaDeg
 * @param {number} canvasW
 * @param {number} canvasH
 */
function rotateAnnotationsOnPage(annotations, deltaDeg, canvasW, canvasH) {
  const delta = normalizeRotation(deltaDeg);
  if (!delta || !Array.isArray(annotations) || !annotations.length) {
    return Array.isArray(annotations) ? annotations.map((a) => ({ ...a })) : [];
  }
  if (canvasW <= 0 || canvasH <= 0) {
    return annotations.map((a) => ({ ...a }));
  }
  return annotations.map((item) => rotateAnnotationBox(item, delta, canvasW, canvasH));
}

/**
 * Applique une série de rotations successives (ex. 0→90→180→270).
 * @param {Record<string, unknown>} item
 * @param {number[]} deltasDeg
 * @param {number} canvasW
 * @param {number} canvasH
 */
function rotateAnnotationThroughDeltas(item, deltasDeg, canvasW, canvasH) {
  let current = { ...item };
  let w = canvasW;
  let h = canvasH;
  for (const delta of deltasDeg) {
    current = rotateAnnotationBox(current, delta, w, h);
    const d = normalizeRotation(delta);
    if (d === 90 || d === 270) {
      const tmp = w;
      w = h;
      h = tmp;
    }
  }
  return current;
}

const pageRotateMathApi = {
  normalizeRotation,
  rotateAnnotationBox,
  rotateAnnotationsOnPage,
  rotateAnnotationThroughDeltas
};

if (typeof window !== "undefined") {
  window.__editifyPageRotateMath = pageRotateMathApi;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = pageRotateMathApi;
}
