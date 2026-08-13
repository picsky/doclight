# DocLight 项目指南（Claude Code）

## 项目一句话

**DocLight 是一款服务于人阅读、同时 AI 原生友好的零构建开源文档站引擎。** 一个 `index.html` + `docs/` 文件夹 = 文档站；可选 SSG 静态导出修复 SEO；自带 llms.txt + MCP。

## 当前状态（2026-08-13，Phase 4 全部完成）

- **阶段**：Phase 1 ✅ + Phase 2 ✅（搜索 + 扩展语法渲染）+ **Phase 3 ✅ 全部完成**（SSG 最小闭环 + SEO 全套 + init/bundle/deploy/migrate CLI 全命令）+ **Phase 4 ✅ 全部完成**（读取端：LLMS-001 llms.txt + FRONT-001 语义 frontmatter + MCP-001/002/003 MCP Server；**内容空间写入端**：CLI-005 publish + CLI-006 space + doclight-publish Skill + `/publish` 命令 + Agent 接入指南；**遗留补强**：MCP-004 SSE 流式 + MCP-005 插件模式 + CLI-007 embed + SNAP-001 同构快照；**用户决策批次**：CONTRACT-001 契约扩展 + SEO-003 OG PNG 栅格化 + CLI-008 bundle 二维码 + CLI-009 bundle vendor 内联 + UX-001 体验细节；`npm run verify` 全绿，单测 **264/264** + e2e 54/54 + spec:check 30/30）；**下一步 = Phase 5 插件系统 + 生态**，见 08-roadmap 与 PHASE-4-complete / PHASE-4-content-space-complete / PHASE-4-leftovers-complete / PHASE-4-user-decisions-complete 交接
- **已完成（Phase 0 + 1 + 2 + 3 + 4）**：自迭代环境（verify 命令族/契约层/CI）+ **REND-001 渲染内核** + **NAV-001** + **DEV-001 dev server** + **展示层** + **TOC-001** + **THEME-001** + **PLUG-001/002** + **SRCH-001 搜索**（含 localStorage 持久化 + 版本哈希）+ **REND-002 扩展语法注册表** + **REND-003 Mermaid 容错** + **代码高亮+复制** + **自定义容器** + **KaTeX** + **REND-004 双读验证** + **SSG-001 `doclight build`** + **SSG-002 vendor 基址决策**（拷贝 dist/vendor 自包含）+ **PREVIEW-001 `doclight preview`** + **SEO-001 页面级 SEO**（canonical/OG/Twitter/JSON-LD/面包屑）+ **SEO-002 站点级 SEO**（sitemap/robots/OG 卡）+ **`--base` 子路径部署** + **CLI-001 `doclight init`** + **CLI-002 `doclight bundle`**（单文件 file:// 三引擎）+ **CLI-003 `doclight deploy`**（gh-pages + 平台指引）+ **CLI-004 `doclight migrate-docsify`** + 迁移指南 + **LLMS-001 llms.txt**（智能分级 + 语义 frontmatter 条目 + 全文分节）+ **FRONT-001 语义 frontmatter 自动计算**（summary/wordCount/readingTime/headings）+ **docs.json 增强**（结构化元数据）+ **MCP-001 六读取工具** + **MCP-002 stdio** + **MCP-003 HTTP+well-known 发现** + **CLI-005 `doclight publish`**（local bundle→file:// / git gh-pages→公网 URL / space 站点清单→端点 URL，`--json` 结构化输出、无伪造成功）+ **CLI-006 `doclight space`**（init/switch/status，`.doclight/space.json` 可插拔 provider）+ **doclight-publish Skill**（`.claude/skills/doclight-publish/`）+ **`/publish` 命令**（`.claude/commands/publish.md`）+ **Agent 接入指南**（`docs/agent-guide.md` 含魔法咒语，DocLight 自身构建=dogfood）+ **MCP-004 HTTP SSE 流式**（POST Accept: text/event-stream + GET /mcp 长连接）+ **MCP-005 插件模式**（`doclight dev --mcp` 同端口挂载，懒构建快照）+ **CLI-007 `doclight embed`**（snippet.js 自推导基址 + iframe 片段，分发四触点③）+ **SNAP-001 同构快照**（dev/SSG/bundle 三形态内容一致）+ **CONTRACT-001 doclight.json 契约扩展**（base/siteUrl/outputDir/build.llmsTxt 入 schema）+ **SEO-003 OG 卡片 PNG 栅格化**（@resvg/resvg-js 渲染 og/*.png，og:image 指向 PNG）+ **CLI-008 bundle 下载二维码**（`--qr <url>` 生成 bundle-qr.png）+ **CLI-009 bundle vendor 内联**（`--inline-vendor` opt-in，file:// 下扩展可用）+ **UX-001 体验细节**（专注模式 + 字号调节 + 打印样式 + Powered by 标记，localStorage 持久化）
- **体积门禁（ADR-0002 修订，构建已剥离注释）**：展示层 < 25KB gzip（实测 **8.1KB**，含 bundle/持久化逻辑）/ Node 内核 < 30KB（renderer 3.9KB + marked + dompurify 合计 **27.8KB**）
- **决策记录**：①搜索未引真实 MiniSearch，同形状 API 自研（构建工具链允许打包时可一处替换）；②**扩展内容承载铁律**：不依赖 `data-*` 属性，一律「class 标记 + 子元素/文本承载」；③vendor 按需服务：dev 从 node_modules、**SSG 拷贝进产物**（自包含 + 离线可用）、**bundle 不内联**（扩展自动降级 REND-003）；④构建产物 `removeComments`（双读注释保留 .ts 源码）；⑤SSG URL 约定 `.html`（renderer `linkSuffix`），dev 保持 `.md`，导航高亮归一两者；⑥SEO 由 `--site-url` 驱动（绝对 URL 前提），缺省零回归；⑦deploy 自动以 `/<repo>/` 为 base 构建项目页；⑧**llms-full.txt 分节契约** `## 路径：<path>`（MCP read_doc 数据源，双读友好）；⑨**MCP 零依赖实现协议**（spec 化 2025-06-18 子集，不引 SDK）；⑩**MCP 只服务产物站点 dist-site**（非源码 docs/）；⑪**publish 复用 build/bundle/deploy 单一事实来源**（CLI 是唯一事实来源，Skill/`/publish` 都是薄封装，不重复实现）；⑫**space 配置独立于 doclight.json**（`.doclight/space.json`，运行时状态不入契约 schema）；⑬**space 托管未开通不预填官方端点**（无端点 → 结构化引导，不伪造「已配好」）
- **遗留**：**云端 DocLight Space 托管**（publish --to space 完整落点，协议客户端就绪 + 引导路径，v1.0 后）；npm 包名注册与域名（待用户决策）
- **依赖清单**：@resvg/resvg-js（OG PNG 栅格化，CLI 构建期）+ qrcode（bundle 二维码，CLI 构建期）；均为构建期依赖，不影响运行时体积（展示层仍 <25KB gzip）
- **调研结论（2026-08-13，两版并排）**：`research-report-agent-content-opportunity.md`（机会 7.5/10）+ `research-report-agent-content-demand-validation.md`（批判 3/10）——扩展渲染是**引擎增量功能**，已随 Phase 2 落地闭环
- **交接详情**：`docs/agent-handoffs/PHASE-4-user-decisions-complete.md`（用户决策批次，换会话先读它）+ `PHASE-4-leftovers-complete.md`（遗留补强）+ `PHASE-4-content-space-complete.md`（内容空间写入端）+ `PHASE-4-complete.md`（读取端；Phase 3 见 PHASE-3-complete.md、SSG 最小闭环见 PHASE-3-ssg-complete.md、扩展渲染见 PHASE-2-extensions-complete.md、搜索见 PHASE-2-search-complete.md、Phase 1 见 PHASE-1-complete.md、Phase 0 见 PHASE-0-complete.md）
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
