/**
 * Logique pure de journalisation (testable sans Electron).
 */

const LEVEL_RANK = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
});

const SENSITIVE_KEY = /password|token|secret|authorization|api[_-]?key|credential/i;

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
 */
function shouldLogLevel(level, verbose) {
  const rank = LEVEL_RANK[level] ?? LEVEL_RANK.info;
  if (rank <= LEVEL_RANK.warn) return true;
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
  sanitizeData,
  shouldLogLevel,
  formatLogLine
};
