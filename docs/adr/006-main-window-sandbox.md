# ADR-006: Sandbox Chromium sur la fenêtre principale (`sandbox: true`)

## Statut

Proposé (en attente validation commit S11)

## Date

2026-07-25

## Contexte

La fenêtre HTML→PDF (`html-to-pdf.js`) était déjà créée avec `sandbox: true`. La fenêtre
principale (`createWindow` dans `main.js`) restait **sans** sandbox explicite, alors que le
reste du durcissement était déjà en place :

- `contextIsolation: true`
- `nodeIntegration: false`
- preload minimal exposant `window.maniPdfApi` via `contextBridge`

Audit S11 : l’absence de sandbox sur la fenêtre principale élargit inutilement la surface si
un contenu renderer (ou une future page moins maîtrisée) était compromis. Electron recommande
`sandbox: true` dès que le preload n’a pas besoin de modules Node hors API Electron.

Contrainte forte : ne pas casser l’IPC preload → main (PDF, export, dialogues, spellcheck,
Python embarqué) **en dev et en binaire packagé**.

## Décision

Activer `sandbox: true` dans `webPreferences` de `createWindow()` (fenêtre principale), au
même niveau que `contextIsolation` / `nodeIntegration` / `spellcheck`, **sans** modifier le
preload ni les handlers IPC.

```js
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: true
}
```

### Audit preload (pourquoi l’activation est simple)

`app/src/main/preload.js` **n’utilise aucun module Node** (`fs`, `path`, `os`, etc.).

- Unique `require` : `require("electron")` → `{ contextBridge, ipcRenderer }`.
- Accès limité à `process.env` (overrides E2E / flags) — disponible dans un preload sandboxed.
- Toute I/O fichier, dialogue natif, Python, spellcheck dictionnaire passe par
  `ipcRenderer.invoke` / `ipcRenderer.on` vers le **processus main**.

La mention `require("fs")` dans un **commentaire** du preload n’est pas un import.

Donc : sous sandbox, le preload conserve exactement les APIs dont il a besoin ; rien à
réécrire. C’est ce qui explique que le diff produit soit une seule ligne.

## Alternatives envisagées

- **Rester sans sandbox sur la fenêtre principale**  
  Avantages : zéro risque de régression packagée / spellcheck / DnD.  
  Rejeté : surface Chromium plus large sans bénéfice fonctionnel ; incohérent avec
  `html-to-pdf.js` déjà sandboxed ; écart aux recommandations Electron actuelles.

- **Sandbox + refactor preload vers `contextBridge` + zero `process.env`**  
  Avantages : surface encore plus petite.  
  Reporté : hors périmètre S11 ; les lectures `process.env` sont bornées (E2E / audit) et
  déjà try/catch.

- **Désactiver `spellcheck: true` par précaution**  
  Rejeté : non nécessaire ; vérifié coexistant avec sandbox (attribut éditeur + IPC analyze).

## Conséquences

### Positives

- Alignement fenêtre principale / HTML→PDF sur le même modèle de durcissement.
- Renderer isolé : pas de `require` / `process` / `Buffer` dans le world page (prouvé packagé).
- Diff minimal (+1 ligne) — revue et rollback triviaux.

### Négatives / à surveiller

- Tout futur besoin Node **dans le preload** (ex. `fs` direct) serait incompatible avec
  sandbox → devoir passer par le main (déjà le pattern du projet).
- Les suites E2E en mode dev ne suffisent pas seules pour ce changement : un smoke **packagé**
  reste recommandé après touch preload / `webPreferences`.

## Ce qui a été vérifié (preuves S11 — 2026-07-25)

### Source / asar

- Diff worktree : uniquement `sandbox: true` dans `createWindow`.
- `app.asar` post-`npm run dist:win` : même bloc `webPreferences` avec `sandbox: true`.

### Runtime packagé (`dist/win-unpacked/EditraDoc.exe`)

Via `app/tmp/s11-packaged-smoke.mjs` (EXIT=0) :

| Contrôle | Résultat |
|----------|----------|
| `webContents.getLastWebPreferences().sandbox` | `true` |
| `contextIsolation` / `nodeIntegration` | `true` / `false` |
| Renderer : `typeof require` | `undefined` (+ `fs` inaccessible) |
| Surface `maniPdfApi` | 53 méthodes ; clés critiques présentes |
| `pythonHealth` (Python embarqué) | `ok` |
| Ouverture PDF + `readPdfBytes` | ok |
| `openPdfDialog` / `savePdfAsDialog` (bypass E2E) | ok |
| Dialogues natifs `showOpenDialog` / `showSaveDialog` (fermeture WM_CLOSE) | `canceled: true` |
| `spellcheckAnalyze("je suis trste")` | erreur détectée |
| `contenteditable.spellcheck` + `lang=fr-FR` | `true` |
| DnD `#dropOverlay` (`DragEvent`) | ok |
| Export PDF annoté (image) | ok (~108 Ko) |
| `getBuildInfo` | v1.1.2 / commit build |

Complément : `npm run test:packaged-export` → **1 passed** (Python embarqué + export image).

### Installateur NSIS

- `npm run dist:win` OK → `EditraDoc Setup 1.1.2.exe`
- Install silencieuse → `%LOCALAPPDATA%\EditraDoc-s11-sandbox-test\EditraDoc.exe` (Setup exit=0)
- Même smoke S11 sur l’exe **installé** : EXIT=0 (`sandbox: true` runtime, PDF, export, dialogs, spellcheck, DnD)

### Hors périmètre volontaire

- Pas de re-capture des peek goldens P1.
- Pas de modification de `security-lock.test.js` (S11 n’est pas dans les invariants
  verrouillés actuels S1/S2/S4/S5/S6/S7/S10/S19).
- DnD « ouvrir un PDF depuis l’Explorateur » : le produit ouvre via menu / `dialog:openPdf`,
  pas via drop fichier OS sur le renderer ; le DnD couvert est l’overlay annotations.

## Lien

- Code : `app/src/main/main.js` (`createWindow`), `app/src/main/preload.js`
- Précédent aligné : `app/src/main/lib/html-to-pdf.js` (`sandbox: true`)
- Smoke local (non versionné) : `app/tmp/s11-packaged-smoke.mjs`
- Invariants S* : ADR-005 / `app/node-tests/security-lock.test.js`
