# ADR-008: Impression PDF — cycle de vie du fichier temp + sandbox

## Statut

Proposé — spike Option A exécuté le **2026-07-29** (preuves ci-dessous).

## Date

2026-07-29

## Contexte

L’impression fidèle (annotations incluses) passe par un PDF « baked » temporaire,
puis `webContents.print({ silent: false })` pour ouvrir le dialogue OS. Deux
points doivent être tranchés **avant** l’intégration produit :

1. Où écrire le PDF temp, et **quand** le supprimer de façon fiable (succès,
   annulation, crash).
2. Confirmer que l’impression n’implique **pas** une fenêtre hors sandbox
   (ADR-006).

## Décision 1 — Fichier temporaire « baked »

### Emplacement

| Règle | Choix |
|-------|--------|
| Racine | `os.tmpdir()` (temp système OS), **pas** `app.getPath("userData")` |
| Sous-dossier | `{tmpdir}/editradoc-print/` (créé au besoin, mode `0o700` si possible) |
| Nom fichier | `print-{pid}-{uuid}.pdf` |
| Qui choisit le path | **Uniquement le processus main** — le renderer ne fournit jamais le chemin |

Justification : le dossier temp système est volatile par conception ; `userData`
est persistant (settings, logs, session) et ne doit pas accumuler de PDF baked.

### Quand nettoyer

| Événément | Action |
|-----------|--------|
| Callback `print` (`success === true`) | `unlink` immédiat + retrait du registre |
| Callback `print` (`success === false`, cancel / erreur) | idem — le dialogue fermé (annulé ou non) déclenche le cleanup |
| Exception avant / pendant `print` | `finally` → `unlink` + destroy fenêtre |
| Fermeture / destroy de la fenêtre print | `unlink` best-effort (filet si callback absent) |
| `app.before-quit` / `will-quit` | sweep de **tous** les chemins encore enregistrés |
| Démarrage app (`whenReady`) | `sweepOrphanPrintTemps` : supprimer les `print-*.pdf` du sous-dossier plus vieux que `PRINT_TEMP_MAX_AGE_MS` (défaut 1 h) **et** tout fichier orphelin du run précédent (registre vide au boot → purge préfixe) |
| Timeout de sécurité | si le callback n’arrive pas sous `PRINT_CALLBACK_TIMEOUT_MS` (défaut 10 min), forcer cleanup + destroy fenêtre |

### Mécanisme (pas « delete after » naïf)

```
┌─ createPrintTempPath() ─→ register(path)
│
├─ write baked PDF
├─ open hidden sandboxed BrowserWindow → load file://
├─ webContents.print({ silent:false }, cb)
│     ├─ cb(success|fail) ─→ safeUnlink + unregister + destroy
│     ├─ timeout ───────────→ idem
│     └─ win 'closed' ──────→ idem (idempotent)
│
├─ app quit ─→ unlinkAll(registered)
└─ next boot ─→ sweepOrphanPrintTemps(tmpdir/editradoc-print)
```

Propriétés :

- **Idempotence** : `safeUnlink` ignore ENOENT ; double appel sans effet.
- **Registre en mémoire** : `Set<string>` des paths encore « owed » pendant le run.
- **Survie au crash** : au prochain démarrage, sweep disque par préfixe (le
  registre mémoire est perdu — d’où le sweep boot).
- **Pas de dépendance au succès d’impression** : cancel OS = cleanup obligatoire.

## Décision 2 — Sandbox de la fenêtre d’impression

### Exigence

La fenêtre hidden dédiée à l’impression utilise **les mêmes garde-fous** que la
fenêtre principale / HTML→PDF :

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
  // pas de preload (aucun bridge nécessaire)
  // pas de nodeIntegrationInWorker / pas de disable sandbox
}
```

Aligné ADR-006 et `html-to-pdf.js`. **Interdit** : créer une fenêtre print avec
`sandbox: false` « pour que print marche ».

### Spike — preuve runtime exigée

Le script spike doit assert :

1. `win.webContents.getLastWebPreferences().sandbox === true`
2. `contextIsolation === true`, `nodeIntegration === false`
3. Chargement d’un PDF local + appel `print` (dialogue ou simulation injectée)
4. Cleanup du fichier temp après callback / échec / cancel simulé

Si le spike montre que `print()` échoue **uniquement** sous sandbox, documenter
le blocage dans cet ADR (statut → Bloqué) — **ne pas** baisser le sandbox en
prod sans nouvel ADR.

### Note Electron / PDF

Certains guides mentionnent `plugins: true` pour le viewer PDF Chromium.
Le spike mesure d’abord **sans** `plugins` (config minimale = principale).
Si le load PDF échoue, tester `plugins: true` **en conservant** `sandbox: true`
et documenter le résultat. Ne jamais coupler « plugins » à « no sandbox ».

## Alternatives rejetées

| Alternative | Pourquoi rejetée |
|-------------|------------------|
| Temp sous `userData` | Persistant ; risque d’accumulation / fuite contenu document |
| Cleanup seulement si `success` | Cancel laisse des PDF baked sur disque |
| Cleanup seulement au `finally` synchrone | `print()` est async ; le finally trop tôt détruit la fenêtre avant spool |
| Imprimer `mainWindow` | Overlay annotations page active seulement ; chrome UI |
| Fenêtre print sans sandbox | Contourne ADR-006 |

## Conséquences

### Positives

- Cycle de vie temp explicite et testable (unité + spike).
- Pas de régression sandbox.
- Pattern clonable pour l’intégration menu Ctrl+P.

### Négatives / à surveiller

- Callback `print` parfois absent sur certaines versions Electron → timeout +
  `closed` + sweep boot obligatoires.
- Dialogue OS non automatisable en CI → tests unitaires injectent un faux
  `print` ; spike manuel / flag pour dialogue réel.

## Lien

- Code cible : `app/src/main/lib/pdf-print.js`
- Hooks boot/quit : `app/src/main/main.js` (`sweepOrphanPrintTemps` / `unlinkAllPendingPrintTemps`)
- Tests : `app/node-tests/pdf-print.test.js` (16 tests — succès, cancel, throw, timeout, sandbox refuse, orphan sweep)
- Spike : `app/scripts/spikes/pdf-print/run-spike.cjs` (`npm run spike:pdf-print`)
- ADR-006 : sandbox fenêtre principale

## Preuves spike (2026-07-29)

| Mode | sandbox | temp nettoyé | Notes |
|------|---------|--------------|-------|
| `sandbox-load` | `true` | oui | load `file://` PDF OK sous sandbox |
| `cancel-via-destroy` | `true` | oui | simule fermeture anormale |
| `orphan-sweep` | `true` | oui | `forceAll` purge préfixe (crash recovery) |
| `print-timeout-cleanup` | `true` | oui | `print({silent:true})` invoqué sous sandbox ; callback absent → timeout → cleanup (quirk Electron connu, filet ADR) |

Path temp observé : `%LOCALAPPDATA%\Temp\editradoc-print\print-{pid}-{uuid}.pdf` (= `os.tmpdir()`, pas `userData`).

**Conclusion spike :** pas besoin de baisser le sandbox. Le filet timeout + sweep boot couvre l’absence de callback.

## Amendement — intégration produit (2026-07-29)

- Menu **Imprimer…** + **Ctrl+P** (keymap capture, sans conflit avec S/O).
- Bake = `exportActivePdfToPath` → `pdf:export-with-annotations` (même apply_annotations) vers path alloué par `pdf:allocate-print-temp` sous `editradoc-print/` uniquement.
- S1 : IPC `pdf:print-baked` refuse tout path hors `editradoc-print` ; invariant lock dédié.
- S19 : inchangé — audit via le même `exportPdfWithAnnotationsMain` / `EDITRADOC_EXPORT_AUDIT===\"1\"`.
- E2E : `e2e/app.print-bake.spec.js` (`MANI_PDF_E2E=1` mock dialogue + cleanup).
