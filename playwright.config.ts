import { defineConfig, devices } from "@playwright/test";

// Playwright 配置（02 §2.3.6 + 10 §2.1 浏览器矩阵）
// 浏览器矩阵：Chromium / Firefox / WebKit × 三形态产物
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
