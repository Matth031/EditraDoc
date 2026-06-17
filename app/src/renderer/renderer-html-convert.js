/**
 * Conversion HTML → PDF (menu Fichier, IPC direct, journal session).
 * `window.__editifyHtmlConvert` — `bind()` depuis `renderer.js`.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} HtmlConvertDeps
   * @property {HTMLElement | null} toolbarHtmlToPdfBtn
   * @property {(key: string) => string} t
   * @property {(key: string, vars?: Record<string, string>) => string} tr
   * @property {(msg: string) => void} setStatus
   * @property {(msg: string) => void} [showToastBrief]
   * @property {{ append: (row: { category?: string, message?: string }) => void }} sessionLog
   * @property {() => void} closeMenus
   * @property {(filePath: string, fileName: string) => Promise<void>} openPdfAtPath
   */

  /** @type {HtmlConvertDeps | null} */
  let deps = null;
  let wired = false;
  let converting = false;
  const { baseNameFromPath } = window.__editifyUtils || {};

  /** @param {HtmlConvertDeps} next */
  function bind(next) {
    deps = next;
    if (!wired) {
      wired = true;
      wireOnce();
    }
  }

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] __editifyHtmlConvert.bind() doit être appelé depuis renderer.js.");
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
   * @param {string} inputPath
   */
  async function runConversionWithPath(inputPath) {
    const d = requireDeps();
    if (converting) return;
    converting = true;
    const inputName = fileBaseName(inputPath);
    d.setStatus(d.t("stHtmlConverting"));
    try {
      const result = await window.maniPdfApi.convertHtmlToPdf({ inputPath });
      if (!result?.ok) {
        const err =
          typeof result?.error === "string" && result.error.trim()
            ? result.error
            : d.t("stHtmlConvertFailed");
        d.setStatus(err);
        return;
      }
      const outName = fileBaseName(result.outputPath || "");
      const inputStem = inputName.replace(/\.(html|htm)$/i, "");
      try {
        d.sessionLog.append({
          category: "conversion",
          message: d.tr("logHtmlConvert", { input: inputStem, name: outName })
        });
      } catch {
        /* ignore */
      }
      const toast = d.showToastBrief;
      if (toast) {
        toast(d.tr("stHtmlConvertOk", { name: outName }));
        if (Array.isArray(result.missingAssets) && result.missingAssets.length > 0) {
          toast(d.tr("stHtmlMissingAssets", { list: result.missingAssets.join(", ") }));
        }
        if (result.blockedRemote) {
          toast(d.t("stHtmlRemoteBlocked"));
        }
      }
      if (result.outputPath && typeof d.openPdfAtPath === "function") {
        try {
          await d.openPdfAtPath(result.outputPath, outName);
        } catch {
          d.setStatus(d.t("stHtmlConvertOpenFailed"));
        }
      } else {
        d.setStatus(d.t("stHtmlConvertDone"));
      }
    } catch {
      d.setStatus(d.t("stHtmlConvertFailed"));
    } finally {
      converting = false;
    }
  }

  async function promptAndConvert() {
    const d = requireDeps();
    try {
      d.closeMenus?.();
    } catch {
      /* ignore */
    }
    const dlg = await window.maniPdfApi.openHtmlDialog();
    if (!dlg?.ok || dlg.cancelled || !dlg.path) return;
    await runConversionWithPath(dlg.path);
  }

  function wireOnce() {
    const d0 = requireDeps();
    d0.toolbarHtmlToPdfBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      void promptAndConvert();
    });
    try {
      window.maniPdfApi?.onHtmlToPdfRequested?.(() => {
        void promptAndConvert();
      });
    } catch {
      /* ignore */
    }
  }

  window.__editifyHtmlConvert = {
    bind,
    promptAndConvert,
    runConversionWithPath
  };
})();
