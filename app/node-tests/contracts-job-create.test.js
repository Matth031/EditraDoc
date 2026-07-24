/**
 * Contrats P1 — job:create (union) + payloads merge / split_groups.
 * S1 : le schéma accepte volontairement des chemins hors dossier (forme seule) ;
 * la co-localisation reste dans path-guard / validateJobPayload / pdf_ops.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { validateJobCreateRequestContract } = require("../src/contracts/dist/validate");
const { isOutputPdfInSameDirectoryAsInput } = require("../src/main/lib/path-guard");

const goldenDir = path.join(__dirname, "fixtures", "p1-job-create");
const GOLDEN_FILES = ["01-merge.json", "02-split-groups.json", "03-split-legacy.json"];

describe("P1 contracts job:create (Node Ajv)", () => {
  for (const name of GOLDEN_FILES) {
    it(`golden : ${name} accepté`, () => {
      const file = path.join(goldenDir, name);
      assert.ok(fs.existsSync(file), `fixture manquante: ${file}`);
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const r = validateJobCreateRequestContract(raw);
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      assert.equal(r.value.type, raw.type);
    });
  }

  it("invalide : merge avec un seul input → CONTRACT_INVALID", () => {
    const r = validateJobCreateRequestContract({
      type: "merge",
      payload: { inputs: ["a.pdf"], output_path: "out.pdf" }
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : type inconnu → CONTRACT_INVALID", () => {
    const r = validateJobCreateRequestContract({
      type: "compress",
      payload: { input_path: "a.pdf", output_path: "b.pdf" }
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : split_groups sans page_indices → CONTRACT_INVALID", () => {
    const r = validateJobCreateRequestContract({
      type: "split_groups",
      payload: {
        input_path: "a.pdf",
        groups: [{ output_path: "out.pdf" }]
      }
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("INVARIANT S1 : schéma n'encode pas la co-localisation (forme OK, path-guard refuse)", () => {
    const dir = os.tmpdir();
    const inputA = path.join(dir, "job-s1-a.pdf");
    const inputB = path.join(dir, "job-s1-b.pdf");
    const outputNested = path.join(dir, "nested", "merged.pdf");
    const r = validateJobCreateRequestContract({
      type: "merge",
      payload: { inputs: [inputA, inputB], output_path: outputNested }
    });
    assert.equal(r.ok, true, "le contrat forme doit accepter (S1 hors schéma)");
    assert.equal(
      isOutputPdfInSameDirectoryAsInput(inputA, outputNested),
      false,
      "path-guard reste la source de vérité S1"
    );
  });
});
