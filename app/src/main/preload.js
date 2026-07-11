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
  isExportAuditEnabled: () => {
    try {
      return process?.env?.EDITRADOC_EXPORT_AUDIT === "1";
    } catch {
      return false;
    }
  },
  openPdf: (path) => ipcRenderer.invoke("pdf:open", path),
  readPdfBytes: (path) => ipcRenderer.invoke("pdf:read-bytes", path),
  registerOpenPdfPath: (path) => ipcRenderer.invoke("pdf:register-open-path", path),
  unregisterOpenPdfPath: (path) => ipcRenderer.invoke("pdf:unregister-open-path", path),
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
  logEvent: (payload) => ipcRenderer.invoke("log:event", payload),
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
  onImagesToPdfRequested: (cb) => ipcRenderer.on("app:images-to-pdf", () => cb()),
  openHtmlDialog: () => openDialogOrE2eBypass("MANI_PDF_E2E_HTML_PATH", "dialog:openHtml"),
  convertHtmlToPdf: (payload) => ipcRenderer.invoke("convert:html-to-pdf", payload),
  openImagesDialog: () => {
    try {
      const raw = process?.env?.MANI_PDF_E2E_IMAGE_PATHS;
      if (raw && typeof raw === "string") {
        const paths = JSON.parse(raw);
        if (Array.isArray(paths) && paths.length && paths.every((p) => typeof p === "string")) {
          return Promise.resolve({ ok: true, paths });
        }
      }
    } catch {
      /* ignore */
    }
    return ipcRenderer.invoke("dialog:openImages");
  },
  convertImagesToPdf: (payload) => ipcRenderer.invoke("convert:images-to-pdf", payload),
  onAboutRequested: (cb) => ipcRenderer.on("app:about", () => cb()),
  onSessionLogRequested: (cb) => ipcRenderer.on("app:session-log", () => cb()),
  onLogFileSettingsRequested: (cb) => ipcRenderer.on("app:log-file-settings", () => cb()),
  getLogFileSettings: () => ipcRenderer.invoke("settings:get-log-file"),
  setLogFilePath: (path) => ipcRenderer.invoke("settings:set-log-file", { path }),
  resetLogFilePath: () => ipcRenderer.invoke("settings:set-log-file", { path: null }),
  notifyUiLanguage: (lang) => ipcRenderer.invoke("app:notify-ui-language", lang),
  chooseLogFileDialog: (currentPath, title) =>
    ipcRenderer.invoke("dialog:chooseLogFile", { currentPath, title }),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  getBuildInfo: () => ipcRenderer.invoke("app:get-build-info"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
  checkForUpdatesNow: () => ipcRenderer.invoke("update:check-now"),
  getUpdateSettings: () => ipcRenderer.invoke("update:get-settings"),
  setUpdateSettings: (payload) => ipcRenderer.invoke("update:set-settings", payload),
  onUpdateStatusChanged: (cb) => ipcRenderer.on("update:status-changed", (_, status) => cb(status)),
  setSpellcheckLanguages: (langs) => ipcRenderer.invoke("spellcheck:set-languages", langs),
  spellcheckAnalyze: (payload) => ipcRenderer.invoke("spellcheck:analyze", payload),
  spellcheckAddWord: (word) => ipcRenderer.invoke("spellcheck:add-word", { word }),
  spellcheckRemoveWord: (word) => ipcRenderer.invoke("spellcheck:remove-word", { word }),
  spellcheckIsCustomWord: (word) => ipcRenderer.invoke("spellcheck:is-custom-word", { word })
});
