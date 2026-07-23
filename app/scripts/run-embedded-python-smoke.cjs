/**
 * Non-régression : Python embeddable (bundle-python/win) doit démarrer pdf_service
 * et répondre /health — reproduit le bug installateur (ModuleNotFoundError: pdf_ops).
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const appDir = path.join(__dirname, "..");
const embedPy = path.join(appDir, "bundle-python", "win", "python.exe");
const serviceDir = path.join(appDir, "python");
const serviceScript = path.join(serviceDir, "pdf_service.py");

function fail(msg) {
  console.error("[embedded-python-smoke]", msg);
  process.exit(1);
}

function waitHealth(timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.request(
        { hostname: "127.0.0.1", port: 8765, path: "/health", method: "GET", timeout: 1500 },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data || "{}");
              if (parsed.ok) resolve(parsed);
              else retry();
            } catch {
              retry();
            }
          });
        }
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
      req.end();

      function retry() {
        if (Date.now() - started > timeoutMs) {
          reject(new Error("Timeout health /health"));
          return;
        }
        setTimeout(tick, 250);
      }
    };
    tick();
  });
}

async function main() {
  if (process.platform !== "win32") {
    console.log("[embedded-python-smoke] skip (Windows only)");
    return;
  }
  if (!fs.existsSync(embedPy)) {
    fail(`Python embeddable introuvable : ${embedPy}. Lancez npm run bundle:python-win.`);
  }
  if (!fs.existsSync(serviceScript)) {
    fail(`pdf_service.py introuvable : ${serviceScript}`);
  }

  const child = spawn(embedPy, [serviceScript], {
    cwd: serviceDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONPATH: serviceDir },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const kill = () => {
    try {
      child.kill();
  } catch {
    /* intentional: kill embedded python smoke child best-effort */
      /* ignore */
    }
  };

  try {
    const health = await waitHealth(15000);
    if (!health.pypdf) {
      fail("Health OK mais pypdf=false");
    }
    console.log("[embedded-python-smoke] OK", health);
  } catch (err) {
    fail(`${err.message}${stderr ? ` stderr=${stderr.trim()}` : ""}`);
  } finally {
    kill();
  }
}

main().catch((err) => fail(err?.message || String(err)));
