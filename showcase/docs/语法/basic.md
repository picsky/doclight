---
title: 基础 Markdown 与 GFM
description: 标准 Markdown + GitHub Flavored Markdown 的逐项演示：标题层级、强调、列表、表格、引用、链接、任务列表。
summary: CommonMark + GFM 全量支持的活体演示页。
date: 2026-08-16
updated: 2026-08-16
priority: high
tags: [markdown, gfm, 基础]
category: 渲染能力
difficulty: beginner
author: DocLight 展示站
---

# 基础 Markdown 与 GFM

> DocLight 基于 **marked v18 + DOMPurify** 渲染，支持 CommonMark 与 GFM 全量语法。
> 本页逐项演示，右侧目录会实时跟随你阅读的位置。

## 标题层级

标题自动注入锚点 id，点击右侧目录即可跳转：

### 三级标题（h3，会进入目录）

#### 四级标题（h4，不进目录，标签化呈现）

##### 五级标题（h5）

## 强调与行内元素

- **粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`
- 行内链接：[站内相对链接](../语法/code.md) · [外部链接](https://doclight.tech)（新标签打开）

:::tip
GFM 自动链接：裸 URL `https://doclight.tech` 会被自动识别为链接。
:::

## 列表

无序列表（可嵌套）：

- 第一层
  - 第二层 A
  - 第二层 B
    - 第三层
- 回到第一层

有序列表：

1. 准备内容
2. 编写 Markdown
3. `doclight dev` 实时预览

任务列表（GFM）：

- [x] 基础语法已覆盖
- [x] GFM 扩展已覆盖
- [ ] 进阶语法（见其它页面）

## 表格

标准表格（超宽时自动横向滚动包裹，长表还有 sticky 表头）：

| 语法 | 类型 | 是否默认启用 |
| --- | --- | --- |
| 标题 / 强调 / 列表 | CommonMark | ✅ |
| 表格 / 任务列表 / 删除线 | GFM | ✅ |
| 容器 / Tabs / Steps | DocLight 扩展 | ✅ |
| KaTeX 公式 | DocLight 扩展 | ✅ |
| Mermaid 图表 | 官方插件 | ⚙️ 按需 |

对齐控制：左对齐 `:---`、居中 `:---:`、右对齐 `---:`：

| 左 | 中 | 右 |
| :--- | :---: | ---: |
| 1 | 2 | 3 |
| 10 | 20 | 30 |

## 引用

> 单层引用：让内容发光，让界面退后。
>
> 多段引用用空行分隔。

> 嵌套引用：
>
> > 引用中的引用。

## 分割线

水平线用于分隔内容块：

---

水平线之上。这条线之后就是新的内容块了。
