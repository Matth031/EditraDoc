const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { assertHtmlToPdfCreatedWithoutError, cleanupGeneratedPdf } = require("./helpers");

const fixturesDir = path.join(__dirname, "fixtures", "html");
const htmlFixture = path.join(fixturesDir, "html-convert-minimal.html");
const outPdf = path.join(fixturesDir, "html-convert-minimal.pdf");

/** true = supprimer les PDF générés en fin de test ; false = conserver pour debug */
const DELETE_OUTPUT_PDF = true;

test.beforeAll(() => {
  if (!fs.existsSync(htmlFixture)) {
    throw new Error(`Fixture introuvable: ${htmlFixture}`);
  }
});

test("HTML → PDF : conversion nominale via IPC (AC-HTML-01)", async () => {
  if (DELETE_OUTPUT_PDF && fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_HTML_PATH: htmlFixture
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.__maniE2E && window.maniPdfApi, null, {
      timeout: 60000
    });

    const result = await page.evaluate(async (fixturePath) => {
      return window.maniPdfApi.convertHtmlToPdf({ inputPath: fixturePath });
    }, htmlFixture);

    assertHtmlToPdfCreatedWithoutError(expect, result, outPdf);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(outPdf, DELETE_OUTPUT_PDF);
  }
});

test("HTML → PDF : écrasement silencieux PDF existant (AC-HTML-02)", async () => {
  if (DELETE_OUTPUT_PDF && fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_HTML_PATH: htmlFixture
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.maniPdfApi, null, { timeout: 60000 });

    const first = await page.evaluate(async (fixturePath) => {
      return window.maniPdfApi.convertHtmlToPdf({ inputPath: fixturePath });
    }, htmlFixture);
    assertHtmlToPdfCreatedWithoutError(expect, first, outPdf);
    const size1 = fs.statSync(outPdf).size;

    const second = await page.evaluate(async (fixturePath) => {
      return window.maniPdfApi.convertHtmlToPdf({ inputPath: fixturePath });
    }, htmlFixture);
    assertHtmlToPdfCreatedWithoutError(expect, second, outPdf);
    const size2 = fs.statSync(outPdf).size;
    expect(size2).toBeGreaterThan(0);
    expect(size1).toBeGreaterThan(0);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(outPdf, DELETE_OUTPUT_PDF);
  }
});

test("HTML → PDF : asset manquant signalé (AC-HTML-03)", async () => {
  const missingFixture = path.join(fixturesDir, "html-convert-missing-asset.html");
  const missingOut = path.join(fixturesDir, "html-convert-missing-asset.pdf");
  if (!fs.existsSync(missingFixture)) {
    throw new Error(`Fixture introuvable: ${missingFixture}`);
  }
  if (DELETE_OUTPUT_PDF && fs.existsSync(missingOut)) fs.unlinkSync(missingOut);

  const app = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_HTML_PATH: missingFixture
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.maniPdfApi, null, { timeout: 60000 });

    const result = await page.evaluate(async (fixturePath) => {
      return window.maniPdfApi.convertHtmlToPdf({ inputPath: fixturePath });
    }, missingFixture);

    assertHtmlToPdfCreatedWithoutError(expect, result, missingOut);
    expect(Array.isArray(result?.missingAssets)).toBe(true);
    expect(result.missingAssets.length).toBeGreaterThan(0);
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(missingOut, DELETE_OUTPUT_PDF);
  }
});
