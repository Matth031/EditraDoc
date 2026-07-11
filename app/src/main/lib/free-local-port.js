const net = require("node:net");
const { execSync } = require("node:child_process");

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * @param {number} port
 * @returns {number | null}
 */
function findListeningPidOnPort(port) {
  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (Number.isInteger(pid) && pid > 0) return pid;
      }
    } catch {
      /* port libre ou netstat indisponible */
    }
    return null;
  }
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const pid = Number(out.split(/\s+/)[0]);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * @param {number} pid
 */
function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    /* processus déjà terminé */
  }
}

/**
 * Libère le port local s'il est occupé (ex. service Python orphelin après E2E).
 * @param {number} port
 */
async function freeLocalPort(port) {
  if (!(await isPortListening(port))) return;
  const pid = findListeningPidOnPort(port);
  if (pid) killProcessTree(pid);
  await new Promise((r) => setTimeout(r, 250));
}

module.exports = {
  freeLocalPort,
  isPortListening,
  findListeningPidOnPort,
  killProcessTree
};
