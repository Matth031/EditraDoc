/**
 * Sélecteur de couleur unique : pastille + champ hidden (#rrggbb), modale avec « Valider » en bas à gauche (ligne RGB).
 */
(function () {
  const $ = (id) => document.getElementById(id);

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function parseHex(hex) {
    const s = String(hex || "").trim();
    const m = s.match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return { r: 0, g: 0, b: 0 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const h = (n) => n.toString(16).padStart(2, "0");
    return `#${h(clamp(Math.round(r), 0, 255))}${h(clamp(Math.round(g), 0, 255))}${h(clamp(Math.round(b), 0, 255))}`;
  }

  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s, v };
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (h < 60) {
      rp = c;
      gp = x;
    } else if (h < 120) {
      rp = x;
      gp = c;
    } else if (h < 180) {
      gp = c;
      bp = x;
    } else if (h < 240) {
      gp = x;
      bp = c;
    } else if (h < 300) {
      rp = x;
      bp = c;
    } else {
      rp = c;
      bp = x;
    }
    return {
      r: (rp + m) * 255,
      g: (gp + m) * 255,
      b: (bp + m) * 255
    };
  }

  let modal = null;
  let targetInput = null;
  let hsv = { h: 0, s: 1, v: 1 };
  let draggingSv = false;

  function getEls() {
    return {
      modal: $("maniColorModal"),
      svCanvas: /** @type {HTMLCanvasElement | null} */ ($("maniColorSvCanvas")),
      hue: /** @type {HTMLInputElement | null} */ ($("maniColorHue")),
      r: /** @type {HTMLInputElement | null} */ ($("maniColorR")),
      g: /** @type {HTMLInputElement | null} */ ($("maniColorG")),
      b: /** @type {HTMLInputElement | null} */ ($("maniColorB")),
      preview: $("maniColorPreview"),
      validateBtn: $("maniColorValidateBtn"),
      closeBtn: $("maniColorModalClose"),
      eyedropperBtn: $("maniColorEyedropper")
    };
  }

  function drawSv() {
    const { svCanvas } = getEls();
    if (!svCanvas) return;
    const hc = hsv.h;
    const w = svCanvas.width;
    const h = svCanvas.height;
    const ctx = svCanvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y += 1) {
      const vv = 1 - y / (h - 1 || 1);
      for (let x = 0; x < w; x += 1) {
        const ss = x / (w - 1 || 1);
        const { r, g, b } = hsvToRgb(hc, ss, vv);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const px = hsv.s * (w - 1);
    const py = (1 - hsv.v) * (h - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();
    const { preview } = getEls();
    if (preview) {
      preview.style.backgroundColor = rgbToHex(r, g, b);
    }
  }

  function syncRgbFields() {
    const { r, g, b, hue } = getEls();
    const { r: rr, g: gg, b: bb } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    if (r) r.value = String(Math.round(rr));
    if (g) g.value = String(Math.round(gg));
    if (b) b.value = String(Math.round(bb));
    if (hue) hue.value = String(Math.round(hsv.h));
    drawSv();
  }

  function readRgbFromFields() {
    const { r, g, b } = getEls();
    const rr = clamp(Number(r?.value), 0, 255);
    const gg = clamp(Number(g?.value), 0, 255);
    const bb = clamp(Number(b?.value), 0, 255);
    hsv = rgbToHsv(rr, gg, bb);
    syncRgbFields();
  }

  function openForInput(inputEl) {
    targetInput = inputEl;
    try {
      document.dispatchEvent(
        new CustomEvent("mani-color-open", {
          bubbles: true,
          detail: { inputId: inputEl?.id || "" }
        })
      );
    } catch {
      /* intentional: mani-color-open CustomEvent dispatch best-effort */
    }
    const { modal: m } = getEls();
    if (!m) return;
    const panel = m.querySelector(".mani-color-modal-panel");
    if (panel) {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.bottom = "";
      panel.style.transform = "";
    }
    const hex = inputEl?.value || "#000000";
    const { r, g, b } = parseHex(hex);
    hsv = rgbToHsv(r, g, b);
    syncRgbFields();
    m.classList.remove("hidden");
    m.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const { modal: m } = getEls();
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
    targetInput = null;
    try {
      document.dispatchEvent(new CustomEvent("mani-color-close", { bubbles: true }));
    } catch {
      /* intentional: mani-color-close CustomEvent dispatch best-effort */
    }
  }

  function commit() {
    if (!targetInput) {
      try {
        console.info("[mani-color] commit skipped (no targetInput)");
      } catch {
        /* intentional: console.info may throw in locked console */
      }
      closeModal();
      return;
    }
    const inp = targetInput;
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    inp.value = rgbToHex(r, g, b);
    const skipLiveInput = inp.id === "propTextColor" || inp.id === "ctxTextColor";
    if (!skipLiveInput) {
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
    syncOneSwatchForInput(inp);
    try {
      console.info("[mani-color] commit", { id: inp.id, hex: inp.value });
    } catch {
      /* intentional: console.info commit log best-effort */
    }
    try {
      const apply =
        typeof globalThis !== "undefined" && typeof globalThis.maniAfterColorCommit === "function"
          ? globalThis.maniAfterColorCommit
          : typeof window !== "undefined" && typeof window.maniAfterColorCommit === "function"
            ? window.maniAfterColorCommit
            : null;
      if (apply) {
        try {
          apply(inp);
        } catch (err) {
          console.error("[mani-color] maniAfterColorCommit exception", err);
          try {
            globalThis.maniPdfApi?.log?.("mani-color commit exception", {
              id: inp.id,
              err: String(err)
            });
          } catch {
            /* intentional: secondary commit exception log best-effort */
          }
        }
      } else {
        console.error("[mani-color] maniAfterColorCommit absent - fallback boutons Valider");
        try {
          const id = inp.id || "";
          const map = {
            propShapeFill: "validateShapeFillBtn",
            propShapeStroke: "validateShapeStrokeBtn",
            propShapeBackdrop: "validateShapeBackdropBtn",
            propTextColor: "validateTextColorBtn",
            propBgColor: "applyBgBtn",
            ctxTextColor: "ctxValidateTextColorBtn",
            ctxTextBg: "ctxValidateTextBgBtn",
            ctxShapeFill: "ctxValidateShapeFillBtn",
            ctxShapeStroke: "ctxValidateShapeStrokeBtn",
            ctxShapeBackdrop: "ctxValidateShapeBackdropBtn"
          };
          const bid = map[id];
          if (bid) document.getElementById(bid)?.click?.();
        } catch {
          /* intentional: ctx validate button auto-click best-effort */
        }
      }
    } catch (e) {
      try {
        console.error("[mani-color] maniAfterColorCommit erreur", e);
      } catch {
        /* intentional: console.error after commit best-effort */
      }
    }
    try {
      if (
        typeof window !== "undefined" &&
        window.maniPdfApi &&
        typeof window.maniPdfApi.log === "function"
      ) {
        window.maniPdfApi.log("mani-color commit", {
          id: inp.id,
          hex: inp.value,
          panelText: inp.id === "propTextColor" || inp.id === "propBgColor",
          panelShape: String(inp.id || "").startsWith("propShape")
        });
      }
    } catch {
      /* intentional: post-commit panel sync log best-effort */
    }
    closeModal();
  }

  function syncOneSwatchForInput(inputEl) {
    const id = inputEl.id;
    if (!id) return;
    const btn = document.querySelector(`[data-mani-color-for="${id}"]`);
    if (!btn) return;
    const hex = inputEl.value || "#000000";
    btn.style.backgroundColor = hex;
    const labelCf = inputEl.closest?.("label.color-field");
    const ctxBgRow = document.getElementById("ctxTextBgLabel");
    const transparent =
      Boolean(labelCf?.classList.contains("is-transparent")) ||
      (id === "ctxTextBg" && Boolean(ctxBgRow?.classList.contains("is-transparent"))) ||
      (id === "propBgColor" &&
        Boolean(document.getElementById("propBgColorLabel")?.classList.contains("is-transparent")));
    if (transparent) {
      btn.classList.add("mani-swatch-transparent-bg");
    } else {
      btn.classList.remove("mani-swatch-transparent-bg");
    }
  }

  function wireModalOnce() {
    if (modal) return;
    const els = getEls();
    if (!els.modal || !els.svCanvas || !els.hue) return;
    modal = els.modal;

    els.hue.addEventListener("input", () => {
      hsv.h = clamp(Number(els.hue.value), 0, 360);
      const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
      if (els.r) els.r.value = String(Math.round(r));
      if (els.g) els.g.value = String(Math.round(g));
      if (els.b) els.b.value = String(Math.round(b));
      drawSv();
    });

    ["maniColorR", "maniColorG", "maniColorB"].forEach((id) => {
      $(id)?.addEventListener("change", readRgbFromFields);
      $(id)?.addEventListener("input", readRgbFromFields);
    });

    els.svCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      draggingSv = true;
      updateSvFromEvent(e);
    });
    window.addEventListener(
      "mousemove",
      (e) => {
        if (!draggingSv) return;
        updateSvFromEvent(e);
      },
      true
    );
    window.addEventListener(
      "mouseup",
      () => {
        draggingSv = false;
      },
      true
    );

    function updateSvFromEvent(e) {
      const c = els.svCanvas;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const y = clamp(e.clientY - rect.top, 0, rect.height);
      hsv.s = x / (rect.width || 1);
      hsv.v = 1 - y / (rect.height || 1);
      const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
      if (els.r) els.r.value = String(Math.round(r));
      if (els.g) els.g.value = String(Math.round(g));
      if (els.b) els.b.value = String(Math.round(b));
      drawSv();
    }

    els.validateBtn?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      try {
        document.dispatchEvent(
          new CustomEvent("mani-color-capture-text-selection", { bubbles: true })
        );
      } catch {
        /* intentional: capture text selection event best-effort */
      }
    });
    els.validateBtn?.addEventListener("click", commit);
    els.closeBtn?.addEventListener("click", closeModal);
    modal?.querySelector("[data-mani-color-dismiss]")?.addEventListener("click", closeModal);
    modal?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    els.eyedropperBtn?.addEventListener("click", async () => {
      try {
        // @ts-ignore - API EyeDropper (Chromium)
        const ed = window.EyeDropper && new window.EyeDropper();
        if (!ed) return;
        const res = await ed.open();
        if (res?.sRGBHex) {
          const { r, g, b } = parseHex(res.sRGBHex);
          hsv = rgbToHsv(r, g, b);
          syncRgbFields();
        }
      } catch {
        /* intentional: EyeDropper cancel or unsupported API */
      }
    });

    const colorPanel = els.modal?.querySelector?.(".mani-color-modal-panel");
    if (colorPanel && typeof window.wireManiFloatingDrag === "function") {
      window.wireManiFloatingDrag(colorPanel, ".mani-color-modal-header", {
        ignoreSelector: "button,.mani-color-modal-close,[type=button]"
      });
    }
  }

  function initManiColorPickers() {
    wireModalOnce();
    document.querySelectorAll("[data-mani-color-for]").forEach((btn) => {
      const id = btn.getAttribute("data-mani-color-for");
      const inp = id ? $(id) : null;
      if (!inp) return;
      if (id === "propTextColor" || id === "ctxTextColor") {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          try {
            document.dispatchEvent(
              new CustomEvent("mani-color-capture-text-selection", {
                bubbles: true,
                detail: { inputId: id }
              })
            );
          } catch {
            /* intentional: capture selection before open best-effort */
          }
        });
      }
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openForInput(inp);
      });
      syncOneSwatchForInput(inp);
    });
  }

  function syncManiColorSwatches() {
    document.querySelectorAll("[data-mani-color-for]").forEach((btn) => {
      const id = btn.getAttribute("data-mani-color-for");
      const inp = id ? $(id) : null;
      if (inp) syncOneSwatchForInput(inp);
    });
  }

  window.initManiColorPickers = initManiColorPickers;
  window.syncManiColorSwatches = syncManiColorSwatches;
  window.openManiColorPicker = openForInput;
})();
