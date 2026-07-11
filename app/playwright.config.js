const { defineConfig } = require("@playwright/test");

const ci = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./e2e",
  /** Durée max d’un test ; le teardown du worker Playwright réutilise la même valeur (ex. fermeture Electron). */
  timeout: ci ? 180000 : 120000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  /** Un seul worker : Electron + xvfb ; évite les courses sur le port Python local. */
  workers: 1,
  /** Outil diagnostic (npm run e2e:diag) — hors régression standard. */
  testIgnore: ["**/diag-pdf-open-console.spec.js"],
  reporter: "list"
});
