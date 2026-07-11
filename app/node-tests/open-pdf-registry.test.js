const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const {
  registerOpenPdfPath,
  unregisterOpenPdfPath,
  isOpenPdfPath,
  resetOpenPdfPathsForTests,
  getOpenPdfPathRefCountForTests
} = require("../src/main/lib/open-pdf-registry");
const { validatePdfReadBytesRequest } = require("../src/main/lib/pdf-read-bytes-guard");

test("open-pdf-registry : register incrémente refCount et whitelist", () => {
  resetOpenPdfPathsForTests();
  const p = path.join(os.tmpdir(), "ref-a.pdf");
  registerOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 1);
  assert.equal(isOpenPdfPath(p), true);
  resetOpenPdfPathsForTests();
});

test("open-pdf-registry : unregister idempotent sous zéro", () => {
  resetOpenPdfPathsForTests();
  const p = path.join(os.tmpdir(), "ref-b.pdf");
  unregisterOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 0);
  assert.equal(isOpenPdfPath(p), false);
  registerOpenPdfPath(p);
  unregisterOpenPdfPath(p);
  unregisterOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 0);
  assert.equal(isOpenPdfPath(p), false);
  resetOpenPdfPathsForTests();
});

test("open-pdf-registry : deux onglets même path — un unregister conserve read-bytes", () => {
  resetOpenPdfPathsForTests();
  const p = path.join(os.tmpdir(), "shared.pdf");
  registerOpenPdfPath(p);
  registerOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 2);
  assert.equal(isOpenPdfPath(p), true);

  unregisterOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 1);
  assert.equal(isOpenPdfPath(p), true);

  const guard = validatePdfReadBytesRequest(p, {
    exists: true,
    fileSize: 4096,
    isOpenPath: isOpenPdfPath(p)
  });
  assert.equal(guard.ok, true);

  unregisterOpenPdfPath(p);
  assert.equal(getOpenPdfPathRefCountForTests(p), 0);
  assert.equal(isOpenPdfPath(p), false);
  resetOpenPdfPathsForTests();
});

test("open-pdf-registry : plusieurs chemins indépendants", () => {
  resetOpenPdfPathsForTests();
  const dir = os.tmpdir();
  const a = path.join(dir, "multi-a.pdf");
  const b = path.join(dir, "multi-b.pdf");
  registerOpenPdfPath(a);
  registerOpenPdfPath(b);
  assert.equal(isOpenPdfPath(a), true);
  assert.equal(isOpenPdfPath(b), true);
  unregisterOpenPdfPath(a);
  assert.equal(isOpenPdfPath(a), false);
  assert.equal(isOpenPdfPath(b), true);
  resetOpenPdfPathsForTests();
});
