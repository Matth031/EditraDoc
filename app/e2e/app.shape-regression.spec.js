/**
 * Anti-régression : petites formes (CSS min 0 sur .shape-vector + modèle w/h)
 * et menu contextuel au clic droit sans sélection préalable au clic gauche.
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

test.describe("Formes : taille minimale (CSS + modèle)", () => {
  test("CSS: rect/ellipse/triangle/line.shape-vector ont min-width et min-height à 0", async () => {
    const { app, page } = await launchApp();
    await openPdfFromMenu(app, page);

    await page.evaluate(() => {
      window.__maniE2E?.injectShapeForTest?.("rect");
      window.__maniE2E?.injectShapeForTest?.("ellipse");
      window.__maniE2E?.injectShapeForTest?.("triangle");
      window.__maniE2E?.injectShapeForTest?.("line");
    });

    const css = await page.evaluate(() => {
      const types = ["rect", "ellipse", "triangle", "line"];
      const out = {};
      for (const t of types) {
        const el = document.querySelector(`#annotationLayer .annotation.${t}.shape-vector`);
        if (!el) {
          out[t] = { ok: false, reason: "missing" };
          continue;
        }
        const cs = getComputedStyle(el);
        out[t] = {
          ok: true,
          minWidth: cs.minWidth,
          minHeight: cs.minHeight
        };
      }
      return out;
    });

    for (const t of ["rect", "ellipse", "triangle", "line"]) {
      expect(css[t]?.ok, `noeud .annotation.${t}.shape-vector`).toBeTruthy();
      expect(css[t].minWidth, `${t} min-width`).toBe("0px");
      expect(css[t].minHeight, `${t} min-height`).toBe("0px");
    }

    await app.close();
  });

  test("modèle + DOM: rectangle peut descendre à quelques px (pas le plancher CSS 90×60)", async () => {
    const { app, page } = await launchApp();
    await openPdfFromMenu(app, page);

    const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("rect"));
    expect(id && String(id).length > 0).toBeTruthy();

    const ok = await page.evaluate(
      (annotationId) => window.__maniE2E?.setAnnotationLogicalSizeForTest?.(annotationId, 3, 3),
      id
    );
    expect(ok).toBe(true);

    const dims = await page.evaluate((annotationId) => {
      const el = document.querySelector(`#annotationLayer [data-id="${annotationId}"]`);
      const p = window.__maniE2E?.getAnnotationProps?.(annotationId);
      if (!el || !p) return null;
      return {
        logicalW: p.w,
        logicalH: p.h,
        offsetW: el.offsetWidth,
        offsetH: el.offsetHeight
      };
    }, id);

    expect(dims).not.toBeNull();
    expect(dims.logicalW, "w logique").toBeLessThanOrEqual(8);
    expect(dims.logicalH, "h logique").toBeLessThanOrEqual(8);
    expect(dims.offsetW, "largeur DOM ne doit pas rester ~90px (régression CSS)").toBeLessThan(40);
    expect(dims.offsetH, "hauteur DOM ne doit pas rester ~60px (régression CSS)").toBeLessThan(40);
    expect(dims.offsetW).toBeGreaterThan(0);
    expect(dims.offsetH).toBeGreaterThan(0);

    await app.close();
  });
});

test.describe("Menus contextuels : clic droit sans sélection préalable", () => {
  test("forme (rectangle): menu forme visible", async () => {
    const { app, page } = await launchApp();
    await openPdfFromMenu(app, page);

    const id = await page.evaluate(() => window.__maniE2E?.injectShapeForTest?.("rect"));
    expect(id).toBeTruthy();

    await page.evaluate(() => window.__maniE2E?.clearSelectionForTest?.());
    await page.waitForFunction(() => {
      const u = window.__maniE2E?.getUiState?.();
      return u && !u.selectedAnnotationId;
    });

    await page
      .locator("#annotationLayer .annotation.rect")
      .click({ button: "right", position: { x: 50, y: 50 } });
    const menu = page.locator("#shapeAnnotationCtxMenu");
    await expect(menu).toBeVisible({ timeout: 8000 });
    await expect(menu.locator("#ctxShapeRotation")).toBeVisible();

    await app.close();
  });

  test("image: menu image visible", async () => {
    const { app, page } = await launchApp();
    await openPdfFromMenu(app, page);

    const id = await page.evaluate(() => window.__maniE2E?.injectImageForTest?.());
    expect(id).toBeTruthy();

    await page.evaluate(() => window.__maniE2E?.clearSelectionForTest?.());
    await page.waitForFunction(() => {
      const u = window.__maniE2E?.getUiState?.();
      return u && !u.selectedAnnotationId;
    });

    await page
      .locator("#annotationLayer .annotation.image")
      .click({ button: "right", position: { x: 30, y: 25 } });
    const menu = page.locator("#imageAnnotationCtxMenu");
    await expect(menu).toBeVisible({ timeout: 8000 });
    await expect(menu.locator("#ctxImageRotation")).toBeVisible();

    await app.close();
  });

  test("texte: menu texte visible", async () => {
    const { app, page } = await launchApp();
    await openPdfFromMenu(app, page);

    await page.locator("#addTextBtn").click();
    await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(1, {
      timeout: 15000
    });

    await page.evaluate(() => window.__maniE2E?.clearSelectionForTest?.());
    await page.waitForFunction(() => {
      const u = window.__maniE2E?.getUiState?.();
      return u && !u.selectedAnnotationId;
    });

    await page
      .locator("#annotationLayer .annotation.text")
      .click({ button: "right", position: { x: 40, y: 22 } });
    const menu = page.locator("#textAnnotationCtxMenu");
    await expect(menu).toBeVisible({ timeout: 8000 });
    await expect(menu.locator("#ctxTextRotation")).toBeVisible();

    await app.close();
  });
});
