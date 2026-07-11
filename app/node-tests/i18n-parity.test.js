/**
 * F11 — Parité des clés i18n fr/en/es/pt (renderer + menu natif).
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const MENU_I18N = require("../src/lib/menu-i18n-data");

const LANGS = ["fr", "en", "es", "pt"];
const RENDERER_I18N_PATH = path.join(__dirname, "../src/renderer/renderer-i18n-data.js");

/**
 * Charge renderer-i18n-data.js (assignation window.__EDITIFY_I18N) sans modifier le fichier.
 * @returns {Record<string, Record<string, string>>}
 */
function loadRendererI18nData() {
  const src = fs.readFileSync(RENDERER_I18N_PATH, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(src, context, { filename: RENDERER_I18N_PATH });
  const data = context.window.__EDITIFY_I18N;
  assert.ok(
    data && typeof data === "object",
    "window.__EDITIFY_I18N attendu dans renderer-i18n-data.js"
  );
  return data;
}

/**
 * @param {Record<string, Record<string, unknown>>} dictByLang
 * @returns {{ allKeys: string[], missingByLang: Record<string, string[]> }}
 */
function collectI18nParityGaps(dictByLang) {
  /** @type {Set<string>} */
  const allKeys = new Set();
  for (const lang of LANGS) {
    const dict = dictByLang[lang];
    assert.ok(dict && typeof dict === "object", `dictionnaire '${lang}' manquant ou invalide`);
    for (const key of Object.keys(dict)) {
      allKeys.add(key);
    }
  }

  /** @type {Record<string, string[]>} */
  const missingByLang = {};
  for (const lang of LANGS) {
    const dict = dictByLang[lang];
    const missing = [...allKeys].filter((key) => !(key in dict)).sort();
    if (missing.length) {
      missingByLang[lang] = missing;
    }
  }

  return { allKeys: [...allKeys].sort(), missingByLang };
}

/**
 * @param {string} label
 * @param {{ allKeys: string[], missingByLang: Record<string, string[]> }} gaps
 */
function formatI18nParityReport(label, gaps) {
  const lines = [`${label} — parité i18n (${LANGS.join("/")}) :`];
  for (const lang of LANGS) {
    const missing = gaps.missingByLang[lang];
    if (missing?.length) {
      lines.push(`  ${lang} : ${missing.length} clé(s) manquante(s) → ${missing.join(", ")}`);
    }
  }
  if (!Object.keys(gaps.missingByLang).length) {
    lines.push(`  OK — ${gaps.allKeys.length} clé(s) synchronisée(s) sur les 4 langues.`);
  }
  return lines.join("\n");
}

/**
 * @param {Record<string, Record<string, unknown>>} dictByLang
 * @param {string} label
 */
function assertI18nParity(dictByLang, label) {
  const gaps = collectI18nParityGaps(dictByLang);
  const report = formatI18nParityReport(label, gaps);
  assert.equal(
    Object.keys(gaps.missingByLang).length,
    0,
    `${report}\n\nChaque clé présente dans une langue doit exister dans les 3 autres.`
  );
}

test("i18n parité : renderer-i18n-data.js (fr/en/es/pt)", () => {
  assertI18nParity(loadRendererI18nData(), "renderer-i18n-data.js");
});

test("i18n parité : menu-i18n-data.js (fr/en/es/pt)", () => {
  assertI18nParity(MENU_I18N, "menu-i18n-data.js");
});
