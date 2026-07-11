const path = require("node:path");

const MAX_PDF_READ_BYTES = 200 * 1024 * 1024;

const ERROR_CODES = {
  PDF_READ_NOT_PDF: "PDF_READ_NOT_PDF",
  PDF_READ_NOT_OPEN: "PDF_READ_NOT_OPEN",
  PDF_READ_TOO_LARGE: "PDF_READ_TOO_LARGE",
  PDF_READ_NOT_FOUND: "PDF_READ_NOT_FOUND"
};

/**
 * @param {string} pdfPath
 */
function hasPdfExtension(pdfPath) {
  const ext = path.extname(String(pdfPath || ""));
  return ext.toLowerCase() === ".pdf";
}

/**
 * Valide une demande IPC pdf:read-bytes avant lecture disque.
 * @param {string} pdfPath
 * @param {{ exists: boolean, fileSize: number, isOpenPath: boolean }} ctx
 */
function validatePdfReadBytesRequest(pdfPath, ctx) {
  if (!pdfPath || !ctx.exists) {
    return {
      ok: false,
      error: "Le fichier PDF n'existe pas.",
      errorCode: ERROR_CODES.PDF_READ_NOT_FOUND
    };
  }
  if (!hasPdfExtension(pdfPath)) {
    return {
      ok: false,
      error: "Seuls les fichiers .pdf peuvent etre lus.",
      errorCode: ERROR_CODES.PDF_READ_NOT_PDF
    };
  }
  if (!ctx.isOpenPath) {
    return {
      ok: false,
      error: "Lecture refusee : le PDF n'est pas ouvert dans l'application.",
      errorCode: ERROR_CODES.PDF_READ_NOT_OPEN
    };
  }
  if (ctx.fileSize > MAX_PDF_READ_BYTES) {
    return {
      ok: false,
      error: "Fichier PDF trop volumineux (max 200 Mo).",
      errorCode: ERROR_CODES.PDF_READ_TOO_LARGE
    };
  }
  return { ok: true };
}

module.exports = {
  MAX_PDF_READ_BYTES,
  ERROR_CODES,
  hasPdfExtension,
  validatePdfReadBytesRequest
};
