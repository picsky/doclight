---
title: Mermaid 图表
description: Mermaid 图表渲染演示——流程图、时序图、甘特图、饼图、ER 图。由官方插件按需启用，失败自动降级保留源码。
summary: Mermaid 五类图表的渲染演示（mermaid 插件已启用）。
date: 2026-08-16
priority: high
tags: [mermaid, 图表, 插件]
category: 渲染能力
difficulty: intermediate
author: DocLight 展示站
provenance: doclight-showcase
---

# Mermaid 图表

> 图表由 **Mermaid 官方插件**渲染（本站在 `doclight.json` 中启用了 `plugins: ["mermaid"]`）。
> 图表**懒加载**（mermaid.min.js ≈ 2.4MB 按需拉取），渲染失败时**自动降级为源码**并提示，绝不白屏。
> 暗色模式下图表跟随主题自动切换配色。

## 流程图（Flowchart）

```mermaid
flowchart TD
  A[编写 Markdown] --> B{doclight dev 预览}
  B -->|满意| C[doclight build]
  B -->|不满意| A
  C --> D[doclight publish]
  D --> E[发布成功 🎉]
```

## 时序图（Sequence Diagram）

```mermaid
sequenceDiagram
  participant 作者 as 内容作者
  participant 引擎 as DocLight 引擎
  participant 读者 as 读者

  作者->>引擎: 写入 docs/*.md
  引擎->>引擎: marked + DOMPurify 渲染
  引擎-->>读者: 静态 HTML 直出
  读者->>读者: 阅读（无 JS 也完整可读）
  读者-->>作者: 反馈
```

## 甘特图（Gantt）

```mermaid
gantt
  title DocLight 发布计划
  dateFormat YYYY-MM-DD
  section 内容
  编写文档        :a1, 2026-08-01, 10d
  评审与修订      :a2, after a1, 5d
  section 发布
  构建与验证      :b1, after a2, 3d
  正式发布        :milestone, after b1, 0d
```

## 饼图（Pie）

```mermaid
pie title 文档站流量来源
  "搜索引擎" : 45
  "直接访问" : 30
  "站内跳转" : 15
  "AI Agent" : 10
```

## ER 图（Entity Relationship）

```mermaid
erDiagram
  DOC ||--o{ TAG : "标记为"
  DOC {
    string title
    string slug
    date updated
  }
  TAG {
    string name
  }
```

## 渲染失败时的降级

如果图表语法有误，会**保留源码 + 错误提示**（不会白屏）：

```mermaid
flowchart TD
  这里缺少闭合括号 [
```

:::info
插件启用后，本页五类图表都会渲染为 SVG。若你看到的是代码块而不是图表，说明 vendor 未加载——三形态接线见下文。
:::

## 三形态接线

| 形态 | mermaid.min.js 来源 | 说明 |
| --- | --- | --- |
| `doclight dev` | node_modules 按需服务 | 启用插件即自动可用 |
| `doclight build` | 拷贝进产物 `vendor/` | 自包含，离线可用 |
| `doclight bundle` | 默认不内联（需 `--inline-vendor`） | file:// 下需显式内联 |
