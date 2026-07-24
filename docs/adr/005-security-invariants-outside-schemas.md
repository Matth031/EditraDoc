# ADR-005: Invariants de sécurité (S*) hors schémas JSON

## Statut

Accepté

## Date

2026-07-24

## Contexte

P1 a formalisé des contrats de **forme** (JSON Schema). En parallèle, le projet maintient des
**invariants de sécurité** (série S1, S6, S13, S19, …) vérifiés par `security-lock.test.js` et du
code garde-fou (`path-guard`, registres d’ouverture PDF, plafonds image, audit export opt-in).

Risque : encoder un invariant dans le schéma « pour simplifier », ou le dupliquer naïvement dans
Ajv **et** Python, puis diverger.

## Décision

1. **Les schémas JSON valident la forme** (types, required, unions discriminées, bornes numériques
   structurelles). Ils **ne remplacent pas** les invariants S*.

2. **Chaque invariant S* a une source de vérité code** (souvent double Node + Python quand le
   risque traverse la frontière) + tests `INVARIANT S…` dédiés.

3. Exemples actés lors de P1 :
   - **S1** (co-localisation chemins sortie/entrée) : `path-guard.js` + `_assert_output_in_same_directory_as_input` — le contrat `job:create` / merge ne « relâche » pas S1.
   - **S13** (plafond décodage image annotation) : hors schéma apply-annotations.
   - **S6** (whitelist chemins PDF ouverts) : hors schéma `pdf:read-bytes`.
   - **S19** (audit export / PII) : hors métriques E4 et hors logs verbeux.

4. Un test de contrat peut **prouver** qu’un payload hors dossier passe le schéma mais échoue le
   path-guard (pattern P1 `job:create`) — pour documenter la frontière, pas pour affaiblir S1.

## Alternatives envisagées

- **Tout mettre dans JSON Schema (formats custom, patterns de chemins)**  
  Rejeté : fragile cross-OS, difficile à partager Node/Python, faux sentiment de sécurité.

- **Uniquement tests E2E pour les S***  
  Rejeté : trop lents / flaky ; `security-lock` unit/integration reste la barrière rapide.

- **Fusionner ADR-003 et ADR-005**  
  Rejeté : audiences différentes (contrat de forme vs politique sécurité) ; P1 les a volontairement séparés.

## Conséquences

### Positives

- Revue P1 / nouveaux canaux : checklist « schéma + invariants touchés ».
- Moins de risque de « relaxation accidentelle » via un schéma trop permissif ou trop strict.

### Négatives / à surveiller

- Charge cognitive : contributeur doit lire contrats **et** liste S*.
- Ticket ouvert ex. `TKT-BUG-PDF-RENDER-RACE-001` n’est pas un S* mais montre qu’un soft-path E2E
  (FLK-E2E-001) peut compenser un bug produit — à ne pas confondre avec un invariant sécurité.

## Lien

- Tests : `app/node-tests/security-lock.test.js`
- Contrats : `app/src/contracts/`
- Soft-path E2E documenté : `app/e2e/helpers.js` (`waitForPdfPagesRendered`)
