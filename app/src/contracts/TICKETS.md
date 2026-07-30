# Tickets contrats P1 (suivi léger)

## TKT-P1-LIMIT-HTTP-VS-S13-001 — Tension HTTP 64 Mo vs S13 80 Mo

| Champ | Valeur |
|-------|--------|
| **Statut** | Ouvert (2026-07-23) — suivi ; **pas de correctif dans le lot contrats export/apply** |
| **Priorité** | Basse (edge case image annotation très lourde) |
| **Contexte** | `pdf_service.MAX_POST_BODY_BYTES` = **64 Mo** (HTTP 413) ; S13 / `_decode_annotation_image_base64` = **80 Mo** |
| **Risque** | Un `src_base64` entre 64 et 80 Mo est refusé au HTTP **avant** S13 |
| **Hors scope immédiat** | JSON Schema P1 (S13 reste hors schéma) |
| **Action ultérieure** | Aligner plafonds (HTTP ≥ 80 Mo **ou** S13 ≤ 64 Mo) + tests ; arbitrage Matt |

Mirror local aussi dans `docs/06-Test-Matrix.md` (hors dépôt git).

---

## TKT-ERR — règle de suivi monitoring (E4)

| Champ | Valeur |
|-------|--------|
| **Déclencheur** | Même `scope` franchit le seuil soft (`monitor:threshold`, ≥5 / 15 min) sur **≥ 3 sessions process** distinctes (champ `thresholdSessions` dans `error-metrics.json`) |
| **Action** | Ouvrir un ticket `TKT-ERR-<scope-slug>-NNN` ici **et** miroir dans `docs/06-Test-Matrix.md` (comme FLK-E2E-001) |
| **Contenu ticket** | scope, niveaux observés, `messageHash` (pas de PII / pas de textHtml), fréquence sessions |
| **Hors scope** | Panneau UI Santé (E5) |

## TKT-FLK-E2E-002 — `app.evaluate` menu Langue (contexte CDP main détruit)

| Champ | Valeur |
|-------|--------|
| **Statut** | **Clos** (2026-07-30) — CI Linux/xvfb verte sur `ac5fe9c` (run [30498539763](https://github.com/Matth031/EditraDoc/actions/runs/30498539763), e2e success) |
| **Symptôme** | `electronApplication.evaluate: Execution context was destroyed, most likely because of a navigation` dans `waitForNativeLanguageRadios` / ancien `getNativeLanguageRadioChecked` |
| **Repro** | Windows isolé : **4/8** avant correctif (échec à l’assert après `setLanguage("es")`). xvfb Docker indisponible localement (daemon off) ; CI Linux `cd9523a` échoue sur ce spec |
| **Cause produit** | **Pas** de `window.reload()` sur changement de langue. Chemin : `setLanguage` → `notifyUiLanguage` → `createMenu`/`Menu.setApplicationMenu` + `warmSpellcheckDictionariesBackground`. Le seul reload du scénario est le `page.reload()` explicite (persistance `editify:lang`) |
| **Cause harness** | Flake connu Playwright + Electron ≥27 : invalidation du contexte CDP du **processus main** pendant `app.evaluate`, pas une navigation renderer. Aggravé si on poll le Menu pendant/juste après `createMenu` sans attendre l’IPC |
| **Correctif** | (1) `setLanguage` **await** `notifyUiLanguage` ; (2) E2E `setLanguage` async ; (3) `waitForNativeLanguageRadios` attend l’état menu et ne retry le `evaluate` que sur « Execution context was destroyed » ; (4) après reload, resync `setLanguage("en")` pour sérialiser `createMenu` |
| **Ne pas** | Retry générique sur toute erreur `evaluate` ; documenter comme « navigation produit » |
| **Miroir** | `docs/06-Test-Matrix.md` (hors dépôt) si maintenu localement |

## TKT-FLK-E2E-003 — `app.evaluate` send `pdf:open-from-menu` (contexte CDP main)

| Champ | Valeur |
|-------|--------|
| **Statut** | Ouvert (2026-07-31) — CI macOS après partage Python (~15,9 min) |
| **Symptôme** | `electronApplication.evaluate: Execution context was destroyed` dans `launchWithPdf` (`app.page-rotate` AC-ROT-03) et `app.session-boot` (rejet 50 Mo) |
| **Repro** | Windows isolé sans attach : **0/6** (marge cold-start). CI macOS suite accélérée : 2 échecs / run. |
| **Cause** | Même famille CDP main qu’E2E-002 ; point d’appel **différent** (`send pdf:open-from-menu` juste après `firstWindow`), exposé quand le cold-start Python (~32 s) ne sérialise plus les launches |
| **Correctif** | `helpers.evaluateInElectronMain` (retry ciblé « destroyed ») + `openPdfFromMenu` attend `maniPdfApi` avant send ; specs branchées dessus |
| **Ne pas** | Retry générique ; confondre avec navigation renderer |

---
