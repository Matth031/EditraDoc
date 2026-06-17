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

const fixturesDir = path.join(__dirname, "fixtures", "html");
const guideHtml = path.join(fixturesDir, "test-guide_appel.html");
const guidePdf = path.join(fixturesDir, "test-guide_appel.pdf");
const resultJson = path.join(fixturesDir, "test-guide_appel.convert-result.json");

/** true = supprimer le PDF (et le rapport JSON) en fin de test ; false = conserver pour debug */
const DELETE_OUTPUT_PDF = true;

test.beforeAll(() => {
  if (!fs.existsSync(guideHtml)) {
    throw new Error(`Fixture introuvable: ${guideHtml}`);
  }
});

test("HTML → PDF : test-guide_appel.html (document métier + ouverture UI)", async () => {
  if (DELETE_OUTPUT_PDF && fs.existsSync(guidePdf)) fs.unlinkSync(guidePdf);
  if (DELETE_OUTPUT_PDF && fs.existsSync(resultJson)) fs.unlinkSync(resultJson);

  const app = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: e2eCi.mergeProcessEnv({
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_HTML_PATH: guideHtml
    })
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => window.__maniE2E?.getUiState && window.__editifyHtmlConvert,
      null,
      {
        timeout: 60000
      }
    );

    const t0 = Date.now();
    await page.evaluate(async (fixturePath) => {
      await window.__editifyHtmlConvert.runConversionWithPath(fixturePath);
    }, guideHtml);

    await waitForPdfPagesRendered(page);

    const elapsedMs = Date.now() - t0;
    const ui = await page.evaluate(() => window.__maniE2E?.getUiState?.() || {});

    assertHtmlToPdfCreatedWithoutError(expect, { ok: true, outputPath: guidePdf }, guidePdf, {
      minSizeBytes: 5000
    });
    expect(ui.pageCount, "PDF ouvert dans l'interface").toBeGreaterThan(0);

    const stat = fs.statSync(guidePdf);
    const report = {
      ranAt: new Date().toISOString(),
      input: guideHtml,
      output: guidePdf,
      elapsedMs,
      pdfSizeBytes: stat.size,
      pageCount: ui.pageCount,
      deleteAfterTest: DELETE_OUTPUT_PDF
    };
    fs.writeFileSync(resultJson, JSON.stringify(report, null, 2), "utf8");
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(guidePdf, DELETE_OUTPUT_PDF, [resultJson]);
  }
});
