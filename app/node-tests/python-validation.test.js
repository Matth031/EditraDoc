const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  validatePdfWithPython,
  ERROR_CODES,
  VALIDATION_MESSAGES
} = require("../src/main/lib/python-validation");
const { evaluatePdfOpen } = require("../src/main/lib/pdf-open");

function mockHttpRequestFailNetwork() {
  return () => {
    const req = {
      on(event, handler) {
        if (event === "error") {
          setImmediate(() => handler(new Error("ECONNREFUSED")));
        }
      },
      write() {},
      end() {},
      destroy() {}
    };
    return req;
  };
}

function mockHttpRequestTimeout() {
  return () => {
    const req = {
      on(event, handler) {
        if (event === "timeout") {
          setImmediate(() => handler());
        }
      },
      write() {},
      end() {},
      destroy() {}
    };
    return req;
  };
}

test("validatePdfWithPython : erreur réseau -> fail-closed + errorCode", async () => {
  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest: mockHttpRequestFailNetwork()
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(result.error, VALIDATION_MESSAGES.SERVICE_UNAVAILABLE);
});

test("validatePdfWithPython : timeout -> fail-closed + errorCode", async () => {
  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest: mockHttpRequestTimeout()
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(result.error, VALIDATION_MESSAGES.TIMEOUT);
});

test("validatePdfWithPython : port fermé (service arrêté) -> fail-closed", async () => {
  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json", "Content-Length": "20" }),
    port: 1,
    timeoutMs: 500
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
});

test("evaluatePdfOpen : validation indisponible refuse l'ouverture", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-open-"));
  const pdfPath = path.join(dir, "doc.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n%EOF\n");

  const result = evaluatePdfOpen(pdfPath, {
    exists: true,
    fileSize: fs.statSync(pdfPath).size,
    validation: {
      ok: false,
      error: VALIDATION_MESSAGES.SERVICE_UNAVAILABLE,
      errorCode: ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.match(result.error, /validation/i);

  fs.unlinkSync(pdfPath);
  fs.rmdirSync(dir);
});

test("evaluatePdfOpen : validation OK autorise l'ouverture", () => {
  const result = evaluatePdfOpen("C:\\docs\\a.pdf", {
    exists: true,
    fileSize: 128,
    validation: { ok: true }
  });
  assert.deepEqual(result, { ok: true, path: "C:\\docs\\a.pdf" });
});
