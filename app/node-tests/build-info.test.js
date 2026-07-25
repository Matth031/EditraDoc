/**
 * L4 — `build-info.js` : seam app-like (isPackaged / getAppPath / resourcesPath).
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  getApplicationRoot,
  loadBuildInfo,
  getInstalledVersion,
  getBuildInfoPayload,
  resetBuildInfoCacheForTests
} = require("../src/main/lib/build-info");

/** Racine app/ réelle (dev) — même calcul que getApplicationRoot(isPackaged:false). */
const DEV_APP_ROOT = path.join(__dirname, "..");

/**
 * @returns {{ root: string, cleanup: () => void }}
 */
function makeTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-buildinfo-"));
  return {
    root,
    cleanup: () => {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* intentional: tmp cleanup best-effort */
      }
    }
  };
}

/**
 * @param {string} dir
 * @param {object} payload
 */
function writeBuildInfoJson(dir, payload) {
  const pub = path.join(dir, "public");
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, "build-info.json"), JSON.stringify(payload), "utf8");
}

beforeEach(() => {
  resetBuildInfoCacheForTests();
});

afterEach(() => {
  resetBuildInfoCacheForTests();
});

describe("getApplicationRoot — branche isPackaged", () => {
  test("isPackaged === false → racine app/ (dev)", () => {
    const root = getApplicationRoot({ isPackaged: false });
    assert.equal(path.resolve(root), path.resolve(DEV_APP_ROOT));
  });

  test("isPackaged === true → resourcesPath/app.asar.unpacked", () => {
    const resourcesPath = path.join(os.tmpdir(), "editradoc-resources-fake");
    const root = getApplicationRoot({
      isPackaged: true,
      resourcesPath
    });
    assert.equal(root, path.join(resourcesPath, "app.asar.unpacked"));
  });
});

describe("loadBuildInfo", () => {
  test("dev : lit public/build-info.json ou fallback package.json", () => {
    // getAppPath injecté : évite electron.app non prêt en node:test
    const info = loadBuildInfo({
      isPackaged: false,
      getAppPath: () => DEV_APP_ROOT
    });
    assert.equal(typeof info.version, "string");
    assert.ok(info.version.length > 0);
    const pkg = JSON.parse(fs.readFileSync(path.join(DEV_APP_ROOT, "package.json"), "utf8"));
    const biPath = path.join(DEV_APP_ROOT, "public", "build-info.json");
    if (fs.existsSync(biPath)) {
      const bi = JSON.parse(fs.readFileSync(biPath, "utf8"));
      const expected = String(bi.version || "").trim() || String(pkg.version || "0.0.0");
      assert.equal(info.version, expected);
    } else {
      assert.equal(info.version, String(pkg.version || "0.0.0"));
    }
  });

  test("packaged : lit build-info sous resourcesPath", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      writeBuildInfoJson(unpacked, {
        version: "8.8.8",
        gitCommit: "abc1234",
        buildTime: "2026-07-25T10:00:00.000Z"
      });
      const info = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => path.join(fx.root, "missing-app-path")
      });
      assert.equal(info.version, "8.8.8");
      assert.equal(info.gitCommit, "abc1234");
      assert.equal(info.buildTime, "2026-07-25T10:00:00.000Z");
    } finally {
      fx.cleanup();
    }
  });

  test("packaged : fallback getAppPath si asar.unpacked sans build-info", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      fs.mkdirSync(unpacked, { recursive: true });
      const altRoot = path.join(fx.root, "alt-app");
      writeBuildInfoJson(altRoot, { version: "7.7.7", gitCommit: "  ", buildTime: "" });
      const info = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => altRoot
      });
      assert.equal(info.version, "7.7.7");
      assert.equal(info.gitCommit, null);
      assert.equal(info.buildTime, null);
    } finally {
      fx.cleanup();
    }
  });

  test("aucun JSON : fallback package.json (ou 0.0.0)", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      fs.mkdirSync(unpacked, { recursive: true });
      fs.writeFileSync(
        path.join(unpacked, "package.json"),
        JSON.stringify({ version: "4.5.6" }),
        "utf8"
      );
      const info = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => path.join(fx.root, "nope")
      });
      assert.equal(info.version, "4.5.6");
      assert.equal(info.gitCommit, null);
      assert.equal(info.buildTime, null);
    } finally {
      fx.cleanup();
    }
  });

  test("cache : second appel sans reset ne relit pas", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      writeBuildInfoJson(unpacked, { version: "1.2.3" });
      const first = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => fx.root
      });
      writeBuildInfoJson(unpacked, { version: "9.9.9" });
      const second = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => fx.root
      });
      assert.equal(first.version, "1.2.3");
      assert.equal(second.version, "1.2.3");
    } finally {
      fx.cleanup();
    }
  });

  test("JSON corrompu sur 1er candidat → tente le suivant", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      fs.mkdirSync(path.join(unpacked, "public"), { recursive: true });
      fs.writeFileSync(path.join(unpacked, "public", "build-info.json"), "{not-json", "utf8");
      const altRoot = path.join(fx.root, "alt");
      writeBuildInfoJson(altRoot, { version: "6.0.0" });
      const info = loadBuildInfo({
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => altRoot
      });
      assert.equal(info.version, "6.0.0");
    } finally {
      fx.cleanup();
    }
  });
});

describe("getInstalledVersion / getBuildInfoPayload", () => {
  test("payload ok avec champs", () => {
    const fx = makeTmpRoot();
    try {
      const unpacked = path.join(fx.root, "app.asar.unpacked");
      writeBuildInfoJson(unpacked, {
        version: "3.3.3",
        gitCommit: "deadbeef",
        buildTime: "2026-01-01T00:00:00.000Z"
      });
      const deps = {
        isPackaged: true,
        resourcesPath: fx.root,
        getAppPath: () => fx.root
      };
      assert.equal(getInstalledVersion(deps), "3.3.3");
      resetBuildInfoCacheForTests();
      const payload = getBuildInfoPayload(deps);
      assert.equal(payload.ok, true);
      assert.equal(payload.version, "3.3.3");
      assert.equal(payload.gitCommit, "deadbeef");
      assert.equal(payload.buildTime, "2026-01-01T00:00:00.000Z");
    } finally {
      fx.cleanup();
    }
  });
});
