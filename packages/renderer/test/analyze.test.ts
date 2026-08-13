import { describe, expect, it } from "vitest";
import { analyzeDoc, countWords } from "../src/analyze.ts";

describe("语义 frontmatter 自动计算（FRONT-001）", () => {
  it("无显式 summary 时从正文首段提取", () => {
    const a = analyzeDoc("# 安装\n\n安装 DocLight 只需要一条命令：npm install -g doclight。\n\n更多内容……");
    expect(a.summary).toBe("安装 DocLight 只需要一条命令：npm install -g doclight。");
  });

  it("显式 summary/description 优先于首段", () => {
    const a = analyzeDoc("---\nsummary: 官方摘要\n---\n\n# 标题\n\n首段内容");
    expect(a.summary).toBe("官方摘要");
    const b = analyzeDoc("---\ndescription: 描述字段\n---\n\n首段");
    expect(b.summary).toBe("描述字段");
  });

  it("summary 截断超长首段（~200 字）", () => {
    const long = "长".repeat(300);
    const a = analyzeDoc(`# 标题\n\n${long}`);
    expect(a.summary.length).toBeLessThanOrEqual(201);
    expect(a.summary.endsWith("…")).toBe(true);
  });

  it("wordCount：CJK 逐字 + 非 CJK 分词，剥 frontmatter/代码块/链接语法", () => {
    // 标题 2 字 + 正文 6 字 = 8 CJK；hello/world 2 词；frontmatter 与代码块不计
    const md = "---\ntitle: 不计入正文\n---\n# 标题\n\n九个中文字符 hello world\n\n```ts\nconst x = 1;\n```\n";
    expect(countWords(md)).toBe(10);
  });

  it("readingTime：wordCount/300 取整，至少 1", () => {
    expect(analyzeDoc("正文").readingTime).toBe(1);
    expect(analyzeDoc("字".repeat(600)).readingTime).toBe(2);
    expect(analyzeDoc("字".repeat(301)).readingTime).toBe(1);
  });

  it("headings：提取层级/文本/锚点 id，排除代码块内标题", () => {
    const md = "# 一级\n\n## 二级 标题\n\n```md\n# 代码块内的不算\n```\n\n### 三级";
    const a = analyzeDoc(md);
    expect(a.headings).toEqual([
      { level: 1, id: "一级", text: "一级" },
      { level: 2, id: "二级-标题", text: "二级 标题" },
      { level: 3, id: "三级", text: "三级" },
    ]);
  });

  it("hasCode：检测 ``` 围栏", () => {
    expect(analyzeDoc("正文").hasCode).toBe(false);
    expect(analyzeDoc("```js\nconsole.log(1)\n```").hasCode).toBe(true);
  });

  it("无 frontmatter / 纯空文档不抛错", () => {
    expect(() => analyzeDoc("")).not.toThrow();
    expect(analyzeDoc("").wordCount).toBe(0);
    expect(analyzeDoc("").headings).toEqual([]);
  });

  it("锚点 id 与渲染内核一致（slugify 中文保留）", () => {
    const a = analyzeDoc("## 中文 标题!测试");
    expect(a.headings[0]!.id).toBe("中文-标题-测试");
  });
});
