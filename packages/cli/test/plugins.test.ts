/**
 * 构建管线插件测试（PLUG-006，07 §7.3 Node 端）
 *
 * 覆盖：beforeRender 正向链 / afterRender 反向链 / extendMarked / addSearchFields / slotContent
 * 纯函数测试，无文件系统依赖。
 */
import { describe, expect, it } from "vitest";
import { BuildPluginPipeline } from "../src/plugins.ts";
import { render } from "@doclight/renderer";
import type { PluginDef, RenderContext } from "../../core/src/plugin.ts";

const ctx: RenderContext = { path: "guide/test.md", title: "Test", frontmatter: {}, headings: [], isFirstRender: true };

describe("BuildPluginPipeline（PLUG-006 构建时钩子）", () => {
  it("无插件时透传", () => {
    const pipeline = new BuildPluginPipeline([]);
    expect(pipeline.runBeforeRender("# Hello", ctx)).toBe("# Hello");
    expect(pipeline.runAfterRender("<h1>Hello</h1>", ctx)).toBe("<h1>Hello</h1>");
    expect(pipeline.collectSearchFields({ path: "a.md", title: "A", text: "", headings: [], frontmatter: {} })).toEqual({});
    expect(pipeline.collectSlotContent(ctx)).toEqual({});
    expect(pipeline.size).toBe(0);
  });

  it("beforeRender 正向链（A → B）", () => {
    const pluginA: PluginDef = {
      name: "A",
      beforeRender: (md) => md.replace("TODO", "[A-done]"),
    };
    const pluginB: PluginDef = {
      name: "B",
      beforeRender: (md) => md.replace("FIX", "[B-done]"),
    };
    const pipeline = new BuildPluginPipeline([pluginA, pluginB]);
    const result = pipeline.runBeforeRender("TODO and FIX", ctx);
    expect(result).toBe("[A-done] and [B-done]");
  });

  it("afterRender 反向链（B → A）", () => {
    const pluginA: PluginDef = {
      name: "A",
      afterRender: (html) => html + "<!--A-->",
    };
    const pluginB: PluginDef = {
      name: "B",
      afterRender: (html) => html + "<!--B-->",
    };
    const pipeline = new BuildPluginPipeline([pluginA, pluginB]);
    const result = pipeline.runAfterRender("<p>Hi</p>", ctx);
    // 反向：B 先执行，然后 A
    expect(result).toBe("<p>Hi</p><!--B--><!--A-->");
  });

  it("单插件异常不中断管线", () => {
    const bad: PluginDef = {
      name: "bad",
      beforeRender: () => {
        throw new Error("boom");
      },
    };
    const good: PluginDef = {
      name: "good",
      beforeRender: (md) => md + "-ok",
    };
    const pipeline = new BuildPluginPipeline([bad, good]);
    expect(pipeline.runBeforeRender("input", ctx)).toBe("input-ok");
  });

  it("addSearchFields 合并多插件字段", () => {
    const p1: PluginDef = {
      name: "tags",
      addSearchFields: (doc) => ({ tags: (doc.frontmatter.tags as string[])?.join(",") ?? "" }),
    };
    const p2: PluginDef = {
      name: "category",
      addSearchFields: (doc) => ({ category: (doc.frontmatter.category as string) ?? "" }),
    };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    const result = pipeline.collectSearchFields({
      path: "a.md",
      title: "A",
      text: "hello",
      headings: [],
      frontmatter: { tags: ["ts", "md"], category: "guide" },
    });
    expect(result).toEqual({ tags: "ts,md", category: "guide" });
  });

  it("slotContent 合并多插件插槽（含函数）", () => {
    const p1: PluginDef = {
      name: "comments",
      slotContent: { "content:after": '<div id="giscus"></div>' },
    };
    const p2: PluginDef = {
      name: "analytics",
      slotContent: { "head:end": (c) => `<meta data-path="${c.path}">` },
    };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    const result = pipeline.collectSlotContent(ctx);
    expect(result["content:after"]).toBe('<div id="giscus"></div>');
    expect(result["head:end"]).toBe('<meta data-path="guide/test.md">');
  });

  it("size 返回注册插件数", () => {
    const pipeline = new BuildPluginPipeline([{ name: "a" }, { name: "b" }, { name: "c" }]);
    expect(pipeline.size).toBe(3);
  });
});

describe("collectMarkedExtensions（PLUG-006 接线修复：extendMarked → 渲染内核）", () => {
  const fakeExt = { name: "fakeExt", level: "block", tokenizer() {}, renderer() {} };

  it("use({extensions:[...]}) 同 marked.use 形状收集", () => {
    const plugin: PluginDef = {
      name: "chart",
      extendMarked(marked) {
        marked.use({ extensions: [fakeExt] });
      },
    };
    const pipeline = new BuildPluginPipeline([plugin]);
    expect(pipeline.collectMarkedExtensions()).toEqual([[fakeExt]]);
  });

  it("use(单个扩展) 与 use(扩展数组) 均收集", () => {
    const plugin: PluginDef = {
      name: "chart",
      extendMarked(marked) {
        marked.use(fakeExt);
        marked.use([fakeExt, fakeExt]);
      },
    };
    const pipeline = new BuildPluginPipeline([plugin]);
    expect(pipeline.collectMarkedExtensions()).toEqual([[fakeExt, fakeExt, fakeExt]]);
  });

  it("钩子直接 return 扩展数组同样收集", () => {
    const plugin: PluginDef = {
      name: "chart",
      extendMarked() {
        return [fakeExt];
      },
    };
    const pipeline = new BuildPluginPipeline([plugin]);
    expect(pipeline.collectMarkedExtensions()).toEqual([[fakeExt]]);
  });

  it("多插件各贡献一个扩展数组（保持插件边界）", () => {
    const p1: PluginDef = { name: "a", extendMarked: (m) => { m.use(fakeExt); } };
    const p2: PluginDef = { name: "b", extendMarked: () => [fakeExt] };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    expect(pipeline.collectMarkedExtensions()).toEqual([[fakeExt], [fakeExt]]);
  });

  it("异常插件不中断收集，无扩展插件不产出空数组", () => {
    const bad: PluginDef = {
      name: "bad",
      extendMarked() {
        throw new Error("boom");
      },
    };
    const empty: PluginDef = { name: "empty", extendMarked: () => undefined };
    const good: PluginDef = { name: "good", extendMarked: (m) => { m.use(fakeExt); } };
    const pipeline = new BuildPluginPipeline([bad, empty, good]);
    expect(pipeline.collectMarkedExtensions()).toEqual([[fakeExt]]);
  });

  it("端到端：插件自定义语法经 render() 全管线渲染（extendMarked → marked → sanitize）", () => {
    // 自定义 ```chart 围栏 → class 标记 + JSON 源码子元素（沿用内容承载铁律：class + 子元素，不依赖 data-*）
    const chartExt = {
      name: "doclightChart",
      level: "block" as const,
      start(src: string) {
        return src.indexOf("```chart");
      },
      tokenizer(src: string) {
        const match = /^```chart\n([\s\S]*?)\n?```/.exec(src);
        if (!match) return undefined;
        return { type: "doclightChart", raw: match[0], spec: match[1] };
      },
      renderer(token: { spec: string }) {
        return `<div class="doclight-chart">${token.spec}</div>`;
      },
    };
    const plugin: PluginDef = {
      name: "chart",
      extendMarked: (m) => {
        m.use({ extensions: [chartExt] });
      },
    };
    const pipeline = new BuildPluginPipeline([plugin]);
    const md = "# 首页\n\n```chart\n{\"type\":\"bar\"}\n```\n";
    const transformed = pipeline.runBeforeRender(md, ctx);
    const { html } = render(transformed, {
      currentPath: "index.md",
      extraMarkedExtensions: pipeline.collectMarkedExtensions(),
    });
    expect(html).toContain('class="doclight-chart"');
    expect(html).toContain('{"type":"bar"}');
    expect(html).not.toContain("<script>"); // sanitize 全管线生效
  });
});

describe("runOnBuild（PLUG-010 构建期文件产出钩子）", () => {
  const buildCtx = {
    outDir: "/tmp/out",
    siteTitle: "Test Site",
    base: "",
    docs: [{ path: "index.html", title: "首页" }],
  };

  it("合并各插件产出文件", () => {
    const p1: PluginDef = { name: "rss", onBuild: () => [{ path: "rss.xml", content: "<rss/>" }] };
    const p2: PluginDef = { name: "pwa", onBuild: () => [{ path: "manifest.json", content: "{}" }] };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    expect(pipeline.runOnBuild(buildCtx)).toEqual([
      { path: "rss.xml", content: "<rss/>" },
      { path: "manifest.json", content: "{}" },
    ]);
  });

  it("单插件异常不中断其余", () => {
    const bad: PluginDef = {
      name: "bad",
      onBuild: () => {
        throw new Error("boom");
      },
    };
    const good: PluginDef = { name: "good", onBuild: () => [{ path: "ok.txt", content: "ok" }] };
    const pipeline = new BuildPluginPipeline([bad, good]);
    expect(pipeline.runOnBuild(buildCtx)).toEqual([{ path: "ok.txt", content: "ok" }]);
  });

  it("非法产出项过滤（非对象 / 缺字段 / null / 非数组返回）", () => {
    const plugin: PluginDef = {
      name: "dirty",
      onBuild: () => [{ path: 123 }, null, { path: "ok.txt", content: "x" }, { content: "no-path" }] as never,
    };
    const pipeline = new BuildPluginPipeline([plugin]);
    expect(pipeline.runOnBuild(buildCtx)).toEqual([{ path: "ok.txt", content: "x" }]);
  });

  it("无 onBuild 钩子返回空数组", () => {
    const pipeline = new BuildPluginPipeline([{ name: "plain" }]);
    expect(pipeline.runOnBuild(buildCtx)).toEqual([]);
  });
});

describe("setPlugins（PLUG-011 热重载整体替换）", () => {
  it("替换后旧插件不再参与任何钩子（完整清理无残留）", () => {
    const pluginA: PluginDef = { name: "A", beforeRender: (md) => md + "[A]" };
    const pluginB: PluginDef = { name: "B", beforeRender: (md) => md + "[B]" };
    const pipeline = new BuildPluginPipeline([pluginA]);
    expect(pipeline.runBeforeRender("x", ctx)).toBe("x[A]");

    pipeline.setPlugins([pluginB]);
    expect(pipeline.runBeforeRender("x", ctx)).toBe("x[B]");
    expect(pipeline.runBeforeRender("x", ctx)).not.toContain("[A]");
    expect(pipeline.size).toBe(1);
    expect(pipeline.collectMarkedExtensions()).toEqual([]);
    expect(pipeline.runOnBuild({ outDir: "/tmp", siteTitle: "t", base: "", docs: [] })).toEqual([]);
  });

  it("替换为空数组 = 全部插件卸载", () => {
    const pluginA: PluginDef = { name: "A", afterRender: (html) => html + "<!--A-->" };
    const pipeline = new BuildPluginPipeline([pluginA]);
    pipeline.setPlugins([]);
    expect(pipeline.size).toBe(0);
    expect(pipeline.runAfterRender("<p>x</p>", ctx)).toBe("<p>x</p>");
  });
});

describe("collectVendorFiles / collectPluginStyles（PLUG-012 按需 vendor + 插件 CSS）", () => {
  it("合并各插件 vendor 声明为 file → {pkg, rel} 映射（按文件名去重，首个命中胜出）", () => {
    const p1: PluginDef = {
      name: "mermaid",
      vendor: [{ file: "mermaid.min.js", pkg: "mermaid", rel: "dist/mermaid.min.js" }],
    };
    const p2: PluginDef = {
      name: "dup",
      vendor: [{ file: "mermaid.min.js", pkg: "other", rel: "x.js" }, { file: "chart.min.js", pkg: "chart", rel: "dist/chart.min.js" }],
    };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    expect(pipeline.collectVendorFiles()).toEqual({
      "mermaid.min.js": { file: "mermaid.min.js", pkg: "mermaid", rel: "dist/mermaid.min.js" },
      "chart.min.js": { file: "chart.min.js", pkg: "chart", rel: "dist/chart.min.js" },
    });
  });

  it("非法 vendor 项过滤（缺字段 / 非字符串 / 重复名）", () => {
    const dirty: PluginDef = {
      name: "dirty",
      vendor: [
        { file: "ok.js", pkg: "p", rel: "ok.js" },
        { file: 123, pkg: "p", rel: "x" },
        { file: "no-pkg.js", rel: "x" },
      ] as never,
    };
    const pipeline = new BuildPluginPipeline([dirty]);
    expect(pipeline.collectVendorFiles()).toEqual({ "ok.js": { file: "ok.js", pkg: "p", rel: "ok.js" } });
  });

  it("无 vendor 声明返回空表", () => {
    const pipeline = new BuildPluginPipeline([{ name: "plain" }]);
    expect(pipeline.collectVendorFiles()).toEqual({});
  });

  it("collectPluginStyles 按注册顺序拼接各插件 styles", () => {
    const p1: PluginDef = { name: "a", styles: ".a { color: red; }" };
    const p2: PluginDef = { name: "b", styles: ".b { color: blue; }" };
    const pipeline = new BuildPluginPipeline([p1, p2]);
    expect(pipeline.collectPluginStyles()).toBe(".a { color: red; }\n.b { color: blue; }");
    // 空/缺省 styles 跳过
    const plain = new BuildPluginPipeline([{ name: "x" }, { name: "y", styles: "  " }]);
    expect(plain.collectPluginStyles()).toBe("");
  });
});
