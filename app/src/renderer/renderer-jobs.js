/**
 * File d'attente IPC (`maniPdfApi`), suivi jobs / actions sensibles (journal session + toasts).
 * `window.__editifyJobs` - `bind()` depuis `renderer.js` après `getActiveTab` / `setStatus`, avant `__editifySplitWorkspace.bind()`
 */
(function () {
  "use strict";

  /**
   * @typedef {object} JobsDeps
   * @property {{ append: (o: { category: string, message: string }) => void } | null} sessionLog
   * @property {(key: string, vars?: Record<string, string>) => string} [tr]
   * @property {(msg: string) => void} [showToastBrief]
   * @property {(key: string) => string} t
   * @property {(msg: string) => void} setStatus
   * @property {{ tabs: Array<{ path: string }> }} state
   * @property {() => object | null} getActiveTab
   * @property {() => void} openSplitWorkspace
   */

  /** @type {JobsDeps | null} */
  let deps = null;

  /** @type {Map<string, string>} */
  let jobStatusById = new Map();
  let jobsReady = false;

  const sensitiveSeen = new Set();
  let sensitiveReady = false;

  function bind(next) {
    deps = next;
  }

  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyJobs.bind() doit être appelé depuis renderer.js avant toute opération."
      );
    }
    return deps;
  }

  function buildDefaultOutputPath(basePath, suffix) {
    const dot = basePath.lastIndexOf(".");
    if (dot < 0) return `${basePath}-${suffix}.pdf`;
    return `${basePath.slice(0, dot)}-${suffix}${basePath.slice(dot)}`;
  }

  /**
   * @param {unknown} a
   */
  function sensitiveKey(a) {
    if (!a || typeof a !== "object") return "";
    const o = /** @type {Record<string, unknown>} */ (a);
    return `${o.ts}|${o.type}|${o.status}|${o.inputPath}|${o.outputPath}`;
  }

  function renderJobList(jobList) {
    const d = requireDeps();
    const list = Array.isArray(jobList) ? jobList : [];

    const sl = d.sessionLog;
    const tr = d.tr;
    const toast = d.showToastBrief;

    if (!jobsReady) {
      for (const j of list) {
        jobStatusById.set(j.id, j.status);
      }
      jobsReady = true;
      return;
    }

    const seen = new Set();
    for (const j of list) {
      seen.add(j.id);
      const prev = jobStatusById.get(j.id);
      const st = j.status;
      if (prev === undefined) {
        jobStatusById.set(j.id, st);
        if (sl && tr) {
          sl.append({
            category: "job",
            message: tr("logJobNew", {
              type: String(j.type),
              status: String(st),
              progress: String(j.progress ?? 0)
            })
          });
        }
      } else if (prev !== st) {
        jobStatusById.set(j.id, st);
        if (sl && tr) {
          sl.append({
            category: "job",
            message: tr("logJobStatusChange", {
              type: String(j.type),
              prev: String(prev),
              status: String(st),
              progress: String(j.progress ?? 0)
            })
          });
        }
        if (toast && tr) {
          if (st === "completed") {
            toast(tr("logJobCompleted", { type: String(j.type) }));
          } else if (st === "failed") {
            toast(tr("logJobFailed", { type: String(j.type), error: String(j.error || "?") }));
          } else if (st === "cancelled") {
            toast(tr("logJobCancelled", { type: String(j.type) }));
          }
        }
      }
    }
    for (const id of jobStatusById.keys()) {
      if (!seen.has(id)) jobStatusById.delete(id);
    }
  }

  async function refreshJobs() {
    const result = await window.maniPdfApi.listJobs();
    if (result.ok) renderJobList(result.jobs);
  }

  function renderSensitiveActions(actions) {
    const d = requireDeps();
    const list = Array.isArray(actions) ? actions : [];

    const sl = d.sessionLog;
    const tr = d.tr;
    if (!sl || !tr) {
      if (!sensitiveReady) {
        for (const a of list) {
          sensitiveSeen.add(sensitiveKey(a));
        }
        sensitiveReady = true;
      }
      return;
    }

    if (!sensitiveReady) {
      for (const a of list) {
        sensitiveSeen.add(sensitiveKey(a));
      }
      sensitiveReady = true;
      return;
    }

    for (const a of list) {
      const k = sensitiveKey(a);
      if (!sensitiveSeen.has(k)) {
        sensitiveSeen.add(k);
        sl.append({
          category: "sensitive",
          message: tr("logSensitiveEntry", {
            type: String(a.type),
            status: String(a.status),
            path: `${a.inputPath || "-"} → ${a.outputPath || "-"}`
          })
        });
      }
    }
  }

  async function refreshSensitiveActions() {
    const result = await window.maniPdfApi.listSensitiveActions();
    if (result.ok) renderSensitiveActions(result.actions);
  }

  async function refreshPythonHealth() {
    const d = requireDeps();
    const result = await window.maniPdfApi.pythonHealth();
    if (!result.ok) {
      d.setStatus(d.t("stPythonUnavailable"));
      return;
    }
    if (result.pypdf === false) {
      d.setStatus(d.t("stPythonMissingPypdf"));
    }
  }

  /**
   * @returns {Promise<boolean>} true si le job est accepté
   */
  async function enqueuePdfJob(type, payload, successStatus) {
    const d = requireDeps();
    const r = await window.maniPdfApi.createJob({ type, payload });
    if (!r?.ok) {
      const msg = typeof r?.error === "string" && r.error ? r.error : d.t("stJobRefused");
      d.setStatus(msg);
      return false;
    }
    d.setStatus(successStatus);
    await refreshJobs();
    return true;
  }

  async function createMergeJob() {
    const d = requireDeps();
    const pdfTabs = d.state.tabs.map((tab) => tab.path);
    if (pdfTabs.length < 2) {
      d.setStatus(d.t("stMergeNeedTwo"));
      return;
    }
    const outputPath = buildDefaultOutputPath(pdfTabs[0], "merged");
    await enqueuePdfJob(
      "merge",
      { inputs: pdfTabs, output_path: outputPath },
      d.t("stMergeJobAdded")
    );
  }

  function createSplitJob() {
    requireDeps().openSplitWorkspace();
  }

  window.__editifyJobs = {
    bind,
    buildDefaultOutputPath,
    enqueuePdfJob,
    refreshJobs,
    refreshSensitiveActions,
    refreshPythonHealth,
    createMergeJob,
    createSplitJob
  };
})();
