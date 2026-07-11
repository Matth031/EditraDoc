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
