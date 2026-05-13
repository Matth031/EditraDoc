const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");

/**
 * Non-régression : barre HTML #appToolbar
 * - masquée hors plein écran (classe .hidden + display none)
 * - visible en plein écran fenêtre (setFullScreen)
 * - F10 inverse l’affichage (XOR) même en plein écran
 */
async function launchAppBare() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1"
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function getComputedDisplay(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return window.getComputedStyle(el).display;
  }, selector);
}

test("toolbar HTML: masquée hors plein écran, F10/F11 via main", async () => {
  const { app, page } = await launchAppBare();
  const toolbar = page.locator("#appToolbar");

  await expect(toolbar).toHaveClass(/hidden/);
  expect(await getComputedDisplay(page, "#appToolbar")).toBe("none");

  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!w) throw new Error("BrowserWindow introuvable");
    w.setFullScreen(true);
    // Sous Windows / E2E, l’IPC peut précéder l’événement natif : on aligne l’état réel.
    w.webContents.send("window:fullscreen-changed", w.isFullScreen());
  });

  await page.waitForFunction(
    () => {
      const el = document.getElementById("appToolbar");
      return el && !el.classList.contains("hidden");
    },
    null,
    { timeout: 20000 }
  );
  expect(await getComputedDisplay(page, "#appToolbar")).not.toBe("none");

  // F10 : masquer la barre (XOR)
  await page.keyboard.press("F10");
  await page.waitForFunction(
    () => {
      const el = document.getElementById("appToolbar");
      return el && el.classList.contains("hidden");
    },
    null,
    { timeout: 10000 }
  );
  expect(await getComputedDisplay(page, "#appToolbar")).toBe("none");

  // F10 : réafficher
  await page.keyboard.press("F10");
  await page.waitForFunction(
    () => {
      const el = document.getElementById("appToolbar");
      return el && !el.classList.contains("hidden");
    },
    null,
    { timeout: 10000 }
  );
  expect(await getComputedDisplay(page, "#appToolbar")).not.toBe("none");

  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    w?.setFullScreen(false);
    if (w) w.webContents.send("window:fullscreen-changed", w.isFullScreen());
  });

  await page.waitForFunction(
    () => {
      const el = document.getElementById("appToolbar");
      return el && el.classList.contains("hidden");
    },
    null,
    { timeout: 20000 }
  );
  expect(await getComputedDisplay(page, "#appToolbar")).toBe("none");

  await app.close();
});
