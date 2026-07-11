/**
 * Diagnostic E2E : capture console main/renderer + état bootstrap lors d'une ouverture PDF.
 * Usage (depuis app/) :
 *   npx playwright test e2e/diag-pdf-open-console.spec.js --reporter=line
 * Log écrit dans test-results/diag-pdf-open-console.log
 * Voir scripts/diag-e2e-console.md
 */
const { test, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) throw new Error(`Fixture PDF introuvable: ${p}`);
  return p;
}

test("DIAG: console + bootstrap + ouverture PDF", async () => {
  const pdfPath = getRepoPdfFixture();
  const logs = [];
  const push = (source, level, text) => {
    logs.push(`[${source}][${level}] ${text}`);
  };

  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfPath
    })
  });

  app.on("console", (msg) => {
    push("main-process", msg.type(), msg.text());
  });

  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  page.on("console", (msg) => {
    push("renderer", msg.type(), msg.text());
  });
  page.on("pageerror", (err) => {
    push("renderer", "pageerror", String(err?.stack || err));
  });
  page.on("requestfailed", (req) => {
    push(
      "network",
      "requestfailed",
      `${req.method()} ${req.url()} — ${req.failure()?.errorText || "?"}`
    );
  });

  await page.waitForLoadState("domcontentloaded");

  const bootstrap = await page.evaluate(() => ({
    href: location.href,
    domPurify: typeof window.DOMPurify,
    editifySanitizeHtml: typeof window.__editifySanitizeHtml,
    editifyTextHtml: typeof window.__editifyTextHtml,
    maniPdfApi: typeof window.maniPdfApi,
    maniE2E: typeof window.__maniE2E,
    maniE2E_getUiState: typeof window.__maniE2E?.getUiState,
    tabCount: document.querySelectorAll("#tabs .tab").length
  }));
  push("diag", "bootstrap", JSON.stringify(bootstrap, null, 2));

  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });

  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);

  await page.waitForTimeout(35000);

  const afterOpen = await page.evaluate(() => ({
    tabCount: document.querySelectorAll("#tabs .tab").length,
    pdfPages: document.querySelectorAll("#pagesContainer .pdf-page").length,
    maniE2E_getUiState: typeof window.__maniE2E?.getUiState,
    statusHistory: window.__maniStatusHistory || []
  }));
  push("diag", "after-open-35s", JSON.stringify(afterOpen, null, 2));

  const outPath = path.join(process.cwd(), "test-results", "diag-pdf-open-console.log");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, logs.join("\n"), "utf8");

  for (const line of logs) {
    console.log(line);
  }
  console.log(`[diag][saved] ${outPath}`);

  await e2eCi.closeElectronApp(app);
});
