---
title: 主题与定制
summary: DocLight 单主题设计（DP-001）：唯一内置主题 minimal（= 默认松绿 Pine 设计语言）+ 自定义 CSS 主题包（THEME-002）；主题画廊 + 设计合规门禁。
tags: [主题, 设计, 定制, 画廊]
difficulty: 入门
---

# 主题与定制（THEME-002 + DP-001）

> **主题包规范**：主题 = **CSS 变量覆盖层**。组件样式全部消费设计令牌，主题只覆盖 `:root`（及 `[data-theme="dark"]` / `[data-theme="light"]`）的令牌值，即可换肤——**零 JS、零结构改动**。
> 注入形态：`<style data-doclight-theme>` 紧跟主样式之后，覆盖令牌生效。
> 设计准则（宪法）：`docs/design-new/DESIGN.md`；组件清单与定制三入口见 [组件库与定制入口](./component-gallery.md)。

---

## 1. 唯一内置主题（DP-001，2026-08-16 用户决策）

**DocLight 只做一套主题，把一套做好做精。** 内置主题收敛为唯一一套：

| 主题 | 气质 | 说明 |
|---|---|---|
| `default`（缺省） | 松绿 Pine 设计语言 | 模板内置令牌，零注入——**这就是唯一设计语言** |
| `minimal` | 与默认一致 | 显式主题包（`{ "theme": "minimal" }`），视觉与默认完全相同 |

> **已退役**：`serif` / `modern` / `warm` 三套内置主题于 2026-08-16 完全退役。
> 旧配置值（如 `{ "theme": "serif" }`）构建时**警告并降级默认**——不报错中断，也不伪造成功。
> 需要自定义视觉：使用第 2 节的自定义 CSS 主题包（机制永久保留）。

三形态（dev / SSG / bundle）行为一致；唯一内置主题**跟随系统偏好**（亮/暗双令牌自带，
localStorage 无记录时按 `prefers-color-scheme`）。自定义 CSS 主题包可声明 `defaultTheme:"dark"`
（首次进入即暗色）。

**主题画廊**：`doclight build --themes`（或 `doclight preview --themes`）生成 `gallery/`
——1 套设计语言 × 亮/暗 面板（同一内置示例文档渲染，可部署可截图；也是视觉回归基线来源，见 §4）。

---

## 2. 自定义主题（CSS 文件）

```json
{ "theme": "./themes/my-theme.css" }
```

`themes/my-theme.css` 只需覆盖想换的令牌：

```css
:root {
  --accent: #1e3a5f;              /* 唯一强调色（替换松绿） */
  --accent-hover: #162d4a;
  --accent-soft: rgba(30, 58, 95, .07);
  --accent-ink: #1e3a5f;
  --bg: #faf8f5;                  /* 页面背景 */
  --bg-subtle: #f2efe9;           /* 次级底色 */
  --surface: #ebe7df;             /* 控件底 */
}
[data-theme="dark"] {
  --accent: #8ab4f8;
  --accent-hover: #a5c6fa;
  --bg: #161616;
  --surface: #1f1f1e;
}
```

还可以追加组件级微调（主题是普通 CSS，不只是令牌）：

```css
article h1 { letter-spacing: -0.02em; }
```

> 自定义主题同样过设计合规门禁（对比度/网格/类型阶，见 §4）——不合规会被 verify 拦下。

---

## 3. 设计令牌清单（宪法 §3）

| 组 | 令牌 |
|---|---|
| 中性色 | `--bg` / `--bg-subtle` / `--surface` / `--text` / `--text-2` / `--text-3` / `--line` / `--line-strong` |
| 强调色 | `--accent` / `--accent-hover` / `--accent-soft` / `--accent-ink`（全产品唯一强调色） |
| 语义色 | `--success` / `--warning` / `--error`（仅三枚，只用于状态指示） |
| 代码 | `--code-bg` / `--code-line` / `--syn-k` / `--syn-s` / `--syn-c` / `--syn-n` / `--syn-f` / `--syn-p` |
| 字体 | `--font-sans`（Inter + 系统中文字体栈）/ `--font-serif`（Source Serif 4，仅引言）/ `--font-mono`（JetBrains Mono） |
| 字号 | `--font-size-xs` ~ `--font-size-3xl`（宪法 §3.2 批准类型阶） |
| 间距 | `--space-1` ~ `--space-24`（4px 基准，8pt 网格） |
| 圆角 | `--radius`（10px 卡片/代码块/弹层）/ `--radius-sm`（8px 小控件）——仅两档 |
| 动效 | `--ease` / `--dur-fast` / `--dur` / `--dur-slow` |
| 布局 | `--topbar-height` / `--sidebar-width` / `--toc-width` / `--content-max` |
| 浮层 | `--topbar-bg` / `--shadow-pop` |

**解析规则**：缺省或 `"default"` → 零注入；内置名（`minimal`）→ 内置 CSS；
已退役名（`serif` / `modern` / `warm`）→ 警告 + 降级默认；文件路径 → 读取内容；
未知 → 警告 + 回退默认（诚实原则）。

---

## 4. 设计合规门禁（机器化）

视觉质量靠机器保障，不靠主观判断——**任何主题改动（含默认主题）必须合规**：

| 检查 | 规则 | 验证 |
|---|---|---|
| 对比度 | 正文 `--text` ≥ 7（AAA）；`--text-2/3` 与 `--accent-ink` ≥ 4.5（AA）；`--accent` ≥ 3；代码色 `--syn-*` ≥ 3 | `npm run verify` 的 visual check（直读 CSS 断言） |
| 8pt 网格 | `--space-*` 全部 4px 倍数 | 同上 |
| 类型阶 | `--font-size-*` 全部命中宪法 §3.2 批准档位 | 同上 |
| 像素级回归 | 1 主题 × 亮暗 × 3 断点 = 6 组截图与基线 diff | `npm run verify:visual`（基线人工锁定后生效）；首次 `verify:visual:update` 生成 |

> 基线锁定流程（11 §6.2）：`npm run verify:visual:update` 生成 6 张截图 → **人确认后锁定**（基线目录 `artifacts/visual/snapshots/`）→ 之后 `npm run verify:visual` 作为像素级门禁。

---

## 5. 自研主题发布（可选）

主题本质是 CSS 文件——放仓库即可分享；`doclight.json` 里写本地文件路径（相对项目根或绝对路径）。**无需插件机制**（主题不碰结构，只换令牌）。发布前跑一遍 `npm run verify`（visual check 会校验对比度/网格/类型阶——不合规的主题会被门禁拦下）。
