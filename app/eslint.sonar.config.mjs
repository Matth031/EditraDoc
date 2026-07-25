/**
 * Analyse locale sonar-équivalente (eslint-plugin-sonarjs).
 * Outil de mesure (lint:sonar) — PAS un Quality Gate / PAS dans test:all.
 * Périmètre ≈ lint actuel ; exclusions explicites renderer-i18n-data.js.
 */
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import editifyPlugin from "./eslint-rules/intentional-catch.mjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "bundle-python/**",
      "tmp/**",
      "src/renderer/renderer-i18n-data.js",
      "src/lib/vendor/**",
      "scripts/_html-convert-runner.cjs",
      "scripts/spikes/**/_electron-runner.cjs"
    ]
  },
  {
    plugins: {
      editify: editifyPlugin,
      sonarjs
    }
  },
  {
    files: [
      "e2e/**/*.js",
      "scripts/**/*.cjs",
      "node-tests/**/*.js",
      "src/main/**/*.js",
      "src/lib/session-log-store.js",
      "src/lib/page-rotate-math.js",
      "src/lib/update-manifest.js",
      "src/lib/sanitize-html.js",
      "src/lib/app-log-core.js",
      "src/lib/log-path-validation.js",
      "src/lib/menu-i18n-data.js",
      "src/lib/text-soft-wrap-offsets.js",
      "src/renderer/renderer-error-log.js",
      "src/renderer/mani-color-picker.js",
      "src/renderer/floating-panel-drag.js",
      "src/renderer/renderer-text-html.js",
      "src/renderer/renderer-text-ctx.js",
      "src/renderer/renderer-text-layout.js",
      "src/renderer/renderer-annotation-props.js",
      "src/renderer/renderer-tabs.js",
      "src/renderer/renderer-annotation-history.js",
      "src/renderer/renderer-annotations.js",
      "src/renderer/renderer-keymap.js",
      "src/renderer/renderer-geometry.js",
      "src/renderer/renderer-utils.js",
      "src/renderer/renderer-toast.js",
      "src/renderer/renderer-session-log.js",
      "src/renderer/renderer-session-log-ui.js",
      "src/renderer/renderer-log-settings-ui.js",
      "src/renderer/renderer-update-ui.js",
      "src/renderer/renderer-i18n-apply.js",
      "src/renderer/renderer-e2e-helpers.js",
      "src/renderer/renderer-sidebars.js",
      "src/renderer/renderer-text-ctx-menu.js",
      "src/renderer/renderer-shape-image-ctx-menu.js",
      "src/renderer/renderer-shape-vector.js",
      "src/renderer/renderer-split-workspace.js",
      "src/renderer/renderer-jobs.js",
      "src/renderer/renderer-html-convert.js",
      "src/renderer/renderer-image-convert.js",
      "src/renderer/renderer-page-rotate.js",
      "src/renderer/renderer-app-chrome.js",
      "src/renderer/renderer-tooltips.js",
      "src/renderer/renderer-session.js",
      "src/renderer/renderer-pdf-viewer.js",
      "src/renderer/renderer-pdf-save.js"
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      "editify/intentional-catch": "error",
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-identical-expressions": "warn",
      "sonarjs/no-redundant-boolean": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      "sonarjs/no-nested-switch": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/elseif-without-else": "off",
      "sonarjs/max-switch-cases": ["warn", 30]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "editify/intentional-catch": "error",
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-identical-expressions": "warn",
      "sonarjs/no-redundant-boolean": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      "sonarjs/no-nested-switch": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/elseif-without-else": "off",
      "sonarjs/max-switch-cases": ["warn", 30]
    }
  },
  {
    // renderer.js : hors recommended / sonar (décision existante) — intentional-catch seul
    files: ["src/renderer/renderer.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      "editify/intentional-catch": "error"
    }
  }
];
