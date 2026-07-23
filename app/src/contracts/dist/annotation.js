/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
/**
 * Contrat annotations export (P1) — union discriminée Text | Image | Shape.
 *
 * Shape : `type` string non vide hors text/image (choix a — miroir fallback Python,
 * pas d’enum ShapeKind = pas de 3ᵉ source de vérité vs SHAPE_TYPES / SHAPE_PCT).
 *
 * additionalProperties: true — extras renderer (textWrapManual, src blob, fileName…).
 * Couleurs nullable (captures : bgColor/backdropColor null).
 * S13 (80 Mo src_base64) : HORS schéma — seule source de vérité dans pdf_ops.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationSchema = exports.AnnotationSchemaObject = void 0;
/**
 * Corps oneOf (sans $id) — embarqué dans apply-annotations.request.
 */
exports.AnnotationSchemaObject = {
    oneOf: [
        {
            type: "object",
            required: ["type"],
            properties: {
                type: { const: "text" }
            },
            additionalProperties: true
        },
        {
            type: "object",
            required: ["type"],
            properties: {
                type: { const: "image" }
            },
            additionalProperties: true
        },
        {
            type: "object",
            required: ["type"],
            properties: {
                type: {
                    type: "string",
                    minLength: 1,
                    not: { enum: ["text", "image"] },
                    description: "Forme : string libre (rect, ellipse, … ou inconnu → fallback Python rect). Pas d’enum stricte."
                }
            },
            additionalProperties: true
        }
    ]
};
/** Artefact autonome annotation.json */
exports.AnnotationSchema = {
    $id: "editradoc.annotation",
    $schema: "http://json-schema.org/draft-07/schema#",
    ...exports.AnnotationSchemaObject
};
