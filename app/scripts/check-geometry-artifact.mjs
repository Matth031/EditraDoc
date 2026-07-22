#!/usr/bin/env node
/**
 * Échoue si l'artefact `renderer-geometry.js` sur disque ≠ régénération tsc fraîche.
 * (En CI : checkout synchronisé → rebuild byte-identique → OK.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const artifactPath = path.join(appRoot, "src", "renderer", "renderer-geometry.js");

function main() {
  if (!fs.existsSync(artifactPath)) {
    console.error("[check-geometry-artifact] artefact manquant");
    process.exit(1);
  }
  const before = fs.readFileSync(artifactPath);

  const build = spawnSync(process.execPath, [path.join(__dirname, "build-geometry.mjs")], {
    cwd: appRoot,
    encoding: "utf8"
  });
  if (build.status !== 0) {
    process.stderr.write(build.stdout || "");
    process.stderr.write(build.stderr || "");
    process.exit(build.status || 1);
  }

  const after = fs.readFileSync(artifactPath);
  if (!before.equals(after)) {
    console.error(
      "[check-geometry-artifact] DÉRIVE : renderer-geometry.js ne correspondait pas à une rebuild tsc."
    );
    console.error(
      "  → L'artefact a été régénéré sur disque. Vérifier le diff et committer si voulu."
    );
    process.exit(1);
  }

  console.log("[check-geometry-artifact] OK (rebuild byte-identique)");
}

main();
