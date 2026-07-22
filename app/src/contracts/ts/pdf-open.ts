/**
 * Contrat IPC `pdf:open` (P1 — double frontière avec POST /validate).
 * Runtime Node : Ajv avant evaluatePdfOpen / POST Python.
 */

export type PdfOpenRequest = {
  path: string;
};

export type PdfOpenOk = {
  ok: true;
  path: string;
};

export type PdfOpenErr = {
  ok: false;
  error: string;
  errorCode?: string;
};

export type PdfOpenResponse = PdfOpenOk | PdfOpenErr;

export const PdfOpenRequestSchema = {
  $id: "editradoc.ipc.pdf-open.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: {
      type: "string",
      minLength: 1,
      description: "Chemin absolu du PDF à ouvrir."
    }
  }
} as const;

export const PdfOpenResponseSchema = {
  $id: "editradoc.ipc.pdf-open.response",
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["ok", "path"],
      properties: {
        ok: { const: true },
        path: { type: "string", minLength: 1 }
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
