/**
 * Coque UI : barre d’outils HTML, menus Fichier/Options/Outils PDF, popover À propos, menu contextuel canvas vierge.
 * `window.__editifyAppChrome` - `bind()` depuis `renderer.js` après `__editifyPdfSave.bind()` pour fournir `promptOpenPdf` / `savePdfAs`.
 */
(function () {
  "use strict";

  /**
   * @typedef {object} ChromeDeps
   * @property {HTMLElement | null} blankCanvasCtxMenu
   * @property {HTMLElement | null} aboutPopover
   * @property {HTMLElement | null} toolbarAboutBtn
   * @property {HTMLElement | null} toolbarOptionsBtn
   * @property {HTMLElement | null} aboutVersion
   * @property {HTMLElement | null} appToolbar
   * @property {HTMLElement | null} pdfToolsBtn
   * @property {HTMLElement | null} pdfToolsMenu
   * @property {HTMLElement | null} toolbarFileBtn
   * @property {HTMLElement | null} toolbarFileMenu
   * @property {HTMLElement | null} toolbarOptionsMenu
   * @property {HTMLElement | null} welcomeOpenPdfBtn
   * @property {HTMLElement | null} toolbarOpenPdfBtn
   * @property {HTMLElement | null} toolbarSaveAsBtn
   * @property {HTMLElement | null} toolbarQuitBtn
   * @property {HTMLElement | null} toolbarCloseBtn
   * @property {HTMLElement | null} toolbarAboutMenuItem
   * @property {HTMLElement | null} aboutCloseBtn
   * @property {() => object | null} getActiveTab
   * @property {(e: Event) => void} capturePointerInPage
   * @property {(n: number, lo: number, hi: number) => number} clamp
   * @property {() => void} hideChangesContextMenu
   * @property {typeof import("./renderer-text-ctx-menu.js")} tcm
   * @property {typeof import("./renderer-shape-image-ctx-menu.js")} sim
   * @property {(msg: string) => void} setStatus
   * @property {(key: string) => string} t
   * @property {() => Promise<void>} promptOpenPdf
   * @property {() => Promise<void>} savePdfAs
   * @property {(lang: string) => void} setLanguage
   * @property {(label: string, extra?: Record<string, unknown>) => void} logText
   */

  /** @type {ChromeDeps | null} */
  let deps = null;

  let wired = false;

  /** @param {ChromeDeps} next */
  function bind(next) {
    deps = next;
    if (!wired) {
      wired = true;
      wireChromeListenersOnce();
    }
  }

  function requireDeps() {
    if (!deps) {
      throw new Error(
        "[editify] __editifyAppChrome.bind() doit être appelé depuis renderer.js avant toute interaction."
      );
    }
    return deps;
  }

  let electronWindowFullscreen = false;
  let htmlToolbarF10Flip = false;

  function hideBlankCanvasCtxMenu() {
    try {
      requireDeps().blankCanvasCtxMenu?.classList?.add?.("hidden");
    } catch {
      /* intentional: hide blank canvas ctx menu best-effort */
    }
  }

  function showBlankCanvasCtxMenu(event) {
    const d = requireDeps();
    if (!d.blankCanvasCtxMenu) return;
    const tab = d.getActiveTab();
    if (!tab) return;
    if (event?.target?.closest?.(".annotation")) return;
    if (!event?.target?.closest?.(".viewer")) return;
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch {
      /* intentional: event preventDefault stopPropagation best-effort */
    }
    d.capturePointerInPage(event);
    closeAllFlyoutMenus();
    d.hideChangesContextMenu();
    d.tcm.hideTextAnnotationCtxMenu();
    d.sim.hideShapeAnnotationCtxMenu();
    d.sim.hideImageAnnotationCtxMenu();
    try {
      const menuW = 240;
      const menuH = 160;
      const margin = 10;
      const x = d.clamp((event.clientX ?? 0) + 2, margin, window.innerWidth - menuW - margin);
      const y = d.clamp((event.clientY ?? 0) + 2, margin, window.innerHeight - menuH - margin);
      d.blankCanvasCtxMenu.style.left = `${x}px`;
      d.blankCanvasCtxMenu.style.top = `${y}px`;
    } catch {
      /* intentional: blank canvas menu position clamp best-effort */
    }
    d.blankCanvasCtxMenu.classList.remove("hidden");
  }

  function hideAboutPopover() {
    try {
      requireDeps().aboutPopover?.classList?.add?.("hidden");
    } catch {
      /* intentional: hide about popover DOM best-effort */
    }
  }

  function wireAboutExternalLinksOnce() {
    const d = requireDeps();
    if (!d.aboutPopover) return;
    if (d.aboutPopover.dataset.wiredLinks === "1") return;
    d.aboutPopover.dataset.wiredLinks = "1";
    d.aboutPopover.addEventListener("click", async (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const r = await window.maniPdfApi?.openExternal?.(href);
        if (!r?.ok) {
          d.setStatus(d.t("stLinkOpenFailed"));
        }
      } catch {
        d.setStatus(d.t("stLinkOpenFailed"));
      }
    });
  }

  async function refreshAboutVersionLabel() {
    const d = requireDeps();
    if (!d.aboutVersion) return;
    try {
      const info = await window.maniPdfApi?.getBuildInfo?.();
      const version = String(info?.version || "").trim();
      if (version) {
        d.aboutVersion.textContent = `v${version}`;
        return;
      }
    } catch {
      /* intentional: about version IPC fetch falls back */
    }
    d.aboutVersion.textContent = "v?";
  }

  function showAboutPopover() {
    const d = requireDeps();
    if (!d.aboutPopover || !d.toolbarAboutBtn) return;
    refreshAboutVersionLabel();
    closeAllFlyoutMenus();
    const r = d.toolbarAboutBtn.getBoundingClientRect();
    const margin = 10;
    const x = d.clamp(Math.floor(r.left), margin, window.innerWidth - 520 - margin);
    const y = d.clamp(Math.floor(r.bottom + 8), margin, window.innerHeight - 220 - margin);
    d.aboutPopover.style.left = `${x}px`;
    d.aboutPopover.style.top = `${y}px`;
    d.aboutPopover.classList.remove("hidden");
    wireAboutExternalLinksOnce();
  }

  function showAboutPopoverNearOptions() {
    const d = requireDeps();
    if (!d.aboutPopover || !d.toolbarOptionsBtn) return;
    refreshAboutVersionLabel();
    closeAllFlyoutMenus();
    const r = d.toolbarOptionsBtn.getBoundingClientRect();
    const margin = 10;
    const x = d.clamp(Math.floor(r.left), margin, window.innerWidth - 520 - margin);
    const y = d.clamp(Math.floor(r.bottom + 8), margin, window.innerHeight - 220 - margin);
    d.aboutPopover.style.left = `${x}px`;
    d.aboutPopover.style.top = `${y}px`;
    d.aboutPopover.classList.remove("hidden");
    wireAboutExternalLinksOnce();
  }

  function pointerEventInsideElementBox(event, el) {
    try {
      if (!el || el.classList.contains("hidden")) return false;
      const r = el.getBoundingClientRect();
      const x = event.clientX ?? 0;
      const y = event.clientY ?? 0;
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    } catch {
      return false;
    }
  }

  function eventTargetsManiColorModal(event) {
    try {
      if (event.target?.closest?.("#maniColorModal")) return true;
      const path = event.composedPath?.() || [];
      for (const n of path) {
        if (n instanceof Element && (n.id === "maniColorModal" || n.closest?.("#maniColorModal")))
          return true;
      }
    } catch {
      /* intentional: composedPath color modal hit check */
    }
    return false;
  }

  function htmlToolbarShouldBeVisible() {
    return electronWindowFullscreen !== htmlToolbarF10Flip;
  }

  function updateAppToolbarDom() {
    const d = requireDeps();
    if (!d.appToolbar) {
      return;
    }
    const visible = htmlToolbarShouldBeVisible();
    d.appToolbar.classList.toggle("hidden", !visible);
    if (!visible) {
      try {
        closeAllFlyoutMenus();
      } catch {
        /* intentional: close flyouts when toolbar hidden */
      }
    }
  }

  function toggleHtmlToolbarF10() {
    htmlToolbarF10Flip = !htmlToolbarF10Flip;
    updateAppToolbarDom();
  }

  async function syncFullscreenFromMain() {
    try {
      const r = await window.maniPdfApi?.getWindowFullscreen?.();
      electronWindowFullscreen = Boolean(r?.full);
    } catch (error) {
      globalThis.__editifyReportWarn?.("chrome:fullscreen-sync", String(error?.message || error));
    }
    updateAppToolbarDom();
  }

  function closeToolbarFileMenu() {
    const d = requireDeps();
    if (!d.toolbarFileMenu || !d.toolbarFileBtn) return;
    d.toolbarFileMenu.classList.add("hidden");
    d.toolbarFileBtn.setAttribute("aria-expanded", "false");
  }

  function closeToolbarOptionsMenu() {
    const d = requireDeps();
    if (!d.toolbarOptionsMenu || !d.toolbarOptionsBtn) return;
    d.toolbarOptionsMenu.classList.add("hidden");
    d.toolbarOptionsBtn.setAttribute("aria-expanded", "false");
  }

  function closePdfToolsMenu() {
    const d = requireDeps();
    if (!d.pdfToolsMenu || !d.pdfToolsBtn) return;
    d.pdfToolsMenu.classList.add("hidden");
    d.pdfToolsBtn.setAttribute("aria-expanded", "false");
  }

  /** Ferme uniquement les menus déroulants Fichier / Options / Outils PDF (barre du haut). */
  function closeToolbarDropdownMenus() {
    closePdfToolsMenu();
    closeToolbarFileMenu();
    closeToolbarOptionsMenu();
  }

  function closeAllFlyoutMenus() {
    const d = requireDeps();
    closeToolbarDropdownMenus();
    d.hideChangesContextMenu();
    hideBlankCanvasCtxMenu();
    d.tcm.hideTextAnnotationCtxMenu();
    d.sim.hideShapeAnnotationCtxMenu();
    d.sim.hideImageAnnotationCtxMenu();
  }

  function togglePdfToolsMenu() {
    const d = requireDeps();
    if (!d.pdfToolsMenu || !d.pdfToolsBtn) return;
    const isOpen = !d.pdfToolsMenu.classList.contains("hidden");
    if (isOpen) {
      closePdfToolsMenu();
      return;
    }
    closeToolbarFileMenu();
    closeToolbarOptionsMenu();
    d.pdfToolsMenu.classList.remove("hidden");
    d.pdfToolsBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      try {
        d.pdfToolsMenu.querySelector("button[role='menuitem']")?.focus?.();
      } catch {
        /* intentional: pdf tools menu first item focus */
      }
    });
  }

  function toggleToolbarFileMenu() {
    const d = requireDeps();
    if (!d.toolbarFileMenu || !d.toolbarFileBtn) return;
    const isOpen = !d.toolbarFileMenu.classList.contains("hidden");
    if (isOpen) {
      closeToolbarFileMenu();
      return;
    }
    closePdfToolsMenu();
    closeToolbarOptionsMenu();
    d.toolbarFileMenu.classList.remove("hidden");
    d.toolbarFileBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      try {
        d.toolbarFileMenu.querySelector("button[role='menuitem']")?.focus?.();
      } catch {
        /* intentional: file menu first item focus best-effort */
      }
    });
  }

  function toggleToolbarOptionsMenu() {
    const d = requireDeps();
    if (!d.toolbarOptionsMenu || !d.toolbarOptionsBtn) return;
    const isOpen = !d.toolbarOptionsMenu.classList.contains("hidden");
    if (isOpen) {
      closeToolbarOptionsMenu();
      return;
    }
    closePdfToolsMenu();
    closeToolbarFileMenu();
    d.toolbarOptionsMenu.classList.remove("hidden");
    d.toolbarOptionsBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      try {
        d.toolbarOptionsMenu.querySelector("button[role='menuitem']")?.focus?.();
      } catch {
        /* intentional: options menu first item focus best-effort */
      }
    });
  }

  async function quitApplication() {
    try {
      await window.maniPdfApi?.quitApp?.();
    } catch {
      try {
        window.close();
      } catch {
        /* intentional: window.close quit fallback best-effort */
      }
    }
  }

  function wireChromeListenersOnce() {
    document.addEventListener(
      "contextmenu",
      (e) => {
        try {
          if (
            e.target?.closest?.(
              "#textAnnotationCtxMenu,#shapeAnnotationCtxMenu,#imageAnnotationCtxMenu,#changesContextMenu,#maniColorModal"
            )
          )
            return;
          showBlankCanvasCtxMenu(e);
        } catch {
          /* intentional: blank canvas contextmenu handler best-effort */
        }
      },
      true
    );

    document.addEventListener(
      "mousedown",
      (e) => {
        if (e.button !== 0) return;
        const d = requireDeps();
        const inManiColor = eventTargetsManiColorModal(e);
        const textCtxEl = document.getElementById("textAnnotationCtxMenu");
        const shapeCtxEl = document.getElementById("shapeAnnotationCtxMenu");
        const imageCtxEl = document.getElementById("imageAnnotationCtxMenu");
        const blankCtxEl = document.getElementById("blankCanvasCtxMenu");
        const changesEl = document.getElementById("changesContextMenu");

        if (
          !e.target?.closest?.("#changesContextMenu") &&
          !pointerEventInsideElementBox(e, changesEl)
        )
          d.hideChangesContextMenu();
        if (
          !e.target?.closest?.("#textAnnotationCtxMenu") &&
          !pointerEventInsideElementBox(e, textCtxEl) &&
          !inManiColor
        ) {
          d.tcm.hideTextAnnotationCtxMenu();
        }
        if (
          !e.target?.closest?.("#shapeAnnotationCtxMenu") &&
          !pointerEventInsideElementBox(e, shapeCtxEl) &&
          !inManiColor
        ) {
          try {
            d.logText("ctxShapeDismissMouseDown", {
              tag: e.target?.nodeName,
              id: e.target?.id,
              x: e.clientX,
              y: e.clientY,
              inMenuBox: pointerEventInsideElementBox(e, shapeCtxEl),
              inManiColor
            });
          } catch {
            /* intentional: shape dismiss debug log best-effort */
          }
          d.sim.hideShapeAnnotationCtxMenu();
        }
        if (
          !e.target?.closest?.("#imageAnnotationCtxMenu") &&
          !pointerEventInsideElementBox(e, imageCtxEl) &&
          !inManiColor
        ) {
          d.sim.hideImageAnnotationCtxMenu();
        }
        if (
          !e.target?.closest?.("#blankCanvasCtxMenu") &&
          !pointerEventInsideElementBox(e, blankCtxEl)
        )
          hideBlankCanvasCtxMenu();
        if (!e.target?.closest?.("#aboutPopover") && e.target !== d.toolbarAboutBtn)
          hideAboutPopover();
      },
      true
    );

    document.addEventListener("click", (e) => {
      const inside =
        e.target?.closest?.("#pdfToolsMenu") ||
        e.target?.closest?.("#pdfToolsBtn") ||
        e.target?.closest?.("#toolbarFileMenu") ||
        e.target?.closest?.("#toolbarFileBtn") ||
        e.target?.closest?.("#toolbarOptionsMenu") ||
        e.target?.closest?.("#toolbarOptionsBtn");
      if (inside) return;
      closeToolbarDropdownMenus();
    });

    const d0 = requireDeps();
    d0.pdfToolsBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePdfToolsMenu();
    });
    d0.toolbarFileBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleToolbarFileMenu();
    });
    d0.toolbarOptionsBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleToolbarOptionsMenu();
    });
    const openPdfFromUi = (e) => {
      e.preventDefault();
      closeAllFlyoutMenus();
      void d0.promptOpenPdf();
    };
    d0.welcomeOpenPdfBtn?.addEventListener?.("click", openPdfFromUi);
    d0.toolbarOpenPdfBtn?.addEventListener?.("click", openPdfFromUi);
    d0.toolbarSaveAsBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      closeAllFlyoutMenus();
      d0.savePdfAs().catch((error) => {
        globalThis.__editifyReportError?.("chrome:saveAs", String(error?.message || error));
        try {
          d0.logText?.("save", {
            step: "toolbar_exception",
            error: String(error?.message || error)
          });
        } catch {
          /* intentional: saveAs secondary logText best-effort */
        }
      });
    });
    d0.toolbarQuitBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      closeAllFlyoutMenus();
      void quitApplication();
    });
    d0.toolbarCloseBtn?.addEventListener?.("click", (e) => {
      e.preventDefault();
      closeAllFlyoutMenus();
      void quitApplication();
    });
    d0.toolbarOptionsMenu?.addEventListener?.("click", (e) => {
      const btn = e.target?.closest?.(".toolbar-lang-btn[data-lang]");
      if (!btn) return;
      try {
        d0.setLanguage(btn.dataset.lang);
      } catch (error) {
        globalThis.__editifyReportWarn?.("chrome:setLanguage", String(error?.message || error));
      }
      closeAllFlyoutMenus();
    });

    d0.pdfToolsMenu?.addEventListener?.("click", (e) => {
      const item = e.target?.closest?.("button[role='menuitem']");
      if (!item) return;
      closePdfToolsMenu();
    });

    window.maniPdfApi?.onFullscreenChanged?.((full) => {
      electronWindowFullscreen = Boolean(full);
      updateAppToolbarDom();
    });

    window.maniPdfApi?.onToolbarF10Toggle?.(() => {
      toggleHtmlToolbarF10();
    });

    d0.toolbarAboutBtn?.addEventListener?.("click", () => {
      if (!d0.aboutPopover) return;
      const isOpen = !d0.aboutPopover.classList.contains("hidden");
      if (isOpen) hideAboutPopover();
      else showAboutPopover();
    });
    d0.aboutCloseBtn?.addEventListener?.("click", () => hideAboutPopover());
    d0.toolbarAboutMenuItem?.addEventListener?.("click", () => {
      try {
        closeToolbarOptionsMenu();
      } catch {
        /* intentional: close options before about popover */
      }
      showAboutPopoverNearOptions();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const d = requireDeps();
      if (!d.blankCanvasCtxMenu || d.blankCanvasCtxMenu.classList.contains("hidden")) return;
      hideBlankCanvasCtxMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const d = requireDeps();
      if (!d.aboutPopover || d.aboutPopover.classList.contains("hidden")) return;
      hideAboutPopover();
    });
  }

  window.__editifyAppChrome = {
    bind,
    hideBlankCanvasCtxMenu,
    showBlankCanvasCtxMenu,
    hideAboutPopover,
    showAboutPopover,
    showAboutPopoverNearOptions,
    closeAllFlyoutMenus,
    closeToolbarDropdownMenus,
    closeToolbarFileMenu,
    closeToolbarOptionsMenu,
    closePdfToolsMenu,
    updateAppToolbarDom,
    toggleHtmlToolbarF10,
    syncFullscreenFromMain,
    quitApplication
  };
})();
