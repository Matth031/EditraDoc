const path = require("node:path");

/**
 * Vérifie que le PDF de sortie est dans le même dossier que le fichier source (PDF, HTML, etc.).
 * Limite l'écriture arbitraire si le payload IPC était altéré (défense en profondeur).
 * @param {unknown} inputPath
 * @param {unknown} outputPath
 * @returns {boolean}
 */
function isPdfOutputColocatedWithInput(inputPath, outputPath) {
  if (
    !inputPath ||
    !outputPath ||
    typeof inputPath !== "string" ||
    typeof outputPath !== "string"
  ) {
    return false;
  }
  if (!outputPath.toLowerCase().endsWith(".pdf")) return false;
  try {
    const inDir = path.normalize(path.dirname(path.resolve(inputPath)));
    const outDir = path.normalize(path.dirname(path.resolve(outputPath)));
    return inDir === outDir;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} inputPath
 * @returns {boolean}
 */
function isHtmlInputPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") return false;
  const lower = inputPath.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

/**
 * Chemin PDF co-localisé : même dossier, basename sans extension + `.pdf`.
 * @param {string} inputPath
 * @returns {string}
 */
function resolveHtmlToPdfOutputPath(inputPath) {
  const resolved = path.resolve(inputPath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, path.extname(resolved));
  return path.join(dir, `${base}.pdf`);
}

/**
 * Valide entrée HTML et sortie PDF co-localisée (pure, sans accès disque).
 * @param {unknown} inputPath
 * @param {unknown} [outputPath]
 * @returns {{ ok: true, outputPath: string } | { ok: false, error: string }}
 */
function validateHtmlToPdfPaths(inputPath, outputPath) {
  if (!isHtmlInputPath(inputPath)) {
    return { ok: false, error: "Fichier HTML invalide." };
  }
  const out =
    outputPath && typeof outputPath === "string" && outputPath.trim()
      ? path.resolve(outputPath.trim())
      : resolveHtmlToPdfOutputPath(String(inputPath));
  if (!out.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Sortie PDF invalide." };
  }
  if (!isPdfOutputColocatedWithInput(String(inputPath), out)) {
    return { ok: false, error: "Le PDF de sortie doit être dans le même dossier que le HTML." };
  }
  return { ok: true, outputPath: out };
}

const RASTER_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];

/**
 * @param {unknown} inputPath
 * @returns {boolean}
 */
function isRasterImageInputPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") return false;
  const lower = inputPath.toLowerCase();
  return RASTER_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * @param {string[]} inputPaths
 * @returns {string}
 */
function resolveImagesToPdfOutputPath(inputPaths) {
  const first = path.resolve(String(inputPaths[0]));
  const dir = path.dirname(first);
  const base = path.basename(first, path.extname(first));
  return path.join(dir, `${base}.pdf`);
}

/**
 * @param {unknown} inputPaths
 * @param {unknown} [outputPath]
 * @returns {{ ok: true, outputPath: string, inputPaths: string[] } | { ok: false, error: string }}
 */
function validateImagesToPdfPaths(inputPaths, outputPath) {
  if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
    return { ok: false, error: "Aucune image sélectionnée." };
  }
  const resolved = [];
  for (const p of inputPaths) {
    if (!isRasterImageInputPath(p)) {
      return { ok: false, error: "Format non supporté. Utilisez PNG, JPG ou JPEG." };
    }
    resolved.push(path.resolve(String(p)));
  }
  const out =
    outputPath && typeof outputPath === "string" && outputPath.trim()
      ? path.resolve(outputPath.trim())
      : resolveImagesToPdfOutputPath(resolved);
  if (!out.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Sortie PDF invalide." };
  }
  if (!isPdfOutputColocatedWithInput(resolved[0], out)) {
    return {
      ok: false,
      error: "Le PDF de sortie doit être dans le même dossier que la première image."
    };
  }
  return { ok: true, outputPath: out, inputPaths: resolved };
}

/** @deprecated Alias historique (jobs PDF merge/split) — préférer `isPdfOutputColocatedWithInput`. */
const isOutputPdfInSameDirectoryAsInput = isPdfOutputColocatedWithInput;

module.exports = {
  isPdfOutputColocatedWithInput,
  isOutputPdfInSameDirectoryAsInput,
  isHtmlInputPath,
  isRasterImageInputPath,
  resolveHtmlToPdfOutputPath,
  resolveImagesToPdfOutputPath,
  validateHtmlToPdfPaths,
  validateImagesToPdfPaths
};
