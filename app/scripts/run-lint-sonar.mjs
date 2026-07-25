/**
 * Lance ESLint avec eslint.sonar.config.mjs, écrit un JSON, puis résume.
 * Exit 0 même avec warnings (outil de mesure, pas gate).
 * Exit ≠ 0 seulement si ESLint échoue durement (crash / errors fatales).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmpDir = path.join(appDir, "tmp");
const reportPath = path.join(tmpDir, "sonar-eslint.json");
const configPath = path.join(appDir, "eslint.sonar.config.mjs");
const summarizePath = path.join(appDir, "scripts", "summarize-sonar.mjs");

fs.mkdirSync(tmpDir, { recursive: true });

const eslintBin = path.join(
  appDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "eslint.cmd" : "eslint"
);

const eslint = spawnSync(eslintBin, ["-c", configPath, "-f", "json", "-o", reportPath, "."], {
  cwd: appDir,
  encoding: "utf8",
  shell: process.platform === "win32",
  env: process.env
});

// ESLint : 0 = clean, 1 = lint issues, 2 = fatal
if (eslint.status === 2 || eslint.error) {
  console.error(eslint.stderr || eslint.error || "eslint fatal");
  process.exit(2);
}

if (!fs.existsSync(reportPath)) {
  console.error("Rapport introuvable:", reportPath);
  process.exit(2);
}

const summary = spawnSync(process.execPath, [summarizePath, reportPath], {
  cwd: appDir,
  encoding: "utf8"
});
process.stdout.write(summary.stdout || "");
process.stderr.write(summary.stderr || "");
if (summary.status && summary.status !== 0) process.exit(summary.status);

console.log("REPORT", reportPath);
process.exit(0);
