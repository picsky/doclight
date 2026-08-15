# DocLight 项目指南（Claude Code）

## 项目一句话

**DocLight 把 Markdown 变成作品。** Agent 写，DocLight 渲染成专业的文档与演示——无需构建、开箱即用、随时可定制。技术本质：零构建开源文档站引擎（一个 `index.html` + `docs/` 文件夹 = 文档站；可选 SSG 静态导出修复 SEO；自带 llms.txt + MCP），核心价值在**表现层**——内容质量是 Agent/人的领域，DocLight 负责把纯 Markdown 的视觉表现力拉到顶级。

## 当前状态（2026-08-16，设计对齐宪法完成 + Phase 7 设计精修进行中 + Phase 5 插件生态全量完成 + PLUG-012/013/014 完成）

- **Phase 7 ✅ 计划批准 + DP-001/002/003/004 完成（DESIGN-POLISH，2026-08-16）**：用户决策——**只做一套主题，把一套做好做精**；其余优化方向全部通过。规格 `docs/tech-design/18-design-polish.md`：DP-001 单主题收敛 ✅（serif/modern/warm 完全退役：文件删除 + RETIRED_THEMES 警告降级默认 + 画廊/门禁/视觉基线收敛 24→6 张；自定义 CSS 主题机制保留；交接 `docs/agent-handoffs/PHASE-7-dp001-theme-consolidation-complete.md`）+ **DP-002 品牌层 ✅**（icon 标志 favicon 三形态一致 / 首页 hero `article.home` 节奏分离 / 404 设计页三形态（dev 动态 + build 产物 404.html + preview 回退）/ 签名时刻=阅读进度收尾脉冲（用户三选一确认）；交接 `docs/agent-handoffs/PHASE-7-dp002-brand-complete.md`）+ **DP-003 阅读状态感 ✅**（阅读位置持久化 + 继续阅读 pill / TOC 已读标记 / `<time>` 相对时间 + 侧边栏最近更新徽标 / 完成度一行文字；展示层 15.08KB gzip；浏览器实测 5/5；交接 `docs/agent-handoffs/PHASE-7-dp003-reading-state-complete.md`）+ **DP-004 内容纵深 ✅**（h4-h6 层级补全 / 超长代码块渐进展开 / 长表 sticky 表头 / 暗色图片降亮度 / 引用-callout 分工；展示层 15.40KB gzip；交接 `docs/agent-handoffs/PHASE-7-dp004-content-depth-complete.md`）→ DP-005 导航智能（进行中）→ DP-006 动效工艺 → DP-007 AI 原生身份；红线 = 宪法反模式零容忍 + 展示层体积门禁 + 三形态同构 + 无 JS 降级。执行顺序：第一轮 DP-001→002→003，第二轮 DP-004→005→006，第三轮 DP-007。

- **设计对齐（DESIGN-ALIGNMENT，2026-08-16）**：前端整体对齐 docs/design-new/ 全新设计——**演示页 1:1 复刻为默认主题**（令牌/布局/组件/交互/暗色全对齐）；**DESIGN.md 立为项目设计第一文档（宪法）**。令牌体系全局替换（--bg/--text-2/--accent 松绿 Pine 等，宪法 §9.1 禁止新旧并存）；sanitize 放行安全 SVG 子集（图解组件，spike 注入断言）；新渲染扩展（:::tabs 跨组联动 / :::steps / 代码块文件名头 title=）；展示层新行为（CJK 发丝空隙、锚点闪烁、反馈卡、topnav 联动、演示页搜索弹层与目录指示条）；TOC-002 擦洗条被演示页目录取代（17 文档存历史）；4 套内置主题基于新令牌重写（全过宪法门禁：正文 ≥7 AAA / 批准类型阶）；doclight.json 新增 version/github/footer（schema 只加不改）；三形态同构 articleBodyHtml 共享组装（SNAP-001 保持）；唯一合规微调：--text-3 按宪法 AA 提级（色相不变）。交接见 `docs/agent-handoffs/DESIGN-ALIGNMENT-COMPLETE.md`

- **阶段**：Phase 1 ✅ + Phase 2 ✅（搜索 + 扩展语法渲染）+ **Phase 3 ✅ 全部完成**（SSG 最小闭环 + SEO 全套 + init/bundle/deploy/migrate CLI 全命令）+ **Phase 4 ✅ 全部完成**（读取端：LLMS-001 llms.txt + FRONT-001 语义 frontmatter + MCP-001/002/003 MCP Server；**内容空间写入端**：CLI-005 publish + CLI-006 space + doclight-publish Skill + `/publish` 命令 + Agent 接入指南；**遗留补强**：MCP-004 SSE 流式 + MCP-005 插件模式 + CLI-007 embed + SNAP-001 同构快照；**用户决策批次**：CONTRACT-001 契约扩展 + SEO-003 OG PNG 栅格化 + CLI-008 bundle 二维码 + CLI-009 bundle vendor 内联 + UX-001 体验细节）+ **Phase 5 ✅ 全部完成**（插件系统核心 PLUG-003/004/005/006/008/009 + **插件生态**：PLUG-006 接线修复（extendMarked 打通三形态）+ PLUG-007 官方插件 6 个（giscus/plausible/rss/pwa/ai-chat/mermaid）+ 插件加载器 + `doclight plugin new/list` 脚手架 + PLUG-010 onBuild 构建期文件产出 + THEME-002 主题包（minimal/warm + 自定义 CSS 文件）+ MIG-001/002 MkDocs/GitBook 迁移 + PLUG-011 插件热重载 + **PLUG-012 mermaid 迁移为官方插件**（PluginDef vendor/styles 声明 + 按需 vendor 三形态接线 + 默认降级为普通代码块）+ **PLUG-013 ESM/TS 插件加载**（Node 原生 require(esm) + type stripping 确认；异步 loadPluginsAsync/reloadConfiguredPluginsAsync 热重载：import + URL query 绕过模块缓存；TLA/低版本 Node 诚实降级）+ **PLUG-014 插件运行时配置自动注册**（构建时注入 window.DOCLIGHT_PLUGIN_CONFIGS + 页面脚本挂 DOCLIGHT_PLUGINS 定义表 + 展示层 registerConfiguredPlugins 自动接线 init/onMount；mermaid 双路径幂等兼容）+ 插件开发指南/主题生态/迁移指南文档；`npm run verify` 全绿，单测 **374/374（+1 vitest 环境跳过）** + e2e 浏览器矩阵 + spec:check 44/44）；**v1.0 收尾遗留全部完成（插件三件套）——剩余仅外部决策项（npm 包名/域名，云端托管用户已排除）**
- **已完成（Phase 0 + 1 + 2 + 3 + 4）**：自迭代环境（verify 命令族/契约层/CI）+ **REND-001 渲染内核** + **NAV-001** + **DEV-001 dev server** + **展示层** + **TOC-001** + **THEME-001** + **PLUG-001/002** + **SRCH-001 搜索**（含 localStorage 持久化 + 版本哈希）+ **REND-002 扩展语法注册表** + **REND-003 Mermaid 容错** + **代码高亮+复制** + **自定义容器** + **KaTeX** + **REND-004 双读验证** + **SSG-001 `doclight build`** + **SSG-002 vendor 基址决策**（拷贝 dist/vendor 自包含）+ **PREVIEW-001 `doclight preview`** + **SEO-001 页面级 SEO**（canonical/OG/Twitter/JSON-LD/面包屑）+ **SEO-002 站点级 SEO**（sitemap/robots/OG 卡）+ **`--base` 子路径部署** + **CLI-001 `doclight init`** + **CLI-002 `doclight bundle`**（单文件 file:// 三引擎）+ **CLI-003 `doclight deploy`**（gh-pages + 平台指引）+ **CLI-004 `doclight migrate-docsify`** + 迁移指南 + **LLMS-001 llms.txt**（智能分级 + 语义 frontmatter 条目 + 全文分节）+ **FRONT-001 语义 frontmatter 自动计算**（summary/wordCount/readingTime/headings）+ **docs.json 增强**（结构化元数据）+ **MCP-001 六读取工具** + **MCP-002 stdio** + **MCP-003 HTTP+well-known 发现** + **CLI-005 `doclight publish`**（local bundle→file:// / git gh-pages→公网 URL / space 站点清单→端点 URL，`--json` 结构化输出、无伪造成功）+ **CLI-006 `doclight space`**（init/switch/status，`.doclight/space.json` 可插拔 provider）+ **doclight-publish Skill**（`.claude/skills/doclight-publish/`）+ **`/publish` 命令**（`.claude/commands/publish.md`）+ **Agent 接入指南**（`docs/agent-guide.md` 含魔法咒语，DocLight 自身构建=dogfood）+ **MCP-004 HTTP SSE 流式**（POST Accept: text/event-stream + GET /mcp 长连接）+ **MCP-005 插件模式**（`doclight dev --mcp` 同端口挂载，懒构建快照）+ **CLI-007 `doclight embed`**（snippet.js 自推导基址 + iframe 片段，分发四触点③）+ **SNAP-001 同构快照**（dev/SSG/bundle 三形态内容一致）+ **CONTRACT-001 doclight.json 契约扩展**（base/siteUrl/outputDir/build.llmsTxt 入 schema）+ **SEO-003 OG 卡片 PNG 栅格化**（@resvg/resvg-js 渲染 og/*.png，og:image 指向 PNG）+ **CLI-008 bundle 下载二维码**（`--qr <url>` 生成 bundle-qr.png）+ **CLI-009 bundle vendor 内联**（`--inline-vendor` opt-in，file:// 下扩展可用）+ **UX-001 体验细节**（专注模式 + 字号调节 + 打印样式 + Powered by 标记，localStorage 持久化）
- **体积门禁（ADR-0002 修订，构建已剥离注释）**：展示层 < 25KB gzip（实测 **12.2KB**，含 bundle/持久化/插件管理器逻辑 + 2026-08 a11y/路由修复增量）/ Node 内核 < 30KB（renderer 3.9KB + marked + dompurify 合计 **27.8KB**）
- **决策记录**：①搜索未引真实 MiniSearch，同形状 API 自研（构建工具链允许打包时可一处替换）；②**扩展内容承载铁律**：不依赖 `data-*` 属性，一律「class 标记 + 子元素/文本承载」；③vendor 按需服务：dev 从 node_modules、**SSG 拷贝进产物**（自包含 + 离线可用）、**bundle 不内联**（扩展自动降级 REND-003）；④构建产物 `removeComments`（双读注释保留 .ts 源码）；⑤SSG URL 约定 `.html`（renderer `linkSuffix`），dev 保持 `.md`，导航高亮归一两者；⑥SEO 由 `--site-url` 驱动（绝对 URL 前提），缺省零回归；⑦deploy 自动以 `/<repo>/` 为 base 构建项目页；⑧**llms-full.txt 分节契约** `## 路径：<path>`（MCP read_doc 数据源，双读友好）；⑨**MCP 零依赖实现协议**（spec 化 2025-06-18 子集，不引 SDK）；⑩**MCP 只服务产物站点 dist-site**（非源码 docs/）；⑪**publish 复用 build/bundle/deploy 单一事实来源**（CLI 是唯一事实来源，Skill/`/publish` 都是薄封装，不重复实现）；⑫**space 配置独立于 doclight.json**（`.doclight/space.json`，运行时状态不入契约 schema）；⑬**space 托管未开通不预填官方端点**（无端点 → 结构化引导，不伪造「已配好」）
- **遗留（v1.0 收尾）**：~~plugin-mermaid 从内置迁移~~（**PLUG-012 ✅**）；~~ESM-only 插件包与 TS 插件文件加载~~（**PLUG-013 ✅**）；~~插件运行时配置自动注册~~（**PLUG-014 ✅**，见 PHASE-5-plugin-runtime-autoregister-complete）——**插件三件套全部完成**；~~云端 DocLight Space 托管~~（**用户已排除，不做**）；npm 包名注册与域名（待用户决策）
- **Phase 6 ✅ P0（2026-08-13）**：**CAP-001 能力协议**（capabilities.json 三形态一致 + MCP get_capabilities 工具 + AGENTS.md 生成与 dogfood）+ **AEO-001 发布产物 Agent 友好**（每页 .md 版本 + link rel=alternate/describedby + token 计数）；交接见 `docs/agent-handoffs/PHASE-6-p0-capabilities-aeo-complete.md`
- **Phase 6 ✅ P1·1（2026-08-13）**：**VIS-001 表现层设计系统化**——4 套设计语言兑现（minimal/serif/modern/warm，独立 CSS 文件 + 亮暗令牌 + 组件级特征；modern 默认暗色）+ 主题画廊（`build/preview --themes`，4×2 面板 + 内置示例文档）+ 设计合规门禁（verify 增 visual check：WCAG AA/8pt/1.25 机器断言）+ 像素级视觉回归（`verify:visual` 24 组基线 diff）+ 组件库文档（定制三入口）；交接见 `docs/agent-handoffs/PHASE-6-p1-vis-complete.md`
- **Phase 6 ✅ P1·2（2026-08-13）**：**WORK-001 预览-确认-发布**（publish 前自动快照 + `rollback` 回滚 + `publish --preview` 预览态 + TTY 确认门 + dev 增量渲染缓存）+ **MCP-006 写入端**（write_doc/update_doc/delete_doc，`--write-dir` 启停 + 路径安全 + dev --mcp 写入联动增量重渲染）；交接见 `docs/agent-handoffs/PHASE-6-p1-workflow-complete.md`
- **Phase 6 ✅ P2（2026-08-13）**：**DEMO-001 演示形态**——`doclight slides <file.md>`（markdown `---` 分页 + 布局指令 + 演讲者备注 → **自包含单文件**：演示设计系统 3 主题 + 壳层导航/全屏/备注视图，file:// 可开）+ doclight-slides Skill + 演示视觉回归门禁；交接见 `docs/agent-handoffs/PHASE-6-p2-slides-complete.md`
- **Phase 6 ✅ OSS-001 开源化（2026-08-13）**：LICENSE（MIT，用户确认）+ README 重写（v3 定位）+ **npm 命名落地**（主包 `doclight` + `@doclight/{renderer,core,display,mcp-server}`，全仓引用刷新）+ 各包 license/publishConfig 就绪 + CONTRIBUTING 更新；交接见 `docs/agent-handoffs/PHASE-6-oss-complete.md`
- **Phase 6 ✅ VIS-002 设计系统（2026-08-14）**：表现层系统化设计（用户确认方向：克制为底+精致细节/系统字体+字体插件/Minimal 打样→4 套全量/克制动效）——令牌三级体系（--space-5/10、--tracking-*、--ease-*、--shadow-lg/xl、--ring-color）+ 中文排版专项（tabular-nums/optimizeLegibility）+ 组件层（搜索面板毛玻璃+进场动画、代码块语言标签 JS 注入、提示容器 CSS 图标 ✓/ℹ/!/✕ 纯 class 承载、阅读进度条、回到顶部、SPA 页面进场淡入）+ 4 套主题适配新组件（Serif 纸感/Modern 玻璃/Warm 卡片）+ 无障碍（skip-link、抽屉 aria-expanded、Esc 关闭、触摸反馈、safe-area）+ slides 容器图标；规格 `docs/tech-design/16-design-system.md`；**顺带修复展示层两个潜伏致命 bug**（winGlobal 重复声明 + PluginManager TDZ——单文件拼接产物顶层冲突/初始化时序，展示层 JS 此前从未在浏览器执行）+ **发现 e2e 门禁假绿**（e2e.mjs 不查退出码只读残留报告；Node 26 移除 transform-types 致 Playwright 转译 TS 依赖链失败，修复依赖 OSS-001 JS 构建管线）；交接见 `docs/agent-handoffs/PHASE-6-vis002-design-system-complete.md`
- **Phase 6 ✅ P3 前端全量审查与修复（2026-08-15）**：系统审查（4 路并行 + 真实浏览器实测）后 A+B 全量落地——**门禁加固**（report.mjs 0 用例即 fail + e2e 校验退出码/清残留 + 视觉回归产物缺失即 fail + verify:visual 前置产物构建 + **新增 smoke 冒烟 check**：真实浏览器加载 CLI 现构建产物断言展示层挂载/head 结构/导航标题/搜索/SPA+面包屑）；**CLI 构建管线落地**（OSS-001 遗留：`scripts/build-cli.mjs` esbuild → `packages/cli/dist/cli.mjs` 自包含产物 + bin；dist-site 重建）；**P1 修复**（head 插槽 span→template 修复 SEO 元数据落 body、导航传 frontmatter 标题三入口、焦点环 token 统一、`--color-link` 正文链接 AA 4.5、插件 onRouteChange 契约接入 beforeEach、SPA 滚顶/修饰键放行/base 注入/首页高亮/fetch 降级/面包屑同步、移动端 44px 触控与离屏聚焦、TOC 指示点死代码清理、active 光晕恢复、动效令牌贯通）；**展示层 a11y**（搜索焦点陷阱/aria-modal/焦点还原/aria-live、aria-current、reduced-motion、ResizeObserver 守卫、mount 幂等）；**主题对比度收口**（warm/modern/serif/minimal 链接色、muted、代码 token 色全部过 AA；warm/modern 代码 token 坍缩展开）；**合规门禁扩展**（link ≥4.5、code-token ≥3、徽标字形 ≥3、muted 提级 4.5）；**双读锚点一致**（headingPlainText 统一渲染内核与大纲分析 slug 输入，REND-004）+ landmark 语义（站点导航 nav + toc aria-label）+ data-path 转义 + 主题按钮 aria-pressed + GFM 任务列表样式 + **SSG 产物 file:// 降级适配**（双击打开时跳过展示层、站内链接转相对整页跳转；离线完整体验用 `doclight bundle`）；**设计库对齐**（README 定位声明+对照表、[data-theme="dark"] 别名、css.json 修正）；**规格回写**（04/03/11/16 与实现一致）；交接见 `docs/agent-handoffs/PHASE-6-p3-frontend-audit-fix-complete.md`
- **Phase 6 ✅ TOC-002 章节擦洗条（2026-08-15）**：本页目录从常驻文字面板演进为**章节擦洗条**（用户确认，Calm Technology「让内容发光，让界面退后」落地）——默认形态 = 沿正文右缘的条形/刻度阵列（每条 = 一个章节，安静驻留 opacity 0.5）；短 hover 即时拉长（CSS）、长 hover 500ms 浮出标题气泡、滚动点亮当前章节、轨道端点「展开」按钮 ↔ 文字面板互斥；键盘 roving tabindex + 焦点揭示（等价长 hover）；4 套主题变体（Minimal/Warm = Bar 横条、Serif/Modern = Tick 竖刻度）；移动端 FAB+sheet 保留；规格 `docs/tech-design/17-toc-scrubber.md`（03 §3.7 回写 + 09 术语登记 + 16 组件规格更新）；验证：verify 8/8 + 展示层 13.3KB gzip + 浏览器实测 20/20（hover 时序/键盘/展开互斥/移动端）；交接见 `docs/agent-handoffs/TOC-002-scrubber-complete.md`
- **下一步（外部决策项）**：npm 包名注册与首次发布（需用户 npm 账号；CLI 构建管线已就绪——`npm run build` 产出 dist/cli.mjs + bin）；域名；云端 Space 托管（用户已排除）——**v1.0 代码面全部完成**
- **依赖清单**：@resvg/resvg-js（OG PNG 栅格化，CLI 构建期）+ qrcode（bundle 二维码，CLI 构建期）+ jsdom（CLI 运行时，经 renderer）；均为构建期/运行时必要依赖，不影响展示层体积（仍 <25KB gzip）；esbuild 为根 devDependency（CLI 构建管线）
- **调研结论（2026-08-13，两版并排）**：`research-report-agent-content-opportunity.md`（机会 7.5/10）+ `research-report-agent-content-demand-validation.md`（批判 3/10）——扩展渲染是**引擎增量功能**，已随 Phase 2 落地闭环
- **交接详情**：`docs/agent-handoffs/PHASE-5-remaining-complete.md`（插件生态全量，换会话先读它）+ `PHASE-5-mermaid-plugin-complete.md`（PLUG-012 mermaid 迁移）+ `PHASE-5-plugin-loader-esm-ts-complete.md`（PLUG-013 ESM/TS 插件加载）+ `PHASE-5-plugin-runtime-autoregister-complete.md`（PLUG-014 运行时配置自动注册）+ `PHASE-5-plugin-core-complete.md`（插件系统核心）+ `PHASE-4-user-decisions-complete.md`（用户决策批次）+ `PHASE-4-leftovers-complete.md`（遗留补强）+ `PHASE-4-content-space-complete.md`（内容空间写入端）+ `PHASE-4-complete.md`（读取端；Phase 3 见 PHASE-3-complete.md、SSG 最小闭环见 PHASE-3-ssg-complete.md、扩展渲染见 PHASE-2-extensions-complete.md、搜索见 PHASE-2-search-complete.md、Phase 1 见 PHASE-1-complete.md、Phase 0 见 PHASE-0-complete.md）
- **开工前**：先跑 `npm run verify` 确认从全绿基线出发（现含 e2e，需本机/CI 已装 Playwright 浏览器）

## 最高原则（决定一切决策）

**原则零：Agent-First。** 本项目主要由 Code Agent 自主开发，几乎没有人手搓代码。任何设计决策先问「Agent 能否理解、使用、修改它」，再问「人是否方便」。覆盖两个维度：使用端（消费文档站的 Agent）+ 开发端（开发本项目的 Agent）。

## 文档地图（docs/tech-design/）

> **设计第一文档（宪法）**：`docs/design-new/DESIGN.md`（2026-08-16 立宪，视觉/交互最高准则）；
> 演示基准 `docs/design-new/index.html`（1:1 复刻）。实现细则见 16-design-system。

| 文档 | 内容 |
|---|---|
| 00-README | 方案总览、设计哲学、关键数字 |
| 01-product-positioning | 定位、原则零 Agent-First、默认模板策略 |
| 02-architecture | 双层架构（运行时 + CLI）、技术选型、体积预算 |
| 03-runtime-engine | 路由 / Markdown / 导航 / 搜索 / 主题 |
| 04-reading-experience | 中文排版系统、视觉语言、无障碍 |
| 05-ssg-build | SSG 静态导出、SEO、CLI |
| 06-ai-native | 双五层模型（使用端 + 开发端）、MCP |
| 07-plugin-system | 钩子 / 插槽 / 主题系统 |
| 08-roadmap | Phase 0-5 里程碑（Phase 0 = Agent 自迭代环境） |
| 09-appendix | 竞品对比、调研依据、术语表 |
| **10-agent-dev-environment** | 目标/验证/反馈/闭环/契约 五层自迭代环境规格 |
| **11-default-themes** | 默认模板设计规格（**历史存档**：多套主题时代；DP-001 单主题收敛后以宪法+18 为准） |
| **12-development-standards** | 开发规范总纲（代码/流程/PR/开源协作/Agent 专属） |
| **13-deployment-distribution** | 部署与分发（使用场景、一键部署、分发四触点、传播机制） |
| **14-agent-content-space** | **核心应用场景**：Agent 内容空间（一句话接入、Agent 自动发布、Space 可插拔） |
| **15-development-process** | 任务驱动开发流程（目标声明、对齐点 A/B/C、拆解、沉淀） |
| **16-design-system** | 设计系统规格（令牌三级/字体/组件/无障碍，VIS-002） |
| **17-toc-scrubber** | 章节擦洗条规格（TOC-002：安静驻留、hover 渐进披露、主题变体） |
| **18-design-polish** | **Phase 7 设计精修计划（DESIGN-POLISH，2026-08-16 用户批准）**：单主题收敛（DP-001 退役 serif/modern/warm）+ 品牌层/阅读状态/内容纵深/导航智能/动效工艺/AI 原生身份（DP-002~007） |

## 工作约定

- **中文写作**：文档、注释、PR 描述用中文；代码标识符用英文
- **追溯**：任务引用需求 ID（如 `SRCH-001`），提交引用设计文档，保持 调研→设计→实现 链路
- **先验证后设计**：涉及技术可行性（如 `file://` 读取、浏览器限制）必须先做 spike 验证，再写进方案
- **双读友好**：任何规范/文档/错误输出，Agent 和人要都能消费（结构化 + 可读）
- **不发明术语**：遵循 `09-appendix` 术语表；新增术语须登记
- **改动先看文档**：动手前先读相关 design 文档，遵循既有设计，不另起炉灶
- **阶段完成必交接**：完成一个阶段/里程碑后，**必须**同步更新本文档与 AGENT.md 的「当前状态」（阶段/已完成/下一步），并在 `docs/agent-handoffs/` 写交接文档（格式见该目录）；不交接 = 任务未完成（15 文档 §6.2，contract 门禁校验）
- **Agent Reach 工具约束**：进行外部调研时，**禁止使用 WebSearch/WebFetch**，仅使用项目定义的 Agent Reach 通道（Exa、Jina Reader、GitHub CLI、OpenCLI 等）。该约束应写入任何相关 workflow 的 meta/指令中并严格执行。

## 常用命令

```bash
npm run verify          # 一条命令跑全部验证（build→lint→typecheck→test→size→contract）
npm run verify:lint     # ESLint 零 error
npm run verify:test     # Vitest 单测
npm run verify:size     # 体积预算门禁（展示层 < 25KB gzip）
npm run verify:contract # 契约校验
npm run review          # 评审 Agent（契约占位）
npm run spec:check      # 需求 ID 可追溯检查
```

所有 check 双格式输出：终端摘要 + `artifacts/reports/<check>.json`（机器可读，Agent 据此自修）。

## 风险提示（务必牢记）

- **file:// 死穴已解决**：三形态架构（渲染收敛 Node + bundle 内嵌）已在 Chromium/Firefox/WebKit 实测通过；不再依赖浏览器动态读取本地文件
- 展示层 < 25KB gzip / Node 内核 < 30KB（ADR-0002 修订）是硬门禁：**加依赖是最高危操作**（见 12 文档 1.4）
- XSS 必须 DOMPurify sanitize（marked 默认不消毒，已实测）
- 视觉质量靠机器化保障（视觉回归 + 设计合规），不靠主观判断
