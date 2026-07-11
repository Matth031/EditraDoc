const MAX_SESSION_SAVE_BYTES = 50 * 1024 * 1024;

const ERROR_CODES = {
  SESSION_NOT_SERIALIZABLE: "SESSION_NOT_SERIALIZABLE",
  SESSION_PAYLOAD_TOO_LARGE: "SESSION_PAYLOAD_TOO_LARGE"
};

/**
 * Valide le payload session:save avant écriture disque (E-AUDIT-02.5).
 * @param {unknown} payload
 */
function prepareSessionSavePayload(payload) {
  let serialized;
  try {
    serialized = JSON.stringify(payload, null, 2);
  } catch {
    return {
      ok: false,
      error: "Sauvegarde session refusee : donnees non serialisables.",
      errorCode: ERROR_CODES.SESSION_NOT_SERIALIZABLE
    };
  }
  const byteLength = Buffer.byteLength(serialized, "utf8");
  if (byteLength > MAX_SESSION_SAVE_BYTES) {
    return {
      ok: false,
      error: `Sauvegarde session refusee : payload trop volumineux (${byteLength} octets, max 50 Mo).`,
      errorCode: ERROR_CODES.SESSION_PAYLOAD_TOO_LARGE
    };
  }
  return { ok: true, serialized, byteLength };
}

module.exports = {
  MAX_SESSION_SAVE_BYTES,
  ERROR_CODES,
  prepareSessionSavePayload
};
