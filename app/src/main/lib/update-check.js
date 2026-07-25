/**
 * Vérification de mise à jour (manifeste latest.json via HTTPS, process main).
 */
const https = require("node:https");
const { URL } = require("node:url");
const {
  DEFAULT_MANIFEST_URL,
  parseLatestManifest,
  isRemoteVersionNewer,
  shouldRunPeriodicUpdateCheck
} = require("../../lib/update-manifest");
const { getInstalledVersion } = require("./build-info");
const appSettings = require("../app-settings");
const { logInfo, logWarn } = require("../logger");

const REQUEST_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 64 * 1024;

/** @type {object | null} */
let lastStatus = null;

/**
 * @typedef {{
 *   request?: typeof https.request
 * }} FetchTextUrlDeps
 */

/**
 * @typedef {{
 *   fetchTextUrl?: (url: string, timeoutMs?: number) => Promise<{ ok: boolean, statusCode?: number, body?: string, error?: string }>,
 *   getInstalledVersion?: () => string,
 *   getUpdateSettings?: () => { checkUpdatesOnStartup: boolean, lastUpdateCheckAt: string | null },
 *   setLastUpdateCheckAt?: (iso: string) => void,
 *   logInfo?: typeof logInfo,
 *   logWarn?: typeof logWarn
 * }} CheckForUpdatesDeps
 */

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 * @param {FetchTextUrlDeps} [deps]
 * @returns {Promise<{ ok: boolean, statusCode?: number, body?: string, error?: string }>}
 */
function fetchTextUrl(url, timeoutMs = REQUEST_TIMEOUT_MS, deps = {}) {
  const request = deps.request || ((options, callback) => https.request(options, callback));

  return new Promise((resolve) => {
    let settled = false;
    /** @param {{ ok: boolean, statusCode?: number, body?: string, error?: string }} result */
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const requestUrl = String(url || "").trim();
    let parsed;
    try {
      parsed = new URL(requestUrl);
    } catch {
      finish({ ok: false, error: "INVALID_URL" });
      return;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
      finish({ ok: false, error: "URL_NOT_ALLOWED" });
      return;
    }

    const req = request(
      {
        method: "GET",
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          Accept: "application/json",
          "User-Agent": "EditraDoc-UpdateCheck/1.1"
        },
        timeout: timeoutMs
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          try {
            const next = new URL(res.headers.location, requestUrl);
            if (next.hostname !== "github.com") {
              finish({ ok: false, statusCode, error: "REDIRECT_NOT_ALLOWED" });
              return;
            }
            fetchTextUrl(next.toString(), timeoutMs, deps).then(finish);
          } catch {
            finish({ ok: false, statusCode, error: "REDIRECT_INVALID" });
          }
          res.resume();
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          finish({ ok: false, statusCode, error: "HTTP_ERROR" });
          return;
        }

        /** @type {Buffer[]} */
        const chunks = [];
        let total = 0;
        res.on("data", (chunk) => {
          total += chunk.length;
          if (total > MAX_BODY_BYTES) {
            req.destroy();
            finish({ ok: false, statusCode, error: "BODY_TOO_LARGE" });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          finish({
            ok: true,
            statusCode,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, error: "TIMEOUT" });
    });
    req.on("error", () => finish({ ok: false, error: "NETWORK_ERROR" }));
    req.end();
  });
}

/**
 * @param {CheckForUpdatesDeps} [deps]
 */
function buildStatusBase(deps = {}) {
  const getVersion = deps.getInstalledVersion || getInstalledVersion;
  return {
    ok: true,
    installedVersion: getVersion(),
    updateAvailable: false,
    remoteVersion: null,
    downloadUrl: null,
    releaseNotesUrl: null,
    sha256: null,
    checkedAt: new Date().toISOString(),
    errorCode: null
  };
}

/**
 * @param {{ force?: boolean, manifestUrl?: string }} [options]
 * @param {CheckForUpdatesDeps} [deps]
 */
async function checkForUpdates(options = {}, deps = {}) {
  const force = Boolean(options.force);
  const fetch = deps.fetchTextUrl || fetchTextUrl;
  const getSettings = deps.getUpdateSettings || (() => appSettings.getUpdateSettings());
  const setLastCheck =
    deps.setLastUpdateCheckAt || ((iso) => appSettings.setLastUpdateCheckAt(iso));
  const logI = deps.logInfo || logInfo;
  const logW = deps.logWarn || logWarn;

  const settings = getSettings();
  if (!force && !settings.checkUpdatesOnStartup) {
    return (
      lastStatus || {
        ...buildStatusBase(deps),
        skipped: true,
        reason: "OPT_IN_DISABLED"
      }
    );
  }
  if (!force && !shouldRunPeriodicUpdateCheck(settings.lastUpdateCheckAt)) {
    return (
      lastStatus || {
        ...buildStatusBase(deps),
        skipped: true,
        reason: "RECENTLY_CHECKED"
      }
    );
  }

  const manifestUrl = String(options.manifestUrl || DEFAULT_MANIFEST_URL);
  const installedVersion = (deps.getInstalledVersion || getInstalledVersion)();
  const base = buildStatusBase(deps);

  const fetched = await fetch(manifestUrl);
  if (!fetched.ok || !fetched.body) {
    const status = {
      ...base,
      ok: false,
      errorCode: fetched.error || "FETCH_FAILED",
      httpStatus: fetched.statusCode ?? null
    };
    lastStatus = status;
    logW("update", "Echec lecture manifeste", {
      errorCode: status.errorCode,
      httpStatus: status.httpStatus
    });
    return status;
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(fetched.body);
  } catch {
    const status = { ...base, ok: false, errorCode: "MANIFEST_NOT_JSON" };
    lastStatus = status;
    return status;
  }

  const parsed = parseLatestManifest(parsedJson);
  if (!parsed.ok || !parsed.manifest) {
    const status = {
      ...base,
      ok: false,
      errorCode: parsed.error || "MANIFEST_INVALID"
    };
    lastStatus = status;
    return status;
  }

  const remote = parsed.manifest;
  const updateAvailable = isRemoteVersionNewer(installedVersion, remote.version);
  const status = {
    ...base,
    ok: true,
    updateAvailable,
    remoteVersion: remote.version,
    downloadUrl: remote.downloadUrl,
    releaseNotesUrl: remote.releaseNotesUrl,
    sha256: remote.sha256,
    publishedAt: remote.publishedAt,
    errorCode: null
  };
  lastStatus = status;
  setLastCheck(status.checkedAt);
  logI("update", updateAvailable ? "Mise a jour disponible" : "Version a jour", {
    installedVersion,
    remoteVersion: remote.version
  });
  return status;
}

/**
 * @param {CheckForUpdatesDeps} [deps]
 */
function getUpdateStatus(deps = {}) {
  if (lastStatus) return lastStatus;
  return buildStatusBase(deps);
}

function resetUpdateStatusForTests() {
  lastStatus = null;
}

module.exports = {
  DEFAULT_MANIFEST_URL,
  fetchTextUrl,
  checkForUpdates,
  getUpdateStatus,
  resetUpdateStatusForTests,
  MAX_BODY_BYTES,
  REQUEST_TIMEOUT_MS
};
