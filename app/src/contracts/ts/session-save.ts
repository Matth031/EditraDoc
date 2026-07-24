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

export type SessionSaveOk = { ok: true };
export type SessionSaveErr = { ok: false; error: string; errorCode?: string };
export type SessionSaveResponse = SessionSaveOk | SessionSaveErr;

const SessionViewportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["width", "height"],
  properties: {
    width: { type: "number" },
    height: { type: "number" }
  }
} as const;

const SessionTabSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "path",
    "currentPage",
    "annotationsByPage",
    "pageRotationsByPage",
    "pageRotationsUserTouched",
    "viewportByPage",
    "undoStack",
    "redoStack"
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    path: { type: "string", minLength: 1 },
    currentPage: { type: "number", minimum: 1 },
    annotationsByPage: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "object" }
      }
    },
    pageRotationsByPage: {
      type: "object",
      additionalProperties: { type: "number" }
    },
    pageRotationsUserTouched: {
      type: "object",
      additionalProperties: { type: "boolean" }
    },
    viewportByPage: {
      type: "object",
      additionalProperties: SessionViewportSchema
    },
    undoStack: { type: "array", items: { type: "string" } },
    redoStack: { type: "array", items: { type: "string" } }
  }
} as const;

export const SessionSaveRequestSchema = {
  $id: "editradoc.ipc.session-save.request",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["tabs", "activeTabId"],
  properties: {
    tabs: {
      type: "array",
      items: SessionTabSchema
    },
    activeTabId: {
      type: ["string", "null"],
      description: "Id onglet actif, ou null si aucun."
    }
  }
} as const;

export const SessionSaveResponseSchema = {
  $id: "editradoc.ipc.session-save.response",
  $schema: "http://json-schema.org/draft-07/schema#",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { const: true }
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
