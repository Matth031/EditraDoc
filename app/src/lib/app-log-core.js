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

/** Fenêtre glissante / seuil soft (E4 monitoring). */
const ERROR_METRIC_WINDOW_MS = 15 * 60 * 1000;
const ERROR_METRIC_THRESHOLD = 5;
const ERROR_METRIC_MESSAGE_MAX = 80;
const ERROR_METRIC_MAX_KEYS = 120;
const ERROR_METRIC_MAX_FILE_BYTES = 64 * 1024;
const ERROR_METRIC_MAX_TIMESTAMPS = 40;
const ERROR_METRIC_MAX_THRESHOLD_SESSIONS = 10;

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

/**
 * Message métrique : troncature + chemins masqués — jamais de contenu annotation (S19).
 * @param {unknown} message
 */
function normalizeMetricMessage(message) {
  let s = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[chemin]");
  s = s.replace(/\/(?:Users|home|tmp|var|private)\/[^\s"'<>]+/gi, "[chemin]");
  // Refus explicite de payloads HTML / base64 longs dans le message normalisé.
  if (/<\s*img\b|textHtml|src_base64|data:image\//i.test(s)) {
    s = "[contenu-refuse]";
  }
  if (s.length > ERROR_METRIC_MESSAGE_MAX) {
    s = `${s.slice(0, ERROR_METRIC_MESSAGE_MAX)}…`;
  }
  return s;
}

/**
 * Hash non crypto (fingerprint stable pour regrouper).
 * @param {string} text
 */
function hashMetricMessage(text) {
  let h = 5381;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

/**
 * @returns {{ version: number, updatedAt: string | null, entries: Record<string, object>, thresholdSessions: Record<string, string[]> }}
 */
function createEmptyErrorMetricsState() {
  return {
    version: 1,
    updatedAt: null,
    entries: Object.create(null),
    /** scope → ids de session process ayant franchi le seuil (suivi TKT-ERR). */
    thresholdSessions: Object.create(null)
  };
}

/**
 * @param {string} level
 * @param {string} scope
 */
function errorMetricKey(level, scope) {
  return `${String(level || "error").toLowerCase()}|${String(scope || "app")}`;
}

/**
 * @param {number[]} timestamps
 * @param {number} now
 * @param {number} windowMs
 */
function pruneTimestamps(timestamps, now, windowMs) {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => typeof t === "number" && t >= cutoff);
}

/**
 * Compte les événements d'un scope dans la fenêtre (tous niveaux).
 * @param {ReturnType<typeof createEmptyErrorMetricsState>} state
 * @param {string} scope
 * @param {number} now
 * @param {number} windowMs
 */
function countScopeInWindow(state, scope, now, windowMs) {
  let n = 0;
  const entries = state?.entries || {};
  for (const entry of Object.values(entries)) {
    if (!entry || entry.scope !== scope) continue;
    const ts = pruneTimestamps(Array.isArray(entry.timestamps) ? entry.timestamps : [], now, windowMs);
    n += ts.length;
  }
  return n;
}

/**
 * @param {ReturnType<typeof createEmptyErrorMetricsState>} state
 * @param {{ level: string, scope: string, message?: string, now?: number, windowMs?: number, threshold?: number, sessionId?: string, maxKeys?: number }} event
 */
function bumpErrorMetric(state, event) {
  const level = String(event.level || "error").toLowerCase();
  const scope = String(event.scope || "app");
  const now = typeof event.now === "number" ? event.now : Date.now();
  const windowMs = event.windowMs ?? ERROR_METRIC_WINDOW_MS;
  const threshold = event.threshold ?? ERROR_METRIC_THRESHOLD;
  const maxKeys = event.maxKeys ?? ERROR_METRIC_MAX_KEYS;

  /** @type {ReturnType<typeof createEmptyErrorMetricsState>} */
  const next = {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    entries: { ...(state?.entries || {}) },
    thresholdSessions: { ...(state?.thresholdSessions || {}) }
  };

  // Ne pas métriquer l'alerte elle-même ni l'audit export (S19).
  if (scope === "monitor:threshold" || scope === "export-audit") {
    return {
      state: next,
      key: errorMetricKey(level, scope),
      entry: null,
      scopeCount: 0,
      shouldEmitThreshold: false
    };
  }

  if (level !== "error" && level !== "warn") {
    return {
      state: next,
      key: errorMetricKey(level, scope),
      entry: null,
      scopeCount: 0,
      shouldEmitThreshold: false
    };
  }

  const key = errorMetricKey(level, scope);
  const messageNorm = normalizeMetricMessage(event.message);
  const prev = next.entries[key] || {
    level,
    scope,
    count: 0,
    lastAt: null,
    messageNorm: "",
    messageHash: "",
    timestamps: [],
    thresholdEmittedAt: null
  };

  let timestamps = pruneTimestamps(
    Array.isArray(prev.timestamps) ? prev.timestamps.concat([now]) : [now],
    now,
    windowMs
  );
  if (timestamps.length > ERROR_METRIC_MAX_TIMESTAMPS) {
    timestamps = timestamps.slice(timestamps.length - ERROR_METRIC_MAX_TIMESTAMPS);
  }

  let thresholdEmittedAt = prev.thresholdEmittedAt;
  if (thresholdEmittedAt != null && now - Number(thresholdEmittedAt) > windowMs) {
    thresholdEmittedAt = null;
  }

  const entry = {
    level,
    scope,
    count: timestamps.length,
    lastAt: new Date(now).toISOString(),
    messageNorm,
    messageHash: hashMetricMessage(messageNorm),
    timestamps,
    thresholdEmittedAt
  };
  next.entries[key] = entry;

  const keys = Object.keys(next.entries);
  if (keys.length > maxKeys) {
    keys
      .map((k) => ({ k, t: Date.parse(String(next.entries[k].lastAt || 0)) || 0 }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - maxKeys)
      .forEach(({ k }) => {
        delete next.entries[k];
      });
  }

  const scopeCount = countScopeInWindow(next, scope, now, windowMs);
  const emit = shouldEmitThreshold(entry, { threshold, now, windowMs, scopeCount });

  return {
    state: next,
    key,
    entry,
    scopeCount,
    shouldEmitThreshold: emit
  };
}

/**
 * Marque le seuil émis pour le scope (évite spam) + enregistre la session (suivi TKT-ERR).
 * @param {ReturnType<typeof createEmptyErrorMetricsState>} state
 * @param {{ scope: string, level?: string, now?: number, sessionId?: string }} opts
 */
function markThresholdEmitted(state, opts) {
  const scope = String(opts.scope || "app");
  const level = String(opts.level || "error").toLowerCase();
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  const sessionId = opts.sessionId ? String(opts.sessionId) : "";

  /** @type {ReturnType<typeof createEmptyErrorMetricsState>} */
  const next = {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    entries: { ...(state?.entries || {}) },
    thresholdSessions: { ...(state?.thresholdSessions || {}) }
  };

  for (const [key, entry] of Object.entries(next.entries)) {
    if (entry && entry.scope === scope) {
      next.entries[key] = { ...entry, thresholdEmittedAt: now };
    }
  }
  const key = errorMetricKey(level, scope);
  if (next.entries[key]) {
    next.entries[key] = { ...next.entries[key], thresholdEmittedAt: now };
  }

  if (sessionId) {
    const prev = Array.isArray(next.thresholdSessions[scope])
      ? next.thresholdSessions[scope].slice()
      : [];
    if (!prev.includes(sessionId)) prev.push(sessionId);
    next.thresholdSessions[scope] = prev.slice(-ERROR_METRIC_MAX_THRESHOLD_SESSIONS);
  }

  return next;
}

/**
 * @param {{ count?: number, timestamps?: number[], thresholdEmittedAt?: number | null }} entry
 * @param {{ threshold?: number, now?: number, windowMs?: number, scopeCount?: number }} [opts]
 */
function shouldEmitThreshold(entry, opts = {}) {
  const threshold = opts.threshold ?? ERROR_METRIC_THRESHOLD;
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  const windowMs = opts.windowMs ?? ERROR_METRIC_WINDOW_MS;
  const scopeCount =
    typeof opts.scopeCount === "number"
      ? opts.scopeCount
      : Array.isArray(entry?.timestamps)
        ? pruneTimestamps(entry.timestamps, now, windowMs).length
        : Number(entry?.count) || 0;
  if (scopeCount < threshold) return false;
  const emittedAt = entry?.thresholdEmittedAt;
  if (emittedAt != null && now - Number(emittedAt) <= windowMs) return false;
  return true;
}

/**
 * Sérialise / borne le JSON métriques (comme sensitive-actions).
 * @param {ReturnType<typeof createEmptyErrorMetricsState>} state
 * @param {{ maxKeys?: number, maxFileBytes?: number, now?: number, windowMs?: number }} [limits]
 */
function trimErrorMetricsState(state, limits = {}) {
  const maxKeys = limits.maxKeys ?? ERROR_METRIC_MAX_KEYS;
  const maxFileBytes = limits.maxFileBytes ?? ERROR_METRIC_MAX_FILE_BYTES;
  const now = typeof limits.now === "number" ? limits.now : Date.now();
  const windowMs = limits.windowMs ?? ERROR_METRIC_WINDOW_MS;

  /** @type {ReturnType<typeof createEmptyErrorMetricsState>} */
  let next = {
    version: 1,
    updatedAt: state?.updatedAt || new Date(now).toISOString(),
    entries: { ...(state?.entries || {}) },
    thresholdSessions: { ...(state?.thresholdSessions || {}) }
  };

  for (const [key, entry] of Object.entries(next.entries)) {
    if (!entry) {
      delete next.entries[key];
      continue;
    }
    const timestamps = pruneTimestamps(
      Array.isArray(entry.timestamps) ? entry.timestamps : [],
      now,
      windowMs
    );
    if (!timestamps.length && (!entry.lastAt || now - Date.parse(String(entry.lastAt)) > windowMs * 4)) {
      delete next.entries[key];
      continue;
    }
    next.entries[key] = {
      ...entry,
      timestamps,
      count: timestamps.length,
      messageNorm: normalizeMetricMessage(entry.messageNorm)
    };
  }

  const keys = Object.keys(next.entries);
  if (keys.length > maxKeys) {
    keys
      .map((k) => ({ k, t: Date.parse(String(next.entries[k].lastAt || 0)) || 0 }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - maxKeys)
      .forEach(({ k }) => {
        delete next.entries[k];
      });
  }

  let json = JSON.stringify(next, null, 2);
  let bytes = Buffer.byteLength(json, "utf8");
  while (bytes > maxFileBytes && Object.keys(next.entries).length > 0) {
    const oldest = Object.keys(next.entries)
      .map((k) => ({ k, t: Date.parse(String(next.entries[k].lastAt || 0)) || 0 }))
      .sort((a, b) => a.t - b.t)[0];
    if (!oldest) break;
    delete next.entries[oldest.k];
    json = JSON.stringify(next, null, 2);
    bytes = Buffer.byteLength(json, "utf8");
  }

  while (bytes > maxFileBytes && Object.keys(next.thresholdSessions).length > 0) {
    const k = Object.keys(next.thresholdSessions)[0];
    delete next.thresholdSessions[k];
    json = JSON.stringify(next, null, 2);
    bytes = Buffer.byteLength(json, "utf8");
  }

  return { state: next, json, bytes };
}

/**
 * Sessions distinctes ayant franchi le seuil pour un scope (≥3 → ouvrir TKT-ERR).
 * @param {ReturnType<typeof createEmptyErrorMetricsState>} state
 * @param {string} scope
 */
function countThresholdSessionsForScope(state, scope) {
  const list = state?.thresholdSessions?.[scope];
  return Array.isArray(list) ? list.length : 0;
}

module.exports = {
  LEVEL_RANK,
  ALWAYS_LOG_SCOPES,
  ERROR_METRIC_WINDOW_MS,
  ERROR_METRIC_THRESHOLD,
  ERROR_METRIC_MESSAGE_MAX,
  ERROR_METRIC_MAX_KEYS,
  ERROR_METRIC_MAX_FILE_BYTES,
  isExportAuditEnabled,
  redactPathForLog,
  redactTextPreviewForLog,
  sanitizeExportAuditData,
  sanitizeData,
  shouldLogLevel,
  formatLogLine,
  normalizeMetricMessage,
  hashMetricMessage,
  createEmptyErrorMetricsState,
  errorMetricKey,
  countScopeInWindow,
  bumpErrorMetric,
  shouldEmitThreshold,
  markThresholdEmitted,
  trimErrorMetricsState,
  countThresholdSessionsForScope
};
