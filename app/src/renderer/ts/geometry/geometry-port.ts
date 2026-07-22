/**
 * Contrat typé GeometryPort (P4 pilote).
 * Source de vérité des types — l’IIFE runtime est générée depuis geometry.ts.
 */
export type ZoneSize = {
  readonly width: number;
  readonly height: number;
};

/** Boîte annotation dans le repère canvas (champs mutés par fit/scale). */
export type AnnotationBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  id?: string;
  fontSize?: number;
  padding?: number;
};

export type PageKey = string;

export type CanvasMetaByPage = Record<PageKey, { w: number; h: number }>;

/** Sous-ensemble tab requis par scale/enforce — pas le Tab monolithe. */
export type TabGeometryHost = {
  currentPage?: number;
  viewportByPage?: Record<PageKey, ZoneSize>;
  annotationsByPage?: Record<PageKey, AnnotationBox[]>;
};

export type GeometryDeps = {
  pdfLayerRef: {
    pdfCanvas: HTMLCanvasElement | null;
    annotationLayer: HTMLElement | null;
  };
  pagesContainer: HTMLElement | null;
  SHAPE_TYPES: ReadonlySet<string>;
  logText: (scope: string, data?: Record<string, unknown>) => void;
  getActiveTab: () => TabGeometryHost | null;
  currentPageAnnotations: (tab: TabGeometryHost) => AnnotationBox[];
  syncPropertyInputs: () => void;
  renderAnnotations: () => void;
};

export type DomGeometryBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export interface GeometryPort {
  bind(deps: GeometryDeps): void;
  clamp(value: number, min: number, max: number): number;
  getSafeZoneSize(): ZoneSize;
  getSafeZoneSizeForPage(
    tab: TabGeometryHost | null | undefined,
    pageKey: PageKey | number,
    canvases?: CanvasMetaByPage
  ): ZoneSize;
  readAnnotationGeometryFromDom(
    node: Element | null,
    canvas: HTMLCanvasElement | null
  ): DomGeometryBox | null;
  /** Mute `item` pour le faire tenir dans `zone`. */
  fitAnnotationToSafeZone(item: AnnotationBox, zone: ZoneSize): void;
  scaleAnnotationsForZoneChange(tab: TabGeometryHost | null, zone: ZoneSize): boolean;
  scaleAnnotationsForPage(
    tab: TabGeometryHost | null,
    zone: ZoneSize,
    pageKey: PageKey | number
  ): boolean;
  enforceSafeZoneForActiveTab(): void;
  readonly moduleId: "renderer-geometry";
}
