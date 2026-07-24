/**
 * TKT-BUG-PDF-RENDER-RACE-001 — race re-entrante renderPdfDocument.
 * Barrières manuelles (pas de timing flaky) : A pause / B complet / A relâché.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const VIEWER_PATH = path.join(__dirname, "../src/renderer/renderer-pdf-viewer.js");

function createBarrier() {
  /** @type {() => void} */
  let release = () => {};
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
}

/**
 * @param {number} numPages
 * @param {{ pauseBeforeGetPage?: number, loadBarrier?: ReturnType<typeof createBarrier>, getPageBarrier?: ReturnType<typeof createBarrier> }} [opts]
 */
function makeFakeDoc(numPages, opts = {}) {
  return {
    numPages,
    async getPage(n) {
      if (opts.pauseBeforeGetPage != null && n === opts.pauseBeforeGetPage && opts.getPageBarrier) {
        await opts.getPageBarrier.promise;
      }
      return { pageNumber: n, rotate: 0 };
    }
  };
}

function loadViewer() {
  const src = fs.readFileSync(VIEWER_PATH, "utf8");
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div class="viewer" id="viewer"></div>
      <div id="pagesContainer"></div>
      <div id="pageInfo"></div>
    </body></html>`
  );
  const { window } = dom;
  const context = {
    window,
    document: window.document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(src, context, { filename: VIEWER_PATH });
  const api = context.window.__editifyPdfViewer;
  assert.ok(api?.__test, "__editifyPdfViewer.__test attendu");
  return { api, window, document: window.document };
}

/**
 * @param {ReturnType<typeof loadViewer>} loaded
 * @param {object} tab
 */
function bindHarness(loaded, tab) {
  const { api, document } = loaded;
  const pagesContainer = document.getElementById("pagesContainer");
  const viewer = document.getElementById("viewer");
  const pageInfo = document.getElementById("pageInfo");
  assert.ok(pagesContainer && viewer);

  api.bind({
    state: { tabs: [tab], activeTabId: tab.id, zoomScale: 1 },
    layerRef: { annotationLayer: null, dropOverlay: null, pdfCanvas: null },
    viewer,
    pagesContainer,
    pageInfo,
    zoomInfo: null,
    zoomOutBtn: null,
    zoomInBtn: null,
    getActiveTab: () => tab,
    t: (k) => k,
    tr: (k, vars) => `${k}:${vars?.a || ""}/${vars?.b || ""}`,
    setStatus: () => {},
    clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
    enforceSafeZoneForActiveTab: () => {},
    renderAnnotations: () => {},
    scheduleSidebarUpdate: () => {},
    pathsEqual: (a, b) => a === b,
    scheduleAutoSave: () => {}
  });

  api.__test.setPaintPdfPageOnNodeOverride(async (_page, _n, pageNode) => {
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";
    pageNode.appendChild(canvas);
    return canvas;
  });

  return { pagesContainer, tab };
}

describe("TKT-BUG-PDF-RENDER-RACE-001 renderPdfDocument", () => {
  /** @type {ReturnType<typeof loadViewer> | null} */
  let loaded = null;

  beforeEach(() => {
    loaded = loadViewer();
  });

  afterEach(() => {
    loaded?.api.__test.clearOverrides();
    loaded = null;
  });

  it("pause après getPage(1) : A n'ajoute pas de fantôme ; post-boucle A jamais appelée", async () => {
    assert.ok(loaded);
    const tab = { id: "t1", path: "a.pdf", currentPage: 1, pageCount: 0 };
    const { pagesContainer } = bindHarness(loaded, tab);
    const barrier = createBarrier();
    /** @type {Array<{ token: number, step: string }>} */
    const postLoop = [];
    loaded.api.__test.setPostLoopSpy((token, step) => {
      postLoop.push({ token, step });
    });

    let tokenA = 0;
    loaded.api.__test.setLoadPdfDocumentOverride(async (pdfPath) => {
      if (pdfPath === "a.pdf") {
        return makeFakeDoc(7, { pauseBeforeGetPage: 1, getPageBarrier: barrier });
      }
      return makeFakeDoc(6);
    });

    const pA = loaded.api.renderPdfDocument("a.pdf");
    tokenA = loaded.api.__test.getActivePdfRenderToken();
    // Laisser A atteindre await getPage(1)
    await Promise.resolve();
    await Promise.resolve();

    const pB = loaded.api.renderPdfDocument("b.pdf");
    const tokenB = loaded.api.__test.getActivePdfRenderToken();
    assert.notEqual(tokenA, tokenB);

    await pB;
    barrier.release();
    await pA;

    assert.equal(tab.pageCount, 6);
    assert.equal(pagesContainer.querySelectorAll(".pdf-page").length, 6);
    assert.equal(pagesContainer.querySelectorAll('.pdf-page[data-page="7"]').length, 0);

    const stepsA = postLoop.filter((c) => c.token === tokenA);
    assert.equal(stepsA.length, 0, `post-boucle A ne doit pas tourner: ${JSON.stringify(stepsA)}`);
    const stepsB = postLoop.filter((c) => c.token === tokenB).map((c) => c.step);
    assert.deepEqual(stepsB, [
      "setActivePage",
      "scheduleSidebarUpdate",
      "syncActivePageFromScroll"
    ]);
  });

  it("pause après loadPdfDocument : A n'écrit pas pageCount ni DOM ; post-boucle A absente", async () => {
    assert.ok(loaded);
    const tab = { id: "t1", path: "a.pdf", currentPage: 1, pageCount: 0 };
    const { pagesContainer } = bindHarness(loaded, tab);
    const barrier = createBarrier();
    /** @type {Array<{ token: number, step: string }>} */
    const postLoop = [];
    loaded.api.__test.setPostLoopSpy((token, step) => {
      postLoop.push({ token, step });
    });

    loaded.api.__test.setLoadPdfDocumentOverride(async (pdfPath) => {
      if (pdfPath === "a.pdf") {
        await barrier.promise;
        return makeFakeDoc(7);
      }
      return makeFakeDoc(6);
    });

    const pA = loaded.api.renderPdfDocument("a.pdf");
    const tokenA = loaded.api.__test.getActivePdfRenderToken();
    await Promise.resolve();
    await Promise.resolve();

    const pB = loaded.api.renderPdfDocument("b.pdf");
    const tokenB = loaded.api.__test.getActivePdfRenderToken();
    await pB;

    assert.equal(tab.pageCount, 6);
    assert.equal(pagesContainer.querySelectorAll(".pdf-page").length, 6);

    barrier.release();
    await pA;

    assert.equal(tab.pageCount, 6, "A périmé ne doit pas réécrire pageCount=7");
    assert.equal(pagesContainer.querySelectorAll(".pdf-page").length, 6);
    assert.equal(postLoop.filter((c) => c.token === tokenA).length, 0, "post-boucle A absente");
    assert.ok(postLoop.some((c) => c.token === tokenB && c.step === "setActivePage"));
    assert.ok(postLoop.some((c) => c.token === tokenB && c.step === "scheduleSidebarUpdate"));
    assert.ok(postLoop.some((c) => c.token === tokenB && c.step === "syncActivePageFromScroll"));
  });
});
