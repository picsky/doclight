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
- 前缀表：`SRCH`(搜索) / `REND`(渲染) / `NAV`(导航) / `TOC` / `THEME` / `SSG` / `MCP` / `PLUG`(插件) / `SPACE`(内容空间) / `CLI` / `SEO`(搜索优化，Phase 3 新增) / `DEV`(dev server，Phase 1 新增) / `LLMS`(llms.txt，Phase 4 新增) / `FRONT`(语义 frontmatter，Phase 4 新增) — 新增前缀须登记
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
