#!/usr/bin/env node
/**
 * Génère tests/pdf_intrinsic_rotate270.pdf (mediabox paysage + /Rotate 270, page 2 sans rotation).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPythonModule } from "./resolve-python.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "..", "..", "tests", "pdf_intrinsic_rotate270.pdf");

const py = `
from pypdf import PdfWriter
import sys
out = sys.argv[1]
w = PdfWriter()
w.add_blank_page(width=842, height=595)
w.pages[0].rotate(270)
w.add_blank_page(width=842, height=595)
with open(out, "wb") as f:
    w.write(f)
print(out)
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const result = runPythonModule(["-c", py, outPath], { stdio: "pipe" });
if (result.status !== 0) {
  console.error(result.stderr || "Échec création fixture PDF rotation");
  process.exit(result.status || 1);
}
if (!fs.existsSync(outPath)) {
  console.error("Fixture introuvable après génération:", outPath);
  process.exit(1);
}
console.log("[create-rotated-pdf-fixture] OK:", outPath);
