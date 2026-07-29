/**
 * Impression PDF baked — fenêtre hidden sandboxed + cycle de vie du fichier temp.
 * Conception : docs/adr/008-print-temp-lifecycle-and-sandbox.md
 *
 * Le path temp est toujours choisi côté main (os.tmpdir), jamais par le renderer.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

/** Sous-dossier sous os.tmpdir() — pas userData. */
const PRINT_TEMP_SUBDIR = "editradoc-print";

/** Préfixe des fichiers baked (sweep boot / crash). */
const PRINT_TEMP_FILE_PREFIX = "print-";

/** Âge max des orphelins au boot (ms). */
const PRINT_TEMP_MAX_AGE_MS = 60 * 60 * 1000;

/** Si le callback print ne vient pas (quirk Electron). */
const PRINT_CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * webPreferences alignés ADR-006 / html-to-pdf — sandbox obligatoire.
 * @type {Readonly<{ contextIsolation: true, nodeIntegration: false, sandbox: true }>}
 */
const PRINT_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
});

/** @type {Set<string>} */
const pendingPrintTemps = new Set();

/**
 * @returns {string} Dossier {tmpdir}/editradoc-print
 */
function getPrintTempDir(tmpdir = os.tmpdir()) {
  return path.join(tmpdir, PRINT_TEMP_SUBDIR);
}

/**
 * True si filePath est strictement sous {tmpdir}/editradoc-print/ (S1 / ADR-008).
 * Empêche d'imprimer / d'accepter un path hors zone temp (ex. dossier source PDF).
 * @param {string} filePath
 * @param {{ tmpdir?: string }} [opts]
 * @returns {boolean}
 */
function isPathInsidePrintTempDir(filePath, opts = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) return false;
  const tmpdir = opts.tmpdir ?? os.tmpdir();
  const root = path.resolve(getPrintTempDir(tmpdir));
  const resolved = path.resolve(filePath);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  // Fichier attendu dans le dossier (pas le dossier lui-même).
  return Boolean(path.basename(resolved));
}

/**
 * Crée le dossier temp print si besoin et retourne un path unique.
 * Enregistre le path dans le registre (owed jusqu'à unlink).
 * @param {{ tmpdir?: string, pid?: number, uuid?: () => string, mkdirSync?: typeof fs.mkdirSync }} [opts]
 * @returns {string}
 */
function createPrintTempPath(opts = {}) {
  const tmpdir = opts.tmpdir ?? os.tmpdir();
  const pid = opts.pid ?? process.pid;
  const uuid = opts.uuid ?? randomUUID;
  const mkdirSync = opts.mkdirSync ?? fs.mkdirSync;

  const dir = getPrintTempDir(tmpdir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const filePath = path.join(dir, `${PRINT_TEMP_FILE_PREFIX}${pid}-${uuid()}.pdf`);
  registerPrintTemp(filePath);
  return filePath;
}

/**
 * @param {string} filePath
 */
function registerPrintTemp(filePath) {
  if (typeof filePath === "string" && filePath.length > 0) {
    pendingPrintTemps.add(path.resolve(filePath));
  }
}

/**
 * @param {string} filePath
 */
function unregisterPrintTemp(filePath) {
  pendingPrintTemps.delete(path.resolve(filePath));
}

/**
 * @returns {string[]}
 */
function listPendingPrintTemps() {
  return [...pendingPrintTemps];
}

/**
 * Supprime un fichier temp ; ignore ENOENT. Retire du registre.
 * @param {string} filePath
 * @param {{ unlinkSync?: typeof fs.unlinkSync }} [opts]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function safeUnlinkPrintTemp(filePath, opts = {}) {
  const unlinkSync = opts.unlinkSync ?? fs.unlinkSync;
  const resolved = path.resolve(filePath);
  try {
    unlinkSync(resolved);
    unregisterPrintTemp(resolved);
    return { ok: true };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      unregisterPrintTemp(resolved);
      return { ok: true };
    }
    const msg =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "unlink failed";
    return { ok: false, error: msg };
  }
}

/**
 * Unlink de tous les paths encore enregistrés (quit / crash recovery in-process).
 * @param {{ unlinkSync?: typeof fs.unlinkSync }} [opts]
 * @returns {{ removed: string[], failed: { path: string, error: string }[] }}
 */
function unlinkAllPendingPrintTemps(opts = {}) {
  const removed = [];
  const failed = [];
  for (const p of [...pendingPrintTemps]) {
    const r = safeUnlinkPrintTemp(p, opts);
    if (r.ok) removed.push(p);
    else failed.push({ path: p, error: r.error });
  }
  return { removed, failed };
}

/**
 * Sweep disque au boot : orphelins du run précédent (crash pendant dialogue).
 * Supprime les print-*.pdf du sous-dossier plus vieux que maxAgeMs,
 * ou tous si forceAll (registre perdu après crash — on purge le préfixe).
 *
 * @param {{
 *   tmpdir?: string,
 *   maxAgeMs?: number,
 *   forceAll?: boolean,
 *   now?: number,
 *   readdirSync?: typeof fs.readdirSync,
 *   statSync?: typeof fs.statSync,
 *   unlinkSync?: typeof fs.unlinkSync,
 *   existsSync?: typeof fs.existsSync
 * }} [opts]
 * @returns {{ scanned: number, removed: string[], skipped: string[], errors: string[] }}
 */
function sweepOrphanPrintTemps(opts = {}) {
  const tmpdir = opts.tmpdir ?? os.tmpdir();
  const maxAgeMs = opts.maxAgeMs ?? PRINT_TEMP_MAX_AGE_MS;
  const forceAll = opts.forceAll === true;
  const now = opts.now ?? Date.now();
  const readdirSync = opts.readdirSync ?? fs.readdirSync;
  const statSync = opts.statSync ?? fs.statSync;
  const unlinkSync = opts.unlinkSync ?? fs.unlinkSync;
  const existsSync = opts.existsSync ?? fs.existsSync;

  const dir = getPrintTempDir(tmpdir);
  const result = { scanned: 0, removed: [], skipped: [], errors: [] };

  if (!existsSync(dir)) return result;

  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    const msg =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "readdir failed";
    result.errors.push(msg);
    return result;
  }

  for (const name of names) {
    if (!name.startsWith(PRINT_TEMP_FILE_PREFIX) || !name.endsWith(".pdf")) continue;
    result.scanned += 1;
    const full = path.join(dir, name);
    try {
      const st = statSync(full);
      const age = now - Number(st.mtimeMs || st.mtime || 0);
      if (!forceAll && age < maxAgeMs) {
        result.skipped.push(full);
        continue;
      }
      const r = safeUnlinkPrintTemp(full, { unlinkSync });
      if (r.ok) result.removed.push(full);
      else result.errors.push(`${full}: ${r.error}`);
    } catch (error) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "stat/unlink failed";
      result.errors.push(`${full}: ${msg}`);
    }
  }

  return result;
}

/**
 * Réinitialise le registre (tests uniquement).
 */
function resetPendingPrintTempsForTests() {
  pendingPrintTemps.clear();
}

/**
 * @param {unknown} error
 * @returns {{ ok: false, error: string, sandbox: null }}
 */
function toPrintError(error) {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Échec impression PDF.";
  if (msg === "PRINT_LOAD_TIMEOUT") {
    return { ok: false, error: "Délai de chargement PDF dépassé.", sandbox: null };
  }
  if (msg === "PRINT_SANDBOX_REQUIRED") {
    return {
      ok: false,
      error: "La fenêtre d'impression doit avoir sandbox: true (ADR-006/008).",
      sandbox: null
    };
  }
  return { ok: false, error: "Échec impression PDF.", sandbox: null };
}

/**
 * Imprime un PDF déjà baked via une fenêtre hidden sandboxed.
 * Nettoie le fichier temp dans tous les chemins (succès, cancel, erreur, timeout).
 *
 * @param {string} pdfPath chemin absolu du PDF baked (doit être déjà register si createPrintTempPath)
 * @param {{
 *   BrowserWindow?: typeof import("electron").BrowserWindow,
 *   printOptions?: import("electron").WebContentsPrintOptions,
 *   loadTimeoutMs?: number,
 *   callbackTimeoutMs?: number,
 *   settleMs?: number,
 *   deleteTemp?: boolean,
 *   pathToFileURL?: (p: string) => string,
 *   assertSandbox?: boolean
 * }} [deps]
 * @returns {Promise<{
 *   ok: boolean,
 *   printed?: boolean,
 *   canceledOrFailed?: boolean,
 *   sandbox: boolean | null,
 *   webPreferences?: { sandbox: boolean, contextIsolation: boolean, nodeIntegration: boolean },
 *   tempRemoved: boolean,
 *   error?: string
 * }>}
 */
/* c8 ignore start -- L6: BrowserWindow / print Electron ; couvert par spike + mocks unitaires */
async function printBakedPdf(pdfPath, deps = {}) {
  const { BrowserWindow } = deps.BrowserWindow
    ? { BrowserWindow: deps.BrowserWindow }
    : require("electron");
  const deleteTemp = deps.deleteTemp !== false;
  const loadTimeoutMs = deps.loadTimeoutMs ?? 15000;
  const callbackTimeoutMs = deps.callbackTimeoutMs ?? PRINT_CALLBACK_TIMEOUT_MS;
  const settleMs = deps.settleMs ?? 300;
  const assertSandbox = deps.assertSandbox !== false;
  const pathToFileURL =
    deps.pathToFileURL ??
    ((p) => {
      const { pathToFileURL: toUrl } = require("node:url");
      return toUrl(p).href;
    });

  const resolvedPdf = path.resolve(String(pdfPath));
  if (!fs.existsSync(resolvedPdf)) {
    return {
      ok: false,
      error: "Fichier PDF temporaire introuvable.",
      sandbox: null,
      tempRemoved: false
    };
  }

  registerPrintTemp(resolvedPdf);

  /** @type {import("electron").BrowserWindow | null} */
  let win = null;
  let cleaned = false;

  const cleanupTemp = () => {
    if (!deleteTemp || cleaned) return cleaned;
    const r = safeUnlinkPrintTemp(resolvedPdf);
    cleaned = r.ok;
    return cleaned;
  };

  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { ...PRINT_WEB_PREFERENCES }
    });

    const prefs = win.webContents.getLastWebPreferences?.() || {};
    const sandboxOn = prefs.sandbox === true;
    const webPreferences = {
      sandbox: Boolean(prefs.sandbox),
      contextIsolation: Boolean(prefs.contextIsolation),
      nodeIntegration: Boolean(prefs.nodeIntegration)
    };

    if (assertSandbox && !sandboxOn) {
      cleanupTemp();
      throw new Error("PRINT_SANDBOX_REQUIRED");
    }

    const fileUrl = pathToFileURL(resolvedPdf);

    await Promise.race([
      win.loadURL(fileUrl),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PRINT_LOAD_TIMEOUT")), loadTimeoutMs);
      })
    ]);

    if (settleMs > 0) {
      await new Promise((r) => setTimeout(r, settleMs));
    }

    const printOptions = {
      silent: false,
      printBackground: true,
      ...(deps.printOptions || {})
    };

    const printResult = await new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      const timer = setTimeout(() => {
        finish({ success: false, failureReason: "PRINT_CALLBACK_TIMEOUT" });
      }, callbackTimeoutMs);

      try {
        win.webContents.print(printOptions, (success, failureReason) => {
          clearTimeout(timer);
          finish({
            success: Boolean(success),
            failureReason: failureReason ? String(failureReason) : ""
          });
        });
      } catch (error) {
        clearTimeout(timer);
        finish({
          success: false,
          failureReason:
            error && typeof error === "object" && "message" in error
              ? String(error.message)
              : "print threw"
        });
      }

      win.once("closed", () => {
        clearTimeout(timer);
        finish({ success: false, failureReason: "PRINT_WINDOW_CLOSED" });
      });
    });

    const tempRemoved = cleanupTemp();

    if (printResult.success) {
      return {
        ok: true,
        printed: true,
        sandbox: sandboxOn,
        webPreferences,
        tempRemoved
      };
    }

    return {
      ok: true,
      printed: false,
      canceledOrFailed: true,
      sandbox: sandboxOn,
      webPreferences,
      tempRemoved,
      error: printResult.failureReason || "Impression annulée ou échouée."
    };
  } catch (error) {
    const tempRemoved = cleanupTemp();
    const base = toPrintError(error);
    return { ...base, tempRemoved };
  } finally {
    try {
      if (win && !win.isDestroyed()) win.destroy();
    } catch {
      /* intentional: destroy print window best-effort */
    }
    cleanupTemp();
  }
}
/* c8 ignore stop */

module.exports = {
  PRINT_TEMP_SUBDIR,
  PRINT_TEMP_FILE_PREFIX,
  PRINT_TEMP_MAX_AGE_MS,
  PRINT_CALLBACK_TIMEOUT_MS,
  PRINT_WEB_PREFERENCES,
  getPrintTempDir,
  isPathInsidePrintTempDir,
  createPrintTempPath,
  registerPrintTemp,
  unregisterPrintTemp,
  listPendingPrintTemps,
  safeUnlinkPrintTemp,
  unlinkAllPendingPrintTemps,
  sweepOrphanPrintTemps,
  resetPendingPrintTempsForTests,
  toPrintError,
  printBakedPdf
};
