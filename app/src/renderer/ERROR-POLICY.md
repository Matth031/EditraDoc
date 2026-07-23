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
| E3 | Promesses boot + passage lint en **error** |
| E4 | Métriques locales (`error-metrics.json`) |

## Lint — mode signalement (E0–E3)

- Règle `editify/intentional-catch` : **`warn`** (pas `error`)
- `npm run lint` / CI : **exit 0** tant qu’il n’y a que des warnings (pas de `--max-warnings 0`)
- Fin E3 : passer la règle en **`error`** pour bloquer les nouveaux catch silencieux

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
