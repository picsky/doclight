---
title: 主题生态
summary: DocLight 主题包规范与官方主题：4 套设计语言（VIS-001）一套设计令牌换肤（THEME-002），default / minimal / serif / modern / warm + 自定义 CSS；主题画廊 + 设计合规门禁。
tags: [主题, 设计, 定制, 画廊]
difficulty: 入门
---

# 主题生态（THEME-002 + VIS-001）

> **主题包规范**：主题 = **CSS 变量覆盖层**。组件样式全部消费设计令牌（THEME-001），主题只覆盖 `:root`（及 `[data-theme="dark"]` / `[data-theme="light"]`）的令牌值，即可换肤——**零 JS、零结构改动**。
> 注入形态：`<style data-doclight-theme>` 紧跟主样式之后，覆盖令牌生效。
> 组件清单与定制三入口见 [组件库与定制入口](./component-gallery.md)。

---

## 1. 官方主题（4 套设计语言）

`doclight.json` 一行切换：

```json
{ "theme": "modern" }
```

| 主题 | 气质 | 说明 |
|---|---|---|
| `default`（缺省） | Minimal 设计语言（teal 强调） | 模板内置令牌，零注入 |
| `minimal` | 克制灰阶 teal | 与默认一致 + 组件打磨（侧边栏竖线/行内代码浅 teal 底）——技术文档 |
| `serif` | 学术纸感 | 衬线标题（Noto Serif SC/Georgia 栈）+ 米白纸底 + 深靛蓝——课程/知识库/长文 |
| `modern` | 科技暗色 | **默认暗色**（violet 强调）+ 轻玻璃拟态 + 紧凑标题——Startup/开发者门户 |
| `warm` | 温暖亲和 | 暖橙 + 米白 + 12px 大圆角 + 卡片感容器——博客/教程/入门 |

三形态（dev / SSG / bundle）行为一致；**modern 默认暗色**（`defaultTheme:"dark"`：
首次进入即暗色，localStorage 无记录时生效）；其余主题跟随系统偏好，亮/暗双令牌每套自带。

**主题画廊**：`doclight build --themes`（或 `doclight preview --themes`）生成 `gallery/`
——4 套设计语言 × 亮/暗 并排对比页（同一内置示例文档渲染，可部署可截图；
也是视觉回归基线来源，见 §5）。

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
| 字体 | `--font-sans` / `--font-mono`（Serif 另加 `--font-serif`） |
| 字号 | `--font-size-xs` ~ `--font-size-3xl`（模块化缩放 1.25，VIS-001） |
| 行高 | `--line-height-tight` / `-normal` / `-relaxed` |
| 间距 | `--space-1` ~ `--space-16`（4px 基准，8pt 网格） |
| 布局 | `--max-width-content` / `--sidebar-width` / `--toc-width` / `--topbar-height` |
| 圆角 | `--radius-sm` / `--radius` / `--radius-lg` |
| 阴影 | `--shadow-sm` / `--shadow` |
| 过渡 | `--transition-fast` / `--transition` |

**解析规则**：缺省或 `"default"` → 零注入；内置名（`minimal` / `serif` / `modern` / `warm`）→ 内置 CSS；文件路径 → 读取内容；未知 → 警告 + 回退默认（诚实原则）。

---

## 4. 设计合规门禁（VIS-001，机器化）

视觉质量靠机器保障，不靠主观判断——**任何主题改动（含默认主题）必须合规**：

| 检查 | 规则 | 验证 |
|---|---|---|
| 对比度 | text/text-strong/text-secondary 对背景 ≥ 4.5（WCAG AA）；primary ≥ 3；muted ≥ 3 | `npm run verify` 的 visual check（直读 CSS 断言） |
| 8pt 网格 | `--space-*` 全部 4px 倍数 | 同上 |
| 字号节奏 | 从 base 起相邻比例 ≈1.25（±0.08） | 同上 |
| 像素级回归 | 4 主题 × 亮暗 × 3 断点 = 24 组截图与基线 diff | `npm run verify:visual`（基线人工锁定后生效）；首次 `verify:visual:update` 生成 |

> 基线锁定流程（11 §6.2）：`npm run verify:visual:update` 生成 24 张截图 → **人确认后锁定**（基线目录 `artifacts/visual/snapshots/`）→ 之后 `npm run verify:visual` 作为像素级门禁。

---

## 5. 自研主题发布（可选）

主题本质是 CSS 文件——放仓库即可分享；`doclight.json` 里写本地文件路径（相对项目根或绝对路径）。**无需插件机制**（主题不碰结构，只换令牌）。发布前跑一遍 `npm run verify`（visual check 会校验对比度/网格/节奏——不合规的主题会被门禁拦下）。
