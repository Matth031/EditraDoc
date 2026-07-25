/**
 * S6 — undo toast restaure onglet + pdf:read-bytes OK sur chemin re-validé via pdf:open.
 * Obligatoire avant extraction renderer-tabs.js (Lot 4).
 *
 * Second PDF : généré à la volée via `compress_pdf` (pipeline Python) à partir de
 * `formulaire_test.pdf` — aucun artefact gitignoré requis pour un clone frais.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const { waitForPdfPagesRendered } = require("./helpers");

function runPythonInline(script, scriptArgs = []) {
  const candidates =
    process.platform === "win32"
      ? [
          { cmd: "py", args: ["-3", "-c", script, ...scriptArgs] },
          { cmd: "python", args: ["-c", script, ...scriptArgs] },
          { cmd: "python3", args: ["-c", script, ...scriptArgs] }
        ]
      : [
          { cmd: "python", args: ["-c", script, ...scriptArgs] },
          { cmd: "python3", args: ["-c", script, ...scriptArgs] }
        ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate.cmd, candidate.args, { encoding: "utf8" });
    } catch (error) {
      lastError = error;
      if (error?.code === "ENOENT" || error?.status === 127) continue;
      throw error;
    }
  }
  throw lastError || new Error("Python introuvable (python / python3 / py -3).");
}

/**
 * Copie le PDF de référence dans un tmp puis applique `pdf_ops.compress_pdf`
 * (même dossier = invariant S1) → `formulaire_test-compressed.pdf`.
 * @returns {{ primary: string, secondary: string, secondaryBase: string, cleanup: () => void }}
 */
function getPdfFixtures() {
  const root = path.resolve(process.cwd(), "..", "tests");
  const primary = path.join(root, "formulaire_test.pdf");
  if (!fs.existsSync(primary)) {
    throw new Error(`Fixture PDF introuvable: ${primary}`);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-s6-"));
  const srcInTmp = path.join(workDir, "formulaire_test.pdf");
  const secondary = path.join(workDir, "formulaire_test-compressed.pdf");
  fs.copyFileSync(primary, srcInTmp);

  const pythonDir = path.resolve(process.cwd(), "python");
  const script = [
    "import sys",
    `sys.path.insert(0, ${JSON.stringify(pythonDir)})`,
    "from pdf_ops import compress_pdf",
    "compress_pdf(sys.argv[1], sys.argv[2])",
    "print(sys.argv[2])"
  ].join(";");

  try {
    runPythonInline(script, [srcInTmp, secondary]);
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  }

  if (!fs.existsSync(secondary) || fs.statSync(secondary).size < 1) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw new Error(`Échec génération fixture compressée: ${secondary}`);
  }

  return {
    primary,
    secondary,
    secondaryBase: path.basename(secondary),
    cleanup: () => {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* intentional: cleanup best-effort */
      }
    }
  };
}

async function launchApp(primaryPdfPath) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: primaryPdfPath
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function clearSessionStorage(page) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
  });
}

async function openPdfFromMenu(app, page, pdfPath) {
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
}

test("S6 undo toast : restaure onglet fermé et pdf:read-bytes OK", async () => {
  const fixtures = getPdfFixtures();
  const { primary, secondary, secondaryBase, cleanup } = fixtures;
  const { app, page } = await launchApp(primary);

  try {
    await clearSessionStorage(page);

    await openPdfFromMenu(app, page, primary);
    await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });

    await openPdfFromMenu(app, page, secondary);
    await expect(page.locator("#tabs .tab")).toHaveCount(2, { timeout: 30000 });
    await waitForPdfPagesRendered(page);

    const secondaryTab = page.locator("#tabs .tab", { hasText: secondaryBase });
    await expect(secondaryTab).toHaveCount(1);
    await secondaryTab.locator(".tab-close").click();

    await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(".toast-root .toast")).toHaveCount(1);
    await expect(page.locator(".toast-root .toast")).toContainText("PDF retiré");

    const readBlocked = await page.evaluate(async (closedPath) => {
      const res = await window.maniPdfApi.readPdfBytes(closedPath);
      return { ok: Boolean(res?.ok), errorCode: res?.errorCode || null };
    }, secondary);
    expect(readBlocked.ok).toBe(false);
    expect(readBlocked.errorCode).toBe("PDF_READ_NOT_OPEN");

    await page.locator(".toast-root .toast .toast-action", { hasText: "Annuler" }).click();
    await expect(page.locator("#tabs .tab")).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator("#tabs .tab", { hasText: secondaryBase })).toHaveCount(1);

    const readOk = await page.evaluate(async (restoredPath) => {
      const res = await window.maniPdfApi.readPdfBytes(restoredPath);
      return {
        ok: Boolean(res?.ok),
        base64Len: res?.base64 ? String(res.base64).length : 0,
        errorCode: res?.errorCode || null
      };
    }, secondary);
    expect(readOk.ok).toBe(true);
    expect(readOk.base64Len).toBeGreaterThan(100);
    expect(readOk.errorCode).toBeNull();
  } finally {
    await e2eCi.closeElectronApp(app);
    cleanup();
  }
});
