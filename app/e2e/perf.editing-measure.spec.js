/**
 * Mesures perf édition (instrumentation MANI_PDF_PERF_INSTRUMENT=1).
 * Non inclus dans test:all — lancer : npm run test:perf-instrument
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
const REPORT_PATH = path.join(process.cwd(), "e2e-output", "perf-editing-report.json");

function ensureFixture() {
  if (fs.existsSync(FIXTURE_PATH)) return FIXTURE_PATH;
  const script = path.join(process.cwd(), "scripts", "create-multi-page-pdf-fixture.mjs");
  execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: "inherit" });
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Fixture perf introuvable: ${FIXTURE_PATH}`);
  }
  return FIXTURE_PATH;
}

async function launchPerfApp(pdfPath) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_PERF_INSTRUMENT: "1",
      MANI_PDF_E2E_PDF_PATH: pdfPath
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi?.isPerfInstrumentEnabled?.());
  await page.waitForFunction(() => window.__editifyPerfInstrument?.isEnabled?.() === true);
  return { app, page };
}

async function openPdf(app, page, pdfPath) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
    window.__editifyPerfInstrument?.resetAll?.();
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 120000 });
  await waitForPdfPagesRendered(page, { timeoutMs: 600000 });
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });
}

async function addTextAnnotation(page) {
  const annos = page.locator("#annotationLayer .annotation.text");
  const before = await annos.count();
  await page.locator("#addTextBtn").click();
  await expect(annos).toHaveCount(before + 1, { timeout: 15000 });
  return annos.last();
}

async function addShapeAnnotation(page) {
  const annos = page.locator("#annotationLayer .annotation.rect");
  const before = await annos.count();
  await page.locator("#addShapeBtn").click();
  await page.locator("#shapeGrid button[data-shape='rect']").click();
  await expect(annos).toHaveCount(before + 1, { timeout: 15000 });
  return annos.last();
}

async function runScenario(page, name, fn) {
  await page.evaluate((scenarioName) => {
    window.__editifyPerfInstrument?.resetAll?.();
    window.__editifyPerfInstrument?.beginScenario?.(scenarioName);
  }, name);
  await fn();
  return page.evaluate(() => {
    window.__editifyPerfInstrument?.endScenario?.();
    return window.__editifyPerfInstrument?.getReport?.();
  });
}

test.describe.configure({ mode: "serial", timeout: 900000 });

test("mesure perf édition — rapport chiffré", async () => {
  const pdfPath = ensureFixture();
  const { app, page } = await launchPerfApp(pdfPath);
  const partialReports = [];

  try {
    await openPdf(app, page, pdfPath);

    const scenarioA = await runScenario(page, "A_color_slider_2s", async () => {
      await addShapeAnnotation(page);
      await page.locator("#propShapeFillOpacity").focus();
      await page.evaluate(async () => {
        const el = document.getElementById("propShapeFillOpacity");
        if (!el) throw new Error("propShapeFillOpacity missing");
        const steps = 120;
        const delayMs = 16;
        for (let i = 0; i < steps; i += 1) {
          el.value = String(Math.round((i * 100) / steps));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise((r) => setTimeout(r, delayMs));
        }
      });
    });
    partialReports.push(scenarioA.scenarios?.[0]);

    const scenarioB = await runScenario(page, "B_type_during_spell", async () => {
      const anno = await addTextAnnotation(page);
      await anno.click();
      const editor = anno.locator(".text-editor");
      await expect(editor).toBeVisible({ timeout: 10000 });
      await editor.click();
      await page.waitForTimeout(5800);
      await page.keyboard.type("ceci est un trste orthographique long ", { delay: 40 });
      await page.waitForTimeout(7500);
    });
    partialReports.push(scenarioB.scenarios?.[0]);

    const scenarioC = await runScenario(page, "C_rapid_props", async () => {
      const anno = await addTextAnnotation(page);
      await anno.click();
      await page.locator("#propTextColor").evaluate((el) => {
        el.value = "#336699";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.locator("#propFontFamily").selectOption("Georgia");
      await page.locator("#propFontSize").evaluate((el) => {
        el.value = "22";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.locator("#propPadding").evaluate((el) => {
        el.value = "12";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(300);
    });
    partialReports.push(scenarioC.scenarios?.[0]);

    const report = {
      fixture: pdfPath,
      pageCount: await page.evaluate(() => window.__maniE2E?.getUiState?.()?.pageCount),
      generatedAt: new Date().toISOString(),
      scenarios: partialReports.filter(Boolean)
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log("[perf-editing]", JSON.stringify(report, null, 2));

    expect(report.scenarios.length).toBe(3);
    const rowA = report.scenarios.find((s) => s.scenario === "A_color_slider_2s");
    expect(rowA?.applySelectedPropertiesLive?.count).toBeGreaterThan(100);
    expect(rowA?.renderAnnotations?.count).toBeGreaterThan(100);
    const rowB = report.scenarios.find((s) => s.scenario === "B_type_during_spell");
    expect(rowB?.spellBackgroundScan?.count).toBeGreaterThan(0);
    const rowC = report.scenarios.find((s) => s.scenario === "C_rapid_props");
    expect(rowC?.renderAnnotations?.count).toBeGreaterThan(3);
  } finally {
    await app.close();
  }
});
