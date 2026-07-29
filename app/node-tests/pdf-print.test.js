const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  PRINT_TEMP_SUBDIR,
  PRINT_TEMP_FILE_PREFIX,
  PRINT_WEB_PREFERENCES,
  getPrintTempDir,
  createPrintTempPath,
  registerPrintTemp,
  listPendingPrintTemps,
  safeUnlinkPrintTemp,
  unlinkAllPendingPrintTemps,
  sweepOrphanPrintTemps,
  resetPendingPrintTempsForTests,
  toPrintError,
  printBakedPdf
} = require("../src/main/lib/pdf-print.js");

/** @type {string} */
let testTmpRoot;

beforeEach(() => {
  resetPendingPrintTempsForTests();
  testTmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-pdf-print-test-"));
});

afterEach(() => {
  resetPendingPrintTempsForTests();
  try {
    fs.rmSync(testTmpRoot, { recursive: true, force: true });
  } catch {
    /* intentional: cleanup test root best-effort */
  }
});

test("isPathInsidePrintTempDir : accepte editradoc-print, refuse ailleurs", () => {
  const { isPathInsidePrintTempDir } = require("../src/main/lib/pdf-print.js");
  const dir = getPrintTempDir(testTmpRoot);
  const okPath = path.join(dir, "print-1.pdf");
  assert.equal(isPathInsidePrintTempDir(okPath, { tmpdir: testTmpRoot }), true);
  assert.equal(
    isPathInsidePrintTempDir(path.join(testTmpRoot, "other", "x.pdf"), { tmpdir: testTmpRoot }),
    false
  );
  assert.equal(isPathInsidePrintTempDir(testTmpRoot, { tmpdir: testTmpRoot }), false);
});

test("PRINT_WEB_PREFERENCES : sandbox true + isolation (ADR-006/008)", () => {
  assert.equal(PRINT_WEB_PREFERENCES.sandbox, true);
  assert.equal(PRINT_WEB_PREFERENCES.contextIsolation, true);
  assert.equal(PRINT_WEB_PREFERENCES.nodeIntegration, false);
});

test("getPrintTempDir : sous os.tmpdir, pas userData", () => {
  const dir = getPrintTempDir(testTmpRoot);
  assert.equal(dir, path.join(testTmpRoot, PRINT_TEMP_SUBDIR));
  assert.ok(!dir.toLowerCase().includes("userdata"));
});

test("createPrintTempPath : registre + préfixe + dossier dédié", () => {
  const p = createPrintTempPath({
    tmpdir: testTmpRoot,
    pid: 4242,
    uuid: () => "uuid-test"
  });
  assert.ok(p.startsWith(path.join(testTmpRoot, PRINT_TEMP_SUBDIR)));
  assert.ok(path.basename(p).startsWith(PRINT_TEMP_FILE_PREFIX));
  assert.match(path.basename(p), /^print-4242-uuid-test\.pdf$/);
  assert.ok(fs.existsSync(path.dirname(p)));
  assert.deepEqual(listPendingPrintTemps(), [path.resolve(p)]);
});

test("safeUnlinkPrintTemp : succès retire du registre", () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "print-1-a.pdf");
  fs.writeFileSync(file, "%PDF-1.4");
  registerPrintTemp(file);
  const r = safeUnlinkPrintTemp(file);
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(file), false);
  assert.deepEqual(listPendingPrintTemps(), []);
});

test("safeUnlinkPrintTemp : ENOENT = ok (idempotent)", () => {
  const missing = path.join(testTmpRoot, "print-missing.pdf");
  registerPrintTemp(missing);
  const r = safeUnlinkPrintTemp(missing);
  assert.equal(r.ok, true);
  assert.deepEqual(listPendingPrintTemps(), []);
});

test("safeUnlinkPrintTemp : autre erreur = ok false, reste enregistré", () => {
  const file = path.join(testTmpRoot, "print-locked.pdf");
  registerPrintTemp(file);
  const r = safeUnlinkPrintTemp(file, {
    unlinkSync: () => {
      const err = new Error("EPERM");
      err.code = "EPERM";
      throw err;
    }
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /EPERM/);
  assert.deepEqual(listPendingPrintTemps(), [path.resolve(file)]);
});

test("unlinkAllPendingPrintTemps : quit pendant dialogue ouvert", () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const a = path.join(dir, "print-1.pdf");
  const b = path.join(dir, "print-2.pdf");
  fs.writeFileSync(a, "a");
  fs.writeFileSync(b, "b");
  registerPrintTemp(a);
  registerPrintTemp(b);
  const r = unlinkAllPendingPrintTemps();
  assert.equal(r.removed.length, 2);
  assert.equal(r.failed.length, 0);
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.existsSync(b), false);
  assert.deepEqual(listPendingPrintTemps(), []);
});

test("sweepOrphanPrintTemps : purge orphelins vieux (maxAgeMs — filet secondaire)", () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const oldFile = path.join(dir, "print-old.pdf");
  const youngFile = path.join(dir, "print-young.pdf");
  const other = path.join(dir, "notes.txt");
  fs.writeFileSync(oldFile, "old");
  fs.writeFileSync(youngFile, "young");
  fs.writeFileSync(other, "keep");

  const now = Date.now();
  const r = sweepOrphanPrintTemps({
    tmpdir: testTmpRoot,
    maxAgeMs: 60_000,
    now,
    statSync: (p) => {
      if (p === oldFile) return { mtimeMs: now - 120_000 };
      if (p === youngFile) return { mtimeMs: now - 10_000 };
      return fs.statSync(p);
    }
  });

  assert.equal(r.scanned, 2);
  assert.deepEqual(r.removed, [oldFile]);
  assert.deepEqual(r.skipped, [youngFile]);
  assert.equal(fs.existsSync(oldFile), false);
  assert.equal(fs.existsSync(youngFile), true);
  assert.equal(fs.existsSync(other), true);
});

// Miroir exact du boot app (main.js whenReady → sweepOrphanPrintTemps({ forceAll: true })).
// Couvre le scénario spike orphan-sweep : print-*.pdf survivant à un crash → purgés au prochain démarrage.
test("sweepOrphanPrintTemps : forceAll = nettoyage boot après crash (print-*.pdf orphelins)", () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const a = path.join(dir, "print-a.pdf");
  const b = path.join(dir, "print-b.pdf");
  const keep = path.join(dir, "notes.txt");
  fs.writeFileSync(a, "a");
  fs.writeFileSync(b, "b");
  fs.writeFileSync(keep, "keep");
  const r = sweepOrphanPrintTemps({
    tmpdir: testTmpRoot,
    forceAll: true,
    maxAgeMs: 999_999_999,
    now: Date.now()
  });
  assert.equal(r.scanned, 2);
  assert.equal(r.removed.length, 2);
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.existsSync(b), false);
  assert.equal(fs.existsSync(keep), true, "fichiers hors préfixe print- non touchés");
});

test("toPrintError : sandbox / timeout / générique", () => {
  assert.match(toPrintError(new Error("PRINT_SANDBOX_REQUIRED")).error, /sandbox: true/);
  assert.match(toPrintError(new Error("PRINT_LOAD_TIMEOUT")).error, /chargement/);
  assert.equal(toPrintError(new Error("boom")).error, "Échec impression PDF.");
});

/**
 * Mock BrowserWindow minimal pour tester cleanup sans Electron GUI.
 * @param {{ sandbox?: boolean, printImpl?: Function }} cfg
 */
function makeMockBrowserWindow(cfg = {}) {
  const sandbox = cfg.sandbox !== false;
  function defaultPrint(_opts, cb) {
    setImmediate(() => cb(true, ""));
  }
  const printImpl = cfg.printImpl || defaultPrint;

  class MockWindow {
    constructor(opts) {
      this.opts = opts;
      this._destroyed = false;
      this.webContents = {
        getLastWebPreferences: () => ({
          sandbox,
          contextIsolation: true,
          nodeIntegration: false
        }),
        print: printImpl
      };
      this._closedHandlers = [];
    }
    once(ev, fn) {
      if (ev === "closed") this._closedHandlers.push(fn);
    }
    loadURL() {
      return Promise.resolve();
    }
    isDestroyed() {
      return this._destroyed;
    }
    destroy() {
      this._destroyed = true;
      for (const h of this._closedHandlers) h();
    }
  }
  return MockWindow;
}

test("printBakedPdf : succès → tempRemoved (cleanup après impression)", async () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, "print-ok.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4");

  const r = await printBakedPdf(pdf, {
    BrowserWindow: makeMockBrowserWindow({ sandbox: true }),
    settleMs: 0,
    callbackTimeoutMs: 2000,
    pathToFileURL: (p) => `file://${p.replace(/\\/g, "/")}`
  });

  assert.equal(r.ok, true);
  assert.equal(r.printed, true);
  assert.equal(r.sandbox, true);
  assert.equal(r.tempRemoved, true);
  assert.equal(fs.existsSync(pdf), false);
  assert.deepEqual(listPendingPrintTemps(), []);
});

test("printBakedPdf : annulation dialogue → cleanup quand même", async () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, "print-cancel.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4");

  const r = await printBakedPdf(pdf, {
    BrowserWindow: makeMockBrowserWindow({
      sandbox: true,
      printImpl: (_opts, cb) => {
        setImmediate(() => cb(false, "cancelled"));
      }
    }),
    settleMs: 0,
    callbackTimeoutMs: 2000,
    pathToFileURL: (p) => `file://${p.replace(/\\/g, "/")}`
  });

  assert.equal(r.ok, true);
  assert.equal(r.printed, false);
  assert.equal(r.canceledOrFailed, true);
  assert.equal(r.tempRemoved, true);
  assert.equal(fs.existsSync(pdf), false);
});

test("printBakedPdf : throw print → cleanup (échec)", async () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, "print-throw.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4");

  const r = await printBakedPdf(pdf, {
    BrowserWindow: makeMockBrowserWindow({
      sandbox: true,
      printImpl: () => {
        throw new Error("print exploded");
      }
    }),
    settleMs: 0,
    callbackTimeoutMs: 2000,
    pathToFileURL: (p) => `file://${p.replace(/\\/g, "/")}`
  });

  assert.equal(r.tempRemoved, true);
  assert.equal(fs.existsSync(pdf), false);
});

test("printBakedPdf : timeout callback → cleanup", async () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, "print-timeout.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4");

  const r = await printBakedPdf(pdf, {
    BrowserWindow: makeMockBrowserWindow({
      sandbox: true,
      printImpl: () => {}
    }),
    settleMs: 0,
    callbackTimeoutMs: 50,
    pathToFileURL: (p) => `file://${p.replace(/\\/g, "/")}`
  });

  assert.equal(r.canceledOrFailed, true);
  assert.match(String(r.error), /PRINT_CALLBACK_TIMEOUT/);
  assert.equal(r.tempRemoved, true);
  assert.equal(fs.existsSync(pdf), false);
});

test("printBakedPdf : refuse sandbox false (pas de contournement ADR-006)", async () => {
  const dir = path.join(testTmpRoot, PRINT_TEMP_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, "print-nosandbox.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4");

  const r = await printBakedPdf(pdf, {
    BrowserWindow: makeMockBrowserWindow({ sandbox: false }),
    settleMs: 0,
    pathToFileURL: (p) => `file://${p.replace(/\\/g, "/")}`
  });

  assert.equal(r.ok, false);
  assert.match(String(r.error), /sandbox: true/);
  assert.equal(r.tempRemoved, true);
  assert.equal(fs.existsSync(pdf), false);
});

test("printBakedPdf : PDF manquant", async () => {
  const missing = path.join(testTmpRoot, "nope.pdf");
  const r = await printBakedPdf(missing, {
    BrowserWindow: makeMockBrowserWindow(),
    settleMs: 0
  });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /introuvable/);
});
