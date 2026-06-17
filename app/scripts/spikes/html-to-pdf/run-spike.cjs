#!/usr/bin/env node
"use strict";

/**
 * Spike expérimental HTML → PDF (Electron 41 printToPDF).
 * Usage: node scripts/spikes/html-to-pdf/run-spike.mjs
 * Sortie: scripts/spikes/html-to-pdf/out/*.json + *.pdf
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const electronPath = require("electron");

const SPIKE_DIR = __dirname;
const FIXTURES = path.join(SPIKE_DIR, "fixtures");
const OUT = path.join(SPIKE_DIR, "out");

const RUNNER = `
const { app, BrowserWindow, session } = require("electron");
const fs = require("fs");
const path = require("path");

const FIXTURES = process.env.SPIKE_FIXTURES;
const OUT = process.env.SPIKE_OUT;
const TEST = process.env.SPIKE_TEST;

function writeResult(name, data) {
  fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(data, null, 2), "utf8");
}

async function printHtmlToPdf(win, outPdf) {
  const buf = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true
  });
  fs.writeFileSync(outPdf, buf);
  return buf.length;
}

function attachConsole(win, logs) {
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    logs.push({ level, message, line, sourceId });
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    logs.push({ type: "did-fail-load", code, desc, url, isMainFrame });
  });
  win.webContents.on("did-finish-load", () => {
    logs.push({ type: "did-finish-load" });
  });
}

async function runCssFidelity() {
  const logs = [];
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true }
  });
  attachConsole(win, logs);
  const html = path.join(FIXTURES, "spike-css-fidelity.html");
  const t0 = Date.now();
  await win.loadFile(html);
  const loadMs = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 300));
  const pdfPath = path.join(OUT, "spike-css-fidelity.pdf");
  const pdfBytes = await printHtmlToPdf(win, pdfPath);
  const marker = await win.webContents.executeJavaScript(
    "({ title: document.title, screen: !!document.querySelector('.screen-only'), printEl: document.querySelector('.print-only')?.textContent?.slice(0,40) })"
  );
  win.destroy();
  writeResult("spike-css-fidelity", { loadMs, pdfBytes, marker, logs });
}

async function runNetworkBlock() {
  const logs = [];
  const ses = session.fromPartition("persist:spike-net-block-" + Date.now());
  ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    const u = details.url || "";
    if (u.startsWith("file:")) {
      callback({ cancel: false });
      return;
    }
    logs.push({ type: "blocked", url: u });
    callback({ cancel: true });
  });

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      session: ses
    }
  });
  attachConsole(win, logs);

  const html = path.join(FIXTURES, "spike-network-block.html");
  const t0 = Date.now();
  let loadError = null;
  try {
    await win.loadFile(html);
  } catch (e) {
    loadError = String(e.message || e);
  }
  const loadMs = Date.now() - t0;
  const marker = await win.webContents
    .executeJavaScript("document.getElementById('done')?.textContent || 'NO_MARKER'")
    .catch((e) => "EXEC_FAIL:" + e.message);

  const pdfPath = path.join(OUT, "spike-network-block.pdf");
  let pdfBytes = 0;
  let pdfError = null;
  try {
    pdfBytes = await printHtmlToPdf(win, pdfPath);
  } catch (e) {
    pdfError = String(e.message || e);
  }
  win.destroy();
  writeResult("spike-network-block", { loadMs, loadError, marker, pdfBytes, pdfError, logs });
}

async function runMissingAssets() {
  const logs = [];
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true }
  });
  attachConsole(win, logs);
  const html = path.join(FIXTURES, "spike-missing-assets.html");
  const t0 = Date.now();
  let loadError = null;
  try {
    await win.loadFile(html);
  } catch (e) {
    loadError = String(e.message || e);
  }
  const loadMs = Date.now() - t0;
  const imgState = await win.webContents.executeJavaScript(\`
    Array.from(document.images).map((img) => ({
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }))
  \`);
  const pdfPath = path.join(OUT, "spike-missing-assets.pdf");
  let pdfBytes = 0;
  let pdfError = null;
  try {
    pdfBytes = await printHtmlToPdf(win, pdfPath);
  } catch (e) {
    pdfError = String(e.message || e);
  }
  win.destroy();
  writeResult("spike-missing-assets", { loadMs, loadError, imgState, pdfBytes, pdfError, logs });
}

app.whenReady().then(async () => {
  try {
    if (TEST === "css") await runCssFidelity();
    else if (TEST === "network") await runNetworkBlock();
    else if (TEST === "assets") await runMissingAssets();
    else throw new Error("SPIKE_TEST manquant");
  } catch (e) {
    writeResult("spike-error-" + TEST, { error: String(e.stack || e) });
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
`;

const runnerPath = path.join(SPIKE_DIR, "_electron-runner.cjs");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(runnerPath, RUNNER, "utf8");

function runOne(test) {
  const env = {
    ...process.env,
    SPIKE_FIXTURES: FIXTURES,
    SPIKE_OUT: OUT,
    SPIKE_TEST: test
  };
  const t0 = Date.now();
  const r = spawnSync(electronPath, [runnerPath], {
    env,
    encoding: "utf8",
    timeout: 120000,
    windowsHide: true
  });
  return {
    test,
    exitCode: r.status,
    elapsedMs: Date.now() - t0,
    stdout: (r.stdout || "").trim().slice(0, 2000),
    stderr: (r.stderr || "").trim().slice(0, 2000)
  };
}

const meta = { ranAt: new Date().toISOString(), platform: process.platform, runs: [] };
for (const test of ["css", "network", "assets"]) {
  meta.runs.push(runOne(test));
}
fs.writeFileSync(path.join(OUT, "spike-meta.json"), JSON.stringify(meta, null, 2), "utf8");
console.log(JSON.stringify(meta, null, 2));

// Analyse PDF via Python pypdf
const analyzePy = `
import json, sys, os
from pypdf import PdfReader

out_dir = sys.argv[1]
results = {}
for name in ["spike-css-fidelity", "spike-network-block", "spike-missing-assets"]:
    p = os.path.join(out_dir, name + ".pdf")
    if not os.path.isfile(p):
        results[name] = {"exists": False}
        continue
    r = PdfReader(p)
    texts = []
    for page in r.pages:
        try:
            texts.append((page.extract_text() or "").strip())
        except Exception as e:
            texts.append(f"<extract error: {e}>")
    results[name] = {
        "exists": True,
        "pages": len(r.pages),
        "size": os.path.getsize(p),
        "texts": texts
    }
print(json.dumps(results, ensure_ascii=False, indent=2))
`;
const analyzePath = path.join(SPIKE_DIR, "_analyze_pdfs.py");
fs.writeFileSync(analyzePath, analyzePy, "utf8");
const py = spawnSync("python", [analyzePath, OUT], { encoding: "utf8", timeout: 30000 });
if (py.stdout) {
  fs.writeFileSync(path.join(OUT, "pdf-analysis.json"), py.stdout, "utf8");
  console.log("\\n--- PDF analysis ---\\n");
  console.log(py.stdout);
}
