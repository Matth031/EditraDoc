import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Lint progressif : e2e, scripts, processus principal Electron (`src/main`),
 * modules renderer légers (+ `renderer-text-html.js`, etc.) - pas `renderer.js` / `renderer-i18n-data.js` (gros fichiers).
 * `renderer-pdf-viewer.js` et `renderer-pdf-save.js` : lintés comme les autres modules renderer.
 */
export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      "src/renderer/renderer.js",
      "src/renderer/renderer-i18n-data.js",
      "scripts/_html-convert-runner.cjs",
      "scripts/spikes/**/_electron-runner.cjs"
    ]
  },
  {
    files: ["e2e/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["node-tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["src/main/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["src/lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: [
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
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    }
  }
];
