/**
 * Renderer principal - EditraDoc (Electron, pas Node).
 *
 * Architecture:
 * - Un fichier par rôle historique: état UI (`state`), rendu PDF (pdf.js via bridge), calque d'annotations HTML,
 *   file d'attente de jobs PDF via IPC (`maniPdfApi` défini dans preload, pas d'accès fs direct).
 * - Le service Python écoute sur 127.0.0.1:8765; le processus principal relaie les jobs après validation des chemins.
 * - Annotations: rectangles logiques (x,y,w,h) + rotation CSS ; redimensionnement projeté dans le repère local.
 * - Texte enrichi: sanitization S5 (DOMPurify) à l'injection DOM, au sync modèle et au paste contentEditable.
 * - Split pages: état local + brouillon `localStorage` ; export uniquement via job `split_groups` validé côté main.
 *
 * Découpage i18n (bonnes pratiques):
 * - `renderer-i18n-data.js` : uniquement les dictionnaires (`window.__EDITIFY_I18N`). Chargé avant ce script (index.html).
 * - Ce fichier : `t` / `tr`, orchestration ; libellés DOM via `renderer-i18n-apply.js` (`i18nApply.applyLanguage()`).
 * - `renderer-text-html.js` : `sanitizeTextHtml`, plain text, surlignage orthographe (`window.__editifyTextHtml`).
 * - `renderer-text-ctx.js` : helpers format / sélection / remplacement (`window.__editifyTextCtxHelpers`).
 * - `renderer-utils.js` : logs, ids, clone presse-papiers (`window.__editifyUtils`).
 * - `renderer-toast.js` : toasts (`window.__editifyToast`).
 * - `renderer-session-log.js` : journal RAM session (`window.__editifySessionLog`).
 * - `renderer-session-log-ui.js` : modal journal + écouteurs (`window.__editifySessionLogUi`, `bind()` après `chrome.bind()`).
 * - `renderer-i18n-apply.js` : libellés / tooltips / aria (`window.__editifyI18nApply`, `bind()` après `sessionLogUi.bind()`).
 * - `renderer-e2e-helpers.js` : `window.__maniE2E` pour Playwright (`window.__editifyE2eHelpers.bind()` en fin de fichier).
 * - `renderer-sidebars.js` : colonnes miniatures + ajouts (`window.__editifySidebars` + `bind()` après définition des dépendances).
 * - `renderer-text-ctx-menu.js` : menu contextuel texte + orthographe (`window.__editifyTextCtxMenu` + `bind()` après `syncPropertyInputs`).
 * - `renderer-shape-image-ctx-menu.js` : menus forme + image (`window.__editifyShapeImageCtxMenu`, `sim.bind()` avant `tcm.bind()`).
 * - `renderer-split-workspace.js` : overlay Split par groupes (`window.__editifySplitWorkspace`, `sw.bind()` après `jobs.bind()` / `enqueuePdfJob`).
 * - `renderer-jobs.js` : file d'attente PDF, journal session + toasts (merge/split…) (`window.__editifyJobs`, `jobs.bind()` avant `sw.bind()`).
 * - `renderer-app-chrome.js` : barre d’outils HTML, menus, À propos, menu canvas vierge (`window.__editifyAppChrome`, `chrome.bind()` après `__editifyPdfSave.bind()`).
 * - `renderer-tooltips.js` : infobulles `[data-tooltip]` (`window.__editifyTooltips`, `tooltips.bind()` après `sw.bind()`).
 * - `renderer-session.js` : persistance session onglets/annotations (`window.__editifySession`, `session.bind()` après `__editifySidebars.bind()`).
 * - `renderer-pdf-viewer.js` : rendu PDF, zoom, calques page, DnD (`window.__editifyPdfViewer`, `bind()` après `__editifySidebars.bind()`, avant `session.bind()`).
 * - `renderer-pdf-save.js` : enregistrement / export PDF avec annotations (`window.__editifyPdfSave`, `bind()` après `__editifyPdfViewer.bind()`).
 */
if (!window.__editifyTextHtml) {
  throw new Error("[editify] Charger renderer-text-html.js avant renderer.js (voir index.html).");
}
if (!window.__editifyTextCtxHelpers) {
  throw new Error("[editify] Charger renderer-text-ctx.js après renderer-text-html.js (voir index.html).");
}
if (!window.__editifyUtils) {
  throw new Error("[editify] Charger renderer-utils.js avant renderer.js (voir index.html).");
}
if (!window.__editifyToast) {
  throw new Error("[editify] Charger renderer-toast.js avant renderer.js (voir index.html).");
}
if (!window.__editifySidebars) {
  throw new Error("[editify] Charger renderer-sidebars.js avant renderer.js (voir index.html).");
}
if (!window.__editifyTextCtxMenu) {
  throw new Error("[editify] Charger renderer-text-ctx-menu.js avant renderer.js (voir index.html).");
}
if (!window.__editifyShapeImageCtxMenu) {
  throw new Error("[editify] Charger renderer-shape-image-ctx-menu.js avant renderer.js (voir index.html).");
}
if (!window.__editifySplitWorkspace) {
  throw new Error("[editify] Charger renderer-split-workspace.js avant renderer.js (voir index.html).");
}
if (!window.__editifyJobs) {
  throw new Error("[editify] Charger renderer-jobs.js avant renderer.js (voir index.html).");
}
if (!window.__editifyAppChrome) {
  throw new Error("[editify] Charger renderer-app-chrome.js avant renderer.js (voir index.html).");
}
if (!window.__editifyTooltips) {
  throw new Error("[editify] Charger renderer-tooltips.js avant renderer.js (voir index.html).");
}
if (!window.__editifySession) {
  throw new Error("[editify] Charger renderer-session.js avant renderer.js (voir index.html).");
}
if (!window.__editifyPdfViewer) {
  throw new Error("[editify] Charger renderer-pdf-viewer.js avant renderer.js (voir index.html).");
}
if (!window.__editifyPdfSave) {
  throw new Error("[editify] Charger renderer-pdf-save.js avant renderer.js (voir index.html).");
}
if (!window.__editifySessionLog) {
  throw new Error("[editify] Charger renderer-session-log.js avant renderer.js (voir index.html).");
}
if (!window.__editifySessionLogUi) {
  throw new Error("[editify] Charger renderer-session-log-ui.js avant renderer.js (voir index.html).");
}
if (!window.__editifyLogFileSettingsUi) {
  throw new Error("[editify] Charger renderer-log-settings-ui.js avant renderer.js (voir index.html).");
}
if (!window.__editifyUpdateUi) {
  throw new Error("[editify] Charger renderer-update-ui.js avant renderer.js (voir index.html).");
}
if (!window.__editifyI18nApply) {
  throw new Error("[editify] Charger renderer-i18n-apply.js avant renderer.js (voir index.html).");
}
if (!window.__editifyE2eHelpers) {
  throw new Error("[editify] Charger renderer-e2e-helpers.js avant renderer.js (voir index.html).");
}
const pdfv = window.__editifyPdfViewer;
const pdfSave = window.__editifyPdfSave;
const sessionLog = window.__editifySessionLog;
const sessionLogUi = window.__editifySessionLogUi;
const logFileSettingsUi = window.__editifyLogFileSettingsUi;
const updateUi = window.__editifyUpdateUi;
const i18nApply = window.__editifyI18nApply;
const SHAPE_TYPE_KEYS = i18nApply.SHAPE_TYPE_KEYS;
const e2eHelpers = window.__editifyE2eHelpers;
const {
  sanitizeTextHtml,
  setSanitizedHtml,
  plainTextForAnnotationItem,
  applySpellHighlightsToTextDisplayNode
} = window.__editifyTextHtml;
const { logText, newAnnotationId, deepClone, cloneForClipboard, pathsEqual } = window.__editifyUtils;
const { ensureToastRoot, dismissToast, showToast } = window.__editifyToast;
const tcm = window.__editifyTextCtxMenu;
const sim = window.__editifyShapeImageCtxMenu;
const sw = window.__editifySplitWorkspace;
const jobs = window.__editifyJobs;
const htmlConvert = window.__editifyHtmlConvert;
const imageConvert = window.__editifyImageConvert;
const chrome = window.__editifyAppChrome;
const tooltips = window.__editifyTooltips;
const session = window.__editifySession;
/** Assignées après `bind()` en fin de fichier (dépendances `getActiveTab`, `renderAnnotations`, …). */
let scheduleSidebarUpdate;
let renderThumbnails;
let renderChanges;

const welcomeScreen = document.getElementById("welcomeScreen");
const addTextBtn = document.getElementById("addTextBtn");
const addShapeBtn = document.getElementById("addShapeBtn");
const addImageBtn = document.getElementById("addImageBtn");
const imageInput = document.getElementById("imageInput");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const propWidth = document.getElementById("propWidth");
const propHeight = document.getElementById("propHeight");
const propRotation = document.getElementById("propRotation");
const propOpacity = document.getElementById("propOpacity");
const propTextColor = document.getElementById("propTextColor");
const propBgColor = document.getElementById("propBgColor");
const validateTextColorBtn = document.getElementById("validateTextColorBtn");
const propPadding = document.getElementById("propPadding");
const propFontFamily = document.getElementById("propFontFamily");
const propFontSize = document.getElementById("propFontSize");
const applyPropsBtn = document.getElementById("applyPropsBtn");
const applyBgBtn = document.getElementById("applyBgBtn");
const mergeBtn = document.getElementById("mergeBtn");
const splitBtn = document.getElementById("splitBtn");
const splitWorkspaceOverlay = document.getElementById("splitWorkspaceOverlay");
const splitWorkspaceCloseBtn = document.getElementById("splitWorkspaceCloseBtn");
const splitWorkspaceGroups = document.getElementById("splitWorkspaceGroups");
const splitWorkspaceAddGroupBtn = document.getElementById("splitWorkspaceAddGroupBtn");
const splitWorkspaceValidateBtn = document.getElementById("splitWorkspaceValidateBtn");
const toolbarAboutBtn = document.getElementById("toolbarAboutBtn");
const aboutPopover = document.getElementById("aboutPopover");
const aboutCloseBtn = document.getElementById("aboutCloseBtn");
const aboutTitleEl = document.getElementById("aboutTitle");
const aboutCreditsEl = document.getElementById("aboutCredits");
const aboutVersion = document.getElementById("aboutVersion");
const blankCanvasCtxMenu = document.getElementById("blankCanvasCtxMenu");
const blankAddTextBtn = document.getElementById("blankAddTextBtn");
const blankAddShapeBtn = document.getElementById("blankAddShapeBtn");
const blankAddImageBtn = document.getElementById("blankAddImageBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomInfo = document.getElementById("zoomInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const statusBar = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const tabs = document.getElementById("tabs");
const viewer = document.querySelector(".viewer");
const pagesContainer = document.getElementById("pagesContainer");
const thumbsList = document.getElementById("thumbsList");
const changesList = document.getElementById("changesList");
const changesCount = document.getElementById("changesCount");
const textPropsPanel = document.getElementById("textPropsPanel");
const propTextColorLabel = document.getElementById("propTextColorLabel");
const propBgColorLabel = document.getElementById("propBgColorLabel");
const pdfLayerRef = {
  annotationLayer: null,
  dropOverlay: null,
  pdfCanvas: null
};

const toolTip = document.getElementById("toolTip");
const shapeModal = document.getElementById("shapeModal");
const shapeGrid = document.getElementById("shapeGrid");
const closeShapeModalBtn = document.getElementById("closeShapeModalBtn");
// Langue : menu natif Options > Langue + barre d'outils custom.
const pdfToolsBtn = document.getElementById("pdfToolsBtn");
const pdfToolsMenu = document.getElementById("pdfToolsMenu");
const toolbarFileBtn = document.getElementById("toolbarFileBtn");
const toolbarFileMenu = document.getElementById("toolbarFileMenu");
const toolbarOptionsBtn = document.getElementById("toolbarOptionsBtn");
const toolbarOptionsMenu = document.getElementById("toolbarOptionsMenu");
const toolbarAboutMenuItem = document.getElementById("toolbarAboutMenuItem");
const toolbarSessionLogMenuItem = document.getElementById("toolbarSessionLogMenuItem");
const toolbarLogFileMenuItem = document.getElementById("toolbarLogFileMenuItem");
const menuUpdatesLabel = document.getElementById("menuUpdatesLabel");
const toolbarCheckUpdatesMenuItem = document.getElementById("toolbarCheckUpdatesMenuItem");
const toolbarCheckUpdatesStartupBtn = document.getElementById("toolbarCheckUpdatesStartupBtn");
const updateAvailableBanner = document.getElementById("updateAvailableBanner");
const updateBannerText = document.getElementById("updateBannerText");
const updateBannerDownloadBtn = document.getElementById("updateBannerDownloadBtn");
const updateBannerDismissBtn = document.getElementById("updateBannerDismissBtn");
const sessionLogModal = document.getElementById("sessionLogModal");
const sessionLogBody = document.getElementById("sessionLogBody");
const sessionLogCloseBtn = document.getElementById("sessionLogCloseBtn");
const sessionLogTitleEl = document.getElementById("sessionLogTitleEl");
const sessionLogHint = document.getElementById("sessionLogHint");
const logFileSettingsModal = document.getElementById("logFileSettingsModal");
const logFileSettingsTitleEl = document.getElementById("logFileSettingsTitleEl");
const logFileSettingsHint = document.getElementById("logFileSettingsHint");
const logFilePathDisplay = document.getElementById("logFilePathDisplay");
const logFileDefaultPathDisplay = document.getElementById("logFileDefaultPathDisplay");
const logFileEnvOverride = document.getElementById("logFileEnvOverride");
const logFileBrowseBtn = document.getElementById("logFileBrowseBtn");
const logFileResetBtn = document.getElementById("logFileResetBtn");
const logFileCloseBtn = document.getElementById("logFileCloseBtn");
const logFileCurrentPathLabel = document.getElementById("logFileCurrentPathLabel");
const logFileDefaultPathLabel = document.getElementById("logFileDefaultPathLabel");
const welcomeOpenPdfBtn = document.getElementById("welcomeOpenPdfBtn");
const toolbarOpenPdfBtn = document.getElementById("toolbarOpenPdfBtn");
const toolbarSaveAsBtn = document.getElementById("toolbarSaveAsBtn");
const toolbarHtmlToPdfBtn = document.getElementById("toolbarHtmlToPdfBtn");
const toolbarImagesToPdfBtn = document.getElementById("toolbarImagesToPdfBtn");
const toolbarQuitBtn = document.getElementById("toolbarQuitBtn");
const menuLangLabel = document.getElementById("menuLangLabel");
const menuToolsLabel = document.getElementById("menuToolsLabel");
const menuInfoLabel = document.getElementById("menuInfoLabel");
const thumbsBar = document.getElementById("thumbsBar");
const changesBar = document.getElementById("changesBar");
const thumbsTitle = document.getElementById("thumbsTitle");
const changesTitle = document.getElementById("changesTitle");
const aboutRgpd = document.getElementById("aboutRgpd");
const toolbarCloseBtn = document.getElementById("toolbarCloseBtn");
const appToolbar = document.getElementById("appToolbar");
const toolbarF10Hint = document.getElementById("toolbarF10Hint");
const shapePropsPanel = document.getElementById("shapePropsPanel");
const propShapeFill = document.getElementById("propShapeFill");
const propShapeFillOpacity = document.getElementById("propShapeFillOpacity");
const propShapeStroke = document.getElementById("propShapeStroke");
const propShapeStrokeOpacity = document.getElementById("propShapeStrokeOpacity");
const propShapeStrokeWidth = document.getElementById("propShapeStrokeWidth");
const propShapeBackdrop = document.getElementById("propShapeBackdrop");
const propShapeBackdropOpacity = document.getElementById("propShapeBackdropOpacity");
const validateShapeFillBtn = document.getElementById("validateShapeFillBtn");
const validateShapeStrokeBtn = document.getElementById("validateShapeStrokeBtn");
const validateShapeBackdropBtn = document.getElementById("validateShapeBackdropBtn");

const state = {
  tabs: [],
  activeTabId: null,
  selectedAnnotationId: null,
  editingAnnotationId: null,
  zoomScale: 1,
  language: "fr",
  // E7: tracking simple du "risque de perte" (modifs non sauvegardées).
  isDirty: false,
  // Clipboard annotations (Ctrl+C / Ctrl+X / Ctrl+V)
  clipboard: null,
  lastPointer: null // { page, x, y }
};

function loadPreferredLanguage() {
  try {
    const raw = localStorage.getItem("editify:lang");
    const next = String(raw || "").toLowerCase();
    if (I18N[next]) state.language = next;
  } catch {
    /* ignore */
  }
}
let interactionMode = null; // "drag" | "resize" | null
let suppressClickUntil = 0;
let activePointerCleanup = null;
let pendingSingleClickRenderTimer = null;
let lastTextClickAt = 0;
let lastTextClickId = null;
let lastTextMouseDownAt = 0;
let lastTextMouseDownId = null;
let measureTextNode = null;

/** Style par défaut des prochaines zones texte (dernière fenêtre texte affichée / modifiée). */
const DEFAULT_TEXT_STYLE = Object.freeze({
  textColor: "#111111",
  bgColor: null,
  padding: 6,
  fontFamily: "Arial",
  fontSize: 14
});
let lastTextStyle = { ...DEFAULT_TEXT_STYLE };

function captureLastTextStyleFromItem(item) {
  if (!item || item.type !== "text") return;
  lastTextStyle = {
    textColor: item.textColor || DEFAULT_TEXT_STYLE.textColor,
    bgColor: item.bgColor ?? null,
    padding: Math.max(0, Math.min(64, Number(item.padding) || DEFAULT_TEXT_STYLE.padding)),
    fontFamily: item.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: Math.max(8, Math.min(96, Number(item.fontSize) || DEFAULT_TEXT_STYLE.fontSize))
  };
}

function getNewTextAnnotationDefaults() {
  return { ...lastTextStyle };
}

function focusTextAnnotationEditor(annotationId) {
  requestAnimationFrame(() => {
    const editNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${annotationId}"]`);
    const ed = getAnnotationTextEditor(editNode);
    if (ed) ed.focus();
    else editNode?.focus?.();
  });
}

// Sidebars : `scheduleSidebarUpdate` / `renderThumbnails` / `renderChanges` - `renderer-sidebars.js` + `bind()` fin de fichier.

function annotationTypeLabel(a) {
  if (!a) return t("annElem");
  if (a.type === "text") return t("annTextWin");
  if (a.type === "image") return t("annImage");
  const k = SHAPE_TYPE_KEYS[a.type];
  return k ? t(k) : String(a.type);
}

function annotationSummary(a) {
  if (!a) return "";
  if (a.type === "text") {
    const raw = String(plainTextForAnnotationItem(a) || "").trim();
    if (!raw) return t("emptyTextPreview");
    const parts = raw.split(/\s+/).filter(Boolean);
    const words = parts.slice(0, 3);
    return words.join(" ") + (parts.length > 3 ? "…" : "");
  }
  if (a.type === "image") {
    const name = a.fileName || a.name || null;
    return name ? tr("imageNamed", { name }) : t("imageAdded");
  }
  return tr("shapeSummaryPrefix", { label: annotationTypeLabel(a) });
}

// ---------------------------------------
// E7: Undo fermeture onglet (in-memory)
// ---------------------------------------
let pendingTabUndo = null; // { tab, index, wasActive, prevActiveTabId, toastId }

function hasUnsavedRiskForTab(tab) {
  if (!tab) return false;
  if (state.editingAnnotationId) return true;
  return Boolean(tab.dirty);
}

function cancelPointerInteraction() {
  try {
    if (activePointerCleanup) activePointerCleanup();
  } catch {}
  activePointerCleanup = null;
  interactionMode = null;
}

/** Persiste le texte en cours si l’utilisateur ouvre le menu sur une autre annotation. */
function commitActiveTextEditIfNeeded(targetAnnotationId) {
  const tab = getActiveTab();
  if (!tab || !state.editingAnnotationId) return;
  if (state.editingAnnotationId === targetAnnotationId) return;
  const id = state.editingAnnotationId;
  const editingNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${id}"]`);
  const item = findAnnotationLocation(tab, id)?.item;
  const ed = editingNode ? getAnnotationTextEditor(editingNode) : null;
  if (item && item.type === "text" && ed) {
    try {
      captureSnapshot(tab);
      syncTextFromEditor(item, ed);
      finalizeTextAnnotationLayout(item);
    } catch {}
    session.scheduleAutoSave();
  }
  state.editingAnnotationId = null;
}

function getSelectedAnnotationFromActivePage(tab) {
  if (!tab || !state.selectedAnnotationId) return null;
  return currentPageAnnotations(tab).find((a) => a.id === state.selectedAnnotationId) || null;
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

function getSelectedAnnotationFromTab(tab) {
  const id = state.selectedAnnotationId;
  if (!tab || !id) return null;
  return findAnnotationLocation(tab, id)?.item || null;
}

function capturePointerInPage(event) {
  try {
    let pageNode = event?.target?.closest?.(".pdf-page");
    if (!pageNode) {
      // Fallback: clic sur un "vide" du viewer => on se base sur la page active.
      pageNode = pagesContainer?.querySelector?.(".pdf-page.active") || null;
      if (!pageNode) return;
    }
    const page = Number(pageNode.dataset.page) || 1;
    const canvas = pageNode.querySelector?.("canvas.pdf-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX ?? 0) - rect.left, 0, Math.max(0, rect.width));
    const y = clamp((event.clientY ?? 0) - rect.top, 0, Math.max(0, rect.height));
    // Stocker en "coordonnées canvas" (px) : cohérent avec annotations.
    // rect.{width,height} sont en CSS px, mais le canvas est en px réels. On scale.
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    state.lastPointer = { page, x: x * sx, y: y * sy };
  } catch {}
}

document.addEventListener(
  "mousedown",
  (e) => {
    if (e.button !== 0) return;
    if (!e.target?.closest?.(".viewer")) return;
    capturePointerInPage(e);
  },
  true
);

// Capture "position curseur" même sans clic, tant que la souris survole le viewer.
// Objectif: insertion des nouveaux éléments au plus proche du curseur (WYSIWYG).
let lastPointerMoveAt = 0;
document.addEventListener(
  "mousemove",
  (e) => {
    try {
      if (interactionMode) return;
      if (!e.target?.closest?.(".viewer")) return;
      const now = Date.now();
      if (now - lastPointerMoveAt < 40) return; // throttle ~25Hz
      lastPointerMoveAt = now;
      capturePointerInPage(e);
    } catch {}
  },
  true
);

// ---------------------------
// Context menu (sidebar "Ajouts")
// ---------------------------
let changesContextMenu = null;
function ensureChangesContextMenu() {
  if (changesContextMenu) return changesContextMenu;
  const node = document.createElement("div");
  node.id = "changesContextMenu";
  node.className = "menu hidden";
  node.setAttribute("role", "menu");
  const del = document.createElement("button");
  del.type = "button";
  del.id = "changesCtxDeleteBtn";
  del.setAttribute("role", "menuitem");
  del.textContent = t("del");
  del.onclick = () => {
    try {
      hideChangesContextMenu();
      deleteSelected();
    } catch {}
  };
  node.appendChild(del);
  document.body.appendChild(node);
  changesContextMenu = node;
  return node;
}

function hideChangesContextMenu() {
  try {
    changesContextMenu?.classList?.add?.("hidden");
  } catch {}
}

// Menu contextuel (fenêtre texte) : renderer-text-ctx-menu.js - `tcm`, `tcm.bind()` après `syncPropertyInputs`.

// Menus contextuels forme + image : `renderer-shape-image-ctx-menu.js` - `sim`, `sim.bind()` avant `tcm.bind()`.

function ensureMeasureTextNode() {
  if (measureTextNode) return measureTextNode;
  const node = document.createElement("div");
  node.style.position = "fixed";
  node.style.left = "-10000px";
  node.style.top = "-10000px";
  node.style.visibility = "hidden";
  node.style.whiteSpace = "pre-wrap";
  node.style.wordBreak = "break-word";
  node.style.overflowWrap = "break-word";
  node.style.pointerEvents = "none";
  node.style.margin = "0";
  node.style.border = "0";
  node.style.boxSizing = "border-box";
  document.body.appendChild(node);
  measureTextNode = node;
  return node;
}

function applyMeasureTextNodeStyles(m, item, opts = {}) {
  const { width = 20, whiteSpace = "pre-wrap" } = opts;
  const padding = item.padding ?? 6;
  const fontSize = item.fontSize ?? 14;
  m.style.padding = `${padding}px`;
  m.style.fontFamily = item.fontFamily || "Arial";
  m.style.fontSize = `${fontSize}px`;
  m.style.lineHeight = "1.35";
  m.style.whiteSpace = whiteSpace;
  const noSoftWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
  m.style.wordBreak = noSoftWrap ? "normal" : "break-word";
  m.style.overflowWrap = noSoftWrap ? "normal" : "break-word";
  if (width === "auto") {
    m.style.width = "auto";
  } else {
    m.style.width = `${Math.max(20, Math.floor(width))}px`;
  }
}

/** Largeur initiale d'une zone texte : environ deux lettres (référence « Mm »). */
function getDefaultTextBoxWidth(item) {
  if (!item || item.type !== "text") return 20;
  const m = ensureMeasureTextNode();
  applyMeasureTextNodeStyles(m, item, { width: "auto", whiteSpace: "nowrap" });
  m.textContent = "Mm";
  return Math.max(20, Math.ceil(m.scrollWidth || 0));
}

function measureLineWidthNoWrap(item, lineText) {
  const m = ensureMeasureTextNode();
  applyMeasureTextNodeStyles(m, item, { width: "auto", whiteSpace: "nowrap" });
  m.textContent = lineText === "" ? "\u00a0" : lineText;
  return Math.ceil(m.scrollWidth || 0);
}

/**
 * Largeur d'un espace virtuel en fin de ligne pendant l'édition (non persisté dans le texte).
 * Proportionnel à la police courante de la fenêtre texte.
 */
function getVirtualTextTailWidth(item) {
  if (!item || item.type !== "text") return 0;
  const spaceW = measureLineWidthNoWrap(item, " ");
  const fontSize = Math.max(8, Math.min(96, Number(item.fontSize) || 14));
  return Math.max(1, spaceW || Math.ceil(fontSize * 0.28));
}

/** Réserve visuellement un « blanc » final pendant la saisie (padding, pas de caractère). */
function applyTextEditorVirtualTail(ed, item) {
  if (!ed || !item || item.type !== "text") return;
  const tail = getVirtualTextTailWidth(item);
  ed.style.paddingRight = tail > 0 ? `${tail}px` : "";
  ed.dataset.virtualTailPx = String(tail);
}

function clearTextEditorVirtualTail(ed) {
  if (!ed) return;
  ed.style.paddingRight = "";
  delete ed.dataset.virtualTailPx;
}

/** Largeur nécessaire pour afficher le texte sur une seule ligne (par ligne la plus longue). */
function getRequiredTextWidth(item) {
  if (!item || item.type !== "text") return 20;
  const defaultW = getDefaultTextBoxWidth(item);
  const text = plainTextForAnnotationItem(item);
  if (!text) return defaultW;
  const lines = text.split(/\r?\n/);
  let maxW = defaultW;
  for (const line of lines) {
    maxW = Math.max(maxW, measureLineWidthNoWrap(item, line));
  }
  return maxW;
}

/**
 * Largeur requise du contenu texte (sans le blanc virtuel final de saisie).
 */
function getTextContentRequiredWidth(item, ed) {
  const minW = getDefaultTextBoxWidth(item);
  const fromText = getRequiredTextWidth(item);
  if (!ed) return fromText;
  const pad = Math.max(0, Number(item.padding) || 6) * 2;
  const tail = getVirtualTextTailWidth(item);
  const scrollW = Math.ceil(ed.scrollWidth || 0);
  const contentScrollW = Math.max(0, scrollW - tail);
  const fromEditor = Math.max(minW, contentScrollW + pad);
  return Math.max(fromText, fromEditor);
}

/**
 * Largeur requise en édition : contenu + blanc virtuel final (non persisté).
 */
function getLiveRequiredTextWidth(item, ed) {
  if (!ed) return getRequiredTextWidth(item);
  return getTextContentRequiredWidth(item, ed) + getVirtualTextTailWidth(item);
}

function getInitialTextAnnotationSize(textStyle = {}) {
  const item = { type: "text", ...DEFAULT_TEXT_STYLE, ...textStyle };
  const w = getDefaultTextBoxWidth(item);
  const h = getRequiredTextHeightForWidth(item, w);
  return { w, h };
}

function getRequiredTextHeight(item) {
  if (!item || item.type !== "text") return 20;
  const padding = item.padding ?? 6;
  const fontSize = item.fontSize ?? 14;
  // Hauteur minimale d'une ligne, même si texte vide
  const minLine = Math.ceil(fontSize * 1.45 + 2 * padding);
  const text = plainTextForAnnotationItem(item);
  if (!text) return Math.max(20, minLine);

  const m = ensureMeasureTextNode();
  // Largeur du cadre = limites gauche/droite imposées par l'utilisateur
  const w = Math.max(20, Math.floor(item.w || 20));
  applyMeasureTextNodeStyles(m, item, { width: w, whiteSpace: "pre-wrap" });
  m.textContent = text;
  const needed = Math.ceil(m.scrollHeight || 0);
  return Math.max(20, minLine, needed);
}

function getRequiredTextHeightForWidth(item, width, layoutWhiteSpace = "pre-wrap") {
  if (!item || item.type !== "text") return 20;
  const padding = item.padding ?? 6;
  const fontSize = item.fontSize ?? 14;
  const minLine = Math.ceil(fontSize * 1.45 + 2 * padding);
  const text = plainTextForAnnotationItem(item);
  if (!text) return Math.max(20, minLine);

  const m = ensureMeasureTextNode();
  const w = Math.max(20, Math.floor(width || 20));
  const whiteSpace =
    layoutWhiteSpace === "pre" || layoutWhiteSpace === "nowrap" ? "pre" : "pre-wrap";
  applyMeasureTextNodeStyles(m, item, { width: w, whiteSpace });
  m.textContent = text;
  const needed = Math.ceil(m.scrollHeight || 0);
  return Math.max(20, minLine, needed);
}

function getMinWidthToFitHeight(item, height, maxWidth) {
  // Retourne la largeur minimale telle que le texte tienne dans "height".
  // Si impossible (même à maxWidth), retourne maxWidth.
  const h = Math.max(20, Math.floor(height || 20));
  const maxW = Math.max(20, Math.floor(maxWidth || item?.w || 20));
  let lo = 20;
  let hi = maxW;

  const fitsAtMax = getRequiredTextHeightForWidth(item, maxW) <= h + 1;
  if (!fitsAtMax) return maxW;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const need = getRequiredTextHeightForWidth(item, mid);
    if (need <= h + 1) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function getTextWrapState(item, zone, ed = null) {
  if (item?.textWrapManual) return "manual";
  const maxW = Math.max(20, zone.width - (item?.x || 0));
  const requiredW = ed ? getTextContentRequiredWidth(item, ed) : getRequiredTextWidth(item);
  if (requiredW > maxW) return "edge";
  return "auto";
}

function finalizeTextAnnotationLayout(item, zoneOpt) {
  if (!item || item.type !== "text") return;
  const zone = zoneOpt?.width > 0 && zoneOpt?.height > 0 ? zoneOpt : getSafeZoneSize();
  const maxW = Math.max(20, zone.width - (item.x || 0));
  const maxH = Math.max(20, zone.height - (item.y || 0));
  const minW = getDefaultTextBoxWidth(item);
  if (item.textWrapManual) {
    item.w = Math.max(minW, Math.floor(item.w || minW));
    item.h = clamp(getRequiredTextHeightForWidth(item, item.w, "pre-wrap"), 20, maxH);
    return;
  }
  const rawRequiredW = getRequiredTextWidth(item);
  if (rawRequiredW > maxW) {
    item.w = maxW;
    item.h = clamp(getRequiredTextHeightForWidth(item, maxW, "pre-wrap"), 20, maxH);
  } else {
    item.w = Math.max(minW, rawRequiredW);
    item.h = clamp(getRequiredTextHeightForWidth(item, item.w, "pre"), 20, maxH);
  }
}

/** Ajuste largeur/hauteur des textes avant export (métriques ReportLab ≠ écran). */
function annotationHasExplicitLineBreaks(item) {
  if (!item || item.type !== "text") return false;
  const plain = plainTextForAnnotationItem(item).replace(/\r\n/g, "\n");
  if (/\n/.test(plain)) return true;
  const html = String(item.textHtml || "");
  if (/<\s*br\b/i.test(html)) return true;
  try {
    const div = document.createElement("div");
    setSanitizedHtml(div, html);
    if (div.querySelectorAll("div, p, li").length > 1) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function ensureTextAnnotationsSizedForExport(tab, canvases) {
  if (!tab?.annotationsByPage) return;
  for (const pageKey of Object.keys(tab.annotationsByPage)) {
    const zone = getSafeZoneSizeForPage(tab, pageKey, canvases);
    if (!zone.width || !zone.height) {
      window.__editifyPdfSave?.logExportAudit?.("text_size_skip_page", {
        pageKey,
        reason: "no_zone",
        zone
      });
      continue;
    }
    for (const item of tab.annotationsByPage[pageKey] || []) {
      if (item?.type !== "text") continue;
      const before = {
        id: item.id,
        x: Math.round(item.x || 0),
        y: Math.round(item.y || 0),
        w: Math.round(item.w || 0),
        h: Math.round(item.h || 0),
        textLen: String(item.text || "").length
      };
      if (item.textWrapManual || annotationHasExplicitLineBreaks(item)) {
        const w = Math.max(20, Math.floor(item.w || 20));
        item.h = Math.max(
          item.h || 20,
          getRequiredTextHeightForWidth(item, w, "pre-wrap")
        );
        fitAnnotationToSafeZone(item, zone);
        window.__editifyPdfSave?.logExportAudit?.("text_size_manual", {
          pageKey,
          zone,
          before,
          after: {
            x: Math.round(item.x || 0),
            y: Math.round(item.y || 0),
            w: Math.round(item.w || 0),
            h: Math.round(item.h || 0)
          }
        });
        continue;
      }
      finalizeTextAnnotationLayout(item, zone);
      const w = Math.max(20, Math.floor(item.w || 20));
      item.h = Math.max(
        item.h || 20,
        getRequiredTextHeightForWidth(item, w, "pre-wrap")
      );
      fitAnnotationToSafeZone(item, zone);
      window.__editifyPdfSave?.logExportAudit?.("text_size_auto", {
        pageKey,
        zone,
        before,
        after: {
          x: Math.round(item.x || 0),
          y: Math.round(item.y || 0),
          w: Math.round(item.w || 0),
          h: Math.round(item.h || 0)
        }
      });
    }
  }
}

function leaveTextEditModeToSizing(tab, item, ed, options = {}) {
  if (!tab || !item || item.type !== "text") return;
  const { captureUndo = true } = options;
  if (ed) syncTextFromEditor(item, ed);
  if (captureUndo) captureSnapshot(tab);
  finalizeTextAnnotationLayout(item);
  state.editingAnnotationId = null;
  state.selectedAnnotationId = item.id;
  session.scheduleAutoSave();
  renderAnnotations();
}

function getAnnotationKeyboardMinSize(item) {
  if (item?.type === "text") return { minW: 20, minH: 20 };
  if (item?.type === "image" || SHAPE_TYPES.has(item?.type)) return { minW: 1, minH: 1 };
  return { minW: 20, minH: 20 };
}

function moveSelectedAnnotationByArrow(item, key, step, zone) {
  const dx =
    key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
  const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
  const w = Math.max(getAnnotationKeyboardMinSize(item).minW, item.w || 20);
  const h = Math.max(getAnnotationKeyboardMinSize(item).minH, item.h || 20);
  item.x = clamp((item.x || 0) + dx, 0, Math.max(0, zone.width - w));
  item.y = clamp((item.y || 0) + dy, 0, Math.max(0, zone.height - h));
}

function growSelectedAnnotationByArrow(item, key, step, zone) {
  const { minW, minH } = getAnnotationKeyboardMinSize(item);
  let x = item.x || 0;
  let y = item.y || 0;
  let w = Math.max(minW, item.w || minW);
  let h = Math.max(minH, item.h || minH);

  if (key === "ArrowRight") w += step;
  else if (key === "ArrowLeft") {
    x -= step;
    w += step;
  } else if (key === "ArrowDown") h += step;
  else if (key === "ArrowUp") {
    y -= step;
    h += step;
  }

  if (w < minW) {
    if (key === "ArrowLeft") x -= minW - w;
    w = minW;
  }
  if (h < minH) {
    if (key === "ArrowUp") y -= minH - h;
    h = minH;
  }

  x = clamp(x, 0, Math.max(0, zone.width - w));
  y = clamp(y, 0, Math.max(0, zone.height - h));
  w = clamp(w, minW, Math.max(minW, zone.width - x));
  h = clamp(h, minH, Math.max(minH, zone.height - y));

  item.x = x;
  item.y = y;
  item.w = w;
  item.h = h;

  if (item.type === "text") {
    item.textWrapManual = true;
    finalizeTextAnnotationLayout(item);
  }
}

function tryHandleSelectedAnnotationArrowKey(event) {
  const key = event.key;
  if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") {
    return false;
  }
  if (state.editingAnnotationId) return false;
  const tab = getActiveTab();
  const item = getSelectedAnnotationFromActivePage(tab);
  if (!tab || !item) return false;
  if (item.type !== "text" && item.type !== "image" && !SHAPE_TYPES.has(item.type)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const step = event.repeat ? (event.shiftKey ? 5 : 10) : 1;
  const zone = getSafeZoneSize();
  captureSnapshot(tab);
  if (event.shiftKey) growSelectedAnnotationByArrow(item, key, step, zone);
  else moveSelectedAnnotationByArrow(item, key, step, zone);
  syncPropertyInputs();
  renderAnnotations();
  session.scheduleAutoSave();
  return true;
}

function applyTextEditorLayoutStyles(ed, wrapState) {
  if (!ed) return;
  ed.classList.toggle("wrap-lines", wrapState === "manual" || wrapState === "edge");
  if (wrapState === "auto") {
    ed.style.whiteSpace = "pre";
    ed.style.wordBreak = "normal";
    ed.style.overflowWrap = "normal";
  } else {
    ed.style.whiteSpace = "pre-wrap";
    ed.style.wordBreak = "break-word";
    ed.style.overflowWrap = "break-word";
  }
}

function applyEditingTextAutoGrow(tab, item, node) {
  const zone = getSafeZoneSize();
  const maxW = Math.max(20, zone.width - (item?.x || 0));
  const maxH = Math.max(20, zone.height - (item.y || 0));
  const ed = getAnnotationTextEditor(node);
  const helpers = window.__editifyTextCtxHelpers;
  /** @type {Range | null} */
  let savedRange = null;
  /** @type {{ start: number, end: number, collapsed: boolean } | null} */
  let caret = null;
  if (ed) {
    if (helpers?.saveEditorSelectionRange) {
      savedRange = helpers.saveEditorSelectionRange(ed);
    }
    if (helpers?.getPlainSelectionOffsetsInEditor) {
      const o = helpers.getPlainSelectionOffsetsInEditor(ed);
      caret = { start: o.start, end: o.end, collapsed: o.collapsed };
    }
    applyTextEditorVirtualTail(ed, item);
  }
  const wrapState = getTextWrapState(item, zone, ed);
  const minW = getDefaultTextBoxWidth(item);
  let nextW = item.w || minW;
  let nextH = item.h || 20;

  if (wrapState === "manual") {
    nextW = Math.max(minW, Math.floor(item.w || minW));
    nextH = clamp(
      getRequiredTextHeightForWidth(item, nextW, "pre-wrap"),
      20,
      maxH
    );
  } else if (wrapState === "edge") {
    nextW = maxW;
    nextH = clamp(
      getRequiredTextHeightForWidth(item, nextW, "pre-wrap"),
      20,
      maxH
    );
    if (ed) {
      const liveH = Math.ceil(ed.scrollHeight || 0);
      if (liveH > 0) {
        nextH = clamp(Math.max(nextH, liveH), 20, maxH);
      }
    }
  } else {
    const rawRequiredW = getLiveRequiredTextWidth(item, ed);
    nextW = Math.max(minW, Math.min(rawRequiredW, maxW));
    nextH = clamp(getRequiredTextHeightForWidth(item, nextW, "pre"), 20, maxH);
    if (ed) {
      const liveH = Math.ceil(ed.scrollHeight || 0);
      if (liveH > 0) {
        nextH = clamp(Math.max(nextH, liveH), 20, maxH);
      }
    }
  }

  applyTextEditorLayoutStyles(ed, wrapState);
  item.w = nextW;
  item.h = nextH;
  applyTextAnnotationBoxSize(node, item.w, item.h);
  if (ed) {
    ed.style.height = "auto";
    ed.style.minHeight = "1.2em";
    ed.style.height = `${Math.ceil(ed.scrollHeight)}px`;
    const restoreCaret = () => {
      if (!caret || !helpers?.setPlainSelectionInEditor) return false;
      try {
        return helpers.setPlainSelectionInEditor(
          ed,
          caret.start,
          caret.collapsed ? caret.start : caret.end
        );
      } catch {
        return false;
      }
    };
    let restored = restoreCaret();
    if (!restored && savedRange && helpers?.restoreEditorSelectionRange) {
      restored = helpers.restoreEditorSelectionRange(ed, savedRange);
    }
    if (caret) {
      requestAnimationFrame(() => {
        try {
          restoreCaret();
          ed.focus();
        } catch {
          /* ignore */
        }
      });
    }
  }
}

function wireTextEditorInteraction(tab, item, node, ed) {
  ed.addEventListener(
    "paste",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const { insertSanitizedClipboardIntoEditor } = window.__editifyTextHtml;
      const handled =
        typeof insertSanitizedClipboardIntoEditor === "function" &&
        insertSanitizedClipboardIntoEditor(ed, event.clipboardData);
      if (handled === false) return;
      syncTextFromEditor(item, ed);
      applyEditingTextAutoGrow(tab, item, node);
      session.scheduleAutoSave();
    },
    { capture: true }
  );
  ed.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) {
        event.preventDefault();
        try {
          document.execCommand("insertLineBreak");
        } catch {
          /* ignore */
        }
        syncTextFromEditor(item, ed);
        applyEditingTextAutoGrow(tab, item, node);
        session.scheduleAutoSave();
        return;
      }
      event.preventDefault();
      leaveTextEditModeToSizing(tab, item, ed);
    },
    { capture: true }
  );
  ed.addEventListener(
    "input",
    () => {
      const helpers = window.__editifyTextCtxHelpers;
      const caretBefore = helpers?.getPlainSelectionOffsetsInEditor
        ? helpers.getPlainSelectionOffsetsInEditor(ed)
        : null;
      syncTextFromEditor(item, ed);
      applyEditingTextAutoGrow(tab, item, node);
      if (caretBefore && helpers?.setPlainSelectionInEditor) {
        requestAnimationFrame(() => {
          try {
            helpers.setPlainSelectionInEditor(
              ed,
              caretBefore.start,
              caretBefore.collapsed ? caretBefore.start : caretBefore.end
            );
          } catch {
            /* ignore */
          }
        });
      }
      session.scheduleAutoSave();
    },
    { capture: true }
  );
  ed.addEventListener(
    "blur",
    () => {
      try {
        if (state.editingAnnotationId !== item.id) return;
        captureSnapshot(tab);
        syncTextFromEditor(item, ed);
        finalizeTextAnnotationLayout(item);
        session.scheduleAutoSave();
      } catch {}
    },
    { capture: true }
  );
  ed.addEventListener(
    "mousedown",
    (event) => {
      event.stopPropagation();
    },
    { capture: true }
  );
}

function applyTextAnnotationBoxSize(node, w, h) {
  if (!node) return;
  node.style.width = `${Math.max(20, Math.floor(w || 20))}px`;
  node.style.height = `${Math.max(20, Math.floor(h || 20))}px`;
}

function scheduleAutoGrowText(tab, item, node, source = "render") {
  if (!tab || !item || item.type !== "text" || !node) return;
  const run = () => {
    try {
      const isEditing = source === "input" || state.editingAnnotationId === item.id;
      if (isEditing) {
        applyEditingTextAutoGrow(tab, item, node);
        if (source === "input") session.scheduleAutoSave();
        return;
      }

      const zone = getSafeZoneSize();
      const maxH = Math.max(20, zone.height - (item.y || 0));
      const required = getRequiredTextHeight(item);
      if (required <= (item.h || 0) + 1) return;
      const nextH = clamp(required, 20, maxH);
      if (nextH <= (item.h || 0) + 1) return;
      item.h = nextH;
      applyTextAnnotationBoxSize(node, item.w, item.h);
      session.scheduleAutoSave();
    } catch (error) {
      try {
        globalThis.__editifyReportError?.("text:autoGrow", String(error), { id: item?.id, source });
      } catch {
        /* ignore */
      }
    }
  };
  if (source === "input") {
    run();
    return;
  }
  requestAnimationFrame(run);
}


/**
 * Dictionnaires i18n : données dans renderer-i18n-data.js (chargé avant ce script).
 * Ancien emplacement : bloc const I18N = { ... } ici - supprimé après extraction (git pour historique).
 */
const I18N = window.__EDITIFY_I18N;
if (!I18N || typeof I18N !== "object") {
  throw new Error("renderer-i18n-data.js doit etre charge avant renderer.js (voir index.html).");
}

const SHAPE_TYPES = new Set([
  "rect",
  "ellipse",
  "triangle",
  "line",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "arrow",
  "heart",
  "cross",
  "parallelogram",
  "trapezoid"
]);

/** Points polygone (viewBox 0 0 100 100), alignés sur SHAPE_PCT / clip-path CSS (export PDF). */
const SHAPE_POLYGON_POINTS = {
  triangle: "50,0 0,100 100,100",
  diamond: "50,0 100,50 50,100 0,50",
  pentagon: "50,0 95,35 78,100 22,100 5,35",
  hexagon: "25,0 75,0 100,50 75,100 25,100 0,50",
  octagon: "30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30",
  star: "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35",
  arrow: "0,35 70,35 70,15 100,50 70,85 70,65 0,65",
  // Cœur : contour polygonal stable et symétrique (approximation de courbes + "creux" en haut).
  heart: "50,92 62,82 74,70 84,56 90,42 88,30 80,20 68,16 58,20 50,32 42,20 32,16 20,20 12,30 10,42 16,56 26,70 38,82",
  cross: "35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35",
  parallelogram: "18,0 100,0 82,100 0,100",
  trapezoid: "18,0 82,0 100,100 0,100"
};

const SHAPE_DEFAULTS = {
  rect: { fillColor: "#007acc", fillAlpha: 0.2, strokeColor: "#007acc", strokeWidth: 0 },
  ellipse: { fillColor: "#ff7800", fillAlpha: 0.2, strokeColor: "#ff7800", strokeWidth: 0 },
  triangle: { fillColor: "#7d53ff", fillAlpha: 0.25, strokeColor: "#7d53ff", strokeWidth: 0 },
  line: { fillColor: "#000000", fillAlpha: 0, strokeColor: "#00a86b", strokeWidth: 3 },
  diamond: { fillColor: "#d10068", fillAlpha: 0.25, strokeColor: "#d10068", strokeWidth: 0 },
  pentagon: { fillColor: "#0077c2", fillAlpha: 0.22, strokeColor: "#0077c2", strokeWidth: 0 },
  hexagon: { fillColor: "#2e8b57", fillAlpha: 0.25, strokeColor: "#2e8b57", strokeWidth: 0 },
  octagon: { fillColor: "#d84315", fillAlpha: 0.22, strokeColor: "#d84315", strokeWidth: 0 },
  star: { fillColor: "#ffd700", fillAlpha: 0.3, strokeColor: "#d4a017", strokeWidth: 0 },
  arrow: { fillColor: "#2196f3", fillAlpha: 0.3, strokeColor: "#1976d2", strokeWidth: 0 },
  heart: { fillColor: "#e91e63", fillAlpha: 0.3, strokeColor: "#c2185b", strokeWidth: 0 },
  cross: { fillColor: "#ffc107", fillAlpha: 0.3, strokeColor: "#ff8f00", strokeWidth: 0 },
  parallelogram: { fillColor: "#7b1fa2", fillAlpha: 0.24, strokeColor: "#7b1fa2", strokeWidth: 0 },
  trapezoid: { fillColor: "#0288d1", fillAlpha: 0.22, strokeColor: "#0288d1", strokeWidth: 0 }
};

function shapeStyleDefaults(type) {
  return SHAPE_DEFAULTS[type] || SHAPE_DEFAULTS.rect;
}

function mergeShapeStyleFields(a) {
  if (!a || !SHAPE_TYPES.has(a.type)) return;
  const d = shapeStyleDefaults(a.type);
  if (a.fillColor == null || a.fillColor === undefined) a.fillColor = d.fillColor;
  if (a.fillAlpha == null || a.fillAlpha === undefined) a.fillAlpha = d.fillAlpha;
  if (a.strokeColor == null || a.strokeColor === undefined) a.strokeColor = d.strokeColor;
  if (a.strokeWidth == null || a.strokeWidth === undefined) a.strokeWidth = d.strokeWidth;
  if (a.strokeAlpha == null || a.strokeAlpha === undefined) a.strokeAlpha = 1;
  if (a.backdropColor === undefined) a.backdropColor = null;
  if (a.backdropAlpha == null || a.backdropAlpha === undefined) a.backdropAlpha = 0;
}

/** Opacité de remplissage par défaut après « transparent » puis nouveau choix de couleur (types avec fillAlpha 0 au défaut, ex. ligne). */
function defaultShapeFillAlphaAfterClear(type) {
  let def = shapeStyleDefaults(type).fillAlpha ?? 0.3;
  if (def < 0.02) def = 0.3;
  return def;
}

function hexToRgba(hex, alpha01) {
  const a = clamp(Number(alpha01) || 0, 0, 1);
  const raw = String(hex || "#000000").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw.slice(0, 6);
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(0,0,0,${a})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Rendu forme en SVG (contour suivant la géométrie réelle, comme le PDF - plus de clip-path qui masque le border).
 */
function renderShapeVectorDOM(host, a) {
  host.replaceChildren();
  host.style.background = "transparent";
  host.style.border = "none";
  host.style.clipPath = "none";
  host.style.borderRadius = "0";

  const w = Math.max(1, Number(a.w) || 100);
  const h = Math.max(1, Number(a.h) || 100);

  const backdrop = document.createElement("div");
  backdrop.className = "shape-backdrop";
  const bdA = clamp(Number(a.backdropAlpha) || 0, 0, 1);
  const bdC = a.backdropColor;
  if (bdA > 0.001 && bdC && String(bdC).trim()) {
    backdrop.style.backgroundColor = hexToRgba(bdC, bdA);
  } else {
    backdrop.style.display = "none";
  }
  host.appendChild(backdrop);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("shape-svg");

  const fa = clamp(Number.isFinite(Number(a.fillAlpha)) ? Number(a.fillAlpha) : 0.3, 0, 1);
  const fillCol = a.fillColor || "#000000";
  const fillPaint = fa < 0.001 ? "none" : hexToRgba(fillCol, fa);

  const swPx = Math.max(0, Number(a.strokeWidth) || 0);
  const strokeA = clamp(Number.isFinite(Number(a.strokeAlpha)) ? Number(a.strokeAlpha) : 1, 0, 1);
  const strokeCol = a.strokeColor || "#333333";
  const strokePaint = swPx < 0.001 || strokeA < 0.001 ? "none" : hexToRgba(strokeCol, strokeA);

  /** Contour en pixels écran (pas en unités viewBox) : évite bords latéraux plus épais quand la forme est étirée. */
  const setStrokeAttrs = (el) => {
    if (strokePaint === "none") {
      el.setAttribute("stroke", "none");
      el.setAttribute("stroke-width", "0");
      el.removeAttribute("vector-effect");
    } else {
      el.setAttribute("stroke", strokePaint);
      el.setAttribute("stroke-width", String(Math.max(0.001, swPx)));
      el.setAttribute("vector-effect", "non-scaling-stroke");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("stroke-linecap", "round");
    }
  };

  if (a.type === "line") {
    const swLine = Math.max(0, Number(a.strokeWidth) || 3);
    const sa = clamp(Number.isFinite(Number(a.strokeAlpha)) ? Number(a.strokeAlpha) : 1, 0, 1);
    const sc = a.strokeColor || "#00a86b";
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", "0");
    ln.setAttribute("y1", "12");
    ln.setAttribute("x2", "100");
    ln.setAttribute("y2", "12");
    if (sa < 0.001) {
      ln.setAttribute("stroke", "none");
      ln.setAttribute("stroke-width", "0");
    } else {
      ln.setAttribute("stroke", hexToRgba(sc, sa));
      ln.setAttribute("stroke-width", String(Math.max(0.001, swLine)));
      ln.setAttribute("vector-effect", "non-scaling-stroke");
      ln.setAttribute("stroke-linecap", "square");
    }
    svg.appendChild(ln);
  } else if (a.type === "rect") {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "0");
    r.setAttribute("y", "0");
    r.setAttribute("width", "100");
    r.setAttribute("height", "100");
    r.setAttribute("fill", fillPaint);
    setStrokeAttrs(r);
    svg.appendChild(r);
  } else if (a.type === "ellipse") {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    el.setAttribute("cx", "50");
    el.setAttribute("cy", "50");
    el.setAttribute("rx", "50");
    el.setAttribute("ry", "50");
    el.setAttribute("fill", fillPaint);
    setStrokeAttrs(el);
    svg.appendChild(el);
  } else {
    const pts = SHAPE_POLYGON_POINTS[a.type];
    if (pts) {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", pts);
      poly.setAttribute("fill", fillPaint);
      setStrokeAttrs(poly);
      svg.appendChild(poly);
    }
  }

  host.appendChild(svg);
}

function syncTextFromEditor(a, editorEl) {
  if (!a || !editorEl) return;
  const htmlApi = window.__editifyTextHtml;
  a.textHtml = htmlApi.sanitizeTextHtml(editorEl.innerHTML);
  a.text = htmlApi.plainTextFromEditorElement(editorEl);
  delete a._spellErrors;
}

/**
 * Clic sur nuancier / panneau couleur : ne pas quitter le mode édition texte.
 * @param {EventTarget | null} target
 */
function shouldPreserveTextEditOnOutsideClick(target) {
  if (!target || typeof target !== "object" || !("closest" in target)) return false;
  const el = /** @type {Element} */ (target);
  return Boolean(
    el.closest("#maniColorModal") ||
      el.closest("#textAnnotationCtxMenu") ||
      el.closest("#propTextColorLabel, #validateTextColorBtn, [data-mani-color-for='propTextColor']") ||
      el.closest("[data-mani-color-for='ctxTextColor'], #ctxValidateTextColorBtn")
  );
}

/**
 * Sauvegarde la sélection texte dans l'éditeur (avant clic nuancier / Valider).
 * Ne remplace le backup que si une sélection non vide est trouvée.
 */
function captureTextColorSelectionBackup() {
  try {
    const item = getSelectedAnnotation();
    if (!item || item.type !== "text" || state.editingAnnotationId !== item.id) return;
    const host = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${item.id}"]`);
    const ed = getAnnotationTextEditor(host);
    if (!ed) return;
    const { saveEditorSelectionRange } = window.__editifyTextCtxHelpers || {};
    const saved = typeof saveEditorSelectionRange === "function" ? saveEditorSelectionRange(ed) : null;
    if (saved && !saved.collapsed) {
      globalThis.__maniTextColorRangeBackup = saved;
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const ancestor = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (ancestor?.closest?.(".text-editor") === ed) {
        globalThis.__maniTextColorRangeBackup = range.cloneRange();
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Couleur texte : sélection partielle en édition (comme gras/italique), sinon tout le bloc.
 * @param {object} item annotation texte
 * @param {string} color
 */
function applyTextColorToTextAnnotation(item, color) {
  if (!item || item.type !== "text") return;
  const hex = String(color || "#111111").trim() || "#111111";
  const host = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${item.id}"]`);
  const ed = getAnnotationTextEditor(host);
  const { hasNonemptyTextSelectionInEditor, applyTextColorInEditor, restoreEditorSelectionRange } =
    window.__editifyTextCtxHelpers;
  if (ed && state.editingAnnotationId === item.id) {
    let partial = hasNonemptyTextSelectionInEditor(ed);
    /** @type {Range | null} */
    let savedRange = globalThis.__maniTextColorRangeBackup || null;
    if (!partial && savedRange) {
      try {
        if (
          ed.contains(savedRange.startContainer) &&
          ed.contains(savedRange.endContainer) &&
          !savedRange.collapsed
        ) {
          partial = true;
        } else {
          savedRange = null;
        }
      } catch {
        savedRange = null;
      }
    }
    if (!partial && savedRange && restoreEditorSelectionRange) {
      restoreEditorSelectionRange(ed, savedRange);
      partial = hasNonemptyTextSelectionInEditor(ed);
    }
    const ok = applyTextColorInEditor(ed, hex, {
      selectAllIfCollapsed: !partial,
      savedRange: partial ? savedRange : null
    });
    if (ok) {
      syncTextFromEditor(item, ed);
      if (!partial) {
        item.textColor = hex;
      } else {
        globalThis.__maniTextColorRangeBackup = null;
      }
      try {
        ed.focus();
      } catch {
        /* ignore */
      }
    }
    return;
  }
  globalThis.__maniTextColorRangeBackup = null;
  item.textColor = hex;
}

function getAnnotationTextEditor(root) {
  return root?.querySelector?.(".text-editor");
}

function t(key) {
  return I18N[state.language]?.[key] || I18N.fr[key] || key;
}

/** Remplace {{var}} dans une chaîne i18n. */
function tr(templateKey, vars) {
  let s = t(templateKey);
  if (vars && typeof vars === "object") {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{{${k}}}`).join(String(v));
    }
  }
  return s;
}


function setLanguage(lang) {
  const next = String(lang || "fr").toLowerCase();
  if (!I18N[next]) return;
  state.language = next;
  try {
    localStorage.setItem("editify:lang", next);
  } catch {
    /* ignore */
  }
  i18nApply.applyLanguage();
  applySpellcheckLanguageBestEffort();
  try {
    window.maniPdfApi?.notifyUiLanguage?.(next);
  } catch {
    /* ignore */
  }
  try {
    renderThumbnails();
    renderChanges();
    sw.renderSplitWorkspaceIfOpen();
  } catch {
    /* ignore */
  }
  setStatus(t("ready"));
}

function getSpellcheckBcp47FromUiLang(uiLang) {
  const l = String(uiLang || "fr").toLowerCase();
  if (l === "fr") return "fr-FR";
  if (l === "en") return "en-US";
  if (l === "es") return "es-ES";
  if (l === "pt") return "pt-PT";
  return "fr-FR";
}

function applySpellcheckLanguageBestEffort() {
  const bcp47 = getSpellcheckBcp47FromUiLang(state.language);
  try {
    document.documentElement.lang = bcp47;
  } catch {}

  // Applique immédiatement aux éditeurs de texte ouverts (édition en cours).
  try {
    const editors = document.querySelectorAll("#annotationLayer .text-editor");
    editors.forEach((ed) => {
      try {
        ed.spellcheck = true;
        ed.setAttribute("lang", bcp47);
      } catch {}
    });
  } catch {}

  // Active le dictionnaire côté Electron (si supporté).
  try {
    window.maniPdfApi?.setSpellcheckLanguages?.([bcp47]);
  } catch {
    /* ignore */
  }
}

function getSafeZoneSize() {
  const canvas = pdfLayerRef.pdfCanvas;
  if (canvas?.width > 0 && canvas?.height > 0) {
    return { width: canvas.width, height: canvas.height };
  }
  const rect = pdfLayerRef.annotationLayer?.getBoundingClientRect?.();
  if (!rect) return { width: 0, height: 0 };
  return {
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height))
  };
}

/** Zone canvas d'une page précise (export multi-pages — ne pas utiliser la page active). */
function getSafeZoneSizeForPage(tab, pageKey, canvases) {
  const key = String(pageKey || 1);
  const meta = canvases?.[key];
  if (meta?.w > 0 && meta?.h > 0) {
    return { width: meta.w, height: meta.h };
  }
  const vp = tab?.viewportByPage?.[key];
  if (vp?.width > 0 && vp?.height > 0) {
    return { width: vp.width, height: vp.height };
  }
  const pageNode = pagesContainer?.querySelector?.(`.pdf-page[data-page="${key}"]`);
  const canvas = pageNode?.querySelector?.("canvas.pdf-canvas");
  if (canvas?.width > 0 && canvas?.height > 0) {
    return { width: canvas.width, height: canvas.height };
  }
  return getSafeZoneSize();
}

/** Lit la géométrie DOM d'une annotation (repère canvas interne) — diagnostic export. */
function readAnnotationGeometryFromDom(node, canvas) {
  if (!node || !canvas) return null;
  const canvasRect = canvas.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, canvasRect.width);
  const sy = canvas.height / Math.max(1, canvasRect.height);
  return {
    x: (nodeRect.left - canvasRect.left) * sx,
    y: (nodeRect.top - canvasRect.top) * sy,
    w: nodeRect.width * sx,
    h: nodeRect.height * sy
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function fitAnnotationToSafeZone(item, zone) {
  // Toutes les formes géométriques : taille minimale 1×1 (aligné branche test).
  let minW = 20;
  let minH = 20;
  if (SHAPE_TYPES.has(item.type)) {
    minW = 1;
    minH = 1;
  }
  const prevW = item.w;
  const prevH = item.h;
  item.w = clamp(item.w, minW, Math.max(minW, zone.width));
  item.h = clamp(item.h, minH, Math.max(minH, zone.height));
  item.x = clamp(item.x, 0, Math.max(0, zone.width - item.w));
  item.y = clamp(item.y, 0, Math.max(0, zone.height - item.h));
  if (SHAPE_TYPES.has(item.type) && (prevW !== item.w || prevH !== item.h)) {
    try {
      logText("shapeFitZone", {
        type: item.type,
        id: item.id,
        prevW,
        prevH,
        w: item.w,
        h: item.h,
        minW,
        minH,
        zw: zone.width,
        zh: zone.height
      });
    } catch {
      /* ignore */
    }
  }
}

function scaleAnnotationsForZoneChange(tab, zone) {
  if (!tab) return false;
  const pageKey = String(tab.currentPage || 1);
  return scaleAnnotationsForPage(tab, zone, pageKey);
}

function scaleAnnotationsForPage(tab, zone, pageKey) {
  if (!tab || !zone?.width || !zone?.height) return false;
  const key = String(pageKey || 1);
  if (!tab.viewportByPage) tab.viewportByPage = {};
  const prev = tab.viewportByPage[key];
  tab.viewportByPage[key] = { width: zone.width, height: zone.height };

  if (!prev || prev.width <= 0 || prev.height <= 0) return false;
  if (prev.width === zone.width && prev.height === zone.height) return false;

  const sx = zone.width / prev.width;
  const sy = zone.height / prev.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;

  const annotations = tab.annotationsByPage?.[key] || [];
  if (!annotations.length) return false;

  annotations.forEach((item) => {
    item.x *= sx;
    item.y *= sy;
    item.w *= sx;
    item.h *= sy;
    if (item.type === "text") {
      const scale = Math.min(sx, sy);
      if (Number.isFinite(scale) && scale > 0) {
        item.fontSize = clamp((item.fontSize ?? 14) * scale, 8, 96);
        item.padding = clamp((item.padding ?? 6) * scale, 0, 64);
      }
    }
    fitAnnotationToSafeZone(item, zone);
  });
  return true;
}

function enforceSafeZoneForActiveTab() {
  const tab = getActiveTab();
  if (!tab) return;
  const zone = getSafeZoneSize();
  const annotations = currentPageAnnotations(tab);
  let changed = false;
  if (scaleAnnotationsForZoneChange(tab, zone)) {
    changed = true;
  }
  annotations.forEach((item) => {
    const before = `${item.x}|${item.y}|${item.w}|${item.h}`;
    fitAnnotationToSafeZone(item, zone);
    const after = `${item.x}|${item.y}|${item.w}|${item.h}`;
    if (before !== after) changed = true;
  });
  if (changed) {
    syncPropertyInputs();
    renderAnnotations();
  }
}

function setStatus(message) {
  // E10/NFR-06: éviter d'afficher des chemins complets dans l'UI.
  const safe = (() => {
    try {
      const m = String(message ?? "");
      return m.replace(/[A-Za-z]:\\[^\\s]+/g, "[chemin]");
    } catch {
      return String(message ?? "");
    }
  })();
  // Historique minimal pour tests/diagnostic (sans données sensibles).
  try {
    const arr = (window.__maniStatusHistory = window.__maniStatusHistory || []);
    arr.push(safe);
    if (arr.length > 60) arr.splice(0, arr.length - 60);
  } catch {}
  if (statusText) statusText.textContent = safe;
  else statusBar.textContent = safe;
}

function updateWelcomeVisibility() {
  if (!welcomeScreen) return;
  if (state.tabs.length > 0) {
    welcomeScreen.classList.add("hidden");
  } else {
    welcomeScreen.classList.remove("hidden");
  }
  try {
    window.__editifyPageRotate?.syncRotateButtonsState?.();
  } catch {
    /* ignore */
  }
}

function getActiveTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
}

function getSelectedAnnotation() {
  const tab = getActiveTab();
  if (!tab || !state.selectedAnnotationId) return null;
  return currentPageAnnotations(tab).find((a) => a.id === state.selectedAnnotationId) || null;
}

function renderTabs() {
  tabs.innerHTML = "";
  state.tabs.forEach((tab) => {
    const node = document.createElement("button");
    node.className = `tab ${tab.id === state.activeTabId ? "active" : ""}`;
    const label = document.createElement("span");
    label.textContent = tab.name;
    node.appendChild(label);

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "✕";
    closeBtn.title = "Retirer ce PDF";
    closeBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeTab(tab.id);
    };
    node.appendChild(closeBtn);
    node.onclick = () => {
      state.activeTabId = tab.id;
      pdfv.updateViewer();
      renderTabs();
    };
    tabs.appendChild(node);
  });
}

function removeTab(tabId) {
  const idx = state.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return;
  const removed = state.tabs[idx];

  // E7-S2: confirmation uniquement si risque de perte (modifs non sauvegardées).
  if (hasUnsavedRiskForTab(removed)) {
    const ok = window.confirm("Ce PDF a des modifications non sauvegardées. Le retirer ?");
    if (!ok) return;
  }

  // Une seule annulation possible à la fois (MVP): on invalide l'ancienne.
  if (pendingTabUndo?.toastId) dismissToast(pendingTabUndo.toastId);
  pendingTabUndo = null;

  const wasActive = state.activeTabId === tabId;
  const prevActiveTabId = state.activeTabId;
  state.tabs.splice(idx, 1);

  if (state.activeTabId === tabId) {
    state.activeTabId = state.tabs[0]?.id || null;
    state.selectedAnnotationId = null;
    state.editingAnnotationId = null;
  }

  renderTabs();
  pdfv.updateViewer();
  updateWelcomeVisibility();
  session.scheduleAutoSave();
  syncOpenPdfPathsToMain().catch(() => {});

  // E7-S1: toast "PDF retiré" + Annuler (5-8s)
  pendingTabUndo = {
    tab: removed,
    index: idx,
    wasActive,
    prevActiveTabId,
    toastId: null
  };
  const toastId = showToast({
    message: "PDF retiré",
    actionLabel: "Annuler",
    onAction: () => {
      if (!pendingTabUndo) return;
      const entry = pendingTabUndo;
      pendingTabUndo = null;
      const safeIndex = clamp(entry.index, 0, state.tabs.length);
      state.tabs.splice(safeIndex, 0, entry.tab);
      if (entry.wasActive) state.activeTabId = entry.tab.id;
      else state.activeTabId = entry.prevActiveTabId || state.activeTabId;
      state.selectedAnnotationId = null;
      state.editingAnnotationId = null;

      renderTabs();
      pdfv.updateViewer();
      updateWelcomeVisibility();
      session.scheduleAutoSave();
      syncOpenPdfPathsToMain().catch(() => {});
    },
    timeoutMs: 6500
  });
  pendingTabUndo.toastId = toastId;
  setTimeout(() => {
    if (pendingTabUndo?.toastId !== toastId) return;
    pendingTabUndo = null;
  }, 7000);
}

/** Informe le main des chemins PDF des onglets ouverts (garde pdf:read-bytes). */
async function syncOpenPdfPathsToMain() {
  try {
    if (!window.maniPdfApi?.syncOpenPdfPaths) return;
    const paths = state.tabs.map((t) => t.path).filter(Boolean);
    await window.maniPdfApi.syncOpenPdfPaths(paths);
  } catch {
    /* ignore */
  }
}

/** Message utilisateur pour un échec IPC `pdf:open` (codes stables côté main). */
function resolvePdfOpenErrorMessage(result) {
  if (result?.errorCode === "VALIDATION_SERVICE_UNAVAILABLE") {
    return t("stValidationServiceUnavailable");
  }
  return result?.error || "Impossible d'ouvrir le PDF.";
}

async function addPdfTab(filePath, fileName) {

  const result = await window.maniPdfApi.openPdf(filePath);
  if (!result.ok) {
    setStatus(resolvePdfOpenErrorMessage(result));

    return;
  }

  const tab = {
    id: `${Date.now()}-${Math.random()}`,
    name: fileName,
    path: result.path,
    currentPage: 1,
    annotationsByPage: {},
    pageRotationsByPage: {},
    pageRotationsUserTouched: {},
    viewportByPage: {},
    undoStack: [],
    redoStack: []
  };
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  renderTabs();
  await syncOpenPdfPathsToMain();
  pdfv.updateViewer();
  updateWelcomeVisibility();
  setStatus(tr("stPdfLoadedNamed", { name: fileName }));
  // E10-S1: onboarding minimal après ouverture
  try {
    setTimeout(() => {
      // Ne pas spammer si l'utilisateur a déjà des interactions.
      if (!getActiveTab()) return;
      setStatus(t("stPdfLoadedHint2"));
    }, 250);
  } catch {}

}

async function promptOpenPdf() {

  const selected = await window.maniPdfApi.openPdfDialog();
  if (!selected.ok) {
    if (!selected.cancelled) setStatus(selected.error || t("stSelectionCancelled"));

    return;
  }
  const name = selected.path.split("\\").pop() || "document.pdf";
  await addPdfTab(selected.path, name);
}

function annotationsOnPage(tab, pageKey) {
  if (!tab) return [];
  const key = String(pageKey || 1);
  if (!tab.annotationsByPage[key]) tab.annotationsByPage[key] = [];
  return tab.annotationsByPage[key];
}

function currentPageAnnotations(tab) {
  const page = String(tab.currentPage || 1);
  return annotationsOnPage(tab, page);
}

function getTabSnapshotState(tab) {
  return {
    annotationsByPage: tab.annotationsByPage,
    pageRotationsByPage: tab.pageRotationsByPage || {},
    pageRotationsUserTouched: tab.pageRotationsUserTouched || {}
  };
}

function normalizePageRotationDeg(deg) {
  const n = Number(deg) || 0;
  return ((Math.round(n) % 360) + 360) % 360;
}

function captureSnapshot(tab) {
  const snapshot = JSON.stringify(getTabSnapshotState(tab));
  tab.undoStack.push(snapshot);
  if (tab.undoStack.length > 50) tab.undoStack.shift();
  tab.redoStack = [];
  // E7-S2: toute mutation des annotations rend l'onglet "dirty".
  tab.dirty = true;
}

function applySnapshot(tab, snapshot) {
  const parsed = JSON.parse(snapshot);
  const prevRot = { ...(tab.pageRotationsByPage || {}) };
  tab.annotationsByPage = parsed.annotationsByPage || {};
  tab.pageRotationsByPage =
    parsed.pageRotationsByPage && typeof parsed.pageRotationsByPage === "object"
      ? parsed.pageRotationsByPage
      : {};
  tab.pageRotationsUserTouched =
    parsed.pageRotationsUserTouched && typeof parsed.pageRotationsUserTouched === "object"
      ? parsed.pageRotationsUserTouched
      : {};
  const changedPages = new Set();
  const allKeys = new Set([...Object.keys(prevRot), ...Object.keys(tab.pageRotationsByPage)]);
  for (const k of allKeys) {
    if (
      normalizePageRotationDeg(prevRot[k] || 0) !==
      normalizePageRotationDeg(tab.pageRotationsByPage[k] || 0)
    ) {
      changedPages.add(Number(k) || 1);
    }
  }
  return changedPages;
}

function renderAnnotations() {
  if (!pdfLayerRef.annotationLayer) return;
  pdfLayerRef.annotationLayer.innerHTML = "";
  const tab = getActiveTab();
  if (!tab) return;
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
      } catch {}
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
        } catch {}
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
          } catch {}
        });
      }

      node.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        tcm.openTextAnnotationCtxMenu(event, a.id);
      };

      node.ondblclick = (event) => {
        if (interactionMode && interactionMode !== "drag-pending") return;
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
        } catch {}
        event.stopPropagation();
        cancelPointerInteraction();
        if (pendingSingleClickRenderTimer) {
          clearTimeout(pendingSingleClickRenderTimer);
          pendingSingleClickRenderTimer = null;
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
        const isSecondDown = lastTextMouseDownId === a.id && now - lastTextMouseDownAt <= 320;

        lastTextMouseDownAt = now;
        lastTextMouseDownId = a.id;
        if (isSecondDown) {

          // CRITIQUE: sinon le mousedown "bulle" et le listener global
          // considère le clic comme "hors zone" (car le DOM est rerender),
          // ce qui annule immédiatement l'édition.
          try {
            event.preventDefault();
          } catch {}
          event.stopPropagation();
          state.selectedAnnotationId = a.id;
          state.editingAnnotationId = a.id;
          cancelPointerInteraction();
          if (pendingSingleClickRenderTimer) {
            clearTimeout(pendingSingleClickRenderTimer);
            pendingSingleClickRenderTimer = null;
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
      if (Date.now() < suppressClickUntil || interactionMode) return;
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
        const isSecondClick = lastTextClickId === a.id && now - lastTextClickAt <= 320;
        lastTextClickAt = now;
        lastTextClickId = a.id;

        // Fallback robuste: Electron/Chromium peut ne pas émettre "dblclick"
        // si le DOM est rerender ou si un drag est amorcé.
        if (isSecondClick) {

          if (pendingSingleClickRenderTimer) {
            clearTimeout(pendingSingleClickRenderTimer);
            pendingSingleClickRenderTimer = null;
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

        if (pendingSingleClickRenderTimer) clearTimeout(pendingSingleClickRenderTimer);
        pendingSingleClickRenderTimer = setTimeout(() => {
          pendingSingleClickRenderTimer = null;
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
  if (event.button !== 0) return;
  if (interactionMode) return;

  if (state.editingAnnotationId === id) return;
  if (event.target.classList?.contains("resize-handle")) return;
  const tab = getActiveTab();
  if (!tab) return;
  const item = currentPageAnnotations(tab).find((a) => a.id === id);
  if (!item) return;
  state.selectedAnnotationId = id;
  // Ne pas preventDefault ici: sinon Chromium ne déclenche souvent pas le dblclick.
  interactionMode = "drag-pending";
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = item.x;
  const originY = item.y;
  const startScrollLeft = viewer?.scrollLeft || 0;
  const startScrollTop = viewer?.scrollTop || 0;
  let lastClientX = startX;
  let lastClientY = startY;
  captureSnapshot(tab);
  let hasMoved = false;

  const applyDragAt = (clientX, clientY) => {
    const dx = clientX - startX + ((viewer?.scrollLeft || 0) - startScrollLeft);
    const dy = clientY - startY + ((viewer?.scrollTop || 0) - startScrollTop);
    const dist2 = dx * dx + dy * dy;
    if (!hasMoved) {
      // seuil anti "clic = drag" (permet dblclick fiable)
      // 12px: évite qu'un léger tremblement annule le click/dblclick
      if (dist2 < 144) return;
      hasMoved = true;
      interactionMode = "drag";
      try {
        // On ne doit empêcher le comportement par défaut qu'une fois le drag confirmé.
        // (Sinon dblclick devient flaky sous Chromium/Electron.)
      } catch {}
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
      } catch {}
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
    interactionMode = null;
    // Ne pas bloquer le click si on n'a pas réellement dragué.
    suppressClickUntil = Date.now() + (hasMoved ? 180 : 0);
    activePointerCleanup = null;
    syncPropertyInputs();
    session.scheduleAutoSave();
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  viewer?.addEventListener?.("scroll", onScroll, { passive: true });
  activePointerCleanup = up;
}

/**
 * Redimensionne l'annotation : les deltas écran sont exprimés dans le repère local
 * tourné de `item.rotation` (cohérent avec `transform-origin: 0 0` sur `.annotation`).
 */
function startResize(event, id, mode = "br") {
  if (event.button !== 0) return;
  if (interactionMode) return;
  event.preventDefault();
  event.stopPropagation();
  const tab = getActiveTab();
  if (!tab) return;
  const item = currentPageAnnotations(tab).find((a) => a.id === id);
  if (!item) return;
  state.selectedAnnotationId = id;
  interactionMode = "resize";
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = item.x;
  const originY = item.y;
  const originW = item.w;
  const originH = item.h;
  captureSnapshot(tab);

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
        const minWidthToFit = getMinWidthToFitHeight(item, nextH, Math.min(maxWAllowed, Math.max(nextW, originW)));
        if (nextW < minWidthToFit) {
          if (affectsLeft) {
            nextX -= (minWidthToFit - nextW);
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
    interactionMode = null;
    suppressClickUntil = Date.now() + 180;
    activePointerCleanup = null;
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
  activePointerCleanup = up;
}

function computeInsertPositionForNewAnnotation(tab, annotation, zone) {
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

function addAnnotation(type, extra = {}) {
  const tab = getActiveTab();
  if (!tab) return;
  captureSnapshot(tab);
  const pageKey = String(tab.currentPage || 1);
  const annotations = annotationsOnPage(tab, pageKey);
  const id = newAnnotationId();
  const textDefaults = type === "text" ? getNewTextAnnotationDefaults() : null;
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
  if (SHAPE_TYPES.has(type)) {
    mergeShapeStyleFields(annotation);
  }
  const zone = getSafeZoneSize();
  if (!tab.viewportByPage) tab.viewportByPage = {};
  if (!tab.viewportByPage[pageKey]?.width || !tab.viewportByPage[pageKey]?.height) {
    tab.viewportByPage[pageKey] = { width: zone.width, height: zone.height };
  }
  computeInsertPositionForNewAnnotation(tab, annotation, zone);
  fitAnnotationToSafeZone(annotation, zone);
  annotations.push(annotation);
  state.selectedAnnotationId = id;
  if (type === "text") {
    state.editingAnnotationId = id;
    captureLastTextStyleFromItem(annotation);
  }
  syncPropertyInputs();
  renderAnnotations();
  if (type === "text") {
    focusTextAnnotationEditor(id);
  }
  logAnnotationAudit("add", tab, annotation, pageKey);
  session.scheduleAutoSave();
}

function pasteClipboardIntoActivePage() {
  const tab = getActiveTab();
  if (!tab || !state.clipboard) return;
  const data = deepClone(state.clipboard);
  data.id = newAnnotationId();

  // Page cible = page active (la position du curseur est supposée être sur cette page).
  const targetPage = String(tab.currentPage || 1);
  if (!tab.annotationsByPage[targetPage]) tab.annotationsByPage[targetPage] = [];

  const zone = getSafeZoneSize();
  const p = state.lastPointer && Number(state.lastPointer.page) === Number(tab.currentPage || 1) ? state.lastPointer : null;
  const cx = p ? p.x : zone.width / 2;
  const cy = p ? p.y : zone.height / 2;

  // Positionner top-left proche du curseur, sans sortir de la page.
  data.x = cx - (data.w || 20) / 2;
  data.y = cy - (data.h || 20) / 2;
  fitAnnotationToSafeZone(data, zone);

  captureSnapshot(tab);
  tab.annotationsByPage[targetPage].push(data);
  state.selectedAnnotationId = data.id;
  state.editingAnnotationId = null;
  syncPropertyInputs();
  renderAnnotations();
  logAnnotationAudit("paste", tab, data, targetPage);
  session.scheduleAutoSave();
}

function openShapePicker() {
  shapeModal.classList.remove("hidden");
}

function closeShapePicker() {
  shapeModal.classList.add("hidden");
}

function addShapeByType(shapeType) {
  if (!shapeType) return;
  if (shapeType === "line") {
    addAnnotation("line", { h: 20 });
  } else {
    addAnnotation(shapeType);
  }
  closeShapePicker();
}

function deleteSelected() {
  const tab = getActiveTab();
  if (!tab || !state.selectedAnnotationId) return;
  const found = findAnnotationLocation(tab, state.selectedAnnotationId);
  if (!found) return;
  captureSnapshot(tab);
  found.arr.splice(found.idx, 1);
  state.selectedAnnotationId = null;
  syncPropertyInputs();
  renderAnnotations();
  session.scheduleAutoSave();
}

function finishUndoRedoUi(tab) {
  state.selectedAnnotationId = null;
  syncPropertyInputs();
  renderAnnotations();
  session.scheduleAutoSave();
}

function undo() {
  const tab = getActiveTab();
  if (!tab || tab.undoStack.length === 0) return;
  const current = JSON.stringify(getTabSnapshotState(tab));
  tab.redoStack.push(current);
  const snapshot = tab.undoStack.pop();
  const changedPages = applySnapshot(tab, snapshot);
  const after = () => finishUndoRedoUi(tab);
  if (changedPages.size) {
    pdfv.rerenderPages([...changedPages]).then(after).catch(after);
  } else {
    after();
  }
}

function redo() {
  const tab = getActiveTab();
  if (!tab || tab.redoStack.length === 0) return;
  const current = JSON.stringify(getTabSnapshotState(tab));
  tab.undoStack.push(current);
  const snapshot = tab.redoStack.pop();
  const changedPages = applySnapshot(tab, snapshot);
  const after = () => finishUndoRedoUi(tab);
  if (changedPages.size) {
    pdfv.rerenderPages([...changedPages]).then(after).catch(after);
  } else {
    after();
  }
}

function syncPropertyInputs() {
  const item = getSelectedAnnotation();
  const isText = !!item && item.type === "text";
  const isShape = !!item && SHAPE_TYPES.has(item.type);
  if (textPropsPanel) {
    textPropsPanel.classList.toggle("hidden", !isText);
  }
  if (shapePropsPanel) {
    shapePropsPanel.classList.toggle("hidden", !isShape);
  }
  if (!item) return;
  if (propWidth && propHeight && propRotation && propOpacity) {
    propWidth.value = String(Math.round(item.w || 180));
    propHeight.value = String(Math.round(item.h || 120));
    propRotation.value = String(Math.round(item.rotation || 0));
    propOpacity.value = String(Math.round(item.opacity ?? 100));
  }
  if (isText) {
    propTextColor.value = item.textColor || "#111111";

    // Fond transparent par défaut: on affiche une "case vide".
    // input[type=color] ne supporte pas une valeur vide, donc on met un fallback,
    // et on pilote l'apparence via une classe CSS.
    const bgIsTransparent = !item.bgColor;
    propBgColor.value = bgIsTransparent ? "#ffffff" : item.bgColor;
    propBgColorLabel?.classList?.toggle?.("is-transparent", bgIsTransparent);

    // Le champ Fond n'est appliqué que si l'utilisateur le modifie explicitement.
    propBgColor.dataset.touched = "0";
    propPadding.value = String(Math.round(item.padding ?? 6));
    propFontFamily.value = item.fontFamily || "Arial";
    propFontSize.value = String(Math.round(item.fontSize ?? 14));
    captureLastTextStyleFromItem(item);
  }
  if (isShape && propShapeFill && propShapeFillOpacity && propShapeStroke && propShapeStrokeWidth) {
    mergeShapeStyleFields(item);
    propShapeFill.value = item.fillColor || "#000000";
    propShapeFillOpacity.value = String(Math.round((Number(item.fillAlpha) ?? 0.3) * 100));
    propShapeStroke.value = item.strokeColor || "#000000";
    propShapeStrokeWidth.value = String(Math.max(0, Math.floor(Number(item.strokeWidth) || 0)));
    if (propShapeStrokeOpacity) propShapeStrokeOpacity.value = String(Math.round((Number(item.strokeAlpha) ?? 1) * 100));
    if (propShapeBackdrop && propShapeBackdropOpacity) {
      const bdTr = !item.backdropColor || (Number(item.backdropAlpha) ?? 0) < 0.001;
      propShapeBackdrop.value = bdTr ? "#ffffff" : item.backdropColor;
      propShapeBackdropOpacity.value = String(Math.round((Number(item.backdropAlpha) ?? 0) * 100));
    }
  }
  try {
    window.syncManiColorSwatches?.();
  } catch {
    /* ignore */
  }
}

window.__editifySidebars.bind({
  state,
  changesList,
  changesCount,
  thumbsList,
  pagesContainer,
  get annotationLayer() {
    return pdfLayerRef.annotationLayer;
  },
  getActiveTab,
  setActivePage: pdfv.setActivePage,
  t,
  tr,
  clamp,
  annotationTypeLabel,
  annotationSummary,
  ensureChangesContextMenu,
  syncPropertyInputs,
  renderAnnotations
});
pdfv.bind({
  state,
  layerRef: pdfLayerRef,
  viewer,
  pagesContainer,
  pageInfo,
  zoomInfo,
  zoomOutBtn,
  zoomInBtn,
  getActiveTab,
  t,
  tr,
  setStatus,
  clamp,
  enforceSafeZoneForActiveTab,
  renderAnnotations,
  shouldPauseScrollPageSync: () => Boolean(interactionMode || state.editingAnnotationId),
  scheduleSidebarUpdate: window.__editifySidebars.scheduleSidebarUpdate,
  pathsEqual,
  scheduleAutoSave: () => session.scheduleAutoSave()
});
pdfv.wireResize();
pdfv.wireWheel();
pdfv.wireZoomButtons();
pdfv.wireScrollPageSync();
pdfSave.bind({
  getActiveTab,
  layerRef: pdfLayerRef,
  pagesContainer,
  commitActiveTextEditIfNeeded,
  findAnnotationLocation,
  getAnnotationTextEditor,
  syncTextFromEditor,
  plainTextForAnnotationItem,
  sanitizeTextHtml: window.__editifyTextHtml.sanitizeTextHtml,
  buildExportTextHtmlForPdf: window.__editifyTextHtml.buildExportTextHtmlForPdf,
  ensureTextAnnotationsSizedForExport,
  syncOpenPdfPathsToMain,
  scaleAnnotationsForPage,
  SHAPE_TYPES,
  mergeShapeStyleFields,
  convertCanvasRectToPdfUser: pdfv.convertCanvasRectToPdfUser,
  invalidatePdfRenderCache: pdfv.invalidatePdfRenderCache,
  updateViewer: pdfv.updateViewer,
  pathsEqual,
  setStatus,
  t
});
session.bind({
  state,
  setStatus,
  t,
  renderTabs,
  updateViewer: pdfv.updateViewer,
  updateWelcomeVisibility,
  syncPropertyInputs,
  scheduleSidebarUpdate: window.__editifySidebars.scheduleSidebarUpdate,
  syncOpenPdfPathsToMain
});
sim.bind({
  state,
  getActiveTab,
  findAnnotationLocation,
  commitActiveTextEditIfNeeded,
  cancelPointerInteraction,
  syncPropertyInputs,
  renderAnnotations,
  scheduleAutoSave: session.scheduleAutoSave,
  captureSnapshot,
  mergeShapeStyleFields,
  defaultShapeFillAlphaAfterClear,
  SHAPE_TYPES,
  clamp,
  propShapeFill,
  propShapeFillOpacity,
  propShapeStroke,
  propShapeStrokeOpacity,
  propShapeStrokeWidth,
  propShapeBackdrop,
  propShapeBackdropOpacity,
  hideTextAnnotationCtxMenu: () => window.__editifyTextCtxMenu.hideTextAnnotationCtxMenu(),
  hideChangesContextMenu
});
tcm.bind({
  state,
  getActiveTab,
  findAnnotationLocation,
  commitActiveTextEditIfNeeded,
  cancelPointerInteraction,
  syncPropertyInputs,
  renderAnnotations,
  scheduleAutoSave: session.scheduleAutoSave,
  captureSnapshot,
  get annotationLayer() {
    return pdfLayerRef.annotationLayer;
  },
  getAnnotationTextEditor,
  syncTextFromEditor,
  applyTextColorToTextAnnotation,
  captureTextColorSelectionBackup,
  getSpellcheckBcp47FromUiLang,
  t,
  propFontFamily,
  propFontSize,
  propTextColor,
  propBgColor,
  propBgColorLabel,
  hideShapeAnnotationCtxMenu: () => window.__editifyShapeImageCtxMenu.hideShapeAnnotationCtxMenu(),
  hideImageAnnotationCtxMenu: () => window.__editifyShapeImageCtxMenu.hideImageAnnotationCtxMenu(),
  hideChangesContextMenu
});
const showToastBrief = (msg) => {
  try {
    showToast({ message: msg, timeoutMs: 5200 });
  } catch {
    /* ignore */
  }
};
jobs.bind({
  sessionLog,
  tr,
  showToastBrief,
  t,
  setStatus,
  state,
  getActiveTab,
  openSplitWorkspace: () => sw.openSplitWorkspace()
});
htmlConvert.bind({
  toolbarHtmlToPdfBtn,
  t,
  tr,
  setStatus,
  showToastBrief,
  sessionLog,
  closeMenus: () => chrome.closeAllFlyoutMenus(),
  openPdfAtPath: (filePath, fileName) => addPdfTab(filePath, fileName)
});
imageConvert.bind({
  toolbarImagesToPdfBtn,
  t,
  tr,
  setStatus,
  showToastBrief,
  sessionLog,
  closeMenus: () => chrome.closeAllFlyoutMenus(),
  openPdfAtPath: (filePath, fileName) => addPdfTab(filePath, fileName)
});
window.__editifyPageRotate.bind({
  rotateLeftBtn,
  rotateRightBtn,
  state,
  getActiveTab,
  pagesContainer,
  captureSnapshot,
  renderAnnotations,
  enforceSafeZoneForActiveTab,
  rerenderPage: (n) => pdfv.rerenderPage(n),
  scheduleSidebarUpdate: window.__editifySidebars.scheduleSidebarUpdate,
  session,
  t,
  setStatus
});
sw.bind({
  getActiveTab,
  tr,
  t,
  setStatus,
  enqueuePdfJob: jobs.enqueuePdfJob,
  buildDefaultOutputPath: jobs.buildDefaultOutputPath,
  pagesContainer,
  splitWorkspaceOverlay,
  splitWorkspaceGroups,
  splitWorkspaceValidateBtn,
  splitWorkspaceAddGroupBtn,
  splitWorkspaceCloseBtn
});
tooltips.bind({ toolTip });
scheduleSidebarUpdate = window.__editifySidebars.scheduleSidebarUpdate;
renderThumbnails = window.__editifySidebars.renderThumbnails;
renderChanges = window.__editifySidebars.renderChanges;

function applySelectedProperties() {
  const tab = getActiveTab();
  const item = getSelectedAnnotation();
  if (!tab || !item) return;
  captureSnapshot(tab);
  if (item.type === "text") {
    applyTextColorToTextAnnotation(item, propTextColor.value || "#111111");

    // Le champ "Fond" reste un override explicite du fond du bloc.
    if (propBgColor.dataset.touched === "1") {
      item.bgColor = propBgColor.value ? propBgColor.value : null;
    }

    item.padding = Math.max(0, Math.min(64, Number(propPadding.value) || 0));
    item.fontFamily = propFontFamily.value || "Arial";
    item.fontSize = Math.max(8, Math.min(96, Number(propFontSize.value) || 14));
    captureLastTextStyleFromItem(item);
  } else if (SHAPE_TYPES.has(item.type) && propShapeFill && propShapeFillOpacity && propShapeStroke && propShapeStrokeWidth) {
    const prevFill = item.fillColor;
    const prevStroke = item.strokeColor;
    const prevBackdrop = item.backdropColor;

    item.fillColor = propShapeFill.value || item.fillColor;
    let fillA = clamp(Number(propShapeFillOpacity.value) / 100, 0, 1);
    if (fillA < 0.001 && item.fillColor !== prevFill) {
      fillA = defaultShapeFillAlphaAfterClear(item.type);
      propShapeFillOpacity.value = String(Math.round(fillA * 100));
    }
    item.fillAlpha = fillA;

    item.strokeColor = propShapeStroke.value || item.strokeColor;
    let strokeA = propShapeStrokeOpacity ? clamp(Number(propShapeStrokeOpacity.value) / 100, 0, 1) : 1;
    if (strokeA < 0.001 && item.strokeColor !== prevStroke) {
      strokeA = 1;
      if (propShapeStrokeOpacity) propShapeStrokeOpacity.value = "100";
      if ((Number(item.strokeWidth) || 0) < 1) {
        const w = 2;
        item.strokeWidth = w;
        if (propShapeStrokeWidth) propShapeStrokeWidth.value = String(w);
      }
    }
    if (propShapeStrokeOpacity) item.strokeAlpha = strokeA;

    item.strokeWidth = clamp(Math.floor(Number(propShapeStrokeWidth.value) || 0), 0, 24);
    if (propShapeBackdrop && propShapeBackdropOpacity) {
      let bda = clamp(Number(propShapeBackdropOpacity.value) / 100, 0, 1);
      const newBd = propShapeBackdrop.value;
      if (bda < 0.001 && newBd && newBd !== prevBackdrop) {
        bda = 0.3;
        propShapeBackdropOpacity.value = "30";
      }
      item.backdropAlpha = bda;
      if (item.backdropAlpha < 0.001) {
        item.backdropColor = null;
      } else {
        item.backdropColor = newBd || item.backdropColor || "#ffffff";
      }
    }
  }
  renderAnnotations();
  session.scheduleAutoSave();
}

function applySelectedPropertiesLive() {
  const item = getSelectedAnnotation();
  if (!item) return;
  applySelectedProperties();
}

/** Comportement historique (36f53ac) : toucher « Fond » puis appliquer (sinon applySelectedProperties ignore le fond). */
function markBgTouchedAndApply() {
  try {
    propBgColor.dataset.touched = "1";
    propBgColorLabel?.classList?.remove?.("is-transparent");
  } catch {}
  applySelectedPropertiesLive();
}

/**
 * Même effet que les boutons « Valider » du panneau (clic programmatique = mêmes handlers que l'utilisateur).
 * À l'ouverture du nuancier (mani-color-open), la sélection peut être perdue : on la sauvegarde.
 */
function clickManiColorValidateButtonForInputId(id) {
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
  const btnId = map[id];
  if (!btnId) {
    logText("maniColorValidateClickMapMiss", { id });
    return false;
  }
  const btn = document.getElementById(btnId);
  if (!btn) {
    logText("maniColorValidateBtnMissing", { id, btnId });
    return false;
  }
  btn.click();
  logText("maniColorValidateBtnClicked", { id, btnId });
  return true;
}

function applyManiColorAfterPicker(inputEl) {
  try {
    const id = inputEl?.id || "";
    const hex = String(inputEl?.value || "").trim();
    logText("maniColorApply", {
      id,
      v: hex,
      selectedId: state.selectedAnnotationId,
      backup: globalThis.__maniColorSelectionBackup,
      shapeCtx: sim.getShapeCtxMenuTargetId(),
      textCtx: tcm.getTextCtxMenuTargetId(),
      propShapeFillEl: Boolean(propShapeFill),
      propShapeStrokeWEl: Boolean(propShapeStrokeWidth)
    });
    try {
      window.maniPdfApi?.log?.("maniColorApply", {
        id,
        selectedId: state.selectedAnnotationId,
        backup: globalThis.__maniColorSelectionBackup
      });
    } catch {
      /* ignore */
    }
    if (!id) return;

    if (id === "propBgColor" && propBgColor) {
      propBgColor.dataset.touched = "1";
    }
    if (id === "ctxTextBg") {
      const bg = document.getElementById("ctxTextBg");
      if (bg) bg.dataset.ctxTouched = "1";
    }
    if (id === "ctxShapeBackdrop") {
      const bd = document.getElementById("ctxShapeBackdrop");
      if (bd) bd.dataset.ctxTouched = "1";
    }

    if (id === "ctxTextColor" || id === "ctxTextBg") {
      if (!tcm.getTextCtxMenuTargetId() && globalThis.__maniCtxTextBackup) {
        tcm.setTextCtxMenuTargetId(globalThis.__maniCtxTextBackup);
        logText("maniColorRestoreTextCtx", { textCtxMenuTargetId: tcm.getTextCtxMenuTargetId() });
      }
      try {
        tcm.ensureTextAnnotationCtxMenuEl()?.classList?.remove?.("hidden");
      } catch {
        /* ignore */
      }
      logText("maniColorBranchCtxText", { id, textCtxMenuTargetId: tcm.getTextCtxMenuTargetId(), hex });
      try {
        if (!clickManiColorValidateButtonForInputId(id)) {
          logText("maniColorCtxTextFallbackApply", { id });
          tcm.applyTextCtxMenuBoxProps();
        }
        window.maniPdfApi?.log?.("maniColor ctx text applied", { id, via: "clickOrFallback" });
      } catch (e) {
        try {
          tcm.applyTextCtxMenuBoxProps();
        } catch {
          /* ignore */
        }
      }
      globalThis.__maniCtxTextBackup = undefined;
      return;
    }
    if (id.startsWith("ctxShape")) {
      if (!sim.getShapeCtxMenuTargetId() && globalThis.__maniCtxShapeBackup) {
        sim.setShapeCtxMenuTargetId(globalThis.__maniCtxShapeBackup);
        logText("maniColorRestoreShapeCtx", { shapeCtxMenuTargetId: sim.getShapeCtxMenuTargetId() });
      }
      try {
        sim.ensureShapeAnnotationCtxMenuEl()?.classList?.remove?.("hidden");
      } catch {
        /* ignore */
      }
      logText("maniColorBranchCtxShape", { id, shapeCtxMenuTargetId: sim.getShapeCtxMenuTargetId(), hex });
      try {
        if (!clickManiColorValidateButtonForInputId(id)) {
          logText("maniColorCtxShapeFallbackApply", { id });
          sim.applyShapeCtxMenuProps();
        }
        window.maniPdfApi?.log?.("maniColor ctx shape applied", { id, via: "clickOrFallback" });
      } catch (e) {
        try {
          sim.applyShapeCtxMenuProps();
        } catch {
          /* ignore */
        }
      }
      globalThis.__maniCtxShapeBackup = undefined;
      return;
    }

    const tab = getActiveTab();
    if (!tab) {
      logText("maniColorNoTab", { id });
      return;
    }

    const beforeSel = state.selectedAnnotationId;
    if (!getSelectedAnnotation() && globalThis.__maniColorSelectionBackup != null && globalThis.__maniColorSelectionBackup !== "") {
      state.selectedAnnotationId = globalThis.__maniColorSelectionBackup;
      logText("maniColorRestoreSel", { from: beforeSel, to: state.selectedAnnotationId });
    }
    globalThis.__maniColorSelectionBackup = undefined;

    const item = getSelectedAnnotation();
    logText("maniColorBeforeApplySelected", {
      hasItem: Boolean(item),
      type: item?.type,
      branchShape: Boolean(item && SHAPE_TYPES.has(item.type) && propShapeFill && propShapeFillOpacity)
    });

    if (!item) {
      logText("maniColorNoItem", { id, selectedId: state.selectedAnnotationId });
      return;
    }

    try {
      if (!clickManiColorValidateButtonForInputId(id)) {
        applySelectedProperties();
      }
      const after = getSelectedAnnotation();
      window.maniPdfApi?.log?.("maniColor panel validate click", {
        id,
        type: item.type,
        textColor: after?.type === "text" ? after.textColor : undefined,
        fillColor: after && SHAPE_TYPES.has(after.type) ? after.fillColor : undefined,
        propTextVal: id === "propTextColor" ? propTextColor?.value : undefined
      });
      logText("maniColorPanelDone", {
        id,
        type: item.type,
        textColor: after?.type === "text" ? after.textColor : undefined,
        fillColor: after && SHAPE_TYPES.has(after.type) ? after.fillColor : undefined
      });
    } catch (e) {
      try {
        applySelectedProperties();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    logText("maniColorCommitErr", { err: String(e) });
  }
}

document.addEventListener("mani-color-open", (ev) => {
  globalThis.__maniColorSelectionBackup = state.selectedAnnotationId;
  globalThis.__maniCtxShapeBackup = sim.getShapeCtxMenuTargetId();
  globalThis.__maniCtxTextBackup = tcm.getTextCtxMenuTargetId();
  const field = ev.detail?.inputId;
  if (field === "propTextColor" || field === "ctxTextColor") {
    if (!globalThis.__maniTextColorRangeBackup) {
      captureTextColorSelectionBackup();
    }
  } else {
    globalThis.__maniTextColorRangeBackup = null;
  }
  logText("maniColorPickerOpen", {
    backup: globalThis.__maniColorSelectionBackup,
    shapeCtxBackup: globalThis.__maniCtxShapeBackup,
    textCtxBackup: globalThis.__maniCtxTextBackup,
    field: ev.detail?.inputId
  });
});

document.addEventListener("mani-color-capture-text-selection", () => {
  captureTextColorSelectionBackup();
});

globalThis.maniAfterColorCommit = applyManiColorAfterPicker;

document.addEventListener("mani-color-close", () => {
  globalThis.__maniTextColorRangeBackup = null;
});

function pageShift(delta) {
  const tab = getActiveTab();
  if (!tab) return;
  const next = (tab.currentPage || 1) + delta;
  const max = tab.pageCount ? Math.max(1, tab.pageCount) : next;
  tab.currentPage = clamp(next, 1, max);
  pdfv.setActivePage(tab.currentPage);
  const active = pagesContainer?.querySelector?.(`.pdf-page[data-page="${tab.currentPage}"]`);
  pdfv.runWithScrollSyncPaused(() => {
    active?.scrollIntoView?.({ block: "start", inline: "nearest" });
  });
}


/** URL data: pour afficher une image restaurée depuis session (src_base64 sans blob:). */
function imageAnnotationDisplaySrc(a) {
  if (a?.src) return a.src;
  if (a?.src_base64) {
    const mime = String(a.mimeType || "image/png").trim() || "image/png";
    return `data:${mime};base64,${a.src_base64}`;
  }
  return "";
}

/** Délègue à `__editifyPdfSave` — point d'entrée UI (toolbar, Ctrl+S, menu). */
async function savePdfAs() {
  return pdfSave.savePdfAs();
}

chrome.bind({
  blankCanvasCtxMenu,
  aboutPopover,
  toolbarAboutBtn,
  toolbarOptionsBtn,
  aboutVersion,
  appToolbar,
  pdfToolsBtn,
  pdfToolsMenu,
  toolbarFileBtn,
  toolbarFileMenu,
  toolbarOptionsMenu,
  welcomeOpenPdfBtn,
  toolbarOpenPdfBtn,
  toolbarSaveAsBtn,
  toolbarHtmlToPdfBtn,
  toolbarImagesToPdfBtn,
  toolbarQuitBtn,
  toolbarCloseBtn,
  toolbarAboutMenuItem,
  aboutCloseBtn,
  getActiveTab,
  capturePointerInPage,
  clamp,
  hideChangesContextMenu,
  tcm,
  sim,
  setStatus,
  t,
  promptOpenPdf,
  savePdfAs,
  setLanguage,
  logText
});

sessionLogUi.bind({
  sessionLogModal,
  sessionLogBody,
  sessionLogCloseBtn,
  sessionLog,
  t,
  chrome,
  toolbarSessionLogMenuItem
});

logFileSettingsUi.bind({
  logFileSettingsModal,
  logFileSettingsTitleEl,
  logFileSettingsHint,
  logFilePathDisplay,
  logFileDefaultPathDisplay,
  logFileEnvOverride,
  logFileBrowseBtn,
  logFileResetBtn,
  logFileCloseBtn,
  toolbarLogFileMenuItem,
  t,
  setStatus,
  chrome
});

updateUi.bind({
  updateAvailableBanner,
  updateBannerText,
  updateBannerDownloadBtn,
  updateBannerDismissBtn,
  toolbarCheckUpdatesMenuItem,
  toolbarCheckUpdatesStartupBtn,
  t,
  setStatus,
  chrome
});

i18nApply.bind({
  t,
  getActiveTab,
  pdfv,
  ensureToastRoot,
  shapeGrid,
  blankAddTextBtn,
  blankAddShapeBtn,
  blankAddImageBtn,
  addTextBtn,
  addShapeBtn,
  addImageBtn,
  deleteSelectedBtn,
  undoBtn,
  redoBtn,
  rotateLeftBtn,
  rotateRightBtn,
  applyPropsBtn,
  validateTextColorBtn,
  applyBgBtn,
  validateShapeFillBtn,
  validateShapeStrokeBtn,
  validateShapeBackdropBtn,
  toolbarFileBtn,
  toolbarOptionsBtn,
  menuLangLabel,
  menuToolsLabel,
  menuInfoLabel,
  toolbarOpenPdfBtn,
  toolbarSaveAsBtn,
  toolbarHtmlToPdfBtn,
  toolbarImagesToPdfBtn,
  toolbarQuitBtn,
  toolbarAboutMenuItem,
  toolbarSessionLogMenuItem,
  toolbarLogFileMenuItem,
  menuUpdatesLabel,
  toolbarCheckUpdatesMenuItem,
  toolbarCheckUpdatesStartupBtn,
  sessionLogTitleEl,
  sessionLogHint,
  logFileSettingsTitleEl,
  logFileSettingsHint,
  logFileCurrentPathLabel,
  logFileDefaultPathLabel,
  logFileBrowseBtn,
  logFileResetBtn,
  logFileCloseBtn,
  sessionLogCloseBtn,
  thumbsTitle,
  changesTitle,
  prevBtn,
  nextBtn,
  aboutRgpd,
  aboutTitleEl,
  aboutCreditsEl,
  mergeBtn,
  splitBtn,
  pageInfo,
  toolbarF10Hint,
  shapeModal,
  splitWorkspaceAddGroupBtn,
  splitWorkspaceValidateBtn,
  splitWorkspaceCloseBtn,
  thumbsBar,
  changesBar,
  appToolbar,
  aboutPopover,
  toolbarAboutBtn,
  aboutCloseBtn,
  closeShapeModalBtn
});

// Ouverture PDF via menu natif (File > Open PDF) et raccourci clavier (Ctrl+O).

prevBtn?.addEventListener?.("click", () => pageShift(-1));
nextBtn?.addEventListener?.("click", () => pageShift(1));
addTextBtn?.addEventListener?.("click", () => {
  commitActiveTextEditIfNeeded(null);
  addAnnotation("text");
});
addShapeBtn?.addEventListener?.("click", openShapePicker);
addImageBtn?.addEventListener?.("click", () => imageInput?.click?.());
blankAddTextBtn?.addEventListener?.("click", () => {
  chrome.hideBlankCanvasCtxMenu();
  commitActiveTextEditIfNeeded(null);
  addAnnotation("text");
});
blankAddShapeBtn?.addEventListener?.("click", () => {
  chrome.hideBlankCanvasCtxMenu();
  openShapePicker();
});
blankAddImageBtn?.addEventListener?.("click", () => {
  chrome.hideBlankCanvasCtxMenu();
  imageInput?.click?.();
});
imageInput?.addEventListener?.("change", (event) => {
  const file = event.target.files?.[0];
  imageInput.value = "";
  if (!file) return;
  void (async () => {
    try {
      const src = URL.createObjectURL(file);
      const mimeType = String(file.type || "image/png").trim() || "image/png";
      let src_base64;
      try {
        src_base64 = await pdfSave.readImageFileAsBase64(file);
      } catch {
        src_base64 = undefined;
      }
      addAnnotation("image", {
        src,
        fileName: file.name || null,
        mimeType,
        ...(src_base64 ? { src_base64 } : {})
      });
    } catch {
      setStatus(t("stExportImageEncodeFailed"));
    }
  })();
});
deleteSelectedBtn?.addEventListener?.("click", deleteSelected);
undoBtn?.addEventListener?.("click", undo);
redoBtn?.addEventListener?.("click", redo);
applyPropsBtn?.addEventListener?.("click", applySelectedProperties);
validateTextColorBtn?.addEventListener?.("mousedown", (ev) => {
  ev.preventDefault();
  captureTextColorSelectionBackup();
});
validateTextColorBtn?.addEventListener?.("click", () => applySelectedProperties());
applyBgBtn?.addEventListener?.("click", () => {
  try {
    propBgColor.dataset.touched = "1";
    propBgColorLabel?.classList?.remove?.("is-transparent");
  } catch {}
  applySelectedProperties();
});
// Champs hidden + nuancier : input/change déclenchés au commit ; « Valider » panneau / modale pour figer sur l'annotation.
propTextColor?.addEventListener?.("input", applySelectedPropertiesLive);
propBgColor?.addEventListener?.("input", markBgTouchedAndApply);
propBgColor?.addEventListener?.("change", markBgTouchedAndApply);
propShapeFill?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeFill?.addEventListener?.("change", applySelectedPropertiesLive);
propShapeStroke?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeStroke?.addEventListener?.("change", applySelectedPropertiesLive);
propShapeBackdrop?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeBackdrop?.addEventListener?.("change", applySelectedPropertiesLive);
propWidth?.addEventListener?.("input", applySelectedPropertiesLive);
propHeight?.addEventListener?.("input", applySelectedPropertiesLive);
propRotation?.addEventListener?.("input", applySelectedPropertiesLive);
propOpacity?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeFillOpacity?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeStrokeWidth?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeStrokeOpacity?.addEventListener?.("input", applySelectedPropertiesLive);
propShapeBackdropOpacity?.addEventListener?.("input", applySelectedPropertiesLive);

validateShapeFillBtn?.addEventListener?.("click", () => applySelectedProperties());
validateShapeStrokeBtn?.addEventListener?.("click", () => applySelectedProperties());
validateShapeBackdropBtn?.addEventListener?.("click", () => applySelectedProperties());

propPadding?.addEventListener?.("input", applySelectedPropertiesLive);
propFontFamily?.addEventListener?.("change", applySelectedPropertiesLive);
propFontSize?.addEventListener?.("input", applySelectedPropertiesLive);
mergeBtn?.addEventListener?.("click", () => {
  chrome.closeAllFlyoutMenus();
  void jobs.createMergeJob();
});
splitBtn?.addEventListener?.("click", () => {
  chrome.closeAllFlyoutMenus();
  jobs.createSplitJob();
});
closeShapeModalBtn?.addEventListener?.("click", closeShapePicker);
shapeModal?.addEventListener?.("mousedown", (event) => {
  if (event.target === shapeModal) closeShapePicker();
});
shapeGrid?.addEventListener?.("click", (event) => {
  const btn = event.target.closest("button[data-shape]");
  if (!btn) return;
  addShapeByType(btn.dataset.shape);
});

window.maniPdfApi?.onOpenFromMenu?.(async (filePath) => {

  const name = filePath.split("\\").pop() || "document.pdf";
  await addPdfTab(filePath, name);
});

// Options > Langue (menu natif)
window.maniPdfApi?.onSetLanguage?.((lang) => {
  try {
    setLanguage(lang);
  } catch {}
});

window.maniPdfApi?.onSaveAsRequested?.(() => {
  savePdfAs().catch((error) => {
    pdfSave.logSave("save_menu_exception", { error: String(error?.message || error) });
  });
});
window.maniPdfApi?.onAutosaveRequested?.(() => {
  session.saveSession().catch(() => {});
});

// Quitte le mode edition texte uniquement si clic en dehors de la case texte en edition.
document.addEventListener("mousedown", (event) => {
  // Clic gauche uniquement: on ne veut pas casser le menu contextuel.
  if (event.button !== 0) return;
  // Si on n'édite pas, un clic dans le document hors annotation doit désélectionner.
  if (!state.editingAnnotationId) {
    if (!state.selectedAnnotationId) return;
    const inViewer = !!event.target?.closest?.(".viewer");
    if (!inViewer) return;
    const clickedId = event.target?.closest?.("[data-id]")?.getAttribute?.("data-id") || null;
    if (clickedId) return;
    state.selectedAnnotationId = null;
    syncPropertyInputs();
    renderAnnotations();
    return;
  }
  if (shouldPreserveTextEditOnOutsideClick(event.target)) return;
  const editingNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${state.editingAnnotationId}"]`);
  if (!editingNode) return;
  // IMPORTANT: si l'événement provient de l'annotation en édition (même avant rerender),
  // le composedPath contient l'ancien node avec le bon data-id. Ça évite de quitter
  // l'édition immédiatement quand on bascule en édition sur mousedown/dblclick.
  try {
    const path = event.composedPath?.() || [];
    const editingId = String(state.editingAnnotationId);
    const hit = path.some((el) => {
      try {
        return el?.getAttribute?.("data-id") === editingId;
      } catch {
        return false;
      }
    });
    if (hit) return;
  } catch {}
  if (editingNode.contains(event.target)) return;

  // On clique hors du champ texte: on sort du mode édition et on persiste le contenu.
  const tab = getActiveTab();
  if (tab) {
    try {
      const id = state.editingAnnotationId;
      const item = findAnnotationLocation(tab, id)?.item || null;
      const ed = getAnnotationTextEditor(editingNode);
      if (item && item.type === "text" && ed) {
        captureSnapshot(tab);
        syncTextFromEditor(item, ed);
        finalizeTextAnnotationLayout(item);
      }
    } catch {}
    session.scheduleAutoSave();
  }

  state.editingAnnotationId = null;
  // Si on clique hors cadre, la fenêtre ne doit plus être sélectionnée (plus de contour bleu).
  // Mais si on clique sur une AUTRE annotation, on laisse le gestionnaire de click
  // appliquer la sélection correspondante.
  try {
    const clickedId = event.target?.closest?.("[data-id]")?.getAttribute?.("data-id") || null;
    if (!clickedId) {
      state.selectedAnnotationId = null;
    }
  } catch {
    state.selectedAnnotationId = null;
  }
  try {
    document.activeElement?.blur?.();
  } catch {}
  renderAnnotations();
});

function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "input") {
    const type = String(target.type || "").toLowerCase();
    // file / boutons : pas de saisie clavier — ne pas bloquer Ctrl+S, etc.
    if (type === "file" || type === "button" || type === "submit" || type === "reset") {
      return false;
    }
  }
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

document.addEventListener(
  "keydown",
  (event) => {
  if (event.key === "F10") {
    event.preventDefault();
    event.stopPropagation();
    chrome.toggleHtmlToolbarF10("renderer-keydown");
    return;
  }

  if (event.key === "Escape" && !shapeModal.classList.contains("hidden")) {
    event.preventDefault();
    closeShapePicker();
    return;
  }

  if (event.key === "Escape") {
    const anyFlyout =
      (pdfToolsMenu && !pdfToolsMenu.classList.contains("hidden")) ||
      (toolbarFileMenu && !toolbarFileMenu.classList.contains("hidden")) ||
      (toolbarOptionsMenu && !toolbarOptionsMenu.classList.contains("hidden"));
    if (anyFlyout) {
      event.preventDefault();
      chrome.closeAllFlyoutMenus();
      return;
    }
  }

  // E6-S2: en mode édition texte, ESC doit terminer l'édition (sans perdre le texte).
  if (event.key === "Escape" && state.editingAnnotationId) {
    event.preventDefault();
    const tab = getActiveTab();
    if (tab) {
      try {
        const id = state.editingAnnotationId;
        const annos = currentPageAnnotations(tab);
        const item = annos.find((a) => a.id === id);
        const editingNode = pdfLayerRef.annotationLayer?.querySelector?.(`[data-id="${id}"]`);
        const edEsc = getAnnotationTextEditor(editingNode);
        if (item && item.type === "text" && edEsc) {
          captureSnapshot(tab);
          syncTextFromEditor(item, edEsc);
          finalizeTextAnnotationLayout(item);
          session.scheduleAutoSave();
        }
      } catch {}
    }
    state.editingAnnotationId = null;
    state.selectedAnnotationId = null;
    try {
      document.activeElement?.blur?.();
    } catch {}
    syncPropertyInputs();
    renderAnnotations();
    return;
  }

  if (isTypingContext(event.target) || state.editingAnnotationId) return;

  const key = event.key.toLowerCase();

  // Clipboard (Ctrl+C / Ctrl+X / Ctrl+V) pour annotations
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "c") {
    const tab = getActiveTab();
    const item = getSelectedAnnotationFromActivePage(tab);
    if (!tab || !item) return;
    event.preventDefault();
    // On copie toutes les props au moment du Ctrl+C
    const copy = cloneForClipboard(item);
    if (!copy) return;
    state.clipboard = copy;
    setStatus("Élément copié");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "x") {
    const tab = getActiveTab();
    const annotations = tab ? currentPageAnnotations(tab) : null;
    const item = getSelectedAnnotationFromActivePage(tab);
    if (!tab || !annotations || !item) return;
    event.preventDefault();
    const cut = cloneForClipboard(item);
    if (!cut) return;
    state.clipboard = cut;
    const idx = annotations.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      captureSnapshot(tab);
      annotations.splice(idx, 1);
      state.selectedAnnotationId = null;
      state.editingAnnotationId = null;
      syncPropertyInputs();
      renderAnnotations();
      session.scheduleAutoSave();
    }
    setStatus("Élément coupé");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "v") {
    if (!state.clipboard) return;
    event.preventDefault();
    pasteClipboardIntoActivePage();
    setStatus("Élément collé");
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z") {
    event.preventDefault();
    undo();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (key === "y" || (event.shiftKey && key === "z"))) {
    event.preventDefault();
    redo();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "s") {
    event.preventDefault();
    savePdfAs().catch((error) => {
      pdfSave.logSave("save_shortcut_exception", { error: String(error?.message || error) });
    });
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "o") {
    event.preventDefault();
    promptOpenPdf();
    return;
  }

  if (
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown"
  ) {
    if (tryHandleSelectedAnnotationArrowKey(event)) return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pageShift(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    pageShift(1);
  }
  },
  true
);

window.addEventListener("blur", () => {
  if (activePointerCleanup) activePointerCleanup();
});

loadPreferredLanguage();
try {
  window.initManiColorPickers?.();
} catch {
  /* ignore */
}
try {
  window.wireManiFloatingCtxMenus?.();
} catch {
  /* ignore */
}
i18nApply.applyLanguage();
applySpellcheckLanguageBestEffort();
void updateUi.init();
try {
  window.maniPdfApi?.notifyUiLanguage?.(state.language);
} catch {
  /* ignore */
}
tcm.wireTextAnnotationCtxMenu();
document.addEventListener("selectionchange", () => {
  try {
    if (!tcm.getTextCtxMenuTargetId()) return;
    const menu = tcm.ensureTextAnnotationCtxMenuEl();
    if (!menu || menu.classList.contains("hidden")) return;
    tcm.syncCtxTextFormatButtons();
    void tcm.refreshTextSpellContextMenu();
  } catch {
    /* ignore */
  }
});
setInterval(() => {
  try {
    tcm.runBackgroundSpellScanForTextAnnotations();
  } catch {
    /* ignore */
  }
}, 6000);
setTimeout(() => {
  try {
    tcm.runBackgroundSpellScanForTextAnnotations();
  } catch {
    /* ignore */
  }
}, 800);
sim.wireShapeAnnotationCtxMenu();
sim.wireImageAnnotationCtxMenu();
try {
  window.maniPdfApi?.onPdfToolAction?.((action) => {
    chrome.closeAllFlyoutMenus();
    if (action === "merge") void jobs.createMergeJob();
    else if (action === "split") jobs.createSplitJob();
  });
} catch {
  /* ignore */
}
try {
  window.maniPdfApi?.onAboutRequested?.(() => {
    chrome.showAboutPopoverNearOptions();
  });
} catch {
  /* ignore */
}
try {
  window.maniPdfApi?.onSessionLogRequested?.(() => {
    chrome.closeAllFlyoutMenus();
    sessionLogUi.open();
  });
  window.maniPdfApi?.onLogFileSettingsRequested?.(() => {
    chrome.closeAllFlyoutMenus();
    logFileSettingsUi.open();
  });
} catch {
  /* ignore */
}
chrome.syncFullscreenFromMain().catch(() => {});
pdfv.updateZoomUI();
updateWelcomeVisibility();
session.loadSession().catch(() => {});
jobs.refreshJobs();
jobs.refreshSensitiveActions();
jobs.refreshPythonHealth();
pdfv.setupDragAndDrop();
setInterval(() => {
  void jobs.refreshJobs();
}, 1000);
setInterval(() => {
  void jobs.refreshSensitiveActions();
}, 2000);

// E2E helpers (best-effort, sans dépendance au main process)
try {
  e2eHelpers.bind({
    state,
    getActiveTab,
    cancelPointerInteraction,
    pagesContainer,
    renderTabs,
    pdfv,
    updateWelcomeVisibility,
    syncPropertyInputs,
    setStatus,
    t,
    cloneForClipboard,
    getSelectedAnnotationFromActivePage,
    currentPageAnnotations,
    captureSnapshot,
    renderAnnotations,
    session,
    addAnnotation,
    SHAPE_TYPES,
    newAnnotationId,
    findAnnotationLocation,
    fitAnnotationToSafeZone,
    getSafeZoneSize,
    tcm,
    pasteClipboardIntoActivePage,
    clickManiColorValidateButtonForInputId,
    setLanguage,
    undo,
    exportActivePdfToPath: pdfSave.exportActivePdfToPath,
    peekExportPayloadForTest: pdfSave.peekExportPayloadForTest
  });
} catch {}
