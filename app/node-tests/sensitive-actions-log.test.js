const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  ForbiddenSensitiveFieldError,
  createSensitiveActionsLog,
  buildSensitiveEntriesFromJob,
  buildSensitiveEntryFromExport,
  trimEntriesFifo
} = require("../src/main/lib/sensitive-actions-log");

/** Miroir renderer-jobs.js sensitiveKey — contrat UI sensitive:list */
function sensitiveKey(a) {
  if (!a || typeof a !== "object") return "";
  return `${a.ts}|${a.type}|${a.status}|${a.inputPath}|${a.outputPath}`;
}

function tempLogPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-sensitive-")), "sensitive-actions.json");
}

test("garde : champ interdit (password) leve ForbiddenSensitiveFieldError", () => {
  const log = createSensitiveActionsLog({ filePath: tempLogPath() });
  assert.throws(
    () =>
      log.append({
        ts: new Date().toISOString(),
        type: "merge",
        status: "succeeded",
        inputPath: "/a/in.pdf",
        outputPath: "/a/out.pdf",
        password: "secret"
      }),
    ForbiddenSensitiveFieldError
  );
});

test("garde : champ interdit (textHtml) leve ForbiddenSensitiveFieldError", () => {
  const log = createSensitiveActionsLog({ filePath: tempLogPath() });
  assert.throws(
    () =>
      log.append({
        ts: new Date().toISOString(),
        type: "export_annotations",
        status: "failed",
        inputPath: "/a/in.pdf",
        outputPath: "-",
        textHtml: "<b>x</b>"
      }),
    (err) => err instanceof ForbiddenSensitiveFieldError && /textHtml/i.test(err.field)
  );
});

test("garde : cle non autorisee (annotations_by_page) leve ForbiddenSensitiveFieldError", () => {
  const log = createSensitiveActionsLog({ filePath: tempLogPath() });
  assert.throws(
    () =>
      log.append({
        ts: new Date().toISOString(),
        type: "export_annotations",
        status: "succeeded",
        inputPath: "/a/in.pdf",
        outputPath: "/a/out.pdf",
        annotations_by_page: { "1": [] }
      }),
    ForbiddenSensitiveFieldError
  );
});

test("ecriture merge : entree lisible via sensitive:list / refreshSensitiveActions", () => {
  const filePath = tempLogPath();
  const log = createSensitiveActionsLog({ filePath });
  const entry = log.append({
    ts: "2026-07-11T00:00:00.000Z",
    type: "merge",
    status: "succeeded",
    inputPath: "C:\\docs\\a.pdf",
    outputPath: "C:\\docs\\merged.pdf",
    jobId: "job-1",
    inputCount: 3
  });

  const reloaded = createSensitiveActionsLog({ filePath });
  reloaded.load();
  const actions = reloaded.getActions();
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], entry);
  assert.ok(sensitiveKey(actions[0]).includes("merge"));
  assert.ok(sensitiveKey(actions[0]).includes("succeeded"));
});

test("buildSensitiveEntriesFromJob : split_groups succes — une entree par sortie", () => {
  const entries = buildSensitiveEntriesFromJob({
    id: "job-sg",
    type: "split_groups",
    status: "succeeded",
    payload: {
      input_path: "/tmp/src.pdf",
      groups: [{ output_path: "/tmp/a.pdf" }, { output_path: "/tmp/b.pdf" }]
    },
    result: { ok: true, output_paths: ["/tmp/a.pdf", "/tmp/b.pdf"] }
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, "split_groups");
  assert.equal(entries[0].outputPath, "/tmp/a.pdf");
  assert.equal(entries[1].outputPath, "/tmp/b.pdf");
  assert.equal(entries[0].jobId, "job-sg");
});

test("buildSensitiveEntryFromExport : export_annotations echoue", () => {
  const entry = buildSensitiveEntryFromExport(
    { input_path: "/in.pdf", output_path: "/out.pdf" },
    { ok: false, error: "Python down" }
  );
  assert.equal(entry.type, "export_annotations");
  assert.equal(entry.status, "failed");
  assert.match(String(entry.errorSummary), /Python/);
});

test("plafond FIFO : 200 entrees max", () => {
  const filePath = tempLogPath();
  const log = createSensitiveActionsLog({ filePath, maxEntries: 5, maxFileBytes: MAX_FILE_BYTES });
  for (let i = 0; i < 8; i += 1) {
    log.append({
      ts: `2026-07-11T00:00:0${i}.000Z`,
      type: "split",
      status: "succeeded",
      inputPath: `/in-${i}.pdf`,
      outputPath: `/out-${i}.pdf`
    });
  }
  const actions = log.getActions();
  assert.equal(actions.length, 5);
  assert.equal(actions[0].inputPath, "/in-3.pdf");
  assert.equal(actions[4].inputPath, "/in-7.pdf");
});

test("plafond FIFO : taille fichier max declenche troncature", () => {
  const entries = [];
  for (let i = 0; i < 30; i += 1) {
    entries.push({
      ts: `2026-07-11T00:00:${String(i).padStart(2, "0")}.000Z`,
      type: "merge",
      status: "succeeded",
      inputPath: `/in/${i}.pdf`,
      outputPath: `/out/${i}.pdf`
    });
  }
  const trimmed = trimEntriesFifo(entries, { maxEntries: MAX_ENTRIES, maxFileBytes: 900 });
  assert.ok(trimmed.length < entries.length);
  assert.ok(Buffer.byteLength(JSON.stringify(trimmed), "utf8") <= 900);
});

test("refreshSensitiveActions : nouvelle entree detectee par sensitiveKey", () => {
  const seen = new Set();
  const log = createSensitiveActionsLog({ filePath: tempLogPath() });
  log.append({
    ts: "2026-07-11T12:00:00.000Z",
    type: "export_annotations",
    status: "succeeded",
    inputPath: "/a/src.pdf",
    outputPath: "/a/export.pdf"
  });

  const messages = [];
  for (const a of log.getActions()) {
    const k = sensitiveKey(a);
    if (!seen.has(k)) {
      seen.add(k);
      messages.push({
        category: "sensitive",
        type: a.type,
        status: a.status,
        path: `${a.inputPath || "-"} → ${a.outputPath || "-"}`
      });
    }
  }
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "export_annotations");
  assert.match(messages[0].path, /src\.pdf.*export\.pdf/);
});

test("types d'action : merge split split_groups export_annotations", () => {
  const filePath = tempLogPath();
  const log = createSensitiveActionsLog({ filePath });
  const types = [
    ["merge", { inputPath: "/a.pdf", outputPath: "/m.pdf", inputCount: 2 }],
    ["split", { inputPath: "/a.pdf", outputPath: "/s.pdf" }],
    ["split_groups", { inputPath: "/a.pdf", outputPath: "/g1.pdf" }],
    ["export_annotations", { inputPath: "/a.pdf", outputPath: "/e.pdf" }]
  ];
  for (const [type, paths] of types) {
    log.append({
      ts: new Date().toISOString(),
      type,
      status: "succeeded",
      ...paths
    });
  }
  assert.equal(log.getActions().length, 4);
  assert.deepEqual(
    log.getActions().map((a) => a.type),
    types.map((t) => t[0])
  );
});
