/**
 * Helpers menu contextuel texte : sélection, couverture de format, remplacement de plages.
 * Dépend de `renderer-text-html.js`. Les fonctions async orthographe et câblage DOM restent dans `renderer.js`.
 */
(function () {
  "use strict";

  if (!window.__editifyTextHtml) {
    throw new Error("[editify] renderer-text-html.js doit précéder renderer-text-ctx.js.");
  }
  const { getTextBoundaryInRoot, plainTextForAnnotationItem, sanitizeTextHtml } =
    window.__editifyTextHtml;

  function getPlainSelectionOffsetsInEditor(ed) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ed.contains(sel.anchorNode)) {
      return { start: 0, end: 0, collapsed: true };
    }
    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(ed);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    pre.selectNodeContents(ed);
    pre.setEnd(range.endContainer, range.endOffset);
    const end = pre.toString().length;
    return { start, end, collapsed: start === end };
  }

  /** Sauvegarde la sélection DOM (fiable pour accents / reflow layout). */
  function saveEditorSelectionRange(ed) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ed?.contains(sel.anchorNode)) return null;
    try {
      return sel.getRangeAt(0).cloneRange();
    } catch {
      return null;
    }
  }

  /** @param {HTMLElement} ed @param {Range} range */
  function restoreEditorSelectionRange(ed, range) {
    if (!ed || !range) return false;
    if (!ed.contains(range.startContainer) || !ed.contains(range.endContainer)) return false;
    try {
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  }

  function textNodeFormatHit(textNode, ed, kind) {
    let el = textNode.parentElement;
    while (el && el !== ed) {
      const tag = el.tagName;
      if (kind === "bold" && /^(B|STRONG)$/i.test(tag)) return true;
      if (kind === "italic" && /^(I|EM|CITE)$/i.test(tag)) return true;
      if (kind === "underline" && /^U$/i.test(tag)) return true;
      el = el.parentElement;
    }
    const pe = textNode.parentElement;
    if (!pe) return false;
    const st = getComputedStyle(pe);
    if (kind === "bold") {
      const w = st.fontWeight;
      return Number.parseInt(w, 10) >= 600;
    }
    if (kind === "italic") return st.fontStyle === "italic";
    if (kind === "underline") return String(st.textDecorationLine || "").includes("underline");
    return false;
  }

  function getFormatCoverage(ed, kind) {
    if (!ed) return "none";
    let total = 0;
    let hit = 0;
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const t = n.nodeValue || "";
      if (!t.length) continue;
      total += t.length;
      if (textNodeFormatHit(n, ed, kind)) hit += t.length;
    }
    if (total === 0) return "none";
    if (hit === 0) return "none";
    if (hit === total) return "full";
    return "partial";
  }

  function getFormatCoverageFromSanitizedHtml(html, kind) {
    const div = document.createElement("div");
    div.setAttribute("style", "position:fixed;left:-9999px;top:0;");
    div.innerHTML = sanitizeTextHtml(html || "");
    document.body.appendChild(div);
    const cov = getFormatCoverage(div, kind);
    document.body.removeChild(div);
    return cov;
  }

  function setFmtBtnState(id, cov) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.remove("fmt-state-none", "fmt-state-partial", "fmt-state-full");
    btn.classList.add(
      cov === "full" ? "fmt-state-full" : cov === "partial" ? "fmt-state-partial" : "fmt-state-none"
    );
  }

  /**
   * Gras / italique / souligné au caractère `charIndex` (repère plain, aligné sur getTextBoundaryInRoot).
   */
  function getFormatFlagsAtPlainIndex(ed, charIndex) {
    if (!ed || charIndex < 0) {
      return { bold: false, italic: false, underline: false };
    }
    let boundary = getTextBoundaryInRoot(ed, charIndex);
    if (boundary && boundary.node.nodeType === Node.TEXT_NODE) {
      return {
        bold: textNodeFormatHit(boundary.node, ed, "bold"),
        italic: textNodeFormatHit(boundary.node, ed, "italic"),
        underline: textNodeFormatHit(boundary.node, ed, "underline")
      };
    }
    if (charIndex > 0) {
      boundary = getTextBoundaryInRoot(ed, charIndex - 1);
      if (boundary && boundary.node.nodeType === Node.TEXT_NODE) {
        return {
          bold: textNodeFormatHit(boundary.node, ed, "bold"),
          italic: textNodeFormatHit(boundary.node, ed, "italic"),
          underline: textNodeFormatHit(boundary.node, ed, "underline")
        };
      }
    }
    return { bold: false, italic: false, underline: false };
  }

  /**
   * Enveloppe le texte de remplacement pour conserver b / i / u (ordre ext. → int. : b > i > u).
   */
  function wrapReplacementWithFormatNodes(replacement, flags) {
    let node = /** @type {Node} */ (document.createTextNode(replacement));
    if (flags.underline) {
      const u = document.createElement("u");
      u.appendChild(node);
      node = u;
    }
    if (flags.italic) {
      const i = document.createElement("i");
      i.appendChild(node);
      node = i;
    }
    if (flags.bold) {
      const b = document.createElement("b");
      b.appendChild(node);
      node = b;
    }
    return node;
  }

  function replacePlainTextRangeInEditor(ed, start, end, replacement) {
    if (!ed || start < 0 || end <= start) return false;
    const fmt = getFormatFlagsAtPlainIndex(ed, start);
    const a = getTextBoundaryInRoot(ed, start);
    const b = getTextBoundaryInRoot(ed, end);
    if (!a || !b) return false;
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch {
      return false;
    }
    range.deleteContents();
    range.insertNode(wrapReplacementWithFormatNodes(replacement, fmt));
    return true;
  }

  /** Sélection non vide entièrement dans l'éditeur contentEditable. */
  function hasNonemptyTextSelectionInEditor(ed) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ed) return false;
    return ed.contains(sel.anchorNode) && ed.contains(sel.focusNode);
  }

  /**
   * @param {HTMLElement} ed
   * @param {number} start
   * @param {number} end
   */
  function setPlainSelectionInEditor(ed, start, end) {
    if (!ed || start < 0 || end < start) return false;
    const a = getTextBoundaryInRoot(ed, start);
    const b = getTextBoundaryInRoot(ed, end);
    if (!a || !b) return false;
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch {
      return false;
    }
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  /**
   * @param {string} color
   */
  function normalizeTextColorHex(color) {
    const s = String(color || "#111111").trim() || "#111111";
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      const h = (n) => Number(n).toString(16).padStart(2, "0");
      return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
    }
    return "#111111";
  }

  /**
   * @param {HTMLElement} ed
   * @param {Range} range
   * @param {string} color
   */
  function applyColorToRange(ed, range, color) {
    if (!ed || !range || range.collapsed) return false;
    if (!ed.contains(range.startContainer) || !ed.contains(range.endContainer)) return false;
    const hex = normalizeTextColorHex(color);
    const span = document.createElement("span");
    span.style.color = hex;
    try {
      const work = range.cloneRange();
      const frag = work.extractContents();
      span.appendChild(frag);
      work.insertNode(span);
      const sel = window.getSelection();
      if (sel) {
        const after = document.createRange();
        after.setStartAfter(span);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Applique une couleur au texte sélectionné (ou tout le contenu si caret seul).
   * @param {HTMLElement} ed
   * @param {string} color
   * @param {{ selectAllIfCollapsed?: boolean, savedRange?: Range | null }} [opts]
   */
  function applyTextColorInEditor(ed, color, opts = {}) {
    if (!ed || !color) return false;
    const selectAllIfCollapsed = opts.selectAllIfCollapsed !== false;
    const savedRange = opts.savedRange || null;

    if (savedRange && !savedRange.collapsed) {
      return applyColorToRange(ed, savedRange, color);
    }

    ed.focus();
    const sel = window.getSelection();
    if (!sel) return false;
    let range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range || !ed.contains(range.startContainer) || !ed.contains(range.endContainer)) {
      if (!selectAllIfCollapsed) return false;
      range = document.createRange();
      range.selectNodeContents(ed);
    }
    if (range.collapsed) {
      if (!selectAllIfCollapsed) return false;
      range = document.createRange();
      range.selectNodeContents(ed);
    }
    if (applyColorToRange(ed, range, color)) return true;
    try {
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, normalizeTextColorHex(color));
      document.execCommand("styleWithCSS", false, "false");
      return true;
    } catch {
      return false;
    }
  }

  function replacePlainRangeInTextItem(item, start, end, replacement) {
    const plain = plainTextForAnnotationItem(item);
    if (start < 0 || end > plain.length) return false;
    const html = item.textHtml && String(item.textHtml).trim();
    if (html) {
      const div = document.createElement("div");
      div.innerHTML = sanitizeTextHtml(item.textHtml);
      if (replacePlainTextRangeInEditor(div, start, end, replacement)) {
        item.textHtml = sanitizeTextHtml(div.innerHTML);
        const r = document.createRange();
        r.selectNodeContents(div);
        item.text = String(r.toString() || "").replace(/\r\n/g, "\n");
        delete item._spellErrors;
        return true;
      }
    }
    const next = plain.slice(0, start) + replacement + plain.slice(end);
    item.text = next;
    delete item.textHtml;
    delete item._spellErrors;
    return true;
  }

  window.__editifyTextCtxHelpers = {
    getPlainSelectionOffsetsInEditor,
    textNodeFormatHit,
    getFormatCoverage,
    getFormatCoverageFromSanitizedHtml,
    setFmtBtnState,
    replacePlainTextRangeInEditor,
    replacePlainRangeInTextItem,
    hasNonemptyTextSelectionInEditor,
    setPlainSelectionInEditor,
    applyTextColorInEditor,
    applyColorToRange,
    normalizeTextColorHex,
    saveEditorSelectionRange,
    restoreEditorSelectionRange
  };
})();
