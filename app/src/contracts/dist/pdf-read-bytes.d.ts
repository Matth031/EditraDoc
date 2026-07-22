/**
 * Contrat IPC `pdf:read-bytes` (P1 vague 1 — canal pilote).
 * Runtime : Ajv (main) valide la requête normalisée `{ path }` avant le guard S6.
 * Pas de route Python pour ce canal (lecture disque côté main uniquement).
 */
/** Requête normalisée (l’IPC historique passe encore une string ; le handler normalise). */
export type PdfReadBytesRequest = {
    path: string;
};
export type PdfReadBytesOk = {
    ok: true;
    base64: string;
};
export type PdfReadBytesErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type PdfReadBytesResponse = PdfReadBytesOk | PdfReadBytesErr;
/** JSON Schema — source runtime partagée (artefact `.json` généré au build). */
export declare const PdfReadBytesRequestSchema: {
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
export declare const PdfReadBytesResponseSchema: {
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
