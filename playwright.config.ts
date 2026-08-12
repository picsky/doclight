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
  // 无条件重试 2 次：本机 WebKit 在并行负载下偶发超时（chromium/firefox 稳定），
  // 确定性回归会在 3 次尝试后仍失败（门禁不放过真 bug）；CI 同样适用
  retries: 2,
  reporter: [
    ["list"],
    // 反馈层：机器可消费的 JSON 报告（10 §3.1）
    ["json", { outputFile: "artifacts/e2e/results.json" }],
  ],
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
