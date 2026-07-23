/**
 * Vérifie le runtime Python *packagé* (dist/win-unpacked) :
 * - import jsonschema
 * - démarrage pdf_service depuis asar.unpacked
 * - GET /health + POST /validate (payload golden + rejet contrat)
 *
 * Prérequis : npm run build (electron-builder --dir) après bundle-python avec jsonschema.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");

const appDir = path.join(__dirname, "..");
const unpacked = path.join(appDir, "dist", "win-unpacked");
const embedPy = path.join(unpacked, "resources", "python-runtime", "python.exe");
const serviceDir = path.join(unpacked, "resources", "app.asar.unpacked", "python");
const serviceScript = path.join(serviceDir, "pdf_service.py");
const schemaFile = path.join(
  unpacked,
  "resources",
  "app.asar.unpacked",
  "src",
  "contracts",
  "schemas",
  "pdf-validate.request.json"
);

function fail(msg) {
  console.error("[packaged-python-validate]", msg);
  process.exit(1);
}

function request(method, route, bodyObj, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = bodyObj == null ? null : JSON.stringify(bodyObj);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8765,
        path: route,
        method,
        headers: {
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
              }
            : {}),
          ...headers
        },
        timeout: 5000
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function waitHealth(timeoutMs) {
  const started = Date.now();
  for (;;) {
    try {
      const r = await request("GET", "/health");
      if (r.status === 200 && r.body.ok) return r.body;
    } catch {
      /* intentional: health probe retry until timeout */
    }
    if (Date.now() - started > timeoutMs) throw new Error("Timeout /health");
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function main() {
  if (process.platform !== "win32") {
    console.log("[packaged-python-validate] skip (Windows only)");
    return;
  }
  if (!fs.existsSync(embedPy)) {
    fail(`python-runtime manquant : ${embedPy} — lancez npm run build`);
  }
  if (!fs.existsSync(serviceScript)) {
    fail(`pdf_service packagé manquant : ${serviceScript}`);
  }
  if (!fs.existsSync(schemaFile)) {
    fail(
      `Schéma pdf-validate non unpacké : ${schemaFile} — vérifier asarUnpack src/contracts/schemas`
    );
  }

  // Preuve : jsonschema dans le bundle final (pas le Python système).
  try {
    execSync(`"${embedPy}" -c "import jsonschema; print(jsonschema.__file__)"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (e) {
    fail(`jsonschema absent du python-runtime packagé: ${e.stderr || e.message}`);
  }
  console.log("[packaged-python-validate] jsonschema import OK (python-runtime)");

  const token = crypto.randomBytes(16).toString("hex");
  const child = spawn(embedPy, [serviceScript], {
    cwd: serviceDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONPATH: serviceDir,
      PYTHONUTF8: "1",
      MANI_PDF_SERVICE_TOKEN: token,
      MANI_PDF_PY_LOGS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (c) => {
    stderr += String(c);
  });
  child.stdout.on("data", (c) => {
    stderr += String(c);
  });

  const kill = () => {
    try {
      if (process.platform === "win32" && child.pid) {
        execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
      } else {
        child.kill();
      }
    } catch {
      /* intentional: smoke cleanup or probe best-effort */
    }
  };

  try {
    const health = await waitHealth(20000);
    console.log("[packaged-python-validate] /health OK", { ok: health.ok, pypdf: health.pypdf });

    const tmpPdf = path.join(os.tmpdir(), `editradoc-packaged-validate-${Date.now()}.pdf`);
    // PDF minimal %PDF
    fs.writeFileSync(
      tmpPdf,
      Buffer.from(
        "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
        "utf8"
      )
    );

    const good = await request(
      "POST",
      "/validate",
      { path: tmpPdf },
      { "X-Mani-Pdf-Token": token }
    );
    if (good.status !== 200 || !good.body.ok) {
      fail(`/validate golden échoué: status=${good.status} body=${JSON.stringify(good.body)}`);
    }
    console.log("[packaged-python-validate] /validate golden OK");

    const bad = await request(
      "POST",
      "/validate",
      { path: 42 },
      { "X-Mani-Pdf-Token": token }
    );
    if (bad.status !== 400 || bad.body.errorCode !== "CONTRACT_INVALID") {
      fail(
        `/validate contrat invalide non rejeté comme attendu: status=${bad.status} body=${JSON.stringify(bad.body)}`
      );
    }
    console.log("[packaged-python-validate] /validate CONTRACT_INVALID OK");

    try {
      fs.unlinkSync(tmpPdf);
    } catch {
      /* intentional: smoke cleanup or probe best-effort */
    }

    console.log("[packaged-python-validate] PASS");
  } catch (err) {
    fail(`${err.message}${stderr ? `\nstderr=${stderr.trim()}` : ""}`);
  } finally {
    kill();
  }
}

main().catch((e) => fail(e?.message || String(e)));
