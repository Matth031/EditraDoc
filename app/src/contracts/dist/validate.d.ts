/**
 * Validation runtime Ajv pour les contrats IPC (P1).
 */
import { type ErrorObject } from "ajv";
import { type PdfReadBytesRequest } from "./pdf-read-bytes.js";
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
export declare function normalizePdfReadBytesArg(raw: unknown): unknown;
export declare function validatePdfReadBytesRequestContract(raw: unknown): ContractValidationOk<PdfReadBytesRequest> | ContractValidationErr;
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
};
