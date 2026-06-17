/**
 * Copie public/editraDoc.ico (racine du dépôt) vers build-resources/icon.ico et app/public/
 * pour electron-builder (exe, installateur NSIS, raccourcis) et BrowserWindow sous Windows.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const repoRoot = path.join(appDir, "..");
const srcIco = path.join(repoRoot, "public", "editraDoc.ico");
const srcLogoPng = path.join(repoRoot, "public", "logo.png");
const outDir = path.join(appDir, "build-resources");
const outIco = path.join(outDir, "icon.ico");
const packagedPublicIco = path.join(appDir, "public", "editraDoc.ico");
const packagedLogoPng = path.join(appDir, "public", "logo.png");

function fail(msg) {
  console.error("[prepare-win-icon]", msg);
  process.exit(1);
}

if (!fs.existsSync(srcIco)) {
  fail(`Fichier introuvable: ${srcIco} (placez editraDoc.ico dans public/ à la racine du dépôt).`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(packagedPublicIco), { recursive: true });
fs.copyFileSync(srcIco, outIco);
fs.copyFileSync(srcIco, packagedPublicIco);

// Bonus: synchronise aussi le logo UI si présent (pour que l'app packagée reprenne le dernier fichier racine).
if (fs.existsSync(srcLogoPng)) {
  fs.copyFileSync(srcLogoPng, packagedLogoPng);
}

console.log(
  `[prepare-win-icon] OK: ${path.relative(appDir, outIco)} + ${path.relative(appDir, packagedPublicIco)}${
    fs.existsSync(srcLogoPng) ? ` + ${path.relative(appDir, packagedLogoPng)}` : ""
  }`
);
