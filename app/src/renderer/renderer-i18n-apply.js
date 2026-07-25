/**
 * Application des libellés i18n au DOM (tooltips, menus, aria).
 * `window.__editifyI18nApply` - `bind()` depuis `renderer.js` avec `t` / refs DOM / `pdfv` (après `chrome.bind()`).
 */
(function () {
  "use strict";

  const SHAPE_TYPE_KEYS = {
    rect: "shapeRect",
    ellipse: "shapeEllipse",
    triangle: "shapeTriangle",
    line: "shapeLine",
    diamond: "shapeDiamond",
    pentagon: "shapePentagon",
    hexagon: "shapeHexagon",
    octagon: "shapeOctagon",
    star: "shapeStar",
    arrow: "shapeArrow",
    heart: "shapeHeart",
    cross: "shapeCross",
    parallelogram: "shapeParallelogram",
    trapezoid: "shapeTrapezoid"
  };

  const SHAPE_GRID_ICONS = {
    rect: "⬛",
    ellipse: "⚪",
    triangle: "🔺",
    line: "➖",
    diamond: "💠",
    pentagon: "🔷",
    hexagon: "⬢",
    octagon: "🛑",
    star: "⭐",
    arrow: "➡️",
    heart: "❤️",
    cross: "✚",
    parallelogram: "▱",
    trapezoid: "⏢"
  };

  const SHAPE_BTN_I18N_KEYS = Object.fromEntries(
    Object.keys(SHAPE_TYPE_KEYS).map((k) => [
      k,
      `shapeBtn${k.charAt(0).toUpperCase()}${k.slice(1)}`
    ])
  );

  const TOOLTIP_BY_ELEMENT_ID = {
    toolbarFileBtn: "ttToolbarFile",
    welcomeOpenPdfBtn: "ttToolbarOpenPdf",
    toolbarOpenPdfBtn: "ttToolbarOpenPdf",
    toolbarSaveAsBtn: "ttToolbarSaveAs",
    toolbarHtmlToPdfBtn: "ttHtmlToPdf",
    toolbarImagesToPdfBtn: "ttImagesToPdf",
    toolbarQuitBtn: "ttToolbarQuit",
    toolbarOptionsBtn: "ttToolbarOptions",
    mergeBtn: "ttMerge",
    splitBtn: "ttSplit",
    toolbarAboutMenuItem: "ttAboutMenu",
    toolbarSessionLogMenuItem: "ttSessionLog",
    toolbarLogFileMenuItem: "ttLogFileSettings",
    toolbarCheckUpdatesMenuItem: "ttCheckUpdates",
    toolbarCheckUpdatesStartupBtn: "ttCheckUpdatesStartup",
    toolbarAboutBtn: "ttAboutBtn",
    toolbarCloseBtn: "ttCloseApp",
    addTextBtn: "ttAddText",
    addShapeBtn: "ttAddShape",
    addImageBtn: "ttAddImage",
    deleteSelectedBtn: "ttDelete",
    undoBtn: "ttUndo",
    redoBtn: "ttRedo",
    rotateLeftBtn: "ttRotateLeft",
    rotateRightBtn: "ttRotateRight",
    validateTextColorBtn: "ttValidateTextColor",
    applyBgBtn: "ttValidateBg",
    applyPropsBtn: "ttApplyProps",
    prevBtn: "ttPrevPage",
    nextBtn: "ttNextPage",
    zoomOutBtn: "ttZoomOut",
    zoomInBtn: "ttZoomIn"
  };

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  function applyShapeGridLanguage() {
    if (!deps) return;
    const { t, shapeGrid } = deps;
    if (!shapeGrid) return;
    shapeGrid.querySelectorAll("button[data-shape]").forEach((btn) => {
      const shape = btn.getAttribute("data-shape");
      const key = shape ? SHAPE_BTN_I18N_KEYS[shape] : null;
      if (!key) return;
      const icon = SHAPE_GRID_ICONS[shape] || "";
      btn.textContent = `${icon} ${t(key)}`.trim();
    });
  }

  function applyDataTooltipsFromMap() {
    if (!deps) return;
    const { t } = deps;
    for (const [id, i18nKey] of Object.entries(TOOLTIP_BY_ELEMENT_ID)) {
      const el = document.getElementById(id);
      if (el) el.setAttribute("data-tooltip", t(i18nKey));
    }
  }

  function applyContextMenusLanguage() {
    if (!deps) return;
    const { t, blankAddTextBtn, blankAddShapeBtn, blankAddImageBtn } = deps;
    const setEl = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    };
    setEl("ctxTextMenuTitle", "ctxMenuText");
    setEl("ctxShapeMenuTitle", "ctxMenuShape");
    setEl("ctxImageMenuTitle", "ctxMenuImage");
    setEl("blankCanvasMenuTitle", "ctxBlankTitle");
    setEl("ctxLblTextRotation", "ctxRotationDeg");
    setEl("ctxLblTextOpacity", "ctxOpacityPctLabel");
    setEl("ctxLblFont", "font");
    setEl("ctxLblSize", "size");
    setEl("ctxLblColor", "ctxMenuColor");
    setEl("ctxLblBg", "bg");
    setEl("ctxLblShapeRotation", "ctxRotationDeg");
    setEl("ctxLblShapeOpacity", "ctxOpacityPctLabel");
    setEl("ctxLblShapeFill", "shapeFill");
    setEl("ctxLblShapeFillOp", "shapeFillOp");
    setEl("ctxLblShapeStroke", "shapeStroke");
    setEl("ctxLblShapeStrokeOp", "shapeStrokeOp");
    setEl("ctxLblShapeStrokeW", "ctxStrokeWidthPx");
    setEl("ctxLblShapeBackdrop", "ctxShapeBackdropShort");
    setEl("ctxLblShapeBackdropOp", "shapeBackdropOp");
    setEl("ctxLblImageRotation", "ctxRotationDeg");
    setEl("ctxLblImageOpacity", "ctxOpacityPctLabel");
    const tbg = document.getElementById("ctxTextBgClear");
    if (tbg) tbg.textContent = t("ctxTextBgClear");
    setEl("ctxShapeFillClear", "ctxShapeFillClear");
    setEl("ctxShapeStrokeClear", "ctxShapeStrokeClear");
    setEl("ctxShapeBackdropClear", "ctxShapeBackdropClear");
    if (blankAddTextBtn) blankAddTextBtn.textContent = `🔤 ${t("blankAddText")}`;
    if (blankAddShapeBtn) blankAddShapeBtn.textContent = `🔷 ${t("blankAddShape")}`;
    if (blankAddImageBtn) blankAddImageBtn.textContent = `🖼️ ${t("blankAddImage")}`;
  }

  function setLabelPrefix(inputId, value) {
    const input = document.getElementById(inputId);
    const label = input?.closest("label");
    if (!label || !label.firstChild) return;
    label.firstChild.nodeValue = `${value} `;
  }

  /**
   * Applique une table de bindings i18n.
   * @param {(key: string) => string} t
   * @param {Array<{ getEl: () => Element | null | undefined, key: string, mode?: string }>} rows
   */
  function applyBindings(t, rows) {
    for (const row of rows) {
      const el = row.getEl();
      if (!el) continue;
      const mode = row.mode || "text";
      if (mode === "html") {
        el.innerHTML = t(row.key);
      } else if (mode === "aria") {
        el.setAttribute("aria-label", t(row.key));
      } else if (mode === "title") {
        el.setAttribute("title", t(row.key));
      } else if (mode === "titleAndText") {
        const v = t(row.key);
        el.textContent = v;
        el.title = v;
      } else if (mode === "titleAndAria") {
        const v = t(row.key);
        el.setAttribute("title", v);
        el.setAttribute("aria-label", v);
      } else if (mode === "textColon") {
        el.textContent = `${t(row.key)} :`;
      } else {
        el.textContent = t(row.key);
      }
    }
  }

  /** @param {() => Element | null | undefined} getEl */
  function byId(id) {
    return () => document.getElementById(id);
  }

  /** @param {() => Element | null | undefined} getEl */
  function bySel(sel) {
    return () => document.querySelector(sel);
  }

  function applyToolbarZone(d) {
    const { t } = d;
    applyBindings(t, [
      { getEl: () => d.addTextBtn, key: "addText" },
      { getEl: () => d.addShapeBtn, key: "addShape" },
      { getEl: () => d.addImageBtn, key: "addImage" },
      { getEl: () => d.deleteSelectedBtn, key: "del" },
      { getEl: () => d.undoBtn, key: "undo" },
      { getEl: () => d.redoBtn, key: "redo" },
      { getEl: () => d.rotateLeftBtn, key: "rotateLeft" },
      { getEl: () => d.rotateRightBtn, key: "rotateRight" },
      { getEl: () => d.applyPropsBtn, key: "apply" },
      { getEl: () => d.validateTextColorBtn, key: "validate" },
      { getEl: () => d.applyBgBtn, key: "validate" },
      { getEl: () => d.validateShapeFillBtn, key: "validate" },
      { getEl: () => d.validateShapeStrokeBtn, key: "validate" },
      { getEl: () => d.validateShapeBackdropBtn, key: "validate" },
      { getEl: () => d.toolbarFileBtn, key: "fileMenu" },
      { getEl: () => d.toolbarOptionsBtn, key: "optionsMenu" },
      { getEl: () => d.menuLangLabel, key: "menuLang" },
      { getEl: () => d.menuToolsLabel, key: "menuTools" },
      { getEl: () => d.menuInfoLabel, key: "menuInfo" },
      { getEl: () => d.toolbarOpenPdfBtn, key: "openPdf" },
      { getEl: () => d.toolbarSaveAsBtn, key: "saveAs" },
      { getEl: () => d.toolbarHtmlToPdfBtn, key: "htmlToPdf" },
      { getEl: () => d.toolbarImagesToPdfBtn, key: "imagesToPdf" },
      { getEl: () => d.toolbarQuitBtn, key: "quit" },
      { getEl: () => d.toolbarAboutMenuItem, key: "about" },
      { getEl: () => d.toolbarSessionLogMenuItem, key: "menuSessionLog" },
      { getEl: () => d.toolbarLogFileMenuItem, key: "menuLogFile" },
      { getEl: () => d.menuUpdatesLabel, key: "menuUpdatesLabel" },
      { getEl: () => d.toolbarCheckUpdatesMenuItem, key: "menuCheckUpdatesNow" },
      { getEl: () => d.toolbarCheckUpdatesStartupBtn, key: "menuCheckUpdatesStartup" },
      { getEl: () => d.sessionLogTitleEl, key: "sessionLogTitle" },
      { getEl: () => d.sessionLogHint, key: "sessionLogHint" },
      { getEl: () => d.logFileSettingsTitleEl, key: "logFileSettingsTitle" },
      { getEl: () => d.logFileSettingsHint, key: "logFileSettingsHint" },
      { getEl: () => d.logFileCurrentPathLabel, key: "logFileCurrentPath" },
      { getEl: () => d.logFileDefaultPathLabel, key: "logFileDefaultPath" },
      { getEl: () => d.logFileBrowseBtn, key: "logFileBrowse" },
      { getEl: () => d.logFileResetBtn, key: "logFileReset" },
      { getEl: () => d.logFileCloseBtn, key: "closeAria", mode: "aria" },
      { getEl: () => d.sessionLogCloseBtn, key: "closeAria", mode: "aria" },
      { getEl: () => d.thumbsTitle, key: "thumbs" },
      { getEl: () => d.changesTitle, key: "changes" },
      { getEl: () => d.prevBtn, key: "prevPage" },
      { getEl: () => d.nextBtn, key: "nextPage" }
    ]);
    try {
      document
        .getElementById("logFileSettingsModal")
        ?.setAttribute("aria-label", t("logFileSettingsTitle"));
    } catch {
      /* intentional: log settings modal aria-label i18n */
    }
  }

  function applyAboutWelcomeZone(d) {
    const { t } = d;
    try {
      applyBindings(t, [{ getEl: () => d.aboutRgpd, key: "rgpdHtml", mode: "html" }]);
    } catch {
      /* intentional: about RGPD html i18n DOM best-effort */
    }
    try {
      applyBindings(t, [
        { getEl: () => d.aboutTitleEl, key: "aboutTitle" },
        { getEl: () => d.aboutCreditsEl, key: "aboutCreditsHtml", mode: "html" }
      ]);
    } catch {
      /* intentional: about title credits i18n best-effort */
    }
    try {
      applyBindings(t, [
        { getEl: () => d.mergeBtn, key: "merge" },
        { getEl: () => d.splitBtn, key: "split" }
      ]);
    } catch {
      /* intentional: merge split button labels i18n */
    }
    try {
      document.title = t("appName");
      applyBindings(t, [
        { getEl: byId("appTitle"), key: "appName" },
        { getEl: byId("welcomeTitle"), key: "welcomeTitle" },
        { getEl: byId("welcomeSubtitle"), key: "welcomeSubtitleHtml", mode: "html" },
        { getEl: byId("welcomeOpenPdfBtn"), key: "openPdf" }
      ]);
    } catch {
      /* intentional: welcome screen strings i18n best-effort */
    }
  }

  function applyPropsZone(d) {
    const { t } = d;
    setLabelPrefix("propWidth", t("width"));
    setLabelPrefix("propHeight", t("height"));
    setLabelPrefix("propRotation", t("rotation"));
    setLabelPrefix("propOpacity", t("opacity"));
    setLabelPrefix("propTextColor", t("txt"));
    setLabelPrefix("propBgColor", t("bg"));
    try {
      applyBindings(t, [
        { getEl: byId("propMarginsLabel"), key: "propMargins" },
        { getEl: byId("propFontFamilyLabel"), key: "font" },
        { getEl: byId("propFontSizeLabel"), key: "size" }
      ]);
    } catch {
      /* intentional: props panel labels i18n best-effort */
    }
    applyBindings(t, [
      { getEl: byId("shapeFillLabel"), key: "shapeFill" },
      { getEl: byId("shapeFillOpLabel"), key: "shapeFillOp" },
      { getEl: byId("shapeStrokeLabel"), key: "shapeStroke" },
      { getEl: byId("shapeStrokeOpLabel"), key: "shapeStrokeOp" },
      { getEl: byId("shapeStrokeWLabel"), key: "shapeStrokeW" },
      { getEl: byId("shapeBackdropLabel"), key: "shapeBackdrop" },
      { getEl: byId("shapeBackdropOpLabel"), key: "shapeBackdropOp" }
    ]);
    if (!d.getActiveTab()) d.pageInfo.textContent = t("noPdf");
    else d.pdfv.syncPageInfoFooter?.(d.getActiveTab().currentPage || 1);
    applyBindings(t, [{ getEl: () => d.toolbarF10Hint, key: "f10Toolbar", mode: "titleAndText" }]);
  }

  function applySpellZone(d) {
    try {
      applyBindings(d.t, [
        { getEl: byId("ctxSpellTitleEl"), key: "ctxSpellTitle" },
        { getEl: byId("ctxSpellWordLabel"), key: "ctxSpellWord", mode: "textColon" },
        { getEl: byId("ctxSpellAddDict"), key: "ctxSpellAddDict" },
        { getEl: byId("ctxSpellRemoveDict"), key: "ctxSpellRemoveDict" }
      ]);
    } catch {
      /* intentional: spell ctx menu strings i18n best-effort */
    }
  }

  function applyMenusAndShapeModalZone(d) {
    try {
      applyContextMenusLanguage();
    } catch {
      /* intentional: applyContextMenusLanguage cascade best-effort */
    }
    applyDataTooltipsFromMap();
    applyShapeGridLanguage();
    try {
      applyBindings(d.t, [
        { getEl: byId("shapeModalTitleEl"), key: "shapePickerTitle" },
        { getEl: () => d.shapeModal, key: "shapeModalAria", mode: "aria" }
      ]);
    } catch {
      /* intentional: shape modal title aria i18n */
    }
  }

  function applySplitZone(d) {
    try {
      applyBindings(d.t, [
        { getEl: byId("splitWorkspaceTitle"), key: "splitWorkspaceTitle" },
        { getEl: byId("splitWorkspaceHint"), key: "splitWorkspaceHint" },
        { getEl: () => d.splitWorkspaceAddGroupBtn, key: "splitAddGroup" },
        { getEl: () => d.splitWorkspaceValidateBtn, key: "splitValidate" },
        { getEl: () => d.splitWorkspaceCloseBtn, key: "closeAria", mode: "aria" }
      ]);
    } catch {
      /* intentional: split workspace chrome i18n best-effort */
    }
  }

  function applyColorZone(d) {
    try {
      applyBindings(d.t, [
        { getEl: byId("maniColorModalTitle"), key: "maniColorTitle" },
        { getEl: byId("maniColorValidateBtn"), key: "maniColorValidate" },
        { getEl: byId("maniColorEyedropper"), key: "maniColorEyedropper", mode: "titleAndAria" },
        { getEl: byId("maniColorModalClose"), key: "closeAria", mode: "aria" },
        {
          getEl: bySel("#maniColorModal .mani-color-rgb-grid"),
          key: "maniColorRgbAria",
          mode: "aria"
        }
      ]);
    } catch {
      /* intentional: mani color modal aria i18n */
    }
  }

  function applyChromeAriaZone(d) {
    const { t } = d;
    try {
      applyBindings(t, [{ getEl: byId("changesCtxDeleteBtn"), key: "del" }]);
    } catch {
      /* intentional: changes delete button label i18n */
    }
    try {
      applyBindings(t, [
        { getEl: byId("ctxTextBold"), key: "ctxFmtBold", mode: "title" },
        { getEl: byId("ctxTextItalic"), key: "ctxFmtItalic", mode: "title" },
        { getEl: byId("ctxTextUnderline"), key: "ctxFmtUnderline", mode: "title" }
      ]);
    } catch {
      /* intentional: text format button titles i18n */
    }
    try {
      applyBindings(t, [
        { getEl: () => d.thumbsBar, key: "thumbs", mode: "aria" },
        { getEl: () => d.changesBar, key: "changes", mode: "aria" },
        { getEl: bySel(".workbench"), key: "ariaWorkbench", mode: "aria" },
        { getEl: bySel(".status-pages"), key: "ariaNavPages", mode: "aria" },
        { getEl: bySel(".status-zoom"), key: "ariaZoom", mode: "aria" },
        { getEl: () => d.appToolbar, key: "ariaAppToolbar", mode: "aria" },
        { getEl: () => d.aboutPopover, key: "aboutTitle", mode: "aria" },
        { getEl: () => d.toolbarAboutBtn, key: "about", mode: "aria" },
        { getEl: () => d.aboutCloseBtn, key: "closeAria", mode: "aria" },
        { getEl: () => d.closeShapeModalBtn, key: "closeAria", mode: "aria" }
      ]);
    } catch {
      /* intentional: toolbar about aria labels i18n */
    }
  }

  function applyPostLanguageHooks(d) {
    try {
      const tr = d.ensureToastRoot();
      tr?.setAttribute?.("aria-label", d.t("toastAria"));
    } catch {
      /* intentional: toast root aria-label i18n best-effort */
    }
    try {
      d.pdfv.updateZoomUI();
    } catch {
      /* intentional: updateZoomUI after language apply */
    }
    try {
      globalThis.__editifyLogFileSettingsUi?.applyLanguage?.();
    } catch {
      /* intentional: log file settings ui i18n best-effort */
    }
  }

  function applyLanguage() {
    if (!deps) return;
    const d = deps;
    applyToolbarZone(d);
    applyAboutWelcomeZone(d);
    applyPropsZone(d);
    applySpellZone(d);
    applyMenusAndShapeModalZone(d);
    applySplitZone(d);
    applyColorZone(d);
    applyChromeAriaZone(d);
    applyPostLanguageHooks(d);
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = /** @type {typeof deps} */ (next);
  }

  window.__editifyI18nApply = {
    SHAPE_TYPE_KEYS,
    bind,
    applyLanguage
  };
})();
