import { defineConfig, devices } from "@playwright/test";

// Playwright 配置（02 §2.3.6 + 10 §2.1 浏览器矩阵）
// 浏览器矩阵：Chromium / Firefox / WebKit × 三形态产物
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // 三浏览器并行时本机 WebKit SPA 导航偶发 5-20s（实测隔离 4.8s / 满载 19.8s）：
  // 测试预算 60s；断言预算 20s（默认 5s 在满载 WebKit 下会误报）
  timeout: 60_000,
  expect: { timeout: 20_000 },
  // 全局 worker 上限：3 浏览器各 1 并发，降 CPU 争抢引发的超时抖动
  workers: 3,
  forbidOnly: !!process.env.CI,
  // 重试策略（2026-08 review 阶段1 flaky 治理）：CI 2 次（CI 抖动无法当场复现）；
  // 本机 1 次——本机 WebKit 满载偶发超时是实测记录（隔离 4.8s/满载 19.8s），0 次
  // 会让本地 verify 频繁假红；同时 checks/e2e.mjs 会把 flaky（重试后才过）显式
  // 列进报告，持续 flaky 不再被静默掩埋。确定性回归 2 次尝试后仍失败（门禁不放过真 bug）
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ["list"],
    // 反馈层：机器可消费的 JSON 报告（10 §3.1）
    ["json", { outputFile: "artifacts/e2e/results.json" }],
  ],
  // VIS-001 视觉回归基线（scripts/visual-regression.spec.ts 用；e2e 不用快照，互不影响）
  snapshotPathTemplate: "artifacts/visual/snapshots/{arg}{ext}",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  outputDir: "artifacts/e2e/output",
});
