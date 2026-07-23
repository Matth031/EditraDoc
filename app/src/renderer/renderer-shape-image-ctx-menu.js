/**
 * Menus contextuels forme + image. Dépendances via `bind()` depuis `renderer.js`.
 * Doit être chargé après `renderer-text-ctx-menu.js` (références croisées avec `hideTextAnnotationCtxMenu`).
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let ctx = null;

  let shapeAnnotationCtxMenuEl = null;
  let shapeCtxMenuTargetId = null;
  let imageAnnotationCtxMenuEl = null;
  let imageCtxMenuTargetId = null;
  let shapeCtxMenuWired = false;
  let imageCtxMenuWired = false;

  function bind(next) {
    ctx = next;
  }

  function getShapeCtxMenuTargetId() {
    return shapeCtxMenuTargetId;
  }

  function setShapeCtxMenuTargetId(id) {
    shapeCtxMenuTargetId = id;
  }

  function ensureShapeAnnotationCtxMenuEl() {
    if (shapeAnnotationCtxMenuEl) return shapeAnnotationCtxMenuEl;
    shapeAnnotationCtxMenuEl = document.getElementById("shapeAnnotationCtxMenu");
    return shapeAnnotationCtxMenuEl;
  }

  function hideShapeAnnotationCtxMenu() {
    const d = ctx;
    if (!d) return;
    try {
      window.__editifyUtils.logText("ctxShapeMenuHide", {
        hadTarget: Boolean(shapeCtxMenuTargetId)
      });
    } catch {
      /* intentional: ctxShapeMenuHide debug log best-effort */
    }
    try {
      ensureShapeAnnotationCtxMenuEl()?.classList?.add?.("hidden");
    } catch {
      /* intentional: hide shape annotation ctx menu DOM */
    }
    shapeCtxMenuTargetId = null;
    globalThis.__maniCtxShapeBackup = undefined;
  }

  function ensureImageAnnotationCtxMenuEl() {
    if (!imageAnnotationCtxMenuEl)
      imageAnnotationCtxMenuEl = document.getElementById("imageAnnotationCtxMenu");
    return imageAnnotationCtxMenuEl;
  }

  function hideImageAnnotationCtxMenu() {
    try {
      ensureImageAnnotationCtxMenuEl()?.classList?.add?.("hidden");
    } catch {
      /* intentional: hide image annotation ctx menu DOM */
    }
    imageCtxMenuTargetId = null;
  }

  function syncImageCtxMenuFromItem(item) {
    const rot = document.getElementById("ctxImageRotation");
    const op = document.getElementById("ctxImageOpacity");
    if (rot) rot.value = String(Math.round(item.rotation || 0));
    if (op) op.value = String(Math.round(item.opacity ?? 100));
  }

  function applyImageCtxMenuProps() {
    const d = ctx;
    if (!d) return;
    const tab = d.getActiveTab();
    if (!tab || !imageCtxMenuTargetId) return;
    const loc = d.findAnnotationLocation(tab, imageCtxMenuTargetId);
    if (!loc || loc.item.type !== "image") return;
    const item = loc.item;
    d.captureSnapshot(tab);
    const rot = document.getElementById("ctxImageRotation");
    const op = document.getElementById("ctxImageOpacity");
    if (rot) item.rotation = Math.max(0, Math.min(360, Number(rot.value) || 0));
    if (op) item.opacity = Math.max(0, Math.min(100, Number(op.value) || 100));
    d.renderAnnotations();
    d.scheduleAutoSave();
  }

  function openImageAnnotationCtxMenu(event, annotationId) {
    const d = ctx;
    if (!d) return;
    d.commitActiveTextEditIfNeeded(annotationId);
    d.cancelPointerInteraction();
    const menu = ensureImageAnnotationCtxMenuEl();
    if (!menu) return;
    const tab = d.getActiveTab();
    if (!tab) return;
    const loc = d.findAnnotationLocation(tab, annotationId);
    if (!loc || loc.item.type !== "image") return;
    d.hideTextAnnotationCtxMenu();
    hideShapeAnnotationCtxMenu();
    d.hideChangesContextMenu();
    imageCtxMenuTargetId = annotationId;
    d.state.selectedAnnotationId = annotationId;
    d.syncPropertyInputs();
    syncImageCtxMenuFromItem(loc.item);
    menu.classList.remove("hidden");
    menu.style.minWidth = "240px";
    void menu.offsetWidth;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width || 240;
    const h = rect.height || 100;
    let mx = event.clientX;
    let my = event.clientY;
    mx = Math.min(mx, vw - w - 8);
    my = Math.min(my, vh - h - 8);
    menu.style.left = `${Math.max(8, mx)}px`;
    menu.style.top = `${Math.max(8, my)}px`;
    d.renderAnnotations();
  }

  function wireImageAnnotationCtxMenu() {
    if (imageCtxMenuWired) return;
    if (!ensureImageAnnotationCtxMenuEl()) return;
    const bindLive = (id, fn) => {
      const el = document.getElementById(id);
      el?.addEventListener?.("input", fn);
      el?.addEventListener?.("change", fn);
    };
    bindLive("ctxImageRotation", () => applyImageCtxMenuProps());
    bindLive("ctxImageOpacity", () => applyImageCtxMenuProps());
    imageCtxMenuWired = true;
  }

  function syncShapeCtxMenuFromItem(item) {
    const d = ctx;
    if (!d) return;
    d.mergeShapeStyleFields(item);
    const rotEl = document.getElementById("ctxShapeRotation");
    const opEl = document.getElementById("ctxShapeOpacity");
    if (rotEl) rotEl.value = String(Math.round(item.rotation || 0));
    if (opEl) opEl.value = String(Math.round(item.opacity ?? 100));
    const fill = document.getElementById("ctxShapeFill");
    const fillOp = document.getElementById("ctxShapeFillOp");
    const stroke = document.getElementById("ctxShapeStroke");
    const strokeOp = document.getElementById("ctxShapeStrokeOp");
    const strokeW = document.getElementById("ctxShapeStrokeW");
    const bd = document.getElementById("ctxShapeBackdrop");
    const bdOp = document.getElementById("ctxShapeBackdropOp");
    if (fill) fill.value = item.fillColor || "#000000";
    if (fillOp) fillOp.value = String(Math.round(Number(item.fillAlpha ?? 0) * 100));
    if (stroke) stroke.value = item.strokeColor || "#000000";
    if (strokeOp) strokeOp.value = String(Math.round(Number(item.strokeAlpha ?? 1) * 100));
    if (strokeW) strokeW.value = String(Math.max(0, Math.floor(Number(item.strokeWidth) || 0)));
    const bdTr = !item.backdropColor || Number(item.backdropAlpha ?? 0) < 0.001;
    if (bd) bd.value = bdTr ? "#ffffff" : item.backdropColor;
    if (bdOp) bdOp.value = String(Math.round(Number(item.backdropAlpha ?? 0) * 100));
    try {
      window.syncManiColorSwatches?.();
    } catch {
      /* intentional: sync color swatches in shape ctx */
    }
  }

  function applyShapeCtxMenuProps() {
    const d = ctx;
    if (!d) return;
    const tab = d.getActiveTab();
    if (!tab || !shapeCtxMenuTargetId) return;
    const loc = d.findAnnotationLocation(tab, shapeCtxMenuTargetId);
    if (!loc || !d.SHAPE_TYPES.has(loc.item.type)) return;
    const item = loc.item;
    d.captureSnapshot(tab);
    d.mergeShapeStyleFields(item);

    const prevFill = item.fillColor;
    const prevStroke = item.strokeColor;
    const prevBackdrop = item.backdropColor;

    const fill = document.getElementById("ctxShapeFill");
    const fillOp = document.getElementById("ctxShapeFillOp");
    const stroke = document.getElementById("ctxShapeStroke");
    const strokeOp = document.getElementById("ctxShapeStrokeOp");
    const strokeW = document.getElementById("ctxShapeStrokeW");
    const bd = document.getElementById("ctxShapeBackdrop");
    const bdOp = document.getElementById("ctxShapeBackdropOp");

    if (fill) item.fillColor = fill.value || item.fillColor;
    if (fillOp) {
      let op = d.clamp(Number(fillOp.value) / 100, 0, 1);
      if (op < 0.001 && item.fillColor !== prevFill) {
        op = d.defaultShapeFillAlphaAfterClear(item.type);
        fillOp.value = String(Math.round(op * 100));
      }
      item.fillAlpha = op;
    }

    if (stroke) item.strokeColor = stroke.value || item.strokeColor;
    if (strokeOp) {
      let op = d.clamp(Number(strokeOp.value) / 100, 0, 1);
      if (op < 0.001 && item.strokeColor !== prevStroke) {
        op = 1;
        strokeOp.value = "100";
        if ((Number(item.strokeWidth) || 0) < 1) {
          item.strokeWidth = 2;
          if (strokeW) strokeW.value = "2";
        }
      }
      item.strokeAlpha = op;
    }
    if (strokeW) item.strokeWidth = d.clamp(Math.floor(Number(strokeW.value) || 0), 0, 24);

    const rotM = document.getElementById("ctxShapeRotation");
    const opM = document.getElementById("ctxShapeOpacity");
    if (rotM) item.rotation = Math.max(0, Math.min(360, Number(rotM.value) || 0));
    if (opM) item.opacity = Math.max(0, Math.min(100, Number(opM.value) || 100));

    if (bd && bd.dataset.ctxTouched === "1") {
      item.backdropColor = bd.value || null;
    }
    if (bdOp) {
      let op = d.clamp(Number(bdOp.value) / 100, 0, 1);
      const colorPicked =
        bd &&
        bd.dataset.ctxTouched === "1" &&
        item.backdropColor &&
        item.backdropColor !== prevBackdrop;
      if (op < 0.001 && colorPicked) {
        op = 0.3;
        bdOp.value = "30";
      }
      item.backdropAlpha = op;
    }

    if ((Number(item.backdropAlpha) || 0) < 0.001) {
      item.backdropColor = null;
    } else if (!item.backdropColor && bd) {
      item.backdropColor = bd.value || "#ffffff";
    }
    if (d.propShapeFill) d.propShapeFill.value = item.fillColor || "#000000";
    if (d.propShapeFillOpacity)
      d.propShapeFillOpacity.value = String(Math.round(Number(item.fillAlpha ?? 0) * 100));
    if (d.propShapeStroke) d.propShapeStroke.value = item.strokeColor || "#000000";
    if (d.propShapeStrokeOpacity)
      d.propShapeStrokeOpacity.value = String(Math.round(Number(item.strokeAlpha ?? 1) * 100));
    if (d.propShapeStrokeWidth)
      d.propShapeStrokeWidth.value = String(Math.max(0, Math.floor(Number(item.strokeWidth) || 0)));
    if (d.propShapeBackdrop)
      d.propShapeBackdrop.value = !item.backdropColor ? "#ffffff" : item.backdropColor;
    if (d.propShapeBackdropOpacity)
      d.propShapeBackdropOpacity.value = String(Math.round(Number(item.backdropAlpha ?? 0) * 100));
    d.renderAnnotations();
    d.scheduleAutoSave();
  }

  function openShapeAnnotationCtxMenu(event, annotationId) {
    const d = ctx;
    if (!d) return;
    d.commitActiveTextEditIfNeeded(annotationId);
    d.cancelPointerInteraction();
    const menu = ensureShapeAnnotationCtxMenuEl();
    if (!menu) return;
    const tab = d.getActiveTab();
    if (!tab) return;
    const loc = d.findAnnotationLocation(tab, annotationId);
    if (!loc || !d.SHAPE_TYPES.has(loc.item.type)) return;
    d.hideTextAnnotationCtxMenu();
    hideImageAnnotationCtxMenu();
    d.hideChangesContextMenu();
    shapeCtxMenuTargetId = annotationId;
    d.state.selectedAnnotationId = annotationId;
    d.syncPropertyInputs();
    syncShapeCtxMenuFromItem(loc.item);
    const bd = document.getElementById("ctxShapeBackdrop");
    if (bd) bd.dataset.ctxTouched = "0";

    menu.classList.remove("hidden");
    menu.style.minWidth = "280px";
    void menu.offsetWidth;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width || 280;
    const h = rect.height || 320;
    let mx = event.clientX;
    let my = event.clientY;
    mx = Math.min(mx, vw - w - 8);
    my = Math.min(my, vh - h - 8);
    menu.style.left = `${Math.max(8, mx)}px`;
    menu.style.top = `${Math.max(8, my)}px`;
    d.renderAnnotations();
  }

  function wireShapeAnnotationCtxMenu() {
    if (shapeCtxMenuWired) return;
    const menu = ensureShapeAnnotationCtxMenuEl();
    if (!menu) return;
    const bindLive = (id, fn) => {
      const el = document.getElementById(id);
      el?.addEventListener?.("input", fn);
      el?.addEventListener?.("change", fn);
    };
    bindLive("ctxShapeFillOp", () => applyShapeCtxMenuProps());
    bindLive("ctxShapeStrokeOp", () => applyShapeCtxMenuProps());
    bindLive("ctxShapeStrokeW", () => applyShapeCtxMenuProps());
    bindLive("ctxShapeRotation", () => applyShapeCtxMenuProps());
    bindLive("ctxShapeOpacity", () => applyShapeCtxMenuProps());
    document
      .getElementById("ctxValidateShapeFillBtn")
      ?.addEventListener?.("click", () => applyShapeCtxMenuProps());
    document
      .getElementById("ctxValidateShapeStrokeBtn")
      ?.addEventListener?.("click", () => applyShapeCtxMenuProps());
    const bd = document.getElementById("ctxShapeBackdrop");
    document.getElementById("ctxValidateShapeBackdropBtn")?.addEventListener?.("click", () => {
      try {
        if (bd) bd.dataset.ctxTouched = "1";
      } catch {
        /* intentional: backdrop touched dataset flag best-effort */
      }
      applyShapeCtxMenuProps();
    });
    bindLive("ctxShapeBackdropOp", () => applyShapeCtxMenuProps());

    document.getElementById("ctxShapeFillClear")?.addEventListener?.("click", () => {
      const d = ctx;
      if (!d) return;
      const tab = d.getActiveTab();
      if (!tab || !shapeCtxMenuTargetId) return;
      const loc = d.findAnnotationLocation(tab, shapeCtxMenuTargetId);
      if (!loc?.item || !d.SHAPE_TYPES.has(loc.item.type)) return;
      d.captureSnapshot(tab);
      loc.item.fillAlpha = 0;
      syncShapeCtxMenuFromItem(loc.item);
      d.syncPropertyInputs();
      d.renderAnnotations();
      d.scheduleAutoSave();
    });
    document.getElementById("ctxShapeStrokeClear")?.addEventListener?.("click", () => {
      const d = ctx;
      if (!d) return;
      const tab = d.getActiveTab();
      if (!tab || !shapeCtxMenuTargetId) return;
      const loc = d.findAnnotationLocation(tab, shapeCtxMenuTargetId);
      if (!loc?.item || !d.SHAPE_TYPES.has(loc.item.type)) return;
      d.captureSnapshot(tab);
      loc.item.strokeAlpha = 0;
      syncShapeCtxMenuFromItem(loc.item);
      d.syncPropertyInputs();
      d.renderAnnotations();
      d.scheduleAutoSave();
    });
    document.getElementById("ctxShapeBackdropClear")?.addEventListener?.("click", () => {
      const d = ctx;
      if (!d) return;
      const tab = d.getActiveTab();
      if (!tab || !shapeCtxMenuTargetId) return;
      const loc = d.findAnnotationLocation(tab, shapeCtxMenuTargetId);
      if (!loc?.item || !d.SHAPE_TYPES.has(loc.item.type)) return;
      d.captureSnapshot(tab);
      loc.item.backdropColor = null;
      loc.item.backdropAlpha = 0;
      if (bd) {
        bd.value = "#ffffff";
        bd.dataset.ctxTouched = "0";
      }
      syncShapeCtxMenuFromItem(loc.item);
      d.syncPropertyInputs();
      d.renderAnnotations();
      d.scheduleAutoSave();
    });
    shapeCtxMenuWired = true;
  }

  window.__editifyShapeImageCtxMenu = {
    bind,
    hideShapeAnnotationCtxMenu,
    hideImageAnnotationCtxMenu,
    ensureShapeAnnotationCtxMenuEl,
    ensureImageAnnotationCtxMenuEl,
    openShapeAnnotationCtxMenu,
    openImageAnnotationCtxMenu,
    applyShapeCtxMenuProps,
    syncShapeCtxMenuFromItem,
    wireShapeAnnotationCtxMenu,
    wireImageAnnotationCtxMenu,
    getShapeCtxMenuTargetId,
    setShapeCtxMenuTargetId
  };
})();
