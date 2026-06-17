const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const {
  isOutputPdfInSameDirectoryAsInput,
  isPdfOutputColocatedWithInput,
  isHtmlInputPath,
  resolveHtmlToPdfOutputPath,
  validateHtmlToPdfPaths
} = require("../src/main/lib/path-guard.js");

test("alias isOutputPdfInSameDirectoryAsInput === isPdfOutputColocatedWithInput", () => {
  assert.equal(isOutputPdfInSameDirectoryAsInput, isPdfOutputColocatedWithInput);
});

test("sortie .pdf dans le même dossier que l’entrée -> true", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "source.pdf");
  const outputPath = path.join(dir, "out.pdf");
  assert.equal(isOutputPdfInSameDirectoryAsInput(inputPath, outputPath), true);
});

test("sortie dans un sous-dossier -> false", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "source.pdf");
  const outputPath = path.join(dir, "nested", "out.pdf");
  assert.equal(isOutputPdfInSameDirectoryAsInput(inputPath, outputPath), false);
});

test("extension sortie non .pdf -> false", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "source.pdf");
  const outputPath = path.join(dir, "out.txt");
  assert.equal(isOutputPdfInSameDirectoryAsInput(inputPath, outputPath), false);
});

test("entrées invalides -> false", () => {
  assert.equal(isOutputPdfInSameDirectoryAsInput("", "/x/y.pdf"), false);
  assert.equal(isOutputPdfInSameDirectoryAsInput("/a/b.pdf", null), false);
  assert.equal(isOutputPdfInSameDirectoryAsInput(1, "/a/b.pdf"), false);
});

test("entrée HTML .html / .htm (case insensitive) -> true", () => {
  assert.equal(isHtmlInputPath("/tmp/rapport.html"), true);
  assert.equal(isHtmlInputPath("/tmp/rapport.HTML"), true);
  assert.equal(isHtmlInputPath("/tmp/page.htm"), true);
  assert.equal(isHtmlInputPath("/tmp/page.pdf"), false);
  assert.equal(isHtmlInputPath(""), false);
});

test("resolveHtmlToPdfOutputPath : même dossier, basename.pdf", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "rapport.html");
  const out = resolveHtmlToPdfOutputPath(inputPath);
  assert.equal(out, path.join(dir, "rapport.pdf"));
});

test("validateHtmlToPdfPaths : co-localisation OK", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "rapport.html");
  const result = validateHtmlToPdfPaths(inputPath);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.outputPath, path.join(dir, "rapport.pdf"));
  }
});

test("validateHtmlToPdfPaths : sortie autre dossier -> rejet", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "rapport.html");
  const result = validateHtmlToPdfPaths(inputPath, path.join(dir, "nested", "rapport.pdf"));
  assert.equal(result.ok, false);
});

test("validateHtmlToPdfPaths : extension .HTML OK", () => {
  const dir = os.tmpdir();
  const inputPath = path.join(dir, "RAPPORT.HTML");
  const result = validateHtmlToPdfPaths(inputPath);
  assert.equal(result.ok, true);
});
