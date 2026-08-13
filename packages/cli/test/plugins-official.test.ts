/**
 * 官方插件测试（PLUG-007，07 §7.6）
 *
 * 逐插件验证：插槽内容形态 / 配置校验 / onBuild 产物（rss / pwa）/ 降级行为。
 */
import { describe, expect, it } from "vitest";
import { createAiChatPlugin } from "../src/plugins-official/ai-chat.ts";
import { createGiscusPlugin } from "../src/plugins-official/giscus.ts";
import { OFFICIAL_PLUGIN_NAMES, OFFICIAL_PLUGINS } from "../src/plugins-official/index.ts";
import { createPlausiblePlugin } from "../src/plugins-official/plausible.ts";
import { createPwaPlugin } from "../src/plugins-official/pwa.ts";
import { createRssPlugin } from "../src/plugins-official/rss.ts";

describe("官方插件注册表（PLUG-007）", () => {
  it("含 5 个官方插件且短名/包名均可解析", () => {
    expect(OFFICIAL_PLUGIN_NAMES).toEqual(["giscus", "plausible", "rss", "pwa", "ai-chat"]);
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
