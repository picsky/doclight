# 验收准则：LLMS-001 llms.txt 生成 / FRONT-001 语义 frontmatter / MCP-001~003 MCP Server（06-ai-native §6.2/§6.3/§6.4）
# 实现位置：packages/renderer/src/analyze.ts（FRONT-001）+ packages/cli/src/llms.ts、build.ts（LLMS-001 + docs.json）
#          + packages/mcp-server/（MCP-001 工具 / MCP-002 stdio / MCP-003 HTTP+发现）

Feature: AI 就绪（llms.txt / 语义 frontmatter / MCP Server，Phase 4）
  让 AI Agent 能读取、理解、操作文档站：llms.txt 是站点地图，语义 frontmatter 让结构
  可理解，MCP Server 让 Agent 能搜索/阅读/列大纲（06 §6.1 使用端 Level 1-4）。

  Scenario: LLMS-001 doclight build 自动生成 llms.txt
    Given 运行 doclight build
    Then 产物含 llms.txt（站点摘要 + Agent 专用端点 + 术语表 + 分级文档清单）
    And llms.txt 含字符串 "MCP"（Agent 端点说明）
    And llms.txt 含 /llms-full.txt 链接
    And 智能分级生效：根级 README/quickstart → 核心文档；guide/ → 使用指南；api/faq → 参考资料
    And 用户自定义 doclight.json build.llmsTxt.priority/exclude 生效（宽松读取）
    And exclude 的文档同时从 llms.txt 与 llms-full.txt 剔除

  Scenario: LLMS-001 llms.txt 条目包含语义 frontmatter（合同验收项）
    Given 文档带 summary/tags 或可自动提取
    Then llms.txt 条目含摘要与标签与阅读时长（summary/tags/readingTime）

  Scenario: LLMS-001 llms-full.txt 全文按节分节
    Given 运行 doclight build
    Then 产物含 llms-full.txt（每篇文档纯 markdown 全文）
    And 按 `## 路径：<path>` 分节（MCP read_doc 依赖此结构）
    And llms-full.txt 无 "error" 字符串

  Scenario: FRONT-001 语义 frontmatter 自动计算
    Given 文档 frontmatter 未显式写 summary/readingTime/wordCount
    Then analyzeDoc 自动提取 summary（首段，~200 字截断）
    And 自动计算 wordCount（CJK 逐字 + 非 CJK 分词）与 readingTime（/300，至少 1）
    And 提取 headings 大纲（含锚点 id，与渲染内核 slugify 一致）
    And hasCode 标记是否含代码块

  Scenario: FRONT-001 docs.json 携带结构化元数据
    Given 运行 doclight build
    Then 产物含 docs.json（version/generatedAt/siteTitle/totalDocs/docs[]）
    And 每篇含 path/url/title/summary/tags/category/priority/readingTime/wordCount/headings/hasCode/updatedAt

  Scenario: MCP-001 六个读取端工具正常
    Given MCP Server 加载产物站点
    Then search_docs 全文搜索返回结构化结果（path/score/snippet/url）
    And read_doc 返回纯 markdown 原稿（REND-004 双读友好），支持 section/format
    And list_docs 按 prefix/category/tags 过滤
    And get_site_summary 返回站点摘要（totalDocs/categories/keyTopics/suggestedEntry）
    And get_outline 返回文档大纲（headings）
    And find_examples 只搜代码块（按语言/内容过滤）
    And 工具失败返回 isError=true 且消息可读（无堆栈泄露）

  Scenario: MCP-002 stdio 传输（JSON-RPC 2.0）
    Given 通过 stdin/stdout 以逐行 JSON 与 MCP Server 通信
    Then initialize 返回协议版本 + tools 能力 + serverInfo
    And tools/list 返回六工具（name/description/inputSchema）
    And tools/call 返回 { content: [{type:text}], isError }
    And notification（无 id）不发响应

  Scenario: MCP-003 HTTP 传输 + well-known 发现
    Given 以 --port 启动 HTTP MCP Server
    Then POST /mcp 处理 JSON-RPC（initialize/tools/list/tools/call）
    And GET /.well-known/mcp 返回发现端点（能力 + 工具列表 + endpoint）
    And GET / 返回双读能力页（人 + Agent 可读）

  Scenario: MCP-004 HTTP SSE 流式（Streamable HTTP）
    Given 以 Accept: text/event-stream POST /mcp
    Then 响应为 text/event-stream 且含 event: message + data 帧（JSON-RPC 结果）
    Given GET /mcp（Accept: text/event-stream）
    Then 返回长连接流（心跳注释帧，只读服务无主动通知）

  Scenario: MCP-005 插件模式（嵌入 dev server）
    Given 以 doclight dev --mcp 启动开发服务器
    Then 同端口提供 POST /mcp（JSON-RPC）与 GET /.well-known/mcp（发现）
    And 站点快照来自 docs/（懒构建，文件变更后重建）
    And GET / 仍服务站点（capabilitiesAtRoot=false 不抢占首页）
