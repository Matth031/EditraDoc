/**
 * Mapping peekExportPayloadForTest → payload IPC `pdf:export-with-annotations`.
 *
 * Pourquoi les noms diffèrent :
 * - `peekExportPayloadForTest` est un diagnostic renderer (camelCase, pas d’output_path).
 * - L’IPC / POST `/apply-annotations` utilise snake_case + `output_path` obligatoire.
 * - Le contenu `canvases` / `annotationsByPage` est identique ; seul le wrapping change.
 * Ne pas « reconstruire » les annotations à la main : mapper depuis les fixtures peek.
 *
 * @param {{ inputPath?: string, canvases?: object, annotationsByPage?: object }} peek
 * @param {string} outputPath
 */
function peekPayloadToIpcRequest(peek, outputPath) {
  if (!peek || typeof peek !== "object") {
    throw new Error("peek payload manquant");
  }
  return {
    input_path: String(peek.inputPath || ""),
    output_path: String(outputPath || ""),
    canvases_px_by_page: peek.canvases || {},
    annotations_by_page: peek.annotationsByPage || {}
  };
}

module.exports = { peekPayloadToIpcRequest };
