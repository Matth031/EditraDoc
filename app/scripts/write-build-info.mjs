#!/usr/bin/env node
/**
 * Génère public/build-info.json (version, commit git, horodatage build).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
const outPath = path.join(appRoot, "public", "build-info.json");

function readGitCommit() {
  try {
    const repoRoot = path.join(appRoot, "..");
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

const payload = {
  product: "EditraDoc",
  version: String(pkg.version || "0.0.0"),
  gitCommit: readGitCommit(),
  buildTime: new Date().toISOString()
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[write-build-info] OK ${path.relative(appRoot, outPath)} v${payload.version}`);
