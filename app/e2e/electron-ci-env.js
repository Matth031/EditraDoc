"use strict";

/**
 * Arguments Electron pour Linux (CI GitHub + xvfb-run) : sans cela, le processus
 * peut rester bloqué au lancement ou au teardown (sandbox / /dev/shm).
 * @param {string[]} [extra] ajoutés après « . » (répertoire app)
 * @returns {string[]}
 */
function electronLaunchArgs(extra = []) {
  const args = [".", ...extra];
  if (process.platform === "linux") {
    for (const flag of ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]) {
      if (!args.includes(flag)) args.push(flag);
    }
  }
  return args;
}

module.exports = { electronLaunchArgs };
