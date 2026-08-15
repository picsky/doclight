---
name: doclight-design
description: Use this skill to generate well-branded interfaces and assets for DocLight — an AI-native open-source engine that turns Markdown into published documentation sites. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping documentation UIs.
user-invocable: true
---

# DocLight Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out
and create static HTML files for the user to view. If working on production code, you can
copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build
or design, ask some questions, and act as an expert designer who outputs HTML artifacts
_or_ production code, depending on the need.

## Quick map

- `README.md` — brand context, content fundamentals, visual foundations (read first)
- `css.json` — structured token understanding source
- `colors_and_type.css` — drop-in runtime CSS variables; link it, do not read it to understand tokens when css.json exists
- `components/_evidence/` — compact component specifications for evidence-backed Figma libraries
- resolved component sources — create-library uses `preview/component-{slug}.html` first, `components/{slug}.json` for intent/variants, and `components/_evidence/{slug}.json` as fallback evidence
- `preview/` — small HTML cards illustrating the foundations and components
- `ui_kits/{type}/` — full click-thru recreation (use as reference for layout, density, patterns)
- `library-consumption.json` — recommended downstream read order

## Essentials at a glance

- Brand primary `#0F766E` (DocLight teal). Luminous light paper `#FDFDFC`; dark mode deep blue-black `#0A0E14` with teal glow. No warm accents, no default gradients.
- Radius scale `4 / 6 / 8 / 12 / 16 / 9999px`. Controls stay sharp (4–6px), cards and containers use 8–12px, pills only for badges.
- Default control height `40px`; spacing base is `4px` with tokens up to `96px`. Generous Chinese reading whitespace.
- Type: **Noto Serif SC** for display and headings; **Noto Sans SC** for body; **JetBrains Mono** for code.
- Voice: Chinese-first, content-first, restrained and technical. No emoji in product UI.
- Shadow philosophy: whisper-quiet elevation using `rgba(10, 14, 20, <0.16)` across five levels. No heavy shadows at rest.
- Signature quirk: documentation reading lane capped at `680px` with `16px / 1.75` line-height; inline links use teal underline plus a subtle hover background.

## Components

| Component | Preview | Contract | CSS Source | Key Facts | Key Insight |
|---|---|---|---|---|---|
| Article 正文排版 | `preview/component-article.html` | `components/article.json` | `components.css` section Article | max-width `680px`, `16px / 1.75`, h1–h3 + lists, normal/compact density | 中文阅读甜点区；紧凑模式保留层级但压缩留白 |
| Blockquote 引用块 | `preview/component-blockquote.html` | `components/blockquote.json` | `components.css` section Blockquote | `3px` teal left border, muted secondary text, light/dark theme | 弱化引文，不抢正文节奏 |
| Table 表格 | `preview/component-table.html` | `components/table.json` | `components.css` section Table | horizontal rules, header on `bg-soft`, `tabular-nums`, minimal/card style | 无竖线，数字等宽右对齐 |
| Code Block 代码块 | `preview/component-code-block.html` | `components/code-block.json` | `components.css` section Code Block | language label + copy button, `14px / 1.6` mono, light/dark | 复制按钮 hover 反馈；技术文档最高频元素 |
| Container 提示容器 | `preview/component-container.html` | `components/container.json` | `components.css` section Container | tip/info/warning/danger, `4px` semantic left bar + icon | 左侧语义色竖条，四种状态一眼可辨 |
| Navigation 导航 | `preview/component-navigation.html` | `components/navigation.json` | `components.css` section Navigation | topbar `64px`, sidebar `280px`, TOC rail, desktop/mobile | 顶栏毛玻璃，当前项 teal 竖线 |
