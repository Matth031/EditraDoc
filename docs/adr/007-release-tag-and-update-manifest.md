# ADR-007 — Tags de release `vX.Y.Z` et manifeste `latest.json`

| Champ | Valeur |
|-------|--------|
| Statut | Accepté |
| Date | 2026-07-25 |
| Décideurs | Matt + agent |

## Contexte

La vérification de mise à jour côté client lit :

`https://github.com/Matth031/EditraDoc/releases/latest/download/latest.json`

Le workflow **Release Windows installer** n’attache les assets qu’aux tags matching `v*`. Une release publiée avec le tag nu `1.1.3` (sans `v`) et sans asset `latest.json` a rendu le check inopérant (HTTP 404), alors que l’installateur était déjà téléchargeable.

## Décision

1. **Convention de tag obligatoire :** uniquement `vX.Y.Z` (ex. `v1.1.4`). Pas de tag nu `1.1.4`. Le workflow reste volontairement **non permissif** (`on.push.tags: ["v*"]`) — plus simple à maintenir qu’accepter les deux formats.
2. **Assets obligatoires sur chaque release taguée :** `EditraDoc-Setup.exe` **et** `latest.json`. Le job échoue (fail closed) si l’un des deux manque, si le manifeste est invalide, ou si `latest.json.tag` ≠ `github.ref_name`.
3. **Alignement tag :** sur un push de tag, le workflow régénère `latest.json` avec `RELEASE_TAG=${{ github.ref_name }}` avant vérification / upload.
4. **`workflow_dispatch` :** build + artefacts uniquement ; **pas** d’attache automatique à une Release GitHub (évite de publier depuis une branche sans tag).

## Conséquences

- Les releases créées hors convention (tag sans `v`, upload manuel de l’exe seul) **cassent** le canal de mise à jour jusqu’à correction des assets.
- Le README documente la convention pour les futurs release managers.
- `softprops/action-gh-release` utilise `fail_on_unmatched_files: true`.

## Amendements

Aucun.
