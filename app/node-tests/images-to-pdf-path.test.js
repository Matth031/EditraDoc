const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  isRasterImageInputPath,
  resolveImagesToPdfOutputPath,
  validateImagesToPdfPaths
} = require("../src/main/lib/path-guard");

test("isRasterImageInputPath accepte png jpg jpeg", () => {
  assert.equal(isRasterImageInputPath("C:\\docs\\a.PNG"), true);
  assert.equal(isRasterImageInputPath("/tmp/b.jpg"), true);
  assert.equal(isRasterImageInputPath("/tmp/c.JPEG"), true);
  assert.equal(isRasterImageInputPath("/tmp/d.gif"), false);
});

test("resolveImagesToPdfOutputPath : premier fichier", () => {
  const out = resolveImagesToPdfOutputPath(["C:\\folder\\scan.png"]);
  assert.equal(out, path.join("C:\\folder", "scan.pdf"));
});

test("validateImagesToPdfPaths : co-localisation", () => {
  const dir = path.join("C:", "work", "imgs");
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
