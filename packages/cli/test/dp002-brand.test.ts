/**
 * DP-002 品牌层测试（Phase 7，18-design-polish §3.2）：
 * favicon（icon 标志）/ 首页 hero（article.home）/ 404 空态页（render404Page + build 产物 + dev 端点）。
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/build.ts";
import { render404Page, renderPage } from "../src/site.ts";
import { startDevServer } from "../src/dev-server.ts";

describe("DP-002 品牌层", () => {
  it("favicon 内联 icon 标志（三形态一致，零外部资源）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(html).toContain('<link rel="icon" href="data:image/svg+xml');
    expect(html).toContain("%2314714e"); // 松绿 Pine 底色
  });

  it("首页 hero：根 README/index → article 加 home 类", () => {
    const home = renderPage({ title: "首页", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", nav: [], currentPath: "README.md" });
    expect(home).toContain('<article class="article home">');
    const sub = renderPage({ title: "子页", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", nav: [], currentPath: "guide/a.md" });
    expect(sub).toContain('<article class="article">');
    expect(sub).not.toContain('<article class="article home">');
  });

  it("render404Page：完整壳层 + 空态（404 字码 + 行动按钮），无 TOC 链接与反馈卡", () => {
    const html = render404Page({ siteTitle: "s", navHtml: "", form: "ssg" });
    expect(html).toContain('<div class="notfound">');
    expect(html).toContain('<div class="nf-code">404</div>');
    expect(html).toContain("回到首页");
    expect(html).toContain("搜索文档");
    expect(html).not.toContain('id="fbYes"'); // 空态页无反馈卡（无章节可反馈）
    expect(html).not.toContain('id="tocList"'); // 无目录链接
  });

  it("buildSite 产物含 404.html（静态托管 404 约定）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-404-"));
    const prev = process.cwd();
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "README.md"), "# 首页");
      process.chdir(root);
      buildSite({ dir: "docs", outDir: "dist" });
      const nf = join(root, "dist", "404.html");
      expect(existsSync(nf)).toBe(true);
      expect(readFileSync(nf, "utf8")).toContain("页面未找到");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dev server 未知文档路径返回设计过的 404 页面（HTTP 404 + HTML 空态）", async () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-dev404-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "README.md"), "# 首页");
      const server = await startDevServer({ dir: root, port: 0 });
      try {
        const res = await fetch(`${server.url}nope/does-not-exist`);
        expect(res.status).toBe(404);
        const body = await res.text();
        expect(body).toContain('<div class="notfound">');
        expect(body).toContain("页面未找到");
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
