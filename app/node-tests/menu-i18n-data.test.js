const test = require("node:test");
const assert = require("node:assert/strict");
const MENU_I18N = require("../src/lib/menu-i18n-data");

test("menu-i18n-data couvre les 4 langues pour le journal d'erreurs", () => {
  for (const lang of ["fr", "en", "es", "pt"]) {
    assert.ok(MENU_I18N[lang]?.menuLogFile);
    assert.ok(MENU_I18N[lang]?.logFileDialogTitle);
  }
});
