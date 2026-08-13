---
title: 主题生态
summary: DocLight 主题包规范与官方主题：一套设计令牌换肤（THEME-002），default / minimal / warm 三套 + 自定义 CSS。
tags: [主题, 设计, 定制]
difficulty: 入门
---

# 主题生态（THEME-002）

> **主题包规范**：主题 = **CSS 变量覆盖层**。组件样式全部消费设计令牌（THEME-001），主题只覆盖 `:root`（及 `[data-theme="dark"]`）的令牌值，即可换肤——**零 JS、零结构改动**。
> 注入形态：`<style data-doclight-theme>` 紧跟主样式之后，覆盖令牌生效。

---

## 1. 官方主题（3 套）

`doclight.json` 一行切换：

```json
{ "theme": "minimal" }
```

| 主题 | 气质 | 说明 |
|---|---|---|
| `default`（缺省） | 现代清爽（teal 强调） | 模板内置令牌，零注入 |
| `minimal` | 极简黑白 | 墨色强调、更小圆角、紧凑节奏——技术手册 / API 文档 |
| `warm` | 暖纸阅读 | 米色纸张 + 琥珀棕 + 衬线标题（宋体/Georgia）——博客 / 长文 |

三形态（dev / SSG / bundle）行为一致；暗色模式（`data-theme="dark"`）每套主题自带暗色令牌。

---

## 2. 自定义主题（CSS 文件）

```json
{ "theme": "./themes/my-theme.css" }
```

`themes/my-theme.css` 只需覆盖想换的令牌：

```css
:root {
  --color-primary: #7c3aed;      /* 品牌强调色（紫） */
  --color-primary-hover: #6d28d9;
  --color-primary-light: #ede9fe;
  --color-bg: #fafafa;           /* 页面背景 */
  --color-bg-soft: #f4f4f5;      /* 顶栏/侧边栏背景 */
  --radius: 10px;                /* 组件圆角 */
}
[data-theme="dark"] {
  --color-primary: #a78bfa;
  --color-primary-light: #4c1d95;
}
```

还可以追加组件级微调（主题是普通 CSS，不只是令牌）：

```css
article h1 { letter-spacing: -0.02em; }
```

---

## 3. 设计令牌清单（THEME-001）

| 组 | 令牌 |
|---|---|
| 品牌 | `--color-primary` / `-hover` / `-light` |
| 灰阶 8 级 | `--color-bg` / `-bg-soft` / `-bg-code` / `-border` / `-border-soft` / `-text-muted` / `-text-secondary` / `-text` / `-text-strong` |
| 语义色 | `--color-success` / `-warning` / `-error` / `-info` |
| 字体 | `--font-sans` / `--font-mono` |
| 字号 | `--font-size-xs` ~ `--font-size-3xl`（模块化缩放 1.25） |
| 行高 | `--line-height-tight` / `-normal` / `-relaxed` |
| 间距 | `--space-1` ~ `--space-16`（4px 基准） |
| 布局 | `--max-width-content` / `--sidebar-width` / `--toc-width` / `--topbar-height` |
| 圆角 | `--radius-sm` / `--radius` / `--radius-lg` |
| 阴影 | `--shadow-sm` / `--shadow` |
| 过渡 | `--transition-fast` / `--transition` |

**解析规则**：缺省或 `"default"` → 零注入；内置名（`minimal` / `warm`）→ 内置 CSS；文件路径 → 读取内容；未知 → 警告 + 回退默认（诚实原则）。

---

## 4. 自研主题发布（可选）

主题本质是 CSS 文件——放仓库即可分享；`doclight.json` 里写本地文件路径（相对项目根或绝对路径）。**无需插件机制**（主题不碰结构，只换令牌）。
