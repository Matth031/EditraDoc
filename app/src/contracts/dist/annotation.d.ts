/**
 * Contrat annotations export (P1) — union discriminée Text | Image | Shape.
 *
 * Shape : `type` string non vide hors text/image (choix a — miroir fallback Python,
 * pas d’enum ShapeKind = pas de 3ᵉ source de vérité vs SHAPE_TYPES / SHAPE_PCT).
 *
 * additionalProperties: true — extras renderer (textWrapManual, src blob, fileName…).
 * Couleurs nullable (captures : bgColor/backdropColor null).
 * S13 (80 Mo src_base64) : HORS schéma — seule source de vérité dans pdf_ops.
 */
/** Types usuels documentés pour DX seulement (schéma runtime = string libre hors text/image). */
export type DocumentedShapeKind = "rect" | "ellipse" | "line" | "triangle" | "diamond" | "pentagon" | "hexagon" | "octagon" | "star" | "arrow" | "heart" | "cross" | "parallelogram" | "trapezoid";
export type NullableColor = string | null;
export type AnnotationGeom = {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
    opacity?: number;
    coords_space?: string;
    pdf_ex?: number[];
    pdf_ey?: number[];
    canvas_w?: number;
    canvas_h?: number;
};
export type TextAnnotation = AnnotationGeom & {
    type: "text";
    id?: string;
    text?: string;
    textHtml?: string;
    fontSize?: number;
    fontFamily?: string;
    textColor?: NullableColor;
    bgColor?: NullableColor;
    padding?: number;
    textWrapManual?: boolean;
};
export type ImageAnnotation = AnnotationGeom & {
    type: "image";
    id?: string;
    /** Brut base64 (sans data:) — taille bornée par S13 hors schéma. */
    src_base64?: string;
    src?: string;
    fileName?: string;
    mimeType?: string;
};
export type ShapeAnnotation = AnnotationGeom & {
    /** Non vide ; hors "text"|"image". Inconnu → fallback rect côté Python. */
    type: string;
    id?: string;
    fillColor?: NullableColor;
    fillAlpha?: number;
    strokeColor?: NullableColor;
    strokeWidth?: number;
    strokeAlpha?: number;
    backdropColor?: NullableColor;
    backdropAlpha?: number;
};
export type Annotation = TextAnnotation | ImageAnnotation | ShapeAnnotation;
/**
 * Corps oneOf (sans $id) — embarqué dans apply-annotations.request.
 */
export declare const AnnotationSchemaObject: {
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
/** Artefact autonome annotation.json */
export declare const AnnotationSchema: {
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
    readonly $id: "editradoc.annotation";
    readonly $schema: "http://json-schema.org/draft-07/schema#";
};
