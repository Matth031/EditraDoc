const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeData, shouldLogLevel, formatLogLine } = require("../src/lib/app-log-core");

test("sanitizeData redacte les champs sensibles", () => {
  const out = sanitizeData({ password: "secret", step: "ok" });
  assert.equal(out.password, "[redacted]");
  assert.equal(out.step, "ok");
});

test("shouldLogLevel journalise toujours error et warn", () => {
  assert.equal(shouldLogLevel("error", false), true);
  assert.equal(shouldLogLevel("warn", false), true);
  assert.equal(shouldLogLevel("info", false), false);
  assert.equal(shouldLogLevel("info", true), true);
});

test("formatLogLine produit une ligne lisible", () => {
  const line = formatLogLine({
    level: "error",
    scope: "test",
    message: "boom",
    data: { code: 1 },
    pid: 42,
    ts: "2026-01-01T00:00:00.000Z"
  });
  assert.match(line, /\[ERROR\]/);
  assert.match(line, /\[test\] boom/);
});
