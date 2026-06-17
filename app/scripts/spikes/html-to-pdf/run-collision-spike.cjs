#!/usr/bin/env node
"use strict";

/**
 * Spike collision sortie PDF : comportement merge Python + path-guard.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { isOutputPdfInSameDirectoryAsInput } = require("../../../src/main/lib/path-guard");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "editify-collision-"));
const srcA = path.join(tmp, "doc-a.pdf");
const srcB = path.join(tmp, "doc-b.pdf");
const out = path.join(tmp, "doc-a-merged.pdf");

// Créer deux PDF minimaux via Python
const mk = `
from pypdf import PdfWriter
for p in [${JSON.stringify(srcA)}, ${JSON.stringify(srcB)}]:
    w = PdfWriter()
    w.add_blank_page(width=200, height=200)
    with open(p, "wb") as f:
        w.write(f)
`;
spawnSync("python", ["-c", mk], { encoding: "utf8" });

fs.writeFileSync(out, "PLACEHOLDER_EXISTING", "utf8");
const sizeBefore = fs.statSync(out).size;
const mtimeBefore = fs.statSync(out).mtimeMs;

const mergeScript = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(__dirname, "..", "..", "..", "python"))})
from pdf_ops import merge_pdfs
out = merge_pdfs([${JSON.stringify(srcA)}, ${JSON.stringify(srcB)}], ${JSON.stringify(out)})
print(json.dumps({"out": out}))
`;
const r = spawnSync("python", ["-c", mergeScript], { encoding: "utf8" });
const sizeAfter = fs.statSync(out).size;
const mtimeAfter = fs.statSync(out).mtimeMs;

const pathGuardAllows = isOutputPdfInSameDirectoryAsInput(srcA, out);

const result = {
  tmpDir: tmp,
  pathGuardAllowsSameName: pathGuardAllows,
  outputExistedBefore: true,
  sizeBefore,
  sizeAfter,
  overwritten: sizeBefore !== sizeAfter && mtimeAfter >= mtimeBefore,
  pythonStdout: (r.stdout || "").trim(),
  pythonStderr: (r.stderr || "").trim(),
  pythonExit: r.status,
  buildDefaultOutputPattern: "basePath sans extension + '-' + suffix + '.pdf' (ex: doc-a-merged.pdf)",
  pathGuardChecksExistence: false
};

console.log(JSON.stringify(result, null, 2));
