/**
 * Version embarquée (build-info.json généré au build, fallback package.json).
 */
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

/** @type {{ version: string, gitCommit: string | null, buildTime: string | null } | null} */
let cached = null;

/**
 * @typedef {{
 *   isPackaged?: boolean,
 *   getAppPath?: () => string,
 *   resourcesPath?: string
 * }} BuildInfoAppDeps
 */

/**
 * @param {BuildInfoAppDeps} [deps]
 */
function resolveAppDeps(deps = {}) {
  return {
    isPackaged: typeof deps.isPackaged === "boolean" ? deps.isPackaged : Boolean(app.isPackaged),
    getAppPath: typeof deps.getAppPath === "function" ? deps.getAppPath : () => app.getAppPath(),
    resourcesPath:
      typeof deps.resourcesPath === "string"
        ? deps.resourcesPath
        : String(process.resourcesPath || "")
  };
}

/**
 * @param {BuildInfoAppDeps} [deps]
 */
function getApplicationRoot(deps = {}) {
  const appLike = resolveAppDeps(deps);
  if (!appLike.isPackaged) {
    return path.join(__dirname, "..", "..", "..");
  }
  return path.join(appLike.resourcesPath, "app.asar.unpacked");
}

/**
 * @param {string} appRoot
 */
function readPackageVersion(appRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
    return String(pkg.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

/**
 * @param {BuildInfoAppDeps} [deps]
 */
function loadBuildInfo(deps = {}) {
  if (cached) return cached;
  const appLike = resolveAppDeps(deps);
  const appRoot = getApplicationRoot(deps);
  const candidates = [
    path.join(appRoot, "public", "build-info.json"),
    path.join(appLike.getAppPath(), "public", "build-info.json")
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const version = String(parsed?.version || "").trim() || readPackageVersion(appRoot);
      cached = {
        version,
        gitCommit:
          typeof parsed?.gitCommit === "string" && parsed.gitCommit.trim()
            ? parsed.gitCommit.trim()
            : null,
        buildTime:
          typeof parsed?.buildTime === "string" && parsed.buildTime.trim()
            ? parsed.buildTime.trim()
            : null
      };
      return cached;
    } catch {
      /* intentional: try next build-info candidate path */
    }
  }
  cached = {
    version: readPackageVersion(appRoot),
    gitCommit: null,
    buildTime: null
  };
  return cached;
}

/**
 * @param {BuildInfoAppDeps} [deps]
 */
function getInstalledVersion(deps = {}) {
  return loadBuildInfo(deps).version;
}

/**
 * @param {BuildInfoAppDeps} [deps]
 */
function getBuildInfoPayload(deps = {}) {
  const info = loadBuildInfo(deps);
  return {
    ok: true,
    version: info.version,
    gitCommit: info.gitCommit,
    buildTime: info.buildTime
  };
}

function resetBuildInfoCacheForTests() {
  cached = null;
}

module.exports = {
  getApplicationRoot,
  loadBuildInfo,
  getInstalledVersion,
  getBuildInfoPayload,
  resetBuildInfoCacheForTests
};
