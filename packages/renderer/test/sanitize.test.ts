import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { sanitizeHtml } from "../src/core/sanitize.ts";

/**
 * XSS 安全测试集（02 §2.3.7 / 12 §2.3.7，CI 常驻，REND-001）
 * marked 默认不 sanitize（Phase 0 已实测），sanitize 是强制安全层。
 * 任何新增渲染路径都必须先过本套件。
 */

/** 危险模式：输出中残留任一种即可判为不安全。
 *  /<svg/ 不在其中（2026-08-16 设计对齐：图解组件放行安全 SVG 子集，见 sanitize.ts
 *  SVG_TAGS 白名单；事件属性/javascript: 等注入面仍由 DANGEROUS_PATTERNS 覆盖）。 */
const DANGEROUS_PATTERNS = [
  /<script/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /javascript:/i,
  /\son\w+\s*=/i, // onerror/onload/onclick 等事件属性
  /<\s*math/i,
];

function assertSafe(html: string, label: string): void {
  for (const pattern of DANGEROUS_PATTERNS) {
    expect(html, `${label} 不应匹配 ${pattern}`).not.toMatch(pattern);
  }
}

describe("渲染管线安全测试集（REND-001）", () => {
  const cases: Array<{ name: string; md: string }> = [
    { name: "script 注入", md: "# t\n\n<script>alert('XSS')</script>" },
    { name: "javascript: URL 链接", md: "[点我](javascript:alert(1))" },
    { name: "onerror 事件属性", md: '<img src=x onerror=alert(1)>' },
    { name: "iframe 注入", md: "<iframe src='https://evil'></iframe>" },
    { name: "svg onload 注入", md: "<svg onload=alert(1)></svg>" },
    { name: "svg 内 script/链接/use 注入", md: '<figure class="diagram"><svg><script>alert(1)</script><a href="https://evil" xlink:href="javascript:alert(2)"><text>点我</text></a><use xlink:href="javascript:alert(3)"/><foreignObject><iframe src="https://evil"></iframe></foreignObject></svg></figure>' },
    { name: "data: URL 链接", md: "[x](data:text/html,<script>alert(1)</script>)" },
    { name: "HTML 实体绕过", md: "&lt;script&gt;alert(1)&lt;/script&gt;" },
    { name: "标签变形绕过", md: "<scr<script>ipt>alert(1)</scr</script>ipt>" },
    { name: "onclick 属性链接", md: '<a onclick="alert(1)">点我</a>' },
    { name: "markdown 内的原始表格含事件", md: "| a | b |\n|---|---|\n| <img src=x onerror=alert(1)> | ok |" },
  ];

  for (const c of cases) {
    it(`清除：${c.name}`, () => {
      const { html } = render(c.md);
      assertSafe(html, c.name);
    });
  }

  it("图解 SVG 白名单：安全子集存活、注入面全清（设计对齐 §4.5）", () => {
    const { html } = render(
      '<figure class="diagram"><svg viewBox="0 0 100 40"><rect class="d-box" x="10" y="10" width="80" height="20" rx="8"/><text class="d-node-title" x="50" y="24">节点</text></svg><figcaption>图 1</figcaption></figure>'
    );
    // 安全子集存活（节点/文本/标注 + class 令牌）
    expect(html).toContain("<svg");
    expect(html).toContain('class="d-box"');
    expect(html).toContain("<figcaption>图 1</figcaption>");
    // 注入面全清
    assertSafe(html, "图解 SVG 白名单");
  });

  it("清除后合法内容保留", () => {
    const { html } = render("<script>alert(1)</script><p>正常 <strong>加粗</strong></p>");
    assertSafe(html, "合法内容保留");
    expect(html).toContain("<p>正常 <strong>加粗</strong></p>");
  });

  it("sanitizeHtml 直接调用同样安全（安全单点）", () => {
    const out = sanitizeHtml('<script>alert(1)</script><a href="javascript:alert(1)">x</a>');
    assertSafe(out, "sanitizeHtml 直接调用");
  });
});
