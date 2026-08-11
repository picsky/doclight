import { defineConfig } from "vitest/config";

// Vitest 配置（02 §2.3.6：快、ESM 原生）
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    // 覆盖率门禁（12 §1.6：整体 ≥ 80%，核心模块 ≥ 90%）
    // Phase 0 无真实业务代码，暂不设阈值；Phase 1 引入真实代码时开启
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
