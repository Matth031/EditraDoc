/**
 * Validation runtime Ajv pour les contrats IPC (P1).
 */
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import {
  PdfReadBytesRequestSchema,
  PdfReadBytesResponseSchema,
  type PdfReadBytesRequest
} from "./pdf-read-bytes.js";

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  removeAdditional: false
});

const validateRequest: ValidateFunction = ajv.compile(PdfReadBytesRequestSchema);

export type ContractValidationOk<T> = { ok: true; value: T };
export type ContractValidationErr = {
  ok: false;
  error: string;
  errorCode: "CONTRACT_INVALID";
  details?: ErrorObject[];
};

/**
 * Normalise l’argument IPC historique (string path) vers `{ path }`.
 */
export function normalizePdfReadBytesArg(raw: unknown): unknown {
  if (typeof raw === "string") {
    return { path: raw };
  }
  return raw;
}

export function validatePdfReadBytesRequestContract(
  raw: unknown
): ContractValidationOk<PdfReadBytesRequest> | ContractValidationErr {
  const candidate = normalizePdfReadBytesArg(raw);
  if (validateRequest(candidate)) {
    return { ok: true, value: candidate as PdfReadBytesRequest };
  }
  const msg =
    validateRequest.errors
      ?.map((e) => `${e.instancePath || "/"} ${e.message || ""}`.trim())
      .join("; ") || "Requête pdf:read-bytes invalide.";
  return {
    ok: false,
    error: `Contrat IPC invalide: ${msg}`,
    errorCode: "CONTRACT_INVALID",
    details: validateRequest.errors || undefined
  };
}

/** Schémas exportés pour le build (écriture JSON artefacts). */
export const schemas = {
  "pdf-read-bytes.request.json": PdfReadBytesRequestSchema,
  "pdf-read-bytes.response.json": PdfReadBytesResponseSchema
};
