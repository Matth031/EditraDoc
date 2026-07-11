const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const {
  isRasterImageInputPath,
  resolveImagesToPdfOutputPath,
  validateImagesToPdfPaths
} = require("../src/main/lib/path-guard");

test("isRasterImageInputPath accepte png jpg jpeg", () => {
  assert.equal(isRasterImageInputPath(path.join(os.tmpdir(), "a.PNG")), true);
  assert.equal(isRasterImageInputPath("/tmp/b.jpg"), true);
  assert.equal(isRasterImageInputPath("/tmp/c.JPEG"), true);
  assert.equal(isRasterImageInputPath("/tmp/d.gif"), false);
});

test("resolveImagesToPdfOutputPath : premier fichier", () => {
  const dir = os.tmpdir();
  const input = path.join(dir, "scan.png");
  const out = resolveImagesToPdfOutputPath([input]);
  assert.equal(out, path.join(dir, "scan.pdf"));
});

test("validateImagesToPdfPaths : co-localisation", () => {
  const dir = path.join(os.tmpdir(), "imgs");
  const ok = validateImagesToPdfPaths([path.join(dir, "a.png"), path.join(dir, "b.jpg")]);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.outputPath, path.join(dir, "a.pdf"));
    assert.equal(ok.inputPaths.length, 2);
  }
});

test("validateImagesToPdfPaths : aucune image", () => {
  const r = validateImagesToPdfPaths([]);
  assert.equal(r.ok, false);
});
