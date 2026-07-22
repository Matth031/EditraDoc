/**
 * Annotations : rendu calque, drag/resize, add/paste/delete, helpers texte/image.
 * `bind()` depuis renderer.js après historyMod.bind (captureSnapshot + wrappers renderAnnotations).
 */
(function () {
  "use strict";

  /** @type {Record<string, unknown> | null} */
  let deps = null;

  function requireDeps() {
    if (!deps) {
      throw new Error("[editify] renderer-annotations.js : appeler bind() avant usage.");
    }
    return deps;
  }

  /**
   * @param {Record<string, unknown>} next
   */
  function bind(next) {
    deps = next;
  }

  function findAnnotationLocation(tab, id) {
    if (!tab?.annotationsByPage || !id) return null;
    const pages = Object.keys(tab.annotationsByPage);
    for (const page of pages) {
      const arr = tab.annotationsByPage[page] || [];
      const idx = arr.findIndex((a) => a.id === id);
      if (idx >= 0) return { page: Number(page) || 1, arr, idx, item: arr[idx] };
    }
    return null;
  }

  function imageAnnotationDisplaySrc(a) {
    if (a?.src) return a.src;
    if (a?.src_base64) {
      const mime = String(a.mimeType || "image/png").trim() || "image/png";
      return `data:${mime};base64,${a.src_base64}`;
    }
    return "";
  }

  function getNewTextAnnotationDefaults() {
    const d = requireDeps();
    const lastTextStyle = /** @type {Record<string, unknown>} */ (d.lastTextStyle);
    return { ...lastTextStyle };
  }

  function focusTextAnnotationEditor(annotationId) {
    const d = requireDeps();
    const pdfLayerRef = /** @type {{ annotationLayer: HTMLElement | null }} */ (d.pdfLayerRef);
    const getAnnotationTextEditor =
      /** @type {(root: Element | null | undefined) => HTMLElement | null} */ (
        d.getAnnotationTextEditor
      );
    requestAnimationFrame(() => {
      const editNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${annotationId}"]`);
      const ed = getAnnotationTextEditor(editNode);
      if (ed) ed.focus();
      else editNode?.focus?.();
    });
  }

  function computeInsertPositionForNewAnnotation(tab, annotation, zone) {
    const d = requireDeps();
    const state = /** @type {{ lastPointer: { page: number, x: number, y: number } | null }} */ (
      d.state
    );
    const p =
      state.lastPointer && Number(state.lastPointer.page) === Number(tab.currentPage || 1)
        ? state.lastPointer
        : null;
    const cx = p ? p.x : zone.width / 2;
    const cy = p ? p.y : zone.height / 2;
    // Positionner top-left proche du curseur, sans sortir de la page.
    annotation.x = cx - (annotation.w || 20) / 2;
    annotation.y = cy - (annotation.h || 20) / 2;
  }

  function logAnnotationAudit(action, tab, item, pageKey) {
    const d = requireDeps();
    const pagesContainer = /** @type {HTMLElement | null} */ (d.pagesContainer);
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    try {
      const key = String(pageKey || tab?.currentPage || 1);
      const pageNode = pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
      window.maniPdfApi?.logEvent?.({
        level: "info",
        scope: "annotation",
        message: String(action),
        data: {
          action,
          page: key,
          type: item?.type,
          id: item?.id,
          x: Math.round(Number(item?.x) || 0),
          y: Math.round(Number(item?.y) || 0),
          w: Math.round(Number(item?.w) || 0),
          h: Math.round(Number(item?.h) || 0),
          rotation: Number(item?.rotation) || 0,
          userPageRotation: tab?.pageRotationsByPage?.[key] ?? 0,
          intrinsicPageRotation: Number(pageNode?.dataset?.intrinsicRotation) || 0,
          ...(item?.type === "text"
            ? {
                fontSize: item.fontSize,
                padding: item.padding,
                textLen: String(item.text || "").length
              }
            : {}),
          ...(item?.type === "image" ? { hasSrc: Boolean(item.src) } : {}),
          ...(SHAPE_TYPES.has(item?.type)
            ? { fillColor: item.fillColor, strokeColor: item.strokeColor }
            : {})
        }
      });
    } catch {
      /* ignore */
    }
  }

  function renderAnnotations() {
    const d = requireDeps();
    const pdfLayerRef = /** @type {{ annotationLayer: HTMLElement | null }} */ (d.pdfLayerRef);
    if (!pdfLayerRef.annotationLayer) return;
    pdfLayerRef.annotationLayer.innerHTML = "";
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    if (!tab) return;
    const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
      d.currentPageAnnotations
    );
    const state = /** @type {{
      selectedAnnotationId: string | null,
      editingAnnotationId: string | null,
      language: string
    }} */ (d.state);
    const pointer = /** @type {{
      interactionMode: string | null,
      suppressClickUntil: number,
      pendingSingleClickRenderTimer: ReturnType<typeof setTimeout> | null,
      lastTextMouseDownAt: number,
      lastTextMouseDownId: string | null,
      lastTextClickAt: number,
      lastTextClickId: string | null
    }} */ (d.pointer);
    const setSanitizedHtml = /** @type {(node: HTMLElement, html: string) => void} */ (
      d.setSanitizedHtml
    );
    const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
      d.getSafeZoneSize
    );
    const getTextWrapState = /** @type {(a: object, zone: object) => string} */ (
      d.getTextWrapState
    );
    const applySpellHighlightsToTextDisplayNode =
      /** @type {(node: HTMLElement, a: object) => void} */ (
        d.applySpellHighlightsToTextDisplayNode
      );
    const getSpellcheckBcp47FromUiLang = /** @type {(lang: string) => string} */ (
      d.getSpellcheckBcp47FromUiLang
    );
    const applyTextEditorLayoutStyles = /** @type {(ed: HTMLElement, wrap: string) => void} */ (
      d.applyTextEditorLayoutStyles
    );
    const wireTextEditorInteraction =
      /** @type {(tab: object, a: object, node: HTMLElement, ed: HTMLElement) => void} */ (
        d.wireTextEditorInteraction
      );
    const applyTextEditorVirtualTail = /** @type {(ed: HTMLElement, a: object) => void} */ (
      d.applyTextEditorVirtualTail
    );
    const getAnnotationTextEditor =
      /** @type {(root: Element | null | undefined) => HTMLElement | null} */ (
        d.getAnnotationTextEditor
      );
    const cancelPointerInteraction = /** @type {() => void} */ (d.cancelPointerInteraction);
    const tcm =
      /** @type {{ openTextAnnotationCtxMenu: (e: Event, id: string) => void, hideTextAnnotationCtxMenu: () => void }} */ (
        d.tcm
      );
    const sim = /** @type {{
      hideImageAnnotationCtxMenu: () => void,
      openShapeAnnotationCtxMenu: (e: Event, id: string) => void,
      hideShapeAnnotationCtxMenu: () => void,
      openImageAnnotationCtxMenu: (e: Event, id: string) => void
    }} */ (d.sim);
    const hideChangesContextMenu = /** @type {() => void} */ (d.hideChangesContextMenu);
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const mergeShapeStyleFields = /** @type {(a: object) => void} */ (d.mergeShapeStyleFields);
    const renderShapeVectorDOM = /** @type {(node: HTMLElement, a: object) => void} */ (
      d.renderShapeVectorDOM
    );
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const scheduleSidebarUpdate = /** @type {() => void} */ (d.scheduleSidebarUpdate);
    const scheduleAutoGrowText =
      /** @type {(tab: object, a: object, node: HTMLElement, reason: string) => void} */ (
        d.scheduleAutoGrowText
      );

    const annotations = currentPageAnnotations(tab);
    annotations.forEach((a) => {
      const node = document.createElement("div");
      node.className = `annotation ${a.type} ${state.selectedAnnotationId === a.id ? "selected" : ""}`;
      node.style.left = `${a.x}px`;
      node.style.top = `${a.y}px`;
      node.style.width = `${a.w}px`;
      node.style.height = `${a.h}px`;
      node.style.transformOrigin = "0 0";
      node.style.transform = `rotate(${a.rotation || 0}deg)`;
      node.style.opacity = String((a.opacity ?? 100) / 100);
      node.dataset.id = a.id;

      if (a.type === "text") {
        const isEditing = state.editingAnnotationId === a.id;
        node.setAttribute("contenteditable", "false");
        try {
          node.contentEditable = "false";
        } catch {
          /* ignore */
        }
        if (isEditing) node.classList.add("editing");
        node.dataset.placeholder = "Nouveau texte";
        node.style.color = a.textColor || "#111111";
        node.style.backgroundColor = a.bgColor ? a.bgColor : "transparent";
        const haloOn = a.halo !== false;
        node.style.textShadow = haloOn
          ? "0 0 2px rgba(255, 255, 255, 0.85), 0 0 3px rgba(0, 0, 0, 0.25)"
          : "none";
        node.style.padding = `${a.padding ?? 6}px`;
        node.style.fontFamily = a.fontFamily || "Arial";
        node.style.fontSize = `${a.fontSize ?? 14}px`;
        node.tabIndex = isEditing ? -1 : 0;

        if (!isEditing) {
          if (a.textHtml && String(a.textHtml).trim()) {
            setSanitizedHtml(node, a.textHtml);
          } else {
            node.textContent = a.text ? a.text : "";
          }
          {
            const zone = getSafeZoneSize();
            const wrapState = getTextWrapState(a, zone);
            if (wrapState === "auto") {
              node.classList.remove("wrap-display");
              node.style.whiteSpace = "pre";
            } else {
              node.classList.add("wrap-display");
              node.style.whiteSpace = "pre-wrap";
            }
          }
          applySpellHighlightsToTextDisplayNode(node, a);
        } else {
          node.innerHTML = "";
          const ed = document.createElement("div");
          ed.className = "text-editor";
          ed.setAttribute("role", "textbox");
          ed.setAttribute("aria-multiline", "true");
          ed.contentEditable = "true";
          ed.spellcheck = true;
          try {
            ed.setAttribute("lang", getSpellcheckBcp47FromUiLang(state.language));
          } catch {
            /* ignore */
          }
          if (a.textHtml && String(a.textHtml).trim()) {
            setSanitizedHtml(ed, a.textHtml);
          } else {
            ed.textContent = a.text || "";
          }
          {
            const zone = getSafeZoneSize();
            applyTextEditorLayoutStyles(ed, getTextWrapState(a, zone));
          }
          wireTextEditorInteraction(tab, a, node, ed);
          applyTextEditorVirtualTail(ed, a);
          node.appendChild(ed);
          requestAnimationFrame(() => {
            try {
              ed.focus();
            } catch {
              /* ignore */
            }
          });
        }

        node.oncontextmenu = (event) => {
          event.preventDefault();
          event.stopPropagation();
          tcm.openTextAnnotationCtxMenu(event, a.id);
        };

        node.ondblclick = (event) => {
          if (pointer.interactionMode && pointer.interactionMode !== "drag-pending") return;
          if (event.target.closest(".resize-handle")) return;
          // Déjà en édition : ne pas re-render ni preventDefault - sinon le navigateur
          // perd la sélection de mot native au double-clic (rebuild DOM + focus au début).
          if (state.editingAnnotationId === a.id) {
            try {
              event.stopPropagation();
            } catch {
              /* ignore */
            }
            return;
          }
          // CRITIQUE: évite que le listener global "clic hors zone" annule l'édition
          // dans le même cycle d'événement.
          try {
            event.preventDefault();
          } catch {
            /* ignore */
          }
          event.stopPropagation();
          cancelPointerInteraction();
          if (pointer.pendingSingleClickRenderTimer) {
            clearTimeout(pointer.pendingSingleClickRenderTimer);
            pointer.pendingSingleClickRenderTimer = null;
          }
          state.selectedAnnotationId = a.id;
          state.editingAnnotationId = a.id;
          renderAnnotations();
          requestAnimationFrame(() => {
            const editNode = pdfLayerRef.annotationLayer.querySelector(`[data-id="${a.id}"]`);
            const ed = getAnnotationTextEditor(editNode);
            if (ed) ed.focus();
            else editNode?.focus?.();
          });
        };
      } else if (a.type === "image") {
        const img = document.createElement("img");
        const displaySrc = imageAnnotationDisplaySrc(a);
        if (displaySrc) img.src = displaySrc;
        node.appendChild(img);
      } else if (SHAPE_TYPES.has(a.type)) {
        mergeShapeStyleFields(a);
        node.classList.add("shape-vector");
        renderShapeVectorDOM(node, a);
      }

      if (SHAPE_TYPES.has(a.type)) {
        node.oncontextmenu = (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideChangesContextMenu();
          tcm.hideTextAnnotationCtxMenu();
          sim.hideImageAnnotationCtxMenu();
          sim.openShapeAnnotationCtxMenu(event, a.id);
        };
      }
      if (a.type === "image") {
        node.oncontextmenu = (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideChangesContextMenu();
          tcm.hideTextAnnotationCtxMenu();
          sim.hideShapeAnnotationCtxMenu();
          sim.openImageAnnotationCtxMenu(event, a.id);
        };
      }

      node.onmousedown = (event) => {
        // En mode edition texte, laisser le comportement natif du navigateur
        // pour autoriser la selection partielle avec la souris.
        if (a.type === "text" && state.editingAnnotationId === a.id) {
          event.stopPropagation();
          return;
        }

        // Fallback ultra-robuste: on observe que "click/dblclick" ne se déclenche
        // pas toujours sous Electron quand on amorce un drag (même léger).
        // On passe donc en édition sur "double mousedown" rapide.
        if (a.type === "text" && !event.target.closest(".resize-handle")) {
          const now = Date.now();
          const isSecondDown =
            pointer.lastTextMouseDownId === a.id && now - pointer.lastTextMouseDownAt <= 320;

          pointer.lastTextMouseDownAt = now;
          pointer.lastTextMouseDownId = a.id;
          if (isSecondDown) {
            // CRITIQUE: sinon le mousedown "bulle" et le listener global
            // considère le clic comme "hors zone" (car le DOM est rerender),
            // ce qui annule immédiatement l'édition.
            try {
              event.preventDefault();
            } catch {
              /* ignore */
            }
            event.stopPropagation();
            state.selectedAnnotationId = a.id;
            state.editingAnnotationId = a.id;
            cancelPointerInteraction();
            if (pointer.pendingSingleClickRenderTimer) {
              clearTimeout(pointer.pendingSingleClickRenderTimer);
              pointer.pendingSingleClickRenderTimer = null;
            }
            renderAnnotations();
            requestAnimationFrame(() => {
              const editNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${a.id}"]`);
              const ed2 = getAnnotationTextEditor(editNode);
              if (ed2) ed2.focus();
              else editNode?.focus?.();
            });
            return;
          }
        }

        startDrag(event, a.id);
      };
      node.onclick = () => {
        if (Date.now() < pointer.suppressClickUntil || pointer.interactionMode) return;
        // Si on clique dans le bloc texte en cours d'edition (fond inclus),
        // on garde strictement le mode edition sans re-render.
        if (a.type === "text" && state.editingAnnotationId === a.id) {
          return;
        }

        state.selectedAnnotationId = a.id;
        // Ne pas quitter le mode edition si on clique dans la case texte.
        syncPropertyInputs();
        if (a.type === "text") {
          const now = Date.now();
          const isSecondClick =
            pointer.lastTextClickId === a.id && now - pointer.lastTextClickAt <= 320;
          pointer.lastTextClickAt = now;
          pointer.lastTextClickId = a.id;

          // Fallback robuste: Electron/Chromium peut ne pas émettre "dblclick"
          // si le DOM est rerender ou si un drag est amorcé.
          if (isSecondClick) {
            if (pointer.pendingSingleClickRenderTimer) {
              clearTimeout(pointer.pendingSingleClickRenderTimer);
              pointer.pendingSingleClickRenderTimer = null;
            }
            state.editingAnnotationId = a.id;
            cancelPointerInteraction();
            renderAnnotations();
            requestAnimationFrame(() => {
              const editNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${a.id}"]`);
              const ed2 = getAnnotationTextEditor(editNode);
              if (ed2) ed2.focus();
              else editNode?.focus?.();
            });
            return;
          }

          if (pointer.pendingSingleClickRenderTimer)
            clearTimeout(pointer.pendingSingleClickRenderTimer);
          pointer.pendingSingleClickRenderTimer = setTimeout(() => {
            pointer.pendingSingleClickRenderTimer = null;
            renderAnnotations();
          }, 260);
          return;
        }
        renderAnnotations();
      };

      if (
        state.selectedAnnotationId === a.id &&
        !(a.type === "text" && state.editingAnnotationId === a.id)
      ) {
        const handles = [
          { mode: "tl", className: "resize-handle tl" },
          { mode: "t", className: "resize-handle top-middle" },
          { mode: "tr", className: "resize-handle tr" },
          { mode: "l", className: "resize-handle left-middle" },
          { mode: "r", className: "resize-handle right-middle" },
          { mode: "bl", className: "resize-handle bl" },
          { mode: "b", className: "resize-handle bottom-middle" },
          { mode: "br", className: "resize-handle br" }
        ];
        handles.forEach((h) => {
          const handle = document.createElement("div");
          handle.className = h.className;
          handle.dataset.mode = h.mode;
          handle.onmousedown = (event) => startResize(event, a.id, h.mode);
          node.appendChild(handle);
        });
      }
      pdfLayerRef.annotationLayer.appendChild(node);
      if (a.type === "text") {
        scheduleAutoGrowText(tab, a, node, "render");
      }
    });
    scheduleSidebarUpdate();
  }

  function startDrag(event, id) {
    const d = requireDeps();
    const pointer = /** @type {{
      interactionMode: string | null,
      suppressClickUntil: number,
      activePointerCleanup: (() => void) | null
    }} */ (d.pointer);
    if (event.button !== 0) return;
    if (pointer.interactionMode) return;

    const state =
      /** @type {{ selectedAnnotationId: string | null, editingAnnotationId: string | null }} */ (
        d.state
      );
    if (state.editingAnnotationId === id) return;
    if (event.target.classList?.contains("resize-handle")) return;
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    if (!tab) return;
    const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
      d.currentPageAnnotations
    );
    const item = currentPageAnnotations(tab).find((a) => a.id === id);
    if (!item) return;
    state.selectedAnnotationId = id;
    // Ne pas preventDefault ici: sinon Chromium ne déclenche souvent pas le dblclick.
    pointer.interactionMode = "drag-pending";
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = item.x;
    const originY = item.y;
    const viewer = /** @type {HTMLElement | null} */ (d.viewer);
    const startScrollLeft = viewer?.scrollLeft || 0;
    const startScrollTop = viewer?.scrollTop || 0;
    let lastClientX = startX;
    let lastClientY = startY;
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    let hasMoved = false;
    const clamp = /** @type {(v: number, min: number, max: number) => number} */ (d.clamp);
    const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
      d.getSafeZoneSize
    );
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);

    const applyDragAt = (clientX, clientY) => {
      const dx = clientX - startX + ((viewer?.scrollLeft || 0) - startScrollLeft);
      const dy = clientY - startY + ((viewer?.scrollTop || 0) - startScrollTop);
      const dist2 = dx * dx + dy * dy;
      if (!hasMoved) {
        // seuil anti "clic = drag" (permet dblclick fiable)
        // 12px: évite qu'un léger tremblement annule le click/dblclick
        if (dist2 < 144) return;
        hasMoved = true;
        pointer.interactionMode = "drag";
        try {
          // On ne doit empêcher le comportement par défaut qu'une fois le drag confirmé.
          // (Sinon dblclick devient flaky sous Chromium/Electron.)
        } catch {
          /* ignore */
        }
      }
      const zone = getSafeZoneSize();
      const maxX = Math.max(0, zone.width - item.w);
      const maxY = Math.max(0, zone.height - item.h);
      item.x = clamp(originX + dx, 0, maxX);
      item.y = clamp(originY + dy, 0, maxY);
      renderAnnotations();
    };

    const move = (ev) => {
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      if (hasMoved) {
        try {
          ev.preventDefault();
        } catch {
          /* ignore */
        }
      }
      applyDragAt(ev.clientX, ev.clientY);
    };

    // Si l'utilisateur scroll pendant le drag, l'élément doit rester sous le curseur.
    const onScroll = () => {
      if (!hasMoved) return;
      applyDragAt(lastClientX, lastClientY);
    };

    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      viewer?.removeEventListener?.("scroll", onScroll);
      pointer.interactionMode = null;
      // Ne pas bloquer le click si on n'a pas réellement dragué.
      pointer.suppressClickUntil = Date.now() + (hasMoved ? 180 : 0);
      pointer.activePointerCleanup = null;
      syncPropertyInputs();
      session.scheduleAutoSave();
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    viewer?.addEventListener?.("scroll", onScroll, { passive: true });
    pointer.activePointerCleanup = up;
  }

  /**
   * Redimensionne l'annotation : les deltas écran sont exprimés dans le repère local
   * tourné de `item.rotation` (cohérent avec `transform-origin: 0 0` sur `.annotation`).
   */
  function startResize(event, id, mode = "br") {
    const d = requireDeps();
    const pointer = /** @type {{
      interactionMode: string | null,
      suppressClickUntil: number,
      activePointerCleanup: (() => void) | null
    }} */ (d.pointer);
    if (event.button !== 0) return;
    if (pointer.interactionMode) return;
    event.preventDefault();
    event.stopPropagation();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    if (!tab) return;
    const currentPageAnnotations = /** @type {(tab: object) => object[]} */ (
      d.currentPageAnnotations
    );
    const item = currentPageAnnotations(tab).find((a) => a.id === id);
    if (!item) return;
    const state =
      /** @type {{ selectedAnnotationId: string | null, editingAnnotationId: string | null }} */ (
        d.state
      );
    state.selectedAnnotationId = id;
    pointer.interactionMode = "resize";
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = item.x;
    const originY = item.y;
    const originW = item.w;
    const originH = item.h;
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    const clamp = /** @type {(v: number, min: number, max: number) => number} */ (d.clamp);
    const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
      d.getSafeZoneSize
    );
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const getRequiredTextHeightForWidth = /** @type {(item: object, w: number) => number} */ (
      d.getRequiredTextHeightForWidth
    );
    const getMinWidthToFitHeight =
      /** @type {(item: object, h: number, maxW: number) => number} */ (d.getMinWidthToFitHeight);
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    const pdfLayerRef = /** @type {{ annotationLayer: HTMLElement | null }} */ (d.pdfLayerRef);
    const applyEditingTextAutoGrow =
      /** @type {(tab: object, item: object, node: HTMLElement) => void} */ (
        d.applyEditingTextAutoGrow
      );
    const logText = /** @type {(msg: string, data?: object) => void} */ (d.logText);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);

    const move = (ev) => {
      const zone = getSafeZoneSize();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Deltas dans le repère local non pivoté (CSS rotate), pour un étirement cohérent avec la rotation.
      const rot = Number(item.rotation) || 0;
      const rad = (rot * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const dlx = dx * c + dy * s;
      const dly = -dx * s + dy * c;
      let minW = 20;
      let minH = 20;
      if (SHAPE_TYPES.has(item.type)) {
        minW = 1;
        minH = 1;
      }

      let nextX = originX;
      let nextY = originY;
      let nextW = originW;
      let nextH = originH;

      const affectsLeft = mode === "l" || mode === "tl" || mode === "bl";
      const affectsRight = mode === "r" || mode === "tr" || mode === "br";
      const affectsTop = mode === "t" || mode === "tl" || mode === "tr";
      const affectsBottom = mode === "b" || mode === "bl" || mode === "br";

      if (affectsRight) nextW = originW + dlx;
      if (affectsBottom) nextH = originH + dly;
      if (affectsLeft) {
        nextX = originX + dlx;
        nextW = originW - dlx;
      }
      if (affectsTop) {
        nextY = originY + dly;
        nextH = originH - dly;
      }

      // Enforce min sizes by adjusting the anchored edge.
      if (item.type === "text") {
        // La fenêtre ne peut pas être plus petite que le texte qu'elle contient.
        // IMPORTANT: si on est en resize horizontal pur (gauche/droite), on ne doit
        // pas "partir vers le bas" : on bloque la largeur au lieu d'augmenter la hauteur.
        const horizontalOnly = (affectsLeft || affectsRight) && !affectsTop && !affectsBottom;
        if (!horizontalOnly) {
          minH = Math.max(minH, getRequiredTextHeightForWidth(item, nextW));
        }
      }
      if (nextW < minW) {
        if (affectsLeft) nextX -= minW - nextW;
        nextW = minW;
      }
      if (nextH < minH) {
        if (affectsTop) nextY -= minH - nextH;
        nextH = minH;
      }

      // Blocage largeur pour texte si réduire la largeur imposerait d'augmenter la hauteur
      // (cas "resize gauche/droite" où l'utilisateur force au delà du minimum).
      if (item.type === "text") {
        const horizontalOnly = (affectsLeft || affectsRight) && !affectsTop && !affectsBottom;
        if (horizontalOnly) {
          // Après les clamps, nextH correspond à la hauteur stable du cadre.
          // On calcule la largeur minimale qui permet au texte de tenir dans nextH.
          const maxWAllowed = Math.max(minW, zone.width - clamp(nextX, 0, zone.width));
          const minWidthToFit = getMinWidthToFitHeight(
            item,
            nextH,
            Math.min(maxWAllowed, Math.max(nextW, originW))
          );
          if (nextW < minWidthToFit) {
            if (affectsLeft) {
              nextX -= minWidthToFit - nextW;
            }
            nextW = minWidthToFit;
          }
        }
      }

      // Clamp within safe zone
      nextX = clamp(nextX, 0, Math.max(0, zone.width - nextW));
      nextY = clamp(nextY, 0, Math.max(0, zone.height - nextH));
      nextW = clamp(nextW, minW, Math.max(minW, zone.width - nextX));
      nextH = clamp(nextH, minH, Math.max(minH, zone.height - nextY));

      item.x = nextX;
      item.y = nextY;
      item.w = nextW;
      item.h = nextH;
      syncPropertyInputs();
      renderAnnotations();
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      pointer.interactionMode = null;
      pointer.suppressClickUntil = Date.now() + 180;
      pointer.activePointerCleanup = null;
      if (item.type === "text") {
        item.textWrapManual = true;
        if (state.editingAnnotationId === item.id) {
          const editNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${item.id}"]`);
          if (editNode) applyEditingTextAutoGrow(tab, item, editNode);
        }
      }
      if (SHAPE_TYPES.has(item.type)) {
        try {
          logText("shapeResizeEnd", {
            type: item.type,
            id: item.id,
            w: item.w,
            h: item.h,
            minLogical: 1
          });
        } catch {
          /* ignore */
        }
      }
      session.scheduleAutoSave();
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    pointer.activePointerCleanup = up;
  }

  function addAnnotation(type, extra = {}) {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    if (!tab) return;
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    const pageKey = String(tab.currentPage || 1);
    const annotationsOnPage = /** @type {(tab: object, pageKey: string) => object[]} */ (
      d.annotationsOnPage
    );
    const annotations = annotationsOnPage(tab, pageKey);
    const newAnnotationId = /** @type {() => string} */ (d.newAnnotationId);
    const id = newAnnotationId();
    const textDefaults = type === "text" ? getNewTextAnnotationDefaults() : null;
    const getInitialTextAnnotationSize =
      /** @type {(defaults: object | null) => { w: number, h: number }} */ (
        d.getInitialTextAnnotationSize
      );
    const textInitialSize = type === "text" ? getInitialTextAnnotationSize(textDefaults) : null;
    const annotation = {
      id,
      type,
      x: 80,
      y: 80,
      w: type === "text" ? textInitialSize.w : 180,
      h: type === "text" ? textInitialSize.h : 120,
      rotation: 0,
      opacity: 100,
      ...(type === "text"
        ? { ...textDefaults, text: "", textWrapManual: false }
        : {
            textColor: "#111111",
            bgColor: null,
            padding: 6,
            fontFamily: "Arial",
            fontSize: 14
          }),
      ...extra
    };
    const SHAPE_TYPES = /** @type {Set<string>} */ (d.SHAPE_TYPES);
    const mergeShapeStyleFields = /** @type {(a: object) => void} */ (d.mergeShapeStyleFields);
    if (SHAPE_TYPES.has(type)) {
      mergeShapeStyleFields(annotation);
    }
    const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
      d.getSafeZoneSize
    );
    const zone = getSafeZoneSize();
    if (!tab.viewportByPage) tab.viewportByPage = {};
    if (!tab.viewportByPage[pageKey]?.width || !tab.viewportByPage[pageKey]?.height) {
      tab.viewportByPage[pageKey] = { width: zone.width, height: zone.height };
    }
    computeInsertPositionForNewAnnotation(tab, annotation, zone);
    const fitAnnotationToSafeZone = /** @type {(item: object, zone: object) => void} */ (
      d.fitAnnotationToSafeZone
    );
    fitAnnotationToSafeZone(annotation, zone);
    annotations.push(annotation);
    const state =
      /** @type {{ selectedAnnotationId: string | null, editingAnnotationId: string | null }} */ (
        d.state
      );
    state.selectedAnnotationId = id;
    if (type === "text") {
      state.editingAnnotationId = id;
      const captureLastTextStyleFromItem = /** @type {(item: object) => void} */ (
        d.captureLastTextStyleFromItem
      );
      captureLastTextStyleFromItem(annotation);
    }
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    syncPropertyInputs();
    renderAnnotations();
    if (type === "text") {
      focusTextAnnotationEditor(id);
    }
    logAnnotationAudit("add", tab, annotation, pageKey);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    session.scheduleAutoSave();
  }

  function pasteClipboardIntoActivePage() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    const state = /** @type {{
      clipboard: object | null,
      selectedAnnotationId: string | null,
      editingAnnotationId: string | null,
      lastPointer: { page: number, x: number, y: number } | null
    }} */ (d.state);
    if (!tab || !state.clipboard) return;
    const deepClone = /** @type {(v: object) => object} */ (d.deepClone);
    const data = deepClone(state.clipboard);
    const newAnnotationId = /** @type {() => string} */ (d.newAnnotationId);
    data.id = newAnnotationId();

    // Page cible = page active (la position du curseur est supposée être sur cette page).
    const targetPage = String(tab.currentPage || 1);
    if (!tab.annotationsByPage[targetPage]) tab.annotationsByPage[targetPage] = [];

    const getSafeZoneSize = /** @type {() => { width: number, height: number }} */ (
      d.getSafeZoneSize
    );
    const zone = getSafeZoneSize();
    const p =
      state.lastPointer && Number(state.lastPointer.page) === Number(tab.currentPage || 1)
        ? state.lastPointer
        : null;
    const cx = p ? p.x : zone.width / 2;
    const cy = p ? p.y : zone.height / 2;

    // Positionner top-left proche du curseur, sans sortir de la page.
    data.x = cx - (data.w || 20) / 2;
    data.y = cy - (data.h || 20) / 2;
    const fitAnnotationToSafeZone = /** @type {(item: object, zone: object) => void} */ (
      d.fitAnnotationToSafeZone
    );
    fitAnnotationToSafeZone(data, zone);

    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    tab.annotationsByPage[targetPage].push(data);
    state.selectedAnnotationId = data.id;
    state.editingAnnotationId = null;
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    syncPropertyInputs();
    renderAnnotations();
    logAnnotationAudit("paste", tab, data, targetPage);
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    session.scheduleAutoSave();
  }

  function deleteSelected() {
    const d = requireDeps();
    const getActiveTab = /** @type {() => object | null} */ (d.getActiveTab);
    const tab = getActiveTab();
    const state = /** @type {{ selectedAnnotationId: string | null }} */ (d.state);
    if (!tab || !state.selectedAnnotationId) return;
    const found = findAnnotationLocation(tab, state.selectedAnnotationId);
    if (!found) return;
    const captureSnapshot = /** @type {(tab: object) => void} */ (d.captureSnapshot);
    captureSnapshot(tab);
    found.arr.splice(found.idx, 1);
    state.selectedAnnotationId = null;
    const syncPropertyInputs = /** @type {() => void} */ (d.syncPropertyInputs);
    syncPropertyInputs();
    renderAnnotations();
    const session = /** @type {{ scheduleAutoSave: () => void }} */ (d.session);
    session.scheduleAutoSave();
  }

  window.__editifyAnnotations = {
    bind,
    findAnnotationLocation,
    renderAnnotations,
    startDrag,
    startResize,
    computeInsertPositionForNewAnnotation,
    logAnnotationAudit,
    addAnnotation,
    pasteClipboardIntoActivePage,
    deleteSelected,
    getNewTextAnnotationDefaults,
    focusTextAnnotationEditor,
    imageAnnotationDisplaySrc,
    /** Marqueur module pour tests E2E / verify. */
    moduleId: "renderer-annotations"
  };
})();
