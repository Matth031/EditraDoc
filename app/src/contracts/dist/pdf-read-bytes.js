/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
/**
 * Contrat IPC `pdf:read-bytes` (P1 vague 1 — canal pilote).
 * Runtime : Ajv (main) valide la requête normalisée `{ path }` avant le guard S6.
 * Pas de route Python pour ce canal (lecture disque côté main uniquement).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfReadBytesResponseSchema = exports.PdfReadBytesRequestSchema = void 0;
/** JSON Schema — source runtime partagée (artefact `.json` généré au build). */
exports.PdfReadBytesRequestSchema = {
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
};
exports.PdfReadBytesResponseSchema = {
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
};
