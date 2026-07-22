/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 * Utilisé par `npm run test:geometry-contract` (expect fail).
 */
import type { GeometryPort, ZoneSize } from "../geometry/geometry-port.js";

declare const geo: GeometryPort;

// Erreur attendue : width doit être number, pas string.
const badZone: ZoneSize = { width: "800", height: 600 };

geo.fitAnnotationToSafeZone(
  // Erreur attendue : objet incomplet (pas AnnotationBox).
  { x: 0 },
  badZone
);
