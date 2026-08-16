---
title: Tabs 与 Steps
description: 跨组联动的标签页（:::tabs）与编号步骤（:::steps）演示——纯 CSS 标记，首面板直出。
summary: Tabs 跨组联动与 Steps 编号连线的交互演示。
date: 2026-08-16
priority: medium
tags: [tabs, steps, 扩展语法]
category: 渲染能力
difficulty: beginner
author: DocLight 展示站
---

# Tabs 与 Steps

> 两个 DocLight 扩展容器：**Tabs**（标签页，同名标签**跨组联动**）与 **Steps**（编号 + 连线步骤）。

## Tabs：安装方式

:::tabs
:::tab npm
```bash
npm install -g doclight
```
:::
:::tab pnpm
```bash
pnpm add -g doclight
```
:::
:::tab yarn
```bash
yarn global add doclight
```
:::
:::

:::tip 跨组联动
上面三个标签（npm / pnpm / yarn）与下面一组的同名标签**全局联动**——点击其一，另一组同步切换。
:::

## Tabs：验证安装

:::tabs
:::tab npm
```bash
doclight --version
```
:::
:::tab pnpm
```bash
doclight --version
```
:::
:::tab yarn
```bash
doclight --version
```
:::
:::

## Steps：发布流程

:::steps
1. **编写**：在 `docs/` 下写 Markdown（frontmatter 声明元数据）
2. **预览**：`doclight dev` 本地实时预览，内容先进预览态
3. **构建**：`doclight build` 静态导出（llms.txt / docs.json / capabilities.json）
4. **确认**：人工确认预览效果
5. **发布**：`doclight publish` 发布到目标空间
:::

:::info
Steps 容器为**编号 + 连线**的视觉形态，降级后是有序列表——语义不丢。
:::

## 源码形态

````md
:::tabs
:::tab npm
```bash
npm install -g doclight
```
:::
:::tab pnpm
```bash
pnpm add -g doclight
```
:::
:::
````

:::warning
Tabs 语法注意：`:::tabs` 与 `:::tab <名>` 的**标签名要一致**才能跨组联动；`:::` 闭合标记不要漏。
:::
