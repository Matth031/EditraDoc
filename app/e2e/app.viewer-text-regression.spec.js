/**
 * Régressions : synchro page au scroll, édition texte immédiate, style texte par défaut.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

const pdfFixture = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");

async function launchWithPdf() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfFixture
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi && window.__maniE2E?.getUiState, null, {
    timeout: 90000
  });
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);
  await waitForPdfPagesRendered(page);
  return { app, page };
}

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) {
    throw new Error(`Fixture introuvable: ${pdfFixture}`);
  }
});

test("nouvelle zone texte : mode écriture immédiat", async () => {
  const { app, page } = await launchWithPdf();
  try {
    await page.locator("#addTextBtn").click();
    await expect(
      page.locator("#annotationLayer .annotation.text.editing .text-editor[contenteditable='true']")
    ).toHaveCount(1, { timeout: 10000 });
    const ui = await page.evaluate(() => window.__maniE2E.getUiState());
    expect(ui.editingAnnotationId).toBeTruthy();
    expect(ui.selectedAnnotationId).toBe(ui.editingAnnotationId);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("style texte : nouvelle zone reprend la dernière police affichée", async () => {
  const { app, page } = await launchWithPdf();
  try {
    await page.locator("#addTextBtn").click();
    await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(1, {
      timeout: 10000
    });
    await page.locator("#propFontSize").fill("22");
    await page.locator("#propFontFamily").selectOption("Times New Roman");
    await page.locator("#propTextColor").evaluate((el) => {
      el.value = "#ff0000";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await page.locator("#addTextBtn").click();
    await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(2, {
      timeout: 10000
    });

    const second = page.locator("#annotationLayer .annotation.text").nth(1);
    await expect(second).toHaveCSS("font-size", "22px");
    await expect(second).toHaveCSS("font-family", /Times New Roman/i);
    await expect(second).toHaveCSS("color", "rgb(255, 0, 0)");
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("scroll : page dominante (>50%) met à jour footer et miniature", async () => {
  const { app, page } = await launchWithPdf();
  try {
    const pageCount = await page.evaluate(() => window.__maniE2E.getUiState().pageCount);
    test.skip(!pageCount || pageCount < 2, "PDF mono-page : test scroll ignoré");

    const lastPageNode = page.locator("#pagesContainer .pdf-page").last();
    await lastPageNode.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => page.evaluate(() => window.__maniE2E.getUiState().currentPage), {
        timeout: 10000
      })
      .toBe(pageCount);

    await expect(page.locator("#pageInfo")).toContainText(String(pageCount));
    await expect(
      page.locator(`#thumbsList .thumb-item.active[data-page="${pageCount}"]`)
    ).toHaveCount(1);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});
