/**
 * Contrat IPC / POST `pdf:export-with-annotations` ↔ `/apply-annotations` (P1).
 *
 * Exception S1 : output_path MAY hors dossier source (Enregistrer sous).
 * S13 : hors schéma. S19 : audit opt-in inchangé (ne pas logger textHtml/src_base64 ici).
 */
import { type Annotation } from "./annotation.js";
export type PageKey = string;
export type CanvasPx = {
    w: number;
    h: number;
    rotation?: number;
};
export type ApplyAnnotationsRequest = {
    input_path: string;
    output_path: string;
    canvases_px_by_page: Record<PageKey, CanvasPx>;
    annotations_by_page: Record<PageKey, Annotation[]>;
};
export type ApplyAnnotationsOk = {
    ok: true;
    output_path: string;
};
export type ApplyAnnotationsErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type ApplyAnnotationsResponse = ApplyAnnotationsOk | ApplyAnnotationsErr;
export declare const CanvasPxSchema: {
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
export declare const ApplyAnnotationsRequestSchema: {
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
export declare const ApplyAnnotationsResponseSchema: {
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
