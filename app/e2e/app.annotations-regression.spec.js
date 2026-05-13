/**
 * Régressions : annotations avancées (formes SVG, menus contextuels, Options > Outils PDF,
 * absence de champs globaux Largeur/Hauteur/Rotation/Opacité dans le header).
 * Dépend de window.__maniE2E.* (renderer.js) pour injecter forme/image sans dialogue fichier.
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
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });
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

test("pas de champs Largeur/Hauteur/Rotation/Opacite globaux dans le header", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);
  await expect(page.locator("#propWidth")).toHaveCount(0);
  await expect(page.locator("#propHeight")).toHaveCount(0);
  await expect(page.locator("#propRotation")).toHaveCount(0);
  await expect(page.locator("#propOpacity")).toHaveCount(0);
  await expect(page.locator("#pdfToolsBtn")).toHaveCount(0);
  await app.close();
});

test("forme etoile: rendu SVG + menu contextuel (rotation, opacite)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("star"));
  expect(id && String(id).length > 0).toBeTruthy();

  await expect(page.locator("#annotationLayer .annotation.star.shape-vector")).toHaveCount(1, {
    timeout: 15000
  });
  await expect(page.locator("#annotationLayer .annotation.star svg.shape-svg")).toHaveCount(1);

  const props = await page.evaluate(
    (annotationId) => window.__maniE2E?.getAnnotationProps?.(annotationId),
    id
  );
  expect(props?.type).toBe("star");

  await page.locator("#annotationLayer .annotation.star").click({ position: { x: 40, y: 40 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.star")
    .click({ button: "right", position: { x: 50, y: 50 } });
  const shapeMenu = page.locator("#shapeAnnotationCtxMenu");
  await expect(shapeMenu).toBeVisible({ timeout: 8000 });
  await expect(shapeMenu.locator("#ctxShapeRotation")).toBeVisible();
  await expect(shapeMenu.locator("#ctxShapeOpacity")).toBeVisible();

  await page.locator("#ctxShapeRotation").fill("45");
  await page.locator("#ctxShapeOpacity").fill("80");
  await page.locator("#ctxShapeRotation").press("Tab");

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      return p && p.rotation === 45 && p.opacity === 80;
    },
    id,
    { timeout: 10000 }
  );

  await app.close();
});

test("image: menu contextuel rotation / opacite", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectImageForTest?.());
  expect(id).toBeTruthy();

  await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
    timeout: 15000
  });

  await page.locator("#annotationLayer .annotation.image").click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.image")
    .click({ button: "right", position: { x: 30, y: 25 } });
  const imgMenu = page.locator("#imageAnnotationCtxMenu");
  await expect(imgMenu).not.toHaveClass(/hidden/, { timeout: 8000 });
  await expect(imgMenu.locator("#ctxImageRotation")).toBeVisible();
  await expect(imgMenu.locator("#ctxImageOpacity")).toBeVisible();

  await page.locator("#ctxImageRotation").fill("33");
  await page.locator("#ctxImageOpacity").fill("77");
  await page.locator("#ctxImageRotation").press("Enter");

  await page.waitForFunction(
    (annotationId) => {
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      return p && p.rotation === 33 && p.opacity === 77;
    },
    id,
    { timeout: 10000 }
  );

  await app.close();
});

test("texte: menu contextuel contient rotation et opacite", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  await page.locator("#addTextBtn").click();
  await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(1, {
    timeout: 15000
  });
  await page.locator("#annotationLayer .annotation.text").click({ position: { x: 30, y: 20 } });

  await page
    .locator("#annotationLayer .annotation.text")
    .click({ button: "right", position: { x: 40, y: 22 } });
  const textMenu = page.locator("#textAnnotationCtxMenu");
  await expect(textMenu).toBeVisible({ timeout: 8000 });
  await expect(textMenu.locator("#ctxTextRotation")).toBeVisible();
  await expect(textMenu.locator("#ctxTextOpacity")).toBeVisible();

  await app.close();
});

test("Options (barre F10): section Outils PDF + Fusion avec un seul PDF (message attendu)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);
  await waitForPdfPagesRendered(page);
  await showHtmlToolbar(app, page);

  await page.locator("#toolbarOptionsBtn").click();
  const opts = page.locator("#toolbarOptionsMenu");
  await expect(opts).toBeVisible();
  await expect(opts.locator("#mergeBtn")).toBeVisible();
  await expect(opts.locator("#splitBtn")).toBeVisible();

  await page.locator("#toolbarOptionsMenu #mergeBtn").click();
  await expect(page.locator("#statusText")).toContainText(/Fusion|2 PDF|PDF/i, { timeout: 10000 });

  await app.close();
});
