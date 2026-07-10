# Diagnostic — vérification de mise à jour EditraDoc

**Date :** juillet 2026  
**Statut :** prêt pour cadrage dev  
**Périmètre :** notification opt-in « nouvelle version disponible » (pas d’installation silencieuse)

---

## 1. Objectif produit

Informer les utilisateurs qu’une **nouvelle version** est publiée sur GitHub, sans imposer le réseau au cœur métier PDF.

| Inclus (V1) | Exclu (V1) |
|-------------|------------|
| Vérification **manuelle** ou **opt-in au démarrage** | `electron-updater` / install silencieuse |
| Comparaison version + manifeste `latest.json` (SHA256) | Télémétrie usage |
| Lien « Télécharger » → installateur officiel | Signature code Windows (hors scope) |
| i18n fr/en/es/pt | Vérification hash du binaire déjà installé sur disque |

**URL installateur officiel (stable) :**

```text
https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe
```

**URL manifeste proposée (à publier en CI sur chaque tag `v*`) :**

```text
https://github.com/Matth031/EditraDoc/releases/latest/download/latest.json
```

Alternative : asset nommé `latest.json` attaché à la release (même domaine `github.com`, allowlist simple).

---

## 2. État actuel du dépôt (gaps)

| Élément | État | Impact |
|---------|------|--------|
| Distribution | NSIS `EditraDoc-Setup.exe` via `release-windows.yml` | OK |
| `package.json` version | `1.1.0` | Source semver build |
| UI « À propos » | **`v1.0.0` en dur** (`renderer-app-chrome.js` L144, L163) | **Bloquant** — incohérent |
| `electron-updater` | Absent | Volontaire |
| Manifeste release | **Non généré** | À ajouter en CI |
| `build-info` embarqué | Absent | Nécessaire pour comparer build locale vs distante |
| Réseau renderer | CSP sans Internet ; OK via **IPC main** | Pattern existant (`shell:openExternal`) |
| Settings persistants | `app-settings.json` (`logFilePath` seul) | Étendre pour `checkUpdates` |
| Tests Node CI | `run-node-tests.mjs` (cross-plateforme) | OK post-fix juillet 2026 |

---

## 3. Architecture cible (V1)

```text
release-windows.yml (tag v*)
  → build EditraDoc-Setup.exe
  → SHA256(setup.exe)
  → latest.json { version, tag, publishedAt, windows: { url, sha256, size }, releaseNotesUrl }
  → attach .exe + latest.json à la GitHub Release

Build app (electron-builder)
  → scripts/write-build-info.mjs
  → public/build-info.json ou src/generated/build-info.json
     { version, gitCommit, buildTime }

main.js (au démarrage si opt-in, ou IPC manuel)
  → update-check.js : GET latest.json (HTTPS, timeout 8s)
  → compare semver (installed vs remote)
  → cache résultat { checkedAt, updateAvailable, remoteVersion, downloadUrl, sha256 }
  → IPC update:get-status / update:check-now

renderer
  → Options : case « Vérifier les mises à jour » (défaut OFF)
  → Menu / toast si updateAvailable
  → Bouton → openExternal(downloadUrl) ou page release
```

**Principe sécurité :** requête **uniquement** depuis le process **main** ; URL manifeste **figée** (constante + validation hostname `github.com`).

---

## 4. Format `latest.json` (proposition)

```json
{
  "schemaVersion": 1,
  "product": "EditraDoc",
  "version": "1.2.0",
  "tag": "v1.2.0",
  "publishedAt": "2026-07-10T14:00:00Z",
  "releaseNotesUrl": "https://github.com/Matth031/EditraDoc/releases/tag/v1.2.0",
  "assets": {
    "windows": {
      "filename": "EditraDoc-Setup.exe",
      "url": "https://github.com/Matth031/EditraDoc/releases/download/v1.2.0/EditraDoc-Setup.exe",
      "latestUrl": "https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe",
      "sha256": "abcdef…",
      "size": 123456789
    }
  }
}
```

**Usage du SHA256 :** affiché dans la release + permet à un utilisateur avancé de vérifier le fichier téléchargé ; l’app V1 **n’a pas besoin** de re-hasher le setup local installé.

---

## 5. Modules à créer / modifier

### 5.1 CI / build

| Fichier | Action |
|---------|--------|
| `.github/workflows/release-windows.yml` | Après `dist:win` : script `write-latest-manifest.mjs` + upload `latest.json` |
| `app/scripts/write-build-info.mjs` | Génère `build-info.json` avant `electron-builder` |
| `app/scripts/write-latest-manifest.mjs` | SHA256 du `.exe`, semver depuis `package.json` / tag |
| `app/package.json` | Hook `predist:win` ou intégration dans `dist:win` |

### 5.2 Main (Electron)

| Fichier | Action |
|---------|--------|
| `src/main/lib/update-check.js` | Fetch manifeste, parse Zod, compare semver, cache mémoire |
| `src/main/lib/build-info.js` | Lit version/commit embarqués |
| `src/main/app-settings.js` | `checkUpdatesOnStartup: boolean` (défaut `false`) |
| `src/main/main.js` | IPC `update:check-now`, `update:get-status` ; check différé au `ready` si opt-in |
| `src/main/preload.js` | Exposer API minimale au renderer |

### 5.3 Renderer

| Fichier | Action |
|---------|--------|
| `renderer-app-chrome.js` | **Corriger** `aboutVersion` → lire version depuis IPC (plus de `v1.0.0` hardcodé) |
| `renderer-update-ui.js` (nouveau) | Option menu + bandeau discret « Mise à jour disponible » |
| `renderer-i18n-data.js` | Clés `stUpdateAvailable`, `optCheckUpdates`, etc. |
| `index.html` | Script + entrée menu Options si besoin |

### 5.4 Tests

| Test | Type |
|------|------|
| `node-tests/update-check.test.js` | Parse manifeste, semver, URL allowlist, timeout |
| `node-tests/build-info.test.js` | Lecture build-info |
| `node-tests/app-settings-update.test.js` | Persistance opt-in |
| E2E (optionnel V1) | Mock IPC → bandeau visible si `updateAvailable` |

---

## 6. Règles sécurité / confidentialité

1. **Opt-in explicite** — pas de requête réseau sans consentement (sauf action manuelle « Vérifier maintenant »).
2. **Fail-silent** — hors ligne / 404 / JSON invalide → pas d’erreur bloquante ; log `info` côté main uniquement.
3. **Allowlist** — hostname `github.com` ; chemins `/Matth031/EditraDoc/releases/…` ; rejeter redirects hors domaine.
4. **Pas de données utilisateur** dans la requête (pas de PDF, chemins, machine id).
5. **Pas de `fetch` renderer** — conserver CSP stricte ; IPC uniquement.
6. **Fréquence** — au plus 1 check / 24 h si opt-in démarrage (cache `lastCheckAt` dans `app-settings.json`).

---

## 7. Découpage épique (ordre de dev recommandé)

| # | Story | Effort | DoD |
|---|-------|--------|-----|
| **UPD-01** | `build-info.json` généré au build + version réelle dans « À propos » | S | UI affiche `1.1.0` ; commit SHA visible en debug |
| **UPD-02** | `write-latest-manifest.mjs` + CI release | S | Chaque tag publie `latest.json` + SHA256 |
| **UPD-03** | `update-check.js` + tests Node | M | Compare semver ; mock fetch |
| **UPD-04** | IPC + `app-settings` opt-in | S | Settings persistés ; défaut OFF |
| **UPD-05** | UI notification + lien téléchargement | M | i18n 4 langues ; `openExternal` vers URL officielle |
| **UPD-06** | Doc README + note confidentialité | S | Section « Vérification de version » |

**Estimation totale V1 :** 3–5 jours dev + tests.

---

## 8. Hors périmètre V2 (à documenter, pas à coder maintenant)

- **Auto-install** via `electron-updater` + `latest.yml`
- **Signature Authenticode** (SmartScreen)
- **Linux / macOS** assets dans `latest.json`
- **Canal bêta** (`beta.json`)
- **Vérification intégrité** post-téléchargement dans l’app (lancer helper PowerShell / certutil)

---

## 9. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| GitHub API / rate limit | Manifeste statique `latest.json` (pas d’API REST) |
| `releases/latest/download` change de cible | Comparer **semver** dans JSON, pas seulement l’URL |
| Utilisateur désactive réseau d’entreprise | Fail-silent ; lien manuel dans README |
| Manifeste compromis (compte GitHub) | SHA256 public sur page release ; même modèle de confiance que le binaire |
| Régression CSP | Revue grep : aucun `fetch` vers Internet dans `src/renderer/` |

---

## 10. Critères d’acceptation V1

- [ ] Par défaut, **aucune** requête réseau update au démarrage.
- [ ] Option activée → une vérification au lancement (max 1/jour).
- [ ] « Vérifier les mises à jour » dans Options déclenche un check immédiat.
- [ ] Si `remote.version` > `installed.version` → message clair + bouton ouvrant l’URL officielle.
- [ ] `latest.json` publié automatiquement sur chaque release taguée.
- [ ] `npm run test:node` + CI verts.
- [ ] « À propos » affiche la version embarquée réelle.

---

## 11. Références code existant

- Settings : `app/src/main/app-settings.js`
- Lien externe sécurisé : `main.js` `shell:openExternal` (http/https only)
- Version log démarrage : `logger.js` `logStartupBanner`
- Release CI : `.github/workflows/release-windows.yml`
- Tests Node CI : `app/scripts/run-node-tests.mjs`

---

*Document de cadrage — à intégrer au backlog avant implémentation UPD-01…06.*
