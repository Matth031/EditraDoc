/**
 * Régressions menus contextuels + nuancier :
 * - z-index (modale couleur au-dessus du menu Forme)
 * - saisie manuelle sans fermeture (document click = toolbar only, pas closeAllFlyoutMenus)
 * - glisser le titre
 * - Valider du nuancier applique bien la couleur ; pipeline __maniE2E.applyPanelColorForTest
 * - maniAfterColorCommit défini (évite ReferenceError si logText manquait)
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
  await waitForPdfPagesRendered(page);
  await page.waitForFunction(() => document.querySelector("#annotationLayer") != null, null, {
    timeout: 45000
  });
}

test("z-index: modale couleur au-dessus du menu Forme + Valider visible", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("rect"));
  expect(id && String(id).length > 0).toBeTruthy();

  await page.locator("#annotationLayer .annotation.rect").click({ position: { x: 40, y: 40 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.rect")
    .click({ button: "right", position: { x: 50, y: 50 } });
  const shapeMenu = page.locator("#shapeAnnotationCtxMenu");
  await expect(shapeMenu).toBeVisible({ timeout: 8000 });

  await page.locator('#shapeAnnotationCtxMenu [data-mani-color-for="ctxShapeFill"]').click();
  const colorModal = page.locator("#maniColorModal");
  await expect(colorModal).toBeVisible({ timeout: 5000 });

  const z = await page.evaluate(() => {
    const m = document.getElementById("maniColorModal");
    const s = document.getElementById("shapeAnnotationCtxMenu");
    const zNum = (el) => {
      if (!el) return 0;
      const z = getComputedStyle(el).zIndex;
      if (z === "auto") return 0;
      const n = Number.parseInt(z, 10);
      return Number.isFinite(n) ? n : 0;
    };
    return { mani: zNum(m), shape: zNum(s) };
  });
  expect(z.mani, "modale couleur doit empiler au-dessus du menu Forme").toBeGreaterThan(z.shape);

  await expect(page.locator("#maniColorValidateBtn")).toBeVisible();
  await expect(page.locator("#maniColorValidateBtn")).toBeInViewport();

  await page.locator("#maniColorModalClose").click();
  await expect(colorModal).toBeHidden({ timeout: 3000 });

  await e2eCi.closeElectronApp(app);
});

test("saisie manuelle dans le menu Forme: le menu reste ouvert (focus)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("star"));
  expect(id && String(id).length > 0).toBeTruthy();

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

  await page.locator("#ctxShapeStrokeW").click();
  await page.locator("#ctxShapeStrokeW").fill("4");
  await page.locator("#ctxShapeOpacity").click();

  await expect(shapeMenu).toBeVisible();
  await expect(shapeMenu).not.toHaveClass("hidden");

  await e2eCi.closeElectronApp(app);
});

test("glisser le titre déplace le menu Forme", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("ellipse"));
  expect(id && String(id).length > 0).toBeTruthy();

  await page.locator("#annotationLayer .annotation.ellipse").click({ position: { x: 40, y: 40 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.ellipse")
    .click({ button: "right", position: { x: 50, y: 50 } });
  const shapeMenu = page.locator("#shapeAnnotationCtxMenu");
  await expect(shapeMenu).toBeVisible({ timeout: 8000 });

  const before = await page.evaluate(() => {
    const el = document.getElementById("shapeAnnotationCtxMenu");
    const r = el?.getBoundingClientRect();
    return { left: r?.left ?? 0, top: r?.top ?? 0 };
  });

  const title = page.locator("#shapeAnnotationCtxMenu .text-ctx-menu-title");
  const tbox = await title.boundingBox();
  expect(tbox).toBeTruthy();
  await page.mouse.move(tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tbox.x + tbox.width / 2 + 90, tbox.y + tbox.height / 2 + 50, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const el = document.getElementById("shapeAnnotationCtxMenu");
    const r = el?.getBoundingClientRect();
    return { left: r?.left ?? 0, top: r?.top ?? 0 };
  });

  const moved = Math.abs(after.left - before.left) + Math.abs(after.top - before.top);
  expect(moved, "le menu doit avoir bougé après drag depuis le titre").toBeGreaterThan(20);

  await e2eCi.closeElectronApp(app);
});

test("hooks couleur: maniAfterColorCommit et openManiColorPicker définis", async () => {
  const { app, page } = await launchApp();
  await page.waitForFunction(
    () =>
      typeof globalThis.maniAfterColorCommit === "function" &&
      typeof window.openManiColorPicker === "function",
    null,
    { timeout: 20000 }
  );
  const ok = await page.evaluate(
    () =>
      typeof globalThis.maniAfterColorCommit === "function" &&
      typeof window.openManiColorPicker === "function"
  );
  expect(ok).toBe(true);
  await e2eCi.closeElectronApp(app);
});

test("nuancier: Valider applique #ff0000 au remplissage + menu Forme reste ouvert", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("triangle"));
  expect(id && String(id).length > 0).toBeTruthy();

  await page.locator("#annotationLayer .annotation.triangle").click({ position: { x: 40, y: 40 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.triangle")
    .click({ button: "right", position: { x: 50, y: 50 } });
  const shapeMenu = page.locator("#shapeAnnotationCtxMenu");
  await expect(shapeMenu).toBeVisible({ timeout: 8000 });

  await page.locator('#shapeAnnotationCtxMenu [data-mani-color-for="ctxShapeFill"]').click();
  await expect(page.locator("#maniColorModal")).toBeVisible({ timeout: 5000 });

  await page.locator("#maniColorR").fill("255");
  await page.locator("#maniColorG").fill("0");
  await page.locator("#maniColorB").fill("0");
  await page.locator("#maniColorValidateBtn").click();

  await expect(page.locator("#maniColorModal")).toBeHidden({ timeout: 5000 });
  await expect(shapeMenu).toBeVisible();
  await expect(shapeMenu).not.toHaveClass("hidden");

  const fill = await page.evaluate((annotationId) => {
    return window.__maniE2E?.getAnnotationProps?.(annotationId)?.fillColor;
  }, id);
  expect(String(fill || "").toLowerCase()).toBe("#ff0000");

  await e2eCi.closeElectronApp(app);
});

test("applyPanelColorForTest: même pipeline que le nuancier (remplissage ctx)", async () => {
  const { app, page } = await launchApp();
  await openPdfFromMenu(app, page);

  const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("diamond"));
  expect(id && String(id).length > 0).toBeTruthy();

  await page.locator("#annotationLayer .annotation.diamond").click({ position: { x: 40, y: 40 } });
  await page.waitForFunction(
    (aid) => window.__maniE2E?.getUiState?.().selectedAnnotationId === aid,
    id,
    { timeout: 10000 }
  );

  await page
    .locator("#annotationLayer .annotation.diamond")
    .click({ button: "right", position: { x: 50, y: 50 } });
  await expect(page.locator("#shapeAnnotationCtxMenu")).toBeVisible({ timeout: 8000 });

  const applied = await page.evaluate(() => {
    return window.__maniE2E?.applyPanelColorForTest?.("ctxShapeFill", "#2ecc71");
  });
  expect(applied).toBe(true);

  const fill = await page.evaluate((annotationId) => {
    return window.__maniE2E?.getAnnotationProps?.(annotationId)?.fillColor;
  }, id);
  expect(String(fill || "").toLowerCase()).toBe("#2ecc71");

  await e2eCi.closeElectronApp(app);
});
