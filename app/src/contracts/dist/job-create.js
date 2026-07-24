/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobCreateResponseSchema = exports.JobCreateRequestSchema = exports.SplitGroupsJobPayloadSchema = exports.SplitGroupSchema = exports.SplitJobPayloadSchema = exports.MergeJobPayloadSchema = void 0;
/** Payload POST /merge (sans wrapper type). */
exports.MergeJobPayloadSchema = {
    $id: "editradoc.http.merge.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["inputs", "output_path"],
    properties: {
        inputs: {
            type: "array",
            minItems: 2,
            items: { type: "string", minLength: 1 }
        },
        output_path: {
            type: "string",
            minLength: 1,
            description: "Sortie — co-localisation S1 vérifiée hors schéma (main + Python)."
        }
    }
};
/** Payload POST /split (legacy). */
exports.SplitJobPayloadSchema = {
    $id: "editradoc.http.split.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["input_path", "output_path", "from_page", "to_page"],
    properties: {
        input_path: { type: "string", minLength: 1 },
        output_path: {
            type: "string",
            minLength: 1,
            description: "Sortie — S1 hors schéma."
        },
        from_page: { type: "number" },
        to_page: { type: "number" }
    }
};
exports.SplitGroupSchema = {
    type: "object",
    additionalProperties: false,
    required: ["output_path", "page_indices"],
    properties: {
        output_path: { type: "string", minLength: 1 },
        page_indices: {
            type: "array",
            items: { type: "number", minimum: 1, maximum: 99999 }
        }
    }
};
/** Payload POST /split-groups. */
exports.SplitGroupsJobPayloadSchema = {
    $id: "editradoc.http.split-groups.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["input_path", "groups"],
    properties: {
        input_path: { type: "string", minLength: 1 },
        groups: {
            type: "array",
            items: exports.SplitGroupSchema
        }
    }
};
/** Requête IPC job:create — union discriminée sur `type`. */
exports.JobCreateRequestSchema = {
    $id: "editradoc.ipc.job-create.request",
    $schema: "http://json-schema.org/draft-07/schema#",
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["type", "payload"],
            properties: {
                type: { const: "merge" },
                payload: {
                    type: "object",
                    additionalProperties: false,
                    required: ["inputs", "output_path"],
                    properties: {
                        inputs: {
                            type: "array",
                            minItems: 2,
                            items: { type: "string", minLength: 1 }
                        },
                        output_path: { type: "string", minLength: 1 }
                    }
                }
            }
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["type", "payload"],
            properties: {
                type: { const: "split" },
                payload: {
                    type: "object",
                    additionalProperties: false,
                    required: ["input_path", "output_path", "from_page", "to_page"],
                    properties: {
                        input_path: { type: "string", minLength: 1 },
                        output_path: { type: "string", minLength: 1 },
                        from_page: { type: "number" },
                        to_page: { type: "number" }
                    }
                }
            }
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["type", "payload"],
            properties: {
                type: { const: "split_groups" },
                payload: {
                    type: "object",
                    additionalProperties: false,
                    required: ["input_path", "groups"],
                    properties: {
                        input_path: { type: "string", minLength: 1 },
                        groups: {
                            type: "array",
                            items: exports.SplitGroupSchema
                        }
                    }
                }
            }
        }
    ]
};
exports.JobCreateResponseSchema = {
    $id: "editradoc.ipc.job-create.response",
    $schema: "http://json-schema.org/draft-07/schema#",
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["ok", "id"],
            properties: {
                ok: { const: true },
                id: { type: "string", minLength: 1 }
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
