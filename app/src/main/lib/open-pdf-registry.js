const path = require("node:path");

/** Chemins PDF actuellement ouverts (onglets) — synchronisés via pdf:open et pdf:sync-open-paths. */
let openPdfTabPaths = new Set();
/** @type {Map<string, number>} */
let openPdfPathRefCounts = new Map();

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
  if (!normalized) return;
  const next = (openPdfPathRefCounts.get(normalized) || 0) + 1;
  openPdfPathRefCounts.set(normalized, next);
  openPdfTabPaths.add(normalized);
}

/**
 * @param {string} pdfPath
 */
function unregisterOpenPdfPath(pdfPath) {
  const normalized = normalizeOpenPdfPath(pdfPath);
  if (!normalized) return;
  const current = openPdfPathRefCounts.get(normalized) || 0;
  if (current <= 0) return;
  const next = current - 1;
  if (next <= 0) {
    openPdfPathRefCounts.delete(normalized);
    openPdfTabPaths.delete(normalized);
  } else {
    openPdfPathRefCounts.set(normalized, next);
  }
}

/**
 * @param {string[]} paths
 */
function syncOpenPdfPaths(paths) {
  openPdfTabPaths = new Set();
  openPdfPathRefCounts.clear();
  for (const rawPath of paths || []) {
    const normalized = normalizeOpenPdfPath(rawPath);
    if (!normalized) continue;
    const next = (openPdfPathRefCounts.get(normalized) || 0) + 1;
    openPdfPathRefCounts.set(normalized, next);
    openPdfTabPaths.add(normalized);
  }
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
  openPdfPathRefCounts.clear();
}

/**
 * @param {string} pdfPath
 * @returns {number}
 */
function getOpenPdfPathRefCountForTests(pdfPath) {
  const normalized = normalizeOpenPdfPath(pdfPath);
  if (!normalized) return 0;
  return openPdfPathRefCounts.get(normalized) || 0;
}

module.exports = {
  registerOpenPdfPath,
  unregisterOpenPdfPath,
  syncOpenPdfPaths,
  isOpenPdfPath,
  normalizeOpenPdfPath,
  resetOpenPdfPathsForTests,
  getOpenPdfPathRefCountForTests
};
