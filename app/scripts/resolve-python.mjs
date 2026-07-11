#!/usr/bin/env node
/**
 * Résout l’interpréteur Python (CI: python, Linux: python3, Windows: py -3).
 */
import { spawnSync } from "node:child_process";

/**
 * @returns {{ cmd: string, prefixArgs: string[] } | null}
 */
export function resolvePython() {
  const candidates =
    process.platform === "win32"
      ? [
          { cmd: "py", prefixArgs: ["-3"] },
          { cmd: "python", prefixArgs: [] },
          { cmd: "python3", prefixArgs: [] }
        ]
      : [
          { cmd: "python", prefixArgs: [] },
          { cmd: "python3", prefixArgs: [] }
        ];

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.cmd,
      [...candidate.prefixArgs, "-c", "import sys; print(sys.version_info.major)"],
      { encoding: "utf8" }
    );
    if (probe.status === 0 && String(probe.stdout || "").trim()) {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {string[]} moduleArgs
 * @param {{ cwd?: string, stdio?: "inherit" | "pipe" }} [opts]
 */
export function runPythonModule(moduleArgs, opts = {}) {
  const py = resolvePython();
  if (!py) {
    return {
      status: 127,
      stdout: "",
      stderr: "Python introuvable (essayez python, python3 ou py -3)."
    };
  }
  return spawnSync(py.cmd, [...py.prefixArgs, ...moduleArgs], {
    cwd: opts.cwd,
    stdio: opts.stdio ?? "inherit",
    encoding: opts.stdio === "pipe" ? "utf8" : undefined,
    env: { ...process.env, PYTHONUTF8: "1" }
  });
}
