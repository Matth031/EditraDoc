const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  prepareSessionSavePayload,
  MAX_SESSION_SAVE_BYTES,
  ERROR_CODES
} = require("../src/main/lib/session-save-guard");

test("prepareSessionSavePayload : payload OK", () => {
  const result = prepareSessionSavePayload({ tabs: [], activeTabId: null });
  assert.equal(result.ok, true);
  assert.match(result.serialized, /"tabs"/);
  assert.ok(result.byteLength > 0);
});

test("prepareSessionSavePayload : payload > 50 Mo -> rejet explicite", () => {
  const big = "x".repeat(MAX_SESSION_SAVE_BYTES + 1);
  const result = prepareSessionSavePayload({ tabs: [{ annotationsByPage: { "1": [{ data: big }] } }] });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.SESSION_PAYLOAD_TOO_LARGE);
  assert.match(result.error, /50 Mo/);
});

test("prepareSessionSavePayload : objet non serialisable -> rejet", () => {
  const circular = {};
  circular.self = circular;
  const result = prepareSessionSavePayload(circular);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.SESSION_NOT_SERIALIZABLE);
});
