const { test, after } = require("node:test");
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
  trimEntriesFifo,
  assertSafeSensitiveEntry,
  normalizeSensitiveEntry
} = require("../src/main/lib/sensitive-actions-log");

/** Miroir renderer-jobs.js sensitiveKey — contrat UI sensitive:list */
function sensitiveKey(a) {
  if (!a || typeof a !== "object") return "";
  return `${a.ts}|${a.type}|${a.status}|${a.inputPath}|${a.outputPath}`;
}

/** @type {string[]} */
const tmpDirs = [];

function tempLogPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-sensitive-"));
  tmpDirs.push(dir);
  return path.join(dir, "sensitive-actions.json");
}

after(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* intentional: tmp cleanup best-effort */
    }
  }
});

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
        annotations_by_page: { 1: [] }
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

/* ——— Lot E : buildSensitiveEntriesFromJob / export / limites ——— */

test("buildSensitiveEntriesFromJob : status hors succeeded/failed → []", () => {
  assert.deepEqual(
    buildSensitiveEntriesFromJob({ type: "merge", status: "running", payload: {} }),
    []
  );
  assert.deepEqual(buildSensitiveEntriesFromJob({ type: "merge", status: "queued" }), []);
  assert.deepEqual(buildSensitiveEntriesFromJob({ type: "merge" }), []);
});

test("buildSensitiveEntriesFromJob : export_annotations filtré → []", () => {
  assert.deepEqual(
    buildSensitiveEntriesFromJob({
      type: "export_annotations",
      status: "succeeded",
      payload: { input_path: "/a.pdf", output_path: "/b.pdf" },
      result: { ok: true }
    }),
    []
  );
});

test("buildSensitiveEntriesFromJob : type inconnu → []", () => {
  assert.deepEqual(
    buildSensitiveEntriesFromJob({ type: "rotate", status: "succeeded", payload: {} }),
    []
  );
});

test("buildSensitiveEntriesFromJob : merge succès + échec", () => {
  const ok = buildSensitiveEntriesFromJob({
    id: "m1",
    type: "merge",
    status: "succeeded",
    payload: { inputs: ["/a.pdf", "/b.pdf"], output_path: "/out.pdf" },
    result: { ok: true }
  });
  assert.equal(ok.length, 1);
  assert.equal(ok[0].type, "merge");
  assert.equal(ok[0].status, "succeeded");
  assert.equal(ok[0].inputPath, "/a.pdf");
  assert.equal(ok[0].outputPath, "/out.pdf");
  assert.equal(ok[0].inputCount, 2);
  assert.equal(ok[0].jobId, "m1");
  assert.equal(ok[0].errorSummary, undefined);

  const fail = buildSensitiveEntriesFromJob({
    type: "merge",
    status: "failed",
    payload: { inputs: ["/a.pdf"], output_path: "/out.pdf" },
    error: "merge boom"
  });
  assert.equal(fail.length, 1);
  assert.equal(fail[0].status, "failed");
  assert.equal(fail[0].errorSummary, "merge boom");
  assert.equal(fail[0].inputCount, 1);
});

test("buildSensitiveEntriesFromJob : split succès (result.output_path) + échec", () => {
  const ok = buildSensitiveEntriesFromJob({
    type: "split",
    status: "succeeded",
    payload: { input_path: "/in.pdf", output_path: "/fallback.pdf" },
    result: { output_path: "/from-result.pdf" }
  });
  assert.equal(ok.length, 1);
  assert.equal(ok[0].inputPath, "/in.pdf");
  assert.equal(ok[0].outputPath, "/from-result.pdf");

  const okPayloadOnly = buildSensitiveEntriesFromJob({
    type: "split",
    status: "succeeded",
    payload: { input_path: "/in.pdf", output_path: "/payload-out.pdf" },
    result: {}
  });
  assert.equal(okPayloadOnly[0].outputPath, "/payload-out.pdf");

  const fail = buildSensitiveEntriesFromJob({
    type: "split",
    status: "failed",
    payload: { input_path: "/in.pdf", output_path: "/out.pdf" },
    result: { error: "split fail" }
  });
  assert.equal(fail[0].status, "failed");
  assert.equal(fail[0].outputPath, "/out.pdf");
  assert.equal(fail[0].errorSummary, "split fail");
});

test("buildSensitiveEntriesFromJob : split_groups failed", () => {
  const entries = buildSensitiveEntriesFromJob({
    type: "split_groups",
    status: "failed",
    payload: { input_path: "/src.pdf" },
    error: "groups down"
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].inputPath, "/src.pdf");
  assert.equal(entries[0].outputPath, "-");
  assert.equal(entries[0].errorSummary, "groups down");
});

test("buildSensitiveEntriesFromJob : fallback groups sans output_paths", () => {
  const entries = buildSensitiveEntriesFromJob({
    type: "split_groups",
    status: "succeeded",
    payload: {
      input_path: "/src.pdf",
      groups: [
        { output_path: "/g1.pdf" },
        { output_path: "  " },
        "skip",
        { output_path: "/g2.pdf" }
      ]
    },
    result: { ok: true }
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].outputPath, "/g1.pdf");
  assert.equal(entries[1].outputPath, "/g2.pdf");
});

test("buildSensitiveEntriesFromJob : outputs vides → une entrée outputPath '-'", () => {
  const entries = buildSensitiveEntriesFromJob({
    type: "split_groups",
    status: "succeeded",
    payload: { input_path: "/src.pdf", groups: [] },
    result: { output_paths: [] }
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outputPath, "-");
  assert.equal(entries[0].inputPath, "/src.pdf");
});

test("buildSensitiveEntriesFromJob : échec sans message → 'Echec job'", () => {
  const entries = buildSensitiveEntriesFromJob({
    type: "merge",
    status: "failed",
    payload: { inputs: [], output_path: "/o.pdf" }
  });
  assert.equal(entries[0].errorSummary, "Echec job");
  assert.equal(entries[0].inputPath, "-");
  assert.equal(entries[0].inputCount, undefined);
});

test("buildSensitiveEntryFromExport : succès + fallbacks output_path", () => {
  const fromResult = buildSensitiveEntryFromExport(
    { input_path: "/in.pdf", output_path: "/payload.pdf" },
    { ok: true, output_path: "/result.pdf" }
  );
  assert.equal(fromResult.status, "succeeded");
  assert.equal(fromResult.outputPath, "/result.pdf");
  assert.equal(fromResult.errorSummary, undefined);

  const fromPayload = buildSensitiveEntryFromExport(
    { input_path: "/in.pdf", output_path: "/payload.pdf" },
    { ok: true }
  );
  assert.equal(fromPayload.outputPath, "/payload.pdf");
});

test("buildSensitiveEntryFromExport : échec sans error → 'Export echoue'", () => {
  const entry = buildSensitiveEntryFromExport(
    { input_path: "/in.pdf", output_path: "/out.pdf" },
    {
      ok: false
    }
  );
  assert.equal(entry.status, "failed");
  assert.equal(entry.outputPath, "/out.pdf");
  assert.equal(entry.errorSummary, "Export echoue");
});

test("assertSafeSensitiveEntry : objet invalide / type / statut", () => {
  assert.throws(() => assertSafeSensitiveEntry(null), /invalide/i);
  assert.throws(() => assertSafeSensitiveEntry([]), /invalide/i);
  assert.throws(
    () =>
      assertSafeSensitiveEntry({
        type: "unknown",
        status: "succeeded",
        inputPath: "/a",
        outputPath: "/b"
      }),
    /Type d'action/
  );
  assert.throws(
    () =>
      assertSafeSensitiveEntry({
        type: "merge",
        status: "pending",
        inputPath: "/a",
        outputPath: "/b"
      }),
    /Statut/
  );
});

test("normalizeSensitiveEntry : pathField vide + troncature longue", () => {
  const long = `/${"x".repeat(600)}.pdf`;
  const entry = normalizeSensitiveEntry({
    type: "split",
    status: "succeeded",
    inputPath: "   ",
    outputPath: long,
    errorSummary: "  "
  });
  assert.equal(entry.inputPath, "-");
  assert.ok(String(entry.outputPath).endsWith("…"));
  assert.ok(String(entry.outputPath).length <= 513);
  assert.equal(entry.errorSummary, undefined);
});

test("load : JSON corrompu / non-array → liste vide", () => {
  const filePath = tempLogPath();
  fs.writeFileSync(filePath, "{not-json", "utf8");
  const log = createSensitiveActionsLog({ filePath });
  assert.deepEqual(log.load(), []);

  fs.writeFileSync(filePath, JSON.stringify({ not: "array" }), "utf8");
  assert.deepEqual(log.load(), []);
});

test("load : fichier absent + fsImpl read throw → []", () => {
  const missing = path.join(os.tmpdir(), `editradoc-no-such-${Date.now()}.json`);
  const log = createSensitiveActionsLog({ filePath: missing });
  assert.deepEqual(log.load(), []);

  const boom = createSensitiveActionsLog({
    filePath: tempLogPath(),
    fsImpl: {
      existsSync: () => true,
      readFileSync: () => {
        throw new Error("EACCES mock");
      }
    }
  });
  assert.deepEqual(boom.load(), []);
});

test("trimEntriesFifo : une seule entrée trop grosse → liste vide", () => {
  const huge = {
    ts: "2026-07-11T00:00:00.000Z",
    type: "merge",
    status: "succeeded",
    inputPath: `/${"a".repeat(400)}.pdf`,
    outputPath: `/${"b".repeat(400)}.pdf`
  };
  const trimmed = trimEntriesFifo([huge], { maxEntries: 10, maxFileBytes: 80 });
  assert.deepEqual(trimmed, []);
});

test("trimEntriesFifo : limites absentes → plafonds MAX_*", () => {
  const trimmed = trimEntriesFifo(
    Array.from({ length: 3 }, (_, i) => ({
      ts: `2026-07-11T00:00:0${i}.000Z`,
      type: "split",
      status: "succeeded",
      inputPath: `/in-${i}.pdf`,
      outputPath: `/out-${i}.pdf`
    })),
    {}
  );
  assert.equal(trimmed.length, 3);
});
