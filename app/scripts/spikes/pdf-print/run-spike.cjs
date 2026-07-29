#!/usr/bin/env node
"use strict";

/**
 * Spike ADR-008 — impression PDF sous sandbox + nettoyage temp.
 *
 * Usage (depuis app/) :
 *   node scripts/spikes/pdf-print/run-spike.cjs
 *   node scripts/spikes/pdf-print/run-spike.cjs --mode=sandbox-load
 *   node scripts/spikes/pdf-print/run-spike.cjs --mode=cancel-via-destroy
 *   node scripts/spikes/pdf-print/run-spike.cjs --mode=dialog   # manuel : fermer le dialogue OS
 *
 * Modes automatisés (CI / ½ j) :
 *   sandbox-load          — charge PDF, assert sandbox, cleanup temp (pas d'appel print)
 *   cancel-via-destroy    — simule fermeture anormale → unlink (sans dialogue OS)
 *   print-timeout-cleanup — appelle print (silent) + timeout module → cleanup garanti
 *   orphan-sweep          — laisse le fichier puis sweep forceAll (crash recovery boot)
 *   dialog                — print({ silent:false }) réel ; annuler le dialogue OS
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const electronPath = require("electron");

const SPIKE_DIR = __dirname;
const OUT = path.join(SPIKE_DIR, "out");

const modeArg = process.argv.find((a) => a.startsWith("--mode="));
const MODE = modeArg ? modeArg.slice("--mode=".length) : "sandbox-load";

fs.mkdirSync(OUT, { recursive: true });

const RUNNER = `
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  PRINT_WEB_PREFERENCES,
  createPrintTempPath,
  safeUnlinkPrintTemp,
  listPendingPrintTemps,
  resetPendingPrintTempsForTests,
  sweepOrphanPrintTemps,
  printBakedPdf
} = require(process.env.SPIKE_PDF_PRINT_MODULE);

const MODE = process.env.SPIKE_MODE || "sandbox-load";
const OUT = process.env.SPIKE_OUT;

const MINIMAL_PDF =
  "%PDF-1.4\\n" +
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n" +
  "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\\n" +
  "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\\n" +
  "xref\\n0 4\\n0000000000 65535 f \\n0000000009 00000 n \\n0000000052 00000 n \\n0000000101 00000 n \\n" +
  "trailer<</Size 4/Root 1 0 R>>\\nstartxref\\n178\\n%%EOF\\n";

function writeResult(data) {
  fs.writeFileSync(path.join(OUT, "spike-result.json"), JSON.stringify(data, null, 2), "utf8");
}

function assertSandbox(win) {
  const prefs = win.webContents.getLastWebPreferences();
  if (prefs.sandbox !== true) {
    throw new Error("SANDBOX_ASSERT_FAIL: sandbox=" + String(prefs.sandbox));
  }
  if (prefs.contextIsolation !== true) {
    throw new Error("CONTEXT_ISOLATION_ASSERT_FAIL");
  }
  if (prefs.nodeIntegration === true) {
    throw new Error("NODE_INTEGRATION_ASSERT_FAIL");
  }
  return {
    sandbox: prefs.sandbox,
    contextIsolation: prefs.contextIsolation,
    nodeIntegration: prefs.nodeIntegration
  };
}

app.whenReady().then(async () => {
  const result = {
    mode: MODE,
    ok: false,
    webPreferences: null,
    tempPath: null,
    tempExistedBefore: false,
    tempExistsAfter: null,
    pendingAfter: [],
    loadOk: false,
    printCalled: false,
    notes: []
  };

  resetPendingPrintTempsForTests();
  const tempPath = createPrintTempPath();
  result.tempPath = tempPath;
  fs.writeFileSync(tempPath, MINIMAL_PDF);
  result.tempExistedBefore = fs.existsSync(tempPath);

  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { ...PRINT_WEB_PREFERENCES }
    });
    result.webPreferences = assertSandbox(win);

    const url = pathToFileURL(tempPath).href;
    await win.loadURL(url);
    result.loadOk = true;
    await new Promise((r) => setTimeout(r, 400));

    if (MODE === "sandbox-load") {
      result.notes.push("no print call — sandbox + load only");
      safeUnlinkPrintTemp(tempPath);
      result.ok = true;
    } else if (MODE === "cancel-via-destroy") {
      // Simule crash / fermeture anormale pendant dialogue : destroy + unlink registre
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
      safeUnlinkPrintTemp(tempPath);
      result.notes.push("simulated abnormal close → forced unlink (no OS dialog)");
      result.ok = result.webPreferences.sandbox === true && !fs.existsSync(tempPath);
    } else if (MODE === "print-timeout-cleanup") {
      // Exercice printBakedPdf sous sandbox réelle ; timeout court si callback absent
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
      result.printCalled = true;
      const pr = await printBakedPdf(tempPath, {
        settleMs: 200,
        callbackTimeoutMs: 4000,
        printOptions: { silent: true, printBackground: true }
      });
      result.notes.push("printBakedPdf=" + JSON.stringify(pr));
      result.webPreferences = pr.webPreferences || result.webPreferences;
      result.ok =
        pr.tempRemoved === true &&
        !fs.existsSync(tempPath) &&
        (pr.sandbox === true || (pr.webPreferences && pr.webPreferences.sandbox === true));
    } else if (MODE === "dialog") {
      result.printCalled = true;
      result.notes.push("Waiting for OS print dialog — cancel or print, then cleanup runs");
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          result.notes.push("PRINT_CALLBACK_TIMEOUT — forcing cleanup");
          resolve({ success: false, reason: "timeout" });
        }, 120000);
        try {
          win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
            clearTimeout(timer);
            resolve({ success: Boolean(success), reason: String(reason || "") });
          });
        } catch (e) {
          clearTimeout(timer);
          resolve({ success: false, reason: e && e.message ? e.message : String(e) });
        }
      }).then((pr) => {
        result.notes.push("print finished: " + JSON.stringify(pr));
        safeUnlinkPrintTemp(tempPath);
        result.ok = result.webPreferences.sandbox === true && !fs.existsSync(tempPath);
      });
    } else if (MODE === "orphan-sweep") {
      // Laisse le fichier, simule crash (pas d'unlink), puis sweep forceAll
      result.notes.push("leaving temp on disk then forceAll sweep");
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
      const sweep = sweepOrphanPrintTemps({ forceAll: true });
      result.notes.push("sweep=" + JSON.stringify(sweep));
      result.ok = !fs.existsSync(tempPath) && sweep.removed.length >= 1;
    } else {
      throw new Error("Unknown SPIKE_MODE=" + MODE);
    }
  } catch (e) {
    result.notes.push("error: " + (e && e.message ? e.message : String(e)));
    result.ok = false;
    try {
      safeUnlinkPrintTemp(tempPath);
    } catch {
      /* intentional */
    }
  } finally {
    try {
      if (win && !win.isDestroyed()) win.destroy();
    } catch {
      /* intentional */
    }
    result.tempExistsAfter = fs.existsSync(tempPath);
    result.pendingAfter = listPendingPrintTemps();
    writeResult(result);
    const code = result.ok && result.tempExistsAfter === false ? 0 : 1;
    app.exit(code);
  }
});

app.on("window-all-closed", (e) => e.preventDefault());
`;

const runnerPath = path.join(OUT, "_spike-runner.js");
fs.writeFileSync(runnerPath, RUNNER, "utf8");

const pdfPrintModule = path.join(SPIKE_DIR, "..", "..", "..", "src", "main", "lib", "pdf-print.js");

const env = {
  ...process.env,
  SPIKE_MODE: MODE,
  SPIKE_OUT: OUT,
  SPIKE_PDF_PRINT_MODULE: pdfPrintModule
};

console.log(`[pdf-print spike] mode=${MODE}`);
const r = spawnSync(electronPath, [runnerPath], {
  env,
  stdio: "inherit",
  windowsHide: true
});

const resultPath = path.join(OUT, "spike-result.json");
if (fs.existsSync(resultPath)) {
  console.log("[pdf-print spike] result:");
  console.log(fs.readFileSync(resultPath, "utf8"));
}

process.exit(r.status === null ? 1 : r.status);
