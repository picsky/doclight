/**
 * 插件系统端到端（PLUG-006 接线 + PLUG-007 官方插件 + PLUG-010 onBuild）
 *
 * 对应：specs/features/plugin.feature（PLUG-006/007/009/010）。
 * 无浏览器依赖的构建级 e2e：真实 buildSite/startDevServer + 官方插件加载器，
 * 验证「doclight.json plugins → 构建管线 → 产物」全链路：
 * - extendMarked 自定义语法经渲染内核生效（PLUG-006 接线修复回归防线）
 * - 官方插件插槽内容进页面 HTML（giscus / plausible / ai-chat / pwa）
 * - onBuild 产物落盘（rss.xml / manifest.json / sw.js）
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../packages/cli/src/build.ts";
import { startDevServer } from "../packages/cli/src/dev-server.ts";
import { loadPluginsSync } from "../packages/cli/src/plugin-loader.ts";
import type { PluginDef } from "../packages/core/src/plugin.ts";

const root = mkdtempSync(join(tmpdir(), "doclight-plugin-e2e-"));
const docsDir = join(root, "docs");
const outDir = join(root, "dist-site");

/** 自定义语法插件（```chart 围栏 → class 标记，PLUG-006 extendMarked 接线验证） */
const chartPlugin: PluginDef = {
  name: "chart",
  extendMarked(marked) {
    marked.use({
      extensions: [
        {
          name: "doclightChart",
          level: "block",
          start(src: string) {
            return src.indexOf("```chart");
          },
          tokenizer(src: string) {
            const match = /^```chart\n([\s\S]*?)\n?```/.exec(src);
            if (!match) return undefined;
            return { type: "doclightChart", raw: match[0], spec: match[1] };
          },
          renderer(token: { spec: string }) {
            return `<div class="doclight-chart">${token.spec}</div>`;
          },
        },
      ],
    });
  },
};

test.beforeAll(() => {
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(
    join(root, "doclight.json"),
    JSON.stringify({
      title: "插件测试站",
      siteUrl: "https://demo.example.com",
      plugins: [
        { name: "giscus", config: { repo: "owner/repo" } },
        { name: "plausible", config: { domain: "demo.example.com" } },
        { name: "rss", config: { limit: 5 } },
        { name: "pwa", config: { name: "演示文档" } },
        { name: "ai-chat", config: { endpoint: "https://proxy.example.com/ask" } },
      ],
    })
  );
  writeFileSync(
    join(docsDir, "README.md"),
    ["---", "title: 首页", "---", "", "# 欢迎", "", "```chart", '{"type":"bar"}', "```"].join("\n")
  );
  writeFileSync(join(docsDir, "guide", "start.md"), ["---", "title: 快速开始", "---", "", "# 快速开始"].join("\n"));
});

test.afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

test("PLUG-006 接线：extendMarked 自定义语法经 SSG 渲染内核生效", () => {
  buildSite({ dir: docsDir, outDir, title: "插件测试站", siteUrl: "https://demo.example.com", buildPlugins: [chartPlugin] });
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  expect(html).toContain('class="doclight-chart"');
  expect(html).toContain('{"type":"bar"}');
});

test("PLUG-007 官方插件：加载器解析 doclight.json → SSG 产物含插槽内容", () => {
  const result = loadPluginsSync(
    JSON.parse(readFileSync(join(root, "doclight.json"), "utf8")).plugins,
    root
  );
  expect(result.skipped).toEqual([]);
  expect(result.plugins.map((p) => p.name)).toEqual(["giscus", "plausible", "rss", "pwa", "ai-chat"]);

  buildSite({ dir: docsDir, outDir, title: "插件测试站", siteUrl: "https://demo.example.com", buildPlugins: result.plugins });
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  // 插槽内容进页面：giscus 评论 / plausible 统计 / ai-chat 问答 / pwa manifest 链接
  expect(html).toContain('class="doclight-giscus"');
  expect(html).toContain("https://giscus.app/client.js");
  expect(html).toContain('data-domain="demo.example.com"');
  expect(html).toContain('class="doclight-ai-chat"');
  expect(html).toContain('<link rel="manifest" href="/manifest.json">');
});

test("PLUG-010 onBuild：rss.xml / manifest.json / sw.js 落盘", () => {
  const result = loadPluginsSync(
    JSON.parse(readFileSync(join(root, "doclight.json"), "utf8")).plugins,
    root
  );
  buildSite({ dir: docsDir, outDir, title: "插件测试站", siteUrl: "https://demo.example.com", buildPlugins: result.plugins });

  expect(existsSync(join(outDir, "rss.xml"))).toBe(true);
  const rss = readFileSync(join(outDir, "rss.xml"), "utf8");
  expect(rss).toContain("<rss version=\"2.0\">");
  expect(rss).toContain("<title>首页</title>");
  expect(rss).toContain("<title>快速开始</title>");

  expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
  const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
  expect(manifest.name).toBe("演示文档");
  expect(manifest.start_url).toBe("/");

  expect(existsSync(join(outDir, "sw.js"))).toBe(true);
  expect(readFileSync(join(outDir, "sw.js"), "utf8")).toContain("doclight-v1");
});

test("dev server：插件管线 + 插槽内容全链路（extendMarked + slotContent）", async () => {
  const server = await startDevServer({ dir: docsDir, title: "插件测试站", buildPlugins: [chartPlugin] });
  try {
    const res = await fetch(`${server.url}/`);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain('class="doclight-chart"'); // extendMarked 自定义语法（dev 形态）
  } finally {
    await server.close();
  }
});
