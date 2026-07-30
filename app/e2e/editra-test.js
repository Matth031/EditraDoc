"use strict";

/**
 * Point d’entrée Playwright pour les specs EditraDoc.
 * Ré-exporte test/expect/_electron avec diagnostic CI (console/pageerror + dump __maniE2E).
 * Les hooks afterEach / fixtures doivent vivre ICI (fichier importé par les specs),
 * jamais depuis playwright.config.js.
 */
const { test: base, expect, _electron } = require("@playwright/test");
const {
  patchElectronLaunchForDiagnostics,
  dumpUiStateToNodeLog,
  getLastDiagnosticPage
} = require("./diagnostic-runtime");

patchElectronLaunchForDiagnostics();

const test = base.extend({
  /**
   * Fixture auto : dump runtime Node sur échec (visible dans le log archive CI).
   * Playwright exige un destructuring d’objet en 1er argument (`{}`).
   * @param {Record<string, never>} _unused
   * @param {(value: undefined) => Promise<void>} use
   * @param {import("@playwright/test").TestInfo} testInfo
   */
  _editraE2eDiagnostic: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires `{}`
    async ({}, use, testInfo) => {
      await use(undefined);
      if (testInfo.status === testInfo.expectedStatus) return;
      const page = getLastDiagnosticPage();
      const label = `afterEach-failure:${testInfo.file}:${testInfo.title}`;
      if (!page) {
        console.log(`[e2e-diagnostic] ${label}: no page registered`);
        return;
      }
      await dumpUiStateToNodeLog(page, label);
    },
    { auto: true }
  ]
});

module.exports = {
  test,
  expect,
  _electron
};
