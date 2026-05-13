const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

const repoRoot = path.resolve(process.cwd(), "..");
const pdfFixture = path.join(repoRoot, "tests", "formulaire_test.pdf");
const raptorFixture = path.join(repoRoot, "tests", "raptor.png");
const outPdf = path.join(repoRoot, "tests", "test_raptor.pdf");
const fallbackPng = path.join(process.cwd(), "public", "miniature_no_bg.png");

function countBufferOccurrences(buf, needle) {
  let n = 0;
  let i = 0;
  while (true) {
    const j = buf.indexOf(needle, i);
    if (j === -1) break;
    n += 1;
    i = j + needle.length;
  }
  return n;
}

/** Détecte les XObject image (ReportLab n’embarque pas forcément le chunk binaire « IHDR »). */
function assertPdfHasEmbeddedImageXObjects(pdfPath, minCount = 1) {
  const buf = fs.readFileSync(pdfPath);
  const marker = Buffer.from("/Subtype /Image");
  const n = countBufferOccurrences(buf, marker);
  expect(n, "au moins une ressource /Subtype /Image").toBeGreaterThanOrEqual(minCount);
}

test.beforeAll(() => {
  if (!fs.existsSync(pdfFixture)) {
    throw new Error(`Fixture introuvable: ${pdfFixture}`);
  }
  const fixtureBuf = fs.readFileSync(pdfFixture);
  expect(countBufferOccurrences(fixtureBuf, Buffer.from("/Subtype /Image"))).toBe(0);
  if (!fs.existsSync(raptorFixture)) {
    if (!fs.existsSync(fallbackPng)) {
      throw new Error(`Impossible de créer raptor.png : ${fallbackPng} introuvable`);
    }
    fs.mkdirSync(path.dirname(raptorFixture), { recursive: true });
    fs.copyFileSync(fallbackPng, raptorFixture);
  }
});

test("export PDF : image raptor.png embarquée puis fichier supprimé", async () => {
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const app = await electron.launch({
    executablePath: electronPath,
    args: require("./electron-ci-env").electronLaunchArgs(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: pdfFixture,
      MANI_PDF_E2E_SAVE_AS_PATH: outPdf
    }
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => !!window.maniPdfApi && window.__maniE2E?.exportActivePdfToPathForTest
  );

  await expect
    .poll(async () => page.evaluate(() => window.maniPdfApi.pythonHealth()), {
      timeout: 60000,
      message: "Le service Python (port 8765) doit être disponible pour l’export PDF."
    })
    .toMatchObject({ ok: true });

  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfFixture);

  await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
  await waitForPdfPagesRendered(page);

  await page.locator("#addImageBtn").click();
  await page.locator("#imageInput").setInputFiles(raptorFixture);
  await expect(page.locator("#annotationLayer .annotation.image")).toHaveCount(1, {
    timeout: 15000
  });

  await page.locator("#imageInput").evaluate((el) => el.blur());
  await page.locator(".viewer").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+KeyS");

  await expect.poll(() => fs.existsSync(outPdf), { timeout: 60000 }).toBe(true);
  expect(fs.statSync(outPdf).size).toBeGreaterThan(1024);
  assertPdfHasEmbeddedImageXObjects(outPdf);

  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {}
  });
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, outPdf);
  const raptorTab = page.locator("#tabs .tab", { hasText: "test_raptor.pdf" });
  await expect(raptorTab).toHaveCount(1, { timeout: 30000 });
  await raptorTab.click();
  await waitForPdfPagesRendered(page);
  assertPdfHasEmbeddedImageXObjects(outPdf);

  await app.close();
  fs.unlinkSync(outPdf);
  expect(fs.existsSync(outPdf)).toBe(false);
});
