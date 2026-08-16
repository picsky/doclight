---
title: DocLight 渲染能力展示
description: 本站是 DocLight 渲染内核的活体演示——每一页对应一类渲染能力，所见即所得。
summary: 从基础 Markdown 到 Mermaid 图表，逐页演示 DocLight 支持的全部渲染语法。
date: 2026-08-16
priority: high
tags: [doclight, markdown, 演示]
category: 展示
difficulty: beginner
---

# DocLight 渲染能力展示

> 本站是一份**可交互的渲染能力清单**：左侧导航按能力分组，每一页专门演示一类语法。
> 页面全部由 Markdown 书写、DocLight 渲染内核直出——你在页面里看到的每一个效果，
> 都来自 `docs/` 目录下的同名 `.md` 源文件。

## 能力总览

| 页面 | 演示内容 | 依赖 |
| --- | --- | --- |
| [基础 Markdown](./语法/basic.md) | 标题、强调、列表、表格、引用、链接、任务列表 | 零依赖 |
| [代码高亮](./语法/code.md) | 多语言语法高亮 + 一键复制 | Prism（按需加载） |
| [自定义容器](./语法/containers.md) | 提示 / 警告 / 危险 / 信息 四类容器 | 纯 CSS，零依赖 |
| [Tabs 与 Steps](./语法/tabs-steps.md) | 跨组联动的标签页 + 编号步骤 | 纯 CSS 标记 |
| [KaTeX 公式](./语法/katex.md) | 行内与块级数学公式 | KaTeX（按需加载） |
| [Mermaid 图表](./语法/mermaid.md) | 流程图、时序图、甘特图、饼图、ER 图 | mermaid 插件（按需启用） |

:::tip 阅读建议
从「基础 Markdown」开始逐页浏览，最后到「Mermaid 图表」——那就是 DocLight 渲染能力的完整边界。
:::

## 本页演示了什么

本页已经用到了：

- **frontmatter 语义元数据**（页首 `---` 块：title / summary / tags / priority…）
- **标准表格**（能力总览）+ 相对路径站内链接
- **引用块**（页首引言）+ **自定义容器**（提示卡）
- 中文与西文混排的自动发丝空隙（盘古之白）
