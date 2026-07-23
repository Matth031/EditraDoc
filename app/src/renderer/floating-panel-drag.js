/**
 * Glisser-déposer des panneaux position:fixed (menus contextuels, modale couleur).
 * Attache sur la poignée (titre) ; ignore boutons / champs dans la poignée.
 */
(function () {
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /**
   * @param {HTMLElement} panel
   * @param {string} handleSelector
   * @param {{ ignoreSelector?: string }} [opts]
   */
  function wireDrag(panel, handleSelector, opts) {
    if (!panel || panel.dataset.maniDragWired === "1") return;
    const ignoreSel = opts?.ignoreSelector || "button,a,input,select,textarea,option";
    const handle = panel.querySelector(handleSelector);
    if (!handle) return;
    panel.dataset.maniDragWired = "1";
    handle.classList.add("mani-drag-handle");

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      try {
        if (e.target?.closest?.(ignoreSel)) return;
      } catch {
        return;
      }
      dragging = true;
      const r = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      originLeft = r.left;
      originTop = r.top;
      panel.style.left = `${originLeft}px`;
      panel.style.top = `${originTop}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.transform = "none";
      try {
        e.preventDefault();
      } catch {
        /* intentional: preventDefault during panel drag best-effort */
      }
    });

    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let l = originLeft + dx;
      let t = originTop + dy;
      const w = panel.offsetWidth || 200;
      const h = panel.offsetHeight || 120;
      l = clamp(l, 4, window.innerWidth - w - 4);
      t = clamp(t, 4, window.innerHeight - h - 4);
      panel.style.left = `${l}px`;
      panel.style.top = `${t}px`;
    }

    function onUp() {
      dragging = false;
    }

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
  }

  function wireAllCtxMenus() {
    const pairs = [
      ["#textAnnotationCtxMenu", ".text-ctx-menu-title"],
      ["#shapeAnnotationCtxMenu", ".text-ctx-menu-title"],
      ["#imageAnnotationCtxMenu", ".text-ctx-menu-title"],
      ["#blankCanvasCtxMenu", ".text-ctx-menu-title"]
    ];
    for (const [rootSel, hSel] of pairs) {
      const el = document.querySelector(rootSel);
      if (el) wireDrag(el, hSel, { ignoreSelector: "button,a,input,select,textarea,option" });
    }
  }

  window.wireManiFloatingCtxMenus = wireAllCtxMenus;
  window.wireManiFloatingDrag = wireDrag;
})();
