/**
 * i18n : les chaînes d’interface suivent la langue (applyLanguage + setLanguage).
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

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
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
  });
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });
}

async function showHtmlToolbar(app, page) {
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    w?.setFullScreen(true);
    if (w) w.webContents.send("window:fullscreen-changed", w.isFullScreen());
  });
  await page.waitForFunction(
    () => {
      const el = document.getElementById("appToolbar");
      return el && !el.classList.contains("hidden");
    },
    null,
    { timeout: 20000 }
  );
}

test("i18n: écran d’accueil + colonnes + tooltips (EN)", async () => {
  const { app, page } = await launchApp();
  await page.evaluate(() => window.__maniE2E.setLanguage("en"));
  await expect(page.locator("#welcomeTitle")).toHaveText("Welcome to EditraDoc");
  await expect(page.locator("#welcomeSubtitle")).toContainText("File");
  await expect(page.locator("#thumbsTitle")).toHaveText("Thumbnails");
  await expect(page.locator("#changesTitle")).toHaveText("Changes");
  await expect(page.locator("#addTextBtn")).toContainText("Text");
  const tt = await page.locator("#zoomInBtn").getAttribute("data-tooltip");
  expect(tt || "").toMatch(/zoom/i);
  await e2eCi.closeElectronApp(app);
});

test("i18n: menu contextuel texte + modal couleur (ES)", async () => {
  const { app, page } = await launchApp();
  await page.evaluate(() => window.__maniE2E.setLanguage("es"));
  await expect(page.locator("#ctxTextMenuTitle")).toHaveText("Texto");
  await expect(page.locator("#maniColorModalTitle")).toHaveText("Color");
  await expect(page.locator("#maniColorValidateBtn")).toHaveText("Aplicar");
  await e2eCi.closeElectronApp(app);
});

test("i18n: split + formes après ouverture PDF (PT)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);
  await waitForPdfPagesRendered(page);
  await page.evaluate(() => window.__maniE2E.setLanguage("pt"));
  await expect(page.locator("#thumbsTitle")).toHaveText("Miniaturas");
  await expect(page.locator("#changesTitle")).toHaveText("Alterações");

  await showHtmlToolbar(app, page);
  await page.locator("#toolbarOptionsBtn").click();
  await page.locator("#toolbarOptionsMenu #splitBtn").click();
  await expect(page.locator("#splitWorkspaceOverlay")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#splitWorkspaceTitle")).toContainText("Split");
  await expect(page.locator("#splitWorkspaceHint")).toContainText(/pagina/i);

  await page.keyboard.press("Escape");
  await expect(page.locator("#splitWorkspaceOverlay")).toBeHidden();

  await page.locator("#addShapeBtn").click();
  await expect(page.locator("#shapeModal")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#shapeModalTitleEl")).toContainText("forma");
  const firstShapeBtn = page.locator("#shapeGrid button[data-shape='rect']").first();
  await expect(firstShapeBtn).toContainText("Retangulo");

  await e2eCi.closeElectronApp(app);
});

test("i18n: document.documentElement.lang suit la langue UI", async () => {
  const { app, page } = await launchApp();
  await page.evaluate(() => window.__maniE2E.setLanguage("fr"));
  await expect(page.locator(":root")).toHaveAttribute("lang", /fr/);
  await page.evaluate(() => window.__maniE2E.setLanguage("en"));
  await expect(page.locator(":root")).toHaveAttribute("lang", /en/);
  await e2eCi.closeElectronApp(app);
});
