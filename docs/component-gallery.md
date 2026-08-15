# 组件库与定制入口（Component Gallery）

> 对应：11-default-themes §5（模板的 Agent 友好要求）+ 07-plugin-system + research §五（Astryx 模式）。
> 状态：VIS-001 落地（2026-08-13）——组件清单 + 三入口定制，Agent/人同构。

## 为什么存在

表现层的能力不在「能渲染什么」，而在「**同样的内容呈现后视觉质量显著更高**」。
组件库回答两个问题：

1. **有哪些组件**（清单 + 类名 + 设计令牌依赖）——Agent 写文档时知道会出现什么形态；
2. **怎么定制**（三入口）——用户与 Agent 用自然语言即可定制站点（「把站点改成暖色调」
   → Agent 改主题变量 → 预览），打穿传统 CMS「改样式要写代码/找开发」的死结
   （research §五 原则 5）。

组件全部消费 THEME-001 设计令牌（CSS 变量），零硬编码色值/间距——
这是「变量即接口」：**主题不改结构、结构不硬编码样式**。

## 组件清单（v1，内置渲染内核直出）

| 组件 | 标记/类名 | 定制入口 | 说明 |
|---|---|---|---|
| 标题层级 | `article h1..h4` | CSS 变量（--font-size-*）| 1.25 模块化缩放（VIS-001） |
| 正文排版 | `article p` | CSS 变量（--font-size-base / --line-height-* / --max-width-content）| 16px × 1.75 / 680px（04 §4.2） |
| 行内代码 | `article code:not(pre code)` | CSS 变量 + 组件规则 | Minimal teal、Serif 纸色、Modern violet |
| 代码块 | `pre.doclight-code`（+ 复制按钮 `.doclight-copy`）| CSS 变量 + 组件规则 | Prism token 配色随主题亮暗 |
| 表格 | `.table-wrap table` | CSS 变量 + 组件规则 | Serif 只有横线；Warm 卡片表头 |
| 引用 | `blockquote` | CSS 变量 + 组件规则 | 左边线色 = 主题特征 |
| 自定义容器 | `.doclight-container` + `.doclight-tip/warning/danger/info` | CSS 变量 + 组件规则 | REND-002；Serif 纸色 / Warm 卡片感 |
| 导航树 | `.sidebar a` | CSS 变量 + 组件规则 | Minimal active teal 左竖线 |
| TOC | `.toc-rail/.toc-panel/.toc-dot` | CSS 变量 | TOC-001 |
| 搜索 | `.search-overlay/.search-box/...` | CSS 变量 | SRCH-001 |
| 顶栏 | `.topbar` | CSS 变量 + 组件规则 | Modern 玻璃拟态 |
| KaTeX 公式 | `.doclight-katex-*` | CSS 变量 | 懒加载扩展 |
| Mermaid 图表 | `.doclight-mermaid` | 插件样式声明 | @doclight/plugin-mermaid |
| 表格/容器等扩展 | 见 REND-002 注册表 | 注册表白名单 | 内容承载铁律：class 标记 + 子元素 |

## 定制三入口（Astryx 式：不 fork、不写框架代码）

| 入口 | 能力 | 怎么做 | 适用 |
|---|---|---|---|
| **① CSS 变量覆盖** | 改令牌 = 换肤 | doclight.json `theme: "my.css"`（自定义 CSS 文件，THEME-002）| 配色/字体/圆角/间距/行宽——90% 的定制需求 |
| **② extendMarked 替换渲染** | 改组件结构输出 | 插件 `extendMarked` 钩子（PLUG-006 收集器；返回值数组或 use()）| 某类组件换成自定义结构（如代码块加语言徽标） |
| **③ 插件插槽 + 运行时钩子** | 加内容/行为 | `slotContent`（head:start/end、content:after 等 11 插槽，PLUG-005）+ `init/onMount/onRouteChange`（PLUG-003）| 页脚、评论、统计、图表渲染增强 |

**推荐路径**：先 ①（CSS 文件，一行配置）；不够再 ②（extendMarked，一个 JS 文件）；
再不够 ③（完整插件，见 `docs/plugin-guide.md`）。与 Astryx「designer can make it theirs
without forking」同构——DocLight 的「不 fork」= 不碰核心渲染与展示层。

## 主题 = token 层（THEME-002 契约；DP-001 单主题收敛）

- 唯一内置主题（`packages/cli/src/themes/minimal.css`，= 默认松绿 Pine 设计语言），只覆盖公开令牌 + 组件级规则
- 自定义主题 = CSS 文件（`theme: "./my.css"`），可声明 `defaultTheme`（暗色优先）
- **设计合规是硬门禁**：任何内置/默认主题改动必须过 `npm run verify` 的 visual check
  （WCAG AAA/AA 对比度 / 8pt 网格 / 宪法批准类型阶）——视觉质量机器化保障，不靠主观判断
- 像素级回归：`npm run verify:visual`（6 组截图基线 diff，基线人工锁定后生效）

## Agent 定制工作流（写入 AGENTS.md 的推荐路径）

1. 读 `/capabilities.json` 确认站点渲染能力（CAP-001）
2. 定制视觉：改主题变量（`theme: "custom.css"`）或内置主题 → `doclight dev` 预览
3. 结构定制：写插件（extendMarked/slotContent）→ `doclight dev` 预览
4. 跑 `npm run verify`（含 visual check）确认合规 → `doclight build` → `doclight publish`
