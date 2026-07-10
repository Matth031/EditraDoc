/**
 * Logique pure de journalisation (testable sans Electron).
 */

const LEVEL_RANK = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
});

/** Scopes opérationnels toujours journalisés (hors audit export S19). */
const ALWAYS_LOG_SCOPES = new Set(["save", "renderer:save", "annotation"]);

const SENSITIVE_KEY = /password|token|secret|authorization|api[_-]?key|credential/i;
const EXPORT_AUDIT_PATH_KEY = /^(input_path|output_path|input|output|path)$/i;
const EXPORT_AUDIT_PREVIEW_KEY = /^(textPreview|plain_preview|textHtml)$/i;

/**
 * Audit export (S19) : opt-in strict — uniquement EDITRADOC_EXPORT_AUDIT=1.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
function isExportAuditEnabled(env = process.env) {
  return env?.EDITRADOC_EXPORT_AUDIT === "1";
}

/**
 * Chemin réduit pour diagnostic (dossier parent + nom de fichier).
 * @param {unknown} filePath
 */
function redactPathForLog(filePath) {
  const normalized = String(filePath ?? "")
    .replace(/\\/g, "/")
    .trim();
  if (!normalized) return "";
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

/**
 * Métadonnées texte sans contenu lisible (diagnostic rendu uniquement).
 * @param {unknown} text
 */
function redactTextPreviewForLog(text) {
  const s = String(text ?? "");
  const lines = s ? s.split(/\r?\n/).length : 0;
  const words = s.trim() ? s.trim().split(/\s+/).length : 0;
  return `[len=${s.length} lines=${lines} words=${words}]`;
}

/**
 * @param {unknown} data
 * @param {number} [depth]
 * @returns {unknown}
 */
function sanitizeExportAuditData(data, depth = 0) {
  if (depth > 5) return "[max depth]";
  if (data == null) return data;
  if (typeof data === "string") {
    if (data.length > 4000) return `${data.slice(0, 4000)}…[truncated]`;
    return data;
  }
  if (typeof data === "number" || typeof data === "boolean") return data;
  if (Array.isArray(data)) {
    return data.slice(0, 80).map((item) => sanitizeExportAuditData(item, depth + 1));
  }
  if (typeof data === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[redacted]";
      } else if (EXPORT_AUDIT_PREVIEW_KEY.test(key)) {
        out[key] = redactTextPreviewForLog(value);
      } else if (EXPORT_AUDIT_PATH_KEY.test(key) && typeof value === "string") {
        out[key] = redactPathForLog(value);
      } else if (key === "base64" && typeof value === "string" && value.length > 120) {
        out[key] = `[base64 ${value.length} chars]`;
      } else {
        out[key] = sanitizeExportAuditData(value, depth + 1);
      }
    }
    return out;
  }
  return String(data);
}

/**
 * @param {unknown} data
 * @param {number} [depth]
 * @returns {unknown}
 */
function sanitizeData(data, depth = 0) {
  if (depth > 5) return "[max depth]";
  if (data == null) return data;
  if (typeof data === "string") {
    if (data.length > 4000) return `${data.slice(0, 4000)}…[truncated]`;
    return data;
  }
  if (typeof data === "number" || typeof data === "boolean") return data;
  if (Array.isArray(data)) {
    return data.slice(0, 80).map((item) => sanitizeData(item, depth + 1));
  }
  if (typeof data === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[redacted]";
      } else if (EXPORT_AUDIT_PREVIEW_KEY.test(key)) {
        out[key] = redactTextPreviewForLog(value);
      } else if (EXPORT_AUDIT_PATH_KEY.test(key) && typeof value === "string") {
        out[key] = redactPathForLog(value);
      } else if (key === "base64" && typeof value === "string" && value.length > 120) {
        out[key] = `[base64 ${value.length} chars]`;
      } else {
        out[key] = sanitizeData(value, depth + 1);
      }
    }
    return out;
  }
  return String(data);
}

/**
 * @param {string} level
 * @param {boolean} verbose
 * @param {string} [scope]
 */
function shouldLogLevel(level, verbose, scope) {
  const rank = LEVEL_RANK[level] ?? LEVEL_RANK.info;
  if (rank <= LEVEL_RANK.warn) return true;
  if (scope && ALWAYS_LOG_SCOPES.has(scope)) return true;
  return verbose;
}

/**
 * @param {{ level: string, scope: string, message: string, data?: unknown, pid?: number, ts?: string }} row
 */
function formatLogLine(row) {
  const ts = row.ts || new Date().toISOString();
  const pid = row.pid != null ? row.pid : 0;
  const level = String(row.level || "info").toUpperCase();
  const scope = String(row.scope || "app");
  const message = String(row.message || "");
  const safeData = row.data == null ? null : sanitizeData(row.data);
  const suffix = safeData == null ? "" : ` | ${JSON.stringify(safeData)}`;
  return `[${ts}] [${level}] [pid:${pid}] [${scope}] ${message}${suffix}`;
}

module.exports = {
  LEVEL_RANK,
  ALWAYS_LOG_SCOPES,
  isExportAuditEnabled,
  redactPathForLog,
  redactTextPreviewForLog,
  sanitizeExportAuditData,
  sanitizeData,
  shouldLogLevel,
  formatLogLine
};
