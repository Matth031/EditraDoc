/**
 * P6 Lot A — unitaires purs sur GeometryPort (IIFE générée), sans Electron/DOM réel.
 * Chargement via vm (même pattern que i18n-parity).
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const GEOMETRY_PATH = path.join(__dirname, "../src/renderer/renderer-geometry.js");

/**
 * @returns {import("../src/renderer/ts/geometry/geometry-port").GeometryPort}
 */
function loadGeometry() {
  const src = fs.readFileSync(GEOMETRY_PATH, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(src, context, { filename: GEOMETRY_PATH });
  const api = context.window.__editifyGeometry;
  assert.ok(api && typeof api.bind === "function", "window.__editifyGeometry attendu");
  return api;
}

/**
 * @param {ReturnType<typeof loadGeometry>} geo
 * @param {Partial<{ SHAPE_TYPES: Set<string> }>} [extra]
 */
function bindMinimal(geo, extra = {}) {
  const logs = [];
  geo.bind({
    pdfLayerRef: { pdfCanvas: null, annotationLayer: null },
    pagesContainer: null,
    SHAPE_TYPES: extra.SHAPE_TYPES || new Set(["rect", "ellipse", "line"]),
    logText: (scope, data) => {
      logs.push({ scope, data });
    },
    getActiveTab: () => null,
    currentPageAnnotations: () => [],
    syncPropertyInputs: () => {},
    renderAnnotations: () => {}
  });
  return logs;
}

describe("P6 F04 geometry (unit)", () => {
  it("clamp : bornes, inversion max<min, identité dans l'intervalle", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    assert.equal(geo.clamp(5, 0, 10), 5);
    assert.equal(geo.clamp(-1, 0, 10), 0);
    assert.equal(geo.clamp(99, 0, 10), 10);
    assert.equal(geo.clamp(3, 5, 2), 5);
  });

  it("fitAnnotationToSafeZone : texte min 20×20, clamp dans la zone", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    const item = { type: "text", x: -10, y: -5, w: 5, h: 5, id: "t1" };
    geo.fitAnnotationToSafeZone(item, { width: 200, height: 100 });
    assert.equal(item.w, 20);
    assert.equal(item.h, 20);
    assert.equal(item.x, 0);
    assert.equal(item.y, 0);
  });

  it("fitAnnotationToSafeZone : forme min 1×1 (SHAPE_TYPES)", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    const item = { type: "rect", x: 0, y: 0, w: 0.5, h: 0.5, id: "r1" };
    geo.fitAnnotationToSafeZone(item, { width: 100, height: 80 });
    assert.equal(item.w, 1);
    assert.equal(item.h, 1);
  });

  it("fitAnnotationToSafeZone : débordement → ramené dans zone", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    const item = { type: "text", x: 180, y: 90, w: 50, h: 40, id: "t2" };
    geo.fitAnnotationToSafeZone(item, { width: 200, height: 100 });
    assert.equal(item.w, 50);
    assert.equal(item.h, 40);
    assert.equal(item.x, 150);
    assert.equal(item.y, 60);
  });

  it("getSafeZoneSizeForPage : priorité canvases puis viewport (sans DOM)", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    const fromCanvas = geo.getSafeZoneSizeForPage(null, 2, { 2: { w: 300, h: 400 } });
    // Comparaison champ-à-champ : objets créés dans le vm (autre realm).
    assert.equal(fromCanvas.width, 300);
    assert.equal(fromCanvas.height, 400);

    const tab = { viewportByPage: { 1: { width: 111, height: 222 } } };
    const fromVp = geo.getSafeZoneSizeForPage(tab, 1, {});
    assert.equal(fromVp.width, 111);
    assert.equal(fromVp.height, 222);
  });

  it("scaleAnnotationsForPage : scale + fit ; false si viewport inchangé", () => {
    const geo = loadGeometry();
    bindMinimal(geo);
    const tab = {
      viewportByPage: { 1: { width: 100, height: 100 } },
      annotationsByPage: {
        1: [{ type: "text", x: 10, y: 10, w: 20, h: 20, fontSize: 14, padding: 6, id: "s1" }]
      }
    };
    assert.equal(geo.scaleAnnotationsForPage(tab, { width: 100, height: 100 }, 1), false);

    const scaled = geo.scaleAnnotationsForPage(tab, { width: 200, height: 200 }, 1);
    assert.equal(scaled, true);
    const item = tab.annotationsByPage["1"][0];
    assert.equal(item.x, 20);
    assert.equal(item.y, 20);
    assert.equal(item.w, 40);
    assert.equal(item.h, 40);
    assert.equal(item.fontSize, 28);
    assert.equal(tab.viewportByPage["1"].width, 200);
  });

  it("moduleId : artefact geometry", () => {
    const geo = loadGeometry();
    assert.equal(geo.moduleId, "renderer-geometry");
  });
});
