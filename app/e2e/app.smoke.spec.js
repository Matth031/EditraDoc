const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

function getRepoPdfFixture() {
  // PDF fourni par le repo (USER).
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) {
    throw new Error(`Fixture PDF introuvable: ${p}`);
  }
  return p;
}

async function launchApp() {
  const pdfPath = getRepoPdfFixture();
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfPath
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function openPdfFromUi(app, page) {
  // L'état de session peut précharger des onglets: on garde le test tolérant.
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
  });
  // Ouverture via menu natif: simule l'action File > Open PDF.
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);

  await expect(page.locator("#tabs .tab"))
    .toHaveCount(1, { timeout: 30000 })
    .catch(async () => {
      const count = await page.locator("#tabs .tab").count();
      if (count < 1) throw new Error("Aucun onglet après ouverture PDF");
    });
  // Multi-pages: au moins 1 page rendue.
  await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });
  // La page active doit avoir ses overlays (annotationLayer)
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });
  // E12: progression de rendu (peut être rapide, donc on se base sur l'historique)
  await page.waitForFunction(
    () =>
      Array.isArray(window.__maniStatusHistory) &&
      window.__maniStatusHistory.some((m) => {
        const s = String(m || "");
        return /^(Rendu pages|Rendering pages|Renderizando paginas|A renderizar paginas)/i.test(s);
      }),
    null,
    { timeout: 30000 }
  );
  // E10: statut post-chargement (libellé i18n : FR « PDF charge », EN « PDF loaded », etc.)
  await page.waitForFunction(
    () =>
      Array.isArray(window.__maniStatusHistory) &&
      window.__maniStatusHistory.some((m) => {
        const s = String(m || "");
        return /PDF\s+(charg|load|carg|carreg)/i.test(s);
      }),
    null,
    { timeout: 30000 }
  );
}

async function addTextAnnotation(page) {
  await page.locator("#addTextBtn").click();
  // Le bloc est créé sur la page active: on sélectionne le dernier.
  const annos = page.locator("#annotationLayer .annotation.text");
  await expect(annos).toHaveCount(1, { timeout: 15000 });
  return annos.nth(0);
}

// Compat: certaines versions de Playwright n'ont pas toHaveCountGreaterThan.
expect.extend({
  async toHaveCountGreaterThan(locator, min) {
    const count = await locator.count();
    const pass = count > min;
    return {
      pass,
      message: () => `expected count > ${min}, got ${count}`
    };
  }
});

test("app boots and shows title", async () => {
  const { app, page } = await launchApp();
  await expect(page.locator("h1")).toHaveText("EditraDoc");
  await e2eCi.closeElectronApp(app);
});

test("load PDF, remove tab, add and edit text", async () => {
  const { app, page } = await launchApp();
  await openPdfFromUi(app, page);
  await waitForPdfPagesRendered(page);

  // Sidebars: miniatures + ajouts visibles (non régression UI)
  await expect(page.locator("#thumbsBar")).toBeVisible();
  await expect(page.locator("#changesBar")).toBeVisible();
  await expect(page.locator("#thumbsList .thumb-item")).toHaveCountGreaterThan(0);

  // Vérifie que l'onglet a un bouton de fermeture, puis supprime.
  await expect(page.locator("#tabs .tab .tab-close")).toHaveCount(1);
  await page.locator("#tabs .tab .tab-close").click();
  await expect(page.locator(".toast-root .toast")).toHaveCount(1);
  await expect(page.locator(".toast-root .toast")).toContainText("PDF retiré");
  await page.locator(".toast-root .toast .toast-action", { hasText: "Annuler" }).click();
  await expect(page.locator("#tabs .tab")).toHaveCount(1);

  // Recharge pour tester ajout + édition
  await openPdfFromUi(app, page);
  await waitForPdfPagesRendered(page);

  const textNode = await addTextAnnotation(page);

  const editor = page.locator(
    "#annotationLayer .annotation.text.editing .text-editor[contenteditable='true']"
  );
  await expect(editor).toHaveCount(1);
  await editor.fill("Bonjour");
  await page.keyboard.press("Escape");
  await expect(page.locator("#annotationLayer .annotation.text.editing")).toHaveCount(0);

  // Non-régression: drag + scroll => l'élément reste sous le curseur
  // (simulate: click-drag, scroll viewer, continue drag)
  const box = await textNode.boundingBox();
  if (!box) throw new Error("bbox introuvable pour annotation");
  const startMx = Math.floor(box.x + 20);
  const startMy = Math.floor(box.y + 20);
  await page.mouse.move(startMx, startMy);
  await page.mouse.down();
  // Déclencher le mode drag (déplacement > 12px)
  await page.mouse.move(startMx + 30, startMy + 30);
  // Scroll dans le viewer pendant drag
  await page.locator(".viewer").hover({ position: { x: 10, y: 10 } });
  await page.mouse.wheel(0, 240);
  // Sans bouger plus loin, on "réaffirme" la position curseur
  await page.mouse.move(startMx + 30, startMy + 30);
  await page.mouse.up();

  await expect(page.locator("#changesList .change-item")).toHaveCount(1);
  await expect(page.locator("#changesList .change-item .change-type").first()).toContainText(
    "Fenetre texte"
  );
  await expect(page.locator("#changesList .change-item .change-summary").first()).toContainText(
    "Bonjour"
  );

  // Correcteur orthographique: ré-ouvrir l'édition pour vérifier lang/spellcheck
  await textNode.dblclick({ position: { x: 20, y: 20 } });
  await expect(editor).toHaveCount(1);
  await expect(editor).toHaveAttribute("lang", /^(fr-FR|fr)$/);
  const sc = await editor.evaluate((el) => Boolean(el.spellcheck));
  expect(sc).toBeTruthy();

  // Basculer la langue via l'event main → renderer, puis vérifier la mise à jour.
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("app:set-language", "en");
  });
  await page.waitForTimeout(150);
  await expect(editor).toHaveAttribute("lang", /^(en-US|en)$/);

  // Sortie édition via ESC (E6-S2)
  await page.keyboard.press("Escape");
  await expect(page.locator("#annotationLayer .annotation.text.editing")).toHaveCount(0);

  // Sidebar "Ajouts": clic => navigue/selection, Suppr => delete, Ctrl+Z => undo
  const changes = page.locator("#changesList .change-item");
  await expect(changes).toHaveCountGreaterThan(0);
  await changes.first().click();
  await page.waitForFunction(() => Boolean(window.__maniE2E?.getUiState?.().selectedAnnotationId));
  await page.keyboard.press("Delete");
  // Après suppression, plus d'annotation sélectionnée
  await page.waitForFunction(() => !window.__maniE2E?.getUiState?.().selectedAnnotationId);
  // Undo remet l'élément
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
  await page.waitForTimeout(150);

  // Copier / Coller: dupliquer l'annotation sans lien (Ctrl+C / Ctrl+V)
  const original = page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`);
  await expect(original).toHaveCount(1);
  await original.click();
  await page.waitForFunction(() => {
    try {
      return Boolean(window.__maniE2E?.getUiState?.().selectedAnnotationId);
    } catch {
      return false;
    }
  });
  const copied = await page.evaluate(() => window.__maniE2E?.copySelected?.());
  expect(copied).toBeTruthy();
  // Placer le curseur ailleurs dans le viewer pour coller à un autre endroit
  await page.locator(".viewer").click({ position: { x: 50, y: 50 } });
  const pasted = await page.evaluate(() => window.__maniE2E?.paste?.());
  expect(pasted).toBeTruthy();
  await expect(page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`)).toHaveCount(
    2
  );

  // Indépendance: éditer le 2e ne modifie pas le 1er
  const copies = page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`);
  await copies.nth(1).dblclick({ position: { x: 20, y: 20 } });
  const editor2 = page.locator(
    "#annotationLayer .annotation.text.editing .text-editor[contenteditable='true']"
  );
  await expect(editor2).toHaveCount(1);
  await editor2.click();
  await editor2.fill("Salut");
  await page.keyboard.press("Escape");
  await expect(page.locator(`#annotationLayer .annotation.text:has-text("Salut")`)).toHaveCount(1);
  await expect(page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`)).toHaveCount(
    1
  );

  // Re-entrer en édition et re-sortir par clic hors champ (non régression)
  const textNodeEsc = page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`);
  await expect(textNodeEsc).toHaveCount(1);
  // dblclick peut être flaky sous Electron (DOM rerender). On force 2 clics rapprochés.
  await textNodeEsc.click({ position: { x: 20, y: 20 } });
  await textNodeEsc.click({ position: { x: 20, y: 20 } });
  await expect(
    page.locator("#annotationLayer .annotation.text.editing .text-editor[contenteditable='true']")
  ).toHaveCount(1);

  // Cliquer hors annotation => sortir édition + désélection
  await page.locator(".viewer").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#annotationLayer .annotation.text.editing")).toHaveCount(0);

  // Re-sélectionner et vérifier que le texte est resté
  const textNode2 = page.locator(`#annotationLayer .annotation.text:has-text("Bonjour")`);
  await expect(textNode2).toHaveCount(1);

  // Sidebar "Ajouts": clic => sélectionne l'annotation (classe .selected)
  await page.locator("#changesList .change-item").first().click();
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveCount(1);

  await e2eCi.closeElectronApp(app);
});
