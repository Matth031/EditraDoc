const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeAnnotationTextHtml,
  sanitizeTextHtml,
  ALLOWED_TAGS,
  _resetForTests
} = require("../src/lib/sanitize-html.js");

beforeEach(() => {
  _resetForTests();
});

test("sanitizeAnnotationTextHtml : whitelist balises texte", () => {
  const input =
    "<div><p>Hello</p><br/><b>bold</b><strong>s</strong><i>i</i><em>e</em><u>u</u>" +
    '<span style="color:#ff0000;font-weight:bold">c</span><font color="#00ff00">f</font></div>';
  const out = sanitizeAnnotationTextHtml(input);
  for (const tag of ["div", "p", "br", "b", "strong", "i", "em", "u", "span", "font"]) {
    assert.match(out, new RegExp(`<${tag}\\b`, "i"), `balise ${tag} attendue`);
  }
  assert.doesNotMatch(out, /script|iframe|svg|meta|img|a\b/i);
});

test("sanitizeAnnotationTextHtml : span[style] limité aux propriétés autorisées", () => {
  const out = sanitizeAnnotationTextHtml(
    '<span style="color:#abc;font-weight:bold;font-style:italic;text-decoration:underline;' +
      'background:red;position:absolute">x</span>'
  );
  assert.match(out, /color:\s*#abc/i);
  assert.match(out, /font-weight:\s*bold/i);
  assert.match(out, /font-style:\s*italic/i);
  assert.match(out, /text-decoration:\s*underline/i);
  assert.doesNotMatch(out, /background|position/i);
});

test("sanitizeAnnotationTextHtml : font[color] conservé", () => {
  const out = sanitizeAnnotationTextHtml('<font color="#112233">ok</font>');
  assert.match(out, /color=["']#112233["']/i);
});

test("sanitizeAnnotationTextHtml : mani-spell-miss unwrap (strip)", () => {
  const out = sanitizeAnnotationTextHtml('before<span class="mani-spell-miss">miss</span>after');
  assert.equal(out, "beforemissafter");
  assert.doesNotMatch(out, /mani-spell-miss/i);
});

test("sanitizeAnnotationTextHtml : payloads XSS neutralisés", () => {
  const payloads = [
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)></svg>",
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    "<script>alert(1)</script>",
    '<div onclick="alert(1)">x</div>',
    '<span style="background:url(javascript:alert(1))">x</span>'
  ];
  for (const dirty of payloads) {
    const out = sanitizeAnnotationTextHtml(dirty);
    assert.doesNotMatch(out, /onerror|onload|onclick|javascript:|<\s*script/i, dirty);
    assert.doesNotMatch(out, /<\s*(img|svg|meta|iframe|script|a)\b/i, dirty);
  }
});

test("sanitizeAnnotationTextHtml : data: URI bloqués sur font[color]", () => {
  const out = sanitizeAnnotationTextHtml('<font color="data:text/html,x">x</font>');
  assert.doesNotMatch(out, /data:/i);
});

test("sanitizeTextHtml : alias identique", () => {
  const dirty = "<b>ok</b><script>x</script>";
  assert.equal(sanitizeTextHtml(dirty), sanitizeAnnotationTextHtml(dirty));
});

test("sanitizeAnnotationTextHtml : entrée vide", () => {
  assert.equal(sanitizeAnnotationTextHtml(""), "");
  assert.equal(sanitizeAnnotationTextHtml("   "), "");
});

test("ALLOWED_TAGS : correspond à la whitelist E-AUDIT-03", () => {
  assert.deepEqual(
    [...ALLOWED_TAGS].sort(),
    ["b", "br", "div", "em", "font", "i", "p", "span", "strong", "u"].sort()
  );
});

// --- Lot D : cas limites S5 (complétude) — ENV UMD / window.DOMPurify / throw non forcé ---

test("sanitizeAnnotationTextHtml : prop CSS vide / javascript: / expression(", () => {
  const out = sanitizeAnnotationTextHtml(
    '<span style="color: ;font-weight:bold;color:javascript:alert(1);' +
      'color:expression(alert(1));color:#abc">x</span>'
  );
  assert.match(out, /color:\s*#abc/i);
  assert.match(out, /font-weight:\s*bold/i);
  assert.doesNotMatch(out, /javascript:|expression\s*\(/i);
});

test("sanitizeAnnotationTextHtml : rgba() conservé ; fallback couleur invalide vide", () => {
  const rgba = sanitizeAnnotationTextHtml('<span style="color:rgba(1, 2, 3, 0.5)">x</span>');
  assert.match(rgba, /color:\s*rgba\(1, 2, 3, 0\.5\)/i);
  const bad = sanitizeAnnotationTextHtml('<span style="color:not-a-color">x</span>');
  assert.doesNotMatch(bad, /not-a-color/i);
  assert.doesNotMatch(bad, /style=/i);
});

test("sanitizeAnnotationTextHtml : colon <= 0 (déclaration style ignorée)", () => {
  const out = sanitizeAnnotationTextHtml('<span style="nocolon;:orphan;color:#fff">x</span>');
  assert.match(out, /color:\s*#fff/i);
  assert.doesNotMatch(out, /nocolon|:orphan/i);
});

test("sanitizeAnnotationTextHtml : font color vide / rgba / data bloqué", () => {
  const empty = sanitizeAnnotationTextHtml('<font color="">x</font>');
  assert.doesNotMatch(empty, /color=/i);
  const rgba = sanitizeAnnotationTextHtml('<font color="rgba(10,20,30,0.4)">x</font>');
  assert.match(rgba, /color=["']rgba\(10,\s*20,\s*30,\s*0\.4\)["']/i);
  const js = sanitizeAnnotationTextHtml('<font color="javascript:alert(1)">x</font>');
  assert.doesNotMatch(js, /javascript:/i);
});

test("sanitizeAnnotationTextHtml : html null/undefined → chaîne vide", () => {
  assert.equal(sanitizeAnnotationTextHtml(null), "");
  assert.equal(sanitizeAnnotationTextHtml(undefined), "");
});

test("setSanitizedHtml : élément null/undefined no-op ; DOM valide sanitizé", () => {
  const { setSanitizedHtml } = require("../src/lib/sanitize-html.js");
  assert.doesNotThrow(() => setSanitizedHtml(null, "<b>x</b>"));
  assert.doesNotThrow(() => setSanitizedHtml(undefined, "<script>x</script>"));
  const { JSDOM } = require("jsdom");
  const el = new JSDOM("<!doctype html><div id='t'></div>").window.document.getElementById("t");
  setSanitizedHtml(el, "<b>ok</b><script>evil</script>");
  assert.equal(el.innerHTML, "<b>ok</b>");
});

test("sanitizeAnnotationTextHtml : hook API absente (pas d'addHook) — sanitize sans crash", () => {
  _resetForTests();
  const prevWindow = globalThis.window;
  globalThis.window = {
    DOMPurify: {
      sanitize(html) {
        return String(html).replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
      }
    }
  };
  try {
    const out = sanitizeAnnotationTextHtml("<b>ok</b><script>x</script>");
    assert.equal(out, "<b>ok</b>");
  } finally {
    if (prevWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = prevWindow;
    }
    _resetForTests();
  }
});

test("sanitizeAnnotationTextHtml : DOM orphelin (span mani-spell-miss sans parent)", () => {
  _resetForTests();
  const prevWindow = globalThis.window;
  /** @type {((node: unknown, data: { tagName: string }) => void) | null} */
  let uponElement = null;
  const { JSDOM } = require("jsdom");
  const doc = new JSDOM("").window.document;
  globalThis.window = {
    DOMPurify: {
      addHook(name, fn) {
        if (name === "uponSanitizeElement") uponElement = fn;
      },
      sanitize(html) {
        const span = doc.createElement("span");
        span.setAttribute("class", "mani-spell-miss");
        span.textContent = "orphan";
        // Pas de parentNode → early-return defensive
        assert.equal(span.parentNode, null);
        if (uponElement) uponElement(span, { tagName: "span" });
        return String(html);
      }
    }
  };
  try {
    const out = sanitizeAnnotationTextHtml("<b>x</b>");
    assert.equal(out, "<b>x</b>");
    assert.ok(uponElement, "hook uponSanitizeElement enregistré");
  } finally {
    if (prevWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = prevWindow;
    }
    _resetForTests();
  }
});
