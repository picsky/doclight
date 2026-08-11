// 展示层端到端冒烟（真实浏览器）：主题切换 + SPA 导航 + 移动端侧边栏
// 前置：node packages/cli/src/index.ts dev 可运行；playwright-core 已装于 .spike
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4569;
const docsDir = mkdtempSync(join(tmpdir(), "doclight-e2e-"));
mkdirSync(join(docsDir, "guide"), { recursive: true });
writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎");
writeFileSync(join(docsDir, "intro.md"), "# 入门\n\n入门内容");
writeFileSync(join(docsDir, "guide", "quickstart.md"), "# 快速开始\n\n快速开始内容");

const repoRoot = join(import.meta.dirname, ".."); // .spike 的上一级 = 仓库根
const server = spawn(
  process.execPath,
  [join(repoRoot, "packages", "cli", "src", "index.ts"), "dev", "--dir", docsDir, "--port", String(PORT)],
  { cwd: repoRoot } // 保证 dist/display.js 能按 process.cwd() 找到
);
await new Promise((r) => setTimeout(r, 2000));

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);

  // 防闪烁 + theme 应用：data-theme 不应为 auto
  const themeBefore = await page.getAttribute("html", "data-theme");
  check("主题已应用（非 auto）", themeBefore === "light" || themeBefore === "dark");

  // 点击主题切换按钮 → data-theme 翻转
  const flipped = themeBefore === "dark" ? "light" : "dark";
  await page.click("#theme-toggle");
  const themeAfter = await page.getAttribute("html", "data-theme");
  check("主题切换翻转", themeAfter === flipped);
  check("主题已持久化到 localStorage", (await page.evaluate(() => localStorage.getItem("doclight-theme"))) === flipped);

  // 回到首页（SPA 导航起点）
  await page.goto(`http://127.0.0.1:${PORT}/`);
  const navTextBefore = await page.textContent("article");

  // 标记：SPA 导航不应整页刷新（window 标记保留）
  await page.evaluate(() => { window.__spa_marker = "alive"; });

  // 点击导航链接 → SPA 注入内容 + URL 更新 + 无整页刷新
  await page.click('a[href="/guide/quickstart.md"]');
  await page.waitForTimeout(300);
  const articleText = await page.textContent("article");
  const marker = await page.evaluate(() => window.__spa_marker);
  const url = page.url();
  check("SPA 导航注入目标内容", articleText?.includes("快速开始") === true && articleText?.includes("欢迎") === false);
  check("SPA 导航更新 URL", url.endsWith("/guide/quickstart.md"));
  check("无整页刷新（标记保留）", marker === "alive");

  // 前进后退（popstate）
  await page.goBack();
  await page.waitForTimeout(300);
  check("浏览器后退恢复首页", (await page.textContent("article"))?.includes("欢迎") === true);

  // 移动端侧边栏开关
  await page.setViewportSize({ width: 400, height: 800 });
  await page.click("#sidebar-toggle");
  const open = await page.$eval("aside.sidebar", (el) => el.classList.contains("open"));
  check("移动端侧边栏可开合", open);
} finally {
  await browser.close();
  server.kill();
  rmSync(docsDir, { recursive: true, force: true });
}

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
