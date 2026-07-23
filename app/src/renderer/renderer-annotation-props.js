/**
 * Panneau propriétés : sync inputs, application live, nuancier Mani.
 * `bind()` depuis renderer.js une fois les dépendances (état, DOM, texte) définies.
 *
 * Volontairement hors module : `applyTextColorToTextAnnotation`, `captureTextColorSelectionBackup`
 * (couplage édition texte / sélection) ; `finishUndoRedoUi` (undo/session) ; listeners DOM panneau.
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;
  let maniHandlersWired = false;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-annotation-props.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  function syncPropertyInputs() {
    const d = requireDeps();
    const getSelectedAnnotation = /** @type {() => object | null} */ (d.getSelectedAnnotation);
    const item = getSelectedAnnotation();
    const isText = !!item && item.type === "text";
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const isShape = !!item && SHAPE_TYPES.has(item.type);
    const textPropsPanel = /** @type {HTMLElement | null} */ (d.textPropsPanel);
    const shapePropsPanel = /** @type {HTMLElement | null} */ (d.shapePropsPanel);
    if (textPropsPanel) {
      textPropsPanel.classList.toggle("hidden", !isText);
    }
    if (shapePropsPanel) {
      shapePropsPanel.classList.toggle("hidden", !isShape);
    }
    if (!item) return;
    const propWidth = /** @type {HTMLInputElement | null} */ (d.propWidth);
    const propHeight = /** @type {HTMLInputElement | null} */ (d.propHeight);
    const propRotation = /** @type {HTMLInputElement | null} */ (d.propRotation);
    const propOpacity = /** @type {HTMLInputElement | null} */ (d.propOpacity);
    if (propWidth && propHeight && propRotation && propOpacity) {
      propWidth.value = String(Math.round(item.w || 180));
      propHeight.value = String(Math.round(item.h || 120));
      propRotation.value = String(Math.round(item.rotation || 0));
      propOpacity.value = String(Math.round(item.opacity ?? 100));
    }
    if (isText) {
      const propTextColor = /** @type {HTMLInputElement | null} */ (d.propTextColor);
      const propBgColor = /** @type {HTMLInputElement | null} */ (d.propBgColor);
      const propBgColorLabel = /** @type {HTMLElement | null} */ (d.propBgColorLabel);
      const propPadding = /** @type {HTMLInputElement | null} */ (d.propPadding);
      const propFontFamily = /** @type {HTMLSelectElement | null} */ (d.propFontFamily);
      const propFontSize = /** @type {HTMLInputElement | null} */ (d.propFontSize);
      const captureLastTextStyleFromItem = /** @type {(item: object) => void} */ (
        d.captureLastTextStyleFromItem
      );
      if (propTextColor) propTextColor.value = item.textColor || "#111111";

      const bgIsTransparent = !item.bgColor;
      if (propBgColor) propBgColor.value = bgIsTransparent ? "#ffffff" : item.bgColor;
      propBgColorLabel?.classList?.toggle?.("is-transparent", bgIsTransparent);

      if (propBgColor) propBgColor.dataset.touched = "0";
      if (propPadding) propPadding.value = String(Math.round(item.padding ?? 6));
      if (propFontFamily) propFontFamily.value = item.fontFamily || "Arial";
      if (propFontSize) propFontSize.value = String(Math.round(item.fontSize ?? 14));
      captureLastTextStyleFromItem(item);
    }
    if (isShape) {
      const propShapeFill = /** @type {HTMLInputElement | null} */ (d.propShapeFill);
      const propShapeFillOpacity = /** @type {HTMLInputElement | null} */ (d.propShapeFillOpacity);
      const propShapeStroke = /** @type {HTMLInputElement | null} */ (d.propShapeStroke);
      const propShapeStrokeWidth = /** @type {HTMLInputElement | null} */ (d.propShapeStrokeWidth);
      const propShapeStrokeOpacity = /** @type {HTMLInputElement | null} */ (
        d.propShapeStrokeOpacity
      );
      const propShapeBackdrop = /** @type {HTMLInputElement | null} */ (d.propShapeBackdrop);
      const propShapeBackdropOpacity = /** @type {HTMLInputElement | null} */ (
        d.propShapeBackdropOpacity
      );
      const mergeShapeStyleFields = /** @type {(item: object) => void} */ (d.mergeShapeStyleFields);
      if (propShapeFill && propShapeFillOpacity && propShapeStroke && propShapeStrokeWidth) {
        mergeShapeStyleFields(item);
        propShapeFill.value = item.fillColor || "#000000";
        propShapeFillOpacity.value = String(Math.round(Number(item.fillAlpha ?? 0.3) * 100));
        propShapeStroke.value = item.strokeColor || "#000000";
        propShapeStrokeWidth.value = String(Math.max(0, Math.floor(Number(item.strokeWidth) || 0)));
        if (propShapeStrokeOpacity) {
          propShapeStrokeOpacity.value = String(Math.round(Number(item.strokeAlpha ?? 1) * 100));
        }
        if (propShapeBackdrop && propShapeBackdropOpacity) {
          const bdTr = !item.backdropColor || Number(item.backdropAlpha ?? 0) < 0.001;
          propShapeBackdrop.value = bdTr ? "#ffffff" : item.backdropColor;
          propShapeBackdropOpacity.value = String(
            Math.round(Number(item.backdropAlpha ?? 0) * 100)
          );
        }
      }
    }
    try {
      window.syncManiColorSwatches?.();
    } catch {
      /* intentional: sync color swatches after props best-effort */
    }
  }

  function applySelectedProperties() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const getSelectedAnnotation = /** @type {() => object | null} */ (d.getSelectedAnnotation);
    const tab = getActiveTab();
    const item = getSelectedAnnotation();
    if (!tab || !item) return;
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    const applyTextColorToTextAnnotation = /** @type {(item: object, color: string) => void} */ (
      d.applyTextColorToTextAnnotation
    );
    const propTextColor = /** @type {HTMLInputElement | null} */ (d.propTextColor);
    const propBgColor = /** @type {HTMLInputElement | null} */ (d.propBgColor);
    const propPadding = /** @type {HTMLInputElement | null} */ (d.propPadding);
    const propFontFamily = /** @type {HTMLSelectElement | null} */ (d.propFontFamily);
    const propFontSize = /** @type {HTMLInputElement | null} */ (d.propFontSize);
    const captureLastTextStyleFromItem = /** @type {(item: object) => void} */ (
      d.captureLastTextStyleFromItem
    );
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const clamp = /** @type {(n: number, min: number, max: number) => number} */ (d.clamp);
    const defaultShapeFillAlphaAfterClear = /** @type {(type: string) => number} */ (
      d.defaultShapeFillAlphaAfterClear
    );
    const renderAnnotations = /** @type {() => void} */ (d.renderAnnotations);
    const scheduleAutoSave = /** @type {() => void} */ (d.scheduleAutoSave);

    if (item.type === "text") {
      applyTextColorToTextAnnotation(item, propTextColor?.value || "#111111");

      if (propBgColor && propBgColor.dataset.touched === "1") {
        item.bgColor = propBgColor.value ? propBgColor.value : null;
      }

      item.padding = Math.max(0, Math.min(64, Number(propPadding?.value) || 0));
      item.fontFamily = propFontFamily?.value || "Arial";
      item.fontSize = Math.max(8, Math.min(96, Number(propFontSize?.value) || 14));
      captureLastTextStyleFromItem(item);
    } else if (SHAPE_TYPES.has(item.type)) {
      const propShapeFill = /** @type {HTMLInputElement | null} */ (d.propShapeFill);
      const propShapeFillOpacity = /** @type {HTMLInputElement | null} */ (d.propShapeFillOpacity);
      const propShapeStroke = /** @type {HTMLInputElement | null} */ (d.propShapeStroke);
      const propShapeStrokeWidth = /** @type {HTMLInputElement | null} */ (d.propShapeStrokeWidth);
      const propShapeStrokeOpacity = /** @type {HTMLInputElement | null} */ (
        d.propShapeStrokeOpacity
      );
      const propShapeBackdrop = /** @type {HTMLInputElement | null} */ (d.propShapeBackdrop);
      const propShapeBackdropOpacity = /** @type {HTMLInputElement | null} */ (
        d.propShapeBackdropOpacity
      );
      if (!propShapeFill || !propShapeFillOpacity || !propShapeStroke || !propShapeStrokeWidth) {
        return;
      }
      const prevFill = item.fillColor;
      const prevStroke = item.strokeColor;
      const prevBackdrop = item.backdropColor;

      item.fillColor = propShapeFill.value || item.fillColor;
      let fillA = clamp(Number(propShapeFillOpacity.value) / 100, 0, 1);
      if (fillA < 0.001 && item.fillColor !== prevFill) {
        fillA = defaultShapeFillAlphaAfterClear(item.type);
        propShapeFillOpacity.value = String(Math.round(fillA * 100));
      }
      item.fillAlpha = fillA;

      item.strokeColor = propShapeStroke.value || item.strokeColor;
      let strokeA = propShapeStrokeOpacity
        ? clamp(Number(propShapeStrokeOpacity.value) / 100, 0, 1)
        : 1;
      if (strokeA < 0.001 && item.strokeColor !== prevStroke) {
        strokeA = 1;
        if (propShapeStrokeOpacity) propShapeStrokeOpacity.value = "100";
        if ((Number(item.strokeWidth) || 0) < 1) {
          const w = 2;
          item.strokeWidth = w;
          if (propShapeStrokeWidth) propShapeStrokeWidth.value = String(w);
        }
      }
      if (propShapeStrokeOpacity) item.strokeAlpha = strokeA;

      item.strokeWidth = clamp(Math.floor(Number(propShapeStrokeWidth.value) || 0), 0, 24);
      if (propShapeBackdrop && propShapeBackdropOpacity) {
        let bda = clamp(Number(propShapeBackdropOpacity.value) / 100, 0, 1);
        const newBd = propShapeBackdrop.value;
        if (bda < 0.001 && newBd && newBd !== prevBackdrop) {
          bda = 0.3;
          propShapeBackdropOpacity.value = "30";
        }
        item.backdropAlpha = bda;
        if (item.backdropAlpha < 0.001) {
          item.backdropColor = null;
        } else {
          item.backdropColor = newBd || item.backdropColor || "#ffffff";
        }
      }
    }
    renderAnnotations();
    scheduleAutoSave();
  }

  function applySelectedPropertiesLive() {
    const d = requireDeps();
    const getSelectedAnnotation = /** @type {() => object | null} */ (d.getSelectedAnnotation);
    if (!getSelectedAnnotation()) return;
    applySelectedProperties();
  }

  function markBgTouchedAndApply() {
    const d = requireDeps();
    const propBgColor = /** @type {HTMLInputElement | null} */ (d.propBgColor);
    const propBgColorLabel = /** @type {HTMLElement | null} */ (d.propBgColorLabel);
    try {
      if (propBgColor) propBgColor.dataset.touched = "1";
      propBgColorLabel?.classList?.remove?.("is-transparent");
    } catch {
      /* intentional: bg color touched label DOM best-effort */
    }
    applySelectedPropertiesLive();
  }

  function clickManiColorValidateButtonForInputId(id) {
    const d = requireDeps();
    const logText = /** @type {(tag: string, data?: object) => void} */ (d.logText);
    const map = {
      propShapeFill: "validateShapeFillBtn",
      propShapeStroke: "validateShapeStrokeBtn",
      propShapeBackdrop: "validateShapeBackdropBtn",
      propTextColor: "validateTextColorBtn",
      propBgColor: "applyBgBtn",
      ctxTextColor: "ctxValidateTextColorBtn",
      ctxTextBg: "ctxValidateTextBgBtn",
      ctxShapeFill: "ctxValidateShapeFillBtn",
      ctxShapeStroke: "ctxValidateShapeStrokeBtn",
      ctxShapeBackdrop: "ctxValidateShapeBackdropBtn"
    };
    const btnId = map[id];
    if (!btnId) {
      logText("maniColorValidateClickMapMiss", { id });
      return false;
    }
    const btn = document.getElementById(btnId);
    if (!btn) {
      logText("maniColorValidateBtnMissing", { id, btnId });
      return false;
    }
    btn.click();
    logText("maniColorValidateBtnClicked", { id, btnId });
    return true;
  }

  function applyManiColorAfterPicker(inputEl) {
    const d = requireDeps();
    const state = /** @type {{ selectedAnnotationId: string | null }} */ (d.state);
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const getSelectedAnnotation = /** @type {() => object | null} */ (d.getSelectedAnnotation);
    const logText = /** @type {(tag: string, data?: object) => void} */ (d.logText);
    const tcm = /** @type {Record<string, Function>} */ (d.tcm);
    const sim = /** @type {Record<string, Function>} */ (d.sim);
    const propBgColor = /** @type {HTMLInputElement | null} */ (d.propBgColor);
    const propShapeFill = /** @type {HTMLInputElement | null} */ (d.propShapeFill);
    const propShapeStrokeWidth = /** @type {HTMLInputElement | null} */ (d.propShapeStrokeWidth);
    const propShapeFillOpacity = /** @type {HTMLInputElement | null} */ (d.propShapeFillOpacity);
    const propTextColor = /** @type {HTMLInputElement | null} */ (d.propTextColor);
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);

    try {
      const id = inputEl?.id || "";
      const hex = String(inputEl?.value || "").trim();
      logText("maniColorApply", {
        id,
        v: hex,
        selectedId: state.selectedAnnotationId,
        backup: globalThis.__maniColorSelectionBackup,
        shapeCtx: sim.getShapeCtxMenuTargetId(),
        textCtx: tcm.getTextCtxMenuTargetId(),
        propShapeFillEl: Boolean(propShapeFill),
        propShapeStrokeWEl: Boolean(propShapeStrokeWidth)
      });
      try {
        window.maniPdfApi?.log?.("maniColorApply", {
          id,
          selectedId: state.selectedAnnotationId,
          backup: globalThis.__maniColorSelectionBackup
        });
      } catch {
        /* intentional: maniColorApply debug log best-effort */
      }
      if (!id) return;

      if (id === "propBgColor" && propBgColor) {
        propBgColor.dataset.touched = "1";
      }
      if (id === "ctxTextBg") {
        const bg = document.getElementById("ctxTextBg");
        if (bg) bg.dataset.ctxTouched = "1";
      }
      if (id === "ctxShapeBackdrop") {
        const bd = document.getElementById("ctxShapeBackdrop");
        if (bd) bd.dataset.ctxTouched = "1";
      }

      if (id === "ctxTextColor" || id === "ctxTextBg") {
        if (!tcm.getTextCtxMenuTargetId() && globalThis.__maniCtxTextBackup) {
          tcm.setTextCtxMenuTargetId(globalThis.__maniCtxTextBackup);
          logText("maniColorRestoreTextCtx", { textCtxMenuTargetId: tcm.getTextCtxMenuTargetId() });
        }
        try {
          tcm.ensureTextAnnotationCtxMenuEl()?.classList?.remove?.("hidden");
        } catch {
          /* intentional: show text ctx menu after color best-effort */
        }
        logText("maniColorBranchCtxText", {
          id,
          textCtxMenuTargetId: tcm.getTextCtxMenuTargetId(),
          hex
        });
        try {
          if (!clickManiColorValidateButtonForInputId(id)) {
            logText("maniColorCtxTextFallbackApply", { id });
            tcm.applyTextCtxMenuBoxProps();
          }
          window.maniPdfApi?.log?.("maniColor ctx text applied", { id, via: "clickOrFallback" });
        } catch {
          try {
            tcm.applyTextCtxMenuBoxProps();
          } catch (error) {
            globalThis.__editifyReportWarn?.("props:textCtxColorFallback", String(error?.message || error));
          }
        }
        globalThis.__maniCtxTextBackup = undefined;
        return;
      }
      if (id.startsWith("ctxShape")) {
        if (!sim.getShapeCtxMenuTargetId() && globalThis.__maniCtxShapeBackup) {
          sim.setShapeCtxMenuTargetId(globalThis.__maniCtxShapeBackup);
          logText("maniColorRestoreShapeCtx", {
            shapeCtxMenuTargetId: sim.getShapeCtxMenuTargetId()
          });
        }
        try {
          sim.ensureShapeAnnotationCtxMenuEl()?.classList?.remove?.("hidden");
        } catch {
          /* intentional: show shape ctx menu after color best-effort */
        }
        logText("maniColorBranchCtxShape", {
          id,
          shapeCtxMenuTargetId: sim.getShapeCtxMenuTargetId(),
          hex
        });
        try {
          if (!clickManiColorValidateButtonForInputId(id)) {
            logText("maniColorCtxShapeFallbackApply", { id });
            sim.applyShapeCtxMenuProps();
          }
          window.maniPdfApi?.log?.("maniColor ctx shape applied", { id, via: "clickOrFallback" });
        } catch {
          try {
            sim.applyShapeCtxMenuProps();
          } catch (error) {
            globalThis.__editifyReportWarn?.("props:shapeCtxColorFallback", String(error?.message || error));
          }
        }
        globalThis.__maniCtxShapeBackup = undefined;
        return;
      }

      const tab = getActiveTab();
      if (!tab) {
        logText("maniColorNoTab", { id });
        return;
      }

      const beforeSel = state.selectedAnnotationId;
      if (
        !getSelectedAnnotation() &&
        globalThis.__maniColorSelectionBackup != null &&
        globalThis.__maniColorSelectionBackup !== ""
      ) {
        state.selectedAnnotationId = globalThis.__maniColorSelectionBackup;
        logText("maniColorRestoreSel", { from: beforeSel, to: state.selectedAnnotationId });
      }
      globalThis.__maniColorSelectionBackup = undefined;

      const item = getSelectedAnnotation();
      logText("maniColorBeforeApplySelected", {
        hasItem: Boolean(item),
        type: item?.type,
        branchShape: Boolean(
          item && SHAPE_TYPES.has(item.type) && propShapeFill && propShapeFillOpacity
        )
      });

      if (!item) {
        logText("maniColorNoItem", { id, selectedId: state.selectedAnnotationId });
        return;
      }

      try {
        if (!clickManiColorValidateButtonForInputId(id)) {
          applySelectedProperties();
        }
        const after = getSelectedAnnotation();
        window.maniPdfApi?.log?.("maniColor panel validate click", {
          id,
          type: item.type,
          textColor: after?.type === "text" ? after.textColor : undefined,
          fillColor: after && SHAPE_TYPES.has(after.type) ? after.fillColor : undefined,
          propTextVal: id === "propTextColor" ? propTextColor?.value : undefined
        });
        logText("maniColorPanelDone", {
          id,
          type: item.type,
          textColor: after?.type === "text" ? after.textColor : undefined,
          fillColor: after && SHAPE_TYPES.has(after.type) ? after.fillColor : undefined
        });
      } catch {
        try {
          applySelectedProperties();
        } catch (error) {
          globalThis.__editifyReportWarn?.("props:applySelectedFallback", String(error?.message || error));
        }
      }
    } catch (e) {
      logText("maniColorCommitErr", { err: String(e) });
    }
  }

  function wireManiColorHandlers() {
    if (maniHandlersWired) return;
    maniHandlersWired = true;
    const d = requireDeps();
    const state = /** @type {{ selectedAnnotationId: string | null }} */ (d.state);
    const logText = /** @type {(tag: string, data?: object) => void} */ (d.logText);
    const tcm = /** @type {Record<string, Function>} */ (d.tcm);
    const sim = /** @type {Record<string, Function>} */ (d.sim);
    const captureTextColorSelectionBackup = /** @type {() => void} */ (
      d.captureTextColorSelectionBackup
    );

    document.addEventListener("mani-color-open", (ev) => {
      globalThis.__maniColorSelectionBackup = state.selectedAnnotationId;
      globalThis.__maniCtxShapeBackup = sim.getShapeCtxMenuTargetId();
      globalThis.__maniCtxTextBackup = tcm.getTextCtxMenuTargetId();
      const field = ev.detail?.inputId;
      if (field === "propTextColor" || field === "ctxTextColor") {
        if (!globalThis.__maniTextColorRangeBackup) {
          captureTextColorSelectionBackup();
        }
      } else {
        globalThis.__maniTextColorRangeBackup = null;
      }
      logText("maniColorPickerOpen", {
        backup: globalThis.__maniColorSelectionBackup,
        shapeCtxBackup: globalThis.__maniCtxShapeBackup,
        textCtxBackup: globalThis.__maniCtxTextBackup,
        field: ev.detail?.inputId
      });
    });

    document.addEventListener("mani-color-capture-text-selection", () => {
      captureTextColorSelectionBackup();
    });

    globalThis.maniAfterColorCommit = applyManiColorAfterPicker;

    document.addEventListener("mani-color-close", () => {
      globalThis.__maniTextColorRangeBackup = null;
    });
  }

  window.__editifyAnnotationProps = {
    bind,
    syncPropertyInputs,
    applySelectedProperties,
    applySelectedPropertiesLive,
    markBgTouchedAndApply,
    clickManiColorValidateButtonForInputId,
    applyManiColorAfterPicker,
    wireManiColorHandlers
  };
})();
