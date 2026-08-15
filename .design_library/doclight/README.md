# DocLight Design System

A design system reconstruction of **DocLight** — 一个把 Markdown 变成作品的开源文档站引擎。
The system is purpose-built for 中文技术文档站的阅读与导航体验。

> *"Luminous light paper background with teal accent; precise typography, generous whitespace, Chinese reading rhythm."*

> **⚠️ 定位声明（2026-08 前端审查补记）**：本库是**设计参考稿（灵感稿）**——基于品牌方向从零推导，
> **不是 DocLight 运行时设计系统的单一事实来源**。产品实现的真实令牌与组件以
> `packages/cli/src/site.ts`（默认主题）与 `packages/cli/src/themes/*.css`（4 套主题）为准；
> 本库的类名、令牌名与产品实现存在系统性差异（见文末「产品实现对照表」），直接移植组件 CSS
> 到产品页面可能失效。`ui_kits/documentation/index.html` 亦为独立预览（约 350 行内联样式与
> `components.css` 双维护、已出现 h2 分隔线/链接下划线/checkbox 等实质分叉）——仅供设计评审，
> 不以它作为产品组件实现基准。Agent 与人做主题/组件开发时，请以产品代码为基准。

## Source

- **Figma library:** N/A（本库基于品牌方向从零推导构建）
- **Pages:** 6 个组件预览页面，覆盖内容展示、导航、代码与提示容器
- **Brand owner:** DocLight 开源文档站引擎

## What this design system covers

- **Foundations** — 以 `#fdfdfc` 纸感亮底为基调，teal `#0f766e` 为主色，slate 中性灰阶；中文阅读优化排版、4px 间距系统、五级阴影与圆角体系
- **Components** — 6 个文档站高频组件：Article 正文、Blockquote 引用、Table 表格、Code Block 代码块、Container 提示容器、Navigation 导航
- **Sample slides & UI kit** — 组件级 HTML 预览卡片，用于设计系统面板快速验证

## CONTENT FUNDAMENTALS

### Voice & tone

DocLight 的语调以内容为先（content-first），克制而技术感（restrained, technical）。中文优先，拉丁字符与数字仅在代码、命令、参数与品牌名中出现。语气保持专业、中立，不带营销口号，也不使用 emoji。标题与导航标签简短直接，如"快速开始""API 参考""安装指南"，避免冗长解释。段落行高设定为 1.75，说明正文应以清晰、可扫描的短句为主，适应中文长文阅读节奏。

### Concrete copy examples

由于本库为从零推导，以下拷贝样例来自品牌方向与组件契约中的真实 UI 拷贝：

- 导航入口：*"快速开始"*
- 导航入口：*"API 参考"*
- 导航入口：*"安装指南"*
- 主题入口：*"主题生态"*
- 搜索框：*"搜索文档"*
- 代码块按钮：*"复制"*
- 容器标题：*"提示"*

### When generating copy

- 中文优先，按钮与导航标签保持 2–4 个汉字
- 不使用 emoji 或装饰性符号作为语义标识
- 代码相关文案保留英文术语与命令原貌
- 提示容器标题使用"提示""注意""警告"等明确语义词

## VISUAL FOUNDATIONS

### Color

品牌主色为 `#0f766e`（teal-600），用于当前导航指示、引用块左侧竖线、按钮与链接。它在浅色模式下呈现沉稳的技术感，在深色模式下切换为更明亮的 teal-400 `#2dd4bf` 以保持可读性。强调色 cyan-500 `#06b6d4` 用于高亮与焦点环（ring）。中性色阶为 slate 9 档（50 → 900），工作主色为 `#f1f5f9`（slate-100，背景衬托）、`#e2e8f0`（slate-200，边框）、`#64748b`（slate-500，次要文字）、`#0f172a`（slate-900，正文）。语义色：success `#16a34a`、warning `#d97706`、danger `#dc2626`、info `#2563eb`。

整体氛围是"发光纸面"：浅色背景 `#fdfdfc` 几乎纯白但带极微弱暖调，深色背景 `#0a0e14` 是深蓝黑并配合半透明玻璃层；阴影始终很轻，强调排版与留白而非 elevations。

### Typography

Display 与 Heading 均使用 **Noto Serif SC**（衬线），营造文档的正式感与阅读节奏；正文使用 **Noto Sans SC**（无衬线），保证屏幕长文的可读性；代码与等宽数字使用 **JetBrains Mono**。字体通过 Google Fonts CDN 加载，离线场景需自行缓存。

字号阶梯：display 56px/1.2、H1 40px/1.25、H2 32px/1.3、H3 24px/1.35、H4 20px/1.4、body 16px/1.75、lead 18px/1.7、caption 12px/1.5、eyebrow 11px/1.4、mono 14px/1.6。中文正文采用 1.75 行高与 680px 最大行宽，落在中文阅读的甜点区。Eyebrow 使用大写与 0.08em 字距，用于标签。

### Spacing

基础单位为 4px，衍生 12 档 token：4、8、12、16、20、24、32、40、48、64、80、96px。按钮与输入框默认高度 40px；正文区域最大宽度 680px，全局内容最大宽度 768px，宽屏布局最大 1200px；侧边栏固定宽度 280px。

### Radius

- **4px** — 小控件、代码块、引用块等精细元素
- **6px** — 按钮、输入框、提示容器
- **8px** — 卡片、表格、导航面板
- **12px** — 大面板
- **16px** — 大卡片
- **9999px** — 全圆角，仅用于 pill 形态

### Shadow / Elevation

5 层阴影，全部使用极低透明度的 slate-900 色调：

1. **Card (level 1):** `0 1px 2px rgba(10, 14, 20, 0.04)` — 基础卡片
2. **Card Hover (level 2):** `0 2px 4px rgba(10, 14, 20, 0.06)` — 悬停反馈
3. **Float (level 3):** `0 8px 16px -4px rgba(10, 14, 20, 0.08)` — 浮层
4. **Modal (level 4):** `0 16px 32px -8px rgba(10, 14, 20, 0.12)` — 模态
5. **Overlay (level 5):** `0 24px 48px -12px rgba(10, 14, 20, 0.16)` — 遮罩

阴影哲学是"耳语"：组件在静止时几乎没有阴影，靠留白与边框建立层次；深色模式下同样保持克制，依赖玻璃层与边框而非重阴影。

### Borders, Backgrounds, Animation, Iconography

- 边框：默认 1px `--doclight-slate-200`，柔和分隔；深色模式切换为 slate-700
- 背景：浅色 `--doclight-slate-100` 用于 muted 区域；surface 容器提供 5 级亮度从 `#ffffff` 到 `#e6e6e5`
- 动画：快速 150ms、常规 250ms、慢速 350ms，缓动 `cubic-bezier(0.4, 0, 0.2, 1)`；悬停与聚焦以背景色微变为主
- 图标：未导出独立 SVG 图标资源，当前使用文字符号（✓、⚠）与简单几何标识；后续应替换为统一图标集

## Component Patterns

| Component | Preview | Contract | CSS Source | Key Facts | Key Insight |
|---|---|---|---|---|---|
| Article 正文排版 | `preview/component-article.html` | `components/article.json` | `components.css` section `Article` | 680px 行宽，16px/1.75，H1-H3 锚点链接，覆盖 strong/em/del/code/ul/ol/任务列表/引用/图片/分隔线，含 compact 密度变体 | 完整 Markdown 长文一站覆盖，中文阅读甜点区 |
| Blockquote 引用块 | `preview/component-blockquote.html` | `components/blockquote.json` | `components.css` section `Blockquote` | `--color-bg-quote` 背景、3px 主色竖线、圆角、来源 cite，不倾斜 | 用背景与竖线建立引用层级，不抢正文节奏 |
| Table 表格 | `preview/component-table.html` | `components/table.json` | `components.css` section `Table` | 100% 宽度、表头 `--color-bg-table-header`、斑马纹 `--color-bg-table-row-alt`、数字 tabular-nums 右对齐、溢出阴影、compact 模式 | 文档表格以可读性优先，hover 不糊字 |
| Code Block 代码块 | `preview/component-code-block.html` | `components/code-block.json` | `components.css` section `Code Block` | 顶部语言标签 + 复制按钮（成功态反馈）、pre 自动滚动、左侧行号、JetBrains Mono、浅/深双主题 | 高频技术元素，hover 强化操作反馈 |
| Container 提示容器 | `preview/component-container.html` | `components/container.json` | `components.css` section `Container` | tip/info/warning/danger 四种语义类型，各自半透明背景与语义色竖条，图标 + 标题 + 正文 | 用颜色和图标双重语义替代关闭/折叠交互 |
| Navigation 导航 | `preview/component-navigation.html` | `components/navigation.json` | `components.css` section `Navigation` | 64px 顶栏（`--shadow-1`）+ 280px 侧边栏 + 168px TOC，当前项 3px teal 竖线 | 文档站标准三栏，导轨式大纲 |

## 产品实现对照表（2026-08 对齐）

本库与产品实现的关键差异（产品侧为事实来源）：

| 维度 | 本库（参考稿） | 产品实现（事实来源） |
|---|---|---|
| 主色 | `--primary: #0f766e`（teal-600） | `--color-primary: #0d9488`（UI/品牌）；正文链接 `--color-link: #0f766e`（AA 4.5 专用） |
| 暗色机制 | `.dark` class | `[data-theme="dark"]` 属性（本库已增补别名，两者等价） |
| 字体 | Google Fonts CDN（Noto Serif/Sans SC、JetBrains Mono） | 系统字体栈（PingFang SC / 微软雅黑…），零网络请求；字体插件可扩展 |
| 间距刻度 | `--space-7: 32px; --space-10: 64px; --space-12: 96px` | 4px 阶梯 `--space-7: 28px; --space-10: 40px; --space-12: 48px`（产品已补 7/9/11 档与 `--radius-md` 别名，本库组件可移植） |
| 组件类名 | `.article/.blockquote/.code-block/.container/.nav-link/.doclight-table` | `article / .doclight-container / .doclight-code-wrap / .sidebar a / table`（类名不通用） |
| 顶栏高度 | 64px | 56px（`--topbar-height`） |
| 强调/焦点环 | cyan-500 `#06b6d4`（`--ring`） | `--ring-color: color-mix(primary 45%, transparent)`（teal 柔化环） |
| 字号阶梯 | 56/40/32/24/20px | 16px × 1.25 链（20/25/31.25/39px） |

## Index

- `README.md` — this file
- `colors_and_type.css` — CSS variables for color, type, radius, shadow, spacing
- `components.css` — aggregated component CSS extracted from preview pages
- `css.json` — structured JSON representation of design tokens
- `components/` — component contract JSON files
- `preview/` — small HTML cards for the Design System tab
- `SKILL.md` — agent skill manifest

## Caveats / known substitutions

1. **无 Figma 源文件。** 本库为 from-scratch 推导，所有组件尺寸、颜色与文案均基于品牌方向与 CSS token 推断，未经过原始设计稿核对。
2. **字体依赖 Google Fonts CDN。** Noto Serif SC、Noto Sans SC 与 JetBrains Mono 通过 `@import` 从 Google Fonts 加载；离线或内网环境需替换为本地字体文件。
3. **图标资源未导出。** 当前组件使用 Unicode 符号与简单几何图形作为占位，未形成统一 SVG 图标集；生产环境建议补充并替换。
4. **深色模式机制。** 原依赖 `.dark` class；2026-08 已增补 `[data-theme="dark"]` 属性别名（与产品防闪烁脚本一致），两者等价；未包含 OS 级 `prefers-color-scheme` 自动适配（由产品展示层处理）。
5. **部分 token 为生成值。** 颜色阶中的 50/100/200/300/400/700/800/900 为算法扩展，需根据实际品牌色板复核。
