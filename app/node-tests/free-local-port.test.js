/**
 * L2 — `isPortListening` (TCP local + seam `connect`/`timeoutMs`).
 * `findListeningPidOnPort` / `killProcessTree` : exclus L6, non exercés ici.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { EventEmitter } = require("node:events");
const { isPortListening, freeLocalPort } = require("../src/main/lib/free-local-port");

/**
 * Écoute 127.0.0.1:0 puis retourne le port assigné.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
function listenEphemeral() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("address() inattendu"));
        return;
      }
      resolve({
        port: addr.port,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          })
      });
    });
  });
}

/**
 * Fake `net.connect` contrôlé (seam) — pas de vrai socket OS.
 * @param {"connect" | "error" | "hang"} mode
 * @returns {(options: object, connectionListener?: () => void) => EventEmitter & { end: Function, destroy: Function, setTimeout: Function }}
 */
function makeConnectStub(mode) {
  return (_options, connectionListener) => {
    const socket = new EventEmitter();
    let timeoutCb = null;
    let destroyed = false;

    socket.end = () => {};
    socket.destroy = () => {
      destroyed = true;
    };
    socket.setTimeout = (_ms, cb) => {
      timeoutCb = typeof cb === "function" ? cb : null;
      return socket;
    };

    queueMicrotask(() => {
      if (destroyed) return;
      if (mode === "connect" && typeof connectionListener === "function") {
        connectionListener();
        return;
      }
      if (mode === "error") {
        socket.emit(
          "error",
          Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
        );
        return;
      }
      // hang : seul le timeout produit une réponse
      if (mode === "hang" && timeoutCb) {
        timeoutCb();
      }
    });

    return socket;
  };
}

describe("isPortListening — TCP réel", () => {
  test("port libre → false", async () => {
    const occupied = await listenEphemeral();
    const freePort = occupied.port;
    await occupied.close();
    // Port libéré : nouvelle sonde doit échouer (ECONNREFUSED → false).
    const listening = await isPortListening(freePort);
    assert.equal(listening, false);
  });

  test("port occupé → true", async () => {
    const occupied = await listenEphemeral();
    try {
      const listening = await isPortListening(occupied.port);
      assert.equal(listening, true);
    } finally {
      await occupied.close();
    }
  });
});

describe("isPortListening — seam connect", () => {
  test("connect réussi → true (sans socket OS)", async () => {
    const listening = await isPortListening(9, { connect: makeConnectStub("connect") });
    assert.equal(listening, true);
  });

  test("erreur sous-jacente (ECONNREFUSED) → false", async () => {
    const listening = await isPortListening(9, { connect: makeConnectStub("error") });
    assert.equal(listening, false);
  });

  test("timeout sans connect/error → false", async () => {
    const listening = await isPortListening(9, {
      connect: makeConnectStub("hang"),
      timeoutMs: 5
    });
    assert.equal(listening, false);
  });
});

describe("freeLocalPort — early return (sans find/kill)", () => {
  test("port libre → no-op (n'appelle pas les helpers OS)", async () => {
    const occupied = await listenEphemeral();
    const freePort = occupied.port;
    await occupied.close();
    // Si findListeningPidOnPort/kill étaient appelés à tort, netstat/taskkill
    // tourneraient ici ; early-return sur !isPortListening les évite.
    await freeLocalPort(freePort);
    assert.equal(await isPortListening(freePort), false);
  });
});
