/**
 * Capture P1 — payloads réels via peekExportPayloadForTest (AVANT fige schéma).
 * Miroir des scénarios baseline export (regression / soft-wrap / Enter / packagé si dispo).
 * Sortie : tmp/p1-export-payloads/*.json (src_base64 tronqué).
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");

const appDir = process.cwd();
const repoRoot = path.resolve(appDir, "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const fallbackPng = path.join(appDir, "public", "miniature_no_bg.png");
const outDir = path.join(appDir, "tmp", "p1-export-payloads");
const goldenDir = path.join(appDir, "node-tests", "fixtures", "p1-export-golden");
const packagedExe = path.join(appDir, "dist", "win-unpacked", "EditraDoc.exe");

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeForCapture(value) {
  if (Array.isArray(value)) return value.map(sanitizeForCapture);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "src_base64" && typeof v === "string") {
        out[k] = {
          _truncated: true,
          length: v.length,
          prefix: v.slice(0, 24),
          suffix: v.slice(-8)
        };
      } else if (k === "src" && typeof v === "string" && v.length > 80) {
        out[k] = { _truncated: true, length: v.length, prefix: v.slice(0, 40) };
      } else {
        out[k] = sanitizeForCapture(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * @param {string} name
 * @param {unknown} payload peek brut (ok, inputPath, canvases, annotationsByPage)
 * @param {{ truncateBase64?: boolean }} [opts]
 */
function writeCapture(name, payload, opts = {}) {
  const truncateBase64 = opts.truncateBase64 !== false;
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(goldenDir, { recursive: true });

  const forHuman = {
    capturedAt: new Date().toISOString(),
    scenario: name,
    payload: truncateBase64 ? sanitizeForCapture(payload) : payload
  };
  const humanFile = path.join(outDir, `${name}.json`);
  fs.writeFileSync(humanFile, `${JSON.stringify(forHuman, null, 2)}\n`, "utf8");

  // Golden : peek payload complet (src_base64 réel) — tests mappertont peek→IPC.
  const goldenFile = path.join(goldenDir, `${name}.peek.json`);
  fs.writeFileSync(
    goldenFile,
    `${JSON.stringify({ capturedAt: new Date().toISOString(), scenario: name, payload }, null, 2)}\n`,
    "utf8"
  );
  return { humanFile, goldenFile };
}

/**
 * @param {{ executablePath?: string }} [opts]
 */
async function launchWithPdf(opts = {}) {
  const exe = opts.executablePath || electronPath;
  const app = await electron.launch({
    executablePath: exe,
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
  await page.waitForFunction(() => !!window.__maniE2E?.peekExportPayloadForTest, null, {
    timeout: 120000,
    polling: 250
  });
  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000
    })
    .toMatchObject({ ok: true });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 60000 });
  await waitForPdfPagesRendered(page);
  return { app, page };
}

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) throw new Error(`Fixture introuvable: ${pdfFixture}`);
  if (!fs.existsSync(raptorFixture)) {
    if (!fs.existsSync(fallbackPng)) throw new Error("raptor/fallback PNG manquant");
    fs.mkdirSync(path.dirname(raptorFixture), { recursive: true });
    fs.copyFileSync(fallbackPng, raptorFixture);
  }
  fs.mkdirSync(outDir, { recursive: true });
});

test("capture : STYLE_EXPORT + rect + image (miroirexport-annotations-regression)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    await page.evaluate(() =>
      window.__maniE2E.injectTextForTest({
        plain: "STYLE_EXPORT",
        fontFamily: "Times New Roman",
        fontSize: 28,
        textColor: "#cc0000",
        padding: 10
      })
    );
    await page.evaluate(() => window.__maniE2E.injectShapeForTest("rect"));
    await page.locator("#addImageBtn").click();
    await page.locator("#imageInput").setInputFiles(raptorFixture);
    await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
      timeout: 15000
    });

    const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
    expect(payload?.ok).toBe(true);
    const files = writeCapture("01-style-export-shape-image", payload);
    console.log("[p1-capture]", files.goldenFile);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("capture : soft-wrap <br> (miroir app.export-image soft-wrap)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    const textId = await page.evaluate(() =>
      window.__maniE2E.injectTextForTest({
        plain: "on ajoute un texte voir si ça marche encore !",
        textHtml:
          '<div>on ajoute un texte <b>voir si</b> ça marche <font color="#00aa00">encore !</font></div>',
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
            return /<br\s*\/?>/i.test(String(d?.captured || ""));
          }, textId),
        { timeout: 8000 }
      )
      .toBe(true);

    const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
    expect(payload?.ok).toBe(true);
    const files = writeCapture("02-soft-wrap", payload);
    console.log("[p1-capture]", files.goldenFile);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("capture : Enter explicite 2 lignes (miroir export-image)", async () => {
  const { app, page } = await launchWithPdf();
  try {
    await page.evaluate(() =>
      window.__maniE2E.injectTextForTest({
        plain: "on ajoute un texte sur 2 lignes \nvoir si ça marche encore !",
        textHtml:
          '<div>on ajoute un texte <u>sur 2 lignes</u> <br><b>voir si</b> ça marche <font color="#00aa00">encore !</font></div>',
        w: 280,
        h: 72,
        fontSize: 14,
        textWrapManual: true
      })
    );
    const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
    expect(payload?.ok).toBe(true);
    const files = writeCapture("03-explicit-enter-two-lines", payload);
    console.log("[p1-capture]", files.goldenFile);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});

test("capture : packagé image seule (si win-unpacked présent)", async () => {
  test.skip(!fs.existsSync(packagedExe), `Build packagé absent : ${packagedExe}`);
  const { app, page } = await launchWithPdf({ executablePath: packagedExe });
  try {
    await page.locator("#addImageBtn").click();
    await page.locator("#imageInput").setInputFiles(raptorFixture);
    await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
      timeout: 15000
    });
    const payload = await page.evaluate(() => window.__maniE2E.peekExportPayloadForTest());
    expect(payload?.ok).toBe(true);
    const files = writeCapture("04-packaged-image-only", payload);
    console.log("[p1-capture]", files.goldenFile);
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});
