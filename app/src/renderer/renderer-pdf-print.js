/**
 * Impression PDF : bake via exportActivePdfToPath (même pipeline qu'Enregistrer sous),
 * sortie forcée dans os.tmpdir()/editradoc-print/ (ADR-008) — jamais le dossier source.
 * `window.__editifyPdfPrint` — bind depuis renderer.js après __editifyPdfSave.bind().
 */
(function () {
  "use strict";

  /**
   * @typedef {object} PdfPrintDeps
   * @property {() => { path?: string, id?: string } | null} getActiveTab
   * @property {(outputPath: string) => Promise<{ ok?: boolean, error?: string }>} exportActivePdfToPath
   * @property {(msg: string) => void} setStatus
   * @property {(key: string) => string} t
   */

  /** @type {PdfPrintDeps | null} */
  let deps = null;

  /** @returns {PdfPrintDeps} */
  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyPdfPrint.bind() doit être appelé depuis renderer.js après __editifyPdfSave.bind()."
      );
    }
    return deps;
  }

  /** @param {PdfPrintDeps} next */
  function bind(next) {
    deps = next;
  }

  function logPrint(step, payload = {}) {
    try {
      window.maniPdfApi?.logEvent?.({
        level: /fail|error|exception|abort/i.test(String(step)) ? "error" : "info",
        scope: "print",
        message: String(step),
        data: { step, ...payload }
      });
    } catch {
      /* intentional: print log best-effort */
    }
  }

  /**
   * Alloue un temp print côté main, bake (apply_annotations), ouvre le dialogue OS.
   * Annotations vides = OK (copie PDF baked sans surimpression).
   */
  async function printActivePdf() {
    const d = requireDeps();
    logPrint("print_start", {});
    try {
      const tab = d.getActiveTab();
      if (!tab?.path) {
        logPrint("print_abort", { reason: "no_active_pdf" });
        d.setStatus(d.t("stPrintNoPdf"));
        return { ok: false, error: "no_active_pdf" };
      }

      d.setStatus(d.t("stPrinting"));

      const alloc = await window.maniPdfApi.allocatePrintTempPath();
      if (!alloc?.ok || !alloc.path) {
        const err = alloc?.error || d.t("stPrintFailed");
        logPrint("print_abort", { reason: "alloc_failed", error: err });
        d.setStatus(err);
        return { ok: false, error: err };
      }

      const tempPath = String(alloc.path);
      // Garde renderer : ne jamais accepter un path hors editradoc-print.
      if (!String(tempPath).toLowerCase().includes("editradoc-print")) {
        logPrint("print_abort", { reason: "temp_path_not_in_print_dir", tempPath });
        await window.maniPdfApi.discardPrintTempPath(tempPath);
        d.setStatus(d.t("stPrintFailed"));
        return { ok: false, error: "temp_path_rejected" };
      }

      // Bake = même pipeline qu'Enregistrer sous (annotations vides OK).
      const exportResult = await d.exportActivePdfToPath(tempPath);
      if (!exportResult?.ok) {
        logPrint("print_abort", {
          reason: "bake_failed",
          error: exportResult?.error || null
        });
        await window.maniPdfApi.discardPrintTempPath(tempPath);
        if (exportResult?.error === "image_encode_failed") {
          d.setStatus(d.t("stExportImageEncodeFailed"));
        } else {
          d.setStatus(exportResult?.error || d.t("stPrintFailed"));
        }
        return { ok: false, error: exportResult?.error || "bake_failed" };
      }

      logPrint("print_bake_ok", { tempPath });

      const printResult = await window.maniPdfApi.printBakedPdf({ path: tempPath });
      if (printResult?.printed) {
        logPrint("print_success", { tempRemoved: printResult.tempRemoved });
        d.setStatus(d.t("stPrinted"));
        return {
          ok: true,
          printed: true,
          tempRemoved: Boolean(printResult.tempRemoved),
          tempPath
        };
      }

      // Annulation dialogue / mock E2E / timeout : toujours considérer le cleanup.
      logPrint("print_done", {
        printed: false,
        canceledOrFailed: Boolean(printResult?.canceledOrFailed),
        e2eMock: Boolean(printResult?.e2eMock),
        tempRemoved: printResult?.tempRemoved,
        error: printResult?.error || null
      });
      if (printResult?.e2eMock) {
        d.setStatus(d.t("stPrinted"));
        return {
          ok: true,
          printed: false,
          e2eMock: true,
          tempRemoved: Boolean(printResult?.tempRemoved),
          tempPath
        };
      }
      if (printResult?.ok === false) {
        d.setStatus(printResult?.error || d.t("stPrintFailed"));
        return { ok: false, error: printResult?.error || "print_failed", tempPath };
      }
      d.setStatus(d.t("stPrintCancelled"));
      return {
        ok: true,
        printed: false,
        canceledOrFailed: true,
        tempRemoved: Boolean(printResult?.tempRemoved),
        tempPath
      };
    } catch (error) {
      const err = String(error?.message || error);
      logPrint("print_exception", { error: err });
      d.setStatus(`${d.t("stPrintFailed")}: ${err}`);
      return { ok: false, error: err };
    }
  }

  window.__editifyPdfPrint = {
    bind,
    printActivePdf,
    moduleId: "renderer-pdf-print"
  };
})();
