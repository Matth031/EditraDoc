const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");
const {
  countBufferOccurrences,
  assertPdfHasEmbeddedImageXObjects
} = require("./export-image-assertions");

const repoRoot = path.resolve(process.cwd(), "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "test_raptor.pdf");
const fallbackPng = path.join(process.cwd(), "public", "miniature_no_bg.png");

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) {
    throw new Error(`Fixture introuvable: ${pdfFixture}`);
  }
  const fixtureBuf = fs.readFileSync(pdfFixture);
  expect(countBufferOccurrences(fixtureBuf, Buffer.from("/Subtype /Image"))).toBe(0);
  if (!fs.existsSync(raptorFixture)) {
    if (!fs.existsSync(fallbackPng)) {
      throw new Error(`Impossible de créer raptor.png : ${fallbackPng} introuvable`);
    }
    fs.mkdirSync(path.dirname(raptorFixture), { recursive: true });
    fs.copyFileSync(fallbackPng, raptorFixture);
  }
});

test("export PDF : image raptor.png embarquée puis fichier supprimé", async () => {
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfFixture,
      MANI_PDF_E2E_SAVE_AS_PATH: outPdf
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => !!window.maniPdfApi && window.__maniE2E?.exportActivePdfToPathForTest,
    null,
    {
      timeout: 90000,
      polling: 250
    }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000,
      message: "Le service Python (port 8765) doit être disponible pour l’export PDF."
    })
    .toMatchObject({ ok: true });

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

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  await page.locator("#addImageBtn").click();
  await page.locator("#imageInput").setInputFiles(raptorFixture);
  await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
    timeout: 15000
  });

  await page.locator("#imageInput").evaluate((el) => el.blur());
  await page.locator(".viewer").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+KeyS");

  await expect.poll(() => fs.existsSync(outPdf), { timeout: 60000 }).toBe(true);
  expect(fs.statSync(outPdf).size).toBeGreaterThan(1024);
  assertPdfHasEmbeddedImageXObjects(outPdf);

  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, outPdf);
  const raptorTab = page.locator("#tabs .tab", { hasText: "test_raptor.pdf" });
  await expect(raptorTab).toHaveCount(1, { timeout: 30000 });
  await raptorTab.click();
  await waitForPdfPagesRendered(page);
  assertPdfHasEmbeddedImageXObjects(outPdf);

  await e2eCi.closeElectronApp(app);
  fs.unlinkSync(outPdf);
  expect(fs.existsSync(outPdf)).toBe(false);
});

test("export PDF : image puis écrasement du fichier source (même chemin)", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_overwrite.pdf");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  fs.copyFileSync(pdfFixture, workPdf);
  const beforeSize = fs.statSync(workPdf).size;

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: workPdf
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
      message: "Le service Python (port 8765) doit être disponible pour l’export PDF."
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  await page.locator("#addImageBtn").click();
  await page.locator("#imageInput").setInputFiles(raptorFixture);
  await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
    timeout: 15000
  });

  const exportResult = await page.evaluate((p) => window.__maniE2E.exportActivePdfToPathForTest(p), workPdf);
  expect(exportResult?.ok).toBe(true);
  expect(fs.existsSync(workPdf)).toBe(true);
  expect(fs.statSync(workPdf).size).toBeGreaterThan(beforeSize);
  assertPdfHasEmbeddedImageXObjects(workPdf);

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});

test("export PDF : texte en cours d’édition (sans blur) est inclus dans le fichier", async () => {
  const outTextPdf = path.join(repoRoot, "tests", "test_export_text_editing.pdf");
  if (fs.existsSync(outTextPdf)) fs.unlinkSync(outTextPdf);

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
      message: "Le service Python (port 8765) doit être disponible pour l’export PDF."
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  await page.locator("#addTextBtn").click();
  const editor = page.locator("#annotationLayer .annotation.text .text-editor");
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await editor.pressSequentially("TEST!", { delay: 15 });
  await expect
    .poll(async () => {
      const ui = await page.evaluate(() => window.__maniE2E.getUiState());
      return (ui.textOnCurrentPage || []).some((s) => String(s).includes("TEST"));
    }, { timeout: 5000 })
    .toBe(true);
  // Pas de blur : export direct pendant l’édition immédiate.
  const exportResult = await page.evaluate(
    (p) => window.__maniE2E.exportActivePdfToPathForTest(p),
    outTextPdf
  );
  expect(exportResult?.ok).toBe(true);
  expect(fs.existsSync(outTextPdf)).toBe(true);
  const buf = fs.readFileSync(outTextPdf);
  expect(buf.includes(Buffer.from("TEST"))).toBe(true);

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(outTextPdf)) fs.unlinkSync(outTextPdf);
});
