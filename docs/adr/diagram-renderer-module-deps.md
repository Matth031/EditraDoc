# Diagramme — dépendances modules renderer (état réel)

**Date :** 2026-07-24  
**Sources vérifiées :** `app/src/renderer/index.html` (ordre `<script>`), `app/src/renderer/renderer.js` (ordre `bind()`).  
**Non-but :** ne représente pas une architecture cible ; uniquement le câblage actuel.

## 1. Chargement scripts (`index.html`)

Ordre réel des scripts renderer (extrait ; libs vendor omises dans le schéma) :

```mermaid
flowchart TD
  subgraph load ["index.html — ordre de chargement"]
    E[renderer-error-log]
    I18N[renderer-i18n-data]
    TH[renderer-text-html]
    TC[renderer-text-ctx]
    TL[renderer-text-layout]
    AP[renderer-annotation-props]
    U[renderer-utils / toast]
    TAB[renderer-tabs]
    HIST[renderer-annotation-history]
    ANN[renderer-annotations]
    KM[renderer-keymap]
    GEO[renderer-geometry]
    SB[renderer-sidebars]
    TCM[renderer-text-ctx-menu]
    SIM[renderer-shape-image-ctx-menu]
    SV[renderer-shape-vector]
    SW[renderer-split-workspace]
    JOB[renderer-jobs]
    CHR[renderer-app-chrome]
    TT[renderer-tooltips]
    SES[renderer-session]
    PDFV[renderer-pdf-viewer]
    PDFS[renderer-pdf-save]
    ROOT[renderer.js]
  end
  E --> I18N --> TH --> TC --> TL --> AP --> U --> TAB --> HIST --> ANN --> KM --> GEO
  GEO --> SB --> TCM --> SIM --> SV --> SW --> JOB --> CHR --> TT --> SES --> PDFV --> PDFS --> ROOT
```

Note : à ce stade les IIFE s’enregistrent sur `window.__editify…` ; **aucun `bind()`** n’a encore eu lieu sauf auto-init éventuelle absente — le câblage est dans `renderer.js`.

## 2. Composition root — ordre de `bind()` (`renderer.js`)

Ordre réel des appels `*.bind(...)` (et `keymapMod.wire()`), tel que dans le fichier :

```mermaid
flowchart TD
  R[renderer.js composition root<br/>possède state / pdfLayerRef / pointer]
  R --> B1[annotationProps.bind]
  R --> B2[geometryMod.bind]
  R --> B3[textLayout.bind]
  R --> B4[sidebars.bind]
  R --> B5[pdfv.bind]
  R --> B6[pdfSave.bind]
  R --> B7[tabsMod.bind]
  R --> B8[session.bind]
  R --> B9[historyMod.bind]
  R --> B10[annotationsMod.bind]
  R --> B11[sim.bind]
  R --> B12[tcm.bind]
  R --> B13[jobs.bind]
  R --> B14[htmlConvert / imageConvert / pageRotate.bind]
  R --> B15[sw.bind]
  R --> B16[tooltips.bind]
  R --> B17[chrome.bind]
  R --> B18[sessionLogUi / logFileSettings / updateUi / i18nApply.bind]
  R --> B19[keymapMod.bind + wire]
  R --> B20[e2eHelpers.bind]
  B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7 --> B8 --> B9 --> B10
  B10 --> B11 --> B12 --> B13 --> B14 --> B15 --> B16 --> B17 --> B18 --> B19 --> B20
```

Contraintes explicites dans les commentaires du code :

- `annotationsMod.bind` **après** `historyMod.bind` (injection `captureSnapshot`).
- `sim.bind` **avant** `tcm.bind`.
- `jobs.bind` **avant** `sw.bind` (`enqueuePdfJob`).
- `pdfv.bind` après sidebars ; `session.bind` après tabs + pdfv.
- `geometryMod.bind` **avant** `textLayout.bind` (safe-zone / fit).
- `keymap` en fin (après chrome / undo / save câblés).

## 3. Dépendances runtime via `bind()` (extraits structurants)

Flèches = « A reçoit / appelle B via deps injectées » (pas d’import ESM).

```mermaid
flowchart LR
  subgraph root ["Possédés par renderer.js"]
    STATE[state]
    DOM[pdfLayerRef / viewer / DOM nodes]
  end

  GEO[geometry]
  TL[text-layout]
  HIST[annotation-history]
  ANN[annotations]
  PDFV[pdf-viewer]
  PDFS[pdf-save]
  SES[session]
  TABS[tabs]
  SB[sidebars]
  SV[shape-vector]
  KM[keymap]
  JOBS[jobs]
  SW[split-workspace]
  CHROME[app-chrome]

  STATE --> GEO
  STATE --> HIST
  STATE --> ANN
  STATE --> PDFV
  STATE --> SES
  STATE --> TABS
  STATE --> KM

  GEO -->|fit / clamp / safe-zone| TL
  GEO -->|fit / clamp| ANN
  GEO -->|enforceSafeZone| PDFV
  SV -->|SHAPE_TYPES / renderShapeVectorDOM| ANN
  HIST -->|captureSnapshot| ANN
  HIST -->|finishUndoRedoUi → render / sync / session| SES
  TL -->|mesure / auto-grow| ANN
  ANN -->|renderAnnotations| PDFV
  SB -->|scheduleSidebarUpdate| PDFV
  SB -->|scheduleSidebarUpdate| SES
  PDFV -->|updateViewer / convertCanvasRect| PDFS
  PDFV -->|rerenderPages| HIST
  TABS -->|renderTabs| SES
  JOBS -->|enqueuePdfJob| SW
  CHROME -->|menus / open / save| TABS
  KM -->|undo/redo/save/pageShift| HIST
  KM --> CHROME
```

### Lecture courte (F04 cœur)

| Module | Dépend surtout de (injecté) |
|--------|-----------------------------|
| **geometry** | `state` via getActiveTab, `SHAPE_TYPES`, render/sync |
| **text-layout** | geometry (safe-zone/fit), `state.editingAnnotationId`, session |
| **annotation-history** | `state`, getActiveTab, pdfv.rerenderPages, session, sync/render |
| **annotations** | history.captureSnapshot, geometry fit/clamp, text-layout, shape-vector, tcm/sim, state |
| **keymap** | history undo/redo, chrome, annotations helpers, pdfSave, tabs |

## 4. Contrats P1/P4 (hors graphe renderer, pour contexte)

```mermaid
flowchart LR
  TS[contracts TS / geometry TS]
  ART[artefacts CJS / IIFE / JSON Schema commités]
  MAIN[Electron main + Ajv]
  PY[Python pdf_service + jsonschema]
  TS --> ART --> MAIN
  ART --> PY
```

Voir ADR-003. Les invariants S* restent hors schéma (ADR-005).
