// smoke check（2026-08 前端审查 P0-1：构建产物冒烟测试）
/* global window, document, location */
//
// 背景：仓库内 dist-site 曾长期是修复前的陈旧产物——display.js 双 winGlobal 声明
// SyntaxError，全部 JS 交互瘫痪，而 e2e 假绿（不查退出码/读残留报告）+ 视觉回归
// 产物缺失即 skip 都没拦住。本 check 用「真实浏览器加载 CLI 现构建的 SSG 产物」直接断言：
// 1. 无页面级 JS 错误（SyntaxError 即崩）
// 2. window.doclight 已挂载（展示层 mount 成功）
// 3. TOC 链接已由 JS 填充
// 4. head 结构完整（meta/title 在 head 内——防 head 插槽回归）
// 5. 侧边栏激活项（首页/当前页高亮）
// 6. 搜索面板可打开
// 7. SPA 导航：article 更新 + URL 更新 + 面包屑同步
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "packages", "cli", "dist", "cli.mjs");
const OUT = join(ROOT, "artifacts", "smoke-site");
const DOCS = join(ROOT, "docs");

export async function run() {
  const failures = [];
  let total = 0;

  if (!existsSync(CLI)) {
    return mkResult("smoke", "构建产物冒烟（CLI 构建 → 真实浏览器）", 1, [
      { id: "cli", message: "缺少 packages/cli/dist/cli.mjs——请先运行 npm run build" },
    ]);
  }

  // 1) 用 CLI 现构建 SSG 产物（与用户拿到的一致——冒烟的就是「产物」不是源码）
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const r = spawnSync(process.execPath, [CLI, "build", "--dir", DOCS, "--out-dir", OUT], {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (r.status !== 0) {
    return mkResult("smoke", "构建产物冒烟（CLI 构建 → 真实浏览器）", 1, [
      { id: "build", message: `CLI 构建失败（退出码 ${r.status}）`, evidence: (r.stdout || r.stderr || "").slice(-800) },
    ]);
  }

  // 2) 静态服务 + 真实浏览器断言
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0].replace(/^\/+/, ""));
    const file = join(OUT, rel === "" ? "index.html" : rel);
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error("not a file");
      const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".json") ? "application/json" : file.endsWith(".svg") ? "image/svg+xml" : "text/html; charset=utf-8";
      res.writeHead(200, { "Content-Type": type });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${baseUrl}/tech-design/16-design-system.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const state = await page.evaluate(() => ({
      doclight: typeof window.doclight,
      tocLinks: document.querySelectorAll("#tocList a").length,
      headMetas: document.head.querySelectorAll("meta").length,
      titleInHead: !!document.head.querySelector("title"),
      activeNav: document.querySelectorAll(".sidebar .side-item.active").length,
      sidebarFirst: document.querySelector(".sidebar .side-item")?.textContent?.trim().slice(0, 16) ?? "",
    }));

    total++;
    if (state.doclight !== "object" || errors.length > 0) {
      failures.push({
        id: "mount",
        message: `展示层挂载失败（doclight=${state.doclight}，页面错误 ${errors.length} 条）`,
        evidence: errors.join("\n").slice(0, 500),
      });
    }
    total++;
    if (state.tocLinks === 0) failures.push({ id: "toc", message: "TOC 链接未渲染——展示层 JS 未生效" });
    total++;
    if (state.headMetas === 0 || !state.titleInHead) {
      failures.push({ id: "head", message: `head 结构异常（head 内 meta ${state.headMetas} 个，title 在 head: ${state.titleInHead}）——head 插槽回归` });
    }
    total++;
    if (state.activeNav === 0) failures.push({ id: "nav", message: "侧边栏无激活项——导航高亮失效" });
    total++;
    if (state.sidebarFirst === "agent-guide" || state.sidebarFirst === "quickstart") {
      failures.push({ id: "nav-titles", message: `侧边栏显示文件名而非 frontmatter 标题（首个：${state.sidebarFirst}）` });
    }

    // 搜索面板（设计对齐：#searchBtn → #modalMask）
    await page.click("#searchBtn");
    await page.waitForTimeout(300);
    const searchOpen = await page.evaluate(
      () => !!document.querySelector("#modalMask") && document.querySelector("#modalMask").classList.contains("open")
    );
    total++;
    if (!searchOpen) failures.push({ id: "search", message: "搜索面板无法打开" });
    await page.keyboard.press("Escape");

    // SPA 导航 + 面包屑同步（设计对齐：crumb 类名）
    await page.click('.sidebar .side-item[data-path="agent-guide.md"]');
    await page.waitForTimeout(600);
    const nav = await page.evaluate(() => ({
      url: location.pathname,
      h1: document.querySelector("article h1")?.textContent?.slice(0, 20) ?? "",
      crumb: document.querySelector(".crumb")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "",
      active: document.querySelector(".sidebar .side-item.active")?.getAttribute("data-path") ?? "",
    }));
    total++;
    if (!nav.url.includes("agent-guide") || !nav.h1 || !nav.active.includes("agent-guide")) {
      failures.push({ id: "spa", message: "SPA 导航失败（URL/内容/高亮未更新）", evidence: JSON.stringify(nav) });
    }
    total++;
    if (!nav.crumb.includes("Agent")) {
      failures.push({ id: "breadcrumb", message: `面包屑未随 SPA 同步：${nav.crumb}`, evidence: JSON.stringify(nav) });
    }

    await browser.close();
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return mkResult("smoke", "构建产物冒烟（CLI 构建 → 真实浏览器挂载）", total, failures);
}
