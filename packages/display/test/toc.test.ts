import { describe, expect, it } from "vitest";
import { parseHeadings, renderTocHtml, type TocHeading } from "../src/toc.ts";

describe("TOC 标题提取（TOC-001，03 §3.7.3）", () => {
  const html =
    "<h1 id=\"top\">页面标题</h1><p>正文</p>" +
    "<h2 id=\"install\">安装</h2><p>…</p>" +
    "<h3 id=\"install-win\">Windows 安装</h3>" +
    "<h3 id=\"install-mac\">macOS 安装</h3>" +
    "<h2 id=\"config\">配置</h2><p>…</p>" +
    "<h4 id=\"too-deep\">太细的标题不应入目录</h4>";

  it("只提取 h2/h3（不含 h1，不含 h4+）", () => {
    const headings = parseHeadings(html);
    expect(headings.map((h) => h.id)).toEqual(["install", "install-win", "install-mac", "config"]);
    expect(headings.map((h) => h.level)).toEqual([2, 3, 3, 2]);
  });

  it("提取标题文本（剥除内联标签与实体解码）", () => {
    const h = parseHeadings('<h2 id="x"><code>npm</code> &amp; <strong>yarn</strong></h2>');
    expect(h[0]!.text).toBe("npm & yarn");
  });

  it("无 id 或空文本的标题被跳过", () => {
    const h = parseHeadings("<h2>无 id</h2><h3 id=\"ok\">有 id</h3>");
    expect(h.map((x) => x.id)).toEqual(["ok"]);
  });

  it("无标题返回空数组", () => {
    expect(parseHeadings("<p>只有正文</p>")).toEqual([]);
  });
});

describe("TOC 渲染（TOC-001 + 设计对齐 2026-08-16：演示页目录结构）", () => {
  const headings: TocHeading[] = [
    { level: 2, id: "a", text: "章节 A" },
    { level: 3, id: "a-1", text: "小节 A.1" },
  ];

  it("renderTocHtml 输出带 data-toc-id 与锚点的链接，h3 加 l3 类", () => {
    const html = renderTocHtml(headings);
    expect(html).toContain('href="#a"');
    expect(html).toContain('data-toc-id="a"');
    expect(html).toContain("章节 A");
    expect(html).toContain('class="l3"');
  });

  it("标题文本含引号时正确转义", () => {
    const h = renderTocHtml([{ level: 2, id: "q", text: '说"到"做到' }]);
    expect(h).toContain("&quot;");
  });
});
