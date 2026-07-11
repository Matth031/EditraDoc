# Diagnostic E2E — capture console main + renderer

Quand la suite E2E s'effondre sans cause évidente (timeouts massifs sur `maniPdfApi`, `__maniE2E`, « Aucun onglet après ouverture PDF »), lancer le spec diagnostic avant de reconstruire l'investigation.

## Commande

Depuis `app/` :

```bash
npx playwright test e2e/diag-pdf-open-console.spec.js --reporter=line
```

## Sortie

- **Console** : erreurs `pageerror`, logs main-process (Electron), console renderer, requêtes réseau échouées (`requestfailed`).
- **Fichier** : `test-results/diag-pdf-open-console.log`
- **Snapshots JSON** : état bootstrap (`DOMPurify`, `__editifySanitizeHtml`, `__maniE2E`) et après ouverture PDF (`tabCount`, `pdfPages`, `statusHistory`).

## Signaux typiques

| Symptôme E2E | Cause fréquente | Preuve dans le log |
|--------------|-----------------|-------------------|
| 70+ échecs, `__maniE2E` timeout | `renderer.js` ne s'exécute pas | `SyntaxError` / `pageerror` avant fin de chargement scripts |
| `tabCount: 0` après open | validation PDF / service Python | pas de `PDF charge` dans `statusHistory` |
| `ERR_FILE_NOT_FOUND` sur script | chemin vendor ou postinstall | `requestfailed` sur `dompurify.min.js` |

## Cas référence (E-AUDIT-03 / 03.2)

`sanitize-html.js` chargé en script classique sans IIFE déclarait `function sanitizeTextHtml` au scope global → collision avec `const { sanitizeTextHtml }` dans `renderer.js` → `SyntaxError: Identifier 'sanitizeTextHtml' has already been declared`.

Correctif : encapsulation UMD/IIFE (pattern `session-log-store.js`).
