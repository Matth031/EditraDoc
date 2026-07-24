/**
 * Validation runtime Ajv pour les contrats IPC / Python (P1).
 */
import { type ErrorObject } from "ajv";
import { type PdfReadBytesRequest } from "./pdf-read-bytes.js";
import { type PdfOpenRequest } from "./pdf-open.js";
import { type ValidatePdfRequest } from "./pdf-validate.js";
import { type ApplyAnnotationsRequest } from "./apply-annotations.js";
import { type JobCreateRequest } from "./job-create.js";
export type ContractValidationOk<T> = {
    ok: true;
    value: T;
};
export type ContractValidationErr = {
    ok: false;
    error: string;
    errorCode: "CONTRACT_INVALID";
    details?: ErrorObject[];
};
/**
 * Normalise l’argument IPC historique (string path) vers `{ path }`.
 */
export declare function normalizePathArg(raw: unknown): unknown;
/** @deprecated alias — préférer normalizePathArg */
export declare function normalizePdfReadBytesArg(raw: unknown): unknown;
export declare function validatePdfReadBytesRequestContract(raw: unknown): ContractValidationOk<PdfReadBytesRequest> | ContractValidationErr;
export declare function validatePdfOpenRequestContract(raw: unknown): ContractValidationOk<PdfOpenRequest> | ContractValidationErr;
/** Même schéma que POST /validate — utile pour tests / alignement Node. */
export declare function validateValidatePdfRequestContract(raw: unknown): ContractValidationOk<ValidatePdfRequest> | ContractValidationErr;
export declare function validateApplyAnnotationsRequestContract(raw: unknown): ContractValidationOk<ApplyAnnotationsRequest> | ContractValidationErr;
export declare function validateJobCreateRequestContract(raw: unknown): ContractValidationOk<JobCreateRequest> | ContractValidationErr;
/** Schémas exportés pour le build (écriture JSON artefacts). */
export declare const schemas: {
    "pdf-read-bytes.request.json": {
        readonly $id: "editradoc.ipc.pdf-read-bytes.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["path"];
        readonly properties: {
            readonly path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Chemin absolu du PDF déjà ouvert (whitelist S6).";
            };
        };
    };
    "pdf-read-bytes.response.json": {
        readonly $id: "editradoc.ipc.pdf-read-bytes.response";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "base64"];
            readonly properties: {
                readonly ok: {
                    readonly const: true;
                };
                readonly base64: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "error"];
            readonly properties: {
                readonly ok: {
                    readonly const: false;
                };
                readonly error: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly errorCode: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }];
    };
    "pdf-open.request.json": {
        readonly $id: "editradoc.ipc.pdf-open.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["path"];
        readonly properties: {
            readonly path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Chemin absolu du PDF à ouvrir.";
            };
        };
    };
    "pdf-open.response.json": {
        readonly $id: "editradoc.ipc.pdf-open.response";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "path"];
            readonly properties: {
                readonly ok: {
                    readonly const: true;
                };
                readonly path: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "error"];
            readonly properties: {
                readonly ok: {
                    readonly const: false;
                };
                readonly error: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly errorCode: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }];
    };
    "pdf-validate.request.json": {
        readonly $id: "editradoc.python.validate.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["path"];
        readonly properties: {
            readonly path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Chemin absolu du PDF à valider (service Python).";
            };
        };
    };
    "pdf-validate.response.json": {
        readonly $id: "editradoc.python.validate.response";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok"];
            readonly properties: {
                readonly ok: {
                    readonly const: true;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "error"];
            readonly properties: {
                readonly ok: {
                    readonly const: false;
                };
                readonly error: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly errorCode: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }];
    };
    "annotation.json": {
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly required: readonly ["type"];
            readonly properties: {
                readonly type: {
                    readonly const: "text";
                };
            };
            readonly additionalProperties: true;
        }, {
            readonly type: "object";
            readonly required: readonly ["type"];
            readonly properties: {
                readonly type: {
                    readonly const: "image";
                };
            };
            readonly additionalProperties: true;
        }, {
            readonly type: "object";
            readonly required: readonly ["type"];
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly minLength: 1;
                    readonly not: {
                        readonly enum: readonly ["text", "image"];
                    };
                    readonly description: "Forme : string libre (rect, ellipse, … ou inconnu → fallback Python rect). Pas d’enum stricte.";
                };
            };
            readonly additionalProperties: true;
        }];
        readonly $id: "editradoc.annotation";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
    };
    "apply-annotations.request.json": {
        readonly $id: "editradoc.ipc.apply-annotations.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["input_path", "output_path", "canvases_px_by_page", "annotations_by_page"];
        readonly properties: {
            readonly input_path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "PDF source (validé aussi côté Python via validate_pdf_path).";
            };
            readonly output_path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Sortie — MAY hors dossier source (exception S1 / Enregistrer sous).";
            };
            readonly canvases_px_by_page: {
                readonly type: "object";
                readonly additionalProperties: {
                    readonly type: "object";
                    readonly required: readonly ["w", "h"];
                    readonly properties: {
                        readonly w: {
                            readonly type: "number";
                        };
                        readonly h: {
                            readonly type: "number";
                        };
                        readonly rotation: {
                            readonly type: "number";
                        };
                    };
                    readonly additionalProperties: true;
                };
            };
            readonly annotations_by_page: {
                readonly type: "object";
                readonly additionalProperties: {
                    readonly type: "array";
                    readonly items: {
                        readonly oneOf: readonly [{
                            readonly type: "object";
                            readonly required: readonly ["type"];
                            readonly properties: {
                                readonly type: {
                                    readonly const: "text";
                                };
                            };
                            readonly additionalProperties: true;
                        }, {
                            readonly type: "object";
                            readonly required: readonly ["type"];
                            readonly properties: {
                                readonly type: {
                                    readonly const: "image";
                                };
                            };
                            readonly additionalProperties: true;
                        }, {
                            readonly type: "object";
                            readonly required: readonly ["type"];
                            readonly properties: {
                                readonly type: {
                                    readonly type: "string";
                                    readonly minLength: 1;
                                    readonly not: {
                                        readonly enum: readonly ["text", "image"];
                                    };
                                    readonly description: "Forme : string libre (rect, ellipse, … ou inconnu → fallback Python rect). Pas d’enum stricte.";
                                };
                            };
                            readonly additionalProperties: true;
                        }];
                    };
                };
            };
        };
    };
    "apply-annotations.response.json": {
        readonly $id: "editradoc.ipc.apply-annotations.response";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "output_path"];
            readonly properties: {
                readonly ok: {
                    readonly const: true;
                };
                readonly output_path: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "error"];
            readonly properties: {
                readonly ok: {
                    readonly const: false;
                };
                readonly error: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly errorCode: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }];
    };
    "job-create.request.json": {
        readonly $id: "editradoc.ipc.job-create.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["type", "payload"];
            readonly properties: {
                readonly type: {
                    readonly const: "merge";
                };
                readonly payload: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["inputs", "output_path"];
                    readonly properties: {
                        readonly inputs: {
                            readonly type: "array";
                            readonly minItems: 2;
                            readonly items: {
                                readonly type: "string";
                                readonly minLength: 1;
                            };
                        };
                        readonly output_path: {
                            readonly type: "string";
                            readonly minLength: 1;
                        };
                    };
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["type", "payload"];
            readonly properties: {
                readonly type: {
                    readonly const: "split";
                };
                readonly payload: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["input_path", "output_path", "from_page", "to_page"];
                    readonly properties: {
                        readonly input_path: {
                            readonly type: "string";
                            readonly minLength: 1;
                        };
                        readonly output_path: {
                            readonly type: "string";
                            readonly minLength: 1;
                        };
                        readonly from_page: {
                            readonly type: "number";
                        };
                        readonly to_page: {
                            readonly type: "number";
                        };
                    };
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["type", "payload"];
            readonly properties: {
                readonly type: {
                    readonly const: "split_groups";
                };
                readonly payload: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["input_path", "groups"];
                    readonly properties: {
                        readonly input_path: {
                            readonly type: "string";
                            readonly minLength: 1;
                        };
                        readonly groups: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly additionalProperties: false;
                                readonly required: readonly ["output_path", "page_indices"];
                                readonly properties: {
                                    readonly output_path: {
                                        readonly type: "string";
                                        readonly minLength: 1;
                                    };
                                    readonly page_indices: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "number";
                                            readonly minimum: 1;
                                            readonly maximum: 99999;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        }];
    };
    "job-create.response.json": {
        readonly $id: "editradoc.ipc.job-create.response";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "id"];
            readonly properties: {
                readonly ok: {
                    readonly const: true;
                };
                readonly id: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["ok", "error"];
            readonly properties: {
                readonly ok: {
                    readonly const: false;
                };
                readonly error: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly errorCode: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
        }];
    };
    "merge.request.json": {
        readonly $id: "editradoc.http.merge.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["inputs", "output_path"];
        readonly properties: {
            readonly inputs: {
                readonly type: "array";
                readonly minItems: 2;
                readonly items: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
            readonly output_path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Sortie — co-localisation S1 vérifiée hors schéma (main + Python).";
            };
        };
    };
    "split.request.json": {
        readonly $id: "editradoc.http.split.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["input_path", "output_path", "from_page", "to_page"];
        readonly properties: {
            readonly input_path: {
                readonly type: "string";
                readonly minLength: 1;
            };
            readonly output_path: {
                readonly type: "string";
                readonly minLength: 1;
                readonly description: "Sortie — S1 hors schéma.";
            };
            readonly from_page: {
                readonly type: "number";
            };
            readonly to_page: {
                readonly type: "number";
            };
        };
    };
    "split-groups.request.json": {
        readonly $id: "editradoc.http.split-groups.request";
        readonly $schema: "http://json-schema.org/draft-07/schema#";
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["input_path", "groups"];
        readonly properties: {
            readonly input_path: {
                readonly type: "string";
                readonly minLength: 1;
            };
            readonly groups: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["output_path", "page_indices"];
                    readonly properties: {
                        readonly output_path: {
                            readonly type: "string";
                            readonly minLength: 1;
                        };
                        readonly page_indices: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "number";
                                readonly minimum: 1;
                                readonly maximum: 99999;
                            };
                        };
                    };
                };
            };
        };
    };
};
