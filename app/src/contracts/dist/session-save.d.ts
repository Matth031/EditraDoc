/**
 * Contrat IPC `session:save` (P1 vague 2).
 *
 * Runtime : Ajv (main) uniquement — **pas de route Python** (comme `pdf:read-bytes`).
 * Critère « double frontière » = frontière unique Node ici.
 *
 * S10 / E-AUDIT-02.5 (plafond 50 Mo) : **hors schéma** — source de vérité
 * `prepareSessionSavePayload` (`session-save-guard.js`). Le JSON Schema valide
 * la forme uniquement (ADR-005).
 *
 * Forme alignée sur `renderer-session.js` → `saveSession` (tabsPayload + activeTabId).
 */
export type SessionViewport = {
    width: number;
    height: number;
};
/** Onglet tel qu’émis par le renderer (pas le Tab monolithe runtime). */
export type SessionTabPayload = {
    id: string;
    name: string;
    path: string;
    currentPage: number;
    /** Annotations par page — contenu libre (Text|Image|Shape + champs session). */
    annotationsByPage: Record<string, object[]>;
    pageRotationsByPage: Record<string, number>;
    pageRotationsUserTouched: Record<string, boolean>;
    viewportByPage: Record<string, SessionViewport>;
    /** Snapshots JSON.stringify (history) — tableaux de strings. */
    undoStack: string[];
    redoStack: string[];
};
export type SessionSaveRequest = {
    tabs: SessionTabPayload[];
    activeTabId: string | null;
};
export type SessionSaveOk = {
    ok: true;
};
export type SessionSaveErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type SessionSaveResponse = SessionSaveOk | SessionSaveErr;
export declare const SessionSaveRequestSchema: {
    readonly $id: "editradoc.ipc.session-save.request";
    readonly $schema: "http://json-schema.org/draft-07/schema#";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["tabs", "activeTabId"];
    readonly properties: {
        readonly tabs: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["id", "name", "path", "currentPage", "annotationsByPage", "pageRotationsByPage", "pageRotationsUserTouched", "viewportByPage", "undoStack", "redoStack"];
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly minLength: 1;
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly minLength: 1;
                    };
                    readonly path: {
                        readonly type: "string";
                        readonly minLength: 1;
                    };
                    readonly currentPage: {
                        readonly type: "number";
                        readonly minimum: 1;
                    };
                    readonly annotationsByPage: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                            };
                        };
                    };
                    readonly pageRotationsByPage: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "number";
                        };
                    };
                    readonly pageRotationsUserTouched: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "boolean";
                        };
                    };
                    readonly viewportByPage: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["width", "height"];
                            readonly properties: {
                                readonly width: {
                                    readonly type: "number";
                                };
                                readonly height: {
                                    readonly type: "number";
                                };
                            };
                        };
                    };
                    readonly undoStack: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                    readonly redoStack: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                };
            };
        };
        readonly activeTabId: {
            readonly type: readonly ["string", "null"];
            readonly description: "Id onglet actif, ou null si aucun.";
        };
    };
};
export declare const SessionSaveResponseSchema: {
    readonly $id: "editradoc.ipc.session-save.response";
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
