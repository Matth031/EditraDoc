/**
 * Correcteur : IPC spellcheck:analyze doit renvoyer des erreurs pour du français faux
 * (régression dictionary-* ESM + chargement dynamique).
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) {
    throw new Error(`Fixture PDF introuvable: ${p}`);
  }
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

test("IPC spellcheckAnalyze détecte « trste » en fr-FR", async () => {
  const { app, page } = await launchApp();
  const res = await page.evaluate(async () => {
    const api = window.maniPdfApi;
    if (!api?.spellcheckAnalyze) return { missing: true };
    return api.spellcheckAnalyze({ lang: "fr-FR", text: "je suis trste" });
  });
  expect(res?.missing).toBeFalsy();
  expect(res?.ok).toBe(true);
  expect(Array.isArray(res?.errors)).toBe(true);
  expect(res.errors.length).toBeGreaterThan(0);
  const w = res.errors.find((e) => e.word === "trste");
  expect(w).toBeTruthy();
  await app.close();
});

test("annotation texte : même chaîne analysée que l’utilisateur (je suis trste)", async () => {
  const { app, page } = await launchApp();
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "je suis trste" })
  );
  expect(id && String(id).length > 0).toBeTruthy();

  const res = await page.evaluate(async () => {
    return window.maniPdfApi?.spellcheckAnalyze?.({ lang: "fr-FR", text: "je suis trste" });
  });
  expect(res?.ok).toBe(true);
  expect((res?.errors || []).length).toBeGreaterThan(0);

  await app.close();
});
