/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
exports.normalizePathArg = normalizePathArg;
exports.normalizePdfReadBytesArg = normalizePdfReadBytesArg;
exports.validatePdfReadBytesRequestContract = validatePdfReadBytesRequestContract;
exports.validatePdfOpenRequestContract = validatePdfOpenRequestContract;
exports.validateValidatePdfRequestContract = validateValidatePdfRequestContract;
exports.validateApplyAnnotationsRequestContract = validateApplyAnnotationsRequestContract;
exports.validateJobCreateRequestContract = validateJobCreateRequestContract;
/**
 * Validation runtime Ajv pour les contrats IPC / Python (P1).
 */
const ajv_1 = __importDefault(require("ajv"));
const pdf_read_bytes_js_1 = require("./pdf-read-bytes.js");
const pdf_open_js_1 = require("./pdf-open.js");
const pdf_validate_js_1 = require("./pdf-validate.js");
const apply_annotations_js_1 = require("./apply-annotations.js");
const annotation_js_1 = require("./annotation.js");
const job_create_js_1 = require("./job-create.js");
const ajv = new ajv_1.default({
    allErrors: true,
    strict: true,
    removeAdditional: false
});
const validateReadBytesRequest = ajv.compile(pdf_read_bytes_js_1.PdfReadBytesRequestSchema);
const validateOpenRequest = ajv.compile(pdf_open_js_1.PdfOpenRequestSchema);
const validateValidateRequest = ajv.compile(pdf_validate_js_1.ValidatePdfRequestSchema);
const validateApplyAnnotationsRequest = ajv.compile(apply_annotations_js_1.ApplyAnnotationsRequestSchema);
const validateJobCreateRequest = ajv.compile(job_create_js_1.JobCreateRequestSchema);
function formatAjvErrors(errors, fallback) {
    return (errors?.map((e) => `${e.instancePath || "/"} ${e.message || ""}`.trim()).join("; ") || fallback);
}
/**
 * Normalise l’argument IPC historique (string path) vers `{ path }`.
 */
function normalizePathArg(raw) {
    if (typeof raw === "string") {
        return { path: raw };
    }
    return raw;
}
/** @deprecated alias — préférer normalizePathArg */
function normalizePdfReadBytesArg(raw) {
    return normalizePathArg(raw);
}
function validatePdfReadBytesRequestContract(raw) {
    const candidate = normalizePathArg(raw);
    if (validateReadBytesRequest(candidate)) {
        return { ok: true, value: candidate };
    }
    return {
        ok: false,
        error: `Contrat IPC invalide: ${formatAjvErrors(validateReadBytesRequest.errors, "Requête pdf:read-bytes invalide.")}`,
        errorCode: "CONTRACT_INVALID",
        details: validateReadBytesRequest.errors || undefined
    };
}
function validatePdfOpenRequestContract(raw) {
    const candidate = normalizePathArg(raw);
    if (validateOpenRequest(candidate)) {
        return { ok: true, value: candidate };
    }
    return {
        ok: false,
        error: `Contrat IPC invalide: ${formatAjvErrors(validateOpenRequest.errors, "Requête pdf:open invalide.")}`,
        errorCode: "CONTRACT_INVALID",
        details: validateOpenRequest.errors || undefined
    };
}
/** Même schéma que POST /validate — utile pour tests / alignement Node. */
function validateValidatePdfRequestContract(raw) {
    const candidate = normalizePathArg(raw);
    if (validateValidateRequest(candidate)) {
        return { ok: true, value: candidate };
    }
    return {
        ok: false,
        error: `Contrat invalide: ${formatAjvErrors(validateValidateRequest.errors, "Requête /validate invalide.")}`,
        errorCode: "CONTRACT_INVALID",
        details: validateValidateRequest.errors || undefined
    };
}
function validateApplyAnnotationsRequestContract(raw) {
    if (validateApplyAnnotationsRequest(raw)) {
        return { ok: true, value: raw };
    }
    return {
        ok: false,
        error: `Contrat IPC invalide: ${formatAjvErrors(validateApplyAnnotationsRequest.errors, "Requête apply-annotations invalide.")}`,
        errorCode: "CONTRACT_INVALID",
        details: validateApplyAnnotationsRequest.errors || undefined
    };
}
function validateJobCreateRequestContract(raw) {
    if (validateJobCreateRequest(raw)) {
        return { ok: true, value: raw };
    }
    return {
        ok: false,
        error: `Contrat IPC invalide: ${formatAjvErrors(validateJobCreateRequest.errors, "Requête job:create invalide.")}`,
        errorCode: "CONTRACT_INVALID",
        details: validateJobCreateRequest.errors || undefined
    };
}
/** Schémas exportés pour le build (écriture JSON artefacts). */
exports.schemas = {
    "pdf-read-bytes.request.json": pdf_read_bytes_js_1.PdfReadBytesRequestSchema,
    "pdf-read-bytes.response.json": pdf_read_bytes_js_1.PdfReadBytesResponseSchema,
    "pdf-open.request.json": pdf_open_js_1.PdfOpenRequestSchema,
    "pdf-open.response.json": pdf_open_js_1.PdfOpenResponseSchema,
    "pdf-validate.request.json": pdf_validate_js_1.ValidatePdfRequestSchema,
    "pdf-validate.response.json": pdf_validate_js_1.ValidatePdfResponseSchema,
    "annotation.json": annotation_js_1.AnnotationSchema,
    "apply-annotations.request.json": apply_annotations_js_1.ApplyAnnotationsRequestSchema,
    "apply-annotations.response.json": apply_annotations_js_1.ApplyAnnotationsResponseSchema,
    "job-create.request.json": job_create_js_1.JobCreateRequestSchema,
    "job-create.response.json": job_create_js_1.JobCreateResponseSchema,
    "merge.request.json": job_create_js_1.MergeJobPayloadSchema,
    "split.request.json": job_create_js_1.SplitJobPayloadSchema,
    "split-groups.request.json": job_create_js_1.SplitGroupsJobPayloadSchema
};
