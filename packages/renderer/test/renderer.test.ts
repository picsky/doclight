import { describe, expect, it } from "vitest";
import { render, rendererVersion } from "../src/index.ts";
import { analyzeDoc } from "../src/analyze.ts";

describe("@doclight/renderer 渲染管线（REND-001）", () => {
  it("导出包版本号", () => {
    expect(rendererVersion).toBe("0.1.0");
  });

  it("render 输出完整 HTML 与 frontmatter", () => {
    const md = `---
title: 快速开始
summary: 5 分钟上手
tags: [入门, 安装]
---

# Hello

一段正文。`;
    const { html, frontmatter } = render(md);
    expect(html).toContain("<h1");
    expect(html).toContain("一段正文");
    expect(frontmatter.title).toBe("快速开始");
    expect(frontmatter.summary).toBe("5 分钟上手");
    expect(frontmatter.tags).toEqual(["入门", "安装"]);
  });

  it("无 frontmatter 时正常渲染且 frontmatter 为空", () => {
    const { html, frontmatter } = render("# 只有标题");
    expect(html).toContain("只有标题");
    expect(frontmatter).toEqual({});
  });

  it("标题注入锚点 id（中文保留）", () => {
    const { html } = render("# 快速开始\n\n## 安装指南");
    expect(html).toContain('<h1 id="快速开始">');
    expect(html).toContain('<h2 id="安装指南">');
  });

  it("双读锚点一致：含链接/行内代码标题，页面 id 与大纲分析同源（2026-08 M5）", () => {
    const md = "## 参见 [MDN](https://mdn.dev)\n\n## 使用 `a_b` 与 **强调**";
    const { html } = render(md);
    // 链接只保留文本、剥行内代码/强调/下划线标记后再 slugify（不再出现 https-mdn-dev 噪音）
    expect(html).toContain('<h2 id="参见-mdn">');
    expect(html).toContain('<h2 id="使用-ab-与-强调">');
    // 与 analyzeDoc 大纲 id 完全一致（docs.json / llms / MCP 分节锚点可直达页面）
    const { headings } = analyzeDoc(md);
    expect(headings.map((h) => h.id)).toEqual(["参见-mdn", "使用-ab-与-强调"]);
  });

  it("GFM 表格 / 任务列表 / 删除线完整渲染（REND-001）", () => {
    const { html } = render(
      [
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "- [x] 已完成",
        "- [ ] 待办",
        "",
        "~~删除~~ 保留",
      ].join("\n")
    );
    expect(html).toContain('<div class="table-wrap"><table>');
    expect(html).toContain("<th>A</th>");
    expect(html).toContain('<input checked="" disabled="" type="checkbox">');
    expect(html).toContain('<del>删除</del>');
  });

  it("相对链接按当前文档路径修正", () => {
    const { html } = render("[下一页](other.md)", { currentPath: "guide/quickstart.md" });
    expect(html).toContain('<a href="guide/other.md">');
  });

  it("linkSuffix：SSG 形态站内链接转 .html，dev 缺省保持 .md（SSG-001）", () => {
    const md = "[下一页](other.md) [锚点](#topic) [外部](https://a.com) ![图](../img/x.png)";
    const dev = render(md, { currentPath: "guide/quickstart.md" });
    const ssg = render(md, { currentPath: "guide/quickstart.md", linkSuffix: ".html" });
    // dev 保持 .md；SSG 转 .html
    expect(dev.html).toContain('<a href="guide/other.md">');
    expect(ssg.html).toContain('<a href="guide/other.html">');
    expect(ssg.html).not.toContain("other.md");
    // 锚点 / 外部链接不受影响；图片为页面目录相对（嵌套页面 404 修复，2026-08）
    expect(ssg.html).toContain('href="#topic"');
    expect(ssg.html).toContain('href="https://a.com"');
    expect(ssg.html).toContain('<img src="../img/x.png"');
    // 非 .md 链接（如 pdf）不误伤
    const pdf = render("[手册](manual.pdf)", { currentPath: "guide/quickstart.md", linkSuffix: ".html" });
    expect(pdf.html).toContain('href="guide/manual.pdf"');
  });

  it("外部链接新标签打开", () => {
    const { html } = render("[外部](https://example.com)");
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener">');
  });

  it("图片相对路径修正 + 懒加载（页面目录相对，嵌套页面不 404）", () => {
    // 嵌套目录页面：../img/logo.png 相对页面目录解析到站内 img/logo.png
    const { html } = render("![logo](../img/logo.png)", { currentPath: "guide/quickstart.md" });
    expect(html).toContain('<img src="../img/logo.png" alt="logo" loading="lazy">');

    // 二级嵌套：figures/x.png 相对 论文解读/00.md 应上溯两层（src 经 URL 解析器
    // 百分号编码，浏览器请求时自动解码，语义等价——解码后比对）
    const deep = render("![图](figures/x.png)", { currentPath: "论文解读/00-论文速览.md" });
    const deepSrc = /<img src="([^"]+)" alt="图" loading="lazy">/.exec(deep.html)?.[1];
    expect(deepSrc).toBeDefined();
    expect(decodeURIComponent(deepSrc!)).toBe("../论文解读/figures/x.png");

    // 根页面：无需上溯
    const root = render("![图](img/a.png)", { currentPath: "README.md" });
    expect(root.html).toContain('<img src="img/a.png"');

    // 外部图片不修正
    const ext = render("![图](https://example.com/a.png)", { currentPath: "guide/quickstart.md" });
    expect(ext.html).toContain('src="https://example.com/a.png"');
  });

  it("代码块带语言类名（REND-002 标记：doclight-code + language-*）", () => {
    const { html } = render("```js\nconsole.log('hi');\n```");
    // 引号在代码文本节点中无需实体转义，DOMPurify 序列化时解码为字面量（语义等价且安全）
    expect(html).toContain('<pre class="doclight-code"><code class="language-js">console.log(\'hi\');</code></pre>');
  });
});
