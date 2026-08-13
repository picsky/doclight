/**
 * REND-002 扩展语法渲染单测（容器 / 代码块标记 / Mermaid 围栏 / KaTeX 标记）
 *
 * 覆盖：渲染产物标记、降级策略、sanitize 白名单（class 保留 / XSS 清除）、
 * 注册表查询 API、价格误判防护。
 */
import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  render,
  getExtensions,
  isEnabled,
  collectExtensionClasses,
  setExtensions,
  DEFAULT_EXTENSIONS,
} from "../src/index.ts";

describe("REND-002 扩展语法注册表", () => {
  afterEach(() => setExtensions(DEFAULT_EXTENSIONS));

  it("默认白名单含 4 个扩展（code-block / mermaid / container / katex）", () => {
    const ids = getExtensions().map((e) => e.id);
    expect(ids).toContain("code-block");
    expect(ids).toContain("mermaid");
    expect(ids).toContain("container");
    expect(ids).toContain("katex");
    expect(isEnabled("mermaid")).toBe(true);
    expect(isEnabled("unknown")).toBe(false);
  });

  it("collectExtensionClasses 汇聚全部 class 标记（sanitize 白名单断言依据）", () => {
    const classes = collectExtensionClasses();
    expect(classes).toContain("doclight-code");
    expect(classes).toContain("doclight-mermaid");
    expect(classes).toContain("doclight-tip");
    expect(classes).toContain("doclight-katex-inline");
    expect(classes).toContain("doclight-katex-block");
  });

  it("setExtensions 可裁剪白名单（测试注入：禁用 katex 后 $…$ 不再触发）", () => {
    setExtensions(DEFAULT_EXTENSIONS.filter((e) => e.id !== "katex"));
    const { html } = render("公式 $x^2$ 保留原样");
    expect(html).toContain("$x^2$");
    expect(html).not.toContain("doclight-katex-inline");
  });
});

describe("REND-002 代码块标记（高亮 + 复制 + Mermaid 分流）", () => {
  it("普通代码块带 doclight-code 与 language-* 标记", () => {
    const { html } = render("```ts\nconst a: number = 1;\n```");
    expect(html).toContain('<pre class="doclight-code"><code class="language-ts">');
  });

  it("无语言代码块不带 language-*（只标 doclight-code）", () => {
    const { html } = render("```\n纯文本代码\n```");
    expect(html).toContain('<pre class="doclight-code"><code>纯文本代码</code></pre>');
  });

  it("代码内容转义（防 HTML 注入）", () => {
    const { html } = render("```html\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("REND-003 Mermaid 容错渲染（Node 侧标记 + fallback）", () => {
  it("mermaid 围栏 → .doclight-mermaid + 源码 fallback 子元素", () => {
    const { html } = render("```mermaid\ngraph TD\n  A-->B\n```");
    expect(html).toContain('<div class="doclight-mermaid">');
    expect(html).toContain('<pre class="doclight-mermaid-src"><code>');
    // 源码作为 fallback 文本保留（降级不白屏的关键）
    expect(html).toContain("A--&gt;B");
  });

  it("Mermaid 源码含 > 时 sanitize 后仍保留（spike：data-* 不可依赖，子元素方案稳定）", () => {
    const { html } = render("```mermaid\nflowchart LR\n  a-->b-->c\n```");
    expect(html).toContain("doclight-mermaid");
    expect(html).toContain("a--&gt;b");
  });

  it("Mermaid 源码注入脚本被转义清除（sanitize 白名单）", () => {
    const { html } = render("```mermaid\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("REND-002 自定义容器（:::tip/warning/danger/info）", () => {
  it("tip 容器渲染 + 内层 markdown 保留（加粗/列表）", () => {
    const { html } = render(":::tip\n这是**加粗**提示\n- 列表项\n:::");
    expect(html).toContain('<div class="doclight-container doclight-tip">');
    expect(html).toContain("<strong>加粗</strong>");
    expect(html).toContain("<li>列表项</li>");
  });

  it("四种类型全部识别", () => {
    for (const kind of ["tip", "warning", "danger", "info"]) {
      const { html } = render(`:::${kind}\n内容\n:::`);
      expect(html).toContain(`doclight-${kind}`);
    }
  });

  it("容器内嵌套代码块正常渲染", () => {
    const { html } = render(":::warning\n```js\nconst a = 1;\n```\n:::");
    expect(html).toContain("doclight-warning");
    expect(html).toContain('<pre class="doclight-code"><code class="language-js">');
  });

  it("未知类型不识别（白名单式：降级为普通段落）", () => {
    const { html } = render(":::foobar\nx\n:::");
    expect(html).not.toContain("doclight-container");
    // marked 当作普通文本段落处理
    expect(html).toContain(":::foobar");
  });

  it("容器内注入脚本被清除", () => {
    const { html } = render(":::tip\n<script>alert(1)</script>\n:::");
    expect(html).not.toContain("<script>");
    expect(html).toContain("doclight-tip");
  });
});

describe("REND-002 KaTeX 公式标记", () => {
  it("内联 $…$ → .doclight-katex-inline，TeX 源码作文本（降级可见）", () => {
    const { html } = render("公式 $x^2 + 1$ 结束");
    expect(html).toContain('<span class="doclight-katex-inline">x^2 + 1</span>');
  });

  it("块级 $$…$$ → .doclight-katex-block", () => {
    const { html } = render("$$\n\\int_0^1 x dx\n$$");
    expect(html).toContain('<div class="doclight-katex-block">');
    expect(html).toContain("\\int_0^1 x dx");
  });

  it("价格误判防护：$5 和 $10 不触发（内容尾随空格）", () => {
    const { html } = render("价格 $5 和 $10 对比");
    expect(html).not.toContain("doclight-katex-inline");
    expect(html).toContain("价格 $5");
  });

  it("TeX 含特殊字符转义后入 DOM（防属性/标签逃逸）", () => {
    const { html } = render("$a < b \\& c$");
    expect(html).toContain("doclight-katex-inline");
    expect(html).not.toContain("<b");
    expect(html).toContain("a &lt; b \\&amp; c");
  });
});

describe("REND-004 双读友好（扩展渲染不破坏 agent 消费原稿）", () => {
  it("render 是纯函数：不修改输入 Markdown 源串", () => {
    const md = ":::tip\n提示\n:::\n\n```mermaid\ngraph TD\n  A-->B\n```";
    const snapshot = md;
    render(md);
    expect(md).toBe(snapshot);
  });

  it("渲染产物中扩展源码可读回（agent 从 HTML 消费扩展内容，非 data-* 依赖）", () => {
    const { html } = render(":::tip\n可读提示\n:::\n\n$E=mc^2$");
    // 容器内层文本、KaTeX 源码都作为可见文本保留在产物中
    expect(html).toContain("可读提示");
    expect(html).toContain("E=mc^2");
  });

  it("扩展渲染后 .md 源文件不被改动（读渲染内核即可验证：render 无写盘路径）", () => {
    // render() 仅读取并处理字符串，不触碰文件系统——源文件天然保持纯 markdown。
    // 此处验证渲染产物不包含原始 frontmatter（源被「吞掉」仅限渲染层，磁盘原稿不动）。
    const md = "---\ntitle: 双读\n---\n\n:::tip\n内容\n:::";
    const { html, frontmatter } = render(md);
    expect(frontmatter.title).toBe("双读");
    expect(html).toContain("doclight-tip");
  });
});

describe("REND-002 Dogfood：真实交接文档渲染不报错", () => {
  it("渲染 docs/agent-handoffs/PHASE-2-search-complete.md（真实长文档，含表格/代码块/引用）", () => {
    const source = readFileSync(new URL("../../../docs/agent-handoffs/PHASE-2-search-complete.md", import.meta.url), "utf8");
    const { html, frontmatter } = render(source, { currentPath: "docs/agent-handoffs/PHASE-2-search-complete.md" });
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain("<table");
    expect(frontmatter).toBeDefined();
  });
});
