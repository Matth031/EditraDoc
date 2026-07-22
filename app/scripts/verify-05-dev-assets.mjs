/**
 * Vérifications statiques alignées sur docs/05-Dev.md (sans Electron).
 * - Ordre : i18n-data → … → pdf-viewer → i18n-apply → e2e-helpers → renderer.js
 * - Présence des dictionnaires i18n (fr, en, es, pt)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const indexPath = path.join(appRoot, "src", "renderer", "index.html");
const i18nDataPath = path.join(appRoot, "src", "renderer", "renderer-i18n-data.js");

function fail(msg) {
  console.error("[verify-05-dev-assets]", msg);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");
const srcs = [];
for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
  srcs.push(m[1]);
}
const rel = (s) => s.replace(/^\.\//, "");
const idxData = srcs.findIndex((s) => rel(s) === "renderer-i18n-data.js");
const idxTextHtml = srcs.findIndex((s) => rel(s) === "renderer-text-html.js");
const idxTextCtx = srcs.findIndex((s) => rel(s) === "renderer-text-ctx.js");
const idxTextLayout = srcs.findIndex((s) => rel(s) === "renderer-text-layout.js");
const idxAnnotationProps = srcs.findIndex((s) => rel(s) === "renderer-annotation-props.js");
const idxUtils = srcs.findIndex((s) => rel(s) === "renderer-utils.js");
const idxToast = srcs.findIndex((s) => rel(s) === "renderer-toast.js");
const idxTabs = srcs.findIndex((s) => rel(s) === "renderer-tabs.js");
const idxAnnotationHistory = srcs.findIndex((s) => rel(s) === "renderer-annotation-history.js");
const idxAnnotations = srcs.findIndex((s) => rel(s) === "renderer-annotations.js");
const idxKeymap = srcs.findIndex((s) => rel(s) === "renderer-keymap.js");
const idxGeometry = srcs.findIndex((s) => rel(s) === "renderer-geometry.js");
const idxSessionLogStore = srcs.findIndex((s) => rel(s) === "../lib/session-log-store.js");
const idxSessionLog = srcs.findIndex((s) => rel(s) === "renderer-session-log.js");
const idxSessionLogUi = srcs.findIndex((s) => rel(s) === "renderer-session-log-ui.js");
const idxSidebars = srcs.findIndex((s) => rel(s) === "renderer-sidebars.js");
const idxTextCtxMenu = srcs.findIndex((s) => rel(s) === "renderer-text-ctx-menu.js");
const idxShapeImageCtxMenu = srcs.findIndex((s) => rel(s) === "renderer-shape-image-ctx-menu.js");
const idxShapeVector = srcs.findIndex((s) => rel(s) === "renderer-shape-vector.js");
const idxSplitWorkspace = srcs.findIndex((s) => rel(s) === "renderer-split-workspace.js");
const idxJobs = srcs.findIndex((s) => rel(s) === "renderer-jobs.js");
const idxHtmlConvert = srcs.findIndex((s) => rel(s) === "renderer-html-convert.js");
const idxImageConvert = srcs.findIndex((s) => rel(s) === "renderer-image-convert.js");
const idxPageRotateMath = srcs.findIndex((s) => rel(s) === "../lib/page-rotate-math.js");
const idxPageRotate = srcs.findIndex((s) => rel(s) === "renderer-page-rotate.js");
const idxAppChrome = srcs.findIndex((s) => rel(s) === "renderer-app-chrome.js");
const idxTooltips = srcs.findIndex((s) => rel(s) === "renderer-tooltips.js");
const idxSession = srcs.findIndex((s) => rel(s) === "renderer-session.js");
const idxPdfViewer = srcs.findIndex((s) => rel(s) === "renderer-pdf-viewer.js");
const idxI18nApply = srcs.findIndex((s) => rel(s) === "renderer-i18n-apply.js");
const idxE2eHelpers = srcs.findIndex((s) => rel(s) === "renderer-e2e-helpers.js");
const idxRenderer = srcs.findIndex((s) => rel(s) === "renderer.js");
if (idxData === -1) fail("index.html : script renderer-i18n-data.js introuvable.");
if (idxTextHtml === -1) fail("index.html : script renderer-text-html.js introuvable.");
if (idxTextCtx === -1) fail("index.html : script renderer-text-ctx.js introuvable.");
if (idxTextLayout === -1) fail("index.html : script renderer-text-layout.js introuvable.");
if (idxAnnotationProps === -1)
  fail("index.html : script renderer-annotation-props.js introuvable.");
if (idxUtils === -1) fail("index.html : script renderer-utils.js introuvable.");
if (idxToast === -1) fail("index.html : script renderer-toast.js introuvable.");
if (idxTabs === -1) fail("index.html : script renderer-tabs.js introuvable.");
if (idxAnnotationHistory === -1)
  fail("index.html : script renderer-annotation-history.js introuvable.");
if (idxAnnotations === -1) fail("index.html : script renderer-annotations.js introuvable.");
if (idxKeymap === -1) fail("index.html : script renderer-keymap.js introuvable.");
if (idxGeometry === -1) fail("index.html : script renderer-geometry.js introuvable.");
if (idxSessionLogStore === -1) fail("index.html : script ../lib/session-log-store.js introuvable.");
if (idxSessionLog === -1) fail("index.html : script renderer-session-log.js introuvable.");
if (idxSessionLogUi === -1) fail("index.html : script renderer-session-log-ui.js introuvable.");
if (idxSidebars === -1) fail("index.html : script renderer-sidebars.js introuvable.");
if (idxTextCtxMenu === -1) fail("index.html : script renderer-text-ctx-menu.js introuvable.");
if (idxShapeImageCtxMenu === -1)
  fail("index.html : script renderer-shape-image-ctx-menu.js introuvable.");
if (idxShapeVector === -1) fail("index.html : script renderer-shape-vector.js introuvable.");
if (idxSplitWorkspace === -1) fail("index.html : script renderer-split-workspace.js introuvable.");
if (idxJobs === -1) fail("index.html : script renderer-jobs.js introuvable.");
if (idxHtmlConvert === -1) fail("index.html : script renderer-html-convert.js introuvable.");
if (idxImageConvert === -1) fail("index.html : script renderer-image-convert.js introuvable.");
if (idxPageRotateMath === -1) fail("index.html : script ../lib/page-rotate-math.js introuvable.");
if (idxPageRotate === -1) fail("index.html : script renderer-page-rotate.js introuvable.");
if (idxAppChrome === -1) fail("index.html : script renderer-app-chrome.js introuvable.");
if (idxTooltips === -1) fail("index.html : script renderer-tooltips.js introuvable.");
if (idxSession === -1) fail("index.html : script renderer-session.js introuvable.");
if (idxPdfViewer === -1) fail("index.html : script renderer-pdf-viewer.js introuvable.");
if (idxI18nApply === -1) fail("index.html : script renderer-i18n-apply.js introuvable.");
if (idxE2eHelpers === -1) fail("index.html : script renderer-e2e-helpers.js introuvable.");
if (idxRenderer === -1) fail("index.html : script renderer.js introuvable.");
if (
  idxData >= idxTextHtml ||
  idxTextHtml >= idxTextCtx ||
  idxTextCtx >= idxTextLayout ||
  idxTextLayout >= idxAnnotationProps ||
  idxAnnotationProps >= idxUtils ||
  idxUtils >= idxToast ||
  idxToast >= idxTabs ||
  idxTabs >= idxAnnotationHistory ||
  idxAnnotationHistory >= idxAnnotations ||
  idxAnnotations >= idxKeymap ||
  idxKeymap >= idxGeometry ||
  idxGeometry >= idxSessionLogStore ||
  idxSessionLogStore >= idxSessionLog ||
  idxSessionLog >= idxSessionLogUi ||
  idxSessionLogUi >= idxSidebars ||
  idxSidebars >= idxTextCtxMenu ||
  idxTextCtxMenu >= idxShapeImageCtxMenu ||
  idxShapeImageCtxMenu >= idxShapeVector ||
  idxShapeVector >= idxSplitWorkspace ||
  idxSplitWorkspace >= idxJobs ||
  idxJobs >= idxHtmlConvert ||
  idxHtmlConvert >= idxImageConvert ||
  idxImageConvert >= idxPageRotateMath ||
  idxPageRotateMath >= idxPageRotate ||
  idxPageRotate >= idxAppChrome ||
  idxAppChrome >= idxTooltips ||
  idxTooltips >= idxSession ||
  idxSession >= idxPdfViewer ||
  idxPdfViewer >= idxI18nApply ||
  idxI18nApply >= idxE2eHelpers ||
  idxE2eHelpers >= idxRenderer
) {
  fail(
    "index.html : ordre attendu … → text-ctx → utils → toast → sidebars → text-ctx-menu → shape-image-ctx-menu → split-workspace → jobs → app-chrome → tooltips → session → pdf-viewer → renderer.js."
  );
}

const i18nSrc = fs.readFileSync(i18nDataPath, "utf8");
if (!i18nSrc.includes("window.__EDITIFY_I18N")) {
  fail("renderer-i18n-data.js : assignation window.__EDITIFY_I18N attendue.");
}
for (const lang of ["fr:", "en:", "es:", "pt:"]) {
  if (!i18nSrc.includes(lang)) {
    fail(`renderer-i18n-data.js : bloc langue '${lang.slice(0, 2)}' attendu.`);
  }
}

console.log("[verify-05-dev-assets] OK - ordre scripts + dictionnaires i18n.");
