/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyAnnotationsResponseSchema = exports.ApplyAnnotationsRequestSchema = exports.CanvasPxSchema = void 0;
/**
 * Contrat IPC / POST `pdf:export-with-annotations` ↔ `/apply-annotations` (P1).
 *
 * Exception S1 : output_path MAY hors dossier source (Enregistrer sous).
 * S13 : hors schéma. S19 : audit opt-in inchangé (ne pas logger textHtml/src_base64 ici).
 */
const annotation_js_1 = require("./annotation.js");
exports.CanvasPxSchema = {
    type: "object",
    required: ["w", "h"],
    properties: {
        w: { type: "number" },
        h: { type: "number" },
        rotation: { type: "number" }
    },
    additionalProperties: true
};
exports.ApplyAnnotationsRequestSchema = {
    $id: "editradoc.ipc.apply-annotations.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["input_path", "output_path", "canvases_px_by_page", "annotations_by_page"],
    properties: {
        input_path: {
            type: "string",
            minLength: 1,
            description: "PDF source (validé aussi côté Python via validate_pdf_path)."
        },
        output_path: {
            type: "string",
            minLength: 1,
            description: "Sortie — MAY hors dossier source (exception S1 / Enregistrer sous)."
        },
        canvases_px_by_page: {
            type: "object",
            additionalProperties: exports.CanvasPxSchema
        },
        annotations_by_page: {
            type: "object",
            additionalProperties: {
                type: "array",
                items: annotation_js_1.AnnotationSchemaObject
            }
        }
    }
};
exports.ApplyAnnotationsResponseSchema = {
    $id: "editradoc.ipc.apply-annotations.response",
    $schema: "http://json-schema.org/draft-07/schema#",
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["ok", "output_path"],
            properties: {
                ok: { const: true },
                output_path: { type: "string", minLength: 1 }
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
