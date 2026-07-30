const { defineConfig } = require("@playwright/test");

const ci = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./e2e",
  /**
   * CI macOS : démarre un pdf_service partagé (MANI_PDF_PYTHON_EXTERNAL=1).
   * No-op hors CI darwin — voir e2e/python-shared-global-setup.js.
   */
  globalSetup: require.resolve("./e2e/python-shared-global-setup.js"),
  globalTeardown: require.resolve("./e2e/python-shared-global-teardown.js"),
  /** Durée max d’un test ; le teardown du worker Playwright réutilise la même valeur (ex. fermeture Electron). */
  timeout: ci ? 180000 : 120000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  /** Un seul worker : Electron + xvfb ; évite les courses sur le port Python local. */
  workers: 1,
  /** Outil diagnostic (npm run e2e:diag) — hors régression standard. */
  testIgnore: ["**/diag-pdf-open-console.spec.js"],
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
