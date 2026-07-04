const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const fixturePath = path.join(repoRoot, "tests", "pdf_intrinsic_rotate270.pdf");
const createScript = path.join(__dirname, "..", "scripts", "create-rotated-pdf-fixture.mjs");

function ensureFixture() {
  if (fs.existsSync(fixturePath)) return;
  const r = spawnSync(process.execPath, [createScript], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || "Impossible de générer pdf_intrinsic_rotate270.pdf");
  }
}

describe("pdf.js viewport rotation (non-régression affichage /Rotate natif)", () => {
  before(() => {
    ensureFixture();
  });

  it("rotation absolue 270 sur mediabox paysage → viewport portrait", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(fs.readFileSync(fixturePath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const intrinsic = page.rotate || 0;
    assert.equal(intrinsic, 270);

    const wrong = page.getViewport({ scale: 1, rotation: 0 });
    const correct = page.getViewport({ scale: 1, rotation: intrinsic });

    assert.ok(wrong.width > wrong.height, "rotation:0 reste paysage (régression)");
    assert.ok(correct.height > correct.width, "rotation intrinsèque → portrait");
  });

  it("rotation absolue = intrinsic + delta utilisateur", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(fs.readFileSync(fixturePath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const intrinsic = page.rotate || 0;
    const userDelta = 90;
    const absRot = (intrinsic + userDelta) % 360;
    const vp = page.getViewport({ scale: 1, rotation: absRot });
    assert.ok(vp.width > vp.height, "270+90=0 → paysage affiché");
  });
});
