/**
 * Contrat POST `/validate` (P1 — frontière Python).
 * Runtime : jsonschema avant validate_pdf_path.
 * Corps aligné sur ce que le main envoie : `{ path }`.
 */
export type ValidatePdfRequest = {
    path: string;
};
export type ValidatePdfOk = {
    ok: true;
};
export type ValidatePdfErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type ValidatePdfResponse = ValidatePdfOk | ValidatePdfErr;
export declare const ValidatePdfRequestSchema: {
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
export declare const ValidatePdfResponseSchema: {
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
