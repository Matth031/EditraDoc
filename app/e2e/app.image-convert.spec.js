const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const {
  assertHtmlToPdfCreatedWithoutError,
  cleanupGeneratedPdf,
  waitForPdfPagesRendered
} = require("./helpers");

const repoRoot = path.resolve(process.cwd(), "..");
const raptorPng = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "raptor.pdf");

const DELETE_OUTPUT_PDF = true;

test.beforeAll(() => {
  const fallback = path.join(process.cwd(), "public", "miniature_no_bg.png");
  if (!fs.existsSync(raptorPng)) {
    if (!fs.existsSync(fallback)) {
      throw new Error(`Fixture image introuvable: ${raptorPng}`);
    }
    fs.mkdirSync(path.dirname(raptorPng), { recursive: true });
    fs.copyFileSync(fallback, raptorPng);
  }
});

test("Image → PDF : PNG via IPC (AC-IMG-01)", async () => {
  if (DELETE_OUTPUT_PDF && fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_IMAGE_PATHS: JSON.stringify([raptorPng])
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.maniPdfApi && window.__maniE2E, null, {
      timeout: 60000
    });

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000,
        message: "Service Python requis pour la conversion image."
      })
      .toMatchObject({ ok: true, export_ready: true });

    const result = await page.evaluate(
      async (paths) => {
        return window.maniPdfApi.convertImagesToPdf({ inputPaths: paths });
      },
      [raptorPng]
    );

    assertHtmlToPdfCreatedWithoutError(expect, result, outPdf);
    expect(result.pageCount).toBe(1);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(outPdf, DELETE_OUTPUT_PDF);
  }
});

test("Image → PDF : ouverture UI après conversion (AC-IMG-02)", async () => {
  if (DELETE_OUTPUT_PDF && fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_IMAGE_PATHS: JSON.stringify([raptorPng])
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => window.__maniE2E?.getUiState && window.__editifyImageConvert,
      null,
      { timeout: 60000 }
    );

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ export_ready: true });

    await page.evaluate(
      async (paths) => {
        await window.__editifyImageConvert.runConversionWithPaths(paths);
      },
      [raptorPng]
    );

    await waitForPdfPagesRendered(page);
    assertHtmlToPdfCreatedWithoutError(expect, { ok: true, outputPath: outPdf }, outPdf);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(outPdf, DELETE_OUTPUT_PDF);
  }
});

test("Image → PDF : multipage (2 images)", async () => {
  const outMulti = path.join(repoRoot, "tests", "raptor.pdf");
  if (DELETE_OUTPUT_PDF && fs.existsSync(outMulti)) fs.unlinkSync(outMulti);

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    env: e2eCi.mergeProcessEnv({ MANI_PDF_E2E: "1" })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.maniPdfApi, null, { timeout: 60000 });

    await expect
      .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
        timeout: 60000
      })
      .toMatchObject({ export_ready: true });

    const result = await page.evaluate(
      async (paths) => window.maniPdfApi.convertImagesToPdf({ inputPaths: paths }),
      [raptorPng, raptorPng]
    );

    assertHtmlToPdfCreatedWithoutError(expect, result, outMulti);
    expect(result.pageCount).toBe(2);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(outMulti, DELETE_OUTPUT_PDF);
  }
});
