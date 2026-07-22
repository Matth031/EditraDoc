/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 */
import type { PdfReadBytesRequest } from "../ts/pdf-read-bytes.js";

// Erreur attendue : path doit être string, pas number.
const bad: PdfReadBytesRequest = { path: 42 };

void bad;
