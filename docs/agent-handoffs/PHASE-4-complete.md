# TASK: Phase 4 AI 就绪（llms.txt / 语义 frontmatter / MCP Server）（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 + 单测 **221/221**（新增 62）+ spec:check 24/24 + MCP 双传输端到端实测）
> 上游：08-roadmap Phase 4 + 06-ai-native §6.2/§6.3/§6.4 + specs/features/ai.feature
> **下一步：Phase 4 剩余（Agent 内容空间：publish CLI / doclight-publish Skill / 接入指南）** + 遗留项见文末
> 本文件是新会话第一入口；交接格式见 AGENT.md。

---

## 本次完成清单（需求 ID 可追溯，specs/features/ai.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **LLMS-001** | `doclight build` 自动生成 llms.txt（站点摘要 + 智能分级 + 语义 frontmatter 条目 + Agent 端点 + 术语表）+ llms-full.txt（全文按 `## 路径：<path>` 分节） | `packages/cli/src/llms.ts` + `build.ts` | llms.test.ts 10 例 + build.test.ts 集成 |
| **FRONT-001** | 语义 frontmatter 自动计算：analyzeDoc 提取 summary（首段）/wordCount/readingTime/headings/hasCode（slugify 与渲染内核一致） | `packages/renderer/src/analyze.ts`（src/ 非受保护 core/） | analyze.test.ts 9 例 |
| — | docs.json 增强：每篇 path/url/title/summary/tags/category/priority/difficulty/readingTime/wordCount/headings/hasCode/updatedAt | `build.ts` | build.test.ts |
| **MCP-001** | 六读取端工具：search_docs / read_doc / list_docs / get_site_summary / get_outline / find_examples（**只服务产物站点 dist-site**） | `packages/mcp-server/src/{tools,site,search}.ts` | tools.test.ts 21 例 |
| **MCP-002** | stdio 传输：JSON-RPC 2.0 逐行协议（initialize/tools/list/tools/call/ping；工具失败 isError=true 不泄露堆栈） | `protocol.ts` + `stdio.ts` | protocol.test.ts 7 例 + stdio 端到端 |
| **MCP-003** | HTTP 传输 + well-known 发现：POST /mcp + GET /.well-known/mcp（能力/工具列表）+ GET / 双读能力页 | `http.ts` | http.test.ts 6 例 + HTTP 端到端 |

## 关键实现细节

### llms.txt（LLMS-001）
- **智能分级**（06 §6.2.1 表格）：frontmatter.priority 显式 > 用户 `doclight.json build.llmsTxt.priority`（精确路径/目录前缀）> 默认规则（根级 README/quickstart→high；guide/tutorial/how-to→medium；api/faq→low；其余 medium）。
- **排除**：`build.llmsTxt.exclude` 同时从 llms.txt 与 llms-full.txt 剔除（用户明确不想让 Agent 看到的内容）。配置宽松读取（schema 扩展待批准，与 base/siteUrl 同一先例）。
- **llms.txt 条目含语义 frontmatter**（合同验收项）：summary / 标签 / 分类 / 阅读时长。
- **llms-full.txt 分节契约**：`## 路径：<path>` 为节头，MCP read_doc 依赖此结构提取单篇原稿（REND-004 双读友好——Agent 读到的是纯 markdown 源文件，非渲染后 HTML）。

### 语义 frontmatter（FRONT-001）
- 刻意放 `renderer/src/analyze.ts`（**不碰受保护 src/core/**，只新增不改渲染管线），与渲染内核共享 slugify，保证 MCP 锚点与页面锚点一致。
- countWords：CJK 逐字 + 非 CJK 分词，剥 frontmatter/代码块/块级标记（与 05 §5.4 JSON-LD 口径一致）。

### MCP Server（MCP-001/002/003）
- **零依赖实现协议**（决策：spec 化 MCP，不引 @modelcontextprotocol/sdk，守「加依赖是最高危操作」红线）。Node 原生 JSON-RPC 2025-06-18 子集。
- **只服务 dist-site**（`doclight build` 产物）：docs.json（元数据）/ search-index.json（检索，自建倒排与展示层同形状）/ llms-full.txt（全文原稿）。产物缺省优雅降级（空结果 / 明确提示先 build）。
- 工具失败 → `isError:true` + 可读消息（MCP spec 语义），方法级错误 → JSON-RPC -32601。
- 检索镜像展示层 `display/src/search.ts`（SRCH 决策同形状自研，一处可替换）。
- **运行方式**：stdio（默认，Claude Desktop 接入）/ HTTP（`--port`，远程 Agent + well-known 发现）。
- ⚠️ Node strip-only TS 模式不支持构造器参数属性——McpServer 用显式字段赋值（可擦除语法）。

## 端到端实测（本仓库 docs/ 27 篇 dogfood）

```
build → dist-site-dogfood/
  llms.txt     27 条（分级分组 + 语义字段）
  llms-full.txt 27 节（## 路径：分节，无生成故障）
  docs.json    totalDocs 27 + 每篇结构化元数据

HTTP MCP（--port 动态）：
  INIT → doclight-mcp / protocol 2025-06-18 / tools 能力
  tools/list → 6 工具
  search_docs "MCP" → total 10，top 06-ai-native（/tech-design/06-ai-native.html）
  read_doc 06-ai-native.md §6.4 → format markdown，wordCount 2293
  get_site_summary → totalDocs 27
  /.well-known/mcp → endpoint /mcp + 6 工具

stdio MCP（Claude Desktop 接入形态）：
  initialize → tools/list(6) → search_docs "llms.txt" → total 2，全链路正常
```

## 遗留问题（Phase 4 剩余 + 长期）

- **Agent 内容空间（Phase 4 主交付剩余）**：`doclight publish` CLI（local/git/space）+ `doclight-publish` Skill（SKILL.md）+ `/publish` 斜杠命令 + `doclight space init/switch/status` + 接入指南（魔法咒语 dogfood）——见 08-roadmap Phase 4「内容写入与接入体验」与 14-agent-content-space
- `doclight.json` 契约扩展（build.llmsTxt/base/siteUrl/outputDir 入 schema，需用户批准）
- MCP 插件模式（嵌入 dev server，roadmap 项；当前独立 HTTP 服务已覆盖部署场景）
- MCP HTTP 仅单请求/响应子集（无 SSE 流式）；read_doc format=html 降级策略已内置
- OG 卡片光栅化 / bundle vendor 内联 / embed / 二维码（分发四触点剩余）

## 验证命令

```bash
npm run verify          # 全绿（单测 221/221 + e2e + lint + typecheck + size + contract）
npm run spec:check      # 24/24（LLMS-001/FRONT-001/MCP-001~003 全部追溯）
# MCP 手动验证：
node packages/mcp-server/src/index.ts --site dist-site --port 3100
curl http://localhost:3100/.well-known/mcp
```
