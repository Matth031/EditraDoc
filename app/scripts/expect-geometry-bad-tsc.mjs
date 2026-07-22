#!/usr/bin/env node
/**
 * Vérifie que le harness bad-call échoue bien à la compilation (critère P4 #3).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const tscJs = path.join(appRoot, "node_modules", "typescript", "bin", "tsc");

const r = spawnSync(process.execPath, [tscJs, "-p", "tsconfig.geometry-bad.json"], {
  cwd: appRoot,
  encoding: "utf8"
});

if (r.status === 0) {
  console.error(
    "[expect-geometry-bad-tsc] ÉCHEC du critère : le harness bad-call a compilé sans erreur."
  );
  process.exit(1);
}

const out = `${r.stdout || ""}${r.stderr || ""}`;
if (!/error TS\d+/i.test(out)) {
  console.error("[expect-geometry-bad-tsc] tsc a échoué sans erreur TS lisible:");
  process.stderr.write(out);
  process.exit(1);
}

console.log("[expect-geometry-bad-tsc] OK — tsc a bien rejeté le harness (appel incorrect).");
process.exit(0);
