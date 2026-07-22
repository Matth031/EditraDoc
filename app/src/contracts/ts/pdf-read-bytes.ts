/**
 * Contrat IPC `pdf:read-bytes` (P1 vague 1 — canal pilote).
 * Runtime : Ajv (main) valide la requête normalisée `{ path }` avant le guard S6.
 * Pas de route Python pour ce canal (lecture disque côté main uniquement).
 */

/** Requête normalisée (l’IPC historique passe encore une string ; le handler normalise). */
export type PdfReadBytesRequest = {
  path: string;
};

export type PdfReadBytesOk = {
  ok: true;
  base64: string;
};

export type PdfReadBytesErr = {
  ok: false;
  error: string;
  errorCode?: string;
};

export type PdfReadBytesResponse = PdfReadBytesOk | PdfReadBytesErr;

/** JSON Schema — source runtime partagée (artefact `.json` généré au build). */
export const PdfReadBytesRequestSchema = {
  $id: "editradoc.ipc.pdf-read-bytes.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: {
      type: "string",
      minLength: 1,
      description: "Chemin absolu du PDF déjà ouvert (whitelist S6)."
    }
  }
} as const;

export const PdfReadBytesResponseSchema = {
  $id: "editradoc.ipc.pdf-read-bytes.response",
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["ok", "base64"],
      properties: {
        ok: { const: true },
        base64: { type: "string", minLength: 1 }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["ok", "error"],
      properties: {
        ok: { const: false },
        error: { type: "string", minLength: 1 },
        errorCode: { type: "string", minLength: 1 }
      }
    }
  ]
} as const;
