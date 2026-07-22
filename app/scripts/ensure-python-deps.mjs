#!/usr/bin/env node
/**
 * Installe les dépendances Python requises pour pdf_service (dev local).
 * Ignoré en E2E / si MANI_PDF_SKIP_PY_SETUP=1.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const reqFile = path.join(appRoot, "python", "requirements.txt");

if (process.env.MANI_PDF_SKIP_PY_SETUP === "1" || process.env.MANI_PDF_E2E === "1") {
  process.exit(0);
}

if (!fs.existsSync(reqFile)) {
  console.warn("[EditraDoc] requirements.txt introuvable:", reqFile);
  process.exit(0);
}

const pipCmd = process.platform === "win32" ? "py" : "python3";
const args =
  process.platform === "win32"
    ? ["-3", "-m", "pip", "install", "-r", reqFile]
    : ["-m", "pip", "install", "-r", reqFile];

console.log(
  `[EditraDoc] Installation dépendances Python (${pipCmd} ${args.slice(0, 3).join(" ")} …)…`
);

const result = spawnSync(pipCmd, args, {
  cwd: appRoot,
  stdio: "inherit",
  env: { ...process.env, PYTHONUTF8: "1" }
});

if (result.status !== 0) {
  console.error(
    "[EditraDoc] Échec installation Python. Essayez manuellement:\n" +
      `  cd "${appRoot}"\n` +
      (process.platform === "win32"
        ? "  py -3 -m pip install -r python/requirements.txt"
        : "  python3 -m pip install -r python/requirements.txt")
  );
  process.exit(result.status || 1);
}

console.log("[EditraDoc] Dépendances Python OK (pypdf, reportlab, jsonschema).");
