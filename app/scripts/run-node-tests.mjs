#!/usr/bin/env node
/**
 * Lance les tests Node (node-tests/*.test.js) de façon cross-plateforme.
 * Évite le glob avec etoiles non developpe par le shell Linux en CI.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = path.join(appRoot, "node-tests");
const withCoverage = process.argv.includes("--coverage");

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectTestFiles(dir) {
  /** @type {string[]} */
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(full);
    }
  }
  return files.sort();
}

const testFiles = await collectTestFiles(testsRoot);
if (!testFiles.length) {
  console.error("[run-node-tests] Aucun fichier *.test.js dans node-tests/");
  process.exit(1);
}

const nodeTestArgs = ["--test", ...testFiles];
/** @type {string[]} */
let commandArgs;
if (withCoverage) {
  const c8Bin = require.resolve("c8/bin/c8");
  commandArgs = [c8Bin, process.execPath, ...nodeTestArgs];
} else {
  commandArgs = nodeTestArgs;
}

const result = spawnSync(process.execPath, commandArgs, {
  cwd: appRoot,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
