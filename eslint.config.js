import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist", "node_modules"] },

  // ── 공통 (서버 + 클라이언트) ────────────────────────────────────────────────
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty":       ["error", { allowEmptyCatch: true }],
      "no-console":     "off",
    },
  },

  // ── React (src/ 한정) ───────────────────────────────────────────────────────
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks":   reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: { react: { version: "detect" } },
    rules: {
      // 새 JSX 변환 — React를 scope에 import 불필요
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",   // 초기 데이터 로딩 패턴 허용
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // ── Prettier 충돌 규칙 비활성화 (항상 마지막) ────────────────────────────────
  prettier,
];
