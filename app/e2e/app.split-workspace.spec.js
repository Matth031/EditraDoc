/**
 * Régressions : UI Split (groupes + miniatures), transform-origin annotations (rotation + resize).
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
  await page.waitForFunction(() => !!window.maniPdfApi);
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

test("Split: overlay visible, deux groupes, miniatures = nombre de pages, Echap ferme", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);
  await waitForPdfPagesRendered(page);
  await showHtmlToolbar(app, page);

  await page.locator("#toolbarOptionsBtn").click();
  await page.locator("#toolbarOptionsMenu #splitBtn").click();

  const overlay = page.locator("#splitWorkspaceOverlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#splitWorkspaceTitle")).toBeVisible();

  await expect(page.locator("#splitWorkspaceGroups .split-group")).toHaveCount(2);
  const expectedPages = await page.evaluate(() => window.__maniE2E?.getUiState?.()?.pageCount);
  expect(typeof expectedPages).toBe("number");
  const thumbsFirstGroup = page
    .locator("#splitWorkspaceGroups .split-group")
    .first()
    .locator(".split-thumb");
  await expect(thumbsFirstGroup).toHaveCount(expectedPages);

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();

  await e2eCi.closeElectronApp(app);
});

test("Split: bouton + Groupe ajoute un groupe (groupe 3)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);
  await waitForPdfPagesRendered(page);
  await showHtmlToolbar(app, page);

  await page.locator("#toolbarOptionsBtn").click();
  await page.locator("#toolbarOptionsMenu #splitBtn").click();
  await expect(page.locator("#splitWorkspaceOverlay")).toBeVisible({ timeout: 10000 });

  await page.locator("#splitWorkspaceAddGroupBtn").click();
  await expect(page.locator("#splitWorkspaceGroups .split-group")).toHaveCount(3);

  const lastGroupName = await page
    .locator("#splitWorkspaceGroups .split-group-name")
    .last()
    .inputValue();
  expect(lastGroupName).toMatch(/groupe\s*3/i);

  await e2eCi.closeElectronApp(app);
});

test("annotation: transform-origin aligné coin haut-gauche (rotation / resize)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("rect"));
  expect(id).toBeTruthy();

  await expect(page.locator("#annotationLayer .annotation")).toHaveCount(1, { timeout: 15000 });

  const origin = await page.evaluate(() => {
    const el = document.querySelector("#annotationLayer .annotation");
    if (!el) return null;
    return getComputedStyle(el).transformOrigin;
  });
  expect(origin).toBeTruthy();
  expect(String(origin).startsWith("0px")).toBeTruthy();

  await e2eCi.closeElectronApp(app);
});
