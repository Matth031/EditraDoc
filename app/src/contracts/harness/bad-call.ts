/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 */
import type { JobCreateRequest } from "../ts/job-create.js";
import type { MergeJobPayload } from "../ts/job-create.js";

// Erreurs attendues : inputs doit être string[] ; from_page doit être number.
const badMerge: JobCreateRequest = {
  type: "merge",
  payload: {
    inputs: 42,
    output_path: "out.pdf"
  }
};

const badSplitPages: MergeJobPayload = {
  inputs: ["a.pdf"],
  output_path: null
};

void badMerge;
void badSplitPages;
