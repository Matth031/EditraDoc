/**
 * Attend que le nombre de nœuds .pdf-page corresponde à tab.pageCount
 * puis que les miniatures soient alignées (deux phases pour éviter les courses rendu / thumbs).
 */
async function waitForPdfPagesRendered(page) {
  await page.waitForFunction(
    () => {
      const u = window.__maniE2E?.getUiState?.();
      if (!u || u.error || u.pageCount == null) return false;
      const n = document.querySelectorAll("#pagesContainer .pdf-page").length;
      return n === u.pageCount && n >= 1;
    },
    null,
    { timeout: 90000 }
  );
  await page.waitForFunction(
    () => {
      const u = window.__maniE2E?.getUiState?.();
      if (!u || u.pageCount == null) return false;
      const n = document.querySelectorAll("#pagesContainer .pdf-page").length;
      const thumbs = document.querySelectorAll("#thumbsList .thumb-item").length;
      return n === u.pageCount && thumbs === n && n >= 1;
    },
    null,
    { timeout: 90000 }
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
