/**
 * Rotation de page PDF — E14 (AC-ROT-01 à 10).
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("node:child_process");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");
const {
  assertPdfContainsText,
  assertPdfHasEmbeddedImageXObjects
} = require("./export-image-assertions");

const repoRoot = path.resolve(process.cwd(), "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "test_page_rotate_export.pdf");
const outWysiwygPdf = path.join(repoRoot, "tests", "test_page_rotate_wysiwyg.pdf");
const rotatedFixture = path.join(repoRoot, "tests", "pdf_intrinsic_rotate270.pdf");
const createRotatedFixtureScript = path.join(process.cwd(), "scripts", "create-rotated-pdf-fixture.mjs");
const fallbackPng = path.join(process.cwd(), "public", "miniature_no_bg.png");

function ensureRotatedPdfFixture() {
  if (fs.existsSync(rotatedFixture)) return;
  const r = spawnSync(process.execPath, [createRotatedFixtureScript], { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(rotatedFixture)) {
    throw new Error(r.stderr || `Fixture rotation intrinsèque introuvable: ${rotatedFixture}`);
  }
}

async function launchWithRotatedPdf() {
  ensureRotatedPdfFixture();
  const ctx = await launchApp({ MANI_PDF_E2E_PDF_PATH: rotatedFixture });
  await ctx.app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, rotatedFixture);
  await waitForPdfPagesRendered(ctx.page);
  return ctx;
}

async function launchApp(envExtra = {}) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      ...envExtra
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () =>
      !!window.maniPdfApi &&
      window.__maniE2E?.rotatePageForTest &&
      window.__maniE2E?.getPageRotationForTest &&
      window.__maniE2E?.overwriteActivePdfForTest &&
      window.__maniE2E?.getPageRenderMetaForTest &&
      window.__maniE2E?.getThumbTitleForPageTest,
    null,
    { timeout: 90000, polling: 250 }
  );
  return { app, page };
}

async function launchWithPdf() {
  const ctx = await launchApp({ MANI_PDF_E2E_PDF_PATH: pdfFixture });
  await ctx.app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);
  await waitForPdfPagesRendered(ctx.page);
  return ctx;
}

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) {
    throw new Error(`Fixture introuvable: ${pdfFixture}`);
  }
  ensureRotatedPdfFixture();
  if (!fs.existsSync(raptorFixture)) {
    if (!fs.existsSync(fallbackPng)) {
      throw new Error(`Impossible de créer raptor.png : ${fallbackPng} introuvable`);
    }
    fs.mkdirSync(path.dirname(raptorFixture), { recursive: true });
    fs.copyFileSync(fallbackPng, raptorFixture);
  }
});

test("Rotation page : boutons désactivés sans PDF (AC-ROT-05)", async () => {
  const { app, page } = await launchApp();
  try {
    await page.evaluate(() => window.__maniE2E.resetUiState());
    expect(await page.evaluate(() => window.__maniE2E.areRotateButtonsDisabledForTest())).toBe(true);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : +90° UI et footer (AC-ROT-01)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    const before = await page.evaluate(() => window.__maniE2E.getPageRotationForTest());
    expect(before).toBe(0);

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));

    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()), {
        timeout: 15000
      })
      .toBe(90);

    const footer = await page.locator("#pageInfo").textContent();
    expect(footer || "").toMatch(/90/);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : multipage — seule la page active change (AC-ROT-02)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    const pageCount = await page.evaluate(() => window.__maniE2E.getUiState().pageCount);
    test.skip(!pageCount || pageCount < 2, "PDF mono-page : test ignoré");

    const rotPage1Before = await page.evaluate(() =>
      window.__maniE2E.getPageRotationForPageTest(1)
    );
    await page.evaluate(() => window.__maniE2E.setCurrentPageForTest(2));
    await page.evaluate(() => window.__maniE2E.rotatePageForTest("left"));

    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForPageTest(2)))
      .toBe(270);

    const rotPage1After = await page.evaluate(() =>
      window.__maniE2E.getPageRotationForPageTest(1)
    );
    expect(rotPage1After).toBe(rotPage1Before);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : cycle 360° (AC-ROT-06)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    }
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(0);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : undo rétablit l’angle (AC-ROT-10)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(90);

    await page.click("#undoBtn");
    await expect.poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest())).toBe(0);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : bloquée pendant édition texte (AC-ROT-08)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    const textId = await page.evaluate(() =>
      window.__maniE2E.injectTextForTest({ plain: "ROT_BLOCK" })
    );
    expect(textId).toBeTruthy();
    await page.evaluate((id) => window.__maniE2E.beginTextEditForTest(id), textId);

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));

    expect(await page.evaluate(() => window.__maniE2E.getPageRotationForTest())).toBe(0);
    const status = await page.evaluate(() => window.__maniE2E.getStatusTextForTest());
    expect(status.length).toBeGreaterThan(0);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : export écrit /Rotate (AC-ROT-03)", async () => {
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const { app, page } = await launchWithPdf();
  try {
    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ ok: true, export_ready: true });

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(90);

    const exportResult = await page.evaluate(
      (p) => window.__maniE2E.exportActivePdfToPathForTest(p),
      outPdf
    );
    expect(exportResult?.ok).toBeTruthy();
    expect(fs.existsSync(outPdf)).toBeTruthy();

    const raw = fs.readFileSync(outPdf).toString("latin1");
    expect(raw).toMatch(/\/Rotate\s+90/);
  } finally {
    await e2eCi.closeElectronApp(app);
    if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);
  }
});

test("Rotation page : -90° sur PDF /Rotate natif 270° (AC-ROT-04)", async () => {
  const { app, page } = await launchWithRotatedPdf();
  try {
    const before = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(before.intrinsic).toBe(270);
    expect(before.user).toBe(0);

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("left"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(270);

    const after = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(after.user).toBe(270);
    expect(after.h).not.toBe(before.h);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : /Rotate PDF natif affiché droit sans delta (AC-ROT-07)", async () => {
  const { app, page } = await launchWithRotatedPdf();
  try {
    const meta = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(meta).toBeTruthy();
    expect(meta.intrinsic).toBe(270);
    expect(meta.user).toBe(0);
    expect(meta.absolute).toBe(270);
    expect(meta.h).toBeGreaterThan(meta.w);

    const thumbTitle = await page.evaluate(() => window.__maniE2E.getThumbTitleForPageTest(1));
    expect(thumbTitle).not.toMatch(/°/);
    expect(thumbTitle).toMatch(/1/);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("Rotation page : écrasement PDF /Rotate natif + delta utilisateur (AC-ROT-11)", async () => {
  const tmpDir = path.join(repoRoot, "tests", "_tmp_rotate_intrinsic_overwrite");
  const tmpPdf = path.join(tmpDir, "intrinsic_overwrite.pdf");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.copyFileSync(rotatedFixture, tmpPdf);

  const { app, page } = await launchApp({ MANI_PDF_E2E_PDF_PATH: tmpPdf });
  try {
    await app.evaluate(({ BrowserWindow }, p) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents?.send?.("pdf:open-from-menu", p);
    }, tmpPdf);
    await waitForPdfPagesRendered(page);

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ ok: true, export_ready: true });

    const before = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(before.intrinsic).toBe(270);
    expect(before.user).toBe(0);
    expect(before.h).toBeGreaterThan(before.w);

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(90);

    const rotated = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(rotated.absolute).toBe(0);
    expect(rotated.w).toBeGreaterThan(rotated.h);

    const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
    expect(exportResult?.ok).toBeTruthy();

    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(0);

    const after = await page.evaluate(() => window.__maniE2E.getPageRenderMetaForTest(1));
    expect(after.intrinsic).toBe(0);
    expect(after.user).toBe(0);
    expect(after.w).toBe(rotated.w);
    expect(after.h).toBe(rotated.h);

    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getThumbTitleForPageTest(1)))
      .not.toMatch(/°/);
  } finally {
    await e2eCi.closeElectronApp(app);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

test("Rotation page : écrasement même fichier réinitialise le delta utilisateur (AC-ROT-09)", async () => {
  const tmpDir = path.join(repoRoot, "tests", "_tmp_rotate_overwrite");
  const tmpPdf = path.join(tmpDir, "overwrite_rotate.pdf");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.copyFileSync(pdfFixture, tmpPdf);

  const { app, page } = await launchApp({ MANI_PDF_E2E_PDF_PATH: tmpPdf });
  try {
    await app.evaluate(({ BrowserWindow }, p) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents?.send?.("pdf:open-from-menu", p);
    }, tmpPdf);
    await waitForPdfPagesRendered(page);

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ ok: true, export_ready: true });

    const sizeBefore = await page.evaluate(() => {
      const c = document.querySelector('.pdf-page[data-page="1"] canvas.pdf-canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    expect(sizeBefore).toBeTruthy();

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(90);

    const sizeRotated = await page.evaluate(() => {
      const c = document.querySelector('.pdf-page[data-page="1"] canvas.pdf-canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    expect(sizeRotated).toBeTruthy();
    expect(sizeRotated.h).not.toBe(sizeBefore.h);

    const exportResult = await page.evaluate(() => window.__maniE2E.overwriteActivePdfForTest());
    expect(exportResult?.ok).toBeTruthy();

    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(0);

    const sizeAfter = await page.evaluate(() => {
      const c = document.querySelector('.pdf-page[data-page="1"] canvas.pdf-canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    expect(sizeAfter).toEqual(sizeRotated);
  } finally {
    await e2eCi.closeElectronApp(app);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

test("Rotation page : WYSIWYG annotations après rotation (AC-ROT-03)", async () => {
  if (fs.existsSync(outWysiwygPdf)) fs.unlinkSync(outWysiwygPdf);

  const { app, page } = await launchWithPdf();
  try {
    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ ok: true, export_ready: true });

    const textId = await page.evaluate(() =>
      window.__maniE2E.injectTextForTest({ plain: "ROT_WYSIWYG" })
    );
    expect(textId).toBeTruthy();
    const shapeId = await page.evaluate(() => window.__maniE2E.injectShapeForTest("rect"));
    expect(shapeId).toBeTruthy();
    await page.locator("#addImageBtn").click();
    await page.locator("#imageInput").setInputFiles(raptorFixture);
    await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
      timeout: 15000
    });

    await page.evaluate(() => window.__maniE2E.rotatePageForTest("right"));
    await expect
      .poll(() => page.evaluate(() => window.__maniE2E.getPageRotationForTest()))
      .toBe(90);

    const exportResult = await page.evaluate(
      (p) => window.__maniE2E.exportActivePdfToPathForTest(p),
      outWysiwygPdf
    );
    expect(exportResult?.ok).toBe(true);
    assertPdfContainsText(outWysiwygPdf, "ROT_WYSIWYG");
    assertPdfHasEmbeddedImageXObjects(outWysiwygPdf, 1);
  } finally {
    await e2eCi.closeElectronApp(app);
    if (fs.existsSync(outWysiwygPdf)) fs.unlinkSync(outWysiwygPdf);
  }
});
