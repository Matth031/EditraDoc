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
    toolbarQuitBtn: "ttToolbarQuit",
    toolbarOptionsBtn: "ttToolbarOptions",
    mergeBtn: "ttMerge",
    splitBtn: "ttSplit",
    toolbarAboutMenuItem: "ttAboutMenu",
    toolbarSessionLogMenuItem: "ttSessionLog",
    toolbarAboutBtn: "ttAboutBtn",
    toolbarCloseBtn: "ttCloseApp",
    addTextBtn: "ttAddText",
    addShapeBtn: "ttAddShape",
    addImageBtn: "ttAddImage",
    deleteSelectedBtn: "ttDelete",
    undoBtn: "ttUndo",
    redoBtn: "ttRedo",
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

  function applyLanguage() {
    if (!deps) return;
    const {
      t,
      getActiveTab,
      pdfv,
      ensureToastRoot,
      addTextBtn,
      addShapeBtn,
      addImageBtn,
      deleteSelectedBtn,
      undoBtn,
      redoBtn,
      applyPropsBtn,
      validateTextColorBtn,
      applyBgBtn,
      validateShapeFillBtn,
      validateShapeStrokeBtn,
      validateShapeBackdropBtn,
      toolbarFileBtn,
      toolbarOptionsBtn,
      menuLangLabel,
      menuToolsLabel,
      menuInfoLabel,
      toolbarOpenPdfBtn,
      toolbarSaveAsBtn,
      toolbarHtmlToPdfBtn,
      toolbarQuitBtn,
      toolbarAboutMenuItem,
      toolbarSessionLogMenuItem,
      sessionLogTitleEl,
      sessionLogHint,
      thumbsTitle,
      changesTitle,
      prevBtn,
      nextBtn,
      aboutRgpd,
      aboutTitleEl,
      aboutCreditsEl,
      mergeBtn,
      splitBtn,
      pageInfo,
      toolbarF10Hint,
      shapeModal,
      splitWorkspaceAddGroupBtn,
      splitWorkspaceValidateBtn,
      splitWorkspaceCloseBtn,
      thumbsBar,
      changesBar,
      appToolbar,
      aboutPopover,
      toolbarAboutBtn,
      aboutCloseBtn,
      closeShapeModalBtn
    } = deps;

    addTextBtn.textContent = t("addText");
    addShapeBtn.textContent = t("addShape");
    addImageBtn.textContent = t("addImage");
    deleteSelectedBtn.textContent = t("del");
    undoBtn.textContent = t("undo");
    redoBtn.textContent = t("redo");
    applyPropsBtn.textContent = t("apply");
    if (validateTextColorBtn) validateTextColorBtn.textContent = t("validate");
    if (applyBgBtn) applyBgBtn.textContent = t("validate");
    if (validateShapeFillBtn) validateShapeFillBtn.textContent = t("validate");
    if (validateShapeStrokeBtn) validateShapeStrokeBtn.textContent = t("validate");
    if (validateShapeBackdropBtn) validateShapeBackdropBtn.textContent = t("validate");
    if (toolbarFileBtn) toolbarFileBtn.textContent = t("fileMenu");
    if (toolbarOptionsBtn) toolbarOptionsBtn.textContent = t("optionsMenu");
    if (menuLangLabel) menuLangLabel.textContent = t("menuLang");
    if (menuToolsLabel) menuToolsLabel.textContent = t("menuTools");
    if (menuInfoLabel) menuInfoLabel.textContent = t("menuInfo");
    if (toolbarOpenPdfBtn) toolbarOpenPdfBtn.textContent = t("openPdf");
    if (toolbarSaveAsBtn) toolbarSaveAsBtn.textContent = t("saveAs");
    if (toolbarHtmlToPdfBtn) toolbarHtmlToPdfBtn.textContent = t("htmlToPdf");
    if (toolbarQuitBtn) toolbarQuitBtn.textContent = t("quit");
    if (toolbarAboutMenuItem) toolbarAboutMenuItem.textContent = t("about");
    if (toolbarSessionLogMenuItem) toolbarSessionLogMenuItem.textContent = t("menuSessionLog");
    if (sessionLogTitleEl) sessionLogTitleEl.textContent = t("sessionLogTitle");
    if (sessionLogHint) sessionLogHint.textContent = t("sessionLogHint");
    if (thumbsTitle) thumbsTitle.textContent = t("thumbs");
    if (changesTitle) changesTitle.textContent = t("changes");
    if (prevBtn) prevBtn.textContent = t("prevPage");
    if (nextBtn) nextBtn.textContent = t("nextPage");
    try {
      if (aboutRgpd) aboutRgpd.innerHTML = t("rgpdHtml");
    } catch {
      /* ignore */
    }
    try {
      if (aboutTitleEl) aboutTitleEl.textContent = t("aboutTitle");
      if (aboutCreditsEl) aboutCreditsEl.innerHTML = t("aboutCreditsHtml");
    } catch {
      /* ignore */
    }
    try {
      if (mergeBtn) mergeBtn.textContent = t("merge");
      if (splitBtn) splitBtn.textContent = t("split");
    } catch {
      /* ignore */
    }
    try {
      document.title = t("appName");
      const at = document.getElementById("appTitle");
      if (at) at.textContent = t("appName");
      const wt = document.getElementById("welcomeTitle");
      if (wt) wt.textContent = t("welcomeTitle");
      const wsub = document.getElementById("welcomeSubtitle");
      if (wsub) wsub.innerHTML = t("welcomeSubtitleHtml");
      const wOpen = document.getElementById("welcomeOpenPdfBtn");
      if (wOpen) wOpen.textContent = t("openPdf");
    } catch {
      /* ignore */
    }
    setLabelPrefix("propWidth", t("width"));
    setLabelPrefix("propHeight", t("height"));
    setLabelPrefix("propRotation", t("rotation"));
    setLabelPrefix("propOpacity", t("opacity"));
    setLabelPrefix("propTextColor", t("txt"));
    setLabelPrefix("propBgColor", t("bg"));
    try {
      const propMarginsLabel = document.getElementById("propMarginsLabel");
      if (propMarginsLabel) propMarginsLabel.textContent = t("propMargins");
      const propFontFamilyLabel = document.getElementById("propFontFamilyLabel");
      if (propFontFamilyLabel) propFontFamilyLabel.textContent = t("font");
      const propFontSizeLabel = document.getElementById("propFontSizeLabel");
      if (propFontSizeLabel) propFontSizeLabel.textContent = t("size");
    } catch {
      /* ignore */
    }
    const sfl = document.getElementById("shapeFillLabel");
    const sfol = document.getElementById("shapeFillOpLabel");
    const ssl = document.getElementById("shapeStrokeLabel");
    const ssol = document.getElementById("shapeStrokeOpLabel");
    const sswl = document.getElementById("shapeStrokeWLabel");
    const sbd = document.getElementById("shapeBackdropLabel");
    const sbdol = document.getElementById("shapeBackdropOpLabel");
    if (sfl) sfl.textContent = t("shapeFill");
    if (sfol) sfol.textContent = t("shapeFillOp");
    if (ssl) ssl.textContent = t("shapeStroke");
    if (ssol) ssol.textContent = t("shapeStrokeOp");
    if (sswl) sswl.textContent = t("shapeStrokeW");
    if (sbd) sbd.textContent = t("shapeBackdrop");
    if (sbdol) sbdol.textContent = t("shapeBackdropOp");
    if (!getActiveTab()) pageInfo.textContent = t("noPdf");
    if (toolbarF10Hint) {
      const hint = t("f10Toolbar");
      toolbarF10Hint.textContent = hint;
      toolbarF10Hint.title = hint;
    }
    try {
      const st = document.getElementById("ctxSpellTitleEl");
      if (st) st.textContent = t("ctxSpellTitle");
      const wl = document.getElementById("ctxSpellWordLabel");
      if (wl) wl.textContent = `${t("ctxSpellWord")} :`;
      const ad = document.getElementById("ctxSpellAddDict");
      if (ad) ad.textContent = t("ctxSpellAddDict");
      const rd = document.getElementById("ctxSpellRemoveDict");
      if (rd) rd.textContent = t("ctxSpellRemoveDict");
    } catch {
      /* ignore */
    }
    try {
      applyContextMenusLanguage();
    } catch {
      /* ignore */
    }
    applyDataTooltipsFromMap();
    applyShapeGridLanguage();
    try {
      const smt = document.getElementById("shapeModalTitleEl");
      if (smt) smt.textContent = t("shapePickerTitle");
      if (shapeModal) shapeModal.setAttribute("aria-label", t("shapeModalAria"));
    } catch {
      /* ignore */
    }
    try {
      const swt = document.getElementById("splitWorkspaceTitle");
      if (swt) swt.textContent = t("splitWorkspaceTitle");
      const swh = document.getElementById("splitWorkspaceHint");
      if (swh) swh.textContent = t("splitWorkspaceHint");
      if (splitWorkspaceAddGroupBtn) splitWorkspaceAddGroupBtn.textContent = t("splitAddGroup");
      if (splitWorkspaceValidateBtn) splitWorkspaceValidateBtn.textContent = t("splitValidate");
      splitWorkspaceCloseBtn?.setAttribute("aria-label", t("closeAria"));
    } catch {
      /* ignore */
    }
    try {
      const mct = document.getElementById("maniColorModalTitle");
      if (mct) mct.textContent = t("maniColorTitle");
      const mcv = document.getElementById("maniColorValidateBtn");
      if (mcv) mcv.textContent = t("maniColorValidate");
      const mce = document.getElementById("maniColorEyedropper");
      if (mce) {
        mce.setAttribute("title", t("maniColorEyedropper"));
        mce.setAttribute("aria-label", t("maniColorEyedropper"));
      }
      document.getElementById("maniColorModalClose")?.setAttribute("aria-label", t("closeAria"));
      document
        .querySelector("#maniColorModal .mani-color-rgb-grid")
        ?.setAttribute("aria-label", t("maniColorRgbAria"));
    } catch {
      /* ignore */
    }
    try {
      const del = document.getElementById("changesCtxDeleteBtn");
      if (del) del.textContent = t("del");
    } catch {
      /* ignore */
    }
    try {
      document.getElementById("ctxTextBold")?.setAttribute("title", t("ctxFmtBold"));
      document.getElementById("ctxTextItalic")?.setAttribute("title", t("ctxFmtItalic"));
      document.getElementById("ctxTextUnderline")?.setAttribute("title", t("ctxFmtUnderline"));
    } catch {
      /* ignore */
    }
    try {
      thumbsBar?.setAttribute("aria-label", t("thumbs"));
      changesBar?.setAttribute("aria-label", t("changes"));
      document.querySelector(".workbench")?.setAttribute("aria-label", t("ariaWorkbench"));
      document.querySelector(".status-pages")?.setAttribute("aria-label", t("ariaNavPages"));
      document.querySelector(".status-zoom")?.setAttribute("aria-label", t("ariaZoom"));
      appToolbar?.setAttribute("aria-label", t("ariaAppToolbar"));
      aboutPopover?.setAttribute("aria-label", t("aboutTitle"));
      toolbarAboutBtn?.setAttribute("aria-label", t("about"));
      aboutCloseBtn?.setAttribute("aria-label", t("closeAria"));
      closeShapeModalBtn?.setAttribute("aria-label", t("closeAria"));
    } catch {
      /* ignore */
    }
    try {
      const tr = ensureToastRoot();
      tr?.setAttribute?.("aria-label", t("toastAria"));
    } catch {
      /* ignore */
    }
    try {
      pdfv.updateZoomUI();
    } catch {
      /* ignore */
    }
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
