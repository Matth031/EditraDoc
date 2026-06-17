const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { assertHtmlToPdfCreatedWithoutError, cleanupGeneratedPdf } = require("./helpers");

const repoRoot = path.resolve(process.cwd(), "..");
const guideHtml = path.join(repoRoot, "tests", "test-guide_appel.html");
const guidePdf = path.join(repoRoot, "tests", "test-guide_appel.pdf");
const resultJson = path.join(repoRoot, "tests", "test-guide_appel.convert-result.json");

/** true = supprimer le PDF (et le rapport JSON) en fin de test ; false = conserver pour debug */
const DELETE_OUTPUT_PDF = true;

test.beforeAll(() => {
  if (!fs.existsSync(guideHtml)) {
    throw new Error(`Fixture introuvable: ${guideHtml}`);
  }
});

test("HTML → PDF : test-guide_appel.html (document métier)", async () => {
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
    await page.waitForFunction(() => window.maniPdfApi, null, { timeout: 60000 });

    const t0 = Date.now();
    const result = await page.evaluate(async (fixturePath) => {
      return window.maniPdfApi.convertHtmlToPdf({ inputPath: fixturePath });
    }, guideHtml);

    const elapsedMs = Date.now() - t0;

    assertHtmlToPdfCreatedWithoutError(expect, result, guidePdf, { minSizeBytes: 5000 });
    expect(path.normalize(result.outputPath || "")).toBe(path.normalize(guidePdf));
    expect(result.missingAssets || []).toHaveLength(0);

    const stat = fs.statSync(guidePdf);
    const report = {
      ranAt: new Date().toISOString(),
      input: guideHtml,
      output: guidePdf,
      elapsedMs,
      pdfSizeBytes: stat.size,
      missingAssets: result.missingAssets || [],
      blockedRemote: Boolean(result.blockedRemote),
      deleteAfterTest: DELETE_OUTPUT_PDF
    };
    fs.writeFileSync(resultJson, JSON.stringify(report, null, 2), "utf8");
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanupGeneratedPdf(guidePdf, DELETE_OUTPUT_PDF, [resultJson]);
  }
});
