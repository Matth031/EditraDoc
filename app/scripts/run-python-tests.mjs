#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePython, runPythonModule } from "./resolve-python.mjs";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!resolvePython()) {
  console.error(
    "[EditraDoc] Python introuvable. Installez Python 3 et pypdf/reportlab:\n" +
      "  pip install -r python/requirements.txt"
  );
  process.exit(127);
}

const result = runPythonModule(
  ["-m", "unittest", "discover", "-s", "python/tests", "-p", "test_*.py"],
  { cwd: appRoot, stdio: "inherit" }
);

process.exit(result.status ?? 1);
