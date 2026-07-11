const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");
const {
  countBufferOccurrences,
  assertPdfContainsText,
  assertPdfContainsTextAnywhere,
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

test("export PDF : texte saisi puis écrasement du fichier source (même chemin)", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_text_overwrite.pdf");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  fs.copyFileSync(pdfFixture, workPdf);

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
    () => !!window.maniPdfApi && window.__maniE2E?.overwriteActivePdfForTest,
    null,
    { timeout: 90000, polling: 250 }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000,
      message: "Le service Python doit être disponible pour l’export PDF."
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  await page.locator("#addTextBtn").click();
  const editor = page.locator("#annotationLayer .annotation.text .text-editor");
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await editor.pressSequentially("UI_OVERWRITE_TEST", { delay: 15 });
  await page.locator(".viewer").click({ position: { x: 10, y: 10 } });

  const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
  expect(exportResult?.ok).toBe(true);
  assertPdfContainsText(workPdf, "UI_OVERWRITE_TEST");

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});

test("export PDF : texte multiligne formaté puis écrasement conserve lignes et styles", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_text_multiline_overwrite.pdf");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  fs.copyFileSync(pdfFixture, workPdf);

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
    () => !!window.__maniE2E?.overwriteActivePdfForTest,
    null,
    { timeout: 90000, polling: 250 }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  const textId = await page.evaluate(() =>
    window.__maniE2E.injectTextForTest({
      plain: "ligne une\nligne deux",
      textHtml: "<div><b>ligne une</b></div><div><i>ligne deux</i></div>",
      fontSize: 14
    })
  );
  expect(textId).toBeTruthy();

  const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
  expect(exportResult?.ok).toBe(true);
  assertPdfContainsText(workPdf, "ligne une");
  assertPdfContainsText(workPdf, "ligne deux");

  const raw = fs.readFileSync(workPdf).toString("latin1");
  expect(raw.includes("Helvetica-Bold") || /\/[A-Z]+\+Helvetica-Bold/.test(raw)).toBe(true);

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});

test("export PDF : soft-wrap visuel figé en <br> (2 lignes équilibrées)", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_text_soft_wrap.pdf");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  fs.copyFileSync(pdfFixture, workPdf);

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
    () => !!window.__maniE2E?.peekExportPayloadForTest,
    null,
    { timeout: 90000, polling: 250 }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  const textId = await page.evaluate(() =>
    window.__maniE2E.injectTextForTest({
      plain: "on ajoute un texte voir si ça marche encore !",
      textHtml:
        "<div>on ajoute un texte <b>voir si</b> ça marche <font color=\"#00aa00\">encore !</font></div>",
      w: 200,
      h: 60,
      fontSize: 14,
      textWrapManual: true
    })
  );
  expect(textId).toBeTruthy();

  await page.waitForTimeout(400);

  await expect
    .poll(
      async () =>
        page.evaluate((id) => {
          const d = window.__maniE2E.debugTextExportCaptureForTest(id);
          return {
            ok: d?.ok === true,
            hasBr: /<br\s*\/?>/i.test(String(d?.captured || "")),
            wrapDisplay: d?.wrapDisplay === true,
            clientWidth: Number(d?.clientWidth) || 0
          };
        }, textId),
      { timeout: 8000, message: "soft-wrap export : <br> materialise a 200x60" }
    )
    .toMatchObject({ ok: true, hasBr: true, wrapDisplay: true });

  const debug = await page.evaluate(
    (id) => window.__maniE2E.debugTextExportCaptureForTest(id),
    textId
  );
  expect(debug?.ok).toBe(true);
  expect(Number(debug?.clientWidth)).toBeGreaterThanOrEqual(180);
  expect(String(debug?.captured || "")).toMatch(/<br\s*\/?>/i);

  const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
  expect(payload?.ok).toBe(true);
  const ann = payload?.annotationsByPage?.["1"]?.[0];
  expect(ann?.textHtml || "").toMatch(/<br\s*\/?>/i);
  expect(String(ann?.text || "")).toContain("encore");

  const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
  expect(exportResult?.ok).toBe(true);
  assertPdfContainsText(workPdf, "encore");

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});

test("export PDF : 2 lignes explicites (Enter) ne coupent pas les mots", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_text_explicit_two_lines.pdf");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  fs.copyFileSync(pdfFixture, workPdf);

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
    () => !!window.__maniE2E?.peekExportPayloadForTest,
    null,
    { timeout: 90000, polling: 250 }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  const textId = await page.evaluate(() =>
    window.__maniE2E.injectTextForTest({
      plain: "on ajoute un texte sur 2 lignes \nvoir si ça marche encore !",
      textHtml:
        "<div>on ajoute un texte <u>sur 2 lignes</u> <br><b>voir si</b> ça marche <font color=\"#00aa00\">encore !</font></div>",
      w: 280,
      h: 72,
      fontSize: 14,
      textWrapManual: true
    })
  );
  expect(textId).toBeTruthy();

  const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
  expect(payload?.ok).toBe(true);
  const ann = payload?.annotationsByPage?.["1"]?.[0];
  const exportHtml = String(ann?.textHtml || "");
  expect(exportHtml).not.toMatch(/v\s*<br\s*\/?>\s*oir/i);
  expect(exportHtml).not.toMatch(/>\s*v<br/i);

  const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
  expect(exportResult?.ok).toBe(true);
  assertPdfContainsText(workPdf, "voir");
  assertPdfContainsText(workPdf, "encore");

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});

test("export PDF : texte page 1 et page 4 visibles après enregistrement (page active ≠ page 4)", async () => {
  const workPdf = path.join(repoRoot, "tests", "test_export_text_multipage_p1_p4.pdf");
  const auditLog = path.join(repoRoot, "tests", "export-multipage-audit.log");
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
  if (fs.existsSync(auditLog)) fs.unlinkSync(auditLog);
  fs.copyFileSync(pdfFixture, workPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: workPdf,
      EDITRADOC_LOG_PATH: auditLog,
      MANI_PDF_LOG_VERBOSE: "1"
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => !!window.__maniE2E?.injectTextOnPageForTest,
    null,
    { timeout: 90000, polling: 250 }
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000
    })
    .toMatchObject({ ok: true });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, workPdf);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  const pageCount = await page.evaluate(() => window.__maniE2E.getUiState()?.pageCount || 1);
  expect(pageCount).toBeGreaterThanOrEqual(4);

  await page.evaluate(() =>
    window.__maniE2E.injectTextOnPageForTest(1, { plain: "EXPMP1" })
  );
  await page.evaluate(() =>
    window.__maniE2E.injectTextOnPageForTest(4, { plain: "EXPMP4" })
  );
  await page.evaluate(() => window.__maniE2E.setCurrentPageForTest(1));

  const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
  expect(payload?.ok).toBe(true);
  expect(payload?.annotationsByPage?.["1"]?.length).toBeGreaterThan(0);
  expect(payload?.annotationsByPage?.["4"]?.length).toBeGreaterThan(0);

  const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
  expect(exportResult?.ok).toBe(true);
  assertPdfContainsTextAnywhere(workPdf, "EXPMP1");
  assertPdfContainsTextAnywhere(workPdf, "EXPMP4");

  await e2eCi.closeElectronApp(app);
  if (fs.existsSync(workPdf)) fs.unlinkSync(workPdf);
});