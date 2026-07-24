/**
 * Attend que le rendu PDF soit réellement prêt pour les tests :
 * - autant de `.pdf-page` **avec** `canvas.pdf-canvas` (même critère que `renderThumbnails`)
 * - autant de `.thumb-item` dans `#thumbsList`
 * - idéalement `tab.pageCount` aligné (via `__maniE2E.getUiState`)
 *
 * Un seul poll avec backoff léger (pas deux timeouts 90 s séquentiels) — TKT-FLK-E2E-001.
 * Retour immédiat si pageCount + canvas + thumbs alignés.
 * Soft-path : si le DOM est cohérent (canvas === thumbs === pages) mais `pageCount` traîne
 * (race session / re-entrée updateViewer), accepte après quelques polls stables.
 * Ce soft-path est un **contournement de test** lié à TKT-BUG-PDF-RENDER-RACE-001
 * (encore ouvert, `renderer-pdf-viewer.js` — hors scope P6) : quand la race produit
 * sera corrigée, ce chemin pourra devenir obsolète ; ne pas le retirer avant.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{ timeoutMs?: number }} [options]
 */
async function waitForPdfPagesRendered(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90000;
  const started = Date.now();
  let delayMs = 25;
  const maxDelayMs = 200;
  /** Polls DOM-cohérents consécutifs requis si pageCount désynchronisé. */
  const stableDomPollsRequired = 3;
  let stableDomPolls = 0;
  let lastDomKey = "";

  /**
   * @returns {Promise<{
   *   pageCount: number | null,
   *   pdfPages: number,
   *   withCanvas: number,
   *   thumbs: number,
   *   uiError: boolean
   * }>}
   */
  async function snapshot() {
    return page.evaluate(() => {
      const u = window.__maniE2E?.getUiState?.();
      const pageNodes = document.querySelectorAll("#pagesContainer .pdf-page");
      let withCanvas = 0;
      pageNodes.forEach((node) => {
        if (node.querySelector("canvas.pdf-canvas")) withCanvas += 1;
      });
      const pageCountRaw = u?.pageCount;
      const pageCount = pageCountRaw == null || u?.error ? null : Number(pageCountRaw);
      return {
        pageCount: Number.isFinite(pageCount) ? pageCount : null,
        pdfPages: pageNodes.length,
        withCanvas,
        thumbs: document.querySelectorAll("#thumbsList .thumb-item").length,
        uiError: Boolean(u?.error)
      };
    });
  }

  /**
   * @param {{ pageCount: number | null, pdfPages: number, withCanvas: number, thumbs: number, uiError: boolean }} s
   */
  function isFullyAligned(s) {
    if (s.uiError || s.pageCount == null || s.pageCount < 1) return false;
    return s.withCanvas === s.pageCount && s.thumbs === s.pageCount && s.pdfPages === s.pageCount;
  }

  /**
   * DOM prêt au sens renderThumbnails (ignore pageCount).
   * @param {{ pdfPages: number, withCanvas: number, thumbs: number }} s
   */
  function isDomConsistent(s) {
    return s.withCanvas >= 1 && s.withCanvas === s.thumbs && s.withCanvas === s.pdfPages;
  }

  // Premier check immédiat — zéro attente si déjà prêt.
  {
    const s0 = await snapshot();
    if (isFullyAligned(s0)) return;
  }

  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const s = await snapshot();
    if (isFullyAligned(s)) return;

    if (isDomConsistent(s)) {
      const key = `${s.withCanvas}:${s.thumbs}:${s.pdfPages}`;
      if (key === lastDomKey) stableDomPolls += 1;
      else {
        lastDomKey = key;
        stableDomPolls = 1;
      }
      // Soft-path TKT-FLK-E2E-001 : pageCount stale alors que paint + thumbs sont cohérents.
      // Lié à TKT-BUG-PDF-RENDER-RACE-001 (ouvert) — workaround test, pas fix produit.
      if (stableDomPolls >= stableDomPollsRequired) return;
    } else {
      lastDomKey = "";
      stableDomPolls = 0;
    }

    delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.5));
  }

  const finalSnap = await snapshot().catch(() => null);
  throw new Error(
    `waitForPdfPagesRendered: timeout ${timeoutMs}ms` +
      (finalSnap
        ? ` (pageCount=${finalSnap.pageCount}, pages=${finalSnap.pdfPages}, canvas=${finalSnap.withCanvas}, thumbs=${finalSnap.thumbs})`
        : "")
  );
}

/**
 * Vérifie qu'une conversion HTML → PDF s'est terminée sans erreur et que le fichier est valide.
 * @param {import("@playwright/test").Expect} expect
 * @param {unknown} result - Retour IPC `convertHtmlToPdf`
 * @param {string} outputPath - Chemin PDF attendu
 * @param {{ minSizeBytes?: number }} [options]
 */
function assertHtmlToPdfCreatedWithoutError(expect, result, outputPath, options = {}) {
  const minSizeBytes = options.minSizeBytes ?? 1;
  const fs = require("node:fs");

  expect(result, "résultat IPC absent").toBeTruthy();
  expect(result?.ok, `conversion en échec : ${JSON.stringify(result)}`).toBe(true);
  expect(result?.error, "aucune erreur attendue si ok=true").toBeFalsy();
  expect(fs.existsSync(outputPath), `PDF absent : ${outputPath}`).toBe(true);

  const stat = fs.statSync(outputPath);
  expect(stat.size, "taille PDF").toBeGreaterThan(minSizeBytes);

  const buf = fs.readFileSync(outputPath);
  expect(buf.length, "fichier PDF vide").toBeGreaterThan(4);
  expect(buf.subarray(0, 4).toString("ascii"), "en-tête PDF (%PDF)").toBe("%PDF");
}

/**
 * Supprime le PDF généré si demandé (debug : conserver sur disque).
 * @param {string} outputPath
 * @param {boolean} deleteAfterTest - true = supprimer, false = garder
 * @param {string[]} [alsoRemove] - Fichiers annexes (ex. rapport JSON)
 */
function cleanupGeneratedPdf(outputPath, deleteAfterTest, alsoRemove = []) {
  if (!deleteAfterTest) return;
  const fs = require("node:fs");
  for (const p of [outputPath, ...alsoRemove]) {
    try {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* intentional: unlink temp fixture best-effort */
      /* ignore */
    }
  }
}

/**
 * Ouvre le menu contextuel d'une annotation texte via dispatchEvent.
 * Sous xvfb/Linux, les clics Playwright sur la bbox initiale (~20 px) sont souvent
 * interceptés par #annotationLayer ; ce helper contourne le hit-test.
 * @param {import("@playwright/test").Page} page
 * @param {{ annotationId?: string }} [options]
 */
async function dispatchTextAnnotationContextMenu(page, options = {}) {
  const ok = await page.evaluate((annotationId) => {
    const el = annotationId
      ? document.querySelector(`#annotationLayer .annotation.text[data-id="${annotationId}"]`)
      : document.querySelector("#annotationLayer .annotation.text");
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + Math.max(1, rect.width / 2),
      clientY: rect.top + Math.max(1, rect.height / 2),
      button: 2,
      buttons: 2
    });
    el.dispatchEvent(event);
    return true;
  }, options.annotationId ?? null);
  if (!ok) {
    throw new Error("dispatchTextAnnotationContextMenu: annotation texte introuvable");
  }
}

module.exports = {
  waitForPdfPagesRendered,
  assertHtmlToPdfCreatedWithoutError,
  cleanupGeneratedPdf,
  dispatchTextAnnotationContextMenu
};
