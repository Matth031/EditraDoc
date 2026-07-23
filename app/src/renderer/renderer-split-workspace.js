/**
 * Overlay Split par groupes (brouillon localStorage, drag & drop des miniatures).
 * `bind()` depuis renderer.js après `__editifyJobs.bind()` (fournit `enqueuePdfJob` / `buildDefaultOutputPath`).
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  let splitWorkspaceState = null;
  let splitAutosaveTimer = null;
  let splitPointer = null;
  let splitDragGhost = null;
  /** @type {number[] | null} */
  let splitDragPages = null;
  let splitDragOffsetX = 44;
  let splitDragOffsetY = 56;
  let splitDropHoverEl = null;

  let splitUiWired = false;
  let splitEscapeBound = false;

  function bind(next) {
    deps = next;
    wireSplitUiOnce();
  }

  function wireSplitUiOnce() {
    if (splitUiWired || !deps) return;
    splitUiWired = true;
    const ovl = deps.splitWorkspaceOverlay;
    const closeBtn = deps.splitWorkspaceCloseBtn;
    const addBtn = deps.splitWorkspaceAddGroupBtn;
    const valBtn = deps.splitWorkspaceValidateBtn;
    closeBtn?.addEventListener?.("click", () => closeSplitWorkspace());
    addBtn?.addEventListener?.("click", () => addSplitGroup());
    valBtn?.addEventListener?.("click", () => void validateSplitWorkspace());
    ovl?.addEventListener?.("click", (e) => {
      if (e.target === ovl) closeSplitWorkspace();
    });
    if (!splitEscapeBound) {
      splitEscapeBound = true;
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!ovl || ovl.classList.contains("hidden")) return;
        closeSplitWorkspace();
      });
    }
  }

  // --- Split par groupes (UI overlay) : état runtime + persistance brouillon locale ---
  function draftKey(pdfPath) {
    return `maniSplitDraft:${pdfPath}`;
  }

  function sanitizeSplitBaseName(name) {
    const s = String(name || "")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/./g, (ch) => (ch.charCodeAt(0) < 32 ? "_" : ch))
      .trim();
    return s || deps.t("splitDefaultBaseName");
  }

  function createSplitWorkspaceState(tab) {
    const n = Math.max(1, Number(tab.pageCount) || 1);
    const allPages = Array.from({ length: n }, (_, i) => i + 1);
    return {
      tabPath: tab.path,
      pageCount: n,
      groups: [
        { id: "g1", name: deps.tr("splitGroupNumbered", { n: "1" }), pages: [...allPages] },
        { id: "g2", name: deps.tr("splitGroupNumbered", { n: "2" }), pages: [] }
      ],
      nextGroupId: 3,
      selected: new Set(),
      anchorPage: null
    };
  }

  function normalizeSplitState(st, tab) {
    const n = Math.max(1, Number(tab.pageCount) || 1);
    const seen = new Set();
    for (const g of st.groups) {
      g.pages = g.pages.map((p) => Number(p)).filter((p) => Number.isFinite(p) && p >= 1 && p <= n);
      g.pages = g.pages.filter((p) => {
        if (seen.has(p)) return false;
        seen.add(p);
        return true;
      });
    }
    const missing = [];
    for (let p = 1; p <= n; p++) {
      if (!seen.has(p)) missing.push(p);
    }
    if (missing.length && st.groups.length) {
      st.groups[0].pages.push(...missing);
      st.groups[0].pages.sort((a, b) => a - b);
    }
  }

  function loadSplitWorkspaceDraft(tab) {
    try {
      const raw = localStorage.getItem(draftKey(tab.path));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.tabPath !== tab.path) return null;
      const n = Math.max(1, Number(tab.pageCount) || 1);
      if (Number(data.pageCount) !== n) return null;
      const groups = Array.isArray(data.groups)
        ? data.groups.map((g, i) => ({
            id: typeof g.id === "string" ? g.id : `g${i + 1}`,
            name:
              typeof g.name === "string"
                ? g.name
                : deps.tr("splitGroupNumbered", { n: String(i + 1) }),
            pages: Array.isArray(g.pages) ? g.pages.map((p) => Number(p)) : []
          }))
        : [];
      if (groups.length < 2) return null;
      const st = {
        tabPath: tab.path,
        pageCount: n,
        groups,
        nextGroupId: Math.max(3, Number(data.nextGroupId) || 3),
        selected: new Set(),
        anchorPage: null
      };
      normalizeSplitState(st, tab);
      return st;
    } catch {
      return null;
    }
  }

  function scheduleSplitWorkspaceAutosave() {
    if (!splitWorkspaceState) return;
    try {
      clearTimeout(splitAutosaveTimer);
    } catch {
      /* intentional: clearTimeout split autosave timer */
    }
    splitAutosaveTimer = setTimeout(() => {
      try {
        const st = splitWorkspaceState;
        if (!st) return;
        const payload = {
          tabPath: st.tabPath,
          pageCount: st.pageCount,
          groups: st.groups.map((g) => ({
            id: g.id,
            name: g.name,
            pages: [...g.pages]
          })),
          nextGroupId: st.nextGroupId
        };
        localStorage.setItem(draftKey(st.tabPath), JSON.stringify(payload));
      } catch (error) {
        globalThis.__editifyReportWarn?.("split:draft-autosave", String(error?.message || error));
      }
    }, 320);
  }

  function buildSplitThumbCanvas(pageNum) {
    if (!deps) return null;
    const pageNode = deps.pagesContainer?.querySelector?.(`.pdf-page[data-page="${pageNum}"]`);
    const srcCanvas = pageNode?.querySelector?.("canvas.pdf-canvas");
    if (!srcCanvas) return null;
    const targetW = 88;
    const ratio = srcCanvas.width > 0 ? targetW / srcCanvas.width : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(10, Math.floor(srcCanvas.width * ratio));
    canvas.height = Math.max(10, Math.floor(srcCanvas.height * ratio));
    const g2d = canvas.getContext("2d");
    try {
      g2d.drawImage(srcCanvas, 0, 0, canvas.width, canvas.height);
    } catch {
      /* intentional: split thumb drawImage best-effort */
    }
    return canvas;
  }

  function getOrderedPagesFromList(pageNums) {
    const st = splitWorkspaceState;
    if (!st) return [];
    const set = new Set(pageNums);
    const out = [];
    for (const g of st.groups) {
      for (const p of g.pages) {
        if (set.has(p)) out.push(p);
      }
    }
    return out;
  }

  function getOrderedSelectedPages() {
    return getOrderedPagesFromList([...splitWorkspaceState.selected]);
  }

  function findGroupContainingPage(page) {
    const st = splitWorkspaceState;
    if (!st) return null;
    return st.groups.find((g) => g.pages.includes(page)) || null;
  }

  function applySplitShiftRange(groupId, pageA, pageB) {
    const st = splitWorkspaceState;
    const g = st.groups.find((x) => x.id === groupId);
    if (!g) return;
    const ia = g.pages.indexOf(pageA);
    const ib = g.pages.indexOf(pageB);
    if (ia < 0 || ib < 0) return;
    const lo = Math.min(ia, ib);
    const hi = Math.max(ia, ib);
    st.selected.clear();
    for (let i = lo; i <= hi; i++) st.selected.add(g.pages[i]);
  }

  function handleSplitThumbClick(page, groupId, ev) {
    const st = splitWorkspaceState;
    if (!st) return;
    if (ev.shiftKey) {
      if (st.anchorPage != null) {
        const ag = findGroupContainingPage(st.anchorPage);
        if (ag && ag.id === groupId) {
          applySplitShiftRange(groupId, st.anchorPage, page);
          renderSplitWorkspace();
          scheduleSplitWorkspaceAutosave();
          return;
        }
      }
      st.selected.clear();
      st.selected.add(page);
      st.anchorPage = page;
    } else if (ev.ctrlKey || ev.metaKey) {
      if (st.selected.has(page)) st.selected.delete(page);
      else st.selected.add(page);
      st.anchorPage = page;
    } else {
      st.selected.clear();
      st.selected.add(page);
      st.anchorPage = page;
    }
    renderSplitWorkspace();
    scheduleSplitWorkspaceAutosave();
  }

  function updateSplitDropHover(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const body = el?.closest?.(".split-group-body");
    if (splitDropHoverEl && splitDropHoverEl !== body) {
      splitDropHoverEl.classList.remove("split-drop-hover");
    }
    if (body) {
      body.classList.add("split-drop-hover");
      splitDropHoverEl = body;
    }
  }

  function clearSplitDropHover() {
    if (splitDropHoverEl) {
      splitDropHoverEl.classList.remove("split-drop-hover");
      splitDropHoverEl = null;
    }
  }

  function removeSplitGhost() {
    if (splitDragGhost) {
      try {
        splitDragGhost.remove();
      } catch {
        /* intentional: remove split drag ghost DOM node */
      }
      splitDragGhost = null;
    }
    splitDragPages = null;
  }

  function startSplitDrag(page, _groupId, clientX, clientY) {
    const st = splitWorkspaceState;
    if (!st) return;
    const pages = st.selected.has(page) ? getOrderedSelectedPages() : [page];
    splitDragPages = pages;
    const ordered = getOrderedPagesFromList(pages);
    const ghost = document.createElement("div");
    ghost.className = "split-drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    const c = buildSplitThumbCanvas(ordered[0]);
    if (c) {
      ghost.appendChild(c);
      splitDragOffsetX = Math.floor(c.width / 2);
      splitDragOffsetY = Math.floor(c.height / 2);
    } else {
      splitDragOffsetX = 44;
      splitDragOffsetY = 56;
    }
    if (ordered.length > 1) {
      const badge = document.createElement("div");
      badge.textContent = String(ordered.length);
      badge.style.cssText =
        "position:absolute;right:4px;top:4px;background:#007acc;color:#fff;border-radius:10px;padding:2px 6px;font-size:11px;font-weight:700;z-index:2;";
      ghost.appendChild(badge);
    }
    document.body.appendChild(ghost);
    splitDragGhost = ghost;
    splitDragGhost.style.left = `${clientX - splitDragOffsetX}px`;
    splitDragGhost.style.top = `${clientY - splitDragOffsetY}px`;
  }

  function applySplitDrop(ordered, targetGroupId, beforePage) {
    const st = splitWorkspaceState;
    if (!st) return;
    const tg = st.groups.find((g) => g.id === targetGroupId);
    if (!tg) return;
    const orig = [...tg.pages];
    let insertPos = orig.length;
    if (beforePage != null && Number.isFinite(Number(beforePage))) {
      const bp = Number(beforePage);
      const ix = orig.indexOf(bp);
      insertPos = ix >= 0 ? ix : orig.length;
    }
    for (const g of st.groups) {
      g.pages = g.pages.filter((p) => !ordered.includes(p));
    }
    const tg2 = st.groups.find((g) => g.id === targetGroupId);
    if (!tg2) return;
    let pos = insertPos;
    for (let i = 0; i < insertPos && i < orig.length; i++) {
      if (ordered.includes(orig[i])) pos -= 1;
    }
    const maxPos = tg2.pages.length;
    pos = Math.max(0, Math.min(maxPos, pos));
    tg2.pages.splice(pos, 0, ...ordered);
  }

  function finishSplitDrag(clientX, clientY) {
    const st = splitWorkspaceState;
    const ordered = splitDragPages ? getOrderedPagesFromList(splitDragPages) : [];
    if (!st || !ordered.length) return;
    const el = document.elementFromPoint(clientX, clientY);
    const thumb = el?.closest?.(".split-thumb");
    const body = el?.closest?.(".split-group-body");
    let targetGroupId = null;
    let beforePage = null;
    if (thumb) {
      targetGroupId = thumb.dataset.groupId || null;
      beforePage = Number(thumb.dataset.page);
    } else if (body) {
      targetGroupId = body.dataset.groupId || null;
    }
    if (!targetGroupId) return;
    applySplitDrop(ordered, targetGroupId, Number.isFinite(beforePage) ? beforePage : null);
    st.selected.clear();
  }

  function onSplitThumbPointerDown(ev, page, groupId) {
    if (ev.button !== 0) return;
    const noDrag = Boolean(ev.shiftKey || ev.ctrlKey || ev.metaKey);
    splitPointer = {
      page,
      groupId,
      startX: ev.clientX,
      startY: ev.clientY,
      dragging: false,
      didDrag: false,
      noDrag,
      shift: ev.shiftKey,
      ctrl: ev.ctrlKey || ev.metaKey
    };

    const move = (e) => {
      if (!splitPointer) return;
      const dx = e.clientX - splitPointer.startX;
      const dy = e.clientY - splitPointer.startY;
      if (
        !splitPointer.noDrag &&
        !splitPointer.dragging &&
        (Math.abs(dx) > 6 || Math.abs(dy) > 6)
      ) {
        splitPointer.dragging = true;
        splitPointer.didDrag = true;
        startSplitDrag(splitPointer.page, splitPointer.groupId, e.clientX, e.clientY);
      }
      if (splitPointer.dragging && splitDragGhost) {
        splitDragGhost.style.left = `${e.clientX - splitDragOffsetX}px`;
        splitDragGhost.style.top = `${e.clientY - splitDragOffsetY}px`;
      }
      updateSplitDropHover(e.clientX, e.clientY);
    };

    const up = (e) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (splitPointer?.dragging) {
        finishSplitDrag(e.clientX, e.clientY);
        renderSplitWorkspace();
        scheduleSplitWorkspaceAutosave();
      } else if (splitPointer && !splitPointer.didDrag) {
        handleSplitThumbClick(page, groupId, {
          shiftKey: splitPointer.shift,
          ctrlKey: splitPointer.ctrl,
          metaKey: splitPointer.ctrl
        });
      }
      splitPointer = null;
      clearSplitDropHover();
      removeSplitGhost();
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  function createSplitThumbEl(page, groupId) {
    const wrap = document.createElement("div");
    wrap.className = "split-thumb";
    if (splitWorkspaceState?.selected.has(page)) wrap.classList.add("split-thumb-selected");
    wrap.dataset.page = String(page);
    wrap.dataset.groupId = groupId;
    const cw = document.createElement("div");
    cw.className = "split-thumb-canvas-wrap";
    const canvas = buildSplitThumbCanvas(page);
    if (canvas) cw.appendChild(canvas);
    else {
      const ph = document.createElement("div");
      ph.textContent = "…";
      ph.style.padding = "24px 8px";
      ph.style.textAlign = "center";
      cw.appendChild(ph);
    }
    const meta = document.createElement("div");
    meta.className = "split-thumb-meta";
    meta.textContent = deps.tr("splitThumbPage", { n: String(page) });
    wrap.appendChild(cw);
    wrap.appendChild(meta);
    wrap.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      onSplitThumbPointerDown(e, page, groupId);
    });
    return wrap;
  }

  function renderSplitWorkspace() {
    if (!deps || !deps.splitWorkspaceGroups || !splitWorkspaceState) return;
    const st = splitWorkspaceState;
    deps.splitWorkspaceGroups.innerHTML = "";
    for (let gi = 0; gi < st.groups.length; gi += 1) {
      const g = st.groups[gi];
      const section = document.createElement("section");
      section.className = "split-group";
      section.dataset.groupId = g.id;
      const header = document.createElement("div");
      header.className = "split-group-header";
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = deps.t("splitGroupLabel");
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "split-group-name";
      inp.value = g.name;
      inp.setAttribute("aria-label", deps.t("splitGroupNameAria"));
      inp.addEventListener("input", () => {
        g.name = inp.value;
        scheduleSplitWorkspaceAutosave();
      });
      label.appendChild(span);
      label.appendChild(inp);
      header.appendChild(label);
      // Suppression possible uniquement pour les groupes ajoutés (pas les 2 premiers).
      if (gi >= 2) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "split-group-delete";
        del.textContent = deps.t("splitDeleteGroup");
        del.addEventListener("click", () => {
          try {
            // Remettre les pages dans le groupe 1 pour éviter toute perte.
            const g1 = st.groups[0];
            g1.pages.push(...g.pages);
            g1.pages = Array.from(new Set(g1.pages)).sort((a, b) => a - b);
            // Retirer le groupe.
            st.groups = st.groups.filter((x) => x.id !== g.id);
            st.selected.clear();
          } catch {
            /* intentional: état incohérent transitoire merge groupes */
          }
          renderSplitWorkspace();
          scheduleSplitWorkspaceAutosave();
        });
        header.appendChild(del);
      }
      section.appendChild(header);
      const body = document.createElement("div");
      body.className = "split-group-body";
      body.dataset.groupId = g.id;
      for (const page of g.pages) {
        body.appendChild(createSplitThumbEl(page, g.id));
      }
      section.appendChild(body);
      deps.splitWorkspaceGroups.appendChild(section);
    }
  }

  function addSplitGroup() {
    if (!deps || !splitWorkspaceState) return;
    const num = splitWorkspaceState.nextGroupId;
    splitWorkspaceState.nextGroupId += 1;
    splitWorkspaceState.groups.push({
      id: `g${num}`,
      name: deps.tr("splitGroupNumbered", { n: String(num) }),
      pages: []
    });
    renderSplitWorkspace();
    scheduleSplitWorkspaceAutosave();
  }

  function openSplitWorkspace() {
    if (!deps) return;
    const tab = deps.getActiveTab();
    if (!tab) {
      deps.setStatus(deps.t("stSplitNoPdf"));
      return;
    }
    if (!Number(tab.pageCount) || tab.pageCount < 1) {
      deps.setStatus(deps.t("stSplitNotReady"));
      return;
    }
    splitWorkspaceState = loadSplitWorkspaceDraft(tab) || createSplitWorkspaceState(tab);
    normalizeSplitState(splitWorkspaceState, tab);
    deps.splitWorkspaceOverlay?.classList.remove("hidden");
    deps.splitWorkspaceOverlay?.setAttribute("aria-hidden", "false");
    renderSplitWorkspace();
    scheduleSplitWorkspaceAutosave();
    try {
      deps.splitWorkspaceValidateBtn?.focus?.();
    } catch {
      /* intentional: focus validate btn after open split */
    }
  }

  function closeSplitWorkspace() {
    if (!deps) return;
    scheduleSplitWorkspaceAutosave();
    deps.splitWorkspaceOverlay?.classList.add("hidden");
    deps.splitWorkspaceOverlay?.setAttribute("aria-hidden", "true");
    splitWorkspaceState = null;
    removeSplitGhost();
    clearSplitDropHover();
  }

  async function validateSplitWorkspace() {
    if (!deps) return;
    const st = splitWorkspaceState;
    const tab = deps.getActiveTab();
    if (!st || !tab || tab.path !== st.tabPath) return;
    const exports = [];
    let idx = 0;
    for (const g of st.groups) {
      if (!g.pages.length) continue;
      idx += 1;
      const safe = sanitizeSplitBaseName(g.name);
      const outputPath = deps.buildDefaultOutputPath(tab.path, `split-${idx}-${safe}`);
      exports.push({ output_path: outputPath, page_indices: [...g.pages] });
    }
    if (!exports.length) {
      deps.setStatus(deps.t("stSplitNoPages"));
      return;
    }
    const enqueued = await deps.enqueuePdfJob(
      "split_groups",
      { input_path: tab.path, groups: exports },
      deps.t("stSplitJobAdded")
    );
    if (!enqueued) return;
    try {
      localStorage.removeItem(draftKey(tab.path));
    } catch {
      /* intentional: remove split draft after enqueue job */
    }
    closeSplitWorkspace();
  }

  function renderSplitWorkspaceIfOpen() {
    if (
      !splitWorkspaceState ||
      !deps?.splitWorkspaceOverlay ||
      deps.splitWorkspaceOverlay.classList.contains("hidden")
    ) {
      return;
    }
    renderSplitWorkspace();
  }

  window.__editifySplitWorkspace = {
    bind,
    openSplitWorkspace,
    closeSplitWorkspace,
    validateSplitWorkspace,
    addSplitGroup,
    renderSplitWorkspaceIfOpen,
    createSplitJob: openSplitWorkspace
  };
})();
