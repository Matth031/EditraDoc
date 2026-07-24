/**
 * Contrat IPC `job:create` (union discriminée) + payloads POST `/merge`, `/split`, `/split-groups`.
 *
 * S1 (co-localisation chemins) : **hors schéma** — inchangé dans `validateJobPayload` (main)
 * et `_assert_output_in_same_directory_as_input` (Python). Le JSON Schema ne vérifie que
 * la forme des chemins (string non vide), pas le dossier.
 *
 * Existence disque : hors schéma (main `validateJobPayload`).
 */
export type MergeJobPayload = {
    inputs: string[];
    output_path: string;
};
export type SplitJobPayload = {
    input_path: string;
    output_path: string;
    from_page: number;
    to_page: number;
};
export type SplitGroup = {
    output_path: string;
    page_indices: number[];
};
export type SplitGroupsJobPayload = {
    input_path: string;
    groups: SplitGroup[];
};
export type JobCreateRequest = {
    type: "merge";
    payload: MergeJobPayload;
} | {
    type: "split";
    payload: SplitJobPayload;
} | {
    type: "split_groups";
    payload: SplitGroupsJobPayload;
};
export type JobCreateOk = {
    ok: true;
    id: string;
};
export type JobCreateErr = {
    ok: false;
    error: string;
    errorCode?: string;
};
export type JobCreateResponse = JobCreateOk | JobCreateErr;
/** Payload POST /merge (sans wrapper type). */
export declare const MergeJobPayloadSchema: {
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
/** Payload POST /split (legacy). */
export declare const SplitJobPayloadSchema: {
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
export declare const SplitGroupSchema: {
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
/** Payload POST /split-groups. */
export declare const SplitGroupsJobPayloadSchema: {
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
/** Requête IPC job:create — union discriminée sur `type`. */
export declare const JobCreateRequestSchema: {
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
export declare const JobCreateResponseSchema: {
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
