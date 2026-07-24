/**
 * Contrats P1 — session:save (Node Ajv uniquement, pas de Python).
 * S10 / E-AUDIT-02.5 : plafond 50 Mo hors schéma (prepareSessionSavePayload).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { validateSessionSaveRequestContract } = require("../src/contracts/dist/validate");
const {
  prepareSessionSavePayload,
  MAX_SESSION_SAVE_BYTES,
  ERROR_CODES
} = require("../src/main/lib/session-save-guard");

const goldenDir = path.join(__dirname, "fixtures", "p1-session-save");
const GOLDEN_FILES = ["01-one-tab.json", "02-empty-tabs.json"];

describe("P1 contracts session:save (Node Ajv, Node-only)", () => {
  for (const name of GOLDEN_FILES) {
    it(`golden : ${name} accepté`, () => {
      const file = path.join(goldenDir, name);
      assert.ok(fs.existsSync(file), `fixture manquante: ${file}`);
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const r = validateSessionSaveRequestContract(raw);
      assert.equal(r.ok, true, r.ok ? "" : r.error);
    });
  }

  it("invalide : tabs number → CONTRACT_INVALID", () => {
    const r = validateSessionSaveRequestContract({ tabs: 42, activeTabId: null });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : tab sans path → CONTRACT_INVALID", () => {
    const r = validateSessionSaveRequestContract({
      tabs: [
        {
          id: "t1",
          name: "x.pdf",
          currentPage: 1,
          annotationsByPage: {},
          pageRotationsByPage: {},
          pageRotationsUserTouched: {},
          viewportByPage: {},
          undoStack: [],
          redoStack: []
        }
      ],
      activeTabId: "t1"
    });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : champ racine inconnu → rejet", () => {
    const r = validateSessionSaveRequestContract({
      tabs: [],
      activeTabId: null,
      extra: true
    });
    assert.equal(r.ok, false);
  });

  it("INVARIANT S10 : schéma n'encode pas le plafond 50 Mo (forme OK, guard refuse)", () => {
    const big = "x".repeat(MAX_SESSION_SAVE_BYTES + 1);
    const shaped = {
      tabs: [
        {
          id: "big",
          name: "big.pdf",
          path: "C:\\tmp\\big.pdf",
          currentPage: 1,
          annotationsByPage: { 1: [{ type: "text", data: big }] },
          pageRotationsByPage: {},
          pageRotationsUserTouched: {},
          viewportByPage: {},
          undoStack: [],
          redoStack: []
        }
      ],
      activeTabId: "big"
    };
    const contract = validateSessionSaveRequestContract(shaped);
    assert.equal(contract.ok, true, "le contrat forme doit accepter (S10 hors schéma)");
    const prepared = prepareSessionSavePayload(shaped);
    assert.equal(prepared.ok, false);
    assert.equal(prepared.errorCode, ERROR_CODES.SESSION_PAYLOAD_TOO_LARGE);
  });
});
