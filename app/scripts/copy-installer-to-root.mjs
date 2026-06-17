/**
 * Copie l'installateur NSIS produit dans app/dist/ vers la racine du dépôt : EditraDoc-Setup.exe
 * (à côté de README.md). À lancer après electron-builder --win.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const distDir = path.join(appDir, "dist");
const repoRoot = path.join(appDir, "..");
const destName = "EditraDoc-Setup.exe";
const dest = path.join(repoRoot, destName);

function fail(msg) {
  console.error("[copy-installer-to-root]", msg);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  fail(`Dossier introuvable : ${distDir}. Lancez d'abord npm run dist:win.`);
}

const files = fs.readdirSync(distDir).filter((f) => f.endsWith(".exe"));
if (!files.length) {
  fail(`Aucun fichier .exe dans ${distDir}.`);
}

function sortByMtimeDesc(names) {
  return [...names].sort(
    (a, b) =>
      fs.statSync(path.join(distDir, b)).mtimeMs - fs.statSync(path.join(distDir, a)).mtimeMs
  );
}

// Plusieurs setups peuvent coexister (anciennes versions) : prendre le plus récent parmi EditraDoc, sinon le plus récent tout court.
const setupFiles = files.filter((f) => /setup/i.test(f));
const editraSetups = setupFiles.filter((f) => /editradoc/i.test(f));
const preferred =
  sortByMtimeDesc(editraSetups)[0] || sortByMtimeDesc(setupFiles)[0] || sortByMtimeDesc(files)[0];

if (!preferred) {
  fail("Impossible de determiner quel .exe copier.");
}
const src = path.join(distDir, preferred);

fs.copyFileSync(src, dest);
console.log(`[copy-installer-to-root] OK : ${path.relative(repoRoot, src)} -> ${destName}`);
