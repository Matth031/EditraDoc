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

// --- Lot C : cas limites manifeste / semver / périodicité ---

test("normalizeSemver : invalide / null / vide → null", () => {
  assert.equal(normalizeSemver(null), null);
  assert.equal(normalizeSemver(undefined), null);
  assert.equal(normalizeSemver(""), null);
  assert.equal(normalizeSemver("1.2"), null);
  assert.equal(normalizeSemver("abc"), null);
  assert.deepEqual(normalizeSemver("1.2.3-beta"), {
    major: 1,
    minor: 2,
    patch: 3,
    label: "1.2.3"
  });
});

test("compareSemver : null si un côté invalide ; bras major/minor", () => {
  assert.equal(compareSemver("bad", "1.0.0"), null);
  assert.equal(compareSemver("1.0.0", null), null);
  assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
  assert.equal(compareSemver("1.0.0", "2.0.0"), -1);
  assert.equal(compareSemver("1.2.0", "1.1.9"), 1);
  assert.equal(compareSemver("1.1.0", "1.2.0"), -1);
});

test("isAllowedUpdateUrl : URL vraiment illégale (catch)", () => {
  assert.equal(isAllowedUpdateUrl("not a url"), false);
  assert.equal(isAllowedUpdateUrl("://broken"), false);
  assert.equal(isAllowedUpdateUrl(""), false);
});

test("parseLatestManifest : guards object/version/assets/windows invalides", () => {
  assert.deepEqual(parseLatestManifest(null), { ok: false, error: "MANIFEST_INVALID" });
  assert.deepEqual(parseLatestManifest("x"), { ok: false, error: "MANIFEST_INVALID" });
  assert.deepEqual(parseLatestManifest({ version: "nope", assets: { windows: {} } }), {
    ok: false,
    error: "MANIFEST_INVALID_VERSION"
  });
  assert.deepEqual(parseLatestManifest({ version: "1.0.0" }), {
    ok: false,
    error: "MANIFEST_INVALID_ASSETS"
  });
  assert.deepEqual(parseLatestManifest({ version: "1.0.0", assets: null }), {
    ok: false,
    error: "MANIFEST_INVALID_ASSETS"
  });
  assert.deepEqual(parseLatestManifest({ version: "1.0.0", assets: {} }), {
    ok: false,
    error: "MANIFEST_INVALID_WINDOWS"
  });
  assert.deepEqual(parseLatestManifest({ version: "1.0.0", assets: { windows: null } }), {
    ok: false,
    error: "MANIFEST_INVALID_WINDOWS"
  });
});

test("parseLatestManifest : fallbacks latestUrl/sha/size/publishedAt + sha invalide", () => {
  const viaUrl = parseLatestManifest({
    version: "1.0.0",
    assets: { windows: { url: OFFICIAL_WINDOWS_DOWNLOAD_URL } }
  });
  assert.equal(viaUrl.ok, true);
  assert.equal(viaUrl.manifest.downloadUrl, OFFICIAL_WINDOWS_DOWNLOAD_URL);
  assert.equal(viaUrl.manifest.sha256, null);
  assert.equal(viaUrl.manifest.size, null);
  assert.equal(viaUrl.manifest.publishedAt, null);

  const viaDefault = parseLatestManifest({
    version: "1.0.0",
    publishedAt: "2026-07-01T12:00:00.000Z",
    assets: {
      windows: {
        size: 12.7,
        sha256: "B".repeat(64)
      }
    }
  });
  assert.equal(viaDefault.ok, true);
  assert.equal(viaDefault.manifest.downloadUrl, OFFICIAL_WINDOWS_DOWNLOAD_URL);
  assert.equal(viaDefault.manifest.size, 12);
  assert.equal(viaDefault.manifest.sha256, "b".repeat(64));
  assert.equal(viaDefault.manifest.publishedAt, "2026-07-01T12:00:00.000Z");

  const badSha = parseLatestManifest({
    version: "1.0.0",
    assets: {
      windows: {
        latestUrl: OFFICIAL_WINDOWS_DOWNLOAD_URL,
        sha256: "not-a-sha"
      }
    }
  });
  assert.deepEqual(badSha, { ok: false, error: "MANIFEST_INVALID_SHA256" });

  const publishedAtNonString = parseLatestManifest({
    version: "1.0.0",
    publishedAt: 42,
    assets: { windows: { latestUrl: OFFICIAL_WINDOWS_DOWNLOAD_URL } }
  });
  assert.equal(publishedAtNonString.ok, true);
  assert.equal(publishedAtNonString.manifest.publishedAt, null);
});

test("normalizeUpdateSettings : non-object + date invalide/vide", () => {
  assert.deepEqual(normalizeUpdateSettings(null), {
    checkUpdatesOnStartup: false,
    lastUpdateCheckAt: null
  });
  assert.deepEqual(normalizeUpdateSettings("x"), {
    checkUpdatesOnStartup: false,
    lastUpdateCheckAt: null
  });
  assert.deepEqual(normalizeUpdateSettings({ lastUpdateCheckAt: "   " }), {
    checkUpdatesOnStartup: false,
    lastUpdateCheckAt: null
  });
  assert.deepEqual(normalizeUpdateSettings({ lastUpdateCheckAt: 99 }), {
    checkUpdatesOnStartup: false,
    lastUpdateCheckAt: null
  });
});

test("shouldRunPeriodicUpdateCheck : date invalide → true", () => {
  assert.equal(shouldRunPeriodicUpdateCheck("not-a-date"), true);
  assert.equal(shouldRunPeriodicUpdateCheck(""), true);
  assert.equal(shouldRunPeriodicUpdateCheck(undefined), true);
});
