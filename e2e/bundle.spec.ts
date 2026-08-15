/**
 * bundle 便携包端到端（CLI-002，05 §5.3.4：file:// 三引擎可用）
 *
 * 用 bundleSite 构建单文件 doclight.html，以 file:// 直接打开（不经过任何 HTTP 服务）：
 * - 首屏内容直出（零 JS 也可见）
 * - hash 路由导航（点击导航 → hash 变化 → 内容切换，不发起网络请求）
 * - 搜索命中内嵌索引（无 fetch / 无 HTTP 服务）
 * - 主题切换正常
 * 三浏览器矩阵（Playwright config projects）自动覆盖 Chromium/Firefox/WebKit。
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundleSite } from "../packages/cli/src/bundle.ts";

let bundleUrl: string;

test.beforeAll(async () => {
  const docsDir = mkdtempSync(join(tmpdir(), "doclight-bundle-e2e-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(
    join(docsDir, "README.md"),
    ["# 首页", "", "欢迎来到便携包。", "", "## 安装", "", "安装说明", "", "## 配置", "", "配置说明"].join("\n")
  );
  writeFileSync(join(docsDir, "intro.md"), "# 入门\n\n入门内容");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "---\ntitle: 快速开始\n---\n\n# 快速开始\n\n三步上手");
  const outDir = mkdtempSync(join(tmpdir(), "doclight-bundle-e2e-out-"));
  const result = await bundleSite({ dir: docsDir, outDir, title: "测试站" });
  bundleUrl = pathToFileURL(result.file).href;
  rmSync(docsDir, { recursive: true, force: true });
  // 保留 outDir 供测试使用；afterAll 清理
  (globalThis as unknown as { __outDir?: string }).__outDir = outDir;
});

test.afterAll(async () => {
  const outDir = (globalThis as unknown as { __outDir?: string }).__outDir;
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

test("file:// 打开：内容直出、hash 导航、搜索内嵌索引、主题切换，零 JS 错误", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(bundleUrl);
  await expect(page.locator("article")).toContainText("欢迎来到便携包");

  // hash 导航（零网络：拦截请求确认 bundle 不发起页面/索引请求）
  const requests: string[] = [];
  page.on("request", (req) => requests.push(req.url()));
  await page.click('a[href="#/guide/quickstart.html"]');
  await expect(page.locator("article")).toContainText("快速开始");
  await expect(page).toHaveURL(/#\/guide\/quickstart\.html$/);
  const pageRequests = requests.filter((u) => !u.startsWith("file:///") && !u.includes("__doclight/vendor"));
  expect(pageRequests).toEqual([]); // 导航与索引均不发起网络请求（纯内嵌）

  // 搜索：内嵌索引命中（设计对齐：result-item + 标题 + 节标签）
  await page.keyboard.press("ControlOrMeta+k");
  await page.fill("#searchInput", "三步");
  await expect(page.locator(".result-item")).toHaveCount(1);
  await expect(page.locator(".result-item .ri-title")).toContainText("快速开始");

  // 主题切换
  await page.keyboard.press("Escape");
  const themeBefore = await page.getAttribute("html", "data-theme");
  await page.click("#themeBtn");
  const themeAfter = await page.getAttribute("html", "data-theme");
  expect(themeAfter).not.toBe(themeBefore);

  expect(errors).toEqual([]);
});
