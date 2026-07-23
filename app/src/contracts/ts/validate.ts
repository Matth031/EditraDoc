/**
 * Validation runtime Ajv pour les contrats IPC / Python (P1).
 */
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import {
  PdfReadBytesRequestSchema,
  PdfReadBytesResponseSchema,
  type PdfReadBytesRequest
} from "./pdf-read-bytes.js";
import {
  PdfOpenRequestSchema,
  PdfOpenResponseSchema,
  type PdfOpenRequest
} from "./pdf-open.js";
import {
  ValidatePdfRequestSchema,
  ValidatePdfResponseSchema,
  type ValidatePdfRequest
} from "./pdf-validate.js";
import {
  ApplyAnnotationsRequestSchema,
  ApplyAnnotationsResponseSchema,
  type ApplyAnnotationsRequest
} from "./apply-annotations.js";
import { AnnotationSchema } from "./annotation.js";

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  removeAdditional: false
});

const validateReadBytesRequest: ValidateFunction = ajv.compile(PdfReadBytesRequestSchema);
const validateOpenRequest: ValidateFunction = ajv.compile(PdfOpenRequestSchema);
const validateValidateRequest: ValidateFunction = ajv.compile(ValidatePdfRequestSchema);
const validateApplyAnnotationsRequest: ValidateFunction = ajv.compile(
  ApplyAnnotationsRequestSchema
);

export type ContractValidationOk<T> = { ok: true; value: T };
export type ContractValidationErr = {
  ok: false;
  error: string;
  errorCode: "CONTRACT_INVALID";
  details?: ErrorObject[];
};

function formatAjvErrors(errors: ErrorObject[] | null | undefined, fallback: string): string {
  return (
    errors?.map((e) => `${e.instancePath || "/"} ${e.message || ""}`.trim()).join("; ") || fallback
  );
}

/**
 * Normalise l’argument IPC historique (string path) vers `{ path }`.
 */
export function normalizePathArg(raw: unknown): unknown {
  if (typeof raw === "string") {
    return { path: raw };
  }
  return raw;
}

/** @deprecated alias — préférer normalizePathArg */
export function normalizePdfReadBytesArg(raw: unknown): unknown {
  return normalizePathArg(raw);
}

export function validatePdfReadBytesRequestContract(
  raw: unknown
): ContractValidationOk<PdfReadBytesRequest> | ContractValidationErr {
  const candidate = normalizePathArg(raw);
  if (validateReadBytesRequest(candidate)) {
    return { ok: true, value: candidate as PdfReadBytesRequest };
  }
  return {
    ok: false,
    error: `Contrat IPC invalide: ${formatAjvErrors(validateReadBytesRequest.errors, "Requête pdf:read-bytes invalide.")}`,
    errorCode: "CONTRACT_INVALID",
    details: validateReadBytesRequest.errors || undefined
  };
}

export function validatePdfOpenRequestContract(
  raw: unknown
): ContractValidationOk<PdfOpenRequest> | ContractValidationErr {
  const candidate = normalizePathArg(raw);
  if (validateOpenRequest(candidate)) {
    return { ok: true, value: candidate as PdfOpenRequest };
  }
  return {
    ok: false,
    error: `Contrat IPC invalide: ${formatAjvErrors(validateOpenRequest.errors, "Requête pdf:open invalide.")}`,
    errorCode: "CONTRACT_INVALID",
    details: validateOpenRequest.errors || undefined
  };
}

/** Même schéma que POST /validate — utile pour tests / alignement Node. */
export function validateValidatePdfRequestContract(
  raw: unknown
): ContractValidationOk<ValidatePdfRequest> | ContractValidationErr {
  const candidate = normalizePathArg(raw);
  if (validateValidateRequest(candidate)) {
    return { ok: true, value: candidate as ValidatePdfRequest };
  }
  return {
    ok: false,
    error: `Contrat invalide: ${formatAjvErrors(validateValidateRequest.errors, "Requête /validate invalide.")}`,
    errorCode: "CONTRACT_INVALID",
    details: validateValidateRequest.errors || undefined
  };
}

export function validateApplyAnnotationsRequestContract(
  raw: unknown
): ContractValidationOk<ApplyAnnotationsRequest> | ContractValidationErr {
  if (validateApplyAnnotationsRequest(raw)) {
    return { ok: true, value: raw as ApplyAnnotationsRequest };
  }
  return {
    ok: false,
    error: `Contrat IPC invalide: ${formatAjvErrors(validateApplyAnnotationsRequest.errors, "Requête apply-annotations invalide.")}`,
    errorCode: "CONTRACT_INVALID",
    details: validateApplyAnnotationsRequest.errors || undefined
  };
}

/** Schémas exportés pour le build (écriture JSON artefacts). */
export const schemas = {
  "pdf-read-bytes.request.json": PdfReadBytesRequestSchema,
  "pdf-read-bytes.response.json": PdfReadBytesResponseSchema,
  "pdf-open.request.json": PdfOpenRequestSchema,
  "pdf-open.response.json": PdfOpenResponseSchema,
  "pdf-validate.request.json": ValidatePdfRequestSchema,
  "pdf-validate.response.json": ValidatePdfResponseSchema,
  "annotation.json": AnnotationSchema,
  "apply-annotations.request.json": ApplyAnnotationsRequestSchema,
  "apply-annotations.response.json": ApplyAnnotationsResponseSchema
};
