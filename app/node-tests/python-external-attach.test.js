"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  isPythonExternalAttach,
  resolvePythonServiceToken
} = require("../src/main/lib/python-external-attach");

describe("python-external-attach", () => {
  test('isPythonExternalAttach : uniquement la chaîne exacte "1"', () => {
    assert.equal(isPythonExternalAttach({}), false);
    assert.equal(isPythonExternalAttach({ MANI_PDF_PYTHON_EXTERNAL: undefined }), false);
    assert.equal(isPythonExternalAttach({ MANI_PDF_PYTHON_EXTERNAL: "" }), false);
    assert.equal(isPythonExternalAttach({ MANI_PDF_PYTHON_EXTERNAL: "true" }), false);
    assert.equal(isPythonExternalAttach({ MANI_PDF_PYTHON_EXTERNAL: "0" }), false);
    assert.equal(isPythonExternalAttach({ MANI_PDF_PYTHON_EXTERNAL: "1" }), true);
  });

  test("resolvePythonServiceToken : hors attach ignore token shell et tire randomBytes", () => {
    const token = resolvePythonServiceToken(
      { MANI_PDF_SERVICE_TOKEN: "shell-residual-token" },
      { randomBytes: (n) => Buffer.alloc(n, 0xab) }
    );
    assert.equal(token, Buffer.alloc(32, 0xab).toString("hex"));
    assert.notEqual(token, "shell-residual-token");
  });

  test("resolvePythonServiceToken : attach exige MANI_PDF_SERVICE_TOKEN", () => {
    assert.throws(
      () => resolvePythonServiceToken({ MANI_PDF_PYTHON_EXTERNAL: "1" }),
      /MANI_PDF_SERVICE_TOKEN/
    );
    assert.throws(
      () =>
        resolvePythonServiceToken({
          MANI_PDF_PYTHON_EXTERNAL: "1",
          MANI_PDF_SERVICE_TOKEN: "   "
        }),
      /MANI_PDF_SERVICE_TOKEN/
    );
  });

  test("resolvePythonServiceToken : attach réutilise le token env (trim)", () => {
    const token = resolvePythonServiceToken({
      MANI_PDF_PYTHON_EXTERNAL: "1",
      MANI_PDF_SERVICE_TOKEN: "  fixed-suite-token  "
    });
    assert.equal(token, "fixed-suite-token");
  });
});
