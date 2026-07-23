/**
 * Conversion image(s) PNG/JPG/JPEG → PDF (menu Fichier, IPC, journal session).
 * `window.__editifyImageConvert` — `bind()` depuis `renderer.js`.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} ImageConvertDeps
   * @property {HTMLElement | null} toolbarImagesToPdfBtn
   * @property {(key: string) => string} t
   * @property {(key: string, vars?: Record<string, string>) => string} tr
   * @property {(msg: string) => void} setStatus
   * @property {(msg: string) => void} [showToastBrief]
   * @property {{ append: (row: { category?: string, message?: string }) => void }} sessionLog
   * @property {() => void} closeMenus
   * @property {(filePath: string, fileName: string) => Promise<void>} openPdfAtPath
   */

  /** @type {ImageConvertDeps | null} */
  let deps = null;
  let wired = false;
  let converting = false;
  const { baseNameFromPath } = window.__editifyUtils || {};

  /** @param {ImageConvertDeps} next */
  function bind(next) {
    deps = next;
    if (!wired) {
      wired = true;
      wireOnce();
    }
  }

  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyImageConvert.bind() doit être appelé depuis renderer.js."
      );
    }
    return deps;
  }

  function fileBaseName(filePath) {
    if (typeof baseNameFromPath === "function") return baseNameFromPath(filePath);
    if (!filePath || typeof filePath !== "string") return "document";
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || "document";
  }

  /**
   * @param {string[]} inputPaths
   */
  async function runConversionWithPaths(inputPaths) {
    const d = requireDeps();
    if (converting) return;
    if (!Array.isArray(inputPaths) || !inputPaths.length) {
      d.setStatus(d.t("stImageNoSelection"));
      return;
    }
    converting = true;
    const firstName = fileBaseName(inputPaths[0]);
    d.setStatus(d.t("stImageConverting"));
    try {
      const result = await window.maniPdfApi.convertImagesToPdf({ inputPaths });
      if (!result?.ok) {
        const err =
          typeof result?.error === "string" && result.error.trim()
            ? result.error
            : d.t("stImageConvertFailed");
        d.setStatus(err);
        return;
      }
      const outName = fileBaseName(result.outputPath || "");
      const inputStem = firstName.replace(/\.(png|jpe?g)$/i, "");
      try {
        d.sessionLog.append({
          category: "conversion",
          message: d.tr("logImageConvert", {
            count: String(inputPaths.length),
            input: inputStem,
            name: outName
          })
        });
      } catch {
        /* intentional: session log append after image convert */
      }
      const toast = d.showToastBrief;
      if (toast) {
        toast(d.tr("stImageConvertOk", { name: outName, count: String(inputPaths.length) }));
      }
      if (result.outputPath && typeof d.openPdfAtPath === "function") {
        try {
          await d.openPdfAtPath(result.outputPath, outName);
        } catch {
          d.setStatus(d.t("stImageConvertOpenFailed"));
        }
      } else {
        d.setStatus(d.t("stImageConvertDone"));
      }
    } catch {
      d.setStatus(d.t("stImageConvertFailed"));
    } finally {
      converting = false;
    }
  }

  async function promptAndConvert() {
    const d = requireDeps();
    try {
      d.closeMenus?.();
    } catch {
      /* intentional: close menus before image convert prompt */
    }
    const dlg = await window.maniPdfApi.openImagesDialog();
    if (!dlg?.ok || dlg.cancelled || !Array.isArray(dlg.paths) || !dlg.paths.length) return;
    await runConversionWithPaths(dlg.paths);
  }

  function wireOnce() {
    const d0 = requireDeps();
    d0.toolbarImagesToPdfBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      void promptAndConvert();
    });
    try {
      window.maniPdfApi?.onImagesToPdfRequested?.(() => {
        void promptAndConvert();
      });
    } catch (error) {
      globalThis.__editifyReportWarn?.("image-convert:ipc-subscribe", String(error?.message || error));
    }
  }

  window.__editifyImageConvert = {
    bind,
    promptAndConvert,
    runConversionWithPaths
  };
})();
