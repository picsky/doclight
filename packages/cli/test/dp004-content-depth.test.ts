/**
 * DP-004 内容表现纵深测试（Phase 7，18-design-polish §3.4）：
 * h4+ 层级补全 / 长表 sticky / 暗色图片降亮度 / 超长代码块展开与长表纵深规则 /
 * 引用 cite 分工。默认主题 CSS 为唯一事实来源（直读断言，与设计合规门禁同策略）。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CSS, renderPage } from "../src/site.ts";

describe("DP-004 内容纵深（默认主题 CSS 断言）", () => {
  it("h4/h5/h6 层级补全（宪法 §3.2 类型阶内，靠字号+字重+留白分层）", () => {
    expect(DEFAULT_THEME_CSS).toContain("article h4");
    expect(DEFAULT_THEME_CSS).toContain("article h5");
    expect(DEFAULT_THEME_CSS).toContain("article h6");
    expect(DEFAULT_THEME_CSS).toMatch(/article h6 \{[^}]*text-transform: uppercase/); // 小标题标签化
  });

  it("长表纵深：.tall 纵向滚动 + sticky 表头（无 JS 自然展开）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".table-wrap.tall { max-height: 480px; overflow-y: auto; }");
    expect(DEFAULT_THEME_CSS).toContain(".table-wrap.tall thead th { position: sticky;");
  });

  it("暗色模式图片降亮度 + 描边（白底截图不刺眼）", () => {
    expect(DEFAULT_THEME_CSS).toContain('[data-theme="dark"] article img { filter: brightness(.92)');
  });

  it("超长代码块折叠 + 展开按钮（渐进增强：无 JS 全量显示）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".codeblock.collapsed pre { max-height: 480px;");
    expect(DEFAULT_THEME_CSS).toContain(".codeblock .code-expand");
  });

  it("引用/callout 分工：blockquote 灰线无底色 + cite 出处", () => {
    expect(DEFAULT_THEME_CSS).toContain("article blockquote cite");
    // callout 保持语义色竖线（分工不回归）
    expect(DEFAULT_THEME_CSS).toContain("border-left: 2.5px solid var(--accent)");
  });

  it("renderPage 产物含全部 DP-004 规则（模板直出）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(html).toContain("article h6");
    expect(html).toContain(".code-expand");
    expect(html).toContain(".table-wrap.tall");
  });
});
