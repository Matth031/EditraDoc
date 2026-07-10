# EditraDoc

**Local-first PDF editor and toolkit** — version **1.1.0**.  
Your files stay on your machine; no cloud upload is required for core PDF work.

**Éditeur et boîte à outils PDF 100 % locale** — version **1.1.0**.  
Vos fichiers restent sur votre machine ; aucun envoi vers le cloud n’est requis pour le cœur métier.

---

## Installation (Windows — 30 seconds)

Download the latest installer:  
https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe

Then double-click the file and follow the setup wizard.

- No technical prerequisites
- No need to install Node.js or Python

The installer is not yet code-signed: Windows may show a SmartScreen warning. That does not mean the app is malicious — it only means Windows does not yet recognize the publisher. Download **only** from this official GitHub repository; the source is public and auditable; PDFs are processed locally.

---

**Français —** Téléchargez l’installateur :  
https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe

Double-cliquez sur le fichier et suivez l’assistant d’installation.

- Aucun prérequis technique
- Pas besoin d’installer Node.js ou Python

L’outil n’est pas encore signé numériquement : Windows peut afficher un avertissement. Cela ne signifie pas que l’application est dangereuse. Téléchargez EditraDoc **uniquement** depuis ce dépôt GitHub officiel ; le code source est public ; vos PDF ne sont pas envoyés sur un service en ligne.

---

## What EditraDoc does

EditraDoc is a **100 % local PDF editor and toolkit** (Windows installer for end users; development also possible on Linux/macOS).

### Open and browse

- Open one or more PDFs (**tabs**), **recent files**
- **Page-by-page** navigation (buttons, thumbnails, scroll)
- **Zoom** (wheel, buttons, fit-to-width)
- Footer: page number and **orientation angle** (e.g. “Page 2 — 90°”)

### Annotate a PDF

- **Rich text**: font, color, background, margins, bold/italic/underline via context menu
- **Partial text color** on a selection (only the highlighted characters change; block color unchanged)
- **Sequential undo** for formatting: Ctrl+Z reverses one change at a time (color → italic → bold, etc.)
- **Virtual tail margin** while typing: extra space at the end of the line (proportional to font size) without persisting a character
- **Shapes** (rectangle, ellipse, arrow, star, and more — 14 types)
- **Images** (local files)
- Move, resize, **object rotation** (context menu — distinct from **page rotation**)
- **Undo / Redo** on annotations, page rotations, and text formatting
- Built-in **spell checker** (suggestions, personal dictionary)
- **Changes** sidebar and **Thumbnails** column to review edits

### Page rotation

- **↺ Rotate left** / **↻ Rotate right** buttons (±90° per click, **current page** only)
- Cumulative with source PDF rotation; WYSIWYG export (`/Rotate` in saved file)
- Blocked while **text editing** is active

### Save

- **Save as…** (`Ctrl+S`): exports a new PDF with **annotations and rotations** baked in (local Python service)
- You may choose the **same path** as the open file to overwrite a previous version

### Convert (no cloud)

- **HTML → PDF**: File > Convert > HTML to PDF (or File toolbar via **F10**) — PDF created **in the same folder** as the HTML, opened automatically; silent overwrite if `{name}.pdf` already exists
- **Image(s) → PDF**: PNG / JPG / JPEG — **one page per image**, same folder, auto-open

### PDF tools (built-in job queue)

- **Merge** multiple open PDFs
- **Split** by range or **page groups** (dedicated overlay)
- **Job** tracking, **session log**, restore after close (session / autosave)

### UI and comfort

- **4 languages**: French, English, Spanish, Portuguese (Options menu)
- **F10** toolbar, tooltips, welcome screen
- Configurable **error log** (`logs.txt` by default)
- Processing on **your machine** — no upload of PDFs to online services for core operations

### Python API only (not in menus yet)

**Compression** and **password protection** routes exist in `pdf_service.py` for future UI; they are **not** exposed in application menus today.

---

**Français —** EditraDoc est un **éditeur et boîte à outils PDF 100 % locale** (installateur Windows ; développement possible sur Linux/macOS).

### Ouvrir et parcourir

- Ouvrir un ou plusieurs PDF (**onglets**), fichiers **récents**
- Navigation **page par page** (boutons, miniatures, scroll)
- **Zoom** (molette, boutons, ajustement à la largeur)
- Pied de page : numéro de page et **angle d’orientation**

### Annoter un PDF

- **Texte** enrichi (police, couleur, fond, marges, gras/italique/souligné via menu contextuel)
- **Couleur partielle** sur une sélection (seuls les caractères sélectionnés changent)
- **Annulation séquentielle** du formatage : Ctrl+Z annule une action à la fois (couleur → italique → gras, etc.)
- **Marge virtuelle** en fin de saisie : espace proportionnel à la police, sans caractère persisté
- **Formes** (14 types), **images** locales
- Déplacer, redimensionner, **rotation d’objet** (menu contextuel — distinct de la rotation de page)
- **Annuler / Rétablir** sur annotations, rotations de page et formatage texte
- **Correcteur orthographique**, liste **Ajouts**, colonne **Miniatures**

### Rotation de page

- Boutons **↺ Rotation gauche** / **↻ Rotation droite** (±90°, **page courante**)
- Cumul avec la rotation source ; export WYSIWYG
- Bloqué pendant la **saisie de texte** active

### Enregistrer

- **Enregistrer sous…** (`Ctrl+S`) : export avec annotations et rotations intégrées
- Même chemin que le fichier ouvert possible pour **écraser** une version précédente

### Convertir (sans cloud)

- **HTML → PDF** et **Image(s) → PDF** : sortie co-localisée, ouverture automatique

### Outils PDF

- **Fusion**, **division** par plage ou **groupes de pages**, file de **jobs**, journal et session

### Interface

- **4 langues** (FR/EN/ES/PT), barre **F10**, infobulles, traitement **local**

### Hors interface

- **Compression** et **protection par mot de passe** : API Python uniquement, pas encore dans les menus.

---

## Keyboard shortcuts

### Global

| Key | Action |
|-----|--------|
| **Ctrl+O** | Open PDF |
| **Ctrl+S** | Save as… |
| **Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z** | Undo / Redo |
| **F10** | Show / hide toolbar |

Without a selected annotation, **←** and **→** change PDF page.

### Annotation mode (text, shape, or image selected — blue outline, resize handles, no active typing)

| Key | Action |
|-----|--------|
| **Arrow** | Move element **1 px** (tap) or **10 px** per repeat while held |
| **Shift + Arrow** | Grow zone **1 px** (tap) or **5 px** per repeat while held |

### Page rotation

Toolbar **↺ / ↻** rotate the **entire displayed page**, not a selected object. To rotate a text box, shape, or image, use the **object context menu**.

### Text editing

| Key | Action |
|-----|--------|
| **Enter** | Commit text; stay on zone in layout mode (caret hidden) |
| **Shift + Enter** | Insert line break |
| **Escape** | Exit editing without keeping selection |

The text frame auto-grows while typing. Soft wrap occurs at the document right edge or after manual resize / **Shift + Arrow**. A **virtual right margin** gives comfortable space at the end of the line without adding a stored character.

Formatting undo (**Ctrl+Z**) is **sequential**: each keystroke reverses one formatting action (e.g. color, then italic, then bold).

---

**Français —**

| Touche | Action (global) |
|--------|------------------|
| **Ctrl+O** | Ouvrir un PDF |
| **Ctrl+S** | Enregistrer sous… |
| **Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z** | Annuler / Rétablir |
| **F10** | Afficher / masquer la barre d’outils |

Sans annotation sélectionnée, **←** et **→** changent de page.

**Mode paramétrage** (texte, forme ou image sélectionné, contour bleu) :

| Touche | Action |
|--------|--------|
| **Flèche** | Déplace de **1 px** ou **10 px** par répétition |
| **Maj + Flèche** | Agrandit de **1 px** ou **5 px** par répétition |

**Rotation de page** : boutons ↺ / ↻ sur la **page entière** ; rotation d’objet via **menu contextuel**.

**Saisie de texte** : **Entrée** valide ; **Maj+Entrée** saut de ligne ; **Échap** quitte l’édition. **Marge virtuelle** en fin de ligne ; **undo séquentiel** du formatage avec Ctrl+Z.

---

## Privacy (in practice)

- Files are processed on your computer.
- Core PDF operations do not require sending documents to an online service.

For technical details, security, tests, and architecture, see the developer section below.

---

**Français —** Les fichiers sont traités sur votre machine. Le cœur métier n’impose pas l’envoi des PDF vers un service en ligne. Détails techniques dans la section développeur ci-dessous.

---

## Developer documentation (advanced users)

---

## Overview

**EditraDoc** is a **privacy-oriented PDF manipulation** desktop app: files stay on disk; rendering and interaction run in Electron with local helper processes.

**Problem addressed:** many online PDF services require **uploading** documents to third-party servers — often incompatible with confidentiality or internal policy.

**Audience:** users and teams who need to work on PDFs **locally**, with **auditable** code and an integrated toolchain (viewing, annotations, batch operations via job queue).

**Specification:** consolidated requirements live in `docs/00-Cahier_des_charges_V5.md` (replaces former V01–V04 specs). Complementary docs: `01-Analyse.md`, `02-Architecture.md`, `03-Product.md`, `04-Scrum.md`, `05-Dev.md`, `06-Test-Matrix.md`.

---

**Français —** **EditraDoc** est un outil PDF **orienté confidentialité** : fichiers sur le disque, rendu Electron, processus locaux. Beaucoup de services en ligne exigent l’**envoi** des PDF — incompatible avec certaines politiques. **Public :** utilisateurs et équipes en **local**, code **auditable**. **Cahier des charges maître :** `docs/00-Cahier_des_charges_V5.md` (remplace V01–V04).

---

## Positioning — local-first

- Files are processed on the user’s machine
- No cloud dependency for documented PDF operations
- Source code is auditable

This reduces data exposure and simplifies use in constrained environments.

---

**Français —** Approche **local-first** : traitement sur la machine, pas de cloud requis pour les opérations documentées, code auditable.

---

## Main features (current codebase)

- **Viewing:** multi-tab, thumbnails, page navigation, zoom (fit width / page)
- **Annotations:** rich text (in-document editing), shapes, images; **page rotation** (current page, ±90°); undo/redo including **text formatting**
- **Text:** partial color on selection, sequential formatting undo, virtual tail margin, auto-grow frame
- **Properties:** colors, fonts, margins (text); fill, stroke, opacity (shapes)
- **Context menus** for text, shapes, images, and blank page area
- **Advanced split:** **page groups** (dedicated overlay)
- **PDF tools** (Python / pypdf): **merge**, **split** (range or groups)
- **HTML → PDF** (local, Electron `printToPDF`): File > Convert; co-located output; silent overwrite; warnings for missing assets / blocked remote resources
- **Image(s) → PDF** (ReportLab, one page per image)
- **Save:** PDF export with annotations, embedded images, and **page rotations** (`/Rotate`); atomic overwrite
- **Job queue** with tracking, session log, session persistence
- **Spell checker** (nspell + dictionaries)
- **i18n:** French, English, Spanish, Portuguese

**Not yet in UI:** freehand drawing, text alignment (left/center/right), Word/Excel conversion, PDF→other formats, compression/password menus (API exists).

---

**Français —** Visualisation multi-onglets, annotations texte/formes/images, **rotation de page**, undo/redo dont **formatage texte** (couleur partielle, undo séquentiel, marge virtuelle), découpe par groupes, fusion/division, HTML→PDF, image→PDF, enregistrement WYSIWYG, file de jobs, correcteur, i18n FR/EN/ES/PT. **Non livré en UI :** dessin libre, alignement texte, conversion Office, compression/mot de passe (API seule).

---

## Highlights

| Aspect | Description |
|--------|-------------|
| **Local-first** | PDF ops via local process and loopback HTTP `127.0.0.1:8765`; no SaaS backend in app scope |
| **Open source in repo** | Versioned for review; **no `LICENSE` file at root** — see License section |
| **Multilingual** | Four UI languages in `renderer-i18n-data.js` |
| **Spell check** | nspell + `dictionary-*`; analysis in Electron main process |
| **Automated tests** | Python unittest, Node (`node:test` + c8), ESLint/Prettier, Playwright E2E (annotations, export, HTML/image, page rotation, **text formatting regression**), spell smoke, packaged Windows export regression |
| **Electron + Python** | UI/IPC in Node/Electron; PDF ops in `pdf_service.py` (pypdf, reportlab); **HTML→PDF** in `html-to-pdf.js` (no Python) |

---

**Français —** Local-first (`127.0.0.1:8765`), code ouvert (pas de `LICENSE` à la racine), 4 langues, orthographe nspell, tests Python/Node/Playwright (dont **régression formatage texte**), architecture Electron + Python + conversion HTML côté main.

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| **App shell** | Electron 41 (`app/package.json`, `main`: `src/main/main.js`) |
| **Secure bridge** | `preload.js` → `window.maniPdfApi` |
| **Renderer** | Vanilla HTML/CSS/JS; **pdf.js** via `pdfjs-dist`, `pdfjs-bridge.mjs` |
| **PDF service** | Python 3, **pypdf**, **reportlab**; HTTP server **127.0.0.1:8765**; Windows package embeds **python-runtime** (`bundle-python/win`) |
| **HTML → PDF** | Electron **printToPDF** (`html-to-pdf.js`), IPC `convert:html-to-pdf` |
| **Page rotation** | pdf.js re-render + `pageRotationsByPage`; export `/Rotate` via `pdf_ops.apply_annotations` |
| **Image → PDF** | ReportLab (`pdf_ops.images_to_pdf`), IPC `convert:images-to-pdf` |
| **Text formatting** | `renderer-text-html.js`, `renderer-text-ctx.js`, `mani-color-picker.js` |
| **Spell check** | nspell + dictionary-fr/en/es/pt-br |
| **Quality** | ESLint 10, Prettier 3, c8, Playwright |
| **Packaging** | electron-builder (Windows NSIS, Linux AppImage, macOS dmg) |

---

**Français —** Electron 41, preload sécurisé, renderer vanilla + pdf.js, service Python local, conversion HTML sans Python, rotation page + export `/Rotate`, formatage texte (`renderer-text-*`, nuancier), nspell, ESLint/Prettier/c8/Playwright, electron-builder.

---

## Project layout

```text
EditraDoc/
├── .github/workflows/     # CI + Windows release (EditraDoc-Setup.exe)
├── docs/                    # Project docs (master spec: 00-Cahier_des_charges_V5.md)
├── public/                  # Static assets (e.g. logo)
├── tests/                   # Test fixtures (e.g. E2E PDFs)
├── package.json             # Root scripts delegate to app/
└── app/
    ├── public/              # Packaged assets
    ├── e2e/                 # Playwright (+ fixtures in e2e/fixtures/html/)
    ├── node-tests/          # Node tests (main/lib, path-guard, html-to-pdf, rotation math)
    ├── python/              # HTTP service, pdf_ops, unittest
    ├── scripts/             # verify-05-dev-assets, bundle-python-embed-win, …
    ├── src/
    │   ├── main/            # Electron main (IPC, jobs, spellcheck, html-to-pdf)
    │   ├── lib/             # session-log-store, page-rotate-math, …
    │   └── renderer/        # UI, viewer, i18n, annotations, conversion
    ├── package.json
    ├── playwright.config.js
    └── eslint.config.mjs
```

Detailed developer reference: `docs/05-Dev.md`.

---

**Français —** Arborescence ci-dessus ; spécification maître `docs/00-Cahier_des_charges_V5.md` ; détails dev dans `docs/05-Dev.md`.

---

## Internationalization

- **Languages:** `fr`, `en`, `es`, `pt`
- **Source:** `app/src/renderer/renderer-i18n-data.js` (`window.__EDITIFY_I18N`)
- **Persistence:** `localStorage` key `editify:lang`
- **Application:** `renderer-i18n-apply.js`; Options menu and app menu **Options > Language**

---

**Français —** Quatre langues, source `renderer-i18n-data.js`, persistance `editify:lang`, application via `renderer-i18n-apply.js` et menu Options.

---

## Quality and tests

Commands in `app/package.json`:

| Command | Role |
|---------|------|
| `npm run test:verify-assets` | `index.html` / i18n consistency |
| `npm run format` / `format:check` | Prettier |
| `npm run lint` | ESLint |
| `npm run test:node` | Node tests (`scripts/run-node-tests.mjs`, cross-plateforme) |
| `npm run test:coverage` | c8 with thresholds in `package.json` |
| `npm run test:audit` | `npm audit --audit-level=high` |
| `npm test` | Python unittest (`python/tests`) |
| `npm run test:spell` | Spell-check smoke |
| `npm run test:html-convert` | HTML→PDF headless (`run-html-to-pdf-convert.cjs`) |
| `npm run test:embedded-python` | Embedded Python smoke (Windows; skipped elsewhere) |
| `npm run test:export-regression` | Python + E2E export / viewer-text / page-rotate |
| `npm run test:rotate-regression` | Rotation math + page-rotate E2E |
| `npm run test:packaged-export` | E2E on `dist/win-unpacked/EditraDoc.exe` (needs build) |
| `npm run e2e` | Full Playwright suite (incl. `app.text-format-regression.spec.js`, html-convert, page-rotate, export, …) |
| `npm run test:all` | Full quality chain |

From repo root: `npm run test` and `npm run e2e` delegate to `app/` via `npm --prefix app`.

---

**Français —** Chaîne qualité : verify-assets, Prettier, ESLint, tests Node (c8), audit npm, unittest Python, smoke orthographe, E2E Playwright (dont **`app.text-format-regression.spec.js`** pour couleur partielle, undo séquentiel, marge virtuelle). `npm run test:all` = chaîne complète. Racine du dépôt : scripts relais vers `app/`.

---

## Security and privacy

- **Local processing:** native file dialogs; PDF ops on **127.0.0.1** only (`pdf_service.py`)
- **No mandatory network** for core PDF flow; external URLs (e.g. About links) use `shell.openExternal` with **http/https only**
- **Auditable code** — no absolute security guarantee
- **HTML sanitization:** `sanitizeTextHtml` in `renderer-text-html.js` (not a maximal DOMPurify-level sanitizer — see code comments)
- **Validation:** `validateJobPayload` (main); path validation (Python `/validate`, `path-guard.js` for HTML/PDF)
- **HTML conversion:** isolated Electron window (`sandbox`), blocks non-`file://` requests, 15 s load timeout

---

**Français —** Traitement local sur `127.0.0.1`, pas de réseau imposé pour le cœur métier, code auditable, sanitization HTML partielle, validation des jobs et chemins, conversion HTML en fenêtre isolée (sandbox, blocage hors `file://`, timeout 15 s).

---

## Use cases

- Fill or complete **PDF forms** without hosting files online
- Work on **sensitive** documents (HR, legal, medical) when policy forbids third-party upload
- Use **offline** for local read and operations (once app is installed)
- Turn a local **HTML report or page** into a shareable PDF without leaving the app

---

**Français —** Formulaires PDF locaux, documents sensibles sans cloud, usage hors ligne, conversion HTML interne en PDF.

---

## What this project demonstrates

- Full **desktop app** design (UI, IPC, auxiliary service, job queue, persistence)
- **Structure:** renderer / main / Python separation, multi-level tests, documented script order (`verify-05-dev-assets.mjs`)
- **i18n** and **spell check** as first-class product requirements
- **Security awareness:** CSP in `index.html`, job validation, partial HTML sanitization, restricted external URL schemes

---

**Français —** Application de bureau complète, architecture modulaire testée, i18n et orthographe intégrés, sensibilité sécurité (CSP, validation, sanitization partielle).

---

## Windows install (end users)

No command line needed: single **`.exe`** installer (PDF engine included, no separate Python install).

| Location | When |
|----------|------|
| **`EditraDoc-Setup.exe` at repo root** | After `npm run dist:win` in `app/` (auto-copied by `copy-installer-to-root.mjs`) |
| **GitHub Releases / Actions artifacts** | Download `EditraDoc-Setup.exe` from **Releases** (tag e.g. `v1.1.0`) or artifact **`editify-windows-setup`** |

`EditraDoc-Setup.exe` at root is **gitignored** (large binary). If missing, build locally or download from Releases.

Releases are produced by workflow **Release Windows installer** (`.github/workflows/release-windows.yml`): regression tests include `test:embedded-python` and `test:packaged-export`.

---

**Français —** Installateur **`.exe`** unique, sans Node/Python sur le PC cible. Fichier **`EditraDoc-Setup.exe`** à la racine après `npm run dist:win`, ou téléchargement via **Releases** GitHub (tag `v1.1.0`). Fichier gitignored si build locale. Workflow CI **Release Windows installer** avec tests de régression packagés.

---

## Development setup

All npm app commands run from **`app/`** (root `package.json` relays some scripts).

### Prerequisites

| Tool | Detail |
|------|--------|
| **Node.js** | **20.x** recommended (CI version); npm included |
| **Python 3** | `python` (Windows) or `python3` (Linux/macOS) on PATH for dev |
| **pip** | `pypdf`, `reportlab` via `python -m pip install -r python/requirements.txt` |

### Clone, install, run dev

```bash
cd app
npm install
python -m pip install -r python/requirements.txt
npm run dev
```

From repo root (after `npm install` in `app/`): `npm run dev` ≡ `npm --prefix app run dev`. `npm start` in `app/` is equivalent to `npm run dev`.

### Build unpacked (no installer)

```bash
cd app
npm run build
```

Produces `app/dist/win-unpacked` on Windows for testing without NSIS.

### Windows installer (maintainers / CI)

On **Windows x64** with **PowerShell** and network (first-time embeddable Python download):

```bash
cd app
npm install
npm run dist:win
```

NSIS installer in `app/dist/`, copied to repo root as **`EditraDoc-Setup.exe`**. From root: `npm run dist:win`.

Other platforms (`npm run dist`) currently rely on **system Python**; only **Windows** bundles Python via `bundle-python-win`.

### Command reference

| Goal | Where | Command |
|------|-------|---------|
| Development | `app/` | `npm run dev` |
| Node deps | `app/` | `npm install` |
| Python deps (dev) | `app/` | `python -m pip install -r python/requirements.txt` |
| Unpacked artifact | `app/` | `npm run build` |
| Package (build OS) | `app/` | `npm run dist` |
| Windows installer + embedded Python | `app/` | `npm run dist:win` |
| Windows Python bundle only | `app/` | `npm run bundle:python-win` |

---

**Français —** Prérequis : Node 20.x, Python 3 + pip (`pypdf`, `reportlab`). Dev : `cd app && npm install && npm run dev`. Build : `npm run build` (décompressé), `npm run dist:win` (installateur NSIS + Python embarqué Windows). Commandes depuis `app/` ou relais racine.

---

## Contributing

- Run `npm run test:all` in `app/` before proposing a merge
- Do not commit secrets; follow ESLint/Prettier conventions
- Changes to `index.html` script order or i18n keys must stay aligned with `verify-05-dev-assets.mjs` and `docs/05-Dev.md`
- Product requirements: update `docs/00-Cahier_des_charges_V5.md` when scope changes

---

**Français —** Avant fusion : `npm run test:all` dans `app/`. Pas de secrets en commit. Aligner `index.html` / i18n avec `verify-05-dev-assets.mjs` et `05-Dev.md`. Évolutions de périmètre : mettre à jour `00-Cahier_des_charges_V5.md`.

---

## License

**No `LICENSE` file** was found at the repository root. Third-party dependencies retain their own licenses (electron-builder notices, Chromium/Electron in build artifacts). Add an explicit license before public distribution if needed.

---

**Français —** **Aucun fichier `LICENSE`** à la racine. Les dépendances tierces conservent leurs licences. Ajouter une licence explicite est recommandé pour une publication publique.
