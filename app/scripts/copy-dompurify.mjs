#!/usr/bin/env node
/**
 * Copie DOMPurify (UMD) dans src/lib/vendor pour chargement renderer (file://).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(appRoot, "node_modules", "dompurify", "dist", "purify.min.js");
const destDir = path.join(appRoot, "src", "lib", "vendor");
const dest = path.join(destDir, "dompurify.min.js");

if (!fs.existsSync(src)) {
  console.warn("[copy-dompurify] dompurify introuvable — npm install dompurify");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-dompurify] OK → src/lib/vendor/dompurify.min.js");
