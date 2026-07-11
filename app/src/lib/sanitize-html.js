/**
 * Sanitization HTML annotations texte (S5) — DOMPurify + whitelist E-AUDIT-03.
 * Partagé renderer (window) et tests Node (module.exports).
 * IIFE navigateur : évite de polluer le scope global (collision avec `const { sanitizeTextHtml }` dans renderer.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.__editifySanitizeHtml = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function factory() {
  "use strict";

  const ALLOWED_TAGS = Object.freeze([
    "div",
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "span",
    "font"
  ]);

  const ALLOWED_ATTR = Object.freeze(["style", "color"]);

  const ALLOWED_STYLE_PROPS = Object.freeze([
    "color",
    "font-weight",
    "font-style",
    "text-decoration"
  ]);

  /** @type {import('dompurify').DOMPurify | null} */
  let purifyInstance = null;
  let hooksRegistered = false;

  /**
   * @param {string} prop
   * @param {string} value
   */
  function sanitizeInlineStyleDeclaration(prop, value) {
    const p = String(prop || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_STYLE_PROPS.includes(p)) return "";
    const v = String(value || "").trim();
    if (!v || /javascript:/i.test(v) || /expression\s*\(/i.test(v)) return "";

    if (p === "color") {
      if (/^#[0-9a-f]{3,8}$/i.test(v)) return `${p}: ${v.toLowerCase()}`;
      if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)$/i.test(v)) {
        return `${p}: ${v.replace(/\s+/g, " ")}`;
      }
      return "";
    }
    if (p === "font-weight" && /^(bold|[67]00|bolder)$/i.test(v)) {
      return `${p}: ${v.toLowerCase()}`;
    }
    if (p === "font-style" && /^italic$/i.test(v)) {
      return `${p}: ${v.toLowerCase()}`;
    }
    if (p === "text-decoration" && /underline/i.test(v)) {
      return `${p}: ${v.replace(/\s+/g, " ").trim()}`;
    }
    return "";
  }

  /**
   * @param {string} styleValue
   */
  function filterStyleAttribute(styleValue) {
    const parts = String(styleValue || "")
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    const kept = [];
    for (const part of parts) {
      const colon = part.indexOf(":");
      if (colon <= 0) continue;
      const decl = sanitizeInlineStyleDeclaration(part.slice(0, colon), part.slice(colon + 1));
      if (decl) kept.push(decl);
    }
    return kept.join("; ");
  }

  /**
   * @param {string} colorValue
   */
  function filterFontColorAttribute(colorValue) {
    const v = String(colorValue || "").trim();
    if (!v || /javascript:/i.test(v) || /data:/i.test(v)) return "";
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toLowerCase();
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)$/i.test(v)) {
      return v.replace(/\s+/g, " ");
    }
    return "";
  }

  function registerDomPurifyHooks(purify) {
    if (hooksRegistered || !purify?.addHook) return;
    hooksRegistered = true;

    purify.addHook("uponSanitizeElement", (node, data) => {
      if (data.tagName === "span" && node.getAttribute?.("class") === "mani-spell-miss") {
        const parent = node.parentNode;
        if (!parent) return;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
      }
    });

    purify.addHook("uponSanitizeAttribute", (node, data) => {
      if (data.attrName === "style") {
        data.attrValue = filterStyleAttribute(data.attrValue);
        if (!data.attrValue) {
          data.keepAttr = false;
        }
        return;
      }
      if (data.attrName === "color" && String(node.tagName || "").toLowerCase() === "font") {
        data.attrValue = filterFontColorAttribute(data.attrValue);
        if (!data.attrValue) {
          data.keepAttr = false;
        }
        return;
      }
      if (/^on/i.test(data.attrName) || data.attrName === "href" || data.attrName === "src") {
        data.keepAttr = false;
      }
    });
  }

  function createDomPurifyForNode() {
    const { JSDOM } = require("jsdom");
    const createDOMPurify = require("dompurify");
    return createDOMPurify(new JSDOM("").window);
  }

  function getDomPurify() {
    if (purifyInstance) return purifyInstance;
    if (typeof window !== "undefined" && window.DOMPurify) {
      purifyInstance = window.DOMPurify;
    } else if (typeof module !== "undefined" && module.exports) {
      purifyInstance = createDomPurifyForNode();
    } else {
      throw new Error("[sanitize-html] DOMPurify indisponible");
    }
    registerDomPurifyHooks(purifyInstance);
    return purifyInstance;
  }

  const DOMPURIFY_CONFIG = Object.freeze({
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "link",
      "svg",
      "math",
      "meta",
      "img",
      "a",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "video",
      "audio",
      "canvas",
      "base"
    ],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "href", "src", "xlink:href", "formaction"]
  });

  /**
   * Sanitize HTML riche des annotations texte (entrée utilisateur / paste / contentEditable).
   * @param {string} html
   * @returns {string}
   */
  function sanitizeAnnotationTextHtml(html) {
    const dirty = String(html ?? "");
    if (!dirty.trim()) return "";
    const purify = getDomPurify();
    return purify.sanitize(dirty, DOMPURIFY_CONFIG);
  }

  /** Alias historique — même implémentation unique (S5). */
  function sanitizeTextHtml(html) {
    return sanitizeAnnotationTextHtml(html);
  }

  /**
   * Assigne du HTML utilisateur sanitizé sur un élément (U6 — point d'injection centralisé).
   * @param {HTMLElement | null | undefined} element
   * @param {string} html
   */
  function setSanitizedHtml(element, html) {
    if (!element) return;
    element.innerHTML = sanitizeAnnotationTextHtml(html);
  }

  const sanitizeHtmlApi = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_STYLE_PROPS,
    sanitizeAnnotationTextHtml,
    sanitizeTextHtml,
    setSanitizedHtml,
    /** Exposé pour tests Node (réinitialisation hooks). */
    _resetForTests() {
      purifyInstance = null;
      hooksRegistered = false;
    }
  };

  return sanitizeHtmlApi;
});
