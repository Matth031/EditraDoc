# Architecture Decision Records (EditraDoc)

Décisions d’architecture **versionnées dans git**, destinées à tout contributeur futur.
Le reste de `docs/` reste gitignoré (process produit interne) ; seul `docs/adr/` est suivi.

## Index

| ADR | Titre | Statut | Date |
|-----|-------|--------|------|
| [ADR-001](./001-iife-bind-renderer-modules.md) | IIFE + `bind()` pour le découpage renderer (F04) | Accepté | 2026-07-24 |
| [ADR-002](./002-state-ownership-composition-root.md) | Ownership de `state` et composition root | Accepté | 2026-07-24 |
| [ADR-003](./003-typed-contracts-tsc-artifacts-jsonschema.md) | Contrats typés P4/P1 (tsc → artefacts + JSON Schema) | Accepté | 2026-07-24 |
| [ADR-004](./004-error-policy-intentional-catch.md) | Politique d’erreurs E0–E4 | Accepté | 2026-07-24 |
| [ADR-005](./005-security-invariants-outside-schemas.md) | Invariants sécurité (S*) hors schémas JSON | Accepté | 2026-07-24 |

## Diagramme

- [Dépendances modules renderer (post-F04 / P1 / P4)](./diagram-renderer-module-deps.md) — reflète le code actuel (`index.html` + `renderer.js`), pas une cible aspirational.

## Convention

- Un fichier = une décision.
- Statuts : Proposé | Accepté | Déprécié | Remplacé par ADR-YYY.
- Ne pas réécrire l’historique : amender via nouvel ADR ou section « Amendements ».
