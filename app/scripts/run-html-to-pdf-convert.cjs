#!/usr/bin/env node
"use strict";

/**
 * Conversion HTML → PDF via le module production (hors UI).
 * Usage: node scripts/run-html-to-pdf-convert.cjs [chemin.html]
 * Sortie: {basename}.pdf dans le même dossier que le HTML (conservé sur disque).
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const electronPath = require("electron");

const appRoot = path.join(__dirname, "..");
const defaultInput = path.join(appRoot, "e2e", "fixtures", "html", "test-guide_appel.html");
const inputPath = path.resolve(process.argv[2] || defaultInput);

if (!fs.existsSync(inputPath)) {
  console.error("[html-convert] Fichier introuvable:", inputPath);
  process.exit(1);
}

const resultPath = path.join(
  path.dirname(inputPath),
  `${path.basename(inputPath, path.extname(inputPath))}.convert-result.json`
);

const runnerPath = path.join(__dirname, "_html-convert-runner.cjs");
const runnerSource = `
const { app } = require("electron");
const fs = require("fs");
const { convertHtmlToPdf } = require(${JSON.stringify(path.join(appRoot, "src", "main", "lib", "html-to-pdf.js"))});

const inputPath = process.env.HTML_CONVERT_INPUT;
const resultPath = process.env.HTML_CONVERT_RESULT;

app.whenReady().then(async () => {
  const t0 = Date.now();
  try {
    const result = await convertHtmlToPdf(inputPath);
    const out = {
      inputPath,
      elapsedMs: Date.now() - t0,
      ...result
    };
    if (result.ok && result.outputPath && fs.existsSync(result.outputPath)) {
      out.pdfSizeBytes = fs.statSync(result.outputPath).size;
    }
    fs.writeFileSync(resultPath, JSON.stringify(out, null, 2), "utf8");
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    fs.writeFileSync(
      resultPath,
      JSON.stringify({ ok: false, error: String(e.message || e), inputPath }, null, 2),
      "utf8"
    );
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
`;

fs.writeFileSync(runnerPath, runnerSource, "utf8");

const r = spawnSync(electronPath, [runnerPath], {
  env: {
    ...process.env,
    HTML_CONVERT_INPUT: inputPath,
    HTML_CONVERT_RESULT: resultPath
  },
  encoding: "utf8",
  timeout: 120000,
  windowsHide: true
});

let report;
try {
  report = JSON.parse(fs.readFileSync(resultPath, "utf8"));
} catch {
  console.error("[html-convert] Échec lecture résultat:", resultPath);
  if (r.stderr) console.error(r.stderr);
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));

if (r.status !== 0 || !report.ok) {
  process.exit(r.status || 1);
}

const expectedPdf = path.join(
  path.dirname(inputPath),
  `${path.basename(inputPath, path.extname(inputPath))}.pdf`
);
if (!fs.existsSync(expectedPdf)) {
  console.error("[html-convert] PDF attendu absent:", expectedPdf);
  process.exit(1);
}

console.log("[html-convert] OK — PDF conservé:", expectedPdf);
