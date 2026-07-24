# ADR-003: Contrats typés P4/P1 (tsc → artefacts + JSON Schema partagé)

## Statut

Accepté

## Date

2026-07-24

## Contexte

Besoin de freiner le drift des payloads IPC / HTTP (main Node ↔ renderer, main ↔ service Python)
sans imposer un monorepo TypeScript complet ni un bundler renderer.

P4 (GeometryPort) a validé : **source TS + artefact JS commité + check CI de dérive**.
P1 étend la discipline aux canaux critiques (`pdf:read-bytes`, `pdf:open`/`validate`,
`apply-annotations`, `job:create`) avec **validation runtime des deux côtés**.

## Décision

1. **Sources de vérité écrites en TypeScript** sous `app/src/contracts/ts/` (et geometry sous
   `app/src/renderer/ts/geometry/`).

2. **Emit :**
   - contracts → **CJS** consommable par `require()` dans le main Electron ;
   - geometry → **IIFE** commitée (`renderer-geometry.js`) pour le renderer script-tag.

3. **JSON Schema Draft-07** généré/commité sous `app/src/contracts/schemas/` — même artefact lu par :
   - **Ajv** (main, avant handlers IPC / avant logique métier) ;
   - **jsonschema** (Python, avant ops `pdf_ops` sur `/validate`, `/apply-annotations`, `/merge`, …).

4. **CI :** `check:contracts-artifact` / `check:geometry-artifact` échouent si l’artefact drift ;
   harness « mauvais appel » TS (`test:contracts-contract`) prouve que le typage rejette les abus.

5. **Hors schéma** : existence disque, co-localisation S1, plafonds S13, etc. restent dans le code
   garde-fou (voir ADR-005).

## Alternatives envisagées

- **Pydantic seul côté Python** (sans JSON Schema partagé)  
  Rejeté : deux modèles divergents Node/Python ; le bug typique est exactement le drift cross-language.

- **Bundler / ESM partout (renderer + main)**  
  Rejeté pour ce lot : hors périmètre ; P4/P1 ciblent la frontière de contrat, pas la DX UI complète.

- **Types TS seulement (pas de validation runtime)**  
  Rejeté : le renderer et Python ne bénéficient pas du checker ; un payload malformé passerait en prod.

- **OpenAPI / protobuf**  
  Surdimensionné pour IPC local + petites routes HTTP loopback.

## Conséquences

### Positives

- Double frontière runtime (critère P1 #1) : rejet avant ops coûteuses / dangereuses.
- Artefacts commités = reproductibilité sans rebuild local obligatoire pour lire le contrat.
- Vague 1 IPC closable canal par canal avec la même discipline.

### Négatives / à surveiller

- Discipline manuelle `build:contracts` / `build:geometry` avant commit (mitigée par CI drift).
- Schémas JSON verbueux pour unions (annotations Text|Image|Shape).
- Ne remplace pas les invariants sécurité (ADR-005).

## Amendements

- Vague 2 (ex. `session:save`) : même pattern si le canal est critique ; sinon rester hors P1.
