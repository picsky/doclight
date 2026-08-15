# DocLight 前端设计系统适配分析

> 基于项目文档、主题实现与设计合规代码的快速分析，回答「这个前端适合什么样的设计系统」。

---

## 1. 项目画像与前端约束

DocLight 是一个**零构建、AI 原生、开源的文档站引擎**，核心定位是「把 Markdown 变成作品」。前端的特殊性决定了设计系统必须轻量、可验证、主题化：

| 维度 | 关键约束 |
|---|---|
| 产物形态 | `dev` 实时预览 / `build` SSG 静态导出 / `bundle` 单文件离线包，三形态共享同一渲染内核 |
| 体积门禁 | 展示层 `< 25KB gzip`，运行时零依赖 |
| 用户角色 | Agent 是第一用户；人类读者是最终受众 |
| 内容类型 | 技术文档、教程、课程、产品文档、演示 slides |
| 多语言 | 中文长文阅读优先，中英混排质量是差异化重点 |
| 主题策略 | 4 套完整设计语言（Minimal / Serif / Modern / Warm），每套自带亮暗双主题 |
| 质量保障 | 机器化门禁：WCAG AA 对比度、8pt 网格、1.25 字号节奏、像素级视觉回归 |

这些约束意味着：设计系统不能是「重组件框架」，而必须是**以 CSS 变量为核心、可树摇、可自动断言**的轻量体系。

---

## 2. 适合的设计系统特征

基于上述约束，DocLight 前端适合的设计系统应满足以下 7 条：

### 2.1 内容优先（Content-First）
- 界面是「容器」而非「装饰」，读完文章后用户记住内容、记不住 UI。
- 单一强调色、零纯装饰元素、克制动效。

### 2.2 Token 驱动（Token-First）
- 三级令牌结构：原始令牌（Raw）→ 语义令牌（Semantic）→ 组件令牌（Component）。
- 主题 = 语义令牌覆盖层，零 JS、零结构改动即可换肤。
- 所有组件样式消费公开 token，不硬编码色值或间距。

### 2.3 轻量与可分发
- 每个主题是一个独立 CSS 文件（当前已实现 `packages/cli/src/themes/*.css`），单文件增量 ≤ 2KB gzip。
- 自定义主题只需覆盖想改的 token，学习成本极低。

### 2.4 机器可验证
- 对比度、8pt 网格、字号节奏全部通过纯函数断言（如 `design-compliance.ts`）。
- 视觉回归覆盖 4 主题 × 亮暗 × 3 断点 = 24 组截图基线。

### 2.5 Agent 友好
- 每个主题附带结构化 `theme.json`，字段语义明确。
- 组件清单、token 命名、定制入口对 Agent 可读可改。

### 2.6 中文排版专项
- 系统字体栈优先（PingFang SC / Microsoft YaHei / Noto Sans CJK SC），不依赖 Web Font。
- 16px × 1.75 行高、680px 行宽、段间距替代首行缩进、标题上留白 > 下留白。

### 2.7 无障碍与响应式
- WCAG AA 对比度、`focus-visible` 统一焦点环、`prefers-reduced-motion` 全禁用。
- 移动 / 平板 / 桌面三断点，触摸目标 ≥ 44px。

---

## 3. 与 DocLight 现有实现的对照

DocLight 已经高度贴合上述理想模型：

| 理想特征 | DocLight 现状 |
|---|---|
| 三级 token 体系 | `docs/tech-design/16-design-system.md` 已定义 Raw → Semantic → Component |
| 主题覆盖层 | `themes.ts` 实现「主题 = CSS 变量覆盖层」；4 套主题均为独立 CSS 文件 |
| 设计合规门禁 | `design-compliance.ts` 实现对比度 / 网格 / 字号节奏断言 |
| 中文排版 | `04-reading-experience.md` 定义字体栈、行高、行宽、混排策略 |
| 视觉语言 | `16-design-system.md §9` 提出「Luminous 光之容器」——亮色晨光纸感、暗色夜航辉光 |
| 组件规格 | `component-gallery.md` 列出代码块、表格、提示容器、搜索、TOC 等组件清单 |

结论：**DocLight 的设计系统方向已经成立，当前任务不是推翻重来，而是把它从「散落在文档与 CSS 中的规格」升级为「可复用、可验证、可 Agent 消费的正式设计系统」。**

---

## 4. 建议的结构化设计系统蓝图

如果要把 DocLight 的设计系统进一步产品化，建议按以下模块组织：

### 4.1 Token 架构

```
primitive/          # 原始值（只定义一次）
  colors.css        # 色阶 ramp：teal/violet/amber/indigo 等
  typography.css    # 字号 1.25 节奏、字重、行高
  spacing.css       # 4px 基准 / 8pt 网格
  radius.css        # 圆角阶梯
  shadow.css        # 阴影层级
  motion.css        # 缓动与时长

semantic/           # 语义层（主题唯一覆盖入口）
  light.css / dark.css
  # color-bg, color-text, color-primary, color-surface-elevated ...

component/          # 组件层（消费语义 token）
  topbar.css, sidebar.css, toc.css, search.css
  article.css, code.css, table.css, container.css
```

**建议补充的关键 token：**
-  elevation / surface：`--color-surface`, `--color-surface-elevated`
-  聚焦环统一：`--ring-color`, `--ring-width`
-  动效：`--ease-standard`, `--ease-out`, `--duration-fast/normal/slow`
-  代码专用链：`--code-bg`, `--code-text`, `--code-border`, `--code-token-*`

### 4.2 主题元数据 `theme.json`

```json
{
  "name": "modern",
  "description": "深色优先的科技文档风格",
  "defaultMode": "dark",
  "tokens": { "light": "./light.css", "dark": "./dark.css" },
  "components": { "glassPanels": true, "compactHeadings": true },
  "compliance": { "contrast": "AA", "grid": "8pt", "typeScale": 1.25 }
}
```

### 4.3 组件库（Component Library）

按内容载体与导航/交互两类划分：

| 内容组件 | 导航/交互组件 |
|---|---|
| 标题层级 `article h1..h4` | 顶栏 `topbar` |
| 正文排版 `article p` | 侧边栏 `sidebar` |
| 行内代码 / 代码块 | 目录 `toc-rail` / `toc-panel` |
| 表格 `.table-wrap table` | 搜索 `search-overlay` / `search-box` |
| 引用 `blockquote` | 阅读进度条 `reading-progress` |
| 提示容器 `doclight-container` | 回到顶部 `back-to-top` |
| KaTeX / Mermaid 扩展容器 | 面包屑、按钮、焦点环 |

### 4.4 动效语言

| 场景 | 时长 | 缓动 |
|---|---|---|
| hover / active 反馈 | 120–150ms | `cubic-bezier(0.2, 0, 0, 1)` |
| 面板 / 遮罩进出 | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| 页面切换淡入 | 150ms | ease-out |
| 主题切换颜色过渡 | 200ms | 颜色类 token 统一 transition |
| reduced-motion | 0ms | 全部禁用 |

### 4.5 无障碍层

- 对比度矩阵：正文 ≥ 4.5，大文本/UI ≥ 3，muted ≥ 3。
- 焦点环：`2px solid var(--ring-color)`，仅 `:focus-visible`。
- 键盘：搜索 `Cmd/Ctrl+K`、目录方向键、全局 `?` 快捷键。
- 触摸目标：移动端按钮 ≥ 44×44px。

### 4.6 工具链

- `design-compliance.ts` 扩展为 token linter（校验未使用 token、缺失 token、非法值）。
- 视觉回归基线：24 组截图，主题画廊页 `doclight preview --themes`。
- Theme gallery：同一示例文档渲染 4 主题 × 亮暗，便于 Agent/人快速对比。

---

## 5. 设计系统风格方向

建议延续并强化当前 **「Luminous 光之容器」** 方向：

- **亮色「晨光」**：微暖白纸 `#fdfdfc` + 柔和顶部光晕 + 单一 teal 强调，像清晨自然光洒在纸上。
- **暗色「夜航」**：深蓝黑 `#0a0e14` + 主色辉光 + 玻璃层次 + 星芒微粒，像夜间仪表盘的克制科技感。
- **设计原则**：克制为底、精致细节；界面隐形，但搜索、代码块、焦点、过渡等交互点经得起像素级审视。
- **气质参照**：Mintlify 的留白、Stripe 的信息层次、Linear 的暗色层次、Apple/语雀的中文排版。

---

## 6. 落地建议（下一步行动）

1. **把现有设计规格提取为正式 Design Library**：将 `04-reading-experience.md`、`11-default-themes.md`、`16-design-system.md` 中的 token 与组件规则落地为 `primitive / semantic / component` 三层 CSS + `theme.json`。
2. **补齐 elevation 与 motion token**：让玻璃拟态、卡片层级、动效全部走 token，不留硬编码。
3. **统一 theme.json schema**：让 4 套官方主题都附带机器可读元数据，Agent 能读能改。
4. **扩展 design-compliance 为 token linter**：不仅校验对比度/网格/字号，还校验「组件样式是否使用已定义 token」。
5. **产出《组件库与定制入口》设计文档**：面向 Agent 写清楚「改哪个 token 会改哪里」「哪个 class 对应哪个组件」。

---

## 7. 结论

DocLight 的前端**已经走在了正确的设计系统路线上**：轻量 token 驱动、内容优先、机器可验证、Agent 友好、中文排版专项。当前最需要的不是换一套新的设计系统，而是**把已有的规格和实现沉淀为一套可复用、可扩展、可自动验收的正式设计系统（Design Library）**，并继续围绕「Luminous」视觉语言打磨暗色模式与交互细节。
