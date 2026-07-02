/**
 * Utilitaires légers partagés par le renderer (logs, ids, copie presse-papiers).
 * Chargé avant `renderer.js` ; expose `window.__editifyUtils`.
 */
(function () {
  "use strict";

  /** Logs diagnostics (console + IPC si dispo). Ne doit jamais lever. */
  function logText(tag, payload) {
    try {
      if (typeof console !== "undefined" && typeof console.info === "function") {
        console.info(`[editify:${tag}]`, payload);
      }
      try {
        globalThis.maniPdfApi?.log?.(
          tag,
          payload && typeof payload === "object" ? payload : { v: payload }
        );
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }

  function newAnnotationId() {
    return `${Date.now()}-${Math.random()}`;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function cloneForClipboard(item) {
    try {
      const cloned = deepClone(item);
      delete cloned.id;
      delete cloned.x;
      delete cloned.y;
      return cloned;
    } catch {
      try {
        const out = {};
        Object.keys(item || {}).forEach((k) => {
          if (k === "id" || k === "x" || k === "y") return;
          out[k] = item[k];
        });
        return out;
      } catch {
        return null;
      }
    }
  }

  /** Nom de fichier sans chemin (affichage UI, journal). */
  function baseNameFromPath(filePath) {
    if (!filePath || typeof filePath !== "string") return "document";
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || "document";
  }

  /** Compare deux chemins Windows/Unix (casse ignorée sous Windows). */
  function normalizeFsPath(filePath) {
    if (!filePath || typeof filePath !== "string") return "";
    return filePath.trim().replace(/\//g, "\\").toLowerCase();
  }

  function pathsEqual(a, b) {
    const na = normalizeFsPath(a);
    const nb = normalizeFsPath(b);
    return Boolean(na && nb && na === nb);
  }

  window.__editifyUtils = {
    logText,
    newAnnotationId,
    deepClone,
    cloneForClipboard,
    baseNameFromPath,
    normalizeFsPath,
    pathsEqual
  };
})();
