/**
 * Parsing manifeste latest.json et comparaison semver (pur, testable sans Electron).
 */

const DEFAULT_MANIFEST_URL =
  "https://github.com/Matth031/EditraDoc/releases/latest/download/latest.json";

const OFFICIAL_WINDOWS_DOWNLOAD_URL =
  "https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe";

const GITHUB_RELEASES_PATH_PREFIX = "/Matth031/EditraDoc/releases/";

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

/**
 * @param {unknown} version
 */
function normalizeSemver(version) {
  const raw = String(version ?? "").trim();
  const m = raw.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    label: `${m[1]}.${m[2]}.${m[3]}`
  };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1 | null}
 */
function compareSemver(a, b) {
  const va = normalizeSemver(a);
  const vb = normalizeSemver(b);
  if (!va || !vb) return null;
  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;
  return 0;
}

/**
 * @param {string} url
 */
function isAllowedUpdateUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "github.com") return false;
    if (!parsed.pathname.startsWith(GITHUB_RELEASES_PATH_PREFIX)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} raw
 */
function parseLatestManifest(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "MANIFEST_INVALID" };
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const version = normalizeSemver(obj.version);
  if (!version) {
    return { ok: false, error: "MANIFEST_INVALID_VERSION" };
  }
  const assets = obj.assets;
  if (!assets || typeof assets !== "object") {
    return { ok: false, error: "MANIFEST_INVALID_ASSETS" };
  }
  const windows = /** @type {Record<string, unknown>} */ (assets).windows;
  if (!windows || typeof windows !== "object") {
    return { ok: false, error: "MANIFEST_INVALID_WINDOWS" };
  }
  const win = /** @type {Record<string, unknown>} */ (windows);
  const downloadUrl = String(win.latestUrl || win.url || OFFICIAL_WINDOWS_DOWNLOAD_URL).trim();
  if (!isAllowedUpdateUrl(downloadUrl)) {
    return { ok: false, error: "MANIFEST_UNSAFE_URL" };
  }
  const sha256 = String(win.sha256 || "")
    .trim()
    .toLowerCase();
  if (sha256 && !SHA256_HEX_RE.test(sha256)) {
    return { ok: false, error: "MANIFEST_INVALID_SHA256" };
  }
  const releaseNotesUrl = String(obj.releaseNotesUrl || "").trim();
  const safeReleaseNotes =
    releaseNotesUrl && isAllowedUpdateUrl(releaseNotesUrl) ? releaseNotesUrl : null;
  const sizeRaw = win.size;
  const size =
    typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0
      ? Math.floor(sizeRaw)
      : null;
  return {
    ok: true,
    manifest: {
      schemaVersion: Number(obj.schemaVersion) || 1,
      product: String(obj.product || "EditraDoc"),
      version: version.label,
      tag: String(obj.tag || `v${version.label}`),
      publishedAt: typeof obj.publishedAt === "string" ? obj.publishedAt : null,
      releaseNotesUrl: safeReleaseNotes,
      downloadUrl,
      sha256: sha256 || null,
      size
    }
  };
}

/**
 * @param {string} installedVersion
 * @param {string} remoteVersion
 */
function isRemoteVersionNewer(installedVersion, remoteVersion) {
  const cmp = compareSemver(remoteVersion, installedVersion);
  return cmp === 1;
}

/**
 * @param {unknown} settings
 */
function normalizeUpdateSettings(settings) {
  const src = settings && typeof settings === "object" ? settings : {};
  const last =
    typeof src.lastUpdateCheckAt === "string" && src.lastUpdateCheckAt.trim()
      ? src.lastUpdateCheckAt.trim()
      : null;
  return {
    checkUpdatesOnStartup: Boolean(src.checkUpdatesOnStartup),
    lastUpdateCheckAt: last
  };
}

/**
 * @param {string | null | undefined} lastIso
 * @param {number} [minIntervalMs]
 */
function shouldRunPeriodicUpdateCheck(lastIso, minIntervalMs = 24 * 60 * 60 * 1000) {
  if (!lastIso) return true;
  const last = Date.parse(lastIso);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= minIntervalMs;
}

module.exports = {
  DEFAULT_MANIFEST_URL,
  OFFICIAL_WINDOWS_DOWNLOAD_URL,
  GITHUB_RELEASES_PATH_PREFIX,
  normalizeSemver,
  compareSemver,
  isAllowedUpdateUrl,
  parseLatestManifest,
  isRemoteVersionNewer,
  normalizeUpdateSettings,
  shouldRunPeriodicUpdateCheck
};
