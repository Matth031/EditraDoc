const { BrowserWindow, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { validateHtmlToPdfPaths } = require("./path-guard");

const LOAD_TIMEOUT_MS = 15000;
const RENDER_SETTLE_MS = 200;

const PRINT_TO_PDF_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true
};

const MISSING_ASSETS_SCRIPT = `
(() => {
  const missing = [];
  for (const img of document.querySelectorAll("img")) {
    const src = img.getAttribute("src") || "";
    if (!src) continue;
    if (img.naturalWidth === 0) missing.push(src);
  }
  return missing;
})()
`;

/**
 * Session Electron bloquant toute requête hors schéma file://.
 * @returns {{ session: import("electron").Session, wasRemoteBlocked: () => boolean }}
 */
function createLocalFileOnlySession() {
  let blockedRemote = false;
  const ses = session.fromPartition(`editify-html-pdf-${Date.now()}-${Math.random()}`);
  ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    if ((details.url || "").startsWith("file:")) {
      callback({ cancel: false });
      return;
    }
    blockedRemote = true;
    callback({ cancel: true });
  });
  return {
    session: ses,
    wasRemoteBlocked: () => blockedRemote
  };
}

/**
 * @param {import("electron").BrowserWindow} win
 * @param {string} filePath
 * @param {number} timeoutMs
 */
async function loadFileWithTimeout(win, filePath, timeoutMs) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timerId;
  try {
    await Promise.race([
      win.loadFile(filePath),
      new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error("HTML_LOAD_TIMEOUT")), timeoutMs);
      })
    ]);
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}

/**
 * @param {import("electron").WebContents} webContents
 * @returns {Promise<string[]>}
 */
async function detectMissingImageAssets(webContents) {
  try {
    const result = await webContents.executeJavaScript(MISSING_ASSETS_SCRIPT);
    if (!Array.isArray(result)) return [];
    return result.filter((s) => typeof s === "string");
  } catch {
    return [];
  }
}

/**
 * @param {import("electron").WebContents} webContents
 * @returns {Promise<Buffer>}
 */
async function renderPdfBuffer(webContents) {
  return webContents.printToPDF(PRINT_TO_PDF_OPTIONS);
}

/**
 * @param {unknown} error
 * @returns {{ ok: false, error: string }}
 */
function toConversionError(error) {
  const msg = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (msg === "HTML_LOAD_TIMEOUT") {
    return { ok: false, error: "Délai de chargement HTML dépassé (15 s)." };
  }
  return { ok: false, error: "Échec de la conversion HTML vers PDF." };
}

/**
 * Convertit un fichier HTML local en PDF co-localisé via Electron printToPDF.
 * @param {unknown} inputPath
 * @param {unknown} [outputPath]
 * @returns {Promise<{ ok: true, outputPath: string, missingAssets: string[], blockedRemote: boolean } | { ok: false, error: string }>}
 */
async function convertHtmlToPdf(inputPath, outputPath) {
  const validation = validateHtmlToPdfPaths(inputPath, outputPath);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const resolvedInput = path.resolve(String(inputPath));
  if (!fs.existsSync(resolvedInput)) {
    return { ok: false, error: "Fichier HTML introuvable." };
  }
  const outPath = validation.outputPath;

  /** @type {import("electron").BrowserWindow | null} */
  let win = null;

  try {
    const { session: ses, wasRemoteBlocked } = createLocalFileOnlySession();

    win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        sandbox: true,
        contextIsolation: true,
        session: ses
      }
    });

    await loadFileWithTimeout(win, resolvedInput, LOAD_TIMEOUT_MS);
    await new Promise((r) => setTimeout(r, RENDER_SETTLE_MS));

    const missingAssets = await detectMissingImageAssets(win.webContents);
    const buf = await renderPdfBuffer(win.webContents);
    fs.writeFileSync(outPath, buf);

    return {
      ok: true,
      outputPath: outPath,
      missingAssets,
      blockedRemote: wasRemoteBlocked()
    };
  } catch (error) {
    return toConversionError(error);
  } finally {
    try {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  convertHtmlToPdf,
  LOAD_TIMEOUT_MS,
  createLocalFileOnlySession,
  loadFileWithTimeout,
  detectMissingImageAssets,
  toConversionError
};
