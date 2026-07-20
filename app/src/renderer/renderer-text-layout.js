/**
 * Mesure et layout des annotations texte (boîte, wrap, auto-grow, export).
 * Chargé avant `renderer.js` ; expose `window.__editifyTextLayout` — `bind()` depuis `renderer.js`.
 */
(function () {
  "use strict";

  if (!window.__editifyTextHtml) {
    throw new Error("[editify] renderer-text-html.js doit précéder renderer-text-layout.js.");
  }
  const { plainTextForAnnotationItem, setSanitizedHtml } = window.__editifyTextHtml;

  /**
   * @typedef {object} TextLayoutDeps
   * @property {() => { width: number, height: number }} getSafeZoneSize
   * @property {(tab: object, pageKey: string, canvases?: object) => { width: number, height: number }} getSafeZoneSizeForPage
   * @property {(item: object, zone: { width: number, height: number }) => void} fitAnnotationToSafeZone
   * @property {(root: Element) => HTMLElement | null} getAnnotationTextEditor
   * @property {() => string | null} getEditingAnnotationId
   * @property {() => void} scheduleAutoSave
   */

  /** @type {TextLayoutDeps | null} */
  let deps = null;

  /** @type {HTMLElement | null} */
  let measureTextNode = null;

  /** @param {TextLayoutDeps} next */
  function bind(next) {
    deps = next;
  }

  /** @returns {TextLayoutDeps} */
  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] __editifyTextLayout.bind() doit être appelé depuis renderer.js.");
    }
    return deps;
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function ensureMeasureTextNode() {
    if (measureTextNode) return measureTextNode;
    const node = document.createElement("div");
    node.style.position = "fixed";
    node.style.left = "-10000px";
    node.style.top = "-10000px";
    node.style.visibility = "hidden";
    node.style.whiteSpace = "pre-wrap";
    node.style.wordBreak = "break-word";
    node.style.overflowWrap = "break-word";
    node.style.pointerEvents = "none";
    node.style.margin = "0";
    node.style.border = "0";
    node.style.boxSizing = "border-box";
    document.body.appendChild(node);
    measureTextNode = node;
    return node;
  }

  function applyMeasureTextNodeStyles(m, item, opts = {}) {
    const { width = 20, whiteSpace = "pre-wrap" } = opts;
    const padding = item.padding ?? 6;
    const fontSize = item.fontSize ?? 14;
    m.style.padding = `${padding}px`;
    m.style.fontFamily = item.fontFamily || "Arial";
    m.style.fontSize = `${fontSize}px`;
    m.style.lineHeight = "1.35";
    m.style.whiteSpace = whiteSpace;
    const noSoftWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
    m.style.wordBreak = noSoftWrap ? "normal" : "break-word";
    m.style.overflowWrap = noSoftWrap ? "normal" : "break-word";
    if (width === "auto") {
      m.style.width = "auto";
    } else {
      m.style.width = `${Math.max(20, Math.floor(width))}px`;
    }
  }

  /** Largeur initiale d'une zone texte : environ deux lettres (référence « Mm »). */
  function getDefaultTextBoxWidth(item) {
    if (!item || item.type !== "text") return 20;
    const m = ensureMeasureTextNode();
    applyMeasureTextNodeStyles(m, item, { width: "auto", whiteSpace: "nowrap" });
    m.textContent = "Mm";
    return Math.max(20, Math.ceil(m.scrollWidth || 0));
  }

  function measureLineWidthNoWrap(item, lineText) {
    const m = ensureMeasureTextNode();
    applyMeasureTextNodeStyles(m, item, { width: "auto", whiteSpace: "nowrap" });
    m.textContent = lineText === "" ? "\u00a0" : lineText;
    return Math.ceil(m.scrollWidth || 0);
  }

  /**
   * Largeur d'un espace virtuel en fin de ligne pendant l'édition (non persisté dans le texte).
   * Proportionnel à la police courante de la fenêtre texte.
   */
  function getVirtualTextTailWidth(item) {
    if (!item || item.type !== "text") return 0;
    const spaceW = measureLineWidthNoWrap(item, " ");
    const fontSize = Math.max(8, Math.min(96, Number(item.fontSize) || 14));
    return Math.max(1, spaceW || Math.ceil(fontSize * 0.28));
  }

  /** Réserve visuellement un « blanc » final pendant la saisie (padding, pas de caractère). */
  function applyTextEditorVirtualTail(ed, item) {
    if (!ed || !item || item.type !== "text") return;
    const tail = getVirtualTextTailWidth(item);
    ed.style.paddingRight = tail > 0 ? `${tail}px` : "";
    ed.dataset.virtualTailPx = String(tail);
  }

  function clearTextEditorVirtualTail(ed) {
    if (!ed) return;
    ed.style.paddingRight = "";
    delete ed.dataset.virtualTailPx;
  }

  /** Largeur nécessaire pour afficher le texte sur une seule ligne (par ligne la plus longue). */
  function getRequiredTextWidth(item) {
    if (!item || item.type !== "text") return 20;
    const defaultW = getDefaultTextBoxWidth(item);
    const text = plainTextForAnnotationItem(item);
    if (!text) return defaultW;
    const lines = text.split(/\r?\n/);
    let maxW = defaultW;
    for (const line of lines) {
      maxW = Math.max(maxW, measureLineWidthNoWrap(item, line));
    }
    return maxW;
  }

  /**
   * Largeur requise du contenu texte (sans le blanc virtuel final de saisie).
   */
  function getTextContentRequiredWidth(item, ed) {
    const minW = getDefaultTextBoxWidth(item);
    const fromText = getRequiredTextWidth(item);
    if (!ed) return fromText;
    const pad = Math.max(0, Number(item.padding) || 6) * 2;
    const tail = getVirtualTextTailWidth(item);
    const scrollW = Math.ceil(ed.scrollWidth || 0);
    const contentScrollW = Math.max(0, scrollW - tail);
    const fromEditor = Math.max(minW, contentScrollW + pad);
    return Math.max(fromText, fromEditor);
  }

  /**
   * Largeur requise en édition : contenu + blanc virtuel final (non persisté).
   */
  function getLiveRequiredTextWidth(item, ed) {
    if (!ed) return getRequiredTextWidth(item);
    return getTextContentRequiredWidth(item, ed) + getVirtualTextTailWidth(item);
  }

  function getInitialTextAnnotationSize(textStyle = {}) {
    const item = {
      type: "text",
      textColor: "#111111",
      bgColor: null,
      halo: true,
      padding: 6,
      fontFamily: "Arial",
      fontSize: 14,
      ...textStyle
    };
    const w = getDefaultTextBoxWidth(item);
    const h = getRequiredTextHeightForWidth(item, w);
    return { w, h };
  }

  function getRequiredTextHeight(item) {
    if (!item || item.type !== "text") return 20;
    const padding = item.padding ?? 6;
    const fontSize = item.fontSize ?? 14;
    // Hauteur minimale d'une ligne, même si texte vide
    const minLine = Math.ceil(fontSize * 1.45 + 2 * padding);
    const text = plainTextForAnnotationItem(item);
    if (!text) return Math.max(20, minLine);

    const m = ensureMeasureTextNode();
    // Largeur du cadre = limites gauche/droite imposées par l'utilisateur
    const w = Math.max(20, Math.floor(item.w || 20));
    applyMeasureTextNodeStyles(m, item, { width: w, whiteSpace: "pre-wrap" });
    m.textContent = text;
    const needed = Math.ceil(m.scrollHeight || 0);
    return Math.max(20, minLine, needed);
  }

  function getRequiredTextHeightForWidth(item, width, layoutWhiteSpace = "pre-wrap") {
    if (!item || item.type !== "text") return 20;
    const padding = item.padding ?? 6;
    const fontSize = item.fontSize ?? 14;
    const minLine = Math.ceil(fontSize * 1.45 + 2 * padding);
    const text = plainTextForAnnotationItem(item);
    if (!text) return Math.max(20, minLine);

    const m = ensureMeasureTextNode();
    const w = Math.max(20, Math.floor(width || 20));
    const whiteSpace =
      layoutWhiteSpace === "pre" || layoutWhiteSpace === "nowrap" ? "pre" : "pre-wrap";
    applyMeasureTextNodeStyles(m, item, { width: w, whiteSpace });
    m.textContent = text;
    const needed = Math.ceil(m.scrollHeight || 0);
    return Math.max(20, minLine, needed);
  }

  function getMinWidthToFitHeight(item, height, maxWidth) {
    // Retourne la largeur minimale telle que le texte tienne dans "height".
    // Si impossible (même à maxWidth), retourne maxWidth.
    const h = Math.max(20, Math.floor(height || 20));
    const maxW = Math.max(20, Math.floor(maxWidth || item?.w || 20));
    let lo = 20;
    let hi = maxW;

    const fitsAtMax = getRequiredTextHeightForWidth(item, maxW) <= h + 1;
    if (!fitsAtMax) return maxW;

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const need = getRequiredTextHeightForWidth(item, mid);
      if (need <= h + 1) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  function getTextWrapState(item, zone, ed = null) {
    if (item?.textWrapManual) return "manual";
    const maxW = Math.max(20, zone.width - (item?.x || 0));
    const requiredW = ed ? getTextContentRequiredWidth(item, ed) : getRequiredTextWidth(item);
    if (requiredW > maxW) return "edge";
    return "auto";
  }

  function finalizeTextAnnotationLayout(item, zoneOpt) {
    if (!item || item.type !== "text") return;
    const d = requireDeps();
    const zone = zoneOpt?.width > 0 && zoneOpt?.height > 0 ? zoneOpt : d.getSafeZoneSize();
    const maxW = Math.max(20, zone.width - (item.x || 0));
    const maxH = Math.max(20, zone.height - (item.y || 0));
    const minW = getDefaultTextBoxWidth(item);
    if (item.textWrapManual) {
      item.w = Math.max(minW, Math.floor(item.w || minW));
      item.h = clamp(getRequiredTextHeightForWidth(item, item.w, "pre-wrap"), 20, maxH);
      return;
    }
    const rawRequiredW = getRequiredTextWidth(item);
    if (rawRequiredW > maxW) {
      item.w = maxW;
      item.h = clamp(getRequiredTextHeightForWidth(item, maxW, "pre-wrap"), 20, maxH);
    } else {
      item.w = Math.max(minW, rawRequiredW);
      item.h = clamp(getRequiredTextHeightForWidth(item, item.w, "pre"), 20, maxH);
    }
  }

  /** Ajuste largeur/hauteur des textes avant export (métriques ReportLab ≠ écran). */
  function annotationHasExplicitLineBreaks(item) {
    if (!item || item.type !== "text") return false;
    const plain = plainTextForAnnotationItem(item).replace(/\r\n/g, "\n");
    if (/\n/.test(plain)) return true;
    const html = String(item.textHtml || "");
    if (/<\s*br\b/i.test(html)) return true;
    try {
      const div = document.createElement("div");
      setSanitizedHtml(div, html);
      if (div.querySelectorAll("div, p, li").length > 1) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function ensureTextAnnotationsSizedForExport(tab, canvases) {
    if (!tab?.annotationsByPage) return;
    const d = requireDeps();
    for (const pageKey of Object.keys(tab.annotationsByPage)) {
      const zone = d.getSafeZoneSizeForPage(tab, pageKey, canvases);
      if (!zone.width || !zone.height) {
        window.__editifyPdfSave?.logExportAudit?.("text_size_skip_page", {
          pageKey,
          reason: "no_zone",
          zone
        });
        continue;
      }
      for (const item of tab.annotationsByPage[pageKey] || []) {
        if (item?.type !== "text") continue;
        const before = {
          id: item.id,
          x: Math.round(item.x || 0),
          y: Math.round(item.y || 0),
          w: Math.round(item.w || 0),
          h: Math.round(item.h || 0),
          textLen: String(item.text || "").length
        };
        if (item.textWrapManual || annotationHasExplicitLineBreaks(item)) {
          const w = Math.max(20, Math.floor(item.w || 20));
          item.h = Math.max(item.h || 20, getRequiredTextHeightForWidth(item, w, "pre-wrap"));
          d.fitAnnotationToSafeZone(item, zone);
          window.__editifyPdfSave?.logExportAudit?.("text_size_manual", {
            pageKey,
            zone,
            before,
            after: {
              x: Math.round(item.x || 0),
              y: Math.round(item.y || 0),
              w: Math.round(item.w || 0),
              h: Math.round(item.h || 0)
            }
          });
          continue;
        }
        finalizeTextAnnotationLayout(item, zone);
        const w = Math.max(20, Math.floor(item.w || 20));
        item.h = Math.max(item.h || 20, getRequiredTextHeightForWidth(item, w, "pre-wrap"));
        d.fitAnnotationToSafeZone(item, zone);
        window.__editifyPdfSave?.logExportAudit?.("text_size_auto", {
          pageKey,
          zone,
          before,
          after: {
            x: Math.round(item.x || 0),
            y: Math.round(item.y || 0),
            w: Math.round(item.w || 0),
            h: Math.round(item.h || 0)
          }
        });
      }
    }
  }

  function applyTextEditorLayoutStyles(ed, wrapState) {
    if (!ed) return;
    ed.classList.toggle("wrap-lines", wrapState === "manual" || wrapState === "edge");
    if (wrapState === "auto") {
      ed.style.whiteSpace = "pre";
      ed.style.wordBreak = "normal";
      ed.style.overflowWrap = "normal";
    } else {
      ed.style.whiteSpace = "pre-wrap";
      ed.style.wordBreak = "break-word";
      ed.style.overflowWrap = "break-word";
    }
  }

  function applyEditingTextAutoGrow(tab, item, node) {
    const d = requireDeps();
    const zone = d.getSafeZoneSize();
    const maxW = Math.max(20, zone.width - (item?.x || 0));
    const maxH = Math.max(20, zone.height - (item.y || 0));
    const ed = d.getAnnotationTextEditor(node);
    const helpers = window.__editifyTextCtxHelpers;
    /** @type {Range | null} */
    let savedRange = null;
    /** @type {{ start: number, end: number, collapsed: boolean } | null} */
    let caret = null;
    if (ed) {
      if (helpers?.saveEditorSelectionRange) {
        savedRange = helpers.saveEditorSelectionRange(ed);
      }
      if (helpers?.getPlainSelectionOffsetsInEditor) {
        const o = helpers.getPlainSelectionOffsetsInEditor(ed);
        caret = { start: o.start, end: o.end, collapsed: o.collapsed };
      }
      applyTextEditorVirtualTail(ed, item);
    }
    const wrapState = getTextWrapState(item, zone, ed);
    const minW = getDefaultTextBoxWidth(item);
    /** @type {number} */
    let nextW;
    /** @type {number} */
    let nextH;

    if (wrapState === "manual") {
      nextW = Math.max(minW, Math.floor(item.w || minW));
      nextH = clamp(getRequiredTextHeightForWidth(item, nextW, "pre-wrap"), 20, maxH);
    } else if (wrapState === "edge") {
      nextW = maxW;
      nextH = clamp(getRequiredTextHeightForWidth(item, nextW, "pre-wrap"), 20, maxH);
      if (ed) {
        const liveH = Math.ceil(ed.scrollHeight || 0);
        if (liveH > 0) {
          nextH = clamp(Math.max(nextH, liveH), 20, maxH);
        }
      }
    } else {
      const rawRequiredW = getLiveRequiredTextWidth(item, ed);
      nextW = Math.max(minW, Math.min(rawRequiredW, maxW));
      nextH = clamp(getRequiredTextHeightForWidth(item, nextW, "pre"), 20, maxH);
      if (ed) {
        const liveH = Math.ceil(ed.scrollHeight || 0);
        if (liveH > 0) {
          nextH = clamp(Math.max(nextH, liveH), 20, maxH);
        }
      }
    }

    applyTextEditorLayoutStyles(ed, wrapState);
    item.w = nextW;
    item.h = nextH;
    applyTextAnnotationBoxSize(node, item.w, item.h);
    if (ed) {
      ed.style.height = "auto";
      ed.style.minHeight = "1.2em";
      ed.style.height = `${Math.ceil(ed.scrollHeight)}px`;
      const restoreCaret = () => {
        if (!caret || !helpers?.setPlainSelectionInEditor) return false;
        try {
          return helpers.setPlainSelectionInEditor(
            ed,
            caret.start,
            caret.collapsed ? caret.start : caret.end
          );
        } catch {
          return false;
        }
      };
      const restored = restoreCaret();
      if (!restored && savedRange && helpers?.restoreEditorSelectionRange) {
        helpers.restoreEditorSelectionRange(ed, savedRange);
      }
      if (caret) {
        requestAnimationFrame(() => {
          try {
            restoreCaret();
            ed.focus();
          } catch {
            /* ignore */
          }
        });
      }
    }
  }

  function applyTextAnnotationBoxSize(node, w, h) {
    if (!node) return;
    node.style.width = `${Math.max(20, Math.floor(w || 20))}px`;
    node.style.height = `${Math.max(20, Math.floor(h || 20))}px`;
  }

  function scheduleAutoGrowText(tab, item, node, source = "render") {
    if (!tab || !item || item.type !== "text" || !node) return;
    const d = requireDeps();
    const run = () => {
      try {
        const isEditing = source === "input" || d.getEditingAnnotationId() === item.id;
        if (isEditing) {
          applyEditingTextAutoGrow(tab, item, node);
          if (source === "input") d.scheduleAutoSave();
          return;
        }

        const zone = d.getSafeZoneSize();
        const maxH = Math.max(20, zone.height - (item.y || 0));
        const required = getRequiredTextHeight(item);
        if (required <= (item.h || 0) + 1) return;
        const nextH = clamp(required, 20, maxH);
        if (nextH <= (item.h || 0) + 1) return;
        item.h = nextH;
        applyTextAnnotationBoxSize(node, item.w, item.h);
        d.scheduleAutoSave();
      } catch (error) {
        try {
          globalThis.__editifyReportError?.("text:autoGrow", String(error), {
            id: item?.id,
            source
          });
        } catch {
          /* ignore */
        }
      }
    };
    if (source === "input") {
      run();
      return;
    }
    requestAnimationFrame(run);
  }

  window.__editifyTextLayout = {
    bind,
    getDefaultTextBoxWidth,
    measureLineWidthNoWrap,
    getVirtualTextTailWidth,
    applyTextEditorVirtualTail,
    clearTextEditorVirtualTail,
    getRequiredTextWidth,
    getTextContentRequiredWidth,
    getLiveRequiredTextWidth,
    getInitialTextAnnotationSize,
    getRequiredTextHeight,
    getRequiredTextHeightForWidth,
    getMinWidthToFitHeight,
    getTextWrapState,
    finalizeTextAnnotationLayout,
    annotationHasExplicitLineBreaks,
    ensureTextAnnotationsSizedForExport,
    applyTextEditorLayoutStyles,
    applyEditingTextAutoGrow,
    applyTextAnnotationBoxSize,
    scheduleAutoGrowText
  };
})();
