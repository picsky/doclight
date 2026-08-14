/**
 * 展示层端到端（真实浏览器，锁质量门禁）
 *
 * 对应：10 §2.1 验证矩阵（browser-matrix）+ PHASE-1-complete 下一步建议 #1。
 * 场景源自 .spike/display-integration.mjs（已证明可行），抽为正式 check：
 * 主题切换 + 持久化 / SPA 导航（注入/URL/无整页刷新）/ 前进后退 / 移动端侧边栏。
 *
 * dev server 直接复用 startDevServer（Playwright esbuild 转译 TS 源码），
 * 不再 spawn 子进程；docs 夹具在 beforeAll 建临时目录、afterAll 清理。
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer } from "../packages/cli/src/dev-server.ts";

const docsDir = mkdtempSync(join(tmpdir(), "doclight-e2e-"));
let server: { url: string; port: number; close(): Promise<void> };

test.beforeAll(async () => {
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), [
    "# 首页",
    "",
    "欢迎来到首页",
    "",
    "## 安装",
    "",
    "安装说明",
    "",
    "### 系统要求",
    "",
    "Windows / macOS",
    "",
    "## 配置",
    "",
    "配置说明",
  ].join("\n"));
  writeFileSync(join(docsDir, "intro.md"), "# 入门\n\n入门内容");
  writeFileSync(
    join(docsDir, "guide", "quickstart.md"),
    [
      "---",
      "title: 快速开始",
      "---",
      "",
      "# 快速开始",
      "",
      "快速开始内容",
      "",
      "## 快速上手",
      "",
      "三步上手",
      "",
      "## 常用命令",
      "",
      "doclight dev",
    ].join("\n")
  );
  server = await startDevServer({ dir: docsDir });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(docsDir, { recursive: true, force: true });
});

test("主题已应用、切换翻转并持久化", async ({ page }) => {
  await page.goto(server.url);

  // 防闪烁 + theme 应用：data-theme 不应为 auto
  const themeBefore = await page.getAttribute("html", "data-theme");
  expect(["light", "dark"]).toContain(themeBefore);

  // 点击主题切换按钮 → data-theme 翻转 + localStorage 持久化
  const flipped = themeBefore === "dark" ? "light" : "dark";
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", flipped);
  const stored = await page.evaluate(() => localStorage.getItem("doclight-theme"));
  expect(stored).toBe(flipped);
});

test("SPA 导航：注入目标内容、更新 URL、无整页刷新", async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator("article")).toContainText("欢迎");

  // 标记：SPA 导航不应整页刷新（window 标记保留）
  await page.evaluate(() => {
    (window as unknown as Record<string, string>).__spa_marker = "alive";
  });

  await page.click('a[href="/guide/quickstart.md"]');
  await expect(page.locator("article")).toContainText("快速开始");
  await expect(page.locator("article")).not.toContainText("欢迎");
  await expect(page).toHaveURL(/\/guide\/quickstart\.md$/);
  const marker = await page.evaluate(() => (window as unknown as Record<string, string>).__spa_marker);
  expect(marker).toBe("alive");
});

test("浏览器后退恢复上一页（popstate）", async ({ page }) => {
  await page.goto(server.url);
  await page.click('a[href="/guide/quickstart.md"]');
  await expect(page.locator("article")).toContainText("快速开始");

  await page.goBack();
  await expect(page.locator("article")).toContainText("欢迎");
});

test("移动端侧边栏可开合", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(server.url);

  await page.click("#sidebar-toggle");
  await expect(page.locator("aside.sidebar")).toHaveClass(/open/);

  // 点击侧边栏外的可见内容区关闭（移动端遮罩效果）
  // 注意：400px 视口下 280px 侧边栏盖住 main 中心点，须点右侧可见条带
  await page.mouse.click(390, 300);
  await expect(page.locator("aside.sidebar")).not.toHaveClass(/open/);
});

test("TOC：桌面右侧导轨生成并渲染标题", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(server.url);

  await expect(page.locator(".toc-rail")).toBeVisible();
  // 只含 h2/h3（不含 h1「首页」）；h3 缩进
  await expect(page.locator(".toc-panel")).toContainText("安装");
  await expect(page.locator(".toc-panel")).toContainText("系统要求");
  await expect(page.locator(".toc-panel")).not.toContainText("首页");
  await expect(page.locator(".toc-panel .toc-link-l3")).toHaveCount(1);
});

test("TOC：点击目录项跳转并更新锚点", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(server.url);

  // 目录面板常驻可点（VIS-001 重设计后 toc-dot 指示点已隐藏）；中文锚点做编码解码比对（跨浏览器一致）
  await page.click(".toc-link[data-toc-id='安装']");
  const hash = await page.evaluate(() => decodeURIComponent(location.hash));
  expect(hash).toBe("#安装");
});

test("TOC：SPA 导航后目录重建", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(server.url);
  await expect(page.locator(".toc-panel")).toContainText("安装");

  await page.click('a[href="/guide/quickstart.md"]');
  await expect(page.locator("article")).toContainText("快速开始");
  await expect(page.locator(".toc-panel")).toContainText("快速上手");
  await expect(page.locator(".toc-panel")).not.toContainText("安装");
});

test("TOC：移动端底部面板开合", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(server.url);

  await page.click(".toc-fab");
  await expect(page.locator(".toc-sheet")).toHaveClass(/open/);
  await expect(page.locator(".toc-sheet-nav")).toContainText("安装");

  await page.click(".toc-sheet-close");
  await expect(page.locator(".toc-sheet")).not.toHaveClass(/open/);
});

test("搜索：Cmd/Ctrl+K 打开、懒加载索引、实时出结果", async ({ page }) => {
  await page.goto(server.url);

  const indexRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/__doclight/search-index.json")) indexRequests.push(req.url());
  });
  // 首屏未打开搜索 → 不发索引请求（懒加载，03 §3.5.3）
  expect(indexRequests.length).toBe(0);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(".search-overlay")).toBeVisible();
  await expect.poll(() => indexRequests.length).toBeGreaterThan(0);

  await page.fill(".search-input", "三步");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await expect(page.locator(".search-result-title")).toContainText("快速开始");
  // 摘要含命中上下文且命中词有高亮（<mark>，单字/二元组逐词包）
  await expect(page.locator(".search-result-snippet")).toContainText("三步");
  await expect(page.locator(".search-result mark").first()).toBeVisible();
  await expect(page.locator(".search-result-path")).toContainText("guide/quickstart.md");
});

test("搜索：键盘导航 Enter 经 SPA 打开结果", async ({ page }) => {
  await page.goto(server.url);
  await page.keyboard.press("ControlOrMeta+k");
  await page.fill(".search-input", "三步");
  await expect(page.locator(".search-result")).toHaveCount(1);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("article")).toContainText("快速开始");
  await expect(page).toHaveURL(/\/guide\/quickstart\.md$/);
  await expect(page.locator(".search-overlay")).toBeHidden();
});

test("搜索：顶栏按钮打开，Esc 关闭", async ({ page }) => {
  await page.goto(server.url);
  await page.click("#search-toggle");
  await expect(page.locator(".search-overlay")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".search-overlay")).toBeHidden();
});
