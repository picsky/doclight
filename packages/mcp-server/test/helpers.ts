/**
 * MCP 测试夹具：手工构造 dist-site 产物（docs.json / search-index.json / llms-full.txt / .html），
 * 不依赖 doclight-cli——保持 mcp-server 包零依赖可独立测试。
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeFixtureSite(): string {
  const dir = mkdtempSync(join(tmpdir(), "doclight-mcp-"));
  writeFileSync(
    join(dir, "docs.json"),
    JSON.stringify({
      version: 1,
      generatedAt: "2026-08-13T00:00:00.000Z",
      siteTitle: "测试站",
      siteDescription: "测试站点描述",
      siteUrl: "https://docs.example.com",
      totalDocs: 2,
      docs: [
        {
          path: "guide/a.md",
          url: "/guide/a.html",
          title: "A 文档",
          summary: "A 的摘要",
          tags: ["入门"],
          category: "指南",
          priority: "high",
          readingTime: 2,
          wordCount: 100,
          hasCode: false,
          headings: [{ level: 2, id: "安装", text: "安装" }],
        },
        {
          path: "guide/b.md",
          url: "/guide/b.html",
          title: "B 文档",
          summary: "B 的摘要",
          tags: ["进阶"],
          category: "参考",
          priority: "low",
          readingTime: 5,
          wordCount: 300,
          hasCode: true,
          headings: [{ level: 2, id: "示例", text: "示例" }],
        },
      ],
    })
  );
  writeFileSync(
    join(dir, "search-index.json"),
    JSON.stringify({
      version: "abc123",
      docs: [
        { path: "guide/a.html", title: "A 文档", headings: ["安装"], text: "安装 DocLight 只需要一条命令 hello world" },
        { path: "guide/b.html", title: "B 文档", headings: ["示例"], text: "进阶内容 表格 示例代码" },
      ],
    })
  );
  writeFileSync(
    join(dir, "llms-full.txt"),
    [
      "# 测试站 — 全站文档全文（llms-full.txt）",
      "",
      "> 文档总数：2",
      "",
      "## 路径：guide/a.md",
      "",
      "# A 文档",
      "",
      "安装 DocLight 只需要一条命令：npm install -g doclight。",
      "",
      "## 路径：guide/b.md",
      "",
      "# B 文档",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
    ].join("\n")
  );
  // read_doc format=html 用：产物 .html（含 <article>）
  mkdirSync(join(dir, "guide"), { recursive: true });
  writeFileSync(
    join(dir, "guide", "a.html"),
    "<html><head><title>A</title></head><body><article><h1>A 文档</h1><p>安装 DocLight</p></article></body></html>"
  );
  return dir;
}
