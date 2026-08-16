/**
 * 双滚动条修复（2026-08，方案 1）：内容标题多时 TOC/侧栏出现内层竖向滚动条，
 * 与页面主滚动条并存（双滚动条）。修复 = 隐藏内层滚动条（保留滚动能力）
 * + 展示层激活章节 scrollIntoView 保持可见（toc.ts setActive/refresh）。
 * 默认主题 CSS 为唯一事实来源（直读断言，与 dp004 同策略）。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CSS, renderPage } from "../src/site.ts";

describe("双滚动条修复（TOC/侧栏隐藏内层滚动条）", () => {
  it(".toc 隐藏内层滚动条（Firefox scrollbar-width: none + WebKit ::-webkit-scrollbar）", () => {
    expect(DEFAULT_THEME_CSS).toContain("scrollbar-width: none;");
    expect(DEFAULT_THEME_CSS).toContain(".toc::-webkit-scrollbar { display: none; }");
  });

  it(".sidebar 同样隐藏内层滚动条（导航条目多时不出现第二根滚动条）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".sidebar::-webkit-scrollbar { display: none; }");
  });

  it("内层滚动容器切断滚动链（overscroll-behavior: contain：滚到尽头不带动页面）", () => {
    expect(DEFAULT_THEME_CSS).toContain("overscroll-behavior: contain;");
  });

  it("renderPage 产物直出隐藏规则（三形态同构，模板唯一事实来源）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(html).toContain(".toc::-webkit-scrollbar");
    expect(html).toContain(".sidebar::-webkit-scrollbar");
  });
});
