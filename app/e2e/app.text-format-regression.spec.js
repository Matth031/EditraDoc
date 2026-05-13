/**
 * Régression : sans sélection, Gras / Italique / Souligné s’appliquent à tout le bloc texte
 * (ctxMenuExecFormat sélectionne tout le contentEditable si caret seul).
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

async function openPdf(app, page) {
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
}

test("sans sélection : Gras couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "bonjour monde" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() => window.__maniE2E?.applyCtxFormatToSelectedText?.("bold"));
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<b\b|<strong\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("sans sélection : Italique couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "ligne une" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() => window.__maniE2E?.applyCtxFormatToSelectedText?.("italic"));
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<i\b|<em\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});

test("sans sélection : Souligné couvre tout le texte", async () => {
  const { app, page } = await launchApp();
  await openPdf(app, page);

  const id = await page.evaluate(() =>
    window.__maniE2E?.injectTextForTest?.({ plain: "souligne moi" })
  );
  expect(id).toBeTruthy();

  const ok = await page.evaluate(() =>
    window.__maniE2E?.applyCtxFormatToSelectedText?.("underline")
  );
  expect(ok).toBe(true);

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      const h = p?.textHtml || "";
      return /<u\b/i.test(h);
    },
    id,
    { timeout: 10000 }
  );

  await e2eCi.closeElectronApp(app);
});
