/**
 * Contrats P1 — apply-annotations : golden (4 captures peek→IPC) + invalide (Ajv).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { validateApplyAnnotationsRequestContract } = require("../src/contracts/dist/validate");
const { peekPayloadToIpcRequest } = require("./helpers/peek-to-ipc");

const goldenDir = path.join(__dirname, "fixtures", "p1-export-golden");
const GOLDEN_FILES = [
  "01-style-export-shape-image.peek.json",
  "02-soft-wrap.peek.json",
  "03-explicit-enter-two-lines.peek.json",
  "04-packaged-image-only.peek.json"
];

describe("P1 contracts apply-annotations (Node Ajv)", () => {
  for (const name of GOLDEN_FILES) {
    it(`golden : ${name} (peek→IPC) accepté`, () => {
      const file = path.join(goldenDir, name);
      assert.ok(fs.existsSync(file), `fixture manquante: ${file}`);
      const captured = JSON.parse(fs.readFileSync(file, "utf8"));
      // Mapping documenté : peek camelCase → IPC snake_case (+ output_path).
      const ipc = peekPayloadToIpcRequest(captured.payload, "C:\\tmp\\editradoc-golden-export.pdf");
      const r = validateApplyAnnotationsRequestContract(ipc);
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      assert.equal(r.value.input_path, captured.payload.inputPath);
      assert.equal(r.value.output_path, "C:\\tmp\\editradoc-golden-export.pdf");
    });
  }

  it("invalide : input_path number → CONTRACT_INVALID", () => {
    const r = validateApplyAnnotationsRequestContract({
      input_path: 42,
      output_path: "out.pdf",
      canvases_px_by_page: {},
      annotations_by_page: {}
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : annotations_by_page item sans type → CONTRACT_INVALID", () => {
    const r = validateApplyAnnotationsRequestContract({
      input_path: "a.pdf",
      output_path: "b.pdf",
      canvases_px_by_page: { 1: { w: 1, h: 1 } },
      annotations_by_page: { 1: [{ x: 1 }] }
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : champ racine inconnu (additionalProperties false) → rejet", () => {
    const r = validateApplyAnnotationsRequestContract({
      input_path: "a.pdf",
      output_path: "b.pdf",
      canvases_px_by_page: {},
      annotations_by_page: {},
      extra: true
    });
    assert.equal(r.ok, false);
  });
});
