# 🚀 EditraDoc

## Installation (Windows - 30 secondes)

👉 Télécharger l’application (dernière release publiée) :  
https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe

Puis :

* Double-cliquer sur le fichier téléchargé
* Suivre les étapes d’installation

✅ Aucun prérequis technique
✅ Pas besoin d’installer Node.js ou Python

L'outil n'est pas encore signé numériquement : Windows peut donc afficher un avertissement lors de l'installation.

Cela ne signifie pas que l'application est dangereuse, mais simplement que Windows ne reconnaît pas encore l'éditeur.

Pour installer EditraDoc en confiance :

* téléchargez EditraDoc uniquement depuis ce dépôt GitHub officiel ;
* le code source est public et peut être consulté ou audité ;
* l'application fonctionne localement : vos PDF ne sont pas envoyés sur un service en ligne.

---

## Ce que fait EditraDoc

EditraDoc est un **éditeur et boîte à outils PDF 100 % locale** (Windows, avec installateur ; développement possible sur Linux/macOS). Version applicative courante : **1.1.0**.

### Ouvrir et parcourir

- Ouvrir un ou plusieurs PDF (**onglets**), fichiers **récents**
- Navigation **page par page** (boutons, miniatures, scroll)
- **Zoom** (molette, boutons, ajustement à la largeur)
- Pied de page : numéro de page et **angle d’orientation** (ex. « Page 2 — 90° »)

### Annoter un PDF

- **Texte** enrichi (police, couleur, fond, marges, gras/italique via menu contextuel)
- **Formes** (rectangle, ellipse, flèche, étoile, etc.)
- **Images** (fichier local)
- Déplacer, redimensionner, **rotation d’un objet** (menu contextuel — distinct de la rotation de page)
- **Annuler / Rétablir** (undo / redo) sur annotations et rotations de page
- **Correcteur orthographique** (suggestions, dictionnaire personnel)
- Liste **Ajouts** et colonne **Miniatures** pour retrouver les modifications

### Rotation de page

- Boutons **↺ Rotation gauche** / **↻ Rotation droite** (±90° par clic, **page courante** uniquement)
- Cumul avec la rotation déjà présente dans le PDF source ; export WYSIWYG (`/Rotate` dans le fichier enregistré)
- Bloqué pendant la **saisie de texte** active

### Enregistrer

- **Enregistrer sous…** (`Ctrl+S`) : exporte un nouveau PDF avec **annotations et rotations** intégrées (service Python local)
- Vous pouvez choisir le **même chemin** que le fichier ouvert pour **écraser** une version précédente

### Convertir (sans cloud)

- **HTML → PDF** : menu Fichier > Convertir > HTML vers PDF (ou barre Fichier via **F10**) — PDF créé **dans le même dossier** que le HTML, ouverture automatique ; écrasement silencieux si `{nom}.pdf` existe déjà
- **Image(s) → PDF** : PNG / JPG / JPEG — **une page par image**, même dossier, ouverture automatique

### Outils PDF (file d’attente intégrée)

- **Fusion** de plusieurs PDF ouverts
- **Division** par plage ou par **groupes de pages** (overlay dédié)
- Suivi des **jobs** en cours, **journal de session**, reprise après fermeture (session / autosave)

### Interface et confort

- **4 langues** : français, anglais, espagnol, portugais (menu Options)
- Barre d’outils **F10**, infobulles, écran d’accueil
- Journal des **erreurs** configurable (fichier `logs.txt` par défaut)
- Traitement **sur votre machine** — pas d’envoi des PDF vers un service en ligne pour le cœur métier

### Hors interface (API Python locale uniquement)

Les routes **compression** et **protection par mot de passe** existent côté service (`pdf_service.py`) pour évolution future ; elles ne sont **pas** encore exposées dans les menus de l’application.

## Ergonomie clavier (annotations)

Lorsqu’une zone de **texte**, une **forme** ou une **image** est sélectionnée en **mode paramétrage** (contour bleu, poignées de redimensionnement, sans saisie active) :

| Touche | Action |
|--------|--------|
| **Flèche** | Déplace l’élément de **1 px** (appui bref) ou de **10 px** par répétition si la touche reste enfoncée |
| **Maj + Flèche** | Agrandit la zone de **1 px** (appui bref) ou de **5 px** par répétition si la touche reste enfoncée, dans le sens de la flèche |

Sans annotation sélectionnée, **←** et **→** changent de page PDF.

| Touche | Action (global) |
|--------|------------------|
| **Ctrl+O** | Ouvrir un PDF |
| **Ctrl+S** | Enregistrer sous… |
| **F10** | Afficher / masquer la barre d’outils |

### Rotation de page

Les boutons ↺ / ↻ agissent sur la **page entière** affichée (pas sur un objet sélectionné). Pour pivoter un texte, une forme ou une image, utilisez le **menu contextuel** de l’objet.

### Saisie de texte

| Touche | Action |
|--------|--------|
| **Entrée** | Valide le texte et reste sur la zone en mode paramétrage (plus de curseur de saisie) |
| **Maj + Entrée** | Insère un saut de ligne |
| **Échap** | Quitte la saisie sans conserver la sélection |

La largeur du cadre texte s’ajuste automatiquement pendant la frappe ; le retour à la ligne vertical n’intervient qu’au bord droit du document ou après un redimensionnement manuel / **Maj + Flèche**.

## Confidentialité (en pratique)

- Les fichiers sont traités sur la machine.
- L’application n’impose pas l’envoi du document vers un service en ligne.

Pour les détails techniques, la sécurité, les tests et l’architecture: voir la section développeur ci-dessous.

---

## 🛠️ Documentation développeur (utilisateurs avancés uniquement)

---

## Présentation

**EditraDoc** est un outil de manipulation de PDF orienté **confidentialité** et **simplicité** : les fichiers restent sur le poste, le rendu et les interactions passent par une fenêtre Electron et des processus locaux.

**Problème adressé** : de nombreux services en ligne imposent l’**envoi** des PDF sur des serveurs tiers pour fusionner ou diviser. Cela peut être incompatible avec des contraintes de confidentialité ou de politique interne.

**Public cible** : utilisateurs et équipes qui veulent traiter des PDF **localement**, avec un code **auditable** et une chaîne d’outils intégrée (visualisation, annotations, opérations batch via file d’attente).

---

## Positionnement

EditraDoc adopte une approche **local-first** :

- les fichiers sont traités sur la machine de l’utilisateur
- aucune dépendance à un service cloud n’est requise pour les opérations PDF
- le code est auditable

Ce choix vise à réduire l’exposition des données et à simplifier l’usage dans des environnements contraints.

---

## Pourquoi ce projet existe

Beaucoup d’outils PDF accessibles via navigateur reposent sur le **téléversement** du document vers une infrastructure distante. Même lorsque ces services sont légitimes, cela crée une **dépendance au réseau** et une **prise de risque** au regard de la circulation des fichiers.

EditraDoc adopte une approche **local-first** : le traitement des opérations PDF côté backend passe par un service HTTP **127.0.0.1:8765** lancé avec l’application, et non par un API tiers. Cela ne remplace pas une analyse juridique ou une certification : c’est un choix d’architecture et de périmètre technique.

---

## Fonctionnalités principales

Fonctionnalités alignées sur le code actuel du dépôt :

- **Visualisation** multi-onglets, miniatures, navigation par page, zoom (ajustement largeur / page).
- **Annotations** : zones de texte enrichi (édition dans le document), formes, images ; **rotation de page** (page courante, ±90°) ; annulation / rétablissement (undo / redo). Voir la section **Ergonomie clavier** pour les raccourcis (Entrée, flèches, Maj+flèches).
- **Propriétés** : couleurs, polices, marges pour le texte ; remplissage, contour, opacité pour les formes.
- **Menus contextuels** pour le texte, les formes, les images et la zone de page vide.
- **Découpe avancée** : définition de **groupes de pages** (overlay dédié).
- **Outils PDF** (via Python / pypdf) : **fusion**, **division** (plage ou groupes).
- **Conversion HTML → PDF** (100 % local, Electron `printToPDF`) : menu **Fichier > Convertir > HTML vers PDF** ou entrée équivalente dans la barre **Fichier** (F10). Le PDF `{nom}.pdf` est créé **dans le même dossier** que le fichier HTML et **s’ouvre aussitôt** dans l’application. Si un PDF du même nom existe déjà, il est **remplacé sans dialogue** (infobulle explicative). Avertissements possibles : ressources images manquantes, ressources distantes ignorées (mode local uniquement).
- **Conversion image(s) → PDF** (ReportLab, une page par image) : menu **Fichier > Convertir > Image(s) vers PDF** ; sortie co-localisée, ouverture automatique.
- **Enregistrement** : export PDF intégrant annotations, images embarquées et **rotations de page** (`/Rotate`) ; écriture atomique à l’écrasement.
- **File d’attente de jobs** avec suivi, journal de session, persistance de session.
- **Correcteur orthographique** intégré (suggestions, dictionnaire utilisateur).
- **Internationalisation** : français, anglais, espagnol, portugais (interface).

---

## Points forts

| Aspect | Description |
|--------|-------------|
| **Local-first** | Opérations PDF via processus local et HTTP boucle locale ; pas de backend SaaS dans le périmètre applicatif décrit ici. |
| **Code source ouvert dans le dépôt** | Projet versionné de façon à permettre relecture et audit ; **aucun fichier `LICENSE` n’est fourni à la racine** - voir la section Licence. |
| **Multilingue** | Quatre langues d’interface (`fr`, `en`, `es`, `pt`) dans `renderer-i18n-data.js`. |
| **Orthographe** | `nspell` + dictionnaires `dictionary-*` ; analyse côté processus principal Electron. |
| **Tests automatisés** | Unitaires Python, tests Node (`node:test` + c8), vérifications statiques, Playwright E2E (annotations, export, HTML/image, **rotation de page**), smoke orthographe, régression export image (dev + build packagé Windows). |
| **Architecture Electron + Python** | UI et IPC dans Node/Electron ; opérations PDF dans `pdf_service.py` (pypdf, reportlab pour l’export annoté et **image → PDF**) ; **conversion HTML → PDF** dans `src/main/lib/html-to-pdf.js` (sans Python). |

---

## Stack technique

| Couche | Technologies |
|--------|----------------|
| **Shell applicatif** | Electron 41 (`app/package.json`, `main`: `src/main/main.js`) |
| **Pont sécurisé** | `preload.js`, API exposée au renderer sous `window.maniPdfApi` |
| **Renderer** | HTML/CSS/JS vanilla ; **pdf.js** via `pdfjs-dist` et `pdfjs-bridge.mjs` |
| **Service PDF** | Python 3, **pypdf**, **reportlab** (`app/python/requirements.txt`), serveur `http.server` sur **127.0.0.1:8765** ; sous Windows packagé, runtime **python-runtime** embarqué (`bundle-python/win`) |
| **Conversion HTML → PDF** | Electron **printToPDF** (`html-to-pdf.js`), IPC `convert:html-to-pdf`, module UI `renderer-html-convert.js` |
| **Rotation de page** | pdf.js re-rendu + `pageRotationsByPage` ; export `/Rotate` via `pdf_ops.apply_annotations` |
| **Conversion image → PDF** | ReportLab (`pdf_ops.images_to_pdf`), route `/images-to-pdf`, IPC `convert:images-to-pdf`, UI `renderer-image-convert.js` |
| **Orthographe** | **nspell** + `dictionary-fr`, `dictionary-en`, `dictionary-es`, `dictionary-pt-br` |
| **Qualité** | ESLint 10, Prettier 3, c8, Playwright |
| **Empaquetage** | electron-builder (cibles configurées : Windows NSIS, Linux AppImage, macOS dmg) |

---

## Architecture du projet

Arborescence utile (extraits) :

```text
EditraDoc/
├── .github/workflows/     # CI (tests) + release Windows (installateur .exe)
├── docs/                    # Documentation projet (dont 05-Dev.md)
├── public/                  # Ressources statiques (ex. logo)
├── tests/                   # Jeux de fichiers pour tests (ex. PDF de test E2E)
├── package.json             # Scripts racine déléguant à app/
└── app/
    ├── public/              # Assets packagés (logos, images) référencés par le renderer
    ├── e2e/                 # Tests Playwright (+ fixtures HTML dans e2e/fixtures/html/)
    ├── node-tests/          # Tests Node (main / lib, path-guard, html-to-pdf)
    ├── python/              # Service HTTP, pdf_ops, tests unittest
    ├── scripts/             # verify-05-dev-assets, bundle-python-embed-win, run-html-to-pdf-convert, …
    ├── src/
    │   ├── main/            # Processus Electron (IPC, jobs, spellcheck, html-to-pdf)
    │   ├── lib/             # Ex. session-log-store
    │   └── renderer/        # UI, viewer, i18n, annotations, conversion HTML
    ├── package.json         # Scripts npm applicatifs
    ├── playwright.config.js
    └── eslint.config.mjs
```

La **référence développeur** détaillée (ordre des scripts, tests, i18n) : `docs/05-Dev.md`.

---

## Internationalisation

- **Langues** : `fr`, `en`, `es`, `pt`.
- **Fichier source** : `app/src/renderer/renderer-i18n-data.js` - objet global `window.__EDITIFY_I18N`.
- **Persistance** : `localStorage`, clé `editify:lang`.
- **Application** : `renderer-i18n-apply.js` met à jour libellés, infobulles et fragments HTML contrôlés ; menu **Options** et menu application **Options > Langue** (événement `app:set-language`).

---

## Qualité et tests

Commandes définies dans `app/package.json` :

| Commande | Rôle |
|----------|------|
| `npm run test:verify-assets` | Cohérence `index.html` / i18n (script `verify-05-dev-assets.mjs`) |
| `npm run format` / `npm run format:check` | Prettier sur les chemins configurés |
| `npm run lint` | ESLint |
| `npm run test:node` | Tests Node (`node-tests/**/*.test.js`) |
| `npm run test:coverage` | Couverture c8 avec seuils du `package.json` |
| `npm run test:audit` | `npm audit --audit-level=high` |
| `npm test` | Unittest Python (`python/tests`) |
| `npm run test:spell` | Smoke orthographe (`spellcheck-smoke.mjs`) |
| `npm run test:html-convert` | Conversion HTML → PDF hors UI (`run-html-to-pdf-convert.cjs`, fixture par défaut dans `e2e/fixtures/html/`) |
| `npm run test:embedded-python` | Smoke Python embeddable Windows (`run-embedded-python-smoke.cjs`, skip hors Windows) |
| `npm run test:export-regression` | Unittest Python + E2E export PDF avec image (`e2e/app.export-image.spec.js`) |
| `npm run test:packaged-export` | E2E export image sur `dist/win-unpacked/EditraDoc.exe` (nécessite `npm run build` ou `dist:win`) |
| `npm run e2e` | Playwright (dont `app.html-convert*.spec.js`, `app.page-rotate.spec.js`, `app.export-image*.spec.js`) |
| `npm run test:all` | Chaîne complète (qualité + tests + audit + e2e) |

À la racine du dépôt, `npm run test` et `npm run e2e` relaient vers `app/` via `npm --prefix app`.

---

## Sécurité et confidentialité

- **Traitement local** : ouverture des fichiers via dialogues natifs ; opérations PDF traitées par le processus Python **sur la machine**, via **127.0.0.1** (pas d’exposition réseau du serveur HTTP sur toutes les interfaces - voir `pdf_service.py`).
- **Pas de dépendance réseau imposée pour le cœur métier** : le flux nominal des opérations PDF ne repose pas sur un API distant documenté dans ce dépôt. **Exception** : si l’utilisateur active une action qui ouvre une **URL externe** (ex. lien dans « À propos »), le système utilise `shell.openExternal` avec **http/https uniquement** (`main.js`).
- **Code auditable** : dépôt source consultable ; pas de garantie de sécurité absolue.
- **HTML** : le contenu éditable des zones texte passe par `sanitizeTextHtml` (`renderer-text-html.js`) - réduction du risque XSS, avec limite explicitée dans les commentaires du code (ce n’est pas équivalent à un sanitizer maximaliste type DOMPurify).
- **Validation** : contrôles côté processus principal sur les charges utiles des jobs (`validateJobPayload`) ; validation des chemins PDF côté Python pour `/validate` ; validation des chemins HTML/PDF co-localisés pour la conversion (`path-guard.js`).
- **Conversion HTML** : chargement en fenêtre Electron isolée (`sandbox`), blocage des requêtes hors `file://`, timeout de chargement 15 s ; pas d’exécution de scripts distants dans le document source.

---

## Cas d’usage

- Préparer ou **compléter des formulaires PDF** sans les héberger en ligne.
- Travailler sur des documents **sensibles** (RH, juridique, médical, etc.) lorsque la politique impose de **ne pas** les envoyer sur des services tiers.
- Utiliser l’outil **hors connexion** pour la lecture et les opérations locales (une fois l’application et les dépendances installées).
- Remplir et modifier un formulaire administratif contenant des données personnelles sans passer par un service en ligne.
- **Transformer une page ou un rapport HTML** (export local, documentation interne) en PDF partageable, sans quitter l’application.

---

## Ce que ce projet démontre

- Conception d’un **outil de bureau complet** (UI, IPC, service auxiliaire, file d’attente, persistance).
- **Structuration** : séparation renderer / main / Python, tests à plusieurs niveaux, contrat documenté (`docs/05-Dev.md`, vérification automatisée de l’ordre des scripts).
- **Internationalisation** et **correcteur** intégrés comme exigences de produit, pas comme ajouts tardifs.
- **Sensibilité sécurité** : CSP dans `index.html`, validation des jobs, sanitation HTML partielle, ouverture d’URLs externes restreinte aux schémas web courants.

---

## Installation (utilisateurs Windows)

Aucune ligne de commande n’est nécessaire pour **installer** le produit : tout passe par un **fichier `.exe` unique** (moteur PDF intégré, pas besoin d’installer Python à part).

### Où trouver l’installateur ?

| Emplacement | Quand |
|-------------|--------|
| **`EditraDoc-Setup.exe` à la racine du dépôt** (même dossier que ce fichier `README.md`) | Après une **build Windows** du projet : ce fichier est **créé automatiquement** à cet endroit quand un développeur exécute `npm run dist:win` dans `app/` (voir section développement). C’est le fichier à **double-cliquer** pour lancer l’installation. |
| **Releases** ou **Actions → artefacts** sur GitHub | Pour les utilisateurs qui **téléchargent** le projet depuis GitHub sans compiler : récupérer le même binaire depuis l’onglet **Releases** (fichier joint à la version) ou l’artefact **`editify-windows-setup`** après une exécution du workflow **Release Windows installer**. Vous pouvez enregistrer ce fichier sous le nom **`EditraDoc-Setup.exe`** et le placer où vous voulez, ou le lancer directement depuis le dossier Téléchargements. |

Une fois le **`.exe`** obtenu (racine du dépôt après build, ou téléchargement) : **double-cliquer**, suivre l’assistant (dossier d’installation, raccourcis), puis ouvrir **EditraDoc** depuis le menu Démarrer ou le bureau. **Aucun Node.js ni Python à installer à la main** sur le PC cible.

> **Note :** `EditraDoc-Setup.exe` à la racine est **généré localement** par la build ; il n’est en général **pas** versionné dans Git (fichier volumineux, entrée dans `.gitignore`). S’il est absent, soit lancer une build (`npm run dist:win` dans `app/`), soit télécharger l’installateur depuis **Releases** / **Actions** comme ci-dessus.

Les **Releases** sont alimentées par le workflow GitHub Actions **Release Windows installer** (`.github/workflows/release-windows.yml`) : sur un **tag de version** (ex. **`v1.1.0`**), l'installateur est joint à la release ; une exécution manuelle du workflow dépose aussi l'artefact **`editify-windows-setup`** (contenu : **`EditraDoc-Setup.exe`**). Après la build, le workflow exécute les tests de régression export image (`test:embedded-python`, `test:packaged-export`).

---

## Installation et lancement (développement)

Réservé aux personnes qui modifient le code ou construisent l’installateur eux-mêmes. Toutes les commandes npm applicatives se lancent depuis le dossier **`app/`** (le `package.json` à la racine du dépôt ne fait que relayer certains scripts vers `app/`).

### Prérequis

| Outil | Détail |
|--------|--------|
| **Node.js** | **20.x** recommandé (version utilisée en CI) ; **npm** inclus. |
| **Python 3** | Interpréteur **`python`** (Windows) ou **`python3`** (Linux/macOS) sur le PATH pour le lancement en mode développement. |
| **pip** | `pypdf`, `reportlab` via `python -m pip install -r python/requirements.txt`. |

### Cloner, installer les dépendances, lancer en mode dev

```bash
cd app
npm install
python -m pip install -r python/requirements.txt
npm run dev
```

Sous Linux/macOS, utiliser `python3` si `python` n’existe pas. Sans `pypdf` et `reportlab`, le service PDF et `npm test` peuvent échouer.

Depuis la racine du dépôt (après `npm install` dans `app/`) : `npm run dev` (équivalent à `npm --prefix app run dev`). Les commandes **`npm start`** et **`npm run start`** dans `app/` sont équivalentes à **`npm run dev`**.

### Build sans installateur (dossier décompressé)

```bash
cd app
npm run build
```

Produit notamment **`app/dist/win-unpacked`** (sous Windows) pour tester sans NSIS.

### Produire l’installateur Windows (mainteneurs / CI)

Sur une machine **Windows x64** avec **PowerShell** et accès réseau (téléchargement du Python embeddable la première fois) :

```bash
cd app
npm install
npm run dist:win
```

L’installeur NSIS est généré dans **`app/dist/`**, puis **copié à la racine du dépôt** sous le nom fixe **`EditraDoc-Setup.exe`** (script `app/scripts/copy-installer-to-root.mjs`). Équivalent depuis la racine du dépôt : `npm run dist:win`.

Les autres plateformes (`npm run dist` : AppImage, dmg, etc.) s'appuient pour l'instant sur un **Python système** sur la machine cible ; seul le flux **Windows** embarque le runtime Python via `bundle-python-win`. Le service `pdf_service.py` ajoute son dossier à `sys.path` au démarrage (compatibilité Python embeddable).

### Récapitulatif des commandes (référence)

| Objectif | Où | Commande |
|----------|-----|----------|
| Développement | `app/` | `npm run dev` |
| Dépendances Node | `app/` | `npm install` |
| Dépendances Python (dev) | `app/` | `python -m pip install -r python/requirements.txt` |
| Artefact décompressé | `app/` | `npm run build` |
| Empaquetage (OS de build) | `app/` | `npm run dist` |
| Installateur Windows + Python embarqué | `app/` | `npm run dist:win` |
| Bundle Python Windows seul | `app/` | `npm run bundle:python-win` |

---

## Contribution

- Respecter la chaîne de qualité : `npm run test:all` dans `app/` avant proposition de fusion.
- Ne pas committer de secrets ; suivre les conventions ESLint/Prettier du projet.
- Toute évolution de l’ordre des scripts dans `index.html` ou des clés i18n doit rester alignée avec `app/scripts/verify-05-dev-assets.mjs` et `docs/05-Dev.md`.

---

## Licence

**Aucun fichier `LICENSE` n’a été trouvé à la racine de ce dépôt.** Les dépendances tierces conservent leurs licences propres (fichiers générés par electron-builder, notices Chromium/Electron dans les artefacts de build). Pour une publication publique, ajouter une licence explicite au dépôt est recommandé.
