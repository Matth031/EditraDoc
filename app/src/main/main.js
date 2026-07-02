const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { log } = require("./logger");
const { isOutputPdfInSameDirectoryAsInput } = require("./lib/path-guard");
const { convertHtmlToPdf } = require("./lib/html-to-pdf");
const spellcheckService = require("./spellcheck-service");

// Ensure logs go to project root by default.
// (Logger also has its own default, but this makes it explicit.)
try {
  process.env.MANI_PDF_LOG_PATH =
    process.env.MANI_PDF_LOG_PATH || path.join(app.getAppPath(), "..", "mani-pdf.log");
} catch {
  // ignore
}

let mainWindow = null;
let autosaveInterval = null;
let jobQueueIntervalId = null;
let pythonProcess = null;

/**
 * Racine du dossier applicatif (dev: `app/`, prod: `resources/app.asar.unpacked/`).
 * Les modules Python sont décompressés hors ASAR pour permettre `spawn`.
 */
function getApplicationRoot() {
  if (!app.isPackaged) {
    // __dirname = app/src/main → racine du package Electron (dossier contenant package.json) = ../../
    return path.join(__dirname, "..", "..");
  }
  return path.join(process.resourcesPath, "app.asar.unpacked");
}

/**
 * Lance le service PDF : Python système en dev, runtime embarqué Windows (`python-runtime`) en prod si présent.
 */
/**
 * Icône fenêtre : .ico Windows (raccourci barre titre / bureau). Fallback PNG historique.
 */
function getWindowIconPath() {
  const base = app.getAppPath();
  const ico = path.join(base, "public", "editraDoc.ico");
  if (fs.existsSync(ico)) return ico;
  const png = path.join(base, "public", "miniature_fond_blanc.png");
  if (fs.existsSync(png)) return png;
  return undefined;
}

function getPythonLaunchConfig() {
  const appRoot = getApplicationRoot();
  const pyDir = path.join(appRoot, "python");
  const scriptPath = path.join(pyDir, "pdf_service.py");
  const cwd = pyDir;
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONPATH: pyDir,
    PYTHONUTF8: "1",
    MANI_PDF_EXPORT_DEBUG: process.env.MANI_PDF_EXPORT_DEBUG || "0"
  };
  if (app.isPackaged && process.platform === "win32") {
    const embedded = path.join(process.resourcesPath, "python-runtime", "python.exe");
    if (fs.existsSync(embedded)) {
      return { command: embedded, args: [scriptPath], cwd, env };
    }
  }
  if (process.platform === "win32") {
    // Évite un `python` du PATH sans pypdf (ex. venv tiers) : préférer le lanceur Windows.
    return { command: "py", args: ["-3", scriptPath], cwd, env };
  }
  const command = "python3";
  return { command, args: [scriptPath], cwd, env };
}
const sessionStatePath = path.join(app.getPath("userData"), "session-state.json");
const sensitiveLogPath = path.join(app.getPath("userData"), "sensitive-actions.json");
const jobsStatePath = path.join(app.getPath("userData"), "jobs-state.json");
const recentPdfsPath = path.join(app.getPath("userData"), "recent-pdfs.json");
const jobs = [];
let activeJobId = null;
let sensitiveActions = [];
/** @type {string[]} */
let recentPdfs = [];

function loadRecentPdfs() {
  try {
    if (!fs.existsSync(recentPdfsPath)) {
      recentPdfs = [];
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(recentPdfsPath, "utf8"));
    recentPdfs = Array.isArray(parsed) ? parsed.map((x) => String(x || "")).filter(Boolean) : [];
  } catch {
    recentPdfs = [];
  }
}

function persistRecentPdfs() {
  try {
    fs.writeFileSync(recentPdfsPath, JSON.stringify(recentPdfs, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function addRecentPdf(pdfPath) {
  try {
    const p = String(pdfPath || "").trim();
    if (!p) return;
    // Dedupe (case-insensitive sur Windows), cap à 20.
    const lower = process.platform === "win32" ? p.toLowerCase() : p;
    recentPdfs = recentPdfs.filter((x) => {
      const xl = process.platform === "win32" ? String(x).toLowerCase() : String(x);
      return xl !== lower;
    });
    recentPdfs.unshift(p);
    recentPdfs = recentPdfs.slice(0, 20);
    persistRecentPdfs();
    try {
      // Bonus Windows: alimente aussi la liste de documents récents OS.
      app.addRecentDocument(p);
    } catch {
      /* ignore */
    }
    // Rafraîchir le menu pour afficher la nouvelle liste.
    try {
      createMenu();
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function loadSensitiveLog() {
  try {
    if (fs.existsSync(sensitiveLogPath)) {
      sensitiveActions = JSON.parse(fs.readFileSync(sensitiveLogPath, "utf8"));
      if (!Array.isArray(sensitiveActions)) sensitiveActions = [];
    }
  } catch {
    sensitiveActions = [];
  }
}

function loadJobs() {
  try {
    if (!fs.existsSync(jobsStatePath)) return;
    const parsed = JSON.parse(fs.readFileSync(jobsStatePath, "utf8"));
    if (!Array.isArray(parsed)) return;
    jobs.length = 0;
    parsed.forEach((j) => {
      if (j.status === "running") j.status = "queued";
      jobs.push(j);
    });
  } catch {
    jobs.length = 0;
  }
}

function persistJobs() {
  fs.writeFileSync(jobsStatePath, JSON.stringify(jobs, null, 2), "utf8");
}

/** Types de jobs autorisés (file d'attente → service Python local). */
const ALLOWED_JOB_TYPES = new Set(["merge", "split", "split_groups"]);

/**
 * Valide le payload avant mise en file (chemins existants, sorties co-localisées avec la source).
 * @returns {string|null} message d'erreur ou null si OK
 */
function validateJobPayload(jobType, payload) {
  const p = payload || {};

  if (!ALLOWED_JOB_TYPES.has(jobType)) {
    return "Type de job non autorise.";
  }

  const requireExistingFile = (label, filePath) => {
    if (!filePath || typeof filePath !== "string") {
      return `${label} : chemin invalide.`;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return `${label} : fichier introuvable.`;
    }
    return null;
  };

  switch (jobType) {
    case "merge": {
      if (!Array.isArray(p.inputs) || p.inputs.length < 2) {
        return "Fusion : au moins deux fichiers PDF requis.";
      }
      for (let i = 0; i < p.inputs.length; i += 1) {
        const err = requireExistingFile(`PDF ${i + 1}`, p.inputs[i]);
        if (err) return err;
      }
      if (!p.output_path || typeof p.output_path !== "string") return "Chemin de sortie requis.";
      if (!isOutputPdfInSameDirectoryAsInput(p.inputs[0], p.output_path)) {
        return "La sortie doit etre dans le meme dossier que le premier PDF.";
      }
      return null;
    }
    case "split": {
      const e = requireExistingFile("PDF source", p.input_path);
      if (e) return e;
      if (!p.output_path || typeof p.output_path !== "string") return "Chemin de sortie requis.";
      if (!isOutputPdfInSameDirectoryAsInput(p.input_path, p.output_path)) {
        return "La sortie doit etre dans le meme dossier que le PDF source.";
      }
      return null;
    }
    case "split_groups": {
      const e = requireExistingFile("PDF source", p.input_path);
      if (e) return e;
      if (!Array.isArray(p.groups)) return "Structure de groupes invalide.";
      for (const g of p.groups) {
        if (!g || typeof g !== "object") return "Groupe invalide.";
        const op = g.output_path;
        const indices = g.page_indices;
        if (op && String(op).trim()) {
          if (!isOutputPdfInSameDirectoryAsInput(p.input_path, op)) {
            return "Un chemin de sortie n'est pas dans le dossier du PDF source.";
          }
        }
        if (indices != null && !Array.isArray(indices)) {
          return "Indices de pages invalides.";
        }
        if (Array.isArray(indices)) {
          for (const x of indices) {
            const n = Number(x);
            if (!Number.isFinite(n) || n < 1 || n > 99999) {
              return "Indice de page invalide.";
            }
          }
        }
      }
      return null;
    }
    default:
      return "Job non supporte.";
  }
}

function broadcastFullscreenState() {
  try {
    const full = Boolean(mainWindow?.isFullScreen?.());
    mainWindow?.webContents?.send?.("window:fullscreen-changed", full);
  } catch {
    /* ignore */
  }
}

function createWindow() {
  const startMaximized = !process.env.MANI_PDF_E2E;
  try {
    app.setName("EditraDoc");
  } catch {
    /* ignore */
  }
  const windowIcon = getWindowIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    try {
      if (startMaximized) mainWindow.maximize();
    } catch {
      /* ignore */
    }
    try {
      mainWindow.show();
    } catch {
      /* ignore */
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F10") {
      event.preventDefault();
      try {
        mainWindow.webContents.send("toolbar:f10-toggle");
      } catch {
        /* ignore */
      }
    }
  });

  mainWindow.on("enter-full-screen", () => broadcastFullscreenState());
  mainWindow.on("leave-full-screen", () => broadcastFullscreenState());
  mainWindow.webContents.once("did-finish-load", () => broadcastFullscreenState());

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

function normalizeSpellcheckLanguage(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "fr" || l === "fr-fr") return "fr-FR";
  if (l === "en" || l === "en-us" || l === "en-gb") return "en-US";
  if (l === "es" || l === "es-es") return "es-ES";
  if (l === "pt" || l === "pt-pt" || l === "pt-br") return "pt-PT";
  return null;
}

function createMenu() {
  const recentSubmenu =
    recentPdfs.length > 0
      ? [
          ...recentPdfs.map((p, idx) => ({
            label: `${idx + 1}. ${p}`,
            click: () => {
              try {
                if (!mainWindow) return;
                if (!fs.existsSync(p)) {
                  // Nettoyage best-effort des chemins disparus.
                  recentPdfs = recentPdfs.filter((x) => x !== p);
                  persistRecentPdfs();
                  createMenu();
                  return;
                }
                mainWindow.webContents.send("pdf:open-from-menu", p);
              } catch {
                /* ignore */
              }
            }
          })),
          { type: "separator" },
          {
            label: "Effacer la liste",
            click: () => {
              recentPdfs = [];
              persistRecentPdfs();
              try {
                createMenu();
              } catch {
                /* ignore */
              }
            }
          }
        ]
      : [{ label: "(Aucun fichier récent)", enabled: false }];

  const template = [
    {
      label: "Fichier",
      submenu: [
        {
          label: "Ouvrir PDF",
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile"],
              filters: [{ name: "PDF", extensions: ["pdf"] }]
            });
            if (!result.canceled && result.filePaths[0]) {
              mainWindow.webContents.send("pdf:open-from-menu", result.filePaths[0]);
            }
          }
        },
        {
          label: "Fichiers récents",
          submenu: recentSubmenu
        },
        {
          label: "Enregistrer sous…",
          accelerator: "Ctrl+S",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("pdf:save-as-requested");
          }
        },
        { type: "separator" },
        {
          label: "Convertir",
          submenu: [
            {
              label: "HTML vers PDF",
              click: () => {
                if (!mainWindow) return;
                mainWindow.webContents.send("app:html-to-pdf");
              }
            }
          ]
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Options",
      submenu: [
        {
          label: "Langue",
          submenu: [
            {
              label: "Francais",
              type: "radio",
              checked: true,
              click: () => mainWindow?.webContents?.send?.("app:set-language", "fr")
            },
            {
              label: "English",
              type: "radio",
              click: () => mainWindow?.webContents?.send?.("app:set-language", "en")
            },
            {
              label: "Espanol",
              type: "radio",
              click: () => mainWindow?.webContents?.send?.("app:set-language", "es")
            },
            {
              label: "Portugues",
              type: "radio",
              click: () => mainWindow?.webContents?.send?.("app:set-language", "pt")
            }
          ]
        },
        {
          label: "Journal de session",
          click: () => {
            try {
              mainWindow?.webContents?.send?.("app:session-log");
            } catch {
              /* ignore */
            }
          }
        },
        { type: "separator" },
        {
          label: "Outils PDF",
          submenu: [
            {
              label: "Fusion",
              click: () => mainWindow?.webContents?.send?.("app:pdf-tool", "merge")
            },
            {
              label: "Diviser",
              click: () => mainWindow?.webContents?.send?.("app:pdf-tool", "split")
            }
          ]
        }
      ]
    },
    {
      label: "?",
      submenu: [
        {
          label: "À propos",
          click: () => {
            try {
              mainWindow?.webContents?.send?.("app:about");
            } catch {
              /* ignore */
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startAutosave() {
  if (autosaveInterval) clearInterval(autosaveInterval);
  autosaveInterval = setInterval(() => {
    if (!mainWindow) return;
    mainWindow.webContents.send("session:autosave-requested");
  }, 30000);
}

function stopBackgroundTimers() {
  if (jobQueueIntervalId != null) {
    clearInterval(jobQueueIntervalId);
    jobQueueIntervalId = null;
  }
  if (autosaveInterval != null) {
    clearInterval(autosaveInterval);
    autosaveInterval = null;
  }
}

function startPythonService() {
  const { command, args, cwd, env } = getPythonLaunchConfig();
  try {
    console.log("[EditraDoc:python] demarrage", { command, args, cwd });
  } catch {
    /* ignore */
  }
  pythonProcess = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd,
    env
  });
  pythonProcess.on("error", (err) => {
    try {
      console.error("[EditraDoc:python] erreur spawn", err?.message || String(err));
    } catch {
      /* ignore */
    }
  });
  pythonProcess.stdout.on("data", () => {});
  pythonProcess.stderr.on("data", (chunk) => {
    try {
      const s = chunk?.toString?.() || String(chunk);
      if (s.trim()) console.error("[mani-pdf python]", s.trimEnd());
    } catch {
      /* ignore */
    }
  });
  pythonProcess.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error("[mani-pdf python] process exited", { code, signal });
    }
  });
}

function stopPythonService() {
  if (!pythonProcess) return;
  const p = pythonProcess;
  pythonProcess = null;
  try {
    // E2E Playwright : SIGTERM peut laisser Python vivre assez longtemps pour bloquer
    // le teardown du worker (gracefullyCloseAll). En prod, TERM reste le défaut.
    if (process.env.MANI_PDF_E2E === "1" && process.platform !== "win32") {
      p.kill("SIGKILL");
    } else {
      p.kill();
    }
  } catch {
    /* ignore */
  }
}

function validateWithPython(pdfPath) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ path: pdfPath });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8765,
        path: "/validate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        },
        timeout: 1000
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            resolve(parsed);
          } catch {
            resolve({ ok: false, error: "Reponse validation invalide." });
          }
        });
      }
    );

    req.on("error", () => resolve({ ok: true }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: true });
    });
    req.write(body);
    req.end();
  });
}

function postToPython(route, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload || {});
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8765,
        path: route,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        },
        timeout: 60000
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            if (res.statusCode && res.statusCode >= 400) {
              resolve({
                ok: false,
                error: parsed.error || `Requete Python echouee (HTTP ${res.statusCode}).`,
                httpStatus: res.statusCode
              });
              return;
            }
            resolve(parsed);
          } catch {
            resolve({ ok: false, error: "Reponse Python invalide." });
          }
        });
      }
    );
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout service Python." });
    });
    req.write(body);
    req.end();
  });
}

async function exportPdfWithAnnotationsMain(payload) {
  const input_path = String(payload?.input_path || "").trim();
  const output_path = String(payload?.output_path || "").trim();
  const audit = (message, data) => {
    try {
      console.log(`[EditraDoc:export] ${message}`, data || "");
    } catch {
      /* ignore */
    }
    log("export", message, data ?? null);
  };
  audit("start", { input_path, output_path });

  if (!input_path) {
    audit("fail", { reason: "missing_input_path" });
    return { ok: false, error: "Chemin source manquant." };
  }
  if (!fs.existsSync(input_path)) {
    audit("fail", { reason: "input_not_found", input_path });
    return { ok: false, error: "Le fichier PDF source est introuvable." };
  }
  if (!output_path) {
    audit("fail", { reason: "missing_output_path" });
    return { ok: false, error: "Chemin de sortie manquant." };
  }

  try {
    const outDir = path.dirname(path.resolve(output_path));
    fs.mkdirSync(outDir, { recursive: true });
  } catch (error) {
    const msg = error?.message || String(error);
    audit("fail", { reason: "mkdir", error: msg });
    return { ok: false, error: `Impossible de creer le dossier de sortie: ${msg}` };
  }

  const annotationCount = Object.values(payload?.annotations_by_page || {}).reduce(
    (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
    0
  );
  audit("python_request", {
    input_path,
    output_path,
    annotationCount,
    pageKeys: Object.keys(payload?.canvases_px_by_page || {}).slice(0, 20)
  });

  const result = await postToPython("/apply-annotations", payload);
  if (!result?.ok) {
    audit("fail", {
      reason: "python_error",
      error: result?.error,
      httpStatus: result?.httpStatus
    });
    return result;
  }

  if (!fs.existsSync(output_path)) {
    audit("fail", { reason: "output_missing", output_path });
    return { ok: false, error: "Le fichier exporte n'a pas ete cree sur le disque." };
  }

  try {
    const stat = fs.statSync(output_path);
    if (!stat.size) {
      audit("fail", { reason: "output_empty", output_path });
      return { ok: false, error: "Le fichier exporte est vide." };
    }
    audit("success", { output_path, size: stat.size });
  } catch (error) {
    const msg = error?.message || String(error);
    audit("fail", { reason: "output_stat", error: msg });
    return { ok: false, error: `Verification du fichier exporte impossible: ${msg}` };
  }

  return { ok: true, output_path: result.output_path || output_path };
}

function getPythonHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8765,
        path: "/health",
        method: "GET",
        timeout: 1500
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data || "{}"));
          } catch {
            resolve({ ok: false, error: "Reponse health invalide." });
          }
        });
      }
    );
    req.on("error", () => resolve({ ok: false, error: "Service Python indisponible." }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout health check." });
    });
    req.end();
  });
}

async function processJobQueue() {
  if (activeJobId) return;
  const next = jobs.find((j) => j.status === "queued");
  if (!next) return;
  activeJobId = next.id;
  next.status = "running";
  next.progress = 10;
  persistJobs();

  let route = "/validate";
  if (next.type === "merge") route = "/merge";
  if (next.type === "split") route = "/split";
  if (next.type === "split_groups") route = "/split-groups";

  try {
    const result = await postToPython(route, next.payload);
    if (result.ok) {
      next.status = "succeeded";
      next.progress = 100;
      next.result = result;
    } else {
      next.status = "failed";
      next.progress = 100;
      next.error = result.error || "Erreur inconnue";
    }
  } catch (error) {
    next.status = "failed";
    next.progress = 100;
    next.error = error.message;
  } finally {
    activeJobId = null;
    persistJobs();
  }
}

ipcMain.handle("pdf:open", async (_, pdfPath) => {
  try {
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return { ok: false, error: "Le fichier PDF n'existe pas." };
    }
    const stat = fs.statSync(pdfPath);
    if (stat.size === 0) {
      return { ok: false, error: "Le fichier PDF est vide ou corrompu." };
    }
    const validation = await validateWithPython(pdfPath);
    if (!validation.ok) {
      return validation;
    }
    addRecentPdf(pdfPath);
    return { ok: true, path: pdfPath };
  } catch (error) {
    return { ok: false, error: `Impossible d'ouvrir le PDF: ${error.message}` };
  }
});

ipcMain.handle("pdf:read-bytes", async (_, pdfPath) => {
  try {
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return { ok: false, error: "Le fichier PDF n'existe pas." };
    }
    const buf = fs.readFileSync(pdfPath);
    // Renvoi base64 pour éviter les soucis de sérialisation Buffer via IPC.
    return { ok: true, base64: buf.toString("base64") };
  } catch (error) {
    return { ok: false, error: `Lecture PDF impossible: ${error.message}` };
  }
});

/**
 * Dialogue natif « ouvrir un fichier » (réutilisé PDF / HTML).
 * @param {{ name: string, extensions: string[] }[]} filters
 */
async function showOpenFileDialog(filters) {
  if (!mainWindow) return { ok: false, error: "Fenetre principale indisponible." };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  return { ok: true, path: result.filePaths[0] };
}

ipcMain.handle("dialog:openPdf", () => showOpenFileDialog([{ name: "PDF", extensions: ["pdf"] }]));

ipcMain.handle("dialog:openHtml", () =>
  showOpenFileDialog([{ name: "HTML", extensions: ["html", "htm"] }])
);

ipcMain.handle("convert:html-to-pdf", async (_, payload) => {
  try {
    const inputPath = payload && typeof payload === "object" ? payload.inputPath : null;
    const outputPath = payload && typeof payload === "object" ? payload.outputPath : undefined;
    return await convertHtmlToPdf(inputPath, outputPath);
  } catch {
    return { ok: false, error: "Échec de la conversion HTML vers PDF." };
  }
});

ipcMain.handle("session:save", async (_, payload) => {
  try {
    fs.writeFileSync(sessionStatePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Echec sauvegarde session: ${error.message}` };
  }
});

ipcMain.handle("session:load", async () => {
  try {
    if (!fs.existsSync(sessionStatePath)) return { ok: true, data: null };
    const content = fs.readFileSync(sessionStatePath, "utf8");
    return { ok: true, data: JSON.parse(content) };
  } catch (error) {
    try {
      const backupPath = `${sessionStatePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(sessionStatePath, backupPath);
      fs.writeFileSync(
        sessionStatePath,
        JSON.stringify({ tabs: [], activeTabId: null }, null, 2),
        "utf8"
      );
      return { ok: true, data: { tabs: [], activeTabId: null }, recovered: true };
    } catch {
      return { ok: false, error: `Echec chargement session: ${error.message}` };
    }
  }
});

ipcMain.handle("dialog:savePdfAs", async (_, suggestedName) => {
  if (!mainWindow) return { ok: false, error: "Fenetre principale indisponible." };
  const name =
    typeof suggestedName === "string" && suggestedName.trim()
      ? suggestedName.trim()
      : "document_modifie.pdf";
  log("save", "dialog_open", { suggestedName: name });
  try {
    console.log("[EditraDoc:save] dialog_open", { suggestedName: name });
  } catch {
    /* ignore */
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Enregistrer sous",
    defaultPath: name,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (result.canceled || !result.filePath) {
    log("save", "dialog_cancelled", {});
    return { ok: false, cancelled: true };
  }
  log("save", "dialog_ok", { path: result.filePath });
  log("save", "dialog_ok", { path: result.filePath });
  try {
    console.log("[EditraDoc:save] dialog_ok", { path: result.filePath });
  } catch {
    /* ignore */
  }
  return { ok: true, path: result.filePath };
});

ipcMain.handle("pdf:export-with-annotations", async (_, payload) => {
  try {
    return await exportPdfWithAnnotationsMain(payload);
  } catch (error) {
    const msg = error?.message || String(error);
    log("export", "fail", { reason: "exception", error: msg });
    return { ok: false, error: msg };
  }
});

ipcMain.handle("job:create", async (_, input) => {
  const jobType = input?.type;
  const payload = input?.payload || {};
  const validationError = validateJobPayload(jobType, payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  jobs.push({
    id,
    type: jobType,
    payload,
    status: "queued",
    progress: 0,
    error: null,
    result: null,
    createdAt: Date.now(),
    retryCount: 0
  });
  persistJobs();
  return { ok: true, id };
});

ipcMain.handle("job:list", async () => ({ ok: true, jobs }));
ipcMain.handle("python:health", async () => getPythonHealth());
ipcMain.handle("job:cancel", async (_, id) => {
  const job = jobs.find((j) => j.id === id);
  if (!job) return { ok: false, error: "Job introuvable." };
  if (job.status === "succeeded" || job.status === "failed")
    return { ok: false, error: "Job deja termine." };
  if (job.status === "running")
    return { ok: false, error: "Annulation d'un job running non supportee." };
  job.status = "cancelled";
  job.progress = 100;
  persistJobs();
  return { ok: true };
});
ipcMain.handle("job:retry", async (_, id) => {
  const job = jobs.find((j) => j.id === id);
  if (!job) return { ok: false, error: "Job introuvable." };
  if (job.status !== "failed" && job.status !== "cancelled") {
    return { ok: false, error: "Retry autorise seulement pour failed/cancelled." };
  }
  job.status = "queued";
  job.progress = 0;
  job.error = null;
  job.result = null;
  job.retryCount = (job.retryCount || 0) + 1;
  persistJobs();
  return { ok: true };
});
ipcMain.handle("sensitive:list", async () => ({ ok: true, actions: sensitiveActions }));
ipcMain.handle("log:renderer", async (_, payload) => {
  if (payload?.message === "save") {
    try {
      console.log(`[EditraDoc:save] ${payload?.data?.step || "event"}`, payload?.data ?? null);
    } catch {
      /* ignore */
    }
  }
  log("renderer", payload?.message || "event", payload?.data ?? null);
  return { ok: true };
});

ipcMain.handle("window:is-fullscreen", () => {
  try {
    const full = Boolean(mainWindow?.isFullScreen?.());
    const maximized = Boolean(mainWindow?.isMaximized?.());
    return { ok: true, full, maximized };
  } catch {
    return { ok: false, full: false, maximized: false };
  }
});

ipcMain.handle("app:quit", () => {
  app.quit();
  return { ok: true };
});

ipcMain.handle("shell:openExternal", async (_, url) => {
  try {
    const u = String(url || "").trim();
    if (!u) return { ok: false, error: "URL vide." };
    // Whitelist minimale: éviter file:// et protocoles exotiques.
    if (!/^https?:\/\//i.test(u)) return { ok: false, error: "URL non supportée." };
    await shell.openExternal(u);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("spellcheck:set-languages", async (_, input) => {
  const raw = Array.isArray(input) ? input : [input];
  const langs = raw.map(normalizeSpellcheckLanguage).filter(Boolean);
  // Défense: on n'applique rien si invalide.
  if (!langs.length) return { ok: false, error: "Langue de correcteur invalide." };
  try {
    const wc = mainWindow?.webContents;
    const ses = wc?.session;
    if (!ses?.setSpellCheckerLanguages) {
      return { ok: false, error: "Spellchecker non supporté." };
    }
    ses.setSpellCheckerLanguages(langs);
    return { ok: true, languages: langs };
  } catch {
    return { ok: false, error: "Impossible d'appliquer la langue du correcteur." };
  }
});

ipcMain.handle("spellcheck:analyze", async (_, payload) => {
  const langRaw = payload?.lang;
  const text = payload?.text != null ? String(payload.text) : "";
  const lang = normalizeSpellcheckLanguage(langRaw) || normalizeSpellcheckLanguage("fr") || "fr-FR";
  try {
    const spell = await spellcheckService.getSpell(lang);
    if (!spell) {
      console.error("[spellcheck] analyze: moteur indisponible (dictionnaire non chargé)", {
        lang,
        textLen: text.length
      });
      return { ok: false, errors: [], reason: "no-dict" };
    }
    const ses = mainWindow?.webContents?.session;
    if (ses?.listWordsInSpellCheckerDictionary) {
      try {
        const words = await ses.listWordsInSpellCheckerDictionary();
        spellcheckService.mergePersonalWords(spell, words);
      } catch {
        /* ignore */
      }
    }
    const errors = spellcheckService.findMisspellings(spell, text);
    return { ok: true, errors };
  } catch (e) {
    log("spellcheck", "analyze failed", { message: e?.message });
    console.error("[spellcheck] analyze: exception", e?.message || e);
    return { ok: false, errors: [], reason: "exception" };
  }
});

ipcMain.handle("spellcheck:add-word", async (_, payload) => {
  const w = String(payload?.word || "").trim();
  if (!w) return { ok: false };
  const ses = mainWindow?.webContents?.session;
  if (!ses?.addWordToSpellCheckerDictionary) return { ok: false };
  try {
    const ok = ses.addWordToSpellCheckerDictionary(w);
    spellcheckService.invalidateAll();
    return { ok: Boolean(ok) };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("spellcheck:remove-word", async (_, payload) => {
  const w = String(payload?.word || "").trim();
  if (!w) return { ok: false };
  const ses = mainWindow?.webContents?.session;
  if (!ses?.removeWordFromSpellCheckerDictionary) return { ok: false };
  try {
    const ok = ses.removeWordFromSpellCheckerDictionary(w);
    spellcheckService.invalidateAll();
    return { ok: Boolean(ok) };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("spellcheck:is-custom-word", async (_, payload) => {
  const w = String(payload?.word || "").trim();
  if (!w) return { ok: false, inDictionary: false };
  const ses = mainWindow?.webContents?.session;
  if (!ses?.listWordsInSpellCheckerDictionary) return { ok: false, inDictionary: false };
  try {
    const words = await ses.listWordsInSpellCheckerDictionary();
    const lower = w.toLowerCase();
    const inDictionary = words.some((x) => String(x).toLowerCase() === lower);
    return { ok: true, inDictionary };
  } catch {
    return { ok: false, inDictionary: false };
  }
});

app.whenReady().then(() => {
  loadSensitiveLog();
  loadJobs();
  loadRecentPdfs();
  createWindow();
  createMenu();
  startAutosave();
  startPythonService();
  jobQueueIntervalId = setInterval(processJobQueue, 500);
});

app.on("before-quit", () => {
  stopBackgroundTimers();
});

app.on("will-quit", () => {
  stopPythonService();
});

app.on("window-all-closed", () => {
  stopPythonService();
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (err) => {
  log("fatal", "uncaughtException", { message: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  const r =
    reason instanceof Error
      ? { message: reason.message, stack: reason.stack }
      : { reason: typeof reason === "string" ? reason : JSON.stringify(reason) };
  log("fatal", "unhandledRejection", r);
});
