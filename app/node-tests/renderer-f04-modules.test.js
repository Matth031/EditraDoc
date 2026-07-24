/**
 * P6 Lot A2 — unitaires F04 : annotation-history (snapshot/UI), shape-vector (clamp via hexToRgba),
 * keymap (isTypingContext). Pas de couverture E2E dupliquée.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "../src/renderer");

/**
 * @param {string} filename
 * @param {string} windowKey
 * @param {object} [extraGlobals]
 */
function loadIife(filename, windowKey, extraGlobals = {}) {
  const filePath = path.join(ROOT, filename);
  const src = fs.readFileSync(filePath, "utf8");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const { window } = dom;
  const context = {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    ...extraGlobals
  };
  vm.createContext(context);
  vm.runInContext(src, context, { filename: filePath });
  const api = context.window[windowKey];
  assert.ok(api, `window.${windowKey} attendu après chargement de ${filename}`);
  return { api, window, document: window.document };
}

describe("P6 F04 annotation-history (unit)", () => {
  it("captureSnapshot : empile undo, vide redo, dirty", () => {
    const { api } = loadIife("renderer-annotation-history.js", "__editifyAnnotationHistory");
    const tab = {
      annotationsByPage: { 1: [{ id: "a", type: "text", x: 1, y: 2, w: 3, h: 4 }] },
      pageRotationsByPage: {},
      pageRotationsUserTouched: {},
      undoStack: [],
      redoStack: ["stale"],
      dirty: false
    };
    api.captureSnapshot(tab);
    assert.equal(tab.undoStack.length, 1);
    assert.equal(tab.redoStack.length, 0);
    assert.equal(tab.dirty, true);
    const snap = JSON.parse(tab.undoStack[0]);
    assert.equal(snap.annotationsByPage["1"][0].id, "a");
  });

  it("applySnapshot : restaure annotations + pages rotation changées", () => {
    const { api } = loadIife("renderer-annotation-history.js", "__editifyAnnotationHistory");
    const tab = {
      annotationsByPage: { 1: [] },
      pageRotationsByPage: { 1: 0 },
      pageRotationsUserTouched: {},
      undoStack: [],
      redoStack: []
    };
    const snapshot = JSON.stringify({
      annotationsByPage: { 1: [{ id: "b", type: "text" }] },
      pageRotationsByPage: { 1: 90 },
      pageRotationsUserTouched: { 1: true }
    });
    const changed = api.applySnapshot(tab, snapshot);
    assert.equal(tab.annotationsByPage["1"][0].id, "b");
    assert.equal(tab.pageRotationsByPage["1"], 90);
    assert.ok(changed.has(1));
  });

  it("finishUndoRedoUi : IDs sélection/édition null + callbacks", () => {
    const { api } = loadIife("renderer-annotation-history.js", "__editifyAnnotationHistory");
    const state = { selectedAnnotationId: "x", editingAnnotationId: "y" };
    let sync = 0;
    let render = 0;
    let save = 0;
    api.bind({
      state,
      syncPropertyInputs: () => {
        sync += 1;
      },
      renderAnnotations: () => {
        render += 1;
      },
      session: {
        scheduleAutoSave: () => {
          save += 1;
        }
      }
    });
    api.finishUndoRedoUi();
    assert.equal(state.selectedAnnotationId, null);
    assert.equal(state.editingAnnotationId, null);
    assert.equal(sync, 1);
    assert.equal(render, 1);
    assert.equal(save, 1);
  });
});

describe("P6 F04 shape-vector clamp (unit via hexToRgba)", () => {
  it("hexToRgba : alpha clampée 0..1 (clamp interne)", () => {
    const { api } = loadIife("renderer-shape-vector.js", "__editifyShapeVector");
    assert.match(api.hexToRgba("#ff0000", -0.5), /rgba\(255,0,0,0\)/);
    assert.match(api.hexToRgba("#00ff00", 2), /rgba\(0,255,0,1\)/);
    assert.match(api.hexToRgba("#0000ff", 0.5), /rgba\(0,0,255,0\.5\)/);
  });

  it("shapeStyleDefaults / mergeShapeStyleFields : type inconnu → rect", () => {
    const { api } = loadIife("renderer-shape-vector.js", "__editifyShapeVector");
    const d = api.shapeStyleDefaults("nope");
    assert.equal(d.fillColor, api.SHAPE_DEFAULTS.rect.fillColor);
    const a = { type: "star" };
    api.mergeShapeStyleFields(a);
    assert.ok(a.fillColor);
    assert.equal(a.strokeAlpha, 1);
  });
});

describe("P6 F04 keymap isTypingContext (unit)", () => {
  /** @type {{ api: { isTypingContext: (t: unknown) => boolean }, window: import('jsdom').DOMWindow }} */
  let loaded;

  before(() => {
    loaded = loadIife("renderer-keymap.js", "__editifyKeymap");
  });

  it("false : null, file input, button", () => {
    const { api, document } = loaded;
    assert.equal(api.isTypingContext(null), false);
    const file = document.createElement("input");
    file.type = "file";
    assert.equal(api.isTypingContext(file), false);
    const btn = document.createElement("input");
    btn.type = "button";
    assert.equal(api.isTypingContext(btn), false);
  });

  it("true : text input, textarea, select", () => {
    const { api, document } = loaded;
    const input = document.createElement("input");
    input.type = "text";
    assert.equal(api.isTypingContext(input), true);
    const ta = document.createElement("textarea");
    assert.equal(api.isTypingContext(ta), true);
    const sel = document.createElement("select");
    assert.equal(api.isTypingContext(sel), true);
  });
});
