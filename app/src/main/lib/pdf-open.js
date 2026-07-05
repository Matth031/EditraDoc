/**
 * Logique d'ouverture PDF côté main (extrait de pdf:open pour tests Node).
 * E-AUDIT-02.1 / 02.2
 */

/**
 * @param {string} pdfPath
 * @param {{ exists: boolean, fileSize: number, validation: { ok: boolean, error?: string, errorCode?: string } }} ctx
 */
function evaluatePdfOpen(pdfPath, ctx) {
  if (!pdfPath || !ctx.exists) {
    return { ok: false, error: "Le fichier PDF n'existe pas." };
  }
  if (ctx.fileSize === 0) {
    return { ok: false, error: "Le fichier PDF est vide ou corrompu." };
  }
  if (!ctx.validation?.ok) {
    return {
      ok: false,
      error: ctx.validation?.error || "Validation PDF échouée.",
      errorCode: ctx.validation?.errorCode
    };
  }
  return { ok: true, path: pdfPath };
}

module.exports = { evaluatePdfOpen };
