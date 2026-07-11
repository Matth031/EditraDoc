/**
 * Utilitaires HTML / texte pour annotations (sanitization XSS partielle, extrait plain, bornes DOM, surlignage orthographe).
 * Chargé avant `renderer.js` ; expose `window.__editifyTextHtml` pour garder `renderer.js` plus lisible.
 */
(function () {
  "use strict";

  function stripTagsForPlain(html) {
    return String(html || "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  /** Réduit le XSS sur le HTML produit par contentEditable (pas un sanitizer complet type DOMPurify). */
  function sanitizeTextHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html || "");
    div.querySelectorAll("script,style,iframe,object,embed,link").forEach((el) => el.remove());
    div.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes || [])) {
        const n = attr.name || "";
        if (n.toLowerCase().startsWith("on")) el.removeAttribute(n);
      }
    });
    return div.innerHTML;
  }

  function plainTextFromHtmlRoot(root) {
    if (!root) return "";
    try {
      const t = String(root.innerText ?? root.textContent ?? "");
      return t.replace(/\r\n/g, "\n");
    } catch {
      return stripTagsForPlain(root.innerHTML || "");
    }
  }

  function plainTextForAnnotationItem(item) {
    if (!item || item.type !== "text") return "";
    if (item.textHtml && String(item.textHtml).trim()) {
      const div = document.createElement("div");
      div.innerHTML = sanitizeTextHtml(item.textHtml);
      return plainTextFromHtmlRoot(div);
    }
    return String(item.text || "").replace(/\r\n/g, "\n");
  }

  function plainTextFromEditorElement(editorEl) {
    if (!editorEl) return "";
    return plainTextFromHtmlRoot(editorEl);
  }

  /**
   * Repère les positions (texte brut) où le navigateur passe à une nouvelle ligne visuelle (soft-wrap).
   * @param {HTMLElement} root
   */
  function plainTextIndexFromRoot(root) {
    if (!root) return "";
    try {
      const r = document.createRange();
      r.selectNodeContents(root);
      return String(r.toString() || "").replace(/\r\n/g, "\n");
    } catch {
      return plainTextFromHtmlRoot(root);
    }
  }

  function getVisualLineBreakOffsets(root) {
    if (!root || typeof document === "undefined") return [];
    const plain = plainTextIndexFromRoot(root);
    const offsets = [];
    let lastTop = null;
    const range = document.createRange();
    const lineHeight =
      parseFloat(getComputedStyle(root).lineHeight) ||
      parseFloat(getComputedStyle(root).fontSize) * 1.2 ||
      16;
    const threshold = Math.max(2, lineHeight * 0.45);

    for (let i = 0; i < plain.length; i++) {
      if (plain[i] === "\n") {
        lastTop = null;
        continue;
      }
      const boundary = getTextBoundaryInRoot(root, i);
      if (!boundary || boundary.node.nodeType !== Node.TEXT_NODE) continue;
      try {
        range.setStart(boundary.node, boundary.offset);
        range.setEnd(boundary.node, boundary.offset + 1);
        const top = range.getBoundingClientRect().top;
        if (lastTop !== null && top > lastTop + threshold) {
          offsets.push(i);
        }
        lastTop = top;
      } catch {
        /* ignore */
      }
    }
    return offsets;
  }

  /** Insère un <br> dans root au décalage texte brut donné (modifie root). */
  function insertBreakAtPlainOffset(root, offset) {
    const boundary = getTextBoundaryInRoot(root, offset);
    if (!boundary) return false;
    const br = document.createElement("br");
    try {
      const { node, offset: off } = boundary;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        const before = text.slice(0, off);
        const after = text.slice(off);
        node.nodeValue = before;
        const afterNode = document.createTextNode(after);
        const parent = node.parentNode;
        if (!parent) return false;
        parent.insertBefore(br, node.nextSibling);
        parent.insertBefore(afterNode, br.nextSibling);
        return true;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.insertBefore(br, node.childNodes[off] || null);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function stripSpellHighlightMarkup(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(".mani-spell-miss").forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
  }

  function getTextExportMeasureContext(displayRoot) {
    const annotationEl = displayRoot?.classList?.contains?.("annotation")
      ? displayRoot
      : displayRoot?.closest?.(".annotation.text");
    const contentEl =
      displayRoot?.classList?.contains?.("text-editor") ? displayRoot : annotationEl || displayRoot;
    if (!contentEl) return null;
    const styleSource = annotationEl || contentEl;
    const cs = getComputedStyle(styleSource);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const boxW = Math.floor((annotationEl || contentEl).clientWidth || 0);
    const contentWidth = Math.max(20, boxW - padL - padR);
    return { annotationEl: styleSource, contentEl, contentWidth };
  }

  function createExportMeasureRoot(displayRoot) {
    const ctx = getTextExportMeasureContext(displayRoot);
    if (!ctx?.contentEl || ctx.contentWidth < 1) return null;
    const { annotationEl, contentEl, contentWidth } = ctx;
    const cs = getComputedStyle(annotationEl);

    const shell = document.createElement("div");
    shell.setAttribute("aria-hidden", "true");
    Object.assign(shell.style, {
      position: "fixed",
      left: "0",
      top: "0",
      opacity: "0",
      pointerEvents: "none",
      overflow: "hidden",
      margin: "0",
      border: "none",
      boxSizing: "border-box",
      zIndex: "-1",
      width: `${contentWidth}px`,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      padding: "0"
    });

    const content = contentEl.cloneNode(true);
    stripSpellHighlightMarkup(content);
    content.querySelectorAll?.(".resize-handle")?.forEach((h) => h.remove());
    content.style.width = "100%";
    content.style.maxWidth = "100%";
    content.style.boxSizing = "border-box";
    shell.appendChild(content);
    return shell;
  }

  function forceLayoutReflow(node) {
    if (!node) return;
    void node.offsetHeight;
    void node.getBoundingClientRect?.();
  }

  function getExportContentRoot(root) {
    if (!root) return null;
    const clone = root.cloneNode(true);
    stripSpellHighlightMarkup(clone);
    clone.querySelectorAll?.(".resize-handle")?.forEach((h) => h.remove());
    return clone;
  }

  function htmlHasExplicitLineBreaks(root) {
    if (!root) return false;
    const contentRoot = getExportContentRoot(root);
    if (!contentRoot) return false;
    const plain = plainTextIndexFromRoot(contentRoot);
    if (/\n/.test(plain)) return true;
    const html = String(contentRoot.innerHTML || "");
    if (/<\s*br\b/i.test(html)) return true;
    try {
      if (contentRoot.querySelectorAll("div, p, li").length > 1) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function filterSoftWrapOffsets(plain, offsets) {
    return (offsets || []).filter((i) => {
      if (i <= 0 || i >= plain.length) return false;
      if (plain[i] === "\n" || plain[i - 1] === "\n") return false;
      // Ne jamais couper un mot : coupure soft-wrap uniquement après un espace.
      return /\s/.test(plain[i - 1]);
    });
  }

  function buildFontCssFromComputedStyle(cs) {
    if (!cs) return "normal normal 14px Arial";
    const style = cs.fontStyle || "normal";
    const weight = cs.fontWeight || "normal";
    const size = cs.fontSize || "14px";
    const family = cs.fontFamily || "Arial";
    return `${style} ${weight} ${size} ${family}`;
  }

  function createCanvasMeasureWidth(fontCss) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => 0;
    ctx.font = fontCss;
    return (segment) => ctx.measureText(String(segment || "")).width;
  }

  function resolveFontSourceForExport(displayRoot) {
    const annotationEl =
      displayRoot?.classList?.contains?.("annotation") ?
        displayRoot
      : displayRoot?.closest?.(".annotation.text");
    const styleSource = annotationEl || displayRoot;
    try {
      return getComputedStyle(styleSource);
    } catch {
      return null;
    }
  }

  /** DOM visuel puis repli canvas à la largeur du cadre (wrap-display / textWrapManual). */
  function resolveSoftWrapOffsets(displayRoot, contentWidthPx) {
    const contentRoot = getExportContentRoot(displayRoot);
    if (!contentRoot) return [];
    const plain = plainTextIndexFromRoot(contentRoot);
    if (!plain) return [];

    const domOffsets = filterSoftWrapOffsets(plain, getVisualLineBreakOffsets(contentRoot));
    if (domOffsets.length) return domOffsets;

    const width =
      contentWidthPx > 0 ?
        contentWidthPx
      : getTextExportMeasureContext(displayRoot)?.contentWidth || 0;
    if (width < 1) return [];

    const wrapApi = window.__editifyTextSoftWrapOffsets;
    if (!wrapApi?.computeSoftWrapOffsetsAtSpaces) return [];

    const cs = resolveFontSourceForExport(displayRoot);
    const measureWidth = createCanvasMeasureWidth(buildFontCssFromComputedStyle(cs));
    return filterSoftWrapOffsets(
      plain,
      wrapApi.computeSoftWrapOffsetsAtSpaces(plain, width, measureWidth)
    );
  }

  /**
   * Figé les retours à la ligne visuels (soft-wrap) en <br> pour l'export PDF uniquement.
   * @param {HTMLElement} displayRoot
   * @param {number} [contentWidthPx]
   */
  function injectVisualLineBreaksIntoHtml(displayRoot, contentWidthPx) {
    if (!displayRoot) return "";
    const contentRoot = getExportContentRoot(displayRoot);
    if (!contentRoot) return "";
    if (htmlHasExplicitLineBreaks(displayRoot)) {
      return contentRoot.innerHTML || "";
    }
    const offsets = resolveSoftWrapOffsets(displayRoot, contentWidthPx);
    if (!offsets.length) return contentRoot.innerHTML || "";

    const clone = contentRoot;
    [...offsets].sort((a, b) => b - a).forEach((o) => insertBreakAtPlainOffset(clone, o));
    return clone.innerHTML || "";
  }

  /**
   * HTML prêt pour l'export PDF (ne modifie pas le modèle / l'UI).
   * Sauts explicites conservés ; soft-wrap figé en <br> seulement sans retour manuel.
   */
  function buildExportTextHtmlForPdf(displayRoot) {
    if (!displayRoot) return "";
    if (htmlHasExplicitLineBreaks(displayRoot)) {
      return sanitizeTextHtml(displayRoot.innerHTML || "");
    }

    forceLayoutReflow(displayRoot);

    const measureCtx = getTextExportMeasureContext(displayRoot);
    const measureRoot = createExportMeasureRoot(displayRoot);
    if (measureRoot) {
      document.body.appendChild(measureRoot);
      try {
        forceLayoutReflow(measureRoot);
        const contentEl = measureRoot.firstElementChild;
        if (contentEl) {
          const html = injectVisualLineBreaksIntoHtml(contentEl, measureCtx?.contentWidth);
          if (/<\s*br\b/i.test(html || "")) return sanitizeTextHtml(html);
        }
      } finally {
        measureRoot.remove();
      }
    }

    const html = injectVisualLineBreaksIntoHtml(displayRoot, measureCtx?.contentWidth);
    return sanitizeTextHtml(html || displayRoot.innerHTML || "");
  }

  /** @deprecated Utiliser buildExportTextHtmlForPdf — conservé pour les tests E2E. */
  function captureExportTextHtml(displayRoot) {
    return buildExportTextHtmlForPdf(displayRoot);
  }

  /**
   * Borne DOM pour un index dans la chaîne alignée sur Range.toString() (texte + BR → un caractère \n).
   * Même repère que plainTextForAnnotationItem / getPlainSelectionOffsetsInEditor.
   */
  function getTextBoundaryInRoot(root, charIndex) {
    if (charIndex < 0) return null;
    const full = (() => {
      const r = document.createRange();
      r.selectNodeContents(root);
      return String(r.toString() || "").replace(/\r\n/g, "\n");
    })();
    if (charIndex > full.length) return null;

    let acc = 0;

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.nodeValue.length;
        if (charIndex < acc + len) {
          return { node, offset: charIndex - acc };
        }
        if (charIndex === acc + len) {
          return { node, offset: len };
        }
        acc += len;
        return null;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "BR") {
          if (charIndex === acc) {
            const parent = node.parentNode;
            const idx = Array.prototype.indexOf.call(parent.childNodes, node);
            return { node: parent, offset: idx };
          }
          if (charIndex === acc + 1) {
            const parent = node.parentNode;
            const idx = Array.prototype.indexOf.call(parent.childNodes, node);
            return { node: parent, offset: idx + 1 };
          }
          acc += 1;
          return null;
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          const b = walk(node.childNodes[i]);
          if (b) return b;
        }
      }
      return null;
    }

    return walk(root);
  }

  function wrapSpellMisspellingsInDisplayRoot(root, ranges) {
    if (!root || !ranges?.length) return;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    for (let i = sorted.length - 1; i >= 0; i--) {
      const { start, end } = sorted[i];
      if (start >= end || start < 0) continue;
      const a = getTextBoundaryInRoot(root, start);
      const b = getTextBoundaryInRoot(root, end);
      if (!a || !b) continue;
      const range = document.createRange();
      try {
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, b.offset);
      } catch {
        continue;
      }
      const span = document.createElement("span");
      span.className = "mani-spell-miss";
      span.setAttribute("role", "presentation");
      try {
        range.surroundContents(span);
      } catch {
        try {
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        } catch {
          /* ignore */
        }
      }
    }
  }

  function applySpellHighlightsToTextDisplayNode(node, item) {
    if (!node || item.type !== "text") return;
    const plain = plainTextForAnnotationItem(item);
    const ranges = item._spellErrors;
    if (!plain || !ranges?.length) return;
    const rng = document.createRange();
    rng.selectNodeContents(node);
    const live = String(rng.toString() || "").replace(/\r\n/g, "\n");
    const p = plain.replace(/\r\n/g, "\n");
    if (live !== p) return;
    wrapSpellMisspellingsInDisplayRoot(node, ranges);
  }

  window.__editifyTextHtml = {
    stripTagsForPlain,
    sanitizeTextHtml,
    plainTextFromHtmlRoot,
    plainTextFromEditorElement,
    plainTextForAnnotationItem,
    buildExportTextHtmlForPdf,
    captureExportTextHtml,
    getTextBoundaryInRoot,
    getVisualLineBreakOffsets,
    wrapSpellMisspellingsInDisplayRoot,
    applySpellHighlightsToTextDisplayNode
  };
})();
