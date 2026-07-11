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

/** E-AUDIT-02.1 bis — cold-start Python sans affaiblir le fail-closed. */
const DEFAULT_VALIDATION_TIMEOUT_MS = 1500;
const MAX_VALIDATION_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [300, 600];

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Une tentative POST /validate (sans retry).
 * @param {string} pdfPath
 * @param {{ getPostHeaders: (contentLength: number) => Record<string, string>, timeoutMs: number, port: number, hostname: string, httpRequest: typeof http.request }} ctx
 */
function validatePdfWithPythonOnce(pdfPath, ctx) {
  const { getPostHeaders, timeoutMs, port, hostname, httpRequest } = ctx;

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

/**
 * Valide un PDF via le service Python local (POST /validate).
 * Fail-closed : erreur réseau ou timeout → retry limité puis ok: false (E-AUDIT-02.1 bis).
 *
 * @param {string} pdfPath
 * @param {{ getPostHeaders: (contentLength: number) => Record<string, string>, timeoutMs?: number, maxAttempts?: number, retryBackoffMs?: number[], port?: number, hostname?: string, httpRequest?: typeof http.request, sleep?: (ms: number) => Promise<void> }} options
 * @returns {Promise<{ ok: boolean, error?: string, errorCode?: string }>}
 */
async function validatePdfWithPython(pdfPath, options) {
  const getPostHeaders = options.getPostHeaders;
  const timeoutMs = options.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? MAX_VALIDATION_ATTEMPTS;
  const retryBackoffMs = options.retryBackoffMs ?? RETRY_BACKOFF_MS;
  const port = options.port ?? 8765;
  const hostname = options.hostname ?? "127.0.0.1";
  const httpRequest = options.httpRequest ?? http.request;
  const sleep = options.sleep ?? defaultSleep;

  const ctx = { getPostHeaders, timeoutMs, port, hostname, httpRequest };

  let lastResult = {
    ok: false,
    error: VALIDATION_MESSAGES.SERVICE_UNAVAILABLE,
    errorCode: ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResult = await validatePdfWithPythonOnce(pdfPath, ctx);
    if (lastResult.ok) {
      return lastResult;
    }
    if (lastResult.errorCode !== ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE) {
      return lastResult;
    }
    if (attempt < maxAttempts - 1) {
      const backoff = retryBackoffMs[attempt] ?? retryBackoffMs[retryBackoffMs.length - 1] ?? 0;
      if (backoff > 0) {
        await sleep(backoff);
      }
    }
  }

  return lastResult;
}

module.exports = {
  validatePdfWithPython,
  validatePdfWithPythonOnce,
  ERROR_CODES,
  VALIDATION_MESSAGES,
  DEFAULT_VALIDATION_TIMEOUT_MS,
  MAX_VALIDATION_ATTEMPTS,
  RETRY_BACKOFF_MS
};
