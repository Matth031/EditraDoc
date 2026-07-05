const path = require("node:path");

/** Chemins PDF actuellement ouverts (onglets) — synchronisés via pdf:open et pdf:sync-open-paths. */
let openPdfTabPaths = new Set();

/**
 * Normalise un chemin pour comparaison (résolu, casse Windows).
 * @param {string} pdfPath
 */
function normalizeOpenPdfPath(pdfPath) {
  const resolved = path.resolve(String(pdfPath || "").trim());
  if (!resolved) return "";
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * @param {string} pdfPath
 */
function registerOpenPdfPath(pdfPath) {
  const normalized = normalizeOpenPdfPath(pdfPath);
  if (normalized) openPdfTabPaths.add(normalized);
}

/**
 * @param {string[]} paths
 */
function syncOpenPdfPaths(paths) {
  openPdfTabPaths = new Set(
    (paths || []).map((p) => normalizeOpenPdfPath(p)).filter(Boolean)
  );
}

/**
 * @param {string} pdfPath
 */
function isOpenPdfPath(pdfPath) {
  const normalized = normalizeOpenPdfPath(pdfPath);
  return Boolean(normalized && openPdfTabPaths.has(normalized));
}

/** Réinitialise le registre (tests). */
function resetOpenPdfPathsForTests() {
  openPdfTabPaths = new Set();
}

module.exports = {
  registerOpenPdfPath,
  syncOpenPdfPaths,
  isOpenPdfPath,
  normalizeOpenPdfPath,
  resetOpenPdfPathsForTests
};
