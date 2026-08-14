import { defineConfig, devices } from "@playwright/test";

// 视觉回归专用配置（VIS-001）：只跑 chromium 单 worker，基线 diff 确定性优先。
// 独立于主配置（e2e 三浏览器矩阵不含本套件——跨浏览器字体差异会污染基线）。
// 用法：npm run verify:visual（diff）/ npm run verify:visual:update（生成/刷新基线）
export default defineConfig({
  testDir: "./scripts",
  testMatch: /visual-regression\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // 视觉基线 diff 不做重试（确定性回归 1 次即暴露）
  reporter: [["list"]],
  snapshotPathTemplate: "artifacts/visual/snapshots/{arg}{ext}",
  use: { ...devices["Desktop Chrome"] },
});
