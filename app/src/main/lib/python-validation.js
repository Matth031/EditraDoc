const http = require("node:http");

/** Codes d'erreur stables pour le mapping i18n côté renderer. */
const ERROR_CODES = {
  VALIDATION_SERVICE_UNAVAILABLE: "VALIDATION_SERVICE_UNAVAILABLE",
  VALIDATION_RESPONSE_INVALID: "VALIDATION_RESPONSE_INVALID"
};

const VALIDATION_MESSAGES = {
  SERVICE_UNAVAILABLE: "Service de validation PDF indisponible.",
  RESPONSE_INVALID: "Reponse validation invalide.",
  TIMEOUT: "Service de validation PDF indisponible (timeout)."
};

/**
 * Valide un PDF via le service Python local (POST /validate).
 * Fail-closed : erreur réseau ou timeout → ok: false (E-AUDIT-02.1).
 *
 * @param {string} pdfPath
 * @param {{ getPostHeaders: (contentLength: number) => Record<string, string>, timeoutMs?: number, port?: number, hostname?: string, httpRequest?: typeof http.request }} options
 * @returns {Promise<{ ok: boolean, error?: string, errorCode?: string }>}
 */
function validatePdfWithPython(pdfPath, options) {
  const getPostHeaders = options.getPostHeaders;
  const timeoutMs = options.timeoutMs ?? 1000;
  const port = options.port ?? 8765;
  const hostname = options.hostname ?? "127.0.0.1";
  const httpRequest = options.httpRequest ?? http.request;

  return new Promise((resolve) => {
    const body = JSON.stringify({ path: pdfPath });
    const req = httpRequest(
      {
        hostname,
        port,
        path: "/validate",
        method: "POST",
        headers: getPostHeaders(Buffer.byteLength(body)),
        timeout: timeoutMs
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            resolve(parsed);
          } catch {
            resolve({
              ok: false,
              error: VALIDATION_MESSAGES.RESPONSE_INVALID,
              errorCode: ERROR_CODES.VALIDATION_RESPONSE_INVALID
            });
          }
        });
      }
    );

    req.on("error", () => {
      resolve({
        ok: false,
        error: VALIDATION_MESSAGES.SERVICE_UNAVAILABLE,
        errorCode: ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        ok: false,
        error: VALIDATION_MESSAGES.TIMEOUT,
        errorCode: ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE
      });
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  validatePdfWithPython,
  ERROR_CODES,
  VALIDATION_MESSAGES
};
