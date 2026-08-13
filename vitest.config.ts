import { defineConfig } from "vitest/config";

// Vitest 配置（02 §2.3.6：快、ESM 原生）
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    // 稳定性（2026-08-13 补强）：多 fork worker 并行跑 build/git/dev-server 重负载
    // 会压垮低内存机器（实测 8 核/4GB 空闲并行偶发 worker 崩溃/超时 → STACK_TRACE_ERROR，
    // 串行全过；4 workers 仍偶发）。压到 2 workers + 放宽超时，保证 verify 确定性（CI/本机一致）。
    maxWorkers: 2,
    testTimeout: 20000,
    // 覆盖率门禁（12 §1.6：整体 ≥ 80%，核心模块 ≥ 90%）
    // Phase 0 无真实业务代码，暂不设阈值；Phase 1 引入真实代码时开启
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
