/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionSaveResponseSchema = exports.SessionSaveRequestSchema = void 0;
const SessionViewportSchema = {
    type: "object",
    additionalProperties: false,
    required: ["width", "height"],
    properties: {
        width: { type: "number" },
        height: { type: "number" }
    }
};
const SessionTabSchema = {
    type: "object",
    additionalProperties: false,
    required: [
        "id",
        "name",
        "path",
        "currentPage",
        "annotationsByPage",
        "pageRotationsByPage",
        "pageRotationsUserTouched",
        "viewportByPage",
        "undoStack",
        "redoStack"
    ],
    properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        path: { type: "string", minLength: 1 },
        currentPage: { type: "number", minimum: 1 },
        annotationsByPage: {
            type: "object",
            additionalProperties: {
                type: "array",
                items: { type: "object" }
            }
        },
        pageRotationsByPage: {
            type: "object",
            additionalProperties: { type: "number" }
        },
        pageRotationsUserTouched: {
            type: "object",
            additionalProperties: { type: "boolean" }
        },
        viewportByPage: {
            type: "object",
            additionalProperties: SessionViewportSchema
        },
        undoStack: { type: "array", items: { type: "string" } },
        redoStack: { type: "array", items: { type: "string" } }
    }
};
exports.SessionSaveRequestSchema = {
    $id: "editradoc.ipc.session-save.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["tabs", "activeTabId"],
    properties: {
        tabs: {
            type: "array",
            items: SessionTabSchema
        },
        activeTabId: {
            type: ["string", "null"],
            description: "Id onglet actif, ou null si aucun."
        }
    }
};
exports.SessionSaveResponseSchema = {
    $id: "editradoc.ipc.session-save.response",
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
