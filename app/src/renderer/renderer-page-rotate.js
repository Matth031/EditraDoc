/**
 * Rotation de page PDF (±90°) — boutons barre d'outils, undo, session.
 * `window.__editifyPageRotate` — `bind()` depuis `renderer.js`.
 */
(function () {
  "use strict";

  const math = () => window.__editifyPageRotateMath;

  /**
   * @typedef {object} PageRotateDeps
   * @property {HTMLElement | null} rotateLeftBtn
   * @property {HTMLElement | null} rotateRightBtn
   * @property {{ editingAnnotationId: string | null }} state
   * @property {() => object | null} getActiveTab
   * @property {HTMLElement | null} pagesContainer
   * @property {(tab: object) => void} captureSnapshot
   * @property {() => void} renderAnnotations
   * @property {() => void} enforceSafeZoneForActiveTab
   * @property {(pageNumber: number) => Promise<void>} rerenderPage
   * @property {() => void} scheduleSidebarUpdate
   * @property {{ scheduleAutoSave: () => void }} session
   * @property {(key: string) => string} t
   * @property {(msg: string) => void} setStatus
   */

  /** @type {PageRotateDeps | null} */
  let deps = null;
  let wired = false;
  let rotating = false;
  /** @type {Map<string, () => void>} */
  const shortcutRegistry = new Map();

  /**
   * Stub V1 : enregistre un raccourci sans binding clavier (FR-41).
   * @param {string} id
   * @param {() => void} handler
   * @returns {() => void} désenregistrement
   */
  function registerShortcut(id, handler) {
    const key = String(id || "").trim();
    if (!key || typeof handler !== "function") return () => {};
    shortcutRegistry.set(key, handler);
    return () => {
      shortcutRegistry.delete(key);
    };
  }

  function syncRotateButtonsState() {
    const d = requireDeps();
    const hasPdf = Boolean(d.getActiveTab());
    if (d.rotateLeftBtn) d.rotateLeftBtn.disabled = !hasPdf;
    if (d.rotateRightBtn) d.rotateRightBtn.disabled = !hasPdf;
  }

  /** @param {PageRotateDeps} next */
  function bind(next) {
    deps = next;
    if (!wired) {
      wired = true;
      wireOnce();
    }
    syncRotateButtonsState();
  }

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] __editifyPageRotate.bind() doit être appelé depuis renderer.js.");
    }
    return deps;
  }

  /**
   * @param {"left" | "right"} direction
   */
  async function rotateCurrentPage(direction) {
    const d = requireDeps();
    if (rotating) return;
    if (d.state.editingAnnotationId) {
      d.setStatus(d.t("stPageRotBlockedEdit"));
      return;
    }
    const tab = d.getActiveTab();
    if (!tab) {
      d.setStatus(d.t("stPageRotNoPdf"));
      return;
    }

    const pageNumber = Number(tab.currentPage) || 1;
    const pageKey = String(pageNumber);
    const pageNode = d.pagesContainer?.querySelector?.(`.pdf-page[data-page="${pageKey}"]`);
    const canvas = pageNode?.querySelector?.("canvas.pdf-canvas");
    const cw = canvas?.width || 0;
    const ch = canvas?.height || 0;
    const delta = direction === "left" ? -90 : 90;
    const norm = math()?.normalizeRotation || ((v) => ((Number(v) || 0) % 360 + 360) % 360);

    rotating = true;
    try {
      d.captureSnapshot(tab);
      if (!tab.pageRotationsByPage) tab.pageRotationsByPage = {};
      const current = norm(tab.pageRotationsByPage[pageKey] ?? 0);
      tab.pageRotationsByPage[pageKey] = norm(current + delta);
      if (!tab.pageRotationsUserTouched) tab.pageRotationsUserTouched = {};
      tab.pageRotationsUserTouched[pageKey] = true;

      const annotations = tab.annotationsByPage?.[pageKey] || [];
      if (annotations.length && cw > 0 && ch > 0 && math()?.rotateAnnotationsOnPage) {
        tab.annotationsByPage[pageKey] = math().rotateAnnotationsOnPage(
          annotations,
          delta,
          cw,
          ch
        );
      }

      await d.rerenderPage(pageNumber);
      if (!tab.viewportByPage) tab.viewportByPage = {};
      const nextCanvas = pageNode?.querySelector?.("canvas.pdf-canvas");
      if (nextCanvas) {
        tab.viewportByPage[pageKey] = {
          width: nextCanvas.width,
          height: nextCanvas.height
        };
      }
      d.enforceSafeZoneForActiveTab();
      d.renderAnnotations();
      d.scheduleSidebarUpdate();
      d.session.scheduleAutoSave();
    } finally {
      rotating = false;
    }
  }

  function wireOnce() {
    const d = requireDeps();
    d.rotateLeftBtn?.addEventListener?.("click", () => {
      rotateCurrentPage("left").catch((error) => {
        try {
          globalThis.__editifyReportError?.("page-rotate:left", String(error?.message || error));
        } catch {
          /* ignore */
        }
      });
    });
    d.rotateRightBtn?.addEventListener?.("click", () => {
      rotateCurrentPage("right").catch((error) => {
        try {
          globalThis.__editifyReportError?.("page-rotate:right", String(error?.message || error));
        } catch {
          /* ignore */
        }
      });
    });
    registerShortcut("page-rotate-left", () => {
      rotateCurrentPage("left").catch(() => {});
    });
    registerShortcut("page-rotate-right", () => {
      rotateCurrentPage("right").catch(() => {});
    });
  }

  window.__editifyPageRotate = {
    bind,
    rotateCurrentPage,
    syncRotateButtonsState,
    registerShortcut
  };
})();
