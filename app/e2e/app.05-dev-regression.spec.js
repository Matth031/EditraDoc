/**
 * Régression ciblée sur docs/05-Dev.md :
 * - données i18n (window.__EDITIFY_I18N), persistance editify:lang, IPC langue
 * - rafraîchissement UI avec PDF (colonnes, cohérence avec app.i18n.spec)
 * Ces tests complètent les specs existantes ; ils échouent si le contrat documenté casse.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const e2eCi = require("./electron-ci-env");
const { waitForPdfPagesRendered } = require("./helpers");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) {
    throw new Error(`Fixture PDF introuvable: ${p}`);
  }
  return p;
}

/** E2E sans ouverture PDF automatique (écran d’accueil disponible pour persistance langue). */
async function launchAppE2EBare() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1"
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi && window.__maniE2E?.setLanguage, null, {
    timeout: 90000,
    polling: 250
  });
  return { app, page };
}

async function launchAppWithPdfFixture() {
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
  await page.waitForFunction(() => !!window.maniPdfApi && window.__maniE2E?.setLanguage, null, {
    timeout: 90000,
    polling: 250
  });
  return { app, page };
}

async function openPdfFromMenu(app, page) {
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
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });
}

/**
 * Ce test ne dépend que de `renderer-i18n-data.js` (avant la fin de `renderer.js`).
 * Ne pas attendre `__maniE2E.setLanguage` : sous CI lent, le bundle renderer peut dépasser 2 min.
 */
test("05-Dev: __EDITIFY_I18N expose fr/en/es/pt avec clés minimales", async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1"
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  // Signature Playwright : (fn, arg, options). Ne pas passer options en 2e paramètre
  // (sinon timeout = défaut = timeout du test, ex. 180 s en CI + teardown bloqué).
  await page.waitForFunction(
    () => {
      const D = window.__EDITIFY_I18N;
      if (!D) return false;
      return ["fr", "en", "es", "pt"].every((lang) => D[lang]?.welcomeTitle && D[lang]?.appName);
    },
    null,
    { timeout: e2eCi.waitForBareI18nTimeoutMs(), polling: 200 }
  );
  const ok = await page.evaluate(() => {
    const D = window.__EDITIFY_I18N;
    if (!D || typeof D !== "object") return { ok: false, reason: "no I18N" };
    for (const lang of ["fr", "en", "es", "pt"]) {
      if (!D[lang] || typeof D[lang] !== "object") return { ok: false, reason: `missing ${lang}` };
      if (!D[lang].welcomeTitle || !D[lang].appName) return { ok: false, reason: `keys ${lang}` };
    }
    return { ok: true };
  });
  expect(ok.ok, ok.reason).toBe(true);
  await e2eCi.closeElectronApp(app);
});

test("05-Dev: localStorage editify:lang=pt appliqué au rechargement (loadPreferredLanguage)", async () => {
  const { app, page } = await launchAppE2EBare();
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
    window.localStorage.setItem("editify:lang", "pt");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.maniPdfApi && window.__maniE2E?.setLanguage, null, {
    timeout: 90000,
    polling: 250
  });
  await expect(page.locator("#welcomeTitle")).toContainText("Bem-vindo");
  await expect(page.locator(":root")).toHaveAttribute("lang", /pt/i);
  await e2eCi.closeElectronApp(app);
});

test("05-Dev: IPC app:set-language met à jour documentElement.lang (alignement BCP 47)", async () => {
  const { app, page } = await launchAppWithPdfFixture();
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("app:set-language", "en");
  });
  await page.waitForTimeout(200);
  await expect(page.locator(":root")).toHaveAttribute("lang", /en/i);
  await e2eCi.closeElectronApp(app);
});

test("05-Dev: PDF ouvert + changement langue → colonnes Miniatures/Ajouts (non figées)", async () => {
  const { app, page } = await launchAppWithPdfFixture();
  await openPdfFromMenu(app, page);
  await waitForPdfPagesRendered(page);
  await page.evaluate(() => window.__maniE2E.setLanguage("en"));
  await expect(page.locator("#thumbsTitle")).toHaveText("Thumbnails");
  await expect(page.locator("#changesTitle")).toHaveText("Changes");
  await page.evaluate(() => window.__maniE2E.setLanguage("fr"));
  await expect(page.locator("#thumbsTitle")).toHaveText("Miniatures");
  await expect(page.locator("#changesTitle")).toHaveText("Ajouts");
  await e2eCi.closeElectronApp(app);
});

test("05-Dev: menu orthographe ctx - titre présent après langue ES", async () => {
  const { app, page } = await launchAppWithPdfFixture();
  await page.evaluate(() => window.__maniE2E.setLanguage("es"));
  await expect(page.locator("#ctxSpellTitleEl")).toHaveText("Ortografia");
  await e2eCi.closeElectronApp(app);
});
