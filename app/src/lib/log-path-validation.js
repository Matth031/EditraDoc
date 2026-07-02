/**
 * Validation du chemin du fichier journal (logique pure, testable).
 */
const path = require("node:path");

/**
 * @param {string} filePath
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
function normalizeAndValidateLogFilePath(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) {
    return { ok: false, error: "Chemin vide." };
  }
  const resolved = path.resolve(raw);
  const ext = path.extname(resolved).toLowerCase();
  if (ext && ext !== ".txt" && ext !== ".log") {
    return { ok: false, error: "Extension attendue : .txt ou .log." };
  }
  const finalPath = ext ? resolved : `${resolved}.txt`;
  const base = path.basename(finalPath);
  if (!base || base === "." || base === "..") {
    return { ok: false, error: "Nom de fichier invalide." };
  }
  return { ok: true, path: finalPath };
}

module.exports = { normalizeAndValidateLogFilePath };
