/**
 * Impression : bake via apply_annotations vers editradoc-print (temp), mock OS en E2E.
 * Prérequis : pipeline export partagé (baseline app.export-annotations-regression).
 */
const { test, expect, _electron: electron } = require("./editra-test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");

const repoRoot = path.resolve(process.cwd(), "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");

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
    () =>
      !!window.maniPdfApi?.allocatePrintTempPath &&
      !!window.maniPdfApi?.printBakedPdf &&
      typeof window.__editifyPdfPrint?.printActivePdf === "function",
    null,
    { timeout: 90000, polling: 250 }
  );
  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000,
      message: "Service Python requis pour le bake impression."
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
});

test("impression : bake sans annotations → temp sous editradoc-print puis cleanup (mock E2E)", async () => {
  const { app, page } = await launchWithPdf();

  const result = await page.evaluate(async () => window.__editifyPdfPrint.printActivePdf());

  expect(result.ok).toBe(true);
  expect(result.e2eMock).toBe(true);
  expect(result.tempRemoved).toBe(true);
  expect(result.tempPath).toBeTruthy();
  expect(String(result.tempPath).toLowerCase()).toContain("editradoc-print");
  expect(fs.existsSync(result.tempPath)).toBe(false);
  expect(path.dirname(result.tempPath).toLowerCase()).not.toBe(
    path.dirname(pdfFixture).toLowerCase()
  );

  await e2eCi.closeElectronApp(app);
});

test("impression : bake avec annotation texte + mock cleanup", async () => {
  const { app, page } = await launchWithPdf();

  await page.evaluate(() =>
    window.__maniE2E.injectTextForTest({
      plain: "PRINT_BAKE_OK",
      fontFamily: "Arial",
      fontSize: 14
    })
  );

  const result = await page.evaluate(async () => window.__editifyPdfPrint.printActivePdf());
  expect(result.ok).toBe(true);
  expect(result.tempRemoved).toBe(true);
  expect(String(result.tempPath).toLowerCase()).toContain("editradoc-print");
  expect(fs.existsSync(result.tempPath)).toBe(false);

  await e2eCi.closeElectronApp(app);
});

test("impression : allocate sous editradoc-print ; refuse path source (S1)", async () => {
  const { app, page } = await launchWithPdf();

  const alloc = await page.evaluate(async () => window.maniPdfApi.allocatePrintTempPath());
  expect(alloc.ok).toBe(true);
  expect(String(alloc.path).toLowerCase()).toContain("editradoc-print");
  expect(path.dirname(alloc.path).toLowerCase()).not.toBe(path.dirname(pdfFixture).toLowerCase());

  const discarded = await page.evaluate(
    async (p) => window.maniPdfApi.discardPrintTempPath(p),
    alloc.path
  );
  expect(discarded.ok).toBe(true);
  expect(fs.existsSync(alloc.path)).toBe(false);

  const refused = await page.evaluate(
    async (p) => window.maniPdfApi.printBakedPdf({ path: p }),
    pdfFixture
  );
  expect(refused.ok).toBe(false);

  await e2eCi.closeElectronApp(app);
});
