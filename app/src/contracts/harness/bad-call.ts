/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 */
import type { ApplyAnnotationsRequest } from "../ts/apply-annotations.js";
import type { TextAnnotation } from "../ts/annotation.js";

// Erreurs attendues : input_path doit être string ; fontSize doit être number.
const badApply: ApplyAnnotationsRequest = {
  input_path: 42,
  output_path: "out.pdf",
  canvases_px_by_page: {},
  annotations_by_page: {}
};

const badText: TextAnnotation = { type: "text", fontSize: "xx" };

void badApply;
void badText;
