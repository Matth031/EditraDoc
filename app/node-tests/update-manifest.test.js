const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSemver,
  compareSemver,
  isAllowedUpdateUrl,
  parseLatestManifest,
  isRemoteVersionNewer,
  normalizeUpdateSettings,
  shouldRunPeriodicUpdateCheck,
  OFFICIAL_WINDOWS_DOWNLOAD_URL
} = require("../src/lib/update-manifest");

test("normalizeSemver accepte v1.1.1 et 1.1.1", () => {
  assert.deepEqual(normalizeSemver("v1.1.1"), {
    major: 1,
    minor: 1,
    patch: 1,
    label: "1.1.1"
  });
  assert.deepEqual(normalizeSemver("1.1.1"), {
    major: 1,
    minor: 1,
    patch: 1,
    label: "1.1.1"
  });
});

test("compareSemver et isRemoteVersionNewer", () => {
  assert.equal(compareSemver("1.1.1", "1.1.0"), 1);
  assert.equal(compareSemver("1.1.0", "1.1.1"), -1);
  assert.equal(compareSemver("1.1.0", "1.1.0"), 0);
  assert.equal(isRemoteVersionNewer("1.1.0", "1.1.1"), true);
  assert.equal(isRemoteVersionNewer("1.1.1", "1.1.1"), false);
  assert.equal(isRemoteVersionNewer("1.2.0", "1.1.9"), false);
});

test("isAllowedUpdateUrl allowlist GitHub releases uniquement", () => {
  assert.equal(
    isAllowedUpdateUrl(
      "https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe"
    ),
    true
  );
  assert.equal(isAllowedUpdateUrl("http://github.com/Matth031/EditraDoc/releases/x"), false);
  assert.equal(isAllowedUpdateUrl("https://evil.com/Matth031/EditraDoc/releases/x"), false);
  assert.equal(isAllowedUpdateUrl("https://github.com/other/repo/releases/x"), false);
});

test("parseLatestManifest valide un manifeste Windows minimal", () => {
  const parsed = parseLatestManifest({
    version: "1.1.2",
    assets: {
      windows: {
        latestUrl: OFFICIAL_WINDOWS_DOWNLOAD_URL,
        sha256: "a".repeat(64)
      }
    }
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.manifest.version, "1.1.2");
  assert.equal(parsed.manifest.downloadUrl, OFFICIAL_WINDOWS_DOWNLOAD_URL);
});

test("parseLatestManifest rejette URL non allowlistée", () => {
  const parsed = parseLatestManifest({
    version: "9.9.9",
    assets: {
      windows: {
        url: "https://evil.example/setup.exe"
      }
    }
  });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, "MANIFEST_UNSAFE_URL");
});

test("normalizeUpdateSettings défaut opt-in désactivé", () => {
  assert.deepEqual(normalizeUpdateSettings({}), {
    checkUpdatesOnStartup: false,
    lastUpdateCheckAt: null
  });
  assert.deepEqual(
    normalizeUpdateSettings({
      checkUpdatesOnStartup: true,
      lastUpdateCheckAt: "2026-06-01T00:00:00.000Z"
    }),
    {
      checkUpdatesOnStartup: true,
      lastUpdateCheckAt: "2026-06-01T00:00:00.000Z"
    }
  );
});

test("shouldRunPeriodicUpdateCheck respecte l intervalle 24h", () => {
  const now = Date.now();
  const recent = new Date(now - 60 * 60 * 1000).toISOString();
  const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
  assert.equal(shouldRunPeriodicUpdateCheck(null), true);
  assert.equal(shouldRunPeriodicUpdateCheck(recent), false);
  assert.equal(shouldRunPeriodicUpdateCheck(old), true);
});
