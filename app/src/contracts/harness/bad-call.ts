/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 */
import type { PdfOpenRequest } from "../ts/pdf-open.js";
import type { ValidatePdfRequest } from "../ts/pdf-validate.js";

// Erreurs attendues : path doit être string.
const badOpen: PdfOpenRequest = { path: 42 };
const badValidate: ValidatePdfRequest = { path: null };

void badOpen;
void badValidate;
