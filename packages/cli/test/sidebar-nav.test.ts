/**
 * 侧边栏对齐测试（2026-08，用户反馈「目录层级关系不够好」→ 对齐演示页 design-new）：
 * - 结构（renderNav）：分组内顶层文件平铺为直接 side-item；嵌套分组 = 入口条目平铺于
 *   当前层级（与兄弟文件同级）+ side-sub 竖线容器包裹子文档（递归，v3 演示页模型）；
 *   组标题置顶（side-title 在条目之前）；组 index 内联为标题下首条。
 * - 视觉（DEFAULT_THEME_CSS）：active 无背景（仅绿字+竖条）、side-title 无 chevron、
 *   padding/margin/radius 与演示页一致、side-sub 带 border-left 竖线。
 * 默认主题 CSS 为唯一事实来源（直读断言，与 dp004 同策略）。
 */
import { describe, expect, it } from "vitest";
import type { NavNode } from "@doclight/renderer";
import { DEFAULT_THEME_CSS, planSyntheticIndexPages, renderNav, syntheticIndexMarkdown, syntheticIndexTitle } from "../src/site.ts";

describe("renderNav 层级模型（对齐演示页：平铺 + 仅嵌套缩进）", () => {
  const nav: NavNode[] = [
    { type: "file", path: "README.md", title: "首页" },
    {
      type: "group",
      title: "syntax",
      path: "syntax/",
      items: [
        { type: "file", path: "syntax/basic.md", title: "基础" },
        { type: "file", path: "syntax/code.md", title: "代码" },
        {
          type: "group",
          title: "advanced",
          path: "syntax/advanced/",
          index: "syntax/advanced/index.md",
          items: [
            { type: "file", path: "syntax/advanced/index.md", title: "advanced" },
            { type: "file", path: "syntax/advanced/a.md", title: "A" },
          ],
        },
      ],
    },
  ];

  it("顶层文件平铺为直接 side-item（无 side-sub 包裹）", () => {
    const html = renderNav(nav);
    expect(html).toMatch(/<li><a class="side-item"[^>]*data-path="README\.md">首页<\/a><\/li>/);
    // 顶层 file 不在 side-sub 内
    expect(html).not.toMatch(/<div class="side-sub">\s*<a class="side-item"[^>]*data-path="README\.md"/);
  });

  it("分组内顶层文件平铺：side-title 后直接 side-item，不包 side-sub（G1 修复）", () => {
    const html = renderNav(nav);
    // side-title "syntax" 之后直接是 basic/code 的 side-item（中间无 side-sub）
    const group = html.slice(html.indexOf('<div class="side-group">'));
    expect(group).toMatch(/<div class="side-title">syntax<\/div><a class="side-item"[^>]*data-path="syntax\/basic\.md"/);
    expect(group).not.toMatch(/<div class="side-title">syntax<\/div><div class="side-sub">/);
  });

  it("嵌套分组：入口条目平铺于当前层级（与兄弟文件同级），子文档进 side-sub 竖线容器（2026-08 v3 演示页模型）", () => {
    const html = renderNav(nav);
    // 入口条目（目录名 advanced）在 side-sub **之外**，紧邻上一平铺条目 code 之后 → 与兄弟同级
    expect(html).toMatch(
      /data-path="syntax\/code\.md"[^>]*>代码<\/a><a class="side-item"[^>]*data-path="syntax\/advanced\/index\.md">advanced<\/a><div class="side-sub">/
    );
    // side-sub 内仅子文档平铺（index 已由入口条目渲染，不重复）
    expect(html).toMatch(/<div class="side-sub"><a class="side-item"[^>]*data-path="syntax\/advanced\/a\.md">A<\/a><\/div>/);
    expect(html.match(/data-path="syntax\/advanced\/index\.md"/g)).toHaveLength(1);
    // 嵌套组无子分区标题标签（入口条目即第一项）
    expect(html).not.toMatch(/<div class="side-sub"><div class="side-title">/);
    // 嵌套组出现在平铺条目之后（层级不丢失）
    const advancedIdx = html.indexOf('data-path="syntax/advanced/a.md"');
    const codeIdx = html.indexOf('data-path="syntax/code.md"');
    expect(advancedIdx).toBeGreaterThan(codeIdx);
  });

  it("组 index 入口：文本统一用组标题（目录名），index 文件不重复", () => {
    const withIndex: NavNode[] = [
      {
        type: "group",
        title: "guide",
        path: "guide/",
        index: "guide/README.md",
        items: [{ type: "file", path: "guide/a.md", title: "A" }],
      },
    ];
    const html = renderNav(withIndex);
    // side-title 在最前，入口条目紧随其后；文本 = 组标题（目录名，用户决策 v2）
    expect(html).toMatch(/<div class="side-title">guide<\/div><a class="side-item"[^>]*data-path="guide\/README\.md">guide<\/a>/);
    // index 文件不重复（indexEntry 渲染后 groupBody 跳过）
    expect(html.match(/data-path="guide\/README\.md"/g)).toHaveLength(1);
    // 嵌套子分区入口同样用目录名（测试），无子分区标题标签
    const nested: NavNode[] = [
      {
        type: "group",
        title: "语法",
        path: "语法/",
        items: [
          {
            type: "group",
            title: "测试",
            path: "语法/测试/",
            index: "语法/测试/index.md",
            items: [{ type: "file", path: "语法/测试/index.md", title: "测试" }],
          },
        ],
      },
    ];
    const nestedHtml = renderNav(nested);
    // 嵌套子分区入口（测试）平铺于当前层级：side-sub **之外**、紧随其前，文本统一目录名
    expect(nestedHtml).toMatch(/<a class="side-item"[^>]*data-path="语法\/测试\/index\.md">测试<\/a><div class="side-sub">/);
    // 入口条目不得再被包进 side-sub（v2 缺陷：与子文档同缩进难辨层级）
    expect(nestedHtml).not.toMatch(/<div class="side-sub"><a class="side-item"[^>]*data-path="语法\/测试\/index\.md">测试<\/a>/);
  });
});

describe("嵌套目录合成总览页（2026-08 v2：无 README 绑定 → 虚拟 index.md + 卡片列表）", () => {
  // 原始树（嵌套组尚无 index）——planSyntheticIndexPages 的输入
  const rawNav: NavNode[] = [
    { type: "file", path: "README.md", title: "首页" },
    {
      type: "group",
      title: "语法",
      path: "语法/",
      items: [
        { type: "file", path: "语法/basic.md", title: "基础" },
        {
          type: "group",
          title: "测试",
          path: "语法/测试/",
          items: [
            { type: "file", path: "语法/测试/00-a.md", title: "产品工程全景" },
            { type: "file", path: "语法/测试/01-b.md", title: "业务知识层" },
          ],
        },
      ],
    },
  ];
  // 注入虚拟 index 后的树——syntheticIndexMarkdown 的输入（组 index 指向虚拟文件）
  const injectedNav: NavNode[] = [
    { type: "file", path: "README.md", title: "首页" },
    {
      type: "group",
      title: "语法",
      path: "语法/",
      items: [
        { type: "file", path: "语法/basic.md", title: "基础" },
        {
          type: "group",
          title: "测试",
          path: "语法/测试/",
          index: "语法/测试/index.md",
          items: [
            { type: "file", path: "语法/测试/index.md", title: "测试" },
            { type: "file", path: "语法/测试/00-a.md", title: "产品工程全景" },
            { type: "file", path: "语法/测试/01-b.md", title: "业务知识层" },
          ],
        },
      ],
    },
  ];

  it("planSyntheticIndexPages：仅嵌套缺 index 组合成虚拟 index；顶层组/有 index 组不生成", () => {
    expect(planSyntheticIndexPages(rawNav)).toEqual(["语法/测试/index.md"]);
    // 有 index 的组不合成（用户绑定场景）
    const withIndex: NavNode[] = [{ type: "group", title: "g", path: "g/", index: "g/README.md", items: [] }];
    expect(planSyntheticIndexPages(withIndex)).toEqual([]);
    // 无直接文档的嵌套组不合成（空目录）
    const empty: NavNode[] = [{ type: "group", title: "a", path: "a/", items: [{ type: "group", title: "b", path: "a/b/", items: [] }] }];
    expect(planSyntheticIndexPages(empty)).toEqual([]);
  });

  it("syntheticIndexTitle：虚拟路径 → 父目录名", () => {
    expect(syntheticIndexTitle("语法/测试/index.md")).toBe("测试");
  });

  it("syntheticIndexMarkdown：标题=目录名，卡片含标题+摘要，SSG 链接转 .html / dev 保持 .md", () => {
    const md = syntheticIndexMarkdown(injectedNav, "语法/测试/index.md", { "语法/测试/00-a.md": "全景摘要" }, ".html");
    expect(md).toContain("title: 测试");
    expect(md).toContain("dir-grid");
    expect(md).toContain('href="./00-a.html"'); // SSG 后缀
    expect(md).toContain("产品工程全景");
    expect(md).toContain("全景摘要");
    expect((md.match(/dir-desc/g) ?? []).length).toBe(1); // 仅 00-a 有摘要
    const dev = syntheticIndexMarkdown(injectedNav, "语法/测试/index.md", {});
    expect(dev).toContain('href="./00-a.md"'); // dev 保持 .md
  });
});

describe("侧边栏视觉对齐（DEFAULT_THEME_CSS，演示页 design-new）", () => {
  it("side-item active 无背景（仅绿字 + 左侧竖条）", () => {
    expect(DEFAULT_THEME_CSS).toMatch(/\.side-item\.active \{[^}]*color: var\(--accent-ink\)[^}]*\}/);
    // 不得再带 accent-soft 背景
    expect(DEFAULT_THEME_CSS).not.toMatch(/\.side-item\.active \{[^}]*background/);
  });

  it("side-title 为纯标签：无 chevron、不可点击（无 cursor:pointer / hover / collapsed）", () => {
    expect(DEFAULT_THEME_CSS).not.toContain(".side-title::before");
    expect(DEFAULT_THEME_CSS).not.toMatch(/\.side-title \{[^}]*cursor: pointer/);
    expect(DEFAULT_THEME_CSS).not.toContain(".side-title:hover");
    expect(DEFAULT_THEME_CSS).not.toContain(".side-group.collapsed");
  });

  it("side-title 字重 700（复刻演示页「粗标题」观感——中文 600 由系统字体合成粗体、英文 Inter 真 600 偏细，故提级）", () => {
    expect(DEFAULT_THEME_CSS).toMatch(/\.side-title \{[^}]*font-weight: 700/);
  });

  it("body line-height 1.68（演示页全局行高——侧边栏行高 22.68/18.48/21.84px 由此继承）", () => {
    expect(DEFAULT_THEME_CSS).toMatch(/body \{[\s\S]*?line-height: 1\.68/);
  });

  it("行距/圆角与演示页一致（padding 5.5/4.5px、margin 26px、radius-sm）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".side-group { margin-bottom: 26px; }");
    expect(DEFAULT_THEME_CSS).toMatch(/\.side-item \{[^}]*padding: 5\.5px 10px[^}]*border-radius: var\(--radius-sm\)/);
    expect(DEFAULT_THEME_CSS).toContain(".side-sub .side-item { font-size: 13px; padding: 4.5px 10px; }");
  });

  it("子分区带演示页竖线：side-sub border-left 1px + 13px 缩进 + 12px 内衬（2026-08 v3 对齐演示页）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".side-sub { margin: 2px 0 2px 13px; padding-left: 12px; border-left: 1px solid var(--line); }");
    // 竖线必现（v2 曾去掉 border-left 导致树形结构消失，用户反馈须与演示页一致）
    expect(DEFAULT_THEME_CSS).toMatch(/\.side-sub \{[^}]*border-left: 1px solid var\(--line\)/);
  });

  it("总览页卡片样式（dir-grid/dir-card，2026-08 v2 合成总览页）", () => {
    expect(DEFAULT_THEME_CSS).toContain(".dir-grid { display: grid; gap: 10px; margin: 16px 0 8px; }");
    expect(DEFAULT_THEME_CSS).toMatch(/\.dir-card \{[\s\S]*?border: 1px solid var\(--line\)/);
  });

  it("根级文件仅在后跟分组时补 26px 间距（:has 限定；纯平铺列表零额外间距——2026-08 修复）", () => {
    expect(DEFAULT_THEME_CSS).toContain(
      ".sidebar > nav > ul > li > a.side-item:has(+ li > .side-group) { margin-bottom: 26px; }"
    );
    // 不得再对全部根级文件无条件加 26px（纯平铺站点间距翻倍的根因）
    expect(DEFAULT_THEME_CSS).not.toMatch(/\.sidebar > nav > ul > li > a\.side-item \{ margin-bottom: 26px; \}/);
  });
});
