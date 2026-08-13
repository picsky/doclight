import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, classifyPriority, isExcluded, type LlmsDoc } from "../src/llms.ts";

const DOCS: LlmsDoc[] = [
  { path: "README.md", url: "/", title: "项目介绍", summary: "零构建文档站引擎", readingTime: 3, priority: "high" },
  {
    path: "guide/quickstart.md",
    url: "/guide/quickstart.html",
    title: "快速开始",
    summary: "5 分钟上手",
    tags: ["入门", "安装"],
    category: "指南",
    readingTime: 5,
    priority: "medium",
  },
  {
    path: "api/runtime.md",
    url: "/api/runtime.html",
    title: "运行时 API",
    summary: "运行时参考",
    readingTime: 10,
    priority: "low",
  },
];

describe("智能分级（LLMS-001）", () => {
  it("frontmatter.priority 显式声明最高优先级", () => {
    expect(classifyPriority("guide/foo.md", "high")).toBe("high");
    expect(classifyPriority("api/foo.md", "high")).toBe("high");
  });

  it("默认规则：根级/quickstart→high，guide→medium，api/faq→low，其余→medium", () => {
    expect(classifyPriority("README.md", undefined)).toBe("high");
    expect(classifyPriority("quickstart.md", undefined)).toBe("high");
    expect(classifyPriority("guide/foo.md", undefined)).toBe("medium");
    expect(classifyPriority("tutorial/foo.md", undefined)).toBe("medium");
    expect(classifyPriority("api/foo.md", undefined)).toBe("low");
    expect(classifyPriority("faq.md", undefined)).toBe("low");
    expect(classifyPriority("misc/other.md", undefined)).toBe("medium");
  });

  it("用户自定义 priority 覆盖默认规则（精确路径或目录前缀）", () => {
    const cfg = { priority: { high: ["custom/"], low: ["guide/"] } };
    expect(classifyPriority("custom/a.md", undefined, cfg)).toBe("high");
    expect(classifyPriority("guide/foo.md", undefined, cfg)).toBe("low"); // 用户把 guide 降为 low
    expect(classifyPriority("README.md", undefined, cfg)).toBe("high"); // 默认规则兜底
  });

  it("isExcluded：精确路径或目录前缀", () => {
    expect(isExcluded("draft-x.md", { exclude: ["draft-*.md"] })).toBe(false); // 不支持 glob，只做精确/前缀
    expect(isExcluded("internal/foo.md", { exclude: ["internal/"] })).toBe(true);
    expect(isExcluded("private.md", { exclude: ["private.md"] })).toBe(true);
  });
});

describe("buildLlmsTxt（LLMS-001）", () => {
  const txt = buildLlmsTxt({
    siteTitle: "DocLight",
    siteDescription: "零构建、AI 原生友好的文档站引擎",
    siteUrl: "https://docs.example.com",
    docs: DOCS,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });

  it("含站点摘要与分级分组", () => {
    expect(txt).toContain("# DocLight");
    expect(txt).toContain("零构建、AI 原生友好的文档站引擎");
    expect(txt).toContain("## 核心文档 ★★★");
    expect(txt).toContain("## 使用指南 ★★☆");
    expect(txt).toContain("## 参考资料 ★☆☆");
  });

  it("条目携带语义 frontmatter（summary/tags/readingTime——合同验收项）", () => {
    const qs = txt.split("\n").find((l) => l.includes("快速开始"))!;
    expect(qs).toContain("5 分钟上手");
    expect(qs).toContain("标签: 入门 / 安装");
    expect(qs).toContain("分类: 指南");
    expect(qs).toContain("5 分钟");
  });

  it("含 Agent 专用端点与术语表", () => {
    expect(txt).toContain("## Agent 专用端点");
    expect(txt).toContain("- /mcp — MCP Server");
    expect(txt).toContain("- /llms-full.txt");
    expect(txt).toContain("## 术语表");
    expect(txt).toContain("MCP — Model Context Protocol");
  });

  it("exclude 的文档不进入 llms.txt", () => {
    const withExclude = buildLlmsTxt({
      siteTitle: "DocLight",
      docs: DOCS,
      generatedAt: "2026-08-13T00:00:00.000Z",
      llmsTxt: { exclude: ["api/"] },
    });
    expect(withExclude).not.toContain("运行时 API");
    expect(withExclude).not.toContain("api/runtime.html");
  });
});

describe("buildLlmsFullTxt（LLMS-001）", () => {
  const full = buildLlmsFullTxt({
    siteTitle: "DocLight",
    generatedAt: "2026-08-13T00:00:00.000Z",
    docs: [
      { path: "guide/a.md", content: "# A\n\n内容 A" },
      { path: "guide/b.md", content: "# B\n\n内容 B" },
    ],
  });

  it("全文按文档分节，节头为 `## 路径：<path>`（MCP read_doc 依赖）", () => {
    expect(full).toContain("## 路径：guide/a.md");
    expect(full).toContain("## 路径：guide/b.md");
    expect(full).toContain("# A\n\n内容 A");
    expect(full).toContain("# B\n\n内容 B");
  });

  it("exclude 的文档不进入全文", () => {
    const f = buildLlmsFullTxt({
      siteTitle: "DocLight",
      generatedAt: "2026-08-13T00:00:00.000Z",
      docs: [{ path: "draft.md", content: "# 草稿" }],
      llmsTxt: { exclude: ["draft.md"] },
    });
    expect(f).not.toContain("# 草稿");
  });
});
