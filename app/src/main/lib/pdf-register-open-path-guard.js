/**
 * Politique S6 — enregistrement whitelist onglets.
 * Aucun IPC ne doit élargir la whitelist sans passer par pdf:open
 * (existence, taille, validation Python). Conservé pour verrous de sécurité.
 */

const ERROR_CODES = {
  PDF_REGISTER_VIA_OPEN_ONLY: "PDF_REGISTER_VIA_OPEN_ONLY"
};

/**
 * Évalue une demande d'enregistrement whitelist « aveugle » (ex. ancien IPC
 * pdf:register-open-path). Toujours refusée : seul pdf:open peut enregistrer.
 * @returns {{ ok: false, error: string, errorCode: string }}
 */
function evaluateRegisterOpenPathIpcRequest() {
  return {
    ok: false,
    error: "Enregistrement whitelist refuse : utilisez pdf:open (validation obligatoire).",
    errorCode: ERROR_CODES.PDF_REGISTER_VIA_OPEN_ONLY
  };
}

module.exports = {
  ERROR_CODES,
  evaluateRegisterOpenPathIpcRequest
};
