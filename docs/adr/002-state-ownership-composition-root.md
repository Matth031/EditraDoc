# ADR-002: Ownership de `state` et composition root

## Statut

Accepté

## Date

2026-07-24

## Contexte

Après F04, plusieurs modules mutent le modèle UI (onglets, annotations, sélection, édition texte,
rotations de page). Sans règle d’ownership claire, on risque des doubles sources de vérité
(copie locale vs `state`) ou des mutations hors undo.

## Décision

1. **`renderer.js` possède `state`** (objet unique créé dans la composition root) et les refs DOM /
   `pdfLayerRef` / `pointer` / styles texte partagés. Les modules reçoivent `state` (ou des getters)
   via `bind()` — ils **ne créent pas** leur propre store parallèle.

2. **Données métier d’un onglet** vivent sur l’objet tab dans `state.tabs[]` :
   `annotationsByPage`, `undoStack` / `redoStack`, `pageRotationsByPage`, `viewportByPage`, `dirty`, etc.
   History (`renderer-annotation-history`) est le **seul** module autorisé à empiler/restaurer les
   snapshots undo/redo ; les autres modules appellent `captureSnapshot` injecté (souvent wrappé
   depuis `historyMod`).

3. **Coordination des mutations UI** :
   - mutation modèle → souvent `captureSnapshot` puis mutation ;
   - puis `syncPropertyInputs` / `renderAnnotations` / `session.scheduleAutoSave` selon le flux ;
   - undo/redo : `applySnapshot` puis `finishUndoRedoUi` (nullifie `selectedAnnotationId` et
     `editingAnnotationId` — TKT-BUG-UNDO-EDIT-001).

4. **Facades de délégation** dans `renderer.js` (`clamp`, `renderAnnotations`, `undo`, `savePdfAs`…)
   existent pour câbler les modules entre eux sans imports croisés.

## Alternatives envisagées

- **Store externe (Redux / Zustand / signals)**  
  Rejeté : surcoût et migration ; le modèle tab-centric + snapshots JSON suffit au produit local-first.

- **Chaque module possède une slice isolée**  
  Rejeté : la session, l’export et l’undo ont besoin d’une vue cohérente multi-champs sur le même tab.

- **Event bus global sans ownership**  
  Rejeté : débogage opaque ; l’audit qualité privilégie des frontières explicites.

## Conséquences

### Positives

- Une seule source de vérité pour sélection / édition / onglets.
- Undo/redo et session savent quoi sérialiser.
- Tests unitaires history peuvent muter un faux `state` injecté.

### Négatives / à surveiller

- `state` reste un « god object » logique ; la discipline d’accès repose sur la revue + conventions.
- Wrappers dans `renderer.js` peuvent diverger du module (à éviter : logique métier hors façade).

## Règle pratique

Si un module a besoin d’une donnée : l’injecter via `bind()`, ne pas relire un global caché.
Si une mutation doit être annulable : passer par `captureSnapshot` avant d’écrire le modèle.
