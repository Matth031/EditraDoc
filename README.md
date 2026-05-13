# 🚀 EditraDoc

## Installation (Windows — 30 secondes)

👉 Télécharger l’application :
https://github.com/Matth031/EditraDoc/releases/download/v1.0.0/EditraDoc-Setup.exe

Puis :

* Double-cliquer sur le fichier téléchargé
* Suivre les étapes d’installation

✅ Aucun prérequis technique
✅ Pas besoin d’installer Node.js ou Python

---

## Ce que fait EditraDoc

- Ouvrir un PDF et naviguer page par page
- Ajouter du texte, des formes et des images
- Enregistrer une nouvelle version du PDF
- Fusionner, diviser, compresser, protéger/déprotéger (outils PDF intégrés)

## Confidentialité (en pratique)

- Les fichiers sont traités sur la machine.
- L’application n’impose pas l’envoi du document vers un service en ligne.

Pour les détails techniques, la sécurité, les tests et l’architecture: voir la section développeur ci-dessous.

---

## 🛠️ Documentation développeur (utilisateurs avancés uniquement)

---

## Présentation

**EditraDoc** est un outil de manipulation de PDF orienté **confidentialité** et **simplicité** : les fichiers restent sur le poste, le rendu et les interactions passent par une fenêtre Electron et des processus locaux.

**Problème adressé** : de nombreux services en ligne imposent l’**envoi** des PDF sur des serveurs tiers pour fusionner, diviser ou compresser. Cela peut être incompatible avec des contraintes de confidentialité ou de politique interne.

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
- **Annotations** : zones de texte enrichi (édition dans le document), formes, images ; annulation / rétablissement (undo / redo).
- **Propriétés** : couleurs, polices, marges pour le texte ; remplissage, contour, opacité pour les formes.
- **Menus contextuels** pour le texte, les formes, les images et la zone de page vide.
- **Découpe avancée** : définition de **groupes de pages** (overlay dédié).
- **Outils PDF** (via Python / pypdf) : **fusion**, **division** (plage ou groupes), **compression**, **protection** et **déprotection** par mot de passe.
- **Enregistrement** : export PDF en intégrant annotations et calques (route `/apply-annotations` côté service Python).
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
| **Tests automatisés** | Unitaires Python, tests Node (`node:test` + c8), vérifications statiques, Playwright E2E, smoke orthographe. |
| **Architecture Electron + Python** | UI et IPC dans Node/Electron ; opérations PDF dans `pdf_service.py` (pypdf, reportlab pour l’export annoté). |

---

## Stack technique

| Couche | Technologies |
|--------|----------------|
| **Shell applicatif** | Electron 41 (`app/package.json`, `main`: `src/main/main.js`) |
| **Pont sécurisé** | `preload.js`, API exposée au renderer sous `window.maniPdfApi` |
| **Renderer** | HTML/CSS/JS vanilla ; **pdf.js** via `pdfjs-dist` et `pdfjs-bridge.mjs` |
| **Service PDF** | Python 3, **pypdf**, **reportlab** (`app/python/requirements.txt`), serveur `http.server` sur **127.0.0.1:8765** |
| **Orthographe** | **nspell** + `dictionary-fr`, `dictionary-en`, `dictionary-es`, `dictionary-pt-br` |
| **Qualité** | ESLint 10, Prettier 3, c8, Playwright |
| **Empaquetage** | electron-builder (cibles configurées : Windows NSIS, Linux AppImage, macOS dmg) |

---

## Architecture du projet

Arborescence utile (extraits) :

```text
07-Manip_PDF/
├── .github/workflows/     # CI (tests) + release Windows (installateur .exe)
├── docs/                    # Documentation projet (dont 05-Dev.md)
├── public/                  # Ressources statiques (ex. logo)
├── tests/                   # Jeux de fichiers pour tests (ex. PDF de test E2E)
├── package.json             # Scripts racine déléguant à app/
└── app/
    ├── public/              # Assets packagés (logos, images) référencés par le renderer
    ├── e2e/                 # Tests Playwright
    ├── node-tests/          # Tests Node (main / lib)
    ├── python/              # Service HTTP, pdf_ops, tests unittest
    ├── scripts/             # verify-05-dev-assets, bundle-python-embed-win, spellcheck-smoke, …
    ├── src/
    │   ├── main/            # Processus Electron (IPC, jobs, spellcheck)
    │   ├── lib/             # Ex. session-log-store
    │   └── renderer/        # UI, viewer, i18n, annotations
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
| `npm run e2e` | Playwright |
| `npm run test:all` | Chaîne complète (qualité + tests + audit + e2e) |

À la racine du dépôt, `npm run test` et `npm run e2e` relaient vers `app/` via `npm --prefix app`.

---

## Sécurité et confidentialité

- **Traitement local** : ouverture des fichiers via dialogues natifs ; opérations PDF traitées par le processus Python **sur la machine**, via **127.0.0.1** (pas d’exposition réseau du serveur HTTP sur toutes les interfaces - voir `pdf_service.py`).
- **Pas de dépendance réseau imposée pour le cœur métier** : le flux nominal des opérations PDF ne repose pas sur un API distant documenté dans ce dépôt. **Exception** : si l’utilisateur active une action qui ouvre une **URL externe** (ex. lien dans « À propos »), le système utilise `shell.openExternal` avec **http/https uniquement** (`main.js`).
- **Code auditable** : dépôt source consultable ; pas de garantie de sécurité absolue.
- **HTML** : le contenu éditable des zones texte passe par `sanitizeTextHtml` (`renderer-text-html.js`) - réduction du risque XSS, avec limite explicitée dans les commentaires du code (ce n’est pas équivalent à un sanitizer maximaliste type DOMPurify).
- **Validation** : contrôles côté processus principal sur les charges utiles des jobs (`validateJobPayload`) ; validation des chemins PDF côté Python pour `/validate`.

---

## Cas d’usage

- Préparer ou **compléter des formulaires PDF** sans les héberger en ligne.
- Travailler sur des documents **sensibles** (RH, juridique, médical, etc.) lorsque la politique impose de **ne pas** les envoyer sur des services tiers.
- Utiliser l’outil **hors connexion** pour la lecture et les opérations locales (une fois l’application et les dépendances installées).
- Remplir et modifier un formulaire administratif contenant des données personnelles sans passer par un service en ligne.

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

Les **Releases** sont alimentées par le workflow GitHub Actions **Release Windows installer** (`.github/workflows/release-windows.yml`) : sur un tag **`v1.0.0`**, l’installateur est joint à la release ; une exécution manuelle du workflow dépose aussi l’artefact **`editify-windows-setup`** (contenu : **`EditraDoc-Setup.exe`**).

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

Les autres plateformes (`npm run dist` : AppImage, dmg, etc.) s’appuient pour l’instant sur un **Python système** sur la machine cible ; seul le flux **Windows** embarque le runtime Python via `bundle-python-win`.

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
