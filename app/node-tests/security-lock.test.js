/**
 * VERROUILLÉ — Suite de verrouillage des invariants de sécurité (docs/90-Audit.md §0.1).
 * Un test par invariant : échec explicite si le comportement validé change.
 *
 * Toute modification (même cosmétique) : message dédié AVANT le diff avec en-tête
 * « JE MODIFIE LA SUITE DE VERROUS DE SÉCURITÉ » — commit isolé, jamais bundlé.
 * Voir .cursor/rules/security-invariants.mdc
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { isExportAuditEnabled, shouldLogLevel } = require("../src/lib/app-log-core");
const { isOutputPdfInSameDirectoryAsInput } = require("../src/main/lib/path-guard");
const {
  validatePdfReadBytesRequest,
  ERROR_CODES
} = require("../src/main/lib/pdf-read-bytes-guard");
const {
  validatePdfWithPython,
  ERROR_CODES: VALIDATION_ERROR_CODES,
  VALIDATION_MESSAGES,
  MAX_VALIDATION_ATTEMPTS
} = require("../src/main/lib/python-validation");
const { evaluatePdfOpen } = require("../src/main/lib/pdf-open");
const openPdfRegistry = require("../src/main/lib/open-pdf-registry");

const APP_ROOT = path.join(__dirname, "..");
const PY_DIR = path.join(APP_ROOT, "python");
const INDEX_HTML = path.join(APP_ROOT, "src", "renderer", "index.html");
const MAIN_JS = path.join(APP_ROOT, "src", "main", "main.js");
const PRELOAD_JS = path.join(APP_ROOT, "src", "main", "preload.js");

/** Routes POST actives (miroir pdf_service.py do_POST, legacy exclues). */
const ACTIVE_POST_ROUTES = Object.freeze([
  ["/validate", { path: "/tmp/invariant-x.pdf" }],
  ["/merge", { inputs: ["/tmp/a.pdf"], output_path: "/tmp/out.pdf" }],
  ["/split", { input_path: "/tmp/a.pdf", from_page: 1, to_page: 1, output_path: "/tmp/out.pdf" }],
  ["/split-groups", { input_path: "/tmp/a.pdf", groups: [] }],
  [
    "/apply-annotations",
    {
      input_path: "/tmp/a.pdf",
      output_path: "/tmp/out.pdf",
      canvases_px_by_page: {},
      annotations_by_page: {}
    }
  ],
  ["/images-to-pdf", { input_paths: ["/tmp/x.png"], output_path: "/tmp/out.pdf" }]
]);

function resolvePythonExecutable() {
  const bundled = path.join(APP_ROOT, "bundle-python", "win", "python.exe");
  if (process.platform === "win32" && fs.existsSync(bundled)) return bundled;
  return "python3";
}

/**
 * @param {string} script
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
function runPython(script) {
  const py = resolvePythonExecutable();
  const res = spawnSync(py, ["-c", script], {
    encoding: "utf8",
    cwd: APP_ROOT,
    env: { ...process.env, PYTHONPATH: PY_DIR }
  });
  return {
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || ""
  };
}

function extractCspConnectSrc(html) {
  const m = html.match(/http-equiv=["']Content-Security-Policy["'][\s\S]*?content="([^"]*)"/i);
  assert.ok(m, "meta Content-Security-Policy introuvable dans index.html");
  const policy = m[1];
  const connectMatch = policy.match(/connect-src\s+([^;]+)/i);
  assert.ok(connectMatch, "directive connect-src absente de la CSP");
  return connectMatch[1].trim();
}

function networkErrorRequest() {
  return {
    on(event, handler) {
      if (event === "error") {
        setImmediate(() => handler(new Error("ECONNREFUSED")));
      }
    },
    write() {},
    end() {},
    destroy() {}
  };
}

// --- S19 : audit export opt-in strict ---

test("INVARIANT S19 : EDITRADOC_EXPORT_AUDIT absent — isExportAuditEnabled false", () => {
  assert.equal(isExportAuditEnabled({}), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: undefined }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "" }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "0" }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "1" }), true);
});

test("INVARIANT S19 : EDITRADOC_EXPORT_AUDIT absent — aucune ecriture audit Python", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-invariant-s19-"));
  const logPath = path.join(tmp, "audit-lock.log");
  const script = `
import os, sys
sys.path.insert(0, ${JSON.stringify(PY_DIR)})
os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
os.environ["EDITRADOC_LOG_PATH"] = ${JSON.stringify(logPath)}
from pdf_ops import _export_audit_log
_export_audit_log("invariant_must_not_write", {"page": 1})
`;
  const res = runPython(script);
  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.equal(fs.existsSync(logPath), false, "fichier audit cree sans EDITRADOC_EXPORT_AUDIT=1");
});

test("INVARIANT S19 : scope export-audit exige verbose (pas de contournement)", () => {
  assert.equal(shouldLogLevel("info", false, "export-audit"), false);
  assert.equal(shouldLogLevel("debug", false, "python:export-audit"), false);
});

// --- S2 : token POST service Python ---

test("INVARIANT S2 : POST sans token — 401 sur toutes les routes actives", () => {
  const routesJson = JSON.stringify(ACTIVE_POST_ROUTES);
  const script = `
import json, os, sys, threading
from http.client import HTTPConnection
from http.server import HTTPServer
sys.path.insert(0, ${JSON.stringify(PY_DIR)})
os.environ["MANI_PDF_SERVICE_TOKEN"] = "invariant-lock-token"
from pdf_service import Handler

routes = json.loads(${JSON.stringify(routesJson)})
server = HTTPServer(("127.0.0.1", 0), Handler)
host, port = server.server_address
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    for route, payload in routes:
        conn = HTTPConnection(host, port, timeout=5)
        conn.request("POST", route, body=json.dumps(payload), headers={"Content-Type": "application/json"})
        resp = conn.getresponse()
        body = resp.read().decode("utf8")
        conn.close()
        if resp.status not in (401, 403):
            print(f"INVARIANT S2 FAIL route={route} status={resp.status} body={body[:200]}")
            sys.exit(2)
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
`;
  const res = runPython(script);
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("INVARIANT S2 : GET /health reste accessible sans token", () => {
  const script = `
import os, sys, threading
from http.client import HTTPConnection
from http.server import HTTPServer
sys.path.insert(0, ${JSON.stringify(PY_DIR)})
os.environ["MANI_PDF_SERVICE_TOKEN"] = "invariant-lock-token"
from pdf_service import Handler

server = HTTPServer(("127.0.0.1", 0), Handler)
host, port = server.server_address
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    conn = HTTPConnection(host, port, timeout=5)
    conn.request("GET", "/health")
    resp = conn.getresponse()
    conn.close()
    if resp.status != 200:
        print(f"health status={resp.status}")
        sys.exit(3)
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
`;
  const res = runPython(script);
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

// --- S6 : pdf:read-bytes ---

test("INVARIANT S6 : pdf:read-bytes — chemin hors whitelist onglets ouverts → rejet", () => {
  const result = validatePdfReadBytesRequest("C:\\docs\\secret.pdf", {
    exists: true,
    fileSize: 4096,
    isOpenPath: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.PDF_READ_NOT_OPEN);
});

test("INVARIANT S6 : pdf:sync-open-paths absent — injection whitelist impossible", () => {
  assert.equal(openPdfRegistry.syncOpenPdfPaths, undefined);
  const mainSrc = fs.readFileSync(MAIN_JS, "utf8");
  const preloadSrc = fs.readFileSync(PRELOAD_JS, "utf8");
  assert.equal(mainSrc.includes('ipcMain.handle("pdf:sync-open-paths"'), false);
  assert.equal(preloadSrc.includes("syncOpenPdfPaths"), false);
  assert.equal(preloadSrc.includes("pdf:sync-open-paths"), false);

  openPdfRegistry.resetOpenPdfPathsForTests();
  const injected = path.join(os.tmpdir(), "invariant-s6-injected.pdf");
  assert.equal(openPdfRegistry.isOpenPdfPath(injected), false);
  const blocked = validatePdfReadBytesRequest(injected, {
    exists: true,
    fileSize: 4096,
    isOpenPath: openPdfRegistry.isOpenPdfPath(injected)
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, ERROR_CODES.PDF_READ_NOT_OPEN);
});

test("INVARIANT S6 : pdf:register-open-path — chemin jamais ouvert via pdf:open → refus", () => {
  const {
    evaluateRegisterOpenPathIpcRequest,
    ERROR_CODES: REG_CODES
  } = require("../src/main/lib/pdf-register-open-path-guard");
  const mainSrc = fs.readFileSync(MAIN_JS, "utf8");
  const preloadSrc = fs.readFileSync(PRELOAD_JS, "utf8");
  assert.equal(
    mainSrc.includes('ipcMain.handle("pdf:register-open-path"'),
    false,
    "IPC pdf:register-open-path ne doit pas exister (élargissement S6 sans validation)"
  );
  assert.equal(preloadSrc.includes("pdf:register-open-path"), false);
  assert.equal(
    /(^|[^a-zA-Z])registerOpenPdfPath\s*:/.test(preloadSrc),
    false,
    "preload ne doit pas exposer registerOpenPdfPath (unregisterOpenPdfPath reste autorisé)"
  );

  const neverOpened = path.join(os.tmpdir(), "invariant-s6-never-opened.pdf");
  const rejected = evaluateRegisterOpenPathIpcRequest(neverOpened);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errorCode, REG_CODES.PDF_REGISTER_VIA_OPEN_ONLY);

  openPdfRegistry.resetOpenPdfPathsForTests();
  assert.equal(openPdfRegistry.isOpenPdfPath(neverOpened), false);
  const readBlocked = validatePdfReadBytesRequest(neverOpened, {
    exists: true,
    fileSize: 4096,
    isOpenPath: openPdfRegistry.isOpenPdfPath(neverOpened)
  });
  assert.equal(readBlocked.ok, false);
  assert.equal(readBlocked.errorCode, ERROR_CODES.PDF_READ_NOT_OPEN);
});

// --- S7 : CSP connect-src ---

test("INVARIANT S7 : CSP connect-src sans 127.0.0.1 ni localhost", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const connectSrc = extractCspConnectSrc(html);
  const forbidden = ["127.0.0.1", "localhost", "http://127.0.0.1", "http://localhost"];
  for (const needle of forbidden) {
    assert.equal(
      connectSrc.includes(needle),
      false,
      `connect-src ne doit pas contenir « ${needle} » (actuel: ${connectSrc})`
    );
  }
});

// --- S1 : co-localisation chemins PDF ---

test("INVARIANT S1 : sortie PDF hors dossier source — rejet (path-guard Node)", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "source-invariant.pdf");
  const outputPath = path.join(dir, "nested", "out-invariant.pdf");
  assert.equal(isOutputPdfInSameDirectoryAsInput(inputPath, outputPath), false);
});

test("INVARIANT S1 : sortie PDF hors dossier source — rejet (merge Python)", () => {
  const script = `
import os, sys, tempfile
sys.path.insert(0, ${JSON.stringify(PY_DIR)})
from pypdf import PdfWriter
from pdf_ops import merge_pdfs

with tempfile.TemporaryDirectory() as tmp:
    a = os.path.join(tmp, "a.pdf")
    b = os.path.join(tmp, "b.pdf")
    sub = os.path.join(tmp, "nested")
    os.makedirs(sub)
    out_bad = os.path.join(sub, "out.pdf")
    for p in (a, b):
        w = PdfWriter()
        w.add_blank_page(width=595, height=842)
        with open(p, "wb") as f:
            w.write(f)
    try:
        merge_pdfs([a, b], out_bad)
    except RuntimeError as e:
        if "non autorise" in str(e).lower() or "hors" in str(e).lower():
            sys.exit(0)
        raise
    print("merge a accepte une sortie hors dossier")
    sys.exit(4)
`;
  const res = runPython(script);
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("INVARIANT S1 : apply_annotations — exception documentee (Enregistrer sous hors dossier)", () => {
  const script = `
import os, sys, tempfile
sys.path.insert(0, ${JSON.stringify(PY_DIR)})
from pypdf import PdfWriter
from pdf_ops import apply_annotations

with tempfile.TemporaryDirectory() as tmp:
    src = os.path.join(tmp, "src.pdf")
    sub = os.path.join(tmp, "save-as")
    os.makedirs(sub)
    out = os.path.join(sub, "export.pdf")
    w = PdfWriter()
    w.add_blank_page(width=595, height=842)
    with open(src, "wb") as f:
        w.write(f)
    apply_annotations(src, out, {"1": {"w": 400, "h": 300, "rotation": 0}}, {})
    if not os.path.isfile(out):
        print("apply_annotations n a pas ecrit la sortie hors dossier (exception attendue)")
        sys.exit(5)
`;
  const res = runPython(script);
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

// --- S4 : validatePdfWithPython fail-closed ---

test("INVARIANT S4 : service Python indisponible — ouverture PDF refusee (fail-closed)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-invariant-s4-"));
  const pdfPath = path.join(dir, "doc.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n%EOF\n");

  let calls = 0;
  const validation = await validatePdfWithPython(pdfPath, {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest: () => {
      calls += 1;
      return networkErrorRequest();
    },
    sleep: async () => {}
  });

  const openResult = evaluatePdfOpen(pdfPath, {
    exists: true,
    fileSize: fs.statSync(pdfPath).size,
    validation
  });

  assert.equal(calls, MAX_VALIDATION_ATTEMPTS);
  assert.equal(validation.ok, false);
  assert.equal(validation.errorCode, VALIDATION_ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(validation.error, VALIDATION_MESSAGES.SERVICE_UNAVAILABLE);
  assert.equal(openResult.ok, false);
  assert.match(String(openResult.error || ""), /indisponible|échouée|Validation/i);

  fs.unlinkSync(pdfPath);
  fs.rmdirSync(dir);
});

// --- S5 : sanitization HTML annotations texte ---

test("INVARIANT S5 : payload XSS img onerror neutralisé par sanitizeAnnotationTextHtml", () => {
  const { sanitizeAnnotationTextHtml } = require("../src/lib/sanitize-html.js");
  const dirty = "<img src=x onerror=alert(1)><b>ok</b>";
  const out = sanitizeAnnotationTextHtml(dirty);
  assert.doesNotMatch(out, /onerror|javascript:|<\s*img/i);
  assert.match(out, /<b>ok<\/b>/i);
});

test("INVARIANT S5 : paste handler contentEditable présent (capture avant insertion native)", () => {
  const rendererJs = fs.readFileSync(path.join(APP_ROOT, "src", "renderer", "renderer.js"), "utf8");
  assert.match(
    rendererJs,
    /addEventListener\(\s*["']paste["']/,
    "wireTextEditorInteraction doit intercepter paste"
  );
  assert.match(
    rendererJs,
    /insertSanitizedClipboardIntoEditor/,
    "paste doit appeler insertSanitizedClipboardIntoEditor"
  );
  assert.match(rendererJs, /event\.preventDefault\(\)/);
});
