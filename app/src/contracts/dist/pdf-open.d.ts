/**
 * Contrat IPC `pdf:open` (P1 — double frontière avec POST /validate).
 * Runtime Node : Ajv avant evaluatePdfOpen / POST Python.
 */
export type PdfOpenRequest = {
    path: string;
};
export type PdfOpenOk = {
    ok: true;
    path: string;
};
export type PdfOpenErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type PdfOpenResponse = PdfOpenOk | PdfOpenErr;
export declare const PdfOpenRequestSchema: {
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
export declare const PdfOpenResponseSchema: {
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
