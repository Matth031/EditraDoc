# ADR-001: IIFE + `bind()` pour le découpage renderer (F04)

## Statut

Accepté

## Date

2026-07-24

## Contexte

Le renderer Electron était un monolithe (`renderer.js`) difficile à tester et à faire évoluer.
Le chantier F04 a extrait des modules (history, annotations, geometry, keymap, pdf-viewer, etc.)
sans introduire de bundler côté renderer : `index.html` charge une chaîne de `<script>` classiques,
puis `renderer.js` orchestre.

Contraintes fortes :

- Surface de chargement stable (S7 / `index.html` versionné, ordre des scripts critique).
- Pas de pipeline ESM/bundler obligatoire pour le renderer en développement local.
- Modules devant partager un graphe de dépendances **injecté** (évite imports circulaires durs).
- Geometry (P4) génère déjà une IIFE commitée ; aligner le pattern facilite la cohérence.

## Décision

Chaque module renderer extrait est une **IIFE** qui expose une façade sur `window.__editify…`
avec au minimum `bind(deps)` (injection manuelle des dépendances), parfois `wire()` pour les listeners.

`renderer.js` reste la **composition root** : il possède l’ordre de `bind()` et passe les callbacks /
références nécessaires. Les modules n’importent pas d’autres modules via `import`/`require` ;
ils consomment uniquement ce qui a été injecté.

## Alternatives envisagées

- **ESM natif (`type="module"` + imports)**  
  Avantages : graphiques de dépendances explicites, tree-shaking potentiel.  
  Rejeté pour l’instant : changerait le modèle de chargement Electron/file://, imposerait un ordre
  d’évaluation différent, et forcerait une migration massive (preload, chemins relatifs, tests E2E).
  Les cycles « annotations ↔ history ↔ renderer wrappers » seraient plus douloureux sans injection.

- **Bundler complet (esbuild/webpack/vite) pour le renderer**  
  Avantages : DX moderne, modules TS natifs, HMR.  
  Rejeté pour F04 : coût d’outillage + surface de régression S7 ; le projet a volontairement
  limité le TS « emit + artefact commité » (P4 geometry, P1 contracts main) plutôt qu’un bundler UI.

- **Classes / singletons globaux sans `bind()`**  
  Rejeté : couple fort au moment du chargement du script, difficile à tester en isolation (vm/jsdom).

## Conséquences

### Positives

- Extraction incrémentale sans big-bang bundler.
- Modules testables en Node via `vm` + faux `window` (P6) en mockant `bind()`.
- Ordre de boot **lisible** et centralisé dans `renderer.js` + `index.html`.

### Négatives / à surveiller

- `bind()` verbose ; risque de dépendances « fourre-tout » (ex. `annotationsMod.bind` très large).
- Pas de vérification statique des deps manquantes (échec runtime `requireDeps()`).
- La composition root reste un fichier long ; la dette se déplace vers l’orchestration, pas disparaît.

## Quand ce choix cesserait d’être le bon

Reconsidérer ESM + bundler (ou TS project references) si :

- le nombre de modules et la taille de `bind()` rendent les erreurs de câblage fréquentes ;
- on introduit un vrai graphe de packages partagés hors Electron ;
- la CI exige du tree-shaking / code-splitting renderer pour la perf.

Jusque-là, IIFE + `bind()` reste le compromis assumé post-F04.
