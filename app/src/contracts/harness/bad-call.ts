/**
 * Harness volontairement incorrect — doit faire échouer `tsc --noEmit`.
 */
import type { SessionSaveRequest } from "../ts/session-save.js";

// Erreurs attendues : tabs doit être un tableau ; activeTabId pas un number.
const badSession: SessionSaveRequest = {
  tabs: 42,
  activeTabId: 7
};

void badSession;
