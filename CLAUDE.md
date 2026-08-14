# DocLight 项目指南（Claude Code）

## 项目一句话

**DocLight 把 Markdown 变成作品。** Agent 写，DocLight 渲染成专业的文档与演示——无需构建、开箱即用、随时可定制。技术本质：零构建开源文档站引擎（一个 `index.html` + `docs/` 文件夹 = 文档站；可选 SSG 静态导出修复 SEO；自带 llms.txt + MCP），核心价值在**表现层**——内容质量是 Agent/人的领域，DocLight 负责把纯 Markdown 的视觉表现力拉到顶级。

## 当前状态（2026-08-13，Phase 5 插件生态全量完成 + PLUG-012/013/014 完成）

- **阶段**：Phase 1 ✅ + Phase 2 ✅（搜索 + 扩展语法渲染）+ **Phase 3 ✅ 全部完成**（SSG 最小闭环 + SEO 全套 + init/bundle/deploy/migrate CLI 全命令）+ **Phase 4 ✅ 全部完成**（读取端：LLMS-001 llms.txt + FRONT-001 语义 frontmatter + MCP-001/002/003 MCP Server；**内容空间写入端**：CLI-005 publish + CLI-006 space + doclight-publish Skill + `/publish` 命令 + Agent 接入指南；**遗留补强**：MCP-004 SSE 流式 + MCP-005 插件模式 + CLI-007 embed + SNAP-001 同构快照；**用户决策批次**：CONTRACT-001 契约扩展 + SEO-003 OG PNG 栅格化 + CLI-008 bundle 二维码 + CLI-009 bundle vendor 内联 + UX-001 体验细节）+ **Phase 5 ✅ 全部完成**（插件系统核心 PLUG-003/004/005/006/008/009 + **插件生态**：PLUG-006 接线修复（extendMarked 打通三形态）+ PLUG-007 官方插件 6 个（giscus/plausible/rss/pwa/ai-chat/mermaid）+ 插件加载器 + `doclight plugin new/list` 脚手架 + PLUG-010 onBuild 构建期文件产出 + THEME-002 主题包（minimal/warm + 自定义 CSS 文件）+ MIG-001/002 MkDocs/GitBook 迁移 + PLUG-011 插件热重载 + **PLUG-012 mermaid 迁移为官方插件**（PluginDef vendor/styles 声明 + 按需 vendor 三形态接线 + 默认降级为普通代码块）+ **PLUG-013 ESM/TS 插件加载**（Node 原生 require(esm) + type stripping 确认；异步 loadPluginsAsync/reloadConfiguredPluginsAsync 热重载：import + URL query 绕过模块缓存；TLA/低版本 Node 诚实降级）+ **PLUG-014 插件运行时配置自动注册**（构建时注入 window.DOCLIGHT_PLUGIN_CONFIGS + 页面脚本挂 DOCLIGHT_PLUGINS 定义表 + 展示层 registerConfiguredPlugins 自动接线 init/onMount；mermaid 双路径幂等兼容）+ 插件开发指南/主题生态/迁移指南文档；`npm run verify` 全绿，单测 **374/374（+1 vitest 环境跳过）** + e2e 浏览器矩阵 + spec:check 44/44）；**v1.0 收尾遗留全部完成（插件三件套）——剩余仅外部决策项（npm 包名/域名，云端托管用户已排除）**
- **已完成（Phase 0 + 1 + 2 + 3 + 4）**：自迭代环境（verify 命令族/契约层/CI）+ **REND-001 渲染内核** + **NAV-001** + **DEV-001 dev server** + **展示层** + **TOC-001** + **THEME-001** + **PLUG-001/002** + **SRCH-001 搜索**（含 localStorage 持久化 + 版本哈希）+ **REND-002 扩展语法注册表** + **REND-003 Mermaid 容错** + **代码高亮+复制** + **自定义容器** + **KaTeX** + **REND-004 双读验证** + **SSG-001 `doclight build`** + **SSG-002 vendor 基址决策**（拷贝 dist/vendor 自包含）+ **PREVIEW-001 `doclight preview`** + **SEO-001 页面级 SEO**（canonical/OG/Twitter/JSON-LD/面包屑）+ **SEO-002 站点级 SEO**（sitemap/robots/OG 卡）+ **`--base` 子路径部署** + **CLI-001 `doclight init`** + **CLI-002 `doclight bundle`**（单文件 file:// 三引擎）+ **CLI-003 `doclight deploy`**（gh-pages + 平台指引）+ **CLI-004 `doclight migrate-docsify`** + 迁移指南 + **LLMS-001 llms.txt**（智能分级 + 语义 frontmatter 条目 + 全文分节）+ **FRONT-001 语义 frontmatter 自动计算**（summary/wordCount/readingTime/headings）+ **docs.json 增强**（结构化元数据）+ **MCP-001 六读取工具** + **MCP-002 stdio** + **MCP-003 HTTP+well-known 发现** + **CLI-005 `doclight publish`**（local bundle→file:// / git gh-pages→公网 URL / space 站点清单→端点 URL，`--json` 结构化输出、无伪造成功）+ **CLI-006 `doclight space`**（init/switch/status，`.doclight/space.json` 可插拔 provider）+ **doclight-publish Skill**（`.claude/skills/doclight-publish/`）+ **`/publish` 命令**（`.claude/commands/publish.md`）+ **Agent 接入指南**（`docs/agent-guide.md` 含魔法咒语，DocLight 自身构建=dogfood）+ **MCP-004 HTTP SSE 流式**（POST Accept: text/event-stream + GET /mcp 长连接）+ **MCP-005 插件模式**（`doclight dev --mcp` 同端口挂载，懒构建快照）+ **CLI-007 `doclight embed`**（snippet.js 自推导基址 + iframe 片段，分发四触点③）+ **SNAP-001 同构快照**（dev/SSG/bundle 三形态内容一致）+ **CONTRACT-001 doclight.json 契约扩展**（base/siteUrl/outputDir/build.llmsTxt 入 schema）+ **SEO-003 OG 卡片 PNG 栅格化**（@resvg/resvg-js 渲染 og/*.png，og:image 指向 PNG）+ **CLI-008 bundle 下载二维码**（`--qr <url>` 生成 bundle-qr.png）+ **CLI-009 bundle vendor 内联**（`--inline-vendor` opt-in，file:// 下扩展可用）+ **UX-001 体验细节**（专注模式 + 字号调节 + 打印样式 + Powered by 标记，localStorage 持久化）
- **体积门禁（ADR-0002 修订，构建已剥离注释）**：展示层 < 25KB gzip（实测 **9.8KB**，含 bundle/持久化/插件管理器逻辑；PLUG-012 移除内置 mermaid 增强后进一步下降）/ Node 内核 < 30KB（renderer 3.9KB + marked + dompurify 合计 **27.8KB**）
- **决策记录**：①搜索未引真实 MiniSearch，同形状 API 自研（构建工具链允许打包时可一处替换）；②**扩展内容承载铁律**：不依赖 `data-*` 属性，一律「class 标记 + 子元素/文本承载」；③vendor 按需服务：dev 从 node_modules、**SSG 拷贝进产物**（自包含 + 离线可用）、**bundle 不内联**（扩展自动降级 REND-003）；④构建产物 `removeComments`（双读注释保留 .ts 源码）；⑤SSG URL 约定 `.html`（renderer `linkSuffix`），dev 保持 `.md`，导航高亮归一两者；⑥SEO 由 `--site-url` 驱动（绝对 URL 前提），缺省零回归；⑦deploy 自动以 `/<repo>/` 为 base 构建项目页；⑧**llms-full.txt 分节契约** `## 路径：<path>`（MCP read_doc 数据源，双读友好）；⑨**MCP 零依赖实现协议**（spec 化 2025-06-18 子集，不引 SDK）；⑩**MCP 只服务产物站点 dist-site**（非源码 docs/）；⑪**publish 复用 build/bundle/deploy 单一事实来源**（CLI 是唯一事实来源，Skill/`/publish` 都是薄封装，不重复实现）；⑫**space 配置独立于 doclight.json**（`.doclight/space.json`，运行时状态不入契约 schema）；⑬**space 托管未开通不预填官方端点**（无端点 → 结构化引导，不伪造「已配好」）
- **遗留（v1.0 收尾）**：~~plugin-mermaid 从内置迁移~~（**PLUG-012 ✅**）；~~ESM-only 插件包与 TS 插件文件加载~~（**PLUG-013 ✅**）；~~插件运行时配置自动注册~~（**PLUG-014 ✅**，见 PHASE-5-plugin-runtime-autoregister-complete）——**插件三件套全部完成**；~~云端 DocLight Space 托管~~（**用户已排除，不做**）；npm 包名注册与域名（待用户决策）
- **Phase 6 ✅ P0（2026-08-13）**：**CAP-001 能力协议**（capabilities.json 三形态一致 + MCP get_capabilities 工具 + AGENTS.md 生成与 dogfood）+ **AEO-001 发布产物 Agent 友好**（每页 .md 版本 + link rel=alternate/describedby + token 计数）；交接见 `docs/agent-handoffs/PHASE-6-p0-capabilities-aeo-complete.md`
- **Phase 6 ✅ P1·1（2026-08-13）**：**VIS-001 表现层设计系统化**——4 套设计语言兑现（minimal/serif/modern/warm，独立 CSS 文件 + 亮暗令牌 + 组件级特征；modern 默认暗色）+ 主题画廊（`build/preview --themes`，4×2 面板 + 内置示例文档）+ 设计合规门禁（verify 增 visual check：WCAG AA/8pt/1.25 机器断言）+ 像素级视觉回归（`verify:visual` 24 组基线 diff）+ 组件库文档（定制三入口）；交接见 `docs/agent-handoffs/PHASE-6-p1-vis-complete.md`
- **Phase 6 ✅ P1·2（2026-08-13）**：**WORK-001 预览-确认-发布**（publish 前自动快照 + `rollback` 回滚 + `publish --preview` 预览态 + TTY 确认门 + dev 增量渲染缓存）+ **MCP-006 写入端**（write_doc/update_doc/delete_doc，`--write-dir` 启停 + 路径安全 + dev --mcp 写入联动增量重渲染）；交接见 `docs/agent-handoffs/PHASE-6-p1-workflow-complete.md`
- **Phase 6 ✅ P2（2026-08-13）**：**DEMO-001 演示形态**——`doclight slides <file.md>`（markdown `---` 分页 + 布局指令 + 演讲者备注 → **自包含单文件**：演示设计系统 3 主题 + 壳层导航/全屏/备注视图，file:// 可开）+ doclight-slides Skill + 演示视觉回归门禁；交接见 `docs/agent-handoffs/PHASE-6-p2-slides-complete.md`
- **下一步**：**OSS-001 开源化**（LICENSE + README 重写 v3 定位 + npm 包名注册——npm 包名与域名待用户决策）——Phase 6 全部主线至此完成
- **依赖清单**：@resvg/resvg-js（OG PNG 栅格化，CLI 构建期）+ qrcode（bundle 二维码，CLI 构建期）；均为构建期依赖，不影响运行时体积（展示层仍 <25KB gzip）
- **调研结论（2026-08-13，两版并排）**：`research-report-agent-content-opportunity.md`（机会 7.5/10）+ `research-report-agent-content-demand-validation.md`（批判 3/10）——扩展渲染是**引擎增量功能**，已随 Phase 2 落地闭环
- **交接详情**：`docs/agent-handoffs/PHASE-5-remaining-complete.md`（插件生态全量，换会话先读它）+ `PHASE-5-mermaid-plugin-complete.md`（PLUG-012 mermaid 迁移）+ `PHASE-5-plugin-loader-esm-ts-complete.md`（PLUG-013 ESM/TS 插件加载）+ `PHASE-5-plugin-runtime-autoregister-complete.md`（PLUG-014 运行时配置自动注册）+ `PHASE-5-plugin-core-complete.md`（插件系统核心）+ `PHASE-4-user-decisions-complete.md`（用户决策批次）+ `PHASE-4-leftovers-complete.md`（遗留补强）+ `PHASE-4-content-space-complete.md`（内容空间写入端）+ `PHASE-4-complete.md`（读取端；Phase 3 见 PHASE-3-complete.md、SSG 最小闭环见 PHASE-3-ssg-complete.md、扩展渲染见 PHASE-2-extensions-complete.md、搜索见 PHASE-2-search-complete.md、Phase 1 见 PHASE-1-complete.md、Phase 0 见 PHASE-0-complete.md）
- **开工前**：先跑 `npm run verify` 确认从全绿基线出发（现含 e2e，需本机/CI 已装 Playwright 浏览器）

## 最高原则（决定一切决策）

**原则零：Agent-First。** 本项目主要由 Code Agent 自主开发，几乎没有人手搓代码。任何设计决策先问「Agent 能否理解、使用、修改它」，再问「人是否方便」。覆盖两个维度：使用端（消费文档站的 Agent）+ 开发端（开发本项目的 Agent）。

## 文档地图（docs/tech-design/）

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
| **11-default-themes** | 4 套默认模板设计规格 |
| **12-development-standards** | 开发规范总纲（代码/流程/PR/开源协作/Agent 专属） |
| **13-deployment-distribution** | 部署与分发（使用场景、一键部署、分发四触点、传播机制） |
| **14-agent-content-space** | **核心应用场景**：Agent 内容空间（一句话接入、Agent 自动发布、Space 可插拔） |
| **15-development-process** | 任务驱动开发流程（目标声明、对齐点 A/B/C、拆解、沉淀） |

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
