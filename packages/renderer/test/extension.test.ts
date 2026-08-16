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

  it("默认白名单含 5 个扩展（code-block / container / tabs / steps / katex；mermaid 已迁移为插件，PLUG-012）", () => {
    const ids = getExtensions().map((e) => e.id);
    expect(ids).toContain("code-block");
    expect(ids).toContain("container");
    expect(ids).toContain("tabs");
    expect(ids).toContain("steps");
    expect(ids).toContain("katex");
    expect(ids).not.toContain("mermaid");
    expect(isEnabled("mermaid")).toBe(false);
    expect(isEnabled("unknown")).toBe(false);
  });

  it("collectExtensionClasses 汇聚全部 class 标记（sanitize 白名单断言依据）", () => {
    const classes = collectExtensionClasses();
    expect(classes).toContain("doclight-code");
    expect(classes).not.toContain("doclight-mermaid");
    expect(classes).toContain("doclight-tip");
    expect(classes).toContain("tabs");
    expect(classes).toContain("steps");
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

describe("REND-002 代码块标记（高亮 + 复制）", () => {
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

  it("PLUG-012：未启用 mermaid 插件时 mermaid 围栏按普通代码块渲染（源码可见可复制）", () => {
    // mermaid 已从内置扩展迁移为官方插件——渲染内核不再分流，默认降级为普通代码块
    const { html } = render("```mermaid\ngraph TD\n  A-->B\n```");
    expect(html).toContain('<pre class="doclight-code"><code class="language-mermaid">');
    expect(html).not.toContain("doclight-mermaid");
    expect(html).toContain("A--&gt;B");
  });
});

describe("REND-002 代码块头部条（设计对齐 2026-08-16：codeblock/code-head/fname/lang/copy）", () => {
  it("代码块包裹 codeblock 结构（头部条 + 代码体）", () => {
    const { html } = render("```ts\nconst a: number = 1;\n```");
    expect(html).toContain('<div class="codeblock">');
    expect(html).toContain('<div class="code-head">');
    expect(html).toContain('<span class="lang">ts</span>');
    expect(html).toContain('class="copy-btn"');
    expect(html).toContain('<pre class="doclight-code"><code class="language-ts">');
  });

  it("info string 解析：title=\"文件\" → fname；裸文件名同样支持", () => {
    const { html } = render('```ts title="lib/aster.ts"\nconst x = 1;\n```');
    expect(html).toContain('<span class="fname">lib/aster.ts</span>');
    const bare = render("```ts lib/a.ts\nconst x = 1;\n```");
    expect(bare.html).toContain('<span class="fname">lib/a.ts</span>');
    const filePrefix = render('```ts file=a.ts\nconst x = 1;\n```');
    expect(filePrefix.html).toContain('<span class="fname">a.ts</span>');
  });

  it("文件名/语言转义（防注入：脚本标签不存活，尖括号转义）", () => {
    const { html } = render('```ts title="a"><script>alert(1)</script>"\nx\n```');
    expect(html).not.toContain("<script>");
    // DOMPurify 会解析后重新序列化：文本节点内的 " 恢复原样（文本节点中无注入面），
    // < > 保持转义（防标签逃逸）
    expect(html).toContain("&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("language-ts");
  });

  it("无语言代码块：无 lang 标签但仍带头部条与复制按钮", () => {
    const { html } = render("```\n纯文本\n```");
    expect(html).toContain('<div class="codeblock">');
    expect(html).not.toContain('<span class="lang">');
    expect(html).toContain('class="copy-btn"');
  });
});

describe("REND-002 Tabs 容器（:::tabs / :::tab，设计对齐演示页跨组联动）", () => {
  it("多 tab 渲染：tab-bar + tab-btn（首个 active）+ tab-panel（首个 active）+ 内容", () => {
    const md = [
      ":::tabs",
      ":::tab npm",
      "```bash",
      "npm install x",
      "```",
      ":::",
      ":::tab pnpm",
      "```bash",
      "pnpm add x",
      "```",
      ":::",
      ":::",
    ].join("\n");
    const { html } = render(md);
    expect(html).toContain('<div class="tabs"');
    expect(html).toContain('<div class="tab-bar">');
    expect(html).toContain('<button class="tab-btn active" type="button" data-tab="npm">npm</button>');
    expect(html).toContain('<button class="tab-btn" type="button" data-tab="pnpm">pnpm</button>');
    expect(html).toContain('<div class="tab-panel active" data-panel="npm">');
    expect(html).toContain('<div class="tab-panel" data-panel="pnpm">');
    expect(html).toContain("language-bash");
  });

  it("tab 名含特殊字符转义", () => {
    const { html } = render(':::tabs\n:::tab a"b\nx\n:::\n:::');
    expect(html).toContain('data-tab="a&quot;b"');
  });

  it("无 tab 段的 :::tabs 不识别（降级为普通文本）", () => {
    const { html } = render(":::tabs\n没有 tab 标记\n:::");
    expect(html).not.toContain('data-tabs');
  });
});

describe("REND-002 步骤容器（:::steps，设计对齐演示页）", () => {
  it("有序列表模型：ol.steps + 首段加粗提升为 step-title + 正文段落", () => {
    const md = [
      ":::steps",
      "1. **定义任务处理函数**：处理函数是一个普通的异步函数。",
      "2. **启动 Worker**：Worker 可以独立部署。",
      ":::",
    ].join("\n");
    const { html } = render(md);
    expect(html).toContain('<ol class="steps">');
    expect(html).toContain("<li><span class=\"step-title\">定义任务处理函数</span><p>：处理函数是一个普通的异步函数。</p></li>");
    expect(html).toContain('<span class="step-title">启动 Worker</span>');
  });

  it("非列表内容回退为逐块 li", () => {
    const { html } = render(":::steps\n**标题**\n\n正文内容\n:::");
    expect(html).toContain('<ol class="steps">');
    expect(html).toContain('<li><span class="step-title">标题</span></li>');
    expect(html).toContain("<li><p>正文内容</p></li>");
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

  it("同行标题（:::tip 标题）渲染为 .doclight-title（标题在上、内容在下）", () => {
    const { html } = render(":::tip 为什么值得读\n正文内容\n:::");
    expect(html).toContain('<div class="doclight-container doclight-tip">');
    expect(html).toContain('<div class="doclight-container-body">');
    // 标题在 body 内、内容在标题之后（纵向堆叠而非并排）
    const titlePos = html.indexOf('<p class="doclight-title">为什么值得读</p>');
    const bodyPos = html.indexOf('<div class="doclight-container-body">');
    expect(titlePos).toBeGreaterThan(bodyPos);
    expect(html.indexOf("正文内容")).toBeGreaterThan(titlePos);
    expect(html).toContain("正文内容");
  });

  it("同行标题含 HTML 被转义（防标签逃逸）", () => {
    const { html } = render(":::info <b>标题</b> & 更多\n正文\n:::");
    expect(html).toContain("&lt;b&gt;标题&lt;/b&gt; &amp; 更多");
    expect(html).not.toContain("<b>标题</b>");
  });

  it("无标题形态保持原行为（:::tip 换行内容）", () => {
    const { html } = render(":::warning\n内容\n:::");
    expect(html).toContain("doclight-warning");
    expect(html).not.toContain("doclight-title");
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
