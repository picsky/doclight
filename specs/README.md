# specs/ — 行为规格目录（目标层）

> 对应设计：[10-agent-dev-environment §1](../docs/tech-design/10-agent-dev-environment.md)（目标层 Spec）
> 状态：Phase 0 建目录与约定；具体规格随 Phase 1-4 落地

## 为什么存在

规格是「做什么 + 怎么验收」的机器可读载体。每个需求以 **RFC 式规格文档 + Gherkin 行为规格** 双形态存在，让开发 Agent 明确知道「什么算做完」，验收准则可被自动化测试直接消费。

## Phase 2 扩展语法渲染（REND-002/003/004，2026-08-13 已落地）

> 调研结论：扩展语法渲染是 DocLight 差异化核心（Agent 原生能力，08-roadmap Phase 2 优先级 + research-report §6.3 MVP）。
> 落地形态：`specs/features/render-ext.feature` + `packages/renderer/src/extensions/`（注册表/容器/代码块/KaTeX 标记）+ `packages/display/src/extensions.ts`（懒加载增强）+ `packages/cli/src/dev-server.ts`（vendor 端点与样式）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| REND-002 | 扩展语法注册表 | 白名单式（类型 / DOMPurify sanitize / 懒加载映射 / 降级策略），不引入 MDX/JSX | 已实现 |
| REND-003 | Mermaid 容错渲染 | LLM 生成语法错误→降级为图表源码+提示，不白屏 | 已实现 |
| REND-004 | 双读友好验证 | 扩展渲染后 llms.txt/MCP 仍返回纯 markdown 原稿 | 已实现 |

## Phase 3 剩余完成（SEO + init + bundle + deploy + 迁移，2026-08-13 已落地）

> 延续 PHASE-3-ssg-complete 交接：SSG 最小闭环（SSG-001/002 + PREVIEW-001）之后补齐 SEO 全套、
> 完整 CLI 命令族与迁移工具。对应 05-ssg-build §5.2.1/§5.4/§5.5 + 13-deployment-distribution §2.1 + 08-roadmap Phase 3。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| SEO-001 | 页面级 SEO meta | canonical / OG / Twitter Card / JSON-LD TechArticle / 面包屑（含 BreadcrumbList） | 已实现 |
| SEO-002 | 站点级 SEO 文件 | sitemap.xml + robots.txt + 每页 OG 卡片图（og/*.svg，Node 侧生成） | 已实现 |
| CLI-001 | doclight init | 生成 doclight.json + 示例 docs/ + index.html，幂等 | 已实现 |
| CLI-002 | doclight bundle | 单文件便携包：内嵌 pages/titles/nav/searchIndex + 展示层内联，file:// 三引擎可用 | 已实现 |
| CLI-003 | doclight deploy | gh-pages 一键推送（自动 /<repo>/ base）+ Cloudflare/Netlify 指引 | 已实现 |
| CLI-004 | migrate-docsify | docsify 内容迁移到 DocLight docs/ 约定 + _sidebar 解析报告 | 已实现 |

> 配套：`--base` 子路径部署（ssg.feature）、搜索索引持久化（search.feature / 03 §3.8.5）、
> 迁移指南 `docs/migration-from-docsify.md`。

## Phase 4 AI 就绪（LLMS-001 / FRONT-001 / MCP-001~003，2026-08-13 已落地）

> 对应 08-roadmap Phase 4 + 06-ai-native §6.2/§6.3/§6.4。完整闭环：「Agent 内容空间」=
> 零构建渲染 + 扩展语法 + 双读（llms.txt/MCP 返回纯 markdown 原稿）。
> 落地形态：`specs/features/ai.feature` + `packages/renderer/src/analyze.ts`（FRONT-001 语义分析）+
> `packages/cli/src/llms.ts`（llms.txt 智能分级 + 全文分节）+ `packages/mcp-server/`（MCP-001 工具 / MCP-002 stdio / MCP-003 HTTP）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| LLMS-001 | llms.txt 生成 | build 自动生成 llms.txt（站点摘要 + 智能分级 + 语义 frontmatter 条目 + Agent 端点）+ llms-full.txt（按节全文，read_doc 数据源） | 已实现 |
| FRONT-001 | 语义 frontmatter | analyzeDoc 自动计算 summary（首段）/ wordCount / readingTime / headings / hasCode；docs.json 携带结构化元数据 | 已实现 |
| MCP-001 | MCP 读取端工具 | search_docs / read_doc / list_docs / get_site_summary / get_outline / find_examples，只服务产物站点 | 已实现 |
| MCP-002 | stdio 传输 | JSON-RPC 2.0 逐行协议：initialize / tools/list / tools/call / ping；工具失败 isError=true | 已实现 |
| MCP-003 | HTTP + 发现 | POST /mcp + GET /.well-known/mcp（能力/工具列表）+ GET / 双读能力页 | 已实现 |

> 配套：MCP 只服务 dist-site（产物）而非 docs/；`build.llmsTxt` 用户分级/排除宽松读取（schema 扩展待批准）。

## Phase 4 内容空间（CLI-005 publish / CLI-006 space，2026-08-13 已落地）

> 对应 08-roadmap Phase 4 剩余 + 14-agent-content-space §3/§4。**「Agent 内容空间」写入半边**：
> 内容 = 纯 Markdown，发布 = 构建 + 落到某处（local / git / space）。CLI 是唯一事实来源，
> 所有命令输出结构化 JSON（`--json`，Agent 直接消费），无伪造成功（无远程/无端点 → 引导步骤）。
> 落地形态：`specs/features/space.feature` + `packages/cli/src/{space,publish}.ts` + index.ts（--json）+
> `.claude/skills/doclight-publish/SKILL.md`（默认入口）+ `.claude/commands/publish.md`（用户触发）+
> `docs/agent-guide.md`（可执行接入指南 + 魔法咒语，DocLight 自身构建=dogfood）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| CLI-005 | doclight publish | 发布到 local（bundle→file://）/ git（build+gh-pages→公网 URL）/ space（POST 站点清单→端点 URL）；`--json` 结构化输出 | 已实现 |
| CLI-006 | doclight space | init（默认 local，幂等）/ switch / status；`.doclight/space.json`（不入契约 schema，运行时状态） | 已实现 |
| — | doclight-publish Skill | `.claude/skills/doclight-publish/SKILL.md`：Agent 用 CLI 三步发布（整理→发布→验证反馈），对外动作先确认 | 已实现 |
| — | /publish 斜杠命令 | `.claude/commands/publish.md`：用户明确触发的「现在发布」入口 | 已实现 |
| — | Agent 接入指南 | `docs/agent-guide.md`：可执行指南（每步含命令+验证输出）+ 魔法咒语模板 + 失败处理表 | 已实现 |

> 配套：space provider 抽象（14 §3.1 可插拔）、`--json` 布尔 flag 解析修正（index.ts parseArgs）。
> 云端 Space（托管）未开通：`--to space` 无端点时结构化引导（不伪造成功），可指向自建兼容 API。

## Phase 4 遗留补强（MCP-004/005 + CLI-007 embed + SNAP-001，2026-08-13 已落地）

> 对应 08-roadmap Phase 4 遗留 + 13-deployment-distribution §3.1（分发四触点③）+ Phase 0 同构快照。
> 纯实现、零新依赖、无需用户决策的补强项：MCP 流式与插件模式、嵌入分发、三形态一致性验证。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| MCP-004 | HTTP SSE 流式 | POST /mcp 支持 Accept: text/event-stream（SSE 帧响应）+ GET /mcp 长连接流（心跳保活）；well-known 标 streamable-http | 已实现 |
| MCP-005 | 插件模式（嵌入 dev server） | `doclight dev --mcp`：同端口 /mcp + /.well-known/mcp，懒构建快照（文件变更置脏重建），capabilitiesAtRoot=false 不抢站点首页 | 已实现 |
| CLI-007 | doclight embed | 分发四触点③嵌入分发：生成 snippet.js（自推导基址 + 响应式 iframe）+ 可复制 iframe 片段 | 已实现 |
| SNAP-001 | 同构快照 | 三形态（dev/SSG/bundle）同一 docs 渲染内容一致（仅链接后缀差异归一，决策⑤）；Phase 0 遗留闭环 | 已实现 |

> 配套：`mcpHttpHandler` 从独立服务抽出为可挂载 handler（cli 引入 workspace 依赖 doclight-mcp-server，零外部依赖）。

## Phase 4 用户决策批次（A schema + C1-C4，2026-08-13 已落地）

> 对应 08-roadmap Phase 4 遗留中需要用户决策的项：契约扩展 + 分发四触点剩余 + 体验细节。
> 引入 2 个新依赖（@resvg/resvg-js 光栅化 + qrcode 二维码，均为 CLI 构建期依赖，不影响运行时体积）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| CONTRACT-001 | doclight.json 契约扩展 | contracts/doclight.schema.json 补 base/siteUrl/outputDir + build.llmsTxt.{priority,exclude}；只加不改，additionalProperties:false 保留 | 已实现 |
| SEO-003 | OG 卡片 PNG 栅格化 | @resvg/resvg-js 渲染 1200×630 OG 卡为 PNG（og/*.png）；og:image 指向 PNG（微信/微博兼容）；SVG 保留作为降级 | 已实现 |
| CLI-008 | bundle 下载二维码 | `doclight bundle --qr <url>` 生成 bundle-qr.png（分发四触点④）；qrcode 库纯 JS，无原生依赖 | 已实现 |
| CLI-009 | bundle vendor 内联 | `doclight bundle --inline-vendor`：Prism/Mermaid/KaTeX JS+CSS 内联进单文件（file:// 下扩展可用）；opt-in 保持默认体积小 | 已实现 |
| UX-001 | 体验细节（专注/字号/打印/Powered by） | 专注模式（隐藏侧栏/TOC 聚焦内容）+ 字号调节（3 档步进 0.875/1/1.125/1.25）+ 打印样式（隐藏导航控件）+ Powered by 标记（默认开，一行关闭）；全部 localStorage 持久化 | 已实现 |

> 配套：display 层 `extensions.ts` 懒加载跳过已内联全局（C3）；`ux.ts` 纯函数可单测；site.ts renderPage 加 CSS + 按钮 + footer。

## Phase 6 P0 能力协议 + 发布产物 Agent 友好（CAP-001 / AEO-001，2026-08-13 已落地）

> 对应 08-roadmap Phase 6 P0 + ADR-0004（v3 定位「把 Markdown 变成作品」）+ research/product-vision-validation.md §五。
> 「能力协议」= Agent 写内容前知道这个站能渲染什么（原则零第一落地）；「发布产物 Agent 友好」= 发布后的站点
> Agent 读取最优（每页 markdown 版本 + llms.txt v2 Link 关系 + token 计数）。
> 落地形态：`specs/features/capabilities.feature` + `specs/features/aeo.feature` + `packages/cli/src/{capabilities,tokens,agents}.ts`
> + `packages/mcp-server/src/tools.ts`（get_capabilities 工具，置首）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| CAP-001 | 能力协议 | capabilities.json（扩展语法/插件能力/frontmatter 约定/Agent 端点，单一事实来源）+ 三形态一致（SSG 产物 / dev 端点 / bundle 产物）+ MCP get_capabilities（缺失诚实降级）+ AGENTS.md 生成（init + 本仓库 dogfood，与 capabilities.json 同源） | 已实现 |
| AEO-001 | 发布产物 Agent 友好 | 每页 .md 版本（产物副本 + `<link rel="alternate" type="text/markdown">`）+ llms.txt v2 Link 关系（`rel="describedby"` 指向 llms.txt）+ token 计数（docs.json 每篇/llms.txt 条目与头部/页面 meta，启发式估算） | 已实现 |

> 配套：PluginDef 新增 `capabilities?: string[]`（插件能力声明，官方插件 6 个已声明）；llms.txt Agent 端点补
> /capabilities.json；well-known 发现补 capabilitiesEndpoint；docs.json 补 totalTokens；sitemap 不含 .md（SEO 不重复收录）。

## Phase 6 P1 表现层设计系统化（VIS-001，2026-08-13 已落地）

> 对应 08-roadmap Phase 6 P1 + ADR-0004（v3 定位「把 Markdown 变成作品」）+ 11-default-themes（4 套设计语言规格）。
> 表现层是产品价值主线（v3 原则一）：同样的 md 内容经 DocLight 呈现后视觉质量显著更高，视觉质量机器化保障。
> 落地形态：`specs/features/visual.feature` + `packages/cli/src/themes/*.css`（4 套设计语言独立 CSS 文件）
> + `themes.ts`（主题包模型：css + defaultTheme）+ `gallery.ts`（主题画廊）+ `design-compliance.ts`（机器化合规）
> + `scripts/checks/visual.mjs`（verify visual check）+ `scripts/visual-regression.spec.ts`（像素级回归，基线人工锁定）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| VIS-001 | 表现层设计系统化 | 4 套设计语言兑现（minimal 与默认一致 / serif 学术 / modern 暗色优先 / warm 温暖，各含亮暗令牌 + 组件级特征）+ 主题包模型（defaultTheme，modern 首次进入即暗色）+ 主题画廊（build/preview --themes：4×2 面板 + 内置示例文档 + fixedTheme 钉死）+ 设计合规门禁（verify 增 visual check：WCAG AA 对比度 / 8pt 网格 / 1.25 字号节奏，直读 CSS 断言）+ 像素级视觉回归（verify:visual：24 组截图基线，人工锁定后 diff）+ 默认主题字号打磨（1.25 模块化缩放） | 已实现 |

> 配套：组件定制三入口文档 `docs/component-gallery.md`（CSS 覆盖 / extendMarked / 插件插槽——Astryx 式可定制）；
> 主题 CSS 独立成文件 = 未来主题市场载体；`npm run verify:visual` / `verify:visual:update` 命令。

## 目录结构约定

```
specs/
├── README.md            # 本文件：约定与索引
├── <NNN>-<topic>.md     # RFC 式设计规格（背景→目标→范围→设计→验收准则）
└── features/
    └── <topic>.feature  # Gherkin 行为规格（Given/When/Then）
```

## 需求 ID 与追溯（10 §1.4）

- 每个需求项有唯一 ID：`<前缀>-<序号>`（如 `SRCH-001`）
- 前缀表：`SRCH`(搜索) / `REND`(渲染) / `NAV`(导航) / `TOC` / `THEME` / `SSG` / `MCP` / `PLUG`(插件) / `SPACE`(内容空间) / `CLI` / `SEO`(搜索优化，Phase 3 新增) / `DEV`(dev server，Phase 1 新增) / `LLMS`(llms.txt，Phase 4 新增) / `FRONT`(语义 frontmatter，Phase 4 新增) / `SNAP`(同构快照，Phase 4 补强新增) / `CAP`(能力协议，Phase 6 P0 新增) / `AEO`(Agent 发布优化/发布产物 Agent 友好，Phase 6 P0 新增) / `VIS`(表现层设计系统化，Phase 6 P1 新增) — 新增前缀须登记（注：ID 正则限 2-5 大写字母，过长前缀不被 spec:check 识别）
- Agent 在**提交信息与代码中引用需求 ID**（`feat(SRCH-001): ...`）
- `npm run spec:check` 校验链路：specs 中的每个 ID 在 `packages/*` 的源码或测试中有引用
- 只有 `.feature` 与编号 RFC 规格（`NNN-*.md`）承载需求 ID；本 README 中的示例 ID 仅供说明，不计入追溯（spec:check 不扫描约定文档）

## RFC 式规格格式约定

```
# <NNN> · <标题>（需求 ID）

## 背景    为什么现在做（数据/用户/roadmap 依据）
## 目标    完成什么（可衡量、机器可验证）
## 范围    明确做/不做（防 scope 蔓延）
## 设计    关键方案与决策
## 验收准则  Gherkin（Given/When/Then，可被测试直接消费）
```

## Gherkin 验收准则示例

```gherkin
# 验收准则：SRCH-001 内置搜索零配置可用
Feature: 内置搜索
  Scenario: 无任何配置即可搜索
    Given 一个只有 docs/ 文件夹的站点
    When 用户按 Cmd+K 打开搜索框并输入关键词
    Then 搜索结果在 50ms 内返回
    And 结果包含路径面包屑与命中摘要
```
