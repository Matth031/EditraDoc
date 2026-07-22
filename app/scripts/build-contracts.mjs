#!/usr/bin/env node
/**
 * Compile les contrats TS → CJS (`src/contracts/dist/`) + JSON Schema (`src/contracts/schemas/`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

const BANNER_JS = `/**
 * GENERATED FILE — ne pas éditer à la main.
 * Source : src/contracts/ts/*
 * Régénérer : npm run build:contracts
 * Vérifier dérive : npm run check:contracts-artifact
 */

`;

function main() {
  const tscJs = path.join(appRoot, "node_modules", "typescript", "bin", "tsc");
  const r = spawnSync(process.execPath, [tscJs, "-p", "tsconfig.contracts.json"], {
    cwd: appRoot,
    encoding: "utf8"
  });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    process.exit(r.status || 1);
  }

  const distDir = path.join(appRoot, "src", "contracts", "dist");
  const schemasDir = path.join(appRoot, "src", "contracts", "schemas");
  fs.mkdirSync(schemasDir, { recursive: true });

  // Préfixer les .js générés + écrire les JSON Schema depuis le module compilé.
  for (const name of fs.readdirSync(distDir)) {
    if (!name.endsWith(".js")) continue;
    const p = path.join(distDir, name);
    let body = fs.readFileSync(p, "utf8");
    if (!body.startsWith("/**\n * GENERATED")) {
      body = `${BANNER_JS}${body}`;
      fs.writeFileSync(p, body, "utf8");
    }
  }

  const validateMod = require(path.join(distDir, "validate.js"));
  const schemas = validateMod.schemas || {};
  for (const [file, schema] of Object.entries(schemas)) {
    const out = path.join(schemasDir, file);
    fs.writeFileSync(out, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  }

  const prettier = path.join(appRoot, "node_modules", "prettier", "bin", "prettier.cjs");
  if (fs.existsSync(prettier)) {
    const targets = [
      ...fs
        .readdirSync(distDir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => path.join("src/contracts/dist", f)),
      ...fs
        .readdirSync(schemasDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join("src/contracts/schemas", f))
    ];
    if (targets.length) {
      spawnSync(process.execPath, [prettier, "--write", ...targets], {
        cwd: appRoot,
        encoding: "utf8"
      });
    }
  }

  console.log("[build-contracts] OK dist/ + schemas/");
}

main();
