/**
 * Garde anti-champs interdits : **liste blanche** (ALLOWED_ENTRY_KEYS) + rejet par
 * **exception** ForbiddenSensitiveFieldError — pas de filtrage silencieux.
 */
const fs = require("node:fs");
const path = require("node:path");

const MAX_ENTRIES = 200;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PATH_FIELD_CHARS = 512;

const SENSITIVE_ACTION_TYPES = Object.freeze([
  "merge",
  "split",
  "split_groups",
  "export_annotations"
]);

const SENSITIVE_STATUSES = Object.freeze(["succeeded", "failed"]);

/** Clés autorisées sur une entrée — toute autre clé est rejetée à l'écriture. */
const ALLOWED_ENTRY_KEYS = Object.freeze([
  "ts",
  "type",
  "status",
  "inputPath",
  "outputPath",
  "jobId",
  "errorSummary",
  "inputCount"
]);

/**
 * Clés explicitement interdites (documentation + détection si valeur nested).
 * Comportement garde : **rejeter par exception** (pas de filtrage silencieux).
 */
const FORBIDDEN_FIELD_KEY =
  /password|token|secret|authorization|api[_-]?key|credential|base64|texthtml|text_html|textpreview|plain_preview|preview|pdf[_-]?content|annotations|src_base64|content/i;

class ForbiddenSensitiveFieldError extends Error {
  /**
   * @param {string} field
   */
  constructor(field) {
    super(`Champ interdit dans le journal d'actions sensibles: ${field}`);
    this.name = "ForbiddenSensitiveFieldError";
    this.field = field;
  }
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function assertSafeSensitiveEntry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Entree journal sensible invalide (objet attendu).");
  }
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_FIELD_KEY.test(key)) {
      throw new ForbiddenSensitiveFieldError(key);
    }
    if (!ALLOWED_ENTRY_KEYS.includes(key)) {
      throw new ForbiddenSensitiveFieldError(key);
    }
  }
  const type = String(raw.type || "");
  if (!SENSITIVE_ACTION_TYPES.includes(type)) {
    throw new Error(`Type d'action sensible non autorise: ${type}`);
  }
  const status = String(raw.status || "");
  if (!SENSITIVE_STATUSES.includes(status)) {
    throw new Error(`Statut journal sensible non autorise: ${status}`);
  }
  return /** @type {Record<string, unknown>} */ (raw);
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function pathField(value, fallback = "-") {
  const s = String(value ?? "").trim();
  const base = s || fallback;
  return base.length > MAX_PATH_FIELD_CHARS ? `${base.slice(0, MAX_PATH_FIELD_CHARS)}…` : base;
}

/**
 * @param {Record<string, unknown>} raw
 */
function normalizeSensitiveEntry(raw) {
  assertSafeSensitiveEntry(raw);
  /** @type {Record<string, unknown>} */
  const entry = {
    ts: String(raw.ts || new Date().toISOString()),
    type: String(raw.type),
    status: String(raw.status),
    inputPath: pathField(raw.inputPath),
    outputPath: pathField(raw.outputPath)
  };
  if (raw.jobId != null && String(raw.jobId).trim()) {
    entry.jobId = String(raw.jobId);
  }
  if (raw.errorSummary != null && String(raw.errorSummary).trim()) {
    entry.errorSummary = String(raw.errorSummary).trim().slice(0, 240);
  }
  if (raw.inputCount != null && Number.isFinite(Number(raw.inputCount))) {
    entry.inputCount = Math.max(0, Math.floor(Number(raw.inputCount)));
  }
  return entry;
}

/**
 * @param {unknown} serialized
 */
function parseStoredActions(serialized) {
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === "object");
  } catch {
    return [];
  }
}

/**
 * @param {unknown[]} entries
 * @param {{ maxEntries?: number, maxFileBytes?: number }} limits
 */
function trimEntriesFifo(entries, limits = {}) {
  const maxEntries =
    typeof limits.maxEntries === "number" && limits.maxEntries > 0
      ? limits.maxEntries
      : MAX_ENTRIES;
  const maxFileBytes =
    typeof limits.maxFileBytes === "number" && limits.maxFileBytes > 0
      ? limits.maxFileBytes
      : MAX_FILE_BYTES;

  let list = entries.slice();
  while (list.length > maxEntries) {
    list.shift();
  }
  let json = JSON.stringify(list, null, 2);
  let bytes = Buffer.byteLength(json, "utf8");
  while (bytes > maxFileBytes && list.length > 0) {
    if (list.length === 1) {
      list = [];
      break;
    }
    list.shift();
    json = JSON.stringify(list, null, 2);
    bytes = Buffer.byteLength(json, "utf8");
  }
  return list;
}

/**
 * @param {string} filePath
 * @param {string} json
 */
function atomicWriteJson(filePath, json) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, filePath);
}

/**
 * @param {{ filePath: string, maxEntries?: number, maxFileBytes?: number, fsImpl?: typeof fs }} options
 */
function createSensitiveActionsLog(options) {
  const filePath = options.filePath;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES;
  const fsImpl = options.fsImpl || fs;

  /** @type {Record<string, unknown>[]} */
  let actions = [];

  function load() {
    try {
      if (!fsImpl.existsSync(filePath)) {
        actions = [];
        return actions;
      }
      const raw = fsImpl.readFileSync(filePath, "utf8");
      actions = trimEntriesFifo(parseStoredActions(raw), { maxEntries, maxFileBytes });
    } catch {
      actions = [];
    }
    return actions;
  }

  function getActions() {
    return actions.slice();
  }

  function persist() {
    const trimmed = trimEntriesFifo(actions, { maxEntries, maxFileBytes });
    actions = trimmed;
    atomicWriteJson(filePath, `${JSON.stringify(actions, null, 2)}\n`);
  }

  /**
   * @param {Record<string, unknown>} raw
   */
  function append(raw) {
    const entry = normalizeSensitiveEntry(raw);
    actions.push(entry);
    actions = trimEntriesFifo(actions, { maxEntries, maxFileBytes });
    persist();
    return entry;
  }

  /**
   * @param {Record<string, unknown>[]} rawEntries
   */
  function appendMany(rawEntries) {
    const out = rawEntries.map((raw) => normalizeSensitiveEntry(raw));
    if (!out.length) return out;
    actions.push(...out);
    actions = trimEntriesFifo(actions, { maxEntries, maxFileBytes });
    persist();
    return out;
  }

  return {
    load,
    getActions,
    append,
    appendMany,
    persist,
    filePath
  };
}

/**
 * Entrées journal à partir d'un job terminé (merge / split / split_groups).
 * @param {{ id?: string, type?: string, status?: string, payload?: Record<string, unknown>, result?: Record<string, unknown>, error?: string | null }} job
 * @returns {Record<string, unknown>[]}
 */
function buildSensitiveEntriesFromJob(job) {
  const status = job?.status;
  if (status !== "succeeded" && status !== "failed") return [];

  const type = String(job?.type || "");
  if (!SENSITIVE_ACTION_TYPES.includes(type) || type === "export_annotations") return [];

  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  const result = job?.result && typeof job.result === "object" ? job.result : {};
  const ts = new Date().toISOString();
  const journalStatus = status === "succeeded" ? "succeeded" : "failed";
  const errorSummary =
    status === "failed" ? String(job?.error || result?.error || "Echec job").slice(0, 240) : undefined;
  const base = {
    ts,
    type,
    status: journalStatus,
    jobId: job?.id ? String(job.id) : undefined,
    errorSummary
  };

  if (type === "merge") {
    const inputs = Array.isArray(payload.inputs) ? payload.inputs : [];
    return [
      {
        ...base,
        inputPath: pathField(inputs[0]),
        outputPath: pathField(payload.output_path),
        inputCount: inputs.length || undefined
      }
    ];
  }

  if (type === "split") {
    return [
      {
        ...base,
        inputPath: pathField(payload.input_path),
        outputPath: pathField(status === "succeeded" ? result.output_path || payload.output_path : payload.output_path)
      }
    ];
  }

  if (type === "split_groups") {
    const inputPath = pathField(payload.input_path);
    if (status === "failed") {
      return [{ ...base, inputPath, outputPath: "-" }];
    }
    const outputs = Array.isArray(result.output_paths)
      ? result.output_paths.map((p) => String(p || "").trim()).filter(Boolean)
      : [];
    if (!outputs.length && Array.isArray(payload.groups)) {
      for (const g of payload.groups) {
        const op = g && typeof g === "object" ? String(g.output_path || "").trim() : "";
        if (op) outputs.push(op);
      }
    }
    if (!outputs.length) {
      return [{ ...base, inputPath, outputPath: "-" }];
    }
    return outputs.map((outputPath) => ({
      ...base,
      inputPath,
      outputPath
    }));
  }

  return [];
}

/**
 * @param {{ input_path?: string, output_path?: string }} payload
 * @param {{ ok?: boolean, error?: string, output_path?: string }} result
 */
function buildSensitiveEntryFromExport(payload, result) {
  const ok = Boolean(result?.ok);
  return {
    ts: new Date().toISOString(),
    type: "export_annotations",
    status: ok ? "succeeded" : "failed",
    inputPath: pathField(payload?.input_path),
    outputPath: pathField(ok ? result?.output_path || payload?.output_path : payload?.output_path),
    errorSummary: ok ? undefined : String(result?.error || "Export echoue").slice(0, 240)
  };
}

module.exports = {
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  SENSITIVE_ACTION_TYPES,
  SENSITIVE_STATUSES,
  ALLOWED_ENTRY_KEYS,
  FORBIDDEN_FIELD_KEY,
  ForbiddenSensitiveFieldError,
  assertSafeSensitiveEntry,
  normalizeSensitiveEntry,
  trimEntriesFifo,
  createSensitiveActionsLog,
  buildSensitiveEntriesFromJob,
  buildSensitiveEntryFromExport
};
