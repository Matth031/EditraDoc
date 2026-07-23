# Politique d’erreurs (EditraDoc)

Référence chantier E0–E4. Point d’entrée code : `renderer-error-log.js` (`__editifyReportError` / `logEvent`).

## Règle

Un `catch` sans signal = dette. Soit on **justifie**, soit on **logue**, soit on **remonte**.

| Situation | Action | Niveau / canal |
|-----------|--------|----------------|
| Cleanup / API DOM optionnelle / best-effort UI | Silencieux **légitime** | `catch { /* intentional: <raison courte> */ }` — **raison obligatoire** (≥ 3 mots métier) |
| Échec non bloquant mais utile au diagnostic | Logger | `warn` via `__editifyReportError` / `logEvent` (scope stable) |
| Échec qui change l’état perçu (texte non sauvé, session non chargée, delete KO) | Logger **+** signal utilisateur léger | `error` + `setStatus` / toast (sans chemin ni PII) |
| Échec critique métier (export, open PDF) | Déjà partiellement couvert | Garder `error` + UI existante ; **ne pas** avaler |

## Niveaux (`app-log-core`)

- `error` — état utilisateur incorrect ou donnée perdue / non persistée
- `warn` — dégradation (i18n, fullscreen, spell…)
- `info` / `debug` — hors catch (verbose)

## Interdits

- `catch {}` nu
- `.catch(() => {})` nu

Forme promise légitime :

```js
.save().catch((err) => {
  /* intentional: autosave best-effort, déjà loggé dans session.saveSession */
  void err;
});
```

ou mieux : logger explicitement dans le `.catch`.

## Lint

Règle ESLint locale `editify/intentional-catch` :

- Signale les `catch` vides ou commentés sans préfixe `intentional:`
- **warn** pendant E1–E3 (CI non bloquante)
- **error** à partir de fin E3

## Lots

| Lot | Contenu |
|-----|---------|
| E0 | Cette doc + lint **warn** (CI non bloquante) |
| E1 | Cluster sync texte / delete (impact utilisateur) |
| E2 | Annoter les (a) restants + e2e/main `/* ignore */` — **fait** (`intentional:` + quelques (b)/(c) via report/logWarn) |
| E3 | Promesses boot + passage lint en **error** — **fait** |
| E4 | Métriques locales (`error-metrics.json`) — **fait** (fondation, pas d’UI) |
| E5 | (opt) UI Santé — hors scope |

## Monitoring E4 (`error-metrics.json`)

- Compteurs `(level, scope)` en fenêtre **15 min**, message normalisé (≤80 chars, chemins masqués)
- Seuil soft : **≥5** même `scope` / 15 min → `warn` `monitor:threshold` dans `logs.txt`
- Fichier à côté de `logs.txt`, flush atomique ~30 s (immédiat au seuil)
- **S19** : pas de `textHtml` / chemins complets / audit export dans les métriques (`export-audit` exclu)
- Suivi tickets : si le même scope franchit le seuil sur **≥3 sessions process** distinctes → ouvrir `TKT-ERR-…` (voir `app/src/contracts/TICKETS.md`, miroir `docs/06-Test-Matrix.md`)

## Lint — mode bloquant (fin E3)

- Règle `editify/intentional-catch` : **`error`**
- `npm run lint` / CI : exit ≠ 0 si catch silencieux sans `intentional:`

### Impact mesuré à l’activation E0 (~2026-07-23)

| Zone | Ordre de grandeur |
|------|-------------------:|
| `renderer.js` | ~39 → **32** après E1 (vides + `/* ignore */` restants) |
| `src/renderer` (hors monolithe) | ~130 |
| `src/main` | ~35 |
| `e2e` | ~23 (`catch {}` clear storage, etc.) |
| `scripts` | ~4 |
| **Total `npm run lint`** | **~232 warnings, 0 errors** (exit 0) |

Périmètre **plus large** que l’inventaire initial `renderer.js` seul — attendu : la règle exige `intentional:` même quand un commentaire `ignore` existe déjà. Nettoyage E2 (annoter) / E3 (promesses + passage en `error`).
