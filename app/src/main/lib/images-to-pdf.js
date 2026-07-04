const fs = require("node:fs");
const path = require("node:path");
const { validateImagesToPdfPaths } = require("./path-guard");

const MAX_IMAGE_BYTES = 80 * 1024 * 1024;

/**
 * @param {string[]} inputPaths
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateImagesOnDisk(inputPaths) {
  for (const p of inputPaths) {
    const base = path.basename(p);
    try {
      if (!fs.existsSync(p)) {
        return { ok: false, error: `Fichier introuvable : ${base}` };
      }
      const stat = fs.statSync(p);
      if (!stat.isFile()) {
        return { ok: false, error: `Chemin invalide : ${base}` };
      }
      if (stat.size <= 0) {
        return { ok: false, error: `Image vide : ${base}` };
      }
      if (stat.size > MAX_IMAGE_BYTES) {
        return { ok: false, error: `Image trop volumineuse (max ${MAX_IMAGE_BYTES / (1024 * 1024)} Mo) : ${base}` };
      }
    } catch {
      return { ok: false, error: `Impossible de lire l'image : ${base}` };
    }
  }
  return { ok: true };
}

/**
 * Convertit une ou plusieurs images PNG/JPG/JPEG en PDF via le service Python (ReportLab).
 * @param {unknown} inputPaths
 * @param {unknown} [outputPath]
 * @param {{ postToPython: (route: string, payload: object) => Promise<object>, getPythonHealth: () => Promise<object> }} deps
 * @returns {Promise<{ ok: true, outputPath: string, pageCount: number } | { ok: false, error: string }>}
 */
async function convertImagesToPdf(inputPaths, outputPath, deps) {
  const validation = validateImagesToPdfPaths(inputPaths, outputPath);
  if (!validation.ok) {
    return validation;
  }

  const disk = validateImagesOnDisk(validation.inputPaths);
  if (!disk.ok) {
    return disk;
  }

  let health;
  try {
    health = await deps.getPythonHealth();
  } catch {
    health = { ok: false };
  }
  if (!health?.export_ready) {
    return {
      ok: false,
      error:
        "Service Python ou ReportLab indisponible. Lancez npm run setup:python dans le dossier app/."
    };
  }

  let result;
  try {
    result = await deps.postToPython("/images-to-pdf", {
      input_paths: validation.inputPaths,
      output_path: validation.outputPath
    });
  } catch (error) {
    const msg = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    return { ok: false, error: msg || "Échec de la conversion image vers PDF." };
  }

  if (!result?.ok) {
    return {
      ok: false,
      error:
        typeof result?.error === "string" && result.error.trim()
          ? result.error
          : "Échec de la conversion image vers PDF."
    };
  }

  const out = validation.outputPath;
  try {
    if (!fs.existsSync(out)) {
      return { ok: false, error: "Le PDF généré est introuvable." };
    }
    if (!fs.statSync(out).size) {
      return { ok: false, error: "Le PDF généré est vide." };
    }
  } catch {
    return { ok: false, error: "Impossible de vérifier le PDF généré." };
  }

  return {
    ok: true,
    outputPath: out,
    pageCount: Number(result.page_count) || validation.inputPaths.length
  };
}

module.exports = {
  convertImagesToPdf,
  validateImagesOnDisk,
  MAX_IMAGE_BYTES
};
