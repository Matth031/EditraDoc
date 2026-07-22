/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
/**
 * Contrat POST `/validate` (P1 — frontière Python).
 * Runtime : jsonschema avant validate_pdf_path.
 * Corps aligné sur ce que le main envoie : `{ path }`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatePdfResponseSchema = exports.ValidatePdfRequestSchema = void 0;
exports.ValidatePdfRequestSchema = {
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
};
exports.ValidatePdfResponseSchema = {
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
};
