const { contextBridge, ipcRenderer } = require("electron");

/**
 * Bypass dialogue natif en E2E si une variable d'environnement est définie.
 * @param {string} envVarName
 * @param {string} ipcChannel
 * @param {unknown} [ipcArg]
 */
function openDialogOrE2eBypass(envVarName, ipcChannel, ipcArg) {
  try {
    const e2ePath = process?.env?.[envVarName];
    if (e2ePath && typeof e2ePath === "string") {
      return Promise.resolve({ ok: true, path: e2ePath });
    }
  } catch {
    /* ignore */
  }
  return ipcArg === undefined
    ? ipcRenderer.invoke(ipcChannel)
    : ipcRenderer.invoke(ipcChannel, ipcArg);
}

// API minimale exposée au renderer (contextIsolation) - pas de require("fs") côté UI.
contextBridge.exposeInMainWorld("maniPdfApi", {
  isE2E: () => {
    try {
      return Boolean(process?.env?.MANI_PDF_E2E);
    } catch {
      return false;
    }
  },
  openPdf: (path) => ipcRenderer.invoke("pdf:open", path),
  readPdfBytes: (path) => ipcRenderer.invoke("pdf:read-bytes", path),
  openPdfDialog: () => openDialogOrE2eBypass("MANI_PDF_E2E_PDF_PATH", "dialog:openPdf"),
  saveSession: (payload) => ipcRenderer.invoke("session:save", payload),
  loadSession: () => ipcRenderer.invoke("session:load"),
  savePdfAsDialog: (suggestedName) =>
    openDialogOrE2eBypass("MANI_PDF_E2E_SAVE_AS_PATH", "dialog:savePdfAs", suggestedName),
  exportPdfWithAnnotations: (payload) => ipcRenderer.invoke("pdf:export-with-annotations", payload),
  createJob: (input) => ipcRenderer.invoke("job:create", input),
  listJobs: () => ipcRenderer.invoke("job:list"),
  pythonHealth: () => ipcRenderer.invoke("python:health"),
  cancelJob: (id) => ipcRenderer.invoke("job:cancel", id),
  retryJob: (id) => ipcRenderer.invoke("job:retry", id),
  listSensitiveActions: () => ipcRenderer.invoke("sensitive:list"),
  log: (message, data) => ipcRenderer.invoke("log:renderer", { message, data }),
  onOpenFromMenu: (cb) => ipcRenderer.on("pdf:open-from-menu", (_, path) => cb(path)),
  onSetLanguage: (cb) => ipcRenderer.on("app:set-language", (_, lang) => cb(lang)),
  onAutosaveRequested: (cb) => ipcRenderer.on("session:autosave-requested", cb),
  onSaveAsRequested: (cb) => ipcRenderer.on("pdf:save-as-requested", cb),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  getWindowFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  onFullscreenChanged: (cb) => ipcRenderer.on("window:fullscreen-changed", (_, full) => cb(full)),
  onToolbarF10Toggle: (cb) => ipcRenderer.on("toolbar:f10-toggle", () => cb()),
  onPdfToolAction: (cb) => ipcRenderer.on("app:pdf-tool", (_, action) => cb(action)),
  onHtmlToPdfRequested: (cb) => ipcRenderer.on("app:html-to-pdf", () => cb()),
  openHtmlDialog: () => openDialogOrE2eBypass("MANI_PDF_E2E_HTML_PATH", "dialog:openHtml"),
  convertHtmlToPdf: (payload) => ipcRenderer.invoke("convert:html-to-pdf", payload),
  onAboutRequested: (cb) => ipcRenderer.on("app:about", () => cb()),
  onSessionLogRequested: (cb) => ipcRenderer.on("app:session-log", () => cb()),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  setSpellcheckLanguages: (langs) => ipcRenderer.invoke("spellcheck:set-languages", langs),
  spellcheckAnalyze: (payload) => ipcRenderer.invoke("spellcheck:analyze", payload),
  spellcheckAddWord: (word) => ipcRenderer.invoke("spellcheck:add-word", { word }),
  spellcheckRemoveWord: (word) => ipcRenderer.invoke("spellcheck:remove-word", { word }),
  spellcheckIsCustomWord: (word) => ipcRenderer.invoke("spellcheck:is-custom-word", { word })
});
