# 16 · 设计系统规格（Design System，VIS-002 + 设计对齐 2026-08-16 + DP-001 单主题收敛）

> 状态：✅ 已更新（2026-08-16，设计对齐：令牌体系全局替换为宪法令牌；DP-001：内置主题收敛为唯一一套）
> **设计第一文档（宪法）：`docs/design-new/DESIGN.md`** —— 本文档是宪法的技术实现细则，
> 冲突时以宪法为准。演示基准：`docs/design-new/index.html`（1:1 复刻）。
> 上游文档：[04-reading-experience](./04-reading-experience.md)（排版/色彩基线）、
> [11-default-themes](./11-default-themes.md)（历史存档：多套主题时代）、
> [03-runtime-engine](./03-runtime-engine.md)（CSS 变量机制）、
> [18-design-polish](./18-design-polish.md)（Phase 7 计划：DP-001 单主题收敛）。

---

## 0. 宪法五原则（裁决依据）

1. 排版即界面（层级由字重/字号/字距/留白构建，颜色是最后一层）
2. 克制即丰富（默认不加：渐变、玻璃拟态、投影堆叠、装饰插画、动画）
3. 颜色有职务（唯一强调色，只出现在功能位；中性色承担 95% 界面）
4. 隐形的基础设施（用户记住内容，记不起界面）
5. 时间是唯一的测试（三年后不过时的秩序，不做流行手法）

## 1. 令牌体系（三级：宪法令牌 = 唯一事实来源）

```
宪法令牌（:root / [data-theme="dark"]）   →  主题覆盖层（THEME-002）   →  组件消费
--bg / --text / --accent 等                 --accent: 自定义强调色         var(--space-*) 等
```

### 1.1 色彩令牌（宪法 §3.1）

- 中性色：`--bg` / `--bg-subtle` / `--surface` / `--text` / `--text-2` / `--text-3` /
  `--line` / `--line-strong`（暖调，避免纯黑纯白）
- 唯一强调色：`--accent`（亮 #14714e 松绿 Pine）/ `--accent-hover` / `--accent-soft` /
  `--accent-ink`（正文链接色）——职务 = 链接 / 激活 / 焦点 / 关键状态
- 语义色仅三枚：`--success` #3d9e4f（对勾图标 + 文字）/ `--warning` amber / `--error` red，
  只用于状态指示，不用于大面积填充；与强调绿双重隔离（偏黄相 + 对勾形式）
- 代码：`--code-bg` / `--code-line` + `--syn-k/s/c/n/f/p`（函数色 = 强调色，宪法联动）
- 浮层：`--topbar-bg` / `--shadow-pop`（浅色模式唯一允许的投影）
- **纪律**：禁止硬编码色值；禁止新旧令牌并存（§9.1 全局替换）；`--text-3` 不得用于正文段落

### 1.2 字体与类型阶（宪法 §3.2）

- `--font-sans`（Inter + 系统中文字体栈）/ `--font-serif`（Source Serif 4，仅引言）/
  `--font-mono`（JetBrains Mono）
- 批准档位（唯一）：H1 34px/700、H2 21px/650、H3 16px/600、引言 18px 衬线、正文 15.5px、
  次级 12.5–13.5px、标签 11–12px/600/大写、代码 13px
- `--font-size-xs…3xl`（rem）按批准档位定义；标题 `text-wrap: balance`；正文悬挂标点；
  中西文混排发丝空隙（展示层 JS，宪法 §5）

### 1.3 间距 / 圆角 / 线条 / 动效（宪法 §3.3–3.4）

- 间距：`--space-1…24`（8pt 网格，只许 4 的倍数；门禁 checkSpacingGrid 机器断言）
- 圆角：仅两档 `--radius-sm: 8px` / `--radius: 10px`（头像/徽标可全圆；>12px 禁止）
- 线条：分隔 `1px solid var(--line)`；控件边框 `var(--line-strong)`；禁止投影做分隔
- 动效：`--ease`（唯一缓动）/ `--dur-fast .15s` / `--dur .25s` / `--dur-slow .6s`；
  交互反馈 ≤300ms；入场编排错峰 ≤60ms；`prefers-reduced-motion` 全量降级

## 2. 组件规格（类名 = 契约）

| 组件 | 类名 | 不可违反项 |
|---|---|---|
| 顶栏 | `.topbar`（`.scrolled`）/ `.brand` / `.logo` / `.tag` / `.topnav` / `.search-btn` / `.version-btn` / `.icon-btn` | 毛玻璃静态时无底线，滚动后才出现发丝底线 |
| 侧边栏 | `.side-group` / `.side-title` / `.side-item`（`.active`）/ `.side-sub` | 激活态 = 强调色文字 + soft 底色 + 2px 指示线（三选二即可） |
| 面包屑 | `.crumb` | 根标签「文档」；分隔 "/" |
| 文章头 | `.eyebrow` / `h1` / `.lede`（衬线）/ `.meta` | 层级由字号/字重构建 |
| 提示块 | `.doclight-container`（`.doclight-tip/warning/danger/info`） | 左侧 2.5px 语义色竖线 + 极浅同色系底色 + 单色图标；**不加彩色徽章** |
| 代码块 | `.codeblock` / `.code-head` / `.fname` / `.lang` / `.copy-btn` / `pre.doclight-code` | 头部条 = 文件名 + 语言 + 复制按钮；复制成功 ✓已复制 1.6s 恢复 |
| Tabs | `.tabs` / `.tab-bar` / `.tab-btn`（`.active`）/ `.tab-panel`（`.active`） | 同名 tab 跨组联动（data-tab/data-panel 为键） |
| 步骤 | `.steps` / `.step-title` | 纯 CSS 计数 + 竖线；首段加粗提升为标题 |
| 表格 | `.table-wrap` / `table` | 只有横线没有竖线；表头大写小字；数字 tabular-nums；首列等宽 |
| 下一步 | `.next-grid` / `.next-card`（`.nc-label/.nc-title/.nc-desc`） | 导航树驱动（后续分组首页 ≤4） |
| 分页 | `.pager`（`.dir` / `.pg-title`） | 导航顺序 prev/next |
| 目录 | `.toc` / `.toc-title` / `.toc-list` / `.toc-indicator` / `.toc a`（`.active`/`.l3`）/ `.toc-card` | 指示条随滚动位移；反馈卡「有帮助/需改进」 |
| 页脚 | `.footer` / `.footer-inner` / `.status` / `.powered-by` | 状态 = 对勾图标 + 文字（语义绿隔离） |
| 搜索弹层 | `.modal-mask`（`.open`）/ `.modal` / `.search-row` / `.results` / `.result-item`（`.sel`）/ `.modal-foot` | Ctrl/Cmd+K 开合；↑↓ 导航、⏎ 打开、esc 关闭；焦点陷阱 |
| 图解 | `figure.diagram`（`.d-box` / `.d-edge` / `.d-node-title` 等） | inline SVG + 全 token；figcaption + aria-label 必备 |
| 阅读进度 | `#progress` | 2px 强调色，常驻不喧哗 |

## 3. 交互行为（展示层 design.ts / ux.ts / toc.ts / search.ts）

- 主题：`#themeBtn` 太阳/月亮图标切换；localStorage `doclight-theme`；系统偏好跟随
- CJK 空隙：汉字与拉丁/数字交界插 U+200A（跳过 CODE/PRE/KBD；SPA 后重跑）
- 锚点闪烁：目录/锚点点击 → 目标标题 1.5s 高亮（`.flash`）
- 顶栏滚动态：scrollY > 8 加 `.scrolled`
- 移动端：≤1180px 隐藏右栏；≤860px 隐藏侧栏/导航/搜索（侧栏抽屉 + TOC 底部面板保留）

## 4. 无障碍（宪法 §6，不可妥协）

- 键盘全站可达 + skip link（`.skip`）+ 焦点环（2px 强调色）
- `aria-current`（导航/目录激活项）+ 图表 `role="img"` + aria-label
- 对比度：正文 ≥7 AAA / 辅助 ≥4.5 AA / 强调色文字 ≥4.5（design-compliance 门禁）
- 打印样式（隐藏导航/防跨页断裂/黑白重排）

## 5. 机器化验收

- `design-compliance.ts`：对比度（text≥7 / text-2,3≥4.5 / accent≥3 / accent-ink≥4.5）+
  代码色（syn-* ≥3）+ 状态色（success/warning/error ≥3）+ 8pt 网格 + 批准类型阶
- `visual.mjs`：默认主题 + 4 内置主题全量断言；画廊产物；演示产物
- 视觉回归：画廊 4 主题 × 亮暗 × 3 断点（基线人工锁定，`verify:visual:update`）
- 反模式清单（宪法 §7）：新增第二强调色 / 纯黑 #000 / 投影做分隔 / 硬编码值 /
  装饰性动画 / 玻璃卡片 / 暗色反色 / 中文斜体下划线 / 装饰插画填空 / 追逐流行风格

## 6. 变更历史

| 日期 | 变更 |
|---|---|
| 2026-08-14 | 初版（VIS-002：三级令牌 / 组件 / 无障碍，旧 --color-* 体系） |
| 2026-08-16 | 令牌体系全局替换为宪法令牌（--bg/--text/--accent 等）；组件类名对齐演示页；门禁迁移（正文 AAA / 批准类型阶）；TOC-002 擦洗条被演示页目录取代（见 17 历史） |
