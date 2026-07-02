/**
 * Colonnes miniatures + liste « Ajouts ». Dépendances injectées via `bind()` depuis `renderer.js`
 * une fois `getActiveTab`, `renderAnnotations`, etc. définis.
 */
(function () {
  "use strict";

  let sidebarUpdateTimer = null;
  /** @type {Record<string, unknown> | null} */
  let ctx = null;

  function bind(next) {
    ctx = next;
  }

  function getAllAnnotationsWithPage(tab) {
    const out = [];
    if (!tab?.annotationsByPage) return out;
    Object.keys(tab.annotationsByPage).forEach((page) => {
      const arr = tab.annotationsByPage[page] || [];
      arr.forEach((a) => out.push({ page: Number(page) || 1, a }));
    });
    out.sort((x, y) => x.page - y.page);
    return out;
  }

  function drawThumbOverlay(c, annos, scale) {
    if (!c || !annos?.length) return;
    c.save();
    c.globalAlpha = 0.9;
    annos.forEach((a) => {
      const x = (a.x || 0) * scale;
      const y = (a.y || 0) * scale;
      const w = (a.w || 20) * scale;
      const h = (a.h || 20) * scale;
      if (a.type === "text") {
        c.strokeStyle = "rgba(0,122,204,0.9)";
        c.lineWidth = 1.5;
        c.strokeRect(x, y, w, h);
        c.fillStyle = "rgba(0,122,204,0.9)";
        c.font = "10px Arial";
        c.fillText("T", x + 2, y + 10);
      } else if (a.type === "image") {
        c.strokeStyle = "rgba(33,150,243,0.9)";
        c.lineWidth = 1.5;
        c.strokeRect(x, y, w, h);
        c.fillStyle = "rgba(33,150,243,0.9)";
        c.font = "10px Arial";
        c.fillText("IMG", x + 2, y + 10);
      } else {
        c.strokeStyle = "rgba(255,120,0,0.95)";
        c.lineWidth = 1.5;
        c.strokeRect(x, y, w, h);
      }
    });
    c.restore();
  }

  function scheduleSidebarUpdate() {
    if (sidebarUpdateTimer) clearTimeout(sidebarUpdateTimer);
    sidebarUpdateTimer = setTimeout(() => {
      sidebarUpdateTimer = null;
      try {
        renderThumbnails();
        renderChanges();
      } catch {
        /* ignore */
      }
    }, 60);
  }

  function renderChanges() {
    const d = ctx;
    if (!d) return;
    if (!d.changesList) return;
    const tab = d.getActiveTab();
    d.changesList.innerHTML = "";
    if (!tab) {
      if (d.changesCount) d.changesCount.textContent = "0";
      return;
    }
    const list = getAllAnnotationsWithPage(tab);
    if (d.changesCount) d.changesCount.textContent = String(list.length);
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = d.t("noAddsDoc");
      d.changesList.appendChild(empty);
      return;
    }
    list.forEach(({ page, a }) => {
      const row = document.createElement("div");
      row.className = `change-item ${d.state.selectedAnnotationId === a.id ? "selected" : ""}`;
      row.dataset.id = a.id;
      row.dataset.page = String(page);
      const top = document.createElement("div");
      top.className = "change-topline";
      const type = document.createElement("div");
      type.className = "change-type";
      type.textContent = d.annotationTypeLabel(a);
      const p = document.createElement("div");
      p.className = "change-page";
      p.textContent = d.tr("changePageLine", { n: String(page) });
      top.appendChild(type);
      top.appendChild(p);
      const sum = document.createElement("div");
      sum.className = "change-summary";
      sum.textContent = d.annotationSummary(a);
      row.appendChild(top);
      row.appendChild(sum);
      row.addEventListener("click", () => {
        try {
          d.state.selectedAnnotationId = a.id;
          d.state.editingAnnotationId = null;
          d.setActivePage(page);
          const pageNode = d.pagesContainer?.querySelector?.(`.pdf-page[data-page="${page}"]`);
          pageNode?.scrollIntoView?.({ block: "start", inline: "nearest" });
          d.syncPropertyInputs();
          d.renderAnnotations();
          requestAnimationFrame(() => {
            try {
              const node = d.annotationLayer?.querySelector?.(`[data-id="${a.id}"]`);
              node?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
            } catch {
              /* ignore */
            }
          });
        } catch {
          /* ignore */
        }
      });
      row.oncontextmenu = (ev) => {
        try {
          ev.preventDefault();
        } catch {
          /* ignore */
        }
        try {
          row.click();
        } catch {
          /* ignore */
        }
        try {
          const menu = d.ensureChangesContextMenu();
          menu.classList.remove("hidden");
          const margin = 8;
          const x = d.clamp((ev.clientX ?? 0) + 2, margin, window.innerWidth - 240 - margin);
          const y = d.clamp((ev.clientY ?? 0) + 2, margin, window.innerHeight - 80 - margin);
          menu.style.left = `${x}px`;
          menu.style.top = `${y}px`;
        } catch {
          /* ignore */
        }
      };
      d.changesList.appendChild(row);
    });
  }

  function renderThumbnails() {
    const d = ctx;
    if (!d) return;
    if (!d.thumbsList || !d.pagesContainer) return;
    const tab = d.getActiveTab();
    d.thumbsList.innerHTML = "";
    if (!tab) return;
    const pages = Array.from(d.pagesContainer.querySelectorAll(".pdf-page"));
    if (pages.length === 0) return;

    pages.forEach((pageNode) => {
      const pageNumber = Number(pageNode.dataset.page) || 1;
      const srcCanvas = pageNode.querySelector("canvas.pdf-canvas");
      if (!srcCanvas) return;

      const item = document.createElement("div");
      item.className = `thumb-item ${tab.currentPage === pageNumber ? "active" : ""}`;
      item.dataset.page = String(pageNumber);

      const thumb = document.createElement("canvas");
      thumb.className = "thumb-canvas";
      const targetW = 56;
      const ratio = srcCanvas.width > 0 ? targetW / srcCanvas.width : 1;
      thumb.width = Math.max(10, Math.floor(srcCanvas.width * ratio));
      thumb.height = Math.max(10, Math.floor(srcCanvas.height * ratio));
      const cctx = thumb.getContext("2d");
      try {
        cctx.drawImage(srcCanvas, 0, 0, thumb.width, thumb.height);
        const annos = tab.annotationsByPage?.[String(pageNumber)] || [];
        drawThumbOverlay(cctx, annos, ratio);
      } catch {
        /* ignore */
      }

      const meta = document.createElement("div");
      meta.className = "thumb-meta";
      const title = document.createElement("div");
      title.className = "thumb-title";
      title.textContent = `${d.t("pageWord")} ${pageNumber}`;
      const annosCount = (tab.annotationsByPage?.[String(pageNumber)] || []).length;
      const sub = document.createElement("div");
      sub.className = "thumb-sub";
      sub.textContent = annosCount
        ? d.tr("thumbAddsCount", { n: String(annosCount) })
        : d.t("noAdds");
      meta.appendChild(title);
      meta.appendChild(sub);

      item.appendChild(thumb);
      item.appendChild(meta);
      item.onclick = () => {
        try {
          d.setActivePage(pageNumber);
          pageNode.scrollIntoView({ block: "start", inline: "nearest" });
          renderThumbnails();
          renderChanges();
        } catch {
          /* ignore */
        }
      };
      d.thumbsList.appendChild(item);
    });

    const activeThumb = d.thumbsList.querySelector(".thumb-item.active");
    activeThumb?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  window.__editifySidebars = {
    bind,
    scheduleSidebarUpdate,
    renderThumbnails,
    renderChanges
  };
})();
