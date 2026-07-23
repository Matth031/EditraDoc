import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import editifyPlugin from "./eslint-rules/intentional-catch.mjs";

/**
 * Lint progressif : e2e, scripts, processus principal Electron (`src/main`),
 * modules renderer légers — pas le monolithe `renderer-i18n-data.js`.
 *
 * Politique catch (E0) : `editify/intentional-catch` en **warn** jusqu’à fin E3
 * (puis error). Voir `src/renderer/ERROR-POLICY.md`.
 *
 * `renderer.js` reste hors `recommended` (trop bruyant) mais est ciblé
 * uniquement par la règle intentional-catch.
 */

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      "src/renderer/renderer-i18n-data.js",
      "scripts/_html-convert-runner.cjs",
      "scripts/spikes/**/_electron-runner.cjs"
    ]
  },
  {
    plugins: {
      editify: editifyPlugin
    }
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
      // Remplacé par editify/intentional-catch (warn E0–E3).
      "no-empty": ["error", { allowEmptyCatch: true }],
      "editify/intentional-catch": "warn"
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
    },
    rules: {
      "editify/intentional-catch": "warn"
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
    },
    rules: {
      "editify/intentional-catch": "warn"
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
    },
    rules: {
      "editify/intentional-catch": "warn"
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
      "no-empty": ["error", { allowEmptyCatch: true }],
      "editify/intentional-catch": "warn"
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
      "no-empty": ["error", { allowEmptyCatch: true }],
      "editify/intentional-catch": "warn"
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
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "editify/intentional-catch": "warn"
    }
  },
  {
    // Monolithe : uniquement la politique catch (pas recommended).
    files: ["src/renderer/renderer.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      ...Object.fromEntries(
        Object.entries(js.configs.recommended.rules || {}).map(([key]) => [key, "off"])
      ),
      "editify/intentional-catch": "warn"
    }
  }
];
