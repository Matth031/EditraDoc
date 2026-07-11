/**
 * Modal Options → Fichier journal d'erreurs (chemin logs.txt configurable).
 * `window.__editifyLogFileSettingsUi`
 */
(function () {
  "use strict";

  /**
   * @typedef {object} LogFileSettingsUiDeps
   * @property {HTMLElement | null} logFileSettingsModal
   * @property {HTMLElement | null} logFileSettingsTitleEl
   * @property {HTMLElement | null} logFileSettingsHint
   * @property {HTMLElement | null} logFilePathDisplay
   * @property {HTMLElement | null} logFileDefaultPathDisplay
   * @property {HTMLElement | null} logFileEnvOverride
   * @property {HTMLElement | null} logFileBrowseBtn
   * @property {HTMLElement | null} logFileResetBtn
   * @property {HTMLElement | null} logFileCloseBtn
   * @property {HTMLElement | null} [toolbarLogFileMenuItem]
   * @property {(key: string) => string} t
   * @property {(msg: string) => void} setStatus
   * @property {{ closeAllFlyoutMenus: () => void }} chrome
   */

  /** @type {LogFileSettingsUiDeps | null} */
  let deps = null;
  let lastEnvOverridePath = null;

  function applyEnvOverrideLabel() {
    if (!deps?.logFileEnvOverride || !lastEnvOverridePath) return;
    deps.logFileEnvOverride.textContent = deps
      .t("logFileEnvOverride")
      .replace("{{path}}", lastEnvOverridePath);
  }

  async function refreshView() {
    if (!deps) return;
    const api = globalThis.maniPdfApi;
    if (!api?.getLogFileSettings) return;
    const info = await api.getLogFileSettings();
    if (!info?.ok) return;
    if (deps.logFilePathDisplay) deps.logFilePathDisplay.value = info.effectivePath || "";
    if (deps.logFileDefaultPathDisplay) {
      deps.logFileDefaultPathDisplay.textContent = info.defaultPath || "";
    }
    if (deps.logFileEnvOverride) {
      const env = info.envOverride;
      lastEnvOverridePath = env || null;
      if (env) {
        applyEnvOverrideLabel();
        deps.logFileEnvOverride.classList.remove("hidden");
      } else {
        deps.logFileEnvOverride.textContent = "";
        deps.logFileEnvOverride.classList.add("hidden");
      }
    }
    const readOnly = Boolean(info.envOverride);
    if (deps.logFileBrowseBtn) deps.logFileBrowseBtn.disabled = readOnly;
    if (deps.logFileResetBtn) deps.logFileResetBtn.disabled = readOnly;
  }

  async function open() {
    if (!deps?.logFileSettingsModal) return;
    await refreshView();
    deps.logFileSettingsModal.classList.remove("hidden");
    deps.logFileSettingsModal.setAttribute("aria-hidden", "false");
    try {
      deps.logFileCloseBtn?.focus?.();
    } catch {
      /* ignore */
    }
  }

  function close() {
    if (!deps?.logFileSettingsModal) return;
    deps.logFileSettingsModal.classList.add("hidden");
    deps.logFileSettingsModal.setAttribute("aria-hidden", "true");
  }

  async function onBrowse() {
    const api = globalThis.maniPdfApi;
    if (!api?.chooseLogFileDialog || !api?.setLogFilePath) return;
    const current = deps?.logFilePathDisplay?.value || "";
    const picked = await api.chooseLogFileDialog(current, deps?.t?.("logFileDialogTitle"));
    if (!picked?.ok) return;
    if (picked.cancelled) return;
    const saved = await api.setLogFilePath(picked.path);
    if (!saved?.ok) {
      deps?.setStatus?.(saved?.error || deps.t("logFileSaveError"));
      return;
    }
    deps?.setStatus?.(deps.t("logFileSaved"));
    await refreshView();
  }

  async function onReset() {
    const api = globalThis.maniPdfApi;
    if (!api?.resetLogFilePath) return;
    const saved = await api.resetLogFilePath();
    if (!saved?.ok) {
      deps?.setStatus?.(saved?.error || deps.t("logFileSaveError"));
      return;
    }
    deps?.setStatus?.(deps.t("logFileResetDone"));
    await refreshView();
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onDocumentKeydown(e) {
    if (e.key !== "Escape") return;
    if (!deps?.logFileSettingsModal || deps.logFileSettingsModal.classList.contains("hidden"))
      return;
    close();
  }

  function applyLanguage() {
    applyEnvOverrideLabel();
  }

  /**
   * @param {LogFileSettingsUiDeps} next
   */
  function bind(next) {
    deps = next;
    next.toolbarLogFileMenuItem?.addEventListener?.("click", () => {
      next.chrome.closeAllFlyoutMenus();
      void open();
    });
    next.logFileCloseBtn?.addEventListener?.("click", () => close());
    next.logFileBrowseBtn?.addEventListener?.("click", () => {
      void onBrowse();
    });
    next.logFileResetBtn?.addEventListener?.("click", () => {
      void onReset();
    });
    next.logFileSettingsModal
      ?.querySelector?.("[data-log-file-settings-dismiss]")
      ?.addEventListener?.("click", () => close());
    document.addEventListener("keydown", onDocumentKeydown);
  }

  globalThis.__editifyLogFileSettingsUi = {
    bind,
    open,
    close,
    refreshView,
    applyLanguage
  };
})();
