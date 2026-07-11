/**
 * Non-régression export PDF : placement, styles texte, forme et image.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");
const {
  assertPdfContainsText,
  assertPdfHasEmbeddedImageXObjects,
  assertPdfHasFontSizeTf,
  assertPdfUsesBaseFont
} = require("./export-image-assertions");

const repoRoot = path.resolve(process.cwd(), "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "test_export_annotations_regression.pdf");
const fallbackPng = path.join(process.cwd(), "public", "miniature_no_bg.png");

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
  await page.waitForFunction(
    () => !!window.maniPdfApi && window.__maniE2E?.exportActivePdfToPathForTest,
    null,
    { timeout: 90000, polling: 250 }
  );
  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000,
      message: "Service Python requis pour l’export PDF."
    })
    .toMatchObject({ ok: true });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);
  return { app, page };
}

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) {
    throw new Error(`Fixture introuvable: ${pdfFixture}`);
  }
  if (!fs.existsSync(raptorFixture)) {
    if (!fs.existsSync(fallbackPng)) {
      throw new Error(`Impossible de créer raptor.png : ${fallbackPng} introuvable`);
    }
    fs.mkdirSync(path.dirname(raptorFixture), { recursive: true });
    fs.copyFileSync(fallbackPng, raptorFixture);
  }
});

test("export PDF : texte stylé + forme + image conservés", async () => {
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const { app, page } = await launchWithPdf();

  const textId = await page.evaluate(() =>
    window.__maniE2E.injectTextForTest({
      plain: "STYLE_EXPORT",
      fontFamily: "Times New Roman",
      fontSize: 28,
      textColor: "#cc0000",
      padding: 10
    })
  );
  expect(textId).toBeTruthy();

  const shapeId = await page.evaluate(() => window.__maniE2E.injectShapeForTest("rect"));
  expect(shapeId).toBeTruthy();

  await page.locator("#addImageBtn").click();
  await page.locator("#imageInput").setInputFiles(raptorFixture);
  await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
    timeout: 15000
  });

  const exportResult = await page.evaluate(
    (p) => window.__maniE2E.exportActivePdfToPathForTest(p),
    outPdf
  );
  expect(exportResult?.ok).toBe(true);
  expect(fs.existsSync(outPdf)).toBe(true);

  assertPdfContainsText(outPdf, "STYLE_EXPORT");
  assertPdfUsesBaseFont(outPdf, "Times-Roman");
  assertPdfHasFontSizeTf(outPdf, 28);
  assertPdfHasEmbeddedImageXObjects(outPdf, 1);

  const props = await page.evaluate((id) => window.__maniE2E.getAnnotationProps(id), textId);
  expect(props?.fontFamily).toBe("Times New Roman");
  expect(props?.fontSize).toBe(28);
  expect(props?.textColor).toBe("#cc0000");

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);
});
