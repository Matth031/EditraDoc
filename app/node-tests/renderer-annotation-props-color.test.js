/**
 * Lot 5a — filet unitaire avant refactor applyEditifyColorAfterPicker.
 * Couvre les 3 branches actuelles : ctx texte, ctx forme, panneau propriétés
 * (restore backup + validation / fallback). Aucun refactor produit ici.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "../src/renderer");
const FILE = path.join(ROOT, "renderer-annotation-props.js");

/**
 * @returns {{
 *   api: Record<string, Function>,
 *   context: object,
 *   window: import('jsdom').DOMWindow,
 *   document: Document
 * }}
 */
function loadPropsModule() {
  const src = fs.readFileSync(FILE, "utf8");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const { window } = dom;
  /** @type {Record<string, unknown>} */
  const context = {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(src, context, { filename: FILE });
  const api = context.window.__editifyAnnotationProps;
  assert.ok(api, "window.__editifyAnnotationProps attendu");
  return { api, context, window, document: window.document };
}

/** @param {Document} document @param {string} id @param {string} [value] */
function makeColorInput(document, id, value = "#ff0000") {
  const el = document.createElement("input");
  el.type = "color";
  el.id = id;
  el.value = value;
  document.body.appendChild(el);
  return el;
}

/** @param {Document} document @param {string} id */
function makeButton(document, id) {
  const el = document.createElement("button");
  el.type = "button";
  el.id = id;
  document.body.appendChild(el);
  return el;
}

describe("Lot5a applyEditifyColorAfterPicker (unit, code actuel)", () => {
  /** @type {ReturnType<typeof loadPropsModule>} */
  let loaded;
  /** @type {string[]} */
  let logTags;

  beforeEach(() => {
    loaded = loadPropsModule();
    logTags = [];
    loaded.context.__editifyCtxTextBackup = undefined;
    loaded.context.__editifyCtxShapeBackup = undefined;
    loaded.context.__editifyColorSelectionBackup = undefined;
    loaded.context.__editifyTextColorRangeBackup = undefined;
  });

  function bindBase(extra = {}) {
    const { api } = loaded;
    const state = { selectedAnnotationId: /** @type {string|null} */ (null) };
    const tcm = {
      targetId: /** @type {string|null} */ (null),
      menuEl: { classList: { remove() {}, add() {}, contains: () => false } },
      applyCalls: 0,
      getTextCtxMenuTargetId() {
        return this.targetId;
      },
      setTextCtxMenuTargetId(id) {
        this.targetId = id;
      },
      ensureTextAnnotationCtxMenuEl() {
        return this.menuEl;
      },
      applyTextCtxMenuBoxProps() {
        this.applyCalls += 1;
      }
    };
    const sim = {
      targetId: /** @type {string|null} */ (null),
      menuEl: { classList: { remove() {}, add() {}, contains: () => false } },
      applyCalls: 0,
      getShapeCtxMenuTargetId() {
        return this.targetId;
      },
      setShapeCtxMenuTargetId(id) {
        this.targetId = id;
      },
      ensureShapeAnnotationCtxMenuEl() {
        return this.menuEl;
      },
      applyShapeCtxMenuProps() {
        this.applyCalls += 1;
      }
    };
    api.bind({
      state,
      getActiveTab: () => ({ id: "tab1" }),
      getSelectedAnnotation: () => null,
      logText: (tag) => {
        logTags.push(String(tag));
      },
      tcm,
      sim,
      propBgColor: null,
      propShapeFill: null,
      propShapeStrokeWidth: null,
      propShapeFillOpacity: null,
      propTextColor: null,
      SHAPE_TYPES: new Set(["rect", "ellipse", "star"]),
      ...extra
    });
    return { state, tcm, sim };
  }

  // --- Chemin ctx texte ---

  it("ctxTextColor : restaure __editifyCtxTextBackup puis clique validate ctx", () => {
    const { api, context, document } = loaded;
    const { tcm } = bindBase();
    tcm.targetId = null;
    context.__editifyCtxTextBackup = "text-ann-backup";

    const input = makeColorInput(document, "ctxTextColor", "#cc0000");
    const validateBtn = makeButton(document, "ctxValidateTextColorBtn");
    let validateClicks = 0;
    validateBtn.addEventListener("click", () => {
      validateClicks += 1;
    });

    api.applyEditifyColorAfterPicker(input);

    assert.equal(tcm.targetId, "text-ann-backup");
    assert.equal(validateClicks, 1);
    assert.equal(tcm.applyCalls, 0);
    assert.equal(context.__editifyCtxTextBackup, undefined);
    assert.ok(logTags.includes("maniColorRestoreTextCtx"));
    assert.ok(logTags.includes("maniColorBranchCtxText"));
  });

  it("ctxTextColor : sans bouton validate → fallback applyTextCtxMenuBoxProps", () => {
    const { api, context, document } = loaded;
    const { tcm } = bindBase();
    tcm.targetId = "text-live";
    context.__editifyCtxTextBackup = "should-clear";

    const input = makeColorInput(document, "ctxTextColor", "#00aa00");
    api.applyEditifyColorAfterPicker(input);

    assert.equal(tcm.applyCalls, 1);
    assert.equal(context.__editifyCtxTextBackup, undefined);
    assert.ok(logTags.includes("maniColorCtxTextFallbackApply"));
  });

  it("ctxTextBg : marque dataset.ctxTouched=1 sur #ctxTextBg", () => {
    const { api, document } = loaded;
    const { tcm } = bindBase();
    tcm.targetId = "t1";
    const bg = makeColorInput(document, "ctxTextBg", "#ffffff");
    makeButton(document, "ctxValidateTextBgBtn");

    api.applyEditifyColorAfterPicker(bg);

    assert.equal(bg.dataset.ctxTouched, "1");
  });

  // --- Chemin ctx forme ---

  it("ctxShapeFill : restaure __editifyCtxShapeBackup puis clique validate ctx", () => {
    const { api, context, document } = loaded;
    const { sim } = bindBase();
    sim.targetId = null;
    context.__editifyCtxShapeBackup = "shape-ann-backup";

    const input = makeColorInput(document, "ctxShapeFill", "#112233");
    const validateBtn = makeButton(document, "ctxValidateShapeFillBtn");
    let validateClicks = 0;
    validateBtn.addEventListener("click", () => {
      validateClicks += 1;
    });

    api.applyEditifyColorAfterPicker(input);

    assert.equal(sim.targetId, "shape-ann-backup");
    assert.equal(validateClicks, 1);
    assert.equal(sim.applyCalls, 0);
    assert.equal(context.__editifyCtxShapeBackup, undefined);
    assert.ok(logTags.includes("maniColorRestoreShapeCtx"));
    assert.ok(logTags.includes("maniColorBranchCtxShape"));
  });

  it("ctxShapeStroke : sans bouton validate → fallback applyShapeCtxMenuProps", () => {
    const { api, context, document } = loaded;
    const { sim } = bindBase();
    sim.targetId = "shape-live";
    context.__editifyCtxShapeBackup = "clear-me";

    const input = makeColorInput(document, "ctxShapeStroke", "#abcdef");
    api.applyEditifyColorAfterPicker(input);

    assert.equal(sim.applyCalls, 1);
    assert.equal(context.__editifyCtxShapeBackup, undefined);
    assert.ok(logTags.includes("maniColorCtxShapeFallbackApply"));
  });

  it("ctxShapeBackdrop : marque dataset.ctxTouched=1", () => {
    const { api, document } = loaded;
    const { sim } = bindBase();
    sim.targetId = "s1";
    const bd = makeColorInput(document, "ctxShapeBackdrop", "#eeeeee");
    makeButton(document, "ctxValidateShapeBackdropBtn");

    api.applyEditifyColorAfterPicker(bd);

    assert.equal(bd.dataset.ctxTouched, "1");
  });

  // --- Chemin panneau propriétés ---

  it("propTextColor : restaure __editifyColorSelectionBackup puis validate panneau", () => {
    const { api, context, document } = loaded;
    const item = {
      id: "ann-42",
      type: "text",
      textColor: "#111111",
      padding: 6,
      fontFamily: "Arial",
      fontSize: 14
    };
    const state = { selectedAnnotationId: /** @type {string|null} */ (null) };
    const propTextColor = makeColorInput(document, "propTextColor", "#00ff00");
    const validateBtn = makeButton(document, "validateTextColorBtn");
    let validateClicks = 0;
    validateBtn.addEventListener("click", () => {
      validateClicks += 1;
    });

    api.bind({
      state,
      getActiveTab: () => ({ id: "tab" }),
      getSelectedAnnotation: () => (state.selectedAnnotationId === item.id ? item : null),
      logText: (tag) => {
        logTags.push(String(tag));
      },
      tcm: {
        getTextCtxMenuTargetId: () => null,
        setTextCtxMenuTargetId() {},
        ensureTextAnnotationCtxMenuEl: () => null,
        applyTextCtxMenuBoxProps() {}
      },
      sim: {
        getShapeCtxMenuTargetId: () => null,
        setShapeCtxMenuTargetId() {},
        ensureShapeAnnotationCtxMenuEl: () => null,
        applyShapeCtxMenuProps() {}
      },
      propBgColor: null,
      propShapeFill: null,
      propShapeStrokeWidth: null,
      propShapeFillOpacity: null,
      propTextColor,
      SHAPE_TYPES: new Set(["rect"])
    });

    context.__editifyColorSelectionBackup = "ann-42";
    api.applyEditifyColorAfterPicker(propTextColor);

    assert.equal(state.selectedAnnotationId, "ann-42");
    assert.equal(context.__editifyColorSelectionBackup, undefined);
    assert.equal(validateClicks, 1);
    assert.ok(logTags.includes("maniColorRestoreSel"));
    assert.ok(logTags.includes("maniColorPanelDone"));
  });

  it("propTextColor : fallback applySelectedProperties persiste textColor", () => {
    const { api, context, document } = loaded;
    const item = {
      id: "ann-7",
      type: "text",
      textColor: "#111111",
      bgColor: null,
      padding: 6,
      fontFamily: "Arial",
      fontSize: 14
    };
    const state = { selectedAnnotationId: "ann-7" };
    const propTextColor = makeColorInput(document, "propTextColor", "#336699");
    const propBgColor = makeColorInput(document, "propBgColor", "#ffffff");
    propBgColor.dataset.touched = "0";
    const propPadding = document.createElement("input");
    propPadding.value = "6";
    const propFontFamily = document.createElement("select");
    const opt = document.createElement("option");
    opt.value = "Arial";
    opt.selected = true;
    propFontFamily.appendChild(opt);
    const propFontSize = document.createElement("input");
    propFontSize.value = "14";

    let snap = 0;
    let render = 0;
    let save = 0;

    api.bind({
      state,
      getActiveTab: () => ({ id: "tab", annotationsByPage: { 1: [item] } }),
      getSelectedAnnotation: () => item,
      logText: (tag) => {
        logTags.push(String(tag));
      },
      tcm: {
        getTextCtxMenuTargetId: () => null,
        setTextCtxMenuTargetId() {},
        ensureTextAnnotationCtxMenuEl: () => null,
        applyTextCtxMenuBoxProps() {}
      },
      sim: {
        getShapeCtxMenuTargetId: () => null,
        setShapeCtxMenuTargetId() {},
        ensureShapeAnnotationCtxMenuEl: () => null,
        applyShapeCtxMenuProps() {}
      },
      propBgColor,
      propShapeFill: null,
      propShapeStrokeWidth: null,
      propShapeFillOpacity: null,
      propTextColor,
      propPadding,
      propFontFamily,
      propFontSize,
      SHAPE_TYPES: new Set(["rect"]),
      captureSnapshot: () => {
        snap += 1;
      },
      applyTextColorToTextAnnotation: (it, color) => {
        it.textColor = color;
      },
      captureLastTextStyleFromItem: () => {},
      clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
      defaultShapeFillAlphaAfterClear: () => 0.3,
      renderAnnotations: () => {
        render += 1;
      },
      scheduleAutoSave: () => {
        save += 1;
      }
    });

    // Pas de bouton validate → fallback applySelectedProperties
    context.__editifyColorSelectionBackup = undefined;
    api.applyEditifyColorAfterPicker(propTextColor);

    assert.equal(item.textColor, "#336699");
    assert.equal(snap, 1);
    assert.equal(render, 1);
    assert.equal(save, 1);
    assert.ok(logTags.includes("maniColorPanelDone"));
  });

  it("propBgColor : marque dataset.touched=1 avant apply panneau", () => {
    const { api, document } = loaded;
    const item = {
      id: "ann-bg",
      type: "text",
      textColor: "#111111",
      bgColor: null,
      padding: 6,
      fontFamily: "Arial",
      fontSize: 14
    };
    const state = { selectedAnnotationId: "ann-bg" };
    const propTextColor = makeColorInput(document, "propTextColor", "#111111");
    const propBgColor = makeColorInput(document, "propBgColor", "#ff00ff");
    const propPadding = document.createElement("input");
    propPadding.value = "6";
    const propFontFamily = document.createElement("select");
    const opt = document.createElement("option");
    opt.value = "Arial";
    propFontFamily.appendChild(opt);
    const propFontSize = document.createElement("input");
    propFontSize.value = "14";

    api.bind({
      state,
      getActiveTab: () => ({ id: "tab" }),
      getSelectedAnnotation: () => item,
      logText: () => {},
      tcm: {
        getTextCtxMenuTargetId: () => null,
        setTextCtxMenuTargetId() {},
        ensureTextAnnotationCtxMenuEl: () => null,
        applyTextCtxMenuBoxProps() {}
      },
      sim: {
        getShapeCtxMenuTargetId: () => null,
        setShapeCtxMenuTargetId() {},
        ensureShapeAnnotationCtxMenuEl: () => null,
        applyShapeCtxMenuProps() {}
      },
      propBgColor,
      propShapeFill: null,
      propShapeStrokeWidth: null,
      propShapeFillOpacity: null,
      propTextColor,
      propPadding,
      propFontFamily,
      propFontSize,
      SHAPE_TYPES: new Set(["rect"]),
      captureSnapshot: () => {},
      applyTextColorToTextAnnotation: (it, color) => {
        it.textColor = color;
      },
      captureLastTextStyleFromItem: () => {},
      clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
      defaultShapeFillAlphaAfterClear: () => 0.3,
      renderAnnotations: () => {},
      scheduleAutoSave: () => {}
    });

    api.applyEditifyColorAfterPicker(propBgColor);

    assert.equal(propBgColor.dataset.touched, "1");
    assert.equal(item.bgColor, "#ff00ff");
  });

  // --- Annulation (pas de commit) ---

  it("sans appel applyEditifyColorAfterPicker : backups d'open restent, couleur inchangée", () => {
    const { api, context, document } = loaded;
    const item = { id: "x", type: "text", textColor: "#111111" };
    const state = { selectedAnnotationId: "x" };
    const { tcm, sim } = bindBase({
      state,
      getSelectedAnnotation: () => item,
      captureTextColorSelectionBackup: () => {}
    });
    tcm.targetId = "text-open";
    sim.targetId = "shape-open";

    api.wireEditifyColorHandlers();
    document.dispatchEvent(
      new loaded.window.CustomEvent("mani-color-open", {
        detail: { inputId: "propTextColor" }
      })
    );

    assert.equal(context.__editifyColorSelectionBackup, "x");
    assert.equal(context.__editifyCtxTextBackup, "text-open");
    assert.equal(context.__editifyCtxShapeBackup, "shape-open");

    // Fermeture sans commit (annulation picker)
    document.dispatchEvent(new loaded.window.CustomEvent("mani-color-close"));

    assert.equal(item.textColor, "#111111");
    assert.equal(state.selectedAnnotationId, "x");
    // close ne consomme pas les backups de sélection/ctx (seul le range texte est reset)
    assert.equal(context.__editifyColorSelectionBackup, "x");
  });
});
