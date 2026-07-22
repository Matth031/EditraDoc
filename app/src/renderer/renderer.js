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
 * - `renderer-shape-vector.js` : types / defaults / rendu SVG formes (`window.__editifyShapeVector`).
 * - `renderer-text-layout.js` : mesure / wrap / auto-grow / sizing export texte (`window.__editifyTextLayout`).
 * - `renderer-annotation-props.js` : panneau propriétés, application live, nuancier Mani (`window.__editifyAnnotationProps`).
 * - `renderer-tabs.js` : onglets, fermeture, undo toast S6 (`window.__editifyTabs`, `bind()` avant `session.bind()`).
 * - `renderer-annotation-history.js` : snapshots undo/redo + finishUndoRedoUi (`window.__editifyAnnotationHistory`).
 * - `renderer-annotations.js` : rendu / drag / resize / add / paste / delete (`window.__editifyAnnotations`, `bind()` après `historyMod.bind()`).
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
if (!window.__editifyShapeVector) {
  throw new Error("[editify] Charger renderer-shape-vector.js avant renderer.js (voir index.html).");
}
if (!window.__editifyTextLayout) {
  throw new Error("[editify] Charger renderer-text-layout.js avant renderer.js (voir index.html).");
}
if (!window.__editifyAnnotationProps) {
  throw new Error("[editify] Charger renderer-annotation-props.js avant renderer.js (voir index.html).");
}
if (!window.__editifyTabs) {
  throw new Error("[editify] Charger renderer-tabs.js avant renderer.js (voir index.html).");
}
if (!window.__editifyAnnotationHistory) {
  throw new Error(
    "[editify] Charger renderer-annotation-history.js avant renderer.js (voir index.html)."
  );
}
if (!window.__editifyAnnotations) {
  throw new Error(
    "[editify] Charger renderer-annotations.js avant renderer.js (voir index.html)."
  );
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
const {
  SHAPE_TYPES,
  mergeShapeStyleFields,
  defaultShapeFillAlphaAfterClear,
  renderShapeVectorDOM
} = window.__editifyShapeVector;
const textLayout = window.__editifyTextLayout;
const annotationProps = window.__editifyAnnotationProps;
const tabsMod = window.__editifyTabs;
const historyMod = window.__editifyAnnotationHistory;
const annotationsMod = window.__editifyAnnotations;
/** Assignées après `bind()` (dépendances état / DOM / texte). */
let scheduleSidebarUpdate;
let renderThumbnails;
let renderChanges;
let syncPropertyInputs;
let applySelectedProperties;
let applySelectedPropertiesLive;
let markBgTouchedAndApply;
let clickManiColorValidateButtonForInputId;

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
/** État pointeur partagé avec `renderer-annotations.js` (drag / resize / double-clic texte). */
const pointer = {
  interactionMode: null, // "drag" | "resize" | "drag-pending" | null
  suppressClickUntil: 0,
  activePointerCleanup: null,
  pendingSingleClickRenderTimer: null,
  lastTextClickAt: 0,
  lastTextClickId: null,
  lastTextMouseDownAt: 0,
  lastTextMouseDownId: null
};

/** Style par défaut des prochaines zones texte (dernière fenêtre texte affichée / modifiée). */
const DEFAULT_TEXT_STYLE = Object.freeze({
  textColor: "#111111",
  bgColor: null,
  padding: 6,
  fontFamily: "Arial",
  fontSize: 14
});
/** Objet mutable partagé avec annotationsMod (ne pas réassigner la référence). */
const lastTextStyle = { ...DEFAULT_TEXT_STYLE };

function captureLastTextStyleFromItem(item) {
  if (!item || item.type !== "text") return;
  lastTextStyle.textColor = item.textColor || DEFAULT_TEXT_STYLE.textColor;
  lastTextStyle.bgColor = item.bgColor ?? null;
  lastTextStyle.padding = Math.max(
    0,
    Math.min(64, Number(item.padding) || DEFAULT_TEXT_STYLE.padding)
  );
  lastTextStyle.fontFamily = item.fontFamily || DEFAULT_TEXT_STYLE.fontFamily;
  lastTextStyle.fontSize = Math.max(
    8,
    Math.min(96, Number(item.fontSize) || DEFAULT_TEXT_STYLE.fontSize)
  );
}

function getNewTextAnnotationDefaults() {
  return annotationsMod.getNewTextAnnotationDefaults();
}

function focusTextAnnotationEditor(annotationId) {
  annotationsMod.focusTextAnnotationEditor(annotationId);
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
// E7: Undo fermeture onglet — voir renderer-tabs.js (pendingTabUndo + toast S6)
// ---------------------------------------

function hasUnsavedRiskForTab(tab) {
  if (!tab) return false;
  if (state.editingAnnotationId) return true;
  return Boolean(tab.dirty);
}

function cancelPointerInteraction() {
  try {
    if (pointer.activePointerCleanup) pointer.activePointerCleanup();
  } catch {}
  pointer.activePointerCleanup = null;
  pointer.interactionMode = null;
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
  return annotationsMod.findAnnotationLocation(tab, id);
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
      if (pointer.interactionMode) return;
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

// Layout texte : renderer-text-layout.js (bind() apres getSafeZoneSize / fitAnnotationToSafeZone).
let getDefaultTextBoxWidth;
let measureLineWidthNoWrap;
let getVirtualTextTailWidth;
let applyTextEditorVirtualTail;
let clearTextEditorVirtualTail;
let getRequiredTextWidth;
let getTextContentRequiredWidth;
let getLiveRequiredTextWidth;
let getInitialTextAnnotationSize;
let getRequiredTextHeight;
let getRequiredTextHeightForWidth;
let getMinWidthToFitHeight;
let getTextWrapState;
let finalizeTextAnnotationLayout;
let annotationHasExplicitLineBreaks;
let ensureTextAnnotationsSizedForExport;
let applyTextEditorLayoutStyles;
let applyEditingTextAutoGrow;
let applyTextAnnotationBoxSize;
let scheduleAutoGrowText;

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

/**
 * Dictionnaires i18n : données dans renderer-i18n-data.js (chargé avant ce script).
 * Ancien emplacement : bloc const I18N = { ... } ici - supprimé après extraction (git pour historique).
 */
const I18N = window.__EDITIFY_I18N;
if (!I18N || typeof I18N !== "object") {
  throw new Error("renderer-i18n-data.js doit etre charge avant renderer.js (voir index.html).");
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

window.__editifyAnnotationProps.bind({
  state,
  getActiveTab,
  getSelectedAnnotation,
  captureSnapshot,
  renderAnnotations,
  scheduleAutoSave: () => session.scheduleAutoSave(),
  captureLastTextStyleFromItem,
  applyTextColorToTextAnnotation,
  captureTextColorSelectionBackup,
  clamp,
  SHAPE_TYPES,
  mergeShapeStyleFields,
  defaultShapeFillAlphaAfterClear,
  logText,
  tcm,
  sim,
  textPropsPanel,
  shapePropsPanel,
  propWidth,
  propHeight,
  propRotation,
  propOpacity,
  propTextColor,
  propBgColor,
  propBgColorLabel,
  propPadding,
  propFontFamily,
  propFontSize,
  propShapeFill,
  propShapeFillOpacity,
  propShapeStroke,
  propShapeStrokeOpacity,
  propShapeStrokeWidth,
  propShapeBackdrop,
  propShapeBackdropOpacity
});
syncPropertyInputs = annotationProps.syncPropertyInputs;
applySelectedProperties = annotationProps.applySelectedProperties;
applySelectedPropertiesLive = annotationProps.applySelectedPropertiesLive;
markBgTouchedAndApply = annotationProps.markBgTouchedAndApply;
clickManiColorValidateButtonForInputId = annotationProps.clickManiColorValidateButtonForInputId;
annotationProps.wireManiColorHandlers();

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
  return historyMod.getTabSnapshotState(tab);
}

function captureSnapshot(tab) {
  historyMod.captureSnapshot(tab);
}

function applySnapshot(tab, snapshot) {
  return historyMod.applySnapshot(tab, snapshot);
}

function renderAnnotations() {
  annotationsMod.renderAnnotations();
}

function startDrag(event, id) {
  annotationsMod.startDrag(event, id);
}

function startResize(event, id, mode = "br") {
  annotationsMod.startResize(event, id, mode);
}

function computeInsertPositionForNewAnnotation(tab, annotation, zone) {
  annotationsMod.computeInsertPositionForNewAnnotation(tab, annotation, zone);
}

function logAnnotationAudit(action, tab, item, pageKey) {
  annotationsMod.logAnnotationAudit(action, tab, item, pageKey);
}

function addAnnotation(type, extra = {}) {
  annotationsMod.addAnnotation(type, extra);
}

function pasteClipboardIntoActivePage() {
  annotationsMod.pasteClipboardIntoActivePage();
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
  annotationsMod.deleteSelected();
}

function finishUndoRedoUi() {
  historyMod.finishUndoRedoUi();
}

function undo() {
  historyMod.undo();
}

function redo() {
  historyMod.redo();
}

// Panneau propriétés : renderer-annotation-props.js (`syncPropertyInputs`, `applySelectedProperties`, Mani).

window.__editifyTextLayout.bind({
  getSafeZoneSize,
  getSafeZoneSizeForPage,
  fitAnnotationToSafeZone,
  getAnnotationTextEditor,
  getEditingAnnotationId: () => state.editingAnnotationId,
  scheduleAutoSave: () => session.scheduleAutoSave()
});
getDefaultTextBoxWidth = textLayout.getDefaultTextBoxWidth;
measureLineWidthNoWrap = textLayout.measureLineWidthNoWrap;
getVirtualTextTailWidth = textLayout.getVirtualTextTailWidth;
applyTextEditorVirtualTail = textLayout.applyTextEditorVirtualTail;
clearTextEditorVirtualTail = textLayout.clearTextEditorVirtualTail;
getRequiredTextWidth = textLayout.getRequiredTextWidth;
getTextContentRequiredWidth = textLayout.getTextContentRequiredWidth;
getLiveRequiredTextWidth = textLayout.getLiveRequiredTextWidth;
getInitialTextAnnotationSize = textLayout.getInitialTextAnnotationSize;
getRequiredTextHeight = textLayout.getRequiredTextHeight;
getRequiredTextHeightForWidth = textLayout.getRequiredTextHeightForWidth;
getMinWidthToFitHeight = textLayout.getMinWidthToFitHeight;
getTextWrapState = textLayout.getTextWrapState;
finalizeTextAnnotationLayout = textLayout.finalizeTextAnnotationLayout;
annotationHasExplicitLineBreaks = textLayout.annotationHasExplicitLineBreaks;
ensureTextAnnotationsSizedForExport = textLayout.ensureTextAnnotationsSizedForExport;
applyTextEditorLayoutStyles = textLayout.applyTextEditorLayoutStyles;
applyEditingTextAutoGrow = textLayout.applyEditingTextAutoGrow;
applyTextAnnotationBoxSize = textLayout.applyTextAnnotationBoxSize;
scheduleAutoGrowText = textLayout.scheduleAutoGrowText;

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
  shouldPauseScrollPageSync: () => Boolean(pointer.interactionMode || state.editingAnnotationId),
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
tabsMod.bind({
  state,
  tabs,
  pdfv,
  session,
  updateWelcomeVisibility,
  hasUnsavedRiskForTab,
  showToast,
  dismissToast,
  clamp,
  setStatus,
  t,
  tr
});
session.bind({
  state,
  setStatus,
  t,
  renderTabs: tabsMod.renderTabs,
  updateViewer: pdfv.updateViewer,
  updateWelcomeVisibility,
  syncPropertyInputs,
  scheduleSidebarUpdate: window.__editifySidebars.scheduleSidebarUpdate
});
historyMod.bind({
  state,
  getActiveTab,
  syncPropertyInputs,
  renderAnnotations,
  session,
  pdfv
});
annotationsMod.bind({
  state,
  pointer,
  lastTextStyle,
  pdfLayerRef,
  viewer,
  pagesContainer,
  getActiveTab,
  currentPageAnnotations,
  annotationsOnPage,
  captureSnapshot: (tab) => historyMod.captureSnapshot(tab),
  syncPropertyInputs,
  session,
  scheduleSidebarUpdate: () => scheduleSidebarUpdate(),
  wireTextEditorInteraction,
  cancelPointerInteraction,
  captureLastTextStyleFromItem,
  SHAPE_TYPES,
  mergeShapeStyleFields,
  renderShapeVectorDOM,
  setSanitizedHtml,
  getSafeZoneSize,
  getTextWrapState,
  applyTextEditorLayoutStyles,
  applyTextEditorVirtualTail,
  applySpellHighlightsToTextDisplayNode,
  getAnnotationTextEditor,
  scheduleAutoGrowText,
  getSpellcheckBcp47FromUiLang,
  getInitialTextAnnotationSize,
  fitAnnotationToSafeZone,
  getRequiredTextHeightForWidth,
  getMinWidthToFitHeight,
  applyEditingTextAutoGrow,
  newAnnotationId,
  deepClone,
  clamp,
  logText,
  tcm,
  sim,
  hideChangesContextMenu
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
  openPdfAtPath: (filePath, fileName) => tabsMod.addPdfTab(filePath, fileName)
});
imageConvert.bind({
  toolbarImagesToPdfBtn,
  t,
  tr,
  setStatus,
  showToastBrief,
  sessionLog,
  closeMenus: () => chrome.closeAllFlyoutMenus(),
  openPdfAtPath: (filePath, fileName) => tabsMod.addPdfTab(filePath, fileName)
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
  return annotationsMod.imageAnnotationDisplaySrc(a);
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
  promptOpenPdf: () => tabsMod.promptOpenPdf(),
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
  await tabsMod.addPdfTab(filePath, name);
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
    void tabsMod.promptOpenPdf();
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
  if (pointer.activePointerCleanup) pointer.activePointerCleanup();
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
    renderTabs: tabsMod.renderTabs,
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
