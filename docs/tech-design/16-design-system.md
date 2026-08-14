# 16 · 设计系统规格（Design System，VIS-002）

> 状态：✅ 已接受（2026-08-14，用户确认方向后执行）
> 对应原则：ADR-0004 原则一（视觉表现力即产品）+ 01 §1.3 原则三（内容是主角）
> 上游文档：[04-reading-experience](./04-reading-experience.md)（排版/色彩基线）、
> [11-default-themes](./11-default-themes.md)（4 套设计语言）、
> [03-runtime-engine](./03-runtime-engine.md)（CSS 变量机制）
> 用户决策（2026-08-14）：风格 = 克制为底 + 精致细节；字体 = 系统精调 + 字体插件；
> 主题 = Minimal 打样 → 4 套全量；动效 = 克制。

---

## 1. 设计愿景

> **"让读者忘记界面，让内容自带光芒。"**
> 以 Mintliff 式克制留白为底、Stripe 式信息层次为骨、中文排版考究为魂。
> 界面隐形是底线，交互点（搜索/代码块/顶栏）的精致细节是表达。

### 1.1 设计原则（继承 04 §4.1 + 本系统强化）

1. **内容即主角**：UI 透明度极致——界面不抢戏，读完记住内容记不住界面
2. **克制即高级**：单一强调色、克制动效、留白优先；每个视觉元素有功能目的
3. **细节即尊严**：像素级打磨交互点（搜索、代码块、焦点、过渡），细节密度决定"作品级"还是"能用"
4. **中文优先**：中英混排间距、标点、数字、行高按中文阅读调校——这是与英文竞品（Mintlify 等）的差异化战场
5. **机器化保障**：所有设计质量以断言（对比度/8pt/1.25）+ 视觉回归锁定，不靠主观

### 1.2 世界顶级参照系

| 参照 | 借鉴 | 不借鉴 |
|---|---|---|
| Mintlify | 极致留白、界面隐形、排版呼吸感 | 模板同质化、托管锁定 |
| Stripe Docs | 信息层次、代码块协调、导航分组 | 视觉复杂度 |
| Linear | 暗色层次、克制强调色、细腻动效 | 工具气质（非阅读） |
| Apple/语雀 | 中文排版考究（标点/字距/混排） | 平台字体方案 |

---

## 2. 令牌体系（三级）

### 2.1 结构

```
原始令牌（Raw）    →   语义令牌（Semantic）    →   组件令牌（Component）
--teal-600 等        --color-primary 等          --topbar-height 等
（只定义一次）        （主题覆盖层唯一入口）       （组件消费语义令牌）
```

- **主题 = 语义令牌覆盖层**（THEME-002 契约不变）：主题 CSS 只改语义令牌 + 少量组件规则
- **新增令牌**（相对 THEME-001）：
  - 间距补齐：`--space-5: 20px`（8pt 网格 20 合法——20/4=5 ✓）、`--space-10: 40px`
  - 字距：`--tracking-tight: -0.01em` / `--tracking-normal: 0` / `--tracking-wide: 0.04em`（标题/标签）
  - 缓动：`--ease-standard: cubic-bezier(0.2, 0, 0, 1)` / `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`（Linear 式出场）
  - 阴影层级：`--shadow-sm / --shadow / --shadow-lg / --shadow-xl`（分层，克制）
  - 聚焦环：`--ring-color: color-mix(in srgb, var(--color-primary) 45%, transparent)`
- **合规**：`--space-*` 保持 4px 倍数；`--font-size-*` 保持 1.25 节奏（design-compliance 门禁不变）

### 2.2 字体策略（用户决策：系统字体精调 + 字体插件）

- 默认零网络请求：系统字体栈精调（中文各平台最优：PingFang SC / Microsoft YaHei / Noto Sans CJK SC）
- 标题与正文同栈、靠字重/字号/字距区分层级（不引 Web Font）
- **字体插件**（opt-in，后续 PLUG 迭代）：`doclight.json` 启用 Web Font 插件注入 `@font-face`，
  默认关闭保轻量与离线（文件在 packages/cli/src/plugins-official/ 预留）

---

## 3. 排版专项（中文阅读系统）

### 3.1 正文基线（继承 04 §4.2，不破坏门禁）

- 16px × 1.75 行高 / 680px 行宽 / 段距 1.5em / 不首行缩进
- 标题 1.25 模块化缩放；上留白 > 下留白（章节感）

### 3.2 中英混排（VIS-002 新增）

- 原则：**中文与拉丁字符/数字之间不手动加空格**（作者少打字），CSS 用
  `text-spacing` 或 `word-spacing` 微调（浏览器原生 CJK 渲染已含混排间距，仅校正极端场景）
- 实现：`article` 上设置 `text-rendering: optimizeLegibility`；
  行内代码/英文术语保留原样（代码不受混排影响）
- 标点：中文引号/括号不做悬挂（保守，避免破坏对齐）；破折号/省略号宽度校正

### 3.3 代码节奏

- 行内代码：0.875em + 浅底 + teal 字（04 §4.4.2 延续）+ 细边框（当前形态）
- 代码块：14px/1.6 行高；语言标签（右上角小字，JS 注入）；复制按钮 hover 浮现
- 表格数字列：`font-variant-numeric: tabular-nums`（对齐）

---

## 4. 组件规格（Minimal 打样基准）

| 组件 | 规格要点 | 状态 |
|---|---|---|
| **顶栏** | 毛玻璃 + 品牌区 + 搜索触发器（胶囊）+ SVG 图标 | ✅ VIS-002 已落地 |
| **侧边栏** | sticky 独立滚动；分组标题加粗；active teal 竖线+浅底 | ✅ 已落地 |
| **TOC** | ≥1280px 常驻右栏；active 左竖线+浅底；≤1279 隐藏/移动端 FAB+sheet | ✅ 已落地 |
| **搜索** | 毛玻璃遮罩 + 大圆角面板；结果 hover 高亮；空态/最近搜索；↑↓ 键盘 | 🔧 本轮打磨 |
| **代码块** | 语言标签注入 + 复制反馈（"已复制"）+ 阴影 | 🔧 本轮打磨 |
| **提示容器** | CSS ::before 图标（✓/⚠/✕/ℹ，纯 class 承载符合铁律）+ 语义色左边线 | 🔧 本轮打磨 |
| **阅读进度条** | 顶栏下 2px teal 细线，滚动驱动（04 §4.5.3 补兑现） | 🔧 本轮新增 |
| **回到顶部** | 滚动 2 屏后右下角浮现，40px 圆形（04 §4.5.4 补兑现） | 🔧 本轮新增 |
| **面包屑** | 分隔符 "/" + 当前页加粗（已有，微调间距） | ✅ |
| **焦点环** | :focus-visible 2px teal 环（WCAG 2.4.7） | ✅ 已落地 |
| **移动端** | 抽屉 + 触摸反馈（:active 变暗）+ 安全区（safe-area-inset） | 🔧 本轮打磨 |

### 4.1 搜索面板细节（本系统重点打磨）

- 遮罩 `rgba(0,0,0,.35)` + `backdrop-filter: blur(4px)`（内容区可见但聚焦搜索）
- 面板：`min(600px, calc(100vw-32px))`、`--radius-lg`、`--shadow-xl`、输入区底部细分隔
- 结果项：title（strong）+ path（mono 小字）+ snippet（次级色，命中 `<mark>` teal）
- 空态："无匹配结果" 居中灰字；最近搜索带时间标签样式
- 键盘：↑↓ 循环 + Enter 打开 + Esc 关闭（既有，样式统一）

### 4.2 动效语言（克制）

| 场景 | 规格 |
|---|---|
| hover/active 反馈 | 150ms `--ease-standard`（颜色/背景/边框） |
| 面板/遮罩进出 | 200ms `--ease-out`（opacity + translateY(4px)→0） |
| 页面进场 | article 150ms 淡入（SPA 导航后） |
| 主题切换 | 200ms 颜色过渡（body/顶栏/侧边栏） |
| reduced-motion | 全部禁用（既有全局规则） |

---

## 5. 主题语言矩阵（Phase B 兑现）

| 维度 | Minimal | Serif | Modern | Warm |
|---|---|---|---|---|
| 骨架 | 三栏细边框 | 三栏无边框+纸底 | 三栏深色+玻璃 | 两栏暖白卡片 |
| 圆角 | 6px | 2px | 8px | 12px |
| 阴影 | 几乎无 | 无 | 轻玻璃 | 软暖影 |
| 动效 | 150ms | 近乎无 | 200ms 微弹性 | 120ms 轻快 |
| 代码块 | 灰阶 | 纸色 | 深色玻璃 | 暖灰卡片 |
| 字体性格 | 无衬线精确 | 衬线标题 | 紧凑无衬线 | 圆润亲和 |

每套验收：4 模板 × 亮暗 × 3 断点视觉基线（36 组）+ 合规门禁 + 画廊对比。

---

## 6. 无障碍（VIS-002 强化）

- 对比度 WCAG AA（既有门禁）
- 焦点环统一（既有）
- 搜索键盘全流程（既有）
- 进度条/回顶按钮带 aria-label；回顶尊重 reduced-motion
- 触摸目标 ≥ 44px（移动端 FAB/抽屉按钮）

---

## 7. 验收

- `npm run verify` 7/7 全绿（含 visual 合规断言）
- `npm run verify:visual` 基线 diff=0（基线更新需人确认）
- 体积门禁：展示层 < 25KB gzip 不变
- 设计评审：内容不抢戏 / 中文排版舒适 / 主题个性成立

## 9. 视觉语言：Luminous 光之容器（VIS-002 惊艳化，2026-08-14 用户选定）

> 「DocLight = 把 Markdown 变成作品」→ 视觉隐喻：**让内容发光**。
> 页面像一道光照亮的画布——亮色是晨光纸感，暗色是夜航辉光。

### 9.1 双面基调

| 面 | 性格 | 基底 | 光效 |
|---|---|---|---|
| **晨光（亮）** | 暖白纸感、柔和 | `--color-bg: #fdfdfc`（微暖白）| 顶部柔光晕 + 主色 5% 渗光，克制 |
| **夜航（暗）** | 深蓝黑、辉光 | `--color-bg: #0a0e14`（夜蓝黑）| teal 辉光 + 星芒微粒 + 玻璃层次，惊艳主场 |

### 9.2 光效层实现（全部 CSS，零图片零 JS 增量）

1. **背景光晕**：`body::before` 双径向渐变（右上主光 + 左下补光），primary 色 5-7%
2. **星芒微粒**：`body::after` 极淡 radial-gradient 点阵（暗色显、亮色隐）——夜空感
3. **顶栏光条**：topbar `::after` 1px 渐变细线（transparent → primary → transparent），替代纯边框
4. **代码块辉光**：`pre` inset 内发光 + 外圈微光（--code-* 令牌已就位，夜航下语法色更亮）
5. **active 光晕**：侧边栏/TOC 当前项 teal 光晕（box-shadow 0 0 8px primary 30%）
6. **品牌辉光**：brand-mark 径向光晕层 + 白色光芒 SVG
7. **搜索辉光**：面板聚焦态 0 0 0 1px primary 20% + 投影

### 9.3 令牌新增

```
--gradient-brand: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, #22d3ee));
--glow-primary: 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent), 0 8px 32px color-mix(in srgb, var(--color-primary) 12%, transparent);
```

### 9.4 动效（克制）

- 页面进场：淡入 + 4px 上移（既有）；主题切换 200ms 过渡（既有）
- 不引入自动呼吸/流光动画——Luminous 靠静态层次表达，动效仍守「克制动效」纪律

---

## 8. 关联需求

- VIS-002 设计系统（本文档）；VIS-003 主题语言（Phase B）；VIS-004 体验打磨（Phase C）
- 04-reading-experience / 11-default-themes（上游基线）
