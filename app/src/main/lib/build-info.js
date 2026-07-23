/**
 * Version embarquée (build-info.json généré au build, fallback package.json).
 */
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

/** @type {{ version: string, gitCommit: string | null, buildTime: string | null } | null} */
let cached = null;

function getApplicationRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", "..", "..");
  }
  return path.join(process.resourcesPath, "app.asar.unpacked");
}

function readPackageVersion(appRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
    return String(pkg.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function loadBuildInfo() {
  if (cached) return cached;
  const appRoot = getApplicationRoot();
  const candidates = [
    path.join(appRoot, "public", "build-info.json"),
    path.join(app.getAppPath(), "public", "build-info.json")
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

function getInstalledVersion() {
  return loadBuildInfo().version;
}

function getBuildInfoPayload() {
  const info = loadBuildInfo();
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
  loadBuildInfo,
  getInstalledVersion,
  getBuildInfoPayload,
  resetBuildInfoCacheForTests
};
