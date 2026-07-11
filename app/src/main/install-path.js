const path = require("node:path");
const { app } = require("electron");

let installRootCache = null;

/**
 * Racine d'installation :
 * - dev : dossier parent de `app/` (ex. 07-EditraDoc/)
 * - prod : dossier contenant l'exécutable EditraDoc.exe
 */
function getInstallRoot() {
  if (installRootCache) return installRootCache;
  try {
    if (app.isPackaged) {
      installRootCache = path.dirname(process.execPath);
    } else {
      installRootCache = path.resolve(app.getAppPath(), "..");
    }
  } catch {
    installRootCache = process.cwd();
  }
  return installRootCache;
}

module.exports = { getInstallRoot };
