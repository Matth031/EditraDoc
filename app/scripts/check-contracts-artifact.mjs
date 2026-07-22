#!/usr/bin/env node
/**
 * Échoue si artefacts contracts (dist JS + schemas JSON) ≠ rebuild tsc fraîche.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");

const TRACKED_GLOBS = ["src/contracts/dist", "src/contracts/schemas"];

function hashTree(rootRel) {
  const root = path.join(appRoot, rootRel);
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else files.push(p);
    }
  }
  walk(root);
  files.sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(path.relative(appRoot, f).replace(/\\/g, "/"));
    h.update("\0");
    h.update(fs.readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex");
}

function main() {
  const before = TRACKED_GLOBS.map(hashTree).join("|");

  const build = spawnSync(process.execPath, [path.join(__dirname, "build-contracts.mjs")], {
    cwd: appRoot,
    encoding: "utf8"
  });
  if (build.status !== 0) {
    process.stderr.write(build.stdout || "");
    process.stderr.write(build.stderr || "");
    process.exit(build.status || 1);
  }

  const after = TRACKED_GLOBS.map(hashTree).join("|");
  if (before !== after) {
    console.error("[check-contracts-artifact] DÉRIVE : artefacts contracts ≠ rebuild tsc.");
    console.error("  → Exécuter `npm run build:contracts` et committer dist/ + schemas/.");
    process.exit(1);
  }

  console.log("[check-contracts-artifact] OK (rebuild byte-identique)");
}

main();
