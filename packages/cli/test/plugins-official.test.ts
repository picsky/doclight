/**
 * 官方插件测试（PLUG-007，07 §7.6）
 *
 * 逐插件验证：插槽内容形态 / 配置校验 / onBuild 产物（rss / pwa）/ 降级行为。
 */
import { describe, expect, it } from "vitest";
import { createAiChatPlugin } from "../src/plugins-official/ai-chat.ts";
import { createGiscusPlugin } from "../src/plugins-official/giscus.ts";
import { OFFICIAL_PLUGIN_NAMES, OFFICIAL_PLUGINS } from "../src/plugins-official/index.ts";
import { createMermaidPlugin, mermaidExtension, mermaidStyles } from "../src/plugins-official/mermaid.ts";
import { createPlausiblePlugin } from "../src/plugins-official/plausible.ts";
import { createPwaPlugin } from "../src/plugins-official/pwa.ts";
import { createRssPlugin } from "../src/plugins-official/rss.ts";
import { loadPluginsSync } from "../src/plugin-loader.ts";
import { render } from "@doclight/renderer";

describe("官方插件注册表（PLUG-007/012）", () => {
  it("含 6 个官方插件且短名/包名均可解析", () => {
    expect(OFFICIAL_PLUGIN_NAMES).toEqual(["giscus", "plausible", "rss", "pwa", "ai-chat", "mermaid"]);
    for (const name of OFFICIAL_PLUGIN_NAMES) {
      expect(OFFICIAL_PLUGINS[name]).toBeTypeOf("function");
      expect(OFFICIAL_PLUGINS[`@doclight/plugin-${name}`]).toBe(OFFICIAL_PLUGINS[name]);
    }
  });
});

describe("@doclight/plugin-giscus", () => {
  it("缺 repo 返回 null（禁用）", () => {
    expect(createGiscusPlugin({})).toBeNull();
    expect(createGiscusPlugin({ repo: "no-slash" })).toBeNull();
  });

  it("插槽注入评论容器 + 客户端脚本", () => {
    const plugin = createGiscusPlugin({ repo: "owner/repo" })!;
    const slot = plugin.slotContent!["content:after"] as string;
    expect(slot).toContain('class="doclight-giscus"');
    expect(slot).toContain("https://giscus.app/client.js");
    expect(slot).toContain('data-repo="owner/repo"');
    expect(slot).toContain('data-theme="preferred_color_scheme"');
  });

  it("配置值转义（防属性注入破坏）", () => {
    const plugin = createGiscusPlugin({ repo: 'owner/repo" onload="alert(1)' })!;
    const slot = plugin.slotContent!["content:after"] as string;
    expect(slot).not.toContain('onload="alert(1)');
    expect(slot).toContain("&quot;");
  });
});

describe("@doclight/plugin-plausible", () => {
  it("缺 domain 返回 null（禁用）", () => {
    expect(createPlausiblePlugin({})).toBeNull();
  });

  it("插槽注入统计脚本（默认 plausible.io）", () => {
    const plugin = createPlausiblePlugin({ domain: "docs.example.com" })!;
    const slot = plugin.slotContent!["head:end"] as string;
    expect(slot).toContain('data-domain="docs.example.com"');
    expect(slot).toContain("https://plausible.io/js/script.js");
    expect(slot).toContain("defer");
  });

  it("支持自托管实例地址", () => {
    const plugin = createPlausiblePlugin({ domain: "docs.example.com", src: "https://stats.example.com/js/script.js" })!;
    expect(plugin.slotContent!["head:end"]).toContain("stats.example.com");
  });
});

describe("@doclight/plugin-rss（PLUG-010 onBuild）", () => {
  const buildCtx = {
    outDir: "/tmp/out",
    siteTitle: "My Docs",
    base: "",
    siteUrl: "https://docs.example.com",
    docs: [
      { path: "guide/a.html", title: "A 篇", summary: "摘要 & <标签>", updatedAt: "2026-08-13T00:00:00Z", wordCount: 100 },
      { path: "index.html", title: "首页", updatedAt: "2026-08-01T00:00:00Z" },
    ],
  };

  it("siteUrl 缺失时降级跳过（不产出文件）", () => {
    const plugin = createRssPlugin();
    const files = plugin.onBuild!({ ...buildCtx, siteUrl: undefined })!;
    expect(files).toEqual([]);
  });

  it("产出 RSS 2.0（标题/链接/guid/pubDate/XML 转义）", () => {
    const plugin = createRssPlugin();
    const files = plugin.onBuild!(buildCtx)!;
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("rss.xml");
    const xml = files[0]!.content;
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("<title>My Docs</title>");
    expect(xml).toContain("<title>A 篇</title>");
    expect(xml).toContain("<link>https://docs.example.com/guide/a.html</link>");
    expect(xml).toContain("<guid isPermaLink=\"true\">https://docs.example.com/guide/a.html</guid>");
    expect(xml).toContain("<pubDate>Thu, 13 Aug 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("摘要 &amp; &lt;标签&gt;"); // XML 转义
  });

  it("limit 配置生效且 base 前缀正确", () => {
    const plugin = createRssPlugin({ limit: 1, filename: "feed.xml" });
    const files = plugin.onBuild!({ ...buildCtx, base: "/docs" })!;
    expect(files[0]!.path).toBe("feed.xml");
    expect(files[0]!.content).toContain("<link>https://docs.example.com/docs/guide/a.html</link>");
    const items = files[0]!.content.match(/<item>/g) ?? [];
    expect(items).toHaveLength(1);
  });
});

describe("@doclight/plugin-pwa（PLUG-010 onBuild）", () => {
  it("onBuild 产出 manifest.json + sw.js", () => {
    const plugin = createPwaPlugin();
    const files = plugin.onBuild!({ outDir: "/tmp/out", siteTitle: "Docs", base: "/docs", docs: [] })!;
    expect(files.map((f) => f.path)).toEqual(["manifest.json", "sw.js"]);
    const manifest = JSON.parse(files[0]!.content);
    expect(manifest.name).toBe("Docs");
    expect(manifest.start_url).toBe("/docs/");
    expect(files[1]!.content).toContain("self.addEventListener('install'");
  });

  it("插槽函数注入 manifest 链接 + SW 注册脚本（base 感知）", () => {
    const plugin = createPwaPlugin({ name: "自定义", color: "#123456" });
    const fn = plugin.slotContent!["head:end"] as (ctx: { base?: string }) => string;
    const withBase = fn({ base: "/docs" });
    expect(withBase).toContain('<link rel="manifest" href="/docs/manifest.json">');
    expect(withBase).toContain('navigator.serviceWorker.register("/docs/sw.js")');
    const noBase = fn({});
    expect(noBase).toContain('<link rel="manifest" href="/manifest.json">');
  });
});

describe("@doclight/plugin-ai-chat", () => {
  it("缺 endpoint 返回 null（禁用）", () => {
    expect(createAiChatPlugin({})).toBeNull();
  });

  it("插槽注入问答面板 + 内联脚本（端点 JSON 注入）", () => {
    const plugin = createAiChatPlugin({ endpoint: "https://proxy.example.com/ask" })!;
    const slot = plugin.slotContent!["content:after"] as string;
    expect(slot).toContain('class="doclight-ai-chat"');
    expect(slot).toContain('class="doclight-ai-chat-form"');
    expect(slot).toContain('"https://proxy.example.com/ask"');
    expect(slot).toContain("textContent"); // 纯文本注入（LLM 输出不进 innerHTML）
  });
});

describe("@doclight/plugin-mermaid（PLUG-012 从内置迁移为官方插件）", () => {
  it("无必填配置：空配置即启用（工厂不返回 null）", () => {
    const plugin = createMermaidPlugin();
    expect(plugin).not.toBeNull();
    expect(createMermaidPlugin({})).not.toBeNull();
  });

  it("extendMarked：mermaid 围栏 → .doclight-mermaid fallback（源码转义保留，sanitize 后不白屏）", () => {
    const plugin = createMermaidPlugin()!;
    const extender = { use: () => {} };
    const { html } = render("```mermaid\ngraph TD\n  A-->B\n```", {
      extraMarkedExtensions: [plugin.extendMarked!(extender) as unknown[]],
    });
    expect(html).toContain('<div class="doclight-mermaid">');
    expect(html).toContain('<pre class="doclight-mermaid-src"><code>');
    expect(html).toContain("A--&gt;B");
    // XSS：源码注入脚本被转义清除
    const evil = render("```mermaid\n<script>alert(1)</script>\n```", {
      extraMarkedExtensions: [plugin.extendMarked!(extender) as unknown[]],
    });
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });

  it("mermaidExtension 是独立 marked 扩展（tokenizer/renderer 可单独断言）", () => {
    expect(mermaidExtension.name).toBe("doclightMermaid");
    expect(mermaidExtension.level).toBe("block");
    // tokenizer：匹配 ```mermaid 围栏，返回 { type, raw, text }
    const token = mermaidExtension.tokenizer!.call({ lexer: { blockTokens: (s: string) => [s] } } as never, "```mermaid\nflowchart LR\n  a-->b\n```\n");
    expect(token).toMatchObject({ type: "doclightMermaid", text: "flowchart LR\n  a-->b" });
    // 非 mermaid 围栏不匹配（交给内置 tokenizer）
    expect(mermaidExtension.tokenizer!("```js\nx\n```\n")).toBeUndefined();
  });

  it("vendor 声明：mermaid.min.js（按需服务/拷贝/内联）", () => {
    const plugin = createMermaidPlugin()!;
    expect(plugin.vendor).toEqual([{ file: "mermaid.min.js", pkg: "mermaid", rel: "dist/mermaid.min.js" }]);
  });

  it("styles：mermaid 渲染样式（.doclight-mermaid 等，注入页面）", () => {
    const plugin = createMermaidPlugin()!;
    expect(plugin.styles).toBe(mermaidStyles);
    expect(mermaidStyles).toContain(".doclight-mermaid");
    expect(mermaidStyles).toContain(".doclight-mermaid-error");
  });

  it("运行时脚本：content:after 注入懒加载 + 容错渲染 + doclight.use 注册（init/onMount）", () => {
    const plugin = createMermaidPlugin()!;
    const slot = plugin.slotContent!["content:after"] as string;
    expect(slot).toContain("mermaid.min.js");
    expect(slot).toContain("window.doclight.use");
    expect(slot).toContain("doclight-mermaid-error");
    expect(slot).toContain("securityLevel");
    expect(slot).toContain("onMount");
  });

  it("运行时脚本（2026-08 修复）：错误不残留 body——suppressErrorRendering 自清 + catch 兜底清理", () => {
    const plugin = createMermaidPlugin()!;
    const slot = plugin.slotContent!["content:after"] as string;
    // suppressErrorRendering：失败时 mermaid 自清临时元素、不画错误大图
    expect(slot).toContain("suppressErrorRendering: true");
    // 不传隐藏容器（display:none 容器无尺寸 → mermaid rect width negative 渲染失败）
    expect(slot).not.toContain("tmp.style.display = 'none'");
    // catch 兜底清理 body 末尾 #d{id}（版本差异防残留）
    expect(slot).toContain("var residual = document.getElementById('d' + id);");
    expect(slot).toContain("if (residual && residual.parentNode) residual.parentNode.removeChild(residual);");
  });

  it("运行时脚本（2026-08 修复）：主题跟随——监听 doclight:themechange 重渲已渲染图表", () => {
    const plugin = createMermaidPlugin()!;
    const slot = plugin.slotContent!["content:after"] as string;
    expect(slot).toContain("document.addEventListener('doclight:themechange', rerenderForTheme);");
    expect(slot).toContain("registry.push({ node: node, src: src });");
    // 主题重渲失败也能恢复源码 fallback（内容承载铁律）
    expect(slot).toContain("pre.className = 'doclight-mermaid-src';");
  });

  it("加载器全链路：doclight.json plugins: [\"mermaid\"] → PluginDef（skipped 空）", () => {
    const result = loadPluginsSync([{ name: "mermaid" }], process.cwd());
    expect(result.skipped).toEqual([]);
    expect(result.plugins.map((p) => p.name)).toEqual(["mermaid"]);
  });
});
