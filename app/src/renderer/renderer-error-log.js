/**
 * Capture globale des erreurs renderer → fichier logs.txt via IPC main process.
 * Chargé en premier dans index.html (après le preload Electron).
 */
(function () {
  "use strict";

  /** @type {{ level: string, scope: string, message: string, data?: unknown }[]} */
  const queue = [];
  let flushTimer = null;

  function normalizeError(reason) {
    if (reason instanceof Error) {
      return { message: reason.message || String(reason), stack: reason.stack };
    }
    if (typeof reason === "string") return { message: reason };
    try {
      return { message: JSON.stringify(reason) };
    } catch {
      return { message: String(reason) };
    }
  }

  function send(row) {
    try {
      const api = globalThis.maniPdfApi;
      if (api && typeof api.logEvent === "function") {
        api.logEvent(row);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function flushQueue() {
    if (!queue.length) return;
    if (!send(queue[0])) return;
    queue.shift();
    if (queue.length) flushQueue();
  }

  function scheduleFlush() {
    if (flushTimer != null) return;
    flushTimer = globalThis.setInterval(() => {
      flushQueue();
      if (!queue.length && flushTimer != null) {
        globalThis.clearInterval(flushTimer);
        flushTimer = null;
      }
    }, 400);
  }

  /**
   * @param {string} level
   * @param {string} scope
   * @param {string} message
   * @param {unknown} [data]
   */
  function report(level, scope, message, data) {
    const row = { level, scope, message, data };
    if (!send(row)) {
      queue.push(row);
      scheduleFlush();
    }
    try {
      if (level === "error" && typeof console !== "undefined" && console.error) {
        console.error(`[editify:${scope}]`, message, data || "");
      } else if (level === "warn" && typeof console !== "undefined" && console.warn) {
        console.warn(`[editify:${scope}]`, message, data || "");
      }
    } catch {
      /* ignore */
    }
  }

  globalThis.__editifyReportError = (scope, message, data) => {
    report("error", scope, message, data);
  };

  globalThis.addEventListener(
    "error",
    (event) => {
      report("error", "renderer:window", event.message || "Erreur JavaScript", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error && event.error.stack
      });
    },
    true
  );

  globalThis.addEventListener("unhandledrejection", (event) => {
    const err = normalizeError(event.reason);
    report("error", "renderer:promise", err.message || "Promesse rejetée", {
      stack: err.stack
    });
  });

  flushQueue();
  scheduleFlush();
})();
