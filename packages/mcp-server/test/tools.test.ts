import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSite, type SiteData } from "../src/site.ts";
import { findTool, McpError, TOOLS } from "../src/tools.ts";
import { makeFixtureSite } from "./helpers.ts";

let site: SiteData;
let siteDir: string;

beforeAll(() => {
  siteDir = makeFixtureSite();
  site = loadSite(siteDir);
});

afterAll(() => {
  rmSync(siteDir, { recursive: true, force: true });
});

const call = (name: string, args: Record<string, unknown>) => {
  const tool = findTool(name);
  if (!tool) throw new Error(`工具不存在：${name}`);
  return tool.handler(site, args) as Record<string, unknown>;
};

describe("MCP 工具注册表（MCP-001 + CAP-001）", () => {
  it("七工具齐备，顺序稳定（get_capabilities 置首——写内容前第一查）", () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      "get_capabilities",
      "search_docs",
      "read_doc",
      "list_docs",
      "get_site_summary",
      "get_outline",
      "find_examples",
    ]);
  });

  it("每个工具都有 description 与 inputSchema", () => {
    for (const t of TOOLS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });
});

describe("get_capabilities（CAP-001）", () => {
  it("产物含 capabilities.json 时返回完整能力清单（source 标注）", () => {
    const r = call("get_capabilities", {}) as Record<string, unknown>;
    expect(r.schemaVersion).toBe(1);
    expect(r.source).toBe("capabilities.json");
    expect((r.markdown as { extensions: unknown[] }).extensions).toHaveLength(1);
    expect((r.plugins as Array<{ name: string }>)[0]!.name).toBe("mermaid");
    expect(r.outputs).toContain("capabilities.json");
  });

  it("产物缺失 capabilities.json 时诚实降级（complete=false + 重建提示 + 可推导信息，不伪造）", () => {
    const bare = mkdtempSync(join(tmpdir(), "doclight-mcp-nocap-"));
    try {
      writeFileSync(
        join(bare, "docs.json"),
        JSON.stringify({ siteTitle: "无能力站", totalDocs: 1, docs: [{ path: "a.md", title: "A", priority: "high" }] })
      );
      const bareSite = loadSite(bare);
      const tool = findTool("get_capabilities");
      expect(tool).toBeDefined();
      const r = tool!.handler(bareSite, {}) as Record<string, unknown>;
      expect(r.complete).toBe(false);
      expect(String(r.note)).toContain("capabilities.json");
      expect((r.derived as { siteTitle: string }).siteTitle).toBe("无能力站");
      expect(r.capabilities).toBeUndefined(); // 不伪造完整清单
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("search_docs", () => {
  it("命中返回结构化结果（path/score/snippet/matchedSection/url）", () => {
    const r = call("search_docs", { query: "doclight" }) as {
      results: Array<{ path: string; title: string; score: number; snippet: string; matchedSection?: string; url?: string }>;
      total: number;
      queryTimeMs: number;
    };
    expect(r.total).toBe(1);
    expect(r.results[0]!.path).toBe("guide/a.md"); // .html → .md 归一
    expect(r.results[0]!.title).toBe("A 文档");
    expect(r.results[0]!.url).toBe("/guide/a.html");
    expect(r.results[0]!.score).toBeGreaterThan(0);
    expect(r.results[0]!.snippet.toLowerCase()).toContain("doclight"); // 摘要保留原文大小写
    expect(typeof r.queryTimeMs).toBe("number");
  });

  it("分类 / 优先级 / 标签过滤", () => {
    expect((call("search_docs", { query: "示例", category: "指南" }) as { total: number }).total).toBe(0);
    expect((call("search_docs", { query: "表格", category: "参考" }) as { total: number }).total).toBe(1);
    expect((call("search_docs", { query: "示例", priority: "low" }) as { total: number }).total).toBe(1);
    expect((call("search_docs", { query: "示例", tags: ["进阶"] }) as { total: number }).total).toBe(1);
    expect((call("search_docs", { query: "示例", tags: ["入门"] }) as { total: number }).total).toBe(0);
  });

  it("includeContent=false 不含摘要", () => {
    const r = call("search_docs", { query: "doclight", includeContent: false }) as { results: Array<{ snippet?: string }> };
    expect(r.results[0]!.snippet).toBeUndefined();
  });

  it("缺 query 抛 McpError", () => {
    expect(() => call("search_docs", {})).toThrow(McpError);
  });
});

describe("read_doc", () => {
  it("默认返回纯 markdown 原稿（REND-004 双读友好）", () => {
    const r = call("read_doc", { path: "guide/a.md" }) as { path: string; content: string; format: string; wordCount: number; readingTime: number };
    expect(r.format).toBe("markdown");
    expect(r.content).toContain("# A 文档");
    expect(r.content).toContain("安装 DocLight");
    expect(r.path).toBe("guide/a.md");
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.readingTime).toBeGreaterThanOrEqual(1);
  });

  it(".html 路径归一为 .md", () => {
    const r = call("read_doc", { path: "/guide/a.html" }) as { path: string; content: string };
    expect(r.path).toBe("guide/a.md");
    expect(r.content).toContain("# A 文档");
  });

  it("section 截取到同/上级标题止", () => {
    const r = call("read_doc", { path: "guide/a.md", section: "A 文档" }) as { content: string };
    expect(r.content).toContain("安装 DocLight");
  });

  it("format=text 返回纯文本", () => {
    const r = call("read_doc", { path: "guide/a.md", format: "text" }) as { content: string; format: string };
    expect(r.format).toBe("text");
    expect(r.content).not.toContain("#");
  });

  it("format=html 读取产物 .html 的 <article>", () => {
    const r = call("read_doc", { path: "guide/a.md", format: "html" }) as { content: string };
    expect(r.content).toContain("<h1>A 文档</h1>");
  });

  it("不存在的文档抛 McpError（提示先 build）", () => {
    expect(() => call("read_doc", { path: "guide/missing.md" })).toThrow(/未找到文档/);
  });
});

describe("list_docs", () => {
  it("返回扁平列表 + total", () => {
    const r = call("list_docs", {}) as { docs: Array<{ path: string }>; total: number };
    expect(r.total).toBe(2);
    expect(r.docs.map((d) => d.path)).toEqual(["guide/a.md", "guide/b.md"]);
  });

  it("prefix / category / tags 过滤", () => {
    expect((call("list_docs", { prefix: "guide/" }) as { total: number }).total).toBe(2);
    expect((call("list_docs", { prefix: "api/" }) as { total: number }).total).toBe(0);
    expect((call("list_docs", { category: "指南" }) as { total: number }).total).toBe(1);
    expect((call("list_docs", { tags: ["进阶"] }) as { total: number }).total).toBe(1);
  });
});

describe("get_site_summary", () => {
  it("返回站点摘要（title/totalDocs/categories/keyTopics/suggestedEntry/aiFeatures）", () => {
    const r = call("get_site_summary", {}) as Record<string, unknown>;
    expect(r.title).toBe("测试站");
    expect(r.totalDocs).toBe(2);
    expect((r.categories as Array<{ name: string; count: number }>).length).toBe(2);
    expect(r.keyTopics).toContain("入门");
    expect(r.suggestedEntry).toBe("guide/a.md"); // high 优先
    expect(r.aiFeatures).toContain("llms.txt");
  });
});

describe("get_outline", () => {
  it("返回标题大纲", () => {
    const r = call("get_outline", { path: "guide/a.md" }) as { path: string; title: string; headings: Array<{ id: string; text: string }> };
    expect(r.path).toBe("guide/a.md");
    expect(r.title).toBe("A 文档");
    expect(r.headings[0]).toEqual({ level: 2, id: "安装", text: "安装" });
  });

  it("不存在的文档抛 McpError", () => {
    expect(() => call("get_outline", { path: "nope.md" })).toThrow(McpError);
  });
});

describe("find_examples", () => {
  it("按语言过滤返回代码块", () => {
    const r = call("find_examples", { language: "ts" }) as { results: Array<{ path: string; language: string; snippet: string }>; total: number };
    expect(r.total).toBe(1);
    expect(r.results[0]!.path).toBe("guide/b.md");
    expect(r.results[0]!.snippet).toContain("const x = 1;");
  });

  it("按 query 在代码内容中过滤", () => {
    const r = call("find_examples", { query: "const" }) as { total: number };
    expect(r.total).toBe(1);
    expect((call("find_examples", { query: "不存在" }) as { total: number }).total).toBe(0);
  });

  it("语言不匹配返回空", () => {
    expect((call("find_examples", { language: "python" }) as { total: number }).total).toBe(0);
  });
});
