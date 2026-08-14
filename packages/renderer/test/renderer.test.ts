import { describe, expect, it } from "vitest";
import { render, rendererVersion } from "../src/index.ts";

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
    // 锚点 / 外部链接 / 图片不受影响
    expect(ssg.html).toContain('href="#topic"');
    expect(ssg.html).toContain('href="https://a.com"');
    expect(ssg.html).toContain('<img src="img/x.png"');
    // 非 .md 链接（如 pdf）不误伤
    const pdf = render("[手册](manual.pdf)", { currentPath: "guide/quickstart.md", linkSuffix: ".html" });
    expect(pdf.html).toContain('href="guide/manual.pdf"');
  });

  it("外部链接新标签打开", () => {
    const { html } = render("[外部](https://example.com)");
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener">');
  });

  it("图片相对路径修正 + 懒加载", () => {
    const { html } = render("![logo](../img/logo.png)", { currentPath: "guide/quickstart.md" });
    // DOMPurify 重序列化为 HTML 格式（非 XHTML 自我闭合）
    expect(html).toContain('<img src="img/logo.png" alt="logo" loading="lazy">');
  });

  it("代码块带语言类名（REND-002 标记：doclight-code + language-*）", () => {
    const { html } = render("```js\nconsole.log('hi');\n```");
    // 引号在代码文本节点中无需实体转义，DOMPurify 序列化时解码为字面量（语义等价且安全）
    expect(html).toContain('<pre class="doclight-code"><code class="language-js">console.log(\'hi\');</code></pre>');
  });
});
