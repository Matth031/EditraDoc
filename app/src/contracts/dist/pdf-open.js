/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
/**
 * Contrat IPC `pdf:open` (P1 — double frontière avec POST /validate).
 * Runtime Node : Ajv avant evaluatePdfOpen / POST Python.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfOpenResponseSchema = exports.PdfOpenRequestSchema = void 0;
exports.PdfOpenRequestSchema = {
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
};
exports.PdfOpenResponseSchema = {
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
};
