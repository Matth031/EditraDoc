/**
 * Non-régression installateur : export image via EditraDoc.exe packagé (win-unpacked).
 * Nécessite `npm run build` ou `npm run dist:win` au préalable.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");
const { assertPdfHasEmbeddedImageXObjects } = require("./export-image-assertions");

const appDir = process.cwd();
const packagedExe = path.join(appDir, "dist", "win-unpacked", "EditraDoc.exe");
const repoRoot = path.resolve(appDir, "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "test_packaged_export.pdf");
const fallbackPng = path.join(appDir, "public", "miniature_no_bg.png");

test.beforeAll(() => {
  if (!fs.existsSync(packagedExe)) {
    test.skip(true, `Build packagé absent : ${packagedExe} (npm run build)`);
  }
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

test("packagé : service Python embarqué + export PDF avec image", async () => {
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: packagedExe,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfFixture,
      MANI_PDF_E2E_SAVE_AS_PATH: outPdf
    })
  });

  try {
    const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      () => !!window.maniPdfApi && window.__maniE2E?.exportActivePdfToPathForTest,
      null,
      { timeout: 120000, polling: 250 }
    );

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000,
        message: "Le service Python embarqué (port 8765) doit être disponible."
      })
      .toMatchObject({ ok: true });

    await page.evaluate(() => {
      try {
        window.localStorage?.clear?.();
        window.sessionStorage?.clear?.();
      } catch {
        /* intentional: clear storage in e2e setup best-effort */
      }
    });

    await app.evaluate(({ BrowserWindow }, p) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents?.send?.("pdf:open-from-menu", p);
    }, pdfFixture);

    await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 60000 });
    await waitForPdfPagesRendered(page);

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
    expect(fs.statSync(outPdf).size).toBeGreaterThan(1024);
    assertPdfHasEmbeddedImageXObjects(outPdf);
  } finally {
    await e2eCi.closeElectronApp(app);
    if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);
  }
});
