const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchTextUrl } = require("../src/main/lib/update-check");

test("fetchTextUrl rejette les hôtes hors allowlist sans requête réseau", async () => {
  const invalid = await fetchTextUrl("not-a-url");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, "INVALID_URL");

  const http = await fetchTextUrl(
    "http://github.com/Matth031/EditraDoc/releases/latest/download/latest.json"
  );
  assert.equal(http.ok, false);
  assert.equal(http.error, "URL_NOT_ALLOWED");

  const evil = await fetchTextUrl("https://evil.example/latest.json");
  assert.equal(evil.ok, false);
  assert.equal(evil.error, "URL_NOT_ALLOWED");
});
