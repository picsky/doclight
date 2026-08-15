# DESIGN-ALIGNMENT 交接 · 前端设计对齐宪法（2026-08-16）

> 任务：将本项目前端完全对齐 `docs/design-new/` 全新设计（演示页 1:1 复刻 +
> DESIGN.md 立为设计第一文档）。换会话先读本文件 + CLAUDE.md「当前状态」。

## 一句话总结

DocLight 的默认主题从旧 Luminous/teal 设计整体替换为**演示页（Aster）设计语言**
（暖调中性色 + 松绿 Pine 单一强调色 + 三栏 264/700/224 布局 + 演示页全组件与交互），
`docs/design-new/DESIGN.md` 正式立为**项目设计第一文档（宪法）**。

## 关键决策（与推荐一致，已执行）

| 决策 | 结论 |
|---|---|
| 令牌体系 | 全局替换为新令牌（--bg/--text/--accent 等），旧 --color-* 删除（宪法 §9.1 禁止新旧并存）；合规门禁同步迁移 |
| --text-3 微调 | 演示 #8b887f 仅 3.56:1，按宪法 AA 提级为 #6e6b62（亮）/ #9a968c（暗），色相不变——**全项目唯一对演示值的偏离**，已登记宪法变更记录 |
| 合规微调补登记（2026-08-16 复查） | 机器 css-diff 复查发现 7 处像素级偏离，方向全部 = 演示页自身违规 → 实现按宪法修正：①--syn-c 亮 #9b988d→#8a877c（2.5:1<3 提级）；②侧边栏/步骤/卡片/分页 6 处非 8pt 网格值（5.5/4.5/26/18/14px）按 §3.3 取整为 4 的倍数；③.modal 圆角 14px→10px（超 §3.3 两档圆角）。已补登记 DESIGN.md 变更记录；视觉差异 1-3px 级，40/40 断言不受影响 |
| TOC-002 擦洗条 | 被演示页目录（文本链接 + 滑动指示条 + 反馈卡）取代；17-toc-scrubber.md 存历史；移动端 FAB+sheet 保留 |
| 4 套内置主题 | 保留机制，全部基于新令牌重写（minimal=新默认显式包；serif 纸感衬线/靛蓝；modern 深色优先/violet；warm 暖橙），全过宪法门禁；玻璃卡片、>12px 圆角、卡片阴影等反模式移除 |
| 字体 | 默认引入 Google Fonts（Inter/JetBrains Mono/Source Serif 4，display=swap）+ 系统回退栈；离线自动降级 |
| 组件取舍 | back-to-top 移除（演示无）；powered-by 保留并融入新 footer（传播机制）；搜索「最近搜索」移除（演示无） |
| 图解 | sanitize 放行安全 SVG 子集（spike 注入断言：onload/script/a-in-svg/foreignObject 全清）；figure.diagram + d-* token 类可用 |
| 配置 | doclight.json 新增可选 version/github/footer（schema 只加不改；config.ts 宽松读取） |
| slides | 独立形态本次未重做，仅品牌一致性未动（视觉基线 slides 2 张重拍） |

## 改动文件地图

**页面模板与组装（packages/cli/src/）**
- `site.ts`：DEFAULT_THEME_CSS 整体替换为宪法令牌+组件 CSS（演示页 1:1）；renderPage 模板重写
  （topbar/sidebar/crumb+eyebrow+h1+lede+meta/next-grid/pager/toc+反馈卡/footer/搜索弹层/progress/skip）；
  新增 `articleBodyHtml`（**三形态共享组装**——SNAP-001 同构关键）、`stripFirstH1`/`firstH1Text`
  （页标题 = frontmatter.title ?? 正文首个 h1 ?? 文件名主干）、`extractToc`/`pagerFor`/`nextCardsFor`/
  `topGroups`/`sectionForPath`/`flattenNav`/`containsPath`；renderNav 输出 side-group/side-item 结构（li 包裹）；
  breadcrumbFor 根标签 首页→文档；buildSearchData 增 section（分组节标签）与 summaries（rel 路径键）；
  ogCardSvg 品牌色改松绿
- `build.ts` / `dev-server.ts` / `bundle.ts`：三形态传 nav/currentPath/summaries/chrome；标题回退 h1；
  updatedAt 同规则（date ?? mtime）；bundle 内嵌页 = articleBodyHtml 完整文章体
- `index.ts`：runDev/runBuild/runBundle 注入 chrome（cfg.version/github/footer）
- `config.ts`：version/github/footer 宽松读取
- `gallery.ts`：示例文档更新（含 :::tabs/:::steps/文件名头）+ 面板导航新结构 + 主题描述更新
- `themes/{minimal,serif,modern,warm}.css`：全新令牌 + 宪法合规组件规则
- `design-compliance.ts`：门禁迁移——text≥7(AAA)/text-2,3≥4.5/accent≥3/accent-ink≥4.5；
  code 色 --syn-* ≥3；徽标字形 → 语义状态色 ≥3；类型阶 = 宪法批准档位（非 1.25 链）
- `plugins-official/mermaid.ts`：样式令牌化（节点/连线/标注随主题）+ 错误提示去 emoji

**渲染内核（packages/renderer/src/）**
- `extensions/code.ts`：info string 解析 fname（` ```ts title="x.ts" ` / 裸文件名 / file=）；
  输出 codeblock/code-head（文件名+语言+复制按钮直出）
- `extensions/tabs.ts`（新）：:::tabs/:::tab 跨组联动（data-tab/data-panel=名即键）
- `extensions/steps.ts`（新）：:::steps → ol.steps + step-title（首段加粗提升，紧凑/松散列表兼容）
- `extensions/container.ts`：注入单色线性图标（宪法 §4.4 无彩色徽章）
- `extensions/registry.ts`：登记 tabs/steps
- `core/sanitize.ts`：放行安全 SVG 子集（SVG_TAGS/SVG_ATTRS 白名单 + svg 内 <a> 移除 hook）

**展示层（packages/display/src/）**
- `extensions.ts`：复制按钮改绑渲染直出 .copy-btn（✓已复制 1.6s 反馈）；锚点类名 .anchor
- `toc.ts`：重写为演示页目录（#tocList + #tocIndicator 滑动指示条 + IO 滚动监听 + 反馈联动）；
  擦洗条全删
- `search.ts`：改用服务端直出 #modalMask（result-item 图标+标题+分组节标签；全部文档初始列表；
  移除最近搜索）；检索内核不变
- `ux.ts`：#progress 2px 进度条 + #topbar.scrolled；back-to-top 移除；powered-by 保留
- `design.ts`（新）：CJK 发丝空隙（U+200A，SPA 重跑）、锚点闪烁 flash、tabs 跨组联动绑定、
  反馈卡绑定、macOS ⌘K 提示
- `theme.ts`：绑 #themeBtn + 太阳/月亮图标切换
- `router.ts`：topnav 联动高亮（data-topgroup ↔ 当前页所属分组）；面包屑特判移除（已内置于 article）
- `index.ts`：挂载 initDesign

**门禁与测试**
- `scripts/checks/visual.mjs`（注释更新）/ `smoke.mjs`（side-item/#tocList/#modalMask/.crumb 选择器）
- e2e：display.spec.ts（TOC/搜索/主题选择器全量更新）、bundle.spec.ts、extensions.spec.ts（复制按钮）
- 单测：design-compliance.test / themes.test / gallery.test / build.test / dev-server.test /
  isomorphic.test（含 normalize 支持 bundle hash crumb）、extension.test（+tabs/steps/fname/svg 白名单）、
  sanitize.test（svg 注入断言）、toc.test（去擦洗条）
- 视觉回归基线：**已全量重拍**（24 画廊 + 2 slides）

**文档**
- `docs/design-new/DESIGN.md`：追加变更记录（纳入 DocLight，--text-3 微调说明）
- `docs/tech-design/00-README.md` / `16-design-system.md`（宪法实现细则重写）/ `CLAUDE.md` /
  `AGENT.md`：当前状态 + 文档地图登记宪法
- `contracts/doclight.schema.json`：version/github/footer（只加不改）

## 新组件用法（写作端，AGENTS.md/capabilities 同步）

- 代码块文件名头：```` ```ts title="lib/a.ts" ````（或 `file=`/裸名）
- Tabs：`:::tabs` + `:::tab npm` … `:::` … `:::`（同名跨组联动，tab 名建议全站唯一）
- 步骤：`:::steps` + 有序列表，每项首段 `**加粗**` 提升为标题
- 图解：markdown 内嵌 `<figure class="diagram">…svg…<figcaption>`（d-box/d-edge/d-node-title 等 token 类随主题）

## 验证状态

`npm run verify`（build/lint/typecheck/test/size/contract/visual/e2e/smoke）全绿 + 单测 468 通过；
视觉回归基线重拍完成（26 张），并加 `document.fonts.ready` 等待（Google Fonts 加载时机导致的基线抖动已消除，
连续 3 轮 diff 稳定）。
1:1 对照（机器化，40/40 断言）：
- `node scripts/design-compare.mjs` —— 复刻演示页结构的临时站点构建 + 亮/暗/移动端截图
  （产物 artifacts/design-compare/*.png，供人工像素核对）
- `node scripts/design-assert.mjs` —— 令牌/布局/组件/交互计算样式与结构断言（HTTP 形态）
另：`scripts/regenerate-agents.mjs` —— 注册表变更后重生成根 AGENTS.md（CAP-001 dogfood）。

## 遗留与注意

- **slides** 演示形态仍为旧配色（独立设计系统），后续如需对齐宪法需单独一轮
- `docs/design-new/index.html` 保持原样（规范演示基准，不参与构建）
- `.design_library/`、`design-system-analysis.md`、`research/` 为历史资料，未随宪法迁移
- `04-reading-experience.md` / `11-default-themes.md` 中旧令牌描述仍引用 --color-*，后续规格回写时更新
  （本次已回写 00/16；03/04/11 为历史设计文档，实现以宪法+16 为准）
- 新组件语法（tabs/steps/文件名头/图解）已登记 capabilities 依赖的 registry，无需其他联动
