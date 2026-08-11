// ESLint 9 flat config（12 §1.1：统一配置，零 error 才可提交）
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "coverage/**",
      ".spike/**",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      // 项目约定：注释用中文，代码标识符用英文；未使用变量以下划线前缀豁免
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // 反馈层要求：所有 check 可机器消费，禁止 console 混入 lint（脚本内部除外）
      "no-console": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/test/**/*.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // scripts/ 是 Node 原生构建/验证管线（.mjs），声明 Node 全局
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
);
