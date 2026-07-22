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
exports.normalizePdfReadBytesArg = normalizePdfReadBytesArg;
exports.validatePdfReadBytesRequestContract = validatePdfReadBytesRequestContract;
/**
 * Validation runtime Ajv pour les contrats IPC (P1).
 */
const ajv_1 = __importDefault(require("ajv"));
const pdf_read_bytes_js_1 = require("./pdf-read-bytes.js");
const ajv = new ajv_1.default({
    allErrors: true,
    strict: true,
    removeAdditional: false
});
const validateRequest = ajv.compile(pdf_read_bytes_js_1.PdfReadBytesRequestSchema);
/**
 * Normalise l’argument IPC historique (string path) vers `{ path }`.
 */
function normalizePdfReadBytesArg(raw) {
    if (typeof raw === "string") {
        return { path: raw };
    }
    return raw;
}
function validatePdfReadBytesRequestContract(raw) {
    const candidate = normalizePdfReadBytesArg(raw);
    if (validateRequest(candidate)) {
        return { ok: true, value: candidate };
    }
    const msg = validateRequest.errors
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
exports.schemas = {
    "pdf-read-bytes.request.json": pdf_read_bytes_js_1.PdfReadBytesRequestSchema,
    "pdf-read-bytes.response.json": pdf_read_bytes_js_1.PdfReadBytesResponseSchema
};
