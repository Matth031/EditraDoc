/**
 * UI vérification de mise à jour (bandeau + menu Options).
 * `window.__editifyUpdateUi`
 */
(function () {
  "use strict";

  /**
   * @typedef {object} UpdateUiDeps
   * @property {HTMLElement | null} updateAvailableBanner
   * @property {HTMLElement | null} updateBannerText
   * @property {HTMLElement | null} updateBannerDownloadBtn
   * @property {HTMLElement | null} updateBannerDismissBtn
   * @property {HTMLElement | null} toolbarCheckUpdatesMenuItem
   * @property {HTMLElement | null} toolbarCheckUpdatesStartupBtn
   * @property {(key: string) => string} t
   * @property {(msg: string) => void} setStatus
   * @property {{ closeAllFlyoutMenus: () => void }} chrome
   */

  /** @type {UpdateUiDeps | null} */
  let deps = null;
  /** @type {object | null} */
  let lastStatus = null;
  let bannerDismissed = false;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] __editifyUpdateUi.bind() requis depuis renderer.js.");
    }
    return deps;
  }

  /** @param {UpdateUiDeps} next */
  function bind(next) {
    deps = next;
  }

  function applyStartupToggleUi(enabled) {
    const d = requireDeps();
    if (!d.toolbarCheckUpdatesStartupBtn) return;
    d.toolbarCheckUpdatesStartupBtn.setAttribute("aria-checked", enabled ? "true" : "false");
    d.toolbarCheckUpdatesStartupBtn.classList.toggle("menu-item-checked", Boolean(enabled));
  }

  function hideBanner() {
    const d = requireDeps();
    d.updateAvailableBanner?.classList.add("hidden");
  }

  function showBanner(status) {
    const d = requireDeps();
    if (!d.updateAvailableBanner || !status?.updateAvailable || bannerDismissed) {
      hideBanner();
      return;
    }
    const remote = String(status.remoteVersion || "");
    if (d.updateBannerText) {
      d.updateBannerText.textContent = d.t("stUpdateAvailable").replace("{{version}}", remote);
    }
    if (d.updateBannerDownloadBtn) {
      d.updateBannerDownloadBtn.textContent = d.t("stUpdateDownload");
      d.updateBannerDownloadBtn.dataset.downloadUrl = String(status.downloadUrl || "");
    }
    d.updateAvailableBanner.classList.remove("hidden");
  }

  /** @param {object | null | undefined} status */
  function applyStatus(status) {
    if (!status) return;
    lastStatus = status;
    if (status.updateAvailable) {
      showBanner(status);
    } else {
      hideBanner();
    }
  }

  async function refreshSettingsUi() {
    try {
      const res = await window.maniPdfApi?.getUpdateSettings?.();
      if (res?.ok) {
        applyStartupToggleUi(Boolean(res.settings?.checkUpdatesOnStartup));
      }
    } catch (error) {
      globalThis.__editifyReportWarn?.("update:getSettings", String(error?.message || error));
    }
  }

  async function refreshStatusFromMain() {
    try {
      const res = await window.maniPdfApi?.getUpdateStatus?.();
      if (res?.ok) applyStatus(res.status);
    } catch (error) {
      globalThis.__editifyReportWarn?.("update:getStatus", String(error?.message || error));
    }
  }

  async function runManualCheck() {
    const d = requireDeps();
    d.chrome.closeAllFlyoutMenus();
    d.setStatus(d.t("stUpdateChecking"));
    try {
      const res = await window.maniPdfApi?.checkForUpdatesNow?.();
      if (!res?.ok) {
        d.setStatus(d.t("stUpdateCheckFailed"));
        return;
      }
      applyStatus(res.status);
      if (res.status?.updateAvailable) {
        d.setStatus(
          d.t("stUpdateAvailable").replace("{{version}}", res.status.remoteVersion || "")
        );
      } else if (res.status?.ok !== false) {
        d.setStatus(d.t("stUpdateUpToDate"));
      } else {
        d.setStatus(d.t("stUpdateCheckFailed"));
      }
    } catch {
      d.setStatus(d.t("stUpdateCheckFailed"));
    }
  }

  async function toggleStartupCheck() {
    const d = requireDeps();
    d.chrome.closeAllFlyoutMenus();
    try {
      const current = await window.maniPdfApi?.getUpdateSettings?.();
      const enabled = !current?.settings?.checkUpdatesOnStartup;
      const res = await window.maniPdfApi?.setUpdateSettings?.({ checkUpdatesOnStartup: enabled });
      if (res?.ok) {
        applyStartupToggleUi(Boolean(res.settings?.checkUpdatesOnStartup));
        d.setStatus(enabled ? d.t("stUpdateStartupEnabled") : d.t("stUpdateStartupDisabled"));
      }
    } catch {
      d.setStatus(d.t("stUpdateCheckFailed"));
    }
  }

  async function openDownloadUrl() {
    const d = requireDeps();
    const url =
      d.updateBannerDownloadBtn?.dataset?.downloadUrl ||
      lastStatus?.downloadUrl ||
      "https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe";
    try {
      const r = await window.maniPdfApi?.openExternal?.(url);
      if (!r?.ok) d.setStatus(d.t("stLinkOpenFailed"));
    } catch {
      d.setStatus(d.t("stLinkOpenFailed"));
    }
  }

  function wireOnce() {
    const d = requireDeps();
    if (d.updateAvailableBanner?.dataset?.wired === "1") return;
    if (d.updateAvailableBanner) d.updateAvailableBanner.dataset.wired = "1";

    d.toolbarCheckUpdatesMenuItem?.addEventListener("click", () => {
      runManualCheck();
    });
    d.toolbarCheckUpdatesStartupBtn?.addEventListener("click", () => {
      toggleStartupCheck();
    });
    d.updateBannerDownloadBtn?.addEventListener("click", () => {
      openDownloadUrl();
    });
    d.updateBannerDismissBtn?.addEventListener("click", () => {
      bannerDismissed = true;
      hideBanner();
    });

    window.maniPdfApi?.onUpdateStatusChanged?.((status) => {
      applyStatus(status);
    });
  }

  async function init() {
    wireOnce();
    await refreshSettingsUi();
    await refreshStatusFromMain();
  }

  window.__editifyUpdateUi = {
    bind,
    init,
    applyStatus,
    refreshSettingsUi
  };
})();
