"use strict";

const crypto = require("node:crypto");

/**
 * Mode attach : Electron réutilise un service Python déjà lancé (CI macOS E2E).
 * Gate stricte : uniquement la chaîne "1" — absente / autre valeur ⇒ chemin spawn normal.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
function isPythonExternalAttach(env = process.env) {
  return env.MANI_PDF_PYTHON_EXTERNAL === "1";
}

/**
 * Token main ↔ Python.
 * - Attach : obligatoire via MANI_PDF_SERVICE_TOKEN (même secret que le process partagé).
 * - Hors attach : randomBytes comme avant ; ignore un token shell résiduel.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ randomBytes?: (size: number) => Buffer }} [deps]
 * @returns {string}
 */
function resolvePythonServiceToken(env = process.env, deps = {}) {
  if (isPythonExternalAttach(env)) {
    const token =
      typeof env.MANI_PDF_SERVICE_TOKEN === "string" ? env.MANI_PDF_SERVICE_TOKEN.trim() : "";
    if (!token) {
      throw new Error(
        "MANI_PDF_PYTHON_EXTERNAL=1 exige MANI_PDF_SERVICE_TOKEN (token partagé avec le service Python)."
      );
    }
    return token;
  }
  const randomBytes = deps.randomBytes || crypto.randomBytes.bind(crypto);
  return randomBytes(32).toString("hex");
}

module.exports = {
  isPythonExternalAttach,
  resolvePythonServiceToken
};
