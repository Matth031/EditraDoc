/**
 * Diagnostic latence spellcheck:analyze (MANI_PDF_SPELLCHECK_DIAG=1).
 * Hors test:all — npm run test:spellcheck-diag
 */
const { test, expect, _electron: electron } = require("./editra-test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("node:child_process");
const { waitForPdfPagesRendered } = require("./helpers");

const REPO_ROOT = path.resolve(process.cwd(), "..");
const FIXTURE_PATH = path.join(REPO_ROOT, "tests", "pdf_perf_75pages.pdf");
const REPORT_PATH = path.join(process.cwd(), "e2e-output", "spellcheck-diag-report.json");

function ensureFixture() {
  if (fs.existsSync(FIXTURE_PATH)) return FIXTURE_PATH;
  execFileSync(
    process.execPath,
    [path.join(process.cwd(), "scripts", "create-multi-page-pdf-fixture.mjs")],
    {
      cwd: process.cwd(),
      stdio: "inherit"
    }
  );
  return FIXTURE_PATH;
}

async function launchApp() {
  const pdfPath = ensureFixture();
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_PERF_INSTRUMENT: "1",
      MANI_PDF_SPELLCHECK_DIAG: "1",
      MANI_PDF_E2E_PDF_PATH: pdfPath
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi?.spellcheckAnalyze);
  return { app, page, pdfPath };
}

async function openPdf(app, page, pdfPath) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
    window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.();
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 120000 });
  await waitForPdfPagesRendered(page, { timeoutMs: 600000 });
}

async function runScenarioBOnce(page) {
  await page.evaluate(() => window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.());
  const before = await page.locator("#annotationLayer .annotation.text").count();
  await page.locator("#addTextBtn").click();
  const annos = page.locator("#annotationLayer .annotation.text");
  await expect(annos).toHaveCount(before + 1, { timeout: 15000 });
  const anno = annos.last();
  await anno.click();
  const editor = anno.locator(".text-editor");
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.waitForTimeout(5800);
  await page.keyboard.type("ceci est un trste orthographique long ", { delay: 40 });
  await page.waitForTimeout(7500);
  return page.evaluate(() => {
    const tab = window.__maniE2E?.getUiState?.();
    const samples = window.maniPdfApi?.getPerfInstrumentSpellIpcSamples?.() || [];
    const pageKey = String(tab?.currentPage || 1);
    const annosOnPage = document.querySelectorAll("#annotationLayer .annotation.text");
    return {
      pageKey,
      textAnnotationDomCount: annosOnPage.length,
      ipcSamples: samples
    };
  });
}

test.describe.configure({ mode: "serial", timeout: 900000 });

test("spellcheck diag — scénario B x3 même session + cold IPC direct", async () => {
  const { app, page, pdfPath } = await launchApp();
  const report = { fixture: pdfPath, runs: [] };

  try {
    await openPdf(app, page, pdfPath);

    for (let i = 0; i < 3; i += 1) {
      const row = await runScenarioBOnce(page);
      report.runs.push({ iteration: i + 1, sameSession: true, ...row });
    }

    const coldProbe = await page.evaluate(async () => {
      window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.();
      const t0 = performance.now();
      const res = await window.maniPdfApi.spellcheckAnalyze({
        lang: "fr-FR",
        text: "bonjour trste"
      });
      return {
        ipcMs: performance.now() - t0,
        ok: Boolean(res?.ok),
        diag: res?._diag,
        errors: Array.isArray(res?.errors) ? res.errors.length : 0
      };
    });

    const warmProbe = await page.evaluate(async () => {
      window.maniPdfApi?.resetPerfInstrumentSpellIpcSamples?.();
      const t0 = performance.now();
      const res = await window.maniPdfApi.spellcheckAnalyze({
        lang: "fr-FR",
        text: "bonjour trste encore"
      });
      return {
        ipcMs: performance.now() - t0,
        ok: Boolean(res?.ok),
        diag: res?._diag,
        errors: Array.isArray(res?.errors) ? res.errors.length : 0
      };
    });

    report.directProbes = { coldAfterWarmSession: coldProbe, warmImmediate: warmProbe };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log("[spellcheck-diag]", JSON.stringify(report, null, 2));

    const allIpc = report.runs.flatMap((r) => r.ipcSamples || []);
    expect(allIpc.length).toBeGreaterThan(0);

    const withText = allIpc.filter((s) => s.textLen > 0 && s.diag);
    expect(withText.length).toBeGreaterThan(0);
    for (const sample of withText) {
      expect(sample.diag.spellWasLoadedBefore).toBe(true);
      expect(sample.diag.getSpellMs).toBeLessThan(5);
    }

    expect(warmProbe.ipcMs).toBeLessThan(500);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});
