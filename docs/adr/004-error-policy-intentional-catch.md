# ADR-004: Politique d’erreurs E0–E4 (catch intentionnel vs logué)

## Statut

Accepté

## Date

2026-07-24

## Contexte

Historique de nombreux `catch {}` / `.catch(() => {})` silencieux rendant les régressions
indébogables (session boot, undo, i18n, cleanup DOM). Le chantier E0–E4 a imposé une convention
plutôt qu’un framework d’erreurs.

Référence opérationnelle : `app/src/renderer/ERROR-POLICY.md`.

## Décision

Adopter une **politique à trois voies** pour tout `catch` :

| Voie | Quand | Forme |
|------|-------|--------|
| **Intentionnel silencieux** | cleanup / best-effort UI sans impact utilisateur | `catch { /* intentional: <raison ≥ 3 mots> */ }` |
| **Logué** | dégradation utile au diagnostic | `warn` / `error` via `__editifyReportError` / `logEvent` (scope stable) |
| **Remonté (+ UI légère)** | état perçu incorrect (session, delete, texte non sauvé…) | log `error` + `setStatus` / toast sans PII ni chemins |

Outillage :

- ESLint `editify/intentional-catch` → **error** (depuis fin E3).
- E4 : compteurs locaux `error-metrics.json` + seuil soft `monitor:threshold` (pas d’UI Santé E5).

## Alternatives envisagées

- **Bibliothèque Result / Either / neverthrow partout**  
  Avantages : exhaustivité compile-time.  
  Rejeté pour E0–E4 : migration invasive du monolithe + modules IIFE ; peu de bénéfice immédiat sur
  les centaines de catch DOM/Electron déjà idiomatiques en try/catch. Peut être reconsidéré pour
  **nouveaux** modules purs (geometry/contracts) au cas par cas.

- **Exceptions typées custom uniquement**  
  Insuffisant seul : n’oblige pas à traiter les catch existants ; le lint sur le silence est le levier.

- **Sentry / télémétrie cloud**  
  Hors modèle local-first ; E4 reste fichier local opt-in, aligné S19 (pas de PII / textHtml).

## Conséquences

### Positives

- Catch vides interdits en CI.
- Scopes stables → corrélation monitoring E4 et futurs tickets `TKT-ERR-…`.
- Différenciation claire best-effort vs panne utilisateur.

### Négatives / à surveiller

- Commentaires `intentional:` peuvent pourrir (« best-effort » fourre-tout) — revue humaine.
- Pas de typage des erreurs métier ; les messages restent des strings.
- E5 (UI Santé) non livré : l’opérateur lit encore `logs.txt` / métriques fichier.

## Non-buts

- Ne pas remplacer les retours `{ ok: false, error }` des IPC / jobs.
- Ne pas logger de secrets, chemins complets, ni contenu HTML d’annotations (S19).
