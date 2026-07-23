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

async function openPdfFromUi(app, page) {
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
  await expect(page.locator("#annotationLayer")).toHaveCount(1, { timeout: 30000 });
}

async function addTextViaToolbar(page, expectedCount) {
  await page.locator("#addTextBtn").click();
  await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(expectedCount, {
    timeout: 15000
  });
}

test("colonne Ajouts: clic sélectionne l’annotation sur la page", async () => {
  const { app, page } = await launchApp();
  await openPdfFromUi(app, page);

  await addTextViaToolbar(page, 1);
  await addTextViaToolbar(page, 2);
  const rows = page.locator("#changesList .change-item");
  await expect(rows).toHaveCount(2, { timeout: 10000 });

  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("#changesList .change-item")]
      .map((r) => r.dataset.id)
      .filter(Boolean)
  );
  expect(ids.length).toBe(2);

  await rows.nth(0).click();
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveCount(1);
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveAttribute(
    "data-id",
    ids[0]
  );

  await rows.nth(1).click();
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveCount(1);
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveAttribute(
    "data-id",
    ids[1]
  );

  const stateId = await page.evaluate(
    () => window.__maniE2E?.getUiState?.().selectedAnnotationId || null
  );
  expect(stateId).toBe(ids[1]);

  await e2eCi.closeElectronApp(app);
});

test("colonne Ajouts + bouton supprimer retire les annotations", async () => {
  const { app, page } = await launchApp();
  await openPdfFromUi(app, page);

  await addTextViaToolbar(page, 1);
  await addTextViaToolbar(page, 2);
  await expect(page.locator("#changesList .change-item")).toHaveCount(2, { timeout: 10000 });

  await page.locator("#changesList .change-item").nth(1).click();
  await expect(page.locator("#annotationLayer .annotation.text.selected")).toHaveCount(1);
  await page.locator("#deleteSelectedBtn").click();
  await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(1);
  await expect(page.locator("#changesList .change-item")).toHaveCount(1);

  await page.locator("#changesList .change-item").first().click();
  await page.locator("#deleteSelectedBtn").click();
  await expect(page.locator("#annotationLayer .annotation.text")).toHaveCount(0);
  await expect(page.locator("#changesList .change-item")).toHaveCount(0);

  await e2eCi.closeElectronApp(app);
});
