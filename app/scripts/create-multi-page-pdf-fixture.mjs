#!/usr/bin/env node
/**
 * Génère tests/pdf_perf_75pages.pdf (75 pages blanches) pour mesures perf édition.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPythonModule } from "./resolve-python.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "..", "..", "tests", "pdf_perf_75pages.pdf");
const pageCount = Number(process.env.PERF_FIXTURE_PAGES || "75");

const py = `
from pypdf import PdfWriter
import sys
out = sys.argv[1]
n = int(sys.argv[2])
w = PdfWriter()
for _ in range(n):
    w.add_blank_page(width=595, height=842)
with open(out, "wb") as f:
    w.write(f)
print(out, n)
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const result = runPythonModule(["-c", py, outPath, String(pageCount)], { stdio: "pipe" });
if (result.status !== 0) {
  console.error(result.stderr || "Échec création fixture PDF multi-pages");
  process.exit(result.status || 1);
}
if (!fs.existsSync(outPath)) {
  console.error("Fixture introuvable après génération:", outPath);
  process.exit(1);
}
console.log("[create-multi-page-pdf-fixture] OK:", outPath, `pages=${pageCount}`);
