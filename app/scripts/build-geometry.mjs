#!/usr/bin/env node
/**
 * Compile geometry.ts (tsc) → IIFE `src/renderer/renderer-geometry.js` (artefact commité).
 * Post-traitement minimal : retire `export {}` éventuellement émis (fichier traité comme module
 * à cause de `import type`), conserve le corps IIFE déjà présent dans la source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");

const BANNER = `/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/renderer/ts/geometry/geometry.ts (+ geometry-port.ts)
 * Régénérer : npm run build:geometry
 * Vérifier dérive : npm run check:geometry-artifact
 */

`;

function main() {
  const tscJs = path.join(appRoot, "node_modules", "typescript", "bin", "tsc");
  const r = spawnSync(process.execPath, [tscJs, "-p", "tsconfig.geometry.json"], {
    cwd: appRoot,
    encoding: "utf8"
  });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    process.exit(r.status || 1);
  }

  const emitted = path.join(appRoot, "src", "renderer", "ts-out", "geometry", "geometry.js");
  if (!fs.existsSync(emitted)) {
    console.error("[build-geometry] sortie tsc introuvable:", emitted);
    process.exit(1);
  }

  let body = fs.readFileSync(emitted, "utf8");
  // import type est élidé ; tsc peut laisser `export {}` pour marquer un module ES.
  body = body.replace(/^\s*export\s*\{\s*\}\s*;?\s*$/gm, "");
  body = body.replace(/\n{3,}/g, "\n\n").trimStart();
  if (!body.includes("(function ()") && !body.includes("(function()")) {
    console.error("[build-geometry] l'émission tsc ne contient pas l'IIFE attendue.");
    process.exit(1);
  }
  if (!body.includes("__editifyGeometry")) {
    console.error("[build-geometry] __editifyGeometry absent de l'émission.");
    process.exit(1);
  }

  const outPath = path.join(appRoot, "src", "renderer", "renderer-geometry.js");
  const out = `${BANNER}${body.trimEnd()}\n`;
  fs.writeFileSync(outPath, out, "utf8");

  const prettier = path.join(appRoot, "node_modules", "prettier", "bin", "prettier.cjs");
  if (fs.existsSync(prettier)) {
    const pr = spawnSync(
      process.execPath,
      [prettier, "--write", path.relative(appRoot, outPath).replace(/\\/g, "/")],
      { cwd: appRoot, encoding: "utf8" }
    );
    if (pr.status !== 0) {
      process.stderr.write(pr.stdout || "");
      process.stderr.write(pr.stderr || "");
      process.exit(pr.status || 1);
    }
  }

  console.log("[build-geometry] OK", path.relative(appRoot, outPath));
}

main();
