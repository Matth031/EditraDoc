/**
 * Contrat IPC / POST `pdf:export-with-annotations` ↔ `/apply-annotations` (P1).
 *
 * Exception S1 : output_path MAY hors dossier source (Enregistrer sous).
 * S13 : hors schéma. S19 : audit opt-in inchangé (ne pas logger textHtml/src_base64 ici).
 */
import { AnnotationSchemaObject, type Annotation } from "./annotation.js";

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

export const CanvasPxSchema = {
  type: "object",
  required: ["w", "h"],
  properties: {
    w: { type: "number" },
    h: { type: "number" },
    rotation: { type: "number" }
  },
  additionalProperties: true
} as const;

export const ApplyAnnotationsRequestSchema = {
  $id: "editradoc.ipc.apply-annotations.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["input_path", "output_path", "canvases_px_by_page", "annotations_by_page"],
  properties: {
    input_path: {
      type: "string",
      minLength: 1,
      description: "PDF source (validé aussi côté Python via validate_pdf_path)."
    },
    output_path: {
      type: "string",
      minLength: 1,
      description: "Sortie — MAY hors dossier source (exception S1 / Enregistrer sous)."
    },
    canvases_px_by_page: {
      type: "object",
      additionalProperties: CanvasPxSchema
    },
    annotations_by_page: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: AnnotationSchemaObject
      }
    }
  }
} as const;

export const ApplyAnnotationsResponseSchema = {
  $id: "editradoc.ipc.apply-annotations.response",
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["ok", "output_path"],
      properties: {
        ok: { const: true },
        output_path: { type: "string", minLength: 1 }
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
