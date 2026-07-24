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

export type JobCreateRequest =
  | { type: "merge"; payload: MergeJobPayload }
  | { type: "split"; payload: SplitJobPayload }
  | { type: "split_groups"; payload: SplitGroupsJobPayload };

export type JobCreateOk = { ok: true; id: string };
export type JobCreateErr = { ok: false; error: string; errorCode?: string };
export type JobCreateResponse = JobCreateOk | JobCreateErr;

/** Payload POST /merge (sans wrapper type). */
export const MergeJobPayloadSchema = {
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
} as const;

/** Payload POST /split (legacy). */
export const SplitJobPayloadSchema = {
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
} as const;

export const SplitGroupSchema = {
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
} as const;

/** Payload POST /split-groups. */
export const SplitGroupsJobPayloadSchema = {
  $id: "editradoc.http.split-groups.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["input_path", "groups"],
  properties: {
    input_path: { type: "string", minLength: 1 },
    groups: {
      type: "array",
      items: SplitGroupSchema
    }
  }
} as const;

/** Requête IPC job:create — union discriminée sur `type`. */
export const JobCreateRequestSchema = {
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
              items: SplitGroupSchema
            }
          }
        }
      }
    }
  ]
} as const;

export const JobCreateResponseSchema = {
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
} as const;
