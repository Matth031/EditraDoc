/**
 * Contrat POST `/validate` (P1 — frontière Python).
 * Runtime : jsonschema avant validate_pdf_path.
 * Corps aligné sur ce que le main envoie : `{ path }`.
 */

export type ValidatePdfRequest = {
  path: string;
};

export type ValidatePdfOk = {
  ok: true;
};

export type ValidatePdfErr = {
  ok: false;
  error: string;
  errorCode?: string;
};

export type ValidatePdfResponse = ValidatePdfOk | ValidatePdfErr;

export const ValidatePdfRequestSchema = {
  $id: "editradoc.python.validate.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: {
      type: "string",
      minLength: 1,
      description: "Chemin absolu du PDF à valider (service Python)."
    }
  }
} as const;

export const ValidatePdfResponseSchema = {
  $id: "editradoc.python.validate.response",
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { const: true }
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
