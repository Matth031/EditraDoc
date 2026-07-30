"use strict";

/**
 * Serveur HTTP factice : GET /health → { ok: true } sur 127.0.0.1:8765.
 * Utilisé par le test de survie attach (pas le vrai pdf_service).
 *
 * Usage : node e2e/mock-python-health-server.js
 * Env : MOCK_PYTHON_PORT (défaut 8765)
 */

const http = require("node:http");

const port = Number(process.env.MOCK_PYTHON_PORT || 8765);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url?.startsWith("/health?"))) {
    const body = JSON.stringify({
      ok: true,
      pypdf: true,
      reportlab: true,
      export_ready: true,
      mock: true
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(JSON.stringify({ ready: true, pid: process.pid, port }) + "\n");
});

server.on("error", (err) => {
  console.error("[mock-python-health]", err);
  process.exit(1);
});
