/**
 * Menu contextuel des annotations texte (format, couleurs, orthographe async).
 * Dépendances injectées via `bind()` depuis `renderer.js` une fois les autres menus / helpers définis.
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let ctx = null;

  let textAnnotationCtxMenuEl = null;
  let textCtxMenuTargetId = null;
  /** Annule les rafraîchissements async du menu orthographe quand le menu se ferme. */
  let spellCtxMenuSeq = 0;
  let textCtxMenuWired = false;

  function bind(next) {
    ctx = next;
  }

  function getTextCtxMenuTargetId() {
    return textCtxMenuTargetId;
  }

  function setTextCtxMenuTargetId(id) {
    textCtxMenuTargetId = id;
  }

  function ensureTextAnnotationCtxMenuEl() {
    if (textAnnotationCtxMenuEl) return textAnnotationCtxMenuEl;
    textAnnotationCtxMenuEl = document.getElementById("textAnnotationCtxMenu");
    return textAnnotationCtxMenuEl;
  }

  function hideTextAnnotationCtxMenu() {
    const d = ctx;
    if (!d) return;
    spellCtxMenuSeq += 1;
    try {
      window.__editifyUtils.logText("ctxTextMenuHide", { hadTarget: Boolean(textCtxMenuTargetId) });
    } catch {
      /* ignore */
    }
    try {
      ensureTextAnnotationCtxMenuEl()?.classList?.add?.("hidden");
    } catch {
      /* ignore */
    }
    textCtxMenuTargetId = null;
    globalThis.__maniCtxTextBackup = undefined;
  }

  function syncTextCtxMenuFieldsFromItem(item) {
    const rot = document.getElementById("ctxTextRotation");
    const op = document.getElementById("ctxTextOpacity");
    if (rot) rot.value = String(Math.round(item.rotation || 0));
    if (op) op.value = String(Math.round(item.opacity ?? 100));
    const font = document.getElementById("ctxTextFont");
    const size = document.getElementById("ctxTextSize");
    const col = document.getElementById("ctxTextColor");
    const bg = document.getElementById("ctxTextBg");
    if (font) font.value = item.fontFamily || "Arial";
    if (size) size.value = String(Math.round(item.fontSize ?? 14));
    if (col) col.value = item.textColor || "#111111";
    const bgTr = !item.bgColor;
    if (bg) bg.value = bgTr ? "#ffffff" : item.bgColor;
    document.getElementById("ctxTextBgLabel")?.classList?.toggle?.("is-transparent", bgTr);
    try {
      window.syncManiColorSwatches?.();
    } catch {
      /* ignore */
    }
  }

  function applyTextCtxMenuBoxProps() {
    const d = ctx;
    if (!d) return;
    const tab = d.getActiveTab();
    if (!tab || !textCtxMenuTargetId) return;
    const loc = d.findAnnotationLocation(tab, textCtxMenuTargetId);
    if (!loc || loc.item.type !== "text") return;
    const item = loc.item;
    d.captureSnapshot(tab);
    const font = document.getElementById("ctxTextFont");
    const size = document.getElementById("ctxTextSize");
    const col = document.getElementById("ctxTextColor");
    const bg = document.getElementById("ctxTextBg");
    if (font) item.fontFamily = font.value || item.fontFamily;
    if (size) item.fontSize = Math.max(8, Math.min(96, Number(size.value) || 14));
    if (col) d.applyTextColorToTextAnnotation(item, col.value || item.textColor);
    const rot = document.getElementById("ctxTextRotation");
    const op = document.getElementById("ctxTextOpacity");
    if (rot) item.rotation = Math.max(0, Math.min(360, Number(rot.value) || 0));
    if (op) item.opacity = Math.max(0, Math.min(100, Number(op.value) || 100));
    if (bg && bg.dataset.ctxTouched === "1") {
      item.bgColor = bg.value ? bg.value : null;
    }
    if (d.propFontFamily) d.propFontFamily.value = item.fontFamily || "Arial";
    if (d.propFontSize) d.propFontSize.value = String(Math.round(item.fontSize ?? 14));
    if (d.propTextColor) d.propTextColor.value = item.textColor || "#111111";
    if (d.propBgColor) {
      const t = !item.bgColor;
      d.propBgColor.value = t ? "#ffffff" : item.bgColor;
      d.propBgColorLabel?.classList?.toggle?.("is-transparent", t);
      d.propBgColor.dataset.touched = item.bgColor ? "1" : "0";
    }
    d.renderAnnotations();
    d.scheduleAutoSave();
  }

  function openTextAnnotationCtxMenu(event, annotationId) {
    const d = ctx;
    if (!d) return;
    d.commitActiveTextEditIfNeeded(annotationId);
    d.cancelPointerInteraction();
    const menu = ensureTextAnnotationCtxMenuEl();
    if (!menu) return;
    const tab = d.getActiveTab();
    if (!tab) return;
    const loc = d.findAnnotationLocation(tab, annotationId);
    if (!loc || loc.item.type !== "text") return;
    d.hideShapeAnnotationCtxMenu();
    d.hideImageAnnotationCtxMenu();
    d.hideChangesContextMenu();
    textCtxMenuTargetId = annotationId;
    d.state.selectedAnnotationId = annotationId;
    d.syncPropertyInputs();
    syncTextCtxMenuFieldsFromItem(loc.item);
    const bgEl = document.getElementById("ctxTextBg");
    if (bgEl) bgEl.dataset.ctxTouched = "0";

    menu.classList.remove("hidden");
    menu.style.minWidth = "260px";
    void menu.offsetWidth;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width || 260;
    const h = rect.height || 220;
    let mx = event.clientX;
    let my = event.clientY;
    mx = Math.min(mx, vw - w - 8);
    my = Math.min(my, vh - h - 8);
    menu.style.left = `${Math.max(8, mx)}px`;
    menu.style.top = `${Math.max(8, my)}px`;
    if (d.state.editingAnnotationId !== annotationId) {
      d.renderAnnotations();
    }
    syncCtxTextFormatButtons();
    void refreshTextSpellContextMenu();
  }

  function syncCtxTextFormatButtons() {
    const d = ctx;
    if (!d) return;
    const tab = d.getActiveTab();
    if (!tab || !textCtxMenuTargetId) return;
    const loc = d.findAnnotationLocation(tab, textCtxMenuTargetId);
    if (!loc || loc.item.type !== "text") return;
    const host = d.annotationLayer?.querySelector(`[data-id="${textCtxMenuTargetId}"]`);
    const ed = d.getAnnotationTextEditor(host);
    const { getFormatCoverage, getFormatCoverageFromSanitizedHtml, setFmtBtnState } =
      window.__editifyTextCtxHelpers;
    const kinds = [
      ["ctxTextBold", "bold"],
      ["ctxTextItalic", "italic"],
      ["ctxTextUnderline", "underline"]
    ];
    for (const [id, kind] of kinds) {
      const cov = ed
        ? getFormatCoverage(ed, kind)
        : getFormatCoverageFromSanitizedHtml(loc.item.textHtml || loc.item.text || "", kind);
      setFmtBtnState(id, cov);
    }
  }

  async function applySpellSuggestionToContextTarget(replacement) {
    const d = ctx;
    if (!d) return;
    const spellCtx = globalThis.__maniSpellCtx;
    const tab = d.getActiveTab();
    if (!spellCtx || !textCtxMenuTargetId || !tab || spellCtx.replaceStart < 0 || !replacement)
      return;
    const loc = d.findAnnotationLocation(tab, textCtxMenuTargetId);
    if (!loc?.item || loc.item.type !== "text") return;
    const item = loc.item;
    d.captureSnapshot(tab);
    const host = d.annotationLayer?.querySelector(`[data-id="${textCtxMenuTargetId}"]`);
    const ed = d.getAnnotationTextEditor(host);
    const { replacePlainTextRangeInEditor, replacePlainRangeInTextItem } =
      window.__editifyTextCtxHelpers;
    if (ed) {
      replacePlainTextRangeInEditor(ed, spellCtx.replaceStart, spellCtx.replaceEnd, replacement);
      d.syncTextFromEditor(item, ed);
    } else {
      replacePlainRangeInTextItem(item, spellCtx.replaceStart, spellCtx.replaceEnd, replacement);
    }
    d.scheduleAutoSave();
    d.renderAnnotations();
    void refreshTextSpellContextMenu();
  }

  async function refreshTextSpellContextMenu() {
    const d = ctx;
    if (!d) return;
    const { plainTextForAnnotationItem } = window.__editifyTextHtml;
    const { getPlainSelectionOffsetsInEditor } = window.__editifyTextCtxHelpers;
    const tab = d.getActiveTab();
    if (!tab || !textCtxMenuTargetId) return;
    const loc = d.findAnnotationLocation(tab, textCtxMenuTargetId);
    if (!loc || loc.item.type !== "text") return;
    const item = loc.item;
    const lang = d.getSpellcheckBcp47FromUiLang(d.state.language);
    const api = window.maniPdfApi;
    const statusEl = document.getElementById("ctxSpellStatus");
    const wordRow = document.getElementById("ctxSpellWordRow");
    const wordLbl = document.getElementById("ctxSpellWordLabel");
    const wordVal = document.getElementById("ctxSpellWordValue");
    const sugEl = document.getElementById("ctxSpellSuggestions");
    const addBtn = document.getElementById("ctxSpellAddDict");
    const remBtn = document.getElementById("ctxSpellRemoveDict");
    if (!api?.spellcheckAnalyze || !sugEl) return;

    const mySeq = ++spellCtxMenuSeq;
    if (statusEl) statusEl.textContent = d.t("ctxSpellLoading");
    if (wordLbl) wordLbl.textContent = `${d.t("ctxSpellWord")} :`;
    sugEl.innerHTML = "";
    if (addBtn) addBtn.classList.add("hidden");
    if (remBtn) remBtn.classList.add("hidden");
    if (wordRow) wordRow.classList.add("hidden");

    const hostPre = d.annotationLayer?.querySelector(`[data-id="${textCtxMenuTargetId}"]`);
    const edPre = d.getAnnotationTextEditor(hostPre);
    let plain = plainTextForAnnotationItem(item);
    if (edPre) {
      const rngPlain = document.createRange();
      rngPlain.selectNodeContents(edPre);
      plain = String(rngPlain.toString() || "").replace(/\r\n/g, "\n");
    }
    let res;
    try {
      res = await api.spellcheckAnalyze({ lang, text: plain });
    } catch {
      res = { ok: false, errors: [] };
    }
    if (mySeq !== spellCtxMenuSeq) return;
    const errors = res?.ok && Array.isArray(res.errors) ? res.errors : [];
    window.__editifyUtils.logText("spellcheck:ctx", {
      ok: Boolean(res?.ok),
      reason: res?.reason,
      errorsCount: errors.length,
      plainLen: plain.length
    });

    const host = d.annotationLayer?.querySelector(`[data-id="${textCtxMenuTargetId}"]`);
    const ed = d.getAnnotationTextEditor(host);
    let selStart = 0;
    let selEnd = 0;
    let hasSel = false;
    if (ed) {
      const o = getPlainSelectionOffsetsInEditor(ed);
      selStart = o.start;
      selEnd = o.end;
      hasSel = !o.collapsed;
    }

    let targetErr = null;
    let dictWord = null;

    let selectedSingleWord = false;
    if (hasSel && selEnd > selStart) {
      const rawSel = plain.slice(selStart, selEnd);
      const trimmed = rawSel.trim();
      if (trimmed.length > 0 && !/\s/.test(trimmed)) {
        selectedSingleWord = true;
        dictWord = trimmed.replace(/^['']+|['']+$/gu, "");
        targetErr =
          errors.find((e) => e.word === dictWord || (e.start >= selStart && e.end <= selEnd + 1)) ||
          null;
      }
    }
    if (!targetErr && errors.length > 0 && !(selectedSingleWord && dictWord)) {
      targetErr = errors[0];
    }
    if (dictWord == null && targetErr) {
      dictWord = targetErr.word;
    }

    globalThis.__maniSpellCtx = {
      replaceStart: targetErr ? targetErr.start : -1,
      replaceEnd: targetErr ? targetErr.end : -1,
      targetWord: targetErr ? targetErr.word : null,
      dictWord: dictWord || (targetErr ? targetErr.word : null)
    };

    if (statusEl) {
      if (!res?.ok) {
        statusEl.textContent = d.t("ctxSpellDictUnavailable");
      } else {
        statusEl.textContent = errors.length === 0 ? d.t("ctxSpellNoIssue") : "";
      }
    }

    if (targetErr && wordRow && wordVal) {
      wordRow.classList.remove("hidden");
      wordVal.textContent = targetErr.word;
    }

    if (targetErr && Array.isArray(targetErr.suggestions) && targetErr.suggestions.length) {
      const lab = document.createElement("div");
      lab.className = "ctx-spell-sug-label";
      lab.textContent = d.t("ctxSpellReplace");
      sugEl.appendChild(lab);
      targetErr.suggestions.forEach((sug) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = sug;
        b.addEventListener("click", () => {
          void applySpellSuggestionToContextTarget(sug);
        });
        sugEl.appendChild(b);
      });
    }

    const dw = globalThis.__maniSpellCtx?.dictWord;
    if (dw && addBtn && remBtn && api.spellcheckIsCustomWord) {
      try {
        const r = await api.spellcheckIsCustomWord(dw);
        if (mySeq !== spellCtxMenuSeq) return;
        addBtn.classList.add("hidden");
        remBtn.classList.add("hidden");
        if (r?.ok && r.inDictionary) {
          remBtn.textContent = d.t("ctxSpellRemoveDict");
          remBtn.classList.remove("hidden");
          remBtn.onclick = async () => {
            await api.spellcheckRemoveWord(dw);
            void refreshTextSpellContextMenu();
            runBackgroundSpellScanForTextAnnotations();
          };
        } else if (targetErr) {
          addBtn.textContent = d.t("ctxSpellAddDict");
          addBtn.classList.remove("hidden");
          addBtn.onclick = async () => {
            await api.spellcheckAddWord(dw);
            void refreshTextSpellContextMenu();
            runBackgroundSpellScanForTextAnnotations();
          };
        }
      } catch {
        /* ignore */
      }
    }
  }

  function runBackgroundSpellScanForTextAnnotations() {
    const d = ctx;
    if (!d) return;
    const { plainTextForAnnotationItem, sanitizeTextHtml, applySpellHighlightsToTextDisplayNode } =
      window.__editifyTextHtml;
    const tab = d.getActiveTab();
    const api = window.maniPdfApi;
    if (!tab || !api?.spellcheckAnalyze) return;
    const lang = d.getSpellcheckBcp47FromUiLang(d.state.language);
    const page = String(tab.currentPage || 1);
    const list = tab.annotationsByPage[page] || [];
    list.forEach((a) => {
      if (a.type !== "text") return;
      const plain = plainTextForAnnotationItem(a);
      api.spellcheckAnalyze({ lang, text: plain }).then((res) => {
        const errors = res?.ok && Array.isArray(res.errors) ? res.errors : [];
        window.__editifyUtils.logText("spellcheck:scan", {
          id: a.id,
          ok: Boolean(res?.ok),
          reason: res?.reason,
          errorsCount: errors.length,
          plainLen: plain.length
        });
        a._spellErrors = errors.map((e) => ({ start: e.start, end: e.end }));
        const n = errors.length;
        const node = d.annotationLayer?.querySelector(`[data-id="${a.id}"]`);
        if (!node || a.type !== "text") return;
        if (d.state.editingAnnotationId === a.id) {
          delete node.dataset.spellIssues;
          return;
        }
        if (n > 0) node.dataset.spellIssues = String(n);
        else delete node.dataset.spellIssues;
        if (!node.querySelector?.(".text-editor")) {
          if (a.textHtml && String(a.textHtml).trim()) {
            node.innerHTML = sanitizeTextHtml(a.textHtml);
          } else {
            node.textContent = a.text ? a.text : "";
          }
          applySpellHighlightsToTextDisplayNode(node, a);
        }
      });
    });
  }

  function ctxMenuExecFormat(cmd) {
    const d = ctx;
    if (!d) return;
    if (!textCtxMenuTargetId) return;
    const tid = textCtxMenuTargetId;
    if (d.state.editingAnnotationId !== tid) {
      d.state.editingAnnotationId = tid;
      d.state.selectedAnnotationId = tid;
      d.renderAnnotations();
    }
    const host = d.annotationLayer?.querySelector?.(`[data-id="${tid}"]`);
    const ed = d.getAnnotationTextEditor(host);
    if (!ed || ed.contentEditable !== "true") return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(ed);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (!ed.contains(sel.anchorNode) || !ed.contains(sel.focusNode)) {
      return;
    }
    const tab = d.getActiveTab();
    const loc = tab ? d.findAnnotationLocation(tab, tid) : null;
    if (loc?.item && tab) {
      d.captureSnapshot(tab);
      try {
        document.execCommand(cmd, false, null);
      } catch {
        /* ignore */
      }
      d.syncTextFromEditor(loc.item, ed);
      d.scheduleAutoSave();
    }
    syncCtxTextFormatButtons();
  }

  function wireTextAnnotationCtxMenu() {
    if (textCtxMenuWired) return;
    const d = ctx;
    if (!d) return;
    const menu = ensureTextAnnotationCtxMenuEl();
    const dst = document.getElementById("ctxTextFont");
    if (!menu || !dst || !d.propFontFamily) return;
    if (!dst.options.length) {
      dst.innerHTML = d.propFontFamily.innerHTML;
    }
    const size = document.getElementById("ctxTextSize");
    const bg = document.getElementById("ctxTextBg");
    const validateColBtn = document.getElementById("ctxValidateTextColorBtn");
    const validateBgBtn = document.getElementById("ctxValidateTextBgBtn");
    const clearBg = document.getElementById("ctxTextBgClear");
    const bindLive = (id, fn) => {
      const el = document.getElementById(id);
      el?.addEventListener?.("input", fn);
      el?.addEventListener?.("change", fn);
    };
    bindLive("ctxTextRotation", () => applyTextCtxMenuBoxProps());
    bindLive("ctxTextOpacity", () => applyTextCtxMenuBoxProps());
    dst.addEventListener("change", () => applyTextCtxMenuBoxProps());
    size?.addEventListener?.("input", () => applyTextCtxMenuBoxProps());
    validateColBtn?.addEventListener?.("mousedown", (ev) => {
      ev.preventDefault();
      d.captureTextColorSelectionBackup?.();
    });
    validateColBtn?.addEventListener?.("click", () => applyTextCtxMenuBoxProps());
    validateBgBtn?.addEventListener?.("click", () => {
      try {
        if (bg) bg.dataset.ctxTouched = "1";
        document.getElementById("ctxTextBgLabel")?.classList?.remove?.("is-transparent");
      } catch {
        /* ignore */
      }
      applyTextCtxMenuBoxProps();
    });
    clearBg?.addEventListener?.("click", () => {
      const tab = d.getActiveTab();
      if (!tab || !textCtxMenuTargetId) return;
      const loc = d.findAnnotationLocation(tab, textCtxMenuTargetId);
      if (!loc?.item) return;
      d.captureSnapshot(tab);
      loc.item.bgColor = null;
      if (bg) {
        bg.value = "#ffffff";
        bg.dataset.ctxTouched = "0";
      }
      document.getElementById("ctxTextBgLabel")?.classList?.add?.("is-transparent");
      if (d.propBgColor) {
        d.propBgColor.value = "#ffffff";
        d.propBgColor.dataset.touched = "0";
        d.propBgColorLabel?.classList?.add?.("is-transparent");
      }
      d.renderAnnotations();
      d.scheduleAutoSave();
    });
    ["ctxTextBold", "ctxTextItalic", "ctxTextUnderline"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const c = btn.dataset.cmd;
        if (c) ctxMenuExecFormat(c);
      });
    });
    textCtxMenuWired = true;
  }

  window.__editifyTextCtxMenu = {
    bind,
    hideTextAnnotationCtxMenu,
    openTextAnnotationCtxMenu,
    ensureTextAnnotationCtxMenuEl,
    applyTextCtxMenuBoxProps,
    syncCtxTextFormatButtons,
    refreshTextSpellContextMenu,
    runBackgroundSpellScanForTextAnnotations,
    ctxMenuExecFormat,
    wireTextAnnotationCtxMenu,
    getTextCtxMenuTargetId,
    setTextCtxMenuTargetId
  };
})();
