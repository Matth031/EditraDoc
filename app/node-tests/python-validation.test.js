const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  validatePdfWithPython,
  ERROR_CODES,
  VALIDATION_MESSAGES,
  MAX_VALIDATION_ATTEMPTS
} = require("../src/main/lib/python-validation");
const { evaluatePdfOpen } = require("../src/main/lib/pdf-open");

const noSleep = async () => {};

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

function successValidateRequest(onResponse, body = { ok: true }) {
  return {
    on() {},
    write() {},
    end() {
      setImmediate(() => {
        const res = {
          on(event, handler) {
            if (event === "data") {
              handler(Buffer.from(JSON.stringify(body)));
            }
            if (event === "end") {
              handler();
            }
          }
        };
        onResponse(res);
      });
    },
    destroy() {}
  };
}

/**
 * @param {{ succeedOnAttempt: number, successBody?: object }} config
 */
function createFlakyHttpRequest(config) {
  let calls = 0;
  const { succeedOnAttempt, successBody = { ok: true } } = config;
  return (_opts, onResponse) => {
    calls += 1;
    if (calls < succeedOnAttempt) {
      return networkErrorRequest();
    }
    return successValidateRequest(onResponse, successBody);
  };
}

function mockHttpRequestTimeout() {
  return () => ({
    on(event, handler) {
      if (event === "timeout") {
        setImmediate(() => handler());
      }
    },
    write() {},
    end() {},
    destroy() {}
  });
}

test("validatePdfWithPython : erreur réseau persistante -> fail-closed apres 3 tentatives", async () => {
  let calls = 0;
  const httpRequest = () => {
    calls += 1;
    return networkErrorRequest();
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, MAX_VALIDATION_ATTEMPTS);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(result.error, VALIDATION_MESSAGES.SERVICE_UNAVAILABLE);
});

test("validatePdfWithPython : timeout persistant -> fail-closed apres 3 tentatives", async () => {
  let calls = 0;
  const httpRequest = () => {
    calls += 1;
    return mockHttpRequestTimeout()();
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, MAX_VALIDATION_ATTEMPTS);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(result.error, VALIDATION_MESSAGES.TIMEOUT);
});

test("validatePdfWithPython : service lent repond OK a la 2e tentative", async () => {
  let calls = 0;
  const httpRequest = (_opts, onResponse) => {
    calls += 1;
    if (calls < 2) {
      return networkErrorRequest();
    }
    return successValidateRequest(onResponse);
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test("validatePdfWithPython : service lent repond OK a la 3e tentative", async () => {
  let calls = 0;
  const httpRequest = (_opts, onResponse) => {
    calls += 1;
    if (calls < 3) {
      return networkErrorRequest();
    }
    return successValidateRequest(onResponse);
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, 3);
  assert.equal(result.ok, true);
});

test("evaluatePdfOpen : reussit si validation OK apres retry (service lent)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-open-"));
  const pdfPath = path.join(dir, "doc.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n%EOF\n");

  const httpRequest = createFlakyHttpRequest({ succeedOnAttempt: 2 });
  const validation = await validatePdfWithPython(pdfPath, {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  const openResult = evaluatePdfOpen(pdfPath, {
    exists: true,
    fileSize: fs.statSync(pdfPath).size,
    validation
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(openResult, { ok: true, path: pdfPath });

  fs.unlinkSync(pdfPath);
  fs.rmdirSync(dir);
});

test("evaluatePdfOpen : validation indisponible apres 3 tentatives refuse l'ouverture (i18n)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-open-"));
  const pdfPath = path.join(dir, "doc.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n%EOF\n");

  const validation = await validatePdfWithPython(pdfPath, {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest: () => networkErrorRequest(),
    sleep: noSleep
  });

  const result = evaluatePdfOpen(pdfPath, {
    exists: true,
    fileSize: fs.statSync(pdfPath).size,
    validation
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_SERVICE_UNAVAILABLE);
  assert.equal(result.error, VALIDATION_MESSAGES.SERVICE_UNAVAILABLE);

  fs.unlinkSync(pdfPath);
  fs.rmdirSync(dir);
});

test("validatePdfWithPython : pas de retry sur ok:false metier (validation PDF)", async () => {
  let calls = 0;
  const httpRequest = (_opts, onResponse) => {
    calls += 1;
    return successValidateRequest(onResponse, { ok: false, error: "PDF invalide." });
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.error, "PDF invalide.");
  assert.equal(result.errorCode, undefined);
});

test("validatePdfWithPython : pas de retry sur reponse 401", async () => {
  let calls = 0;
  const httpRequest = (_opts, onResponse) => {
    calls += 1;
    return {
      on() {},
      write() {},
      end() {
        setImmediate(() => {
          const res = {
            statusCode: 401,
            on(event, handler) {
              if (event === "data") {
                handler(
                  Buffer.from(JSON.stringify({ ok: false, error: "Token d'authentification invalide." }))
                );
              }
              if (event === "end") {
                handler();
              }
            }
          };
          onResponse(res);
        });
      },
      destroy() {}
    };
  };

  const result = await validatePdfWithPython("/tmp/sample.pdf", {
    getPostHeaders: () => ({ "Content-Type": "application/json" }),
    httpRequest,
    sleep: noSleep
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.match(result.error, /Token/i);
});

test("evaluatePdfOpen : validation OK autorise l'ouverture", () => {
  const result = evaluatePdfOpen("C:\\docs\\a.pdf", {
    exists: true,
    fileSize: 128,
    validation: { ok: true }
  });
  assert.deepEqual(result, { ok: true, path: "C:\\docs\\a.pdf" });
});
