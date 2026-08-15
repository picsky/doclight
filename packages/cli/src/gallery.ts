/**
 * 主题画廊（VIS-001，11-default-themes §4：主题预览对比页）
 *
 * 目的：让用户（和 Agent）直观对比 4 套模板，零成本切换；视觉回归基线也取自画廊
 * （4 模板 × 亮暗 × 断点）。
 *
 * 产物（outDir/gallery/）：
 * - index.html          画廊索引页：4×2 = 8 个 iframe 面板并排 + 亮/暗切换按钮
 * - <theme>/<mode>/index.html  每面板独立页面（fixedTheme 钉死亮/暗——画廊不依赖
 *   localStorage/系统偏好，对比纯净）
 *
 * 面板复用 renderPage（form="ssg"）：同一篇内置示例文档 × 主题包 × 固定模式，
 * 与真实站点同构（SNAP-001：渲染唯一在 Node 内核）。
 * 示例文档覆盖全语法特性（标题层级/代码/表格/容器/公式/图表/引用/列表），
 * 供人/Agent 一眼评估各模板的视觉表达。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { render } from "@doclight/renderer";
import { BUILTIN_THEMES, BUILTIN_THEME_DEFAULT_MODE } from "./themes.ts";
import { renderPage } from "./site.ts";

/** 内置示例文档（画廊内容）：覆盖标题层级 / 代码 / 表格 / 容器 / 公式 / 图表 / 引用 / 列表 / Tabs / 步骤（设计对齐 2026-08-16） */
export const SAMPLE_GALLERY_DOC = `---
title: 主题示例
description: DocLight 主题画廊示例文档——覆盖全语法特性
---

# 一级标题：把 Markdown 变成作品

> 技术本质：**Markdown 的表现层**——内容不碰，专注视觉表现力。
> 同样一份 md，经 DocLight 呈现后视觉质量显著更高。

## 二级标题：排版与阅读

中文排版优先：字号/行高/字距按中文阅读调校。正文 15.5px × 1.75 行高、700px 行宽，
行内代码 \`doclight build\` 与 **强调文字** 都在同一节奏上。

### 三级标题：代码高亮（文件名头）

\`\`\`ts title="lib/hello.ts"
export function hello(name: string): string {
  // 注释也参与高亮
  return \`Hello, \${name}!\`;
}
\`\`\`

### 三级标题：数据表格

| 特性 | Minimal | Serif | Modern | Warm |
|------|:-------:|:-----:|:------:|:----:|
| 主色 | 松绿 | 靛蓝 | violet | 暖橙 |
| 圆角 | 10px | 8px | 10px | 10px |
| 气质 | 克制 | 纸感 | 科技 | 亲和 |

## 二级标题：Tabs 与步骤（设计对齐新组件）

:::tabs
:::tab npm
\`\`\`bash
npm install doclight
\`\`\`
:::
:::tab pnpm
\`\`\`bash
pnpm add doclight
\`\`\`
:::
:::

:::steps
1. **定义任务**：把 Markdown 交给 DocLight。
2. **启动渲染**：零构建，开箱即用。
3. **发布作品**：dev 预览 → build → publish。
:::

## 二级标题：扩展语法

:::tip
**提示容器**：左侧 2.5px 竖线 + 极浅同色系底色（宪法 §4.4），不加彩色徽章。
:::

:::warning
**警告容器**：语义色仅作竖线承载，随主题切换（亮/暗双套）。
:::

数学公式（KaTeX）：行内 $E = mc^2$，块级：

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

Mermaid 图表（启用插件时渲染为 SVG，未启用降级为源码）：

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B{DocLight}
  B --> C[文档]
  B --> D[演示]
\`\`\`

## 二级标题：列表与引用

- 无序列表项一：内容即主角，装饰性元素为零
- 无序列表项二：亮/暗双主题，暗色不是亮色的简单反色
  1. 有序子项
  2. 有序子项

- [x] 任务列表：已完成项
- [ ] 任务列表：待办项

---

*斜体注释*：四套模板统一约束——无障碍达标（WCAG AA）、响应式三断点、主题是 token 层。
`;

export interface GalleryOptions {
  /** 画廊输出目录（如 dist-site/gallery） */
  outDir: string;
  /** 站点标题（画廊页头） */
  siteTitle?: string;
  /** 参与对比的主题名（缺省全部内置） */
  themes?: string[];
}

export interface GalleryResult {
  /** 写入的文件（相对 outDir） */
  files: string[];
  /** 总字节 */
  bytes: number;
}

/** 面板页面（单主题 × 单模式，fixedTheme 钉死；与真实站点同构 renderPage） */
function panelHtml(themeName: string, mode: "light" | "dark", siteTitle: string): string {
  const { html } = render(SAMPLE_GALLERY_DOC, { currentPath: "sample.md", linkSuffix: ".html" });
  // 画廊面板导航：静态占位（面板聚焦主题视觉，不引入真实站点导航；新设计语言结构）
  const navHtml =
    '<ul><li><a class="side-item active" href="#">主题示例</a><a class="side-item" href="#">导航演示</a><a class="side-item" href="#">二级分组</a></li></ul>';
  return renderPage({
    title: `${themeName} · ${mode === "light" ? "亮色" : "暗色"}`,
    siteTitle,
    navHtml,
    contentHtml: html,
    form: "ssg",
    themeCss: BUILTIN_THEMES[themeName] ?? "",
    defaultTheme: BUILTIN_THEME_DEFAULT_MODE[themeName],
    fixedTheme: mode,
  });
}

/** 画廊索引页（DP-001：单主题——1×2 面板 + 亮/暗切换；独立静态 HTML，可部署可截图） */
function galleryIndexHtml(options: { siteTitle: string; themes: string[] }): string {
  const { siteTitle, themes } = options;
  const modes: Array<{ key: "light" | "dark"; label: string }> = [
    { key: "light", label: "亮色" },
    { key: "dark", label: "暗色" },
  ];
  const themeMeta: Record<string, string> = {
    minimal: "Minimal · 克制暖灰 松绿 Pine（唯一内置主题）",
  };
  const panelGrid = themes
    .map(
      (t, ti) => `
    <section class="panel" data-theme-key="${t}">
      <header class="panel-head">
        <h2>${t}</h2>
        <span class="panel-desc">${themeMeta[t] ?? ""}</span>
        <nav class="panel-links">
          ${modes.map((m) => `<a href="${t}/${m.key}/index.html" target="_blank" rel="noopener">${m.label} ↗</a>`).join(" ")}
        </nav>
      </header>
      <div class="panel-frames">
        ${modes
          .map(
            (m, mi) =>
              `<iframe class="frame mode-${m.key}" data-mode="${m.key}" src="${t}/${m.key}/index.html" title="${t} ${m.label}" loading="lazy" data-index="${ti}-${mi}"></iframe>`
          )
          .join("\n")}
      </div>
    </section>`
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>主题画廊 · ${siteTitle}</title>
<style>
  body { margin: 0; font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
  header.site { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 12px 24px; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid #e4e4e7; }
  header.site h1 { font-size: 16px; margin: 0; }
  header.site .hint { font-size: 12px; color: #71717a; }
  .mode-toggle { margin-left: auto; display: flex; gap: 6px; }
  .mode-toggle button { border: 1px solid #d4d4d8; background: #fff; border-radius: 6px; padding: 4px 12px; font-size: 13px; cursor: pointer; }
  .mode-toggle button.active { background: #0d9488; border-color: #0d9488; color: #fff; }
  main { padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; }
  .panel { background: #fff; border: 1px solid #e4e4e7; border-radius: 10px; overflow: hidden; }
  .panel-head { display: flex; align-items: baseline; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #e4e4e7; }
  .panel-head h2 { margin: 0; font-size: 14px; text-transform: capitalize; }
  .panel-desc { font-size: 12px; color: #71717a; }
  .panel-links { margin-left: auto; display: flex; gap: 8px; font-size: 12px; }
  .panel-links a { color: #0d9488; text-decoration: none; }
  .panel-frames { display: grid; grid-template-columns: 1fr 1fr; }
  .frame { width: 100%; height: 520px; border: 0; background: #fff; }
  /* DP-007：设计宣言（宪法的「为什么」可视化——排版即界面，零插画） */
  .manifesto { grid-column: 1 / -1; padding: 28px 32px 24px; border: 1px solid #e4e4e7; border-radius: 10px; background: #fff; }
  .manifesto h2 { margin: 0 0 14px; font-size: 15px; letter-spacing: .02em; }
  .manifesto ol { margin: 0 0 16px; padding-left: 20px; font-size: 13px; line-height: 2; color: #3f3f46; }
  .manifesto .facts { display: flex; flex-wrap: wrap; gap: 8px; }
  .manifesto .fact { font-size: 11.5px; color: #52525b; border: 1px solid #e4e4e7; border-radius: 99px; padding: 3px 10px; font-family: ui-monospace, Menlo, Consolas, monospace; }
  @media (max-width: 900px) { .panel-frames { grid-template-columns: 1fr; } }
</style>
<script>
  // 亮/暗切换：切换所有 iframe 为对应模式面板（同主题双面板并排展示两种模式）
  function setMode(mode) {
    document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.querySelectorAll('.panel-frames .frame').forEach(f => {
      var theme = f.closest('.panel').dataset.themeKey;
      f.src = theme + '/' + mode + '/index.html';
    });
  }
</script>
</head>
<body>
<header class="site">
  <h1>DocLight 主题画廊</h1>
  <span class="hint">1 套设计语言 × 亮/暗（${themes.length} 主题 · 同一示例文档 · 点击面板标题右方链接单独打开）</span>
  <nav class="mode-toggle">
    <button data-mode="light" class="active" onclick="setMode('light')">亮色</button>
    <button data-mode="dark" onclick="setMode('dark')">暗色</button>
  </nav>
</header>
<main>
<section class="manifesto" aria-label="设计宣言">
  <h2>设计宣言（宪法五原则）</h2>
  <ol>
    <li><strong>排版即界面</strong>——层级由字重、字号、字距、留白构建，颜色是最后一层增强。</li>
    <li><strong>克制即丰富</strong>——每个视觉元素必须回答「它帮助用户理解什么」，答不上来就删掉。</li>
    <li><strong>颜色有职务</strong>——全产品只有一个强调色（松绿 Pine），只出现在链接、激活、焦点、关键状态。</li>
    <li><strong>隐形的基础设施</strong>——读者读完记住内容，记不起界面。</li>
    <li><strong>时间是唯一的测试</strong>——只做三年后不过时的秩序，不追流行手法。</li>
  </ol>
  <div class="facts">
    <span class="fact">强调色 #14714e / 暗色 #63d2a0</span>
    <span class="fact">圆角仅 8 / 10px 两档</span>
    <span class="fact">8pt 网格（间距 = 4 的倍数）</span>
    <span class="fact">类型阶 xs 12 → 3xl 34</span>
    <span class="fact">动效 ≤300ms · 唯一缓动</span>
    <span class="fact">正文对比度 ≥7 AAA</span>
  </div>
</section>
${panelGrid}
</main>
</body>
</html>
`;
}

/** 构建主题画廊（纯函数式副作用：写文件）。返回写入文件清单 + 字节。 */
export function buildGallery(options: GalleryOptions): GalleryResult {
  const { outDir, siteTitle = "DocLight", themes = Object.keys(BUILTIN_THEMES) } = options;
  const files: string[] = [];
  let bytes = 0;
  const write = (rel: string, content: string): void => {
    const full = join(outDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    files.push(rel);
    bytes += Buffer.byteLength(content, "utf8");
  };
  write("index.html", galleryIndexHtml({ siteTitle, themes }));
  for (const t of themes) {
    if (!BUILTIN_THEMES[t]) continue;
    for (const m of ["light", "dark"] as const) {
      write(`${t}/${m}/index.html`, panelHtml(t, m, siteTitle));
    }
  }
  return { files, bytes };
}
