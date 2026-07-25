/**
 * L3 — `update-check.js` : allowlist fetch + orchestration `checkForUpdates` via deps injectées.
 */
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  fetchTextUrl,
  checkForUpdates,
  getUpdateStatus,
  resetUpdateStatusForTests,
  MAX_BODY_BYTES,
  DEFAULT_MANIFEST_URL
} = require("../src/main/lib/update-check");
const { OFFICIAL_WINDOWS_DOWNLOAD_URL } = require("../src/lib/update-manifest");

const ALLOWED_URL = "https://github.com/Matth031/EditraDoc/releases/latest/download/latest.json";

/**
 * @param {object} [fields]
 */
function validManifestBody(fields = {}) {
  return JSON.stringify({
    version: fields.version || "9.9.9",
    publishedAt: fields.publishedAt || "2026-07-01T00:00:00.000Z",
    releaseNotesUrl:
      fields.releaseNotesUrl || "https://github.com/Matth031/EditraDoc/releases/tag/v9.9.9",
    assets: {
      windows: {
        latestUrl: OFFICIAL_WINDOWS_DOWNLOAD_URL,
        sha256: "ab".repeat(32)
      }
    },
    ...fields.extra
  });
}

/**
 * Stub `https.request` : (options, callback) => ClientRequest-like.
 * @param {(options: object, callback: Function) => void} onRequest
 */
function makeRequestStub(onRequest) {
  return (options, callback) => {
    const req = new EventEmitter();
    // destroy no-op par défaut : éviter un `error` synchrone qui masque TIMEOUT
    req.destroy = () => {};
    req.end = () => {
      onRequest(options, callback, req);
    };
    return req;
  };
}

/**
 * Réponse IncomingMessage minimale.
 * @param {{ statusCode?: number, headers?: object, chunks?: Buffer[], autoEnd?: boolean }} cfg
 */
function makeResponse(cfg = {}) {
  const res = new EventEmitter();
  res.statusCode = cfg.statusCode ?? 200;
  res.headers = cfg.headers || {};
  res.resume = () => {};
  queueMicrotask(() => {
    for (const chunk of cfg.chunks || []) {
      res.emit("data", chunk);
    }
    if (cfg.autoEnd !== false) {
      res.emit("end");
    }
  });
  return res;
}

function baseDeps(overrides = {}) {
  return {
    getInstalledVersion: () => "1.0.0",
    getUpdateSettings: () => ({
      checkUpdatesOnStartup: true,
      lastUpdateCheckAt: null
    }),
    setLastUpdateCheckAt: () => {},
    logInfo: () => {},
    logWarn: () => {},
    ...overrides
  };
}

beforeEach(() => {
  resetUpdateStatusForTests();
});

describe("fetchTextUrl — allowlist (sans réseau)", () => {
  test("rejette URL invalide / http / hôte hors github.com", async () => {
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
});

describe("fetchTextUrl — seam https.request", () => {
  test("HTTP 200 → body utf8", async () => {
    const body = '{"ok":true}';
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((_opts, cb) => {
        cb(makeResponse({ chunks: [Buffer.from(body)] }));
      })
    });
    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body, body);
  });

  test("HTTP non-200 → HTTP_ERROR", async () => {
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((_opts, cb) => {
        cb(makeResponse({ statusCode: 404 }));
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "HTTP_ERROR");
    assert.equal(result.statusCode, 404);
  });

  test("redirect hors github.com → REDIRECT_NOT_ALLOWED", async () => {
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((_opts, cb) => {
        cb(
          makeResponse({
            statusCode: 302,
            headers: { location: "https://evil.example/x" }
          })
        );
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "REDIRECT_NOT_ALLOWED");
  });

  test("redirect github.com → suit la cible (2e requête)", async () => {
    let calls = 0;
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((opts, cb) => {
        calls += 1;
        if (calls === 1) {
          cb(
            makeResponse({
              statusCode: 302,
              headers: {
                location: "https://github.com/Matth031/EditraDoc/releases/download/v1/latest.json"
              }
            })
          );
          return;
        }
        cb(makeResponse({ chunks: [Buffer.from('{"v":1}')] }));
      })
    });
    assert.equal(result.ok, true);
    assert.equal(result.body, '{"v":1}');
    assert.equal(calls, 2);
  });

  test("corps > MAX_BODY_BYTES → BODY_TOO_LARGE", async () => {
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((_opts, cb, req) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = {};
        res.resume = () => {};
        cb(res);
        queueMicrotask(() => {
          res.emit("data", Buffer.alloc(MAX_BODY_BYTES + 1));
        });
        // destroy stub : ne pas faire échouer via error après BODY_TOO_LARGE
        req.destroy = () => {};
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "BODY_TOO_LARGE");
  });

  test("timeout socket → TIMEOUT", async () => {
    const result = await fetchTextUrl(ALLOWED_URL, 50, {
      request: makeRequestStub((_opts, _cb, req) => {
        queueMicrotask(() => req.emit("timeout"));
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "TIMEOUT");
  });

  test("erreur réseau → NETWORK_ERROR", async () => {
    const result = await fetchTextUrl(ALLOWED_URL, 1000, {
      request: makeRequestStub((_opts, _cb, req) => {
        queueMicrotask(() => req.emit("error", new Error("ECONNRESET")));
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "NETWORK_ERROR");
  });
});

describe("checkForUpdates — orchestration (deps)", () => {
  test("opt-in désactivé sans force → OPT_IN_DISABLED", async () => {
    const status = await checkForUpdates(
      { force: false },
      baseDeps({
        getUpdateSettings: () => ({ checkUpdatesOnStartup: false, lastUpdateCheckAt: null })
      })
    );
    assert.equal(status.skipped, true);
    assert.equal(status.reason, "OPT_IN_DISABLED");
    assert.equal(status.installedVersion, "1.0.0");
  });

  test("contrôle récent sans force → RECENTLY_CHECKED", async () => {
    const status = await checkForUpdates(
      { force: false },
      baseDeps({
        getUpdateSettings: () => ({
          checkUpdatesOnStartup: true,
          lastUpdateCheckAt: new Date().toISOString()
        })
      })
    );
    assert.equal(status.skipped, true);
    assert.equal(status.reason, "RECENTLY_CHECKED");
  });

  test("fetch KO → ok:false + logWarn", async () => {
    let warned = null;
    const status = await checkForUpdates(
      { force: true },
      baseDeps({
        fetchTextUrl: async () => ({ ok: false, error: "TIMEOUT", statusCode: undefined }),
        logWarn: (_cat, _msg, data) => {
          warned = data;
        }
      })
    );
    assert.equal(status.ok, false);
    assert.equal(status.errorCode, "TIMEOUT");
    assert.equal(warned?.errorCode, "TIMEOUT");
    assert.equal(getUpdateStatus().errorCode, "TIMEOUT");
  });

  test("body non-JSON → MANIFEST_NOT_JSON", async () => {
    const status = await checkForUpdates(
      { force: true },
      baseDeps({
        fetchTextUrl: async () => ({ ok: true, body: "not-json{" })
      })
    );
    assert.equal(status.ok, false);
    assert.equal(status.errorCode, "MANIFEST_NOT_JSON");
  });

  test("JSON invalide métier → MANIFEST_*", async () => {
    const status = await checkForUpdates(
      { force: true },
      baseDeps({
        fetchTextUrl: async () => ({ ok: true, body: JSON.stringify({ version: "nope" }) })
      })
    );
    assert.equal(status.ok, false);
    assert.match(String(status.errorCode), /^MANIFEST_/);
  });

  test("succès : MAJ disponible + setLastUpdateCheckAt", async () => {
    let savedAt = null;
    let infoMsg = null;
    const status = await checkForUpdates(
      { force: true, manifestUrl: DEFAULT_MANIFEST_URL },
      baseDeps({
        getInstalledVersion: () => "1.0.0",
        fetchTextUrl: async (url) => {
          assert.equal(url, DEFAULT_MANIFEST_URL);
          return { ok: true, body: validManifestBody({ version: "2.0.0" }) };
        },
        setLastUpdateCheckAt: (iso) => {
          savedAt = iso;
        },
        logInfo: (_c, msg) => {
          infoMsg = msg;
        }
      })
    );
    assert.equal(status.ok, true);
    assert.equal(status.updateAvailable, true);
    assert.equal(status.remoteVersion, "2.0.0");
    assert.equal(status.downloadUrl, OFFICIAL_WINDOWS_DOWNLOAD_URL);
    assert.ok(savedAt);
    assert.match(String(infoMsg), /disponible/i);
  });

  test("succès : déjà à jour", async () => {
    let infoMsg = null;
    const status = await checkForUpdates(
      { force: true },
      baseDeps({
        getInstalledVersion: () => "9.9.9",
        fetchTextUrl: async () => ({ ok: true, body: validManifestBody({ version: "9.9.9" }) }),
        logInfo: (_c, msg) => {
          infoMsg = msg;
        }
      })
    );
    assert.equal(status.ok, true);
    assert.equal(status.updateAvailable, false);
    assert.match(String(infoMsg), /a jour/i);
  });

  test("force ignore opt-in et intervalle", async () => {
    let fetched = false;
    const status = await checkForUpdates(
      { force: true },
      baseDeps({
        getUpdateSettings: () => ({
          checkUpdatesOnStartup: false,
          lastUpdateCheckAt: new Date().toISOString()
        }),
        fetchTextUrl: async () => {
          fetched = true;
          return { ok: true, body: validManifestBody({ version: "1.0.1" }) };
        }
      })
    );
    assert.equal(fetched, true);
    assert.equal(status.ok, true);
    assert.equal(status.updateAvailable, true);
  });
});

describe("getUpdateStatus", () => {
  test("sans cache → base avec version injectée", () => {
    const status = getUpdateStatus({ getInstalledVersion: () => "3.2.1" });
    assert.equal(status.installedVersion, "3.2.1");
    assert.equal(status.updateAvailable, false);
    assert.equal(status.errorCode, null);
  });
});
