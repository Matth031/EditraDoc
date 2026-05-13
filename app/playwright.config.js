const { defineConfig } = require("@playwright/test");

const ci = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: ci ? 180000 : 120000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list"
});
