/**
 * Régression : clic droit sur zone vierge => menu d'ajouts rapides.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) throw new Error(`Fixture PDF introuvable: ${p}`);
  return p;
}

async function launchApp() {
  const pdfPath = getRepoPdfFixture();
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
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function openPdfFromMenu(app, page) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
  });
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });
  await waitForPdfPagesRendered(page);
}

test("clic droit sur canvas vierge -> menu -> ajouter texte", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  // Clic droit sur une zone "vide" de la page (pas sur une annotation).
  await page.locator("#annotationLayer").click({ button: "right", position: { x: 260, y: 180 } });

  const menu = page.locator("#blankCanvasCtxMenu");
  await expect(menu).toBeVisible({ timeout: 8000 });
  await page.locator("#blankAddTextBtn").click();

  await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(1, {
    timeout: 15000
  });
  await e2eCi.closeElectronApp(app);
});
