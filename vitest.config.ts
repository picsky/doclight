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
    // 2026-08 review 阶段1落地：范围限定 packages/*/src（scripts/ 与产物不计数）。
    // thresholds 从实测基线起步（2026-08-16：lines 75.05 / branches 82.49 / functions 83.71，
    // 取基线-5pt 向下取整到 5 的倍数），只升不降、逐步逼近 12 §1.6 目标。
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["packages/*/src/**/*.ts"],
      thresholds: {
        lines: 70,
        branches: 75,
        functions: 75,
        statements: 70,
      },
    },
  },
});
